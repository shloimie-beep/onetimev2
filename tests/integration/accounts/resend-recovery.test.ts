import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  completePasswordReset,
  createAccountUser,
  createOwnerAdminInvitation,
  createSession,
  createStudentSetup,
  getSessionByToken,
  requestPasswordReset,
  runLifecycleDeliveryOutboxBatch,
} from '../../../packages/domain/src/index.ts';

let pool: DbPool;
let config: AppConfig;
let ownerUserKey: string;

beforeEach(async () => {
  config = baseConfig();
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
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await pool.end();
});

describe('OT-P1 Resend recovery', () => {
  it('creates one durable 60-minute reset, invalidates the older token, consumes once, and revokes sessions', async () => {
    const issuedAt = new Date('2026-08-09T08:00:00.000Z');
    const first = await requestPasswordReset({
      pool,
      config,
      includeLocalProofToken: true,
      payload: { idempotency_key: 'reset-request-001', email: 'owner@example.test' },
      now: issuedAt,
    });
    const duplicate = await requestPasswordReset({
      pool,
      config,
      includeLocalProofToken: true,
      payload: { idempotency_key: 'reset-request-001', email: 'owner@example.test' },
      now: new Date(issuedAt.getTime() + 1_000),
    });
    expect(duplicate).toEqual({
      ...first,
      token_for_local_proof: undefined,
    });
    expect(duplicate).not.toHaveProperty('token_for_local_proof');
    expect(new Date(requiredIssue(first).expires_at).getTime() - issuedAt.getTime()).toBe(
      60 * 60 * 1000,
    );
    expect((await resetRows()).intents).toBe(1);
    expect((await resetRows()).outbox).toBe(1);

    const second = await requestPasswordReset({
      pool,
      config,
      includeLocalProofToken: true,
      payload: { idempotency_key: 'reset-request-002', email: 'owner@example.test' },
      now: new Date(issuedAt.getTime() + 5 * 60 * 1000),
    });
    await expect(
      completePasswordReset({
        pool,
        config,
        payload: { token: requiredProof(first), password: 'OwnerPass!345' },
        now: new Date(issuedAt.getTime() + 10 * 60 * 1000),
      }),
    ).rejects.toMatchObject({ code: 'TOKEN_INVALID' });

    const session = await createSession({
      pool,
      config,
      user: {
        user_key: ownerUserKey,
        email: 'owner@example.test',
        display_name: 'Owner User',
        role: 'owner',
        role_label: 'Admin',
        mfa_capable: true,
      },
    });
    const completed = await completePasswordReset({
      pool,
      config,
      payload: { token: requiredProof(second), password: 'OwnerPass!999' },
      now: new Date(issuedAt.getTime() + 15 * 60 * 1000),
    });
    expect(completed.sessions_invalidated).toBe(1);
    expect(
      await getSessionByToken({ pool, config, sessionToken: session.session_token }),
    ).toBeNull();
    await expect(
      completePasswordReset({
        pool,
        config,
        payload: { token: requiredProof(second), password: 'OwnerPass!000' },
      }),
    ).rejects.toMatchObject({ code: 'TOKEN_CONSUMED' });
    const expiring = await requestPasswordReset({
      pool,
      config,
      includeLocalProofToken: true,
      payload: { idempotency_key: 'reset-request-003', email: 'owner@example.test' },
      now: new Date(issuedAt.getTime() + 20 * 60 * 1000),
    });
    await expect(
      completePasswordReset({
        pool,
        config,
        payload: { token: requiredProof(expiring), password: 'OwnerPass!111' },
        now: new Date(issuedAt.getTime() + 80 * 60 * 1000 + 1),
      }),
    ).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' });
    expect(await serializedSecurityRows()).not.toMatch(
      /OwnerPass|reset-password#|token_for_local/i,
    );
  });

  it('uses the exact seven-day activation copy and suppresses every Student email', async () => {
    const providerConfig = canaryConfig('admin@example.test');
    const requests: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        requests.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
        return new Response(JSON.stringify({ id: 'activation_message_001' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
    const issuedAt = new Date('2026-08-09T08:00:00.000Z');
    const activation = await createOwnerAdminInvitation({
      pool,
      config: providerConfig,
      actor: { userKey: ownerUserKey, role: 'owner' },
      payload: {
        idempotency_key: 'activation-copy-001',
        email: 'admin@example.test',
        display_name: 'Ari Admin',
        role: 'admin',
      },
      now: issuedAt,
    });
    expect(new Date(activation.expires_at).getTime() - issuedAt.getTime()).toBe(
      7 * 24 * 60 * 60 * 1000,
    );
    expect(
      await runLifecycleDeliveryOutboxBatch({
        pool,
        config: providerConfig,
        now: new Date(issuedAt.getTime() + 60_000),
        workerId: 'activation-copy-worker',
      }),
    ).toMatchObject({ claimed: 1, provider_accepted: 1 });
    expect(requests[0]).toMatchObject({
      from: 'One Time <info@onetimeonetime.com>',
      reply_to: ['info@onetimeonetime.com'],
      subject: 'Set up your One Time account',
    });
    expect(String(requests[0]?.text)).toContain('Hi Ari,');
    expect(String(requests[0]?.text)).toContain(
      'This link can be used once and expires in seven days.',
    );

    await seedStudent();
    const student = await createStudentSetup({
      pool,
      config,
      actor: { userKey: ownerUserKey, role: 'owner' },
      payload: {
        idempotency_key: 'student-no-email-001',
        email: 'student@example.test',
        display_name: 'Student User',
        household_key: 'household_student',
        learner_key: 'learner_student',
      },
    });
    expect(student.delivery.delivery_state).toBe('suppressed');
    const studentOutbox = await pool.query(
      `SELECT 1 FROM onetime.account_lifecycle_delivery_outbox WHERE purpose = 'student_setup'`,
    );
    expect(studentOutbox.rowCount).toBe(0);
  });

  it('leases a durable outbox row to one worker and retries a known local failure', async () => {
    const missingKeyConfig = canaryConfig('retry@example.test', false);
    await createOwnerAdminInvitation({
      pool,
      config: missingKeyConfig,
      actor: { userKey: ownerUserKey, role: 'owner' },
      payload: {
        idempotency_key: 'retry-lease-001',
        email: 'retry@example.test',
        display_name: 'Retry Admin',
        role: 'admin',
      },
      now: new Date('2026-08-09T08:00:00.000Z'),
    });
    const failed = await runLifecycleDeliveryOutboxBatch({
      pool,
      config: missingKeyConfig,
      now: new Date('2026-08-09T08:01:00.000Z'),
      workerId: 'retry-worker-first',
    });
    expect(failed).toMatchObject({ claimed: 1, retried: 1, unknown: 0 });

    let sends = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        sends += 1;
        return new Response(JSON.stringify({ id: 'retry_message_001' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
    const repairedConfig = canaryConfig('retry@example.test');
    const summaries = await Promise.all([
      runLifecycleDeliveryOutboxBatch({
        pool,
        config: repairedConfig,
        now: new Date('2026-08-09T08:03:00.000Z'),
        workerId: 'retry-worker-a',
      }),
      runLifecycleDeliveryOutboxBatch({
        pool,
        config: repairedConfig,
        now: new Date('2026-08-09T08:03:00.000Z'),
        workerId: 'retry-worker-b',
      }),
    ]);
    expect(summaries.reduce((total, summary) => total + summary.claimed, 0)).toBe(1);
    expect(sends).toBe(1);
  });

  it('reconciles an unknown provider effect with the identical idempotency key', async () => {
    const providerConfig = canaryConfig('owner@example.test');
    const keys: Array<string | null> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        keys.push(new Headers(init?.headers).get('idempotency-key'));
        return keys.length === 1
          ? new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
          : new Response(JSON.stringify({ id: 'reconciled_message_001' }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            });
      }),
    );
    await requestPasswordReset({
      pool,
      config: providerConfig,
      payload: { idempotency_key: 'unknown-result-001', email: 'owner@example.test' },
      now: new Date('2026-08-09T08:00:00.000Z'),
    });
    expect(
      await runLifecycleDeliveryOutboxBatch({
        pool,
        config: providerConfig,
        now: new Date('2026-08-09T08:01:00.000Z'),
        workerId: 'unknown-worker-first',
      }),
    ).toMatchObject({ claimed: 1, unknown: 1, provider_accepted: 0 });
    expect((await latestOutbox()).state).toBe('unknown');
    expect(
      await runLifecycleDeliveryOutboxBatch({
        pool,
        config: providerConfig,
        now: new Date('2026-08-09T08:03:00.000Z'),
        workerId: 'unknown-worker-reconcile',
      }),
    ).toMatchObject({ claimed: 1, unknown: 0, provider_accepted: 1 });
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[0]).toMatch(/^lifecycle\//);
    expect(await latestOutbox()).toMatchObject({
      state: 'provider_delivered',
      nonce: null,
      ciphertext: null,
      auth_tag: null,
    });
  });
});

function baseConfig() {
  return loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'resend-recovery-test',
    COMMIT_SHA: 'ot-p1',
    OUTBOX_TRANSPORT_MODE: 'sink',
  });
}

function canaryConfig(email: string, includeApiKey = true) {
  return loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'resend-recovery-test',
    COMMIT_SHA: 'ot-p1',
    OUTBOX_TRANSPORT_MODE: 'sink',
    ONE_TIME_LIFECYCLE_EMAIL_MODE: 'canary',
    ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED: 'true',
    ONE_TIME_RESEND_TRANSPORT_ENABLED: 'true',
    ONE_TIME_DELIVERY_TEST_CANARY_EMAIL: email,
    ONE_TIME_EMAIL_FROM: 'One Time <info@onetimeonetime.com>',
    ONE_TIME_EMAIL_REPLY_TO: 'info@onetimeonetime.com',
    ...(includeApiKey ? { RESEND_API_KEY: 'test_resend_key' } : {}),
  });
}

