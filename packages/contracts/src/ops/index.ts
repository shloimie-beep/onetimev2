import { z } from 'zod';

export const opsMetricNameSchema = z.enum([
  'http_request_latency_ms',
  'http_request_error_count',
  'db_query_latency_ms',
  'db_pool_wait_ms',
  'signup_capture_count',
  'login_attempt_count',
  'activation_completion_count',
  'webhook_intake_count',
  'worker_heartbeat_age_ms',
  'worker_lag_ms',
  'delivery_attempt_count',
  'delivery_failure_count',
  'class_reminder_delivery_count',
  'content_processing_count',
  'support_bridge_delivery_count',
  'provider_state_count',
]);

export const opsMetricUnitSchema = z.enum(['count', 'milliseconds', 'bytes', 'ratio']);

export const opsMetricEventSchema = z.object({
  schema_version: z.literal('ops.metric.v1'),
  timestamp: z.string().datetime(),
  name: opsMetricNameSchema,
  value: z.number().finite(),
  unit: opsMetricUnitSchema,
  account_key: z.string().min(1).max(120).optional(),
  product_key: z.string().min(1).max(120).optional(),
  dimensions: z
    .record(z.string(), z.union([z.string().max(160), z.number().finite(), z.boolean()]))
    .default({}),
  trace_id: z.string().min(1).max(128).optional(),
});

export type OpsMetricEvent = z.infer<typeof opsMetricEventSchema>;
export type OpsMetricName = z.infer<typeof opsMetricNameSchema>;

export const opsWorkerStateSchema = z.enum(['starting', 'ready', 'draining', 'stopped', 'stale']);
export type OpsWorkerState = z.infer<typeof opsWorkerStateSchema>;

export const opsQueueHealthSchema = z.object({
  queue: z.enum(['delivery_outbox', 'support_outbox', 'account_lifecycle_outbox']),
  ready_count: z.number().int().nonnegative(),
  oldest_ready_age_ms: z.number().int().nonnegative().nullable(),
  leased_count: z.number().int().nonnegative(),
  oldest_lease_age_ms: z.number().int().nonnegative().nullable(),
  expired_lease_count: z.number().int().nonnegative(),
  retry_count: z.number().int().nonnegative(),
  dead_letter_count: z.number().int().nonnegative(),
  oldest_dead_letter_age_ms: z.number().int().nonnegative().nullable(),
  provider_disabled_count: z.number().int().nonnegative(),
  throughput_15m: z.number().int().nonnegative(),
  failure_classes: z.array(
    z.object({
      class: z.string().min(1).max(120),
      count: z.number().int().nonnegative(),
    }),
  ),
});

export type OpsQueueHealth = z.infer<typeof opsQueueHealthSchema>;

export const opsDependencyStateSchema = z.object({
  name: z.string().min(1).max(120),
  ok: z.boolean(),
  essential: z.boolean(),
  status: z.enum(['ok', 'degraded', 'disabled', 'missing', 'blocked']),
  latency_ms: z.number().int().nonnegative().nullable(),
  blocker_code: z.string().min(1).max(120).nullable(),
  detail: z.string().min(1).max(240).nullable(),
});

export const opsWorkerHeartbeatSchema = z.object({
  worker_type: z.string().min(1).max(80),
  worker_instance_key: z.string().min(1).max(160),
  state: opsWorkerStateSchema,
  started_at: z.string().datetime(),
  last_seen_at: z.string().datetime(),
  draining_at: z.string().datetime().nullable(),
  stopped_at: z.string().datetime().nullable(),
  heartbeat_age_ms: z.number().int().nonnegative(),
  version: z.string().min(1).max(120),
  commit_sha: z.string().min(1).max(80),
  readiness: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
});

export const opsHealthSnapshotSchema = z.object({
  schema_version: z.literal('ops.health.v1'),
  generated_at: z.string().datetime(),
  ok: z.boolean(),
  account_key: z.string().min(1).max(120),
  product_key: z.string().min(1).max(120),
  dependencies: z.array(opsDependencyStateSchema),
  optional_dependencies: z.array(opsDependencyStateSchema),
  queues: z.array(opsQueueHealthSchema),
  workers: z.array(opsWorkerHeartbeatSchema),
  blockers: z.array(
    z.object({
      code: z.string().min(1).max(120),
      dependency: z.string().min(1).max(120),
      message: z.string().min(1).max(240),
    }),
  ),
});

export type OpsHealthSnapshot = z.infer<typeof opsHealthSnapshotSchema>;

export const opsAlertSeveritySchema = z.enum(['info', 'warning', 'critical']);
export const opsAlertEventSchema = z.object({
  schema_version: z.literal('ops.alert.v1'),
  alert_key: z.string().min(1).max(160),
  severity: opsAlertSeveritySchema,
  status: z.enum(['firing', 'resolved']),
  summary: z.string().min(1).max(240),
  routing_key: z.enum(['owner_ops', 'engineering', 'staging_conductor']),
  dedupe_key: z.string().min(1).max(160),
  generated_at: z.string().datetime(),
  evidence: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

export type OpsAlertEvent = z.infer<typeof opsAlertEventSchema>;

export const operatorLaunchStatusStateSchema = z.enum([
  'unclaimed',
  'active',
  'waiting_external',
  'ready_for_convergence',
  'done',
  'blocked',
  'provider_off',
  'needs_operator_decision',
]);

const operatorLaunchStatusTrackSchema = z.object({
  track_id: z.string().min(1).max(120),
  label: z.string().min(1).max(160),
});

export const operatorLaunchStatusProjectionSchema = z.object({
  schema_version: z.literal('ot.operator-launch-status.v1'),
  goal_id: z.literal('OT-LAUNCH-01'),
  generated_from_board: z.literal('ops/goals/OT-LAUNCH-01/BOARD.yaml'),
  board_source_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  generated_at: z.string().datetime(),
  current_milestone: z.object({
    label: z.string().min(1).max(500),
    acceptance_complete: z.number().int().nonnegative(),
    acceptance_total: z.number().int().positive(),
    percentage: z.number().int().min(0).max(100),
  }),
  what_changed: z.string().min(1).max(3000),
  works_now: z.array(
    operatorLaunchStatusTrackSchema.extend({
      status: z.literal('done'),
      acceptance_ids: z.array(z.string().min(1).max(80)).min(1),
    }),
  ),
  remaining: z.array(
    operatorLaunchStatusTrackSchema.extend({
      status: operatorLaunchStatusStateSchema.exclude(['done']),
      next_action: z.string().min(1).max(1200),
    }),
  ),
  blockers: z.array(
    operatorLaunchStatusTrackSchema.extend({
      status: operatorLaunchStatusStateSchema,
      code: z.string().min(1).max(160),
      reason: z.string().min(1).max(1200),
    }),
  ),
  safe_links: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        label: z.string().min(1).max(120),
        href: z.string().regex(/^\/app(?:\/[a-z0-9-]+)*$/u),
      }),
    )
    .min(1),
  next_executable_task: operatorLaunchStatusTrackSchema.extend({
    action: z.string().min(1).max(1200),
  }),
});

export type OperatorLaunchStatusProjection = z.infer<typeof operatorLaunchStatusProjectionSchema>;

export const operatorLaunchStatusResponseSchema = z.object({
  success: z.literal(true),
  launch_status: operatorLaunchStatusProjectionSchema,
});

export type OperatorLaunchStatusResponse = z.infer<typeof operatorLaunchStatusResponseSchema>;
