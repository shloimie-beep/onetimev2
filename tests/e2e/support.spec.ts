import { expect, type Page, test } from '@playwright/test';

test('support route stays lead-only for anonymous and non-subscriber users', async ({ page }) => {
  await page.goto('/app/support');
  await expect(page.getByRole('heading', { name: 'Sign in for subscriber support' })).toBeVisible();
  await expect(page.locator('[data-support-form]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /public WhatsApp lead path/i })).toHaveAttribute(
    'href',
    '/signup',
  );

  await login(page, 'ot-student@example.test', 'StudentPassword!234');
  await page.goto('/app/support');
  await expect(
    page.getByRole('heading', { name: 'Subscriber support is unavailable' }),
  ).toBeVisible();
  await expect(page.locator('[data-support-form]')).toHaveCount(0);
});

test('active subscriber support form works at 360 and 390 mobile widths without overflow', async ({
  page,
}) => {
  await login(page, 'ot-parent@example.test', 'ParentPassword!234');
  for (const size of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await page.goto('/app/support');
    await expect(page.getByRole('heading', { name: 'Subscriber Support' })).toBeVisible();
    await expect(page.locator('[data-support-form]')).toBeVisible();
    await expect(page.getByLabel('Category')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit support request' })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  }
});

test('active subscriber can submit by keyboard and receives a durable receipt', async ({
  page,
}) => {
  await login(page, 'ot-parent@example.test', 'ParentPassword!234');
  await page.goto('/app/support');
  await fillSupportForm(page, 'keyboard-success');
  await page.getByRole('button', { name: 'Submit support request' }).focus();
  await expect(page.getByRole('button', { name: 'Submit support request' })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.waitForURL('**/app/support/receipts/**');
  await expect(page.getByRole('heading', { name: 'Support Receipt' })).toBeVisible();
  await expect(
    page.getByText('Support request received. Delivery to the support desk is queued.'),
  ).toBeVisible();
});

test('duplicate support submission opens the original receipt', async ({ page }) => {
  await login(page, 'ot-parent@example.test', 'ParentPassword!234');
  await page.goto('/app/support');
  const idempotencyKey = await page.locator('[data-idempotency-key]').inputValue();
  await fillSupportForm(page, 'duplicate-browser');
  await page.getByRole('button', { name: 'Submit support request' }).click();
  await page.waitForURL('**/app/support/receipts/**');
  const firstReceiptPath = new URL(page.url()).pathname;

  await page.goto('/app/support');
  await fillSupportForm(page, 'duplicate-browser');
  await page.locator('[data-idempotency-key]').evaluate((input, value) => {
    (input as HTMLInputElement).value = String(value);
  }, idempotencyKey);
  await page.getByRole('button', { name: 'Submit support request' }).click();
  await page.waitForURL(`**${firstReceiptPath}`);
  await expect(page.getByRole('heading', { name: 'Support Receipt' })).toBeVisible();
});

test('support form reports server, network, and file failures accessibly', async ({ page }) => {
  await login(page, 'ot-parent@example.test', 'ParentPassword!234');

  await page.goto('/app/support');
  await fillSupportForm(page, 'server-failure');
  await page.route('/api/v1/support/tickets', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'Subscriber support is unavailable.' }),
    });
  });
  await page.getByRole('button', { name: 'Submit support request' }).click();
  await expect(page.getByRole('status')).toHaveText('Subscriber support is unavailable.');
  await expect(page.getByRole('button', { name: 'Submit support request' })).toBeEnabled();
  await page.unroute('/api/v1/support/tickets');

  await page.goto('/app/support');
  await fillSupportForm(page, 'network-failure');
  await page.route('/api/v1/support/tickets', async (route) => {
    await route.abort('failed');
  });
  await page.getByRole('button', { name: 'Submit support request' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Network error. Support request was not saved. Please try again.',
  );
  await expect(page.getByRole('status')).toBeFocused();
  await page.unroute('/api/v1/support/tickets');

  await page.goto('/app/support');
  await page.evaluate(() => {
    Object.defineProperty(File.prototype, 'arrayBuffer', {
      configurable: true,
      value: () => Promise.reject(new Error('fixture read failure')),
    });
  });
  await fillSupportForm(page, 'file-failure');
  await page
    .getByLabel('Attachments')
    .setInputFiles({ name: 'broken.txt', mimeType: 'text/plain', buffer: Buffer.from('broken') });
  await page.getByRole('button', { name: 'Submit support request' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Attachment could not be read. Remove it and try again.',
  );
  await expect(page.getByLabel('Attachments')).toBeFocused();
});

async function login(page: Page, email: string, password: string) {
  await page.goto(`/login?return_to=${encodeURIComponent('/app/support')}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForLoadState('networkidle');
}

async function fillSupportForm(page: Page, suffix: string) {
  await page.getByLabel('Category').selectOption('bug');
  await page.getByLabel('Title').fill(`Class page support ${suffix}`);
  await page
    .getByLabel('Message')
    .fill(`The class page is not opening after login for browser test ${suffix}.`);
  await page.getByLabel('Steps to reproduce').fill('Sign in\nOpen the class page');
  await page.getByLabel('Expected behavior').fill('The class page opens.');
  await page.getByLabel('Actual behavior').fill('The class page shows an error.');
  await page.getByLabel('Occurrence').selectOption('always');
  await page.getByLabel('Provider area').selectOption('authentication');
  await page.getByLabel('Error code').fill('CLASS_PAGE_ERROR');
  await page.getByLabel('Reply preference').selectOption('in_app');
}
