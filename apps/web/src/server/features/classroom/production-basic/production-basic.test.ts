import type { AddressInfo } from 'node:net';
import { createHash } from 'node:crypto';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAdminProductionBasicRouter,
  createParentProductionBasicRouter,
  createStudentProductionBasicRouter,
  type ProductionBasicLaunchFailureEvent,
} from './router.ts';
import {
  createCanonicalProductionBasicMeetingBinding,
  createProductionBasicLaunchService,
  createUnavailableProductionBasicMeetingBinding,
  type ProductionBasicActor,
  type ProductionBasicHostLiveMarker,
  type ProductionBasicLaunchArtifact,
} from './service.ts';
import type { AppConfig } from '../../../../../../../packages/config/src/index.ts';
import { ZoomApiError } from '../../../../../../../packages/domain/src/providers/zoom-rest.ts';

const servers: Array<ReturnType<express.Express['listen']>> = [];
const STUDENT: ProductionBasicActor = {
  kind: 'student',
  scope: { account_key: 'account-derived', product_key: 'product-derived' },
  learner_key: 'learner-derived',
  display_name: 'Student',
  entitled: true,
};
const PARENT: ProductionBasicActor = {
  kind: 'parent',
  scope: STUDENT.scope,
  participant_id: 'parent-participant-derived',
  household_id: 'household-derived',
  display_name: 'Parent',
  entitled: true,
};

