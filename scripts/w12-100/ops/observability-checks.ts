import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const OBSERVABILITY_EVIDENCE_SCHEMA = 'onetime.w12_100.observability_evidence.v1';

export type AlertSeverity = 'warning' | 'critical';
export type AlertCheckId =
  | 'web_readiness'
  | 'worker_heartbeat'
  | 'queue_depth'
  | 'queue_oldest_age'
  | 'delivery_retries'
  | 'delivery_dead_letters'
  | 'database_saturation'
  | 'rate_limit_spikes'
  | 'login_failures'
  | 'webhook_verification_failures'
  | 'class_launch_failures'
  | 'billing_webhook_failures'
  | 'backup_age';

export type AlertCheckDefinition = {
  id: AlertCheckId;
  title: string;
  severity: AlertSeverity;
  source: string;
  threshold: string;
  evidence_fields: string[];
  fail_closed: boolean;
  runbook: string;
};

export type ObservabilitySnapshot = {
  schema_version?: string;
  generated_at?: string;
  web?: {
    ready?: boolean;
    health_status?: number;
    ready_status?: number;
    version_commit_sha?: string;
  };
  workers?: Array<{
    worker_type?: string;
    state?: string;
    heartbeat_age_ms?: number;
  }>;
  queues?: Array<{
    queue?: string;
    ready_count?: number;
    oldest_ready_age_ms?: number | null;
    retry_count?: number;
    dead_letter_count?: number;
  }>;
  database?: {
    connection_saturation_percent?: number;
    cpu_saturation_percent?: number;
    storage_saturation_percent?: number;
  };
  rate_limits?: {
    spike_count_5m?: number;
    max_limited_ratio_5m?: number;
  };
  auth?: {
    login_failures_5m?: number;
    login_failure_ratio_5m?: number;
  };
  webhooks?: {
    whatsapp_verification_failures_5m?: number;
    telegram_verification_failures_5m?: number;
    generic_signature_failures_5m?: number;
  };
  classes?: {
    launch_failures_15m?: number;
  };
  billing?: {
    webhook_failures_5m?: number;
    webhook_signature_failures_5m?: number;
  };
  backups?: {
    latest_backup_age_minutes?: number;
    pitr_enabled?: boolean;
  };
};

export type AlertEvaluation = {
  check_id: AlertCheckId;
  status: 'passed' | 'firing' | 'missing';
  severity: AlertSeverity;
  summary: string;
  evidence: Record<string, string | number | boolean | null>;
};

export type ObservabilityEvidence = {
  schema_version: typeof OBSERVABILITY_EVIDENCE_SCHEMA;
  generated_at: string;
  status: 'passed' | 'blocked';
  external_notifications_sent: false;
  production_mutations: 0;
  checks: AlertEvaluation[];
};

