import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import { z, ZodError } from 'zod';
import type { AppConfig } from '../../../../../../../packages/config/src/index.ts';
import { ADULT_SESSION_POLICY } from '../../../../../../../packages/contracts/src/accounts/v21-household-identity.ts';
import type {
  FamilySignupCommand,
  FamilySignupResult,
  FamilySignupScope,
} from '../../../../../../../packages/contracts/src/signup/family/index.ts';
import { VERIFICATION_RUNTIME_TIER } from '../../../../../../../packages/contracts/src/state/index.ts';
import type { DbPool } from '../../../../../../../packages/db/src/index.ts';
import { hashAuthPassword } from '../../../../../../../packages/domain/src/auth/policy.ts';
import { FamilySignupError } from '../../../../../../../packages/domain/src/signup/family/index.ts';
import {
  publicError,
  type RequestWithTrace,
} from '../../../../../../../packages/observability/src/index.ts';
import { leadRateLimit } from '../../../rate-limit.ts';
import {
  defineServerFeature,
  SERVER_FEATURE_REGISTRY_CONTRACT_VERSION,
} from '../../registry/index.ts';
import { authReturnLocation, sessionCookieHeader } from '../../auth/http-security.ts';
import { CANONICAL_APPLICATION_HOST } from '../../domain-transition/policy.ts';
import {
  createPostgresFamilySignupRepository,
  PostgresFamilySignupRepositoryError,
} from './repository.ts';
import { createFamilySignupService } from './service.ts';

const CSRF_COOKIE = 'ot_family_signup_csrf';
const CSRF_DOMAIN = 'one-time-family-signup-csrf-v1';
const PASSWORD_FINGERPRINT_DOMAIN = 'one-time-family-signup-password-idempotency-fingerprint-v1';
const CSRF_TTL_MS = 20 * 60 * 1000;
const BASE64URL_32_BYTES = /^[A-Za-z0-9_-]{43}$/u;

const familySignupPayloadSchema = z
  .object({
    classification: z.literal('family'),
    idempotency_key: z
      .string()
      .min(43)
      .max(128)
      .regex(/^[A-Za-z0-9_-]+$/u),
    first_name: z.string().min(1).max(100),
    last_name: z.string().min(1).max(100),
    email: z.string().max(254),
    password: z.string().min(1).max(256),
    password_confirmation: z.string().min(1).max(256),
    timezone: z.string().min(1).max(100),
    terms_accepted: z.literal(true),
    privacy_accepted: z.literal(true),
    general_marketing_consent: z.boolean(),
    parent_newsletter_consent: z.boolean(),
  })
  .strict();

export type FamilySignupSubmitter = {
  submit(input: {
    scope: FamilySignupScope;
    command: FamilySignupCommand;
    now: Date;
  }): Promise<FamilySignupResult>;
};

export type FamilySignupSessionEstablishment =
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

export interface FamilySignupSessionEstablisher {
  establish(input: {
    scope: FamilySignupScope;
    adult_id: string;
    human_account_id: string;
    household_id: string;
    active_role: 'parent';
    security_version: 1;
    now: Date;
  }): Promise<FamilySignupSessionEstablishment>;
}

export type FamilySignupRouterInput = {
  config: AppConfig;
  pool: DbPool;
  runtimeBinding?: FamilySignupScope | undefined;
  clock?: (() => Date) | undefined;
  submitter?: FamilySignupSubmitter | undefined;
  sessionEstablisher?: FamilySignupSessionEstablisher | undefined;
  rateLimit?: RequestHandler | false | undefined;
  randomKey?: (() => string) | undefined;
};

