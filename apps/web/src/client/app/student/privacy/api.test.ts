import { describe, expect, it, vi } from 'vitest';
import { createStudentPrivacyApi } from './api.ts';

const snapshot = {
  policy_versions: {
    privacy_notice: 'privacy-v1',
    terms: 'terms-v1',
    student_data_recording: 'recording-v1',
    cancellation_refund: null,
  },
  student: {
    student_id: 'student-self',
    display_name: 'Adult Student',
    relationship: 'self' as const,
    consents: [],
  },
  requests: [],
  export_disclosure: { included: ['own_student_profile'], excluded: ['sibling_data'] },
};

describe('Student privacy API', () => {
  it('loads the exact Student snapshot and CSRF proof without a subject selector', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { success: true, data: { ...snapshot, csrf_token: 'csrf-student' } }),
      );
    const api = createStudentPrivacyApi({ fetcher, basePath: '/student-privacy' });
    await expect(api.load()).resolves.toEqual({ snapshot, csrf_token: 'csrf-student' });
    expect(fetcher).toHaveBeenCalledWith('/student-privacy', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    });
  });

  it('sends only a mutable consent scope and no Student id', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { success: true, data: { snapshot } }));
    const api = createStudentPrivacyApi({
      fetcher,
      basePath: '/student-privacy',
      idempotencyKey: () => 'student-privacy-idem-0001',
    });
    await api.changeConsent({ scope: 'recording_participation', grant: false }, 'csrf-student');
    const request = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      scope: 'recording_participation',
      grant: false,
    });
    expect(request.headers).toMatchObject({
      'x-csrf-token': 'csrf-student',
      'x-idempotency-key': 'student-privacy-idem-0001',
    });
  });

  it('surfaces safe server denial details', async () => {
    const api = createStudentPrivacyApi({
      fetcher: vi.fn().mockResolvedValue(
        jsonResponse(403, {
          success: false,
          code: 'actor_scope_denied',
          message: 'This Student privacy scope is unavailable.',
        }),
      ),
    });
    await expect(api.load()).rejects.toEqual(
      expect.objectContaining({
        code: 'actor_scope_denied',
        status: 403,
      }),
    );
  });
});

function jsonResponse(status: number, value: unknown) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
