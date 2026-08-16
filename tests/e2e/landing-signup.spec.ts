import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const testBaseUrl =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? '3100'}`;

const bootstrap = {
  success: true,
  idempotency_key: 'a'.repeat(43),
  csrf_token: `1789138800.${'b'.repeat(43)}.${'c'.repeat(43)}`,
  expires_at: '2026-09-11T15:20:00.000Z',
  writes_allowed: true,
};

test('public landing implements the bounded product-repair contract', async ({ page }) => {
  await useServerDate(page, '2026-08-01T12:00:00.000Z');
  await page.setViewportSize({ width: 1440, height: 1000 });
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Help your son love learning Mishnayos.' }),
  ).toBeVisible();
  await expect(
    page.getByText('Sunday-through-Thursday reminders help keep the learning consistent.'),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Clear Torah teaching with warmth and energy.' }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /world-renowned|Master Shas|daily reminders|daily rhythm|daily Torah-learning routine|daily learning community/i,
    ),
  ).toHaveCount(0);
  await expect(page.locator('.hero-eyebrow')).toHaveText('LIVE, ONLINE + ON-DEMAND');
  await expect(page.locator('.hero-subheadline')).toHaveText('Classes begin today. Sign up now.');
  await expect(page.locator('.hero-access-detail')).toHaveText(
    'Try One Time free through September 11. No card required.',
  );
  await expect(page.locator('.hero-supporting, .hero .schedule, .hero-note')).toHaveCount(0);
  const heroCta = page.locator('.hero .hero-cta');
  await expect(heroCta).toHaveText('Create Family Account');
  await expect(heroCta).toHaveAttribute('href', '/signup');
  await expect(page.locator('.hero .hero-cta')).toHaveCount(1);
  await expect(heroCta).toHaveCSS('background-color', 'rgb(255, 212, 0)');
  await expect(page.locator('.hero h1')).toHaveCSS('font-family', /Inter/);
  await expect(page.locator('.hero h1')).toHaveCSS('font-weight', '900');
  await expect(page.locator('.hero-photo img')).toHaveAttribute(
    'src',
    '/assets/hero/hero-classroom-background.webp',
  );
  await expect(page.locator('.hero-photo img')).toHaveAttribute('width', '1680');
  await expect(page.locator('.hero-photo img')).toHaveAttribute('height', '944');
  await expect(page.locator('.hero [src*="composite"], .hero [style*="composite"]')).toHaveCount(0);

  await expect(
    page.locator('.experience, .participation, .enrollment, #access, .assurances'),
  ).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Experience', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Pricing', exact: true })).toHaveCount(0);
  await expect(
    page.getByText(
      'A Parent can learn directly from the Parent account without using any of the three child learner seats.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'How It Works' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'As seen across the Jewish world.' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: /What he['’]ll gain/i })).toHaveCount(0);
  for (const outcome of ['Clarity', 'Retention', 'Progress']) {
    await expect(page.getByRole('heading', { name: outcome, exact: true })).toBeVisible();
  }
  await expect(page.locator('#gain .benefit-card')).toHaveCount(3);
  await expect(page.locator('#gain > .section-intro')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Rabbi Eli Teaching Around the World' }),
  ).toBeVisible();
  await expect(page.locator('#how-it-works .how-intro > img')).toHaveCount(0);
  const familyFlowImages = page.locator('#how-it-works .how-flow-grid img');
  await expect(familyFlowImages).toHaveCount(3);
  for (const image of [
    'family-learning-overview-1254.webp',
    'parent-creates-student-login-1254.webp',
    'student-learning-mishnayos-1254.webp',
  ]) {
    const flowImage = page.locator(`#how-it-works img[src$="${image}"]`);
    await expect(flowImage).toBeVisible();
    await expect(flowImage).toHaveAttribute(
      'width',
      image.startsWith('family-learning') ? '1122' : '1254',
    );
    await expect(flowImage).toHaveAttribute(
      'height',
      image.startsWith('family-learning') ? '1402' : '1254',
    );
    await expect(flowImage).toHaveAttribute('loading', 'lazy');
    await expect(flowImage).toHaveAttribute(
      'srcset',
      /480\.webp 480w.*800\.webp 800w.*1254\.webp (?:1122|1254)w/u,
    );
  }
  await expect(page.locator('.how-flow').nth(0).locator('strong')).toHaveText(
    'Create your Family account',
  );
  await expect(page.locator('.how-flow').nth(1).locator('strong')).toHaveText(
    'Add your Student accounts',
  );
  await expect(page.locator('.how-flow').nth(2).locator('strong')).toHaveText(
    'Your child learns at his own pace',
  );
  await expect(page.locator('.how-flow').nth(2).locator('img')).toHaveAttribute(
    'src',
    '/assets/how-it-works/student-learning-mishnayos-1254.webp',
  );
  await expect(page.getByText(/pre-register|portal is ready|we.?ll email you/i)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Terms', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cancellation and refunds' })).toHaveAttribute(
    'href',
    '/cancellation-refund',
  );
  await expect(page.getByRole('link', { name: 'Privacy Notice' }).last()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Student Data Notice' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Member Login' }).last()).toHaveAttribute(
    'href',
    'https://app.onetimeonetime.com/login',
  );
  await expect(page.getByRole('link', { name: 'Support' }).last()).toHaveAttribute(
    'href',
    '/support',
  );
  await expect(page.getByText(/fake|testimonial/i)).toHaveCount(0);
  expect(requests.some((url) => /(?:operations|bna)/i.test(url))).toBe(false);

  await assertGalleryControls(page);

  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://join.onetimeonetime.com/assets/social/mishnayos-made-memorable.png',
  );
  const brokenImages = await page.locator('img').evaluateAll((images) =>
    images
      .filter((image) => (image as HTMLImageElement).loading !== 'lazy')
      .filter(
        (image) =>
          !(image as HTMLImageElement).complete || !(image as HTMLImageElement).naturalWidth,
      )
      .map((image) => (image as HTMLImageElement).src),
  );
  expect(brokenImages).toEqual([]);
  expect(
    await page
      .locator('img')
      .evaluateAll((images) =>
        images
          .filter((image) => !image.getAttribute('width') || !image.getAttribute('height'))
          .map((image) => image.getAttribute('src')),
      ),
  ).toEqual([]);
});

