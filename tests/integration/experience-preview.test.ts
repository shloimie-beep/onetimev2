import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../apps/web/src/server/app.ts';
import {
  EXPERIENCE_PREVIEW_API_ROUTE,
  EXPERIENCE_PREVIEW_ROUTE,
  FICTIONAL_STUDENT_EXCHANGE_CREATE_ROUTE,
  buildExperiencePreviewCatalog,
} from '../../apps/web/src/server/features/experience-preview/router.ts';
import { loadConfig, type AppConfig } from '../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import {
  createAccountUser,
  createSession,
  getSessionUserByKey,
} from '../../packages/domain/src/index.ts';
import {
  rotateFullAppPreviewAdminCredential,
  runFullAppProvision,
} from '../../scripts/full-app-staging-live/provision-preview.ts';

let pool: DbPool;
let config: AppConfig;
let distDir: string;
let currentTime: Date;

beforeEach(async () => {
  currentTime = new Date('2026-07-22T12:00:00.000Z');
  config = previewConfig();
  pool = createMemoryPool();
  await runMigrations(pool);
  distDir = await mkdtemp(path.join(tmpdir(), 'experience-preview-dist-'));
  await writeAppShells(distDir);
});

afterEach(async () => {
  await pool.end();
  await rm(distDir, { recursive: true, force: true });
});

