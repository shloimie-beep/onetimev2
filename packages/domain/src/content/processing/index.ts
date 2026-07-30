import { createHash } from 'node:crypto';

import {
  CONTENT_PROCESSING_ERROR_CODES,
  CONTENT_PROCESSING_MAX_ATTEMPTS,
  CONTENT_PROCESSING_MAX_BYTES,
  CONTENT_PROCESSING_STREAM_CHUNK_BYTES,
  OT_LEARNING_DRAFT_1_OPERATION,
  OT_LEARNING_DRAFT_JSON_SCHEMA,
  OT_TRANSCRIBE_1_OPERATION,
  OT_VIDEO_1_PROFILE,
  type AudioSegmentPlan,
  type ApprovedForPublicationArtifact,
  type ApprovedForPublicationProjection,
  type ApprovedForPublicationProjectionParams,
  type CaptionCue,
  type ContentProcessingAdminActor,
  type ContentProcessingSource,
  type ContentProcessingVersion,
  type ControlledCaptureEvidence,
  type DerivativeReadback,
  type LearningDraft,
  type LearningDraftResult,
  type MediaProbeReadback,
  type ProcessingArtifact,
  type ProcessingStoragePolicyReadback,
  type TranscriptDraft,
  type TranscriptSegment,
  type TranscodePlan,
  type TrimSelection,
} from '../../../../contracts/src/content/processing/index.ts';
import type { ManagedObjectReadback } from '../../../../contracts/src/content/ingest/index.ts';

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
    readback.kmsKeyVersionRef !== source.kmsKeyVersionRef
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
    !source.occurrenceId ||
    evidence.occurrenceId !== source.occurrenceId ||
    evidence.linkedIngestSourceId !== source.id ||
    evidence.durableChecksumReadbackReceiptId !== source.checksumReadbackReceiptId ||
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
  const segmentIds = new Set(input.transcript.segments.map((segment) => segment.segmentId));
  const referencedIds = [
    ...output.reviewQuestions.flatMap((question) => question.sourceSegmentIds),
    ...output.knowledgeArtifact.sourceSegmentIds,
  ];
  if (
    !output.title.trim() ||
    !output.summary.trim() ||
    output.reviewQuestions.length < 1 ||
    !output.worksheet.instructions.trim() ||
    output.worksheet.items.length < 1 ||
    !output.knowledgeArtifact.heading.trim() ||
    !output.knowledgeArtifact.body.trim() ||
    referencedIds.some((id) => !segmentIds.has(id)) ||
    [output.title, output.summary, output.knowledgeArtifact.body].some((text) =>
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

export function approveProcessingVersion(input: {
  actor: ContentProcessingAdminActor;
  version: ContentProcessingVersion;
  expectedVersion: number;
  privacyReviewConfirmed: boolean;
  participantSnapshotDigest: string;
  occurredAt: string;
}): ContentProcessingVersion {
  assertAdmin(input.actor, input.version);
  if (
    input.version.version !== input.expectedVersion ||
    input.version.state !== 'needs_review' ||
    input.version.artifacts.length !== 7 ||
    input.version.artifacts.some((artifact) => artifact.status !== 'draft') ||
    !input.privacyReviewConfirmed ||
    !SHA256_PATTERN.test(input.participantSnapshotDigest)
  ) {
    fail('invalidState', 'Exact-version Admin privacy review is required for approval.');
  }
  const artifacts = input.version.artifacts.map((artifact) => ({
    ...artifact,
    status: 'approved' as const,
    approvedByAdminId: input.actor.principalId,
    approvedAt: input.occurredAt,
    updatedAt: input.occurredAt,
  }));
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
    participantSnapshotDigest: input.participantSnapshotDigest,
  });
  return {
    ...input.version,
    state: 'approved',
    artifacts,
    publicationApproval: {
      evidenceVersion: 'OT-PUBLICATION-APPROVAL-1',
      participantSnapshotDigest: input.participantSnapshotDigest,
      approvedByAdminId: input.actor.principalId,
      approvedAt: input.occurredAt,
      approvedArtifactSetDigest,
      sourceEvidenceDigest,
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
}): ApprovedForPublicationProjection {
  const { params, version, source, captureEvidence } = input;
  const approval = version.publicationApproval;
  if (
    version.state !== 'approved' ||
    !approval ||
    version.accountKey !== params.accountKey ||
    version.productKey !== params.productKey ||
    version.id !== params.contentVersionId ||
    source.accountKey !== params.accountKey ||
    source.productKey !== params.productKey ||
    source.id !== version.sourceId ||
    source.sha256 !== version.sourceSha256 ||
    source.objectVersionId !== version.sourceObjectVersionId ||
    captureEvidence.sourceId !== source.id ||
    captureEvidence.linkedIngestSourceId !== source.id ||
    captureEvidence.consentedParticipantSnapshotDigest !== approval.participantSnapshotDigest ||
    !approval.approvedByAdminId.trim() ||
    !Number.isFinite(Date.parse(approval.approvedAt))
  ) {
    fail(
      'invalidState',
      'Approved publication evidence does not match the composite source scope.',
    );
  }
  validateControlledCapture(captureEvidence, source);
  const artifacts = latestApprovedPublicationArtifacts(version);
  const approvedArtifactSetDigest = publicationArtifactSetDigest(version.artifacts);
  const sourceEvidenceDigest = publicationSourceEvidenceDigest({
    params,
    sourceId: source.id,
    sourceSha256: source.sha256,
    sourceObjectVersionId: source.objectVersionId,
    participantSnapshotDigest: captureEvidence.consentedParticipantSnapshotDigest,
  });
  if (
    approvedArtifactSetDigest !== approval.approvedArtifactSetDigest ||
    sourceEvidenceDigest !== approval.sourceEvidenceDigest
  ) {
    fail('invalidState', 'Persisted publication approval evidence is stale or mismatched.');
  }
  const core = {
    accountKey: params.accountKey,
    productKey: params.productKey,
    contentVersionId: params.contentVersionId,
    sourceId: source.id,
    sourceSha256: source.sha256,
    sourceObjectVersionId: source.objectVersionId,
    participantSnapshotDigest: approval.participantSnapshotDigest,
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

const REQUIRED_PUBLICATION_ARTIFACT_KINDS: readonly ProcessingArtifact['kind'][] = [
  'trim',
  'compressed_video',
  'transcript',
  'captions',
  'review_material',
  'worksheet',
  'knowledge_artifact',
];

function latestApprovedPublicationArtifacts(
  version: ContentProcessingVersion,
): readonly ApprovedForPublicationArtifact[] {
  if (version.artifacts.length !== REQUIRED_PUBLICATION_ARTIFACT_KINDS.length) {
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
        artifact.approvedByAdminId !== version.publicationApproval?.approvedByAdminId ||
        artifact.approvedAt !== version.publicationApproval?.approvedAt ||
        !SHA256_PATTERN.test(artifact.payloadDigest),
    )
  ) {
    fail('invalidState', 'Latest approved artifacts do not match the composite publication scope.');
  }
  return artifacts.map(({ id, kind, revision, payloadDigest }) => ({
    artifactId: id,
    kind,
    revision,
    payloadDigest,
  }));
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
  participantSnapshotDigest: string;
}) {
  return processingSha256(
    JSON.stringify({
      accountKey: input.params.accountKey,
      productKey: input.params.productKey,
      contentVersionId: input.params.contentVersionId,
      sourceId: input.sourceId,
      sourceSha256: input.sourceSha256,
      sourceObjectVersionId: input.sourceObjectVersionId,
      participantSnapshotDigest: input.participantSnapshotDigest,
    }),
  );
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
