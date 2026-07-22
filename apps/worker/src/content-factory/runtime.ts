import { constants } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig, type AppConfig } from '../../../../packages/config/src/index.ts';
import type { DbPool } from '../../../../packages/db/src/index.ts';

export const CONTENT_FACTORY_MIGRATION_ID = '2221_video_to_classroom_e2e';
export const CONTENT_FACTORY_MIGRATION_CHECKSUM =
  '25559ae6b514864c02e2e9ef2139a4906733cdeb9fe2208ca2db1b0a42f40536';

export type NarrowContentFactoryRuntime = {
  appConfig: AppConfig;
  pollIntervalMs: number;
  leaseMs: number;
  storageRoot: string;
  storageSource: NodeJS.ProcessEnv;
};

export function loadNarrowContentFactoryRuntime(
  source: NodeJS.ProcessEnv,
): NarrowContentFactoryRuntime {
  if (source.CONTENT_FACTORY_WORKER_ENABLED !== 'true') {
    throw new Error('content_factory_worker_not_enabled');
  }
  if (source.CONTENT_FACTORY_PROCESSING_MODE !== 'synthetic') {
    throw new Error('content_factory_external_provider_mode_forbidden');
  }
  if (source.CONTENT_FACTORY_STORAGE_DRIVER !== 'volume') {
    throw new Error('content_factory_volume_storage_required');
  }
  const databaseUrl = required(source.DATABASE_URL, 'content_factory_database_required');
  const storageRoot = required(
    source.CONTENT_FACTORY_STORAGE_ROOT,
    'content_factory_storage_root_required',
  );
  if (!path.isAbsolute(storageRoot)) throw new Error('content_factory_storage_root_not_absolute');
  const maxUploadBytes = boundedInteger(
    source.CONTENT_FACTORY_MAX_UPLOAD_BYTES,
    2_147_483_648,
    1,
    10_737_418_240,
    'content_factory_max_upload_bytes_invalid',
  );
  const pollIntervalMs = boundedInteger(
    source.CONTENT_FACTORY_POLL_INTERVAL_MS,
    1_000,
    100,
    60_000,
    'content_factory_poll_interval_invalid',
  );
  const leaseMs = boundedInteger(
    source.CONTENT_FACTORY_LEASE_MS,
    60_000,
    5_000,
    900_000,
    'content_factory_lease_invalid',
  );

  // Parse only the fields the content worker needs. Unrelated provider,
  // messaging, billing, and CRM variables never enter this process contract.
  const appConfig = loadConfig({
    NODE_ENV: 'development',
    DATABASE_URL: databaseUrl,
    DATABASE_SSL: source.DATABASE_SSL,
    APP_VERSION: source.APP_VERSION,
    COMMIT_SHA: source.COMMIT_SHA,
    RAILWAY_DEPLOYMENT_ID: source.RAILWAY_DEPLOYMENT_ID,
    RAILWAY_SNAPSHOT_ID: source.RAILWAY_SNAPSHOT_ID,
    RAILWAY_PROJECT_ID: source.RAILWAY_PROJECT_ID,
    RAILWAY_ENVIRONMENT_ID: source.RAILWAY_ENVIRONMENT_ID,
    RAILWAY_SERVICE_ID: source.RAILWAY_SERVICE_ID,
    RAILWAY_SERVICE_NAME: source.RAILWAY_SERVICE_NAME,
    RAILWAY_GIT_COMMIT_SHA: source.RAILWAY_GIT_COMMIT_SHA,
    OPERATIONS_WORKER_HEARTBEAT_TTL_MS: source.OPERATIONS_WORKER_HEARTBEAT_TTL_MS,
    ONE_TIME_ACCOUNT_KEY: source.ONE_TIME_ACCOUNT_KEY,
    ONE_TIME_PRODUCT_KEY: source.ONE_TIME_PRODUCT_KEY,
  });

  return {
    appConfig,
    pollIntervalMs,
    leaseMs,
    storageRoot,
    storageSource: {
      CONTENT_FACTORY_STORAGE_DRIVER: 'volume',
      CONTENT_FACTORY_STORAGE_ROOT: storageRoot,
      CONTENT_FACTORY_MAX_UPLOAD_BYTES: String(maxUploadBytes),
    },
  };
}

export async function assertNarrowContentFactoryReadiness(input: {
  pool: DbPool;
  runtime: NarrowContentFactoryRuntime;
}) {
  const details = await stat(input.runtime.storageRoot).catch(() => null);
  if (!details?.isDirectory()) throw new Error('content_factory_volume_mount_unavailable');
  await access(input.runtime.storageRoot, constants.R_OK | constants.W_OK).catch(() => {
    throw new Error('content_factory_volume_mount_not_writable');
  });
  await input.pool.query('SELECT 1');
  const migration = await input.pool.query(
    `SELECT checksum FROM onetime.schema_migrations WHERE id = $1 LIMIT 1`,
    [CONTENT_FACTORY_MIGRATION_ID],
  );
  if (!migration.rows[0]) throw new Error('content_factory_migration_missing');
  if (String(migration.rows[0].checksum) !== CONTENT_FACTORY_MIGRATION_CHECKSUM) {
    throw new Error('content_factory_migration_checksum_mismatch');
  }
}

function required(value: string | undefined, code: string) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  code: string,
) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(code);
  }
  return parsed;
}
