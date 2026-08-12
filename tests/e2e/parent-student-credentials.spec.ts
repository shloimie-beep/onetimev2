import { expect, test } from '@playwright/test';

test.skip(
  process.env.P12_PARENT_CREDENTIALS_HTTPS !== 'true',
  'This mounted v2.1 host-cookie test runs only through its loopback HTTPS config.',
);

test('P12 mounted Parent Create and Reset Student credential guards never dispatch invalid requests', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/app/parent/students')) {
      requests.push(request.url());
    }
  });

  await signUpIsolatedParent(page);
  const householdReadback = await page.evaluate(async () => {
    const response = await fetch('/api/app/parent/household', { credentials: 'same-origin' });
    const body = (await response.json().catch(() => null)) as {
      code?: unknown;
      message?: unknown;
    } | null;
    return {
      status: response.status,
      code: typeof body?.code === 'string' ? body.code : null,
      message: typeof body?.message === 'string' ? body.message : null,
    };
  });
  expect(householdReadback.status, JSON.stringify(householdReadback)).toBe(200);
  await page.goto('/app/parent/students/new');
  await expect(page.getByRole('heading', { name: 'Add Student' })).toBeVisible();

  const createForm = page.locator('form[aria-labelledby="create-student-heading"]');
  await createForm.getByLabel('Actual name').fill('Mounted Test Student');
  await createForm.getByLabel('Username').fill('mounted.student');

  await expectInvalidCredentialAttempt({
    form: createForm,
    password: '000123',
    confirmation: '123456',
    expectedError: 'Student PINs must match before creating this Student.',
    expectedFocus: 'confirmation',
    requests,
  });
  await expectInvalidCredentialAttempt({
    form: createForm,
    password: '12345',
    confirmation: '12345',
    expectedError: 'Enter exactly six numeric digits before creating this Student.',
    expectedFocus: 'password',
    requests,
  });
  await expectInvalidCredentialAttempt({
    form: createForm,
    password: '1234567',
    confirmation: '1234567',
    expectedError: 'Enter exactly six numeric digits before creating this Student.',
    expectedFocus: 'password',
    requests,
  });
  await expectInvalidCredentialAttempt({
    form: createForm,
    password: '12a456',
    confirmation: '12a456',
    expectedError: 'Enter exactly six numeric digits before creating this Student.',
    expectedFocus: 'password',
    requests,
  });

  await createForm.getByLabel('New six-digit Student PIN', { exact: true }).fill('000123');
  await createForm.getByLabel('Confirm Student PIN', { exact: true }).fill('000123');
  const createResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().endsWith('/api/app/parent/students'),
  );
  await createForm.getByRole('button', { name: 'Create Student' }).click();
  expect((await createResponse).status()).toBe(201);
  expect(requests).toHaveLength(1);
  await expect(
    page.getByRole('status').filter({ hasText: 'Student created and enrolled' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Mounted Test Student' }).click();
  await page.locator('details summary').click();
  const resetForm = page.locator('form[aria-labelledby="reset-pin-heading"]');
  await expect(resetForm).toBeVisible();

  await expectInvalidCredentialAttempt({
    form: resetForm,
    password: '000123',
    confirmation: '123456',
    expectedError: 'Student PINs must match before resetting this Student PIN.',
    expectedFocus: 'confirmation',
    requests,
  });
  await expectInvalidCredentialAttempt({
    form: resetForm,
    password: '12345',
    confirmation: '12345',
    expectedError: 'Enter exactly six numeric digits before resetting this Student PIN.',
    expectedFocus: 'password',
    requests,
  });
  await expectInvalidCredentialAttempt({
    form: resetForm,
    password: '1234567',
    confirmation: '1234567',
    expectedError: 'Enter exactly six numeric digits before resetting this Student PIN.',
    expectedFocus: 'password',
    requests,
  });
  await expectInvalidCredentialAttempt({
    form: resetForm,
    password: '12a456',
    confirmation: '12a456',
    expectedError: 'Enter exactly six numeric digits before resetting this Student PIN.',
    expectedFocus: 'password',
    requests,
  });

  await resetForm.getByLabel('New six-digit Student PIN', { exact: true }).fill('123456');
  await resetForm.getByLabel('Confirm Student PIN', { exact: true }).fill('123456');
  const resetResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().includes('/credential-reset'),
  );
  await resetForm.getByRole('button', { name: 'Reset PIN' }).click();
  expect((await resetResponse).status()).toBe(200);
  expect(requests).toHaveLength(2);
});

async function signUpIsolatedParent(page: import('@playwright/test').Page) {
  await page.goto('/signup');
  expect(new URL(page.url()).origin).toBe('https://127.0.0.1:3112');
  const response = await page.evaluate(async () => {
    const bootstrapResponse = await fetch('/api/v1/signup/family/bootstrap', {
      credentials: 'same-origin',
    });
    const bootstrap = (await bootstrapResponse.json()) as {
      csrf_token: string;
      idempotency_key: string;
      writes_allowed: boolean;
    };
    const signupResponse = await fetch('/api/v1/signup/family', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': bootstrap.csrf_token,
      },
      body: JSON.stringify({
        classification: 'family',
        idempotency_key: bootstrap.idempotency_key,
        first_name: 'Mounted',
        last_name: 'Parent',
        email: 'mounted-parent@example.test',
        password: 'correct horse battery staple',
        password_confirmation: 'correct horse battery staple',
        timezone: 'Asia/Jerusalem',
        terms_accepted: true,
        privacy_accepted: true,
        general_marketing_consent: true,
        parent_newsletter_consent: true,
      }),
    });
    return {
      bootstrapStatus: bootstrapResponse.status,
      writesAllowed: bootstrap.writes_allowed,
      status: signupResponse.status,
      text: await signupResponse.text(),
    };
  });
  expect(response.bootstrapStatus).toBe(200);
  expect(response.writesAllowed).toBe(true);
  expect(response.status, response.text).toBe(201);
}

async function expectInvalidCredentialAttempt({
  form,
  password,
  confirmation,
  expectedError,
  expectedFocus,
  requests,
}: {
  form: import('@playwright/test').Locator;
  password: string;
  confirmation: string;
  expectedError: string;
  expectedFocus: 'password' | 'confirmation';
  requests: string[];
}) {
  const requestsBefore = requests.length;
  const passwordField = form.getByLabel('New six-digit Student PIN', { exact: true });
  const confirmationField = form.getByLabel('Confirm Student PIN', { exact: true });
  await fillCredentialBoundaryValue(passwordField, password);
  await fillCredentialBoundaryValue(confirmationField, confirmation);
  await form.getByRole('button').click();
  const invalidField = expectedFocus === 'password' ? passwordField : confirmationField;
  await expect(invalidField).toHaveAttribute('aria-invalid', 'true');
  await expect(invalidField).toHaveAttribute('aria-describedby', /.+/u);
  const errorId = await invalidField.getAttribute('aria-describedby');
  if (!errorId) throw new Error('Expected the invalid field to reference its accessible error.');
  await expect(form.locator(`[id="${errorId}"]`)).toHaveText(expectedError);
  await expect(invalidField).toBeFocused();
  await expect.poll(() => requests.length).toBe(requestsBefore);
}

async function fillCredentialBoundaryValue(
  field: import('@playwright/test').Locator,
  value: string,
) {
  if (value.length <= 6) {
    await field.fill(value);
    return;
  }
  await field.evaluate((input) => input.removeAttribute('maxlength'));
  await field.fill(value);
  await field.evaluate((input) => input.setAttribute('maxlength', '6'));
}
