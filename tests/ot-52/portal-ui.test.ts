import { readFileSync } from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { GamificationSummary } from '../../packages/contracts/src/gamification/index.ts';
import type {
  ParentPortalDashboard,
  RewardEvent,
  StudentPortalDashboard,
} from '../../packages/contracts/src/portals/index.ts';
import {
  ParentPortalFeature,
  StudentPortalFeature,
  type PortalViewState,
} from '../../apps/web/src/client/features/portals/PortalFeatures.tsx';

const portalFeatureStyles = readFileSync(
  path.resolve(process.cwd(), 'packages/brand-system/src/styles/portal.css'),
  'utf8',
);

describe('OT-52P portal UI modules', () => {
  it('renders parent controls without raw provider URLs or central shell assumptions', () => {
    const markup = renderToStaticMarkup(
      React.createElement(ParentPortalFeature, {
        viewState: 'ready',
        dashboard: parentDashboard(),
        actorFingerprint: 'parent-session-1',
        rewardHistory: {
          learner_alpha: [rewardEvent()],
        },
        onCreateLearner: () => undefined,
        onEditLearner: () => undefined,
        onArchiveLearner: () => undefined,
        onRestoreLearner: () => undefined,
        onStudentAccessAction: () => undefined,
        onLaunchClass: () => undefined,
        onOpenContent: () => undefined,
        onPreviewSupport: () => undefined,
      }),
    );

    expect(markup).toContain('Parent Portal');
    expect(markup).toContain('Household');
    expect(markup).toContain('Student access');
    expect(markup).toContain('Progress And Rewards');
    expect(markup).toContain('aria-label="Add learner"');
    expect(markup).toContain('Edit');
    expect(markup).toContain('Archive');
    expect(markup).not.toContain('unavailable in V1');
    expect(markup).not.toMatch(/https?:\/\/|zoom|meet|provider/i);
    expect(markup).not.toMatch(/CRM|Admin|View as/i);
  });

  it('renders the student portal without sibling selectors, billing, or parent controls', () => {
    const markup = renderToStaticMarkup(
      React.createElement(StudentPortalFeature, {
        viewState: 'ready',
        dashboard: studentDashboard(),
        actorFingerprint: 'student-session-1',
      }),
    );

    expect(markup).toContain('Student Portal');
    expect(markup).toContain('Today');
    expect(markup).toContain('Library');
    expect(markup).not.toMatch(
      /Sibling|Household|Billing|Student access|Archive|Restore|Parent Portal/i,
    );
    expect(markup).not.toContain('learner_sibling');
    expect(markup).not.toMatch(/https?:\/\/|zoom|meet|provider/i);
  });

  it('uses alert/status roles for non-ready states', () => {
    const states: PortalViewState[] = ['permission', 'offline', 'partial-error', 'session-expired'];
    const rendered = states.map((viewState) =>
      renderToStaticMarkup(
        React.createElement(ParentPortalFeature, {
          viewState,
          dashboard: null,
          actorFingerprint: `parent-${viewState}`,
          onRetry: () => undefined,
        }),
      ),
    );

    expect(rendered[0]).toContain('role="alert"');
    expect(rendered[1]).toContain('role="status"');
    expect(rendered[2]).toContain('Needs attention');
    expect(rendered[3]).toContain('Session expired');
  });

  it('keeps static rendering under the OT-52 30-sample harness threshold', () => {
    const metrics = measureStaticRenderSamples(30);
    expect(metrics.samples).toBe(30);
    expect(metrics.p95_ms).toBeLessThan(80);
  });
});

export function measureStaticRenderSamples(samples: number) {
  const durations: number[] = [];
  for (let index = 0; index < samples; index += 1) {
    const start = performance.now();
    renderToStaticMarkup(
      React.createElement(
        React.Fragment,
        null,
        React.createElement('style', null, portalFeatureStyles),
        React.createElement(ParentPortalFeature, {
          viewState: 'ready',
          dashboard: parentDashboard(),
          actorFingerprint: `parent-sample-${index}`,
        }),
        React.createElement(StudentPortalFeature, {
          viewState: 'ready',
          dashboard: studentDashboard(),
          actorFingerprint: `student-sample-${index}`,
        }),
      ),
    );
    durations.push(performance.now() - start);
  }
  durations.sort((left, right) => left - right);
  return {
    samples,
    p50_ms: percentile(durations, 0.5),
    p75_ms: percentile(durations, 0.75),
    p95_ms: percentile(durations, 0.95),
  };
}

export function parentDashboard(): ParentPortalDashboard {
  return {
    household: {
      household_key: 'household_alpha',
      display_name: 'Alpha Family',
      active_learner_count: 2,
      max_active_learners: 3,
      consent_status: 'not_required',
      learner_limit_reached: false,
      version: 1,
    },
    learners: [learner('learner_alpha', 'Alpha Learner'), learner('learner_beta', 'Beta Learner')],
    student_access: [
      {
        access_state_key: 'student_access_alpha',
        learner_key: 'learner_alpha',
        status: 'active',
        student_user_ref: 'student_user_alpha',
        last_operation_type: 'setup',
        last_operation_at: '2026-07-14T09:00:00.000Z',
        version: 2,
      },
      {
        access_state_key: 'student_access_beta',
        learner_key: 'learner_beta',
        status: 'not_configured',
        student_user_ref: null,
        last_operation_type: null,
        last_operation_at: null,
        version: 1,
      },
    ],
    upcoming_classes: {
      learner_alpha: [classSummary()],
      learner_beta: [],
    },
    rewards: {
      learner_alpha: { learner_key: 'learner_alpha', balance: 8, event_count: 2 },
      learner_beta: { learner_key: 'learner_beta', balance: 0, event_count: 0 },
    },
    gamification: {
      learner_alpha: gamificationSummary('learner_alpha', 8),
      learner_beta: gamificationSummary('learner_beta', 0),
    },
    updates: {
      learner_alpha: [update('update_parent_alpha', 'parent')],
      learner_beta: [],
    },
    helper: {
      available: false,
      reason:
        'Portal helper is being prepared for your household. Send a support request and we will route it for review.',
      scope_label: 'Portal helper',
    },
    billing: { enabled: false, summary_label: null },
  };
}

