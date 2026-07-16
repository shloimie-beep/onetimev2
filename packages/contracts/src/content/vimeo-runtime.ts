import { z } from 'zod';

const idSchema = z
  .string()
  .trim()
  .min(3)
  .max(180)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]+$/);

const sha256Schema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{64}$/);

export const ot104rScopeSchema = z
  .object({
    account_key: z.literal('rabbi_sheller_provider'),
    product_key: z.literal('one_time_mishnah_class'),
  })
  .strict();
export type Ot104rScope = z.infer<typeof ot104rScopeSchema>;

export const ot104rVimeoProviderModeSchema = z.enum(['off', 'sink', 'real']);
export type Ot104rVimeoProviderMode = z.infer<typeof ot104rVimeoProviderModeSchema>;

export const ot104rVimeoReadinessStateSchema = z.enum([
  'off',
  'unconfigured',
  'degraded',
  'ready',
  'auth_invalid',
  'permission_missing',
  'fixture_missing',
]);
export type Ot104rVimeoReadinessState = z.infer<typeof ot104rVimeoReadinessStateSchema>;

export const ot104rVimeoReadinessSchema = z
  .object({
    provider: z.literal('vimeo'),
    mode: ot104rVimeoProviderModeSchema,
    state: ot104rVimeoReadinessStateSchema,
    configured: z.boolean(),
    can_register_existing_private_video: z.boolean(),
    can_create_controlled_upload: z.boolean(),
    can_receive_webhooks: z.boolean(),
    can_import_text_tracks: z.boolean(),
    missing_variable_names: z.array(z.string().min(1).max(120)).max(30),
    capability_names: z.array(z.string().min(1).max(120)).max(30),
    safe_reason_code: z.string().min(1).max(120),
  })
  .strict();
export type Ot104rVimeoReadiness = z.infer<typeof ot104rVimeoReadinessSchema>;

export const ot104rVimeoRegistrationModeSchema = z.enum([
  'existing_private_video',
  'controlled_upload',
]);
export type Ot104rVimeoRegistrationMode = z.infer<typeof ot104rVimeoRegistrationModeSchema>;

export const ot104rVimeoProcessingStateSchema = z.enum([
  'registered',
  'upload_authorized',
  'uploading',
  'transcoding',
  'available',
  'transcript_ready',
  'failed',
  'retry_wait',
  'dead_lettered',
  'retired',
]);
export type Ot104rVimeoProcessingState = z.infer<typeof ot104rVimeoProcessingStateSchema>;

export const ot104rVimeoPrivacyStateSchema = z.enum([
  'private',
  'unlisted',
  'password',
  'review_required',
]);
export type Ot104rVimeoPrivacyState = z.infer<typeof ot104rVimeoPrivacyStateSchema>;

export const ot104rVimeoRegisterCommandSchema = ot104rScopeSchema
  .extend({
    idempotency_key: idSchema,
    content_id: idSchema,
    source_record_id: idSchema,
    title: z.string().trim().min(1).max(240),
    source_sha256: sha256Schema,
    byte_length: z.number().int().min(0).nullable().optional(),
    submitted_by_actor_id: idSchema,
    registration_mode: ot104rVimeoRegistrationModeSchema,
    provider_video_id: z.string().trim().min(1).max(128).optional(),
    upload_filename: z.string().trim().min(1).max(240).optional(),
    upload_size_bytes: z
      .number()
      .int()
      .min(1)
      .max(100 * 1024 * 1024 * 1024)
      .optional(),
    correlation_id: idSchema,
  })
  .strict()
  .superRefine((command, ctx) => {
    if (command.registration_mode === 'existing_private_video' && !command.provider_video_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['provider_video_id'],
        message: 'Existing private Vimeo registration requires provider_video_id.',
      });
    }
    if (command.registration_mode === 'controlled_upload') {
      if (!command.upload_filename) {
        ctx.addIssue({
          code: 'custom',
          path: ['upload_filename'],
          message: 'Controlled upload registration requires upload_filename.',
        });
      }
      if (!command.upload_size_bytes) {
        ctx.addIssue({
          code: 'custom',
          path: ['upload_size_bytes'],
          message: 'Controlled upload registration requires upload_size_bytes.',
        });
      }
    }
  });
export type Ot104rVimeoRegisterCommand = z.infer<typeof ot104rVimeoRegisterCommandSchema>;

export const ot104rVimeoRegistrationResultSchema = z
  .object({
    duplicate: z.boolean(),
    source_key: idSchema,
    content_id: idSchema,
    account_key: z.literal('rabbi_sheller_provider'),
    product_key: z.literal('one_time_mishnah_class'),
    registration_mode: ot104rVimeoRegistrationModeSchema,
    processing_state: ot104rVimeoProcessingStateSchema,
    privacy_state: ot104rVimeoPrivacyStateSchema,
    provider_video_id_present: z.boolean(),
    provider_upload_id_present: z.boolean(),
    provider_video_ref_digest: sha256Schema.nullable(),
    provider_upload_ref_digest: sha256Schema.nullable(),
    safe_upload_ticket_ref: z.string().min(1).max(120).nullable(),
    safe_reason_code: z.string().min(1).max(120),
  })
  .strict();
export type Ot104rVimeoRegistrationResult = z.infer<typeof ot104rVimeoRegistrationResultSchema>;

export const ot104rPlaybackProjectionSchema = z
  .object({
    source_key: idSchema,
    content_id: idSchema,
    account_key: z.literal('rabbi_sheller_provider'),
    product_key: z.literal('one_time_mishnah_class'),
    status: ot104rVimeoProcessingStateSchema,
    playback_kind: z.literal('server_authorized_vimeo_playback'),
    playback_route: z.string().regex(/^\/api\/v1\/content\/vimeo\/[A-Za-z0-9._:-]+\/playback$/),
    provider_video_id_present: z.boolean(),
    expires_at: z.string().datetime({ offset: true }),
  })
  .strict();
export type Ot104rPlaybackProjection = z.infer<typeof ot104rPlaybackProjectionSchema>;
