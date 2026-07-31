import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { AUTH_SESSION_COOKIE } from '../../../../../../packages/contracts/src/identity/auth/index.ts';
import {
  ONE_TIME_PRODUCT_SCOPE,
  VERIFICATION_RUNTIME_TIER,
  type RuntimeTier,
  type VerificationEnvironmentId,
} from '../../../../../../packages/contracts/src/state/index.ts';
import {
  createPostgresV21AdultSessionRepository,
  type V21AdultSessionRepository,
} from '../../../../../../packages/db/src/accounts/v21-household-identity-repository.ts';
import { verifyAuthPasswordWithUpgrade } from '../../../../../../packages/domain/src/auth/policy.ts';
import { normalizeAdultEmail } from '../../../../../../packages/domain/src/accounts/v21-household-identity.ts';

const BROWSER_TOKEN_VERSION = 'v1';
const BROWSER_TOKEN_DOMAIN = 'one-time-v21-parent-session-envelope-v1';
const ACCESS_TOKEN_DOMAIN = 'adult-session-access-v1';
const REFRESH_TOKEN_DOMAIN = 'adult-session-refresh-v1';
const CSRF_TOKEN_VERSION = 'c1';
const CSRF_TOKEN_DOMAIN = 'one-time-v21-parent-session-csrf-v1';
const RANDOM_MATERIAL_BYTES = 32;
const MAX_BROWSER_TOKEN_LENGTH = 4096;
const BASE64URL_MATERIAL = /^[A-Za-z0-9_-]{43,128}$/u;
const BASE64URL_SIGNATURE = /^[A-Za-z0-9_-]{43}$/u;

const runtimeTierSchema = z.enum(['isolated_staging', 'production']);
const verificationEnvironmentSchema = z.enum([
  'ci',
  'provider_sandbox',
  'persistent_staging',
  'production_read_only',
  'production_operator_canary',
  'production_broad',
]);
const exactIdentifierSchema = z
  .string()
  .min(1)
  .max(256)
  .refine((value) => value === value.trim());

const browserEnvelopeSchema = z
  .object({
    session_id: exactIdentifierSchema,
    adult_id: exactIdentifierSchema,
    human_account_id: exactIdentifierSchema,
    household_id: exactIdentifierSchema,
    runtime_tier: runtimeTierSchema,
    verification_environment_id: verificationEnvironmentSchema,
    security_version: z.number().int().positive().safe(),
    access_material: z.string().regex(BASE64URL_MATERIAL),
    refresh_material: z.string().regex(BASE64URL_MATERIAL),
  })
  .strict()
  .superRefine((value, context) => {
    if (VERIFICATION_RUNTIME_TIER[value.verification_environment_id] !== value.runtime_tier) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'The session runtime tier and verification environment must match.',
      });
    }
    if (value.access_material === value.refresh_material) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Access and refresh material must be independent.',
      });
    }
  });

type BrowserEnvelope = z.infer<typeof browserEnvelopeSchema>;
type ParsedBrowserEnvelope = {
  claims: BrowserEnvelope;
  payloadSegment: string;
};

export type V21ParentSessionContext = Exclude<
  Awaited<ReturnType<V21AdultSessionRepository['resolve']>>,
  null
>;

export type V21ParentSessionEstablishment =
  | {
      established: true;
      browser_session_token: string;
      csrf_token: string;
      expires_at: string;
      middleware_readback_verified: true;
    }
  | {
      established: false;
      safe_reason: 'integration_unavailable' | 'session_creation_failed';
    };

export type V21ParentSessionEstablishmentInput = {
  scope: {
    product: typeof ONE_TIME_PRODUCT_SCOPE;
    runtime_tier: RuntimeTier;
    verification_environment_id: VerificationEnvironmentId;
  };
  adult_id: string;
  human_account_id: string;
  household_id: string;
  active_role: 'parent';
  security_version: number;
  now: Date;
};

export type V21ParentRouteAuthorization =
  { allowed: true } | { allowed: false; reason: 'inactive_household' };

