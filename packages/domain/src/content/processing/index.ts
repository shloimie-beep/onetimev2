import { createHash } from 'node:crypto';

import {
  CONTENT_PROCESSING_ERROR_CODES,
  CONTENT_PROCESSING_LANGUAGE,
  CONTENT_PROCESSING_MAX_ATTEMPTS,
  CONTENT_PROCESSING_MAX_BYTES,
  CONTENT_PROCESSING_STREAM_CHUNK_BYTES,
  CONTENT_REDACTION_ACTIONS,
  CONTENT_VERSION_DIGEST_VERSION,
  OT_LEARNING_DRAFT_1_OPERATION,
  OT_LEARNING_DRAFT_JSON_SCHEMA,
  OT_TRANSCRIBE_1_OPERATION,
  OT_VIDEO_1_PROFILE,
  type AudioSegmentPlan,
  type ApprovedForPublicationArtifact,
  type ApprovedForPublicationProjectionParams,
  type CaptionCue,
  type ContentParticipantAdminReview,
  type ContentProcessingAdminActor,
  type ContentParticipantReviewEvidence,
  type ContentParticipantReviewInput,
  type ContentParticipantReviewSourceEvidence,
  type ContentRedactionAction,
  type ContentProcessingSource,
  type ContentProcessingVersion,
  type ControlledCaptureEvidence,
  type DerivativeReadback,
  type LearningDraft,
  type LearningDraftResult,
  type MediaProbeReadback,
  type ProcessingArtifact,
  type ProcessingStoragePolicyReadback,
  type SourceCompleteApprovedForPublicationProjection,
  type TranscriptDraft,
  type TranscriptSegment,
  type TranscodePlan,
  type TrimSelection,
} from '../../../../contracts/src/content/processing/index.ts';
import type { ManagedObjectReadback } from '../../../../contracts/src/content/ingest/index.ts';
import type { RecordingParticipantSnapshot } from '../../../../contracts/src/privacy/index.ts';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MAX_AUDIO_SEGMENT_MS = 20 * 60 * 1000;
const PRIVATE_MATERIAL_PATTERN =
  /\b(?:email|phone|address|username|password|student id|learner id)\b/i;

export class ContentProcessingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function processingSha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

export function validateProcessingInput(input: {
  source: ContentProcessingSource;
  readback: ManagedObjectReadback;
  probe: MediaProbeReadback;
  storage: ProcessingStoragePolicyReadback;
}) {
  const { source, readback, probe, storage } = input;
  if (
    source.captureMethod !== 'obs' ||
    source.originalPreserved !== true ||
    source.byteCount < 1 ||
    source.byteCount > CONTENT_PROCESSING_MAX_BYTES ||
    !SHA256_PATTERN.test(source.sha256)
  ) {
    fail(
      'invalidSource',
      'Processing requires a preserved checksum-bound OBS source through 5 GiB.',
    );
  }
  if (
    readback.region !== 'eu-central-1' ||
    readback.blockPublicAccess !== true ||
    readback.bucketOwnerEnforced !== true ||
    readback.runtimeTier !== source.runtimeTier ||
    readback.verificationEnvironmentId !== source.verificationEnvironmentId ||
    readback.bucketRef !== source.bucketRef ||
    readback.objectKeyDigest !== source.objectKeyDigest ||
    readback.objectVersionId !== source.objectVersionId ||
    readback.byteCount !== source.byteCount ||
    readback.sha256 !== source.sha256 ||
    readback.kmsKeyVersionRef !== source.kmsKeyVersionRef ||
    (readback.durabilityEvidenceVersion !== undefined &&
      (readback.durabilityEvidenceVersion !== 'OT-MANAGED-ORIGINAL-1' ||
        readback.checksumAlgorithm !== 'sha256' ||
        typeof readback.storageClass !== 'string' ||
        !readback.storageClass.trim()))
  ) {
    fail('invalidReadback', 'The source does not match its durable managed-object readback.');
  }
  validateStoragePolicy(storage, source);
  if (
    !probe.readable ||
    probe.decodeFailure ||
    probe.videoStreamCount !== 1 ||
    probe.audioStreamCount < 1 ||
    probe.durationMs < 1 ||
    probe.codedWidth < 1 ||
    probe.codedHeight < 1 ||
    probe.framesPerSecond <= 0
  ) {
    fail('invalidSource', 'Media must decode with one video stream, audio, and valid dimensions.');
  }
  return {
    source,
    readback,
    probe,
    storage,
    boundedReadBytes: CONTENT_PROCESSING_STREAM_CHUNK_BYTES,
  } as const;
}

export function validateStoragePolicy(
  policy: ProcessingStoragePolicyReadback,
  source?: ContentProcessingSource,
) {
  if (
    policy.provider !== 'aws-s3' ||
    policy.region !== 'eu-central-1' ||
    policy.private !== true ||
    policy.versioningEnabled !== true ||
    policy.encryption !== 'SSE-KMS' ||
    policy.blockPublicAccess !== true ||
    policy.bucketOwnerEnforced !== true ||
    policy.browserCredentialsExposed !== false ||
    (source &&
      (policy.bucketRef !== source.bucketRef ||
        policy.kmsKeyVersionRef !== source.kmsKeyVersionRef))
  ) {
    fail(
      'storagePolicyInvalid',
      'Processing storage must be private, versioned eu-central-1 S3 with SSE-KMS.',
    );
  }
}

export function validateControlledCapture(
  evidence: ControlledCaptureEvidence,
  source: ContentProcessingSource,
) {
  const capturedAt = Date.parse(evidence.capturedAt);
  const uploadedAt = Date.parse(evidence.uploadConfirmedAt);
  if (
    evidence.captureMethod !== 'obs' ||
    evidence.zoomCloudRecordingDisabled !== true ||
    evidence.controlledEncryptedDevice !== true ||
    evidence.recordingNotice !== 'visible_and_verbal' ||
    evidence.sourceId !== source.id ||
    typeof source.occurrenceId !== 'string' ||
    !source.occurrenceId.trim() ||
    source.occurrenceId !== source.occurrenceId.trim() ||
    source.matchConfidence !== 'exact' ||
    typeof source.matchedByAdminId !== 'string' ||
    !source.matchedByAdminId.trim() ||
    evidence.occurrenceId !== source.occurrenceId ||
    evidence.linkedIngestSourceId !== source.id ||
    evidence.durableChecksumReadbackReceiptId !== source.checksumReadbackReceiptId ||
    typeof evidence.accountOwnerConsentVersion !== 'string' ||
    !evidence.accountOwnerConsentVersion.trim() ||
    !SHA256_PATTERN.test(evidence.consentedParticipantSnapshotDigest) ||
    !Number.isFinite(capturedAt) ||
    !Number.isFinite(uploadedAt) ||
    uploadedAt < capturedAt ||
    uploadedAt - capturedAt > 24 * 60 * 60 * 1000
  ) {
    fail(
      'captureEvidenceInvalid',
      'OBS consent, notice, controlled-device, upload, and linkage evidence is incomplete.',
    );
  }
  return evidence;
}

export function localCaptureDeletionDecision(
  evidence: ControlledCaptureEvidence,
  source: ContentProcessingSource,
) {
  validateControlledCapture(evidence, source);
  return {
    eligible: true,
    reason: 'durable_checksum_readback_and_ingest_linkage_confirmed',
    receiptId: evidence.durableChecksumReadbackReceiptId,
    sourceId: source.id,
  } as const;
}

export function selectTrim(input: {
  sourceDurationMs: number;
  startMs: number;
  endMs: number;
  actor: ContentProcessingAdminActor;
  selectedAt: string;
}): TrimSelection {
  const { sourceDurationMs, startMs, endMs } = input;
  if (
    !Number.isSafeInteger(sourceDurationMs) ||
    !Number.isSafeInteger(startMs) ||
    !Number.isSafeInteger(endMs) ||
    sourceDurationMs < 1 ||
    startMs < 0 ||
    endMs <= startMs ||
    endMs > sourceDurationMs
  ) {
    fail('invalidTrim', 'Trim must select one contiguous range by removing only beginning/end.');
  }
  return {
    trimVersion: 'OT-TRIM-1',
    sourceDurationMs,
    startMs,
    endMs,
    outputDurationMs: endMs - startMs,
    selectedByAdminId: input.actor.principalId,
    selectedAt: input.selectedAt,
  };
}

