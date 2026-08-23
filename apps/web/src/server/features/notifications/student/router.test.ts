import type { AddressInfo } from 'node:net';
import express from 'express';
import { describe, expect, it, vi } from 'vitest';
import type { StudentNotificationService } from './service.ts';
import { createStudentNotificationRouter } from './router.ts';

function setup(input: { authenticated?: boolean; csrf?: boolean } = {}) {
  const service = {
    center: vi.fn().mockResolvedValue({
      filter: 'unread',
      unreadCount: 0,
      soundEnabled: false,
      notifications: [],
    }),
    markRead: vi.fn().mockResolvedValue({ disposition: 'applied' }),
    markAllRead: vi.fn().mockResolvedValue({ changedCount: 1 }),
    setSoundPreference: vi.fn().mockResolvedValue({ soundEnabled: true }),
    openAction: vi.fn().mockResolvedValue({
      status: 'allowed',
      route: '/app/student/progress',
      message: null,
    }),
  } as unknown as StudentNotificationService;
  const resolvePrincipal = vi
    .fn()
    .mockResolvedValue(
      input.authenticated === false
        ? null
        : { principal: { studentId: 'student-router' }, sessionKey: 'session-router' },
    );
  const verifyCsrf = vi.fn().mockResolvedValue(input.csrf !== false);
  const app = express();
  app.use(express.json());
  app.use(
    '/api/app/student/notifications',
    createStudentNotificationRouter({
      service,
      resolvePrincipal,
      verifyCsrf,
      clock: () => new Date('2026-08-05T12:00:00.000Z'),
    }),
  );
  return { app, service, resolvePrincipal, verifyCsrf };
}

describe('Student notification router', () => {
  it('loads a no-store Student-scoped center', async () => {
    const { app, service } = setup();
    const response = await send(app, '/api/app/student/notifications?filter=unread');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect((await response.json()).data.snapshot.unreadCount).toBe(0);
    expect(service.center).toHaveBeenCalledWith({
      principal: { studentId: 'student-router' },
      filter: 'unread',
      now: new Date('2026-08-05T12:00:00.000Z'),
    });
  });

  it('requires a Student principal and CSRF for mutations', async () => {
    const unauthenticated = setup({ authenticated: false });
    const denied = await send(unauthenticated.app, '/api/app/student/notifications/notice-1/read', {
      method: 'POST',
      headers: { 'x-csrf-token': 'csrf' },
    });
    expect(denied.status).toBe(403);
    const noCsrf = setup({ csrf: false });
    const forbidden = await send(noCsrf.app, '/api/app/student/notifications/read-all', {
      method: 'POST',
    });
    expect(forbidden.status).toBe(403);
    expect(noCsrf.service.markAllRead).not.toHaveBeenCalled();
  });

  it('persists preference and opens only the service-authorized internal action', async () => {
    const { app, service } = setup();
    const preference = await send(app, '/api/app/student/notifications/sound-preference', {
      method: 'POST',
      headers: { 'x-csrf-token': 'csrf' },
      body: { enabled: true },
    });
    expect(preference.status).toBe(200);
    expect(service.setSoundPreference).toHaveBeenCalledWith({
      principal: { studentId: 'student-router' },
      enabled: true,
    });
    const opened = await send(app, '/api/app/student/notifications/notice-1/open', {
      method: 'POST',
      headers: { 'x-csrf-token': 'csrf' },
    });
    expect((await opened.json()).data.route).toBe('/app/student/progress');
  });
});

async function send(
  app: express.Express,
  pathname: string,
  input: { method?: 'GET' | 'POST'; headers?: Record<string, string>; body?: unknown } = {},
) {
  const server = await new Promise<ReturnType<express.Express['listen']>>((resolve, reject) => {
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
