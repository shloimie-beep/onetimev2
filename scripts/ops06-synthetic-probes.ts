import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outputDir = path.resolve(process.env.OPS06_OUTPUT_DIR ?? 'ops/codex-runs/OPS-06/evidence');
const outputJson = path.join(outputDir, 'synthetic-probes.json');
const outputMd = path.join(outputDir, 'synthetic-probes.md');
const baseUrl = process.env.OPS06_BASE_URL?.replace(/\/+$/, '');
const probeToken = process.env.OPERATIONS_PROBE_TOKEN;

type ProbeResult = {
  id: string;
  status: 'passed' | 'failed' | 'blocked';
  http_status: number | null;
  latency_ms: number | null;
  detail: string;
};

type SyntheticProbeReport = {
  generated_at: string;
  target_base_url: string | null;
  status: 'passed' | 'failed' | 'blocked';
  duration_ms: number;
  results: ProbeResult[];
  external_mutations: {
    production_database: false;
    providers: false;
    sends: false;
    deployment: false;
  };
};

const startedAt = new Date();
const results: ProbeResult[] = [];

if (!baseUrl) {
  results.push({
    id: 'target_base_url',
    status: 'blocked',
    http_status: null,
    latency_ms: null,
    detail: 'Set OPS06_BASE_URL to run synthetic probes against a local/staging target.',
  });
} else {
  await probe('public_landing', '/', [200]);
  await probe('public_signup', '/signup', [200]);
  await probe('auth_lifecycle_login_page', '/login', [200]);
  await probe('private_session_role_denial', '/app/crm', [302, 401, 403], { redirect: 'manual' });
  await probeJson('db_readiness', '/ready', [200, 503], undefined, (body) =>
    Array.isArray(body.dependencies)
      ? 'readiness dependency payload present'
      : 'missing dependencies',
  );
  if (probeToken) {
    await probeJson(
      'worker_heartbeat_and_queue_diagnostics',
      '/api/internal/ops/diagnostics',
      [200, 503],
      { 'x-ops-probe-token': probeToken },
      summarizeOpsSnapshot,
    );
  } else {
    results.push({
      id: 'worker_heartbeat_and_queue_diagnostics',
      status: 'blocked',
      http_status: null,
      latency_ms: null,
      detail: 'OPERATIONS_PROBE_TOKEN is required for protected machine diagnostics.',
    });
  }
}

const completedAt = new Date();
const failed = results.filter((result) => result.status === 'failed');
const blocked = results.filter((result) => result.status === 'blocked');
const report: SyntheticProbeReport = {
  generated_at: completedAt.toISOString(),
  target_base_url: baseUrl ?? null,
  status: failed.length > 0 ? 'failed' : blocked.length > 0 ? 'blocked' : 'passed',
  duration_ms: completedAt.getTime() - startedAt.getTime(),
  results,
  external_mutations: {
    production_database: false,
    providers: false,
    sends: false,
    deployment: false,
  },
};

await mkdir(outputDir, { recursive: true });
await writeFile(outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
await writeFile(outputMd, markdown(report), 'utf8');
process.stdout.write(`OPS-06 synthetic probes ${report.status}: ${outputJson}\n`);
if (report.status === 'failed') process.exitCode = 1;

async function probe(
  id: string,
  targetPath: string,
  expectedStatuses: number[],
  init?: RequestInit,
) {
  const started = performance.now();
  try {
    const response = await fetch(`${baseUrl}${targetPath}`, init);
    const latency = Math.round(performance.now() - started);
    results.push({
      id,
      status: expectedStatuses.includes(response.status) ? 'passed' : 'failed',
      http_status: response.status,
      latency_ms: latency,
      detail: `expected=${expectedStatuses.join('/')}`,
    });
  } catch (error) {
    results.push({
      id,
      status: 'failed',
      http_status: null,
      latency_ms: Math.round(performance.now() - started),
      detail: safeError(error),
    });
  }
}

async function probeJson(
  id: string,
  targetPath: string,
  expectedStatuses: number[],
  headers: Record<string, string> | undefined,
  summarize: (body: Record<string, unknown>) => string,
) {
  const started = performance.now();
  try {
    const response = await fetch(`${baseUrl}${targetPath}`, headers ? { headers } : {});
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const detail = summarize(body);
    const passed = expectedStatuses.includes(response.status) && !detail.startsWith('missing');
    results.push({
      id,
      status: passed ? 'passed' : 'failed',
      http_status: response.status,
      latency_ms: Math.round(performance.now() - started),
      detail,
    });
  } catch (error) {
    results.push({
      id,
      status: 'failed',
      http_status: null,
      latency_ms: Math.round(performance.now() - started),
      detail: safeError(error),
    });
  }
}

function summarizeOpsSnapshot(body: Record<string, unknown>) {
  const snapshot = body.snapshot;
  if (!isRecord(snapshot) || snapshot.schema_version !== 'ops.health.v1') {
    return 'missing ops health snapshot';
  }
  const workers = Array.isArray(snapshot.workers) ? snapshot.workers.length : 0;
  const queues = Array.isArray(snapshot.queues) ? snapshot.queues.length : 0;
  return `workers=${workers}; queues=${queues}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function markdown(report: SyntheticProbeReport) {
  const rows = report.results
    .map(
      (result) =>
        `| ${result.id} | ${result.status} | ${result.http_status ?? ''} | ${result.latency_ms ?? ''} | ${result.detail} |`,
    )
    .join('\n');
  return `# OPS-06 Synthetic Probes

Generated: ${report.generated_at}

Target: ${report.target_base_url ?? 'not configured'}

Status: ${report.status}

| Probe | Status | HTTP | Latency ms | Detail |
|---|---|---:|---:|---|
${rows}

External mutations: production_database=false, providers=false, sends=false, deployment=false.
`;
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : String(error))
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@[^\s]+/gi, 'postgres://[redacted]')
    .replace(/[A-Za-z0-9_-]{32,}/g, '[redacted]')
    .slice(0, 240);
}
