import { createHash, createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import helmet from 'helmet';
import { z, ZodError } from 'zod';
import type { AppConfig } from '../../../../packages/config/src/index.ts';
import { asBotKey } from '../../../../packages/contracts/src/telegram/types.ts';
import { inTransaction, type DbPool, type Queryable } from '../../../../packages/db/src/index.ts';
import { createPostgresBillingRepositories } from '../../../../packages/db/src/billing/repository.ts';
import { createPostgresCommercialBillingRepository } from '../../../../packages/db/src/billing/commercial/repository.ts';
import {
  createPostgresPrivacyRepository,
  type PrivacySqlPool,
} from '../../../../packages/db/src/privacy/repository.ts';
import { createClassroomRepository } from '../../../../packages/db/src/classroom/repository.ts';
import { createZoomClassOccurrenceRepository } from '../../../../packages/db/src/classroom/zoom-occurrence-repository.ts';
import { createGamificationRepository } from '../../../../packages/db/src/gamification/repository.ts';
import { createLiveClassRepository } from '../../../../packages/db/src/live-class/repository.ts';
import { createZoomAdminTestResourceRepository } from '../../../../packages/db/src/live-class/zoom-admin-repository.ts';
import { createPortalRepository } from '../../../../packages/db/src/portals/repository.ts';
import { createPostgresStudentNotificationRepository } from '../../../../packages/db/src/notifications/student/index.ts';
import { createPostgresSchoolSignupRepository } from '../../../../packages/db/src/signup/school/repository.ts';
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
  liveClassCommandResponseSchema,
  liveClassConsoleSnapshotSchema,
  liveClassObsCommandPayloadSchema,
  liveClassObsCommandPollResponseSchema,
  liveClassObsCommandReportPayloadSchema,
  liveClassQuestionActionPayloadSchema,
  liveClassQuestionCompletePayloadSchema,
  liveClassQuestionListResponseSchema,
  liveClassQuestionReadyPayloadSchema,
  liveClassQuestionSubmitPayloadSchema,
  liveClassQuestionSubmitResponseSchema,
  liveClassStageResponseSchema,
  liveClassZoomControlPayloadSchema,
  liveClassZoomAdminActionPayloadSchema,
  liveClassZoomAdminStatusResponseSchema,
  liveClassZoomCommandPollResponseSchema,
  liveClassZoomHostBootstrapResponseSchema,
  liveClassZoomParticipantSyncPayloadSchema,
  liveClassZoomParticipantSyncResponseSchema,
  liveClassZoomTestParticipantBootstrapResponseSchema,
  loginPayloadSchema,
  publicFieldErrors,
  updateContactSchema,
  assigneeListResponseSchema,
  classOccurrenceDetailResponseSchema,
  classOccurrenceListQuerySchema,
  classOccurrenceListResponseSchema,
  attachClassRecordingPayloadSchema,
  classEnrollmentCandidateListResponseSchema,
  classEnrollmentListResponseSchema,
  classEnrollmentPayloadSchema,
  classEnrollmentResponseSchema,
  classRecordingAccessListResponseSchema,
  classRecordingListResponseSchema,
  classRecordingResponseSchema,
  classSeriesListResponseSchema,
  classSeriesResponseSchema,
  createClassOccurrencePayloadSchema,
  createClassSeriesPayloadSchema,
  managedClassOccurrenceResponseSchema,
  setClassRecordingAccessPayloadSchema,
  updateClassOccurrencePayloadSchema,
  updateClassSeriesPayloadSchema,
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
  contentAdminSourceDetailResponseSchema,
  contentAdminWorkspaceQuerySchema,
  contentFactoryActionSchema,
  contentFactoryEditPayloadSchema,
  contentFactoryIntakeResponseSchema,
  contentFactoryMutationResponseSchema,
  contentFactoryWorkspaceResponseSchema,
  accomplishmentEventSchema,
  adminGamificationDashboardResponseSchema,
  gamificationCorrectionAuditSchema,
  gamificationCorrectionPayloadSchema,
  gamificationLearningEventPayloadSchema,
} from '../../../../packages/contracts/src/index.ts';
import type { SessionUser } from '../../../../packages/contracts/src/index.ts';
import {
  providerCanaryPlanResponseSchema,
  providerControlCenterResponseSchema,
} from '../../../../packages/contracts/src/providers/control-center.ts';
import type {
  PortalActorContext,
  PortalCapability,
} from '../../../../packages/contracts/src/portals/index.ts';
import { AUTH_SESSION_COOKIE } from '../../../../packages/contracts/src/identity/auth/index.ts';
import type { SchoolSignupScope } from '../../../../packages/contracts/src/signup/school/index.ts';
import {
  CONTENT_PUBLICATION_PRODUCT_KEY,
  type ContentPublicationPrincipal,
  type VimeoContentPublicationReadbackAdapter,
} from '../../../../packages/contracts/src/content/publication/index.ts';
import type { ProviderRegistryBinding } from '../../../../packages/contracts/src/providers/v21-provider-core.ts';
import {
  CrmDuplicateError,
  CrmVersionConflictError,
  ClassManagementError,
  ContentIdempotencyConflictError,
  ContentFactoryError,
  ContentFactoryPublicationError,
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
  changeOwnPassword,
  completePasswordReset,
  completeStudentReset,
  confirmSingleRecipientReply,
  createAccountLifecycleCredentialAdapter,
  createContact,
  createCrmTag,
  createClassPortalAccessAdapter,
  createManagedClassOccurrence,
  createManagedClassSeries,
  createClassroomPortalAccessAdapter,
  createClassroomService,
  createLiveClassService,
  createZoomAdminProvider,
  createZoomAdminService,
  createZoomClassOccurrenceProvider,
  createZoomClassOccurrenceHostLaunchPort,
  createZoomClassOccurrenceService,
  createZoomClassroomPorts,
  createZoomHostLaunchPort,
  createContentPortalAccessAdapter,
  createContentFactoryIntake,
  contentFactoryStorageFromEnv,
  createGamificationService,
  createLoginCsrf,
  createOt110aGeneratedArtifact,
  createOt110aIntegratedProviderPorts,
  createOt110aPromptPatch,
  createParentPortalService,
  createPortalGamificationAdapter,
  createSession,
  currentApplicationAccessForUser,
  createScopedKnowledgeHelperAdapter,
  createStudentPortalService,
  getClassOccurrenceDetail,
  getManagedClassOccurrence,
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
  householdHasLearningAccess,
  readHouseholdAccess,
  inspectAccountLifecycleToken,
  buildOwnerDashboard,
  listClassOccurrences,
  listClassEnrollmentCandidates,
  listClassEnrollments,
  listClassRecordingAccess,
  listClassRecordings,
  listManagedClassSeries,
  listContentLibrary,
  listAssignableUsers,
  listContacts,
  listOt110aActivity,
  listOt110aKnowledgeWorkspace,
  listOt110aPromptTemplates,
  ownerAdminVisibleActions,
  performOt110aContentAction,
  performContentFactoryAction,
  retryContentFactoryIntake,
  previewOt110aPromptPatch,
  listCrmTags,
  previewSingleRecipientReply,
  receiveOt86PublicationManifest,
  receiveOt104rVimeoWebhook,
  requestPasswordReset,
  reactivateContact,
  resolveOt110aContentAdminActor,
  rollbackOt110aPromptVersion,
  revokeSession,
  rotateSessionCsrf,
  removeCrmTag,
  attachRecordingToClass,
  enrollLearnerInClass,
  setClassRecordingLearnerAccess,
  stableKey,
  unenrollLearnerFromClass,
  updateManagedClassOccurrence,
  updateManagedClassSeries,
  updateContact,
  editContentFactoryItem,
  inspectLearningDeliveryInputAdapters,
  CrmReplyError,
  verifyLoginCsrf,
  verifyRecentEmailAssurance,
  verifySessionCsrf,
  type AuthenticatedSession,
  PortalServiceError,
  type PortalServiceDeps,
  type ZoomAdminProviderPort,
  type ZoomClassOccurrenceProvider,
} from '../../../../packages/domain/src/index.ts';
import {
  buildProviderControlCenter,
  planProviderCanary,
} from '../../../../packages/domain/src/providers/control-center.ts';
import { AesGcmPayloadCodec } from '../../../../packages/domain/src/telegram/crypto.ts';
import {
  hashAuthPassword,
  verifyAuthPassword,
} from '../../../../packages/domain/src/auth/policy.ts';
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
} from '../../../../packages/domain/src/billing/types.ts';
import {
  collectOpsReadiness,
  exposeServerTiming,
  logger,
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
import { createResendWebhookRouter } from './features/delivery/resend-webhook-router.ts';
import { createBillingRouter } from './features/billing/router.ts';
import { createHighLevelActionsRouter } from './features/highlevel/actions-router.ts';
import { registerSupportRoutes } from './features/support/router.ts';
import {
  registerSupportV21Routes,
  type SupportV21RouteContext,
} from './features/support/v21-index.ts';
import { leadRateLimit } from './rate-limit.ts';
import { registerOpsRoutes } from './ops-routes.ts';
import { createContactOperationsRouter } from './features/contact-operations/router.ts';
import { createAdminDirectoryRouter } from './features/admin-directory/router.ts';
import {
  AdminOperationsService,
  createAdminOperationsRouter,
} from './features/admin/operations/index.ts';
import {
  authorizeV21ParentRoute,
  createPostgresV21AdultSessionRuntime,
  type V21AdultSessionRuntime,
} from './features/auth/v21-adult-session.ts';
import { databaseInstant } from './features/auth/database-instant.ts';
import {
  createFamilySignupRouter,
  familySignupFeatureRegistration,
  resolveFamilySignupScope,
} from './features/signup/family/router.ts';
import {
  resolveSchoolSignupScope,
  schoolInquiryFeatureRegistration,
} from './features/signup/school/router.ts';
import { createApprovedSchoolAdminRouter } from './features/signup/school/approved-school-router.ts';
import {
  installCanonicalProtectedRoutes,
  type CanonicalProtectedRoute,
  type CanonicalReadyProtectedRoute,
} from './features/v21-canonical-routes/router.ts';
import { createSchoolSignupService } from './features/signup/school/service.ts';
import {
  classifyDomain,
  classifyDomainTransitionPath,
  domainTransitionFeatureRegistration,
  normalizeDomainTransitionPath,
} from './features/domain-transition/index.ts';
import {
  createParentHouseholdRouter,
  createParentHouseholdService,
  createPostgresParentHouseholdRepository,
} from './features/portals/parent-household/index.ts';
import {
  createParentSummaryService,
  createPostgresParentSummaryRepository,
} from './features/portals/parent-summary/index.ts';
import {
  createParentPreferencesRouter,
  createPostgresParentPreferencesRepository,
} from './features/portals/parent-preferences/index.ts';
import {
  createParentPrivacyRouter,
  createPostgresParentPrivacySubjectRepository,
  createPrivacyService,
  createStudentPrivacyRouter,
  type SelfManagedStudentPrivacyPrincipal,
} from './features/privacy/index.ts';
import {
  createCommercialBillingService,
  createParentCommercialBillingRouter,
} from './features/billing/commercial/index.ts';
import { clearSessionCookieHeader, sessionCookieHeader } from './features/auth/http-security.ts';
import {
  installServerFeatureRouters,
  type ServerFeatureRegistration,
} from './features/registry/index.ts';
import {
  createContentIngestFeatureRegistration,
  type ContentIngestRuntime,
} from './features/content/ingest/index.ts';
import {
  createContentPublicationFeatureRegistration,
  type ContentPublicationRequestIdentity,
} from './features/content/publication/index.ts';
import {
  createLearningComposition,
  createLearningRouter,
  createPostgresLearningActorResolver,
} from './features/learning/index.ts';
import {
  createStudentNotificationRouter,
  createStudentNotificationService,
} from './features/notifications/student/index.ts';
import {
  createEmbeddedClassroomFeatureComposition,
  createEmbeddedClassroomRequestIdentityResolver,
  createPostgresAdminAttendanceRecordReader,
  createPostgresAdminAttendanceSubjectResolver,
  EMBEDDED_CLASSROOM_FEATURE_ID,
  EMBEDDED_CLASSROOM_MOUNT_PATH,
  isEmbeddedClassroomInstalledRuntimeReceipt,
  type EmbeddedClassroomCandidateRuntime,
} from './features/classroom/embedded/index.ts';

type AppDeps = {
  config: AppConfig;
  pool: DbPool;
  distDir?: string;
  clock?: () => Date;
  contentFactoryJobNotifier?: (intakeKey: string) => Promise<void> | void;
  zoomAdminProvider?: ZoomAdminProviderPort;
  zoomClassOccurrenceProvider?: ZoomClassOccurrenceProvider;
  featureRegistrations?: readonly ServerFeatureRegistration[];
  v21AdultSessionRuntime?: V21AdultSessionRuntime;
  learningRuntime?: {
    nativePostgresSchemaProven: boolean;
  };
  embeddedClassroomRuntime?: EmbeddedClassroomCandidateRuntime;
  contentMediaRuntime?: {
    ingest?: ContentIngestRuntime | undefined;
    publication?:
      | {
          providerBinding: ProviderRegistryBinding;
          readbackAdapter: VimeoContentPublicationReadbackAdapter;
        }
      | undefined;
  };
  /** @deprecated Retained only so historical test harnesses compile; no demo route is registered. */
  learningDeliveryDemoReportPath?: string;
};

const SESSION_COOKIE = 'otcrm_session';
const CSRF_COOKIE = 'otcrm_csrf';
const PARENT_STUDENT_PASSWORD_FINGERPRINT_DOMAIN =
  'one-time-parent-student-password-idempotency-v1';
type AccountLifecycleTokenType = z.infer<typeof accountLifecycleTokenTypeSchema>;
const ACTIVATION_TOKEN_TYPES = accountLifecycleTokenTypeSchema.options.filter(
  (tokenType) => tokenType !== 'password_reset',
) as AccountLifecycleTokenType[];

function contentMediaConnectSources(config: AppConfig) {
  if (
    (!config.contentMediaProviderCanary && !config.contentMediaProductionBroad) ||
    !config.contentMediaProvidersReady ||
    config.contentAwsRegion !== 'eu-central-1' ||
    !config.contentS3Bucket ||
    !/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/u.test(config.contentS3Bucket)
  ) {
    return [];
  }
  return [`https://${config.contentS3Bucket}.s3.${config.contentAwsRegion}.amazonaws.com`];
}

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
const authenticatedPasswordChangePayloadSchema = z
  .object({
    current_password: z.string().min(1).max(256),
    new_password: z
      .string()
      .min(10, 'Use at least 10 characters.')
      .max(256)
      .refine((value) => /[A-Za-z]/u.test(value) && /[0-9]/u.test(value), {
        message: 'Use at least one letter and one number.',
      }),
  })
  .strict();
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

export function createApp({
  config,
  pool,
  distDir = path.resolve(process.cwd(), 'dist/apps/web/public'),
  clock,
  contentFactoryJobNotifier,
  zoomAdminProvider,
  zoomClassOccurrenceProvider,
  featureRegistrations,
  v21AdultSessionRuntime: injectedV21AdultSessionRuntime,
  learningRuntime,
  embeddedClassroomRuntime,
  contentMediaRuntime,
}: AppDeps) {
  const v21AdultSessionRuntime =
    injectedV21AdultSessionRuntime ??
    createPostgresV21AdultSessionRuntime({
      db: pool,
      hmacSecret: config.authCsrfSecret,
      ...(clock ? { clock } : {}),
    });
  const resolveApiSession = async (req: Request) => {
    const resolution = await readApiSessionFromRequest(req, {
      pool,
      config,
      v21AdultSessionRuntime,
      ...(clock ? { clock } : {}),
    });
    return resolution.status === 'resolved' ? resolution.session : null;
  };
  const requireApiSession = (
    req: RequestWithTrace,
    res: Response,
    currentPool: DbPool,
    currentConfig: AppConfig,
  ) =>
    requireResolvedApiSession(req, res, {
      pool: currentPool,
      config: currentConfig,
      v21AdultSessionRuntime,
      ...(clock ? { clock } : {}),
    });
  const requireSessionCsrf = (
    req: RequestWithTrace,
    res: Response,
    currentPool: DbPool,
    session: ResolvedApiSession,
  ) =>
    requireResolvedSessionCsrf(req, res, {
      pool: currentPool,
      session,
      v21AdultSessionRuntime,
      ...(clock ? { clock } : {}),
    });
  const resolvePortalActor = (req: Request) =>
    portalActorFromRequest(req, {
      pool,
      config,
      v21AdultSessionRuntime,
      ...(clock ? { clock } : {}),
    });
  const verifyPortalCsrf = async (req: Request, actor: PortalActorContext) => {
    if (!isSameOriginPost(req, config)) return false;
    const session = await resolveApiSession(req);
    return Boolean(
      session &&
      session.session_key === actor.session_key &&
      (await verifyResolvedSessionCsrf(req, {
        pool,
        session,
        v21AdultSessionRuntime,
        ...(clock ? { clock } : {}),
      })),
    );
  };
  const handleOt110aSourceAction = (
    req: RequestWithTrace,
    res: Response,
    currentPool: DbPool,
    currentConfig: AppConfig,
    actionType:
      | 'transcript.approve'
      | 'artifact.approve'
      | 'artifact.publish'
      | 'content.retry'
      | 'content.retract'
      | 'social.approve'
      | 'social.schedule'
      | 'social.retract',
  ) =>
    handleResolvedOt110aSourceAction(
      req,
      res,
      {
        pool: currentPool,
        config: currentConfig,
        v21AdultSessionRuntime,
        ...(clock ? { clock } : {}),
      },
      actionType,
    );
  const centrallyBoundFamilySignupRegistration: ServerFeatureRegistration = {
    ...familySignupFeatureRegistration,
    createRouter: ({ config: featureConfig, pool: featurePool, clock: featureClock }) =>
      createFamilySignupRouter({
        config: featureConfig,
        pool: featurePool,
        ...(featureClock ? { clock: featureClock } : {}),
        sessionEstablisher: v21AdultSessionRuntime,
      }),
  };
  const centrallyBoundDomainTransitionRegistration: ServerFeatureRegistration = {
    ...domainTransitionFeatureRegistration,
    createRouter: (context) => {
      const transitionRouter = domainTransitionFeatureRegistration.createRouter(context);
      const router = express.Router();
      router.use((req, res, next) => {
        if (
          (context.config.nodeEnv !== 'production' &&
            classifyDomain(req.header('host') ?? '') === 'unknown') ||
          isConfiguredIsolatedStagingHost(context.config, req.header('host'))
        ) {
          next();
          return;
        }
        transitionRouter(req, res, next);
      });
      return router;
    },
  };
  const centrallyBoundContentPublicationRegistration = createContentPublicationFeatureRegistration({
    resolveIdentity: (req) => contentPublicationIdentityFromRequest(req, pool, config),
    verifyCsrf: async (req, identity) => {
      const csrfToken = req.header('x-csrf-token') ?? req.body?.csrf_token;
      return verifySessionCsrf({ pool, sessionKey: identity.sessionKey, csrfToken });
    },
    providerBinding: contentMediaRuntime?.publication?.providerBinding,
    vimeoReadbackAdapter: contentMediaRuntime?.publication?.readbackAdapter,
  });
  const centrallyBoundContentIngestRegistration = createContentIngestFeatureRegistration({
    resolveIdentity: async (req) => {
      const identity = await contentPublicationIdentityFromRequest(req, pool, config);
      if (!identity || identity.principal.role !== 'admin') return null;
      return {
        sessionKey: identity.sessionKey,
        actor: {
          principalId: identity.principal.actorId,
          role: 'admin',
          accountKey: identity.principal.accountKey,
          productKey: identity.principal.productKey,
        },
      };
    },
    verifyCsrf: async (req, identity) => {
      const csrfToken = req.header('x-csrf-token') ?? req.body?.csrf_token;
      return verifySessionCsrf({ pool, sessionKey: identity.sessionKey, csrfToken });
    },
    runtime: contentMediaRuntime?.ingest,
  });
  const centrallyBoundFeatureRegistrations: readonly ServerFeatureRegistration[] = (
    featureRegistrations ?? [
      domainTransitionFeatureRegistration,
      familySignupFeatureRegistration,
      schoolInquiryFeatureRegistration,
      centrallyBoundContentIngestRegistration,
      centrallyBoundContentPublicationRegistration,
    ]
  ).map((registration) =>
    registration.featureId === domainTransitionFeatureRegistration.featureId
      ? centrallyBoundDomainTransitionRegistration
      : registration.featureId === familySignupFeatureRegistration.featureId
        ? centrallyBoundFamilySignupRegistration
        : registration,
  );
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
          connectSrc: ["'self'", ...contentMediaConnectSources(config)],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
          frameSrc: ["'self'", 'https://player.vimeo.com'],
        },
      },
    }),
  );
  app.use(traceMiddleware);
  app.get('/health', (_req, res) => {
    setPrivateNoStore(res);
    res.json({ ok: true, service: 'onetime-web', code: 'PUBLIC_HEALTH_OK' });
  });
  app.use((req, res, next) => {
    if (
      config.nodeEnv !== 'production' ||
      classifyDomain(req.header('host') ?? '') !== 'unknown' ||
      isConfiguredIsolatedStagingHost(config, req.header('host'))
    ) {
      next();
      return;
    }
    setPrivateNoStore(res);
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(404).type('text').send('Not found.');
  });
  app.use(
    '/api/v1/delivery/resend',
    createResendWebhookRouter({ config, pool, ...(clock ? { clock } : {}) }),
  );

  app.post(
    '/api/v1/content/vimeo/webhook',
    express.raw({ type: '*/*', limit: '256kb' }),
    async (req: RequestWithTrace, res) => {
      setPrivateNoStore(res);
      if (!config.contentVimeoWebhookSecret || !config.contentVimeoAccountId) {
        res.status(503).json({
          success: false,
          code: 'VIMEO_WEBHOOK_DISABLED',
          message: 'Vimeo webhook intake is not configured.',
          request_id: req.traceId,
        });
        return;
      }
      const result = await receiveOt104rVimeoWebhook({
        pool,
        rawBody: Buffer.isBuffer(req.body) ? req.body : Buffer.from(''),
        headers: { contentType: req.header('content-type') ?? null },
        secret: config.contentVimeoWebhookSecret,
        expectedAccountId: config.contentVimeoAccountId,
        ...(clock ? { now: clock() } : {}),
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
      codec: new AesGcmPayloadCodec(`${config.protectedPayloadEncryptionKey}:telegram-payload-v1`),
    });
    app.post('/api/v1/telegram/one-time/webhook', (req, res) => {
      void telegramWebhook(req, res).catch(() => {
        if (!res.headersSent) res.status(500).json({ ok: false });
      });
    });
  }

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

  registerSupportRoutes({
    app,
    config,
    pool,
    distDir,
    session: {
      sessionFromRequest: (req) => sessionFromRequest(req, pool, config),
      ensureSessionCsrfCookie: (req, res, session) =>
        ensureSessionCsrfCookie(req, res, pool, config, session),
      requireSessionCsrf: (req, res, session) =>
        requireSessionCsrf(req, res, pool, { ...session, session_model: 'legacy' }),
      setPrivateNoStore,
    },
  });
  registerSupportV21Routes({
    app,
    pool,
    ...(clock ? { now: clock } : {}),
    session: {
      resolve: (req, res) =>
        resolveSupportV21RouteContext(req, res, {
          pool,
          config,
          v21AdultSessionRuntime,
          ...(clock ? { clock } : {}),
        }),
      requireCsrf: (req, res, context) =>
        requireSupportV21Csrf(req, res, context, {
          pool,
          config,
          v21AdultSessionRuntime,
          ...(clock ? { clock } : {}),
        }),
      setPrivateNoStore,
    },
  });

  if (config.legacyBillingRuntimeEnabled) {
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
  } else {
    app.use('/api/v1/billing', (_req, res) => {
      setPrivateNoStore(res);
      res.status(404).json({
        success: false,
        code: 'LEGACY_BILLING_RUNTIME_UNAVAILABLE',
        message: 'This application does not expose payment-history or payment-operation routes.',
      });
    });
    app.all(/^\/app\/billing\/(?:checkout|portal)\/redirect\/[^/]+$/, (_req, res) => {
      setPrivateNoStore(res);
      res.status(404).type('text').send('Billing redirect unavailable.');
    });
  }

  app.use(
    '/internal/highlevel/v1/actions',
    express.raw({ type: 'application/json', limit: '32kb' }),
    createHighLevelActionsRouter({ config, pool }),
  );
  app.use(express.json({ limit: '32kb' }));
  app.use(express.urlencoded({ extended: false, limit: '32kb' }));

  const adminOperationsService = new AdminOperationsService(pool, config, clock);
  app.use(
    '/api/v2.1/admin',
    createAdminOperationsRouter({
      config,
      service: adminOperationsService,
      resolveSession: (req, res) =>
        requireAdminDashboardSession(req as RequestWithTrace, res, {
          pool,
          config,
          v21AdultSessionRuntime,
          ...(clock ? { clock } : {}),
        }),
      isSameOrigin: (req) => isSameOriginPost(req, config),
      setPrivateNoStore,
    }),
  );

  const learningScope = {
    accountKey: config.accountKey,
    productKey: config.productKey,
    runtimeTier: config.oneTimeRuntimeTier,
    verificationEnvironmentId: config.oneTimeVerificationEnvironmentId,
  };
  const resolveLearningActor = createPostgresLearningActorResolver({
    pool,
    scope: learningScope,
    resolveSession: async (request) => {
      const session = await sessionFromRequest(request, pool, config);
      return session
        ? {
            sessionKey: session.session_key,
            principalId: session.user.user_key,
            role: session.user.role,
          }
        : null;
    },
  });
  const learningComposition = createLearningComposition({
    pool,
    scope: learningScope,
    aliasHmacKey: config.learningAliasHmacKey,
    aliasHmacKeyConfigured: config.learningAliasHmacKeyConfigured,
    nativePostgresSchemaProven: learningRuntime?.nativePostgresSchemaProven === true,
    contentPublicationWriterMounted: centrallyBoundFeatureRegistrations.some(
      (registration) => registration.featureId === 'onetime.content-publication',
    ),
    ...(clock ? { clock } : {}),
  });
  if (
    centrallyBoundFeatureRegistrations.some(
      (registration) =>
        registration.featureId === EMBEDDED_CLASSROOM_FEATURE_ID ||
        registration.mountPath === EMBEDDED_CLASSROOM_MOUNT_PATH,
    )
  ) {
    throw new Error('embedded_classroom_registration_is_centrally_owned');
  }
  const embeddedClassroomComposition = createEmbeddedClassroomFeatureComposition({
    attendanceProjectionChanges: learningComposition.attendanceProjectionChanges,
    identities: createEmbeddedClassroomRequestIdentityResolver({
      scope: {
        product: 'one_time_mishnayos',
        runtime_tier: config.oneTimeRuntimeTier,
        verification_environment_id: config.oneTimeVerificationEnvironmentId,
      },
      publicOrigin: config.publicBaseUrl,
      lineageSecret: config.authCsrfSecret,
      resolvePortalActor,
      verifyCsrf: (request, actor) => verifyPortalCsrf(request, actor),
    }),
    candidateRuntime: {
      ...embeddedClassroomRuntime,
      adminAttendanceSubjects:
        embeddedClassroomRuntime?.adminAttendanceSubjects ??
        createPostgresAdminAttendanceSubjectResolver({ pool, accountKey: config.accountKey }),
      adminAttendanceRecords:
        embeddedClassroomRuntime?.adminAttendanceRecords ??
        createPostgresAdminAttendanceRecordReader({ pool, accountKey: config.accountKey }),
    },
  });
  installServerFeatureRouters({
    app,
    context: {
      config,
      pool,
      distDir,
      ...(clock ? { clock } : {}),
    },
    registrations: centrallyBoundFeatureRegistrations,
  });
  installServerFeatureRouters({
    app,
    context: {
      config,
      pool,
      distDir,
      ...(clock ? { clock } : {}),
    },
    registrations: [embeddedClassroomComposition.registration],
  });
  const embeddedClassroomInstalledReceipt = embeddedClassroomComposition.readInstalledReceipt();
  if (!isEmbeddedClassroomInstalledRuntimeReceipt(embeddedClassroomInstalledReceipt)) {
    throw new Error('embedded_classroom_runtime_receipt_unavailable');
  }
  app.locals.embeddedClassroomInstalledRuntimeReceipt = embeddedClassroomInstalledReceipt;

  app.use(
    '/api/app/learning',
    createLearningRouter({
      service: learningComposition.service,
      enabled: learningComposition.enabled,
      blockers: learningComposition.blockers,
      resolveActor: resolveLearningActor,
      verifyCsrf: (request, authenticated) =>
        verifySessionCsrf({
          pool,
          sessionKey: authenticated.sessionKey,
          csrfToken: request.header('x-csrf-token') ?? request.body?.csrf_token,
        }),
      ...(clock ? { clock } : {}),
    }),
  );

  const studentNotificationService = createStudentNotificationService({
    repository: createPostgresStudentNotificationRepository(pool),
    authorizeAction: async ({ principal, notification }) =>
      principal.studentId === notification.recipientStudentId &&
      principal.studentId === notification.scope.studentId,
  });
  app.use(
    '/api/app/student/notifications',
    createStudentNotificationRouter({
      service: studentNotificationService,
      resolvePrincipal: async (request) => {
        const authenticated = await resolveLearningActor(request);
        if (!authenticated || authenticated.actor.role !== 'student') return null;
        return {
          principal: { studentId: authenticated.actor.studentId },
          sessionKey: authenticated.sessionKey,
        };
      },
      verifyCsrf: (request, authenticated) =>
        verifySessionCsrf({
          pool,
          sessionKey: authenticated.sessionKey,
          csrfToken: request.header('x-csrf-token') ?? request.body?.csrf_token,
        }),
      ...(clock ? { clock } : {}),
    }),
  );

  const parentStudentServiceAccountVersion = config.parentStudentServiceAccountVersion;
  const parentStudentServiceAccountEvidenceReference =
    config.parentStudentServiceAccountEvidenceReference;
  app.use(
    '/api/app/parent',
    createParentPreferencesRouter({
      repository: createPostgresParentPreferencesRepository(pool, {
        account_key: config.accountKey,
        product: 'one_time_mishnayos',
        runtime_tier: config.oneTimeRuntimeTier,
        verification_environment_id: config.oneTimeVerificationEnvironmentId,
      }),
      sessions: v21AdultSessionRuntime,
      ...(clock ? { clock } : {}),
    }),
  );
  const privacyScope = {
    product: 'one_time_mishnayos' as const,
    runtime_tier: config.oneTimeRuntimeTier,
    verification_environment_id: config.oneTimeVerificationEnvironmentId,
  };
  const privacyRepository = createPostgresPrivacyRepository(pool);
  app.use(
    '/api/app/student',
    createStudentPrivacyRouter({
      service: createPrivacyService(privacyRepository, privacyScope),
      recordConsent: (command) =>
        inTransaction(pool, async (client) => {
          const transactionalRepository = createPostgresPrivacyRepository(
            privacySqlPoolForQueryable(client),
          );
          const result = await createPrivacyService(
            transactionalRepository,
            privacyScope,
          ).recordConsent(command);
          if (
            result.disposition === 'appended' &&
            command.scope === 'recording_participation' &&
            command.choice === 'withdrawn'
          ) {
            await client.query(
              `UPDATE onetime.classroom_launch_grants_v21
                  SET revoked_at = $1,
                      version = version + 1
                WHERE student_id = $2
                  AND household_id = $3
                  AND product = $4
                  AND runtime_tier = $5
                  AND verification_environment_id = $6
                  AND expires_at > $1
                  AND revoked_at IS NULL
                  AND used_at IS NULL`,
              [
                command.occurred_at,
                command.subject.student_id,
                command.subject.household_id,
                privacyScope.product,
                privacyScope.runtime_tier,
                privacyScope.verification_environment_id,
              ],
            );
          }
          return result;
        }),
      repository: privacyRepository,
      scope: privacyScope,
      resolvePrincipal: (request) =>
        selfManagedStudentPrivacyPrincipalFromRequest(request, pool, config),
      issueCsrfToken: async (request, response) => {
        const session = await sessionFromRequest(request, pool, config);
        if (!session || session.user.role !== 'student') {
          throw new Error('student_privacy_session_unavailable');
        }
        return ensureSessionCsrfCookie(request, response, pool, config, session);
      },
      verifyCsrf: async (request, principal) =>
        isSameOriginPost(request, config) &&
        (await verifySessionCsrf({
          pool,
          sessionKey: principal.session_id,
          csrfToken: request.header('x-csrf-token') ?? request.body?.csrf_token,
        })),
      verifyPassword: async (principal, password) => {
        const result = await pool.query(
          `SELECT password_hash
             FROM onetime.account_users
            WHERE account_key = $1
              AND product_key = $2
              AND user_key = $3
              AND role = 'student'
              AND status = 'active'
            LIMIT 1`,
          [config.accountKey, config.productKey, principal.credential_id],
        );
        const passwordHash = result.rows[0]?.password_hash;
        return typeof passwordHash === 'string' && verifyAuthPassword(password, passwordHash);
      },
      networkEvidenceDigest: (request) =>
        createHmac('sha256', config.authCsrfSecret)
          .update('student-privacy-network-v1', 'utf8')
          .update('\0', 'utf8')
          .update(request.ip ?? '', 'utf8')
          .update('\0', 'utf8')
          .update(request.header('user-agent') ?? '', 'utf8')
          .digest('hex'),
      ...(clock ? { clock } : {}),
    }),
  );
  app.use(
    '/api/app/parent',
    createParentPrivacyRouter({
      service: createPrivacyService(privacyRepository, privacyScope),
      repository: privacyRepository,
      subjects: createPostgresParentPrivacySubjectRepository(pool, privacyScope),
      sessions: v21AdultSessionRuntime,
      scope: privacyScope,
      verifyPassword: async (context, password) => {
        const result = await pool.query(
          `SELECT password_hash
             FROM onetime.v21_adult_credentials
            WHERE human_account_id = $1
              AND adult_id = $2
              AND credential_state = 'active'
              AND product_key = $3
              AND runtime_tier = $4
              AND verification_environment_id = $5
            LIMIT 1`,
          [
            context.session.humanAccountId,
            context.adultId,
            privacyScope.product,
            privacyScope.runtime_tier,
            privacyScope.verification_environment_id,
          ],
        );
        const passwordHash = result.rows[0]?.password_hash;
        return typeof passwordHash === 'string' && verifyAuthPassword(password, passwordHash);
      },
      networkEvidenceDigest: (request) =>
        createHmac('sha256', config.authCsrfSecret)
          .update('parent-privacy-network-v1', 'utf8')
          .update('\0', 'utf8')
          .update(request.ip ?? '', 'utf8')
          .update('\0', 'utf8')
          .update(request.header('user-agent') ?? '', 'utf8')
          .digest('hex'),
      ...(clock ? { clock } : {}),
    }),
  );
  if (config.oneTimeFreeAccessExpiresAt) {
    app.use(
      '/api/app/parent',
      createParentCommercialBillingRouter({
        service: createCommercialBillingService({
          repository: createPostgresCommercialBillingRepository(pool),
          freeAccessExpiresAt: config.oneTimeFreeAccessExpiresAt,
        }),
        sessions: v21AdultSessionRuntime,
        scope: {
          product: 'one_time_mishnayos',
          runtime_tier: config.oneTimeRuntimeTier,
          verification_environment_id: config.oneTimeVerificationEnvironmentId,
        },
        freeAccessExpiresAt: config.oneTimeFreeAccessExpiresAt,
        ...(clock ? { clock } : {}),
      }),
    );
  } else {
    app.use('/api/app/parent/billing', (_req, res) => {
      setPrivateNoStore(res);
      res.status(503).json({
        success: false,
        code: 'PARENT_BILLING_UNAVAILABLE',
        message: 'Parent billing is temporarily unavailable.',
      });
    });
  }
  if (parentStudentServiceAccountVersion && parentStudentServiceAccountEvidenceReference) {
    const parentHouseholdRepository = createPostgresParentHouseholdRepository(pool, {
      acceptedServiceAccountVersion: parentStudentServiceAccountVersion,
      immutableEvidenceReference: parentStudentServiceAccountEvidenceReference,
      portalAccountKey: config.accountKey,
      portalProductKey: config.productKey,
      ...(clock ? { clock } : {}),
    });
    const parentHouseholdService = createParentHouseholdService({
      repository: parentHouseholdRepository,
      passwords: { hash: async (password) => hashAuthPassword(password) },
      ids: { nextStudentId: () => `student_${randomUUID()}` },
    });
    const parentSummaryService = createParentSummaryService({
      repository: createPostgresParentSummaryRepository(pool, {
        accountKey: config.accountKey,
        ...(clock ? { clock } : {}),
      }),
    });
    app.use(
      '/api/app/parent',
      createParentHouseholdRouter({
        service: parentHouseholdService,
        summaryService: parentSummaryService,
        sessions: v21AdultSessionRuntime,
        fingerprintPasswordForIdempotency: async (password) =>
          createHmac('sha256', config.authCsrfSecret)
            .update(PARENT_STUDENT_PASSWORD_FINGERPRINT_DOMAIN, 'utf8')
            .update('\0', 'utf8')
            .update(password, 'utf8')
            .digest('hex'),
        ...(clock ? { clock } : {}),
      }),
    );
  } else {
    app.use('/api/app/parent', (_req, res) => {
      setPrivateNoStore(res);
      res.status(503).json({
        success: false,
        code: 'PARENT_HOUSEHOLD_UNAVAILABLE',
        message: 'Parent access is temporarily unavailable.',
      });
    });
  }

  const schoolRuntimeBinding = resolveSchoolSignupScope(config);
  const approvedSchoolService = createSchoolSignupService({
    repository: createPostgresSchoolSignupRepository(pool, {
      accountKey: config.accountKey,
      productKey: config.productKey,
    }),
    allocateLeadId: () => `school-lead-${randomUUID()}`,
  });
  app.use(
    '/api/v2.1/admin/approved-schools',
    createApprovedSchoolAdminRouter({
      runtimeBinding: schoolRuntimeBinding,
      resolveSession: (req) =>
        approvedSchoolAdminSessionFromRequest(req, pool, config, schoolRuntimeBinding),
      verifyCsrf: async (req, approvedSession) => {
        if (!isSameOriginPost(req, config)) return false;
        const session = await sessionFromRequest(req, pool, config);
        if (!session || session.user.role !== 'admin') return false;
        const readback = await approvedSchoolAdminSessionFromRequest(
          req,
          pool,
          config,
          schoolRuntimeBinding,
        );
        if (
          readback?.role !== 'admin' ||
          readback.human_account_id !== approvedSession.human_account_id
        ) {
          return false;
        }
        return verifySessionCsrf({
          pool,
          sessionKey: session.session_key,
          csrfToken: req.header('x-csrf-token') ?? req.body?.csrf_token,
        });
      },
      now: () => (clock ? clock() : new Date()).toISOString(),
      configurator: approvedSchoolService,
    }),
  );

  registerOpsRoutes({
    app,
    config,
    pool,
    sessionFromRequest: (req) => sessionFromRequest(req, pool, config),
    setPrivateNoStore,
    ...(clock ? { clock } : {}),
  });

  app.get('/ready', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const readiness = await withTiming(req, 'ops_ready', () =>
      collectOpsReadiness({ pool, config, ...(clock ? { now: clock() } : {}) }),
    );
    res.status(readiness.ok ? 200 : 503).json({
      ok: readiness.ok,
      service: 'onetime-web',
      code: readiness.ok ? 'PUBLIC_READY' : 'PUBLIC_NOT_READY',
    });
  });

  app.get('/version', (_req, res) => {
    setPrivateNoStore(res);
    res.json({
      ok: true,
      service: 'onetime-web',
      code: 'PUBLIC_RELEASE_AVAILABLE',
    });
  });

  app.get('/one-time', (_req, res) => res.redirect(301, '/'));
  app.get('/one-time/signup', (_req, res) => res.redirect(301, '/signup'));
  app.get('/rabbi-member', (_req, res) => res.redirect(301, '/login'));

  app.get('/login', (req, res) => {
    const csrf = createLoginCsrf(config);
    const requestedReturnTo = String(req.query.return_to ?? '');
    const loginReturnTo =
      safeReturnPath(requestedReturnTo, config) ?? (requestedReturnTo ? '/app/crm' : '');
    setCsrfCookie(res, config, csrf.csrf_cookie);
    setPrivateNoStore(res);
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.status(200).type('html').send(loginPageHtml(csrf.csrf_token, loginReturnTo));
  });

  app.get('/activate', (_req, res) => {
    const csrf = createLoginCsrf(config);
    setCsrfCookie(res, config, csrf.csrf_cookie);
    setPrivateNoStore(res);
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.status(200).type('html').send(activationPageHtml(csrf.csrf_token));
  });

  app.get('/setup/:token', (_req, res) => {
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

  app.get('/reset-password/:token', (_req, res) => {
    const csrf = createLoginCsrf(config);
    setCsrfCookie(res, config, csrf.csrf_cookie);
    setPrivateNoStore(res);
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.status(200).type('html').send(resetPasswordPageHtml(csrf.csrf_token));
  });

  app.get('/session-ended', (_req, res) => {
    setPrivateNoStore(res);
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res
      .status(200)
      .type('html')
      .send(
        canonicalAuthStatePageHtml(
          'Session ended',
          'Your session has ended. Sign in again to continue safely.',
        ),
      );
  });

  app.get('/access-denied', async (req: RequestWithTrace, res) => {
    const session = await sessionFromRequest(req, pool, config);
    if (!session) {
      const cookieHeader = req.header('cookie');
      if (cookieHeaderHasName(cookieHeader, AUTH_SESSION_COOKIE.name)) {
        const resolution = await v21AdultSessionRuntime.resolveCookieHeader({
          cookie_header: cookieHeader,
          ...(clock ? { now: clock() } : {}),
        });
        if (resolution.status === 'unavailable') {
          setPrivateNoStore(res);
          res.status(503).type('text').send('Access verification is temporarily unavailable.');
          return;
        }
        if (resolution.status !== 'resolved' || !resolution.context) {
          res.redirect(302, '/login?return_to=%2Faccess-denied');
          return;
        }
      } else {
        res.redirect(302, '/login?return_to=%2Faccess-denied');
        return;
      }
    }
    setPrivateNoStore(res);
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res
      .status(403)
      .type('html')
      .send(
        canonicalAuthStatePageHtml(
          'Access denied',
          'Your account does not have access to that page. No protected record was disclosed.',
        ),
      );
  });

  app.get('/select-role', async (req: RequestWithTrace, res) => {
    const cookieHeader = req.header('cookie');
    if (cookieHeaderHasName(cookieHeader, AUTH_SESSION_COOKIE.name)) {
      const resolution = await v21AdultSessionRuntime.resolveCookieHeader({
        cookie_header: cookieHeader,
        ...(clock ? { now: clock() } : {}),
      });
      if (resolution.status === 'unavailable') {
        setPrivateNoStore(res);
        res.status(503).type('text').send('Role selection is temporarily unavailable.');
        return;
      }
      if (resolution.status === 'resolved') {
        if (resolution.context.memberships.length < 2) {
          res.redirect(302, defaultRouteForRole(resolution.context.session.activeRole));
          return;
        }
        setPrivateNoStore(res);
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        res
          .status(200)
          .type('html')
          .send(roleSelectionPageHtml(resolution.context.session.activeRole));
        return;
      }
      clearAuthCookies(res, config);
    }
    const session = await sessionFromRequest(req, pool, config);
    if (session) {
      res.redirect(302, defaultRouteForRole(session.user.role));
      return;
    }
    res.redirect(302, '/login?return_to=%2Fselect-role');
    return;
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
      const currentAccess = await currentApplicationAccessForUser({
        pool,
        config,
        userKey: sessionUser.user_key,
        role: sessionUser.role,
      });
      if (!currentAccess.allowed) {
        res.status(409).json({
          success: false,
          code: 'CURRENT_ACCESS_REQUIRED',
          message:
            'Account setup completed, but learning access is not active. Ask the Administrator to enable current access.',
          activation_completed: true,
          request_id: req.traceId,
        });
        return;
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
        mfa_required: inspected.mfa_required,
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

  installCanonicalProtectedRoutes({
    app,
    handlerFor: (route: CanonicalReadyProtectedRoute) => async (req: RequestWithTrace, res) => {
      if (route.shell === 'parent') {
        await serveV21CompatibleParentAppShell(req, res, {
          pool,
          config,
          distDir,
          fallbackPath: '/app/parent',
          v21AdultSessionRuntime,
          ...(clock ? { clock } : {}),
        });
        return;
      }
      if (route.shell === 'student') {
        if (route.routeId === 'RT-STU-012') {
          await serveEmbeddedClassroomAppShell(req, res, {
            pool,
            config,
            distDir,
            providerReady: Boolean(
              embeddedClassroomRuntime?.contextResolver && embeddedClassroomRuntime.sdkBootstrap,
            ),
          });
          return;
        }
        if (route.routeId === 'RT-STU-071' || route.routeId === 'RT-STU-072') {
          const privacySession = await sessionFromRequest(req, pool, config);
          if (privacySession && privacySession.user.role === 'student') {
            const privacyPrincipal = await selfManagedStudentPrivacyPrincipalFromRequest(
              req,
              pool,
              config,
            );
            if (!privacyPrincipal) {
              setPrivateNoStore(res);
              res.status(403).type('html').send(forbiddenAppHtml('student'));
              return;
            }
          }
        }
        const legacySession = await sessionFromRequest(req, pool, config);
        const cookieHeader = req.header('cookie');
        if (!legacySession && cookieHeaderHasName(cookieHeader, AUTH_SESSION_COOKIE.name)) {
          const resolution = await v21AdultSessionRuntime.resolveCookieHeader({
            cookie_header: cookieHeader,
            ...(clock ? { now: clock() } : {}),
          });
          if (resolution.status === 'unavailable') {
            setPrivateNoStore(res);
            res.status(503).type('text').send('Access verification is temporarily unavailable.');
            return;
          }
          if (resolution.status === 'resolved' && resolution.context) {
            setPrivateNoStore(res);
            res.status(403).type('html').send(forbiddenAppHtml('student'));
            return;
          }
        }
        await serveProtectedAppShell(req, res, {
          pool,
          config,
          distDir,
          appPage: 'student',
          allowedRoles: ['student'],
          fallbackPath: '/app/student',
        });
        return;
      }

      const session = await sessionFromRequest(req, pool, config);
      if (!session) {
        const cookieHeader = req.header('cookie');
        if (cookieHeaderHasName(cookieHeader, AUTH_SESSION_COOKIE.name)) {
          const resolution = await v21AdultSessionRuntime.resolveCookieHeader({
            cookie_header: cookieHeader,
            ...(clock ? { now: clock() } : {}),
          });
          if (resolution.status === 'unavailable') {
            setPrivateNoStore(res);
            res.status(503).type('text').send('Access verification is temporarily unavailable.');
            return;
          }
          if (resolution.status === 'resolved' && resolution.context) {
            if (resolution.context.session.activeRole === 'admin') {
              setPrivateNoStore(res);
              await sendAppHtml(res, distDir, route.shell === 'live' ? 'live' : 'crm', config);
              return;
            }
            setPrivateNoStore(res);
            res.status(403).type('html').send(forbiddenOwnerAdminHtml(req.path));
            return;
          }
        }
        const returnTo = safeReturnPath(req.path, config) ?? '/app/dashboard';
        res.redirect(302, `/login?return_to=${encodeURIComponent(returnTo)}`);
        return;
      }
      const canonicalUser = currentClientUser(session.user);
      if (canonicalUser?.role !== 'admin') {
        setPrivateNoStore(res);
        res.status(403).type('html').send(forbiddenOwnerAdminHtml(req.path));
        return;
      }
      await ensureSessionCsrfCookie(req, res, pool, config, session);
      setPrivateNoStore(res);
      await sendAppHtml(res, distDir, route.shell === 'live' ? 'live' : 'crm', config);
    },
    unavailableHandlerFor: (route: CanonicalProtectedRoute) => (_req, res, next) => {
      if (route.routeId === 'RT-ADM-030') {
        next();
        return;
      }
      setPrivateNoStore(res);
      res.status(404).type('text').send(`Canonical route ${route.routeId} is not available.`);
    },
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
    if (!canReadContacts(session.user.role)) {
      setPrivateNoStore(res);
      res.status(403).type('html').send(forbiddenOwnerAdminHtml(req.path));
      return;
    }
    await ensureSessionCsrfCookie(req, res, pool, config, session);
    setPrivateNoStore(res);
    await sendAppHtml(res, distDir, 'crm', config);
  });

  if (config.legacyBillingRuntimeEnabled) {
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
        await sendAppHtml(res, distDir, session.user.role === 'parent' ? 'parent' : 'crm', config);
      },
    );
  } else {
    app.all(/^\/app\/billing\/checkout\/(?:success|cancel)(?:\/.*)?$/, (_req, res) => {
      setPrivateNoStore(res);
      res.status(404).type('text').send('Billing completion route unavailable.');
    });
  }

  app.get(
    /^\/app\/(?:dashboard|classes|content|billing|communications|rewards|support|operations)(?:\/.*)?$/,
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
      if (
        !canUseOwnerDashboard(session.user.role) &&
        !canUseRabbiTeachingSurface(session.user.role, req.path)
      ) {
        setPrivateNoStore(res);
        res.status(403).type('html').send(forbiddenOwnerAdminHtml(req.path));
        return;
      }
      await ensureSessionCsrfCookie(req, res, pool, config, session);
      setPrivateNoStore(res);
      await sendAppHtml(res, distDir, 'crm', config);
    },
  );

  app.get('/app/live-console/zoom-host', async (req: RequestWithTrace, res) => {
    const session = await sessionFromRequest(req, pool, config);
    if (!session) {
      res.redirect(302, '/login?return_to=%2Fapp%2Flive-console%2Fzoom-host');
      return;
    }
    if (!['owner', 'admin', 'rabbi'].includes(session.user.role)) {
      setPrivateNoStore(res);
      res.status(403).type('html').send(forbiddenOwnerAdminHtml(req.path));
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
        "img-src 'self' data: blob: https://source.zoom.us",
        "script-src 'self' https://source.zoom.us 'unsafe-eval' 'wasm-unsafe-eval'",
        "style-src 'self' 'unsafe-inline' https://source.zoom.us",
        "connect-src 'self' https://*.zoom.us wss://*.zoom.us",
        "worker-src 'self' blob:",
        "media-src 'self' blob: mediastream:",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
      ].join('; '),
    );
    res.status(200).type('html').send(zoomHostHtml());
  });

  app.get('/app/live-console/zoom-participant/:student', async (req: RequestWithTrace, res) => {
    const session = await sessionFromRequest(req, pool, config);
    if (!session) {
      res.redirect(302, '/login?return_to=%2Fapp%2Flive-console');
      return;
    }
    if (!['owner', 'admin', 'rabbi'].includes(session.user.role)) {
      setPrivateNoStore(res);
      res.status(403).type('html').send(forbiddenOwnerAdminHtml(req.path));
      return;
    }
    setPrivateNoStore(res);
    res.status(404).type('text').send('Use the protected Student portal to join class.');
  });

  app.get(/^\/app\/live-console(?:\/.*)?$/, async (req: RequestWithTrace, res) => {
    const session = await sessionFromRequest(req, pool, config);
    if (!session) {
      res.redirect(
        302,
        `/login?return_to=${encodeURIComponent(
          safeReturnPath(req.path, config) ?? '/app/live-console',
        )}`,
      );
      return;
    }
    if (!['owner', 'admin', 'rabbi'].includes(session.user.role)) {
      setPrivateNoStore(res);
      res.status(403).type('html').send(forbiddenOwnerAdminHtml(req.path));
      return;
    }
    await ensureSessionCsrfCookie(req, res, pool, config, session);
    setPrivateNoStore(res);
    await sendAppHtml(res, distDir, 'live', config);
  });

  app.get(/^\/app\/live-stage\/([^/]+)(?:\/.*)?$/, async (_req: RequestWithTrace, res) => {
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
        "frame-ancestors 'self'",
      ].join('; '),
    );
    await sendAppHtml(res, distDir, 'live', config);
  });

  const serveParentAppShell = async (req: RequestWithTrace, res: Response) => {
    await serveV21CompatibleParentAppShell(req, res, {
      pool,
      config,
      distDir,
      fallbackPath: '/app/parent',
      v21AdultSessionRuntime,
      ...(clock ? { clock } : {}),
    });
  };
  app.get(/^\/app\/parent(?:\/.*)?$/, serveParentAppShell);
  app.get('/select-household', async (req: RequestWithTrace, res) => {
    const context = await v21AdultSessionRuntime.householdContextCookieHeader({
      cookie_header: req.header('cookie'),
      ...(clock ? { now: clock() } : {}),
    });
    setPrivateNoStore(res);
    if (context.status === 'unavailable') {
      res.status(503).type('text').send('Household selection is temporarily unavailable.');
      return;
    }
    if (context.status === 'invalid') {
      if (context.reason === 'invalid_role') {
        res.redirect(302, '/select-role');
        return;
      }
      clearAuthCookies(res, config);
      res.redirect(302, '/login?return_to=%2Fselect-household');
      return;
    }
    if (context.households.length < 2) {
      res.redirect(302, '/app/parent');
      return;
    }
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res
      .status(200)
      .type('html')
      .send(householdSelectionPageHtml(context.households, context.active_household_id));
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
      const cookieHeader = req.header('cookie');
      const hostCookiePresent = cookieHeaderHasName(cookieHeader, AUTH_SESSION_COOKIE.name);
      let rotatableV21CookieHeader: string | undefined;
      if (hostCookiePresent) {
        const existingV21Session = await v21AdultSessionRuntime.resolveCookieHeader({
          cookie_header: cookieHeader,
          ...(clock ? { now: clock() } : {}),
        });
        if (existingV21Session.status === 'unavailable') {
          res
            .status(503)
            .json(publicError('SERVER_ERROR', 'Login is unavailable right now.', req.traceId));
          return;
        }
        if (existingV21Session.status === 'invalid') {
          clearAuthCookies(res, config);
        } else {
          rotatableV21CookieHeader = cookieHeader;
        }
      }
      const identifier = payload.identifier ?? payload.email ?? '';
      const v21Scope = resolveFamilySignupScope(config);
      const v21Recognition = await withTiming(req, 'db', () =>
        v21AdultSessionRuntime.recognizedLoginEmail({
          scope: v21Scope,
          email: identifier,
        }),
      );
      if (v21Recognition.status === 'unavailable') {
        res
          .status(503)
          .json(publicError('SERVER_ERROR', 'Login is unavailable right now.', req.traceId));
        return;
      }
      const recognizedV21ParentLogin =
        v21Recognition.status === 'recognized' &&
        !(await isApprovedSchoolLegacyAdminLoginBridge(
          pool,
          config,
          v21Scope,
          v21Recognition.normalized_email,
        ))
          ? v21Recognition
          : null;
      if (recognizedV21ParentLogin) {
        const identifierHash = stableKey('login_identifier', [
          recognizedV21ParentLogin.normalized_email,
        ]);
        const attemptNow = clock ? clock() : new Date();
        const attemptIp = req.ip ?? 'unknown';
        const v21LoginBudgets = [
          {
            scope: 'login_account_ip',
            subject: stableKey('login_account_ip_subject', [
              recognizedV21ParentLogin.normalized_email,
              attemptIp,
            ]),
            limit: 5,
            windowMs: config.loginRateLimitWindowMs,
          },
          {
            scope: 'login_ip',
            subject: attemptIp,
            limit: 50,
            windowMs: config.loginRateLimitWindowMs,
          },
          {
            scope: 'login_account_product',
            subject: `${config.accountKey}:${config.productKey}`,
            limit: config.loginAccountRateLimitMax,
            windowMs: config.loginRateLimitWindowMs,
          },
          {
            scope: 'login_global',
            subject: 'all',
            limit: config.loginGlobalRateLimitMax,
            windowMs: config.loginRateLimitWindowMs,
          },
        ];
        let reservation: V21LoginAttemptReservation;
        try {
          reservation = await reserveV21LoginAttempt({
            pool,
            config,
            budgets: v21LoginBudgets,
            now: attemptNow,
          });
        } catch {
          res
            .status(503)
            .json(publicError('SERVER_ERROR', 'Login is unavailable right now.', req.traceId));
          return;
        }
        if (!reservation.allowed) {
          await insertV21AuthAudit(pool, config, {
            eventType: 'login_rate_limited',
            success: false,
            reason: 'RATE_LIMITED',
            ip: req.ip,
            userAgent: req.header('user-agent') ?? undefined,
            metadata: {
              identifier_hash: identifierHash,
              budget_scope: reservation.scope ?? null,
            },
          });
          if (reservation.retryAfterSeconds) {
            res.setHeader('retry-after', String(reservation.retryAfterSeconds));
          }
          res.status(429).json({
            success: false,
            code: 'RATE_LIMITED',
            message:
              'Email/username or password is not correct. If access was revoked, ask your Parent or an Administrator to restore it.',
            request_id: req.traceId,
          });
          return;
        }
        let v21Login: Awaited<ReturnType<V21AdultSessionRuntime['login']>>;
        try {
          v21Login = await withTiming(req, 'db', () =>
            v21AdultSessionRuntime.login({
              scope: v21Scope,
              email: identifier,
              password: payload.password,
              ...(rotatableV21CookieHeader ? { cookie_header: rotatableV21CookieHeader } : {}),
              now: attemptNow,
            }),
          );
        } catch {
          try {
            await releaseV21LoginReservations(pool, reservation.reservations, attemptNow);
          } catch {
            // Login remains unavailable; no credential outcome was accepted.
          }
          res
            .status(503)
            .json(publicError('SERVER_ERROR', 'Login is unavailable right now.', req.traceId));
          return;
        }
        if (!v21Login.handled || !v21Login.authenticated) {
          const releaseReservation =
            !v21Login.handled ||
            v21Login.failure !== 'invalid_credentials' ||
            v21Login.budget_disposition === 'release';
          if (releaseReservation) {
            try {
              await releaseV21LoginReservations(pool, reservation.reservations, attemptNow);
            } catch {
              if (v21Login.handled && v21Login.session_mutated) {
                clearAuthCookies(res, config);
              }
              res
                .status(503)
                .json(
                  publicError(
                    v21Login.handled && v21Login.failure === 'recovery_required'
                      ? 'SESSION_RECOVERY_REQUIRED'
                      : 'SERVER_ERROR',
                    'Login is unavailable right now.',
                    req.traceId,
                  ),
                );
              return;
            }
          }
          if (
            v21Login.handled &&
            (v21Login.failure === 'unavailable' || v21Login.failure === 'recovery_required')
          ) {
            if (v21Login.session_mutated) {
              clearAuthCookies(res, config);
            }
            res
              .status(503)
              .json(
                publicError(
                  v21Login.failure === 'recovery_required'
                    ? 'SESSION_RECOVERY_REQUIRED'
                    : 'SERVER_ERROR',
                  'Login is unavailable right now.',
                  req.traceId,
                ),
              );
            return;
          }
          await insertV21AuthAudit(pool, config, {
            eventType: 'login_failed',
            success: false,
            reason: 'INVALID_CREDENTIALS',
            ip: req.ip,
            userAgent: req.header('user-agent') ?? undefined,
            metadata: { identifier_hash: identifierHash, session_model: 'v21' },
          });
          if (v21Login.handled && v21Login.session_mutated) {
            clearAuthCookies(res, config);
          }
          res.status(401).json({
            success: false,
            code: 'INVALID_CREDENTIALS',
            message:
              'Email/username or password is not correct. If access was revoked, ask your Parent or an Administrator to restore it.',
            request_id: req.traceId,
          });
          return;
        }
        try {
          await releaseV21LoginReservations(pool, reservation.reservations, attemptNow);
        } catch {
          const recoveryVerified = await revokeIssuedV21LoginSession(
            v21AdultSessionRuntime,
            v21Login.browser_session_token,
            attemptNow,
          );
          clearAuthCookies(res, config);
          res
            .status(503)
            .json(
              publicError(
                recoveryVerified ? 'SERVER_ERROR' : 'SESSION_RECOVERY_REQUIRED',
                'Login is unavailable right now.',
                req.traceId,
              ),
            );
          return;
        }
        let legacyRotationVerified = false;
        try {
          legacyRotationVerified = await revokePresentedLegacySession(
            req,
            pool,
            config,
            'login_rotation',
          );
        } catch {
          legacyRotationVerified = false;
        }
        if (!legacyRotationVerified) {
          const recoveryVerified = await revokeIssuedV21LoginSession(
            v21AdultSessionRuntime,
            v21Login.browser_session_token,
            attemptNow,
          );
          clearAuthCookies(res, config);
          res
            .status(503)
            .json(
              publicError(
                recoveryVerified ? 'SERVER_ERROR' : 'SESSION_RECOVERY_REQUIRED',
                'Login is unavailable right now.',
                req.traceId,
              ),
            );
          return;
        }
        try {
          await insertV21AuthAudit(pool, config, {
            eventType: 'login_succeeded',
            userKey: v21Login.user.human_account_id,
            success: true,
            ip: req.ip,
            userAgent: req.header('user-agent') ?? undefined,
            metadata: { session_model: 'v21' },
          });
        } catch {
          const recoveryVerified = await revokeIssuedV21LoginSession(
            v21AdultSessionRuntime,
            v21Login.browser_session_token,
            attemptNow,
          );
          clearAuthCookies(res, config);
          res
            .status(503)
            .json(
              publicError(
                recoveryVerified ? 'SERVER_ERROR' : 'SESSION_RECOVERY_REQUIRED',
                'Login is unavailable right now.',
                req.traceId,
              ),
            );
          return;
        }
        clearAuthCookies(res, config);
        res.append(
          'Set-Cookie',
          sessionCookieHeader({
            token: v21Login.browser_session_token,
            max_age_seconds: Math.max(
              0,
              Math.floor(
                (Date.parse(v21Login.expires_at) - (clock ? clock().getTime() : Date.now())) / 1000,
              ),
            ),
          }),
        );
        res.status(200).json({
          success: true,
          session_model: 'v21',
          user: v21ClientUser({ ...v21Login.user, active_role: v21Login.active_role }),
          csrf_token: v21Login.csrf_token,
          expires_at: v21Login.expires_at,
          account_context: {
            active_role: v21Login.active_role,
            available_roles: v21Login.memberships,
            active_household_id: v21Login.household?.householdId ?? null,
          },
          return_to: v21Login.role_selection_required
            ? '/select-role'
            : v21Login.household_selection_required
              ? '/select-household'
              : returnPathForRole(payload.return_to, v21Login.active_role, config),
        });
        return;
      }
      const login = await withTiming(req, 'db', () =>
        authenticateUser({
          pool,
          config,
          identifier,
          password: payload.password,
          ip: req.ip,
          userAgent: req.header('user-agent') ?? undefined,
        }),
      );
      if (!login.ok) {
        const status = login.code === 'RATE_LIMITED' ? 429 : 401;
        if (login.retry_after_seconds)
          res.setHeader('retry-after', String(login.retry_after_seconds));
        res.status(status).json({
          success: false,
          code:
            login.code === 'DISABLED' || login.code === 'EMAIL_CHALLENGE_REQUIRED'
              ? 'INVALID_CREDENTIALS'
              : login.code,
          message:
            'Email/username or password is not correct. If access was revoked, ask your Parent or an Administrator to restore it.',
          request_id: req.traceId,
        });
        return;
      }

      if (rotatableV21CookieHeader) {
        const rotation = await v21AdultSessionRuntime.rotateCookieHeader({
          cookie_header: rotatableV21CookieHeader,
          ...(clock ? { now: clock() } : {}),
        });
        if (!rotation.revoked) {
          clearAuthCookies(res, config);
          res
            .status(503)
            .json(publicError('SERVER_ERROR', 'Login is unavailable right now.', req.traceId));
          return;
        }
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
      const currentUser = currentClientUser(session.user);
      if (!currentUser) {
        await revokeSession({
          pool,
          config,
          sessionToken: session.session_token,
          reason: 'role_retired',
          ip: req.ip,
          userAgent: req.header('user-agent') ?? undefined,
        });
        clearAuthCookies(res, config);
        res
          .status(403)
          .json(publicError('FORBIDDEN', 'This account role is not available.', req.traceId));
        return;
      }
      clearAuthCookies(res, config);
      setAuthCookies(res, config, session.session_token, session.csrf_token);
      res.status(200).json({
        success: true,
        user: currentUser,
        csrf_token: session.csrf_token,
        return_to: returnPathForRole(payload.return_to, session.user.role, config),
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

  app.post('/api/v1/auth/password', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!requireSameOriginPost(req, res, config)) return;
    if (!(await requireSessionCsrf(req, res, pool, session))) return;
    if (session.user.role === 'student') {
      res.status(403).json({
        success: false,
        code: 'STUDENT_PASSWORD_ADULT_MANAGED',
        message: 'Student passwords are managed by a Parent or Administrator.',
        request_id: req.traceId,
      });
      return;
    }
    try {
      const payload = authenticatedPasswordChangePayloadSchema.parse(req.body);
      const result = await changeOwnPassword({
        pool,
        config,
        session,
        currentPassword: payload.current_password,
        newPassword: payload.new_password,
        ip: req.ip,
        userAgent: req.header('user-agent') ?? undefined,
      });
      if (!result.ok) {
        const status =
          result.code === 'RATE_LIMITED'
            ? 429
            : result.code === 'PASSWORD_REUSE'
              ? 409
              : result.code === 'ACCOUNT_UNAVAILABLE'
                ? 403
                : 400;
        if (result.retry_after_seconds) {
          res.setHeader('retry-after', String(result.retry_after_seconds));
        }
        const message =
          result.code === 'RATE_LIMITED'
            ? 'Please wait before trying another password change.'
            : result.code === 'PASSWORD_REUSE'
              ? 'Choose a password you have not just used.'
              : result.code === 'PASSWORD_POLICY_FAILED'
                ? 'Use at least 10 characters with at least one letter and one number.'
                : result.code === 'ACCOUNT_UNAVAILABLE'
                  ? 'This account cannot change its password right now.'
                  : 'The current password is not correct.';
        res.status(status).json({
          success: false,
          code: result.code,
          message,
          request_id: req.traceId,
        });
        return;
      }
      res.status(200).json({
        success: true,
        password_updated_at: result.password_updated_at,
        sessions_invalidated: result.sessions_invalidated,
        current_session_preserved: true,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Please check the password form.',
          field_errors: publicFieldErrors(error),
          request_id: req.traceId,
        });
        return;
      }
      res
        .status(500)
        .json(
          publicError('SERVER_ERROR', 'Password change is unavailable right now.', req.traceId),
        );
    }
  });

  const sendV21Logout = async (req: RequestWithTrace, res: Response, requireHost: boolean) => {
    setPrivateNoStore(res);
    const cookieHeader = req.header('cookie');
    if (!cookieHeaderHasName(cookieHeader, AUTH_SESSION_COOKIE.name)) {
      if (requireHost) {
        res
          .status(404)
          .json(publicError('V21_SESSION_NOT_PRESENT', 'No v2.1 session is active.', req.traceId));
      }
      return false;
    }
    const outcome = await v21AdultSessionRuntime.logoutCookieHeader({
      cookie_header: cookieHeader,
      csrf_token: req.header('x-csrf-token'),
      ...(clock ? { now: clock() } : {}),
    });
    if (outcome.revoked) {
      let legacyRevocationVerified = false;
      try {
        legacyRevocationVerified = await revokePresentedLegacySession(req, pool, config, 'logout');
      } catch {
        legacyRevocationVerified = false;
      }
      if (!legacyRevocationVerified) {
        clearAuthCookies(res, config);
        res
          .status(503)
          .json(
            publicError(
              'SESSION_RECOVERY_REQUIRED',
              'Sign out could not be verified. Sign in again before continuing.',
              req.traceId,
            ),
          );
        return true;
      }
      try {
        await insertV21AuthAudit(pool, config, {
          eventType: 'logout_succeeded',
          success: true,
          ip: req.ip,
          userAgent: req.header('user-agent') ?? undefined,
          metadata: { session_model: 'v21' },
        });
      } catch {
        clearAuthCookies(res, config);
        res
          .status(503)
          .json(
            publicError(
              'SERVER_ERROR',
              'Sign out completed, but its audit readback is unavailable.',
              req.traceId,
            ),
          );
        return true;
      }
      clearAuthCookies(res, config);
      res.status(200).json({ success: true, session_model: 'v21' });
      return true;
    }
    const invalidCsrf = outcome.reason === 'invalid_csrf';
    if (outcome.reason === 'invalid_session') {
      clearAuthCookies(res, config);
    }
    res
      .status(invalidCsrf ? 403 : outcome.reason === 'revocation_unverified' ? 503 : 401)
      .json(
        publicError(
          invalidCsrf
            ? 'CSRF_REQUIRED'
            : outcome.reason === 'revocation_unverified'
              ? 'SERVER_ERROR'
              : 'UNAUTHENTICATED',
          invalidCsrf
            ? 'Refresh the page and try again.'
            : outcome.reason === 'revocation_unverified'
              ? 'Sign out could not be verified. Sign in again before continuing.'
              : 'Sign in to continue.',
          req.traceId,
        ),
      );
    return true;
  };

  const sendV21SessionBootstrap = async (
    req: RequestWithTrace,
    res: Response,
    requireHost: boolean,
  ) => {
    setPrivateNoStore(res);
    const cookieHeader = req.header('cookie');
    if (!cookieHeaderHasName(cookieHeader, AUTH_SESSION_COOKIE.name)) {
      if (requireHost) {
        res
          .status(404)
          .json(publicError('V21_SESSION_NOT_PRESENT', 'No v2.1 session is active.', req.traceId));
      }
      return false;
    }
    const bootstrap = await v21AdultSessionRuntime.bootstrapCookieHeader({
      cookie_header: cookieHeader,
      ...(clock ? { now: clock() } : {}),
    });
    if (bootstrap.status === 'unavailable') {
      res
        .status(503)
        .json(publicError('SERVER_ERROR', 'Session readback is unavailable.', req.traceId));
      return true;
    }
    if (bootstrap.status === 'invalid') {
      clearAuthCookies(res, config);
      res.status(401).json(publicError('UNAUTHENTICATED', 'Sign in to continue.', req.traceId));
      return true;
    }
    res.status(200).json({
      success: true,
      authenticated: true,
      session_model: 'v21',
      user: v21ClientUser({
        human_account_id: bootstrap.context.session.humanAccountId,
        adult_id: bootstrap.context.adultId,
        email: bootstrap.context.normalizedEmail,
        display_name: bootstrap.context.ownerDisplayName,
        active_role: bootstrap.context.session.activeRole,
      }),
      csrf_token: bootstrap.csrf_token,
      expires_at: bootstrap.expires_at,
      credential_version: bootstrap.context.session.securityVersion,
      account_context: {
        active_role: bootstrap.context.session.activeRole,
        available_roles: bootstrap.context.memberships,
      },
      ...(bootstrap.context.household
        ? {
            parent_context: {
              adult_id: bootstrap.context.adultId,
              human_account_id: bootstrap.context.session.humanAccountId,
              owned_household_count: bootstrap.context.ownedHouseholdCount,
              household: {
                household_id: bootstrap.context.household.householdId,
                display_name: bootstrap.context.household.displayName,
                classification: bootstrap.context.household.classification,
                access_state: bootstrap.context.household.accessState,
                owner_relationship: bootstrap.context.household.ownerRelationship,
              },
            },
          }
        : {}),
    });
    return true;
  };

  app.post('/api/v2.1/auth/logout', async (req: RequestWithTrace, res) => {
    await sendV21Logout(req, res, true);
  });

  app.get('/api/v2.1/auth/session', async (req: RequestWithTrace, res) => {
    await sendV21SessionBootstrap(req, res, true);
  });

  app.post('/api/v2.1/account-context/role', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    if (!isSameOriginPost(req, config)) {
      res.status(403).json(publicError('FORBIDDEN', 'Same-origin request required.', req.traceId));
      return;
    }
    const requestedRole = req.body?.requested_role;
    if (requestedRole !== 'admin' && requestedRole !== 'parent') {
      res.status(400).json(publicError('VALIDATION_ERROR', 'Choose Admin or Parent.', req.traceId));
      return;
    }
    const outcome = await v21AdultSessionRuntime.switchRoleCookieHeader({
      cookie_header: req.header('cookie'),
      csrf_token: req.header('x-csrf-token') ?? req.body?.csrf_token,
      requested_role: requestedRole,
      ...(clock ? { now: clock() } : {}),
    });
    if (!outcome.switched) {
      const status =
        outcome.reason === 'invalid_session' ? 401 : outcome.reason === 'unavailable' ? 503 : 403;
      if (outcome.reason === 'invalid_session') clearAuthCookies(res, config);
      res
        .status(status)
        .json(
          publicError(
            outcome.reason === 'invalid_session'
              ? 'UNAUTHENTICATED'
              : outcome.reason === 'invalid_csrf'
                ? 'CSRF_REQUIRED'
                : outcome.reason === 'unavailable'
                  ? 'SERVER_ERROR'
                  : 'FORBIDDEN',
            outcome.reason === 'unavailable'
              ? 'Role switching is temporarily unavailable.'
              : outcome.reason === 'invalid_csrf'
                ? 'Refresh the page and try again.'
                : 'That role is not available for this account.',
            req.traceId,
          ),
        );
      return;
    }
    clearAuthCookies(res, config);
    res.append(
      'Set-Cookie',
      sessionCookieHeader({
        token: outcome.browser_session_token,
        max_age_seconds: Math.max(
          0,
          Math.floor(
            (Date.parse(outcome.expires_at) - (clock ? clock().getTime() : Date.now())) / 1000,
          ),
        ),
      }),
    );
    res.status(200).json({
      success: true,
      active_role: outcome.active_role,
      available_roles: outcome.memberships,
      csrf_token: outcome.csrf_token,
      expires_at: outcome.expires_at,
      return_to: outcome.household_selection_required
        ? '/select-household'
        : defaultRouteForRole(outcome.active_role),
    });
  });

  app.get('/api/v2.1/account-context/households', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const context = await v21AdultSessionRuntime.householdContextCookieHeader({
      cookie_header: req.header('cookie'),
      ...(clock ? { now: clock() } : {}),
    });
    if (context.status === 'unavailable') {
      res
        .status(503)
        .json(publicError('SERVER_ERROR', 'Household selection is unavailable.', req.traceId));
      return;
    }
    if (context.status === 'invalid') {
      if (context.reason === 'invalid_session') clearAuthCookies(res, config);
      res
        .status(context.reason === 'invalid_session' ? 401 : 403)
        .json(
          publicError(
            context.reason === 'invalid_session' ? 'UNAUTHENTICATED' : 'FORBIDDEN',
            'Household selection is unavailable for this account context.',
            req.traceId,
          ),
        );
      return;
    }
    res.status(200).json({
      success: true,
      households: context.households,
      active_household_id: context.active_household_id,
      csrf_token: context.csrf_token,
      expires_at: context.expires_at,
    });
  });

  app.post('/api/v2.1/account-context/household', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    if (!isSameOriginPost(req, config)) {
      res.status(403).json(publicError('FORBIDDEN', 'Same-origin request required.', req.traceId));
      return;
    }
    const selectedHouseholdId = req.body?.selected_household_id;
    if (typeof selectedHouseholdId !== 'string') {
      res
        .status(400)
        .json(publicError('VALIDATION_ERROR', 'Choose an available household.', req.traceId));
      return;
    }
    const outcome = await v21AdultSessionRuntime.switchHouseholdCookieHeader({
      cookie_header: req.header('cookie'),
      csrf_token: req.header('x-csrf-token') ?? req.body?.csrf_token,
      selected_household_id: selectedHouseholdId,
      ...(clock ? { now: clock() } : {}),
    });
    if (!outcome.switched) {
      const status =
        outcome.reason === 'invalid_session' ? 401 : outcome.reason === 'unavailable' ? 503 : 403;
      if (outcome.reason === 'invalid_session') clearAuthCookies(res, config);
      res
        .status(status)
        .json(
          publicError(
            outcome.reason === 'invalid_session'
              ? 'UNAUTHENTICATED'
              : outcome.reason === 'invalid_csrf'
                ? 'CSRF_REQUIRED'
                : outcome.reason === 'unavailable'
                  ? 'SERVER_ERROR'
                  : 'FORBIDDEN',
            outcome.reason === 'unavailable'
              ? 'Household selection is temporarily unavailable.'
              : outcome.reason === 'invalid_csrf'
                ? 'Refresh the page and try again.'
                : 'That household is not available for this account.',
            req.traceId,
          ),
        );
      return;
    }
    clearAuthCookies(res, config);
    res.append(
      'Set-Cookie',
      sessionCookieHeader({
        token: outcome.browser_session_token,
        max_age_seconds: Math.max(
          0,
          Math.floor(
            (Date.parse(outcome.expires_at) - (clock ? clock().getTime() : Date.now())) / 1000,
          ),
        ),
      }),
    );
    res.status(200).json({
      success: true,
      active_role: 'parent',
      active_household: outcome.active_household,
      csrf_token: outcome.csrf_token,
      expires_at: outcome.expires_at,
      return_to: '/app/parent',
    });
  });

  app.post('/api/v1/auth/logout', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    if (await sendV21Logout(req, res, false)) return;
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
    if (await sendV21SessionBootstrap(req, res, false)) return;
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    const csrfToken = await ensureSessionCsrfCookie(req, res, pool, config, session);
    const currentUser = currentClientUser(session.user);
    if (!currentUser) {
      clearAuthCookies(res, config);
      res
        .status(403)
        .json(publicError('FORBIDDEN', 'This account role is not available.', req.traceId));
      return;
    }
    res.json({
      authenticated: true,
      user: currentUser,
      csrf_token: csrfToken,
      expires_at: session.expires_at,
      credential_version: session.session_security_version ?? 1,
      capabilities: {
        operator_experience: {
          live_console: true,
        },
      },
    });
  });

  app.get('/api/v1/dashboard/owner', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireAdminDashboardSession(req, res, {
      pool,
      config,
      v21AdultSessionRuntime,
      ...(clock ? { clock } : {}),
    });
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

  app.get('/api/v1/launch-status', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    res.status(404).json(publicError('NOT_FOUND', 'Launch status is unavailable.', req.traceId));
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
  const liveClassRepository = createLiveClassRepository(pool);
  const zoomHostLaunchPort = createZoomHostLaunchPort(config);
  const resolvedZoomAdminProvider = zoomAdminProvider ?? createZoomAdminProvider(config);
  const zoomAdminService = createZoomAdminService({
    config,
    repository: createZoomAdminTestResourceRepository(pool),
    ...(resolvedZoomAdminProvider ? { provider: resolvedZoomAdminProvider } : {}),
    ...(clock ? { clock } : {}),
  });
  const zoomClassOccurrenceRepository = createZoomClassOccurrenceRepository(pool);
  const resolvedZoomClassOccurrenceProvider =
    zoomClassOccurrenceProvider ?? createZoomClassOccurrenceProvider(config);
  const zoomClassOccurrenceHostLaunchPort = createZoomClassOccurrenceHostLaunchPort({
    config,
    repository: zoomClassOccurrenceRepository,
    ...(resolvedZoomClassOccurrenceProvider
      ? { provider: resolvedZoomClassOccurrenceProvider }
      : {}),
    ...(clock ? { clock } : {}),
  });
  const resolvedZoomHostLaunchPort = zoomClassOccurrenceHostLaunchPort ?? zoomHostLaunchPort;
  const zoomClassOccurrenceService = createZoomClassOccurrenceService({
    config,
    repository: zoomClassOccurrenceRepository,
    ...(resolvedZoomClassOccurrenceProvider
      ? { provider: resolvedZoomClassOccurrenceProvider }
      : {}),
    ...(clock ? { clock } : {}),
  });
  const classroomZoomPorts = createZoomClassroomPorts({
    config,
    repository: zoomClassOccurrenceRepository,
    ...(resolvedZoomClassOccurrenceProvider
      ? { provider: resolvedZoomClassOccurrenceProvider }
      : {}),
    ...(clock ? { clock } : {}),
  });
  const classroomRepository = createClassroomRepository(pool);
  const classroomService = createClassroomService({
    config,
    repository: classroomRepository,
    questionCodec: new AesGcmPayloadCodec(
      `${config.protectedPayloadEncryptionKey}:classroom-question-v1`,
    ),
    ...classroomZoomPorts,
    ...(clock ? { clock } : {}),
  });
  const liveClassService = createLiveClassService({
    config,
    repository: liveClassRepository,
    questionCodec: new AesGcmPayloadCodec(
      `${config.protectedPayloadEncryptionKey}:live-class-question-v1`,
    ),
    ...(resolvedZoomHostLaunchPort ? { zoomHostLaunchPort: resolvedZoomHostLaunchPort } : {}),
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
      ? createClassroomPortalAccessAdapter({
          classroom: classroomService,
          currentAccess: ({ actor, learner }) =>
            householdHasLearningAccess({
              db: pool,
              accountKey: actor.account_key,
              productKey: actor.product_key,
              householdKey: learner.household_key,
              ...(clock ? { now: clock() } : {}),
            }),
        })
      : createClassPortalAccessAdapter({ pool, config }),
    contentAccess: createContentPortalAccessAdapter({ pool, config }),
    credentialLifecycle: createAccountLifecycleCredentialAdapter({ pool, config }),
    progress: createPortalProgressAdapter(pool),
    gamification: createPortalGamificationAdapter(gamificationService),
    helper: createScopedKnowledgeHelperAdapter({ pool, config, ...(clock ? { clock } : {}) }),
    billing: createParentAccessSummaryAdapter(pool, config),
  };
  const verifyPortalRecentAssurance = async (_req: Request, actor: PortalActorContext) => {
    const result = await pool.query(
      `SELECT assurance_at
         FROM onetime.user_sessions
        WHERE account_key = $1
          AND product_key = $2
          AND session_key = $3
          AND revoked_at IS NULL
          AND expires_at > now()
        LIMIT 1`,
      [config.accountKey, config.productKey, actor.session_key],
    );
    const assuranceAt = result.rows[0]?.assurance_at;
    return Boolean(
      assuranceAt && Date.now() - new Date(String(assuranceAt)).getTime() <= 10 * 60 * 1000,
    );
  };
  app.get(
    '/api/v1/admin/classes/occurrences/:occurrenceKey/zoom',
    async (req: RequestWithTrace, res) => {
      setPrivateNoStore(res);
      const session = await requireApiSession(req, res, pool, config);
      if (!session) return;
      const actor = await resolvePortalActor(req);
      if (!actor) {
        res.status(401).json(publicError('UNAUTHENTICATED', 'Please log in again.', req.traceId));
        return;
      }
      try {
        const data = await zoomClassOccurrenceService.status(
          actor,
          String(req.params.occurrenceKey ?? ''),
        );
        res.json({ success: true, data });
      } catch (error) {
        handleApiError(error, req, res);
      }
    },
  );

  app.post(
    '/api/v1/admin/classes/occurrences/:occurrenceKey/zoom/provision',
    async (req: RequestWithTrace, res) => {
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
        const payload = z
          .object({
            purpose: z.enum(['normal_class', 'synthetic_acceptance']).default('normal_class'),
            idempotency_key: z.string().trim().min(8).max(160),
          })
          .parse(stripCsrfField(req.body));
        const data = await zoomClassOccurrenceService.provision(actor, {
          occurrence_key: String(req.params.occurrenceKey ?? ''),
          ...payload,
        });
        res.status(201).json({ success: true, data });
      } catch (error) {
        handleApiError(error, req, res);
      }
    },
  );

  app.post(
    '/api/v1/admin/classes/occurrences/:occurrenceKey/zoom/delete-synthetic',
    async (req: RequestWithTrace, res) => {
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
        const payload = z
          .object({ idempotency_key: z.string().trim().min(8).max(160) })
          .parse(stripCsrfField(req.body));
        const data = await zoomClassOccurrenceService.deleteSynthetic(actor, {
          occurrence_key: String(req.params.occurrenceKey ?? ''),
          ...payload,
        });
        res.json({ success: true, data });
      } catch (error) {
        handleApiError(error, req, res);
      }
    },
  );

  app.use(
    '/api/v1/contact-operations',
    createContactOperationsRouter({
      pool,
      config,
      resolveSession: (req) => sessionFromRequest(req, pool, config),
      verifyCsrf: async (req, session) => {
        if (!isSameOriginPost(req, config)) return false;
        return verifySessionCsrf({
          pool,
          sessionKey: session.session_key,
          csrfToken: req.header('x-csrf-token') ?? req.body?.csrf_token,
        });
      },
      verifyRecentAssurance: async (session) => {
        if (session.user.role === 'owner' || session.user.role === 'admin') {
          return verifyRecentEmailAssurance({ pool, sessionKey: session.session_key });
        }
        if (!session.assurance_at) return false;
        return Date.now() - new Date(session.assurance_at).getTime() <= 10 * 60 * 1000;
      },
      ...(clock ? { now: clock } : {}),
    }),
  );
  app.use(
    '/api/v1/admin-directory',
    createAdminDirectoryRouter({
      pool,
      config,
      resolveSession: (req) => sessionFromRequest(req, pool, config),
      verifyCsrf: async (req, session) => {
        if (!isSameOriginPost(req, config)) return false;
        return verifySessionCsrf({
          pool,
          sessionKey: session.session_key,
          csrfToken: req.header('x-csrf-token') ?? req.body?.csrf_token,
        });
      },
      verifyRecentAssurance: (session) =>
        verifyRecentEmailAssurance({ pool, sessionKey: session.session_key }),
    }),
  );

  app.get(/^\/classroom\/launch\/.+$/, (_req, res) => {
    setPrivateNoStore(res);
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.status(410).type('html').send(expiredClassroomLaunchHtml());
  });

  app.get('/classroom/launch', async (req: RequestWithTrace, res) => {
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
    const actor = await resolvePortalActor(req);
    const zoomSdkAllowedForStudent =
      resolvedZoomClassOccurrenceProvider !== undefined && actor?.actor_role === 'student';
    await ensureSessionCsrfCookie(req, res, pool, config, session);
    setPrivateNoStore(res);
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), fullscreen=(self)');
    res.setHeader(
      'Content-Security-Policy',
      (zoomSdkAllowedForStudent
        ? [
            "default-src 'self'",
            "img-src 'self' data: blob: https://source.zoom.us",
            "script-src 'self' https://source.zoom.us 'unsafe-eval' 'wasm-unsafe-eval'",
            "style-src 'self' 'unsafe-inline' https://source.zoom.us",
            "connect-src 'self' https://*.zoom.us wss://*.zoom.us",
            "worker-src 'self' blob:",
            "media-src 'self' blob: mediastream:",
            "object-src 'none'",
            "base-uri 'self'",
            "frame-ancestors 'none'",
          ]
        : [
            "default-src 'self'",
            "img-src 'self' data:",
            "script-src 'self'",
            "style-src 'self'",
            "connect-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "frame-ancestors 'none'",
          ]
      ).join('; '),
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

  app.get('/api/v1/live-class/questions', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    const actor = await resolvePortalActor(req);
    if (!actor) {
      res.status(401).json(publicError('UNAUTHENTICATED', 'Please log in again.', req.traceId));
      return;
    }
    try {
      const occurrenceKey = optionalQueryString(req.query.occurrence_key);
      if (['owner', 'admin', 'rabbi'].includes(actor.actor_role)) {
        const snapshot = await liveClassService.consoleSnapshot(actor, occurrenceKey);
        res.json(liveClassConsoleSnapshotSchema.parse(snapshot));
        return;
      }
      const questions = await liveClassService.listQuestions(actor, occurrenceKey);
      res.json(liveClassQuestionListResponseSchema.parse({ success: true, data: { questions } }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.post('/api/v1/live-class/questions', async (req: RequestWithTrace, res) => {
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
      const payload = liveClassQuestionSubmitPayloadSchema.parse(req.body);
      const result = await liveClassService.submitQuestion(actor, payload);
      res.status(201).json(
        liveClassQuestionSubmitResponseSchema.parse({
          success: true,
          data: result,
        }),
      );
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.post('/api/v1/live-class/questions/:id/select', async (req: RequestWithTrace, res) => {
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
      const payload = liveClassQuestionActionPayloadSchema.parse(req.body);
      const data = await liveClassService.selectQuestion(
        actor,
        String(req.params.id),
        payload.idempotency_key,
      );
      res.json(liveClassCommandResponseSchema.parse({ success: true, data }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.post('/api/v1/live-class/questions/:id/ready', async (req: RequestWithTrace, res) => {
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
      const payload = liveClassQuestionReadyPayloadSchema.parse(req.body);
      const question = await liveClassService.markReady(actor, String(req.params.id), payload);
      res.json({ success: true, data: { question } });
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.post('/api/v1/live-class/questions/:id/live', async (req: RequestWithTrace, res) => {
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
      const payload = liveClassQuestionActionPayloadSchema.parse(req.body);
      const data = await liveClassService.goLive(
        actor,
        String(req.params.id),
        payload.idempotency_key,
      );
      res.json(liveClassCommandResponseSchema.parse({ success: true, data }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.post('/api/v1/live-class/questions/:id/complete', async (req: RequestWithTrace, res) => {
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
      const payload = liveClassQuestionCompletePayloadSchema.parse(req.body);
      const data = await liveClassService.completeQuestion(actor, String(req.params.id), payload);
      res.json(liveClassCommandResponseSchema.parse({ success: true, data }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.get('/api/v1/live-class/zoom/admin/status', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    const actor = await resolvePortalActor(req);
    if (!actor) {
      res.status(401).json(publicError('UNAUTHENTICATED', 'Please log in again.', req.traceId));
      return;
    }
    try {
      const data = await zoomAdminService.status(actor);
      res.json(liveClassZoomAdminStatusResponseSchema.parse({ success: true, data }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.post('/api/v1/live-class/zoom/admin/check', async (req: RequestWithTrace, res) => {
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
      liveClassZoomAdminActionPayloadSchema.parse(req.body);
      const data = await zoomAdminService.checkConnection(actor);
      res.json(liveClassZoomAdminStatusResponseSchema.parse({ success: true, data }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.post('/api/v1/live-class/zoom/control', async (req: RequestWithTrace, res) => {
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
      const payload = liveClassZoomControlPayloadSchema.parse(req.body);
      const data = await liveClassService.zoomControl(actor, payload);
      res.json(liveClassCommandResponseSchema.parse({ success: true, data }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.get('/api/v1/live-class/zoom/host/bootstrap', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    const actor = await resolvePortalActor(req);
    if (!actor) {
      res.status(401).json(publicError('UNAUTHENTICATED', 'Please log in again.', req.traceId));
      return;
    }
    try {
      const data = await liveClassService.zoomHostBootstrap(
        actor,
        optionalQueryString(req.query.occurrence_key),
      );
      res.json(liveClassZoomHostBootstrapResponseSchema.parse({ success: true, data }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.get('/api/v1/live-class/zoom/participant/bootstrap', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    const actor = await resolvePortalActor(req);
    if (!actor) {
      res.status(401).json(publicError('UNAUTHENTICATED', 'Please log in again.', req.traceId));
      return;
    }
    try {
      const student = z.coerce.number().int().min(1).max(3).parse(req.query.student);
      const data = await liveClassService.zoomTestParticipantBootstrap(
        actor,
        student,
        optionalQueryString(req.query.occurrence_key),
      );
      res.json(liveClassZoomTestParticipantBootstrapResponseSchema.parse({ success: true, data }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.get('/api/v1/live-class/zoom/host/commands', async (req: RequestWithTrace, res) => {
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
      const commands = await liveClassService.pollZoomCommands(actor, occurrenceKey);
      res.json(liveClassZoomCommandPollResponseSchema.parse({ success: true, data: { commands } }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.post('/api/v1/live-class/zoom/host/participants', async (req: RequestWithTrace, res) => {
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
      const payload = liveClassZoomParticipantSyncPayloadSchema.parse(req.body);
      const data = await liveClassService.syncZoomParticipants(actor, payload);
      res.json(liveClassZoomParticipantSyncResponseSchema.parse({ success: true, data }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.post('/api/v1/live-class/zoom/host/commands/report', async (req: RequestWithTrace, res) => {
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
      const payload = liveClassObsCommandReportPayloadSchema.parse(req.body);
      const data = await liveClassService.reportZoomCommand(actor, payload);
      res.json({ success: true, data });
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.get('/api/v1/live-class/obs/commands', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    if (!requireObsBridgeToken(req, res, config)) return;
    try {
      const occurrenceKey = String(req.query.occurrence_key ?? '');
      const commands = await liveClassService.pollObsCommands(
        { account_key: config.accountKey, product_key: config.productKey },
        occurrenceKey,
      );
      res.json(liveClassObsCommandPollResponseSchema.parse({ success: true, data: { commands } }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.post('/api/v1/live-class/obs/commands', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    if (req.body && typeof req.body === 'object' && 'command_key' in req.body) {
      if (!requireObsBridgeToken(req, res, config)) return;
      try {
        const payload = liveClassObsCommandReportPayloadSchema.parse(req.body);
        const result = await liveClassService.reportObsCommand(
          { account_key: config.accountKey, product_key: config.productKey },
          payload,
        );
        res.json({ success: true, data: result });
      } catch (error) {
        handleApiError(error, req, res);
      }
      return;
    }

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
      const payload = liveClassObsCommandPayloadSchema.parse(req.body);
      const data = await liveClassService.obsCommand(actor, payload);
      res.json(liveClassCommandResponseSchema.parse({ success: true, data }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.get('/api/v1/live-class/stage/:stageSession', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    try {
      const stage = await liveClassService.stageSnapshot(String(req.params.stageSession));
      res.json(liveClassStageResponseSchema.parse({ success: true, data: stage }));
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

  app.use(
    '/api/v1/portals/parent',
    rejectRetiredPortalSurface,
    createParentPortalRouter({
      resolveActor: resolvePortalActor,
      verifyCsrf: verifyPortalCsrf,
      verifyRecentAssurance: verifyPortalRecentAssurance,
      service: createParentPortalService(portalServiceDeps),
    }),
  );
  app.use(
    '/api/v1/portals/student',
    rejectRetiredPortalSurface,
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

  app.get('/api/v1/admin/classes/series', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!['owner', 'admin'].includes(session.user.role)) {
      res
        .status(403)
        .json(publicError('FORBIDDEN', 'Owner or Admin access required.', req.traceId));
      return;
    }
    try {
      const series = await withTiming(req, 'db', () => listManagedClassSeries({ pool, config }));
      res.json(classSeriesListResponseSchema.parse({ success: true, series }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.post('/api/v1/admin/classes/series', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!['owner', 'admin'].includes(session.user.role)) {
      res
        .status(403)
        .json(publicError('FORBIDDEN', 'Owner or Admin access required.', req.traceId));
      return;
    }
    if (!(await requireSessionCsrf(req, res, pool, session))) return;
    try {
      const payload = createClassSeriesPayloadSchema.parse(req.body);
      const series = await withTiming(req, 'db', () =>
        createManagedClassSeries({
          pool,
          config,
          actor: { userKey: session.user.user_key, role: session.user.role as 'owner' | 'admin' },
          payload,
        }),
      );
      res.status(201).json(classSeriesResponseSchema.parse({ success: true, series }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.patch('/api/v1/admin/classes/series/:seriesKey', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!['owner', 'admin'].includes(session.user.role)) {
      res
        .status(403)
        .json(publicError('FORBIDDEN', 'Owner or Admin access required.', req.traceId));
      return;
    }
    if (!(await requireSessionCsrf(req, res, pool, session))) return;
    try {
      const payload = updateClassSeriesPayloadSchema.parse(req.body);
      const series = await withTiming(req, 'db', () =>
        updateManagedClassSeries({
          pool,
          config,
          actor: { userKey: session.user.user_key, role: session.user.role as 'owner' | 'admin' },
          seriesKey: String(req.params.seriesKey),
          payload,
        }),
      );
      res.json(classSeriesResponseSchema.parse({ success: true, series }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.post('/api/v1/admin/classes/occurrences', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!['owner', 'admin'].includes(session.user.role)) {
      res
        .status(403)
        .json(publicError('FORBIDDEN', 'Owner or Admin access required.', req.traceId));
      return;
    }
    if (!(await requireSessionCsrf(req, res, pool, session))) return;
    try {
      const payload = createClassOccurrencePayloadSchema.parse(req.body);
      const occurrence = await withTiming(req, 'db', () =>
        createManagedClassOccurrence({
          pool,
          config,
          actor: { userKey: session.user.user_key, role: session.user.role as 'owner' | 'admin' },
          payload,
        }),
      );
      res
        .status(201)
        .json(managedClassOccurrenceResponseSchema.parse({ success: true, occurrence }));
    } catch (error) {
      handleApiError(error, req, res);
    }
  });

  app.get(
    '/api/v1/admin/classes/occurrences/:occurrenceKey',
    async (req: RequestWithTrace, res) => {
      setPrivateNoStore(res);
      const session = await requireApiSession(req, res, pool, config);
      if (!session) return;
      if (!['owner', 'admin'].includes(session.user.role)) {
        res
          .status(403)
          .json(publicError('FORBIDDEN', 'Owner or Admin access required.', req.traceId));
        return;
      }
      try {
        const occurrence = await withTiming(req, 'db', () =>
          getManagedClassOccurrence({
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
        res.json(managedClassOccurrenceResponseSchema.parse({ success: true, occurrence }));
      } catch (error) {
        handleApiError(error, req, res);
      }
    },
  );

  app.patch(
    '/api/v1/admin/classes/occurrences/:occurrenceKey',
    async (req: RequestWithTrace, res) => {
      setPrivateNoStore(res);
      const session = await requireApiSession(req, res, pool, config);
      if (!session) return;
      if (!['owner', 'admin'].includes(session.user.role)) {
        res
          .status(403)
          .json(publicError('FORBIDDEN', 'Owner or Admin access required.', req.traceId));
        return;
      }
      if (!(await requireSessionCsrf(req, res, pool, session))) return;
      try {
        const payload = updateClassOccurrencePayloadSchema.parse(req.body);
        const occurrence = await withTiming(req, 'db', () =>
          updateManagedClassOccurrence({
            pool,
            config,
            actor: {
              userKey: session.user.user_key,
              role: session.user.role as 'owner' | 'admin',
            },
            occurrenceKey: String(req.params.occurrenceKey),
            payload,
          }),
        );
        res.json(managedClassOccurrenceResponseSchema.parse({ success: true, occurrence }));
      } catch (error) {
        handleApiError(error, req, res);
      }
    },
  );

  app.get(
    '/api/v1/admin/classes/occurrences/:occurrenceKey/enrollment-candidates',
    async (req: RequestWithTrace, res) => {
      setPrivateNoStore(res);
      const session = await requireApiSession(req, res, pool, config);
      if (!session) return;
      if (!['owner', 'admin'].includes(session.user.role)) {
        res
          .status(403)
          .json(publicError('FORBIDDEN', 'Owner or Admin access required.', req.traceId));
        return;
      }
      try {
        const candidates = await withTiming(req, 'db', () =>
          listClassEnrollmentCandidates({
            pool,
            config,
            occurrenceKey: String(req.params.occurrenceKey),
          }),
        );
        res.json(classEnrollmentCandidateListResponseSchema.parse({ success: true, candidates }));
      } catch (error) {
        handleApiError(error, req, res);
      }
    },
  );

  app.get(
    '/api/v1/admin/classes/occurrences/:occurrenceKey/enrollments',
    async (req: RequestWithTrace, res) => {
      setPrivateNoStore(res);
      const session = await requireApiSession(req, res, pool, config);
      if (!session) return;
      if (!['owner', 'admin'].includes(session.user.role)) {
        res
          .status(403)
          .json(publicError('FORBIDDEN', 'Owner or Admin access required.', req.traceId));
        return;
      }
      try {
        const enrollments = await withTiming(req, 'db', () =>
          listClassEnrollments({
            pool,
            config,
            occurrenceKey: String(req.params.occurrenceKey),
          }),
        );
        res.json(classEnrollmentListResponseSchema.parse({ success: true, enrollments }));
      } catch (error) {
        handleApiError(error, req, res);
      }
    },
  );

  app.get(
    '/api/v1/admin/classes/occurrences/:occurrenceKey/recordings/:itemKey/access',
    async (req: RequestWithTrace, res) => {
      setPrivateNoStore(res);
      const session = await requireApiSession(req, res, pool, config);
      if (!session) return;
      if (!['owner', 'admin'].includes(session.user.role)) {
        res
          .status(403)
          .json(publicError('FORBIDDEN', 'Owner or Admin access required.', req.traceId));
        return;
      }
      try {
        const access = await withTiming(req, 'db', () =>
          listClassRecordingAccess({
            pool,
            config,
            occurrenceKey: String(req.params.occurrenceKey),
            itemKey: String(req.params.itemKey),
          }),
        );
        res.json(classRecordingAccessListResponseSchema.parse({ success: true, access }));
      } catch (error) {
        handleApiError(error, req, res);
      }
    },
  );

  app.post(
    '/api/v1/admin/classes/occurrences/:occurrenceKey/enrollments',
    async (req: RequestWithTrace, res) => {
      setPrivateNoStore(res);
      const session = await requireApiSession(req, res, pool, config);
      if (!session) return;
      if (!['owner', 'admin'].includes(session.user.role)) {
        res
          .status(403)
          .json(publicError('FORBIDDEN', 'Owner or Admin access required.', req.traceId));
        return;
      }
      if (!(await requireSessionCsrf(req, res, pool, session))) return;
      try {
        const payload = classEnrollmentPayloadSchema.parse(req.body);
        const enrollment = await withTiming(req, 'db', () =>
          enrollLearnerInClass({
            pool,
            config,
            actor: {
              userKey: session.user.user_key,
              role: session.user.role as 'owner' | 'admin',
            },
            occurrenceKey: String(req.params.occurrenceKey),
            payload,
          }),
        );
        res.status(201).json(classEnrollmentResponseSchema.parse({ success: true, enrollment }));
      } catch (error) {
        handleApiError(error, req, res);
      }
    },
  );

  app.post(
    '/api/v1/admin/classes/occurrences/:occurrenceKey/enrollments/:learnerKey/revoke',
    async (req: RequestWithTrace, res) => {
      setPrivateNoStore(res);
      const session = await requireApiSession(req, res, pool, config);
      if (!session) return;
      if (!['owner', 'admin'].includes(session.user.role)) {
        res
          .status(403)
          .json(publicError('FORBIDDEN', 'Owner or Admin access required.', req.traceId));
        return;
      }
      if (!(await requireSessionCsrf(req, res, pool, session))) return;
      try {
        const payload = z
          .object({ idempotency_key: z.string().trim().min(8).max(180) })
          .parse(req.body);
        const enrollment = await withTiming(req, 'db', () =>
          unenrollLearnerFromClass({
            pool,
            config,
            actor: {
              userKey: session.user.user_key,
              role: session.user.role as 'owner' | 'admin',
            },
            occurrenceKey: String(req.params.occurrenceKey),
            learnerKey: String(req.params.learnerKey),
            idempotencyKey: payload.idempotency_key,
          }),
        );
        res.json(classEnrollmentResponseSchema.parse({ success: true, enrollment }));
      } catch (error) {
        handleApiError(error, req, res);
      }
    },
  );

  app.get(
    '/api/v1/admin/classes/occurrences/:occurrenceKey/recordings',
    async (req: RequestWithTrace, res) => {
      setPrivateNoStore(res);
      const session = await requireApiSession(req, res, pool, config);
      if (!session) return;
      if (!['owner', 'admin'].includes(session.user.role)) {
        res
          .status(403)
          .json(publicError('FORBIDDEN', 'Owner or Admin access required.', req.traceId));
        return;
      }
      try {
        const recordings = await withTiming(req, 'db', () =>
          listClassRecordings({
            pool,
            config,
            occurrenceKey: String(req.params.occurrenceKey),
          }),
        );
        res.json(classRecordingListResponseSchema.parse({ success: true, recordings }));
      } catch (error) {
        handleApiError(error, req, res);
      }
    },
  );

  app.post(
    '/api/v1/admin/classes/occurrences/:occurrenceKey/recordings',
    async (req: RequestWithTrace, res) => {
      setPrivateNoStore(res);
      const session = await requireApiSession(req, res, pool, config);
      if (!session) return;
      if (!['owner', 'admin'].includes(session.user.role)) {
        res
          .status(403)
          .json(publicError('FORBIDDEN', 'Owner or Admin access required.', req.traceId));
        return;
      }
      if (!(await requireSessionCsrf(req, res, pool, session))) return;
      try {
        const payload = attachClassRecordingPayloadSchema.parse(req.body);
        const recording = await withTiming(req, 'db', () =>
          attachRecordingToClass({
            pool,
            config,
            actor: {
              userKey: session.user.user_key,
              role: session.user.role as 'owner' | 'admin',
            },
            occurrenceKey: String(req.params.occurrenceKey),
            payload,
          }),
        );
        res.status(201).json(classRecordingResponseSchema.parse({ success: true, recording }));
      } catch (error) {
        handleApiError(error, req, res);
      }
    },
  );

  app.post(
    '/api/v1/admin/classes/occurrences/:occurrenceKey/recordings/:itemKey/access',
    async (req: RequestWithTrace, res) => {
      setPrivateNoStore(res);
      const session = await requireApiSession(req, res, pool, config);
      if (!session) return;
      if (!['owner', 'admin'].includes(session.user.role)) {
        res
          .status(403)
          .json(publicError('FORBIDDEN', 'Owner or Admin access required.', req.traceId));
        return;
      }
      if (!(await requireSessionCsrf(req, res, pool, session))) return;
      try {
        const payload = setClassRecordingAccessPayloadSchema.parse(req.body);
        const recording = await withTiming(req, 'db', () =>
          setClassRecordingLearnerAccess({
            pool,
            config,
            actor: {
              userKey: session.user.user_key,
              role: session.user.role as 'owner' | 'admin',
            },
            occurrenceKey: String(req.params.occurrenceKey),
            itemKey: String(req.params.itemKey),
            payload,
          }),
        );
        res.json(classRecordingResponseSchema.parse({ success: true, recording }));
      } catch (error) {
        handleApiError(error, req, res);
      }
    },
  );

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
    if (!canUseOwnerDashboard(session.user.role)) {
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

  app.post('/api/v1/admin/content/factory/intake', async (req: RequestWithTrace, res) => {
    setPrivateNoStore(res);
    const session = await requireApiSession(req, res, pool, config);
    if (!session) return;
    if (!(await requireSessionCsrf(req, res, pool, session))) return;
    if (!isContentFactoryAdmin(session)) {
      res
        .status(403)
        .json(publicError('FORBIDDEN', 'Owner or Admin access required.', req.traceId));
      return;
    }
    try {
      const staged = await stageProtectedContentFactoryUpload(req);
      let intake;
      try {
        intake = await withTiming(req, 'db', () =>
          createContentFactoryIntake({
            pool,
            config,
            actorUserKey: session.user.user_key,
            actorRole: session.user.role,
            displayName: staged.displayName,
            mimeType: staged.mimeType,
            byteLength: staged.byteLength,
            sourceSha256: staged.sourceSha256,
            privateRefDigest: staged.privateRefDigest,
            storageLocator: staged.storageLocator,
            occurrenceKey: safeDecodedHeader(req.header('x-occurrence-key')) ?? '',
            idempotencyKey: safeDecodedHeader(req.header('x-idempotency-key')) ?? '',
          }),
        );
        if (intake.private_ref_digest !== staged.privateRefDigest) {
          await contentFactoryStorageFromEnv().remove(staged.storageLocator);
        }
      } catch (error) {
        await contentFactoryStorageFromEnv().remove(staged.storageLocator);
        throw error;
      }
      await contentFactoryJobNotifier?.(intake.intake_key);
      res.status(201).json(contentFactoryIntakeResponseSchema.parse({ success: true, intake }));
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
        if (error instanceof ContentFactoryPublicationError) {
          logger.error(
            { stage: error.stage, safe_error_code: error.safeErrorCode },
            'content_factory_publication_failed',
          );
        }
        handleApiError(error, req, res);
      }
    },
  );

  app.post(
    '/api/v1/admin/content/factory/intakes/:intakeKey/retry',
    async (req: RequestWithTrace, res) => {
      setPrivateNoStore(res);
      const session = await requireApiSession(req, res, pool, config);
      if (!session) return;
      if (!(await requireSessionCsrf(req, res, pool, session))) return;
      try {
        await retryContentFactoryIntake({
          pool,
          config,
          intakeKey: String(req.params.intakeKey),
          actorUserKey: session.user.user_key,
          actorRole: session.user.role,
        });
        res.json({ success: true });
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
      const actor = await resolvePortalActor(req);
      if (!actor) throw new ContentFactoryError('NOT_FOUND', 'Content was not found.');
      const playback = await getContentFactoryPlayback({
        pool,
        config,
        sourceKey: String(req.params.sourceKey),
        actor,
      });
      if (playback.isDemo || playback.processingMode === 'synthetic') {
        throw new ContentFactoryError('NOT_FOUND', 'Content was not found.');
      }
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
      const actor = await resolvePortalActor(req);
      if (!actor) throw new ContentFactoryError('NOT_FOUND', 'Content was not found.');
      const playback = await getContentFactoryPlayback({
        pool,
        config,
        sourceKey: String(req.params.sourceKey),
        actor,
      });
      if (playback.isDemo || playback.processingMode === 'synthetic') {
        throw new ContentFactoryError('NOT_FOUND', 'Content was not found.');
      }
      if (!playback.privateProviderAssetId) {
        throw new ContentFactoryError('PLAYBACK_UNAVAILABLE', 'Protected playback is unavailable.');
      }
      res.redirect(
        302,
        `https://player.vimeo.com/video/${encodeURIComponent(playback.privateProviderAssetId)}`,
      );
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
          expectedActiveVersionKey: payload.expected_active_version_key,
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
          expectedActiveVersionKey: payload.expected_active_version_key,
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

  app.post('/api/v1/admin/content/sources/:sourceKey/retry', async (req: RequestWithTrace, res) => {
    await handleOt110aSourceAction(req, res, pool, config, 'content.retry');
  });

  app.post(
    '/api/v1/admin/content/sources/:sourceKey/retract',
    async (req: RequestWithTrace, res) => {
      await handleOt110aSourceAction(req, res, pool, config, 'content.retract');
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

  app.post('/api/v1/crm/contacts/:contactId/reactivate', async (req: RequestWithTrace, res) => {
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
      const result = await withTiming(req, 'db', () =>
        reactivateContact({
          pool,
          config,
          contactId: String(req.params.contactId),
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

  app.use((req, res, next) => {
    const rawPath = req.originalUrl || req.url;
    const normalizedPath = normalizeDomainTransitionPath(rawPath);
    if (
      classifyDomainTransitionPath(rawPath) === 'tisha_bav_archived_asset' ||
      (normalizedPath !== null &&
        /^\/assets\/app-experience-preview(?:-|\.|$)/u.test(normalizedPath))
    ) {
      setPrivateNoStore(res);
      res.status(404).type('text').send('Not found.');
      return;
    }
    next();
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
    express.static(distDir, {
      extensions: ['html'],
      maxAge: config.isProduction ? '1h' : 0,
      setHeaders: (response, filePath) => {
        if (!isMutableBuiltClientAsset(filePath)) return;
        response.setHeader('Cache-Control', 'no-cache, max-age=0, must-revalidate');
        response.setHeader('Pragma', 'no-cache');
        response.setHeader('Expires', '0');
      },
    }),
  );

  app.use(async (_req, res) => {
    res.status(404);
    await sendPublicHtml(res, path.join(distDir, '404.html'), config, '/404');
  });

  return app;
}

function isConfiguredIsolatedStagingHost(
  config: AppConfig,
  hostHeader: string | undefined,
): boolean {
  if (config.oneTimeRuntimeEnvironment !== 'isolated_staging' || !hostHeader) return false;
  try {
    return hostHeader.toLowerCase() === new URL(config.publicBaseUrl).host.toLowerCase();
  } catch {
    return false;
  }
}

function isMutableBuiltClientAsset(filePath: string) {
  return (
    filePath.includes(`${path.sep}assets${path.sep}`) &&
    ['.css', '.js', '.json'].includes(path.extname(filePath).toLowerCase())
  );
}

function publicHtmlFileForPath(pathname: string) {
  if (pathname === '/') return 'index.html';
  if (pathname.startsWith('/app/content/')) return 'app/content.html';
  if (pathname === '/app/classroom') return 'app/student.html';
  const staticPages = new Set([
    '/signup',
    '/signup/received',
    '/school',
    '/school/received',
    '/login',
    '/privacy',
    '/terms',
    '/cancellation-refund',
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
    '/app/live-console',
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
  const response = res.type('html');
  if (
    canonicalPath.startsWith('/app/') ||
    canonicalPath === '/signup/received' ||
    canonicalPath === '/school/received'
  ) {
    response
      .set('Cache-Control', 'no-store, private')
      .set('Pragma', 'no-cache')
      .set('Expires', '0');
  } else {
    response.set('Cache-Control', config.isProduction ? 'public, max-age=3600' : 'no-cache');
  }
  response.send(rewritePublicMetadata(html, config, canonicalPath));
}

function rewritePublicMetadata(html: string, config: AppConfig, canonicalPath: string) {
  const metadataUrl = publicMetadataUrl(config.publicBaseUrl, canonicalPath);
  const rewrittenMetadata = html
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${metadataUrl}">`)
    .replace(
      /<meta property="og:url" content="[^"]*">/,
      `<meta property="og:url" content="${metadataUrl}">`,
    );
  return rewriteAppAssetUrls(rewriteLaunchTiming(rewrittenMetadata, config), config);
}

function rewriteLaunchTiming(html: string, config: AppConfig) {
  return html
    .replaceAll('__ONE_TIME_FIRST_CLASS_AT__', escapeHtml(config.oneTimeFirstClassAt ?? ''))
    .replaceAll(
      '__ONE_TIME_FREE_ACCESS_EXPIRES_AT__',
      escapeHtml(config.oneTimeFreeAccessExpiresAt ?? ''),
    );
}

function rewriteAppAssetUrls(html: string, config: AppConfig) {
  const assetVersion = (config.railwayGitCommitSha ?? config.commitSha ?? config.appVersion)
    .replace(/[^A-Za-z0-9._-]/g, '')
    .slice(0, 64);
  return html.replace(
    /(["'])\/assets\/(app-[^"'?#]+\.(?:js|css))(?:\?[^"']*)?\1/g,
    (_match, quote: string, assetPath: string) =>
      `${quote}/assets/${assetPath}?v=${assetVersion}${quote}`,
  );
}

async function isApprovedSchoolLegacyAdminLoginBridge(
  pool: DbPool,
  config: AppConfig,
  runtimeBinding: SchoolSignupScope,
  normalizedEmail: string,
) {
  const result = await pool.query(
    `SELECT account.human_account_id
       FROM onetime.v21_adult_identities AS adult
       JOIN onetime.v21_human_accounts AS account
         ON account.adult_id = adult.adult_id
        AND account.product_key = adult.product_key
        AND account.runtime_tier = adult.runtime_tier
        AND account.verification_environment_id = adult.verification_environment_id
       JOIN onetime.v21_human_account_role_memberships AS membership
         ON membership.human_account_id = account.human_account_id
        AND membership.product_key = account.product_key
        AND membership.runtime_tier = account.runtime_tier
        AND membership.verification_environment_id = account.verification_environment_id
       AND membership.role = 'admin'
        AND membership.revoked_at IS NULL
       LEFT JOIN onetime.v21_human_account_role_memberships AS parent_membership
         ON parent_membership.human_account_id = account.human_account_id
        AND parent_membership.product_key = account.product_key
        AND parent_membership.runtime_tier = account.runtime_tier
        AND parent_membership.verification_environment_id =
            account.verification_environment_id
        AND parent_membership.role = 'parent'
        AND parent_membership.revoked_at IS NULL
       JOIN onetime.account_users AS legacy
         ON legacy.account_key = $5
        AND legacy.product_key = $6
        AND legacy.email_normalized = adult.normalized_email
        AND legacy.role = 'admin'
        AND legacy.status = 'active'
      WHERE adult.normalized_email = $1
        AND adult.product_key = $2
        AND adult.runtime_tier = $3
        AND adult.verification_environment_id = $4
        AND adult.state = 'active'
        AND account.state = 'active'
        AND parent_membership.human_account_id IS NULL
      LIMIT 2`,
    [
      normalizedEmail,
      runtimeBinding.product,
      runtimeBinding.runtime_tier,
      runtimeBinding.verification_environment_id,
      config.accountKey,
      config.productKey,
    ],
  );
  return result.rowCount === 1 && typeof result.rows[0]?.human_account_id === 'string';
}

async function approvedSchoolAdminSessionFromRequest(
  req: Request,
  pool: DbPool,
  config: AppConfig,
  runtimeBinding: SchoolSignupScope,
) {
  const session = await sessionFromRequest(req, pool, config);
  if (!session) return null;
  if (session.user.role !== 'admin') {
    return {
      human_account_id: session.user.user_key,
      role: session.user.role === 'student' ? ('student' as const) : ('parent' as const),
    };
  }
  const result = await pool.query(
    `SELECT account.human_account_id
       FROM onetime.v21_adult_identities AS adult
       JOIN onetime.v21_human_accounts AS account
         ON account.adult_id = adult.adult_id
        AND account.product_key = adult.product_key
        AND account.runtime_tier = adult.runtime_tier
        AND account.verification_environment_id = adult.verification_environment_id
       JOIN onetime.v21_human_account_role_memberships AS membership
         ON membership.human_account_id = account.human_account_id
        AND membership.product_key = account.product_key
        AND membership.runtime_tier = account.runtime_tier
        AND membership.verification_environment_id = account.verification_environment_id
        AND membership.role = 'admin'
        AND membership.revoked_at IS NULL
      WHERE adult.normalized_email = $1
        AND adult.product_key = $2
        AND adult.runtime_tier = $3
        AND adult.verification_environment_id = $4
        AND adult.state = 'active'
        AND account.state = 'active'
      LIMIT 2`,
    [
      session.user.email.trim().toLowerCase(),
      runtimeBinding.product,
      runtimeBinding.runtime_tier,
      runtimeBinding.verification_environment_id,
    ],
  );
  if (result.rowCount !== 1 || typeof result.rows[0]?.human_account_id !== 'string') return null;
  return { human_account_id: result.rows[0].human_account_id, role: 'admin' as const };
}

function publicMetadataUrl(publicBaseUrl: string, canonicalPath: string) {
  const origin = new URL(publicBaseUrl).origin;
  if (!canonicalPath.startsWith('/') || canonicalPath.startsWith('//')) {
    throw new Error('Canonical public metadata paths must be root-relative.');
  }
  return new URL(canonicalPath, `${origin}/`).toString();
}

async function resolveSupportV21RouteContext(
  req: RequestWithTrace,
  res: Response,
  input: {
    pool: DbPool;
    config: AppConfig;
    v21AdultSessionRuntime: V21AdultSessionRuntime;
    clock?: (() => Date) | undefined;
  },
): Promise<SupportV21RouteContext | null> {
  const cookieHeader = req.header('cookie');
  if (cookieHeaderHasName(cookieHeader, AUTH_SESSION_COOKIE.name)) {
    const bootstrap = await input.v21AdultSessionRuntime.bootstrapCookieHeader({
      cookie_header: cookieHeader,
      ...(input.clock ? { now: input.clock() } : {}),
    });
    if (bootstrap.status === 'unavailable') {
      res
        .status(503)
        .json(publicError('SERVER_ERROR', 'Session readback is unavailable.', req.traceId));
      return null;
    }
    if (bootstrap.status === 'resolved') {
      const context = bootstrap.context;
      const role = context.session.activeRole;
      return {
        principal: {
          product: 'one_time_mishnayos',
          actorId: context.session.humanAccountId,
          role,
          householdId: role === 'parent' ? (context.household?.householdId ?? null) : null,
          studentId: null,
          adminCapabilities: role === 'admin' ? ['support_operator', 'rabbi_operator'] : [],
        },
        csrfToken: bootstrap.csrf_token,
        sessionKind: 'v21_adult',
      };
    }
  }

  const session = await sessionFromRequest(req, input.pool, input.config);
  if (!session) {
    res.status(401).json(publicError('UNAUTHENTICATED', 'Please log in again.', req.traceId));
    return null;
  }
  const legacyRole = session.user.role === 'owner' ? 'admin' : session.user.role;
  const role =
    legacyRole === 'admin' || legacyRole === 'parent' || legacyRole === 'student'
      ? legacyRole
      : null;
  if (!role) {
    res.status(403).json(publicError('FORBIDDEN', 'Support access is unavailable.', req.traceId));
    return null;
  }
  const scope = await legacySupportScope(input.pool, input.config, session.user.user_key, role);
  if (!scope) {
    res.status(403).json(publicError('FORBIDDEN', 'Support context is unavailable.', req.traceId));
    return null;
  }
  return {
    principal: {
      product: 'one_time_mishnayos',
      actorId: session.user.user_key,
      role,
      householdId: scope.householdId,
      studentId: scope.studentId,
      adminCapabilities: role === 'admin' ? ['support_operator', 'rabbi_operator'] : [],
    },
    csrfToken: await ensureSessionCsrfCookie(req, res, input.pool, input.config, session),
    sessionKind: 'legacy',
  };
}

async function requireSupportV21Csrf(
  req: RequestWithTrace,
  res: Response,
  context: SupportV21RouteContext,
  input: {
    pool: DbPool;
    config: AppConfig;
    v21AdultSessionRuntime: V21AdultSessionRuntime;
    clock?: (() => Date) | undefined;
  },
) {
  if (context.sessionKind === 'v21_adult') {
    const verified = await input.v21AdultSessionRuntime.verifyCsrf({
      cookie_header: req.header('cookie'),
      csrf_token: req.header('x-csrf-token'),
      ...(input.clock ? { now: input.clock() } : {}),
    });
    if (verified) return true;
    res
      .status(403)
      .json(publicError('CSRF_REQUIRED', 'Refresh the page and try again.', req.traceId));
    return false;
  }
  const session = await sessionFromRequest(req, input.pool, input.config);
  if (!session) {
    res.status(401).json(publicError('UNAUTHENTICATED', 'Please log in again.', req.traceId));
    return false;
  }
  return requireResolvedSessionCsrf(req, res, {
    pool: input.pool,
    session: { ...session, session_model: 'legacy' },
    v21AdultSessionRuntime: input.v21AdultSessionRuntime,
    ...(input.clock ? { clock: input.clock } : {}),
  });
}

async function legacySupportScope(
  pool: DbPool,
  config: AppConfig,
  userKey: string,
  role: 'admin' | 'parent' | 'student',
) {
  if (role === 'admin') return { householdId: null, studentId: null };
  if (role === 'parent') {
    const result = await pool.query(
      `SELECT household_key
         FROM onetime.portal_guardian_relationships
        WHERE account_key = $1
          AND product_key = $2
          AND guardian_user_ref = $3
        ORDER BY household_key ASC
        LIMIT 2`,
      [config.accountKey, config.productKey, userKey],
    );
    if (result.rowCount !== 1) return null;
    return { householdId: String(result.rows[0]?.household_key), studentId: null };
  }
  const result = await pool.query(
    `SELECT household_key, learner_key
       FROM onetime.account_learner_identity_links
      WHERE account_key = $1
        AND product_key = $2
        AND user_key = $3
      ORDER BY household_key ASC, learner_key ASC
      LIMIT 2`,
    [config.accountKey, config.productKey, userKey],
  );
  if (result.rowCount !== 1) return null;
  return {
    householdId: String(result.rows[0]?.household_key),
    studentId: String(result.rows[0]?.learner_key),
  };
}

type ResolvedApiSession = AuthenticatedSession & {
  session_model: 'legacy' | 'v21';
};

type ApiSessionResolutionInput = {
  pool: DbPool;
  config: AppConfig;
  v21AdultSessionRuntime: V21AdultSessionRuntime;
  clock?: (() => Date) | undefined;
};

type ApiSessionResolution =
  { status: 'resolved'; session: ResolvedApiSession } | { status: 'missing' | 'unavailable' };

async function readApiSessionFromRequest(
  req: Request,
  input: ApiSessionResolutionInput,
): Promise<ApiSessionResolution> {
  const legacy = await sessionFromRequest(req, input.pool, input.config);
  if (legacy) return { status: 'resolved', session: { ...legacy, session_model: 'legacy' } };

  const cookieHeader = req.header('cookie');
  if (!cookieHeaderHasName(cookieHeader, AUTH_SESSION_COOKIE.name)) return { status: 'missing' };
  const resolution = await input.v21AdultSessionRuntime.resolveCookieHeader({
    cookie_header: cookieHeader,
    ...(input.clock ? { now: input.clock() } : {}),
  });
  if (resolution.status === 'unavailable') return { status: 'unavailable' };
  if (resolution.status !== 'resolved') return { status: 'missing' };

  const context = resolution.context;
  return {
    status: 'resolved',
    session: {
      session_key: context.session.sessionId,
      session_security_version: context.session.securityVersion,
      user: v21ClientUser({
        human_account_id: context.session.humanAccountId,
        adult_id: context.adultId,
        email: context.normalizedEmail,
        display_name: context.ownerDisplayName,
        active_role: context.session.activeRole,
      }),
      expires_at: context.session.absoluteExpiresAt,
      assurance_method: 'password',
      assurance_at: null,
      session_model: 'v21',
    },
  };
}

async function requireResolvedApiSession(
  req: RequestWithTrace,
  res: Response,
  input: ApiSessionResolutionInput,
): Promise<ResolvedApiSession | null> {
  const resolution = await readApiSessionFromRequest(req, input);
  if (resolution.status === 'unavailable') {
    res
      .status(503)
      .json(publicError('SERVER_ERROR', 'Session readback is unavailable.', req.traceId));
    return null;
  }
  if (resolution.status !== 'resolved') {
    setPrivateNoStore(res);
    res.status(401).json(publicError('UNAUTHENTICATED', 'Please log in again.', req.traceId));
    return null;
  }
  exposeServerTiming(req);
  return resolution.session;
}

async function requireAdminDashboardSession(
  req: RequestWithTrace,
  res: Response,
  input: {
    pool: DbPool;
    config: AppConfig;
    v21AdultSessionRuntime: V21AdultSessionRuntime;
    clock?: (() => Date) | undefined;
  },
): Promise<AuthenticatedSession | null> {
  const legacy = await sessionFromRequest(req, input.pool, input.config);
  if (legacy) return legacy;
  const cookieHeader = req.header('cookie');
  if (!cookieHeaderHasName(cookieHeader, AUTH_SESSION_COOKIE.name)) {
    setPrivateNoStore(res);
    res.status(401).json(publicError('UNAUTHENTICATED', 'Please log in again.', req.traceId));
    return null;
  }
  const resolution = await input.v21AdultSessionRuntime.resolveCookieHeader({
    cookie_header: cookieHeader,
    ...(input.clock ? { now: input.clock() } : {}),
  });
  if (resolution.status === 'unavailable') {
    res
      .status(503)
      .json(publicError('SERVER_ERROR', 'Session readback is unavailable.', req.traceId));
    return null;
  }
  if (resolution.status !== 'resolved' || resolution.context.session.activeRole !== 'admin') {
    res.status(403).json(publicError('FORBIDDEN', 'Admin context is required.', req.traceId));
    return null;
  }
  const context = resolution.context;
  return {
    session_key: context.session.sessionId,
    session_security_version: context.session.securityVersion,
    user: v21ClientUser({
      human_account_id: context.session.humanAccountId,
      adult_id: context.adultId,
      email: context.normalizedEmail,
      display_name: context.ownerDisplayName,
      active_role: 'admin',
    }),
    expires_at: context.session.absoluteExpiresAt,
    assurance_method: 'password',
    assurance_at: null,
  };
}

async function verifyResolvedSessionCsrf(
  req: Request,
  input: {
    pool: DbPool;
    session: ResolvedApiSession;
    v21AdultSessionRuntime: V21AdultSessionRuntime;
    clock?: (() => Date) | undefined;
  },
) {
  const csrfToken = req.header('x-csrf-token') ?? req.body?.csrf_token;
  if (input.session.session_model === 'v21') {
    return input.v21AdultSessionRuntime.verifyCsrf({
      cookie_header: req.header('cookie'),
      csrf_token: csrfToken,
      ...(input.clock ? { now: input.clock() } : {}),
    });
  }
  return verifySessionCsrf({
    pool: input.pool,
    sessionKey: input.session.session_key,
    csrfToken,
  });
}

async function requireResolvedSessionCsrf(
  req: RequestWithTrace,
  res: Response,
  input: {
    pool: DbPool;
    session: ResolvedApiSession;
    v21AdultSessionRuntime: V21AdultSessionRuntime;
    clock?: (() => Date) | undefined;
  },
) {
  const valid = await verifyResolvedSessionCsrf(req, input);
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

async function handleResolvedOt110aSourceAction(
  req: RequestWithTrace,
  res: Response,
  input: ApiSessionResolutionInput,
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
  const session = await requireResolvedApiSession(req, res, input);
  if (!session) return;
  if (
    !(await requireResolvedSessionCsrf(req, res, {
      pool: input.pool,
      session,
      v21AdultSessionRuntime: input.v21AdultSessionRuntime,
      ...(input.clock ? { clock: input.clock } : {}),
    }))
  )
    return;
  try {
    const actor = await ot110aActorFromSession(input.pool, input.config, session);
    const payload = contentAdminActionPayloadSchema.parse(req.body);
    const action = await withTiming(req, 'db', () =>
      performOt110aContentAction({
        pool: input.pool,
        config: input.config,
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

function requireSameOriginPost(req: RequestWithTrace, res: Response, config: AppConfig) {
  if (isSameOriginPost(req, config)) return true;
  res.status(403).json(publicError('FORBIDDEN', 'Refresh the page and try again.', req.traceId));
  return false;
}

function requireObsBridgeToken(req: RequestWithTrace, res: Response, config: AppConfig) {
  const expected = config.liveClassObsBridgeToken;
  const submitted =
    req.header('x-ot-live-bridge-token') ?? optionalQueryString(req.query.bridge_token);
  if (!expected || !submitted || !constantDigestEqual(expected, submitted)) {
    res
      .status(403)
      .json(publicError('FORBIDDEN', 'Live OBS bridge token is required.', req.traceId));
    return false;
  }
  return true;
}

function optionalQueryString(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
    return value[0].trim();
  }
  return undefined;
}

function constantDigestEqual(left: string, right: string) {
  return (
    createHash('sha256').update(left).digest('hex') ===
    createHash('sha256').update(right).digest('hex')
  );
}

function providerCanaryAllowlist(config: AppConfig, env: NodeJS.ProcessEnv) {
  const values = [
    'ops05_fixture_webhook',
    config.deliveryTestCanaryEmail,
    config.whatsappCanaryRecipientE164,
    env.ONE_TIME_TELEGRAM_CANARY_CHAT_REF,
    env.ONE_TIME_STRIPE_TEST_CANARY_FIXTURE,
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
  const session = await getSessionByToken({
    pool,
    config,
    sessionToken: getCookie(req, SESSION_COOKIE),
    userAgent: req.header('user-agent') ?? undefined,
  });
  if (!session) return null;
  const currentUser = currentClientUser(session.user);
  return currentUser ? { ...session, user: currentUser } : null;
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
        safeReturnPath(req.originalUrl, input.config) ?? input.fallbackPath,
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
  await sendAppHtml(res, input.distDir, input.appPage, input.config);
}

async function serveEmbeddedClassroomAppShell(
  req: RequestWithTrace,
  res: Response,
  input: {
    pool: DbPool;
    config: AppConfig;
    distDir: string;
    providerReady: boolean;
  },
) {
  const session = await sessionFromRequest(req, input.pool, input.config);
  if (!session) {
    res.redirect(
      302,
      `/login?return_to=${encodeURIComponent(
        safeReturnPath(req.originalUrl, input.config) ?? '/app/student',
      )}`,
    );
    return;
  }
  if (session.user.role !== 'student') {
    setPrivateNoStore(res);
    res.status(403).type('html').send(forbiddenAppHtml('student'));
    return;
  }
  await ensureSessionCsrfCookie(req, res, input.pool, input.config, session);
  setPrivateNoStore(res);
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), fullscreen=(self)');
  res.setHeader(
    'Content-Security-Policy',
    (input.providerReady
      ? [
          "default-src 'self'",
          "img-src 'self' data: blob: https://source.zoom.us",
          "script-src 'self' https://source.zoom.us 'unsafe-eval' 'wasm-unsafe-eval'",
          "style-src 'self' 'unsafe-inline' https://source.zoom.us",
          "connect-src 'self' https://*.zoom.us wss://*.zoom.us",
          "worker-src 'self' blob:",
          "media-src 'self' blob: mediastream:",
          "object-src 'none'",
          "base-uri 'self'",
          "frame-ancestors 'none'",
        ]
      : [
          "default-src 'self'",
          "img-src 'self' data:",
          "script-src 'self'",
          "style-src 'self'",
          "connect-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "frame-ancestors 'none'",
        ]
    ).join('; '),
  );
  await sendAppHtml(res, input.distDir, 'student', input.config);
}

async function serveV21CompatibleParentAppShell(
  req: RequestWithTrace,
  res: Response,
  input: {
    pool: DbPool;
    config: AppConfig;
    distDir: string;
    fallbackPath: string;
    v21AdultSessionRuntime: V21AdultSessionRuntime;
    clock?: (() => Date) | undefined;
  },
) {
  const cookieHeader = req.header('cookie');
  if (!cookieHeaderHasName(cookieHeader, AUTH_SESSION_COOKIE.name)) {
    await serveProtectedAppShell(req, res, {
      pool: input.pool,
      config: input.config,
      distDir: input.distDir,
      appPage: 'parent',
      allowedRoles: ['parent'],
      fallbackPath: input.fallbackPath,
    });
    return;
  }

  const resolution = await input.v21AdultSessionRuntime.resolveCookieHeader({
    cookie_header: cookieHeader,
    ...(input.clock ? { now: input.clock() } : {}),
  });
  if (resolution.status === 'unavailable') {
    setPrivateNoStore(res);
    res.status(503).type('text').send('Parent access is temporarily unavailable.');
    return;
  }
  const context = resolution.status === 'resolved' ? resolution.context : null;
  const authorization = context
    ? authorizeV21ParentRoute({
        context,
        requested_path: req.originalUrl,
      })
    : null;
  if (!context || !authorization?.allowed) {
    if (!context) clearAuthCookies(res, input.config);
    setPrivateNoStore(res);
    res.status(403).type('html').send(forbiddenAppHtml('parent'));
    return;
  }

  if (req.path === '/select-household') {
    setPrivateNoStore(res);
    if (context.ownedHouseholdCount === 1) {
      res.redirect(302, '/app/parent');
      return;
    }
    res.status(409).type('html').send(forbiddenAppHtml('parent'));
    return;
  }

  setPrivateNoStore(res);
  await sendAppHtml(res, input.distDir, 'parent', input.config);
}

async function sendAppHtml(
  res: Response,
  distDir: string,
  appPage: 'crm' | 'live' | 'parent' | 'student',
  config: AppConfig,
) {
  try {
    const html = await readFile(path.join(distDir, 'app', `${appPage}.html`), 'utf8');
    res.status(200).type('html').send(rewriteAppAssetUrls(html, config));
  } catch {
    res
      .status(500)
      .type('text')
      .send(
        `Built ${appPage} app shell is unavailable. Run npm run build before serving protected app routes.`,
      );
  }
}

async function portalActorFromRequest(req: Request, input: ApiSessionResolutionInput) {
  const resolution = await readApiSessionFromRequest(req, input);
  if (resolution.status !== 'resolved') return null;
  const session = resolution.session;
  const [authorizedHouseholds, studentLearner] = await Promise.all([
    session.user.role === 'parent'
      ? parentHouseholdSubjects(input.pool, input.config, session.user.user_key)
      : Promise.resolve([]),
    session.user.role === 'student'
      ? studentLearnerSubject(input.pool, input.config, session.user.user_key)
      : Promise.resolve(null),
  ]);
  return {
    account_key: input.config.accountKey,
    product_key: input.config.productKey,
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
    role: session.user.role === 'rabbi' ? 'public' : session.user.role,
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
        return { ok: false, reason: 'insufficient_capability' };
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

function createParentAccessSummaryAdapter(
  pool: DbPool,
  config: AppConfig,
): NonNullable<PortalServiceDeps['billing']> {
  return {
    summaryForHousehold: async ({ household }) => {
      const access = await readHouseholdAccess({
        db: pool,
        accountKey: config.accountKey,
        productKey: config.productKey,
        householdKey: household.household_key,
      });
      const state = access?.state ?? 'pending';
      const sourceLabel =
        access?.source_kind === 'free_pilot' || access?.source_kind === 'complimentary'
          ? 'Complimentary access'
          : 'Current learning access';
      return {
        enabled: true,
        summary_label: access?.grants_access ? sourceLabel : 'Access not active',
        plan_truth:
          'GHL manages billing. One Time stores only the household’s current learning-access state.',
        entitlement_status: state as
          | 'pending'
          | 'paused'
          | 'active'
          | 'grace'
          | 'suspended'
          | 'scheduled_end'
          | 'revoked'
          | 'manual_review',
        grants_access: access?.grants_access ?? false,
        checkout_available: false,
        customer_portal_available: false,
        recovery_required: ['suspended', 'manual_review'].includes(state),
        current_period_end: access?.expires_at ?? null,
        cancel_at_period_end: state === 'scheduled_end',
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
       JOIN onetime.account_access_projections AS access
         ON access.account_key = relationships.account_key
        AND access.product_key = relationships.product_key
        AND access.household_key = relationships.household_key
        AND access.state IN ('active', 'grace', 'scheduled_end')
        AND access.effective_at <= $4
        AND (access.expires_at IS NULL OR access.expires_at > $4)
      WHERE relationships.account_key = $1
        AND relationships.product_key = $2
        AND relationships.guardian_user_ref = $3
        AND relationships.status = 'active'
        AND relationships.authority <> 'support_only'
        AND households.status = 'active'
      ORDER BY CASE relationships.authority
          WHEN 'primary_guardian' THEN 0
          WHEN 'guardian' THEN 1
          ELSE 2
        END,
        relationships.created_at ASC,
        relationships.relationship_key ASC`,
    [config.accountKey, config.productKey, userKey, new Date()],
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
    `SELECT links.learner_key, links.household_key, access_state.access_state_key,
            account_access.state AS account_access_state
       FROM onetime.account_learner_identity_links AS links
       JOIN onetime.portal_student_access_state AS access_state
         ON access_state.account_key = links.account_key
        AND access_state.product_key = links.product_key
        AND access_state.learner_key = links.learner_key
        AND access_state.student_user_ref = links.user_key
       JOIN onetime.portal_learners AS learners
         ON learners.account_key = links.account_key
        AND learners.product_key = links.product_key
        AND learners.household_key = links.household_key
        AND learners.learner_key = links.learner_key
       JOIN onetime.account_access_projections AS account_access
         ON account_access.account_key = links.account_key
        AND account_access.product_key = links.product_key
        AND account_access.household_key = links.household_key
        AND account_access.state IN ('active', 'grace', 'scheduled_end')
        AND account_access.effective_at <= $4
        AND (account_access.expires_at IS NULL OR account_access.expires_at > $4)
      WHERE links.account_key = $1
        AND links.product_key = $2
        AND links.user_key = $3
        AND links.link_state = 'active'
        AND access_state.status = 'active'
        AND learners.learner_status = 'active'
      ORDER BY links.created_at ASC
      LIMIT 2`,
    [config.accountKey, config.productKey, userKey, new Date()],
  );
  const row = result.rows[0];
  if (!row || result.rows.length !== 1) return null;
  return {
    learner_key: String(row.learner_key),
    household_key: String(row.household_key),
    access_state_key: String(row.access_state_key),
    access_state:
      String(row.account_access_state) === 'grace' ? ('grace' as const) : ('active' as const),
  };
}

function privacySqlPoolForQueryable(queryable: Queryable): PrivacySqlPool {
  return {
    async connect() {
      return {
        async query<Row extends Record<string, unknown> = Record<string, unknown>>(
          text: string,
          values?: readonly unknown[],
        ) {
          const result = await queryable.query(text, values === undefined ? [] : [...values]);
          return {
            rows: result.rows as Row[],
            rowCount: result.rowCount,
          };
        },
        release() {},
      };
    },
  };
}

async function selfManagedStudentPrivacyPrincipalFromRequest(
  req: Request,
  pool: DbPool,
  config: AppConfig,
): Promise<SelfManagedStudentPrivacyPrincipal | null> {
  const session = await sessionFromRequest(req, pool, config);
  if (!session || session.user.role !== 'student') return null;
  const result = await pool.query(
    `SELECT profiles.student_id,
            profiles.household_id,
            profiles.self_adult_id,
            profiles.display_name,
            households.owner_adult_id,
            links.user_key
       FROM onetime.account_learner_identity_links AS links
       JOIN onetime.portal_student_access_state AS access_state
         ON access_state.account_key = links.account_key
        AND access_state.product_key = links.product_key
        AND access_state.learner_key = links.learner_key
        AND access_state.student_user_ref = links.user_key
       JOIN onetime.v21_student_profiles AS profiles
         ON profiles.student_id = links.learner_key
        AND profiles.household_id = links.household_key
        AND profiles.product_key = $4
        AND profiles.runtime_tier = $5
        AND profiles.verification_environment_id = $6
       JOIN onetime.v21_households AS households
         ON households.household_id = profiles.household_id
        AND households.product_key = profiles.product_key
        AND households.runtime_tier = profiles.runtime_tier
        AND households.verification_environment_id = profiles.verification_environment_id
       JOIN onetime.account_users AS users
         ON users.user_key = links.user_key
        AND users.account_key = links.account_key
        AND users.product_key = links.product_key
      WHERE links.account_key = $1
        AND links.product_key = $2
        AND links.user_key = $3
        AND links.link_state = 'active'
        AND access_state.status = 'active'
        AND profiles.relationship = 'self'
        AND profiles.state = 'active'
        AND profiles.self_adult_id = households.owner_adult_id
        AND households.classification = 'family'
        AND households.state = 'active'
        AND users.role = 'student'
        AND users.status = 'active'
      ORDER BY profiles.student_id ASC
      LIMIT 2`,
    [
      config.accountKey,
      config.productKey,
      session.user.user_key,
      'one_time_mishnayos',
      config.oneTimeRuntimeTier,
      config.oneTimeVerificationEnvironmentId,
    ],
  );
  const row = result.rows[0];
  if (!row || result.rows.length !== 1) return null;
  return {
    credential_id: String(row.user_key),
    adult_id: String(row.self_adult_id),
    student_id: String(row.student_id),
    household_id: String(row.household_id),
    owner_adult_id: String(row.owner_adult_id),
    session_id: session.session_key,
    display_name: String(row.display_name),
  };
}

async function contentPublicationIdentityFromRequest(
  req: Request,
  pool: DbPool,
  config: AppConfig,
): Promise<ContentPublicationRequestIdentity | null> {
  if (config.productKey !== CONTENT_PUBLICATION_PRODUCT_KEY) return null;
  const session = await sessionFromRequest(req, pool, config);
  if (!session) return null;

  let student: Awaited<ReturnType<typeof studentLearnerSubject>> | null = null;
  if (session.user.role === 'student') {
    student = await studentLearnerSubject(pool, config, session.user.user_key);
    if (
      !student ||
      !Number.isSafeInteger(session.session_security_version) ||
      Number(session.session_security_version) < 1
    ) {
      return null;
    }
  }

  const role: ContentPublicationPrincipal['role'] =
    session.user.role === 'admin'
      ? 'admin'
      : session.user.role === 'student'
        ? 'student'
        : 'parent';
  return {
    sessionKey: session.session_key,
    principal: {
      actorId: session.user.user_key,
      role,
      accountKey: config.accountKey,
      productKey: CONTENT_PUBLICATION_PRODUCT_KEY,
      householdId: student?.household_key ?? '',
      studentId: student?.learner_key ?? null,
      sessionId: role === 'student' ? session.session_key : null,
      sessionVersion: role === 'student' ? Number(session.session_security_version) : null,
      accessState: role === 'admin' ? 'active' : (student?.access_state ?? 'inactive'),
    },
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
  if (error instanceof ClassManagementError) {
    const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'INVALID_STATE' ? 400 : 409;
    res.status(status).json({
      success: false,
      code: error.code,
      message: error.message,
      ...(error.currentVersion ? { current_version: error.currentVersion } : {}),
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
  if (code === 'VALIDATION_ERROR' || code === 'PASSWORD_POLICY_FAILED') return 400;
  if (code === 'RATE_LIMITED') return 429;
  if (
    code === 'IDEMPOTENCY_CONFLICT' ||
    code === 'VERSION_CONFLICT' ||
    code === 'LEARNER_LIMIT_REACHED' ||
    code === 'ENTITLEMENT_REQUIRED' ||
    code === 'CONSENT_REQUIRED' ||
    code === 'USERNAME_UNAVAILABLE'
  ) {
    return 409;
  }
  if (code === 'OCCURRENCE_UNAVAILABLE' || code === 'LAUNCH_EXPIRED') return 410;
  if (code === 'ADAPTER_UNAVAILABLE' || code === 'PROVIDER_OFF' || code === 'PROVIDER_NOT_READY') {
    return 503;
  }
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
  return role === 'owner' || role === 'admin' || role === 'rabbi';
}

function canReadContacts(role: string) {
  return role === 'owner' || role === 'admin';
}

function canReadContentLibrary(role: string) {
  return role === 'owner' || role === 'admin' || role === 'rabbi';
}

function currentClientUser(user: SessionUser): SessionUser | null {
  if (user.role === 'owner' || user.role === 'rabbi') {
    return { ...user, role: 'admin', role_label: 'Admin' };
  }
  if (user.role === 'admin') {
    return { ...user, role_label: 'Admin' };
  }
  if (user.role === 'parent' || user.role === 'student') return user;
  return null;
}

function v21ClientUser(input: {
  human_account_id: string;
  adult_id: string;
  email: string;
  display_name: string;
  active_role?: 'admin' | 'parent';
}): SessionUser {
  const role = input.active_role ?? 'parent';
  return {
    user_key: input.human_account_id,
    email: input.email,
    display_name: input.display_name,
    role,
    role_label: role === 'admin' ? 'Admin' : 'Parent',
    mfa_capable: false,
  };
}

async function insertV21AuthAudit(
  pool: DbPool,
  config: AppConfig,
  event: {
    eventType: 'login_rate_limited' | 'login_failed' | 'login_succeeded' | 'logout_succeeded';
    userKey?: string | undefined;
    success: boolean;
    reason?: string | undefined;
    ip?: string | undefined;
    userAgent?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
  },
) {
  const eventKey = stableKey('auth_audit', [
    config.accountKey,
    config.productKey,
    event.eventType,
    event.userKey ?? 'anonymous',
    randomUUID(),
  ]);
  const ipHash = event.ip ? createHash('sha256').update(event.ip).digest('hex') : null;
  const userAgentHash = event.userAgent
    ? createHash('sha256').update(event.userAgent).digest('hex')
    : null;
  await pool.query(
    `INSERT INTO onetime.auth_audit_events
       (event_key, account_key, product_key, user_key, event_type, success, reason,
        ip_hash, user_agent_hash, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
    [
      eventKey,
      config.accountKey,
      config.productKey,
      event.userKey ?? null,
      event.eventType,
      event.success,
      event.reason ?? null,
      ipHash,
      userAgentHash,
      JSON.stringify(event.metadata ?? {}),
    ],
  );
  const readback = await pool.query(
    `SELECT user_key, event_type, success, reason, ip_hash, user_agent_hash, metadata
       FROM onetime.auth_audit_events
      WHERE event_key = $1
        AND account_key = $2
        AND product_key = $3
      LIMIT 1`,
    [eventKey, config.accountKey, config.productKey],
  );
  const row = readback.rows[0];
  if (
    readback.rowCount !== 1 ||
    (row?.user_key ?? null) !== (event.userKey ?? null) ||
    row?.event_type !== event.eventType ||
    row?.success !== event.success ||
    (row?.reason ?? null) !== (event.reason ?? null) ||
    (row?.ip_hash ?? null) !== ipHash ||
    (row?.user_agent_hash ?? null) !== userAgentHash ||
    !isDeepStrictEqual(row?.metadata ?? {}, event.metadata ?? {})
  ) {
    throw new Error('The v2.1 auth-audit event failed exact redacted readback.');
  }
}

type V21LoginBudget = {
  scope: string;
  subject: string;
  limit: number;
  windowMs: number;
};

type V21LoginReservation = {
  key: string;
  resetAt: Date;
};

type V21LoginAttemptReservation =
  | { allowed: true; reservations: V21LoginReservation[] }
  | {
      allowed: false;
      reservations: [];
      scope?: string;
      retryAfterSeconds?: number;
    };

async function reserveV21LoginAttempt(input: {
  pool: DbPool;
  config: AppConfig;
  budgets: V21LoginBudget[];
  now: Date;
}): Promise<V21LoginAttemptReservation> {
  return inTransaction(input.pool, async (db) => {
    const reservations: V21LoginReservation[] = [];
    const reservationKeys = new Set<string>();
    for (const budget of input.budgets) {
      if (budget.limit <= 0) continue;
      const key = v21LoginBudgetKey(input.config, budget);
      if (reservationKeys.has(key)) {
        throw new Error('The login-attempt reservation contained a duplicate budget key.');
      }
      reservationKeys.add(key);
      const resetAt = new Date(input.now.getTime() + budget.windowMs);
      const expiresAt = new Date(resetAt.getTime() + budget.windowMs);
      const result = await db.query(
        `INSERT INTO onetime.rate_limit_buckets
           (budget_key, account_key, product_key, scope, count, reset_at, expires_at)
         VALUES ($1,$2,$3,$4,1,$5,$6)
         ON CONFLICT (budget_key)
         DO UPDATE SET
           count = CASE
             WHEN onetime.rate_limit_buckets.reset_at <= $7 THEN 1
             ELSE onetime.rate_limit_buckets.count + 1
           END,
           reset_at = CASE
             WHEN onetime.rate_limit_buckets.reset_at <= $7 THEN $5
             ELSE onetime.rate_limit_buckets.reset_at
           END,
           expires_at = CASE
             WHEN onetime.rate_limit_buckets.reset_at <= $7 THEN $6
             ELSE onetime.rate_limit_buckets.expires_at
           END,
           updated_at = $7
         RETURNING count, reset_at`,
        [
          key,
          input.config.accountKey,
          input.config.productKey,
          budget.scope,
          resetAt,
          expiresAt,
          input.now,
        ],
      );
      const row = result.rows[0];
      const reservedResetAt = databaseInstant(row?.reset_at, 'Login-attempt reservation');
      reservations.push({ key, resetAt: reservedResetAt });
      if (Number(row?.count ?? 0) <= budget.limit) continue;
      await releaseV21LoginReservations(db, reservations, input.now);
      return {
        allowed: false,
        reservations: [],
        scope: budget.scope,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((reservedResetAt.getTime() - input.now.getTime()) / 1000),
        ),
      };
    }
    return { allowed: true, reservations };
  });
}

async function releaseV21LoginReservations(
  db: Queryable,
  reservations: readonly V21LoginReservation[],
  now: Date,
): Promise<void> {
  if (reservations.length === 0) return;
  const values: unknown[] = [now];
  const predicates = reservations.map((reservation, index) => {
    values.push(reservation.key, reservation.resetAt);
    const keyParameter = index * 2 + 2;
    return `(budget_key = $${keyParameter} AND reset_at = $${keyParameter + 1})`;
  });
  const result = await db.query(
    `UPDATE onetime.rate_limit_buckets
        SET count = GREATEST(count - 1, 0),
            updated_at = $1
      WHERE ${predicates.join(' OR ')}
      RETURNING budget_key, count, reset_at`,
    values,
  );
  if (result.rowCount !== reservations.length) {
    throw new Error('The login-attempt reservation release did not match every exact budget.');
  }
  const released = new Map(
    result.rows.map((row) => [
      String(row.budget_key),
      { count: Number(row.count), resetAt: databaseInstant(row.reset_at, 'Login-attempt release') },
    ]),
  );
  for (const reservation of reservations) {
    const row = released.get(reservation.key);
    if (
      !row ||
      !Number.isSafeInteger(row.count) ||
      row.count < 0 ||
      !Number.isFinite(row.resetAt.getTime()) ||
      row.resetAt.getTime() !== reservation.resetAt.getTime()
    ) {
      throw new Error('The login-attempt reservation release failed exact readback.');
    }
  }
}

function v21LoginBudgetKey(config: AppConfig, budget: V21LoginBudget): string {
  return createHash('sha256')
    .update([config.accountKey, config.productKey, budget.scope, budget.subject].join('\0'))
    .digest('hex');
}

function isContentFactoryAdmin(session: AuthenticatedSession) {
  return session.user.role === 'owner' || session.user.role === 'admin';
}

function canUseOwnerDashboard(role: string) {
  return role === 'owner' || role === 'admin';
}

function canUseRabbiTeachingSurface(role: string, path: string) {
  return (
    role === 'rabbi' &&
    (path === '/app/dashboard' ||
      path === '/app/content' ||
      path === '/app/classes' ||
      path.startsWith('/app/classes/'))
  );
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

function hashCookieValue(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function getCookie(req: Request, name: string) {
  const result = readCookie(req, name);
  return result.status === 'value' ? result.value : undefined;
}

function readCookie(
  req: Request,
  name: string,
): { status: 'absent' } | { status: 'invalid' } | { status: 'value'; value: string } {
  const header = req.header('cookie');
  if (!header) return { status: 'absent' };
  const encodedValues: string[] = [];
  for (const part of header.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (rawName === name) encodedValues.push(rawValue.join('='));
  }
  if (encodedValues.length === 0) return { status: 'absent' };
  if (encodedValues.length !== 1 || !encodedValues[0]) return { status: 'invalid' };
  try {
    const value = decodeURIComponent(encodedValues[0]);
    return value ? { status: 'value', value } : { status: 'invalid' };
  } catch {
    return { status: 'invalid' };
  }
}

function cookieHeaderHasName(header: string | undefined, name: string) {
  if (!header) return false;
  return header.split(';').some((part) => {
    const separator = part.indexOf('=');
    return separator >= 0 && part.slice(0, separator).trim() === name;
  });
}

async function revokePresentedLegacySession(
  req: Request,
  pool: DbPool,
  config: AppConfig,
  reason: 'login_rotation' | 'logout',
) {
  const presented = readCookie(req, SESSION_COOKIE);
  if (presented.status === 'invalid') return true;
  if (presented.status === 'absent') return true;
  const sessionToken = presented.value;
  await revokeSession({
    pool,
    config,
    sessionToken,
    reason,
    ip: req.ip,
    userAgent: req.header('user-agent') ?? undefined,
  });
  const readback = await pool.query(
    `SELECT 1
       FROM onetime.user_sessions
      WHERE account_key = $1
        AND product_key = $2
        AND token_hash = $3
        AND revoked_at IS NULL
      LIMIT 1`,
    [config.accountKey, config.productKey, createHash('sha256').update(sessionToken).digest('hex')],
  );
  return readback.rowCount === 0;
}

async function revokeIssuedV21LoginSession(
  runtime: V21AdultSessionRuntime,
  browserSessionToken: string,
  now: Date,
): Promise<boolean> {
  try {
    const outcome = await runtime.rotateCookieHeader({
      cookie_header: `${AUTH_SESSION_COOKIE.name}=${encodeURIComponent(browserSessionToken)}`,
      now,
    });
    return outcome.revoked;
  } catch {
    return false;
  }
}

function setAuthCookies(res: Response, config: AppConfig, sessionToken: string, csrfToken: string) {
  res.cookie(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: config.runtime.requiresSecureCookies,
    sameSite: 'strict',
    path: '/',
    maxAge: 8 * 60 * 60 * 1000,
  });
  setCsrfCookie(res, config, csrfToken);
}

function setCsrfCookie(res: Response, config: AppConfig, csrfToken: string) {
  res.cookie(CSRF_COOKIE, csrfToken, {
    httpOnly: false,
    secure: config.runtime.requiresSecureCookies,
    sameSite: 'strict',
    path: '/',
    maxAge: 8 * 60 * 60 * 1000,
  });
}

function clearAuthCookies(res: Response, config: AppConfig) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: config.runtime.requiresSecureCookies,
    sameSite: 'strict',
    path: '/',
  });
  res.clearCookie(CSRF_COOKIE, {
    httpOnly: false,
    secure: config.runtime.requiresSecureCookies,
    sameSite: 'strict',
    path: '/',
  });
  res.append('Set-Cookie', clearSessionCookieHeader());
}

function setPrivateNoStore(res: Response) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.removeHeader('ETag');
  res.removeHeader('Last-Modified');
}

function rejectRetiredPortalSurface(req: Request, res: Response, next: express.NextFunction) {
  if (req.path.endsWith('/helper/query')) {
    setPrivateNoStore(res);
    res.status(404).json({
      success: false,
      code: 'NOT_FOUND',
      message: 'This portal action is not available.',
    });
    return;
  }
  next();
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
  if (code === 'IDENTITY_CONFLICT') return 409;
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
  if (role === 'rabbi') return '/app/dashboard';
  if (role === 'parent') return '/app/parent';
  if (role === 'student') return '/app/student';
  return '/app/crm';
}

function returnPathForRole(value: string | undefined, role: string, config: AppConfig) {
  const safe = safeReturnPath(value, config);
  if (!safe) return defaultRouteForRole(role);
  const pathname = new URL(safe, config.publicBaseUrl).pathname;
  const startsWithRoute = (route: string) => pathname === route || pathname.startsWith(`${route}/`);
  if (role === 'owner' || role === 'admin') {
    return !startsWithRoute('/app') ||
      startsWithRoute('/app/parent') ||
      startsWithRoute('/app/student') ||
      startsWithRoute('/app/support')
      ? defaultRouteForRole(role)
      : safe;
  }
  if (role === 'parent') {
    return startsWithRoute('/app/parent') || startsWithRoute('/app/billing/checkout')
      ? safe
      : defaultRouteForRole(role);
  }
  if (role === 'student') {
    return startsWithRoute('/app/student') ? safe : defaultRouteForRole(role);
  }
  return startsWithRoute('/app/crm') ? safe : defaultRouteForRole(role);
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
      <h1 id="dashboard-forbidden-title">Admin dashboard access unavailable</h1>
      <p>This signed-in account cannot open the Admin shell.</p>
      <a class="button-primary" href="/login?return_to=${encodeURIComponent(
        requestPath,
      )}">Sign in</a>
    </section>
  </main>
</body>
</html>`;
}

function canonicalAuthStatePageHtml(title: string, message: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>${escapeHtml(title)} | One Time Mishnayos</title>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <p><a href="/login">Return to login</a></p>
    </main>
  </body>
</html>`;
}

function roleSelectionPageHtml(activeRole: 'admin' | 'parent') {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Choose account context | One Time Mishnayos</title>
  <meta name="robots" content="noindex, nofollow">
  <meta name="theme-color" content="#050505">
  <link rel="stylesheet" href="/assets/public.css">
</head>
<body>
  <main class="login-page role-selection-page">
    <section class="login-panel role-selection-panel" data-role-selector data-active-role="${activeRole}">
      <a class="brand-lockup login-brand" href="/" aria-label="One Time Mishnayos home">
        <img src="/assets/brand/onetimelogo.webp" width="56" height="56" alt="" aria-hidden="true">
        <span><strong>One Time Mishnayos</strong><small>Account context</small></span>
      </a>
      <p class="eyebrow">Signed in once</p>
      <h1>How would you like to continue?</h1>
      <p>Choose one role now. You can switch again from the signed-in header.</p>
      <div class="role-selection-actions">
        <button class="button button-primary" type="button" data-select-role="admin">Continue as Admin</button>
        <button class="button button-secondary" type="button" data-select-role="parent">Continue as Parent</button>
      </div>
      <p class="form-status" role="status" data-role-status></p>
    </section>
  </main>
  <script type="module" src="/assets/public.js"></script>
</body>
</html>`;
}

function householdSelectionPageHtml(
  households: readonly { householdId: string; displayName: string }[],
  activeHouseholdId: string | null,
) {
  const householdButtons = households
    .map((household) => {
      const active = household.householdId === activeHouseholdId;
      return `<button class="button ${active ? 'button-primary' : 'button-secondary'}" type="button" data-select-household="${escapeHtml(household.householdId)}"${active ? ' aria-current="true"' : ''}>
        <span>${escapeHtml(household.displayName)}</span>${active ? '<small>Current household</small>' : ''}
      </button>`;
    })
    .join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Choose household | One Time Mishnayos</title>
  <meta name="robots" content="noindex, nofollow">
  <meta name="theme-color" content="#050505">
  <link rel="stylesheet" href="/assets/public.css">
</head>
<body>
  <main class="login-page role-selection-page">
    <section class="login-panel role-selection-panel" data-household-selector data-active-household="${escapeHtml(activeHouseholdId ?? '')}">
      <a class="brand-lockup login-brand" href="/" aria-label="One Time Mishnayos home">
        <img src="/assets/brand/onetimelogo.webp" width="56" height="56" alt="" aria-hidden="true">
        <span><strong>One Time Mishnayos</strong><small>Household context</small></span>
      </a>
      <p class="eyebrow">Parent workspace</p>
      <h1>Which household would you like to manage?</h1>
      <p>Only households owned by this signed-in account are available.</p>
      <div class="role-selection-actions">${householdButtons}</div>
      <p class="form-status" role="status" data-household-status></p>
    </section>
  </main>
  <script type="module" src="/assets/public.js"></script>
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
          <label for="identifier">Email or student username</label>
          <input id="identifier" name="identifier" type="text" autocomplete="username" required>
          <p tabindex="-1" class="error" data-error-for="identifier"></p>
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required>
          <p tabindex="-1" class="error" data-error-for="password"></p>
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
      <div id="zmmtg-root" data-classroom-sdk-root aria-live="polite"></div>
      <button class="button button-primary" type="button" data-classroom-retry hidden>Retry</button>
      <button class="button" type="button" data-classroom-leave hidden>Leave</button>
    </section>
  </main>
  <script type="module" src="/assets/app-classroom-launch.js"></script>
</body>
</html>`;
}

function expiredClassroomLaunchHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <meta name="referrer" content="no-referrer">
  <meta name="theme-color" content="#050505">
  <title>Classroom link expired | One Time Mishnayos</title>
  <link rel="stylesheet" href="/assets/app-crm.css">
</head>
<body>
  <main class="app-workspace classroom-launch-page">
    <section class="state-panel error" aria-labelledby="classroom-launch-expired-title">
      <h1 id="classroom-launch-expired-title">Classroom link expired</h1>
      <p>Return to the Student Portal and choose Join class again.</p>
      <a class="button button-primary" href="/app/student">Return to Student Portal</a>
    </section>
  </main>
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
      <p class="eyebrow">${playback.isDemo ? 'Protected synthetic demo lesson' : 'Protected One Time lesson'}</p>
      <h1 id="learning-player-title">${escapeHtml(playback.title)}</h1>
      <p><strong>${escapeHtml(playback.classTitle)}</strong> · ${escapeHtml(playback.classDate)}</p>
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
      <p class="ot-guardrail-note">${
        playback.isDemo
          ? 'Approved synthetic demo data only. No external provider media was used.'
          : 'Approved class material only. No raw Vimeo link is displayed.'
      }</p>
    </section>
  </main>
</body>
</html>`;
}

function zoomHostHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <meta name="referrer" content="no-referrer">
  <meta name="theme-color" content="#050505">
  <title>Zoom Stage Host | One Time Mishnayos</title>
  <link rel="stylesheet" href="/assets/app-crm.css">
</head>
<body>
  <main class="app-workspace classroom-launch-page">
    <section class="state-panel" aria-labelledby="zoom-host-title">
      <h1 id="zoom-host-title">One Time Zoom Stage Host</h1>
      <p>Participant video remains participant-controlled. The host can ask to unmute, mute, and manage spotlight only after the roster is mapped.</p>
      <p data-zoom-host-status role="status">Checking protected Meeting SDK configuration.</p>
      <div id="zmmtg-root" data-zoom-host-root aria-live="polite"></div>
      <a class="button" href="/app/live-console">Return to Rabbi Live Console</a>
    </section>
  </main>
  <script type="module" src="/assets/app-zoom-host.js?v=zoom-real-control-3"></script>
</body>
</html>`;
}

async function stageProtectedContentFactoryUpload(req: Request) {
  const declaredLength = Number(req.header('content-length') ?? 0);
  return contentFactoryStorageFromEnv().stage({
    stream: req,
    displayName: safeDecodedHeader(req.header('x-file-name')) ?? '',
    declaredMimeType: String(req.header('content-type') ?? ''),
    ...(declaredLength > 0 ? { declaredLength } : {}),
  });
}

function safeDecodedHeader(value: string | undefined) {
  if (!value) return null;
  try {
    const decoded = decodeURIComponent(value).trim();
    for (const character of decoded) {
      const code = character.charCodeAt(0);
      if (code <= 0x1f || code === 0x7f) return null;
    }
    return decoded || null;
  } catch {
    return null;
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
