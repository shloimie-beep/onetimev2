import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { V21AdultSessionRepository } from '../../../../../../packages/db/src/accounts/v21-household-identity-repository.ts';
import { sessionCookieHeader } from './http-security.ts';
import {
  authorizeV21ParentRoute,
  createV21AdultSessionRuntime,
  type V21ParentSessionContext,
} from './v21-adult-session.ts';

const now = new Date('2026-07-30T18:30:00.000Z');
const hmacSecret = 'test-v21-parent-session-hmac-secret-value';
const hostCookieName = '__Host-onetime-session';

describe('F03 v2.1 Parent host-cookie session runtime', () => {
  it('persists only independent domain-separated digests and proves same-resolver readback', async () => {
    const harness = repositoryHarness();
    const runtime = createV21AdultSessionRuntime({
      repository: harness.repository,
      hmacSecret,
      randomBytes: deterministicRandom(),
    });

    const result = await runtime.establish(establishmentInput());

    expect(result.established).toBe(true);
    if (!result.established) throw new Error('Expected a middleware-readable Parent session.');
    const accessMaterial = Buffer.alloc(32, 2).toString('base64url');
    const refreshMaterial = Buffer.alloc(32, 3).toString('base64url');
    expect(harness.create).toHaveBeenCalledWith({
      sessionId: `session_${Buffer.alloc(32, 1).toString('base64url')}`,
      adultId: 'adult_one',
      humanAccountId: 'account_one',
      householdId: 'household_one',
      runtimeTier: 'isolated_staging',
      verificationEnvironmentId: 'ci',
      securityVersion: 1,
      accessTokenDigest: domainDigest('adult-session-access-v1', accessMaterial),
      refreshTokenDigest: domainDigest('adult-session-refresh-v1', refreshMaterial),
      issuedAt: now,
    });
    const persistedInput = harness.create.mock.calls[0]![0];
    expect(persistedInput.accessTokenDigest).toMatch(/^[a-f0-9]{64}$/u);
    expect(persistedInput.refreshTokenDigest).toMatch(/^[a-f0-9]{64}$/u);
    expect(persistedInput.accessTokenDigest).not.toBe(persistedInput.refreshTokenDigest);
    expect(JSON.stringify(persistedInput)).not.toContain(accessMaterial);
    expect(JSON.stringify(persistedInput)).not.toContain(refreshMaterial);
    expect(harness.resolve).toHaveBeenCalledWith({
      sessionId: persistedInput.sessionId,
      adultId: 'adult_one',
      humanAccountId: 'account_one',
      householdId: 'household_one',
      runtimeTier: 'isolated_staging',
      verificationEnvironmentId: 'ci',
      securityVersion: 1,
      tokenKind: 'access',
      tokenDigest: persistedInput.accessTokenDigest,
      now,
    });
    expect(result).toMatchObject({
      middleware_readback_verified: true,
      expires_at: '2026-07-31T18:30:00.000Z',
    });
    expect(result.browser_session_token.length).toBeLessThanOrEqual(4096);
    expect(result.csrf_token.length).toBeGreaterThanOrEqual(32);

    const cookie = sessionCookieHeader({
      token: result.browser_session_token,
      max_age_seconds: 86_400,
    });
    expect(cookie).toContain(`${hostCookieName}=`);
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).not.toContain('Domain=');
    expect(cookie).not.toContain('otcrm_session');
  });

  it('fails before persistence when the random source repeats or is too short', async () => {
    const repeated = repositoryHarness();
    const repeatedRuntime = createV21AdultSessionRuntime({
      repository: repeated.repository,
      hmacSecret,
      randomBytes: (size) => Buffer.alloc(size, 7),
    });
    await expect(repeatedRuntime.establish(establishmentInput())).resolves.toEqual({
      established: false,
      safe_reason: 'session_creation_failed',
    });
    expect(repeated.create).not.toHaveBeenCalled();

    const short = repositoryHarness();
    const shortRuntime = createV21AdultSessionRuntime({
      repository: short.repository,
      hmacSecret,
      randomBytes: () => Buffer.alloc(16, 8),
    });
    await expect(shortRuntime.establish(establishmentInput())).resolves.toEqual({
      established: false,
      safe_reason: 'session_creation_failed',
    });
    expect(short.create).not.toHaveBeenCalled();
  });

  it('revokes the exact created session and returns no token when middleware readback fails', async () => {
    const harness = repositoryHarness();
    harness.resolve.mockResolvedValueOnce(null);
    const runtime = createV21AdultSessionRuntime({
      repository: harness.repository,
      hmacSecret,
      randomBytes: deterministicRandom(),
    });

    const result = await runtime.establish(establishmentInput());

    expect(result).toEqual({
      established: false,
      safe_reason: 'session_creation_failed',
    });
    const createInput = harness.create.mock.calls[0]![0];
    expect(harness.revoke).toHaveBeenCalledWith({
      sessionId: createInput.sessionId,
      adultId: 'adult_one',
      humanAccountId: 'account_one',
      householdId: 'household_one',
      runtimeTier: 'isolated_staging',
      verificationEnvironmentId: 'ci',
      securityVersion: 1,
      tokenKind: 'access',
      tokenDigest: createInput.accessTokenDigest,
      now,
      reason: 'explicit_revocation',
    });
    expect(result).not.toHaveProperty('browser_session_token');
    expect(result).not.toHaveProperty('csrf_token');

    const unknownOutcome = repositoryHarness();
    unknownOutcome.create.mockRejectedValueOnce(new Error('unknown create outcome'));
    const unknownRuntime = createV21AdultSessionRuntime({
      repository: unknownOutcome.repository,
      hmacSecret,
      randomBytes: deterministicRandom(),
    });
    await expect(unknownRuntime.establish(establishmentInput())).resolves.toEqual({
      established: false,
      safe_reason: 'session_creation_failed',
    });
    expect(unknownOutcome.revoke).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: `session_${Buffer.alloc(32, 1).toString('base64url')}`,
        tokenKind: 'access',
        reason: 'explicit_revocation',
      }),
    );
  });

  it('accepts only one strict signed host cookie and fails closed on authority drift', async () => {
    const harness = repositoryHarness({ accessState: 'inactive' });
    const runtime = createV21AdultSessionRuntime({
      repository: harness.repository,
      hmacSecret,
      randomBytes: deterministicRandom(),
    });
    const established = await runtime.establish(establishmentInput());
    if (!established.established) throw new Error('Expected an established session.');
    const cookie = hostCookie(established.browser_session_token);

    await expect(
      runtime.resolveCookieHeader({ cookie_header: cookie, now }),
    ).resolves.toMatchObject({
      adultId: 'adult_one',
      session: {
        activeRole: 'parent',
        activeHouseholdId: 'household_one',
      },
      household: {
        householdId: 'household_one',
        accessState: 'inactive',
      },
    });

    const callsAfterValid = harness.resolve.mock.calls.length;
    const rejectedBeforeRepository = [
      'otcrm_session=legacy-only',
      `${cookie}; ${cookie}`,
      `${hostCookieName}=${'x'.repeat(4097)}`,
      hostCookie(`${established.browser_session_token.slice(0, -1)}x`),
      hostCookie(established.browser_session_token.replace(/^v1\./u, 'v2.')),
      hostCookie(
        rewriteSignedEnvelope(established.browser_session_token, (claims) => ({
          ...claims,
          unexpected_role: 'admin',
        })),
      ),
      hostCookie(
        rewriteSignedEnvelope(established.browser_session_token, (claims) => ({
          ...claims,
          runtime_tier: 'production',
        })),
      ),
    ];
    for (const rejected of rejectedBeforeRepository) {
      await expect(
        runtime.resolveCookieHeader({ cookie_header: rejected, now }),
      ).resolves.toBeNull();
    }
    expect(harness.resolve).toHaveBeenCalledTimes(callsAfterValid);

    const wrongHousehold = rewriteSignedEnvelope(established.browser_session_token, (claims) => ({
      ...claims,
      household_id: 'sibling_household',
    }));
    await expect(
      runtime.resolveCookieHeader({
        cookie_header: hostCookie(wrongHousehold),
        now,
      }),
    ).resolves.toBeNull();
    const staleSecurity = rewriteSignedEnvelope(established.browser_session_token, (claims) => ({
      ...claims,
      security_version: 2,
    }));
    await expect(
      runtime.resolveCookieHeader({
        cookie_header: hostCookie(staleSecurity),
        now,
      }),
    ).resolves.toBeNull();
  });

  it('rejects null, revoked, expired, and mismatched repository readback', async () => {
    const harness = repositoryHarness();
    const runtime = createV21AdultSessionRuntime({
      repository: harness.repository,
      hmacSecret,
      randomBytes: deterministicRandom(),
    });
    const established = await runtime.establish(establishmentInput());
    if (!established.established) throw new Error('Expected an established session.');
    const createInput = harness.lastCreate();
    const cookie = hostCookie(established.browser_session_token);
    const cases: Array<V21ParentSessionContext | null> = [
      null,
      sessionResult(createInput, {
        session: { revokedAt: '2026-07-30T18:31:00.000Z' },
      }),
      sessionResult(createInput, {
        session: { idleExpiresAt: now.toISOString() },
      }),
      sessionResult(createInput, {
        session: { securityVersion: 2 },
      }),
      sessionResult(createInput, {
        household: { householdId: 'sibling_household' },
      }),
    ];
    for (const readback of cases) {
      harness.resolve.mockResolvedValueOnce(readback);
      await expect(runtime.resolveCookieHeader({ cookie_header: cookie, now })).resolves.toBeNull();
    }
  });

  it('binds CSRF proof to the exact signed session and verifies it timing-safely', async () => {
    const harness = repositoryHarness();
    const runtime = createV21AdultSessionRuntime({
      repository: harness.repository,
      hmacSecret,
      randomBytes: deterministicRandom(),
    });
    const first = await runtime.establish(establishmentInput());
    const second = await runtime.establish({
      ...establishmentInput(),
      household_id: 'household_two',
    });
    if (!first.established || !second.established) {
      throw new Error('Expected two established sessions.');
    }

    await expect(
      runtime.verifyCsrf({
        cookie_header: hostCookie(second.browser_session_token),
        csrf_token: second.csrf_token,
        now,
      }),
    ).resolves.toMatchObject({
      session: { activeHouseholdId: 'household_two' },
    });
    const callsAfterValid = harness.resolve.mock.calls.length;
    await expect(
      runtime.verifyCsrf({
        cookie_header: hostCookie(second.browser_session_token),
        csrf_token: first.csrf_token,
        now,
      }),
    ).resolves.toBeNull();
    await expect(
      runtime.verifyCsrf({
        cookie_header: hostCookie(second.browser_session_token),
        csrf_token: `${second.csrf_token.slice(0, -1)}x`,
        now,
      }),
    ).resolves.toBeNull();
    expect(harness.resolve).toHaveBeenCalledTimes(callsAfterValid);
  });

  it('enforces the exact segment-safe inactive-Parent route allowlist', () => {
    const context = sessionResult(
      {
        ...repositoryCreateInput(),
        sessionId: 'session_inactive',
      },
      { accessState: 'inactive' },
    );
    const allowed = [
      '/app/parent',
      '/app/parent/billing',
      '/app/parent/support',
      '/app/parent/support/ticket_123',
      '/app/parent/account',
      '/app/parent/privacy',
      '/app/parent/data-rights',
      '/select-household',
      '/app/parent/billing?return_to=%2Fapp%2Fparent',
    ];
    for (const requested_path of allowed) {
      expect(authorizeV21ParentRoute({ context, requested_path })).toEqual({
        allowed: true,
      });
    }

    const denied = [
      '/app/parent/students',
      '/app/parent/calendar',
      '/app/parent/classes/class_1',
      '/app/parent/progress',
      '/app/parent/updates',
      '/app/parent/newsletter',
      '/app/parent/preferences',
      '/app/student',
      '/app/parent/billing-evil',
      '/app/parent/support/ticket_1/private',
      '/app/parent/support/%2e%2e/students',
      '/app/parent/support/ticket%2Fprivate',
      '/app/parent/support/ticket%5Cprivate',
      '/app/parent/support/ticket%00private',
      '/app/parent/support/ticket%252Fprivate',
      '/app/parent/support/%ZZ',
      '/app/parent/support/ticket\\private',
      '//evil.example/app/parent',
      'https://evil.example/app/parent',
    ];
    for (const requested_path of denied) {
      expect(authorizeV21ParentRoute({ context, requested_path })).toEqual({
        allowed: false,
        reason: 'inactive_household',
      });
    }

    const active = {
      ...context,
      household: { ...context.household, accessState: 'active' as const },
    };
    expect(
      authorizeV21ParentRoute({
        context: active,
        requested_path: '/app/parent/students',
      }),
    ).toEqual({ allowed: true });
  });
});

