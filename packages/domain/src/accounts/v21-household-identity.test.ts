import { describe, expect, it } from 'vitest';
import type {
  AdultIdentity,
  AdultSession,
  Household,
  HouseholdOwnershipTransfer,
  HumanAccount,
  StudentProfile,
} from '../../../contracts/src/accounts/v21-household-identity.ts';
import { authorizeAdultCapability } from '../access/v21-household-authorization.ts';
import {
  acceptHouseholdOwnershipTransfer,
  createOrLinkAdultIdentity,
  moveSelfStudentBetweenOwnedHouseholds,
  selectAdultRoleContext,
  selectHouseholdContext,
} from './v21-household-identity.ts';

const NOW = new Date('2026-07-28T18:30:00.000Z');
const EARLIER = '2026-07-28T17:00:00.000Z';
const HASH = 'a'.repeat(64);

function adult(overrides: Partial<AdultIdentity> = {}): AdultIdentity {
  return {
    adultId: 'adult_outgoing',
    product: 'one_time_mishnayos',
    runtimeTier: 'isolated_staging',
    verificationEnvironmentId: 'ci',
    normalizedEmail: 'owner@example.com',
    displayName: 'Owner',
    state: 'active',
    version: 1,
    createdAt: EARLIER,
    updatedAt: EARLIER,
    ...overrides,
  };
}

function account(overrides: Partial<HumanAccount> = {}): HumanAccount {
  return {
    humanAccountId: 'account_outgoing',
    product: 'one_time_mishnayos',
    runtimeTier: 'isolated_staging',
    verificationEnvironmentId: 'ci',
    adultId: 'adult_outgoing',
    memberships: ['parent'],
    state: 'active',
    securityVersion: 1,
    version: 1,
    createdAt: EARLIER,
    updatedAt: EARLIER,
    ...overrides,
  };
}

function household(overrides: Partial<Household> = {}): Household {
  return {
    householdId: 'household_source',
    product: 'one_time_mishnayos',
    runtimeTier: 'isolated_staging',
    verificationEnvironmentId: 'ci',
    ownerAdultId: 'adult_outgoing',
    ownerHumanAccountId: 'account_outgoing',
    classification: 'family',
    displayName: 'Source',
    seatLimit: 3,
    activeSeatCount: 1,
    state: 'active',
    version: 4,
    createdAt: EARLIER,
    updatedAt: EARLIER,
    ...overrides,
  };
}

function session(overrides: Partial<AdultSession> = {}): AdultSession {
  return {
    sessionId: 'session_current',
    product: 'one_time_mishnayos',
    runtimeTier: 'isolated_staging',
    verificationEnvironmentId: 'ci',
    humanAccountId: 'account_outgoing',
    activeRole: 'parent',
    activeHouseholdId: 'household_source',
    securityVersion: 1,
    idleExpiresAt: '2026-07-29T17:00:00.000Z',
    absoluteExpiresAt: '2026-08-27T17:00:00.000Z',
    revokedAt: null,
    revocationReason: null,
    version: 2,
    createdAt: EARLIER,
    updatedAt: EARLIER,
    ...overrides,
  };
}

function student(overrides: Partial<StudentProfile> = {}): StudentProfile {
  return {
    studentId: 'student_self',
    product: 'one_time_mishnayos',
    runtimeTier: 'isolated_staging',
    verificationEnvironmentId: 'ci',
    householdId: 'household_source',
    relationship: 'self',
    selfAdultId: 'adult_outgoing',
    state: 'active',
    credentialId: 'credential_self',
    immutableHistoryReference: 'history_self',
    version: 3,
    createdAt: EARLIER,
    updatedAt: EARLIER,
    ...overrides,
  };
}

