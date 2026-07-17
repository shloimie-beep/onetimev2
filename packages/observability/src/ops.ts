import { createHash, randomUUID } from 'node:crypto';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import type { AppConfig } from '../../config/src/index.ts';
import type { DbPool } from '../../db/src/index.ts';
import {
  opsAlertEventSchema,
  opsHealthSnapshotSchema,
  opsWorkerStateSchema,
  type OpsAlertEvent,
  type OpsHealthSnapshot,
  type OpsQueueHealth,
  type OpsWorkerState,
} from '../../contracts/src/ops/index.ts';

type Dependency = OpsHealthSnapshot['dependencies'][number];
type Blocker = OpsHealthSnapshot['blockers'][number];
type SqlRow = Record<string, unknown>;

export type OpsReadinessSnapshot = Pick<
  OpsHealthSnapshot,
  'dependencies' | 'optional_dependencies' | 'blockers'
> & {
  ok: boolean;
  generated_at: string;
};

export function opsWorkerInstanceKey(workerType: string, source: NodeJS.ProcessEnv) {
  const explicit = source.OT_WORKER_INSTANCE_ID ?? source.RAILWAY_REPLICA_ID ?? source.HOSTNAME;
  if (explicit) return `${workerType}:${explicit}`.slice(0, 160);
  return `${workerType}:${os.hostname()}:${process.pid}:${randomUUID()}`.slice(0, 160);
}

export async function upsertOpsWorkerHeartbeat(input: {
  pool: DbPool;
  config: AppConfig;
  workerType: string;
  workerInstanceKey: string;
  state: Exclude<OpsWorkerState, 'stale'>;
  now?: Date;
  readiness?: Record<string, unknown>;
}) {
  const now = input.now ?? new Date();
  const leaseExpiresAt = new Date(
    now.getTime() + Math.max(30_000, input.config.operationsWorkerHeartbeatTtlMs),
  );
  await input.pool.query(
    `INSERT INTO onetime.worker_heartbeats
       (worker_type, worker_instance_key, account_key, product_key, state, started_at,
        last_seen_at, lease_expires_at, draining_at, stopped_at, version, commit_sha, readiness,
        created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10,$11,$12::jsonb,$6,$6)
     ON CONFLICT (worker_type, worker_instance_key)
     DO UPDATE SET
       account_key = EXCLUDED.account_key,
       product_key = EXCLUDED.product_key,
       state = EXCLUDED.state,
       last_seen_at = EXCLUDED.last_seen_at,
       lease_expires_at = EXCLUDED.lease_expires_at,
       draining_at = EXCLUDED.draining_at,
       stopped_at = EXCLUDED.stopped_at,
       version = EXCLUDED.version,
       commit_sha = EXCLUDED.commit_sha,
       readiness = EXCLUDED.readiness,
       updated_at = EXCLUDED.updated_at`,
    [
      input.workerType,
      input.workerInstanceKey,
      input.config.accountKey,
      input.config.productKey,
      input.state,
      now.toISOString(),
      leaseExpiresAt.toISOString(),
      input.state === 'draining' ? now.toISOString() : null,
      input.state === 'stopped' ? now.toISOString() : null,
      input.config.appVersion,
      input.config.commitSha,
      JSON.stringify(sanitizeReadiness(input.readiness ?? {})),
    ],
  );
}

