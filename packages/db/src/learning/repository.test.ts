import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type {
  BadgeFamily,
  BadgeProjectionRecalculation,
  LearningBadgeAwardProjection,
  QuestionMutation,
} from '../../../contracts/src/learning/index.ts';
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
  const parameters: (readonly unknown[] | undefined)[] = [];
  let index = 0;
  const client = {
    query: async (text: string, values?: readonly unknown[]) => {
      sql.push(text.trim());
      parameters.push(values);
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
        return { rows: [], rowCount: null };
      }
      return responses[index++]?.(text) ?? { rows: [], rowCount: 1 };
    },
    release: () => undefined,
  };
  return {
    sql,
    parameters,
    value: {
      connect: async () => client,
      query: client.query,
      end: async () => undefined,
    },
  };
}

const badgeLevels = [
  ['consistency', 'I', 5],
  ['consistency', 'II', 20],
  ['consistency', 'III', 60],
  ['curious_learner', 'I', 1],
  ['curious_learner', 'II', 5],
  ['curious_learner', 'III', 15],
  ['review_ready', 'I', 1],
  ['review_ready', 'II', 4],
  ['review_ready', 'III', 12],
] as const;

function badgeRows(
  overrides: Partial<
    Record<
      BadgeFamily,
      {
        digest: string;
        state: LearningBadgeAwardProjection['state'];
        awardedAt: string | null;
        revokedAt: string | null;
        auditRef: string | null;
        reason: string | null;
        adminId: string | null;
      }
    >
  > = {},
) {
  return badgeLevels.map(([family, level, threshold]) => {
    const familyOverride = overrides[family];
    return {
      account_key: scope.accountKey,
      product_key: scope.productKey,
      runtime_tier: scope.runtimeTier,
      verification_environment_id: scope.verificationEnvironmentId,
      learner_key: 'student-1',
      class_key: 'class-a',
      badge_family: family,
      badge_level: level,
      threshold,
      qualifying_count: familyOverride?.state === 'awarded' ? threshold : 0,
      source_keys: [],
      source_digest: familyOverride?.digest ?? `${family}-digest`,
      version: 1,
      award_state: familyOverride?.state ?? 'unawarded',
      rule_version: 'P22-BADGES-1',
      source_audit_refs: [],
      awarded_at: familyOverride?.awardedAt ?? null,
      revoked_at: familyOverride?.revokedAt ?? null,
      recalculated_at: '2026-07-01T10:00:00.000Z',
      correction_audit_ref: familyOverride?.auditRef ?? null,
      correction_reason: familyOverride?.reason ?? null,
      corrected_by_admin_id: familyOverride?.adminId ?? null,
    };
  });
}

function badgeRecalculation(
  overrides: Partial<BadgeProjectionRecalculation> = {},
): BadgeProjectionRecalculation {
  return {
    scope,
    studentId: 'student-1',
    classId: 'class-a',
    familySourceDigests: {
      consistency: 'consistency-digest',
      curious_learner: 'curious_learner-digest',
      review_ready: 'review_ready-digest',
    },
    ruleVersion: 'P22-BADGES-1',
    familySourceAuditRefs: {
      consistency: [],
      curious_learner: [],
      review_ready: [],
    },
    progress: {
      consistency: { qualifyingCount: 0, sourceKeys: [] },
      curious_learner: { qualifyingCount: 0, sourceKeys: [] },
      review_ready: { qualifyingCount: 0, sourceKeys: [] },
    },
    awards: [],
    recalculatedAt: '2026-07-03T10:00:00.000Z',
    correctionAuditRef: null,
    correctionReason: null,
    correctedByAdminId: null,
    correctionFamily: null,
    allowRevocation: false,
    ...overrides,
  };
}