function establishmentInput() {
  return {
    scope: {
      product: 'one_time_mishnayos' as const,
      runtime_tier: 'isolated_staging' as const,
      verification_environment_id: 'ci' as const,
    },
    adult_id: 'adult_one',
    human_account_id: 'account_one',
    household_id: 'household_one',
    active_role: 'parent' as const,
    security_version: 1,
    now,
  };
}

function repositoryHarness(input: { accessState?: 'free' | 'inactive' } = {}) {
  let createInput: Parameters<V21AdultSessionRepository['create']>[0] | undefined;
  const create = vi.fn(async (value: Parameters<V21AdultSessionRepository['create']>[0]) => {
    createInput = value;
    return sessionResult(value, { accessState: input.accessState ?? 'free' });
  });
  const resolve = vi.fn(async () =>
    createInput ? sessionResult(createInput, { accessState: input.accessState ?? 'free' }) : null,
  );
  const revoke = vi.fn(async () => true);
  const repository = { create, resolve, revoke } satisfies V21AdultSessionRepository;
  return {
    repository,
    create,
    resolve,
    revoke,
    lastCreate: () => {
      if (!createInput) throw new Error('No Parent session was created.');
      return createInput;
    },
  };
}

function repositoryCreateInput(): Parameters<V21AdultSessionRepository['create']>[0] {
  return {
    sessionId: 'session_one',
    adultId: 'adult_one',
    humanAccountId: 'account_one',
    householdId: 'household_one',
    runtimeTier: 'isolated_staging',
    verificationEnvironmentId: 'ci',
    securityVersion: 1,
    accessTokenDigest: 'a'.repeat(64),
    refreshTokenDigest: 'b'.repeat(64),
    issuedAt: now,
  };
}

