import { describe, expect, it } from 'vitest';
import type {
  ClassOccurrenceRecord,
  ClassSeriesRecord,
} from '../../../packages/contracts/src/classes/core/index.ts';
import type { DbPool } from '../../../packages/db/src/index.ts';
import { createClassroomCoreRepository } from '../../../packages/db/src/classes/core/repository.ts';

type QueryCall = {
  sql: string;
  values?: readonly unknown[];
};

function recordingPool(rowsForSql: (sql: string) => Record<string, unknown>[] = () => []) {
  const calls: QueryCall[] = [];
  const client = {
    query: async (sql: string, values?: readonly unknown[]) => {
      calls.push({ sql, ...(values ? { values } : {}) });
      return {
        rows: rowsForSql(sql),
        rowCount: sql.includes('UPDATE onetime.class_occurrences') ? 0 : 1,
      };
    },
    release: () => undefined,
  };
  const pool = {
    connect: async () => client,
    query: client.query,
    end: async () => undefined,
  } as unknown as DbPool;
  return { calls, pool };
}

function series(localStartTime = '19:00'): ClassSeriesRecord {
  return {
    accountKey: 'account-1',
    productKey: 'one-time',
    id: 'series-1',
    title: 'Class series',
    state: 'active',
    canonical: false,
    timeZone: 'Asia/Jerusalem',
    localStartTime,
    durationMinutes: 60,
    weekdays: [0, 2, 4],
    startsOn: '2026-08-02',
    teacherProfileId: 'teacher-1',
    embeddedClassroomRequired: true,
    recordingEnabled: false,
    version: 1,
    createdAt: '2026-07-28T20:00:00.000Z',
    updatedAt: '2026-07-28T20:00:00.000Z',
  };
}

function occurrence(): ClassOccurrenceRecord {
  return {
    accountKey: 'account-1',
    productKey: 'one-time',
    id: 'occurrence-1',
    seriesId: 'series-1',
    localClassDate: '2026-08-02',
    startsAt: '2026-08-02T16:00:00.000Z',
    scheduledEndsAt: '2026-08-02T17:00:00.000Z',
    joinOpensAt: '2026-08-02T15:50:00.000Z',
    joinClosesAt: '2026-08-02T17:15:00.000Z',
    state: 'scheduled',
    scheduleVersion: 1,
    version: 1,
    createdAt: '2026-07-28T20:00:00.000Z',
    updatedAt: '2026-07-28T20:00:00.000Z',
  };
}

function databaseSeriesRow(recurrenceWeekdays: number[]) {
  return {
    account_key: 'account-1',
    product_key: 'one-time',
    class_series_key: 'series-1',
    title: 'Class series',
    series_state: 'active',
    is_canonical: true,
    timezone: 'Asia/Jerusalem',
    local_start_time: '19:00:00',
    duration_minutes: 60,
    recurrence_weekdays: recurrenceWeekdays,
    recurrence_starts_on: '2026-08-02',
    teacher_profile_key: 'teacher-1',
    embedded_classroom_required: true,
    recording_enabled: false,
    version: 1,
    created_at: '2026-07-28T20:00:00.000Z',
    updated_at: '2026-07-28T20:00:00.000Z',
  };
}

