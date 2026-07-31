import type {
  AnnouncementRead,
  AttendanceRecord,
  CanonicalLearnerIdentity,
  CanonicalRecognitionConsent,
  LearningAnnouncement,
  LearningAttendanceReadPort,
  LearningEngagementRepository,
  LearningIdentityReadPort,
  LearningQuestion,
  LearningRecognitionConsentReadPort,
  LearningReviewItemReadPort,
  LearningScope,
  QuestionMutation,
  QuestionRecognitionLedgerEntry,
  QuestionTransitionLedgerEntry,
  ReviewCompletion,
  ScheduledOccurrenceCoverage,
} from '../../../contracts/src/learning/index.ts';
import { inTransaction, type DbPool, type Queryable } from '../index.ts';

export function createLearningEngagementRepository(pool: DbPool): LearningEngagementRepository {
  const reads = createUnit(pool);
  return {
    ...reads,
    applyQuestionMutation: (mutation) =>
      inTransaction(pool, (db) => applyQuestionMutation(db, mutation)),
    applyReviewCompletion: (completion) =>
      inTransaction(pool, (db) => applyReviewCompletion(db, completion)),
  };
}

export function createLearningCanonicalReadPorts(pool: DbPool): {
  attendance: LearningAttendanceReadPort;
  identity: LearningIdentityReadPort;
  consent: LearningRecognitionConsentReadPort;
  reviewItems: LearningReviewItemReadPort;
} {
  return {
    attendance: {
      listAttendance: async (scope) => {
        const result = await pool.query(
          `SELECT attendance.*, occurrence.account_key,
                  occurrence.class_series_key AS class_key,
                  occurrence.starts_at AS occurrence_starts_at,
                  enrollment.enrollment_key, enrollment.household_key,
                  student.product_key, student.runtime_tier,
                  student.verification_environment_id
             FROM onetime.classroom_attendance_projection_v21 AS attendance
             JOIN onetime.class_occurrences AS occurrence
               ON occurrence.occurrence_key = attendance.occurrence_id
              AND occurrence.product_key = attendance.product
             JOIN onetime.class_series_enrollments AS enrollment
               ON enrollment.account_key = occurrence.account_key
              AND enrollment.product_key = occurrence.product_key
              AND enrollment.class_series_key = occurrence.class_series_key
              AND enrollment.learner_key = attendance.student_id
              AND enrollment.enrollment_state = 'active'
              AND occurrence.starts_at >= enrollment.effective_at
              AND (
                enrollment.revoked_at IS NULL
                OR occurrence.starts_at < enrollment.revoked_at
              )
             JOIN onetime.v21_student_profiles AS student
               ON student.student_id = attendance.student_id
              AND student.household_id = enrollment.household_key
              AND student.product_key = attendance.product
              AND student.runtime_tier = attendance.runtime_tier
              AND student.verification_environment_id =
                  attendance.verification_environment_id
              AND student.state = 'active'
            WHERE occurrence.account_key = $1
              AND attendance.product = $2
              AND attendance.runtime_tier = $3
              AND attendance.verification_environment_id = $4
            ORDER BY attendance.updated_at DESC, attendance.occurrence_id,
                     attendance.student_id`,
          scopeValues(scope),
        );
        return result.rows.map((row) => mapAttendance(row as Record<string, unknown>));
      },
      listScheduledOccurrenceCoverage: async (scope, classId, windowStartsAt, windowEndsAt) => {
        const result = await pool.query(
          `SELECT occurrence.account_key, occurrence.product_key,
                  student.runtime_tier, student.verification_environment_id,
                  occurrence.occurrence_key, occurrence.class_series_key AS class_key,
                  occurrence.starts_at, enrollment.learner_key AS student_id,
                  enrollment.enrollment_key
             FROM onetime.class_occurrences AS occurrence
             JOIN onetime.class_series_enrollments AS enrollment
               ON enrollment.account_key = occurrence.account_key
              AND enrollment.product_key = occurrence.product_key
              AND enrollment.class_series_key = occurrence.class_series_key
              AND enrollment.enrollment_state = 'active'
              AND occurrence.starts_at >= enrollment.effective_at
              AND (
                enrollment.revoked_at IS NULL
                OR occurrence.starts_at < enrollment.revoked_at
              )
             JOIN onetime.v21_student_profiles AS student
               ON student.student_id = enrollment.learner_key
              AND student.household_id = enrollment.household_key
              AND student.product_key = occurrence.product_key
              AND student.runtime_tier = $3
              AND student.verification_environment_id = $4
              AND student.state = 'active'
            WHERE occurrence.account_key = $1 AND occurrence.product_key = $2
              AND occurrence.class_series_key = $5
              AND occurrence.occurrence_state = 'completed'
              AND occurrence.starts_at >= $6::timestamptz
              AND occurrence.starts_at <= $7::timestamptz
            ORDER BY occurrence.starts_at, occurrence.occurrence_key,
                     enrollment.learner_key`,
          [...scopeValues(scope), classId, windowStartsAt, windowEndsAt],
        );
        return result.rows.map((row) =>
          mapScheduledOccurrenceCoverage(row as Record<string, unknown>),
        );
      },
    },
    identity: {
      listLearners: async (scope, classId) => {
        const result = await pool.query(
          `SELECT enrollment.account_key, student.product_key, student.runtime_tier,
                  student.verification_environment_id, student.student_id,
                  student.household_id, enrollment.class_series_key AS class_key,
                  enrollment.enrollment_key, student.actual_name, student.display_name
             FROM onetime.class_series_enrollments AS enrollment
             JOIN onetime.v21_student_profiles AS student
               ON student.student_id = enrollment.learner_key
              AND student.household_id = enrollment.household_key
              AND student.product_key = enrollment.product_key
              AND student.runtime_tier = $3
              AND student.verification_environment_id = $4
              AND student.state = 'active'
            WHERE enrollment.account_key = $1 AND enrollment.product_key = $2
              AND enrollment.class_series_key = $5
              AND enrollment.enrollment_state = 'active'
            ORDER BY student.student_id`,
          [...scopeValues(scope), classId],
        );
        return result.rows.map((row) => mapIdentity(row as Record<string, unknown>));
      },
    },
    consent: {
      listRecognitionConsent: async (scope, classId) => {
        const result = await pool.query(
          `WITH current_subject AS (
             SELECT enrollment.account_key, student.product_key, student.runtime_tier,
                    student.verification_environment_id, student.student_id,
                    student.household_id, student.relationship, student.self_adult_id,
                    household.owner_adult_id
               FROM onetime.class_series_enrollments AS enrollment
               JOIN onetime.v21_student_profiles AS student
                 ON student.student_id = enrollment.learner_key
                AND student.household_id = enrollment.household_key
                AND student.product_key = enrollment.product_key
                AND student.runtime_tier = $3
                AND student.verification_environment_id = $4
                AND student.state = 'active'
               JOIN onetime.v21_households AS household
                 ON household.household_id = student.household_id
                AND household.runtime_tier = student.runtime_tier
                AND household.verification_environment_id =
                    student.verification_environment_id
                AND household.state = 'active'
              WHERE enrollment.account_key = $1
                AND enrollment.product_key = $2
                AND enrollment.class_series_key = $5
                AND enrollment.enrollment_state = 'active'
           ), current_terminal_consent AS (
             SELECT subject.*, consent.consent_event_id, consent.choice,
                    consent.occurred_at, consent.actor_kind, consent.actor_adult_id,
                    consent.relationship AS consent_relationship,
                    consent.parent_authority_attested,
                    ROW_NUMBER() OVER (
                      PARTITION BY subject.account_key, subject.product_key,
                                   subject.runtime_tier,
                                   subject.verification_environment_id,
                                   subject.student_id
                      ORDER BY consent.occurred_at DESC, consent.consent_event_id DESC
                    ) AS consent_rank
               FROM current_subject AS subject
               JOIN onetime.privacy_consent_event AS consent
                 ON consent.student_id = subject.student_id
                AND consent.household_id = subject.household_id
              WHERE consent.scope = 'member_recognition'
                AND NOT EXISTS (
                  SELECT 1
                    FROM onetime.privacy_consent_event AS successor
                   WHERE successor.supersedes_consent_event_id =
                         consent.consent_event_id
                )
           )
           SELECT account_key, product_key, runtime_tier,
                  verification_environment_id, consent_event_id, student_id,
                  choice, occurred_at
             FROM current_terminal_consent
            WHERE consent_rank = 1
              AND (
                (
                  relationship = 'dependent'
                  AND consent_relationship = 'dependent'
                  AND actor_kind = 'parent_account_owner'
                  AND parent_authority_attested = TRUE
                  AND actor_adult_id = owner_adult_id
                )
                OR
                (
                  relationship = 'self'
                  AND consent_relationship = 'self'
                  AND actor_kind = 'adult_self_student'
                  AND self_adult_id = owner_adult_id
                  AND actor_adult_id = self_adult_id
                )
              )
            ORDER BY occurred_at DESC, consent_event_id DESC`,
          [...scopeValues(scope), classId],
        );
        return result.rows.map((row) => mapConsent(row as Record<string, unknown>));
      },
    },
    reviewItems: {
      getAdminPublishedReviewItem: async (readScope, reviewItemId) => {
        const result = await pool.query(
          `SELECT $1::text AS account_key, $2::text AS product_key,
                  $3::text AS runtime_tier,
                  $4::text AS verification_environment_id,
                  item.content_item_key,
                  occurrence.class_series_key AS class_key,
                  item.published_revision_key
             FROM onetime.content_items AS item
             JOIN onetime.class_occurrences AS occurrence
               ON occurrence.account_key = item.account_key
              AND occurrence.product_key = item.product_key
              AND occurrence.occurrence_key = item.occurrence_key
            WHERE item.account_key = $1 AND item.product_key = $2
              AND item.content_item_key = $5
              AND item.item_type = 'review'
              AND item.lifecycle_state = 'published'
              AND item.retention_state = 'active'
              AND item.published_revision_key IS NOT NULL`,
          [...scopeValues(readScope), reviewItemId],
        );
        const row = result.rows[0] as Record<string, unknown> | undefined;
        return row
          ? {
              ...scope(row),
              reviewItemId: String(row.content_item_key),
              classId: String(row.class_key),
              publicationAuditRef: String(row.published_revision_key),
            }
          : null;
      },
    },
  };
}

