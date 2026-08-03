import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { AppConfig } from '../../../config/src/index.ts';
import type { ProviderReadinessSnapshot } from '../../../contracts/src/providers/events.ts';
import type {
  ClassroomLaunchBootstrapResponse,
  ClassroomSelectedView,
} from '../../../contracts/src/classroom/index.ts';
import type {
  ClassroomEligibility,
  ClassroomLaunchGrantRecord,
  ClassroomOccurrenceRecord,
} from '../classroom/service.ts';
import { assertNoLiveReference, safeFingerprint, stableProviderKey } from './shared.ts';

export const zoomAdapterConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    accountKey: z.string().min(1),
    productKey: z.string().min(1),
    environment: z.enum(['test', 'staging', 'production']).default('staging'),
    accountRefConfigured: z.boolean().default(false),
    hostRefConfigured: z.boolean().default(false),
    readOnlyVerificationEnabled: z.boolean().default(false),
    mutationCanaryEnabled: z.boolean().default(false),
  })
  .strict();
export type ZoomAdapterConfig = z.infer<typeof zoomAdapterConfigSchema>;

export type ZoomReadinessClient = {
  getAccountReadiness(): Promise<{
    accountRef: string;
    hostRef: string;
    hostTimezone: string;
    canCreateMeetings: boolean;
  }>;
};

export type ZoomOccurrenceInput = {
  occurrenceKey: string;
  scheduledStart: Date;
  durationMinutes: number;
  providerMeetingRef: string;
  launchSecretRef: string;
};

export type ZoomLaunchDescriptor = {
  occurrence_key: string;
  provider: 'zoom';
  schedule: {
    local_time: '19:00';
    timezone: 'Asia/Jerusalem';
    dst_behavior: 'iana_timezone_database';
  };
  provider_reference_digest: string;
  launch_token_ref: string;
  expires_at: string;
  join_url_included: false;
  mute_on_entry_required: true;
};

export type ZoomRegistrantResolution = {
  provider: 'zoom';
  mode: 'sink' | 'real';
  registration_state: 'sink_ready' | 'real_ready' | 'disabled' | 'not_configured';
  registrant_token_ref: string;
  provider_registrant_ref_digest: string;
  raw_join_url_present: false;
};

export type ZoomMeetingLaunchMaterial = ClassroomLaunchBootstrapResponse['sdk'] & {
  provider_meeting_ref_digest: string;
  official_sdk_view: ClassroomSelectedView;
  official_client_method:
    'ZoomMtg.preLoadWasm.prepareWebSDK.init.join' | 'ZoomMtgEmbedded.createClient.init.join';
};

export type ZoomMeetingLaunchPort = {
  resolveLaunchMaterial(input: {
    config: AppConfig;
    occurrence: ClassroomOccurrenceRecord;
    eligibility: ClassroomEligibility;
    grant: ClassroomLaunchGrantRecord;
    registrant: ZoomRegistrantResolution;
    selectedView: ClassroomSelectedView;
  }): Promise<ZoomMeetingLaunchMaterial>;
};

export type ZoomRegistrantPort = {
  resolveRegistrant(input: {
    config: AppConfig;
    occurrence: ClassroomOccurrenceRecord;
    eligibility: ClassroomEligibility;
    grant: ClassroomLaunchGrantRecord;
  }): Promise<ZoomRegistrantResolution>;
};

export type ZoomProviderReadinessPort = {
  inspectReadiness(input: {
    config: ZoomAdapterConfig;
    client?: ZoomReadinessClient | undefined;
    observedAt?: Date | undefined;
  }): Promise<ProviderReadinessSnapshot>;
};

export type ZoomAttendanceReconciliationPort = {
  reconcileAttendance(input: {
    accountKey: string;
    productKey: string;
    occurrenceKey: string;
    enabled: boolean;
  }): Promise<{
    status: 'disabled' | 'sink_noop' | 'not_configured';
    external_call_performed: false;
    reconciled_count: number;
  }>;
};

export type ZoomFeatureParticipantPort = {
  featureParticipant(input: {
    accountKey: string;
    productKey: string;
    occurrenceKey: string;
    learnerKey: string;
    enabled: boolean;
  }): Promise<{
    status: 'disabled';
    external_call_performed: false;
    reason: 'v1_host_controls_only';
  }>;
};

