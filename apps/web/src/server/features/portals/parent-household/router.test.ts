import type { AddressInfo } from 'node:net';
import express, { type Express } from 'express';
import { describe, expect, it, vi } from 'vitest';
import type { ParentHouseholdSnapshot } from '../../../../../../../packages/contracts/src/portals/parent-household/index.ts';
import type { ParentSummarySnapshot } from '../../../../../../../packages/contracts/src/portals/parent-summary/index.ts';
import { ParentHouseholdError } from '../../../../../../../packages/domain/src/portals/parent-household/index.ts';
import type { V21ParentSessionContext } from '../../auth/v21-adult-session.ts';
import { createParentHouseholdRouter } from './router.ts';
import type { ParentHouseholdService } from './service.ts';
import type { ParentSummaryService } from '../parent-summary/index.ts';

const snapshot: ParentHouseholdSnapshot = {
  contract_version: '1.2.0',
  household_id: 'household-router',
  display_name: 'Router household',
  access_state: 'active',
  student_allowance: 3,
  active_student_count: 0,
  available_student_seats: 3,
  can_manage_students: true,
  revision: 1,
  students: [],
};

const summarySnapshot: ParentSummarySnapshot = {
  contract_version: '1.1.0',
  household_id: 'household-router',
  display_name: 'Router household',
  generated_at: '2026-07-31T14:00:00.000Z',
  students: [],
  schedule: [],
  progress: [],
  updates: [],
  featured_welcome_video: {
    contract_version: '1.0.0',
    status: 'unavailable',
    reason: 'no_approved_version',
    title: 'Welcome to One Time',
    message: 'An approved Parent welcome video is not available yet.',
  },
  support: {
    label: 'Contact support',
    description: 'Get help with your Parent account or household.',
    href: '/app/parent/support',
  },
};

const sessionContext = {
  adultId: 'adult-router',
  normalizedEmail: 'router@example.test',
  ownerDisplayName: 'Router Parent',
  ownedHouseholdCount: 1,
  session: {
    sessionId: 'session-router',
    activeRole: 'parent',
    activeHouseholdId: 'household-router',
  },
  household: {
    householdId: 'household-router',
    displayName: 'Router household',
    classification: 'family',
    accessState: 'active',
    ownerRelationship: 'account_owner',
  },
} as V21ParentSessionContext;

function setup(input: { csrf?: boolean } = {}) {
  const mutation = {
    snapshot: { ...snapshot, revision: 2, active_student_count: 1, available_student_seats: 2 },
    audit: {
      actor_adult_id: 'adult-router',
      household_id: 'household-router',
      student_id: 'student-router',
      action: 'student_created' as const,
    },
    revoke_student_sessions: false,
    canonical_enrollment: 'enroll' as const,
    credential_handoff: {
      student_id: 'student-router',
      student_label: 'Router Student',
      username: 'router.student',
      new_password: '000123',
      display_once: true as const,
      may_copy_or_print: true as const,
      emailed: false as const,
    },
  };
  const service = {
    overview: vi.fn().mockResolvedValue(snapshot),
    createStudent: vi.fn().mockResolvedValue(mutation),
    updateStudent: vi.fn().mockResolvedValue(mutation),
    archiveStudent: vi.fn().mockResolvedValue(mutation),
    restoreStudent: vi.fn().mockResolvedValue(mutation),
    resetStudentCredential: vi.fn().mockResolvedValue(mutation),
  } as unknown as ParentHouseholdService;
  const summaryService = {
    overview: vi.fn().mockResolvedValue(summarySnapshot),
  } as unknown as ParentSummaryService;
  const sessions = {
    bootstrapCookieHeader: vi.fn().mockResolvedValue({
      status: 'resolved',
      context: sessionContext,
      csrf_token: 'csrf-bootstrap-token',
      expires_at: '2026-08-01T14:00:00.000Z',
    }),
    verifyCsrf: vi.fn().mockResolvedValue(input.csrf === false ? null : sessionContext),
  };
  const fingerprintPasswordForIdempotency = vi.fn().mockResolvedValue('f'.repeat(64));
  const app = express();
  app.use(express.json());
  app.use(
    '/api/app/parent',
    createParentHouseholdRouter({
      service,
      summaryService,
      sessions,
      fingerprintPasswordForIdempotency,
      clock: () => new Date('2026-07-31T14:00:00.000Z'),
    }),
  );
  return { app, service, summaryService, sessions, fingerprintPasswordForIdempotency };
}

