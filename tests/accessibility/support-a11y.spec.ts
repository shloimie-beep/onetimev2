import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

test('support anonymous, active, mobile, and receipt states pass axe', async ({ page }) => {
  await page.goto('/app/support');
  await expect(page.getByRole('heading', { name: 'Sign in for learning support' })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await login(page, 'ot-parent@example.test', 'ParentPassword!234');
  await page.goto('/app/parent/support');
  await expect(page.getByRole('heading', { name: 'Member Support' })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/parent/support');
  await expect(page.locator('[data-support-form]')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await fillSupportForm(page);
  await page.getByRole('button', { name: 'Submit support request' }).click();
  await page.waitForURL(/\/app\/parent\/support\/otr_[^/]+$/u);
  await expect(page.getByRole('heading', { name: 'Support Receipt' })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

async function login(page: Page, email: string, password: string) {
  await page.goto(`/login?return_to=${encodeURIComponent('/app/parent')}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/app/parent');
}

async function fillSupportForm(page: Page) {
  await page.getByLabel('Category').selectOption('technical_bug');
  await page.getByLabel('Title').fill('Class page support a11y');
  await page.getByLabel('Message').fill('The class page is not opening after login for axe test.');
  await page.getByLabel('Steps to reproduce').fill('Sign in\nOpen the class page');
  await page.getByLabel('Expected behavior').fill('The class page opens.');
  await page.getByLabel('Actual behavior').fill('The class page shows an error.');
  await page.getByLabel('Occurrence').selectOption('always');
  await page.getByLabel('Provider area').selectOption('authentication');
  await page.getByLabel('Error code').fill('CLASS_PAGE_ERROR');
  await page.getByLabel('Reply preference').selectOption('in_app');
}
