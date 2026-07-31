import {
  PARENT_HOUSEHOLD_ERROR_CODES,
  type CreateParentStudentCommand,
  type ParentHouseholdMutation,
  type ParentHouseholdMutationContext,
  type ParentHouseholdMutationOperation,
  type ParentHouseholdPrincipal,
  type ParentHouseholdRecord,
  type ParentHouseholdRepository,
  type ParentStudentIdPort,
  type ParentStudentLifecycleCommand,
  type ParentStudentPasswordPort,
  type ResetParentStudentCredentialCommand,
  type UpdateParentStudentCommand,
} from '../../../../../../../packages/contracts/src/portals/parent-household/index.ts';
import {
  ParentHouseholdError,
  archiveParentStudent,
  buildParentHouseholdSnapshot,
  createParentStudent,
  resetParentStudentCredential,
  restoreParentStudent,
  updateParentStudent,
} from '../../../../../../../packages/domain/src/portals/parent-household/index.ts';

const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

export function createParentHouseholdService(dependencies: {
  repository: ParentHouseholdRepository;
  passwords: ParentStudentPasswordPort;
  ids: ParentStudentIdPort;
}) {
  async function load(principal: ParentHouseholdPrincipal) {
    const household = await dependencies.repository.loadOwnedHousehold(principal);
    if (!household) {
      throw new ParentHouseholdError(
        PARENT_HOUSEHOLD_ERROR_CODES.householdMissing,
        'This Parent household is unavailable.',
      );
    }
    return household;
  }

  async function exactReplay(
    principal: ParentHouseholdPrincipal,
    operation: ParentHouseholdMutationOperation,
    context: ParentHouseholdMutationContext,
  ) {
    assertMutationContext(context);
    const receipt = await dependencies.repository.findMutation({ principal, operation, context });
    if (!receipt) return null;
    return replayResult(principal, await load(principal), receipt.student_id, operation);
  }

  async function loadMutable(principal: ParentHouseholdPrincipal) {
    const household = await load(principal);
    buildParentHouseholdSnapshot({ principal, household });
    if (household.access_state === 'inactive') {
      throw new ParentHouseholdError(
        PARENT_HOUSEHOLD_ERROR_CODES.accessInactive,
        'Student management is unavailable while household access is inactive.',
      );
    }
    return household;
  }

  async function commit(
    principal: ParentHouseholdPrincipal,
    context: ParentHouseholdMutationContext,
    expectedRevision: number,
    mutation: ReturnType<typeof createParentStudent>,
    passwordHash: string | null,
  ) {
    assertMutationContext(context);
    const receipt = await dependencies.repository.commitMutation({
      principal,
      context,
      expected_revision: expectedRevision,
      next: mutation.next,
      audit: mutation.result.audit,
      password_hash: passwordHash,
      revoke_student_sessions: mutation.result.revoke_student_sessions,
      canonical_enrollment: mutation.result.canonical_enrollment,
    });
    if (receipt.disposition === 'replayed') {
      return replayResult(principal, await load(principal), receipt.student_id, receipt.operation);
    }
    return mutation.result;
  }

  return {
    async overview(principal: ParentHouseholdPrincipal) {
      const snapshot = buildParentHouseholdSnapshot({
        principal,
        household: await load(principal),
      });
      return snapshot.access_state === 'inactive' ? { ...snapshot, students: [] } : snapshot;
    },

    async createStudent(
      principal: ParentHouseholdPrincipal,
      command: CreateParentStudentCommand,
      context: ParentHouseholdMutationContext,
    ) {
      const replay = await exactReplay(principal, 'student_created', context);
      if (replay) return replay;
      const household = await loadMutable(principal);
      if (
        !(await dependencies.repository.isUsernameAvailable({
          principal,
          username: command.username,
        }))
      ) {
        throw new ParentHouseholdError(
          PARENT_HOUSEHOLD_ERROR_CODES.usernameUnavailable,
          'Choose another Student username.',
        );
      }
      const mutation = createParentStudent({
        principal,
        household,
        student_id: dependencies.ids.nextStudentId(),
        ...command,
      });
      const passwordHash = await dependencies.passwords.hash(command.new_password);
      return commit(principal, context, command.expected_revision, mutation, passwordHash);
    },

    async updateStudent(
      principal: ParentHouseholdPrincipal,
      command: UpdateParentStudentCommand,
      context: ParentHouseholdMutationContext,
    ) {
      const replay = await exactReplay(principal, 'student_profile_updated', context);
      if (replay) return replay;
      const household = await loadMutable(principal);
      if (
        !(await dependencies.repository.isUsernameAvailable({
          principal,
          username: command.username,
          except_student_id: command.student_id,
        }))
      ) {
        throw new ParentHouseholdError(
          PARENT_HOUSEHOLD_ERROR_CODES.usernameUnavailable,
          'Choose another Student username.',
        );
      }
      return commit(
        principal,
        context,
        command.expected_revision,
        updateParentStudent({ principal, household, ...command }),
        null,
      );
    },

    async archiveStudent(
      principal: ParentHouseholdPrincipal,
      command: ParentStudentLifecycleCommand,
      context: ParentHouseholdMutationContext,
    ) {
      const replay = await exactReplay(principal, 'student_archived', context);
      if (replay) return replay;
      return commit(
        principal,
        context,
        command.expected_revision,
        archiveParentStudent({ principal, household: await loadMutable(principal), ...command }),
        null,
      );
    },

    async restoreStudent(
      principal: ParentHouseholdPrincipal,
      command: ParentStudentLifecycleCommand,
      context: ParentHouseholdMutationContext,
    ) {
      const replay = await exactReplay(principal, 'student_restored', context);
      if (replay) return replay;
      return commit(
        principal,
        context,
        command.expected_revision,
        restoreParentStudent({ principal, household: await loadMutable(principal), ...command }),
        null,
      );
    },

    async resetStudentCredential(
      principal: ParentHouseholdPrincipal,
      command: ResetParentStudentCredentialCommand,
      context: ParentHouseholdMutationContext,
    ) {
      const replay = await exactReplay(principal, 'student_credential_reset', context);
      if (replay) return replay;
      const household = await loadMutable(principal);
      const mutation = resetParentStudentCredential({ principal, household, ...command });
      const passwordHash = await dependencies.passwords.hash(command.new_password);
      return commit(principal, context, command.expected_revision, mutation, passwordHash);
    },
  };
}

