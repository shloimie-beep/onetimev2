import type { AddressInfo } from 'node:net';
import express, { type Express } from 'express';
import { describe, expect, it, vi } from 'vitest';
import type { V21ParentSessionContext } from '../../auth/v21-adult-session.ts';
import { createParentPreferencesRouter } from './router.ts';

const snapshot = {
  household_id: 'household-preferences',
  time_zone: 'Asia/Jerusalem',
  portal_class_reminders: false,
  email_class_reminders: false,
  whatsapp_class_reminders: false as const,
  whatsapp_available: false as const,
  parent_newsletter_consent: true,
  newsletter_consent_policy_version: 'parent-newsletter-v2.1-2026-08-05',
  newsletter_consent_recorded_at: '2026-08-01T10:00:00.000Z',
  active_student_count: 3,
  revision: 1,
  updated_at: '2026-08-01T10:00:00.000Z',
};

const context = {
  adultId: 'adult-preferences',
  memberships: ['parent'],
  session: {
    sessionId: 'session-preferences',
    humanAccountId: 'human-preferences',
    activeRole: 'parent',
    activeHouseholdId: 'household-preferences',
  },
  household: {
    householdId: 'household-preferences',
    ownerRelationship: 'account_owner',
  },
} as unknown as V21ParentSessionContext;

function setup(csrf = true) {
  const repository = {
    load: vi.fn().mockResolvedValue(snapshot),
    update: vi.fn().mockResolvedValue({ ...snapshot, portal_class_reminders: true, revision: 2 }),
  };
  const sessions = {
    bootstrapCookieHeader: vi.fn().mockResolvedValue({
      status: 'resolved',
      context,
      csrf_token: 'csrf-preferences',
    }),
    verifyCsrf: vi.fn().mockResolvedValue(csrf ? context : null),
  };
  const app = express();
  app.use(express.json());
  app.use(
    '/api/app/parent',
    createParentPreferencesRouter({
      repository: repository as never,
      sessions,
      clock: () => new Date('2026-08-05T14:00:00.000Z'),
    }),
  );
  return { app, repository };
}

describe('Parent preferences router', () => {
  it('loads only the server-bound household preferences and CSRF proof', async () => {
    const { app, repository } = setup();
    const response = await send(app, '/api/app/parent/preferences', {
      headers: { cookie: 'ot_v21_parent=opaque' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await response.json()).data).toEqual({
      snapshot,
      csrf_token: 'csrf-preferences',
    });
    expect(repository.load).toHaveBeenCalledWith({
      adult_id: 'adult-preferences',
      household_id: 'household-preferences',
    });
  });

  it('persists an idempotent, revision-bound update with a valid IANA time zone', async () => {
    const { app, repository } = setup();
    const response = await send(app, '/api/app/parent/preferences', {
      method: 'PATCH',
      headers: validHeaders('preferences-update-0001'),
      body: {
        time_zone: 'America/New_York',
        portal_class_reminders: true,
        email_class_reminders: false,
        parent_newsletter_consent: true,
        expected_revision: 1,
      },
    });
    expect(response.status).toBe(200);
    expect(repository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        principal: {
          adult_id: 'adult-preferences',
          household_id: 'household-preferences',
        },
        idempotency_key: 'preferences-update-0001',
        canonical_request_hash: expect.stringMatching(/^[0-9a-f]{64}$/u),
        command: expect.objectContaining({ time_zone: 'America/New_York' }),
      }),
    );
  });

  it('rejects invalid CSRF and invalid time zones without persistence', async () => {
    const denied = setup(false);
    const deniedResponse = await send(denied.app, '/api/app/parent/preferences', {
      method: 'PATCH',
      headers: validHeaders('preferences-update-0002'),
      body: updateBody('Asia/Jerusalem'),
    });
    expect(deniedResponse.status).toBe(403);
    expect(denied.repository.update).not.toHaveBeenCalled();

    const invalid = setup();
    const invalidResponse = await send(invalid.app, '/api/app/parent/preferences', {
      method: 'PATCH',
      headers: validHeaders('preferences-update-0003'),
      body: updateBody('Mars/Olympus'),
    });
    expect(invalidResponse.status).toBe(400);
    expect(invalid.repository.update).not.toHaveBeenCalled();
  });
});

function updateBody(timeZone: string) {
  return {
    time_zone: timeZone,
    portal_class_reminders: true,
    email_class_reminders: true,
    parent_newsletter_consent: false,
    expected_revision: 1,
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
  input: { method?: 'GET' | 'PATCH'; headers?: Record<string, string>; body?: unknown } = {},
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