export type V21AdultLoginOutcome =
  | { handled: false }
  | {
      handled: true;
      authenticated: false;
      failure: 'invalid_credentials' | 'unavailable' | 'recovery_required';
      session_mutated?: true;
    }
  | {
      handled: true;
      authenticated: true;
      browser_session_token: string;
      csrf_token: string;
      expires_at: string;
      user: {
        adult_id: string;
        human_account_id: string;
        email: string;
        display_name: string;
      };
      household: V21ParentSessionContext['household'];
    };

export type V21SessionRevocationOutcome =
  | { revoked: true }
  | {
      revoked: false;
      reason: 'invalid_session' | 'invalid_csrf' | 'revocation_unverified';
    };

export type V21SessionResolutionOutcome =
  | { status: 'resolved'; context: V21ParentSessionContext }
  | { status: 'invalid' }
  | { status: 'unavailable' };

export type V21SessionBootstrapOutcome =
  | {
      status: 'resolved';
      context: V21ParentSessionContext;
      csrf_token: string;
      expires_at: string;
    }
  | { status: 'invalid' }
  | { status: 'unavailable' };

export interface V21AdultSessionRuntime {
  establish(input: V21ParentSessionEstablishmentInput): Promise<V21ParentSessionEstablishment>;
  recognizedLoginEmail(input: {
    scope: V21ParentSessionEstablishmentInput['scope'];
    email: string;
  }): Promise<
    | { status: 'recognized'; normalized_email: string }
    | { status: 'absent' }
    | { status: 'unavailable' }
  >;
  login(input: {
    scope: V21ParentSessionEstablishmentInput['scope'];
    email: string;
    password: string;
    cookie_header?: string | null | undefined;
    now?: Date | undefined;
  }): Promise<V21AdultLoginOutcome>;
  bootstrapCookieHeader(input: {
    cookie_header?: string | null | undefined;
    now?: Date | undefined;
  }): Promise<V21SessionBootstrapOutcome>;
  logoutCookieHeader(input: {
    cookie_header?: string | null | undefined;
    csrf_token?: string | null | undefined;
    now?: Date | undefined;
  }): Promise<V21SessionRevocationOutcome>;
  rotateCookieHeader(input: {
    cookie_header?: string | null | undefined;
    now?: Date | undefined;
  }): Promise<V21SessionRevocationOutcome>;
  resolveCookieHeader(input: {
    cookie_header?: string | null | undefined;
    now?: Date | undefined;
  }): Promise<V21SessionResolutionOutcome>;
  verifyCsrf(input: {
    cookie_header?: string | null | undefined;
    csrf_token?: string | null | undefined;
    now?: Date | undefined;
  }): Promise<V21ParentSessionContext | null>;
}

export type V21AdultSessionRuntimeInput = {
  repository: V21AdultSessionRepository;
  hmacSecret: string;
  randomBytes?: ((size: number) => Uint8Array) | undefined;
  clock?: (() => Date) | undefined;
};

