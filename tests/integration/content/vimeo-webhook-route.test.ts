import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../../apps/web/src/server/app.ts';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';

let pool: DbPool;
let server: Awaited<ReturnType<typeof listenForTest>>;

const now = new Date('2026-08-06T08:00:00.000Z');
const webhookSecret = 'test-only-vimeo-payload-secret';
const accountId = 'vimeo_account_route_fixture';

beforeEach(async () => {
  pool = createMemoryPool();
  await runMigrations(pool);
});

afterEach(async () => {
  await server?.close();
  await pool.end();
});

describe('Vimeo webhook route', () => {
  it('verifies the provider payload secret and durably normalizes an official event type', async () => {
    server = await listenForTest(createApp({ config: configuredApp(), pool, clock: () => now }));
    const rawBody = body();

    const first = await post(rawBody);
    expect(first.status).toBe(202);
    expect(await first.json()).toMatchObject({
      success: true,
      code: 'source_not_found_recorded',
      receipt_state: 'ignored',
    });

    const replay = await post(rawBody);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ code: 'duplicate', receipt_state: 'duplicate' });

    const rows = await pool.query(
      `SELECT event_type, processing_state, payload_minimized_json
         FROM onetime.ot104r_vimeo_webhook_receipts`,
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toMatchObject({
      event_type: 'video.transcode.complete',
      processing_state: 'ignored',
    });
    expect(JSON.stringify(rows.rows)).not.toContain(webhookSecret);
  });

  it('rejects a missing or incorrect payload secret before any durable write', async () => {
    server = await listenForTest(createApp({ config: configuredApp(), pool, clock: () => now }));

    const response = await post(body({ secret: 'incorrect-vimeo-secret' }));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ success: false, code: 'unauthorized' });
    expect(
      (await pool.query(`SELECT COUNT(*)::int AS count FROM onetime.ot104r_vimeo_webhook_receipts`))
        .rows[0]?.count,
    ).toBe(0);
  });

  it('mounts safely but refuses intake while the protected provider identity is absent', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
      APP_VERSION: 'vimeo-webhook-route-test',
      COMMIT_SHA: 'vimeo-webhook-route-test',
      OUTBOX_TRANSPORT_MODE: 'sink',
    });
    server = await listenForTest(createApp({ config, pool, clock: () => now }));

    const response = await post(body());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'VIMEO_WEBHOOK_DISABLED',
    });
  });
});

function configuredApp(): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'vimeo-webhook-route-test',
    COMMIT_SHA: 'vimeo-webhook-route-test',
    OUTBOX_TRANSPORT_MODE: 'sink',
    VIMEO_WEBHOOK_SECRET: webhookSecret,
    VIMEO_ACCOUNT_ID: accountId,
  });
}

function body(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    id: 'vimeo_event_route_fixture',
    event_type: 'video-transcode-complete',
    secret: webhookSecret,
    account_id: accountId,
    video_uri: '/videos/vimeo_video_route_fixture',
    created_time: now.toISOString(),
    ...overrides,
  });
}

function post(rawBody: string) {
  return fetch(`${server.baseUrl}/api/v1/content/vimeo/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: rawBody,
  });
}

async function listenForTest(app: ReturnType<typeof createApp>) {
  const instance = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const serverInstance = app.listen(0, (error?: Error) => {
      if (error) reject(error);
      else resolve(serverInstance);
    });
  });
  const address = instance.address();
  if (typeof address !== 'object' || !address) throw new Error('missing test server address');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => instance.close(() => resolve())),
  };
}
