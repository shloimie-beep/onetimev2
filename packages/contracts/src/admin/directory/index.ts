import type {
  AdultSession,
  AdultIdentity,
  Household,
  HouseholdOwnershipTransfer,
  HumanAccount,
  OwnershipTransferAcceptance,
  OwnershipTransferAcceptanceResult,
  StudentProfile,
} from '../../accounts/v21-household-identity.ts';
import type { AuthenticatedPrincipal } from '../../identity/auth/index.ts';
import type { RuntimeTier, VerificationEnvironmentId } from '../../state/index.ts';

export const ADMIN_DIRECTORY_CONTRACT_VERSION = '2.1.0' as const;
export const FAMILY_STUDENT_SEAT_LIMIT = 3 as const;

export type AdminDirectoryScope = {
  product: 'one_time_mishnayos';
  runtimeTier: RuntimeTier;
  verificationEnvironmentId: VerificationEnvironmentId;
};

export type AdminDirectoryActor = AdminDirectoryScope & {
  principal: AuthenticatedPrincipal;
};

export type AdminStudentRecord = StudentProfile & {
  displayName: string;
  username: string;
  credentialVersion: number;
  credentialState: 'active' | 'reset_required' | 'disabled';
};

export type SchoolSeatAllowance = AdminDirectoryScope & {
  householdId: string;
  seatLimit: number;
  contractReference: string;
  reason: string;
  authorizedAt: string;
};

export type AdminHouseholdRecord = Household & {
  accessState: 'free' | 'active' | 'grace' | 'inactive';
  schoolSeatAllowance: SchoolSeatAllowance | null;
};

export type ServiceAccountAcceptanceEvidence = AdminDirectoryScope & {
  acceptanceId: string;
  householdId: string;
  studentId: string;
  acceptedByAdultId: string;
  acceptedServiceAccountVersion: string;
  canonicalRequestHash: string;
  immutableEvidenceReference: string;
  acceptedAt: string;
};

export type CanonicalStudentEnrollment = AdminDirectoryScope & {
  enrollmentId: string;
  householdId: string;
  studentId: string;
  serviceAccountAcceptanceId: string;
  state: 'active' | 'revoked';
  version: number;
  updatedAt: string;
};

export type ActiveAccessSubject =
  | { subjectType: 'adult'; subjectId: string }
  | { subjectType: 'student'; subjectId: string }
  | { subjectType: 'household'; subjectId: string };

export type RevokeAllActiveAccessCommand = ActiveAccessSubject & {
  reason:
    | 'adult_email_changed'
    | 'adult_lifecycle_changed'
    | 'adult_membership_changed'
    | 'household_archived'
    | 'student_archived'
    | 'student_credential_changed';
};

export type ActiveAccessRevocationReadback = AdminDirectoryScope &
  ActiveAccessSubject & {
    readbackId: string;
    complete: true;
    activeSessionIdsRevoked: readonly string[];
    classroomGrantIdsRevoked: readonly string[];
    playbackGrantIdsRevoked: readonly string[];
    enrollmentIdsRevoked: readonly string[];
    revokedAt: string;
  };

export type StudentCredentialReset = AdminDirectoryScope & {
  resetId: string;
  kind: 'initial_activation' | 'reset';
  studentId: string;
  credentialId: string;
  replacementCredentialHash: string;
  credentialVersion: number;
  revocationReadbackId: string | null;
  discloseExistingPassword: false;
  createdAt: string;
};

export type OwnershipTransferEffectBinding = {
  transferId: string;
  householdId: string;
  outgoingHumanAccountId: string;
  replacementHumanAccountId: string;
};

export type LockedOwnershipTransferEffectInventory = AdminDirectoryScope &
  OwnershipTransferEffectBinding & {
    inventoryId: string;
    complete: true;
    outgoingSessions: readonly AdultSession[];
    replacementSessions: readonly AdultSession[];
    billingSessionIds: readonly string[];
    grantIds: readonly string[];
    setupOrResetTokenIds: readonly string[];
    effectAuthorityIds: readonly string[];
  };

export type OwnershipTransferEffectReadback = AdminDirectoryScope &
  OwnershipTransferEffectBinding & {
    inventoryId: string;
    readbackId: string;
    complete: true;
    outgoingSessionIdsRevoked: readonly string[];
    replacementSessionIdsRevoked: readonly string[];
    billingSessionIdsRevoked: readonly string[];
    grantIdsRevoked: readonly string[];
    setupOrResetTokenIdsInvalidated: readonly string[];
    effectAuthorityIdsRevoked: readonly string[];
    revokedAt: string;
  };

export type AdminDirectoryReceipt = AdminDirectoryScope & {
  idempotencyKey: string;
  requestHash: string;
  operation:
    | 'adult_upsert'
    | 'adult_transition'
    | 'household_upsert'
    | 'household_transition'
    | 'student_upsert'
    | 'student_transition'
    | 'student_credential_reset'
    | 'ownership_transfer';
  resultRef: string;
  resultVersion: number;
  committedAt: string;
};