function sessionResult(
  input: Parameters<V21AdultSessionRepository['create']>[0],
  overrides: {
    accessState?: 'free' | 'active' | 'grace' | 'inactive';
    session?: Partial<V21ParentSessionContext['session']>;
    household?: Partial<V21ParentSessionContext['household']>;
  } = {},
): V21ParentSessionContext {
  const issuedAt = input.issuedAt.toISOString();
  return {
    adultId: input.adultId,
    normalizedEmail: 'owner@example.test',
    ownerDisplayName: 'Owner One',
    session: {
      sessionId: input.sessionId,
      humanAccountId: input.humanAccountId,
      activeRole: 'parent',
      activeHouseholdId: input.householdId,
      securityVersion: input.securityVersion,
      idleExpiresAt: new Date(input.issuedAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      absoluteExpiresAt: new Date(
        input.issuedAt.getTime() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      revokedAt: null,
      revocationReason: null,
      product: 'one_time_mishnayos',
      runtimeTier: input.runtimeTier,
      verificationEnvironmentId: input.verificationEnvironmentId,
      version: 1,
      createdAt: issuedAt,
      updatedAt: issuedAt,
      ...overrides.session,
    },
    household: {
      householdId: input.householdId,
      displayName: 'Owner One household',
      classification: 'family',
      accessState: overrides.accessState ?? 'free',
      ownerRelationship: 'account_owner',
      ...overrides.household,
    },
  };
}

function deterministicRandom() {
  let call = 0;
  return (size: number) => {
    call += 1;
    return Buffer.alloc(size, call);
  };
}

function hostCookie(token: string) {
  return `${hostCookieName}=${encodeURIComponent(token)}`;
}

function rewriteSignedEnvelope(
  token: string,
  rewrite: (claims: Record<string, unknown>) => Record<string, unknown>,
): string {
  const [, payload] = token.split('.');
  if (!payload) throw new Error('Malformed test browser token.');
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >;
  const rewrittenPayload = Buffer.from(JSON.stringify(rewrite(claims)), 'utf8').toString(
    'base64url',
  );
  const unsigned = `v1.${rewrittenPayload}`;
  const signature = createHmac('sha256', hmacSecret)
    .update('one-time-v21-parent-session-envelope-v1', 'utf8')
    .update('\0', 'utf8')
    .update(unsigned, 'utf8')
    .digest('base64url');
  return `${unsigned}.${signature}`;
}

function domainDigest(domain: string, raw: string) {
  return createHash('sha256').update(`${domain}\0${raw}`, 'utf8').digest('hex');
}
