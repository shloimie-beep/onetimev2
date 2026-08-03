import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { AppConfig } from '../../../config/src/index.ts';
import type {
  LiveClassZoomAdminStatus,
  LiveClassZoomAdminStatusResponse,
} from '../../../contracts/src/live-class/index.ts';
import type { PortalActorContext } from '../../../contracts/src/portals/index.ts';
import {
  createZoomRestClient,
  type ZoomIsolatedMeetingPrivateMaterial,
  type ZoomRegistrantRecord,
  ZoomApiError,
} from '../providers/zoom-rest.ts';
import { stableKey } from '../lead/normalize.ts';
import { PortalServiceError } from '../portals/services.ts';
import { inspectZoomHostControlReadiness } from './zoom-host.ts';

export const ZOOM_ADMIN_TEST_TOPIC_PREFIX = 'One Time app-owned test meeting ';
export const ZOOM_ADMIN_TEST_LEARNER_KEY = 'one_time_operator_test_learner';
export const ZOOM_ADMIN_TEST_LEARNER_NAME = 'One Time Operator Test Learner';

export type ZoomAdminConnectionState = 'not_checked' | 'connected' | 'unavailable';
export type ZoomAdminResourceState =
  | 'none'
  | 'creating'
  | 'active'
  | 'create_failed'
  | 'create_unknown'
  | 'deleting'
  | 'deleted'
  | 'delete_unknown';
export type ZoomAdminRegistrantState =
  'none' | 'registering' | 'registered' | 'registration_failed' | 'registration_unknown';

export type ZoomAdminTestResourceRecord = {
  resource_key: string;
  account_key: string;
  product_key: string;
  connection_state: ZoomAdminConnectionState;
  connection_checked_at: Date | null;
  resource_state: ZoomAdminResourceState;
  provider_meeting_ref_digest: string | null;
  provider_meeting_ciphertext: string | null;
  meeting_topic: string | null;
  meeting_starts_at: Date | null;
  meeting_duration_minutes: number | null;
  created_by_user_ref: string | null;
  create_idempotency_key: string | null;
  registrant_state: ZoomAdminRegistrantState;
  provider_registrant_ref_digest: string | null;
  register_idempotency_key: string | null;
  delete_idempotency_key: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  created_at: Date;
  updated_at: Date;
};

type ResourceScope = Pick<PortalActorContext, 'account_key' | 'product_key'>;

export type ZoomAdminTestResourceRepository = {
  get(scope: ResourceScope): Promise<ZoomAdminTestResourceRecord | null>;
  recordConnection(
    scope: ResourceScope & {
      resource_key: string;
      state: Exclude<ZoomAdminConnectionState, 'not_checked'>;
      checked_at: Date;
      error_code?: string | null;
      error_message?: string | null;
    },
  ): Promise<ZoomAdminTestResourceRecord>;
  claimCreate(
    scope: ResourceScope & {
      resource_key: string;
      actor_user_ref: string;
      idempotency_key: string;
    },
  ): Promise<{ record: ZoomAdminTestResourceRecord; execute: boolean }>;
  completeCreate(
    scope: ResourceScope & {
      idempotency_key: string;
      provider_meeting_ref_digest: string;
      provider_meeting_ciphertext: string;
      meeting_topic: string;
      meeting_starts_at: Date;
      meeting_duration_minutes: number;
    },
  ): Promise<ZoomAdminTestResourceRecord>;
  failCreate(
    scope: ResourceScope & {
      idempotency_key: string;
      outcome_unknown: boolean;
      error_code: string;
      error_message: string;
    },
  ): Promise<ZoomAdminTestResourceRecord>;
  claimRegistration(
    scope: ResourceScope & { idempotency_key: string },
  ): Promise<{ record: ZoomAdminTestResourceRecord; execute: boolean }>;
  completeRegistration(
    scope: ResourceScope & {
      idempotency_key: string;
      provider_registrant_ref_digest: string;
    },
  ): Promise<ZoomAdminTestResourceRecord>;
  failRegistration(
    scope: ResourceScope & {
      idempotency_key: string;
      outcome_unknown: boolean;
      error_code: string;
      error_message: string;
    },
  ): Promise<ZoomAdminTestResourceRecord>;
  claimDelete(
    scope: ResourceScope & { idempotency_key: string },
  ): Promise<{ record: ZoomAdminTestResourceRecord; execute: boolean }>;
  completeDelete(
    scope: ResourceScope & { idempotency_key: string },
  ): Promise<ZoomAdminTestResourceRecord>;
  failDelete(
    scope: ResourceScope & {
      idempotency_key: string;
      outcome_unknown: boolean;
      error_code: string;
      error_message: string;
    },
  ): Promise<ZoomAdminTestResourceRecord>;
};

