import { describe, expect, it } from 'vitest';

import {
  CONTENT_PROCESSING_MAX_BYTES,
  OT_LEARNING_DRAFT_1_OPERATION,
  OT_TRANSCRIBE_1_OPERATION,
  OT_VIDEO_1_PROFILE,
  type ContentProcessingAdminActor,
  type ContentProcessingSource,
  type ContentProcessingVersion,
  type ControlledCaptureEvidence,
  type DerivativeReadback,
  type LearningDraft,
  type MediaProbeReadback,
  type ProcessingStoragePolicyReadback,
} from '../../../../contracts/src/content/processing/index.ts';
import type { ManagedObjectReadback } from '../../../../contracts/src/content/ingest/index.ts';
import { digestBoundedMediaStream } from '../../../../../scripts/media/v21/streaming-media.ts';
import {
  approveProcessingVersion,
  buildApprovedForPublicationProjection,
  buildAudioSegmentPlan,
  buildTranscodePlan,
  createDraftArtifacts,
  editDraftArtifact,
  localCaptureDeletionDecision,
  processingSha256,
  registeredLearningSchemaDigest,
  selectTrim,
  validateControlledCapture,
  validateLearningDraft,
  validateProcessingInput,
  validateTranscriptDraft,
  verifyDerivative,
} from './index.ts';

const now = '2026-07-28T22:00:00.000Z';
const sha = (value: string) => processingSha256(value);
const actor: ContentProcessingAdminActor = {
  accountKey: 'account-1',
  productKey: 'one-time',
  principalId: 'admin-1',
  role: 'admin',
};
const source: ContentProcessingSource = {
  id: 'source-1',
  accountKey: actor.accountKey,
  productKey: actor.productKey,
  sourceKind: 'app_upload',
  captureMethod: 'obs',
  runtimeTier: 'isolated_staging',
  verificationEnvironmentId: 'p20-ci',
  bucketRef: 'bucket-ref',
  objectKeyDigest: sha('object-key'),
  objectVersionId: 'object-version-1',
  kmsKeyVersionRef: 'kms-version-1',
  checksumReadbackReceiptId: 'readback-1',
  displayFilename: 'recording.mkv',
  mimeType: 'video/x-matroska',
  container: 'mkv',
  byteCount: 4 * 1024 * 1024 * 1024,
  sha256: sha('source'),
  receivedAt: now,
  stableAt: now,
  occurrenceId: 'occurrence-1',
  matchConfidence: 'exact',
  matchedByAdminId: actor.principalId,
  retentionDueAt: '2026-10-28T22:00:00.000Z',
  lifecycleState: 'processing',
  retryState: 'ready',
  attemptCount: 0,
  originalPreserved: true,
  version: 1,
  createdAt: now,
  updatedAt: now,
};
const readback: ManagedObjectReadback = {
  runtimeTier: source.runtimeTier,
  verificationEnvironmentId: source.verificationEnvironmentId,
  region: 'eu-central-1',
  bucketRef: source.bucketRef,
  objectKeyDigest: source.objectKeyDigest,
  objectVersionId: source.objectVersionId,
  byteCount: source.byteCount,
  sha256: source.sha256,
  kmsKeyVersionRef: source.kmsKeyVersionRef,
  blockPublicAccess: true,
  bucketOwnerEnforced: true,
};
const storage: ProcessingStoragePolicyReadback = {
  policyVersion: 'OT-PROCESSING-STORAGE-1',
  provider: 'aws-s3',
  region: 'eu-central-1',
  private: true,
  versioningEnabled: true,
  encryption: 'SSE-KMS',
  blockPublicAccess: true,
  bucketOwnerEnforced: true,
  browserCredentialsExposed: false,
  bucketRef: source.bucketRef,
  kmsKeyVersionRef: source.kmsKeyVersionRef,
};
const probe: MediaProbeReadback = {
  probeVersion: 'OT-FFPROBE-1',
  readable: true,
  decodeFailure: false,
  container: 'matroska',
  durationMs: 3_900_000,
  codedWidth: 3840,
  codedHeight: 2160,
  framesPerSecond: 60,
  rotationDegrees: 0,
  videoCodec: 'h264',
  pixelFormat: 'yuv420p',
  audioCodec: 'aac',
  audioProfile: 'LC',
  audioSampleRateHz: 48_000,
  audioChannels: 2,
  videoStreamCount: 1,
  audioStreamCount: 1,
};
const captureEvidence: ControlledCaptureEvidence = {
  evidenceVersion: 'OT-OBS-CAPTURE-1',
  sourceId: source.id,
  occurrenceId: source.occurrenceId!,
  captureMethod: 'obs',
  zoomCloudRecordingDisabled: true,
  controlledEncryptedDevice: true,
  accountOwnerConsentVersion: 'CONSENT-2026-01',
  consentedParticipantSnapshotDigest: sha('participant-snapshot'),
  recordingNotice: 'visible_and_verbal',
  capturedAt: '2026-07-28T10:00:00.000Z',
  uploadConfirmedAt: '2026-07-28T20:00:00.000Z',
  durableChecksumReadbackReceiptId: source.checksumReadbackReceiptId,
  linkedIngestSourceId: source.id,
};

