import { describe, expect, it, vi } from 'vitest';
import type {
  LaunchGrantRecord,
  LiveStudentSession,
} from '../../../../contracts/src/classroom/embedded/index.ts';
import {
  createPostgresEmbeddedClassroomRepository,
  type EmbeddedClassroomSqlClient,
} from './repository.ts';

const HASH = 'a'.repeat(64);

describe('Postgres embedded classroom repository', () => {
  it('loads a launch grant only by exact environment scope and digest', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repository = createPostgresEmbeddedClassroomRepository(pool(query));
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
    expect(String(query.mock.calls[0]?.[0])).not.toContain(HASH);
  });

  it('consumes the one-use grant and acquires the session in one transaction', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [{ grant_id: 'grant-1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ live_session_id: 'live-1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: null });
    const repository = createPostgresEmbeddedClassroomRepository(pool(query));
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
  });

  it('rolls back a stale grant so no overlapping session can commit', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: null });
    const repository = createPostgresEmbeddedClassroomRepository(pool(query));
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

  it('revokes the live session and all unused Student grants in one Admin reset transaction', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [{ live_session_id: 'live-1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 2 })
      .mockResolvedValueOnce({ rows: [], rowCount: null });
    const repository = createPostgresEmbeddedClassroomRepository(pool(query));
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
  });
});

function pool(query: ReturnType<typeof vi.fn>) {
  const client: EmbeddedClassroomSqlClient = { query, release: vi.fn() };
  return { connect: vi.fn().mockResolvedValue(client) };
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
