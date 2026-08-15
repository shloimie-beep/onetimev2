import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ParentUpdates } from './ParentUpdates.tsx';

const support = {
  label: 'Contact support' as const,
  description: 'Get help with your Parent account or household.',
  href: '/app/parent/support' as const,
};

describe('P13 Parent updates and support entry', () => {
  it.each([
    {
      household: 'zero-Student',
      studentAction: {
        active_student_count: 0,
        available_student_seats: 3,
        can_manage_students: true,
      },
      expectedLabel: 'Add your first Student',
      available: true,
    },
    {
      household: 'partial',
      studentAction: {
        active_student_count: 1,
        available_student_seats: 2,
        can_manage_students: true,
      },
      expectedLabel: 'Add another Student',
      available: true,
    },
    {
      household: 'full',
      studentAction: {
        active_student_count: 3,
        available_student_seats: 0,
        can_manage_students: true,
      },
      expectedLabel: 'All Student seats are in use',
      available: false,
    },
  ])(
    'renders current $household CTA truth above Parent Updates',
    ({ studentAction, expectedLabel, available }) => {
      const html = renderToStaticMarkup(
        <ParentUpdates support={support} updates={[]} studentAction={studentAction} />,
      );
      expect(html).toContain(expectedLabel);
      if (available) {
        expect(html).toContain('href="/app/parent/students/new"');
        expect(html).not.toContain('aria-disabled="true"');
      } else {
        expect(html).not.toContain('href="/app/parent/students/new"');
        expect(html).toContain('aria-disabled="true"');
      }
    },
  );

  it('fails closed when Parent Student management is unavailable', () => {
    const html = renderToStaticMarkup(
      <ParentUpdates
        support={support}
        updates={[]}
        studentAction={{
          active_student_count: 1,
          available_student_seats: 2,
          can_manage_students: false,
        }}
      />,
    );
    expect(html).toContain('Adding a Student is unavailable');
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain('href="/app/parent/students/new"');
  });

  it('renders Parent notices, newsletters, reminders, and the bounded support link', () => {
    const html = renderToStaticMarkup(
      <ParentUpdates
        support={support}
        updates={[
          {
            update_id: 'update-1',
            kind: 'newsletter',
            title: 'July newsletter',
            summary: 'Household news and upcoming dates.',
            published_at: '2026-07-29T05:00:00Z',
          },
          {
            update_id: 'update-2',
            kind: 'reminder',
            title: 'Schedule reminder',
            summary: 'The next session starts Sunday.',
            published_at: '2026-07-29T06:00:00Z',
          },
        ]}
      />,
    );

    expect(html).toContain('July newsletter');
    expect(html).toContain('Schedule reminder');
    expect(html.indexOf('data-parent-welcome-pinned="true"')).toBeLessThan(
      html.indexOf('July newsletter'),
    );
    expect(html).toContain('href="/app/parent/support"');
    expect(html).not.toMatch(/\/app\/student|recording|library|private question|rabbi answer/i);
  });

  it('keeps support available when there are no updates', () => {
    const html = renderToStaticMarkup(<ParentUpdates support={support} updates={[]} />);
    expect(html).toContain('No current notices, newsletters, or reminders.');
    expect(html).toContain('Contact support');
    expect(html).toContain('Pinned Parent Companion welcome');
  });
});
