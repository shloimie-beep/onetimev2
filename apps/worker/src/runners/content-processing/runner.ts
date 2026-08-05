import {
  CONTENT_PROCESSING_ERROR_CODES,
  OT_LEARNING_DRAFT_1_OPERATION,
  OT_LEARNING_DRAFT_JSON_SCHEMA,
  OT_TRANSCRIBE_1_OPERATION,
  type AudioSegmentPlan,
  type ContentProcessingAdminActor,
  type ContentProcessingCommandReceipt,
  type ContentProcessingReadback,
  type ContentProcessingRepository,
  type ContentProcessingSource,
  type ContentProcessingVersion,
  type ControlledCaptureEvidence,
  type DerivativeReadback,
  type LearningDraft,
  type MediaProbeReadback,
  type ProcessingStoragePolicyReadback,
  type TranscriptSegment,
} from '../../../../../packages/contracts/src/content/processing/index.ts';
import {
  ContentProcessingError,
  buildAudioSegmentPlan,
  buildTranscodePlan,
  createDraftArtifacts,
  processingSha256,
  registeredLearningSchemaDigest,
  scheduleProcessingFailure,
  selectTrim,
  validateControlledCapture,
  validateLearningDraft,
  validateProcessingInput,
  validateTranscriptDraft,
  verifyDerivative,
} from '../../../../../packages/domain/src/content/processing/index.ts';

export type ProcessContentCommand = {
  actor: ContentProcessingAdminActor;
  source: ContentProcessingSource;
  readback: ContentProcessingReadback;
  storage: ProcessingStoragePolicyReadback;
  captureEvidence: ControlledCaptureEvidence;
  probe: MediaProbeReadback;
  trimStartMs: number;
  trimEndMs: number;
  inputLocator: string;
  outputLocator: string;
  idempotencyKey: string;
  requestHash: string;
  occurredAt: string;
};

export type TranscriptProviderReadback = {
  providerProjectIdDigest: string;
  providerRequestDigest: string;
  providerResultDigest: string;
  segments: readonly TranscriptSegment[];
  refusal: false;
  truncated: false;
  uncertain: false;
};

export type LearningProviderReadback = {
  providerProjectIdDigest: string;
  providerRequestDigest: string;
  providerResultDigest: string;
  schemaDigest: string;
  sourceId: string;
  sourceSha256: string;
  transcriptDigest: string;
  output: LearningDraft;
  refusal: false;
  truncated: false;
  schemaValid: true;
  unexpectedFields: false;
  uncertain: false;
};

export interface ContentProcessingProvider {
  reconcileOrTranscode(input: {
    operationId: string;
    source: ContentProcessingSource;
    readback: ContentProcessingReadback;
    plan: ContentProcessingVersion['transcodePlan'];
  }): Promise<DerivativeReadback>;
  reconcileOrTranscribe(input: {
    operationId: string;
    source: ContentProcessingSource;
    segments: readonly AudioSegmentPlan[];
    operation: typeof OT_TRANSCRIBE_1_OPERATION;
  }): Promise<TranscriptProviderReadback>;
  reconcileOrGenerateDrafts(input: {
    operationId: string;
    sourceId: string;
    sourceSha256: string;
    transcriptDigest: string;
    transcriptText: string;
    operation: typeof OT_LEARNING_DRAFT_1_OPERATION;
    schema: typeof OT_LEARNING_DRAFT_JSON_SCHEMA;
  }): Promise<LearningProviderReadback>;
}

export type ProcessContentResult =
  | { disposition: 'needs_review'; version: ContentProcessingVersion; replayed: boolean }
  | {
      disposition: 'retry_wait' | 'dead_lettered';
      version: ContentProcessingVersion;
      replayed: false;
    };

export class ContentProcessingRunner {
  constructor(
    private readonly repository: ContentProcessingRepository,
    private readonly provider: ContentProcessingProvider,
  ) {}