function prepared() {
  const trim = selectTrim({
    sourceDurationMs: probe.durationMs,
    startMs: 12_000,
    endMs: 3_840_000,
    actor,
    selectedAt: now,
  });
  const transcodePlan = buildTranscodePlan({
    source,
    probe,
    trim,
    inputLocator: 'managed/source-1',
    outputLocator: 'managed/derivative-1.mp4',
  });
  const derivative: DerivativeReadback = {
    profileVersion: 'OT-VIDEO-1',
    objectVersionId: 'derivative-version-1',
    byteCount: 2 * 1024 * 1024 * 1024,
    sha256: sha('derivative'),
    container: 'mp4',
    durationMs: trim.outputDurationMs,
    width: 1920,
    height: 1080,
    framesPerSecond: 30,
    videoCodec: 'h264',
    pixelFormat: 'yuv420p',
    audioCodec: 'aac',
    audioProfile: 'LC',
    audioSampleRateHz: 48_000,
    audioChannels: 2,
    audioBitrateBps: 128_000,
    fastStart: true,
    decodeFailure: false,
    sourceMetadataRemoved: true,
  };
  const plannedSegments = buildAudioSegmentPlan({ source, trim });
  const segmentId = plannedSegments[0]!.segmentId;
  const transcript = validateTranscriptDraft({
    source,
    plannedSegments,
    providerProjectIdDigest: sha('project'),
    providerRequestDigest: sha('transcript-request'),
    providerResultDigest: sha('transcript-result'),
    segments: plannedSegments.map((segment, index) => ({
      segmentId: segment.segmentId,
      startMs: segment.startMs,
      endMs: Math.min(segment.endMs, segment.startMs + 5_000),
      text:
        index === 0
          ? 'Today we learn a clear idea.'
          : `The lesson continues in bounded segment ${index + 1}.`,
      providerResultDigest: sha(`segment-result-${index}`),
    })),
  });
  const output: LearningDraft = {
    title: 'Lesson review',
    summary: 'A concise draft summary of the lesson.',
    reviewQuestions: [
      {
        question: 'What idea was introduced?',
        answer: 'The clear lesson idea.',
        sourceSegmentIds: [segmentId],
      },
    ],
    worksheet: {
      instructions: 'Answer using the lesson.',
      items: ['Write one example.'],
    },
    knowledgeArtifact: {
      heading: 'Lesson idea',
      body: 'The lesson presents one clear idea for later review.',
      sourceSegmentIds: [segmentId],
    },
  };
  const learning = validateLearningDraft({
    source,
    transcript,
    output,
    providerProjectIdDigest: sha('project'),
    providerRequestDigest: sha('learning-request'),
    providerResultDigest: sha('learning-result'),
    schemaDigest: registeredLearningSchemaDigest(),
  });
  const version: ContentProcessingVersion = {
    id: sha('content-version'),
    accountKey: source.accountKey,
    productKey: source.productKey,
    sourceId: source.id,
    sourceSha256: source.sha256,
    sourceObjectVersionId: source.objectVersionId,
    runtimeTier: source.runtimeTier,
    state: 'drafting',
    retryState: 'ready',
    attemptCount: 0,
    trim,
    transcodePlan,
    artifacts: [],
    version: 3,
    createdAt: now,
    updatedAt: now,
  };
  return { trim, transcodePlan, derivative, transcript, learning, version };
}

