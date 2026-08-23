import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../../packages/config/src/index.ts';

const INTENT_ID = 'a'.repeat(64);

describe('Family signup GHL provider authorization', () => {
  it('defaults disabled with no proof, allowlist, or provider budget', () => {
    const config = loadConfig({ NODE_ENV: 'test' });

    expect(config.familySignupGhlMode).toBe('disabled');
    expect(config.familySignupGhlOt01ProofId).toBeUndefined();
    expect(config.familySignupGhlCanaryRunId).toBeUndefined();
    expect(config.familySignupGhlCanaryIntentIds).toEqual([]);
    expect(config.familySignupGhlCanaryBudget).toBe(0);
    expect(config.familySignupGhlBatchSize).toBe(1);
  });

  it('admits only one exact production intent after an OT-01 proof reference', () => {
    const config = loadConfig({
      ...productionCanary(),
      FAMILY_SIGNUP_GHL_OT01_PROOF_ID: 'ot01-save-reopen-seed-proof-0001',
      FAMILY_SIGNUP_GHL_CANARY_RUN_ID: 'family-signup-canary-run-0001',
      FAMILY_SIGNUP_GHL_CANARY_INTENT_IDS: INTENT_ID,
      FAMILY_SIGNUP_GHL_CANARY_BUDGET: '1',
      FAMILY_SIGNUP_GHL_BATCH_SIZE: '1',
    });

    expect(config).toMatchObject({
      familySignupGhlMode: 'provider_canary',
      familySignupGhlOt01ProofId: 'ot01-save-reopen-seed-proof-0001',
      familySignupGhlCanaryRunId: 'family-signup-canary-run-0001',
      familySignupGhlCanaryIntentIds: [INTENT_ID],
      familySignupGhlCanaryBudget: 1,
      familySignupGhlBatchSize: 1,
    });
  });

  it.each([
    ['missing OT-01 proof', { FAMILY_SIGNUP_GHL_OT01_PROOF_ID: undefined }],
    ['two intents', { FAMILY_SIGNUP_GHL_CANARY_INTENT_IDS: `${INTENT_ID},${'b'.repeat(64)}` }],
    ['budget above one', { FAMILY_SIGNUP_GHL_CANARY_BUDGET: '2' }],
    ['batch above one', { FAMILY_SIGNUP_GHL_BATCH_SIZE: '2' }],
  ])('fails closed for %s', (_label, override) => {
    expect(() =>
      loadConfig({
        ...productionCanary(),
        FAMILY_SIGNUP_GHL_OT01_PROOF_ID: 'ot01-save-reopen-seed-proof-0001',
        FAMILY_SIGNUP_GHL_CANARY_RUN_ID: 'family-signup-canary-run-0001',
        FAMILY_SIGNUP_GHL_CANARY_INTENT_IDS: INTENT_ID,
        FAMILY_SIGNUP_GHL_CANARY_BUDGET: '1',
        FAMILY_SIGNUP_GHL_BATCH_SIZE: '1',
        ...override,
      }),
    ).toThrow(/Family-signup HighLevel provider canary requires/u);
  });
});

function productionCanary() {
  return {
    NODE_ENV: 'production',
    AUTH_CSRF_SECRET: 'production-family-ghl-csrf-secret-32-characters-minimum',
    PROTECTED_PAYLOAD_ENCRYPTION_KEY: 'production-family-ghl-payload-key-32-characters-minimum',
    ONE_TIME_VERIFICATION_ENVIRONMENT_ID: 'production_operator_canary',
    ONE_TIME_FREE_ACCESS_EXPIRES_AT: '2026-09-11T15:00:00.000Z',
    HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN: 'production-provider-token-placeholder',
    FAMILY_SIGNUP_GHL_MODE: 'provider_canary',
  };
}
