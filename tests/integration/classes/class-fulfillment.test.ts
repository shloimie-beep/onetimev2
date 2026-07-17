import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../apps/web/src/server/app.ts';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { DELIVERY_EVENT_TYPES } from '../../../packages/contracts/src/delivery/types.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  captureLead,
  createClassPortalAccessAdapter,
  createAccountUser,
  decryptAuthEmailChallengeDeliveryPayloadForTests,
  getClassOccurrenceDetail,
  listClassOccurrences,
} from '../../../packages/domain/src/index.ts';

let pool: DbPool;
let config: AppConfig;

const basePayload = {
  contact_name: 'Miriam Parent',
  family_or_school: 'Dratler Family',
  audience_type: 'family' as const,
  location: 'Ramat Beit Shemesh',
  timezone: 'Asia/Jerusalem',
  email: 'miriam.parent@example.test',
  phone: '',
  reminder_preference: 'email' as const,
  reminder_consent: true,
  idempotency_key: 'class-idem-family-1',
  attribution: { landing_path: '/signup' },
};

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
});

afterEach(async () => {
  await pool.end();
});

describe('OT-71 class fulfillment for signup leads', () => {
  it('commits a family signup then schedules the eligible T-30 class reminder', async () => {
    const result = await captureLead({
      pool,
      config,
      payload: basePayload,
      now: new Date('2026-07-15T12:00:00.000Z'),
    });

    expect(result.outbox_intents).toHaveLength(3);
    await expectCount('contacts', 1);
    await expectCount('signup_leads', 1);
    await expectCount('class_series', 1);
    await expectCount('class_occurrences', 1);
    await expectCount('class_fulfillment_intents', 1);
    await expectCount('outbox_events', 3);

    const reminder = await pool.query(
      `SELECT event_type, channel, next_attempt_at, payload
         FROM onetime.outbox_events
        WHERE event_type = $1`,
      [DELIVERY_EVENT_TYPES.familyClassReminderEmail],
    );
    expect(reminder.rowCount).toBe(1);
    expect(reminder.rows[0].channel).toBe('email');
    expect((reminder.rows[0].next_attempt_at as Date).toISOString()).toBe(
      '2026-07-15T15:30:00.000Z',
    );
    expect(reminder.rows[0].payload).toMatchObject({
      class_local_date: '2026-07-15',
      starts_at: '2026-07-15T16:00:00.000Z',
      provider_state: 'provider_unavailable',
      raw_provider_target_included: false,
    });
    expect(JSON.stringify(reminder.rows[0].payload)).not.toMatch(/https?:\/\/|zoom|vimeo|drive/i);
  });

  it('uses immediate dispatch inside the 18:30-19:00 local reminder window', async () => {
    await captureLead({
      pool,
      config,
      payload: { ...basePayload, email: 'boundary@example.test', idempotency_key: 'boundary-1' },
      now: new Date('2026-07-15T15:45:00.000Z'),
    });

    const reminder = await pool.query(
      `SELECT next_attempt_at, payload
         FROM onetime.outbox_events
        WHERE event_type = $1`,
      [DELIVERY_EVENT_TYPES.familyClassReminderEmail],
    );
    expect((reminder.rows[0].next_attempt_at as Date).toISOString()).toBe(
      '2026-07-15T15:45:00.000Z',
    );
    expect(reminder.rows[0].payload.dispatch_mode).toBe('immediate_t30');
  });

  it('targets the next local class day at and after 19:00', async () => {
    await captureLead({
      pool,
      config,
      payload: { ...basePayload, email: 'next-day@example.test', idempotency_key: 'next-day-1' },
      now: new Date('2026-07-15T16:00:00.000Z'),
    });

    const occurrence = await pool.query(
      `SELECT local_class_date, starts_at, reminder_due_at
         FROM onetime.class_occurrences`,
    );
    expect(localDateKey(occurrence.rows[0].local_class_date)).toBe('2026-07-16');
    expect((occurrence.rows[0].starts_at as Date).toISOString()).toBe('2026-07-16T16:00:00.000Z');
    expect((occurrence.rows[0].reminder_due_at as Date).toISOString()).toBe(
      '2026-07-16T15:30:00.000Z',
    );
  });

  it('does not create class targets, reminders, or entitlement for school submissions', async () => {
    const school = await captureLead({
      pool,
      config,
      payload: {
        ...basePayload,
        audience_type: 'school',
        family_or_school: 'North School',
        email: 'school@example.test',
        idempotency_key: 'school-class-1',
      },
      now: new Date('2026-07-15T12:00:00.000Z'),
    });

    expect(school.outbox_intents).toHaveLength(1);
    await expectCount('class_occurrences', 0);
    await expectCount('class_fulfillment_intents', 0);
    const outbox = await pool.query('SELECT payload FROM onetime.outbox_events');
    expect(outbox.rows.every((row) => row.payload.occurrence_id === null)).toBe(true);
    expect(JSON.stringify(outbox.rows)).not.toMatch(/class_series|provider_state|starts_at/i);
  });

  it('replays idempotently without duplicating occurrences, fulfillment, or reminders', async () => {
    const now = new Date('2026-07-15T12:00:00.000Z');
    await captureLead({ pool, config, payload: basePayload, now });
    const replay = await captureLead({ pool, config, payload: basePayload, now });

    expect(replay.duplicate_submission).toBe(true);
    expect(replay.outbox_intents).toHaveLength(3);
    await expectCount('class_occurrences', 1);
    await expectCount('class_fulfillment_intents', 1);
    await expectCount('outbox_events', 3);
  });

  it('queues both email and WhatsApp reminders when family preference is both', async () => {
    const both = await captureLead({
      pool,
      config,
      payload: {
        ...basePayload,
        email: 'both@example.test',
        phone: '050-111-2222',
        reminder_preference: 'both',
        idempotency_key: 'class-both-1',
      },
      now: new Date('2026-07-15T12:00:00.000Z'),
    });

    expect(both.outbox_intents).toHaveLength(5);
    const reminders = await pool.query(
      `SELECT event_type, channel
         FROM onetime.outbox_events
        WHERE event_type IN ($1, $2)
        ORDER BY channel`,
      [
        DELIVERY_EVENT_TYPES.familyClassReminderEmail,
        DELIVERY_EVENT_TYPES.familyClassReminderWhatsApp,
      ],
    );
    expect(reminders.rows.map((row) => `${row.event_type}:${row.channel}`)).toEqual([
      `${DELIVERY_EVENT_TYPES.familyClassReminderEmail}:email`,
      `${DELIVERY_EVENT_TYPES.familyClassReminderWhatsApp}:whatsapp`,
    ]);
  });

  it('returns owner/admin readiness and portal launch descriptors without provider targets', async () => {
    await captureLead({
      pool,
      config,
      payload: basePayload,
      now: new Date('2026-07-15T12:00:00.000Z'),
    });
    await grantHouseholdBillingAccess('household_alpha');

    const occurrences = await listClassOccurrences({ pool, config });
    expect(occurrences).toHaveLength(1);
    const occurrence = occurrences[0];
    if (!occurrence) throw new Error('Expected an occurrence.');
    expect(occurrence).toMatchObject({
      title: 'Daily One Time Mishnayos',
      access_state: 'provider_unavailable',
      reminder_state: 'pending',
    });

    const detail = await getClassOccurrenceDetail({
      pool,
      config,
      occurrenceKey: occurrence.occurrence_key,
    });
    expect(detail?.readiness).toMatchObject({
      provider_status: 'provider_unavailable',
      protected_launch_required: true,
      raw_provider_target_present: false,
    });
    expect(detail?.fulfillment_counts.queued).toBe(1);

    const portalAdapter = createClassPortalAccessAdapter({ pool, config });
    const upcoming = await portalAdapter.upcomingForLearner({
      actor: {
        account_key: config.accountKey,
        product_key: config.productKey,
        actor_user_ref: 'parent_user_alpha',
        actor_role: 'parent',
        session_key: 'session_parent_alpha',
        capabilities: ['parent:class:launch'],
        authorized_households: [],
        student_learner: null,
      },
      learner: {
        learner_key: 'learner_alpha',
        household_key: 'household_alpha',
        display_name: 'Alpha Learner',
        hebrew_name: null,
        grade_label: null,
        learner_status: 'active',
        version: 1,
        created_at: '2026-07-15T09:00:00.000Z',
        updated_at: '2026-07-15T09:00:00.000Z',
      },
    });
    const launch = await portalAdapter.protectedLaunch({
      actor: {
        account_key: config.accountKey,
        product_key: config.productKey,
        actor_user_ref: 'student_user_alpha',
        actor_role: 'student',
        session_key: 'session_student_alpha',
        capabilities: ['student:class:launch'],
        authorized_households: [],
        student_learner: {
          learner_key: 'learner_alpha',
          household_key: 'household_alpha',
          access_state_key: 'student_access_alpha',
        },
      },
      learner: {
        learner_key: 'learner_alpha',
        household_key: 'household_alpha',
        display_name: 'Alpha Learner',
        hebrew_name: null,
        grade_label: null,
        learner_status: 'active',
        version: 1,
        created_at: '2026-07-15T09:00:00.000Z',
        updated_at: '2026-07-15T09:00:00.000Z',
      },
      class_key: occurrence.occurrence_key,
    });

    const firstUpcoming = upcoming[0];
    if (!firstUpcoming) throw new Error('Expected an upcoming class.');
    expect(firstUpcoming.launch_action).toMatchObject({
      kind: 'class_launch',
      href: null,
      launch_token_ref: 'provider_unavailable',
    });
    expect(launch).toMatchObject({
      kind: 'class_launch',
      href: null,
      launch_token_ref: 'provider_unavailable',
    });
    expect(JSON.stringify({ upcoming, launch, detail })).not.toMatch(
      /https?:\/\/|zoom|vimeo|drive/i,
    );
  });

  it('serves class list/detail APIs only to owner/admin sessions', async () => {
    await captureLead({
      pool,
      config,
      payload: basePayload,
      now: new Date('2026-07-15T12:00:00.000Z'),
    });
    await createAccountUser({
      pool,
      config,
      email: 'owner@example.test',
      password: 'OwnerPass!234',
      displayName: 'Owner User',
      role: 'owner',
      mfaCapable: true,
    });
    await createAccountUser({
      pool,
      config,
      email: 'viewer@example.test',
      password: 'ViewerPass!234',
      displayName: 'Viewer User',
      role: 'viewer',
      mfaCapable: false,
    });

    const server = await listenForTest(createApp({ config, pool }));
    try {
      const owner = await loginAs(server.baseUrl, 'owner@example.test', 'OwnerPass!234');
      const list = await fetch(`${server.baseUrl}/api/v1/classes`, {
        headers: { cookie: owner.cookies },
      });
      const listText = await list.text();
      expect(list.status, listText).toBe(200);
      expect(list.headers.get('cache-control')).toContain('no-store');
      const listJson = JSON.parse(listText) as {
        success: true;
        occurrences: { occurrence_key: string; access_state: string }[];
      };
      expect(listJson.occurrences).toHaveLength(1);
      const occurrence = listJson.occurrences[0];
      if (!occurrence) throw new Error('Expected API occurrence.');
      expect(occurrence.access_state).toBe('provider_unavailable');

      const detail = await fetch(
        `${server.baseUrl}/api/v1/classes/${encodeURIComponent(occurrence.occurrence_key)}`,
        { headers: { cookie: owner.cookies } },
      );
      expect(detail.status).toBe(200);
      const detailJson = (await detail.json()) as {
        success: true;
        occurrence: {
          readiness: { provider_status: string; raw_provider_target_present: boolean };
        };
      };
      expect(detailJson.occurrence.readiness).toMatchObject({
        provider_status: 'provider_unavailable',
        raw_provider_target_present: false,
      });
      expect(JSON.stringify(detailJson)).not.toMatch(/https?:\/\/|zoom|vimeo|drive/i);

      const viewer = await loginAs(server.baseUrl, 'viewer@example.test', 'ViewerPass!234');
      const denied = await fetch(`${server.baseUrl}/api/v1/classes`, {
        headers: { cookie: viewer.cookies },
      });
      expect(denied.status).toBe(403);
    } finally {
      await server.close();
    }
  });
});

