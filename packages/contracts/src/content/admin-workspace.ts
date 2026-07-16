import { z } from 'zod';

const isoStringSchema = z.string().datetime({ offset: true });
const nullableIsoStringSchema = isoStringSchema.nullable();
const idSchema = z.string().trim().min(1).max(180);
const safeTextSchema = z.string().trim().min(1).max(6_000);
const jsonRecordSchema = z.record(z.string(), z.unknown()).default({});
const contentAdminItemTypeSchema = z.enum(['video', 'sheet', 'source', 'review']);

export const contentAdminCapabilitySchema = z.enum([
  'content.view',
  'transcript.review',
  'artifact.generate',
  'artifact.edit',
  'artifact.publish',
  'prompt.manage',
  'social.approve',
  'social.schedule',
  'content.revoke',
]);
export type ContentAdminCapability = z.infer<typeof contentAdminCapabilitySchema>;

export const contentAdminLifecycleStageSchema = z.enum([
  'private_source',
  'vimeo_processing',
  'transcript_received',
  'transcript_review',
  'derivative_generation',
  'artifact_review',
  'published',
  'social_approval',
  'buffer_scheduled',
  'buffer_published',
  'failed',
  'retracted',
]);
export type ContentAdminLifecycleStage = z.infer<typeof contentAdminLifecycleStageSchema>;

export const contentAdminArtifactKindSchema = z.enum([
  'lesson_summary',
  'review_sheet',
  'worksheet',
  'newsletter_email',
  'social_caption',
  'short_clip_plan',
  'helper_knowledge',
  'classroom_resource',
]);
export type ContentAdminArtifactKind = z.infer<typeof contentAdminArtifactKindSchema>;

export const contentAdminProviderPortStatusSchema = z.object({
  port: z.enum(['vimeo', 'generation', 'knowledge_index', 'buffer', 'telegram']),
  mode: z.enum(['provider_off', 'sink', 'ready', 'degraded']),
  state: z.enum(['available', 'queued', 'unconfigured', 'blocked', 'error']),
  label: z.string().min(1).max(120),
  missing_variables: z.array(z.string().min(1).max(120)).max(20),
  can_mutate_provider: z.literal(false),
});
export type ContentAdminProviderPortStatus = z.infer<typeof contentAdminProviderPortStatusSchema>;

export const contentAdminSourceSummarySchema = z.object({
  source_key: idSchema,
  title: z.string().min(1).max(180),
  item_type: contentAdminItemTypeSchema,
  lifecycle_stage: contentAdminLifecycleStageSchema,
  provider_state: z.string().min(1).max(80),
  transcript_state: z.string().min(1).max(80),
  artifact_state: z.string().min(1).max(80),
  social_state: z.string().min(1).max(80),
  buffer_state: z.string().min(1).max(80),
  latest_revision_number: z.number().int().min(0),
  latest_revision_key: z.string().nullable(),
  published_revision_key: z.string().nullable(),
  artifact_counts: z.object({
    drafts: z.number().int().min(0),
    review_needed: z.number().int().min(0),
    approved: z.number().int().min(0),
    published: z.number().int().min(0),
  }),
  retry_eligible: z.boolean(),
  updated_at: isoStringSchema,
});
export type ContentAdminSourceSummary = z.infer<typeof contentAdminSourceSummarySchema>;

export const contentAdminOverviewResponseSchema = z.object({
  success: z.literal(true),
  capabilities: z.array(contentAdminCapabilitySchema),
  provider_ports: z.array(contentAdminProviderPortStatusSchema),
  counts: z.object({
    total_sources: z.number().int().min(0),
    processing: z.number().int().min(0),
    transcript_review: z.number().int().min(0),
    artifact_review: z.number().int().min(0),
    published: z.number().int().min(0),
    social_pending: z.number().int().min(0),
    buffer_pending: z.number().int().min(0),
    failed: z.number().int().min(0),
  }),
  sources: z.array(contentAdminSourceSummarySchema),
  page: z.object({
    page_size: z.number().int().min(1),
    next_cursor: z.string().nullable(),
  }),
});
export type ContentAdminOverviewResponse = z.infer<typeof contentAdminOverviewResponseSchema>;

export const contentAdminWorkspaceQuerySchema = z.object({
  search: z.string().trim().max(120).optional().default(''),
  lifecycle_stage: contentAdminLifecycleStageSchema.optional(),
  item_type: contentAdminItemTypeSchema.optional(),
  sort: z.enum(['updated_desc', 'updated_asc', 'title_asc']).optional().default('updated_desc'),
  cursor: z.string().trim().max(180).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});
export type ContentAdminWorkspaceQuery = z.infer<typeof contentAdminWorkspaceQuerySchema>;

export const contentAdminTranscriptRevisionSchema = z.object({
  revision_key: idSchema,
  revision_number: z.number().int().min(1),
  state: z.string().min(1).max(80),
  transcript_hash: z.string().min(16).max(128),
  summary: z.string().max(1_000),
  received_at: nullableIsoStringSchema,
  approved_at: nullableIsoStringSchema,
  conflict: z.boolean(),
});

