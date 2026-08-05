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
  await expect(page.locator('.hero-supporting, .hero .schedule, .hero-note')).toHaveCount(0);
  const heroCta = page.locator('.hero .hero-cta');
  await expect(heroCta).toHaveText('Create your Family account');
  await expect(heroCta).toHaveAttribute('href', '/signup');
  await expect(page.locator('.hero .hero-cta')).toHaveCount(1);
  await expect(heroCta).toHaveCSS('background-color', 'rgb(255, 212, 0)');
  await expect(page.locator('.hero h1')).toHaveCSS('font-family', /Inter/);
  await expect(page.locator('.hero h1')).toHaveCSS('font-weight', '900');
  await expect(page.locator('.hero-photo img')).toHaveAttribute(
    'src',
    '/assets/rabbi/rabbi-eli-holding-book.jpg',
  );
  await expect(page.locator('.hero-photo img')).toHaveAttribute('width', '1600');
  await expect(page.locator('.hero-photo img')).toHaveAttribute('height', '1067');
  await expect(page.locator('.hero [src*="composite"], .hero [style*="composite"]')).toHaveCount(0);

  await expect(
    page.locator('.experience, .participation, .enrollment, #access, .assurances'),
  ).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Experience', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Pricing', exact: true })).toHaveCount(0);
  await expect(page.getByText(/adult may learn as a Student/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'How It Works' })).toBeVisible();
  await expect(page.locator('#how-it-works .how-intro > img')).toHaveCount(0);
  const familyFlowImages = page.locator('#how-it-works .how-flow-grid img');
  await expect(familyFlowImages).toHaveCount(2);
  for (const image of [
    'parent-creates-student-login-1254.webp',
    'student-uses-mishnah-lesson-1254.webp',
  ]) {
    const flowImage = page.locator(`#how-it-works img[src$="${image}"]`);
    await expect(flowImage).toBeVisible();
    await expect(flowImage).toHaveAttribute('width', '1254');
    await expect(flowImage).toHaveAttribute('height', '1254');
    await expect(flowImage).toHaveAttribute('loading', 'lazy');
    await expect(flowImage).toHaveAttribute(
      'srcset',
      /480\.webp 480w.*800\.webp 800w.*1254\.webp 1254w/u,
    );
  }
  await expect(page.getByRole('heading', { name: 'Create your Family account' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Your child learns in his own space' }),
  ).toBeVisible();
  await expect(page.getByText(/Pre-register|pre-registration/i)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Terms, cancellation, and refunds' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Privacy Notice' }).last()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Student Data Notice' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Member Login' }).last()).toHaveAttribute(
    'href',
    '/login',
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
  await expect(page.getByRole('heading', { name: 'Create your Family account' })).toBeVisible();
  await expect(page.locator('[data-family-fields]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create your Family account' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Create your Family account' })).toBeVisible();
  await expect(page.locator('[data-school-fields]')).toHaveCount(0);
  await expect(page.getByLabel(/student.*email|phone|whatsapp|card/i)).toHaveCount(0);
  await page.getByLabel('First name', { exact: true }).fill('Playwright');
  await page.getByLabel('Last name', { exact: true }).fill('Parent');
  await page.getByLabel('Adult account email').fill('family@example.test');
  await page.getByLabel('Password', { exact: true }).fill('StrongPassword!234');
  await page.getByLabel('Confirm password').fill('StrongPassword!234');
  await page.getByLabel(/I agree to the Terms/).check();
  await page.getByLabel(/I acknowledge the Privacy Notice/).check();
  await expect(page.getByLabel('General marketing')).not.toBeChecked();
  await expect(page.getByLabel('Parent newsletter')).not.toBeChecked();
  await page.getByRole('button', { name: 'Create your Family account' }).click();

  await expect(page.getByRole('heading', { name: 'You’re all set.' })).toBeVisible();
  await expect(
    page.getByText(
      'Your Family account is ready. You can continue now while we finish sending your confirmation email.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Go to Parent dashboard' })).toHaveAttribute(
    'href',
    '/app/parent',
  );
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
    general_marketing_consent: false,
    parent_newsletter_consent: false,
  });
  const serialized = JSON.stringify(observedPayload);
  expect(serialized).not.toMatch(/student|phone|whatsapp|card|payment_method/i);
});

