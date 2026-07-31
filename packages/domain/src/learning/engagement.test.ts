import { describe, expect, it } from 'vitest';
import type {
  AttendanceRecord,
  CanonicalLearnerIdentity,
  CanonicalRecognitionConsent,
  LearningActor,
  LearningScope,
  QuestionHistory,
  QuestionMutation,
} from '../../../contracts/src/learning/index.ts';
import {
  announcementsVisibleTo,
  attendanceVisibleTo,
  buildLeaderboard,
  calculateBadges,
  correctReviewCompletion,
  correctQuestionRecognition,
  createAnnouncement,
  questionsVisibleTo,
  recordReviewCompletion,
  submitQuestion,
  transitionQuestion,
} from './engagement.ts';

const scope: LearningScope = {
  accountKey: 'account-1',
  productKey: 'one_time_mishnayos',
  runtimeTier: 'isolated_staging',
  verificationEnvironmentId: 'ci',
};
const admin: LearningActor = {
  ...scope,
  role: 'admin',
  principalId: 'admin-1',
  classIds: ['class-a'],
};
const student: LearningActor = {
  ...scope,
  role: 'student',
  principalId: 'login-1',
  studentId: 'student-1',
  householdId: 'household-1',
  classIds: ['class-a'],
};
const emptyHistory: QuestionHistory = { transitions: [], recognitions: [] };

function submission(id = 'question-1') {
  const result = submitQuestion({
    actor: student,
    id,
    classId: 'class-a',
    body: 'Why is this wording used?',
    idempotencyKey: `submit-${id}`,
    requestHash: `hash-submit-${id}`,
    auditRef: `audit-submit-${id}`,
    occurredAt: '2026-07-01T10:00:00.000Z',
  });
  return result.mutation as QuestionMutation;
}

function attendance(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    ...scope,
    occurrenceId: 'occurrence-1',
    classId: 'class-a',
    studentId: 'student-1',
    householdId: 'household-1',
    enrollmentId: 'enrollment-1',
    identityBindingVerified: true,
    segmentIds: [],
    minutes: 45,
    present: true,
    occurredAt: '2026-07-02T10:00:00.000Z',
    correctedAt: null,
    correctionReason: null,
    correctedBy: null,
    correctionAuditRef: null,
    correctionSourceDigest: null,
    ...overrides,
  };
}

function learner(overrides: Partial<CanonicalLearnerIdentity> = {}): CanonicalLearnerIdentity {
  return {
    ...scope,
    studentId: 'student-2',
    householdId: 'household-2',
    classId: 'class-a',
    enrollmentId: 'enrollment-2',
    actualName: 'רחל בת שרה',
    displayName: 'Rivka L.',
    ...overrides,
  };
}

