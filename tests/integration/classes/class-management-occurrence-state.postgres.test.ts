import pg from 'pg';
import { afterEach, describe, expect, it } from 'vitest';

import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { updateClassOccurrencePayloadSchema } from '../../../packages/contracts/src/classes/index.ts';
import { runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  createManagedClassOccurrence,
  updateManagedClassOccurrence,
} from '../../../packages/domain/src/index.ts';

const nativeDatabaseUrl = process.env.OT_P0_NATIVE_CLEANUP_DATABASE_URL;
const nativeProofEnabled =
  process.env.OT_P0_NATIVE_POSTGRES_DISPOSABLE === 'true' && Boolean(nativeDatabaseUrl);

const actor = { userKey: 'owner_cleanup_contract', role: 'owner' as const };

describe.runIf(nativeProofEnabled)('OT-P0 native PostgreSQL occurrence-state contract', () => {
  let pool: DbPool;
  let config: AppConfig;
  let ownsNativeSchema = false;

  afterEach(async () => {
    if (ownsNativeSchema) await pool.query('DROP SCHEMA IF EXISTS onetime CASCADE');
    await pool?.end();
  });

  it('persists the valid cleanup state with canonical storage spelling and rejects the internal spelling', async () => {
    pool = new pg.Pool({ connectionString: nativeDatabaseUrl!, max: 2 });
    const database = await pool.query(
      `SELECT current_database() AS database_name,
              current_setting('server_version') AS server_version`,
    );
    expect(database.rows[0]?.database_name).toBe('ot_p0_cleanup_contract');
    expect(Number.parseInt(String(database.rows[0]?.server_version), 10)).toBeGreaterThanOrEqual(
      16,
    );
    const blank = await pool.query(
      `SELECT count(*)::integer AS table_count
         FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')`,
    );
    expect(blank.rows[0]).toEqual({ table_count: 0 });
    ownsNativeSchema = true;
    await runMigrations(pool);
    config = loadConfig({
      NODE_ENV: 'test',
      PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
      APP_VERSION: 'native-cleanup-contract',
      COMMIT_SHA: 'native-cleanup-contract',
      OUTBOX_TRANSPORT_MODE: 'sink',
      ONE_TIME_RUNTIME_ENVIRONMENT: 'isolated_staging',
    });

    const canonicalSeries = await pool.query(
      `SELECT class_series_key
         FROM onetime.class_series
        WHERE account_key = $1 AND product_key = $2 AND is_canonical = true`,
      [config.accountKey, config.productKey],
    );
    expect(canonicalSeries.rows).toHaveLength(1);
    const occurrence = await createManagedClassOccurrence({
      pool,
      config,
      actor,
      payload: {
        class_series_key: String(canonicalSeries.rows[0]?.class_series_key),
        local_class_date: '2026-08-20',
        starts_at: '2026-08-20T16:00:00.000Z',
        ends_at: '2026-08-20T17:00:00.000Z',
        is_operator_test: true,
        idempotency_key: 'native-cleanup-state-occurrence',
      },
    });
    const validCleanup = updateClassOccurrencePayloadSchema.parse({
      starts_at: occurrence.starts_at,
      ends_at: occurrence.ends_at,
      status: 'cancelled',
      version: occurrence.version,
    });
    const updated = await updateManagedClassOccurrence({
      pool,
      config,
      actor,
      occurrenceKey: occurrence.occurrence_key,
      payload: validCleanup,
    });
    expect(updated.status).toBe('cancelled');
    const stored = await pool.query(
      `SELECT occurrence_state
         FROM onetime.class_occurrences
        WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3`,
      [config.accountKey, config.productKey, occurrence.occurrence_key],
    );
    expect(stored.rows).toEqual([{ occurrence_state: 'canceled' }]);
    expect(
      updateClassOccurrencePayloadSchema.safeParse({
        starts_at: occurrence.starts_at,
        ends_at: occurrence.ends_at,
        status: 'canceled',
        version: updated.version,
      }).success,
    ).toBe(false);
  }, 60_000);
});
