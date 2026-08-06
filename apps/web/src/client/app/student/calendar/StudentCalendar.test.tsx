import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { StudentCalendar } from './StudentCalendar.tsx';

describe('Student calendar', () => {
  it('renders the protected class action without provider details', () => {
    const markup = renderToStaticMarkup(
      <StudentCalendar
        classes={[
          {
            class_key: 'occurrence-1',
            title: 'One Time Mishnayos',
            starts_at: '2026-08-16T16:00:00.000Z',
            status: 'upcoming',
            launch_action: {
              action_key: 'launch-1',
              label: 'Open class',
              kind: 'class_launch',
              method: 'POST',
              href: null,
              launch_token_ref: null,
              expires_at: null,
            },
          },
        ]}
        onLaunch={vi.fn()}
      />,
    );
    expect(markup).toContain('Sunday, August 16, 2026 at 7:00 PM');
    expect(markup).toContain('Open class');
    expect(markup).toContain('href="/app/student/classes/occurrence-1"');
    expect(markup).toContain('View class details');
    expect(markup).not.toMatch(/zoom|join_url|meeting/i);
  });
});
