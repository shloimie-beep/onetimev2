import { z } from 'zod';

export const LEARNING_DELIVERY_ACCOUNT_KEY = 'rabbi_sheller_provider';
export const LEARNING_DELIVERY_PRODUCT_KEY = 'one_time_mishnah_class';

export const learningDeliveryWorkspaceSchema = z.object({
  account_key: z.literal(LEARNING_DELIVERY_ACCOUNT_KEY),
  product_key: z.literal(LEARNING_DELIVERY_PRODUCT_KEY),
});
export type LearningDeliveryWorkspace = z.infer<typeof learningDeliveryWorkspaceSchema>;

export const learningDeliveryMediaStateSchema = z.enum([
  'discovered',
  'downloading',
  'probing',
  'transcribing',
  'transcript_ready',
  'trim_review',
  'rendering',
  'vimeo_uploading',
  'vimeo_processing',
  'content_review',
  'ready_to_publish',
  'published',
  'failed',
]);
export type LearningDeliveryMediaState = z.infer<typeof learningDeliveryMediaStateSchema>;

export const learningDeliverySourceKindSchema = z.enum([
  'drive_recording',
  'uploaded_file',
  'zoom_cloud_recording',
  'private_vimeo_reference',
]);
export type LearningDeliverySourceKind = z.infer<typeof learningDeliverySourceKindSchema>;

export const learningDeliveryDriveFileMetadataSchema = z.object({
  source_kind: z.literal('drive_recording'),
  provider_file_id_digest: z.string().regex(/^[a-f0-9]{64}$/),
  parent_folder_digest: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
  display_name: z.string().trim().min(1).max(240),
  mime_type: z.string().trim().min(3).max(160),
  size_bytes: z.number().int().min(1).max(50_000_000_000),
  provider_md5_checksum: z.string().trim().max(80).nullable(),
  source_modified_at: z.iso.datetime().nullable(),
  raw_url_present: z.literal(false),
});
export type LearningDeliveryDriveFileMetadata = z.infer<
  typeof learningDeliveryDriveFileMetadataSchema
>;

export const learningDeliveryProbeSummarySchema = z.object({
  duration_ms: z.number().int().min(0),
  width: z.number().int().min(0).nullable(),
  height: z.number().int().min(0).nullable(),
  video_codec: z.string().trim().max(80).nullable(),
  audio_codec: z.string().trim().max(80).nullable(),
  stream_count: z.number().int().min(0),
});
export type LearningDeliveryProbeSummary = z.infer<typeof learningDeliveryProbeSummarySchema>;

export const learningDeliveryTranscriptSegmentSchema = z.object({
  segment_id: z.string().trim().min(1).max(120),
  start_ms: z.number().int().min(0),
  end_ms: z.number().int().min(0),
  text: z.string().trim().min(1).max(5_000),
});
export type LearningDeliveryTranscriptSegment = z.infer<
  typeof learningDeliveryTranscriptSegmentSchema
>;

export const learningDeliverySilenceRangeSchema = z.object({
  start_ms: z.number().int().min(0),
  end_ms: z.number().int().min(0),
});
export type LearningDeliverySilenceRange = z.infer<typeof learningDeliverySilenceRangeSchema>;

export const learningDeliveryTrimDecisionSchema = z.object({
  start_ms: z.number().int().min(0),
  end_ms: z.number().int().min(0),
  reason_code: z.enum([
    'leading_trailing_silence',
    'no_safe_trim_detected',
    'manual_operator_decision',
    'automatic_edge_trim',
    'safe_no_trim_exception',
  ]),
  requires_operator_approval: z.boolean(),
  auto_cut_performed: z.boolean(),
  confidence: z.number().min(0).max(1).optional(),
  confidence_reason_codes: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  safe_exception_code: z
    .enum([
      'audio_missing',
      'transcript_segments_missing',
      'edge_speech_not_found',
      'low_confidence',
      'removed_percentage_exceeds_max',
      'duration_implausible',
      'no_edge_trim_needed',
    ])
    .nullable()
    .optional(),
  removed_start_ms: z.number().int().min(0).optional(),
  removed_end_ms: z.number().int().min(0).optional(),
  removed_percent: z.number().min(0).max(1).optional(),
  opening_window_ms: z.number().int().min(1).optional(),
  closing_window_ms: z.number().int().min(1).optional(),
});
export type LearningDeliveryTrimDecision = z.infer<typeof learningDeliveryTrimDecisionSchema>;

export const learningDeliveryTranscriptArtifactSchema = z.object({
  provider: z.literal('openai'),
  provider_model: z.string().trim().min(1).max(120),
  provider_model_version: z.string().trim().min(1).max(120),
  source_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  transcript_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  webvtt_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  language: z.string().trim().min(2).max(24),
  corrected_transcript_version: z.string().trim().min(1).max(80),
  vocabulary_prompt_sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
  segment_count: z.number().int().min(0),
  duration_ms: z.number().int().min(0),
  segments: z.array(learningDeliveryTranscriptSegmentSchema).max(20_000),
  raw_transcript_present: z.literal(false),
  approved_torah_interpretation: z.literal(false),
});
export type LearningDeliveryTranscriptArtifact = z.infer<
  typeof learningDeliveryTranscriptArtifactSchema
>;

export const learningDeliveryPreparedDemoProjectionSchema = z.object({
  demo_lesson_key: z.string().trim().min(3).max(180),
  account_key: z.literal(LEARNING_DELIVERY_ACCOUNT_KEY),
  product_key: z.literal(LEARNING_DELIVERY_PRODUCT_KEY),
  original_duration_ms: z.number().int().min(0),
  prepared_duration_ms: z.number().int().min(0),
  trim_start_ms: z.number().int().min(0),
  trim_end_ms: z.number().int().min(0),
  trim_confidence: z.number().min(0).max(1),
  captions_status: z.enum(['ready', 'blocked', 'not_requested']),
  vimeo_privacy: z.enum(['private', 'unlisted', 'password', 'review_required']),
  playback_kind: z.literal('server_authorized_vimeo_playback'),
  playback_route: z.string().trim().min(1).max(240),
  provider_video_id_present: z.boolean(),
  provider_video_ref_digest: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
  provider_text_track_ref_digest: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
  transcript_sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
  webvtt_sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
  raw_provider_url_present: z.literal(false),
  raw_transcript_present: z.literal(false),
});
export type LearningDeliveryPreparedDemoProjection = z.infer<
  typeof learningDeliveryPreparedDemoProjectionSchema
>;

export const learningDeliveryBusinessEventTypeSchema = z.enum([
  'recording.available',
  'class.reminder.requested',
]);
export type LearningDeliveryBusinessEventType = z.infer<
  typeof learningDeliveryBusinessEventTypeSchema
>;

export const learningDeliveryBusinessEventPayloadSchema = learningDeliveryWorkspaceSchema.extend({
  event_key: z.string().trim().min(8).max(180),
  event_type: learningDeliveryBusinessEventTypeSchema,
  source_key: z.string().trim().min(3).max(180).nullable(),
  class_occurrence_key: z.string().trim().min(3).max(180).nullable(),
  occurred_at: z.iso.datetime(),
  safe_metadata: z.record(z.string(), z.unknown()).default({}),
  raw_url_present: z.literal(false),
  raw_transcript_present: z.literal(false),
  student_credential_present: z.literal(false),
});
export type LearningDeliveryBusinessEventPayload = z.infer<
  typeof learningDeliveryBusinessEventPayloadSchema
>;
