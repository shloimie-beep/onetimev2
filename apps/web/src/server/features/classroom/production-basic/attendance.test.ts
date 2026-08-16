import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type {
  AttendanceEvent,
  AttendanceProjection,
  EmbeddedClassroomRepository,
} from '../../../../../../../packages/contracts/src/classroom/embedded/index.ts';
import {
  createMemoryPool,
  runMigrations,
  type DbPool,
} from '../../../../../../../packages/db/src/index.ts';
import {
  createPostgresProductionBasicAttendanceSessionRepository,
  createPostgresProductionBasicStudentAttendance,
  createProductionBasicStudentAttendance,
  type ProductionBasicAttendanceSession,
  type ProductionBasicAttendanceSessionRepository,
} from './attendance.ts';
import type { ProductionBasicActor } from './service.ts';

const SCOPE = {
  product: 'one_time_mishnayos' as const,
  runtime_tier: 'production' as const,
  verification_environment_id: 'production_operator_canary' as const,
};
const ACTOR: Extract<ProductionBasicActor, { kind: 'student' }> = {
  kind: 'student',
  scope: { account_key: 'one_time', product_key: 'one_time_mishnayos' },
  learner_key: 'learner-derived',
  authenticated_session_key: 'session-derived',
  connection_lineage_id: 'a'.repeat(64),
  display_name: 'Student',
  entitled: true,
};
const MEETING_DIGEST = 'b'.repeat(64);
const ATTENDANCE_SESSION_KEY = 'production-basic-attendance-derived';
const ATTENDANCE_SESSION_DIGEST = createHash('sha256')
  .update('production-basic-attendance-session-v1\0')
  .update(ATTENDANCE_SESSION_KEY)
  .digest('hex');