test('gallery selection and playback controls update their rendered state', async ({ page }) => {
  await useServerDate(page, '2026-08-01T12:00:00.000Z');
  await page.goto('/');
  await assertGalleryControls(page);
});

test('canonical launch timing controls the animated ribbon boundary', async ({ page }) => {
  await useServerDate(page, '2026-09-11T14:59:00.000Z');
  await page.goto('/');
  await expect(page.locator('.campaign-ticker-shell')).toBeVisible();
  await expect(page.locator('.campaign-ticker')).toHaveAttribute(
    'aria-label',
    'CLASSES START AUG 16 · 7 PM · FREE ACCESS THROUGH SEP 11 · 6 PM · JERUSALEM TIME',
  );
  await expect(page.locator('.campaign-ticker-track')).toHaveCSS(
    'animation-name',
    'campaign-ticker-scroll',
  );
  const initialTransform = await page
    .locator('.campaign-ticker-track')
    .evaluate((element) => getComputedStyle(element).transform);
  await page.waitForTimeout(500);
  await expect
    .poll(() =>
      page
        .locator('.campaign-ticker-track')
        .evaluate((element) => getComputedStyle(element).transform),
    )
    .not.toBe(initialTransform);

  await page.unrouteAll({ behavior: 'wait' });
  await useServerDate(page, '2026-09-11T15:00:01.000Z');
  await page.reload();
  await expect(page.locator('.campaign-ticker-shell')).toBeHidden();

  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: 'Create Family Account' })).toBeVisible();
  await expect(page.locator('.signup-intro')).toHaveText('Create Family Account');
  await expect(page.locator('.signup-intro > *')).toHaveCount(1);
  for (const repetitiveCopy of [
    'Create one adult-managed Family account, then add up to three Students without supplying Student email addresses.',
    'Free access ends Friday, September 11, 2026 at 6:00 PM Asia/Jerusalem. No card is collected and there is no automatic charge.',
    'One adult account can manage up to three separate learner seats. An adult who wants to learn as a Student must use a separate Student seat. Student email is not required.',
    'No credit card required. Free access ends September 11, 2026 at 6:00 PM Asia/Jerusalem.',
    '$67/month after account creation through secure hosted checkout. No charge is made by this form.',
  ]) {
    await expect(page.getByText(repetitiveCopy, { exact: true })).toBeHidden();
  }
  await expect(page.getByRole('heading', { name: 'Create the adult Family account' })).toHaveCount(
    0,
  );
  await expect(page.locator('[data-family-fields]')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Agreement' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create your Family account' })).toBeVisible();
  expect(
    await page.locator('.site-footer nav a').evaluateAll((links) =>
      links.map((link) => ({
        label: link.textContent?.trim(),
        href: link.getAttribute('href'),
      })),
    ),
  ).toEqual([
    { label: 'Privacy Notice', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
    { label: 'Cancellation and refunds', href: '/cancellation-refund' },
    { label: 'Student Data Notice', href: '/student-data' },
    { label: 'Support', href: '/support' },
  ]);
});

test('Family submission uses the canonical bootstrap and exact cardless adult payload', async ({
  page,
}) => {
  await useServerDate(page, '2026-08-01T12:00:00.000Z');
  let observedPayload: Record<string, unknown> | null = null;
  let observedCsrf = '';
  let leadCalls = 0;
  await page.route('**/api/v1/signup/family/bootstrap', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(bootstrap),
    }),
  );
  await page.route('**/api/v1/signup/family', async (route) => {
    observedCsrf = route.request().headers()['x-csrf-token'] ?? '';
    observedPayload = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        code: 'SIGNUP_COMMITTED_SESSION_UNAVAILABLE',
        session_established: false,
        provider_projection_state: 'readback_required',
        message:
          'Your Family account is ready. You can continue now while we finish sending your confirmation email.',
      }),
    });
  });
  await page.route('**/api/v1/leads', (route) => {
    leadCalls += 1;
    return route.abort();
  });

  await page.goto('/signup?entry=family');
  await expect(page.getByRole('heading', { name: 'Create Family Account' })).toBeVisible();
  await expect(page.locator('[data-school-fields]')).toHaveCount(0);
  await expect(page.getByLabel(/student.*email|phone|whatsapp|card/i)).toHaveCount(0);
  await page.getByLabel('First name', { exact: true }).fill('Playwright');
  await page.getByLabel('Last name', { exact: true }).fill('Parent');
  await page.getByLabel('Adult account email').fill('family@example.test');
  await page.getByLabel('Password', { exact: true }).fill('StrongPassword!234');
  await page.getByLabel('Confirm password').fill('StrongPassword!234');
  await page.getByLabel(/I agree to the Terms/).check();
  await expect(page.locator('input[name="privacy_accepted"]')).toHaveCount(0);
  await expect(page.locator('input[name="general_marketing_consent"]')).toHaveCount(0);
  await expect(page.locator('input[name="parent_newsletter_consent"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Create your Family account' }).click();

  await expect(page).toHaveURL(/\/signup\/received\?state=session_pending&email=pending$/u);
  await expect(page.getByRole('heading', { name: 'Signup received' })).toBeVisible();
  await expect(
    page.getByText(
      'Your Family account was saved. Sign in to continue while we finish sending your confirmation email.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
    'href',
    'https://app.onetimeonetime.com/login',
  );
  await expect(page.getByRole('link', { name: 'Go to Parent dashboard' })).toHaveCount(0);
  await expect(page.getByText('No card was charged by this signup form.')).toBeVisible();
  expect(observedCsrf).toBe(bootstrap.csrf_token);
  expect(leadCalls).toBe(0);
  expect(observedPayload).toEqual({
    classification: 'family',
    idempotency_key: bootstrap.idempotency_key,
    first_name: 'Playwright',
    last_name: 'Parent',
    email: 'family@example.test',
    password: 'StrongPassword!234',
    password_confirmation: 'StrongPassword!234',
    timezone: expect.any(String),
    terms_accepted: true,
    privacy_accepted: true,
    general_marketing_consent: true,
    parent_newsletter_consent: true,
  });
  const serialized = JSON.stringify(observedPayload);
  expect(serialized).not.toMatch(/student|phone|whatsapp|card|payment_method/i);
});

