import { Buffer } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../apps/web/src/server/app.ts';
import { signResendSvixFixture } from '../../../apps/worker/src/delivery/provider-webhooks.ts';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';

let pool: DbPool;
let config: AppConfig;
let server: Awaited<ReturnType<typeof listenForTest>>;

const now = new Date('2026-07-18T21:05:00.000Z');
const timestamp = Math.floor(now.getTime() / 1000);
const secret = `whsec_${Buffer.from('w13-102-resend-webhook-secret').toString('base64')}`;

beforeEach(async () => {
  pool = createMemoryPool();
  await runMigrations(pool);
});

afterEach(async () => {
  await server?.close();
  await pool.end();
});

describe('W13-102 Resend webhook route', () => {
  it('durably records a signed raw-body event without storing provider refs in clear text', async () => {
    config = configuredApp();
    server = await listenForTest(createApp({ config, pool, clock: () => now }));
    const rawBody = resendBody();
    const first = await postResend(rawBody, 'svix_msg_w13_102_route');

    expect(first.status).toBe(202);
    expect(await first.json()).toMatchObject({
      success: true,
      code: 'RESEND_WEBHOOK_ACK',
      disposition: 'accepted',
    });

    const rows = await pool.query(
      `SELECT provider_event_ref_hash, canonical_state, object_refs, minimized_payload
         FROM onetime.provider_event_ledger
        WHERE provider = 'resend'`,
    );
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0]).toMatchObject({ canonical_state: 'delivered' });
    expect(JSON.stringify(rows.rows[0])).not.toContain('resend_evt_w13_102');
    expect(JSON.stringify(rows.rows[0])).not.toContain('resend_msg_w13_102');
    expect(rows.rows[0].object_refs).toMatchObject({
      message_ref_hash_present: true,
      svix_message_ref_hash_present: true,
    });

    const replay = await postResend(rawBody, 'svix_msg_w13_102_route');
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({
      success: true,
      disposition: 'replayed',
    });
  });

  it('rejects changed bytes for the same Svix id and rejects parsed or unsigned envelopes', async () => {
    config = configuredApp();
    server = await listenForTest(createApp({ config, pool, clock: () => now }));
    const rawBody = resendBody();
    expect((await postResend(rawBody, 'svix_msg_w13_102_digest')).status).toBe(202);

    const changed = resendBody({ type: 'email.complained' });
    const digestMismatch = await postResend(changed, 'svix_msg_w13_102_digest');
    expect(digestMismatch.status).toBe(409);
    expect(await digestMismatch.json()).toMatchObject({
      success: false,
      disposition: 'digest_mismatch',
    });

    const wrongType = await postResend(resendBody(), 'svix_msg_w13_102_wrong_type', {
      contentType: 'text/plain',
    });
    expect(wrongType.status).toBe(415);

    const unsigned = await fetch(`${server.baseUrl}/api/v1/delivery/resend/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: rawBody.toString('utf8'),
    });
    expect(unsigned.status).toBe(400);
    expect(await unsigned.json()).toMatchObject({ success: false, code: 'svix_headers_required' });
  });

  it('mounts safely but refuses provider intake while the runtime gate is disabled', async () => {
    config = loadConfig({
      NODE_ENV: 'test',
      PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
      APP_VERSION: 'resend-webhook-test',
      COMMIT_SHA: 'w13-102',
      OUTBOX_TRANSPORT_MODE: 'sink',
    });
    server = await listenForTest(createApp({ config, pool, clock: () => now }));

    const disabled = await fetch(`${server.baseUrl}/api/v1/delivery/resend/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: resendBody(),
    });
    expect(disabled.status).toBe(503);
    expect(await disabled.json()).toMatchObject({
      success: false,
      code: 'RESEND_WEBHOOK_DISABLED',
    });
  });
});

function configuredApp() {
  return loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'resend-webhook-test',
    COMMIT_SHA: 'w13-102',
    OUTBOX_TRANSPORT_MODE: 'sink',
    ONE_TIME_RESEND_WEBHOOK_ENABLED: 'true',
    RESEND_WEBHOOK_SECRET: secret,
  });
}

async function postResend(
  rawBody: Buffer,
  svixId: string,
  options: { contentType?: string | undefined } = {},
) {
  const headers = signResendSvixFixture({
    rawBody,
    webhookSecret: secret,
    id: svixId,
    timestamp,
  });
  return fetch(`${server.baseUrl}/api/v1/delivery/resend/webhook`, {
    method: 'POST',
    headers: {
      'content-type': options.contentType ?? 'application/json',
      'svix-id': headers.id,
      'svix-timestamp': headers.timestamp,
      'svix-signature': headers.signature,
    },
    body: rawBody.toString('utf8'),
  });
}

function resendBody(
  overrides: Partial<Record<'id' | 'type' | 'message_id' | 'created_at', string>> = {},
) {
  return Buffer.from(
    JSON.stringify({
      id: 'resend_evt_w13_102',
      type: 'email.delivered',
      message_id: 'resend_msg_w13_102',
      created_at: now.toISOString(),
      ...overrides,
    }),
  );
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