function badgeInsertParameters(fake: ReturnType<typeof pool>) {
  return fake.sql.flatMap((text, index) =>
    text.startsWith('INSERT INTO onetime.learning_badge_award_projection')
      ? [fake.parameters[index] ?? []]
      : [],
  );
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
    expect(source).toContain('occurrence.class_series_key = $6');
    expect(source).toContain('WHERE event_rank = 1');
    expect(source).not.toContain(
      "WHERE event_rank = 1 AND event_action IN ('completed', 'restored')",
    );
  });

  it('initializes exactly nine fixed badge rows and preserves under-threshold null timestamps', async () => {
    const fake = pool([() => ({ rows: [], rowCount: 0 }), () => ({ rows: [], rowCount: 0 })]);
    await createLearningEngagementRepository(fake.value as never).applyBadgeRecalculation(
      badgeRecalculation(),
    );
    const inserts = badgeInsertParameters(fake);
    expect(inserts).toHaveLength(9);
    expect(inserts.map((values) => [values[6], values[7], values[8]])).toEqual(badgeLevels);
    expect(inserts.every((values) => values[12] === 'unawarded')).toBe(true);
    expect(inserts.every((values) => values[15] === null && values[16] === null)).toBe(true);
  });

  it('returns an exact nine-row replay without writes', async () => {
    const fake = pool([
      () => ({ rows: [], rowCount: 0 }),
      () => ({ rows: badgeRows(), rowCount: 9 }),
    ]);
    await expect(
      createLearningEngagementRepository(fake.value as never).applyBadgeRecalculation(
        badgeRecalculation(),
      ),
    ).resolves.toMatchObject({ replay: true });
    expect(badgeInsertParameters(fake)).toEqual([]);

    const correctionRows = badgeRows({
      consistency: {
        digest: 'consistency-digest',
        state: 'revoked',
        awardedAt: '2026-07-01T10:00:00.000Z',
        revokedAt: '2026-07-03T10:00:00.000Z',
        auditRef: 'audit-correction-1',
        reason: 'Canonical evidence corrected',
        adminId: 'admin-1',
      },
    });
    const correctionReplay = pool([
      () => ({ rows: [], rowCount: 0 }),
      () => ({ rows: correctionRows, rowCount: 9 }),
    ]);
    await expect(
      createLearningEngagementRepository(correctionReplay.value as never).applyBadgeRecalculation(
        badgeRecalculation({
          correctionAuditRef: 'audit-correction-1',
          correctionReason: 'Canonical evidence corrected',
          correctedByAdminId: 'admin-1',
          correctionFamily: 'consistency',
          allowRevocation: true,
        }),
      ),
    ).resolves.toMatchObject({ replay: true });
    expect(badgeInsertParameters(correctionReplay)).toEqual([]);
  });

  it('preserves an ordinary award and versions only the changed family', async () => {
    const awardedAt = '2026-07-01T10:00:00.000Z';
    const fake = pool([
      () => ({ rows: [], rowCount: 0 }),
      () => ({
        rows: badgeRows({
          consistency: {
            digest: 'old-consistency-digest',
            state: 'awarded',
            awardedAt,
            revokedAt: null,
            auditRef: null,
            reason: null,
            adminId: null,
          },
        }),
        rowCount: 9,
      }),
    ]);
    await createLearningEngagementRepository(fake.value as never).applyBadgeRecalculation(
      badgeRecalculation(),
    );
    const inserts = badgeInsertParameters(fake);
    expect(inserts).toHaveLength(3);
    expect(inserts.every((values) => values[6] === 'consistency')).toBe(true);
    expect(inserts[0]?.[12]).toBe('awarded');
    expect(inserts[0]?.[15]).toBe(awardedAt);
    expect(inserts[0]?.[16]).toBeNull();
  });

  it('audits revoke and restore timestamps while rejecting rule-version replacement', async () => {
    const awardedAt = '2026-07-01T10:00:00.000Z';
    const correction = {
      correctionAuditRef: 'audit-correction-1',
      correctionReason: 'Canonical evidence corrected',
      correctedByAdminId: 'admin-1',
      correctionFamily: 'consistency' as const,
      allowRevocation: true,
    };
    const revoke = pool([
      () => ({ rows: [], rowCount: 0 }),
      () => ({
        rows: badgeRows({
          consistency: {
            digest: 'consistency-digest',
            state: 'awarded',
            awardedAt,
            revokedAt: null,
            auditRef: null,
            reason: null,
            adminId: null,
          },
        }),
        rowCount: 9,
      }),
    ]);
    await createLearningEngagementRepository(revoke.value as never).applyBadgeRecalculation(
      badgeRecalculation(correction),
    );
    const revoked = badgeInsertParameters(revoke);
    expect(revoked).toHaveLength(3);
    expect(revoked[0]?.[12]).toBe('revoked');
    expect(revoked[0]?.[15]).toBe(awardedAt);
    expect(revoked[0]?.[16]).toBe('2026-07-03T10:00:00.000Z');
    expect(revoked[0]?.slice(18, 21)).toEqual([
      'audit-correction-1',
      'Canonical evidence corrected',
      'admin-1',
    ]);

    const restore = pool([
      () => ({ rows: [], rowCount: 0 }),
      () => ({
        rows: badgeRows({
          consistency: {
            digest: 'old-consistency-digest',
            state: 'revoked',
            awardedAt,
            revokedAt: '2026-07-02T10:00:00.000Z',
            auditRef: 'audit-correction-0',
            reason: 'Earlier correction',
            adminId: 'admin-1',
          },
        }),
        rowCount: 9,
      }),
    ]);
    await createLearningEngagementRepository(restore.value as never).applyBadgeRecalculation(
      badgeRecalculation({
        ...correction,
        awards: [
          {
            key: 'consistency:1',
            family: 'consistency',
            level: 'I',
            threshold: 999,
            qualifyingCount: 5,
            sourceKeys: ['occurrence-1'],
          },
        ],
      }),
    );
    const restored = badgeInsertParameters(restore);
    expect(restored[0]?.[8]).toBe(5);
    expect(restored[0]?.[12]).toBe('awarded');
    expect(restored[0]?.[15]).toBe(awardedAt);
    expect(restored[0]?.[16]).toBeNull();

    const wrongVersionRows = badgeRows();
    wrongVersionRows[0]!.rule_version = 'P22-BADGES-0';
    const wrongVersion = pool([
      () => ({ rows: [], rowCount: 0 }),
      () => ({ rows: wrongVersionRows, rowCount: 9 }),
    ]);
    await expect(
      createLearningEngagementRepository(wrongVersion.value as never).applyBadgeRecalculation(
        badgeRecalculation(),
      ),
    ).rejects.toThrow(/rule_version_mismatch/);
    expect(badgeInsertParameters(wrongVersion)).toEqual([]);
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
