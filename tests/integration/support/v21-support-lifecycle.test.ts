import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../apps/web/src/server/app.ts';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import type {
  SupportAdminView,
  SupportRequesterView,
} from '../../../packages/contracts/src/support/v21.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import { createAccountUser, createSession } from '../../../packages/domain/src/index.ts';

type TestSession = Awaited<ReturnType<typeof createSession>>;

let config: AppConfig;
let pool: DbPool;
let server: ReturnType<ReturnType<typeof createApp>['listen']>;
let baseUrl: string;
let parent: TestSession;
let student: TestSession;
let admin: TestSession;

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'support-v21-test',
    COMMIT_SHA: 'support-v21-test',
    OUTBOX_TRANSPORT_MODE: 'sink',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
  await seedPrincipals();
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

describe('v2.1 durable support lifecycle', () => {
  it('persists isolated Parent and Student conversations through the complete Admin lifecycle', async () => {
    const parentContext = await api(parent, '/api/v1/support/v21/context');
    expect(parentContext.status).toBe(200);
    expect(await parentContext.json()).toMatchObject({
      role: 'parent',
      can_create_ticket: true,
      categories: expect.arrayContaining([{ value: 'billing', label: 'Billing' }]),
    });

    const studentContext = await api(student, '/api/v1/support/v21/context');
    expect(studentContext.status).toBe(200);
    expect(await studentContext.json()).toMatchObject({
      role: 'student',
      categories: expect.arrayContaining([
        { value: 'torah_question', label: 'Private Torah question' },
      ]),
    });

    const missingCsrf = await api(parent, '/api/v1/support/v21/tickets', {
      method: 'POST',
      body: JSON.stringify(parentPayload()),
      omitCsrf: true,
    });
    expect(missingCsrf.status).toBe(403);
    expect(await missingCsrf.json()).toMatchObject({ code: 'CSRF_REQUIRED' });

    const parentCreated = await api(parent, '/api/v1/support/v21/tickets', {
      method: 'POST',
      body: JSON.stringify(parentPayload()),
    });
    expect(parentCreated.status).toBe(201);
    const parentTicket = (await parentCreated.json()) as {
      data: SupportRequesterView;
    };
    expect(parentTicket.data).toMatchObject({
      requesterRole: 'parent',
      requesterHouseholdId: 'household_support',
      requesterStudentId: null,
      ghlConversationLinked: false,
      status: 'open',
      version: 1,
    });

    const parentReplay = await api(parent, '/api/v1/support/v21/tickets', {
      method: 'POST',
      body: JSON.stringify(parentPayload()),
    });
    expect(parentReplay.status).toBe(201);
    expect((await parentReplay.json()) as { data: SupportRequesterView }).toMatchObject({
      data: { ticketId: parentTicket.data.ticketId },
    });

    const conflict = await api(parent, '/api/v1/support/v21/tickets', {
      method: 'POST',
      body: JSON.stringify({ ...parentPayload(), body: 'A different request body long enough.' }),
    });
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ code: 'idempotency_conflict' });

    const studentCreated = await api(student, '/api/v1/support/v21/tickets', {
      method: 'POST',
      body: JSON.stringify({
        kind: 'rabbi_question',
        category: 'torah_question',
        subject: 'Question about the Mishnah',
        body: 'Could Rabbi explain this Mishnah in a little more detail?',
        idempotency_key: 'student-rabbi-question-001',
      }),
    });
    expect(studentCreated.status).toBe(201);
    const studentTicket = (await studentCreated.json()) as { data: SupportRequesterView };
    expect(studentTicket.data).toMatchObject({
      requesterRole: 'student',
      requesterHouseholdId: 'household_support',
      requesterStudentId: 'learner_support',
      kind: 'rabbi_question',
      ghlConversationLinked: false,
    });

    const parentCannotReadStudent = await api(
      parent,
      `/api/v1/support/v21/tickets/${studentTicket.data.ticketId}`,
    );
    expect(parentCannotReadStudent.status).toBe(404);

    const studentList = await api(student, '/api/v1/support/v21/tickets');
    const studentListJson = (await studentList.json()) as { data: SupportRequesterView[] };
    expect(studentListJson.data.map((ticket) => ticket.ticketId)).toEqual([
      studentTicket.data.ticketId,
    ]);

    const adminList = await api(admin, '/api/v1/admin/support/v21/tickets');
    expect(adminList.status).toBe(200);
    const adminListJson = (await adminList.json()) as { data: SupportAdminView[] };
    expect(adminListJson.data.map((ticket) => ticket.ticketId).sort()).toEqual(
      [parentTicket.data.ticketId, studentTicket.data.ticketId].sort(),
    );

    const assigned = await adminWrite(parentTicket.data.ticketId, 'assign', {
      assignee_admin_id: admin.user.user_key,
      expected_version: 1,
    });
    expect(assigned.status).toBe(200);
    expect(await assigned.json()).toMatchObject({
      data: { assigneeAdminId: admin.user.user_key, version: 2 },
    });

    const stale = await adminWrite(parentTicket.data.ticketId, 'status', {
      status: 'in_progress',
      expected_version: 1,
    });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ code: 'version_conflict' });

    await expectAdminVersion(
      parentTicket.data.ticketId,
      'status',
      { status: 'in_progress', expected_version: 2 },
      3,
    );
    await expectAdminVersion(
      parentTicket.data.ticketId,
      'reply',
      {
        body: 'Please sign out, sign back in, and try the class page again.',
        expected_version: 3,
        idempotency_key: 'admin-reply-support-001',
      },
      4,
    );
    await expectAdminVersion(
      parentTicket.data.ticketId,
      'status',
      { status: 'resolved', expected_version: 4 },
      5,
    );
    await expectAdminVersion(
      parentTicket.data.ticketId,
      'status',
      { status: 'closed', expected_version: 5 },
      6,
    );

    const invalidReopen = await adminWrite(parentTicket.data.ticketId, 'status', {
      status: 'open',
      expected_version: 6,
    });
    expect(invalidReopen.status).toBe(400);
    expect(await invalidReopen.json()).toMatchObject({ code: 'invalid_transition' });

    const persisted = await pool.query(
      `SELECT requester_role, student_id, ghl_conversation_id, status, version
         FROM onetime.support_tickets_v21
        ORDER BY requester_role ASC`,
    );
    expect(persisted.rows).toEqual([
      expect.objectContaining({
        requester_role: 'parent',
        student_id: null,
        ghl_conversation_id: null,
        status: 'closed',
        version: 6,
      }),
      expect.objectContaining({
        requester_role: 'student',
        student_id: 'learner_support',
        ghl_conversation_id: null,
        status: 'open',
        version: 1,
      }),
    ]);

    const intents = await pool.query(
      `SELECT redacted_summary, contains_private_body, contains_student_identity,
              provider_is_source_of_truth, state
         FROM onetime.support_notification_intents_v21
        ORDER BY created_at ASC, intent_id ASC`,
    );
    expect(intents.rows).toHaveLength(6);
    expect(intents.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          redacted_summary: 'New private Student Rabbi question',
          contains_private_body: false,
          contains_student_identity: false,
          provider_is_source_of_truth: false,
          state: 'pending',
        }),
      ]),
    );
    expect(JSON.stringify(intents.rows)).not.toContain('Could Rabbi explain');

    const retiredOutbox = await pool.query(
      `SELECT count(*)::int AS count FROM onetime.support_outbox`,
    );
    expect(Number(retiredOutbox.rows[0]?.count ?? 0)).toBe(0);
  });
});

