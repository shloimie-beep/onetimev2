import { expect, type Locator, type Page, test } from '@playwright/test';

const testBaseUrl = `http://127.0.0.1:${process.env.PORT ?? '3100'}`;

async function expectLocatorInsideViewport(
  locator: Locator,
  viewport: { width: number; height: number },
) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
}

test('landing works on required mobile viewports with visible header and hero CTAs', async ({
  page,
}) => {
  for (const size of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await page.goto('/', { waitUntil: 'load' });
    await page.evaluate(() => window.scrollTo(0, 0));
    const ticker = page.locator('.campaign-ticker');
    const brandLogo = page.locator('.brand-lockup img');
    const brandTitle = page.locator('.brand-lockup strong');
    const brandSubtitle = page.locator('.brand-lockup small');
    const headerSignup = page.getByLabel('Primary').getByRole('link', { name: 'Sign Up Now' });
    const hamburger = page.getByRole('button', { name: 'Open navigation' });
    const heroSignup = page.locator('.hero .hero-cta');
    await expect(ticker).toBeVisible();
    await expect(ticker).toHaveAttribute(
      'aria-label',
      /FREE UNTIL ROSH HASHANAH — \d+ DAYS? TO ROSH HASHANAH/,
    );
    await expect(brandLogo).toBeVisible();
    await expect(brandTitle).toBeVisible();
    await expect(brandSubtitle).toBeVisible();
    await expect(headerSignup).toBeVisible();
    await expect(hamburger).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'Worldwide Mishnah Learning / Live from Eretz Yisrael',
      }),
    ).toBeVisible();
    await expect(page.getByText('Give your son a love for learning Torah.')).toBeVisible();
    await expect(heroSignup).toBeVisible();
    await expectLocatorInsideViewport(brandLogo, size);
    await expectLocatorInsideViewport(brandTitle, size);
    await expectLocatorInsideViewport(brandSubtitle, size);
    await expectLocatorInsideViewport(headerSignup, size);
    await expectLocatorInsideViewport(hamburger, size);
    await expectLocatorInsideViewport(heroSignup, size);
    await hamburger.click();
    await expect(
      page.locator('.drawer').getByRole('link', { name: 'Member Login' }),
    ).toHaveAttribute('href', '/login');
    await page.locator('.drawer').getByRole('button', { name: 'Close navigation' }).click();
    const logoStyles = await brandLogo.evaluate((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return {
        borderTopWidth: style.borderTopWidth,
        width: box.width,
        height: box.height,
      };
    });
    expect(logoStyles.borderTopWidth).toBe('0px');
    expect(logoStyles.width).toBeGreaterThanOrEqual(44);
    expect(logoStyles.height).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  }
});

