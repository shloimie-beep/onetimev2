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
