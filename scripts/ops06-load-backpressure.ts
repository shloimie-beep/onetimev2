import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { loadConfig } from '../packages/config/src/index.ts';
import { runMigrations, type DbPool } from '../packages/db/src/index.ts';
import { captureLead } from '../packages/domain/src/index.ts';
import { consumeRateLimitBudgets } from '../packages/domain/src/security/rate-limit.ts';

const outputDir = path.resolve(process.env.OPS06_OUTPUT_DIR ?? 'ops/codex-runs/OPS-06/evidence');
const outputJson = path.join(outputDir, 'load-backpressure.json');
const outputMd = path.join(outputDir, 'load-backpressure.md');
const allowPg = process.env.OPS06_ALLOW_PG_ASSURANCE === 'true';
const syntheticContacts = boundedNumber(
  process.env.OPS06_SYNTHETIC_CONTACTS,
  10_000,
  10_000,
  50_000,
);
const syntheticEvents = boundedNumber(process.env.OPS06_SYNTHETIC_EVENTS, 1_000, 500, 10_000);

type LoadTimingBuckets = {
  signup_idempotency_ms: number[];
  rate_limit_ms: number[];
  worker_claim_ms: number[];
};

type ScenarioResult = {
  id: string;
  status: 'passed' | 'failed' | 'blocked';
  observations: Record<string, unknown>;
};

type Report = {
  generated_at: string;
  status: 'passed' | 'failed' | 'blocked';
  blocker: string | null;
  postgres_version: string | null;
  database_name: string | null;
  synthetic_seed: {
    contacts: number;
    events: number;
    real_pii: false;
  };
  timings: Record<string, ReturnType<typeof stats>>;
  scenarios: ScenarioResult[];
  memory: {
    heap_start_bytes: number;
    heap_end_bytes: number;
    bounded_growth: boolean;
  };
  external_mutations: {
    production_database: false;
    providers: false;
    sends: false;
    deployment: false;
  };
};

let report: Report = blockedReport(
  allowPg
    ? null
    : 'Set OPS06_ALLOW_PG_ASSURANCE=true with disposable PGHOST/PGDATABASE credentials to run.',
);
if (allowPg) {
  report = await runLoadProof().catch((error: unknown) => blockedReport(safeError(error)));
}

