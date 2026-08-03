import {
  CANONICAL_CLASS_SERIES_ID,
  CLASSROOM_CORE_ERROR_CODES,
  type ClassroomCoreRepository,
  type ClassroomCoreUnitOfWork,
  type OccurrenceCreateCommand,
  type OccurrenceRescheduleCommand,
  type OccurrenceTransitionCommand,
  type SeriesEditCommand,
  type SeriesTransitionCommand,
  type StudentEligibilityRecord,
  type StudentLifecycleEnrollmentCommand,
} from '../../../../../../../packages/contracts/src/classes/core/index.ts';
import {
  ClassroomCoreError,
  applyStudentLifecycleWithCanonicalEnrollment,
  createOccurrence,
  editSeries,
  rescheduleOccurrence,
  transitionOccurrence,
  transitionSeries,
} from '../../../../../../../packages/domain/src/classes/core/index.ts';

export function createClassroomCoreService(repository: ClassroomCoreRepository) {
  return {
    editSeries: (command: SeriesEditCommand) =>
      repository.inTransaction(async (unit) => {
        const scope = command.actor;
        const [series, receipt] = await Promise.all([
          unit.getSeries(scope, command.seriesId),
          unit.getReceipt(scope, command.idempotencyKey),
        ]);
        if (!series) throw notFound('class series');
        const result = editSeries(series, command, receipt);
        if (!result.replay) {
          await unit.saveSeries(result.series);
          await unit.saveReceipt(result.receipt);
        }
        return result;
      }),
    transitionSeries: (command: SeriesTransitionCommand) =>
      repository.inTransaction(async (unit) => {
        const scope = command.actor;
        const [series, receipt] = await Promise.all([
          unit.getSeries(scope, command.seriesId),
          unit.getReceipt(scope, command.idempotencyKey),
        ]);
        if (!series) throw notFound('class series');
        const result = transitionSeries(series, command, receipt);
        if (!result.replay) {
          await unit.saveSeries(result.series);
          await unit.saveReceipt(result.receipt);
        }
        return result;
      }),
    createOccurrence: (command: OccurrenceCreateCommand) =>
      repository.inTransaction(async (unit) => {
        const scope = command.actor;
        const [series, receipt] = await Promise.all([
          unit.getSeries(scope, command.seriesId),
          unit.getReceipt(scope, command.idempotencyKey),
        ]);
        if (!series) throw notFound('class series');
        const result = createOccurrence(series, command, receipt);
        if (!result.replay) {
          await unit.saveOccurrence(result.occurrence);
          await unit.saveReceipt(result.receipt);
        }
        return result;
      }),
    transitionOccurrence: (command: OccurrenceTransitionCommand) =>
      repository.inTransaction(async (unit) => {
        const scope = command.actor;
        const [occurrence, receipt] = await Promise.all([
          unit.getOccurrence(scope, command.occurrenceId),
          unit.getReceipt(scope, command.idempotencyKey),
        ]);
        if (!occurrence) throw notFound('class occurrence');
        const result = transitionOccurrence(occurrence, command, receipt);
        if (!result.replay) {
          await unit.saveOccurrence(result.occurrence);
          await unit.saveReceipt(result.receipt);
        }
        return result;
      }),
    rescheduleOccurrence: (command: OccurrenceRescheduleCommand) =>
      repository.inTransaction(async (unit) => {
        const scope = command.actor;
        const [occurrence, receipt] = await Promise.all([
          unit.getOccurrence(scope, command.occurrenceId),
          unit.getReceipt(scope, command.idempotencyKey),
        ]);
        if (!occurrence) throw notFound('class occurrence');
        const result = rescheduleOccurrence(occurrence, command, receipt);
        if (!result.replay) {
          await unit.saveOccurrence(result.occurrence);
          await unit.saveReceipt(result.receipt);
        }
        return result;
      }),
    applyStudentLifecycle: (
      command: StudentLifecycleEnrollmentCommand,
      stagedStudent?: StudentEligibilityRecord,
    ) =>
      repository.inTransaction((unit) => applyStudentLifecycleInUnit(unit, command, stagedStudent)),
  };
}

export async function applyStudentLifecycleInUnit(
  unit: ClassroomCoreUnitOfWork,
  command: StudentLifecycleEnrollmentCommand,
  stagedStudent?: StudentEligibilityRecord,
) {
  const [persistedStudent, enrollment, receipt] = await Promise.all([
    stagedStudent ? Promise.resolve(null) : unit.getStudent(command.scope, command.studentId),
    unit.getEnrollment(command.scope, CANONICAL_CLASS_SERIES_ID, command.studentId),
    unit.getReceipt(command.scope, command.idempotencyKey),
  ]);
  const student = stagedStudent ?? persistedStudent;
  if (!student) throw notFound('Student');
  const result = applyStudentLifecycleWithCanonicalEnrollment(
    { student, ...(enrollment ? { enrollment } : {}) },
    command,
    receipt,
  );
  if (!result.replay) {
    await unit.saveStudent(result.snapshot.student);
    await unit.saveEnrollment(result.snapshot.enrollment);
    await unit.saveReceipt(result.receipt);
  }
  return result;
}

function notFound(subject: string) {
  return new ClassroomCoreError(
    CLASSROOM_CORE_ERROR_CODES.notFound,
    `The requested ${subject} was not found in this account and product.`,
  );
}
