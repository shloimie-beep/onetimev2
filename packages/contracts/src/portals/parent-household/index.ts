export { isStudentPin, STUDENT_PIN_LENGTH } from '../../identity/auth/index.ts';

export const PARENT_HOUSEHOLD_CONTRACT_VERSION = '1.2.0' as const;
export const STANDARD_FAMILY_STUDENT_ALLOWANCE = 3 as const;

export const STUDENT_ACTUAL_NAME_INSTRUCTIONS = {
  self: 'Please use your actual name so Rabbi Eli can identify you during class.',
  dependent: 'Please use the Student’s actual name so Rabbi Eli can identify them during class.',
} as const;

export type ParentHouseholdAccessState = 'free' | 'active' | 'grace' | 'inactive';
export type ParentStudentRelationship = keyof typeof STUDENT_ACTUAL_NAME_INSTRUCTIONS;
export type ParentStudentLifecycle = 'active' | 'archived';

export type ParentHouseholdPrincipal = {
  role: 'parent';
  adult_id: string;
  household_id: string;
  session_id: string;
};

export type ParentManagedStudent = {
  student_id: string;
  household_id: string;
  actual_name: string;
  display_name: string | null;
  username: string;
  relationship: ParentStudentRelationship;
  state: ParentStudentLifecycle;
  credential_version: number;
  version: number;
};

export type ParentHouseholdRecord = {
  household_id: string;
  owner_adult_id: string;
  display_name: string;
  access_state: ParentHouseholdAccessState;
  student_allowance: number;
  revision: number;
  students: readonly ParentManagedStudent[];
};

export type ParentHouseholdSnapshot = {
  contract_version: typeof PARENT_HOUSEHOLD_CONTRACT_VERSION;
  household_id: string;
  display_name: string;
  access_state: ParentHouseholdAccessState;
  student_allowance: number;
  active_student_count: number;
  available_student_seats: number;
  can_manage_students: boolean;
  revision: number;
  students: readonly ParentManagedStudent[];
};

export type StudentProfileInput = {
  actual_name: string;
  display_name?: string | null;
  username: string;
  relationship: ParentStudentRelationship;
};

export type StudentCredentialInput = {
  new_password: string;
  password_confirmation: string;
};

export type CreateParentStudentCommand = Omit<StudentProfileInput, 'relationship'> &
  StudentCredentialInput & {
    relationship: 'dependent';
    expected_revision: number;
  };

export type UpdateParentStudentCommand = {
  student_id: string;
  expected_revision: number;
  actual_name: string;
  display_name?: string | null;
  username: string;
};

export type ParentStudentLifecycleCommand = {
  student_id: string;
  expected_revision: number;
};

export type ResetParentStudentCredentialCommand = StudentCredentialInput & {
  student_id: string;
  expected_revision: number;
};

export type StudentCredentialHandoff = {
  student_id: string;
  student_label: string;
  username: string;
  new_password: string;
  display_once: true;
  may_copy_or_print: true;
  emailed: false;
};

export type ParentHouseholdAuditEvent = {
  actor_adult_id: string;
  household_id: string;
  student_id: string;
  action:
    | 'student_created'
    | 'student_profile_updated'
    | 'student_archived'
    | 'student_restored'
    | 'student_credential_reset';
};

export type ParentHouseholdMutation = {
  snapshot: ParentHouseholdSnapshot;
  audit: ParentHouseholdAuditEvent;
  revoke_student_sessions: boolean;
  canonical_enrollment: 'enroll' | 'disable' | 'unchanged';
  credential_handoff: StudentCredentialHandoff | null;
};

export type ParentHouseholdMutationOperation = ParentHouseholdAuditEvent['action'];

/**
 * This binding is derived by the authenticated server router from the exact
 * request and server clock. Request bodies cannot choose or override it.
 */
export type ParentHouseholdMutationContext = {
  idempotency_key: string;
  canonical_request_hash: string;
  occurred_at: string;
};

export type ParentHouseholdMutationReceipt = {
  disposition: 'committed' | 'replayed';
  operation: ParentHouseholdMutationOperation;
  student_id: string;
  household_revision: number;
};

export type ParentHouseholdMutationResponse = Pick<
  ParentHouseholdMutation,
  'snapshot' | 'credential_handoff'
>;

export interface ParentHouseholdRepository {
  loadOwnedHousehold(principal: ParentHouseholdPrincipal): Promise<ParentHouseholdRecord | null>;
  isUsernameAvailable(input: {
    principal: ParentHouseholdPrincipal;
    username: string;
    except_student_id?: string;
  }): Promise<boolean>;
  findMutation(input: {
    principal: ParentHouseholdPrincipal;
    operation: ParentHouseholdMutationOperation;
    context: ParentHouseholdMutationContext;
  }): Promise<ParentHouseholdMutationReceipt | null>;
  commitMutation(input: {
    principal: ParentHouseholdPrincipal;
    context: ParentHouseholdMutationContext;
    expected_revision: number;
    next: ParentHouseholdRecord;
    audit: ParentHouseholdAuditEvent;
    password_hash_factory: (() => Promise<string>) | null;
    revoke_student_sessions: boolean;
    canonical_enrollment: 'enroll' | 'disable' | 'unchanged';
  }): Promise<ParentHouseholdMutationReceipt>;
}

export interface ParentStudentPasswordPort {
  hash(new_password: string): Promise<string>;
}

export interface ParentStudentIdPort {
  nextStudentId(): string;
}

export const PARENT_HOUSEHOLD_ERROR_CODES = {
  scopeDenied: 'parent_household_scope_denied',
  accessInactive: 'parent_household_access_inactive',
  householdMissing: 'parent_household_missing',
  studentMissing: 'parent_student_missing',
  seatLimit: 'parent_student_seat_limit',
  conflict: 'parent_household_revision_conflict',
  idempotencyConflict: 'parent_household_idempotency_conflict',
  persistenceInvariant: 'parent_household_persistence_invariant',
  usernameUnavailable: 'parent_student_username_unavailable',
  invalidInput: 'parent_student_input_invalid',
  archived: 'parent_student_archived',
  lifecycleUnchanged: 'parent_student_lifecycle_unchanged',
} as const;
