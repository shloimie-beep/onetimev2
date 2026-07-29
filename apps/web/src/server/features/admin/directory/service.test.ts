import { describe, expect, it } from 'vitest';
import type {
  ActiveAccessRevocationReadback,
  AdminDirectoryAuditEvent,
  AdminDirectoryReceipt,
  AdminDirectoryRepository,
  AdminDirectoryScope,
  AdminDirectoryUnitOfWork,
  AdminHouseholdRecord,
  AdminStudentRecord,
  CanonicalStudentEnrollment,
  LockedOwnershipTransferEffectInventory,
  OwnershipTransferEffectReadback,
  ServiceAccountAcceptanceEvidence,
  StudentCredentialReset,
} from '../../../../../../../packages/contracts/src/admin/directory/index.ts';
import type {
  AdultSession,
  AdultIdentity,
  HouseholdOwnershipTransfer,
  HumanAccount,
  OwnershipTransferAcceptanceResult,
} from '../../../../../../../packages/contracts/src/accounts/v21-household-identity.ts';
import { completeVerifiedOwnershipTransfer } from '../../../../../../../packages/domain/src/admin-directory/index.ts';
import { canonicalAdminDirectoryRequestHash } from '../../../../../../../packages/domain/src/contact-operations/index.ts';
import { AdminDirectoryService } from './service.ts';

const scope = {
  product: 'one_time_mishnayos',
  runtimeTier: 'isolated_staging',
  verificationEnvironmentId: 'ci',
} as const;
const occurredAt = '2026-07-29T01:00:00.000Z';
const actor = {
  ...scope,
  principal: {
    human_account_id: 'account-admin',
    role: 'admin',
    household_id: null,
    student_id: null,
    credential_version: 1,
  },
} as const;

function session(sessionId: string, humanAccountId: string): AdultSession {
  return {
    ...scope,
    sessionId,
    humanAccountId,
    activeRole: 'parent',
    activeHouseholdId: 'household-one',
    securityVersion: 1,
    idleExpiresAt: '2026-07-29T02:00:00.000Z',
    absoluteExpiresAt: '2026-07-29T09:00:00.000Z',
    revokedAt: null,
    revocationReason: null,
    version: 1,
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
}

function ownershipInventory(): LockedOwnershipTransferEffectInventory {
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
  };
}

class MemoryDirectoryRepository implements AdminDirectoryRepository, AdminDirectoryUnitOfWork {
  adults = new Map<string, AdultIdentity>();
  accounts = new Map<string, HumanAccount>();
  households = new Map<string, AdminHouseholdRecord>();
  students = new Map<string, AdminStudentRecord>();
  enrollments = new Map<string, CanonicalStudentEnrollment>();
  acceptances = new Map<string, ServiceAccountAcceptanceEvidence>();
  resets = new Map<string, StudentCredentialReset>();
  receipts = new Map<string, AdminDirectoryReceipt>();
  audits: AdminDirectoryAuditEvent[] = [];
  ownershipTransfers: OwnershipTransferAcceptanceResult[] = [];
  pendingOwnershipTransfers = new Map<string, HouseholdOwnershipTransfer>();
  ownershipEffectInventory: LockedOwnershipTransferEffectInventory | null = null;
  ownershipEffectReadbacks: OwnershipTransferEffectReadback[] = [];
  omitOwnershipGrantReadback = false;
  revocations: ActiveAccessRevocationReadback[] = [];
  failAudit = false;
  private transactionTail = Promise.resolve();