export type ReminderDeliveryInput = {
  accountKey: string;
  productKey: string;
  learnerKey: string;
  occurrenceKey: string;
  channel: 'portal' | 'email' | 'whatsapp';
  preference: 'portal' | 'email' | 'whatsapp' | 'both' | 'none';
  consent: 'granted' | 'not_required' | 'missing' | 'revoked';
  suppression: 'active' | 'suppressed';
  attempt: number;
  idempotencyKey: string;
};

export type ReminderDeliveryResult = {
  status: 'sent_sink' | 'suppressed' | 'retry' | 'dead_letter';
  idempotency_key: string;
  external_send_performed: false;
  reason:
    | 'sink_delivery_recorded'
    | 'preference_opted_out'
    | 'consent_required'
    | 'suppressed'
    | 'retryable_sink_failure'
    | 'max_retries_exceeded';
  next_attempt_at: string | null;
};

export type ReminderDeliveryPort = {
  deliverReminder(input: ReminderDeliveryInput, now?: Date): Promise<ReminderDeliveryResult>;
};

export function oneTimeDailyZoomSchedule() {
  return {
    local_time: '19:00' as const,
    timezone: 'Asia/Jerusalem' as const,
    dst_behavior: 'iana_timezone_database' as const,
  };
}

export function buildZoomLaunchDescriptor(
  input: ZoomOccurrenceInput,
  now = new Date(),
): ZoomLaunchDescriptor {
  assertNoLiveReference('zoom meeting ref', input.providerMeetingRef);
  const ttlMs = 15 * 60 * 1000;
  return {
    occurrence_key: input.occurrenceKey,
    provider: 'zoom',
    schedule: oneTimeDailyZoomSchedule(),
    provider_reference_digest: safeFingerprint(input.providerMeetingRef),
    launch_token_ref: stableProviderKey('zoom_launch', [
      input.occurrenceKey,
      input.providerMeetingRef,
      input.launchSecretRef,
      String(now.getTime()),
    ]),
    expires_at: new Date(now.getTime() + ttlMs).toISOString(),
    join_url_included: false,
    mute_on_entry_required: true,
  };
}

export function createDeterministicZoomRegistrantPort(): ZoomRegistrantPort {
  return {
    async resolveRegistrant(input) {
      if (!input.config.zoomClassroomEnabled || input.config.zoomClassroomProviderMode !== 'sink') {
        return {
          provider: 'zoom',
          mode: input.config.zoomClassroomProviderMode,
          registration_state: input.config.zoomClassroomEnabled ? 'not_configured' : 'disabled',
          registrant_token_ref: stableProviderKey('registrant_unavailable', [
            input.occurrence.occurrence_key,
            input.eligibility.learner_key,
          ]),
          provider_registrant_ref_digest: digest('registrant_unavailable'),
          raw_join_url_present: false,
        };
      }
      const tokenRef = stableProviderKey('registrant', [
        input.occurrence.occurrence_key,
        input.eligibility.learner_key,
        input.grant.grant_key,
      ]);
      return {
        provider: 'zoom',
        mode: 'sink',
        registration_state: 'sink_ready',
        registrant_token_ref: tokenRef,
        provider_registrant_ref_digest: digest(tokenRef),
        raw_join_url_present: false,
      };
    },
  };
}

export function createDeterministicZoomMeetingLaunchPort(): ZoomMeetingLaunchPort {
  return {
    async resolveLaunchMaterial(input) {
      if (
        !input.config.zoomClassroomEnabled ||
        input.config.zoomClassroomProviderMode !== 'sink' ||
        input.registrant.registration_state !== 'sink_ready'
      ) {
        throw new Error('Zoom Meeting SDK launch material is not configured.');
      }
      const seed = [
        input.occurrence.occurrence_key,
        input.eligibility.learner_key,
        input.grant.grant_key,
      ].join(':');
      const numberSeed = createHash('sha256').update(seed).digest('hex').slice(0, 10);
      const numeric = BigInt(`0x${numberSeed}`).toString().slice(0, 9).padEnd(9, '0');
      const officialClientMethod =
        input.selectedView === 'component'
          ? 'ZoomMtgEmbedded.createClient.init.join'
          : 'ZoomMtg.preLoadWasm.prepareWebSDK.init.join';
      return {
        mode: 'sink',
        sdk_key_ref: stableProviderKey('sdk_key', [
          'sink',
          input.config.accountKey,
          input.config.productKey,
        ]),
        meeting_number: `9${numeric}`,
        signature: `sink_sig_${createHash('sha256').update(seed).digest('base64url').slice(0, 72)}`,
        password_ref: stableProviderKey('meeting_password', [input.occurrence.occurrence_key]),
        registrant_token_ref: input.registrant.registrant_token_ref,
        role: 0,
        user_display_name: input.eligibility.display_name,
        user_email_required: false,
        leave_url: '/app/student',
        provider_meeting_ref_digest: digest(`meeting:${input.occurrence.occurrence_key}`),
        official_sdk_view: input.selectedView,
        official_client_method: officialClientMethod,
      };
    },
  };
}

