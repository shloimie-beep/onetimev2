import { describe, expect, it } from 'vitest';
import {
  ADULT_ROLE_VALUES,
  ADULT_SESSION_POLICY,
  HOUSEHOLD_IDENTITY_CONTRACT_VERSION,
  STUDENT_RELATIONSHIP_VALUES,
} from './v21-household-identity.ts';

describe('v2.1 household identity contract', () => {
  it('exposes only the exact adult role and Student relationship vocabularies', () => {
    expect(HOUSEHOLD_IDENTITY_CONTRACT_VERSION).toBe('1.0.0');
    expect(ADULT_ROLE_VALUES).toEqual(['admin', 'parent']);
    expect(STUDENT_RELATIONSHIP_VALUES).toEqual(['self', 'dependent']);
  });

  it('binds the exact adult session policies', () => {
    expect(ADULT_SESSION_POLICY.admin).toEqual({
      idleMilliseconds: 30 * 60 * 1000,
      absoluteMilliseconds: 12 * 60 * 60 * 1000,
    });
    expect(ADULT_SESSION_POLICY.parent).toEqual({
      idleMilliseconds: 24 * 60 * 60 * 1000,
      absoluteMilliseconds: 30 * 24 * 60 * 60 * 1000,
    });
  });
});
