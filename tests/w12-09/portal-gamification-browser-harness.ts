import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AxeBuilder } from '@axe-core/playwright';
import { chromium, type Browser } from 'playwright';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  AdminGamificationDashboardResponse,
  GamificationSummary,
  ParentPortalDashboard,
  StudentPortalDashboard,
} from '../../packages/contracts/src/index.ts';
import { GamificationAdminPanel } from '../../apps/web/src/client/app/gamification-admin/GamificationAdminPanel.tsx';
import {
  ParentPortalFeature,
  StudentPortalFeature,
  type PortalViewState,
} from '../../apps/web/src/client/features/portals/PortalFeatures.tsx';

const outputDir = path.resolve(process.cwd(), 'ops/codex-runs/W12-09/evidence/screenshots');
const reportPath = path.resolve(
  process.cwd(),
  'ops/codex-runs/W12-09/evidence/BROWSER-JOURNEYS.json',
);
const portalFeatureStyles = await readFile(
  path.resolve(process.cwd(), 'packages/brand-system/src/styles/portal.css'),
  'utf8',
);

const viewports = [
  { name: 'phone-360x800', width: 360, height: 800 },
  { name: 'phone-390x844', width: 390, height: 844 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'desktop-1440x1000', width: 1440, height: 1000 },
];

const scenarios = [
  'student-celebration',
  'parent-rewards',
  'admin-reversal',
  'student-loading',
  'parent-empty',
  'student-offline',
  'admin-error',
] as const;

try {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const report = await runHarness(browser);
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    if (
      report.accessibility.critical_or_serious_violations > 0 ||
      report.layout.horizontal_overflow.length > 0
    ) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
} catch (error) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(
    reportPath,
    `${JSON.stringify(
      {
        status: 'blocked',
        reason: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  process.exitCode = 1;
}

async function runHarness(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const screenshots: string[] = [];
  const violations: Array<{ scenario: string; viewport: string; id: string; impact: string }> = [];
  const overflow: Array<{
    scenario: string;
    viewport: string;
    scrollWidth: number;
    innerWidth: number;
  }> = [];
  try {
    for (const scenario of scenarios) {
      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.setContent(htmlForScenario(scenario), { waitUntil: 'load' });
        await page.screenshot({
          path: path.join(outputDir, `${scenario}-${viewport.name}.png`),
          fullPage: true,
        });
        screenshots.push(`${scenario}-${viewport.name}.png`);
        const axe = await new AxeBuilder({ page }).analyze();
        for (const violation of axe.violations) {
          if (violation.impact === 'critical' || violation.impact === 'serious') {
            violations.push({
              scenario,
              viewport: viewport.name,
              id: violation.id,
              impact: violation.impact,
            });
          }
        }
        const layout = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        if (layout.scrollWidth > layout.innerWidth + 1) {
          overflow.push({ scenario, viewport: viewport.name, ...layout });
        }
      }
    }
  } finally {
    await context.close();
  }
  return {
    status: violations.length === 0 && overflow.length === 0 ? 'passed' : 'failed',
    generated_at: new Date().toISOString(),
    viewports,
    scenarios,
    screenshots,
    accessibility: {
      critical_or_serious_violations: violations.length,
      violations,
    },
    layout: {
      horizontal_overflow: overflow,
    },
  };
}

function htmlForScenario(scenario: (typeof scenarios)[number]) {
  const element =
    scenario === 'student-celebration'
      ? React.createElement(StudentPortalFeature, {
          viewState: 'ready',
          dashboard: studentDashboard(),
          actorFingerprint: 'student-w12-09',
        })
      : scenario === 'parent-rewards'
        ? React.createElement(ParentPortalFeature, {
            viewState: 'ready',
            dashboard: parentDashboard(),
            selectedLearnerKey: 'learner_alpha',
            actorFingerprint: 'parent-w12-09',
            onCreateRewardGoal: () => undefined,
          })
        : scenario === 'admin-reversal'
          ? React.createElement(GamificationAdminPanel, {
              dashboard: adminDashboard(),
              loading: false,
              error: '',
              onRetry: () => undefined,
            })
          : scenario === 'student-loading'
            ? React.createElement(StudentPortalFeature, {
                viewState: 'loading' satisfies PortalViewState,
                dashboard: null,
                actorFingerprint: 'student-loading',
              })
            : scenario === 'parent-empty'
              ? React.createElement(ParentPortalFeature, {
                  viewState: 'ready',
                  dashboard: parentEmptyDashboard(),
                  actorFingerprint: 'parent-empty',
                })
              : scenario === 'student-offline'
                ? React.createElement(StudentPortalFeature, {
                    viewState: 'offline' satisfies PortalViewState,
                    dashboard: null,
                    actorFingerprint: 'student-offline',
                  })
                : React.createElement(GamificationAdminPanel, {
                    dashboard: null,
                    loading: false,
                    error: 'Learning rewards could not load.',
                    onRetry: () => undefined,
                  });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>W12-09 ${scenario}</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>${pageStyles()}</style></head><body>${renderToStaticMarkup(element)}</body></html>`;
}