export function studentDashboard(): StudentPortalDashboard {
  return {
    learner: learner('learner_student_self', 'Student Learner'),
    upcoming_classes: [classSummary()],
    library_items: [
      {
        item_key: 'library_weekly_recording',
        title: 'Weekly recording',
        item_type: 'video',
        status: 'published',
        open_action: action('content_open', 'Open recording'),
      },
    ],
    progress: {
      attendance_count: 3,
      watch_minutes: 75,
      completed_items: 2,
      last_activity_at: '2026-07-14T08:00:00.000Z',
    },
    rewards: { learner_key: 'learner_student_self', balance: 6, event_count: 2 },
    gamification: gamificationSummary('learner_student_self', 6),
    updates: [update('update_student_self', 'student')],
    questions: [],
    helper: {
      available: false,
      reason:
        'Class Helper is being prepared for this class. Send a private question and we will route it for review.',
      scope_label: 'Portal helper',
    },
  };
}

function learner(learnerKey: string, displayName: string) {
  return {
    learner_key: learnerKey,
    household_key: 'household_alpha',
    display_name: displayName,
    hebrew_name: null,
    grade_label: 'Grade 5',
    learner_status: 'active' as const,
    version: 1,
    created_at: '2026-07-14T08:00:00.000Z',
    updated_at: '2026-07-14T08:00:00.000Z',
  };
}

function classSummary() {
  return {
    class_key: 'class_week_001',
    title: 'Weekly Mishnah',
    starts_at: '2026-07-15T18:00:00.000Z',
    status: 'upcoming' as const,
    launch_action: action('class_launch', 'Join class'),
  };
}

function action(kind: 'class_launch' | 'content_open' | 'review_sheet_open', label: string) {
  return {
    action_key: `${kind}_action`,
    label,
    kind,
    method: 'POST' as const,
    href: `/api/v1/portals/actions/${kind}`,
    launch_token_ref: `${kind}_ref`,
    expires_at: '2026-07-14T09:00:00.000Z',
  };
}

function update(updateKey: string, audience: 'parent' | 'student') {
  return {
    update_key: updateKey,
    learner_key: audience === 'parent' ? 'learner_alpha' : 'learner_student_self',
    audience,
    title: 'Class update',
    body: 'The next class is ready in the portal.',
    published_at: '2026-07-14T08:00:00.000Z',
    read_at: null,
  };
}

function rewardEvent(): RewardEvent {
  return {
    reward_event_key: 'reward_attendance_001',
    learner_key: 'learner_alpha',
    points_delta: 5,
    reason_code: 'attendance',
    reason_label: 'Attended live class',
    actor_ref: 'parent_user_alpha',
    source_type: 'parent_capability',
    correction_of_event_key: null,
    occurred_at: '2026-07-14T08:00:00.000Z',
  };
}

function gamificationSummary(learnerKey: string, points: number): GamificationSummary {
  return {
    learner_key: learnerKey,
    learning_points: points,
    level: {
      level: points >= 50 ? 2 : 1,
      title: points >= 50 ? 'Steady Learner' : 'Getting Started',
      min_points: points >= 50 ? 50 : 0,
      next_level_points: points >= 50 ? 125 : 50,
      progress_percent: Math.min(100, Math.round((points / 50) * 100)),
    },
    progress: {
      mishnayos_completed: points > 0 ? 1 : 0,
      mishnayos_target: 24,
      classes_attended: points > 0 ? 1 : 0,
      classes_total: 4,
      review_items_completed: points > 0 ? 1 : 0,
      review_items_total: 4,
      retention_reviews_completed: 0,
      retention_percent: 0,
    },
    streaks: [
      {
        kind: 'attendance',
        current_count: points > 0 ? 1 : 0,
        best_count: points > 0 ? 1 : 0,
        grace_remaining: 2,
        last_earned_at: points > 0 ? '2026-07-14T08:00:00.000Z' : null,
        status: points > 0 ? 'active' : 'empty',
      },
      {
        kind: 'review',
        current_count: points > 0 ? 1 : 0,
        best_count: points > 0 ? 1 : 0,
        grace_remaining: 2,
        last_earned_at: points > 0 ? '2026-07-14T08:00:00.000Z' : null,
        status: points > 0 ? 'active' : 'empty',
      },
    ],
    badges: [],
    milestones: [],
    accomplishments: points
      ? [
          {
            event_key: `event_${learnerKey}`,
            title: 'Class attended',
            detail: '5 learning points recorded.',
            reason_code: 'attendance_present',
            points_delta: points,
            source_type: 'admin',
            correction_of_event_key: null,
            occurred_at: '2026-07-14T08:00:00.000Z',
            reversed: false,
          },
        ]
      : [],
    parent_rewards: [],
    class_milestones: [],
    celebration: null,
    guardrails: {
      no_public_rankings: true,
      no_random_rewards: true,
      meaningful_learning_only: true,
      student_scope: learnerKey === 'learner_student_self' ? 'self_only' : 'household',
    },
  };
}

function percentile(values: number[], quantile: number) {
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * quantile) - 1));
  return Number((values[index] ?? 0).toFixed(3));
}
