import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { AppConfig } from '../../../config/src/index.ts';
import type { PortalActorContext } from '../../../contracts/src/portals/index.ts';
import type { ZoomMeetingLaunchPort, ZoomRegistrantPort } from '../providers/zoom.ts';
import {
  createHostZoomSdkSignature,
  createLearnerZoomSdkSignature,
  createZoomRestClient,
  type ZoomRegistrantRecord,
  type ZoomScheduledClassMeetingPrivateMaterial,
} from '../providers/zoom-rest.ts';
import { redactedRefHash } from '../providers/shared.ts';
import { stableKey } from '../lead/normalize.ts';
import { PortalServiceError } from '../portals/services.ts';
import { zoomCustomerKey } from '../live-class/zoom-identifiers.ts';
import type { ZoomHostLaunchPort } from '../live-class/service.ts';

export type ZoomClassOccurrencePurpose = 'normal_class' | 'synthetic_acceptance';
export type ZoomClassOccurrenceResourceState =
  | 'provisioning'
  | 'active'
  | 'provision_failed'
  | 'provision_unknown'
  | 'deleting'
  | 'deleted'
  | 'delete_unknown';

export type ZoomClassOccurrenceRecord = {
  occurrence_key: string;
  title: string;
  starts_at: Date;
  duration_minutes: number;
  is_operator_test: boolean;
  operator_test_environment: string | null;
};

export type ZoomClassEnrolledLearner = {
  household_key: string;
  learner_key: string;
  display_name: string;
};

export type ZoomClassOccurrenceResourceRecord = {
  resource_key: string;
  account_key: string;
  product_key: string;
  occurrence_key: string;
  environment: 'isolated_staging' | 'production';
  purpose: ZoomClassOccurrencePurpose;
  resource_state: ZoomClassOccurrenceResourceState;
  provider_meeting_ref_digest: string | null;
  provider_meeting_ciphertext: string | null;
  meeting_password_ciphertext: string | null;
  meeting_topic: string;
  meeting_starts_at: Date;
  meeting_duration_minutes: number;
  created_by_user_ref: string;
  provision_idempotency_key: string;
  delete_idempotency_key: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
};

export type ZoomClassRegistrantRecord = {
  household_key: string;
  learner_key: string;
  provider_registrant_ref_digest: string;
  registrant_token_ref: string;
  registrant_token_ciphertext: string | null;
  registration_state: 'registered' | 'cancelled' | 'denied' | 'unavailable';
};

type ResourceScope = Pick<PortalActorContext, 'account_key' | 'product_key'>;

export type ZoomClassOccurrenceRepository = {
  getOccurrence(
    scope: ResourceScope,
    occurrenceKey: string,
  ): Promise<ZoomClassOccurrenceRecord | null>;
  getResource(
    scope: ResourceScope,
    occurrenceKey: string,
  ): Promise<ZoomClassOccurrenceResourceRecord | null>;
  claimProvision(
    args: ResourceScope & {
      resource_key: string;
      occurrence: ZoomClassOccurrenceRecord;
      environment: 'isolated_staging' | 'production';
      purpose: ZoomClassOccurrencePurpose;
      actor_user_ref: string;
      idempotency_key: string;
    },
  ): Promise<{ record: ZoomClassOccurrenceResourceRecord; execute: boolean }>;
  completeProvision(
    args: ResourceScope & {
      occurrence_key: string;
      idempotency_key: string;
      provider_meeting_ref_digest: string;
      provider_meeting_ciphertext: string;
      meeting_password_ciphertext: string;
    },
  ): Promise<ZoomClassOccurrenceResourceRecord>;
  failProvision(
    args: ResourceScope & {
      occurrence_key: string;
      idempotency_key: string;
      outcome_unknown: boolean;
      error_code: string;
      error_message: string;
    },
  ): Promise<void>;
  listActiveEnrolledLearners(
    scope: ResourceScope,
    occurrenceKey: string,
  ): Promise<ZoomClassEnrolledLearner[]>;
  getRegistrant(
    scope: ResourceScope,
    occurrenceKey: string,
    learnerKey: string,
  ): Promise<ZoomClassRegistrantRecord | null>;
  saveRegistrant(
    args: ResourceScope & {
      occurrence_key: string;
      household_key: string;
      registrant: ZoomRegistrantRecord;
      registrant_token_ciphertext: string;
      registration_email_digest: string;
    },
  ): Promise<void>;
  markOccurrenceReady(
    scope: ResourceScope,
    occurrenceKey: string,
    providerMeetingRefDigest: string,
  ): Promise<void>;
  claimDelete(
    args: ResourceScope & {
      occurrence_key: string;
      idempotency_key: string;
    },
  ): Promise<{ record: ZoomClassOccurrenceResourceRecord; execute: boolean }>;
  completeDelete(
    args: ResourceScope & {
      occurrence_key: string;
      idempotency_key: string;
    },
  ): Promise<void>;
  failDelete(
    args: ResourceScope & {
      occurrence_key: string;
      idempotency_key: string;
      outcome_unknown: boolean;
      error_code: string;
      error_message: string;
    },
  ): Promise<void>;
};

