import {
  ADMIN_DIRECTORY_ERROR_CODES,
  FAMILY_STUDENT_SEAT_LIMIT,
  type AdminDirectoryActor,
  type AdminHouseholdRecord,
  type AdminDirectoryScope,
  type AdminStudentRecord,
  type AdultUpsertInput,
  type CanonicalStudentEnrollment,
  type LockedOwnershipTransferEffectInventory,
  type RevokeAllActiveAccessCommand,
  type SchoolSeatAllowance,
  type ServiceAccountAcceptanceEvidence,
  type StudentCredentialReset,
} from '../../../contracts/src/admin/directory/index.ts';
import {
  ONE_TIME_PRODUCT_SCOPE,
  type AdultIdentity,
  type Household,
  type HumanAccount,
  type OwnershipTransferAcceptanceResult,
  type StudentProfile,
} from '../../../contracts/src/accounts/v21-household-identity.ts';
import { VERIFICATION_RUNTIME_TIER } from '../../../contracts/src/state/index.ts';
import { authPasswordHashNeedsUpgrade, authorizeStudentCredentialChange } from '../auth/index.ts';
import {
  acceptHouseholdOwnershipTransfer,
  createOrLinkAdultIdentity,
  normalizeAdultEmail,
} from '../accounts/index.ts';
import {
  adminDirectorySha256,
  safeDirectoryIdentifier,
  safeDirectoryLabel,
} from '../contact-operations/index.ts';

export class AdminDirectoryError extends Error {
  constructor(
    public readonly code: (typeof ADMIN_DIRECTORY_ERROR_CODES)[keyof typeof ADMIN_DIRECTORY_ERROR_CODES],
    message: string,
  ) {
    super(message);
  }
}

export function assertRuntimeAdmin(actor: AdminDirectoryActor, scope: AdminDirectoryScope) {
  assertScope(actor, scope);
  if (
    actor.principal.role !== 'admin' ||
    actor.principal.household_id !== null ||
    actor.principal.student_id !== null ||
    !safeDirectoryIdentifier(actor.principal.human_account_id, 'admin')
  ) {
    fail('accessDenied', 'A current server-validated Admin session is required.');
  }
}

export function upsertAdultContact(input: AdultUpsertInput) {
  assertRuntimeAdmin(input.actor, input.actor);
  const result = createOrLinkAdultIdentity({
    email: input.email,
    displayName: safeDirectoryLabel(input.displayName, 'adult_name'),
    requestedRole: input.requestedRole,
    proposedAdultId: safeDirectoryIdentifier(input.proposedAdultId, 'adult'),
    proposedHumanAccountId: safeDirectoryIdentifier(input.proposedHumanAccountId, 'human_account'),
    runtimeTier: input.actor.runtimeTier,
    verificationEnvironmentId: input.actor.verificationEnvironmentId,
    existingAdult: input.existingAdult,
    existingAccount: input.existingAccount,
    now: validDate(input.occurredAt),
  });
  assertScope(input.actor, result.adult, result.account);
  const membershipChanged =
    input.existingAccount !== null &&
    [...input.existingAccount.memberships].sort().join(',') !==
      [...result.account.memberships].sort().join(',');
  return {
    ...result,
    revokeAllAccess: membershipChanged
      ? [adultRevocation(result.account.humanAccountId, 'adult_membership_changed')]
      : [],
  };
}

export function editAdultContact(input: {
  actor: AdminDirectoryActor;
  adult: AdultIdentity;
  account: HumanAccount;
  expectedAdultVersion: number;
  expectedAccountVersion: number;
  displayName: string;
  email: string;
  occurredAt: string;
}) {
  assertRuntimeAdmin(input.actor, input.adult);
  assertScope(input.actor, input.account);
  assertVersion(input.adult.version, input.expectedAdultVersion);
  assertVersion(input.account.version, input.expectedAccountVersion);
  if (input.account.adultId !== input.adult.adultId) fail('crossScope', 'Adult account mismatch.');
  const occurredAt = validDate(input.occurredAt).toISOString();
  const normalizedEmail = normalizeAdultEmail(input.email);
  const emailChanged = normalizedEmail !== input.adult.normalizedEmail;
  return {
    adult: {
      ...input.adult,
      displayName: safeDirectoryLabel(input.displayName, 'adult_name'),
      normalizedEmail,
      version: input.adult.version + 1,
      updatedAt: occurredAt,
    },
    account: emailChanged
      ? {
          ...input.account,
          securityVersion: input.account.securityVersion + 1,
          version: input.account.version + 1,
          updatedAt: occurredAt,
        }
      : input.account,
    revokeAllAccess: emailChanged
      ? [adultRevocation(input.account.humanAccountId, 'adult_email_changed')]
      : [],
  };
}