export function buildTranscodePlan(input: {
  source: ContentProcessingSource;
  probe: MediaProbeReadback;
  trim: TrimSelection;
  inputLocator: string;
  outputLocator: string;
}): TranscodePlan {
  assertOpaqueLocator(input.inputLocator);
  assertOpaqueLocator(input.outputLocator);
  const sourceWidth =
    input.probe.rotationDegrees === 90 || input.probe.rotationDegrees === 270
      ? input.probe.codedHeight
      : input.probe.codedWidth;
  const sourceHeight =
    input.probe.rotationDegrees === 90 || input.probe.rotationDegrees === 270
      ? input.probe.codedWidth
      : input.probe.codedHeight;
  const scale = Math.min(
    1,
    OT_VIDEO_1_PROFILE.maxWidth / sourceWidth,
    OT_VIDEO_1_PROFILE.maxHeight / sourceHeight,
  );
  const targetWidth = evenDimension(sourceWidth * scale);
  const targetHeight = evenDimension(sourceHeight * scale);
  const targetFramesPerSecond = Math.min(
    input.probe.framesPerSecond,
    OT_VIDEO_1_PROFILE.maxFramesPerSecond,
  );
  const rotationFilter =
    input.probe.rotationDegrees === 90
      ? 'transpose=clock'
      : input.probe.rotationDegrees === 270
        ? 'transpose=cclock'
        : input.probe.rotationDegrees === 180
          ? 'hflip,vflip'
          : null;
  const videoFilter = [
    rotationFilter,
    `scale=${targetWidth}:${targetHeight}:flags=lanczos`,
    'setsar=1',
  ]
    .filter(Boolean)
    .join(',');

  return {
    profile: OT_VIDEO_1_PROFILE,
    sourceId: input.source.id,
    sourceSha256: input.source.sha256,
    sourceObjectVersionId: input.source.objectVersionId,
    trim: input.trim,
    targetWidth,
    targetHeight,
    targetFramesPerSecond,
    boundedMemory: true,
    replacesOriginal: false,
    command: {
      executable: 'ffmpeg',
      shell: false,
      args: [
        '-nostdin',
        '-hide_banner',
        '-loglevel',
        'error',
        '-ss',
        millisecondsToFfmpeg(input.trim.startMs),
        '-noautorotate',
        '-i',
        input.inputLocator,
        '-t',
        millisecondsToFfmpeg(input.trim.outputDurationMs),
        '-map',
        '0:v:0',
        '-map',
        '0:a:0',
        '-vf',
        videoFilter,
        '-r',
        String(targetFramesPerSecond),
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-crf',
        '23',
        '-preset',
        'medium',
        '-c:a',
        'aac',
        '-profile:a',
        'aac_low',
        '-ar',
        '48000',
        '-ac',
        '2',
        '-b:a',
        '128k',
        '-map_metadata',
        '-1',
        '-metadata:s:v:0',
        'rotate=0',
        '-movflags',
        '+faststart',
        '-f',
        'mp4',
        '-y',
        input.outputLocator,
      ],
    },
  };
}

export function verifyDerivative(
  derivative: DerivativeReadback,
  input: {
    source: ContentProcessingSource;
    plan: TranscodePlan;
  },
) {
  const durationDelta = Math.abs(derivative.durationMs - input.plan.trim.outputDurationMs);
  if (
    derivative.profileVersion !== 'OT-VIDEO-1' ||
    derivative.container !== 'mp4' ||
    derivative.videoCodec !== 'h264' ||
    derivative.pixelFormat !== 'yuv420p' ||
    derivative.audioCodec !== 'aac' ||
    derivative.audioProfile !== 'LC' ||
    derivative.audioSampleRateHz !== 48_000 ||
    derivative.audioChannels !== 2 ||
    derivative.audioBitrateBps !== 128_000 ||
    derivative.fastStart !== true ||
    derivative.decodeFailure !== false ||
    derivative.sourceMetadataRemoved !== true ||
    derivative.width !== input.plan.targetWidth ||
    derivative.height !== input.plan.targetHeight ||
    derivative.framesPerSecond > 30 ||
    derivative.framesPerSecond > input.plan.targetFramesPerSecond ||
    derivative.byteCount < 1 ||
    !SHA256_PATTERN.test(derivative.sha256) ||
    durationDelta > 1_000
  ) {
    fail('derivativeInvalid', 'Derivative readback does not satisfy OT-VIDEO-1.');
  }
  return {
    derivative,
    sizeOutcome: derivative.byteCount < input.source.byteCount ? 'smaller' : 'not_smaller_reported',
    originalPreserved: true,
  } as const;
}

export function buildAudioSegmentPlan(input: {
  source: ContentProcessingSource;
  trim: TrimSelection;
}): readonly AudioSegmentPlan[] {
  const segments: AudioSegmentPlan[] = [];
  for (
    let startMs = input.trim.startMs, index = 0;
    startMs < input.trim.endMs;
    startMs += MAX_AUDIO_SEGMENT_MS, index += 1
  ) {
    const endMs = Math.min(input.trim.endMs, startMs + MAX_AUDIO_SEGMENT_MS);
    const segmentId = processingSha256(
      `${input.source.sha256}:${input.source.objectVersionId}:${startMs}:${endMs}`,
    );
    segments.push({
      segmentId,
      startMs,
      endMs,
      sourceSha256: input.source.sha256,
      checksumAddressedObjectKey: `segments/${segmentId}`,
    });
  }
  return segments;
}

export function validateTranscriptDraft(input: {
  source: ContentProcessingSource;
  plannedSegments: readonly AudioSegmentPlan[];
  segments: readonly TranscriptSegment[];
  providerProjectIdDigest: string;
  providerRequestDigest: string;
  providerResultDigest: string;
}): TranscriptDraft {
  if (
    input.segments.length < 1 ||
    input.segments.length !== input.plannedSegments.length ||
    ![input.providerProjectIdDigest, input.providerRequestDigest, input.providerResultDigest].every(
      (digest) => SHA256_PATTERN.test(digest),
    )
  ) {
    fail('invalidTranscript', 'A complete checksum-bound English transcript is required.');
  }
  let priorEnd = -1;
  const captions: CaptionCue[] = input.segments.map((segment, index) => {
    const planned = input.plannedSegments[index];
    if (
      !planned ||
      segment.segmentId !== planned.segmentId ||
      !segment.text.trim() ||
      !SHA256_PATTERN.test(segment.segmentId) ||
      !SHA256_PATTERN.test(segment.providerResultDigest) ||
      segment.startMs < planned.startMs ||
      segment.endMs > planned.endMs ||
      segment.endMs <= segment.startMs ||
      segment.startMs < priorEnd
    ) {
      fail(
        'invalidTranscript',
        'Transcript segments must be complete, ordered, and non-overlapping.',
      );
    }
    priorEnd = segment.endMs;
    return {
      cueId: `cue-${index + 1}`,
      startMs: segment.startMs,
      endMs: segment.endMs,
      text: segment.text.trim(),
      sourceSegmentId: segment.segmentId,
    };
  });
  return {
    language: 'en',
    operation: OT_TRANSCRIBE_1_OPERATION,
    sourceId: input.source.id,
    sourceSha256: input.source.sha256,
    sourceObjectVersionId: input.source.objectVersionId,
    providerProjectIdDigest: input.providerProjectIdDigest,
    providerRequestDigest: input.providerRequestDigest,
    providerResultDigest: input.providerResultDigest,
    segments: input.segments,
    captions,
    complete: true,
  };
}

export function validateLearningDraft(input: {
  source: ContentProcessingSource;
  transcript: TranscriptDraft;
  output: LearningDraft;
  providerProjectIdDigest: string;
  providerRequestDigest: string;
  providerResultDigest: string;
  schemaDigest: string;
}): LearningDraftResult {
  const { output } = input;
  if (
    typeof output.title !== 'string' ||
    typeof output.classTopic !== 'string' ||
    !Array.isArray(output.mishnahReferences) ||
    !Array.isArray(output.reviewQuestions)
  ) {
    fail('draftInvalid', 'Structured learning metadata is incomplete.');
  }
  const segmentIds = new Set(input.transcript.segments.map((segment) => segment.segmentId));
  const referencedIds = [
    ...output.reviewQuestions.flatMap((question) => question.sourceSegmentIds),
    ...output.knowledgeArtifact.sourceSegmentIds,
  ];
  const publicMetadata = [output.title, output.classTopic, ...output.mishnahReferences];
  if (
    !output.title.trim() ||
    output.title !== output.title.trim() ||
    !output.classTopic.trim() ||
    output.classTopic !== output.classTopic.trim() ||
    output.mishnahReferences.some(
      (reference) =>
        typeof reference !== 'string' || !reference.trim() || reference !== reference.trim(),
    ) ||
    new Set(output.mishnahReferences).size !== output.mishnahReferences.length ||
    !output.summary.trim() ||
    output.reviewQuestions.length < 1 ||
    !output.worksheet.instructions.trim() ||
    output.worksheet.items.length < 1 ||
    !output.knowledgeArtifact.heading.trim() ||
    !output.knowledgeArtifact.body.trim() ||
    referencedIds.some((id) => !segmentIds.has(id)) ||
    [...publicMetadata, output.summary, output.knowledgeArtifact.body].some((text) =>
      PRIVATE_MATERIAL_PATTERN.test(text),
    ) ||
    ![
      input.providerProjectIdDigest,
      input.providerRequestDigest,
      input.providerResultDigest,
      input.schemaDigest,
    ].every((digest) => SHA256_PATTERN.test(digest))
  ) {
    fail(
      'draftInvalid',
      'Structured learning output is incomplete, ungrounded, or privacy-unsafe.',
    );
  }
  return {
    operation: OT_LEARNING_DRAFT_1_OPERATION,
    sourceId: input.source.id,
    sourceSha256: input.source.sha256,
    transcriptDigest: processingSha256(JSON.stringify(input.transcript)),
    providerProjectIdDigest: input.providerProjectIdDigest,
    providerRequestDigest: input.providerRequestDigest,
    providerResultDigest: input.providerResultDigest,
    schemaDigest: input.schemaDigest,
    safeDisposition: 'draft_only',
    output,
  };
}