test('landing preserves exact receive structure and asset assignments', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/');
  const ticker = page.locator('.campaign-ticker');
  await expect(ticker).toBeVisible();
  await expect(ticker).toHaveAttribute('data-campaign-deadline', '2026-09-11');
  await expect(ticker.locator('.campaign-ticker-item')).toHaveCount(6);
  await expect(ticker).toHaveCSS('position', 'static');
  await expect(page.locator('.yellow-text')).toHaveCount(0);
  await expect(page.locator('a.button-primary[href="/signup"]')).toHaveCount(3);
  await expect(
    page.getByText(/ROSH HASHANAH SPECIAL|\$67|month afterward|No card today|trial/i),
  ).toHaveCount(0);
  await expect(page.locator('.hero').getByText(/FREE UNTIL ROSH HASHANAH/i)).toHaveCount(0);
  const sections = await page
    .locator('main > section')
    .evaluateAll((elements) =>
      elements.map((element) => element.id || Array.from(element.classList).join('.')),
    );
  expect(sections).toEqual([
    'hero',
    'receive',
    'gain',
    'who',
    'how-it-works',
    'world',
    'rabbi',
    'final-cta',
  ]);
  await expect(
    page.getByRole('heading', {
      name: 'Worldwide Mishnah Learning / Live from Eretz Yisrael',
    }),
  ).toBeVisible();
  await expect(page.locator('.hero h1 span')).toHaveText([
    'WORLDWIDE MISHNAH LEARNING',
    'LIVE FROM ERETZ YISRAEL',
  ]);
  await expect(page.locator('.hero-supporting')).toHaveText(
    'Give your son a love for learning Torah.',
  );
  await expect(page.locator('.hero .schedule')).toHaveCount(0);
  await expect(page.getByText('Live every day at 7:00 p.m. Israel time.')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Everything He Needs to Learn, Review, and Remember' }),
  ).toBeVisible();
  await expect(page.getByText('A COMPLETE DIGITAL TORAH-LEARNING EXPERIENCE')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Live Daily Mishnayos—plus the tools to make it stick.' }),
  ).toBeVisible();
  await expect(page.locator('.feature-panel li strong')).toHaveText([
    'LIVE EVERY DAY',
    'REVIEW ANYTIME',
    'REMEMBER THE LEARNING',
    'STAY ON TRACK',
    'STUDENT PORTAL',
    'PARENT PORTAL',
  ]);
  await expect(page.getByText(/not operator-certified final copy/i)).toHaveCount(0);
  await expect(page.getByText('Toronto.jpg pending')).toHaveCount(0);
  await expect(
    page.locator(
      'article[data-benefit="Progress"] img[src="/assets/outcomes/accomplishment-toronto-class.jpg"]',
    ),
  ).toBeVisible();
  await expect(
    page.locator('img[src="/assets/outcomes/accomplishment-toronto-class.jpg"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('article[data-benefit="Clarity"] img[src="/assets/outcomes/clarity-class.webp"]'),
  ).toBeVisible();
  await expect(
    page.locator(
      'article[data-benefit="Retention"] img[src="/assets/outcomes/retention-review-class-720.webp"]',
    ),
  ).toBeVisible();
  await expect(page.locator('article[data-benefit="Retention"] img')).toHaveAttribute(
    'srcset',
    /retention-review-class-480\.webp 480w/,
  );
  await expect(page.locator('img[src="/assets/students/smiley-kid.png"]')).toHaveCount(1);
  await expect(
    page
      .locator(
        'article[data-benefit="Clarity"], article[data-benefit="Retention"], article[data-benefit="A Love of Learning"]',
      )
      .locator('img[src="/assets/outcomes/accomplishment-toronto-class.jpg"]'),
  ).toHaveCount(0);
  await expect(page.locator('article[data-benefit="Retention"] img')).toHaveCount(1);
  const outcomeMedia = await page.locator('.benefit-visual').evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { width: box.width, height: box.height };
    }),
  );
  expect(new Set(outcomeMedia.map(({ width }) => Math.round(width))).size).toBe(1);
  expect(new Set(outcomeMedia.map(({ height }) => Math.round(height))).size).toBe(1);
  await expect(page.locator('article[data-benefit="Retention"] img')).toHaveCSS(
    'object-fit',
    'cover',
  );
  await expect(page.locator('article[data-benefit="Retention"] img')).toHaveCSS(
    'object-position',
    '50% 45%',
  );
  await expect(page.locator('.benefit-card h3')).toHaveText([
    'Clarity',
    'Retention',
    'Progress',
    'A Love of Learning',
  ]);
  await expect(
    page.getByText(
      'Real understanding. Stronger memory. Steady progress. A genuine love for learning.',
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Sign up, get the class information, and join the daily 7:00 p.m. live Mishnayos class.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'A Ready-to-Run Mishnayos Class—Wherever Your Son Learns',
    }),
  ).toBeVisible();
  await expect(page.locator('.who li strong')).toHaveText([
    'FAMILIES',
    'HOMESCHOOLERS',
    'SCHOOLS',
    'LOCAL STUDENTS',
  ]);
  await expect(page.getByText(/teacher replacement|absent-rebbe|substitute/i)).toHaveCount(0);
  await expect(page.locator('.gallery')).toBeVisible();
  await expect(page.locator('.gallery h2')).toHaveText('Seen Across the Jewish World');
  await expect(page.locator('.gallery-slide[data-active="true"]').locator('figcaption')).toHaveText(
    'Atlanta, Georgia',
  );
  await expect(page.locator('.gallery-slide figcaption')).toHaveText([
    'Atlanta, Georgia',
    'Baltimore, Maryland',
    'Flatbush, New York',
    'Hollywood, Florida',
    'Lakewood, New Jersey',
    'Miami, Florida',
    'Philadelphia, Pennsylvania',
    'Silver Spring, Maryland',
  ]);
  await expect(page.getByText('Rabbi Scheller teaching a large student group.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Pause slideshow' })).toBeVisible();
  await page.getByRole('button', { name: 'Next teaching photo' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.gallery-slide').nth(1)).toHaveAttribute('data-active', 'true');
  await expect(page.locator('.gallery-slide[data-active="true"]').locator('figcaption')).toHaveText(
    'Baltimore, Maryland',
  );
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.gallery-slide[data-active="true"]').locator('figcaption')).toHaveText(
    'Flatbush, New York',
  );
  const galleryGeometry = await page.locator('.gallery').evaluate((element) => {
    const active = element.querySelector<HTMLElement>('.gallery-slide[data-active="true"]');
    const viewport = element.querySelector<HTMLElement>('.gallery-viewport');
    const activeBox = active?.getBoundingClientRect();
    const viewportBox = viewport?.getBoundingClientRect();
    return {
      overflowX: viewport ? getComputedStyle(viewport).overflowX : '',
      activeLeft: activeBox?.left ?? 0,
      activeRight: activeBox?.right ?? 0,
      viewportLeft: viewportBox?.left ?? 0,
      viewportRight: viewportBox?.right ?? 0,
    };
  });
  expect(galleryGeometry.overflowX).toBe('hidden');
  expect(galleryGeometry.activeLeft).toBeGreaterThanOrEqual(galleryGeometry.viewportLeft - 1);
  expect(galleryGeometry.activeRight).toBeLessThanOrEqual(galleryGeometry.viewportRight + 1);
  await expect(page.getByText('Torah media and publication mentions')).toHaveCount(0);
  await expect(page.locator('.press-strip span')).toHaveCount(5);
  const publicationCards = await page.locator('.press-strip span').evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return {
        width: Math.round(box.width),
        background: style.backgroundColor,
      };
    }),
  );
  expect(new Set(publicationCards.map(({ width }) => width)).size).toBe(1);
  expect(publicationCards.every(({ background }) => background === 'rgb(255, 255, 255)')).toBe(
    true,
  );
  const rabbiImage = page.locator('.rabbi-bio img');
  await rabbiImage.scrollIntoViewIfNeeded();
  await expect(rabbiImage).toHaveCSS('object-fit', 'contain');
  const rabbiGeometry = await rabbiImage.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return box.width / box.height;
  });
  expect(rabbiGeometry).toBeGreaterThan(0.98);
  expect(rabbiGeometry).toBeLessThan(1.02);
  await expect(page.getByRole('button', { name: 'WhatsApp help' })).toHaveCount(0);
  await expect(page.getByText('Offline readiness')).toHaveCount(0);
  await expect(page.getByText('The WhatsApp assistant is being connected.')).toHaveCount(0);
  expect(requests.some((url) => url.includes('operations') || url.includes('bna'))).toBe(false);
  const html = await page.content();
  expect(html).not.toContain('Monitored platform');
  expect(html).not.toContain('View as Rabbi');
  expect(html).not.toContain('$67');
  expect(html).not.toContain('coverage');
});