export function transitionAdultContact(input: {
  actor: AdminDirectoryActor;
  adult: AdultIdentity;
  account: HumanAccount;
  expectedAdultVersion: number;
  expectedAccountVersion: number;
  to: 'archived' | 'active';
  lockedActiveAdminCount: number;
  lockedOwnedHouseholdIds: readonly string[];
  occurredAt: string;
}) {
  assertRuntimeAdmin(input.actor, input.adult);
  assertScope(input.actor, input.account);
  assertVersion(input.adult.version, input.expectedAdultVersion);
  assertVersion(input.account.version, input.expectedAccountVersion);
  if (input.account.adultId !== input.adult.adultId) fail('crossScope', 'Adult account mismatch.');
  if (input.adult.state === input.to) fail('invalidState', 'Adult already has requested state.');
  if (input.to === 'active' && input.account.state === 'disabled') {
    fail('invalidState', 'A disabled HumanAccount cannot be reactivated by the directory.');
  }
  if (
    input.to === 'archived' &&
    input.account.memberships.includes('admin') &&
    (!Number.isSafeInteger(input.lockedActiveAdminCount) || input.lockedActiveAdminCount <= 1)
  ) {
    fail('invalidState', 'The final active Admin cannot be archived.');
  }
  if (input.to === 'archived' && uniqueIds(input.lockedOwnedHouseholdIds).length > 0) {
    fail('invalidState', 'Transfer every owned household before archiving its owner.');
  }
  const occurredAt = validDate(input.occurredAt).toISOString();
  return {
    adult: {
      ...input.adult,
      state: input.to,
      version: input.adult.version + 1,
      updatedAt: occurredAt,
    },
    account: {
      ...input.account,
      state: input.to === 'archived' ? ('archived' as const) : ('active' as const),
      securityVersion: input.account.securityVersion + 1,
      version: input.account.version + 1,
      updatedAt: occurredAt,
    },
    revokeAllAccess: [adultRevocation(input.account.humanAccountId, 'adult_lifecycle_changed')],
  };
}

