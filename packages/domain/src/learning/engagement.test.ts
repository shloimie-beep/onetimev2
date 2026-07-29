import { describe, expect, it } from 'vitest';
import type {
  AttendanceRecord,
  LearningActor,
  LearningQuestion,
  LeaderboardLearner,
  RecognitionConsent,
  ReviewCompletion,
} from '../../../contracts/src/learning/index.ts';
import { NO_LEARNING_EXTERNAL_EFFECTS } from '../../../contracts/src/learning/index.ts';
import {
  announcementsVisibleTo,
  assertPeerMessagingUnavailable,
  attendanceVisibleTo,
  buildLeaderboard,
  calculateBadges,
  correctAttendance,
  correctQuestionRecognition,
  createAnnouncement,
  mergeAttendance,
  publishedQuestionsVisibleTo,
  questionsVisibleTo,
  submitQuestion,
  transitionQuestion,
} from './engagement.ts';

const scope = { accountKey: 'account-1', productKey: 'one-time' };
const admin: LearningActor = {
  ...scope,
  principalId: 'admin-rabbi',
  role: 'admin',
  classIds: ['class-a', 'class-b'],
};
const classAAdmin: LearningActor = {
  ...scope,
  principalId: 'admin-class-a',
  role: 'admin',
  classIds: ['class-a'],
};
const student: LearningActor = {
  ...scope,
  principalId: 'student-login-1',
  role: 'student',
  studentId: 'student-1',
  householdId: 'household-1',
  classIds: ['class-a'],
};
const peer: LearningActor = {
  ...scope,
  principalId: 'student-login-2',
  role: 'student',
  studentId: 'student-2',
  householdId: 'household-2',
  classIds: ['class-a'],
};
const classBStudent: LearningActor = {
  ...scope,
  principalId: 'student-login-3',
  role: 'student',
  studentId: 'student-3',
  householdId: 'household-3',
  classIds: ['class-b'],
};
const parent: LearningActor = {
  ...scope,
  principalId: 'parent-1',
  role: 'parent',
  householdIds: ['household-1'],
  classIds: ['class-a'],
};

function submitted(id = 'question-1') {
  return submitQuestion({
    actor: student,
    id,
    classId: 'class-a',
    body: 'Why does the Mishnah use this wording?',
    occurredAt: '2026-07-01T10:00:00.000Z',
  }).question;
}

function move(
  question: LearningQuestion,
  to: 'answered_private' | 'approved_for_class' | 'published',
  key: string,
) {
  return transitionQuestion(question, {
    actor: admin,
    questionId: question.id,
    to,
    ...(to === 'answered_private' ? { answer: 'The wording teaches a separate case.' } : {}),
    expectedVersion: question.version,
    idempotencyKey: key,
    requestHash: `hash-${key}`,
    occurredAt: `2026-07-0${question.version + 1}T10:00:00.000Z`,
  }).question;
}

