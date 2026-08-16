import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import { createApp } from '../../apps/web/src/server/app.ts';
import {
  createAccountUser,
  decryptAuthEmailChallengeDeliveryPayloadForTests,
  resetAuthRateLimitForTests,
} from '../../packages/domain/src/index.ts';

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
    mfaCapable: false,
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
  it('rejects hostile return_to values and does not expose login phase timing', async () => {
    const page = await fetch(
      `${baseUrl}/login?return_to=${encodeURIComponent('https://evil.example/app/crm')}`,
    );
    const html = await page.text();
    expect(html).toContain('name="return_to" value="/app/crm"');
    expect(page.headers.get('cache-control')).toContain('no-store');

    const csrf = await getLoginCsrf();
    const failed = await fetch(`${baseUrl}/api/v1/auth/login`, {
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
    expect(failed.status).toBe(401);
    expect(failed.headers.get('server-timing')).toBeNull();
  });

  it('logs in with CSRF, returns a customer-facing role label, and revokes on logout', async () => {
    const login = await loginAs('admin@example.test', 'AdminPass!234');
    expect(login.json.user.role_label).toBe('Administrator');
    expect(login.cookies).toContain('otcrm_session=');
    expect(login.cookies).not.toContain('connect.sid');

    const session = await fetch(`${baseUrl}/api/v1/auth/session`, {
      headers: { cookie: login.cookies },
    });
    expect(session.status).toBe(200);
    expect(session.headers.get('cache-control')).toContain('no-store');

    const cookieOnlyLogout = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        cookie: login.cookies,
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    expect(cookieOnlyLogout.status).toBe(403);

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

  it('changes the signed-in password with CSRF and keeps role-incompatible return paths closed', async () => {
    const csrf = await getLoginCsrf();
    const routed = await fetch(`${baseUrl}/api/v1/auth/login`, {
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
        return_to: '/app/student?section=library',
      }),
    });
    expect(routed.status).toBe(200);
    const routedJson = (await routed.json()) as {
      csrf_token: string;
      return_to: string;
    };
    const cookies = mergeCookies(csrf.cookies, cookieHeader(routed.headers));
    expect(routedJson.return_to).toBe('/app/crm');

    const missingCsrf = await fetch(`${baseUrl}/api/v1/auth/password`, {
      method: 'POST',
      headers: { cookie: cookies, 'content-type': 'application/json' },
      body: JSON.stringify({
        current_password: 'ViewerPass!234',
        new_password: 'Ab1234',
      }),
    });
    expect(missingCsrf.status).toBe(403);

    const wrongCurrent = await fetch(`${baseUrl}/api/v1/auth/password`, {
      method: 'POST',
      headers: {
        cookie: cookies,
        'content-type': 'application/json',
        'x-csrf-token': routedJson.csrf_token,
      },
      body: JSON.stringify({
        current_password: 'NotThePassword!9',
        new_password: 'Ab1234',
      }),
    });
    expect(wrongCurrent.status).toBe(400);
    expect(await wrongCurrent.json()).toMatchObject({ code: 'INVALID_CURRENT_PASSWORD' });

    const changed = await fetch(`${baseUrl}/api/v1/auth/password`, {
      method: 'POST',
      headers: {
        cookie: cookies,
        'content-type': 'application/json',
        'x-csrf-token': routedJson.csrf_token,
      },
      body: JSON.stringify({
        current_password: 'ViewerPass!234',
        new_password: 'Ab1234',
      }),
    });
    expect(changed.status).toBe(200);
    expect(await changed.json()).toMatchObject({
      success: true,
      current_session_preserved: true,
    });

    const currentSession = await fetch(`${baseUrl}/api/v1/auth/session`, {
      headers: { cookie: cookies },
    });
    expect(currentSession.status).toBe(200);
    const oldPassword = await authenticateDirect('viewer@example.test', 'ViewerPass!234');
    expect(oldPassword.status).toBe(401);
    const newPassword = await authenticateDirect('viewer@example.test', 'Ab1234');
    expect(newPassword.status).toBe(200);
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

  it('rejects login CSRF cookie replay and tampered HMAC proof tokens', async () => {
    const csrf = await getLoginCsrf();
    const csrfCookie = cookieValue(csrf.cookies, 'otcrm_csrf');
    expect(csrfCookie).toBeTruthy();
    expect(csrf.token).not.toBe(csrfCookie);

    const replayCookie = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        cookie: csrf.cookies,
        'content-type': 'application/json',
        'x-csrf-token': csrfCookie ?? '',
      },
      body: JSON.stringify({
        email: 'admin@example.test',
        password: 'AdminPass!234',
        csrf_token: csrfCookie,
      }),
    });
    expect(replayCookie.status).toBe(403);

    const tamperedToken = `${csrf.token.slice(0, -1)}${csrf.token.endsWith('A') ? 'B' : 'A'}`;
    const tampered = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        cookie: csrf.cookies,
        'content-type': 'application/json',
        'x-csrf-token': tamperedToken,
      },
      body: JSON.stringify({
        email: 'admin@example.test',
        password: 'AdminPass!234',
        csrf_token: tamperedToken,
      }),
    });
    expect(tampered.status).toBe(403);
  });

  it('invalidates existing sessions after a user security-version change', async () => {
    const login = await loginAs('admin@example.test', 'AdminPass!234');
    await pool.query(
      `UPDATE onetime.account_users
          SET security_version = security_version + 1,
              security_policy_updated_at = now()
        WHERE email_normalized = 'admin@example.test'`,
    );
    const after = await fetch(`${baseUrl}/api/v1/auth/session`, {
      headers: { cookie: login.cookies },
    });
    expect(after.status).toBe(401);
  });

  it('retires legacy MFA endpoints with a generic response', async () => {
    for (const path of [
      '/api/v1/account-lifecycle/mfa/activate',
      '/api/v1/account-lifecycle/mfa/ack',
      '/api/v1/auth/mfa/enroll/activate',
      '/api/v1/auth/mfa/challenge',
      '/api/v1/auth/mfa/recovery',
      '/api/v1/auth/mfa/recovery/replace',
      '/api/v1/auth/mfa/revoke',
    ]) {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(410);
      expect(await response.json()).toMatchObject({ code: 'AUTH_METHOD_RETIRED' });
    }
  });

  it('uses single-use email codes and supersedes older owner/admin login challenges', async () => {
    const csrf = await getLoginCsrf();
    const password = await fetch(`${baseUrl}/api/v1/auth/login`, {
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
    expect(password.status).toBe(403);
    const challenge = (await password.json()) as { code?: string; challenge_token?: string };
    expect(challenge).toMatchObject({ code: 'EMAIL_CHALLENGE_REQUIRED' });
    const firstPayload = await latestEmailChallengePayload();
    const firstCode = String(firstPayload.code);

    const nextCsrf = await getLoginCsrf();
    const nextPassword = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        cookie: nextCsrf.cookies,
        'content-type': 'application/json',
        'x-csrf-token': nextCsrf.token,
      },
      body: JSON.stringify({
        email: 'admin@example.test',
        password: 'AdminPass!234',
        csrf_token: nextCsrf.token,
      }),
    });
    expect(nextPassword.status).toBe(403);
    const superseded = await fetch(`${baseUrl}/api/v1/auth/email-challenge/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ challenge_token: challenge.challenge_token, code: firstCode }),
    });
    expect(superseded.status).toBe(401);

    const nextChallenge = (await nextPassword.json()) as { challenge_token?: string };
    const nextPayload = await latestEmailChallengePayload();
    const verified = await fetch(`${baseUrl}/api/v1/auth/email-challenge/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        challenge_token: nextChallenge.challenge_token,
        code: String(nextPayload.code),
      }),
    });
    expect(verified.status).toBe(200);

    const replay = await fetch(`${baseUrl}/api/v1/auth/email-challenge/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        challenge_token: nextChallenge.challenge_token,
        code: String(nextPayload.code),
      }),
    });
    expect(replay.status).toBe(401);
  });

  it('trusts an owner/admin browser for password login and revokes that device', async () => {
    const first = await loginAs('admin@example.test', 'AdminPass!234', { trustDevice: true });
    expect(first.cookies).toContain('otcrm_session=');
    expect(first.cookies).toContain('otcrm_trusted_device=');
    const trustedDeviceCookie = `otcrm_trusted_device=${cookieValue(first.cookies, 'otcrm_trusted_device')}`;

    const trusted = await loginAs('admin@example.test', 'AdminPass!234', {
      cookies: trustedDeviceCookie,
    });
    expect(trusted.cookies).toContain('otcrm_session=');

    const revoked = await fetch(`${baseUrl}/api/v1/auth/trusted-devices/revoke`, {
      method: 'POST',
      headers: {
        cookie: first.cookies,
        'content-type': 'application/json',
        'x-csrf-token': first.json.csrf_token,
      },
      body: JSON.stringify({ csrf_token: first.json.csrf_token }),
    });
    expect(revoked.status).toBe(200);
    expect(cookieHeader(revoked.headers)).toContain('otcrm_trusted_device=');

    const csrf = await getLoginCsrf();
    const afterRevoke = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        cookie: mergeCookies(csrf.cookies, trustedDeviceCookie),
        'content-type': 'application/json',
        'x-csrf-token': csrf.token,
      },
      body: JSON.stringify({
        email: 'admin@example.test',
        password: 'AdminPass!234',
        csrf_token: csrf.token,
      }),
    });
    expect(afterRevoke.status).toBe(403);
    expect(await afterRevoke.json()).toMatchObject({ code: 'EMAIL_CHALLENGE_REQUIRED' });
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
    const getSearch = await fetch(`${baseUrl}/api/v1/crm/contacts?search=lead%40example.test`, {
      headers: { cookie: login.cookies },
    });
    expect(getSearch.status).toBe(400);

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
      idempotency_key: 'manual-create-1',
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
        idempotency_key: 'manual-create-2',
      }),
    });
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toMatchObject({ code: 'DUPLICATE_CONTACT' });

    const replay = await apiWrite<ContactJson>('/api/v1/crm/contacts', 'POST', login, {
      display_name: 'Manual Contact',
      family_school_classification: 'school',
      email: 'manual@example.test',
      phone: '050-222-3333',
      location: 'Jerusalem',
      timezone: 'Asia/Jerusalem',
      lead_status: 'new',
      idempotency_key: 'manual-create-1',
      internal_note: 'Asked for school review.',
    });
    expect(replay.contact.contact_id).toBe(created.contact.contact_id);

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

  it('supports durable tags, notes, archive, and provider-off single-recipient reply drafts', async () => {
    const signup = await postLead(signupPayload('reply-ready@example.test', 'idem-reply-ready'));
    expect(signup.status).toBe(200);
    const login = await loginAs('admin@example.test', 'AdminPass!234');
    const list = await apiSearch<ListJson>({ search: 'reply-ready@example.test' }, login);
    const contact = list.contacts[0];
    if (!contact) throw new Error('expected reply-ready contact');

    const firstTag = await apiWrite<TagJson>('/api/v1/crm/tags', 'POST', login, {
      display_name: 'Needs Callback',
    });
    const secondTag = await apiWrite<TagJson>('/api/v1/crm/tags', 'POST', login, {
      display_name: 'Support Watch',
    });
    expect(firstTag.tag.display_name).toBe('Needs Callback');
    await apiWrite<{ success: true; assigned: true }>(
      `/api/v1/crm/contacts/${encodeURIComponent(contact.contact_id)}/tags/${encodeURIComponent(
        firstTag.tag.tag_id,
      )}`,
      'POST',
      login,
      {},
    );
    await apiWrite<{ success: true; assigned: true }>(
      `/api/v1/crm/contacts/${encodeURIComponent(contact.contact_id)}/tags/${encodeURIComponent(
        secondTag.tag.tag_id,
      )}`,
      'POST',
      login,
      {},
    );

    const note = await apiWrite<NoteJson>(
      `/api/v1/crm/contacts/${encodeURIComponent(contact.contact_id)}/notes`,
      'POST',
      login,
      { body: 'Called parent about the support follow-up.' },
    );
    expect(note.note.body).toContain('support follow-up');

    const detail = await apiGet<ContactDetailJson>(
      `/api/v1/crm/contacts/${encodeURIComponent(contact.contact_id)}`,
      login.cookies,
    );
    expect(detail.contact.tags.map((tag) => tag.display_name).sort()).toEqual([
      'Needs Callback',
      'Support Watch',
    ]);
    expect(detail.contact.system_facts.map((fact) => fact.dimension)).toEqual(
      expect.arrayContaining(['lead', 'source', 'signup']),
    );
    expect(detail.contact.notes.map((item) => item.body)).toContain(
      'Called parent about the support follow-up.',
    );
    expect(detail.contact.timeline.some((item) => item.kind === 'note')).toBe(true);

    const replyBody = 'Thanks for writing in. We are reviewing this with the support desk.';
    const preview = await apiWrite<ReplyPreviewJson>(
      `/api/v1/crm/contacts/${encodeURIComponent(contact.contact_id)}/replies/preview`,
      'POST',
      login,
      { channel: 'email', body: replyBody },
    );
    expect(preview.preview).toMatchObject({
      channel: 'email',
      provider_ready: false,
      external_send_allowed: false,
      confirmation_required: true,
      send_mode: 'provider_off_draft',
      blockers: [],
    });
    expect(preview.preview.destination_masked).toContain('@***.');

    const confirmed = await apiWrite<ReplyConfirmJson>(
      `/api/v1/crm/contacts/${encodeURIComponent(contact.contact_id)}/replies/confirm`,
      'POST',
      login,
      {
        channel: 'email',
        body: replyBody,
        body_revision: preview.preview.body_revision,
        idempotency_key: 'reply-idem-ot114',
      },
    );
    expect(confirmed.reply).toMatchObject({
      external_send_attempted: false,
      delivery_state: 'draft_saved_provider_off',
      message: 'Reply draft saved. It was not externally sent.',
    });
    const replay = await apiWrite<ReplyConfirmJson>(
      `/api/v1/crm/contacts/${encodeURIComponent(contact.contact_id)}/replies/confirm`,
      'POST',
      login,
      {
        channel: 'email',
        body: replyBody,
        body_revision: preview.preview.body_revision,
        idempotency_key: 'reply-idem-ot114',
      },
    );
    expect(replay.reply.draft_id).toBe(confirmed.reply.draft_id);

    const replyRows = await pool.query(
      `SELECT drafts.external_send_attempted, events.transport_mode, events.event_type, events.payload
         FROM onetime.crm_reply_drafts AS drafts
         JOIN onetime.outbox_events AS events ON events.delivery_key = drafts.outbox_delivery_key`,
    );
    expect(replyRows.rowCount).toBe(1);
    expect(replyRows.rows[0]).toMatchObject({
      external_send_attempted: false,
      transport_mode: 'sink',
      event_type: 'crm_single_recipient_reply_draft.v1',
    });
    expect(replyRows.rows[0].payload).toMatchObject({ external_send_attempted: false });

    const archived = await apiWrite<{ success: true; archived: true }>(
      `/api/v1/crm/contacts/${encodeURIComponent(contact.contact_id)}/archive`,
      'POST',
      login,
      { reason: 'Completed OT-114 archive smoke.' },
    );
    expect(archived.archived).toBe(true);
    const afterArchive = await apiSearch<ListJson>({ search: 'reply-ready@example.test' }, login);
    expect(afterArchive.contacts).toHaveLength(0);
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

    const list = await apiSearch<ListJson>({ search: 'other@example.test' }, viewer);
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
type TagJson = {
  success: true;
  tag: { tag_id: string; display_name: string; visual_token: string | null };
};
type NoteJson = {
  success: true;
  note: { note_id: string; body: string };
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
type ContactDetailJson = ContactJson & {
  contact: ContactJson['contact'] & {
    tags: Array<{ tag_id: string; display_name: string }>;
    system_facts: Array<{ dimension: string; value: string }>;
    notes: Array<{ note_id: string; body: string }>;
    timeline: Array<{ kind: string; label: string }>;
  };
};
type ReplyPreviewJson = {
  success: true;
  preview: {
    channel: 'email' | 'whatsapp';
    destination_masked: string;
    body_revision: string;
    provider_ready: false;
    external_send_allowed: false;
    confirmation_required: boolean;
    send_mode: 'provider_off_draft';
    blockers: string[];
  };
};
type ReplyConfirmJson = {
  success: true;
  reply: {
    draft_id: string;
    external_send_attempted: false;
    delivery_state: 'draft_saved_provider_off';
    message: string;
  };
};

async function getLoginCsrf() {
  const page = await fetch(`${baseUrl}/login`);
  const html = await page.text();
  const token = html.match(/name="csrf_token" value="([^"]+)"/)?.[1];
  if (!token) throw new Error('missing csrf token');
  return { token, cookies: cookieHeader(page.headers) };
}

async function authenticateDirect(email: string, password: string) {
  const csrf = await getLoginCsrf();
  return fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      cookie: csrf.cookies,
      'content-type': 'application/json',
      'x-csrf-token': csrf.token,
    },
    body: JSON.stringify({ email, password, csrf_token: csrf.token }),
  });
}

async function loginAs(
  email: string,
  password: string,
  options: { trustDevice?: boolean; cookies?: string } = {},
): Promise<LoginResult> {
  const csrf = await getLoginCsrf();
  const requestCookies = mergeCookies(csrf.cookies, options.cookies ?? '');
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      cookie: requestCookies,
      'content-type': 'application/json',
      'x-csrf-token': csrf.token,
    },
    body: JSON.stringify({ email, password, csrf_token: csrf.token }),
  });
  if (response.status === 403) {
    const challenge = (await response.json()) as {
      code?: string;
      challenge_token?: string;
    };
    expect(challenge.code).toBe('EMAIL_CHALLENGE_REQUIRED');
    expect(challenge.challenge_token).toBeTruthy();
    const payload = await latestEmailChallengePayload();
    const verified = await fetch(`${baseUrl}/api/v1/auth/email-challenge/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        challenge_token: challenge.challenge_token,
        code: String(payload.code),
        trust_device: options.trustDevice === true,
      }),
    });
    expect(verified.status).toBe(200);
    return {
      cookies: mergeCookies(requestCookies, cookieHeader(verified.headers)),
      json: (await verified.json()) as LoginResult['json'],
    };
  }
  expect(response.status).toBe(200);
  return {
    cookies: mergeCookies(requestCookies, cookieHeader(response.headers)),
    json: (await response.json()) as LoginResult['json'],
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
  return decryptAuthEmailChallengeDeliveryPayloadForTests(config(), {
    nonce: String(row.nonce),
    ciphertext: String(row.ciphertext),
    auth_tag: String(row.auth_tag),
  });
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
    body: JSON.stringify(body),
  });
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toContain('no-store');
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
  expect([200, 201, 202]).toContain(response.status);
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

function cookieValue(header: string, name: string) {
  for (const part of header.split(';')) {
    const [key, value] = part.trim().split('=');
    if (key === name) return value;
  }
  return undefined;
}
