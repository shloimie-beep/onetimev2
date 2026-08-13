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

export const ZOOM_ISOLATED_CANARY_TOPIC_PREFIX = 'One Time isolated control verification ';
export const ZOOM_ISOLATED_CANARY_AGENDA =
  'Isolated fictional-student control verification. No customer invitations.';
export const ZOOM_DISPOSABLE_CANARY_ORIGINAL_EXECUTION_HEAD =
  '96e54d9688ff174ac8265ce3b3a6216abb6292dc';
export const ZOOM_DISPOSABLE_CANARY_RECONCILIATION_MAX_START_DELTA_SECONDS = 60;

export type ZoomRestClientOptions = {
  credentials: ZoomServerToServerCredentials;
  environment: ZoomRestEnvironment;
  enabled: boolean;
  apiBaseUrl?: string | undefined;
  oauthTokenUrl?: string | undefined;
  timeoutMs?: number | undefined;
  fetchImpl?: ZoomFetch | undefined;
};

export type ZoomHostZakClientOptions = ZoomRestClientOptions & {
  /** The reviewed account-owned host is fixed when this capability is constructed. */
  hostUserId: string;
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

export type ZoomScheduledClassMeetingPrivateMaterial = {
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

export type ZoomProtectedTargetScopeInspection = Readonly<{
  type_is_single_meeting: boolean;
  host_matches_expected: boolean;
  topic_matches_repository_canary: boolean;
  agenda_matches_repository_canary: boolean;
  registrant_confirmation_email_disabled: boolean;
  registrant_email_notification_disabled: boolean;
  join_before_host_disabled: boolean;
  safe_to_revoke: boolean;
}>;

export type ZoomProtectedTargetInspectionRequestObserver = Readonly<{
  onOauthTokenRequest?: (() => void) | undefined;
  onMeetingResourceGetRequest?: (() => void) | undefined;
}>;

export type ZoomDisposableCanaryRequestObserver = Readonly<{
  onOauthTokenRequest?: (() => void) | undefined;
  onResourceRequest?: ((method: string) => void) | undefined;
}>;

export type ZoomHostZakRequestObserver = ZoomDisposableCanaryRequestObserver;

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

const protectedTargetMeetingResponseSchema = z.object({
  type: z.number(),
  host_id: z.string().min(1),
  topic: z.string(),
  agenda: z.string(),
  settings: z
    .object({
      registrants_confirmation_email: z.boolean().optional(),
      registrants_email_notification: z.boolean().optional(),
      join_before_host: z.boolean().optional(),
    })
    .optional()
    .default({}),
});

const disposableCanaryMeetingResponseSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((value) => String(value)),
  type: z.number(),
  host_id: z.string().min(1),
  topic: z.string(),
  agenda: z.string(),
  start_time: z.string().min(1),
  duration: z.number(),
  settings: z
    .object({
      registrants_confirmation_email: z.boolean().optional(),
      registrants_email_notification: z.boolean().optional(),
      email_notification: z.boolean().optional(),
      join_before_host: z.boolean().optional(),
      alternative_hosts: z.string().optional(),
    })
    .optional()
    .default({}),
});