export function createHousehold(input: {
  actor: AdminDirectoryActor;
  householdId: string;
  owner: AdultIdentity;
  ownerAccount: HumanAccount;
  displayName: string;
  classification: Household['classification'];
  seatLimit: number;
  schoolSeatAllowance: SchoolSeatAllowance | null;
  occurredAt: string;
}): AdminHouseholdRecord {
  assertRuntimeAdmin(input.actor, input.owner);
  assertScope(input.actor, input.ownerAccount);
  if (
    input.ownerAccount.adultId !== input.owner.adultId ||
    !input.ownerAccount.memberships.includes('parent') ||
    input.owner.state !== 'active' ||
    input.ownerAccount.state !== 'active'
  ) {
    fail('invalidState', 'Household owner requires one active Parent membership.');
  }
  assertSeatAllowance(
    input.actor,
    safeDirectoryIdentifier(input.householdId, 'household'),
    input.classification,
    input.seatLimit,
    input.schoolSeatAllowance,
  );
  const occurredAt = validDate(input.occurredAt).toISOString();
  return {
    product: ONE_TIME_PRODUCT_SCOPE,
    runtimeTier: input.actor.runtimeTier,
    verificationEnvironmentId: input.actor.verificationEnvironmentId,
    householdId: safeDirectoryIdentifier(input.householdId, 'household'),
    ownerAdultId: input.owner.adultId,
    ownerHumanAccountId: input.ownerAccount.humanAccountId,
    classification: input.classification,
    displayName: safeDirectoryLabel(input.displayName, 'household_name'),
    seatLimit: input.seatLimit,
    activeSeatCount: 0,
    state: 'active',
    accessState: 'inactive',
    schoolSeatAllowance: input.schoolSeatAllowance,
    version: 1,
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
}

export function editHousehold(input: {
  actor: AdminDirectoryActor;
  household: AdminHouseholdRecord;
  expectedVersion: number;
  displayName: string;
  classification: Household['classification'];
  seatLimit: number;
  schoolSeatAllowance: SchoolSeatAllowance | null;
  occurredAt: string;
}) {
  assertRuntimeAdmin(input.actor, input.household);
  assertVersion(input.household.version, input.expectedVersion);
  assertSeatAllowance(
    input.actor,
    input.household.householdId,
    input.classification,
    input.seatLimit,
    input.schoolSeatAllowance,
  );
  if (input.seatLimit < input.household.activeSeatCount) {
    fail('seatLimit', 'Seat limit cannot be lower than active Student seats.');
  }
  return {
    ...input.household,
    displayName: safeDirectoryLabel(input.displayName, 'household_name'),
    classification: input.classification,
    seatLimit: input.seatLimit,
    schoolSeatAllowance: input.schoolSeatAllowance,
    version: input.household.version + 1,
    updatedAt: validDate(input.occurredAt).toISOString(),
  };
}

export function transitionHousehold(input: {
  actor: AdminDirectoryActor;
  household: AdminHouseholdRecord;
  expectedVersion: number;
  to: 'archived' | 'active';
  lockedActiveStudents: readonly AdminStudentRecord[];
  owner: AdultIdentity;
  ownerAccount: HumanAccount;
  occurredAt: string;
}) {
  assertRuntimeAdmin(input.actor, input.household);
  assertVersion(input.household.version, input.expectedVersion);
  if (input.household.state === input.to)
    fail('invalidState', 'Household already has requested state.');
  for (const student of input.lockedActiveStudents) {
    assertScope(input.actor, student);
    if (student.householdId !== input.household.householdId || student.state !== 'active') {
      fail('crossScope', 'Locked active Student inventory is invalid.');
    }
  }
  if (
    input.to === 'active' &&
    (input.owner.adultId !== input.household.ownerAdultId ||
      input.ownerAccount.humanAccountId !== input.household.ownerHumanAccountId ||
      input.ownerAccount.adultId !== input.owner.adultId ||
      input.owner.state !== 'active' ||
      input.ownerAccount.state !== 'active' ||
      !input.ownerAccount.memberships.includes('parent'))
  ) {
    fail('invalidState', 'Household restore requires its active locked owner.');
  }
  assertScope(input.actor, input.owner, input.ownerAccount);
  const occurredAt = validDate(input.occurredAt).toISOString();
  return {
    household: {
      ...input.household,
      state: input.to,
      accessState: 'inactive' as const,
      version: input.household.version + 1,
      updatedAt: occurredAt,
    },
    revokeAllAccess:
      input.to === 'archived'
        ? [
            {
              subjectType: 'household' as const,
              subjectId: input.household.householdId,
              reason: 'household_archived' as const,
            },
            ...input.lockedActiveStudents.map((student) =>
              studentRevocation(student.studentId, 'student_archived'),
            ),
          ]
        : [],
  };
}

export function createStudent(input: {
  actor: AdminDirectoryActor;
  household: AdminHouseholdRecord;
  expectedHouseholdVersion: number;
  studentId: string;
  displayName: string;
  username: string;
  lockedUsernameMatch: AdminStudentRecord | null;
  relationship: StudentProfile['relationship'];
  selfAdultId: string | null;
  credentialId: string;
  replacementCredentialHash: string;
  serviceAccountAcceptance: ServiceAccountAcceptanceEvidence;
  currentServiceAccountVersion: string;
  immutableHistoryReference: string;
  occurredAt: string;
}): {
  student: AdminStudentRecord;
  household: AdminHouseholdRecord;
  credentialReset: StudentCredentialReset;
  enrollment: CanonicalStudentEnrollment;
  serviceAccountAcceptance: ServiceAccountAcceptanceEvidence;
} {
  assertRuntimeAdmin(input.actor, input.household);
  assertVersion(input.household.version, input.expectedHouseholdVersion);
  if (
    input.household.state !== 'active' ||
    input.household.accessState === 'inactive' ||
    input.household.activeSeatCount >= input.household.seatLimit
  ) {
    fail('seatLimit', 'Household has no available Student seat.');
  }
  if (
    (input.relationship === 'self' && !input.selfAdultId) ||
    (input.relationship === 'dependent' && input.selfAdultId !== null) ||
    (input.relationship === 'self' && input.selfAdultId !== input.household.ownerAdultId)
  ) {
    fail('invalidInput', 'Student relationship and self identity must match.');
  }
  const studentId = safeDirectoryIdentifier(input.studentId, 'student');
  const username = safeUsername(input.username);
  assertUsernameAvailable(username, studentId, input.lockedUsernameMatch);
  assertCurrentCredentialHash(input.replacementCredentialHash);
  assertServiceAccountAcceptance(
    input.actor,
    input.serviceAccountAcceptance,
    input.household.householdId,
    studentId,
    input.currentServiceAccountVersion,
    input.household.ownerAdultId,
  );
  const occurredAt = validDate(input.occurredAt).toISOString();
  const credentialId = safeDirectoryIdentifier(input.credentialId, 'credential');
  const credentialReset: StudentCredentialReset = {
    product: ONE_TIME_PRODUCT_SCOPE,
    runtimeTier: input.actor.runtimeTier,
    verificationEnvironmentId: input.actor.verificationEnvironmentId,
    resetId: adminDirectorySha256(`${studentId}:1:${occurredAt}`),
    kind: 'initial_activation',
    studentId,
    credentialId,
    replacementCredentialHash: input.replacementCredentialHash,
    credentialVersion: 1,
    revocationReadbackId: null,
    discloseExistingPassword: false,
    createdAt: occurredAt,
  };
  const enrollment = activeEnrollment(
    input.actor,
    studentId,
    input.household.householdId,
    input.serviceAccountAcceptance,
    occurredAt,
  );
  return {
    student: {
      product: ONE_TIME_PRODUCT_SCOPE,
      runtimeTier: input.actor.runtimeTier,
      verificationEnvironmentId: input.actor.verificationEnvironmentId,
      studentId,
      householdId: input.household.householdId,
      relationship: input.relationship,
      selfAdultId: input.selfAdultId,
      state: 'active',
      credentialId,
      immutableHistoryReference: safeDirectoryIdentifier(
        input.immutableHistoryReference,
        'history',
      ),
      displayName: safeDirectoryLabel(input.displayName, 'student_name'),
      username,
      credentialVersion: 1,
      credentialState: 'active',
      version: 1,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    },
    credentialReset,
    enrollment,
    serviceAccountAcceptance: input.serviceAccountAcceptance,
    household: {
      ...input.household,
      activeSeatCount: input.household.activeSeatCount + 1,
      version: input.household.version + 1,
      updatedAt: occurredAt,
    },
  };
}

export function editStudent(input: {
  actor: AdminDirectoryActor;
  student: AdminStudentRecord;
  expectedVersion: number;
  displayName: string;
  username: string;
  lockedUsernameMatch: AdminStudentRecord | null;
  occurredAt: string;
}) {
  assertRuntimeAdmin(input.actor, input.student);
  assertVersion(input.student.version, input.expectedVersion);
  const username = safeUsername(input.username);
  assertUsernameAvailable(username, input.student.studentId, input.lockedUsernameMatch);
  return {
    ...input.student,
    displayName: safeDirectoryLabel(input.displayName, 'student_name'),
    username,
    version: input.student.version + 1,
    updatedAt: validDate(input.occurredAt).toISOString(),
  };
}

export function transitionStudent(input: {
  actor: AdminDirectoryActor;
  student: AdminStudentRecord;
  household: AdminHouseholdRecord;
  expectedStudentVersion: number;
  expectedHouseholdVersion: number;
  to: 'archived' | 'active';
  lockedUsernameMatch: AdminStudentRecord | null;
  currentEnrollment: CanonicalStudentEnrollment;
  replacementCredentialHash: string | null;
  serviceAccountAcceptance: ServiceAccountAcceptanceEvidence | null;
  currentServiceAccountVersion: string;
  occurredAt: string;
}) {
  assertRuntimeAdmin(input.actor, input.student);
  assertScope(input.actor, input.household);
  assertVersion(input.student.version, input.expectedStudentVersion);
  assertVersion(input.household.version, input.expectedHouseholdVersion);
  if (input.student.householdId !== input.household.householdId) {
    fail('crossScope', 'Student and household do not match.');
  }
  if (input.student.state === input.to)
    fail('invalidState', 'Student already has requested state.');
  if (
    input.to === 'active' &&
    (input.household.state !== 'active' || input.household.accessState === 'inactive')
  ) {
    fail('invalidState', 'Student restore requires active household access.');
  }
  const delta = input.to === 'active' ? 1 : -1;
  if (
    input.household.activeSeatCount + delta < 0 ||
    input.household.activeSeatCount + delta > input.household.seatLimit
  ) {
    fail('seatLimit', 'Student transition conflicts with household seat capacity.');
  }
  const occurredAt = validDate(input.occurredAt).toISOString();
  assertUsernameAvailable(
    input.student.username,
    input.student.studentId,
    input.lockedUsernameMatch,
  );
  let credentialReset: StudentCredentialReset | null = null;
  let enrollment: CanonicalStudentEnrollment;
  if (input.to === 'active') {
    if (!input.replacementCredentialHash || !input.serviceAccountAcceptance) {
      fail('invalidInput', 'Student restore requires a new credential and current acceptance.');
    }
    assertCurrentCredentialHash(input.replacementCredentialHash);
    assertServiceAccountAcceptance(
      input.actor,
      input.serviceAccountAcceptance,
      input.household.householdId,
      input.student.studentId,
      input.currentServiceAccountVersion,
      input.household.ownerAdultId,
    );
    credentialReset = credentialWrite(
      input.actor,
      input.student,
      input.replacementCredentialHash,
      'reset',
      occurredAt,
      null,
    );
    assertRevokedEnrollment(input.actor, input.currentEnrollment, input.student, input.household);
    enrollment = {
      ...input.currentEnrollment,
      serviceAccountAcceptanceId: input.serviceAccountAcceptance.acceptanceId,
      state: 'active',
      version: input.currentEnrollment.version + 1,
      updatedAt: occurredAt,
    };
  } else {
    assertEnrollment(input.actor, input.currentEnrollment, input.student);
    enrollment = {
      ...input.currentEnrollment,
      state: 'revoked',
      version: input.currentEnrollment.version + 1,
      updatedAt: occurredAt,
    };
  }
  return {
    student: {
      ...input.student,
      state: input.to,
      credentialState: input.to === 'archived' ? ('disabled' as const) : ('active' as const),
      credentialVersion:
        input.to === 'active'
          ? input.student.credentialVersion + 1
          : input.student.credentialVersion,
      version: input.student.version + 1,
      updatedAt: occurredAt,
    },
    household: {
      ...input.household,
      activeSeatCount: input.household.activeSeatCount + delta,
      version: input.household.version + 1,
      updatedAt: occurredAt,
    },
    credentialReset,
    enrollment,
    serviceAccountAcceptance: input.to === 'active' ? input.serviceAccountAcceptance : null,
    revokeAllAccess:
      input.to === 'archived'
        ? [studentRevocation(input.student.studentId, 'student_archived')]
        : [],
  };
}

export function planStudentCredentialReset(input: {
  actor: AdminDirectoryActor;
  student: AdminStudentRecord;
  replacementCredentialHash: string;
  occurredAt: string;
}): {
  student: AdminStudentRecord;
  reset: StudentCredentialReset;
  revokeAllAccess: readonly RevokeAllActiveAccessCommand[];
} {
  assertRuntimeAdmin(input.actor, input.student);
  const authorization = authorizeStudentCredentialChange({
    actor: { role: input.actor.principal.role, household_ids: [] },
    target: {
      student_id: input.student.studentId,
      household_id: input.student.householdId,
      account_state: input.student.state === 'active' ? 'active' : 'archived',
    },
  });
  if (!authorization.allowed) fail('credentialDenied', authorization.public_message);
  assertCurrentCredentialHash(input.replacementCredentialHash);
  const occurredAt = validDate(input.occurredAt).toISOString();
  const student = {
    ...input.student,
    credentialVersion: input.student.credentialVersion + 1,
    credentialState: 'active' as const,
    version: input.student.version + 1,
    updatedAt: occurredAt,
  };
  return {
    student,
    reset: credentialWrite(
      input.actor,
      input.student,
      input.replacementCredentialHash,
      'reset',
      occurredAt,
      null,
    ),
    revokeAllAccess: [studentRevocation(input.student.studentId, 'student_credential_changed')],
  };
}

export function completeVerifiedOwnershipTransfer(
  input: Omit<
    Parameters<typeof acceptHouseholdOwnershipTransfer>[0],
    'outgoingSessions' | 'replacementSessions' | 'billingSessionIds' | 'setupOrResetTokenIds'
  > & {
    actor: AdminDirectoryActor;
    lockedEffectInventory: LockedOwnershipTransferEffectInventory;
  },
): OwnershipTransferAcceptanceResult {
  assertRuntimeAdmin(input.actor, input.transfer);
  assertScope(input.actor, input.adminAccount, input.household);
  if (input.adminAccount.humanAccountId !== input.actor.principal.human_account_id) {
    fail('accessDenied', 'Transfer Admin must match the current authenticated principal.');
  }
  const inventory = input.lockedEffectInventory;
  assertScope(
    input.actor,
    inventory,
    ...inventory.outgoingSessions,
    ...inventory.replacementSessions,
  );
  const replacementHumanAccountId =
    input.replacementAccount?.humanAccountId ??
    safeDirectoryIdentifier(input.proposedReplacementHumanAccountId, 'human_account');
  if (
    inventory.complete !== true ||
    inventory.transferId !== input.transfer.transferId ||
    inventory.householdId !== input.household.householdId ||
    inventory.outgoingHumanAccountId !== input.transfer.outgoingHumanAccountId ||
    inventory.replacementHumanAccountId !== replacementHumanAccountId
  ) {
    fail('invalidState', 'Ownership transfer requires its exact complete locked effect inventory.');
  }
  safeDirectoryIdentifier(inventory.inventoryId, 'ownership_effect_inventory');
  for (const session of inventory.outgoingSessions) {
    if (
      session.humanAccountId !== inventory.outgoingHumanAccountId ||
      session.activeRole !== 'parent' ||
      session.revokedAt !== null
    ) {
      fail('invalidState', 'Outgoing ownership session inventory is not exact and active.');
    }
  }
  for (const session of inventory.replacementSessions) {
    if (
      session.humanAccountId !== inventory.replacementHumanAccountId ||
      session.revokedAt !== null
    ) {
      fail('invalidState', 'Replacement ownership session inventory is not exact and active.');
    }
  }
  assertUniqueInventoryIds(inventory);
  const result = acceptHouseholdOwnershipTransfer({
    adminAccount: input.adminAccount,
    transfer: input.transfer,
    household: input.household,
    activeStudents: input.activeStudents,
    replacementAdult: input.replacementAdult,
    replacementAccount: input.replacementAccount,
    proposedReplacementAdultId: input.proposedReplacementAdultId,
    proposedReplacementHumanAccountId: input.proposedReplacementHumanAccountId,
    replacementDisplayName: input.replacementDisplayName,
    acceptance: input.acceptance,
    outgoingSessions: inventory.outgoingSessions,
    replacementSessions: inventory.replacementSessions,
    billingSessionIds: inventory.billingSessionIds,
    setupOrResetTokenIds: inventory.setupOrResetTokenIds,
    now: input.now,
  });
  return result.disposition === 'applied'
    ? {
        ...result,
        replacementSessionIdsRevoked: inventory.replacementSessions.map(
          (session) => session.sessionId,
        ),
      }
    : result;
}

function assertScope(first: AdminDirectoryScope, ...rest: readonly AdminDirectoryScope[]) {
  if (
    first.product !== ONE_TIME_PRODUCT_SCOPE ||
    VERIFICATION_RUNTIME_TIER[first.verificationEnvironmentId] !== first.runtimeTier ||
    rest.some(
      (value) =>
        value.product !== first.product ||
        value.runtimeTier !== first.runtimeTier ||
        value.verificationEnvironmentId !== first.verificationEnvironmentId,
    )
  ) {
    fail('crossScope', 'Directory records cannot cross product, runtime, or environment scope.');
  }
}

function assertVersion(current: number, expected: number) {
  if (!Number.isSafeInteger(expected) || expected < 1 || current !== expected) {
    fail('staleVersion', 'Expected aggregate version is stale.');
  }
}

function validDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) fail('invalidInput', 'Timestamp is invalid.');
  return date;
}