export const contentAdminArtifactRevisionSchema = z.object({
  artifact_revision_key: idSchema,
  artifact_kind: contentAdminArtifactKindSchema,
  revision_number: z.number().int().min(1),
  review_state: z.enum([
    'draft',
    'review_needed',
    'approved',
    'published',
    'rejected',
    'superseded',
  ]),
  prompt_version_key: z.string().nullable(),
  prompt_version_checksum: z.string().nullable(),
  transcript_revision_key: z.string().nullable(),
  model_policy_id: z.string().nullable(),
  generation_run_key: z.string().nullable(),
  output_hash: z.string().min(16).max(128),
  publication_targets: z.array(z.string().min(1).max(80)).max(12),
  created_by_user_key: z.string().nullable(),
  created_at: isoStringSchema,
  updated_at: isoStringSchema,
});
export type ContentAdminArtifactRevision = z.infer<typeof contentAdminArtifactRevisionSchema>;

export const contentAdminSocialDraftSchema = z.object({
  draft_id: idSchema,
  source_key: idSchema,
  revision_id: z.string().nullable(),
  platform: z.enum(['linkedin', 'facebook', 'instagram', 'x']),
  workflow_state: z.string().min(1).max(80),
  exact_revision_required: z.literal(true),
  buffer_command_state: z.string().nullable(),
  scheduled_for: nullableIsoStringSchema,
  updated_at: isoStringSchema,
});
export type ContentAdminSocialDraft = z.infer<typeof contentAdminSocialDraftSchema>;

export const contentAdminKnowledgeSectionSchema = z.object({
  content_id: idSchema,
  version_id: idSchema,
  section_id: idSchema,
  title: z.string().min(1).max(180),
  readiness_state: z.enum(['indexed', 'waiting', 'revoked']),
  citation_count: z.number().int().min(0),
  entitlement_projection: z.enum(['published_entitled_only', 'not_projected']),
  updated_at: isoStringSchema,
});
export type ContentAdminKnowledgeSection = z.infer<typeof contentAdminKnowledgeSectionSchema>;

export const contentAdminActivityEventSchema = z.object({
  activity_key: idSchema,
  scope_key: z.string().nullable(),
  actor_user_key: z.string().nullable(),
  action_type: z.string().min(1).max(120),
  capability: contentAdminCapabilitySchema.nullable(),
  safe_metadata: jsonRecordSchema,
  created_at: isoStringSchema,
});
export type ContentAdminActivityEvent = z.infer<typeof contentAdminActivityEventSchema>;

export const contentAdminPromptVersionSchema = z.object({
  version_key: idSchema,
  template_key: idSchema,
  version_number: z.number().int().min(1),
  parent_version_key: z.string().nullable(),
  checksum: z.string().min(16).max(128),
  status: z.enum(['draft', 'active', 'retired']),
  reason: z.string().max(500),
  author_user_key: z.string().nullable(),
  activated_at: nullableIsoStringSchema,
  created_at: isoStringSchema,
});
export type ContentAdminPromptVersion = z.infer<typeof contentAdminPromptVersionSchema>;

export const contentAdminPromptTemplateSchema = z.object({
  template_key: idSchema,
  label: z.string().min(1).max(140),
  artifact_kind: contentAdminArtifactKindSchema,
  active_version_key: z.string().nullable(),
  versions: z.array(contentAdminPromptVersionSchema),
  updated_at: isoStringSchema,
});
export type ContentAdminPromptTemplate = z.infer<typeof contentAdminPromptTemplateSchema>;

export const contentAdminPromptListResponseSchema = z.object({
  success: z.literal(true),
  capabilities: z.array(contentAdminCapabilitySchema),
  templates: z.array(contentAdminPromptTemplateSchema),
});
export type ContentAdminPromptListResponse = z.infer<typeof contentAdminPromptListResponseSchema>;

export const contentAdminPromptPatchPayloadSchema = z.object({
  parent_version_key: idSchema,
  patch: z.object({
    find: z.string().trim().min(1).max(1_000),
    replace: z.string().trim().min(1).max(1_500),
  }),
  reason: z.string().trim().min(3).max(500),
});
export type ContentAdminPromptPatchPayload = z.infer<typeof contentAdminPromptPatchPayloadSchema>;

export const contentAdminPromptPreviewPayloadSchema = contentAdminPromptPatchPayloadSchema.extend({
  source_key: z.string().trim().max(180).optional(),
});
export type ContentAdminPromptPreviewPayload = z.infer<
  typeof contentAdminPromptPreviewPayloadSchema
>;

export const contentAdminPromptActivatePayloadSchema = z.object({
  version_key: idSchema,
  reason: z.string().trim().min(3).max(500),
});

