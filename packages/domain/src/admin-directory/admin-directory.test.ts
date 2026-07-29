import { describe, expect, it } from 'vitest';
import type {
  AdultSession,
  AdultIdentity,
  HouseholdOwnershipTransfer,
  HumanAccount,
} from '../../../contracts/src/accounts/v21-household-identity.ts';
import type {
  AdminDirectoryActor,
  AdminHouseholdRecord,
  AdminStudentRecord,
  CanonicalStudentEnrollment,
  LockedOwnershipTransferEffectInventory,
  ServiceAccountAcceptanceEvidence,
} from '../../../contracts/src/admin/directory/index.ts';
import { hashAuthPassword } from '../auth/index.ts';
import {
  completeVerifiedOwnershipTransfer,
  createHousehold,
  createStudent,
  editAdultContact,
  editHousehold,
  editStudent,
  planStudentCredentialReset,
  transitionAdultContact,
  transitionHousehold,
  transitionStudent,
  upsertAdultContact,
} from './index.ts';

const now = '2026-07-29T01:00:00.000Z';
const scope = {
  product: 'one_time_mishnayos',
  runtimeTier: 'isolated_staging',
  verificationEnvironmentId: 'ci',
} as const;
const actor: AdminDirectoryActor = {
  ...scope,
  principal: {
    human_account_id: 'account-admin',
    role: 'admin',
    household_id: null,
    student_id: null,
    credential_version: 3,
  },
};
const parentActor: AdminDirectoryActor = {
  ...actor,
  principal: { ...actor.principal, role: 'parent', household_id: 'household-one' },
};