export function createFamilySignupRouter(input: FamilySignupRouterInput): express.Router {
  const router = express.Router();
  const now = input.clock ?? (() => new Date());
  const randomKey = input.randomKey ?? (() => randomBytes(32).toString('base64url'));
  const submitter = input.submitter ?? defaultSubmitter(input.config, input.pool);
  const scope = input.runtimeBinding ?? resolveFamilySignupScope(input.config);
  const writesAllowed = scope.verification_environment_id !== 'production_read_only';
  const mutationRateLimit =
    input.rateLimit === false
      ? (_req: Request, _res: Response, next: NextFunction) => next()
      : (input.rateLimit ?? leadRateLimit(input.config, input.pool));

  router.use((_req, res, next) => {
    setNoStore(res);
    next();
  });

  router.get('/bootstrap', (_req, res) => {
    const idempotencyKey = exactRandomKey(randomKey());
    const csrfCookie = exactRandomKey(randomKey());
    const observedAt = now();
    const csrfToken = signCsrf(
      input.config.authCsrfSecret,
      csrfCookie,
      idempotencyKey,
      observedAt,
      randomKey,
    );
    res.cookie(CSRF_COOKIE, csrfCookie, {
      httpOnly: true,
      secure: input.config.runtime.requiresSecureCookies,
      sameSite: 'strict',
      path: '/api/v1/signup/family',
      maxAge: CSRF_TTL_MS,
    });
    res.status(200).json({
      success: true,
      idempotency_key: idempotencyKey,
      csrf_token: csrfToken,
      expires_at: new Date(observedAt.getTime() + CSRF_TTL_MS).toISOString(),
      writes_allowed: writesAllowed,
    });
  });

  router.post(
    '/',
    (req: RequestWithTrace, res, next) => {
      if (!writesAllowed) {
        res
          .status(403)
          .json(
            publicError(
              'VERIFICATION_ENVIRONMENT_READ_ONLY',
              'Signup writes are disabled in this verification environment.',
              req.traceId,
            ),
          );
        return;
      }
      try {
        const command = familySignupPayloadSchema.parse(req.body) as FamilySignupCommand;
        if (!isSameOrigin(req, input.config)) {
          res
            .status(403)
            .json(
              publicError('SAME_ORIGIN_REQUIRED', 'Refresh the page and try again.', req.traceId),
            );
          return;
        }
        const csrfCookie = cookie(req, CSRF_COOKIE);
        const csrfToken = req.header('x-csrf-token');
        if (
          !csrfCookie ||
          !csrfToken ||
          !verifyCsrf(
            input.config.authCsrfSecret,
            csrfCookie,
            command.idempotency_key,
            csrfToken,
            now(),
          )
        ) {
          res
            .status(403)
            .json(publicError('CSRF_REQUIRED', 'Refresh the page and try again.', req.traceId));
          return;
        }
        res.locals.familySignupCommand = command;
        next();
      } catch (error) {
        if (error instanceof ZodError) {
          res
            .status(400)
            .json(
              publicError('VALIDATION_ERROR', 'Please check the Family signup form.', req.traceId),
            );
          return;
        }
        next(error);
      }
    },
    mutationRateLimit,
    async (req: RequestWithTrace, res) => {
      try {
        const command = res.locals.familySignupCommand as FamilySignupCommand;
        const submittedAt = now();
        const result = await submitter.submit({
          scope,
          command,
          now: submittedAt,
        });
        const session = await establishFamilySignupSession(
          input.sessionEstablisher,
          scope,
          result,
          submittedAt,
        );
        sendSafeResult(res, result, session, submittedAt);
      } catch (error) {
        if (error instanceof FamilySignupError) {
          const conflict = error.code === 'idempotency_conflict';
          res
            .status(conflict ? 409 : 400)
            .json(
              publicError(
                conflict ? 'IDEMPOTENCY_CONFLICT' : 'VALIDATION_ERROR',
                conflict
                  ? 'This request key was already used. Refresh and try again.'
                  : 'Please check the Family signup form.',
                req.traceId,
              ),
            );
          return;
        }
        if (
          error instanceof PostgresFamilySignupRepositoryError &&
          error.code === 'read_only_environment'
        ) {
          res
            .status(403)
            .json(
              publicError(
                'VERIFICATION_ENVIRONMENT_READ_ONLY',
                'Signup writes are disabled in this verification environment.',
                req.traceId,
              ),
            );
          return;
        }
        res
          .status(500)
          .json(publicError('SERVER_ERROR', 'We could not save that signup yet.', req.traceId));
      }
    },
  );

  return router;
}

export const familySignupFeatureRegistration = defineServerFeature({
  featureId: 'onetime.signup-family',
  contractVersion: SERVER_FEATURE_REGISTRY_CONTRACT_VERSION,
  mountPath: '/api/v1/signup/family',
  createRouter: ({ config, pool, clock }) =>
    createFamilySignupRouter({
      config,
      pool,
      ...(clock ? { clock } : {}),
    }),
});

function defaultSubmitter(config: AppConfig, pool: DbPool): FamilySignupSubmitter {
  return createFamilySignupService({
    repository: createPostgresFamilySignupRepository(pool, {
      accountKey: config.accountKey,
      productKey: config.productKey,
    }),
    ...(config.oneTimeFreeAccessExpiresAt
      ? { freeAccessExpiresAt: config.oneTimeFreeAccessExpiresAt }
      : {}),
    hashPassword: async (password) => hashAuthPassword(password),
    fingerprintPasswordForIdempotency: async (password) =>
      createHmac('sha256', config.authCsrfSecret)
        .update(PASSWORD_FINGERPRINT_DOMAIN, 'utf8')
        .update('\0', 'utf8')
        .update(password, 'utf8')
        .digest('hex'),
    allocateIds: () => ({
      adult_id: `adult_${randomUUID()}`,
      human_account_id: `account_${randomUUID()}`,
      household_id: `household_${randomUUID()}`,
    }),
  });
}

