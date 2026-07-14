import { describe, expect, it } from 'vitest';
import {
  PollingLoopControl,
  runNonOverlappingPollingLoop,
} from '../../../apps/worker/src/delivery/loop.ts';

describe('delivery worker polling loop', () => {
  it('does not start another batch while one is still in flight', async () => {
    const control = new PollingLoopControl();
    let active = 0;
    let maxActive = 0;
    let calls = 0;
    const loop = runNonOverlappingPollingLoop({
      pollIntervalMs: 1,
      control,
      runOnce: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        if (calls === 2) control.stop();
      },
    });
    await loop;
    expect(calls).toBe(2);
    expect(maxActive).toBe(1);
  });

  it('wakes promptly when shutdown is requested during sleep', async () => {
    const control = new PollingLoopControl();
    let calls = 0;
    const loop = runNonOverlappingPollingLoop({
      pollIntervalMs: 60_000,
      control,
      runOnce: async () => {
        calls += 1;
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    control.stop();
    const iterations = await loop;
    expect(iterations).toBe(1);
    expect(calls).toBe(1);
  });
});
