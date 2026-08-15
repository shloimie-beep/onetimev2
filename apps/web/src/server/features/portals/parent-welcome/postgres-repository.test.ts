import { describe, expect, it, vi } from 'vitest';
import type { ParentWelcomeEventRecord } from '../../../../../../../packages/contracts/src/portals/parent-welcome/index.ts';
import type { DbPool } from '../../../../../../../packages/db/src/index.ts';
import { createPostgresParentWelcomeRepository } from './postgres-repository.ts';

const principal = {
  role: 'parent' as const,
  adult_id: 'adult-parent',
  household_id: 'household-parent',
  session_id: 'session-parent',
};

function repository(pool: DbPool) {
  return createPostgresParentWelcomeRepository(pool, {
    accountKey: 'one-time-account',
    runtimeTier: 'isolated_staging',
    verificationEnvironmentId: 'ci',
  });
}

describe('Parent welcome PostgreSQL repository', () => {
  it('loads only a current published approval for the authenticated adult household', async () => {
    const query = vi.fn(async () => ({
      rowCount: 1,
      rows: [
        {
          account_key: 'one-time-account',
          product_key: 'one_time_mishnayos',
          runtime_tier: 'isolated_staging',
          verification_environment_id: 'ci',
          slot_key: 'parent_companion_welcome',
          video_version_id: 'welcome-approved-v1',
          content_id: 'content-approved',
          content_version_id: 'content-version-approved',
          publication_generation: 2,
          approval_projection_digest: 'a'.repeat(64),
          title: 'Welcome to One Time',
          duration_ms: 90_000,
          width: 1600,
          height: 900,
          captions_available: true,
          poster_available: true,
        },
      ],
    }));

    const slot = await repository({ query } as unknown as DbPool).loadCurrentSlot(principal);

    expect(slot).toMatchObject({
      video_version_id: 'welcome-approved-v1',
      publication_generation: 2,
    });
    const [sql, values] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("publication.state = 'published'");
    expect(sql).toContain(
      'publication.approval_projection_digest = slot.approval_projection_digest',
    );
    expect(sql).toContain('household.owner_adult_id = $6');
    expect(values).toEqual([
      'one-time-account',
      'one_time_mishnayos',
      'isolated_staging',
      'ci',
      'household-parent',
      'adult-parent',
    ]);
  });

  it('inserts an adult household event transactionally and never addresses Student truth', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT canonical_request_hash')) return { rowCount: 0, rows: [] };
      if (sql.includes('INSERT INTO onetime.parent_activation_events_v21')) {
        return { rowCount: 1, rows: [{ recorded_at: '2026-08-15T10:00:00.000Z' }] };
      }
      return { rowCount: 0, rows: [] };
    });
    const client = { query, release: vi.fn() };
    const pool = { connect: vi.fn(async () => client) } as unknown as DbPool;
    const event: ParentWelcomeEventRecord = {
      principal,
      event_type: 'parent.welcome_video_started',
      video_version_id: 'welcome-approved-v1',
      observed_playback_seconds: 0,
      observed_position_percent: 0,
      binding: {
        idempotency_key: 'welcome-started-0001',
        canonical_request_hash: 'b'.repeat(64),
        occurred_at: '2026-08-15T10:00:00.000Z',
      },
    };

    const receipts = await repository(pool).recordEvents([event]);

    expect(receipts).toEqual([
      {
        event_type: 'parent.welcome_video_started',
        video_version_id: 'welcome-approved-v1',
        recorded: true,
        recorded_at: '2026-08-15T10:00:00.000Z',
      },
    ]);
    expect(query.mock.calls[0]?.[0]).toBe('BEGIN');
    expect(query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
    expect(query.mock.calls.map(([sql]) => String(sql)).join('\n')).not.toMatch(
      /v21_student|classroom_attendance|learning_badge|progress/iu,
    );
  });

  it('returns adjacent funnel counts from the scoped report view', async () => {
    const query = vi.fn(async () => ({
      rowCount: 1,
      rows: [
        {
          step_order: 4,
          event_type: 'parent.welcome_video_started',
          label: 'Welcome video started',
          household_count: 8,
          previous_household_count: 10,
          adjacent_conversion_percent: '80.00',
        },
      ],
    }));
    await expect(repository({ query } as unknown as DbPool).loadFunnelReport()).resolves.toEqual([
      {
        step_order: 4,
        event_type: 'parent.welcome_video_started',
        label: 'Welcome video started',
        household_count: 8,
        previous_household_count: 10,
        adjacent_conversion_percent: 80,
      },
    ]);
  });
});
