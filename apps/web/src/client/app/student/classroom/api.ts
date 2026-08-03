import type {
  EmbeddedJoinDenialCode,
  EphemeralMeetingSdkBootstrap,
} from '../../../../../../../packages/contracts/src/classroom/embedded/index.ts';

const CLASSROOM_API_BASE = '/api/app/classroom' as const;
const MAX_BOOTSTRAP_LIFETIME_MS = 60_000;
const MAX_LEASE_LIFETIME_MS = 90_000;

type ClassroomFetch = typeof fetch;

export type StudentClassroomLease = {
  lease_generation: number;
  version: number;
  lease_expires_at: string;
};

export type StudentClassroomHeartbeat = StudentClassroomLease & {
  persisted: true;
  next_heartbeat_at: string;
};

export type StudentClassroomBootstrap = {
  bootstrap: EphemeralMeetingSdkBootstrap;
  lease: StudentClassroomLease;
  recording_capture_active: boolean;
};

export class StudentClassroomApiError extends Error {
  readonly status: number;
  readonly denialCode: EmbeddedJoinDenialCode | null;

  constructor(status: number, denialCode: EmbeddedJoinDenialCode | null) {
    super(status === 401 ? 'The classroom session expired.' : 'The classroom is unavailable.');
    this.name = 'StudentClassroomApiError';
    this.status = status;
    this.denialCode = denialCode;
  }
}

export function createStudentClassroomApi(
  input: {
    fetcher?: ClassroomFetch;
    now?: () => Date;
    exchangeSecret?: () => string;
    idempotencyKey?: () => string;
  } = {},
) {
  const fetcher = input.fetcher ?? globalThis.fetch.bind(globalThis);
  const now = input.now ?? (() => new Date());
  const nextExchangeSecret = input.exchangeSecret ?? (() => secureOpaqueValue('p18-exchange'));
  const nextIdempotencyKey = input.idempotencyKey ?? (() => secureOpaqueValue('p18-client'));

  return {
    async bootstrap(csrfToken: string, signal?: AbortSignal): Promise<StudentClassroomBootstrap> {
      let exchangeSecret = nextExchangeSecret();
      try {
        const response = await post(
          fetcher,
          '/bootstrap',
          { exchange_secret: exchangeSecret },
          csrfToken,
          signal,
        );
        requirePrivateNoStore(response);
        const data = await readSuccessData(response);
        return parseBootstrap(data, now());
      } finally {
        exchangeSecret = '';
      }
    },

    async heartbeat(
      csrfToken: string,
      lease: Pick<StudentClassroomLease, 'lease_generation' | 'version'>,
      signal?: AbortSignal,
    ): Promise<StudentClassroomHeartbeat> {
      const response = await post(
        fetcher,
        '/heartbeat',
        {
          lease_generation: lease.lease_generation,
          expected_version: lease.version,
        },
        csrfToken,
        signal,
      );
      requirePrivateNoStore(response);
      return parseHeartbeat(await readSuccessData(response), now());
    },

    async recordAttendance(
      csrfToken: string,
      eventKind: 'joined' | 'left',
      signal?: AbortSignal,
    ): Promise<{ disposition: 'accepted' }> {
      const response = await post(
        fetcher,
        '/attendance/client',
        {
          event_kind: eventKind,
          idempotency_key: nextIdempotencyKey(),
        },
        csrfToken,
        signal,
      );
      requirePrivateNoStore(response);
      const data = await readSuccessData(response);
      if (!isRecord(data) || data.disposition !== 'accepted') throw invalidResponse();
      return { disposition: 'accepted' };
    },
  };
}

export type StudentClassroomApi = ReturnType<typeof createStudentClassroomApi>;

