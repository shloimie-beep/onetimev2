import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { login } from '../support/mfa-login.ts';

for (const path of ['/', '/signup']) {
  test(`axe accessibility check ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}

test('axe accessibility check authenticated CRM', async ({ page }) => {
  await login(page);
  await page.getByRole('heading', { name: 'CRM' }).waitFor();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
