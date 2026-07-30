import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const testBaseUrl =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? '3100'}`;

const bootstrap = {
  success: true,
  idempotency_key: 'a'.repeat(43),
  csrf_token: `1789315200.${'b'.repeat(43)}.${'c'.repeat(43)}`,
  expires_at: '2026-09-13T16:40:00.000Z',
  writes_allowed: true,
};

test('public landing implements the complete accepted campaign contract', async ({ page }) => {
  await useServerDate(page, '2026-08-01T12:00:00.000Z');
  await page.setViewportSize({ width: 1440, height: 1000 });
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'MISHNAYOS MADE MEMORABLE' })).toBeVisible();
  await expect(page.locator('.hero-eyebrow')).toHaveText('LIVE ONLINE + ON-DEMAND');
  await expect(page.locator('.hero-supporting')).toHaveText(
    'Join Rabbi Eli Scheller live from anywhere, then review every class anytime.',
  );
  await expect(page.locator('.hero .schedule')).toContainText(
    'Sunday–Thursday at 7:00 PM Jerusalem time',
  );
  await expect(page.locator('[data-local-class-time]')).toContainText('your next class:');
  const heroCta = page.locator('.hero .hero-cta');
  await expect(heroCta).toHaveText('JOIN FREE');
  await expect(heroCta).toHaveAttribute('href', '/signup');
  await expect(heroCta).toHaveCSS('background-color', 'rgb(255, 212, 0)');
  await expect(page.locator('.hero h1')).toHaveCSS('font-family', /Inter/);
  await expect(page.locator('.hero h1')).toHaveCSS('font-weight', '900');
  await expect(page.locator('.hero h1 span').last()).toHaveCSS('color', 'rgb(255, 212, 0)');
  await expect(page.locator('.hero-note')).toHaveText(
    'No credit card • Up to three learners per family',
  );

  await expect(
    page.getByRole('heading', { name: 'One protected place for live class and review' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Live class', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'On-demand library', exact: true })).toBeVisible();
  await expect(page.getByText('Student email is not required.', { exact: false })).toHaveCount(2);
  await expect(page.getByText(/adult may learn as a Student/i)).toBeVisible();
  await expect(page.getByText(/current desktop or mobile browser/i)).toBeVisible();
  await expect(page.getByText(/camera is optional/i)).toBeVisible();
  await expect(page.getByText(/class recordings may be made available/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Choose the right entry' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create a Family account' })).toHaveAttribute(
    'href',
    '/signup?entry=family',
  );
  await expect(page.getByRole('link', { name: 'Send a School inquiry' })).toHaveAttribute(
    'href',
    '/signup?entry=school',
  );
  await expect(page.getByRole('heading', { name: 'Free access, then $67/month' })).toBeVisible();
  await expect(page.locator('[data-before-expiry]')).toContainText(
    'Free access ends September 13, 2026 at 7:24 p.m. Jerusalem time.',
  );
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
  await expect(page.getByText('WhatsApp is not an active launch support channel.')).toBeVisible();
  await expect(page.getByText(/fake|testimonial/i)).toHaveCount(0);
  expect(requests.some((url) => /(?:operations|bna)/i.test(url))).toBe(false);

  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://join.onetimeonetime.com/assets/social/mishnayos-made-memorable.png',
  );
  await expect(page.locator('img')).toHaveCount(21);
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

test('server-synchronized free-period boundary changes countdown, landing, and signup copy', async ({
  page,
}) => {
  await useServerDate(page, '2026-09-13T16:23:00.000Z');
  await page.goto('/');
  await expect(page.locator('.campaign-ticker')).toContainText('FREE ACCESS');
  await expect(page.locator('.campaign-ticker')).toContainText('remaining');
  await expect(page.locator('#access [data-before-expiry]')).toBeVisible();
  await expect(page.locator('#access [data-at-or-after-expiry]')).toBeHidden();

  await page.unrouteAll({ behavior: 'wait' });
  await useServerDate(page, '2026-09-13T16:24:01.000Z');
  await page.reload();
  await expect(page.locator('.campaign-ticker')).toBeHidden();
  await expect(page.locator('#access [data-before-expiry]')).toBeHidden();
  await expect(page.locator('#access [data-at-or-after-expiry]')).toBeVisible();
  await expect(page.locator('#access [data-at-or-after-expiry]')).toContainText('$67/month');

  await page.goto('/signup');
  await expect(page.locator('[data-family-fields] [data-before-expiry]')).toBeHidden();
  await expect(page.locator('[data-family-fields] [data-at-or-after-expiry]')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Create account and continue to checkout' }),
  ).toBeVisible();
});

test('Family submission uses the P08 bootstrap, exact CSRF binding, and no Student or card fields', async ({
  page,
}) => {
  await useServerDate(page, '2026-08-01T12:00:00.000Z');
  let observedPayload: Record<string, unknown> | null = null;
  let observedCsrf = '';
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
        local_commit_state: 'committed',
        local_access_state: 'free',
        next_action: 'session_integration_pending',
        session_established: false,
        provider_effects_completed_inline: 0,
        message:
          'Your family account and free access were saved. Automatic sign-in is not available yet.',
      }),
    });
  });

  await page.goto('/signup?entry=family');
  await expect(page.getByText('Student email is not required.')).toBeVisible();
  await expect(page.getByLabel(/student.*email/i)).toHaveCount(0);
  await page.getByLabel('First name', { exact: true }).fill('Playwright');
  await page.getByLabel('Last name', { exact: true }).fill('Parent');
  await page.getByLabel('Adult account email').fill('family@example.test');
  await page.getByLabel('Password', { exact: true }).fill('StrongPassword!234');
  await page.getByLabel('Confirm password').fill('StrongPassword!234');
  await page.getByLabel(/I agree to the Terms/).check();
  await page.getByLabel(/I acknowledge the Privacy Notice/).check();
  await expect(page.getByLabel('General marketing')).not.toBeChecked();
  await expect(page.getByLabel('Parent newsletter')).not.toBeChecked();
  await page.getByRole('button', { name: 'Create my free family account' }).click();

  await expect(page.getByRole('heading', { name: 'Your Family account was saved.' })).toBeVisible();
  await expect(page.getByText(/Automatic sign-in is not available yet/)).toBeVisible();
  expect(observedCsrf).toBe(bootstrap.csrf_token);
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

test('School uses the exact P09 manual-inquiry route and payload with no nurture fields', async ({
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
  await page.goto('/signup?entry=school');
  await expect(page.getByRole('heading', { name: 'Send a School inquiry' })).toBeVisible();
  await expect(page.getByLabel(/WhatsApp/i)).toHaveCount(0);
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
    await expect(page.getByRole('heading', { name: 'MISHNAYOS MADE MEMORABLE' })).toBeVisible();
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
  await expect(noJsPage.getByRole('heading', { name: 'MISHNAYOS MADE MEMORABLE' })).toBeVisible();
  await expect(noJsPage.getByText(/Free access ends September 13, 2026/)).toBeVisible();
  await noJsPage.goto('/signup');
  await expect(noJsPage.locator('noscript > .noscript-panel')).toContainText(
    'JavaScript is required for secure signup submission.',
  );
  await expect(
    noJsPage.getByRole('button', { name: 'Create my free family account' }),
  ).toBeHidden();
  await context.close();
});

test('landing and signup pass automated accessibility checks at all required viewports', async ({
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
  await page.getByRole('link', { name: 'JOIN FREE' }).click();
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
