import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../../packages/config/src/index.ts';

const production = {
  NODE_ENV: 'production',
  ONE_TIME_RUNTIME_ENVIRONMENT: 'production',
  ONE_TIME_FIRST_CLASS_AT: '2026-08-16T19:00:00+03:00',
  ONE_TIME_FREE_ACCESS_EXPIRES_AT: '2026-09-11T18:00:00+03:00',
  AUTH_CSRF_SECRET: 'zoom-production-canary-csrf-secret',
  PROTECTED_PAYLOAD_ENCRYPTION_KEY: 'zoom-production-canary-payload-key',
} as const;

describe('Zoom production operator canary configuration', () => {
  it('allows the exact production operator learner scope', () => {
    expect(
      loadConfig({
        ...production,
        ONE_TIME_VERIFICATION_ENVIRONMENT_ID: 'production_operator_canary',
        ZOOM_CLASSROOM_CANARY_ENABLED: 'true',
        ZOOM_CLASSROOM_CANARY_LEARNER_KEY: 'operator-owned-learner',
      }),
    ).toMatchObject({
      oneTimeVerificationEnvironmentId: 'production_operator_canary',
      zoomClassroomCanaryEnabled: true,
      zoomClassroomCanaryLearnerKey: 'operator-owned-learner',
    });
  });

  it('fails closed without the exact learner allowlist', () => {
    expect(() =>
      loadConfig({
        ...production,
        ONE_TIME_VERIFICATION_ENVIRONMENT_ID: 'production_operator_canary',
        ZOOM_CLASSROOM_CANARY_ENABLED: 'true',
      }),
    ).toThrow(/exact production operator learner/i);
  });

  it('does not permit the canary in production read-only or broad mode', () => {
    for (const environmentId of ['production_read_only', 'production_broad'] as const) {
      expect(() =>
        loadConfig({
          ...production,
          ONE_TIME_VERIFICATION_ENVIRONMENT_ID: environmentId,
          ZOOM_CLASSROOM_CANARY_ENABLED: 'true',
          ZOOM_CLASSROOM_CANARY_LEARNER_KEY: 'operator-owned-learner',
        }),
      ).toThrow(/exact production operator learner/i);
    }
  });
});
