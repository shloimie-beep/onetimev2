import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StudentLearningOverview } from './StudentLearningOverview.tsx';

const scope = {
  accountKey: 'account-1',
  productKey: 'one_time_mishnayos',
  runtimeTier: 'isolated_staging',
  verificationEnvironmentId: 'ci',
};

describe('P22 Student learning overview', () => {
  it('renders moderated labels and opaque entry keys with exact metric wording', () => {
    const html = renderToStaticMarkup(
      <StudentLearningOverview
        questions={[]}
        publishedQuestions={[
          {
            questionId: 'question-1',
            classId: 'class-a',
            question: 'What is reviewed?',
            answer: 'Only moderated material.',
            authorDisplayName: 'You',
            authorEntryKey: 'entry-opaque-a',
            publishedAt: '2026-08-01T00:00:00.000Z',
          },
        ]}
        announcements={[]}
        badges={[]}
        leaderboard={{
          ...scope,
          classId: 'class-a',
          windowStartsAt: '2026-07-01T00:00:00.000Z',
          windowEndsAt: '2026-08-01T00:00:00.000Z',
          categories: {
            attendanceCount: [
              {
                rank: 1,
                entryKey: 'entry-opaque-a',
                studentId: 'entry-opaque-a',
                displayName: 'You',
                value: 3,
              },
            ],
            currentAttendanceStreak: [],
            approvedQuestionCount: [],
          },
          combinedScore: null,
          public: false,
        }}
      />,
    );
    expect(html).toContain('Questions approved or published');
    expect(html).toContain('Asked by You');
    expect(html).toContain('data-author-entry-key="entry-opaque-a"');
    expect(html).not.toContain('Questions answered or approved');
  });
});
