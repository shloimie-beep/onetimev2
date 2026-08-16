import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../../../../../../packages/config/src/index.ts';
import type {
  FamilySignupCommand,
  FamilySignupResult,
  FamilySignupScope,
} from '../../../../../../../packages/contracts/src/signup/family/index.ts';
import type { DbPool } from '../../../../../../../packages/db/src/index.ts';
import { createApp } from '../../../app.ts';
import { createFamilySignupRouter, familySignupFeatureRegistration } from './router.ts';
import type { EstablishedFamilySignupSession, FamilySignupSubmission } from './service.ts';

const servers: Array<ReturnType<express.Express['listen']>> = [];
const observedAt = new Date('2026-08-01T12:00:00.000Z');

afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop();
    if (!server) continue;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe('P08 Family-signup route security', () => {
  it('is mountable through the shared feature registry without changing the central composer', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
      AUTH_CSRF_SECRET: 'test-family-signup-default-composition-secret',
    });
    const app = createApp({
      config,
      pool: unusedPool(),
      clock: () => new Date(observedAt),
      featureRegistrations: [familySignupFeatureRegistration],
    });
    const server = await listen(app);
    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/signup/family/bootstrap`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      writes_allowed: true,
    });
  });

  it('issues a no-store signed bootstrap with exactly 32-byte base64url request material', async () => {
    const submit = vi.fn();
    const harness = await startHarness({
      submitter: { submit },
    });
    const response = await fetch(`${harness.baseUrl}/api/v1/signup/family/bootstrap`);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(body).toMatchObject({
      success: true,
      writes_allowed: true,
      expires_at: '2026-08-01T12:20:00.000Z',
    });
    expect(body.idempotency_key).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(body.csrf_token).toMatch(/^\d{10}\.[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/u);
    const cookie = response.headers
      .getSetCookie()
      .find((value) => value.startsWith('ot_family_signup_csrf='));
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/api/v1/signup/family');
    expect(submit).not.toHaveBeenCalled();
  });

  it('permits only the canonical join-to-app credentialed bootstrap and submit preflight', async () => {
    const harness = await startHarness({
      submitter: { submit: vi.fn(async () => submission(createdResult())) },
    });
    const canonicalOrigin = 'https://join.onetimeonetime.com';
    const accepted = await fetch(`${harness.baseUrl}/api/v1/signup/family`, {
      method: 'OPTIONS',
      headers: {
        origin: canonicalOrigin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type,x-csrf-token',
      },
    });
    expect(accepted.status).toBe(204);
    expect(accepted.headers.get('access-control-allow-origin')).toBe(canonicalOrigin);
    expect(accepted.headers.get('access-control-allow-credentials')).toBe('true');
    expect(accepted.headers.get('access-control-allow-methods')).toBe('GET, POST, OPTIONS');
    expect(accepted.headers.get('access-control-allow-headers')).toContain('X-CSRF-Token');
    expect(accepted.headers.get('vary')).toContain('Origin');

    for (const headers of [
      {
        origin: 'https://evil.example',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type,x-csrf-token',
      },
      {
        origin: canonicalOrigin,
        'access-control-request-method': 'DELETE',
        'access-control-request-headers': 'content-type,x-csrf-token',
      },
      {
        origin: canonicalOrigin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,content-type,x-csrf-token',
      },
    ]) {
      const denied = await fetch(`${harness.baseUrl}/api/v1/signup/family`, {
        method: 'OPTIONS',
        headers,
      });
      expect(denied.status).toBe(403);
      expect(denied.headers.get('access-control-allow-origin')).toBe(
        headers.origin === canonicalOrigin ? canonicalOrigin : null,
      );
    }

    const bootstrap = await fetch(`${harness.baseUrl}/api/v1/signup/family/bootstrap`, {
      headers: { origin: canonicalOrigin, 'sec-fetch-site': 'same-site' },
    });
    expect(bootstrap.status).toBe(200);
    expect(bootstrap.headers.get('access-control-allow-origin')).toBe(canonicalOrigin);
    expect(bootstrap.headers.get('access-control-allow-credentials')).toBe('true');
    expect(bootstrap.headers.getSetCookie()).toEqual([
      expect.stringContaining('ot_family_signup_csrf='),
    ]);
  });

  it('requires exact same-origin CSRF proof and returns no private local IDs', async () => {
    const submit = vi.fn(async () => submission(createdResult()));
    const harness = await startHarness({ submitter: { submit } });
    const bootstrap = await getBootstrap(harness.baseUrl);
    const payload = command(bootstrap.idempotencyKey);

    const missingOrigin = await post(harness.baseUrl, payload, bootstrap, {});
    expect(missingOrigin.status).toBe(403);
    expect(await missingOrigin.json()).toMatchObject({ code: 'SAME_ORIGIN_REQUIRED' });

    const wrongKey = command('abcdefghij0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_');
    const mismatchedProof = await post(harness.baseUrl, wrongKey, bootstrap, {
      origin: 'https://join.onetimeonetime.com',
    });
    expect(mismatchedProof.status).toBe(403);
    const mismatchedProofBody = (await mismatchedProof.json()) as Record<string, unknown>;
    expect(mismatchedProofBody).toMatchObject({ code: 'CSRF_REQUIRED' });
    expect(String(mismatchedProofBody.message)).not.toMatch(/refresh/iu);

    const accepted = await post(harness.baseUrl, payload, bootstrap, {
      origin: 'https://join.onetimeonetime.com',
    });
    const acceptedBody = (await accepted.json()) as Record<string, unknown>;
    expect(accepted.status).toBe(201);
    expect(acceptedBody).toMatchObject({
      success: true,
      code: 'FAMILY_SIGNUP_COMPLETE',
      local_commit_state: 'committed',
      local_access_state: 'free',
      next_action: 'parent_overview',
      session_established: true,
      provider_projection_state: 'readback_required',
      provider_effects_completed_inline: 0,
      message:
        'Your Family account is ready. You can continue now while we finish sending your confirmation email.',
    });
    expect(JSON.stringify(acceptedBody)).not.toContain('adult_private');
    expect(JSON.stringify(acceptedBody)).not.toContain('account_private');
    expect(JSON.stringify(acceptedBody)).not.toContain('household_private');
    expect(JSON.stringify(acceptedBody)).not.toContain('"signed_in"');
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith({
      scope: {
        product: 'one_time_mishnayos',
        runtime_tier: 'isolated_staging',
        verification_environment_id: 'ci',
      },
      command: payload,
      now: observedAt,
    });
  });

  it('accepts the canonical authenticated app origin when the public funnel origin is join', async () => {
    const submit = vi.fn(async () => submission(createdResult()));
    const harness = await startHarness({ submitter: { submit } });
    const bootstrap = await getBootstrap(harness.baseUrl);
    const response = await post(harness.baseUrl, command(bootstrap.idempotencyKey), bootstrap, {
      origin: 'https://app.onetimeonetime.com',
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      success: true,
      code: 'FAMILY_SIGNUP_COMPLETE',
    });
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('returns no committed-success claim or Parent cookie when the atomic submitter fails', async () => {
    const submit = vi.fn(async (): Promise<FamilySignupSubmission> => {
      throw new Error('forced_transaction_session_failure');
    });
    const harness = await startHarness({ submitter: { submit } });
    const bootstrap = await getBootstrap(harness.baseUrl);
    const response = await post(harness.baseUrl, command(bootstrap.idempotencyKey), bootstrap, {
      origin: 'https://join.onetimeonetime.com',
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(500);
    expect(response.headers.getSetCookie()).not.toEqual(
      expect.arrayContaining([expect.stringContaining('__Host-onetime-session=')]),
    );
    expect(body).toMatchObject({ success: false, code: 'SERVER_ERROR' });
    expect(body).not.toHaveProperty('local_commit_state');
    expect(JSON.stringify(body)).not.toContain('SIGNUP_COMMITTED');
  });

  it('rejects extra, hybrid, Student, card, phone, reminder, and caller-hash fields', async () => {
    const submit = vi.fn(async () => submission(createdResult()));
    const harness = await startHarness({ submitter: { submit } });
    const bootstrap = await getBootstrap(harness.baseUrl);
    const base = command(bootstrap.idempotencyKey);
    const hostilePayloads = [
      { ...base, classification: 'family_and_school' },
      { ...base, card: '4242' },
      { ...base, student: { name: 'Child' } },
      { ...base, phone: '+15555550100' },
      { ...base, reminder_preference: 'whatsapp' },
      { ...base, canonical_request_hash: 'a'.repeat(64) },
      { ...base, normalized_email_hash: 'b'.repeat(64) },
      { ...base, password: 'Abcde', password_confirmation: 'Abcde' },
    ];

    for (const payload of hostilePayloads) {
      const response = await post(harness.baseUrl, payload, bootstrap, {
        origin: 'https://join.onetimeonetime.com',
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
    }
    expect(submit).not.toHaveBeenCalled();
  });

  it('returns safe field-specific errors without asking the adult to refresh', async () => {
    const submit = vi.fn(async () => submission(createdResult()));
    const harness = await startHarness({ submitter: { submit } });
    const bootstrap = await getBootstrap(harness.baseUrl);
    const response = await post(
      harness.baseUrl,
      {
        ...command(bootstrap.idempotencyKey),
        first_name: '',
        email: 'not-an-email',
        password: 'Ab123',
        password_confirmation: 'Ab123',
        timezone: '',
        terms_accepted: false,
      },
      bootstrap,
      { origin: 'https://join.onetimeonetime.com' },
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      code: 'VALIDATION_ERROR',
      field_errors: {
        first_name: 'This field is required.',
        email: 'Enter a valid email address.',
        password: 'At least 6 characters.',
        password_confirmation: 'At least 6 characters.',
        timezone: 'This field is required.',
        terms_accepted: 'This field is required.',
      },
    });
    expect(String(body.message)).not.toMatch(/refresh/iu);
    expect(submit).not.toHaveBeenCalled();
  });

  it('rejects all writes before service access in production_read_only', async () => {
    const submit = vi.fn(async () => submission(createdResult()));
    const harness = await startHarness({
      submitter: { submit },
      productionReadOnly: true,
    });
    const bootstrap = await getBootstrap(harness.baseUrl);
    expect(bootstrap.body).toMatchObject({ writes_allowed: false });

    const response = await post(harness.baseUrl, command(bootstrap.idempotencyKey), bootstrap, {
      origin: 'https://join.onetimeonetime.com',
      'sec-fetch-site': 'same-site',
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: 'VERIFICATION_ENVIRONMENT_READ_ONLY',
    });
    expect(submit).not.toHaveBeenCalled();
  });

  it('does not expose the existing-account disposition on the generic recovery path', async () => {
    const submit = vi.fn(async (): Promise<FamilySignupSubmission> => ({
      result: {
        disposition: 'existing_account',
        projection: null,
        next_action: 'sign_in_or_reset',
        setup_email_required: false,
        provider_effects_completed_inline: 0,
        outbox_intent_ids: [],
        ghl_handoff_state: 'not_applicable',
        checkout_handoff_state: 'not_applicable',
        safe_message: 'Sign in or reset your password to continue.',
      },
      session: null,
    }));
    const harness = await startHarness({ submitter: { submit } });
    const bootstrap = await getBootstrap(harness.baseUrl);
    const response = await post(harness.baseUrl, command(bootstrap.idempotencyKey), bootstrap, {
      origin: 'https://join.onetimeonetime.com',
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      code: 'SIGN_IN_OR_RESET',
      next_action: 'sign_in_or_reset',
      session_established: false,
    });
    expect(body).not.toHaveProperty('disposition');
  });

  it('issues the Parent cookie only from a committed atomic submission with exact readback', async () => {
    const acceptedProviderResult = createdResult();
    acceptedProviderResult.ghl_handoff_state = 'ready';
    const transactionEvents: string[] = [];
    const harness = await startHarness({
      submitter: {
        submit: vi.fn(async () => {
          transactionEvents.push('transaction_committed');
          return submission(acceptedProviderResult);
        }),
      },
    });
    const bootstrap = await getBootstrap(harness.baseUrl);
    const response = await post(harness.baseUrl, command(bootstrap.idempotencyKey), bootstrap, {
      origin: 'https://join.onetimeonetime.com',
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      code: 'FAMILY_SIGNUP_COMPLETE',
      next_action: 'parent_overview',
      session_established: true,
      continue_to: 'https://app.onetimeonetime.com/app/parent',
      csrf_token: 'c'.repeat(48),
      message: 'Your Family account is ready, and we sent your confirmation email.',
    });
    expect(response.headers.get('set-cookie')).toContain('__Host-onetime-session=');
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'https://join.onetimeonetime.com',
    );
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    expect(transactionEvents).toEqual(['transaction_committed']);
  });

  it('returns a truthful queued hosted-checkout handoff without a provider URL or charge claim', async () => {
    const harness = await startHarness({
      submitter: { submit: vi.fn(async () => submission(checkoutResult())) },
    });
    const bootstrap = await getBootstrap(harness.baseUrl);
    const response = await post(harness.baseUrl, command(bootstrap.idempotencyKey), bootstrap, {
      origin: 'https://join.onetimeonetime.com',
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(202);
    expect(body).toMatchObject({
      code: 'SIGNUP_COMMITTED_CHECKOUT_HANDOFF_QUEUED',
      next_action: 'checkout_handoff_queued',
      checkout_handoff_state: 'queued',
      local_access_state: 'inactive',
      session_established: true,
      checkout_provider: 'highlevel',
      financial_provider: 'stripe',
      direct_stripe_mutation_by_one_time: false,
      provider_effects_completed_inline: 0,
    });
    expect(JSON.stringify(body)).not.toContain('http');
    expect(JSON.stringify(body)).not.toContain('checkout_url');
    expect(JSON.stringify(body)).not.toContain('redirect_handle');
  });
});

async function startHarness(input: {
  submitter: {
    submit: (input: {
      scope: FamilySignupScope;
      command: FamilySignupCommand;
      now: Date;
    }) => Promise<FamilySignupSubmission>;
  };
  productionReadOnly?: boolean;
}) {
  const config = input.productionReadOnly
    ? loadConfig({
        NODE_ENV: 'production',
        PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
        ONE_TIME_RUNTIME_ENVIRONMENT: 'production',
        AUTH_CSRF_SECRET: 'production-family-signup-route-csrf-secret',
        PROTECTED_PAYLOAD_ENCRYPTION_KEY: 'production-family-signup-route-payload-key',
      })
    : loadConfig({
        NODE_ENV: 'test',
        PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
        AUTH_CSRF_SECRET: 'test-family-signup-route-csrf-secret-value',
      });
  const app = express();
  app.use(express.json({ limit: '32kb' }));
  app.use(
    '/api/v1/signup/family',
    createFamilySignupRouter({
      config,
      pool: unusedPool(),
      clock: () => new Date(observedAt),
      submitter: input.submitter,
      rateLimit: false,
    }),
  );
  const server = await listen(app);
  const address = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${address.port}` };
}

