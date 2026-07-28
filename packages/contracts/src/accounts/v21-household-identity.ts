import type { RuntimeTier, VerificationEnvironmentId } from '../state/index.ts';

export const HOUSEHOLD_IDENTITY_CONTRACT_VERSION = '1.0.0' as const;
export const ONE_TIME_PRODUCT_SCOPE = 'one_time_mishnayos' as const;

export const ADULT_ROLE_VALUES = ['admin', 'parent'] as const;
export type AdultRole = (typeof ADULT_ROLE_VALUES)[number];

export const STUDENT_RELATIONSHIP_VALUES = ['self', 'dependent'] as const;
export type StudentRelationship = (typeof STUDENT_RELATIONSHIP_VALUES)[number];

export const ADULT_ACCOUNT_STATE_VALUES = ['invited', 'active', 'disabled', 'archived'] as const;
export type AdultAccountState = (typeof ADULT_ACCOUNT_STATE_VALUES)[number];

export const HOUSEHOLD_STATE_VALUES = ['active', 'archived'] as const;
export type HouseholdState = (typeof HOUSEHOLD_STATE_VALUES)[number];

export const STUDENT_STATE_VALUES = ['active', 'archived'] as const;
export type StudentState = (typeof STUDENT_STATE_VALUES)[number];

export const OWNERSHIP_TRANSFER_STATE_VALUES = [
  'pending',
  'accepted',
  'expired',
  'canceled',
  'failed',
] as const;
export type OwnershipTransferState = (typeof OWNERSHIP_TRANSFER_STATE_VALUES)[number];

export const ADULT_SESSION_POLICY = {
  admin: {
    idleMilliseconds: 30 * 60 * 1000,
    absoluteMilliseconds: 12 * 60 * 60 * 1000,
  },
  parent: {
    idleMilliseconds: 24 * 60 * 60 * 1000,
    absoluteMilliseconds: 30 * 24 * 60 * 60 * 1000,
  },
} as const satisfies Record<AdultRole, { idleMilliseconds: number; absoluteMilliseconds: number }>;

