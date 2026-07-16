import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { deterministicAlertSink, evaluateOpsAlerts } from '../packages/observability/src/index.ts';
import { opsHealthSnapshotSchema } from '../packages/contracts/src/ops/index.ts';

const outputDir = path.resolve(process.env.OPS06_OUTPUT_DIR ?? 'ops/codex-runs/OPS-06/evidence');
const outputJson = path.join(outputDir, 'alert-eval.json');
const outputMd = path.join(outputDir, 'alert-eval.md');
const generatedAt = new Date().toISOString();

const fixture = opsHealthSnapshotSchema.parse({
  schema_version: 'ops.health.v1',
  generated_at: generatedAt,
  ok: false,
  account_key: 'one_time',
  product_key: 'one_time_mishnah_class',
  dependencies: [
    {
      name: 'database',
      ok: true,
      essential: true,
      status: 'ok',
      latency_ms: 4,
      blocker_code: null,
      detail: 'query ok',
    },
  ],
  optional_dependencies: [
    {
      name: 'email_transport',
      ok: true,
      essential: false,
      status: 'disabled',
      latency_ms: null,
      blocker_code: null,
      detail: 'disabled by runtime flag',
    },
  ],
  queues: [
    {
      queue: 'delivery_outbox',
      ready_count: 8,
      oldest_ready_age_ms: 720_000,
      leased_count: 2,
      oldest_lease_age_ms: 180_000,
      expired_lease_count: 1,
      retry_count: 12,
      dead_letter_count: 1,
      oldest_dead_letter_age_ms: 900_000,
      provider_disabled_count: 3,
      throughput_15m: 24,
      failure_classes: [{ class: 'provider_timeout', count: 1 }],
    },
    {
      queue: 'support_outbox',
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
    },
  ],
  workers: [
    {
      worker_type: 'delivery_outbox',
      worker_instance_key: 'delivery_outbox:fixture',
      state: 'stale',
      started_at: generatedAt,
      last_seen_at: generatedAt,
      draining_at: null,
      stopped_at: null,
      heartbeat_age_ms: 180_000,
      version: 'fixture',
      commit_sha: 'fixture',
      readiness: { mode: 'continuous' },
    },
  ],
  blockers: [
    {
      code: 'delivery_outbox_expired_leases',
      dependency: 'delivery_outbox',
      message: 'delivery_outbox has expired leases that require lease-safe recovery.',
    },
    {
      code: 'delivery_outbox_dead_letters',
      dependency: 'delivery_outbox',
      message: 'delivery_outbox has dead-letter rows that need operator review.',
    },
    {
      code: 'delivery_outbox_heartbeat_stale',
      dependency: 'worker_heartbeats',
      message: 'delivery_outbox heartbeat is stale.',
    },
  ],
});

const alerts = evaluateOpsAlerts(fixture);
const sink = deterministicAlertSink(alerts);
const report = {
  generated_at: generatedAt,
  status: alerts.length >= 3 ? 'passed' : 'failed',
  alert_count: alerts.length,
  sink,
  external_notifications_sent: false,
};

await mkdir(outputDir, { recursive: true });
await writeFile(outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
await writeFile(
  outputMd,
  `# OPS-06 Alert Evaluation

Generated: ${generatedAt}

Status: ${report.status}

Alerts produced: ${alerts.length}

Sink: deterministic-local

External notifications sent: false
`,
  'utf8',
);
process.stdout.write(`OPS-06 alert evaluation ${report.status}: ${outputJson}\n`);
if (report.status !== 'passed') process.exitCode = 1;
