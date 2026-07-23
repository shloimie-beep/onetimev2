import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import { createApp } from '../../../apps/web/src/server/app.ts';
import { createAccountUser, createSession } from '../../../packages/domain/src/index.ts';

type TestSession = Awaited<ReturnType<typeof createSession>>;

let config: AppConfig;
let pool: DbPool;
let server: ReturnType<ReturnType<typeof createApp>['listen']>;
let baseUrl: string;

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
  await seedPortalFamilies();
  const app = createApp({ config, pool });
  server = await new Promise<ReturnType<ReturnType<typeof createApp>['listen']>>(
    (resolve, reject) => {
      const started = app.listen(0, (error?: Error) => {
        if (error) reject(error);
        else resolve(started);
      });
    },
  );
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('missing test server address');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
});

describe('W12-100-01 portal authorization and isolation boundaries', () => {
  it('prevents parent cross-household reads and writes without revealing the target household', async () => {
    const parentAlpha = await sessionFor('parent-alpha@example.test', 'parent');

    const ownDashboard = await fetch(
      `${baseUrl}/api/v1/portals/parent/households/household_alpha/dashboard`,
      { headers: { cookie: authCookies(parentAlpha) } },
    );
    expect(ownDashboard.status).toBe(200);
    const ownJson = (await ownDashboard.json()) as {
      data: { household: { household_key: string } };
    };
    expect(ownJson.data.household.household_key).toBe('household_alpha');

    const crossRead = await fetch(
      `${baseUrl}/api/v1/portals/parent/households/household_beta/dashboard`,
      { headers: { cookie: authCookies(parentAlpha) } },
    );
    expect(crossRead.status).toBe(404);
    const crossReadText = JSON.stringify(await crossRead.json());
    expect(crossReadText).not.toContain('Beta Family');

    const crossWrite = await fetch(
      `${baseUrl}/api/v1/portals/parent/households/household_beta/learners`,
      {
        method: 'POST',
        headers: {
          cookie: authCookies(parentAlpha),
          'content-type': 'application/json',
          'x-csrf-token': parentAlpha.csrf_token,
        },
        body: JSON.stringify({
          idempotency_key: 'cross-household-create-001',
          display_name: 'Illicit Learner',
        }),
      },
    );
    expect(crossWrite.status).toBe(404);
    const learners = await pool.query(
      `SELECT count(*)::int AS count
         FROM onetime.portal_learners
        WHERE household_key = 'household_beta'
          AND display_name = 'Illicit Learner'`,
    );
    expect(Number(learners.rows[0]?.count ?? 0)).toBe(0);
  });

  it('keeps student and sibling state isolated while enforcing CSRF and same-origin writes', async () => {
    const studentAlpha = await sessionFor('student-alpha@example.test', 'student');
    const studentBeta = await sessionFor('student-beta@example.test', 'student');

    const parentEndpointWithStudentSession = await fetch(
      `${baseUrl}/api/v1/portals/parent/households/household_alpha/dashboard`,
      { headers: { cookie: authCookies(studentAlpha) } },
    );
    expect(parentEndpointWithStudentSession.status).toBe(403);

    const missingCsrf = await fetch(`${baseUrl}/api/v1/portals/student/questions`, {
      method: 'POST',
      headers: {
        cookie: authCookies(studentAlpha),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        idempotency_key: 'student-question-no-csrf',
        question: 'Will this write without CSRF?',
      }),
    });
    expect(missingCsrf.status).toBe(403);
    expect(await missingCsrf.json()).toMatchObject({ code: 'CSRF_REQUIRED' });

    const crossOrigin = await fetch(`${baseUrl}/api/v1/portals/student/questions`, {
      method: 'POST',
      headers: {
        cookie: authCookies(studentAlpha),
        origin: 'https://evil.example',
        'content-type': 'application/json',
        'x-csrf-token': studentAlpha.csrf_token,
      },
      body: JSON.stringify({
        idempotency_key: 'student-question-cross-origin',
        question: 'Will this write from a hostile origin?',
      }),
    });
    expect(crossOrigin.status).toBe(403);
    expect(await crossOrigin.json()).toMatchObject({ code: 'CSRF_REQUIRED' });

    const submitted = await fetch(`${baseUrl}/api/v1/portals/student/questions`, {
      method: 'POST',
      headers: {
        cookie: authCookies(studentAlpha),
        'content-type': 'application/json',
        'x-csrf-token': studentAlpha.csrf_token,
      },
      body: JSON.stringify({
        idempotency_key: 'student-question-alpha-001',
        question: 'What should I review tonight?',
        class_key: 'class_alpha',
      }),
    });
    expect(submitted.status).toBe(201);

    const alphaQuestions = await fetch(`${baseUrl}/api/v1/portals/student/questions`, {
      headers: { cookie: authCookies(studentAlpha) },
    });
    expect(alphaQuestions.status).toBe(200);
    expect(JSON.stringify(await alphaQuestions.json())).toContain('What should I review tonight?');

    const betaQuestions = await fetch(`${baseUrl}/api/v1/portals/student/questions`, {
      headers: { cookie: authCookies(studentBeta) },
    });
    expect(betaQuestions.status).toBe(200);
    expect(JSON.stringify(await betaQuestions.json())).not.toContain(
      'What should I review tonight?',
    );
  });
});

