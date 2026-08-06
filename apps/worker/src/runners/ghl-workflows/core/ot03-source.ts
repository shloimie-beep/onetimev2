import { createPostgresOt03CheckoutAbandonmentRepository } from '../../../../../../packages/db/src/billing/checkout-abandonment-repository.ts';
import type { Ot03CheckoutAbandonmentRepository } from '../../../../../../packages/db/src/billing/checkout-abandonment-repository.ts';
import { deriveOt03CheckoutAbandonmentIntents } from '../../../../../../packages/domain/src/billing/checkout-abandonment.ts';
import type { WorkerRunnerContext, WorkerRunnerResult } from '../../registry/index.ts';

export type Ot03SourceRuntime = {
  repository?: Ot03CheckoutAbandonmentRepository;
  clock?: () => Date;
};

export async function runOt03CheckoutAbandonmentSourceWorker(
  context: WorkerRunnerContext,
  runtime?: Ot03SourceRuntime,
): Promise<WorkerRunnerResult> {
  if (context.source.OT03_SOURCE_ENABLED !== 'true') {
    return {
      enabled: false,
      providerCallsPerformed: false,
      summary: {
        disabledReason: 'ot03_source_disabled',
        scanned: 0,
        checkpoints: 0,
        inserted: 0,
        pendingExternalBinding: 0,
        providerCalls: 0,
        studentContacts: 0,
        financialMutations: 0,
        accessMutations: 0,
      },
    };
  }

  const repository =
    runtime?.repository ?? createPostgresOt03CheckoutAbandonmentRepository(context.pool);
  const observedAt = (runtime?.clock?.() ?? new Date()).toISOString();
  const parsedLimit = Number(context.source.OT03_SOURCE_BATCH_SIZE ?? 50);
  const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 100)) : 50;
  const candidates = await repository.listDueCandidates({
    accountKey: context.config.accountKey,
    productKey: context.config.productKey,
    runtimeTier: context.config.oneTimeRuntimeTier,
    verificationEnvironmentId: context.config.oneTimeVerificationEnvironmentId,
    observedAt,
    limit,
  });

  let checkpointCount = 0;
  let inserted = 0;
  for (const candidate of candidates) {
    const intents = deriveOt03CheckoutAbandonmentIntents(candidate, observedAt);
    checkpointCount += intents.length;
    for (const intent of intents) {
      if (
        await repository.insertIntent({
          intent,
          runtimeTier: context.config.oneTimeRuntimeTier,
          verificationEnvironmentId: context.config.oneTimeVerificationEnvironmentId,
        })
      ) {
        inserted += 1;
      }
    }
  }

  return {
    enabled: true,
    providerCallsPerformed: false,
    summary: {
      scanned: candidates.length,
      checkpoints: checkpointCount,
      inserted,
      pendingExternalBinding: inserted,
      providerCalls: 0,
      studentContacts: 0,
      financialMutations: 0,
      accessMutations: 0,
    },
  };
}