describe('classroom core repository schedule compatibility', () => {
  it('persists a non-null series reminder derived from the local class time', async () => {
    const { calls, pool } = recordingPool();
    const repository = createClassroomCoreRepository(pool);

    await repository.inTransaction((unit) => unit.saveSeries(series('00:15')));

    const insert = calls.find((call) => call.sql.includes('INSERT INTO onetime.class_series'));
    expect(insert?.sql).toContain('reminder_local_time');
    expect(insert?.sql).toContain('reminder_local_time = EXCLUDED.reminder_local_time');
    expect(insert?.values?.[18]).toBe('23:45');
  });

  it('encodes canonical public weekdays to ISO database weekdays without reordering', async () => {
    const { calls, pool } = recordingPool();
    const repository = createClassroomCoreRepository(pool);

    await repository.inTransaction((unit) =>
      unit.saveSeries({ ...series(), weekdays: [0, 1, 2, 3, 4] }),
    );

    const insert = calls.find((call) => call.sql.includes('INSERT INTO onetime.class_series'));
    expect(insert?.values?.[9]).toEqual([7, 1, 2, 3, 4]);
  });

  it('decodes ISO database weekdays to public weekdays without reordering', async () => {
    const { pool } = recordingPool((sql) =>
      sql.includes('FROM onetime.class_series') ? [databaseSeriesRow([7, 1, 2, 3, 4])] : [],
    );
    const repository = createClassroomCoreRepository(pool);

    const stored = await repository.inTransaction((unit) =>
      unit.getSeries({ accountKey: 'account-1', productKey: 'one-time' }, 'series-1'),
    );

    expect(stored?.weekdays).toEqual([0, 1, 2, 3, 4]);
  });

  it.each([
    ['absent', undefined, 'must be an array'],
    ['non-array', '0,1,2', 'must be an array'],
    ['empty', [], 'at least one weekday'],
    ['non-integer', [0, 1.5], 'only integers from 0 through 6'],
    ['out-of-range', [0, 7], 'only integers from 0 through 6'],
    ['duplicate', [0, 1, 0], 'must not contain duplicate weekdays'],
  ])('rejects %s public weekdays before series persistence', async (_case, weekdays, message) => {
    const { calls, pool } = recordingPool();
    const repository = createClassroomCoreRepository(pool);
    const invalidSeries = {
      ...series(),
      weekdays,
    } as unknown as ClassSeriesRecord;

    await expect(
      repository.inTransaction((unit) => unit.saveSeries(invalidSeries)),
    ).rejects.toThrow(message);
    expect(calls.some((call) => call.sql.includes('INSERT INTO onetime.class_series'))).toBe(false);
  });

  it('persists occurrence reminder and joinable boundary derived from occurrence timing', async () => {
    const { calls, pool } = recordingPool();
    const repository = createClassroomCoreRepository(pool);

    await repository.inTransaction((unit) => unit.saveOccurrence(occurrence()));

    const update = calls.find((call) => call.sql.includes('UPDATE onetime.class_occurrences'));
    const insert = calls.find((call) => call.sql.includes('INSERT INTO onetime.class_occurrences'));
    expect(update?.sql).toContain('reminder_due_at = $14');
    expect(update?.sql).toContain('joinable_until = $15');
    expect(insert?.sql).toContain('reminder_due_at, joinable_until');
    expect(insert?.values?.[14]).toBe('2026-08-02T15:30:00.000Z');
    expect(insert?.values?.[15]).toBe('2026-08-02T17:15:00.000Z');
  });

  it('rejects an absent series scheduling boundary before persistence', async () => {
    const { calls, pool } = recordingPool();
    const repository = createClassroomCoreRepository(pool);
    const missingLocalStartTime = {
      ...series(),
      localStartTime: undefined,
    } as unknown as ClassSeriesRecord;

    await expect(
      repository.inTransaction((unit) => unit.saveSeries(missingLocalStartTime)),
    ).rejects.toThrow('valid HH:mm');
    expect(calls.some((call) => call.sql.includes('INSERT INTO onetime.class_series'))).toBe(false);
  });

  it('rejects an invalid occurrence timing boundary before persistence', async () => {
    const { calls, pool } = recordingPool();
    const repository = createClassroomCoreRepository(pool);
    const invalidJoinClose = {
      ...occurrence(),
      joinClosesAt: 'not-an-instant',
    };

    await expect(
      repository.inTransaction((unit) => unit.saveOccurrence(invalidJoinClose)),
    ).rejects.toThrow('joinClosesAt must be a valid timestamp');
    expect(calls.some((call) => call.sql.includes('onetime.class_occurrences'))).toBe(false);
  });
});
