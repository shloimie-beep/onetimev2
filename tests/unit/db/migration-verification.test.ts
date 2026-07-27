import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createMemoryPool,
  runMigrations,
  verifyMigrations,
  type DbPool,
} from '../../../packages/db/src/index.ts';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('read-only migration verification', () => {
  it('reports a missing ledger without creating schema objects', async () => {
    const pool = createMemoryPool();
    const directory = await migrationDirectory({
      '0001_first.sql': 'CREATE TABLE onetime.first_table (id text PRIMARY KEY);',
    });
    const before = await databaseSnapshot(pool);

    try {
      const report = await verifyMigrations(pool, directory);
      expect(report).toMatchObject({
        ok: false,
        status: 'invalid',
        ledger: 'missing',
        ledger_row_count: 0,
        pending_count: 1,
        issues: [{ code: 'MIGRATION_LEDGER_MISSING' }],
      });
      expect(await databaseSnapshot(pool)).toEqual(before);
    } finally {
      await pool.end();
    }
  });

  it('distinguishes an unreadable ledger from an absent ledger', async () => {
    const directory = await migrationDirectory({
      '0001_first.sql': 'CREATE TABLE onetime.first_table (id text PRIMARY KEY);',
    });
    const unavailable = {
      query: async () => {
        throw Object.assign(new Error('database unavailable'), { code: 'ECONNREFUSED' });
      },
    } as unknown as DbPool;

    const report = await verifyMigrations(unavailable, directory);
    expect(report).toMatchObject({
      ok: false,
      status: 'invalid',
      ledger: 'not_read',
      issues: [{ code: 'MIGRATION_LEDGER_UNREADABLE' }],
    });
  });

  it('leaves a pending migration and the ledger unchanged', async () => {
    const pool = createMemoryPool();
    const directory = await migrationDirectory({
      '0001_first.sql': 'CREATE TABLE onetime.first_table (id text PRIMARY KEY);',
    });

    try {
      await runMigrations(pool, directory);
      await writeFile(
        path.join(directory, '0002_pending.sql'),
        'CREATE TABLE onetime.pending_table (id text PRIMARY KEY);\n',
        'utf8',
      );
      const before = await databaseSnapshot(pool);
      const { pool: recordingPool, statements } = recordQueries(pool);

      const report = await verifyMigrations(recordingPool, directory);
      expect(report).toMatchObject({
        ok: false,
        status: 'pending',
        ledger: 'present',
        applied_count: 1,
        pending_count: 1,
        issues: [{ code: 'PENDING_MIGRATIONS', count: 1 }],
      });
      expect(statements).not.toHaveLength(0);
      expect(statements.every((statement) => /^\s*SELECT\b/i.test(statement))).toBe(true);
      expect(await databaseSnapshot(pool)).toEqual(before);
      expect(before.tables).not.toContain('pending_table');

      const inventoryOnly = await verifyMigrations(pool, directory, {
        requireFullyApplied: false,
      });
      expect(inventoryOnly).toMatchObject({ ok: true, status: 'verified', pending_count: 1 });
      expect(await databaseSnapshot(pool)).toEqual(before);
    } finally {
      await pool.end();
    }
  });

  it('accepts a fully applied normalized-checksum ledger without writes', async () => {
    const pool = createMemoryPool();
    const directory = await migrationDirectory({
      '0001_first.sql': 'CREATE TABLE onetime.first_table (id text PRIMARY KEY);\r\n',
      '0002_second.sql': 'CREATE TABLE onetime.second_table (id text PRIMARY KEY);\r\n',
    });

    try {
      await runMigrations(pool, directory);
      const before = await databaseSnapshot(pool);
      const report = await verifyMigrations(pool, directory);
      expect(report).toMatchObject({
        ok: true,
        status: 'verified',
        ledger: 'present',
        applied_count: 2,
        pending_count: 0,
        issues: [],
      });
      expect(await databaseSnapshot(pool)).toEqual(before);
    } finally {
      await pool.end();
    }
  });

  it('accepts only the exact checksum-pinned historical staging aliases', async () => {
    const pool = createMemoryPool();
    const directory = await migrationDirectory({
      '2213_learning_delivery_autotrim_transcripts.sql':
        'CREATE TABLE onetime.autotrim_table (id text PRIMARY KEY);',
      '2214_learning_delivery_content_factory.sql':
        'CREATE TABLE onetime.content_factory_table (id text PRIMARY KEY);',
    });

    try {
      await runMigrations(pool, directory);
      await pool.query(
        `INSERT INTO onetime.schema_migrations (id, checksum)
         VALUES
           ('2209_learning_delivery_autotrim_transcripts',
            'ebf4dee57c9366e7b149f54c062b9bcc3ffe9ce66d6bcfef69e60497bfde04a8'),
           ('2210_learning_delivery_content_factory',
            '93aa95f1fb14511569f85307e3026fc67449b30d2582a9280f9b1e2750b8349f')`,
      );
      const before = await databaseSnapshot(pool);
      expect(await verifyMigrations(pool, directory)).toMatchObject({
        ok: true,
        status: 'verified',
        ledger_row_count: 4,
        applied_count: 2,
        pending_count: 0,
        accepted_historical_alias_count: 2,
        issues: [],
      });
      expect(await databaseSnapshot(pool)).toEqual(before);

      await pool.query(
        `UPDATE onetime.schema_migrations
            SET checksum = $1
          WHERE id = '2209_learning_delivery_autotrim_transcripts'`,
        ['0'.repeat(64)],
      );
      expect((await verifyMigrations(pool, directory)).issues).toContainEqual({
        code: 'LEDGER_MIGRATION_NOT_IN_FILES',
        migration_id: '2209_learning_delivery_autotrim_transcripts',
      });
    } finally {
      await pool.end();
    }
  });

  it('fails checksum, duplicate-prefix, and reordered-ledger states without writes', async () => {
    const pool = createMemoryPool();
    const directory = await migrationDirectory({
      '0001_first.sql': 'CREATE TABLE onetime.first_table (id text PRIMARY KEY);',
      '0003_third.sql': 'CREATE TABLE onetime.third_table (id text PRIMARY KEY);',
    });

    try {
      await runMigrations(pool, directory);
      await pool.query(
        `UPDATE onetime.schema_migrations
            SET checksum = $1
          WHERE id = '0001_first'`,
        ['0'.repeat(64)],
      );
      const mismatchBefore = await databaseSnapshot(pool);
      const mismatch = await verifyMigrations(pool, directory);
      expect(mismatch.issues).toContainEqual({
        code: 'MIGRATION_CHECKSUM_MISMATCH',
        migration_id: '0001_first',
      });
      expect(await databaseSnapshot(pool)).toEqual(mismatchBefore);

      await writeFile(
        path.join(directory, '0002_second.sql'),
        'CREATE TABLE onetime.second_table (id text PRIMARY KEY);\n',
        'utf8',
      );
      const reorderedBefore = await databaseSnapshot(pool);
      const reordered = await verifyMigrations(pool, directory);
      expect(reordered.issues).toEqual(
        expect.arrayContaining([
          { code: 'MIGRATION_LEDGER_ORDER_MISMATCH' },
          { code: 'PENDING_MIGRATIONS', count: 1 },
        ]),
      );
      expect(await databaseSnapshot(pool)).toEqual(reorderedBefore);

      await writeFile(path.join(directory, '0001_duplicate.sql'), 'SELECT 1;\n', 'utf8');
      const duplicateBefore = await databaseSnapshot(pool);
      const duplicate = await verifyMigrations(pool, directory);
      expect(duplicate).toMatchObject({ ok: false, status: 'invalid', ledger: 'not_read' });
      expect(duplicate.issues).toContainEqual({
        code: 'DUPLICATE_MIGRATION_PREFIX',
        migration_id: '0001_first',
        prefix: '1',
      });
      expect(await databaseSnapshot(pool)).toEqual(duplicateBefore);
    } finally {
      await pool.end();
    }
  });
});

async function migrationDirectory(files: Record<string, string>) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'onetime-migration-verify-'));
  temporaryDirectories.push(directory);
  await Promise.all(
    Object.entries(files).map(([name, contents]) =>
      writeFile(path.join(directory, name), `${contents.trimEnd()}\n`, 'utf8'),
    ),
  );
  return directory;
}

async function databaseSnapshot(pool: DbPool) {
  const tables = await pool.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'onetime'
      ORDER BY table_name`,
  );
  const hasLedger = tables.rows.some((row) => String(row.table_name) === 'schema_migrations');
  const ledger = hasLedger
    ? await pool.query('SELECT id, checksum FROM onetime.schema_migrations ORDER BY id')
    : { rows: [] };
  return {
    tables: tables.rows.map((row) => String(row.table_name)),
    ledger: ledger.rows.map((row) => ({ id: String(row.id), checksum: String(row.checksum) })),
  };
}

function recordQueries(pool: DbPool) {
  const statements: string[] = [];
  const recordingPool = Object.assign(Object.create(pool), {
    __memory: true,
    query: async (text: string, values?: unknown[]) => {
      statements.push(text);
      return pool.query(text, values);
    },
  }) as DbPool;
  return { pool: recordingPool, statements };
}
