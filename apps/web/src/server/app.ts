import path from 'node:path';
import express, { type Request, type Response } from 'express';
import helmet from 'helmet';
import { ZodError } from 'zod';
import type { AppConfig } from '../../../../packages/config/src/index.ts';
import type { DbPool } from '../../../../packages/db/src/index.ts';
import {
  contactListQuerySchema,
  createContactSchema,
  leadPayloadSchema,
  loginPayloadSchema,
  mfaVerifyPayloadSchema,
  publicFieldErrors,
  updateContactSchema,
} from '../../../../packages/contracts/src/index.ts';
import { contactSearchBodySchema } from '../../../../packages/contracts/src/search.ts';
import {
  CrmAssigneeScopeError,
  CrmCursorError,
  CrmDuplicateError,
  CrmIdempotencyConflictError,
  CrmVersionConflictError,
  LeadDuplicateIdentityError,
  LeadIdempotencyConflictError,
  PhoneNormalizationError,
  authenticateUser,
  canEditContacts,
  captureLead,
  completeMfaChallenge,
  createLoginCsrf,
  createContact,
  createSession,
  getContactDetail,
  getSessionByToken,
  listContacts,
  revokeSession,
  rotateSessionCsrf,
  updateContact,
  verifyLoginCsrf,
  verifySessionCsrf,
  type AuthenticatedSession,
} from '../../../../packages/domain/src/index.ts';
import {
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
  app.set('trust proxy', true);
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
  app.use(['/login', '/api/v1/auth', '/api/v1/crm'], (_req, res, next) => {
    setNoStore(res);
    next();
  });

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
    res
      .status(200)
      .type('html')
      .send(
        loginPageHtml(
          csrf.csrf_token,
          safeReturnPath(String(req.query.return_to ?? '')) ?? '/app/crm',
        ),
      );
  });

  app.get(/^\/app\/crm(?:\/.*)?$/, async (req: RequestWithTrace, res) => {
    const session = await sessionFromRequest(req, pool, config);
    if (!session) {
      res.redirect(
        302,
        `/login?return_to=${encodeURIComponent(safeReturnPath(req.path) ?? '/app/crm')}`,
      );
      return;
    }
    await ensureSessionCsrfCookie(req, res, pool, config, session);
    res.setHeader('Cache-Control', 'no-store');
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
      if (error instanceof PhoneNormalizationError) {
        res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Please check the signup form.',
          field_errors: {
            phone: 'Include the country code, such as +1 or +972, or leave phone blank.',
          },
          request_id: req.traceId,
        });
        return;
      }
      if (error instanceof LeadIdempotencyConflictError) {
        res
          .status(409)
          .json(
            publicError(
              'IDEMPOTENCY_CONFLICT',
              'This signup request key was already used for different information.',
              req.traceId,
            ),
          );
        return;
      }
      if (error instanceof LeadDuplicateIdentityError) {
        res
          .status(409)
          .json(
            publicError(
              'DUPLICATE_IDENTITY',
              'We could not save that signup automatically. Please contact the office.',
              req.traceId,
            ),
          );
        return;
      }
      res
        .status(500)
        .json(publicError('SERVER_ERROR', 'We could not save that signup yet.', req.traceId));
    }
  };

  app.post('/api/v1/leads', leadRateLimit(config), handleLeadPost);
  app.post('/api/one-time/interest', leadRateLimit(config), handleLeadPost);

  app.post('/api/v1/auth/login', async (req: RequestWithTrace, res) => {
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
        if (login.code === 'MFA_REQUIRED' || login.code === 'MFA_ENROLLMENT_REQUIRED') {
          res.status(200).json({
            success: true,
            mfa_required: true,
            mfa_mode: login.code === 'MFA_ENROLLMENT_REQUIRED' ? 'enroll' : 'challenge',
            pre_auth_token: login.pre_auth_token,
            expires_at: login.expires_at,
            enrollment: login.enrollment,
            return_to: safeReturnPath(payload.return_to) ?? '/app/crm',
          });
          return;
        }
        const status =
          login.code === 'RATE_LIMITED' ? 429 : login.code === 'MFA_CONFIG_REQUIRED' ? 503 : 401;
        if (login.retry_after_seconds)
          res.setHeader('retry-after', String(login.retry_after_seconds));
        res.status(status).json({
          success: false,
          code: login.code,
          message:
            login.code === 'MFA_CONFIG_REQUIRED'
              ? 'Administrator login is temporarily unavailable.'
              : 'Email or password is not correct.',
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
      setAuthCookies(res, config, session.session_token, session.csrf_cookie);
      res.status(200).json({
        success: true,
        mfa_required: false,
        user: session.user,
        csrf_token: session.csrf_token,
        return_to: safeReturnPath(payload.return_to) ?? '/app/crm',
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

  app.post('/api/v1/auth/mfa/verify', async (req: RequestWithTrace, res) => {
    try {
      const payload = mfaVerifyPayloadSchema.parse(req.body);
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
      const result = await withTiming(req, 'db', () =>
        completeMfaChallenge({
          pool,
          config,
          preAuthToken: payload.pre_auth_token,
          totpCode: payload.totp_code,
          recoveryCode: payload.recovery_code,
          ip: req.ip,
          userAgent: req.header('user-agent') ?? undefined,
        }),
      );
      if (!result.ok) {
        const status =
          result.code === 'RATE_LIMITED' ? 429 : result.code === 'MFA_EXPIRED' ? 410 : 401;
        if (result.retry_after_seconds)
          res.setHeader('retry-after', String(result.retry_after_seconds));
        res.status(status).json({
          success: false,
          code: result.code,
          message: 'The verification code is not correct.',
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
          user: result.user,
          ip: req.ip,
          userAgent: req.header('user-agent') ?? undefined,
          rotatedFromSessionKey: rotatedFromSessionKey ?? undefined,
        }),
      );
      setAuthCookies(res, config, session.session_token, session.csrf_cookie);
      res.status(200).json({
        success: true,
        user: session.user,
        csrf_token: session.csrf_token,
        recovery_codes: result.recovery_codes,
        return_to: safeReturnPath(payload.return_to) ?? '/app/crm',
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Please check the verification form.',
          field_errors: publicFieldErrors(error),
          request_id: req.traceId,
        });
        return;
      }
      res
        .status(500)
        .json(
          publicError('SERVER_ERROR', 'MFA verification is unavailable right now.', req.traceId),
        );
    }
  });

  app.post('/api/v1/auth/logout', async (req: RequestWithTrace, res) => {
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!(await requireSessionCsrf(req, res, pool, config, session))) return;
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
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    const csrfToken = await ensureSessionCsrfCookie(req, res, pool, config, session);
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      authenticated: true,
      user: session.user,
      csrf_token: csrfToken,
      expires_at: session.expires_at,
    });
  });

  app.get('/api/v1/crm/contacts', async (req: RequestWithTrace, res) => {
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      res
        .status(400)
        .json(publicError('SEARCH_REQUIRES_POST', 'Use the contact search endpoint.', req.traceId));
      return;
    }
    try {
      const query = contactListQuerySchema.parse(req.query);
      const result = await withTiming(req, 'db', () => listContacts({ pool, config, query }));
      res.json({ success: true, ...result });
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.post('/api/v1/crm/contacts/search', async (req: RequestWithTrace, res) => {
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!(await requireSessionCsrf(req, res, pool, config, session))) return;
    try {
      const query = contactSearchBodySchema.parse(req.body);
      const result = await withTiming(req, 'db', () => listContacts({ pool, config, query }));
      res.json({ success: true, ...result });
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.post('/api/v1/crm/contacts', async (req: RequestWithTrace, res) => {
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!canEditContacts(session.user.role)) {
      res
        .status(403)
        .json(publicError('FORBIDDEN', 'Your role can view CRM contacts only.', req.traceId));
      return;
    }
    if (!(await requireSessionCsrf(req, res, pool, config, session))) return;
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
      res.status(201).json({ success: true, contact });
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.get('/api/v1/crm/contacts/:contactId', async (req: RequestWithTrace, res) => {
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
    res.json({ success: true, contact });
  });

  app.patch('/api/v1/crm/contacts/:contactId', async (req: RequestWithTrace, res) => {
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!canEditContacts(session.user.role)) {
      res
        .status(403)
        .json(publicError('FORBIDDEN', 'Your role can view CRM contacts only.', req.traceId));
      return;
    }
    if (!(await requireSessionCsrf(req, res, pool, config, session))) return;
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
      res.json({ success: true, contact });
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
    res.status(401).json(publicError('UNAUTHENTICATED', 'Please log in again.', req.traceId));
    return null;
  }
  return session;
}

async function requireSessionCsrf(
  req: RequestWithTrace,
  res: Response,
  pool: DbPool,
  config: AppConfig,
  session: AuthenticatedSession,
) {
  const csrfToken = req.header('x-csrf-token') ?? req.body?.csrf_token;
  const valid = await verifySessionCsrf({
    pool,
    config,
    sessionKey: session.session_key,
    csrfCookie: getCookie(req, CSRF_COOKIE),
    csrfToken,
  });
  if (!valid) {
    res
      .status(403)
      .json(publicError('CSRF_REQUIRED', 'Refresh the page and try again.', req.traceId));
    return false;
  }
  return true;
}

async function sessionFromRequest(req: Request, pool: DbPool, config: AppConfig) {
  return getSessionByToken({ pool, config, sessionToken: getCookie(req, SESSION_COOKIE) });
}

async function ensureSessionCsrfCookie(
  req: Request,
  res: Response,
  pool: DbPool,
  config: AppConfig,
  session: AuthenticatedSession,
) {
  const next = await rotateSessionCsrf({ pool, config, session });
  setCsrfCookie(res, config, next.csrf_cookie);
  return next.csrf_token;
}

function handleApiError(error: unknown, req: RequestWithTrace, res: Response) {
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
  if (error instanceof CrmIdempotencyConflictError) {
    res.status(409).json({
      success: false,
      code: 'IDEMPOTENCY_CONFLICT',
      message: 'This create request key was already used for different information.',
      request_id: req.traceId,
    });
    return;
  }
  if (error instanceof CrmCursorError) {
    res.status(400).json({
      success: false,
      code: 'INVALID_CURSOR',
      message: 'Reload the CRM list and try again.',
      request_id: req.traceId,
    });
    return;
  }
  if (error instanceof CrmAssigneeScopeError) {
    res.status(400).json({
      success: false,
      code: 'INVALID_ASSIGNEE',
      message: 'Choose an active team member for this account.',
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

function setAuthCookies(
  res: Response,
  config: AppConfig,
  sessionToken: string,
  csrfCookie: string,
) {
  res.cookie(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 8 * 60 * 60 * 1000,
  });
  setCsrfCookie(res, config, csrfCookie);
}

function setCsrfCookie(res: Response, config: AppConfig, csrfToken: string) {
  res.cookie(CSRF_COOKIE, csrfToken, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 8 * 60 * 60 * 1000,
  });
}

function setNoStore(res: Response) {
  res.setHeader('Cache-Control', 'no-store');
}

function clearAuthCookies(res: Response, config: AppConfig) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/',
  });
  res.clearCookie(CSRF_COOKIE, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/',
  });
}

function safeReturnPath(value?: string) {
  if (!value || value.length > 240) return null;
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (char === '\\' || code <= 31 || code === 127) return null;
  }
  if (/%2f|%5c/i.test(value)) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (
    !decoded.startsWith('/') ||
    decoded.startsWith('//') ||
    decoded.includes('://') ||
    decoded.startsWith('/api/') ||
    decoded === '/login' ||
    decoded.startsWith('/login?')
  ) {
    return null;
  }
  if (!decoded.startsWith('/app/')) return '/app/crm';
  return decoded;
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
      <form class="login-form" data-mfa-form hidden novalidate>
        <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}">
        <input type="hidden" name="return_to" value="${escapeHtml(returnTo)}">
        <input type="hidden" name="pre_auth_token" value="">
        <div class="field" data-mfa-enrollment hidden>
          <label for="otpauth_uri">Authenticator setup URI</label>
          <textarea id="otpauth_uri" readonly rows="4"></textarea>
          <p class="help">Add this account in your authenticator app, then enter the 6-digit code.</p>
        </div>
        <div class="field">
          <label for="totp_code">Authenticator code</label>
          <input id="totp_code" name="totp_code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}">
          <p tabindex="-1" class="error" data-error-for="totp_code"></p>
        </div>
        <div class="field">
          <label for="recovery_code">Recovery code</label>
          <input id="recovery_code" name="recovery_code" autocomplete="one-time-code">
          <p tabindex="-1" class="error" data-error-for="recovery_code"></p>
        </div>
        <button class="button button-primary" type="submit">Verify</button>
        <p class="form-status" role="status" data-mfa-status></p>
        <div class="field" data-recovery-codes hidden>
          <label for="recovery_codes">Recovery codes</label>
          <textarea id="recovery_codes" readonly rows="6"></textarea>
        </div>
        <button class="button button-secondary" type="button" data-recovery-continue hidden>Continue</button>
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
