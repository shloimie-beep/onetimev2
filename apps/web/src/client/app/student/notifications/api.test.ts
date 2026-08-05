import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadStudentNotifications,
  markStudentNotificationRead,
  setStudentNotificationSoundPreference,
} from './api.ts';

afterEach(() => vi.unstubAllGlobals());

describe('Student notification API', () => {
  it('loads the selected filter without caching', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      response({
        success: true,
        data: {
          snapshot: { filter: 'all', unreadCount: 0, soundEnabled: false, notifications: [] },
        },
      }),
    );
    vi.stubGlobal('fetch', fetcher);
    await expect(loadStudentNotifications('all')).resolves.toMatchObject({ filter: 'all' });
    expect(fetcher).toHaveBeenCalledWith(
      '/api/app/student/notifications?filter=all',
      expect.objectContaining({ cache: 'no-store', credentials: 'same-origin' }),
    );
  });

  it('sends CSRF for read and sound mutations without client identity fields', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ success: true, data: { disposition: 'applied' } }))
      .mockResolvedValueOnce(response({ success: true, data: { soundEnabled: true } }));
    vi.stubGlobal('fetch', fetcher);
    await markStudentNotificationRead('csrf-token', 'notice/one');
    await setStudentNotificationSoundPreference('csrf-token', true);
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/app/student/notifications/notice%2Fone/read');
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({ 'x-csrf-token': 'csrf-token' }),
      body: '{}',
    });
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({ enabled: true });
  });
});

function response(body: unknown) {
  return {
    ok: true,
    json: async () => body,
  };
}
