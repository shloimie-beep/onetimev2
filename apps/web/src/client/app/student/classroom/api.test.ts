import { describe, expect, it, vi } from 'vitest';
import { StudentClassroomApiError, createStudentClassroomApi } from './api.ts';

const now = new Date('2026-08-02T10:00:00.000Z');

describe('P18 Student classroom API', () => {
  it('posts only an internally generated exchange secret and accepts a bounded bootstrap', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        success: true,
        data: bootstrapData(),
      }),
    );
    const api = createStudentClassroomApi({
      fetcher,
      now: () => now,
      exchangeSecret: () => 'exchange-secret-with-at-least-thirty-two-characters',
    });

    const result = await api.bootstrap('csrf-token');

    expect(result.lease).toEqual({
      lease_generation: 3,
      version: 7,
      lease_expires_at: '2026-08-02T10:01:30.000Z',
    });
    expect(result.bootstrap.leave_path).toBe('/app/classroom');
    const [url, request] = firstRequest(fetcher);
    expect(url).toBe('/api/app/classroom/bootstrap');
    expect(request).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
    });
    expect(request.headers).toMatchObject({
      accept: 'application/json',
      'content-type': 'application/json',
      'x-csrf-token': 'csrf-token',
    });
    expect(JSON.parse(String(request.body))).toEqual({
      exchange_secret: 'exchange-secret-with-at-least-thirty-two-characters',
    });
    expect(String(request.body)).not.toMatch(
      /student|household|occurrence|enrollment|registrant|device|environment|scope/iu,
    );
  });

  it('rolls the exact heartbeat version forward and sends opaque attendance only', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({
          success: true,
          data: {
            persisted: true,
            lease_generation: 3,
            version: 8,
            lease_expires_at: '2026-08-02T10:01:30.000Z',
            next_heartbeat_at: '2026-08-02T10:00:30.000Z',
          },
        }),
      )
      .mockResolvedValueOnce(
        response({ success: true, data: { disposition: 'accepted' } }, { status: 202 }),
      );
    const api = createStudentClassroomApi({
      fetcher,
      now: () => now,
      idempotencyKey: () => 'opaque-client-event-00000001',
    });

    const heartbeat = await api.heartbeat('csrf-token', { lease_generation: 3, version: 7 });
    expect(heartbeat.version).toBe(8);
    await api.recordAttendance('csrf-token', 'joined');

    const heartbeatBody = JSON.parse(String(firstRequest(fetcher, 0)[1].body));
    expect(heartbeatBody).toEqual({ lease_generation: 3, expected_version: 7 });
    const attendanceBody = JSON.parse(String(firstRequest(fetcher, 1)[1].body));
    expect(attendanceBody).toEqual({
      event_kind: 'joined',
      idempotency_key: 'opaque-client-event-00000001',
    });
    expect(JSON.stringify(attendanceBody)).not.toMatch(
      /student|household|occurrence|registrant|device|lineage|environment|scope/iu,
    );
  });

  it.each([
    {
      name: 'a bootstrap longer than 60 seconds',
      mutate: (data: ReturnType<typeof bootstrapData>) => ({
        ...data,
        bootstrap: { ...data.bootstrap, expires_at: '2026-08-02T10:01:00.001Z' },
      }),
    },
    {
      name: 'an expired bootstrap',
      mutate: (data: ReturnType<typeof bootstrapData>) => ({
        ...data,
        bootstrap: {
          ...data.bootstrap,
          issued_at: '2026-08-02T09:58:59.999Z',
          expires_at: '2026-08-02T09:59:59.999Z',
        },
      }),
    },
    {
      name: 'a future-issued bootstrap',
      mutate: (data: ReturnType<typeof bootstrapData>) => ({
        ...data,
        bootstrap: {
          ...data.bootstrap,
          issued_at: '2026-08-02T10:00:00.001Z',
          expires_at: '2026-08-02T10:01:00.000Z',
        },
      }),
    },
    {
      name: 'a raw provider URL',
      mutate: (data: ReturnType<typeof bootstrapData>) => ({
        ...data,
        bootstrap: { ...data.bootstrap, raw_join_url: 'https://provider.invalid/private' },
      }),
    },
    {
      name: 'a queried leave path',
      mutate: (data: ReturnType<typeof bootstrapData>) => ({
        ...data,
        bootstrap: { ...data.bootstrap, leave_path: '/app/classroom?student=private' },
      }),
    },
    {
      name: 'a mismatched recording indicator',
      mutate: (data: ReturnType<typeof bootstrapData>) => ({
        ...data,
        recording_capture_active: false,
      }),
    },
  ])('rejects $name', async ({ mutate }) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response({ success: true, data: mutate(bootstrapData()) }));
    const api = createStudentClassroomApi({
      fetcher,
      now: () => now,
      exchangeSecret: () => 'exchange-secret-with-at-least-thirty-two-characters',
    });
    await expect(api.bootstrap('csrf-token')).rejects.toBeInstanceOf(StudentClassroomApiError);
  });

  it('requires private no-store and no-referrer response controls', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: bootstrapData() }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const api = createStudentClassroomApi({
      fetcher,
      now: () => now,
      exchangeSecret: () => 'exchange-secret-with-at-least-thirty-two-characters',
    });
    await expect(api.bootstrap('csrf-token')).rejects.toBeInstanceOf(StudentClassroomApiError);
  });

  it('maps only a known safe denial code and never trusts the response message', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      response(
        {
          success: false,
          code: 'second_device_active',
          message: 'unsafe provider detail must not be displayed',
        },
        { status: 403 },
      ),
    );
    const api = createStudentClassroomApi({
      fetcher,
      now: () => now,
      exchangeSecret: () => 'exchange-secret-with-at-least-thirty-two-characters',
    });
    const error = await api.bootstrap('csrf-token').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(StudentClassroomApiError);
    expect(error).toMatchObject({ denialCode: 'second_device_active' });
    expect((error as Error).message).toBe('The classroom is unavailable.');
  });
});

function bootstrapData() {
  return {
    safe_code: 'join_allowed',
    bootstrap: {
      sdk_session_ref: 'sdk-session-1',
      sdk_web_version: '3.11.2',
      sdk_signature: 'header.payload.signature',
      meeting_number: '12345678901',
      meeting_password: 'meeting-password',
      registrant_token: 'registrant-token',
      participant_email: 'student-opaque@example.invalid',
      customer_key: 'zoom_ck_0123456789abcdef01234567',
      participant_display_name: 'Student',
      recording_capture_active: true,
      leave_path: '/app/classroom',
      issued_at: '2026-08-02T10:00:00.000Z',
      expires_at: '2026-08-02T10:01:00.000Z',
      role: 0,
    },
    session: {
      lease_generation: 3,
      version: 7,
      lease_expires_at: '2026-08-02T10:01:30.000Z',
    },
    recording_capture_active: true,
  };
}

function response(payload: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(payload), {
    status: init.status ?? 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'private, no-store',
      'referrer-policy': 'no-referrer',
    },
  });
}

function firstRequest(fetcher: ReturnType<typeof vi.fn<typeof fetch>>, index = 0) {
  const call = fetcher.mock.calls[index];
  if (!call) throw new Error('Expected classroom request.');
  const [url, request] = call;
  if (!request) throw new Error('Expected classroom request options.');
  return [url, request] as const;
}
