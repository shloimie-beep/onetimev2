import { createHmac } from 'node:crypto';
import { z } from 'zod';
import { localPartsFor, zonedDateTimeToUtc } from '../classes/schedule.ts';
import { constantTimeEqual, redactedRefHash, stableProviderKey } from './shared.ts';

export type ZoomRestEnvironment = 'test' | 'staging' | 'production';
export type ZoomFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type ZoomServerToServerCredentials = {
  accountId: string;
  clientId: string;
  clientSecret: string;
};

export type ZoomMeetingSdkCredentials = {
  sdkKey: string;
  sdkSecret: string;
};

export type ZoomRestClientOptions = {
  credentials: ZoomServerToServerCredentials;
  environment: ZoomRestEnvironment;
  enabled: boolean;
  apiBaseUrl?: string | undefined;
  oauthTokenUrl?: string | undefined;
  timeoutMs?: number | undefined;
  fetchImpl?: ZoomFetch | undefined;
};

export type ZoomDailyMeetingInput = {
  hostUserId: string;
  localDate: string;
  topic: string;
  durationMinutes: number;
  agenda?: string | undefined;
};

export type ZoomDailyMeetingRecord = {
  provider: 'zoom';
  meeting_id: string;
  provider_meeting_ref_digest: string;
  local_time: '19:00';
  timezone: 'Asia/Jerusalem';
  type: 8;
  occurrence_count: number;
  occurrences: ZoomOccurrenceReference[];
  raw_start_url_present: false;
  raw_join_url_present: false;
};

export type ZoomIsolatedMeetingRecord = {
  provider: 'zoom';
  meeting_id: string;
  provider_meeting_ref_digest: string;
  type: 2;
  starts_at: string;
  duration_minutes: number;
  raw_start_url_present: false;
  raw_join_url_present: false;
};

export type ZoomIsolatedMeetingPrivateMaterial = {
  meeting: ZoomIsolatedMeetingRecord;
  password: string;
};

export type ZoomOccurrenceReference = {
  occurrence_id: string;
  starts_at: string;
  local_class_date: string;
  status: 'available' | 'deleted' | 'unknown';
};

export type ZoomRegistrantInput = {
  meetingId: string;
  occurrenceId?: string | undefined;
  learnerKey: string;
  displayName: string;
  email: string;
};

export type ZoomRegistrantRecord = {
  provider: 'zoom';
  meeting_id_digest: string;
  occurrence_id: string;
  learner_key: string;
  registrant_id_digest: string;
  registrant_token: string;
  registrant_token_ref: string;
  join_url_digest: string;
  raw_join_url_present: false;
};

export class ZoomApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;

  constructor(status: number, code: string, message: string, retryable = false) {
    super(message);
    this.name = 'ZoomApiError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
});

const meetingResponseSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((value) => String(value)),
  type: z.number().optional(),
  occurrences: z
    .array(
      z.object({
        occurrence_id: z.string().min(1),
        start_time: z.string().min(1),
        status: z.enum(['available', 'deleted']).optional(),
      }),
    )
    .optional()
    .default([]),
  start_url: z.string().optional(),
  join_url: z.string().optional(),
  password: z.string().optional().default(''),
});

const zakResponseSchema = z.object({ token: z.string().min(16) });

const registrantResponseSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  registrant_id: z.string().optional(),
  join_url: z.string().url(),
});

