import {
  ADULT_ROLE_VALUES,
  ADULT_SESSION_POLICY,
  ONE_TIME_PRODUCT_SCOPE,
  type AdultIdentity,
  type AdultRole,
  type AdultSession,
  type AppliedOwnershipTransfer,
  type ArchivedSelfStudentResult,
  type DependentTransferAttestation,
  type Household,
  type HouseholdIdentityErrorCode,
  type HouseholdOwnershipTransfer,
  type HumanAccount,
  type OwnershipTransferAcceptance,
  type OwnershipTransferAcceptanceResult,
  type SelfStudentMoveResult,
  type StudentProfile,
} from '../../../contracts/src/accounts/v21-household-identity.ts';
import {
  VERIFICATION_RUNTIME_TIER,
  type RuntimeTier,
  type VerificationEnvironmentId,
} from '../../../contracts/src/state/index.ts';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9_:-]{3,180}$/u;

export class HouseholdIdentityError extends Error {
  readonly code: HouseholdIdentityErrorCode;

  constructor(code: HouseholdIdentityErrorCode, message: string) {
    super(message);
    this.name = 'HouseholdIdentityError';
    this.code = code;
  }
}

export function normalizeAdultEmail(email: string) {
  const normalized = email.trim().normalize('NFKC').toLowerCase();
  const at = normalized.indexOf('@');
  if (
    normalized.length > 254 ||
    at < 1 ||
    at !== normalized.lastIndexOf('@') ||
    at === normalized.length - 1 ||
    normalized.includes(' ')
  ) {
    throw new HouseholdIdentityError(
      'invalid_normalized_email',
      'An adult identity requires one valid normalized email.',
    );
  }
  return normalized;
}