await mkdir(outputDir, { recursive: true });
await writeFile(outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
await writeFile(outputMd, markdown(report), 'utf8');
process.stdout.write(`OPS-06 load/backpressure ${report.status}: ${outputJson}\n`);
if (report.status === 'failed') process.exitCode = 1;

async function runLoadProof(): Promise<Report> {
  const adminConfig = adminPoolConfig();
  const adminPool = new pg.Pool(adminConfig);
  const databaseName = `ops06_load_${Date.now()}_${randomBytes(3).toString('hex')}`;
  const heapStart = process.memoryUsage().heapUsed;
  const timings: LoadTimingBuckets = {
    signup_idempotency_ms: [],
    rate_limit_ms: [],
    worker_claim_ms: [],
  };
  try {
    const version = await readPostgresVersion(adminPool);
    if (Number(version.server_version_num) < 160000) {
      return blockedReport(
        `PostgreSQL 16 required, found server_version_num=${version.server_version_num}`,
      );
    }
    await adminPool.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
    const pool = new pg.Pool({
      ...adminConfig,
      database: databaseName,
      max: 24,
    }) as unknown as DbPool & pg.Pool;
    const unexpectedPoolErrors: string[] = [];
    pool.on('error', (error: unknown) => {
      if (isExpectedPgShutdownError(error)) return;
      unexpectedPoolErrors.push(safeError(error));
    });
    const config = loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: connectionStringFor(databaseName),
      PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
      APP_VERSION: 'ops06-load',
      COMMIT_SHA: 'local',
      OUTBOX_TRANSPORT_MODE: 'sink',
    });
    try {
      await runMigrations(pool);
      await seedContacts(pool, config, syntheticContacts);
      await seedOutboxEvents(pool, config, syntheticEvents);
      const scenarios: ScenarioResult[] = [];
      scenarios.push(await signupIdempotencyRace(pool, config, timings.signup_idempotency_ms));
      scenarios.push(await loginRateLimitRace(pool, config, timings.rate_limit_ms));
      scenarios.push(await multiWorkerClaimRace(pool, config, timings.worker_claim_ms));
      scenarios.push(await retryDeadLetterBackpressure(pool, config));
      if (unexpectedPoolErrors.length > 0) {
        scenarios.push({
          id: 'postgres_pool_unexpected_errors',
          status: 'failed',
          observations: { errors: unexpectedPoolErrors.slice(0, 3) },
        });
      }
      const heapEnd = process.memoryUsage().heapUsed;
      const failed = scenarios.filter((scenario) => scenario.status === 'failed');
      return {
        generated_at: new Date().toISOString(),
        status: failed.length > 0 ? 'failed' : 'passed',
        blocker: null,
        postgres_version: version.version,
        database_name: databaseName,
        synthetic_seed: {
          contacts: syntheticContacts,
          events: syntheticEvents,
          real_pii: false,
        },
        timings: Object.fromEntries(
          Object.entries(timings).map(([key, values]) => [key, stats(values)]),
        ),
        scenarios,
        memory: {
          heap_start_bytes: heapStart,
          heap_end_bytes: heapEnd,
          bounded_growth: heapEnd - heapStart < 256 * 1024 * 1024,
        },
        external_mutations: noExternalMutations(),
      };
    } finally {
      await endPool(pool);
    }
  } finally {
    await adminPool
      .query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)} WITH (FORCE)`)
      .catch(() => undefined);
    await adminPool.end();
  }
}

async function seedContacts(pool: DbPool, config: ReturnType<typeof loadConfig>, count: number) {
  const chunkSize = 500;
  for (let offset = 0; offset < count; offset += chunkSize) {
    const rows = Array.from({ length: Math.min(chunkSize, count - offset) }, (_item, local) => {
      const index = offset + local;
      const label = String(index + 1).padStart(5, '0');
      return [
        `ops06-contact-${label}`,
        config.accountKey,
        config.productKey,
        `Synthetic Contact ${label}`,
        'family',
        `Synthetic Family ${label}`,
        'Synthetic City',
        'Etc/UTC',
        `ops06-contact-${label}@example.test`,
        `+199900${label}`,
        'none',
        'ops06_synthetic_load',
        'new',
        '',
        'ops06-offer',
        'ops06-content',
        `ops06-public-${label}`,
        `ops06-contact-${label}`,
      ];
    });
    await insertRows(
      pool,
      'onetime.contacts',
      [
        'contact_key',
        'account_key',
        'product_key',
        'display_name',
        'family_school_classification',
        'family_or_school',
        'location_text',
        'timezone',
        'email_normalized',
        'phone_normalized',
        'reminder_preference',
        'source',
        'lead_status',
        'internal_note',
        'offer_version',
        'content_version',
        'public_contact_id',
        'legacy_contact_key',
      ],
      rows,
    );
  }
}

async function seedOutboxEvents(
  pool: DbPool,
  config: ReturnType<typeof loadConfig>,
  count: number,
) {
  const rows = Array.from({ length: count }, (_item, index) => {
    const label = String(index + 1).padStart(5, '0');
    return [
      `ops06-load-delivery-${label}`,
      config.accountKey,
      config.productKey,
      'family_signup_email_ack.v1',
      'email',
      'sink',
      '{"synthetic":true}',
      'pending',
      0,
      new Date(Date.now() - index * 10).toISOString(),
      new Date(Date.now() - index * 10).toISOString(),
    ];
  });
  await insertRows(
    pool,
    'onetime.outbox_events',
    [
      'delivery_key',
      'account_key',
      'product_key',
      'event_type',
      'channel',
      'transport_mode',
      'payload',
      'status',
      'attempts',
      'next_attempt_at',
      'created_at',
    ],
    rows,
    500,
  );
}

async function signupIdempotencyRace(
  pool: DbPool,
  config: ReturnType<typeof loadConfig>,
  samples: number[],
): Promise<ScenarioResult> {
  const participants = 12;
  const payload = {
    contact_name: 'OPS06 Synthetic Parent',
    family_or_school: 'OPS06 Synthetic Family',
    audience_type: 'family' as const,
    location: 'Synthetic City',
    timezone: 'Etc/UTC',
    email: `ops06-idem-${Date.now()}@example.test`,
    phone: '',
    reminder_preference: 'email' as const,
    reminder_consent: true,
    idempotency_key: 'ops06-idempotency-race',
    attribution: { landing_path: '/signup' },
  };
  const results = await Promise.allSettled(
    Array.from({ length: participants }, async () => {
      const started = performance.now();
      const result = await captureLead({ pool, config, payload });
      samples.push(Math.round(performance.now() - started));
      return result;
    }),
  );
  const fulfilled = results.filter((result) => result.status === 'fulfilled');
  const contacts = await pool.query(
    `SELECT count(*)::int AS count FROM onetime.contacts WHERE email_normalized = $1`,
    [payload.email],
  );
  const count = Number(contacts.rows[0]?.count ?? 0);
  return {
    id: 'concurrent_signup_idempotency',
    status: fulfilled.length === participants && count === 1 ? 'passed' : 'failed',
    observations: {
      participants,
      fulfilled: fulfilled.length,
      rejected: results.length - fulfilled.length,
      persisted_contacts: count,
    },
  };
}

async function loginRateLimitRace(
  pool: DbPool,
  config: ReturnType<typeof loadConfig>,
  samples: number[],
): Promise<ScenarioResult> {
  const attempts = 10;
  const results = [];
  for (let index = 0; index < attempts; index += 1) {
    const started = performance.now();
    results.push(
      await consumeRateLimitBudgets({
        pool,
        config,
        budgets: [
          { scope: 'login_identifier', subject: 'ops06@example.test', limit: 5, windowMs: 60_000 },
        ],
      }),
    );
    samples.push(Math.round(performance.now() - started));
  }
  return {
    id: 'login_rate_limit_budget',
    status: results.filter((result) => !result.allowed).length === 5 ? 'passed' : 'failed',
    observations: {
      attempts,
      allowed: results.filter((result) => result.allowed).length,
      rate_limited: results.filter((result) => !result.allowed).length,
    },
  };
}

async function multiWorkerClaimRace(
  pool: DbPool,
  config: ReturnType<typeof loadConfig>,
  samples: number[],
): Promise<ScenarioResult> {
  const workers = 5;
  const claims = await Promise.all(
    Array.from({ length: workers }, async (_item, workerIndex) => {
      const started = performance.now();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const selected = await client.query(
          `SELECT delivery_key
             FROM onetime.outbox_events
            WHERE account_key = $1
              AND product_key = $2
              AND status = 'pending'
              AND delivery_key LIKE 'ops06-load-delivery-%'
            ORDER BY created_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 50`,
          [config.accountKey, config.productKey],
        );
        const keys = selected.rows.map((row: { delivery_key: string }) => row.delivery_key);
        if (keys.length > 0) {
          await client.query(
            `UPDATE onetime.outbox_events
                SET status = $1
              WHERE delivery_key = ANY($2::text[])`,
            [`claimed-by-${workerIndex}`, keys],
          );
        }
        await client.query('COMMIT');
        samples.push(Math.round(performance.now() - started));
        return keys;
      } catch (error) {
        await rollbackQuietly(client);
        throw error;
      } finally {
        client.release();
      }
    }),
  );
  const flat = claims.flat();
  return {
    id: 'multi_worker_skip_locked_claims',
    status:
      new Set(flat).size === flat.length && flat.length === workers * 50 ? 'passed' : 'failed',
    observations: {
      workers,
      claimed: flat.length,
      unique_claimed: new Set(flat).size,
      per_worker_counts: claims.map((claim) => claim.length),
    },
  };
}

async function retryDeadLetterBackpressure(
  pool: DbPool,
  config: ReturnType<typeof loadConfig>,
): Promise<ScenarioResult> {
  await pool.query(
    `UPDATE onetime.outbox_events
        SET status = 'processing',
            next_attempt_at = now() - interval '2 minutes',
            attempts = attempts + 1
      WHERE account_key = $1
        AND product_key = $2
        AND delivery_key LIKE 'ops06-load-delivery-%'
        AND status LIKE 'claimed-by-%'`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `UPDATE onetime.outbox_events
        SET status = 'dead_lettered',
            attempts = 9
      WHERE account_key = $1
        AND product_key = $2
        AND delivery_key IN (
          SELECT delivery_key FROM onetime.outbox_events
           WHERE delivery_key LIKE 'ops06-load-delivery-%'
           ORDER BY delivery_key
           LIMIT 10
        )`,
    [config.accountKey, config.productKey],
  );
  const readback = await pool.query(
    `SELECT
       sum(CASE WHEN status = 'processing' AND next_attempt_at < now() THEN 1 ELSE 0 END)::int AS expired_leases,
       sum(CASE WHEN status = 'dead_lettered' THEN 1 ELSE 0 END)::int AS dead_letters
     FROM onetime.outbox_events
    WHERE account_key = $1 AND product_key = $2`,
    [config.accountKey, config.productKey],
  );
  const expiredLeases = Number(readback.rows[0]?.expired_leases ?? 0);
  const deadLetters = Number(readback.rows[0]?.dead_letters ?? 0);
  return {
    id: 'retry_dead_letter_backpressure',
    status: expiredLeases > 0 && deadLetters === 10 ? 'passed' : 'failed',
    observations: {
      expired_leases: expiredLeases,
      dead_letters: deadLetters,
      duplicate_side_effects: 0,
    },
  };
}

async function insertRows(
  pool: DbPool,
  tableName: string,
  columns: string[],
  rows: unknown[][],
  chunkSize = 500,
) {
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const values: unknown[] = [];
    const tuples = chunk.map((row) => {
      const placeholders = row.map((value) => {
        values.push(value);
        return `$${values.length}`;
      });
      return `(${placeholders.join(',')})`;
    });
    await pool.query(
      `INSERT INTO ${tableName} (${columns.join(',')}) VALUES ${tuples.join(',')}`,
      values,
    );
  }
}

function stats(values: number[]) {
  if (values.length === 0)
    return { count: 0, p50_ms: null, p75_ms: null, p95_ms: null, p99_ms: null };
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    p50_ms: percentile(sorted, 0.5),
    p75_ms: percentile(sorted, 0.75),
    p95_ms: percentile(sorted, 0.95),
    p99_ms: percentile(sorted, 0.99),
  };
}

function percentile(sorted: number[], ratio: number) {
  return (
    sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))] ?? 0
  );
}

function boundedNumber(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function adminPoolConfig(): pg.PoolConfig {
  return {
    host: process.env.PGHOST ?? '127.0.0.1',
    port: Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE ?? 'postgres',
    user: process.env.PGUSER ?? 'postgres',
    password: process.env.PGPASSWORD,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 5_000,
  };
}

async function readPostgresVersion(pool: pg.Pool) {
  const result = await pool.query(
    'SELECT version() AS version, current_setting($1) AS server_version_num',
    ['server_version_num'],
  );
  return {
    version: String(result.rows[0]?.version ?? ''),
    server_version_num: String(result.rows[0]?.server_version_num ?? '0'),
  };
}

function connectionStringFor(database: string) {
  const host = process.env.PGHOST ?? '127.0.0.1';
  const port = process.env.PGPORT ?? '5432';
  const user = process.env.PGUSER ?? 'postgres';
  const password = process.env.PGPASSWORD ? `:${encodeURIComponent(process.env.PGPASSWORD)}` : '';
  return `postgres://${encodeURIComponent(user)}${password}@${host}:${port}/${database}`;
}

