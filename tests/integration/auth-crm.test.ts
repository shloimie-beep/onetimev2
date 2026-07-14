import { createHmac, randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import { createApp } from '../../apps/web/src/server/app.ts';
import { base32Decode, totp } from '../../packages/domain/src/auth/totp.ts';
import {
  CrmCursorError,
  authenticateUser,
  createAccountUser,
  listContacts,
  resetAuthRateLimitForTests,
  stableKey,
} from '../../packages/domain/src/index.ts';

let pool: DbPool;
let server: ReturnType<ReturnType<typeof createApp>['listen']>;
let baseUrl: string;
let appConfig: ReturnType<typeof config>;
let totpSecrets: Map<string, Buffer>;

const TEST_MFA_KEY = 'MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE';

const config = () =>
  loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    OUTBOX_TRANSPORT_MODE: 'sink',
    AUTH_CSRF_SECRET: 'test-auth-csrf-secret-with-enough-entropy',
    AUTH_MFA_ENCRYPTION_KEYS: `v1:${TEST_MFA_KEY}`,
    AUTH_MFA_ACTIVE_KEY_VERSION: 'v1',
  });

beforeEach(async () => {
  pool = createMemoryPool();
  appConfig = config();
  totpSecrets = new Map();
  await runMigrations(pool);
  resetAuthRateLimitForTests();
  await createAccountUser({
    pool,
    config: appConfig,
    email: 'owner@example.test',
    password: 'OwnerPass!234',
    displayName: 'Owner User',
    role: 'owner',
    mfaCapable: true,
  });
  await createAccountUser({
    pool,
    config: appConfig,
    email: 'admin@example.test',
    password: 'AdminPass!234',
    displayName: 'Admin User',
    role: 'admin',
    mfaCapable: true,
  });
  await createAccountUser({
    pool,
    config: appConfig,
    email: 'viewer@example.test',
    password: 'ViewerPass!234',
    displayName: 'View Only',
    role: 'viewer',
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
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await pool.end();
});

describe('standalone CRM authentication', () => {
  it('logs in with CSRF, returns a customer-facing role label, and revokes on logout', async () => {
    const loginPage = await fetch(`${baseUrl}/login`);
    expect(loginPage.headers.get('cache-control')).toContain('no-store');

    const owner = await loginAs('owner@example.test', 'OwnerPass!234');
    expect(owner.json.user.role_label).toBe('Owner');
    expect(owner.json.user.auth_assurance).toBe('mfa');
    expect(owner.json.user.mfa_verified).toBe(true);

    const login = await loginAs('admin@example.test', 'AdminPass!234');
    expect(login.json.user.role_label).toBe('Administrator');
    expect(login.json.user.auth_assurance).toBe('mfa');
    expect(login.json.user.mfa_verified).toBe(true);
    expect(login.cookies).toContain('otcrm_session=');
    expect(login.cookies).not.toContain('connect.sid');
    expect(login.responseHeaders.get('cache-control')).toContain('no-store');

    const session = await fetch(`${baseUrl}/api/v1/auth/session`, {
      headers: { cookie: login.cookies },
    });
    expect(session.status).toBe(200);
    expect(session.headers.get('cache-control')).toContain('no-store');
    const sessionJson = (await session.json()) as { csrf_token: string };
    const refreshedCookies = mergeCookies(login.cookies, cookieHeader(session.headers));

    const logout = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        cookie: refreshedCookies,
        'content-type': 'application/json',
        'x-csrf-token': sessionJson.csrf_token,
      },
      body: JSON.stringify({ csrf_token: sessionJson.csrf_token }),
    });
    expect(logout.status).toBe(200);

    const after = await fetch(`${baseUrl}/api/v1/auth/session`, {
      headers: { cookie: login.cookies },
    });
    expect(after.status).toBe(401);
  });

  it('requires an explicit submitted CSRF token for authenticated writes', async () => {
    const login = await loginAs('admin@example.test', 'AdminPass!234');
    const bodyOnly = await fetch(`${baseUrl}/api/v1/crm/contacts`, {
      method: 'POST',
      headers: {
        cookie: login.cookies,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        csrf_token: login.json.csrf_token,
        display_name: 'Body Token Contact',
        family_school_classification: 'family',
        email: 'body-token@example.test',
        phone: '',
        location: 'Jerusalem',
        timezone: 'Asia/Jerusalem',
        lead_status: 'new',
        idempotency_key: 'body-token-create',
      }),
    });
    expect(bodyOnly.status).toBe(201);

    const cookieOnly = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        cookie: login.cookies,
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    expect(cookieOnly.status).toBe(403);

    const mismatch = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        cookie: login.cookies,
        'content-type': 'application/json',
        'x-csrf-token': 'not-the-session-token',
      },
      body: JSON.stringify({}),
    });
    expect(mismatch.status).toBe(403);

    const otherSession = await loginAs('viewer@example.test', 'ViewerPass!234');
    const crossSession = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        cookie: otherSession.cookies,
        'content-type': 'application/json',
        'x-csrf-token': login.json.csrf_token,
      },
      body: JSON.stringify({}),
    });
    expect(crossSession.status).toBe(403);
  });

  it('requires MFA after password, rejects replay, and consumes recovery codes once', async () => {
    const csrf = await getLoginCsrf();
    const passwordAccepted = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        cookie: csrf.cookies,
        'content-type': 'application/json',
        'x-csrf-token': csrf.token,
      },
      body: JSON.stringify({
        email: 'admin@example.test',
        password: 'AdminPass!234',
        csrf_token: csrf.token,
      }),
    });
    expect(passwordAccepted.status).toBe(200);
    const preAuthCookies = mergeCookies(csrf.cookies, cookieHeader(passwordAccepted.headers));
    const preAuthJson = await passwordAccepted.json();
    expect(preAuthJson).toMatchObject({
      success: true,
      mfa_required: true,
      mfa_mode: 'enroll',
    });

    const blocked = await fetch(`${baseUrl}/api/v1/crm/contacts`, {
      headers: { cookie: preAuthCookies },
    });
    expect(blocked.status).toBe(401);

    const secret = secretFromOtpAuth(preAuthJson.enrollment.otpauth_uri);
    const encodedSecret = new URL(preAuthJson.enrollment.otpauth_uri).searchParams.get('secret');
    const code = totp({ secret });
    const mfa = await fetch(`${baseUrl}/api/v1/auth/mfa/verify`, {
      method: 'POST',
      headers: {
        cookie: preAuthCookies,
        'content-type': 'application/json',
        'x-csrf-token': csrf.token,
      },
      body: JSON.stringify({
        pre_auth_token: preAuthJson.pre_auth_token,
        csrf_token: csrf.token,
        totp_code: code,
      }),
    });
    expect(mfa.status).toBe(200);
    const mfaJson = await mfa.json();
    expect(mfaJson.user).toMatchObject({ auth_assurance: 'mfa', mfa_verified: true });
    expect(mfaJson.recovery_codes).toHaveLength(10);
    const storedFactor = await pool.query(
      `SELECT secret_ciphertext
         FROM onetime.user_mfa_factors
        WHERE user_key = $1`,
      [mfaJson.user.user_key],
    );
    expect(String(storedFactor.rows[0].secret_ciphertext)).not.toContain(encodedSecret ?? '');
    expect(String(storedFactor.rows[0].secret_ciphertext)).not.toContain(
      secret.toString('base64url'),
    );

    const replay = await fetch(`${baseUrl}/api/v1/auth/mfa/verify`, {
      method: 'POST',
      headers: {
        cookie: preAuthCookies,
        'content-type': 'application/json',
        'x-csrf-token': csrf.token,
      },
      body: JSON.stringify({
        pre_auth_token: preAuthJson.pre_auth_token,
        csrf_token: csrf.token,
        totp_code: code,
      }),
    });
    expect(replay.status).toBe(410);

    const challenge = await startLogin('admin@example.test', 'AdminPass!234');
    expect(challenge.json).toMatchObject({
      success: true,
      mfa_required: true,
      mfa_mode: 'challenge',
    });
    const recovery = String(mfaJson.recovery_codes[0]);
    const recoveryLogin = await verifyMfaLogin(challenge, {
      recovery_code: recovery,
    });
    expect(recoveryLogin.json.user).toMatchObject({ auth_assurance: 'mfa', mfa_verified: true });

    const secondChallenge = await startLogin('admin@example.test', 'AdminPass!234');
    const recoveryReplay = await fetch(`${baseUrl}/api/v1/auth/mfa/verify`, {
      method: 'POST',
      headers: {
        cookie: secondChallenge.cookies,
        'content-type': 'application/json',
        'x-csrf-token': secondChallenge.csrfToken,
      },
      body: JSON.stringify({
        pre_auth_token: secondChallenge.json.pre_auth_token,
        csrf_token: secondChallenge.csrfToken,
        recovery_code: recovery,
      }),
    });
    expect(recoveryReplay.status).toBe(401);
  });

  it('normalizes safe return paths and rejects return-path attacks', async () => {
    const cases: Array<[string, string]> = [
      ['/app/crm/contacts/contact_123', '/app/crm/contacts/contact_123'],
      ['/public-page', '/app/crm'],
      ['//evil.example/path', '/app/crm'],
      ['https://evil.example/app/crm', '/app/crm'],
      ['/login?return_to=/app/crm', '/app/crm'],
      ['/api/v1/crm/contacts', '/app/crm'],
      ['/%2f%2fevil.example', '/app/crm'],
      ['/app/%5csettings', '/app/crm'],
      ['\\evil', '/app/crm'],
    ];

    for (const [returnTo, expected] of cases) {
      const csrf = await getLoginCsrf();
      const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          cookie: csrf.cookies,
          'content-type': 'application/json',
          'x-csrf-token': csrf.token,
        },
        body: JSON.stringify({
          email: 'viewer@example.test',
          password: 'ViewerPass!234',
          csrf_token: csrf.token,
          return_to: returnTo,
        }),
      });
      expect(response.status).toBe(200);
      expect((await response.json()).return_to).toBe(expected);
    }
  });

  it('requires login CSRF and rate-limits failed login attempts', async () => {
    const noCsrf = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.test', password: 'AdminPass!234' }),
    });
    expect(noCsrf.status).toBe(403);

    const csrf = await getLoginCsrf();
    let status = 0;
    for (let index = 0; index < 6; index += 1) {
      const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          cookie: csrf.cookies,
          'content-type': 'application/json',
          'x-csrf-token': csrf.token,
        },
        body: JSON.stringify({
          email: 'admin@example.test',
          password: 'wrong-password',
          csrf_token: csrf.token,
        }),
      });
      status = response.status;
    }
    expect(status).toBe(429);
  });

  it('persists login throttling across service instances and concurrent attempts', async () => {
    const csrf = await getLoginCsrf();
    await Promise.all(
      Array.from({ length: 5 }, () =>
        fetch(`${baseUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: {
            cookie: csrf.cookies,
            'content-type': 'application/json',
            'x-csrf-token': csrf.token,
          },
          body: JSON.stringify({
            email: 'admin@example.test',
            password: 'wrong-password',
            csrf_token: csrf.token,
          }),
        }),
      ),
    );

    const secondApp = createApp({ config: appConfig, pool });
    let secondServer: ReturnType<ReturnType<typeof createApp>['listen']> | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        secondServer = secondApp.listen(0, (error?: Error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      const address = secondServer?.address();
      if (typeof address !== 'object' || !address) throw new Error('missing test server address');
      const secondUrl = `http://127.0.0.1:${address.port}`;
      const secondCsrf = await getLoginCsrf(secondUrl);
      const blocked = await fetch(`${secondUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          cookie: secondCsrf.cookies,
          'content-type': 'application/json',
          'x-csrf-token': secondCsrf.token,
        },
        body: JSON.stringify({
          email: 'admin@example.test',
          password: 'AdminPass!234',
          csrf_token: secondCsrf.token,
        }),
      });
      expect(blocked.status).toBe(429);
    } finally {
      if (secondServer) {
        await new Promise<void>((resolve) => secondServer?.close(() => resolve()));
      }
    }
  });

  it('uses the dummy password verification path for nonexistent accounts', async () => {
    const missingPaths: string[] = [];
    const missing = await authenticateUser({
      pool,
      config: appConfig,
      email: 'missing@example.test',
      password: 'WrongPass!234',
      testHooks: { passwordVerificationPath: (path) => missingPaths.push(path) },
    });
    expect(missing).toMatchObject({ ok: false, code: 'INVALID_CREDENTIALS' });
    expect(missingPaths).toEqual(['dummy']);

    const accountPaths: string[] = [];
    const wrongPassword = await authenticateUser({
      pool,
      config: appConfig,
      email: 'admin@example.test',
      password: 'WrongPass!234',
      testHooks: { passwordVerificationPath: (path) => accountPaths.push(path) },
    });
    expect(wrongPassword).toMatchObject({ ok: false, code: 'INVALID_CREDENTIALS' });
    expect(accountPaths).toEqual(['account']);
  });

  it('fails closed when privileged MFA config is missing and keeps viewer password-only', async () => {
    const blocked = await authenticateUser({
      pool,
      config: { ...appConfig, mfaEncryptionKeys: {}, mfaActiveKeyVersion: undefined },
      email: 'admin@example.test',
      password: 'AdminPass!234',
    });
    expect(blocked).toMatchObject({ ok: false, code: 'MFA_CONFIG_REQUIRED' });

    const viewer = await authenticateUser({
      pool,
      config: appConfig,
      email: 'viewer@example.test',
      password: 'ViewerPass!234',
    });
    expect(viewer.ok).toBe(true);
    if (viewer.ok) {
      expect(viewer.user.auth_assurance).toBe('password_only');
      expect(viewer.user.mfa_verified).toBe(false);
    }
  });

  it('invalidates privileged sessions when the password changes in another instance', async () => {
    const login = await loginAs('admin@example.test', 'AdminPass!234');
    await createAccountUser({
      pool,
      config: appConfig,
      email: 'admin@example.test',
      password: 'AdminPass!999',
      displayName: 'Admin User',
      role: 'admin',
      mfaCapable: true,
    });
    const staleSession = await fetch(`${baseUrl}/api/v1/auth/session`, {
      headers: { cookie: login.cookies },
    });
    expect(staleSession.status).toBe(401);
  });
});

describe('CRM vertical slice', () => {
  it('returns safe public conflicts for duplicate phone and idempotency mismatch', async () => {
    const first = await postLead({
      ...signupPayload('phone-api-one@example.test', 'idem-phone-api-one'),
      phone: '+1 212 555 0123',
    });
    expect(first.status).toBe(200);

    const phoneConflict = await postLead({
      ...signupPayload('phone-api-two@example.test', 'idem-phone-api-two'),
      phone: '001-212-555-0123',
    });
    expect(phoneConflict.status).toBe(409);
    const phoneJson = await phoneConflict.json();
    expect(phoneJson).toMatchObject({ code: 'DUPLICATE_IDENTITY' });
    expect(JSON.stringify(phoneJson)).not.toContain('contact_');
    expect(JSON.stringify(phoneJson)).not.toContain('phone-api-one');

    const idempotencyConflict = await postLead({
      ...signupPayload('different-api@example.test', 'idem-phone-api-one'),
    });
    expect(idempotencyConflict.status).toBe(409);
    expect(await idempotencyConflict.json()).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('shows one synthetic public signup in list and correct detail, then duplicate replay stays one contact', async () => {
    const payload = signupPayload('lead@example.test', 'idem-lead-1');
    const signup = await postLead(payload);
    expect(signup.status).toBe(200);
    const replay = await postLead(payload);
    expect(replay.status).toBe(200);
    expect((await replay.json()).duplicate_submission).toBe(true);

    const login = await loginAs('admin@example.test', 'AdminPass!234');
    const list = await apiSearch<ListJson>({ search: 'lead@example.test' }, login);
    expect(list.contacts).toHaveLength(1);
    const first = list.contacts[0];
    if (!first) throw new Error('expected CRM contact');
    expect(first.display_name).toBe('Lead Parent');
    expect(first.family_school_classification).toBe('family');

    const detail = await apiGet<ContactJson>(
      `/api/v1/crm/contacts/${encodeURIComponent(first.contact_id)}`,
      login.cookies,
    );
    expect(detail.contact.email).toBe('lead@example.test');
    expect(detail.contact.audit_safe_signup_provenance.signup_key).toBeTruthy();

    const counts = await pool.query(
      'SELECT (SELECT count(*)::int FROM onetime.contacts) AS contacts, (SELECT count(*)::int FROM onetime.signup_leads) AS leads',
    );
    expect(Number(counts.rows[0].contacts)).toBe(1);
    expect(Number(counts.rows[0].leads)).toBe(1);
  });

  it('signs CRM cursors and rejects tampered or wrong-context cursors', async () => {
    for (const name of ['Alpha Family', 'Beta Family', 'Gamma Family']) {
      const email = `${name.toLowerCase().replaceAll(' ', '.')}@example.test`;
      await pool.query(
        `INSERT INTO onetime.contacts
         (contact_key, account_key, product_key, display_name, family_school_classification,
          family_or_school, location_text, timezone, email_normalized, reminder_preference,
          suppression_state, source)
         VALUES ($1,$2,$3,$4,'family',$4,'Jerusalem','Asia/Jerusalem',$5,'none',
          'suppressed_no_consent','manual_crm')`,
        [
          stableKey('contact', [appConfig.accountKey, appConfig.productKey, email]),
          appConfig.accountKey,
          appConfig.productKey,
          name,
          email,
        ],
      );
    }

    const login = await loginAs('admin@example.test', 'AdminPass!234');
    const first = await apiGet<ListJson>(
      '/api/v1/crm/contacts?limit=2&sort=name_asc',
      login.cookies,
    );
    expect(first.contacts).toHaveLength(2);
    expect(first.next_cursor).toBeTruthy();

    const second = await apiGet<ListJson>(
      `/api/v1/crm/contacts?limit=2&sort=name_asc&cursor=${encodeURIComponent(
        first.next_cursor ?? '',
      )}`,
      login.cookies,
    );
    expect(second.contacts).toHaveLength(1);

    const tamperedCursor = `${first.next_cursor?.slice(0, -1)}x`;
    const tampered = await fetch(
      `${baseUrl}/api/v1/crm/contacts?limit=2&sort=name_asc&cursor=${encodeURIComponent(
        tamperedCursor,
      )}`,
      { headers: { cookie: login.cookies } },
    );
    expect(tampered.status).toBe(400);
    expect(await tampered.json()).toMatchObject({ code: 'INVALID_CURSOR' });

    const wrongQuery = await fetch(`${baseUrl}/api/v1/crm/contacts/search`, {
      method: 'POST',
      headers: {
        cookie: login.cookies,
        'content-type': 'application/json',
        'x-csrf-token': login.json.csrf_token,
      },
      body: JSON.stringify({
        limit: 2,
        sort: 'name_asc',
        search: 'alpha',
        cursor: first.next_cursor ?? '',
        csrf_token: login.json.csrf_token,
      }),
    });
    expect(wrongQuery.status).toBe(400);
    expect(await wrongQuery.json()).toMatchObject({ code: 'INVALID_CURSOR' });

    const staleVersion = resignCursor(first.next_cursor ?? '', appConfig.crmCursorSecret, {
      v: 0,
    });
    const stale = await fetch(
      `${baseUrl}/api/v1/crm/contacts?limit=2&sort=name_asc&cursor=${encodeURIComponent(
        staleVersion,
      )}`,
      { headers: { cookie: login.cookies } },
    );
    expect(stale.status).toBe(400);
    expect(await stale.json()).toMatchObject({ code: 'INVALID_CURSOR' });

    const expiredCursor = resignCursor(first.next_cursor ?? '', appConfig.crmCursorSecret, {
      issued_at: '2020-01-01T00:00:00.000Z',
    });
    const expired = await fetch(
      `${baseUrl}/api/v1/crm/contacts?limit=2&sort=name_asc&cursor=${encodeURIComponent(
        expiredCursor,
      )}`,
      { headers: { cookie: login.cookies } },
    );
    expect(expired.status).toBe(400);
    expect(await expired.json()).toMatchObject({ code: 'INVALID_CURSOR' });

    await expect(
      listContacts({
        pool,
        config: { ...appConfig, accountKey: 'other_account' },
        query: { limit: 2, sort: 'name_asc', cursor: first.next_cursor ?? undefined },
      }),
    ).rejects.toBeInstanceOf(CrmCursorError);
    await expect(
      listContacts({
        pool,
        config: { ...appConfig, productKey: 'other_product' },
        query: { limit: 2, sort: 'name_asc', cursor: first.next_cursor ?? undefined },
      }),
    ).rejects.toBeInstanceOf(CrmCursorError);
  });

  it('supports create, privacy-safe duplicate open, edit, and version conflict without outbox writes', async () => {
    const login = await loginAs('admin@example.test', 'AdminPass!234');
    const created = await apiWrite<ContactJson>('/api/v1/crm/contacts', 'POST', login, {
      display_name: 'Manual Contact',
      family_school_classification: 'school',
      email: 'manual@example.test',
      phone: '+972 50-222-3333',
      location: 'Jerusalem',
      timezone: 'Asia/Jerusalem',
      lead_status: 'new',
      internal_note: 'Asked for school review.',
    });
    expect(created.contact.source).toBe('manual_crm');
    expect(created.contact.reminder_preference).toBe('none');
    expect(created.contact.suppression_state).toBe('suppressed_no_consent');

    const duplicate = await fetch(`${baseUrl}/api/v1/crm/contacts`, {
      method: 'POST',
      headers: {
        cookie: login.cookies,
        'content-type': 'application/json',
        'x-csrf-token': login.json.csrf_token,
      },
      body: JSON.stringify({
        display_name: 'Manual Contact Again',
        family_school_classification: 'school',
        email: 'manual@example.test',
        phone: '',
        location: 'Jerusalem',
        timezone: 'Asia/Jerusalem',
        lead_status: 'new',
        idempotency_key: 'manual-duplicate-create',
      }),
    });
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toMatchObject({ code: 'DUPLICATE_CONTACT' });

    const updated = await apiWrite<ContactJson>(
      `/api/v1/crm/contacts/${encodeURIComponent(created.contact.contact_id)}`,
      'PATCH',
      login,
      {
        version: created.contact.version,
        display_name: 'Manual Contact Updated',
        lead_status: 'contacted',
      },
    );
    expect(updated.contact.version).toBe(created.contact.version + 1);
    expect(updated.contact.lead_status).toBe('contacted');

    const stale = await fetch(
      `${baseUrl}/api/v1/crm/contacts/${encodeURIComponent(created.contact.contact_id)}`,
      {
        method: 'PATCH',
        headers: {
          cookie: login.cookies,
          'content-type': 'application/json',
          'x-csrf-token': login.json.csrf_token,
        },
        body: JSON.stringify({ version: created.contact.version, display_name: 'Stale' }),
      },
    );
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ code: 'VERSION_CONFLICT' });

    const outbox = await pool.query('SELECT count(*)::int AS count FROM onetime.outbox_events');
    expect(Number(outbox.rows[0].count)).toBe(0);
  });

  it('enforces active same-account and same-product assignee scope', async () => {
    const activeAssignee = await createAccountUser({
      pool,
      config: appConfig,
      email: 'assign-active@example.test',
      password: 'AssignPass!234',
      displayName: 'Assignable User',
      role: 'crm_agent',
      mfaCapable: true,
    });
    const disabledAssignee = await createAccountUser({
      pool,
      config: appConfig,
      email: 'assign-disabled@example.test',
      password: 'AssignPass!234',
      displayName: 'Disabled User',
      role: 'crm_agent',
      mfaCapable: true,
    });
    await pool.query('UPDATE onetime.account_users SET status = $2 WHERE user_key = $1', [
      disabledAssignee,
      'disabled',
    ]);
    const crossAccountAssignee = await createAccountUser({
      pool,
      config: { ...appConfig, accountKey: 'other_account' },
      email: 'assign-cross-account@example.test',
      password: 'AssignPass!234',
      displayName: 'Cross Account User',
      role: 'crm_agent',
      mfaCapable: true,
    });
    const crossProductAssignee = await createAccountUser({
      pool,
      config: { ...appConfig, productKey: 'other_product' },
      email: 'assign-cross-product@example.test',
      password: 'AssignPass!234',
      displayName: 'Cross Product User',
      role: 'crm_agent',
      mfaCapable: true,
    });

    const login = await loginAs('admin@example.test', 'AdminPass!234');
    const created = await apiWrite<ContactJson>('/api/v1/crm/contacts', 'POST', login, {
      display_name: 'Assigned Contact',
      family_school_classification: 'family',
      email: 'assigned@example.test',
      phone: '',
      location: 'Jerusalem',
      timezone: 'Asia/Jerusalem',
      lead_status: 'new',
      assigned_user_key: activeAssignee,
    });
    expect(created.contact.assigned_team_member).toBe('Assignable User');

    for (const assignedUserKey of [disabledAssignee, crossAccountAssignee, crossProductAssignee]) {
      const createDenied = await fetch(`${baseUrl}/api/v1/crm/contacts`, {
        method: 'POST',
        headers: {
          cookie: login.cookies,
          'content-type': 'application/json',
          'x-csrf-token': login.json.csrf_token,
        },
        body: JSON.stringify({
          display_name: 'Bad Assignee',
          family_school_classification: 'family',
          email: `${assignedUserKey}@example.test`,
          phone: '',
          location: 'Jerusalem',
          timezone: 'Asia/Jerusalem',
          lead_status: 'new',
          assigned_user_key: assignedUserKey,
          idempotency_key: `bad-assignee-${assignedUserKey}`,
        }),
      });
      expect(createDenied.status).toBe(400);
      expect(await createDenied.json()).toMatchObject({ code: 'INVALID_ASSIGNEE' });

      const filterDenied = await fetch(
        `${baseUrl}/api/v1/crm/contacts?assigned_user_key=${encodeURIComponent(assignedUserKey)}`,
        { headers: { cookie: login.cookies } },
      );
      expect(filterDenied.status).toBe(400);
      expect(await filterDenied.json()).toMatchObject({ code: 'INVALID_ASSIGNEE' });
    }

    const updateDenied = await fetch(
      `${baseUrl}/api/v1/crm/contacts/${encodeURIComponent(created.contact.contact_id)}`,
      {
        method: 'PATCH',
        headers: {
          cookie: login.cookies,
          'content-type': 'application/json',
          'x-csrf-token': login.json.csrf_token,
        },
        body: JSON.stringify({
          version: created.contact.version,
          assigned_user_key: disabledAssignee,
        }),
      },
    );
    expect(updateDenied.status).toBe(400);
    expect(await updateDenied.json()).toMatchObject({ code: 'INVALID_ASSIGNEE' });
  });

  it('keeps CRM list and detail query counts bounded', async () => {
    const email = 'query-count@example.test';
    const contactKey = stableKey('contact', [appConfig.accountKey, appConfig.productKey, email]);
    const inserted = await pool.query(
      `INSERT INTO onetime.contacts
       (contact_key, account_key, product_key, display_name, family_school_classification,
        family_or_school, location_text, timezone, email_normalized, reminder_preference,
        suppression_state, source)
       VALUES ($1,$2,$3,'Query Count','family','Query Count','Jerusalem','Asia/Jerusalem',
        $4,'none','suppressed_no_consent','manual_crm')
       RETURNING public_id`,
      [contactKey, appConfig.accountKey, appConfig.productKey, email],
    );
    const publicId = inserted.rows[0]?.public_id;
    const login = await loginAs('admin@example.test', 'AdminPass!234');

    const originalQuery = pool.query.bind(pool);
    let queryCount = 0;
    (pool as DbPool).query = ((...args: Parameters<DbPool['query']>) => {
      queryCount += 1;
      return originalQuery(...args);
    }) as DbPool['query'];

    try {
      queryCount = 0;
      const list = await apiSearch<ListJson>({ search: 'query-count@example.test' }, login);
      expect(list.contacts).toHaveLength(1);
      expect(queryCount).toBeLessThanOrEqual(3);

      queryCount = 0;
      await apiGet<ContactJson>(
        `/api/v1/crm/contacts/${encodeURIComponent(publicId)}`,
        login.cookies,
      );
      expect(queryCount).toBeLessThanOrEqual(3);
    } finally {
      (pool as DbPool).query = originalQuery as DbPool['query'];
    }
  });

  it('blocks viewer writes and hides other account contacts', async () => {
    await pool.query(
      `INSERT INTO onetime.contacts
       (contact_key, account_key, product_key, display_name, family_school_classification,
        family_or_school, location_text, timezone, email_normalized, reminder_preference, source)
       VALUES ('contact_other', 'other_account', 'one_time_mishnah_class', 'Other Account',
        'family', 'Other', 'Other', 'Asia/Jerusalem', 'other@example.test', 'email', 'manual_crm')`,
    );
    const viewer = await loginAs('viewer@example.test', 'ViewerPass!234');
    const denied = await fetch(`${baseUrl}/api/v1/crm/contacts`, {
      method: 'POST',
      headers: {
        cookie: viewer.cookies,
        'content-type': 'application/json',
        'x-csrf-token': viewer.json.csrf_token,
      },
      body: JSON.stringify({
        display_name: 'Denied',
        family_school_classification: 'family',
        email: 'denied@example.test',
        location: 'Jerusalem',
        timezone: 'Asia/Jerusalem',
        idempotency_key: 'viewer-denied-create',
      }),
    });
    expect(denied.status).toBe(403);

    const list = await apiSearch<ListJson>({ search: 'other@example.test' }, viewer);
    expect(list.contacts).toHaveLength(0);
  });
});

type LoginResult = {
  cookies: string;
  responseHeaders: Headers;
  json: {
    success: true;
    csrf_token: string;
    user: { role_label: string; auth_assurance: string; mfa_verified: boolean };
  };
};

type PreAuthResult = {
  cookies: string;
  csrfToken: string;
  responseHeaders: Headers;
  json: {
    success: true;
    mfa_required: true;
    mfa_mode: 'enroll' | 'challenge';
    pre_auth_token: string;
    enrollment?: { otpauth_uri: string };
    return_to?: string;
  };
};

type ListJson = {
  success: true;
  next_cursor: string | null;
  contacts: Array<{
    contact_id: string;
    display_name: string;
    family_school_classification: string;
  }>;
};
type ContactJson = {
  success: true;
  contact: {
    contact_id: string;
    email: string;
    source: string;
    lead_status: string;
    version: number;
    assigned_team_member: string | null;
    reminder_preference: string;
    suppression_state: string;
    audit_safe_signup_provenance: { signup_key: string | null };
  };
};

async function getLoginCsrf(targetBaseUrl = baseUrl) {
  const page = await fetch(`${targetBaseUrl}/login`);
  const html = await page.text();
  const token = html.match(/name="csrf_token" value="([^"]+)"/)?.[1];
  if (!token) throw new Error('missing csrf token');
  return { token, cookies: cookieHeader(page.headers) };
}

async function loginAs(email: string, password: string): Promise<LoginResult> {
  const preAuth = await startLogin(email, password);
  if (!preAuth.json.mfa_required) return preAuth as unknown as LoginResult;
  const secret =
    preAuth.json.enrollment?.otpauth_uri &&
    rememberSecret(email, secretFromOtpAuth(preAuth.json.enrollment.otpauth_uri));
  const knownSecret = secret ?? totpSecrets.get(email);
  if (!knownSecret) throw new Error(`missing TOTP secret for ${email}`);
  return verifyMfaLogin(preAuth, { totp_code: totp({ secret: knownSecret }) });
}

async function startLogin(email: string, password: string): Promise<PreAuthResult> {
  const csrf = await getLoginCsrf();
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      cookie: csrf.cookies,
      'content-type': 'application/json',
      'x-csrf-token': csrf.token,
    },
    body: JSON.stringify({ email, password, csrf_token: csrf.token }),
  });
  expect(response.status).toBe(200);
  const json = await response.json();
  if (!json.mfa_required) {
    return {
      cookies: mergeCookies(csrf.cookies, cookieHeader(response.headers)),
      csrfToken: json.csrf_token,
      responseHeaders: response.headers,
      json,
    } as PreAuthResult;
  }
  return {
    cookies: mergeCookies(csrf.cookies, cookieHeader(response.headers)),
    csrfToken: csrf.token,
    responseHeaders: response.headers,
    json: json as PreAuthResult['json'],
  };
}

async function verifyMfaLogin(
  preAuth: PreAuthResult,
  factor: { totp_code?: string; recovery_code?: string },
): Promise<LoginResult> {
  const response = await fetch(`${baseUrl}/api/v1/auth/mfa/verify`, {
    method: 'POST',
    headers: {
      cookie: preAuth.cookies,
      'content-type': 'application/json',
      'x-csrf-token': preAuth.csrfToken,
    },
    body: JSON.stringify({
      pre_auth_token: preAuth.json.pre_auth_token,
      csrf_token: preAuth.csrfToken,
      return_to: preAuth.json.return_to ?? '/app/crm',
      ...factor,
    }),
  });
  expect(response.status).toBe(200);
  return {
    cookies: mergeCookies(preAuth.cookies, cookieHeader(response.headers)),
    responseHeaders: response.headers,
    json: (await response.json()) as LoginResult['json'],
  };
}

async function postLead(payload: Record<string, unknown>) {
  return fetch(`${baseUrl}/api/v1/leads`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function apiGet<T>(path: string, cookies: string) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { cookie: cookies } });
  expect(response.status).toBe(200);
  return (await response.json()) as T;
}

async function apiSearch<T>(body: Record<string, unknown>, login: LoginResult) {
  const response = await fetch(`${baseUrl}/api/v1/crm/contacts/search`, {
    method: 'POST',
    headers: {
      cookie: login.cookies,
      'content-type': 'application/json',
      'x-csrf-token': login.json.csrf_token,
    },
    body: JSON.stringify({ ...body, csrf_token: login.json.csrf_token }),
  });
  expect(response.status).toBe(200);
  return (await response.json()) as T;
}

async function apiWrite<T>(
  path: string,
  method: 'POST' | 'PATCH',
  login: LoginResult,
  body: Record<string, unknown>,
) {
  const payload =
    method === 'POST' && path === '/api/v1/crm/contacts' && !body.idempotency_key
      ? { ...body, idempotency_key: randomUUID() }
      : body;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      cookie: login.cookies,
      'content-type': 'application/json',
      'x-csrf-token': login.json.csrf_token,
    },
    body: JSON.stringify(payload),
  });
  expect([200, 201]).toContain(response.status);
  return (await response.json()) as T;
}

function secretFromOtpAuth(uri: string) {
  const secret = new URL(uri).searchParams.get('secret');
  if (!secret) throw new Error('missing otpauth secret');
  return base32Decode(secret);
}

function rememberSecret(email: string, secret: Buffer) {
  totpSecrets.set(email, secret);
  return secret;
}

function signupPayload(email: string, idempotencyKey: string) {
  return {
    contact_name: 'Lead Parent',
    family_or_school: 'Lead Family',
    audience_type: 'family',
    location: 'Ramat Beit Shemesh',
    timezone: 'Asia/Jerusalem',
    email,
    phone: '',
    reminder_preference: 'email',
    reminder_consent: true,
    idempotency_key: idempotencyKey,
    attribution: { landing_path: '/signup' },
  };
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

function resignCursor(cursor: string, secret: string, patch: Record<string, unknown>) {
  const [body] = cursor.split('.');
  if (!body) throw new Error('missing cursor body');
  const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >;
  const nextBody = Buffer.from(JSON.stringify({ ...parsed, ...patch }), 'utf8').toString(
    'base64url',
  );
  const signature = createHmac('sha256', secret).update(nextBody).digest('base64url');
  return `${nextBody}.${signature}`;
}
