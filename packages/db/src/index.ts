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
  return new adapter.Pool();
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

export async function runMigrations(
  pool: DbPool,
  migrationsDir = defaultMigrationsDir(),
): Promise<MigrationResult[]> {
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

    const files = (await readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort();
    const results: MigrationResult[] = [];

    for (const file of files) {
      const id = file.replace(/\.sql$/, '');
      const sql = await readFile(path.join(migrationsDir, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const existing = await client.query(
        'SELECT checksum FROM onetime.schema_migrations WHERE id = $1',
        [id],
      );
      if (existing.rowCount) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(`Migration checksum mismatch for ${id}`);
        }
        results.push({ id, checksum, status: 'already_applied' });
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO onetime.schema_migrations (id, checksum) VALUES ($1, $2)', [
        id,
        checksum,
      ]);
      results.push({ id, checksum, status: 'applied' });
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

function defaultMigrationsDir() {
  return path.resolve(process.cwd(), 'packages/db/migrations');
}