function safeUsername(value: string) {
  const normalized = value.trim().normalize('NFKC').toLowerCase();
  if (!/^[a-z0-9._-]{3,64}$/u.test(normalized) || normalized.includes('@')) {
    fail('invalidInput', 'Student username must be local, opaque, and email-free.');
  }
  return normalized;
}

function assertSeatAllowance(
  actor: AdminDirectoryActor,
  householdId: string,
  classification: Household['classification'],
  seatLimit: number,
  allowance: SchoolSeatAllowance | null,
) {
  if (classification === 'family') {
    if (seatLimit !== FAMILY_STUDENT_SEAT_LIMIT || allowance !== null) {
      fail('seatLimit', 'A Family household has exactly three Student seats.');
    }
    return;
  }
  if (
    !allowance ||
    allowance.householdId !== householdId ||
    allowance.seatLimit !== seatLimit ||
    !Number.isSafeInteger(seatLimit) ||
    seatLimit < 1
  ) {
    fail('seatLimit', 'A School seat change requires its exact allowance.');
  }
  assertScope(actor, allowance);
  safeDirectoryIdentifier(allowance.contractReference, 'contract');
  safeDirectoryLabel(allowance.reason, 'school_seat_reason');
  validDate(allowance.authorizedAt);
}

function assertUsernameAvailable(
  normalizedUsername: string,
  studentId: string,
  lockedMatch: AdminStudentRecord | null,
) {
  if (
    lockedMatch &&
    (lockedMatch.studentId !== studentId || lockedMatch.username !== normalizedUsername)
  ) {
    fail('invalidInput', 'Student username is already assigned.');
  }
}

