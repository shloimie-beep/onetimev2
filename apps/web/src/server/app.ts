import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import helmet from 'helmet';
import { z, ZodError } from 'zod';
import type { AppConfig } from '../../../../packages/config/src/index.ts';
import { asBotKey } from '../../../../packages/contracts/src/telegram/types.ts';
import type { DbPool } from '../../../../packages/db/src/index.ts';
import { createPostgresBillingRepositories } from '../../../../packages/db/src/billing/repository.ts';
import { createClassroomRepository } from '../../../../packages/db/src/classroom/repository.ts';
import { createGamificationRepository } from '../../../../packages/db/src/gamification/repository.ts';
import { createPortalRepository } from '../../../../packages/db/src/portals/repository.ts';
import { TelegramSqlInboxRepository } from '../../../../packages/db/src/telegram/repositories.ts';
import type { BillingProviderAdapter } from '../../../../packages/contracts/src/billing/index.ts';
import {
  accountLifecycleTokenTypeSchema,
  passwordResetRequestPayloadSchema,
  tokenCompletionPayloadSchema,
} from '../../../../packages/contracts/src/accounts/index.ts';
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
  publicFieldErrors,
  updateContactSchema,
  assigneeListResponseSchema,
  classOccurrenceDetailResponseSchema,
  classOccurrenceListQuerySchema,
  classOccurrenceListResponseSchema,
  contentAdminActionPayloadSchema,
  contentAdminActionResponseSchema,
  contentAdminActivityResponseSchema,
  contentAdminCreateGenerationPayloadSchema,
  contentAdminCreateGenerationResponseSchema,
  contentAdminCreateWorkspaceResponseSchema,
  contentAdminKnowledgeResponseSchema,
  contentAdminOverviewResponseSchema,
  contentAdminProcessingResponseSchema,
  contentAdminPromptActivatePayloadSchema,
  contentAdminPromptListResponseSchema,
  contentAdminPromptMutationResponseSchema,
  contentAdminPromptPatchPayloadSchema,
  contentAdminPromptPreviewPayloadSchema,
  contentAdminPromptPreviewResponseSchema,
  contentAdminPromptRollbackPayloadSchema,
  contentAdminSocialWorkspaceResponseSchema,
  contentAdminSourceDetailResponseSchema,
  contentAdminWorkspaceQuerySchema,
  contentFactoryActionSchema,
  contentFactoryEditPayloadSchema,
  contentFactoryMutationResponseSchema,
  contentFactoryWorkspaceResponseSchema,
  accomplishmentEventSchema,
  adminGamificationDashboardResponseSchema,
  gamificationCorrectionAuditSchema,
  gamificationCorrectionPayloadSchema,
  gamificationLearningEventPayloadSchema,
  parentRewardGoalPayloadSchema,
  parentRewardGoalSchema,
  ot86bReadinessResponseSchema,
  ot86bSocialDraftListResponseSchema,
} from '../../../../packages/contracts/src/index.ts';
import {
  providerCanaryPlanResponseSchema,
  providerControlCenterResponseSchema,
} from '../../../../packages/contracts/src/providers/control-center.ts';
import type {
  PortalActorContext,
  PortalCapability,
} from '../../../../packages/contracts/src/portals/index.ts';
import {
  CrmDuplicateError,
  CrmVersionConflictError,
  ContentIdempotencyConflictError,
  ContentFactoryError,
  Ot110aContentWorkspaceError,
  IdempotencyConflictError,
  AccountLifecycleError,
  acceptOwnerAdminInvitation,
  acceptParentActivation,
  acceptStudentSetup,
  activateOt110aPromptVersion,
  admitContentOutcome,
  appendContactNote,
  authenticateUser,
  archiveContact,
  assignCrmTag,
  canEditContacts,
  captureLead,
  completePasswordReset,
  completeStudentReset,
  confirmSingleRecipientReply,
  createAccountLifecycleCredentialAdapter,
  createContact,
  createCrmTag,
  createClassPortalAccessAdapter,
  createClassroomPortalAccessAdapter,
  createClassroomService,
  createContentPortalAccessAdapter,
  createGamificationService,
  createLoginCsrf,
  createOt110aGeneratedArtifact,
  createOt110aIntegratedProviderPorts,
  createOt110aPromptPatch,
  createParentPortalService,
  createPortalGamificationAdapter,
  createSession,
  consumeWhatsAppAccountLink,
  createStudentClassHelperAdapter,
  createStudentPortalService,
  resendEmailChallenge,
  getClassOccurrenceDetail,
  getContentItemDetail,
  getContentFactoryPlayback,
  getContentFactoryWorkspace,
  getContactDetail,
  getOt110aContentCreateWorkspace,
  getOt110aContentProcessingQueue,
  getOt110aContentSourceDetail,
  getOt110aContentWorkspaceOverview,
  getSessionUserByKey,
  getSessionByToken,
  buildWhatsAppPublicAssistantStatus,
  inspectAccountLifecycleToken,
  buildOwnerDashboard,
  listClassOccurrences,
  listContentLibrary,
  listAssignableUsers,
  listContacts,
  listOt110aActivity,
  listOt110aKnowledgeWorkspace,
  listOt110aPromptTemplates,
  listOt110aSocialWorkspace,
  ownerAdminVisibleActions,
  performOt110aContentAction,
  performContentFactoryAction,
  previewOt110aPromptPatch,
  inspectOt86bBufferReadinessFromEnv,
  listCrmTags,
  listOt86bSocialDrafts,
  previewSingleRecipientReply,
  receiveOt86PublicationManifest,
  receiveOt86bSocialEvent,
  requestPasswordReset,
  revokeTrustedDevice,
  resolveOt110aContentAdminActor,
  rollbackOt110aPromptVersion,
  revokeSession,
  rotateSessionCsrf,
  removeCrmTag,
  receiveWhatsAppWebhook,
  updateContact,
  editContentFactoryItem,
  inspectLearningDeliveryInputAdapters,
  verifyEmailChallengeCode,
  verifyEmailChallengeLink,
  CrmReplyError,
  verifyLoginCsrf,
  verifyRecentEmailAssurance,
  verifySessionCsrf,
  verifyWhatsAppWebhookChallenge,
  type AuthenticatedSession,
  PortalServiceError,
  type PortalServiceDeps,
} from '../../../../packages/domain/src/index.ts';
import {
  buildProviderControlCenter,
  planProviderCanary,
} from '../../../../packages/domain/src/providers/control-center.ts';
import { AesGcmPayloadCodec } from '../../../../packages/domain/src/telegram/crypto.ts';
import { createTelegramWebhookHandler } from '../../../../apps/telegram-bot/src/ingress.ts';
import {
  parseOt87StripeTestBillingConfig,
  readOt87StripeRuntimeSecrets,
} from '../../../../packages/domain/src/billing/config.ts';
import { createFixtureBillingProviderAdapter } from '../../../../packages/domain/src/billing/fixture-adapter.ts';
import { createOfficialStripeTestClient } from '../../../../packages/domain/src/billing/stripe-official-client.ts';
import { createStripeTestBillingProviderAdapter } from '../../../../packages/domain/src/billing/stripe-test-adapter.ts';
import type {
  BillingActorContext,
  BillingAuthorizationAdapter,
  BillingFeatureConfig,
} from '../../../../packages/domain/src/billing/types.ts';
import {
  collectOpsReadiness,
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
import { registerLearningDeliveryDemoRoutes } from './features/learning-delivery-demo/router.ts';
import { registerPortalTestLabRoutes } from './features/portal-test-lab/router.ts';
import { createResendWebhookRouter } from './features/delivery/resend-webhook-router.ts';
import { createBillingRouter } from './features/billing/router.ts';
import { registerSupportRoutes } from './features/support/router.ts';
import { leadRateLimit } from './rate-limit.ts';
import { registerOpsRoutes } from './ops-routes.ts';

type AppDeps = {
  config: AppConfig;
  pool: DbPool;
  distDir?: string;
  learningDeliveryDemoReportPath?: string;
  clock?: () => Date;
};

const SESSION_COOKIE = 'otcrm_session';
const CSRF_COOKIE = 'otcrm_csrf';
const TRUSTED_DEVICE_COOKIE = 'otcrm_trusted_device';
type AccountLifecycleTokenType = z.infer<typeof accountLifecycleTokenTypeSchema>;
const ACTIVATION_TOKEN_TYPES = accountLifecycleTokenTypeSchema.options.filter(
  (tokenType) => tokenType !== 'password_reset',
) as AccountLifecycleTokenType[];

const lifecycleTokenStatusPayloadSchema = z.object({
  token: z.string().trim().min(32).max(240),
  flow: z.enum(['activation', 'password_reset']),
});
const lifecycleActivationPayloadSchema = tokenCompletionPayloadSchema.extend({
  csrf_token: z.string().trim().min(16).max(160),
});
const forgotPasswordApiPayloadSchema = z.object({
  email: z.string().trim().email().max(254),
  csrf_token: z.string().trim().min(16).max(160),
  idempotency_key: z.string().trim().min(8).max(160).optional(),
});
const resetPasswordApiPayloadSchema = tokenCompletionPayloadSchema.extend({
  csrf_token: z.string().trim().min(16).max(160),
});
const emailChallengeVerifyPayloadSchema = z.object({
  challenge_token: z.string().trim().min(32).max(240),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
  trust_device: z.boolean().optional().default(false),
  return_to: z.string().trim().max(400).optional(),
});
const emailChallengeLinkPayloadSchema = z.object({
  link_token: z.string().trim().min(32).max(240),
  trust_device: z.boolean().optional().default(false),
  return_to: z.string().trim().max(400).optional(),
});
const emailChallengeResendPayloadSchema = z.object({
  challenge_token: z.string().trim().min(32).max(240),
});
const crmNotePayloadSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});
const crmTagPayloadSchema = z.object({
  display_name: z.string().trim().min(1).max(60),
});
const crmReplyChannelSchema = z.enum(['email', 'whatsapp']);
const crmReplyPreviewPayloadSchema = z.object({
  channel: crmReplyChannelSchema,
  body: z.string().trim().min(2).max(4000),
});
const crmReplyConfirmPayloadSchema = crmReplyPreviewPayloadSchema.extend({
  body_revision: z.string().trim().min(8).max(80),
  idempotency_key: z.string().trim().min(8).max(160),
});
const crmArchivePayloadSchema = z.object({
  reason: z.string().trim().max(240).optional(),
});