export const contentAdminPromptRollbackPayloadSchema = z.object({
  target_version_key: idSchema,
  reason: z.string().trim().min(3).max(500),
});

export const contentAdminPromptMutationResponseSchema = z.object({
  success: z.literal(true),
  template: contentAdminPromptTemplateSchema,
  version: contentAdminPromptVersionSchema,
});
export type ContentAdminPromptMutationResponse = z.infer<
  typeof contentAdminPromptMutationResponseSchema
>;

export const contentAdminPromptPreviewResponseSchema = z.object({
  success: z.literal(true),
  preview: z.object({
    source_key: z.string().nullable(),
    parent_checksum: z.string().min(16).max(128),
    candidate_checksum: z.string().min(16).max(128),
    rendered_excerpt: z.string().min(1).max(1_500),
    can_publish: z.literal(false),
  }),
});
export type ContentAdminPromptPreviewResponse = z.infer<
  typeof contentAdminPromptPreviewResponseSchema
>;

export const contentAdminSourceDetailSchema = contentAdminSourceSummarySchema.extend({
  provider_ports: z.array(contentAdminProviderPortStatusSchema),
  transcript_revisions: z.array(contentAdminTranscriptRevisionSchema),
  artifact_revisions: z.array(contentAdminArtifactRevisionSchema),
  social_drafts: z.array(contentAdminSocialDraftSchema),
  knowledge_sections: z.array(contentAdminKnowledgeSectionSchema),
  activity: z.array(contentAdminActivityEventSchema),
});
export type ContentAdminSourceDetail = z.infer<typeof contentAdminSourceDetailSchema>;

export const contentAdminSourceDetailResponseSchema = z.object({
  success: z.literal(true),
  source: contentAdminSourceDetailSchema,
});
export type ContentAdminSourceDetailResponse = z.infer<
  typeof contentAdminSourceDetailResponseSchema
>;

export const contentAdminProcessingResponseSchema = z.object({
  success: z.literal(true),
  provider_ports: z.array(contentAdminProviderPortStatusSchema),
  items: z.array(contentAdminSourceSummarySchema),
});
export type ContentAdminProcessingResponse = z.infer<typeof contentAdminProcessingResponseSchema>;

export const contentAdminCreateWorkspaceResponseSchema = z.object({
  success: z.literal(true),
  provider_ports: z.array(contentAdminProviderPortStatusSchema),
  eligible_sources: z.array(contentAdminSourceSummarySchema),
  prompt_templates: z.array(contentAdminPromptTemplateSchema),
});
export type ContentAdminCreateWorkspaceResponse = z.infer<
  typeof contentAdminCreateWorkspaceResponseSchema
>;

export const contentAdminCreateGenerationPayloadSchema = z.object({
  source_key: idSchema,
  artifact_kind: contentAdminArtifactKindSchema,
  prompt_version_key: idSchema,
  reason: z.string().trim().min(3).max(500),
});
export type ContentAdminCreateGenerationPayload = z.infer<
  typeof contentAdminCreateGenerationPayloadSchema
>;

export const contentAdminCreateGenerationResponseSchema = z.object({
  success: z.literal(true),
  artifact: contentAdminArtifactRevisionSchema,
  provider_ports: z.array(contentAdminProviderPortStatusSchema),
});
export type ContentAdminCreateGenerationResponse = z.infer<
  typeof contentAdminCreateGenerationResponseSchema
>;

export const contentAdminSocialWorkspaceResponseSchema = z.object({
  success: z.literal(true),
  provider_ports: z.array(contentAdminProviderPortStatusSchema),
  drafts: z.array(contentAdminSocialDraftSchema),
});
export type ContentAdminSocialWorkspaceResponse = z.infer<
  typeof contentAdminSocialWorkspaceResponseSchema
>;

export const contentAdminKnowledgeResponseSchema = z.object({
  success: z.literal(true),
  provider_ports: z.array(contentAdminProviderPortStatusSchema),
  sections: z.array(contentAdminKnowledgeSectionSchema),
});
export type ContentAdminKnowledgeResponse = z.infer<typeof contentAdminKnowledgeResponseSchema>;

export const contentAdminActivityResponseSchema = z.object({
  success: z.literal(true),
  events: z.array(contentAdminActivityEventSchema),
});
export type ContentAdminActivityResponse = z.infer<typeof contentAdminActivityResponseSchema>;

export const contentAdminActionPayloadSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  expected_revision_key: z.string().trim().max(180).optional(),
});

export const contentAdminActionResponseSchema = z.object({
  success: z.literal(true),
  action: z.object({
    action_type: z.string().min(1).max(120),
    capability: contentAdminCapabilitySchema,
    provider_result: z.enum(['local_only', 'provider_off', 'sink_queued']),
    can_claim_provider_success: z.literal(false),
  }),
});
export type ContentAdminActionResponse = z.infer<typeof contentAdminActionResponseSchema>;

export const contentAdminSafeBodyPayloadSchema = z.object({
  body: safeTextSchema,
});
