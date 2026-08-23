import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import {
  opsAlertEventSchema,
  opsHealthSnapshotSchema,
  opsMetricEventSchema,
} from '../../../packages/contracts/src/ops/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  collectOpsHealthSnapshot,
  deterministicAlertSink,
  evaluateOpsAlerts,
  upsertOpsWorkerHeartbeat,
} from '../../../packages/observability/src/index.ts';

let pool: DbPool;
let config: AppConfig;

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'ops06-test',
    COMMIT_SHA: 'fb5f5eebc539afc9e93833e9417ee67524d62c36',
    OUTBOX_TRANSPORT_MODE: 'sink',
    OPERATIONS_PROBE_TOKEN: 'ops06-local-probe-token-0001',
    OPERATIONS_WORKER_HEARTBEAT_TTL_MS: '60000',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
});

afterEach(async () => {
  await pool.end();
});

describe('OPS-06 observability contracts', () => {
  it('validates structured metric and alert envelopes', () => {
    expect(
      opsMetricEventSchema.parse({
        schema_version: 'ops.metric.v1',
        timestamp: '2026-07-17T00:00:00.000Z',
        name: 'support_bridge_delivery_count',
        value: 1,
        unit: 'count',
        account_key: 'one_time',
        product_key: 'one_time_mishnah_class',
        dimensions: { outcome: 'delivered', sink: true },
      }),
    ).toMatchObject({ schema_version: 'ops.metric.v1' });

    expect(
      opsAlertEventSchema.parse({
        schema_version: 'ops.alert.v1',
        alert_key: 'queue-lag:delivery_outbox',
        severity: 'warning',
        status: 'firing',
        summary: 'Delivery queue lag exceeded threshold.',
        routing_key: 'owner_ops',
        dedupe_key: 'deterministic-key',
        generated_at: '2026-07-17T00:00:00.000Z',
        evidence: { queue: 'delivery_outbox', ready_count: 3 },
      }),
    ).toMatchObject({ routing_key: 'owner_ops' });
  });

  it('summarizes safe queue health and stale worker heartbeat blockers', async () => {
    const oldNow = new Date('2026-07-17T00:00:00.000Z');
    const now = new Date('2026-07-17T00:03:00.000Z');
    await upsertOpsWorkerHeartbeat({
      pool,
      config,
      workerType: 'delivery_outbox',
      workerInstanceKey: 'delivery_outbox:test-worker',
      state: 'ready',
      now: oldNow,
      readiness: {
        mode: 'continuous',
        batch_size: 10,
        secret_token: 'must-not-appear',
      },
    });
    await seedDeliveryOutbox(now);

    const snapshot = await collectOpsHealthSnapshot({ pool, config, now });
    expect(opsHealthSnapshotSchema.parse(snapshot).schema_version).toBe('ops.health.v1');
    expect(snapshot.ok).toBe(false);
    expect(snapshot.queues.find((queue) => queue.queue === 'delivery_outbox')).toMatchObject({
      ready_count: 1,
      leased_count: 1,
      expired_lease_count: 1,
      retry_count: 1,
      dead_letter_count: 1,
      throughput_15m: 1,
    });
    expect(snapshot.workers[0]).toMatchObject({
      worker_type: 'delivery_outbox',
      state: 'stale',
    });
    expect(JSON.stringify(snapshot)).not.toContain('must-not-appear');

    const alerts = evaluateOpsAlerts(snapshot);
    expect(alerts.map((alert) => alert.alert_key)).toContain(
      'blocker:delivery_outbox_dead_letters',
    );
    expect(deterministicAlertSink(alerts)).toMatchObject({
      sink: 'deterministic-local',
      external_notifications_sent: false,
    });
  });

  it('does not block on a stale predecessor when an active replacement is ready', async () => {
    const oldNow = new Date('2026-07-17T00:00:00.000Z');
    const now = new Date('2026-07-17T00:03:00.000Z');
    await upsertOpsWorkerHeartbeat({
      pool,
      config,
      workerType: 'delivery_outbox',
      workerInstanceKey: 'delivery_outbox:replaced-worker',
      state: 'ready',
      now: oldNow,
      readiness: { mode: 'continuous' },
    });
    await upsertOpsWorkerHeartbeat({
      pool,
      config,
      workerType: 'delivery_outbox',
      workerInstanceKey: 'delivery_outbox:active-worker',
      state: 'ready',
      now,
      readiness: { mode: 'continuous' },
    });

    const snapshot = await collectOpsHealthSnapshot({ pool, config, now });

    expect(snapshot.workers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          worker_instance_key: 'delivery_outbox:replaced-worker',
          state: 'stale',
        }),
        expect.objectContaining({
          worker_instance_key: 'delivery_outbox:active-worker',
          state: 'ready',
        }),
      ]),
    );
    expect(snapshot.blockers).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'delivery_outbox_heartbeat_stale' }),
      ]),
    );
    expect(snapshot.ok).toBe(true);
  });
});

async function seedDeliveryOutbox(now: Date) {
  const rows = [
    ['ops06-ready', 'pending', 1, new Date(now.getTime() - 20 * 60_000), null],
    ['ops06-processing-expired', 'processing', 1, new Date(now.getTime() - 60_000), null],
    ['ops06-dead', 'dead_lettered', 5, now, null],
    ['ops06-delivered', 'sink_delivered', 1, now, now],
  ];
  for (const [deliveryKey, status, attempts, nextAttemptAt, deliveredAt] of rows) {
    await pool.query(
      `INSERT INTO onetime.outbox_events
         (delivery_key, account_key, product_key, event_type, channel, transport_mode,
          payload, status, attempts, next_attempt_at, created_at, delivered_at)
       VALUES ($1,$2,$3,'family_signup_email_ack.v1','email','sink',$4::jsonb,$5,$6,$7,$8,$9)`,
      [
        deliveryKey,
        config.accountKey,
        config.productKey,
        '{}',
        status,
        attempts,
        nextAttemptAt,
        new Date(now.getTime() - 25 * 60_000),
        deliveredAt,
      ],
    );
  }
}