  async run(command: ProcessContentCommand): Promise<ProcessContentResult> {
    assertProcessingCommandScope(command);
    const scope = command.actor;
    const contentVersionId = processingSha256(
      `${command.source.id}:${command.source.sha256}:${command.source.objectVersionId}:${command.requestHash}`,
    );
    const prior = await this.repository.inTransaction(async (unit) => {
      const receipt = await unit.getReceipt(scope, command.idempotencyKey);
      if (receipt) {
        if (receipt.requestHash !== command.requestHash) {
          throw new ContentProcessingError(
            CONTENT_PROCESSING_ERROR_CODES.conflict,
            'Idempotency key was already used for a different processing request.',
          );
        }
        const version = await unit.getVersion(scope, receipt.resultRef);
        if (!version) {
          throw new ContentProcessingError(
            CONTENT_PROCESSING_ERROR_CODES.invalidState,
            'Committed processing receipt has no matching version.',
          );
        }
        assertCompletedProcessingReplay(version, receipt, command, contentVersionId);
        return { replay: version, resumable: null };
      }
      return {
        replay: null,
        resumable: await unit.getVersion(scope, contentVersionId),
      };
    });
    if (prior.replay) {
      return { disposition: 'needs_review', version: prior.replay, replayed: true };
    }

    validateProcessingInput({
      source: command.source,
      readback: command.readback,
      probe: command.probe,
      storage: command.storage,
    });
    validateControlledCapture(command.captureEvidence, command.source);
    let version: ContentProcessingVersion;
    if (prior.resumable) {
      assertResumableVersion(prior.resumable, command, contentVersionId);
      if (prior.resumable.state === 'dead_lettered') {
        return { disposition: 'dead_lettered', version: prior.resumable, replayed: false };
      }
      if (
        prior.resumable.state === 'failed' &&
        prior.resumable.retryAt &&
        Date.parse(command.occurredAt) < Date.parse(prior.resumable.retryAt)
      ) {
        return { disposition: 'retry_wait', version: prior.resumable, replayed: false };
      }
      version = resumeProcessingVersion(prior.resumable, command.occurredAt);
      await this.repository.inTransaction((unit) => unit.saveVersion(version));
    } else {
      const trim = selectTrim({
        sourceDurationMs: command.probe.durationMs,
        startMs: command.trimStartMs,
        endMs: command.trimEndMs,
        actor: command.actor,
        selectedAt: command.occurredAt,
      });
      const transcodePlan = buildTranscodePlan({
        source: command.source,
        probe: command.probe,
        trim,
        inputLocator: command.inputLocator,
        outputLocator: command.outputLocator,
      });
      version = {
        id: contentVersionId,
        contentId: command.source.occurrenceId!,
        accountKey: scope.accountKey,
        productKey: scope.productKey,
        sourceId: command.source.id,
        sourceSha256: command.source.sha256,
        sourceObjectVersionId: command.source.objectVersionId,
        runtimeTier: command.source.runtimeTier,
        state: 'transcoding',
        retryState: 'ready',
        attemptCount: 0,
        trim,
        transcodePlan,
        artifacts: [],
        version: 1,
        createdAt: command.occurredAt,
        updatedAt: command.occurredAt,
      };
      await this.repository.inTransaction(async (unit) => {
        if (await unit.getVersion(scope, version.id)) {
          throw new ContentProcessingError(
            CONTENT_PROCESSING_ERROR_CODES.conflict,
            'A processing version already exists without a committed command receipt.',
          );
        }
        await unit.saveCaptureEvidence(scope, command.captureEvidence);
        await unit.saveVersion(version);
      });
    }

    try {
      const derivative = await this.provider.reconcileOrTranscode({
        operationId: operationId(version, 'transcode'),
        source: command.source,
        readback: command.readback,
        plan: version.transcodePlan,
      });
      verifyDerivative(derivative, { source: command.source, plan: version.transcodePlan });
      version = await this.advance(version, 'transcribing', command.occurredAt);

      const segmentPlan = buildAudioSegmentPlan({ source: command.source, trim: version.trim });
      const transcriptReadback = await this.provider.reconcileOrTranscribe({
        operationId: operationId(version, 'transcribe'),
        source: command.source,
        segments: segmentPlan,
        operation: OT_TRANSCRIBE_1_OPERATION,
      });
      if (
        transcriptReadback.refusal ||
        transcriptReadback.truncated ||
        transcriptReadback.uncertain
      ) {
        throw new ContentProcessingError(
          CONTENT_PROCESSING_ERROR_CODES.providerUncertain,
          'Transcription did not produce a certain complete result.',
        );
      }
      const transcript = validateTranscriptDraft({
        source: command.source,
        plannedSegments: segmentPlan,
        segments: transcriptReadback.segments,
        providerProjectIdDigest: transcriptReadback.providerProjectIdDigest,
        providerRequestDigest: transcriptReadback.providerRequestDigest,
        providerResultDigest: transcriptReadback.providerResultDigest,
      });
      version = await this.advance(version, 'drafting', command.occurredAt);

      const transcriptDigest = processingSha256(JSON.stringify(transcript));
      const learningReadback = await this.provider.reconcileOrGenerateDrafts({
        operationId: operationId(version, 'learning-draft'),
        sourceId: command.source.id,
        sourceSha256: command.source.sha256,
        transcriptDigest,
        transcriptText: transcript.segments.map((segment) => segment.text).join('\n'),
        operation: OT_LEARNING_DRAFT_1_OPERATION,
        schema: OT_LEARNING_DRAFT_JSON_SCHEMA,
      });
      if (
        learningReadback.refusal ||
        learningReadback.truncated ||
        learningReadback.uncertain ||
        !learningReadback.schemaValid ||
        learningReadback.unexpectedFields ||
        learningReadback.sourceId !== command.source.id ||
        learningReadback.sourceSha256 !== command.source.sha256 ||
        learningReadback.transcriptDigest !== transcriptDigest ||
        learningReadback.schemaDigest !== registeredLearningSchemaDigest()
      ) {
        throw new ContentProcessingError(
          CONTENT_PROCESSING_ERROR_CODES.draftInvalid,
          'Learning draft failed strict schema, source-version, or provider disposition validation.',
        );
      }
      const learning = validateLearningDraft({
        source: command.source,
        transcript,
        output: learningReadback.output,
        providerProjectIdDigest: learningReadback.providerProjectIdDigest,
        providerRequestDigest: learningReadback.providerRequestDigest,
        providerResultDigest: learningReadback.providerResultDigest,
        schemaDigest: learningReadback.schemaDigest,
      });
      const artifacts = createDraftArtifacts({
        version,
        derivative,
        transcript,
        learning,
        occurredAt: command.occurredAt,
      });
      version = {
        ...version,
        state: 'needs_review',
        artifacts,
        version: version.version + 1,
        updatedAt: command.occurredAt,
      };
      await this.repository.inTransaction(async (unit) => {
        for (const artifact of artifacts) await unit.saveArtifact(artifact);
        await unit.saveVersion(version);
        await unit.saveReceipt({
          accountKey: scope.accountKey,
          productKey: scope.productKey,
          idempotencyKey: command.idempotencyKey,
          requestHash: command.requestHash,
          operation: 'process_source',
          resultRef: version.id,
          resultVersion: version.version,
          committedAt: command.occurredAt,
        });
      });
      return { disposition: 'needs_review', version, replayed: false };
    } catch (error) {
      const safeErrorCode =
        error instanceof ContentProcessingError
          ? error.code
          : CONTENT_PROCESSING_ERROR_CODES.providerUncertain;
      version = scheduleProcessingFailure({
        version,
        safeErrorCode,
        occurredAt: command.occurredAt,
      });
      await this.repository.inTransaction((unit) => unit.saveVersion(version));
      return {
        disposition: version.retryState === 'dead_lettered' ? 'dead_lettered' : 'retry_wait',
        version,
        replayed: false,
      };
    }
  }

