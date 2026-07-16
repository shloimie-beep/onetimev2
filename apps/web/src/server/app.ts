import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import helmet from 'helmet';
import { ZodError } from 'zod';
import type { AppConfig } from '../../../../packages/config/src/index.ts';
import { asBotKey } from '../../../../packages/contracts/src/telegram/types.ts';
import type { DbPool } from '../../../../packages/db/src/index.ts';
import { createClassroomRepository } from '../../../../packages/db/src/classroom/repository.ts';
import { createPortalRepository } from '../../../../packages/db/src/portals/repository.ts';
import { TelegramSqlInboxRepository } from '../../../../packages/db/src/telegram/repositories.ts';
import {
  classroomAttendanceEventPayloadSchema,
  classroomLaunchBootstrapPayloadSchema,
  classroomLaunchBootstrapResponseSchema,
  classroomQuestionListResponseSchema,
  classroomQuestionSubmitPayloadSchema,
  classroomQuestionSubmitResponseSchema,
  contactListQuerySchema,
  contactListResponseSchema,
  contactResponseSchema,
  contentLibraryDetailResponseSchema,
  contentLibraryListQuerySchema,
  contentLibraryListResponseSchema,
  contentOutcomeAdmissionResponseSchema,
  contentOutcomePayloadSchema,
  createContactSchema,
  ownerDashboardResponseSchema,
  leadPayloadSchema,
  loginPayloadSchema,
  mfaChallengePayloadSchema,
  mfaEnrollmentPayloadSchema,
  mfaRecoveryPayloadSchema,
  publicFieldErrors,
  updateContactSchema,
  assigneeListResponseSchema,
  classOccurrenceDetailResponseSchema,
  classOccurrenceListQuerySchema,
  classOccurrenceListResponseSchema,
} from '../../../../packages/contracts/src/index.ts';
import type {
  PortalActorContext,
  PortalCapability,
} from '../../../../packages/contracts/src/portals/index.ts';
import {
  CrmDuplicateError,
  CrmVersionConflictError,
  ContentIdempotencyConflictError,
  IdempotencyConflictError,
  activateTotpEnrollment,
  admitContentOutcome,
  authenticateUser,
  canEditContacts,
  captureLead,
  createAccountLifecycleCredentialAdapter,
  createContact,
  createClassPortalAccessAdapter,
  createClassroomPortalAccessAdapter,
  createClassroomService,
  createContentPortalAccessAdapter,
  createLoginCsrf,
  createParentPortalService,
  createSession,
  consumeWhatsAppAccountLink,
  createStudentPortalService,
  getClassOccurrenceDetail,
  getContentItemDetail,
  getContactDetail,
  getSessionByToken,
  buildOwnerDashboard,
  listClassOccurrences,
  listContentLibrary,
  listAssignableUsers,
  listContacts,
  ownerAdminVisibleActions,
  replaceMfaRecoveryCodes,
  revokeMfaFactors,
  revokeSession,
  rotateSessionCsrf,
  receiveWhatsAppWebhook,
  updateContact,
  verifyLoginCsrf,
  verifyMfaChallenge,
  verifyMfaRecoveryChallenge,
  verifySessionCsrf,
  verifyWhatsAppWebhookChallenge,
  type AuthenticatedSession,
  PortalServiceError,
  type PortalServiceDeps,
} from '../../../../packages/domain/src/index.ts';
import { AesGcmPayloadCodec } from '../../../../packages/domain/src/telegram/crypto.ts';
import { createTelegramWebhookHandler } from '../../../../apps/telegram-bot/src/ingress.ts';
import {
  exposeServerTiming,
  publicError,
  traceMiddleware,
  withTiming,
  type RequestWithTrace,
} from '../../../../packages/observability/src/index.ts';
import {
  registerCommunicationsRoutes,
  type ReadOnlySessionScopePort,
} from './communications/register.ts';
import { createParentPortalRouter, createStudentPortalRouter } from './features/portals/routers.ts';
import { registerSupportRoutes } from './features/support/router.ts';
import { leadRateLimit } from './rate-limit.ts';

type AppDeps = {
  config: AppConfig;
  pool: DbPool;
  distDir?: string;
  clock?: () => Date;
};

const SESSION_COOKIE = 'otcrm_session';
const CSRF_COOKIE = 'otcrm_csrf';

