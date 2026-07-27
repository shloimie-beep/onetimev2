import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { DataType, newDb } from 'pg-mem';
import type { AppConfig } from '../../config/src/index.ts';

export type Queryable = Pick<pg.PoolClient, 'query'>;
export type DbPool = Pick<pg.Pool, 'connect' | 'query' | 'end'>;

export function createPgPool(config: AppConfig): pg.Pool {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required for PostgreSQL-backed runtime.');
  }

  return new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl ? { rejectUnauthorized: true } : undefined,
  });
}

export function createMemoryPool(): DbPool {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  db.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.uuid,
    impure: true,
    implementation: () => crypto.randomUUID(),
  });
  db.public.registerFunction({
    name: 'pg_advisory_xact_lock',
    args: [DataType.integer],
    returns: DataType.integer,
    implementation: () => 1,
  });
  const adapter = db.adapters.createPg();
  const pool = new adapter.Pool() as DbPool & { __memory?: boolean };
  pool.__memory = true;
  return pool;
}

export async function inTransaction<T>(
  pool: DbPool,
  run: (client: Queryable) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export type MigrationResult = {
  id: string;
  checksum: string;
  status: 'applied' | 'already_applied';
};

export type MigrationVerificationIssue = {
  code:
    | 'INVALID_MIGRATION_FILENAME'
    | 'DUPLICATE_MIGRATION_PREFIX'
    | 'MIGRATION_LEDGER_MISSING'
    | 'MIGRATION_LEDGER_UNREADABLE'
    | 'LEDGER_MIGRATION_NOT_IN_FILES'
    | 'MIGRATION_CHECKSUM_MISMATCH'
    | 'MIGRATION_LEDGER_ORDER_MISMATCH'
    | 'PENDING_MIGRATIONS';
  migration_id?: string;
  prefix?: string;
  count?: number;
};

export type MigrationVerificationReport = {
  ok: boolean;
  status: 'verified' | 'pending' | 'invalid';
  ledger: 'present' | 'missing' | 'not_read';
  migration_file_count: number;
  ledger_row_count: number;
  applied_count: number;
  pending_count: number;
  issues: MigrationVerificationIssue[];
};

type MigrationFile = {
  id: string;
  prefix: string;
  sql: string;
  checksum: string;
  compatibleChecksums: Set<string>;
};

export async function runMigrations(
  pool: DbPool,
  migrationsDir = defaultMigrationsDir(),
): Promise<MigrationResult[]> {
  const inventory = await readMigrationInventory(pool, migrationsDir);
  if (inventory.issues.length > 0) {
    throw new Error(
      `Migration inventory invalid: ${inventory.issues.map((issue) => issue.code).join(', ')}`,
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(81227001)');
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS onetime;
      CREATE TABLE IF NOT EXISTS onetime.schema_migrations (
        id text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    const results: MigrationResult[] = [];

    for (const migration of inventory.files) {
      const existing = await client.query(
        'SELECT checksum FROM onetime.schema_migrations WHERE id = $1',
        [migration.id],
      );
      if (existing.rowCount) {
        if (!migration.compatibleChecksums.has(String(existing.rows[0].checksum))) {
          throw new Error(`Migration checksum mismatch for ${migration.id}`);
        }
        results.push({
          id: migration.id,
          checksum: migration.checksum,
          status: 'already_applied',
        });
        continue;
      }
      await client.query(migration.sql);
      await client.query('INSERT INTO onetime.schema_migrations (id, checksum) VALUES ($1, $2)', [
        migration.id,
        migration.checksum,
      ]);
      results.push({ id: migration.id, checksum: migration.checksum, status: 'applied' });
    }

    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function verifyMigrations(
  pool: DbPool,
  migrationsDir = defaultMigrationsDir(),
  options: { requireFullyApplied?: boolean } = {},
): Promise<MigrationVerificationReport> {
  const requireFullyApplied = options.requireFullyApplied ?? true;
  const inventory = await readMigrationInventory(pool, migrationsDir);
  if (inventory.issues.length > 0) {
    return verificationReport({
      status: 'invalid',
      ledger: 'not_read',
      migrationFileCount: inventory.files.length,
      ledgerRowCount: 0,
      appliedCount: 0,
      pendingCount: inventory.files.length,
      issues: inventory.issues,
    });
  }

  let ledger: pg.QueryResult<Record<string, unknown>>;
  try {
    ledger = await pool.query(
      `SELECT id, checksum
         FROM onetime.schema_migrations
        ORDER BY applied_at ASC, id ASC`,
    );
  } catch (error) {
    return verificationReport({
      status: 'invalid',
      ledger: isMissingMigrationLedgerError(error) ? 'missing' : 'not_read',
      migrationFileCount: inventory.files.length,
      ledgerRowCount: 0,
      appliedCount: 0,
      pendingCount: inventory.files.length,
      issues: [
        {
          code: isMissingMigrationLedgerError(error)
            ? 'MIGRATION_LEDGER_MISSING'
            : 'MIGRATION_LEDGER_UNREADABLE',
        },
      ],
    });
  }
  const issues: MigrationVerificationIssue[] = [];
  const byId = new Map(inventory.files.map((migration) => [migration.id, migration]));
  const ledgerRows = ledger.rows.map((row) => ({
    id: String(row.id),
    checksum: String(row.checksum),
  }));
  const ledgerIds = ledgerRows.map((row) => row.id);
  const ledgerIdSet = new Set(ledgerIds);

  for (const row of ledgerRows) {
    const migration = byId.get(row.id);
    if (!migration) {
      issues.push({ code: 'LEDGER_MIGRATION_NOT_IN_FILES', migration_id: row.id });
      continue;
    }
    if (!migration.compatibleChecksums.has(row.checksum)) {
      issues.push({ code: 'MIGRATION_CHECKSUM_MISMATCH', migration_id: row.id });
    }
  }

  const expectedAppliedOrder = inventory.files
    .filter((migration) => ledgerIdSet.has(migration.id))
    .map((migration) => migration.id);
  if (
    expectedAppliedOrder.length !== ledgerIds.length ||
    expectedAppliedOrder.some((id, index) => id !== ledgerIds[index])
  ) {
    issues.push({ code: 'MIGRATION_LEDGER_ORDER_MISMATCH' });
  }

  let sawPending = false;
  let appliedAfterPending = false;
  for (const migration of inventory.files) {
    if (!ledgerIdSet.has(migration.id)) {
      sawPending = true;
    } else if (sawPending) {
      appliedAfterPending = true;
    }
  }
  if (
    appliedAfterPending &&
    !issues.some((issue) => issue.code === 'MIGRATION_LEDGER_ORDER_MISMATCH')
  ) {
    issues.push({ code: 'MIGRATION_LEDGER_ORDER_MISMATCH' });
  }

  const appliedCount = inventory.files.filter((migration) => ledgerIdSet.has(migration.id)).length;
  const pendingCount = inventory.files.length - appliedCount;
  if (pendingCount > 0 && requireFullyApplied) {
    issues.push({ code: 'PENDING_MIGRATIONS', count: pendingCount });
  }
  const invalid = issues.some((issue) => issue.code !== 'PENDING_MIGRATIONS');
  const status = invalid
    ? 'invalid'
    : pendingCount > 0 && requireFullyApplied
      ? 'pending'
      : 'verified';

  return verificationReport({
    status,
    ledger: 'present',
    migrationFileCount: inventory.files.length,
    ledgerRowCount: ledgerRows.length,
    appliedCount,
    pendingCount,
    issues,
  });
}

async function readMigrationInventory(pool: DbPool, migrationsDir: string) {
  const names = (await readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort();
  const files: MigrationFile[] = [];
  const issues: MigrationVerificationIssue[] = [];
  const prefixes = new Map<string, string>();

  for (const name of names) {
    const id = name.replace(/\.sql$/, '');
    const match = /^(\d+)_/.exec(id);
    if (!match) {
      issues.push({ code: 'INVALID_MIGRATION_FILENAME', migration_id: id });
      continue;
    }
    const prefix = match[1]!.replace(/^0+(?=\d)/, '');
    const previous = prefixes.get(prefix);
    if (previous) {
      issues.push({ code: 'DUPLICATE_MIGRATION_PREFIX', migration_id: id, prefix });
    } else {
      prefixes.set(prefix, id);
    }
    const rawSql = await readFile(path.join(migrationsDir, name), 'utf8');
    const sql = isMemoryPool(pool) ? stripPostgresOnlyBlocks(rawSql) : rawSql;
    files.push({
      id,
      prefix,
      sql,
      checksum: migrationChecksum(sql),
      compatibleChecksums: migrationCompatibleChecksums(sql),
    });
  }

  return { files, issues };
}

function verificationReport(input: {
  status: MigrationVerificationReport['status'];
  ledger: MigrationVerificationReport['ledger'];
  migrationFileCount: number;
  ledgerRowCount: number;
  appliedCount: number;
  pendingCount: number;
  issues: MigrationVerificationIssue[];
}): MigrationVerificationReport {
  return {
    ok: input.status === 'verified',
    status: input.status,
    ledger: input.ledger,
    migration_file_count: input.migrationFileCount,
    ledger_row_count: input.ledgerRowCount,
    applied_count: input.appliedCount,
    pending_count: input.pendingCount,
    issues: input.issues,
  };
}

function isMissingMigrationLedgerError(error: unknown) {
  const candidate = error as { code?: unknown; message?: unknown };
  if (candidate?.code === '42P01' || candidate?.code === '3F000') return true;
  const message = typeof candidate?.message === 'string' ? candidate.message : '';
  return (
    /(?:relation|schema).*(?:schema_migrations|onetime).*(?:does not exist|not found)/i.test(
      message,
    ) || /schema not found:\s*onetime/i.test(message)
  );
}

function defaultMigrationsDir() {
  return path.resolve(process.cwd(), 'packages/db/migrations');
}

function migrationChecksum(sql: string) {
  return createHash('sha256').update(normalizeMigrationLineEndings(sql)).digest('hex');
}

function migrationCompatibleChecksums(sql: string) {
  const normalized = normalizeMigrationLineEndings(sql);
  // Some pre-canonicalization environments recorded raw CRLF or LF hashes.
  return new Set([
    migrationChecksum(sql),
    createHash('sha256').update(sql).digest('hex'),
    createHash('sha256').update(normalized.replace(/\n/g, '\r\n')).digest('hex'),
  ]);
}

function normalizeMigrationLineEndings(sql: string) {
  return sql.replace(/\r\n/g, '\n');
}

function isMemoryPool(pool: DbPool) {
  return Boolean((pool as DbPool & { __memory?: boolean }).__memory);
}

function stripPostgresOnlyBlocks(sql: string) {
  return sql.replace(
    /-- @postgres-only-begin[\s\S]*?-- @postgres-only-end/g,
    '-- postgres-only migration block skipped by pg-mem tests',
  );
}
