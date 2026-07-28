import type {
  ProviderReadbackAdapter,
  ProviderReconciliationRepository,
  ProviderRegistryBinding,
} from '../../../../../packages/contracts/src/providers/v21-provider-core.ts';
import { reconcileProviderOperation } from '../../../../../packages/domain/src/providers/shared/index.ts';

export interface ProviderReconciliationLogger {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
}

export interface ProviderReconciliationRunInput {
  repository: ProviderReconciliationRepository;
  bindings: readonly ProviderRegistryBinding[];
  adapters: readonly ProviderReadbackAdapter[];
  scope: ProviderRegistryBinding['scope'];
  limit: number;
  timeout_ms: number;
  now: Date;
  random_unit_interval: () => number;
  logger?: ProviderReconciliationLogger;
}

export interface ProviderReconciliationRunSummary {
  claimed: number;
  accepted_or_complete: number;
  retry_safe: number;
  rejected: number;
  still_unknown_or_dead_letter: number;
  stale_fenced: number;
  failed_closed: number;
}

export async function runProviderReconciliationBatch(
  input: ProviderReconciliationRunInput,
): Promise<ProviderReconciliationRunSummary> {
  const summary: ProviderReconciliationRunSummary = {
    claimed: 0,
    accepted_or_complete: 0,
    retry_safe: 0,
    rejected: 0,
    still_unknown_or_dead_letter: 0,
    stale_fenced: 0,
    failed_closed: 0,
  };
  const bindingByKey = new Map(
    input.bindings.map((binding) => [binding.registry_binding_key, binding]),
  );
  const adapterByProvider = new Map(input.adapters.map((adapter) => [adapter.provider, adapter]));
  const operations = await input.repository.claimAcceptanceUnknown({
    scope: input.scope,
    provider_keys: input.bindings.map((binding) => binding.provider),
    limit: input.limit,
  });
  summary.claimed = operations.length;

  for (const operation of operations) {
    const binding = bindingByKey.get(operation.registry_binding_key);
    const adapter = adapterByProvider.get(operation.provider);
    if (
      binding === undefined ||
      adapter === undefined ||
      operation.state !== 'acceptance_unknown'
    ) {
      summary.failed_closed += 1;
      input.logger?.warn(safeLog(operation), 'provider reconciliation failed closed');
      continue;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeout_ms);
    try {
      const readback = await adapter.readCanonical(operation, binding, controller.signal);
      const next = reconcileProviderOperation(operation, binding, readback, {
        now: input.now,
        random_unit_interval: input.random_unit_interval(),
      });
      const persisted = await input.repository.persistReconciliation({
        prior: operation,
        next,
        readback,
      });
      if (!persisted) {
        summary.stale_fenced += 1;
        continue;
      }
      increment(summary, next.state);
      input.logger?.info(safeLog(next), 'provider reconciliation persisted');
    } catch {
      summary.failed_closed += 1;
      input.logger?.warn(safeLog(operation), 'provider reconciliation readback rejected');
    } finally {
      clearTimeout(timeout);
    }
  }
  return summary;
}

function increment(
  summary: ProviderReconciliationRunSummary,
  state:
    | 'accepted'
    | 'complete'
    | 'retry_wait'
    | 'rejected'
    | 'acceptance_unknown'
    | 'dead_letter'
    | string,
): void {
  if (state === 'accepted' || state === 'complete') summary.accepted_or_complete += 1;
  else if (state === 'retry_wait') summary.retry_safe += 1;
  else if (state === 'rejected') summary.rejected += 1;
  else summary.still_unknown_or_dead_letter += 1;
}

function safeLog(operation: {
  job_id: string;
  provider: string;
  operation_type: string;
  state: string;
  safe_error_code: string | null;
}): Record<string, unknown> {
  return {
    operation_id: operation.job_id,
    provider: operation.provider,
    operation_type: operation.operation_type,
    state: operation.state,
    safe_error_code: operation.safe_error_code,
  };
}
