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
  runAuthEmailChallengeDeliveryOutboxBatch,
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
    expect(new Date(issued.expires_at).getTime() - issuedAt.getTime()).toBe(
      7 * 24 * 60 * 60 * 1000,
    );

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
      ONE_TIME_LIFECYCLE_EMAIL_MODE: 'canary',
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
      provider_accepted: 1,
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
      subject: 'Set up your One Time account',
    });
    expect(String(requests[0]?.body.text)).toContain('/activate#token=');

    const deliveredOutbox = await lifecycleDeliveryRows();
    expect(deliveredOutbox[0]).toMatchObject({
      state: 'provider_accepted',
      nonce: null,
      ciphertext: null,
      auth_tag: null,
    });
  });

  it('reconciles an unknown Resend result with the same provider idempotency key before retry', async () => {
    const recoveryConfig = loadConfig({
      NODE_ENV: 'test',
      PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
      APP_VERSION: 'test',
      COMMIT_SHA: 'test',
      OUTBOX_TRANSPORT_MODE: 'sink',
      ONE_TIME_LIFECYCLE_EMAIL_MODE: 'canary',
      ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED: 'true',
      ONE_TIME_RESEND_TRANSPORT_ENABLED: 'true',
      ONE_TIME_DELIVERY_TEST_CANARY_EMAIL: 'owner@example.test',
      ONE_TIME_EMAIL_FROM: 'One Time <info@onetimeonetime.com>',
      ONE_TIME_EMAIL_REPLY_TO: 'info@onetimeonetime.com',
      RESEND_API_KEY: 'test_resend_key',
    });
    const requests: Array<{ body: Record<string, unknown>; idempotencyKey: string | null }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        requests.push({
          body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
          idempotencyKey: headers.get('idempotency-key'),
        });
        return requests.length === 1
          ? new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
          : new Response(JSON.stringify({ id: 'email_provider_message_reconciled' }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            });
      }),
    );

    const issuedAt = new Date('2026-07-15T10:00:00.000Z');
    const first = await requestPasswordReset({
      pool,
      config: recoveryConfig,
      payload: { idempotency_key: 'password-reset-reconcile-001', email: 'owner@example.test' },
      now: issuedAt,
    });
    const replay = await requestPasswordReset({
      pool,
      config: recoveryConfig,
      payload: { idempotency_key: 'password-reset-reconcile-001', email: 'owner@example.test' },
      now: new Date(issuedAt.getTime() + 1_000),
    });
    expect(replay).toEqual(first);
    expect(
      (await lifecycleDeliveryRows()).filter((row) => row.purpose === 'password_reset'),
    ).toHaveLength(1);

    const unknown = await runLifecycleDeliveryOutboxBatch({
      pool,
      config: recoveryConfig,
      now: new Date('2026-07-15T10:01:00.000Z'),
      workerId: 'resend-recovery-first-worker',
    });
    expect(unknown).toMatchObject({ claimed: 1, unknown: 1, provider_accepted: 0 });
    expect((await lifecycleDeliveryRows())[0]).toMatchObject({ state: 'unknown' });

    const reconciled = await runLifecycleDeliveryOutboxBatch({
      pool,
      config: recoveryConfig,
      now: new Date('2026-07-15T10:03:00.000Z'),
      workerId: 'resend-recovery-reconcile-worker',
    });
    expect(reconciled).toMatchObject({ claimed: 1, unknown: 0, provider_accepted: 1 });
    expect(requests).toHaveLength(2);
    expect(requests[0]?.idempotencyKey).toBe(requests[1]?.idempotencyKey);
    expect(requests[0]?.idempotencyKey).toMatch(/^lifecycle\//);
    expect(requests[0]?.body).toMatchObject({
      from: 'One Time <info@onetimeonetime.com>',
      reply_to: ['info@onetimeonetime.com'],
      subject: 'Reset your One Time password',
    });
    expect(String(requests[0]?.body.text)).toContain(
      'This link can be used once and expires in 60 minutes.',
    );
    expect(String(requests[0]?.body.text)).toContain(
      'https://join.onetimeonetime.com/reset-password#token=',
    );
    expect((await lifecycleDeliveryRows())[0]).toMatchObject({
      state: 'provider_accepted',
      nonce: null,
      ciphertext: null,
      auth_tag: null,
    });
  });

  it('leases one durable intent to only one worker and performs one provider acceptance', async () => {
    const leaseConfig = loadConfig({
      NODE_ENV: 'test',
      PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
      APP_VERSION: 'test',
      COMMIT_SHA: 'test',
      OUTBOX_TRANSPORT_MODE: 'sink',
      ONE_TIME_LIFECYCLE_EMAIL_MODE: 'canary',
      ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED: 'true',
      ONE_TIME_RESEND_TRANSPORT_ENABLED: 'true',
      ONE_TIME_DELIVERY_TEST_CANARY_EMAIL: 'lease@example.test',
      ONE_TIME_EMAIL_FROM: 'One Time <info@onetimeonetime.com>',
      ONE_TIME_EMAIL_REPLY_TO: 'info@onetimeonetime.com',
      RESEND_API_KEY: 'test_resend_key',
    });
    let sends = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        sends += 1;
        return new Response(JSON.stringify({ id: 'email_provider_message_lease' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
    await createOwnerAdminInvitation({
      pool,
      config: leaseConfig,
      actor: ownerActor(),
      payload: {
        idempotency_key: 'invite-admin-lease-001',
        email: 'lease@example.test',
        display_name: 'Lease Admin',
        role: 'admin',
      },
      now: new Date('2026-07-15T10:00:00.000Z'),
    });
    const summaries = await Promise.all([
      runLifecycleDeliveryOutboxBatch({
        pool,
        config: leaseConfig,
        now: new Date('2026-07-15T10:01:00.000Z'),
        workerId: 'lease-worker-a',
      }),
      runLifecycleDeliveryOutboxBatch({
        pool,
        config: leaseConfig,
        now: new Date('2026-07-15T10:01:00.000Z'),
        workerId: 'lease-worker-b',
      }),
    ]);
    expect(summaries.reduce((total, summary) => total + summary.claimed, 0)).toBe(1);
    expect(sends).toBe(1);
  });

  it('retries a known local transport failure after the configured dependency is repaired', async () => {
    const base = {
      NODE_ENV: 'test' as const,
      PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
      APP_VERSION: 'test',
      COMMIT_SHA: 'test',
      OUTBOX_TRANSPORT_MODE: 'sink' as const,
      ONE_TIME_LIFECYCLE_EMAIL_MODE: 'canary' as const,
      ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED: 'true',
      ONE_TIME_RESEND_TRANSPORT_ENABLED: 'true',
      ONE_TIME_DELIVERY_TEST_CANARY_EMAIL: 'retry@example.test',
      ONE_TIME_EMAIL_FROM: 'One Time <info@onetimeonetime.com>',
      ONE_TIME_EMAIL_REPLY_TO: 'info@onetimeonetime.com',
    };
    const missingKeyConfig = loadConfig(base);
    await createOwnerAdminInvitation({
      pool,
      config: missingKeyConfig,
      actor: ownerActor(),
      payload: {
        idempotency_key: 'invite-admin-retry-001',
        email: 'retry@example.test',
        display_name: 'Retry Admin',
        role: 'admin',
      },
      now: new Date('2026-07-15T10:00:00.000Z'),
    });
    const failed = await runLifecycleDeliveryOutboxBatch({
      pool,
      config: missingKeyConfig,
      now: new Date('2026-07-15T10:01:00.000Z'),
      workerId: 'retry-worker-first',
    });
    expect(failed).toMatchObject({ claimed: 1, retried: 1, unknown: 0 });
    expect((await lifecycleDeliveryRows())[0]).toMatchObject({ state: 'retry' });

    const repairedConfig = loadConfig({ ...base, RESEND_API_KEY: 'test_resend_key' });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ id: 'email_provider_message_retry' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    );
    const repaired = await runLifecycleDeliveryOutboxBatch({
      pool,
      config: repairedConfig,
      now: new Date('2026-07-15T10:03:00.000Z'),
      workerId: 'retry-worker-repaired',
    });
    expect(repaired).toMatchObject({ claimed: 1, provider_accepted: 1 });
  });

  it('delivers transactional lifecycle email in production mode without the canary destination gate', async () => {
    const transactionalConfig = loadConfig({
      NODE_ENV: 'production',
      PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
      APP_VERSION: 'test',
      COMMIT_SHA: 'test',
      AUTH_CSRF_SECRET: 'test-auth-csrf-secret-for-transactional-lifecycle',
      MFA_SECRET_ENCRYPTION_KEY: 'test-mfa-secret-key-for-transactional-lifecycle',
      OUTBOX_TRANSPORT_MODE: 'sink',
      ONE_TIME_RUNTIME_ENVIRONMENT: 'production',
      ONE_TIME_LIFECYCLE_EMAIL_MODE: 'transactional',
      ONE_TIME_LIFECYCLE_DELIVERY_KEY: 'test-lifecycle-delivery-key-for-transactional-mode',
      ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED: 'true',
      ONE_TIME_RESEND_TRANSPORT_ENABLED: 'true',
      ONE_TIME_RESEND_WEBHOOK_ENABLED: 'true',
      ONE_TIME_EMAIL_FROM: 'One Time <info@onetimeonetime.com>',
      ONE_TIME_EMAIL_REPLY_TO: 'info@onetimeonetime.com',
      DELIVERY_PROVIDER_AUTHORIZATION_ID: 'auth_transactional_email_001',
      DELIVERY_PROVIDER_PER_RUN_BUDGET: '1',
      DELIVERY_PROVIDER_PER_PROVIDER_BUDGET: '1',
      RESEND_API_KEY: 'test_resend_key',
      RESEND_WEBHOOK_SECRET: 'test-resend-webhook-secret',
    });
    const requests: Array<{ body: Record<string, unknown>; headers: Headers }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        requests.push({
          body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
          headers: new Headers(init?.headers),
        });
        return new Response(JSON.stringify({ id: 'email_provider_message_002' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    await createOwnerAdminInvitation({
      pool,
      config: transactionalConfig,
      actor: ownerActor(),
      payload: {
        idempotency_key: 'invite-admin-transactional-001',
        email: 'admin@example.test',
        display_name: 'Transactional Admin',
        role: 'admin',
      },
      now: new Date('2026-07-15T10:00:00.000Z'),
    });

    const summary = await runLifecycleDeliveryOutboxBatch({
      pool,
      config: transactionalConfig,
      now: new Date('2026-07-15T10:01:00.000Z'),
      workerId: 'account-lifecycle-transactional-worker',
      limit: 5,
    });

    expect(summary).toMatchObject({
      claimed: 1,
      provider_accepted: 1,
      sink_delivered: 0,
      external_send_performed: true,
      raw_token_logged: false,
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.body).toMatchObject({
      from: 'One Time <info@onetimeonetime.com>',
      to: ['admin@example.test'],
      reply_to: ['info@onetimeonetime.com'],
      subject: 'Set up your One Time account',
    });
    expect(String(requests[0]?.body.text)).toContain('/activate#token=');

    const deliveredOutbox = await lifecycleDeliveryRows();
    expect(deliveredOutbox[0]).toMatchObject({
      state: 'provider_accepted',
      nonce: null,
      ciphertext: null,
      auth_tag: null,
    });
  });

  it('delivers transactional admin email challenges in production mode without the canary destination gate', async () => {
    const transactionalConfig = loadConfig({
      NODE_ENV: 'production',
      PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
      APP_VERSION: 'test',
      COMMIT_SHA: 'test',
      AUTH_CSRF_SECRET: 'test-auth-csrf-secret-for-transactional-auth-email',
      MFA_SECRET_ENCRYPTION_KEY: 'test-mfa-secret-key-for-transactional-auth-email',
      OUTBOX_TRANSPORT_MODE: 'sink',
      ONE_TIME_RUNTIME_ENVIRONMENT: 'production',
      ONE_TIME_LIFECYCLE_EMAIL_MODE: 'transactional',
      ONE_TIME_LIFECYCLE_DELIVERY_KEY: 'test-lifecycle-delivery-key-for-transactional-auth-email',
      ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED: 'true',
      ONE_TIME_RESEND_TRANSPORT_ENABLED: 'true',
      ONE_TIME_RESEND_WEBHOOK_ENABLED: 'true',
      ONE_TIME_EMAIL_FROM: 'One Time <info@onetimeonetime.com>',
      ONE_TIME_EMAIL_REPLY_TO: 'info@onetimeonetime.com',
      DELIVERY_PROVIDER_AUTHORIZATION_ID: 'auth_transactional_email_002',
      DELIVERY_PROVIDER_PER_RUN_BUDGET: '1',
      DELIVERY_PROVIDER_PER_PROVIDER_BUDGET: '1',
      RESEND_API_KEY: 'test_resend_key',
      RESEND_WEBHOOK_SECRET: 'test-resend-webhook-secret',
    });
    expect(transactionalConfig.deliveryTestCanaryEmail).toBeUndefined();
    const requests: Array<{ body: Record<string, unknown>; headers: Headers }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        requests.push({
          body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
          headers: new Headers(init?.headers),
        });
        return new Response(JSON.stringify({ id: 'email_provider_message_003' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    await createAccountUser({
      pool,
      config: transactionalConfig,
      email: 'challenge.admin@example.test',
      password: 'AdminPass!234',
      displayName: 'Challenge Admin',
      role: 'admin',
      mfaCapable: true,
    });

    const login = await authenticateUser({
      pool,
      config: transactionalConfig,
      email: 'challenge.admin@example.test',
      password: 'AdminPass!234',
      ip: '127.0.0.1',
      userAgent: 'vitest',
    });
    expect(login).toMatchObject({
      ok: false,
      code: 'EMAIL_CHALLENGE_REQUIRED',
      delivery_state: 'queued',
    });

    const queuedOutbox = await authEmailChallengeDeliveryRows();
    expect(queuedOutbox).toHaveLength(1);
    expect(queuedOutbox[0]).toMatchObject({ state: 'queued' });
    expect(requiredRowString(queuedOutbox[0], 'nonce')).toBeTruthy();
    expect(requiredRowString(queuedOutbox[0], 'ciphertext')).toBeTruthy();
    expect(requiredRowString(queuedOutbox[0], 'auth_tag')).toBeTruthy();

    const summary = await runAuthEmailChallengeDeliveryOutboxBatch({
      pool,
      config: transactionalConfig,
      now: new Date(Date.now() + 60_000),
      workerId: 'auth-email-transactional-worker',
      limit: 5,
    });

    expect(summary).toMatchObject({
      claimed: 1,
      provider_delivered: 1,
      sink_delivered: 0,
      external_send_performed: true,
      raw_token_logged: false,
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer test_resend_key');
    expect(requests[0]?.body).toMatchObject({
      from: 'One Time <info@onetimeonetime.com>',
      to: ['challenge.admin@example.test'],
      reply_to: ['info@onetimeonetime.com'],
      subject: 'Your One Time login code',
    });
    expect(String(requests[0]?.body.text)).toContain('/login#email_challenge_token=');

    const [delivery] = await authEmailChallengeDeliveryRows();
    expect(delivery).toMatchObject({
      state: 'provider_accepted',
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

  it('fails Parent activation closed if the email becomes a non-Parent identity after issue', async () => {
    const issued = await createParentActivation({
      pool,
      config,
      actor: ownerActor(),
      includeLocalProofToken: true,
      payload: {
        idempotency_key: 'parent-activation-role-race-001',
        email: 'role-race@example.test',
        display_name: 'Role Race Parent',
        household_key: householdKey,
        relationship_key: 'relationship_role_race',
        relationship_label: 'Parent',
        authority: 'primary_guardian',
      },
    });
    const studentUserKey = await createAccountUser({
      pool,
      config,
      email: 'role-race@example.test',
      password: 'RoleRaceStudent!234',
      displayName: 'Role Race Student',
      role: 'student',
    });

    await expect(
      acceptParentActivation({
        pool,
        config,
        payload: { token: requiredProof(issued), password: 'RoleRaceParent!234' },
      }),
    ).rejects.toMatchObject({ code: 'IDENTITY_CONFLICT' });

    const identity = await pool.query(
      `SELECT user_key, role
         FROM onetime.account_users
        WHERE account_key = $1 AND product_key = $2 AND email_normalized = $3`,
      [config.accountKey, config.productKey, 'role-race@example.test'],
    );
    expect(identity.rows[0]).toMatchObject({ user_key: studentUserKey, role: 'student' });
    const token = await pool.query(
      `SELECT consumed_at
         FROM onetime.account_lifecycle_tokens
        WHERE token_key = $1`,
      [issued.token_key],
    );
    expect(token.rows[0]?.consumed_at).toBeNull();
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
        free_pilot: {
          expires_at: '2027-01-01T00:00:00.000Z',
          policy_version: 'account-lifecycle-test-free-pilot-v1',
          opaque_source_reference: 'account_lifecycle_parent_alpha',
        },
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
    expect(studentIssue.delivery.delivery_state).toBe('suppressed');
    const studentToken = requiredProof(studentIssue);
    for (const password of ['12345', '1234567', '12a456', '１２３４５６']) {
      await expect(
        acceptStudentSetup({
          pool,
          config,
          payload: { token: studentToken, password },
        }),
      ).rejects.toThrow();
    }
    const student = await acceptStudentSetup({
      pool,
      config,
      payload: { token: studentToken, password: '000123' },
    });
    expect(student).toMatchObject({ role: 'student', status: 'active', mfa_required: false });

    const login = await authenticateUser({
      pool,
      config,
      email: 'student@example.test',
      password: '000123',
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
      password: '000123',
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
    expect(resetIssue.delivery.delivery_state).toBe('suppressed');
    const resetToken = requiredProof(resetIssue);
    for (const password of ['12345', '1234567', '12a456', '１２３４５６']) {
      await expect(
        completeStudentReset({
          pool,
          config,
          payload: { token: resetToken, password },
        }),
      ).rejects.toThrow();
    }
    const resetSession = await createSession({ pool, config, user: postRestoreLogin.user });
    const reset = await completeStudentReset({
      pool,
      config,
      payload: { token: resetToken, password: '123456' },
    });
    expect(reset.sessions_invalidated).toBe(1);
    expect(
      await getSessionByToken({ pool, config, sessionToken: resetSession.session_token }),
    ).toBeNull();
    const oldPassword = await authenticateUser({
      pool,
      config,
      email: 'student@example.test',
      password: '000123',
    });
    expect(oldPassword).toMatchObject({ ok: false, code: 'INVALID_CREDENTIALS' });
    const newPassword = await authenticateUser({
      pool,
      config,
      email: 'student@example.test',
      password: '123456',
    });
    expect(newPassword).toMatchObject({ ok: true });
    const studentEmailOutbox = await pool.query(
      `SELECT 1
         FROM onetime.account_lifecycle_delivery_outbox
        WHERE purpose IN ('student_setup', 'student_reset')`,
    );
    expect(studentEmailOutbox.rowCount).toBe(0);
    expect(await serializedLifecycleRows()).not.toMatch(/000123|123456|ParentPass|token_for_local/i);
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
      60 * 60 * 1000,
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

  it('invalidates an older unused reset and expires the replacement after 60 minutes', async () => {
    await createParentWithPassword('reset-supersede@example.test', 'ParentPass!234');
    const first = await requestPasswordReset({
      pool,
      config,
      includeLocalProofToken: true,
      payload: {
        idempotency_key: 'password-reset-supersede-001',
        email: 'reset-supersede@example.test',
      },
      now: new Date('2026-07-15T10:00:00.000Z'),
    });
    const second = await requestPasswordReset({
      pool,
      config,
      includeLocalProofToken: true,
      payload: {
        idempotency_key: 'password-reset-supersede-002',
        email: 'reset-supersede@example.test',
      },
      now: new Date('2026-07-15T10:05:00.000Z'),
    });
    if (!('token_for_local_proof' in first) || !first.token_for_local_proof) {
      throw new Error('Expected first password reset proof token.');
    }
    if (!('token_for_local_proof' in second) || !second.token_for_local_proof) {
      throw new Error('Expected second password reset proof token.');
    }
    await expect(
      completePasswordReset({
        pool,
        config,
        payload: { token: first.token_for_local_proof, password: 'ParentPass!555' },
        now: new Date('2026-07-15T10:10:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'TOKEN_INVALID' });
    await expect(
      completePasswordReset({
        pool,
        config,
        payload: { token: second.token_for_local_proof, password: 'ParentPass!666' },
        now: new Date('2026-07-15T11:05:00.001Z'),
      }),
    ).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' });
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
      free_pilot: {
        expires_at: '2027-01-01T00:00:00.000Z',
        policy_version: 'account-lifecycle-test-free-pilot-v1',
        opaque_source_reference: 'account_lifecycle_reset_parent',
      },
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

async function authEmailChallengeDeliveryRows() {
  const rows = await pool.query(
    `SELECT delivery_key, challenge_key, purpose, transport_mode, destination_ref,
            key_id, key_version, nonce, ciphertext, auth_tag, encrypted_payload_expires_at,
            state, attempts, max_attempts, idempotency_key, provider_message_ref_hash,
            delivered_at, dead_lettered_at, cleared_at, metadata
       FROM onetime.auth_email_challenge_delivery_outbox
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
