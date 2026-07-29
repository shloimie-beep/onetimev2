import { describe, expect, it } from 'vitest';
import type {
  AdminDirectoryAuditEvent,
  AdminDirectoryReceipt,
  AdminDirectoryRepository,
  AdminDirectoryScope,
  AdminDirectoryUnitOfWork,
  AdminStudentRecord,
  StudentCredentialReset,
} from '../../../../../../../packages/contracts/src/admin/directory/index.ts';
import type {
  AdultIdentity,
  Household,
  HouseholdOwnershipTransfer,
  HumanAccount,
  OwnershipTransferAcceptanceResult,
} from '../../../../../../../packages/contracts/src/accounts/v21-household-identity.ts';
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

class MemoryDirectoryRepository implements AdminDirectoryRepository, AdminDirectoryUnitOfWork {
  adults = new Map<string, AdultIdentity>();
  accounts = new Map<string, HumanAccount>();
  households = new Map<string, Household>();
  students = new Map<string, AdminStudentRecord>();
  resets = new Map<string, StudentCredentialReset>();
  receipts = new Map<string, AdminDirectoryReceipt>();
  audits: AdminDirectoryAuditEvent[] = [];
  ownershipTransfers: OwnershipTransferAcceptanceResult[] = [];

  async inTransaction<T>(run: (unit: AdminDirectoryUnitOfWork) => Promise<T>) {
    return run(this);
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
  async saveHousehold(value: Household) {
    this.households.set(value.householdId, value);
  }
  async lockStudent(_scope: AdminDirectoryScope, studentId: string) {
    return this.students.get(studentId) ?? null;
  }
  async saveStudent(value: AdminStudentRecord) {
    this.students.set(value.studentId, value);
  }
  async lockOwnershipTransfer(
    _scope: AdminDirectoryScope,
    _transferId: string,
  ): Promise<HouseholdOwnershipTransfer | null> {
    return null;
  }
  async saveCredentialReset(value: StudentCredentialReset) {
    this.resets.set(value.resetId, value);
  }
  async saveOwnershipTransfer(value: OwnershipTransferAcceptanceResult) {
    this.ownershipTransfers.push(value);
  }
  async getReceipt(_scope: AdminDirectoryScope, idempotencyKey: string) {
    return this.receipts.get(idempotencyKey) ?? null;
  }
  async saveReceipt(value: AdminDirectoryReceipt) {
    this.receipts.set(value.idempotencyKey, value);
  }
  async saveAuditEvent(value: AdminDirectoryAuditEvent) {
    this.audits.push(value);
  }
}

describe('P10 durable Admin directory service', () => {
  it('OTV2-ADMIN-030 commits once and replays after a refresh or re-login', async () => {
    const repository = new MemoryDirectoryRepository();
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
    let mutationRuns = 0;
    const command = {
      actor,
      identity: {
        idempotencyKey: 'adult-create-one',
        requestHash: canonicalAdminDirectoryRequestHash(payload),
        expectedVersion: 1,
        occurredAt,
      },
      operation: 'adult_upsert',
      canonicalPayload: payload,
      mutate: async () => {
        mutationRuns += 1;
        return {
          resultRef: adult.adultId,
          resultVersion: adult.version,
          adults: [adult],
        };
      },
    } as const;

    const committed = await new AdminDirectoryService(repository).commit(command);
    const afterRelogin = await new AdminDirectoryService(repository).commit(command);
    expect(committed.disposition).toBe('committed');
    expect(afterRelogin.disposition).toBe('replayed');
    expect(repository.adults.get('adult-admin')).toEqual(adult);
    expect(repository.receipts).toHaveLength(1);
    expect(repository.audits).toHaveLength(1);
    expect(mutationRuns).toBe(1);
  });

  it('denies non-Admin sessions and canonical request-hash conflicts before writes', async () => {
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
});
