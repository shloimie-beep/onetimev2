import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const evidenceRoot = path.resolve(process.cwd(), 'ops/evidence/ot-83r');
const screenshotRoot = path.join(evidenceRoot, 'real-app-screenshots');
const evidence: Array<Record<string, unknown>> = [];

test('OT83R parent portal routes add, fourth-seat denial, edit, archive, restore, student access, and content open', async ({
  page,
}) => {
  const requests = collectRequests(page);
  await loginAs(page, 'parent', '/app/parent');
  await expect(
    page.locator('#app-main').getByRole('heading', { name: 'Parent Portal' }),
  ).toBeVisible();

  await expect(page.getByText('2/3 active learners')).toBeVisible();
  await openAddLearner(page, 'Gamma Learner', 'Grade 4');
  await expect(page.getByText('3/3 active learners')).toBeVisible();
  await expect(page.getByRole('button', { name: /Gamma Learner/i })).toBeVisible();

  await page.getByRole('button', { name: 'Add learner' }).first().click();
  let dialog = page.getByRole('dialog', { name: 'Add learner' });
  await dialog.getByLabel('Display name').fill('Delta Learner');
  await dialog.getByRole('button', { name: 'Add learner' }).click();
  await expect(dialog.getByRole('alert')).toContainText('at most three active learners');
  await dialog.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: /Gamma Learner/i }).click();
  await page.getByRole('button', { name: 'Edit' }).click();
  dialog = page.getByRole('dialog', { name: 'Edit learner' });
  await dialog.getByLabel('Display name').fill('Gamma Edited');
  await dialog.getByRole('button', { name: 'Save learner' }).click();
  await expect(page.getByRole('button', { name: /Gamma Edited/i })).toBeVisible();

  await page.getByRole('button', { name: 'Archive' }).click();
  dialog = page.getByRole('dialog', { name: 'Archive learner' });
  await dialog.getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByText('2/3 active learners')).toBeVisible();
  await expect(page.getByRole('button', { name: /Gamma Edited.*Archived/i })).toBeVisible();

  await page.getByRole('button', { name: 'Restore' }).click();
  dialog = page.getByRole('dialog', { name: 'Restore learner' });
  await dialog.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByText('3/3 active learners')).toBeVisible();
  await expect(page.getByRole('button', { name: /Gamma Edited.*Active/i })).toBeVisible();

  await page.getByRole('button', { name: /E2E Beta Learner/i }).click();
  await page.getByRole('button', { name: 'Setup' }).click();
  dialog = page.getByRole('dialog', { name: 'Setup student access' });
  await dialog.getByLabel('Student email').fill(`beta-student-${Date.now()}@example.test`);
  await dialog.getByRole('button', { name: 'Setup' }).click();
  await expect(page.getByText('Status: Setup requested')).toBeVisible();

  await page.getByRole('button', { name: /E2E Alpha Learner/i }).click();
  await page.getByRole('button', { name: 'Reset' }).click();
  dialog = page.getByRole('dialog', { name: 'Reset student access' });
  await dialog.getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByText('Status: Reset requested')).toBeVisible();

  await page.getByRole('button', { name: 'Suspend' }).click();
  dialog = page.getByRole('dialog', { name: 'Suspend student access' });
  await dialog.getByRole('button', { name: 'Suspend' }).click();
  await expect(page.getByText('Status: Suspended')).toBeVisible();

  await page.getByRole('button', { name: 'Restore' }).click();
  dialog = page.getByRole('dialog', { name: 'Restore student access' });
  await dialog.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByText('Status: Active')).toBeVisible();

  await expect(page.getByText('E2E Recording')).toBeVisible();
  const contentResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/portals/parent/households/') &&
      response.url().includes('/content/e2e_recording_001/open'),
  );
  await page
    .locator('article', { hasText: 'E2E Recording' })
    .getByRole('button', { name: 'Open' })
    .click();
  const contentJson = await (await contentResponse).json();
  expect(JSON.stringify(contentJson)).not.toMatch(/https?:\/\/|zoom|vimeo|drive|meet/i);
  await expect(page.getByText('Content provider unavailable')).toBeVisible();

  const deniedHousehold = await page.request.get(
    '/api/v1/portals/parent/households/household_beta/dashboard',
  );
  expect(deniedHousehold.status()).toBe(404);

  await captureResponsiveA11y(page, 'parent-after-journey');
  expectForbiddenRequests(requests);
});

