import { describe, expect, it } from 'vitest';
import {
  W12_100_ALERT_CHECKS,
  evaluateObservabilitySnapshot,
  type AlertCheckId,
  type ObservabilitySnapshot,
} from './observability-checks.ts';

const REQUIRED_CHECKS: AlertCheckId[] = [
  'web_readiness',
  'worker_heartbeat',
  'queue_depth',
  'queue_oldest_age',
  'delivery_retries',
  'delivery_dead_letters',
  'database_saturation',
  'rate_limit_spikes',
  'login_failures',
  'webhook_verification_failures',
  'class_launch_failures',
  'billing_webhook_failures',
  'backup_age',
];

function greenSnapshot(): ObservabilitySnapshot {
  return {
    web: {
      ready: true,
      health_status: 200,
      ready_status: 200,
      version_commit_sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    },
    workers: [{ worker_type: 'delivery_outbox', state: 'ready', heartbeat_age_ms: 15_000 }],
    queues: [
      {
        queue: 'delivery_outbox',
        ready_count: 0,
        oldest_ready_age_ms: 0,
        retry_count: 0,
        dead_letter_count: 0,
      },
    ],
    database: {
      connection_saturation_percent: 20,
      cpu_saturation_percent: 30,
      storage_saturation_percent: 40,
    },
    rate_limits: {
      spike_count_5m: 0,
      max_limited_ratio_5m: 0,
    },
    auth: {
      login_failures_5m: 0,
      login_failure_ratio_5m: 0,
    },
    webhooks: {
      whatsapp_verification_failures_5m: 0,
      telegram_verification_failures_5m: 0,
      generic_signature_failures_5m: 0,
    },
    classes: {
      launch_failures_15m: 0,
    },
    billing: {
      webhook_failures_5m: 0,
      webhook_signature_failures_5m: 0,
    },
    backups: {
      latest_backup_age_minutes: 30,
      pitr_enabled: true,
    },
  };
}

describe('W12-100 observability checks', () => {
  it('defines every required launch alert surface', () => {
    expect(W12_100_ALERT_CHECKS.map((check) => check.id).sort()).toEqual(
      [...REQUIRED_CHECKS].sort(),
    );
    expect(W12_100_ALERT_CHECKS.every((check) => check.fail_closed)).toBe(true);
  });

  it('passes a complete green launch snapshot without external notifications', () => {
    const evidence = evaluateObservabilitySnapshot(greenSnapshot());
    expect(evidence.status).toBe('passed');
    expect(evidence.external_notifications_sent).toBe(false);
    expect(evidence.production_mutations).toBe(0);
    expect(evidence.checks.every((check) => check.status === 'passed')).toBe(true);
  });

  it('blocks on stale worker, dead letters, webhook failures, and stale backups', () => {
    const evidence = evaluateObservabilitySnapshot({
      ...greenSnapshot(),
      workers: [{ worker_type: 'delivery_outbox', state: 'stale', heartbeat_age_ms: 300_000 }],
      queues: [
        {
          queue: 'delivery_outbox',
          ready_count: 99,
          oldest_ready_age_ms: 900_000,
          retry_count: 101,
          dead_letter_count: 1,
        },
      ],
      webhooks: {
        whatsapp_verification_failures_5m: 1,
        telegram_verification_failures_5m: 0,
        generic_signature_failures_5m: 0,
      },
      billing: {
        webhook_failures_5m: 1,
        webhook_signature_failures_5m: 1,
      },
      backups: {
        latest_backup_age_minutes: 2000,
        pitr_enabled: false,
      },
    });

    expect(evidence.status).toBe('blocked');
    expect(
      evidence.checks.filter((check) => check.status === 'firing').map((check) => check.check_id),
    ).toEqual(
      expect.arrayContaining([
        'worker_heartbeat',
        'queue_depth',
        'queue_oldest_age',
        'delivery_retries',
        'delivery_dead_letters',
        'webhook_verification_failures',
        'billing_webhook_failures',
        'backup_age',
      ]),
    );
  });
});