export function createZoomRestClient(options: ZoomRestClientOptions) {
  const apiBaseUrl = trimTrailingSlash(options.apiBaseUrl ?? 'https://api.zoom.us/v2');
  const oauthTokenUrl = options.oauthTokenUrl ?? 'https://zoom.us/oauth/token';
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8_000;
  let cachedToken: { value: string; expiresAt: number } | null = null;

  async function accessToken() {
    assertEnabled(options);
    const now = Date.now();
    if (cachedToken && cachedToken.expiresAt - 60_000 > now) return cachedToken.value;
    const url = new URL(oauthTokenUrl);
    url.searchParams.set('grant_type', 'account_credentials');
    url.searchParams.set('account_id', options.credentials.accountId);
    const authorization = Buffer.from(
      `${options.credentials.clientId}:${options.credentials.clientSecret}`,
    ).toString('base64');
    const response = await fetchWithTimeout(
      fetchImpl,
      url,
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${authorization}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
      },
      timeoutMs,
    );
    const json = await safeJson(response);
    if (!response.ok) throw zoomError(response.status, json);
    const parsed = tokenResponseSchema.parse(json);
    cachedToken = {
      value: parsed.access_token,
      expiresAt: now + Math.max(60, parsed.expires_in ?? 3600) * 1000,
    };
    return cachedToken.value;
  }

  async function zoomJson(path: string, init: RequestInit = {}) {
    const token = await accessToken();
    const response = await fetchWithTimeout(
      fetchImpl,
      new URL(path.replace(/^\/+/, ''), `${apiBaseUrl}/`),
      {
        ...init,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          ...(init.headers ?? {}),
        },
      },
      timeoutMs,
    );
    const json = await safeJson(response);
    if (!response.ok) throw zoomError(response.status, json);
    return json;
  }

  return {
    async createIsolatedTestMeeting(input: {
      hostUserId: string;
      startsAt: Date;
      topic: string;
      durationMinutes: number;
    }): Promise<ZoomIsolatedMeetingPrivateMaterial> {
      const json = await zoomJson(`/users/${encodeURIComponent(input.hostUserId)}/meetings`, {
        method: 'POST',
        body: JSON.stringify({
          topic: input.topic,
          type: 2,
          start_time: input.startsAt.toISOString(),
          timezone: 'Asia/Jerusalem',
          duration: input.durationMinutes,
          agenda: 'Isolated fictional-student control verification. No customer invitations.',
          settings: {
            approval_type: 0,
            registrants_confirmation_email: false,
            registrants_email_notification: false,
            join_before_host: false,
            mute_upon_entry: true,
            participant_video: false,
            host_video: true,
            waiting_room: true,
          },
        }),
      });
      const parsed = meetingResponseSchema.parse(json);
      return {
        meeting: {
          provider: 'zoom',
          meeting_id: parsed.id,
          provider_meeting_ref_digest: redactedRefHash(parsed.id),
          type: 2,
          starts_at: input.startsAt.toISOString(),
          duration_minutes: input.durationMinutes,
          raw_start_url_present: false,
          raw_join_url_present: false,
        },
        password: parsed.password,
      };
    },

    async createDailyRecurringMeeting(
      input: ZoomDailyMeetingInput,
    ): Promise<ZoomDailyMeetingRecord> {
      const localParts = parseLocalDate(input.localDate);
      const startsAt = zonedDateTimeToUtc(localParts, 19, 0, 'Asia/Jerusalem').toISOString();
      const json = await zoomJson(`/users/${encodeURIComponent(input.hostUserId)}/meetings`, {
        method: 'POST',
        body: JSON.stringify({
          topic: input.topic,
          type: 8,
          start_time: startsAt,
          timezone: 'Asia/Jerusalem',
          duration: input.durationMinutes,
          agenda: input.agenda ?? 'Daily One Time Mishnayos',
          recurrence: {
            type: 1,
            repeat_interval: 1,
            end_times: 50,
          },
          settings: {
            approval_type: 0,
            registration_type: 2,
            registrants_confirmation_email: false,
            registrants_email_notification: false,
            join_before_host: false,
            mute_upon_entry: true,
            participant_video: false,
            host_video: true,
            waiting_room: true,
          },
        }),
      });
      const parsed = meetingResponseSchema.parse(json);
      return sanitizeMeeting(parsed);
    },

    async getMeeting(meetingId: string): Promise<ZoomDailyMeetingRecord> {
      const json = await zoomJson(`/meetings/${encodeURIComponent(meetingId)}`, {
        method: 'GET',
      });
      return sanitizeMeeting(meetingResponseSchema.parse(json));
    },

    async addLearnerRegistrant(input: ZoomRegistrantInput): Promise<ZoomRegistrantRecord> {
      const display = splitDisplayName(input.displayName);
      const path = input.occurrenceId
        ? `/meetings/${encodeURIComponent(input.meetingId)}/registrants?occurrence_ids=${encodeURIComponent(input.occurrenceId)}`
        : `/meetings/${encodeURIComponent(input.meetingId)}/registrants`;
      const json = await zoomJson(path, {
        method: 'POST',
        body: JSON.stringify({
          email: input.email,
          first_name: display.firstName,
          last_name: display.lastName,
          auto_approve: true,
        }),
      });
      const parsed = registrantResponseSchema.parse(json);
      const token = registrantTokenFromJoinUrl(parsed.join_url);
      const registrantId = parsed.registrant_id ?? parsed.id ?? token;
      return {
        provider: 'zoom',
        meeting_id_digest: redactedRefHash(input.meetingId),
        occurrence_id: input.occurrenceId ?? 'single',
        learner_key: input.learnerKey,
        registrant_id_digest: redactedRefHash(String(registrantId)),
        registrant_token: token,
        registrant_token_ref: stableProviderKey('zoom_registrant_token', [
          input.meetingId,
          input.occurrenceId ?? 'single',
          input.learnerKey,
          String(registrantId),
        ]),
        join_url_digest: redactedRefHash(parsed.join_url),
        raw_join_url_present: false,
      };
    },

    async enableMeetingRegistration(meetingId: string) {
      await zoomJson(`/meetings/${encodeURIComponent(meetingId)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          settings: {
            approval_type: 1,
            registration_type: 1,
            registrants_confirmation_email: false,
            registrants_email_notification: false,
          },
        }),
      });
    },

    async disableMeetingRegistration(meetingId: string) {
      await zoomJson(`/meetings/${encodeURIComponent(meetingId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ settings: { approval_type: 2 } }),
      });
    },

    async getHostZakToken(hostUserId: string) {
      const json = await zoomJson(`/users/${encodeURIComponent(hostUserId)}/token?type=zak`, {
        method: 'GET',
      });
      return zakResponseSchema.parse(json).token;
    },
  };
}

