import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  confirmProductionBasicHostLive,
  createProductionBasicHostEndController,
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
            data: { state: 'live', lifecycle_context: 'opaque-context' },
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(confirmProductionBasicHostLive('csrf-derived')).resolves.toBe('opaque-context');
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

  it('treats SDK status 3 as a reconciliation hint and waits for exact provider proof', async () => {
    const endMeetingForAll = vi.fn(async () => {
      throw new Error('interrupted');
    });
    const clear = vi.fn(async () => 'ended' as const);
    const reconcile = vi
      .fn<() => Promise<'unknown_effect' | 'ended'>>()
      .mockResolvedValueOnce('unknown_effect')
      .mockResolvedValueOnce('ended');
    const controller = createProductionBasicHostEndController({
      csrfToken: 'csrf-derived',
      lifecycleContext: 'lifecycle-context',
      endMeetingForAll,
      clear,
      beginEnd: async () => 'end_requested',
      markUnknown: async () => 'unknown_effect',
      reconcile,
    });
    await controller.markLive();
    await controller.requestEnd();
    await controller.requestEnd();
    await Promise.resolve();
    expect(controller.state).toBe('unknown_effect');
    expect(endMeetingForAll).toHaveBeenCalledOnce();
    expect(clear).not.toHaveBeenCalled();

    await controller.observeMeetingStatus(3);
    expect(controller.state).toBe('unknown_effect');
    expect(clear).not.toHaveBeenCalled();

    await controller.observeMeetingStatus(3);
    expect(controller.state).toBe('ended');
    expect(clear).not.toHaveBeenCalled();
    expect(reconcile).toHaveBeenCalledTimes(2);
  });

  it('retries cleanup only after a provider-confirmed end and never calls provider end twice', async () => {
    const endMeetingForAll = vi.fn(async () => undefined);
    const clear = vi
      .fn<(csrfToken: string, lifecycleContext: string) => Promise<'ended'>>()
      .mockRejectedValueOnce(new Error('local transient'))
      .mockResolvedValueOnce('ended');
    const controller = createProductionBasicHostEndController({
      csrfToken: 'csrf-derived',
      lifecycleContext: 'lifecycle-context',
      endMeetingForAll,
      clear,
    });
    controller.restore('provider_ended');
    await controller.retryAccessCleanup();
    expect(controller.state).toBe('cleanup_pending');
    await controller.retryAccessCleanup();
    expect(controller.state).toBe('ended');
    expect(endMeetingForAll).not.toHaveBeenCalled();
    expect(clear).toHaveBeenCalledTimes(2);
  });

  it('converges a missing SDK callback to unknown effect at the injected command deadline', async () => {
    const timers: Array<() => void> = [];
    const endMeetingForAll = vi.fn(() => new Promise<void>(() => undefined));
    const markUnknown = vi.fn(async () => 'unknown_effect' as const);
    const controller = createProductionBasicHostEndController({
      csrfToken: 'csrf-derived',
      lifecycleContext: 'lifecycle-context',
      endMeetingForAll,
      beginEnd: async () => 'end_requested',
      markUnknown,
      schedule: (callback) => {
        timers.push(callback);
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
      cancel: () => undefined,
    });
    await controller.markLive();
    void controller.requestEnd();
    await Promise.resolve();
    timers[0]!();
    await Promise.resolve();
    expect(controller.state).toBe('unknown_effect');
    expect(endMeetingForAll).toHaveBeenCalledOnce();
    expect(markUnknown).toHaveBeenCalledOnce();
  });

  it('converges a successful SDK callback without status 3 to unknown effect at confirmation deadline', async () => {
    const timers: Array<() => void> = [];
    const controller = createProductionBasicHostEndController({
      csrfToken: 'csrf-derived',
      lifecycleContext: 'lifecycle-context',
      endMeetingForAll: async () => undefined,
      beginEnd: async () => 'end_requested',
      markUnknown: async () => 'unknown_effect',
      schedule: (callback) => {
        timers.push(callback);
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
      cancel: () => undefined,
    });
    await controller.markLive();
    await controller.requestEnd();
    timers.at(-1)!();
    await Promise.resolve();
    expect(controller.state).toBe('unknown_effect');
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
