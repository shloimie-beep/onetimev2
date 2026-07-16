import { z } from 'zod';
export * from './pipeline.ts';
export * from './vimeo-runtime.ts';
export * from './publisher.ts';

export const contentLifecycleStateSchema = z.enum([
  'received',
  'transcribing',
  'processing',
  'review_needed',
  'published',
  'failed',
  'superseded',
]);
export type ContentLifecycleState = z.infer<typeof contentLifecycleStateSchema>;

export const contentItemTypeSchema = z.enum(['video', 'sheet', 'source', 'review']);
export type ContentItemType = z.infer<typeof contentItemTypeSchema>;

const contentMetadataSchema = z.record(z.string(), z.unknown()).default({});

export const contentOutcomePayloadSchema = z.object({
  idempotency_key: z.string().trim().min(8).max(160),
  item_key: z.string().trim().min(3).max(180),
  title: z.string().trim().min(1).max(180),
  item_type: contentItemTypeSchema,
  occurrence_key: z.string().trim().min(3).max(180).nullable().optional().default(null),
  revision_number: z.coerce.number().int().min(1).max(1_000_000),
  lifecycle_state: contentLifecycleStateSchema.default('received'),
  entitlement_scope: z
    .enum(['none', 'all_active_learners'])
    .optional()
    .default('all_active_learners'),
  transcript_metadata: contentMetadataSchema,
  source_metadata: contentMetadataSchema,
  review_sheet_metadata: contentMetadataSchema,
  playback_metadata: contentMetadataSchema,
  provider_event_ref: z.string().trim().max(500).optional(),
  source_ref: z.string().trim().max(500).optional(),
});
export type ContentOutcomePayload = z.infer<typeof contentOutcomePayloadSchema>;

export const contentLibraryListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  lifecycle_state: contentLifecycleStateSchema.optional(),
  item_type: contentItemTypeSchema.optional(),
  occurrence_key: z.string().trim().min(3).max(180).optional(),
});
export type ContentLibraryListQuery = z.infer<typeof contentLibraryListQuerySchema>;

export const contentLibraryItemSummarySchema = z.object({
  item_key: z.string().min(1),
  title: z.string().min(1).max(180),
  item_type: contentItemTypeSchema,
  lifecycle_state: contentLifecycleStateSchema,
  occurrence_key: z.string().nullable(),
  latest_revision_number: z.number().int().min(0),
  latest_revision_key: z.string().nullable(),
  published_revision_key: z.string().nullable(),
  published_at: z.string().nullable(),
  updated_at: z.string(),
});
export type ContentLibraryItemSummary = z.infer<typeof contentLibraryItemSummarySchema>;

export const contentRevisionSummarySchema = z.object({
  revision_key: z.string().min(1),
  revision_number: z.number().int().min(1),
  lifecycle_state: contentLifecycleStateSchema,
  metadata: z.object({
    transcript_metadata: z.record(z.string(), z.unknown()),
    source_metadata: z.record(z.string(), z.unknown()),
    review_sheet_metadata: z.record(z.string(), z.unknown()),
    playback_descriptor: z.record(z.string(), z.unknown()),
  }),
  raw_provider_target_present: z.literal(false),
  published_at: z.string().nullable(),
  failed_at: z.string().nullable(),
  superseded_at: z.string().nullable(),
  created_at: z.string(),
});
export type ContentRevisionSummary = z.infer<typeof contentRevisionSummarySchema>;

export const contentLibraryItemDetailSchema = contentLibraryItemSummarySchema.extend({
  revisions: z.array(contentRevisionSummarySchema).max(10),
});
export type ContentLibraryItemDetail = z.infer<typeof contentLibraryItemDetailSchema>;

export const contentAdmissionStateSchema = z.enum(['accepted', 'replayed', 'ignored_stale']);
export type ContentAdmissionState = z.infer<typeof contentAdmissionStateSchema>;

export const contentOutcomeAdmissionSchema = z.object({
  admission_state: contentAdmissionStateSchema,
  item_key: z.string().min(1),
  revision_key: z.string().min(1),
  revision_number: z.number().int().min(1),
  lifecycle_state: contentLifecycleStateSchema,
  raw_provider_target_present: z.literal(false),
  redaction_count: z.number().int().min(0),
  item: contentLibraryItemDetailSchema,
});
export type ContentOutcomeAdmission = z.infer<typeof contentOutcomeAdmissionSchema>;

export const contentLibraryListResponseSchema = z.object({
  success: z.literal(true),
  items: z.array(contentLibraryItemSummarySchema),
  next_cursor: z.null(),
});

export const contentLibraryDetailResponseSchema = z.object({
  success: z.literal(true),
  item: contentLibraryItemDetailSchema,
});

export const contentOutcomeAdmissionResponseSchema = z.object({
  success: z.literal(true),
  outcome: contentOutcomeAdmissionSchema,
});
