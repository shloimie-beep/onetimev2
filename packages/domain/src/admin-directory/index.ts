import {
  ADMIN_DIRECTORY_ERROR_CODES,
  type AdminDirectoryActor,
  type AdminDirectoryScope,
  type AdminStudentRecord,
  type AdultUpsertInput,
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
import { authorizeStudentCredentialChange, sessionRevocationRequired } from '../auth/index.ts';
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
  return result;
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
    revokeSessions: emailChanged,
  };
}

export function transitionAdultContact(input: {
  actor: AdminDirectoryActor;
  adult: AdultIdentity;
  account: HumanAccount;
  expectedAdultVersion: number;
  expectedAccountVersion: number;
  to: 'archived' | 'active';
  occurredAt: string;
}) {
  assertRuntimeAdmin(input.actor, input.adult);
  assertScope(input.actor, input.account);
  assertVersion(input.adult.version, input.expectedAdultVersion);
  assertVersion(input.account.version, input.expectedAccountVersion);
  if (input.account.adultId !== input.adult.adultId) fail('crossScope', 'Adult account mismatch.');
  if (input.adult.state === input.to) fail('invalidState', 'Adult already has requested state.');
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
    revokeSessions: sessionRevocationRequired({
      kind: input.to === 'archived' ? 'account_archived' : 'account_reactivated',
    }),
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
  occurredAt: string;
}): Household {
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
  if (!Number.isSafeInteger(input.seatLimit) || input.seatLimit < 1) {
    fail('invalidInput', 'Household requires a positive Student seat limit.');
  }
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
    version: 1,
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
}

export function editHousehold(input: {
  actor: AdminDirectoryActor;
  household: Household;
  expectedVersion: number;
  displayName: string;
  classification: Household['classification'];
  seatLimit: number;
  occurredAt: string;
}) {
  assertRuntimeAdmin(input.actor, input.household);
  assertVersion(input.household.version, input.expectedVersion);
  if (!Number.isSafeInteger(input.seatLimit) || input.seatLimit < input.household.activeSeatCount) {
    fail('seatLimit', 'Seat limit cannot be lower than active Student seats.');
  }
  return {
    ...input.household,
    displayName: safeDirectoryLabel(input.displayName, 'household_name'),
    classification: input.classification,
    seatLimit: input.seatLimit,
    version: input.household.version + 1,
    updatedAt: validDate(input.occurredAt).toISOString(),
  };
}

export function transitionHousehold(input: {
  actor: AdminDirectoryActor;
  household: Household;
  expectedVersion: number;
  to: 'archived' | 'active';
  occurredAt: string;
}) {
  assertRuntimeAdmin(input.actor, input.household);
  assertVersion(input.household.version, input.expectedVersion);
  if (input.household.state === input.to)
    fail('invalidState', 'Household already has requested state.');
  return {
    ...input.household,
    state: input.to,
    version: input.household.version + 1,
    updatedAt: validDate(input.occurredAt).toISOString(),
  };
}

