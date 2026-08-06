import { expect, type Page, test } from '@playwright/test';

test('support route stays lead-only for anonymous users', async ({ page }) => {
  await page.goto('/app/support');
  await expect(page.getByRole('heading', { name: 'Sign in for learning support' })).toBeVisible();
  await expect(page.locator('[data-support-form]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /signup and help/i })).toHaveAttribute(
    'href',
    '/signup',
  );
});

test('active learning-access support form works at 360 and 390 mobile widths without overflow', async ({
  page,
}) => {
  await login(page, 'ot-parent@example.test', 'ParentPassword!234');
  for (const size of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await page.goto('/app/parent/support');
    await expect(page.getByRole('heading', { name: 'Member Support' })).toBeVisible();
    await expect(page.locator('[data-support-form]')).toBeVisible();
    await expect(page.getByLabel('Category')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit support request' })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  }
});

test('active member can submit by keyboard and receives a durable receipt', async ({ page }) => {
  await login(page, 'ot-parent@example.test', 'ParentPassword!234');
  await page.goto('/app/parent/support');
  await fillSupportForm(page, 'keyboard-success');
  await page.getByRole('button', { name: 'Submit support request' }).focus();
  await expect(page.getByRole('button', { name: 'Submit support request' })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/app\/parent\/support\/ots_[^/]+$/u);
  await expect(page.getByRole('heading', { name: 'Support Receipt' })).toBeVisible();
  await expect(page.getByText('Class page support keyboard-success')).toBeVisible();
  await expect(page.getByText('Saved in One Time')).toBeVisible();
});

test('duplicate support submission opens the original receipt', async ({ page }) => {
  const submittedKeys: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'POST') return;
    if (new URL(request.url()).pathname !== '/api/v1/support/v21/tickets') return;
    const body = request.postDataJSON() as { idempotency_key?: string };
    submittedKeys.push(body.idempotency_key ?? '');
  });
  await login(page, 'ot-parent@example.test', 'ParentPassword!234');
  await page.goto('/app/parent/support');
  const idempotencyKey = await page.locator('[data-idempotency-key]').inputValue();
  await fillSupportForm(page, 'duplicate-browser');
  await page.getByRole('button', { name: 'Submit support request' }).click();
  await page.waitForURL(/\/app\/parent\/support\/ots_[^/]+$/u);
  const firstReceiptPath = new URL(page.url()).pathname;

  await page.goto('/app/parent/support');
  await fillSupportForm(page, 'duplicate-browser');
  await page.locator('[data-support-form]').evaluate((form, value) => {
    const input = form.querySelector<HTMLInputElement>('[data-idempotency-key]');
    if (!input) throw new Error('Missing Support idempotency input.');
    input.value = String(value);
    (form as HTMLFormElement).requestSubmit();
  }, idempotencyKey);
  await page.waitForURL(/\/app\/parent\/support\/ots_[^/]+$/u);
  await expect.poll(() => submittedKeys).toHaveLength(2);
  expect(submittedKeys).toEqual([idempotencyKey, idempotencyKey]);
  expect(new URL(page.url()).pathname).toBe(firstReceiptPath);
  await expect(page.getByRole('heading', { name: 'Support Receipt' })).toBeVisible();
});

test('Admin can operate a durable Parent support conversation inside One Time', async ({
  page,
  context,
}) => {
  const subject = 'Admin lifecycle browser acceptance';
  await login(page, 'ot-parent@example.test', 'ParentPassword!234');
  await page.goto('/app/parent/support');
  await page.getByLabel('Category').selectOption('technical');
  await page.getByLabel('Title').fill(subject);
  await page
    .getByLabel('Message')
    .fill('Please verify that the Admin can manage this durable support conversation.');
  await page.getByRole('button', { name: 'Submit support request' }).click();
  await page.waitForURL(/\/app\/parent\/support\/ots_[^/]+$/u);
  const ticketId = decodeURIComponent(new URL(page.url()).pathname.split('/').at(-1) ?? '');

  await context.clearCookies();
  await page.goto(`/login?return_to=${encodeURIComponent('/app/tickets')}`);
  await page.getByLabel('Email').fill('ot-owner@example.test');
  await page.getByLabel('Password').fill('OwnerPassword!234');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/app/tickets');

  await expect(page.getByRole('heading', { name: 'Support ticket queue' })).toBeVisible();
  const queuedTicket = page.getByRole('article', { name: subject });
  await expect(queuedTicket).toBeVisible();
  await queuedTicket.getByRole('link', { name: 'Open ticket' }).click();
  await page.waitForURL(`**/app/tickets/${ticketId}`);
  await expect(
    page.getByRole('heading', { name: 'Ticket operations', exact: true, level: 2 }),
  ).toBeVisible();
  const ticket = page.getByRole('article', { name: subject });
  await expect(ticket).toBeVisible();

  const assignment = ticket.getByLabel(/^Assign ots_/u);
  await assignment.fill('support_admin_browser');
  await assignment.press('Tab');
  await expect(page.locator('.form-status')).toHaveText('Support conversation assigned.');

  await ticket.getByLabel('Status').selectOption('in_progress');
  await expect(page.locator('.form-status')).toHaveText('Support status updated.');

  await ticket
    .getByLabel('Reply in One Time')
    .fill('The Admin lifecycle is working and this reply is stored inside One Time.');
  await ticket.getByRole('button', { name: 'Send in-app reply' }).click();
  await expect(page.locator('.form-status')).toHaveText('In-app reply saved.');
  await expect(ticket.getByText('The Admin lifecycle is working')).toBeVisible();
});

test('support form reports server and network failures accessibly', async ({ page }) => {
  await login(page, 'ot-parent@example.test', 'ParentPassword!234');

  await page.goto('/app/parent/support');
  await fillSupportForm(page, 'server-failure');
  await page.route('/api/v1/support/v21/tickets', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'Member support is unavailable.' }),
    });
  });
  await page.getByRole('button', { name: 'Submit support request' }).click();
  await expect(page.getByRole('status')).toHaveText('Member support is unavailable.');
  await expect(page.getByRole('button', { name: 'Submit support request' })).toBeEnabled();
  await page.unroute('/api/v1/support/v21/tickets');

  await page.goto('/app/parent/support');
  await fillSupportForm(page, 'network-failure');
  await page.route('/api/v1/support/v21/tickets', async (route) => {
    await route.abort('failed');
  });
  await page.getByRole('button', { name: 'Submit support request' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Network error. Support request was not saved. Please try again.',
  );
  await expect(page.getByRole('status')).toBeFocused();
  await page.unroute('/api/v1/support/v21/tickets');
});

async function login(page: Page, email: string, password: string) {
  await page.goto(`/login?return_to=${encodeURIComponent('/app/parent')}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/app/parent');
}

async function fillSupportForm(page: Page, suffix: string) {
  await page.getByLabel('Category').selectOption('technical');
  await page.getByLabel('Title').fill(`Class page support ${suffix}`);
  await page
    .getByLabel('Message')
    .fill(`The class page is not opening after login for browser test ${suffix}.`);
}
