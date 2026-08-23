import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../../../../../../packages/config/src/index.ts';
import type { DbPool } from '../../../../../../../packages/db/src/index.ts';
import {
  composeContentPublicationService,
  createContentPublicationFeatureRegistration,
  disabledVimeoBinding,
  disabledVimeoReadbackAdapter,
} from './composition.ts';

describe('P21 content-publication composition', () => {
  it('publishes one central feature descriptor for both protected route families', () => {
    const registration = createContentPublicationFeatureRegistration({
      resolveIdentity: async () => null,
      verifyCsrf: async () => false,
    });
    expect(registration).toMatchObject({
      featureId: 'onetime.content-publication',
      contractVersion: '1.0.0',
      mountPath: '/api',
    });
  });

  it('composes repository functionality while the default provider binding remains prohibited', () => {
    const config = testConfig();
    const binding = disabledVimeoBinding(config);
    expect(binding).toMatchObject({
      provider: 'vimeo',
      active: false,
      mutation_policy: 'prohibited',
      allowed_operation_types: [],
    });
    expect(() => composeContentPublicationService({ config, pool: unusedPool() })).not.toThrow();
  });

  it('does not preflight resume concurrency outside the service transaction', () => {
    const queries: string[] = [];
    expect(() =>
      composeContentPublicationService({ config: testConfig(), pool: tracedPool(queries) }),
    ).not.toThrow();
    expect(queries).toEqual([]);
  });

  it('keeps server-side provider readback unavailable outside the authority-gated worker', async () => {
    await expect(
      disabledVimeoReadbackAdapter().readCanonical({} as never, new AbortController().signal),
    ).rejects.toThrow('content_publication_vimeo_readback_unavailable');
  });

  it('ignores an injected Vimeo readback seam while the media gate is off', () => {
    const readCanonical = vi.fn();
    expect(() =>
      composeContentPublicationService({
        config: testConfig(),
        pool: unusedPool(),
        vimeoReadbackAdapter: { readCanonical },
        providerBinding: {
          registry_binding_key: 'vimeo_publication_primary',
          provider: 'vimeo',
          scope: {
            product: 'one_time_mishnayos',
            runtime_tier: 'isolated_staging',
            verification_environment_id: 'ci',
          },
          provider_account_ref_hash: 'a'.repeat(64),
          allowed_operation_types: ['publish_private'],
          mutation_policy: 'allowed',
          active: true,
        },
      }),
    ).not.toThrow();
    expect(readCanonical).not.toHaveBeenCalled();
  });
});

function testConfig() {
  return loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    AUTH_CSRF_SECRET: 'test-content-publication-csrf-secret',
  });
}

function unusedPool(): DbPool {
  const unavailable = async () => {
    throw new Error('P21 composition performed unexpected database access.');
  };
  return {
    connect: unavailable,
    query: unavailable,
    end: async () => undefined,
  } as unknown as DbPool;
}

function tracedPool(queries: string[]): DbPool {
  return {
    connect: async () => ({
      query: async (text: string) => {
        queries.push(text);
        return { rows: [], rowCount: 0 };
      },
      release: () => undefined,
    }),
    query: async () => ({ rows: [], rowCount: 0 }),
    end: async () => undefined,
  } as unknown as DbPool;
}