describe('P22 four-scope private questions and append-only plans', () => {
  it('carries all four scope dimensions and recognizes only on first qualification', () => {
    const created = submission();
    expect(created.projection).toMatchObject(scope);
    expect(created.transition).toMatchObject({ from: null, to: 'submitted' });
    const answered = transitionQuestion(
      created.projection,
      {
        transitions: [created.transition],
        recognitions: [],
      },
      {
        actor: admin,
        questionId: created.projection.id,
        to: 'answered_private',
        answer: 'A private answer',
        expectedVersion: 1,
        idempotencyKey: 'answer-1',
        requestHash: 'hash-answer-1',
        auditRef: 'audit-answer-1',
        occurredAt: '2026-07-02T10:00:00.000Z',
      },
    ).mutation as QuestionMutation;
    expect(answered.recognition?.action).toBe('qualified');
    const published = transitionQuestion(
      answered.projection,
      {
        transitions: [created.transition, answered.transition],
        recognitions: [answered.recognition!],
      },
      {
        actor: admin,
        questionId: created.projection.id,
        to: 'approved_for_class',
        expectedVersion: 2,
        idempotencyKey: 'approve-1',
        requestHash: 'hash-approve-1',
        auditRef: 'audit-approve-1',
        occurredAt: '2026-07-03T10:00:00.000Z',
      },
    ).mutation as QuestionMutation;
    expect(published.recognition).toBeNull();
    expect(published.projection).not.toHaveProperty('transitions');
    expect(published.projection).not.toHaveProperty('recognitionEligible');
  });

  it('replays exact hashes, conflicts changed hashes, and rejects stale versions', () => {
    const created = submission();
    const history = { transitions: [created.transition], recognitions: [] };
    const replay = transitionQuestion(created.projection, history, {
      actor: admin,
      questionId: created.projection.id,
      to: 'closed',
      expectedVersion: 1,
      idempotencyKey: created.transition.idempotencyKey,
      requestHash: created.transition.requestHash,
      auditRef: 'audit-replay',
      occurredAt: '2026-07-02T10:00:00.000Z',
    });
    expect(replay).toMatchObject({ replay: true, mutation: null });
    expect(() =>
      transitionQuestion(created.projection, history, {
        actor: admin,
        questionId: created.projection.id,
        to: 'closed',
        expectedVersion: 1,
        idempotencyKey: created.transition.idempotencyKey,
        requestHash: 'changed',
        auditRef: 'audit-conflict',
        occurredAt: '2026-07-02T10:00:00.000Z',
      }),
    ).toThrow(/different request hash/);
    expect(() =>
      transitionQuestion(created.projection, emptyHistory, {
        actor: admin,
        questionId: created.projection.id,
        to: 'closed',
        expectedVersion: 7,
        idempotencyKey: 'stale',
        requestHash: 'hash-stale',
        auditRef: 'audit-stale',
        occurredAt: '2026-07-02T10:00:00.000Z',
      }),
    ).toThrow(/Reload/);
  });

  it('rejects blank question evidence keys and invalid occurrence timestamps', () => {
    const command = {
      actor: student,
      id: 'question-invalid',
      classId: 'class-a',
      body: 'Why?',
      idempotencyKey: 'submit-invalid',
      requestHash: 'hash-invalid',
      auditRef: 'audit-invalid',
      occurredAt: '2026-07-01T10:00:00.000Z',
    };
    expect(() => submitQuestion({ ...command, idempotencyKey: '   ' })).toThrow(/Idempotency key/);
    expect(() => submitQuestion({ ...command, auditRef: '   ' })).toThrow(
      /Question audit reference/,
    );
    expect(() => submitQuestion({ ...command, occurredAt: 'not-an-instant' })).toThrow(
      /valid timestamp/,
    );
  });

  it.each([
    ['accountKey', 'account-2'],
    ['productKey', 'other-product'],
    ['runtimeTier', 'production'],
    ['verificationEnvironmentId', 'provider_sandbox'],
  ] as const)('isolates questions by %s', (key, value) => {
    const question = { ...submission().projection, [key]: value };
    expect(questionsVisibleTo(student, [question])).toEqual([]);
  });

  it('appends recognition correction evidence without rewriting the projection', () => {
    const created = submission();
    const qualified = {
      ...created.transition,
      sequence: 1,
      source: 'admin_transition' as const,
      action: 'qualified' as const,
      eligible: true,
    };
    const result = correctQuestionRecognition(
      created.projection,
      { transitions: [created.transition], recognitions: [qualified] },
      {
        actor: admin,
        questionId: created.projection.id,
        eligible: false,
        reason: 'Wrong question association',
        expectedVersion: 1,
        idempotencyKey: 'correct-1',
        requestHash: 'hash-correct-1',
        auditRef: 'audit-correct-1',
        occurredAt: '2026-07-02T10:00:00.000Z',
      },
    ).mutation!;
    expect(result.recognition).toMatchObject({
      action: 'correction_disabled',
      eligible: false,
      reason: 'Wrong question association',
    });
    expect(result.transition.from).toBe(result.transition.to);
    expect(result.projection).not.toHaveProperty('recognitionEligible');
  });

  it('cannot restore recognition before first qualification and sequences backdated corrections', () => {
    const created = submission();
    expect(() =>
      correctQuestionRecognition(created.projection, emptyHistory, {
        actor: admin,
        questionId: created.projection.id,
        eligible: true,
        reason: 'No qualifying evidence',
        expectedVersion: 1,
        idempotencyKey: 'invalid-restore',
        requestHash: 'hash-invalid-restore',
        auditRef: 'audit-invalid-restore',
        occurredAt: '2026-07-02T10:00:00.000Z',
      }),
    ).toThrow(/before the question first qualifies/);

    const qualified = {
      ...submission().transition,
      sequence: 1,
      source: 'admin_transition' as const,
      action: 'qualified' as const,
      eligible: true,
    };
    const corrected = correctQuestionRecognition(
      created.projection,
      { transitions: [created.transition], recognitions: [qualified] },
      {
        actor: admin,
        questionId: created.projection.id,
        eligible: false,
        reason: 'Backdated correction',
        expectedVersion: 1,
        idempotencyKey: 'backdated',
        requestHash: 'hash-backdated',
        auditRef: 'audit-backdated',
        occurredAt: '2026-06-01T10:00:00.000Z',
      },
    ).mutation!;
    expect(corrected.recognition).toMatchObject({ sequence: 2, eligible: false });
  });
});