export type ZoomClassOccurrenceProvider = {
  createMeeting(input: {
    startsAt: Date;
    topic: string;
    durationMinutes: number;
  }): Promise<ZoomScheduledClassMeetingPrivateMaterial>;
  registerLearner(input: {
    meetingId: string;
    learnerKey: string;
    displayName: string;
    email: string;
  }): Promise<ZoomRegistrantRecord>;
  deleteMeeting(meetingId: string): Promise<{ already_absent: boolean }>;
  participantSignature(input: { meetingNumber: string; now: Date }): string;
  hostSignature(input: { meetingNumber: string; now: Date }): string;
  hostZakToken(): Promise<string>;
  sdkWebVersion: string;
};

export function createZoomClassOccurrenceProvider(
  config: AppConfig,
): ZoomClassOccurrenceProvider | undefined {
  if (
    !config.zoomClassroomEnabled ||
    config.zoomClassroomProviderMode !== 'real' ||
    !config.zoomClassroomRealProviderEnabled ||
    !config.zoomAccountId ||
    !config.zoomServerToServerClientId ||
    !config.zoomServerToServerClientSecret ||
    !config.zoomHostUserId ||
    !config.zoomMeetingSdkClientId ||
    !config.zoomMeetingSdkClientSecret ||
    !config.zoomMeetingSdkWebVersion ||
    !hasExactSdkOriginBinding(config.applicationBaseUrl, config.zoomMeetingSdkAllowedOrigin)
  ) {
    return undefined;
  }
  const hostUserId = config.zoomHostUserId;
  const rest = createZoomRestClient({
    credentials: {
      accountId: config.zoomAccountId,
      clientId: config.zoomServerToServerClientId,
      clientSecret: config.zoomServerToServerClientSecret,
    },
    environment: config.oneTimeRuntimeEnvironment === 'production' ? 'production' : 'staging',
    enabled: true,
  });
  const credentials = {
    sdkKey: config.zoomMeetingSdkClientId,
    sdkSecret: config.zoomMeetingSdkClientSecret,
  };
  return {
    createMeeting(input) {
      return rest.createScheduledClassMeeting({ hostUserId, ...input });
    },
    registerLearner(input) {
      return rest.addLearnerRegistrant(input);
    },
    deleteMeeting(meetingId) {
      return rest.deleteMeeting(meetingId);
    },
    participantSignature({ meetingNumber, now }) {
      return createLearnerZoomSdkSignature({
        credentials,
        meetingNumber,
        issuedAt: now,
        ttlSeconds: 30 * 60,
      });
    },
    hostSignature({ meetingNumber, now }) {
      return createHostZoomSdkSignature({
        credentials,
        meetingNumber,
        issuedAt: now,
        ttlSeconds: 30 * 60,
      });
    },
    hostZakToken() {
      return rest.getHostZakToken(hostUserId);
    },
    sdkWebVersion: config.zoomMeetingSdkWebVersion,
  };
}

