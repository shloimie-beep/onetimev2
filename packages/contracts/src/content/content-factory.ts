import { z } from 'zod';

const idSchema = z
  .string()
  .trim()
  .min(3)
  .max(180)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]+$/);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const safeTextSchema = z.string().trim().max(12_000);
const normalizedTranscriptSchema = z.string().trim().max(250_000);

export const contentFactoryStateSchema = z.enum([
  'incoming',
  'processing',
  'transcribed',
  'rendered',
  'uploaded',
  'needs_review',
  'approved',
  'published',
  'failed',
]);
export type ContentFactoryState = z.infer<typeof contentFactoryStateSchema>;

export const contentFactoryTimelineStateSchema = z.enum([
  'received',
  'inspecting',
  'trimming',
  'transcribing',
  'drafting',
  'uploading',
  'review',
  'approved',
  'published',
  'failed',
]);
export type ContentFactoryTimelineState = z.infer<typeof contentFactoryTimelineStateSchema>;

export const contentFactorySourceKindSchema = z.enum(['drive', 'local_drop']);
export type ContentFactorySourceKind = z.infer<typeof contentFactorySourceKindSchema>;

export const contentFactoryVocabularyEntrySchema = z.object({
  term: z.string().trim().min(1).max(120),
  transcript_context: z.string().trim().min(1).max(600),
});
export type ContentFactoryVocabularyEntry = z.infer<typeof contentFactoryVocabularyEntrySchema>;

export const contentFactoryDraftSchema = z.object({
  title: z.string().trim().min(1).max(180),
  short_description: z.string().trim().max(1_200),
  class_label: z.string().trim().max(180).nullable(),
  class_date: z.string().date().nullable(),
  topics: z.array(z.string().trim().min(1).max(120)).max(20),
  mishnah_terms: z.array(z.string().trim().min(1).max(120)).max(30),
  review_questions: z.array(z.string().trim().min(3).max(600)).min(5).max(10),
  key_takeaways: z.array(z.string().trim().min(3).max(800)).min(3).max(5),
  vocabulary: z.array(contentFactoryVocabularyEntrySchema).max(20),
  draft_only: z.literal(true),
  authoritative_torah_interpretation: z.literal(false),
});
export type ContentFactoryDraft = z.infer<typeof contentFactoryDraftSchema>;

export const contentFactorySafeItemSchema = z.object({
  source_key: idSchema,
  source_kind: contentFactorySourceKindSchema,
  display_name: z.string().trim().min(1).max(240),
  state: contentFactoryStateSchema,
  is_demo: z.boolean(),
  occurrence: z
    .object({
      occurrence_key: idSchema,
      class_title: z.string().trim().min(1).max(240),
      class_date: z.string().date(),
    })
    .nullable(),
  processing_mode: z.enum(['synthetic', 'vimeo']),
  draft: contentFactoryDraftSchema,
  normalized_transcript: normalizedTranscriptSchema,
  transcript_review_state: z.enum(['draft', 'approved', 'rejected']),
  transcript_segment_count: z.number().int().min(0),
  transcription: z.object({
    provider: z.enum(['openai', 'synthetic']),
    model: z.string().trim().min(1).max(120),
    language: z.string().trim().min(1).max(24),
    transcript_sha256: sha256Schema,
    webvtt_sha256: sha256Schema,
  }),
  trim: z.object({
    original_duration_ms: z.number().int().min(0),
    prepared_duration_ms: z.number().int().min(0),
    start_ms: z.number().int().min(0),
    end_ms: z.number().int().min(0),
    removed_start_ms: z.number().int().min(0),
    removed_end_ms: z.number().int().min(0),
    confidence: z.number().min(0).max(1),
    safe_duration: z.boolean(),
    middle_cut_performed: z.literal(false),
  }),
  vimeo: z.object({
    provider: z.enum(['vimeo', 'synthetic']),
    privacy: z.enum(['private', 'unlisted', 'password', 'review_required']),
    captions_active: z.boolean(),
    provider_video_id_present: z.boolean(),
    provider_video_ref_digest: sha256Schema.nullable(),
    provider_text_track_ref_digest: sha256Schema.nullable(),
    raw_provider_url_present: z.literal(false),
  }),
  playback_route: z
    .string()
    .trim()
    .regex(/^\/app\/learning\/items\/[A-Za-z0-9._:-]+$/),
  progress_state: z.enum(['not_started', 'in_progress', 'completed']),
  retry_eligible: z.boolean(),
  last_safe_error_code: z.string().trim().max(160).nullable(),
  approved_at: z.string().datetime({ offset: true }).nullable(),
  published_at: z.string().datetime({ offset: true }).nullable(),
  unpublished_at: z.string().datetime({ offset: true }).nullable(),
  updated_at: z.string().datetime({ offset: true }),
});
export type ContentFactorySafeItem = z.infer<typeof contentFactorySafeItemSchema>;

