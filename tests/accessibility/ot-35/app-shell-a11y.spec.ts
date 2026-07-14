import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const evidencePath = path.resolve(process.cwd(), 'ops/evidence/ot-35/accessibility-results.json');

test('authenticated CRM shell passes axe and reflow matrix', async ({ page }) => {
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
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations).toEqual([]);
    await expectNoOverflow(page);
    results.push({
      viewport: viewport.name,
      axe_violations: axe.violations.length,
      horizontal_overflow: false,
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
  await expect(page.getByRole('heading', { name: 'CRM' })).toBeVisible();
  await expectNoOverflow(page);
  results.push({ mode: '200-percent-text-reflow', horizontal_overflow: false });

  await mkdir(path.dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(results, null, 2)}\n`);
});

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('ot-admin@example.test');
  await page.getByLabel('Password').fill('TestPassword!234');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/app/crm');
  await page.waitForFunction(() => performance.getEntriesByName('ot-crm-list-usable').length > 0);
}

async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
}
