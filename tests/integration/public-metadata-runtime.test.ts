import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../packages/config/src/index.ts';
import { createMemoryPool } from '../../packages/db/src/index.ts';
import { createApp } from '../../apps/web/src/server/app.ts';

let server: ReturnType<ReturnType<typeof createApp>['listen']> | null = null;
let distDir: string | null = null;

afterEach(async () => {
  if (server) await closeServer(server);
  server = null;
  if (distDir) await rm(distDir, { recursive: true, force: true });
  distDir = null;
});

describe('runtime public metadata origin', () => {
  it('rewrites static canonical and Open Graph URLs from PUBLIC_BASE_URL at request time', async () => {
    distDir = await mkdtemp(path.join(tmpdir(), 'ot-runtime-metadata-'));
    await writeHtml(distDir, 'index.html');
    await writeHtml(distDir, 'signup.html');
    await writeHtml(distDir, '404.html');
    const config = loadConfig({
      NODE_ENV: 'test',
      PUBLIC_BASE_URL: 'https://ot99-web-staging.up.railway.app',
    });
    const pool = createMemoryPool();
    server = await listenForTest(createApp({ config, pool, distDir }));
    const baseUrl = serverBaseUrl(server);

    const root = await fetch(`${baseUrl}/`);
    const signup = await fetch(`${baseUrl}/signup`);

    await expect(root.text()).resolves.toContain(
      '<link rel="canonical" href="https://ot99-web-staging.up.railway.app/">',
    );
    await expect(signup.text()).resolves.toContain(
      '<meta property="og:url" content="https://ot99-web-staging.up.railway.app/signup">',
    );
  });

  it('forces fixed-name built client assets to revalidate in production', async () => {
    distDir = await mkdtemp(path.join(tmpdir(), 'ot-runtime-assets-'));
    await mkdir(path.join(distDir, 'assets'), { recursive: true });
    await writeFile(path.join(distDir, 'assets', 'app-PortalFeatures.js'), 'export const v = 2;');
    await writeFile(path.join(distDir, 'assets', 'app-crm.css'), '.app { display: block; }');
    await writeFile(path.join(distDir, 'assets', 'brand.webp'), 'stable-image');
    await writeHtml(distDir, '404.html');
    const config = loadConfig({
      NODE_ENV: 'production',
      PUBLIC_BASE_URL: 'https://ot99-web-staging.up.railway.app',
      AUTH_CSRF_SECRET: 'test-only-auth-csrf-secret-for-static-cache-proof',
      MFA_SECRET_ENCRYPTION_KEY: 'test-only-32-byte-mfa-key-static',
    });
    const pool = createMemoryPool();
    server = await listenForTest(createApp({ config, pool, distDir }));
    const baseUrl = serverBaseUrl(server);

    for (const assetPath of ['/assets/app-PortalFeatures.js', '/assets/app-crm.css'] as const) {
      const response = await fetch(`${baseUrl}${assetPath}`);
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-cache, max-age=0, must-revalidate');
      expect(response.headers.get('pragma')).toBe('no-cache');
      expect(response.headers.get('expires')).toBe('0');
    }

    const versionedImage = await fetch(`${baseUrl}/assets/brand.webp`);
    expect(versionedImage.status).toBe(200);
    expect(versionedImage.headers.get('cache-control')).toContain('max-age=3600');
  });
});

async function writeHtml(targetDir: string, fileName: string) {
  await writeFile(
    path.join(targetDir, fileName),
    [
      '<!doctype html>',
      '<html><head>',
      '<link rel="canonical" href="https://join.onetimeonetime.com/">',
      '<meta property="og:url" content="https://join.onetimeonetime.com/">',
      '</head><body>ok</body></html>',
    ].join(''),
    'utf8',
  );
}

async function listenForTest(app: ReturnType<typeof createApp>) {
  return new Promise<ReturnType<ReturnType<typeof createApp>['listen']>>((resolve, reject) => {
    const nextServer = app.listen(0, () => resolve(nextServer));
    nextServer.on('error', reject);
  });
}

async function closeServer(target: ReturnType<ReturnType<typeof createApp>['listen']>) {
  return new Promise<void>((resolve, reject) => {
    target.close((error?: Error) => (error ? reject(error) : resolve()));
  });
}

function serverBaseUrl(target: ReturnType<ReturnType<typeof createApp>['listen']>) {
  const address = target.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP test server');
  return `http://127.0.0.1:${address.port}`;
}
