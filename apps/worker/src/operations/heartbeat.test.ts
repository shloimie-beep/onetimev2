import { describe, expect, it, vi } from 'vitest';
import { healthyInput } from '../../../../packages/observability/v21/test-fixtures.ts';
import { publishOperationsHeartbeat } from './heartbeat.ts';

describe('P33 derived worker operations heartbeat', () => {
  it('publishes ready only from an exact validated healthy snapshot', async () => {
    const publish = vi.fn(async () => undefined);
    const heartbeat = await publishOperationsHeartbeat({
      health_input: healthyInput(),
      runtime_id: 'worker-primary',
      worker_type: 'delivery',
      publisher: { publish },
      now: () => new Date('2026-07-29T01:00:10.000Z'),
    });
    expect(publish).toHaveBeenCalledWith(heartbeat);
    expect(heartbeat).toMatchObject({
      schema_version: '3.0.0',
      state: 'ready',
      readiness_codes: ['operations.ready'],
      worker_type: 'delivery',
      candidate_id: 'candidate-2026-07-29',
    });
  });

  it.each([
    [
      'missing queue',
      (input: ReturnType<typeof healthyInput>) => {
        input.queues = input.queues.slice(1);
      },
      'queue_observation_missing',
    ],
    [
      'stale provider',
      (input: ReturnType<typeof healthyInput>) => {
        input.providers[0]!.observed_at = '2026-07-29T00:00:00.000Z';
      },
      'provider_observation_stale',
    ],
    [
      'failed migration readback',
      (input: ReturnType<typeof healthyInput>) => {
        input.migrations.read_only_verification_passed = false;
      },
      'migration_readback_failed',
    ],
  ])('derives degraded for %s and cannot be caller-overridden', async (_name, mutate, code) => {
    const healthInput = structuredClone(healthyInput());
    mutate(healthInput);
    const publish = vi.fn(async () => undefined);
    const heartbeat = await publishOperationsHeartbeat({
      health_input: healthInput,
      runtime_id: 'worker-primary',
      worker_type: 'delivery',
      publisher: { publish },
      now: () => new Date('2026-07-29T01:00:10.000Z'),
    });
    expect(heartbeat.state).toBe('degraded');
    expect(heartbeat.readiness_codes).toContain(code);
  });

  it('does not publish a mismatched runtime identity', async () => {
    const healthInput = structuredClone(healthyInput());
    healthInput.runtimes = healthInput.runtimes.map((runtime) =>
      runtime.runtime_id === 'worker-primary'
        ? { ...runtime, artifact_digest: 'f'.repeat(64) }
        : runtime,
    );
    const publish = vi.fn(async () => undefined);
    await expect(
      publishOperationsHeartbeat({
        health_input: healthInput,
        runtime_id: 'worker-primary',
        worker_type: 'delivery',
        publisher: { publish },
        now: () => new Date('2026-07-29T01:00:10.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'runtime_candidate_mismatch' });
    expect(publish).not.toHaveBeenCalled();
  });

  it('rejects a caller-generated health snapshot that is stale at publication time', async () => {
    const publish = vi.fn(async () => undefined);
    await expect(
      publishOperationsHeartbeat({
        health_input: healthyInput(),
        runtime_id: 'worker-primary',
        worker_type: 'delivery',
        publisher: { publish },
        now: () => new Date('2026-07-29T01:02:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'heartbeat_health_snapshot_stale' });
    expect(publish).not.toHaveBeenCalled();
  });
});
