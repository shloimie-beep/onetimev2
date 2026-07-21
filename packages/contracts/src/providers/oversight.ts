import { z } from 'zod';

export const oversightOutcomeCategorySchema = z.enum([
  'deployment_source_health',
  'migration_readiness',
  'worker_readiness',
  'provider_readiness',
  'operational_counts',
  'repair_reason_codes',
]);
export type OversightOutcomeCategory = z.infer<typeof oversightOutcomeCategorySchema>;

export const oversightOutcomeSchema = z
  .object({
    schema_version: z.literal(1),
    event_id: z.string().min(12).max(180),
    source_sha: z.string().regex(/^[a-f0-9]{7,40}$/i),
    account_key: z.string().min(1).max(120),
    product_key: z.string().min(1).max(120),
    category: oversightOutcomeCategorySchema,
    produced_at: z.string().datetime(),
    stale_after: z.string().datetime(),
    summary: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
    signature_ref: z.string().min(8).max(180).nullable(),
  })
  .strict();
export type OversightOutcome = z.infer<typeof oversightOutcomeSchema>;

export const bnaOversightFollowupManifestSchema = z
  .object({
    schema_version: z.literal(1),
    producer: z
      .object({
        repository: z.literal('shloimie-beep/onetimev2'),
        branch: z.string().min(1).max(160),
        account_key: z.string().min(1).max(120),
        product_key: z.string().min(1).max(120),
      })
      .strict(),
    consumer: z
      .object({
        repository_hint: z.string().min(1).max(120),
        runtime_wiring: z.literal('future_followup_only'),
        synchronous_call_allowed: z.literal(false),
        bna_runtime_edit_in_ot72: z.literal(false),
      })
      .strict(),
    transport: z
      .object({
        pattern: z.literal('asynchronous_outbox'),
        required_controls: z
          .array(
            z.enum([
              'signature_ref',
              'idempotency_key',
              'replay_protection',
              'dead_letter',
              'staleness_window',
            ]),
          )
          .min(1),
      })
      .strict(),
    allowed_categories: z.array(oversightOutcomeCategorySchema).min(1),
    allowed_summary_keys: z.array(z.string().min(1).max(80)).min(1),
    forbidden_payload_terms: z.array(z.string().min(1).max(120)).min(1),
    activation_requirements: z.array(z.string().min(1).max(280)).min(1),
  })
  .strict();
export type BnaOversightFollowupManifest = z.infer<typeof bnaOversightFollowupManifestSchema>;