  async inTransaction<T>(run: (unit: AdminDirectoryUnitOfWork) => Promise<T>): Promise<T> {
    const preceding = this.transactionTail;
    let release!: () => void;
    this.transactionTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await preceding;
    const snapshot = this.snapshot();
    try {
      return await run(this);
    } catch (error) {
      this.restore(snapshot);
      throw error;
    } finally {
      release();
    }
  }
  async lockAdult(_scope: AdminDirectoryScope, adultId: string) {
    return this.adults.get(adultId) ?? null;
  }
  async saveAdult(value: AdultIdentity) {
    this.adults.set(value.adultId, value);
  }
  async lockAccount(_scope: AdminDirectoryScope, humanAccountId: string) {
    return this.accounts.get(humanAccountId) ?? null;
  }
  async saveAccount(value: HumanAccount) {
    this.accounts.set(value.humanAccountId, value);
  }
  async lockHousehold(_scope: AdminDirectoryScope, householdId: string) {
    return this.households.get(householdId) ?? null;
  }
  async saveHousehold(value: AdminHouseholdRecord) {
    this.households.set(value.householdId, value);
  }
  async lockStudent(_scope: AdminDirectoryScope, studentId: string) {
    return this.students.get(studentId) ?? null;
  }
  async lockStudentByNormalizedUsername(_scope: AdminDirectoryScope, normalizedUsername: string) {
    return (
      [...this.students.values()].find((student) => student.username === normalizedUsername) ?? null
    );
  }
  async lockActiveStudentsByHousehold(_scope: AdminDirectoryScope, householdId: string) {
    return [...this.students.values()].filter(
      (student) => student.householdId === householdId && student.state === 'active',
    );
  }
  async lockActiveAdminCount() {
    return [...this.accounts.values()].filter(
      (account) => account.state === 'active' && account.memberships.includes('admin'),
    ).length;
  }
  async lockOwnedHouseholdIds(_scope: AdminDirectoryScope, adultId: string) {
    return [...this.households.values()]
      .filter((household) => household.ownerAdultId === adultId)
      .map((household) => household.householdId);
  }
  async lockCurrentServiceAccountVersion() {
    return 'service-account-v3';
  }
  async saveStudent(value: AdminStudentRecord) {
    const collision = await this.lockStudentByNormalizedUsername(scope, value.username);
    if (collision && collision.studentId !== value.studentId) throw new Error('username unique');
    this.students.set(value.studentId, value);
  }
  async lockCurrentStudentEnrollment(_scope: AdminDirectoryScope, studentId: string) {
    return (
      [...this.enrollments.values()]
        .filter((enrollmentValue) => enrollmentValue.studentId === studentId)
        .sort((left, right) => right.version - left.version)[0] ?? null
    );
  }
  async saveStudentEnrollment(value: CanonicalStudentEnrollment) {
    this.enrollments.set(value.enrollmentId, value);
  }
  async saveServiceAccountAcceptance(value: ServiceAccountAcceptanceEvidence) {
    this.acceptances.set(value.acceptanceId, value);
  }
  async revokeAllActiveAccess(
    _scope: AdminDirectoryScope,
    command: Parameters<AdminDirectoryUnitOfWork['revokeAllActiveAccess']>[1],
  ): Promise<ActiveAccessRevocationReadback> {
    const value: ActiveAccessRevocationReadback = {
      ...scope,
      ...command,
      readbackId: `readback-${command.subjectType}-${command.subjectId}`,
      complete: true,
      activeSessionIdsRevoked: [`session-${command.subjectId}`],
      classroomGrantIdsRevoked: [`classroom-${command.subjectId}`],
      playbackGrantIdsRevoked: [`playback-${command.subjectId}`],
      enrollmentIdsRevoked:
        command.subjectType === 'student' ? [`enrollment-${command.subjectId}`] : [],
      revokedAt: occurredAt,
    };
    this.revocations.push(value);
    return value;
  }
  async lockOwnershipTransfer(
    _scope: AdminDirectoryScope,
    transferId: string,
  ): Promise<HouseholdOwnershipTransfer | null> {
    return this.pendingOwnershipTransfers.get(transferId) ?? null;
  }
  async lockOwnershipTransferEffectInventory(
    _scope: AdminDirectoryScope,
    _binding: Parameters<AdminDirectoryUnitOfWork['lockOwnershipTransferEffectInventory']>[1],
  ) {
    if (!this.ownershipEffectInventory) throw new Error('missing ownership inventory');
    return this.ownershipEffectInventory;
  }
  async revokeOwnershipTransferEffects(
    _scope: AdminDirectoryScope,
    inventory: LockedOwnershipTransferEffectInventory,
  ): Promise<OwnershipTransferEffectReadback> {
    const value: OwnershipTransferEffectReadback = {
      ...scope,
      inventoryId: inventory.inventoryId,
      readbackId: 'ownership-readback-one',
      transferId: inventory.transferId,
      householdId: inventory.householdId,
      outgoingHumanAccountId: inventory.outgoingHumanAccountId,
      replacementHumanAccountId: inventory.replacementHumanAccountId,
      complete: true,
      outgoingSessionIdsRevoked: inventory.outgoingSessions.map(
        (sessionValue) => sessionValue.sessionId,
      ),
      replacementSessionIdsRevoked: inventory.replacementSessions.map(
        (sessionValue) => sessionValue.sessionId,
      ),
      billingSessionIdsRevoked: inventory.billingSessionIds,
      grantIdsRevoked: this.omitOwnershipGrantReadback ? [] : inventory.grantIds,
      setupOrResetTokenIdsInvalidated: inventory.setupOrResetTokenIds,
      effectAuthorityIdsRevoked: inventory.effectAuthorityIds,
      revokedAt: occurredAt,
    };
    this.ownershipEffectReadbacks.push(value);
    return value;
  }
  async saveCredentialReset(
    value: StudentCredentialReset,
    revocation: ActiveAccessRevocationReadback | null,
  ) {
    if (value.kind === 'reset' && value.revocationReadbackId !== revocation?.readbackId) {
      throw new Error('missing exact reset readback');
    }
    this.resets.set(value.resetId, value);
  }
  async saveOwnershipTransfer(
    value: OwnershipTransferAcceptanceResult,
    effects: OwnershipTransferEffectReadback | null,
  ) {
    if (value.disposition === 'applied' && !effects) {
      throw new Error('ownership transfer requires effect readback');
    }
    this.ownershipTransfers.push(value);
  }
  async getReceipt(_scope: AdminDirectoryScope, idempotencyKey: string) {
    return this.receipts.get(idempotencyKey) ?? null;
  }
  async saveReceipt(value: AdminDirectoryReceipt) {
    this.receipts.set(value.idempotencyKey, value);
  }
  async saveAuditEvent(value: AdminDirectoryAuditEvent) {
    if (this.failAudit) throw new Error('injected audit failure');
    this.audits.push(value);
  }

