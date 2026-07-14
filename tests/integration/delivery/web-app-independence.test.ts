import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import { createApp } from '../../../apps/web/src/server/app.ts';
import { runDeliveryBatch } from '../../../apps/worker/src/delivery/worker.ts';
import type {
  DeliveryProviderRouter,
  ProviderReceipt,
} from '../../../packages/contracts/src/delivery/types.ts';
import { captureLogger } from '../../support/delivery/logger.ts';
import { MemoryDeliveryRepository } from '../../support/delivery/memory-repository.ts';
import { BASE_TIME, claimedDelivery } from '../../support/delivery/fixtures.ts';

let pool: DbPool;
let server: ReturnType<ReturnType<typeof createApp>['listen']>;
let baseUrl: string;

const appConfig = () =>
  loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    OUTBOX_TRANSPORT_MODE: 'sink',
  });

beforeEach(async () => {
  pool = createMemoryPool();
  const config = appConfig();
  await runMigrations(pool);
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

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await pool.end();
});

describe('web process independence from delivery worker', () => {
  it('keeps landing/signup usable while a worker batch fails in isolation', async () => {
    const healthBefore = await fetch(`${baseUrl}/health`);
    expect(healthBefore.status).toBe(200);

    const repository = new MemoryDeliveryRepository([
      {
        ...claimedDelivery({ id: 'worker-failure' }),
        status: 'pending',
        nextAttemptAt: new Date(0),
      },
    ]);
    const router: DeliveryProviderRouter = {
      async send(): Promise<ProviderReceipt> {
        throw new TypeError('network failed before provider response');
      },
    };
    const { logger } = captureLogger();
    const summary = await runDeliveryBatch({
      repository,
      router,
      logger,
      messageConfig: {
        emailFrom: 'One Time <delivery@example.test>',
        protectedOwnerEmail: 'owner@protected.test',
      },
      options: {
        accountKey: 'one_time',
        productKey: 'one_time_mishnah_class',
        batchSize: 25,
        concurrency: 4,
        claimLeaseMs: 120_000,
        providerTimeoutMs: 25,
        maxAttempts: 5,
      },
      clock: () => BASE_TIME,
    });
    expect(summary).toMatchObject({ claimed: 1, retried: 1 });

    const signup = await fetch(`${baseUrl}/api/v1/leads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contact_name: 'Lead Parent',
        family_or_school: 'Lead Family',
        audience_type: 'family',
        location: 'Ramat Beit Shemesh',
        timezone: 'Asia/Jerusalem',
        email: 'lead-independent@example.test',
        phone: '',
        reminder_preference: 'email',
        reminder_consent: true,
        idempotency_key: 'idem-independent-1',
        attribution: { landing_path: '/signup' },
      }),
    });
    expect(signup.status).toBe(200);
    const json = (await signup.json()) as { success: boolean; outbox_intents: string[] };
    expect(json.success).toBe(true);
    expect(json.outbox_intents).toHaveLength(2);

    const healthAfter = await fetch(`${baseUrl}/health`);
    expect(healthAfter.status).toBe(200);
  });
});