test('Family signup keeps validation inline, accessible, and focused without navigation', async ({
  page,
}) => {
  await page.route('**/api/v1/signup/family/bootstrap', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(bootstrap),
    }),
  );
  let submitCalls = 0;
  await page.route('**/api/v1/signup/family', (route) => {
    submitCalls += 1;
    return route.abort();
  });
  await page.goto('/signup');
  const signupUrl = page.url();
  const password = page.getByLabel('Password', { exact: true });
  await expect(password).toHaveAttribute('minlength', '6');
  await expect(password).toHaveAttribute('maxlength', '128');

  await page.getByRole('button', { name: 'Create your Family account' }).click();
  await expect(page.locator('[data-error-for="first_name"]')).toHaveText('This field is required.');
  await expect(page.getByLabel('First name', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(page.getByLabel('First name', { exact: true })).toHaveAttribute(
    'aria-describedby',
    'first_name-error',
  );
  await expect(page.getByLabel('First name', { exact: true })).toBeFocused();
  await expect(page).toHaveURL(signupUrl);
  expect(submitCalls).toBe(0);

  await page.getByLabel('First name', { exact: true }).fill('Mobile');
  await page.getByLabel('Last name', { exact: true }).fill('Parent');
  await page.getByLabel('Adult account email').fill('not-an-email');
  await password.fill('Abc123');
  await page.getByLabel('Confirm password').fill('Abc124');
  await page.getByRole('button', { name: 'Create your Family account' }).click();
  await expect(page.locator('[data-error-for="email"]')).toHaveText('Enter a valid email address.');
  await expect(page.getByLabel('Adult account email')).toBeFocused();
  await expect(page).toHaveURL(signupUrl);
  expect(submitCalls).toBe(0);

  await page.getByLabel('Adult account email').fill('mobile-parent@example.test');
  await page.getByRole('button', { name: 'Create your Family account' }).click();
  await expect(page.locator('[data-error-for="password_confirmation"]')).toHaveText(
    'Passwords must match.',
  );
  await expect(page.getByLabel('Confirm password')).toBeFocused();
  await expect(page).toHaveURL(signupUrl);
  expect(submitCalls).toBe(0);
});

test('Family signup silently renews a stale bootstrap once and preserves entered fields', async ({
  page,
}) => {
  let bootstrapCalls = 0;
  const posted: Array<Record<string, unknown>> = [];
  await page.route('**/api/v1/signup/family/bootstrap', (route) => {
    bootstrapCalls += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...bootstrap,
        idempotency_key: bootstrapCalls === 1 ? 'a'.repeat(43) : 'd'.repeat(43),
        csrf_token:
          bootstrapCalls === 1
            ? `1789138800.${'b'.repeat(43)}.${'c'.repeat(43)}`
            : `1789138800.${'e'.repeat(43)}.${'f'.repeat(43)}`,
      }),
    });
  });
  await page.route('**/api/v1/signup/family', async (route) => {
    posted.push(route.request().postDataJSON() as Record<string, unknown>);
    if (posted.length === 1) {
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          code: 'CSRF_REQUIRED',
          message: 'We could not verify this request.',
        }),
      });
    }
    return route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        code: 'SIGNUP_COMMITTED_SESSION_UNAVAILABLE',
        session_established: false,
        provider_projection_state: 'readback_required',
      }),
    });
  });

  await page.goto('/signup');
  await page.getByLabel('First name', { exact: true }).fill('Retry');
  await page.getByLabel('Last name', { exact: true }).fill('Parent');
  await page.getByLabel('Adult account email').fill('retry-parent@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Abc123');
  await page.getByLabel('Confirm password').fill('Abc123');
  await page.getByLabel(/I agree to the Terms/).check();
  await page.getByRole('button', { name: 'Create your Family account' }).click();

  await expect(page).toHaveURL(/\/signup\/received\?state=session_pending&email=pending$/u);
  expect(bootstrapCalls).toBe(2);
  expect(posted).toHaveLength(2);
  expect(posted[0]).toMatchObject({
    idempotency_key: 'a'.repeat(43),
    first_name: 'Retry',
    last_name: 'Parent',
    email: 'retry-parent@example.test',
  });
  expect(posted[1]).toMatchObject({
    idempotency_key: 'd'.repeat(43),
    first_name: 'Retry',
    last_name: 'Parent',
    email: 'retry-parent@example.test',
  });
});