export function createZoomProtectedTargetInspectionClient(
  options: ZoomRestClientOptions,
  observer: ZoomProtectedTargetInspectionRequestObserver = {},
) {
  let meetingResourceGetStarted = false;
  const zoomJson = createZoomJsonRequester(options, {
    onOauthTokenRequest: observer.onOauthTokenRequest,
    onResourceRequest(method) {
      if (method !== 'GET') return;
      meetingResourceGetStarted = true;
      observer.onMeetingResourceGetRequest?.();
    },
  });

  return Object.freeze({
    async inspectMeetingScope(input: {
      meetingId: string;
      expectedHostUserId: string;
    }): Promise<ZoomProtectedTargetScopeInspection> {
      meetingResourceGetStarted = false;
      let json: unknown;
      try {
        json = await zoomJson(`/meetings/${encodeURIComponent(input.meetingId)}`, {
          method: 'GET',
        });
      } catch {
        throw new ZoomApiError(
          502,
          meetingResourceGetStarted
            ? 'ZOOM_PROTECTED_TARGET_GET_FAILED'
            : 'ZOOM_PROTECTED_TARGET_OAUTH_FAILED',
          meetingResourceGetStarted
            ? 'Zoom protected-target readback failed.'
            : 'Zoom protected-target authorization failed.',
        );
      }
      const parsed = protectedTargetMeetingResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new ZoomApiError(
          502,
          'ZOOM_PROTECTED_TARGET_READBACK_INVALID',
          'Zoom protected-target readback was incomplete.',
        );
      }

      const typeIsSingleMeeting = parsed.data.type === 2;
      const hostMatchesExpected = parsed.data.host_id === input.expectedHostUserId;
      const topicMatchesRepositoryCanary = matchesRepositoryCanaryTopic(parsed.data.topic);
      const agendaMatchesRepositoryCanary = parsed.data.agenda === ZOOM_ISOLATED_CANARY_AGENDA;
      const registrantConfirmationEmailDisabled =
        parsed.data.settings.registrants_confirmation_email === false;
      const registrantEmailNotificationDisabled =
        parsed.data.settings.registrants_email_notification === false;
      const joinBeforeHostDisabled = parsed.data.settings.join_before_host === false;

      return Object.freeze({
        type_is_single_meeting: typeIsSingleMeeting,
        host_matches_expected: hostMatchesExpected,
        topic_matches_repository_canary: topicMatchesRepositoryCanary,
        agenda_matches_repository_canary: agendaMatchesRepositoryCanary,
        registrant_confirmation_email_disabled: registrantConfirmationEmailDisabled,
        registrant_email_notification_disabled: registrantEmailNotificationDisabled,
        join_before_host_disabled: joinBeforeHostDisabled,
        safe_to_revoke:
          typeIsSingleMeeting &&
          hostMatchesExpected &&
          topicMatchesRepositoryCanary &&
          agendaMatchesRepositoryCanary &&
          registrantConfirmationEmailDisabled &&
          registrantEmailNotificationDisabled &&
          joinBeforeHostDisabled,
      });
    },
  });
}

