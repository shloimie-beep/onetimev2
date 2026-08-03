import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ParentProgressSummary } from './ParentProgressSummary.tsx';

describe('P13 Parent progress summary', () => {
  it('shows bounded attendance and badge summaries', () => {
    const html = renderToStaticMarkup(
      <ParentProgressSummary
        students={[{ student_id: 'student-1', display_name: 'Student One', state: 'active' }]}
        progress={[
          {
            student_id: 'student-1',
            attendance: {
              attended_sessions: 7,
              scheduled_sessions: 8,
              attendance_percent: 88,
              current_streak: 3,
            },
            badges: [
              {
                badge_id: 'badge-1',
                label: 'Consistent attendance',
                awarded_at: '2026-07-20T12:00:00Z',
              },
            ],
          },
        ]}
      />,
    );

    expect(html).toContain('Student One');
    expect(html).toContain('<dd>88%</dd>');
    expect(html).toContain('Consistent attendance');
    expect(html).not.toMatch(/question|answer|recording|library|classroom|href=/i);
  });

  it('does not invent progress when none is available', () => {
    const html = renderToStaticMarkup(<ParentProgressSummary progress={[]} students={[]} />);
    expect(html).toContain('No progress summary is available yet.');
  });
});