export function createDraftArtifacts(input: {
  version: ContentProcessingVersion;
  derivative: DerivativeReadback;
  transcript: TranscriptDraft;
  learning: LearningDraftResult;
  occurredAt: string;
}): readonly ProcessingArtifact[] {
  const common = {
    accountKey: input.version.accountKey,
    productKey: input.version.productKey,
    contentVersionId: input.version.id,
    sourceId: input.version.sourceId,
    sourceSha256: input.version.sourceSha256,
    sourceObjectVersionId: input.version.sourceObjectVersionId,
    revision: 1,
    status: 'draft' as const,
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
  };
  const entries: readonly [ProcessingArtifact['kind'], unknown, Partial<ProcessingArtifact>][] = [
    ['trim', input.version.trim, { operationVersion: input.version.trim.trimVersion }],
    ['compressed_video', input.derivative, { operationVersion: 'OT-VIDEO-1' }],
    [
      'transcript',
      input.transcript,
      {
        model: OT_TRANSCRIBE_1_OPERATION.model,
        operationVersion: OT_TRANSCRIBE_1_OPERATION.contractVersion,
        promptVersion: OT_TRANSCRIBE_1_OPERATION.promptTemplateDigestVersion,
      },
    ],
    [
      'captions',
      input.transcript.captions,
      {
        model: OT_TRANSCRIBE_1_OPERATION.model,
        operationVersion: OT_TRANSCRIBE_1_OPERATION.contractVersion,
      },
    ],
    [
      'review_material',
      {
        title: input.learning.output.title,
        classTopic: input.learning.output.classTopic,
        mishnahReferences: [...input.learning.output.mishnahReferences],
        summary: input.learning.output.summary,
        reviewQuestions: input.learning.output.reviewQuestions,
      },
      learningMetadata(),
    ],
    ['worksheet', input.learning.output.worksheet, learningMetadata()],
    ['knowledge_artifact', input.learning.output.knowledgeArtifact, learningMetadata()],
  ];
  return entries.map(([kind, payload, metadata]) => ({
    ...common,
    ...metadata,
    id: processingSha256(`${input.version.id}:${kind}:1`),
    kind,
    payloadDigest: processingSha256(JSON.stringify(payload)),
    payload,
  }));
}

export function editDraftArtifact(input: {
  actor: ContentProcessingAdminActor;
  version: ContentProcessingVersion;
  artifactId: string;
  payload: unknown;
  occurredAt: string;
}): ContentProcessingVersion {
  assertAdmin(input.actor, input.version);
  const artifacts = input.version.artifacts.map((artifact) => {
    if (artifact.id !== input.artifactId) return artifact;
    const updated: ProcessingArtifact = {
      ...artifact,
      id: processingSha256(`${input.version.id}:${artifact.kind}:${artifact.revision + 1}`),
      revision: artifact.revision + 1,
      payload: input.payload,
      payloadDigest: processingSha256(JSON.stringify(input.payload)),
      status: 'draft',
      editedByAdminId: input.actor.principalId,
      updatedAt: input.occurredAt,
    };
    delete updated.approvedByAdminId;
    delete updated.approvedAt;
    return updated;
  });
  if (artifacts.every((artifact, index) => artifact === input.version.artifacts[index])) {
    fail('invalidState', 'Artifact not found.');
  }
  return {
    ...input.version,
    state: 'needs_review',
    artifacts,
    version: input.version.version + 1,
    updatedAt: input.occurredAt,
  };
}

export function recordContentParticipantReview(input: {
  actor: ContentProcessingAdminActor;
  version: ContentProcessingVersion;
  recordingParticipantSnapshots: readonly RecordingParticipantSnapshot[];
  participantReviews: readonly ContentParticipantReviewInput[];
  occurredAt: string;
}): ContentProcessingVersion {
  assertAdmin(input.actor, input.version);
  if (input.version.state !== 'needs_review') {
    fail('invalidState', 'Participant review can be recorded only on a reviewable version.');
  }
  const reviewArtifact = input.version.artifacts.find(({ kind }) => kind === 'review_material');
  const reviewPayload = objectRecord(reviewArtifact?.payload);
  if (!reviewArtifact || !reviewPayload || reviewArtifact.status !== 'draft') {
    fail('invalidState', 'A persisted draft review artifact is required.');
  }
  const participantReview = buildParticipantReviewSourceEvidence({
    version: input.version,
    recordingParticipantSnapshots: input.recordingParticipantSnapshots,
    participantReviews: input.participantReviews,
    reviewedByAdminId: input.actor.principalId,
    reviewedAt: input.occurredAt,
  });
  return editDraftArtifact({
    actor: input.actor,
    version: input.version,
    artifactId: reviewArtifact.id,
    payload: {
      ...reviewPayload,
      participantReview,
    },
    occurredAt: input.occurredAt,
  });
}

export function approveProcessingVersion(input: {
  actor: ContentProcessingAdminActor;
  version: ContentProcessingVersion;
  expectedVersion: number;
  privacyReviewConfirmed: boolean;
  captureEvidence: ControlledCaptureEvidence;
  recordingParticipantSnapshots: readonly RecordingParticipantSnapshot[];
  occurredAt: string;
}): ContentProcessingVersion {
  assertAdmin(input.actor, input.version);
  if (
    input.version.version !== input.expectedVersion ||
    input.version.state !== 'needs_review' ||
    input.version.artifacts.length !== 7 ||
    input.version.artifacts.some((artifact) => artifact.status !== 'draft') ||
    !input.privacyReviewConfirmed
  ) {
    fail('invalidState', 'Exact-version Admin privacy review is required for approval.');
  }
  const participantReview = participantReviewEvidenceFromArtifacts({
    version: input.version,
    captureEvidence: input.captureEvidence,
    recordingParticipantSnapshots: input.recordingParticipantSnapshots,
    approvedByAdminId: input.actor.principalId,
    approvedAt: input.occurredAt,
  });
  const artifacts = input.version.artifacts.map((artifact) => ({
    ...artifact,
    id: processingSha256(
      `${input.version.id}:${artifact.kind}:${artifact.revision + 1}:approved:${artifact.payloadDigest}:${input.actor.principalId}:${input.occurredAt}`,
    ),
    revision: artifact.revision + 1,
    status: 'approved' as const,
    approvedByAdminId: input.actor.principalId,
    approvedAt: input.occurredAt,
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
  }));
  const approvedVersion = { ...input.version, artifacts };
  approvedPublicationArtifacts(approvedVersion, input.actor.principalId, input.occurredAt);
  const approvedArtifactSetDigest = publicationArtifactSetDigest(artifacts);
  const sourceEvidenceDigest = publicationSourceEvidenceDigest({
    params: {
      accountKey: input.version.accountKey,
      productKey: input.version.productKey,
      contentVersionId: input.version.id,
    },
    sourceId: input.version.sourceId,
    sourceSha256: input.version.sourceSha256,
    sourceObjectVersionId: input.version.sourceObjectVersionId,
    contentId: input.version.contentId,
    captureEvidence: input.captureEvidence,
    participantReview,
  });
  const contentVersionDigest = publicationContentVersionDigest({
    version: approvedVersion,
    approvedArtifactSetDigest,
    sourceEvidenceDigest,
  });
  return {
    ...input.version,
    state: 'approved',
    artifacts,
    publicationApproval: {
      evidenceVersion: 'OT-PUBLICATION-APPROVAL-1',
      participantSnapshotDigest: input.captureEvidence.consentedParticipantSnapshotDigest,
      participantReview,
      approvedByAdminId: input.actor.principalId,
      approvedAt: input.occurredAt,
      approvedArtifactSetDigest,
      sourceEvidenceDigest,
      contentVersionDigestVersion: CONTENT_VERSION_DIGEST_VERSION,
      contentVersionDigest,
    },
    version: input.version.version + 1,
    updatedAt: input.occurredAt,
  };
}