export async function markOpsWorkerDraining(input: {
  pool: DbPool;
  workerType: string;
  workerInstanceKey: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  await input.pool.query(
    `UPDATE onetime.worker_heartbeats
        SET state = 'draining',
            draining_at = COALESCE(draining_at, $3::timestamptz),
            last_seen_at = $3::timestamptz,
            updated_at = $3::timestamptz
      WHERE worker_type = $1
        AND worker_instance_key = $2`,
    [input.workerType, input.workerInstanceKey, now.toISOString()],
  );
}

export async function markOpsWorkerStopped(input: {
  pool: DbPool;
  workerType: string;
  workerInstanceKey: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  await input.pool.query(
    `UPDATE onetime.worker_heartbeats
        SET state = 'stopped',
            stopped_at = $3::timestamptz,
            last_seen_at = $3::timestamptz,
            updated_at = $3::timestamptz
      WHERE worker_type = $1
        AND worker_instance_key = $2`,
    [input.workerType, input.workerInstanceKey, now.toISOString()],
  );
}

export async function collectOpsReadiness(input: {
  pool: DbPool;
  config: AppConfig;
  now?: Date;
}): Promise<OpsReadinessSnapshot> {
  const generatedAt = (input.now ?? new Date()).toISOString();
  const dependencies: Dependency[] = [];
  const blockers: Blocker[] = [];
  dependencies.push(await checkDatabase(input.pool));
  dependencies.push(await checkMigrationLedger(input.pool));
  for (const dependency of dependencies) {
    if (!dependency.ok) {
      blockers.push({
        code: dependency.blocker_code ?? `${dependency.name}_unavailable`,
        dependency: dependency.name,
        message: dependency.detail ?? `${dependency.name} is unavailable.`,
      });
    }
  }
  const optionalDependencies = optionalProviderDependencies(input.config);
  return {
    generated_at: generatedAt,
    ok: blockers.length === 0,
    dependencies,
    optional_dependencies: optionalDependencies,
    blockers,
  };
}

export async function collectOpsHealthSnapshot(input: {
  pool: DbPool;
  config: AppConfig;
  now?: Date;
}): Promise<OpsHealthSnapshot> {
  const now = input.now ?? new Date();
  const readiness = await collectOpsReadiness({ ...input, now });
  const blockers = [...readiness.blockers];
  const queues = await collectQueueHealth(input.pool, input.config, now, blockers);
  const workers = await collectWorkerHeartbeats(input.pool, input.config, now, blockers);

  for (const queue of queues) {
    if (queue.expired_lease_count > 0) {
      blockers.push({
        code: `${queue.queue}_expired_leases`,
        dependency: queue.queue,
        message: `${queue.queue} has expired leases that require lease-safe recovery.`,
      });
    }
    if (queue.dead_letter_count > 0) {
      blockers.push({
        code: `${queue.queue}_dead_letters`,
        dependency: queue.queue,
        message: `${queue.queue} has dead-letter rows that need operator review.`,
      });
    }
  }
  for (const worker of workers) {
    if (worker.state === 'stale') {
      blockers.push({
        code: `${worker.worker_type}_heartbeat_stale`,
        dependency: 'worker_heartbeats',
        message: `${worker.worker_type} heartbeat is stale.`,
      });
    }
  }

  return opsHealthSnapshotSchema.parse({
    schema_version: 'ops.health.v1',
    generated_at: now.toISOString(),
    ok: blockers.length === 0,
    account_key: input.config.accountKey,
    product_key: input.config.productKey,
    dependencies: readiness.dependencies,
    optional_dependencies: readiness.optional_dependencies,
    queues,
    workers,
    blockers: dedupeBlockers(blockers),
  });
}

export function evaluateOpsAlerts(snapshot: OpsHealthSnapshot): OpsAlertEvent[] {
  const generatedAt = snapshot.generated_at;
  const alerts: OpsAlertEvent[] = [];
  for (const blocker of snapshot.blockers) {
    alerts.push(
      alertEvent({
        key: `blocker:${blocker.code}`,
        severity: blocker.code.includes('dead_letters') ? 'warning' : 'critical',
        summary: blocker.message,
        routingKey: 'engineering',
        generatedAt,
        evidence: { dependency: blocker.dependency, code: blocker.code },
      }),
    );
  }
  for (const queue of snapshot.queues) {
    if ((queue.oldest_ready_age_ms ?? 0) > 10 * 60_000) {
      alerts.push(
        alertEvent({
          key: `queue-lag:${queue.queue}`,
          severity: 'warning',
          summary: `${queue.queue} oldest ready item is above 10 minutes.`,
          routingKey: 'owner_ops',
          generatedAt,
          evidence: {
            queue: queue.queue,
            oldest_ready_age_ms: queue.oldest_ready_age_ms,
            ready_count: queue.ready_count,
          },
        }),
      );
    }
    if (queue.retry_count > 100) {
      alerts.push(
        alertEvent({
          key: `retry-storm:${queue.queue}`,
          severity: 'critical',
          summary: `${queue.queue} retry count is above the bounded storm threshold.`,
          routingKey: 'engineering',
          generatedAt,
          evidence: { queue: queue.queue, retry_count: queue.retry_count },
        }),
      );
    }
  }
  return alerts;
}

export function deterministicAlertSink(events: OpsAlertEvent[]) {
  return {
    sink: 'deterministic-local',
    external_notifications_sent: false,
    accepted: events.map((event) => event.alert_key),
    events,
  };
}

async function checkDatabase(pool: DbPool): Promise<Dependency> {
  const started = performance.now();
  try {
    await pool.query('SELECT 1');
    return dependency('database', true, 'ok', performance.now() - started, null, 'query ok');
  } catch (error) {
    return dependency(
      'database',
      false,
      'blocked',
      performance.now() - started,
      'database_unavailable',
      safeError(error),
    );
  }
}

async function checkMigrationLedger(pool: DbPool): Promise<Dependency> {
  const started = performance.now();
  try {
    const result = await pool.query(
      `SELECT count(*)::int AS count, max(id) AS latest
         FROM onetime.schema_migrations`,
    );
    const count = Number(result.rows[0]?.count ?? 0);
    const latest = String(result.rows[0]?.latest ?? '');
    if (count < 1) {
      return dependency(
        'schema_migrations',
        false,
        'missing',
        performance.now() - started,
        'migration_ledger_empty',
        'No migration ledger rows are present.',
      );
    }
    return dependency(
      'schema_migrations',
      true,
      'ok',
      performance.now() - started,
      null,
      `latest=${latest}`,
    );
  } catch (error) {
    return dependency(
      'schema_migrations',
      false,
      'missing',
      performance.now() - started,
      'migration_ledger_unavailable',
      safeError(error),
    );
  }
}

function optionalProviderDependencies(config: AppConfig): Dependency[] {
  return [
    dependency(
      'email_transport',
      true,
      config.resendTransportEnabled ? 'ok' : 'disabled',
      null,
      null,
      config.resendTransportEnabled ? 'resend transport flag enabled' : 'disabled by runtime flag',
      false,
    ),
    dependency(
      'whatsapp_transport',
      true,
      config.deliveryProviderTransportEnabled ? 'ok' : 'disabled',
      null,
      null,
      config.deliveryProviderTransportEnabled
        ? 'provider transport flag enabled'
        : 'disabled by runtime flag',
      false,
    ),
    dependency(
      'support_bridge',
      true,
      config.ot89SupportDeliveryMode === 'mock' ? 'ok' : 'disabled',
      null,
      null,
      config.ot89SupportDeliveryMode === 'mock'
        ? 'mock sink configured'
        : 'disabled by runtime flag',
      false,
    ),
  ];
}

async function collectQueueHealth(
  pool: DbPool,
  config: AppConfig,
  now: Date,
  blockers: Blocker[],
): Promise<OpsQueueHealth[]> {
  const queues = await Promise.all([
    deliveryOutboxHealth(pool, config, now, blockers),
    supportOutboxHealth(pool, config, now, blockers),
    lifecycleOutboxHealth(pool, config, now, blockers),
  ]);
  return queues;
}

async function deliveryOutboxHealth(
  pool: DbPool,
  config: AppConfig,
  now: Date,
  blockers: Blocker[],
): Promise<OpsQueueHealth> {
  try {
    const result = await pool.query(
      `SELECT
         sum(CASE WHEN status = 'pending' AND next_attempt_at <= $3::timestamptz THEN 1 ELSE 0 END)::int AS ready_count,
         min(CASE WHEN status = 'pending' AND next_attempt_at <= $3::timestamptz THEN created_at ELSE NULL END) AS oldest_ready_at,
         sum(CASE WHEN status = 'processing' THEN 1 ELSE 0 END)::int AS leased_count,
         min(CASE WHEN status = 'processing' THEN next_attempt_at ELSE NULL END) AS oldest_lease_expires_at,
         sum(CASE WHEN status = 'processing' AND next_attempt_at <= $3::timestamptz THEN 1 ELSE 0 END)::int AS expired_lease_count,
         sum(CASE WHEN status = 'pending' AND attempts > 0 THEN 1 ELSE 0 END)::int AS retry_count,
         sum(CASE WHEN status IN ('dead_lettered', 'dead_letter') THEN 1 ELSE 0 END)::int AS dead_letter_count,
         min(CASE WHEN status IN ('dead_lettered', 'dead_letter') THEN created_at ELSE NULL END) AS oldest_dead_letter_at,
         sum(CASE WHEN status IN ('provider_off', 'skipped') THEN 1 ELSE 0 END)::int AS provider_disabled_count,
         sum(CASE WHEN delivered_at >= $4::timestamptz THEN 1 ELSE 0 END)::int AS throughput_15m
       FROM onetime.outbox_events
      WHERE account_key = $1 AND product_key = $2`,
      [
        config.accountKey,
        config.productKey,
        now.toISOString(),
        fifteenMinutesAgo(now).toISOString(),
      ],
    );
    return {
      ...queueBase('delivery_outbox', result.rows[0] ?? {}, now),
      failure_classes: await failureClasses(pool, 'delivery_outbox', config),
    };
  } catch (error) {
    blockers.push(queueUnavailableBlocker('delivery_outbox', error));
    return emptyQueue('delivery_outbox');
  }
}

async function supportOutboxHealth(
  pool: DbPool,
  config: AppConfig,
  now: Date,
  blockers: Blocker[],
): Promise<OpsQueueHealth> {
  try {
    const result = await pool.query(
      `SELECT
         sum(CASE WHEN status = 'PENDING' AND next_attempt_at <= $3::timestamptz THEN 1 ELSE 0 END)::int AS ready_count,
         min(CASE WHEN status = 'PENDING' AND next_attempt_at <= $3::timestamptz THEN created_at ELSE NULL END) AS oldest_ready_at,
         sum(CASE WHEN status = 'PROCESSING' THEN 1 ELSE 0 END)::int AS leased_count,
         min(CASE WHEN status = 'PROCESSING' THEN lease_expires_at ELSE NULL END) AS oldest_lease_expires_at,
         sum(CASE WHEN status = 'PROCESSING' AND lease_expires_at <= $3::timestamptz THEN 1 ELSE 0 END)::int AS expired_lease_count,
         sum(CASE WHEN status = 'PENDING' AND attempts > 0 THEN 1 ELSE 0 END)::int AS retry_count,
         sum(CASE WHEN status = 'DEAD_LETTER' THEN 1 ELSE 0 END)::int AS dead_letter_count,
         min(CASE WHEN status = 'DEAD_LETTER' THEN created_at ELSE NULL END) AS oldest_dead_letter_at,
         0::int AS provider_disabled_count,
         sum(CASE WHEN delivered_at >= $4::timestamptz THEN 1 ELSE 0 END)::int AS throughput_15m
       FROM onetime.support_outbox
      WHERE account_key = $1 AND product_key = $2`,
      [
        config.accountKey,
        config.productKey,
        now.toISOString(),
        fifteenMinutesAgo(now).toISOString(),
      ],
    );
    return {
      ...queueBase('support_outbox', result.rows[0] ?? {}, now),
      failure_classes: await failureClasses(pool, 'support_outbox', config),
    };
  } catch (error) {
    blockers.push(queueUnavailableBlocker('support_outbox', error));
    return emptyQueue('support_outbox');
  }
}

async function lifecycleOutboxHealth(
  pool: DbPool,
  config: AppConfig,
  now: Date,
  blockers: Blocker[],
): Promise<OpsQueueHealth> {
  try {
    const result = await pool.query(
      `SELECT
         sum(CASE WHEN state IN ('queued', 'retry') AND next_attempt_at <= $3::timestamptz THEN 1 ELSE 0 END)::int AS ready_count,
         min(CASE WHEN state IN ('queued', 'retry') AND next_attempt_at <= $3::timestamptz THEN created_at ELSE NULL END) AS oldest_ready_at,
         sum(CASE WHEN state = 'leased' THEN 1 ELSE 0 END)::int AS leased_count,
         min(CASE WHEN state = 'leased' THEN lease_expires_at ELSE NULL END) AS oldest_lease_expires_at,
         sum(CASE WHEN state = 'leased' AND lease_expires_at <= $3::timestamptz THEN 1 ELSE 0 END)::int AS expired_lease_count,
         sum(CASE WHEN state = 'retry' THEN 1 ELSE 0 END)::int AS retry_count,
         sum(CASE WHEN state = 'dead_letter' THEN 1 ELSE 0 END)::int AS dead_letter_count,
         min(CASE WHEN state = 'dead_letter' THEN created_at ELSE NULL END) AS oldest_dead_letter_at,
         sum(CASE WHEN state = 'provider_off' THEN 1 ELSE 0 END)::int AS provider_disabled_count,
         sum(CASE WHEN delivered_at >= $4::timestamptz THEN 1 ELSE 0 END)::int AS throughput_15m
       FROM onetime.account_lifecycle_delivery_outbox
      WHERE account_key = $1 AND product_key = $2`,
      [
        config.accountKey,
        config.productKey,
        now.toISOString(),
        fifteenMinutesAgo(now).toISOString(),
      ],
    );
    return {
      ...queueBase('account_lifecycle_outbox', result.rows[0] ?? {}, now),
      failure_classes: await failureClasses(pool, 'account_lifecycle_outbox', config),
    };
  } catch (error) {
    blockers.push(queueUnavailableBlocker('account_lifecycle_outbox', error));
    return emptyQueue('account_lifecycle_outbox');
  }
}

async function failureClasses(
  pool: DbPool,
  queue: OpsQueueHealth['queue'],
  config: AppConfig,
): Promise<OpsQueueHealth['failure_classes']> {
  try {
    if (queue === 'support_outbox') {
      const result = await pool.query(
        `SELECT COALESCE(last_error_code, 'unknown') AS class, count(*)::int AS count
           FROM onetime.support_outbox
          WHERE account_key = $1 AND product_key = $2 AND status = 'DEAD_LETTER'
          GROUP BY COALESCE(last_error_code, 'unknown')
          ORDER BY count DESC, class ASC
          LIMIT 10`,
        [config.accountKey, config.productKey],
      );
      return mapFailureClasses(result.rows);
    }
    if (queue === 'account_lifecycle_outbox') {
      const result = await pool.query(
        `SELECT COALESCE(last_error_code, 'unknown') AS class, count(*)::int AS count
           FROM onetime.account_lifecycle_delivery_outbox
          WHERE account_key = $1 AND product_key = $2 AND state = 'dead_letter'
          GROUP BY COALESCE(last_error_code, 'unknown')
          ORDER BY count DESC, class ASC
          LIMIT 10`,
        [config.accountKey, config.productKey],
      );
      return mapFailureClasses(result.rows);
    }
    const result = await pool.query(
      `SELECT COALESCE(metadata->>'failure_category', metadata->>'failure_code', event_type) AS class,
              count(*)::int AS count
         FROM onetime.audit_events
        WHERE account_key = $1
          AND product_key = $2
          AND event_type LIKE 'delivery_%'
          AND created_at >= now() - interval '24 hours'
        GROUP BY COALESCE(metadata->>'failure_category', metadata->>'failure_code', event_type)
        ORDER BY count DESC, class ASC
        LIMIT 10`,
      [config.accountKey, config.productKey],
    );
    return mapFailureClasses(result.rows);
  } catch {
    return [];
  }
}

async function collectWorkerHeartbeats(
  pool: DbPool,
  config: AppConfig,
  now: Date,
  blockers: Blocker[],
): Promise<OpsHealthSnapshot['workers']> {
  try {
    const result = await pool.query(
      `SELECT worker_type, worker_instance_key, state, started_at, last_seen_at,
              draining_at, stopped_at, lease_expires_at, version, commit_sha, readiness
         FROM onetime.worker_heartbeats
        WHERE account_key = $1 AND product_key = $2
        ORDER BY worker_type ASC, worker_instance_key ASC`,
      [config.accountKey, config.productKey],
    );
    return result.rows.map((row) => {
      const lastSeen = dateValue(row.last_seen_at) ?? now;
      const leaseExpires = dateValue(row.lease_expires_at) ?? now;
      const heartbeatAgeMs = Math.max(0, Math.round(now.getTime() - lastSeen.getTime()));
      const stale = leaseExpires.getTime() <= now.getTime() && stringValue(row.state) !== 'stopped';
      const parsedState = opsWorkerStateSchema.safeParse(stringValue(row.state));
      if (!parsedState.success) {
        blockers.push({
          code: 'WORKER_HEARTBEAT_UNKNOWN_STATE',
          dependency: 'worker_heartbeats',
          message: `Unknown worker state for ${stringValue(row.worker_instance_key).slice(0, 80)}.`,
        });
      }
      const state: OpsWorkerState = stale
        ? 'stale'
        : parsedState.success
          ? parsedState.data
          : 'stale';
      return {
        worker_type: stringValue(row.worker_type),
        worker_instance_key: stringValue(row.worker_instance_key),
        state,
        started_at: iso(row.started_at, now),
        last_seen_at: iso(row.last_seen_at, now),
        draining_at: nullableIso(row.draining_at),
        stopped_at: nullableIso(row.stopped_at),
        heartbeat_age_ms: heartbeatAgeMs,
        version: stringValue(row.version) || 'unknown',
        commit_sha: stringValue(row.commit_sha) || 'unknown',
        readiness: objectValue(row.readiness),
      };
    });
  } catch (error) {
    blockers.push({
      code: 'worker_heartbeats_unavailable',
      dependency: 'worker_heartbeats',
      message: safeError(error),
    });
    return [];
  }
}

function queueBase(queue: OpsQueueHealth['queue'], row: SqlRow, now: Date) {
  const oldestReadyAt = dateValue(row.oldest_ready_at);
  const oldestLeaseExpiresAt = dateValue(row.oldest_lease_expires_at);
  const oldestDeadLetterAt = dateValue(row.oldest_dead_letter_at);
  return {
    queue,
    ready_count: integer(row.ready_count),
    oldest_ready_age_ms: oldestReadyAt ? ageMs(now, oldestReadyAt) : null,
    leased_count: integer(row.leased_count),
    oldest_lease_age_ms: oldestLeaseExpiresAt ? ageMs(now, oldestLeaseExpiresAt) : null,
    expired_lease_count: integer(row.expired_lease_count),
    retry_count: integer(row.retry_count),
    dead_letter_count: integer(row.dead_letter_count),
    oldest_dead_letter_age_ms: oldestDeadLetterAt ? ageMs(now, oldestDeadLetterAt) : null,
    provider_disabled_count: integer(row.provider_disabled_count),
    throughput_15m: integer(row.throughput_15m),
  };
}

function emptyQueue(queue: OpsQueueHealth['queue']): OpsQueueHealth {
  return {
    queue,
    ready_count: 0,
    oldest_ready_age_ms: null,
    leased_count: 0,
    oldest_lease_age_ms: null,
    expired_lease_count: 0,
    retry_count: 0,
    dead_letter_count: 0,
    oldest_dead_letter_age_ms: null,
    provider_disabled_count: 0,
    throughput_15m: 0,
    failure_classes: [],
  };
}

function queueUnavailableBlocker(queue: OpsQueueHealth['queue'], error: unknown): Blocker {
  return {
    code: `${queue}_unavailable`,
    dependency: queue,
    message: safeError(error),
  };
}

function dependency(
  name: string,
  ok: boolean,
  status: Dependency['status'],
  latencyMs: number | null,
  blockerCode: string | null,
  detail: string | null,
  essential = true,
): Dependency {
  return {
    name,
    ok,
    essential,
    status,
    latency_ms: latencyMs === null ? null : Math.max(0, Math.round(latencyMs)),
    blocker_code: blockerCode,
    detail,
  };
}

function alertEvent(input: {
  key: string;
  severity: OpsAlertEvent['severity'];
  summary: string;
  routingKey: OpsAlertEvent['routing_key'];
  generatedAt: string;
  evidence: OpsAlertEvent['evidence'];
}) {
  const dedupeKey = createHash('sha256').update(input.key).digest('hex').slice(0, 24);
  return opsAlertEventSchema.parse({
    schema_version: 'ops.alert.v1',
    alert_key: input.key,
    severity: input.severity,
    status: 'firing',
    summary: input.summary,
    routing_key: input.routingKey,
    dedupe_key: dedupeKey,
    generated_at: input.generatedAt,
    evidence: input.evidence,
  });
}

function sanitizeReadiness(readiness: Record<string, unknown>) {
  const output: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(readiness)) {
    if (!/^[a-z0-9_.:-]{1,80}$/i.test(key)) continue;
    if (/secret|token|password|key|credential/i.test(key)) continue;
    if (typeof value === 'string') output[key] = value.slice(0, 160);
    else if (typeof value === 'number' && Number.isFinite(value)) output[key] = value;
    else if (typeof value === 'boolean') output[key] = value;
  }
  return output;
}

function dedupeBlockers(blockers: Blocker[]) {
  const seen = new Set<string>();
  return blockers.filter((blocker) => {
    const key = `${blocker.dependency}:${blocker.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mapFailureClasses(rows: SqlRow[]) {
  return rows.map((row) => ({
    class: stringValue(row.class).slice(0, 120) || 'unknown',
    count: integer(row.count),
  }));
}

function fifteenMinutesAgo(now: Date) {
  return new Date(now.getTime() - 15 * 60_000);
}

function ageMs(now: Date, value: Date) {
  return Math.max(0, Math.round(now.getTime() - value.getTime()));
}

function integer(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function dateValue(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function iso(value: unknown, fallback: Date) {
  return (dateValue(value) ?? fallback).toISOString();
}

function nullableIso(value: unknown) {
  return value ? (dateValue(value)?.toISOString() ?? null) : null;
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : String(value ?? '');
}

function objectValue(value: unknown): Record<string, string | number | boolean> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return objectValue(JSON.parse(value) as unknown);
    } catch {
      return {};
    }
  }
  if (typeof value !== 'object' || Array.isArray(value)) return {};
  return sanitizeReadiness(value as Record<string, unknown>);
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@[^\s]+/gi, 'postgres://[redacted]')
    .replace(/[A-Za-z0-9_-]{32,}/g, '[redacted]')
    .slice(0, 240);
}