async function seedPortalFamilies() {
  const parentAlphaKey = await createAccountUser({
    pool,
    config,
    email: 'parent-alpha@example.test',
    password: 'ParentAlpha!234',
    displayName: 'Parent Alpha',
    role: 'parent',
  });
  const parentBetaKey = await createAccountUser({
    pool,
    config,
    email: 'parent-beta@example.test',
    password: 'ParentBeta!234',
    displayName: 'Parent Beta',
    role: 'parent',
  });
  const studentAlphaKey = await createAccountUser({
    pool,
    config,
    email: 'student-alpha@example.test',
    password: 'StudentAlpha!234',
    displayName: 'Student Alpha',
    role: 'student',
  });
  const studentBetaKey = await createAccountUser({
    pool,
    config,
    email: 'student-beta@example.test',
    password: 'StudentBeta!234',
    displayName: 'Student Beta',
    role: 'student',
  });

  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name)
     VALUES
       ('household_alpha', $1, $2, 'Alpha Family'),
       ('household_beta', $1, $2, 'Beta Family')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.account_access_projections
       (access_key, account_key, product_key, household_key, state, source_kind,
        effective_at, expires_at, opaque_source_reference, source_revision,
        source_updated_at, source_request_hash, policy_version, last_event_key)
     VALUES
       ('portal_isolation_access_alpha',$1,$2,'household_alpha','active','free_pilot',
        now() - interval '1 hour',now() + interval '30 days',
        'portal_isolation_alpha_free_pilot',1,now(),$3,
        'portal-isolation-access-v1','portal_isolation_access_alpha_seed'),
       ('portal_isolation_access_beta',$1,$2,'household_beta','active','free_pilot',
        now() - interval '1 hour',now() + interval '30 days',
        'portal_isolation_beta_free_pilot',1,now(),$4,
        'portal-isolation-access-v1','portal_isolation_access_beta_seed')`,
    [config.accountKey, config.productKey, 'd'.repeat(64), 'e'.repeat(64)],
  );
  await pool.query(
    `INSERT INTO onetime.portal_guardian_relationships
       (relationship_key, account_key, product_key, household_key, guardian_user_ref,
        relationship_label, authority)
     VALUES
       ('relationship_alpha', $1, $2, 'household_alpha', $3, 'Parent', 'primary_guardian'),
       ('relationship_beta', $1, $2, 'household_beta', $4, 'Parent', 'primary_guardian')`,
    [config.accountKey, config.productKey, parentAlphaKey, parentBetaKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_learners
       (learner_key, account_key, product_key, household_key, display_name)
     VALUES
       ('learner_alpha', $1, $2, 'household_alpha', 'Learner Alpha'),
       ('learner_beta', $1, $2, 'household_beta', 'Learner Beta')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_student_access_state
       (access_state_key, account_key, product_key, household_key, learner_key, student_user_ref,
        status)
     VALUES
       ('access_alpha', $1, $2, 'household_alpha', 'learner_alpha', $3, 'active'),
       ('access_beta', $1, $2, 'household_beta', 'learner_beta', $4, 'active')`,
    [config.accountKey, config.productKey, studentAlphaKey, studentBetaKey],
  );
  await pool.query(
    `INSERT INTO onetime.account_learner_identity_links
       (link_key, account_key, product_key, household_key, learner_key, user_key)
     VALUES
       ('link_alpha', $1, $2, 'household_alpha', 'learner_alpha', $3),
       ('link_beta', $1, $2, 'household_beta', 'learner_beta', $4)`,
    [config.accountKey, config.productKey, studentAlphaKey, studentBetaKey],
  );
}

async function sessionFor(email: string, role: 'parent' | 'student') {
  const result = await pool.query(
    `SELECT user_key, email_normalized, display_name, role, mfa_capable
       FROM onetime.account_users
      WHERE email_normalized = $1
      LIMIT 1`,
    [email],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error(`missing user ${email}`);
  return createSession({
    pool,
    config,
    user: {
      user_key: String(row.user_key),
      email: String(row.email_normalized),
      display_name: String(row.display_name),
      role,
      role_label: role === 'parent' ? 'Parent' : 'Student',
      mfa_capable: Boolean(row.mfa_capable),
    },
  });
}

function authCookies(session: TestSession) {
  return `otcrm_session=${session.session_token}; otcrm_csrf=${session.csrf_token}`;
}