test('verified Family signup presents exact confirmation copy then opens the Parent workspace', async ({
  page,
}) => {
  await useServerDate(page, '2026-08-01T12:00:00.000Z');
  await page.route('**/api/v1/signup/family/bootstrap', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(bootstrap),
    }),
  );
  await page.route('**/api/v1/signup/family', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        code: 'FAMILY_SIGNUP_COMPLETE',
        session_established: true,
        continue_to: '/app/parent',
        provider_projection_state: 'ready',
        message: 'Your Family account is ready, and we sent your confirmation email.',
      }),
    }),
  );
  await page.route('**/app/parent/account', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>Parent dashboard</title><h1>Parent dashboard</h1>',
    }),
  );
  const route = '/signup?continue_to=%2Fapp%2Fparent%2Faccount';
  await page.goto(route);
  await completeFamilySignupForm(page, 'continued-family@example.test');
  await expect(page.getByRole('heading', { name: 'You’re all set.' })).toBeVisible();
  await expect(
    page.getByText('Your Family account is ready, and we sent your confirmation email.'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Go to Parent dashboard' })).toHaveAttribute(
    'href',
    '/app/parent/account',
  );
  await expect(page).toHaveURL(`${testBaseUrl}/app/parent/account`);
});

test('the real Parent bundle keeps a v2.1 session isolated from every legacy Parent API', async ({
  page,
}) => {
  const legacyRequests: string[] = [];
  let bootstrapCalls = 0;
  let logoutCalls = 0;
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (
      pathname === '/api/v1/auth/session' ||
      pathname.startsWith('/api/v1/portals/parent/') ||
      pathname.startsWith('/api/v1/contact-operations/')
    ) {
      legacyRequests.push(pathname);
    }
  });
  await page.route('**/app/parent', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: [
        '<!doctype html><html><head>',
        '<link rel="stylesheet" href="/assets/app-crm.css">',
        '</head><body><div id="portal-root"></div>',
        '<script type="module" src="/assets/app-portal.js"></script>',
        '</body></html>',
      ].join(''),
    }),
  );
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
  await page.route('**/api/app/parent/household', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          snapshot: {
            contract_version: '1.2.0',
            household_id: 'household_parent_bundle',
            display_name: 'Bundle Parent family',
            access_state: 'free',
            student_allowance: 3,
            active_student_count: 0,
            available_student_seats: 3,
            can_manage_students: true,
            revision: 1,
            students: [],
          },
          csrf_token: `c1.${'d'.repeat(43)}.${'e'.repeat(43)}`,
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
  await expect(page.getByRole('heading', { name: 'Bundle Parent family' })).toBeVisible();
  await expect(page.getByText('0 of 3 active Student seats used')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Bundle Parent family' })).toBeVisible();
  expect(bootstrapCalls).toBe(2);
  expect(legacyRequests).toEqual([]);

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
    { width: 360, height: 800 },
    { width: 390, height: 844 },
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
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.campaign-ticker-track')).toHaveCSS('animation-name', 'none');
  await expect(page.getByRole('button', { name: 'Slideshow paused' })).toBeDisabled();

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
    { width: 360, height: 800 },
    { width: 390, height: 844 },
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
      ).toBe(false);
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

async function assertGalleryControls(page: Page) {
  const galleryDots = page.locator('[data-gallery-dot]');
  const secondGalleryDot = galleryDots.nth(1);
  const secondGallerySlide = page.locator('[data-gallery-slide]').nth(1);
  const secondGalleryCaption = (await secondGallerySlide.locator('figcaption').innerText()).trim();
  await expect(secondGalleryDot).toHaveAttribute('aria-pressed', 'false');
  await secondGalleryDot.click();
  await expect(secondGalleryDot).toHaveAttribute('aria-pressed', 'true');
  await expect(secondGallerySlide).toHaveAttribute('data-active', 'true');
  await expect(secondGallerySlide).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('[data-gallery-status]')).toHaveText(`Showing ${secondGalleryCaption}`);

  const galleryToggle = page.locator('[data-gallery-toggle]');
  await expect(galleryToggle).toHaveText('Pause slideshow');
  await expect(galleryToggle).toHaveAttribute('aria-pressed', 'false');
  await galleryToggle.click();
  await expect(galleryToggle).toHaveText('Play slideshow');
  await expect(galleryToggle).toHaveAttribute('aria-pressed', 'true');
}

async function completeFamilySignupForm(page: Page, email: string) {
  await page.getByLabel('First name', { exact: true }).fill('Playwright');
  await page.getByLabel('Last name', { exact: true }).fill('Parent');
  await page.getByLabel('Adult account email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('StrongPassword!234');
  await page.getByLabel('Confirm password').fill('StrongPassword!234');
  await page.getByLabel(/I agree to the Terms/).check();
  await page.getByLabel(/I acknowledge the Privacy Notice/).check();
  await page.getByRole('button', { name: 'Create your Family account' }).click();
}
