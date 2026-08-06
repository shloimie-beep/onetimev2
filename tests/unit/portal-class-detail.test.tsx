import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type {
  ParentPortalDashboard,
  StudentPortalDashboard,
  UpcomingClassSummary,
} from '../../packages/contracts/src/portals/index.ts';
import {
  ParentPortalFeature,
  StudentPortalFeature,
} from '../../apps/web/src/client/features/portals/PortalFeatures.tsx';

const occurrence: UpcomingClassSummary = {
  class_key: 'class_week_001',
  title: 'Weekly Mishnah',
  starts_at: '2026-08-16T16:00:00.000Z',
  status: 'upcoming',
  launch_action: {
    action_key: 'class-launch-1',
    label: 'Join class',
    kind: 'class_launch',
    method: 'POST',
    href: '/api/v1/portals/student/classes/class_week_001/launch',
    launch_token_ref: null,
    expires_at: null,
  },
};

describe('canonical Parent and Student class detail', () => {
  it('keeps Parent detail read-only and Student detail launch-scoped', () => {
    const parentMarkup = renderToStaticMarkup(
      <ParentPortalFeature
        viewState="ready"
        dashboard={parentDashboard()}
        activeSection="classes"
        selectedLearnerKey="learner-alpha"
        selectedClassKey={occurrence.class_key}
        actorFingerprint="parent-class-detail"
        onLaunchClass={() => undefined}
      />,
    );
    const studentMarkup = renderToStaticMarkup(
      <StudentPortalFeature
        viewState="ready"
        dashboard={studentDashboard()}
        selectedClassKey={occurrence.class_key}
        actorFingerprint="student-class-detail"
        onLaunchClass={() => undefined}
      />,
    );

    expect(parentMarkup).toContain('Parent class detail');
    expect(parentMarkup).toContain('Weekly Mishnah');
    expect(parentMarkup).toContain('Classroom entry stays Student-only');
    expect(parentMarkup).not.toContain('Join class');
    expect(studentMarkup).toContain('Student class detail');
    expect(studentMarkup).toContain('Join class');
    expect(studentMarkup).toContain('href="/app/student/calendar"');
    expect(studentMarkup).not.toMatch(/zoom|meeting|join_url/i);
  });

  it('fails an out-of-scope class id closed without a launch control', () => {
    const markup = renderToStaticMarkup(
      <StudentPortalFeature
        viewState="ready"
        dashboard={studentDashboard()}
        selectedClassKey="sibling-class"
        actorFingerprint="student-class-denied"
      />,
    );
    expect(markup).toContain('Class not available');
    expect(markup).not.toContain('sibling-class');
    expect(markup).not.toContain('Join class');
  });
});

function parentDashboard(): ParentPortalDashboard {
  const learner = {
    learner_key: 'learner-alpha',
    household_key: 'household-alpha',
    display_name: 'Alpha Learner',
    hebrew_name: null,
    grade_label: 'Grade 5',
    learner_status: 'active' as const,
    version: 1,
    created_at: '2026-08-01T08:00:00.000Z',
    updated_at: '2026-08-01T08:00:00.000Z',
  };
  return {
    household: {
      household_key: 'household-alpha',
      display_name: 'Alpha Family',
      active_learner_count: 1,
      max_active_learners: 3,
      consent_status: 'not_required',
      learner_limit_reached: false,
      version: 1,
    },
    learners: [learner],
    student_access: [],
    upcoming_classes: { [learner.learner_key]: [occurrence] },
    rewards: {
      [learner.learner_key]: { learner_key: learner.learner_key, balance: 0, event_count: 0 },
    },
    updates: { [learner.learner_key]: [] },
    helper: { available: false, reason: null, scope_label: 'Portal helper' },
    billing: { enabled: false, summary_label: null },
  };
}

function studentDashboard(): StudentPortalDashboard {
  return {
    learner: {
      learner_key: 'learner-alpha',
      household_key: 'household-alpha',
      display_name: 'Alpha Learner',
      hebrew_name: null,
      grade_label: 'Grade 5',
      learner_status: 'active',
      version: 1,
      created_at: '2026-08-01T08:00:00.000Z',
      updated_at: '2026-08-01T08:00:00.000Z',
    },
    upcoming_classes: [occurrence],
    library_items: [],
    progress: {
      attendance_count: 0,
      watch_minutes: 0,
      completed_items: 0,
      last_activity_at: null,
    },
    rewards: { learner_key: 'learner-alpha', balance: 0, event_count: 0 },
    updates: [],
    questions: [],
    helper: { available: false, reason: null, scope_label: 'Class Helper' },
  };
}
