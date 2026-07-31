import { describe, expect, it, vi } from 'vitest';
import type {
  AttendanceEvent,
  AttendanceProjection,
  LaunchGrantRecord,
  LiveStudentSession,
} from '../../../../contracts/src/classroom/embedded/index.ts';
import {
  createPostgresEmbeddedClassroomRepository,
  type EmbeddedClassroomSqlClient,
} from './repository.ts';

const HASH = 'a'.repeat(64);

describe('Postgres embedded classroom repository', () => {
  it('inserts a launch grant only into the collision-free v2.1 table', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ grant_id: 'grant-1' }],
      rowCount: 1,
    });
    const repository = createRepository(query);
    await expect(repository.insertLaunchGrant(grant())).resolves.toBe('inserted');
    expectLaunchGrantV21Sql(query.mock.calls[0]?.[0]);
  });

  it('recognizes an exact launch-grant replay without updating immutable evidence', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ grant_id: 'grant-1' }], rowCount: 1 });
    const repository = createRepository(query);

    await expect(repository.insertLaunchGrant(grant())).resolves.toBe('replayed');
    expect(String(query.mock.calls[0]?.[0])).toContain('ON CONFLICT DO NOTHING');
    expect(String(query.mock.calls[0]?.[0])).not.toContain('DO UPDATE');
    expect(query.mock.calls[1]?.[1]).toHaveLength(18);
  });

  it('rejects a launch-grant key replay with changed immutable evidence', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const repository = createRepository(query);

    await expect(repository.insertLaunchGrant(grant())).rejects.toThrow(
      'embedded_launch_grant_idempotency_conflict',
    );
  });

  it('loads a launch grant only by exact environment scope and digest', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repository = createRepository(query);
    await expect(
      repository.loadLaunchGrant({
        scope: grant().scope,
        grant_key_digest: HASH,
      }),
    ).resolves.toBeNull();
    expect(query).toHaveBeenCalledWith(expect.stringContaining('grant_key_digest = $4'), [
      'one_time_mishnayos',
      'isolated_staging',
      'ci',
      HASH,
    ]);
    expectLaunchGrantV21Sql(query.mock.calls[0]?.[0]);
    expect(String(query.mock.calls[0]?.[0])).not.toContain(HASH);
  });

  it('consumes the one-use grant and acquires the session in one transaction', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [{ grant_id: 'grant-1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ live_session_id: 'live-1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: null });
    const repository = createRepository(query);
    const priorGrant = grant();
    const result = await repository.commitBootstrap({
      prior_grant: priorGrant,
      next_grant: {
        ...priorGrant,
        used_at: '2026-07-28T17:00:30.000Z',
        version: 2,
      },
      prior_session: null,
      next_session: session(),
    });
    expect(result).toBe(true);
    expect(query.mock.calls.map((call) => call[0])).toEqual([
      'BEGIN',
      expect.stringContaining('used_at IS NULL'),
      expect.stringContaining('ON CONFLICT DO NOTHING'),
      'COMMIT',
    ]);
    expectLaunchGrantV21Sql(query.mock.calls[1]?.[0]);
  });

  it('rolls back a stale grant so no overlapping session can commit', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: null });
    const repository = createRepository(query);
    const priorGrant = grant();
    await expect(
      repository.commitBootstrap({
        prior_grant: priorGrant,
        next_grant: {
          ...priorGrant,
          used_at: '2026-07-28T17:00:30.000Z',
          version: 2,
        },
        prior_session: null,
        next_session: session(),
      }),
    ).resolves.toBe(false);
    expect(query.mock.calls.map((call) => call[0])).toEqual([
      'BEGIN',
      expect.stringContaining('used_at IS NULL'),
      'ROLLBACK',
    ]);
  });

  it('reacquires after Admin reset by inserting a new generation without clearing audit', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [{ grant_id: 'grant-1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ live_session_id: 'live-2' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: null });
    const repository = createRepository(query);
    const priorGrant = grant();
    const priorSession = {
      ...session(),
      state: 'revoked' as const,
      revoked_at: '2026-07-28T17:00:40.000Z',
      revoked_by_admin_id: 'admin-1',
      revoke_audit_ref: 'audit-reset-1',
      version: 2,
    };
    const nextSession = {
      ...session(),
      live_session_id: 'live-2',
      device_lineage_id: 'device-2',
      lease_generation: 2,
      last_heartbeat_at: '2026-07-28T17:00:41.000Z',
      lease_expires_at: '2026-07-28T17:02:11.000Z',
      version: 1,
    };
    await expect(
      repository.commitBootstrap({
        prior_grant: priorGrant,
        next_grant: {
          ...priorGrant,
          used_at: '2026-07-28T17:00:41.000Z',
          version: 2,
        },
        prior_session: priorSession,
        next_session: nextSession,
      }),
    ).resolves.toBe(true);
    expect(query.mock.calls.map((call) => call[0])).toEqual([
      'BEGIN',
      expect.stringContaining('used_at IS NULL'),
      expect.stringContaining('INSERT INTO onetime.live_student_classroom_sessions'),
      'COMMIT',
    ]);
    expect(query.mock.calls[2]?.[0]).not.toContain('revoke_audit_ref = NULL');
  });

  it('revokes the live session and all unused Student grants in one Admin reset transaction', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [{ live_session_id: 'live-1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 2 })
      .mockResolvedValueOnce({ rows: [], rowCount: null });
    const repository = createRepository(query);
    const prior = session();
    const next = {
      ...prior,
      state: 'revoked' as const,
      revoked_at: '2026-07-28T17:00:40.000Z',
      revoked_by_admin_id: 'admin-1',
      revoke_audit_ref: 'audit-reset-1',
      version: 2,
    };
    await expect(
      repository.resetStudentLaunch({
        prior_session: prior,
        next_session: next,
        now: new Date('2026-07-28T17:00:40.000Z'),
      }),
    ).resolves.toBe(true);
    expect(query.mock.calls.map((call) => call[0])).toEqual([
      'BEGIN',
      expect.stringContaining("SET state = 'revoked'"),
      expect.stringContaining('used_at IS NULL'),
      'COMMIT',
    ]);
    expectLaunchGrantV21Sql(query.mock.calls[2]?.[0]);
  });

  it('commits a new attendance projection before invoking the mandatory callback', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [storedEventRow()], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ occurrence_id: 'occurrence-1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: null });
    const onChange = vi.fn(async () => {
      expect(query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
    });
    const repository = createRepository(query, onChange);

    await expect(
      repository.appendAttendance({
        events: [attendanceEvent()],
        prior_projection: null,
        next_projection: attendanceProjection(),
      }),
    ).resolves.toBe(true);
    expect(query.mock.calls.map((call) => call[0])).toEqual([
      'BEGIN',
      expect.stringContaining('ON CONFLICT DO NOTHING'),
      expect.stringContaining('INSERT INTO onetime.classroom_attendance_projection_v21'),
      'COMMIT',
    ]);
    expect(onChange).toHaveBeenCalledWith({
      scope: {
        product: 'one_time_mishnayos',
        runtime_tier: 'isolated_staging',
        verification_environment_id: 'ci',
      },
      occurrence_id: 'occurrence-1',
      student_id: 'student-1',
      source_attendance_event_id: 'attendance-1',
      source_event_ref_digest: HASH,
      correction_audit_ref: null,
      correction_reason: null,
      correction_admin_id: null,
    });
  });

  it('propagates callback failure after commit and exact replay repairs the callback only', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [storedEventRow()], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ occurrence_id: 'occurrence-1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [storedEventRow()], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: null });
    const onChange = vi
      .fn()
      .mockRejectedValueOnce(new Error('projection_callback_unavailable'))
      .mockResolvedValueOnce(undefined);
    const repository = createRepository(query, onChange);
    const input = {
      events: [attendanceEvent()],
      prior_projection: null,
      next_projection: attendanceProjection(),
    };

    await expect(repository.appendAttendance(input)).rejects.toThrow(
      'projection_callback_unavailable',
    );
    await expect(repository.appendAttendance(input)).resolves.toBe(true);
    expect(query.mock.calls.map((call) => call[0])).toEqual([
      'BEGIN',
      expect.stringContaining('INSERT INTO onetime.classroom_attendance_events_v21'),
      expect.stringContaining('INSERT INTO onetime.classroom_attendance_projection_v21'),
      'COMMIT',
      'BEGIN',
      expect.stringContaining('INSERT INTO onetime.classroom_attendance_events_v21'),
      expect.stringContaining('source_event_ref_digest = $12'),
      'COMMIT',
    ]);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('replays an older exact event after a successor with no write and invokes the callback', async () => {
    const older = { ...attendanceEvent(), attendance_event_id: 'attendance-older' };
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [storedEventRow(older)], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: null });
    const onChange = vi.fn(async () => undefined);
    const repository = createRepository(query, onChange);

    await expect(
      repository.appendAttendance({
        events: [older],
        prior_projection: { ...attendanceProjection(), version: 3, source_event_count: 3 },
        next_projection: attendanceProjection(),
      }),
    ).resolves.toBe(true);
    expect(query.mock.calls.map((call) => call[0])).toEqual([
      'BEGIN',
      expect.stringContaining('ON CONFLICT DO NOTHING'),
      expect.stringContaining('FOR SHARE'),
      'COMMIT',
    ]);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ source_attendance_event_id: 'attendance-older' }),
    );
  });

  it('rolls back a changed replay and invokes no callback', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: null });
    const onChange = vi.fn(async () => undefined);
    const repository = createRepository(query, onChange);

    await expect(
      repository.appendAttendance({
        events: [attendanceEvent()],
        prior_projection: null,
        next_projection: attendanceProjection(),
      }),
    ).rejects.toThrow('attendance_event_idempotency_conflict');
    expect(query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('rolls back a genuinely stale new write and invokes no callback', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [storedEventRow()], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: null });
    const onChange = vi.fn(async () => undefined);
    const repository = createRepository(query, onChange);

    await expect(
      repository.appendAttendance({
        events: [attendanceEvent()],
        prior_projection: { ...attendanceProjection(), version: 1 },
        next_projection: { ...attendanceProjection(), version: 2 },
      }),
    ).resolves.toBe(false);
    expect(query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('emits only server-owned P18 identity and exact correction metadata', async () => {
    const correction = attendanceCorrectionEvent();
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [storedEventRow(correction)], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ occurrence_id: 'occurrence-1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: null });
    const onChange = vi.fn(async () => undefined);
    const repository = createRepository(query, onChange);

    await expect(
      repository.appendAttendance({
        events: [correction],
        prior_projection: null,
        next_projection: correctedAttendanceProjection(),
      }),
    ).resolves.toBe(true);
    expect(onChange).toHaveBeenCalledWith({
      scope: {
        product: 'one_time_mishnayos',
        runtime_tier: 'isolated_staging',
        verification_environment_id: 'ci',
      },
      occurrence_id: 'occurrence-1',
      student_id: 'student-1',
      source_attendance_event_id: 'attendance-correction-1',
      source_event_ref_digest: HASH,
      correction_audit_ref: 'audit-correction-1',
      correction_reason: 'verified operator correction',
      correction_admin_id: 'admin-1',
    });
  });

  it('rejects noncanonical P22 correction metadata before commit and callback', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [], rowCount: null });
    const onChange = vi.fn(async () => undefined);
    const repository = createRepository(query, onChange);
    const invalid = { ...attendanceCorrectionEvent(), correction_reason: ' no ' };

    await expect(
      repository.appendAttendance({
        events: [invalid],
        prior_projection: null,
        next_projection: correctedAttendanceProjection(),
      }),
    ).rejects.toThrow('attendance_correction_metadata_invalid');
    expect(query.mock.calls.map((call) => call[0])).toEqual(['BEGIN', 'ROLLBACK']);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('rejects a changed immutable projection/event binding before commit and callback', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [], rowCount: null });
    const onChange = vi.fn(async () => undefined);
    const repository = createRepository(query, onChange);

    await expect(
      repository.appendAttendance({
        events: [attendanceEvent()],
        prior_projection: null,
        next_projection: { ...attendanceProjection(), student_id: 'student-other' },
      }),
    ).rejects.toThrow('attendance_projection_event_binding_invalid');
    expect(query.mock.calls.map((call) => call[0])).toEqual(['BEGIN', 'ROLLBACK']);
    expect(onChange).not.toHaveBeenCalled();
  });
});

