import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import { createApp } from '../../../apps/web/src/server/app.ts';
import {
  createAccountUser,
  createOwnerAdminInvitation,
  createParentActivation,
  createSession,
  createStudentSetup,
  decryptLifecycleDeliveryPayloadForTests,
  getSessionByToken,
  grantFreePilotAccess,
} from '../../../packages/domain/src/index.ts';

let pool: DbPool;
let appConfig: AppConfig;
let server: ReturnType<ReturnType<typeof createApp>['listen']>;
let baseUrl: string;
let ownerUserKey: string;

beforeEach(async () => {
  appConfig = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    OUTBOX_TRANSPORT_MODE: 'sink',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
  ownerUserKey = await createAccountUser({
    pool,
    config: appConfig,
    email: 'owner-web@example.test',
    password: 'OwnerPass!234',
    displayName: 'Owner Web',
    role: 'owner',
    mfaCapable: true,
  });
  const app = createApp({ config: appConfig, pool });
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (error?: Error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('missing test server address');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
});

describe('OPS-03B email step-up account lifecycle web flow', () => {
  it('serves noindexed auth pages and removes prompt-based MFA from public client code', async () => {
    for (const route of ['/login', '/activate', '/forgot-password', '/reset-password']) {
      const response = await fetch(`${baseUrl}${route}`);
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(response.headers.get('x-robots-tag')).toContain('noindex');
    }
    const login = await fetch(`${baseUrl}/login`);
    const html = await login.text();
    expect(html).toContain('Welcome back');
    expect(html).toContain('Forgot password?');
    expect(html).not.toContain('<small>CRM</small>');

    const clientSource = await readFile('apps/web/src/client/public/public-entry.ts', 'utf8');
    expect(clientSource).not.toContain('window.prompt');
    expect(clientSource).toContain('window.history.replaceState');
    expect(clientSource).not.toMatch(/localStorage|sessionStorage/);
    expect(clientSource).not.toMatch(/auth\/mfa|account-lifecycle\/mfa|totp_code/);
    expect(clientSource).toContain("fetch('/health'");
    expect(clientSource).not.toContain('fetch(window.location.pathname');
    expect(clientSource).toContain("response.json.token_type === 'student_reset'");
    expect(clientSource).toContain("studentReset ? 'Reset PIN' : 'Set PIN'");
    expect(clientSource).toContain("studentReset ? 'Student PIN reset' : 'Student account setup'");
    const activation = await fetch(`${baseUrl}/activate`);
    const activationHtml = await activation.text();
    expect(activationHtml).toContain('data-activation-context');
    expect(activationHtml).toContain('data-activation-submit');
  });

  it('activates an owner/admin invite directly after password setup', async () => {
    const issued = await createOwnerAdminInvitation({
      pool,
      config: appConfig,
      actor: { userKey: ownerUserKey, role: 'owner' },
      includeLocalProofToken: true,
      payload: {
        idempotency_key: 'web-admin-activation-001',
        email: 'new.admin@example.test',
        display_name: 'New Admin',
        role: 'admin',
      },
    });
    const token = requiredToken(issued);
    const activationPage = await getCsrf('/activate');

    const status = await postJson('/api/v1/account-lifecycle/token-status', {
      token,
      flow: 'activation',
    });
    expect(status.response.status).toBe(200);
    expect(status.json).toMatchObject({
      success: true,
      token_type: 'owner_admin_invitation',
      mfa_required: false,
    });
    expect(JSON.stringify(status.json)).not.toContain(token);

    const tooShortPasswordRejectedForAdult = await postJson(
      '/api/v1/account-lifecycle/activate',
      { token, password: '12345', csrf_token: activationPage.token },
      activationPage.cookies,
    );
    expect(tooShortPasswordRejectedForAdult.response.status).toBe(400);

    const activated = await postJson(
      '/api/v1/account-lifecycle/activate',
      {
        token,
        password: 'Ab1234',
        csrf_token: activationPage.token,
      },
      activationPage.cookies,
    );
    expect(activated.response.status).toBe(200);
    expect(activated.json).toMatchObject({
      success: true,
      mfa_required: false,
      return_to: '/app/dashboard',
    });
    const cookies = mergeCookies(activationPage.cookies, cookieHeader(activated.response.headers));
    expect(cookies).toContain('otcrm_session=');
    expect(JSON.stringify(activated.json)).not.toContain(token);

    const session = await fetch(`${baseUrl}/api/v1/auth/session`, { headers: { cookie: cookies } });
    expect(session.status).toBe(200);

    const replay = await postJson('/api/v1/account-lifecycle/token-status', {
      token,
      flow: 'activation',
    });
    expect(replay.response.status).toBe(410);
    expect(replay.json).toMatchObject({ code: 'TOKEN_CONSUMED' });
  });

  it('activates a Student with an exact six-digit PIN at the mounted HTTP boundary', async () => {
    await pool.query(
      `INSERT INTO onetime.portal_households
         (household_key, account_key, product_key, display_name)
       VALUES ('web_student_household',$1,$2,'Web Student Household')`,
      [appConfig.accountKey, appConfig.productKey],
    );
    await pool.query(
      `INSERT INTO onetime.portal_learners
         (learner_key, account_key, product_key, household_key, display_name)
       VALUES ('web_student_learner',$1,$2,'web_student_household','Web Student')`,
      [appConfig.accountKey, appConfig.productKey],
    );
    await pool.query(
      `INSERT INTO onetime.portal_student_access_state
         (access_state_key, account_key, product_key, household_key, learner_key, status)
       VALUES ('web_student_access',$1,$2,'web_student_household',
               'web_student_learner','not_configured')`,
      [appConfig.accountKey, appConfig.productKey],
    );
    const now = new Date();
    await grantFreePilotAccess({
      pool,
      accountKey: appConfig.accountKey,
      productKey: appConfig.productKey,
      actorKind: 'admin',
      now,
      command: {
        household_key: 'web_student_household',
        idempotency_key: 'web-student-activation-free-pilot',
        effective_at: now.toISOString(),
        expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1_000).toISOString(),
        policy_version: 'account-lifecycle-web-student-free-pilot-v1',
        opaque_source_reference: 'account_lifecycle_web_student_activation',
      },
    });

    const issued = await createStudentSetup({
      pool,
      config: appConfig,
      actor: { userKey: ownerUserKey, role: 'owner' },
      includeLocalProofToken: true,
      payload: {
        idempotency_key: 'web-student-activation-001',
        email: 'web.student@example.test',
        display_name: 'Web Student',
        household_key: 'web_student_household',
        learner_key: 'web_student_learner',
      },
    });
    const token = requiredToken(issued);
    const activationPage = await getCsrf('/activate');
    const status = await postJson('/api/v1/account-lifecycle/token-status', {
      token,
      flow: 'activation',
    });
    expect(status.response.status).toBe(200);
    expect(status.json).toMatchObject({ token_type: 'student_setup' });

    for (const password of ['12345', '1234567', '12a456', '１２３４５６']) {
      const invalid = await postJson(
        '/api/v1/account-lifecycle/activate',
        { token, password, csrf_token: activationPage.token },
        activationPage.cookies,
      );
      expect(invalid.response.status).toBe(400);
    }

    const activated = await postJson(
      '/api/v1/account-lifecycle/activate',
      { token, password: '000123', csrf_token: activationPage.token },
      activationPage.cookies,
    );
    expect(activated.response.status).toBe(200);
    expect(activated.json).toMatchObject({
      success: true,
      return_to: '/app/student',
    });
    const login = await loginViaApi('web.student@example.test', '000123');
    expect(login.response.status).toBe(200);
  });

  it('completes Parent activation into a safe paused session when access is absent', async () => {
    await pool.query(
      `INSERT INTO onetime.portal_households
         (household_key, account_key, product_key, display_name)
       VALUES ('activation_without_access',$1,$2,'Activation Without Access')`,
      [appConfig.accountKey, appConfig.productKey],
    );
    const issued = await createParentActivation({
      pool,
      config: appConfig,
      actor: { userKey: ownerUserKey, role: 'owner' },
      includeLocalProofToken: true,
      payload: {
        idempotency_key: 'web-parent-no-access-001',
        email: 'no-access.parent@example.test',
        display_name: 'No Access Parent',
        household_key: 'activation_without_access',
        relationship_key: 'activation_without_access_parent',
        relationship_label: 'Parent',
        authority: 'primary_guardian',
      },
    });
    const activationPage = await getCsrf('/activate');
    const activated = await postJson(
      '/api/v1/account-lifecycle/activate',
      {
        token: requiredToken(issued),
        password: 'NoAccessParent!234',
        csrf_token: activationPage.token,
      },
      activationPage.cookies,
    );

    expect(activated.response.status).toBe(200);
    expect(activated.json).toMatchObject({
      success: true,
      return_to: '/app/parent',
    });
    expect(cookieHeader(activated.response.headers)).toContain('otcrm_session=');
    const relationship = await pool.query(
      `SELECT status, guardian_user_ref
         FROM onetime.portal_guardian_relationships
        WHERE relationship_key = 'activation_without_access_parent'`,
    );
    expect(relationship.rows[0]).toMatchObject({
      status: 'active',
    });
    expect(String(relationship.rows[0]?.guardian_user_ref)).toBeTruthy();
  });

  it('keeps generic password recovery adult-only for every Student identity', async () => {
    const studentUserKey = await createAccountUser({
      pool,
      config: appConfig,
      email: 'student-recovery@example.test',
      password: 'StudentLegacy!234',
      displayName: 'Student Recovery',
      role: 'student',
      mfaCapable: false,
    });
    const studentSession = await createSession({
      pool,
      config: appConfig,
      user: {
        user_key: studentUserKey,
        email: 'student-recovery@example.test',
        display_name: 'Student Recovery',
        role: 'student',
        role_label: 'Student',
        mfa_capable: false,
      },
    });
    const passwordBefore = await pool.query(
      `SELECT password_hash
         FROM onetime.account_users
        WHERE user_key = $1`,
      [studentUserKey],
    );
    const beforeStudentRequest = await pool.query(
      `SELECT
         (SELECT count(*) FROM onetime.account_lifecycle_tokens) AS token_count,
         (SELECT count(*) FROM onetime.account_lifecycle_delivery_outbox) AS outbox_count`,
    );
    const forgotPage = await getCsrf('/forgot-password');
    const studentRequest = await postJson(
      '/api/v1/account-lifecycle/forgot-password',
      {
        email: 'student-recovery@example.test',
        csrf_token: forgotPage.token,
        idempotency_key: 'forgot-student-managed-001',
      },
      forgotPage.cookies,
    );
    const missingRequest = await postJson(
      '/api/v1/account-lifecycle/forgot-password',
      {
        email: 'missing-student-recovery@example.test',
        csrf_token: forgotPage.token,
        idempotency_key: 'forgot-student-missing-001',
      },
      forgotPage.cookies,
    );
    expect(studentRequest.response.status).toBe(200);
    expect(missingRequest.response.status).toBe(200);
    expect(studentRequest.json.message).toBe(missingRequest.json.message);
    const afterStudentRequest = await pool.query(
      `SELECT
         (SELECT count(*) FROM onetime.account_lifecycle_tokens) AS token_count,
         (SELECT count(*) FROM onetime.account_lifecycle_delivery_outbox) AS outbox_count`,
    );
    expect(afterStudentRequest.rows[0]).toEqual(beforeStudentRequest.rows[0]);
    const suppressionAudit = await pool.query(
      `SELECT action_type, subject_user_key, metadata
         FROM onetime.account_lifecycle_audit_events
        WHERE action_type = 'password_reset_requested_student_suppressed'
          AND subject_user_key = $1`,
      [studentUserKey],
    );
    expect(suppressionAudit.rows).toEqual([
      expect.objectContaining({
        action_type: 'password_reset_requested_student_suppressed',
        subject_user_key: studentUserKey,
        metadata: {
          target_role: 'student',
          token_issued: false,
          delivery_queued: false,
        },
      }),
    ]);
    expect(JSON.stringify(suppressionAudit.rows)).not.toContain('student-recovery@example.test');
    expect(JSON.stringify(suppressionAudit.rows)).not.toContain('StudentLegacy!234');

    const ownerRequest = await postJson(
      '/api/v1/account-lifecycle/forgot-password',
      {
        email: 'owner-web@example.test',
        csrf_token: forgotPage.token,
        idempotency_key: 'forgot-owner-forged-student-001',
      },
      forgotPage.cookies,
    );
    expect(ownerRequest.response.status).toBe(200);
    const legacyResetToken = await latestPasswordResetToken();
    const tokenRow = await pool.query(
      `SELECT token_key
         FROM onetime.account_lifecycle_tokens
        WHERE token_type = 'password_reset'
        ORDER BY created_at DESC
        LIMIT 1`,
    );
    const tokenKey = String(tokenRow.rows[0]?.token_key);
    await pool.query(
      `UPDATE onetime.account_lifecycle_tokens
          SET target_role = 'student',
              subject_user_key = $1,
              subject_human_account_id = NULL,
              email_normalized = 'student-recovery@example.test'
        WHERE token_key = $2`,
      [studentUserKey, tokenKey],
    );

    const resetPage = await getCsrf('/reset-password');
    const rejected = await postJson(
      '/api/v1/account-lifecycle/reset-password',
      {
        token: legacyResetToken,
        password: 'StudentAdultBypass!999',
        csrf_token: resetPage.token,
      },
      resetPage.cookies,
    );
    expect(rejected.response.status).toBe(400);
    expect(rejected.json).toMatchObject({ code: 'TOKEN_INVALID' });
    const readback = await pool.query(
      `SELECT consumed_at
         FROM onetime.account_lifecycle_tokens
        WHERE token_key = $1`,
      [tokenKey],
    );
    expect(readback.rows[0]?.consumed_at).toBeNull();
    const passwordAfter = await pool.query(
      `SELECT password_hash
         FROM onetime.account_users
        WHERE user_key = $1`,
      [studentUserKey],
    );
    expect(passwordAfter.rows).toEqual(passwordBefore.rows);
    const sessionReadback = await pool.query(
      `SELECT revoked_at
         FROM onetime.user_sessions
        WHERE session_key = $1`,
      [studentSession.session_key],
    );
    expect(sessionReadback.rows).toEqual([expect.objectContaining({ revoked_at: null })]);
    const invalidationReadback = await pool.query(
      `SELECT count(*)::int AS count
         FROM onetime.account_lifecycle_session_invalidations
        WHERE user_key = $1`,
      [studentUserKey],
    );
    expect(invalidationReadback.rows[0]?.count).toBe(0);
  });

  it('uses generic forgot-password responses and reset links revoke prior sessions', async () => {
    const parentUserKey = await createAccountUser({
      pool,
      config: appConfig,
      email: 'reset.parent@example.test',
      password: 'ParentWebPass!234',
      displayName: 'Reset Parent',
      role: 'parent',
      mfaCapable: false,
    });
    await pool.query(
      `INSERT INTO onetime.portal_households
         (household_key, account_key, product_key, display_name)
       VALUES ('reset_parent_household',$1,$2,'Reset Parent Household')`,
      [appConfig.accountKey, appConfig.productKey],
    );
    await pool.query(
      `INSERT INTO onetime.portal_guardian_relationships
         (relationship_key, account_key, product_key, household_key, guardian_user_ref,
          relationship_label, authority)
       VALUES ('reset_parent_relationship',$1,$2,'reset_parent_household',$3,
          'Parent','primary_guardian')`,
      [appConfig.accountKey, appConfig.productKey, parentUserKey],
    );
    const now = new Date();
    await grantFreePilotAccess({
      pool,
      accountKey: appConfig.accountKey,
      productKey: appConfig.productKey,
      actorKind: 'admin',
      now,
      command: {
        household_key: 'reset_parent_household',
        idempotency_key: 'reset-parent-web-free-pilot',
        effective_at: now.toISOString(),
        expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        policy_version: 'account-lifecycle-web-free-pilot-v1',
        opaque_source_reference: 'account_lifecycle_web_reset_parent',
      },
    });
    const parentSession = await createSession({
      pool,
      config: appConfig,
      user: {
        user_key: parentUserKey,
        email: 'reset.parent@example.test',
        display_name: 'Reset Parent',
        role: 'parent',
        role_label: 'Parent',
        mfa_capable: false,
      },
    });
    expect(
      await getSessionByToken({
        pool,
        config: appConfig,
        sessionToken: parentSession.session_token,
      }),
    ).not.toBeNull();

    const forgotPage = await getCsrf('/forgot-password');
    const existing = await postJson(
      '/api/v1/account-lifecycle/forgot-password',
      {
        email: 'reset.parent@example.test',
        csrf_token: forgotPage.token,
        idempotency_key: 'forgot-existing-001',
      },
      forgotPage.cookies,
    );
    const missing = await postJson(
      '/api/v1/account-lifecycle/forgot-password',
      {
        email: 'missing.parent@example.test',
        csrf_token: forgotPage.token,
        idempotency_key: 'forgot-missing-001',
      },
      forgotPage.cookies,
    );
    expect(existing.response.status).toBe(200);
    expect(missing.response.status).toBe(200);
    expect(existing.json.message).toBe(missing.json.message);
    expect(JSON.stringify(existing.json)).not.toMatch(/token|reset-password#|cookie|password/i);
    expect(JSON.stringify(missing.json)).not.toMatch(/token|reset-password#|cookie|password/i);

    const resetToken = await latestPasswordResetToken();
    const resetPage = await getCsrf('/reset-password');
    const reset = await postJson(
      '/api/v1/account-lifecycle/reset-password',
      {
        token: resetToken,
        password: 'ParentWebPass!999',
        csrf_token: resetPage.token,
      },
      resetPage.cookies,
    );
    expect(reset.response.status).toBe(200);
    expect(reset.json).toMatchObject({ success: true, sessions_invalidated: 1 });
    expect(
      await getSessionByToken({
        pool,
        config: appConfig,
        sessionToken: parentSession.session_token,
      }),
    ).toBeNull();

    const oldLogin = await loginViaApi('reset.parent@example.test', 'ParentWebPass!234');
    expect(oldLogin.response.status).toBe(401);
    const newLogin = await loginViaApi('reset.parent@example.test', 'ParentWebPass!999');
    expect(newLogin.response.status).toBe(200);
  });
});

async function getCsrf(path: string) {
  const page = await fetch(`${baseUrl}${path}`);
  const html = await page.text();
  const token = html.match(/name="csrf_token" value="([^"]+)"/)?.[1];
  if (!token) throw new Error(`missing csrf token for ${path}`);
  return { token, cookies: cookieHeader(page.headers) };
}

async function postJson(path: string, body: Record<string, unknown>, cookies = '') {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      ...(cookies ? { cookie: cookies } : {}),
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as Record<string, unknown>;
  return { response, json };
}

async function loginViaApi(email: string, password: string) {
  const csrf = await getCsrf('/login');
  return postJson('/api/v1/auth/login', { email, password, csrf_token: csrf.token }, csrf.cookies);
}

async function latestPasswordResetToken() {
  const result = await pool.query(
    `SELECT nonce, ciphertext, auth_tag
       FROM onetime.account_lifecycle_delivery_outbox
      WHERE purpose = 'password_reset'
      ORDER BY created_at DESC
      LIMIT 1`,
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error('missing password reset delivery');
  const payload = decryptLifecycleDeliveryPayloadForTests(appConfig, {
    nonce: String(row.nonce),
    ciphertext: String(row.ciphertext),
    auth_tag: String(row.auth_tag),
  });
  const token = payload.token;
  if (typeof token !== 'string') throw new Error('missing decrypted reset token');
  return token;
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

function requiredToken(issue: { token_for_local_proof?: string }) {
  if (!issue.token_for_local_proof) throw new Error('Expected local proof token.');
  return issue.token_for_local_proof;
}