export type ParentHouseholdService = ReturnType<typeof createParentHouseholdService>;

function assertMutationContext(context: ParentHouseholdMutationContext) {
  if (
    !IDEMPOTENCY_KEY.test(context.idempotency_key) ||
    !SHA256.test(context.canonical_request_hash) ||
    !Number.isFinite(Date.parse(context.occurred_at))
  ) {
    throw new ParentHouseholdError(
      PARENT_HOUSEHOLD_ERROR_CODES.invalidInput,
      'The mutation request binding is invalid.',
    );
  }
}

function replayResult(
  principal: ParentHouseholdPrincipal,
  household: ParentHouseholdRecord,
  studentId: string,
  operation: ParentHouseholdMutationOperation,
): ParentHouseholdMutation {
  if (household.access_state === 'inactive') {
    throw new ParentHouseholdError(
      PARENT_HOUSEHOLD_ERROR_CODES.accessInactive,
      'Student management is unavailable while household access is inactive.',
    );
  }
  const student = household.students.find((candidate) => candidate.student_id === studentId);
  if (!student) {
    throw new ParentHouseholdError(
      PARENT_HOUSEHOLD_ERROR_CODES.persistenceInvariant,
      'The committed Student mutation receipt is unavailable.',
    );
  }
  return {
    snapshot: buildParentHouseholdSnapshot({ principal, household }),
    audit: {
      actor_adult_id: principal.adult_id,
      household_id: household.household_id,
      student_id: student.student_id,
      action: operation,
    },
    revoke_student_sessions: [
      'student_profile_updated',
      'student_archived',
      'student_credential_reset',
    ].includes(operation),
    canonical_enrollment:
      operation === 'student_created' || operation === 'student_restored'
        ? 'enroll'
        : operation === 'student_archived'
          ? 'disable'
          : 'unchanged',
    credential_handoff: null,
  };
}
