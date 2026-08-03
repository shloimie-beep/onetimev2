import type {
  ClaimedDelivery,
  DeliveryFailure,
  DeliveryLogger,
  DeliveryOutcome,
  DeliveryProviderOperation,
  DeliveryProviderRouter,
  DeliveryRepository,
  DeliveryRunSummary,
  DeliveryTransportMode,
  ProviderReceipt,
} from '../../../../packages/contracts/src/delivery/types.ts';
import { providerError } from '../../../../packages/contracts/src/delivery/errors.ts';
import { prepareDelivery } from '../../../../packages/domain/src/delivery/processor.ts';
import type { DeliveryMessageConfig } from '../../../../packages/domain/src/delivery/messages.ts';
import {
  classifyDeliveryError,
  nextRetryAt,
  shouldDeadLetter,
} from '../../../../packages/domain/src/delivery/retry.ts';
import { opaqueDeliveryReference } from '../../../../packages/domain/src/delivery/redaction.ts';

export type DeliveryWorkerOptions = {
  accountKey: string;
  productKey: string;
  batchSize: number;
  concurrency: number;
  transportMode?: DeliveryTransportMode;
  claimLeaseMs: number;
  providerTimeoutMs: number;
  providerTimeoutLeaseSafetyMs?: number;
  maxAttempts: number;
};

export type RunDeliveryBatchInput = {
  repository: DeliveryRepository;
  router: DeliveryProviderRouter;
  logger: DeliveryLogger;
  messageConfig: DeliveryMessageConfig;
  options: DeliveryWorkerOptions;
  clock?: () => Date;
};

function emptySummary(): DeliveryRunSummary {
  return {
    claimed: 0,
    delivered: 0,
    sinkDelivered: 0,
    retried: 0,
    deadLettered: 0,
    acceptanceUnknown: 0,
    suppressed: 0,
    skipped: 0,
    leaseLost: 0,
  };
}

