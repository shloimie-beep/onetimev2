import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const path of ['/privacy', '/terms', '/communications-consent', '/student-data']) {
  test(`W13-10 legal page axe check ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}