export function createV21AdultSessionRuntime(
  input: V21AdultSessionRuntimeInput,
): V21AdultSessionRuntime {
  if (Buffer.byteLength(input.hmacSecret, 'utf8') < 32) {
    throw new Error('The v2.1 Parent-session HMAC secret must contain at least 32 bytes.');
  }
  const randomSource = input.randomBytes ?? randomBytes;
  const clock = input.clock ?? (() => new Date());

  const parseCookie = (cookieHeader: string | null | undefined) =>
    parseBrowserCookie(cookieHeader, input.hmacSecret);

  const resolveEnvelope = async (
    parsed: ParsedBrowserEnvelope,
    now: Date,
  ): Promise<V21SessionResolutionOutcome> => {
    if (!validInstant(now)) return { status: 'invalid' };
    try {
      const resolved = await input.repository.resolve({
        ...repositoryBinding(parsed.claims),
        tokenKind: 'access',
        tokenDigest: domainDigest(ACCESS_TOKEN_DOMAIN, parsed.claims.access_material),
        now,
      });
      return resolved && exactReadback(resolved, parsed.claims, now)
        ? { status: 'resolved', context: resolved }
        : { status: 'invalid' };
    } catch {
      return { status: 'unavailable' };
    }
  };

  const establish = async (
    establishmentInput: V21ParentSessionEstablishmentInput,
  ): Promise<V21ParentSessionEstablishment> => {
    let createAttempted = false;
    let claims: BrowserEnvelope | null = null;
    try {
      assertEstablishmentInput(establishmentInput);
      const material = [
        randomMaterial(randomSource),
        randomMaterial(randomSource),
        randomMaterial(randomSource),
        randomMaterial(randomSource),
      ];
      if (new Set(material).size !== material.length) {
        throw new Error('Parent-session random material must be independent.');
      }
      claims = browserEnvelopeSchema.parse({
        session_id: `session_${material[0]}`,
        adult_id: establishmentInput.adult_id,
        human_account_id: establishmentInput.human_account_id,
        household_id: establishmentInput.household_id,
        runtime_tier: establishmentInput.scope.runtime_tier,
        verification_environment_id: establishmentInput.scope.verification_environment_id,
        security_version: establishmentInput.security_version,
        access_material: material[1],
        refresh_material: material[2],
      });
      createAttempted = true;
      const createdSession = await input.repository.create({
        ...repositoryBinding(claims),
        accessTokenDigest: domainDigest(ACCESS_TOKEN_DOMAIN, claims.access_material),
        refreshTokenDigest: domainDigest(REFRESH_TOKEN_DOMAIN, claims.refresh_material),
        issuedAt: establishmentInput.now,
      });
      if (!exactReadback(createdSession, claims, establishmentInput.now)) {
        throw new Error('Created Parent session did not match its exact binding.');
      }

      const signedBrowserToken = signBrowserEnvelope(claims, input.hmacSecret);
      const parsedReadback = parseCookie(
        `${AUTH_SESSION_COOKIE.name}=${encodeURIComponent(signedBrowserToken)}`,
      );
      if (!parsedReadback) {
        throw new Error('Issued Parent session was not readable through the host-cookie parser.');
      }
      const middlewareReadback = await resolveEnvelope(parsedReadback, establishmentInput.now);
      if (middlewareReadback.status !== 'resolved') {
        throw new Error('Issued Parent session failed middleware repository readback.');
      }
      const expiresAt = currentExpiry(middlewareReadback.context);
      if (Date.parse(expiresAt) <= establishmentInput.now.getTime()) {
        throw new Error('Issued Parent session is already expired.');
      }
      return {
        established: true,
        browser_session_token: signedBrowserToken,
        csrf_token: signCsrf(parsedReadback.payloadSegment, material[3]!, input.hmacSecret),
        expires_at: expiresAt,
        middleware_readback_verified: true,
      };
    } catch {
      if (createAttempted && claims) {
        await bestEffortRevoke(input.repository, claims, establishmentInput.now);
      }
      return {
        established: false,
        safe_reason: 'session_creation_failed',
      };
    }
  };

  const exactRevoke = async (
    parsed: ParsedBrowserEnvelope,
    now: Date,
    reason: 'adult_logout' | 'session_rotation' | 'explicit_revocation',
  ): Promise<'revoked' | 'invalid' | 'unavailable' | 'revocation_unverified'> => {
    const resolution = await resolveEnvelope(parsed, now);
    if (resolution.status !== 'resolved') return resolution.status;
    try {
      const revoked = await input.repository.revoke({
        ...repositoryBinding(parsed.claims),
        tokenKind: 'access',
        tokenDigest: domainDigest(ACCESS_TOKEN_DOMAIN, parsed.claims.access_material),
        now,
        reason,
      });
      if (!revoked) return 'revocation_unverified';
      const readback = await input.repository.resolve({
        ...repositoryBinding(parsed.claims),
        tokenKind: 'access',
        tokenDigest: domainDigest(ACCESS_TOKEN_DOMAIN, parsed.claims.access_material),
        now,
      });
      return readback === null ? 'revoked' : 'revocation_unverified';
    } catch {
      return 'unavailable';
    }
  };

  return {
    establish,

    recognizedLoginEmail: async ({ scope, email }) => {
      const normalizedEmail = canonicalAdultEmail(email);
      if (!normalizedEmail) return { status: 'absent' };
      try {
        const identity = await input.repository.findLoginIdentity({
          normalizedEmail,
          runtimeTier: scope.runtime_tier,
          verificationEnvironmentId: scope.verification_environment_id,
        });
        return identity
          ? { status: 'recognized', normalized_email: normalizedEmail }
          : { status: 'absent' };
      } catch {
        return { status: 'unavailable' };
      }
    },

    login: async ({
      scope,
      email,
      password,
      cookie_header: cookieHeader,
      now = clock(),
    }): Promise<V21AdultLoginOutcome> => {
      const normalizedEmail = canonicalAdultEmail(email);
      if (!normalizedEmail) return { handled: false };
      let establishedBrowserToken: string | null = null;
      let sessionMutated = false;
      try {
        const identity = await input.repository.findLoginIdentity({
          normalizedEmail,
          runtimeTier: scope.runtime_tier,
          verificationEnvironmentId: scope.verification_environment_id,
        });
        const proof = verifyAuthPasswordWithUpgrade(password, identity?.passwordHash ?? '');
        if (!identity) return { handled: false };
        if (
          !proof.valid ||
          identity.adultState !== 'active' ||
          identity.humanAccountId === null ||
          identity.accountState !== 'active' ||
          identity.securityVersion === null ||
          !identity.parentMembershipActive ||
          identity.credentialState !== 'active' ||
          identity.credentialVersion === null ||
          identity.passwordHash === null ||
          identity.activeOwnedHouseholdCount !== 1 ||
          identity.ownedHouseholds.length !== 1
        ) {
          return {
            handled: true,
            authenticated: false,
            failure: 'invalid_credentials',
          };
        }
        const humanAccountId = identity.humanAccountId;
        const securityVersion = identity.securityVersion;
        const credentialVersion = identity.credentialVersion;
        const passwordHash = identity.passwordHash;
        if (cookieHeader) {
          const current = parseCookie(cookieHeader);
          if (!current) {
            return {
              handled: true,
              authenticated: false,
              failure: 'unavailable',
            };
          }
          const rotation = await exactRevoke(current, now, 'session_rotation');
          if (rotation !== 'revoked') {
            return {
              handled: true,
              authenticated: false,
              failure: rotation === 'revocation_unverified' ? 'recovery_required' : 'unavailable',
            };
          }
          sessionMutated = true;
        }
        const household = identity.ownedHouseholds[0]!;
        const established = await establish({
          scope,
          adult_id: identity.adultId,
          human_account_id: humanAccountId,
          household_id: household.householdId,
          active_role: 'parent',
          security_version: securityVersion,
          now,
        });
        if (!established.established) {
          return {
            handled: true,
            authenticated: false,
            failure: 'unavailable',
            ...(sessionMutated ? { session_mutated: true as const } : {}),
          };
        }
        establishedBrowserToken = established.browser_session_token;
        if (proof.replacement_hash) {
          let credentialUpgradeVerified = await input.repository.upgradeCredentialPasswordHash({
            humanAccountId,
            adultId: identity.adultId,
            runtimeTier: scope.runtime_tier,
            verificationEnvironmentId: scope.verification_environment_id,
            expectedCredentialVersion: credentialVersion,
            expectedPasswordHash: passwordHash,
            replacementPasswordHash: proof.replacement_hash,
            now,
          });
          if (!credentialUpgradeVerified) {
            const currentIdentity = await input.repository.findLoginIdentity({
              normalizedEmail,
              runtimeTier: scope.runtime_tier,
              verificationEnvironmentId: scope.verification_environment_id,
            });
            const currentProof = verifyAuthPasswordWithUpgrade(
              password,
              currentIdentity?.passwordHash ?? '',
            );
            credentialUpgradeVerified = Boolean(
              currentIdentity &&
              currentIdentity.adultId === identity.adultId &&
              currentIdentity.normalizedEmail === identity.normalizedEmail &&
              currentIdentity.adultState === 'active' &&
              currentIdentity.humanAccountId === humanAccountId &&
              currentIdentity.accountState === 'active' &&
              currentIdentity.securityVersion === securityVersion &&
              currentIdentity.parentMembershipActive &&
              currentIdentity.credentialState === 'active' &&
              currentIdentity.credentialVersion !== null &&
              currentIdentity.credentialVersion > credentialVersion &&
              currentIdentity.passwordHash !== null &&
              currentIdentity.passwordHash !== passwordHash &&
              currentIdentity.activeOwnedHouseholdCount === 1 &&
              currentIdentity.ownedHouseholds.length === 1 &&
              currentIdentity.ownedHouseholds[0]?.householdId === household.householdId &&
              currentProof.valid &&
              currentProof.replacement_hash === null,
            );
          }
          if (!credentialUpgradeVerified) {
            const establishedCookie = parseCookie(
              `${AUTH_SESSION_COOKIE.name}=${encodeURIComponent(establishedBrowserToken)}`,
            );
            const cleanup = establishedCookie
              ? await exactRevoke(establishedCookie, now, 'explicit_revocation')
              : 'revocation_unverified';
            return {
              handled: true,
              authenticated: false,
              failure: cleanup === 'revoked' ? 'unavailable' : 'recovery_required',
              ...(sessionMutated ? { session_mutated: true as const } : {}),
            };
          }
        }
        return {
          handled: true,
          authenticated: true,
          browser_session_token: established.browser_session_token,
          csrf_token: established.csrf_token,
          expires_at: established.expires_at,
          user: {
            adult_id: identity.adultId,
            human_account_id: humanAccountId,
            email: identity.normalizedEmail,
            display_name: identity.ownerDisplayName,
          },
          household,
        };
      } catch {
        let cleanup: 'revoked' | 'invalid' | 'unavailable' | 'revocation_unverified' | null = null;
        if (establishedBrowserToken) {
          const establishedCookie = parseCookie(
            `${AUTH_SESSION_COOKIE.name}=${encodeURIComponent(establishedBrowserToken)}`,
          );
          cleanup = establishedCookie
            ? await exactRevoke(establishedCookie, now, 'explicit_revocation')
            : 'revocation_unverified';
        }
        return {
          handled: true,
          authenticated: false,
          failure: cleanup === null || cleanup === 'revoked' ? 'unavailable' : 'recovery_required',
          ...(sessionMutated ? { session_mutated: true as const } : {}),
        };
      }
    },

    bootstrapCookieHeader: async ({ cookie_header: cookieHeader, now = clock() }) => {
      const parsed = parseCookie(cookieHeader);
      if (!parsed) return { status: 'invalid' };
      const resolution = await resolveEnvelope(parsed, now);
      if (resolution.status !== 'resolved') return resolution;
      return {
        status: 'resolved',
        context: resolution.context,
        csrf_token: signCsrf(parsed.payloadSegment, randomMaterial(randomSource), input.hmacSecret),
        expires_at: currentExpiry(resolution.context),
      };
    },

    logoutCookieHeader: async ({
      cookie_header: cookieHeader,
      csrf_token: csrfToken,
      now = clock(),
    }) => {
      const parsed = parseCookie(cookieHeader);
      if (!parsed) return { revoked: false, reason: 'invalid_session' };
      if (!verifyCsrfProof(parsed.payloadSegment, csrfToken, input.hmacSecret)) {
        return { revoked: false, reason: 'invalid_csrf' };
      }
      const outcome = await exactRevoke(parsed, now, 'adult_logout');
      if (outcome === 'revoked') return { revoked: true };
      return {
        revoked: false,
        reason: outcome === 'invalid' ? 'invalid_session' : 'revocation_unverified',
      };
    },

    rotateCookieHeader: async ({ cookie_header: cookieHeader, now = clock() }) => {
      const parsed = parseCookie(cookieHeader);
      if (!parsed) return { revoked: false, reason: 'invalid_session' };
      const outcome = await exactRevoke(parsed, now, 'session_rotation');
      return outcome === 'revoked'
        ? { revoked: true }
        : {
            revoked: false,
            reason: outcome === 'invalid' ? 'invalid_session' : 'revocation_unverified',
          };
    },

    resolveCookieHeader: async ({ cookie_header: cookieHeader, now = clock() }) => {
      const parsed = parseCookie(cookieHeader);
      return parsed ? resolveEnvelope(parsed, now) : { status: 'invalid' };
    },

    verifyCsrf: async ({ cookie_header: cookieHeader, csrf_token: csrfToken, now = clock() }) => {
      const parsed = parseCookie(cookieHeader);
      if (!parsed || !verifyCsrfProof(parsed.payloadSegment, csrfToken, input.hmacSecret)) {
        return null;
      }
      const resolution = await resolveEnvelope(parsed, now);
      return resolution.status === 'resolved' ? resolution.context : null;
    },
  };
}