describe('P22 canonical read-only attendance and announcements', () => {
  it('accepts only identity-bound exact-scope P18 projections', () => {
    expect(attendanceVisibleTo(student, [attendance()])).toHaveLength(1);
    expect(
      attendanceVisibleTo(student, [
        attendance({ identityBindingVerified: false as true }),
        attendance({ enrollmentId: '' }),
        attendance({ runtimeTier: 'production' }),
      ]),
    ).toEqual([]);
  });

  it('fails closed for cross-class Admin and unknown announcement audiences', () => {
    const classB = createAnnouncement({
      actor: { ...admin, classIds: ['class-b'] },
      id: 'class-b',
      title: 'Class B',
      body: 'Only class B',
      audience: { kind: 'class', classId: 'class-b' },
      publishedAt: '2026-07-01T10:00:00.000Z',
    });
    expect(announcementsVisibleTo(admin, [classB], '2026-07-02T10:00:00.000Z')).toEqual([]);
    expect(
      announcementsVisibleTo(
        admin,
        [{ ...classB, audience: { kind: 'unknown' } as never }],
        '2026-07-02T10:00:00.000Z',
      ),
    ).toEqual([]);
  });

  it('binds direct audiences to class and lets only the assigned Admin inspect them', () => {
    const targeted = createAnnouncement({
      actor: admin,
      id: 'student-a',
      title: 'Student A',
      body: 'Only the enrolled target',
      audience: { kind: 'student', classId: 'class-a', studentId: 'student-1' },
      publishedAt: '2026-07-01T10:00:00.000Z',
    });
    expect(announcementsVisibleTo(admin, [targeted], '2026-07-02T10:00:00.000Z')).toEqual([
      targeted,
    ]);
    expect(
      announcementsVisibleTo(
        { ...admin, classIds: ['class-b'] },
        [targeted],
        '2026-07-02T10:00:00.000Z',
      ),
    ).toEqual([]);
  });

  it('records review completion only from the authenticated Student and canonical publication', () => {
    const command = {
      actor: student,
      reviewItemId: 'review-1',
      classId: 'class-a',
      source: 'authenticated_mark_complete' as const,
      auditRef: 'audit-review-1',
      idempotencyKey: 'complete-review-1',
      requestHash: 'hash-complete-review-1',
      completedAt: '2026-07-02T10:00:00.000Z',
    };
    expect(
      recordReviewCompletion(command, {
        ...scope,
        reviewItemId: 'review-1',
        classId: 'class-a',
        publicationAuditRef: 'published-revision-1',
      }),
    ).toMatchObject({
      studentId: 'student-1',
      householdId: 'household-1',
      adminPublished: true,
      source: 'authenticated_mark_complete',
    });
    expect(() =>
      recordReviewCompletion(
        { ...command, actor: admin },
        {
          ...scope,
          reviewItemId: 'review-1',
          classId: 'class-a',
          publicationAuditRef: 'published-revision-1',
        },
      ),
    ).toThrow(/authenticated enrolled Student/);

    const completed = recordReviewCompletion(command, {
      ...scope,
      reviewItemId: 'review-1',
      classId: 'class-a',
      publicationAuditRef: 'published-revision-1',
    });
    const revoked = correctReviewCompletion(
      [completed],
      {
        actor: admin,
        reviewItemId: 'review-1',
        classId: 'class-a',
        studentId: 'student-1',
        householdId: 'household-1',
        action: 'revoked',
        reason: 'Duplicate completion evidence',
        auditRef: 'audit-revoke-1',
        idempotencyKey: 'revoke-1',
        requestHash: 'hash-revoke-1',
        occurredAt: '2026-07-03T10:00:00.000Z',
      },
      {
        ...scope,
        reviewItemId: 'review-1',
        classId: 'class-a',
        publicationAuditRef: 'published-revision-1',
      },
    );
    expect(revoked).toMatchObject({
      action: 'revoked',
      sequence: 2,
      source: 'admin_correction',
      reason: 'Duplicate completion evidence',
    });

    const awards = calculateBadges({
      studentId: 'student-1',
      scheduledOccurrenceIds: ['present', 'missed-most-recent'],
      attendance: [attendance({ occurrenceId: 'present' })],
      questionRecognitionFacts: [],
      reviews: [completed, revoked],
    });
    expect(awards).toEqual([]);
  });
});

