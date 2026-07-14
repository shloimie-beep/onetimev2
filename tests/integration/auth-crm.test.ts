import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import { createApp } from '../../apps/web/src/server/app.ts';
import { createAccountUser, resetAuthRateLimitForTests } from '../../packages/domain/src/index.ts';

let pool: DbPool;
let server: ReturnType<ReturnType<typeof createApp>['listen']>;
let baseUrl: string;

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
  const appConfig = config();
  await runMigrations(pool);
  resetAuthRateLimitForTests();
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
    const login = await loginAs('admin@example.test', 'AdminPass!234');
    expect(login.json.user.role_label).toBe('Administrator');
    expect(login.cookies).toContain('otcrm_session=');
    expect(login.cookies).not.toContain('connect.sid');

    const session = await fetch(`${baseUrl}/api/v1/auth/session`, {
      headers: { cookie: login.cookies },
    });
    expect(session.status).toBe(200);

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
});

describe('CRM vertical slice', () => {
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

  it('supports create, privacy-safe duplicate open, edit, and version conflict without outbox writes', async () => {
    const login = await loginAs('admin@example.test', 'AdminPass!234');
    const created = await apiWrite<ContactJson>('/api/v1/crm/contacts', 'POST', login, {
      display_name: 'Manual Contact',
      family_school_classification: 'school',
      email: 'manual@example.test',
      phone: '050-222-3333',
      location: 'Jerusalem',
      timezone: 'Asia/Jerusalem',
      lead_status: 'new',
      internal_note: 'Asked for school review.',
    });
    expect(created.contact.source).toBe('manual_crm');

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
  json: { success: true; csrf_token: string; user: { role_label: string } };
};

type ListJson = {
  success: true;
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
    audit_safe_signup_provenance: { signup_key: string | null };
  };
};

async function getLoginCsrf() {
  const page = await fetch(`${baseUrl}/login`);
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
