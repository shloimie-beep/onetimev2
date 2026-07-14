import { expect, test } from '@playwright/test';
import { login } from '../support/mfa-login.ts';

test('synthetic signup appears once in authenticated CRM and opens detail on mobile', async ({
  page,
}) => {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));
  await page.setViewportSize({ width: 390, height: 844 });
  const email = `crm-${Date.now()}@example.test`;

  await page.goto('/signup');
  await page.getByLabel('Parent or contact name').fill('CRM Browser Parent');
  await page.getByLabel('Family or School').fill('CRM Browser Family');
  await page.getByLabel('Location').fill('Jerusalem');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page
    .getByLabel('Confirm that we may send the selected class information and reminders.')
    .check();
  await page.getByRole('button', { name: 'Sign Up Now' }).click();
  await expect(page.getByRole('heading', { name: "You're signed up." })).toBeVisible();

  await login(page);
  await expect(page.getByRole('heading', { name: 'CRM' })).toBeVisible();
  await page.getByLabel('Search').fill(email);
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByRole('button', { name: /CRM Browser Parent/ })).toHaveCount(1);
  expect(
    requested.some((url) => url.includes(email) || url.includes(encodeURIComponent(email))),
  ).toBe(false);
  await page.getByRole('button', { name: /CRM Browser Parent/ }).click();
  await expect(page.getByRole('heading', { name: 'CRM Browser Parent' })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText('Public signup captured')).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
  expect(requested.some((url) => url.includes('operations') || url.includes('bna'))).toBe(false);

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'CRM' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'CRM Browser Parent' })).toBeVisible();
});

test('CRM create and edit controls are keyboard reachable with readable names', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'CRM' })).toBeFocused();
  await page.getByRole('button', { name: 'Add contact' }).click();
  const createForm = page.locator('.contact-form');
  await createForm.getByRole('textbox', { name: 'Name' }).fill('Keyboard Contact');
  await createForm.getByLabel('Type').selectOption('school');
  await createForm.getByLabel('Email').fill(`keyboard-${Date.now()}@example.test`);
  await createForm.getByLabel('Location').fill('London');
  await createForm.getByLabel('Timezone').fill('Europe/London');
  await createForm.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Keyboard Contact' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit' }).click();
  const editForm = page.locator('.contact-form');
  await editForm.getByLabel('Status').selectOption('contacted');
  await editForm.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('dd', { hasText: 'Contacted' })).toBeVisible();

  const targetSizes = await page.evaluate(() =>
    [...document.querySelectorAll('button, a[href], input, select, textarea')]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { tag: element.tagName, width: rect.width, height: rect.height };
      }),
  );
  expect(targetSizes.every((target) => target.height >= 44 || target.width >= 44)).toBe(true);
});