export function createZoomClassOccurrenceHostLaunchPort(input: {
  config: AppConfig;
  repository: ZoomClassOccurrenceRepository;
  provider?: ZoomClassOccurrenceProvider | undefined;
  clock?: (() => Date) | undefined;
}): ZoomHostLaunchPort | undefined {
  if (!input.provider) return undefined;
  const provider = input.provider;
  const clock = input.clock ?? (() => new Date());
  const scope = {
    account_key: input.config.accountKey,
    product_key: input.config.productKey,
  };

  async function participantMaterial(args: {
    occurrenceKey: string;
    customerKey: string;
    userName: string;
    now: Date;
  }) {
    const resource = await requireActiveLaunchResource(
      input.config,
      input.repository,
      scope,
      args.occurrenceKey,
    );
    return {
      occurrence_key: args.occurrenceKey,
      sdk_web_version: provider.sdkWebVersion,
      meeting_number: resource.meetingNumber,
      signature: provider.participantSignature({
        meetingNumber: resource.meetingNumber,
        now: args.now,
      }),
      password: resource.meetingPassword,
      customer_key: args.customerKey,
      user_name: args.userName,
      leave_url: '/app/live-console',
      video_start_model: 'PARTICIPANT_CONSENT' as const,
    };
  }

  return {
    async resolveHostLaunch({ occurrenceKey, now }) {
      const resource = await requireActiveLaunchResource(
        input.config,
        input.repository,
        scope,
        occurrenceKey,
      );
      const [signature, zak] = await Promise.all([
        Promise.resolve(
          provider.hostSignature({ meetingNumber: resource.meetingNumber, now: now ?? clock() }),
        ),
        provider.hostZakToken(),
      ]);
      return {
        occurrence_key: occurrenceKey,
        sdk_web_version: provider.sdkWebVersion,
        meeting_number: resource.meetingNumber,
        signature,
        password: resource.meetingPassword,
        zak,
        user_name: 'One Time Class Host',
        leave_url: '/app/live-console',
        video_start_model: 'PARTICIPANT_CONSENT',
      };
    },
    resolveTestParticipantLaunch(args) {
      return participantMaterial(args);
    },
  };
}

