import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  EmbeddedClassroomRequestIdentityResolver,
  VerifiedProviderAttendanceResolver,
} from './adapters.ts';
import { digestEmbeddedAttendanceEvidence, hashEmbeddedExchangeSecret } from './adapters.ts';
import { EMBEDDED_CLASSROOM_MOUNT_PATH } from './composition.ts';
import { createEmbeddedClassroomRouter, type EmbeddedClassroomRouterInput } from './router.ts';
import type { EmbeddedClassroomService } from './service.ts';

const NOW = new Date('2026-07-28T17:00:00.000Z');
const SCOPE = {
  product: 'one_time_mishnayos' as const,
  runtime_tier: 'isolated_staging' as const,
  verification_environment_id: 'ci' as const,
};
const STUDENT = {
  scope: SCOPE,
  actor: {
    role: 'student' as const,
    student_id: 'student-canonical',
    household_id: 'household-canonical',
    authenticated_session_id: 'session-canonical',
    device_lineage_id: 'lineage-canonical',
    csrf_verified: true,
  },
};
const servers: Array<ReturnType<express.Express['listen']>> = [];

afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop();
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe('P18 embedded-classroom router', () => {
  it('returns only the authenticated Admin canonical attendance projection', async () => {
    const service = serviceFixture();
    const list = vi.fn(async () => []);
    const baseUrl = await start({ service, adminAttendanceRecords: { list } });

    const response = await get(baseUrl, '/attendance/admin');

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(list).toHaveBeenCalledWith({ scope: SCOPE, admin_id: 'admin-canonical' });
    expect(await response.json()).toEqual({ success: true, data: [] });
  });

  it('accepts only the exact bootstrap body, hashes the exchange secret, and returns no-store data', async () => {
    const service = serviceFixture();
    const baseUrl = await start({ service, allocateId: () => 'live-allocation-1' });
    const exchangeSecret = '0123456789abcdefghijklmnopqrstuvwxyz-EXCHANGE';

    const response = await post(baseUrl, '/bootstrap', { exchange_secret: exchangeSecret });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(service.bootstrap).toHaveBeenCalledWith({
      ...STUDENT,
      grant_id: `p18-grant-${hashEmbeddedExchangeSecret(exchangeSecret)}`,
      grant_key_digest: hashEmbeddedExchangeSecret(exchangeSecret),
      live_session_id: 'p18-live-live-allocation-1',
      now: NOW,
    });
    expect(JSON.stringify(service.bootstrap.mock.calls)).not.toContain(exchangeSecret);
    expect(await response.json()).toEqual({
      success: true,
      data: {
        safe_code: 'join_allowed',
        bootstrap: sdkBootstrap(),
        recording_capture_active: true,
        session: {
          lease_generation: 1,
          version: 7,
          lease_expires_at: '2026-07-28T17:01:30.000Z',
        },
      },
    });

    service.bootstrap.mockClear();
    const injected = await post(baseUrl, '/bootstrap', {
      exchange_secret: exchangeSecret,
      student_id: 'student-attacker',
      household_id: 'household-attacker',
      occurrence_id: 'occurrence-attacker',
    });
    expect(injected.status).toBe(400);
    expect(service.bootstrap).not.toHaveBeenCalled();
  });

  it('passes only server-resolved identity through heartbeat and returns the rolled lease fences', async () => {
    const service = serviceFixture();
    service.heartbeat.mockResolvedValueOnce({
      persisted: true,
      lease_generation: 2,
      version: 8,
      lease_expires_at: '2026-07-28T17:02:00.000Z',
      next_heartbeat_at: '2026-07-28T17:01:00.000Z',
    });
    const baseUrl = await start({ service });

    const response = await post(baseUrl, '/heartbeat', {
      lease_generation: 1,
      expected_version: 7,
    });

    expect(response.status).toBe(200);
    expect(service.heartbeat).toHaveBeenCalledWith({
      ...STUDENT,
      lease_generation: 1,
      expected_version: 7,
      now: NOW,
    });
    expect(await response.json()).toEqual({
      success: true,
      data: {
        persisted: true,
        lease_generation: 2,
        version: 8,
        lease_expires_at: '2026-07-28T17:02:00.000Z',
        next_heartbeat_at: '2026-07-28T17:01:00.000Z',
      },
    });

    service.heartbeat.mockClear();
    const injected = await post(baseUrl, '/heartbeat', {
      lease_generation: 2,
      expected_version: 8,
      student_id: 'student-attacker',
    });
    expect(injected.status).toBe(400);
    expect(service.heartbeat).not.toHaveBeenCalled();
  });

  it('derives client-attendance subject and lineage without accepting client identity fields', async () => {
    const service = serviceFixture();
    const baseUrl = await start({ service, allocateId: () => 'attendance-allocation-1' });

    const response = await post(
      `${baseUrl}?student_id=student-attacker&occurrence_id=occurrence-attacker`,
      '/attendance/client',
      { event_kind: 'joined', idempotency_key: 'client-event-001' },
    );

    expect(response.status).toBe(202);
    expect(service.recordClientAttendance).toHaveBeenCalledOnce();
    const command = service.recordClientAttendance.mock.calls[0]?.[0];
    expect(command).toMatchObject({
      ...STUDENT,
      event_kind: 'joined',
      attendance_event_id: 'p18-attendance-attendance-allocation-1',
      idempotency_key: 'client-event-001',
      now: NOW,
    });
    expect(command?.source_event_ref_digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(command)).not.toContain('student-attacker');
    expect(JSON.stringify(command)).not.toContain('occurrence-attacker');

    service.recordClientAttendance.mockClear();
    const injected = await post(baseUrl, '/attendance/client', {
      event_kind: 'left',
      idempotency_key: 'client-event-002',
      student_id: 'student-attacker',
    });
    expect(injected.status).toBe(400);
    expect(service.recordClientAttendance).not.toHaveBeenCalled();
  });

  it('derives an immutable Admin audit reference and rejects caller-supplied audit evidence', async () => {
    const service = serviceFixture();
    const baseUrl = await start({ service });

    const response = await post(baseUrl, '/admin/reset', {
      student_id: 'student-target',
      idempotency_key: 'reset-request-001',
    });

    expect(response.status).toBe(200);
    const expectedAuditRef = digestEmbeddedAttendanceEvidence({
      operation: 'classroom_launch_reset',
      admin_id: 'admin-canonical',
      student_id: 'student-target',
      idempotency_key: 'reset-request-001',
    });
    expect(service.reset).toHaveBeenCalledWith({
      scope: SCOPE,
      actor: {
        role: 'admin',
        admin_id: 'admin-canonical',
        audit_ref: expectedAuditRef,
      },
      student_id: 'student-target',
      now: NOW,
    });
    expect(expectedAuditRef).toMatch(/^[a-f0-9]{64}$/u);

    service.reset.mockClear();
    const injected = await post(baseUrl, '/admin/reset', {
      student_id: 'student-target',
      idempotency_key: 'reset-request-001',
      audit_ref: 'caller-controlled-audit',
    });
    expect(injected.status).toBe(400);
    expect(service.reset).not.toHaveBeenCalled();
  });

  it('keeps unverified or unavailable provider intake fail closed behind one generic response', async () => {
    const service = serviceFixture();
    const unavailable = await start({
      service,
      providerAttendance: { verify: vi.fn(async () => null) },
    });
    const unavailableResponse = await fetch(
      `${unavailable}${EMBEDDED_CLASSROOM_MOUNT_PATH}/attendance/provider`,
      { method: 'POST' },
    );

    expect(unavailableResponse.status).toBe(503);
    expect(unavailableResponse.headers.get('cache-control')).toContain('no-store');
    expect(await unavailableResponse.json()).toEqual({
      success: false,
      code: 'CLASSROOM_UNAVAILABLE',
      message: 'Classroom access is unavailable.',
    });
    expect(service.recordVerifiedProviderAttendance).not.toHaveBeenCalled();

    const verifierFailure = await start({
      service,
      providerAttendance: {
        verify: vi.fn(async () => {
          throw new Error('provider-specific-secret-or-mismatch');
        }),
      },
    });
    const failureResponse = await fetch(
      `${verifierFailure}${EMBEDDED_CLASSROOM_MOUNT_PATH}/attendance/provider`,
      { method: 'POST' },
    );
    expect(failureResponse.status).toBe(503);
    const failurePayload = await failureResponse.json();
    expect(failurePayload).toEqual({
      success: false,
      code: 'CLASSROOM_UNAVAILABLE',
      message: 'Classroom access is unavailable.',
    });
    expect(JSON.stringify(failurePayload)).not.toContain('provider-specific');
    expect(service.recordVerifiedProviderAttendance).not.toHaveBeenCalled();
  });
});

