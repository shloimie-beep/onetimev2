import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearProductionBasicHostLive,
  confirmProductionBasicHostLive,
  createProductionBasicStudentAttendanceController,
  readProductionBasicReadiness,
  recordProductionBasicAttendance,
  requestProductionBasicLaunch,
  startAndConfirmProductionBasicHostLive,
} from './production-basic-launch-client.ts';

describe('production-basic launch client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

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
                attendance_session_key: 'production-basic-attendance-derived',
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
    await requestProductionBasicLaunch('csrf-derived');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/classroom/production-basic/launch',
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
    await expect(requestProductionBasicLaunch('csrf-derived')).rejects.toThrow(
      'Classroom launch response is invalid.',
    );
  });

  it('reads only neutral server readiness during navigation and never launches', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ success: true, data: { mode: 'production_basic', available: false } }),
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(readProductionBasicReadiness('csrf-derived')).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/classroom/production-basic/status',
      expect.objectContaining({ credentials: 'same-origin' }),
    );
  });

  it('confirms live state with one body-less request after the host join succeeds', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ success: true, data: { state: 'live' } }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(confirmProductionBasicHostLive('csrf-derived')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/classroom/production-basic/host-live',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'x-csrf-token': 'csrf-derived' },
      }),
    );
    const [, requestInit] = (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>)[0]!;
    expect(requestInit).not.toHaveProperty('body');
  });

  it('records only the opaque attendance session and event kind with optional keepalive', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ success: true, data: { disposition: 'accepted' } }), {
          status: 202,
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await recordProductionBasicAttendance(
      'csrf-derived',
      'production-basic-attendance-derived',
      'left',
      { keepalive: true },
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/classroom/production-basic/attendance',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        keepalive: true,
        body: JSON.stringify({
          attendance_session_key: 'production-basic-attendance-derived',
          event_kind: 'left',
        }),
      }),
    );
  });

  it('clears live state with one body-less request', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ success: true, data: { state: 'scheduled' } }), {
          status: 200,
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(clearProductionBasicHostLive('csrf-derived')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/classroom/production-basic/host-ended',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'x-csrf-token': 'csrf-derived' },
      }),
    );
    const [, requestInit] = (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>)[0]!;
    expect(requestInit).not.toHaveProperty('body');
  });

  it('confirms only after status 2 and clears once on a later status 3', async () => {
    let emitStatus: ((status: 1 | 2 | 3 | 4) => void) | undefined;
    const confirm = vi.fn(async () => undefined);
    const clear = vi.fn(async () => undefined);

    await startAndConfirmProductionBasicHostLive({
      csrfToken: 'csrf-derived',
      startMeeting: async (onMeetingStatus) => {
        emitStatus = onMeetingStatus;
        onMeetingStatus(2);
        return { endMeeting: async () => undefined };
      },
      confirm,
      clear,
    });
    expect(confirm).toHaveBeenCalledOnce();
    expect(clear).not.toHaveBeenCalled();

    emitStatus?.(4);
    emitStatus?.(3);
    emitStatus?.(3);
    await Promise.resolve();
    expect(clear).toHaveBeenCalledOnce();
    expect(clear).toHaveBeenCalledWith('csrf-derived', { keepalive: true });
  });

  it('ends the provider meeting before clearing and reuses the same idempotent cleanup', async () => {
    const order: string[] = [];
    const endMeeting = vi.fn(async () => {
      order.push('provider-ended');
    });
    const clear = vi.fn(async () => {
      order.push('receipt-cleared');
    });
    const controller = await startAndConfirmProductionBasicHostLive({
      csrfToken: 'csrf-derived',
      startMeeting: async (onMeetingStatus) => {
        onMeetingStatus(2);
        return { endMeeting };
      },
      confirm: async () => undefined,
      clear,
    });

    await controller.endClass();
    await controller.endClass();
    expect(endMeeting).toHaveBeenCalledOnce();
    expect(clear).toHaveBeenCalledOnce();
    expect(order).toEqual(['provider-ended', 'receipt-cleared']);
  });

  it('retries only receipt cleanup after the provider has already ended', async () => {
    const endMeeting = vi.fn(async () => undefined);
    const clear = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('temporary cleanup failure'))
      .mockResolvedValueOnce(undefined);
    const controller = await startAndConfirmProductionBasicHostLive({
      csrfToken: 'csrf-derived',
      startMeeting: async (onMeetingStatus) => {
        onMeetingStatus(2);
        return { endMeeting };
      },
      confirm: async () => undefined,
      clear,
    });

    await expect(controller.endClass()).rejects.toThrow('temporary cleanup failure');
    await expect(controller.endClass()).resolves.toBeUndefined();
    expect(endMeeting).toHaveBeenCalledOnce();
    expect(clear).toHaveBeenCalledTimes(2);
  });

  it('sends host receipt cleanup with keepalive when the page closes', async () => {
    let pageHide: (() => void) | undefined;
    vi.stubGlobal('window', {
      addEventListener: vi.fn((_name: string, listener: () => void) => {
        pageHide = listener;
      }),
      removeEventListener: vi.fn(),
    });
    const clear = vi.fn(async () => undefined);
    await startAndConfirmProductionBasicHostLive({
      csrfToken: 'csrf-derived',
      startMeeting: async (onMeetingStatus) => {
        onMeetingStatus(2);
        return { endMeeting: async () => undefined };
      },
      confirm: async () => undefined,
      clear,
    });

    pageHide?.();
    await Promise.resolve();
    expect(clear).toHaveBeenCalledOnce();
    expect(clear).toHaveBeenCalledWith('csrf-derived', { keepalive: true });
  });

  it('keeps Student join/leave retry-safe and sends page-close leave with keepalive', async () => {
    let pageHide: (() => void) | undefined;
    vi.stubGlobal('window', {
      addEventListener: vi.fn((_name: string, listener: () => void) => {
        pageHide = listener;
      }),
      removeEventListener: vi.fn(),
    });
    const record = vi.fn(async () => undefined);
    const controller = createProductionBasicStudentAttendanceController({
      csrfToken: 'csrf-derived',
      attendanceSessionKey: 'production-basic-attendance-derived',
      record,
    });
    await controller.connected();
    await controller.connected();
    pageHide?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(record).toHaveBeenNthCalledWith(
      1,
      'csrf-derived',
      'production-basic-attendance-derived',
      'joined',
    );
    expect(record).toHaveBeenNthCalledWith(
      2,
      'csrf-derived',
      'production-basic-attendance-derived',
      'left',
      { keepalive: true },
    );
  });
});