export function createStudent(input: {
  actor: AdminDirectoryActor;
  household: Household;
  studentId: string;
  displayName: string;
  username: string;
  relationship: StudentProfile['relationship'];
  selfAdultId: string | null;
  credentialId: string;
  immutableHistoryReference: string;
  occurredAt: string;
}): { student: AdminStudentRecord; household: Household } {
  assertRuntimeAdmin(input.actor, input.household);
  if (
    input.household.state !== 'active' ||
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
  const occurredAt = validDate(input.occurredAt).toISOString();
  return {
    student: {
      product: ONE_TIME_PRODUCT_SCOPE,
      runtimeTier: input.actor.runtimeTier,
      verificationEnvironmentId: input.actor.verificationEnvironmentId,
      studentId: safeDirectoryIdentifier(input.studentId, 'student'),
      householdId: input.household.householdId,
      relationship: input.relationship,
      selfAdultId: input.selfAdultId,
      state: 'active',
      credentialId: safeDirectoryIdentifier(input.credentialId, 'credential'),
      immutableHistoryReference: safeDirectoryIdentifier(
        input.immutableHistoryReference,
        'history',
      ),
      displayName: safeDirectoryLabel(input.displayName, 'student_name'),
      username: safeUsername(input.username),
      credentialVersion: 1,
      credentialState: 'reset_required',
      version: 1,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    },
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
  occurredAt: string;
}) {
  assertRuntimeAdmin(input.actor, input.student);
  assertVersion(input.student.version, input.expectedVersion);
  return {
    ...input.student,
    displayName: safeDirectoryLabel(input.displayName, 'student_name'),
    username: safeUsername(input.username),
    version: input.student.version + 1,
    updatedAt: validDate(input.occurredAt).toISOString(),
  };
}

export function transitionStudent(input: {
  actor: AdminDirectoryActor;
  student: AdminStudentRecord;
  household: Household;
  expectedStudentVersion: number;
  expectedHouseholdVersion: number;
  to: 'archived' | 'active';
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
  const delta = input.to === 'active' ? 1 : -1;
  if (
    input.household.activeSeatCount + delta < 0 ||
    input.household.activeSeatCount + delta > input.household.seatLimit
  ) {
    fail('seatLimit', 'Student transition conflicts with household seat capacity.');
  }
  const occurredAt = validDate(input.occurredAt).toISOString();
  return {
    student: {
      ...input.student,
      state: input.to,
      credentialState:
        input.to === 'archived' ? ('disabled' as const) : ('reset_required' as const),
      version: input.student.version + 1,
      updatedAt: occurredAt,
    },
    household: {
      ...input.household,
      activeSeatCount: input.household.activeSeatCount + delta,
      version: input.household.version + 1,
      updatedAt: occurredAt,
    },
    revokeSessions: input.to === 'archived',
  };
}

export function planStudentCredentialReset(input: {
  actor: AdminDirectoryActor;
  student: AdminStudentRecord;
  replacementCredentialHash: string;
  studentSessionIds: readonly string[];
  occurredAt: string;
}): { student: AdminStudentRecord; reset: StudentCredentialReset } {
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
  if (
    !input.replacementCredentialHash.startsWith('$argon2id$') ||
    /(?:password|secret|bearer)/iu.test(input.replacementCredentialHash)
  ) {
    fail('invalidInput', 'Credential reset accepts only a protected Argon2id hash.');
  }
  const occurredAt = validDate(input.occurredAt).toISOString();
  const sessionIds = uniqueIds(input.studentSessionIds);
  const student = {
    ...input.student,
    credentialVersion: input.student.credentialVersion + 1,
    credentialState: 'active' as const,
    version: input.student.version + 1,
    updatedAt: occurredAt,
  };
  return {
    student,
    reset: {
      product: ONE_TIME_PRODUCT_SCOPE,
      runtimeTier: input.actor.runtimeTier,
      verificationEnvironmentId: input.actor.verificationEnvironmentId,
      resetId: adminDirectorySha256(
        `${student.studentId}:${student.credentialVersion}:${occurredAt}`,
      ),
      studentId: student.studentId,
      credentialId: student.credentialId,
      replacementCredentialHash: input.replacementCredentialHash,
      credentialVersion: student.credentialVersion,
      studentSessionIdsRevoked: sessionIds,
      discloseExistingPassword: false,
      createdAt: occurredAt,
    },
  };
}

export function completeVerifiedOwnershipTransfer(
  input: Parameters<typeof acceptHouseholdOwnershipTransfer>[0] & {
    actor: AdminDirectoryActor;
  },
): OwnershipTransferAcceptanceResult {
  assertRuntimeAdmin(input.actor, input.transfer);
  assertScope(input.actor, input.adminAccount, input.household);
  if (input.adminAccount.humanAccountId !== input.actor.principal.human_account_id) {
    fail('accessDenied', 'Transfer Admin must match the current authenticated principal.');
  }
  return acceptHouseholdOwnershipTransfer(input);
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

function uniqueIds(values: readonly string[]) {
  return [...new Set(values.map((value) => safeDirectoryIdentifier(value, 'record')))].sort();
}

function fail(key: keyof typeof ADMIN_DIRECTORY_ERROR_CODES, message: string): never {
  throw new AdminDirectoryError(ADMIN_DIRECTORY_ERROR_CODES[key], message);
}
