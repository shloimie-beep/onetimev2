import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const evidencePath = path.resolve(
  process.cwd(),
  'ops/evidence/ot-81/responsive-accessibility-matrix.json',
);

test.describe('OT81 responsive accessibility matrix', () => {
  test.setTimeout(180_000);

  test('covers Day-One viewports, RTL, reduced motion, keyboard, reflow, and states', async ({
    page,
  }) => {
    const evidence: Array<Record<string, unknown>> = [];
    const viewports = [
      { name: '360x800', width: 360, height: 800 },
      { name: '390x844', width: 390, height: 844 },
      { name: '768x1024', width: 768, height: 1024 },
      { name: '1440x1000', width: 1440, height: 1000 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expect(
        page.getByRole('heading', {
          name: 'Help your son love learning Mishnayos.',
        }),
      ).toBeVisible();
      evidence.push(await inspectPage(page, `landing-${viewport.name}`));

      await page.goto('/signup');
      await expect(page.getByRole('heading', { name: 'Create your Family account' })).toBeVisible();
      evidence.push(await inspectPage(page, `signup-${viewport.name}`));
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('.campaign-ticker-track')).toHaveCSS('animation-name', 'none');
    evidence.push(await inspectPage(page, 'landing-reduced-motion'));

    await login(page, 'ot-admin@example.test', 'TestPassword!234', '/app/contacts');
    await expect(page.getByRole('heading', { name: 'Contacts', exact: true })).toBeVisible();
    evidence.push(await inspectPage(page, 'crm-mobile'));

    await page.evaluate(() => {
      document.documentElement.dir = 'rtl';
    });
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('dialog', { name: 'One Time navigation' })).toBeVisible();
    await page.keyboard.press('Escape');
    evidence.push(await inspectPage(page, 'crm-rtl-drawer-keyboard'));

    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    evidence.push(await inspectPage(page, 'crm-200-percent-reflow'));

    await page.context().clearCookies();
    await login(page, 'ot-parent@example.test', 'ParentPassword!234', '/app/parent');
    await expect(
      page.locator('#app-main').getByRole('heading', { name: 'Parent Portal' }),
    ).toBeVisible();
    evidence.push(await inspectPage(page, 'parent-portal-ready'));

    await page.context().clearCookies();
    await login(page, 'ot-student@example.test', 'StudentPassword!234', '/app/student');
    await expect(
      page.locator('#app-main').getByRole('heading', { name: 'Student Portal' }),
    ).toBeVisible();
    evidence.push(await inspectPage(page, 'student-portal-ready'));

    await page.context().clearCookies();
    let interceptedCrmError = 0;
    await page.route('**/api/v1/crm/contacts/search', (route) => {
      interceptedCrmError += 1;
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, code: 'TEST_ERROR' }),
      });
    });
    await login(page, 'ot-admin@example.test', 'TestPassword!234', '/app/contacts');
    await expect(page.getByRole('heading', { name: 'Contacts', exact: true })).toBeVisible();
    await expect.poll(() => interceptedCrmError).toBeGreaterThan(0);
    await expect(page.getByRole('heading', { name: 'CRM contacts could not load' })).toBeVisible();
    evidence.push(await inspectPage(page, 'crm-error-state'));

    await mkdir(path.dirname(evidencePath), { recursive: true });
    await writeFile(
      evidencePath,
      `${JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          sample_count: evidence.length,
          results: evidence,
        },
        null,
        2,
      )}\n`,
    );
  });
});

async function inspectPage(page: Page, label: string) {
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
  const undersizedTargets = await visibleUndersizedTargets(page);
  expect(undersizedTargets).toEqual([]);
  return {
    label,
    axe_violations: axe.violations.length,
    horizontal_overflow: overflow,
    undersized_targets: undersizedTargets.length,
  };
}

async function login(page: Page, email: string, password: string, returnTo: string) {
  await page.goto(`/login?return_to=${encodeURIComponent(returnTo)}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL(`**${returnTo}`);
}

async function visibleUndersizedTargets(page: Page) {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        'button, a[href], input:not([disabled]):not([type="radio"]):not([type="checkbox"]), select, textarea, [role="button"]',
      ),
    ]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.width < 44 &&
          rect.height < 44
        );
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          text: element.textContent?.trim().slice(0, 40) ?? '',
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      }),
  );
}