export function createZoomClassOccurrenceService(input: {
  config: AppConfig;
  repository: ZoomClassOccurrenceRepository;
  provider?: ZoomClassOccurrenceProvider | undefined;
  clock?: (() => Date) | undefined;
}) {
  return {
    async status(actor: PortalActorContext, occurrenceKey: string) {
      requireAdmin(actor);
      const [occurrence, resource] = await Promise.all([
        input.repository.getOccurrence(actor, occurrenceKey),
        input.repository.getResource(actor, occurrenceKey),
      ]);
      if (!occurrence) throw new PortalServiceError('NOT_FOUND', 'Class occurrence was not found.');
      const enrolled = await input.repository.listActiveEnrolledLearners(actor, occurrenceKey);
      let registered = 0;
      for (const learner of enrolled) {
        const row = await input.repository.getRegistrant(actor, occurrenceKey, learner.learner_key);
        if (row?.registration_state === 'registered' && Boolean(row.registrant_token_ciphertext)) {
          registered += 1;
        }
      }
      return publicStatus(
        occurrence,
        resource,
        enrolled.length,
        registered,
        Boolean(input.provider),
      );
    },

    async provision(
      actor: PortalActorContext,
      args: {
        occurrence_key: string;
        purpose: ZoomClassOccurrencePurpose;
        idempotency_key: string;
      },
    ) {
      requireAdmin(actor);
      const provider = requireProvider(input.provider);
      if (
        args.purpose === 'synthetic_acceptance' &&
        input.config.oneTimeRuntimeEnvironment !== 'isolated_staging'
      ) {
        throw new PortalServiceError(
          'FORBIDDEN',
          'Synthetic acceptance meetings are restricted to isolated staging.',
        );
      }
      const occurrence = await input.repository.getOccurrence(actor, args.occurrence_key);
      if (!occurrence) throw new PortalServiceError('NOT_FOUND', 'Class occurrence was not found.');
      if (
        args.purpose === 'synthetic_acceptance' &&
        (!occurrence.is_operator_test ||
          occurrence.operator_test_environment !== input.config.oneTimeRuntimeEnvironment)
      ) {
        throw new PortalServiceError(
          'FORBIDDEN',
          'Synthetic Zoom provisioning requires an exact isolated-staging operator-test occurrence.',
        );
      }
      const learners = await input.repository.listActiveEnrolledLearners(
        actor,
        occurrence.occurrence_key,
      );
      if (learners.length < 1) {
        throw new PortalServiceError(
          'FORBIDDEN',
          'Enroll at least one active Student before provisioning Zoom access.',
        );
      }
      const environment =
        input.config.oneTimeRuntimeEnvironment === 'production'
          ? ('production' as const)
          : ('isolated_staging' as const);
      const resourceKey = stableKey('zoom_class_occurrence', [
        actor.account_key,
        actor.product_key,
        occurrence.occurrence_key,
      ]);
      const claimed = await input.repository.claimProvision({
        ...actor,
        resource_key: resourceKey,
        occurrence,
        environment,
        purpose: args.purpose,
        actor_user_ref: actor.actor_user_ref,
        idempotency_key: args.idempotency_key,
      });
      let resource = claimed.record;
      if (claimed.execute) {
        try {
          const created = await provider.createMeeting({
            startsAt: occurrence.starts_at,
            topic: occurrence.title,
            durationMinutes: occurrence.duration_minutes,
          });
          resource = await input.repository.completeProvision({
            ...actor,
            occurrence_key: occurrence.occurrence_key,
            idempotency_key: args.idempotency_key,
            provider_meeting_ref_digest: created.meeting.provider_meeting_ref_digest,
            provider_meeting_ciphertext: encryptProviderValue(
              input.config,
              resourceKey,
              'meeting',
              created.meeting.meeting_id,
            ),
            meeting_password_ciphertext: encryptProviderValue(
              input.config,
              resourceKey,
              'password',
              created.password,
            ),
          });
        } catch (error) {
          const safe = safeProviderError(error, 'Zoom class meeting could not be created.');
          await input.repository.failProvision({
            ...actor,
            occurrence_key: occurrence.occurrence_key,
            idempotency_key: args.idempotency_key,
            outcome_unknown: safe.outcomeUnknown,
            error_code: safe.code,
            error_message: safe.message,
          });
          throw new PortalServiceError(safe.portalCode, safe.message);
        }
      }
      if (
        resource.resource_state !== 'active' ||
        !resource.provider_meeting_ciphertext ||
        !resource.provider_meeting_ref_digest
      ) {
        throw new PortalServiceError(
          'PROVIDER_NOT_READY',
          resource.resource_state === 'provision_unknown'
            ? 'Zoom meeting creation outcome is unknown. Do not create another meeting.'
            : 'Zoom class meeting is not ready.',
        );
      }
      const meetingId = decryptProviderValue(
        input.config,
        resource.resource_key,
        'meeting',
        resource.provider_meeting_ciphertext,
      );
      for (const learner of learners) {
        const existing = await input.repository.getRegistrant(
          actor,
          occurrence.occurrence_key,
          learner.learner_key,
        );
        if (existing?.registration_state === 'registered' && existing.registrant_token_ciphertext) {
          continue;
        }
        const email = zoomRegistrationEmail(actor, learner.learner_key);
        try {
          const registrant = await provider.registerLearner({
            meetingId,
            learnerKey: learner.learner_key,
            displayName: learner.display_name,
            email,
          });
          await input.repository.saveRegistrant({
            ...actor,
            occurrence_key: occurrence.occurrence_key,
            household_key: learner.household_key,
            registrant,
            registrant_token_ciphertext: encryptProviderValue(
              input.config,
              resource.resource_key,
              `registrant:${learner.learner_key}`,
              registrant.registrant_token,
            ),
            registration_email_digest: redactedRefHash(email),
          });
        } catch (error) {
          const safe = safeProviderError(error, 'A Student could not be registered with Zoom.');
          throw new PortalServiceError(safe.portalCode, safe.message);
        }
      }
      await input.repository.markOccurrenceReady(
        actor,
        occurrence.occurrence_key,
        resource.provider_meeting_ref_digest,
      );
      return publicStatus(
        occurrence,
        resource,
        learners.length,
        learners.length,
        Boolean(input.provider),
      );
    },

    async deleteSynthetic(
      actor: PortalActorContext,
      args: { occurrence_key: string; idempotency_key: string },
    ) {
      requireAdmin(actor);
      if (input.config.oneTimeRuntimeEnvironment !== 'isolated_staging') {
        throw new PortalServiceError(
          'FORBIDDEN',
          'Zoom meeting deletion is restricted to isolated staging acceptance resources.',
        );
      }
      const provider = requireProvider(input.provider);
      const [occurrence, recorded] = await Promise.all([
        input.repository.getOccurrence(actor, args.occurrence_key),
        input.repository.getResource(actor, args.occurrence_key),
      ]);
      if (
        !occurrence?.is_operator_test ||
        occurrence.operator_test_environment !== input.config.oneTimeRuntimeEnvironment
      ) {
        throw new PortalServiceError(
          'FORBIDDEN',
          'The recorded occurrence is not an exact isolated-staging operator-test resource.',
        );
      }
      if (recorded?.purpose !== 'synthetic_acceptance') {
        throw new PortalServiceError(
          'FORBIDDEN',
          'Only an explicitly recorded synthetic acceptance meeting can be deleted here.',
        );
      }
      const claimed = await input.repository.claimDelete({ ...actor, ...args });
      const resource = claimed.record;
      if (!claimed.execute) {
        return {
          occurrence_key: resource.occurrence_key,
          meeting_state: resource.resource_state,
          deleted: resource.resource_state === 'deleted',
        };
      }
      if (!resource.provider_meeting_ciphertext) {
        throw new PortalServiceError('FORBIDDEN', 'No recorded Zoom meeting can be deleted.');
      }
      const meetingId = decryptProviderValue(
        input.config,
        resource.resource_key,
        'meeting',
        resource.provider_meeting_ciphertext,
      );
      try {
        await provider.deleteMeeting(meetingId);
        await input.repository.completeDelete({ ...actor, ...args });
        return {
          occurrence_key: resource.occurrence_key,
          meeting_state: 'deleted' as const,
          deleted: true,
        };
      } catch (error) {
        const safe = safeProviderError(error, 'Zoom acceptance meeting could not be deleted.');
        await input.repository.failDelete({
          ...actor,
          ...args,
          outcome_unknown: safe.outcomeUnknown,
          error_code: safe.code,
          error_message: safe.message,
        });
        throw new PortalServiceError(safe.portalCode, safe.message);
      }
    },
  };
}

