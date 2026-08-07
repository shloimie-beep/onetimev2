import { describe, expect, it, vi } from 'vitest';

import { loadConfig } from '../../../../../../packages/config/src/index.ts';
import { createContentMediaWebRuntime } from './media-runtime.ts';

describe('createContentMediaWebRuntime', () => {
  it('creates no provider runtime and performs zero provider/database calls while mode is off', () => {
    const pool = { query: vi.fn(() => Promise.reject(new Error('database call forbidden'))) };
    const dependencies = new Proxy(
      {},
      {
        get() {
          throw new Error('provider dependency touched while off');
        },
      },
    );

    expect(
      createContentMediaWebRuntime({
        config: loadConfig({ NODE_ENV: 'test', ONE_TIME_CONTENT_MEDIA_MODE: 'off' }),
        pool: pool as never,
        source: {},
        dependencies: dependencies as never,
      }),
    ).toBeUndefined();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('leaves the safe app available when production-broad providers are incomplete', () => {
    const pool = { query: vi.fn(() => Promise.reject(new Error('database call forbidden'))) };
    const dependencies = new Proxy(
      {},
      {
        get() {
          throw new Error('provider dependency touched while broad runtime is incomplete');
        },
      },
    );
    const config = loadConfig({
      NODE_ENV: 'production',
      ONE_TIME_RUNTIME_ENVIRONMENT: 'production',
      ONE_TIME_VERIFICATION_ENVIRONMENT_ID: 'production_broad',
      ONE_TIME_CONTENT_MEDIA_MODE: 'production_broad',
      ONE_TIME_CONTENT_MEDIA_AUTHORIZATION_ID: 'broad-authority-test',
      ONE_TIME_FIRST_CLASS_AT: '2026-08-16T19:00:00+03:00',
      ONE_TIME_FREE_ACCESS_EXPIRES_AT: '2026-09-11T18:00:00+03:00',
      AUTH_CSRF_SECRET: 'content-media-production-csrf-secret',
      PROTECTED_PAYLOAD_ENCRYPTION_KEY: 'content-media-production-payload-key',
    });

    expect(
      createContentMediaWebRuntime({
        config,
        pool: pool as never,
        source: {},
        dependencies: dependencies as never,
      }),
    ).toBeUndefined();
    expect(pool.query).not.toHaveBeenCalled();
  });
});