  private async advance(
    version: ContentProcessingVersion,
    state: ContentProcessingVersion['state'],
    occurredAt: string,
  ) {
    const next = {
      ...version,
      state,
      version: version.version + 1,
      updatedAt: occurredAt,
    };
    await this.repository.inTransaction((unit) => unit.saveVersion(next));
    return next;
  }
}

function assertResumableVersion(
  version: ContentProcessingVersion,
  command: ProcessContentCommand,
  contentVersionId: string,
): void {
  const inputIndex = version.transcodePlan.command.args.indexOf(command.inputLocator);
  const outputIndex = version.transcodePlan.command.args.indexOf(command.outputLocator);
  const retryStateInvalid =
    (version.state === 'failed' &&
      (version.retryState !== 'retry_wait' ||
        !version.retryAt ||
        !Number.isFinite(Date.parse(version.retryAt)))) ||
    (version.state === 'dead_lettered' && version.retryState !== 'dead_lettered') ||
    (['transcoding', 'transcribing', 'drafting'].includes(version.state) &&
      version.retryState !== 'ready');
  if (
    version.id !== contentVersionId ||
    version.accountKey !== command.actor.accountKey ||
    version.productKey !== command.actor.productKey ||
    version.contentId !== command.source.occurrenceId ||
    version.sourceId !== command.source.id ||
    version.sourceSha256 !== command.source.sha256 ||
    version.sourceObjectVersionId !== command.source.objectVersionId ||
    version.runtimeTier !== command.source.runtimeTier ||
    version.trim.sourceDurationMs !== command.probe.durationMs ||
    version.trim.startMs !== command.trimStartMs ||
    version.trim.endMs !== command.trimEndMs ||
    version.trim.selectedByAdminId !== command.actor.principalId ||
    inputIndex < 0 ||
    outputIndex < 0 ||
    retryStateInvalid ||
    !['transcoding', 'transcribing', 'drafting', 'failed', 'dead_lettered'].includes(version.state)
  ) {
    throw new ContentProcessingError(
      CONTENT_PROCESSING_ERROR_CODES.conflict,
      'Interrupted processing state does not match the exact source-bound retry request.',
    );
  }
}