export function resolveFamilySignupScope(config: AppConfig): FamilySignupScope {
  const fallback =
    config.oneTimeRuntimeEnvironment === 'production'
      ? ({
          runtime_tier: 'production',
          verification_environment_id: 'production_read_only',
        } as const)
      : config.oneTimeRuntimeEnvironment === 'isolated_staging'
        ? ({
            runtime_tier: 'isolated_staging',
            verification_environment_id: 'persistent_staging',
          } as const)
        : ({
            runtime_tier: 'isolated_staging',
            verification_environment_id: 'ci',
          } as const);
  const centrallyBound = config as AppConfig & {
    oneTimeRuntimeTier?: unknown;
    oneTimeVerificationEnvironmentId?: unknown;
  };
  const runtimeTier = centrallyBound.oneTimeRuntimeTier ?? fallback.runtime_tier;
  const verificationEnvironmentId =
    centrallyBound.oneTimeVerificationEnvironmentId ?? fallback.verification_environment_id;
  if (
    (runtimeTier !== 'isolated_staging' && runtimeTier !== 'production') ||
    typeof verificationEnvironmentId !== 'string' ||
    !Object.hasOwn(VERIFICATION_RUNTIME_TIER, verificationEnvironmentId) ||
    VERIFICATION_RUNTIME_TIER[
      verificationEnvironmentId as keyof typeof VERIFICATION_RUNTIME_TIER
    ] !== runtimeTier
  ) {
    throw new Error('Family signup requires an exact verification-environment runtime binding.');
  }
  return {
    product: 'one_time_mishnayos',
    runtime_tier: runtimeTier,
    verification_environment_id:
      verificationEnvironmentId as FamilySignupScope['verification_environment_id'],
  };
}

async function establishFamilySignupSession(
  establisher: FamilySignupSessionEstablisher | undefined,
  scope: FamilySignupScope,
  result: FamilySignupResult,
  now: Date,
): Promise<FamilySignupSessionEstablishment> {
  if (!establisher || !result.projection) {
    return { established: false, safe_reason: 'integration_unavailable' };
  }
  try {
    const session = await establisher.establish({
      scope,
      adult_id: result.projection.adult_id,
      human_account_id: result.projection.human_account_id,
      household_id: result.projection.household_id,
      active_role: 'parent',
      security_version: 1,
      now,
    });
    if (!session.established) return session;
    const expiresAt = Date.parse(session.expires_at);
    const maximumExpiry = now.getTime() + ADULT_SESSION_POLICY.parent.absoluteMilliseconds + 60_000;
    if (
      session.middleware_readback_verified !== true ||
      session.browser_session_token.length < 32 ||
      session.browser_session_token.length > 4096 ||
      session.csrf_token.length < 32 ||
      session.csrf_token.length > 4096 ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= now.getTime() ||
      expiresAt > maximumExpiry
    ) {
      return { established: false, safe_reason: 'session_creation_failed' };
    }
    return session;
  } catch {
    return { established: false, safe_reason: 'session_creation_failed' };
  }
}

