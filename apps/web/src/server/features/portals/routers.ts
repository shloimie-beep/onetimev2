import express, { type Request, type Response } from 'express';
import { ZodError, z } from 'zod';
import {
  createLearnerPayloadSchema,
  helperAnswerSchema,
  helperQueryPayloadSchema,
  idempotencyKeySchema,
  learnerProfileSchema,
  parentLearnerMaterialsSchema,
  parentPortalDashboardSchema,
  protectedActionDescriptorSchema,
  studentAccessOperationTypeSchema,
  studentAccessOperationPayloadSchema,
  studentAccessStateSchema,
  studentQuestionPayloadSchema,
  studentQuestionSchema,
  studentPortalDashboardSchema,
  supportPreviewSchema,
  supportRequestPayloadSchema,
  updateLearnerPayloadSchema,
  type PortalActorContext,
  type PortalErrorCode,
} from '../../../../../../packages/contracts/src/portals/index.ts';
import {
  PortalServiceError,
  type StudentAccessOperationType,
} from '../../../../../../packages/domain/src/portals/services.ts';

type PortalRequest = Request & { traceId?: string };

const protectedLaunchPayloadSchema = z
  .object({
    idempotency_key: idempotencyKeySchema.optional(),
  })
  .strict();

export type PortalActorResolver = (req: Request) => Promise<PortalActorContext | null>;
export type PortalCsrfVerifier = (
  req: Request,
  actor: PortalActorContext,
) => Promise<boolean> | boolean;

type ParentPortalService = {
  dashboard(actor: PortalActorContext, householdKey: string): Promise<unknown>;
  createLearner(
    actor: PortalActorContext,
    householdKey: string,
    payload: z.infer<typeof createLearnerPayloadSchema>,
  ): Promise<unknown>;
  updateLearner(
    actor: PortalActorContext,
    householdKey: string,
    learnerKey: string,
    payload: z.infer<typeof updateLearnerPayloadSchema>,
  ): Promise<unknown>;
  archiveLearner(
    actor: PortalActorContext,
    householdKey: string,
    learnerKey: string,
    payload: z.infer<typeof updateLearnerPayloadSchema>,
  ): Promise<unknown>;
  restoreLearner(
    actor: PortalActorContext,
    householdKey: string,
    learnerKey: string,
    payload: z.infer<typeof updateLearnerPayloadSchema>,
  ): Promise<unknown>;
  studentAccessOperation(
    actor: PortalActorContext,
    householdKey: string,
    learnerKey: string,
    operationType: StudentAccessOperationType,
    payload: z.infer<typeof studentAccessOperationPayloadSchema>,
  ): Promise<unknown>;
  protectedClassLaunch(
    actor: PortalActorContext,
    householdKey: string,
    learnerKey: string,
    classKey: string,
  ): Promise<unknown>;
  protectedContentOpen(
    actor: PortalActorContext,
    householdKey: string,
    learnerKey: string,
    itemKey: string,
  ): Promise<unknown>;
  learnerMaterials(
    actor: PortalActorContext,
    householdKey: string,
    learnerKey: string,
  ): Promise<unknown>;
  helperQuery(
    actor: PortalActorContext,
    householdKey: string,
    payload: z.infer<typeof helperQueryPayloadSchema>,
  ): Promise<unknown>;
  supportPreview(
    actor: PortalActorContext,
    householdKey: string,
    payload: z.infer<typeof supportRequestPayloadSchema>,
  ): Promise<unknown>;
};

type StudentPortalService = {
  dashboard(actor: PortalActorContext): Promise<unknown>;
  protectedClassLaunch(
    actor: PortalActorContext,
    classKey: string,
    payload?: z.infer<typeof protectedLaunchPayloadSchema>,
  ): Promise<unknown>;
  protectedContentOpen(actor: PortalActorContext, itemKey: string): Promise<unknown>;
  helperQuery(
    actor: PortalActorContext,
    payload: z.infer<typeof helperQueryPayloadSchema>,
  ): Promise<unknown>;
  supportPreview(
    actor: PortalActorContext,
    payload: z.infer<typeof supportRequestPayloadSchema>,
  ): Promise<unknown>;
  submitQuestion(
    actor: PortalActorContext,
    payload: z.infer<typeof studentQuestionPayloadSchema>,
  ): Promise<unknown>;
  questions(actor: PortalActorContext): Promise<unknown>;
};

