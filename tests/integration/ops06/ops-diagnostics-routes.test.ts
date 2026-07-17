import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import { createApp } from '../../../apps/web/src/server/app.ts';

let pool: DbPool;
let config: AppConfig;

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'ops06-route-test',
    COMMIT_SHA: 'fb5f5eebc539afc9e93833e9417ee67524d62c36',
    OUTBOX_TRANSPORT_MODE: 'sink',
    OPERATIONS_PROBE_TOKEN: 'ops06-route-probe-token-0001',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
});

afterEach(async () => {
  await pool.end();
});

describe('OPS-06 diagnostics routes', () => {
  it('keeps /health as liveness and /ready as dependency readiness', async () => {
    await withServer(async (baseUrl) => {
      const health = await fetch(`${baseUrl}/health`);
      expect(health.status).toBe(200);
      expect(await health.json()).toMatchObject({ ok: true, service: 'onetime-web' });

      const ready = await fetch(`${baseUrl}/ready`);
      expect(ready.status).toBe(200);
      const body = await ready.json();
      expect(body).toMatchObject({ ok: true, service: 'onetime-web' });
      expect(body.dependencies.map((dependency: { name: string }) => dependency.name)).toContain(
        'database',
      );
      expect(
        body.optional_dependencies.some(
          (dependency: { status: string }) => dependency.status === 'disabled',
        ),
      ).toBe(true);
    });
  });

  it('protects machine diagnostics and emits account/product safe queue metrics', async () => {
    await withServer(async (baseUrl) => {
      const forbidden = await fetch(`${baseUrl}/api/internal/ops/diagnostics`);
      expect(forbidden.status).toBe(403);

      const diagnostics = await fetch(`${baseUrl}/api/internal/ops/diagnostics`, {
        headers: { 'x-ops-probe-token': config.operationsProbeToken ?? '' },
      });
      expect(diagnostics.status).toBe(200);
      const body = await diagnostics.json();
      expect(body.snapshot).toMatchObject({
        schema_version: 'ops.health.v1',
        account_key: config.accountKey,
        product_key: config.productKey,
      });
      expect(JSON.stringify(body)).not.toMatch(/token|password|secret/i);

      const metrics = await fetch(`${baseUrl}/api/internal/ops/metrics`, {
        headers: { 'x-ops-probe-token': config.operationsProbeToken ?? '' },
      });
      expect(metrics.status).toBe(200);
      const text = await metrics.text();
      expect(text).toContain('onetime_ready 1');
      expect(text).toContain('onetime_queue_ready_count{queue="delivery_outbox"}');
    });
  });
});

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const app = createApp({ config, pool });
  const server = app.listen(0);
  try {
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('Test server did not bind a port.');
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}
