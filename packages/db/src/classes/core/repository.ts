import type {
  ClassOccurrenceRecord,
  ClassroomCommandReceipt,
  ClassroomCoreRepository,
  ClassroomCoreUnitOfWork,
  ClassroomScope,
  ClassSeriesRecord,
  SeriesEnrollmentRecord,
  StudentEligibilityRecord,
} from '../../../../contracts/src/classes/core/index.ts';
import { inTransaction, type DbPool, type Queryable } from '../../index.ts';

const CLASS_REMINDER_MINUTES_BEFORE = 30;

export function createClassroomCoreRepository(pool: DbPool): ClassroomCoreRepository {
  return {
    inTransaction: (run) => inTransaction(pool, (client) => run(createUnit(client))),
  };
}

function createUnit(client: Queryable): ClassroomCoreUnitOfWork {
  return {
    getSeries: async (scope, seriesId) => {
      const result = await client.query(
        `SELECT *
           FROM onetime.class_series
          WHERE account_key = $1 AND product_key = $2 AND class_series_key = $3
          FOR UPDATE`,
        [scope.accountKey, scope.productKey, seriesId],
      );
      return result.rows[0] ? mapSeries(result.rows[0] as Record<string, unknown>) : null;
    },
    saveSeries: async (series) => {
      const reminderLocalTime = classReminderLocalTime(series.localStartTime);
      const recurrenceWeekdays = classWeekdaysForPersistence(series.weekdays);
      await client.query(
        `INSERT INTO onetime.class_series
           (class_series_key, account_key, product_key, title, series_state, is_canonical,
            timezone, local_start_time, duration_minutes, recurrence_weekdays,
            recurrence_starts_on, recurrence_ends_on, teacher_profile_key,
            embedded_classroom_required, recording_enabled, version, created_at, updated_at,
            reminder_local_time)
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::smallint[], $11::date, $12::date,
            $13, $14, $15, $16, $17, $18, $19)
         ON CONFLICT (account_key, product_key, class_series_key)
         DO UPDATE SET
           title = EXCLUDED.title,
           series_state = EXCLUDED.series_state,
           timezone = EXCLUDED.timezone,
           local_start_time = EXCLUDED.local_start_time,
           reminder_local_time = EXCLUDED.reminder_local_time,
           duration_minutes = EXCLUDED.duration_minutes,
           recurrence_weekdays = EXCLUDED.recurrence_weekdays,
           recurrence_starts_on = EXCLUDED.recurrence_starts_on,
           recurrence_ends_on = EXCLUDED.recurrence_ends_on,
           teacher_profile_key = EXCLUDED.teacher_profile_key,
           embedded_classroom_required = EXCLUDED.embedded_classroom_required,
           recording_enabled = EXCLUDED.recording_enabled,
           version = EXCLUDED.version,
           updated_at = EXCLUDED.updated_at`,
        [
          series.id,
          series.accountKey,
          series.productKey,
          series.title,
          series.state,
          series.canonical,
          series.timeZone,
          series.localStartTime,
          series.durationMinutes,
          recurrenceWeekdays,
          series.startsOn,
          series.endsOn ?? null,
          series.teacherProfileId,
          series.embeddedClassroomRequired,
          series.recordingEnabled,
          series.version,
          series.createdAt,
          series.updatedAt,
          reminderLocalTime,
        ],
      );
    },
    getOccurrence: async (scope, occurrenceId) => {
      const result = await client.query(
        `SELECT *
           FROM onetime.class_occurrences
          WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3
          FOR UPDATE`,
        [scope.accountKey, scope.productKey, occurrenceId],
      );
      return result.rows[0] ? mapOccurrence(result.rows[0] as Record<string, unknown>) : null;
    },
    saveOccurrence: async (occurrence) => {
      const { reminderDueAt, joinableUntil } = occurrencePersistenceTiming(occurrence);
      const sharedValues = [
        occurrence.id,
        occurrence.accountKey,
        occurrence.productKey,
        occurrence.seriesId,
        occurrence.localClassDate,
        occurrence.startsAt,
        occurrence.scheduledEndsAt,
        occurrence.joinOpensAt,
        occurrence.joinClosesAt,
        occurrence.state,
        occurrence.scheduleVersion,
        occurrence.version,
      ];
      const updated = await client.query(
        `UPDATE onetime.class_occurrences
            SET class_series_key = $4,
                local_class_date = $5::date,
                starts_at = $6,
                scheduled_ends_at = $7,
                join_opens_at = $8,
                join_closes_at = $9,
                reminder_due_at = $14,
                joinable_until = $15,
                occurrence_state = $10,
                schedule_version = $11,
                version = $12,
                updated_at = $13
          WHERE occurrence_key = $1 AND account_key = $2 AND product_key = $3`,
        [...sharedValues, occurrence.updatedAt, reminderDueAt, joinableUntil],
      );
      if (updated.rowCount === 0) {
        const insertValues = [
          ...sharedValues,
          occurrence.createdAt,
          occurrence.updatedAt,
          reminderDueAt,
          joinableUntil,
        ];
        await client.query(
          `INSERT INTO onetime.class_occurrences
             (occurrence_key, account_key, product_key, class_series_key, local_class_date,
              starts_at, scheduled_ends_at, join_opens_at, join_closes_at, occurrence_state,
              schedule_version, version, created_at, updated_at, reminder_due_at, joinable_until)
           VALUES
             ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
           ON CONFLICT (account_key, product_key, class_series_key, local_class_date)
           DO NOTHING`,
          insertValues,
        );
      }
    },
    getStudent: async (scope, studentId) => {
      const result = await client.query(
        `SELECT account_key, product_key, learner_key, household_key, learner_status, version
           FROM onetime.portal_learners
          WHERE account_key = $1 AND product_key = $2 AND learner_key = $3
          FOR UPDATE`,
        [scope.accountKey, scope.productKey, studentId],
      );
      return result.rows[0] ? mapStudent(result.rows[0] as Record<string, unknown>) : null;
    },
    saveStudent: async (student) => {
      const result = await client.query(
        `UPDATE onetime.portal_learners
            SET learner_status = $4,
                version = $5,
                archived_at = CASE WHEN $4 = 'archived' THEN now() ELSE NULL END,
                updated_at = now()
          WHERE account_key = $1 AND product_key = $2 AND learner_key = $3`,
        [student.accountKey, student.productKey, student.studentId, student.state, student.version],
      );
      if (result.rowCount !== 1) throw new Error('Student write lost its transaction fence.');
    },
    getEnrollment: async (scope, seriesId, studentId) => {
      const result = await client.query(
        `SELECT *
           FROM onetime.class_series_enrollments
          WHERE account_key = $1 AND product_key = $2
            AND class_series_key = $3 AND learner_key = $4
          FOR UPDATE`,
        [scope.accountKey, scope.productKey, seriesId, studentId],
      );
      return result.rows[0] ? mapEnrollment(result.rows[0] as Record<string, unknown>) : null;
    },
    saveEnrollment: async (enrollment) => {
      await client.query(
        `INSERT INTO onetime.class_series_enrollments
           (enrollment_key, account_key, product_key, class_series_key, learner_key,
            household_key, enrollment_state, source, effective_at, revoked_at,
            idempotency_key, audit_ref, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (account_key, product_key, class_series_key, learner_key)
         DO UPDATE SET
           household_key = EXCLUDED.household_key,
           enrollment_state = EXCLUDED.enrollment_state,
           source = EXCLUDED.source,
           effective_at = EXCLUDED.effective_at,
           revoked_at = EXCLUDED.revoked_at,
           idempotency_key = EXCLUDED.idempotency_key,
           audit_ref = EXCLUDED.audit_ref,
           version = EXCLUDED.version`,
        [
          enrollment.id,
          enrollment.accountKey,
          enrollment.productKey,
          enrollment.seriesId,
          enrollment.studentId,
          enrollment.householdId,
          enrollment.state,
          enrollment.source,
          enrollment.effectiveAt,
          enrollment.revokedAt ?? null,
          enrollment.idempotencyKey,
          enrollment.auditRef,
          enrollment.version,
        ],
      );
    },
    getReceipt: async (scope, idempotencyKey) => {
      const result = await client.query(
        `SELECT *
           FROM onetime.classroom_core_commands
          WHERE account_key = $1 AND product_key = $2 AND idempotency_key = $3
          FOR UPDATE`,
        [scope.accountKey, scope.productKey, idempotencyKey],
      );
      return result.rows[0] ? mapReceipt(result.rows[0] as Record<string, unknown>) : null;
    },
    saveReceipt: async (receipt) => {
      await client.query(
        `INSERT INTO onetime.classroom_core_commands
           (account_key, product_key, idempotency_key, request_hash, operation,
            result_version, committed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (account_key, product_key, idempotency_key) DO NOTHING`,
        [
          receipt.accountKey,
          receipt.productKey,
          receipt.idempotencyKey,
          receipt.requestHash,
          receipt.operation,
          receipt.resultVersion,
          receipt.committedAt,
        ],
      );
    },
  };
}

