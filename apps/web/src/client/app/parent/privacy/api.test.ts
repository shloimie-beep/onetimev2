import { describe, expect, it, vi } from 'vitest';
import { createParentPrivacyApi } from './api.ts';

const snapshot = {
  policy_versions: {
    privacy_notice: 'privacy-v1',
    terms: 'terms-v1',
    student_data_recording: 'recording-v1',
    cancellation_refund: 'cancellation-v1',
  },
  students: [],
  requests: [],
  export_disclosure: { included: ['adult_household'], excluded: ['private_questions'] },
};

describe('Parent privacy API', () => {
  it('keeps reads private and sends CSRF/idempotency proof on password-verified requests', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: { ...snapshot, csrf_token: 'csrf' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: { snapshot } }), {
          status: 202,
          headers: { 'content-type': 'application/json' },
        }),
      );
    const api = createParentPrivacyApi({
      fetcher,
      basePath: '/privacy',
      idempotencyKey: () => 'privacy-api-0001',
    });
    await expect(api.load()).resolves.toEqual({ snapshot, csrf_token: 'csrf' });
    await expect(
      api.createRequest({ kind: 'export', currentPassword: 'current-password-123' }, 'csrf'),
    ).resolves.toEqual(snapshot);
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      '/privacy/requests',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: expect.objectContaining({
          'x-csrf-token': 'csrf',
          'x-idempotency-key': 'privacy-api-0001',
        }),
        body: JSON.stringify({ kind: 'export', current_password: 'current-password-123' }),
      }),
    );
  });
});
