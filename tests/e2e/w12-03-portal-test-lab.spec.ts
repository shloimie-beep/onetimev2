import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import {
  W12_PORTAL_TEST_LAB,
  W12_PORTAL_TEST_LAB_ROUTE,
} from '../../apps/web/src/server/features/portal-test-lab/router.ts';
import { W12_E2E_ADMIN_SESSION_TOKEN } from '../support/w12-portal-test-lab-session.ts';

test.describe.configure({ mode: 'serial' });

const evidenceRoot = path.resolve(process.cwd(), 'ops/evidence/W12-03');
const screenshotRoot = path.join(evidenceRoot, 'screenshots');
const evidence: Array<Record<string, unknown>> = [];

test('W12-03 admin lab page is owner/admin-only and secret-free', async ({ browser }) => {
  const adminContext = await browser.newContext();
  await adminContext.addCookies([
    {
      name: 'otcrm_session',
      value: W12_E2E_ADMIN_SESSION_TOKEN,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  const adminPage = await adminContext.newPage();
  const requests = collectRequests(adminPage);
  await adminPage.goto(W12_PORTAL_TEST_LAB_ROUTE);
  await expect(adminPage.getByRole('heading', { name: 'W12 Portal Test Lab' })).toBeVisible();
  await expect(adminPage.getByText(W12_PORTAL_TEST_LAB.parent.email)).toBeVisible();
  for (const learner of W12_PORTAL_TEST_LAB.learners) {
    await expect(adminPage.getByText(learner.email)).toBeVisible();
    await expect(adminPage.getByText(learner.learnerKey)).toBeVisible();
  }
  const adminText = await adminPage.locator('body').innerText();
  expect(adminText).not.toMatch(/W12.*Pass|view as|impersonat|https?:\/\/|zoom|vimeo|drive|meet/i);

  await captureResponsiveA11y(adminPage, 'admin-lab', W12_PORTAL_TEST_LAB_ROUTE);
  expectForbiddenRequests(requests);
  await adminContext.close();

  const parentContext = await browser.newContext();
  const parentPage = await parentContext.newPage();
  await loginAs(parentPage, 'parent', W12_PORTAL_TEST_LAB_ROUTE, { waitForReturnTo: false });
  await expect(
    parentPage.getByRole('heading', { name: 'Portal Test Lab access unavailable' }),
  ).toBeVisible();
  await parentContext.close();
});

test('W12-03 parent and three separate learners complete portal journeys', async ({ browser }) => {
  test.setTimeout(60_000);
  const parentContext = await browser.newContext();
  const parentPage = await parentContext.newPage();
  const parentRequests = collectRequests(parentPage);
  await loginAs(parentPage, 'parent', '/app/parent');
  await expect(
    parentPage.locator('#app-main').getByRole('heading', { name: 'Parent Portal' }),
  ).toBeVisible();
  await expect(parentPage.getByText('3/3 active learners')).toBeVisible();
  await expect(parentPage.getByRole('heading', { name: 'Billing' })).toBeVisible();
  await expect(parentPage.getByText(/Billing is unavailable|Family plan/i)).toBeVisible();
  await parentPage.getByRole('button', { name: /W12 Learner One/i }).click();
  await expect(parentPage.getByText('W12 Fictional Recording')).toBeVisible();
  await expect(parentPage.getByText('W12 Fictional Review Sheet')).toBeVisible();

  await parentPage.getByRole('button', { name: 'Reset' }).click();
  let dialog = parentPage.getByRole('dialog', { name: 'Reset student access' });
  await dialog.getByLabel('Student password').fill('W12Learner123');
  await dialog.getByRole('button', { name: 'Reset' }).click();
  await expect(parentPage.getByText('Status: Active')).toBeVisible();

  await parentPage.getByRole('button', { name: 'Suspend' }).click();
  dialog = parentPage.getByRole('dialog', { name: 'Suspend student access' });
  await dialog.getByRole('button', { name: 'Suspend' }).click();
  await expect(parentPage.getByText('Status: Suspended')).toBeVisible();

  await parentPage.getByRole('button', { name: 'Restore' }).click();
  dialog = parentPage.getByRole('dialog', { name: 'Restore student access' });
  await dialog.getByRole('button', { name: 'Restore' }).click();
  await expect(parentPage.getByText('Status: Active')).toBeVisible();

  const parentLaunch = await samePagePostJson(
    parentPage,
    `/api/v1/portals/parent/households/${W12_PORTAL_TEST_LAB.householdKey}/learners/${W12_PORTAL_TEST_LAB.learners[0].learnerKey}/classes/${W12_PORTAL_TEST_LAB.occurrenceKey}/launch`,
  );
  expect(parentLaunch.status, parentLaunch.text).toBe(403);
  expect(parentLaunch.text).toContain('student session');
  expect(parentLaunch.text).not.toMatch(/https?:\/\/|zoom|vimeo|drive|meet/i);

  await captureResponsiveA11y(parentPage, 'parent-journey', '/app/parent');
  expectForbiddenRequests(parentRequests);
  await parentContext.close();

  for (const learner of W12_PORTAL_TEST_LAB.learners) {
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    const requests = collectRequests(studentPage);
    await loginAs(studentPage, learner.email, '/app/student');
    await expect(
      studentPage.locator('#app-main').getByRole('heading', { name: 'Student Portal' }),
    ).toBeVisible();
    await expect(studentPage.getByText(learner.displayName)).toBeVisible();
    for (const sibling of W12_PORTAL_TEST_LAB.learners) {
      if (sibling.learnerKey === learner.learnerKey) continue;
      await expect(studentPage.getByText(sibling.displayName)).toHaveCount(0);
      await expect(studentPage.getByText(sibling.learnerKey)).toHaveCount(0);
    }
    await expect(studentPage.getByText('W12 Fictional Recording')).toBeVisible();
    await expect(studentPage.getByText('W12 Fictional Review Sheet')).toBeVisible();
    const progress = studentPage.getByRole('region', { name: 'Progress' });
    const metrics = progress.locator('.ot-metrics');
    await expect(metrics.locator('div').nth(0)).toHaveText('Classes1');
    await expect(metrics.locator('div').nth(3)).toHaveText('Points5');
    await expect(
      studentPage.getByText(/What should I review before the next fictional class/i),
    ).toBeVisible();

    await studentPage
      .getByRole('textbox', { name: 'Ask Class Helper' })
      .fill('What should I review from the Mishnah lesson?');
    await studentPage.getByRole('button', { name: 'Ask helper' }).click();
    await expect(studentPage.locator('.ot-helper-answer')).toContainText(
      'fictional Mishnah lesson',
    );

    if (learner.learnerKey === W12_PORTAL_TEST_LAB.learners[0].learnerKey) {
      await captureResponsiveA11y(studentPage, 'student-journey', '/app/student');
    }
    expectForbiddenRequests(requests);
    await studentContext.close();
  }
});

async function samePagePostJson(page: Page, url: string) {
  return page.evaluate(async (targetUrl) => {
    const session = await fetch('/api/v1/auth/session');
    const sessionJson = (await session.json()) as { csrf_token: string };
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'x-csrf-token': sessionJson.csrf_token },
    });
    return { status: response.status, text: await response.text() };
  }, url);
}

