import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ParentLearningSnapshot } from './api.ts';
import {
  ParentLearningWorkspace,
  parentClassroomDocumentNavigationRequired,
  parentLearningPrimaryHref,
  parentLearnerCapacityLabel,
} from './ParentLearningWorkspace.tsx';

const snapshot: ParentLearningSnapshot = {
  contract_version: '1.0.0',
  participant_id: 'parent:household-1',
  household_id: 'household-1',
  display_name: 'Ari Levi',
  state: 'active',
  learner_ordinal: 1,
  capacity: {
    total_learners: 4,
    parent_learners: 1,
    child_student_limit: 3,
    active_child_students: 1,
    available_child_student_seats: 2,
  },
  class_entitlement: {
    class_series_key: 'class_series_one_time_daily',
    class_title: 'Daily One Time Mishnayos',
    effective_at: '2026-08-16T10:00:00.000Z',
  },
  next_class: {
    occurrence_id: 'occurrence-1',
    title: 'Today\u2019s Mishnayos',
    starts_at: '2026-08-16T16:00:00.000Z',
    ends_at: '2026-08-16T16:30:00.000Z',
    join_opens_at: '2026-08-16T15:55:00.000Z',
    join_closes_at: '2026-08-16T16:35:00.000Z',
    state: 'scheduled',
    launch_action: {
      action_key: 'class-launch-1',
      label: 'Join class',
      kind: 'class_launch',
      method: 'POST',
      href: '/api/v1/portals/parent/classroom/production-basic/launch',
      launch_token_ref: null,
      expires_at: '2026-08-16T16:35:00.000Z',
    },
  },
  library_items: [
    {
      content_id: 'content-1',
      content_version_id: 'content-version-1',
      title: 'Berachos 1:1 review',
      item_type: 'video',
      published_at: '2026-08-15T12:00:00.000Z',
      progress: {
        position_ms: 90_000,
        duration_ms: 300_000,
        completed: false,
        updated_at: '2026-08-16T12:00:00.000Z',
      },
      open_action: {
        action_key: 'content-open-1',
        label: 'Continue lesson',
        kind: 'content_open',
        method: 'GET',
        href: '/api/v1/portals/parent/learning/content/content-1/open',
        launch_token_ref: null,
        expires_at: null,
      },
    },
  ],
  activity: {
    attended_occurrence_count: 2,
    started_content_count: 3,
    completed_content_count: 1,
    submitted_question_count: 4,
  },
};

describe('Parent-first learning workspace', () => {
  it('requires a fresh protected shell when entering or leaving Parent Classroom', () => {
    expect(parentClassroomDocumentNavigationRequired('/app/parent', '/app/parent/classroom')).toBe(
      true,
    );
    expect(parentClassroomDocumentNavigationRequired('/app/parent/classroom', '/app/parent')).toBe(
      true,
    );
    expect(parentClassroomDocumentNavigationRequired('/app/parent', '/app/parent/library')).toBe(
      false,
    );
    expect(
      parentClassroomDocumentNavigationRequired('/app/parent', '/app/parent/classroom/untrusted'),
    ).toBe(false);
  });

  it('makes the Parent learner the home identity and keeps child management secondary', () => {
    const html = renderToStaticMarkup(
      <ParentLearningWorkspace view="today" initial={{ snapshot, csrf_token: 'csrf-parent' }} />,
    );

    expect(html).toContain('Ari Levi');
    expect(html).toContain('Parent learner + 1 of 3 child learners');
    expect(html).toContain('See One Time now');
    expect(html).toContain('href="/app/parent/classroom"');
    expect(html).toContain('Add Student');
    expect(html).toContain('href="/app/parent/students/new"');
    expect(html.indexOf('See One Time now')).toBeLessThan(html.indexOf('Add Student'));
    expect(html).not.toContain('Myself');
    expect(html).not.toMatch(/separate Student (?:login|profile)/i);
    expect(html).not.toContain('Lessons completed');
  });

  it('uses the stable Parent classroom when no governed deep link is available', () => {
    const withoutClass = { ...snapshot, next_class: null };
    expect(parentLearningPrimaryHref(withoutClass)).toBe('/app/parent/classroom');
    expect(parentLearnerCapacityLabel(withoutClass.capacity)).toBe(
      'Parent learner + 1 of 3 child learners',
    );
  });

  it('renders bounded Parent views without borrowing Student identity copy', () => {
    for (const [view, heading] of [
      ['classroom', 'Next class'],
      ['library', 'Lessons'],
      ['questions', 'Ask Rabbi Eli'],
    ] as const) {
      const html = renderToStaticMarkup(
        <ParentLearningWorkspace view={view} initial={{ snapshot, csrf_token: 'csrf-parent' }} />,
      );
      expect(html).toContain(heading);
      expect(html).toContain('Parent learner');
      expect(html).not.toMatch(/signed-in Student|Student account|Myself/i);
    }
  });

  it('renders only server-supplied class and entitled library actions', () => {
    const classroom = renderToStaticMarkup(
      <ParentLearningWorkspace
        view="classroom"
        initial={{ snapshot, csrf_token: 'csrf-parent' }}
      />,
    );
    expect(classroom).toContain('Today\u2019s Mishnayos');
    expect(classroom).toContain('Join class');
    expect(classroom).toContain('id="zmmtg-root"');
    expect(classroom).not.toContain('href="/classroom/launch"');
    expect(classroom).not.toContain('will appear here');

    const library = renderToStaticMarkup(
      <ParentLearningWorkspace view="library" initial={{ snapshot, csrf_token: 'csrf-parent' }} />,
    );
    expect(library).toContain('Berachos 1:1 review');
    expect(library).toContain('Video');
    expect(library).toContain('Continue lesson');
    expect(library).not.toContain('1m 30s of 5m');
    expect(library).not.toContain('will appear here');
  });

  it('uses truthful empty states only when class and library data are absent', () => {
    const emptySnapshot = { ...snapshot, next_class: null, library_items: [] };
    const classroom = renderToStaticMarkup(
      <ParentLearningWorkspace
        view="classroom"
        initial={{ snapshot: emptySnapshot, csrf_token: 'csrf-parent' }}
      />,
    );
    const library = renderToStaticMarkup(
      <ParentLearningWorkspace
        view="library"
        initial={{ snapshot: emptySnapshot, csrf_token: 'csrf-parent' }}
      />,
    );
    expect(classroom).toContain('No upcoming Parent class is scheduled yet.');
    expect(library).toContain('No entitled lessons are available yet.');
  });
});