describe('P12 authenticated Parent household router', () => {
  it('bootstraps only the server-derived Parent household and CSRF proof', async () => {
    const { app, service } = setup();
    const response = await send(app, '/api/app/parent/household', {
      headers: { cookie: 'ot_v21_parent=opaque' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await response.json()).data).toEqual({
      snapshot,
      csrf_token: 'csrf-bootstrap-token',
    });
    expect(service.overview).toHaveBeenCalledWith({
      role: 'parent',
      adult_id: 'adult-router',
      household_id: 'household-router',
      session_id: 'session-router',
    });
  });

  it('returns only the server-derived Parent summary without mutation credentials', async () => {
    const { app, summaryService } = setup();
    const response = await send(app, '/api/app/parent/summary', {
      headers: { cookie: 'ot_v21_parent=opaque' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await response.json()).data).toEqual({
      snapshot: summarySnapshot,
      csrf_token: 'csrf-bootstrap-token',
    });
    expect(summaryService.overview).toHaveBeenCalledWith({
      role: 'parent',
      adult_id: 'adult-router',
      household_id: 'household-router',
      session_id: 'session-router',
    });
  });

  it('rejects missing CSRF before parsing or invoking a mutation', async () => {
    const { app, service } = setup({ csrf: false });
    const response = await send(app, '/api/app/parent/students', {
      method: 'POST',
      headers: {
        cookie: 'ot_v21_parent=opaque',
        'x-idempotency-key': 'parent-router-0001',
      },
      body: createBody(),
    });
    expect(response.status).toBe(403);
    expect(service.createStudent).not.toHaveBeenCalled();
  });

  it('rejects request-selected household scope and accepts no legacy Student fields', async () => {
    const { app, service } = setup();
    const scoped = await send(app, '/api/app/parent/students', {
      method: 'POST',
      headers: validHeaders('parent-router-0002'),
      body: { ...createBody(), household_id: 'household-attacker' },
    });
    expect(scoped.status).toBe(400);
    const legacy = await send(app, '/api/app/parent/students', {
      method: 'POST',
      headers: validHeaders('parent-router-0003'),
      body: { ...createBody(), grade_label: 'Grade 4' },
    });
    expect(legacy.status).toBe(400);
    expect(service.createStudent).not.toHaveBeenCalled();
  });

  it('derives a credential-free stable request hash and exposes only snapshot plus one-time handoff', async () => {
    const { app, service, fingerprintPasswordForIdempotency } = setup();
    const call = (password: string) =>
      send(app, '/api/app/parent/students', {
        method: 'POST',
        headers: validHeaders('parent-router-replay-0001'),
        body: {
          ...createBody(),
          new_password: password,
          password_confirmation: password,
        },
      });
    const first = await call('000123');
    const second = await call('123456');
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const firstBody = await first.json();
    expect(firstBody.data.credential_handoff.new_password).toBe('000123');
    expect(firstBody.data).not.toHaveProperty('audit');
    expect(firstBody.data).not.toHaveProperty('revoke_student_sessions');
    const calls = vi.mocked(service.createStudent).mock.calls;
    expect(calls[0]?.[0]).toMatchObject({ household_id: 'household-router' });
    expect(calls[0]?.[2]).toMatchObject({
      idempotency_key: 'parent-router-replay-0001',
      occurred_at: '2026-07-31T14:00:00.000Z',
    });
    expect(calls[0]?.[2].canonical_request_hash).toMatch(/^[0-9a-f]{64}$/u);
    expect(calls[1]?.[2].canonical_request_hash).toBe(calls[0]?.[2].canonical_request_hash);
    expect(fingerprintPasswordForIdempotency).toHaveBeenCalledTimes(2);
    expect(fingerprintPasswordForIdempotency).toHaveBeenCalledWith('000123');
    expect(fingerprintPasswordForIdempotency).toHaveBeenCalledWith('123456');
  });

  it('conceals a wrong-household Student as unavailable', async () => {
    const { app, service } = setup();
    vi.mocked(service.updateStudent).mockRejectedValueOnce(
      new ParentHouseholdError('parent_student_missing', 'This Student is unavailable.'),
    );
    const response = await send(app, '/api/app/parent/students/student-sibling', {
      method: 'PATCH',
      headers: validHeaders('parent-router-wrong-0001'),
      body: {
        expected_revision: 1,
        actual_name: 'Wrong Student',
        display_name: null,
        username: 'wrong.student',
      },
    });
    expect(response.status).toBe(404);
    expect((await response.json()).message).toBe('This Student is unavailable.');
  });
});

function createBody() {
  return {
    expected_revision: 1,
    actual_name: 'Router Student',
    display_name: null,
    username: 'router.student',
    relationship: 'dependent',
    new_password: '000123',
    password_confirmation: '000123',
  };
}

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
  input: {
    method?: 'GET' | 'POST' | 'PATCH';
    headers?: Record<string, string>;
    body?: unknown;
  } = {},
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
