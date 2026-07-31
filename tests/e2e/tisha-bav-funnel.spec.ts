import { expect, test } from '@playwright/test';

const canonicalHeaders = { host: 'join.onetimeonetime.com' };
const browserRoutes = [
  '/tisha-bav',
  '/tisha-bav.html',
  '/tisha-bav/live',
  '/tisha-bav/success',
] as const;
const archivedAssets = [
  'hero-desktop.png',
  'hero-mobile.png',
  'tisha%20beav(1).png',
  'tisha-bav-apple-touch-icon-v20260722.png',
  'tisha-bav-favicon-v20260722.png',
  'tisha-bav-social-card-v20260722.png',
  'tisha-bav-success-bg-desktop-v20260722b.png',
  'tisha-bav-success-bg-mobile-v20260722.png',
  'tishea%20beav%20mobile(1).png',
] as const;

test.describe('retired Tisha BAv public surface', () => {
  test('all historical browser routes render the seed-free ended-event response', async ({
    page,
    request,
  }) => {
    for (const routePath of browserRoutes) {
      const response = await request.get(routePath, {
        headers: canonicalHeaders,
        maxRedirects: 0,
      });
      expect(response.status(), routePath).toBe(410);
      expect(response.headers()['cache-control'], routePath).toBe('no-store');
      expect(response.headers()['referrer-policy'], routePath).toBe('no-referrer');
      expect(response.headers()['x-content-type-options'], routePath).toBe('nosniff');

      const html = await response.text();
      expect(html, routePath).toContain('This event has ended');
      expect(html, routePath).toContain('no longer accepting registrations');
      expect(html, routePath).not.toContain('Reserve My Spot');
      expect(html, routePath).not.toContain('data-event-registration-form');
      expect(html, routePath).not.toContain('data-event-join-form');

      await page.setContent(html);
      await expect(page.getByRole('heading', { name: 'This event has ended' })).toBeVisible();
      await expect(page.locator('form')).toHaveCount(0);
      await expect(page.getByRole('button')).toHaveCount(0);
      await expect(page.locator('[data-event-registration-form]')).toHaveCount(0);
      await expect(page.locator('[data-event-join-form]')).toHaveCount(0);
    }

    const head = await request.head('/tisha-bav', { headers: canonicalHeaders });
    expect(head.status()).toBe(410);
    expect(await head.text()).toBe('');
  });

  test('registration, join, and provider redirect surfaces cannot activate', async ({
    request,
  }) => {
    for (const probe of [
      {
        path: '/api/v1/events/tisha-bav-2026/register',
        data: {
          email: 'operator-retirement-proof@example.test',
          first_name: 'Operator',
          source: 'retirement_proof',
          idempotency_key: 'retirement-proof-register',
          homepage: '',
        },
      },
      {
        path: '/api/v1/events/tisha-bav-2026/join',
        data: {
          email: 'operator-retirement-proof@example.test',
          idempotency_key: 'retirement-proof-join',
          homepage: '',
        },
      },
    ] as const) {
      const response = await request.post(probe.path, {
        headers: canonicalHeaders,
        data: probe.data,
        maxRedirects: 0,
      });
      expect(response.status(), probe.path).toBe(410);
      expect(response.headers()['set-cookie'], probe.path).toBeUndefined();
      expect(response.headers().location, probe.path).toBeUndefined();
      expect(await response.json(), probe.path).toEqual({
        code: 'EVENT_ENDED',
        message: 'This event has ended and no registration was recorded.',
      });
    }

    const redirect = await request.get('/api/v1/events/tisha-bav-2026/redirect', {
      headers: canonicalHeaders,
      maxRedirects: 0,
    });
    expect(redirect.status()).toBe(410);
    expect(redirect.headers()['set-cookie']).toBeUndefined();
    expect(redirect.headers().location).toBeUndefined();
    expect(await redirect.text()).toContain('This event has ended');
  });

  test('archived event assets are never served from the public static tree', async ({
    request,
  }) => {
    for (const asset of archivedAssets) {
      const response = await request.get(`/assets/events/tisha-bav-2026/${asset}`, {
        headers: canonicalHeaders,
        maxRedirects: 0,
      });
      expect(response.status(), asset).toBe(404);
      expect(response.headers()['cache-control'], asset).toContain('no-store');
      expect(response.headers()['content-type'], asset).toContain('text/plain');
      expect(await response.text(), asset).toBe('Not found.');
    }
  });
});