function transfer(overrides: Partial<HouseholdOwnershipTransfer> = {}): HouseholdOwnershipTransfer {
  return {
    transferId: 'transfer_001',
    product: 'one_time_mishnayos',
    runtimeTier: 'isolated_staging',
    verificationEnvironmentId: 'ci',
    householdId: 'household_source',
    outgoingAdultId: 'adult_outgoing',
    outgoingHumanAccountId: 'account_outgoing',
    replacementNormalizedEmail: 'admin@example.com',
    replacementAdultId: 'adult_admin',
    initiatedByAdminAccountId: 'account_admin_actor',
    state: 'pending',
    expiresAt: '2026-08-04T17:00:00.000Z',
    acceptedAt: null,
    acceptedByAdultId: null,
    acceptanceRequestHash: null,
    requiredPolicies: {
      policySetVersion: 'policy-set-7',
      serviceAccountVersion: 'service-4',
      recordingParticipationVersion: 'recording-9',
    },
    version: 2,
    createdAt: EARLIER,
    updatedAt: EARLIER,
    ...overrides,
  };
}

describe('v2.1 adult identity and contexts', () => {
  it('links repeated normalized email to one identity/login and adds an exact role', () => {
    const existingAdult = adult();
    const existingAccount = account();
    const result = createOrLinkAdultIdentity({
      email: ' OWNER@example.com ',
      displayName: 'Ignored replacement',
      requestedRole: 'admin',
      proposedAdultId: 'adult_unused',
      proposedHumanAccountId: 'account_unused',
      runtimeTier: 'isolated_staging',
      verificationEnvironmentId: 'ci',
      existingAdult,
      existingAccount,
      now: NOW,
    });

    expect(result.adult).toBe(existingAdult);
    expect(result.account.humanAccountId).toBe(existingAccount.humanAccountId);
    expect(result.account.memberships).toEqual(['admin', 'parent']);
    expect(result.account.securityVersion).toBe(2);
    expect(result.adultCreated).toBe(false);
    expect(result.accountCreated).toBe(false);
  });

  it('requires explicit role selection and rotates into the exact role policy', () => {
    const selected = selectAdultRoleContext({
      account: account({ memberships: ['admin', 'parent'] }),
      currentSession: session(),
      requestedRole: 'admin',
      rotatedSessionId: 'session_admin_rotated',
      now: NOW,
    });
    expect(selected.activeRole).toBe('admin');
    expect(selected.activeHouseholdId).toBeNull();
    expect(new Date(selected.idleExpiresAt).getTime() - NOW.getTime()).toBe(30 * 60 * 1000);
    expect(new Date(selected.absoluteExpiresAt).getTime() - NOW.getTime()).toBe(
      12 * 60 * 60 * 1000,
    );
  });

  it('uses only server-resolved ownership and denies direct sibling IDs', () => {
    expect(() =>
      selectHouseholdContext({
        account: account(),
        currentSession: session(),
        serverResolvedOwnedHouseholdIds: ['household_source'],
        selectedHouseholdId: 'household_denial',
        rotatedSessionId: 'session_household_rotated',
        now: NOW,
      }),
    ).toThrowError(expect.objectContaining({ code: 'cross_household_denied' }));
  });

  it('never grants Parent learning or implicit cross-role elevation', () => {
    const context = {
      humanAccountId: 'account_outgoing',
      memberships: ['admin', 'parent'] as const,
      activeRole: 'parent' as const,
      activeHouseholdId: 'household_source',
      serverResolvedOwnedHouseholdIds: ['household_source'],
    };
    expect(
      authorizeAdultCapability({
        context,
        requiredRole: 'parent',
        capability: 'student:read_library',
        householdId: 'household_source',
      }),
    ).toEqual({
      allowed: false,
      reason: 'student_surface_requires_student_credentials',
    });
    expect(
      authorizeAdultCapability({
        context,
        requiredRole: 'admin',
        capability: 'admin:operate_accounts',
      }),
    ).toEqual({ allowed: false, reason: 'wrong_role_context' });
  });
});