export function createPostgresV21AdultSessionRuntime(
  input: Omit<V21AdultSessionRuntimeInput, 'repository'> & {
    db: Parameters<typeof createPostgresV21AdultSessionRepository>[0];
  },
): V21AdultSessionRuntime {
  return createV21AdultSessionRuntime({
    repository: createPostgresV21AdultSessionRepository(input.db),
    hmacSecret: input.hmacSecret,
    ...(input.randomBytes ? { randomBytes: input.randomBytes } : {}),
    ...(input.clock ? { clock: input.clock } : {}),
  });
}

export function authorizeV21ParentRoute(input: {
  context: V21ParentSessionContext;
  requested_path: string;
}): V21ParentRouteAuthorization {
  if (input.context.household.accessState !== 'inactive') return { allowed: true };
  const pathname = canonicalPathname(input.requested_path);
  if (!pathname) return { allowed: false, reason: 'inactive_household' };
  const exactAllowed = new Set([
    '/app/parent',
    '/app/parent/billing',
    '/app/parent/account',
    '/app/parent/privacy',
    '/app/parent/data-rights',
    '/select-household',
  ]);
  if (
    exactAllowed.has(pathname) ||
    pathname === '/app/parent/support' ||
    isSafeSupportDetail(pathname)
  ) {
    return { allowed: true };
  }
  return { allowed: false, reason: 'inactive_household' };
}

