import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { loadConfig } from '../../packages/config/src/index.ts';
import { runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import { captureLead, HIGHLEVEL_CLAIM_SQL } from '../../packages/domain/src/index.ts';

if (process.env.HIGHLEVEL_ALLOW_POSTGRES_ASSURANCE !== 'true') {
  throw new Error(
    'Set HIGHLEVEL_ALLOW_POSTGRES_ASSURANCE=true only for a disposable PostgreSQL target.',
  );
}

const adminConfig = poolConfigFromEnv();
const databaseName = `ot_launch_highlevel_claim_${Date.now()}_${randomBytes(3).toString('hex')}`;
const adminPool = new pg.Pool(adminConfig);
let proofPool: (DbPool & pg.Pool) | null = null;
let databaseCreated = false;
let cleanupStarted = false;
let unexpectedPoolError: unknown = null;
let proofResult: Awaited<ReturnType<typeof proveConcurrentClaims>> | null = null;

try {
  await adminPool.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
  databaseCreated = true;
  proofPool = new pg.Pool({ ...adminConfig, database: databaseName, max: 8 }) as DbPool & pg.Pool;
  proofPool.on('error', (error: unknown) => {
    if (cleanupStarted && postgresErrorCode(error) === '57P01') return;
    unexpectedPoolError ??= error;
  });
  await runMigrations(proofPool);
  proofResult = await proveConcurrentClaims(proofPool);
} finally {
  cleanupStarted = true;
  const poolToClose = proofPool;
  proofPool = null;
  if (poolToClose) {
    await poolToClose.end().catch((error: unknown) => {
      if (postgresErrorCode(error) !== '57P01') unexpectedPoolError ??= error;
    });
  }
  try {
    if (databaseCreated) {
      await cleanupDatabase(adminPool, databaseName);
      databaseCreated = false;
    }
  } finally {
    await adminPool.end();
  }
}

if (unexpectedPoolError) {
  throw new Error(
    `Unexpected PostgreSQL pool error during claim assurance (${postgresErrorCode(unexpectedPoolError) ?? 'unknown'}).`,
  );
}
if (!proofResult) throw new Error('HighLevel PostgreSQL claim assurance produced no result.');
process.stdout.write(`${JSON.stringify(proofResult)}\n`);

async function proveConcurrentClaims(pool: DbPool) {
  const now = new Date();
  const runId = `highlevel-pg-claim-${randomBytes(8).toString('hex')}`;
  const allowlistHash = `sha256:${randomBytes(32).toString('hex')}`;
  const config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    HIGHLEVEL_EVENT_SYNC_MODE: 'mock',
  });

  for (let index = 0; index < 3; index += 1) {
    await captureLead({
      pool,
      config,
      now: new Date(now.getTime() + index),
      payload: {
        contact_name: `PostgreSQL Adult ${index + 1}`,
        family_or_school: `PostgreSQL Household ${index + 1}`,
        audience_type: 'family',
        location: 'Synthetic City',
        timezone: 'Etc/UTC',
        email: `highlevel-pg-${index + 1}-${runId}@example.test`,
        phone: '',
        reminder_preference: 'email',
        reminder_consent: true,
        consent_context: {
          policy_version: 'communications-2026-07-15.1',
          purpose: 'optional_class_reminders',
          source: 'public_signup',
          channels: ['email'],
          captured_at: now.toISOString(),
          withdrawal_state: 'not_withdrawn',
          suppression_state: 'active',
        },
        idempotency_key: `highlevel-pg-${index + 1}-${runId}`,
        attribution: { landing_path: '/signup' },
      },
    });
  }

  const rows = await pool.query(
    `SELECT delivery_key
       FROM onetime.outbox_events
      WHERE account_key = $1 AND product_key = $2
        AND channel = 'highlevel' AND transport_mode = 'mock'
      ORDER BY created_at, delivery_key`,
    [config.accountKey, config.productKey],
  );
  const deliveryKeys = rows.rows.map((row) => String(row.delivery_key));
  if (deliveryKeys.length !== 3) {
    throw new Error(`Expected three synthetic HighLevel rows, found ${deliveryKeys.length}.`);
  }
  const authorizedKeys = deliveryKeys.slice(0, 2);
  const heldKey = deliveryKeys[2];
  const claimAt = new Date(now.getTime() + 10_000);
  if (!heldKey) throw new Error('Expected one held HighLevel delivery key.');

  await pool.query(
    `INSERT INTO onetime.highlevel_canary_runs
       (account_key, product_key, run_id, transport_mode, allowlist_hash, budget, state,
        created_at, updated_at)
     VALUES ($1, $2, $3, 'mock', $4, 2, 'active', $5, $5)`,
    [config.accountKey, config.productKey, runId, allowlistHash, now],
  );
  for (const deliveryKey of authorizedKeys) {
    await pool.query(
      `INSERT INTO onetime.highlevel_canary_run_allowlist
         (account_key, product_key, run_id, delivery_key, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [config.accountKey, config.productKey, runId, deliveryKey, now],
    );
  }
  await pool.query(
    `UPDATE onetime.outbox_events
        SET transport_authorization_state = 'authorized',
            transport_authorization_run_id = $4,
            transport_authorization_allowlist_hash = $5
      WHERE account_key = $1 AND product_key = $2
        AND delivery_key = ANY($3::text[])`,
    [config.accountKey, config.productKey, authorizedKeys, runId, allowlistHash],
  );

  const firstClient = await pool.connect();
  const secondClient = await pool.connect();
  try {
    await firstClient.query('BEGIN');
    await secondClient.query('BEGIN');
    const first = await firstClient.query(HIGHLEVEL_CLAIM_SQL, [
      config.accountKey,
      config.productKey,
      claimAt,
      1,
      new Date(claimAt.getTime() + 120_000),
      runId,
      allowlistHash,
      'mock',
      2,
      'claim-first',
    ]);
    const second = await secondClient.query(HIGHLEVEL_CLAIM_SQL, [
      config.accountKey,
      config.productKey,
      claimAt,
      2,
      new Date(claimAt.getTime() + 120_000),
      runId,
      allowlistHash,
      'mock',
      2,
      'claim-second',
    ]);
    await secondClient.query('COMMIT');
    await firstClient.query('COMMIT');

    const claimedKeys = [...first.rows, ...second.rows]
      .map((row) => String(row.delivery_key))
      .sort();
    const expectedKeys = [...authorizedKeys].sort();
    const finalRows = await pool.query(
      `SELECT delivery_key, status, transport_authorization_state, transport_claim_token
         FROM onetime.outbox_events
        WHERE account_key = $1 AND product_key = $2
          AND delivery_key = ANY($3::text[])
        ORDER BY delivery_key`,
      [config.accountKey, config.productKey, deliveryKeys],
    );
    const claimedRows = finalRows.rows.filter(
      (row) => row.transport_authorization_state === 'processing',
    );
    const heldRows = finalRows.rows.filter((row) => row.transport_authorization_state === 'held');
    const passed =
      first.rows.length === 1 &&
      second.rows.length === 1 &&
      JSON.stringify(claimedKeys) === JSON.stringify(expectedKeys) &&
      claimedRows.length === 2 &&
      new Set(claimedRows.map((row) => String(row.transport_claim_token))).size === 2 &&
      heldRows.length === 1 &&
      heldRows[0]?.delivery_key === heldKey &&
      heldRows[0]?.status === 'pending';
    if (!passed) throw new Error('HighLevel PostgreSQL claim fencing assertion failed.');

    return {
      status: 'passed',
      engine: 'postgresql',
      first_claimed: first.rows.length,
      second_claimed_while_first_lock_held: second.rows.length,
      authorized_rows_claimed: claimedRows.length,
      unauthorized_rows_claimed: 0,
      unique_claim_tokens: true,
      external_highlevel_calls: 0,
      messages_sent: 0,
    } as const;
  } catch (error) {
    await Promise.allSettled([firstClient.query('ROLLBACK'), secondClient.query('ROLLBACK')]);
    throw error;
  } finally {
    firstClient.release();
    secondClient.release();
  }
}

function poolConfigFromEnv(): pg.PoolConfig {
  return {
    host: process.env.PGHOST ?? '127.0.0.1',
    port: Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE ?? 'postgres',
    user: process.env.PGUSER ?? 'postgres',
    password: process.env.PGPASSWORD,
  };
}

function quoteIdentifier(value: string) {
  if (!/^[a-z0-9_]+$/.test(value)) throw new Error('Unsafe PostgreSQL identifier.');
  return `"${value}"`;
}

async function cleanupDatabase(pool: pg.Pool, database: string) {
  await pool.query(
    `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [database],
  );
  await pool.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(database)}`);
}

function postgresErrorCode(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}
