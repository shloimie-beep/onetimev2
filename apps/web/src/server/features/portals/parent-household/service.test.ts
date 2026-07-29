import { describe, expect, it, vi } from 'vitest';
import type {
  ParentHouseholdPrincipal,
  ParentHouseholdRecord,
} from '../../../../../../../packages/contracts/src/portals/parent-household/index.ts';
import { createParentHouseholdService } from './service.ts';

const principal: ParentHouseholdPrincipal = {
  role: 'parent',
  adult_id: 'adult-1',
  household_id: 'household-1',
  session_id: 'session-1',
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
}) {
  const commitMutation = vi.fn().mockResolvedValue(undefined);
  const loadOwnedHousehold = vi.fn().mockResolvedValue({
    ...(overrides?.household ?? household),
    owner_adult_id: overrides?.owner ?? 'adult-1',
  });
  const isUsernameAvailable = vi.fn().mockResolvedValue(overrides?.usernameAvailable ?? true);
  const hash = vi.fn().mockResolvedValue('argon2id-redacted-hash');
  return {
    commitMutation,
    loadOwnedHousehold,
    isUsernameAvailable,
    hash,
    service: createParentHouseholdService({
      repository: { loadOwnedHousehold, isUsernameAvailable, commitMutation },
      passwords: { hash },
      ids: { nextStudentId: () => 'student-new' },
    }),
  };
}

describe('P12 Parent household server service', () => {
  it('derives the repository target only from authenticated Parent scope', async () => {
    const { service, loadOwnedHousehold } = setup();
    await expect(service.overview(principal)).resolves.toMatchObject({
      household_id: 'household-1',
      available_student_seats: 3,
    });
    expect(loadOwnedHousehold).toHaveBeenCalledWith('household-1');
    await expect(service.overview({ ...principal, household_id: 'household-2' })).rejects.toThrow(
      /unavailable/,
    );
  });

  it('hashes a new password, atomically commits audit/enrollment, and returns handoff once', async () => {
    const { service, hash, commitMutation } = setup();
    const result = await service.createStudent(principal, {
      expected_revision: 4,
      actual_name: 'Student Name',
      display_name: null,
      username: 'student.name',
      relationship: 'self',
      new_password: 'secure-password',
      password_confirmation: 'secure-password',
    });
    expect(hash).toHaveBeenCalledWith('secure-password');
    expect(commitMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        expected_revision: 4,
        password_hash: 'argon2id-redacted-hash',
        revoke_student_sessions: false,
        canonical_enrollment: 'enroll',
      }),
    );
    expect(result.credential_handoff?.new_password).toBe('secure-password');
    expect(JSON.stringify(commitMutation.mock.calls[0]![0].next)).not.toContain('secure-password');
  });

  it('rejects unavailable usernames and cross-owner access without committing', async () => {
    const unavailable = setup({ usernameAvailable: false });
    await expect(
      unavailable.service.createStudent(principal, {
        expected_revision: 4,
        actual_name: 'Student Name',
        username: 'student.name',
        relationship: 'dependent',
        new_password: 'secure-password',
        password_confirmation: 'secure-password',
      }),
    ).rejects.toThrow(/another Student username/);
    expect(unavailable.commitMutation).not.toHaveBeenCalled();

    const crossOwner = setup({ owner: 'adult-2' });
    await expect(crossOwner.service.overview(principal)).rejects.toThrow(/unavailable/);
    expect(crossOwner.commitMutation).not.toHaveBeenCalled();
  });

  it('does not commit or emit audit effects for same-state lifecycle resubmits', async () => {
    const activeStudent = {
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
    const archived = setup({
      household: {
        ...household,
        students: [{ ...activeStudent, state: 'archived' }],
      },
    });
    await expect(
      archived.service.archiveStudent(principal, {
        expected_revision: 4,
        student_id: 'student-1',
      }),
    ).rejects.toThrow(/already archived/);
    expect(archived.commitMutation).not.toHaveBeenCalled();

    const active = setup({ household: { ...household, students: [activeStudent] } });
    await expect(
      active.service.restoreStudent(principal, {
        expected_revision: 4,
        student_id: 'student-1',
      }),
    ).rejects.toThrow(/already active/);
    expect(active.commitMutation).not.toHaveBeenCalled();
  });
});