export const contentFactoryIntakeSafeSchema = z.object({
  intake_key: idSchema,
  source_kind: contentFactorySourceKindSchema,
  display_name: z.string().trim().min(1).max(240),
  mime_type: z.string().trim().min(1).max(120),
  byte_length: z.number().int().positive(),
  state: contentFactoryTimelineStateSchema,
  occurrence: z
    .object({
      occurrence_key: idSchema,
      class_title: z.string().trim().min(1).max(240),
      class_date: z.string().date(),
    })
    .nullable(),
  class_label: z.string().trim().max(180).nullable(),
  class_date: z.string().date().nullable(),
  source_sha256: sha256Schema,
  private_ref_digest: sha256Schema,
  durable_locator_present: z.boolean(),
  idempotency_key_digest: sha256Schema.nullable(),
  raw_source_path_present: z.literal(false),
  raw_provider_url_present: z.literal(false),
  last_safe_error_code: z.string().trim().max(160).nullable(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
  retry_eligible: z.boolean(),
});
export type ContentFactoryIntakeSafe = z.infer<typeof contentFactoryIntakeSafeSchema>;

export const contentFactoryOccurrenceSchema = z.object({
  occurrence_key: idSchema,
  class_title: z.string().trim().min(1).max(240),
  class_date: z.string().date(),
  starts_at: z.string().datetime({ offset: true }),
  learner_count: z.number().int().min(0),
});
export type ContentFactoryOccurrence = z.infer<typeof contentFactoryOccurrenceSchema>;

export const contentFactoryWorkspaceResponseSchema = z.object({
  success: z.literal(true),
  input_adapter: z.enum(['DRIVE', 'LOCAL_DROP']),
  adapters: z.object({
    drive: z.object({
      ready: z.boolean(),
      missing: z.array(z.string().trim().min(1).max(120)).max(10),
    }),
    local_drop: z.object({ ready: z.literal(true), private_copy_required: z.literal(true) }),
  }),
  counts: z.record(contentFactoryStateSchema, z.number().int().min(0)),
  occurrences: z.array(contentFactoryOccurrenceSchema),
  intakes: z.array(contentFactoryIntakeSafeSchema),
  items: z.array(contentFactorySafeItemSchema),
});
export type ContentFactoryWorkspaceResponse = z.infer<typeof contentFactoryWorkspaceResponseSchema>;

export const contentFactoryEditPayloadSchema = z
  .object({
    title: z.string().trim().min(1).max(180).optional(),
    short_description: z.string().trim().max(1_200).optional(),
    class_label: z.string().trim().max(180).nullable().optional(),
    class_date: z.string().date().nullable().optional(),
    topics: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
    mishnah_terms: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
    review_questions: z.array(z.string().trim().min(3).max(600)).min(5).max(10).optional(),
    key_takeaways: z.array(z.string().trim().min(3).max(800)).min(3).max(5).optional(),
    vocabulary: z.array(contentFactoryVocabularyEntrySchema).max(20).optional(),
    normalized_transcript: normalizedTranscriptSchema.optional(),
    occurrence_key: idSchema.optional(),
  })
  .strict();
export type ContentFactoryEditPayload = z.infer<typeof contentFactoryEditPayloadSchema>;

export const contentFactoryActionSchema = z.enum(['approve', 'publish', 'unpublish', 'retry']);
export type ContentFactoryAction = z.infer<typeof contentFactoryActionSchema>;

export const contentFactoryMutationResponseSchema = z.object({
  success: z.literal(true),
  item: contentFactorySafeItemSchema,
});

export const contentFactoryIntakeResponseSchema = z.object({
  success: z.literal(true),
  intake: contentFactoryIntakeSafeSchema,
});

export const contentFactoryPortalProjectionSchema = z.object({
  occurrence_key: idSchema,
  class_title: z.string().trim().min(1).max(240),
  class_date: z.string().date(),
  approved_summary: z.string().trim().max(1_200),
  approved_review_questions: z.array(z.string().trim().min(3).max(600)).min(5).max(10),
  captions_active: z.literal(true),
  progress_state: z.enum(['not_started', 'in_progress', 'completed']),
  playback_route: z
    .string()
    .trim()
    .regex(/^\/app\/learning\/items\/[A-Za-z0-9._:-]+$/),
  raw_provider_url_present: z.literal(false),
  is_demo: z.boolean(),
});
export type ContentFactoryPortalProjection = z.infer<typeof contentFactoryPortalProjectionSchema>;
