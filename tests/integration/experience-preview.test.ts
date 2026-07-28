import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../apps/web/src/server/app.ts';
import {
  EXPERIENCE_PREVIEW_API_ROUTE,
  EXPERIENCE_PREVIEW_ROUTE,
  FICTIONAL_STUDENT_EXCHANGE_CREATE_ROUTE,
  FICTIONAL_STUDENT_SESSION_ROUTE,
} from '../../apps/web/src/server/features/experience-preview/router.ts';
import { loadConfig, type AppConfig } from '../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import {
  createAccountUser,
  createSession,
  getSessionUserByKey,
} from '../../packages/domain/src/index.ts';

let pool: DbPool;
let config: AppConfig;

beforeEach(async () => {
  config = isolatedConfig();
  pool = createMemoryPool();
  await runMigrations(pool);
});

afterEach(async () => {
  await pool.end();
});

describe('ordinary application removes the historical Experience Preview runtime', () => {
  it('advertises no preview capability and returns 404 for every former entry point', async () => {
    const admin = await createAdminSession();
    const server = await listenForTest(createApp({ config, pool }));
    try {
      const routes = [
        EXPERIENCE_PREVIEW_ROUTE,
        EXPERIENCE_PREVIEW_API_ROUTE,
        FICTIONAL_STUDENT_EXCHANGE_CREATE_ROUTE,
        FICTIONAL_STUDENT_SESSION_ROUTE,
        `${FICTIONAL_STUDENT_SESSION_ROUTE}/retired-handle`,
      ];
      for (const route of routes) {
        const response = await fetch(`${server.baseUrl}${route}`, {
          headers: { cookie: admin.cookie },
          redirect: 'manual',
        });
        expect(response.status, route).toBe(404);
      }

      const session = await fetch(`${server.baseUrl}/api/v1/auth/session`, {
        headers: { cookie: admin.cookie },
      });
      const body = (await session.json()) as {
        capabilities: { operator_experience: { experience_preview: boolean } };
      };
      expect(body.capabilities.operator_experience.experience_preview).toBe(false);
    } finally {
      await server.close();
    }
  });

  it('keeps preview and launch-status routes absent in production too', async () => {
    config = productionConfig();
    const admin = await createAdminSession();
    const server = await listenForTest(createApp({ config, pool }));
    try {
      for (const route of [
        EXPERIENCE_PREVIEW_ROUTE,
        EXPERIENCE_PREVIEW_API_ROUTE,
        '/app/launch-status',
        '/api/v1/launch-status',
      ]) {
        const response = await fetch(`${server.baseUrl}${route}`, {
          headers: { cookie: admin.cookie },
          redirect: 'manual',
        });
        expect(response.status, route).toBe(404);
      }
    } finally {
      await server.close();
    }
  });
});

async function createAdminSession() {
  const userKey = await createAccountUser({
    pool,
    config,
    email: 'ordinary-app-admin@example.test',
    password: 'OrdinaryAppAdmin!234',
    displayName: 'Ordinary App Admin',
    role: 'admin',
  });
  const user = await getSessionUserByKey({ pool, config, userKey });
  if (!user) throw new Error('Missing ordinary app Admin.');
  const session = await createSession({ pool, config, user });
  return { cookie: `otcrm_session=${session.session_token}` };
}

async function listenForTest(app: ReturnType<typeof createApp>) {
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', (error?: Error) => {
      if (error) reject(error);
      else resolve(instance);
    });
  });
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('Missing test server address.');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function isolatedConfig() {
  return loadConfig({
    ...baseEnvironment(),
    DELIVERY_ENVIRONMENT: 'isolated_staging',
    ONE_TIME_RUNTIME_ENVIRONMENT: 'isolated_staging',
    ONE_TIME_EXPERIENCE_PREVIEW_ENABLED: 'true',
    LIVE_CLASS_FAKE_ADAPTER_ENABLED: 'true',
  });
}

function productionConfig() {
  return loadConfig({
    ...baseEnvironment(),
    NODE_ENV: 'production',
    AUTH_CSRF_SECRET: 'ordinary-app-test'.padEnd(32, '-'),
    MFA_SECRET_ENCRYPTION_KEY: 'ordinary-app-test'.padEnd(32, '-'),
    DELIVERY_ENVIRONMENT: 'production',
    ONE_TIME_RUNTIME_ENVIRONMENT: 'production',
    ONE_TIME_EXPERIENCE_PREVIEW_ENABLED: 'false',
    LIVE_CLASS_FAKE_ADAPTER_ENABLED: 'false',
  });
}

function baseEnvironment() {
  return {
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://ordinary-app.example.test',
    APP_VERSION: 'ordinary-app-test',
    COMMIT_SHA: 'ordinary-app-test',
    OUTBOX_TRANSPORT_MODE: 'sink',
    ONE_TIME_ACCOUNT_KEY: 'rabbi_sheller_provider',
    ONE_TIME_PRODUCT_KEY: 'one_time_mishnah_class',
    ZOOM_CLASSROOM_ENABLED: 'true',
  } satisfies NodeJS.ProcessEnv;
}
