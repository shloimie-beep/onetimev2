import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { runMigrations, verifyMigrations } from '../../packages/db/src/index.ts';

const EXPECTED_MIGRATION_COUNT = 102;
const EXPECTED_HEAD = '2271_ot16_f05_dispatch_context';

async function main() {
  assert(
    process.env.COMPLETE_LAUNCH_ALLOW_DISPOSABLE_POSTGRES_WRITE === 'true',
    'Disposable PostgreSQL proof requires its exact authorization flag.',
  );
  const connectionString = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
  assert(connectionString, 'DATABASE_PUBLIC_URL or DATABASE_URL is required.');
  const adminUrl = new URL(connectionString);
  const databaseName = `onetime_complete_launch_${randomBytes(8).toString('hex')}`;
  const proofUrl = new URL(adminUrl);
  proofUrl.pathname = `/${databaseName}`;
  const admin = new pg.Pool({ connectionString: adminUrl.toString(), max: 2 });
  let created = false;
  try {
    const version = await admin.query<{ server_version: string; server_version_num: string }>(
      `SELECT current_setting('server_version') AS server_version,
              current_setting('server_version_num') AS server_version_num`,
    );
    const versionRow = version.rows[0];
    assert(versionRow?.server_version_num.startsWith('18'), 'PostgreSQL 18 is required.');
    await admin.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
    created = true;

    const proof = new pg.Pool({ connectionString: proofUrl.toString(), max: 8 });
    try {
      const first = await runMigrations(proof);
      const replay = await runMigrations(proof);
      const verification = await verifyMigrations(proof);
      assert(first.length === EXPECTED_MIGRATION_COUNT, 'Unexpected migration apply count.');
      assert(first.at(-1)?.id === EXPECTED_HEAD, 'Unexpected migration head.');
      assert(
        replay.length === EXPECTED_MIGRATION_COUNT &&
          replay.every(({ status }) => status === 'already_applied'),
        'Migration replay was not fully idempotent.',
      );
      assert(verification.ok && verification.pending_count === 0, 'Migration ledger is not clean.');

      const correctionTables = await proof.query<{ table_name: string }>(
        `SELECT table_name
           FROM information_schema.tables
          WHERE table_schema = 'onetime'
            AND table_name IN (
              'family_signup_access_timing_correction_receipts',
              'class_launch_timing_correction_receipts'
            )
          ORDER BY table_name`,
      );
      assert(correctionTables.rowCount === 2, 'Complete-launch correction evidence is absent.');
      const canonical = await proof.query<{
        canonical_count: string;
        invalid_count: string;
        first_occurrence: string | null;
        occurrence_count: string;
      }>(
        `SELECT
           count(*) FILTER (WHERE series.is_canonical) AS canonical_count,
           count(*) FILTER (
             WHERE series.is_canonical
               AND (
                 series.timezone <> 'Asia/Jerusalem'
                 OR series.local_start_time <> time '19:00'
                 OR series.reminder_local_time <> time '18:30'
                 OR series.recurrence_starts_on <> DATE '2026-08-16'
                 OR series.recurrence_weekdays <> ARRAY[1,2,3,4,7]::smallint[]
               )
           ) AS invalid_count,
           min(occurrence.starts_at)::text AS first_occurrence,
           count(occurrence.occurrence_key)::text AS occurrence_count
         FROM onetime.class_series AS series
         LEFT JOIN onetime.class_occurrences AS occurrence
           ON occurrence.account_key = series.account_key
          AND occurrence.product_key = series.product_key
          AND occurrence.class_series_key = series.class_series_key
          AND series.is_canonical = true`,
      );
      const canonicalRow = canonical.rows[0];
      assert(canonicalRow?.invalid_count === '0', 'Canonical class anchor readback is invalid.');

      process.stdout.write(
        `${JSON.stringify({
          status: 'passed',
          postgres: versionRow?.server_version,
          migration_count: first.length,
          migration_head: first.at(-1)?.id,
          canonical_series_count: Number(canonicalRow?.canonical_count ?? 0),
          generated_occurrence_count: Number(canonicalRow?.occurrence_count ?? 0),
          first_occurrence: canonicalRow?.first_occurrence ?? null,
        })}\n`,
      );
    } finally {
      await proof.end();
    }
  } finally {
    if (created) {
      await admin.query(
        `SELECT pg_terminate_backend(pid)
           FROM pg_stat_activity
          WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [databaseName],
      );
      await admin.query(`DROP DATABASE ${quoteIdentifier(databaseName)}`);
    }
    await admin.end();
  }
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

await main();