export type ZoomAdminProviderPort = {
  checkConnection(): Promise<void>;
  createTestMeeting(input: {
    startsAt: Date;
    topic: string;
    durationMinutes: number;
  }): Promise<ZoomIsolatedMeetingPrivateMaterial>;
  registerTestLearner(input: {
    meetingId: string;
    learnerKey: string;
    displayName: string;
    email: string;
  }): Promise<ZoomRegistrantRecord>;
  deleteTestMeeting(meetingId: string): Promise<{ already_absent: boolean }>;
};

export type ZoomAdminServiceDeps = {
  config: AppConfig;
  repository: ZoomAdminTestResourceRepository;
  provider?: ZoomAdminProviderPort;
  clock?: () => Date;
};

export type ZoomAdminService = ReturnType<typeof createZoomAdminService>;

export function createZoomAdminProvider(config: AppConfig): ZoomAdminProviderPort | undefined {
  if (
    config.oneTimeRuntimeEnvironment !== 'isolated_staging' ||
    !config.zoomAccountId ||
    !config.zoomServerToServerClientId ||
    !config.zoomServerToServerClientSecret ||
    !config.zoomHostUserId
  ) {
    return undefined;
  }
  const hostUserId = config.zoomHostUserId;
  const client = createZoomRestClient({
    credentials: {
      accountId: config.zoomAccountId,
      clientId: config.zoomServerToServerClientId,
      clientSecret: config.zoomServerToServerClientSecret,
    },
    environment: 'staging',
    enabled: true,
  });
  return {
    async checkConnection() {
      await client.getHostZakToken(hostUserId);
    },
    createTestMeeting(input) {
      return client.createIsolatedTestMeeting({ hostUserId, ...input });
    },
    registerTestLearner(input) {
      return client.addLearnerRegistrant(input);
    },
    deleteTestMeeting(meetingId) {
      return client.deleteMeeting(meetingId);
    },
  };
}

