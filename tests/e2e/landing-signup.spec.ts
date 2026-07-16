import { expect, type Locator, test } from '@playwright/test';

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
      /JOIN NOW — FREE UNTIL ROSH HASHANAH — \d+ DAYS? TO ROSH HASHANAH/,
    );
    await expect(brandLogo).toBeVisible();
    await expect(brandTitle).toBeVisible();
    await expect(brandSubtitle).toBeVisible();
    await expect(headerSignup).toBeVisible();
    await expect(hamburger).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Give your son a love for learning Torah.' }),
    ).toBeVisible();
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
  await expect(ticker).toHaveCSS('height', '32px');
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
    'how-it-works',
    'who',
    'rabbi',
    'final-cta',
  ]);
  await expect(page.locator('.hero .kicker span')).toHaveText([
    'WORLDWIDE MISHNAH LEARNING',
    'LIVE FROM ERETZ YISRAEL',
  ]);
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
  await expect(page.locator('article[data-benefit="Retention"] .retention-visual')).toBeVisible();
  await expect(page.locator('img[src="/assets/students/smiley-kid.png"]')).toHaveCount(1);
  await expect(
    page
      .locator(
        'article[data-benefit="Clarity"], article[data-benefit="Retention"], article[data-benefit="A Love of Learning"]',
      )
      .locator('img[src="/assets/outcomes/accomplishment-toronto-class.jpg"]'),
  ).toHaveCount(0);
  await expect(page.locator('article[data-benefit="Retention"] img')).toHaveCount(0);
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
  await expect(page.locator('.gallery h3')).toHaveText('Seen Across the Jewish World');
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
  await expect(firstTickerItem).toContainText('JOIN NOW — FREE UNTIL ROSH HASHANAH');
  await expect(page.locator('.campaign-ticker-track')).toHaveCSS('animation-name', 'none');
});

test('family and school signup submit through canonical lead endpoint', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('Parent or contact name').fill('Playwright Parent');
  await page.getByLabel('Family or School').fill('Playwright Family');
  await page.getByLabel('Location').fill('Jerusalem');
  await page.getByRole('textbox', { name: 'Email' }).fill(`family-${Date.now()}@example.test`);
  await page
    .getByLabel('Confirm that we may send the selected class information and reminders.')
    .check();
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
  await page
    .getByLabel('Confirm that we may send the selected class information and reminders.')
    .check();
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