function assertCurrentCredentialHash(value: string) {
  if (
    !value.startsWith('argon2id-v1$v=19$') ||
    authPasswordHashNeedsUpgrade(value) ||
    /(?:password|secret|bearer)/iu.test(value)
  ) {
    fail('invalidInput', 'Credential must match the current F03 Argon2id policy.');
  }
}

function assertServiceAccountAcceptance(
  actor: AdminDirectoryActor,
  evidence: ServiceAccountAcceptanceEvidence,
  householdId: string,
  studentId: string,
  currentServiceAccountVersion: string,
  authorizedAdultId: string,
) {
  assertScope(actor, evidence);
  if (
    evidence.householdId !== householdId ||
    evidence.studentId !== studentId ||
    evidence.acceptedByAdultId !== authorizedAdultId ||
    evidence.acceptedServiceAccountVersion !== currentServiceAccountVersion
  ) {
    fail(
      'invalidState',
      'Current exact service-account acceptance by the authorized household owner is required.',
    );
  }
  for (const value of [
    evidence.acceptanceId,
    evidence.acceptedByAdultId,
    evidence.immutableEvidenceReference,
    currentServiceAccountVersion,
  ]) {
    safeDirectoryIdentifier(value, 'acceptance');
  }
  if (!/^[a-f0-9]{64}$/u.test(evidence.canonicalRequestHash)) {
    fail('invalidInput', 'Acceptance request hash is invalid.');
  }
  validDate(evidence.acceptedAt);
}

