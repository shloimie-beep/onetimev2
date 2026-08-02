import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import { createAccountUser } from '../../packages/domain/src/index.ts';
import { createApp } from '../../apps/web/src/server/app.ts';

let server: ReturnType<ReturnType<typeof createApp>['listen']> | null = null;
let distDir: string | null = null;
let pool: DbPool | null = null;

afterEach(async () => {
  if (server) await closeServer(server);
  server = null;
  if (pool) await pool.end();
  pool = null;
  if (distDir) await rm(distDir, { recursive: true, force: true });
  distDir = null;
});

describe('runtime public metadata origin', () => {
  it('rewrites static canonical and Open Graph URLs from PUBLIC_BASE_URL at request time', async () => {
    distDir = await mkdtemp(path.join(tmpdir(), 'ot-runtime-metadata-'));
    await writeHtml(distDir, 'index.html');
    await writeHtml(distDir, 'signup.html');
    await writeHtml(distDir, 'school.html');
    await writeHtml(distDir, '404.html');
    const config = loadConfig({
      NODE_ENV: 'test',
      PUBLIC_BASE_URL: 'https://ot99-web-staging.up.railway.app',
      ONE_TIME_FIRST_CLASS_AT: '2026-08-09T19:00:00+03:00',
      ONE_TIME_FREE_ACCESS_EXPIRES_AT: '2026-09-13T19:24:00+03:00',
    });
    pool = createMemoryPool();
    server = await listenForTest(createApp({ config, pool, distDir }));
    const baseUrl = serverBaseUrl(server);

    const root = await fetch(`${baseUrl}/`);
    const signup = await fetch(`${baseUrl}/signup`);
    const school = await fetch(`${baseUrl}/school`);

    const rootMarkup = await root.text();
    const signupMarkup = await signup.text();
    const schoolMarkup = await school.text();
    expect(rootMarkup).toContain(
      '<link rel="canonical" href="https://ot99-web-staging.up.railway.app/">',
    );
    expect(rootMarkup).toContain('data-first-class-at="2026-08-09T19:00:00+03:00"');
    expect(rootMarkup).toContain('data-access-boundary="2026-09-13T19:24:00+03:00"');
    expect(signupMarkup).toContain(
      '<meta property="og:url" content="https://ot99-web-staging.up.railway.app/signup">',
    );
    expect(signupMarkup).toContain('data-access-boundary="2026-09-13T19:24:00+03:00"');
    expect(schoolMarkup).toContain(
      '<link rel="canonical" href="https://ot99-web-staging.up.railway.app/school">',
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
      COMMIT_SHA: '0123456789abcdef0123456789abcdef01234567',
      AUTH_CSRF_SECRET: 'test-only-auth-csrf-secret-for-static-cache-proof',
      PROTECTED_PAYLOAD_ENCRYPTION_KEY: 'test-only-32-byte-payload-key-static',
    });
    pool = createMemoryPool();
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

  it('serves authenticated app HTML as no-store with commit-versioned entry assets', async () => {
    distDir = await mkdtemp(path.join(tmpdir(), 'ot-runtime-app-shell-'));
    await mkdir(path.join(distDir, 'app'), { recursive: true });
    await writeFile(
      path.join(distDir, 'app', 'parent.html'),
      '<link rel="stylesheet" href="/assets/app-crm.css"><div id="portal-root"></div><script type="module" src="/assets/app-portal.js"></script>',
    );
    await writeHtml(distDir, '404.html');
    const config = loadConfig({
      NODE_ENV: 'test',
      PUBLIC_BASE_URL: 'https://ot99-web-staging.up.railway.app',
      COMMIT_SHA: '0123456789abcdef0123456789abcdef01234567',
    });
    pool = createMemoryPool();
    await runMigrations(pool);
    const parentUserKey = await createAccountUser({
      pool,
      config,
      email: 'cache-parent@example.test',
      password: 'CacheParentPass!234',
      displayName: 'Cache Parent',
      role: 'parent',
      mfaCapable: false,
    });
    await seedParentCurrentAccess(parentUserKey, config.accountKey, config.productKey);
    server = await listenForTest(createApp({ config, pool, distDir }));
    const baseUrl = serverBaseUrl(server);
    const parentCookies = await loginAs(
      baseUrl,
      'cache-parent@example.test',
      'CacheParentPass!234',
    );
    const parentHtml = await fetch(`${baseUrl}/app/parent`, {
      headers: { cookie: parentCookies },
    });
    expect(parentHtml.status).toBe(200);
    expect(parentHtml.headers.get('cache-control')).toBe('no-store, private');
    expect(parentHtml.headers.get('pragma')).toBe('no-cache');
    expect(parentHtml.headers.get('expires')).toBe('0');
    const parentMarkup = await parentHtml.text();
    expect(parentMarkup).toContain(
      '/assets/app-portal.js?v=0123456789abcdef0123456789abcdef01234567',
    );
    expect(parentMarkup).toContain(
      '/assets/app-crm.css?v=0123456789abcdef0123456789abcdef01234567',
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
      '</head><body><span data-first-class-at="__ONE_TIME_FIRST_CLASS_AT__"></span><section data-access-boundary="__ONE_TIME_FREE_ACCESS_EXPIRES_AT__">ok</section></body></html>',
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

async function loginAs(baseUrl: string, identifier: string, password: string) {
  const loginPage = await fetch(`${baseUrl}/login`);
  const loginHtml = await loginPage.text();
  const csrfToken = loginHtml.match(/name="csrf_token" value="([^"]+)"/)?.[1];
  if (!csrfToken) throw new Error('missing login CSRF token');
  const initialCookies = cookieHeader(loginPage.headers);
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      cookie: initialCookies,
      'content-type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify({
      identifier,
      password,
      csrf_token: csrfToken,
    }),
  });
  expect(response.status, await response.text()).toBe(200);
  return mergeCookies(initialCookies, cookieHeader(response.headers));
}

function cookieHeader(headers: Headers) {
  return headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

function mergeCookies(...headers: string[]) {
  const cookies = new Map<string, string>();
  for (const header of headers) {
    for (const part of header.split(';')) {
      const [key, value] = part.trim().split('=');
      if (key && value) cookies.set(key, value);
    }
  }
  return [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
}

async function seedParentCurrentAccess(
  parentUserKey: string,
  accountKey: string,
  productKey: string,
) {
  if (!pool) throw new Error('missing test pool');
  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name)
     VALUES ('cache_parent_household',$1,$2,'Cache Parent Household')`,
    [accountKey, productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_guardian_relationships
       (relationship_key, account_key, product_key, household_key, guardian_user_ref,
        relationship_label, authority)
     VALUES ('cache_parent_relationship',$1,$2,'cache_parent_household',$3,
       'Parent','primary_guardian')`,
    [accountKey, productKey, parentUserKey],
  );
  await pool.query(
    `INSERT INTO onetime.account_access_projections
       (access_key, account_key, product_key, household_key, state, source_kind,
        effective_at, expires_at, opaque_source_reference, source_revision,
        source_updated_at, source_request_hash, policy_version, last_event_key)
     VALUES ('cache_parent_access',$1,$2,'cache_parent_household','active','free_pilot',
       now() - interval '1 hour',now() + interval '30 days','cache_parent_free_pilot',1,
       now(),$3,'cache-parent-access-v1','cache_parent_access_seed')`,
    [accountKey, productKey, 'a'.repeat(64)],
  );
}
