import { expect, test, type Page } from '@playwright/test';
import {
  assertNoHorizontalOverflow,
  useW12AdminSession,
} from './w12-100/launch-readiness-helpers.ts';

test.describe.configure({ mode: 'serial' });

let publishedPlaybackPath = '';

test('Admin uploads, processes, reviews, and publishes one occurrence-scoped video', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await useW12AdminSession(page);
  await page.goto('/app/content/factory');
  await expect(page.getByRole('heading', { name: 'Content Factory' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Content area' })).toHaveValue('factory');
  await expect(
    page.getByRole('heading', { name: 'Approved occurrence-scoped synthetic Mishnah review' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add class video' }).click();
  const intakePanel = page.locator('.content-factory-intake-panel');
  await intakePanel.getByRole('combobox').selectOption('e2e_class_occurrence');
  await intakePanel.getByLabel('Video file').setInputFiles({
    name: 'browser-uploaded-occurrence.mp4',
    mimeType: 'video/mp4',
    buffer: syntheticMp4(),
  });
  await intakePanel.getByRole('button', { name: 'Add to private storage' }).click();
  await expect(page.getByText('browser-uploaded-occurrence.mp4').first()).toBeVisible();

  await page.waitForTimeout(900);
  await page.reload();
  const uploadedItem = page.locator('.content-factory-item', {
    hasText: 'browser-uploaded-occurrence.mp4',
  });
  await expect(uploadedItem).toBeVisible();
  await uploadedItem.click();
  await expect(page.getByRole('button', { name: 'Approve transcript and drafts' })).toBeVisible();
  await page.getByLabel('Title').fill('Browser-published occurrence lesson');
  await page
    .getByLabel('Short description')
    .fill('Approved provider-off acceptance content for the selected class occurrence.');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(
    page.getByRole('heading', { name: 'Browser-published occurrence lesson' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Approve transcript and drafts' }).click();
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  const preview = page.getByRole('link', { name: 'Preview approved playback' });
  await expect(preview).toBeVisible();
  publishedPlaybackPath = (await preview.getAttribute('href')) ?? '';
  expect(publishedPlaybackPath).toMatch(/^\/app\/learning\/items\//);
  await assertNoHorizontalOverflow(page);
  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/https?:\/\/player\.vimeo\.com|synthetic_video_|volume:v1:/i);
});

test('provider-off synthetic content stays out of the ordinary Student library', async ({
  page,
}) => {
  expect(publishedPlaybackPath).toBeTruthy();
  await loginWithCredentials(
    page,
    'content-factory-student@example.test',
    'ContentFactoryStudent!234',
    '/app/student',
  );
  await page.getByRole('link', { name: 'Library', exact: true }).click();
  await expect(page).toHaveURL('/app/student?section=library');
  const contentCard = page
    .getByRole('region', { name: 'Library', exact: true })
    .getByRole('article')
    .filter({ hasText: 'Browser-published occurrence lesson' });
  await expect(contentCard).toHaveCount(0);
  const response = await page.goto(publishedPlaybackPath);
  expect(response?.status()).toBe(404);
  await expect(page.getByText('Approved lesson playback is unavailable.')).toBeVisible();
  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(
    /Browser-published occurrence lesson|https?:\/\/player\.vimeo\.com|synthetic_video_|volume:v1:/i,
  );
});

test('a non-entitled learner receives a metadata-safe denial', async ({ page }) => {
  expect(publishedPlaybackPath).toBeTruthy();
  await loginWithCredentials(
    page,
    'ot-zoom-student@example.test',
    'ZoomStudentPassword!234',
    '/app/student',
  );
  const response = await page.goto(publishedPlaybackPath);
  expect(response?.status()).toBe(404);
  await expect(page.getByText('Approved lesson playback is unavailable.')).toBeVisible();
  expect(await page.locator('body').innerText()).not.toContain(
    'Browser-published occurrence lesson',
  );
});

test('Admin unpublish immediately revokes the entitled Student route', async ({ page }) => {
  await useW12AdminSession(page);
  await page.goto('/app/content/factory');
  const item = page.locator('.content-factory-item', {
    hasText: 'Browser-published occurrence lesson',
  });
  await expect(item).toBeVisible();
  await item.click();
  await page.getByRole('button', { name: 'Unpublish' }).click();
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeVisible();

  await page.context().clearCookies();
  await loginWithCredentials(
    page,
    'content-factory-student@example.test',
    'ContentFactoryStudent!234',
    '/app/student',
  );
  await expect(
    page
      .getByRole('region', { name: 'Library', exact: true })
      .getByRole('article')
      .filter({ hasText: 'Browser-published occurrence lesson' }),
  ).toHaveCount(0);
  const response = await page.goto(publishedPlaybackPath);
  expect(response?.status()).toBe(404);
  expect(await page.locator('body').innerText()).not.toContain(
    'Browser-published occurrence lesson',
  );
});

async function loginWithCredentials(page: Page, email: string, password: string, returnTo: string) {
  await page.goto(`/login?return_to=${encodeURIComponent(returnTo)}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL(`**${returnTo}`);
}

function syntheticMp4() {
  const bytes = Buffer.alloc(4_096, 0);
  bytes.writeUInt32BE(24, 0);
  bytes.write('ftyp', 4, 'ascii');
  bytes.write('isom', 8, 'ascii');
  bytes.write('browser-e2e', 32, 'ascii');
  return bytes;
}