export function buildApprovedForPublicationProjection(input: {
  params: ApprovedForPublicationProjectionParams;
  version: ContentProcessingVersion;
  source: ContentProcessingSource;
  captureEvidence: ControlledCaptureEvidence;
  recordingParticipantSnapshots: readonly RecordingParticipantSnapshot[];
}): SourceCompleteApprovedForPublicationProjection {
  const { params, version, source, captureEvidence, recordingParticipantSnapshots } = input;
  const approval = version.publicationApproval;
  const participantReview = approval?.participantReview;
  if (
    version.state !== 'approved' ||
    !approval ||
    !participantReview ||
    version.accountKey !== params.accountKey ||
    version.productKey !== params.productKey ||
    version.id !== params.contentVersionId ||
    typeof version.contentId !== 'string' ||
    !version.contentId.trim() ||
    source.accountKey !== params.accountKey ||
    source.productKey !== params.productKey ||
    source.id !== version.sourceId ||
    source.sha256 !== version.sourceSha256 ||
    source.objectVersionId !== version.sourceObjectVersionId ||
    captureEvidence.sourceId !== source.id ||
    captureEvidence.linkedIngestSourceId !== source.id ||
    captureEvidence.consentedParticipantSnapshotDigest !== approval.participantSnapshotDigest ||
    typeof approval.approvedByAdminId !== 'string' ||
    !approval.approvedByAdminId.trim() ||
    !Number.isFinite(Date.parse(approval.approvedAt)) ||
    approval.contentVersionDigestVersion !== CONTENT_VERSION_DIGEST_VERSION ||
    !SHA256_PATTERN.test(approval.contentVersionDigest)
  ) {
    fail(
      'invalidState',
      'Approved publication evidence does not match the composite source scope.',
    );
  }
  validateControlledCapture(captureEvidence, source);
  assertParticipantReviewEvidence({
    review: participantReview,
    version,
    captureEvidence,
    recordingParticipantSnapshots,
    approvedByAdminId: approval.approvedByAdminId,
    approvedAt: approval.approvedAt,
  });
  const { artifacts, seed } = approvedPublicationArtifacts(
    version,
    approval.approvedByAdminId,
    approval.approvedAt,
  );
  const approvedArtifactSetDigest = publicationArtifactSetDigest(version.artifacts);
  const sourceEvidenceDigest = publicationSourceEvidenceDigest({
    params,
    sourceId: source.id,
    sourceSha256: source.sha256,
    sourceObjectVersionId: source.objectVersionId,
    contentId: version.contentId,
    captureEvidence,
    participantReview,
  });
  const contentVersionDigest = publicationContentVersionDigest({
    version,
    approvedArtifactSetDigest,
    sourceEvidenceDigest,
  });
  if (
    approvedArtifactSetDigest !== approval.approvedArtifactSetDigest ||
    sourceEvidenceDigest !== approval.sourceEvidenceDigest ||
    contentVersionDigest !== approval.contentVersionDigest
  ) {
    fail('invalidState', 'Persisted publication approval evidence is stale or mismatched.');
  }
  const core = {
    accountKey: params.accountKey,
    productKey: params.productKey,
    contentId: version.contentId,
    contentVersionId: params.contentVersionId,
    contentVersionDigest,
    sourceId: source.id,
    sourceSha256: source.sha256,
    sourceObjectVersionId: source.objectVersionId,
    participantSetVersion: participantReview.participantSetVersion,
    participantSnapshotDigest: approval.participantSnapshotDigest,
    participantReviewState: 'complete' as const,
    unresolvedParticipantCount: participantReview.unresolvedParticipantCount,
    requiredRedactionCount: participantReview.requiredRedactionCount,
    completedRedactionCount: participantReview.completedRedactionCount,
    redactionReviewDigest: participantReview.redactionReviewDigest,
    title: seed.title,
    englishTranscriptText: seed.englishTranscriptText,
    classTopic: seed.classTopic,
    mishnahReferences: [...seed.mishnahReferences],
    occurredAt: captureEvidence.capturedAt,
    durationMs: seed.durationMs,
    approvedByAdminId: approval.approvedByAdminId,
    approvedAt: approval.approvedAt,
    artifacts,
    approvedArtifactSetDigest,
    sourceEvidenceDigest,
  };
  return {
    ...core,
    projectionDigest: processingSha256(JSON.stringify(core)),
  };
}

export function scheduleProcessingFailure(input: {
  version: ContentProcessingVersion;
  safeErrorCode: string;
  occurredAt: string;
}): ContentProcessingVersion {
  const attemptCount = input.version.attemptCount + 1;
  const deadLettered = attemptCount >= CONTENT_PROCESSING_MAX_ATTEMPTS;
  const next: ContentProcessingVersion = {
    ...input.version,
    state: deadLettered ? 'dead_lettered' : 'failed',
    retryState: deadLettered ? 'dead_lettered' : 'retry_wait',
    attemptCount,
    lastSafeErrorCode: input.safeErrorCode,
    version: input.version.version + 1,
    updatedAt: input.occurredAt,
  };
  if (deadLettered) {
    delete next.retryAt;
  } else {
    next.retryAt = new Date(
      Date.parse(input.occurredAt) + Math.min(3600, 2 ** attemptCount * 30) * 1000,
    ).toISOString();
  }
  return next;
}

export function registeredLearningSchemaDigest() {
  return processingSha256(JSON.stringify(OT_LEARNING_DRAFT_JSON_SCHEMA));
}

function learningMetadata(): Partial<ProcessingArtifact> {
  return {
    model: OT_LEARNING_DRAFT_1_OPERATION.model,
    operationVersion: OT_LEARNING_DRAFT_1_OPERATION.contractVersion,
    promptVersion: OT_LEARNING_DRAFT_1_OPERATION.promptTemplateDigestVersion,
    schemaVersion: OT_LEARNING_DRAFT_1_OPERATION.schemaVersion,
  };
}

function hasExpectedPublicationArtifactMetadata(
  artifact: ProcessingArtifact,
  version: ContentProcessingVersion,
) {
  const expected: Record<
    ProcessingArtifact['kind'],
    {
      model: string | null;
      operationVersion: string | null;
      promptVersion: string | null;
      schemaVersion: string | null;
    }
  > = {
    trim: {
      model: null,
      operationVersion: version.trim.trimVersion,
      promptVersion: null,
      schemaVersion: null,
    },
    compressed_video: {
      model: null,
      operationVersion: OT_VIDEO_1_PROFILE.version,
      promptVersion: null,
      schemaVersion: null,
    },
    transcript: {
      model: OT_TRANSCRIBE_1_OPERATION.model,
      operationVersion: OT_TRANSCRIBE_1_OPERATION.contractVersion,
      promptVersion: OT_TRANSCRIBE_1_OPERATION.promptTemplateDigestVersion,
      schemaVersion: null,
    },
    captions: {
      model: OT_TRANSCRIBE_1_OPERATION.model,
      operationVersion: OT_TRANSCRIBE_1_OPERATION.contractVersion,
      promptVersion: null,
      schemaVersion: null,
    },
    review_material: {
      model: OT_LEARNING_DRAFT_1_OPERATION.model,
      operationVersion: OT_LEARNING_DRAFT_1_OPERATION.contractVersion,
      promptVersion: OT_LEARNING_DRAFT_1_OPERATION.promptTemplateDigestVersion,
      schemaVersion: OT_LEARNING_DRAFT_1_OPERATION.schemaVersion,
    },
    worksheet: {
      model: OT_LEARNING_DRAFT_1_OPERATION.model,
      operationVersion: OT_LEARNING_DRAFT_1_OPERATION.contractVersion,
      promptVersion: OT_LEARNING_DRAFT_1_OPERATION.promptTemplateDigestVersion,
      schemaVersion: OT_LEARNING_DRAFT_1_OPERATION.schemaVersion,
    },
    knowledge_artifact: {
      model: OT_LEARNING_DRAFT_1_OPERATION.model,
      operationVersion: OT_LEARNING_DRAFT_1_OPERATION.contractVersion,
      promptVersion: OT_LEARNING_DRAFT_1_OPERATION.promptTemplateDigestVersion,
      schemaVersion: OT_LEARNING_DRAFT_1_OPERATION.schemaVersion,
    },
  };
  const metadata = expected[artifact.kind];
  return (
    (artifact.model ?? null) === metadata.model &&
    (artifact.operationVersion ?? null) === metadata.operationVersion &&
    (artifact.promptVersion ?? null) === metadata.promptVersion &&
    (artifact.schemaVersion ?? null) === metadata.schemaVersion
  );
}

const REQUIRED_PUBLICATION_ARTIFACT_KINDS: readonly ProcessingArtifact['kind'][] = [
  'trim',
  'compressed_video',
  'transcript',
  'captions',
  'review_material',
  'worksheet',
  'knowledge_artifact',
];