async function listen(app: express.Express) {
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listening = app.listen(0, '127.0.0.1', (error?: Error) => {
      if (error) reject(error);
      else resolve(listening);
    });
  });
  servers.push(server);
  return server;
}

async function getBootstrap(baseUrl: string) {
  const response = await fetch(`${baseUrl}/api/v1/signup/family/bootstrap`);
  const body = (await response.json()) as {
    idempotency_key: string;
    csrf_token: string;
  } & Record<string, unknown>;
  const setCookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith('ot_family_signup_csrf='));
  if (!setCookie) throw new Error('Family-signup CSRF cookie missing');
  return {
    idempotencyKey: body.idempotency_key,
    csrfToken: body.csrf_token,
    cookie: setCookie.split(';')[0]!,
    body,
  };
}

async function post(
  baseUrl: string,
  payload: unknown,
  bootstrap: Awaited<ReturnType<typeof getBootstrap>>,
  headers: Record<string, string>,
) {
  return fetch(`${baseUrl}/api/v1/signup/family`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: bootstrap.cookie,
      'x-csrf-token': bootstrap.csrfToken,
      ...headers,
    },
    body: JSON.stringify(payload),
  });
}

function command(idempotencyKey: string): FamilySignupCommand {
  return {
    classification: 'family',
    idempotency_key: idempotencyKey,
    first_name: 'Ari',
    last_name: 'Levi',
    email: 'ari@example.com',
    password: 'correct horse battery staple',
    password_confirmation: 'correct horse battery staple',
    timezone: 'Asia/Jerusalem',
    terms_accepted: true,
    privacy_accepted: true,
    general_marketing_consent: true,
    parent_newsletter_consent: true,
  };
}