function assertEstablishmentInput(input: V21ParentSessionEstablishmentInput): void {
  if (
    input.scope.product !== ONE_TIME_PRODUCT_SCOPE ||
    VERIFICATION_RUNTIME_TIER[input.scope.verification_environment_id] !==
      input.scope.runtime_tier ||
    input.active_role !== 'parent' ||
    !Number.isSafeInteger(input.security_version) ||
    input.security_version < 1 ||
    !validInstant(input.now)
  ) {
    throw new Error('Invalid v2.1 Parent-session establishment binding.');
  }
  for (const identifier of [input.adult_id, input.human_account_id, input.household_id]) {
    exactIdentifierSchema.parse(identifier);
  }
}

function repositoryBinding(claims: BrowserEnvelope) {
  return {
    sessionId: claims.session_id,
    adultId: claims.adult_id,
    humanAccountId: claims.human_account_id,
    householdId: claims.household_id,
    runtimeTier: claims.runtime_tier,
    verificationEnvironmentId: claims.verification_environment_id,
    securityVersion: claims.security_version,
  };
}

function exactReadback(
  resolved: V21ParentSessionContext,
  claims: BrowserEnvelope,
  now: Date,
): boolean {
  const idleExpiry = Date.parse(resolved.session.idleExpiresAt);
  const absoluteExpiry = Date.parse(resolved.session.absoluteExpiresAt);
  return (
    resolved.adultId === claims.adult_id &&
    Number.isSafeInteger(resolved.ownedHouseholdCount) &&
    resolved.ownedHouseholdCount === 1 &&
    resolved.session.sessionId === claims.session_id &&
    resolved.session.humanAccountId === claims.human_account_id &&
    resolved.session.activeRole === 'parent' &&
    resolved.session.activeHouseholdId === claims.household_id &&
    resolved.session.securityVersion === claims.security_version &&
    resolved.session.product === ONE_TIME_PRODUCT_SCOPE &&
    resolved.session.runtimeTier === claims.runtime_tier &&
    resolved.session.verificationEnvironmentId === claims.verification_environment_id &&
    resolved.session.revokedAt === null &&
    resolved.household.householdId === claims.household_id &&
    Number.isFinite(idleExpiry) &&
    Number.isFinite(absoluteExpiry) &&
    idleExpiry > now.getTime() &&
    absoluteExpiry > now.getTime() &&
    idleExpiry <= absoluteExpiry
  );
}