test('Family signup keeps server errors inline and locks an uncertain result without a reload or value loss', async ({
  page,
}) => {
  let bootstrapCalls = 0;
  let submitCalls = 0;
  await page.route('**/api/v1/signup/family/bootstrap', (route) => {
    bootstrapCalls += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(bootstrap),
    });
  });
  await page.route('**/api/v1/signup/family', (route) => {
    submitCalls += 1;
    return route.fulfill({
      status: submitCalls === 1 ? 400 : 503,
      contentType: 'application/json',
      body: JSON.stringify(
        submitCalls === 1
          ? {
              success: false,
              code: 'VALIDATION_ERROR',
              message: 'Please check the Family signup form.',
              field_errors: { email: 'Enter a valid email address.' },
            }
          : {
              success: false,
              code: 'SERVER_ERROR',
              message: 'Refresh the page and try again.',
              field_errors: { email: 'This stale field error must not make a 5xx retryable.' },
            },
      ),
    });
  });

  await page.goto('/signup');
  const signupUrl = page.url();
  await page.evaluate(() => {
    (window as typeof window & { signupPageMarker?: string }).signupPageMarker = 'still-mounted';
  });
  await page.getByLabel('First name', { exact: true }).fill('Saved');
  await page.getByLabel('Last name', { exact: true }).fill('Values');
  await page.getByLabel('Adult account email').fill('saved@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Abc123');
  await page.getByLabel('Confirm password').fill('Abc123');
  await page.getByLabel(/I agree to the Terms/).check();
  await page.getByRole('button', { name: 'Create your Family account' }).click();

  await expect(page.getByLabel('Adult account email')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Adult account email')).toBeFocused();
  await expect(page.locator('[data-form-status]')).toHaveText(
    'Please check the highlighted fields.',
  );
  await expect(page.getByLabel('First name', { exact: true })).toHaveValue('Saved');
  await expect(page.getByLabel('Last name', { exact: true })).toHaveValue('Values');
  await expect(page.getByLabel('Adult account email')).toHaveValue('saved@example.test');
  await expect(page).toHaveURL(signupUrl);
  expect(
    await page.evaluate(
      () => (window as typeof window & { signupPageMarker?: string }).signupPageMarker,
    ),
  ).toBe('still-mounted');

  await page.getByLabel('Adult account email').fill('saved-again@example.test');
  await page.getByRole('button', { name: 'Create your Family account' }).click();
  await expect(page.locator('[data-form-status]')).toContainText(
    "We couldn't confirm whether your account was created.",
  );
  await expect(page.locator('[data-form-status]')).not.toContainText(/refresh/iu);
  await expect(page.getByRole('button', { name: 'Check sign-in instead' })).toBeDisabled();
  await expect(page.getByLabel('First name', { exact: true })).toHaveValue('Saved');
  await expect(page.getByLabel('Last name', { exact: true })).toHaveValue('Values');
  await expect(page.getByLabel('Adult account email')).toHaveValue('saved-again@example.test');
  await expect(page).toHaveURL(signupUrl);
  expect(
    await page.evaluate(
      () => (window as typeof window & { signupPageMarker?: string }).signupPageMarker,
    ),
  ).toBe('still-mounted');
  await page.locator('[data-signup-form]').evaluate((candidate) => {
    candidate.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(50);
  expect(submitCalls).toBe(2);
  expect(bootstrapCalls).toBe(1);
});

test('verified Family signup opens authenticated Parent Today immediately', async ({ page }) => {
  await useServerDate(page, '2026-08-01T12:00:00.000Z');
  const canonicalJoinOrigin = 'https://join.onetimeonetime.com';
  const canonicalAppOrigin = 'https://app.onetimeonetime.com';
  const observedFamilyFetches: Array<{ url: string; credentials: string | null }> = [];
  let parentCookie = '';
  let canonicalJoinCsp = '';
  await page.exposeFunction(
    'recordFamilySignupFetch',
    (request: { url: string; credentials: string | null }) => {
      observedFamilyFetches.push(request);
    },
  );
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = new URL(
        typeof input === 'string' || input instanceof URL ? input.toString() : input.url,
        window.location.href,
      ).toString();
      if (
        /^https:\/\/app\.onetimeonetime\.com\/api\/v1\/signup\/family(?:\/bootstrap)?$/u.test(
          requestUrl,
        )
      ) {
        await (
          window as typeof window & {
            recordFamilySignupFetch: (request: {
              url: string;
              credentials: string | null;
            }) => Promise<void>;
          }
        ).recordFamilySignupFetch({
          url: requestUrl,
          credentials: init?.credentials?.toString() ?? null,
        });
      }
      return originalFetch(input, init);
    };
  });
  await proxyCanonicalJoinToLocal(page, '2026-08-01T12:00:00.000Z', (csp) => {
    canonicalJoinCsp = csp;
  });
  const corsHeaders = {
    'access-control-allow-origin': canonicalJoinOrigin,
    'access-control-allow-credentials': 'true',
    vary: 'Origin',
  };
  await page.route(`${canonicalAppOrigin}/api/v1/signup/family/bootstrap`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify(bootstrap),
    }),
  );
  await page.route(`${canonicalAppOrigin}/api/v1/signup/family`, (route) => {
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          ...corsHeaders,
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'accept, content-type, x-csrf-token',
        },
      });
    }
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      headers: {
        ...corsHeaders,
        'set-cookie':
          '__Host-parent_session=parent-session-probe; Path=/; Secure; HttpOnly; SameSite=Strict',
      },
      body: JSON.stringify({
        success: true,
        code: 'FAMILY_SIGNUP_COMPLETE',
        session_established: true,
        continue_to: '/app/parent',
        provider_projection_state: 'ready',
        message: 'Your Family account is ready, and we sent your confirmation email.',
      }),
    });
  });
  await page.route(`${canonicalAppOrigin}/app/parent`, (route) => {
    parentCookie = route.request().headers().cookie ?? '';
    return route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>Parent dashboard</title><h1>Parent dashboard</h1>',
    });
  });
  const route = `${canonicalJoinOrigin}/signup?continue_to=%2Fapp%2Fparent%2Faccount`;
  await page.goto(route);
  await completeFamilySignupForm(page, 'continued-family@example.test');
  await expect(page).toHaveURL(`${canonicalAppOrigin}/app/parent`);
  await expect(page.getByRole('heading', { name: 'Parent dashboard' })).toBeVisible();
  expect(observedFamilyFetches).toEqual([
    {
      url: `${canonicalAppOrigin}/api/v1/signup/family/bootstrap`,
      credentials: 'include',
    },
    {
      url: `${canonicalAppOrigin}/api/v1/signup/family`,
      credentials: 'include',
    },
  ]);
  expect(parentCookie).toContain('__Host-parent_session=parent-session-probe');
  expect(canonicalJoinCsp).toContain("connect-src 'self' https://app.onetimeonetime.com");
});