describe('OT-LAUNCH-01 Experience Preview security boundary', () => {
  it('rejects production configuration, returns 404, and advertises no production nav capability', async () => {
    expect(() =>
      loadConfig({
        ...baseEnvironment(),
        DELIVERY_ENVIRONMENT: 'production',
        ONE_TIME_RUNTIME_ENVIRONMENT: 'production',
        ONE_TIME_EXPERIENCE_PREVIEW_ENABLED: 'true',
      }),
    ).toThrow('Experience Preview requires explicit test or isolated_staging');

    const productionConfig = loadConfig({
      ...baseEnvironment(),
      DELIVERY_ENVIRONMENT: 'production',
      ONE_TIME_RUNTIME_ENVIRONMENT: 'production',
      ONE_TIME_EXPERIENCE_PREVIEW_ENABLED: 'false',
      LIVE_CLASS_FAKE_ADAPTER_ENABLED: 'false',
    });
    const admin = await createUserSession('admin', 'production-nav-admin@example.test');
    const server = await listenForTest(
      createApp({ config: productionConfig, pool, distDir, clock: () => currentTime }),
    );
    try {
      const page = await fetch(`${server.baseUrl}${EXPERIENCE_PREVIEW_ROUTE}`, {
        headers: { cookie: admin.cookie },
      });
      const session = await fetch(`${server.baseUrl}/api/v1/auth/session`, {
        headers: { cookie: admin.cookie },
      });
      const sessionJson = (await session.json()) as {
        capabilities: {
          operator_experience: { experience_preview: boolean; live_console: boolean };
        };
      };
      expect(page.status).toBe(404);
      expect(sessionJson.capabilities.operator_experience).toEqual({
        experience_preview: false,
        live_console: false,
      });
    } finally {
      await server.close();
    }
  });

  it('is explicit isolated_staging plus flag and remains Admin-only', async () => {
    const admin = await createUserSession('admin', 'preview-admin@example.test');
    const parent = await createUserSession('parent', 'preview-parent@example.test');
    const server = await previewServer();
    try {
      const anonymous = await fetch(`${server.baseUrl}${EXPERIENCE_PREVIEW_ROUTE}`, {
        redirect: 'manual',
      });
      const parentPage = await fetch(`${server.baseUrl}${EXPERIENCE_PREVIEW_ROUTE}`, {
        headers: { cookie: parent.cookie },
      });
      const parentApi = await fetch(`${server.baseUrl}${EXPERIENCE_PREVIEW_API_ROUTE}`, {
        headers: { cookie: parent.cookie },
      });
      const adminPage = await fetch(`${server.baseUrl}${EXPERIENCE_PREVIEW_ROUTE}`, {
        headers: { cookie: admin.cookie },
      });
      const session = await fetch(`${server.baseUrl}/api/v1/auth/session`, {
        headers: { cookie: admin.cookie },
      });
      const sessionJson = (await session.json()) as {
        capabilities: {
          operator_experience: { experience_preview: boolean; live_console: boolean };
        };
      };
      expect(anonymous.status).toBe(302);
      expect(parentPage.status).toBe(403);
      expect(parentApi.status).toBe(403);
      expect(adminPage.status).toBe(200);
      expect(adminPage.headers.get('cache-control')).toContain('no-store');
      expect(sessionJson.capabilities.operator_experience).toEqual({
        experience_preview: true,
        live_console: true,
      });
    } finally {
      await server.close();
    }
  });

  it('rejects enum-only issuance until the exact provisioner identity marker exists', async () => {
    const admin = await createUserSession('admin', 'unseeded-admin@example.test');
    const server = await previewServer();
    try {
      const unseeded = await createExchange(server.baseUrl, admin, 'student_1');
      expect(unseeded.response.status).toBe(409);
      expect(unseeded.json).toMatchObject({ code: 'fictional_student_unavailable' });

      await seedExactScenario();
      const seeded = await createExchange(server.baseUrl, admin, 'student_1');
      expect(seeded.response.status).toBe(201);
      expect(seeded.json.exchange_url).toMatch(
        /^\/app\/experience-preview\/student\/exchange\?exchange_id=[A-Za-z0-9_-]{43}$/,
      );
      expect(seeded.json.exchange_url).not.toContain(admin.session.user.user_key);
      expect(seeded.json.exchange_url).not.toContain('full_app_preview_student_1');
    } finally {
      await server.close();
    }
  });

  it('requires CSRF and rejects missing, inactive, wrong-household, or ineligible seeds', async () => {
    await seedExactScenario();
    const admin = await createUserSession('admin', 'seed-proof-admin@example.test');
    const server = await previewServer();
    try {
      const noCsrf = await fetch(`${server.baseUrl}${FICTIONAL_STUDENT_EXCHANGE_CREATE_ROUTE}`, {
        method: 'POST',
        headers: { cookie: admin.cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ role_id: 'student_1' }),
      });
      expect(noCsrf.status).toBe(403);

      await pool.query(
        `UPDATE onetime.portal_learners
            SET learner_status = 'archived', archived_at = $1
          WHERE learner_key = 'full_app_preview_student_1'`,
        [currentTime],
      );
      expect((await createExchange(server.baseUrl, admin, 'student_1')).response.status).toBe(409);
      await pool.query(
        `UPDATE onetime.portal_learners
            SET learner_status = 'active', archived_at = NULL
          WHERE learner_key = 'full_app_preview_student_1'`,
      );

      await pool.query(
        `INSERT INTO onetime.portal_households
           (household_key, account_key, product_key, display_name, status)
         VALUES ('wrong_preview_household',$1,$2,'Wrong Household','active')`,
        [config.accountKey, config.productKey],
      );
      await pool.query(
        `UPDATE onetime.experience_preview_fictional_identities
            SET household_key = 'wrong_preview_household'
          WHERE role_id = 'student_1'`,
      );
      expect((await createExchange(server.baseUrl, admin, 'student_1')).response.status).toBe(409);
      await pool.query(
        `UPDATE onetime.experience_preview_fictional_identities
            SET household_key = 'full_app_preview_household', eligibility_state = 'disabled'
          WHERE role_id = 'student_1'`,
      );
      expect((await createExchange(server.baseUrl, admin, 'student_1')).response.status).toBe(409);
      await pool.query(
        `DELETE FROM onetime.experience_preview_fictional_identities
          WHERE role_id = 'student_1'`,
      );
      expect((await createExchange(server.baseUrl, admin, 'student_1')).response.status).toBe(409);
    } finally {
      await server.close();
    }
  });

  it('uses a single-use exchange, session-key binding, and a narrow secure preview cookie', async () => {
    await seedExactScenario();
    const admin = await createUserSession('admin', 'exchange-admin@example.test');
    const secondSession = await createSession({ pool, config, user: admin.session.user });
    const secondCookie = `otcrm_session=${secondSession.session_token}`;
    const server = await previewServer();
    try {
      const issued = await createExchange(server.baseUrl, admin, 'student_1');
      const exchangeUrl = String(issued.json.exchange_url);
      const wrongSession = await fetch(`${server.baseUrl}${exchangeUrl}`, {
        redirect: 'manual',
        headers: { cookie: secondCookie },
      });
      expect(wrongSession.status).toBe(404);

      const consumed = await fetch(`${server.baseUrl}${exchangeUrl}`, {
        redirect: 'manual',
        headers: { cookie: admin.cookie },
      });
      expect(consumed.status).toBe(303);
      const sessionRoute = consumed.headers.get('location') ?? '';
      expect(sessionRoute).toMatch(/^\/app\/experience-preview\/student\/[A-Za-z0-9_-]{43}$/);
      const setCookie = consumed.headers.get('set-cookie') ?? '';
      expect(setCookie).toContain('ot_experience_preview=');
      expect(setCookie).toContain(`Path=${sessionRoute}`);
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('Secure');
      expect(setCookie).toContain('SameSite=Strict');
      expect(setCookie).not.toContain('Domain=');

      const replay = await fetch(`${server.baseUrl}${exchangeUrl}`, {
        redirect: 'manual',
        headers: { cookie: admin.cookie },
      });
      expect(replay.status).toBe(410);
      const exchangeRows = await pool.query(
        `SELECT exchange_digest, consumed_at FROM onetime.experience_preview_exchanges`,
      );
      expect(exchangeRows.rowCount).toBe(1);
      expect(JSON.stringify(exchangeRows.rows)).not.toContain(
        new URL(exchangeUrl, server.baseUrl).searchParams.get('exchange_id'),
      );
    } finally {
      await server.close();
    }
  });

  it('expires exchanges and preview sessions at the server', async () => {
    await seedExactScenario();
    const admin = await createUserSession('admin', 'expiry-admin@example.test');
    const server = await previewServer();
    try {
      const first = await createExchange(server.baseUrl, admin, 'student_1');
      currentTime = new Date(currentTime.getTime() + 61_000);
      const expiredExchange = await fetch(`${server.baseUrl}${first.json.exchange_url}`, {
        redirect: 'manual',
        headers: { cookie: admin.cookie },
      });
      expect(expiredExchange.status).toBe(410);

      const second = await createExchange(server.baseUrl, admin, 'student_1');
      const consumed = await fetch(`${server.baseUrl}${second.json.exchange_url}`, {
        redirect: 'manual',
        headers: { cookie: admin.cookie },
      });
      const previewCookie = cookiePair(consumed.headers.get('set-cookie') ?? '');
      const sessionRoute = String(consumed.headers.get('location'));
      currentTime = new Date(currentTime.getTime() + 5 * 60_000 + 1);
      const projection = await fetch(`${server.baseUrl}${sessionRoute}/projection`, {
        headers: { cookie: previewCookie },
      });
      expect(projection.status).toBe(404);
    } finally {
      await server.close();
    }
  });

  it('serves a dedicated no-Admin shell and preserves the original Admin session', async () => {
    await seedExactScenario();
    const admin = await createUserSession('admin', 'preserved-admin@example.test');
    const server = await previewServer();
    try {
      const issued = await createExchange(server.baseUrl, admin, 'student_1');
      const consumed = await fetch(`${server.baseUrl}${issued.json.exchange_url}`, {
        redirect: 'manual',
        headers: { cookie: admin.cookie },
      });
      const previewCookie = cookiePair(consumed.headers.get('set-cookie') ?? '');
      const sessionRoute = String(consumed.headers.get('location'));
      const dedicatedPage = await fetch(`${server.baseUrl}${sessionRoute}`, {
        headers: { cookie: `${admin.cookie}; ${previewCookie}` },
      });
      const html = await dedicatedPage.text();
      expect(dedicatedPage.status).toBe(200);
      expect(dedicatedPage.headers.get('cache-control')).toContain('no-store');
      expect(html).toContain('experience-preview-student-root');
      expect(html).toContain('app-experience-preview-student.js');
      expect(html).not.toContain('crm-root');
      expect(html).not.toContain('Administrator');
      expect(html).not.toContain('Logout');
      expect(html).not.toContain('Primary navigation');

      const projection = await fetch(`${server.baseUrl}${sessionRoute}/projection`, {
        headers: { cookie: `${admin.cookie}; ${previewCookie}` },
      });
      const projectionText = await projection.text();
      expect(projection.status, projectionText).toBe(200);
      expect(projection.headers.get('cache-control')).toContain('no-store');
      const projectionJson = JSON.parse(projectionText) as {
        student_portal: {
          learner: { learner_key: string; display_name: string };
          upcoming_classes: unknown[];
          library_items: unknown[];
          progress: unknown;
          questions: unknown[];
        };
      };
      expect(projectionJson.student_portal.learner).toMatchObject({
        learner_key: 'full_app_preview_student_1',
        display_name: 'Ari Cohen',
      });
      expect(projectionJson.student_portal.upcoming_classes.length).toBeGreaterThan(0);
      expect(projectionJson.student_portal.library_items.length).toBeGreaterThan(0);
      expect(projectionJson.student_portal.progress).toBeDefined();
      expect(projectionJson.student_portal.questions).toEqual([]);
      expect(projectionText).toContain('Ari Cohen');
      expect(projectionText).not.toContain('Dovid Cohen');
      expect(projectionText).not.toContain('Noam Cohen');

      const originalSession = await fetch(`${server.baseUrl}/api/v1/auth/session`, {
        headers: { cookie: admin.cookie },
      });
      const originalJson = (await originalSession.json()) as {
        user: { role: string; email: string };
      };
      expect(originalSession.status).toBe(200);
      expect(originalJson.user).toMatchObject({
        role: 'admin',
        email: 'preserved-admin@example.test',
      });
      const sessionRow = await pool.query(
        `SELECT revoked_at FROM onetime.user_sessions WHERE session_key = $1`,
        [admin.session.session_key],
      );
      expect(sessionRow.rows[0]?.revoked_at).toBeNull();
    } finally {
      await server.close();
    }
  });

  it('keeps two sibling preview tabs isolated with distinct opaque route scopes', async () => {
    await seedExactScenario();
    const admin = await createUserSession('admin', 'sibling-tabs-admin@example.test');
    const server = await previewServer();
    try {
      const studentOne = await createExchange(server.baseUrl, admin, 'student_1');
      const studentTwo = await createExchange(server.baseUrl, admin, 'student_2');
      const consumedOne = await fetch(`${server.baseUrl}${studentOne.json.exchange_url}`, {
        redirect: 'manual',
        headers: { cookie: admin.cookie },
      });
      const consumedTwo = await fetch(`${server.baseUrl}${studentTwo.json.exchange_url}`, {
        redirect: 'manual',
        headers: { cookie: admin.cookie },
      });
      const routeOne = String(consumedOne.headers.get('location'));
      const routeTwo = String(consumedTwo.headers.get('location'));
      const cookieOne = cookiePair(consumedOne.headers.get('set-cookie') ?? '');
      const cookieTwo = cookiePair(consumedTwo.headers.get('set-cookie') ?? '');
      expect(routeOne).not.toBe(routeTwo);
      expect(consumedOne.headers.get('set-cookie')).toContain(`Path=${routeOne}`);
      expect(consumedTwo.headers.get('set-cookie')).toContain(`Path=${routeTwo}`);

      const [projectionOne, projectionTwo] = await Promise.all([
        fetch(`${server.baseUrl}${routeOne}/projection`, { headers: { cookie: cookieOne } }),
        fetch(`${server.baseUrl}${routeTwo}/projection`, { headers: { cookie: cookieTwo } }),
      ]);
      const [bodyOne, bodyTwo] = await Promise.all([projectionOne.text(), projectionTwo.text()]);
      expect(projectionOne.status, bodyOne).toBe(200);
      expect(projectionTwo.status, bodyTwo).toBe(200);
      expect(bodyOne).toContain('Ari Cohen');
      expect(bodyOne).not.toContain('Dovid Cohen');
      expect(bodyTwo).toContain('Dovid Cohen');
      expect(bodyTwo).not.toContain('Ari Cohen');

      const crossed = await fetch(`${server.baseUrl}${routeOne}/projection`, {
        headers: { cookie: cookieTwo },
      });
      expect(crossed.status).toBe(404);
    } finally {
      await server.close();
    }
  });

  it('denies a valid Admin from another account even when the canonical seed exists', async () => {
    await seedExactScenario();
    const otherConfig = previewConfig({ ONE_TIME_ACCOUNT_KEY: 'other_preview_account' });
    const otherAdmin = await createUserSession(
      'admin',
      'other-account-admin@example.test',
      otherConfig,
    );
    const server = await listenForTest(
      createApp({ config: otherConfig, pool, distDir, clock: () => currentTime }),
    );
    try {
      const denied = await createExchange(server.baseUrl, otherAdmin, 'student_1');
      expect(denied.response.status).toBe(409);
      expect(denied.json).toMatchObject({ code: 'fictional_student_unavailable' });
    } finally {
      await server.close();
    }
  });

  it('audits no-store read projections without mutating domain records', async () => {
    await seedExactScenario();
    const admin = await createUserSession('admin', 'audit-admin@example.test');
    const before = await domainCounts();
    const server = await previewServer();
    try {
      const response = await fetch(`${server.baseUrl}${EXPERIENCE_PREVIEW_API_ROUTE}`, {
        headers: { cookie: admin.cookie },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(await domainCounts()).toEqual(before);
      const audits = await pool.query(
        `SELECT metadata FROM onetime.portal_audit_actions
          WHERE action_type = 'experience_preview_viewed'`,
      );
      expect(audits.rowCount).toBe(1);
      expect(audits.rows[0]?.metadata).toMatchObject({ fictional: true, read_only: true });
    } finally {
      await server.close();
    }
  });
});

describe('OT-LAUNCH-01 exact projection truth', () => {
  it('binds only the exact fictional occurrence even when another ready occurrence exists', async () => {
    await seedExactScenario();
    const scenario = await pool.query(
      `SELECT occurrence_key FROM onetime.experience_preview_scenarios
        WHERE scenario_key = 'full_app_preview_scenario'`,
    );
    const exactOccurrence = String(scenario.rows[0]?.occurrence_key);
    await pool.query(
      `UPDATE onetime.class_occurrences SET access_state = 'pending'
        WHERE occurrence_key = $1`,
      [exactOccurrence],
    );
    await pool.query(
      `INSERT INTO onetime.class_occurrences
         (occurrence_key, account_key, product_key, class_series_key, local_class_date,
          starts_at, reminder_due_at, joinable_until, occurrence_state, access_state)
       VALUES ('unrelated_ready_occurrence',$1,$2,'class_series_one_time_daily','2026-07-30',
               '2026-07-30T16:00:00Z','2026-07-30T15:30:00Z','2026-07-30T17:00:00Z',
               'scheduled','ready')`,
      [config.accountKey, config.productKey],
    );
    const catalog = await buildExperiencePreviewCatalog(pool, config);
    expect(catalog.roles.find((role) => role.role_id === 'rabbi_classroom')?.state).toBe(
      'unavailable',
    );
    expect(JSON.stringify(catalog)).not.toContain('unrelated_ready_occurrence');
  });

  it('turns exact credential, enrollment, attendance, artifact, review, and question gaps unavailable', async () => {
    await seedExactScenario();
    const initial = await buildExperiencePreviewCatalog(pool, config);
    expect(initial.roles.find((role) => role.role_id === 'student_1')?.state).toBe('ready');
    expect(itemState(initial, 'student_1', 'Attendance and points')).toBe('ready');
    expect(
      itemState(initial, 'student_1', 'Approved prepared lesson'),
      JSON.stringify(initial.previews.find((preview) => preview.role_id === 'student_1')),
    ).toBe('ready');
    expect(itemState(initial, 'rabbi_classroom', 'Exact private queue item')).toBe('ready');

    await pool.query(
      `UPDATE onetime.portal_student_access_state SET credential_status = 'reset_required'
        WHERE access_state_key = 'full_app_preview_student_1_access'`,
    );
    expect(
      (await buildExperiencePreviewCatalog(pool, config)).roles.find(
        (role) => role.role_id === 'student_1',
      )?.state,
    ).toBe('unavailable');
    await pool.query(
      `UPDATE onetime.portal_student_access_state SET credential_status = 'parent_managed'
        WHERE access_state_key = 'full_app_preview_student_1_access'`,
    );

    await pool.query(
      `UPDATE onetime.classroom_household_entitlements SET entitlement_state = 'suspended'
        WHERE entitlement_key = 'full_app_preview_classroom_entitlement'`,
    );
    expect(
      itemState(await buildExperiencePreviewCatalog(pool, config), 'student_1', 'Enrollment'),
    ).toBe('unavailable');
    await pool.query(
      `UPDATE onetime.classroom_household_entitlements SET entitlement_state = 'active'
        WHERE entitlement_key = 'full_app_preview_classroom_entitlement'`,
    );

    await pool.query(
      `DELETE FROM onetime.class_attendance_marks
        WHERE attendance_key LIKE 'full_app_preview_attendance_%_1'`,
    );
    expect(
      itemState(
        await buildExperiencePreviewCatalog(pool, config),
        'student_1',
        'Attendance and points',
      ),
    ).toBe('unavailable');

    await pool.query(
      `UPDATE onetime.experience_preview_review_questions SET approval_state = 'draft'
        WHERE question_key = 'full_app_preview_review_question_1'`,
    );
    expect(
      itemState(
        await buildExperiencePreviewCatalog(pool, config),
        'student_2',
        'Approved prepared lesson',
      ),
    ).toBe('unavailable');

    await pool.query(
      `DELETE FROM onetime.live_class_questions
        WHERE question_key = 'full_app_preview_private_question'`,
    );
    expect(
      itemState(
        await buildExperiencePreviewCatalog(pool, config),
        'rabbi_classroom',
        'Exact private queue item',
      ),
    ).toBe('unavailable');
  });

  it('reports Zoom provider_off until activation gates and exact meeting projection are ready', async () => {
    await seedExactScenario();
    expect(
      itemState(await buildExperiencePreviewCatalog(pool, config), 'rabbi_classroom', 'Zoom'),
    ).toBe('provider_off');

    const realConfig = previewConfig({
      ZOOM_CLASSROOM_PROVIDER_MODE: 'real',
      ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED: 'true',
      ZOOM_MEETING_SDK_CLIENT_ID: 'sdk-client-id',
      ZOOM_MEETING_SDK_CLIENT_SECRET: 'sdk-client-secret',
      ZOOM_MEETING_SDK_WEB_VERSION: '3.11.2',
      ZOOM_S2S_ACCOUNT_ID: 'zoom-account',
      ZOOM_S2S_CLIENT_ID: 's2s-client-id',
      ZOOM_S2S_CLIENT_SECRET: 's2s-client-secret',
    });
    expect(
      itemState(await buildExperiencePreviewCatalog(pool, realConfig), 'rabbi_classroom', 'Zoom'),
    ).toBe('unavailable');
    const scenario = await pool.query(
      `SELECT occurrence_key FROM onetime.experience_preview_scenarios
        WHERE scenario_key = 'full_app_preview_scenario'`,
    );
    const occurrenceKey = String(scenario.rows[0]?.occurrence_key);
    await pool.query(
      `UPDATE onetime.class_occurrences
          SET provider_meeting_state = 'ready', provider_meeting_ref_digest = 'meeting-digest'
        WHERE occurrence_key = $1`,
      [occurrenceKey],
    );
    await pool.query(
      `UPDATE onetime.classroom_session_provider_projection
          SET provider_state = 'ready', provider_meeting_ref_digest = 'meeting-digest'
        WHERE occurrence_key = $1`,
      [occurrenceKey],
    );
    expect(
      itemState(await buildExperiencePreviewCatalog(pool, realConfig), 'rabbi_classroom', 'Zoom'),
    ).toBe('ready');
  });

  it('reports Telegram provider_off until the complete protected single-consumer canary contract is configured', async () => {
    await seedExactScenario();
    const flagOnly = previewConfig({ LIVE_CLASS_TELEGRAM_ENABLED: 'true' });
    expect(
      itemState(
        await buildExperiencePreviewCatalog(pool, flagOnly),
        'rabbi_classroom',
        'Rabbi Telegram',
      ),
    ).toBe('provider_off');

    const ready = previewConfig({
      LIVE_CLASS_TELEGRAM_ENABLED: 'true',
      ONE_TIME_TELEGRAM_WEBHOOK_ENABLED: 'true',
      ONE_TIME_TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
      ONE_TIME_TELEGRAM_WEBHOOK_SECRET_CONFIGURED: 'true',
      ONE_TIME_TELEGRAM_TOKEN_CONFIGURED: 'true',
      ONE_TIME_TELEGRAM_OWNER_MAPPING_CONFIGURED: 'true',
      ONE_TIME_TELEGRAM_SINGLE_CONSUMER_GATE: 'true',
      ONE_TIME_TELEGRAM_CANARY_CHAT_CONFIGURED: 'true',
      ONE_TIME_TELEGRAM_LOCAL_POLLING_ENABLED: 'false',
      ONE_TIME_TELEGRAM_PRODUCTION_POLLING_ENABLED: 'false',
    });
    expect(
      itemState(
        await buildExperiencePreviewCatalog(pool, ready),
        'rabbi_classroom',
        'Rabbi Telegram',
      ),
    ).toBe('ready');
  });

  it('rotates only the exact fictional Admin credential, revokes sessions, and preserves the private handoff', async () => {
    config = previewConfig({
      ONE_TIME_OWNER_TEST_EMAIL: 'full-app-admin@example.invalid',
    });
    await seedExactScenario();
    const adminRow = await pool.query(
      `SELECT user_key, password_hash, security_version
         FROM onetime.account_users
        WHERE account_key = $1 AND product_key = $2
          AND email_normalized = 'full-app-admin@example.invalid'`,
      [config.accountKey, config.productKey],
    );
    const userKey = String(adminRow.rows[0]?.user_key ?? '');
    const user = await getSessionUserByKey({ pool, config, userKey });
    if (!user) throw new Error('missing exact fictional Admin fixture');
    await createSession({ pool, config, user });

    const handoffPath = path.join(distDir, 'FULL-APP-HANDOFF.private.json');
    await writeFile(
      handoffPath,
      `${JSON.stringify({
        generated_at: currentTime.toISOString(),
        staging_url: config.publicBaseUrl,
        account_key: config.accountKey,
        product_key: config.productKey,
        admin: {
          destination: 'full-app-admin@example.invalid',
          password: 'CompromisedFictionalAdminOnly!234',
        },
        parent: { preserved: true },
        students: [{ preserved: true }],
      })}\n`,
    );

    const result = await rotateFullAppPreviewAdminCredential({
      pool,
      config,
      publicBaseUrl: config.publicBaseUrl,
      requirePrivateDestinations: true,
      handoffPath,
      now: new Date(currentTime.getTime() + 1_000),
    });
    const rotatedRow = await pool.query(
      `SELECT password_hash, security_version
         FROM onetime.account_users WHERE user_key = $1`,
      [userKey],
    );
    const activeSessions = await pool.query(
      `SELECT count(*)::int AS active_sessions
         FROM onetime.user_sessions WHERE user_key = $1 AND revoked_at IS NULL`,
      [userKey],
    );
    const handoff = JSON.parse(await readFile(handoffPath, 'utf8')) as Record<string, unknown>;
    const handoffAdmin = handoff.admin as Record<string, unknown>;

    expect(result).toMatchObject({
      security_version_incremented: true,
      active_sessions_before: 1,
      active_sessions_after: 0,
      credential_printed: false,
    });
    expect(rotatedRow.rows[0]?.password_hash).not.toBe(adminRow.rows[0]?.password_hash);
    expect(Number(rotatedRow.rows[0]?.security_version)).toBeGreaterThan(
      Number(adminRow.rows[0]?.security_version),
    );
    expect(Number(activeSessions.rows[0]?.active_sessions)).toBe(0);
    expect(handoffAdmin.password).not.toBe('CompromisedFictionalAdminOnly!234');
    expect(handoff.parent).toEqual({ preserved: true });
    expect(handoff.students).toEqual([{ preserved: true }]);
    expect(JSON.stringify(result)).not.toContain(String(handoffAdmin.password));
  });
});

function baseEnvironment(overrides: NodeJS.ProcessEnv = {}) {
  return {
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://ot99-web-staging.up.railway.app',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    OUTBOX_TRANSPORT_MODE: 'sink',
    ONE_TIME_ACCOUNT_KEY: 'rabbi_sheller_provider',
    ONE_TIME_PRODUCT_KEY: 'one_time_mishnah_class',
    ZOOM_CLASSROOM_ENABLED: 'true',
    ...overrides,
  } satisfies NodeJS.ProcessEnv;
}

function previewConfig(overrides: NodeJS.ProcessEnv = {}) {
  return loadConfig({
    ...baseEnvironment(),
    DELIVERY_ENVIRONMENT: 'isolated_staging',
    ONE_TIME_RUNTIME_ENVIRONMENT: 'isolated_staging',
    ONE_TIME_EXPERIENCE_PREVIEW_ENABLED: 'true',
    LIVE_CLASS_FAKE_ADAPTER_ENABLED: 'true',
    ...overrides,
  });
}

async function seedExactScenario() {
  await runFullAppProvision({
    pool,
    config,
    publicBaseUrl: config.publicBaseUrl,
    writePrivateHandoff: false,
    requirePrivateDestinations: false,
    now: currentTime,
  });
}

async function createUserSession(
  role: 'admin' | 'parent',
  email: string,
  targetConfig: AppConfig = config,
) {
  const userKey = await createAccountUser({
    pool,
    config: targetConfig,
    email,
    password: 'ExperiencePreviewPass!234',
    displayName: `Experience Preview ${role}`,
    role,
  });
  const user = await getSessionUserByKey({ pool, config: targetConfig, userKey });
  if (!user) throw new Error(`missing test user ${role}`);
  const session = await createSession({ pool, config: targetConfig, user });
  return { session, cookie: `otcrm_session=${session.session_token}` };
}

async function createExchange(
  baseUrl: string,
  admin: Awaited<ReturnType<typeof createUserSession>>,
  roleId: 'student_1' | 'student_2' | 'student_3',
) {
  const response = await fetch(`${baseUrl}${FICTIONAL_STUDENT_EXCHANGE_CREATE_ROUTE}`, {
    method: 'POST',
    headers: {
      cookie: admin.cookie,
      'content-type': 'application/json',
      'x-csrf-token': admin.session.csrf_token,
    },
    body: JSON.stringify({ role_id: roleId, csrf_token: admin.session.csrf_token }),
  });
  const json = (await response.json()) as Record<string, unknown>;
  return { response, json };
}

function itemState(
  catalog: Awaited<ReturnType<typeof buildExperiencePreviewCatalog>>,
  roleId: string,
  label: string,
) {
  return catalog.previews
    .find((preview) => preview.role_id === roleId)
    ?.sections.flatMap((section) => section.items)
    .find((item) => item.label === label)?.state;
}

function cookiePair(setCookie: string) {
  return setCookie.split(';', 1)[0] ?? '';
}

async function domainCounts() {
  const names = [
    'portal_households',
    'portal_learners',
    'class_occurrences',
    'content_items',
    'live_class_questions',
    'event_registrations',
  ];
  const counts: Record<string, number> = {};
  for (const name of names) {
    const result = await pool.query(`SELECT count(*)::int AS count FROM onetime.${name}`);
    counts[name] = Number(result.rows[0]?.count ?? 0);
  }
  return counts;
}

async function writeAppShells(targetDir: string) {
  await mkdir(path.join(targetDir, 'app'), { recursive: true });
  await writeFile(path.join(targetDir, 'app', 'parent.html'), '<div id="portal-root"></div>');
  await writeFile(path.join(targetDir, 'app', 'student.html'), '<div id="portal-root"></div>');
  await writeFile(path.join(targetDir, 'app', 'crm.html'), '<div id="crm-root"></div>');
  await writeFile(
    path.join(targetDir, 'app', 'experience-preview-student.html'),
    '<div id="experience-preview-student-root"></div><script src="/assets/app-experience-preview-student.js"></script>',
  );
  await writeFile(path.join(targetDir, '404.html'), '<h1>Not found</h1>');
}

async function previewServer() {
  return listenForTest(createApp({ config, pool, distDir, clock: () => currentTime }));
}

async function listenForTest(app: ReturnType<typeof createApp>) {
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const instance = app.listen(0, (error?: Error) => {
      if (error) reject(error);
      else resolve(instance);
    });
  });
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('missing test server address');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
