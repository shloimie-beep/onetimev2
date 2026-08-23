import { describe, expect, it, vi } from 'vitest';
import { v21ParentHouseholdSubjects } from './app.ts';

const now = new Date('2026-08-16T09:00:00.000Z');

function context(overrides: Record<string, unknown> = {}) {
  return {
    adultId: 'adult-parent',
    session: {
      activeRole: 'parent',
      activeHouseholdId: 'household-parent',
    },
    household: {
      householdId: 'household-parent',
      classification: 'family',
      ownerRelationship: 'account_owner',
    },
    ...overrides,
  };
}

function input(resolution: unknown) {
  const resolveCookieHeader = vi.fn(async () => resolution);
  return {
    resolveCookieHeader,
    value: {
      v21AdultSessionRuntime: { resolveCookieHeader },
      clock: () => now,
    } as never,
  };
}

describe('v2.1 Parent portal actor household scope', () => {
  it('derives the exact active owner household without a legacy guardian or Student row', async () => {
    const runtime = input({ status: 'resolved', context: context() });

    await expect(
      v21ParentHouseholdSubjects('__Host-onetime-session=opaque', runtime.value),
    ).resolves.toEqual([
      {
        household_key: 'household-parent',
        relationship_key: 'v21_account_owner',
        relationship_label: 'Parent',
        authority: 'primary_guardian',
      },
    ]);
    expect(runtime.resolveCookieHeader).toHaveBeenCalledWith({
      cookie_header: '__Host-onetime-session=opaque',
      now,
    });
  });

  it.each([
    { status: 'invalid' },
    { status: 'unavailable' },
    { status: 'resolved', context: context({ household: null }) },
    {
      status: 'resolved',
      context: context({
        session: { activeRole: 'parent', activeHouseholdId: 'another-household' },
      }),
    },
    {
      status: 'resolved',
      context: context({
        household: {
          householdId: 'household-parent',
          classification: 'family',
          ownerRelationship: 'support_only',
        },
      }),
    },
  ])('fails closed for an invalid Parent household context', async (resolution) => {
    const runtime = input(resolution);
    await expect(v21ParentHouseholdSubjects('opaque', runtime.value)).resolves.toEqual([]);
  });
});
