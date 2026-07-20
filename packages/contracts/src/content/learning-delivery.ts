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

export const learningDeliveryTrimDecisionSchema = z.object({
  start_ms: z.number().int().min(0),
  end_ms: z.number().int().min(0),
  reason_code: z.enum([
    'leading_trailing_silence',
    'no_safe_trim_detected',
    'manual_operator_decision',
  ]),
  requires_operator_approval: z.literal(true),
  auto_cut_performed: z.literal(false),
});
export type LearningDeliveryTrimDecision = z.infer<typeof learningDeliveryTrimDecisionSchema>;

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
