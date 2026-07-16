import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../apps/web/src/server/app.ts';
import { loadConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, type DbPool } from '../../../packages/db/src/index.ts';

let pool: DbPool;
let server: Server;
let baseUrl: string;

beforeEach(async () => {
  const config = loadConfig({
    NODE_ENV: 'test',
    APP_VERSION: 'ops05-test',
    COMMIT_SHA: '97fa0c91758888f4e9de0af17d70002a0124669f',
    OUTBOX_TRANSPORT_MODE: 'sink',
    AUTH_CSRF_SECRET: 'local-only-auth-csrf-secret-for-tests-and-development',
  });
  pool = createMemoryPool();
  const app = createApp({ config, pool });
  server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected local test port.');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await pool.end();
});

describe('OPS-05 web health and source readback routes', () => {
  it('exposes healthz, readyz, and version with source and mode headers', async () => {
    const health = await fetch(`${baseUrl}/healthz`);
    expect(health.status).toBe(200);
    expect(health.headers.get('x-onetime-source-sha')).toBe(
      '97fa0c91758888f4e9de0af17d70002a0124669f',
    );
    expect(health.headers.get('x-onetime-config-mode')).toBe('test');
    expect(health.headers.get('x-onetime-provider-mode')).toBe('sink');
    const healthBody = await health.json();
    expect(healthBody).toMatchObject({
      ok: true,
      service_key: 'onetime-web',
      target_app: 'one-time',
      config_mode: 'test',
      provider_mode: 'sink',
      bna_support_mode: 'async_only',
    });

    const ready = await fetch(`${baseUrl}/readyz`);
    expect(ready.status).toBe(200);
    const readyBody = await ready.json();
    expect(readyBody.ok).toBe(true);
    expect(readyBody.database_reference_present).toBe(false);

    const version = await fetch(`${baseUrl}/version`);
    expect(version.status).toBe(200);
    const versionBody = await version.json();
    expect(versionBody).toMatchObject({
      target_app: 'one-time',
      version: 'ops05-test',
      source_sha: '97fa0c91758888f4e9de0af17d70002a0124669f',
      config_mode: 'test',
      provider_mode: 'sink',
    });
    expect(JSON.stringify(versionBody)).not.toMatch(/secret|token|database_url|cookie/i);
  });
});