export type ParentPortalRouterDeps = {
  resolveActor: PortalActorResolver;
  verifyCsrf: PortalCsrfVerifier;
  service: ParentPortalService;
};

export type StudentPortalRouterDeps = {
  resolveActor: PortalActorResolver;
  verifyCsrf: PortalCsrfVerifier;
  service: StudentPortalService;
};

const portalRouteParamSchema = z.string().trim().min(3).max(180);
const studentAccessOperationSchema = studentAccessOperationTypeSchema;
const studentQuestionListSchema = z.array(studentQuestionSchema);
export function createParentPortalRouter(deps: ParentPortalRouterDeps) {
  const router = express.Router();
  router.use(noStore);

  router.get(
    '/dashboard',
    asyncRoute(async (req, res) => {
      const actor = await requireActor(req, res, deps.resolveActor);
      if (!actor) return;
      const householdKey = firstParentHousehold(actor);
      if (!householdKey) {
        sendError(
          res.status(403),
          'FORBIDDEN',
          'This portal action requires a parent household.',
          req.traceId,
        );
        return;
      }
      sendData(res, parentPortalDashboardSchema, await deps.service.dashboard(actor, householdKey));
    }),
  );

  router.get(
    '/households/:householdKey/dashboard',
    asyncRoute(async (req, res) => {
      const actor = await requireActor(req, res, deps.resolveActor);
      if (!actor) return;
      const householdKey = parseParam(req.params.householdKey);
      sendData(res, parentPortalDashboardSchema, await deps.service.dashboard(actor, householdKey));
    }),
  );

  router.post(
    '/households/:householdKey/learners',
    asyncRoute(async (req, res) => {
      const actor = await requireWriteActor(req, res, deps);
      if (!actor) return;
      const householdKey = parseParam(req.params.householdKey);
      const payload = createLearnerPayloadSchema.parse(req.body);
      sendData(
        res.status(201),
        learnerProfileSchema,
        await deps.service.createLearner(actor, householdKey, payload),
      );
    }),
  );

  router.patch(
    '/households/:householdKey/learners/:learnerKey',
    asyncRoute(async (req, res) => {
      const actor = await requireWriteActor(req, res, deps);
      if (!actor) return;
      const householdKey = parseParam(req.params.householdKey);
      const learnerKey = parseParam(req.params.learnerKey);
      const payload = updateLearnerPayloadSchema.parse(req.body);
      sendData(
        res,
        learnerProfileSchema,
        await deps.service.updateLearner(actor, householdKey, learnerKey, payload),
      );
    }),
  );

  router.post(
    '/households/:householdKey/learners/:learnerKey/archive',
    asyncRoute(async (req, res) => {
      const actor = await requireWriteActor(req, res, deps);
      if (!actor) return;
      const householdKey = parseParam(req.params.householdKey);
      const learnerKey = parseParam(req.params.learnerKey);
      const payload = updateLearnerPayloadSchema.parse(req.body);
      sendData(
        res,
        learnerProfileSchema,
        await deps.service.archiveLearner(actor, householdKey, learnerKey, payload),
      );
    }),
  );

  router.post(
    '/households/:householdKey/learners/:learnerKey/restore',
    asyncRoute(async (req, res) => {
      const actor = await requireWriteActor(req, res, deps);
      if (!actor) return;
      const householdKey = parseParam(req.params.householdKey);
      const learnerKey = parseParam(req.params.learnerKey);
      const payload = updateLearnerPayloadSchema.parse(req.body);
      sendData(
        res,
        learnerProfileSchema,
        await deps.service.restoreLearner(actor, householdKey, learnerKey, payload),
      );
    }),
  );

  router.post(
    '/households/:householdKey/learners/:learnerKey/student-access/:operation',
    asyncRoute(async (req, res) => {
      const actor = await requireWriteActor(req, res, deps);
      if (!actor) return;
      const householdKey = parseParam(req.params.householdKey);
      const learnerKey = parseParam(req.params.learnerKey);
      const operation = studentAccessOperationSchema.parse(req.params.operation);
      const payload = studentAccessOperationPayloadSchema.parse(req.body);
      sendData(
        res,
        studentAccessStateSchema,
        await deps.service.studentAccessOperation(
          actor,
          householdKey,
          learnerKey,
          operation,
          payload,
        ),
      );
    }),
  );

  router.post(
    '/households/:householdKey/learners/:learnerKey/classes/:classKey/launch',
    asyncRoute(async (req, res) => {
      const actor = await requireWriteActor(req, res, deps);
      if (!actor) return;
      const householdKey = parseParam(req.params.householdKey);
      const learnerKey = parseParam(req.params.learnerKey);
      const classKey = parseParam(req.params.classKey);
      sendData(
        res,
        protectedActionDescriptorSchema,
        await deps.service.protectedClassLaunch(actor, householdKey, learnerKey, classKey),
      );
    }),
  );

  router.get(
    '/households/:householdKey/learners/:learnerKey/content/:itemKey/open',
    asyncRoute(async (req, res) => {
      const actor = await requireActor(req, res, deps.resolveActor);
      if (!actor) return;
      const householdKey = parseParam(req.params.householdKey);
      const learnerKey = parseParam(req.params.learnerKey);
      const itemKey = parseParam(req.params.itemKey);
      sendData(
        res,
        protectedActionDescriptorSchema,
        await deps.service.protectedContentOpen(actor, householdKey, learnerKey, itemKey),
      );
    }),
  );

  router.get(
    '/households/:householdKey/learners/:learnerKey/materials',
    asyncRoute(async (req, res) => {
      const actor = await requireActor(req, res, deps.resolveActor);
      if (!actor) return;
      const householdKey = parseParam(req.params.householdKey);
      const learnerKey = parseParam(req.params.learnerKey);
      sendData(
        res,
        parentLearnerMaterialsSchema,
        await deps.service.learnerMaterials(actor, householdKey, learnerKey),
      );
    }),
  );

  router.post(
    '/households/:householdKey/helper/query',
    asyncRoute(async (req, res) => {
      const actor = await requireWriteActor(req, res, deps);
      if (!actor) return;
      const householdKey = parseParam(req.params.householdKey);
      const payload = helperQueryPayloadSchema.parse(req.body);
      sendData(
        res,
        helperAnswerSchema,
        await deps.service.helperQuery(actor, householdKey, payload),
      );
    }),
  );

  router.post(
    '/households/:householdKey/support/preview',
    asyncRoute(async (req, res) => {
      const actor = await requireWriteActor(req, res, deps);
      if (!actor) return;
      const householdKey = parseParam(req.params.householdKey);
      const payload = supportRequestPayloadSchema.parse(req.body);
      sendData(
        res,
        supportPreviewSchema,
        await deps.service.supportPreview(actor, householdKey, payload),
      );
    }),
  );

  router.use(errorHandler);
  return router;
}