export function createLearnerZoomSdkSignature(input: {
  credentials: ZoomMeetingSdkCredentials;
  meetingNumber: string;
  issuedAt?: Date | undefined;
  ttlSeconds?: number | undefined;
}) {
  return createZoomMeetingSdkSignature({ ...input, role: 0 });
}

export function createHostZoomSdkSignature(input: {
  credentials: ZoomMeetingSdkCredentials;
  meetingNumber: string;
  issuedAt?: Date | undefined;
  ttlSeconds?: number | undefined;
}) {
  return createZoomMeetingSdkSignature({ ...input, role: 1 });
}

export function createZoomMeetingSdkSignature(input: {
  credentials: ZoomMeetingSdkCredentials;
  meetingNumber: string;
  role: 0 | 1;
  issuedAt?: Date | undefined;
  ttlSeconds?: number | undefined;
}) {
  const issuedAtSeconds = Math.floor((input.issuedAt ?? new Date()).getTime() / 1000);
  const ttlSeconds = Math.min(Math.max(input.ttlSeconds ?? 2 * 60 * 60, 30 * 60), 2 * 60 * 60);
  return signJwt(
    {
      appKey: input.credentials.sdkKey,
      sdkKey: input.credentials.sdkKey,
      mn: input.meetingNumber,
      role: input.role,
      iat: issuedAtSeconds,
      exp: issuedAtSeconds + ttlSeconds,
      tokenExp: issuedAtSeconds + ttlSeconds,
    },
    input.credentials.sdkSecret,
  );
}

export function resolveZoomOccurrenceForLocalDate(input: {
  occurrences: ZoomOccurrenceReference[];
  localDate: string;
  timezone?: 'Asia/Jerusalem' | undefined;
}) {
  const timezone = input.timezone ?? 'Asia/Jerusalem';
  return (
    input.occurrences.find((occurrence) => {
      const parts = localPartsFor(new Date(occurrence.starts_at), timezone);
      const localDate = [
        String(parts.year).padStart(4, '0'),
        String(parts.month).padStart(2, '0'),
        String(parts.day).padStart(2, '0'),
      ].join('-');
      return localDate === input.localDate && occurrence.status !== 'deleted';
    }) ?? null
  );
}

