import { describe, expect, it, vi } from 'vitest';
import {
  candidateIdentity,
  runtimeIdentities,
} from '../../../../packages/observability/v21/test-fixtures.ts';
import { publishOperationsHeartbeat } from './heartbeat.ts';

describe('P33 worker operations heartbeat', () => {
  it('publishes only safe exact-candidate identity', async () => {
    const publish = vi.fn(async () => undefined);
    const heartbeat = await publishOperationsHeartbeat({
      candidate: candidateIdentity(),
      runtime: runtimeIdentities()[1]!,
      worker_type: 'delivery',
      state: 'ready',
      readiness_codes: ['queue.ready'],
      publisher: { publish },
      now: () => new Date('2026-07-29T01:00:00.000Z'),
    });
    expect(publish).toHaveBeenCalledWith(heartbeat);
    expect(heartbeat).toMatchObject({
      worker_type: 'delivery',
      candidate_id: 'candidate-2026-07-29',
      verification_environment_id: 'persistent_staging',
    });
    expect(JSON.stringify(heartbeat)).not.toMatch(/authorization|password|cookie/i);
  });

  it('does not publish a mismatched runtime', async () => {
    const publish = vi.fn(async () => undefined);
    await expect(
      publishOperationsHeartbeat({
        candidate: candidateIdentity(),
        runtime: { ...runtimeIdentities()[1]!, repository_sha: 'f'.repeat(40) },
        worker_type: 'delivery',
        state: 'ready',
        publisher: { publish },
      }),
    ).rejects.toMatchObject({ code: 'worker_candidate_mismatch' });
    expect(publish).not.toHaveBeenCalled();
  });
});