function adult(adultId = 'adult-parent', state: AdultIdentity['state'] = 'active'): AdultIdentity {
  return {
    ...scope,
    adultId,
    normalizedEmail: `${adultId}@example.test`,
    displayName: 'Parent One',
    state,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function account(
  humanAccountId = 'account-parent',
  adultId = 'adult-parent',
  memberships: HumanAccount['memberships'] = ['parent'],
  state: HumanAccount['state'] = 'active',
): HumanAccount {
  return {
    ...scope,
    humanAccountId,
    adultId,
    memberships,
    state,
    securityVersion: 1,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function household(overrides: Partial<AdminHouseholdRecord> = {}): AdminHouseholdRecord {
  return {
    ...scope,
    householdId: 'household-one',
    ownerAdultId: 'adult-parent',
    ownerHumanAccountId: 'account-parent',
    classification: 'family',
    displayName: 'The One Family',
    seatLimit: 3,
    activeSeatCount: 0,
    state: 'active',
    accessState: 'active',
    schoolSeatAllowance: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function student(overrides: Partial<AdminStudentRecord> = {}): AdminStudentRecord {
  return {
    ...scope,
    studentId: 'student-one',
    householdId: 'household-one',
    relationship: 'dependent',
    selfAdultId: null,
    state: 'active',
    credentialId: 'credential-one',
    immutableHistoryReference: 'history-one',
    displayName: 'Student One',
    username: 'student.one',
    credentialVersion: 1,
    credentialState: 'active',
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function acceptance(
  studentId = 'student-one',
  version = 'service-account-v3',
): ServiceAccountAcceptanceEvidence {
  return {
    ...scope,
    acceptanceId: `acceptance-${studentId}`,
    householdId: 'household-one',
    studentId,
    acceptedByAdultId: 'adult-parent',
    acceptedServiceAccountVersion: version,
    canonicalRequestHash: 'a'.repeat(64),
    immutableEvidenceReference: `evidence-${studentId}`,
    acceptedAt: now,
  };
}

function enrollment(
  overrides: Partial<CanonicalStudentEnrollment> = {},
): CanonicalStudentEnrollment {
  return {
    ...scope,
    enrollmentId: 'enrollment-one',
    householdId: 'household-one',
    studentId: 'student-one',
    serviceAccountAcceptanceId: 'acceptance-student-one',
    state: 'active',
    version: 1,
    updatedAt: now,
    ...overrides,
  };
}

function session(
  sessionId: string,
  humanAccountId: string,
  activeRole: AdultSession['activeRole'] = 'parent',
): AdultSession {
  return {
    ...scope,
    sessionId,
    humanAccountId,
    activeRole,
    activeHouseholdId: 'household-one',
    securityVersion: 1,
    idleExpiresAt: '2026-07-29T02:00:00.000Z',
    absoluteExpiresAt: '2026-07-29T09:00:00.000Z',
    revokedAt: null,
    revocationReason: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function ownershipInventory(
  overrides: Partial<LockedOwnershipTransferEffectInventory> = {},
): LockedOwnershipTransferEffectInventory {
  return {
    ...scope,
    inventoryId: 'inventory-one',
    transferId: 'transfer-one',
    householdId: 'household-one',
    outgoingHumanAccountId: 'account-parent',
    replacementHumanAccountId: 'account-replacement',
    complete: true,
    outgoingSessions: [session('session-outgoing', 'account-parent')],
    replacementSessions: [session('session-replacement', 'account-replacement')],
    billingSessionIds: ['billing-one'],
    grantIds: ['grant-one'],
    setupOrResetTokenIds: ['token-one'],
    effectAuthorityIds: ['effect-authority-one'],
    ...overrides,
  };
}

function createStudentInput(overrides: Record<string, unknown> = {}) {
  return {
    actor,
    household: household(),
    expectedHouseholdVersion: 1,
    studentId: 'student-one',
    displayName: 'Student One',
    username: 'student.one',
    lockedUsernameMatch: null,
    relationship: 'dependent' as const,
    selfAdultId: null,
    credentialId: 'credential-one',
    replacementCredentialHash: hashAuthPassword('Student passphrase 123!'),
    serviceAccountAcceptance: acceptance(),
    currentServiceAccountVersion: 'service-account-v3',
    immutableHistoryReference: 'history-one',
    occurredAt: now,
    ...overrides,
  };
}

describe('P10 corrected Admin directory domain', () => {
  it('creates exact Admin/Parent memberships without learner elevation', () => {
    const admin = upsertAdultContact({
      actor,
      email: 'second-admin@example.test',
      displayName: 'Second Admin',
      requestedRole: 'admin',
      proposedAdultId: 'adult-second-admin',
      proposedHumanAccountId: 'account-second-admin',
      existingAdult: null,
      existingAccount: null,
      occurredAt: now,
    });
    const parent = upsertAdultContact({
      actor,
      email: 'new-parent@example.test',
      displayName: 'New Parent',
      requestedRole: 'parent',
      proposedAdultId: 'adult-new-parent',
      proposedHumanAccountId: 'account-new-parent',
      existingAdult: null,
      existingAccount: null,
      occurredAt: now,
    });
    expect(admin.account.memberships).toEqual(['admin']);
    expect(parent.account.memberships).toEqual(['parent']);
    expect(parent.account).not.toHaveProperty('studentId');
  });

  it('requires locked Admin/ownership evidence and revokes all adult sessions', () => {
    const edited = editAdultContact({
      actor,
      adult: adult(),
      account: account(),
      expectedAdultVersion: 1,
      expectedAccountVersion: 1,
      displayName: 'Parent Updated',
      email: 'updated@example.test',
      occurredAt: now,
    });
    expect(edited.revokeAllAccess).toEqual([
      {
        subjectType: 'adult',
        subjectId: 'account-parent',
        reason: 'adult_email_changed',
      },
    ]);
    expect(() =>
      transitionAdultContact({
        actor,
        adult: adult('adult-admin'),
        account: account('account-admin-two', 'adult-admin', ['admin']),
        expectedAdultVersion: 1,
        expectedAccountVersion: 1,
        to: 'archived',
        lockedActiveAdminCount: 1,
        lockedOwnedHouseholdIds: [],
        occurredAt: now,
      }),
    ).toThrow(/final active Admin/u);
    expect(() =>
      transitionAdultContact({
        actor,
        adult: adult(),
        account: account(),
        expectedAdultVersion: 1,
        expectedAccountVersion: 1,
        to: 'archived',
        lockedActiveAdminCount: 2,
        lockedOwnedHouseholdIds: ['household-one'],
        occurredAt: now,
      }),
    ).toThrow(/owned household/u);
    expect(() =>
      transitionAdultContact({
        actor,
        adult: adult('adult-disabled', 'archived'),
        account: account('account-disabled', 'adult-disabled', ['parent'], 'disabled'),
        expectedAdultVersion: 1,
        expectedAccountVersion: 1,
        to: 'active',
        lockedActiveAdminCount: 2,
        lockedOwnedHouseholdIds: [],
        occurredAt: now,
      }),
    ).toThrow(/disabled HumanAccount/u);
    expect(
      transitionAdultContact({
        actor,
        adult: adult(),
        account: account(),
        expectedAdultVersion: 1,
        expectedAccountVersion: 1,
        to: 'archived',
        lockedActiveAdminCount: 2,
        lockedOwnedHouseholdIds: [],
        occurredAt: now,
      }).revokeAllAccess,
    ).toHaveLength(1);
  });

  it('enforces family three-seat policy and contract-bound School allowance', () => {
    const family = createHousehold({
      actor,
      householdId: 'household-one',
      owner: adult(),
      ownerAccount: account(),
      displayName: 'One Family',
      classification: 'family',
      seatLimit: 3,
      schoolSeatAllowance: null,
      occurredAt: now,
    });
    expect(family).toMatchObject({ seatLimit: 3, accessState: 'inactive' });
    expect(() =>
      createHousehold({
        actor,
        householdId: 'household-two',
        owner: adult(),
        ownerAccount: account(),
        displayName: 'Wrong Family',
        classification: 'family',
        seatLimit: 4,
        schoolSeatAllowance: null,
        occurredAt: now,
      }),
    ).toThrow(/exactly three/u);
    expect(() =>
      editHousehold({
        actor,
        household: family,
        expectedVersion: 1,
        displayName: 'One School',
        classification: 'school',
        seatLimit: 8,
        schoolSeatAllowance: null,
        occurredAt: now,
      }),
    ).toThrow(/exact allowance/u);
    const school = editHousehold({
      actor,
      household: family,
      expectedVersion: 1,
      displayName: 'One School',
      classification: 'school',
      seatLimit: 8,
      schoolSeatAllowance: {
        ...scope,
        householdId: 'household-one',
        seatLimit: 8,
        contractReference: 'contract-school-2026',
        reason: 'Signed school cohort allowance',
        authorizedAt: now,
      },
      occurredAt: now,
    });
    expect(school.schoolSeatAllowance?.contractReference).toBe('contract-school-2026');
  });

  it('archives household access and every Student grant; restore remains access-inactive', () => {
    const archived = transitionHousehold({
      actor,
      household: household({ activeSeatCount: 1 }),
      expectedVersion: 1,
      to: 'archived',
      lockedActiveStudents: [student()],
      owner: adult(),
      ownerAccount: account(),
      occurredAt: now,
    });
    expect(archived.household).toMatchObject({ state: 'archived', accessState: 'inactive' });
    expect(archived.revokeAllAccess).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ subjectType: 'household', subjectId: 'household-one' }),
        expect.objectContaining({ subjectType: 'student', subjectId: 'student-one' }),
      ]),
    );
    expect(() =>
      transitionHousehold({
        actor,
        household: archived.household,
        expectedVersion: 2,
        to: 'active',
        lockedActiveStudents: [],
        owner: adult('adult-parent', 'archived'),
        ownerAccount: account(),
        occurredAt: now,
      }),
    ).toThrow(/active locked owner/u);
    expect(
      transitionHousehold({
        actor,
        household: archived.household,
        expectedVersion: 2,
        to: 'active',
        lockedActiveStudents: [],
        owner: adult(),
        ownerAccount: account(),
        occurredAt: now,
      }).household,
    ).toMatchObject({ state: 'active', accessState: 'inactive' });
  });

  it('atomically plans Student profile, credential, acceptance, and canonical enrollment', () => {
    const created = createStudent(createStudentInput());
    expect(created.student).toMatchObject({
      state: 'active',
      credentialState: 'active',
      credentialVersion: 1,
    });
    expect(created.credentialReset).toMatchObject({
      kind: 'initial_activation',
      discloseExistingPassword: false,
    });
    expect(created.enrollment).toMatchObject({
      state: 'active',
      serviceAccountAcceptanceId: 'acceptance-student-one',
    });
    expect(created.household.activeSeatCount).toBe(1);
  });

  it('denies invalid Student creation evidence, capacity, scope, version, and username races', () => {
    for (const [label, overrides] of [
      ['archived', { household: household({ state: 'archived' }) }],
      ['inactive', { household: household({ accessState: 'inactive' }) }],
      ['full', { household: household({ activeSeatCount: 3 }) }],
      ['stale-version', { expectedHouseholdVersion: 2 }],
      [
        'stale-acceptance',
        { serviceAccountAcceptance: acceptance('student-one', 'service-account-v2') },
      ],
      [
        'unrelated-adult-acceptance',
        {
          serviceAccountAcceptance: {
            ...acceptance(),
            acceptedByAdultId: 'adult-unrelated',
          },
        },
      ],
      ['fake-hash', { replacementCredentialHash: `$argon2id$${'a'.repeat(80)}` }],
      ['obsolete-hash', { replacementCredentialHash: 'scrypt:obsolete' }],
      ['malformed-hash', { replacementCredentialHash: 'argon2id-v1$v=19$m=1,t=1,p=1$x$y' }],
      ['username-race', { lockedUsernameMatch: student({ studentId: 'student-other' }) }],
    ] as const) {
      expect(
        () => createStudent(createStudentInput(overrides as Record<string, unknown>)),
        label,
      ).toThrow();
    }
  });

  it('archives every Student access surface and requires fresh restoration proof', () => {
    const archived = transitionStudent({
      actor,
      student: student(),
      household: household({ activeSeatCount: 1 }),
      expectedStudentVersion: 1,
      expectedHouseholdVersion: 1,
      to: 'archived',
      lockedUsernameMatch: student(),
      currentEnrollment: enrollment(),
      replacementCredentialHash: null,
      serviceAccountAcceptance: null,
      currentServiceAccountVersion: 'service-account-v3',
      occurredAt: now,
    });
    expect(archived).toMatchObject({
      student: { state: 'archived', credentialState: 'disabled' },
      enrollment: { enrollmentId: 'enrollment-one', state: 'revoked', version: 2 },
    });
    expect(archived.revokeAllAccess).toHaveLength(1);
    expect(() =>
      transitionStudent({
        actor,
        student: archived.student,
        household: archived.household,
        expectedStudentVersion: 2,
        expectedHouseholdVersion: 2,
        to: 'active',
        lockedUsernameMatch: archived.student,
        currentEnrollment: archived.enrollment,
        replacementCredentialHash: hashAuthPassword('Student passphrase 123!'),
        serviceAccountAcceptance: acceptance('student-one', 'service-account-v2'),
        currentServiceAccountVersion: 'service-account-v3',
        occurredAt: now,
      }),
    ).toThrow(/service-account acceptance/u);
    for (const currentEnrollment of [
      { ...archived.enrollment, studentId: 'student-other' },
      { ...archived.enrollment, householdId: 'household-other' },
      { ...archived.enrollment, enrollmentId: 'enrollment-other', state: 'active' as const },
    ]) {
      expect(() =>
        transitionStudent({
          actor,
          student: archived.student,
          household: archived.household,
          expectedStudentVersion: 2,
          expectedHouseholdVersion: 2,
          to: 'active',
          lockedUsernameMatch: archived.student,
          currentEnrollment,
          replacementCredentialHash: hashAuthPassword('Student passphrase 456!'),
          serviceAccountAcceptance: acceptance(),
          currentServiceAccountVersion: 'service-account-v3',
          occurredAt: now,
        }),
      ).toThrow(/exact revoked canonical enrollment/u);
    }
    expect(() =>
      transitionStudent({
        actor,
        student: archived.student,
        household: archived.household,
        expectedStudentVersion: 2,
        expectedHouseholdVersion: 2,
        to: 'active',
        lockedUsernameMatch: archived.student,
        currentEnrollment: archived.enrollment,
        replacementCredentialHash: hashAuthPassword('Student passphrase 456!'),
        serviceAccountAcceptance: {
          ...acceptance(),
          acceptedByAdultId: 'adult-unrelated',
        },
        currentServiceAccountVersion: 'service-account-v3',
        occurredAt: now,
      }),
    ).toThrow(/authorized household owner/u);
    const restored = transitionStudent({
      actor,
      student: archived.student,
      household: archived.household,
      expectedStudentVersion: 2,
      expectedHouseholdVersion: 2,
      to: 'active',
      lockedUsernameMatch: archived.student,
      currentEnrollment: archived.enrollment,
      replacementCredentialHash: hashAuthPassword('Student passphrase 456!'),
      serviceAccountAcceptance: acceptance(),
      currentServiceAccountVersion: 'service-account-v3',
      occurredAt: now,
    });
    expect(restored).toMatchObject({
      student: { state: 'active', credentialState: 'active', credentialVersion: 2 },
      enrollment: {
        enrollmentId: 'enrollment-one',
        state: 'active',
        version: 3,
        serviceAccountAcceptanceId: 'acceptance-student-one',
      },
      credentialReset: { kind: 'reset' },
    });
  });

  it('uses the exact current F03 Argon2id structure and never accepts a caller subset', () => {
    const result = planStudentCredentialReset({
      actor,
      student: student(),
      replacementCredentialHash: hashAuthPassword('Another strong Student passphrase 123!'),
      occurredAt: now,
    });
    expect(result.reset).toMatchObject({
      kind: 'reset',
      credentialVersion: 2,
      revocationReadbackId: null,
      discloseExistingPassword: false,
    });
    expect(result.revokeAllAccess).toEqual([
      {
        subjectType: 'student',
        subjectId: 'student-one',
        reason: 'student_credential_changed',
      },
    ]);
    for (const invalid of [
      `$argon2id$${'a'.repeat(80)}`,
      'argon2id-v0$v=19$m=19456,t=2,p=1$abc$def',
      'argon2id-v1$v=19$m=1,t=1,p=1$abc$def',
      'not-a-hash',
    ]) {
      expect(() =>
        planStudentCredentialReset({
          actor,
          student: student(),
          replacementCredentialHash: invalid,
          occurredAt: now,
        }),
      ).toThrow(/current F03/u);
    }
  });

  it('enforces Admin authority, scope isolation, stale versions, and username locks', () => {
    expect(() =>
      editStudent({
        actor: parentActor,
        student: student(),
        expectedVersion: 1,
        displayName: 'Denied',
        username: 'denied.student',
        lockedUsernameMatch: null,
        occurredAt: now,
      }),
    ).toThrow(/Admin session/u);
    expect(() =>
      editStudent({
        actor,
        student: student({ verificationEnvironmentId: 'provider_sandbox' }),
        expectedVersion: 1,
        displayName: 'Denied',
        username: 'denied.student',
        lockedUsernameMatch: null,
        occurredAt: now,
      }),
    ).toThrow(/cross product, runtime, or environment/u);
    expect(() =>
      editStudent({
        actor,
        student: student(),
        expectedVersion: 2,
        displayName: 'Denied',
        username: 'denied.student',
        lockedUsernameMatch: null,
        occurredAt: now,
      }),
    ).toThrow(/stale/u);
    expect(() =>
      editStudent({
        actor,
        student: student(),
        expectedVersion: 1,
        displayName: 'Denied',
        username: 'taken.student',
        lockedUsernameMatch: student({
          studentId: 'student-other',
          username: 'taken.student',
        }),
        occurredAt: now,
      }),
    ).toThrow(/already assigned/u);
  });

  it('still completes only verified, version-locked ownership transfer', () => {
    const transfer: HouseholdOwnershipTransfer = {
      ...scope,
      transferId: 'transfer-one',
      householdId: 'household-one',
      outgoingAdultId: 'adult-parent',
      outgoingHumanAccountId: 'account-parent',
      replacementNormalizedEmail: 'replacement@example.test',
      replacementAdultId: null,
      initiatedByAdminAccountId: 'account-admin',
      state: 'pending',
      expiresAt: '2026-08-01T01:00:00.000Z',
      acceptedAt: null,
      acceptedByAdultId: null,
      acceptanceRequestHash: null,
      requiredPolicies: {
        policySetVersion: 'policies-v2',
        serviceAccountVersion: 'service-v2',
        recordingParticipationVersion: 'recording-v2',
      },
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    expect(
      completeVerifiedOwnershipTransfer({
        actor,
        adminAccount: account('account-admin', 'adult-admin', ['admin']),
        transfer,
        household: household(),
        activeStudents: [],
        replacementAdult: null,
        replacementAccount: null,
        proposedReplacementAdultId: 'adult-replacement',
        proposedReplacementHumanAccountId: 'account-replacement',
        replacementDisplayName: 'Replacement Parent',
        acceptance: {
          idempotencyKey: 'ownership-one',
          canonicalRequestHash: 'a'.repeat(64),
          expectedTransferVersion: 1,
          expectedHouseholdVersion: 1,
          expectedReplacementAccountVersion: null,
          replacementNormalizedEmail: 'replacement@example.test',
          acceptedPolicySetVersion: 'policies-v2',
          dependentAttestations: [],
          acceptedAt: now,
        },
        lockedEffectInventory: ownershipInventory(),
        now: new Date(now),
      }),
    ).toMatchObject({
      disposition: 'applied',
      parentMembershipAdded: true,
      outgoingSessionIdsRevoked: ['session-outgoing'],
      replacementSessionIdsRevoked: ['session-replacement'],
      billingSessionIdsRevoked: ['billing-one'],
      setupOrResetTokenIdsInvalidated: ['token-one'],
    });
    expect(() =>
      completeVerifiedOwnershipTransfer({
        actor,
        adminAccount: account('account-admin', 'adult-admin', ['admin']),
        transfer,
        household: household(),
        activeStudents: [],
        replacementAdult: null,
        replacementAccount: null,
        proposedReplacementAdultId: 'adult-replacement',
        proposedReplacementHumanAccountId: 'account-replacement',
        replacementDisplayName: 'Replacement Parent',
        acceptance: {
          idempotencyKey: 'ownership-one',
          canonicalRequestHash: 'a'.repeat(64),
          expectedTransferVersion: 1,
          expectedHouseholdVersion: 1,
          expectedReplacementAccountVersion: null,
          replacementNormalizedEmail: 'replacement@example.test',
          acceptedPolicySetVersion: 'policies-v2',
          dependentAttestations: [],
          acceptedAt: now,
        },
        lockedEffectInventory: ownershipInventory({
          outgoingHumanAccountId: 'account-unrelated',
        }),
        now: new Date(now),
      }),
    ).toThrow(/exact complete locked effect inventory/u);
  });
});