export function createStudentPortalRouter(deps: StudentPortalRouterDeps) {
  const router = express.Router();
  router.use(noStore);

  router.get(
    '/dashboard',
    asyncRoute(async (req, res) => {
      const actor = await requireActor(req, res, deps.resolveActor);
      if (!actor) return;
      sendData(res, studentPortalDashboardSchema, await deps.service.dashboard(actor));
    }),
  );

  router.post(
    '/classes/:classKey/launch',
    asyncRoute(async (req, res) => {
      const actor = await requireWriteActor(req, res, deps);
      if (!actor) return;
      const classKey = parseParam(req.params.classKey);
      const payload = protectedLaunchPayloadSchema.parse(req.body ?? {});
      sendData(
        res,
        protectedActionDescriptorSchema,
        await deps.service.protectedClassLaunch(actor, classKey, payload),
      );
    }),
  );

  router.get(
    '/content/:itemKey/open',
    asyncRoute(async (req, res) => {
      const actor = await requireActor(req, res, deps.resolveActor);
      if (!actor) return;
      const itemKey = parseParam(req.params.itemKey);
      sendData(
        res,
        protectedActionDescriptorSchema,
        await deps.service.protectedContentOpen(actor, itemKey),
      );
    }),
  );

  router.get(
    '/questions',
    asyncRoute(async (req, res) => {
      const actor = await requireActor(req, res, deps.resolveActor);
      if (!actor) return;
      sendData(res, studentQuestionListSchema, await deps.service.questions(actor));
    }),
  );

  router.post(
    '/questions',
    asyncRoute(async (req, res) => {
      const actor = await requireWriteActor(req, res, deps);
      if (!actor) return;
      const payload = studentQuestionPayloadSchema.parse(req.body);
      sendData(
        res.status(201),
        studentQuestionSchema,
        await deps.service.submitQuestion(actor, payload),
      );
    }),
  );

  router.post(
    '/helper/query',
    asyncRoute(async (req, res) => {
      const actor = await requireWriteActor(req, res, deps);
      if (!actor) return;
      const payload = helperQueryPayloadSchema.parse(req.body);
      sendData(res, helperAnswerSchema, await deps.service.helperQuery(actor, payload));
    }),
  );

  router.post(
    '/support/preview',
    asyncRoute(async (req, res) => {
      const actor = await requireWriteActor(req, res, deps);
      if (!actor) return;
      const payload = supportRequestPayloadSchema.parse(req.body);
      sendData(res, supportPreviewSchema, await deps.service.supportPreview(actor, payload));
    }),
  );

  router.use(errorHandler);
  return router;
}

