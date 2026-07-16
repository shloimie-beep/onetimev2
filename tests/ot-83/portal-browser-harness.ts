import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AxeBuilder } from '@axe-core/playwright';
import { chromium, type Browser } from 'playwright';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  ParentPortalDashboard,
  ProtectedActionDescriptor,
  RewardEvent,
  StudentAccessState,
  StudentPortalDashboard,
} from '../../packages/contracts/src/portals/index.ts';
import {
  ParentPortalFeature,
  StudentPortalFeature,
} from '../../apps/web/src/client/features/portals/PortalFeatures.tsx';

const outputDir = path.resolve(process.cwd(), 'ops/evidence/ot-83r/screenshots');
const reportPath = path.resolve(process.cwd(), 'ops/evidence/ot-83r/BROWSER-A11Y-PERFORMANCE.json');
const portalFeatureStyles = await readFile(
  path.resolve(process.cwd(), 'packages/brand-system/src/styles/portal.css'),
  'utf8',
);

try {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const report = await runHarness(browser);
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    if (
      report.accessibility.critical_or_serious_violations > 0 ||
      report.layout.horizontal_overflow.length > 0 ||
      report.provider_url_exposure.length > 0
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
  const viewports = [
    { name: 'mobile-360-parent', role: 'parent' as const, width: 360, height: 800 },
    { name: 'mobile-360-student', role: 'student' as const, width: 360, height: 800 },
    { name: 'mobile-390-parent', role: 'parent' as const, width: 390, height: 844 },
    { name: 'mobile-390-student', role: 'student' as const, width: 390, height: 844 },
    { name: 'tablet-parent', role: 'parent' as const, width: 768, height: 1024 },
    { name: 'tablet-student', role: 'student' as const, width: 768, height: 1024 },
    { name: 'desktop-parent', role: 'parent' as const, width: 1440, height: 1000 },
    { name: 'desktop-student', role: 'student' as const, width: 1440, height: 1000 },
  ];
  const context = await browser.newContext();
  const page = await context.newPage();
  const horizontalOverflow: string[] = [];
  const providerUrlExposure: string[] = [];
  const screenshots: Array<{
    viewport: string;
    path: string;
    width: number;
    height: number;
    role: 'parent' | 'student';
  }> = [];
  let criticalOrSeriousViolations = 0;

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.setContent(htmlFor(viewport.role), { waitUntil: 'domcontentloaded' });
    const screenshotPath = path.join(outputDir, `${viewport.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    screenshots.push({
      viewport: viewport.name,
      path: screenshotPath,
      width: viewport.width,
      height: viewport.height,
      role: viewport.role,
    });

    const layout = await page.evaluate(() => {
      const textOverflow = Array.from(
        document.querySelectorAll<HTMLElement>('button,h1,h2,h3,p,span,strong,dd,dt,label'),
      )
        .filter((element) => element.scrollWidth > element.clientWidth + 1)
        .map((element) => element.textContent?.trim() ?? element.tagName)
        .filter(Boolean);
      return {
        page: document.documentElement.scrollWidth > window.innerWidth + 1,
        textOverflow,
        text: document.body.innerText,
      };
    });
    if (layout.page || layout.textOverflow.length > 0) {
      horizontalOverflow.push(viewport.name);
    }
    if (/https?:\/\/|zoom|meet|vimeo|provider/i.test(layout.text)) {
      providerUrlExposure.push(viewport.name);
    }

    const axe = await new AxeBuilder({ page }).analyze();
    criticalOrSeriousViolations += axe.violations.filter((violation) =>
      ['critical', 'serious'].includes(violation.impact ?? ''),
    ).length;
  }

  const renderSamples = [];
  for (let index = 0; index < 30; index += 1) {
    const start = performance.now();
    await page.setContent(htmlFor(index % 2 === 0 ? 'parent' : 'student'), {
      waitUntil: 'domcontentloaded',
    });
    renderSamples.push(performance.now() - start);
  }
  await context.close();
  renderSamples.sort((left, right) => left - right);

  return {
    status: 'completed',
    generated_at: new Date().toISOString(),
    screenshots,
    accessibility: {
      critical_or_serious_violations: criticalOrSeriousViolations,
    },
    layout: {
      horizontal_overflow: horizontalOverflow,
    },
    provider_url_exposure: providerUrlExposure,
    render_samples: {
      samples: renderSamples.length,
      p50_ms: percentile(renderSamples, 0.5),
      p75_ms: percentile(renderSamples, 0.75),
      p95_ms: percentile(renderSamples, 0.95),
    },
    external_mutations: {
      production_database: false,
      providers: false,
      sends: false,
      payments: false,
      deploys: false,
      dns: false,
      real_users: false,
      bna_product_code: false,
    },
  };
}

function htmlFor(role: 'parent' | 'student') {
  const markup = renderToStaticMarkup(
    role === 'parent'
      ? React.createElement(ParentPortalFeature, {
          viewState: 'ready',
          dashboard: parentDashboard(),
          actorFingerprint: 'ot83r-browser-parent',
          rewardHistory: {
            learner_alpha: [rewardEvent()],
          },
        })
      : React.createElement(StudentPortalFeature, {
          viewState: 'ready',
          dashboard: studentDashboard(),
          actorFingerprint: 'ot83r-browser-student',
          onSubmitQuestion: async () => undefined,
        }),
  );
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>OT-83R ${role} portal harness</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>${pageStyles()}</style></head><body>${markup}</body></html>`;
}

function pageStyles() {
  return `
    * { box-sizing: border-box; }
    body { margin: 0; background: #080808; font-family: Arial, sans-serif; }
    ${portalFeatureStyles}
  `;
}

function parentDashboard(): ParentPortalDashboard {
  return {
    household: {
      household_key: 'household_alpha',
      display_name: 'Alpha Family',
      active_learner_count: 3,
      max_active_learners: 3,
      consent_status: 'not_required',
      learner_limit_reached: true,
      version: 7,
    },
    learners: [
      learner('learner_alpha', 'Alpha Learner'),
      learner('learner_beta', 'Beta Learner'),
      learner('learner_gamma', 'Gamma Learner'),
    ],
    student_access: [
      studentAccess('learner_alpha', 'active'),
      studentAccess('learner_beta', 'setup_requested'),
      studentAccess('learner_gamma', 'not_configured'),
    ],
    upcoming_classes: {
      learner_alpha: [classSummary('class_alpha')],
      learner_beta: [],
      learner_gamma: [classSummary('class_gamma')],
    },
    rewards: {
      learner_alpha: { learner_key: 'learner_alpha', balance: 8, event_count: 2 },
      learner_beta: { learner_key: 'learner_beta', balance: 0, event_count: 0 },
      learner_gamma: { learner_key: 'learner_gamma', balance: 3, event_count: 1 },
    },
    updates: {
      learner_alpha: [update('update_parent_alpha', 'learner_alpha', 'parent')],
      learner_beta: [],
      learner_gamma: [update('update_parent_gamma', 'learner_gamma', 'parent')],
    },
    helper: {
      available: false,
      reason: 'Portal helper is not connected yet.',
      scope_label: 'Portal helper',
    },
    billing: { enabled: false, summary_label: null },
  };
}

function studentDashboard(): StudentPortalDashboard {
  return {
    learner: learner('learner_student_self', 'Student Learner'),
    upcoming_classes: [classSummary('class_self')],
    library_items: [
      {
        item_key: 'library_weekly_recording',
        title: 'Weekly recording',
        item_type: 'video',
        status: 'published',
        open_action: action('content_open', 'Open recording', 'GET'),
      },
      {
        item_key: 'review_sheet_001',
        title: 'Review sheet',
        item_type: 'review',
        status: 'published',
        open_action: action('review_sheet_open', 'Open review', 'GET'),
      },
    ],
    progress: {
      attendance_count: 3,
      watch_minutes: 75,
      completed_items: 2,
      last_activity_at: '2026-07-14T08:00:00.000Z',
    },
    rewards: { learner_key: 'learner_student_self', balance: 6, event_count: 2 },
    updates: [update('update_student_self', 'learner_student_self', 'student')],
    questions: [
      {
        question_key: 'question_self_001',
        learner_key: 'learner_student_self',
        class_key: 'class_self',
        question: 'What should I review before the next class?',
        status: 'submitted',
        submitted_at: '2026-07-14T08:10:00.000Z',
        answered_at: null,
        answer_preview: null,
      },
    ],
    helper: {
      available: false,
      reason: 'Student helper is not connected yet.',
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

function studentAccess(
  learnerKey: string,
  status: 'active' | 'setup_requested' | 'not_configured',
): StudentAccessState {
  return {
    access_state_key: `student_access_${learnerKey}`,
    learner_key: learnerKey,
    status,
    student_user_ref: status === 'active' ? `student_user_${learnerKey}` : null,
    last_operation_type: status === 'not_configured' ? null : 'setup',
    last_operation_at: status === 'not_configured' ? null : '2026-07-14T09:00:00.000Z',
    version: status === 'not_configured' ? 1 : 2,
  };
}

function classSummary(classKey: string) {
  return {
    class_key: classKey,
    title: 'Weekly Mishnah',
    starts_at: '2026-07-15T18:00:00.000Z',
    status: 'upcoming' as const,
    launch_action: action('class_launch', 'Join class', 'POST'),
  };
}

function action(
  kind: ProtectedActionDescriptor['kind'],
  label: string,
  method: ProtectedActionDescriptor['method'],
): ProtectedActionDescriptor {
  return {
    action_key: `${kind}_action`,
    label,
    kind,
    method,
    href: `/api/v1/portals/actions/${kind}`,
    launch_token_ref: `${kind}_ref`,
    expires_at: '2026-07-14T09:00:00.000Z',
  };
}

function update(updateKey: string, learnerKey: string, audience: 'parent' | 'student') {
  return {
    update_key: updateKey,
    learner_key: learnerKey,
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

function percentile(values: number[], quantile: number) {
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * quantile) - 1));
  return Number((values[index] ?? 0).toFixed(3));
}