function assertCompletedProcessingReplay(
  version: ContentProcessingVersion,
  receipt: ContentProcessingCommandReceipt,
  command: ProcessContentCommand,
  contentVersionId: string,
): void {
  if (
    receipt.operation !== 'process_source' ||
    receipt.resultRef !== contentVersionId ||
    version.id !== contentVersionId ||
    version.accountKey !== command.actor.accountKey ||
    version.productKey !== command.actor.productKey ||
    version.sourceId !== command.source.id ||
    version.sourceSha256 !== command.source.sha256 ||
    version.sourceObjectVersionId !== command.source.objectVersionId ||
    !['needs_review', 'approved'].includes(version.state)
  ) {
    throw new ContentProcessingError(
      CONTENT_PROCESSING_ERROR_CODES.conflict,
      'Committed processing replay does not match the exact source-bound request.',
    );
  }
}

function assertProcessingCommandScope(command: ProcessContentCommand): void {
  if (
    command.actor.role !== 'admin' ||
    command.actor.accountKey !== command.source.accountKey ||
    command.actor.productKey !== command.source.productKey ||
    !Number.isFinite(Date.parse(command.occurredAt))
  ) {
    throw new ContentProcessingError(
      CONTENT_PROCESSING_ERROR_CODES.accessDenied,
      'Processing source is outside the authenticated Admin scope.',
    );
  }
}

function resumeProcessingVersion(
  version: ContentProcessingVersion,
  occurredAt: string,
): ContentProcessingVersion {
  const resumed: ContentProcessingVersion = {
    ...version,
    state: 'transcoding',
    retryState: 'ready',
    version: version.version + 1,
    updatedAt: occurredAt,
  };
  delete resumed.lastSafeErrorCode;
  delete resumed.retryAt;
  return resumed;
}

function operationId(version: ContentProcessingVersion, operation: string) {
  return processingSha256(
    `${version.id}:${version.sourceSha256}:${version.sourceObjectVersionId}:${operation}`,
  );
}