test('the real Parent bundle loads the Parent learner without legacy household reads', async ({
  page,
}) => {
  const legacyRequests: string[] = [];
  const welcomeAssetRequests: string[] = [];
  let bootstrapCalls = 0;
  let logoutCalls = 0;
  let classLaunchCalls = 0;
  let contentOpenCalls = 0;
  const welcomeEvents: Array<Record<string, unknown>> = [];
  const attendanceEvents: Array<Record<string, unknown>> = [];
  const parentDocumentPaths: string[] = [];
  const zoomSdkRequests: string[] = [];
  let classroomShellCsp = '';
  await page.route('https://source.zoom.us/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    zoomSdkRequests.push(pathname);
    if (pathname.endsWith('.css')) {
      await route.fulfill({ status: 200, contentType: 'text/css', body: '' });
      return;
    }
    const body = pathname.includes('/zoom-meeting-')
      ? `window.ZoomMtg = {
          setZoomJSLib() {},
          preLoadWasm() {},
          prepareWebSDK() {},
          inMeetingServiceListener(_name, handler) { window.__parentMeetingStatus = handler; },
          removeInMeetingServiceListener() {},
          init(options) { window.__parentLeaveUrl = options.leaveUrl; options.success(); },
          join(options) {
            window.__parentSdkJoin = {
              meetingNumber: options.meetingNumber,
              passWord: options.passWord,
              signature: options.signature,
              userName: options.userName,
            };
            options.success();
            queueMicrotask(() => window.__parentMeetingStatus?.({ meetingStatus: 2 }));
          }
        };`
      : '';
    await route.fulfill({ status: 200, contentType: 'text/javascript', body });
  });
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (
      pathname.startsWith('/api/app/parent/welcome-video/') &&
      pathname !== '/api/app/parent/welcome-video/events'
    ) {
      welcomeAssetRequests.push(pathname);
    }
    if (
      pathname === '/api/v1/auth/session' ||
      (pathname.startsWith('/api/v1/portals/parent/') &&
        !pathname.startsWith('/api/v1/portals/parent/learning')) ||
      pathname.startsWith('/api/v1/contact-operations/')
    ) {
      legacyRequests.push(pathname);
    }
  });
  await page.route(/\/app\/parent(?:\/(?:classroom|library|questions))?(?:\?.*)?$/u, (route) => {
    const pathname = new URL(route.request().url()).pathname;
    parentDocumentPaths.push(pathname);
    const contentSecurityPolicy =
      pathname === '/app/parent/classroom'
        ? [
            "default-src 'self'",
            "img-src 'self' data: blob: https://source.zoom.us",
            "script-src 'self' https://source.zoom.us dmogdx0jrul3u.cloudfront.net blob: 'unsafe-eval' 'wasm-unsafe-eval'",
            "style-src 'self' 'unsafe-inline' https://source.zoom.us",
            "connect-src 'self' https://zoom.us https://*.zoom.us wss://*.zoom.us",
            "worker-src 'self' blob:",
            "media-src 'self' blob: mediastream:",
            "object-src 'none'",
          ].join('; ')
        : "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'";
    if (pathname === '/app/parent/classroom') classroomShellCsp = contentSecurityPolicy;
    return route.fulfill({
      status: 200,
      contentType: 'text/html',
      headers: { 'content-security-policy': contentSecurityPolicy },
      body: [
        '<!doctype html><html><head>',
        '<link rel="stylesheet" href="/assets/app-crm.css">',
        '</head><body><div id="portal-root"></div>',
        '<script type="module" src="/assets/app-portal.js"></script>',
        '</body></html>',
      ].join(''),
    });
  });
  await page.route('**/api/v2.1/auth/session', (route) => {
    bootstrapCalls += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        authenticated: true,
        session_model: 'v21',
        user: {
          user_key: 'account_parent_bundle',
          email: 'parent-bundle@example.test',
          display_name: 'Bundle Parent',
          role: 'parent',
          role_label: 'Parent',
          mfa_capable: false,
        },
        csrf_token: `c1.${'d'.repeat(43)}.${'e'.repeat(43)}`,
        expires_at: '2026-08-02T12:00:00.000Z',
        parent_context: {
          adult_id: 'adult_parent_bundle',
          human_account_id: 'account_parent_bundle',
          owned_household_count: 1,
          household: {
            household_id: 'household_parent_bundle',
            display_name: 'Bundle Parent family',
            classification: 'family',
            access_state: 'free',
            owner_relationship: 'account_owner',
          },
        },
      }),
    });
  });
  await page.route('**/api/v1/portals/parent/learning', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          snapshot: {
            contract_version: '1.0.0',
            participant_id: 'parent:household_parent_bundle',
            household_id: 'household_parent_bundle',
            display_name: 'Bundle Parent',
            state: 'active',
            learner_ordinal: 1,
            capacity: {
              total_learners: 4,
              parent_learners: 1,
              child_student_limit: 3,
              active_child_students: 0,
              available_child_student_seats: 3,
            },
            class_entitlement: {
              class_series_key: 'class_series_one_time_daily',
              class_title: 'Daily One Time Mishnayos',
              effective_at: '2026-08-01T12:00:00.000Z',
            },
            next_class: {
              occurrence_id: 'occurrence_parent_bundle',
              title: 'Today\u2019s Mishnayos',
              starts_at: '2026-08-16T16:00:00.000Z',
              ends_at: '2026-08-16T16:30:00.000Z',
              join_opens_at: '2026-08-16T15:55:00.000Z',
              join_closes_at: '2026-08-16T16:35:00.000Z',
              state: 'live',
              launch_action: {
                action_key: 'class-launch-parent-bundle',
                label: 'Join class',
                kind: 'class_launch',
                method: 'POST',
                href: '/api/v1/classroom/production-basic/launch',
                launch_token_ref: null,
                expires_at: '2026-08-16T16:35:00.000Z',
              },
            },
            library_items: [
              {
                content_id: 'content-parent-bundle',
                content_version_id: 'content-version-parent-bundle',
                title: 'Berachos 1:1 review',
                item_type: 'video',
                published_at: '2026-08-15T12:00:00.000Z',
                progress: {
                  position_ms: 90_000,
                  duration_ms: 300_000,
                  completed: false,
                  updated_at: '2026-08-16T12:00:00.000Z',
                },
                open_action: {
                  action_key: 'content-open-parent-bundle',
                  label: 'Continue lesson',
                  kind: 'content_open',
                  method: 'GET',
                  href: '/api/v1/portals/parent/learning/content/content-parent-bundle/open',
                  launch_token_ref: null,
                  expires_at: null,
                },
              },
            ],
            activity: {
              attended_occurrence_count: 0,
              started_content_count: 0,
              completed_content_count: 0,
              submitted_question_count: 0,
            },
          },
          csrf_token: `c1.${'d'.repeat(43)}.${'e'.repeat(43)}`,
        },
      }),
    }),
  );
  await page.route('**/api/v1/classroom/production-basic/launch', async (route) => {
    classLaunchCalls += 1;
    expect(route.request().method()).toBe('POST');
    expect(route.request().postData()).toBeNull();
    expect(route.request().headers()['x-csrf-token']).toBe(
      `c1.${'d'.repeat(43)}.${'e'.repeat(43)}`,
    );
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          launch_artifact: {
            mode: 'production_basic',
            role: 0,
            sdk_web_version: '3.11.2',
            meeting_number: '12345678901',
            meeting_password: 'meeting-password',
            signature: 'header.payload.signature',
            user_name: 'Bundle Parent',
            leave_path: '/app/parent',
            issued_at: '2026-08-16T15:55:00.000Z',
            expires_at: '2026-08-16T16:35:00.000Z',
            raw_join_url_present: false,
            video_start_model: 'PARTICIPANT_CONSENT',
          },
        },
      }),
    });
  });
  await page.route('**/api/v1/portals/parent/learning/attendance', async (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().headers()['x-csrf-token']).toBe(
      `c1.${'d'.repeat(43)}.${'e'.repeat(43)}`,
    );
    expect(route.request().headers()['x-idempotency-key']).toMatch(/^parent-learning-/u);
    attendanceEvents.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          receipt: {
            disposition: 'committed',
            operation: 'attendance_recorded',
            entity_id: `attendance-${attendanceEvents.length}`,
          },
        },
      }),
    });
  });
  await page.route(
    '**/api/v1/portals/parent/learning/content/content-parent-bundle/open',
    async (route) => {
      contentOpenCalls += 1;
      expect(route.request().method()).toBe('GET');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            action: {
              action_key: 'content-open-ready-parent-bundle',
              label: 'Open lesson',
              kind: 'content_open',
              method: 'GET',
              href: '/app/learning/items/content-parent-bundle',
              launch_token_ref: null,
              expires_at: null,
            },
          },
        }),
      });
    },
  );
  await page.route('**/app/learning/items/content-parent-bundle', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>Entitled lesson</title><h1>Entitled lesson</h1>',
    }),
  );
  await page.route('**/app/parent/students/new', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>Add Student</title><h1>Add Student</h1>',
    }),
  );
  await page.route('**/api/app/parent/welcome-video/events', async (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().headers()['x-csrf-token']).toBe(
      `c1.${'d'.repeat(43)}.${'e'.repeat(43)}`,
    );
    expect(route.request().headers()['x-idempotency-key']).toMatch(/^parent-learning-/u);
    welcomeEvents.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { receipts: [] } }),
    });
  });
  await page.route('**/api/app/parent/summary', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          snapshot: {
            featured_welcome_video: {
              contract_version: '1.0.0',
              status: 'unavailable',
              reason: 'no_approved_version',
              title: 'Welcome to One Time',
              message: 'Your welcome video will appear here when it is ready.',
            },
          },
        },
      }),
    }),
  );
  await page.route('**/api/v2.1/auth/logout', async (route) => {
    logoutCalls += 1;
    expect(route.request().headers()['x-csrf-token']).toBe(
      `c1.${'d'.repeat(43)}.${'e'.repeat(43)}`,
    );
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, session_model: 'v21' }),
    });
  });
  await page.route('**/login', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>Signed out</title><h1>Signed out</h1>',
    }),
  );

  await page.goto('/app/parent');
  await expect(page.getByRole('heading', { name: /Bundle Parent/ })).toBeVisible();
  await expect(page.getByText('Parent learner + 0 of 3 child learners')).toBeVisible();
  await expect(page.getByRole('link', { name: 'See One Time now' })).toHaveAttribute(
    'href',
    '/app/parent/classroom',
  );
  await expect(page.getByRole('link', { name: 'Add Student' })).toHaveAttribute(
    'href',
    '/app/parent/students/new',
  );
  await expect(
    page.getByText('Your welcome video will appear here when it is ready.'),
  ).toBeVisible();
  expect(welcomeAssetRequests).toEqual([]);
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole('link', { name: 'See One Time now' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Add Student' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(1);
  }

  await page.getByRole('link', { name: 'Add Student' }).click();
  await expect(page.getByRole('heading', { name: 'Add Student' })).toBeVisible();
  await expect
    .poll(() => welcomeEvents)
    .toEqual([
      {
        event_type: 'parent.add_student_clicked',
        video_version_id: null,
      },
    ]);
  await page.goto('/app/parent');

  const documentsBeforeClassroom = parentDocumentPaths.length;
  await page.getByRole('link', { name: 'Classroom', exact: true }).click();
  await expect.poll(() => parentDocumentPaths.length).toBe(documentsBeforeClassroom + 1);
  expect(parentDocumentPaths.at(-1)).toBe('/app/parent/classroom');
  expect(classroomShellCsp).toContain("script-src 'self' https://source.zoom.us");
  await expect(page.getByRole('heading', { name: 'Next class' })).toBeVisible();
  await expect(page.getByText('Today\u2019s Mishnayos')).toBeVisible();
  await page.getByRole('button', { name: 'Join class' }).evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(page.getByText('Classroom connected.')).toBeVisible();
  expect(zoomSdkRequests).toContain('/3.11.2/zoom-meeting-3.11.2.min.js');
  expect(classLaunchCalls).toBe(1);
  await expect.poll(() => attendanceEvents).toHaveLength(1);
  expect(attendanceEvents[0]).toMatchObject({
    occurrence_id: 'occurrence_parent_bundle',
    event_kind: 'joined',
    connection_lineage_id: expect.stringMatching(/^parent-classroom-/u),
  });
  expect(
    await page.evaluate(() => ({
      ...(
        window as typeof window & {
          __parentSdkJoin?: Record<string, string>;
        }
      ).__parentSdkJoin,
      leaveUrl: (
        window as typeof window & {
          __parentLeaveUrl?: string;
        }
      ).__parentLeaveUrl,
    })),
  ).toEqual({
    meetingNumber: '12345678901',
    passWord: 'meeting-password',
    signature: 'header.payload.signature',
    userName: 'Bundle Parent',
    leaveUrl: '/app/parent',
  });
  expect(page.url()).not.toMatch(/meeting-password|header\.payload\.signature/u);
  expect(
    await page.evaluate(
      () =>
        `${JSON.stringify(Object.entries(localStorage))}${JSON.stringify(Object.entries(sessionStorage))}`,
    ),
  ).not.toMatch(/meeting-password|header\.payload\.signature/u);
  await page.evaluate(() => {
    (
      window as typeof window & {
        __parentMeetingStatus?: (event: { meetingStatus: number }) => void;
      }
    ).__parentMeetingStatus?.({ meetingStatus: 3 });
  });
  await expect.poll(() => attendanceEvents).toHaveLength(2);
  expect(attendanceEvents[1]).toEqual({
    occurrence_id: 'occurrence_parent_bundle',
    event_kind: 'left',
    connection_lineage_id: attendanceEvents[0]?.connection_lineage_id,
  });
  expect(JSON.stringify(attendanceEvents)).not.toMatch(/student_id|learner_key/u);

  const documentsBeforeLeavingClassroom = parentDocumentPaths.length;
  await page.getByRole('link', { name: 'Today', exact: true }).click();
  await expect.poll(() => parentDocumentPaths.length).toBe(documentsBeforeLeavingClassroom + 1);
  expect(parentDocumentPaths.at(-1)).toBe('/app/parent');
  await expect(page.getByRole('heading', { name: /Bundle Parent/ })).toBeVisible();

  await page.goto('/app/parent/library');
  await expect(page.getByRole('heading', { name: 'Lessons' })).toBeVisible();
  await expect(page.getByText('Berachos 1:1 review')).toBeVisible();
  await expect(page.getByText('1m 30s of 5m')).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue lesson' }).click();
  await expect(page.getByRole('heading', { name: 'Entitled lesson' })).toBeVisible();
  expect(contentOpenCalls).toBe(1);

  await page.goto('/app/parent');
  const callsBeforeReload = bootstrapCalls;
  await page.reload();
  await expect(page.getByRole('heading', { name: /Bundle Parent/ })).toBeVisible();
  expect(bootstrapCalls).toBeGreaterThan(callsBeforeReload);
  expect(legacyRequests).toEqual([]);
  expect(welcomeAssetRequests).toEqual([]);

  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page.getByRole('heading', { name: 'Signed out' })).toBeVisible();
  expect(logoutCalls).toBe(1);
  expect(legacyRequests).toEqual([]);
});

