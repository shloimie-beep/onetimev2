import { z } from 'zod';
import type { ProviderReadinessSnapshot } from '../../../contracts/src/providers/events.ts';
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
