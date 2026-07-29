import type {
  AdminDirectoryActor,
  AdminDirectoryAuditEvent,
  AdminDirectoryCommandIdentity,
  AdminDirectoryReceipt,
  AdminDirectoryRepository,
  AdminDirectoryScope,
  AdminHouseholdRecord,
  AdminStudentRecord,
  CanonicalStudentEnrollment,
  LockedOwnershipTransferEffectInventory,
  OwnershipTransferEffectReadback,
  RevokeAllActiveAccessCommand,
  ServiceAccountAcceptanceEvidence,
  StudentCredentialReset,
  AdminDirectoryUnitOfWork,
} from '../../../../../../../packages/contracts/src/admin/directory/index.ts';
import type {
  AdultIdentity,
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
  households?: readonly AdminHouseholdRecord[];
  students?: readonly AdminStudentRecord[];
  enrollments?: readonly CanonicalStudentEnrollment[];
  serviceAccountAcceptances?: readonly ServiceAccountAcceptanceEvidence[];
  revokeAllAccess?: readonly RevokeAllActiveAccessCommand[];
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
      assertRequiredEffects(input.operation, mutation);
      await assertLockedInvariants(unit, input.actor, input.operation, mutation);
      const ownershipEffects = mutation.ownershipTransfer
        ? await revokeAndVerifyOwnershipTransferEffects(
            unit,
            input.actor,
            mutation.ownershipTransfer,
          )
        : null;

      for (const adult of mutation.adults ?? []) await unit.saveAdult(adult);
      for (const account of mutation.accounts ?? []) await unit.saveAccount(account);
      for (const household of mutation.households ?? []) await unit.saveHousehold(household);
      for (const student of mutation.students ?? []) await unit.saveStudent(student);
      for (const evidence of mutation.serviceAccountAcceptances ?? []) {
        assertSameScope(input.actor, evidence);
        await unit.saveServiceAccountAcceptance(evidence);
      }
      for (const enrollment of mutation.enrollments ?? []) {
        assertSameScope(input.actor, enrollment);
        await unit.saveStudentEnrollment(enrollment);
      }
      const revocations = [];
      for (const command of mutation.revokeAllAccess ?? []) {
        const readback = await unit.revokeAllActiveAccess(input.actor, command);
        assertCompleteRevocation(input.actor, command, readback);
        revocations.push(readback);
      }
      if (mutation.credentialReset) {
        const revocation =
          mutation.credentialReset.kind === 'reset'
            ? revocations.find(
                (value) =>
                  value.subjectType === 'student' &&
                  value.subjectId === mutation.credentialReset?.studentId,
              )
            : null;
        const reset = {
          ...mutation.credentialReset,
          revocationReadbackId: revocation?.readbackId ?? null,
        };
        if (reset.kind === 'reset' && !reset.revocationReadbackId) {
          throw new AdminDirectoryError(
            'admin_directory_invalid_state',
            'Credential reset requires revoke-all readback.',
          );
        }
        await unit.saveCredentialReset(reset, revocation ?? null);
      }
      if (mutation.ownershipTransfer) {
        await unit.saveOwnershipTransfer(mutation.ownershipTransfer, ownershipEffects);
      }

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

async function assertLockedInvariants(
  unit: AdminDirectoryUnitOfWork,
  scope: AdminDirectoryScope,
  operation: AdminDirectoryReceipt['operation'],
  mutation: AdminDirectoryMutationBatch,
) {
  const revocations = mutation.revokeAllAccess ?? [];
  for (const student of mutation.students ?? []) {
    const collision = await unit.lockStudentByNormalizedUsername(scope, student.username);
    if (collision && collision.studentId !== student.studentId) {
      throw new AdminDirectoryError(
        'admin_directory_invalid_input',
        'Normalized Student username is already assigned.',
      );
    }
    if (
      (operation === 'student_upsert' || operation === 'student_transition') &&
      student.state === 'active'
    ) {
      const household = await unit.lockHousehold(scope, student.householdId);
      const currentStudent = await unit.lockStudent(scope, student.studentId);
      if (
        !household ||
        household.state !== 'active' ||
        household.accessState === 'inactive' ||
        ((!currentStudent || currentStudent.state === 'archived') &&
          household.activeSeatCount >= household.seatLimit)
      ) {
        throw new AdminDirectoryError(
          'admin_directory_seat_limit',
          'Locked household cannot activate another Student.',
        );
      }
      const evidence = mutation.serviceAccountAcceptances?.find(
        (value) => value.studentId === student.studentId,
      );
      if (
        !evidence ||
        evidence.householdId !== household?.householdId ||
        evidence.studentId !== student.studentId ||
        evidence.acceptedByAdultId !== household?.ownerAdultId ||
        evidence.acceptedServiceAccountVersion !==
          (await unit.lockCurrentServiceAccountVersion(scope))
      ) {
        throw new AdminDirectoryError(
          'admin_directory_invalid_state',
          'Locked current service-account acceptance is required.',
        );
      }
      const owner = await unit.lockAdult(scope, household.ownerAdultId);
      const ownerAccount = await unit.lockAccount(scope, household.ownerHumanAccountId);
      if (
        !owner ||
        !ownerAccount ||
        owner.adultId !== household.ownerAdultId ||
        owner.state !== 'active' ||
        ownerAccount.humanAccountId !== household.ownerHumanAccountId ||
        ownerAccount.adultId !== owner.adultId ||
        ownerAccount.state !== 'active' ||
        !ownerAccount.memberships.includes('parent')
      ) {
        throw new AdminDirectoryError(
          'admin_directory_invalid_state',
          'Service-account acceptance requires the current verified Parent household owner.',
        );
      }
      if (operation === 'student_transition') {
        const enrollment = mutation.enrollments?.find(
          (value) => value.studentId === student.studentId && value.state === 'active',
        );
        const lockedEnrollment = await unit.lockCurrentStudentEnrollment(scope, student.studentId);
        if (
          currentStudent?.state !== 'archived' ||
          !enrollment ||
          !lockedEnrollment ||
          lockedEnrollment.state !== 'revoked' ||
          lockedEnrollment.studentId !== student.studentId ||
          lockedEnrollment.householdId !== student.householdId ||
          enrollment.enrollmentId !== lockedEnrollment.enrollmentId ||
          enrollment.householdId !== lockedEnrollment.householdId ||
          enrollment.serviceAccountAcceptanceId !== evidence.acceptanceId ||
          enrollment.version !== lockedEnrollment.version + 1
        ) {
          throw new AdminDirectoryError(
            'admin_directory_invalid_state',
            'Student restore requires the exact locked revoked enrollment and next version.',
          );
        }
      }
    }
  }
  for (const household of mutation.households ?? []) {
    if (household.state !== 'archived') continue;
    const activeStudents = await unit.lockActiveStudentsByHousehold(scope, household.householdId);
    if (
      !activeStudents.every((student) =>
        revocations.some(
          (value) => value.subjectType === 'student' && value.subjectId === student.studentId,
        ),
      )
    ) {
      throw new AdminDirectoryError(
        'admin_directory_invalid_state',
        'Household archive must revoke every locked active Student.',
      );
    }
  }
  if (operation === 'adult_transition') {
    for (const adult of mutation.adults ?? []) {
      const account = mutation.accounts?.find((value) => value.adultId === adult.adultId);
      if (!account) continue;
      const lockedAccount = await unit.lockAccount(scope, account.humanAccountId);
      if (account.state === 'active' && lockedAccount?.state === 'disabled') {
        throw new AdminDirectoryError(
          'admin_directory_invalid_state',
          'Disabled HumanAccount cannot be reactivated.',
        );
      }
      if (adult.state === 'archived') {
        if (
          account.memberships.includes('admin') &&
          (await unit.lockActiveAdminCount(scope)) <= 1
        ) {
          throw new AdminDirectoryError(
            'admin_directory_invalid_state',
            'Final active Admin cannot be archived.',
          );
        }
        if ((await unit.lockOwnedHouseholdIds(scope, adult.adultId)).length > 0) {
          throw new AdminDirectoryError(
            'admin_directory_invalid_state',
            'Household owner cannot be archived.',
          );
        }
      }
    }
  }
}

async function revokeAndVerifyOwnershipTransferEffects(
  unit: AdminDirectoryUnitOfWork,
  scope: AdminDirectoryScope,
  result: OwnershipTransferAcceptanceResult,
): Promise<OwnershipTransferEffectReadback | null> {
  if (result.disposition !== 'applied') return null;
  const lockedTransfer = await unit.lockOwnershipTransfer(scope, result.transfer.transferId);
  const lockedHousehold = await unit.lockHousehold(scope, result.household.householdId);
  if (
    !lockedTransfer ||
    !lockedHousehold ||
    lockedTransfer.state !== 'pending' ||
    lockedTransfer.version + 1 !== result.transfer.version ||
    lockedTransfer.householdId !== result.household.householdId ||
    lockedTransfer.outgoingAdultId !== result.transfer.outgoingAdultId ||
    lockedTransfer.outgoingHumanAccountId !== result.transfer.outgoingHumanAccountId ||
    lockedHousehold.ownerAdultId !== lockedTransfer.outgoingAdultId ||
    lockedHousehold.ownerHumanAccountId !== lockedTransfer.outgoingHumanAccountId ||
    lockedHousehold.version + 1 !== result.household.version
  ) {
    throw new AdminDirectoryError(
      'admin_directory_invalid_state',
      'Ownership transfer does not match the exact locked pending transfer.',
    );
  }
  assertSameScope(scope, lockedTransfer);
  assertSameScope(scope, lockedHousehold);
  const binding = {
    transferId: result.transfer.transferId,
    householdId: result.household.householdId,
    outgoingHumanAccountId: result.transfer.outgoingHumanAccountId,
    replacementHumanAccountId: result.replacementAccount.humanAccountId,
  };
  const inventory = await unit.lockOwnershipTransferEffectInventory(scope, binding);
  assertOwnershipTransferInventory(scope, inventory, binding);
  const expectedOutgoingSessions = inventory.outgoingSessions.map((session) => session.sessionId);
  const expectedReplacementSessions = inventory.replacementSessions.map(
    (session) => session.sessionId,
  );
  if (
    !sameIds(result.outgoingSessionIdsRevoked, expectedOutgoingSessions) ||
    !sameIds(result.replacementSessionIdsRevoked, expectedReplacementSessions) ||
    !sameIds(result.billingSessionIdsRevoked, inventory.billingSessionIds) ||
    !sameIds(result.setupOrResetTokenIdsInvalidated, inventory.setupOrResetTokenIds)
  ) {
    throw new AdminDirectoryError(
      'admin_directory_invalid_state',
      'Ownership transfer rejected a caller-supplied subset of the locked effect inventory.',
    );
  }
  const readback = await unit.revokeOwnershipTransferEffects(scope, inventory);
  assertSameScope(scope, readback);
  if (
    readback.complete !== true ||
    readback.inventoryId !== inventory.inventoryId ||
    readback.transferId !== binding.transferId ||
    readback.householdId !== binding.householdId ||
    readback.outgoingHumanAccountId !== binding.outgoingHumanAccountId ||
    readback.replacementHumanAccountId !== binding.replacementHumanAccountId ||
    !sameIds(readback.outgoingSessionIdsRevoked, expectedOutgoingSessions) ||
    !sameIds(readback.replacementSessionIdsRevoked, expectedReplacementSessions) ||
    !sameIds(readback.billingSessionIdsRevoked, inventory.billingSessionIds) ||
    !sameIds(readback.grantIdsRevoked, inventory.grantIds) ||
    !sameIds(readback.setupOrResetTokenIdsInvalidated, inventory.setupOrResetTokenIds) ||
    !sameIds(readback.effectAuthorityIdsRevoked, inventory.effectAuthorityIds)
  ) {
    throw new AdminDirectoryError(
      'admin_directory_invalid_state',
      'Ownership transfer effects require complete exact atomic revocation readback.',
    );
  }
  safeDirectoryIdentifier(readback.readbackId, 'ownership_effect_readback');
  validIso(readback.revokedAt);
  return readback;
}

function assertOwnershipTransferInventory(
  scope: AdminDirectoryScope,
  inventory: LockedOwnershipTransferEffectInventory,
  binding: {
    transferId: string;
    householdId: string;
    outgoingHumanAccountId: string;
    replacementHumanAccountId: string;
  },
) {
  assertSameScope(scope, inventory);
  for (const session of [...inventory.outgoingSessions, ...inventory.replacementSessions]) {
    assertSameScope(scope, session);
  }
  if (
    inventory.complete !== true ||
    inventory.transferId !== binding.transferId ||
    inventory.householdId !== binding.householdId ||
    inventory.outgoingHumanAccountId !== binding.outgoingHumanAccountId ||
    inventory.replacementHumanAccountId !== binding.replacementHumanAccountId ||
    inventory.outgoingSessions.some(
      (session) =>
        session.humanAccountId !== binding.outgoingHumanAccountId ||
        session.activeRole !== 'parent' ||
        session.revokedAt !== null,
    ) ||
    inventory.replacementSessions.some(
      (session) =>
        session.humanAccountId !== binding.replacementHumanAccountId || session.revokedAt !== null,
    )
  ) {
    throw new AdminDirectoryError(
      'admin_directory_invalid_state',
      'Ownership transfer requires one scope-bound exhaustive locked inventory.',
    );
  }
  safeDirectoryIdentifier(inventory.inventoryId, 'ownership_effect_inventory');
  for (const values of [
    inventory.outgoingSessions.map((session) => session.sessionId),
    inventory.replacementSessions.map((session) => session.sessionId),
    inventory.billingSessionIds,
    inventory.grantIds,
    inventory.setupOrResetTokenIds,
    inventory.effectAuthorityIds,
  ]) {
    if (new Set(values).size !== values.length) {
      throw new AdminDirectoryError(
        'admin_directory_invalid_state',
        'Ownership transfer locked inventory contains duplicate identifiers.',
      );
    }
    for (const value of values) safeDirectoryIdentifier(value, 'ownership_effect');
  }
}

function sameIds(actual: readonly string[], expected: readonly string[]) {
  return (
    actual.length === expected.length &&
    [...actual].sort().every((value, index) => value === [...expected].sort()[index])
  );
}

function assertRequiredEffects(
  operation: AdminDirectoryReceipt['operation'],
  mutation: AdminDirectoryMutationBatch,
) {
  const revocations = mutation.revokeAllAccess ?? [];
  const hasRevocation = (subjectType: 'adult' | 'student' | 'household', subjectId: string) =>
    revocations.some((value) => value.subjectType === subjectType && value.subjectId === subjectId);
  if (operation === 'student_credential_reset') {
    if (
      !mutation.credentialReset ||
      mutation.credentialReset.kind !== 'reset' ||
      !hasRevocation('student', mutation.credentialReset.studentId)
    ) {
      throw new AdminDirectoryError(
        'admin_directory_invalid_state',
        'Credential reset requires a Student credential write and revoke-all operation.',
      );
    }
  }
  for (const student of mutation.students ?? []) {
    if (student.state === 'archived' && !hasRevocation('student', student.studentId)) {
      throw new AdminDirectoryError(
        'admin_directory_invalid_state',
        'Archived Student requires revoke-all access.',
      );
    }
    if (
      (operation === 'student_upsert' || operation === 'student_transition') &&
      student.state === 'active' &&
      student.credentialState === 'active'
    ) {
      const enrollment = mutation.enrollments?.find(
        (value) => value.studentId === student.studentId && value.state === 'active',
      );
      const evidence = mutation.serviceAccountAcceptances?.find(
        (value) =>
          value.studentId === student.studentId &&
          value.acceptanceId === enrollment?.serviceAccountAcceptanceId,
      );
      if (!enrollment || !evidence || !mutation.credentialReset) {
        throw new AdminDirectoryError(
          'admin_directory_invalid_state',
          'Active Student write requires credential, enrollment, and acceptance evidence.',
        );
      }
    }
  }
  for (const household of mutation.households ?? []) {
    if (
      household.state === 'archived' &&
      (household.accessState !== 'inactive' || !hasRevocation('household', household.householdId))
    ) {
      throw new AdminDirectoryError(
        'admin_directory_invalid_state',
        'Archived household requires inactive access and revoke-all access.',
      );
    }
  }
  if (
    operation === 'adult_transition' &&
    mutation.accounts?.some((account) => !hasRevocation('adult', account.humanAccountId))
  ) {
    throw new AdminDirectoryError(
      'admin_directory_invalid_state',
      'Adult lifecycle changes require revoke-all access.',
    );
  }
  if (
    operation === 'adult_upsert' &&
    mutation.accounts?.some(
      (account) => account.securityVersion > 1 && !hasRevocation('adult', account.humanAccountId),
    )
  ) {
    throw new AdminDirectoryError(
      'admin_directory_invalid_state',
      'Adult security changes require revoke-all access.',
    );
  }
}

function assertCompleteRevocation(
  scope: AdminDirectoryScope,
  command: RevokeAllActiveAccessCommand,
  readback: Awaited<ReturnType<AdminDirectoryUnitOfWork['revokeAllActiveAccess']>>,
) {
  assertSameScope(scope, readback);
  if (
    readback.complete !== true ||
    readback.subjectType !== command.subjectType ||
    readback.subjectId !== command.subjectId
  ) {
    throw new AdminDirectoryError(
      'admin_directory_invalid_state',
      'Revoke-all operation did not return complete exact readback.',
    );
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