function approvedPublicationArtifacts(
  version: ContentProcessingVersion,
  approvedByAdminId: string,
  approvedAt: string,
): {
  artifacts: readonly ApprovedForPublicationArtifact[];
  seed: {
    title: string;
    englishTranscriptText: string;
    classTopic: string;
    mishnahReferences: readonly string[];
    durationMs: number;
  };
} {
  if (
    !Array.isArray(version.artifacts) ||
    version.artifacts.length !== REQUIRED_PUBLICATION_ARTIFACT_KINDS.length
  ) {
    fail('invalidState', 'Exactly one latest revision of every publication artifact is required.');
  }
  const artifacts = [...version.artifacts].sort((left, right) =>
    left.kind.localeCompare(right.kind),
  );
  if (
    new Set(artifacts.map(({ kind }) => kind)).size !==
      REQUIRED_PUBLICATION_ARTIFACT_KINDS.length ||
    REQUIRED_PUBLICATION_ARTIFACT_KINDS.some(
      (kind) => !artifacts.some((item) => item.kind === kind),
    ) ||
    artifacts.some(
      (artifact) =>
        artifact.accountKey !== version.accountKey ||
        artifact.productKey !== version.productKey ||
        artifact.contentVersionId !== version.id ||
        artifact.sourceId !== version.sourceId ||
        artifact.sourceSha256 !== version.sourceSha256 ||
        artifact.sourceObjectVersionId !== version.sourceObjectVersionId ||
        artifact.status !== 'approved' ||
        artifact.approvedByAdminId !== approvedByAdminId ||
        artifact.approvedAt !== approvedAt ||
        typeof artifact.id !== 'string' ||
        !artifact.id.trim() ||
        !Number.isSafeInteger(artifact.revision) ||
        artifact.revision < 1 ||
        !SHA256_PATTERN.test(artifact.payloadDigest) ||
        processingSha256(JSON.stringify(artifact.payload)) !== artifact.payloadDigest ||
        !hasExpectedPublicationArtifactMetadata(artifact, version),
    )
  ) {
    fail('invalidState', 'Latest approved artifacts do not match the composite publication scope.');
  }
  if (
    !version.transcodePlan ||
    !version.trim ||
    version.transcodePlan.sourceId !== version.sourceId ||
    version.transcodePlan.sourceSha256 !== version.sourceSha256 ||
    version.transcodePlan.sourceObjectVersionId !== version.sourceObjectVersionId ||
    JSON.stringify(version.transcodePlan.trim) !== JSON.stringify(version.trim)
  ) {
    fail('invalidState', 'The persisted transcode plan is stale or source-mismatched.');
  }
  const trimArtifact = artifacts.find(({ kind }) => kind === 'trim');
  const videoArtifact = artifacts.find(({ kind }) => kind === 'compressed_video');
  const transcriptArtifact = artifacts.find(({ kind }) => kind === 'transcript');
  const reviewArtifact = artifacts.find(({ kind }) => kind === 'review_material');
  if (
    !trimArtifact ||
    !videoArtifact ||
    !transcriptArtifact ||
    !reviewArtifact ||
    JSON.stringify(trimArtifact.payload) !== JSON.stringify(version.trim)
  ) {
    fail('invalidState', 'Approved publication seed artifacts are incomplete or stale.');
  }
  const review = objectRecord(reviewArtifact.payload);
  const title = exactPublicMetadataString(review?.title);
  const classTopic = exactPublicMetadataString(review?.classTopic);
  const mishnahReferences = exactMishnahReferences(review?.mishnahReferences);
  if (
    !review ||
    !title ||
    !classTopic ||
    !mishnahReferences ||
    [title, classTopic, ...mishnahReferences].some((value) => PRIVATE_MATERIAL_PATTERN.test(value))
  ) {
    fail('invalidState', 'Approved title, topic, and Mishnah references are incomplete.');
  }
  const transcript = objectRecord(transcriptArtifact.payload);
  const transcriptSegments = transcript?.segments;
  if (
    !transcript ||
    transcript.language !== CONTENT_PROCESSING_LANGUAGE ||
    transcript.complete !== true ||
    transcript.sourceId !== version.sourceId ||
    transcript.sourceSha256 !== version.sourceSha256 ||
    transcript.sourceObjectVersionId !== version.sourceObjectVersionId ||
    JSON.stringify(transcript.operation) !== JSON.stringify(OT_TRANSCRIBE_1_OPERATION) ||
    ![
      transcript.providerProjectIdDigest,
      transcript.providerRequestDigest,
      transcript.providerResultDigest,
    ].every((digest) => typeof digest === 'string' && SHA256_PATTERN.test(digest)) ||
    !Array.isArray(transcriptSegments) ||
    transcriptSegments.length < 1
  ) {
    fail('invalidState', 'Approved English transcript evidence is incomplete.');
  }
  let priorTranscriptEnd = -1;
  const transcriptText: string[] = [];
  for (const value of transcriptSegments) {
    const segment = objectRecord(value);
    if (
      !segment ||
      typeof segment.segmentId !== 'string' ||
      !SHA256_PATTERN.test(segment.segmentId) ||
      typeof segment.providerResultDigest !== 'string' ||
      !SHA256_PATTERN.test(segment.providerResultDigest) ||
      typeof segment.text !== 'string' ||
      !segment.text.trim() ||
      segment.text !== segment.text.trim() ||
      !Number.isSafeInteger(segment.startMs) ||
      !Number.isSafeInteger(segment.endMs) ||
      (segment.startMs as number) < 0 ||
      (segment.endMs as number) <= (segment.startMs as number) ||
      (segment.startMs as number) < priorTranscriptEnd
    ) {
      fail('invalidState', 'Approved transcript segments are incomplete or unordered.');
    }
    priorTranscriptEnd = segment.endMs as number;
    transcriptText.push(segment.text);
  }
  const derivative = objectRecord(videoArtifact.payload);
  if (
    !derivative ||
    derivative.profileVersion !== OT_VIDEO_1_PROFILE.version ||
    typeof derivative.objectVersionId !== 'string' ||
    !derivative.objectVersionId.trim() ||
    !Number.isSafeInteger(derivative.byteCount) ||
    (derivative.byteCount as number) < 1 ||
    typeof derivative.sha256 !== 'string' ||
    !SHA256_PATTERN.test(derivative.sha256) ||
    derivative.container !== 'mp4' ||
    !Number.isSafeInteger(derivative.durationMs) ||
    (derivative.durationMs as number) < 1 ||
    Math.abs((derivative.durationMs as number) - version.trim.outputDurationMs) > 1_000 ||
    !Number.isSafeInteger(derivative.width) ||
    !Number.isSafeInteger(derivative.height) ||
    (derivative.width as number) < 1 ||
    (derivative.height as number) < 1 ||
    (derivative.width as number) > OT_VIDEO_1_PROFILE.maxWidth ||
    (derivative.height as number) > OT_VIDEO_1_PROFILE.maxHeight ||
    typeof derivative.framesPerSecond !== 'number' ||
    derivative.framesPerSecond <= 0 ||
    derivative.framesPerSecond > OT_VIDEO_1_PROFILE.maxFramesPerSecond ||
    derivative.videoCodec !== 'h264' ||
    derivative.pixelFormat !== 'yuv420p' ||
    derivative.audioCodec !== 'aac' ||
    derivative.audioProfile !== 'LC' ||
    derivative.audioSampleRateHz !== OT_VIDEO_1_PROFILE.audioSampleRateHz ||
    derivative.audioChannels !== OT_VIDEO_1_PROFILE.audioChannels ||
    derivative.audioBitrateBps !== OT_VIDEO_1_PROFILE.audioBitrateBps ||
    derivative.fastStart !== true ||
    derivative.decodeFailure !== false ||
    derivative.sourceMetadataRemoved !== true
  ) {
    fail('invalidState', 'Approved video duration and derivative evidence are incomplete.');
  }
  return {
    artifacts: artifacts.map(
      ({
        id,
        kind,
        revision,
        payloadDigest,
        model,
        operationVersion,
        promptVersion,
        schemaVersion,
      }) => ({
        artifactId: id,
        kind,
        revision,
        payloadDigest,
        model: model ?? null,
        operationVersion: operationVersion ?? null,
        promptVersion: promptVersion ?? null,
        schemaVersion: schemaVersion ?? null,
      }),
    ),
    seed: {
      title,
      englishTranscriptText: transcriptText.join('\n'),
      classTopic,
      mishnahReferences,
      durationMs: derivative.durationMs as number,
    },
  };
}

function publicationArtifactSetDigest(artifacts: readonly ProcessingArtifact[]) {
  return processingSha256(
    JSON.stringify(
      [...artifacts]
        .sort((left, right) => left.kind.localeCompare(right.kind))
        .map(
          ({
            id,
            kind,
            revision,
            payloadDigest,
            model,
            operationVersion,
            promptVersion,
            schemaVersion,
            sourceId,
            sourceSha256,
            sourceObjectVersionId,
            approvedByAdminId,
            approvedAt,
          }) => ({
            artifactId: id,
            kind,
            revision,
            payloadDigest,
            model: model ?? null,
            operationVersion: operationVersion ?? null,
            promptVersion: promptVersion ?? null,
            schemaVersion: schemaVersion ?? null,
            sourceId,
            sourceSha256,
            sourceObjectVersionId,
            approvedByAdminId,
            approvedAt,
          }),
        ),
    ),
  );
}

