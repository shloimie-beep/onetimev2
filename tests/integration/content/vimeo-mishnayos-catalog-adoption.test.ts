import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import { createVimeoMishnayosCatalogRepository } from '../../../packages/db/src/content/vimeo-mishnayos-catalog/index.ts';
import {
  adoptCompleteVimeoCatalog,
  classifyCompleteVimeoCatalog,
  type PrivateVimeoCatalogVideo,
} from '../../../packages/domain/src/content/vimeo-mishnayos-catalog.ts';

describe('Vimeo Mishnayos catalog adoption repository', () => {
  let pool: DbPool | null = null;
  afterEach(async () => {
    await pool?.end();
    pool = null;
  });

  it('applies the migration and adopts an included protected reference idempotently', async () => {
    pool = createMemoryPool();
    await runMigrations(pool);
    const video: PrivateVimeoCatalogVideo = {
      providerIdentity: '/videos/synthetic_integration_fixture',
      title: 'Mishnayos Bava Kamma Perek 4',
      description: '',
      tags: [],
      folders: ['Mishnayos'],
      showcases: [],
      durationSeconds: 120,
      createdAt: null,
      modifiedAt: null,
      language: 'en',
      privacyView: 'nobody',
      privacyEmbed: 'whitelist',
      thumbnailAvailable: true,
      captionsAvailable: true,
    };
    const classified = await classifyCompleteVimeoCatalog({
      inventory: {
        providerTotal: 1,
        observedRows: 1,
        uniqueVideos: [video],
        duplicateCount: 0,
        completedAt: '2026-08-03T00:00:00.000Z',
      },
    });
    const input = {
      repository: createVimeoMishnayosCatalogRepository(pool),
      accountKey: 'account_fixture',
      classified,
      referenceKey: Buffer.alloc(32, 8),
      now: '2026-08-03T00:00:00.000Z',
    };
    expect(await adoptCompleteVimeoCatalog(input)).toMatchObject({
      inserted: 1,
      replayed: 0,
      stagedForReview: 1,
    });
    expect(await adoptCompleteVimeoCatalog(input)).toMatchObject({
      inserted: 0,
      replayed: 1,
      stagedForReview: 0,
    });
    const [revisions, currentRows, reviewRows] = await Promise.all([
      pool.query('SELECT count(*) AS count FROM onetime.vimeo_mishnayos_catalog_revisions'),
      pool.query('SELECT count(*) AS count FROM onetime.vimeo_mishnayos_catalog_current'),
      pool.query('SELECT count(*) AS count FROM onetime.vimeo_mishnayos_catalog_review_queue'),
    ]);
    expect(Number(revisions.rows[0]?.count)).toBe(1);
    expect(Number(currentRows.rows[0]?.count)).toBe(1);
    expect(Number(reviewRows.rows[0]?.count)).toBe(1);
    const stored = await pool.query(
      `SELECT protected_provider_reference, record_json
         FROM onetime.vimeo_mishnayos_catalog_revisions`,
    );
    expect(JSON.stringify(stored.rows)).not.toContain(video.providerIdentity);
    expect(String(stored.rows[0]?.protected_provider_reference)).toMatch(/^v1\./);
  });
});