  private snapshot() {
    return {
      adults: new Map(this.adults),
      accounts: new Map(this.accounts),
      households: new Map(this.households),
      students: new Map(this.students),
      enrollments: new Map(this.enrollments),
      acceptances: new Map(this.acceptances),
      resets: new Map(this.resets),
      receipts: new Map(this.receipts),
      audits: [...this.audits],
      ownershipTransfers: [...this.ownershipTransfers],
      pendingOwnershipTransfers: new Map(this.pendingOwnershipTransfers),
      ownershipEffectInventory: this.ownershipEffectInventory,
      ownershipEffectReadbacks: [...this.ownershipEffectReadbacks],
      revocations: [...this.revocations],
    };
  }
  private restore(value: ReturnType<MemoryDirectoryRepository['snapshot']>) {
    Object.assign(this, value);
  }
}

function adultCommand(repository: MemoryDirectoryRepository, mutationRuns: { count: number }) {
  const payload = { operation: 'adult_upsert', email: 'admin@example.test' };
  const adult: AdultIdentity = {
    ...scope,
    adultId: 'adult-admin',
    normalizedEmail: 'admin@example.test',
    displayName: 'Admin',
    state: 'active',
    version: 1,
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
  return {
    actor,
    identity: {
      idempotencyKey: 'adult-create-one',
      requestHash: canonicalAdminDirectoryRequestHash(payload),
      expectedVersion: 1,
      occurredAt,
    },
    operation: 'adult_upsert' as const,
    canonicalPayload: payload,
    mutate: async () => {
      mutationRuns.count += 1;
      expect(await repository.lockAdult(scope, adult.adultId)).toBeNull();
      return {
        resultRef: adult.adultId,
        resultVersion: adult.version,
        adults: [adult],
      };
    },
  };
}

function ownershipFixture(repository: MemoryDirectoryRepository) {
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
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
  const household: AdminHouseholdRecord = {
    ...scope,
    householdId: 'household-one',
    ownerAdultId: 'adult-parent',
    ownerHumanAccountId: 'account-parent',
    classification: 'family',
    displayName: 'Household One',
    seatLimit: 3,
    activeSeatCount: 0,
    state: 'active',
    accessState: 'active',
    schoolSeatAllowance: null,
    version: 1,
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
  repository.pendingOwnershipTransfers.set(transfer.transferId, transfer);
  repository.households.set(household.householdId, household);
  repository.ownershipEffectInventory = ownershipInventory();
  return completeVerifiedOwnershipTransfer({
    actor,
    adminAccount: {
      ...scope,
      humanAccountId: 'account-admin',
      adultId: 'adult-admin',
      memberships: ['admin'],
      state: 'active',
      securityVersion: 1,
      version: 1,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    },
    transfer,
    household,
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
      acceptedAt: occurredAt,
    },
    lockedEffectInventory: repository.ownershipEffectInventory,
    now: new Date(occurredAt),
  });
}

describe('P10 corrected durable Admin directory service', () => {
  it('serializes concurrent commits and replays exactly once after re-login', async () => {
    const repository = new MemoryDirectoryRepository();
    const mutationRuns = { count: 0 };
    const command = adultCommand(repository, mutationRuns);
    const [first, second] = await Promise.all([
      new AdminDirectoryService(repository).commit(command),
      new AdminDirectoryService(repository).commit(command),
    ]);
    const afterRelogin = await new AdminDirectoryService(repository).commit(command);
    expect([first.disposition, second.disposition].sort()).toEqual(['committed', 'replayed']);
    expect(afterRelogin.disposition).toBe('replayed');
    expect(repository.receipts).toHaveLength(1);
    expect(repository.audits).toHaveLength(1);
    expect(mutationRuns.count).toBe(1);
  });

  it('rolls back aggregates, revoke-all effects, audit, and receipt on injected failure', async () => {
    const repository = new MemoryDirectoryRepository();
    repository.failAudit = true;
    const payload = { operation: 'student_credential_reset', studentId: 'student-one' };
    const student: AdminStudentRecord = {
      ...scope,
      studentId: 'student-one',
      householdId: 'household-one',
      relationship: 'dependent',
      selfAdultId: null,
      state: 'active',
      credentialId: 'credential-one',
      immutableHistoryReference: 'history-one',
      displayName: 'Student',
      username: 'student.one',
      credentialVersion: 2,
      credentialState: 'active',
      version: 2,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    };
    await expect(
      new AdminDirectoryService(repository).commit({
        actor,
        identity: {
          idempotencyKey: 'reset-one',
          requestHash: canonicalAdminDirectoryRequestHash(payload),
          expectedVersion: 1,
          occurredAt,
        },
        operation: 'student_credential_reset',
        canonicalPayload: payload,
        mutate: async () => ({
          resultRef: student.studentId,
          resultVersion: student.version,
          students: [student],
          credentialReset: {
            ...scope,
            resetId: 'reset-one',
            kind: 'reset',
            studentId: student.studentId,
            credentialId: student.credentialId,
            replacementCredentialHash: 'argon2id-v1$v=19$protected',
            credentialVersion: 2,
            revocationReadbackId: null,
            discloseExistingPassword: false,
            createdAt: occurredAt,
          },
          revokeAllAccess: [
            {
              subjectType: 'student',
              subjectId: student.studentId,
              reason: 'student_credential_changed',
            },
          ],
        }),
      }),
    ).rejects.toThrow(/injected audit failure/u);
    expect(repository.students).toHaveLength(0);
    expect(repository.resets).toHaveLength(0);
    expect(repository.revocations).toHaveLength(0);
    expect(repository.audits).toHaveLength(0);
    expect(repository.receipts).toHaveLength(0);
  });

  it('rejects incomplete credential and lifecycle batches before persistence', async () => {
    const repository = new MemoryDirectoryRepository();
    const payload = { operation: 'student_credential_reset', studentId: 'student-one' };
    await expect(
      new AdminDirectoryService(repository).commit({
        actor,
        identity: {
          idempotencyKey: 'reset-incomplete',
          requestHash: canonicalAdminDirectoryRequestHash(payload),
          expectedVersion: 1,
          occurredAt,
        },
        operation: 'student_credential_reset',
        canonicalPayload: payload,
        mutate: async () => ({
          resultRef: 'student-one',
          resultVersion: 2,
        }),
      }),
    ).rejects.toThrow(/revoke-all operation/u);
    expect(repository.receipts).toHaveLength(0);
  });

  it('denies non-Admin sessions and request-hash conflicts before writes', async () => {
    const repository = new MemoryDirectoryRepository();
    const payload = { operation: 'student_transition', studentId: 'student-one' };
    const base = {
      actor: {
        ...actor,
        principal: { ...actor.principal, role: 'student', student_id: 'student-one' },
      },
      identity: {
        idempotencyKey: 'student-change-one',
        requestHash: canonicalAdminDirectoryRequestHash(payload),
        expectedVersion: 1,
        occurredAt,
      },
      operation: 'student_transition',
      canonicalPayload: payload,
      mutate: async () => ({ resultRef: 'student-one', resultVersion: 2 }),
    } as const;
    await expect(new AdminDirectoryService(repository).commit(base)).rejects.toThrow(
      /Admin session/u,
    );
    await expect(
      new AdminDirectoryService(repository).commit({
        ...base,
        actor,
        identity: { ...base.identity, requestHash: 'a'.repeat(64) },
      }),
    ).rejects.toThrow(/canonical payload/u);
    expect(repository.receipts).toHaveLength(0);
  });

  it('rejects unrelated acceptance and forged restore enrollment before persistence', async () => {
    const repository = new MemoryDirectoryRepository();
    const owner: AdultIdentity = {
      ...scope,
      adultId: 'adult-parent',
      normalizedEmail: 'parent@example.test',
      displayName: 'Parent',
      state: 'active',
      version: 1,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    };
    const ownerAccount: HumanAccount = {
      ...scope,
      humanAccountId: 'account-parent',
      adultId: owner.adultId,
      memberships: ['parent'],
      state: 'active',
      securityVersion: 1,
      version: 1,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    };
    const currentHousehold: AdminHouseholdRecord = {
      ...scope,
      householdId: 'household-one',
      ownerAdultId: owner.adultId,
      ownerHumanAccountId: ownerAccount.humanAccountId,
      classification: 'family',
      displayName: 'Household',
      seatLimit: 3,
      activeSeatCount: 0,
      state: 'active',
      accessState: 'active',
      schoolSeatAllowance: null,
      version: 2,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    };
    const archivedStudent: AdminStudentRecord = {
      ...scope,
      studentId: 'student-one',
      householdId: currentHousehold.householdId,
      relationship: 'dependent',
      selfAdultId: null,
      state: 'archived',
      credentialId: 'credential-one',
      immutableHistoryReference: 'history-one',
      displayName: 'Student',
      username: 'student.one',
      credentialVersion: 1,
      credentialState: 'disabled',
      version: 2,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    };
    repository.adults.set(owner.adultId, owner);
    repository.accounts.set(ownerAccount.humanAccountId, ownerAccount);
    repository.households.set(currentHousehold.householdId, currentHousehold);
    repository.students.set(archivedStudent.studentId, archivedStudent);
    repository.enrollments.set('enrollment-one', {
      ...scope,
      enrollmentId: 'enrollment-one',
      householdId: currentHousehold.householdId,
      studentId: archivedStudent.studentId,
      serviceAccountAcceptanceId: 'acceptance-old',
      state: 'revoked',
      version: 2,
      updatedAt: occurredAt,
    });
    const unrelatedEvidence: ServiceAccountAcceptanceEvidence = {
      ...scope,
      acceptanceId: 'acceptance-new',
      householdId: currentHousehold.householdId,
      studentId: archivedStudent.studentId,
      acceptedByAdultId: 'adult-unrelated',
      acceptedServiceAccountVersion: 'service-account-v3',
      canonicalRequestHash: 'b'.repeat(64),
      immutableEvidenceReference: 'evidence-new',
      acceptedAt: occurredAt,
    };
    const activeStudent = {
      ...archivedStudent,
      state: 'active' as const,
      credentialState: 'active' as const,
      credentialVersion: 2,
      version: 3,
    };
    const restoredEnrollment: CanonicalStudentEnrollment = {
      ...scope,
      enrollmentId: 'enrollment-one',
      householdId: currentHousehold.householdId,
      studentId: activeStudent.studentId,
      serviceAccountAcceptanceId: unrelatedEvidence.acceptanceId,
      state: 'active',
      version: 3,
      updatedAt: occurredAt,
    };
    const canonicalPayload = { operation: 'student_transition', studentId: 'student-one' };
    const baseMutation = {
      resultRef: activeStudent.studentId,
      resultVersion: activeStudent.version,
      students: [activeStudent],
      households: [
        {
          ...currentHousehold,
          activeSeatCount: 1,
          version: 3,
        },
      ],
      serviceAccountAcceptances: [unrelatedEvidence],
      enrollments: [restoredEnrollment],
      credentialReset: {
        ...scope,
        resetId: 'reset-restore',
        kind: 'reset' as const,
        studentId: activeStudent.studentId,
        credentialId: activeStudent.credentialId,
        replacementCredentialHash: 'argon2id-v1$v=19$protected',
        credentialVersion: 2,
        revocationReadbackId: null,
        discloseExistingPassword: false as const,
        createdAt: occurredAt,
      },
      revokeAllAccess: [
        {
          subjectType: 'student' as const,
          subjectId: activeStudent.studentId,
          reason: 'student_credential_changed' as const,
        },
      ],
    };
    await expect(
      new AdminDirectoryService(repository).commit({
        actor,
        identity: {
          idempotencyKey: 'restore-unrelated',
          requestHash: canonicalAdminDirectoryRequestHash(canonicalPayload),
          expectedVersion: 2,
          occurredAt,
        },
        operation: 'student_transition',
        canonicalPayload,
        mutate: async () => baseMutation,
      }),
    ).rejects.toThrow(/acceptance/u);
    const ownerEvidence = { ...unrelatedEvidence, acceptedByAdultId: owner.adultId };
    await expect(
      new AdminDirectoryService(repository).commit({
        actor,
        identity: {
          idempotencyKey: 'restore-forged-enrollment',
          requestHash: canonicalAdminDirectoryRequestHash(canonicalPayload),
          expectedVersion: 2,
          occurredAt,
        },
        operation: 'student_transition',
        canonicalPayload,
        mutate: async () => ({
          ...baseMutation,
          serviceAccountAcceptances: [ownerEvidence],
          enrollments: [
            {
              ...restoredEnrollment,
              enrollmentId: 'enrollment-forged',
              serviceAccountAcceptanceId: ownerEvidence.acceptanceId,
            },
          ],
        }),
      }),
    ).rejects.toThrow(/exact locked revoked enrollment/u);
    expect(repository.students.get(archivedStudent.studentId)).toEqual(archivedStudent);
    expect(repository.ownershipTransfers).toHaveLength(0);
    expect(repository.receipts).toHaveLength(0);
  });

  it('rejects caller ownership subsets and incomplete effect readback atomically', async () => {
    const repository = new MemoryDirectoryRepository();
    const result = ownershipFixture(repository);
    if (result.disposition !== 'applied') throw new Error('expected applied transfer');
    const canonicalPayload = { operation: 'ownership_transfer', transferId: 'transfer-one' };
    const command = {
      actor,
      identity: {
        idempotencyKey: 'ownership-commit-one',
        requestHash: canonicalAdminDirectoryRequestHash(canonicalPayload),
        expectedVersion: 1,
        occurredAt,
      },
      operation: 'ownership_transfer' as const,
      canonicalPayload,
    };
    await expect(
      new AdminDirectoryService(repository).commit({
        ...command,
        mutate: async () => ({
          resultRef: result.transfer.transferId,
          resultVersion: result.transfer.version,
          ownershipTransfer: {
            ...result,
            outgoingSessionIdsRevoked: [],
          },
        }),
      }),
    ).rejects.toThrow(/caller-supplied subset/u);
    expect(repository.ownershipEffectReadbacks).toHaveLength(0);
    expect(repository.ownershipTransfers).toHaveLength(0);
    repository.omitOwnershipGrantReadback = true;
    await expect(
      new AdminDirectoryService(repository).commit({
        ...command,
        identity: { ...command.identity, idempotencyKey: 'ownership-commit-two' },
        mutate: async () => ({
          resultRef: result.transfer.transferId,
          resultVersion: result.transfer.version,
          ownershipTransfer: result,
        }),
      }),
    ).rejects.toThrow(/complete exact atomic revocation readback/u);
    expect(repository.ownershipEffectReadbacks).toHaveLength(0);
    expect(repository.ownershipTransfers).toHaveLength(0);
    expect(repository.receipts).toHaveLength(0);
    repository.omitOwnershipGrantReadback = false;
    await expect(
      new AdminDirectoryService(repository).commit({
        ...command,
        identity: { ...command.identity, idempotencyKey: 'ownership-commit-three' },
        mutate: async () => ({
          resultRef: result.transfer.transferId,
          resultVersion: result.transfer.version,
          ownershipTransfer: result,
        }),
      }),
    ).resolves.toMatchObject({ disposition: 'committed' });
    expect(repository.ownershipEffectReadbacks).toHaveLength(1);
    expect(repository.ownershipTransfers).toHaveLength(1);
    expect(repository.receipts).toHaveLength(1);
  });
});
