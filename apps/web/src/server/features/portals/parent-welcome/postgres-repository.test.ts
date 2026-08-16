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

const slotRow = {
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
};

describe('Parent welcome PostgreSQL repository', () => {
  it('loads only a current published approval with all three governed assets for the owning adult', async () => {
    const query = vi.fn(async () => ({ rowCount: 1, rows: [slotRow] }));

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
    expect(sql).toContain("source.source_kind = 'drive'");
    expect(sql).toContain("version.processing_state = 'approved'");
    expect(sql).toContain("media_asset.asset_kind = 'media'");
    expect(sql).toContain("captions_asset.asset_kind = 'captions'");
    expect(sql).toContain("poster_asset.asset_kind = 'poster'");
    expect(sql.match(/asset\.state = 'approved'/gu)).toHaveLength(3);
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

  it('resolves one exact approved object version only after rechecking source, publication, and household', async () => {
    const query = vi.fn(async () => ({
      rowCount: 1,
      rows: [
        {
          ...slotRow,
          source_key: 'source-approved',
          source_sha256: 'b'.repeat(64),
          source_object_version_id: 'source-object-version-1',
          asset_kind: 'media',
          storage_provider: 's3',
          bucket_ref: 'one-time-private-media',
          object_key: `derivative_${'c'.repeat(64)}`,
          object_version_id: 'asset-object-version-1',
          byte_count: 100,
          payload_sha256: 'd'.repeat(64),
          content_type: 'video/mp4',
          asset_width: null,
          asset_height: null,
        },
      ],
    }));

    const binding = await repository({ query } as unknown as DbPool).resolveAsset({
      principal,
      video_version_id: 'welcome-approved-v1',
      asset_kind: 'media',
    });

    expect(binding).toMatchObject({
      video_version_id: 'welcome-approved-v1',
      asset_kind: 'media',
      object_version_id: 'asset-object-version-1',
      content_type: 'video/mp4',
    });
    const [sql, values] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain('slot.video_version_id = $7');
    expect(sql).toContain('asset.asset_kind = $8');
    expect(sql).toContain("slot.state = 'approved'");
    expect(sql).toContain("asset.state = 'approved'");
    expect(sql).toContain("source.source_kind = 'drive'");
    expect(sql).toContain('source.object_version_id = asset.source_object_version_id');
    expect(sql).toContain('publication.publication_generation = slot.publication_generation');
    expect(sql).toContain('household.owner_adult_id = $6');
    expect(values).toEqual([
      'one-time-account',
      'one_time_mishnayos',
      'isolated_staging',
      'ci',
      'household-parent',
      'adult-parent',
      'welcome-approved-v1',
      'media',
    ]);
  });

  it('returns no binding when the exact version/household query finds a stale or revoked row', async () => {
    const query = vi.fn(async () => ({ rowCount: 0, rows: [] }));
    const resolved = await repository({ query } as unknown as DbPool).resolveAsset({
      principal: { ...principal, household_id: 'other-household' },
      video_version_id: 'welcome-stale-v0',
      asset_kind: 'poster',
    });

    expect(resolved).toBeNull();
    const call = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(call[1]).toEqual([
      'one-time-account',
      'one_time_mishnayos',
      'isolated_staging',
      'ci',
      'other-household',
      'adult-parent',
      'welcome-stale-v0',
      'poster',
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
