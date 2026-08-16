import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ProductionBasicEndOutcomeUnknownError,
  clearProductionBasicHostLive,
  confirmProductionBasicHostLive,
  createProductionBasicStudentAttendanceController,
  productionBasicEndActionPolicy,
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

  it.each(['provider rejected', 'provider timed out'])(
    'treats %s as an unknown effect and never sends a second provider end',
    async (failure) => {
      const endMeeting = vi.fn(async () => {
        throw new Error(failure);
      });
      const clear = vi.fn(async () => undefined);
      const controller = await startAndConfirmProductionBasicHostLive({
        csrfToken: 'csrf-derived',
        startMeeting: async (onMeetingStatus) => {
          onMeetingStatus(2);
          return { endMeeting };
        },
        confirm: async () => undefined,
        clear,
      });

      await expect(controller.endClass()).rejects.toBeInstanceOf(
        ProductionBasicEndOutcomeUnknownError,
      );
      await expect(controller.endClass()).rejects.toMatchObject({
        code: 'PRODUCTION_BASIC_END_OUTCOME_UNKNOWN',
      });
      expect(endMeeting).toHaveBeenCalledOnce();
      expect(clear).not.toHaveBeenCalled();
    },
  );

  it('reconciles an unknown end from later status 3 and clears exactly once', async () => {
    let emitStatus: ((status: 1 | 2 | 3 | 4) => void) | undefined;
    const endMeeting = vi.fn(async () => {
      throw new Error('provider callback timed out');
    });
    const clear = vi.fn(async () => undefined);
    const onEndReconciled = vi.fn();
    const controller = await startAndConfirmProductionBasicHostLive({
      csrfToken: 'csrf-derived',
      startMeeting: async (onMeetingStatus) => {
        emitStatus = onMeetingStatus;
        onMeetingStatus(2);
        return { endMeeting };
      },
      confirm: async () => undefined,
      clear,
      onEndReconciled,
    });

    await expect(controller.endClass()).rejects.toBeInstanceOf(
      ProductionBasicEndOutcomeUnknownError,
    );
    emitStatus?.(3);
    emitStatus?.(3);
    await Promise.resolve();
    await expect(controller.endClass()).resolves.toBeUndefined();
    expect(endMeeting).toHaveBeenCalledOnce();
    expect(clear).toHaveBeenCalledOnce();
    expect(clear).toHaveBeenCalledWith('csrf-derived', { keepalive: true });
    expect(onEndReconciled).toHaveBeenCalledOnce();
  });

  it.each(['provider rejected', 'provider timed out'])(
    'lets Admin/Rabbi retry only receipt cleanup after %s, status 3, and a transient clear failure',
    async (failure) => {
      let emitStatus: ((status: 1 | 2 | 3 | 4) => void) | undefined;
      let outcomeUnknown = false;
      let cleanupPending = false;
      let studentLiveReceiptCleared = false;
      const endMeeting = vi.fn(async () => {
        throw new Error(failure);
      });
      const clear = vi
        .fn<() => Promise<void>>()
        .mockRejectedValueOnce(new Error('temporary receipt clear failure'))
        .mockImplementationOnce(async () => {
          studentLiveReceiptCleared = true;
        });
      const controller = await startAndConfirmProductionBasicHostLive({
        csrfToken: 'csrf-derived',
        startMeeting: async (onMeetingStatus) => {
          emitStatus = onMeetingStatus;
          onMeetingStatus(2);
          return { endMeeting };
        },
        confirm: async () => undefined,
        clear,
        onProviderEndConfirmed: () => {
          outcomeUnknown = false;
          cleanupPending = true;
        },
        onEndReconciled: () => {
          cleanupPending = false;
        },
      });

      await expect(controller.endClass()).rejects.toBeInstanceOf(
        ProductionBasicEndOutcomeUnknownError,
      );
      outcomeUnknown = true;
      expect(endMeeting).toHaveBeenCalledOnce();
      expect(clear).not.toHaveBeenCalled();

      emitStatus?.(3);
      await Promise.resolve();
      await Promise.resolve();

      expect(clear).toHaveBeenCalledOnce();
      expect(studentLiveReceiptCleared).toBe(false);
      expect(
        productionBasicEndActionPolicy({ busy: false, outcomeUnknown, cleanupPending }),
      ).toEqual({ disabled: false, mode: 'cleanup_pending' });

      await expect(controller.endClass()).resolves.toBeUndefined();

      expect(endMeeting).toHaveBeenCalledOnce();
      expect(clear).toHaveBeenCalledTimes(2);
      expect(studentLiveReceiptCleared).toBe(true);
      expect(cleanupPending).toBe(false);
    },
  );

  it('preserves the host receipt on page close until status 3 confirms provider end', async () => {
    let pageHide: (() => void) | undefined;
    let emitStatus: ((status: 1 | 2 | 3 | 4) => void) | undefined;
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
        emitStatus = onMeetingStatus;
        onMeetingStatus(2);
        return { endMeeting: async () => undefined };
      },
      confirm: async () => undefined,
      clear,
    });

    pageHide?.();
    await Promise.resolve();
    expect(clear).not.toHaveBeenCalled();

    emitStatus?.(3);
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

  it('retries a rejected Student leave with keepalive during disposal', async () => {
    const record = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('temporary attendance failure'))
      .mockResolvedValueOnce(undefined);
    const controller = createProductionBasicStudentAttendanceController({
      csrfToken: 'csrf-derived',
      attendanceSessionKey: 'production-basic-attendance-derived',
      record,
    });
    await controller.connected();

    await expect(controller.disconnected()).rejects.toThrow('temporary attendance failure');
    controller.dispose();
    await Promise.resolve();
    await Promise.resolve();

    expect(record).toHaveBeenCalledTimes(3);
    expect(record).toHaveBeenNthCalledWith(
      2,
      'csrf-derived',
      'production-basic-attendance-derived',
      'left',
      { keepalive: false },
    );
    expect(record).toHaveBeenNthCalledWith(
      3,
      'csrf-derived',
      'production-basic-attendance-derived',
      'left',
      { keepalive: true },
    );
  });

  it('upgrades a pending ordinary Student leave with one idempotent keepalive request', async () => {
    let pageHide: (() => void) | undefined;
    let resolveOrdinaryLeave: (() => void) | undefined;
    vi.stubGlobal('window', {
      addEventListener: vi.fn((_name: string, listener: () => void) => {
        pageHide = listener;
      }),
      removeEventListener: vi.fn(),
    });
    const record = vi.fn(
      async (
        _csrfToken: string,
        _attendanceSessionKey: string,
        eventKind: 'joined' | 'left',
        options: { keepalive?: boolean } = {},
      ) => {
        if (eventKind === 'left' && options.keepalive !== true) {
          await new Promise<void>((resolve) => {
            resolveOrdinaryLeave = resolve;
          });
        }
      },
    );
    const controller = createProductionBasicStudentAttendanceController({
      csrfToken: 'csrf-derived',
      attendanceSessionKey: 'production-basic-attendance-derived',
      record,
    });
    await controller.connected();

    const ordinaryLeave = controller.disconnected();
    await Promise.resolve();
    pageHide?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(record).toHaveBeenCalledTimes(3);
    expect(record).toHaveBeenNthCalledWith(
      2,
      'csrf-derived',
      'production-basic-attendance-derived',
      'left',
      { keepalive: false },
    );
    expect(record).toHaveBeenNthCalledWith(
      3,
      'csrf-derived',
      'production-basic-attendance-derived',
      'left',
      { keepalive: true },
    );

    resolveOrdinaryLeave?.();
    await ordinaryLeave;
  });
});