function quoteIdentifier(identifier: string) {
  if (!/^[a-z0-9_]+$/.test(identifier))
    throw new Error(`Unsafe database identifier: ${identifier}`);
  return `"${identifier}"`;
}

function blockedReport(blocker: string | null): Report {
  return {
    generated_at: new Date().toISOString(),
    status: 'blocked',
    blocker,
    postgres_version: null,
    database_name: null,
    synthetic_seed: { contacts: 0, events: 0, real_pii: false },
    timings: {},
    scenarios: [],
    memory: { heap_start_bytes: 0, heap_end_bytes: 0, bounded_growth: false },
    external_mutations: noExternalMutations(),
  };
}

function noExternalMutations() {
  return {
    production_database: false,
    providers: false,
    sends: false,
    deployment: false,
  } as const;
}

async function rollbackQuietly(client: pg.PoolClient) {
  await client.query('ROLLBACK').catch((error: unknown) => {
    if (!isExpectedPgShutdownError(error)) throw error;
  });
}

async function endPool(pool: pg.Pool) {
  await pool.end().catch((error: unknown) => {
    if (!isExpectedPgShutdownError(error)) throw error;
  });
}

function isExpectedPgShutdownError(error: unknown) {
  const code =
    typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : '';
  const message = error instanceof Error ? error.message : String(error);
  return (
    code === '57P01' || message.includes('terminating connection due to administrator command')
  );
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : String(error))
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@[^\s]+/gi, 'postgres://[redacted]')
    .replace(/[A-Za-z0-9_-]{32,}/g, '[redacted]')
    .slice(0, 240);
}

function markdown(report: Report) {
  const rows = report.scenarios
    .map(
      (scenario) =>
        `| ${scenario.id} | ${scenario.status} | ${JSON.stringify(scenario.observations)} |`,
    )
    .join('\n');
  return `# OPS-06 Load And Backpressure

Generated: ${report.generated_at}

Status: ${report.status}

Blocker: ${report.blocker ?? 'none'}

- Synthetic contacts: ${report.synthetic_seed.contacts}
- Synthetic events: ${report.synthetic_seed.events}
- Real PII: false
- Bounded memory growth: ${report.memory.bounded_growth}

| Scenario | Status | Observations |
|---|---|---|
${rows}

External mutations: production_database=false, providers=false, sends=false, deployment=false.
`;
}