function sendSafeResult(
  res: Response,
  result: FamilySignupResult,
  session: FamilySignupSessionEstablishment,
  now: Date,
): void {
  if (result.projection === null) {
    res.status(200).json({
      success: true,
      code: 'SIGN_IN_OR_RESET',
      next_action: 'sign_in_or_reset',
      session_established: false,
      provider_effects_completed_inline: 0,
      message: 'Sign in or reset your password to continue.',
    });
    return;
  }

  const sessionFields = session.established
    ? {
        session_established: true as const,
        csrf_token: session.csrf_token,
        session_expires_at: session.expires_at,
      }
    : {
        session_established: false as const,
      };
  if (session.established) {
    res.setHeader(
      'Set-Cookie',
      sessionCookieHeader({
        token: session.browser_session_token,
        max_age_seconds: Math.floor((Date.parse(session.expires_at) - now.getTime()) / 1000),
      }),
    );
  }
  const common = {
    success: true,
    disposition: result.disposition,
    local_commit_state: 'committed',
    local_access_state: result.projection.access_state,
    free_access_expires_at: result.projection.free_access_expires_at,
    checkout_required: result.projection.checkout_required,
    checkout_handoff_state: result.checkout_handoff_state,
    provider_projection_state: result.ghl_handoff_state,
    provider_effects_completed_inline: 0,
    ...sessionFields,
  } as const;
  const confirmationMessage =
    result.ghl_handoff_state === 'ready'
      ? 'Your Family account is ready, and we sent your confirmation email.'
      : 'Your Family account is ready. You can continue now while we finish sending your confirmation email.';
  if (result.next_action === 'signed_in') {
    if (session.established) {
      res.status(result.disposition === 'created' ? 201 : 200).json({
        ...common,
        code: 'FAMILY_SIGNUP_COMPLETE',
        next_action: 'parent_overview',
        continue_to: authReturnLocation({ role: 'parent' }),
        message: confirmationMessage,
      });
      return;
    }
    res.status(202).json({
      ...common,
      code: 'SIGNUP_COMMITTED_SESSION_UNAVAILABLE',
      next_action: 'session_integration_pending',
      message: confirmationMessage,
    });
    return;
  }
  if (result.next_action === 'identity_review') {
    res.status(202).json({
      ...common,
      code: 'SIGNUP_COMMITTED_IDENTITY_REVIEW',
      next_action: 'identity_review',
      message:
        'Your inactive account was saved. Checkout remains unavailable pending identity review.',
    });
    return;
  }
  res.status(202).json({
    ...common,
    code: 'SIGNUP_COMMITTED_CHECKOUT_HANDOFF_QUEUED',
    next_action: 'checkout_handoff_queued',
    checkout_provider: 'highlevel',
    financial_provider: 'stripe',
    direct_stripe_mutation_by_one_time: false,
    message:
      'Your inactive account was saved. The standard hosted-checkout handoff is queued; no charge was made by this form.',
  });
}

function signCsrf(
  secret: string,
  csrfCookie: string,
  idempotencyKey: string,
  now: Date,
  randomKey: () => string,
): string {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const nonce = exactRandomKey(randomKey());
  const signature = csrfSignature(secret, csrfCookie, idempotencyKey, issuedAt, nonce);
  return `${issuedAt}.${nonce}.${signature}`;
}

function verifyCsrf(
  secret: string,
  csrfCookie: string,
  idempotencyKey: string,
  submitted: string,
  now: Date,
): boolean {
  const [rawIssuedAt, nonce, signature, extra] = submitted.split('.');
  if (
    !rawIssuedAt ||
    !nonce ||
    !signature ||
    extra !== undefined ||
    !BASE64URL_32_BYTES.test(csrfCookie) ||
    !BASE64URL_32_BYTES.test(nonce) ||
    !BASE64URL_32_BYTES.test(signature)
  ) {
    return false;
  }
  const issuedAt = Number(rawIssuedAt);
  const ageMs = now.getTime() - issuedAt * 1000;
  if (!Number.isSafeInteger(issuedAt) || ageMs < -60_000 || ageMs > CSRF_TTL_MS) {
    return false;
  }
  const expected = Buffer.from(
    csrfSignature(secret, csrfCookie, idempotencyKey, issuedAt, nonce),
    'base64url',
  );
  const actual = Buffer.from(signature, 'base64url');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function csrfSignature(
  secret: string,
  csrfCookie: string,
  idempotencyKey: string,
  issuedAt: number,
  nonce: string,
): string {
  return createHmac('sha256', secret)
    .update([CSRF_DOMAIN, csrfCookie, idempotencyKey, String(issuedAt), nonce].join('\0'), 'utf8')
    .digest('base64url');
}

function exactRandomKey(value: string): string {
  if (!BASE64URL_32_BYTES.test(value)) {
    throw new Error('Family-signup random material must be exactly 32 bytes of base64url.');
  }
  return value;
}

function isSameOrigin(req: Request, config: AppConfig): boolean {
  const fetchSite = req.header('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin') return false;
  const source = req.header('origin') ?? req.header('referer');
  if (!source) return false;
  try {
    const sourceOrigin = new URL(source).origin;
    return (
      sourceOrigin === new URL(config.publicBaseUrl).origin ||
      sourceOrigin === `https://${CANONICAL_APPLICATION_HOST}`
    );
  } catch {
    return false;
  }
}

function cookie(req: Request, name: string): string | undefined {
  const header = req.header('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [candidateName, ...candidateValue] = part.trim().split('=');
    if (candidateName !== name) continue;
    try {
      return decodeURIComponent(candidateValue.join('='));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function setNoStore(res: Response): void {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.removeHeader('ETag');
}
