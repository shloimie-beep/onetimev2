import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const evidencePath = path.resolve(process.cwd(), 'ops/evidence/ops-07/route-gates.json');

const normalUiForbidden = [
  /Checking session/i,
  /Refreshing\.\.\./i,
  /Signed out/i,
  /idempotency/i,
  /provider payload/i,
  /helper is not connected yet/i,
  /\/api\/v1\//i,
];

const cases = [
  {
    id: 'landing',
    path: '/',
    heading: 'Give your son a love for learning Torah.',
    role: 'anonymous',
  },
  { id: 'signup', path: '/signup', heading: 'Sign Up Now', role: 'anonymous' },
  { id: 'login', path: '/login', button: 'Login', role: 'anonymous' },
  { id: 'crm', path: '/app/crm', heading: 'CRM', role: 'admin' },
  { id: 'dashboard', path: '/app/dashboard', heading: 'Dashboard', role: 'admin' },
  { id: 'parent', path: '/app/parent', heading: 'Parent Portal', role: 'parent' },
  { id: 'student', path: '/app/student', heading: 'Student Portal', role: 'student' },
  { id: 'support', path: '/app/support', heading: /support/i, role: 'parent' },
];

test.describe('OPS-07 Day-One route gates', () => {
  test.setTimeout(240_000);

  test('records usable routes and fails on raw normal-UI copy, dead controls, console errors, and role leaks', async ({
    page,
  }) => {
    const results = [];
    const unexpectedConsole: string[] = [];
    const unexpectedResponses: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') unexpectedConsole.push(message.text());
    });
    page.on('pageerror', (error) => unexpectedConsole.push(error.message));
    page.on('response', (response) => {
      const status = response.status();
      if (status >= 400 && !response.url().includes('/api/v1/crm/contacts/search')) {
        unexpectedResponses.push(`${status} ${response.url()}`);
      }
    });

    for (const routeCase of cases) {
      const routeResult = await inspectRoute(page, routeCase);
      results.push(routeResult);
    }

    const evidence = {
      generated_at: new Date().toISOString(),
      unexpected_console: unexpectedConsole,
      unexpected_responses: unexpectedResponses,
      results,
      summary: {
        total: results.length,
        pass: results.filter((result) => result.status === 'PASS').length,
        fail: results.filter((result) => result.status === 'FAIL').length,
      },
    };
    await mkdir(path.dirname(evidencePath), { recursive: true });
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

    expect(unexpectedConsole).toEqual([]);
    expect(unexpectedResponses).toEqual([]);
    expect(results.filter((result) => result.status === 'FAIL')).toEqual([]);
  });
});

async function inspectRoute(
  page: Page,
  routeCase: {
    id: string;
    path: string;
    heading?: string | RegExp;
    button?: string;
    role: string;
  },
) {
  const findings: string[] = [];
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    if (routeCase.role === 'admin')
      await login(page, 'ot-admin@example.test', 'TestPassword!234', routeCase.path);
    else if (routeCase.role === 'parent')
      await login(page, 'ot-parent@example.test', 'ParentPassword!234', routeCase.path);
    else if (routeCase.role === 'student')
      await login(page, 'ot-student@example.test', 'StudentPassword!234', routeCase.path);
    else await page.goto(routeCase.path);

    if (routeCase.heading) {
      await page
        .getByRole('heading', { name: routeCase.heading })
        .first()
        .waitFor({ timeout: 15_000 });
    }
    if (routeCase.button) {
      await page
        .getByRole('button', { name: routeCase.button })
        .first()
        .waitFor({ timeout: 15_000 });
    }

    const visibleText = await page.locator('body').innerText();
    for (const pattern of normalUiForbidden) {
      if (pattern.test(visibleText)) findings.push(`forbidden visible text ${pattern}`);
    }
    const duplicateMainHeadings = await page.locator('main h1, #app-main h1').count();
    if (duplicateMainHeadings > 1)
      findings.push(`duplicate primary headings: ${duplicateMainHeadings}`);

    const deadControls = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('button, a[href], [role="button"]')]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none'
          );
        })
        .filter((element) => {
          if (element instanceof HTMLAnchorElement) {
            return !element.getAttribute('href') || element.getAttribute('href') === '#';
          }
          return (
            element.tagName === 'BUTTON' &&
            !element.getAttribute('type') &&
            !element.onclick &&
            !element.closest('form')
          );
        })
        .map((element) => element.textContent?.trim().slice(0, 60) ?? element.tagName),
    );
    if (deadControls.length > 0) findings.push(`dead controls: ${deadControls.join(', ')}`);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    if (overflow) findings.push('horizontal overflow');
  } catch (error) {
    findings.push(error instanceof Error ? error.message : String(error));
  }

  return {
    id: routeCase.id,
    path: routeCase.path,
    role: routeCase.role,
    status: findings.length === 0 ? 'PASS' : 'FAIL',
    findings,
  };
}

async function login(page: Page, email: string, password: string, returnTo: string) {
  await page.goto(`/login?return_to=${encodeURIComponent(returnTo)}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL(`**${returnTo}`);
}
