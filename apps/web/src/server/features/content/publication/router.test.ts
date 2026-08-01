import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ContentPublicationPrincipal,
  ContentPublicationRecord,
} from '../../../../../../../packages/contracts/src/content/publication/index.ts';
import {
  createContentPublicationRouter,
  type ContentPublicationRequestIdentity,
  type ContentPublicationServicePort,
} from './router.ts';

const servers: Array<ReturnType<express.Express['listen']>> = [];

afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop();
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe('P21 content-publication router', () => {
  it('registers an approved projection for Admin with CSRF and returns only safe projection data', async () => {
    const service = fakeService();
    vi.mocked(service.registerApprovedProjection).mockResolvedValue({
      record: record(),
      replay: false,
    });
    const harness = await startHarness(service, identity('admin'));
    const response = await post(harness, '/api/app/content/publication/approved-projections', {
      content_version_id: 'content-version-one',
    });
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(body).toMatchObject({
      success: true,
      data: { content_id: 'content-one', state: 'needs_review', version: 1 },
    });
    expect(JSON.stringify(body)).not.toMatch(/approvalEvidence|opaqueProvider|vimeo|https?:/iu);
  });

  it('returns the same neutral denial to Parent without touching Student library data', async () => {
    const service = fakeService();
    const harness = await startHarness(service, identity('parent'));
    const response = await post(harness, '/api/app/student/library/search', { query: '' });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      success: false,
      code: 'CONTENT_UNAVAILABLE',
      message: 'Content is unavailable.',
    });
    expect(service.library).not.toHaveBeenCalled();
  });

  it('rejects caller-supplied scope before invoking the Student service', async () => {
    const service = fakeService();
    const harness = await startHarness(service, identity('student'));
    const response = await post(harness, '/api/app/student/library/search', {
      query: '',
      student_id: 'other-student',
    });
    expect(response.status).toBe(400);
    expect(service.library).not.toHaveBeenCalled();
  });
});

async function startHarness(
  service: ContentPublicationServicePort,
  resolved: ContentPublicationRequestIdentity,
) {
  const app = express();
  app.use(express.json());
  app.use(
    '/api',
    createContentPublicationRouter({
      service,
      resolveIdentity: async () => resolved,
      verifyCsrf: async (req) => req.header('x-csrf-token') === 'csrf-test',
      clock: () => new Date('2026-08-01T10:00:00.000Z'),
    }),
  );
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listening = app.listen(0, '127.0.0.1', (error?: Error) =>
      error ? reject(error) : resolve(listening),
    );
  });
  servers.push(server);
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

function post(baseUrl: string, path: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-csrf-token': 'csrf-test',
    },
    body: JSON.stringify(body),
  });
}

function identity(role: ContentPublicationPrincipal['role']): ContentPublicationRequestIdentity {
  return {
    sessionKey: 'session-one',
    principal: {
      actorId: role === 'student' ? 'student-user-one' : `${role}-one`,
      role,
      accountKey: 'account-one',
      productKey: 'one_time_mishnayos',
      householdId: role === 'student' ? 'household-one' : '',
      studentId: role === 'student' ? 'student-one' : null,
      sessionId: role === 'student' ? 'session-one' : null,
      sessionVersion: role === 'student' ? 1 : null,
      accessState: role === 'parent' ? 'inactive' : 'active',
    },
  };
}

function fakeService(): ContentPublicationServicePort {
  const unavailable = vi.fn(async () => {
    throw new Error('Unexpected P21 service call.');
  });
  return {
    registerApprovedProjection: vi.fn(unavailable),
    approve: vi.fn(unavailable),
    requestPublish: vi.fn(unavailable),
    attachOccurrence: vi.fn(unavailable),
    unpublish: vi.fn(unavailable),
    archive: vi.fn(unavailable),
    library: vi.fn(unavailable),
    playback: vi.fn(unavailable),
    saveResume: vi.fn(unavailable),
    resolveResumeExpectedVersion: vi.fn(async () => 0),
  } as unknown as ContentPublicationServicePort;
}

function record(): ContentPublicationRecord {
  return {
    contentId: 'content-one',
    contentVersionId: 'content-version-one',
    title: 'Berachos Review',
    state: 'needs_review',
    version: 1,
    approval: null,
    occurrenceRelations: [],
    updatedAt: '2026-08-01T10:00:00.000Z',
  } as unknown as ContentPublicationRecord;
}
