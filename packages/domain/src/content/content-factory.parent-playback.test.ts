import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../../config/src/index.ts';
import type { PortalActorContext } from '../../../contracts/src/portals/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../db/src/index.ts';
import { getContentFactoryPlayback } from './content-factory.ts';

const config = loadConfig({
  NODE_ENV: 'test',
  PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
  APP_VERSION: 'parent-playback-test',
  COMMIT_SHA: 'parent-playback-test',
  OUTBOX_TRANSPORT_MODE: 'sink',
  ONE_TIME_ACCOUNT_KEY: 'parent_playback_account',
  ONE_TIME_PRODUCT_KEY: 'one_time_mishnayos',
});

const publishedFactoryRow = {
  source_key: 'parent-entitled-class-video',
  factory_state: 'published',
  draft_json: {
    title: 'The Parent Learning Class',
    short_description: 'A protected class recording for an entitled Parent participant.',
    class_label: 'One Time Mishnayos',
    class_date: '2026-08-16',
    topics: ['Mishnah'],
    mishnah_terms: ['Mishnah'],
    review_questions: [
      'What was the first point?',
      'What was the second point?',
      'What was the third point?',
      'What was the fourth point?',
      'What was the fifth point?',
    ],
    key_takeaways: [
      'Remember the first point.',
      'Remember the second point.',
      'Remember the third point.',
    ],
    vocabulary: [],
    draft_only: true,
    authoritative_torah_interpretation: false,
  },
  provider_video_id: 'vimeo-parent-private-01',
  prepared_duration_ms: 91_000,
  processing_mode: 'vimeo',
  normalized_transcript: 'The protected Parent learning transcript.',
  captions_active: true,
  progress_state: 'not_started',
  content_version_id: 'parent-entitled-class-video-revision-1',
  occurrence_key: 'occurrence-parent-01',
  local_class_date: new Date('2026-08-16T00:00:00.000Z'),
  class_title: 'The Parent Learning Class',
};

const parentActor: Pick<
  PortalActorContext,
  'actor_role' | 'student_learner' | 'authorized_households' | 'actor_user_ref'
> = {
  actor_role: 'parent',
  actor_user_ref: 'parent-user-01',
  student_learner: null,
  authorized_households: [
    {
      household_key: 'household-parent-01',
      relationship_key: 'relationship-parent-01',
      relationship_label: 'Parent',
      authority: 'primary_guardian',
    },
  ],
};

describe('Parent content-factory playback authorization', () => {
  it('authorizes from the Parent participant, active household, canonical class, and content entitlement without a Student row', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [publishedFactoryRow], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ entitled: 1 }], rowCount: 1 });
    const pool = { query } as unknown as DbPool;

    const playback = await getContentFactoryPlayback({
      pool,
      config,
      sourceKey: publishedFactoryRow.source_key,
      actor: parentActor,
    });

    expect(playback).toMatchObject({
      sourceKey: publishedFactoryRow.source_key,
      occurrenceKey: publishedFactoryRow.occurrence_key,
      privateProviderAssetId: publishedFactoryRow.provider_video_id,
      processingMode: 'vimeo',
      contentVersionId: publishedFactoryRow.content_version_id,
      parentProgressEnabled: true,
      durationMs: 91_000,
    });
    const authorizationSql = String(query.mock.calls[1]?.[0]);
    expect(authorizationSql).toContain('parent_learning_participants');
    expect(authorizationSql).toContain('parent_learning_class_entitlements');
    expect(authorizationSql).toContain('v21_households');
    expect(authorizationSql).toContain('canonical_aggregate_states');
    expect(authorizationSql).toContain('content_item_entitlements');
    expect(authorizationSql).toContain('series.is_canonical = true');
    expect(authorizationSql).toContain('participant.human_account_id = $6');
    expect(authorizationSql).toContain("access.current_state IN ('free', 'active', 'grace')");
    expect(authorizationSql).not.toContain('portal_learners');
    expect(authorizationSql).not.toContain('classroom_occurrence_learner_entitlements');
    expect(query.mock.calls[1]?.[1]).toEqual([
      config.accountKey,
      config.productKey,
      publishedFactoryRow.source_key,
      ['household-parent-01'],
      publishedFactoryRow.occurrence_key,
      parentActor.actor_user_ref,
    ]);

    const verificationPool = createMemoryPool();
    try {
      await runMigrations(verificationPool);
      const parsed = await verificationPool.query(authorizationSql, query.mock.calls[1]?.[1]);
      expect(parsed.rows).toEqual([]);
    } finally {
      await verificationPool.end();
    }
  });

  it('fails closed when the Parent entitlement join does not resolve', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [publishedFactoryRow], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const pool = { query } as unknown as DbPool;

    await expect(
      getContentFactoryPlayback({
        pool,
        config,
        sourceKey: publishedFactoryRow.source_key,
        actor: parentActor,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it.each([
    ['published content version', { content_version_id: null }],
    ['governed positive duration', { prepared_duration_ms: 0 }],
  ])('fails closed when Parent playback lacks its %s', async (_label, override) => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{ ...publishedFactoryRow, ...override }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ entitled: 1 }], rowCount: 1 });

    await expect(
      getContentFactoryPlayback({
        pool: { query } as unknown as DbPool,
        config,
        sourceKey: publishedFactoryRow.source_key,
        actor: parentActor,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
