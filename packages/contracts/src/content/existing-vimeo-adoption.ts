import { z } from 'zod';

const safeIdSchema = z
  .string()
  .trim()
  .min(8)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]+$/u);

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

/**
 * A raw Vimeo URL is deliberately not accepted. The provider identity remains
 * server-side and the browser receives only a first-party playback route.
 */
export const existingVimeoAdoptionCommandSchema = z
  .object({
    provider_video_id: z
      .string()
      .trim()
      .regex(/^\d{6,20}$/u),
    title: z.string().trim().min(1).max(180),
    source_sha256: sha256Schema,
    reviewed_source_digest: sha256Schema,
    idempotency_key: safeIdSchema,
  })
  .strict();
export type ExistingVimeoAdoptionCommand = z.infer<typeof existingVimeoAdoptionCommandSchema>;

export const existingVimeoAdoptionResultSchema = z
  .object({
    item_key: z.string().trim().min(3).max(180),
    title: z.string().trim().min(1).max(180),
    state: z.literal('published'),
    replay: z.boolean(),
    privacy_contract: z.literal('embed_only_domain_whitelist'),
    entitled_audience: z.literal('all_active_learners'),
    playback_route: z.string().regex(/^\/app\/learning\/items\/[A-Za-z0-9._:-]+$/u),
    raw_provider_url_present: z.literal(false),
  })
  .strict();
export type ExistingVimeoAdoptionResult = z.infer<typeof existingVimeoAdoptionResultSchema>;

export const existingVimeoUnpublishResultSchema = z
  .object({
    item_key: z.string().trim().min(3).max(180),
    state: z.literal('unpublished'),
    entitlements_revoked: z.literal(true),
    provider_mutation_performed: z.literal(false),
  })
  .strict();
export type ExistingVimeoUnpublishResult = z.infer<typeof existingVimeoUnpublishResultSchema>;

export const protectedVimeoPortalProjectionSchema = z
  .object({
    playback_route: z
      .string()
      .trim()
      .regex(/^\/app\/learning\/items\/[A-Za-z0-9._:-]+$/u),
    duration_ms: z.number().int().min(1),
    captions_active: z.boolean(),
    privacy_contract: z.literal('embed_only_domain_whitelist'),
    raw_provider_url_present: z.literal(false),
  })
  .strict();
export type ProtectedVimeoPortalProjection = z.infer<typeof protectedVimeoPortalProjectionSchema>;
