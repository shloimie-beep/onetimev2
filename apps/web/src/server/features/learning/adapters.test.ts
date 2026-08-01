import { describe, expect, it, vi } from 'vitest';
import type { DbPool } from '../../../../../../packages/db/src/index.ts';
import {
  createLearningAttendanceProjectionChangePort,
  createPostgresLearningActorResolver,
} from './adapters.ts';

const scope = {
  accountKey: 'account-1',
  productKey: 'one_time_mishnayos',
  runtimeTier: 'isolated_staging',
  verificationEnvironmentId: 'ci',
};

describe('P22 learning adapters', () => {
  it('derives the Student, household, and authorized classes from session and roster readback', async () => {
    const query = vi.fn(async (_sql: string, _values?: readonly unknown[]) => ({
      rows: [
        { student_id: 'student-1', household_id: 'household-1', class_series_key: 'class-b' },
        { student_id: 'student-1', household_id: 'household-1', class_series_key: 'class-a' },
      ],
      rowCount: 2,
    }));
    const resolve = createPostgresLearningActorResolver({
      pool: { query } as unknown as DbPool,
      scope,
      resolveSession: async () => ({
        sessionKey: 'session-1',
        principalId: 'login-1',
        role: 'student',
      }),
    });

    await expect(resolve({ body: { student_id: 'forged' } } as never)).resolves.toEqual({
      sessionKey: 'session-1',
      actor: {
        ...scope,
        role: 'student',
        principalId: 'login-1',
        studentId: 'student-1',
        householdId: 'household-1',
        classIds: ['class-a', 'class-b'],
      },
    });
    expect(query.mock.calls[0]?.[1]).toEqual([
      'account-1',
      'one_time_mishnayos',
      'login-1',
      'isolated_staging',
      'ci',
    ]);
  });

  it('uses internal canonical context for an ordinary P18 projection change', async () => {
    const recalculate = vi.fn(async () => []);
    const pool = {
      query: vi.fn(async () => ({
        rows: [{ class_series_key: 'class-a', correction_admin_id: null }],
        rowCount: 1,
      })),
    } as unknown as DbPool;
    const port = createLearningAttendanceProjectionChangePort({
      pool,
      scope,
      service: { recalculateBadgesAfterAttendanceProjectionChange: recalculate } as never,
    });

    await port.onAttendanceProjectionChange({
      scope: {
        product: 'one_time_mishnayos',
        runtime_tier: 'isolated_staging',
        verification_environment_id: 'ci',
      },
      occurrence_id: 'occurrence-1',
      student_id: 'student-1',
      source_attendance_event_id: 'event-1',
      source_event_ref_digest: 'a'.repeat(64),
      correction_audit_ref: null,
      correction_reason: null,
      correction_admin_id: null,
    });

    expect(recalculate).toHaveBeenCalledWith(
      { ...scope, kind: 'canonical_attendance_projection_change', classId: 'class-a' },
      'student-1',
      'class-a',
    );
  });
});