export const W12_100_ALERT_CHECKS: AlertCheckDefinition[] = [
  {
    id: 'web_readiness',
    title: 'Web readiness',
    severity: 'critical',
    source: 'GET /health, GET /ready, GET /version, onetime_ready',
    threshold:
      '/ready must be 2xx and ok=true; /health must be 2xx; /version commit must match expected source',
    evidence_fields: [
      'web.ready',
      'web.health_status',
      'web.ready_status',
      'web.version_commit_sha',
    ],
    fail_closed: true,
    runbook: 'post-deploy-verification.md',
  },
  {
    id: 'worker_heartbeat',
    title: 'Worker heartbeat',
    severity: 'critical',
    source: '/api/internal/ops/diagnostics snapshot.workers or onetime_worker_heartbeat_age_ms',
    threshold: 'at least one delivery worker heartbeat state is not stale and age <= 120000 ms',
    evidence_fields: ['workers[].worker_type', 'workers[].state', 'workers[].heartbeat_age_ms'],
    fail_closed: true,
    runbook: 'post-deploy-verification.md',
  },
  {
    id: 'queue_depth',
    title: 'Queue depth',
    severity: 'warning',
    source: '/api/internal/ops/diagnostics snapshot.queues or onetime_queue_ready_count',
    threshold: 'ready_count <= 50 for every launch queue',
    evidence_fields: ['queues[].queue', 'queues[].ready_count'],
    fail_closed: true,
    runbook: 'alert-observability.md',
  },
  {
    id: 'queue_oldest_age',
    title: 'Oldest ready queue age',
    severity: 'warning',
    source: '/api/internal/ops/diagnostics snapshot.queues',
    threshold: 'oldest_ready_age_ms <= 600000 when ready_count > 0',
    evidence_fields: ['queues[].queue', 'queues[].oldest_ready_age_ms'],
    fail_closed: true,
    runbook: 'alert-observability.md',
  },
  {
    id: 'delivery_retries',
    title: 'Delivery retries',
    severity: 'critical',
    source: '/api/internal/ops/diagnostics snapshot.queues or retry metrics',
    threshold: 'retry_count <= 100 for every delivery queue',
    evidence_fields: ['queues[].queue', 'queues[].retry_count'],
    fail_closed: true,
    runbook: 'alert-observability.md',
  },
  {
    id: 'delivery_dead_letters',
    title: 'Delivery dead letters',
    severity: 'critical',
    source: '/api/internal/ops/diagnostics snapshot.queues or dead-letter metrics',
    threshold: 'dead_letter_count must be 0 before launch or promotion',
    evidence_fields: ['queues[].queue', 'queues[].dead_letter_count'],
    fail_closed: true,
    runbook: 'alert-observability.md',
  },
  {
    id: 'database_saturation',
    title: 'Database saturation',
    severity: 'critical',
    source: 'Railway metrics export or database metrics snapshot',
    threshold: 'connection, CPU, and storage saturation must each stay below 85 percent',
    evidence_fields: [
      'database.connection_saturation_percent',
      'database.cpu_saturation_percent',
      'database.storage_saturation_percent',
    ],
    fail_closed: true,
    runbook: 'alert-observability.md',
  },
  {
    id: 'rate_limit_spikes',
    title: 'Rate-limit spikes',
    severity: 'warning',
    source: 'HTTP/rate-limit metrics',
    threshold: 'spike_count_5m <= 20 and max_limited_ratio_5m <= 0.10',
    evidence_fields: ['rate_limits.spike_count_5m', 'rate_limits.max_limited_ratio_5m'],
    fail_closed: true,
    runbook: 'alert-observability.md',
  },
  {
    id: 'login_failures',
    title: 'Login failures',
    severity: 'warning',
    source: 'auth metrics',
    threshold: 'login_failures_5m <= 20 and login_failure_ratio_5m <= 0.20',
    evidence_fields: ['auth.login_failures_5m', 'auth.login_failure_ratio_5m'],
    fail_closed: true,
    runbook: 'alert-observability.md',
  },
  {
    id: 'webhook_verification_failures',
    title: 'Webhook verification failures',
    severity: 'critical',
    source: 'WhatsApp, Telegram, and generic webhook verification metrics',
    threshold: 'verification/signature failures must be 0 during launch window',
    evidence_fields: [
      'webhooks.whatsapp_verification_failures_5m',
      'webhooks.telegram_verification_failures_5m',
      'webhooks.generic_signature_failures_5m',
    ],
    fail_closed: true,
    runbook: 'alert-observability.md',
  },
  {
    id: 'class_launch_failures',
    title: 'Class launch failures',
    severity: 'critical',
    source: 'classroom launch metrics',
    threshold: 'launch_failures_15m must be 0',
    evidence_fields: ['classes.launch_failures_15m'],
    fail_closed: true,
    runbook: 'alert-observability.md',
  },
  {
    id: 'billing_webhook_failures',
    title: 'Billing webhook failures',
    severity: 'critical',
    source: 'Stripe test/live webhook metrics as appropriate for target',
    threshold: 'webhook failures and signature failures must be 0 during launch window',
    evidence_fields: ['billing.webhook_failures_5m', 'billing.webhook_signature_failures_5m'],
    fail_closed: true,
    runbook: 'alert-observability.md',
  },
  {
    id: 'backup_age',
    title: 'Backup age',
    severity: 'critical',
    source: 'Railway backup metadata export',
    threshold: 'latest_backup_age_minutes <= 1440 and PITR metadata must be present',
    evidence_fields: ['backups.latest_backup_age_minutes', 'backups.pitr_enabled'],
    fail_closed: true,
    runbook: 'alert-observability.md',
  },
];

export function evaluateObservabilitySnapshot(snapshot: ObservabilitySnapshot) {
  const checks: AlertEvaluation[] = [
    evaluateWebReadiness(snapshot),
    evaluateWorkerHeartbeat(snapshot),
    evaluateQueueDepth(snapshot),
    evaluateQueueOldestAge(snapshot),
    evaluateDeliveryRetries(snapshot),
    evaluateDeliveryDeadLetters(snapshot),
    evaluateDatabaseSaturation(snapshot),
    evaluateRateLimitSpikes(snapshot),
    evaluateLoginFailures(snapshot),
    evaluateWebhookVerificationFailures(snapshot),
    evaluateClassLaunchFailures(snapshot),
    evaluateBillingWebhookFailures(snapshot),
    evaluateBackupAge(snapshot),
  ];
  return {
    schema_version: OBSERVABILITY_EVIDENCE_SCHEMA,
    generated_at: new Date().toISOString(),
    status: checks.some((check) => check.status !== 'passed') ? 'blocked' : 'passed',
    external_notifications_sent: false,
    production_mutations: 0,
    checks,
  } satisfies ObservabilityEvidence;
}

