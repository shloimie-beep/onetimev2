import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../apps/web/src/server/app.ts';
import {
  W12_PORTAL_TEST_LAB,
  W12_PORTAL_TEST_LAB_ROUTE,
  seedPortalTestLab,
} from '../../../apps/web/src/server/features/portal-test-lab/router.ts';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  createDbStudentClassHelperRateLimitStore,
  createAccountUser,
  decryptAuthEmailChallengeDeliveryPayloadForTests,
} from '../../../packages/domain/src/index.ts';

let pool: DbPool;
let config: AppConfig;
let distDir: string;

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    OUTBOX_TRANSPORT_MODE: 'sink',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
  distDir = await mkdtemp(path.join(tmpdir(), 'w12-portal-test-lab-'));
  await writePortalShells(distDir);
  await createAccountUser({
    pool,
    config,
    email: 'w12-viewer@example.test',
    password: 'W12ViewerPass!234',
    displayName: 'W12 Fictional Viewer',
    role: 'viewer',
  });
  await seedPortalTestLab({ pool, config });
});

afterEach(async () => {
  await pool.end();
  await rm(distDir, { recursive: true, force: true });
});

describe('W12-03 Portal Test Lab', () => {
  it('404s and writes nothing when either explicit runtime classification is production', async () => {
    for (const override of [
      { deliveryEnvironment: 'production' as const },
      { oneTimeRuntimeEnvironment: 'production' as const },
    ]) {
      const isolatedPool = createMemoryPool();
      await runMigrations(isolatedPool);
      const failClosedConfig: AppConfig = {
        ...config,
        ...override,
        portalTestLabEnabled: true,
      };
      const server = await listenForTest(
        createApp({ config: failClosedConfig, pool: isolatedPool, distDir }),
      );
      try {
        const page = await fetch(`${server.baseUrl}${W12_PORTAL_TEST_LAB_ROUTE}`);
        expect(page.status).toBe(404);
        const reseed = await fetch(`${server.baseUrl}${W12_PORTAL_TEST_LAB_ROUTE}/reseed`, {
          method: 'POST',
        });
        expect(reseed.status).toBe(404);

        await seedPortalTestLab({ pool: isolatedPool, config: failClosedConfig });
        const [users, accessRows] = await Promise.all([
          isolatedPool.query(`SELECT count(*)::int AS count FROM onetime.account_users`),
          isolatedPool.query(
            `SELECT count(*)::int AS count FROM onetime.account_access_projections`,
          ),
        ]);
        expect(users.rows[0]?.count).toBe(0);
        expect(accessRows.rows[0]?.count).toBe(0);
      } finally {
        await server.close();
        await isolatedPool.end();
      }
    }
  });

  it('keeps the lab owner/admin-only and hides runnable secrets', async () => {
    const server = await listenForTest(createApp({ config, pool, distDir }));
    try {
      const anonymous = await fetch(`${server.baseUrl}${W12_PORTAL_TEST_LAB_ROUTE}`, {
        redirect: 'manual',
      });
      expect(anonymous.status).toBe(302);
      expect(anonymous.headers.get('location')).toContain('return_to=%2Fapp%2Fportal-test-lab');

      const parent = await loginAs(
        server.baseUrl,
        W12_PORTAL_TEST_LAB.parent.email,
        W12_PORTAL_TEST_LAB.parent.defaultPassword,
      );
      const forbidden = await fetch(`${server.baseUrl}${W12_PORTAL_TEST_LAB_ROUTE}`, {
        headers: { cookie: parent.cookies },
      });
      expect(forbidden.status).toBe(403);
      expect(await forbidden.text()).toContain('Portal Test Lab access unavailable');

      const admin = await loginAs(
        server.baseUrl,
        W12_PORTAL_TEST_LAB.admin.email,
        W12_PORTAL_TEST_LAB.admin.defaultPassword,
      );
      const page = await fetch(`${server.baseUrl}${W12_PORTAL_TEST_LAB_ROUTE}`, {
        headers: { cookie: admin.cookies },
      });
      const html = await page.text();
      expect(page.status, html).toBe(200);
      expect(page.headers.get('cache-control')).toContain('no-store');
      expect(html).toContain('W12 Portal Test Lab');
      expect(html).toContain(W12_PORTAL_TEST_LAB.parent.email);
      for (const learner of W12_PORTAL_TEST_LAB.learners) {
        expect(html).toContain(learner.email);
        expect(html).toContain(learner.learnerKey);
        expect(html).not.toContain(learner.defaultPassword);
      }
      expect(html).not.toContain(W12_PORTAL_TEST_LAB.parent.defaultPassword);
      expect(html).not.toContain(W12_PORTAL_TEST_LAB.admin.defaultPassword);
      expect(html).not.toMatch(/view as|impersonat|https?:\/\/|zoom|vimeo|drive|meet/i);

      const reset = await fetch(`${server.baseUrl}${W12_PORTAL_TEST_LAB_ROUTE}/reset`, {
        method: 'POST',
        headers: {
          cookie: admin.cookies,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ csrf_token: admin.json.csrf_token }),
        redirect: 'manual',
      });
      expect(reset.status).toBe(303);
      expect(reset.headers.get('location')).toBe(`${W12_PORTAL_TEST_LAB_ROUTE}?status=reset`);
    } finally {
      await server.close();
    }
  });

  it('provisions separate parent and learner sessions with no sibling bleed', async () => {
    const server = await listenForTest(createApp({ config, pool, distDir }));
    try {
      const parent = await loginAs(
        server.baseUrl,
        W12_PORTAL_TEST_LAB.parent.email,
        W12_PORTAL_TEST_LAB.parent.defaultPassword,
      );
      const parentDashboard = await fetch(`${server.baseUrl}/api/v1/portals/parent/dashboard`, {
        headers: { cookie: parent.cookies },
      });
      const parentText = await parentDashboard.text();
      expect(parentDashboard.status, parentText).toBe(200);
      const parentJson = JSON.parse(parentText);
      expect(parentJson.data.household.household_key).toBe(W12_PORTAL_TEST_LAB.householdKey);
      expect(parentJson.data.learners).toHaveLength(3);
      expect(parentJson.data.billing.grants_access).toBe(true);
      expect(JSON.stringify(parentJson)).not.toMatch(/https?:\/\/|zoom|vimeo|drive|meet/i);

      const learner = W12_PORTAL_TEST_LAB.learners[0];
      const resetAccess = await parentStudentAccessAction(server.baseUrl, parent, learner, 'reset');
      expect(resetAccess.status).toBe(200);
      expect((await resetAccess.json()).data).toMatchObject({
        status: 'reset_requested',
        credential_status: 'reset_required',
      });
      const suspendAccess = await parentStudentAccessAction(
        server.baseUrl,
        parent,
        learner,
        'suspend',
      );
      expect(suspendAccess.status).toBe(200);
      expect((await suspendAccess.json()).data.status).toBe('suspended');
      const restoreAccess = await parentStudentAccessAction(
        server.baseUrl,
        parent,
        learner,
        'restore',
      );
      expect(restoreAccess.status).toBe(200);
      expect((await restoreAccess.json()).data.status).toBe('active');

      const parentLaunch = await fetch(
        `${server.baseUrl}/api/v1/portals/parent/households/${W12_PORTAL_TEST_LAB.householdKey}/learners/${learner.learnerKey}/classes/${W12_PORTAL_TEST_LAB.occurrenceKey}/launch`,
        {
          method: 'POST',
          headers: { cookie: parent.cookies, 'x-csrf-token': parent.json.csrf_token },
        },
      );
      expect(parentLaunch.status).toBe(200);
      expect(JSON.stringify(await parentLaunch.json())).not.toMatch(
        /https?:\/\/|zoom|vimeo|drive|meet/i,
      );

      const parentHelper = await fetch(
        `${server.baseUrl}/api/v1/portals/parent/households/${
          W12_PORTAL_TEST_LAB.householdKey
        }/learners/${W12_PORTAL_TEST_LAB.learners[0].learnerKey}/helper/query`,
        {
          method: 'POST',
          headers: {
            cookie: parent.cookies,
            'content-type': 'application/json',
            'x-csrf-token': parent.json.csrf_token,
          },
          body: JSON.stringify({
            idempotency_key: 'w12-parent-helper-learner-one',
            question: 'What should this learner review from the Mishnah lesson?',
          }),
        },
      );
      const parentHelperJson = await parentHelper.json();
      expect(parentHelper.status, JSON.stringify(parentHelperJson)).toBe(200);
      expect(parentHelperJson.data).toMatchObject({
        abstained: false,
        provider_mode: 'provider_off',
        grounding_mode: 'approved_entitled_sections',
      });
      const crossHousehold = await fetch(
        `${server.baseUrl}/api/v1/portals/parent/households/not_authorized_household/learners/${
          W12_PORTAL_TEST_LAB.learners[0].learnerKey
        }/helper/query`,
        {
          method: 'POST',
          headers: {
            cookie: parent.cookies,
            'content-type': 'application/json',
            'x-csrf-token': parent.json.csrf_token,
          },
          body: JSON.stringify({
            idempotency_key: 'w12-parent-helper-cross-household',
            question: 'What should this learner review?',
          }),
        },
      );
      expect(crossHousehold.status).toBe(404);

      for (const current of W12_PORTAL_TEST_LAB.learners) {
        const student = await loginAs(server.baseUrl, current.email, current.defaultPassword);
        const dashboard = await fetch(`${server.baseUrl}/api/v1/portals/student/dashboard`, {
          headers: { cookie: student.cookies },
        });
        const dashboardJson = await dashboard.json();
        expect(dashboard.status).toBe(200);
        expect(dashboardJson.data.learner.learner_key).toBe(current.learnerKey);
        expect(dashboardJson.data.progress.attendance_count).toBe(1);
        expect(dashboardJson.data.rewards.balance).toBe(5);
        expect(dashboardJson.data.questions).toHaveLength(1);
        expect(dashboardJson.data.helper.available).toBe(true);
        for (const sibling of W12_PORTAL_TEST_LAB.learners) {
          if (sibling.learnerKey === current.learnerKey) continue;
          expect(JSON.stringify(dashboardJson)).not.toContain(sibling.learnerKey);
          expect(JSON.stringify(dashboardJson)).not.toContain(sibling.displayName);
        }

        const helper = await fetch(`${server.baseUrl}/api/v1/portals/student/helper/query`, {
          method: 'POST',
          headers: {
            cookie: student.cookies,
            'content-type': 'application/json',
            'x-csrf-token': student.json.csrf_token,
          },
          body: JSON.stringify({
            idempotency_key: `w12-helper-${current.learnerKey}`,
            question: 'What should I review from the Mishnah lesson?',
          }),
        });
        const helperJson = await helper.json();
        expect(helper.status, JSON.stringify(helperJson)).toBe(200);
        expect(helperJson.data.abstained).toBe(false);
        expect(helperJson.data.provider_mode).toBe('provider_off');
        expect(helperJson.data.grounding_mode).toBe('approved_entitled_sections');
        expect(JSON.stringify(helperJson)).not.toMatch(/https?:\/\/|zoom|vimeo|drive|meet/i);
      }
    } finally {
      await server.close();
    }
  });

  it('does not treat a learner entitlement household key as sibling access', async () => {
    const [entitledLearner, siblingLearner] = W12_PORTAL_TEST_LAB.learners;
    if (!entitledLearner || !siblingLearner) throw new Error('W12 learner fixtures are incomplete');
    await pool.query(
      `UPDATE onetime.content_item_entitlements
          SET entitlement_state = 'revoked',
              revoked_at = now()
        WHERE account_key = $1
          AND product_key = $2
          AND content_item_key = $3`,
      [config.accountKey, config.productKey, W12_PORTAL_TEST_LAB.recordingKey],
    );
    await pool.query(
      `INSERT INTO onetime.content_item_entitlements
         (entitlement_key, account_key, product_key, content_item_key, audience, household_key,
          learner_key, entitlement_state)
       VALUES
         ('w12_recording_learner_one_scope',$1,$2,$3,'learner',$4,$5,'active')`,
      [
        config.accountKey,
        config.productKey,
        W12_PORTAL_TEST_LAB.recordingKey,
        W12_PORTAL_TEST_LAB.householdKey,
        entitledLearner.learnerKey,
      ],
    );
    const stored = await pool.query(
      `SELECT audience, household_key, learner_key
         FROM onetime.content_item_entitlements
        WHERE account_key = $1
          AND product_key = $2
          AND entitlement_key = 'w12_recording_learner_one_scope'`,
      [config.accountKey, config.productKey],
    );
    expect(stored.rows[0]).toMatchObject({
      audience: 'learner',
      household_key: W12_PORTAL_TEST_LAB.householdKey,
      learner_key: entitledLearner.learnerKey,
    });

    const server = await listenForTest(createApp({ config, pool, distDir }));
    try {
      const entitledSession = await loginAs(
        server.baseUrl,
        entitledLearner.email,
        entitledLearner.defaultPassword,
      );
      const entitledResponse = await queryStudentHelper({
        baseUrl: server.baseUrl,
        session: entitledSession,
        idempotencyKey: 'w12-learner-one-exact-entitlement',
      });
      expect(entitledResponse.status, JSON.stringify(entitledResponse.body)).toBe(200);
      expect(entitledResponse.body.data).toMatchObject({
        abstained: false,
        safe_reason_code: 'supported_by_approved_section',
        provider_mode: 'provider_off',
      });
      expect(entitledResponse.body.data.citations).toHaveLength(1);
      expect(entitledResponse.body.data.citations[0]?.content_id).toBe(
        W12_PORTAL_TEST_LAB.recordingKey,
      );

      const siblingSession = await loginAs(
        server.baseUrl,
        siblingLearner.email,
        siblingLearner.defaultPassword,
      );
      const siblingResponse = await queryStudentHelper({
        baseUrl: server.baseUrl,
        session: siblingSession,
        idempotencyKey: 'w12-learner-two-sibling-denial',
      });
      expect(siblingResponse.status, JSON.stringify(siblingResponse.body)).toBe(200);
      expect(siblingResponse.body.data).toMatchObject({
        abstained: true,
        safe_reason_code: 'not_entitled',
        citations: [],
        source_refs: [],
        provider_mode: 'provider_off',
      });
      const siblingPayload = JSON.stringify(siblingResponse.body);
      for (const forbidden of [
        W12_PORTAL_TEST_LAB.recordingKey,
        W12_PORTAL_TEST_LAB.helperVersionId,
        'w12_section_001',
        'W12 fictional review section',
        entitledLearner.learnerKey,
        entitledLearner.displayName,
      ]) {
        expect(siblingPayload).not.toContain(forbidden);
      }
    } finally {
      await server.close();
    }
  });

  it('fails closed when approved entitled helper rows contain protected provider material', async () => {
    const server = await listenForTest(createApp({ config, pool, distDir }));
    try {
      const students = await Promise.all(
        W12_PORTAL_TEST_LAB.learners.map((learner) =>
          loginAs(server.baseUrl, learner.email, learner.defaultPassword),
        ),
      );
      const tenantId = config.accountKey;
      const bodyPatterns = [
        'https://zoom.us/j/123456789?pwd=forbidden-value',
        'zoom.us/j/123456789?pwd=forbidden-value',
        '//us02web.zoom.us/j/123456789',
        'https://player.vimeo.com/video/123456?h=forbidden-value',
        'player.vimeo.com/video/123456',
        'API key forbidden-value',
        'passcode 123456',
        '?token=forbidden-value',
      ];
      for (const [index, unsafeValue] of bodyPatterns.entries()) {
        await pool.query(
          `UPDATE onetime.ot86_search_documents
              SET body = $4,
                  updated_at = now()
            WHERE tenant_id = $1
              AND content_id = $2
              AND version_id = $3`,
          [
            tenantId,
            W12_PORTAL_TEST_LAB.recordingKey,
            W12_PORTAL_TEST_LAB.helperVersionId,
            `This fictional Mishnah lesson is approved for review. ${unsafeValue}`,
          ],
        );
        await expectUnsafeHelperResponse({
          baseUrl: server.baseUrl,
          session: students[0]!,
          learnerIndex: 0,
          idempotencyKey: `w12-unsafe-body-${index}`,
        });
      }

      await pool.query(
        `UPDATE onetime.ot86_search_documents
            SET body = 'This fictional Mishnah lesson is approved for review.',
                updated_at = now()
          WHERE tenant_id = $1
            AND content_id = $2
            AND version_id = $3`,
        [tenantId, W12_PORTAL_TEST_LAB.recordingKey, W12_PORTAL_TEST_LAB.helperVersionId],
      );
      const titlePatterns = [
        'Review at https://zoom.us/j/123456789',
        'Review at zoom.us/j/123456789',
        'Review at player.vimeo.com/video/123456',
        'Lesson API key forbidden-value',
        'Lesson passcode 123456',
      ];
      for (const [index, unsafeTitle] of titlePatterns.entries()) {
        await Promise.all([
          pool.query(
            `UPDATE onetime.ot86_search_documents
                SET title = $4,
                    updated_at = now()
              WHERE tenant_id = $1
                AND content_id = $2
                AND version_id = $3`,
            [
              tenantId,
              W12_PORTAL_TEST_LAB.recordingKey,
              W12_PORTAL_TEST_LAB.helperVersionId,
              unsafeTitle,
            ],
          ),
          pool.query(
            `UPDATE onetime.ot86_published_sections
                SET title = $4
              WHERE tenant_id = $1
                AND content_id = $2
                AND version_id = $3`,
            [
              tenantId,
              W12_PORTAL_TEST_LAB.recordingKey,
              W12_PORTAL_TEST_LAB.helperVersionId,
              unsafeTitle,
            ],
          ),
        ]);
        await expectUnsafeHelperResponse({
          baseUrl: server.baseUrl,
          session: students[1]!,
          learnerIndex: 1,
          idempotencyKey: `w12-unsafe-title-${index}`,
        });
      }

      await Promise.all([
        pool.query(
          `UPDATE onetime.ot86_search_documents
              SET title = 'W12 fictional review section',
                  updated_at = now()
            WHERE tenant_id = $1
              AND content_id = $2
              AND version_id = $3`,
          [tenantId, W12_PORTAL_TEST_LAB.recordingKey, W12_PORTAL_TEST_LAB.helperVersionId],
        ),
        pool.query(
          `UPDATE onetime.ot86_published_sections
              SET title = 'W12 fictional review section'
            WHERE tenant_id = $1
              AND content_id = $2
              AND version_id = $3`,
          [tenantId, W12_PORTAL_TEST_LAB.recordingKey, W12_PORTAL_TEST_LAB.helperVersionId],
        ),
      ]);
      for (const [index, unsafeDeepLink] of [
        '/app/admin#section-private',
        '/library/classes/w12?api_key=forbidden-value#section-w12',
      ].entries()) {
        await pool.query(
          `UPDATE onetime.ot86_published_sections
              SET deep_link = $4
            WHERE tenant_id = $1
              AND content_id = $2
              AND version_id = $3`,
          [
            tenantId,
            W12_PORTAL_TEST_LAB.recordingKey,
            W12_PORTAL_TEST_LAB.helperVersionId,
            unsafeDeepLink,
          ],
        );
        await expectUnsafeHelperResponse({
          baseUrl: server.baseUrl,
          session: students[2]!,
          learnerIndex: 2,
          idempotencyKey: `w12-unsafe-deep-link-${index}`,
        });
      }
    } finally {
      await server.close();
    }
  });

  it('enforces one database-backed helper budget across independent adapter instances', async () => {
    const first = createDbStudentClassHelperRateLimitStore(pool, config);
    const second = createDbStudentClassHelperRateLimitStore(pool, config);
    const request = {
      accountKey: config.accountKey,
      productKey: config.productKey,
      principalKey: 'scoped_parent_learner_principal',
      learnerKey: W12_PORTAL_TEST_LAB.learners[0].learnerKey,
      now: new Date('2026-07-24T12:00:00.000Z'),
    };
    for (let index = 0; index < 10; index += 1) {
      await (index % 2 === 0 ? first : second).assertAllowed(request);
    }
    await expect(second.assertAllowed(request)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });
});