async function expectCount(table: string, expected: number) {
  const counts = await pool.query(`SELECT count(*)::int AS count FROM onetime.${table}`);
  const count = Array.isArray(counts.rows[0].count)
    ? counts.rows[0].count[0]
    : counts.rows[0].count;
  expect(count).toBe(expected);
}

async function grantHouseholdBillingAccess(householdKey: string) {
  await pool.query(
    `INSERT INTO onetime.billing_entitlement_projections
       (entitlement_key, account_key, product_key, principal_key, principal_type,
        status, policy_version, source, reason, effective_at, evaluated_at, grants_access)
     VALUES (
       'billing_entitlement:' || $1 || ':' || $2 || ':' || $3,
       $1,
       $2,
       $3,
       'opaque',
       'active',
       '2026-07-15.1',
       'test_fixture_paid_invoice',
       'active_paid_current_invoice',
       '2026-07-15T12:00:00.000Z',
       '2026-07-15T12:00:01.000Z',
       true
     )`,
    [config.accountKey, config.productKey, householdKey],
  );
}

function localDateKey(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
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
  if (response.status === 403) {
    const challenge = (await response.json()) as { code?: string; challenge_token?: string };
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
    expect(verified.status).toBe(200);
    return {
      cookies: mergeCookies(csrf.cookies, cookieHeader(verified.headers)),
      json: (await verified.json()) as { csrf_token: string },
    };
  }
  expect(response.status).toBe(200);
  return {
    cookies: mergeCookies(csrf.cookies, cookieHeader(response.headers)),
    json: (await response.json()) as { csrf_token: string },
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
