import { describe, expect, it } from 'vitest';
import type {
  AdultIdentity,
  Household,
  HouseholdOwnershipTransfer,
  HumanAccount,
} from '../../../contracts/src/accounts/v21-household-identity.ts';
import type {
  AdminDirectoryActor,
  AdminStudentRecord,
} from '../../../contracts/src/admin/directory/index.ts';
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

function adult(adultId = 'adult-parent', normalizedEmail = 'parent@example.test'): AdultIdentity {
  return {
    ...scope,
    adultId,
    normalizedEmail,
    displayName: 'Parent One',
    state: 'active',
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function account(
  humanAccountId = 'account-parent',
  adultId = 'adult-parent',
  memberships: HumanAccount['memberships'] = ['parent'],
): HumanAccount {
  return {
    ...scope,
    humanAccountId,
    adultId,
    memberships,
    state: 'active',
    securityVersion: 1,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function household(): Household {
  return {
    ...scope,
    householdId: 'household-one',
    ownerAdultId: 'adult-parent',
    ownerHumanAccountId: 'account-parent',
    classification: 'family',
    displayName: 'The One Family',
    seatLimit: 2,
    activeSeatCount: 0,
    state: 'active',
    version: 1,
    createdAt: now,
    updatedAt: now,
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
    credentialState: 'reset_required',
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('P10 Admin directory acceptance', () => {
  it('OTV2-ADMIN-022 creates, edits, archives, and restores an adult contact', () => {
    const created = upsertAdultContact({
      actor,
      email: ' Parent@Example.test ',
      displayName: 'Parent One',
      requestedRole: 'parent',
      proposedAdultId: 'adult-parent',
      proposedHumanAccountId: 'account-parent',
      existingAdult: null,
      existingAccount: null,
      occurredAt: now,
    });
    expect(created.account.memberships).toEqual(['parent']);
    const edited = editAdultContact({
      actor,
      adult: created.adult,
      account: created.account,
      expectedAdultVersion: 1,
      expectedAccountVersion: 1,
      displayName: 'Parent Updated',
      email: 'updated@example.test',
      occurredAt: now,
    });
    const archived = transitionAdultContact({
      actor,
      adult: edited.adult,
      account: edited.account,
      expectedAdultVersion: 2,
      expectedAccountVersion: 2,
      to: 'archived',
      occurredAt: now,
    });
    expect(archived).toMatchObject({
      adult: { state: 'archived', displayName: 'Parent Updated' },
      account: { state: 'archived' },
      revokeSessions: true,
    });
    expect(
      transitionAdultContact({
        actor,
        adult: archived.adult,
        account: archived.account,
        expectedAdultVersion: 3,
        expectedAccountVersion: 3,
        to: 'active',
        occurredAt: now,
      }),
    ).toMatchObject({ adult: { state: 'active' }, account: { state: 'active' } });
  });

  it('OTV2-ADMIN-023 creates, edits, archives, and restores a household', () => {
    const created = createHousehold({
      actor,
      householdId: 'household-one',
      owner: adult(),
      ownerAccount: account(),
      displayName: 'One Family',
      classification: 'family',
      seatLimit: 4,
      occurredAt: now,
    });
    const edited = editHousehold({
      actor,
      household: created,
      expectedVersion: 1,
      displayName: 'One School',
      classification: 'school',
      seatLimit: 8,
      occurredAt: now,
    });
    const archived = transitionHousehold({
      actor,
      household: edited,
      expectedVersion: 2,
      to: 'archived',
      occurredAt: now,
    });
    expect(archived).toMatchObject({ classification: 'school', state: 'archived' });
    expect(
      transitionHousehold({
        actor,
        household: archived,
        expectedVersion: 3,
        to: 'active',
        occurredAt: now,
      }).state,
    ).toBe('active');
  });

  it('OTV2-ADMIN-024 completes only a verified, version-locked ownership transfer', () => {
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
    const result = completeVerifiedOwnershipTransfer({
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
      outgoingSessions: [],
      replacementSessions: [],
      billingSessionIds: [],
      setupOrResetTokenIds: [],
      now: new Date(now),
    });
    expect(result).toMatchObject({
      disposition: 'applied',
      household: {
        ownerAdultId: 'adult-replacement',
        ownerHumanAccountId: 'account-replacement',
      },
      parentMembershipAdded: true,
    });
  });

  it('OTV2-ADMIN-025 creates an additional exact Admin membership', () => {
    const result = upsertAdultContact({
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
    expect(result.account.memberships).toEqual(['admin']);
  });

  it('OTV2-ADMIN-026 creates Parent without making the adult a learner', () => {
    const result = upsertAdultContact({
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
    expect(result.account.memberships).toEqual(['parent']);
    expect(result.account).not.toHaveProperty('studentId');
  });

  it('OTV2-ADMIN-027 preserves Student identity through edit, archive, and restore', () => {
    const created = createStudent({
      actor,
      household: household(),
      studentId: 'student-one',
      displayName: 'Student One',
      username: 'student.one',
      relationship: 'dependent',
      selfAdultId: null,
      credentialId: 'credential-one',
      immutableHistoryReference: 'history-one',
      occurredAt: now,
    });
    const edited = editStudent({
      actor,
      student: created.student,
      expectedVersion: 1,
      displayName: 'Student Updated',
      username: 'student.updated',
      occurredAt: now,
    });
    const archived = transitionStudent({
      actor,
      student: edited,
      household: created.household,
      expectedStudentVersion: 2,
      expectedHouseholdVersion: 2,
      to: 'archived',
      occurredAt: now,
    });
    const restored = transitionStudent({
      actor,
      student: archived.student,
      household: archived.household,
      expectedStudentVersion: 3,
      expectedHouseholdVersion: 3,
      to: 'active',
      occurredAt: now,
    });
    expect(restored.student).toMatchObject({
      studentId: 'student-one',
      credentialId: 'credential-one',
      immutableHistoryReference: 'history-one',
      state: 'active',
    });
  });

  it('OTV2-ADMIN-028 replaces a Student credential without email or password disclosure', () => {
    const result = planStudentCredentialReset({
      actor,
      student: student(),
      replacementCredentialHash: `$argon2id$${'a'.repeat(80)}`,
      studentSessionIds: ['session-two', 'session-one', 'session-one'],
      occurredAt: now,
    });
    expect(result.student).toMatchObject({ credentialVersion: 2, credentialState: 'active' });
    expect(result.reset).toMatchObject({
      discloseExistingPassword: false,
      studentSessionIdsRevoked: ['session-one', 'session-two'],
    });
    expect(result.reset).not.toHaveProperty('email');
  });

  it('enforces runtime Admin authority, scope isolation, and stale-version denial', () => {
    expect(() =>
      editStudent({
        actor: parentActor,
        student: student(),
        expectedVersion: 1,
        displayName: 'Denied',
        username: 'denied.student',
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
        occurredAt: now,
      }),
    ).toThrow(/stale/u);
  });
});
