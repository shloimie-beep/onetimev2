import { expect, test } from '@playwright/test';

test('synthetic signup appears once in authenticated CRM and opens detail on mobile', async ({
  page,
}) => {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));
  await page.setViewportSize({ width: 390, height: 844 });
  const email = `crm-${Date.now()}@example.test`;
  const contactName = `CRM Browser Parent ${Date.now()}`;

  await page.goto('/signup');
  await page.getByLabel('Parent or contact name').fill(contactName);
  await page.getByLabel('Family or School').fill('CRM Browser Family');
  await page.getByLabel('Location').fill('Jerusalem');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await expect(page.getByLabel('Email reminders')).not.toBeChecked();
  await expect(page.getByLabel('WhatsApp reminders')).not.toBeChecked();
  await page.getByRole('button', { name: 'Sign Up Now' }).click();
  await expect(
    page.getByRole('heading', { name: 'Thank you - we received your Family signup.' }),
  ).toBeVisible();

  await login(page);
  await expect(page.getByRole('heading', { name: 'CRM' })).toBeVisible();
  await expect(page.getByLabel('Search')).toBeEnabled();
  await page.getByLabel('Search').fill(email);
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByRole('button', { name: new RegExp(contactName) })).toHaveCount(1);
  await page.getByRole('button', { name: new RegExp(contactName) }).click();
  await expect(page.getByRole('heading', { name: contactName })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText('Public signup captured')).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
  expect(requested.some((url) => url.includes('operations') || url.includes('bna'))).toBe(false);

  await page.getByRole('button', { name: 'Back to CRM' }).click();
  await expect(page.getByRole('heading', { name: 'CRM' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: contactName })).toBeVisible();
});

test('CRM create and edit controls are keyboard reachable with readable names', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.locator('.mobile-current-link')).toBeFocused();
  await page.getByLabel('CRM toolbar').getByRole('button', { name: 'Add contact' }).click();
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
  await page.goto('/login');
  await page.getByLabel('Email').fill('ot-admin@example.test');
  await page.getByLabel('Password').fill('TestPassword!234');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/app/crm');
  await page.waitForFunction(() => performance.getEntriesByName('ot-crm-list-usable').length > 0);
}
