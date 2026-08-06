import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AdminLearningWorkspace } from './AdminLearningWorkspace.tsx';

describe('P22 Admin learning workspace', () => {
  it('renders only the authenticated server projection', () => {
    const html = renderToStaticMarkup(
      <AdminLearningWorkspace mode="questions" questions={[]} announcements={[]} attendance={[]} />,
    );
    expect(html).toContain('Question moderation');
    expect(html).toContain('Private Student questions');
    expect(html).not.toMatch(/vimeo|stripe|provider_account|consent mutation/iu);
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
