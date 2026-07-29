import type {
  ContentIngestAdminActor,
  ContentIngestScope,
  ContentSourceRecord,
  IngestRuntimeTier,
  ManagedObjectReadback,
} from '../ingest/index.ts';

export const CONTENT_PROCESSING_CONTRACT_VERSION = '2.1.0' as const;
export const CONTENT_PROCESSING_MAX_BYTES = 5 * 1024 * 1024 * 1024;
export const CONTENT_PROCESSING_STREAM_CHUNK_BYTES = 4 * 1024 * 1024;
export const CONTENT_PROCESSING_MAX_ATTEMPTS = 8;
export const CONTENT_PROCESSING_LANGUAGE = 'en' as const;

export const OT_VIDEO_1_PROFILE = {
  version: 'OT-VIDEO-1',
  container: 'mp4',
  videoCodec: 'h264',
  pixelFormat: 'yuv420p',
  maxWidth: 1920,
  maxHeight: 1080,
  maxFramesPerSecond: 30,
  crf: 23,
  preset: 'medium',
  audioCodec: 'aac-lc',
  audioSampleRateHz: 48_000,
  audioChannels: 2,
  audioBitrateBps: 128_000,
  fastStart: true,
  stripUnnecessaryMetadata: true,
  upscale: false,
} as const;

export const OT_TRANSCRIBE_1_OPERATION = {
  contractVersion: 'OT-TRANSCRIBE-1',
  endpoint: 'audio-transcriptions',
  model: 'gpt-4o-transcribe',
  requestFormatVersion: 'OT-TRANSCRIBE-REQUEST-1',
  language: CONTENT_PROCESSING_LANGUAGE,
  segmentationVersion: 'OT-AUDIO-SEGMENT-1',
  promptTemplateDigestVersion: 'OT-TRANSCRIBE-PROMPT-1',
} as const;

export const OT_LEARNING_DRAFT_1_OPERATION = {
  contractVersion: 'OT-LEARNING-DRAFT-1',
  endpoint: 'responses',
  model: 'gpt-4.1-mini-2025-04-14',
  requestFormatVersion: 'OT-RESPONSES-REQUEST-1',
  promptTemplateDigestVersion: 'OT-LEARNING-DRAFT-PROMPT-1',
  glossaryVersion: 'OT-ENGLISH-GLOSSARY-1',
  schemaVersion: 'OT-LEARNING-DRAFT-SCHEMA-1',
  strict: true,
  webSearch: false,
  externalTools: false,
  conversationCarryOver: false,
} as const;

export const OT_LEARNING_DRAFT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'reviewQuestions', 'worksheet', 'knowledgeArtifact'],
  properties: {
    title: { type: 'string', minLength: 1 },
    summary: { type: 'string', minLength: 1 },
    reviewQuestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'answer', 'sourceSegmentIds'],
        properties: {
          question: { type: 'string', minLength: 1 },
          answer: { type: 'string', minLength: 1 },
          sourceSegmentIds: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    worksheet: {
      type: 'object',
      additionalProperties: false,
      required: ['instructions', 'items'],
      properties: {
        instructions: { type: 'string', minLength: 1 },
        items: { type: 'array', items: { type: 'string' } },
      },
    },
    knowledgeArtifact: {
      type: 'object',
      additionalProperties: false,
      required: ['heading', 'body', 'sourceSegmentIds'],
      properties: {
        heading: { type: 'string', minLength: 1 },
        body: { type: 'string', minLength: 1 },
        sourceSegmentIds: { type: 'array', items: { type: 'string' } },
      },
    },
  },
} as const;

export type ContentProcessingScope = ContentIngestScope;
export type ContentProcessingAdminActor = ContentIngestAdminActor;
export type ContentProcessingSource = ContentSourceRecord;
export type ContentProcessingReadback = ManagedObjectReadback;
export type ContentProcessingRuntimeTier = IngestRuntimeTier;

export type ContentProcessingState =
  | 'validating'
  | 'transcoding'
  | 'transcribing'
  | 'drafting'
  | 'needs_review'
  | 'approved'
  | 'failed'
  | 'dead_lettered';

