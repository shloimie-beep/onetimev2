import { expect, test } from '@playwright/test';
import {
  CONTACT_OPERATIONS_E2E_OWNER_SESSION_TOKEN,
  CONTACT_OPERATIONS_MOBILE_E2E_OWNER_SESSION_TOKEN,
} from '../support/contact-operations-session.ts';

test('Admin runs one-button Parent household enrollment and protected Contacts operations', async ({
  page,
}) => {
  const requestedUrls: string[] = [];
  page.on('request', (request) => requestedUrls.push(request.url()));
  await page.context().addCookies([
    {
      name: 'otcrm_session',
      value: CONTACT_OPERATIONS_E2E_OWNER_SESSION_TOKEN,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  await page.goto('/app/crm');
  await expect(page.getByRole('heading', { name: 'Contacts' })).toBeVisible();
  await page.getByLabel('Search').fill('Contact Operations Parent');
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.getByRole('button', { name: 'Open Contact Operations Parent' }).click();
  await expect(page.getByRole('heading', { name: 'Contact Operations Parent' })).toBeVisible();
  const existingResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().endsWith('/api/v1/contact-operations/households/contact_operations_household'),
  );
  await page.getByRole('button', { name: 'Manage household' }).click();
  expect((await existingResponse).status()).toBe(200);
  await expect(page).toHaveURL(
    /\/app\/crm\/contact-operations\?household=contact_operations_household$/,
  );
  await expect(page.getByRole('heading', { name: 'Contact Operations Family' })).toBeVisible();

  const openInGhl = page.getByRole('link', { name: 'Open in GHL' });
  await expect(openInGhl).toHaveAttribute(
    'href',
    /gohighlevel\.com\/v2\/location\/.+\/contacts\/detail\/contact_operations_highlevel_parent$/,
  );
  await expect(openInGhl).toHaveAttribute('rel', 'noopener noreferrer');

  const parentResetResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().endsWith('/parent-reset'),
  );
  await page.getByRole('button', { name: 'Request Parent reset' }).click();
  expect((await parentResetResponse).status()).toBe(200);
  await expect(
    page.getByText('A secure Parent recovery link was requested. No password is visible here.'),
  ).toBeVisible();

  const studentResetResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().includes('/students/contact_operations_learner/reset'),
  );
  await page.getByRole('button', { name: 'Request Student reset' }).first().click();
  expect((await studentResetResponse).status()).toBe(200);
  await expect(
    page.getByText('A secure Student reset was requested for delivery to the adult Parent.'),
  ).toBeVisible();

  const suspendResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().endsWith('/access/suspend'),
  );
  await page.getByRole('button', { name: 'Suspend' }).click();
  expect((await suspendResponse).status()).toBe(200);
  await expect(page.getByText('Household suspended. Billing was not changed.')).toBeVisible();

  const releaseResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().endsWith('/access/release'),
  );
  await page.getByRole('button', { name: 'Release suspension' }).click();
  expect((await releaseResponse).status()).toBe(200);

  const reconcileResponse = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().endsWith('/reconcile'),
  );
  await page.getByRole('button', { name: 'Reconcile this Parent' }).click();
  expect((await reconcileResponse).status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Reconciliation queued' })).toBeDisabled();

  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('heading', { name: 'Contacts' })).toBeVisible();
  await page.getByRole('button', { name: 'Parent household' }).click();
  await expect(page).toHaveURL(/\/app\/crm\/contact-operations$/);
  await expect(page.getByRole('heading', { name: 'Parent household' })).toBeVisible();

  const suffix = Date.now().toString().slice(-8);
  await page.getByLabel('Parent name').fill(`Browser Parent ${suffix}`);
  await page.getByLabel('Parent email').fill(`browser-parent-${suffix}@example.test`);
  await page.getByLabel('Parent phone').fill('+972501234599');
  await page.getByLabel('Family or School').fill(`Browser Family ${suffix}`);
  await page.getByLabel('Household name').fill(`Browser Household ${suffix}`);
  await page.getByLabel('Location').fill('Jerusalem');
  await page.getByLabel('Time zone').fill('Asia/Jerusalem');

  const firstStudent = page.getByRole('group', { name: 'Student 1' });
  await firstStudent.getByLabel('Student name').fill('Browser Student One');
  await firstStudent.getByLabel('Username').fill(`browser.one.${suffix}`);
  await page.getByRole('button', { name: 'Add Student' }).click();
  const secondStudent = page.getByRole('group', { name: 'Student 2' });
  await secondStudent.getByLabel('Student name').fill('Browser Student Two');
  await secondStudent.getByLabel('Username').fill(`browser.two.${suffix}`);
  await page.getByLabel('Grant complimentary access now').check();

  const enrollmentResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/api/v1/contact-operations/enrollments'),
  );
  await page.getByRole('button', { name: 'Create Parent household' }).click();
  expect((await enrollmentResponse).status()).toBe(201);
  await expect(
    page.getByText(
      'Parent invited and local Student accounts prepared. No child record was sent to GHL.',
    ),
  ).toBeVisible();
  await expect(page.getByText('Adult Parent only')).toBeVisible();
  await expect(page.getByText('None', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request Parent reset' })).toBeDisabled();

  expect(
    requestedUrls.filter(
      (url) => url.includes('gohighlevel.com') || url.includes('/contacts/detail/'),
    ),
  ).toEqual([]);
});

test('Admin reaches the existing Parent household naturally from Contacts on mobile', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().addCookies([
    {
      name: 'otcrm_session',
      value: CONTACT_OPERATIONS_MOBILE_E2E_OWNER_SESSION_TOKEN,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  await page.goto('/app/crm');
  await page.getByLabel('Search').fill('Contact Operations Parent');
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.getByRole('button', { name: /^Contact Operations Parent / }).click();
  await expect(page.getByRole('heading', { name: 'Contact Operations Parent' })).toBeVisible();
  await page.getByRole('button', { name: 'Manage household' }).click();
  await expect(page).toHaveURL(
    /\/app\/crm\/contact-operations\?household=contact_operations_household$/,
  );
  await expect(page.getByRole('heading', { name: 'Contact Operations Family' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request Parent reset' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request Student reset' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open in GHL' })).toHaveAttribute(
    'rel',
    'noopener noreferrer',
  );

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