describe('v2.1 ownership transfer invariants', () => {
  const adminActor = account({
    humanAccountId: 'account_admin_actor',
    adultId: 'adult_admin_actor',
    memberships: ['admin'],
  });
  const replacementAdult = adult({
    adultId: 'adult_admin',
    normalizedEmail: 'admin@example.com',
    displayName: 'Existing Admin',
  });
  const replacementAccount = account({
    humanAccountId: 'account_admin',
    adultId: 'adult_admin',
    memberships: ['admin'],
    securityVersion: 6,
    version: 5,
  });
  const acceptance = {
    idempotencyKey: 'transfer_accept_001',
    canonicalRequestHash: HASH,
    expectedTransferVersion: 2,
    expectedHouseholdVersion: 4,
    expectedReplacementAccountVersion: 5,
    replacementNormalizedEmail: 'ADMIN@example.com',
    acceptedPolicySetVersion: 'policy-set-7',
    dependentAttestations: [
      {
        studentId: 'student_dependent',
        replacementAdultId: 'adult_admin',
        authorityConfirmed: true as const,
        serviceAccountVersion: 'service-4',
        recordingParticipationVersion: 'recording-9',
        recordedAt: '2026-07-28T18:00:00.000Z',
      },
    ],
    acceptedAt: NOW.toISOString(),
  };

  it('blocks an active outgoing-owner self Student', () => {
    expect(() =>
      acceptHouseholdOwnershipTransfer({
        adminAccount: adminActor,
        transfer: transfer(),
        household: household(),
        activeStudents: [student()],
        replacementAdult,
        replacementAccount,
        proposedReplacementAdultId: 'adult_unused',
        proposedReplacementHumanAccountId: 'account_unused',
        replacementDisplayName: 'Existing Admin',
        acceptance: { ...acceptance, dependentAttestations: [] },
        outgoingSessions: [session()],
        replacementSessions: [],
        billingSessionIds: [],
        setupOrResetTokenIds: [],
        now: NOW,
      }),
    ).toThrowError(expect.objectContaining({ code: 'active_self_student_blocks_transfer' }));
  });

  it('replaces the sole owner, adds parent to an existing Admin, and revokes sessions', () => {
    const dependent = student({
      studentId: 'student_dependent',
      relationship: 'dependent',
      selfAdultId: null,
    });
    const result = acceptHouseholdOwnershipTransfer({
      adminAccount: adminActor,
      transfer: transfer(),
      household: household(),
      activeStudents: [dependent],
      replacementAdult,
      replacementAccount,
      proposedReplacementAdultId: 'adult_unused',
      proposedReplacementHumanAccountId: 'account_unused',
      replacementDisplayName: 'Existing Admin',
      acceptance,
      outgoingSessions: [
        session(),
        session({ sessionId: 'session_outgoing_admin', activeRole: 'admin' }),
        session({
          sessionId: 'session_sibling_household',
          activeHouseholdId: 'household_sibling',
        }),
      ],
      replacementSessions: [
        session({
          sessionId: 'session_replacement_admin',
          humanAccountId: 'account_admin',
          activeRole: 'admin',
          securityVersion: 6,
        }),
      ],
      billingSessionIds: ['billing_session_001'],
      setupOrResetTokenIds: ['setup_token_001'],
      now: NOW,
    });
    if (result.disposition !== 'applied') throw new Error('expected applied result');

    expect(result.household.ownerAdultId).toBe('adult_admin');
    expect(result.household.ownerHumanAccountId).toBe('account_admin');
    expect(result.replacementAccount.memberships).toEqual(['admin', 'parent']);
    expect(result.outgoingSessionIdsRevoked).toEqual(['session_current']);
    expect(result.replacementSessionIdsRevoked).toEqual(['session_replacement_admin']);
    expect(result.providerIntent.changesFinancialIdentity).toBe(false);

    const replay = acceptHouseholdOwnershipTransfer({
      adminAccount: adminActor,
      transfer: result.transfer,
      household: result.household,
      activeStudents: [dependent],
      replacementAdult: result.replacementAdult,
      replacementAccount: result.replacementAccount,
      proposedReplacementAdultId: 'adult_unused',
      proposedReplacementHumanAccountId: 'account_unused',
      replacementDisplayName: 'Existing Admin',
      acceptance,
      outgoingSessions: [],
      replacementSessions: [],
      billingSessionIds: [],
      setupOrResetTokenIds: [],
      now: NOW,
    });
    expect(replay.disposition).toBe('replayed');
  });

  it('denies missing attestations and stale versions', () => {
    const dependent = student({
      studentId: 'student_dependent',
      relationship: 'dependent',
      selfAdultId: null,
    });
    expect(() =>
      acceptHouseholdOwnershipTransfer({
        adminAccount: adminActor,
        transfer: transfer(),
        household: household(),
        activeStudents: [dependent],
        replacementAdult,
        replacementAccount,
        proposedReplacementAdultId: 'adult_unused',
        proposedReplacementHumanAccountId: 'account_unused',
        replacementDisplayName: 'Existing Admin',
        acceptance: { ...acceptance, dependentAttestations: [] },
        outgoingSessions: [],
        replacementSessions: [],
        billingSessionIds: [],
        setupOrResetTokenIds: [],
        now: NOW,
      }),
    ).toThrowError(expect.objectContaining({ code: 'dependent_attestation_missing' }));
    expect(() =>
      acceptHouseholdOwnershipTransfer({
        adminAccount: adminActor,
        transfer: transfer(),
        household: household({ version: 5 }),
        activeStudents: [],
        replacementAdult,
        replacementAccount,
        proposedReplacementAdultId: 'adult_unused',
        proposedReplacementHumanAccountId: 'account_unused',
        replacementDisplayName: 'Existing Admin',
        acceptance: { ...acceptance, dependentAttestations: [] },
        outgoingSessions: [],
        replacementSessions: [],
        billingSessionIds: [],
        setupOrResetTokenIds: [],
        now: NOW,
      }),
    ).toThrowError(expect.objectContaining({ code: 'stale_version' }));
  });
});

