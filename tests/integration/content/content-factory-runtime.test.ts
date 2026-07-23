import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  assertNarrowContentFactoryReadiness,
  loadNarrowContentFactoryRuntime,
} from '../../../apps/worker/src/content-factory/runtime.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';

let pool: DbPool;
let storageRoot: string;

beforeEach(async () => {
  pool = createMemoryPool();
  await runMigrations(pool);
  storageRoot = await mkdtemp(path.join(tmpdir(), 'onetime-narrow-content-worker-'));
});

afterEach(async () => {
  await pool.end();
  await rm(storageRoot, { recursive: true, force: true });
});

describe('narrow content-factory readiness', () => {
  it('requires the writable volume and exact migration checksum', async () => {
    const runtime = loadNarrowContentFactoryRuntime({
      DATABASE_URL: 'postgres://isolated.invalid/onetime',
      CONTENT_FACTORY_WORKER_ENABLED: 'true',
      CONTENT_FACTORY_PROCESSING_MODE: 'synthetic',
      CONTENT_FACTORY_STORAGE_DRIVER: 'volume',
      CONTENT_FACTORY_STORAGE_ROOT: storageRoot,
    });
    await expect(assertNarrowContentFactoryReadiness({ pool, runtime })).resolves.toBeUndefined();

    await pool.query(
      `UPDATE onetime.schema_migrations SET checksum = 'wrong'
        WHERE id = '2223_content_factory_publish_ready_constraint'`,
    );
    await expect(assertNarrowContentFactoryReadiness({ pool, runtime })).rejects.toThrow(
      'content_factory_migration_checksum_mismatch',
    );
  });

  it('fails closed when the configured mount is absent', async () => {
    const runtime = loadNarrowContentFactoryRuntime({
      DATABASE_URL: 'postgres://isolated.invalid/onetime',
      CONTENT_FACTORY_WORKER_ENABLED: 'true',
      CONTENT_FACTORY_PROCESSING_MODE: 'synthetic',
      CONTENT_FACTORY_STORAGE_DRIVER: 'volume',
      CONTENT_FACTORY_STORAGE_ROOT: path.join(storageRoot, 'missing'),
    });
    await expect(assertNarrowContentFactoryReadiness({ pool, runtime })).rejects.toThrow(
      'content_factory_volume_mount_unavailable',
    );
  });
});
