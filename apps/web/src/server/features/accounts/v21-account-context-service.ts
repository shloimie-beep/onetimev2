import type {
  AdultIdentity,
  AdultRole,
  AdultSession,
  AppliedOwnershipTransfer,
  Household,
  HouseholdOwnershipTransfer,
  HumanAccount,
  OwnershipTransferAcceptance,
  OwnershipTransferAcceptanceResult,
  SafeHouseholdContext,
  StudentProfile,
} from '../../../../../../packages/contracts/src/accounts/v21-household-identity.ts';
import {
  acceptHouseholdOwnershipTransfer,
  selectAdultRoleContext,
  selectHouseholdContext,
} from '../../../../../../packages/domain/src/accounts/v21-household-identity.ts';

export class AccountContextServiceError extends Error {
  readonly code:
    'same_origin_required' | 'csrf_invalid' | 'session_not_found' | 'transfer_not_found';

  constructor(code: AccountContextServiceError['code'], message: string) {
    super(message);
    this.name = 'AccountContextServiceError';
    this.code = code;
  }
}

export interface AccountContextTransaction {
  loadAccountAndSessionForUpdate(input: {
    humanAccountId: string;
    sessionId: string;
  }): Promise<{ account: HumanAccount; session: AdultSession } | null>;
  listOwnedHouseholds(humanAccountId: string): Promise<SafeHouseholdContext[]>;
  allocateSessionId(): Promise<string>;
  replaceContextSession(input: {
    priorSessionId: string;
    nextSession: AdultSession;
    reason: 'role_context_switch' | 'household_context_switch';
  }): Promise<void>;
}

export interface AccountContextPort {
  transaction<T>(run: (tx: AccountContextTransaction) => Promise<T>): Promise<T>;
}

export class AccountContextService {
  constructor(private readonly port: AccountContextPort) {}

  async switchRole(input: {
    humanAccountId: string;
    sessionId: string;
    requestedRole: AdultRole;
    sameOrigin: boolean;
    csrfValid: boolean;
    now?: Date;
  }) {
    assertProtectedContextAction(input);
    return this.port.transaction(async (tx) => {
      const current = await tx.loadAccountAndSessionForUpdate(input);
      if (!current) {
        throw new AccountContextServiceError(
          'session_not_found',
          'The active account session is unavailable.',
        );
      }
      const nextSession = selectAdultRoleContext({
        account: current.account,
        currentSession: current.session,
        requestedRole: input.requestedRole,
        rotatedSessionId: await tx.allocateSessionId(),
        now: input.now ?? new Date(),
      });
      await tx.replaceContextSession({
        priorSessionId: current.session.sessionId,
        nextSession,
        reason: 'role_context_switch',
      });
      return nextSession;
    });
  }

  async switchHousehold(input: {
    humanAccountId: string;
    sessionId: string;
    selectedHouseholdId: string;
    sameOrigin: boolean;
    csrfValid: boolean;
    now?: Date;
  }) {
    assertProtectedContextAction(input);
    return this.port.transaction(async (tx) => {
      const current = await tx.loadAccountAndSessionForUpdate(input);
      if (!current) {
        throw new AccountContextServiceError(
          'session_not_found',
          'The active account session is unavailable.',
        );
      }
      const ownedHouseholds = await tx.listOwnedHouseholds(current.account.humanAccountId);
      const nextSession = selectHouseholdContext({
        account: current.account,
        currentSession: current.session,
        serverResolvedOwnedHouseholdIds: ownedHouseholds.map((household) => household.householdId),
        selectedHouseholdId: input.selectedHouseholdId,
        rotatedSessionId: await tx.allocateSessionId(),
        now: input.now ?? new Date(),
      });
      await tx.replaceContextSession({
        priorSessionId: current.session.sessionId,
        nextSession,
        reason: 'household_context_switch',
      });
      return {
        session: nextSession,
        households: ownedHouseholds,
      };
    });
  }
}

export interface LockedOwnershipTransferBundle {
  adminAccount: HumanAccount;
  transfer: HouseholdOwnershipTransfer;
  household: Household;
  activeStudents: readonly StudentProfile[];
  replacementAdult: AdultIdentity | null;
  replacementAccount: HumanAccount | null;
  proposedReplacementAdultId: string;
  proposedReplacementHumanAccountId: string;
  replacementDisplayName: string;
  outgoingSessions: readonly AdultSession[];
  replacementSessions: readonly AdultSession[];
  billingSessionIds: readonly string[];
  setupOrResetTokenIds: readonly string[];
}

export interface OwnershipTransferTransaction {
  loadTransferBundleForUpdate(input: {
    transferId: string;
    initiatingAdminAccountId: string;
    replacementNormalizedEmail: string;
  }): Promise<LockedOwnershipTransferBundle | null>;
  persistAppliedTransfer(result: AppliedOwnershipTransfer): Promise<void>;
}

export interface OwnershipTransferPort {
  transaction<T>(run: (tx: OwnershipTransferTransaction) => Promise<T>): Promise<T>;
}

export class OwnershipTransferService {
  constructor(private readonly port: OwnershipTransferPort) {}

  async accept(input: {
    transferId: string;
    initiatingAdminAccountId: string;
    acceptance: OwnershipTransferAcceptance;
    sameOrigin: boolean;
    csrfValid: boolean;
    now?: Date;
  }): Promise<OwnershipTransferAcceptanceResult> {
    assertProtectedContextAction(input);
    return this.port.transaction(async (tx) => {
      const bundle = await tx.loadTransferBundleForUpdate({
        transferId: input.transferId,
        initiatingAdminAccountId: input.initiatingAdminAccountId,
        replacementNormalizedEmail: input.acceptance.replacementNormalizedEmail,
      });
      if (!bundle) {
        throw new AccountContextServiceError(
          'transfer_not_found',
          'The verified ownership transfer is unavailable.',
        );
      }
      const result = acceptHouseholdOwnershipTransfer({
        ...bundle,
        acceptance: input.acceptance,
        now: input.now ?? new Date(),
      });
      if (result.disposition === 'applied') {
        await tx.persistAppliedTransfer(result);
      }
      return result;
    });
  }
}

function assertProtectedContextAction(input: { sameOrigin: boolean; csrfValid: boolean }) {
  if (!input.sameOrigin) {
    throw new AccountContextServiceError(
      'same_origin_required',
      'Account-context actions require a same-origin request.',
    );
  }
  if (!input.csrfValid) {
    throw new AccountContextServiceError(
      'csrf_invalid',
      'Account-context actions require a valid server-bound CSRF token.',
    );
  }
}
