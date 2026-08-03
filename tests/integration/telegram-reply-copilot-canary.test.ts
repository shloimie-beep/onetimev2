import { describe, expect, it } from 'vitest';
import { runOtLive003SyntheticCanary } from '../../ops/release/ot-live-003/synthetic-canary.ts';

describe('OT-LIVE-003 isolated canary', () => {
  it('passes all fourteen controls with zero external effects', async () => {
    const result = await runOtLive003SyntheticCanary();
    expect(result.status).toBe('passed');
    expect(Object.keys(result.checks)).toHaveLength(14);
    expect(Object.values(result.checks).every(Boolean)).toBe(true);
    expect(result.simulated).toEqual({ telegramCards: 2, ghlMessages: 1, voiceExamples: 1 });
    expect(result.actualExternalEffects).toEqual({
      telegramMessages: 0,
      ghlMessages: 0,
      bnaEvents: 0,
      providerMutations: 0,
      productionDeployments: 0,
    });
  });
});
