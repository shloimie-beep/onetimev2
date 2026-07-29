import type {
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

export type StudentCredentialReset = AdminDirectoryScope & {
  resetId: string;
  studentId: string;
  credentialId: string;
  replacementCredentialHash: string;
  credentialVersion: number;
  studentSessionIdsRevoked: readonly string[];
  discloseExistingPassword: false;
  createdAt: string;
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
  lockHousehold(scope: AdminDirectoryScope, householdId: string): Promise<Household | null>;
  saveHousehold(household: Household): Promise<void>;
  lockStudent(scope: AdminDirectoryScope, studentId: string): Promise<AdminStudentRecord | null>;
  saveStudent(student: AdminStudentRecord): Promise<void>;
  lockOwnershipTransfer(
    scope: AdminDirectoryScope,
    transferId: string,
  ): Promise<HouseholdOwnershipTransfer | null>;
  saveCredentialReset(reset: StudentCredentialReset): Promise<void>;
  saveOwnershipTransfer(result: OwnershipTransferAcceptanceResult): Promise<void>;
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
