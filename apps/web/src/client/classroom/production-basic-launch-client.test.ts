import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  confirmProductionBasicHostLive,
  readStudentProductionBasicReadiness,
  requestHostProductionBasicLaunch,
  requestStudentProductionBasicLaunch,
} from './production-basic-launch-client.ts';

describe('production-basic launch client', () => {
  afterEach(() => vi.restoreAllMocks());

  it('issues one body-less POST only when the explicit UI action calls it', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              launch_artifact: {
                mode: 'production_basic',
                role: 0,
                sdk_web_version: '3.13.2',
                meeting_number: '123',
                meeting_password: 'pass',
                signature: 'signature',
                user_name: 'Student',
                leave_path: '/app/student',
                issued_at: '2026-08-12T10:00:00.000Z',
                expires_at: '2026-08-12T10:15:00.000Z',
                raw_join_url_present: false,
                video_start_model: 'PARTICIPANT_CONSENT',
              },
            },
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    expect(fetchMock).not.toHaveBeenCalled();
    await requestStudentProductionBasicLaunch('csrf-derived');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/portals/student/classroom/production-basic/launch',
      expect.objectContaining({
        method: 'POST',
        headers: { 'x-csrf-token': 'csrf-derived' },
      }),
    );
    const [, requestInit] = (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>)[0]!;
    expect(requestInit).not.toHaveProperty('body');
    expect(requestInit.headers).not.toHaveProperty('content-type');
  });

  it('rejects a provider response that attempts to return a reusable join URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              success: true,
              data: { launch_artifact: { raw_join_url_present: true } },
            }),
            { status: 200 },
          ),
      ),
    );
    await expect(requestStudentProductionBasicLaunch('csrf-derived')).rejects.toThrow(
      'Classroom launch response is invalid.',
    );
  });

  it('rejects a hostile HTTP-200 role-1 artifact in the Student client', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => artifactResponse({ role: 1, leave_path: '/app/live-console', zak: 'zak' })),
    );
    await expect(requestStudentProductionBasicLaunch('csrf-derived')).rejects.toThrow(
      'Classroom launch response is invalid.',
    );
  });

  it.each([
    { role: 0, leave_path: '/app/student' },
    { role: 1, leave_path: '/app/live-console' },
  ])(
    'rejects a hostile participant or missing-ZAK artifact in the Host client',
    async (hostile) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => artifactResponse(hostile)),
      );
      await expect(requestHostProductionBasicLaunch('csrf-derived')).rejects.toThrow(
        'Classroom launch response is invalid.',
      );
    },
  );

  it('reads only neutral server readiness during navigation and never launches', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ success: true, data: { mode: 'production_basic', available: false } }),
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(readStudentProductionBasicReadiness('csrf-derived')).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/portals/student/classroom/production-basic/status',
      expect.objectContaining({ credentials: 'same-origin' }),
    );
  });

  it('confirms live state with one body-less request after the host join succeeds', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: { state: 'live' },
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(confirmProductionBasicHostLive('csrf-derived')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/admin/classroom/production-basic/host-live',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'x-csrf-token': 'csrf-derived' },
      }),
    );
    const [, requestInit] = (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>)[0]!;
    expect(requestInit).not.toHaveProperty('body');
  });
});

function artifactResponse(overrides: Record<string, unknown>) {
  return new Response(
    JSON.stringify({
      success: true,
      data: {
        launch_artifact: {
          mode: 'production_basic',
          role: 0,
          sdk_web_version: '3.13.2',
          meeting_number: '123',
          meeting_password: 'pass',
          signature: 'signature',
          user_name: 'Student',
          leave_path: '/app/student',
          issued_at: '2026-08-12T10:00:00.000Z',
          expires_at: '2026-08-12T10:15:00.000Z',
          raw_join_url_present: false,
          video_start_model: 'PARTICIPANT_CONSENT',
          ...overrides,
        },
      },
    }),
    { status: 200 },
  );
}
