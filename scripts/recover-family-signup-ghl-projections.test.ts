import { describe, expect, it } from 'vitest';
import {
  FAMILY_SIGNUP_GHL_PROJECTION_RECOVERY_AUTHORIZATION,
  parseFamilySignupGhlProjectionRecoveryArgs,
} from './recover-family-signup-ghl-projections.ts';

const COMMIT = 'a'.repeat(40);

describe('Family-signup projection recovery CLI fence', () => {
  it('defaults to local inspect-only mode with an exact bounded intent set', () => {
    expect(
      parseFamilySignupGhlProjectionRecoveryArgs([
        '--intent-ids',
        'intent-b-0001,intent-a-0001,intent-b-0001',
        '--expected-commit',
        COMMIT,
      ]),
    ).toEqual({
      intentIds: ['intent-a-0001', 'intent-b-0001'],
      expectedCommit: COMMIT,
      readback: false,
      apply: false,
      authorization: null,
    });
  });

  it('rejects provider readback without the exact authorization phrase', () => {
    expect(() =>
      parseFamilySignupGhlProjectionRecoveryArgs([
        '--intent-ids',
        'intent-a-0001',
        '--expected-commit',
        COMMIT,
        '--readback',
      ]),
    ).toThrow('family_signup_ghl_recovery_authorization_invalid');
  });

  it('requires readback before local apply and accepts the exact authorized combination', () => {
    expect(() =>
      parseFamilySignupGhlProjectionRecoveryArgs([
        '--intent-ids',
        'intent-a-0001',
        '--expected-commit',
        COMMIT,
        '--apply',
      ]),
    ).toThrow('family_signup_ghl_recovery_apply_requires_readback');

    expect(
      parseFamilySignupGhlProjectionRecoveryArgs([
        '--intent-ids',
        'intent-a-0001',
        '--expected-commit',
        COMMIT,
        '--readback',
        '--apply',
        '--authorization',
        FAMILY_SIGNUP_GHL_PROJECTION_RECOVERY_AUTHORIZATION,
      ]),
    ).toMatchObject({ readback: true, apply: true });
  });
});