async function loginAs(
  page: Page,
  roleOrEmail: 'admin' | 'parent' | string,
  returnTo: string,
  options: { waitForReturnTo?: boolean } = {},
) {
  const credentials: Record<string, [string, string]> = {
    admin: [W12_PORTAL_TEST_LAB.admin.email, W12_PORTAL_TEST_LAB.admin.defaultPassword],
    parent: [W12_PORTAL_TEST_LAB.parent.email, W12_PORTAL_TEST_LAB.parent.defaultPassword],
  };
  const [email, password] = credentials[roleOrEmail] ?? [
    roleOrEmail,
    W12_PORTAL_TEST_LAB.learners.find((learner) => learner.email === roleOrEmail)?.defaultPassword,
  ];
  if (!password) throw new Error(`Missing W12 test credential for ${roleOrEmail}`);
  await page.goto(`/login?return_to=${encodeURIComponent(returnTo)}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  if (options.waitForReturnTo === false) {
    await page.waitForLoadState('domcontentloaded');
  } else {
    await page.waitForURL(`**${returnTo}`);
  }
}

async function captureResponsiveA11y(page: Page, name: string, route: string) {
  const sizes = [
    { label: '360x800', width: 360, height: 800 },
    { label: '390x844', width: 390, height: 844 },
    { label: '768x1024', width: 768, height: 1024 },
    { label: '1440x1000', width: 1440, height: 1000 },
  ];
  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    if (!page.url().endsWith(route)) await page.goto(route);
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
      forbidden_external_text: /https?:\/\/|zoom|vimeo|drive|meet/i.test(text),
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
    path.join(evidenceRoot, 'PORTAL-TEST-LAB-JOURNEYS.json'),
    `${JSON.stringify(
      {
        status: 'completed',
        generated_at: new Date().toISOString(),
        journeys: [
          'admin-only W12 lab status/reset page without visible secrets',
          'parent manages W12 household and learner access without student impersonation',
          'three separate student identities resolve to exactly one learner each',
          'student class, recording, review, progress, reward, private question, and helper examples',
        ],
        evidence,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
});
