import type { AddressInfo } from 'node:net';
import { createHash } from 'node:crypto';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProductionBasicRouter } from './router.ts';
import {
  createCanonicalProductionBasicMeetingBinding,
  createProductionBasicLaunchService,
  createUnavailableProductionBasicMeetingBinding,
  type ProductionBasicActor,
  type ProductionBasicLaunchArtifact,
} from './service.ts';
import type { AppConfig } from '../../../../../../../packages/config/src/index.ts';

const servers: Array<ReturnType<express.Express['listen']>> = [];
const STUDENT: ProductionBasicActor = {
  kind: 'student',
  scope: { account_key: 'account-derived', product_key: 'product-derived' },
  learner_key: 'learner-derived',
  display_name: 'Student',
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

  it.each<ProductionBasicActor>([
    { ...STUDENT, entitled: false },
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
        publicBaseUrl: 'https://app.onetimeonetime.com',
        oneTimeRuntimeEnvironment: 'production',
      } as AppConfig,
    });
    await expect(binding.ready()).resolves.toBe(false);
  });

  it('uses the injected clock to expire a verified binding receipt', async () => {
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
        publicBaseUrl: 'https://app.onetimeonetime.com',
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
    publicBaseUrl: 'https://app.onetimeonetime.com',
    oneTimeRuntimeEnvironment: 'production',
  } as AppConfig;
}

async function start(input: {
  actor: ProductionBasicActor | null;
  csrfVerified?: boolean;
  issue?: (input: {
    actor: ProductionBasicActor;
    role: 0 | 1;
  }) => Promise<ProductionBasicLaunchArtifact>;
}) {
  const service = createProductionBasicLaunchService({
    binding: input.issue
      ? {
          ready: async () => true,
          issue: async (launch) => input.issue!({ actor: launch.actor, role: launch.role }),
        }
      : createUnavailableProductionBasicMeetingBinding(),
    clock: () => new Date('2026-08-12T10:00:00.000Z'),
  });
  const app = express();
  app.use(
    createProductionBasicRouter({
      service,
      identities: {
        resolve: async () =>
          input.actor === null
            ? null
            : { actor: input.actor, csrf_verified: input.csrfVerified ?? true },
      },
    }),
  );
  const server = app.listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

function artifact(role: 0 | 1): ProductionBasicLaunchArtifact {
  return {
    mode: 'production_basic',
    role,
    sdk_web_version: '3.13.2',
    meeting_number: '12345678901',
    meeting_password: 'short-lived-password',
    signature: 'short-lived-signature',
    user_name: role === 0 ? 'Student' : 'Admin',
    leave_path: role === 0 ? '/app/student' : '/app/live-console',
    issued_at: '2026-08-12T09:59:00.000Z',
    expires_at: '2026-08-12T10:15:00.000Z',
    ...(role === 1 ? { zak: 'short-lived-zak' } : {}),
    raw_join_url_present: false,
    video_start_model: 'PARTICIPANT_CONSENT',
  };
}

async function post(baseUrl: string, path: string, body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    ...(body === undefined
      ? {}
      : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  });
}