function publicationSourceEvidenceDigest(input: {
  params: ApprovedForPublicationProjectionParams;
  sourceId: string;
  sourceSha256: string;
  sourceObjectVersionId: string;
  contentId: string;
  captureEvidence: ControlledCaptureEvidence;
  participantReview: ContentParticipantReviewEvidence;
}) {
  return processingSha256(
    JSON.stringify({
      accountKey: input.params.accountKey,
      productKey: input.params.productKey,
      contentId: input.contentId,
      contentVersionId: input.params.contentVersionId,
      sourceId: input.sourceId,
      sourceSha256: input.sourceSha256,
      sourceObjectVersionId: input.sourceObjectVersionId,
      captureEvidence: {
        evidenceVersion: input.captureEvidence.evidenceVersion,
        sourceId: input.captureEvidence.sourceId,
        occurrenceId: input.captureEvidence.occurrenceId,
        captureMethod: input.captureEvidence.captureMethod,
        zoomCloudRecordingDisabled: input.captureEvidence.zoomCloudRecordingDisabled,
        controlledEncryptedDevice: input.captureEvidence.controlledEncryptedDevice,
        accountOwnerConsentVersion: input.captureEvidence.accountOwnerConsentVersion,
        consentedParticipantSnapshotDigest:
          input.captureEvidence.consentedParticipantSnapshotDigest,
        recordingNotice: input.captureEvidence.recordingNotice,
        capturedAt: input.captureEvidence.capturedAt,
        uploadConfirmedAt: input.captureEvidence.uploadConfirmedAt,
        durableChecksumReadbackReceiptId: input.captureEvidence.durableChecksumReadbackReceiptId,
        linkedIngestSourceId: input.captureEvidence.linkedIngestSourceId,
      },
      participantReview: {
        evidenceVersion: input.participantReview.evidenceVersion,
        accountKey: input.participantReview.accountKey,
        productKey: input.participantReview.productKey,
        contentVersionId: input.participantReview.contentVersionId,
        sourceId: input.participantReview.sourceId,
        occurrenceId: input.participantReview.occurrenceId,
        participantSetVersion: input.participantReview.participantSetVersion,
        participantSnapshotDigest: input.participantReview.participantSnapshotDigest,
        participantReviewState: input.participantReview.participantReviewState,
        unresolvedParticipantCount: input.participantReview.unresolvedParticipantCount,
        requiredRedactionCount: input.participantReview.requiredRedactionCount,
        completedRedactionCount: input.participantReview.completedRedactionCount,
        redactionReviewDigest: input.participantReview.redactionReviewDigest,
        reviewedByAdminId: input.participantReview.reviewedByAdminId,
        reviewedAt: input.participantReview.reviewedAt,
        sourceEvidence: canonicalParticipantReviewSourceEvidence(
          input.participantReview.sourceEvidence,
        ),
      },
    }),
  );
}

function publicationContentVersionDigest(input: {
  version: ContentProcessingVersion;
  approvedArtifactSetDigest: string;
  sourceEvidenceDigest: string;
}) {
  return processingSha256(
    JSON.stringify({
      digestVersion: CONTENT_VERSION_DIGEST_VERSION,
      accountKey: input.version.accountKey,
      productKey: input.version.productKey,
      contentId: input.version.contentId,
      contentVersionId: input.version.id,
      sourceId: input.version.sourceId,
      sourceSha256: input.version.sourceSha256,
      sourceObjectVersionId: input.version.sourceObjectVersionId,
      runtimeTier: input.version.runtimeTier,
      trim: {
        trimVersion: input.version.trim.trimVersion,
        sourceDurationMs: input.version.trim.sourceDurationMs,
        startMs: input.version.trim.startMs,
        endMs: input.version.trim.endMs,
        outputDurationMs: input.version.trim.outputDurationMs,
        selectedByAdminId: input.version.trim.selectedByAdminId,
        selectedAt: input.version.trim.selectedAt,
      },
      transcode: {
        profileVersion: input.version.transcodePlan.profile.version,
        targetWidth: input.version.transcodePlan.targetWidth,
        targetHeight: input.version.transcodePlan.targetHeight,
        targetFramesPerSecond: input.version.transcodePlan.targetFramesPerSecond,
        boundedMemory: input.version.transcodePlan.boundedMemory,
        replacesOriginal: input.version.transcodePlan.replacesOriginal,
      },
      approvedArtifactSetDigest: input.approvedArtifactSetDigest,
      sourceEvidenceDigest: input.sourceEvidenceDigest,
    }),
  );
}

export function recordingParticipantSnapshotSetDigest(
  snapshots: readonly RecordingParticipantSnapshot[],
) {
  return processingSha256(JSON.stringify(canonicalRecordingParticipantSnapshots(snapshots)));
}

function buildParticipantReviewSourceEvidence(input: {
  version: ContentProcessingVersion;
  recordingParticipantSnapshots: readonly RecordingParticipantSnapshot[];
  participantReviews: readonly ContentParticipantReviewInput[];
  reviewedByAdminId: string;
  reviewedAt: string;
}): ContentParticipantReviewSourceEvidence {
  const snapshots = validatedRecordingParticipantSnapshots({
    version: input.version,
    snapshots: input.recordingParticipantSnapshots,
    reviewedAt: input.reviewedAt,
  });
  if (
    !exactIdentifier(input.reviewedByAdminId) ||
    !Number.isFinite(Date.parse(input.reviewedAt)) ||
    input.participantReviews.length !== snapshots.length
  ) {
    participantEvidenceFailure();
  }
  const reviewBySnapshotId = new Map(
    input.participantReviews.map((review) => [review.recordingParticipantSnapshotId, review]),
  );
  if (reviewBySnapshotId.size !== snapshots.length) participantEvidenceFailure();
  const transcriptSegmentIds = exactTranscriptSegmentIds(input.version);
  const participantReviews = snapshots.map((snapshot) => {
    const review = reviewBySnapshotId.get(snapshot.snapshot_id);
    if (!review || review.studentId !== snapshot.student_id) participantEvidenceFailure();
    return canonicalParticipantAdminReview({
      review,
      snapshot,
      transcriptSegmentIds,
      outputDurationMs: input.version.trim.outputDurationMs,
      reviewedByAdminId: input.reviewedByAdminId,
      reviewedAt: input.reviewedAt,
    });
  });
  return {
    evidenceVersion: 'OT-CONTENT-PARTICIPANT-REVIEW-SOURCE-1',
    occurrenceId: input.version.contentId,
    recordingParticipantSnapshotSetDigest: recordingParticipantSnapshotSetDigest(snapshots),
    recordingParticipantSnapshotIds: snapshots.map(({ snapshot_id }) => snapshot_id),
    participantReviews,
  };
}

function participantReviewEvidenceFromArtifacts(input: {
  version: ContentProcessingVersion;
  captureEvidence: ControlledCaptureEvidence;
  recordingParticipantSnapshots: readonly RecordingParticipantSnapshot[];
  approvedByAdminId: string;
  approvedAt: string;
}): ContentParticipantReviewEvidence {
  const sourceEvidence = persistedParticipantReviewSourceEvidence({
    version: input.version,
    recordingParticipantSnapshots: input.recordingParticipantSnapshots,
    approvedByAdminId: input.approvedByAdminId,
    approvedAt: input.approvedAt,
  });
  const { captureEvidence, version } = input;
  const capturedAt = Date.parse(captureEvidence.capturedAt);
  const uploadedAt = Date.parse(captureEvidence.uploadConfirmedAt);
  const reviewedAt = Date.parse(sourceEvidence.participantReviews[0]?.reviewedAt ?? '');
  const approvedAt = Date.parse(input.approvedAt);
  if (
    !exactIdentifier(version.contentId) ||
    captureEvidence.evidenceVersion !== 'OT-OBS-CAPTURE-1' ||
    captureEvidence.captureMethod !== 'obs' ||
    captureEvidence.zoomCloudRecordingDisabled !== true ||
    captureEvidence.controlledEncryptedDevice !== true ||
    captureEvidence.recordingNotice !== 'visible_and_verbal' ||
    captureEvidence.sourceId !== version.sourceId ||
    captureEvidence.linkedIngestSourceId !== version.sourceId ||
    captureEvidence.occurrenceId !== version.contentId ||
    !exactIdentifier(captureEvidence.accountOwnerConsentVersion) ||
    !exactIdentifier(captureEvidence.durableChecksumReadbackReceiptId) ||
    !SHA256_PATTERN.test(captureEvidence.consentedParticipantSnapshotDigest) ||
    sourceEvidence.occurrenceId !== version.contentId ||
    sourceEvidence.recordingParticipantSnapshotSetDigest !==
      captureEvidence.consentedParticipantSnapshotDigest ||
    !Number.isFinite(capturedAt) ||
    !Number.isFinite(uploadedAt) ||
    !Number.isFinite(reviewedAt) ||
    !Number.isFinite(approvedAt) ||
    uploadedAt < capturedAt ||
    uploadedAt - capturedAt > 24 * 60 * 60 * 1000 ||
    reviewedAt < uploadedAt ||
    approvedAt < reviewedAt
  ) {
    participantEvidenceFailure();
  }
  const requiredRedactionCount = sourceEvidence.participantReviews.reduce(
    (sum, review) => sum + review.requiredRedactionActions.length,
    0,
  );
  const completedRedactionCount = sourceEvidence.participantReviews.reduce(
    (sum, review) => sum + review.completedRedactionActions.length,
    0,
  );
  if (requiredRedactionCount !== completedRedactionCount) participantEvidenceFailure();
  const participantSetVersion = processingSha256(
    JSON.stringify(canonicalParticipantReviewSourceEvidence(sourceEvidence)),
  );
  const redactionReviewDigest = processingSha256(
    JSON.stringify({
      evidenceVersion: 'OT-CONTENT-REDACTION-REVIEW-1',
      sourceEvidence: canonicalParticipantReviewSourceEvidence(sourceEvidence),
      requiredRedactionCount,
      completedRedactionCount,
    }),
  );
  return {
    evidenceVersion: 'OT-CONTENT-PARTICIPANT-REVIEW-1',
    accountKey: version.accountKey,
    productKey: version.productKey,
    contentVersionId: version.id,
    sourceId: version.sourceId,
    occurrenceId: version.contentId,
    participantSetVersion,
    participantSnapshotDigest: captureEvidence.consentedParticipantSnapshotDigest,
    participantReviewState: 'complete',
    unresolvedParticipantCount: 0,
    requiredRedactionCount,
    completedRedactionCount,
    redactionReviewDigest,
    reviewedByAdminId: input.approvedByAdminId,
    reviewedAt: sourceEvidence.participantReviews[0]!.reviewedAt,
    sourceEvidence,
  };
}