function parentPayload() {
  return {
    kind: 'technical_support',
    category: 'technical',
    subject: 'Class page will not open',
    body: 'The class page stays blank after I sign in and choose the current class.',
    idempotency_key: 'parent-support-ticket-001',
  };
}

async function api(
  session: TestSession,
  path: string,
  options: { method?: string; body?: string; omitCsrf?: boolean } = {},
) {
  return fetch(`${baseUrl}${path}`, {
    ...(options.method ? { method: options.method } : {}),
    headers: {
      cookie: authCookies(session),
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(!options.omitCsrf && options.method ? { 'x-csrf-token': session.csrf_token } : {}),
    },
    ...(options.body ? { body: options.body } : {}),
  });
}

async function adminWrite(ticketId: string, action: 'assign' | 'status' | 'reply', body: unknown) {
  return api(admin, `/api/v1/admin/support/v21/tickets/${ticketId}/${action}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function expectAdminVersion(
  ticketId: string,
  action: 'status' | 'reply',
  body: unknown,
  version: number,
) {
  const response = await adminWrite(ticketId, action, body);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: { version } });
}

async function seedPrincipals() {
  const parentKey = await createAccountUser({
    pool,
    config,
    email: 'support-parent@example.test',
    password: 'SupportParent!234',
    displayName: 'Support Parent',
    role: 'parent',
  });
  const studentKey = await createAccountUser({
    pool,
    config,
    email: 'support-student@example.test',
    password: 'SupportStudent!234',
    displayName: 'Support Student',
    role: 'student',
  });
  const adminKey = await createAccountUser({
    pool,
    config,
    email: 'support-admin@example.test',
    password: 'SupportAdmin!234',
    displayName: 'Support Admin',
    role: 'owner',
  });

  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name)
     VALUES ('household_support', $1, $2, 'Support Family')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_guardian_relationships
       (relationship_key, account_key, product_key, household_key, guardian_user_ref,
        relationship_label, authority)
     VALUES ('relationship_support', $1, $2, 'household_support', $3, 'Parent',
             'primary_guardian')`,
    [config.accountKey, config.productKey, parentKey],
  );
  await pool.query(
    `INSERT INTO onetime.account_access_projections
       (access_key, account_key, product_key, household_key, state, source_kind,
        effective_at, expires_at, opaque_source_reference, source_revision,
        source_updated_at, source_request_hash, policy_version, last_event_key)
     VALUES ('support_v21_access', $1, $2, 'household_support', 'active', 'free_pilot',
             now() - interval '1 hour', now() + interval '30 days',
             'support-v21-free-pilot', 1, now(), $3,
             'support-v21-access-v1', 'support_v21_access_seed')`,
    [config.accountKey, config.productKey, 'f'.repeat(64)],
  );
  await pool.query(
    `INSERT INTO onetime.portal_learners
       (learner_key, account_key, product_key, household_key, display_name)
     VALUES ('learner_support', $1, $2, 'household_support', 'Support Learner')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.account_learner_identity_links
       (link_key, account_key, product_key, household_key, learner_key, user_key)
     VALUES ('learner_link_support', $1, $2, 'household_support', 'learner_support', $3)`,
    [config.accountKey, config.productKey, studentKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_student_access_state
       (access_state_key, account_key, product_key, household_key, learner_key,
        student_user_ref, status)
     VALUES ('student_access_support', $1, $2, 'household_support', 'learner_support', $3,
             'active')`,
    [config.accountKey, config.productKey, studentKey],
  );

  parent = await createSession({
    pool,
    config,
    user: {
      user_key: parentKey,
      email: 'support-parent@example.test',
      display_name: 'Support Parent',
      role: 'parent',
      role_label: 'Parent',
      mfa_capable: false,
    },
  });
  student = await createSession({
    pool,
    config,
    user: {
      user_key: studentKey,
      email: 'support-student@example.test',
      display_name: 'Support Student',
      role: 'student',
      role_label: 'Student',
      mfa_capable: false,
    },
  });
  admin = await createSession({
    pool,
    config,
    user: {
      user_key: adminKey,
      email: 'support-admin@example.test',
      display_name: 'Support Admin',
      role: 'owner',
      role_label: 'Owner',
      mfa_capable: false,
    },
  });
}

function authCookies(session: TestSession) {
  return `otcrm_session=${session.session_token}; otcrm_csrf=${session.csrf_token}`;
}