async function parentStudentAccessAction(
  baseUrl: string,
  parent: Awaited<ReturnType<typeof loginAs>>,
  learner: (typeof W12_PORTAL_TEST_LAB.learners)[number],
  action: 'reset' | 'suspend' | 'restore',
) {
  return fetch(
    `${baseUrl}/api/v1/portals/parent/households/${W12_PORTAL_TEST_LAB.householdKey}/learners/${learner.learnerKey}/student-access/${action}`,
    {
      method: 'POST',
      headers: {
        cookie: parent.cookies,
        'content-type': 'application/json',
        'x-csrf-token': parent.json.csrf_token,
      },
      body: JSON.stringify({
        idempotency_key: `w12-${action}-${learner.learnerKey}`,
      }),
    },
  );
}

async function expectUnsafeHelperResponse(input: {
  baseUrl: string;
  session: Awaited<ReturnType<typeof loginAs>>;
  learnerIndex: number;
  idempotencyKey: string;
}) {
  const response = await fetch(`${input.baseUrl}/api/v1/portals/student/helper/query`, {
    method: 'POST',
    headers: {
      cookie: input.session.cookies,
      'content-type': 'application/json',
      'x-csrf-token': input.session.json.csrf_token,
    },
    body: JSON.stringify({
      idempotency_key: input.idempotencyKey,
      question: 'What should I review from this fictional Mishnah lesson?',
    }),
  });
  const body = await response.json();
  expect(response.status, JSON.stringify(body)).toBe(200);
  expect(body.data).toMatchObject({
    answer:
      "I couldn't find that in Rabbi Scheller's approved class material. Try asking about this lesson, or send a private question.",
    abstained: true,
    safe_reason_code: 'unsafe_source_content',
    citations: [],
    source_refs: [],
    provider_mode: 'provider_off',
  });
  const serialized = JSON.stringify(body);
  expect(serialized).not.toMatch(
    /forbidden-value|(?:https?:)?\/\/|zoom\.us|vimeo\.com|api[_ ]?key|passcode\s*[:=]?\s*\d|[?&]token=/i,
  );
  for (const [index, learner] of W12_PORTAL_TEST_LAB.learners.entries()) {
    if (index === input.learnerIndex) continue;
    expect(serialized).not.toContain(learner.learnerKey);
    expect(serialized).not.toContain(learner.displayName);
  }
}

