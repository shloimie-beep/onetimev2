import type { NextFunction, Request, Response } from 'express';
import pino from 'pino';

export const OPS05_TELEMETRY_SCHEMA_VERSION = 1;

const FORBIDDEN_FIELD_KEY_PATTERNS = [
  /authorization/i,
  /cookie/i,
  /password/i,
  /secret/i,
  /token/i,
  /database.*url/i,
  /raw.*url/i,
  /raw.*email/i,
  /raw.*phone/i,
  /raw.*message/i,
  /message.*body/i,
  /chat.*id/i,
  /child/i,
  /learner.*name/i,
  /student.*name/i,
  /payment.*id/i,
];

const TELEMETRY_SAFE_STRING_PATTERNS = [
  /bearer\s+[a-z0-9._~-]+/gi,
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi,
  /https?:\/\/\S+/gi,
  /\+?\d[\d\s().-]{6,}\d/g,
  /\b(?:token|secret|api[_-]?key)\s*[:=]\s*\S+/gi,
];

const SAFE_TELEMETRY_KEYS = new Set([
  'account_key',
  'app_version',
  'attempt',
  'bna_support_mode',
  'channel',
  'checked_at',
  'claim_result',
  'config_mode',
  'delivery_ref',
  'duration_ms',
  'error_code',
  'event_name',
  'event_type',
  'feature_area',
  'funnel_step',
  'level',
  'metric_name',
  'method',
  'outcome',
  'product_key',
  'provider_family',
  'provider_mode',
  'queue',
  'release_id',
  'route_family',
  'service_key',
  'source_sha',
  'status',
  'status_class',
  'synthetic_check_id',
  'target_app',
  'trace_id',
  'transport_mode',
  'worker',
  'worker_queue',
]);

export const OPS05_ALLOWED_LABELS = [
  'service_key',
  'route_family',
  'status_class',
  'config_mode',
  'provider_mode',
  'worker_queue',
  'claim_result',
  'outcome',
  'provider_family',
  'funnel_step',
  'auth_step',
  'failure_class',
  'portal_surface',
  'readiness_state',
  'support_state',
  'pipeline_stage',
  'content_state',
  'synthetic_check_id',
  'bna_support_mode',
  'transport_mode',
] as const;

export type Ops05AllowedLabel = (typeof OPS05_ALLOWED_LABELS)[number];
export type Ops05MetricType = 'counter' | 'gauge' | 'histogram';

export type Ops05MetricContract = {
  name: string;
  type: Ops05MetricType;
  labels: Ops05AllowedLabel[];
  description: string;
  privacy: 'counts_only' | 'duration_only' | 'status_only';
};

export const OPS05_METRIC_CATALOG: Ops05MetricContract[] = [
  {
    name: 'onetime_http_requests_total',
    type: 'counter',
    labels: ['service_key', 'route_family', 'status_class', 'config_mode'],
    description: 'HTTP request count by bounded route family and status class.',
    privacy: 'counts_only',
  },
  {
    name: 'onetime_http_request_duration_ms',
    type: 'histogram',
    labels: ['service_key', 'route_family', 'config_mode'],
    description: 'HTTP duration buckets for public, auth, app, API, health, and internal routes.',
    privacy: 'duration_only',
  },
  {
    name: 'onetime_signup_funnel_total',
    type: 'counter',
    labels: ['funnel_step', 'outcome', 'config_mode'],
    description: 'Signup to CRM and outbox steps without contact values or payload bodies.',
    privacy: 'counts_only',
  },
  {
    name: 'onetime_outbox_queue_depth',
    type: 'gauge',
    labels: ['worker_queue', 'outcome', 'transport_mode'],
    description: 'Outbox age, backlog, retry, duplicate, sink, and dead-letter state.',
    privacy: 'counts_only',
  },
  {
    name: 'onetime_outbox_delivery_attempts_total',
    type: 'counter',
    labels: ['worker_queue', 'provider_family', 'outcome', 'provider_mode'],
    description: 'Delivery attempts by provider family and outcome, never destination.',
    privacy: 'counts_only',
  },
  {
    name: 'onetime_auth_failures_total',
    type: 'counter',
    labels: ['auth_step', 'failure_class', 'config_mode'],
    description: 'Login, MFA, session, CSRF, and cross-scope denial counts.',
    privacy: 'counts_only',
  },
  {
    name: 'onetime_portal_readiness_state',
    type: 'gauge',
    labels: ['portal_surface', 'readiness_state', 'config_mode'],
    description: 'Parent, student, class launch, reminder, and access readiness states.',
    privacy: 'status_only',
  },
  {
    name: 'onetime_provider_status',
    type: 'gauge',
    labels: ['provider_family', 'provider_mode', 'readiness_state'],
    description: 'Telegram, WhatsApp, email, Vimeo, Buffer, Stripe test, and Zoom status.',
    privacy: 'status_only',
  },
  {
    name: 'onetime_support_bridge_events_total',
    type: 'counter',
    labels: ['support_state', 'bna_support_mode', 'outcome'],
    description: 'Async BNA support producer receipts and cached delivery state.',
    privacy: 'counts_only',
  },
  {
    name: 'onetime_content_pipeline_items_total',
    type: 'counter',
    labels: ['pipeline_stage', 'content_state', 'provider_mode'],
    description: 'Content, Vimeo, knowledge, and social publishing pipeline item counts.',
    privacy: 'counts_only',
  },
  {
    name: 'onetime_backup_restore_status',
    type: 'gauge',
    labels: ['service_key', 'readiness_state', 'config_mode'],
    description: 'Backup, PITR, and restore-drill evidence status without DB identifiers.',
    privacy: 'status_only',
  },
  {
    name: 'onetime_source_sha_mismatch_total',
    type: 'counter',
    labels: ['service_key', 'config_mode'],
    description: 'Runtime source SHA mismatch count for release safety.',
    privacy: 'counts_only',
  },
];