describe('P22 private question lifecycle', () => {
  it('OTV2-LEARNING-096/099 keeps submission private and creates no contact, chat, or effect', () => {
    const result = submitQuestion({
      actor: student,
      id: 'question-private',
      classId: 'class-a',
      body: 'What is the practical difference?',
      occurredAt: '2026-07-01T10:00:00.000Z',
    });
    expect(result.effects).toEqual(NO_LEARNING_EXTERNAL_EFFECTS);
    expect(questionsVisibleTo(student, [result.question])).toHaveLength(1);
    expect(questionsVisibleTo(peer, [result.question])).toEqual([]);
    expect(() => questionsVisibleTo(parent, [result.question])).toThrow(/not available in Parent/);
    expect(() => assertPeerMessagingUnavailable()).toThrow(/not a learning feature/);
  });

  it('OTV2-LEARNING-097/098 follows Rabbi answer and moderated publication states', () => {
    const answered = move(submitted(), 'answered_private', 'answer-1');
    const approved = move(answered, 'approved_for_class', 'approve-1');
    const published = move(approved, 'published', 'publish-1');
    expect(published.state).toBe('published');
    expect(published.answer).toMatch(/separate case/);
    expect(published.transitions.map((entry) => entry.to)).toEqual([
      'answered_private',
      'approved_for_class',
      'published',
    ]);
  });

  it('denies direct Admin question mutation outside assigned classes', () => {
    const classBQuestion = submitQuestion({
      actor: classBStudent,
      id: 'question-class-b',
      classId: 'class-b',
      body: 'A question in the other class',
      occurredAt: '2026-07-01T10:00:00.000Z',
    }).question;
    expect(() =>
      transitionQuestion(classBQuestion, {
        actor: classAAdmin,
        questionId: classBQuestion.id,
        to: 'answered_private',
        answer: 'This Admin must not be allowed to answer.',
        expectedVersion: classBQuestion.version,
        idempotencyKey: 'cross-class-answer',
        requestHash: 'hash-cross-class-answer',
        occurredAt: '2026-07-02T10:00:00.000Z',
      }),
    ).toThrow(/assignment to this class/);
  });

  it('projects only sanitized published questions to assigned class members', () => {
    const publishedA = move(
      move(
        move(submitted('published-a'), 'answered_private', 'answer-a'),
        'approved_for_class',
        'approve-a',
      ),
      'published',
      'publish-a',
    );
    const classBSubmitted = submitQuestion({
      actor: classBStudent,
      id: 'published-b',
      classId: 'class-b',
      body: 'A separate class question',
      occurredAt: '2026-07-01T10:00:00.000Z',
    }).question;
    const publishedB = move(
      move(
        move(classBSubmitted, 'answered_private', 'answer-b'),
        'approved_for_class',
        'approve-b',
      ),
      'published',
      'publish-b',
    );
    const projection = publishedQuestionsVisibleTo(student, [publishedA, publishedB], 'class-a');
    expect(projection).toEqual([
      {
        questionId: 'published-a',
        classId: 'class-a',
        question: 'Why does the Mishnah use this wording?',
        answer: 'The wording teaches a separate case.',
        publishedAt: publishedA.updatedAt,
      },
    ]);
    expect(Object.keys(projection[0] ?? {})).toEqual([
      'questionId',
      'classId',
      'question',
      'answer',
      'publishedAt',
    ]);
    expect(() => publishedQuestionsVisibleTo(student, [publishedB], 'class-b')).toThrow(
      /assignment to the requested class/,
    );
  });

  it('OTV2-LEARNING-238 deduplicates recognition and correction recalculates stably', () => {
    const answered = move(submitted(), 'answered_private', 'answer-1');
    const replay = transitionQuestion(answered, {
      actor: admin,
      questionId: answered.id,
      to: 'approved_for_class',
      expectedVersion: answered.version,
      idempotencyKey: 'answer-1',
      requestHash: 'hash-answer-1',
      occurredAt: '2026-07-03T10:00:00.000Z',
    });
    expect(replay.replay).toBe(true);
    const published = move(
      move(answered, 'approved_for_class', 'approve-1'),
      'published',
      'publish-1',
    );
    expect(
      calculateBadges({
        studentId: 'student-1',
        scheduledOccurrenceIds: [],
        attendance: [],
        questions: [published, published],
        reviews: [],
      }).filter((badge) => badge.family === 'curious_learner'),
    ).toHaveLength(1);

    const removed = correctQuestionRecognition(published, {
      actor: admin,
      questionId: published.id,
      eligible: false,
      reason: 'Answer was attached to the wrong question.',
      expectedVersion: published.version,
      idempotencyKey: 'correction-1',
      requestHash: 'hash-correction-1',
      occurredAt: '2026-07-06T10:00:00.000Z',
    }).question;
    const first = calculateBadges({
      studentId: 'student-1',
      scheduledOccurrenceIds: [],
      attendance: [],
      questions: [removed],
      reviews: [],
    });
    const second = calculateBadges({
      studentId: 'student-1',
      scheduledOccurrenceIds: [],
      attendance: [],
      questions: [removed],
      reviews: [],
    });
    expect(first).toEqual(second);
    expect(first).toEqual([]);
  });
});