export function createZoomDisposableCanaryLifecycleClient(
  options: ZoomRestClientOptions,
  observer: ZoomDisposableCanaryRequestObserver = {},
) {
  let meetingResourceGetStarted = false;
  const zoomJson = createZoomJsonRequester(options, {
    onOauthTokenRequest: observer.onOauthTokenRequest,
    onResourceRequest(method) {
      observer.onResourceRequest?.(method);
      if (method === 'GET') meetingResourceGetStarted = true;
    },
  });

  async function inspectExactMeeting(input: {
    meetingId: string;
    expectedHostUserId: string;
    expectedTopic: string;
    expectedStartsAt: string;
    expectedDurationMinutes: 60;
    reconciliationOriginalExecutionHead?: string | undefined;
  }) {
    meetingResourceGetStarted = false;
    let json: unknown;
    try {
      json = await zoomJson(`/meetings/${encodeURIComponent(input.meetingId)}`, {
        method: 'GET',
      });
    } catch (error) {
      if (
        error instanceof ZoomApiError &&
        error.status === 404 &&
        error.code === 'ZOOM_3001' &&
        meetingResourceGetStarted
      ) {
        return Object.freeze({
          exists: false as const,
          exact_scope: false,
          meeting_id_matches_expected: false,
          type_is_single_meeting: false,
          host_matches_expected: false,
          topic_matches_expected: false,
          agenda_matches_expected: false,
          starts_at_matches_expected: false,
          duration_matches_expected: false,
          notifications_disabled: false,
          registrant_notifications_explicitly_disabled: false,
          general_email_notification_safe: false,
          no_alternative_hosts: false,
          join_before_host_disabled: false,
          starts_at_delta_seconds: null,
          reconciliation_scope: false,
        });
      }
      throw error;
    }
    const parsed = disposableCanaryMeetingResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new ZoomApiError(
        502,
        'ZOOM_DISPOSABLE_CANARY_READBACK_INVALID',
        'Zoom disposable meeting readback was incomplete.',
      );
    }
    const meetingIdMatchesExpected = parsed.data.id === input.meetingId;
    const typeIsSingleMeeting = parsed.data.type === 2;
    const hostMatchesExpected = parsed.data.host_id === input.expectedHostUserId;
    const topicMatchesExpected = parsed.data.topic === input.expectedTopic;
    const agendaMatchesExpected = parsed.data.agenda === ZOOM_ISOLATED_CANARY_AGENDA;
    const parsedStartsAt = Date.parse(parsed.data.start_time);
    const expectedStartsAt = Date.parse(input.expectedStartsAt);
    const startsAtMatchesExpected =
      Number.isFinite(parsedStartsAt) &&
      Number.isFinite(expectedStartsAt) &&
      parsedStartsAt === expectedStartsAt;
    const startsAtDeltaSeconds =
      Number.isFinite(parsedStartsAt) && Number.isFinite(expectedStartsAt)
        ? Math.abs(parsedStartsAt - expectedStartsAt) / 1000
        : null;
    const durationMatchesExpected = parsed.data.duration === input.expectedDurationMinutes;
    const registrantNotificationsExplicitlyDisabled =
      parsed.data.settings.registrants_confirmation_email === false &&
      parsed.data.settings.registrants_email_notification === false;
    const noAlternativeHosts =
      parsed.data.settings.alternative_hosts === undefined ||
      parsed.data.settings.alternative_hosts.trim() === '';
    const generalEmailNotificationSafe =
      parsed.data.settings.email_notification === false ||
      (parsed.data.settings.email_notification === undefined &&
        noAlternativeHosts &&
        input.reconciliationOriginalExecutionHead ===
          ZOOM_DISPOSABLE_CANARY_ORIGINAL_EXECUTION_HEAD);
    const notificationsDisabled =
      registrantNotificationsExplicitlyDisabled &&
      parsed.data.settings.email_notification === false;
    const joinBeforeHostDisabled = parsed.data.settings.join_before_host === false;
    const reconciliationScope =
      meetingIdMatchesExpected &&
      typeIsSingleMeeting &&
      hostMatchesExpected &&
      topicMatchesExpected &&
      agendaMatchesExpected &&
      startsAtDeltaSeconds !== null &&
      startsAtDeltaSeconds <= ZOOM_DISPOSABLE_CANARY_RECONCILIATION_MAX_START_DELTA_SECONDS &&
      durationMatchesExpected &&
      registrantNotificationsExplicitlyDisabled &&
      generalEmailNotificationSafe &&
      noAlternativeHosts &&
      joinBeforeHostDisabled;
    return Object.freeze({
      exists: true as const,
      exact_scope:
        meetingIdMatchesExpected &&
        typeIsSingleMeeting &&
        hostMatchesExpected &&
        topicMatchesExpected &&
        agendaMatchesExpected &&
        startsAtMatchesExpected &&
        durationMatchesExpected &&
        notificationsDisabled &&
        joinBeforeHostDisabled,
      meeting_id_matches_expected: meetingIdMatchesExpected,
      type_is_single_meeting: typeIsSingleMeeting,
      host_matches_expected: hostMatchesExpected,
      topic_matches_expected: topicMatchesExpected,
      agenda_matches_expected: agendaMatchesExpected,
      starts_at_matches_expected: startsAtMatchesExpected,
      duration_matches_expected: durationMatchesExpected,
      notifications_disabled: notificationsDisabled,
      registrant_notifications_explicitly_disabled: registrantNotificationsExplicitlyDisabled,
      general_email_notification_safe: generalEmailNotificationSafe,
      no_alternative_hosts: noAlternativeHosts,
      join_before_host_disabled: joinBeforeHostDisabled,
      starts_at_delta_seconds: startsAtDeltaSeconds,
      reconciliation_scope: reconciliationScope,
    });
  }

  return Object.freeze({
    inspectExactMeeting,
    async deleteExactMeeting(input: {
      meetingId: string;
      expectedHostUserId: string;
      expectedTopic: string;
      expectedStartsAt: string;
      expectedDurationMinutes: 60;
      beforeDelete: () => Promise<void>;
    }) {
      const inspection = await inspectExactMeeting(input);
      if (!inspection.exists) {
        return Object.freeze({
          already_absent: true,
          delete_executed: false,
          absent_verified: true,
        });
      }
      if (!inspection.exact_scope) {
        throw new ZoomApiError(
          409,
          'ZOOM_DISPOSABLE_CANARY_SCOPE_MISMATCH',
          'Zoom disposable meeting scope did not match the protected state.',
        );
      }
      await input.beforeDelete();
      await zoomJson(`/meetings/${encodeURIComponent(input.meetingId)}`, {
        method: 'DELETE',
      });
      const readback = await inspectExactMeeting(input);
      if (readback.exists) {
        throw new ZoomApiError(
          502,
          'ZOOM_DISPOSABLE_CANARY_DELETE_UNVERIFIED',
          'Zoom disposable meeting deletion could not be verified.',
          true,
        );
      }
      return Object.freeze({ already_absent: false, delete_executed: true, absent_verified: true });
    },
    async reconcileDeleteExactMeeting(input: {
      meetingId: string;
      expectedHostUserId: string;
      expectedTopic: string;
      expectedStartsAt: string;
      expectedDurationMinutes: 60;
      originalExecutionHead: string;
      beforeDelete: () => Promise<void>;
    }) {
      if (input.originalExecutionHead !== ZOOM_DISPOSABLE_CANARY_ORIGINAL_EXECUTION_HEAD) {
        throw new ZoomApiError(
          409,
          'ZOOM_DISPOSABLE_CANARY_RECONCILIATION_SOURCE_MISMATCH',
          'Zoom disposable reconciliation source did not match the reviewed create request.',
        );
      }
      const inspection = await inspectExactMeeting({
        ...input,
        reconciliationOriginalExecutionHead: input.originalExecutionHead,
      });
      if (!inspection.exists) {
        throw new ZoomApiError(
          409,
          'ZOOM_DISPOSABLE_CANARY_RECONCILIATION_UNEXPECTED_ABSENCE',
          'Zoom disposable reconciliation found no meeting before its authorized delete.',
        );
      }
      if (!inspection.reconciliation_scope) {
        throw new ZoomApiError(
          409,
          'ZOOM_DISPOSABLE_CANARY_RECONCILIATION_SCOPE_MISMATCH',
          'Zoom disposable meeting did not match the reviewed reconciliation scope.',
        );
      }
      await input.beforeDelete();
      await zoomJson(`/meetings/${encodeURIComponent(input.meetingId)}`, {
        method: 'DELETE',
      });
      const readback = await inspectExactMeeting({
        ...input,
        reconciliationOriginalExecutionHead: input.originalExecutionHead,
      });
      if (readback.exists) {
        throw new ZoomApiError(
          502,
          'ZOOM_DISPOSABLE_CANARY_DELETE_UNVERIFIED',
          'Zoom disposable meeting deletion could not be verified.',
          true,
        );
      }
      return Object.freeze({ delete_executed: true, absent_verified: true });
    },
    async verifyCanonicalAbsence(input: {
      meetingId: string;
      expectedHostUserId: string;
      expectedTopic: string;
      expectedStartsAt: string;
      expectedDurationMinutes: 60;
    }) {
      const inspection = await inspectExactMeeting(input);
      if (inspection.exists) {
        throw new ZoomApiError(
          409,
          'ZOOM_DISPOSABLE_CANARY_DELETE_OUTCOME_AMBIGUOUS',
          'Zoom disposable meeting still exists after an interrupted delete attempt.',
        );
      }
      return Object.freeze({ absent_verified: true });
    },
  });
}