function mapSeries(row: Record<string, unknown>): ClassSeriesRecord {
  return {
    ...scope(row),
    id: String(row.class_series_key),
    title: String(row.title),
    state: String(row.series_state) as ClassSeriesRecord['state'],
    canonical: Boolean(row.is_canonical),
    timeZone: String(row.timezone),
    localStartTime: String(row.local_start_time).slice(0, 5),
    durationMinutes: Number(row.duration_minutes),
    weekdays: classWeekdaysFromPersistence(row.recurrence_weekdays),
    startsOn: dateOnly(row.recurrence_starts_on),
    ...(row.recurrence_ends_on ? { endsOn: dateOnly(row.recurrence_ends_on) } : {}),
    teacherProfileId: String(row.teacher_profile_key),
    embeddedClassroomRequired: Boolean(row.embedded_classroom_required),
    recordingEnabled: Boolean(row.recording_enabled),
    version: Number(row.version),
    createdAt: instant(row.created_at),
    updatedAt: instant(row.updated_at),
  };
}

function mapOccurrence(row: Record<string, unknown>): ClassOccurrenceRecord {
  return {
    ...scope(row),
    id: String(row.occurrence_key),
    seriesId: String(row.class_series_key),
    localClassDate: dateOnly(row.local_class_date),
    startsAt: instant(row.starts_at),
    scheduledEndsAt: instant(row.scheduled_ends_at),
    joinOpensAt: instant(row.join_opens_at),
    joinClosesAt: instant(row.join_closes_at),
    state: String(row.occurrence_state) as ClassOccurrenceRecord['state'],
    scheduleVersion: Number(row.schedule_version),
    version: Number(row.version),
    createdAt: instant(row.created_at),
    updatedAt: instant(row.updated_at),
  };
}