export function createZoomAdminService(deps: ZoomAdminServiceDeps) {
  const clock = deps.clock ?? (() => new Date());

  return {
    async status(actor: PortalActorContext): Promise<LiveClassZoomAdminStatusResponse['data']> {
      requireAdmin(actor);
      return statusFor(deps, await deps.repository.get(actor));
    },

    async checkConnection(
      actor: PortalActorContext,
    ): Promise<LiveClassZoomAdminStatusResponse['data']> {
      requireAdmin(actor);
      const provider = requireProvider(deps);
      const now = clock();
      try {
        await provider.checkConnection();
        const record = await deps.repository.recordConnection({
          ...actor,
          resource_key: resourceKey(actor),
          state: 'connected',
          checked_at: now,
          error_code: null,
          error_message: null,
        });
        return statusFor(deps, record, 'Zoom connection is ready.');
      } catch (error) {
        const safe = safeProviderError(error, 'Zoom connection could not be checked.');
        await deps.repository.recordConnection({
          ...actor,
          resource_key: resourceKey(actor),
          state: 'unavailable',
          checked_at: now,
          error_code: safe.code,
          error_message: safe.message,
        });
        throw new PortalServiceError(safe.portalCode, safe.message);
      }
    },

    async createTestMeeting(
      actor: PortalActorContext,
      idempotencyKey: string,
    ): Promise<LiveClassZoomAdminStatusResponse['data']> {
      requireAdmin(actor);
      const provider = requireProvider(deps);
      const claimed = await deps.repository.claimCreate({
        ...actor,
        resource_key: resourceKey(actor),
        actor_user_ref: actor.actor_user_ref,
        idempotency_key: idempotencyKey,
      });
      if (!claimed.execute) {
        return statusFor(deps, claimed.record, messageForRecord(claimed.record));
      }

      const startsAt = new Date(clock().getTime() + 5 * 60_000);
      const durationMinutes = 30;
      const topic = `${ZOOM_ADMIN_TEST_TOPIC_PREFIX}${startsAt.toISOString().slice(0, 16)}Z`;
      try {
        const created = await provider.createTestMeeting({
          startsAt,
          topic,
          durationMinutes,
        });
        const record = await deps.repository.completeCreate({
          ...actor,
          idempotency_key: idempotencyKey,
          provider_meeting_ref_digest: created.meeting.provider_meeting_ref_digest,
          provider_meeting_ciphertext: encryptMeetingId(
            deps.config,
            actor,
            resourceKey(actor),
            created.meeting.meeting_id,
          ),
          meeting_topic: topic,
          meeting_starts_at: startsAt,
          meeting_duration_minutes: durationMinutes,
        });
        return statusFor(deps, record, 'Disposable Zoom test meeting created.');
      } catch (error) {
        const safe = safeProviderError(error, 'Zoom test meeting could not be created.');
        await deps.repository.failCreate({
          ...actor,
          idempotency_key: idempotencyKey,
          outcome_unknown: safe.outcomeUnknown,
          error_code: safe.code,
          error_message: safe.message,
        });
        throw new PortalServiceError(safe.portalCode, safe.message);
      }
    },

    async registerTestLearner(
      actor: PortalActorContext,
      idempotencyKey: string,
    ): Promise<LiveClassZoomAdminStatusResponse['data']> {
      requireAdmin(actor);
      const provider = requireProvider(deps);
      const existing = await deps.repository.get(actor);
      if (
        !existing ||
        existing.resource_state !== 'active' ||
        !existing.provider_meeting_ciphertext ||
        !existing.provider_meeting_ref_digest
      ) {
        throw new PortalServiceError(
          'FORBIDDEN',
          'No app-created Zoom test meeting is recorded for this action.',
        );
      }
      const email = z.string().trim().email().safeParse(deps.config.ownerTestEmail);
      if (!email.success) {
        throw new PortalServiceError(
          'PROVIDER_NOT_READY',
          'The protected operator test email is not configured.',
        );
      }
      const claimed = await deps.repository.claimRegistration({
        ...actor,
        idempotency_key: idempotencyKey,
      });
      if (!claimed.execute) {
        return statusFor(deps, claimed.record, messageForRecord(claimed.record));
      }
      const meetingId = decryptRecordedMeetingId(deps.config, actor, claimed.record);
      try {
        const registered = await provider.registerTestLearner({
          meetingId,
          learnerKey: ZOOM_ADMIN_TEST_LEARNER_KEY,
          displayName: ZOOM_ADMIN_TEST_LEARNER_NAME,
          email: email.data,
        });
        const record = await deps.repository.completeRegistration({
          ...actor,
          idempotency_key: idempotencyKey,
          provider_registrant_ref_digest: registered.registrant_id_digest,
        });
        return statusFor(deps, record, 'Operator-owned Zoom test learner registered.');
      } catch (error) {
        const safe = safeProviderError(error, 'Zoom test learner could not be registered.');
        await deps.repository.failRegistration({
          ...actor,
          idempotency_key: idempotencyKey,
          outcome_unknown: safe.outcomeUnknown,
          error_code: safe.code,
          error_message: safe.message,
        });
        throw new PortalServiceError(safe.portalCode, safe.message);
      }
    },

    async deleteTestMeeting(
      actor: PortalActorContext,
      idempotencyKey: string,
    ): Promise<LiveClassZoomAdminStatusResponse['data']> {
      requireAdmin(actor);
      const provider = requireProvider(deps);
      const existing = await deps.repository.get(actor);
      if (
        !existing ||
        !['active', 'delete_unknown'].includes(existing.resource_state) ||
        !existing.provider_meeting_ciphertext ||
        !existing.provider_meeting_ref_digest
      ) {
        if (existing?.resource_state === 'deleted') {
          return statusFor(deps, existing, 'The app-created Zoom test meeting is already deleted.');
        }
        throw new PortalServiceError(
          'FORBIDDEN',
          'No app-created Zoom test meeting is recorded for deletion.',
        );
      }
      const claimed = await deps.repository.claimDelete({
        ...actor,
        idempotency_key: idempotencyKey,
      });
      if (!claimed.execute) {
        return statusFor(deps, claimed.record, messageForRecord(claimed.record));
      }
      const meetingId = decryptRecordedMeetingId(deps.config, actor, claimed.record);
      try {
        const deleted = await provider.deleteTestMeeting(meetingId);
        const record = await deps.repository.completeDelete({
          ...actor,
          idempotency_key: idempotencyKey,
        });
        return statusFor(
          deps,
          record,
          deleted.already_absent
            ? 'The app-created Zoom test meeting was already absent.'
            : 'The app-created Zoom test meeting was deleted.',
        );
      } catch (error) {
        const safe = safeProviderError(error, 'Zoom test meeting could not be deleted.');
        await deps.repository.failDelete({
          ...actor,
          idempotency_key: idempotencyKey,
          outcome_unknown: safe.outcomeUnknown,
          error_code: safe.code,
          error_message: safe.message,
        });
        throw new PortalServiceError(safe.portalCode, safe.message);
      }
    },
  };
}

