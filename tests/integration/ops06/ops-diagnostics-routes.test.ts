import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import { createApp } from '../../../apps/web/src/server/app.ts';
import {
  createAccountUser,
  createSession,
  getSessionUserByKey,
} from '../../../packages/domain/src/index.ts';

let pool: DbPool;
let config: AppConfig;
let ownerCookie: string;

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'ops06-route-test',
    COMMIT_SHA: 'fb5f5eebc539afc9e93833e9417ee67524d62c36',
    RAILWAY_DEPLOYMENT_ID: 'protected-deployment-fixture',
    RAILWAY_SNAPSHOT_ID: 'protected-snapshot-fixture',
    RAILWAY_PROJECT_ID: 'protected-project-fixture',
    RAILWAY_ENVIRONMENT_ID: 'protected-environment-fixture',
    RAILWAY_SERVICE_ID: 'protected-service-fixture',
    RAILWAY_SERVICE_NAME: 'protected-service-name-fixture',
    RAILWAY_GIT_COMMIT_SHA: 'a'.repeat(40),
    OUTBOX_TRANSPORT_MODE: 'sink',
    OPERATIONS_PROBE_TOKEN: 'ops06-route-probe-token-0001',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
  const userKey = await createAccountUser({
    pool,
    config,
    email: 'ops06.owner@example.test',
    password: 'Ops06OwnerPassword!234',
    displayName: 'OPS 06 Owner',
    role: 'owner',
  });
  const user = await getSessionUserByKey({ pool, config, userKey });
  if (!user) throw new Error('missing OPS 06 owner fixture');
  const session = await createSession({ pool, config, user });
  ownerCookie = `otcrm_session=${session.session_token}`;
});

afterEach(async () => {
  await pool.end();
});

describe('OPS-06 diagnostics routes', () => {
  it('keeps /health as liveness and /ready as dependency readiness', async () => {
    await withServer(async (baseUrl) => {
      const health = await fetch(`${baseUrl}/health`);
      expect(health.status).toBe(200);
      expect(await health.json()).toEqual({
        ok: true,
        service: 'onetime-web',
        code: 'PUBLIC_HEALTH_OK',
      });
      expect(health.headers.get('cache-control')).toContain('no-store');

      const ready = await fetch(`${baseUrl}/ready`);
      expect(ready.status).toBe(200);
      const body = await ready.json();
      expect(body).toEqual({ ok: true, service: 'onetime-web', code: 'PUBLIC_READY' });
      expect(ready.headers.get('cache-control')).toContain('no-store');
      expect(JSON.stringify(body)).not.toMatch(
        /dependenc|migration|provider|blocker|generated|commit|deploy|railway/i,
      );

      const version = await fetch(`${baseUrl}/version`);
      expect(version.status).toBe(200);
      expect(await version.json()).toEqual({
        ok: true,
        service: 'onetime-web',
        code: 'PUBLIC_RELEASE_AVAILABLE',
      });
      expect(version.headers.get('cache-control')).toContain('no-store');
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
      expect(body.runtime).toEqual({
        version: 'ops06-route-test',
        commit_sha: 'fb5f5eebc539afc9e93833e9417ee67524d62c36',
        target_app: 'one-time',
        deployment: {
          provider: 'railway',
          deployment_id: 'protected-deployment-fixture',
          snapshot_id: 'protected-snapshot-fixture',
          project_id: 'protected-project-fixture',
          environment_id: 'protected-environment-fixture',
          service_id: 'protected-service-fixture',
          service_name: 'protected-service-name-fixture',
          git_commit_sha: 'a'.repeat(40),
        },
      });
      expect(JSON.stringify(body)).not.toMatch(/token|password|secret/i);
      expect(diagnostics.headers.get('cache-control')).toContain('no-store');

      const metrics = await fetch(`${baseUrl}/api/internal/ops/metrics`, {
        headers: { 'x-ops-probe-token': config.operationsProbeToken ?? '' },
      });
      expect(metrics.status).toBe(200);
      const text = await metrics.text();
      expect(text).toContain('onetime_ready 1');
      expect(text).toContain('onetime_queue_ready_count{queue="delivery_outbox"}');

      const ownerDiagnostics = await fetch(`${baseUrl}/api/v1/ops/diagnostics`, {
        headers: { cookie: ownerCookie },
      });
      expect(ownerDiagnostics.status).toBe(200);
      expect(await ownerDiagnostics.json()).toMatchObject({
        success: true,
        runtime: {
          commit_sha: 'fb5f5eebc539afc9e93833e9417ee67524d62c36',
          deployment: { deployment_id: 'protected-deployment-fixture' },
        },
      });
      expect(ownerDiagnostics.headers.get('cache-control')).toContain('no-store');
    });
  });

  it('returns only a fixed public code when readiness dependencies fail', async () => {
    const unavailablePool = {
      connect: pool.connect.bind(pool),
      query: async () => {
        throw new Error(
          'connection to internal-db-host failed for table onetime.schema_migrations',
        );
      },
      end: async () => undefined,
    } as unknown as DbPool;

    await withServer(async (baseUrl) => {
      const ready = await fetch(`${baseUrl}/ready`);
      expect(ready.status).toBe(503);
      const serialized = JSON.stringify(await ready.json());
      expect(JSON.parse(serialized)).toEqual({
        ok: false,
        service: 'onetime-web',
        code: 'PUBLIC_NOT_READY',
      });
      expect(serialized).not.toMatch(
        /internal-db-host|schema_migrations|database|dependenc|migration|provider|blocker/i,
      );
      expect(ready.headers.get('cache-control')).toContain('no-store');
    }, unavailablePool);
  });
});

async function withServer(run: (baseUrl: string) => Promise<void>, targetPool: DbPool = pool) {
  const app = createApp({ config, pool: targetPool });
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