/**
 * The production classroom may obtain only the bound host's ephemeral ZAK.
 * This client deliberately exposes no meeting read, create, update, delete, or
 * registrant operation, and its production authorization is exact-path GET only.
 */
export function createZoomHostZakClient(
  options: ZoomHostZakClientOptions,
  observer: ZoomHostZakRequestObserver = {},
) {
  const resourcePath = `/users/${encodeURIComponent(options.hostUserId)}/token?type=zak`;
  let resourceRequestStarted = false;
  const zoomJson = createZoomJsonRequester(
    options,
    {
      onOauthTokenRequest: observer.onOauthTokenRequest,
      onResourceRequest(method) {
        resourceRequestStarted = true;
        observer.onResourceRequest?.(method);
      },
    },
    {
      operation: 'host_zak',
      method: 'GET',
      path: resourcePath,
    },
  );

  return Object.freeze({
    async getHostZakToken() {
      resourceRequestStarted = false;
      let json: unknown;
      try {
        json = await zoomJson(resourcePath, { method: 'GET' });
      } catch (error) {
        if (
          error instanceof ZoomApiError &&
          (error.code === 'ZOOM_PROVIDER_DISABLED' || error.code === 'ZOOM_PRODUCTION_BLOCKED')
        ) {
          throw error;
        }
        if (!(error instanceof ZoomApiError)) {
          throw new ZoomApiError(
            502,
            'ZOOM_HOST_ZAK_REQUEST_FAILED',
            'Zoom host authorization could not be issued.',
          );
        }
        throw classifiedHostZakError(error, resourceRequestStarted);
      }
      const parsed = zakResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new ZoomApiError(
          502,
          'ZOOM_HOST_ZAK_READBACK_INVALID',
          'Zoom host authorization readback was incomplete.',
        );
      }
      return parsed.data.token;
    },
  });
}

