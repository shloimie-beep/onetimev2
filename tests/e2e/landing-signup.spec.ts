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
    await page.goto('/');
    const brandLogo = page.locator('.brand-lockup img');
    const memberLogin = page.getByLabel('Primary').getByRole('link', { name: 'Member Login' });
    const headerSignup = page.getByLabel('Primary').getByRole('link', { name: 'Sign Up Now' });
    const heroSignup = page.locator('.hero .hero-cta');
    await expect(brandLogo).toBeVisible();
    await expect(memberLogin).toBeVisible();
    await expect(headerSignup).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Give your son a love for learning Torah.' }),
    ).toBeVisible();
    await expect(heroSignup).toBeVisible();
    await expectLocatorInsideViewport(brandLogo, size);
    await expectLocatorInsideViewport(memberLogin, size);
    await expectLocatorInsideViewport(headerSignup, size);
    await expectLocatorInsideViewport(heroSignup, size);
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
  await expect(
    page.getByText('Worldwide Mishnah learning - live from Eretz Yisrael'),
  ).toBeVisible();
  await expect(page.getByText('Live every day at 7:00 p.m. Israel time.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What You Receive' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Live Daily Mishnayos' })).toBeVisible();
  await expect(page.getByText('Secure student portal')).toBeVisible();
  await expect(page.getByText('Toronto.jpg pending')).toHaveCount(0);
  await expect(
    page.locator(
      'article[data-benefit="Accomplishment"] img[src="/assets/outcomes/accomplishment-toronto-class.jpg"]',
    ),
  ).toBeVisible();
  await expect(
    page.locator('img[src="/assets/outcomes/accomplishment-toronto-class.jpg"]'),
  ).toHaveCount(1);
  await expect(
    page
      .locator(
        'article[data-benefit="Clarity"], article[data-benefit="Excitement for learning Torah"]',
      )
      .locator('img[src="/assets/outcomes/accomplishment-toronto-class.jpg"]'),
  ).toHaveCount(0);
  await expect(
    page.getByText(
      "One perek a day gives him a clear goal, steady progress, and a real sense of finishing each day's learning.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Sign up, get the class information, and join the daily 7:00 p.m. live Mishnayos class.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: "Who It's For" })).toBeVisible();
  expect(requests.some((url) => url.includes('operations') || url.includes('bna'))).toBe(false);
  const html = await page.content();
  expect(html).not.toContain('Monitored platform');
  expect(html).not.toContain('View as Rabbi');
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
    const card = page.locator('article[data-benefit="Accomplishment"]');
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
    expect(metrics.ratio).toBeGreaterThan(1.55);
    expect(metrics.ratio).toBeLessThan(1.65);
    expect(metrics.objectPosition).toBe('50% 48%');
  }
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
  await expect(page.getByRole('heading', { name: "You're signed up." })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: 'Thank you.' })).toBeVisible();
  await expect(page.getByText("We saved your information and we'll be in touch.")).toBeVisible();
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
