import {
  PARENT_HOUSEHOLD_CONTRACT_VERSION,
  PARENT_HOUSEHOLD_ERROR_CODES,
  isStudentPin,
  STANDARD_FAMILY_STUDENT_ALLOWANCE,
  type ParentHouseholdAuditEvent,
  type ParentHouseholdMutation,
  type ParentHouseholdPrincipal,
  type ParentHouseholdRecord,
  type ParentHouseholdSnapshot,
  type ParentManagedStudent,
  type ParentStudentRelationship,
  type StudentCredentialHandoff,
} from '../../../../contracts/src/portals/parent-household/index.ts';
import { ParentHouseholdError } from './errors.ts';

const USERNAME = /^[a-z0-9][a-z0-9._-]{2,47}$/;

export function buildParentHouseholdSnapshot(input: {
  principal: ParentHouseholdPrincipal;
  household: ParentHouseholdRecord;
}): ParentHouseholdSnapshot {
  assertOwnedHousehold(input.principal, input.household);
  const active = input.household.students.filter((student) => student.state === 'active').length;
  const studentAllowance = effectiveStudentAllowance(input.household);
  return {
    contract_version: PARENT_HOUSEHOLD_CONTRACT_VERSION,
    household_id: input.household.household_id,
    display_name: input.household.display_name,
    access_state: input.household.access_state,
    student_allowance: studentAllowance,
    active_student_count: active,
    available_student_seats: Math.max(0, studentAllowance - active),
    can_manage_students: input.household.access_state !== 'inactive',
    revision: input.household.revision,
    students: input.household.students.map((student) => ({ ...student })),
  };
}

export function createParentStudent(input: {
  principal: ParentHouseholdPrincipal;
  household: ParentHouseholdRecord;
  expected_revision: number;
  student_id: string;
  actual_name: string;
  display_name?: string | null;
  username: string;
  relationship: ParentStudentRelationship;
  new_password: string;
  password_confirmation: string;
}): { next: ParentHouseholdRecord; result: ParentHouseholdMutation } {
  assertMutable(input.principal, input.household, input.expected_revision);
  assertSeatAvailable(input.household);
  if (input.relationship !== 'dependent') {
    invalid('New Student accounts must be dependents.');
  }
  const profile = validateProfile(input);
  validatePassword(input.new_password, input.password_confirmation);
  const student: ParentManagedStudent = {
    student_id: required(input.student_id, 'Student identifier'),
    household_id: input.household.household_id,
    ...profile,
    state: 'active',
    credential_version: 1,
    version: 1,
  };
  const next = increment(input.household, [...input.household.students, student]);
  return mutation(input.principal, next, student, 'student_created', {
    revoke: false,
    enrollment: 'enroll',
    handoff: credentialHandoff(student, input.new_password),
  });
}

export function updateParentStudent(input: {
  principal: ParentHouseholdPrincipal;
  household: ParentHouseholdRecord;
  expected_revision: number;
  student_id: string;
  actual_name: string;
  display_name?: string | null;
  username: string;
}): { next: ParentHouseholdRecord; result: ParentHouseholdMutation } {
  assertMutable(input.principal, input.household, input.expected_revision);
  const current = ownedStudent(input.household, input.student_id);
  const profile = validateProfile({ ...input, relationship: current.relationship });
  const usernameChanged = profile.username !== current.username;
  const student = {
    ...current,
    ...profile,
    credential_version: current.credential_version + (usernameChanged ? 1 : 0),
    version: current.version + 1,
  };
  const next = replaceStudent(input.household, student);
  return mutation(input.principal, next, student, 'student_profile_updated', {
    revoke: usernameChanged,
    enrollment: 'unchanged',
    handoff: null,
  });
}

export function archiveParentStudent(input: {
  principal: ParentHouseholdPrincipal;
  household: ParentHouseholdRecord;
  expected_revision: number;
  student_id: string;
}): { next: ParentHouseholdRecord; result: ParentHouseholdMutation } {
  assertMutable(input.principal, input.household, input.expected_revision);
  const current = ownedStudent(input.household, input.student_id);
  if (current.state === 'archived') {
    throw new ParentHouseholdError(
      PARENT_HOUSEHOLD_ERROR_CODES.lifecycleUnchanged,
      'This Student is already archived.',
    );
  }
  const student = {
    ...current,
    state: 'archived' as const,
    credential_version: current.credential_version + 1,
    version: current.version + 1,
  };
  const next = replaceStudent(input.household, student);
  return mutation(input.principal, next, student, 'student_archived', {
    revoke: true,
    enrollment: 'disable',
    handoff: null,
  });
}

export function restoreParentStudent(input: {
  principal: ParentHouseholdPrincipal;
  household: ParentHouseholdRecord;
  expected_revision: number;
  student_id: string;
}): { next: ParentHouseholdRecord; result: ParentHouseholdMutation } {
  assertMutable(input.principal, input.household, input.expected_revision);
  const current = ownedStudent(input.household, input.student_id);
  if (current.state === 'active') {
    throw new ParentHouseholdError(
      PARENT_HOUSEHOLD_ERROR_CODES.lifecycleUnchanged,
      'This Student is already active.',
    );
  }
  assertSeatAvailable(input.household);
  const student = { ...current, state: 'active' as const, version: current.version + 1 };
  const next = replaceStudent(input.household, student);
  return mutation(input.principal, next, student, 'student_restored', {
    revoke: false,
    enrollment: 'enroll',
    handoff: null,
  });
}

