import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../apps/web/src/server/app.ts';
import {
  LEARNING_DELIVERY_DEMO_API_ROUTE,
  LEARNING_DELIVERY_DEMO_ROUTE,
} from '../../../apps/web/src/server/features/learning-delivery-demo/router.ts';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  createAccountUser,
  createSession,
  getSessionUserByKey,
} from '../../../packages/domain/src/index.ts';

let pool: DbPool;
let config: AppConfig;
let distDir: string;
let reportPath: string;

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
  distDir = await mkdtemp(path.join(tmpdir(), 'learning-delivery-demo-dist-'));
  await writePortalShells(distDir);
  const reportDir = await mkdtemp(path.join(tmpdir(), 'learning-delivery-demo-report-'));
  reportPath = path.join(reportDir, 'REAL-MEDIA-CANARY.json');
  await writeFile(reportPath, JSON.stringify(safeReportFixture()), 'utf8');
});

afterEach(async () => {
  await pool.end();
  await rm(distDir, { recursive: true, force: true });
  await rm(path.dirname(reportPath), { recursive: true, force: true });
});

describe('Learning Delivery prepared Vimeo demo route', () => {
  it('is owner/admin protected and exposes only sanitized prepared-asset metadata', async () => {
    const admin = await createUserSession('admin', 'autotrim-admin@example.test');
    const viewer = await createUserSession('viewer', 'autotrim-viewer@example.test');
    const server = await listenForTest(
      createApp({ config, pool, distDir, learningDeliveryDemoReportPath: reportPath }),
    );
    try {
      const anonymous = await fetch(`${server.baseUrl}${LEARNING_DELIVERY_DEMO_ROUTE}`, {
        redirect: 'manual',
      });
      expect(anonymous.status).toBe(302);
      expect(anonymous.headers.get('location')).toContain(
        'return_to=%2Fapp%2Flearning-delivery%2Fdemo%2Fvimeo-autotrim',
      );

      const forbidden = await fetch(`${server.baseUrl}${LEARNING_DELIVERY_DEMO_ROUTE}`, {
        headers: { cookie: viewer.cookie },
      });
      expect(forbidden.status).toBe(403);

      const page = await fetch(`${server.baseUrl}${LEARNING_DELIVERY_DEMO_ROUTE}`, {
        headers: { cookie: admin.cookie },
      });
      const html = await page.text();
      expect(page.status, html).toBe(200);
      expect(page.headers.get('cache-control')).toContain('no-store');
      expect(html).toContain('Prepared Vimeo Demo Lesson');
      expect(html).toContain('Original duration');
      expect(html).toContain('Captions');
      expect(html).not.toMatch(/https?:\/\/|Bearer\s+|raw_transcript_text/i);

      const api = await fetch(`${server.baseUrl}${LEARNING_DELIVERY_DEMO_API_ROUTE}`, {
        headers: { cookie: admin.cookie },
      });
      const apiText = await api.text();
      expect(api.status, apiText).toBe(200);
      expect(apiText).toContain('"raw_provider_url_present":false');
      expect(apiText).toContain('"raw_transcript_present":false');
      expect(apiText).not.toMatch(/https?:\/\/|Bearer\s+|raw_transcript_text/i);
    } finally {
      await server.close();
    }
  });
});

async function createUserSession(role: 'admin' | 'viewer', email: string) {
  const userKey = await createAccountUser({
    pool,
    config,
    email,
    password: 'LearningDeliveryDemoPass!234',
    displayName: `Learning Delivery ${role}`,
    role,
  });
  const user = await getSessionUserByKey({ pool, config, userKey });
  if (!user) throw new Error(`missing test user ${role}`);
  const session = await createSession({ pool, config, user, assuranceMethod: 'password' });
  return { cookie: `otcrm_session=${session.session_token}` };
}

function safeReportFixture() {
  return {
    generated_at: '2026-07-21T00:00:00.000Z',
    source: {
      source_kind: 'operator_owned_real_media_canary',
      source_sha256: 'a'.repeat(64),
      source_path_sha256: 'b'.repeat(64),
      original_duration_ms: 120_000,
      prepared_duration_ms: 106_000,
    },
    trim: {
      start_ms: 12_500,
      end_ms: 118_500,
      removed_start_ms: 12_500,
      removed_end_ms: 1_500,
      removed_percent: 0.1167,
      confidence: 0.9,
      auto_cut_performed: true,
      safe_exception_code: null,
    },
    transcription: {
      provider: 'openai',
      provider_model_version: 'gpt-4o-mini-transcribe',
      language: 'en',
      segment_count: 8,
      transcript_sha256: 'c'.repeat(64),
      webvtt_sha256: 'd'.repeat(64),
      corrected_transcript_version: 'v1-reviewed-webvtt',
      raw_transcript_present: false,
      approved_torah_interpretation: false,
    },
    vimeo: {
      status: 'ready',
      privacy: 'private',
      provider_video_id_present: true,
      provider_video_ref_digest: 'e'.repeat(64),
      text_track_status: 'ready',
      text_track_active: true,
      provider_text_track_ref_digest: 'f'.repeat(64),
      playback_verified: true,
      raw_provider_url_present: false,
    },
    preview: {
      demo_lesson_key: 'demo_autotrim_001',
      route: LEARNING_DELIVERY_DEMO_ROUTE,
      playback_kind: 'server_authorized_vimeo_playback',
      playback_route: '/api/v1/content/vimeo/source_demo_safe_001/playback',
    },
  };
}

async function writePortalShells(targetDir: string) {
  await mkdir(path.join(targetDir, 'app'), { recursive: true });
  await mkdir(path.join(targetDir, 'assets'), { recursive: true });
  await writeFile(path.join(targetDir, 'app', 'parent.html'), '<div id="portal-root"></div>');
  await writeFile(path.join(targetDir, 'app', 'student.html'), '<div id="portal-root"></div>');
  await writeFile(path.join(targetDir, 'app', 'crm.html'), '<div id="crm-root"></div>');
  await writeFile(path.join(targetDir, '404.html'), '<h1>Not found</h1>');
  await writeFile(path.join(targetDir, 'assets', 'app-crm.css'), '');
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