export type AdminDirectoryAuditEvent = AdminDirectoryScope & {
  eventId: string;
  actorHumanAccountId: string;
  operation: AdminDirectoryReceipt['operation'];
  targetRef: string;
  householdId: string | null;
  requestHash: string;
  occurredAt: string;
  containsSensitiveData: false;
};

export type AdultUpsertInput = {
  actor: AdminDirectoryActor;
  email: string;
  displayName: string;
  requestedRole: 'admin' | 'parent';
  proposedAdultId: string;
  proposedHumanAccountId: string;
  existingAdult: AdultIdentity | null;
  existingAccount: HumanAccount | null;
  occurredAt: string;
};

export interface AdminDirectoryUnitOfWork {
  /** Mutation reads are row-locked until the enclosing transaction commits. */
  lockAdult(scope: AdminDirectoryScope, adultId: string): Promise<AdultIdentity | null>;
  saveAdult(adult: AdultIdentity): Promise<void>;
  lockAccount(scope: AdminDirectoryScope, humanAccountId: string): Promise<HumanAccount | null>;
  saveAccount(account: HumanAccount): Promise<void>;
  lockHousehold(
    scope: AdminDirectoryScope,
    householdId: string,
  ): Promise<AdminHouseholdRecord | null>;
  saveHousehold(household: AdminHouseholdRecord): Promise<void>;
  lockStudent(scope: AdminDirectoryScope, studentId: string): Promise<AdminStudentRecord | null>;
  lockStudentByNormalizedUsername(
    scope: AdminDirectoryScope,
    normalizedUsername: string,
  ): Promise<AdminStudentRecord | null>;
  lockActiveStudentsByHousehold(
    scope: AdminDirectoryScope,
    householdId: string,
  ): Promise<readonly AdminStudentRecord[]>;
  lockActiveAdminCount(scope: AdminDirectoryScope): Promise<number>;
  lockOwnedHouseholdIds(scope: AdminDirectoryScope, adultId: string): Promise<readonly string[]>;
  lockCurrentServiceAccountVersion(scope: AdminDirectoryScope): Promise<string>;
  saveStudent(student: AdminStudentRecord): Promise<void>;
  lockCurrentStudentEnrollment(
    scope: AdminDirectoryScope,
    studentId: string,
  ): Promise<CanonicalStudentEnrollment | null>;
  saveStudentEnrollment(enrollment: CanonicalStudentEnrollment): Promise<void>;
  saveServiceAccountAcceptance(evidence: ServiceAccountAcceptanceEvidence): Promise<void>;
  revokeAllActiveAccess(
    scope: AdminDirectoryScope,
    command: RevokeAllActiveAccessCommand,
  ): Promise<ActiveAccessRevocationReadback>;
  lockOwnershipTransfer(
    scope: AdminDirectoryScope,
    transferId: string,
  ): Promise<HouseholdOwnershipTransfer | null>;
  lockOwnershipTransferEffectInventory(
    scope: AdminDirectoryScope,
    binding: OwnershipTransferEffectBinding,
  ): Promise<LockedOwnershipTransferEffectInventory>;
  revokeOwnershipTransferEffects(
    scope: AdminDirectoryScope,
    inventory: LockedOwnershipTransferEffectInventory,
  ): Promise<OwnershipTransferEffectReadback>;
  saveCredentialReset(
    reset: StudentCredentialReset,
    revocation: ActiveAccessRevocationReadback | null,
  ): Promise<void>;
  saveOwnershipTransfer(
    result: OwnershipTransferAcceptanceResult,
    effects: OwnershipTransferEffectReadback | null,
  ): Promise<void>;
  getReceipt(
    scope: AdminDirectoryScope,
    idempotencyKey: string,
  ): Promise<AdminDirectoryReceipt | null>;
  saveReceipt(receipt: AdminDirectoryReceipt): Promise<void>;
  saveAuditEvent(event: AdminDirectoryAuditEvent): Promise<void>;
}

export interface AdminDirectoryRepository {
  inTransaction<T>(run: (unit: AdminDirectoryUnitOfWork) => Promise<T>): Promise<T>;
}

export type AdminDirectoryCommandIdentity = {
  idempotencyKey: string;
  requestHash: string;
  expectedVersion: number;
  occurredAt: string;
};

export type OwnershipTransferCommand = AdminDirectoryCommandIdentity & {
  actor: AdminDirectoryActor;
  acceptance: OwnershipTransferAcceptance;
};

export const ADMIN_DIRECTORY_ERROR_CODES = {
  accessDenied: 'admin_directory_access_denied',
  crossScope: 'admin_directory_cross_scope',
  conflict: 'admin_directory_idempotency_conflict',
  staleVersion: 'admin_directory_stale_version',
  invalidState: 'admin_directory_invalid_state',
  invalidInput: 'admin_directory_invalid_input',
  seatLimit: 'admin_directory_seat_limit',
  credentialDenied: 'admin_directory_credential_denied',
} as const;
