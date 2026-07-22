import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../apps/web/src/server/app.ts';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  createAccountUser,
  createSession,
  generateContentFactoryDraftFromTranscript,
  getSessionUserByKey,
  ingestContentFactoryItem,
} from '../../../packages/domain/src/index.ts';

let pool: DbPool;
let config: AppConfig;
let intakeDirectory: string;

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    OUTBOX_TRANSPORT_MODE: 'sink',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
  intakeDirectory = await mkdtemp(path.join(tmpdir(), 'onetime-content-factory-'));
  process.env.CONTENT_FACTORY_LOCAL_DROP_DIR = intakeDirectory;
});

afterEach(async () => {
  await pool.end();
  delete process.env.CONTENT_FACTORY_LOCAL_DROP_DIR;
  await rm(intakeDirectory, { recursive: true, force: true });
});

describe('operator-reviewed content factory', () => {
  it('publishes one reviewed item to protected Parent and Student playback without a raw Vimeo URL', async () => {
    const owner = await createUserSession('owner', 'factory-owner@example.test');
    const parent = await createUserSession('parent', 'factory-parent@example.test');
    const student = await createUserSession('student', 'factory-student@example.test');
    await ingestFixture();
    const server = await listenForTest(createApp({ config, pool }));
    try {
      const anonymous = await fetch(`${server.baseUrl}/api/v1/admin/content/factory`);
      expect(anonymous.status).toBe(401);

      const forbidden = await fetch(`${server.baseUrl}/api/v1/admin/content/factory`, {
        headers: { cookie: student.cookie },
      });
      expect(forbidden.status).toBe(403);

      const intake = await fetch(`${server.baseUrl}/api/v1/admin/content/factory/intake`, {
        method: 'POST',
        headers: {
          cookie: owner.cookie,
          'content-type': 'video/mp4',
          'x-csrf-token': owner.csrfToken,
          'x-file-name': encodeURIComponent('protected-class-video.mp4'),
          'x-class-label': encodeURIComponent('OT-LAUNCH-01 Mishnayos'),
          'x-class-date': '2026-07-22',
        },
        body: 'synthetic protected video bytes',
      });
      const intakeText = await intake.text();
      expect(intake.status, intakeText).toBe(201);
      expect(intakeText).toContain('"state":"received"');
      expect(intakeText).toContain('"raw_source_path_present":false');
      expect(intakeText).not.toContain(intakeDirectory);

      const workspace = await fetch(`${server.baseUrl}/api/v1/admin/content/factory`, {
        headers: { cookie: owner.cookie },
      });
      const workspaceText = await workspace.text();
      expect(workspace.status, workspaceText).toBe(200);
      expect(workspaceText).toContain('"state":"needs_review"');
      expect(workspaceText).toContain('protected-class-video.mp4');
      expect(workspaceText).toContain('"raw_provider_url_present":false');
      expect(workspaceText).not.toContain('player.vimeo.com');
      expect(workspaceText).not.toContain('private_video_123');

      const approve = await mutate(server.baseUrl, owner, 'approve');
      expect(approve.status, await approve.clone().text()).toBe(200);
      const publish = await mutate(server.baseUrl, owner, 'publish');
      expect(publish.status, await publish.clone().text()).toBe(200);

      const published = await pool.query(
        `SELECT items.lifecycle_state, entitlements.entitlement_state
           FROM onetime.content_items AS items
           JOIN onetime.content_item_entitlements AS entitlements
             ON entitlements.content_item_key = items.content_item_key
          WHERE items.content_item_key = $1`,
        ['factory_sample_2026_07_22'],
      );
      expect(published.rows[0]).toMatchObject({
        lifecycle_state: 'published',
        entitlement_state: 'active',
      });

      for (const session of [parent, student]) {
        const playback = await fetch(
          `${server.baseUrl}/app/learning/items/factory_sample_2026_07_22`,
          { headers: { cookie: session.cookie } },
        );
        const html = await playback.text();
        expect(playback.status, html).toBe(200);
        expect(html).toContain('Protected One Time lesson');
        expect(html).toContain('<dt>Captions</dt><dd>Active</dd>');
        expect(html).toContain('/api/v1/content/factory/factory_sample_2026_07_22/embed');
        expect(html).not.toContain('player.vimeo.com');
        expect(html).not.toContain('private_video_123');
      }

      const embed = await fetch(
        `${server.baseUrl}/api/v1/content/factory/factory_sample_2026_07_22/embed`,
        { headers: { cookie: student.cookie }, redirect: 'manual' },
      );
      expect(embed.status).toBe(302);
      expect(embed.headers.get('location')).toBe(
        'https://player.vimeo.com/video/private_video_123',
      );
    } finally {
      await server.close();
    }
  });
});