export function createZoomClassroomPorts(input: {
  config: AppConfig;
  repository: ZoomClassOccurrenceRepository;
  provider?: ZoomClassOccurrenceProvider | undefined;
  clock?: (() => Date) | undefined;
}):
  | {
      zoomMeetingLaunchPort: ZoomMeetingLaunchPort;
      zoomRegistrantPort: ZoomRegistrantPort;
      zoomRealProviderReady: true;
    }
  | Record<string, never> {
  if (!input.provider) return {};
  const provider = input.provider;
  const clock = input.clock ?? (() => new Date());

  return {
    zoomRegistrantPort: {
      async resolveRegistrant({ occurrence, eligibility }) {
        const [resource, registrant] = await Promise.all([
          input.repository.getResource(eligibility, occurrence.occurrence_key),
          input.repository.getRegistrant(
            eligibility,
            occurrence.occurrence_key,
            eligibility.learner_key,
          ),
        ]);
        if (
          resource?.resource_state !== 'active' ||
          registrant?.registration_state !== 'registered' ||
          !registrant.registrant_token_ciphertext
        ) {
          return {
            provider: 'zoom',
            mode: 'real',
            registration_state: 'not_configured',
            registrant_token_ref: stableKey('zoom_registrant_unavailable', [
              occurrence.occurrence_key,
              eligibility.learner_key,
            ]),
            provider_registrant_ref_digest: redactedRefHash('unavailable'),
            raw_join_url_present: false,
          };
        }
        return {
          provider: 'zoom',
          mode: 'real',
          registration_state: 'real_ready',
          registrant_token_ref: registrant.registrant_token_ref,
          provider_registrant_ref_digest: registrant.provider_registrant_ref_digest,
          raw_join_url_present: false,
        };
      },
    },
    zoomMeetingLaunchPort: {
      async resolveLaunchMaterial({ occurrence, eligibility, registrant, selectedView }) {
        if (registrant.registration_state !== 'real_ready' || selectedView !== 'client') {
          throw new PortalServiceError(
            'PROVIDER_NOT_READY',
            'Classroom provider is not configured.',
          );
        }
        const [resource, storedRegistrant] = await Promise.all([
          input.repository.getResource(eligibility, occurrence.occurrence_key),
          input.repository.getRegistrant(
            eligibility,
            occurrence.occurrence_key,
            eligibility.learner_key,
          ),
        ]);
        if (
          resource?.resource_state !== 'active' ||
          !resource.provider_meeting_ciphertext ||
          !resource.meeting_password_ciphertext ||
          !resource.provider_meeting_ref_digest ||
          storedRegistrant?.registration_state !== 'registered' ||
          !storedRegistrant.registrant_token_ciphertext
        ) {
          throw new PortalServiceError('PROVIDER_NOT_READY', 'Classroom provider is not ready.');
        }
        const meetingNumber = decryptProviderValue(
          input.config,
          resource.resource_key,
          'meeting',
          resource.provider_meeting_ciphertext,
        );
        const meetingPassword = decryptProviderValue(
          input.config,
          resource.resource_key,
          'password',
          resource.meeting_password_ciphertext,
        );
        const registrantToken = decryptProviderValue(
          input.config,
          resource.resource_key,
          `registrant:${eligibility.learner_key}`,
          storedRegistrant.registrant_token_ciphertext,
        );
        if (redactedRefHash(meetingNumber) !== resource.provider_meeting_ref_digest) {
          throw new PortalServiceError(
            'PROVIDER_NOT_READY',
            'Stored classroom provider binding is invalid.',
          );
        }
        return {
          mode: 'real',
          sdk_web_version: provider.sdkWebVersion,
          meeting_number: meetingNumber,
          signature: provider.participantSignature({
            meetingNumber,
            now: clock(),
          }),
          meeting_password: meetingPassword,
          registrant_token: registrantToken,
          user_email: zoomRegistrationEmail(eligibility, eligibility.learner_key),
          customer_key: zoomCustomerKey([occurrence.occurrence_key, eligibility.learner_key]),
          role: 0,
          user_display_name: eligibility.display_name,
          user_email_required: true,
          leave_url: '/app/student',
          video_start_model: 'PARTICIPANT_CONSENT',
          provider_meeting_ref_digest: resource.provider_meeting_ref_digest,
          official_sdk_view: 'client',
          official_client_method: 'ZoomMtg.preLoadWasm.prepareWebSDK.init.join',
        };
      },
    },
    zoomRealProviderReady: true,
  };
}

