import type { AddressInfo } from 'node:net';
import express, { type Express } from 'express';
import { describe, expect, it, vi } from 'vitest';
import {
  createStudentPrivacyRouter,
  type SelfManagedStudentPrivacyPrincipal,
} from './student-router.ts';

const principal: SelfManagedStudentPrivacyPrincipal = {
  credential_id: 'student-credential',
  adult_id: 'adult-self',
  student_id: 'student-self',
  household_id: 'household-self',
  owner_adult_id: 'adult-self',
  session_id: 'session-self',
  display_name: 'Adult Student',
};

function setup(
  input: {
    principal?: SelfManagedStudentPrivacyPrincipal | null;
    passwordValid?: boolean;
    csrf?: boolean;
  } = {},
) {
  const service = {
    createRightsRequest: vi.fn().mockResolvedValue({ request_id: 'privacy-request' }),
    studentExportDisclosure: vi.fn().mockReturnValue({
      included: ['own_student_profile', 'own_private_questions_rabbi_answers'],
      excluded: ['sibling_data', 'shared_raw_recordings'],
    }),
  };
  const repository = {
    listConsentEvents: vi.fn().mockResolvedValue([]),
    listDataRightsRequests: vi.fn().mockResolvedValue([]),
  };
  const recordConsent = vi.fn().mockResolvedValue({ disposition: 'appended' });
  let id = 0;
  const app = express();
  app.use(express.json());
  app.use(
    '/api/app/student',
    createStudentPrivacyRouter({
      service: service as never,
      recordConsent: recordConsent as never,
      repository: repository as never,
      scope: {
        product: 'one_time_mishnayos',
        runtime_tier: 'isolated_staging',
        verification_environment_id: 'ci',
      },
      resolvePrincipal: vi
        .fn()
        .mockResolvedValue(
          Object.prototype.hasOwnProperty.call(input, 'principal') ? input.principal : principal,
        ),
      issueCsrfToken: vi.fn().mockResolvedValue('csrf-student-privacy'),
      verifyCsrf: vi.fn().mockResolvedValue(input.csrf !== false),
      verifyPassword: vi.fn().mockResolvedValue(input.passwordValid !== false),
      networkEvidenceDigest: () => 'e'.repeat(64),
      clock: () => new Date('2026-08-05T14:00:00.000Z'),
      nextId: () => `id-${++id}`,
    }),
  );
  return { app, service, repository, recordConsent };
}

describe('self-managed adult Student privacy router', () => {
  it('returns only the exact self Student scope and keeps service-account consent review-only', async () => {
    const { app, repository } = setup();
    const response = await send(app, '/api/app/student/privacy');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const data = (await response.json()).data;
    expect(data.csrf_token).toBe('csrf-student-privacy');
    expect(data.student).toMatchObject({
      student_id: 'student-self',
      relationship: 'self',
      consents: expect.arrayContaining([
        expect.objectContaining({ scope: 'service_account', can_change: false }),
        expect.objectContaining({ scope: 'recording_participation', can_change: true }),
      ]),
    });
    expect(data.export_disclosure.excluded).toContain('sibling_data');
    expect(repository.listConsentEvents).toHaveBeenCalledWith('student-self');
  });

  it('fails closed for a dependent, ambiguous, or otherwise unresolved Student principal', async () => {
    const { app } = setup({ principal: null });
    const response = await send(app, '/api/app/student/privacy');
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('actor_scope_denied');
  });

  it('rejects a request-body Student selector and binds recording withdrawal to the exact principal', async () => {
    const harness = setup();
    const override = await send(harness.app, '/api/app/student/privacy/consents', {
      method: 'POST',
      headers: validHeaders('student-privacy-0001'),
      body: {
        student_id: 'student-sibling',
        scope: 'recording_participation',
        grant: false,
      },
    });
    expect(override.status).toBe(400);
    expect(harness.recordConsent).not.toHaveBeenCalled();

    const response = await send(harness.app, '/api/app/student/privacy/consents', {
      method: 'POST',
      headers: validHeaders('student-privacy-0002'),
      body: { scope: 'recording_participation', grant: false },
    });
    expect(response.status).toBe(200);
    expect(harness.recordConsent).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: expect.objectContaining({ student_id: 'student-self', adult_id: 'adult-self' }),
        subject: expect.objectContaining({
          student_id: 'student-self',
          relationship: 'self',
          self_adult_id: 'adult-self',
          owner_adult_id: 'adult-self',
        }),
        scope: 'recording_participation',
        choice: 'withdrawn',
      }),
    );
  });

  it('requires CSRF and the current Student password for exact-subject data-rights requests', async () => {
    const csrfDenied = setup({ csrf: false });
    const csrfResponse = await send(csrfDenied.app, '/api/app/student/privacy/requests', {
      method: 'POST',
      headers: validHeaders('student-rights-0001'),
      body: { kind: 'export', current_password: 'current-password-123' },
    });
    expect(csrfResponse.status).toBe(403);

    const passwordDenied = setup({ passwordValid: false });
    const passwordResponse = await send(passwordDenied.app, '/api/app/student/privacy/requests', {
      method: 'POST',
      headers: validHeaders('student-rights-0002'),
      body: { kind: 'export', current_password: 'current-password-123' },
    });
    expect(passwordResponse.status).toBe(403);
    expect((await passwordResponse.json()).code).toBe('RECENT_PASSWORD_REQUIRED');

    const allowed = setup();
    const response = await send(allowed.app, '/api/app/student/privacy/requests', {
      method: 'POST',
      headers: validHeaders('student-rights-0003'),
      body: { kind: 'erasure', current_password: 'current-password-123' },
    });
    expect(response.status).toBe(202);
    expect(allowed.service.createRightsRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'erasure',
        subject: {
          kind: 'student',
          student_id: 'student-self',
          household_id: 'household-self',
          relationship: 'self',
          self_adult_id: 'adult-self',
        },
        actor: expect.objectContaining({ recent_password_verified: true }),
        requested_categories: ['own_student_profile', 'own_private_questions_rabbi_answers'],
      }),
    );
  });
});

function validHeaders(idempotencyKey: string) {
  return {
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
