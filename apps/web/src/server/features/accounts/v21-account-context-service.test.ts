import { describe, expect, it } from 'vitest';
import type {
  AdultSession,
  HumanAccount,
  SafeHouseholdContext,
} from '../../../../../../packages/contracts/src/accounts/v21-household-identity.ts';
import { AccountContextService, type AccountContextPort } from './v21-account-context-service.ts';

const account: HumanAccount = {
  humanAccountId: 'account_dual',
  product: 'one_time_mishnayos',
  runtimeTier: 'isolated_staging',
  verificationEnvironmentId: 'ci',
  adultId: 'adult_dual',
  memberships: ['admin', 'parent'],
  state: 'active',
  securityVersion: 3,
  version: 4,
  createdAt: '2026-07-28T17:00:00.000Z',
  updatedAt: '2026-07-28T17:00:00.000Z',
};

const currentSession: AdultSession = {
  sessionId: 'session_current',
  product: 'one_time_mishnayos',
  runtimeTier: 'isolated_staging',
  verificationEnvironmentId: 'ci',
  humanAccountId: 'account_dual',
  activeRole: 'parent',
  activeHouseholdId: 'household_one',
  securityVersion: 3,
  idleExpiresAt: '2026-07-29T17:00:00.000Z',
  absoluteExpiresAt: '2026-08-27T17:00:00.000Z',
  revokedAt: null,
  revocationReason: null,
  version: 2,
  createdAt: '2026-07-28T17:00:00.000Z',
  updatedAt: '2026-07-28T17:00:00.000Z',
};

const households: SafeHouseholdContext[] = [
  {
    householdId: 'household_one',
    displayName: 'One',
    classification: 'family',
    accessState: 'active',
    ownerRelationship: 'account_owner',
  },
  {
    householdId: 'household_two',
    displayName: 'Two',
    classification: 'family',
    accessState: 'grace',
    ownerRelationship: 'account_owner',
  },
];

function port() {
  const replacements: {
    priorSessionId: string;
    nextSession: AdultSession;
    reason: 'role_context_switch' | 'household_context_switch';
  }[] = [];
  const value: AccountContextPort = {
    transaction: async (run) =>
      run({
        loadAccountAndSessionForUpdate: async () => ({
          account,
          session: currentSession,
        }),
        listOwnedHouseholds: async () => households,
        allocateSessionId: async () => 'session_rotated',
        replaceContextSession: async (replacement) => {
          replacements.push(replacement);
        },
      }),
  };
  return { value, replacements };
}

describe('F04 account context server seam', () => {
  it('rotates an explicit role context through server-loaded memberships', async () => {
    const testPort = port();
    const result = await new AccountContextService(testPort.value).switchRole({
      humanAccountId: 'account_dual',
      sessionId: 'session_current',
      requestedRole: 'admin',
      sameOrigin: true,
      csrfValid: true,
      now: new Date('2026-07-28T18:30:00.000Z'),
    });
    expect(result.activeRole).toBe('admin');
    expect(result.activeHouseholdId).toBeNull();
    expect(testPort.replacements).toHaveLength(1);
  });

  it('switches only among server-loaded households', async () => {
    const testPort = port();
    const service = new AccountContextService(testPort.value);
    await expect(
      service.switchHousehold({
        humanAccountId: 'account_dual',
        sessionId: 'session_current',
        selectedHouseholdId: 'household_denial',
        sameOrigin: true,
        csrfValid: true,
        now: new Date('2026-07-28T18:30:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'cross_household_denied' });
    expect(testPort.replacements).toHaveLength(0);
  });

  it('rejects missing same-origin and CSRF proof before storage access', async () => {
    const testPort = port();
    const service = new AccountContextService(testPort.value);
    await expect(
      service.switchRole({
        humanAccountId: 'account_dual',
        sessionId: 'session_current',
        requestedRole: 'parent',
        sameOrigin: false,
        csrfValid: true,
      }),
    ).rejects.toMatchObject({ code: 'same_origin_required' });
    await expect(
      service.switchRole({
        humanAccountId: 'account_dual',
        sessionId: 'session_current',
        requestedRole: 'parent',
        sameOrigin: true,
        csrfValid: false,
      }),
    ).rejects.toMatchObject({ code: 'csrf_invalid' });
    expect(testPort.replacements).toHaveLength(0);
  });
});