async function queryStudentHelper(input: {
  baseUrl: string;
  session: Awaited<ReturnType<typeof loginAs>>;
  idempotencyKey: string;
}) {
  const response = await fetch(`${input.baseUrl}/api/v1/portals/student/helper/query`, {
    method: 'POST',
    headers: {
      cookie: input.session.cookies,
      'content-type': 'application/json',
      'x-csrf-token': input.session.json.csrf_token,
    },
    body: JSON.stringify({
      idempotency_key: input.idempotencyKey,
      question: 'What should I review from this fictional Mishnah lesson?',
    }),
  });
  return { status: response.status, body: await response.json() };
}

async function writePortalShells(targetDir: string) {
  await mkdir(path.join(targetDir, 'app'), { recursive: true });
  await mkdir(path.join(targetDir, 'assets'), { recursive: true });
  await writeFile(path.join(targetDir, 'app', 'parent.html'), '<div id="portal-root"></div>');
  await writeFile(path.join(targetDir, 'app', 'student.html'), '<div id="portal-root"></div>');
  await writeFile(path.join(targetDir, 'app', 'crm.html'), '<div id="crm-root"></div>');
  await writeFile(path.join(targetDir, '404.html'), '<h1>Not found</h1>');
  await writeFile(path.join(targetDir, 'assets', 'app-crm.css'), '');
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

async function loginAs(baseUrl: string, email: string, password: string) {
  const csrf = await getLoginCsrf(baseUrl);
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      cookie: csrf.cookies,
      'content-type': 'application/json',
      'x-csrf-token': csrf.token,
    },
    body: JSON.stringify({ email, password, csrf_token: csrf.token }),
  });
  const text = await response.text();
  if (response.status === 403) {
    const challenge = JSON.parse(text) as { code?: string; challenge_token?: string };
    expect(challenge.code).toBe('EMAIL_CHALLENGE_REQUIRED');
    expect(challenge.challenge_token).toBeTruthy();
    const payload = await latestEmailChallengePayload();
    const verified = await fetch(`${baseUrl}/api/v1/auth/email-challenge/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        challenge_token: challenge.challenge_token,
        code: String(payload.code),
      }),
    });
    const verifiedText = await verified.text();
    expect(verified.status, verifiedText).toBe(200);
    return {
      cookies: mergeCookies(csrf.cookies, cookieHeader(verified.headers)),
      json: JSON.parse(verifiedText) as { csrf_token: string },
    };
  }
  expect(response.status, text).toBe(200);
  return {
    cookies: mergeCookies(csrf.cookies, cookieHeader(response.headers)),
    json: JSON.parse(text) as { csrf_token: string },
  };
}

async function latestEmailChallengePayload() {
  const result = await pool.query(
    `SELECT nonce, ciphertext, auth_tag
       FROM onetime.auth_email_challenge_delivery_outbox
      WHERE nonce IS NOT NULL
        AND ciphertext IS NOT NULL
        AND auth_tag IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1`,
  );
  const row = result.rows[0];
  if (!row) throw new Error('missing auth email challenge payload');
  return decryptAuthEmailChallengeDeliveryPayloadForTests(config, {
    nonce: String(row.nonce),
    ciphertext: String(row.ciphertext),
    auth_tag: String(row.auth_tag),
  });
}

async function getLoginCsrf(baseUrl: string) {
  const page = await fetch(`${baseUrl}/login`);
  const html = await page.text();
  const token = html.match(/name="csrf_token" value="([^"]+)"/)?.[1];
  if (!token) throw new Error('missing csrf token');
  return { token, cookies: cookieHeader(page.headers) };
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
