import { createHash, createHmac } from 'node:crypto';
import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import type { JobScope } from '../../../../../../../packages/contracts/src/jobs/index.ts';
import type { PortalActorContext } from '../../../../../../../packages/contracts/src/portals/index.ts';
import {
  createEmbeddedClassroomRequestIdentityResolver,
  createUnavailableAdminAttendanceSubjectResolver,
  createUnavailableEmbeddedJoinContextResolver,
  createUnavailableMeetingSdkBootstrapPort,
  createUnavailableProviderAttendanceResolver,
  digestEmbeddedAttendanceEvidence,
  hashEmbeddedExchangeSecret,
} from './adapters.ts';

const SCOPE = {
  product: 'one_time_mishnayos',
  runtime_tier: 'isolated_staging',
  verification_environment_id: 'ci',
} satisfies JobScope;
const PUBLIC_ORIGIN = 'https://join.onetimeonetime.com';
const LINEAGE_SECRET = 'p18-test-lineage-secret';

describe('P18 embedded-classroom adapters', () => {
  it('derives Student identity, scope, and device lineage only from the authenticated request', async () => {
    const resolvePortalActor = vi.fn(async () => studentPortalActor());
    const verifyCsrf = vi.fn(async () => true);
    const resolver = createEmbeddedClassroomRequestIdentityResolver({
      scope: SCOPE,
      publicOrigin: PUBLIC_ORIGIN,
      lineageSecret: LINEAGE_SECRET,
      resolvePortalActor,
      verifyCsrf,
    });
    const firstRequest = requestFixture({
      origin: PUBLIC_ORIGIN,
      'user-agent': 'P18 browser A',
    });

    const first = await resolver.resolveStudent(firstRequest);
    const replay = await resolver.resolveStudent(firstRequest);
    const otherUserAgent = await resolver.resolveStudent(
      requestFixture({ origin: PUBLIC_ORIGIN, 'user-agent': 'P18 browser B' }),
    );

    expect(first).toEqual({
      scope: SCOPE,
      actor: {
        role: 'student',
        student_id: 'student-canonical',
        household_id: 'household-canonical',
        authenticated_session_id: 'session-canonical',
        device_lineage_id: createHmac('sha256', LINEAGE_SECRET)
          .update('p18-device-lineage-v1\0')
          .update('session-canonical')
          .update('\0')
          .update('P18 browser A')
          .digest('hex'),
        csrf_verified: true,
      },
    });
    expect(replay?.actor.device_lineage_id).toBe(first?.actor.device_lineage_id);
    expect(otherUserAgent?.actor.device_lineage_id).not.toBe(first?.actor.device_lineage_id);
    expect(resolvePortalActor).toHaveBeenCalledWith(firstRequest);
    expect(verifyCsrf).toHaveBeenCalledWith(firstRequest, studentPortalActor());
    expect(JSON.stringify(first)).not.toContain('student-from-body');
  });

  it('requires an explicit exact Origin and current CSRF proof for Student and Admin mutations', async () => {
    const verifyCsrf = vi.fn(async () => true);
    const studentResolver = createEmbeddedClassroomRequestIdentityResolver({
      scope: SCOPE,
      publicOrigin: PUBLIC_ORIGIN,
      lineageSecret: LINEAGE_SECRET,
      resolvePortalActor: async () => studentPortalActor(),
      verifyCsrf,
    });

    expect(
      (await studentResolver.resolveStudent(requestFixture({ 'user-agent': 'agent' })))?.actor
        .csrf_verified,
    ).toBe(false);
    expect(
      (
        await studentResolver.resolveStudent(
          requestFixture({ origin: 'https://attacker.invalid', 'user-agent': 'agent' }),
        )
      )?.actor.csrf_verified,
    ).toBe(false);
    expect(verifyCsrf).not.toHaveBeenCalled();

    const csrfRejected = createEmbeddedClassroomRequestIdentityResolver({
      scope: SCOPE,
      publicOrigin: PUBLIC_ORIGIN,
      lineageSecret: LINEAGE_SECRET,
      resolvePortalActor: async () => studentPortalActor(),
      verifyCsrf: async () => false,
    });
    expect(
      (
        await csrfRejected.resolveStudent(
          requestFixture({ origin: PUBLIC_ORIGIN, 'user-agent': 'agent' }),
        )
      )?.actor.csrf_verified,
    ).toBe(false);

    const adminResolver = createEmbeddedClassroomRequestIdentityResolver({
      scope: SCOPE,
      publicOrigin: PUBLIC_ORIGIN,
      lineageSecret: LINEAGE_SECRET,
      resolvePortalActor: async () => adminPortalActor(),
      verifyCsrf: async () => true,
    });
    await expect(
      adminResolver.resolveAdmin(requestFixture({ origin: 'https://attacker.invalid' })),
    ).resolves.toBeNull();
    await expect(
      adminResolver.resolveAdmin(requestFixture({ origin: PUBLIC_ORIGIN })),
    ).resolves.toEqual({ scope: SCOPE, admin_id: 'admin-canonical' });
  });

  it('domain-separates raw exchange material and canonicalizes attendance evidence', () => {
    const secret = '0123456789abcdefghijklmnopqrstuvwxyz-EXCHANGE';
    const expected = createHash('sha256')
      .update('p18-bootstrap-exchange-v1\0')
      .update(secret)
      .digest('hex');

    expect(hashEmbeddedExchangeSecret(secret)).toBe(expected);
    expect(hashEmbeddedExchangeSecret(secret)).toMatch(/^[a-f0-9]{64}$/u);
    expect(hashEmbeddedExchangeSecret(secret)).not.toContain(secret);
    expect(digestEmbeddedAttendanceEvidence({ b: 2, a: 1 })).toBe(
      digestEmbeddedAttendanceEvidence({ a: 1, b: 2 }),
    );
    expect(digestEmbeddedAttendanceEvidence({ a: 1, b: 2 })).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('keeps every candidate-bound adapter fail closed when no trusted binding exists', async () => {
    const context = createUnavailableEmbeddedJoinContextResolver();
    await expect(context.resolveForIssue({} as never)).rejects.toMatchObject({
      code: 'bootstrap_unavailable',
    });
    await expect(context.resolve({} as never)).rejects.toMatchObject({
      code: 'bootstrap_unavailable',
    });
    await expect(context.resolveLiveSession({} as never)).rejects.toMatchObject({
      code: 'bootstrap_unavailable',
    });
    await expect(
      createUnavailableMeetingSdkBootstrapPort().createEphemeralBootstrap({} as never),
    ).rejects.toMatchObject({ code: 'bootstrap_unavailable' });
    await expect(
      createUnavailableProviderAttendanceResolver().verify(requestFixture({})),
    ).resolves.toBeNull();
    await expect(
      createUnavailableAdminAttendanceSubjectResolver().resolve({} as never),
    ).resolves.toBeNull();
  });
});

function requestFixture(headers: Record<string, string>): Request {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {
    body: {
      student_id: 'student-from-body',
      household_id: 'household-from-body',
      verification_environment_id: 'production_broad',
    },
    header(name: string) {
      return normalized[name.toLowerCase()];
    },
  } as Request;
}

function studentPortalActor(): PortalActorContext {
  return {
    account_key: 'account-canonical',
    product_key: 'one_time_mishnayos',
    actor_user_ref: 'student-login-canonical',
    actor_role: 'student',
    session_key: 'session-canonical',
    capabilities: ['student:class:launch'],
    authorized_households: [],
    student_learner: {
      learner_key: 'student-canonical',
      household_key: 'household-canonical',
      access_state_key: 'access-canonical',
    },
  };
}

function adminPortalActor(): PortalActorContext {
  return {
    account_key: 'account-canonical',
    product_key: 'one_time_mishnayos',
    actor_user_ref: 'admin-canonical',
    actor_role: 'admin',
    session_key: 'admin-session-canonical',
    capabilities: [],
    authorized_households: [],
    student_learner: null,
  };
}