function expectLaunchGrantV21Sql(sql: unknown): void {
  expect(String(sql)).toContain('onetime.classroom_launch_grants_v21');
  expect(String(sql)).not.toMatch(/onetime\.classroom_launch_grants(?!_v21)/);
}

function pool(query: ReturnType<typeof vi.fn>) {
  const client: EmbeddedClassroomSqlClient = { query, release: vi.fn() };
  return { connect: vi.fn().mockResolvedValue(client) };
}

function createRepository(
  query: ReturnType<typeof vi.fn>,
  onAttendanceProjectionChange = vi.fn(async () => undefined),
) {
  return createPostgresEmbeddedClassroomRepository(pool(query), {
    onAttendanceProjectionChange,
  });
}

function grant(): LaunchGrantRecord {
  return {
    grant_id: 'grant-1',
    grant_key_digest: HASH,
    scope: {
      product: 'one_time_mishnayos',
      runtime_tier: 'isolated_staging',
      verification_environment_id: 'ci',
    },
    student_id: 'student-1',
    household_id: 'household-1',
    authenticated_session_id: 'student-session-1',
    occurrence_id: 'occurrence-1',
    registrant_id: 'registrant-1',
    issued_at: '2026-07-28T17:00:00.000Z',
    expires_at: '2026-07-28T17:01:00.000Z',
    used_at: null,
    revoked_at: null,
    student_version: 3,
    enrollment_version: 4,
    access_version: 5,
    consent_version_digest: HASH,
    registrant_version: 6,
    occurrence_version: 2,
    version: 1,
  };
}