function pageStyles() {
  return `
    * { box-sizing: border-box; }
    body { margin: 0; background: #050505; font-family: Arial, sans-serif; color: #fff9d8; }
    ${portalFeatureStyles}
    .readonly-list { display: grid; gap: 14px; }
    .readonly-row, .state-panel {
      background: #111;
      border: 1px solid rgba(255, 210, 31, 0.24);
      border-radius: 8px;
      padding: 18px;
      color: #fff9d8;
    }
    .readonly-row { display: grid; gap: 14px; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.5fr); }
    .readonly-row dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 0; }
    .readonly-row dl div { background: #191919; border-radius: 8px; padding: 10px; }
    .readonly-row dt { color: #d9d2a9; }
    .readonly-row dd { margin: 4px 0 0; color: #fff; font-weight: 800; overflow-wrap: anywhere; }
    .readonly-row h2, .readonly-row h3, .state-panel h2 { color: #ffd21f; margin: 0 0 6px; }
    .readonly-row p, .state-panel p { color: #d9d2a9; margin: 0; }
    .button-primary { min-height: 44px; border: 0; border-radius: 8px; background: #ffd21f; color: #111; font-weight: 800; padding: 0 14px; }
    @media (max-width: 760px) { .readonly-row, .readonly-row dl { grid-template-columns: 1fr; } }
  `;
}

function parentDashboard(): ParentPortalDashboard {
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
      studentAccess('learner_alpha', 'active'),
      studentAccess('learner_beta', 'not_configured'),
    ],
    upcoming_classes: {
      learner_alpha: [classSummary()],
      learner_beta: [],
    },
    rewards: {
      learner_alpha: { learner_key: 'learner_alpha', balance: 88, event_count: 12 },
      learner_beta: { learner_key: 'learner_beta', balance: 0, event_count: 0 },
    },
    gamification: {
      learner_alpha: gamificationSummary('learner_alpha', 88, 'household'),
      learner_beta: gamificationSummary('learner_beta', 0, 'household'),
    },
    updates: { learner_alpha: [], learner_beta: [] },
    helper: {
      available: false,
      reason: 'Portal helper is being prepared.',
      scope_label: 'Portal helper',
    },
    billing: { enabled: false, summary_label: null },
  };
}

function parentEmptyDashboard(): ParentPortalDashboard {
  return {
    ...parentDashboard(),
    household: {
      ...parentDashboard().household,
      active_learner_count: 0,
      learner_limit_reached: false,
    },
    learners: [],
    student_access: [],
    upcoming_classes: {},
    rewards: {},
    gamification: {},
    updates: {},
  };
}

function studentDashboard(): StudentPortalDashboard {
  return {
    learner: learner('learner_student_self', 'Student Learner'),
    upcoming_classes: [classSummary()],
    library_items: [
      {
        item_key: 'recording_week_001',
        title: 'Weekly recording',
        item_type: 'video',
        status: 'published',
        open_action: action('content_open', 'Open recording', 'GET'),
      },
      {
        item_key: 'review_week_001',
        title: 'Review sheet',
        item_type: 'review',
        status: 'published',
        open_action: action('review_sheet_open', 'Open review', 'GET'),
      },
    ],
    progress: {
      attendance_count: 4,
      watch_minutes: 90,
      completed_items: 5,
      last_activity_at: '2026-07-16T20:00:00.000Z',
    },
    rewards: { learner_key: 'learner_student_self', balance: 88, event_count: 12 },
    gamification: {
      ...gamificationSummary('learner_student_self', 88, 'self_only'),
      celebration: {
        title: 'Mishnah completed',
        detail: '6 learning points recorded.',
        event_key: 'reward_student_latest',
      },
    },
    updates: [],
    questions: [],
    helper: {
      available: false,
      reason: 'Class Helper is being prepared.',
      scope_label: 'Class Helper',
    },
  };
}

