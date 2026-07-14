import { expect, test } from '@playwright/test';

test('landing works on required mobile viewports with visible header and hero CTAs', async ({
  page,
}) => {
  for (const size of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await page.goto('/');
    await expect(
      page.getByLabel('Primary').getByRole('link', { name: 'Member Login' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign Up Now' }).first()).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Give your son a love for learning Torah.' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign Up Now' }).nth(1)).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'What You Receive' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Live Daily Mishnayos' })).toBeVisible();
  await expect(page.getByText('Secure student portal')).toBeVisible();
  await expect(page.getByText('Toronto.jpg pending')).toBeVisible();
  await expect(page.getByRole('heading', { name: "Who It's For" })).toBeVisible();
  expect(requests.some((url) => url.includes('operations') || url.includes('bna'))).toBe(false);
  const html = await page.content();
  expect(html).not.toContain('Monitored platform');
  expect(html).not.toContain('View as Rabbi');
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