export type ContentProcessingRetryState = 'ready' | 'retry_wait' | 'dead_lettered';
export type ProcessingArtifactStatus = 'draft' | 'approved';
export type ProcessingArtifactKind =
  | 'trim'
  | 'compressed_video'
  | 'transcript'
  | 'captions'
  | 'review_material'
  | 'worksheet'
  | 'knowledge_artifact';

export type MediaProbeReadback = {
  probeVersion: 'OT-FFPROBE-1';
  readable: boolean;
  decodeFailure: boolean;
  container: string;
  durationMs: number;
  codedWidth: number;
  codedHeight: number;
  framesPerSecond: number;
  rotationDegrees: 0 | 90 | 180 | 270;
  videoCodec: string | null;
  pixelFormat: string | null;
  audioCodec: string | null;
  audioProfile: string | null;
  audioSampleRateHz: number | null;
  audioChannels: number | null;
  videoStreamCount: number;
  audioStreamCount: number;
};

export type ControlledCaptureEvidence = {
  evidenceVersion: 'OT-OBS-CAPTURE-1';
  sourceId: string;
  occurrenceId: string;
  captureMethod: 'obs';
  zoomCloudRecordingDisabled: true;
  controlledEncryptedDevice: true;
  accountOwnerConsentVersion: string;
  consentedParticipantSnapshotDigest: string;
  recordingNotice: 'visible_and_verbal';
  capturedAt: string;
  uploadConfirmedAt: string;
  durableChecksumReadbackReceiptId: string;
  linkedIngestSourceId: string;
  localDeletionRecordedAt?: string;
};

export type ProcessingStoragePolicyReadback = {
  policyVersion: 'OT-PROCESSING-STORAGE-1';
  provider: 'aws-s3';
  region: 'eu-central-1';
  private: true;
  versioningEnabled: true;
  encryption: 'SSE-KMS';
  blockPublicAccess: true;
  bucketOwnerEnforced: true;
  browserCredentialsExposed: false;
  bucketRef: string;
  kmsKeyVersionRef: string;
};

export type TrimSelection = {
  trimVersion: 'OT-TRIM-1';
  sourceDurationMs: number;
  startMs: number;
  endMs: number;
  outputDurationMs: number;
  selectedByAdminId: string;
  selectedAt: string;
};

export type ExecutablePlan = {
  executable: 'ffmpeg' | 'ffprobe';
  args: readonly string[];
  shell: false;
};

export type TranscodePlan = {
  profile: typeof OT_VIDEO_1_PROFILE;
  sourceId: string;
  sourceSha256: string;
  sourceObjectVersionId: string;
  trim: TrimSelection;
  targetWidth: number;
  targetHeight: number;
  targetFramesPerSecond: number;
  command: ExecutablePlan;
  boundedMemory: true;
  replacesOriginal: false;
};

export type DerivativeReadback = {
  profileVersion: typeof OT_VIDEO_1_PROFILE.version;
  objectVersionId: string;
  byteCount: number;
  sha256: string;
  container: 'mp4';
  durationMs: number;
  width: number;
  height: number;
  framesPerSecond: number;
  videoCodec: 'h264';
  pixelFormat: 'yuv420p';
  audioCodec: 'aac';
  audioProfile: 'LC';
  audioSampleRateHz: 48_000;
  audioChannels: 2;
  audioBitrateBps: 128_000;
  fastStart: true;
  decodeFailure: false;
  sourceMetadataRemoved: true;
};

export type AudioSegmentPlan = {
  segmentId: string;
  startMs: number;
  endMs: number;
  sourceSha256: string;
  checksumAddressedObjectKey: string;
};

export type TranscriptSegment = {
  segmentId: string;
  startMs: number;
  endMs: number;
  text: string;
  providerResultDigest: string;
};

export type CaptionCue = {
  cueId: string;
  startMs: number;
  endMs: number;
  text: string;
  sourceSegmentId: string;
};

