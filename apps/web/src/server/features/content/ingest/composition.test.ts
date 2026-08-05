import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../../../../../../packages/config/src/index.ts';
import type { DbPool } from '../../../../../../../packages/db/src/index.ts';
import {
  createContentIngestFeatureRegistration,
  disabledManagedOriginalAdapter,
} from './composition.ts';

describe('content ingest composition', () => {
  it('binds the exact collision-free feature mount', () => {
    expect(
      createContentIngestFeatureRegistration({
        resolveIdentity: async () => null,
        verifyCsrf: async () => false,
      }),
    ).toMatchObject({
      featureId: 'onetime.content-ingest',
      mountPath: '/api/app/content/ingest',
      contractVersion: '1.0.0',
    });
  });

  it('constructs the default-off router without database or provider preflight', () => {
    const config = loadConfig({ NODE_ENV: 'test' });
    const calls: string[] = [];
    const registration = createContentIngestFeatureRegistration({
      resolveIdentity: async () => null,
      verifyCsrf: async () => false,
    });
    expect(() =>
      registration.createRouter({
        config,
        pool: unavailablePool(calls),
        distDir: 'unused',
      }),
    ).not.toThrow();
    expect(calls).toEqual([]);
  });

  it('keeps the managed-original adapter fail closed without an injected client', async () => {
    const adapter = disabledManagedOriginalAdapter(loadConfig({ NODE_ENV: 'test' }));
    await expect(
      adapter.beginDirectUpload({
        uploadSessionId: 'upload-one',
        opaqueObjectKey: 'source-one',
        byteCount: 1,
        mimeType: 'video/mp4',
      }),
    ).rejects.toThrow('content_media_default_off');
  });
});

function unavailablePool(calls: string[]): DbPool {
  const unavailable = async () => {
    calls.push('database');
    throw new Error('unexpected_database_access');
  };
  return { query: unavailable, connect: unavailable, end: async () => undefined } as never;
}