function mapStudent(row: Record<string, unknown>): StudentEligibilityRecord {
  return {
    ...scope(row),
    studentId: String(row.learner_key),
    householdId: String(row.household_key),
    state: row.learner_status === 'active' ? 'active' : 'archived',
    version: Number(row.version),
  };
}

function mapEnrollment(row: Record<string, unknown>): SeriesEnrollmentRecord {
  return {
    ...scope(row),
    id: String(row.enrollment_key),
    seriesId: String(row.class_series_key),
    studentId: String(row.learner_key),
    householdId: String(row.household_key),
    state: String(row.enrollment_state) as SeriesEnrollmentRecord['state'],
    source: String(row.source) as SeriesEnrollmentRecord['source'],
    effectiveAt: instant(row.effective_at),
    ...(row.revoked_at ? { revokedAt: instant(row.revoked_at) } : {}),
    idempotencyKey: String(row.idempotency_key),
    auditRef: String(row.audit_ref),
    version: Number(row.version),
  };
}

function mapReceipt(row: Record<string, unknown>): ClassroomCommandReceipt {
  return {
    ...scope(row),
    idempotencyKey: String(row.idempotency_key),
    requestHash: String(row.request_hash),
    operation: String(row.operation),
    resultVersion: Number(row.result_version),
    committedAt: instant(row.committed_at),
  };
}

