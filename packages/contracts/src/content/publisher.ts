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

const dateTimeSchema = z.string().datetime({ offset: true });

export const ot109ScopeSchema = z
  .object({
    account_key: z.literal('rabbi_sheller_provider'),
    product_key: z.literal('one_time_mishnah_class'),
  })
  .strict();
export type Ot109Scope = z.infer<typeof ot109ScopeSchema>;

export const ot109SourceKindSchema = z.enum([
  'uploaded_file',
  'protected_drive_file',
  'private_vimeo_reference',
]);
export type Ot109SourceKind = z.infer<typeof ot109SourceKindSchema>;

export const ot109PublisherStateSchema = z.enum([
  'source_registered',
  'awaiting_media_intake',
  'media_intake_processing',
  'vimeo_reference_accepted',
  'transcoding',
  'awaiting_transcript',
  'transcript_processing',
  'transcript_ready_unapproved',
  'derivatives_generated',
  'human_review_required',
  'approved_for_library',
  'approved_for_helper',
  'approved_for_social',
  'published',
  'retryable_failure',
  'blocked',
  'dead_lettered',
]);
export type Ot109PublisherState = z.infer<typeof ot109PublisherStateSchema>;

export const ot109ArtifactKindSchema = z.enum([
  'library',
  'helper',
  'social',
  'review_sheet',
  'classroom_resource',
]);
export type Ot109ArtifactKind = z.infer<typeof ot109ArtifactKindSchema>;

export const ot109ReviewDecisionSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'regenerate_requested',
]);
export type Ot109ReviewDecision = z.infer<typeof ot109ReviewDecisionSchema>;

export const ot109TranscriptSegmentSchema = z
  .object({
    segment_id: idSchema,
    start_ms: z.number().int().min(0),
    end_ms: z.number().int().min(0),
    speaker: z.string().trim().max(120).nullable().default(null),
    text: z.string().trim().min(1).max(8000),
  })
  .strict()
  .superRefine((segment, ctx) => {
    if (segment.end_ms < segment.start_ms) {
      ctx.addIssue({
        code: 'custom',
        path: ['end_ms'],
        message: 'end_ms must be greater than or equal to start_ms.',
      });
    }
  });
export type Ot109TranscriptSegment = z.infer<typeof ot109TranscriptSegmentSchema>;

export const ot109RegisterSourceInputSchema = z
  .object({
    idempotency_key: idSchema,
    source_kind: ot109SourceKindSchema,
    source_reference: z.string().trim().min(3).max(500),
    source_sha256: sha256Schema,
    original_name: z.string().trim().max(240).nullable().optional(),
    byte_length: z.number().int().min(0).nullable().optional(),
    submitted_by_actor_id: idSchema,
    provenance: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
export type Ot109RegisterSourceInput = z.infer<typeof ot109RegisterSourceInputSchema>;

export const ot109DerivativeDraftSchema = z
  .object({
    schema_version: z.literal(1),
    source_key: idSchema,
    transcript_key: idSchema,
    version_key: idSchema,
    lesson_summary: z.string().min(1).max(2000),
    searchable_chunks: z
      .array(
        z
          .object({
            chunk_id: idSchema,
            title: z.string().min(1).max(180),
            start_ms: z.number().int().min(0),
            end_ms: z.number().int().min(0),
            text: z.string().min(1).max(8000),
            text_sha256: sha256Schema,
          })
          .strict(),
      )
      .min(1)
      .max(500),
    review_sheet: z
      .object({
        title: z.string().min(1).max(180),
        key_questions: z.array(z.string().min(1).max(500)).min(1).max(20),
        key_concepts: z.array(z.string().min(1).max(240)).min(1).max(40),
      })
      .strict(),
    helper_chunks: z
      .array(
        z
          .object({
            chunk_id: idSchema,
            answer_seed: z.string().min(1).max(1200),
            citation_start_ms: z.number().int().min(0),
            citation_end_ms: z.number().int().min(0),
            source_sha256: sha256Schema,
          })
          .strict(),
      )
      .min(1)
      .max(500),
    social_proposals: z
      .array(
        z
          .object({
            proposal_id: idSchema,
            caption: z.string().min(1).max(2200),
            clip_start_ms: z.number().int().min(0),
            clip_end_ms: z.number().int().min(0),
            provenance_chunk_ids: z.array(idSchema).min(1).max(20),
          })
          .strict(),
      )
      .max(20),
    classroom_resource_linkage: z
      .object({
        resource_key: idSchema,
        suggested_title: z.string().min(1).max(180),
        material_type: z.enum(['video_lesson', 'review_sheet', 'knowledge_chunk']),
      })
      .strict(),
    privacy: z
      .object({
        contains_learner_name: z.literal(false),
        contains_learner_voice: z.literal(false),
        contains_learner_face: z.literal(false),
        contains_learner_question: z.literal(false),
        contains_private_data: z.literal(false),
      })
      .strict(),
    draft_sha256: sha256Schema,
  })
  .strict();
export type Ot109DerivativeDraft = z.infer<typeof ot109DerivativeDraftSchema>;

export const ot109SourceSummarySchema = z
  .object({
    source_key: idSchema,
    state: ot109PublisherStateSchema,
    source_kind: ot109SourceKindSchema,
    source_sha256: sha256Schema,
    current_transcript_key: idSchema.nullable(),
    current_version_key: idSchema.nullable(),
    safe_reason_code: z.string().nullable(),
    retry_count: z.number().int().min(0),
    created_at: dateTimeSchema,
    updated_at: dateTimeSchema,
  })
  .strict();
export type Ot109SourceSummary = z.infer<typeof ot109SourceSummarySchema>;

export const ot109KnowledgeRetrievalResponseSchema = z
  .object({
    answer: z.string().min(1).max(2400),
    abstained: z.boolean(),
    safe_reason_code: z.string().min(1).max(80),
    citations: z
      .array(
        z
          .object({
            source_key: idSchema,
            version_key: idSchema,
            chunk_id: idSchema,
            start_ms: z.number().int().min(0),
            end_ms: z.number().int().min(0),
            source_sha256: sha256Schema,
          })
          .strict(),
      )
      .max(10),
    correlation_id: idSchema,
  })
  .strict();
export type Ot109KnowledgeRetrievalResponse = z.infer<typeof ot109KnowledgeRetrievalResponseSchema>;
