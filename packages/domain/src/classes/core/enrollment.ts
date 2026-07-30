import {
  CANONICAL_CLASS_SERIES_ID,
  CLASSROOM_CORE_ERROR_CODES,
  type ClassroomCommandReceipt,
  type SeriesEnrollmentRecord,
  type StudentEligibilityRecord,
  type StudentLifecycleEnrollmentCommand,
} from '../../../../contracts/src/classes/core/index.ts';
import { ClassroomCoreError } from './errors.ts';

export type StudentEnrollmentSnapshot = {
  student: StudentEligibilityRecord;
  enrollment?: SeriesEnrollmentRecord;
};

export function applyStudentLifecycleWithCanonicalEnrollment(
  current: StudentEnrollmentSnapshot,
  command: StudentLifecycleEnrollmentCommand,
  priorReceipt?: ClassroomCommandReceipt | null,
) {
  assertScope(current.student, command);
  if (priorReceipt) {
    assertReplay(command, priorReceipt);
    return { snapshot: current, replay: true as const };
  }

  const active = command.action !== 'archive';
  const nextStudent: StudentEligibilityRecord = {
    ...current.student,
    state: active ? 'active' : 'archived',
    version: current.student.version + 1,
  };
  const existing = current.enrollment;
  const nextEnrollment: SeriesEnrollmentRecord = {
    accountKey: command.scope.accountKey,
    productKey: command.scope.productKey,
    id: existing?.id ?? `${CANONICAL_CLASS_SERIES_ID}:${command.studentId}`,
    seriesId: CANONICAL_CLASS_SERIES_ID,
    studentId: command.studentId,
    householdId: command.householdId,
    state: active ? 'active' : 'revoked',
    source:
      command.action === 'archive'
        ? 'student_archive'
        : command.action === 'restore'
          ? 'student_restore'
          : 'student_activation',
    effectiveAt: active ? command.occurredAt : (existing?.effectiveAt ?? command.occurredAt),
    ...(active ? {} : { revokedAt: command.occurredAt }),
    idempotencyKey: command.idempotencyKey,
    auditRef: command.auditRef,
    version: (existing?.version ?? 0) + 1,
  };
  const receipt: ClassroomCommandReceipt = {
    accountKey: command.scope.accountKey,
    productKey: command.scope.productKey,
    idempotencyKey: command.idempotencyKey,
    requestHash: command.requestHash,
    operation: `student:${command.action}:canonical-enrollment`,
    resultVersion: nextStudent.version,
    committedAt: command.occurredAt,
  };
  return {
    snapshot: { student: nextStudent, enrollment: nextEnrollment },
    receipt,
    replay: false as const,
  };
}

export type CanonicalEnrollmentRepair =
  | {
      kind: 'upsert_active';
      student: StudentEligibilityRecord;
      enrollment?: SeriesEnrollmentRecord;
    }
  | {
      kind: 'revoke';
      enrollment: SeriesEnrollmentRecord;
    };

export function planCanonicalEnrollmentReconciliation(
  activeStudents: readonly StudentEligibilityRecord[],
  enrollments: readonly SeriesEnrollmentRecord[],
) {
  const students = new Map(activeStudents.map((student) => [student.studentId, student]));
  const canonical = enrollments.filter(
    (enrollment) => enrollment.seriesId === CANONICAL_CLASS_SERIES_ID,
  );
  const byStudent = new Map<string, SeriesEnrollmentRecord>();
  const repairs: CanonicalEnrollmentRepair[] = [];

  for (const enrollment of canonical) {
    const duplicate = byStudent.get(enrollment.studentId);
    if (duplicate && enrollment.state === 'active') {
      repairs.push({ kind: 'revoke', enrollment });
      continue;
    }
    byStudent.set(enrollment.studentId, enrollment);
    if (enrollment.state === 'active' && !students.has(enrollment.studentId)) {
      repairs.push({ kind: 'revoke', enrollment });
    }
  }
  for (const student of activeStudents) {
    const enrollment = byStudent.get(student.studentId);
    if (!enrollment || enrollment.state !== 'active') {
      repairs.push({ kind: 'upsert_active', student, ...(enrollment ? { enrollment } : {}) });
    }
  }
  return repairs;
}

export function assertManualUnenrollAllowed(seriesId: string, isFutureSeries: boolean) {
  if (seriesId === CANONICAL_CLASS_SERIES_ID) {
    throw new ClassroomCoreError(
      CLASSROOM_CORE_ERROR_CODES.canonicalUnenrollDenied,
      'Canonical enrollment has no manual opt-out or unregister operation.',
    );
  }
  if (!isFutureSeries) {
    throw new ClassroomCoreError(
      CLASSROOM_CORE_ERROR_CODES.invalidTransition,
      'Only a governed future noncanonical series can be manually unenrolled.',
    );
  }
}

function assertScope(
  student: StudentEligibilityRecord,
  command: StudentLifecycleEnrollmentCommand,
) {
  if (
    student.accountKey !== command.scope.accountKey ||
    student.productKey !== command.scope.productKey ||
    student.studentId !== command.studentId ||
    student.householdId !== command.householdId
  ) {
    throw new ClassroomCoreError(
      CLASSROOM_CORE_ERROR_CODES.accessDenied,
      'Student lifecycle and enrollment scope must match exactly.',
    );
  }
}

function assertReplay(
  command: Pick<StudentLifecycleEnrollmentCommand, 'idempotencyKey' | 'requestHash'>,
  receipt: ClassroomCommandReceipt,
) {
  if (receipt.requestHash !== command.requestHash) {
    throw new ClassroomCoreError(
      CLASSROOM_CORE_ERROR_CODES.conflict,
      'The idempotency key was already used for a different request.',
    );
  }
}