test('School uses the exact P09 manual-inquiry route and payload with no nurture fields', async ({
  page,
}) => {
  await useServerDate(page, '2026-08-01T12:00:00.000Z');
  let familyBootstrapCalls = 0;
  await page.route('**/api/v1/signup/family/bootstrap', (route) => {
    familyBootstrapCalls += 1;
    return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });
  let observedPayload: Record<string, unknown> | null = null;
  await page.route('**/api/v2.1/signup/school-inquiry', async (route) => {
    observedPayload = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: {
          heading: 'Thank you — we received your School inquiry.',
          body: 'Manual follow-up only.',
        },
      }),
    });
  });
  await page.goto('/school');
  await expect(page.getByRole('heading', { name: 'Send a School inquiry' })).toBeVisible();
  await expect(page.getByLabel(/WhatsApp/i)).toHaveCount(0);
  await expect(page.locator('[data-school-fields] input')).toHaveCount(6);
  await page.getByLabel('School name').fill('Example School');
  await page.getByLabel('Contact first name').fill('School');
  await page.getByLabel('Contact last name').fill('Contact');
  await page.getByLabel('School contact email').fill('school@example.test');
  await page.getByLabel('Phone (optional)').fill('+972501234567');
  await page.getByLabel('Note (optional)').fill('Please contact the adult administrator.');
  await page.getByRole('button', { name: 'Send school inquiry' }).click();
  await expect(
    page.getByRole('heading', { name: 'Thank you — we received your School inquiry.' }),
  ).toBeVisible();
  expect(observedPayload).toEqual({
    school_name: 'Example School',
    contact_first_name: 'School',
    contact_last_name: 'Contact',
    email: 'school@example.test',
    phone: '+972501234567',
    note: 'Please contact the adult administrator.',
  });
  expect(familyBootstrapCalls).toBe(0);
});