async function post(
  fetcher: ClassroomFetch,
  path: '/bootstrap' | '/heartbeat' | '/attendance/client',
  body: Record<string, unknown>,
  csrfToken: string,
  signal?: AbortSignal,
): Promise<Response> {
  if (csrfToken.trim() === '') throw new StudentClassroomApiError(403, 'csrf_required');
  return fetcher(`${CLASSROOM_API_BASE}${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
}

async function readSuccessData(response: Response): Promise<unknown> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw invalidResponse(response.status);
  }
  if (!response.ok || !isRecord(payload) || payload.success !== true || !('data' in payload)) {
    const code = isRecord(payload) && typeof payload.code === 'string' ? payload.code : null;
    throw new StudentClassroomApiError(response.status, denialCode(code));
  }
  return payload.data;
}

function parseBootstrap(value: unknown, now: Date): StudentClassroomBootstrap {
  if (!isRecord(value) || value.safe_code !== 'join_allowed') throw invalidResponse();
  if (!isRecord(value.bootstrap) || !isRecord(value.session)) throw invalidResponse();
  assertNoRawUrl(value);

  const bootstrap = value.bootstrap;
  const requiredStrings = [
    bootstrap.sdk_session_ref,
    bootstrap.sdk_web_version,
    bootstrap.sdk_signature,
    bootstrap.meeting_number,
    bootstrap.meeting_password,
    bootstrap.registrant_token,
    bootstrap.participant_email,
    bootstrap.customer_key,
    bootstrap.participant_display_name,
    bootstrap.issued_at,
    bootstrap.expires_at,
  ];
  if (requiredStrings.some((entry) => typeof entry !== 'string' || entry.trim() === '')) {
    throw invalidResponse();
  }
  if (
    !/^\d+\.\d+\.\d+$/u.test(String(bootstrap.sdk_web_version)) ||
    !/^\d{9,32}$/u.test(String(bootstrap.meeting_number)) ||
    bootstrap.role !== 0 ||
    bootstrap.leave_path !== '/app/classroom'
  ) {
    throw invalidResponse();
  }
  const issuedAt = timestamp(bootstrap.issued_at);
  const expiresAt = timestamp(bootstrap.expires_at);
  const nowMs = validDate(now).getTime();
  if (
    issuedAt > nowMs ||
    expiresAt <= nowMs ||
    expiresAt <= issuedAt ||
    expiresAt - issuedAt > MAX_BOOTSTRAP_LIFETIME_MS
  ) {
    throw invalidResponse();
  }

  const lease = parseLease(value.session, nowMs);
  const recordingCaptureActive = requiredBoolean(value.recording_capture_active);
  if (requiredBoolean(bootstrap.recording_capture_active) !== recordingCaptureActive) {
    throw invalidResponse();
  }
  return {
    bootstrap: bootstrap as unknown as EphemeralMeetingSdkBootstrap,
    lease,
    recording_capture_active: recordingCaptureActive,
  };
}

function parseHeartbeat(value: unknown, now: Date): StudentClassroomHeartbeat {
  if (!isRecord(value) || value.persisted !== true) throw invalidResponse();
  const nowMs = validDate(now).getTime();
  const lease = parseLease(value, nowMs);
  const nextHeartbeatAt = requiredTimestamp(value.next_heartbeat_at);
  return {
    persisted: true,
    ...lease,
    next_heartbeat_at: nextHeartbeatAt,
  };
}

function parseLease(value: Record<string, unknown>, nowMs: number): StudentClassroomLease {
  const leaseGeneration = positiveInteger(value.lease_generation);
  const version = positiveInteger(value.version);
  const leaseExpiresAt = requiredTimestamp(value.lease_expires_at);
  const leaseExpiry = timestamp(leaseExpiresAt);
  if (leaseExpiry <= nowMs || leaseExpiry - nowMs > MAX_LEASE_LIFETIME_MS) {
    throw invalidResponse();
  }
  return {
    lease_generation: leaseGeneration,
    version,
    lease_expires_at: leaseExpiresAt,
  };
}

function requirePrivateNoStore(response: Response): void {
  const cacheControl = response.headers.get('cache-control') ?? '';
  const referrerPolicy = response.headers.get('referrer-policy') ?? '';
  if (!/(?:^|,)\s*(?:private\s*,\s*)?no-store(?:\s*,|$)/iu.test(cacheControl)) {
    throw invalidResponse(response.status);
  }
  if (referrerPolicy.trim().toLowerCase() !== 'no-referrer') {
    throw invalidResponse(response.status);
  }
}

function assertNoRawUrl(value: unknown): void {
  if (typeof value === 'string') {
    if (/https?:\/\//iu.test(value)) throw invalidResponse();
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(assertNoRawUrl);
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (/(?:^|_)(?:raw_)?(?:join_)?url$/iu.test(key)) throw invalidResponse();
    assertNoRawUrl(entry);
  }
}

function secureOpaqueValue(prefix: string): string {
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new Error('Secure browser randomness is required for the classroom.');
  }
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  const encoded = Array.from(bytes, (entry) => entry.toString(16).padStart(2, '0')).join('');
  if (/^0+$/u.test(encoded))
    throw new Error('Secure browser randomness is required for the classroom.');
  return `${prefix}-${encoded}`;
}

function denialCode(value: string | null): EmbeddedJoinDenialCode | null {
  return value !== null && DENIAL_CODES.has(value as EmbeddedJoinDenialCode)
    ? (value as EmbeddedJoinDenialCode)
    : null;
}

const DENIAL_CODES = new Set<EmbeddedJoinDenialCode>([
  'csrf_required',
  'student_inactive',
  'enrollment_inactive',
  'access_inactive',
  'service_consent_required',
  'recording_consent_required',
  'registration_unavailable',
  'join_not_open',
  'occurrence_closed',
  'launch_revoked',
  'second_device_active',
  'grant_invalid',
  'grant_expired',
  'grant_consumed',
  'authorization_changed',
  'bootstrap_unavailable',
]);

function positiveInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw invalidResponse();
  }
  return value;
}

function requiredBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw invalidResponse();
  return value;
}

function requiredTimestamp(value: unknown): string {
  if (typeof value !== 'string') throw invalidResponse();
  timestamp(value);
  return value;
}

function timestamp(value: unknown): number {
  if (typeof value !== 'string') throw invalidResponse();
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) throw invalidResponse();
  return parsed;
}

function validDate(value: Date): Date {
  if (!Number.isFinite(value.getTime())) throw invalidResponse();
  return value;
}

function invalidResponse(status = 503): StudentClassroomApiError {
  return new StudentClassroomApiError(status, 'bootstrap_unavailable');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