function canonicalAdultEmail(value: string): string | null {
  try {
    return normalizeAdultEmail(value);
  } catch {
    return null;
  }
}

function currentExpiry(resolved: V21ParentSessionContext): string {
  const idleExpiry = Date.parse(resolved.session.idleExpiresAt);
  const absoluteExpiry = Date.parse(resolved.session.absoluteExpiresAt);
  return new Date(Math.min(idleExpiry, absoluteExpiry)).toISOString();
}

function signBrowserEnvelope(claims: BrowserEnvelope, hmacSecret: string): string {
  const payloadSegment = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const unsigned = `${BROWSER_TOKEN_VERSION}.${payloadSegment}`;
  const signature = hmac(BROWSER_TOKEN_DOMAIN, unsigned, hmacSecret).toString('base64url');
  const token = `${unsigned}.${signature}`;
  if (token.length > MAX_BROWSER_TOKEN_LENGTH) {
    throw new Error('The v2.1 Parent-session browser token is too large.');
  }
  return token;
}

function parseBrowserCookie(
  cookieHeader: string | null | undefined,
  hmacSecret: string,
): ParsedBrowserEnvelope | null {
  if (!cookieHeader || cookieHeader.length > MAX_BROWSER_TOKEN_LENGTH * 2) return null;
  const matchingValues: string[] = [];
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    if (name === AUTH_SESSION_COOKIE.name) {
      matchingValues.push(part.slice(separator + 1).trim());
    }
  }
  if (matchingValues.length !== 1) return null;
  let token: string;
  try {
    token = decodeURIComponent(matchingValues[0]!);
  } catch {
    return null;
  }
  if (token.length < 32 || token.length > MAX_BROWSER_TOKEN_LENGTH) return null;
  const parts = token.split('.');
  if (
    parts.length !== 3 ||
    parts[0] !== BROWSER_TOKEN_VERSION ||
    !parts[1] ||
    !parts[2] ||
    !BASE64URL_SIGNATURE.test(parts[2])
  ) {
    return null;
  }
  const unsigned = `${parts[0]}.${parts[1]}`;
  const expected = hmac(BROWSER_TOKEN_DOMAIN, unsigned, hmacSecret);
  const actual = canonicalBase64urlBuffer(parts[2]);
  if (!actual || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }
  const payload = canonicalBase64urlBuffer(parts[1]);
  if (!payload) return null;
  try {
    const claims = browserEnvelopeSchema.parse(JSON.parse(payload.toString('utf8')));
    return {
      claims,
      payloadSegment: parts[1],
    };
  } catch {
    return null;
  }
}

