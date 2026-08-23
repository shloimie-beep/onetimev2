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
  await page.waitForURL(/\/app\/parent\/support\/ots_[^/]+$/u);
  await expect(page.getByRole('heading', { name: 'Support Receipt' })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('Admin ticket queue and detail pass axe', async ({ page, context }) => {
  const subject = 'Canonical ticket accessibility';
  await login(page, 'ot-parent@example.test', 'ParentPassword!234');
  await page.goto('/app/parent/support');
  await page.getByLabel('Category').selectOption('technical');
  await page.getByLabel('Title').fill(subject);
  await page
    .getByLabel('Message')
    .fill('Please verify the canonical Admin ticket queue and ticket detail accessibility.');
  await page.getByRole('button', { name: 'Submit support request' }).click();
  await page.waitForURL(/\/app\/parent\/support\/ots_[^/]+$/u);

  await context.clearCookies();
  await page.goto(`/login?return_to=${encodeURIComponent('/app/tickets')}`);
  await page.getByLabel('Email').fill('ot-owner@example.test');
  await page.getByLabel('Password').fill('OwnerPassword!234');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/app/tickets');
  await expect(page.getByRole('heading', { name: 'Support ticket queue' })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  const ticket = page.getByRole('article', { name: subject });
  await ticket.getByRole('link', { name: 'Open ticket' }).click();
  await page.waitForURL(/\/app\/tickets\/ots_[^/]+$/u);
  await expect(
    page.getByRole('heading', { name: 'Ticket operations', exact: true, level: 2 }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page
    .getByRole('navigation', { name: 'Admin utilities' })
    .getByRole('link', { name: 'Search' })
    .click();
  await page.waitForURL('**/app/search');
  await expect(page.getByRole('heading', { name: 'Search operational records' })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole('combobox', { name: /Search adults, households/u }).fill(subject);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('option', { name: new RegExp(subject, 'u') })).toBeVisible();
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
  await page.getByLabel('Category').selectOption('technical');
  await page.getByLabel('Title').fill('Class page support a11y');
  await page.getByLabel('Message').fill('The class page is not opening after login for axe test.');
}
