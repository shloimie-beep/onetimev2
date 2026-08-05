import type { AddressInfo } from 'node:net';
import express, { type Express } from 'express';
import { describe, expect, it, vi } from 'vitest';
import type { CommercialBillingProjection } from '../../../../../../../packages/contracts/src/billing/commercial/index.ts';
import type { V21ParentSessionContext } from '../../auth/v21-adult-session.ts';
import { createParentCommercialBillingRouter } from './parent-router.ts';
import type { createCommercialBillingService } from './service.ts';

const projection: CommercialBillingProjection = {
  householdId: 'household-billing-router',
  ownerAdultId: 'adult-billing-router',
  accessState: 'free',
  subscriptionState: 'none',
  activeStudentCount: 2,
  freePeriodEndsAt: '2026-09-11T15:00:00.000Z',
  paidPeriodEndsAt: null,
  firstChargeAt: null,
  cancelAtPeriodEnd: false,
  sourceEvidenceDigest: null,
  version: 1,
};

const sessionContext = {
  adultId: 'adult-billing-router',
  normalizedEmail: 'billing@example.test',
  ownerDisplayName: 'Billing Parent',
  ownedHouseholdCount: 1,
  memberships: ['parent'],
  session: {
    sessionId: 'session-billing-router',
    humanAccountId: 'human-billing-router',
    activeRole: 'parent',
    activeHouseholdId: 'household-billing-router',
  },
  household: {
    householdId: 'household-billing-router',
    displayName: 'Billing household',
    classification: 'family',
    accessState: 'free',
    ownerRelationship: 'account_owner',
  },
} as unknown as V21ParentSessionContext;

function setup(input: { csrf?: boolean } = {}) {
  const mutationResult = {
    disposition: 'applied' as const,
    projection: { ...projection, subscriptionState: 'checkout_requested' as const, version: 2 },
    intent: {} as never,
  };
  const service = {
    createFamilySignup: vi.fn(),
    execute: vi.fn().mockResolvedValue(mutationResult),
    ingestVerifiedEvidence: vi.fn(),
    summary: vi.fn().mockResolvedValue(projection),
  } as unknown as ReturnType<typeof createCommercialBillingService>;
  const sessions = {
    bootstrapCookieHeader: vi.fn().mockResolvedValue({
      status: 'resolved',
      context: sessionContext,
      csrf_token: 'csrf-billing-token',
      expires_at: '2026-08-05T15:00:00.000Z',
    }),
    verifyCsrf: vi.fn().mockResolvedValue(input.csrf === false ? null : sessionContext),
  };
  const app = express();
  app.use(express.json());
  app.use(
    '/api/app/parent',
    createParentCommercialBillingRouter({
      service,
      sessions,
      scope: {
        product: 'one_time_mishnayos',
        runtime_tier: 'isolated_staging',
        verification_environment_id: 'ci',
      },
      freeAccessExpiresAt: '2026-09-11T15:00:00.000Z',
      clock: () => new Date('2026-08-05T14:00:00.000Z'),
    }),
  );
  return { app, service, sessions, mutationResult };
}

describe('Parent commercial billing router', () => {
  it('returns only the authenticated household projection and fixed cutoff', async () => {
    const { app, service } = setup();
    const response = await send(app, '/api/app/parent/billing', {
      headers: { cookie: 'ot_v21_parent=opaque' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await response.json()).data).toEqual({
      projection,
      free_period: {
        sourceKey: 'family_free_period_v2_1',
        timeZone: 'Asia/Jerusalem',
        endsAt: '2026-09-11T15:00:00.000Z',
      },
      csrf_token: 'csrf-billing-token',
    });
    expect(service.summary).toHaveBeenCalledWith('household-billing-router');
  });

  it('queues a standard hosted checkout without immediate-charge consent', async () => {
    const { app, service } = setup();
    const response = await send(app, '/api/app/parent/billing/checkout', {
      method: 'POST',
      headers: validHeaders('billing-standard-0001'),
      body: { expected_version: 1, mode: 'standard' },
    });
    expect(response.status).toBe(202);
    expect((await response.json()).data.provider_handoff).toEqual({
      status: 'queued',
      orchestrator: 'highlevel',
      financial_provider: 'stripe',
      redirect_url: null,
    });
    expect(service.execute).toHaveBeenCalledWith({
      actor: expect.objectContaining({
        adultId: 'adult-billing-router',
        authorization: expect.objectContaining({
          humanAccountId: 'human-billing-router',
          activeHouseholdId: 'household-billing-router',
          serverResolvedOwnedHouseholdIds: ['household-billing-router'],
        }),
      }),
      command: expect.objectContaining({
        kind: 'request_hosted_checkout',
        householdId: 'household-billing-router',
        mode: 'standard',
        consent: null,
      }),
    });
  });

  it('requires CSRF and explicit immediate-charge consent', async () => {
    const denied = setup({ csrf: false });
    const deniedResponse = await send(denied.app, '/api/app/parent/billing/portal', {
      method: 'POST',
      headers: validHeaders('billing-portal-0001'),
      body: { expected_version: 1 },
    });
    expect(deniedResponse.status).toBe(403);
    expect(denied.service.execute).not.toHaveBeenCalled();

    const immediate = setup();
    const immediateResponse = await send(immediate.app, '/api/app/parent/billing/checkout', {
      method: 'POST',
      headers: validHeaders('billing-immediate-0001'),
      body: {
        expected_version: 1,
        mode: 'immediate_exception',
        immediate_charge_accepted: false,
      },
    });
    expect(immediateResponse.status).toBe(400);
    expect((await immediateResponse.json()).code).toBe('consent_required');
    expect(immediate.service.execute).not.toHaveBeenCalled();
  });
});

function validHeaders(idempotencyKey: string) {
  return {
    cookie: 'ot_v21_parent=opaque',
    'x-csrf-token': 'csrf-valid',
    'x-idempotency-key': idempotencyKey,
  };
}

async function send(
  app: Express,
  pathname: string,
  input: { method?: 'GET' | 'POST'; headers?: Record<string, string>; body?: unknown } = {},
) {
  const server = await new Promise<ReturnType<Express['listen']>>((resolve, reject) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    listening.once('error', reject);
  });
  const address = server.address() as AddressInfo;
  try {
    return await fetch(`http://127.0.0.1:${address.port}${pathname}`, {
      method: input.method ?? 'GET',
      headers: {
        ...(input.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...input.headers,
      },
      ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}