export function resetParentStudentCredential(input: {
  principal: ParentHouseholdPrincipal;
  household: ParentHouseholdRecord;
  expected_revision: number;
  student_id: string;
  new_password: string;
  password_confirmation: string;
}): { next: ParentHouseholdRecord; result: ParentHouseholdMutation } {
  assertMutable(input.principal, input.household, input.expected_revision);
  const current = ownedStudent(input.household, input.student_id);
  if (current.state !== 'active') {
    throw new ParentHouseholdError(
      PARENT_HOUSEHOLD_ERROR_CODES.archived,
      'Restore this Student before resetting credentials.',
    );
  }
  validatePassword(input.new_password, input.password_confirmation);
  const student = {
    ...current,
    credential_version: current.credential_version + 1,
    version: current.version + 1,
  };
  const next = replaceStudent(input.household, student);
  return mutation(input.principal, next, student, 'student_credential_reset', {
    revoke: true,
    enrollment: 'unchanged',
    handoff: credentialHandoff(student, input.new_password),
  });
}

function assertOwnedHousehold(
  principal: ParentHouseholdPrincipal,
  household: ParentHouseholdRecord,
) {
  if (
    principal.role !== 'parent' ||
    principal.household_id !== household.household_id ||
    principal.adult_id !== household.owner_adult_id
  ) {
    throw new ParentHouseholdError(
      PARENT_HOUSEHOLD_ERROR_CODES.scopeDenied,
      'This Parent household is unavailable.',
    );
  }
}

function assertMutable(
  principal: ParentHouseholdPrincipal,
  household: ParentHouseholdRecord,
  expectedRevision: number,
) {
  assertOwnedHousehold(principal, household);
  if (household.access_state === 'inactive') {
    throw new ParentHouseholdError(
      PARENT_HOUSEHOLD_ERROR_CODES.accessInactive,
      'Student management is unavailable while household access is inactive.',
    );
  }
  if (household.revision !== expectedRevision) {
    throw new ParentHouseholdError(
      PARENT_HOUSEHOLD_ERROR_CODES.conflict,
      'The household changed. Refresh before trying again.',
    );
  }
}

function assertSeatAvailable(household: ParentHouseholdRecord) {
  const active = household.students.filter((student) => student.state === 'active').length;
  const studentAllowance = effectiveStudentAllowance(household);
  if (active >= studentAllowance) {
    throw new ParentHouseholdError(
      PARENT_HOUSEHOLD_ERROR_CODES.seatLimit,
      `This household already uses all ${studentAllowance} active Student seats.`,
    );
  }
}

function effectiveStudentAllowance(household: ParentHouseholdRecord) {
  const configuredAllowance = Number.isFinite(household.student_allowance)
    ? Math.max(0, Math.floor(household.student_allowance))
    : 0;
  return Math.min(STANDARD_FAMILY_STUDENT_ALLOWANCE, configuredAllowance);
}

function ownedStudent(household: ParentHouseholdRecord, studentId: string) {
  const student = household.students.find(
    (candidate) =>
      candidate.student_id === studentId && candidate.household_id === household.household_id,
  );
  if (!student) {
    throw new ParentHouseholdError(
      PARENT_HOUSEHOLD_ERROR_CODES.studentMissing,
      'This Student is unavailable.',
    );
  }
  return student;
}

function validateProfile(input: {
  actual_name: string;
  display_name?: string | null;
  username: string;
  relationship: ParentStudentRelationship;
}) {
  const actual_name = required(input.actual_name, 'Actual name');
  if (actual_name.length > 100) invalid('Actual name is too long.');
  const display_name = input.display_name?.trim() || null;
  if (display_name && display_name.length > 100) invalid('Display name is too long.');
  const username = input.username.trim().toLowerCase();
  if (!USERNAME.test(username)) invalid('Choose a valid human-readable username.');
  if (input.relationship !== 'self' && input.relationship !== 'dependent') {
    invalid('Choose who this learner is.');
  }
  return { actual_name, display_name, username, relationship: input.relationship };
}

function validatePassword(password: string, confirmation: string) {
  if (password !== confirmation || !isStudentPin(password)) {
    invalid('Student PINs must match and contain exactly six numeric digits.');
  }
}

function required(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) invalid(`${label} is required.`);
  return normalized;
}

function invalid(message: string): never {
  throw new ParentHouseholdError(PARENT_HOUSEHOLD_ERROR_CODES.invalidInput, message);
}

function increment(
  household: ParentHouseholdRecord,
  students: readonly ParentManagedStudent[],
): ParentHouseholdRecord {
  return { ...household, revision: household.revision + 1, students };
}

function replaceStudent(
  household: ParentHouseholdRecord,
  student: ParentManagedStudent,
): ParentHouseholdRecord {
  return increment(
    household,
    household.students.map((candidate) =>
      candidate.student_id === student.student_id ? student : candidate,
    ),
  );
}

function credentialHandoff(
  student: ParentManagedStudent,
  newPassword: string,
): StudentCredentialHandoff {
  return {
    student_id: student.student_id,
    student_label: student.display_name ?? student.actual_name,
    username: student.username,
    new_password: newPassword,
    display_once: true,
    may_copy_or_print: true,
    emailed: false,
  };
}

function mutation(
  principal: ParentHouseholdPrincipal,
  next: ParentHouseholdRecord,
  student: ParentManagedStudent,
  action: ParentHouseholdAuditEvent['action'],
  effects: {
    revoke: boolean;
    enrollment: ParentHouseholdMutation['canonical_enrollment'];
    handoff: StudentCredentialHandoff | null;
  },
) {
  const audit: ParentHouseholdAuditEvent = {
    actor_adult_id: principal.adult_id,
    household_id: next.household_id,
    student_id: student.student_id,
    action,
  };
  return {
    next,
    result: {
      snapshot: buildParentHouseholdSnapshot({ principal, household: next }),
      audit,
      revoke_student_sessions: effects.revoke,
      canonical_enrollment: effects.enrollment,
      credential_handoff: effects.handoff,
    },
  };
}