export const logger = pino({
  name: 'onetime',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'authorization',
      'cookie',
      'database_url',
      'provider_token',
      'raw_email',
      'raw_phone',
      'raw_message_body',
      'password',
      'mfa_secret',
      'email',
      'phone',
      '*.email',
      '*.phone',
    ],
    remove: true,
  },
});

export type RequestWithTrace = Request & {
  traceId?: string;
  timings?: { name: string; durationMs: number }[];
  exposeServerTiming?: boolean;
};

export function traceMiddleware(req: RequestWithTrace, res: Response, next: NextFunction) {
  const started = performance.now();
  const incoming = req.header('x-request-id');
  req.traceId = incoming && incoming.length <= 128 ? incoming : crypto.randomUUID();
  req.timings = [];
  res.setHeader('x-request-id', req.traceId);
  const writeHead = res.writeHead.bind(res);
  res.writeHead = ((...args: Parameters<Response['writeHead']>) => {
    const total = performance.now() - started;
    if (req.exposeServerTiming) {
      const entries = [
        `app;dur=${total.toFixed(1)}`,
        ...(req.timings ?? []).map((entry) => `${entry.name};dur=${entry.durationMs.toFixed(1)}`),
      ];
      res.setHeader('Server-Timing', entries.join(', '));
    } else {
      res.removeHeader('Server-Timing');
    }
    return writeHead(...args);
  }) as Response['writeHead'];

  res.on('finish', () => {
    const total = performance.now() - started;
    logger.info({
      trace_id: req.traceId,
      method: req.method,
      route_family: routeFamilyForPath(req.path),
      status: res.statusCode,
      status_class: statusClass(res.statusCode),
      duration_ms: Math.round(total),
    });
  });

  next();
}

export function exposeServerTiming(req: RequestWithTrace) {
  req.exposeServerTiming = true;
}

export async function withTiming<T>(
  req: RequestWithTrace | undefined,
  name: string,
  run: () => Promise<T>,
) {
  const started = performance.now();
  try {
    return await run();
  } finally {
    req?.timings?.push({ name, durationMs: performance.now() - started });
  }
}

export function publicError(code: string, message: string, requestId?: string) {
  return {
    success: false,
    code,
    message,
    request_id: requestId,
  };
}

export type RuntimeReadbackInput = {
  serviceKey: string;
  appVersion: string;
  commitSha: string;
  nodeEnv: string;
  providerMode?: string;
  bnaSupportMode?: string;
  now?: Date;
};

export type RuntimeReadback = {
  ok: true;
  schema_version: typeof OPS05_TELEMETRY_SCHEMA_VERSION;
  service_key: string;
  target_app: 'one-time';
  app_version: string;
  source_sha: string;
  release_id: string;
  config_mode: string;
  provider_mode: string;
  bna_support_mode: string;
  checked_at: string;
};

export function buildRuntimeReadback(input: RuntimeReadbackInput): RuntimeReadback {
  const sourceSha = normalizeSourceSha(input.commitSha);
  return {
    ok: true,
    schema_version: OPS05_TELEMETRY_SCHEMA_VERSION,
    service_key: safeToken(input.serviceKey, 'unknown-service'),
    target_app: 'one-time',
    app_version: safeToken(input.appVersion, 'local'),
    source_sha: sourceSha,
    release_id: sourceSha === 'unknown' ? safeToken(input.appVersion, 'local') : sourceSha,
    config_mode: safeToken(input.nodeEnv, 'unknown'),
    provider_mode: safeToken(input.providerMode ?? 'not_configured', 'not_configured'),
    bna_support_mode: safeToken(input.bnaSupportMode ?? 'async_only', 'async_only'),
    checked_at: (input.now ?? new Date()).toISOString(),
  };
}

