import { z } from 'zod';

const idSchema = z
  .string()
  .trim()
  .min(3)
  .max(180)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]+$/);

const uuidSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

const sha256Schema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{64}$/);

const utcDateTimeSchema = z
  .string()
  .datetime({ offset: true })
  .refine((value) => value.endsWith('Z'), 'Timestamp must be UTC and end with Z.');

export const ot106PlatformSchema = z.enum([
  'facebook',
  'instagram',
  'linkedin',
  'x',
  'youtube',
  'threads',
  'tiktok',
  'pinterest',
  'bluesky',
  'mastodon',
  'google_business',
]);
export type Ot106Platform = z.infer<typeof ot106PlatformSchema>;

export const ot106PublicationModeSchema = z.enum(['draft', 'scheduled']);
export type Ot106PublicationMode = z.infer<typeof ot106PublicationModeSchema>;

export const ot106ProviderModeSchema = z.enum([
  'disabled',
  'sink',
  'buffer_draft',
  'buffer_scheduled',
]);
export type Ot106ProviderMode = z.infer<typeof ot106ProviderModeSchema>;

export const ot106PublicationStateSchema = z.enum([
  'received',
  'validated',
  'awaiting_approval',
  'queued',
  'provider_draft_created',
  'scheduled',
  'sent',
  'retryable_failure',
  'dead_lettered',
  'canceled',
]);
export type Ot106PublicationState = z.infer<typeof ot106PublicationStateSchema>;

export const ot106PrivacySchema = z
  .object({
    source_scope: z.literal('approved_one_time_social_derivative'),
    contains_learner_name: z.literal(false),
    contains_learner_voice: z.literal(false),
    contains_learner_face: z.literal(false),
    contains_learner_question: z.literal(false),
    contains_private_data: z.literal(false),
    approved_for_social: z.literal(true),
  })
  .strict();
export type Ot106Privacy = z.infer<typeof ot106PrivacySchema>;

export const ot106PublicSafetySchema = z
  .object({
    stable_https_url: z.literal(true),
    direct_public_url: z.literal(true),
    not_signed_or_expiring: z.literal(true),
    no_authentication_required: z.literal(true),
    privacy_review_passed: z.literal(true),
  })
  .strict();
export type Ot106PublicSafety = z.infer<typeof ot106PublicSafetySchema>;

export const ot106MediaDerivativeSchema = z
  .object({
    derivative_id: idSchema,
    kind: z.enum(['image', 'video']),
    url: z.string().url().max(2048),
    mime_type: z
      .string()
      .min(3)
      .max(120)
      .regex(/^(image|video)\//),
    sha256: sha256Schema,
    byte_length: z.number().int().min(1).max(2_000_000_000),
    alt_text: z.string().trim().max(300).optional(),
    subject_classification: z.enum(['no_people', 'rabbi_only', 'graphics_only']),
    privacy: ot106PrivacySchema,
    public_safety: ot106PublicSafetySchema,
  })
  .strict();
export type Ot106MediaDerivative = z.infer<typeof ot106MediaDerivativeSchema>;

export const ot106TargetAliasSchema = z
  .object({
    alias: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z][a-z0-9._:-]+$/),
    platform: ot106PlatformSchema.optional(),
  })
  .strict();
export type Ot106TargetAlias = z.infer<typeof ot106TargetAliasSchema>;

export const ot106RuntimeAuthorizationSchema = z
  .object({
    authorization_id: idSchema,
    authorized_by_actor_id: idSchema,
    authorized_at: utcDateTimeSchema,
    authorization_phrase: z.literal('APPROVE_OT106_BUFFER_SCHEDULE'),
  })
  .strict();
export type Ot106RuntimeAuthorization = z.infer<typeof ot106RuntimeAuthorizationSchema>;

