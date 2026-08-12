import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../apps/web/src/server/app.ts';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import { buildLocalMediaSignature } from '../../../packages/domain/src/index.ts';

let pool: DbPool;
let config: AppConfig;

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    OUTBOX_TRANSPORT_MODE: 'sink',
    ONE_TIME_LOCAL_MEDIA_IMPORT_ENABLED: 'true',
    ONE_TIME_LOCAL_MEDIA_IMPORT_HMAC_KEY: 'h'.repeat(48),
  });
  pool = createMemoryPool();
  await runMigrations(pool);
  await seedOccurrence();
});

afterEach(async () => {
  await pool.end();
});

describe('signed local Windows media import', () => {
  it('rejects unsigned lookups and returns only occurrences in the bounded window', async () => {
    const server = await listenForTest(createApp({ config, pool }));
    try {
      const target =
        '/api/v1/admin/content/local-runner/occurrences?recorded_at=2026-07-22T15%3A02%3A00.000Z&before_minutes=10&after_minutes=10';
      const unsigned = await fetch(`${server.baseUrl}${target}`);
      expect(unsigned.status).toBe(401);
      const signed = await signedFetch({
        baseUrl: server.baseUrl,
        target,
        method: 'GET',
        body: '',
        nonce: 'occurrence-lookup-nonce',
      });
      expect(signed.status).toBe(200);
      await expect(signed.json()).resolves.toMatchObject({
        success: true,
        occurrences: [{ occurrence_key: 'occurrence_local_media' }],
      });
      const replayed = await signedFetch({
        baseUrl: server.baseUrl,
        target,
        method: 'GET',
        body: '',
        nonce: 'occurrence-lookup-nonce',
      });
      expect(replayed.status).toBe(401);
    } finally {
      await server.close();
    }
  });

  it('idempotently imports a private Vimeo Draft when transcription is off', async () => {
    const server = await listenForTest(createApp({ config, pool }));
    try {
      const sourceSha256 = digest('local-media-off-source');
      const sourceKey = `local_media_${digest(`${sourceSha256}\0occurrence_local_media`).slice(0, 32)}`;
      const body = JSON.stringify({
        occurrence_key: 'occurrence_local_media',
        item: {
          sourceKey,
          sourceKind: 'local_drop',
          sourceRefDigest: digest(`local_drop\0${sourceSha256}`),
          sourceSha256,
          displayName: 'operator-owned-off.mkv',
          mimeType: 'video/x-matroska',
          byteLength: 100_000,
          occurrenceKey: 'occurrence_local_media',
          originalDurationMs: 120_000,
          preparedDurationMs: 120_000,
          trimStartMs: 0,
          trimEndMs: 120_000,
          removedStartMs: 0,
          removedEndMs: 0,
          trimConfidence: 0,
          transcriptSegments: [],
          normalizedTranscript: '',
          transcriptSha256: digest(''),
          webvtt: '',
          webvttSha256: digest(''),
          transcriptionModel: 'off',
          transcriptionLanguage: 'und',
          transcriptionMode: 'off',
          draft: {
            title: 'Operator-owned class',
            short_description: 'Draft video imported without transcription.',
            class_label: 'One Time Mishnayos',
            class_date: '2026-07-22',
            topics: [],
            mishnah_terms: [],
            review_questions: [1, 2, 3, 4, 5].map((number) => `Review question ${number}`),
            key_takeaways: [1, 2, 3].map((number) => `Key takeaway ${number}`),
            vocabulary: [],
            draft_only: true,
            authoritative_torah_interpretation: false,
          },
          providerVideoId: 'private_video_off_123',
          providerEmbedUrl: 'https://player.vimeo.com/video/private_video_off_123',
          providerTextTrackId: null,
          vimeoPrivacy: 'private',
          captionsActive: false,
        },
      });
      for (const nonce of ['import-nonce-one', 'import-nonce-two']) {
        const imported = await signedFetch({
          baseUrl: server.baseUrl,
          target: '/api/v1/admin/content/local-runner/import',
          method: 'POST',
          body,
          nonce,
        });
        expect(imported.status, await imported.clone().text()).toBe(201);
        await expect(imported.json()).resolves.toMatchObject({
          success: true,
          source_key: sourceKey,
          state: 'needs_review',
          occurrence_key: 'occurrence_local_media',
          captions_active: false,
          raw_provider_url_present: false,
        });
      }
      const count = await pool.query(
        `SELECT count(*)::int AS count
           FROM onetime.learning_delivery_content_factory_items
          WHERE source_key = $1`,
        [sourceKey],
      );
      expect(count.rows[0]?.count).toBe(1);
    } finally {
      await server.close();
    }
  });
});

async function seedOccurrence() {
  await pool.query(
    `INSERT INTO onetime.class_series
       (class_series_key, account_key, product_key, title, timezone, local_start_time,
        reminder_local_time, status)
     VALUES ('series_local_media',$1,$2,'Local media class','Asia/Jerusalem',
       '18:00','17:30','active')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.class_occurrences
       (occurrence_key, account_key, product_key, class_series_key, local_class_date,
        starts_at, reminder_due_at, joinable_until, scheduled_ends_at, join_opens_at,
        join_closes_at, occurrence_state)
     VALUES ('occurrence_local_media',$1,$2,'series_local_media','2026-07-22',
       '2026-07-22T15:00:00Z','2026-07-22T14:30:00Z','2026-07-22T17:00:00Z',
       '2026-07-22T16:00:00Z','2026-07-22T14:50:00Z','2026-07-22T16:15:00Z','completed')`,
    [config.accountKey, config.productKey],
  );
}

function signedFetch(input: {
  baseUrl: string;
  target: string;
  method: 'GET' | 'POST';
  body: string;
  nonce: string;
}) {
  const timestamp = String(Date.now());
  const signature = buildLocalMediaSignature('h'.repeat(48), {
    method: input.method,
    requestTarget: input.target,
    timestamp,
    nonce: input.nonce,
    body: input.body,
  });
  return fetch(`${input.baseUrl}${input.target}`, {
    method: input.method,
    headers: {
      'x-one-time-media-timestamp': timestamp,
      'x-one-time-media-nonce': input.nonce,
      'x-one-time-media-signature': signature,
      ...(input.method === 'POST' ? { 'content-type': 'application/json' } : {}),
    },
    ...(input.method === 'POST' ? { body: input.body } : {}),
  });
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

async function listenForTest(app: ReturnType<typeof createApp>) {
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const instance = app.listen(0, (error?: Error) => {
      if (error) reject(error);
      else resolve(instance);
    });
  });
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('missing test server address');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