function evaluateWebReadiness(snapshot: ObservabilitySnapshot): AlertEvaluation {
  const ready = snapshot.web?.ready === true;
  const healthStatus = snapshot.web?.health_status ?? null;
  const readyStatus = snapshot.web?.ready_status ?? null;
  const ok =
    ready &&
    typeof healthStatus === 'number' &&
    healthStatus >= 200 &&
    healthStatus < 300 &&
    typeof readyStatus === 'number' &&
    readyStatus >= 200 &&
    readyStatus < 300;
  return evaluation('web_readiness', ok ? 'passed' : missingOrFiring(snapshot.web), {
    ready,
    health_status: healthStatus,
    ready_status: readyStatus,
    version_commit_sha: snapshot.web?.version_commit_sha ?? null,
  });
}

function evaluateWorkerHeartbeat(snapshot: ObservabilitySnapshot): AlertEvaluation {
  const workers = snapshot.workers ?? [];
  const fresh = workers.filter(
    (worker) => worker.state !== 'stale' && numberOrInfinity(worker.heartbeat_age_ms) <= 120_000,
  );
  return evaluation(
    'worker_heartbeat',
    fresh.length > 0 ? 'passed' : workers.length === 0 ? 'missing' : 'firing',
    {
      worker_count: workers.length,
      fresh_worker_count: fresh.length,
    },
  );
}

function evaluateQueueDepth(snapshot: ObservabilitySnapshot): AlertEvaluation {
  const queues = snapshot.queues ?? [];
  const maxReady = maxValue(queues.map((queue) => queue.ready_count));
  return evaluation(
    'queue_depth',
    queues.length === 0 ? 'missing' : maxReady <= 50 ? 'passed' : 'firing',
    {
      queue_count: queues.length,
      max_ready_count: finiteOrNull(maxReady),
    },
  );
}

function evaluateQueueOldestAge(snapshot: ObservabilitySnapshot): AlertEvaluation {
  const queues = snapshot.queues ?? [];
  const oldest = maxValue(queues.map((queue) => queue.oldest_ready_age_ms ?? 0));
  return evaluation(
    'queue_oldest_age',
    queues.length === 0 ? 'missing' : oldest <= 600_000 ? 'passed' : 'firing',
    { queue_count: queues.length, max_oldest_ready_age_ms: finiteOrNull(oldest) },
  );
}

function evaluateDeliveryRetries(snapshot: ObservabilitySnapshot): AlertEvaluation {
  const queues = snapshot.queues ?? [];
  const retries = maxValue(queues.map((queue) => queue.retry_count));
  return evaluation(
    'delivery_retries',
    queues.length === 0 ? 'missing' : retries <= 100 ? 'passed' : 'firing',
    { max_retry_count: finiteOrNull(retries) },
  );
}

function evaluateDeliveryDeadLetters(snapshot: ObservabilitySnapshot): AlertEvaluation {
  const queues = snapshot.queues ?? [];
  const deadLetters = sumValue(queues.map((queue) => queue.dead_letter_count));
  return evaluation(
    'delivery_dead_letters',
    queues.length === 0 ? 'missing' : deadLetters === 0 ? 'passed' : 'firing',
    { total_dead_letter_count: deadLetters },
  );
}

function evaluateDatabaseSaturation(snapshot: ObservabilitySnapshot): AlertEvaluation {
  const max = maxValue([
    snapshot.database?.connection_saturation_percent,
    snapshot.database?.cpu_saturation_percent,
    snapshot.database?.storage_saturation_percent,
  ]);
  return evaluation(
    'database_saturation',
    snapshot.database ? (max < 85 ? 'passed' : 'firing') : 'missing',
    { max_saturation_percent: finiteOrNull(max) },
  );
}

function evaluateRateLimitSpikes(snapshot: ObservabilitySnapshot): AlertEvaluation {
  const spikes = snapshot.rate_limits?.spike_count_5m;
  const ratio = snapshot.rate_limits?.max_limited_ratio_5m;
  const ok = numberOrInfinity(spikes) <= 20 && numberOrInfinity(ratio) <= 0.1;
  return evaluation(
    'rate_limit_spikes',
    snapshot.rate_limits ? (ok ? 'passed' : 'firing') : 'missing',
    {
      spike_count_5m: spikes ?? null,
      max_limited_ratio_5m: ratio ?? null,
    },
  );
}

