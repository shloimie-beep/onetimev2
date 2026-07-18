import { writeFile } from 'node:fs/promises';
import pg from 'pg';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (arg?.startsWith('--')) {
    args.set(arg, process.argv[index + 1]);
    index += 1;
  }
}

const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('A database connection variable is required.');
}

const sslEnabled = ['1', 'true', 'yes'].includes(
  String(process.env.DATABASE_SSL ?? '').toLowerCase(),
);

const pool = new pg.Pool({
  connectionString,
  ssl: sslEnabled ? { rejectUnauthorized: true } : undefined,
  max: 2,
});

function quoteIdent(identifier) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe identifier: ${identifier}`);
  }

  return `"${identifier}"`;
}

const selectedNameParts = [
  'account',
  'identit',
  'session',
  'household',
  'learner',
  'contact',
  'tag',
  'import',
  'audit',
  'outbox',
  'suppress',
  'ticket',
  'dead',
];

try {
  const tableResult = await pool.query(
    `
      SELECT table_name
        FROM information_schema.tables
       WHERE table_schema = 'onetime'
         AND table_type = 'BASE TABLE'
       ORDER BY table_name
    `,
  );

  const selectedTables = tableResult.rows
    .map((row) => String(row.table_name))
    .filter((tableName) =>
      selectedNameParts.some((part) => tableName.toLowerCase().includes(part)),
    );

  const counts = [];
  for (const tableName of selectedTables) {
    const countResult = await pool.query(
      `SELECT count(*)::int AS total_rows FROM onetime.${quoteIdent(tableName)}`,
    );
    counts.push({
      table: tableName,
      total_rows: Number(countResult.rows[0]?.total_rows ?? 0),
    });
  }

  const report = {
    schema: 'onetime.w13_102.production_counts_only.v1',
    generated_at: new Date().toISOString(),
    scope: args.get('--scope') ?? 'production-readonly',
    table_count: counts.length,
    counts,
    secrets_printed: false,
    pii_printed: false,
    raw_rows_printed: false,
  };

  const output = `${JSON.stringify(report, null, 2)}\n`;
  const outPath = args.get('--out');
  if (outPath) {
    await writeFile(outPath, output, 'utf8');
  }
  process.stdout.write(output);
} finally {
  await pool.end();
}