async function ingestFixture() {
  const segments = Array.from({ length: 7 }, (_, index) => ({
    segment_id: `segment_${index + 1}`,
    start_ms: index * 9_000,
    end_ms: index * 9_000 + 8_000,
    text: [
      'The Mishnah introduces the first case from the class.',
      'Rabbi Scheller reads the next phrase from the text.',
      'The class reviews the example and its wording.',
      'A second case is compared with the first case.',
      'The Masechta wording is repeated for careful review.',
      'Students are asked to remember the two examples.',
      'The lesson closes with a review of the Mishnah text.',
    ][index]!,
  }));
  const normalizedTranscript = segments.map((segment) => segment.text).join(' ');
  const webvtt =
    'WEBVTT\n\n00:00:00.000 --> 00:00:08.000\nThe Mishnah introduces the first case.\n';
  await ingestContentFactoryItem({
    pool,
    config,
    item: {
      sourceKey: 'factory_sample_2026_07_22',
      sourceKind: 'local_drop',
      sourceRefDigest: digest('local-drop-source-ref'),
      sourceSha256: digest('local-drop-source'),
      displayName: 'operator-owned-sample.mov',
      mimeType: 'video/quicktime',
      byteLength: 4_200_000,
      originalDurationMs: 75_000,
      preparedDurationMs: 63_000,
      trimStartMs: 6_000,
      trimEndMs: 69_000,
      removedStartMs: 6_000,
      removedEndMs: 6_000,
      trimConfidence: 0.9,
      transcriptSegments: segments,
      normalizedTranscript,
      transcriptSha256: digest(normalizedTranscript),
      webvtt,
      webvttSha256: digest(webvtt),
      transcriptionModel: 'gpt-4o-mini-transcribe',
      transcriptionLanguage: 'en',
      draft: generateContentFactoryDraftFromTranscript({
        displayName: 'operator-owned-sample.mov',
        segments,
        classLabel: 'One Time Mishnayos',
        classDate: '2026-07-22',
      }),
      providerVideoId: 'private_video_123',
      providerEmbedUrl: 'https://player.vimeo.com/video/private_video_123',
      providerTextTrackId: 'private_track_456',
      vimeoPrivacy: 'private',
      captionsActive: true,
    },
  });
}

async function createUserSession(role: 'owner' | 'parent' | 'student', email: string) {
  const userKey = await createAccountUser({
    pool,
    config,
    email,
    password: 'ContentFactoryTestPass!234',
    displayName: `Content factory ${role}`,
    role,
  });
  const user = await getSessionUserByKey({ pool, config, userKey });
  if (!user) throw new Error(`missing ${role} test user`);
  const session = await createSession({ pool, config, user, assuranceMethod: 'password' });
  return {
    cookie: `otcrm_session=${session.session_token}`,
    csrfToken: session.csrf_token,
  };
}

function mutate(
  baseUrl: string,
  session: { cookie: string; csrfToken: string },
  action: 'approve' | 'publish',
) {
  return fetch(`${baseUrl}/api/v1/admin/content/factory/factory_sample_2026_07_22/${action}`, {
    method: 'POST',
    headers: {
      cookie: session.cookie,
      'content-type': 'application/json',
      'x-csrf-token': session.csrfToken,
    },
    body: '{}',
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