describe('v2.1 self Student relocation', () => {
  it('preserves identity, credentials, history, and relationship', () => {
    const result = moveSelfStudentBetweenOwnedHouseholds({
      adult: adult(),
      account: account(),
      student: student(),
      sourceHousehold: household(),
      targetHousehold: household({
        householdId: 'household_target',
        displayName: 'Target',
        activeSeatCount: 2,
        version: 8,
      }),
      expectedStudentVersion: 3,
      expectedSourceHouseholdVersion: 4,
      expectedTargetHouseholdVersion: 8,
      studentSessionIds: ['student_session_001'],
      classroomOrPlaybackGrantIds: ['classroom_grant_001'],
      now: NOW,
    });
    expect(result.student).toMatchObject({
      householdId: 'household_target',
      relationship: 'self',
      studentId: 'student_self',
      credentialId: 'credential_self',
      immutableHistoryReference: 'history_self',
    });
    expect(result.sourceHousehold.activeSeatCount).toBe(0);
    expect(result.targetHousehold.activeSeatCount).toBe(3);
  });

  it('denies cross-owner moves and full targets', () => {
    expect(() =>
      moveSelfStudentBetweenOwnedHouseholds({
        adult: adult(),
        account: account(),
        student: student(),
        sourceHousehold: household(),
        targetHousehold: household({
          householdId: 'household_denial',
          ownerAdultId: 'adult_other',
          ownerHumanAccountId: 'account_other',
          activeSeatCount: 0,
        }),
        expectedStudentVersion: 3,
        expectedSourceHouseholdVersion: 4,
        expectedTargetHouseholdVersion: 4,
        studentSessionIds: [],
        classroomOrPlaybackGrantIds: [],
        now: NOW,
      }),
    ).toThrowError(expect.objectContaining({ code: 'self_student_owner_mismatch' }));
    expect(() =>
      moveSelfStudentBetweenOwnedHouseholds({
        adult: adult(),
        account: account(),
        student: student(),
        sourceHousehold: household(),
        targetHousehold: household({
          householdId: 'household_target',
          activeSeatCount: 3,
        }),
        expectedStudentVersion: 3,
        expectedSourceHouseholdVersion: 4,
        expectedTargetHouseholdVersion: 4,
        studentSessionIds: [],
        classroomOrPlaybackGrantIds: [],
        now: NOW,
      }),
    ).toThrowError(expect.objectContaining({ code: 'seat_limit_reached' }));
  });
});