function activeEnrollment(
  actor: AdminDirectoryActor,
  studentId: string,
  householdId: string,
  evidence: ServiceAccountAcceptanceEvidence,
  occurredAt: string,
): CanonicalStudentEnrollment {
  return {
    product: ONE_TIME_PRODUCT_SCOPE,
    runtimeTier: actor.runtimeTier,
    verificationEnvironmentId: actor.verificationEnvironmentId,
    enrollmentId: adminDirectorySha256(`${householdId}:${studentId}:${evidence.acceptanceId}`),
    householdId,
    studentId,
    serviceAccountAcceptanceId: evidence.acceptanceId,
    state: 'active',
    version: 1,
    updatedAt: occurredAt,
  };
}

function assertEnrollment(
  actor: AdminDirectoryActor,
  enrollment: CanonicalStudentEnrollment,
  student: AdminStudentRecord,
) {
  assertScope(actor, enrollment);
  if (
    enrollment.studentId !== student.studentId ||
    enrollment.householdId !== student.householdId ||
    enrollment.state !== 'active' ||
    !Number.isSafeInteger(enrollment.version) ||
    enrollment.version < 1
  ) {
    fail('invalidState', 'Canonical active enrollment is required.');
  }
  safeDirectoryIdentifier(enrollment.enrollmentId, 'enrollment');
  safeDirectoryIdentifier(enrollment.serviceAccountAcceptanceId, 'acceptance');
}