export type TranscriptDraft = {
  language: typeof CONTENT_PROCESSING_LANGUAGE;
  operation: typeof OT_TRANSCRIBE_1_OPERATION;
  sourceId: string;
  sourceSha256: string;
  sourceObjectVersionId: string;
  providerProjectIdDigest: string;
  providerRequestDigest: string;
  providerResultDigest: string;
  segments: readonly TranscriptSegment[];
  captions: readonly CaptionCue[];
  complete: true;
};

export type LearningDraft = {
  title: string;
  summary: string;
  reviewQuestions: readonly {
    question: string;
    answer: string;
    sourceSegmentIds: readonly string[];
  }[];
  worksheet: {
    instructions: string;
    items: readonly string[];
  };
  knowledgeArtifact: {
    heading: string;
    body: string;
    sourceSegmentIds: readonly string[];
  };
};

export type LearningDraftResult = {
  operation: typeof OT_LEARNING_DRAFT_1_OPERATION;
  sourceId: string;
  sourceSha256: string;
  transcriptDigest: string;
  providerProjectIdDigest: string;
  providerRequestDigest: string;
  providerResultDigest: string;
  schemaDigest: string;
  safeDisposition: 'draft_only';
  output: LearningDraft;
};

export type ProcessingArtifact = ContentProcessingScope & {
  id: string;
  contentVersionId: string;
  kind: ProcessingArtifactKind;
  revision: number;
  sourceId: string;
  sourceSha256: string;
  sourceObjectVersionId: string;
  status: ProcessingArtifactStatus;
  payloadDigest: string;
  payload: unknown;
  model?: string;
  operationVersion?: string;
  promptVersion?: string;
  schemaVersion?: string;
  editedByAdminId?: string;
  approvedByAdminId?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ContentProcessingVersion = ContentProcessingScope & {
  id: string;
  sourceId: string;
  sourceSha256: string;
  sourceObjectVersionId: string;
  runtimeTier: ContentProcessingRuntimeTier;
  state: ContentProcessingState;
  retryState: ContentProcessingRetryState;
  attemptCount: number;
  trim: TrimSelection;
  transcodePlan: TranscodePlan;
  artifacts: readonly ProcessingArtifact[];
  lastSafeErrorCode?: string;
  retryAt?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type ContentProcessingCommandReceipt = ContentProcessingScope & {
  idempotencyKey: string;
  requestHash: string;
  operation: 'process_source' | 'edit_artifact' | 'approve_version';
  resultRef: string;
  resultVersion: number;
  committedAt: string;
};

export interface ContentProcessingUnitOfWork {
  getVersion(
    scope: ContentProcessingScope,
    contentVersionId: string,
  ): Promise<ContentProcessingVersion | null>;
  saveVersion(version: ContentProcessingVersion): Promise<void>;
  saveArtifact(artifact: ProcessingArtifact): Promise<void>;
  saveCaptureEvidence(
    scope: ContentProcessingScope,
    evidence: ControlledCaptureEvidence,
  ): Promise<void>;
  getReceipt(
    scope: ContentProcessingScope,
    idempotencyKey: string,
  ): Promise<ContentProcessingCommandReceipt | null>;
  saveReceipt(receipt: ContentProcessingCommandReceipt): Promise<void>;
}

export interface ContentProcessingRepository {
  inTransaction<T>(run: (unit: ContentProcessingUnitOfWork) => Promise<T>): Promise<T>;
}

export const CONTENT_PROCESSING_ERROR_CODES = {
  accessDenied: 'content_processing_access_denied',
  captureEvidenceInvalid: 'content_processing_capture_evidence_invalid',
  conflict: 'content_processing_idempotency_conflict',
  derivativeInvalid: 'content_processing_derivative_invalid',
  draftInvalid: 'content_processing_draft_invalid',
  invalidReadback: 'content_processing_invalid_readback',
  invalidSource: 'content_processing_invalid_source',
  invalidState: 'content_processing_invalid_state',
  invalidTranscript: 'content_processing_invalid_transcript',
  invalidTrim: 'content_processing_invalid_trim',
  staleVersion: 'content_processing_stale_version',
  storagePolicyInvalid: 'content_processing_storage_policy_invalid',
  providerUncertain: 'content_processing_provider_uncertain',
} as const;
