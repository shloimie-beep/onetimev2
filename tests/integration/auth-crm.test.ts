import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import { createApp } from '../../apps/web/src/server/app.ts';
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

const config = () =>
  loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    OUTBOX_TRANSPORT_MODE: 'sink',
  });

beforeEach(async () => {
  pool = createMemoryPool();
  appConfig = config();
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
    expect(owner.json.user.auth_assurance).toBe('password_only');
    expect(owner.json.user.mfa_verified).toBe(false);

    const login = await loginAs('admin@example.test', 'AdminPass!234');
    expect(login.json.user.role_label).toBe('Administrator');
    expect(login.cookies).toContain('otcrm_session=');
    expect(login.cookies).not.toContain('connect.sid');
    expect(login.responseHeaders.get('cache-control')).toContain('no-store');

    const session = await fetch(`${baseUrl}/api/v1/auth/session`, {
      headers: { cookie: login.cookies },
    });
    expect(session.status).toBe(200);
    expect(session.headers.get('cache-control')).toContain('no-store');

    const logout = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        cookie: login.cookies,
        'content-type': 'application/json',
        'x-csrf-token': login.json.csrf_token,
      },
      body: JSON.stringify({ csrf_token: login.json.csrf_token }),
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

  it('fails closed when verified MFA is required and reports password-only assurance otherwise', async () => {
    const blocked = await authenticateUser({
      pool,
      config: { ...appConfig, requireVerifiedMfa: true },
      email: 'admin@example.test',
      password: 'AdminPass!234',
    });
    expect(blocked).toMatchObject({ ok: false, code: 'MFA_REQUIRED' });

    const viewer = await authenticateUser({
      pool,
      config: { ...appConfig, requireVerifiedMfa: true },
      email: 'viewer@example.test',
      password: 'ViewerPass!234',
    });
    expect(viewer.ok).toBe(true);
    if (viewer.ok) {
      expect(viewer.user.auth_assurance).toBe('password_only');
      expect(viewer.user.mfa_verified).toBe(false);
    }
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
    const list = await apiGet<ListJson>(
      '/api/v1/crm/contacts?search=lead%40example.test',
      login.cookies,
    );
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

    const wrongQuery = await fetch(
      `${baseUrl}/api/v1/crm/contacts?limit=2&sort=name_asc&search=alpha&cursor=${encodeURIComponent(
        first.next_cursor ?? '',
      )}`,
      { headers: { cookie: login.cookies } },
    );
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
    await pool.query(
      `INSERT INTO onetime.contacts
       (contact_key, account_key, product_key, display_name, family_school_classification,
        family_or_school, location_text, timezone, email_normalized, reminder_preference,
        suppression_state, source)
       VALUES ($1,$2,$3,'Query Count','family','Query Count','Jerusalem','Asia/Jerusalem',
        $4,'none','suppressed_no_consent','manual_crm')`,
      [contactKey, appConfig.accountKey, appConfig.productKey, email],
    );
    const login = await loginAs('admin@example.test', 'AdminPass!234');

    const originalQuery = pool.query.bind(pool);
    let queryCount = 0;
    (pool as DbPool).query = ((...args: Parameters<DbPool['query']>) => {
      queryCount += 1;
      return originalQuery(...args);
    }) as DbPool['query'];

    try {
      queryCount = 0;
      const list = await apiGet<ListJson>(
        '/api/v1/crm/contacts?search=query-count%40example.test',
        login.cookies,
      );
      expect(list.contacts).toHaveLength(1);
      expect(queryCount).toBeLessThanOrEqual(3);

      queryCount = 0;
      await apiGet<ContactJson>(
        `/api/v1/crm/contacts/${encodeURIComponent(contactKey)}`,
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
      }),
    });
    expect(denied.status).toBe(403);

    const list = await apiGet<ListJson>(
      '/api/v1/crm/contacts?search=other%40example.test',
      viewer.cookies,
    );
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
  return {
    cookies: mergeCookies(csrf.cookies, cookieHeader(response.headers)),
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

async function apiWrite<T>(
  path: string,
  method: 'POST' | 'PATCH',
  login: LoginResult,
  body: Record<string, unknown>,
) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      cookie: login.cookies,
      'content-type': 'application/json',
      'x-csrf-token': login.json.csrf_token,
    },
    body: JSON.stringify(body),
  });
  expect([200, 201]).toContain(response.status);
  return (await response.json()) as T;
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