function assertRevokedEnrollment(
  actor: AdminDirectoryActor,
  enrollment: CanonicalStudentEnrollment,
  student: AdminStudentRecord,
  household: AdminHouseholdRecord,
) {
  assertScope(actor, enrollment);
  if (
    enrollment.studentId !== student.studentId ||
    enrollment.householdId !== student.householdId ||
    enrollment.householdId !== household.householdId ||
    enrollment.state !== 'revoked' ||
    !Number.isSafeInteger(enrollment.version) ||
    enrollment.version < 2
  ) {
    fail('invalidState', 'Student restore requires the exact revoked canonical enrollment.');
  }
  safeDirectoryIdentifier(enrollment.enrollmentId, 'enrollment');
  safeDirectoryIdentifier(enrollment.serviceAccountAcceptanceId, 'acceptance');
}

function assertUniqueInventoryIds(inventory: LockedOwnershipTransferEffectInventory) {
  const groups = [
    inventory.outgoingSessions.map((session) => session.sessionId),
    inventory.replacementSessions.map((session) => session.sessionId),
    inventory.billingSessionIds,
    inventory.grantIds,
    inventory.setupOrResetTokenIds,
    inventory.effectAuthorityIds,
  ];
  for (const values of groups) {
    if (uniqueIds(values).length !== values.length) {
      fail('invalidState', 'Locked ownership effect inventory contains duplicate identifiers.');
    }
    for (const value of values) safeDirectoryIdentifier(value, 'ownership_effect');
  }
}

