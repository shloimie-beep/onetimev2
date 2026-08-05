import { expect, test } from '@playwright/test';
import { VIMEO_CATALOG_E2E_STUDENT_COOKIES } from '../support/vimeo-mishnayos-catalog-session.ts';

test('synthetic Student browses, searches, and obtains protected playback for an adopted fixture', async ({
  page,
}) => {
  const observedRequests: string[] = [];
  let lastSearch = '';
  page.on('request', (request) => observedRequests.push(request.url()));
  await page.route('**/api/app/student/library/search', async (route) => {
    const request = route.request();
    const body = request.postDataJSON() as { query?: string };
    lastSearch = body.query ?? '';
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          items: [
            {
              contentId: 'vimeo_catalog_content_fixture',
              title: 'Mishnayos Bava Kamma — Perek 4',
              classTopic: 'Nezikin · Bava Kamma',
              mishnahReferences: ['Bava Kamma 4'],
              occurredAt: '2026-08-03T00:00:00.000Z',
              durationMs: 120_000,
              resumePositionMs: 0,
              internalRoute: '/app/student/library/vimeo_catalog_content_fixture',
            },
          ],
        },
      }),
    });
  });
  await page.route('**/api/app/student/library/vimeo_catalog_content_fixture/bootstrap', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          content_id: 'vimeo_catalog_content_fixture',
          bootstrap_path: '/api/v1/student/library/vimeo_catalog_content_fixture/playback',
          issued_at: '2099-08-03T00:00:00.000Z',
          expires_at: '2099-08-03T00:05:00.000Z',
          renewable: true,
        },
      }),
    }),
  );
  await page.route('**/api/v1/student/library/vimeo_catalog_content_fixture/playback', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          authorized: true,
          content_id: 'vimeo_catalog_content_fixture',
          playback_session_id: 'synthetic_playback_session',
          expires_at: '2099-08-03T00:05:00.000Z',
        },
      }),
    }),
  );

  await page.context().addCookies([...VIMEO_CATALOG_E2E_STUDENT_COOKIES]);
  await page.goto('/app/student/library');

  const library = page.getByRole('region', { name: 'Library' });
  await library.getByLabel('Search lessons').fill('Bava Kamma');
  await library.getByRole('button', { name: 'Search' }).click();
  await expect.poll(() => lastSearch).toBe('Bava Kamma');
  await expect(library.getByText('Mishnayos Bava Kamma — Perek 4')).toBeVisible();
  await library.getByRole('button', { name: 'Open protected lesson' }).click();
  await expect(library.getByText(/Protected playback authorized until/i)).toBeVisible();

  expect(observedRequests.some((url) => /(?:player\.)?vimeo\.com/i.test(url))).toBe(false);
  expect(await page.locator('body').innerText()).not.toMatch(/https?:\/\/|provider[_ -]?asset/i);
});