export function createApp({
  config,
  pool,
  distDir = path.resolve(process.cwd(), 'dist/apps/web/public'),
  clock,
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
  if (config.oneTimeTelegramWebhookEnabled) {
    const telegramWebhook = createTelegramWebhookHandler({
      botKey: asBotKey(config.oneTimeTelegramBotKey),
      environment: config.oneTimeTelegramEnvironment,
      secretToken: config.oneTimeTelegramWebhookSecret ?? '',
      contentType: 'application/json',
      maxBytes: 32 * 1024,
      maxDepth: 12,
      maxStringLength: 1000,
      maxArrayLength: 32,
      inbox: new TelegramSqlInboxRepository(pool),
      codec: new AesGcmPayloadCodec(`${config.mfaSecretEncryptionKey}:telegram-payload-v1`),
    });
    app.post('/api/v1/telegram/one-time/webhook', (req, res) => {
      void telegramWebhook(req, res).catch(() => {
        if (!res.headersSent) res.status(500).json({ ok: false });
      });
    });
  }

  app.get('/api/v1/whatsapp/meta/webhook', (req, res) => {
    const challenge = verifyWhatsAppWebhookChallenge(config, req.query);
    if (!challenge) {
      res.status(403).json(publicError('INVALID_VERIFY_TOKEN', 'Webhook verification failed.'));
      return;
    }
    res.status(200).type('text/plain').send(challenge);
  });

  app.post(
    '/api/v1/whatsapp/meta/webhook',
    express.raw({ type: '*/*', limit: '128kb' }),
    async (req: RequestWithTrace, res) => {
      const result = await withTiming(req, 'whatsapp_webhook', () =>
        receiveWhatsAppWebhook({
          pool,
          config,
          rawBody: req.body,
          signatureHeader: req.header('x-hub-signature-256') ?? undefined,
        }),
      );
      res.status(result.status).json({
        success: result.ok,
        code: result.code,
        accepted: result.accepted,
        duplicates: result.duplicates,
        processed: result.processed,
        request_id: req.traceId,
      });
    },
  );

  registerSupportRoutes({
    app,
    config,
    pool,
    session: {
      sessionFromRequest: (req) => sessionFromRequest(req, pool, config),
      ensureSessionCsrfCookie: (req, res, session) =>
        ensureSessionCsrfCookie(req, res, pool, config, session),
      requireSessionCsrf: (req, res, session) => requireSessionCsrf(req, res, pool, session),
      setPrivateNoStore,
    },
  });
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
    await sendAppHtml(res, distDir, 'crm');
  });

  app.get(
    /^\/app\/(?:dashboard|classes|content|billing)(?:\/.*)?$/,
    async (req: RequestWithTrace, res) => {
      const session = await sessionFromRequest(req, pool, config);
      if (!session) {
        res.redirect(
          302,
          `/login?return_to=${encodeURIComponent(
            safeReturnPath(req.path, config) ?? '/app/dashboard',
          )}`,
        );
        return;
      }
      if (!canUseOwnerDashboard(session.user.role)) {
        setPrivateNoStore(res);
        res.status(403).type('html').send(forbiddenOwnerAdminHtml(req.path));
        return;
      }
      await ensureSessionCsrfCookie(req, res, pool, config, session);
      setPrivateNoStore(res);
      await sendAppHtml(res, distDir, 'crm');
    },
  );

  app.get(/^\/app\/parent(?:\/.*)?$/, async (req: RequestWithTrace, res) => {
    await serveProtectedAppShell(req, res, {
      pool,
      config,
      distDir,
      appPage: 'parent',
      allowedRoles: ['parent'],
      fallbackPath: '/app/parent',
    });
  });

  app.get(/^\/app\/student(?:\/.*)?$/, async (req: RequestWithTrace, res) => {
    await serveProtectedAppShell(req, res, {
      pool,
      config,
      distDir,
      appPage: 'student',
      allowedRoles: ['student'],
      fallbackPath: '/app/student',
    });
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

  app.post('/api/v1/whatsapp/account-link/consume', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!(await requireSessionCsrf(req, res, pool, session))) return;
    const linkToken = typeof req.body?.link_token === 'string' ? req.body.link_token.trim() : '';
    const householdKey =
      typeof req.body?.household_key === 'string' ? req.body.household_key.trim() : '';
    if (!linkToken || !householdKey) {
      res
        .status(400)
        .json(publicError('VALIDATION_ERROR', 'Submit a link token and household.', req.traceId));
      return;
    }
    const result = await withTiming(req, 'whatsapp_account_link', () =>
      consumeWhatsAppAccountLink({ pool, config, session, linkToken, householdKey }),
    );
    res
      .status(result.ok ? 200 : 403)
      .json({ success: result.ok, ...result, request_id: req.traceId });
  });

  app.get('/api/v1/dashboard/owner', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!canUseOwnerDashboard(session.user.role)) {
      res
        .status(403)
        .json(publicError('FORBIDDEN', 'Your role cannot view the dashboard.', req.traceId));
      return;
    }
    try {
      const dashboard = await withTiming(req, 'dashboard', () =>
        buildOwnerDashboard({ pool, config, session }),
      );
      res.json(
        ownerDashboardResponseSchema.parse({
          success: true,
          dashboard,
          actions: ownerAdminVisibleActions(),
        }),
      );
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  const portalRepository = createPortalRepository(pool);
  const classroomRepository = createClassroomRepository(pool);
  const classroomService = createClassroomService({
    config,
    repository: classroomRepository,
    questionCodec: new AesGcmPayloadCodec(`${config.mfaSecretEncryptionKey}:classroom-question-v1`),
    ...(clock ? { clock } : {}),
  });
  const portalServiceDeps: PortalServiceDeps = {
    repository: portalRepository,
    classAccess: config.zoomClassroomEnabled
      ? createClassroomPortalAccessAdapter({ classroom: classroomService })
      : createClassPortalAccessAdapter({ pool, config }),
    contentAccess: createContentPortalAccessAdapter({ pool, config }),
    credentialLifecycle: createAccountLifecycleCredentialAdapter({ pool, config }),
    progress: createPortalProgressAdapter(pool),
  };
  const resolvePortalActor = (req: Request) => portalActorFromRequest(req, pool, config);
  const verifyPortalCsrf = (req: Request, actor: PortalActorContext) =>
    isSameOriginPost(req, config) &&
    verifySessionCsrf({
      pool,
      sessionKey: actor.session_key,
      csrfToken: req.header('x-csrf-token') ?? req.body?.csrf_token,
    });

  app.get('/classroom/launch/:grantKey/:secret', async (req: RequestWithTrace, res) => {
    const session = await sessionFromRequest(req, pool, config);
    if (!session) {
      res.redirect(302, '/login?return_to=%2Fapp%2Fstudent');
      return;
    }
    if (session.user.role !== 'student') {
      setPrivateNoStore(res);
      res.status(403).type('html').send(forbiddenAppHtml('student'));
      return;
    }
    await ensureSessionCsrfCookie(req, res, pool, config, session);
    setPrivateNoStore(res);
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), fullscreen=(self)');
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "img-src 'self' data:",
        "script-src 'self'",
        "style-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
      ].join('; '),
    );
    res.status(200).type('html').send(classroomLaunchHtml());
  });

  app.post('/api/v1/classroom/launch/bootstrap', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!requireSameOriginPost(req, res, config)) return;
    if (!(await requireSessionCsrf(req, res, pool, session))) return;
    const actor = await resolvePortalActor(req);
    if (!actor) {
      res.status(401).json(publicError('UNAUTHENTICATED', 'Please log in again.', req.traceId));
      return;
    }
    try {
      const payload = classroomLaunchBootstrapPayloadSchema.parse(req.body);
      const bootstrap = await classroomService.consumeLaunch({ actor, payload });
      res.json({
        success: true,
        data: classroomLaunchBootstrapResponseSchema.parse(bootstrap),
      });
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.post('/api/v1/classroom/attendance', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!requireSameOriginPost(req, res, config)) return;
    if (!(await requireSessionCsrf(req, res, pool, session))) return;
    const actor = await resolvePortalActor(req);
    if (!actor) {
      res.status(401).json(publicError('UNAUTHENTICATED', 'Please log in again.', req.traceId));
      return;
    }
    try {
      const payload = classroomAttendanceEventPayloadSchema.parse(req.body);
      await classroomService.recordAttendance(actor, payload);
      res.json({ success: true });
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.post('/api/v1/classroom/questions', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!requireSameOriginPost(req, res, config)) return;
    if (!(await requireSessionCsrf(req, res, pool, session))) return;
    const actor = await resolvePortalActor(req);
    if (!actor) {
      res.status(401).json(publicError('UNAUTHENTICATED', 'Please log in again.', req.traceId));
      return;
    }
    try {
      const payload = classroomQuestionSubmitPayloadSchema.parse(req.body);
      const result = await classroomService.submitQuestion(actor, payload);
      res
        .status(201)
        .json({ success: true, data: classroomQuestionSubmitResponseSchema.parse(result) });
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.get('/api/v1/classroom/questions', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    const actor = await resolvePortalActor(req);
    if (!actor) {
      res.status(401).json(publicError('UNAUTHENTICATED', 'Please log in again.', req.traceId));
      return;
    }
    try {
      const occurrenceKey = String(req.query.occurrence_key ?? '');
      const questions = await classroomService.listOwnQuestions(actor, occurrenceKey);
      res.json({
        success: true,
        data: classroomQuestionListResponseSchema.parse({ questions }),
      });
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.use(
    '/api/v1/portals/parent',
    createParentPortalRouter({
      resolveActor: resolvePortalActor,
      verifyCsrf: verifyPortalCsrf,
      service: createParentPortalService(portalServiceDeps),
    }),
  );
  app.use(
    '/api/v1/portals/student',
    createStudentPortalRouter({
      resolveActor: resolvePortalActor,
      verifyCsrf: verifyPortalCsrf,
      service: createStudentPortalService(portalServiceDeps),
    }),
  );

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

  app.get('/api/v1/classes', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!canReadClasses(session.user.role)) {
      res.status(403).json(publicError('FORBIDDEN', 'Your role cannot view classes.', req.traceId));
      return;
    }
    try {
      const query = classOccurrenceListQuerySchema.parse(req.query);
      const occurrences = await withTiming(req, 'db', () =>
        listClassOccurrences({ pool, config, limit: query.limit }),
      );
      res.json(
        classOccurrenceListResponseSchema.parse({
          success: true,
          occurrences,
          next_cursor: null,
        }),
      );
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.get('/api/v1/classes/:occurrenceKey', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!canReadClasses(session.user.role)) {
      res.status(403).json(publicError('FORBIDDEN', 'Your role cannot view classes.', req.traceId));
      return;
    }
    try {
      const occurrence = await withTiming(req, 'db', () =>
        getClassOccurrenceDetail({
          pool,
          config,
          occurrenceKey: String(req.params.occurrenceKey),
        }),
      );
      if (!occurrence) {
        res
          .status(404)
          .json(publicError('NOT_FOUND', 'Class occurrence was not found.', req.traceId));
        return;
      }
      res.json(classOccurrenceDetailResponseSchema.parse({ success: true, occurrence }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.get('/api/v1/content/library', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!canReadContentLibrary(session.user.role)) {
      res.status(403).json(publicError('FORBIDDEN', 'Your role cannot view content.', req.traceId));
      return;
    }
    try {
      const query = contentLibraryListQuerySchema.parse(req.query);
      const items = await withTiming(req, 'db', () => listContentLibrary({ pool, config, query }));
      res.json(contentLibraryListResponseSchema.parse({ success: true, items, next_cursor: null }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.get('/api/v1/content/library/:itemKey', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!canReadContentLibrary(session.user.role)) {
      res.status(403).json(publicError('FORBIDDEN', 'Your role cannot view content.', req.traceId));
      return;
    }
    try {
      const item = await withTiming(req, 'db', () =>
        getContentItemDetail({ pool, config, itemKey: String(req.params.itemKey) }),
      );
      if (!item) {
        res.status(404).json(publicError('NOT_FOUND', 'Content item was not found.', req.traceId));
        return;
      }
      res.json(contentLibraryDetailResponseSchema.parse({ success: true, item }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.post('/api/v1/content/outcomes', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!canReadContentLibrary(session.user.role)) {
      res
        .status(403)
        .json(publicError('FORBIDDEN', 'Your role cannot admit content.', req.traceId));
      return;
    }
    if (!(await requireSessionCsrf(req, res, pool, session))) return;
    try {
      const payload = contentOutcomePayloadSchema.parse(req.body);
      const outcome = await withTiming(req, 'db', () =>
        admitContentOutcome({
          pool,
          config,
          payload,
          actorUserKey: session.user.user_key,
        }),
      );
      res.status(202).json(contentOutcomeAdmissionResponseSchema.parse({ success: true, outcome }));
    } catch (error) {
      handleApiError(error, req, res);
    }
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

  const communicationsSessionPort: ReadOnlySessionScopePort = {
    resolve: (req) => readOnlyCommunicationsSession(req, pool, config),
  };
  registerCommunicationsRoutes({
    app,
    config,
    pool,
    sessionPort: communicationsSessionPort,
    cursorSecret: config.authCsrfSecret,
    distDir,
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

function requireSameOriginPost(req: RequestWithTrace, res: Response, config: AppConfig) {
  if (isSameOriginPost(req, config)) return true;
  res.status(403).json(publicError('FORBIDDEN', 'Refresh the page and try again.', req.traceId));
  return false;
}

function isSameOriginPost(req: Request, config: AppConfig) {
  const originHeader = req.header('origin');
  if (!originHeader) return true;
  try {
    const expected = new URL(config.publicBaseUrl).origin;
    return (
      new URL(originHeader).origin === expected || new URL(originHeader).host === req.header('host')
    );
  } catch {
    return false;
  }
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

async function serveProtectedAppShell(
  req: RequestWithTrace,
  res: Response,
  input: {
    pool: DbPool;
    config: AppConfig;
    distDir: string;
    appPage: 'parent' | 'student';
    allowedRoles: Array<AuthenticatedSession['user']['role']>;
    fallbackPath: string;
  },
) {
  const session = await sessionFromRequest(req, input.pool, input.config);
  if (!session) {
    res.redirect(
      302,
      `/login?return_to=${encodeURIComponent(
        safeReturnPath(req.path, input.config) ?? input.fallbackPath,
      )}`,
    );
    return;
  }
  if (!input.allowedRoles.includes(session.user.role)) {
    setPrivateNoStore(res);
    res.status(403).type('html').send(forbiddenAppHtml(input.appPage));
    return;
  }
  await ensureSessionCsrfCookie(req, res, input.pool, input.config, session);
  setPrivateNoStore(res);
  await sendAppHtml(res, input.distDir, input.appPage);
}

async function sendAppHtml(res: Response, distDir: string, appPage: 'crm' | 'parent' | 'student') {
  try {
    const html = await readFile(path.join(distDir, 'app', `${appPage}.html`), 'utf8');
    res.status(200).type('html').send(html);
  } catch {
    res
      .status(500)
      .type('text')
      .send(
        `Built ${appPage} app shell is unavailable. Run npm run build before serving protected app routes.`,
      );
  }
}

async function portalActorFromRequest(req: Request, pool: DbPool, config: AppConfig) {
  const session = await sessionFromRequest(req, pool, config);
  if (!session) return null;
  const [authorizedHouseholds, studentLearner] = await Promise.all([
    session.user.role === 'parent'
      ? parentHouseholdSubjects(pool, config, session.user.user_key)
      : Promise.resolve([]),
    session.user.role === 'student'
      ? studentLearnerSubject(pool, config, session.user.user_key)
      : Promise.resolve(null),
  ]);
  return {
    account_key: config.accountKey,
    product_key: config.productKey,
    actor_user_ref: session.user.user_key,
    actor_role: session.user.role,
    session_key: session.session_key,
    capabilities: capabilitiesForPortalRole(session.user.role),
    authorized_households: authorizedHouseholds,
    student_learner: studentLearner,
  } satisfies PortalActorContext;
}

async function parentHouseholdSubjects(pool: DbPool, config: AppConfig, userKey: string) {
  const result = await pool.query(
    `SELECT relationships.household_key, relationships.relationship_key,
            relationships.relationship_label, relationships.authority
       FROM onetime.portal_guardian_relationships AS relationships
       JOIN onetime.portal_households AS households
         ON households.account_key = relationships.account_key
        AND households.product_key = relationships.product_key
        AND households.household_key = relationships.household_key
      WHERE relationships.account_key = $1
        AND relationships.product_key = $2
        AND relationships.guardian_user_ref = $3
        AND relationships.status = 'active'
        AND households.status = 'active'
      ORDER BY CASE relationships.authority
          WHEN 'primary_guardian' THEN 0
          WHEN 'guardian' THEN 1
          ELSE 2
        END,
        relationships.created_at ASC,
        relationships.relationship_key ASC`,
    [config.accountKey, config.productKey, userKey],
  );
  return result.rows.map((row) => ({
    household_key: String(row.household_key),
    relationship_key: String(row.relationship_key),
    relationship_label: String(row.relationship_label),
    authority: row.authority as PortalActorContext['authorized_households'][number]['authority'],
  }));
}

async function studentLearnerSubject(pool: DbPool, config: AppConfig, userKey: string) {
  const result = await pool.query(
    `SELECT links.learner_key, links.household_key, access_state.access_state_key
       FROM onetime.account_learner_identity_links AS links
       JOIN onetime.portal_student_access_state AS access_state
         ON access_state.account_key = links.account_key
        AND access_state.product_key = links.product_key
        AND access_state.learner_key = links.learner_key
        AND access_state.student_user_ref = links.user_key
       JOIN onetime.portal_learners AS learners
         ON learners.account_key = links.account_key
        AND learners.product_key = links.product_key
        AND learners.learner_key = links.learner_key
      WHERE links.account_key = $1
        AND links.product_key = $2
        AND links.user_key = $3
        AND links.link_state = 'active'
        AND access_state.status = 'active'
        AND learners.learner_status = 'active'
      ORDER BY links.created_at ASC
      LIMIT 1`,
    [config.accountKey, config.productKey, userKey],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    learner_key: String(row.learner_key),
    household_key: String(row.household_key),
    access_state_key: String(row.access_state_key),
  };
}

function capabilitiesForPortalRole(role: AuthenticatedSession['user']['role']): PortalCapability[] {
  if (role === 'parent') {
    return [
      'parent:household:read',
      'parent:learner:create',
      'parent:learner:update',
      'parent:learner:archive',
      'parent:student-access:manage',
      'parent:class:launch',
      'parent:content:open',
      'parent:support:preview',
      'rewards:read',
      'helper:query',
    ];
  }
  if (role === 'student') {
    return [
      'student:dashboard:read',
      'student:class:launch',
      'student:content:open',
      'student:question:create',
      'student:class:question',
      'student:support:preview',
      'rewards:read',
      'helper:query',
    ];
  }
  return [];
}

function createPortalProgressAdapter(pool: DbPool): PortalServiceDeps['progress'] {
  return {
    progressForLearner: async ({ actor, learner }) => {
      const result = await pool.query(
        `SELECT
            COALESCE(sum(CASE WHEN attendance_state = 'present' THEN 1 ELSE 0 END), 0)::int
              AS attendance_count,
            max(recorded_at) AS last_activity_at
           FROM onetime.class_attendance_marks
          WHERE account_key = $1
            AND product_key = $2
            AND learner_key = $3`,
        [actor.account_key, actor.product_key, learner.learner_key],
      );
      const row = result.rows[0] as Record<string, unknown> | undefined;
      return {
        attendance_count: Number(row?.attendance_count ?? 0),
        watch_minutes: 0,
        completed_items: 0,
        last_activity_at: row?.last_activity_at ? toIso(row.last_activity_at) : null,
      };
    },
  };
}

async function readOnlyCommunicationsSession(req: Request, pool: DbPool, config: AppConfig) {
  const sessionToken = getCookie(req, SESSION_COOKIE);
  if (!sessionToken) return null;
  const result = await pool.query(
    `SELECT users.user_key, users.role
       FROM onetime.user_sessions AS sessions
       JOIN onetime.account_users AS users ON users.user_key = sessions.user_key
      WHERE sessions.account_key = $1
        AND sessions.product_key = $2
        AND sessions.token_hash = $3
        AND sessions.revoked_at IS NULL
        AND sessions.expires_at > now()
        AND sessions.security_version = users.security_version
        AND (sessions.user_agent_hash IS NULL OR sessions.user_agent_hash = $4)
        AND users.status = 'active'`,
    [
      config.accountKey,
      config.productKey,
      hashCookieValue(sessionToken),
      req.header('user-agent') ? hashCookieValue(String(req.header('user-agent'))) : null,
    ],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    accountKey: config.accountKey,
    productKey: config.productKey,
    userKey: String(row.user_key),
    role: String(row.role),
  };
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
  if (error instanceof ContentIdempotencyConflictError) {
    res.status(409).json({
      success: false,
      code: 'IDEMPOTENCY_CONFLICT',
      message: 'This content outcome key was already used for a different request.',
      request_id: req.traceId,
    });
    return;
  }
  if (error instanceof PortalServiceError) {
    res.status(statusForPortalError(error.code)).json({
      success: false,
      code: error.code,
      message: error.message,
      ...(error.currentVersion ? { current_version: error.currentVersion } : {}),
      request_id: req.traceId,
    });
    return;
  }
  res
    .status(500)
    .json(publicError('SERVER_ERROR', 'The CRM request could not be completed.', req.traceId));
}

function statusForPortalError(code: string) {
  if (code === 'UNAUTHENTICATED') return 401;
  if (code === 'FORBIDDEN' || code === 'CSRF_REQUIRED') return 403;
  if (code === 'NOT_FOUND') return 404;
  if (code === 'VALIDATION_ERROR') return 400;
  if (
    code === 'IDEMPOTENCY_CONFLICT' ||
    code === 'VERSION_CONFLICT' ||
    code === 'LEARNER_LIMIT_REACHED' ||
    code === 'ENTITLEMENT_REQUIRED' ||
    code === 'CONSENT_REQUIRED'
  ) {
    return 409;
  }
  if (code === 'OCCURRENCE_UNAVAILABLE' || code === 'LAUNCH_EXPIRED') return 410;
  if (code === 'ADAPTER_UNAVAILABLE') return 503;
  return 500;
}

function canReadClasses(role: string) {
  return role === 'owner' || role === 'admin';
}

function canReadContentLibrary(role: string) {
  return role === 'owner' || role === 'admin';
}

function canUseOwnerDashboard(role: string) {
  return role === 'owner' || role === 'admin';
}

function hashCookieValue(value: string) {
  return createHash('sha256').update(value).digest('hex');
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

function toIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
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

function forbiddenAppHtml(appPage: 'parent' | 'student') {
  const label = appPage === 'parent' ? 'Parent Portal' : 'Student Portal';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Access unavailable | One Time Mishnayos</title>
  <meta name="robots" content="noindex, nofollow">
  <meta name="theme-color" content="#050505">
  <link rel="stylesheet" href="/assets/app-crm.css">
</head>
<body>
  <main class="app-workspace">
    <section class="state-panel error" aria-labelledby="portal-forbidden-title">
      <h1 id="portal-forbidden-title">${escapeHtml(label)} access unavailable</h1>
      <p>This signed-in account cannot open that protected portal.</p>
      <a class="button-primary" href="/login?return_to=${encodeURIComponent(`/app/${appPage}`)}">Sign in</a>
    </section>
  </main>
</body>
</html>`;
}

function forbiddenOwnerAdminHtml(requestPath: string) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Access unavailable | One Time Mishnayos</title>
  <meta name="robots" content="noindex, nofollow">
  <meta name="theme-color" content="#050505">
  <link rel="stylesheet" href="/assets/app-crm.css">
</head>
<body>
  <main class="app-workspace">
    <section class="state-panel error" aria-labelledby="dashboard-forbidden-title">
      <h1 id="dashboard-forbidden-title">Owner dashboard access unavailable</h1>
      <p>This signed-in account cannot open the owner/admin shell.</p>
      <a class="button-primary" href="/login?return_to=${encodeURIComponent(
        requestPath,
      )}">Sign in</a>
    </section>
  </main>
</body>
</html>`;
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

function classroomLaunchHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <meta name="referrer" content="no-referrer">
  <meta name="theme-color" content="#050505">
  <title>Classroom | One Time Mishnayos</title>
  <link rel="stylesheet" href="/assets/app-crm.css">
</head>
<body>
  <main class="app-workspace classroom-launch-page">
    <section class="state-panel" aria-labelledby="classroom-launch-title">
      <h1 id="classroom-launch-title">Classroom</h1>
      <p data-classroom-status role="status">Opening protected classroom.</p>
      <div data-classroom-sdk-root aria-live="polite"></div>
      <button class="button button-primary" type="button" data-classroom-retry hidden>Retry</button>
      <button class="button" type="button" data-classroom-leave hidden>Leave</button>
    </section>
  </main>
  <script type="module" src="/assets/app-classroom-launch.js"></script>
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
