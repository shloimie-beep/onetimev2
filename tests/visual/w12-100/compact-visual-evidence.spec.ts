import { expect, test } from '@playwright/test';
import {
  assertNoHorizontalOverflow,
  desktopViewport,
  loginAs,
  mobileViewport,
  screenshotWithHash,
  useW12AdminSession,
  writeEvidenceJson,
} from '../../e2e/w12-100/launch-readiness-helpers.ts';

test.describe.configure({ mode: 'serial' });

const visualRecords: Array<Record<string, unknown>> = [];

test('captures concise launch-readiness screenshots without full-page duplicates', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const publicContext = await browser.newContext({
    viewport: { width: mobileViewport.width, height: mobileViewport.height },
    reducedMotion: 'reduce',
  });
  const publicPage = await publicContext.newPage();
  for (const item of [
    { route: '/', name: 'landing-mobile-reduced-motion.png', heading: /love for learning Torah/i },
    { route: '/signup', name: 'signup-mobile.png', heading: 'Create Family Account' },
    { route: '/forgot-password', name: 'recovery-mobile.png', heading: 'Reset your password' },
    { route: '/w12-100-missing-route', name: '404-mobile.png', heading: /not found/i },
  ]) {
    await publicPage.goto(item.route);
    await expect(publicPage.getByRole('heading', { name: item.heading })).toBeVisible();
    await assertNoHorizontalOverflow(publicPage);
    visualRecords.push({
      route: item.route,
      viewport: mobileViewport.label,
      screenshot: await screenshotWithHash(publicPage, item.name),
    });
  }
  await publicContext.close();

  const ownerContext = await browser.newContext({
    viewport: { width: desktopViewport.width, height: desktopViewport.height },
  });
  const ownerPage = await ownerContext.newPage();
  await useW12AdminSession(ownerPage);
  await ownerPage.goto('/app/dashboard');
  await expect(ownerPage.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  for (const item of [
    { route: '/app/dashboard', name: 'dashboard-desktop.png', heading: 'Dashboard' },
    {
      route: '/app/classes/e2e_class_occurrence',
      name: 'class-detail-desktop.png',
      heading: 'Classes',
    },
    { route: '/app/billing', name: 'billing-desktop.png', heading: 'Household Access' },
  ]) {
    await ownerPage.goto(item.route);
    await expect(ownerPage.getByRole('heading', { name: item.heading })).toBeVisible();
    await assertNoHorizontalOverflow(ownerPage);
    visualRecords.push({
      route: item.route,
      viewport: desktopViewport.label,
      screenshot: await screenshotWithHash(ownerPage, item.name),
    });
  }
  await ownerContext.close();

  for (const portal of [
    {
      role: 'parent' as const,
      route: '/app/parent',
      name: 'parent-mobile.png',
      heading: 'Parent Portal',
    },
    {
      role: 'student' as const,
      route: '/app/student',
      name: 'student-mobile.png',
      heading: 'Student Portal',
    },
  ]) {
    const context = await browser.newContext({
      viewport: { width: mobileViewport.width, height: mobileViewport.height },
    });
    const page = await context.newPage();
    await loginAs(page, portal.role, portal.route);
    await expect(
      page.locator('#app-main').getByRole('heading', { name: portal.heading }),
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);
    visualRecords.push({
      route: portal.route,
      viewport: mobileViewport.label,
      screenshot: await screenshotWithHash(page, portal.name),
    });
    await context.close();
  }
});

test.afterAll(async () => {
  await writeEvidenceJson('VISUAL-EVIDENCE.json', {
    schema_version: 'onetime.w12_100.visual_evidence.v1',
    generated_at: new Date().toISOString(),
    screenshot_count: visualRecords.length,
    records: visualRecords,
    external_actions: 0,
    production_mutations: 0,
  });
});