test('campaign remains useful without JavaScript and honors reduced motion and mobile reflow', async ({
  browser,
  page,
}) => {
  for (const viewport of [
    { width: 320, height: 720 },
    { width: 375, height: 812 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
    { width: 768, height: 1024 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Help your son love learning Mishnayos.' }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);
    const heroCta = page.locator('.hero-cta');
    const heroCtaBox = await heroCta.boundingBox();
    expect(heroCtaBox?.height).toBeGreaterThanOrEqual(48);
    if (viewport.width <= 520) {
      await expect(page.locator('.hero-photo')).toBeHidden();
      await expect(page.locator('.hero')).toHaveCSS(
        'background-image',
        /linear-gradient\(rgba\(5, 5, 5, 0\.62\), rgba\(5, 5, 5, 0\.9\)\), url\(.*hero-classroom-background\.webp.*\)/u,
      );
      await expect(page.locator('.hero h1')).toHaveCSS('color', 'rgb(248, 250, 247)');
      const heroContentWidth = await page.locator('.hero-inner').evaluate((element) => {
        const style = getComputedStyle(element);
        return (
          element.getBoundingClientRect().width -
          Number.parseFloat(style.paddingLeft) -
          Number.parseFloat(style.paddingRight)
        );
      });
      expect(heroCtaBox?.width).toBeGreaterThanOrEqual(heroContentWidth - 1);
      const headerCta = page.locator('.site-header .button-primary');
      const headerCtaBox = await headerCta.boundingBox();
      expect(headerCtaBox?.height).toBeGreaterThanOrEqual(48);
      await expect(headerCta).toHaveCSS('font-size', '16px');
      expect(
        await heroCta.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const hit = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          );
          return hit === element || element.contains(hit);
        }),
      ).toBe(true);
    }
    await expect(heroCta).toHaveCSS('font-size', /^(?:1[4-9]|[2-9][0-9])(?:\.\d+)?px$/u);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.campaign-ticker-track')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('[data-gallery-toggle]')).toBeDisabled();

  const context = await browser.newContext({ baseURL: testBaseUrl, javaScriptEnabled: false });
  const noJsPage = await context.newPage();
  await noJsPage.goto('/');
  await expect(
    noJsPage.getByRole('heading', { name: 'Help your son love learning Mishnayos.' }),
  ).toBeVisible();
  await expect(noJsPage.getByText(/CLASSES START AUG 16/)).toHaveCount(6);
  await expect(noJsPage.getByText(/September 13, 2026/)).toHaveCount(0);
  await noJsPage.goto('/signup');
  await expect(noJsPage.locator('noscript > .noscript-panel')).toContainText(
    'JavaScript is required for secure signup submission.',
  );
  await expect(noJsPage.getByRole('button', { name: 'Create your Family account' })).toBeHidden();
  await context.close();
});

test('landing and Family signup pass automated accessibility checks at all required viewports', async ({
  page,
}) => {
  await page.route('**/api/v1/signup/family/bootstrap', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(bootstrap),
    }),
  );
  for (const viewport of [
    { width: 320, height: 720 },
    { width: 375, height: 812 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
    { width: 768, height: 1024 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(viewport);
    for (const route of ['/', '/signup']) {
      await page.goto(route);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, `${route} at ${viewport.width}x${viewport.height}`).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        ),
        `${route} at ${viewport.width}x${viewport.height} must not overflow horizontally`,
      ).toBe(false);
      if (route === '/signup') {
        for (const link of await page.locator('.site-footer nav a').all()) {
          expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
        }
      }
    }
  }
});

