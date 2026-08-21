import { AxeBuilder } from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { W12_E2E_ADMIN_COOKIES } from '../support/w12-portal-test-lab-session.ts';

const primaryLabels = ['Today', 'Learning', 'People', 'Communications', 'Operations', 'Account'];
const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
] as const;

test('Admin IA keeps the canonical launch areas across the governed viewport matrix', async ({
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
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Workspace overview' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'One Time recurring class' })).toBeVisible();

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
  await page.route('**/api/v1/admin-directory/users*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        users: [
          {
            user_key: 'user-detail-browser-fixture',
            display_name: 'Miriam Cohen',
            email: 'miriam@example.test',
            role: 'admin',
            status: 'active',
            version: 3,
            household_key: null,
            household_name: null,
            relationship_label: null,
            last_successful_login_at: '2026-08-05T08:00:00.000Z',
            setup_expires_at: null,
            learner_key: null,
          },
        ],
      }),
    }),
  );
  await page.route('**/api/v1/admin-directory/households*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, households: [] }),
    }),
  );
  const creationEffectRequests: string[] = [];
  page.on('request', (request) => {
    if (
      request.method() !== 'GET' &&
      /\/(?:invitations|enrollments|parent-reset|student-setup|password-reset)(?:\?|$)/u.test(
        new URL(request.url()).pathname,
      )
    ) {
      creationEffectRequests.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });
  await page.goto('/app/users');
  await expect(page.locator('#admin-directory-users-title')).toHaveText('Parents');
  await page.getByRole('button', { name: 'Create Parent account' }).click();
  await expect(page).toHaveURL(/\/app\/crm\/contact-operations$/u);
  expect(creationEffectRequests).toEqual([]);

  await page.goto('/app/households');
  await expect(page.locator('#admin-directory-households-title')).toHaveText('Families');
  await page.getByRole('button', { name: 'Create Family' }).click();
  await expect(page).toHaveURL(/\/app\/crm\/contact-operations$/u);
  expect(creationEffectRequests).toEqual([]);

  await page.goto('/app/users');
  const firstUserLink = page.locator('.admin-directory__record-title a').first();
  await expect(firstUserLink).toHaveAttribute('href', /^\/app\/users\/[^/]+$/u);
  await firstUserLink.click();
  await expect(page).toHaveURL(/\/app\/users\/[^/]+$/u);
  await expect(page.locator('#admin-directory-users-title')).toHaveText('Parent details');
  await expect(page.getByRole('heading', { name: 'Miriam Cohen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit role' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset password' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to Parents' })).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  const userDetailAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    userDetailAxe.violations.filter((violation) =>
      ['critical', 'serious'].includes(violation.impact ?? ''),
    ),
  ).toEqual([]);

  await page.route('**/api/v1/admin-directory/users*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        users: [
          {
            user_key: 'student-user-browser-fixture',
            display_name: 'Ari Cohen',
            email: 'student:ari.cohen',
            role: 'student',
            status: 'active',
            version: 2,
            household_key: 'household-browser-fixture',
            household_name: 'Cohen Household',
            relationship_label: null,
            last_successful_login_at: '2026-08-05T08:00:00.000Z',
            setup_expires_at: null,
            learner_key: 'student-detail-browser-fixture',
          },
        ],
      }),
    }),
  );
  await page.goto('/app/users/student-user-browser-fixture');
  await expect(page.getByRole('button', { name: 'Reset Student PIN' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset password' })).toHaveCount(0);

  await page.route('**/api/v1/admin-directory/learners*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        learners: [
          {
            learner_key: 'student-detail-browser-fixture',
            household_key: 'household-browser-fixture',
            household_name: 'Cohen Household',
            display_name: 'Ari Cohen',
            hebrew_name: 'Aharon',
            grade_label: 'Grade 6',
            learner_status: 'active',
            version: 4,
            student_access_status: 'active',
            student_user_ref: 'student-user-browser-fixture',
            enrollment_count: 2,
            updated_at: '2026-08-05T08:00:00.000Z',
          },
        ],
      }),
    }),
  );
  await page.goto('/app/students');
  await expect(page.locator('#page-title')).toHaveText('Students');
  await expect(
    page.getByRole('navigation', { name: 'People and family management' }).getByRole('link'),
  ).toHaveText(['Families', 'Parents', 'Students', 'Access', 'Audit']);
  await expect(page.locator('#admin-directory-learners-title')).toHaveText('Students');
  await expect(page.getByRole('button', { name: 'Add Student' })).toBeVisible();
  await page.getByRole('button', { name: 'Add Student' }).click();
  await expect(page).toHaveURL(/\/app\/crm\/contact-operations$/u);
  expect(creationEffectRequests).toEqual([]);

  await page.goto('/app/students');
  const firstStudentLink = page.locator('.admin-directory__record-title a').first();
  await expect(firstStudentLink).toHaveAttribute('href', /^\/app\/students\/[^/]+$/u);
  await firstStudentLink.click();
  await expect(page).toHaveURL(/\/app\/students\/[^/]+$/u);
  await expect(page.locator('#admin-directory-learners-title')).toHaveText('Student details');
  await expect(page.getByRole('heading', { name: 'Student details' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit Student' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to Students' })).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  const studentDetailAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    studentDetailAxe.violations.filter((violation) =>
      ['critical', 'serious'].includes(violation.impact ?? ''),
    ),
  ).toEqual([]);

  await page.goto('/app/content/studio');
  await expect(page.getByRole('heading', { name: 'Content' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Content area' }).getByRole('link')).toHaveText(
    ['Library', 'Pipeline', 'Upload'],
  );
  await expect(page.getByRole('navigation', { name: 'Studio view' })).toBeVisible();

  await page.goto('/app/learning/classroom');
  await expect(page.getByRole('heading', { name: 'Classroom' })).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Classroom area' }).getByRole('link'),
  ).toHaveText(['Classroom', 'Library', 'Questions', 'Attendance', 'Recordings']);
  await expect(page.getByRole('heading', { name: 'Classes', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create class' })).toHaveCount(0);
  await page
    .getByRole('navigation', { name: 'Classroom area' })
    .getByRole('link', { name: 'Library' })
    .click();
  await expect(page).toHaveURL(/\/app\/learning\/library(?:\?occurrence_key=[^&]+)?$/u);
  await expect(page.getByRole('heading', { name: 'Occurrences', exact: true })).toBeVisible();

  await page.goto('/app/learning/attendance');
  await expect(page.getByRole('heading', { name: 'Attendance', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Record an audited correction' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Record audited correction' })).toBeVisible();

  await page.goto('/app/live');
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