function signCsrf(payloadSegment: string, nonce: string, hmacSecret: string): string {
  const unsigned = `${CSRF_TOKEN_VERSION}.${nonce}`;
  const signature = hmac(CSRF_TOKEN_DOMAIN, `${payloadSegment}\0${unsigned}`, hmacSecret).toString(
    'base64url',
  );
  return `${unsigned}.${signature}`;
}

function verifyCsrfProof(
  payloadSegment: string,
  csrfToken: string | null | undefined,
  hmacSecret: string,
): boolean {
  if (!csrfToken || csrfToken.length > 512) return false;
  const parts = csrfToken.split('.');
  if (
    parts.length !== 3 ||
    parts[0] !== CSRF_TOKEN_VERSION ||
    !parts[1] ||
    !BASE64URL_MATERIAL.test(parts[1]) ||
    !parts[2] ||
    !BASE64URL_SIGNATURE.test(parts[2])
  ) {
    return false;
  }
  const expected = hmac(
    CSRF_TOKEN_DOMAIN,
    `${payloadSegment}\0${parts[0]}.${parts[1]}`,
    hmacSecret,
  );
  const actual = canonicalBase64urlBuffer(parts[2]);
  return Boolean(actual && actual.length === expected.length && timingSafeEqual(actual, expected));
}

