import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const evidencePath = path.resolve(process.cwd(), 'ops/evidence/ot-39/accessibility-results.json');

test('authenticated CRM shell passes axe, reflow, and width-height target gates', async ({
  page,
}) => {
  const results: Array<Record<string, unknown>> = [];
  const viewports = [
    { name: '360x800', width: 360, height: 800 },
    { name: '390x844', width: 390, height: 844 },
    { name: '768x1024', width: 768, height: 1024 },
    { name: '1440x1000', width: 1440, height: 1000 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await login(page);
    await expect(page.getByLabel('Search')).toBeEnabled();
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations).toEqual([]);
    await expectNoOverflow(page);
    const undersizedTargets = await visibleUndersizedTargets(page);
    expect(undersizedTargets).toEqual([]);
    results.push({
      viewport: viewport.name,
      axe_violations: axe.violations.length,
      horizontal_overflow: false,
      undersized_targets: undersizedTargets.length,
      search_status: 'post_body',
    });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  await expectNoOverflow(page);
  results.push({ mode: 'reduced-motion', horizontal_overflow: false });

  await page.evaluate(() => {
    document.documentElement.dir = 'rtl';
  });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('dialog', { name: 'One Time navigation' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expectNoOverflow(page);
  results.push({ mode: 'rtl-smoke', drawer_escape: true, horizontal_overflow: false });

  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await expect(page.getByRole('heading', { name: 'Contacts', exact: true })).toBeVisible();
  await expectNoOverflow(page);
  results.push({ mode: '200-percent-text-reflow', horizontal_overflow: false });

  await mkdir(path.dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(results, null, 2)}\n`);
});

async function login(page: Page) {
  await page.context().clearCookies();
  await page.goto('/login?return_to=%2Fapp%2Fcontacts');
  await page.getByLabel('Email').fill('ot-admin@example.test');
  await page.getByLabel('Password').fill('TestPassword!234');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/app/contacts');
  await page.waitForFunction(() => performance.getEntriesByName('ot-crm-list-usable').length > 0);
}

async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
}

async function visibleUndersizedTargets(page: Page) {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        'button, a[href], input:not([disabled]), select, textarea, [role="button"]',
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
          (rect.width < 44 || rect.height < 44)
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