function credentialWrite(
  actor: AdminDirectoryActor,
  student: AdminStudentRecord,
  replacementCredentialHash: string,
  kind: StudentCredentialReset['kind'],
  occurredAt: string,
  revocationReadbackId: string | null,
): StudentCredentialReset {
  const credentialVersion = student.credentialVersion + (kind === 'reset' ? 1 : 0);
  return {
    product: ONE_TIME_PRODUCT_SCOPE,
    runtimeTier: actor.runtimeTier,
    verificationEnvironmentId: actor.verificationEnvironmentId,
    resetId: adminDirectorySha256(
      `${student.studentId}:${credentialVersion}:${occurredAt}:${kind}`,
    ),
    kind,
    studentId: student.studentId,
    credentialId: student.credentialId,
    replacementCredentialHash,
    credentialVersion,
    revocationReadbackId,
    discloseExistingPassword: false,
    createdAt: occurredAt,
  };
}

function adultRevocation(
  humanAccountId: string,
  reason: RevokeAllActiveAccessCommand['reason'],
): RevokeAllActiveAccessCommand {
  return {
    subjectType: 'adult',
    subjectId: safeDirectoryIdentifier(humanAccountId, 'human_account'),
    reason,
  };
}

function studentRevocation(
  studentId: string,
  reason: RevokeAllActiveAccessCommand['reason'],
): RevokeAllActiveAccessCommand {
  return {
    subjectType: 'student',
    subjectId: safeDirectoryIdentifier(studentId, 'student'),
    reason,
  };
}

function uniqueIds(values: readonly string[]) {
  return [...new Set(values.map((value) => safeDirectoryIdentifier(value, 'record')))].sort();
}

function fail(key: keyof typeof ADMIN_DIRECTORY_ERROR_CODES, message: string): never {
  throw new AdminDirectoryError(ADMIN_DIRECTORY_ERROR_CODES[key], message);
}
