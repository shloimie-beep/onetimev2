import { AxeBuilder } from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { W12_E2E_ADMIN_COOKIES } from '../support/w12-portal-test-lab-session.ts';

const primaryLabels = ['Dashboard', 'Contacts', 'Content', 'Classroom', 'Live Console'];
const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
] as const;

test('Admin IA keeps five focused areas across the governed viewport matrix', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const context = await browser.newContext();
  await useAdminSession(context);
  const page = await context.newPage();
  const evidenceDirectory = path.resolve('ops/evidence/ot-launch-01-admin-ia-01');
  mkdirSync(evidenceDirectory, { recursive: true });

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/app/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Workspace overview' })).toBeVisible();
    await expect(page.locator('.dashboard-overview-card button')).toHaveCount(0);

    if (viewport.width >= 1200) {
      await expect(
        page.getByLabel('One Time app').getByRole('link').allTextContents(),
      ).resolves.toEqual(primaryLabels);
    } else {
      await page.getByRole('button', { name: 'Open navigation' }).click();
      const drawer = page.getByRole('dialog', { name: 'One Time navigation' });
      await expect(
        drawer.getByLabel('One Time app').getByRole('link').allTextContents(),
      ).resolves.toEqual(primaryLabels);
      await drawer.getByRole('button', { name: 'Close navigation' }).click();
    }

    if (viewport.width <= 640) {
      await expect(page.locator('.workspace-tabs__select select')).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Dashboard area' })).toBeHidden();
    } else {
      await expect(page.getByRole('navigation', { name: 'Dashboard area' })).toBeVisible();
    }

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      axe.violations.filter((violation) =>
        ['critical', 'serious'].includes(violation.impact ?? ''),
      ),
    ).toEqual([]);

    await page.screenshot({
      path: path.join(
        evidenceDirectory,
        `admin-dashboard-${viewport.width}x${viewport.height}.png`,
      ),
      fullPage: true,
    });
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/app/crm/learners');
  await expect(page.locator('#page-title')).toHaveText('Learners');
  await expect(
    page.getByRole('navigation', { name: 'People and family management' }).getByRole('link'),
  ).toHaveText(['People / Contacts', 'Households', 'Users & Roles', 'Learners', 'Audit History']);
  await expect(page.locator('#admin-directory-learners-title')).toHaveText('Learners');
  await expect(page.getByRole('button', { name: 'Add learner' })).toBeVisible();

  await page.goto('/app/content/studio');
  await expect(page.getByRole('heading', { name: 'Content' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Content area' }).getByRole('link')).toHaveText(
    ['Library', 'Factory', 'Studio', 'Knowledge', 'Prompts'],
  );
  await expect(page.getByRole('navigation', { name: 'Studio view' })).toBeVisible();

  await page.goto('/app/rewards');
  await expect(page.getByRole('heading', { name: 'Classroom' })).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Classroom area' }).getByRole('link'),
  ).toHaveText([
    'Classes',
    'Occurrences',
    'Enrollments',
    'Recordings',
    'Access',
    'Questions',
    'Rewards',
  ]);
  await expect(page.getByLabel('Class occurrence')).toBeVisible();
  await expect(
    page.locator(
      '.classroom-workspace > .readonly-row, .classroom-workspace > .gamification-admin, .classroom-workspace > .state-panel',
    ),
  ).toHaveCount(1);

  await page.goto('/app/live-console');
  await expect(page.getByRole('heading', { name: 'Live Console' })).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Live Console area' }).getByRole('link'),
  ).toHaveText(['Current Class', 'Questions', 'Zoom']);
  await expect(page.getByRole('heading', { name: 'Current Class' })).toBeVisible();
  await expect(page.getByText('Advanced', { exact: true })).toBeVisible();

  await context.close();
});

async function useAdminSession(context: BrowserContext) {
  await context.addCookies([...W12_E2E_ADMIN_COOKIES]);
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}
