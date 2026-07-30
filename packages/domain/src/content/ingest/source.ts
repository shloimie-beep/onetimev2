import {
  CONTENT_INGEST_ERROR_CODES,
  CONTENT_INGEST_MAX_ATTEMPTS,
  type ContentIngestCommandReceipt,
  type ContentLifecycleState,
  type ContentSourceRecord,
  type MatchContentSourceCommand,
} from '../../../../contracts/src/content/ingest/index.ts';
import type { ClassOccurrenceRecord } from '../../../../contracts/src/classes/core/index.ts';
import { ContentIngestError } from './errors.ts';

const TRANSITIONS: Readonly<Record<ContentLifecycleState, readonly ContentLifecycleState[]>> = {
  received: ['validating', 'archived'],
  validating: ['processing', 'failed'],
  processing: ['needs_review', 'failed'],
  needs_review: ['approved', 'archived'],
  approved: ['publishing', 'archived'],
  publishing: ['published', 'failed'],
  published: ['approved', 'archived'],
  failed: ['validating', 'processing', 'publishing', 'archived'],
  archived: [],
};

export function transitionContentSource(
  source: ContentSourceRecord,
  input: {
    to: ContentLifecycleState;
    expectedVersion: number;
    occurredAt: string;
    safeErrorCode?: string;
  },
) {
  if (source.version !== input.expectedVersion) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.staleVersion,
      'Content source changed; reload before retrying.',
    );
  }
  if (!TRANSITIONS[source.lifecycleState].includes(input.to)) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.invalidState,
      `Content source cannot transition from ${source.lifecycleState} to ${input.to}.`,
    );
  }
  if (source.lifecycleState === 'failed') {
    if (!source.failedFrom || input.to !== source.failedFrom) {
      throw new ContentIngestError(
        CONTENT_INGEST_ERROR_CODES.invalidState,
        'Failed content retries only to the recorded failed_from state.',
      );
    }
  }
  const enteringFailed = input.to === 'failed';
  if (
    enteringFailed &&
    !['validating', 'processing', 'publishing'].includes(source.lifecycleState)
  ) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.invalidState,
      'Only validating, processing, or publishing may enter failed.',
    );
  }
  const next: ContentSourceRecord = {
    ...source,
    lifecycleState: input.to,
    version: source.version + 1,
    updatedAt: input.occurredAt,
  };
  if (enteringFailed) {
    next.failedFrom = source.lifecycleState as 'validating' | 'processing' | 'publishing';
    next.lastSafeErrorCode = input.safeErrorCode ?? 'unspecified_failure';
  } else if (input.to === 'validating' || input.to === 'processing' || input.to === 'publishing') {
    delete next.failedFrom;
    delete next.lastSafeErrorCode;
  }
  return next;
}

export function matchSourceToOccurrence(
  source: ContentSourceRecord,
  occurrence: ClassOccurrenceRecord,
  command: MatchContentSourceCommand,
  priorReceipt?: ContentIngestCommandReceipt | null,
) {
  if (priorReceipt) {
    if (
      priorReceipt.idempotencyKey !== command.idempotencyKey ||
      priorReceipt.requestHash !== command.requestHash
    ) {
      throw new ContentIngestError(
        CONTENT_INGEST_ERROR_CODES.conflict,
        'Occurrence-match idempotency key was reused for a different request.',
      );
    }
    return { source, replay: true as const };
  }
  if (
    source.accountKey !== command.actor.accountKey ||
    source.productKey !== command.actor.productKey ||
    occurrence.accountKey !== command.actor.accountKey ||
    occurrence.productKey !== command.actor.productKey ||
    occurrence.id !== command.occurrenceId
  ) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.accessDenied,
      'Occurrence match is outside the authenticated account and product.',
    );
  }
  if (source.version !== command.expectedVersion) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.staleVersion,
      'Content source changed; reload before matching.',
    );
  }
  if (!['received', 'validating', 'failed'].includes(source.lifecycleState)) {
    throw new ContentIngestError(
      CONTENT_INGEST_ERROR_CODES.invalidState,
      'Occurrence assignment must happen before processing advances.',
    );
  }
  const matched: ContentSourceRecord = {
    ...source,
    occurrenceId: occurrence.id,
    matchConfidence: 'exact',
    matchedByAdminId: command.actor.principalId,
    version: source.version + 1,
    updatedAt: command.occurredAt,
  };
  return {
    source: matched,
    replay: false as const,
    receipt: {
      accountKey: source.accountKey,
      productKey: source.productKey,
      idempotencyKey: command.idempotencyKey,
      requestHash: command.requestHash,
      operation: 'content_source:match_occurrence',
      resultRef: source.id,
      resultVersion: matched.version,
      committedAt: command.occurredAt,
    } satisfies ContentIngestCommandReceipt,
  };
}

export function recordIngestFailure(
  source: ContentSourceRecord,
  safeErrorCode: string,
  occurredAt: string,
) {
  const attemptCount = source.attemptCount + 1;
  return {
    ...source,
    attemptCount,
    retryState:
      attemptCount >= CONTENT_INGEST_MAX_ATTEMPTS
        ? ('dead_lettered' as const)
        : ('retry_wait' as const),
    lastSafeErrorCode: safeErrorCode,
    version: source.version + 1,
    updatedAt: occurredAt,
  };
}
