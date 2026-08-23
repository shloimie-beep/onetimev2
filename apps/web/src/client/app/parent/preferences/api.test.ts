import { describe, expect, it, vi } from 'vitest';
import { createParentPreferencesApi } from './api.ts';

const snapshot = {
  household_id: 'household-api',
  time_zone: 'Asia/Jerusalem',
  portal_class_reminders: false,
  email_class_reminders: false,
  whatsapp_class_reminders: false as const,
  whatsapp_available: false as const,
  parent_newsletter_consent: false,
  newsletter_consent_policy_version: 'parent-newsletter-v2.1-2026-08-05',
  newsletter_consent_recorded_at: null,
  active_student_count: 2,
  revision: 1,
  updated_at: '2026-08-05T14:00:00.000Z',
};

describe('Parent preferences API', () => {
  it('uses private same-origin reads and CSRF/idempotency-protected updates', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: { snapshot, csrf_token: 'csrf' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { snapshot: { ...snapshot, portal_class_reminders: true, revision: 2 } },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    const api = createParentPreferencesApi({
      fetcher,
      basePath: '/preferences',
      idempotencyKey: () => 'preferences-api-0001',
    });
    await expect(api.load()).resolves.toEqual({ snapshot, csrf_token: 'csrf' });
    await expect(
      api.update({ ...snapshot, portal_class_reminders: true }, 'csrf'),
    ).resolves.toMatchObject({ portal_class_reminders: true, revision: 2 });
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      '/preferences',
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: expect.objectContaining({
          'x-csrf-token': 'csrf',
          'x-idempotency-key': 'preferences-api-0001',
        }),
      }),
    );
  });
});