function publicStatus(
  occurrence: ZoomClassOccurrenceRecord,
  resource: ZoomClassOccurrenceResourceRecord | null,
  enrolled: number,
  registered: number,
  providerReady: boolean,
) {
  return {
    occurrence_key: occurrence.occurrence_key,
    title: occurrence.title,
    starts_at: occurrence.starts_at.toISOString(),
    provider_ready: providerReady,
    meeting_state: resource?.resource_state ?? 'not_provisioned',
    purpose: resource?.purpose ?? null,
    enrolled_student_count: enrolled,
    registered_student_count: registered,
    raw_join_url_present: false as const,
    last_error: resource?.last_error_message ?? null,
  };
}

async function requireActiveLaunchResource(
  config: AppConfig,
  repository: ZoomClassOccurrenceRepository,
  scope: ResourceScope,
  occurrenceKey: string,
) {
  const resource = await repository.getResource(scope, occurrenceKey);
  if (
    resource?.resource_state !== 'active' ||
    !resource.provider_meeting_ciphertext ||
    !resource.meeting_password_ciphertext ||
    !resource.provider_meeting_ref_digest
  ) {
    throw new PortalServiceError('PROVIDER_NOT_READY', 'Classroom provider is not ready.');
  }
  const meetingNumber = decryptProviderValue(
    config,
    resource.resource_key,
    'meeting',
    resource.provider_meeting_ciphertext,
  );
  if (redactedRefHash(meetingNumber) !== resource.provider_meeting_ref_digest) {
    throw new PortalServiceError(
      'PROVIDER_NOT_READY',
      'Stored classroom provider binding is invalid.',
    );
  }
  return {
    meetingNumber,
    meetingPassword: decryptProviderValue(
      config,
      resource.resource_key,
      'password',
      resource.meeting_password_ciphertext,
    ),
  };
}