function serviceFixture() {
  return {
    bootstrap: vi.fn(async () => ({
      disposition: 'ready' as const,
      safe_code: 'join_allowed' as const,
      session: {
        live_session_id: 'live-1',
        scope: SCOPE,
        student_id: 'student-canonical',
        household_id: 'household-canonical',
        occurrence_id: 'occurrence-canonical',
        authenticated_session_id: 'session-canonical',
        device_lineage_id: 'lineage-canonical',
        state: 'active' as const,
        lease_generation: 1,
        last_heartbeat_at: NOW.toISOString(),
        lease_expires_at: '2026-07-28T17:01:30.000Z',
        revoked_at: null,
        revoked_by_admin_id: null,
        revoke_audit_ref: null,
        version: 7,
      },
      bootstrap: sdkBootstrap(),
      response_headers: {
        'cache-control': 'no-store' as const,
        'referrer-policy': 'no-referrer' as const,
      },
    })),
    redeem: vi.fn(async () => ({
      disposition: 'denied' as const,
      safe_code: 'bootstrap_unavailable' as const,
    })),
    heartbeat: vi.fn(async () => ({
      persisted: true,
      lease_generation: 1,
      version: 8,
      lease_expires_at: '2026-07-28T17:02:00.000Z',
      next_heartbeat_at: '2026-07-28T17:00:30.000Z',
    })),
    reset: vi.fn(async () => ({ disposition: 'revoked' as const })),
    recordClientAttendance: vi.fn<EmbeddedClassroomService['recordClientAttendance']>(async () => ({
      disposition: 'accepted' as const,
    })),
    recordVerifiedProviderAttendance: vi.fn(async () => ({ disposition: 'accepted' as const })),
    recordAdminCorrection: vi.fn(async () => ({ disposition: 'accepted' as const })),
  };
}

