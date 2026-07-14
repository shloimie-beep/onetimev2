import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AxeBuilder } from '@axe-core/playwright';
import { chromium, type Browser } from 'playwright';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  ParentPortalDashboard,
  StudentPortalDashboard,
} from '../../packages/contracts/src/portals/index.ts';
import {
  ParentPortalFeature,
  StudentPortalFeature,
  portalFeatureStyles,
} from '../../apps/web/src/client/features/portals/PortalFeatures.tsx';

const outputDir = path.resolve(process.cwd(), 'ops/evidence/ot-52/screenshots');
const reportPath = path.resolve(process.cwd(), 'ops/evidence/ot-52/BROWSER-HARNESS.json');

try {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const report = await runHarness(browser);
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    if (report.violations.critical_or_serious > 0 || report.layout.horizontal_overflow.length > 0) {
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
}

async function runHarness(browser: Browser) {
  const viewports = [
    { name: 'mobile-parent', role: 'parent' as const, width: 390, height: 844 },
    { name: 'mobile-student', role: 'student' as const, width: 390, height: 844 },
    { name: 'tablet-parent', role: 'parent' as const, width: 768, height: 1024 },
    { name: 'desktop-student', role: 'student' as const, width: 1440, height: 1000 },
  ];
  const context = await browser.newContext();
  const page = await context.newPage();
  const horizontalOverflow: string[] = [];
  const screenshotPaths: string[] = [];
  let criticalOrSerious = 0;

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.setContent(htmlFor(viewport.role), { waitUntil: 'domcontentloaded' });
    const screenshotPath = path.join(outputDir, `${viewport.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    screenshotPaths.push(screenshotPath);

    const overflow = await page.evaluate(() => {
      const documentWidth = document.documentElement.scrollWidth;
      const viewportWidth = window.innerWidth;
      const textOverflow = Array.from(
        document.querySelectorAll<HTMLElement>('button,h1,h2,h3,p,span,strong,dd,dt'),
      )
        .filter((element) => element.scrollWidth > element.clientWidth + 1)
        .map((element) => element.textContent?.trim() ?? element.tagName);
      return {
        page: documentWidth > viewportWidth + 1,
        textOverflow,
        text: document.body.innerText,
      };
    });
    if (overflow.page || overflow.textOverflow.length > 0) {
      horizontalOverflow.push(viewport.name);
    }
    if (/https?:\/\/|zoom|meet|provider/i.test(overflow.text)) {
      horizontalOverflow.push(`${viewport.name}:raw-provider-copy`);
    }

    const axe = await new AxeBuilder({ page }).analyze();
    criticalOrSerious += axe.violations.filter((violation) =>
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
    screenshots: screenshotPaths,
    violations: { critical_or_serious: criticalOrSerious },
    layout: { horizontal_overflow: horizontalOverflow },
    render_samples: {
      samples: renderSamples.length,
      p50_ms: percentile(renderSamples, 0.5),
      p75_ms: percentile(renderSamples, 0.75),
      p95_ms: percentile(renderSamples, 0.95),
    },
  };
}

function htmlFor(role: 'parent' | 'student') {
  const markup = renderToStaticMarkup(
    role === 'parent'
      ? React.createElement(ParentPortalFeature, {
          viewState: 'ready',
          dashboard: parentDashboard(),
          actorFingerprint: 'browser-parent',
        })
      : React.createElement(StudentPortalFeature, {
          viewState: 'ready',
          dashboard: studentDashboard(),
          actorFingerprint: 'browser-student',
        }),
  );
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>OT-52 ${role} portal harness</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>${pageStyles()}</style></head><body>${markup}</body></html>`;
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
    upcoming_classes: { learner_alpha: [classSummary()], learner_beta: [] },
    rewards: {
      learner_alpha: { learner_key: 'learner_alpha', balance: 8, event_count: 2 },
      learner_beta: { learner_key: 'learner_beta', balance: 0, event_count: 0 },
    },
    updates: { learner_alpha: [], learner_beta: [] },
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
    updates: [],
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

function classSummary() {
  return {
    class_key: 'class_week_001',
    title: 'Weekly Mishnah',
    starts_at: '2026-07-15T18:00:00.000Z',
    status: 'upcoming' as const,
    launch_action: action('class_launch', 'Join class'),
  };
}

function action(kind: 'class_launch' | 'content_open', label: string) {
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

function percentile(values: number[], quantile: number) {
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * quantile) - 1));
  return Number((values[index] ?? 0).toFixed(3));
}