test('landing and signup use the approved footer contract', async ({ page }) => {
  const expectedLinks = ['Home', 'Sign Up Now', 'Privacy', 'Terms', 'Member Login'];
  for (const path of ['/', '/signup']) {
    await page.goto(path);
    const footer = page.locator('.site-footer');
    await expect(footer.locator('img[src="/assets/brand/onetimelogo.webp"]')).toBeVisible();
    await expect(footer.getByText('One Time Mishnayos with Rabbi Eli Scheller.')).toBeVisible();
    await expect(footer.getByRole('link')).toHaveText(expectedLinks);
    await expect(footer.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    await expect(footer.getByRole('link', { name: 'Sign Up Now' })).toHaveAttribute(
      'href',
      '/signup',
    );
    await expect(footer.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
    await expect(footer.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
    await expect(footer.getByRole('link', { name: 'Member Login' })).toHaveAttribute(
      'href',
      '/login',
    );
  }
});

test('Toronto accomplishment image keeps its crop across required viewports', async ({ page }) => {
  for (const size of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(size);
    await page.goto('/');
    const card = page.locator('article[data-benefit="Progress"]');
    const image = card.locator('img');
    await card.scrollIntoViewIfNeeded();
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute('src', '/assets/outcomes/accomplishment-toronto-class.jpg');
    await expect(image).toHaveJSProperty('complete', true);
    const metrics = await image.evaluate((element) => {
      const img = element as HTMLImageElement;
      const box = img.getBoundingClientRect();
      return {
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        ratio: box.width / box.height,
        objectPosition: getComputedStyle(img).objectPosition,
      };
    });
    expect(metrics.naturalWidth).toBeGreaterThanOrEqual(1000);
    expect(metrics.naturalHeight).toBeGreaterThanOrEqual(700);
    expect(metrics.ratio).toBeGreaterThan(1.3);
    expect(metrics.ratio).toBeLessThan(1.36);
    expect(metrics.objectPosition).toBe('50% 48%');
  }
});

test('landing ticker has a readable reduced-motion state', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const firstTickerItem = page.locator('.campaign-ticker-item').first();
  await expect(firstTickerItem).toBeVisible();
  await expect(firstTickerItem).toContainText('FREE UNTIL ROSH HASHANAH');
  await expect(page.locator('.campaign-ticker-track')).toHaveCSS('animation-name', 'none');
  await expect(page.getByRole('button', { name: 'Slideshow paused' })).toBeDisabled();
  expect(
    await page
      .locator('.benefit-card[data-scroll-reveal]')
      .evaluateAll((elements) =>
        elements.every((element) => element.getAttribute('data-scroll-reveal') !== 'pending'),
      ),
  ).toBe(true);
});

test('landing countdown rolls over in Jerusalem and expires in flow', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-09T20:59:00Z') });
  await page.goto('/');
  const ticker = page.locator('.campaign-ticker');
  await expect(ticker).toHaveAttribute(
    'aria-label',
    /FREE UNTIL ROSH HASHANAH — 2 DAYS TO ROSH HASHANAH/,
  );
  await page.clock.runFor('02:00');
  await expect(ticker).toHaveAttribute(
    'aria-label',
    /FREE UNTIL ROSH HASHANAH — 1 DAY TO ROSH HASHANAH/,
  );
  await page.clock.fastForward('24:00:00');
  await expect(ticker).toBeHidden();
});

test('landing gallery autoplays, pauses explicitly, and avoids screen-reader chatter', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-07-23T10:00:00Z') });
  await page.goto('/');
  const activeSlide = page.locator('.gallery-slide[data-active="true"]');
  await expect(activeSlide.locator('figcaption')).toHaveText('Atlanta, Georgia');
  await page.clock.runFor(6_100);
  await expect(activeSlide.locator('figcaption')).toHaveText('Baltimore, Maryland');
  await expect(page.locator('[data-gallery-status]')).toHaveText('Showing Atlanta, Georgia');

  const pause = page.getByRole('button', { name: 'Pause slideshow' });
  await pause.click();
  await expect(page.getByRole('button', { name: 'Play slideshow' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.clock.runFor(6_100);
  await expect(activeSlide.locator('figcaption')).toHaveText('Baltimore, Maryland');
});

test('landing content remains visible when JavaScript is unavailable', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: testBaseUrl, javaScriptEnabled: false });
  const noJsPage = await context.newPage();
  try {
    await noJsPage.goto('/');
    await expect(
      noJsPage.getByRole('heading', {
        name: 'Worldwide Mishnah Learning / Live from Eretz Yisrael',
      }),
    ).toBeVisible();
    await expect(noJsPage.locator('.benefit-card')).toHaveCount(4);
    await expect(noJsPage.locator('.benefit-card').first()).toBeVisible();
    await expect(noJsPage.getByText('Offline readiness')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('landing gallery shows a graceful fallback when an image fails', async ({ page }) => {
  await page.goto('/');
  const activeSlide = page.locator('.gallery-slide[data-active="true"]');
  await activeSlide.scrollIntoViewIfNeeded();
  await activeSlide.locator('img').evaluate((image) => {
    image.dispatchEvent(new Event('error'));
  });
  await expect(activeSlide).toHaveAttribute('data-image-error', 'true');
  await expect(activeSlide.locator('.image-fallback')).toBeVisible();
  await expect(activeSlide.locator('figcaption')).toHaveText('Atlanta, Georgia');
});

test('family and school signup submit through canonical lead endpoint', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('Parent or contact name').fill('Playwright Parent');
  await page.getByLabel('Family or School').fill('Playwright Family');
  await page.getByLabel('Location').fill('Jerusalem');
  await page.getByRole('textbox', { name: 'Email' }).fill(`family-${Date.now()}@example.test`);
  await expect(page.getByLabel('Email class reminders')).not.toBeChecked();
  await expect(page.getByLabel('WhatsApp class reminders')).not.toBeChecked();
  await page.getByLabel('Email class reminders').check();
  await page.getByRole('button', { name: 'Sign Up Now' }).click();
  await expect(
    page.getByRole('heading', { name: 'Thank you - we received your Family signup.' }),
  ).toBeVisible();

  await page.goto('/signup');
  await page.getByLabel('Parent or contact name').fill('Playwright School');
  await page.getByLabel('Family or School').fill('Playwright School');
  await page.getByRole('radio', { name: 'School' }).check();
  await page.getByLabel('Location').fill('London');
  await page.getByRole('textbox', { name: 'Email' }).fill(`school-${Date.now()}@example.test`);
  await expect(page.getByLabel('Email class reminders')).not.toBeChecked();
  await expect(page.getByLabel('WhatsApp class reminders')).not.toBeChecked();
  await page.getByRole('button', { name: 'Sign Up Now' }).click();
  await expect(
    page.getByRole('heading', { name: 'Thank you - we received your school inquiry.' }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'A member of the One Time One Time team will review it and follow up personally. This inquiry does not create class access, reminders, a portal account, or Family messages.',
    ),
  ).toBeVisible();
});

test('public pages do not load the future React CRM bundle', async ({ page }) => {
  const scripts: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/assets/')) scripts.push(request.url());
  });
  await page.goto('/');
  await page.goto('/signup');
  expect(scripts.some((url) => url.includes('app-crm'))).toBe(false);
});

test('signup consent is channel-specific and not inferred from a default choice', async ({
  page,
}) => {
  const submittedPayloads: Array<Record<string, unknown>> = [];
  await page.route('**/api/v1/leads', async (route) => {
    submittedPayloads.push(
      JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>,
    );
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        duplicate_submission: false,
        classification: 'family',
        contact_key: 'contact_public_consent',
        signup_key: 'signup_public_consent',
        confirmation_queued: true,
        outbox_intents: [],
        message: {
          heading: 'Thank you - we received your Family signup.',
          body: 'Test success.',
        },
      }),
    });
  });

  await page.goto('/signup');
  await expect(page.getByRole('group', { name: 'Required service communications' })).toContainText(
    'Optional daily reminders are separate',
  );
  await expect(page.getByRole('group', { name: 'Optional class reminders' })).toContainText(
    'No optional reminders are selected by default.',
  );
  await expect(page.getByLabel('Email class reminders')).not.toBeChecked();
  await expect(page.getByLabel('WhatsApp class reminders')).not.toBeChecked();
  await fillSignup(page, 'No Optional', 'none');
  await page.getByRole('button', { name: 'Sign Up Now' }).click();
  await expect(
    page.getByRole('heading', { name: 'Thank you - we received your Family signup.' }),
  ).toBeVisible();
  expect(submittedPayloads.at(-1)).toMatchObject({
    reminder_preference: 'none',
    reminder_consent: false,
  });

  await page.goto('/signup');
  await page.getByLabel('Email class reminders').focus();
  await page.keyboard.press('Space');
  await expect(page.getByLabel('Email class reminders')).toBeChecked();
  await fillSignup(page, 'Email Optional', 'email');
  await page.getByRole('button', { name: 'Sign Up Now' }).click();
  await expect(
    page.getByRole('heading', { name: 'Thank you - we received your Family signup.' }),
  ).toBeVisible();
  expect(submittedPayloads.at(-1)).toMatchObject({
    reminder_preference: 'email',
    reminder_consent: true,
  });
});

