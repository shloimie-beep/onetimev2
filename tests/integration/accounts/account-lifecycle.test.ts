import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  acceptOwnerAdminInvitation,
  acceptParentActivation,
  acceptStudentSetup,
  authenticateUser,
  completePasswordReset,
  completeStudentReset,
  createAccountUser,
  createOwnerAdminInvitation,
  createParentActivation,
  createSession,
  createStudentReset,
  createStudentSetup,
  decryptLifecycleDeliveryPayloadForTests,
  getSessionByToken,
  requestPasswordReset,
  restoreStudentIdentity,
  revokeStudentIdentitySessions,
  runLifecycleDeliveryOutboxBatch,
  suspendStudentIdentity,
} from '../../../packages/domain/src/index.ts';

let pool: DbPool;
let config: AppConfig;
let ownerUserKey: string;

const ownerActor = () => ({ userKey: ownerUserKey, role: 'owner' });
const householdKey = 'household_alpha';
const learnerKey = 'learner_alpha';

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
  ownerUserKey = await createAccountUser({
    pool,
    config,
    email: 'owner@example.test',
    password: 'OwnerPass!234',
    displayName: 'Owner User',
    role: 'owner',
    mfaCapable: true,
  });
  await seedPortalRecords();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await pool.end();
});

describe('OT-71 account lifecycle', () => {
  it('issues and accepts owner/admin invitations without persisting raw token material', async () => {
    const issuedAt = new Date('2026-07-15T10:00:00.000Z');
    const issued = await createOwnerAdminInvitation({
      pool,
      config,
      actor: ownerActor(),
      includeLocalProofToken: true,
      payload: {
        idempotency_key: 'invite-admin-001',
        email: 'admin.invited@example.test',
        display_name: 'Invited Admin',
        role: 'admin',
      },
      now: issuedAt,
    });
    const token = issued.token_for_local_proof;
    if (!token) throw new Error('Expected local proof token.');

    expect(issued).toMatchObject({
      token_type: 'owner_admin_invitation',
      target_role: 'admin',
      raw_token_included: false,
      delivery: {
        delivery_state: 'sink_queued',
        external_send_performed: false,
        raw_token_included: false,
      },
    });
    expect(await serializedLifecycleRows()).not.toContain(token);
    expect(new Date(issued.expires_at).getTime() - issuedAt.getTime()).toBe(24 * 60 * 60 * 1000);

    const queuedOutbox = await lifecycleDeliveryRows();
    expect(queuedOutbox).toHaveLength(1);
    expect(JSON.stringify(queuedOutbox)).not.toContain(token);
    const encryptedPayload = decryptLifecycleDeliveryPayloadForTests(config, {
      nonce: requiredRowString(queuedOutbox[0], 'nonce'),
      ciphertext: requiredRowString(queuedOutbox[0], 'ciphertext'),
      auth_tag: requiredRowString(queuedOutbox[0], 'auth_tag'),
    });
    expect(encryptedPayload).toMatchObject({
      purpose: 'owner_admin_invitation',
      token_key: issued.token_key,
      token,
      activation_url: `${config.publicBaseUrl}/activate#token=${encodeURIComponent(token)}`,
      target_role: 'admin',
    });

    const workerSummary = await runLifecycleDeliveryOutboxBatch({
      pool,
      config,
      now: new Date('2026-07-15T10:01:00.000Z'),
      workerId: 'account-lifecycle-test-worker',
    });
    expect(workerSummary).toMatchObject({
      claimed: 1,
      sink_delivered: 1,
      expired: 0,
      external_send_performed: false,
      raw_token_logged: false,
    });
    const deliveredOutbox = await lifecycleDeliveryRows();
    expect(deliveredOutbox[0]).toMatchObject({
      state: 'sink_delivered',
      nonce: null,
      ciphertext: null,
      auth_tag: null,
    });

    const replay = await createOwnerAdminInvitation({
      pool,
      config,
      actor: ownerActor(),
      includeLocalProofToken: true,
      payload: {
        idempotency_key: 'invite-admin-001',
        email: 'admin.invited@example.test',
        display_name: 'Invited Admin',
        role: 'admin',
      },
    });
    expect(replay.token_key).toBe(issued.token_key);
    expect(replay.token_for_local_proof).toBeUndefined();

    await expect(
      createOwnerAdminInvitation({
        pool,
        config,
        actor: ownerActor(),
        payload: {
          idempotency_key: 'invite-admin-001',
          email: 'changed@example.test',
          display_name: 'Changed Admin',
          role: 'admin',
        },
      }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });

    const accepted = await acceptOwnerAdminInvitation({
      pool,
      config,
      payload: { token, password: 'AdminPass!234' },
      now: new Date('2026-07-15T10:05:00.000Z'),
    });
    expect(accepted).toMatchObject({ role: 'admin', status: 'active', mfa_required: false });

    const passwordOnly = await authenticateUser({
      pool,
      config,
      email: 'admin.invited@example.test',
      password: 'AdminPass!234',
    });
    expect(passwordOnly).toMatchObject({ ok: false, code: 'EMAIL_CHALLENGE_REQUIRED' });
    await expect(
      acceptOwnerAdminInvitation({
        pool,
        config,
        payload: { token, password: 'AnotherPass!234' },
      }),
    ).rejects.toMatchObject({ code: 'TOKEN_CONSUMED' });
  });

  it('resending an owner/admin invitation supersedes the old encrypted delivery and token', async () => {
    const first = await createOwnerAdminInvitation({
      pool,
      config,
      actor: ownerActor(),
      includeLocalProofToken: true,
      payload: {
        idempotency_key: 'invite-admin-resend-001',
        email: 'resend.admin@example.test',
        display_name: 'Resent Admin',
        role: 'admin',
      },
      now: new Date('2026-07-15T10:00:00.000Z'),
    });
    const firstToken = requiredProof(first);

    const second = await createOwnerAdminInvitation({
      pool,
      config,
      actor: ownerActor(),
      includeLocalProofToken: true,
      payload: {
        idempotency_key: 'invite-admin-resend-002',
        email: 'resend.admin@example.test',
        display_name: 'Resent Admin',
        role: 'admin',
      },
      now: new Date('2026-07-15T10:03:00.000Z'),
    });
    const secondToken = requiredProof(second);

    expect(first.token_key).not.toBe(second.token_key);
    await expect(
      acceptOwnerAdminInvitation({
        pool,
        config,
        payload: { token: firstToken, password: 'AdminPass!111' },
      }),
    ).rejects.toMatchObject({ code: 'TOKEN_INVALID' });

    const deliveries = await lifecycleDeliveryRows();
    expect(deliveries).toHaveLength(2);
    const firstDelivery = deliveries.find((row) => row.token_key === first.token_key);
    const secondDelivery = deliveries.find((row) => row.token_key === second.token_key);
    expect(firstDelivery).toMatchObject({
      state: 'superseded',
      nonce: null,
      ciphertext: null,
      auth_tag: null,
    });
    expect(secondDelivery).toMatchObject({ state: 'queued' });

    const accepted = await acceptOwnerAdminInvitation({
      pool,
      config,
      payload: { token: secondToken, password: 'AdminPass!222' },
      now: new Date('2026-07-15T10:08:00.000Z'),
    });
    expect(accepted).toMatchObject({ role: 'admin', status: 'active' });
  });

  it('delivers exactly one lifecycle email through Resend for the configured canary destination', async () => {
    const canaryConfig = loadConfig({
      NODE_ENV: 'test',
      PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
      APP_VERSION: 'test',
      COMMIT_SHA: 'test',
      OUTBOX_TRANSPORT_MODE: 'sink',
      ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED: 'true',
      ONE_TIME_RESEND_TRANSPORT_ENABLED: 'true',
      ONE_TIME_DELIVERY_TEST_CANARY_EMAIL: 'canary@example.test',
      ONE_TIME_EMAIL_FROM: 'One Time <delivery@example.test>',
      ONE_TIME_EMAIL_REPLY_TO: 'reply@example.test',
      RESEND_API_KEY: 'test_resend_key',
    });
    const requests: Array<{ url: string; body: Record<string, unknown>; headers: Headers }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        requests.push({
          url: String(url),
          body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
          headers: new Headers(init?.headers),
        });
        return new Response(JSON.stringify({ id: 'email_provider_message_001' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    await createOwnerAdminInvitation({
      pool,
      config: canaryConfig,
      actor: ownerActor(),
      payload: {
        idempotency_key: 'invite-admin-provider-001',
        email: 'canary@example.test',
        display_name: 'Canary Admin',
        role: 'admin',
      },
      now: new Date('2026-07-15T10:00:00.000Z'),
    });

    const summary = await runLifecycleDeliveryOutboxBatch({
      pool,
      config: canaryConfig,
      now: new Date('2026-07-15T10:01:00.000Z'),
      workerId: 'account-lifecycle-provider-worker',
    });

    expect(summary).toMatchObject({
      claimed: 1,
      provider_delivered: 1,
      sink_delivered: 0,
      external_send_performed: true,
      raw_token_logged: false,
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe('https://api.resend.com/emails');
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer test_resend_key');
    expect(requests[0]?.body).toMatchObject({
      from: 'One Time <delivery@example.test>',
      to: ['canary@example.test'],
      reply_to: ['reply@example.test'],
      subject: 'Activate your One Time account',
    });
    expect(String(requests[0]?.body.text)).toContain('/activate#token=');

    const deliveredOutbox = await lifecycleDeliveryRows();
    expect(deliveredOutbox[0]).toMatchObject({
      state: 'provider_delivered',
      nonce: null,
      ciphertext: null,
      auth_tag: null,
    });
  });

  it('expires queued lifecycle deliveries and clears encrypted token material', async () => {
    const issuedAt = new Date('2026-07-15T10:00:00.000Z');
    const issued = await createOwnerAdminInvitation({
      pool,
      config,
      actor: ownerActor(),
      includeLocalProofToken: true,
      payload: {
        idempotency_key: 'invite-admin-expiry-001',
        email: 'expiry.admin@example.test',
        display_name: 'Expired Admin',
        role: 'admin',
      },
      now: issuedAt,
    });
    const token = requiredProof(issued);
    const expiresAt = new Date(issued.expires_at);

    const summary = await runLifecycleDeliveryOutboxBatch({
      pool,
      config,
      now: new Date(expiresAt.getTime() + 1),
      workerId: 'account-lifecycle-expiry-worker',
    });
    expect(summary).toMatchObject({
      claimed: 0,
      sink_delivered: 0,
      expired: 1,
      external_send_performed: false,
      raw_token_logged: false,
    });
    const [delivery] = await lifecycleDeliveryRows();
    expect(delivery).toMatchObject({
      state: 'expired',
      nonce: null,
      ciphertext: null,
      auth_tag: null,
    });
    await expect(
      acceptOwnerAdminInvitation({
        pool,
        config,
        payload: { token, password: 'AdminPass!333' },
        now: new Date(expiresAt.getTime() + 1),
      }),
    ).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' });
  });

  it('activates parent identity and manages student setup, reset, suspend, and restore', async () => {
    const parentIssue = await createParentActivation({
      pool,
      config,
      actor: ownerActor(),
      includeLocalProofToken: true,
      payload: {
        idempotency_key: 'parent-activation-001',
        email: 'parent@example.test',
        display_name: 'Parent User',
        household_key: householdKey,
        relationship_key: 'relationship_alpha',
        relationship_label: 'Parent',
        authority: 'primary_guardian',
      },
    });
    const parentToken = requiredProof(parentIssue);
    const parent = await acceptParentActivation({
      pool,
      config,
      payload: { token: parentToken, password: 'ParentPass!234' },
    });
    expect(parent).toMatchObject({ role: 'parent', status: 'active', mfa_required: false });

    const relationship = await pool.query(
      `SELECT guardian_user_ref
         FROM onetime.portal_guardian_relationships
        WHERE relationship_key = 'relationship_alpha'`,
    );
    expect(relationship.rows[0].guardian_user_ref).toBe(parent.user_key);

    const parentActor = { userKey: parent.user_key, role: 'parent' };
    const studentIssue = await createStudentSetup({
      pool,
      config,
      actor: parentActor,
      includeLocalProofToken: true,
      payload: {
        idempotency_key: 'student-setup-001',
        email: 'student@example.test',
        display_name: 'Student User',
        household_key: householdKey,
        learner_key: learnerKey,
      },
    });
    const student = await acceptStudentSetup({
      pool,
      config,
      payload: { token: requiredProof(studentIssue), password: 'StudentPass!234' },
    });
    expect(student).toMatchObject({ role: 'student', status: 'active', mfa_required: false });

    const login = await authenticateUser({
      pool,
      config,
      email: 'student@example.test',
      password: 'StudentPass!234',
    });
    if (!login.ok) throw new Error(`Expected student login, got ${login.code}`);
    const session = await createSession({ pool, config, user: login.user });
    expect(await getSessionByToken({ pool, config, sessionToken: session.session_token })).not.toBe(
      null,
    );

    const suspended = await suspendStudentIdentity({
      pool,
      config,
      actor: parentActor,
      learnerKey,
    });
    expect(suspended).toMatchObject({ access_status: 'suspended', sessions_invalidated: 1 });
    expect(
      await getSessionByToken({ pool, config, sessionToken: session.session_token }),
    ).toBeNull();

    const restored = await restoreStudentIdentity({
      pool,
      config,
      actor: parentActor,
      learnerKey,
    });
    expect(restored).toMatchObject({ access_status: 'active' });

    const postRestoreLogin = await authenticateUser({
      pool,
      config,
      email: 'student@example.test',
      password: 'StudentPass!234',
    });
    if (!postRestoreLogin.ok)
      throw new Error(`Expected student login, got ${postRestoreLogin.code}`);
    const postRestoreSession = await createSession({ pool, config, user: postRestoreLogin.user });
    const revoked = await revokeStudentIdentitySessions({
      pool,
      config,
      actor: parentActor,
      learnerKey,
    });
    expect(revoked).toMatchObject({ access_status: 'active', sessions_invalidated: 1 });
    expect(
      await getSessionByToken({ pool, config, sessionToken: postRestoreSession.session_token }),
    ).toBeNull();

    const resetIssue = await createStudentReset({
      pool,
      config,
      actor: parentActor,
      includeLocalProofToken: true,
      payload: {
        idempotency_key: 'student-reset-001',
        learner_key: learnerKey,
      },
    });
    const reset = await completeStudentReset({
      pool,
      config,
      payload: { token: requiredProof(resetIssue), password: 'StudentPass!999' },
    });
    expect(reset.sessions_invalidated).toBe(0);
    const oldPassword = await authenticateUser({
      pool,
      config,
      email: 'student@example.test',
      password: 'StudentPass!234',
    });
    expect(oldPassword).toMatchObject({ ok: false, code: 'INVALID_CREDENTIALS' });
    const newPassword = await authenticateUser({
      pool,
      config,
      email: 'student@example.test',
      password: 'StudentPass!999',
    });
    expect(newPassword).toMatchObject({ ok: true });
    expect(await serializedLifecycleRows()).not.toMatch(/StudentPass|ParentPass|token_for_local/i);
  });

  it('completes password reset with single-use tokens and session-family invalidation', async () => {
    const parent = await createParentWithPassword('parent-reset@example.test', 'ParentPass!234');
    const login = await authenticateUser({
      pool,
      config,
      email: 'parent-reset@example.test',
      password: 'ParentPass!234',
    });
    if (!login.ok) throw new Error(`Expected parent login, got ${login.code}`);
    const session = await createSession({ pool, config, user: login.user });

    const resetRequestedAt = new Date('2026-07-15T10:00:00.000Z');
    const resetIssue = await requestPasswordReset({
      pool,
      config,
      includeLocalProofToken: true,
      payload: {
        idempotency_key: 'password-reset-001',
        email: 'parent-reset@example.test',
      },
      now: resetRequestedAt,
    });
    if (!('token_for_local_proof' in resetIssue) || !resetIssue.token_for_local_proof) {
      throw new Error('Expected password reset local proof token.');
    }
    expect(resetIssue.raw_token_included).toBe(false);
    expect(new Date(resetIssue.expires_at).getTime() - resetRequestedAt.getTime()).toBe(
      30 * 60 * 1000,
    );

    const completed = await completePasswordReset({
      pool,
      config,
      payload: { token: resetIssue.token_for_local_proof, password: 'ParentPass!999' },
      now: new Date('2026-07-15T10:10:00.000Z'),
    });
    expect(completed).toMatchObject({
      user_key: parent.user_key,
      role: 'parent',
      sessions_invalidated: 1,
    });
    expect(
      await getSessionByToken({ pool, config, sessionToken: session.session_token }),
    ).toBeNull();
    await expect(
      completePasswordReset({
        pool,
        config,
        payload: { token: resetIssue.token_for_local_proof, password: 'ParentPass!000' },
      }),
    ).rejects.toMatchObject({ code: 'TOKEN_CONSUMED' });
  });
});

async function seedPortalRecords() {
  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name)
     VALUES ($1, $2, $3, 'Alpha Family')`,
    [householdKey, config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_learners
       (learner_key, account_key, product_key, household_key, display_name)
     VALUES ($1, $2, $3, $4, 'Alpha Student')`,
    [learnerKey, config.accountKey, config.productKey, householdKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_student_access_state
       (access_state_key, account_key, product_key, household_key, learner_key, status)
     VALUES ('access_alpha', $1, $2, $3, $4, 'not_configured')`,
    [config.accountKey, config.productKey, householdKey, learnerKey],
  );
}

async function createParentWithPassword(email: string, password: string) {
  const issue = await createParentActivation({
    pool,
    config,
    actor: ownerActor(),
    includeLocalProofToken: true,
    payload: {
      idempotency_key: `parent-${email}`,
      email,
      display_name: 'Reset Parent',
      household_key: householdKey,
      relationship_key: `relationship_${email.replace(/[^a-z0-9]/gi, '_')}`,
      relationship_label: 'Parent',
    },
  });
  return acceptParentActivation({
    pool,
    config,
    payload: { token: requiredProof(issue), password },
  });
}

function requiredProof(issue: { token_for_local_proof?: string }) {
  if (!issue.token_for_local_proof) throw new Error('Expected local proof token.');
  return issue.token_for_local_proof;
}

async function serializedLifecycleRows() {
  const rows = await pool.query(
    `SELECT
       (SELECT json_agg(tokens) FROM onetime.account_lifecycle_tokens AS tokens) AS tokens,
       (SELECT json_agg(intents) FROM onetime.account_lifecycle_delivery_intents AS intents) AS intents,
       (SELECT json_agg(outbox) FROM onetime.account_lifecycle_delivery_outbox AS outbox) AS outbox,
       (SELECT json_agg(idem) FROM onetime.account_lifecycle_idempotency_records AS idem) AS idempotency`,
  );
  return JSON.stringify(rows.rows);
}

async function lifecycleDeliveryRows() {
  const rows = await pool.query(
    `SELECT delivery_key, token_key, intent_key, purpose, transport_mode, destination_ref,
            key_id, key_version, nonce, ciphertext, auth_tag, encrypted_payload_expires_at,
            state, attempts, max_attempts, idempotency_key, provider_message_ref_hash,
            delivered_at, dead_lettered_at, cleared_at, metadata
       FROM onetime.account_lifecycle_delivery_outbox
      ORDER BY created_at ASC, delivery_key ASC`,
  );
  return rows.rows as Array<Record<string, unknown>>;
}

function requiredRowString(row: Record<string, unknown> | undefined, key: string) {
  const value = row?.[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Expected lifecycle delivery ${key}.`);
  }
  return value;
}
