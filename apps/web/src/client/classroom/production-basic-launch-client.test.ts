import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readProductionBasicReadiness,
  requestProductionBasicLaunch,
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
});
