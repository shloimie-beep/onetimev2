import { z } from 'zod';
import { ot86ApprovedForSocialEventSchema } from '../content/index.ts';

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

const uuidSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

const dateTimeSchema = z.string().datetime({ offset: true });

export const ot86bSocialPlatformSchema = z.enum(['linkedin', 'facebook', 'instagram', 'x']);
export type Ot86bSocialPlatform = z.infer<typeof ot86bSocialPlatformSchema>;

export const ot86bSocialWorkflowStateSchema = z.enum([
  'draft_generated',
  'review_needed',
  'approved',
  'scheduled',
  'publishing',
  'published',
  'failed',
  'correction_needed',
  'retraction_requested',
  'retracted',
  'retraction_manual_required',
  'cancelled',
]);
export type Ot86bSocialWorkflowState = z.infer<typeof ot86bSocialWorkflowStateSchema>;

export const ot86bPrivacySchema = z
  .object({
    contains_learner_name: z.literal(false),
    contains_learner_voice: z.literal(false),
    contains_learner_face: z.literal(false),
    contains_learner_question: z.literal(false),
    contains_private_data: z.literal(false),
    scan_status: z.literal('passed'),
  })
  .strict();
export type Ot86bPrivacy = z.infer<typeof ot86bPrivacySchema>;

export const ot86bSocialDraftRevisionSchema = z
  .object({
    schema_version: z.literal(1),
    draft_id: idSchema,
    revision_id: idSchema,
    supersedes_revision_id: idSchema.optional(),
    source_event_id: uuidSchema,
    tenant_id: idSchema,
    content_id: idSchema,
    version_id: idSchema,
    platform: ot86bSocialPlatformSchema,
    renderer_version: z.string().min(1).max(64),
    text: z.string().min(1).max(10_000),
    hashtags: z
      .array(z.string().regex(/^#[^\s#]{1,80}$/))
      .max(30)
      .refine((value) => new Set(value).size === value.length, 'hashtags must be unique'),
    media: z
      .array(
        z
          .object({
            asset_id: idSchema,
            uri: z.string().url().max(2048),
            mime_type: z.string().min(3).max(128),
            sha256: sha256Schema,
            subject_classification: z.enum(['no_people', 'rabbi_only', 'graphics_only']),
            privacy: ot86bPrivacySchema,
          })
          .strict(),
      )
      .max(20),
    source_excerpt_ids: z.array(idSchema).min(1).max(50),
    privacy: ot86bPrivacySchema,
    revision_sha256: sha256Schema,
    created_at: dateTimeSchema,
  })
  .strict();
export type Ot86bSocialDraftRevision = z.infer<typeof ot86bSocialDraftRevisionSchema>;

export const ot86bBufferPublishCommandSchema = z
  .object({
    schema_version: z.literal(1),
    command_id: uuidSchema,
    idempotency_key: z
      .string()
      .min(16)
      .max(180)
      .regex(/^[A-Za-z0-9._:-]+$/),
    tenant_id: idSchema,
    draft_id: idSchema,
    revision_id: idSchema,
    revision_sha256: sha256Schema,
    approval: z
      .object({
        approval_id: idSchema,
        approved_by_actor_id: idSchema,
        approved_at: dateTimeSchema,
        policy_version: z.string().min(1).max(64),
        approved_revision_sha256: sha256Schema,
      })
      .strict(),
    destination: z
      .object({
        provider: z.literal('buffer'),
        organization_id: idSchema,
        destination_id: idSchema,
        platform: ot86bSocialPlatformSchema,
        capability_version: z.string().min(1).max(64),
      })
      .strict(),
    scheduled_for: dateTimeSchema,
    timezone: z.string().min(1).max(64),
    privacy: ot86bPrivacySchema,
    audit_correlation_id: idSchema,
    created_at: dateTimeSchema,
  })
  .strict();
export type Ot86bBufferPublishCommand = z.infer<typeof ot86bBufferPublishCommandSchema>;

export const ot86bApprovedForSocialEventSchema = ot86ApprovedForSocialEventSchema;
export type Ot86bApprovedForSocialEvent = z.infer<typeof ot86bApprovedForSocialEventSchema>;

export const ot86bBufferReadinessStateSchema = z.enum([
  'unconfigured',
  'auth_invalid',
  'organization_missing',
  'destinations_missing',
  'ready',
  'degraded',
]);
export type Ot86bBufferReadinessState = z.infer<typeof ot86bBufferReadinessStateSchema>;

export const ot86bDestinationCapabilitySchema = z
  .object({
    provider: z.literal('buffer'),
    organization_id: idSchema,
    destination_id: idSchema,
    label: z.string().min(1).max(120),
    platform: ot86bSocialPlatformSchema,
    timezone: z.string().min(1).max(64),
    capability_version: z.string().min(1).max(64),
    supports_update: z.boolean(),
    supports_delete: z.boolean(),
    max_text_length: z.number().int().min(1).max(10_000),
    media_required: z.boolean(),
  })
  .strict();
export type Ot86bDestinationCapability = z.infer<typeof ot86bDestinationCapabilitySchema>;

export const ot86bBufferReadinessSchema = z
  .object({
    provider: z.literal('buffer'),
    state: ot86bBufferReadinessStateSchema,
    missing_capability_classes: z.array(z.string().min(1).max(120)),
    destinations: z.array(ot86bDestinationCapabilitySchema),
    can_schedule: z.boolean(),
    safe_reason_code: z.string().min(1).max(120),
  })
  .strict();
export type Ot86bBufferReadiness = z.infer<typeof ot86bBufferReadinessSchema>;

export const ot86bSocialDraftListItemSchema = z
  .object({
    draft_id: idSchema,
    source_id: idSchema,
    tenant_id: idSchema,
    content_id: idSchema,
    version_id: idSchema,
    platform: ot86bSocialPlatformSchema,
    workflow_state: ot86bSocialWorkflowStateSchema,
    current_revision_id: idSchema.nullable(),
    updated_at: dateTimeSchema,
  })
  .strict();
export type Ot86bSocialDraftListItem = z.infer<typeof ot86bSocialDraftListItemSchema>;

export const ot86bSocialDraftListResponseSchema = z
  .object({
    success: z.literal(true),
    drafts: z.array(ot86bSocialDraftListItemSchema),
    next_cursor: z.null(),
  })
  .strict();

export const ot86bReadinessResponseSchema = z
  .object({
    success: z.literal(true),
    readiness: ot86bBufferReadinessSchema,
  })
  .strict();
