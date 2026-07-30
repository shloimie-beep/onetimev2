import {
  PARENT_HOUSEHOLD_ERROR_CODES,
  type CreateParentStudentCommand,
  type ParentHouseholdPrincipal,
  type ParentHouseholdRepository,
  type ParentStudentIdPort,
  type ParentStudentPasswordPort,
  type ParentStudentLifecycleCommand,
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

export function createParentHouseholdService(dependencies: {
  repository: ParentHouseholdRepository;
  passwords: ParentStudentPasswordPort;
  ids: ParentStudentIdPort;
}) {
  async function load(principal: ParentHouseholdPrincipal) {
    const household = await dependencies.repository.loadOwnedHousehold(principal.household_id);
    if (!household) {
      throw new ParentHouseholdError(
        PARENT_HOUSEHOLD_ERROR_CODES.householdMissing,
        'This Parent household is unavailable.',
      );
    }
    return household;
  }

  async function commit(
    expected_revision: number,
    mutation: ReturnType<typeof createParentStudent>,
    password_hash: string | null,
  ) {
    await dependencies.repository.commitMutation({
      expected_revision,
      next: mutation.next,
      audit: mutation.result.audit,
      password_hash,
      revoke_student_sessions: mutation.result.revoke_student_sessions,
      canonical_enrollment: mutation.result.canonical_enrollment,
    });
    return mutation.result;
  }

  return {
    async overview(principal: ParentHouseholdPrincipal) {
      return buildParentHouseholdSnapshot({ principal, household: await load(principal) });
    },

    async createStudent(principal: ParentHouseholdPrincipal, command: CreateParentStudentCommand) {
      const household = await load(principal);
      buildParentHouseholdSnapshot({ principal, household });
      if (!(await dependencies.repository.isUsernameAvailable({ username: command.username }))) {
        throw new ParentHouseholdError(
          PARENT_HOUSEHOLD_ERROR_CODES.usernameUnavailable,
          'Choose another Student username.',
        );
      }
      const password_hash = await dependencies.passwords.hash(command.new_password);
      const mutation = createParentStudent({
        principal,
        household,
        student_id: dependencies.ids.nextStudentId(),
        ...command,
      });
      return commit(command.expected_revision, mutation, password_hash);
    },

    async updateStudent(principal: ParentHouseholdPrincipal, command: UpdateParentStudentCommand) {
      const household = await load(principal);
      buildParentHouseholdSnapshot({ principal, household });
      if (
        !(await dependencies.repository.isUsernameAvailable({
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
        command.expected_revision,
        updateParentStudent({ principal, household, ...command }),
        null,
      );
    },

    async archiveStudent(
      principal: ParentHouseholdPrincipal,
      command: ParentStudentLifecycleCommand,
    ) {
      return commit(
        command.expected_revision,
        archiveParentStudent({ principal, household: await load(principal), ...command }),
        null,
      );
    },

    async restoreStudent(
      principal: ParentHouseholdPrincipal,
      command: ParentStudentLifecycleCommand,
    ) {
      return commit(
        command.expected_revision,
        restoreParentStudent({ principal, household: await load(principal), ...command }),
        null,
      );
    },

    async resetStudentCredential(
      principal: ParentHouseholdPrincipal,
      command: ResetParentStudentCredentialCommand,
    ) {
      const household = await load(principal);
      buildParentHouseholdSnapshot({ principal, household });
      const password_hash = await dependencies.passwords.hash(command.new_password);
      return commit(
        command.expected_revision,
        resetParentStudentCredential({
          principal,
          household,
          ...command,
        }),
        password_hash,
      );
    },
  };
}
