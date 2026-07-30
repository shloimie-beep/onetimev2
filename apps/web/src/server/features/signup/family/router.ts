import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import { z, ZodError } from 'zod';
import type { AppConfig } from '../../../../../../../packages/config/src/index.ts';
import type {
  FamilySignupCommand,
  FamilySignupResult,
  FamilySignupScope,
} from '../../../../../../../packages/contracts/src/signup/family/index.ts';
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

type FamilySignupSubmitter = {
  submit(input: {
    scope: FamilySignupScope;
    command: FamilySignupCommand;
    now: Date;
  }): Promise<FamilySignupResult>;
};

type FamilySignupRouterInput = {
  config: AppConfig;
  pool: DbPool;
  clock?: (() => Date) | undefined;
  submitter?: FamilySignupSubmitter | undefined;
  rateLimit?: RequestHandler | false | undefined;
  randomKey?: (() => string) | undefined;
};

export function createFamilySignupRouter(input: FamilySignupRouterInput): express.Router {
  const router = express.Router();
  const now = input.clock ?? (() => new Date());
  const randomKey = input.randomKey ?? (() => randomBytes(32).toString('base64url'));
  const submitter = input.submitter ?? defaultSubmitter(input.config, input.pool);
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
      writes_allowed: input.config.oneTimeVerificationWritesAllowed,
    });
  });

  router.post(
    '/',
    (req: RequestWithTrace, res, next) => {
      if (!input.config.oneTimeVerificationWritesAllowed) {
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
        const result = await submitter.submit({
          scope: signupScope(input.config),
          command,
          now: now(),
        });
        sendSafeResult(res, result);
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
    repository: createPostgresFamilySignupRepository(pool),
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

function signupScope(config: AppConfig): FamilySignupScope {
  return {
    product: 'one_time_mishnayos',
    runtime_tier: config.oneTimeRuntimeTier,
    verification_environment_id: config.oneTimeVerificationEnvironmentId,
  };
}

function sendSafeResult(res: Response, result: FamilySignupResult): void {
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

  const common = {
    success: true,
    disposition: result.disposition,
    local_commit_state: 'committed',
    local_access_state: result.projection.access_state,
    free_access_expires_at: result.projection.free_access_expires_at,
    checkout_required: result.projection.checkout_required,
    provider_projection_state: 'evidence_unavailable_identity_review',
    provider_effects_completed_inline: 0,
    session_established: false,
  } as const;
  if (result.next_action === 'signed_in') {
    res.status(202).json({
      ...common,
      code: 'SIGNUP_COMMITTED_SESSION_UNAVAILABLE',
      next_action: 'session_integration_pending',
      message:
        'Your family account and free access were saved. Automatic sign-in is not available yet.',
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
    code: 'SIGNUP_COMMITTED_CHECKOUT_UNAVAILABLE',
    next_action: 'checkout_integration_pending',
    message: 'Your inactive account was saved. Hosted checkout is not available yet.',
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
    return new URL(source).origin === new URL(config.publicBaseUrl).origin;
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
