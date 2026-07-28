import {
  ADULT_ROLE_CAPABILITIES,
  STUDENT_ONLY_CAPABILITIES,
  type AdultAuthorizationContext,
  type AdultAuthorizationDecision,
  type AdultCapability,
  type StudentOnlyCapability,
} from '../../../contracts/src/access/v21-household-authorization.ts';

export function authorizeAdultCapability(input: {
  context: AdultAuthorizationContext;
  requiredRole: 'admin' | 'parent';
  capability: AdultCapability | StudentOnlyCapability;
  householdId?: string;
}): AdultAuthorizationDecision {
  if (!input.context.memberships.includes(input.context.activeRole)) {
    return { allowed: false, reason: 'membership_missing' };
  }
  if (input.context.activeRole !== input.requiredRole) {
    return { allowed: false, reason: 'wrong_role_context' };
  }
  if ((STUDENT_ONLY_CAPABILITIES as readonly string[]).includes(input.capability)) {
    return { allowed: false, reason: 'student_surface_requires_student_credentials' };
  }
  if (
    !(ADULT_ROLE_CAPABILITIES[input.context.activeRole] as readonly string[]).includes(
      input.capability,
    )
  ) {
    return { allowed: false, reason: 'capability_denied' };
  }

  if (input.requiredRole === 'parent') {
    if (
      !input.context.activeHouseholdId ||
      input.householdId === undefined ||
      input.householdId !== input.context.activeHouseholdId
    ) {
      return { allowed: false, reason: 'household_context_required' };
    }
    if (!new Set(input.context.serverResolvedOwnedHouseholdIds).has(input.householdId)) {
      return { allowed: false, reason: 'cross_household_denied' };
    }
    return {
      allowed: true,
      activeRole: 'parent',
      householdId: input.householdId,
      capability: input.capability as AdultCapability,
    };
  }

  return {
    allowed: true,
    activeRole: 'admin',
    householdId: input.householdId ?? null,
    capability: input.capability as AdultCapability,
  };
}
