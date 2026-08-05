import { describe, expect, it } from 'vitest';
import {
  contentFactoryChildEnvironment,
  railwayProcessEntries,
} from '../../../scripts/railway-start.mjs';

describe('Railway content-factory colocation', () => {
  it('starts web plus the narrow content worker, never the general worker', () => {
    expect(
      railwayProcessEntries({ PROCESS_TYPE: 'web', CONTENT_FACTORY_COLOCATED_WORKER: 'true' }).map(
        ({ entry }) => entry,
      ),
    ).toEqual(['apps/web/src/server/index.ts', 'apps/worker/src/content-factory/index.ts']);
  });

  it('passes only the narrow database, volume, runtime, and identity allowlist', () => {
    const child = contentFactoryChildEnvironment({
      DATABASE_URL: 'postgres://isolated.invalid/onetime',
      CONTENT_FACTORY_STORAGE_ROOT: '/var/lib/onetime/content-factory',
      CONTENT_FACTORY_WORKER_ENABLED: 'true',
      CONTENT_FACTORY_PROCESSING_MODE: 'synthetic',
      RESEND_API_KEY: 'must-not-pass',
      HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN: 'must-not-pass',
      ONE_TIME_TELEGRAM_WEBHOOK_SECRET: 'must-not-pass',
      VIMEO_ACCESS_TOKEN: 'must-not-pass',
      OPENAI_API_KEY: 'must-not-pass',
    });
    expect(child).toMatchObject({
      DATABASE_URL: 'postgres://isolated.invalid/onetime',
      CONTENT_FACTORY_STORAGE_ROOT: '/var/lib/onetime/content-factory',
      CONTENT_FACTORY_WORKER_ENABLED: 'true',
      CONTENT_FACTORY_PROCESSING_MODE: 'synthetic',
    });
    expect(Object.keys(child)).not.toEqual(
      expect.arrayContaining([
        'RESEND_API_KEY',
        'HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN',
        'ONE_TIME_TELEGRAM_WEBHOOK_SECRET',
        'VIMEO_ACCESS_TOKEN',
        'OPENAI_API_KEY',
      ]),
    );
  });
});
