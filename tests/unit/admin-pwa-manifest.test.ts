import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderPageShell } from '../../packages/brand-system/src/static.ts';

type ManifestIcon = {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
};

type AdminManifest = {
  id: string;
  name: string;
  start_url: string;
  scope: string;
  display: string;
  prefer_related_applications: boolean;
  icons: ManifestIcon[];
  shortcuts: Array<{ name: string; url: string }>;
};

const publicRoot = path.resolve(process.cwd(), 'apps/web/public');

function pngDimensions(bytes: Buffer) {
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
  expect(bytes.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function pageShell(app: boolean) {
  return renderPageShell({
    title: 'One Time',
    description: 'One Time',
    body: '<main>One Time</main>',
    canonical: 'https://app.onetimeonetime.com/app/classroom/classes',
    ogTitle: 'One Time',
    ogDescription: 'One Time',
    app,
  });
}

describe('One Time Admin phone installation', () => {
  it('links install metadata only from protected application shells', () => {
    const protectedApp = pageShell(true);
    const publicPage = pageShell(false);

    expect(protectedApp).toContain('<link rel="manifest" href="/admin.webmanifest">');
    expect(protectedApp).toContain('content="One Time Admin"');
    expect(protectedApp).toContain('rel="apple-touch-icon" sizes="180x180"');
    expect(publicPage).not.toContain('/admin.webmanifest');
    expect(publicPage).not.toContain('apple-mobile-web-app-capable');
  });

  it('opens the protected Admin Classroom and exposes only protected shortcuts', async () => {
    const manifest = JSON.parse(
      await readFile(path.join(publicRoot, 'admin.webmanifest'), 'utf8'),
    ) as AdminManifest;

    expect(manifest).toMatchObject({
      id: '/app/classroom/classes',
      name: 'One Time Admin',
      start_url: '/app/classroom/classes?source=homescreen',
      scope: '/',
      display: 'standalone',
      prefer_related_applications: false,
    });
    expect(manifest.shortcuts.map(({ url }) => url)).toEqual([
      '/app/live?section=zoom&source=homescreen',
      '/app/dashboard?source=homescreen',
      '/app/content?source=homescreen',
    ]);
    expect([manifest.start_url, ...manifest.shortcuts.map(({ url }) => url)]).toSatisfy(
      (urls: string[]) => urls.every((url) => url.startsWith('/app/')),
    );
  });

  it.each([
    ['one-time-admin-192.png', 192],
    ['one-time-admin-512.png', 512],
    ['one-time-admin-180.png', 180],
  ])('ships a real %s icon with the declared dimensions', async (fileName, size) => {
    const bytes = await readFile(path.join(publicRoot, 'assets', 'pwa', fileName));
    expect(pngDimensions(bytes)).toEqual({ width: size, height: size });
  });
});
