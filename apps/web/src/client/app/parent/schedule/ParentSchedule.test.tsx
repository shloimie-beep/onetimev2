import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ParentSchedule } from './ParentSchedule.tsx';

describe('P13 Parent schedule', () => {
  it('renders a keyboard-readable household agenda without learner access controls', () => {
    const html = renderToStaticMarkup(
      <ParentSchedule
        students={[{ student_id: 'student-1', display_name: 'Student One', state: 'active' }]}
        entries={[
          {
            schedule_id: 'schedule-1',
            student_id: 'student-1',
            title: 'Weekly learning session',
            starts_at: '2026-08-02T17:00:00Z',
            ends_at: '2026-08-02T18:00:00Z',
            status: 'upcoming',
          },
        ]}
      />,
    );

    expect(html).toContain('Weekly learning session');
    expect(html).toContain('Student One');
    expect(html).toContain('dateTime="2026-08-02T17:00:00Z"');
    expect(html).not.toMatch(/href=|join class|recording|library|private question/i);
  });

  it('renders a safe empty state', () => {
    const html = renderToStaticMarkup(<ParentSchedule entries={[]} students={[]} />);
    expect(html).toContain('No schedule items right now.');
    expect(html).toContain('role="status"');
  });
});