describe('P22 recognition-safe leaderboard labels', () => {
  const learners = [
    learner({
      studentId: 'student-1',
      householdId: 'household-1',
      enrollmentId: 'enrollment-1',
      actualName: 'Mary Jane Watson Parker',
      displayName: null,
    }),
    learner(),
  ];
  const base = {
    actor: student,
    classId: 'class-a',
    learners,
    attendance: [attendance(), attendance({ studentId: 'student-2', householdId: 'household-2' })],
    questionRecognitionFacts: [],
    consents: [] as CanonicalRecognitionConsent[],
    asOf: '2026-07-20T10:00:00.000Z',
    aliasHmacKey: 'test-only-hmac-key',
  };

  it('counts approvals by first approved/published transition time, not private qualification time', () => {
    const recognitionFact = {
      ...scope,
      questionId: 'question-1',
      studentId: 'student-2',
      householdId: 'household-2',
      classId: 'class-a',
      state: 'answered_private' as const,
      eligible: true,
      qualifiedAt: '2026-07-10T10:00:00.000Z',
      approvedAt: null,
      latestSequence: 1,
      latestSource: 'admin_transition' as const,
      latestAuditRef: 'audit-answer-1',
      latestReason: null,
      latestActorId: 'admin-1',
    };
    const privateOnly = buildLeaderboard({
      ...base,
      questionRecognitionFacts: [recognitionFact],
    });
    expect(
      privateOnly.categories.approvedQuestionCount.find((entry) => entry.displayName !== 'You')
        ?.value,
    ).toBe(0);
    const approved = buildLeaderboard({
      ...base,
      questionRecognitionFacts: [
        {
          ...recognitionFact,
          state: 'approved_for_class',
          approvedAt: '2026-07-12T10:00:00.000Z',
        },
      ],
    });
    expect(
      approved.categories.approvedQuestionCount.find((entry) => entry.displayName !== 'You')?.value,
    ).toBe(1);
  });

  it('uses actualName only for Admin, You for self, and displayName only for granted peers', () => {
    const off = buildLeaderboard(base);
    expect(off.categories.attendanceCount[0]?.displayName).toBe('You');
    expect(off.categories.attendanceCount[1]?.displayName).toMatch(/^Anonymous Student/);
    expect(off.categories.attendanceCount[1]?.studentId).not.toBe('student-2');
    const consent = (choice: CanonicalRecognitionConsent['choice'], at: string) => ({
      ...scope,
      consentEventId: `${choice}-${at}`,
      studentId: 'student-2',
      choice,
      occurredAt: at,
    });
    const granted = buildLeaderboard({
      ...base,
      consents: [
        consent('withdrawn', '2026-07-12T10:00:00.000Z'),
        consent('granted', '2026-07-11T10:00:00.000Z'),
      ].reverse(),
    });
    expect(granted.categories.attendanceCount[1]?.displayName).toMatch(/^Anonymous Student/);
    const visible = buildLeaderboard({
      ...base,
      consents: [
        consent('withdrawn', '2026-07-11T10:00:00.000Z'),
        consent('granted', '2026-07-12T10:00:00.000Z'),
      ],
    });
    expect(visible.categories.attendanceCount[1]?.displayName).toBe('Rivka L.');
    const adminBoard = buildLeaderboard({ ...base, actor: admin });
    expect(adminBoard.categories.attendanceCount.map((entry) => entry.displayName)).toContain(
      'רחל בת שרה',
    );
  });

  it('changes only labels on withdrawal and makes aliases stable but scope-specific', () => {
    const consent = {
      ...scope,
      consentEventId: 'grant',
      studentId: 'student-2',
      choice: 'granted' as const,
      occurredAt: '2026-07-12T10:00:00.000Z',
    };
    const shown = buildLeaderboard({ ...base, consents: [consent] });
    const hidden = buildLeaderboard({
      ...base,
      consents: [
        {
          ...consent,
          consentEventId: 'withdraw',
          choice: 'withdrawn',
          occurredAt: '2026-07-13T10:00:00.000Z',
        },
      ],
    });
    const facts = (board: typeof shown) =>
      board.categories.attendanceCount.map(({ displayName: _label, ...entry }) => entry);
    expect(facts(hidden)).toEqual(facts(shown));
    const alias = hidden.categories.attendanceCount[1]?.displayName;
    expect(
      buildLeaderboard({ ...base, consents: [] }).categories.attendanceCount[1]?.displayName,
    ).toBe(alias);
    for (const change of [
      { accountKey: 'account-2' },
      { productKey: 'product-2' },
      { runtimeTier: 'production' },
      { verificationEnvironmentId: 'provider_sandbox' },
      { classId: 'class-b' },
      { studentId: 'student-9' },
    ]) {
      const changed = learner(change);
      const actor = {
        ...student,
        ...scope,
        ...change,
        studentId: 'viewer',
        classIds: [changed.classId],
      } as LearningActor;
      const board = buildLeaderboard({
        ...base,
        actor,
        classId: changed.classId,
        learners: [changed],
        attendance: [],
        consents: [],
      });
      expect(board.categories.attendanceCount[0]?.displayName).not.toBe(alias);
    }
  });

  it('uses canonical schedule coverage for peer streaks and excludes lifetime/cross-scope rows', () => {
    const board = buildLeaderboard({
      ...base,
      attendance: [
        ...base.attendance,
        attendance({
          occurrenceId: 'old',
          studentId: 'student-2',
          householdId: 'household-2',
          occurredAt: '2026-01-01T10:00:00.000Z',
        }),
        attendance({
          occurrenceId: 'cross-scope',
          studentId: 'student-2',
          householdId: 'household-2',
          runtimeTier: 'production',
          occurredAt: '2026-07-19T10:00:00.000Z',
        }),
      ],
      scheduledOccurrenceCoverage: [
        {
          ...scope,
          occurrenceId: 'occurrence-1',
          classId: 'class-a',
          studentId: 'student-2',
          enrollmentId: 'enrollment-2',
          identityBindingVerified: true,
          occurredAt: '2026-07-02T10:00:00.000Z',
        },
      ],
    });
    const peerAttendance = board.categories.attendanceCount.find((entry) => entry.rank === 1);
    expect(peerAttendance?.value).toBe(1);
    expect(board.categories.currentAttendanceStreak.map((entry) => entry.value)).toEqual([1, 0]);
    expect(
      buildLeaderboard({
        ...base,
        scheduledOccurrenceCoverage: [],
      }).categories.currentAttendanceStreak.every((entry) => entry.value === 0),
    ).toBe(true);
  });
});