function statusFor(
  deps: ZoomAdminServiceDeps,
  record: ZoomAdminTestResourceRecord | null,
  overrideMessage?: string,
): LiveClassZoomAdminStatus {
  const resourceState = publicResourceState(record?.resource_state ?? 'none');
  const registrantState = publicRegistrantState(record?.registrant_state ?? 'none');
  const providerConfigured = deps.provider !== undefined;
  const active = record?.resource_state === 'active';
  const hasRecordedMeeting =
    active &&
    Boolean(record.provider_meeting_ref_digest) &&
    Boolean(record.provider_meeting_ciphertext);
  const secureClassroomReady = inspectZoomHostControlReadiness(deps.config).ready;
  return {
    connection_state: record?.connection_state ?? 'not_checked',
    connection_checked_at: record?.connection_checked_at?.toISOString() ?? null,
    provider_configured: providerConfigured,
    meeting_state: resourceState,
    app_created_meeting_recorded: hasRecordedMeeting,
    meeting_ref_digest_present: Boolean(record?.provider_meeting_ref_digest),
    learner_state: registrantState,
    secure_classroom_ready: secureClassroomReady,
    can_check_connection: providerConfigured,
    can_create_meeting: providerConfigured && ['none', 'deleted', 'failed'].includes(resourceState),
    can_register_learner:
      providerConfigured && hasRecordedMeeting && registrantState !== 'registered',
    can_delete_meeting: providerConfigured && hasRecordedMeeting,
    raw_join_url_present: false,
    recoverable:
      resourceState === 'failed' ||
      resourceState === 'delete_unknown' ||
      registrantState === 'failed' ||
      (resourceState === 'active' && Boolean(record?.last_error_message)),
    message: overrideMessage ?? messageForRecord(record),
    last_error: record?.last_error_message ?? null,
  };
}

function publicResourceState(
  state: ZoomAdminResourceState,
): LiveClassZoomAdminStatus['meeting_state'] {
  return state === 'create_failed' ? 'failed' : state;
}

function publicRegistrantState(
  state: ZoomAdminRegistrantState,
): LiveClassZoomAdminStatus['learner_state'] {
  return state === 'registration_failed' ? 'failed' : state;
}

