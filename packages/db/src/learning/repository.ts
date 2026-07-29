import type {
  AnnouncementRead,
  AttendanceRecord,
  LeaderboardLearner,
  LearningAnnouncement,
  LearningEngagementRepository,
  LearningQuestion,
  LearningScope,
  RecognitionConsent,
  ReviewCompletion,
} from '../../../contracts/src/learning/index.ts';
import type { DbPool, Queryable } from '../index.ts';

export function createLearningEngagementRepository(pool: DbPool): LearningEngagementRepository {
  return createUnit(pool);
}

function createUnit(db: Queryable): LearningEngagementRepository {
  return {
    getQuestion: async (scope, questionId) => {
      const result = await db.query(
        `SELECT *
           FROM onetime.learning_questions
          WHERE account_key = $1 AND product_key = $2 AND question_key = $3`,
        [scope.accountKey, scope.productKey, questionId],
      );
      return result.rows[0] ? mapQuestion(result.rows[0] as Record<string, unknown>) : null;
    },
    saveQuestion: async (question) => {
      const values = questionValues(question);
      if (question.version === 1) {
        const inserted = await db.query(
          `INSERT INTO onetime.learning_questions
             (account_key, product_key, question_key, learner_key, household_key, class_key,
              private_body, private_answer, question_state, recognition_eligible,
              recognition_occurred_at, recognition_correction_reason, version, submitted_at,
              updated_at, transitions_json)
           VALUES
             ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
           ON CONFLICT DO NOTHING`,
          values,
        );
        if (inserted.rowCount !== 1) throw new Error('learning_question_create_conflict');
        return;
      }
      const updated = await db.query(
        `UPDATE onetime.learning_questions
            SET private_answer = $8, question_state = $9, recognition_eligible = $10,
                recognition_occurred_at = $11, recognition_correction_reason = $12,
                version = $13, updated_at = $15, transitions_json = $16::jsonb
          WHERE account_key = $1 AND product_key = $2 AND question_key = $3
            AND version = $17`,
        [...values, question.version - 1],
      );
      if (updated.rowCount !== 1) throw new Error('learning_question_stale_version');
    },
    listQuestions: async (scope) => {
      const result = await db.query(
        `SELECT *
           FROM onetime.learning_questions
          WHERE account_key = $1 AND product_key = $2
          ORDER BY submitted_at DESC, question_key`,
        [scope.accountKey, scope.productKey],
      );
      return result.rows.map((row) => mapQuestion(row as Record<string, unknown>));
    },
    saveAnnouncement: async (announcement) => {
      await db.query(
        `INSERT INTO onetime.learning_announcements
           (account_key, product_key, announcement_key, title, body, audience_kind,
            audience_key, published_by, published_at, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          announcement.accountKey,
          announcement.productKey,
          announcement.id,
          announcement.title,
          announcement.body,
          announcement.audience.kind,
          audienceKey(announcement),
          announcement.publishedBy,
          announcement.publishedAt,
          announcement.expiresAt,
        ],
      );
    },
    listAnnouncements: async (scope) => {
      const result = await db.query(
        `SELECT *
           FROM onetime.learning_announcements
          WHERE account_key = $1 AND product_key = $2
          ORDER BY published_at DESC, announcement_key`,
        [scope.accountKey, scope.productKey],
      );
      return result.rows.map((row) => mapAnnouncement(row as Record<string, unknown>));
    },
    saveAnnouncementRead: async (read) => {
      await db.query(
        `INSERT INTO onetime.learning_announcement_reads
           (account_key, product_key, announcement_key, principal_key, read_at)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (account_key, product_key, announcement_key, principal_key)
         DO NOTHING`,
        [read.accountKey, read.productKey, read.announcementId, read.principalId, read.readAt],
      );
    },
    listAnnouncementReads: async (scope, principalId) => {
      const result = await db.query(
        `SELECT *
           FROM onetime.learning_announcement_reads
          WHERE account_key = $1 AND product_key = $2 AND principal_key = $3`,
        [scope.accountKey, scope.productKey, principalId],
      );
      return result.rows.map((row) => mapAnnouncementRead(row as Record<string, unknown>));
    },
    getAttendance: async (scope, occurrenceId, studentId) => {
      const result = await db.query(
        `SELECT *
           FROM onetime.learning_attendance
          WHERE account_key = $1 AND product_key = $2
            AND occurrence_key = $3 AND learner_key = $4`,
        [scope.accountKey, scope.productKey, occurrenceId, studentId],
      );
      return result.rows[0] ? mapAttendance(result.rows[0] as Record<string, unknown>) : null;
    },
    saveAttendance: async (record) => {
      await db.query(
        `INSERT INTO onetime.learning_attendance
           (account_key, product_key, occurrence_key, class_key, learner_key, household_key,
            segment_keys, minutes, present, occurred_at, corrected_at, correction_reason,
            corrected_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7::text[],$8,$9,$10,$11,$12,$13)
         ON CONFLICT (account_key, product_key, occurrence_key, learner_key)
         DO UPDATE SET
           segment_keys = EXCLUDED.segment_keys, minutes = EXCLUDED.minutes,
           present = EXCLUDED.present, corrected_at = EXCLUDED.corrected_at,
           correction_reason = EXCLUDED.correction_reason, corrected_by = EXCLUDED.corrected_by`,
        [
          record.accountKey,
          record.productKey,
          record.occurrenceId,
          record.classId,
          record.studentId,
          record.householdId,
          record.segmentIds,
          record.minutes,
          record.present,
          record.occurredAt,
          record.correctedAt,
          record.correctionReason,
          record.correctedBy,
        ],
      );
    },
    listAttendance: async (scope) => {
      const result = await db.query(
        `SELECT *
           FROM onetime.learning_attendance
          WHERE account_key = $1 AND product_key = $2
          ORDER BY occurred_at DESC, occurrence_key, learner_key`,
        [scope.accountKey, scope.productKey],
      );
      return result.rows.map((row) => mapAttendance(row as Record<string, unknown>));
    },
    listReviewCompletions: async (scope) => {
      const result = await db.query(
        `SELECT *
           FROM onetime.learning_review_completions
          WHERE account_key = $1 AND product_key = $2`,
        [scope.accountKey, scope.productKey],
      );
      return result.rows.map((row) => mapReview(row as Record<string, unknown>));
    },
    listRecognitionConsents: async (scope) => {
      const result = await db.query(
        `SELECT *
           FROM onetime.learning_recognition_consents
          WHERE account_key = $1 AND product_key = $2`,
        [scope.accountKey, scope.productKey],
      );
      return result.rows.map((row) => mapConsent(row as Record<string, unknown>));
    },
    listLeaderboardLearners: async (scope, classId) => {
      const result = await db.query(
        `SELECT *
           FROM onetime.learning_leaderboard_learners
          WHERE account_key = $1 AND product_key = $2 AND class_key = $3`,
        [scope.accountKey, scope.productKey, classId],
      );
      return result.rows.map((row) => mapLearner(row as Record<string, unknown>));
    },
  };
}

function questionValues(question: LearningQuestion) {
  return [
    question.accountKey,
    question.productKey,
    question.id,
    question.studentId,
    question.householdId,
    question.classId,
    question.body,
    question.answer,
    question.state,
    question.recognitionEligible,
    question.recognitionOccurredAt,
    question.recognitionCorrectionReason,
    question.version,
    question.submittedAt,
    question.updatedAt,
    JSON.stringify(question.transitions),
  ];
}

function mapQuestion(row: Record<string, unknown>): LearningQuestion {
  return {
    ...scope(row),
    id: String(row.question_key),
    studentId: String(row.learner_key),
    householdId: String(row.household_key),
    classId: String(row.class_key),
    body: String(row.private_body),
    answer: nullableString(row.private_answer),
    state: row.question_state as LearningQuestion['state'],
    recognitionEligible: Boolean(row.recognition_eligible),
    recognitionOccurredAt: nullableInstant(row.recognition_occurred_at),
    recognitionCorrectionReason: nullableString(row.recognition_correction_reason),
    version: Number(row.version),
    submittedAt: instant(row.submitted_at),
    updatedAt: instant(row.updated_at),
    transitions: (row.transitions_json as LearningQuestion['transitions']) ?? [],
  };
}

function mapAnnouncement(row: Record<string, unknown>): LearningAnnouncement {
  const kind = row.audience_kind as LearningAnnouncement['audience']['kind'];
  const key = String(row.audience_key ?? '');
  const audience: LearningAnnouncement['audience'] =
    kind === 'program'
      ? { kind }
      : kind === 'class'
        ? { kind, classId: key }
        : kind === 'parent'
          ? { kind, householdId: key }
          : { kind: 'student', studentId: key };
  return {
    ...scope(row),
    id: String(row.announcement_key),
    title: String(row.title),
    body: String(row.body),
    audience,
    publishedBy: String(row.published_by),
    publishedAt: instant(row.published_at),
    expiresAt: nullableInstant(row.expires_at),
  };
}

function mapAnnouncementRead(row: Record<string, unknown>): AnnouncementRead {
  return {
    ...scope(row),
    announcementId: String(row.announcement_key),
    principalId: String(row.principal_key),
    readAt: instant(row.read_at),
  };
}

function mapAttendance(row: Record<string, unknown>): AttendanceRecord {
  return {
    ...scope(row),
    occurrenceId: String(row.occurrence_key),
    classId: String(row.class_key),
    studentId: String(row.learner_key),
    householdId: String(row.household_key),
    segmentIds: (row.segment_keys as string[]) ?? [],
    minutes: Number(row.minutes),
    present: Boolean(row.present),
    occurredAt: instant(row.occurred_at),
    correctedAt: nullableInstant(row.corrected_at),
    correctionReason: nullableString(row.correction_reason),
    correctedBy: nullableString(row.corrected_by),
  };
}

function mapReview(row: Record<string, unknown>): ReviewCompletion {
  return {
    ...scope(row),
    reviewItemId: String(row.review_item_key),
    classId: String(row.class_key),
    studentId: String(row.learner_key),
    householdId: String(row.household_key),
    adminPublished: Boolean(row.admin_published),
    completedAt: instant(row.completed_at),
  };
}

function mapConsent(row: Record<string, unknown>): RecognitionConsent {
  return {
    ...scope(row),
    studentId: String(row.learner_key),
    optedIn: Boolean(row.opted_in),
    version: Number(row.version),
    changedAt: instant(row.changed_at),
    changedBy: String(row.changed_by),
  };
}

function mapLearner(row: Record<string, unknown>): LeaderboardLearner {
  return {
    ...scope(row),
    studentId: String(row.learner_key),
    householdId: String(row.household_key),
    classId: String(row.class_key),
    firstName: String(row.first_name),
    lastName: String(row.last_name),
    currentAttendanceStreak: Number(row.current_attendance_streak),
  };
}

function audienceKey(announcement: LearningAnnouncement) {
  if (announcement.audience.kind === 'program') return null;
  if (announcement.audience.kind === 'class') return announcement.audience.classId;
  if (announcement.audience.kind === 'parent') return announcement.audience.householdId;
  return announcement.audience.studentId;
}

function scope(row: Record<string, unknown>): LearningScope {
  return { accountKey: String(row.account_key), productKey: String(row.product_key) };
}

function instant(value: unknown) {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

function nullableInstant(value: unknown) {
  return value ? instant(value) : null;
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