function noStore(_req: Request, res: Response, next: express.NextFunction) {
  res.setHeader('Cache-Control', 'no-store');
  next();
}

function asyncRoute(
  handler: (req: PortalRequest, res: Response, next: express.NextFunction) => Promise<void>,
) {
  return (req: PortalRequest, res: Response, next: express.NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

async function requireActor(req: PortalRequest, res: Response, resolveActor: PortalActorResolver) {
  const actor = await resolveActor(req);
  if (!actor) {
    sendError(res.status(401), 'UNAUTHENTICATED', 'Please log in again.', req.traceId);
    return null;
  }
  return actor;
}

async function requireWriteActor(
  req: PortalRequest,
  res: Response,
  deps: { resolveActor: PortalActorResolver; verifyCsrf: PortalCsrfVerifier },
) {
  const actor = await requireActor(req, res, deps.resolveActor);
  if (!actor) return null;
  const csrfAccepted = await deps.verifyCsrf(req, actor);
  if (!csrfAccepted) {
    sendError(res.status(403), 'CSRF_REQUIRED', 'Refresh the portal and try again.', req.traceId);
    return null;
  }
  return actor;
}

function parseParam(value: string | string[] | undefined) {
  return portalRouteParamSchema.parse(Array.isArray(value) ? undefined : value);
}

function firstParentHousehold(actor: PortalActorContext) {
  if (actor.actor_role !== 'parent') return null;
  return (
    actor.authorized_households.find((subject) => subject.authority !== 'support_only')
      ?.household_key ?? null
  );
}

function sendData<T extends z.ZodTypeAny>(res: Response, schema: T, data: unknown) {
  res.json({ success: true, data: schema.parse(data) });
}

function errorHandler(
  error: unknown,
  req: PortalRequest,
  res: Response,
  _next: express.NextFunction,
) {
  if (res.headersSent) return;
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Please check the portal request.',
      request_id: req.traceId,
      field_errors: fieldErrors(error),
    });
    return;
  }
  if (error instanceof PortalServiceError) {
    sendError(res.status(statusForError(error.code)), error.code, error.message, req.traceId);
    return;
  }
  sendError(
    res.status(500),
    'SERVER_ERROR',
    'The portal request could not be completed.',
    req.traceId,
  );
}

function sendError(res: Response, code: PortalErrorCode, message: string, requestId?: string) {
  res.json({
    success: false,
    code,
    message,
    ...(requestId ? { request_id: requestId } : {}),
  });
}

function statusForError(code: PortalErrorCode) {
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

function fieldErrors(error: ZodError) {
  const output: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !output[key]) {
      output[key] = issue.message;
    }
  }
  return output;
}