export interface VersionedRecord {
  product: typeof ONE_TIME_PRODUCT_SCOPE;
  runtimeTier: RuntimeTier;
  verificationEnvironmentId: VerificationEnvironmentId;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdultIdentity extends VersionedRecord {
  adultId: string;
  product: typeof ONE_TIME_PRODUCT_SCOPE;
  normalizedEmail: string;
  displayName: string;
  state: 'active' | 'archived';
}

export interface HumanAccount extends VersionedRecord {
  humanAccountId: string;
  product: typeof ONE_TIME_PRODUCT_SCOPE;
  adultId: string;
  memberships: readonly AdultRole[];
  state: AdultAccountState;
  securityVersion: number;
}

export interface Household extends VersionedRecord {
  householdId: string;
  product: typeof ONE_TIME_PRODUCT_SCOPE;
  ownerAdultId: string;
  ownerHumanAccountId: string;
  classification: 'family' | 'school';
  displayName: string;
  seatLimit: number;
  activeSeatCount: number;
  state: HouseholdState;
}

export interface SafeHouseholdContext {
  householdId: string;
  displayName: string;
  classification: Household['classification'];
  accessState: 'free' | 'active' | 'grace' | 'inactive';
  ownerRelationship: 'account_owner';
}

export interface AdultSession extends VersionedRecord {
  sessionId: string;
  humanAccountId: string;
  activeRole: AdultRole;
  activeHouseholdId: string | null;
  securityVersion: number;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  revokedAt: string | null;
  revocationReason: string | null;
}

export interface StudentProfile extends VersionedRecord {
  studentId: string;
  product: typeof ONE_TIME_PRODUCT_SCOPE;
  householdId: string;
  relationship: StudentRelationship;
  selfAdultId: string | null;
  state: StudentState;
  credentialId: string;
  immutableHistoryReference: string;
}

export interface RequiredTransferPolicySet {
  policySetVersion: string;
  serviceAccountVersion: string;
  recordingParticipationVersion: string;
}

export interface DependentTransferAttestation {
  studentId: string;
  replacementAdultId: string;
  authorityConfirmed: true;
  serviceAccountVersion: string;
  recordingParticipationVersion: string;
  recordedAt: string;
}

export interface HouseholdOwnershipTransfer extends VersionedRecord {
  transferId: string;
  product: typeof ONE_TIME_PRODUCT_SCOPE;
  householdId: string;
  outgoingAdultId: string;
  outgoingHumanAccountId: string;
  replacementNormalizedEmail: string;
  replacementAdultId: string | null;
  initiatedByAdminAccountId: string;
  state: OwnershipTransferState;
  expiresAt: string;
  acceptedAt: string | null;
  acceptedByAdultId: string | null;
  acceptanceRequestHash: string | null;
  requiredPolicies: RequiredTransferPolicySet;
}

export interface OwnershipTransferAcceptance {
  idempotencyKey: string;
  canonicalRequestHash: string;
  expectedTransferVersion: number;
  expectedHouseholdVersion: number;
  expectedReplacementAccountVersion: number | null;
  replacementNormalizedEmail: string;
  acceptedPolicySetVersion: string;
  dependentAttestations: readonly DependentTransferAttestation[];
  acceptedAt: string;
}

export interface OwnershipTransferAuditEvent {
  eventType: 'household_ownership_transferred';
  transferId: string;
  householdId: string;
  initiatingAdminAccountId: string;
  outgoingAdultId: string;
  replacementAdultId: string;
  occurredAt: string;
  canonicalRequestHash: string;
}

export interface ProviderReassociationIntent {
  intentType: 'household_owner_reassociation';
  householdId: string;
  previousAdultId: string;
  replacementAdultId: string;
  changesFinancialIdentity: false;
  canonicalRequestHash: string;
}

export interface AppliedOwnershipTransfer {
  disposition: 'applied';
  transfer: HouseholdOwnershipTransfer;
  household: Household;
  replacementAdult: AdultIdentity;
  replacementAccount: HumanAccount;
  parentMembershipAdded: boolean;
  outgoingSessionIdsRevoked: readonly string[];
  replacementSessionIdsRevoked: readonly string[];
  billingSessionIdsRevoked: readonly string[];
  setupOrResetTokenIdsInvalidated: readonly string[];
  providerIntent: ProviderReassociationIntent;
  auditEvent: OwnershipTransferAuditEvent;
}

export interface ReplayedOwnershipTransfer {
  disposition: 'replayed';
  transfer: HouseholdOwnershipTransfer;
  canonicalRequestHash: string;
}

export type OwnershipTransferAcceptanceResult =
  AppliedOwnershipTransfer | ReplayedOwnershipTransfer;

export interface SelfStudentMoveResult {
  student: StudentProfile;
  sourceHousehold: Household;
  targetHousehold: Household;
  studentSessionIdsRevoked: readonly string[];
  classroomOrPlaybackGrantIdsRevoked: readonly string[];
  preservedStudentId: true;
  preservedCredentialId: true;
  preservedHistoryReference: true;
}

export interface ArchivedSelfStudentResult {
  student: StudentProfile;
  household: Household;
  studentSessionIdsRevoked: readonly string[];
  classroomOrPlaybackGrantIdsRevoked: readonly string[];
  preservedStudentId: true;
  preservedCredentialId: true;
  preservedHistoryReference: true;
}

export const HOUSEHOLD_IDENTITY_ERROR_CODES = [
  'invalid_identity',
  'invalid_normalized_email',
  'invalid_role',
  'invalid_role_context',
  'invalid_household_context',
  'cross_household_denied',
  'account_inactive',
  'stale_version',
  'idempotency_conflict',
  'transfer_not_pending',
  'transfer_expired',
  'transfer_replacement_mismatch',
  'active_self_student_blocks_transfer',
  'dependent_attestation_missing',
  'dependent_attestation_stale',
  'replacement_policy_mismatch',
  'seat_limit_reached',
  'self_student_owner_mismatch',
  'student_relationship_immutable',
] as const;
export type HouseholdIdentityErrorCode = (typeof HOUSEHOLD_IDENTITY_ERROR_CODES)[number];
