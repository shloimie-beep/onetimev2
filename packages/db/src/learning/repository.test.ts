import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { QuestionMutation } from '../../../contracts/src/learning/index.ts';
import { createLearningEngagementRepository } from './repository.ts';

const source = readFileSync(new URL('./repository.ts', import.meta.url), 'utf8');
const recognitionFactQuery = source.slice(
  source.indexOf('listQuestionRecognitionFacts: async'),
  source.indexOf('listQuestionTransitions:'),
);
const scope = {
  accountKey: 'account-1',
  productKey: 'one_time_mishnayos',
  runtimeTier: 'isolated_staging',
  verificationEnvironmentId: 'ci',
};
const mutation: QuestionMutation = {
  expectedVersion: 1,
  projection: {
    ...scope,
    id: 'question-1',
    studentId: 'student-1',
    householdId: 'household-1',
    classId: 'class-a',
    body: 'Question',
    answer: 'Answer',
    state: 'answered_private',
    version: 2,
    submittedAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-02T10:00:00.000Z',
  },
  transition: {
    ...scope,
    eventId: 'answer-1:transition',
    questionId: 'question-1',
    studentId: 'student-1',
    householdId: 'household-1',
    classId: 'class-a',
    idempotencyKey: 'answer-1',
    requestHash: 'hash-answer-1',
    actorId: 'admin-1',
    source: 'admin_transition',
    auditRef: 'audit-answer-1',
    from: 'submitted',
    to: 'answered_private',
    reason: null,
    occurredAt: '2026-07-02T10:00:00.000Z',
  },
  recognition: {
    ...scope,
    eventId: 'answer-1:recognition',
    questionId: 'question-1',
    studentId: 'student-1',
    householdId: 'household-1',
    classId: 'class-a',
    sequence: 1,
    idempotencyKey: 'answer-1',
    requestHash: 'hash-answer-1',
    actorId: 'admin-1',
    source: 'admin_transition',
    auditRef: 'audit-answer-1',
    action: 'qualified',
    eligible: true,
    reason: null,
    occurredAt: '2026-07-02T10:00:00.000Z',
  },
};

function pool(
  responses: ((sql: string) => { rows: Record<string, unknown>[]; rowCount: number })[],
) {
  const sql: string[] = [];
  let index = 0;
  const client = {
    query: async (text: string) => {
      sql.push(text.trim());
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
        return { rows: [], rowCount: null };
      }
      return responses[index++]?.(text) ?? { rows: [], rowCount: 1 };
    },
    release: () => undefined,
  };
  return {
    sql,
    value: {
      connect: async () => client,
      query: client.query,
      end: async () => undefined,
    },
  };
}