test('signup validates WhatsApp phone consent and avoids student-sensitive fields', async ({
  page,
}) => {
  const submittedPayloads: Array<Record<string, unknown>> = [];
  await page.route('**/api/v1/leads', async (route) => {
    submittedPayloads.push(
      JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>,
    );
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        duplicate_submission: false,
        classification: 'family',
        contact_key: 'contact_public_whatsapp',
        signup_key: 'signup_public_whatsapp',
        confirmation_queued: true,
        outbox_intents: [],
        message: {
          heading: 'Thank you - we received your Family signup.',
          body: 'Test success.',
        },
      }),
    });
  });

  await page.goto('/signup');
  await expect(page.getByText('Do not include student names')).toBeVisible();
  await expect(page.getByLabel(/student.*name/i)).toHaveCount(0);
  await expect(page.getByLabel(/student.*age/i)).toHaveCount(0);
  await page.getByLabel('WhatsApp class reminders').check();
  await expect(page.getByLabel('Phone / WhatsApp')).toHaveJSProperty('required', true);
  await expect(page.getByLabel('Phone / WhatsApp')).toHaveAttribute('aria-required', 'true');
  await fillSignup(page, 'WhatsApp Missing Phone', 'missing-phone');
  await page.getByRole('button', { name: 'Sign Up Now' }).click();
  expect(submittedPayloads).toHaveLength(0);

  await page.getByLabel('Phone / WhatsApp').fill('+972501112222');
  await page.getByRole('button', { name: 'Sign Up Now' }).click();
  await expect(
    page.getByRole('heading', { name: 'Thank you - we received your Family signup.' }),
  ).toBeVisible();
  expect(submittedPayloads.at(-1)).toMatchObject({
    phone: '+972501112222',
    reminder_preference: 'whatsapp',
    reminder_consent: true,
  });
});

test('signup consent layout stays usable on required mobile viewports', async ({ page }) => {
  for (const size of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await page.goto('/signup');
    await expect(page.getByRole('group', { name: 'Optional class reminders' })).toBeVisible();
    await expect(
      page.getByRole('group', { name: 'Required service communications' }),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  }
});

test('signup has an explicit no-JavaScript fallback', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: testBaseUrl, javaScriptEnabled: false });
  const noJsPage = await context.newPage();
  try {
    await noJsPage.goto('/signup');
    await expect(
      noJsPage.getByText('JavaScript is required for secure signup submission.'),
    ).toBeVisible();
    await expect(noJsPage.getByRole('button', { name: 'Sign Up Now' })).toBeHidden();
    await expect(noJsPage.getByText('Do not send student-sensitive information')).toBeVisible();
  } finally {
    await context.close();
  }
});

async function fillSignup(page: Page, name: string, suffix: string) {
  await page.getByLabel('Parent or contact name').fill(`Playwright ${name}`);
  await page.getByLabel('Family or School').fill(`Playwright ${name} Family`);
  await page.getByLabel('Location').fill('Jerusalem');
  await page
    .getByRole('textbox', { name: 'Email' })
    .fill(`public-${suffix}-${Date.now()}@example.test`);
}
