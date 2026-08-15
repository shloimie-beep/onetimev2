import type { AddressInfo } from 'node:net';
import express, { type Express } from 'express';
import { describe, expect, it, vi } from 'vitest';
import type { V21ParentSessionContext } from '../../auth/v21-adult-session.ts';
import { createParentWelcomeRouter } from './router.ts';
import type { ParentWelcomeService } from './service.ts';

const context = {
  adultId: 'adult-parent',
  session: {
    sessionId: 'session-parent',
    activeRole: 'parent',
    activeHouseholdId: 'household-parent',
  },
  household: {
    householdId: 'household-parent',
    ownerRelationship: 'account_owner',
  },
} as V21ParentSessionContext;

function setup(input: { csrf?: boolean } = {}) {
  const descriptor = {
    contract_version: '1.0.0' as const,
    kind: 'protected_parent_video' as const,
    video_version_id: 'welcome-approved-v1',
    media_path: '/api/app/parent/welcome-video/welcome-approved-v1/media' as const,
    poster_path: '/api/app/parent/welcome-video/welcome-approved-v1/poster' as const,
    captions_path: '/api/app/parent/welcome-video/welcome-approved-v1/captions' as const,
    captions_default: true as const,
    autoplay_policy: 'muted_when_allowed' as const,
    expires_at: '2026-08-15T10:05:00.000Z',
  };
  const service = {
    playbackDescriptor: vi.fn(async () => descriptor),
    recordBrowserEvent: vi.fn(async () => ({
      receipts: [
        {
          event_type: 'parent.welcome_video_started',
          video_version_id: 'welcome-approved-v1',
          recorded: true,
          recorded_at: '2026-08-15T10:00:00.000Z',
        },
      ],
    })),
  } as unknown as ParentWelcomeService;
  const sessions = {
    bootstrapCookieHeader: vi.fn(async () => ({
      status: 'resolved' as const,
      context,
      csrf_token: 'csrf-parent',
      expires_at: '2026-08-15T12:00:00.000Z',
    })),
    verifyCsrf: vi.fn(async () => (input.csrf === false ? null : context)),
  };
  const app = express();
  app.use(express.json());
  app.use(
    '/api/app/parent/welcome-video',
    createParentWelcomeRouter({
      service,
      sessions,
      clock: () => new Date('2026-08-15T10:00:00.000Z'),
    }),
  );
  return { app, service, sessions, descriptor };
}

describe('Parent welcome protected router', () => {
  it('returns only the signed-in Parent same-origin playback descriptor', async () => {
    const { app, service, descriptor } = setup();
    const response = await send(app, '/api/app/parent/welcome-video/welcome-approved-v1/playback', {
      headers: { cookie: 'ot_v21_parent=opaque' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect((await response.json()).data).toEqual({ descriptor });
    expect(service.playbackDescriptor).toHaveBeenCalledWith(
      {
        role: 'parent',
        adult_id: 'adult-parent',
        household_id: 'household-parent',
        session_id: 'session-parent',
      },
      'welcome-approved-v1',
    );
  });

  it('requires CSRF and a stable idempotency key for browser events', async () => {
    const { app, service } = setup();
    const response = await send(app, '/api/app/parent/welcome-video/events', {
      method: 'POST',
      headers: {
        cookie: 'ot_v21_parent=opaque',
        'x-csrf-token': 'csrf-parent',
        'x-idempotency-key': 'welcome-started-0001',
      },
      body: {
        event_type: 'parent.welcome_video_started',
        video_version_id: 'welcome-approved-v1',
      },
    });

    expect(response.status).toBe(202);
    expect(service.recordBrowserEvent).toHaveBeenCalledWith(
      expect.objectContaining({ household_id: 'household-parent' }),
      {
        event_type: 'parent.welcome_video_started',
        video_version_id: 'welcome-approved-v1',
      },
      expect.objectContaining({
        idempotency_key: 'welcome-started-0001',
        canonical_request_hash: expect.stringMatching(/^[0-9a-f]{64}$/u),
      }),
    );
  });

  it('fails closed for media when no protected asset runtime is bound', async () => {
    const { app } = setup();
    const response = await send(app, '/api/app/parent/welcome-video/welcome-approved-v1/media', {
      headers: { cookie: 'ot_v21_parent=opaque' },
    });
    expect(response.status).toBe(404);
    expect(JSON.stringify(await response.json())).not.toMatch(/vimeo|drive|https?:\/\//iu);
  });

  it('rejects an event before the service when CSRF is invalid', async () => {
    const { app, service } = setup({ csrf: false });
    const response = await send(app, '/api/app/parent/welcome-video/events', {
      method: 'POST',
      headers: {
        cookie: 'ot_v21_parent=opaque',
        'x-csrf-token': 'wrong',
        'x-idempotency-key': 'welcome-started-0002',
      },
      body: {
        event_type: 'parent.welcome_video_started',
        video_version_id: 'welcome-approved-v1',
      },
    });
    expect(response.status).toBe(403);
    expect(service.recordBrowserEvent).not.toHaveBeenCalled();
  });
});

async function send(
  app: Express,
  pathname: string,
  input: {
    method?: 'GET' | 'POST';
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