describe('production-basic occurrence attendance', () => {
  it('issues an opaque session only from the current canonical live occurrence and entitlement', async () => {
    const query = vi.fn().mockResolvedValue({
      rowCount: 1,
      rows: [{ attendance_session_key_digest: ATTENDANCE_SESSION_DIGEST }],
    });
    const sessions = createPostgresProductionBasicAttendanceSessionRepository({
      pool: { query } as unknown as DbPool,
      allocate_session_key: () => ATTENDANCE_SESSION_KEY,
    });
    const issuedAt = new Date('2026-08-16T16:01:00.000Z');

    await expect(
      sessions.issue({
        actor: ACTOR,
        scope: SCOPE,
        meeting_ref_digest: MEETING_DIGEST,
        issued_at: issuedAt,
      }),
    ).resolves.toBe(ATTENDANCE_SESSION_KEY);

    const [sql, parameters] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO onetime.production_basic_attendance_sessions');
    expect(sql).toContain('attendance_session_key_digest');
    expect(sql).toContain("entitlement.entitlement_state = 'active'");
    expect(sql).toContain("learner.learner_status = 'active'");
    expect(sql).toContain('series.is_canonical = true');
    expect(sql).toContain('occurrence.production_basic_meeting_ref_digest = $9');
    expect(sql).toContain('occurrence.production_basic_live_expires_at > $10');
    expect(sql).not.toMatch(/participant|display_name|user-agent/iu);
    expect(parameters).toEqual([
      ATTENDANCE_SESSION_DIGEST,
      ACTOR.scope.account_key,
      ACTOR.scope.product_key,
      SCOPE.runtime_tier,
      SCOPE.verification_environment_id,
      ACTOR.learner_key,
      ACTOR.authenticated_session_key,
      expect.stringMatching(/^[a-f0-9]{64}$/u),
      MEETING_DIGEST,
      issuedAt,
      new Date('2026-08-16T20:01:00.000Z'),
    ]);
  });

  it('reconciles retry-safe join and leave evidence into one occurrence projection', async () => {
    const session = attendanceSession();
    const sessions: ProductionBasicAttendanceSessionRepository = {
      issue: vi.fn(async () => ATTENDANCE_SESSION_KEY),
      bindEvent: vi.fn(async ({ event_kind }) => ({
        ...session,
        joined_observed_at: '2026-08-16T16:05:00.000Z',
        left_observed_at: event_kind === 'left' ? '2026-08-16T16:50:00.000Z' : null,
      })),
    };
    const evidence: { events: AttendanceEvent[]; projection: AttendanceProjection | null } = {
      events: [],
      projection: null,
    };
    const attendance = fakeAttendanceRepository(evidence);
    const recorder = createProductionBasicStudentAttendance({ sessions, attendance, scope: SCOPE });

    await expect(
      recorder.record({
        actor: ACTOR,
        meeting_ref_digest: MEETING_DIGEST,
        attendance_session_key: ATTENDANCE_SESSION_KEY,
        event_kind: 'joined',
        observed_at: new Date('2026-08-16T16:05:00.000Z'),
      }),
    ).resolves.toBe(true);
    await expect(
      recorder.record({
        actor: ACTOR,
        meeting_ref_digest: MEETING_DIGEST,
        attendance_session_key: ATTENDANCE_SESSION_KEY,
        event_kind: 'left',
        observed_at: new Date('2026-08-16T16:50:00.000Z'),
      }),
    ).resolves.toBe(true);
    await expect(
      recorder.record({
        actor: ACTOR,
        meeting_ref_digest: MEETING_DIGEST,
        attendance_session_key: ATTENDANCE_SESSION_KEY,
        event_kind: 'left',
        observed_at: new Date('2026-08-16T16:55:00.000Z'),
      }),
    ).resolves.toBe(true);

    expect(evidence.events).toHaveLength(2);
    expect(evidence.events.map((event) => event.event_kind)).toEqual(['joined', 'left']);
    expect(new Set(evidence.events.map((event) => event.idempotency_key)).size).toBe(2);
    expect(evidence.events.every((event) => event.source === 'embedded_client')).toBe(true);
    expect(evidence.projection).toMatchObject({
      occurrence_id: 'occurrence-derived',
      student_id: ACTOR.learner_key,
      first_joined_at: '2026-08-16T16:05:00.000Z',
      last_left_at: '2026-08-16T16:50:00.000Z',
      total_connected_minutes: 45,
      attendance_percentage: 75,
      reconciliation_state: 'provisional',
      source_event_count: 2,
    });
  });

  it('fails closed before writing attendance when the opaque session does not bind the actor', async () => {
    const sessions: ProductionBasicAttendanceSessionRepository = {
      issue: vi.fn(async () => null),
      bindEvent: vi.fn(async () => null),
    };
    const attendance = fakeAttendanceRepository({ events: [], projection: null });
    const recorder = createProductionBasicStudentAttendance({ sessions, attendance, scope: SCOPE });
    await expect(
      recorder.record({
        actor: ACTOR,
        meeting_ref_digest: MEETING_DIGEST,
        attendance_session_key: 'production-basic-attendance-other',
        event_kind: 'joined',
        observed_at: new Date('2026-08-16T16:05:00.000Z'),
      }),
    ).resolves.toBe(false);
    expect(attendance.loadAttendanceEvidence).not.toHaveBeenCalled();
    expect(attendance.appendAttendance).not.toHaveBeenCalled();
  });

  it('persists join and leave through the applied PostgreSQL-shaped schema', async () => {
    const pool = createMemoryPool();
    try {
      await runMigrations(pool);
      await seedProductionBasicAttendanceSubject(pool);
      const onAttendanceProjectionChange = vi.fn(async () => undefined);
      const recorder = createPostgresProductionBasicStudentAttendance({
        pool,
        attendance_projection_changes: { onAttendanceProjectionChange },
        scope: SCOPE,
      });
      const attendanceSessionKey = await recorder.issue({
        actor: ACTOR,
        meeting_ref_digest: MEETING_DIGEST,
        issued_at: new Date('2026-08-16T16:01:00.000Z'),
      });
      expect(attendanceSessionKey).toMatch(/^production-basic-attendance-/u);

      for (const [eventKind, observedAt] of [
        ['joined', '2026-08-16T16:05:00.000Z'],
        ['left', '2026-08-16T16:50:00.000Z'],
      ] as const) {
        await expect(
          recorder.record({
            actor: ACTOR,
            meeting_ref_digest: MEETING_DIGEST,
            attendance_session_key: attendanceSessionKey!,
            event_kind: eventKind,
            observed_at: new Date(observedAt),
          }),
        ).resolves.toBe(true);
      }

      const sessions = await pool.query(
        `SELECT attendance_session_key_digest, joined_observed_at, left_observed_at
             FROM onetime.production_basic_attendance_sessions`,
      );
      expect(sessions.rows).toEqual([
        expect.objectContaining({
          attendance_session_key_digest: createHash('sha256')
            .update('production-basic-attendance-session-v1\0')
            .update(attendanceSessionKey!)
            .digest('hex'),
          joined_observed_at: new Date('2026-08-16T16:05:00.000Z'),
          left_observed_at: new Date('2026-08-16T16:50:00.000Z'),
        }),
      ]);
      const events = await pool.query(
        `SELECT source, event_kind, observed_at, provider_verified
             FROM onetime.classroom_attendance_events_v21
            ORDER BY observed_at`,
      );
      expect(events.rows).toEqual([
        {
          source: 'embedded_client',
          event_kind: 'joined',
          observed_at: new Date('2026-08-16T16:05:00.000Z'),
          provider_verified: false,
        },
        {
          source: 'embedded_client',
          event_kind: 'left',
          observed_at: new Date('2026-08-16T16:50:00.000Z'),
          provider_verified: false,
        },
      ]);
      const projection = await pool.query(
        `SELECT occurrence_id, student_id, total_connected_minutes,
                  attendance_percentage, reconciliation_state, source_event_count
             FROM onetime.classroom_attendance_projection_v21`,
      );
      expect(projection.rows).toEqual([
        expect.objectContaining({
          occurrence_id: 'occurrence-derived',
          student_id: ACTOR.learner_key,
          total_connected_minutes: 45,
          attendance_percentage: 75,
          reconciliation_state: 'provisional',
          source_event_count: 2,
        }),
      ]);
      expect(onAttendanceProjectionChange).toHaveBeenCalledTimes(2);
    } finally {
      await pool.end();
    }
  }, 20_000);
});