function adminDashboard(): AdminGamificationDashboardResponse {
  return {
    success: true,
    dashboard: {
      generated_at: '2026-07-17T12:00:00.000Z',
      aggregate: {
        learner_count: 2,
        total_learning_points: 151,
        active_attendance_streaks: 1,
        average_retention_percent: 60,
      },
      learners: [
        {
          learner_key: 'learner_alpha',
          household_key: 'household_alpha',
          display_name: 'Alpha Learner',
          learning_points: 88,
          level_title: 'Steady Learner',
          attendance_streak: 4,
          review_streak: 3,
          retention_percent: 60,
          last_activity_at: '2026-07-16T20:00:00.000Z',
        },
        {
          learner_key: 'learner_beta',
          household_key: 'household_beta',
          display_name: 'Beta Learner',
          learning_points: 63,
          level_title: 'Steady Learner',
          attendance_streak: 2,
          review_streak: 1,
          retention_percent: 50,
          last_activity_at: '2026-07-15T20:00:00.000Z',
        },
      ],
      class_milestones: [
        {
          class_milestone_key: 'class_milestone_001',
          title: 'First four classes',
          description: 'The class completed its first four Mishnayos sessions.',
          progress_current: 4,
          progress_target: 4,
          status: 'earned',
          earned_at: '2026-07-16T20:00:00.000Z',
        },
      ],
      correction_audit: [
        {
          correction_key: 'correction_001',
          learner_key: 'learner_alpha',
          corrected_event_key: 'reward_wrong_attendance',
          reversal_event_key: 'reward_reversal_001',
          reason: 'Attendance was entered for the wrong learner.',
          actor_ref: 'owner_user',
          created_at: '2026-07-17T11:00:00.000Z',
        },
      ],
      guardrails: {
        no_public_rankings: true,
        no_random_rewards: true,
        meaningful_learning_only: true,
        student_scope: 'authorized_staff',
      },
    },
  };
}

