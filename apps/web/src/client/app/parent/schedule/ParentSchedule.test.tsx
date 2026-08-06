import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ParentClassDetail, ParentSchedule } from './ParentSchedule.tsx';

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
    expect(html).toContain('href="/app/parent/classes/schedule-1"');
    expect(html).toContain('View class details');
    expect(html).not.toMatch(/join class|recording|library|private question/i);
  });

  it('renders a safe empty state', () => {
    const html = renderToStaticMarkup(<ParentSchedule entries={[]} students={[]} />);
    expect(html).toContain('No schedule items right now.');
    expect(html).toContain('role="status"');
  });

  it('encodes the schedule id in canonical class detail links', () => {
    const html = renderToStaticMarkup(
      <ParentSchedule
        entries={[
          {
            schedule_id: 'occurrence/1',
            student_id: 'student-1',
            title: 'One Time Mishnayos',
            starts_at: '2026-08-16T16:00:00.000Z',
            ends_at: '2026-08-16T16:30:00.000Z',
            status: 'upcoming',
          },
        ]}
        students={[{ student_id: 'student-1', display_name: 'Student One', state: 'active' }]}
      />,
    );
    expect(html).toContain('href="/app/parent/classes/occurrence%2F1"');
  });

  it('renders household-safe class detail without classroom entry', () => {
    const html = renderToStaticMarkup(
      <ParentClassDetail
        entry={{
          schedule_id: 'occurrence-1',
          student_id: 'student-1',
          title: 'One Time Mishnayos',
          starts_at: '2026-08-16T16:00:00.000Z',
          ends_at: '2026-08-16T16:30:00.000Z',
          status: 'upcoming',
        }}
        students={[{ student_id: 'student-1', display_name: 'Student One', state: 'active' }]}
      />,
    );
    expect(html).toContain('Parent class detail');
    expect(html).toContain('One Time Mishnayos');
    expect(html).toContain('Student One');
    expect(html).toContain('Classroom entry stays Student-only');
    expect(html).not.toMatch(/join|launch|zoom|meeting/i);
  });
});