export function createOrLinkAdultIdentity(input: {
  email: string;
  displayName: string;
  requestedRole: AdultRole;
  proposedAdultId: string;
  proposedHumanAccountId: string;
  runtimeTier: RuntimeTier;
  verificationEnvironmentId: VerificationEnvironmentId;
  existingAdult: AdultIdentity | null;
  existingAccount: HumanAccount | null;
  now: Date;
}): {
  adult: AdultIdentity;
  account: HumanAccount;
  adultCreated: boolean;
  accountCreated: boolean;
  membershipAdded: boolean;
} {
  assertRole(input.requestedRole);
  const normalizedEmail = normalizeAdultEmail(input.email);
  const now = iso(input.now);
  assertScope(input.runtimeTier, input.verificationEnvironmentId);

  if ((input.existingAdult === null) !== (input.existingAccount === null)) {
    throw new HouseholdIdentityError(
      'invalid_identity',
      'An adult identity and its sole HumanAccount must be resolved together.',
    );
  }

  if (input.existingAdult && input.existingAccount) {
    assertVersion(input.existingAdult.version);
    assertVersion(input.existingAccount.version);
    assertScope(input.existingAdult.runtimeTier, input.existingAdult.verificationEnvironmentId);
    assertScope(input.existingAccount.runtimeTier, input.existingAccount.verificationEnvironmentId);
    if (
      input.existingAdult.normalizedEmail !== normalizedEmail ||
      input.existingAccount.adultId !== input.existingAdult.adultId ||
      input.existingAdult.product !== ONE_TIME_PRODUCT_SCOPE ||
      input.existingAccount.product !== ONE_TIME_PRODUCT_SCOPE ||
      input.existingAdult.runtimeTier !== input.existingAccount.runtimeTier ||
      input.existingAdult.verificationEnvironmentId !==
        input.existingAccount.verificationEnvironmentId ||
      input.existingAdult.runtimeTier !== input.runtimeTier ||
      input.existingAdult.verificationEnvironmentId !== input.verificationEnvironmentId
    ) {
      throw new HouseholdIdentityError(
        'invalid_identity',
        'Resolved adult and HumanAccount identity do not match the normalized email.',
      );
    }
    if (input.existingAdult.state !== 'active' || input.existingAccount.state !== 'active') {
      throw new HouseholdIdentityError(
        'account_inactive',
        'An archived or disabled adult cannot be silently linked by repeated signup.',
      );
    }
    const memberships = canonicalMemberships(input.existingAccount.memberships);
    const membershipAdded = !memberships.includes(input.requestedRole);
    return {
      adult: input.existingAdult,
      account: membershipAdded
        ? {
            ...input.existingAccount,
            memberships: canonicalMemberships([...memberships, input.requestedRole]),
            securityVersion: input.existingAccount.securityVersion + 1,
            version: input.existingAccount.version + 1,
            updatedAt: now,
          }
        : input.existingAccount,
      adultCreated: false,
      accountCreated: false,
      membershipAdded,
    };
  }

  assertIdentifier(input.proposedAdultId, 'adult');
  assertIdentifier(input.proposedHumanAccountId, 'HumanAccount');
  const displayName = input.displayName.trim();
  if (!displayName) {
    throw new HouseholdIdentityError('invalid_identity', 'Adult display name is required.');
  }
  return {
    adult: {
      adultId: input.proposedAdultId,
      product: ONE_TIME_PRODUCT_SCOPE,
      runtimeTier: input.runtimeTier,
      verificationEnvironmentId: input.verificationEnvironmentId,
      normalizedEmail,
      displayName,
      state: 'active',
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
    account: {
      humanAccountId: input.proposedHumanAccountId,
      product: ONE_TIME_PRODUCT_SCOPE,
      runtimeTier: input.runtimeTier,
      verificationEnvironmentId: input.verificationEnvironmentId,
      adultId: input.proposedAdultId,
      memberships: [input.requestedRole],
      state: 'active',
      securityVersion: 1,
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
    adultCreated: true,
    accountCreated: true,
    membershipAdded: true,
  };
}

export function selectAdultRoleContext(input: {
  account: HumanAccount;
  currentSession: AdultSession;
  requestedRole: AdultRole;
  rotatedSessionId: string;
  now: Date;
}): AdultSession {
  assertActiveAccount(input.account);
  assertRole(input.requestedRole);
  assertSessionSubject(input.currentSession, input.account);
  if (!input.account.memberships.includes(input.requestedRole)) {
    throw new HouseholdIdentityError(
      'invalid_role_context',
      'The requested role context is not present in the server-resolved membership set.',
    );
  }
  assertIdentifier(input.rotatedSessionId, 'session');
  const now = input.now;
  const policy = ADULT_SESSION_POLICY[input.requestedRole];
  return {
    sessionId: input.rotatedSessionId,
    product: ONE_TIME_PRODUCT_SCOPE,
    runtimeTier: input.account.runtimeTier,
    verificationEnvironmentId: input.account.verificationEnvironmentId,
    humanAccountId: input.account.humanAccountId,
    activeRole: input.requestedRole,
    activeHouseholdId:
      input.requestedRole === 'parent' && input.currentSession.activeRole === 'parent'
        ? input.currentSession.activeHouseholdId
        : null,
    securityVersion: input.account.securityVersion,
    idleExpiresAt: new Date(now.getTime() + policy.idleMilliseconds).toISOString(),
    absoluteExpiresAt: new Date(now.getTime() + policy.absoluteMilliseconds).toISOString(),
    revokedAt: null,
    revocationReason: null,
    version: input.currentSession.version + 1,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function selectHouseholdContext(input: {
  account: HumanAccount;
  currentSession: AdultSession;
  serverResolvedOwnedHouseholdIds: readonly string[];
  selectedHouseholdId: string;
  rotatedSessionId: string;
  now: Date;
}): AdultSession {
  assertActiveAccount(input.account);
  assertSessionSubject(input.currentSession, input.account);
  if (
    input.currentSession.activeRole !== 'parent' ||
    !input.account.memberships.includes('parent')
  ) {
    throw new HouseholdIdentityError(
      'invalid_role_context',
      'Household context can be selected only in an explicit Parent context.',
    );
  }
  if (!new Set(input.serverResolvedOwnedHouseholdIds).has(input.selectedHouseholdId)) {
    throw new HouseholdIdentityError(
      'cross_household_denied',
      'The selected household is not in the server-resolved ownership set.',
    );
  }
  assertIdentifier(input.rotatedSessionId, 'session');
  const policy = ADULT_SESSION_POLICY.parent;
  return {
    sessionId: input.rotatedSessionId,
    product: ONE_TIME_PRODUCT_SCOPE,
    runtimeTier: input.account.runtimeTier,
    verificationEnvironmentId: input.account.verificationEnvironmentId,
    humanAccountId: input.account.humanAccountId,
    activeRole: 'parent',
    activeHouseholdId: input.selectedHouseholdId,
    securityVersion: input.account.securityVersion,
    idleExpiresAt: new Date(input.now.getTime() + policy.idleMilliseconds).toISOString(),
    absoluteExpiresAt: new Date(input.now.getTime() + policy.absoluteMilliseconds).toISOString(),
    revokedAt: null,
    revocationReason: null,
    version: input.currentSession.version + 1,
    createdAt: input.now.toISOString(),
    updatedAt: input.now.toISOString(),
  };
}

export function acceptHouseholdOwnershipTransfer(input: {
  adminAccount: HumanAccount;
  transfer: HouseholdOwnershipTransfer;
  household: Household;
  activeStudents: readonly StudentProfile[];
  replacementAdult: AdultIdentity | null;
  replacementAccount: HumanAccount | null;
  proposedReplacementAdultId: string;
  proposedReplacementHumanAccountId: string;
  replacementDisplayName: string;
  acceptance: OwnershipTransferAcceptance;
  outgoingSessions: readonly AdultSession[];
  replacementSessions: readonly AdultSession[];
  billingSessionIds: readonly string[];
  setupOrResetTokenIds: readonly string[];
  now: Date;
}): OwnershipTransferAcceptanceResult {
  assertAdmin(input.adminAccount);
  assertSameScope(
    input.adminAccount,
    input.transfer,
    input.household,
    ...input.activeStudents,
    ...input.outgoingSessions,
    ...input.replacementSessions,
  );
  assertHash(input.acceptance.canonicalRequestHash);
  assertIdentifier(input.acceptance.idempotencyKey, 'idempotency key');

  if (input.transfer.state === 'accepted') {
    if (input.transfer.acceptanceRequestHash === input.acceptance.canonicalRequestHash) {
      return {
        disposition: 'replayed',
        transfer: input.transfer,
        canonicalRequestHash: input.acceptance.canonicalRequestHash,
      };
    }
    throw new HouseholdIdentityError(
      'idempotency_conflict',
      'An accepted transfer cannot be replayed with a different canonical request.',
    );
  }
  if (input.transfer.state !== 'pending') {
    throw new HouseholdIdentityError(
      'transfer_not_pending',
      'Only one pending ownership transfer may be accepted.',
    );
  }

  assertExpectedVersion(input.transfer.version, input.acceptance.expectedTransferVersion);
  assertExpectedVersion(input.household.version, input.acceptance.expectedHouseholdVersion);
  if (
    input.transfer.householdId !== input.household.householdId ||
    input.household.ownerAdultId !== input.transfer.outgoingAdultId ||
    input.household.ownerHumanAccountId !== input.transfer.outgoingHumanAccountId
  ) {
    throw new HouseholdIdentityError(
      'invalid_identity',
      'Transfer and current household ownership do not identify one locked aggregate.',
    );
  }
  if (new Date(input.transfer.expiresAt).getTime() <= input.now.getTime()) {
    throw new HouseholdIdentityError(
      'transfer_expired',
      'The seven-day ownership acceptance window has expired.',
    );
  }
  const acceptedAt = new Date(input.acceptance.acceptedAt);
  if (
    Number.isNaN(acceptedAt.getTime()) ||
    acceptedAt.getTime() !== input.now.getTime() ||
    acceptedAt.getTime() > new Date(input.transfer.expiresAt).getTime()
  ) {
    throw new HouseholdIdentityError(
      'transfer_expired',
      'Acceptance time must be the current locked time inside the transfer window.',
    );
  }

  const replacementNormalizedEmail = normalizeAdultEmail(
    input.acceptance.replacementNormalizedEmail,
  );
  if (
    replacementNormalizedEmail !== input.transfer.replacementNormalizedEmail ||
    replacementNormalizedEmail === normalizeReplacementOutgoingEmail(input)
  ) {
    throw new HouseholdIdentityError(
      'transfer_replacement_mismatch',
      'Acceptance must bind the exact replacement adult and cannot retain the outgoing owner.',
    );
  }
  if (
    input.acceptance.acceptedPolicySetVersion !== input.transfer.requiredPolicies.policySetVersion
  ) {
    throw new HouseholdIdentityError(
      'replacement_policy_mismatch',
      'The replacement must accept the transfer policy set currently required by the transfer.',
    );
  }

  const activeSelfStudent = input.activeStudents.find(
    (student) =>
      student.householdId === input.household.householdId &&
      student.state === 'active' &&
      student.relationship === 'self' &&
      student.selfAdultId === input.transfer.outgoingAdultId,
  );
  if (activeSelfStudent) {
    throw new HouseholdIdentityError(
      'active_self_student_blocks_transfer',
      'The outgoing owner self Student must be archived or moved before transfer.',
    );
  }

  const linked = createOrLinkAdultIdentity({
    email: replacementNormalizedEmail,
    displayName: input.replacementDisplayName,
    requestedRole: 'parent',
    proposedAdultId: input.proposedReplacementAdultId,
    proposedHumanAccountId: input.proposedReplacementHumanAccountId,
    runtimeTier: input.transfer.runtimeTier,
    verificationEnvironmentId: input.transfer.verificationEnvironmentId,
    existingAdult: input.replacementAdult,
    existingAccount: input.replacementAccount,
    now: input.now,
  });
  if (linked.adult.adultId === input.transfer.outgoingAdultId) {
    throw new HouseholdIdentityError(
      'transfer_replacement_mismatch',
      'The replacement adult must differ from the outgoing household owner.',
    );
  }
  if (
    input.transfer.replacementAdultId !== null &&
    input.transfer.replacementAdultId !== linked.adult.adultId
  ) {
    throw new HouseholdIdentityError(
      'transfer_replacement_mismatch',
      'The verified transfer replacement no longer resolves to the same adult identity.',
    );
  }
  if (
    input.acceptance.expectedReplacementAccountVersion !==
    (input.replacementAccount?.version ?? null)
  ) {
    throw new HouseholdIdentityError(
      'stale_version',
      'The replacement HumanAccount changed after transfer acceptance was read.',
    );
  }

  assertDependentAttestations({
    students: input.activeStudents,
    householdId: input.household.householdId,
    replacementAdultId: linked.adult.adultId,
    attestations: input.acceptance.dependentAttestations,
    transfer: input.transfer,
  });

  const updatedAt = input.now.toISOString();
  const household: Household = {
    ...input.household,
    ownerAdultId: linked.adult.adultId,
    ownerHumanAccountId: linked.account.humanAccountId,
    version: input.household.version + 1,
    updatedAt,
  };
  const transfer: HouseholdOwnershipTransfer = {
    ...input.transfer,
    replacementAdultId: linked.adult.adultId,
    state: 'accepted',
    acceptedAt: updatedAt,
    acceptedByAdultId: linked.adult.adultId,
    acceptanceRequestHash: input.acceptance.canonicalRequestHash,
    version: input.transfer.version + 1,
    updatedAt,
  };

  return {
    disposition: 'applied',
    transfer,
    household,
    replacementAdult: linked.adult,
    replacementAccount: linked.account,
    parentMembershipAdded: linked.membershipAdded,
    outgoingSessionIdsRevoked: uniqueIds(
      input.outgoingSessions
        .filter(
          (session) =>
            session.humanAccountId === input.transfer.outgoingHumanAccountId &&
            session.activeRole === 'parent' &&
            session.revokedAt === null,
        )
        .map((session) => session.sessionId),
    ),
    replacementSessionIdsRevoked: linked.membershipAdded
      ? uniqueIds(
          input.replacementSessions
            .filter(
              (session) =>
                session.humanAccountId === linked.account.humanAccountId &&
                session.revokedAt === null,
            )
            .map((session) => session.sessionId),
        )
      : [],
    billingSessionIdsRevoked: uniqueIds(input.billingSessionIds),
    setupOrResetTokenIdsInvalidated: uniqueIds(input.setupOrResetTokenIds),
    providerIntent: {
      intentType: 'household_owner_reassociation',
      householdId: input.household.householdId,
      previousAdultId: input.transfer.outgoingAdultId,
      replacementAdultId: linked.adult.adultId,
      changesFinancialIdentity: false,
      canonicalRequestHash: input.acceptance.canonicalRequestHash,
    },
    auditEvent: {
      eventType: 'household_ownership_transferred',
      transferId: input.transfer.transferId,
      householdId: input.household.householdId,
      initiatingAdminAccountId: input.transfer.initiatedByAdminAccountId,
      outgoingAdultId: input.transfer.outgoingAdultId,
      replacementAdultId: linked.adult.adultId,
      occurredAt: updatedAt,
      canonicalRequestHash: input.acceptance.canonicalRequestHash,
    },
  } satisfies AppliedOwnershipTransfer;
}

export function moveSelfStudentBetweenOwnedHouseholds(input: {
  adult: AdultIdentity;
  account: HumanAccount;
  student: StudentProfile;
  sourceHousehold: Household;
  targetHousehold: Household;
  expectedStudentVersion: number;
  expectedSourceHouseholdVersion: number;
  expectedTargetHouseholdVersion: number;
  studentSessionIds: readonly string[];
  classroomOrPlaybackGrantIds: readonly string[];
  now: Date;
}): SelfStudentMoveResult {
  assertActiveAccount(input.account);
  assertSameScope(
    input.adult,
    input.account,
    input.student,
    input.sourceHousehold,
    input.targetHousehold,
  );
  if (
    input.account.adultId !== input.adult.adultId ||
    !input.account.memberships.includes('parent') ||
    input.sourceHousehold.ownerAdultId !== input.adult.adultId ||
    input.targetHousehold.ownerAdultId !== input.adult.adultId ||
    input.sourceHousehold.ownerHumanAccountId !== input.account.humanAccountId ||
    input.targetHousehold.ownerHumanAccountId !== input.account.humanAccountId
  ) {
    throw new HouseholdIdentityError(
      'self_student_owner_mismatch',
      'A self Student may move only between households owned by the same adult.',
    );
  }
  if (
    input.student.relationship !== 'self' ||
    input.student.selfAdultId !== input.adult.adultId ||
    input.student.householdId !== input.sourceHousehold.householdId ||
    input.student.state !== 'active'
  ) {
    throw new HouseholdIdentityError(
      'student_relationship_immutable',
      'The move preserves one active self Student and never converts its relationship.',
    );
  }
  if (
    input.sourceHousehold.householdId === input.targetHousehold.householdId ||
    input.sourceHousehold.state !== 'active' ||
    input.targetHousehold.state !== 'active'
  ) {
    throw new HouseholdIdentityError(
      'invalid_household_context',
      'A self Student move requires two distinct active owned households.',
    );
  }
  assertExpectedVersion(input.student.version, input.expectedStudentVersion);
  assertExpectedVersion(input.sourceHousehold.version, input.expectedSourceHouseholdVersion);
  assertExpectedVersion(input.targetHousehold.version, input.expectedTargetHouseholdVersion);
  if (input.targetHousehold.activeSeatCount >= input.targetHousehold.seatLimit) {
    throw new HouseholdIdentityError(
      'seat_limit_reached',
      'The target household has no available Student seat.',
    );
  }
  if (input.sourceHousehold.activeSeatCount < 1) {
    throw new HouseholdIdentityError(
      'stale_version',
      'The source household seat count cannot release the active self Student.',
    );
  }
  const updatedAt = input.now.toISOString();
  return {
    student: {
      ...input.student,
      householdId: input.targetHousehold.householdId,
      version: input.student.version + 1,
      updatedAt,
    },
    sourceHousehold: {
      ...input.sourceHousehold,
      activeSeatCount: input.sourceHousehold.activeSeatCount - 1,
      version: input.sourceHousehold.version + 1,
      updatedAt,
    },
    targetHousehold: {
      ...input.targetHousehold,
      activeSeatCount: input.targetHousehold.activeSeatCount + 1,
      version: input.targetHousehold.version + 1,
      updatedAt,
    },
    studentSessionIdsRevoked: uniqueIds(input.studentSessionIds),
    classroomOrPlaybackGrantIdsRevoked: uniqueIds(input.classroomOrPlaybackGrantIds),
    preservedStudentId: true,
    preservedCredentialId: true,
    preservedHistoryReference: true,
  };
}

export function archiveSelfStudentForOwnershipTransfer(input: {
  adult: AdultIdentity;
  household: Household;
  student: StudentProfile;
  expectedStudentVersion: number;
  expectedHouseholdVersion: number;
  studentSessionIds: readonly string[];
  classroomOrPlaybackGrantIds: readonly string[];
  now: Date;
}): ArchivedSelfStudentResult {
  assertSameScope(input.adult, input.household, input.student);
  if (
    input.household.ownerAdultId !== input.adult.adultId ||
    input.student.householdId !== input.household.householdId ||
    input.student.relationship !== 'self' ||
    input.student.selfAdultId !== input.adult.adultId ||
    input.student.state !== 'active'
  ) {
    throw new HouseholdIdentityError(
      'self_student_owner_mismatch',
      'Only the owning adult self Student may be archived for transfer.',
    );
  }
  assertExpectedVersion(input.student.version, input.expectedStudentVersion);
  assertExpectedVersion(input.household.version, input.expectedHouseholdVersion);
  if (input.household.activeSeatCount < 1) {
    throw new HouseholdIdentityError(
      'stale_version',
      'The household seat count cannot release the active self Student.',
    );
  }
  const updatedAt = input.now.toISOString();
  return {
    student: {
      ...input.student,
      state: 'archived',
      version: input.student.version + 1,
      updatedAt,
    },
    household: {
      ...input.household,
      activeSeatCount: input.household.activeSeatCount - 1,
      version: input.household.version + 1,
      updatedAt,
    },
    studentSessionIdsRevoked: uniqueIds(input.studentSessionIds),
    classroomOrPlaybackGrantIdsRevoked: uniqueIds(input.classroomOrPlaybackGrantIds),
    preservedStudentId: true,
    preservedCredentialId: true,
    preservedHistoryReference: true,
  };
}

function assertDependentAttestations(input: {
  students: readonly StudentProfile[];
  householdId: string;
  replacementAdultId: string;
  attestations: readonly DependentTransferAttestation[];
  transfer: HouseholdOwnershipTransfer;
}) {
  const activeDependents = input.students.filter(
    (student) =>
      student.householdId === input.householdId &&
      student.state === 'active' &&
      student.relationship === 'dependent',
  );
  const byStudent = new Map<string, DependentTransferAttestation>();
  for (const attestation of input.attestations) {
    if (byStudent.has(attestation.studentId)) {
      throw new HouseholdIdentityError(
        'dependent_attestation_stale',
        'A dependent Student may have only one current transfer attestation.',
      );
    }
    byStudent.set(attestation.studentId, attestation);
  }
  if (
    byStudent.size !== activeDependents.length ||
    activeDependents.some((student) => !byStudent.has(student.studentId))
  ) {
    throw new HouseholdIdentityError(
      'dependent_attestation_missing',
      'Every remaining dependent Student requires one exact replacement-owner attestation.',
    );
  }
  for (const student of activeDependents) {
    const attestation = byStudent.get(student.studentId)!;
    if (
      attestation.replacementAdultId !== input.replacementAdultId ||
      attestation.authorityConfirmed !== true ||
      attestation.serviceAccountVersion !== input.transfer.requiredPolicies.serviceAccountVersion ||
      attestation.recordingParticipationVersion !==
        input.transfer.requiredPolicies.recordingParticipationVersion ||
      Number.isNaN(new Date(attestation.recordedAt).getTime()) ||
      new Date(attestation.recordedAt).getTime() < new Date(input.transfer.createdAt).getTime()
    ) {
      throw new HouseholdIdentityError(
        'dependent_attestation_stale',
        'Dependent authority and required consents must be current and replacement-owned.',
      );
    }
  }
}

function normalizeReplacementOutgoingEmail(input: {
  replacementAdult: AdultIdentity | null;
  transfer: HouseholdOwnershipTransfer;
}) {
  if (input.replacementAdult && input.replacementAdult.adultId === input.transfer.outgoingAdultId) {
    return input.replacementAdult.normalizedEmail;
  }
  return '__outgoing_identity_not_resolved__';
}

function assertAdmin(account: HumanAccount) {
  assertActiveAccount(account);
  if (!account.memberships.includes('admin')) {
    throw new HouseholdIdentityError(
      'invalid_role_context',
      'Ownership transfer completion requires a server-validated Admin.',
    );
  }
}

function assertActiveAccount(account: HumanAccount) {
  assertScope(account.runtimeTier, account.verificationEnvironmentId);
  if (account.product !== ONE_TIME_PRODUCT_SCOPE || account.state !== 'active') {
    throw new HouseholdIdentityError(
      'account_inactive',
      'Only an active One Time HumanAccount can change account context.',
    );
  }
  canonicalMemberships(account.memberships);
}

function assertScope(
  runtimeTier: RuntimeTier,
  verificationEnvironmentId: VerificationEnvironmentId,
) {
  if (VERIFICATION_RUNTIME_TIER[verificationEnvironmentId] !== runtimeTier) {
    throw new HouseholdIdentityError(
      'invalid_identity',
      'Verification environment and runtime tier must use the canonical isolation mapping.',
    );
  }
}

function assertSameScope(
  first: {
    product: string;
    runtimeTier: RuntimeTier;
    verificationEnvironmentId: VerificationEnvironmentId;
  },
  ...rest: readonly {
    product: string;
    runtimeTier: RuntimeTier;
    verificationEnvironmentId: VerificationEnvironmentId;
  }[]
) {
  assertScope(first.runtimeTier, first.verificationEnvironmentId);
  if (
    first.product !== ONE_TIME_PRODUCT_SCOPE ||
    rest.some(
      (record) =>
        record.product !== ONE_TIME_PRODUCT_SCOPE ||
        record.runtimeTier !== first.runtimeTier ||
        record.verificationEnvironmentId !== first.verificationEnvironmentId,
    )
  ) {
    throw new HouseholdIdentityError(
      'invalid_identity',
      'Account and household aggregates cannot cross product, runtime, or verification scope.',
    );
  }
}

function assertSessionSubject(session: AdultSession, account: HumanAccount) {
  if (
    session.humanAccountId !== account.humanAccountId ||
    session.revokedAt !== null ||
    session.securityVersion !== account.securityVersion
  ) {
    throw new HouseholdIdentityError(
      'invalid_identity',
      'The current session is not valid for the server-resolved HumanAccount.',
    );
  }
}

function canonicalMemberships(memberships: readonly AdultRole[]) {
  const unique = [...new Set(memberships)];
  if (unique.length < 1 || unique.some((membership) => !ADULT_ROLE_VALUES.includes(membership))) {
    throw new HouseholdIdentityError(
      'invalid_role',
      'A HumanAccount contains only admin, parent, or both memberships.',
    );
  }
  return ADULT_ROLE_VALUES.filter((role) => unique.includes(role));
}

function assertRole(role: AdultRole) {
  if (!ADULT_ROLE_VALUES.includes(role)) {
    throw new HouseholdIdentityError('invalid_role', 'Unknown adult role.');
  }
}

function assertExpectedVersion(current: number, expected: number) {
  assertVersion(current);
  if (current !== expected) {
    throw new HouseholdIdentityError(
      'stale_version',
      'The expected aggregate version is stale; no partial change may be written.',
    );
  }
}

function assertVersion(version: number) {
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new HouseholdIdentityError(
      'stale_version',
      'Persisted aggregates require a positive monotonic version.',
    );
  }
}

function assertHash(value: string) {
  if (!SHA256_PATTERN.test(value)) {
    throw new HouseholdIdentityError(
      'idempotency_conflict',
      'The canonical ownership-transfer request hash must be lowercase SHA-256.',
    );
  }
}

function assertIdentifier(value: string, label: string) {
  if (!SAFE_IDENTIFIER_PATTERN.test(value)) {
    throw new HouseholdIdentityError(
      'invalid_identity',
      `${label} must be an opaque safe identifier.`,
    );
  }
}

function iso(value: Date) {
  if (Number.isNaN(value.getTime())) {
    throw new HouseholdIdentityError('invalid_identity', 'Timestamp is invalid.');
  }
  return value.toISOString();
}

function uniqueIds(values: readonly string[]) {
  for (const value of values) assertIdentifier(value, 'record');
  return [...new Set(values)].sort();
}
