import { expect, test } from '@playwright/test';
import { loginAs, useW12AdminSession } from './w12-100/launch-readiness-helpers.ts';

test.describe.configure({ mode: 'serial' });

test('Admin content factory browser smoke', async ({ page }) => {
  await useW12AdminSession(page);
  await page.goto('/app/content/factory');
  await expect(page.getByRole('heading', { name: 'Content Workspace' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Video factory' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByText('Browser Smoke Mishnah Class').first()).toBeVisible();
  await expect(page.getByText('LOCAL_DROP')).toBeVisible();
  await expect(page.getByText('Published').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Preview approved playback' })).toBeVisible();

  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/https?:\/\/player\.vimeo\.com|factory_browser_private_video/i);
});

test('Student approved playback browser smoke', async ({ page }) => {
  await page.route('https://player.vimeo.com/**', async (route) => {
    await route.abort('blockedbyclient');
  });
  await loginAs(page, 'student', '/app/student');
  const contentCard = page.getByRole('article').filter({ hasText: 'Browser Smoke Mishnah Class' });
  await expect(contentCard).toBeVisible();
  await expect(contentCard.getByText(/Approved browser-smoke summary/)).toBeVisible();
  await contentCard.getByText('Approved review questions').click();
  await expect(contentCard.getByRole('listitem').first()).toBeVisible();
  const embedRequest = page.waitForRequest(
    '**/api/v1/content/factory/factory_browser_sample_2026_07_22/embed',
  );
  await contentCard.getByRole('button', { name: 'Open' }).click();
  await embedRequest;

  await expect(page).toHaveURL(/\/app\/learning\/items\/factory_browser_sample_2026_07_22$/);
  await expect(page.getByRole('heading', { name: 'Browser Smoke Mishnah Class' })).toBeVisible();
  await expect(page.getByText('Active')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Review questions' })).toBeVisible();
  await expect(page.locator('iframe')).toHaveAttribute(
    'src',
    '/api/v1/content/factory/factory_browser_sample_2026_07_22/embed',
  );
  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/https?:\/\/player\.vimeo\.com|factory_browser_private_video/i);
});