test('OT83R student portal routes content open, questions, session expiry, sibling denial, role denial, and provider URL guard', async ({
  browser,
}) => {
  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();
  const studentRequests = collectRequests(studentPage);
  await loginAs(studentPage, 'student', '/app/student');
  await expect(
    studentPage.locator('#app-main').getByRole('heading', { name: 'Student Portal' }),
  ).toBeVisible();
  await expect(studentPage.getByText('E2E Recording')).toBeVisible();
  await expect(studentPage.getByText(/Sibling Private Recording/i)).toHaveCount(0);

  const openResponse = studentPage.waitForResponse((response) =>
    response.url().includes('/api/v1/portals/student/content/e2e_recording_001/open'),
  );
  await studentPage
    .locator('article', { hasText: 'E2E Recording' })
    .getByRole('button', { name: 'Open' })
    .click();
  expect(JSON.stringify(await (await openResponse).json())).not.toMatch(
    /https?:\/\/|zoom|vimeo|drive|meet/i,
  );

  await studentPage
    .getByRole('textbox', { name: 'Question', exact: true })
    .fill('What should I review before the next class?');
  await studentPage.getByRole('button', { name: 'Submit question' }).click();
  await expect(studentPage.getByText('Question submitted.')).toBeVisible();
  await expect(studentPage.getByText('What should I review before the next class?')).toBeVisible();

  const csrf = await sessionCsrf(studentPage);
  const siblingClassAttempt = await studentPage.request.post(
    '/api/v1/portals/student/classes/e2e_class_occurrence/launch',
    {
      headers: { 'x-csrf-token': csrf },
      data: { learner_key: 'e2e_learner_beta' },
    },
  );
  const siblingClassJson = await siblingClassAttempt.json();
  expect(siblingClassAttempt.status()).toBe(400);
  expect(JSON.stringify(siblingClassJson)).not.toContain('e2e_learner_beta');
  expect(JSON.stringify(siblingClassJson)).not.toMatch(/https?:\/\/|zoom|vimeo|drive|meet/i);

  const siblingContent = await studentPage.request.get(
    '/api/v1/portals/student/content/e2e_sibling_private/open',
  );
  expect(siblingContent.status()).toBe(404);

  const viewerContext = await browser.newContext();
  const viewerPage = await viewerContext.newPage();
  await loginAs(viewerPage, 'viewer', '/app/parent');
  await expect(
    viewerPage.getByRole('heading', { name: 'Parent Portal access unavailable' }),
  ).toBeVisible();
  await viewerContext.close();

  const parentContext = await browser.newContext();
  const parentPage = await parentContext.newPage();
  await loginAs(parentPage, 'parent', '/app/parent');
  await parentPage.getByRole('button', { name: /E2E Alpha Learner/i }).click();
  await parentPage.getByRole('button', { name: 'Revoke sessions' }).click();
  const dialog = parentPage.getByRole('dialog', { name: 'Revoke sessions student access' });
  await dialog.getByRole('button', { name: 'Revoke sessions' }).click();
  await expect(parentPage.getByText('Student access updated.')).toBeVisible();
  await parentContext.close();

  await studentPage.goto('/app/student');
  await expect(studentPage).toHaveURL(/\/login\?return_to=%2Fapp%2Fstudent/);

  await captureResponsiveA11y(studentPage, 'student-after-journey', '/login');
  expectForbiddenRequests(studentRequests);
  await studentContext.close();
});

async function openAddLearner(page: Page, displayName: string, gradeLabel: string) {
  await page.getByRole('button', { name: 'Add learner' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add learner' });
  await dialog.getByLabel('Display name').fill(displayName);
  await dialog.getByLabel('Grade').fill(gradeLabel);
  await dialog.getByRole('button', { name: 'Add learner' }).click();
  await expect(page.getByText('Learner added.')).toBeVisible();
}

async function loginAs(page: Page, role: 'parent' | 'student' | 'viewer', returnTo: string) {
  const credentials = {
    parent: ['ot-parent@example.test', 'ParentPassword!234'],
    student: ['ot-student@example.test', 'StudentPassword!234'],
    viewer: ['viewer@example.test', 'ViewerPass!234'],
  } as const;
  const [email, password] = credentials[role];
  await page.goto(`/login?return_to=${encodeURIComponent(returnTo)}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL(`**${returnTo}`);
}

async function sessionCsrf(page: Page) {
  const response = await page.request.get('/api/v1/auth/session');
  expect(response.status()).toBe(200);
  const json = (await response.json()) as { csrf_token: string };
  return json.csrf_token;
}

async function captureResponsiveA11y(page: Page, name: string, route = '/app/parent') {
  const sizes = [
    { label: '390x844', width: 390, height: 844 },
    { label: '1440x1000', width: 1440, height: 1000 },
  ];
  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    if (!page.url().endsWith(route)) {
      await page.goto(route);
    }
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    const screenshotPath = path.join(screenshotRoot, `${name}-${size.label}.png`);
    await mkdir(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    const axe = await new AxeBuilder({ page }).analyze();
    const serious = axe.violations.filter((violation) =>
      ['critical', 'serious'].includes(violation.impact ?? ''),
    );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    const text = await page.locator('body').innerText();
    evidence.push({
      name,
      viewport: size.label,
      screenshot: screenshotPath,
      critical_or_serious_a11y: serious.length,
      horizontal_overflow: overflow,
      provider_url_leakage: /https?:\/\/|zoom|vimeo|drive|meet/i.test(text),
    });
    expect(serious).toEqual([]);
    expect(overflow).toBe(false);
    expect(text).not.toMatch(/https?:\/\/|zoom|vimeo|drive|meet/i);
  }
}

function collectRequests(page: Page) {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  return requests;
}

function expectForbiddenRequests(requests: string[]) {
  const forbidden = requests.filter((url) =>
    /bna|operations|leadconnector|gohighlevel|fonts\.googleapis|fonts\.gstatic/i.test(url),
  );
  expect(forbidden).toEqual([]);
}

test.afterAll(async () => {
  await mkdir(evidenceRoot, { recursive: true });
  await writeFile(
    path.join(evidenceRoot, 'REAL-APP-JOURNEYS.json'),
    `${JSON.stringify(
      {
        status: 'completed',
        generated_at: new Date().toISOString(),
        journeys: [
          'parent add/fourth-seat denial/edit/archive/restore/student-access/content-open',
          'student content-open/questions/session-expiry/sibling-household-role-denial/provider-url-guard',
        ],
        evidence,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
});
