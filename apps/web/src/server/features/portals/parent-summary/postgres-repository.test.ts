import { describe, expect, it, vi } from 'vitest';
import type { DbPool } from '../../../../../../../packages/db/src/index.ts';
import { createPostgresParentSummaryRepository } from './postgres-repository.ts';

describe('P13 PostgreSQL Parent summary repository', () => {
  it('projects only household-safe schedule, attendance, badges, and announcements', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            household_id: 'household-1',
            owner_adult_id: 'adult-1',
            product_key: 'one_time_mishnayos',
            runtime_tier: 'production',
            verification_environment_id: 'production_operator_canary',
            owner_display_name: 'Parent One',
          },
        ],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ student_id: 'student-1', display_name: 'Student One', state: 'active' }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            schedule_id: 'occurrence-1',
            student_id: 'student-1',
            title: 'Daily One Time Mishnayos',
            starts_at: '2026-08-16T16:00:00.000Z',
            ends_at: '2026-08-16T17:00:00.000Z',
            status: 'upcoming',
          },
        ],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            student_id: 'student-1',
            scheduled_sessions: 8,
            attended_sessions: 7,
            current_streak: 3,
          },
        ],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            student_id: 'student-1',
            badge_id: 'consistency:I',
            label: 'Consistency I',
            awarded_at: '2026-08-01T10:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            update_id: 'notice-1',
            title: 'Class update',
            summary: 'Class begins at 7:00 PM Jerusalem time.',
            published_at: '2026-08-05T10:00:00.000Z',
          },
        ],
      });
    const pool = { query } as unknown as DbPool;
    const repository = createPostgresParentSummaryRepository(pool, {
      accountKey: 'one_time',
      clock: () => new Date('2026-08-05T12:00:00.000Z'),
    });

    const summary = await repository.loadParentSummary('household-1');

    expect(summary).toMatchObject({
      household_id: 'household-1',
      owner_adult_id: 'adult-1',
      display_name: 'Parent One household',
      students: [{ student_id: 'student-1', state: 'active' }],
      schedule: [{ schedule_id: 'occurrence-1', status: 'upcoming' }],
      progress: [
        {
          student_id: 'student-1',
          attendance: {
            attended_sessions: 7,
            scheduled_sessions: 8,
            attendance_percent: 88,
            current_streak: 3,
          },
          badges: [{ badge_id: 'consistency:I' }],
        },
      ],
      updates: [{ update_id: 'notice-1', kind: 'notice' }],
    });
    expect(JSON.stringify(summary)).not.toMatch(
      /join_url|recording|private_question|rabbi_answer/i,
    );
    expect(query).toHaveBeenCalledTimes(6);
  });

  it('returns null before reading scoped children when the household is unavailable', async () => {
    const query = vi.fn(async () => ({ rowCount: 0, rows: [] }));
    const repository = createPostgresParentSummaryRepository({ query } as unknown as DbPool, {
      accountKey: 'one_time',
    });

    await expect(repository.loadParentSummary('missing')).resolves.toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
  });
});