function messageForRecord(record: ZoomAdminTestResourceRecord | null) {
  if (!record || record.resource_state === 'none') return 'No app-created Zoom test meeting yet.';
  if (record.resource_state === 'creating') return 'Zoom test meeting creation is in progress.';
  if (record.resource_state === 'active' && record.registrant_state === 'registered') {
    return 'The disposable meeting and operator-owned test learner are ready.';
  }
  if (record.resource_state === 'active') return 'The app-created disposable meeting is ready.';
  if (record.resource_state === 'create_unknown') {
    return 'Zoom meeting creation outcome is unknown. Do not create another meeting.';
  }
  if (record.resource_state === 'deleting') return 'Zoom test meeting deletion is in progress.';
  if (record.resource_state === 'deleted') return 'The app-created Zoom test meeting is deleted.';
  if (record.resource_state === 'delete_unknown') {
    return 'Zoom deletion outcome is unknown. Refresh or retry this same recorded resource.';
  }
  return record.last_error_message ?? 'The Zoom test action can be retried.';
}

function requireAdmin(actor: PortalActorContext) {
  if (actor.actor_role !== 'owner' && actor.actor_role !== 'admin') {
    throw new PortalServiceError('FORBIDDEN', 'Zoom setup requires owner or admin access.');
  }
}

function requireProvider(deps: ZoomAdminServiceDeps) {
  if (!deps.provider) {
    throw new PortalServiceError(
      'PROVIDER_NOT_READY',
      'Zoom test setup is available only when isolated-staging credentials are configured.',
    );
  }
  return deps.provider;
}

function resourceKey(scope: ResourceScope) {
  return stableKey('zoom_admin_test_resource', [scope.account_key, scope.product_key]);
}

function encryptionKey(config: AppConfig) {
  return createHash('sha256')
    .update(`${config.mfaSecretEncryptionKey}:zoom-admin-test-resource-v1`)
    .digest();
}

function encryptionAad(scope: ResourceScope, resourceKeyValue: string) {
  return Buffer.from(
    [scope.account_key, scope.product_key, resourceKeyValue, 'zoom-admin-test-resource-v1'].join(
      '\u001f',
    ),
    'utf8',
  );
}

function encryptMeetingId(
  config: AppConfig,
  scope: ResourceScope,
  resourceKeyValue: string,
  meetingId: string,
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(config), iv);
  cipher.setAAD(encryptionAad(scope, resourceKeyValue));
  const ciphertext = Buffer.concat([cipher.update(meetingId, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
}

function decryptRecordedMeetingId(
  config: AppConfig,
  scope: ResourceScope,
  record: ZoomAdminTestResourceRecord,
) {
  if (
    !record.provider_meeting_ciphertext ||
    !record.provider_meeting_ref_digest ||
    (record.resource_state !== 'deleting' && record.resource_state !== 'active')
  ) {
    throw new PortalServiceError(
      'FORBIDDEN',
      'No app-created Zoom test meeting is recorded for this action.',
    );
  }
  try {
    const packed = Buffer.from(record.provider_meeting_ciphertext, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(config), packed.subarray(0, 12));
    decipher.setAAD(encryptionAad(scope, record.resource_key));
    decipher.setAuthTag(packed.subarray(12, 28));
    return Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    throw new PortalServiceError(
      'FORBIDDEN',
      'The recorded Zoom test meeting ownership could not be verified.',
    );
  }
}

function safeProviderError(error: unknown, fallback: string) {
  if (error instanceof ZoomApiError) {
    return {
      code: error.code,
      message: error.message,
      outcomeUnknown: error.retryable,
      portalCode:
        error.status === 401 || error.status === 403
          ? ('PROVIDER_NOT_READY' as const)
          : ('ADAPTER_UNAVAILABLE' as const),
    };
  }
  return {
    code: 'ZOOM_REQUEST_FAILED',
    message: fallback,
    outcomeUnknown: true,
    portalCode: 'ADAPTER_UNAVAILABLE' as const,
  };
}