describe('P20 acceptance contract', () => {
  it('OTV2-CONTENT-084-AC01 lets Admin trim only the beginning and end', () => {
    const { trim, transcodePlan } = prepared();
    expect(trim).toMatchObject({
      startMs: 12_000,
      endMs: 3_840_000,
      outputDurationMs: 3_828_000,
    });
    expect(transcodePlan.command.args).toEqual(
      expect.arrayContaining(['-ss', '12.000', '-t', '3828.000']),
    );
    expect(() =>
      selectTrim({
        sourceDurationMs: probe.durationMs,
        startMs: 20_000,
        endMs: 10_000,
        actor,
        selectedAt: now,
      }),
    ).toThrow('one contiguous range');
  });

  it('OTV2-CONTENT-085-AC01 creates complete English transcript and captions', () => {
    const { transcript } = prepared();
    expect(transcript.language).toBe('en');
    expect(transcript.operation).toEqual(OT_TRANSCRIBE_1_OPERATION);
    expect(transcript.captions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceSegmentId: transcript.segments[0]!.segmentId,
          text: 'Today we learn a clear idea.',
        }),
      ]),
    );
  });

  it('OTV2-CONTENT-086-AC01 creates editable review, worksheet, and knowledge drafts', () => {
    const data = prepared();
    const artifacts = createDraftArtifacts({ ...data, occurredAt: now });
    const review = artifacts.find((artifact) => artifact.kind === 'review_material')!;
    const version = editDraftArtifact({
      actor,
      version: { ...data.version, state: 'needs_review', artifacts },
      artifactId: review.id,
      payload: { summary: 'Admin-corrected summary', reviewQuestions: [] },
      occurredAt: '2026-07-28T22:05:00.000Z',
    });
    expect(version.state).toBe('needs_review');
    expect(version.artifacts.find((artifact) => artifact.kind === 'review_material')).toMatchObject(
      {
        revision: 2,
        status: 'draft',
        editedByAdminId: actor.principalId,
      },
    );
  });

  it('OTV2-CONTENT-191-AC01 streams through 5 GiB and verifies OT-VIDEO-1 without upscaling', async () => {
    const data = prepared();
    expect(CONTENT_PROCESSING_MAX_BYTES).toBe(5 * 1024 * 1024 * 1024);
    expect(data.transcodePlan).toMatchObject({
      profile: OT_VIDEO_1_PROFILE,
      targetWidth: 1920,
      targetHeight: 1080,
      targetFramesPerSecond: 30,
      boundedMemory: true,
      replacesOriginal: false,
    });
    expect(verifyDerivative(data.derivative, { source, plan: data.transcodePlan })).toMatchObject({
      sizeOutcome: 'smaller',
      originalPreserved: true,
    });
    async function* chunks() {
      yield new Uint8Array([1, 2]);
      yield new Uint8Array([3, 4]);
    }
    await expect(digestBoundedMediaStream(chunks())).resolves.toMatchObject({
      byteCount: 4,
      largestChunkBytes: 2,
      wholeFileBuffered: false,
    });
  });

  it('OTV2-CONTENT-193-AC01 keeps every output draft until exact Admin approval', () => {
    const data = prepared();
    const artifacts = createDraftArtifacts({ ...data, occurredAt: now });
    expect(artifacts).toHaveLength(7);
    expect(new Set(artifacts.map((artifact) => artifact.status))).toEqual(new Set(['draft']));
    const approved = approveProcessingVersion({
      actor,
      version: { ...data.version, state: 'needs_review', artifacts },
      expectedVersion: data.version.version,
      privacyReviewConfirmed: true,
      participantSnapshotDigest: captureEvidence.consentedParticipantSnapshotDigest,
      occurredAt: '2026-07-28T22:10:00.000Z',
    });
    expect(approved.state).toBe('approved');
    expect(approved.artifacts.every((artifact) => artifact.status === 'approved')).toBe(true);
  });

  it('builds one deterministic composite approved-for-publication projection and exact replay', () => {
    const fixture = approvedPublicationFixture();
    const projection = buildApprovedForPublicationProjection(fixture);
    expect(projection).toMatchObject({
      accountKey: actor.accountKey,
      productKey: actor.productKey,
      contentVersionId: fixture.version.id,
      sourceId: source.id,
      sourceSha256: source.sha256,
      sourceObjectVersionId: source.objectVersionId,
      participantSnapshotDigest: captureEvidence.consentedParticipantSnapshotDigest,
      approvedByAdminId: actor.principalId,
      artifacts: expect.arrayContaining([
        expect.objectContaining({ kind: 'trim' }),
        expect.objectContaining({ kind: 'knowledge_artifact' }),
      ]),
    });
    expect(projection.artifacts).toHaveLength(7);
    expect(projection.projectionDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(buildApprovedForPublicationProjection(fixture)).toEqual(projection);
  });

  it('fails closed on nonapproved, missing, duplicate, stale, cross-scope, source, artifact, and participant evidence', () => {
    const fixture = approvedPublicationFixture();
    const artifact = fixture.version.artifacts[0]!;
    const cases = [
      {
        ...fixture,
        version: { ...fixture.version, state: 'needs_review' as const },
      },
      {
        ...fixture,
        version: { ...fixture.version, artifacts: fixture.version.artifacts.slice(1) },
      },
      {
        ...fixture,
        version: {
          ...fixture.version,
          artifacts: [...fixture.version.artifacts, { ...artifact, id: 'duplicate-artifact' }],
        },
      },
      {
        ...fixture,
        version: {
          ...fixture.version,
          publicationApproval: {
            ...fixture.version.publicationApproval!,
            approvedArtifactSetDigest: 'f'.repeat(64),
          },
        },
      },
      { ...fixture, params: { ...fixture.params, accountKey: 'other-account' } },
      { ...fixture, params: { ...fixture.params, productKey: 'other-product' } },
      { ...fixture, params: { ...fixture.params, contentVersionId: 'other-version' } },
      { ...fixture, source: { ...fixture.source, sha256: sha('other-source') } },
      {
        ...fixture,
        version: {
          ...fixture.version,
          artifacts: [
            { ...artifact, sourceObjectVersionId: 'other-object-version' },
            ...fixture.version.artifacts.slice(1),
          ],
        },
      },
      {
        ...fixture,
        captureEvidence: {
          ...fixture.captureEvidence,
          consentedParticipantSnapshotDigest: sha('other-participants'),
        },
      },
    ];
    for (const invalid of cases) {
      expect(() => buildApprovedForPublicationProjection(invalid)).toThrow();
    }
  });

  it('OTV2-CONTENT-233-OBS-CAPTURE gates local deletion on controlled OBS evidence', () => {
    expect(validateControlledCapture(captureEvidence, source)).toEqual(captureEvidence);
    expect(localCaptureDeletionDecision(captureEvidence, source)).toEqual({
      eligible: true,
      reason: 'durable_checksum_readback_and_ingest_linkage_confirmed',
      receiptId: source.checksumReadbackReceiptId,
      sourceId: source.id,
    });
    expect(() =>
      validateControlledCapture(
        { ...captureEvidence, uploadConfirmedAt: '2026-07-30T20:00:00.000Z' },
        source,
      ),
    ).toThrow('evidence is incomplete');
  });

  it('OTV2-CONTENT-233-STORAGE-MODELS-TRANSCODE pins storage, models, schema, and profile', () => {
    const validated = validateProcessingInput({ source, readback, probe, storage });
    const data = prepared();
    expect(validated.storage).toMatchObject({
      provider: 'aws-s3',
      region: 'eu-central-1',
      versioningEnabled: true,
      encryption: 'SSE-KMS',
      blockPublicAccess: true,
      browserCredentialsExposed: false,
    });
    expect(OT_TRANSCRIBE_1_OPERATION.model).toBe('gpt-4o-transcribe');
    expect(OT_LEARNING_DRAFT_1_OPERATION).toMatchObject({
      model: 'gpt-4.1-mini-2025-04-14',
      strict: true,
      webSearch: false,
      externalTools: false,
      conversationCarryOver: false,
    });
    expect(data.learning.schemaDigest).toBe(registeredLearningSchemaDigest());
    expect(data.transcodePlan.profile).toEqual(OT_VIDEO_1_PROFILE);
  });
});

function approvedPublicationFixture() {
  const data = prepared();
  const artifacts = createDraftArtifacts({ ...data, occurredAt: now });
  const version = approveProcessingVersion({
    actor,
    version: { ...data.version, state: 'needs_review', artifacts },
    expectedVersion: data.version.version,
    privacyReviewConfirmed: true,
    participantSnapshotDigest: captureEvidence.consentedParticipantSnapshotDigest,
    occurredAt: '2026-07-28T22:10:00.000Z',
  });
  return {
    params: {
      accountKey: version.accountKey,
      productKey: version.productKey,
      contentVersionId: version.id,
    },
    version,
    source,
    captureEvidence,
  };
}