export const ot106PublicationManifestSchema = z
  .object({
    schema_version: z.literal(1),
    event_type: z.literal('ot106.social_publication_manifest'),
    manifest_id: uuidSchema,
    idempotency_key: z
      .string()
      .trim()
      .min(16)
      .max(180)
      .regex(/^[A-Za-z0-9._:-]+$/),
    account_key: idSchema,
    product_key: idSchema,
    source: z
      .object({
        pipeline: z.literal('one_time_content_pipeline'),
        content_id: idSchema,
        derivative_batch_id: idSchema,
        source_sha256: sha256Schema,
        provenance_url: z.string().url().max(2048).optional(),
      })
      .strict(),
    caption: z
      .object({
        text: z.string().trim().min(1).max(10_000),
        hashtags: z
          .array(z.string().regex(/^#[^\s#]{1,80}$/))
          .max(30)
          .default([]),
      })
      .strict(),
    targets: z.array(ot106TargetAliasSchema).min(1).max(20),
    mode: ot106PublicationModeSchema,
    due_at_utc: utcDateTimeSchema.optional(),
    approval: z
      .object({
        approval_id: idSchema,
        approved_by_actor_id: idSchema,
        approved_by_role: z.enum(['owner', 'admin']),
        approved_at: utcDateTimeSchema,
        policy_version: z.string().trim().min(1).max(80),
      })
      .strict(),
    runtime_authorization: ot106RuntimeAuthorizationSchema.optional(),
    media: z.array(ot106MediaDerivativeSchema).max(10).default([]),
    privacy: ot106PrivacySchema,
    checksum_algorithm: z.literal('sha256'),
    manifest_sha256: sha256Schema,
    created_at: utcDateTimeSchema,
  })
  .strict()
  .superRefine((manifest, ctx) => {
    const aliases = manifest.targets.map((target) => target.alias);
    if (new Set(aliases).size !== aliases.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['targets'],
        message: 'Target aliases must be unique.',
      });
    }
    if (manifest.mode === 'scheduled') {
      if (!manifest.due_at_utc) {
        ctx.addIssue({
          code: 'custom',
          path: ['due_at_utc'],
          message: 'Scheduled manifests require due_at_utc.',
        });
      }
      if (!manifest.runtime_authorization) {
        ctx.addIssue({
          code: 'custom',
          path: ['runtime_authorization'],
          message: 'Scheduled manifests require explicit runtime authorization.',
        });
      }
    }
  });
export type Ot106PublicationManifest = z.infer<typeof ot106PublicationManifestSchema>;

export const ot106BufferChannelBindingSchema = z
  .object({
    alias: ot106TargetAliasSchema.shape.alias,
    platform: ot106PlatformSchema,
    organization_id: idSchema,
    channel_id: idSchema,
    label: z.string().trim().min(1).max(120),
    timezone: z.string().trim().min(1).max(80).default('UTC'),
  })
  .strict();
export type Ot106BufferChannelBinding = z.infer<typeof ot106BufferChannelBindingSchema>;

export const ot106ReadinessSchema = z
  .object({
    provider: z.literal('buffer'),
    mode: ot106ProviderModeSchema,
    state: z.enum([
      'disabled',
      'sink_ready',
      'unconfigured',
      'auth_invalid',
      'organization_missing',
      'channels_missing',
      'ready_read_only',
      'ready_to_create_drafts',
      'ready_to_schedule',
      'degraded',
    ]),
    can_create_draft: z.boolean(),
    can_schedule: z.boolean(),
    missing_capability_classes: z.array(z.string().min(1).max(120)),
    channels: z.array(
      z
        .object({
          alias: z.string().min(1).max(80),
          platform: ot106PlatformSchema,
          channel_fingerprint: z.string().min(8).max(64),
          label: z.string().min(1).max(120),
        })
        .strict(),
    ),
    safe_reason_code: z.string().min(1).max(120),
  })
  .strict();
export type Ot106Readiness = z.infer<typeof ot106ReadinessSchema>;
