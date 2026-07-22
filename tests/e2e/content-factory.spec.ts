import { expect, test } from '@playwright/test';
import { loginAs, useW12AdminSession } from './w12-100/launch-readiness-helpers.ts';

test.describe.configure({ mode: 'serial' });

test('Admin content factory browser smoke', async ({ page }) => {
  await useW12AdminSession(page);
  await page.goto('/app/content/factory');
  await expect(page.getByRole('heading', { name: 'Content Workspace' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Content Factory' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('button', { name: 'Add class video' })).toBeVisible();
  await expect(
    page.getByText('[Demo] Hashavas Aveidah: Signs and Announcements').first(),
  ).toBeVisible();
  await expect(page.getByText('Local drop ready')).toBeVisible();
  await expect(page.getByText('Published').first()).toBeVisible();
  await expect(page.getByLabel('Video processing status')).toContainText('Transcribing');
  await expect(page.getByRole('link', { name: 'Preview approved playback' })).toBeVisible();

  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/https?:\/\/player\.vimeo\.com|synthetic_demo_no_provider_resource/i);
});

test('Student approved playback browser smoke', async ({ page }) => {
  await page.route('https://player.vimeo.com/**', async (route) => {
    await route.abort('blockedbyclient');
  });
  await loginAs(page, 'student', '/app/student');
  const contentCard = page
    .getByRole('article')
    .filter({ hasText: '[Demo] Hashavas Aveidah: Signs and Announcements' });
  await expect(contentCard).toBeVisible();
  await expect(contentCard.getByText(/approved synthetic review lesson/i)).toBeVisible();
  await expect(contentCard.getByText(/approved synthetic lesson data/i)).toBeVisible();
  await contentCard.getByText('Approved review questions').click();
  await expect(contentCard.getByRole('listitem').first()).toBeVisible();
  const embedRequest = page.waitForRequest(
    '**/api/v1/content/factory/ot_launch_01_demo_hashavas_aveidah/embed',
  );
  await contentCard.getByRole('button', { name: 'Open' }).click();
  await embedRequest;

  await expect(page).toHaveURL(/\/app\/learning\/items\/ot_launch_01_demo_hashavas_aveidah$/);
  await expect(
    page.getByRole('heading', { name: '[Demo] Hashavas Aveidah: Signs and Announcements' }),
  ).toBeVisible();
  await expect(page.getByText('Active')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Review questions' })).toBeVisible();
  await expect(page.locator('iframe')).toHaveAttribute(
    'src',
    '/api/v1/content/factory/ot_launch_01_demo_hashavas_aveidah/embed',
  );
  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/https?:\/\/player\.vimeo\.com|synthetic_demo_no_provider_resource/i);
});
