import type {
  BillingAuthorizationDecision,
  BillingAuthorizationInput,
} from '../../../../contracts/src/billing/access/index.ts';
import {
  INACTIVE_PARENT_CAPABILITIES,
  STUDENT_INACTIVE_DENIAL_COPY,
} from '../../../../contracts/src/billing/access/index.ts';
import { resolveBillingAccessState } from './projection.ts';

const GENERIC_DENIAL = 'You do not have access to this page.';

export function authorizeBillingAccess(
  input: BillingAuthorizationInput,
): BillingAuthorizationDecision {
  if (
    input.session_household_id !== input.requested_household_id ||
    input.projection.household_id !== input.requested_household_id
  ) {
    return denied('HOUSEHOLD_SCOPE_DENIED', GENERIC_DENIAL);
  }
  if (!input.upstream_role_authorized) {
    return denied('UPSTREAM_ROLE_DENIED', GENERIC_DENIAL);
  }

  const state = resolveBillingAccessState(input.projection, input.now);
  if (state !== 'inactive') {
    return {
      allowed: true,
      access_state: state,
      data_scope: 'role_appropriate',
      provider_bootstrap_allowed: input.role === 'parent',
    };
  }
  if (input.role === 'student') {
    return denied('HOUSEHOLD_INACTIVE', STUDENT_INACTIVE_DENIAL_COPY);
  }
  if (
    !INACTIVE_PARENT_CAPABILITIES.includes(
      input.route_capability as (typeof INACTIVE_PARENT_CAPABILITIES)[number],
    )
  ) {
    return denied('INACTIVE_ROUTE_DENIED', GENERIC_DENIAL);
  }
  return {
    allowed: true,
    access_state: 'inactive',
    data_scope: 'inactive_parent_minimal',
    provider_bootstrap_allowed: false,
  };
}

function denied(
  code: Extract<BillingAuthorizationDecision, { allowed: false }>['code'],
  publicMessage: string,
): Extract<BillingAuthorizationDecision, { allowed: false }> {
  return {
    allowed: false,
    code,
    public_message: publicMessage,
    deny_before_protected_render: true,
    provider_bootstrap_allowed: false,
  };
}
