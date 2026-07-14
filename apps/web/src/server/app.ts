import path from 'node:path';
import express, { type Request, type Response } from 'express';
import helmet from 'helmet';
import { ZodError } from 'zod';
import type { AppConfig } from '../../../../packages/config/src/index.ts';
import type { DbPool } from '../../../../packages/db/src/index.ts';
import {
  contactListQuerySchema,
  contactListResponseSchema,
  contactResponseSchema,
  createContactSchema,
  leadPayloadSchema,
  loginPayloadSchema,
  mfaChallengePayloadSchema,
  mfaEnrollmentPayloadSchema,
  mfaRecoveryPayloadSchema,
  publicFieldErrors,
  updateContactSchema,
  assigneeListResponseSchema,
} from '../../../../packages/contracts/src/index.ts';
import {
  CrmDuplicateError,
  CrmVersionConflictError,
  IdempotencyConflictError,
  activateTotpEnrollment,
  authenticateUser,
  canEditContacts,
  captureLead,
  createContact,
  createLoginCsrf,
  createSession,
  getContactDetail,
  getSessionByToken,
  listAssignableUsers,
  listContacts,
  replaceMfaRecoveryCodes,
  revokeMfaFactors,
  revokeSession,
  rotateSessionCsrf,
  updateContact,
  verifyLoginCsrf,
  verifyMfaChallenge,
  verifyMfaRecoveryChallenge,
  verifySessionCsrf,
  type AuthenticatedSession,
} from '../../../../packages/domain/src/index.ts';
import {
  exposeServerTiming,
  publicError,
  traceMiddleware,
  withTiming,
  type RequestWithTrace,
} from '../../../../packages/observability/src/index.ts';
import { leadRateLimit } from './rate-limit.ts';

type AppDeps = {
  config: AppConfig;
  pool: DbPool;
  distDir?: string;
};

const SESSION_COOKIE = 'otcrm_session';
const CSRF_COOKIE = 'otcrm_csrf';

