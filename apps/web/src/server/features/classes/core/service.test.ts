import { describe, expect, it } from 'vitest';
import {
  CANONICAL_CLASS_SERIES_ID,
  type ClassroomCommandReceipt,
  type ClassroomCoreRepository,
  type ClassroomCoreUnitOfWork,
  type SeriesEnrollmentRecord,
  type StudentEligibilityRecord,
} from '../../../../../../../packages/contracts/src/classes/core/index.ts';
import { createClassroomCoreService } from './service.ts';

type State = {
  student: StudentEligibilityRecord;
  enrollment?: SeriesEnrollmentRecord;
  receipts: ClassroomCommandReceipt[];
};

const original: State = {
  student: {
    accountKey: 'account-1',
    productKey: 'one-time',
    studentId: 'student-1',
    householdId: 'household-1',
    state: 'archived',
    version: 1,
  },
  receipts: [],
};

function transactionalRepository(state: State, failEnrollment = false): ClassroomCoreRepository {
  return {
    inTransaction: async (run) => {
      const working = structuredClone(state);
      const unit: ClassroomCoreUnitOfWork = {
        getSeries: async () => null,
        saveSeries: async () => undefined,
        getOccurrence: async () => null,
        saveOccurrence: async () => undefined,
        getStudent: async (_scope, studentId) =>
          working.student.studentId === studentId ? working.student : null,
        saveStudent: async (student) => {
          working.student = student;
        },
        getEnrollment: async (_scope, seriesId, studentId) =>
          working.enrollment?.seriesId === seriesId && working.enrollment.studentId === studentId
            ? working.enrollment
            : null,
        saveEnrollment: async (enrollment) => {
          if (failEnrollment) throw new Error('injected between eligibility and enrollment');
          working.enrollment = enrollment;
        },
        getReceipt: async (_scope, key) =>
          working.receipts.find((receipt) => receipt.idempotencyKey === key) ?? null,
        saveReceipt: async (receipt) => {
          working.receipts.push(receipt);
        },
      };
      const result = await run(unit);
      state.student = working.student;
      if (working.enrollment) state.enrollment = working.enrollment;
      else delete state.enrollment;
      state.receipts = working.receipts;
      return result;
    },
  };
}

function command() {
  return {
    scope: { accountKey: 'account-1', productKey: 'one-time' },
    studentId: 'student-1',
    householdId: 'household-1',
    action: 'restore' as const,
    idempotencyKey: 'restore-student-1',
    requestHash: 'hash-restore-student-1',
    auditRef: 'audit-restore-student-1',
    occurredAt: '2026-07-28T20:00:00.000Z',
  };
}

describe('P16 atomic Student lifecycle and canonical enrollment service', () => {
  it('OTV2-CLASSROOM-235 rolls back both writes when enrollment persistence fails', async () => {
    const state = structuredClone(original);
    const service = createClassroomCoreService(transactionalRepository(state, true));
    await expect(service.applyStudentLifecycle(command())).rejects.toThrow(/injected/);
    expect(state.student).toEqual(original.student);
    expect(state.enrollment).toBeUndefined();
    expect(state.receipts).toEqual([]);
  });

  it('OTV2-CLASSROOM-067 commits exactly one canonical enrollment and replays without writes', async () => {
    const state = structuredClone(original);
    const service = createClassroomCoreService(transactionalRepository(state));
    const first = await service.applyStudentLifecycle(command());
    expect(first.snapshot.student.state).toBe('active');
    expect(state.enrollment).toMatchObject({
      seriesId: CANONICAL_CLASS_SERIES_ID,
      studentId: 'student-1',
      state: 'active',
    });
    expect(state.receipts).toHaveLength(1);

    const replay = await service.applyStudentLifecycle(command());
    expect(replay.replay).toBe(true);
    expect(state.receipts).toHaveLength(1);
    expect(state.enrollment?.version).toBe(1);
  });

  it('OTV2-CLASSROOM-235 composes a freshly staged F04 Student in the same unit of work', async () => {
    const state = structuredClone(original);
    const service = createClassroomCoreService(transactionalRepository(state));
    const stagedStudent: StudentEligibilityRecord = {
      ...state.student,
      state: 'archived',
      version: 0,
    };
    const result = await service.applyStudentLifecycle(
      { ...command(), action: 'activate', idempotencyKey: 'fresh-student-1' },
      stagedStudent,
    );
    expect(result.snapshot.student).toMatchObject({ state: 'active', version: 1 });
    expect(state.enrollment).toMatchObject({
      seriesId: CANONICAL_CLASS_SERIES_ID,
      studentId: stagedStudent.studentId,
      state: 'active',
    });
  });
});