class PublicRouteError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly publicMessage: string,
  ) {
    super(publicMessage);
  }
}

type EmailChallengeVerificationResult = Awaited<ReturnType<typeof verifyEmailChallengeCode>>;

export function createApp({
  config,
  pool,
  distDir = path.resolve(process.cwd(), 'dist/apps/web/public'),
  learningDeliveryDemoReportPath,
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
          frameSrc: ["'self'", 'https://player.vimeo.com'],
        },
      },
    }),
  );
  app.use(traceMiddleware);
  app.use(
    '/api/v1/delivery/resend',
    createResendWebhookRouter({ config, pool, ...(clock ? { clock } : {}) }),
  );

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

  app.get('/api/v1/whatsapp/public-assistant', (_req, res) => {
    setPrivateNoStore(res);
    res.status(200).json(buildWhatsAppPublicAssistantStatus(config));
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

  app.post(
    '/internal/content-publications/v1/manifests',
    express.raw({ type: 'application/json', limit: '2mb' }),
    async (req: RequestWithTrace, res) => {
      setPrivateNoStore(res);
      const secrets = ot86PublishSecrets(config);
      if (secrets.length < 1) {
        res.status(503).json({
          success: false,
          code: 'OT86_PUBLISH_SIGNING_UNCONFIGURED',
          message: 'Content publication intake is not configured.',
          request_id: req.traceId,
        });
        return;
      }
      const result = await receiveOt86PublicationManifest({
        pool,
        rawBody: Buffer.isBuffer(req.body) ? req.body : Buffer.from(''),
        headers: {
          contentType: req.header('content-type') ?? null,
          keyId: req.header('x-ot86-key-id') ?? null,
          timestamp: req.header('x-ot86-timestamp') ?? null,
          deliveryId: req.header('x-ot86-delivery-id') ?? null,
          signature: req.header('x-ot86-signature') ?? null,
        },
        secrets,
      });
      res.status(result.status).json({
        success: result.status === 200 || result.status === 202,
        code: result.code,
        message: result.message,
        receipt_state: result.receipt_state,
        request_id: req.traceId,
      });
    },
  );

  app.post(
    '/internal/social-publishing/v1/events',
    express.raw({ type: 'application/json', limit: '512kb' }),
    async (req: RequestWithTrace, res) => {
      setPrivateNoStore(res);
      const secrets = ot86PublishSecrets(config);
      if (secrets.length < 1) {
        res.status(503).json({
          success: false,
          code: 'OT86_SOCIAL_SIGNING_UNCONFIGURED',
          message: 'Social event intake is not configured.',
          request_id: req.traceId,
        });
        return;
      }
      const result = await receiveOt86bSocialEvent({
        pool,
        rawBody: Buffer.isBuffer(req.body) ? req.body : Buffer.from(''),
        headers: {
          contentType: req.header('content-type') ?? null,
          keyId: req.header('x-ot86-key-id') ?? null,
          timestamp: req.header('x-ot86-timestamp') ?? null,
          deliveryId: req.header('x-ot86-delivery-id') ?? null,
          signature: req.header('x-ot86-signature') ?? null,
        },
        secrets,
      });
      res.status(result.status).json({
        success: result.status === 200 || result.status === 202,
        code: result.code,
        message: result.message,
        receipt_state: result.receipt_state,
        request_id: req.traceId,
      });
    },
  );

  registerSupportRoutes({
    app,
    config,
    pool,
    distDir,
    session: {
      sessionFromRequest: (req) => sessionFromRequest(req, pool, config),
      ensureSessionCsrfCookie: (req, res, session) =>
        ensureSessionCsrfCookie(req, res, pool, config, session),
      requireSessionCsrf: (req, res, session) => requireSessionCsrf(req, res, pool, session),
      setPrivateNoStore,
    },
  });

  const billingRuntime = createBillingRuntime(config, pool);
  app.use(
    '/api/v1/billing',
    createBillingRouter({
      config: billingRuntime.config,
      repositories: billingRuntime.repositories,
      providerAdapter: billingRuntime.providerAdapter,
      authorization: billingRuntime.authorization,
      resolveActor: (req) => billingActorFromRequest(req, pool, config),
      verifyCsrf: (req) => verifyBillingCsrf(req, pool, config),
    }),
  );
  app.get(/^\/app\/billing\/(?:checkout|portal)\/redirect\/([^/]+)$/, async (req, res) => {
    setPrivateNoStore(res);
    const redirectKey = String(req.params[0] ?? '');
    const providerUrl = await billingRuntime.repositories.consumeRedirect(redirectKey);
    if (!providerUrl) {
      res.status(404).type('text').send('Billing redirect expired.');
      return;
    }
    res.redirect(302, providerUrl);
  });

  app.use(express.json({ limit: '32kb' }));
  app.use(express.urlencoded({ extended: false, limit: '32kb' }));

  registerOpsRoutes({
    app,
    config,
    pool,
    sessionFromRequest: (req) => sessionFromRequest(req, pool, config),
    setPrivateNoStore,
    ...(clock ? { clock } : {}),
  });

  registerPortalTestLabRoutes({
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

  registerLearningDeliveryDemoRoutes({
    app,
    config,
    session: {
      sessionFromRequest: (req) => sessionFromRequest(req, pool, config),
      setPrivateNoStore,
    },
    ...(learningDeliveryDemoReportPath ? { reportPath: learningDeliveryDemoReportPath } : {}),
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'onetime-web' });
  });

  app.get('/ready', async (req: RequestWithTrace, res) => {
    const readiness = await withTiming(req, 'ops_ready', () =>
      collectOpsReadiness({ pool, config, ...(clock ? { now: clock() } : {}) }),
    );
    res.status(readiness.ok ? 200 : 503).json({
      ok: readiness.ok,
      service: 'onetime-web',
      generated_at: readiness.generated_at,
      dependencies: readiness.dependencies,
      optional_dependencies: readiness.optional_dependencies,
      blockers: readiness.blockers,
    });
  });

  app.get('/version', (_req, res) => {
    res.json({
      version: config.appVersion,
      commit_sha: config.commitSha,
      target_app: 'one-time',
      deployment: {
        provider: 'railway',
        deployment_id: config.railwayDeploymentId ?? null,
        snapshot_id: config.railwaySnapshotId ?? null,
        project_id: config.railwayProjectId ?? null,
        environment_id: config.railwayEnvironmentId ?? null,
        service_id: config.railwayServiceId ?? null,
        service_name: config.railwayServiceName ?? null,
        git_commit_sha: config.railwayGitCommitSha ?? null,
      },
    });
  });

  app.get('/one-time', (_req, res) => res.redirect(301, '/'));
  app.get('/one-time/signup', (_req, res) => res.redirect(301, '/signup'));
  app.get('/rabbi-member', (_req, res) => res.redirect(301, '/login'));

  app.get('/login', (req, res) => {
    const csrf = createLoginCsrf(config);
    setCsrfCookie(res, config, csrf.csrf_cookie);
    setPrivateNoStore(res);
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
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

  app.get('/activate', (_req, res) => {
    const csrf = createLoginCsrf(config);
    setCsrfCookie(res, config, csrf.csrf_cookie);
    setPrivateNoStore(res);
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.status(200).type('html').send(activationPageHtml(csrf.csrf_token));
  });

  app.get('/forgot-password', (_req, res) => {
    const csrf = createLoginCsrf(config);
    setCsrfCookie(res, config, csrf.csrf_cookie);
    setPrivateNoStore(res);
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.status(200).type('html').send(forgotPasswordPageHtml(csrf.csrf_token));
  });

  app.get('/reset-password', (_req, res) => {
    const csrf = createLoginCsrf(config);
    setCsrfCookie(res, config, csrf.csrf_cookie);
    setPrivateNoStore(res);
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.status(200).type('html').send(resetPasswordPageHtml(csrf.csrf_token));
  });

  app.post('/api/v1/account-lifecycle/token-status', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    try {
      const payload = lifecycleTokenStatusPayloadSchema.parse(req.body);
      const expectedTypes: AccountLifecycleTokenType[] =
        payload.flow === 'password_reset' ? ['password_reset'] : ACTIVATION_TOKEN_TYPES;
      const inspected = await inspectAccountLifecycleToken({
        pool,
        config,
        token: payload.token,
        expectedTypes,
      });
      if (!inspected.ok) {
        res.status(statusForLifecycleCode(inspected.code)).json({
          success: false,
          code: inspected.code,
          message: lifecycleMessage(inspected.code),
          request_id: req.traceId,
        });
        return;
      }
      res.status(200).json({
        success: true,
        token_type: inspected.token_type,
        target_role: inspected.target_role,
        expires_at: inspected.expires_at,
        mfa_required: inspected.mfa_required,
      });
    } catch (error) {
      handleLifecycleRouteError(error, req, res, 'We could not check that link yet.');
    }
  });

  app.post('/api/v1/account-lifecycle/activate', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    try {
      const payload = lifecycleActivationPayloadSchema.parse(req.body);
      requireLoginCsrf(req, res, config, payload.csrf_token);
      const inspected = await inspectAccountLifecycleToken({
        pool,
        config,
        token: payload.token,
        expectedTypes: ACTIVATION_TOKEN_TYPES,
      });
      if (!inspected.ok) {
        res.status(statusForLifecycleCode(inspected.code)).json({
          success: false,
          code: inspected.code,
          message: lifecycleMessage(inspected.code),
          request_id: req.traceId,
        });
        return;
      }
      const completion =
        inspected.token_type === 'owner_admin_invitation'
          ? await acceptOwnerAdminInvitation({ pool, config, payload })
          : inspected.token_type === 'parent_activation'
            ? await acceptParentActivation({ pool, config, payload })
            : inspected.token_type === 'student_setup'
              ? await acceptStudentSetup({ pool, config, payload })
              : await completeStudentReset({ pool, config, payload });
      const sessionUser = await getSessionUserByKey({ pool, config, userKey: completion.user_key });
      if (!sessionUser) {
        throw new Error('Activated user was not available for session creation.');
      }
      const session = await createSession({
        pool,
        config,
        user: sessionUser,
        ip: req.ip,
        userAgent: req.header('user-agent') ?? undefined,
        assuranceMethod: 'email_link',
      });
      setAuthCookies(res, config, session.session_token, session.csrf_token);
      res.status(200).json({
        success: true,
        mfa_required: false,
        csrf_token: session.csrf_token,
        return_to: defaultRouteForRole(session.user.role),
      });
    } catch (error) {
      handleLifecycleRouteError(error, req, res, 'Activation is unavailable right now.');
    }
  });

  app.post('/api/v1/account-lifecycle/forgot-password', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    try {
      const payload = forgotPasswordApiPayloadSchema.parse(req.body);
      requireLoginCsrf(req, res, config, payload.csrf_token);
      await requestPasswordReset({
        pool,
        config,
        payload: passwordResetRequestPayloadSchema.parse({
          idempotency_key: payload.idempotency_key ?? `forgot-${randomUUID()}`,
          email: payload.email,
        }),
      });
      res.status(200).json({
        success: true,
        request_accepted: true,
        message: 'If that email has access, a reset link will be sent.',
      });
    } catch (error) {
      if (error instanceof AccountLifecycleError && error.code === 'RATE_LIMITED') {
        res.status(429).json({
          success: false,
          code: 'RATE_LIMITED',
          message: 'Please wait before requesting another reset link.',
          request_id: req.traceId,
        });
        return;
      }
      handleLifecycleRouteError(
        error,
        req,
        res,
        'If that email has access, a reset link will be sent.',
      );
    }
  });

  app.post('/api/v1/account-lifecycle/reset-password', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    try {
      const payload = resetPasswordApiPayloadSchema.parse(req.body);
      requireLoginCsrf(req, res, config, payload.csrf_token);
      const completed = await completePasswordReset({ pool, config, payload });
      res.status(200).json({
        success: true,
        sessions_invalidated: completed.sessions_invalidated,
        return_to: '/login',
      });
    } catch (error) {
      handleLifecycleRouteError(error, req, res, 'Password reset is unavailable right now.');
    }
  });

  app.post('/api/v1/account-lifecycle/mfa/activate', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    retiredAuthMethod(res, req);
  });

  app.post('/api/v1/account-lifecycle/mfa/ack', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    retiredAuthMethod(res, req);
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
    /^\/app\/billing\/checkout\/(?:success|cancel)(?:\/.*)?$/,
    async (req: RequestWithTrace, res) => {
      const session = await sessionFromRequest(req, pool, config);
      if (!session) {
        res.redirect(
          302,
          `/login?return_to=${encodeURIComponent(
            safeReturnPath(req.path, config) ?? '/app/billing/checkout/success',
          )}`,
        );
        return;
      }
      await ensureSessionCsrfCookie(req, res, pool, config, session);
      setPrivateNoStore(res);
      await sendAppHtml(res, distDir, session.user.role === 'parent' ? 'parent' : 'crm');
    },
  );

  app.get(
    /^\/app\/(?:dashboard|classes|content|billing|communications|rewards|support)(?:\/.*)?$/,
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
          trustedDeviceToken: getCookie(req, TRUSTED_DEVICE_COOKIE),
        }),
      );
      if (!login.ok) {
        const status =
          login.code === 'RATE_LIMITED'
            ? 429
            : login.code === 'EMAIL_CHALLENGE_REQUIRED'
              ? 403
              : 401;
        if (login.retry_after_seconds)
          res.setHeader('retry-after', String(login.retry_after_seconds));
        res.status(status).json({
          success: false,
          code: login.code,
          message:
            login.code === 'EMAIL_CHALLENGE_REQUIRED'
              ? 'Check your email for a six-digit login code.'
              : 'Email or password is not correct.',
          challenge_token: login.challenge_token,
          challenge_expires_at: login.challenge_expires_at,
          delivery_state: login.delivery_state,
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
          assuranceMethod: login.assuranceMethod,
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

  app.post('/api/v1/auth/email-challenge/verify', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    try {
      const payload = emailChallengeVerifyPayloadSchema.parse(req.body);
      const verified = await verifyEmailChallengeCode({
        pool,
        config,
        challengeToken: payload.challenge_token,
        code: payload.code,
        trustDevice: payload.trust_device,
        ip: req.ip,
        userAgent: req.header('user-agent') ?? undefined,
      });
      await completeEmailChallengeLogin(req, res, pool, config, verified, payload.return_to);
    } catch (error) {
      handleEmailChallengeRouteError(error, req, res);
    }
  });

  app.post('/api/v1/auth/email-challenge/link', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    try {
      const payload = emailChallengeLinkPayloadSchema.parse(req.body);
      const verified = await verifyEmailChallengeLink({
        pool,
        config,
        linkToken: payload.link_token,
        trustDevice: payload.trust_device,
        ip: req.ip,
        userAgent: req.header('user-agent') ?? undefined,
      });
      await completeEmailChallengeLogin(req, res, pool, config, verified, payload.return_to);
    } catch (error) {
      handleEmailChallengeRouteError(error, req, res);
    }
  });

  app.post('/api/v1/auth/email-challenge/resend', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    try {
      const payload = emailChallengeResendPayloadSchema.parse(req.body);
      const resent = await resendEmailChallenge({
        pool,
        config,
        challengeToken: payload.challenge_token,
        ip: req.ip,
        userAgent: req.header('user-agent') ?? undefined,
      });
      if (!resent.ok) {
        const status = resent.code === 'RATE_LIMITED' ? 429 : 401;
        if (resent.retryAfterSeconds)
          res.setHeader('retry-after', String(resent.retryAfterSeconds));
        res.status(status).json({
          success: false,
          code: resent.code,
          message:
            resent.code === 'RATE_LIMITED'
              ? 'Please wait before requesting another code.'
              : 'Email or password is not correct.',
          request_id: req.traceId,
        });
        return;
      }
      res.status(200).json({
        success: true,
        challenge_token: resent.challengeToken,
        challenge_expires_at: resent.expiresAt,
        delivery_state: resent.deliveryState,
      });
    } catch (error) {
      handleEmailChallengeRouteError(error, req, res);
    }
  });

  app.post('/api/v1/auth/mfa/enroll/activate', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    retiredAuthMethod(res, req);
  });

  app.post('/api/v1/auth/mfa/challenge', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    retiredAuthMethod(res, req);
  });

  app.post('/api/v1/auth/mfa/recovery', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    retiredAuthMethod(res, req);
  });

  app.post('/api/v1/auth/mfa/recovery/replace', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    retiredAuthMethod(res, req);
  });

  app.post('/api/v1/auth/mfa/revoke', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    retiredAuthMethod(res, req);
  });

  app.post('/api/v1/auth/trusted-devices/revoke', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!['owner', 'admin'].includes(session.user.role)) {
      res
        .status(403)
        .json(publicError('FORBIDDEN', 'Your role cannot manage trusted devices.', req.traceId));
      return;
    }
    if (!(await requireSessionCsrf(req, res, pool, session))) return;
    if (!(await requireRecentEmailAssurance(req, res, pool, session))) return;
    await revokeTrustedDevice({
      pool,
      config,
      trustedDeviceToken: getCookie(req, TRUSTED_DEVICE_COOKIE),
      userKey: session.user.user_key,
    });
    clearTrustedDeviceCookie(res, config);
    res.status(200).json({ success: true, trusted_device_revoked: true });
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

  app.get(
    '/api/internal/operations/provider-control-center/v1',
    async (req: RequestWithTrace, res) => {
      setPrivateNoStore(res);
      const session = await requireApiSession(req, res, pool, config);
      if (!session) return;
      if (session.user.role !== 'owner') {
        res
          .status(403)
          .json(
            publicError('FORBIDDEN', 'Provider control center requires owner access.', req.traceId),
          );
        return;
      }
      try {
        const controlCenter = buildProviderControlCenter({
          config,
          env: process.env,
          now: clock ? clock() : new Date(),
        });
        res.json(providerControlCenterResponseSchema.parse(controlCenter));
      } catch (error) {
        handleApiError(error, req, res);
      }
    },
  );

  app.post(
    '/api/internal/operations/provider-control-center/v1/canary-plan',
    async (req: RequestWithTrace, res) => {
      setPrivateNoStore(res);
      if (!requireSameOriginPost(req, res, config)) return;
      const session = await requireApiSession(req, res, pool, config);
      if (!session) return;
      if (!(await requireSessionCsrf(req, res, pool, session))) return;
      const plan = planProviderCanary({
        payload: stripCsrfField(req.body),
        actorRole: session.user.role,
        recentEmailAssuredAt: req.header('x-ot-ops-email-assured-at') ?? undefined,
        allowlistedTargets: providerCanaryAllowlist(config, process.env),
        now: clock ? clock() : new Date(),
      });
      const parsed = providerCanaryPlanResponseSchema.parse(plan);
      res.status(parsed.success ? 200 : statusForCanaryPlanCode(parsed.code)).json(parsed);
    },
  );

  const portalRepository = createPortalRepository(pool);
  const classroomRepository = createClassroomRepository(pool);
  const classroomService = createClassroomService({
    config,
    repository: classroomRepository,
    questionCodec: new AesGcmPayloadCodec(`${config.mfaSecretEncryptionKey}:classroom-question-v1`),
    ...(clock ? { clock } : {}),
  });
  const gamificationRepository = createGamificationRepository(pool);
  const gamificationService = createGamificationService({
    repository: gamificationRepository,
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
    gamification: createPortalGamificationAdapter(gamificationService),
    helper: createStudentClassHelperAdapter({ pool, config, ...(clock ? { clock } : {}) }),
    billing: createParentBillingSummaryAdapter(billingRuntime.config, billingRuntime.repositories),
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

  app.get('/api/v1/gamification/admin', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!canUseOwnerDashboard(session.user.role)) {
      res.status(403).json(publicError('FORBIDDEN', 'Your role cannot view rewards.', req.traceId));
      return;
    }
    const actor = await resolvePortalActor(req);
    if (!actor) {
      res.status(401).json(publicError('UNAUTHENTICATED', 'Please log in again.', req.traceId));
      return;
    }
    try {
      const dashboard = await gamificationService.adminDashboard(actor);
      res.json(adminGamificationDashboardResponseSchema.parse({ success: true, dashboard }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.post('/api/v1/gamification/events', async (req: RequestWithTrace, res) => {
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
      const payload = gamificationLearningEventPayloadSchema.parse(req.body);
      const event = await gamificationService.recordLearningEvent(actor, payload);
      res.status(201).json({ success: true, data: accomplishmentEventSchema.parse(event) });
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.post('/api/v1/gamification/reversals', async (req: RequestWithTrace, res) => {
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
      const payload = gamificationCorrectionPayloadSchema.parse(req.body);
      const correction = await gamificationService.reverseEvent(actor, payload);
      res
        .status(201)
        .json({ success: true, data: gamificationCorrectionAuditSchema.parse(correction) });
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.post('/api/v1/gamification/parent-rewards', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const actor = await resolvePortalActor(req);
    if (!actor) {
      res.status(401).json(publicError('UNAUTHENTICATED', 'Please log in again.', req.traceId));
      return;
    }
    if (!(await verifyPortalCsrf(req, actor))) {
      res
        .status(403)
        .json(publicError('CSRF_REQUIRED', 'Refresh the portal and try again.', req.traceId));
      return;
    }
    try {
      const payload = parentRewardGoalPayloadSchema.parse(req.body);
      const reward = await gamificationService.createParentRewardGoal(actor, payload);
      res.status(201).json({ success: true, data: parentRewardGoalSchema.parse(reward) });
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
    if (!canReadContacts(session.user.role)) {
      res
        .status(403)
        .json(publicError('FORBIDDEN', 'Your role cannot view CRM contacts.', req.traceId));
      return;
    }
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
    if (!canReadContacts(session.user.role)) {
      res
        .status(403)
        .json(publicError('FORBIDDEN', 'Your role cannot view CRM contacts.', req.traceId));
      return;
    }
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
    if (!(await requireRecentEmailAssurance(req, res, pool, session))) return;
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

  app.get('/api/v1/admin/content/workspace', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    try {
      const actor = await ot110aActorFromSession(pool, config, session);
      const query = contentAdminWorkspaceQuerySchema.parse(req.query);
      const workspace = await withTiming(req, 'db', () =>
        getOt110aContentWorkspaceOverview({
          pool,
          config,
          actor,
          query,
          ports: createOt110aIntegratedProviderPorts(config),
        }),
      );
      res.json(contentAdminOverviewResponseSchema.parse({ success: true, ...workspace }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.get('/api/v1/admin/content/factory', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!isContentFactoryAdmin(session)) {
      res
        .status(403)
        .json(publicError('FORBIDDEN', 'Owner or Admin access required.', req.traceId));
      return;
    }
    try {
      const workspace = await withTiming(req, 'db', () =>
        getContentFactoryWorkspace({ pool, config }),
      );
      const adapter = inspectLearningDeliveryInputAdapters({
        driveFolderIdPresent: Boolean(process.env.GOOGLE_DRIVE_FOLDER_ID),
        driveServiceAccountPresent: Boolean(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON),
      });
      res.json(
        contentFactoryWorkspaceResponseSchema.parse({
          success: true,
          input_adapter: adapter.inputAdapter,
          adapters: adapter.adapters,
          ...workspace,
        }),
      );
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.patch('/api/v1/admin/content/factory/:sourceKey', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!(await requireSessionCsrf(req, res, pool, session))) return;
    try {
      const payload = contentFactoryEditPayloadSchema.parse(req.body);
      const item = await withTiming(req, 'db', () =>
        editContentFactoryItem({
          pool,
          config,
          sourceKey: String(req.params.sourceKey),
          actorUserKey: session.user.user_key,
          actorRole: session.user.role,
          payload,
        }),
      );
      res.json(contentFactoryMutationResponseSchema.parse({ success: true, item }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.post(
    '/api/v1/admin/content/factory/:sourceKey/:action',
    async (req: RequestWithTrace, res) => {
      setPrivateNoStore(res);
      const session = await requireApiSession(req, res, pool, config);
      if (!session) return;
      if (!(await requireSessionCsrf(req, res, pool, session))) return;
      try {
        const action = contentFactoryActionSchema.parse(req.params.action);
        const item = await withTiming(req, 'db', () =>
          performContentFactoryAction({
            pool,
            config,
            sourceKey: String(req.params.sourceKey),
            actorUserKey: session.user.user_key,
            actorRole: session.user.role,
            action,
          }),
        );
        res.json(contentFactoryMutationResponseSchema.parse({ success: true, item }));
      } catch (error) {
        handleApiError(error, req, res);
      }
    },
  );

  app.get('/app/learning/items/:sourceKey', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await sessionFromRequest(req, pool, config);
    if (!session) {
      res.redirect(302, `/login?return_to=${encodeURIComponent(req.originalUrl)}`);
      return;
    }
    if (!['owner', 'admin', 'parent', 'student'].includes(session.user.role)) {
      res.status(403).type('html').send('Protected learning access required.');
      return;
    }
    try {
      const playback = await getContentFactoryPlayback({
        pool,
        config,
        sourceKey: String(req.params.sourceKey),
      });
      res.status(200).type('html').send(contentFactoryPlayerHtml(playback));
    } catch (error) {
      const status = error instanceof ContentFactoryError && error.code === 'NOT_FOUND' ? 404 : 409;
      res.status(status).type('html').send('Approved lesson playback is unavailable.');
    }
  });

  app.get('/api/v1/content/factory/:sourceKey/embed', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!['owner', 'admin', 'parent', 'student'].includes(session.user.role)) {
      res
        .status(403)
        .json(publicError('FORBIDDEN', 'Protected learning access required.', req.traceId));
      return;
    }
    try {
      const playback = await getContentFactoryPlayback({
        pool,
        config,
        sourceKey: String(req.params.sourceKey),
      });
      res.redirect(302, playback.privateProviderEmbedUrl);
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.get('/api/v1/admin/content/processing', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    try {
      const actor = await ot110aActorFromSession(pool, config, session);
      const queue = await withTiming(req, 'db', () =>
        getOt110aContentProcessingQueue({
          pool,
          config,
          actor,
          ports: createOt110aIntegratedProviderPorts(config),
        }),
      );
      res.json(contentAdminProcessingResponseSchema.parse({ success: true, ...queue }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.get('/api/v1/admin/content/create', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    try {
      const actor = await ot110aActorFromSession(pool, config, session);
      const workspace = await withTiming(req, 'db', () =>
        getOt110aContentCreateWorkspace({
          pool,
          config,
          actor,
          ports: createOt110aIntegratedProviderPorts(config),
        }),
      );
      res.json(contentAdminCreateWorkspaceResponseSchema.parse({ success: true, ...workspace }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.post('/api/v1/admin/content/create', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!(await requireSessionCsrf(req, res, pool, session))) return;
    try {
      const actor = await ot110aActorFromSession(pool, config, session);
      const payload = contentAdminCreateGenerationPayloadSchema.parse(req.body);
      const artifact = await withTiming(req, 'db', () =>
        createOt110aGeneratedArtifact({
          pool,
          config,
          actor,
          payload,
          ports: createOt110aIntegratedProviderPorts(config),
        }),
      );
      res.status(202).json(
        contentAdminCreateGenerationResponseSchema.parse({
          success: true,
          artifact,
          provider_ports: [createOt110aIntegratedProviderPorts(config).generation.inspect()],
        }),
      );
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.get('/api/v1/admin/content/social', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    try {
      const actor = await ot110aActorFromSession(pool, config, session);
      const workspace = await withTiming(req, 'db', () =>
        listOt110aSocialWorkspace({
          pool,
          config,
          actor,
          ports: createOt110aIntegratedProviderPorts(config),
        }),
      );
      res.json(contentAdminSocialWorkspaceResponseSchema.parse({ success: true, ...workspace }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.get('/api/v1/admin/content/knowledge', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    try {
      const actor = await ot110aActorFromSession(pool, config, session);
      const workspace = await withTiming(req, 'db', () =>
        listOt110aKnowledgeWorkspace({
          pool,
          config,
          actor,
          ports: createOt110aIntegratedProviderPorts(config),
        }),
      );
      res.json(contentAdminKnowledgeResponseSchema.parse({ success: true, ...workspace }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.get('/api/v1/admin/content/prompts', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    try {
      const actor = await ot110aActorFromSession(pool, config, session);
      const templates = await withTiming(req, 'db', () =>
        listOt110aPromptTemplates({ pool, config, actor }),
      );
      res.json(
        contentAdminPromptListResponseSchema.parse({
          success: true,
          capabilities: actor.capabilities,
          templates,
        }),
      );
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.post('/api/v1/admin/content/prompts/:templateKey/patch', async (req, res) => {
    setPrivateNoStore(res);
    const request = req as RequestWithTrace;
    const session = await requireApiSession(request, res, pool, config);
    if (!session) return;
    if (!(await requireSessionCsrf(request, res, pool, session))) return;
    try {
      const actor = await ot110aActorFromSession(pool, config, session);
      const payload = contentAdminPromptPatchPayloadSchema.parse(request.body);
      const result = await withTiming(request, 'db', () =>
        createOt110aPromptPatch({
          pool,
          config,
          actor,
          templateKey: String(request.params.templateKey),
          payload,
        }),
      );
      res
        .status(201)
        .json(contentAdminPromptMutationResponseSchema.parse({ success: true, ...result }));
    } catch (error) {
      handleApiError(error, request, res);
    }
  });

  app.post('/api/v1/admin/content/prompts/:templateKey/preview', async (req, res) => {
    setPrivateNoStore(res);
    const request = req as RequestWithTrace;
    const session = await requireApiSession(request, res, pool, config);
    if (!session) return;
    if (!(await requireSessionCsrf(request, res, pool, session))) return;
    try {
      const actor = await ot110aActorFromSession(pool, config, session);
      const payload = contentAdminPromptPreviewPayloadSchema.parse(request.body);
      const preview = await withTiming(request, 'db', () =>
        previewOt110aPromptPatch({
          pool,
          config,
          actor,
          templateKey: String(request.params.templateKey),
          payload,
        }),
      );
      res.json(contentAdminPromptPreviewResponseSchema.parse({ success: true, preview }));
    } catch (error) {
      handleApiError(error, request, res);
    }
  });

  app.post('/api/v1/admin/content/prompts/:templateKey/activate', async (req, res) => {
    setPrivateNoStore(res);
    const request = req as RequestWithTrace;
    const session = await requireApiSession(request, res, pool, config);
    if (!session) return;
    if (!(await requireSessionCsrf(request, res, pool, session))) return;
    try {
      const actor = await ot110aActorFromSession(pool, config, session);
      const payload = contentAdminPromptActivatePayloadSchema.parse(request.body);
      const result = await withTiming(request, 'db', () =>
        activateOt110aPromptVersion({
          pool,
          config,
          actor,
          templateKey: String(request.params.templateKey),
          versionKey: payload.version_key,
          reason: payload.reason,
        }),
      );
      res.json(contentAdminPromptMutationResponseSchema.parse({ success: true, ...result }));
    } catch (error) {
      handleApiError(error, request, res);
    }
  });

  app.post('/api/v1/admin/content/prompts/:templateKey/rollback', async (req, res) => {
    setPrivateNoStore(res);
    const request = req as RequestWithTrace;
    const session = await requireApiSession(request, res, pool, config);
    if (!session) return;
    if (!(await requireSessionCsrf(request, res, pool, session))) return;
    try {
      const actor = await ot110aActorFromSession(pool, config, session);
      const payload = contentAdminPromptRollbackPayloadSchema.parse(request.body);
      const result = await withTiming(request, 'db', () =>
        rollbackOt110aPromptVersion({
          pool,
          config,
          actor,
          templateKey: String(request.params.templateKey),
          targetVersionKey: payload.target_version_key,
          reason: payload.reason,
        }),
      );
      res.json(contentAdminPromptMutationResponseSchema.parse({ success: true, ...result }));
    } catch (error) {
      handleApiError(error, request, res);
    }
  });

  app.get('/api/v1/admin/content/activity', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    try {
      const actor = await ot110aActorFromSession(pool, config, session);
      const sourceKey = typeof req.query.source_key === 'string' ? req.query.source_key : undefined;
      const events = await withTiming(req, 'db', () =>
        listOt110aActivity({
          pool,
          config,
          actor,
          ...(sourceKey ? { sourceKey } : {}),
        }),
      );
      res.json(contentAdminActivityResponseSchema.parse({ success: true, events }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.post(
    '/api/v1/admin/content/sources/:sourceKey/transcript/approve',
    async (req: RequestWithTrace, res) => {
      await handleOt110aSourceAction(req, res, pool, config, 'transcript.approve');
    },
  );

  app.post(
    '/api/v1/admin/content/sources/:sourceKey/artifacts/approve',
    async (req: RequestWithTrace, res) => {
      await handleOt110aSourceAction(req, res, pool, config, 'artifact.approve');
    },
  );

  app.post(
    '/api/v1/admin/content/sources/:sourceKey/artifacts/publish',
    async (req: RequestWithTrace, res) => {
      await handleOt110aSourceAction(req, res, pool, config, 'artifact.publish');
    },
  );

  app.post('/api/v1/admin/content/sources/:sourceKey/retry', async (req: RequestWithTrace, res) => {
    await handleOt110aSourceAction(req, res, pool, config, 'content.retry');
  });

  app.post(
    '/api/v1/admin/content/sources/:sourceKey/retract',
    async (req: RequestWithTrace, res) => {
      await handleOt110aSourceAction(req, res, pool, config, 'content.retract');
    },
  );

  app.post(
    '/api/v1/admin/content/sources/:sourceKey/social/approve',
    async (req: RequestWithTrace, res) => {
      await handleOt110aSourceAction(req, res, pool, config, 'social.approve');
    },
  );

  app.post(
    '/api/v1/admin/content/sources/:sourceKey/social/schedule',
    async (req: RequestWithTrace, res) => {
      await handleOt110aSourceAction(req, res, pool, config, 'social.schedule');
    },
  );

  app.post(
    '/api/v1/admin/content/sources/:sourceKey/social/retract',
    async (req: RequestWithTrace, res) => {
      await handleOt110aSourceAction(req, res, pool, config, 'social.retract');
    },
  );

  app.get('/api/v1/admin/content/sources/:sourceKey', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    try {
      const actor = await ot110aActorFromSession(pool, config, session);
      const source = await withTiming(req, 'db', () =>
        getOt110aContentSourceDetail({
          pool,
          config,
          actor,
          sourceKey: String(req.params.sourceKey),
          ports: createOt110aIntegratedProviderPorts(config),
        }),
      );
      if (!source) {
        res
          .status(404)
          .json(publicError('NOT_FOUND', 'Content source was not found.', req.traceId));
        return;
      }
      res.json(contentAdminSourceDetailResponseSchema.parse({ success: true, source }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.get('/api/v1/social-publishing/readiness', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!canUseSocialPublishing(session.user.role)) {
      res
        .status(403)
        .json(publicError('FORBIDDEN', 'Your role cannot manage social publishing.', req.traceId));
      return;
    }
    const readiness = inspectOt86bBufferReadinessFromEnv(ot86bBufferEnv(config));
    res.json(ot86bReadinessResponseSchema.parse({ success: true, readiness }));
  });

  app.get('/api/v1/social-publishing/drafts', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!canUseSocialPublishing(session.user.role)) {
      res
        .status(403)
        .json(publicError('FORBIDDEN', 'Your role cannot view social drafts.', req.traceId));
      return;
    }
    const drafts = await withTiming(req, 'db', () =>
      listOt86bSocialDrafts({ pool, tenantId: config.accountKey, limit: 25 }),
    );
    res.json(
      ot86bSocialDraftListResponseSchema.parse({ success: true, drafts, next_cursor: null }),
    );
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
    if (
      canUseOwnerDashboard(session.user.role) &&
      !(await requireRecentEmailAssurance(req, res, pool, session))
    )
      return;
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
    if (!canReadContacts(session.user.role)) {
      res
        .status(403)
        .json(publicError('FORBIDDEN', 'Your role cannot view CRM contacts.', req.traceId));
      return;
    }
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
    if (
      canUseOwnerDashboard(session.user.role) &&
      !(await requireRecentEmailAssurance(req, res, pool, session))
    )
      return;
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

  app.post('/api/v1/crm/contacts/:contactId/archive', async (req: RequestWithTrace, res) => {
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
      const payload = crmArchivePayloadSchema.parse(req.body);
      const result = await withTiming(req, 'db', () =>
        archiveContact({
          pool,
          config,
          contactId: String(req.params.contactId),
          actorUserKey: session.user.user_key,
          reason: payload.reason,
        }),
      );
      if (!result) {
        res.status(404).json(publicError('NOT_FOUND', 'Contact was not found.', req.traceId));
        return;
      }
      res.json({ success: true, ...result });
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.get('/api/v1/crm/tags', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!canReadContacts(session.user.role)) {
      res
        .status(403)
        .json(publicError('FORBIDDEN', 'Your role cannot view CRM tags.', req.traceId));
      return;
    }
    res.json({
      success: true,
      tags: await withTiming(req, 'db', () => listCrmTags({ pool, config })),
    });
  });

  app.post('/api/v1/crm/tags', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!canEditContacts(session.user.role)) {
      res.status(403).json(publicError('FORBIDDEN', 'Your role cannot manage tags.', req.traceId));
      return;
    }
    if (!(await requireSessionCsrf(req, res, pool, session))) return;
    try {
      const payload = crmTagPayloadSchema.parse(req.body);
      const tag = await withTiming(req, 'db', () =>
        createCrmTag({
          pool,
          config,
          displayName: payload.display_name,
          actorUserKey: session.user.user_key,
        }),
      );
      res.status(201).json({ success: true, tag });
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.post('/api/v1/crm/contacts/:contactId/tags/:tagId', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!canEditContacts(session.user.role)) {
      res.status(403).json(publicError('FORBIDDEN', 'Your role cannot manage tags.', req.traceId));
      return;
    }
    if (!(await requireSessionCsrf(req, res, pool, session))) return;
    try {
      const result = await withTiming(req, 'db', () =>
        assignCrmTag({
          pool,
          config,
          contactId: String(req.params.contactId),
          tagId: String(req.params.tagId),
          actorUserKey: session.user.user_key,
        }),
      );
      if (!result) {
        res.status(404).json(publicError('NOT_FOUND', 'Contact was not found.', req.traceId));
        return;
      }
      res.json({ success: true, ...result });
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.post(
    '/api/v1/crm/contacts/:contactId/tags/:tagId/remove',
    async (req: RequestWithTrace, res) => {
      setPrivateNoStore(res);
      const session = await requireApiSession(req, res, pool, config);
      if (!session) return;
      if (!canEditContacts(session.user.role)) {
        res
          .status(403)
          .json(publicError('FORBIDDEN', 'Your role cannot manage tags.', req.traceId));
        return;
      }
      if (!(await requireSessionCsrf(req, res, pool, session))) return;
      try {
        const result = await withTiming(req, 'db', () =>
          removeCrmTag({
            pool,
            config,
            contactId: String(req.params.contactId),
            tagId: String(req.params.tagId),
            actorUserKey: session.user.user_key,
          }),
        );
        if (!result) {
          res.status(404).json(publicError('NOT_FOUND', 'Contact was not found.', req.traceId));
          return;
        }
        res.json({ success: true, ...result });
      } catch (error) {
        handleApiError(error, req, res);
      }
    },
  );

  app.post('/api/v1/crm/contacts/:contactId/notes', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!canEditContacts(session.user.role)) {
      res.status(403).json(publicError('FORBIDDEN', 'Your role cannot append notes.', req.traceId));
      return;
    }
    if (!(await requireSessionCsrf(req, res, pool, session))) return;
    try {
      const payload = crmNotePayloadSchema.parse(req.body);
      const note = await withTiming(req, 'db', () =>
        appendContactNote({
          pool,
          config,
          contactId: String(req.params.contactId),
          body: payload.body,
          actorUserKey: session.user.user_key,
        }),
      );
      if (!note) {
        res.status(404).json(publicError('NOT_FOUND', 'Contact was not found.', req.traceId));
        return;
      }
      res.status(201).json({ success: true, note });
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.post(
    '/api/v1/crm/contacts/:contactId/replies/preview',
    async (req: RequestWithTrace, res) => {
      setPrivateNoStore(res);
      const session = await requireApiSession(req, res, pool, config);
      if (!session) return;
      if (!['owner', 'admin'].includes(session.user.role)) {
        res
          .status(403)
          .json(publicError('FORBIDDEN', 'Your role cannot compose replies.', req.traceId));
        return;
      }
      if (!(await requireSessionCsrf(req, res, pool, session))) return;
      try {
        const payload = crmReplyPreviewPayloadSchema.parse(req.body);
        const preview = await withTiming(req, 'db', () =>
          previewSingleRecipientReply({
            pool,
            config,
            contactId: String(req.params.contactId),
            channel: payload.channel,
            body: payload.body,
          }),
        );
        if (!preview) {
          res.status(404).json(publicError('NOT_FOUND', 'Contact was not found.', req.traceId));
          return;
        }
        res.json(preview);
      } catch (error) {
        handleApiError(error, req, res);
      }
    },
  );

  app.post(
    '/api/v1/crm/contacts/:contactId/replies/confirm',
    async (req: RequestWithTrace, res) => {
      setPrivateNoStore(res);
      const session = await requireApiSession(req, res, pool, config);
      if (!session) return;
      if (!['owner', 'admin'].includes(session.user.role)) {
        res
          .status(403)
          .json(publicError('FORBIDDEN', 'Your role cannot compose replies.', req.traceId));
        return;
      }
      if (!(await requireSessionCsrf(req, res, pool, session))) return;
      try {
        const payload = crmReplyConfirmPayloadSchema.parse(req.body);
        const reply = await withTiming(req, 'db', () =>
          confirmSingleRecipientReply({
            pool,
            config,
            contactId: String(req.params.contactId),
            channel: payload.channel,
            body: payload.body,
            bodyRevision: payload.body_revision,
            idempotencyKey: payload.idempotency_key,
            actorUserKey: session.user.user_key,
          }),
        );
        if (!reply) {
          res.status(404).json(publicError('NOT_FOUND', 'Contact was not found.', req.traceId));
          return;
        }
        res.status(202).json(reply);
      } catch (error) {
        handleApiError(error, req, res);
      }
    },
  );

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

  app.use(async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }
    const htmlFile = publicHtmlFileForPath(req.path);
    if (!htmlFile) {
      next();
      return;
    }
    await sendPublicHtml(res, path.join(distDir, htmlFile), config, req.path);
  });

  app.use(
    express.static(distDir, { extensions: ['html'], maxAge: config.isProduction ? '1h' : 0 }),
  );

  app.use(async (_req, res) => {
    res.status(404);
    await sendPublicHtml(res, path.join(distDir, '404.html'), config, '/404');
  });

  return app;
}

function publicHtmlFileForPath(pathname: string) {
  if (pathname === '/') return 'index.html';
  if (pathname.startsWith('/app/content/')) return 'app/content.html';
  const staticPages = new Set([
    '/signup',
    '/login',
    '/privacy',
    '/terms',
    '/communications-consent',
    '/student-data',
    '/404',
  ]);
  if (staticPages.has(pathname)) return `${pathname.slice(1)}.html`;
  const appPages = new Set([
    '/app/crm',
    '/app/dashboard',
    '/app/classes',
    '/app/content',
    '/app/billing',
    '/app/parent',
    '/app/student',
  ]);
  if (appPages.has(pathname)) return `${pathname.slice(1)}.html`;
  return null;
}

async function sendPublicHtml(
  res: Response,
  filePath: string,
  config: AppConfig,
  canonicalPath: string,
) {
  const html = await readFile(filePath, 'utf8');
  res
    .type('html')
    .set('Cache-Control', config.isProduction ? 'public, max-age=3600' : 'no-cache')
    .send(rewritePublicMetadata(html, config.publicBaseUrl, canonicalPath));
}

function rewritePublicMetadata(html: string, publicBaseUrl: string, canonicalPath: string) {
  const metadataUrl = publicMetadataUrl(publicBaseUrl, canonicalPath);
  return html
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${metadataUrl}">`)
    .replace(
      /<meta property="og:url" content="[^"]*">/,
      `<meta property="og:url" content="${metadataUrl}">`,
    );
}

function publicMetadataUrl(publicBaseUrl: string, canonicalPath: string) {
  const origin = new URL(publicBaseUrl).origin;
  if (!canonicalPath.startsWith('/') || canonicalPath.startsWith('//')) {
    throw new Error('Canonical public metadata paths must be root-relative.');
  }
  return new URL(canonicalPath, `${origin}/`).toString();
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

async function requireRecentEmailAssurance(
  req: RequestWithTrace,
  res: Response,
  pool: DbPool,
  session: AuthenticatedSession,
) {
  const verified = await verifyRecentEmailAssurance({ pool, sessionKey: session.session_key });
  if (verified) return true;
  res.status(403).json({
    success: false,
    code: 'EMAIL_ASSURANCE_REQUIRED',
    message: 'Please confirm this sign-in by email before continuing.',
    request_id: req.traceId,
  });
  return false;
}

async function ot110aActorFromSession(
  pool: DbPool,
  config: AppConfig,
  session: AuthenticatedSession,
) {
  return resolveOt110aContentAdminActor({
    pool,
    config,
    user: {
      user_key: session.user.user_key,
      role: session.user.role,
    },
  });
}

async function handleOt110aSourceAction(
  req: RequestWithTrace,
  res: Response,
  pool: DbPool,
  config: AppConfig,
  actionType:
    | 'transcript.approve'
    | 'artifact.approve'
    | 'artifact.publish'
    | 'content.retry'
    | 'content.retract'
    | 'social.approve'
    | 'social.schedule'
    | 'social.retract',
) {
  setPrivateNoStore(res);
  const session = await requireApiSession(req, res, pool, config);
  if (!session) return;
  if (!(await requireSessionCsrf(req, res, pool, session))) return;
  try {
    const actor = await ot110aActorFromSession(pool, config, session);
    const payload = contentAdminActionPayloadSchema.parse(req.body);
    const action = await withTiming(req, 'db', () =>
      performOt110aContentAction({
        pool,
        config,
        actor,
        sourceKey: String(req.params.sourceKey),
        actionType,
        reason: payload.reason,
        ...(payload.expected_revision_key
          ? { expectedRevisionKey: payload.expected_revision_key }
          : {}),
      }),
    );
    res.json(contentAdminActionResponseSchema.parse({ success: true, action }));
  } catch (error) {
    handleApiError(error, req, res);
  }
}

async function completeEmailChallengeLogin(
  req: RequestWithTrace,
  res: Response,
  pool: DbPool,
  config: AppConfig,
  verified: EmailChallengeVerificationResult,
  returnTo: string | undefined,
) {
  if (!verified.ok) {
    const status = verified.code === 'RATE_LIMITED' ? 429 : 401;
    if (verified.retry_after_seconds) {
      res.setHeader('retry-after', String(verified.retry_after_seconds));
    }
    res.status(status).json({
      success: false,
      code: verified.code,
      message:
        verified.code === 'RATE_LIMITED'
          ? 'Please wait before trying another code.'
          : 'Email or password is not correct.',
      request_id: req.traceId,
    });
    return;
  }

  const rotatedFromSessionKey = await revokeSession({
    pool,
    config,
    sessionToken: getCookie(req, SESSION_COOKIE),
    reason: 'email_challenge_login_rotation',
    ip: req.ip,
    userAgent: req.header('user-agent') ?? undefined,
  });
  const session = await createSession({
    pool,
    config,
    user: verified.user,
    ip: req.ip,
    userAgent: req.header('user-agent') ?? undefined,
    rotatedFromSessionKey: rotatedFromSessionKey ?? undefined,
    assuranceMethod: verified.assuranceMethod,
  });
  setAuthCookies(res, config, session.session_token, session.csrf_token);
  if (verified.trustedDeviceToken && verified.trustedDeviceExpiresAt) {
    setTrustedDeviceCookie(
      res,
      config,
      verified.trustedDeviceToken,
      verified.trustedDeviceExpiresAt,
    );
  }
  res.status(200).json({
    success: true,
    user: session.user,
    csrf_token: session.csrf_token,
    return_to: safeReturnPath(returnTo, config) ?? defaultRouteForRole(session.user.role),
  });
}

function handleEmailChallengeRouteError(error: unknown, req: RequestWithTrace, res: Response) {
  if (res.headersSent) return;
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
    .json(publicError('SERVER_ERROR', 'Email confirmation is unavailable right now.', req.traceId));
}

function retiredAuthMethod(res: Response, req: RequestWithTrace) {
  res.status(410).json({
    success: false,
    code: 'AUTH_METHOD_RETIRED',
    message: 'This sign-in method has been retired. Please use email login.',
    request_id: req.traceId,
  });
}

function requireSameOriginPost(req: RequestWithTrace, res: Response, config: AppConfig) {
  if (isSameOriginPost(req, config)) return true;
  res.status(403).json(publicError('FORBIDDEN', 'Refresh the page and try again.', req.traceId));
  return false;
}

function providerCanaryAllowlist(config: AppConfig, env: NodeJS.ProcessEnv) {
  const values = [
    'ops05_fixture_webhook',
    config.deliveryTestCanaryEmail,
    config.whatsappCanaryRecipientE164,
    env.ONE_TIME_TELEGRAM_CANARY_CHAT_REF,
    env.ONE_TIME_STRIPE_TEST_CANARY_FIXTURE,
    env.ONE_TIME_HELPER_FIXTURE_ALLOWLIST,
    env.BUFFER_CANARY_DESTINATION_ALLOWLIST,
  ];
  return values.filter(
    (value): value is string => typeof value === 'string' && value.trim() !== '',
  );
}

function stripCsrfField(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const rest = { ...(body as Record<string, unknown>) };
  delete rest.csrf_token;
  return rest;
}

function statusForCanaryPlanCode(code: string) {
  if (code === 'VALIDATION_ERROR') return 400;
  if (code === 'RECENT_EMAIL_ASSURANCE_REQUIRED') return 428;
  return 403;
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

function createBillingRuntime(config: AppConfig, pool: DbPool) {
  const repositories = createPostgresBillingRepositories(pool);
  const billingConfig = parseOt87StripeTestBillingConfig(billingEnv(process.env), {
    accountKey: config.accountKey,
    productKey: config.productKey,
    canonicalPublicOrigin: config.publicBaseUrl,
  });
  const secrets = readOt87StripeRuntimeSecrets(billingEnv(process.env));
  const providerAccountRef = billingConfig.expectedProviderAccountRef
    ? {
        provider: 'stripe' as const,
        mode: 'test' as const,
        provider_account_ref: billingConfig.expectedProviderAccountRef,
      }
    : null;
  const providerAdapter =
    providerAccountRef && secrets.secretKey && secrets.webhookSecret
      ? createStripeTestBillingProviderAdapter({
          providerAccountRef,
          webhookSecret: secrets.webhookSecret,
          redirectVault: { store: (entry) => repositories.storeRedirect(entry) },
          portalConfigurationRef: billingConfig.providerPortalConfigurationRef ?? undefined,
          client: createOfficialStripeTestClient(secrets.secretKey),
        })
      : disabledBillingProviderAdapter();
  return {
    config: billingConfig,
    repositories,
    providerAdapter,
    authorization: createBillingAuthorizationAdapter(pool, config),
  };
}

function billingEnv(source: NodeJS.ProcessEnv) {
  const names = [
    'LIVE_STRIPE_CHARGES_AUTHORIZED',
    'ENABLE_PAYMENT_TRANSPORT',
    'ENABLE_STRIPE_TEST_CHECKOUT',
    'ENABLE_STRIPE_TEST_PORTAL',
    'ENABLE_STRIPE_TEST_WEBHOOKS',
    'ENABLE_STRIPE_TEST_WEBHOOK_PROJECTION',
    'ENABLE_STRIPE_TEST_RECONCILIATION',
    'ONE_TIME_ENTITLEMENT_EMERGENCY_MODE',
    'ONE_TIME_BILLING_CANONICAL_PUBLIC_ORIGIN',
    'ONE_TIME_STRIPE_TEST_SECRET_KEY',
    'ONE_TIME_STRIPE_TEST_WEBHOOK_SECRET',
    'ONE_TIME_STRIPE_TEST_ACCOUNT_ID',
    'ONE_TIME_STRIPE_TEST_PRODUCT_ID',
    'ONE_TIME_STRIPE_TEST_PRICE_ID',
    'ONE_TIME_STRIPE_TEST_PORTAL_CONFIGURATION_ID',
    'ONE_TIME_STRIPE_TEST_WEBHOOK_ENDPOINT_ID',
    'ONE_TIME_STRIPE_TEST_PUBLISHABLE_KEY',
  ];
  return Object.fromEntries(names.map((name) => [name, source[name]]));
}

function disabledBillingProviderAdapter(): BillingProviderAdapter {
  const unavailable = async () => {
    throw new Error('Stripe test billing provider is not configured.');
  };
  const fixture = createFixtureBillingProviderAdapter({
    providerAccountRef: {
      provider: 'stripe',
      mode: 'test',
      provider_account_ref: 'acct_disabled_ot87',
    },
  });
  return {
    ...fixture,
    createCheckoutSession: unavailable,
    createCustomerPortalSession: unavailable,
    verifyWebhook: unavailable,
    reconcileBillingPrincipal: async () => ({
      status: 'failed',
      reason: 'stripe_test_provider_not_configured',
    }),
  };
}

async function billingActorFromRequest(
  req: Request,
  pool: DbPool,
  config: AppConfig,
): Promise<BillingActorContext> {
  const session = await sessionFromRequest(req, pool, config);
  if (!session) return { actor_key: 'anonymous', role: 'public', active: false };
  return {
    actor_key: session.user.user_key,
    role: session.user.role,
    active: true,
  };
}

async function verifyBillingCsrf(req: Request, pool: DbPool, config: AppConfig) {
  const session = await sessionFromRequest(req, pool, config);
  if (!session) return false;
  return verifySessionCsrf({
    pool,
    sessionKey: session.session_key,
    csrfToken: req.header('x-csrf-token') ?? req.body?.csrf_token,
  });
}

function createBillingAuthorizationAdapter(
  pool: DbPool,
  config: AppConfig,
): BillingAuthorizationAdapter {
  return {
    async resolvePrincipal({ actor, requested_principal_key }) {
      if (!actor.active || actor.role === 'public') return { ok: false, reason: 'anonymous' };
      if (actor.role === 'parent') {
        const household = await pool.query(
          `SELECT 1
             FROM onetime.portal_guardian_relationships AS relationships
             JOIN onetime.portal_households AS households
               ON households.account_key = relationships.account_key
              AND households.product_key = relationships.product_key
              AND households.household_key = relationships.household_key
            WHERE relationships.account_key = $1
              AND relationships.product_key = $2
              AND relationships.guardian_user_ref = $3
              AND relationships.household_key = $4
              AND relationships.status = 'active'
              AND relationships.authority <> 'support_only'
              AND households.status = 'active'
            LIMIT 1`,
          [config.accountKey, config.productKey, actor.actor_key, requested_principal_key],
        );
        if (!household.rowCount) return { ok: false, reason: 'wrong_scope' };
        return {
          ok: true,
          principal: {
            principal_key: requested_principal_key,
            principal_type: 'opaque',
            account_key: config.accountKey,
            product_key: config.productKey,
          },
          capabilities: ['billing:read', 'billing:checkout', 'billing:portal'],
        };
      }
      if (actor.role === 'owner' || actor.role === 'admin') {
        const household = await pool.query(
          `SELECT 1
             FROM onetime.portal_households
            WHERE account_key = $1
              AND product_key = $2
              AND household_key = $3
            LIMIT 1`,
          [config.accountKey, config.productKey, requested_principal_key],
        );
        if (!household.rowCount) return { ok: false, reason: 'unknown_principal' };
        return {
          ok: true,
          principal: {
            principal_key: requested_principal_key,
            principal_type: 'opaque',
            account_key: config.accountKey,
            product_key: config.productKey,
          },
          capabilities: ['billing:read', 'billing:reconcile'],
        };
      }
      return { ok: false, reason: 'insufficient_capability' };
    },
  };
}

function createParentBillingSummaryAdapter(
  config: BillingFeatureConfig,
  repositories: ReturnType<typeof createPostgresBillingRepositories>,
): NonNullable<PortalServiceDeps['billing']> {
  return {
    summaryForHousehold: async ({ household }) => {
      const principal = {
        principal_key: household.household_key,
        principal_type: 'opaque' as const,
        account_key: config.offerMappings[0]?.account_key ?? 'one_time',
        product_key: config.offerMappings[0]?.product_key ?? 'one_time_mishnah_class',
      };
      const summary = await repositories.summary(principal);
      const customerPortalAvailable =
        config.transportEnabled && config.customerPortalEnabled && Boolean(summary.customer);
      return {
        enabled: config.foundationEnabled,
        summary_label: summary.entitlement?.status ?? 'Not active',
        plan_truth: 'Family plan — $67/month — up to 3 active learners in one household.',
        entitlement_status: summary.entitlement?.status ?? null,
        grants_access: summary.entitlement?.grants_access === true,
        checkout_available:
          config.transportEnabled && config.checkoutEnabled && config.offerMappings.length === 1,
        customer_portal_available: customerPortalAvailable,
        recovery_required:
          summary.entitlement?.status === 'suspended' ||
          summary.subscription?.status === 'past_due' ||
          summary.subscription?.status === 'unpaid',
        current_period_end: summary.subscription?.current_period_end
          ? toIso(summary.subscription.current_period_end)
          : null,
        cancel_at_period_end: summary.subscription?.cancel_at_period_end === true,
      };
    },
  };
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
      'gamification:read',
      'gamification:write',
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
      'gamification:read',
      'helper:query',
    ];
  }
  if (role === 'owner' || role === 'admin') {
    return [
      'rewards:read',
      'rewards:write',
      'gamification:read',
      'gamification:write',
      'gamification:admin',
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
  if (error instanceof CrmReplyError) {
    res.status(error.status).json({
      success: false,
      code: error.code,
      message: error.message,
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
  if (error instanceof ContentFactoryError) {
    const status =
      error.code === 'FORBIDDEN'
        ? 403
        : error.code === 'NOT_FOUND'
          ? 404
          : error.code === 'VALIDATION_ERROR'
            ? 400
            : 409;
    res.status(status).json({
      success: false,
      code: error.code,
      message: error.message,
      request_id: req.traceId,
    });
    return;
  }
  if (error instanceof Ot110aContentWorkspaceError) {
    res.status(statusForOt110aError(error.code)).json({
      success: false,
      code: error.code,
      message: error.message,
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
  if (code === 'RATE_LIMITED') return 429;
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

function statusForOt110aError(code: string) {
  if (code === 'FORBIDDEN') return 403;
  if (code === 'NOT_FOUND') return 404;
  if (code === 'VALIDATION_ERROR') return 400;
  if (code === 'VERSION_CONFLICT' || code === 'PROMPT_PATCH_NOOP') return 409;
  return 500;
}

function canReadClasses(role: string) {
  return role === 'owner' || role === 'admin';
}

function canReadContacts(role: string) {
  return role === 'owner' || role === 'admin' || role === 'crm_agent' || role === 'viewer';
}

function canReadContentLibrary(role: string) {
  return role === 'owner' || role === 'admin';
}

function isContentFactoryAdmin(session: AuthenticatedSession) {
  return session.user.role === 'owner' || session.user.role === 'admin';
}

function canUseOwnerDashboard(role: string) {
  return role === 'owner' || role === 'admin';
}

function canUseSocialPublishing(role: string) {
  return role === 'owner' || role === 'admin';
}

function ot86PublishSecrets(config: AppConfig) {
  const current =
    config.ot86PublishSigningKeyId && config.ot86PublishSigningSecret
      ? [{ keyId: config.ot86PublishSigningKeyId, secret: config.ot86PublishSigningSecret }]
      : [];
  const previous =
    config.ot86PreviousPublishSigningKeyId && config.ot86PreviousPublishSigningSecret
      ? [
          {
            keyId: config.ot86PreviousPublishSigningKeyId,
            secret: config.ot86PreviousPublishSigningSecret,
          },
        ]
      : [];
  return [...current, ...previous];
}

function ot86bBufferEnv(config: AppConfig): NodeJS.ProcessEnv {
  return {
    BUFFER_ACCESS_TOKEN: config.bufferAccessToken,
    BUFFER_ORGANIZATION_ID: config.bufferOrganizationId,
    BUFFER_DESTINATION_IDS: config.bufferDestinationIds,
  };
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

function setTrustedDeviceCookie(
  res: Response,
  config: AppConfig,
  trustedDeviceToken: string,
  trustedUntil: string,
) {
  const maxAge = Math.max(0, new Date(trustedUntil).getTime() - Date.now());
  if (maxAge <= 0) return;
  res.cookie(TRUSTED_DEVICE_COOKIE, trustedDeviceToken, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge,
  });
}

function clearTrustedDeviceCookie(res: Response, config: AppConfig) {
  res.clearCookie(TRUSTED_DEVICE_COOKIE, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/',
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

function requireLoginCsrf(req: Request, _res: Response, config: AppConfig, submitted: string) {
  if (
    !verifyLoginCsrf(config, getCookie(req, CSRF_COOKIE), submitted ?? req.header('x-csrf-token'))
  ) {
    throw new PublicRouteError(403, 'CSRF_REQUIRED', 'Refresh the page and try again.');
  }
}

function statusForLifecycleCode(code: string) {
  if (code === 'TOKEN_EXPIRED' || code === 'TOKEN_CONSUMED') return 410;
  if (code === 'RATE_LIMITED') return 429;
  if (code === 'FORBIDDEN') return 403;
  if (code === 'IDEMPOTENCY_CONFLICT') return 409;
  if (code === 'NOT_FOUND') return 404;
  return 400;
}

function lifecycleMessage(code: string) {
  if (code === 'TOKEN_EXPIRED') return 'That link has expired. Please request a fresh one.';
  if (code === 'TOKEN_CONSUMED') return 'That link was already used.';
  if (code === 'TOKEN_INVALID') return 'That link is invalid or has been superseded.';
  if (code === 'RATE_LIMITED') return 'Please wait before trying again.';
  return 'We could not complete that request.';
}

function handleLifecycleRouteError(
  error: unknown,
  req: RequestWithTrace,
  res: Response,
  fallbackMessage: string,
) {
  if (res.headersSent) return;
  if (error instanceof PublicRouteError) {
    res.status(error.status).json({
      success: false,
      code: error.code,
      message: error.publicMessage,
      request_id: req.traceId,
    });
    return;
  }
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
  if (error instanceof AccountLifecycleError) {
    res.status(statusForLifecycleCode(error.code)).json({
      success: false,
      code: error.code,
      message: lifecycleMessage(error.code),
      request_id: req.traceId,
    });
    return;
  }
  res.status(500).json(publicError('SERVER_ERROR', fallbackMessage, req.traceId));
}

function defaultRouteForRole(role: string) {
  if (role === 'owner' || role === 'admin') return '/app/dashboard';
  if (role === 'parent') return '/app/parent';
  if (role === 'student') return '/app/student';
  return '/app/crm';
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
        <span><strong>One Time Mishnayos</strong><small>Member access</small></span>
      </a>
      <h1>Welcome back</h1>
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
        <div class="email-challenge" data-email-challenge hidden>
          <div class="field">
            <label for="email_code">Verification code</label>
            <input id="email_code" name="email_code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}">
            <p tabindex="-1" class="error" data-error-for="email_code"></p>
          </div>
          <label class="consent trusted-device">
            <input type="checkbox" name="trust_device" value="true">
            <span>Trust this device for 30 days</span>
          </label>
          <div class="email-challenge-actions">
            <button class="button" type="button" data-resend-challenge disabled>Resend code</button>
            <span class="form-status" role="status" data-resend-status></span>
          </div>
        </div>
        <button class="button button-primary" type="submit">Login</button>
        <a class="form-link" href="/forgot-password">Forgot password?</a>
        <p class="form-status" role="status" data-form-status></p>
      </form>
    </section>
  </main>
  <script type="module" src="/assets/public.js"></script>
</body>
</html>`;
}

function activationPageHtml(csrfToken: string) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Activate account | One Time Mishnayos</title>
  <meta name="robots" content="noindex, nofollow">
  <meta name="referrer" content="no-referrer">
  <meta name="theme-color" content="#050505">
  <link rel="stylesheet" href="/assets/public.css">
</head>
<body>
  <main class="login-page account-flow-page">
    <section class="login-panel account-flow-panel" data-activation-root>
      <a class="brand-lockup login-brand" href="/" aria-label="One Time Mishnayos home">
        <img src="/assets/brand/onetimelogo.webp" width="56" height="56" alt="" aria-hidden="true">
        <span><strong>One Time Mishnayos</strong><small>Account activation</small></span>
      </a>
      <h1>Set your password</h1>
      <p class="flow-copy" data-activation-status role="status">Checking your secure link.</p>
      <form class="login-form" data-activation-form novalidate hidden>
        <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}">
        <div class="field">
          <label for="activation_password">Password</label>
          <input id="activation_password" name="password" type="password" autocomplete="new-password" required minlength="8">
          <p tabindex="-1" class="error" data-error-for="password"></p>
        </div>
        <div class="field">
          <label for="activation_password_confirm">Confirm password</label>
          <input id="activation_password_confirm" name="password_confirm" type="password" autocomplete="new-password" required minlength="8">
          <p tabindex="-1" class="error" data-error-for="password_confirm"></p>
        </div>
        <button class="button button-primary" type="submit">Activate account</button>
        <p class="form-status" role="status" data-form-status></p>
      </form>
      <p class="form-status error" data-activation-error></p>
    </section>
  </main>
  <script type="module" src="/assets/public.js"></script>
</body>
</html>`;
}

function forgotPasswordPageHtml(csrfToken: string) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Forgot password | One Time Mishnayos</title>
  <meta name="robots" content="noindex, nofollow">
  <meta name="referrer" content="no-referrer">
  <meta name="theme-color" content="#050505">
  <link rel="stylesheet" href="/assets/public.css">
</head>
<body>
  <main class="login-page account-flow-page">
    <section class="login-panel account-flow-panel">
      <a class="brand-lockup login-brand" href="/" aria-label="One Time Mishnayos home">
        <img src="/assets/brand/onetimelogo.webp" width="56" height="56" alt="" aria-hidden="true">
        <span><strong>One Time Mishnayos</strong><small>Password help</small></span>
      </a>
      <h1>Reset your password</h1>
      <p class="flow-copy">Enter the email for your account. If it has access, a reset link will be sent.</p>
      <form class="login-form" data-forgot-password-form novalidate>
        <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}">
        <div class="field">
          <label for="forgot_email">Email</label>
          <input id="forgot_email" name="email" type="email" autocomplete="username" required>
          <p tabindex="-1" class="error" data-error-for="email"></p>
        </div>
        <button class="button button-primary" type="submit">Send reset link</button>
        <p class="form-status" role="status" data-form-status></p>
      </form>
      <a class="form-link" href="/login">Back to login</a>
    </section>
  </main>
  <script type="module" src="/assets/public.js"></script>
</body>
</html>`;
}

function resetPasswordPageHtml(csrfToken: string) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Choose a new password | One Time Mishnayos</title>
  <meta name="robots" content="noindex, nofollow">
  <meta name="referrer" content="no-referrer">
  <meta name="theme-color" content="#050505">
  <link rel="stylesheet" href="/assets/public.css">
</head>
<body>
  <main class="login-page account-flow-page">
    <section class="login-panel account-flow-panel" data-reset-root>
      <a class="brand-lockup login-brand" href="/" aria-label="One Time Mishnayos home">
        <img src="/assets/brand/onetimelogo.webp" width="56" height="56" alt="" aria-hidden="true">
        <span><strong>One Time Mishnayos</strong><small>Password reset</small></span>
      </a>
      <h1>Choose a new password</h1>
      <p class="flow-copy" data-reset-status role="status">Checking your secure link.</p>
      <form class="login-form" data-reset-password-form novalidate hidden>
        <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}">
        <div class="field">
          <label for="reset_password">Password</label>
          <input id="reset_password" name="password" type="password" autocomplete="new-password" required minlength="8">
          <p tabindex="-1" class="error" data-error-for="password"></p>
        </div>
        <div class="field">
          <label for="reset_password_confirm">Confirm password</label>
          <input id="reset_password_confirm" name="password_confirm" type="password" autocomplete="new-password" required minlength="8">
          <p tabindex="-1" class="error" data-error-for="password_confirm"></p>
        </div>
        <button class="button button-primary" type="submit">Reset password</button>
        <p class="form-status" role="status" data-form-status></p>
      </form>
      <a class="form-link" href="/forgot-password">Request a new link</a>
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

function contentFactoryPlayerHtml(playback: Awaited<ReturnType<typeof getContentFactoryPlayback>>) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <meta name="referrer" content="no-referrer">
  <meta name="theme-color" content="#050505">
  <title>${escapeHtml(playback.title)} | One Time Mishnayos</title>
  <link rel="stylesheet" href="/assets/app-crm.css">
</head>
<body>
  <main class="app-workspace learning-player-page" data-protected-player="true">
    <section class="state-panel learning-player-shell" aria-labelledby="learning-player-title">
      <p class="eyebrow">Protected One Time lesson</p>
      <h1 id="learning-player-title">${escapeHtml(playback.title)}</h1>
      <p>${escapeHtml(playback.summary)}</p>
      <div class="protected-player-frame">
        <iframe
          src="${escapeHtml(playback.playbackRoute)}"
          title="${escapeHtml(playback.title)}"
          allow="autoplay; fullscreen; picture-in-picture"
          allowfullscreen
          loading="eager"
        ></iframe>
      </div>
      <dl class="content-factory-safe-metadata">
        <div><dt>Captions</dt><dd>${playback.captionsActive ? 'Active' : 'Unavailable'}</dd></div>
        <div><dt>Progress</dt><dd>${escapeHtml(playback.progressState.replaceAll('_', ' '))}</dd></div>
      </dl>
      <section aria-labelledby="review-questions-title">
        <h2 id="review-questions-title">Review questions</h2>
        <ol>${playback.reviewQuestions.map((question) => `<li>${escapeHtml(question)}</li>`).join('')}</ol>
      </section>
      <p class="ot-guardrail-note">Approved class material only. No raw Vimeo link is displayed.</p>
    </section>
  </main>
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
