import { describe, expect, it, vi } from 'vitest';
import {
  PARENT_HOUSEHOLD_ERROR_CODES,
  type ParentHouseholdMutationContext,
  type ParentHouseholdMutationReceipt,
  type ParentHouseholdPrincipal,
  type ParentHouseholdRecord,
  type ParentHouseholdRepository,
} from '../../../../../../../packages/contracts/src/portals/parent-household/index.ts';
import { createParentHouseholdService } from './service.ts';

const principal: ParentHouseholdPrincipal = {
  role: 'parent',
  adult_id: 'adult-1',
  household_id: 'household-1',
  session_id: 'session-1',
};

const context: ParentHouseholdMutationContext = {
  idempotency_key: 'parent-create-0001',
  canonical_request_hash: 'a'.repeat(64),
  occurred_at: '2026-07-31T14:00:00.000Z',
};

const student = {
  student_id: 'student-1',
  household_id: 'household-1',
  actual_name: 'Student One',
  display_name: null,
  username: 'student.one',
  relationship: 'dependent' as const,
  state: 'active' as const,
  credential_version: 2,
  version: 3,
};

const household: ParentHouseholdRecord = {
  household_id: 'household-1',
  owner_adult_id: 'adult-1',
  display_name: 'Household One',
  access_state: 'active',
  student_allowance: 3,
  revision: 4,
  students: [],
};

function setup(overrides?: {
  owner?: string;
  usernameAvailable?: boolean;
  household?: ParentHouseholdRecord;
  receipt?: ParentHouseholdMutationReceipt | null;
  commitReceipt?: ParentHouseholdMutationReceipt;
}) {
  const commitMutation = vi.fn(
    async (input: Parameters<ParentHouseholdRepository['commitMutation']>[0]) => {
      await input.password_hash_factory?.();
      return (
        overrides?.commitReceipt ?? {
          disposition: 'committed' as const,
          operation: input.audit.action,
          student_id: input.audit.student_id,
          household_revision: input.next.revision,
        }
      );
    },
  );
  const loadOwnedHousehold = vi.fn().mockResolvedValue({
    ...(overrides?.household ?? household),
    owner_adult_id: overrides?.owner ?? 'adult-1',
  });
  const isUsernameAvailable = vi.fn().mockResolvedValue(overrides?.usernameAvailable ?? true);
  const findMutation = vi.fn().mockResolvedValue(overrides?.receipt ?? null);
  const hash = vi.fn().mockResolvedValue('argon2id-redacted-hash');
  const nextStudentId = vi.fn(() => 'student-new');
  return {
    commitMutation,
    loadOwnedHousehold,
    isUsernameAvailable,
    findMutation,
    hash,
    nextStudentId,
    service: createParentHouseholdService({
      repository: { loadOwnedHousehold, isUsernameAvailable, findMutation, commitMutation },
      passwords: { hash },
      ids: { nextStudentId },
    }),
  };
}

