import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AdminLearningWorkspace, questionModerationOptions } from './AdminLearningWorkspace.tsx';

describe('P22 Admin learning workspace', () => {
  it('renders only the authenticated server projection', () => {
    const html = renderToStaticMarkup(
      <AdminLearningWorkspace mode="questions" questions={[]} announcements={[]} attendance={[]} />,
    );
    expect(html).toContain('Question moderation');
    expect(html).toContain('Private Student questions');
    expect(html).not.toMatch(/vimeo|stripe|provider_account|consent mutation/iu);
  });

  it('renders exact answer and moderation transitions for a version-fenced question', () => {
    const html = renderToStaticMarkup(
      <AdminLearningWorkspace
        mode="questions"
        questions={[
          {
            accountKey: 'account-one-time',
            productKey: 'one_time_mishnayos',
            runtimeTier: 'test',
            verificationEnvironmentId: 'ci',
            id: 'question-one',
            studentId: 'student-one',
            householdId: 'household-one',
            classId: 'class-one',
            body: 'What does this Mishnah mean?',
            answer: null,
            state: 'submitted',
            version: 3,
            submittedAt: '2026-08-06T12:00:00.000Z',
            updatedAt: '2026-08-06T12:00:00.000Z',
          },
        ]}
        announcements={[]}
        attendance={[]}
        onTransitionQuestion={async () => undefined}
      />,
    );
    expect(html).toContain('What does this Mishnah mean?');
    expect(html).toContain('Answer privately');
    expect(html).toContain('Approve for class');
    expect(html).toContain('Save moderation');
    expect(html).not.toMatch(/zoom|provider|meeting|registrant/iu);
  });

  it('exposes only domain-valid next states', () => {
    expect(questionModerationOptions('submitted').map(({ value }) => value)).toEqual([
      'answered_private',
      'approved_for_class',
      'closed',
      'declined',
    ]);
    expect(questionModerationOptions('published').map(({ value }) => value)).toEqual([
      'approved_for_class',
      'closed',
    ]);
    expect(questionModerationOptions('closed')).toEqual([]);
    expect(questionModerationOptions('declined')).toEqual([]);
  });

  it('renders the provider-independent audited attendance correction form only in attendance mode', () => {
    const html = renderToStaticMarkup(
      <AdminLearningWorkspace
        mode="attendance"
        questions={[]}
        announcements={[]}
        attendance={[]}
        onCorrectAttendance={async () => undefined}
      />,
    );
    expect(html).toContain('Record an audited correction');
    expect(html).toContain('Student ID');
    expect(html).toContain('Occurrence ID');
    expect(html).toContain('Record audited correction');
    expect(html).not.toContain('Private Student questions');
  });
});
