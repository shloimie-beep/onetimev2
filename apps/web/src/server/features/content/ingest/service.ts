import {
  CONTENT_INGEST_ERROR_CODES,
  type BeginDirectUploadCommand,
  type ConfirmDirectUploadCommand,
  type ContentIngestCommandReceipt,
  type ContentIngestRepository,
  type MatchContentSourceCommand,
  type RecordUploadPartCommand,
} from '../../../../../../../packages/contracts/src/content/ingest/index.ts';
import type { ClassOccurrenceRecord } from '../../../../../../../packages/contracts/src/classes/core/index.ts';
import {
  ContentIngestError,
  beginDirectUpload,
  confirmDirectUpload,
  matchSourceToOccurrence,
  recordUploadPart,
} from '../../../../../../../packages/domain/src/content/ingest/index.ts';

export function createContentIngestService(repository: ContentIngestRepository) {
  return {
    beginDirectUpload: (command: BeginDirectUploadCommand) =>
      repository.inTransaction(async (unit) => {
        const receipt = await unit.getReceipt(command.actor, command.idempotencyKey);
        const result = beginDirectUpload(command, receipt);
        if (!result.replay) {
          await unit.saveUploadSession(result.session);
          await unit.saveReceipt(result.receipt);
        }
        return result;
      }),
    recordUploadPart: (command: RecordUploadPartCommand) =>
      repository.inTransaction(async (unit) => {
        const session = await unit.getUploadSession(command.actor, command.uploadSessionId);
        if (!session) throw notFound('upload session');
        assertAdminSession(session.actorId, command.actor.principalId);
        if (session.version !== command.expectedVersion) {
          throw new ContentIngestError(
            CONTENT_INGEST_ERROR_CODES.staleVersion,
            'Upload session changed; reload before recording the part.',
          );
        }
        const parts = await unit.listUploadParts(command.actor, command.uploadSessionId);
        const result = recordUploadPart(session, command, parts);
        if (!result.replay) {
          await unit.saveUploadPart(result.part);
          await unit.saveUploadSession(result.session);
        }
        return result;
      }),
    confirmDirectUpload: (command: ConfirmDirectUploadCommand) =>
      repository.inTransaction(async (unit) => {
        const prior = await unit.getReceipt(command.actor, command.idempotencyKey);
        if (prior) return replayConfirmation(unit, command, prior);
        const session = await unit.getUploadSession(command.actor, command.uploadSessionId);
        if (!session) throw notFound('upload session');
        const parts = await unit.listUploadParts(command.actor, command.uploadSessionId);
        const existing = await unit.findSourceByChecksum(command.actor, command.fullSha256);
        const result = confirmDirectUpload(session, parts, command, existing);
        const receipt: ContentIngestCommandReceipt = {
          accountKey: command.actor.accountKey,
          productKey: command.actor.productKey,
          idempotencyKey: command.idempotencyKey,
          requestHash: command.requestHash,
          operation: 'direct_upload:confirm',
          resultRef: result.source.id,
          resultVersion: result.source.version,
          committedAt: command.occurredAt,
        };
        await unit.saveSource(result.source);
        await unit.saveSourceLink(result.link);
        await unit.saveUploadSession(result.session);
        await unit.saveReceipt(receipt);
        return { ...result, receipt, replay: false as const };
      }),
    matchSourceToOccurrence: (
      command: MatchContentSourceCommand,
      occurrence: ClassOccurrenceRecord,
    ) =>
      repository.inTransaction(async (unit) => {
        const [source, receipt] = await Promise.all([
          unit.getSource(command.actor, command.sourceId),
          unit.getReceipt(command.actor, command.idempotencyKey),
        ]);
        if (!source) throw notFound('content source');
        const result = matchSourceToOccurrence(source, occurrence, command, receipt);
        if (!result.replay) {
          await unit.saveSource(result.source);
          await unit.saveReceipt(result.receipt);
        }
        return result;
      }),
  };
}

async function replayConfirmation(
  unit: Parameters<Parameters<ContentIngestRepository['inTransaction']>[0]>[0],
  command: ConfirmDirectUploadCommand,
  receipt: ContentIngestCommandReceipt,
) {
  if (receipt.requestHash !== command.requestHash) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.conflict,
      'The confirmation idempotency key was already used for a different request.',
    );
  }
  const source = await unit.getSource(command.actor, receipt.resultRef);
  if (!source) throw notFound('confirmed content source');
  return { source, receipt, replay: true as const };
}

function assertAdminSession(sessionActorId: string, principalId: string) {
  if (sessionActorId !== principalId) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.accessDenied,
      'Upload session belongs to a different Admin.',
    );
  }
}

function notFound(subject: string) {
  return new ContentIngestError(
    CONTENT_INGEST_ERROR_CODES.notFound,
    `The requested ${subject} was not found in this account and product.`,
  );
}