function requiredIssue(value: Awaited<ReturnType<typeof requestPasswordReset>>) {
  if (!('token_type' in value)) throw new Error('Expected password reset issue.');
  return value;
}

function requiredProof(value: Awaited<ReturnType<typeof requestPasswordReset>>) {
  const issue = requiredIssue(value);
  if (!('token_for_local_proof' in issue) || !issue.token_for_local_proof) {
    throw new Error('Expected local proof token.');
  }
  return issue.token_for_local_proof;
}

async function resetRows() {
  const intents = await pool.query(
    `SELECT 1 FROM onetime.account_lifecycle_delivery_intents WHERE intent_type = 'password_reset'`,
  );
  const outbox = await pool.query(
    `SELECT 1 FROM onetime.account_lifecycle_delivery_outbox WHERE purpose = 'password_reset'`,
  );
  return { intents: intents.rowCount ?? 0, outbox: outbox.rowCount ?? 0 };
}

async function latestOutbox() {
  const result = await pool.query(
    `SELECT state, nonce, ciphertext, auth_tag
       FROM onetime.account_lifecycle_delivery_outbox
      ORDER BY created_at DESC
      LIMIT 1`,
  );
  return result.rows[0] as Record<string, unknown>;
}

async function serializedSecurityRows() {
  const tokens = await pool.query(
    `SELECT token_key, token_hash, metadata FROM onetime.account_lifecycle_tokens`,
  );
  const outbox = await pool.query(
    `SELECT delivery_key, destination_ref, metadata FROM onetime.account_lifecycle_delivery_outbox`,
  );
  return JSON.stringify({ tokens: tokens.rows, outbox: outbox.rows });
}

async function seedStudent() {
  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name)
     VALUES ('household_student', $1, $2, 'Student Household')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_learners
       (learner_key, account_key, product_key, household_key, display_name)
     VALUES ('learner_student', $1, $2, 'household_student', 'Student User')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_student_access_state
       (access_state_key, account_key, product_key, household_key, learner_key, status)
     VALUES ('student_access', $1, $2, 'household_student', 'learner_student', 'not_configured')`,
    [config.accountKey, config.productKey],
  );
}