function gamificationSummary(
  learnerKey: string,
  points: number,
  scope: GamificationSummary['guardrails']['student_scope'],
): GamificationSummary {
  return {
    learner_key: learnerKey,
    learning_points: points,
    level: {
      level: points >= 50 ? 2 : 1,
      title: points >= 50 ? 'Steady Learner' : 'Getting Started',
      min_points: points >= 50 ? 50 : 0,
      next_level_points: 125,
      progress_percent: Math.min(100, Math.round(((points - (points >= 50 ? 50 : 0)) / 75) * 100)),
    },
    progress: {
      mishnayos_completed: points > 0 ? 8 : 0,
      mishnayos_target: 24,
      classes_attended: points > 0 ? 4 : 0,
      classes_total: 8,
      review_items_completed: points > 0 ? 5 : 0,
      review_items_total: 10,
      retention_reviews_completed: points > 0 ? 3 : 0,
      retention_percent: points > 0 ? 60 : 0,
    },
    streaks: [
      {
        kind: 'attendance',
        current_count: points > 0 ? 4 : 0,
        best_count: points > 0 ? 4 : 0,
        grace_remaining: 2,
        last_earned_at: points > 0 ? '2026-07-16T20:00:00.000Z' : null,
        status: points > 0 ? 'active' : 'empty',
      },
      {
        kind: 'review',
        current_count: points > 0 ? 3 : 0,
        best_count: points > 0 ? 3 : 0,
        grace_remaining: 1,
        last_earned_at: points > 0 ? '2026-07-15T20:00:00.000Z' : null,
        status: points > 0 ? 'grace' : 'empty',
      },
    ],
    badges:
      points > 0
        ? [
            {
              badge_key: 'attendance_three',
              title: 'Three-class rhythm',
              description: 'Built a three-class attendance streak.',
              earned_at: null,
              tone: 'ice',
            },
          ]
        : [],
    milestones: [
      {
        milestone_key: 'mishnayos_24',
        title: 'Twenty-four Mishnayos',
        description: 'Complete the first twenty-four Mishnayos in this learning track.',
        status: points > 0 ? 'in_progress' : 'locked',
        progress_current: points > 0 ? 8 : 0,
        progress_target: 24,
        earned_at: null,
      },
    ],
    accomplishments:
      points > 0
        ? [
            {
              event_key: 'reward_student_latest',
              title: 'Mishnah completed',
              detail: '6 learning points recorded.',
              reason_code: 'mishnah_completed',
              points_delta: 6,
              source_type: 'admin',
              correction_of_event_key: null,
              occurred_at: '2026-07-16T20:00:00.000Z',
              reversed: false,
            },
            {
              event_key: 'reward_reversal_001',
              title: 'Administrator correction',
              detail: 'Administrator correction reversed a previous point event.',
              reason_code: 'admin_correction',
              points_delta: -5,
              source_type: 'admin',
              correction_of_event_key: 'reward_wrong_attendance',
              occurred_at: '2026-07-17T11:00:00.000Z',
              reversed: true,
            },
          ]
        : [],
    parent_rewards:
      scope === 'household'
        ? [
            {
              reward_goal_key: 'parent_reward_001',
              learner_key: learnerKey,
              title: 'Choose Shabbos dessert',
              description: 'Family-defined reward for steady review.',
              points_required: 75,
              status: points >= 75 ? 'earned' : 'active',
              created_by_parent_ref: 'parent_user_alpha',
              earned_at: points >= 75 ? '2026-07-16T20:00:00.000Z' : null,
              fulfilled_at: null,
            },
          ]
        : [],
    class_milestones: [
      {
        class_milestone_key: 'class_milestone_001',
        title: 'First four classes',
        description: 'The class completed its first four Mishnayos sessions.',
        progress_current: points > 0 ? 4 : 0,
        progress_target: 4,
        status: points > 0 ? 'earned' : 'locked',
        earned_at: points > 0 ? '2026-07-16T20:00:00.000Z' : null,
      },
    ],
    celebration: null,
    guardrails: {
      no_public_rankings: true,
      no_random_rewards: true,
      meaningful_learning_only: true,
      student_scope: scope,
    },
  };
}

function learner(learnerKey: string, displayName: string) {
  return {
    learner_key: learnerKey,
    household_key: learnerKey === 'learner_beta' ? 'household_beta' : 'household_alpha',
    display_name: displayName,
    hebrew_name: null,
    grade_label: 'Grade 5',
    learner_status: 'active' as const,
    version: 1,
    created_at: '2026-07-14T08:00:00.000Z',
    updated_at: '2026-07-14T08:00:00.000Z',
  };
}

function studentAccess(learnerKey: string, status: 'active' | 'not_configured') {
  return {
    access_state_key: `student_access_${learnerKey}`,
    learner_key: learnerKey,
    status,
    student_user_ref: status === 'active' ? `student_user_${learnerKey}` : null,
    last_operation_type: status === 'active' ? ('setup' as const) : null,
    last_operation_at: status === 'active' ? '2026-07-14T09:00:00.000Z' : null,
    version: status === 'active' ? 2 : 1,
  };
}

function classSummary() {
  return {
    class_key: 'class_week_001',
    title: 'Weekly Mishnah',
    starts_at: '2026-07-18T18:00:00.000Z',
    status: 'upcoming' as const,
    launch_action: action('class_launch', 'Join class', 'POST'),
  };
}

function action(
  kind: 'class_launch' | 'content_open' | 'review_sheet_open',
  label: string,
  method: 'GET' | 'POST',
) {
  return {
    action_key: `${kind}_action`,
    label,
    kind,
    method,
    href: `/api/v1/portals/actions/${kind}`,
    launch_token_ref: `${kind}_ref`,
    expires_at: '2026-07-18T19:00:00.000Z',
  };
}