afterEach(async () => {
  vi.restoreAllMocks();
  while (servers.length > 0) {
    const server = servers.pop();
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe('production-basic Meeting SDK launch', () => {
  it('fails closed while the recurring meeting binding is unavailable', async () => {
    const baseUrl = await start({ actor: STUDENT });
    const readiness = await fetch(`${baseUrl}/status`);
    expect(await readiness.json()).toEqual({
      success: true,
      data: { mode: 'production_basic', available: false },
    });
    const response = await post(baseUrl, '/launch');
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(await response.json()).toEqual({
      success: false,
      code: 'CLASSROOM_UNAVAILABLE',
      message: 'Classroom access is unavailable.',
    });
  });

  it('derives the Student scope server-side and returns only an ephemeral, URL-free artifact', async () => {
    const issue = vi.fn(async (input: { actor: ProductionBasicActor; role: 0 | 1 }) =>
      artifact(input.role),
    );
    const baseUrl = await start({ actor: STUDENT, issue });
    const response = await post(baseUrl, '/launch');
    expect(response.status).toBe(200);
    expect(issue).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: STUDENT,
        role: 0,
      }),
    );
    const text = await response.text();
    expect(text).not.toMatch(/https?:\/\//u);
    expect(text).not.toMatch(/"(?:join_url|joinUrl)"\s*:/u);
    expect(JSON.parse(text).data.launch_artifact).toMatchObject({
      role: 0,
      raw_join_url_present: false,
      video_start_model: 'PARTICIPANT_CONSENT',
    });

    const injected = await post(baseUrl, '/launch', {
      account_key: 'attacker',
      learner_key: 'other',
    });
    expect(injected.status).toBe(400);
    expect(issue).toHaveBeenCalledTimes(1);
  });

  it('derives the Parent learner scope server-side and issues a participant launch only while live', async () => {
    const currentForParent = vi
      .fn<ProductionBasicHostLiveMarker['currentForParent']>()
      .mockResolvedValue(true);
    const issue = vi.fn(async (input: { actor: ProductionBasicActor; role: 0 | 1 }) =>
      artifact(input.role, '/app/parent'),
    );
    const baseUrl = await start({ actor: PARENT, issue, currentForParent });

    const status = await fetch(`${baseUrl}/status`);
    await expect(status.json()).resolves.toEqual({
      success: true,
      data: { mode: 'production_basic', available: true },
    });
    const response = await post(baseUrl, '/launch');
    expect(response.status).toBe(200);
    expect(issue).toHaveBeenCalledWith(expect.objectContaining({ actor: PARENT, role: 0 }));
    expect(currentForParent).toHaveBeenCalledWith({
      scope: PARENT.scope,
      participant_id: PARENT.participant_id,
      household_id: PARENT.household_id,
      meeting_ref_digest: expect.stringMatching(/^[a-f0-9]{64}$/u),
      observed_at: new Date('2026-08-12T10:00:00.000Z'),
    });
    expect((await response.json()).data.launch_artifact).toMatchObject({
      role: 0,
      leave_path: '/app/parent',
      raw_join_url_present: false,
    });
  });

  it('confirms a bounded live marker only for an authorized host and is retry-safe', async () => {
    const admin: ProductionBasicActor = {
      kind: 'admin',
      scope: STUDENT.scope,
      actor_user_ref: 'admin-derived',
      display_name: 'Admin',
      authorized_to_start: true,
    };
    const confirm = vi.fn<ProductionBasicHostLiveMarker['confirm']>().mockResolvedValue(true);
    const baseUrl = await start({ actor: admin, issue: async () => artifact(1), confirm });

    await expect(post(baseUrl, '/host-live').then((response) => response.status)).resolves.toBe(
      200,
    );
    await expect(post(baseUrl, '/host-live').then((response) => response.status)).resolves.toBe(
      200,
    );
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(confirm).toHaveBeenNthCalledWith(1, {
      scope: STUDENT.scope,
      meeting_ref_digest: expect.stringMatching(/^[a-f0-9]{64}$/u),
      confirmed_at: new Date('2026-08-12T10:00:00.000Z'),
    });

    const studentConfirm = vi
      .fn<ProductionBasicHostLiveMarker['confirm']>()
      .mockResolvedValue(true);
    const studentBaseUrl = await start({
      actor: STUDENT,
      boundary: 'host',
      issue: async () => artifact(0),
      confirm: studentConfirm,
    });
    expect((await post(studentBaseUrl, '/host-live')).status).toBe(403);
    expect(studentConfirm).not.toHaveBeenCalled();
  });

  it('clears the exact One Time live receipt only for an authorized host and is retry-safe', async () => {
    const admin: ProductionBasicActor = {
      kind: 'admin',
      scope: STUDENT.scope,
      actor_user_ref: 'admin-derived',
      display_name: 'Admin',
      authorized_to_start: true,
    };
    const clear = vi.fn<ProductionBasicHostLiveMarker['clear']>().mockResolvedValue();
    const baseUrl = await start({ actor: admin, issue: async () => artifact(1), clear });

    const first = await post(baseUrl, '/host-ended');
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toEqual({ success: true, data: { state: 'ended' } });
    await expect(post(baseUrl, '/host-ended').then((response) => response.status)).resolves.toBe(
      200,
    );
    expect(clear).toHaveBeenCalledTimes(2);
    expect(clear).toHaveBeenNthCalledWith(1, {
      scope: STUDENT.scope,
      meeting_ref_digest: expect.stringMatching(/^[a-f0-9]{64}$/u),
      cleared_at: new Date('2026-08-12T10:00:00.000Z'),
    });

    const studentClear = vi.fn<ProductionBasicHostLiveMarker['clear']>().mockResolvedValue();
    const studentBaseUrl = await start({
      actor: STUDENT,
      boundary: 'host',
      issue: async () => artifact(0),
      clear: studentClear,
    });
    expect((await post(studentBaseUrl, '/host-ended')).status).toBe(403);
    expect(studentClear).not.toHaveBeenCalled();
  });

  it('retires the legacy app-managed host end, status, and cleanup routes', async () => {
    const admin: ProductionBasicActor = {
      kind: 'admin',
      scope: STUDENT.scope,
      actor_user_ref: 'admin-derived',
      display_name: 'Admin',
      authorized_to_start: true,
    };
    const baseUrl = await start({ actor: admin, issue: async () => artifact(1) });
    for (const path of [
      '/host-end-attempt',
      '/host-end-unknown',
      '/host-end-confirmed',
      '/host-end-status',
      '/host-end-cleanup',
    ]) {
      const response =
        path === '/host-end-status' ? await fetch(`${baseUrl}${path}`) : await post(baseUrl, path);
      expect(response.status).toBe(404);
    }
  });

  it('keeps Student readiness and launch unavailable until the host live receipt is current', async () => {
    const current = vi
      .fn<ProductionBasicHostLiveMarker['currentForStudent']>()
      .mockResolvedValue(false);
    const baseUrl = await start({ actor: STUDENT, issue: async () => artifact(0), current });

    await expect(fetch(`${baseUrl}/status`).then((response) => response.json())).resolves.toEqual({
      success: true,
      data: { mode: 'production_basic', available: false },
    });
    expect((await post(baseUrl, '/launch')).status).toBe(503);
    expect(current).toHaveBeenCalledWith({
      scope: STUDENT.scope,
      learner_key: STUDENT.learner_key,
      meeting_ref_digest: expect.stringMatching(/^[a-f0-9]{64}$/u),
      observed_at: new Date('2026-08-12T10:00:00.000Z'),
    });
  });

  it('returns governed JSON and observes only a clamped provider failure code', async () => {
    const protectedProviderDetail = 'provider-detail-with-host-and-meeting-material';
    const onLaunchFailure = vi.fn<(event: ProductionBasicLaunchFailureEvent) => void>();
    const baseUrl = await start({
      actor: STUDENT,
      onLaunchFailure,
      issue: async () => {
        throw new ZoomApiError(403, `ZOOM_${protectedProviderDetail}`, protectedProviderDetail);
      },
    });

    const response = await post(baseUrl, '/launch');
    expect(response.status).toBe(503);
    expect(response.headers.get('content-type')).toContain('application/json');
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({
      success: false,
      code: 'CLASSROOM_UNAVAILABLE',
      message: 'Classroom access is unavailable.',
    });
    expect(text).not.toContain(protectedProviderDetail);
    expect(onLaunchFailure).toHaveBeenCalledWith({
      category: 'zoom_provider',
      safe_error_code: 'ZOOM_HOST_ZAK_REQUEST_FAILED',
    });
    expect(JSON.stringify(onLaunchFailure.mock.calls)).not.toContain(protectedProviderDetail);
  });

  it.each<ProductionBasicActor>([
    { ...STUDENT, entitled: false },
    { ...PARENT, entitled: false },
    {
      kind: 'admin',
      scope: STUDENT.scope,
      actor_user_ref: 'admin-derived',
      display_name: 'Admin',
      authorized_to_start: false,
    },
  ])('denies non-entitled or non-authorized callers without binding access', async (actor) => {
    const issue = vi.fn(async () => artifact(0));
    const baseUrl = await start({ actor, issue });
    const response = await post(baseUrl, '/launch');
    expect(response.status).toBe(403);
    expect(issue).not.toHaveBeenCalled();
    const status = await fetch(`${baseUrl}/status`);
    expect(await status.json()).toEqual({
      success: true,
      data: { mode: 'production_basic', available: false },
    });
  });

  it('keeps unauthenticated and unverified requests neutrally unavailable', async () => {
    for (const input of [{ actor: null }, { actor: STUDENT, csrfVerified: false }] satisfies Array<{
      actor: ProductionBasicActor | null;
      csrfVerified?: boolean;
    }>) {
      const issue = vi.fn(async () => artifact(0));
      const baseUrl = await start({ ...input, issue });
      const status = await fetch(`${baseUrl}/status`);
      await expect(status.json()).resolves.toEqual({
        success: true,
        data: { mode: 'production_basic', available: false },
      });
      expect((await post(baseUrl, '/launch')).status).toBe(403);
      expect(issue).not.toHaveBeenCalled();
    }
  });

  it('fails a dual-session conflict before artifact, ZAK, provider, or live-marker work', async () => {
    const issue = vi.fn(async () => artifact(1));
    const confirm = vi.fn<ProductionBasicHostLiveMarker['confirm']>().mockResolvedValue(true);
    const clear = vi.fn<ProductionBasicHostLiveMarker['clear']>().mockResolvedValue();
    const baseUrl = await start({
      actor: null,
      boundary: 'host',
      identityStatus: 'session_context_conflict',
      issue,
      confirm,
      clear,
    });

    for (const path of ['/launch', '/host-live', '/host-ended']) {
      const response = await post(baseUrl, path);
      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        success: false,
        code: 'SESSION_CONTEXT_CONFLICT',
        message: 'Your session context changed. Please sign in again.',
      });
    }
    expect(issue).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });

  it('requires an injected, current read-only verification receipt even when canonical config exists', async () => {
    const binding = createCanonicalProductionBasicMeetingBinding({
      config: {
        zoomMeetingSdkCanonicalClientIdConfigured: true,
        zoomMeetingSdkCanonicalClientSecretConfigured: true,
        zoomMeetingSdkWebVersionConfigured: true,
        zoomAccountId: 'account',
        zoomServerToServerClientId: 's2s-client',
        zoomServerToServerClientSecret: 's2s-secret',
        zoomHostUserId: 'host',
        zoomRealControlMeetingId: 'recurring-meeting',
        zoomRealControlMeetingPasscode: 'passcode',
        zoomMeetingSdkAllowedOrigin: 'https://app.onetimeonetime.com',
        publicBaseUrl: 'https://join.onetimeonetime.com',
        applicationBaseUrl: 'https://app.onetimeonetime.com',
        oneTimeRuntimeEnvironment: 'production',
      } as AppConfig,
    });
    await expect(binding.ready()).resolves.toBe(false);
  });

  it('uses the injected clock to expire a verified binding receipt', async () => {
    const providerFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('status must not call Zoom'));
    let now = new Date('2026-08-12T10:00:00.000Z');
    const meetingId = 'recurring-meeting';
    const binding = createCanonicalProductionBasicMeetingBinding({
      config: {
        zoomMeetingSdkCanonicalClientIdConfigured: true,
        zoomMeetingSdkCanonicalClientSecretConfigured: true,
        zoomMeetingSdkWebVersionConfigured: true,
        zoomAccountId: 'account',
        zoomServerToServerClientId: 's2s-client',
        zoomServerToServerClientSecret: 's2s-secret',
        zoomHostUserId: 'host',
        zoomRealControlMeetingId: meetingId,
        zoomRealControlMeetingPasscode: 'passcode',
        zoomMeetingSdkAllowedOrigin: 'https://app.onetimeonetime.com',
        publicBaseUrl: 'https://join.onetimeonetime.com',
        applicationBaseUrl: 'https://app.onetimeonetime.com',
        oneTimeRuntimeEnvironment: 'production',
      } as AppConfig,
      verified_binding: {
        account_matches: true,
        host_matches: true,
        registration_required: false,
        meeting_is_recurring: true,
        timezone: 'Asia/Jerusalem',
        weekly_days: [1, 2, 3, 4, 5],
        first_occurrence_at: '2026-08-16T19:00:00+03:00',
        join_before_host: false,
        participant_video: false,
        auto_recording: 'none',
        meeting_ref_digest: createHash('sha256')
          .update(`production-basic-meeting-v1\0${meetingId}`)
          .digest('hex'),
        checked_at: '2026-08-12T09:00:00.000Z',
        expires_at: '2026-08-12T10:30:00.000Z',
      },
      clock: () => now,
    });
    await expect(binding.ready()).resolves.toBe(true);
    now = new Date('2026-08-12T10:30:00.000Z');
    await expect(binding.ready()).resolves.toBe(false);
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('binds the recurring Meeting SDK to APP_BASE_URL and rejects the public signup origin', async () => {
    const now = new Date('2026-08-12T10:00:00.000Z');
    const meetingId = 'recurring-meeting';
    const receipt = verifiedReceipt(meetingId);
    const appBound = createCanonicalProductionBasicMeetingBinding({
      config: canonicalConfig(meetingId),
      verified_binding: receipt,
      clock: () => now,
    });

    await expect(appBound.ready()).resolves.toBe(true);
    for (const rejectedOrigin of [
      'https://join.onetimeonetime.com',
      'https://evil.example.test',
      'http://app.onetimeonetime.com',
      'https://user:password@app.onetimeonetime.com',
      'https://app.onetimeonetime.com/not-an-origin',
      'https://app.onetimeonetime.com?not=an-origin',
      'https://app.onetimeonetime.com#not-an-origin',
    ]) {
      const rejected = createCanonicalProductionBasicMeetingBinding({
        config: {
          ...canonicalConfig(meetingId),
          zoomMeetingSdkAllowedOrigin: rejectedOrigin,
        },
        verified_binding: receipt,
        clock: () => now,
      });
      await expect(rejected.ready(), rejectedOrigin).resolves.toBe(false);
    }
  });

  it('rejects non-recurring, future, stale, and overly long verification receipts', async () => {
    const now = new Date('2026-08-12T10:00:00.000Z');
    const meetingId = 'recurring-meeting';
    const validReceipt = {
      account_matches: true as const,
      host_matches: true as const,
      registration_required: false as const,
      meeting_is_recurring: true as const,
      timezone: 'Asia/Jerusalem' as const,
      weekly_days: [1, 2, 3, 4, 5] as const,
      first_occurrence_at: '2026-08-16T19:00:00+03:00' as const,
      join_before_host: false as const,
      participant_video: false as const,
      auto_recording: 'none' as const,
      meeting_ref_digest: createHash('sha256')
        .update(`production-basic-meeting-v1\0${meetingId}`)
        .digest('hex'),
      checked_at: '2026-08-12T09:00:00.000Z',
      expires_at: '2026-08-12T10:30:00.000Z',
    };
    for (const receipt of [
      { ...validReceipt, meeting_is_recurring: false },
      { ...validReceipt, checked_at: '2026-08-12T10:01:00.000Z' },
      {
        ...validReceipt,
        checked_at: '2026-07-12T09:59:59.000Z',
        expires_at: '2026-08-12T10:01:00.000Z',
      },
      { ...validReceipt, expires_at: '2026-09-12T09:00:00.001Z' },
    ]) {
      const binding = createCanonicalProductionBasicMeetingBinding({
        config: canonicalConfig(meetingId),
        verified_binding: receipt as typeof validReceipt,
        clock: () => now,
      });
      await expect(binding.ready()).resolves.toBe(false);
    }

    const afterFreeAccess = createCanonicalProductionBasicMeetingBinding({
      config: {
        ...canonicalConfig(meetingId),
        oneTimeFreeAccessExpiresAt: '2026-08-12T10:15:00.000Z',
      },
      verified_binding: { ...validReceipt, expires_at: '2026-08-12T10:30:00.000Z' },
      clock: () => now,
    });
    await expect(afterFreeAccess.ready()).resolves.toBe(false);

    const unsafePolicy = createCanonicalProductionBasicMeetingBinding({
      config: canonicalConfig(meetingId),
      verified_binding: {
        ...validReceipt,
        participant_video: true,
      } as unknown as typeof validReceipt,
      clock: () => now,
    });
    await expect(unsafePolicy.ready()).resolves.toBe(false);
  });
});