function evaluateLoginFailures(snapshot: ObservabilitySnapshot): AlertEvaluation {
  const failures = snapshot.auth?.login_failures_5m;
  const ratio = snapshot.auth?.login_failure_ratio_5m;
  const ok = numberOrInfinity(failures) <= 20 && numberOrInfinity(ratio) <= 0.2;
  return evaluation('login_failures', snapshot.auth ? (ok ? 'passed' : 'firing') : 'missing', {
    login_failures_5m: failures ?? null,
    login_failure_ratio_5m: ratio ?? null,
  });
}

function evaluateWebhookVerificationFailures(snapshot: ObservabilitySnapshot): AlertEvaluation {
  const total =
    numberOrZero(snapshot.webhooks?.whatsapp_verification_failures_5m) +
    numberOrZero(snapshot.webhooks?.telegram_verification_failures_5m) +
    numberOrZero(snapshot.webhooks?.generic_signature_failures_5m);
  return evaluation(
    'webhook_verification_failures',
    snapshot.webhooks ? (total === 0 ? 'passed' : 'firing') : 'missing',
    { total_verification_failures_5m: total },
  );
}

function evaluateClassLaunchFailures(snapshot: ObservabilitySnapshot): AlertEvaluation {
  const failures = snapshot.classes?.launch_failures_15m;
  return evaluation(
    'class_launch_failures',
    snapshot.classes ? (numberOrZero(failures) === 0 ? 'passed' : 'firing') : 'missing',
    { launch_failures_15m: failures ?? null },
  );
}

function evaluateBillingWebhookFailures(snapshot: ObservabilitySnapshot): AlertEvaluation {
  const total =
    numberOrZero(snapshot.billing?.webhook_failures_5m) +
    numberOrZero(snapshot.billing?.webhook_signature_failures_5m);
  return evaluation(
    'billing_webhook_failures',
    snapshot.billing ? (total === 0 ? 'passed' : 'firing') : 'missing',
    { total_billing_webhook_failures_5m: total },
  );
}

function evaluateBackupAge(snapshot: ObservabilitySnapshot): AlertEvaluation {
  const age = snapshot.backups?.latest_backup_age_minutes;
  const pitr = snapshot.backups?.pitr_enabled === true;
  const ok = numberOrInfinity(age) <= 1440 && pitr;
  return evaluation('backup_age', snapshot.backups ? (ok ? 'passed' : 'firing') : 'missing', {
    latest_backup_age_minutes: age ?? null,
    pitr_enabled: pitr,
  });
}

function evaluation(
  checkId: AlertCheckId,
  status: AlertEvaluation['status'],
  evidence: Record<string, string | number | boolean | null>,
): AlertEvaluation {
  const definition = definitionFor(checkId);
  return {
    check_id: checkId,
    status,
    severity: definition.severity,
    summary:
      status === 'passed'
        ? `${definition.title} is within launch threshold.`
        : status === 'missing'
          ? `${definition.title} evidence is missing.`
          : `${definition.title} threshold is firing.`,
    evidence,
  };
}

function definitionFor(checkId: AlertCheckId) {
  const definition = W12_100_ALERT_CHECKS.find((item) => item.id === checkId);
  if (!definition) throw new Error(`Missing alert definition for ${checkId}`);
  return definition;
}

function missingOrFiring(value: unknown): AlertEvaluation['status'] {
  return value ? 'firing' : 'missing';
}

function maxValue(values: Array<number | null | undefined>) {
  const finite = values.filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  );
  return finite.length > 0 ? Math.max(...finite) : Number.POSITIVE_INFINITY;
}

function sumValue(values: Array<number | null | undefined>) {
  return values.reduce<number>((total, value) => total + numberOrZero(value), 0);
}

function numberOrInfinity(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function numberOrZero(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function finiteOrNull(value: number) {
  return Number.isFinite(value) ? value : null;
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const snapshot = JSON.parse(await readFile(options.inputPath, 'utf8')) as ObservabilitySnapshot;
  const evidence = evaluateObservabilitySnapshot(snapshot);
  const output = `${JSON.stringify(evidence, null, 2)}\n`;
  if (options.outputPath) {
    await mkdir(path.dirname(options.outputPath), { recursive: true });
    await writeFile(options.outputPath, output, 'utf8');
  }
  process.stdout.write(output);
  if (evidence.status !== 'passed') process.exitCode = 1;
}

function parseCliOptions(args: string[]) {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg !== '--input' && arg !== '--output')
      throw new Error(`Unexpected argument ${arg ?? ''}`);
    if (!next || next.startsWith('--')) throw new Error(`Missing value for ${arg}`);
    values.set(arg.slice(2), next);
    index += 1;
  }
  const inputPath = values.get('input');
  if (!inputPath)
    throw new Error(
      'Usage: observability-checks.ts --input <snapshot.json> [--output <evidence.json>]',
    );
  return {
    inputPath,
    ...(values.get('output') ? { outputPath: values.get('output') } : {}),
  };
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