function assertParticipantReviewEvidence(input: {
  review: ContentParticipantReviewEvidence;
  version: ContentProcessingVersion;
  captureEvidence: ControlledCaptureEvidence;
  recordingParticipantSnapshots: readonly RecordingParticipantSnapshot[];
  approvedByAdminId: string;
  approvedAt: string;
}) {
  const expected = participantReviewEvidenceFromArtifacts(input);
  const review = input.review;
  if (
    review.evidenceVersion !== expected.evidenceVersion ||
    review.accountKey !== expected.accountKey ||
    review.productKey !== expected.productKey ||
    review.contentVersionId !== expected.contentVersionId ||
    review.sourceId !== expected.sourceId ||
    review.occurrenceId !== expected.occurrenceId ||
    review.participantSetVersion !== expected.participantSetVersion ||
    review.participantSnapshotDigest !== expected.participantSnapshotDigest ||
    review.participantReviewState !== expected.participantReviewState ||
    review.unresolvedParticipantCount !== expected.unresolvedParticipantCount ||
    review.requiredRedactionCount !== expected.requiredRedactionCount ||
    review.completedRedactionCount !== expected.completedRedactionCount ||
    review.redactionReviewDigest !== expected.redactionReviewDigest ||
    review.reviewedByAdminId !== expected.reviewedByAdminId ||
    review.reviewedAt !== expected.reviewedAt ||
    !sameParticipantReviewSourceEvidence(review.sourceEvidence, expected.sourceEvidence)
  ) {
    participantEvidenceFailure();
  }
}

function persistedParticipantReviewSourceEvidence(input: {
  version: ContentProcessingVersion;
  recordingParticipantSnapshots: readonly RecordingParticipantSnapshot[];
  approvedByAdminId: string;
  approvedAt: string;
}) {
  const reviewArtifact = input.version.artifacts.find(({ kind }) => kind === 'review_material');
  const payload = objectRecord(reviewArtifact?.payload);
  const persisted = objectRecord(payload?.participantReview);
  if (
    !reviewArtifact ||
    !persisted ||
    persisted.evidenceVersion !== 'OT-CONTENT-PARTICIPANT-REVIEW-SOURCE-1' ||
    persisted.occurrenceId !== input.version.contentId ||
    !Array.isArray(persisted.recordingParticipantSnapshotIds) ||
    !Array.isArray(persisted.participantReviews) ||
    !SHA256_PATTERN.test(String(persisted.recordingParticipantSnapshotSetDigest ?? ''))
  ) {
    participantEvidenceFailure();
  }
  const rawReviews = persisted.participantReviews.map((value) => {
    const review = objectRecord(value);
    const detection = objectRecord(review?.detection);
    if (
      !review ||
      !detection ||
      !Array.isArray(detection.mediaIntervals) ||
      !Array.isArray(detection.transcriptSegmentIds) ||
      review.reviewedByAdminId !== input.approvedByAdminId ||
      !Number.isFinite(Date.parse(String(review.reviewedAt ?? ''))) ||
      Date.parse(String(review.reviewedAt)) > Date.parse(input.approvedAt)
    ) {
      participantEvidenceFailure();
    }
    return {
      input: {
        studentId: review.studentId,
        recordingParticipantSnapshotId: review.recordingParticipantSnapshotId,
        detection: {
          detectorVersion: detection.detectorVersion,
          mediaIntervals: detection.mediaIntervals,
          transcriptSegmentIds: detection.transcriptSegmentIds,
        },
        presenceDecision: review.presenceDecision,
        requiredRedactionActions: review.requiredRedactionActions,
        completedRedactionActions: review.completedRedactionActions,
      } as ContentParticipantReviewInput,
      detectionEvidenceDigest: detection.detectionEvidenceDigest,
      reviewedAt: review.reviewedAt as string,
    };
  });
  const reviewedAt = rawReviews[0]?.reviewedAt;
  if (
    !reviewedAt ||
    rawReviews.some(({ reviewedAt: itemReviewedAt }) => itemReviewedAt !== reviewedAt)
  ) {
    participantEvidenceFailure();
  }
  const normalized = buildParticipantReviewSourceEvidence({
    version: input.version,
    recordingParticipantSnapshots: input.recordingParticipantSnapshots,
    participantReviews: rawReviews.map(({ input: review }) => review),
    reviewedByAdminId: input.approvedByAdminId,
    reviewedAt,
  });
  if (
    persisted.recordingParticipantSnapshotSetDigest !==
      normalized.recordingParticipantSnapshotSetDigest ||
    !sameStringArray(
      persisted.recordingParticipantSnapshotIds,
      normalized.recordingParticipantSnapshotIds,
    ) ||
    rawReviews.some(
      ({ detectionEvidenceDigest }, index) =>
        detectionEvidenceDigest !==
        normalized.participantReviews[index]?.detection.detectionEvidenceDigest,
    )
  ) {
    participantEvidenceFailure();
  }
  return normalized;
}

function validatedRecordingParticipantSnapshots(input: {
  version: ContentProcessingVersion;
  snapshots: readonly RecordingParticipantSnapshot[];
  reviewedAt: string;
}) {
  if (
    !Array.isArray(input.snapshots) ||
    input.snapshots.some(
      (snapshot) =>
        !objectRecord(snapshot) || !Array.isArray(objectRecord(snapshot)?.capture_intervals),
    )
  ) {
    participantEvidenceFailure();
  }
  const snapshots = canonicalRecordingParticipantSnapshots(input.snapshots);
  const seenSnapshotIds = new Set<string>();
  const seenStudentIds = new Set<string>();
  const reviewedAt = Date.parse(input.reviewedAt);
  if (snapshots.length < 1 || !Number.isFinite(reviewedAt)) participantEvidenceFailure();
  for (const snapshot of snapshots) {
    let priorEndedAt = Number.NEGATIVE_INFINITY;
    if (
      !exactIdentifier(snapshot.snapshot_id) ||
      !exactIdentifier(snapshot.student_id) ||
      !exactIdentifier(snapshot.household_id) ||
      snapshot.occurrence_id !== input.version.contentId ||
      !['self', 'dependent'].includes(snapshot.relationship) ||
      !exactIdentifier(snapshot.service_consent_event_id) ||
      !exactIdentifier(snapshot.recording_consent_event_id) ||
      !['allowed', 'anonymous', 'withdrawn'].includes(snapshot.recognition_state) ||
      snapshot.notice_state !== 'visible_and_verbal_confirmed' ||
      snapshot.evidence_source !== 'roster_and_join_readback' ||
      !exactIdentifier(snapshot.audit_ref) ||
      !Number.isFinite(Date.parse(snapshot.created_at)) ||
      Date.parse(snapshot.created_at) > reviewedAt ||
      ![
        snapshot.student_lifecycle_version,
        snapshot.enrollment_version,
        snapshot.access_version,
        snapshot.session_version,
      ].every((version) => Number.isSafeInteger(version) && version > 0) ||
      !Array.isArray(snapshot.capture_intervals) ||
      snapshot.capture_intervals.length < 1 ||
      seenSnapshotIds.has(snapshot.snapshot_id) ||
      seenStudentIds.has(snapshot.student_id)
    ) {
      participantEvidenceFailure();
    }
    seenSnapshotIds.add(snapshot.snapshot_id);
    seenStudentIds.add(snapshot.student_id);
    for (const interval of snapshot.capture_intervals) {
      const startedAt = Date.parse(interval.started_at);
      const endedAt = interval.ended_at === null ? reviewedAt : Date.parse(interval.ended_at);
      if (
        !Number.isFinite(startedAt) ||
        !Number.isFinite(endedAt) ||
        endedAt < startedAt ||
        startedAt < priorEndedAt
      ) {
        participantEvidenceFailure();
      }
      priorEndedAt = endedAt;
    }
  }
  return snapshots;
}

function canonicalRecordingParticipantSnapshots(
  snapshots: readonly RecordingParticipantSnapshot[],
): readonly RecordingParticipantSnapshot[] {
  return [...snapshots]
    .sort(
      (left, right) =>
        left.student_id.localeCompare(right.student_id) ||
        left.snapshot_id.localeCompare(right.snapshot_id),
    )
    .map((snapshot) => ({
      snapshot_id: snapshot.snapshot_id,
      occurrence_id: snapshot.occurrence_id,
      student_id: snapshot.student_id,
      household_id: snapshot.household_id,
      relationship: snapshot.relationship,
      capture_intervals: [...snapshot.capture_intervals]
        .sort(
          (left, right) =>
            left.started_at.localeCompare(right.started_at) ||
            String(left.ended_at).localeCompare(String(right.ended_at)),
        )
        .map(({ started_at, ended_at }) => ({ started_at, ended_at })),
      service_consent_event_id: snapshot.service_consent_event_id,
      recording_consent_event_id: snapshot.recording_consent_event_id,
      member_recognition_event_id: snapshot.member_recognition_event_id,
      recognition_state: snapshot.recognition_state,
      notice_state: snapshot.notice_state,
      student_lifecycle_version: snapshot.student_lifecycle_version,
      enrollment_version: snapshot.enrollment_version,
      access_version: snapshot.access_version,
      session_version: snapshot.session_version,
      evidence_source: snapshot.evidence_source,
      created_at: snapshot.created_at,
      audit_ref: snapshot.audit_ref,
    }));
}

