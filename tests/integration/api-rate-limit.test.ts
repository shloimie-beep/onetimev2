import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import { createApp } from '../../apps/web/src/server/app.ts';
import { resetLeadRateLimitForTests } from '../../apps/web/src/server/rate-limit.ts';

let server: ReturnType<ReturnType<typeof createApp>['listen']>;
let baseUrl: string;
let pool: DbPool;

const payload = (index: number) => ({
  contact_name: `Rate Parent ${index}`,
  family_or_school: 'Rate Family',
  audience_type: 'family',
  location: 'Jerusalem',
  timezone: 'Asia/Jerusalem',
  email: `rate-${index}@example.test`,
  phone: '',
  reminder_preference: 'email',
  reminder_consent: true,
  idempotency_key: `rate-limit-${index}`,
});

beforeAll(async () => {
  const config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    LEAD_RATE_LIMIT_WINDOW_MS: '60000',
    LEAD_RATE_LIMIT_MAX: '2',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
  resetLeadRateLimitForTests();
  const app = createApp({ config, pool });
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (error?: Error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('missing test server address');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
  await pool.end();
});

describe('lead API rate limiting', () => {
  it('shares one durable budget across public lead aliases', async () => {
    const first = await fetch(`${baseUrl}/api/v1/leads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload(1)),
    });
    const second = await fetch(`${baseUrl}/api/one-time/interest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload(2)),
    });
    const third = await fetch(`${baseUrl}/api/v1/leads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload(3)),
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(third.headers.get('retry-after')).toBeTruthy();
    expect(await third.json()).toMatchObject({ success: false, code: 'RATE_LIMITED' });
  });
});
