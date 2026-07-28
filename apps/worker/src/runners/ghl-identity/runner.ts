import type {
  GhlIdentityPlanRepository,
  PlanGhlIdentitySyncInput,
} from '../../../../../packages/contracts/src/communications/ghl-identity/index.ts';
import {
  GhlIdentityError,
  planGhlIdentitySync,
} from '../../../../../packages/domain/src/communications/ghl-identity/index.ts';
import {
  buildGhlIdentityDesiredState,
  type GhlIdentityDesiredState,
} from '../../../../../integrations/highlevel/v21/identity/index.ts';

export interface GhlIdentityProviderPort {
  submitDesiredState(state: GhlIdentityDesiredState): Promise<void>;
}

export interface RunGhlIdentityInput {
  input: PlanGhlIdentitySyncInput;
  expected_version: number;
  repository: GhlIdentityPlanRepository;
  provider: GhlIdentityProviderPort;
}

export type GhlIdentityRunResult =
  | { state: 'student_prohibited'; provider_calls: 0 }
  | { state: 'stale_fenced'; provider_calls: 0 }
  | { state: 'identity_review'; provider_calls: 0; review_id: string }
  | { state: 'submitted'; provider_calls: 1 }
  | { state: 'retry_scheduled'; provider_calls: 1 };

export async function runGhlIdentitySync(
  input: RunGhlIdentityInput,
): Promise<GhlIdentityRunResult> {
  let plan;
  try {
    plan = planGhlIdentitySync(input.input);
  } catch (error) {
    if (error instanceof GhlIdentityError && error.code === 'student_contact_prohibited') {
      return { state: 'student_prohibited', provider_calls: 0 };
    }
    throw error;
  }
  const persisted = await input.repository.persistPlan(plan, input.expected_version);
  if (!persisted) return { state: 'stale_fenced', provider_calls: 0 };
  if (plan.review_case !== null) {
    return {
      state: 'identity_review',
      provider_calls: 0,
      review_id: plan.review_case.review_id,
    };
  }
  try {
    await input.provider.submitDesiredState(buildGhlIdentityDesiredState(plan));
    return { state: 'submitted', provider_calls: 1 };
  } catch {
    await input.repository.markRetry({
      operation_id: plan.operation_id,
      expected_version: input.expected_version + 1,
      safe_error_code: 'ghl_submit_failed',
    });
    return { state: 'retry_scheduled', provider_calls: 1 };
  }
}