function requireAdmin(actor: PortalActorContext) {
  if (actor.actor_role !== 'owner' && actor.actor_role !== 'admin') {
    throw new PortalServiceError('FORBIDDEN', 'Zoom setup requires owner or admin access.');
  }
}

function requireProvider(provider: ZoomClassOccurrenceProvider | undefined) {
  if (!provider) {
    throw new PortalServiceError(
      'PROVIDER_NOT_READY',
      'Zoom class provisioning credentials or exact Meeting SDK origin binding are unavailable.',
    );
  }
  return provider;
}

function zoomRegistrationEmail(scope: ResourceScope, learnerKey: string) {
  const digest = createHash('sha256')
    .update([scope.account_key, scope.product_key, learnerKey].join('\u001f'))
    .digest('hex')
    .slice(0, 24);
  return `zoom-registration+${digest}@onetimeonetime.com`;
}

function encryptionKey(config: AppConfig) {
  return createHash('sha256')
    .update(`${config.mfaSecretEncryptionKey}:zoom-class-occurrence-v1`)
    .digest();
}

function encryptProviderValue(
  config: AppConfig,
  resourceKey: string,
  purpose: string,
  plaintext: string,
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(config), iv);
  cipher.setAAD(Buffer.from(`${resourceKey}\u001f${purpose}\u001fzoom-class-occurrence-v1`));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
}

function decryptProviderValue(
  config: AppConfig,
  resourceKey: string,
  purpose: string,
  packedValue: string,
) {
  try {
    const packed = Buffer.from(packedValue, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(config), packed.subarray(0, 12));
    decipher.setAAD(Buffer.from(`${resourceKey}\u001f${purpose}\u001fzoom-class-occurrence-v1`));
    decipher.setAuthTag(packed.subarray(12, 28));
    return Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    throw new PortalServiceError(
      'PROVIDER_NOT_READY',
      'Stored classroom provider material could not be verified.',
    );
  }
}

function safeProviderError(error: unknown, fallback: string) {
  const source = error as { code?: unknown; message?: unknown; retryable?: unknown };
  const code =
    typeof source?.code === 'string' && /^ZOOM_[A-Z0-9_]+$/.test(source.code)
      ? source.code
      : 'ZOOM_PROVIDER_ERROR';
  const message =
    typeof source?.message === 'string' && source.message.length > 0
      ? source.message.slice(0, 240)
      : fallback;
  const outcomeUnknown = source?.retryable === true || code === 'ZOOM_REQUEST_TIMEOUT';
  return {
    code,
    message,
    outcomeUnknown,
    portalCode: outcomeUnknown ? ('ADAPTER_UNAVAILABLE' as const) : ('PROVIDER_NOT_READY' as const),
  };
}

function hasExactSdkOriginBinding(applicationBaseUrl: string, allowedOrigin: string | undefined) {
  if (!allowedOrigin) return false;
  try {
    const runtime = new URL(applicationBaseUrl);
    const configured = new URL(allowedOrigin);
    return (
      runtime.origin === configured.origin &&
      configured.protocol === 'https:' &&
      configured.username === '' &&
      configured.password === '' &&
      configured.pathname === '/' &&
      configured.search === '' &&
      configured.hash === ''
    );
  } catch {
    return false;
  }
}