function canonicalConfig(meetingId: string) {
  return {
    zoomMeetingSdkCanonicalClientIdConfigured: true,
    zoomMeetingSdkCanonicalClientSecretConfigured: true,
    zoomMeetingSdkWebVersionConfigured: true,
    zoomAccountId: 'account',
    zoomServerToServerClientId: 's2s-client',
    zoomServerToServerClientSecret: 's2s-secret',
    zoomHostUserId: 'host',
    zoomRealControlMeetingId: meetingId,
    zoomRealControlMeetingPasscode: 'passcode',
    zoomMeetingSdkAllowedOrigin: 'https://app.onetimeonetime.com',
    publicBaseUrl: 'https://join.onetimeonetime.com',
    applicationBaseUrl: 'https://app.onetimeonetime.com',
    oneTimeRuntimeEnvironment: 'production',
  } as AppConfig;
}

function verifiedReceipt(meetingId: string) {
  return {
    account_matches: true as const,
    host_matches: true as const,
    registration_required: false as const,
    meeting_is_recurring: true as const,
    timezone: 'Asia/Jerusalem' as const,
    weekly_days: [1, 2, 3, 4, 5] as const,
    first_occurrence_at: '2026-08-16T19:00:00+03:00' as const,
    join_before_host: false as const,
    participant_video: false as const,
    auto_recording: 'none' as const,
    meeting_ref_digest: createHash('sha256')
      .update(`production-basic-meeting-v1\0${meetingId}`)
      .digest('hex'),
    checked_at: '2026-08-12T09:00:00.000Z',
    expires_at: '2026-08-12T10:30:00.000Z',
  };
}