async function withConcurrency<T>(
  values: readonly T[],
  concurrency: number,
  run: (value: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  async function consume(): Promise<void> {
    while (index < values.length) {
      const current = values[index];
      index += 1;
      if (current !== undefined) await run(current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => consume()));
}

async function sendWithTimeout(input: {
  router: DeliveryProviderRouter;
  claim: ClaimedDelivery;
  request: Parameters<DeliveryProviderRouter['send']>[0];
  timeoutMs: number;
}): Promise<ProviderReceipt> {
  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      controller.abort();
      reject(
        providerError('provider_timeout', {
          retryable: true,
          acceptance: 'unknown',
          provider: 'worker',
        }),
      );
    }, input.timeoutMs);
  });
  try {
    return await Promise.race([
      input.router.send(input.request, {
        deliveryKey: input.claim.deliveryKey,
        attempt: input.claim.attempts,
        transportMode: input.claim.transportMode as DeliveryTransportMode,
        signal: controller.signal,
      }),
      timeout,
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

function outcomeForFailure(
  claim: ClaimedDelivery,
  failure: DeliveryFailure,
  at: Date,
  maxAttempts: number,
): DeliveryOutcome {
  if (shouldDeadLetter(failure, claim.attempts, maxAttempts)) {
    return {
      kind: 'dead_lettered',
      at,
      failure,
    };
  }
  return {
    kind: 'retry',
    at,
    failure,
    nextAttemptAt: nextRetryAt({
      now: at,
      deliveryKey: claim.deliveryKey,
      attempt: claim.attempts,
      ...(failure.retryAfterMs !== undefined ? { retryAfterMs: failure.retryAfterMs } : {}),
    }),
  };
}

function incrementSummary(summary: DeliveryRunSummary, outcome: DeliveryOutcome): void {
  if (outcome.kind === 'delivered') {
    if (outcome.receipt.sink) summary.sinkDelivered += 1;
    else summary.delivered += 1;
  } else if (outcome.kind === 'retry') summary.retried += 1;
  else if (outcome.kind === 'dead_lettered') summary.deadLettered += 1;
  else if (outcome.kind === 'acceptance_unknown') summary.acceptanceUnknown += 1;
  else if (outcome.kind === 'suppressed') summary.suppressed += 1;
  else summary.skipped += 1;
}

async function processClaim(
  claim: ClaimedDelivery,
  input: RunDeliveryBatchInput,
  summary: DeliveryRunSummary,
  clock: () => Date,
): Promise<void> {
  let outcome: DeliveryOutcome;
  try {
    const prepared = prepareDelivery(claim, input.messageConfig, clock());
    if (prepared.kind === 'terminal') {
      outcome = prepared.outcome;
    } else if (claim.transportMode === 'provider') {
      const operation = providerOperationFor(input.router, prepared.request, claim);
      const begin = await input.repository.beginProviderOperation(claim, operation, clock());
      if (begin.kind === 'lease_lost') {
        recordLeaseLost(claim, input, summary, 'provider_operation_begin');
        return;
      }
      if (begin.kind === 'acceptance_unknown') {
        outcome = acceptanceUnknownOutcome(clock());
      } else if (begin.kind === 'accepted') {
        outcome = {
          kind: 'delivered',
          at: clock(),
          receipt: begin.receipt,
        };
      } else {
        const result = await dispatchProviderOperation(
          claim,
          operation,
          prepared.request,
          input,
          clock,
        );
        if (!result) {
          recordLeaseLost(claim, input, summary, 'provider_operation_transition');
          return;
        }
        outcome = result;
      }
    } else {
      const receipt = await sendWithTimeout({
        router: input.router,
        claim,
        request: prepared.request,
        timeoutMs: input.options.providerTimeoutMs,
      });
      outcome = {
        kind: 'delivered',
        at: clock(),
        receipt,
      };
    }
  } catch (error) {
    outcome = outcomeForFailure(
      claim,
      classifyDeliveryError(error),
      clock(),
      input.options.maxAttempts,
    );
  }

  const completed = await input.repository.complete(claim, outcome);
  const fields = {
    delivery_ref: opaqueDeliveryReference(claim.deliveryKey),
    channel: claim.channel,
    event_type: claim.eventType,
    attempt: claim.attempts,
    status: outcome.kind,
    ...(outcome.kind === 'skipped' || outcome.kind === 'suppressed'
      ? { reason: outcome.reason }
      : {}),
    ...(outcome.kind === 'retry' ||
    outcome.kind === 'dead_lettered' ||
    outcome.kind === 'acceptance_unknown'
      ? {
          failure_code: outcome.failure.code,
          failure_category: outcome.failure.category,
          provider: outcome.failure.provider,
          http_status: outcome.failure.httpStatus,
        }
      : {}),
  };
  if (!completed) {
    recordLeaseLost(claim, input, summary, 'delivery_complete', fields);
    return;
  }
  incrementSummary(summary, outcome);
  input.logger.info('delivery_completed', fields);
}

export async function runDeliveryBatch(input: RunDeliveryBatchInput): Promise<DeliveryRunSummary> {
  const clock = input.clock ?? (() => new Date());
  const summary = emptySummary();
  const transportMode = input.options.transportMode ?? 'sink';
  const leaseSafetyMs = input.options.providerTimeoutLeaseSafetyMs ?? 1;
  if (input.options.providerTimeoutMs + leaseSafetyMs >= input.options.claimLeaseMs) {
    throw new Error('Delivery provider timeout plus safety margin must be less than claim lease.');
  }
  const claims = await input.repository.claimBatch({
    accountKey: input.options.accountKey,
    productKey: input.options.productKey,
    transportMode,
    now: clock(),
    limit: input.options.batchSize,
    leaseMs: input.options.claimLeaseMs,
  });
  summary.claimed = claims.length;
  await withConcurrency(claims, input.options.concurrency, (claim) =>
    processClaim(claim, input, summary, clock),
  );
  input.logger.info('delivery_batch_completed', {
    worker: 'ot36-delivery-sink',
    claimed: summary.claimed,
    delivered: summary.delivered,
    sink_delivered: summary.sinkDelivered,
    retried: summary.retried,
    dead_lettered: summary.deadLettered,
    acceptance_unknown: summary.acceptanceUnknown,
    suppressed: summary.suppressed,
    skipped: summary.skipped,
  });
  return summary;
}

function providerOperationFor(
  router: DeliveryProviderRouter,
  request: Parameters<DeliveryProviderRouter['send']>[0],
  claim: ClaimedDelivery,
): DeliveryProviderOperation {
  if (!router.providerOperation) {
    throw providerError('provider_operation_contract_missing', {
      retryable: false,
      acceptance: 'not_accepted',
      provider: 'worker',
    });
  }
  const operation = router.providerOperation(request);
  if (
    operation.idempotencyKey !== request.idempotencyKey ||
    operation.idempotencyKey !== claim.deliveryKey
  ) {
    throw providerError('provider_operation_identity_mismatch', {
      retryable: false,
      acceptance: 'unknown',
      provider: 'worker',
    });
  }
  return operation;
}

async function dispatchProviderOperation(
  claim: ClaimedDelivery,
  operation: DeliveryProviderOperation,
  request: Parameters<DeliveryProviderRouter['send']>[0],
  input: RunDeliveryBatchInput,
  clock: () => Date,
): Promise<DeliveryOutcome | null> {
  try {
    const receipt = await sendWithTimeout({
      router: input.router,
      claim,
      request,
      timeoutMs: input.options.providerTimeoutMs,
    });
    const at = clock();
    const accepted = await input.repository.recordProviderAccepted(claim, operation, receipt, at);
    if (!accepted) return null;
    return {
      kind: 'delivered',
      at,
      receipt,
    };
  } catch (error) {
    const failure = classifyDeliveryError(error);
    const at = clock();
    if (failure.acceptance === 'unknown') {
      const recorded = await input.repository.recordProviderAcceptanceUnknown(
        claim,
        operation,
        failure,
        at,
      );
      if (!recorded) return null;
      if (operation.acceptanceRecovery === 'quarantine') {
        return {
          kind: 'acceptance_unknown',
          at,
          failure,
        };
      }
    } else {
      const recorded = await input.repository.recordProviderRejected(claim, operation, failure, at);
      if (!recorded) return null;
    }
    return outcomeForFailure(claim, failure, at, input.options.maxAttempts);
  }
}

function acceptanceUnknownOutcome(at: Date): DeliveryOutcome {
  return {
    kind: 'acceptance_unknown',
    at,
    failure: {
      code: 'provider_acceptance_unknown',
      category: 'permanent',
      acceptance: 'unknown',
      provider: 'worker',
    },
  };
}

function recordLeaseLost(
  claim: ClaimedDelivery,
  input: RunDeliveryBatchInput,
  summary: DeliveryRunSummary,
  stage: string,
  fields: Readonly<Record<string, unknown>> = {},
) {
  summary.leaseLost += 1;
  input.logger.warn('delivery_claim_lease_lost', {
    delivery_ref: opaqueDeliveryReference(claim.deliveryKey),
    stage,
    ...fields,
    lease_lost: true,
  });
}
