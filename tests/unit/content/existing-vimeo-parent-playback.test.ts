import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../../packages/config/src/index.ts';
import type { DbPool } from '../../../packages/db/src/index.ts';
import { getExistingPrivateVimeoPlayback } from '../../../packages/domain/src/content/existing-vimeo-adoption.ts';

const config = loadConfig({
  NODE_ENV: 'test',
  PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
  APP_VERSION: 'parent-existing-vimeo-auth-test',
  COMMIT_SHA: 'parent-existing-vimeo-auth-test',
  OUTBOX_TRANSPORT_MODE: 'sink',
  ONE_TIME_ACCOUNT_KEY: 'parent_existing_vimeo_account',
  ONE_TIME_PRODUCT_KEY: 'one_time_mishnayos',
});

const item = {
  title: 'Protected Parent lesson',
  metadata: {
    source_type: 'existing_private_vimeo',
    protection_digest: 'a'.repeat(64),
    duration_ms: 91_000,
    captions_active: false,
  },
  content_version_id: 'parent-existing-vimeo-revision-1',
  provider_video_id: '1234567890',
  duration_ms: 91_000,
  processing_state: 'available',
  privacy_state: 'private',
  sanitized_metadata_json: { protection_digest: 'a'.repeat(64) },
};

const parentActor = {
  account_key: config.accountKey,
  product_key: config.productKey,
  actor_user_ref: 'parent-human-account-1',
  actor_role: 'parent' as const,
  student_learner: null,
  authorized_households: [
    {
      household_key: 'parent-household-1',
      relationship_key: 'v21_account_owner',
      relationship_label: 'Parent',
      authority: 'primary_guardian' as const,
    },
  ],
};

describe('existing-private-Vimeo Parent playback authorization', () => {
  it('binds the Parent identity to one active participant, household, canonical class, and current content entitlement without child rows', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [item], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ entitled: 1 }], rowCount: 1 });
    const playback = await getExistingPrivateVimeoPlayback({
      pool: { query } as unknown as DbPool,
      config,
      itemKey: 'parent-existing-vimeo-content-1',
      actor: parentActor,
      now: new Date('2026-08-16T12:00:00.000Z'),
    });

    expect(playback).toMatchObject({
      contentVersionId: item.content_version_id,
      parentProgressEnabled: true,
    });
    const sql = String(query.mock.calls[1]?.[0]);
    expect(sql).toContain('parent_learning_participants');
    expect(sql).toContain('parent_learning_class_entitlements');
    expect(sql).toContain('v21_households');
    expect(sql).toContain('canonical_aggregate_states');
    expect(sql).toContain('content_item_entitlements');
    expect(sql).toContain('series.is_canonical = true');
    expect(sql).toContain('participant.human_account_id = $5');
    expect(sql).not.toContain('portal_learners');
    expect(sql).not.toContain('classroom_occurrence_learner_entitlements');
    expect(query.mock.calls[1]?.[1]).toEqual([
      config.accountKey,
      config.productKey,
      'parent-existing-vimeo-content-1',
      ['parent-household-1'],
      'parent-human-account-1',
      new Date('2026-08-16T12:00:00.000Z'),
    ]);
  });

  it.each([
    'missing participant',
    'revoked canonical class entitlement',
    'revoked content entitlement',
    'cross-household participant',
  ])('fails closed for %s', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [item], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await expect(
      getExistingPrivateVimeoPlayback({
        pool: { query } as unknown as DbPool,
        config,
        itemKey: 'parent-existing-vimeo-content-1',
        actor: parentActor,
        now: new Date('2026-08-16T12:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'CONTENT_UNAVAILABLE', httpStatus: 404 });
  });

  it.each([
    ['zero', 0],
    ['missing despite legacy metadata', null],
    ['malformed', 'not-a-duration'],
    ['unsafe', Number.MAX_SAFE_INTEGER + 1],
  ])('fails closed when the governed source duration is %s', async (_label, duration) => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: [{ ...item, duration_ms: duration }],
      rowCount: 1,
    });

    await expect(
      getExistingPrivateVimeoPlayback({
        pool: { query } as unknown as DbPool,
        config,
        itemKey: 'parent-existing-vimeo-content-1',
        actor: parentActor,
        now: new Date('2026-08-16T12:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'CONTENT_UNAVAILABLE', httpStatus: 404 });
    expect(query).toHaveBeenCalledTimes(1);
  });
});