function sdkBootstrap() {
  return {
    sdk_session_ref: 'sdk-session-1',
    sdk_web_version: '3.11.2',
    sdk_signature: 'ephemeral-signature',
    meeting_number: '91234567890',
    meeting_password: 'meeting-password',
    registrant_token: 'registrant-token',
    participant_email: 'zoom-registration+fixture@onetimeonetime.com',
    customer_key: 'zoom_ck_1234567890abcdef12345678',
    participant_display_name: 'Student',
    recording_capture_active: true,
    leave_path: '/app/classroom' as const,
    issued_at: NOW.toISOString(),
    expires_at: '2026-07-28T17:00:45.000Z',
    role: 0 as const,
  };
}

async function start(input: {
  service: ReturnType<typeof serviceFixture>;
  identities?: EmbeddedClassroomRequestIdentityResolver;
  providerAttendance?: VerifiedProviderAttendanceResolver;
  adminAttendanceRecords?: EmbeddedClassroomRouterInput['adminAttendanceRecords'];
  allocateId?: () => string;
}) {
  const identities = input.identities ?? {
    resolveStudent: vi.fn(async () => STUDENT),
    resolveAdmin: vi.fn(async () => ({ scope: SCOPE, admin_id: 'admin-canonical' })),
    resolveAdminRead: vi.fn(async () => ({ scope: SCOPE, admin_id: 'admin-canonical' })),
  };
  const app = express();
  app.use(express.json());
  app.use(
    EMBEDDED_CLASSROOM_MOUNT_PATH,
    createEmbeddedClassroomRouter({
      service: input.service as EmbeddedClassroomService,
      identities,
      providerAttendance: input.providerAttendance ?? { verify: async () => null },
      adminAttendanceRecords: input.adminAttendanceRecords ?? { list: async () => [] },
      adminAttendanceSubjects: { resolve: async () => null },
      clock: () => NOW,
      allocateId: input.allocateId ?? (() => 'allocated-id'),
    }),
  );
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function post(baseUrl: string, path: string, body: unknown) {
  const url = new URL(`${EMBEDDED_CLASSROOM_MOUNT_PATH}${path}`, baseUrl);
  const base = new URL(baseUrl);
  url.search = base.search;
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function get(baseUrl: string, path: string) {
  return fetch(new URL(`${EMBEDDED_CLASSROOM_MOUNT_PATH}${path}`, baseUrl));
}