function createUnit(
  db: Queryable,
): Omit<LearningEngagementRepository, 'applyQuestionMutation' | 'applyReviewCompletion'> {
  return {
    getQuestion: async (scope, questionId) => loadQuestion(db, scope, questionId),
    getQuestionHistory: async (scope, questionId) => ({
      transitions: await listTransitions(db, scope, questionId),
      recognitions: await listRecognitions(db, scope, questionId),
    }),
    listQuestions: async (scope) => {
      const result = await db.query(
        `SELECT * FROM onetime.learning_question_projection
          WHERE account_key = $1 AND product_key = $2
            AND runtime_tier = $3 AND verification_environment_id = $4
          ORDER BY submitted_at DESC, question_key`,
        scopeValues(scope),
      );
      return result.rows.map((row) => mapQuestion(row as Record<string, unknown>));
    },
    listQuestionTransitions: (scope) => listTransitions(db, scope),
    listQuestionRecognitions: (scope) => listRecognitions(db, scope),
    saveAnnouncement: async (announcement) => {
      await db.query(
        `INSERT INTO onetime.learning_announcements
           (account_key, product_key, runtime_tier, verification_environment_id,
            announcement_key, title, body, audience_kind, audience_key,
            audience_class_key, published_by, published_at, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          ...scopeValues(announcement),
          announcement.id,
          announcement.title,
          announcement.body,
          announcement.audience.kind,
          audienceKey(announcement),
          audienceClassId(announcement),
          announcement.publishedBy,
          announcement.publishedAt,
          announcement.expiresAt,
        ],
      );
    },
    listAnnouncements: async (scope) => {
      const result = await db.query(
        `SELECT * FROM onetime.learning_announcements
          WHERE account_key = $1 AND product_key = $2
            AND runtime_tier = $3 AND verification_environment_id = $4
          ORDER BY published_at DESC, announcement_key`,
        scopeValues(scope),
      );
      return result.rows.map((row) => mapAnnouncement(row as Record<string, unknown>));
    },
    saveAnnouncementRead: async (read) => {
      await db.query(
        `INSERT INTO onetime.learning_announcement_reads
           (account_key, product_key, runtime_tier, verification_environment_id,
            announcement_key, principal_key, read_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (account_key, product_key, runtime_tier,
                      verification_environment_id, announcement_key, principal_key)
         DO NOTHING`,
        [...scopeValues(read), read.announcementId, read.principalId, read.readAt],
      );
    },
    listAnnouncementReads: async (scope, principalId) => {
      const result = await db.query(
        `SELECT * FROM onetime.learning_announcement_reads
          WHERE account_key = $1 AND product_key = $2
            AND runtime_tier = $3 AND verification_environment_id = $4
            AND principal_key = $5`,
        [...scopeValues(scope), principalId],
      );
      return result.rows.map((row) => mapAnnouncementRead(row as Record<string, unknown>));
    },
    listReviewCompletions: async (scope) => {
      const result = await db.query(
        `SELECT * FROM (
           SELECT event.*,
                  ROW_NUMBER() OVER (
                    PARTITION BY account_key, product_key, runtime_tier,
                                 verification_environment_id, review_item_key, learner_key
                    ORDER BY event_sequence DESC
                  ) AS event_rank
             FROM onetime.learning_review_completions AS event
            WHERE account_key = $1 AND product_key = $2
              AND runtime_tier = $3 AND verification_environment_id = $4
         ) AS latest
         WHERE event_rank = 1 AND event_action IN ('completed', 'restored')`,
        scopeValues(scope),
      );
      return result.rows.map((row) => mapReview(row as Record<string, unknown>));
    },
    listReviewCompletionEvents: async (scope, reviewItemId, studentId) => {
      const result = await db.query(
        `SELECT * FROM onetime.learning_review_completions
          WHERE account_key = $1 AND product_key = $2
            AND runtime_tier = $3 AND verification_environment_id = $4
            AND review_item_key = $5 AND learner_key = $6
          ORDER BY event_sequence`,
        [...scopeValues(scope), reviewItemId, studentId],
      );
      return result.rows.map((row) => mapReview(row as Record<string, unknown>));
    },
  };
}

async function applyReviewCompletion(
  db: Queryable,
  completion: ReviewCompletion,
): Promise<{ completion: ReviewCompletion; replay: boolean }> {
  await db.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [
    scopedIdempotencyLockKey(
      completion,
      `review-aggregate:${completion.reviewItemId}:${completion.studentId}`,
    ),
  ]);
  const prior = await db.query(
    `SELECT * FROM onetime.learning_review_completions
      WHERE account_key = $1 AND product_key = $2
        AND runtime_tier = $3 AND verification_environment_id = $4
        AND idempotency_key = $5`,
    [...scopeValues(completion), completion.idempotencyKey],
  );
  const row = prior.rows[0] as Record<string, unknown> | undefined;
  if (row) {
    if (String(row.request_hash) !== completion.requestHash) {
      throw new Error('learning_idempotency_conflict');
    }
    return { completion: mapReview(row), replay: true };
  }
  const latest = await db.query(
    `SELECT COALESCE(MAX(event_sequence), 0)::int AS max_sequence
       FROM onetime.learning_review_completions
      WHERE account_key = $1 AND product_key = $2
        AND runtime_tier = $3 AND verification_environment_id = $4
        AND review_item_key = $5 AND learner_key = $6`,
    [...scopeValues(completion), completion.reviewItemId, completion.studentId],
  );
  const expectedSequence =
    Number((latest.rows[0] as Record<string, unknown> | undefined)?.max_sequence ?? 0) + 1;
  if (completion.sequence !== expectedSequence) {
    throw new Error('learning_review_completion_stale_sequence');
  }
  const inserted = await db.query(
    `INSERT INTO onetime.learning_review_completions
       (account_key, product_key, runtime_tier, verification_environment_id,
        review_item_key, class_key, learner_key, household_key, admin_published,
        event_action, event_sequence, idempotency_key, request_hash, completed_by,
        completion_source, reason, audit_ref, publication_audit_ref, completed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     ON CONFLICT DO NOTHING`,
    [
      ...scopeValues(completion),
      completion.reviewItemId,
      completion.classId,
      completion.studentId,
      completion.householdId,
      completion.adminPublished,
      completion.action,
      completion.sequence,
      completion.idempotencyKey,
      completion.requestHash,
      completion.completedBy,
      completion.source,
      completion.reason,
      completion.auditRef,
      completion.publicationAuditRef,
      completion.completedAt,
    ],
  );
  if (inserted.rowCount !== 1) throw new Error('learning_review_completion_conflict');
  return { completion, replay: false };
}

async function applyQuestionMutation(
  db: Queryable,
  mutation: QuestionMutation,
): Promise<{ question: LearningQuestion; replay: boolean }> {
  const scope = mutation.projection;
  await db.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [
    scopedIdempotencyLockKey(scope, mutation.transition.idempotencyKey),
  ]);
  const replay = await db.query(
    `SELECT request_hash FROM onetime.learning_question_transition_ledger
      WHERE account_key = $1 AND product_key = $2
        AND runtime_tier = $3 AND verification_environment_id = $4
        AND idempotency_key = $5`,
    [...scopeValues(scope), mutation.transition.idempotencyKey],
  );
  const prior = replay.rows[0] as Record<string, unknown> | undefined;
  if (prior) {
    if (String(prior.request_hash) !== mutation.transition.requestHash) {
      throw new Error('learning_idempotency_conflict');
    }
    const question = await loadQuestion(db, scope, scope.id);
    if (!question) throw new Error('learning_question_replay_missing');
    return { question, replay: true };
  }

  if (mutation.expectedVersion === 0) {
    const inserted = await db.query(
      `INSERT INTO onetime.learning_question_projection
         (account_key, product_key, runtime_tier, verification_environment_id,
          question_key, learner_key, household_key, class_key, private_body,
          private_answer, question_state, version, submitted_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT DO NOTHING`,
      questionValues(mutation.projection),
    );
    if (inserted.rowCount !== 1) throw new Error('learning_question_create_conflict');
  } else {
    const updated = await db.query(
      `UPDATE onetime.learning_question_projection
          SET private_answer = $10, question_state = $11, version = $12, updated_at = $14
        WHERE account_key = $1 AND product_key = $2
          AND runtime_tier = $3 AND verification_environment_id = $4
          AND question_key = $5 AND version = $15`,
      [...questionValues(mutation.projection), mutation.expectedVersion],
    );
    if (updated.rowCount !== 1) throw new Error('learning_question_stale_version');
  }

  await db.query(
    `INSERT INTO onetime.learning_question_transition_ledger
       (account_key, product_key, runtime_tier, verification_environment_id,
        question_key, idempotency_key, request_hash, actor_key, from_state,
        to_state, reason, occurred_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    transitionValues(mutation.transition),
  );
  if (mutation.recognition) {
    await db.query(
      `INSERT INTO onetime.learning_question_recognition_ledger
       (account_key, product_key, runtime_tier, verification_environment_id,
          question_key, recognition_sequence, idempotency_key, request_hash,
          actor_key, action, eligible, reason, occurred_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      recognitionValues(mutation.recognition),
    );
  }
  return { question: mutation.projection, replay: false };
}

async function loadQuestion(db: Queryable, scope: LearningScope, questionId: string) {
  const result = await db.query(
    `SELECT * FROM onetime.learning_question_projection
      WHERE account_key = $1 AND product_key = $2
        AND runtime_tier = $3 AND verification_environment_id = $4
        AND question_key = $5`,
    [...scopeValues(scope), questionId],
  );
  return result.rows[0] ? mapQuestion(result.rows[0] as Record<string, unknown>) : null;
}

async function listTransitions(db: Queryable, scope: LearningScope, questionId?: string) {
  const result = await db.query(
    `SELECT * FROM onetime.learning_question_transition_ledger
      WHERE account_key = $1 AND product_key = $2
        AND runtime_tier = $3 AND verification_environment_id = $4
        ${questionId ? 'AND question_key = $5' : ''}
      ORDER BY occurred_at, transition_event_id`,
    questionId ? [...scopeValues(scope), questionId] : scopeValues(scope),
  );
  return result.rows.map((row) => mapTransition(row as Record<string, unknown>));
}

async function listRecognitions(db: Queryable, scope: LearningScope, questionId?: string) {
  const result = await db.query(
    `SELECT * FROM onetime.learning_question_recognition_ledger
      WHERE account_key = $1 AND product_key = $2
        AND runtime_tier = $3 AND verification_environment_id = $4
        ${questionId ? 'AND question_key = $5' : ''}
      ORDER BY occurred_at, recognition_event_id`,
    questionId ? [...scopeValues(scope), questionId] : scopeValues(scope),
  );
  return result.rows.map((row) => mapRecognition(row as Record<string, unknown>));
}

function scopeValues(scope: LearningScope) {
  return [scope.accountKey, scope.productKey, scope.runtimeTier, scope.verificationEnvironmentId];
}

function scopedIdempotencyLockKey(scope: LearningScope, idempotencyKey: string) {
  return [
    'p22-question-idempotency',
    scope.accountKey,
    scope.productKey,
    scope.runtimeTier,
    scope.verificationEnvironmentId,
    idempotencyKey,
  ]
    .map((value) => `${Buffer.byteLength(value, 'utf8')}:${value}`)
    .join('|');
}

function questionValues(question: LearningQuestion) {
  return [
    ...scopeValues(question),
    question.id,
    question.studentId,
    question.householdId,
    question.classId,
    question.body,
    question.answer,
    question.state,
    question.version,
    question.submittedAt,
    question.updatedAt,
  ];
}

function transitionValues(entry: QuestionTransitionLedgerEntry) {
  return [
    ...scopeValues(entry),
    entry.questionId,
    entry.idempotencyKey,
    entry.requestHash,
    entry.actorId,
    entry.from,
    entry.to,
    entry.reason,
    entry.occurredAt,
  ];
}

function recognitionValues(entry: QuestionRecognitionLedgerEntry) {
  return [
    ...scopeValues(entry),
    entry.questionId,
    entry.sequence,
    entry.idempotencyKey,
    entry.requestHash,
    entry.actorId,
    entry.action,
    entry.eligible,
    entry.reason,
    entry.occurredAt,
  ];
}

function mapQuestion(row: Record<string, unknown>): LearningQuestion {
  const state = row.question_state;
  if (
    state !== 'submitted' &&
    state !== 'answered_private' &&
    state !== 'approved_for_class' &&
    state !== 'published' &&
    state !== 'closed' &&
    state !== 'declined'
  ) {
    throw new Error('learning_unknown_question_state');
  }
  return {
    ...scope(row),
    id: String(row.question_key),
    studentId: String(row.learner_key),
    householdId: String(row.household_key),
    classId: String(row.class_key),
    body: String(row.private_body),
    answer: nullableString(row.private_answer),
    state,
    version: Number(row.version),
    submittedAt: instant(row.submitted_at),
    updatedAt: instant(row.updated_at),
  };
}

function mapTransition(row: Record<string, unknown>): QuestionTransitionLedgerEntry {
  return {
    ...scope(row),
    questionId: String(row.question_key),
    idempotencyKey: String(row.idempotency_key),
    requestHash: String(row.request_hash),
    actorId: String(row.actor_key),
    from:
      row.from_state === null ? null : (row.from_state as QuestionTransitionLedgerEntry['from']),
    to: row.to_state as QuestionTransitionLedgerEntry['to'],
    reason: nullableString(row.reason),
    occurredAt: instant(row.occurred_at),
  };
}

function mapRecognition(row: Record<string, unknown>): QuestionRecognitionLedgerEntry {
  return {
    ...scope(row),
    questionId: String(row.question_key),
    sequence: Number(row.recognition_sequence),
    idempotencyKey: String(row.idempotency_key),
    requestHash: String(row.request_hash),
    actorId: String(row.actor_key),
    action: row.action as QuestionRecognitionLedgerEntry['action'],
    eligible: Boolean(row.eligible),
    reason: nullableString(row.reason),
    occurredAt: instant(row.occurred_at),
  };
}

function mapAnnouncement(row: Record<string, unknown>): LearningAnnouncement {
  const kind = row.audience_kind;
  const key = String(row.audience_key ?? '');
  const classId = String(row.audience_class_key ?? '');
  const audience =
    kind === 'program'
      ? ({ kind: 'program' } as const)
      : kind === 'class'
        ? ({ kind: 'class', classId: key } as const)
        : kind === 'parent'
          ? ({ kind: 'parent', classId, householdId: key } as const)
          : kind === 'student'
            ? ({ kind: 'student', classId, studentId: key } as const)
            : null;
  if (!audience) throw new Error('learning_unknown_announcement_audience');
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

function mapReview(row: Record<string, unknown>): ReviewCompletion {
  return {
    ...scope(row),
    reviewItemId: String(row.review_item_key),
    classId: String(row.class_key),
    studentId: String(row.learner_key),
    householdId: String(row.household_key),
    adminPublished: Boolean(row.admin_published),
    action: row.event_action as ReviewCompletion['action'],
    sequence: Number(row.event_sequence),
    idempotencyKey: String(row.idempotency_key),
    requestHash: String(row.request_hash),
    completedBy: String(row.completed_by),
    source: row.completion_source as ReviewCompletion['source'],
    reason: nullableString(row.reason),
    auditRef: String(row.audit_ref),
    publicationAuditRef: String(row.publication_audit_ref),
    completedAt: instant(row.completed_at),
  };
}

function mapScheduledOccurrenceCoverage(row: Record<string, unknown>): ScheduledOccurrenceCoverage {
  return {
    ...scope(row),
    occurrenceId: String(row.occurrence_key),
    classId: String(row.class_key),
    studentId: String(row.student_id),
    enrollmentId: String(row.enrollment_key),
    identityBindingVerified: true,
    occurredAt: instant(row.starts_at),
  };
}

function mapAttendance(row: Record<string, unknown>): AttendanceRecord {
  return {
    ...scope(row),
    occurrenceId: String(row.occurrence_id),
    classId: String(row.class_key),
    studentId: String(row.student_id),
    householdId: String(row.household_key),
    enrollmentId: String(row.enrollment_key),
    identityBindingVerified: true,
    segmentIds: [],
    minutes: Number(row.total_connected_minutes),
    present: Number(row.total_connected_minutes) > 0,
    occurredAt: instant(row.occurrence_starts_at),
    correctedAt: row.reconciliation_state === 'admin_corrected' ? instant(row.updated_at) : null,
    correctionReason: nullableString(row.manual_correction_reason),
    correctedBy: nullableString(row.correction_admin_id),
  };
}

function mapIdentity(row: Record<string, unknown>): CanonicalLearnerIdentity {
  return {
    ...scope(row),
    studentId: String(row.student_id),
    householdId: String(row.household_id),
    classId: String(row.class_key),
    enrollmentId: String(row.enrollment_key),
    actualName: String(row.actual_name),
    displayName: nullableString(row.display_name),
  };
}

function mapConsent(row: Record<string, unknown>): CanonicalRecognitionConsent {
  const choice = row.choice;
  if (choice !== 'granted' && choice !== 'declined' && choice !== 'withdrawn') {
    throw new Error('learning_unknown_recognition_consent_state');
  }
  return {
    ...scope(row),
    consentEventId: String(row.consent_event_id),
    studentId: String(row.student_id),
    choice,
    occurredAt: instant(row.occurred_at),
  };
}

function audienceKey(announcement: LearningAnnouncement) {
  if (announcement.audience.kind === 'program') return null;
  if (announcement.audience.kind === 'class') return announcement.audience.classId;
  if (announcement.audience.kind === 'parent') return announcement.audience.householdId;
  return announcement.audience.studentId;
}

function audienceClassId(announcement: LearningAnnouncement) {
  return announcement.audience.kind === 'program' ? null : announcement.audience.classId;
}

function scope(row: Record<string, unknown>): LearningScope {
  return {
    accountKey: String(row.account_key),
    productKey: String(row.product_key ?? row.product),
    runtimeTier: String(row.runtime_tier),
    verificationEnvironmentId: String(row.verification_environment_id),
  };
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
