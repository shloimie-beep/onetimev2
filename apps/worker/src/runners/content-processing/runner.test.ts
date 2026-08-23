import { describe, expect, it } from 'vitest';

import {
  type ContentProcessingCommandReceipt,
  type ContentProcessingRepository,
  type ContentProcessingSource,
  type ContentSourceEvidence,
  type ContentProcessingUnitOfWork,
  type ContentProcessingVersion,
  type ControlledCaptureEvidence,
  type DerivativeReadback,
  type MediaProbeReadback,
  type ProcessingArtifact,
  type ProcessingStoragePolicyReadback,
} from '../../../../../packages/contracts/src/content/processing/index.ts';
import {
  processingSha256,
  registeredLearningSchemaDigest,
} from '../../../../../packages/domain/src/content/processing/index.ts';
import {
  ContentProcessingRunner,
  type ContentProcessingProvider,
  type LearningProviderReadback,
  type ProcessContentCommand,
  type TranscriptProviderReadback,
} from './runner.ts';

const sha = (value: string) => processingSha256(value);
const occurredAt = '2026-07-28T22:00:00.000Z';

function commandFixture(): ProcessContentCommand {
  const source: ContentProcessingSource = {
    id: 'source-1',
    accountKey: 'account-1',
    productKey: 'one-time',
    sourceKind: 'app_upload',
    captureMethod: 'obs',
    runtimeTier: 'isolated_staging',
    verificationEnvironmentId: 'p20-ci',
    bucketRef: 'bucket-ref',
    objectKeyDigest: sha('object'),
    objectVersionId: 'source-version-1',
    kmsKeyVersionRef: 'kms-version-1',
    checksumReadbackReceiptId: 'receipt-1',
    displayFilename: 'recording.mp4',
    mimeType: 'video/mp4',
    container: 'mp4',
    byteCount: 1024 * 1024 * 1024,
    sha256: sha('source'),
    receivedAt: occurredAt,
    stableAt: occurredAt,
    occurrenceId: 'occurrence-1',
    matchConfidence: 'exact',
    matchedByAdminId: 'admin-1',
    retentionDueAt: '2026-10-28T22:00:00.000Z',
    lifecycleState: 'processing',
    retryState: 'ready',
    attemptCount: 0,
    originalPreserved: true,
    version: 1,
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
  const probe: MediaProbeReadback = {
    probeVersion: 'OT-FFPROBE-1',
    readable: true,
    decodeFailure: false,
    container: 'mp4',
    durationMs: 100_000,
    codedWidth: 1280,
    codedHeight: 720,
    framesPerSecond: 25,
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
  const captureEvidence: ControlledCaptureEvidence = {
    evidenceVersion: 'OT-OBS-CAPTURE-1',
    sourceId: source.id,
    occurrenceId: source.occurrenceId!,
    captureMethod: 'obs',
    zoomCloudRecordingDisabled: true,
    controlledEncryptedDevice: true,
    accountOwnerConsentVersion: 'CONSENT-1',
    consentedParticipantSnapshotDigest: sha('participants'),
    recordingNotice: 'visible_and_verbal',
    capturedAt: '2026-07-28T10:00:00.000Z',
    uploadConfirmedAt: '2026-07-28T20:00:00.000Z',
    durableChecksumReadbackReceiptId: source.checksumReadbackReceiptId,
    linkedIngestSourceId: source.id,
  };
  return {
    actor: {
      accountKey: source.accountKey,
      productKey: source.productKey,
      principalId: 'admin-1',
      role: 'admin',
    },
    source,
    readback: {
      runtimeTier: source.runtimeTier,
      verificationEnvironmentId: source.verificationEnvironmentId,
      region: 'eu-central-1',
      bucketRef: source.bucketRef,
      objectKeyDigest: source.objectKeyDigest,
      objectVersionId: source.objectVersionId,
      byteCount: source.byteCount,
      durabilityEvidenceVersion: 'OT-MANAGED-ORIGINAL-1',
      checksumAlgorithm: 'sha256',
      sha256: source.sha256,
      kmsKeyVersionRef: source.kmsKeyVersionRef,
      storageClass: 'STANDARD',
      blockPublicAccess: true,
      bucketOwnerEnforced: true,
    },
    storage,
    captureEvidence,
    probe,
    trimStartMs: 1_000,
    trimEndMs: 99_000,
    inputLocator: 'managed/source',
    outputLocator: 'managed/derivative.mp4',
    idempotencyKey: 'process-1',
    requestHash: sha('request'),
    occurredAt,
  };
}

class MemoryRepository implements ContentProcessingRepository {
  versions = new Map<string, ContentProcessingVersion>();
  receipts = new Map<string, ContentProcessingCommandReceipt>();
  artifacts = new Map<string, ProcessingArtifact>();
  evidence = new Map<string, ContentSourceEvidence>();

  async inTransaction<T>(run: (unit: ContentProcessingUnitOfWork) => Promise<T>) {
    return run({
      getVersion: async (_scope, id) => this.versions.get(id) ?? null,
      saveVersion: async (version) => {
        this.versions.set(version.id, structuredClone(version));
      },
      saveArtifact: async (artifact) => {
        this.artifacts.set(artifact.id, structuredClone(artifact));
      },
      saveCaptureEvidence: async (_scope, evidence) => {
        this.evidence.set(evidence.sourceId, structuredClone(evidence));
      },
      getReceipt: async (_scope, key) => this.receipts.get(key) ?? null,
      saveReceipt: async (receipt) => {
        this.receipts.set(receipt.idempotencyKey, structuredClone(receipt));
      },
    });
  }
}

class FakeProvider implements ContentProcessingProvider {
  calls = { transcode: 0, transcribe: 0, drafts: 0 };
  failTranscode = false;

  async reconcileOrTranscode(
    input: Parameters<ContentProcessingProvider['reconcileOrTranscode']>[0],
  ): Promise<DerivativeReadback> {
    this.calls.transcode += 1;
    if (this.failTranscode) throw new Error('provider body must not escape');
    return {
      profileVersion: 'OT-VIDEO-1',
      objectVersionId: 'derivative-version-1',
      byteCount: input.source.byteCount / 2,
      sha256: sha('derivative'),
      container: 'mp4',
      durationMs: input.plan.trim.outputDurationMs,
      width: input.plan.targetWidth,
      height: input.plan.targetHeight,
      framesPerSecond: input.plan.targetFramesPerSecond,
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
  }

  async reconcileOrTranscribe(
    input: Parameters<ContentProcessingProvider['reconcileOrTranscribe']>[0],
  ): Promise<TranscriptProviderReadback> {
    this.calls.transcribe += 1;
    return {
      providerProjectIdDigest: sha('project'),
      providerRequestDigest: sha('transcribe-request'),
      providerResultDigest: sha('transcribe-result'),
      segments: [
        {
          segmentId: input.segments[0]!.segmentId,
          startMs: input.segments[0]!.startMs,
          endMs: input.segments[0]!.startMs + 5_000,
          text: 'A bounded English transcript.',
          providerResultDigest: sha('segment-result'),
        },
      ],
      refusal: false,
      truncated: false,
      uncertain: false,
    };
  }

  async reconcileOrGenerateDrafts(
    input: Parameters<ContentProcessingProvider['reconcileOrGenerateDrafts']>[0],
  ): Promise<LearningProviderReadback> {
    this.calls.drafts += 1;
    const segmentId = sha(`${sha('source')}:source-version-1:1000:99000`);
    return {
      providerProjectIdDigest: sha('project'),
      providerRequestDigest: sha('draft-request'),
      providerResultDigest: sha('draft-result'),
      schemaDigest: registeredLearningSchemaDigest(),
      sourceId: input.sourceId,
      sourceSha256: input.sourceSha256,
      transcriptDigest: input.transcriptDigest,
      output: {
        title: 'Review',
        classTopic: 'Berachos',
        mishnahReferences: ['Berachos 1:1'],
        summary: 'A grounded lesson summary.',
        reviewQuestions: [
          {
            question: 'What was learned?',
            answer: 'A bounded lesson.',
            sourceSegmentIds: [segmentId],
          },
        ],
        worksheet: {
          instructions: 'Answer from the transcript.',
          items: ['Write the main point.'],
        },
        knowledgeArtifact: {
          heading: 'Lesson',
          body: 'A grounded future knowledge draft.',
          sourceSegmentIds: [segmentId],
        },
      },
      refusal: false,
      truncated: false,
      schemaValid: true,
      unexpectedFields: false,
      uncertain: false,
    };
  }
}

describe('P20 content-processing worker', () => {
  it('denies a source outside the authenticated Admin scope before provider work', async () => {
    const repository = new MemoryRepository();
    const provider = new FakeProvider();
    const command = commandFixture();

    await expect(
      new ContentProcessingRunner(repository, provider).run({
        ...command,
        actor: { ...command.actor, accountKey: 'account-other' },
      }),
    ).rejects.toMatchObject({ code: 'content_processing_access_denied' });
    expect(provider.calls).toEqual({ transcode: 0, transcribe: 0, drafts: 0 });
  });

  it('persists seven drafts and an idempotent receipt before returning needs_review', async () => {
    const repository = new MemoryRepository();
    const provider = new FakeProvider();
    const runner = new ContentProcessingRunner(repository, provider);
    const command = commandFixture();

    const first = await runner.run(command);
    expect(first).toMatchObject({ disposition: 'needs_review', replayed: false });
    expect(first.version.contentId).toBe(command.source.occurrenceId);
    expect(first.version.artifacts).toHaveLength(7);
    expect(first.version.artifacts.every((artifact) => artifact.status === 'draft')).toBe(true);
    expect(repository.artifacts).toHaveLength(7);
    expect(repository.evidence.has(command.source.id)).toBe(true);
    expect(
      first.version.artifacts.find(({ kind }) => kind === 'review_material')?.payload,
    ).toMatchObject({
      title: 'Review',
      classTopic: 'Berachos',
      mishnahReferences: ['Berachos 1:1'],
    });
    expect(provider.calls).toEqual({ transcode: 1, transcribe: 1, drafts: 1 });

    const replay = await runner.run(command);
    expect(replay).toMatchObject({ disposition: 'needs_review', replayed: true });
    expect(provider.calls).toEqual({ transcode: 1, transcribe: 1, drafts: 1 });
  });

  it('records only a safe retry state when a processor is uncertain', async () => {
    const repository = new MemoryRepository();
    const provider = new FakeProvider();
    provider.failTranscode = true;
    const result = await new ContentProcessingRunner(repository, provider).run(commandFixture());
    expect(result).toMatchObject({
      disposition: 'retry_wait',
      version: {
        state: 'failed',
        retryState: 'retry_wait',
        attemptCount: 1,
        lastSafeErrorCode: 'content_processing_provider_uncertain',
      },
    });
    expect(JSON.stringify(result)).not.toContain('provider body must not escape');
  });

  it('reconciles an interrupted attempt after backoff without duplicating the completed receipt', async () => {
    const repository = new MemoryRepository();
    const provider = new FakeProvider();
    const runner = new ContentProcessingRunner(repository, provider);
    const command = commandFixture();
    provider.failTranscode = true;

    const failed = await runner.run(command);
    expect(failed).toMatchObject({ disposition: 'retry_wait' });
    expect(provider.calls).toEqual({ transcode: 1, transcribe: 0, drafts: 0 });

    provider.failTranscode = false;
    const deferred = await runner.run({
      ...command,
      occurredAt: '2026-07-28T22:00:30.000Z',
    });
    expect(deferred).toMatchObject({ disposition: 'retry_wait' });
    expect(provider.calls).toEqual({ transcode: 1, transcribe: 0, drafts: 0 });

    const resumedCommand = {
      ...command,
      occurredAt: '2026-07-28T22:01:01.000Z',
    };
    const resumed = await runner.run(resumedCommand);
    expect(resumed).toMatchObject({
      disposition: 'needs_review',
      replayed: false,
      version: { state: 'needs_review', retryState: 'ready', attemptCount: 1 },
    });
    expect(resumed.version).not.toHaveProperty('lastSafeErrorCode');
    expect(resumed.version).not.toHaveProperty('retryAt');
    expect(provider.calls).toEqual({ transcode: 2, transcribe: 1, drafts: 1 });

    const replay = await runner.run(resumedCommand);
    expect(replay).toMatchObject({ disposition: 'needs_review', replayed: true });
    expect(provider.calls).toEqual({ transcode: 2, transcribe: 1, drafts: 1 });
  });
});
