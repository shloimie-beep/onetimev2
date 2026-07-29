import type {
  AdminDirectoryActor,
  AdminDirectoryAuditEvent,
  AdminDirectoryCommandIdentity,
  AdminDirectoryReceipt,
  AdminDirectoryRepository,
  AdminDirectoryScope,
  AdminStudentRecord,
  StudentCredentialReset,
  AdminDirectoryUnitOfWork,
} from '../../../../../../../packages/contracts/src/admin/directory/index.ts';
import type {
  AdultIdentity,
  Household,
  HumanAccount,
  OwnershipTransferAcceptanceResult,
} from '../../../../../../../packages/contracts/src/accounts/v21-household-identity.ts';
import {
  AdminDirectoryError,
  assertRuntimeAdmin,
} from '../../../../../../../packages/domain/src/admin-directory/index.ts';
import {
  adminDirectorySha256,
  canonicalAdminDirectoryRequestHash,
  safeDirectoryIdentifier,
} from '../../../../../../../packages/domain/src/contact-operations/index.ts';

export type AdminDirectoryMutationBatch = {
  resultRef: string;
  resultVersion: number;
  adults?: readonly AdultIdentity[];
  accounts?: readonly HumanAccount[];
  households?: readonly Household[];
  students?: readonly AdminStudentRecord[];
  credentialReset?: StudentCredentialReset;
  ownershipTransfer?: OwnershipTransferAcceptanceResult;
};

export type AdminDirectoryCommand = {
  actor: AdminDirectoryActor;
  identity: AdminDirectoryCommandIdentity;
  operation: AdminDirectoryReceipt['operation'];
  canonicalPayload: unknown;
  /**
   * Reads current aggregates with the unit's lock methods and invokes the P10
   * domain operation. It runs only after replay denial and inside the commit
   * transaction, closing the read/validate/write race.
   */
  mutate: (unit: AdminDirectoryUnitOfWork) => Promise<AdminDirectoryMutationBatch>;
};

export type AdminDirectoryCommitResult = {
  disposition: 'committed' | 'replayed';
  receipt: AdminDirectoryReceipt;
};

/**
 * The route layer must construct a batch exclusively from the domain operations.
 * This service supplies the durable, idempotent transaction boundary used by
 * refreshes and newly authenticated sessions.
 */
export class AdminDirectoryService {
  constructor(private readonly repository: AdminDirectoryRepository) {}

  async commit(input: AdminDirectoryCommand): Promise<AdminDirectoryCommitResult> {
    assertRuntimeAdmin(input.actor, input.actor);
    assertIdentity(input.identity, input.canonicalPayload);

    return this.repository.inTransaction(async (unit) => {
      const existing = await unit.getReceipt(input.actor, input.identity.idempotencyKey);
      if (existing) {
        if (
          existing.requestHash !== input.identity.requestHash ||
          existing.operation !== input.operation
        ) {
          throw new AdminDirectoryError(
            'admin_directory_idempotency_conflict',
            'The idempotency key is already bound to another directory command.',
          );
        }
        return { disposition: 'replayed', receipt: existing };
      }

      const mutation = await input.mutate(unit);
      assertResult(mutation.resultRef, mutation.resultVersion);
      for (const record of [
        ...(mutation.adults ?? []),
        ...(mutation.accounts ?? []),
        ...(mutation.households ?? []),
        ...(mutation.students ?? []),
        ...(mutation.credentialReset ? [mutation.credentialReset] : []),
      ]) {
        assertSameScope(input.actor, record);
      }
      if (mutation.ownershipTransfer) {
        assertSameScope(input.actor, mutation.ownershipTransfer.transfer);
        if (mutation.ownershipTransfer.disposition === 'applied') {
          assertSameScope(input.actor, mutation.ownershipTransfer.household);
          assertSameScope(input.actor, mutation.ownershipTransfer.replacementAdult);
          assertSameScope(input.actor, mutation.ownershipTransfer.replacementAccount);
        }
      }

      for (const adult of mutation.adults ?? []) await unit.saveAdult(adult);
      for (const account of mutation.accounts ?? []) await unit.saveAccount(account);
      for (const household of mutation.households ?? []) await unit.saveHousehold(household);
      for (const student of mutation.students ?? []) await unit.saveStudent(student);
      if (mutation.credentialReset) await unit.saveCredentialReset(mutation.credentialReset);
      if (mutation.ownershipTransfer) await unit.saveOwnershipTransfer(mutation.ownershipTransfer);

      const receipt: AdminDirectoryReceipt = {
        product: input.actor.product,
        runtimeTier: input.actor.runtimeTier,
        verificationEnvironmentId: input.actor.verificationEnvironmentId,
        idempotencyKey: input.identity.idempotencyKey,
        requestHash: input.identity.requestHash,
        operation: input.operation,
        resultRef: mutation.resultRef,
        resultVersion: mutation.resultVersion,
        committedAt: validIso(input.identity.occurredAt),
      };
      const audit: AdminDirectoryAuditEvent = {
        product: input.actor.product,
        runtimeTier: input.actor.runtimeTier,
        verificationEnvironmentId: input.actor.verificationEnvironmentId,
        eventId: adminDirectorySha256(
          `${receipt.idempotencyKey}:${receipt.operation}:${receipt.requestHash}`,
        ),
        actorHumanAccountId: input.actor.principal.human_account_id,
        operation: input.operation,
        targetRef: mutation.resultRef,
        householdId:
          mutation.households?.[0]?.householdId ?? mutation.students?.[0]?.householdId ?? null,
        requestHash: input.identity.requestHash,
        occurredAt: receipt.committedAt,
        containsSensitiveData: false,
      };
      await unit.saveAuditEvent(audit);
      await unit.saveReceipt(receipt);
      return { disposition: 'committed', receipt };
    });
  }
}

function assertIdentity(identity: AdminDirectoryCommandIdentity, payload: unknown) {
  safeDirectoryIdentifier(identity.idempotencyKey, 'idempotency_key');
  if (!Number.isSafeInteger(identity.expectedVersion) || identity.expectedVersion < 1) {
    throw new AdminDirectoryError(
      'admin_directory_stale_version',
      'The command requires a positive expected version.',
    );
  }
  if (canonicalAdminDirectoryRequestHash(payload) !== identity.requestHash) {
    throw new AdminDirectoryError(
      'admin_directory_idempotency_conflict',
      'The command request hash does not match its canonical payload.',
    );
  }
}

function assertResult(resultRef: string, resultVersion: number) {
  safeDirectoryIdentifier(resultRef, 'result');
  if (!Number.isSafeInteger(resultVersion) || resultVersion < 1) {
    throw new AdminDirectoryError(
      'admin_directory_stale_version',
      'The committed result requires a positive version.',
    );
  }
}

function assertSameScope(expected: AdminDirectoryScope, actual: AdminDirectoryScope) {
  if (
    expected.product !== actual.product ||
    expected.runtimeTier !== actual.runtimeTier ||
    expected.verificationEnvironmentId !== actual.verificationEnvironmentId
  ) {
    throw new AdminDirectoryError(
      'admin_directory_cross_scope',
      'A persistence batch cannot cross product, runtime, or environment scope.',
    );
  }
}

function validIso(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AdminDirectoryError(
      'admin_directory_invalid_input',
      'The command timestamp is invalid.',
    );
  }
  return date.toISOString();
}
