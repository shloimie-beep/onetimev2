import { describe, expect, it } from 'vitest';
import { PASSWORD_POLICIES } from '../identity/auth/index.ts';
import { tokenCompletionPayloadSchema } from './index.ts';

describe('adult account password bounds', () => {
  it('keeps activation and reset completion aligned with the global adult policy', () => {
    expect(PASSWORD_POLICIES.adult.minimum_code_points).toBe(6);
    expect(PASSWORD_POLICIES.adult.maximum_code_points).toBe(128);
    expect(
      tokenCompletionPayloadSchema.safeParse({ token: 't'.repeat(32), password: 'Abcdef' }).success,
    ).toBe(true);
    expect(
      tokenCompletionPayloadSchema.safeParse({ token: 't'.repeat(32), password: 'Abcde' }).success,
    ).toBe(false);
    expect(
      tokenCompletionPayloadSchema.safeParse({ token: 't'.repeat(32), password: 'a'.repeat(129) })
        .success,
    ).toBe(false);
  });
});