function createdResult(): FamilySignupResult {
  return {
    disposition: 'created',
    projection: {
      adult_id: 'adult_private',
      human_account_id: 'account_private',
      household_id: 'household_private',
      normalized_email: 'ari@example.com',
      access_branch: 'immediate_free',
      access_state: 'free',
      seat_limit: 3,
      active_seat_count: 0,
      free_access_expires_at: '2026-09-11T15:00:00.000Z',
      checkout_required: false,
      checkout_blocked_by_identity_review: false,
      rolling_trial_granted: false,
      card_collected: false,
    },
    next_action: 'signed_in',
    setup_email_required: false,
    provider_effects_completed_inline: 0,
    outbox_intent_ids: ['outbox_private'],
    ghl_handoff_state: 'readback_required',
    checkout_handoff_state: 'not_applicable',
    safe_message: 'Your family account is ready.',
  };
}

function checkoutResult(): FamilySignupResult {
  return {
    disposition: 'created',
    projection: {
      adult_id: 'adult_private',
      human_account_id: 'account_private',
      household_id: 'household_private',
      normalized_email: 'ari@example.com',
      access_branch: 'inactive_checkout',
      access_state: 'inactive',
      seat_limit: 3,
      active_seat_count: 0,
      free_access_expires_at: null,
      checkout_required: true,
      checkout_blocked_by_identity_review: false,
      rolling_trial_granted: false,
      card_collected: false,
    },
    next_action: 'checkout',
    setup_email_required: false,
    provider_effects_completed_inline: 0,
    outbox_intent_ids: ['outbox_private'],
    ghl_handoff_state: 'readback_required',
    checkout_handoff_state: 'queued',
    safe_message: 'Your account is ready. Continue to checkout.',
  };
}

function establishedSession(): EstablishedFamilySignupSession {
  return {
    established: true,
    browser_session_token: 's'.repeat(48),
    csrf_token: 'c'.repeat(48),
    expires_at: '2026-08-31T12:00:00.000Z',
    middleware_readback_verified: true,
  };
}

function submission(result: FamilySignupResult): FamilySignupSubmission {
  return {
    result,
    session: result.projection === null ? null : establishedSession(),
  };
}

function unusedPool(): DbPool {
  const fail = async () => {
    throw new Error('The injected route test must not access the database.');
  };
  return {
    connect: fail as never,
    query: fail as never,
    end: vi.fn(async () => undefined) as never,
  };
}