async function start(input: {
  actor: ProductionBasicActor | null;
  boundary?: 'student' | 'parent' | 'host';
  identityStatus?: 'session_context_conflict';
  csrfVerified?: boolean;
  issue?: (input: {
    actor: ProductionBasicActor;
    role: 0 | 1;
  }) => Promise<ProductionBasicLaunchArtifact>;
  confirm?: ProductionBasicHostLiveMarker['confirm'];
  clear?: ProductionBasicHostLiveMarker['clear'];
  current?: ProductionBasicHostLiveMarker['currentForStudent'];
  currentForParent?: ProductionBasicHostLiveMarker['currentForParent'];
  onLaunchFailure?: ((event: ProductionBasicLaunchFailureEvent) => void) | undefined;
}) {
  const service = createProductionBasicLaunchService({
    binding: input.issue
      ? {
          ready: async () => true,
          referenceDigest: () =>
            createHash('sha256')
              .update('production-basic-meeting-v1\0recurring-meeting')
              .digest('hex'),
          issue: async (launch) => input.issue!({ actor: launch.actor, role: launch.role }),
        }
      : createUnavailableProductionBasicMeetingBinding(),
    ...(input.issue || input.confirm || input.clear || input.current || input.currentForParent
      ? {
          hostLiveMarker: {
            confirm: input.confirm ?? (async () => true),
            clear: input.clear ?? (async () => undefined),
            currentForStudent: input.current ?? (async () => true),
            currentForParent: input.currentForParent ?? (async () => true),
          },
        }
      : {}),
    clock: () => new Date('2026-08-12T10:00:00.000Z'),
  });
  const app = express();
  app.use(
    (input.boundary === 'parent' || (!input.boundary && input.actor?.kind === 'parent')
      ? createParentProductionBasicRouter
      : input.boundary === 'host' ||
          (!input.boundary && (input.actor?.kind === 'admin' || input.actor?.kind === 'rabbi'))
        ? createAdminProductionBasicRouter
        : createStudentProductionBasicRouter)({
      service,
      onLaunchFailure: input.onLaunchFailure,
      identities: {
        resolve: async () =>
          input.identityStatus
            ? { status: input.identityStatus }
            : input.actor === null
              ? { status: 'missing' as const }
              : {
                  status: 'resolved' as const,
                  actor: input.actor,
                  csrf_verified: input.csrfVerified ?? true,
                },
      },
    }),
  );
  const server = app.listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

function artifact(
  role: 0 | 1,
  leavePath: ProductionBasicLaunchArtifact['leave_path'] = role === 0
    ? '/app/student'
    : '/app/live-console',
): ProductionBasicLaunchArtifact {
  const shared = {
    mode: 'production_basic',
    sdk_web_version: '3.13.2',
    meeting_number: '12345678901',
    meeting_password: 'short-lived-password',
    signature: 'short-lived-signature',
    user_name: role === 0 ? 'Student' : 'Admin',
    issued_at: '2026-08-12T09:59:00.000Z',
    expires_at: '2026-08-12T10:15:00.000Z',
    raw_join_url_present: false,
    video_start_model: 'PARTICIPANT_CONSENT',
  } as const;
  if (role === 1) {
    return { ...shared, role: 1, leave_path: '/app/live-console', zak: 'short-lived-zak' };
  }
  return leavePath === '/app/parent'
    ? { ...shared, role: 0, leave_path: '/app/parent' }
    : { ...shared, role: 0, leave_path: '/app/student' };
}

async function post(
  baseUrl: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { ...headers, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
