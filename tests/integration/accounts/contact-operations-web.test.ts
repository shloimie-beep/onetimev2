import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../apps/web/src/server/app.ts';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  createAccountUser,
  createSession,
  type AuthenticatedSession,
} from '../../../packages/domain/src/index.ts';

let pool: DbPool;
let config: AppConfig;
let server: ReturnType<ReturnType<typeof createApp>['listen']>;
let baseUrl: string;
let ownerSession: Awaited<ReturnType<typeof createSession>>;

const enrollment = {
  idempotency_key: 'contact-ops-web-enrollment-0001',
  adult: {
    display_name: 'Web Operations Parent',
    email: 'web.operations.parent@example.test',
    phone: '+972501111111',
    classification: 'family',
    family_or_school: 'Web Operations Family',
    location: 'Jerusalem',
    timezone: 'Asia/Jerusalem',
  },
  household: {
    household_key: 'household_contact_operations_web',
    display_name: 'Web Operations Family',
  },
  students: [
    { display_name: 'Web Student One', username: 'web.student.one' },
    { display_name: 'Web Student Two', username: 'web.student.two' },
  ],
};

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    ONE_TIME_ACCOUNT_KEY: 'contact_operations_web_account',
    ONE_TIME_PRODUCT_KEY: 'contact_operations_web_product',
    OUTBOX_TRANSPORT_MODE: 'sink',
    HIGHLEVEL_EVENT_SYNC_MODE: 'mock',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
  const ownerUserKey = await createAccountUser({
    pool,
    config,
    email: 'contact.operations.web.owner@example.test',
    password: 'ContactOperationsWebOwner!234',
    displayName: 'Contact Operations Web Owner',
    role: 'owner',
  });
  ownerSession = await createSession({
    pool,
    config,
    assuranceMethod: 'email_challenge',
    user: sessionUser(ownerUserKey, 'owner', 'contact.operations.web.owner@example.test'),
  });
  const app = createApp({ config, pool });
  server = await new Promise<ReturnType<ReturnType<typeof createApp>['listen']>>(
    (resolve, reject) => {
      const instance = app.listen(0, (error?: Error) => {
        if (error) reject(error);
        else resolve(instance);
      });
    },
  );
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('missing contact operations server');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
});

describe('Parent and Student contact operations API', () => {
  it('runs the atomic operator flow and emits one adult-only GHL payload', async () => {
    const created = await post('/api/v1/contact-operations/enrollments', enrollment, ownerSession);
    expect(created.response.status).toBe(201);
    expect(created.json).toMatchObject({
      success: true,
      data: {
        household_key: enrollment.household.household_key,
        child_highlevel_operations: 0,
        plaintext_credentials_stored: false,
        payment_history_written: false,
      },
    });
    expect(
      (created.json.data as { student_setup_token_refs: unknown[] }).student_setup_token_refs,
    ).toHaveLength(2);

    const household = await fetch(
      `${baseUrl}/api/v1/contact-operations/households/${enrollment.household.household_key}`,
      { headers: { cookie: authCookies(ownerSession) } },
    );
    expect(household.status).toBe(200);
    expect(await household.json()).toMatchObject({
      data: {
        household_key: enrollment.household.household_key,
        display_name: enrollment.household.display_name,
        adult_display_name: enrollment.adult.display_name,
        students: [{ display_name: 'Web Student One' }, { display_name: 'Web Student Two' }],
      },
    });

    const link = await fetch(
      `${baseUrl}/api/v1/contact-operations/households/${enrollment.household.household_key}/adult-link`,
      { headers: { cookie: authCookies(ownerSession) } },
    );
    expect(link.status).toBe(200);
    expect(await link.json()).toMatchObject({
      data: {
        guardian_user_ref: null,
        sync_state: 'sync_pending',
        highlevel_contact_linked: false,
        payment_data_present: false,
      },
    });

    const outbox = await pool.query(
      `SELECT payload
         FROM onetime.outbox_events
        WHERE channel = 'highlevel'`,
    );
    expect(outbox.rows).toHaveLength(1);
    expect(outbox.rows[0]?.payload).toMatchObject({
      adult_contact: { adult_only: true },
      data: { household_key: enrollment.household.household_key },
    });
    expect(JSON.stringify(outbox.rows)).not.toMatch(
      /student|learner|username|password|amount|invoice|subscription/i,
    );
  });

  it('requires same-session CSRF and recent email assurance for every operator write', async () => {
    const missingCsrf = await fetch(`${baseUrl}/api/v1/contact-operations/enrollments`, {
      method: 'POST',
      headers: {
        cookie: authCookies(ownerSession),
        'content-type': 'application/json',
      },
      body: JSON.stringify(enrollment),
    });
    expect(missingCsrf.status).toBe(403);
    expect(await missingCsrf.json()).toMatchObject({ code: 'CSRF_REQUIRED' });

    await pool.query(
      `UPDATE onetime.user_sessions
          SET assurance_at = now() - interval '1 hour'
        WHERE session_key = $1`,
      [ownerSession.session_key],
    );
    const staleAssurance = await post(
      '/api/v1/contact-operations/enrollments',
      enrollment,
      ownerSession,
    );
    expect(staleAssurance.response.status).toBe(428);
    expect(staleAssurance.json).toMatchObject({ code: 'RECENT_ASSURANCE_REQUIRED' });

    const writes = await pool.query(
      `SELECT count(*)::int AS count
         FROM onetime.contacts`,
    );
    expect(Number(writes.rows[0]?.count)).toBe(0);
  });

  it('returns a 409 and no contact write for a non-Parent identity collision', async () => {
    await createAccountUser({
      pool,
      config,
      email: enrollment.adult.email,
      password: 'ExistingStudent!234',
      displayName: 'Existing Student',
      role: 'student',
    });
    const collision = await post(
      '/api/v1/contact-operations/enrollments',
      enrollment,
      ownerSession,
    );
    expect(collision.response.status).toBe(409);
    expect(collision.json).toMatchObject({ code: 'IDENTITY_CONFLICT' });

    const contacts = await pool.query(
      `SELECT count(*)::int AS count
         FROM onetime.contacts
        WHERE email_normalized = $1`,
      [enrollment.adult.email],
    );
    expect(Number(contacts.rows[0]?.count)).toBe(0);
  });
});

async function post(
  path: string,
  body: Record<string, unknown>,
  session: Awaited<ReturnType<typeof createSession>>,
) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      cookie: authCookies(session),
      'content-type': 'application/json',
      'x-csrf-token': session.csrf_token,
    },
    body: JSON.stringify(body),
  });
  return {
    response,
    json: (await response.json()) as Record<string, unknown>,
  };
}

function authCookies(session: Awaited<ReturnType<typeof createSession>>) {
  return `otcrm_session=${session.session_token}; otcrm_csrf=${session.csrf_token}`;
}

function sessionUser(
  userKey: string,
  role: 'owner' | 'admin',
  email: string,
): AuthenticatedSession['user'] {
  return {
    user_key: userKey,
    email,
    display_name:
      role === 'owner' ? 'Contact Operations Web Owner' : 'Contact Operations Web Admin',
    role,
    role_label: role === 'owner' ? 'Owner' : 'Administrator',
    mfa_capable: true,
  };
}
