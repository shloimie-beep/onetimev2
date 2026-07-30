import type { AdultRole } from '../accounts/v21-household-identity.ts';

export const HOUSEHOLD_AUTHORIZATION_CONTRACT_VERSION = '1.0.0' as const;

export const ADULT_CAPABILITY_VALUES = [
  'admin:operate_accounts',
  'admin:transfer_household',
  'admin:govern_learning',
  'parent:read_household',
  'parent:manage_students',
  'parent:manage_student_credentials',
  'parent:read_schedule_summary',
  'parent:read_billing',
  'parent:request_support',
] as const;
export type AdultCapability = (typeof ADULT_CAPABILITY_VALUES)[number];

export const ADULT_ROLE_CAPABILITIES = {
  admin: ['admin:operate_accounts', 'admin:transfer_household', 'admin:govern_learning'],
  parent: [
    'parent:read_household',
    'parent:manage_students',
    'parent:manage_student_credentials',
    'parent:read_schedule_summary',
    'parent:read_billing',
    'parent:request_support',
  ],
} as const satisfies Record<AdultRole, readonly AdultCapability[]>;

export const STUDENT_ONLY_CAPABILITIES = [
  'student:join_class',
  'student:read_library',
  'student:read_recording',
  'student:ask_private_question',
  'student:read_student_notices',
] as const;
export type StudentOnlyCapability = (typeof STUDENT_ONLY_CAPABILITIES)[number];

export interface AdultAuthorizationContext {
  humanAccountId: string;
  memberships: readonly AdultRole[];
  activeRole: AdultRole;
  activeHouseholdId: string | null;
  serverResolvedOwnedHouseholdIds: readonly string[];
}

export type AdultAuthorizationDecision =
  | {
      allowed: true;
      activeRole: AdultRole;
      householdId: string | null;
      capability: AdultCapability;
    }
  | {
      allowed: false;
      reason:
        | 'membership_missing'
        | 'wrong_role_context'
        | 'household_context_required'
        | 'cross_household_denied'
        | 'capability_denied'
        | 'student_surface_requires_student_credentials';
    };