function scope(row: Record<string, unknown>): ClassroomScope {
  return { accountKey: String(row.account_key), productKey: String(row.product_key) };
}

function dateOnly(value: unknown) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function instant(value: unknown) {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

function classReminderLocalTime(localStartTime: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(localStartTime);
  if (!match) {
    throw new Error('Class series local start time must be a valid HH:mm value.');
  }
  const localStartMinutes = Number(match[1]) * 60 + Number(match[2]);
  const reminderMinutes = (localStartMinutes - CLASS_REMINDER_MINUTES_BEFORE + 24 * 60) % (24 * 60);
  return `${String(Math.floor(reminderMinutes / 60)).padStart(2, '0')}:${String(
    reminderMinutes % 60,
  ).padStart(2, '0')}`;
}

function classWeekdaysForPersistence(value: unknown) {
  return validClassWeekdays(value, 0, 6, 'Class series weekdays').map((weekday) =>
    weekday === 0 ? 7 : weekday,
  );
}

function classWeekdaysFromPersistence(value: unknown) {
  return validClassWeekdays(value, 1, 7, 'Persisted class series weekdays').map((weekday) =>
    weekday === 7 ? 0 : weekday,
  );
}

function validClassWeekdays(value: unknown, minimum: number, maximum: number, field: string) {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array.`);
  }
  if (value.length === 0) {
    throw new Error(`${field} must contain at least one weekday.`);
  }
  if (
    !value.every(
      (weekday): weekday is number =>
        Number.isInteger(weekday) && weekday >= minimum && weekday <= maximum,
    )
  ) {
    throw new Error(`${field} must contain only integers from ${minimum} through ${maximum}.`);
  }
  if (new Set(value).size !== value.length) {
    throw new Error(`${field} must not contain duplicate weekdays.`);
  }
  return value;
}

function occurrencePersistenceTiming(
  occurrence: Pick<
    ClassOccurrenceRecord,
    'startsAt' | 'scheduledEndsAt' | 'joinOpensAt' | 'joinClosesAt'
  >,
) {
  const startsAt = validInstant(occurrence.startsAt, 'startsAt');
  const scheduledEndsAt = validInstant(occurrence.scheduledEndsAt, 'scheduledEndsAt');
  const joinOpensAt = validInstant(occurrence.joinOpensAt, 'joinOpensAt');
  const joinClosesAt = validInstant(occurrence.joinClosesAt, 'joinClosesAt');
  if (scheduledEndsAt.getTime() <= startsAt.getTime()) {
    throw new Error('Class occurrence scheduled end must be after its start.');
  }
  if (joinOpensAt.getTime() >= startsAt.getTime()) {
    throw new Error('Class occurrence join window must open before its start.');
  }
  if (joinClosesAt.getTime() < scheduledEndsAt.getTime()) {
    throw new Error('Class occurrence join window must cover its scheduled end.');
  }
  return {
    reminderDueAt: new Date(
      startsAt.getTime() - CLASS_REMINDER_MINUTES_BEFORE * 60_000,
    ).toISOString(),
    joinableUntil: joinClosesAt.toISOString(),
  };
}

function validInstant(value: string, field: string) {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) {
    throw new Error(`Class occurrence ${field} must be a valid timestamp.`);
  }
  return parsed;
}