export function createZoomProviderReadinessPort(): ZoomProviderReadinessPort {
  return {
    inspectReadiness: inspectZoomReadiness,
  };
}

export function createDisabledZoomAttendanceReconciliationPort(): ZoomAttendanceReconciliationPort {
  return {
    async reconcileAttendance() {
      return {
        status: 'disabled',
        external_call_performed: false,
        reconciled_count: 0,
      };
    },
  };
}

export function createDisabledZoomFeatureParticipantPort(): ZoomFeatureParticipantPort {
  return {
    async featureParticipant() {
      return {
        status: 'disabled',
        external_call_performed: false,
        reason: 'v1_host_controls_only',
      };
    },
  };
}

export function createDeterministicReminderDeliveryPort(): ReminderDeliveryPort {
  return {
    async deliverReminder(input, now = new Date()) {
      if (input.preference === 'none') {
        return reminderResult(input, 'suppressed', 'preference_opted_out', null);
      }
      if (input.consent === 'missing' || input.consent === 'revoked') {
        return reminderResult(input, 'suppressed', 'consent_required', null);
      }
      if (input.suppression === 'suppressed') {
        return reminderResult(input, 'suppressed', 'suppressed', null);
      }
      if (input.attempt >= 3) {
        return reminderResult(input, 'dead_letter', 'max_retries_exceeded', null);
      }
      if (input.attempt > 0) {
        return reminderResult(
          input,
          'retry',
          'retryable_sink_failure',
          new Date(now.getTime() + 5 * 60_000).toISOString(),
        );
      }
      return reminderResult(input, 'sent_sink', 'sink_delivery_recorded', null);
    },
  };
}

export async function inspectZoomReadiness(input: {
  config: ZoomAdapterConfig;
  client?: ZoomReadinessClient;
  observedAt?: Date;
}): Promise<ProviderReadinessSnapshot> {
  const observedAt = input.observedAt ?? new Date();
  if (
    !input.config.enabled ||
    !input.config.accountRefConfigured ||
    !input.config.hostRefConfigured
  ) {
    return snapshot(input.config, 'not_configured', [], null, observedAt);
  }
  if (!input.config.readOnlyVerificationEnabled || !input.client) {
    return snapshot(
      input.config,
      'configured',
      ['daily_1900_asia_jerusalem_schedule', 'protected_last_moment_launch'],
      null,
      observedAt,
    );
  }
  const readiness = await input.client.getAccountReadiness();
  if (readiness.hostTimezone !== 'Asia/Jerusalem') {
    return snapshot(input.config, 'unavailable', ['host_timezone_mismatch'], null, observedAt);
  }
  return snapshot(
    input.config,
    'authenticated',
    [
      'daily_1900_asia_jerusalem_schedule',
      'protected_last_moment_launch',
      readiness.canCreateMeetings ? 'meeting_mutation_capability_present' : 'read_only_ready',
    ],
    safeFingerprint(`${readiness.accountRef}:${readiness.hostRef}`),
    observedAt,
  );
}

function snapshot(
  config: ZoomAdapterConfig,
  state: ProviderReadinessSnapshot['readiness_state'],
  capabilityNames: string[],
  fingerprint: string | null,
  observedAt: Date,
): ProviderReadinessSnapshot {
  return {
    snapshot_key: stableProviderKey('zoom_readiness', [
      config.accountKey,
      config.productKey,
      config.environment,
      observedAt.toISOString(),
    ]),
    account_key: config.accountKey,
    product_key: config.productKey,
    provider: 'zoom',
    environment: config.environment,
    readiness_state: state,
    capability_names: capabilityNames,
    safe_fingerprint: fingerprint,
    observed_at: observedAt.toISOString(),
  };
}

function reminderResult(
  input: ReminderDeliveryInput,
  status: ReminderDeliveryResult['status'],
  reason: ReminderDeliveryResult['reason'],
  nextAttemptAt: string | null,
): ReminderDeliveryResult {
  return {
    status,
    idempotency_key: input.idempotencyKey,
    external_send_performed: false,
    reason,
    next_attempt_at: nextAttemptAt,
  };
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