async function seedProductionBasicAttendanceSubject(pool: DbPool) {
  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name)
     VALUES ('household-derived', $1, $2, 'Derived Family')`,
    [ACTOR.scope.account_key, ACTOR.scope.product_key],
  );
  await pool.query(
    `INSERT INTO onetime.portal_learners
       (learner_key, account_key, product_key, household_key, display_name)
     VALUES ($1, $2, $3, 'household-derived', 'Derived Student')`,
    [ACTOR.learner_key, ACTOR.scope.account_key, ACTOR.scope.product_key],
  );
  await pool.query(
    `INSERT INTO onetime.class_series
       (class_series_key, account_key, product_key, title, timezone, local_start_time,
        reminder_local_time, status, series_state, is_canonical)
     VALUES ('series-derived', $1, $2, 'Derived Class', 'Asia/Jerusalem', '19:00',
             '18:30', 'active', 'active', true)`,
    [ACTOR.scope.account_key, ACTOR.scope.product_key],
  );
  await pool.query(
    `INSERT INTO onetime.class_occurrences
       (occurrence_key, account_key, product_key, class_series_key, local_class_date,
        starts_at, reminder_due_at, joinable_until, occurrence_state, join_opens_at,
        join_closes_at, scheduled_ends_at, production_basic_live_confirmed_at,
        production_basic_live_expires_at, production_basic_meeting_ref_digest)
     VALUES ('occurrence-derived', $1, $2, 'series-derived', DATE '2026-08-16',
             '2026-08-16T16:00:00.000Z', '2026-08-16T15:30:00.000Z',
             '2026-08-16T17:15:00.000Z', 'live', '2026-08-16T15:50:00.000Z',
             '2026-08-16T17:15:00.000Z', '2026-08-16T17:00:00.000Z',
             '2026-08-16T16:00:00.000Z', '2026-08-16T18:00:00.000Z', $3)`,
    [ACTOR.scope.account_key, ACTOR.scope.product_key, MEETING_DIGEST],
  );
  await pool.query(
    `INSERT INTO onetime.classroom_occurrence_learner_entitlements
       (occurrence_entitlement_key, account_key, product_key, occurrence_key,
        household_key, learner_key, entitlement_state, source)
     VALUES ('entitlement-derived', $1, $2, 'occurrence-derived',
             'household-derived', $3, 'active', 'isolated_acceptance')`,
    [ACTOR.scope.account_key, ACTOR.scope.product_key, ACTOR.learner_key],
  );
}

function attendanceSession(): ProductionBasicAttendanceSession {
  return {
    attendance_session_key_digest: 'c'.repeat(64),
    scope: SCOPE,
    occurrence_id: 'occurrence-derived',
    student_id: ACTOR.learner_key,
    connection_lineage_id: 'c'.repeat(64),
    scheduled_start_at: '2026-08-16T16:00:00.000Z',
    scheduled_end_at: '2026-08-16T17:00:00.000Z',
    joined_observed_at: null,
    left_observed_at: null,
  };
}

function fakeAttendanceRepository(evidence: {
  events: AttendanceEvent[];
  projection: AttendanceProjection | null;
}): EmbeddedClassroomRepository {
  return {
    insertLaunchGrant: vi.fn(),
    loadLaunchGrant: vi.fn(),
    loadLiveSession: vi.fn(),
    commitBootstrap: vi.fn(),
    persistLiveSession: vi.fn(),
    resetStudentLaunch: vi.fn(),
    loadAttendanceEvidence: vi.fn(async () => ({
      events: [...evidence.events],
      projection: evidence.projection,
    })),
    appendAttendance: vi.fn(async ({ events, next_projection }) => {
      for (const event of events) {
        if (
          !evidence.events.some(
            (existing) => existing.attendance_event_id === event.attendance_event_id,
          )
        ) {
          evidence.events.push(event);
        }
      }
      evidence.projection = next_projection;
      return true;
    }),
  } as EmbeddedClassroomRepository;
}