describe('P12 Parent household server service', () => {
  it('derives the repository target only from the authenticated Parent principal', async () => {
    const { service, loadOwnedHousehold } = setup();
    await expect(service.overview(principal)).resolves.toMatchObject({
      household_id: 'household-1',
      available_student_seats: 3,
    });
    expect(loadOwnedHousehold).toHaveBeenCalledWith(principal);
    await expect(service.overview({ ...principal, household_id: 'household-2' })).rejects.toThrow(
      /unavailable/,
    );
  });

  it('passes a lazy password hash factory plus server request binding to persistence', async () => {
    const { service, hash, commitMutation } = setup();
    const result = await service.createStudent(
      principal,
      {
        expected_revision: 4,
        actual_name: 'Student Name',
        display_name: null,
        username: 'student.name',
        relationship: 'self',
        new_password: '000123',
        password_confirmation: '000123',
      },
      context,
    );
    expect(hash).toHaveBeenCalledWith('000123');
    expect(commitMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        principal,
        context,
        expected_revision: 4,
        password_hash_factory: expect.any(Function),
        revoke_student_sessions: false,
        canonical_enrollment: 'enroll',
      }),
    );
    expect(result.credential_handoff?.new_password).toBe('000123');
    expect(JSON.stringify(commitMutation.mock.calls[0]![0])).not.toContain('000123');
  });

  it('rejects mismatched create and reset confirmation before receipt lookup or credential work', async () => {
    const create = setup({
      household: { ...household, revision: 5, students: [student] },
      receipt: {
        disposition: 'replayed',
        operation: 'student_created',
        student_id: 'student-1',
        household_revision: 5,
      },
    });
    await expect(
      create.service.createStudent(
        principal,
        {
          expected_revision: 4,
          actual_name: 'Student One',
          username: 'student.one',
          relationship: 'dependent',
          new_password: '000123',
          password_confirmation: '123456',
        },
        context,
      ),
    ).rejects.toMatchObject({ code: PARENT_HOUSEHOLD_ERROR_CODES.invalidInput });
    expect(create.findMutation).not.toHaveBeenCalled();
    expect(create.loadOwnedHousehold).not.toHaveBeenCalled();
    expect(create.hash).not.toHaveBeenCalled();
    expect(create.nextStudentId).not.toHaveBeenCalled();
    expect(create.commitMutation).not.toHaveBeenCalled();

    const reset = setup({
      household: { ...household, revision: 5, students: [student] },
      receipt: {
        disposition: 'replayed',
        operation: 'student_credential_reset',
        student_id: 'student-1',
        household_revision: 5,
      },
    });
    await expect(
      reset.service.resetStudentCredential(
        principal,
        {
          expected_revision: 4,
          student_id: 'student-1',
          new_password: '000123',
          password_confirmation: '123456',
        },
        { ...context, idempotency_key: 'parent-reset-0001' },
      ),
    ).rejects.toMatchObject({ code: PARENT_HOUSEHOLD_ERROR_CODES.invalidInput });
    expect(reset.findMutation).not.toHaveBeenCalled();
    expect(reset.loadOwnedHousehold).not.toHaveBeenCalled();
    expect(reset.hash).not.toHaveBeenCalled();
    expect(reset.commitMutation).not.toHaveBeenCalled();
  });

  it('returns an exact committed replay without credential redisclosure, hashing, ID allocation, or a second commit', async () => {
    const replay = setup({
      household: { ...household, revision: 5, students: [student] },
      receipt: {
        disposition: 'replayed',
        operation: 'student_created',
        student_id: 'student-1',
        household_revision: 5,
      },
    });
    const result = await replay.service.createStudent(
      principal,
      {
        expected_revision: 4,
        actual_name: 'Student One',
        username: 'student.one',
        relationship: 'dependent',
        new_password: '000123',
        password_confirmation: '000123',
      },
      context,
    );
    expect(result.snapshot.revision).toBe(5);
    expect(result.credential_handoff).toBeNull();
    expect(replay.hash).not.toHaveBeenCalled();
    expect(replay.nextStudentId).not.toHaveBeenCalled();
    expect(replay.commitMutation).not.toHaveBeenCalled();
  });

  it('returns an inactive status overview but rejects every mutation replay before credential work', async () => {
    const inactive = setup({
      household: {
        ...household,
        access_state: 'inactive',
        students: [student],
      },
      receipt: {
        disposition: 'replayed',
        operation: 'student_created',
        student_id: 'student-1',
        household_revision: 4,
      },
    });
    await expect(inactive.service.overview(principal)).resolves.toMatchObject({
      access_state: 'inactive',
      students: [],
    });
    await expect(
      inactive.service.createStudent(
        principal,
        {
          expected_revision: 4,
          actual_name: 'Student One',
          username: 'student.one',
          relationship: 'dependent',
          new_password: '000123',
          password_confirmation: '000123',
        },
        context,
      ),
    ).rejects.toMatchObject({ code: PARENT_HOUSEHOLD_ERROR_CODES.accessInactive });
    expect(inactive.hash).not.toHaveBeenCalled();
    expect(inactive.commitMutation).not.toHaveBeenCalled();
  });

  it('rejects unavailable usernames and cross-owner access without committing', async () => {
    const unavailable = setup({ usernameAvailable: false });
    await expect(
      unavailable.service.createStudent(
        principal,
        {
          expected_revision: 4,
          actual_name: 'Student Name',
          username: 'student.name',
          relationship: 'dependent',
          new_password: '000123',
          password_confirmation: '000123',
        },
        context,
      ),
    ).rejects.toThrow(/another Student username/);
    expect(unavailable.commitMutation).not.toHaveBeenCalled();

    const crossOwner = setup({ owner: 'adult-2' });
    await expect(crossOwner.service.overview(principal)).rejects.toThrow(/unavailable/);
    expect(crossOwner.commitMutation).not.toHaveBeenCalled();
  });

  it('proves the owned update target before checking its normalized username', async () => {
    const owned = setup({ household: { ...household, students: [student] } });
    await owned.service.updateStudent(
      principal,
      {
        expected_revision: 4,
        student_id: 'student-1',
        actual_name: 'Student One',
        display_name: null,
        username: ' Updated.Student ',
      },
      { ...context, idempotency_key: 'parent-update-0001' },
    );
    expect(owned.isUsernameAvailable).toHaveBeenCalledWith({
      principal,
      username: 'updated.student',
      except_student_id: 'student-1',
    });

    for (const usernameAvailable of [true, false]) {
      const concealed = setup({
        household: { ...household, students: [student] },
        usernameAvailable,
      });
      await expect(
        concealed.service.updateStudent(
          principal,
          {
            expected_revision: 4,
            student_id: 'student-from-another-household',
            actual_name: 'Hidden Student',
            display_name: null,
            username: usernameAvailable ? 'unused.student' : 'globally.taken',
          },
          { ...context, idempotency_key: `parent-conceal-${String(usernameAvailable)}-0001` },
        ),
      ).rejects.toMatchObject({ code: PARENT_HOUSEHOLD_ERROR_CODES.studentMissing });
      expect(concealed.isUsernameAvailable).not.toHaveBeenCalled();
      expect(concealed.commitMutation).not.toHaveBeenCalled();
    }
  });

  it('does not commit or emit audit effects for same-state lifecycle resubmits', async () => {
    const archived = setup({
      household: { ...household, students: [{ ...student, state: 'archived' }] },
    });
    await expect(
      archived.service.archiveStudent(
        principal,
        { expected_revision: 4, student_id: 'student-1' },
        { ...context, idempotency_key: 'parent-archive-0001' },
      ),
    ).rejects.toThrow(/already archived/);
    expect(archived.commitMutation).not.toHaveBeenCalled();

    const active = setup({ household: { ...household, students: [student] } });
    await expect(
      active.service.restoreStudent(
        principal,
        { expected_revision: 4, student_id: 'student-1' },
        { ...context, idempotency_key: 'parent-restore-0001' },
      ),
    ).rejects.toThrow(/already active/);
    expect(active.commitMutation).not.toHaveBeenCalled();
  });
});
