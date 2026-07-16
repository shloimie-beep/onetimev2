import { mkdtemp, rm, writeFile } from 'node:fs/promises';
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