function canonicalBase64urlBuffer(value: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null;
  try {
    const decoded = Buffer.from(value, 'base64url');
    return decoded.toString('base64url') === value ? decoded : null;
  } catch {
    return null;
  }
}

function hmac(domain: string, value: string, hmacSecret: string): Buffer {
  return createHmac('sha256', hmacSecret)
    .update(domain, 'utf8')
    .update('\0', 'utf8')
    .update(value, 'utf8')
    .digest();
}

function domainDigest(domain: string, raw: string): string {
  return createHash('sha256').update(`${domain}\0${raw}`, 'utf8').digest('hex');
}

function randomMaterial(source: (size: number) => Uint8Array): string {
  const bytes = Buffer.from(source(RANDOM_MATERIAL_BYTES));
  if (bytes.length < RANDOM_MATERIAL_BYTES) {
    throw new Error('The Parent-session random source returned insufficient material.');
  }
  const material = bytes.toString('base64url');
  if (!BASE64URL_MATERIAL.test(material)) {
    throw new Error('The Parent-session random source returned invalid material.');
  }
  return material;
}

async function bestEffortRevoke(
  repository: V21AdultSessionRepository,
  claims: BrowserEnvelope,
  now: Date,
): Promise<void> {
  try {
    await repository.revoke({
      ...repositoryBinding(claims),
      tokenKind: 'access',
      tokenDigest: domainDigest(ACCESS_TOKEN_DOMAIN, claims.access_material),
      now,
      reason: 'explicit_revocation',
    });
  } catch {
    // The establishment result remains fail-closed even when cleanup readback is unavailable.
  }
}

function canonicalPathname(requestedPath: string): string | null {
  if (!requestedPath.startsWith('/') || requestedPath.startsWith('//')) return null;
  try {
    const parsed = new URL(requestedPath, 'https://onetime.invalid');
    if (parsed.origin !== 'https://onetime.invalid' || parsed.username || parsed.password) {
      return null;
    }
    const pathname =
      parsed.pathname.length > 1 && parsed.pathname.endsWith('/')
        ? parsed.pathname.slice(0, -1)
        : parsed.pathname;
    return pathname;
  } catch {
    return null;
  }
}

function isSafeSupportDetail(pathname: string): boolean {
  const prefix = '/app/parent/support/';
  if (!pathname.startsWith(prefix)) return false;
  const encodedTicketId = pathname.slice(prefix.length);
  if (!encodedTicketId || encodedTicketId.includes('/')) return false;
  let ticketId: string;
  try {
    ticketId = decodeURIComponent(encodedTicketId);
  } catch {
    return false;
  }
  return (
    ticketId.length > 0 &&
    ticketId === ticketId.trim() &&
    ticketId !== '.' &&
    ticketId !== '..' &&
    !ticketId.includes('/') &&
    !ticketId.includes('\\') &&
    !ticketId.includes('%') &&
    ![...ticketId].some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
    })
  );
}

function validInstant(value: Date): boolean {
  return value instanceof Date && Number.isFinite(value.getTime());
}