test('hero CTA emits the bounded analytics event before canonical Family signup', async ({
  page,
}) => {
  const events: unknown[] = [];
  await page.exposeFunction('recordOtAnalyticsEvent', (detail: unknown) => events.push(detail));
  await page.addInitScript(() => {
    window.addEventListener('ot:analytics', (event) => {
      void (
        window as typeof window & {
          recordOtAnalyticsEvent: (detail: unknown) => Promise<void>;
        }
      ).recordOtAnalyticsEvent((event as CustomEvent<unknown>).detail);
    });
  });
  await page.goto('/');
  await page.locator('.hero .hero-cta').click();
  await expect(page).toHaveURL(`${testBaseUrl}/signup`);
  await expect
    .poll(() => events)
    .toEqual([
      {
        event_name: 'landing.signup.cta.clicked',
        destination: '/signup',
        placement: 'hero',
      },
    ]);
});

async function useServerDate(page: Page, value: string) {
  await page.route('**/*', (route) => {
    if (route.request().method() === 'HEAD') {
      return route.fulfill({ status: 200, headers: { date: new Date(value).toUTCString() } });
    }
    return route.continue();
  });
}

async function proxyCanonicalJoinToLocal(
  page: Page,
  serverDate: string,
  observeDocumentCsp?: (csp: string) => void,
) {
  await page.route('https://join.onetimeonetime.com/**', async (route) => {
    if (route.request().method() === 'HEAD') {
      await route.fulfill({
        status: 200,
        headers: { date: new Date(serverDate).toUTCString() },
      });
      return;
    }
    const canonical = new URL(route.request().url());
    const local = new URL(`${canonical.pathname}${canonical.search}`, testBaseUrl);
    const response = await route.fetch({ url: local.toString() });
    if (route.request().resourceType() === 'document') {
      observeDocumentCsp?.(response.headers()['content-security-policy'] ?? '');
    }
    await route.fulfill({ response });
  });
}

async function assertGalleryControls(page: Page) {
  const galleryDots = page.locator('[data-gallery-dot]');
  const secondGalleryDot = galleryDots.nth(1);
  const secondGallerySlide = page.locator('[data-gallery-slide]').nth(1);
  const secondGalleryCaption = (await secondGallerySlide.locator('figcaption').innerText()).trim();
  await expect(secondGalleryDot).toHaveAttribute('aria-pressed', 'false');
  await page.locator('[data-gallery-slide]').first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(secondGalleryDot).toHaveAttribute('aria-pressed', 'true');
  await expect(secondGallerySlide).toHaveAttribute('data-active', 'true');
  await expect(secondGallerySlide).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('[data-gallery-status]')).toHaveText(`Showing ${secondGalleryCaption}`);

  await secondGallerySlide.focus();
  await page.keyboard.press('Home');
  const galleryViewport = page.locator('[data-gallery-viewport]');
  await galleryViewport.dispatchEvent('pointerdown', { clientX: 260 });
  await galleryViewport.dispatchEvent('pointerup', { clientX: 160 });
  await galleryViewport.dispatchEvent('click');
  await expect(secondGallerySlide).toHaveAttribute('data-active', 'true');
  await expect(page.locator('[data-gallery-slide]').nth(2)).not.toHaveAttribute(
    'data-active',
    'true',
  );

  const hiddenControls = page.locator('.gallery-controls');
  await expect(hiddenControls).toHaveAttribute('inert', '');
  await expect(hiddenControls).toHaveAttribute('aria-hidden', 'true');
  const hiddenControlsBox = await hiddenControls.boundingBox();
  expect(hiddenControlsBox?.width).toBeLessThanOrEqual(1);
  expect(hiddenControlsBox?.height).toBeLessThanOrEqual(1);

  const pressCarousel = page.locator('[data-press-carousel]');
  const pressSlides = pressCarousel.locator('span');
  await pressCarousel.focus();
  await page.keyboard.press('Home');
  await expect(pressSlides.nth(0)).toHaveAttribute('data-active', '');
  await pressCarousel.dispatchEvent('pointerdown', { clientX: 260 });
  await pressCarousel.dispatchEvent('pointerup', { clientX: 160 });
  await pressCarousel.dispatchEvent('click');
  await expect(pressSlides.nth(1)).toHaveAttribute('data-active', '');
  await expect(pressSlides.nth(2)).not.toHaveAttribute('data-active', '');
}

async function completeFamilySignupForm(page: Page, email: string) {
  await page.getByLabel('First name', { exact: true }).fill('Playwright');
  await page.getByLabel('Last name', { exact: true }).fill('Parent');
  await page.getByLabel('Adult account email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('StrongPassword!234');
  await page.getByLabel('Confirm password').fill('StrongPassword!234');
  await page.getByLabel(/I agree to the Terms/).check();
  await page.getByRole('button', { name: 'Create your Family account' }).click();
}
