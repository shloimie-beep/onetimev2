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
  await page.goto('/app/parent/students/new');
  await expect(page.getByRole('heading', { name: 'Add Student' })).toBeVisible();

  const createForm = page.locator('form[aria-labelledby="create-student-heading"]');
  await createForm.getByLabel('Actual name').fill('Mounted Test Student');
  await createForm.getByLabel('Username').fill('mounted.student');

  await expectInvalidCredentialAttempt({
    form: createForm,
    password: 'ValidPass1!x',
    confirmation: 'DifferentPass!x',
    expectedError: 'Passwords must match before creating this Student.',
    expectedFocus: 'confirmation',
    requests,
  });
  await expectInvalidCredentialAttempt({
    form: createForm,
    password: 'short-pass1',
    confirmation: 'short-pass1',
    expectedError: 'Enter a password between 12 and 128 characters before creating this Student.',
    expectedFocus: 'password',
    requests,
  });
  await expectInvalidCredentialAttempt({
    form: createForm,
    password: 'x'.repeat(129),
    confirmation: 'x'.repeat(129),
    expectedError: 'Enter a password between 12 and 128 characters before creating this Student.',
    expectedFocus: 'password',
    requests,
  });

  await createForm.getByLabel('New password').fill('ValidPass1!x');
  await createForm.getByLabel('Confirm new password').fill('ValidPass1!x');
  const createResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().endsWith('/api/app/parent/students'),
  );
  await createForm.getByRole('button', { name: 'Create Student' }).click();
  expect((await createResponse).status()).toBe(201);
  expect(requests).toHaveLength(1);
  await expect(page.getByRole('status')).toContainText('Student created and enrolled');

  await page.getByRole('link', { name: 'Mounted Test Student' }).click();
  await page.locator('details summary').click();
  const resetForm = page.locator('form[aria-labelledby="reset-password-heading"]');
  await expect(resetForm).toBeVisible();

  await expectInvalidCredentialAttempt({
    form: resetForm,
    password: 'ValidPass1!x',
    confirmation: 'DifferentPass!x',
    expectedError: 'Passwords must match before resetting this Student password.',
    expectedFocus: 'confirmation',
    requests,
  });
  await expectInvalidCredentialAttempt({
    form: resetForm,
    password: 'short-pass1',
    confirmation: 'short-pass1',
    expectedError:
      'Enter a password between 12 and 128 characters before resetting this Student password.',
    expectedFocus: 'password',
    requests,
  });
  await expectInvalidCredentialAttempt({
    form: resetForm,
    password: 'x'.repeat(129),
    confirmation: 'x'.repeat(129),
    expectedError:
      'Enter a password between 12 and 128 characters before resetting this Student password.',
    expectedFocus: 'password',
    requests,
  });

  const maximumLengthPassword = `ValidPass1!${'x'.repeat(117)}`;
  expect(maximumLengthPassword).toHaveLength(128);
  await resetForm.getByLabel('New password').fill(maximumLengthPassword);
  await resetForm.getByLabel('Confirm new password').fill(maximumLengthPassword);
  const resetResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().includes('/credential-reset'),
  );
  await resetForm.getByRole('button', { name: 'Reset password' }).click();
  expect((await resetResponse).status()).toBe(200);
  expect(requests).toHaveLength(2);
});

async function signUpIsolatedParent(page: import('@playwright/test').Page) {
  await page.goto('/signup');
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
  const passwordField = form.getByLabel('New password');
  const confirmationField = form.getByLabel('Confirm new password');
  await passwordField.fill(password);
  await confirmationField.fill(confirmation);
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