function session(): LiveStudentSession {
  return {
    live_session_id: 'live-1',
    scope: grant().scope,
    student_id: 'student-1',
    household_id: 'household-1',
    occurrence_id: 'occurrence-1',
    authenticated_session_id: 'student-session-1',
    device_lineage_id: 'device-1',
    state: 'active',
    lease_generation: 1,
    last_heartbeat_at: '2026-07-28T17:00:30.000Z',
    lease_expires_at: '2026-07-28T17:02:00.000Z',
    revoked_at: null,
    revoked_by_admin_id: null,
    revoke_audit_ref: null,
    version: 1,
  };
}

function attendanceEvent(): AttendanceEvent {
  return {
    attendance_event_id: 'attendance-1',
    scope: grant().scope,
    occurrence_id: 'occurrence-1',
    student_id: 'student-1',
    source: 'embedded_client',
    event_kind: 'joined',
    observed_at: '2026-07-28T17:00:30.000Z',
    connection_lineage_id: 'connection-1',
    idempotency_key: 'attendance-key-1',
    source_event_ref_digest: HASH,
    provider_verified: false,
    correction_intervals: [],
    correction_reason: null,
    correction_admin_id: null,
    audit_ref: null,
  };
}

function attendanceCorrectionEvent(): AttendanceEvent {
  return {
    ...attendanceEvent(),
    attendance_event_id: 'attendance-correction-1',
    source: 'admin_correction',
    event_kind: 'manual_correction',
    observed_at: '2026-07-28T18:05:00.000Z',
    correction_intervals: [
      {
        joined_at: '2026-07-28T17:00:00.000Z',
        left_at: '2026-07-28T18:00:00.000Z',
      },
    ],
    correction_reason: 'verified operator correction',
    correction_admin_id: 'admin-1',
    audit_ref: 'audit-correction-1',
  };
}

