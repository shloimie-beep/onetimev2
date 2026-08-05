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
});