export function applyRuntimeReadbackHeaders(
  res: {
    setHeader(name: string, value: number | string | readonly string[]): unknown;
  },
  readback: RuntimeReadback,
) {
  res.setHeader('x-onetime-source-sha', readback.source_sha);
  res.setHeader('x-onetime-release-id', readback.release_id);
  res.setHeader('x-onetime-config-mode', readback.config_mode);
  res.setHeader('x-onetime-provider-mode', readback.provider_mode);
}

export function routeFamilyForPath(pathname: string): string {
  const pathOnly = pathname.split('?')[0] ?? pathname;
  if (pathOnly === '/' || pathOnly === '/signup' || pathOnly === '/one-time/signup') {
    return 'public_signup';
  }
  if (pathOnly === '/login' || pathOnly.startsWith('/api/v1/auth/')) return 'auth';
  if (pathOnly.startsWith('/app/crm') || pathOnly.startsWith('/api/v1/contacts')) return 'crm';
  if (pathOnly.startsWith('/app/parent') || pathOnly.startsWith('/api/v1/parent')) {
    return 'parent_portal';
  }
  if (pathOnly.startsWith('/app/student') || pathOnly.startsWith('/api/v1/student')) {
    return 'student_portal';
  }
  if (pathOnly.startsWith('/app/classes') || pathOnly.startsWith('/api/v1/classes')) {
    return 'classes';
  }
  if (pathOnly.startsWith('/app/content') || pathOnly.includes('/content')) return 'content';
  if (pathOnly.startsWith('/app/billing') || pathOnly.includes('/billing')) return 'billing';
  if (pathOnly.includes('/communications')) return 'communications';
  if (pathOnly.includes('/social-publishing')) return 'social_publishing';
  if (pathOnly.startsWith('/internal/')) return 'internal_intake';
  if (pathOnly === '/health' || pathOnly === '/healthz') return 'health';
  if (pathOnly === '/ready' || pathOnly === '/readyz') return 'readiness';
  if (pathOnly === '/version') return 'version';
  if (pathOnly.startsWith('/assets/')) return 'static_asset';
  return 'other';
}

export function statusClass(status: number): string {
  if (!Number.isFinite(status) || status < 100) return 'unknown';
  return `${Math.floor(status / 100)}xx`;
}

export function sanitizeTelemetryFields(
  input: Readonly<Record<string, unknown>>,
): Record<string, string | number | boolean> {
  const output: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!SAFE_TELEMETRY_KEYS.has(key)) continue;
    if (isForbiddenTelemetryKey(key) || value === undefined || value === null) continue;
    if (typeof value === 'string') output[key] = redactTelemetryString(value);
    else if (typeof value === 'number' && Number.isFinite(value)) output[key] = value;
    else if (typeof value === 'boolean') output[key] = value;
  }
  return output;
}

export function telemetrySafetyFindings(input: Readonly<Record<string, unknown>>): string[] {
  const findings: string[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (isForbiddenTelemetryKey(key)) findings.push(`forbidden_key:${key}`);
    if (
      typeof value === 'string' &&
      TELEMETRY_SAFE_STRING_PATTERNS.some((pattern) => {
        pattern.lastIndex = 0;
        return pattern.test(value);
      })
    ) {
      findings.push(`sensitive_value:${key}`);
    }
  }
  return findings;
}

function normalizeSourceSha(value: string): string {
  const trimmed = value.trim();
  return /^[a-f0-9]{7,40}$/i.test(trimmed) ? trimmed.toLowerCase() : 'unknown';
}

function safeToken(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/[^a-z0-9_.:-]/gi, '_').slice(0, 80);
}

function isForbiddenTelemetryKey(key: string) {
  return FORBIDDEN_FIELD_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function redactTelemetryString(value: string): string {
  let redacted = value;
  redacted = redacted.replace(/bearer\s+[a-z0-9._~-]+/gi, 'bearer [redacted]');
  redacted = redacted.replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '[email]');
  redacted = redacted.replace(/https?:\/\/\S+/gi, '[url]');
  redacted = redacted.replace(/\+?\d[\d\s().-]{6,}\d/g, '[phone]');
  redacted = redacted.replace(/\b(token|secret|api[_-]?key)\s*[:=]\s*\S+/gi, '$1=[redacted]');
  return redacted.slice(0, 160);
}
