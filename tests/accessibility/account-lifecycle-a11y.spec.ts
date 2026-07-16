import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const route of ['/login', '/activate', '/forgot-password', '/reset-password']) {
  test(`OPS-03A auth page accessibility ${route}`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}