describe('P22 PostgreSQL repository', () => {
  it('fences every owned query by all four dimensions and owns no attendance/consent/name tables', () => {
    expect(source).toContain('account_key = $1 AND product_key = $2');
    expect(source).toContain('runtime_tier = $3 AND verification_environment_id = $4');
    expect(source).not.toMatch(/INSERT INTO onetime\.(?:learning_)?attendance/i);
    expect(source).not.toMatch(/UPDATE onetime\.(?:learning_)?attendance/i);
    expect(source).not.toContain('learning_recognition_consents');
    expect(source).not.toContain('learning_leaderboard_learners');
    expect(source).not.toMatch(/INSERT INTO .*name/i);
  });

  it('reads P18 attendance, privacy consent, and P12 identity using SELECT-only identity joins', () => {
    expect(source).toContain('FROM onetime.classroom_attendance_projection_v21 AS attendance');
    expect(source).toContain('JOIN onetime.class_series_enrollments AS enrollment');
    expect(source).toContain('JOIN onetime.v21_student_profiles AS student');
    expect(source).toContain('JOIN onetime.v21_households AS household');
    expect(source).toContain("consent.scope = 'member_recognition'");
    expect(source).toContain('successor.supersedes_consent_event_id');
    expect(source).toContain('actor_adult_id = owner_adult_id');
    expect(source).toContain('student.actual_name, student.display_name');
    expect(source).toContain('listScheduledOccurrenceCoverage');
    expect(source).toContain('occurrence.starts_at >= enrollment.effective_at');
    expect(recognitionFactQuery).toContain('question.learner_key, question.household_key');
    expect(recognitionFactQuery).toContain("event.to_state IN ('approved_for_class', 'published')");
    expect(recognitionFactQuery).toContain('qualification.qualified_at, approval.approved_at');
    expect(source).toContain('AND class_key = $7 AND household_key = $8');
    expect(source).toContain(
      "attendance.reconciliation_state IN (\n                'provisional', 'provider_verified', 'provider_mismatch', 'admin_corrected'",
    );
  });

  it('proves review publication from the canonical occurrence and approved review artifact', () => {
    expect(source).toContain('state.aggregate_key = publication.content_id');
    expect(source).toContain('governed.occurrence_id = publication.content_id');
    expect(source).toContain("governed.governance_state = 'governed'");
    expect(source).toContain('governed.active = TRUE');
    expect(source).toContain('occurrence.occurrence_key = publication.content_id');
    expect(source).toContain('occurrence.class_series_key = governed.canonical_series_id');
    expect(source).toContain(
      "jsonb_array_elements(publication.approval_projection_json->'artifacts')",
    );
    expect(source).toContain("artifact.value->>'kind' = 'review_material'");
    expect(source).toContain("artifact.value->>'artifactId' = $5");
  });

  it('reserves the scoped idempotency key before mutation and appends one atomic plan', async () => {
    const fake = pool([
      () => ({ rows: [], rowCount: 0 }),
      () => ({ rows: [], rowCount: 0 }),
      () => ({ rows: [], rowCount: 1 }),
      () => ({ rows: [], rowCount: 1 }),
      () => ({ rows: [], rowCount: 1 }),
    ]);
    await createLearningEngagementRepository(fake.value as never).applyQuestionMutation(mutation);
    expect(fake.sql.map((text) => text.split(/\s+/).slice(0, 3).join(' '))).toEqual([
      'BEGIN',
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      'SELECT request_hash FROM',
      'UPDATE onetime.learning_question_projection SET',
      'INSERT INTO onetime.learning_question_transition_ledger',
      'INSERT INTO onetime.learning_question_recognition_ledger',
      'COMMIT',
    ]);
  });

  it('rolls back stale projections before ledger writes', async () => {
    const fake = pool([
      () => ({ rows: [], rowCount: 0 }),
      () => ({ rows: [], rowCount: 0 }),
      () => ({ rows: [], rowCount: 0 }),
    ]);
    await expect(
      createLearningEngagementRepository(fake.value as never).applyQuestionMutation(mutation),
    ).rejects.toThrow(/stale_version/);
    expect(fake.sql.at(-1)).toBe('ROLLBACK');
    expect(fake.sql.join('\n')).not.toContain(
      'INSERT INTO onetime.learning_question_transition_ledger',
    );
  });

  it('returns exact replay without writes and rejects changed hashes', async () => {
    const row = {
      account_key: scope.accountKey,
      product_key: scope.productKey,
      runtime_tier: scope.runtimeTier,
      verification_environment_id: scope.verificationEnvironmentId,
      question_key: 'question-1',
      learner_key: 'student-1',
      household_key: 'household-1',
      class_key: 'class-a',
      private_body: 'Question',
      private_answer: 'Answer',
      question_state: 'answered_private',
      version: 2,
      submitted_at: new Date('2026-07-01T10:00:00.000Z'),
      updated_at: new Date('2026-07-02T10:00:00.000Z'),
    };
    const replay = pool([
      () => ({ rows: [], rowCount: 0 }),
      () => ({ rows: [{ request_hash: mutation.transition.requestHash }], rowCount: 1 }),
      () => ({ rows: [row], rowCount: 1 }),
    ]);
    await expect(
      createLearningEngagementRepository(replay.value as never).applyQuestionMutation(mutation),
    ).resolves.toMatchObject({ replay: true });
    expect(replay.sql.join('\n')).not.toMatch(/\b(?:UPDATE|INSERT)\b/);

    const conflict = pool([
      () => ({ rows: [], rowCount: 0 }),
      () => ({ rows: [{ request_hash: 'different' }], rowCount: 1 }),
    ]);
    await expect(
      createLearningEngagementRepository(conflict.value as never).applyQuestionMutation(mutation),
    ).rejects.toThrow(/idempotency_conflict/);
    expect(conflict.sql.at(-1)).toBe('ROLLBACK');
    expect(conflict.sql.join('\n')).not.toMatch(
      /UPDATE onetime\.learning_question_projection|INSERT INTO onetime\.learning_question/,
    );
  });

  it('keeps ledger inserts append-only', () => {
    const ledgers =
      source.match(
        /INSERT INTO onetime\.learning_question_(?:transition|recognition)_ledger[\s\S]*?VALUES \([^;]+/g,
      ) ?? [];
    expect(ledgers).toHaveLength(2);
    expect(ledgers.join('\n')).not.toMatch(
      /DO UPDATE|UPDATE onetime\.learning_question_.*ledger|DELETE FROM onetime\.learning_question_.*ledger/,
    );
  });
});
