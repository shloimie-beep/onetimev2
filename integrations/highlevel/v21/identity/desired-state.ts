import type {
  GhlIdentityIntent,
  GhlIdentitySyncPlan,
} from '../../../../packages/contracts/src/communications/ghl-identity/index.ts';

export const GHL_IDENTITY_DESIRED_STATE_VERSION = '1.0.0';

export interface GhlIdentityDesiredState {
  operation_id: string;
  adult_only: true;
  fail_closed: boolean;
  intents: readonly GhlIdentityIntent[];
}

export function buildGhlIdentityDesiredState(plan: GhlIdentitySyncPlan): GhlIdentityDesiredState {
  if (!plan.student_contact_prohibited) {
    throw new Error('student_contact_boundary_required');
  }
  return {
    operation_id: plan.operation_id,
    adult_only: true,
    fail_closed: plan.review_case !== null,
    intents: plan.review_case === null ? plan.intents : [],
  };
}
