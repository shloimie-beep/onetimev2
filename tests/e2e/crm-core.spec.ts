import { expect, test } from '@playwright/test';
import { CRM_CORE_E2E_OWNER_SESSION_TOKEN } from '../support/contact-operations-session.ts';

test('synthetic Family signup commits safely on mobile', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));
  await page.setViewportSize({ width: 390, height: 844 });
  const email = `crm-${Date.now()}@example.test`;
  const suffix = Date.now();

  await page.goto('/signup');
  await page.getByLabel('First name', { exact: true }).fill('CRM Browser Parent');
  await page.getByLabel('Last name', { exact: true }).fill(String(suffix));
  await page.getByRole('textbox', { name: 'Adult account email' }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('StrongPassword!234');
  await page.getByLabel('Confirm password').fill('StrongPassword!234');
  await expect(page.getByLabel(/Student.*email|WhatsApp|phone|card/i)).toHaveCount(0);
  await page.getByLabel(/I agree to the Terms/).check();
  await page.getByRole('button', { name: 'Create your Family account' }).click();
  await expect(page).toHaveURL(/\/signup\/received\?state=session_pending&email=pending$/u);
  await expect(page.getByRole('heading', { name: 'Signup received' })).toBeVisible();
  await expect(page.getByText('No card was charged by this signup form.')).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
  expect(requested.some((url) => url.includes('operations') || url.includes('bna'))).toBe(false);
});

test('CRM create and edit controls are keyboard reachable with readable names', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.locator('.mobile-current-link')).toBeFocused();
  await page.getByLabel('Contacts toolbar').getByRole('button', { name: 'Add contact' }).click();
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
  expect(targetSizes.every((target) => target.height >= 44 && target.width >= 44)).toBe(true);
});

async function login(page: import('@playwright/test').Page) {
  await page.context().clearCookies();
  await page.context().addCookies([
    {
      name: 'otcrm_session',
      value: CRM_CORE_E2E_OWNER_SESSION_TOKEN,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  await page.goto('/app/crm');
  await page.waitForFunction(() => performance.getEntriesByName('ot-crm-list-usable').length > 0);
}
