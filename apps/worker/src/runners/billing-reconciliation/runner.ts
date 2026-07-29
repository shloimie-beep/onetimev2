import type {
  BillingAccessRepository,
  BillingReadbackAdapter,
  BillingReadbackBinding,
} from '../../../../../packages/contracts/src/billing/access/index.ts';
import { BillingAccessError } from '../../../../../packages/domain/src/billing/access/index.ts';

export interface BillingReconciliationRunInput {
  binding: BillingReadbackBinding;
  adapter: BillingReadbackAdapter;
  repository: BillingAccessRepository;
  now: Date;
  timeout_ms: number;
}

export interface BillingReconciliationRunSummary {
  read: number;
  projected: number;
  duplicate: number;
  failed_closed: number;
}

export async function runBillingReconciliation(
  input: BillingReconciliationRunInput,
): Promise<BillingReconciliationRunSummary> {
  if (
    input.binding.provider !== 'stripe' ||
    input.binding.mutation_policy !== 'prohibited' ||
    input.adapter.provider !== 'stripe'
  ) {
    throw new BillingAccessError(
      'invalid_contract',
      'Billing reconciliation is read-only Stripe truth.',
    );
  }
  const summary: BillingReconciliationRunSummary = {
    read: 0,
    projected: 0,
    duplicate: 0,
    failed_closed: 0,
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeout_ms);
  try {
    const events = await input.adapter.readVerifiedEvents(input.binding, controller.signal);
    summary.read = events.length;
    for (const event of events) {
      if (
        event.household_id !== input.binding.household_id ||
        event.provider_customer_ref_hash !== input.binding.provider_customer_ref_hash
      ) {
        summary.failed_closed += 1;
        continue;
      }
      const result = await input.repository.projectVerifiedEvent(event, input.now);
      if (result.duplicate) summary.duplicate += 1;
      else summary.projected += 1;
    }
    await input.repository.expireGrace(input.binding.household_id, input.now);
    return summary;
  } finally {
    clearTimeout(timeout);
  }
}