describe('P22 progress, badges, and attendance', () => {
  const attendance: AttendanceRecord[] = Array.from({ length: 5 }, (_, index) => ({
    ...scope,
    occurrenceId: `occurrence-${index + 1}`,
    classId: 'class-a',
    studentId: 'student-1',
    householdId: 'household-1',
    segmentIds: [`segment-${index + 1}`],
    minutes: 45,
    present: true,
    occurredAt: `2026-07-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
    correctedAt: null,
    correctionReason: null,
    correctedBy: null,
  }));

  it('OTV2-LEARNING-093 merges reconnects and audits manual correction with household isolation', () => {
    const first = mergeAttendance(null, {
      ...scope,
      occurrenceId: 'occurrence-1',
      classId: 'class-a',
      studentId: 'student-1',
      householdId: 'household-1',
      segmentId: 'segment-a',
      minutes: 20,
      occurredAt: '2026-07-01T10:00:00.000Z',
    });
    const duplicate = mergeAttendance(first, {
      ...scope,
      occurrenceId: 'occurrence-1',
      classId: 'class-a',
      studentId: 'student-1',
      householdId: 'household-1',
      segmentId: 'segment-a',
      minutes: 20,
      occurredAt: '2026-07-01T10:05:00.000Z',
    });
    const reconnected = mergeAttendance(duplicate, {
      ...scope,
      occurrenceId: 'occurrence-1',
      classId: 'class-a',
      studentId: 'student-1',
      householdId: 'household-1',
      segmentId: 'segment-b',
      minutes: 25,
      occurredAt: '2026-07-01T10:25:00.000Z',
    });
    expect(reconnected.minutes).toBe(45);
    const corrected = correctAttendance(admin, reconnected, {
      minutes: 40,
      present: true,
      reason: 'Removed five disconnected minutes.',
      occurredAt: '2026-07-02T10:00:00.000Z',
    });
    expect(corrected).toMatchObject({
      correctionReason: 'Removed five disconnected minutes.',
      correctedBy: 'admin-rabbi',
    });
    expect(
      attendanceVisibleTo(parent, [
        corrected,
        { ...corrected, studentId: 'student-2', householdId: 'household-2' },
      ]),
    ).toEqual([corrected]);
    expect(() =>
      correctAttendance(
        classAAdmin,
        { ...corrected, classId: 'class-b' },
        {
          minutes: 30,
          present: true,
          reason: 'Attempted cross-class correction.',
          occurredAt: '2026-07-03T10:00:00.000Z',
        },
      ),
    ).toThrow(/assignment to this class/);
  });

  it('OTV2-LEARNING-094/196 applies fixed thresholds and unique published review items only', () => {
    const reviews: ReviewCompletion[] = [
      {
        ...scope,
        reviewItemId: 'review-1',
        classId: 'class-a',
        studentId: 'student-1',
        householdId: 'household-1',
        adminPublished: true,
        completedAt: '2026-07-01T10:00:00.000Z',
      },
      {
        ...scope,
        reviewItemId: 'review-1',
        classId: 'class-a',
        studentId: 'student-1',
        householdId: 'household-1',
        adminPublished: true,
        completedAt: '2026-07-02T10:00:00.000Z',
      },
      {
        ...scope,
        reviewItemId: 'draft-review',
        classId: 'class-a',
        studentId: 'student-1',
        householdId: 'household-1',
        adminPublished: false,
        completedAt: '2026-07-03T10:00:00.000Z',
      },
    ];
    const badges = calculateBadges({
      studentId: 'student-1',
      scheduledOccurrenceIds: attendance.map((record) => record.occurrenceId),
      attendance,
      questions: [move(submitted(), 'answered_private', 'answer')],
      reviews,
    });
    expect(badges.map((badge) => badge.key)).toEqual([
      'consistency:1',
      'curious_learner:1',
      'review_ready:1',
    ]);
    expect(badges.find((badge) => badge.family === 'review_ready')?.qualifyingCount).toBe(1);
  });
});

describe('P22 announcements and recognition-safe leaderboard', () => {
  const learners: LeaderboardLearner[] = [
    {
      ...scope,
      studentId: 'student-1',
      householdId: 'household-1',
      classId: 'class-a',
      firstName: 'Ari',
      lastName: 'Cohen',
      currentAttendanceStreak: 5,
    },
    {
      ...scope,
      studentId: 'student-2',
      householdId: 'household-2',
      classId: 'class-a',
      firstName: 'Ben',
      lastName: 'Levi',
      currentAttendanceStreak: 4,
    },
  ];

  it('OTV2-LEARNING-100 projects program/class/Parent/Student announcements without leakage', () => {
    const announcements = [
      createAnnouncement({
        actor: admin,
        id: 'program',
        title: 'Program',
        body: 'Program update',
        audience: { kind: 'program' },
        publishedAt: '2026-07-01T10:00:00.000Z',
      }),
      createAnnouncement({
        actor: admin,
        id: 'parent',
        title: 'Parent',
        body: 'Household update',
        audience: { kind: 'parent', householdId: 'household-1' },
        publishedAt: '2026-07-01T10:00:00.000Z',
      }),
      createAnnouncement({
        actor: admin,
        id: 'student',
        title: 'Student',
        body: 'Private Student update',
        audience: { kind: 'student', studentId: 'student-1' },
        publishedAt: '2026-07-01T10:00:00.000Z',
      }),
    ];
    expect(
      announcementsVisibleTo(parent, announcements, '2026-07-02T10:00:00.000Z').map(
        (item) => item.id,
      ),
    ).toEqual(['program', 'parent']);
    expect(
      announcementsVisibleTo(peer, announcements, '2026-07-02T10:00:00.000Z').map(
        (item) => item.id,
      ),
    ).toEqual(['program']);
  });

  it('OTV2-LEARNING-095/197/238 keeps separate scoped ranks and changes names only on consent', () => {
    const question = move(submitted(), 'answered_private', 'answer-leaderboard');
    const consents: RecognitionConsent[] = [];
    const base = {
      actor: student,
      classId: 'class-a',
      learners,
      attendance: [],
      questions: [question],
      consents,
      asOf: '2026-07-20T10:00:00.000Z',
      aliasSecret: 'test-only-alias-secret',
    };
    const off = buildLeaderboard(base);
    const alias = off.categories.currentAttendanceStreak[1]?.displayName;
    expect(off.public).toBe(false);
    expect(off.combinedScore).toBeNull();
    expect(off.categories.currentAttendanceStreak[0]?.displayName).toBe('You');
    expect(alias).toMatch(/^Anonymous Student • [A-F0-9]{6}$/);
    expect(
      off.categories.approvedQuestionCount.find((entry) => entry.studentId === 'student-1')?.value,
    ).toBe(0);
    expect(
      calculateBadges({
        studentId: 'student-1',
        scheduledOccurrenceIds: [],
        attendance: [],
        questions: [question],
        reviews: [],
      }).map((badge) => badge.key),
    ).toContain('curious_learner:1');

    const approved = move(question, 'approved_for_class', 'approve-leaderboard');
    const approvedBoard = buildLeaderboard({ ...base, questions: [approved] });
    expect(
      approvedBoard.categories.approvedQuestionCount.find(
        (entry) => entry.studentId === 'student-1',
      )?.value,
    ).toBe(1);
    const published = move(approved, 'published', 'publish-leaderboard');
    const publishedBoard = buildLeaderboard({ ...base, questions: [published] });
    expect(
      publishedBoard.categories.approvedQuestionCount.find(
        (entry) => entry.studentId === 'student-1',
      )?.value,
    ).toBe(1);

    const optedIn = buildLeaderboard({
      ...base,
      consents: [
        {
          ...scope,
          studentId: 'student-2',
          optedIn: true,
          version: 1,
          changedAt: '2026-07-10T10:00:00.000Z',
          changedBy: 'parent-2',
        },
      ],
    });
    expect(optedIn.categories.currentAttendanceStreak[1]?.displayName).toBe('Ben L.');
    expect(optedIn.categories.currentAttendanceStreak.map((entry) => entry.studentId)).toEqual(
      off.categories.currentAttendanceStreak.map((entry) => entry.studentId),
    );

    const withdrawn = buildLeaderboard({
      ...base,
      consents: [
        {
          ...scope,
          studentId: 'student-2',
          optedIn: false,
          version: 2,
          changedAt: '2026-07-11T10:00:00.000Z',
          changedBy: 'parent-2',
        },
      ],
    });
    expect(withdrawn.categories.currentAttendanceStreak[1]?.displayName).toBe(alias);
    expect(() => buildLeaderboard({ ...base, actor: parent })).toThrow(/authenticated class/);
  });
});
