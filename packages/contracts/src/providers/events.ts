import { z } from 'zod';

export const providerKeySchema = z.enum([
  'stripe',
  'resend',
  'one_time_wapi',
  'zoom',
  'vimeo',
  'one_time_telegram',
  'bna_oversight',
]);
export type ProviderKey = z.infer<typeof providerKeySchema>;

export const providerEnvironmentSchema = z.enum(['fixture', 'test', 'staging', 'production']);
export type ProviderEnvironment = z.infer<typeof providerEnvironmentSchema>;

export const providerCanonicalStateSchema = z.enum([
  'queued_locally',
  'sink_processed',
  'provider_accepted',
  'delivered',
  'failed',
  'bounced',
  'complained',
  'suppressed',
  'expired',
  'dead_lettered',
  'unavailable',
]);
export type ProviderCanonicalState = z.infer<typeof providerCanonicalStateSchema>;

export const providerEventRecordSchema = z
  .object({
    event_key: z.string().min(8).max(180),
    account_key: z.string().min(1).max(120),
    product_key: z.string().min(1).max(120),
    provider: providerKeySchema,
    environment: providerEnvironmentSchema,
    provider_event_ref_hash: z.string().regex(/^[a-f0-9]{16,128}$/),
    event_type: z.string().min(1).max(160),
    canonical_state: providerCanonicalStateSchema,
    provider_created_at: z.string().datetime().nullable(),
    payload_digest: z.string().regex(/^[a-f0-9]{16,128}$/),
    object_refs: z.record(z.string(), z.unknown()).default({}),
    minimized_payload: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
export type ProviderEventRecord = z.infer<typeof providerEventRecordSchema>;

export const providerReadinessStateSchema = z.enum([
  'not_configured',
  'configured',
  'authenticated',
  'canary_verified',
  'live',
  'unavailable',
]);
export type ProviderReadinessState = z.infer<typeof providerReadinessStateSchema>;

export type ProviderReadinessSnapshot = {
  snapshot_key: string;
  account_key: string;
  product_key: string;
  provider: ProviderKey;
  environment: ProviderEnvironment;
  readiness_state: ProviderReadinessState;
  capability_names: string[];
  safe_fingerprint: string | null;
  observed_at: string;
};
