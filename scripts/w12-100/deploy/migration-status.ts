import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import {
  classifyMigrationLedgerRows,
  type MigrationLedgerRow,
} from '../../../packages/db/src/migration-ledger-compatibility.ts';

export const MIGRATION_STATUS_SCHEMA = 'onetime.w12_100.migration_status.v1';
export const PRODUCTION_METADATA_READ_CONFIRMATION = 'W12-100-PRODUCTION-METADATA-READ-OK';

export type MigrationStatusReport = {
  schema_version: typeof MIGRATION_STATUS_SCHEMA;
  generated_at: string;
  status: 'passed' | 'blocked';
  environment_kind: 'staging' | 'production';
  local_migration_count: number;
  applied_migration_count: number;
  pending_migrations: number;
  latest_local_migration: string | null;
  latest_applied_migration: string | null;
  pending_ids_hash: string | null;
  accepted_historical_alias_count: number;
  unrecognized_ledger_rows: number;
  unrecognized_ids_hash: string | null;
  database_mutation_performed: false;
  raw_source_rows_included: false;
  private_values_recorded: false;
  error_summary?: string;
};

type CliOptions = {
  outputPath?: string;
  environmentKind: 'staging' | 'production';
  productionConfirmation?: string;
};

export function buildMigrationStatusReport(input: {
  localIds: string[];
  appliedIds?: string[];
  appliedRows?: MigrationLedgerRow[];
  environmentKind: 'staging' | 'production';
  errorSummary?: string;
}): MigrationStatusReport {
  const local = [...input.localIds].sort();
  const ledgerRows = input.appliedRows
    ? [...input.appliedRows]
    : (input.appliedIds ?? []).map((id) => ({ id, checksum: '' }));
  const classified = classifyMigrationLedgerRows(ledgerRows, new Set(local));
  const applied = classified.currentRows.map((row) => row.id).sort();
  const appliedSet = new Set(applied);
  const pending = local.filter((id) => !appliedSet.has(id));
  const unrecognizedIds = classified.unrecognizedRows.map((row) => row.id).sort();
  const report: MigrationStatusReport = {
    schema_version: MIGRATION_STATUS_SCHEMA,
    generated_at: new Date().toISOString(),
    status:
      pending.length === 0 && unrecognizedIds.length === 0 && !input.errorSummary
        ? 'passed'
        : 'blocked',
    environment_kind: input.environmentKind,
    local_migration_count: local.length,
    applied_migration_count: ledgerRows.length,
    pending_migrations: pending.length,
    latest_local_migration: local.at(-1) ?? null,
    latest_applied_migration: applied.at(-1) ?? null,
    pending_ids_hash: pending.length > 0 ? sha256(pending.join('\n')) : null,
    accepted_historical_alias_count: classified.acceptedHistoricalAliases.length,
    unrecognized_ledger_rows: unrecognizedIds.length,
    unrecognized_ids_hash: unrecognizedIds.length > 0 ? sha256(unrecognizedIds.join('\n')) : null,
    database_mutation_performed: false,
    raw_source_rows_included: false,
    private_values_recorded: false,
  };
  if (input.errorSummary) report.error_summary = redact(input.errorSummary);
  return report;
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  if (
    options.environmentKind === 'production' &&
    options.productionConfirmation !== PRODUCTION_METADATA_READ_CONFIRMATION
  ) {
    throw new Error('Production migration metadata reads require exact confirmation text.');
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required but will not be printed.');

  const localIds = await localMigrationIds();
  let appliedRows: MigrationLedgerRow[] = [];
  let errorSummary: string | undefined;
  const pool = new Pool({ connectionString: databaseUrl, ssl: sslConfig() });
  try {
    const result = await pool.query<{ id: string; checksum: string }>(
      'SELECT id, checksum FROM onetime.schema_migrations ORDER BY id ASC',
    );
    appliedRows = result.rows.map((row) => ({
      id: String(row.id),
      checksum: String(row.checksum),
    }));
  } catch (error) {
    errorSummary = error instanceof Error ? error.message : String(error);
  } finally {
    await pool.end();
  }
  const report = buildMigrationStatusReport({
    localIds,
    appliedRows,
    environmentKind: options.environmentKind,
    ...(errorSummary ? { errorSummary } : {}),
  });
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (options.outputPath) {
    await mkdir(path.dirname(options.outputPath), { recursive: true });
    await writeFile(options.outputPath, output, 'utf8');
  }
  process.stdout.write(output);
  if (report.status !== 'passed') process.exitCode = 1;
}

async function localMigrationIds() {
  const names = (await readdir(path.resolve('packages/db/migrations')))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  const ids: string[] = [];
  for (const name of names) {
    await readFile(path.resolve('packages/db/migrations', name), 'utf8');
    ids.push(name.replace(/\.sql$/, ''));
  }
  return ids;
}

function parseCliOptions(args: string[]): CliOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (
      arg !== '--output' &&
      arg !== '--environment-kind' &&
      arg !== '--confirm-production-metadata-read'
    ) {
      throw new Error(`Unexpected argument ${arg ?? ''}`);
    }
    if (!next || next.startsWith('--')) throw new Error(`Missing value for ${arg}`);
    values.set(arg.slice(2), next);
    index += 1;
  }
  const environmentKind = values.get('environment-kind');
  if (environmentKind !== 'staging' && environmentKind !== 'production') {
    throw new Error('--environment-kind must be staging or production');
  }
  const options: CliOptions = { environmentKind };
  const outputPath = values.get('output');
  const confirmation = values.get('confirm-production-metadata-read');
  if (outputPath) options.outputPath = outputPath;
  if (confirmation) options.productionConfirmation = confirmation;
  return options;
}

function sslConfig() {
  return process.env.DATABASE_SSL === 'true' || process.env.DATABASE_SSL === '1'
    ? { rejectUnauthorized: true }
    : undefined;
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function redact(value: string) {
  return value
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@[^\s]+/gi, 'postgres://[redacted]')
    .replace(/[A-Za-z0-9_-]{32,}/g, '[redacted]')
    .slice(0, 240);
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${redact(message)}\n`);
    process.exitCode = 1;
  });
}
