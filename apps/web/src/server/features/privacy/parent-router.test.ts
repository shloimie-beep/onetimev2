import type { AddressInfo } from 'node:net';
import express, { type Express } from 'express';
import { describe, expect, it, vi } from 'vitest';
import type { V21ParentSessionContext } from '../auth/v21-adult-session.ts';
import { createParentPrivacyRouter } from './parent-router.ts';

const context = {
  adultId: 'adult-privacy',
  memberships: ['parent'],
  session: {
    sessionId: 'session-privacy',
    humanAccountId: 'human-privacy',
    activeRole: 'parent',
    activeHouseholdId: 'household-privacy',
  },
  household: {
    householdId: 'household-privacy',
    ownerRelationship: 'account_owner',
  },
} as unknown as V21ParentSessionContext;

const subject = {
  student_id: 'student-dependent',
  household_id: 'household-privacy',
  relationship: 'dependent' as const,
  owner_adult_id: 'adult-privacy',
  self_adult_id: null,
  display_name: 'Dependent Student',
  state: 'active' as const,
};

function setup(input: { passwordValid?: boolean; csrf?: boolean } = {}) {
  const service = {
    recordConsent: vi.fn().mockResolvedValue({ disposition: 'appended' }),
    createRightsRequest: vi.fn().mockResolvedValue({ request_id: 'privacy-request' }),
    parentExportDisclosure: vi.fn().mockReturnValue({
      included: ['adult_household'],
      excluded: ['private_questions'],
    }),
  };
  const repository = {
    listConsentEvents: vi.fn().mockResolvedValue([]),
    listDataRightsRequests: vi.fn().mockResolvedValue([]),
  };
  const subjects = { list: vi.fn().mockResolvedValue([subject]) };
  const sessions = {
    bootstrapCookieHeader: vi.fn().mockResolvedValue({
      status: 'resolved',
      context,
      csrf_token: 'csrf-privacy',
    }),
    verifyCsrf: vi.fn().mockResolvedValue(input.csrf === false ? null : context),
  };
  let id = 0;
  const app = express();
  app.use(express.json());
  app.use(
    '/api/app/parent',
    createParentPrivacyRouter({
      service: service as never,
      repository: repository as never,
      subjects: subjects as never,
      sessions,
      scope: {
        product: 'one_time_mishnayos',
        runtime_tier: 'isolated_staging',
        verification_environment_id: 'ci',
      },
      verifyPassword: vi.fn().mockResolvedValue(input.passwordValid !== false),
      networkEvidenceDigest: () => 'e'.repeat(64),
      clock: () => new Date('2026-08-05T14:00:00.000Z'),
      nextId: () => `id-${++id}`,
    }),
  );
  return { app, service, repository, subjects };
}

describe('Parent privacy router', () => {
  it('returns scoped Student consent summaries and Parent export disclosure', async () => {
    const { app, repository } = setup();
    const response = await send(app, '/api/app/parent/privacy', {
      headers: { cookie: 'ot_v21_parent=opaque' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const data = (await response.json()).data;
    expect(data.csrf_token).toBe('csrf-privacy');
    expect(data.students).toEqual([
      expect.objectContaining({
        student_id: 'student-dependent',
        display_name: 'Dependent Student',
        consents: expect.arrayContaining([
          expect.objectContaining({ scope: 'service_account', granted: false, can_change: true }),
        ]),
      }),
    ]);
    expect(data.export_disclosure).toEqual({
      included: ['adult_household'],
      excluded: ['private_questions'],
    });
    expect(repository.listConsentEvents).toHaveBeenCalledWith('student-dependent');
  });

  it('records append-only exact-Student consent with hashed network evidence', async () => {
    const { app, service } = setup();
    const response = await send(app, '/api/app/parent/privacy/consents', {
      method: 'POST',
      headers: validHeaders('privacy-consent-0001'),
      body: { student_id: 'student-dependent', scope: 'recording_participation', grant: true },
    });
    expect(response.status).toBe(200);
    expect(service.recordConsent).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotency_key: 'privacy-consent-0001',
        canonical_request_hash: expect.stringMatching(/^[0-9a-f]{64}$/u),
        network_evidence_digest: 'e'.repeat(64),
        subject,
        choice: 'granted',
      }),
    );
  });

  it('requires the current Parent password for a household data-rights request', async () => {
    const denied = setup({ passwordValid: false });
    const deniedResponse = await send(denied.app, '/api/app/parent/privacy/requests', {
      method: 'POST',
      headers: validHeaders('privacy-rights-0001'),
      body: { kind: 'erasure', current_password: 'current-password-123' },
    });
    expect(deniedResponse.status).toBe(403);
    expect((await deniedResponse.json()).code).toBe('RECENT_PASSWORD_REQUIRED');
    expect(denied.service.createRightsRequest).not.toHaveBeenCalled();

    const allowed = setup();
    const allowedResponse = await send(allowed.app, '/api/app/parent/privacy/requests', {
      method: 'POST',
      headers: validHeaders('privacy-rights-0002'),
      body: { kind: 'export', current_password: 'current-password-123' },
    });
    expect(allowedResponse.status).toBe(202);
    expect(allowed.service.createRightsRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'export',
        subject: { kind: 'household', household_id: 'household-privacy' },
        actor: expect.objectContaining({ recent_password_verified: true }),
        requested_categories: ['adult_household'],
      }),
    );
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
