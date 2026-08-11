import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ParentClassDetail, ParentSchedule } from './ParentSchedule.tsx';

describe('P13 Parent schedule', () => {
  it('renders a keyboard-readable household agenda without learner access controls', () => {
    const html = renderToStaticMarkup(
      <ParentSchedule
        now={new Date('2026-08-01T00:00:00.000Z')}
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
    expect(html).toContain('1 Student is enrolled.');
    expect(html).toContain('dateTime="2026-08-02T17:00:00Z"');
    expect(html).toContain('href="/app/parent/classes/schedule-1"');
    expect(html).toContain('View class details');
    expect(html).not.toMatch(/join class|recording|library|private question/i);
  });

  it('renders a safe empty state', () => {
    const html = renderToStaticMarkup(<ParentSchedule entries={[]} students={[]} />);
    expect(html).toContain('No upcoming class is scheduled right now.');
    expect(html).toContain('role="status"');
  });

  it('deduplicates three enrollment rows and renders the 7 PM Israel-time occurrence once', () => {
    const html = renderToStaticMarkup(
      <ParentSchedule
        now={new Date('2026-08-11T00:00:00.000Z')}
        students={[
          { student_id: 'student-1', display_name: 'Student One', state: 'active' },
          { student_id: 'student-2', display_name: 'Student Two', state: 'active' },
          { student_id: 'student-3', display_name: 'Student Three', state: 'active' },
        ]}
        entries={[
          {
            schedule_id: 'occurrence-1',
            student_id: 'student-1',
            title: 'One Time Mishnayos',
            starts_at: '2026-08-16T16:00:00.000Z',
            ends_at: '2026-08-16T17:00:00.000Z',
            status: 'upcoming',
          },
          {
            schedule_id: 'occurrence-1',
            student_id: 'student-2',
            title: 'One Time Mishnayos',
            starts_at: '2026-08-16T16:00:00.000Z',
            ends_at: '2026-08-16T17:00:00.000Z',
            status: 'upcoming',
          },
          {
            schedule_id: 'occurrence-1',
            student_id: 'student-3',
            title: 'One Time Mishnayos',
            starts_at: '2026-08-16T16:00:00.000Z',
            ends_at: '2026-08-16T17:00:00.000Z',
            status: 'upcoming',
          },
          {
            schedule_id: 'occurrence-2',
            student_id: 'student-1',
            title: 'Later class',
            starts_at: '2026-08-17T16:00:00.000Z',
            ends_at: '2026-08-17T17:00:00.000Z',
            status: 'upcoming',
          },
        ]}
      />,
    );

    expect(html).toContain('Next Class');
    expect(html).toContain('3 Students are enrolled.');
    expect(html).toContain('7:00 PM');
    expect(html).toContain('Israel time (Asia/Jerusalem).');
    expect(html).toContain('href="/app/parent/classes/occurrence-1"');
    expect(html.match(/View class details/g)).toHaveLength(1);
    expect(html).not.toContain('Later class');
  });

  it('selects the chronologically earliest distinct upcoming class from reverse-ordered entries', () => {
    const html = renderToStaticMarkup(
      <ParentSchedule
        now={new Date('2026-08-11T00:00:00.000Z')}
        students={[{ student_id: 'student-1', display_name: 'Student One', state: 'active' }]}
        entries={[
          {
            schedule_id: 'later-occurrence',
            student_id: 'student-1',
            title: 'Later class',
            starts_at: '2026-08-17T16:00:00.000Z',
            ends_at: '2026-08-17T17:00:00.000Z',
            status: 'upcoming',
          },
          {
            schedule_id: 'earlier-occurrence',
            student_id: 'student-1',
            title: 'Earlier class',
            starts_at: '2026-08-16T16:00:00.000Z',
            ends_at: '2026-08-16T17:00:00.000Z',
            status: 'upcoming',
          },
        ]}
      />,
    );

    expect(html).toContain('Earlier class');
    expect(html).toContain('href="/app/parent/classes/earlier-occurrence"');
    expect(html).not.toContain('Later class');
  });

  it('does not present a future cancelled class as the next class', () => {
    const html = renderToStaticMarkup(
      <ParentSchedule
        now={new Date('2026-08-11T00:00:00.000Z')}
        students={[{ student_id: 'student-1', display_name: 'Student One', state: 'active' }]}
        entries={[
          {
            schedule_id: 'cancelled-occurrence',
            student_id: 'student-1',
            title: 'Cancelled class',
            starts_at: '2026-08-16T16:00:00.000Z',
            ends_at: '2026-08-16T17:00:00.000Z',
            status: 'cancelled',
          },
          {
            schedule_id: 'upcoming-occurrence',
            student_id: 'student-1',
            title: 'Upcoming class',
            starts_at: '2026-08-17T16:00:00.000Z',
            ends_at: '2026-08-17T17:00:00.000Z',
            status: 'upcoming',
          },
        ]}
      />,
    );

    expect(html).toContain('Upcoming class');
    expect(html).not.toContain('Cancelled class');
  });

  it('encodes the schedule id in canonical class detail links', () => {
    const html = renderToStaticMarkup(
      <ParentSchedule
        now={new Date('2026-08-11T00:00:00.000Z')}
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