function canonicalParticipantAdminReview(input: {
  review: ContentParticipantReviewInput;
  snapshot: RecordingParticipantSnapshot;
  transcriptSegmentIds: ReadonlySet<string>;
  outputDurationMs: number;
  reviewedByAdminId: string;
  reviewedAt: string;
}): ContentParticipantAdminReview {
  const { review } = input;
  if (
    !exactIdentifier(review.studentId) ||
    !exactIdentifier(review.recordingParticipantSnapshotId) ||
    review.studentId !== input.snapshot.student_id ||
    review.recordingParticipantSnapshotId !== input.snapshot.snapshot_id ||
    !review.detection ||
    !exactIdentifier(review.detection.detectorVersion) ||
    !Array.isArray(review.detection.mediaIntervals) ||
    !Array.isArray(review.detection.transcriptSegmentIds) ||
    !Array.isArray(review.requiredRedactionActions) ||
    !Array.isArray(review.completedRedactionActions) ||
    !['confirmed_present', 'confirmed_not_present'].includes(review.presenceDecision)
  ) {
    participantEvidenceFailure();
  }
  const mediaIntervals = [...review.detection.mediaIntervals]
    .sort(
      (left, right) =>
        left.startedAtMs - right.startedAtMs ||
        left.endedAtMs - right.endedAtMs ||
        left.kind.localeCompare(right.kind),
    )
    .map(({ startedAtMs, endedAtMs, kind }) => ({ startedAtMs, endedAtMs, kind }));
  if (
    mediaIntervals.some(
      ({ startedAtMs, endedAtMs, kind }) =>
        !Number.isSafeInteger(startedAtMs) ||
        !Number.isSafeInteger(endedAtMs) ||
        startedAtMs < 0 ||
        endedAtMs <= startedAtMs ||
        endedAtMs > input.outputDurationMs ||
        !['image', 'voice'].includes(kind),
    ) ||
    new Set(
      mediaIntervals.map(
        ({ startedAtMs, endedAtMs, kind }) => `${startedAtMs}:${endedAtMs}:${kind}`,
      ),
    ).size !== mediaIntervals.length
  ) {
    participantEvidenceFailure();
  }
  const transcriptSegmentIds = [...review.detection.transcriptSegmentIds].sort();
  if (
    transcriptSegmentIds.some(
      (segmentId) =>
        !exactIdentifier(segmentId) ||
        !SHA256_PATTERN.test(segmentId) ||
        !input.transcriptSegmentIds.has(segmentId),
    ) ||
    new Set(transcriptSegmentIds).size !== transcriptSegmentIds.length
  ) {
    participantEvidenceFailure();
  }
  const requiredRedactionActions = canonicalRedactionActions(review.requiredRedactionActions);
  const completedRedactionActions = canonicalRedactionActions(review.completedRedactionActions);
  if (
    completedRedactionActions.some((action) => !requiredRedactionActions.includes(action)) ||
    (review.presenceDecision === 'confirmed_not_present' &&
      (mediaIntervals.length > 0 ||
        transcriptSegmentIds.length > 0 ||
        requiredRedactionActions.length > 0 ||
        completedRedactionActions.length > 0)) ||
    (review.presenceDecision === 'confirmed_present' &&
      mediaIntervals.length === 0 &&
      transcriptSegmentIds.length === 0)
  ) {
    participantEvidenceFailure();
  }
  const detection = {
    detectorVersion: review.detection.detectorVersion,
    mediaIntervals,
    transcriptSegmentIds,
  };
  return {
    studentId: review.studentId,
    recordingParticipantSnapshotId: review.recordingParticipantSnapshotId,
    detection: {
      ...detection,
      detectionEvidenceDigest: processingSha256(JSON.stringify(detection)),
    },
    presenceDecision: review.presenceDecision,
    requiredRedactionActions,
    completedRedactionActions,
    reviewedByAdminId: input.reviewedByAdminId,
    reviewedAt: input.reviewedAt,
  };
}

function canonicalRedactionActions(
  value: readonly ContentRedactionAction[],
): readonly ContentRedactionAction[] {
  if (
    value.some((action) => !CONTENT_REDACTION_ACTIONS.includes(action as ContentRedactionAction)) ||
    new Set(value).size !== value.length
  ) {
    participantEvidenceFailure();
  }
  return [...value].sort(
    (left, right) =>
      CONTENT_REDACTION_ACTIONS.indexOf(left) - CONTENT_REDACTION_ACTIONS.indexOf(right),
  );
}

function exactTranscriptSegmentIds(version: ContentProcessingVersion) {
  const artifact = version.artifacts.find(({ kind }) => kind === 'transcript');
  const transcript = objectRecord(artifact?.payload);
  if (!artifact || !transcript || !Array.isArray(transcript.segments)) {
    participantEvidenceFailure();
  }
  const ids = transcript.segments.map((value) => objectRecord(value)?.segmentId);
  if (
    ids.some((value) => typeof value !== 'string' || !SHA256_PATTERN.test(value)) ||
    new Set(ids).size !== ids.length
  ) {
    participantEvidenceFailure();
  }
  return new Set(ids as string[]);
}

function canonicalParticipantReviewSourceEvidence(
  evidence: ContentParticipantReviewSourceEvidence,
) {
  return {
    evidenceVersion: evidence.evidenceVersion,
    occurrenceId: evidence.occurrenceId,
    recordingParticipantSnapshotSetDigest: evidence.recordingParticipantSnapshotSetDigest,
    recordingParticipantSnapshotIds: [...evidence.recordingParticipantSnapshotIds],
    participantReviews: evidence.participantReviews.map((review) => ({
      studentId: review.studentId,
      recordingParticipantSnapshotId: review.recordingParticipantSnapshotId,
      detection: {
        detectorVersion: review.detection.detectorVersion,
        mediaIntervals: review.detection.mediaIntervals.map(({ startedAtMs, endedAtMs, kind }) => ({
          startedAtMs,
          endedAtMs,
          kind,
        })),
        transcriptSegmentIds: [...review.detection.transcriptSegmentIds],
        detectionEvidenceDigest: review.detection.detectionEvidenceDigest,
      },
      presenceDecision: review.presenceDecision,
      requiredRedactionActions: [...review.requiredRedactionActions],
      completedRedactionActions: [...review.completedRedactionActions],
      reviewedByAdminId: review.reviewedByAdminId,
      reviewedAt: review.reviewedAt,
    })),
  };
}

function sameParticipantReviewSourceEvidence(
  left: ContentParticipantReviewSourceEvidence,
  right: ContentParticipantReviewSourceEvidence,
) {
  try {
    return (
      JSON.stringify(canonicalParticipantReviewSourceEvidence(left)) ===
      JSON.stringify(canonicalParticipantReviewSourceEvidence(right))
    );
  } catch {
    return false;
  }
}

function sameStringArray(left: readonly unknown[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function exactIdentifier(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim()) && value === value.trim();
}

function participantEvidenceFailure(): never {
  fail(
    'invalidState',
    'Complete source-bound participant and redaction review evidence is required.',
  );
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function exactPublicMetadataString(value: unknown) {
  return typeof value === 'string' && value.trim() && value === value.trim() ? value : null;
}

function exactMishnahReferences(value: unknown): readonly string[] | null {
  if (
    !Array.isArray(value) ||
    value.some(
      (reference) =>
        typeof reference !== 'string' || !reference.trim() || reference !== reference.trim(),
    ) ||
    new Set(value).size !== value.length
  ) {
    return null;
  }
  return value as string[];
}

function assertAdmin(actor: ContentProcessingAdminActor, version: ContentProcessingVersion) {
  if (
    actor.role !== 'admin' ||
    actor.accountKey !== version.accountKey ||
    actor.productKey !== version.productKey
  ) {
    fail('accessDenied', 'An account- and product-scoped Admin is required.');
  }
}

function assertOpaqueLocator(locator: string) {
  if (
    !locator.trim() ||
    /(?:https?:\/\/|[;&|`$<>])/i.test(locator) ||
    /(?:student|learner|email|phone)/i.test(locator)
  ) {
    fail('invalidSource', 'Only opaque non-shell media locators are allowed.');
  }
}

function evenDimension(value: number) {
  return Math.max(2, Math.floor(value / 2) * 2);
}

function millisecondsToFfmpeg(value: number) {
  return (value / 1000).toFixed(3);
}

function fail(key: keyof typeof CONTENT_PROCESSING_ERROR_CODES, message: string): never {
  throw new ContentProcessingError(CONTENT_PROCESSING_ERROR_CODES[key], message);
}