export function registrantTokenFromJoinUrl(joinUrl: string) {
  const parsed = new URL(joinUrl);
  const token = parsed.searchParams.get('tk');
  if (!token)
    throw new ZoomApiError(502, 'ZOOM_REGISTRANT_TOKEN_MISSING', 'Zoom registrant token missing.');
  return token;
}

export function assertNoZoomSecretLeak(serialized: string) {
  if (
    /("(?:start_url|access_token|client_secret|sdk_secret|zak|passcode|password)"\s*:|https:\/\/[^"\s]*zoom\.us)/i.test(
      serialized,
    )
  ) {
    throw new Error('Zoom response contains a private provider value.');
  }
}

function sanitizeMeeting(meeting: z.infer<typeof meetingResponseSchema>): ZoomDailyMeetingRecord {
  const record = {
    provider: 'zoom' as const,
    meeting_id: meeting.id,
    provider_meeting_ref_digest: redactedRefHash(meeting.id),
    local_time: '19:00' as const,
    timezone: 'Asia/Jerusalem' as const,
    type: 8 as const,
    occurrence_count: meeting.occurrences.length,
    occurrences: meeting.occurrences.map((occurrence) => ({
      occurrence_id: occurrence.occurrence_id,
      starts_at: new Date(occurrence.start_time).toISOString(),
      local_class_date: localDateFor(occurrence.start_time),
      status: (occurrence.status ?? 'unknown') as ZoomOccurrenceReference['status'],
    })),
    raw_start_url_present: false as const,
    raw_join_url_present: false as const,
  };
  assertNoZoomSecretLeak(JSON.stringify(record));
  return record;
}

async function fetchWithTimeout(
  fetchImpl: ZoomFetch,
  input: string | URL,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ZoomApiError(0, 'ZOOM_TIMEOUT', 'Zoom request timed out.', true);
    }
    throw new ZoomApiError(0, 'ZOOM_NETWORK_ERROR', 'Zoom request failed.', true);
  } finally {
    clearTimeout(timeout);
  }
}

async function safeJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: 'Zoom returned a non-JSON response.' };
  }
}

function zoomError(status: number, json: unknown) {
  const body = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  const code =
    typeof body.code === 'number' || typeof body.code === 'string'
      ? String(body.code)
      : `HTTP_${status}`;
  const retryable = status === 0 || status === 408 || status === 429 || status >= 500;
  return new ZoomApiError(status, `ZOOM_${code}`, safeZoomErrorMessage(status), retryable);
}

function safeZoomErrorMessage(status: number) {
  if (status === 401 || status === 403)
    return 'Zoom credentials are not authorized for this operation.';
  if (status === 404) return 'Zoom meeting or registrant was not found.';
  if (status === 429) return 'Zoom rate limit reached.';
  if (status >= 500) return 'Zoom provider is temporarily unavailable.';
  return 'Zoom provider request failed.';
}

function assertEnabled(options: ZoomRestClientOptions) {
  if (!options.enabled) {
    throw new ZoomApiError(503, 'ZOOM_PROVIDER_DISABLED', 'Zoom provider is disabled.');
  }
  if (options.environment === 'production') {
    throw new ZoomApiError(
      503,
      'ZOOM_PRODUCTION_BLOCKED',
      'Zoom production provider calls are not enabled by OT-103.',
    );
  }
}

function signJwt(payload: Record<string, string | number>, secret: string) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function base64Url(value: string) {
  return Buffer.from(value).toString('base64url');
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function parseLocalDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error('Expected local date in YYYY-MM-DD format.');
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function localDateFor(value: string) {
  const parts = localPartsFor(new Date(value), 'Asia/Jerusalem');
  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-');
}

function splitDisplayName(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  const [firstName, ...rest] = normalized.split(' ');
  return {
    firstName: firstName || 'Learner',
    lastName: rest.join(' ') || 'Student',
  };
}

export function constantTimeZoomSignatureEqual(left: string, right: string) {
  return constantTimeEqual(left, right);
}