export function createApp({
  config,
  pool,
  distDir = path.resolve(process.cwd(), 'dist/apps/web/public'),
}: AppDeps) {
  const app = express();
  app.set('trust proxy', config.trustedProxyHops);
  app.set('etag', false);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use(traceMiddleware);
  app.use(express.json({ limit: '32kb' }));
  app.use(express.urlencoded({ extended: false, limit: '32kb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'onetime-web' });
  });

  app.get('/ready', async (req: RequestWithTrace, res) => {
    try {
      await withTiming(req, 'db', () => pool.query('SELECT 1'));
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  app.get('/version', (_req, res) => {
    res.json({
      version: config.appVersion,
      commit_sha: config.commitSha,
      target_app: 'one-time',
    });
  });

  app.get('/one-time', (_req, res) => res.redirect(301, '/'));
  app.get('/one-time/signup', (_req, res) => res.redirect(301, '/signup'));
  app.get('/rabbi-member', (_req, res) => res.redirect(301, '/login'));

  app.get('/login', (req, res) => {
    const csrf = createLoginCsrf(config);
    setCsrfCookie(res, config, csrf.csrf_cookie);
    setPrivateNoStore(res);
    res
      .status(200)
      .type('html')
      .send(
        loginPageHtml(
          csrf.csrf_token,
          safeReturnPath(String(req.query.return_to ?? ''), config) ?? '/app/crm',
        ),
      );
  });

  app.get(/^\/app\/crm(?:\/.*)?$/, async (req: RequestWithTrace, res) => {
    const session = await sessionFromRequest(req, pool, config);
    if (!session) {
      res.redirect(
        302,
        `/login?return_to=${encodeURIComponent(safeReturnPath(req.path, config) ?? '/app/crm')}`,
      );
      return;
    }
    await ensureSessionCsrfCookie(req, res, pool, config, session);
    setPrivateNoStore(res);
    res.sendFile(path.join(distDir, 'app', 'crm.html'));
  });

  const handleLeadPost = async (req: RequestWithTrace, res: express.Response) => {
    try {
      const payload = leadPayloadSchema.parse(req.body);
      const result = await withTiming(req, 'lead_txn', () =>
        captureLead({ pool, config, payload }),
      );
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Please check the signup form.',
          field_errors: publicFieldErrors(error),
          request_id: req.traceId,
        });
        return;
      }
      if (error instanceof IdempotencyConflictError) {
        res.status(409).json({
          success: false,
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'This request key was already used. Refresh and try again.',
          request_id: req.traceId,
        });
        return;
      }
      res
        .status(500)
        .json(publicError('SERVER_ERROR', 'We could not save that signup yet.', req.traceId));
    }
  };

  app.post('/api/v1/leads', leadRateLimit(config, pool), handleLeadPost);
  app.post('/api/one-time/interest', leadRateLimit(config, pool), handleLeadPost);

  app.post('/api/v1/auth/login', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    try {
      const payload = loginPayloadSchema.parse(req.body);
      if (
        !verifyLoginCsrf(
          config,
          getCookie(req, CSRF_COOKIE),
          payload.csrf_token ?? req.header('x-csrf-token'),
        )
      ) {
        res
          .status(403)
          .json(publicError('CSRF_REQUIRED', 'Refresh the login page and try again.', req.traceId));
        return;
      }
      const login = await withTiming(req, 'db', () =>
        authenticateUser({
          pool,
          config,
          email: payload.email,
          password: payload.password,
          ip: req.ip,
          userAgent: req.header('user-agent') ?? undefined,
        }),
      );
      if (!login.ok) {
        const status =
          login.code === 'RATE_LIMITED' ? 429 : login.code === 'MFA_REQUIRED' ? 403 : 401;
        if (login.retry_after_seconds)
          res.setHeader('retry-after', String(login.retry_after_seconds));
        res.status(status).json({
          success: false,
          code: login.code,
          message:
            login.code === 'MFA_REQUIRED'
              ? 'Enter your authenticator code to finish signing in.'
              : 'Email or password is not correct.',
          challenge_token: login.challenge_token,
          request_id: req.traceId,
        });
        return;
      }

      const rotatedFromSessionKey = await revokeSession({
        pool,
        config,
        sessionToken: getCookie(req, SESSION_COOKIE),
        reason: 'login_rotation',
        ip: req.ip,
        userAgent: req.header('user-agent') ?? undefined,
      });
      const session = await withTiming(req, 'db', () =>
        createSession({
          pool,
          config,
          user: login.user,
          ip: req.ip,
          userAgent: req.header('user-agent') ?? undefined,
          rotatedFromSessionKey: rotatedFromSessionKey ?? undefined,
        }),
      );
      setAuthCookies(res, config, session.session_token, session.csrf_token);
      res.status(200).json({
        success: true,
        user: session.user,
        csrf_token: session.csrf_token,
        return_to: safeReturnPath(payload.return_to, config) ?? '/app/crm',
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Please check the login form.',
          field_errors: publicFieldErrors(error),
          request_id: req.traceId,
        });
        return;
      }
      res
        .status(500)
        .json(publicError('SERVER_ERROR', 'Login is unavailable right now.', req.traceId));
    }
  });

  app.post('/api/v1/auth/mfa/enroll/activate', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    try {
      const payload = mfaEnrollmentPayloadSchema.parse(req.body);
      const activated = await activateTotpEnrollment({
        pool,
        config,
        enrollmentToken: payload.enrollment_token,
        code: payload.totp_code,
      });
      if (!activated) {
        res
          .status(403)
          .json(
            publicError('MFA_INVALID', 'The authenticator code was not accepted.', req.traceId),
          );
        return;
      }
      res.status(200).json({ success: true, recovery_codes: activated.recovery_codes });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Please check the submitted fields.',
          field_errors: publicFieldErrors(error),
          request_id: req.traceId,
        });
        return;
      }
      res
        .status(500)
        .json(publicError('SERVER_ERROR', 'MFA activation is unavailable right now.', req.traceId));
    }
  });

  app.post('/api/v1/auth/mfa/challenge', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    try {
      const payload = mfaChallengePayloadSchema.parse(req.body);
      const verified = await verifyMfaChallenge({
        pool,
        config,
        challengeToken: payload.challenge_token,
        code: payload.totp_code,
        ip: req.ip,
        userAgent: req.header('user-agent') ?? undefined,
      });
      if (!verified.ok) {
        const status = verified.code === 'RATE_LIMITED' ? 429 : 401;
        if (verified.retry_after_seconds) {
          res.setHeader('retry-after', String(verified.retry_after_seconds));
        }
        res.status(status).json({
          success: false,
          code: verified.code,
          message: 'Email, password, or authenticator code is not correct.',
          request_id: req.traceId,
        });
        return;
      }
      const rotatedFromSessionKey = await revokeSession({
        pool,
        config,
        sessionToken: getCookie(req, SESSION_COOKIE),
        reason: 'mfa_login_rotation',
        ip: req.ip,
        userAgent: req.header('user-agent') ?? undefined,
      });
      const session = await withTiming(req, 'db', () =>
        createSession({
          pool,
          config,
          user: verified.user,
          ip: req.ip,
          userAgent: req.header('user-agent') ?? undefined,
          rotatedFromSessionKey: rotatedFromSessionKey ?? undefined,
          assuranceMethod: 'totp',
        }),
      );
      setAuthCookies(res, config, session.session_token, session.csrf_token);
      res.status(200).json({
        success: true,
        user: session.user,
        csrf_token: session.csrf_token,
        return_to: '/app/crm',
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Please check the submitted fields.',
          field_errors: publicFieldErrors(error),
          request_id: req.traceId,
        });
        return;
      }
      res
        .status(500)
        .json(publicError('SERVER_ERROR', 'MFA challenge is unavailable right now.', req.traceId));
    }
  });

  app.post('/api/v1/auth/mfa/recovery', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    try {
      const payload = mfaRecoveryPayloadSchema.parse(req.body);
      const verified = await verifyMfaRecoveryChallenge({
        pool,
        config,
        challengeToken: payload.challenge_token,
        recoveryCode: payload.recovery_code,
        ip: req.ip,
        userAgent: req.header('user-agent') ?? undefined,
      });
      if (!verified.ok) {
        const status = verified.code === 'RATE_LIMITED' ? 429 : 401;
        res.status(status).json({
          success: false,
          code: verified.code,
          message: 'Email, password, or recovery code is not correct.',
          request_id: req.traceId,
        });
        return;
      }
      const rotatedFromSessionKey = await revokeSession({
        pool,
        config,
        sessionToken: getCookie(req, SESSION_COOKIE),
        reason: 'mfa_recovery_login_rotation',
        ip: req.ip,
        userAgent: req.header('user-agent') ?? undefined,
      });
      const session = await withTiming(req, 'db', () =>
        createSession({
          pool,
          config,
          user: verified.user,
          ip: req.ip,
          userAgent: req.header('user-agent') ?? undefined,
          rotatedFromSessionKey: rotatedFromSessionKey ?? undefined,
          assuranceMethod: 'recovery_code',
        }),
      );
      setAuthCookies(res, config, session.session_token, session.csrf_token);
      res.status(200).json({
        success: true,
        user: session.user,
        csrf_token: session.csrf_token,
        return_to: '/app/crm',
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Please check the submitted fields.',
          field_errors: publicFieldErrors(error),
          request_id: req.traceId,
        });
        return;
      }
      res
        .status(500)
        .json(publicError('SERVER_ERROR', 'MFA recovery is unavailable right now.', req.traceId));
    }
  });

  app.post('/api/v1/auth/mfa/recovery/replace', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!['owner', 'admin'].includes(session.user.role)) {
      res
        .status(403)
        .json(publicError('FORBIDDEN', 'Your role cannot replace MFA codes.', req.traceId));
      return;
    }
    if (!(await requireSessionCsrf(req, res, pool, session))) return;
    const recoveryCodes = await replaceMfaRecoveryCodes({
      pool,
      config,
      userKey: session.user.user_key,
    });
    clearAuthCookies(res, config);
    res.status(200).json({ success: true, recovery_codes: recoveryCodes, session_revoked: true });
  });

  app.post('/api/v1/auth/mfa/revoke', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!['owner', 'admin'].includes(session.user.role)) {
      res.status(403).json(publicError('FORBIDDEN', 'Your role cannot revoke MFA.', req.traceId));
      return;
    }
    if (!(await requireSessionCsrf(req, res, pool, session))) return;
    await revokeMfaFactors({ pool, config, userKey: session.user.user_key });
    clearAuthCookies(res, config);
    res.status(200).json({ success: true, session_revoked: true });
  });

  app.post('/api/v1/auth/logout', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!(await requireSessionCsrf(req, res, pool, session))) return;
    await revokeSession({
      pool,
      config,
      sessionToken: getCookie(req, SESSION_COOKIE),
      reason: 'logout',
      ip: req.ip,
      userAgent: req.header('user-agent') ?? undefined,
    });
    clearAuthCookies(res, config);
    res.status(200).json({ success: true });
  });

  app.get('/api/v1/auth/session', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    const csrfToken = await ensureSessionCsrfCookie(req, res, pool, config, session);
    res.json({
      authenticated: true,
      user: session.user,
      csrf_token: csrfToken,
      expires_at: session.expires_at,
    });
  });

  app.get('/api/v1/crm/contacts', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    try {
      if (typeof req.query.search === 'string' && req.query.search.trim()) {
        res
          .status(400)
          .json(
            publicError('SEARCH_POST_REQUIRED', 'Use the private search command.', req.traceId),
          );
        return;
      }
      const query = contactListQuerySchema.parse(req.query);
      const result = await withTiming(req, 'db', () => listContacts({ pool, config, query }));
      res.json(contactListResponseSchema.parse({ success: true, ...result }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.post('/api/v1/crm/contacts/search', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!(await requireSessionCsrf(req, res, pool, session))) return;
    try {
      const result = await withTiming(req, 'db', () =>
        listContacts({ pool, config, query: req.body }),
      );
      res.json(contactListResponseSchema.parse({ success: true, ...result }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.get('/api/v1/crm/assignees', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!['owner', 'admin'].includes(session.user.role)) {
      res
        .status(403)
        .json(publicError('FORBIDDEN', 'Your role cannot assign contacts.', req.traceId));
      return;
    }
    const assignees = await withTiming(req, 'db', () => listAssignableUsers({ pool, config }));
    res.json(assigneeListResponseSchema.parse({ success: true, assignees }));
  });

  app.post('/api/v1/crm/contacts', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!canEditContacts(session.user.role)) {
      res
        .status(403)
        .json(publicError('FORBIDDEN', 'Your role can view CRM contacts only.', req.traceId));
      return;
    }
    if (!(await requireSessionCsrf(req, res, pool, session))) return;
    try {
      const payload = createContactSchema.parse(req.body);
      const contact = await withTiming(req, 'db', () =>
        createContact({
          pool,
          config,
          payload,
          actorUserKey: session.user.user_key,
          actorRole: session.user.role,
        }),
      );
      res.status(201).json(contactResponseSchema.parse({ success: true, contact }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.get('/api/v1/crm/contacts/:contactId', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    const contactId = String(req.params.contactId);
    const contact = await withTiming(req, 'db', () =>
      getContactDetail({ pool, config, contactId }),
    );
    if (!contact) {
      res.status(404).json(publicError('NOT_FOUND', 'Contact was not found.', req.traceId));
      return;
    }
    res.json(contactResponseSchema.parse({ success: true, contact }));
  });

  app.patch('/api/v1/crm/contacts/:contactId', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!canEditContacts(session.user.role)) {
      res
        .status(403)
        .json(publicError('FORBIDDEN', 'Your role can view CRM contacts only.', req.traceId));
      return;
    }
    if (!(await requireSessionCsrf(req, res, pool, session))) return;
    try {
      const contactId = String(req.params.contactId);
      const payload = updateContactSchema.parse(req.body);
      const contact = await withTiming(req, 'db', () =>
        updateContact({
          pool,
          config,
          contactId,
          payload,
          actorUserKey: session.user.user_key,
          actorRole: session.user.role,
        }),
      );
      if (!contact) {
        res.status(404).json(publicError('NOT_FOUND', 'Contact was not found.', req.traceId));
        return;
      }
      res.json(contactResponseSchema.parse({ success: true, contact }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.use(
    express.static(distDir, { extensions: ['html'], maxAge: config.isProduction ? '1h' : 0 }),
  );

  app.use((_req, res) => {
    res.status(404).sendFile(path.join(distDir, '404.html'));
  });

  return app;
}

async function requireApiSession(
  req: RequestWithTrace,
  res: Response,
  pool: DbPool,
  config: AppConfig,
) {
  const session = await sessionFromRequest(req, pool, config);
  if (!session) {
    setPrivateNoStore(res);
    res.status(401).json(publicError('UNAUTHENTICATED', 'Please log in again.', req.traceId));
    return null;
  }
  exposeServerTiming(req);
  return session;
}

async function requireSessionCsrf(
  req: RequestWithTrace,
  res: Response,
  pool: DbPool,
  session: AuthenticatedSession,
) {
  const csrfToken = req.header('x-csrf-token') ?? req.body?.csrf_token;
  const valid = await verifySessionCsrf({ pool, sessionKey: session.session_key, csrfToken });
  if (!valid) {
    res
      .status(403)
      .json(publicError('CSRF_REQUIRED', 'Refresh the page and try again.', req.traceId));
    return false;
  }
  return true;
}

async function sessionFromRequest(req: Request, pool: DbPool, config: AppConfig) {
  return getSessionByToken({
    pool,
    config,
    sessionToken: getCookie(req, SESSION_COOKIE),
    userAgent: req.header('user-agent') ?? undefined,
  });
}

async function ensureSessionCsrfCookie(
  req: Request,
  res: Response,
  pool: DbPool,
  config: AppConfig,
  session: AuthenticatedSession,
) {
  const current = getCookie(req, CSRF_COOKIE);
  if (
    current &&
    (await verifySessionCsrf({ pool, sessionKey: session.session_key, csrfToken: current }))
  ) {
    return current;
  }
  const next = await rotateSessionCsrf({ pool, config, session });
  setCsrfCookie(res, config, next);
  return next;
}

function handleApiError(error: unknown, req: RequestWithTrace, res: Response) {
  setPrivateNoStore(res);
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Please check the submitted fields.',
      field_errors: publicFieldErrors(error),
      request_id: req.traceId,
    });
    return;
  }
  if (error instanceof CrmDuplicateError) {
    res.status(409).json({
      success: false,
      code: 'DUPLICATE_CONTACT',
      message: 'A matching contact already exists.',
      existing_contact_path: `/app/crm/contacts/${encodeURIComponent(error.existingContactId)}`,
      request_id: req.traceId,
    });
    return;
  }
  if (error instanceof CrmVersionConflictError) {
    res.status(409).json({
      success: false,
      code: 'VERSION_CONFLICT',
      message: 'This contact changed in another session. Reload before saving.',
      current_version: error.currentVersion,
      request_id: req.traceId,
    });
    return;
  }
  if (error instanceof IdempotencyConflictError) {
    res.status(409).json({
      success: false,
      code: 'IDEMPOTENCY_CONFLICT',
      message: 'This request key was already used for a different contact create request.',
      request_id: req.traceId,
    });
    return;
  }
  res
    .status(500)
    .json(publicError('SERVER_ERROR', 'The CRM request could not be completed.', req.traceId));
}

function getCookie(req: Request, name: string) {
  const header = req.header('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (rawName === name) return decodeURIComponent(rawValue.join('='));
  }
  return undefined;
}

function setAuthCookies(res: Response, config: AppConfig, sessionToken: string, csrfToken: string) {
  res.cookie(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 8 * 60 * 60 * 1000,
  });
  setCsrfCookie(res, config, csrfToken);
}

function setCsrfCookie(res: Response, config: AppConfig, csrfToken: string) {
  res.cookie(CSRF_COOKIE, csrfToken, {
    httpOnly: false,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 8 * 60 * 60 * 1000,
  });
}

function clearAuthCookies(res: Response, config: AppConfig) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/',
  });
  res.clearCookie(CSRF_COOKIE, {
    httpOnly: false,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/',
  });
}

function setPrivateNoStore(res: Response) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.removeHeader('ETag');
  res.removeHeader('Last-Modified');
}

function safeReturnPath(value: string | undefined, config: AppConfig) {
  if (!value) return null;
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f || char === '\\') return null;
  }
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (value.toLowerCase().includes('%5c')) return null;
  try {
    const origin = new URL(config.publicBaseUrl).origin;
    const parsed = new URL(value, origin);
    if (parsed.origin !== origin) return null;
    if (parsed.pathname.startsWith('/api/')) return null;
    const canonical = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (!canonical.startsWith('/') || canonical.startsWith('//')) return null;
    return canonical;
  } catch {
    return null;
  }
}

function loginPageHtml(csrfToken: string, returnTo: string) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Login | One Time Mishnayos</title>
  <meta name="robots" content="noindex, nofollow">
  <meta name="theme-color" content="#050505">
  <link rel="stylesheet" href="/assets/public.css">
</head>
<body>
  <main class="login-page">
    <section class="login-panel">
      <a class="brand-lockup login-brand" href="/" aria-label="One Time Mishnayos home">
        <img src="/assets/brand/onetimelogo.webp" width="56" height="56" alt="" aria-hidden="true">
        <span><strong>One Time Mishnayos</strong><small>CRM</small></span>
      </a>
      <h1>Login</h1>
      <form class="login-form" data-login-form novalidate>
        <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}">
        <input type="hidden" name="return_to" value="${escapeHtml(returnTo)}">
        <div class="field">
          <label for="email">Email</label>
          <input id="email" name="email" type="email" autocomplete="username" required>
          <p tabindex="-1" class="error" data-error-for="email"></p>
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required>
          <p tabindex="-1" class="error" data-error-for="password"></p>
        </div>
        <button class="button button-primary" type="submit">Login</button>
        <p class="form-status" role="status" data-form-status></p>
      </form>
    </section>
  </main>
  <script type="module" src="/assets/public.js"></script>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
