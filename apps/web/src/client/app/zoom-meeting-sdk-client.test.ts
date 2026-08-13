import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  joinZoomMeetingParticipantWithApi,
  type ZoomMeetingSdkApi,
  type ZoomParticipantJoinInput,
} from './zoom-meeting-sdk-client.ts';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('production-basic native Meeting SDK adapter', () => {
  it('has a dedicated registration-off adapter and conditionally omits registration-only fields', async () => {
    const source = await readFile('apps/web/src/client/app/zoom-meeting-sdk-client.ts', 'utf8');
    expect(source).toContain('joinZoomMeetingProductionBasic');
    expect(source).toContain('startZoomMeetingProductionBasic');
    expect(source).toContain('{ ...input, disablePreview: true }');
    expect(source).toContain('...(input.registrantToken ? { tk: input.registrantToken } : {})');
    expect(source).toContain('...(input.userEmail ? { userEmail: input.userEmail } : {})');
    expect(source).toContain('...(input.customerKey ? { customerKey: input.customerKey } : {})');
  });

  it('resolves only after status 2 and delivers the sanitized lifecycle through status 3', async () => {
    const sdk = fakeZoomSdk();
    const statuses: number[] = [];
    const joined = joinZoomMeetingParticipantWithApi(
      sdk.api,
      input({
        onMeetingStatus: (status) => statuses.push(status),
      }),
    );
    let resolved = false;
    void joined.then(() => {
      resolved = true;
    });

    sdk.emit(1);
    await Promise.resolve();
    expect(resolved).toBe(false);
    sdk.emit(2);
    await expect(joined).resolves.toBeUndefined();
    expect(sdk.hasActiveListener()).toBe(true);

    sdk.emit(4);
    sdk.emit(3);
    expect(statuses).toEqual([1, 2, 4, 3]);
    expect(sdk.hasActiveListener()).toBe(false);
  });

  it('rejects and deactivates the listener on a pre-connect status 3', async () => {
    const sdk = fakeZoomSdk();
    const joined = joinZoomMeetingParticipantWithApi(sdk.api, input());
    sdk.emit(3);
    await expect(joined).rejects.toThrow(
      'Meeting SDK disconnected before the meeting was connected.',
    );
    expect(sdk.hasActiveListener()).toBe(false);
  });

  it('rejects and deactivates the listener after the bounded connection timeout', async () => {
    vi.useFakeTimers();
    const sdk = fakeZoomSdk();
    const joined = joinZoomMeetingParticipantWithApi(sdk.api, input());
    const rejected = expect(joined).rejects.toThrow('Meeting SDK connection timed out.');
    await vi.advanceTimersByTimeAsync(45_000);
    await rejected;
    expect(sdk.hasActiveListener()).toBe(false);
  });

  it('isolates a throwing lifecycle consumer from connection settlement', async () => {
    const sdk = fakeZoomSdk();
    const consumer = vi.fn(() => {
      throw new Error('consumer failure');
    });
    const joined = joinZoomMeetingParticipantWithApi(
      sdk.api,
      input({ onMeetingStatus: consumer }),
    );
    sdk.emit(2);
    await expect(joined).resolves.toBeUndefined();
    sdk.emit(3);
    expect(consumer).toHaveBeenCalledTimes(2);
    expect(sdk.hasActiveListener()).toBe(false);
  });

  it('removes the status listener at status 2 when no lifecycle consumer exists', async () => {
    const sdk = fakeZoomSdk();
    const joined = joinZoomMeetingParticipantWithApi(sdk.api, input());
    sdk.emit(2);
    await expect(joined).resolves.toBeUndefined();
    expect(sdk.hasActiveListener()).toBe(false);
  });

  it.each([
    ['listener' as const, 'Meeting SDK setup failed'],
    ['init' as const, 'Meeting SDK setup failed'],
    ['join' as const, 'Meeting SDK participant join failed'],
  ])('cleans up when %s setup throws synchronously', async (failure, expectedMessage) => {
    const sdk = fakeZoomSdk(failure);
    await expect(joinZoomMeetingParticipantWithApi(sdk.api, input())).rejects.toThrow(
      expectedMessage,
    );
    expect(sdk.hasActiveListener()).toBe(false);
  });

  it("does not pass Zoom's deprecated sdkKey join parameter", async () => {
    const source = await readFile('apps/web/src/client/app/zoom-meeting-sdk-client.ts', 'utf8');
    expect(source).not.toContain('sdkKey: sdkKeyFromSignature');
    expect(source).not.toContain('function sdkKeyFromSignature');
  });
});

function input(overrides: Partial<ZoomParticipantJoinInput> = {}): ZoomParticipantJoinInput {
  return {
    sdkWebVersion: '6.2.0',
    meetingNumber: 'test-meeting',
    signature: 'test-signature',
    meetingPassword: 'test-password',
    userName: 'Test learner',
    leaveUrl: 'https://example.test/leave',
    ...overrides,
  };
}

function fakeZoomSdk(failure?: 'listener' | 'init' | 'join') {
  let listener: ((event: unknown) => void) | undefined;
  const api = {
    setZoomJSLib: vi.fn(),
    preLoadWasm: vi.fn(),
    prepareWebSDK: vi.fn(),
    inMeetingServiceListener: vi.fn((_name: unknown, nextListener: unknown) => {
      if (failure === 'listener') throw new Error('listener setup failed');
      listener = nextListener as (event: unknown) => void;
    }),
    removeInMeetingServiceListener: vi.fn((_name: unknown, priorListener: unknown) => {
      if (listener === priorListener) listener = undefined;
    }),
    init: vi.fn((options: unknown) => {
      if (failure === 'init') throw new Error('initialization failed');
      (options as { success: () => void }).success();
    }),
    join: vi.fn((options: unknown) => {
      if (failure === 'join') throw new Error('join failed');
      (options as { success: () => void }).success();
    }),
  } as unknown as ZoomMeetingSdkApi;
  return {
    api,
    emit(status: number) {
      listener?.({ status });
    },
    hasActiveListener() {
      return listener !== undefined;
    },
  };
}