export function createZoomRestClient(
  options: ZoomRestClientOptions,
  observer: ZoomDisposableCanaryRequestObserver = {},
) {
  const zoomJson = createZoomJsonRequester(options, observer);

  return {
    async createScheduledClassMeeting(input: {
      hostUserId: string;
      startsAt: Date;
      topic: string;
      durationMinutes: number;
    }): Promise<ZoomScheduledClassMeetingPrivateMaterial> {
      const json = await zoomJson(`/users/${encodeURIComponent(input.hostUserId)}/meetings`, {
        method: 'POST',
        body: JSON.stringify({
          topic: input.topic,
          type: 2,
          start_time: input.startsAt.toISOString(),
          timezone: 'Asia/Jerusalem',
          duration: input.durationMinutes,
          agenda: 'One Time Mishnayos protected classroom',
          settings: {
            approval_type: 0,
            email_notification: false,
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
          agenda: ZOOM_ISOLATED_CANARY_AGENDA,
          settings: {
            approval_type: 0,
            email_notification: false,
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

    async deleteMeeting(meetingId: string) {
      try {
        await zoomJson(`/meetings/${encodeURIComponent(meetingId)}`, {
          method: 'DELETE',
        });
        return Object.freeze({ already_absent: false });
      } catch (error) {
        if (error instanceof ZoomApiError && error.status === 404 && error.code === 'ZOOM_3001') {
          return Object.freeze({ already_absent: true });
        }
        throw error;
      }
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
  const issuedAtSeconds = Math.floor((input.issuedAt ?? new Date()).getTime() / 1000) - 30;
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
      // Use Zoom's non-WebRTC video path for the protected browser launch.
      video_webrtc_mode: 0,
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

export function zoomIsolatedCanaryTopic(startsAt: Date) {
  return `${ZOOM_ISOLATED_CANARY_TOPIC_PREFIX}${startsAt.toISOString().slice(0, 16)}Z`;
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

type ZoomJsonRequestObserver = Readonly<{
  onOauthTokenRequest?: (() => void) | undefined;
  onResourceRequest?: ((method: string) => void) | undefined;
}>;

type ZoomProductionRequestAuthorization = Readonly<{
  operation: 'host_zak';
  method: 'GET';
  path: string;
}>;

function createZoomJsonRequester(
  options: ZoomRestClientOptions,
  observer: ZoomJsonRequestObserver = {},
  productionAuthorization?: ZoomProductionRequestAuthorization | undefined,
) {
  const apiBaseUrl = trimTrailingSlash(options.apiBaseUrl ?? 'https://api.zoom.us/v2');
  const oauthTokenUrl = options.oauthTokenUrl ?? 'https://zoom.us/oauth/token';
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8_000;
  let cachedToken: { value: string; expiresAt: number } | null = null;

  async function accessToken() {
    assertEnabled(options, productionAuthorization);
    const now = Date.now();
    if (cachedToken && cachedToken.expiresAt - 60_000 > now) return cachedToken.value;
    const url = new URL(oauthTokenUrl);
    url.searchParams.set('grant_type', 'account_credentials');
    url.searchParams.set('account_id', options.credentials.accountId);
    const authorization = Buffer.from(
      `${options.credentials.clientId}:${options.credentials.clientSecret}`,
    ).toString('base64');
    observer.onOauthTokenRequest?.();
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
    const parsed = tokenResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new ZoomApiError(
        502,
        'ZOOM_OAUTH_READBACK_INVALID',
        'Zoom authorization readback was incomplete.',
      );
    }
    cachedToken = {
      value: parsed.data.access_token,
      expiresAt: now + Math.max(60, parsed.data.expires_in ?? 3600) * 1000,
    };
    return cachedToken.value;
  }

  return async function zoomJson(path: string, init: RequestInit = {}) {
    const method = init.method?.toUpperCase() ?? 'GET';
    assertProductionRequestAuthorized(options, productionAuthorization, method, path);
    const token = await accessToken();
    observer.onResourceRequest?.(method);
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
  };
}

function matchesRepositoryCanaryTopic(value: string) {
  if (!value.startsWith(ZOOM_ISOLATED_CANARY_TOPIC_PREFIX)) return false;
  const utcMinute = value.slice(ZOOM_ISOLATED_CANARY_TOPIC_PREFIX.length);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/.test(utcMinute)) return false;
  const parsed = new Date(utcMinute);
  return Number.isFinite(parsed.getTime()) && zoomIsolatedCanaryTopic(parsed) === value;
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

function assertEnabled(
  options: ZoomRestClientOptions,
  productionAuthorization?: ZoomProductionRequestAuthorization | undefined,
) {
  if (!options.enabled) {
    throw new ZoomApiError(503, 'ZOOM_PROVIDER_DISABLED', 'Zoom provider is disabled.');
  }
  if (options.environment === 'production' && !productionAuthorization) {
    throw new ZoomApiError(
      503,
      'ZOOM_PRODUCTION_BLOCKED',
      'Zoom production provider calls are not enabled by OT-103.',
    );
  }
}

function assertProductionRequestAuthorized(
  options: ZoomRestClientOptions,
  authorization: ZoomProductionRequestAuthorization | undefined,
  method: string,
  path: string,
) {
  assertEnabled(options, authorization);
  if (
    options.environment === 'production' &&
    (!authorization ||
      authorization.operation !== 'host_zak' ||
      authorization.method !== method ||
      authorization.path !== path)
  ) {
    throw new ZoomApiError(
      503,
      'ZOOM_PRODUCTION_BLOCKED',
      'Zoom production provider calls are not enabled by OT-103.',
    );
  }
}

function classifiedHostZakError(error: ZoomApiError, resourceRequestStarted: boolean) {
  const code = !resourceRequestStarted
    ? 'ZOOM_HOST_ZAK_OAUTH_FAILED'
    : error.status === 401 || error.status === 403
      ? 'ZOOM_HOST_ZAK_NOT_AUTHORIZED'
      : error.status === 404
        ? 'ZOOM_HOST_ZAK_HOST_NOT_FOUND'
        : error.status === 429
          ? 'ZOOM_HOST_ZAK_RATE_LIMITED'
          : error.status === 0 || error.status >= 500
            ? 'ZOOM_HOST_ZAK_PROVIDER_UNAVAILABLE'
            : 'ZOOM_HOST_ZAK_REQUEST_FAILED';
  return new ZoomApiError(
    error.status,
    code,
    'Zoom host authorization could not be issued.',
    error.retryable || error.status === 429,
  );
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