function storedEventRow(event = attendanceEvent()) {
  return {
    attendance_event_id: event.attendance_event_id,
    product: event.scope.product,
    runtime_tier: event.scope.runtime_tier,
    verification_environment_id: event.scope.verification_environment_id,
    occurrence_id: event.occurrence_id,
    student_id: event.student_id,
    source: event.source,
    event_kind: event.event_kind,
    source_event_ref_digest: event.source_event_ref_digest,
    correction_reason: event.correction_reason,
    correction_admin_id: event.correction_admin_id,
    audit_ref: event.audit_ref,
  };
}

function attendanceProjection(): AttendanceProjection {
  return {
    scope: grant().scope,
    occurrence_id: 'occurrence-1',
    student_id: 'student-1',
    first_joined_at: '2026-07-28T17:00:30.000Z',
    last_left_at: null,
    total_connected_minutes: 0,
    attendance_percentage: 0,
    reconnect_count: 0,
    late: false,
    reconciliation_state: 'provisional',
    manual_correction_reason: null,
    correction_admin_id: null,
    source_event_count: 1,
    version: 1,
    updated_at: '2026-07-28T17:00:30.000Z',
  };
}

function correctedAttendanceProjection(): AttendanceProjection {
  return {
    ...attendanceProjection(),
    reconciliation_state: 'admin_corrected',
    manual_correction_reason: 'verified operator correction',
    correction_admin_id: 'admin-1',
  };
}
