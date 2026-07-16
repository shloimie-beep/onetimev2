import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../apps/web/src/server/app.ts';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';

const WEBHOOK_SECRET = 'ot85-fixture-webhook-secret';

let pool: DbPool;
let config: AppConfig;
let server: ReturnType<ReturnType<typeof createApp>['listen']>;
let baseUrl: string;

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    OUTBOX_TRANSPORT_MODE: 'sink',
    ONE_TIME_WHATSAPP_PROVIDER_ACCOUNT_KEY: 'ot85_meta_route',
    ONE_TIME_WHATSAPP_WEBHOOK_SECRET: WEBHOOK_SECRET,
    ONE_TIME_WHATSAPP_VERIFY_TOKEN: 'ot85-verify-token',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
  const app = createApp({ config, pool });
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (error?: Error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('missing server address');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
});

describe('OT-85 WhatsApp webhook route', () => {
  it('verifies challenge tokens, preserves raw bytes for signed Meta payloads, and rejects forged signatures', async () => {
    const challenge = await fetch(
      `${baseUrl}/api/v1/whatsapp/meta/webhook?hub.mode=subscribe&hub.verify_token=ot85-verify-token&hub.challenge=challenge-123`,
    );
    expect(challenge.status).toBe(200);
    expect(await challenge.text()).toBe('challenge-123');

    const rawBody = Buffer.from(
      JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: 'fixture_phone_number' },
                  messages: [
                    {
                      id: 'wamid.route.1',
                      from: '14155552671',
                      timestamp: '1784131200',
                      type: 'text',
                      text: { body: 'Hello' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }),
    );
    const accepted = await fetch(`${baseUrl}/api/v1/whatsapp/meta/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': signature(rawBody),
      },
      body: rawBody,
    });
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toMatchObject({
      success: true,
      code: 'accepted',
      accepted: 1,
    });

    const rejected = await fetch(`${baseUrl}/api/v1/whatsapp/meta/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256':
          'sha256=0000000000000000000000000000000000000000000000000000000000000000',
      },
      body: rawBody,
    });
    expect(rejected.status).toBe(403);
    await expectCount('whatsapp_inbox_events', 1);
  });
});

function signature(rawBody: Buffer) {
  return `sha256=${createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex')}`;
}

async function expectCount(table: string, expected: number) {
  const counts = await pool.query(`SELECT count(*)::int AS count FROM onetime.${table}`);
  const count = Array.isArray(counts.rows[0].count)
    ? counts.rows[0].count[0]
    : counts.rows[0].count;
  expect(count).toBe(expected);
}
