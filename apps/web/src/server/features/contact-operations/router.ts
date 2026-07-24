import express, { type Request, type Response } from 'express';
import { ZodError, z } from 'zod';
import type { AppConfig } from '../../../../../../packages/config/src/index.ts';
import {
  adultContactLinkSchema,
  contactOperationsAccessCommandSchema,
  contactOperationsEnrollmentResultSchema,
  contactOperationsEnrollmentSchema,
  contactOperationsResetCommandSchema,
  parentAccessShellSchema,
} from '../../../../../../packages/contracts/src/index.ts';
import type { DbPool } from '../../../../../../packages/db/src/index.ts';
import {
  ContactOperationsError,
  enrollParentHousehold,
  parentAccessShell,
  readAdultContactLink,
  reconcileAdultContactLink,
  requestParentResetForHousehold,
  requestStudentResetForHousehold,
  setContactOperationsAccess,
  type AuthenticatedSession,
  type ContactOperationsActor,
} from '../../../../../../packages/domain/src/index.ts';

type ContactOperationsRequest = Request & { traceId?: string };

const routeKeySchema = z.string().trim().min(3).max(180);
const accessOperationSchema = z.enum([
  'grant_complimentary',
  'revoke_complimentary',
  'suspend',
  'release',
]);

export function createContactOperationsRouter(input: {
  pool: DbPool;
  config: AppConfig;
  resolveSession(req: Request): Promise<AuthenticatedSession | null>;
  verifyCsrf(req: Request, session: AuthenticatedSession): Promise<boolean>;
  verifyRecentAssurance(session: AuthenticatedSession): Promise<boolean>;
  now?: () => Date;
}) {
  const router = express.Router();
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.get(
    '/parent-shell',
    asyncRoute(async (req, res) => {
      const context = await requireContext(req, res, input);
      if (!context) return;
      const shell = await parentAccessShell({
        pool: input.pool,
        config: input.config,
        actor: context.actor,
        displayName: context.session.user.display_name,
      });
      res.json({ success: true, data: parentAccessShellSchema.parse(shell) });
    }),
  );

  router.post(
    '/enrollments',
    asyncRoute(async (req, res) => {
      const context = await requireProtectedContext(req, res, input, true);
      if (!context) return;
      const result = await enrollParentHousehold({
        pool: input.pool,
        config: input.config,
        actor: context.actor,
        payload: contactOperationsEnrollmentSchema.parse(req.body),
        ...(input.now ? { now: input.now() } : {}),
      });
      res.status(201).json({
        success: true,
        data: contactOperationsEnrollmentResultSchema.parse(result),
      });
    }),
  );

  router.post(
    '/households/:householdKey/access/:operation',
    asyncRoute(async (req, res) => {
      const context = await requireProtectedContext(req, res, input, true);
      if (!context) return;
      const householdKey = routeKeySchema.parse(req.params.householdKey);
      const operation = accessOperationSchema.parse(req.params.operation);
      const payload = contactOperationsAccessCommandSchema.parse(req.body);
      const result = await setContactOperationsAccess({
        pool: input.pool,
        config: input.config,
        actor: context.actor,
        householdKey,
        operation,
        idempotencyKey: payload.idempotency_key,
        policyVersion: payload.policy_version,
        ...(payload.expires_at !== undefined ? { expiresAt: payload.expires_at } : {}),
        ...(payload.reason !== undefined ? { reason: payload.reason } : {}),
        ...(input.now ? { now: input.now() } : {}),
      });
      res.json({ success: true, data: result });
    }),
  );

  router.get(
    '/households/:householdKey/adult-link',
    asyncRoute(async (req, res) => {
      const context = await requireContext(req, res, input);
      if (!context) return;
      const result = await readAdultContactLink({
        pool: input.pool,
        config: input.config,
        actor: context.actor,
        householdKey: routeKeySchema.parse(req.params.householdKey),
      });
      res.json({ success: true, data: adultContactLinkSchema.parse(result) });
    }),
  );

  router.post(
    '/households/:householdKey/reconcile',
    asyncRoute(async (req, res) => {
      const context = await requireProtectedContext(req, res, input, true);
      if (!context) return;
      const payload = contactOperationsResetCommandSchema.parse(req.body);
      const result = await reconcileAdultContactLink({
        pool: input.pool,
        config: input.config,
        actor: context.actor,
        householdKey: routeKeySchema.parse(req.params.householdKey),
        idempotencyKey: payload.idempotency_key,
        ...(input.now ? { now: input.now() } : {}),
      });
      res.json({ success: true, data: result });
    }),
  );

  router.post(
    '/households/:householdKey/parent-reset',
    asyncRoute(async (req, res) => {
      const context = await requireProtectedContext(req, res, input, true);
      if (!context) return;
      const payload = contactOperationsResetCommandSchema.parse(req.body);
      const result = await requestParentResetForHousehold({
        pool: input.pool,
        config: input.config,
        actor: context.actor,
        householdKey: routeKeySchema.parse(req.params.householdKey),
        idempotencyKey: payload.idempotency_key,
        ...(input.now ? { now: input.now() } : {}),
      });
      res.json({ success: true, data: result });
    }),
  );

  router.post(
    '/households/:householdKey/students/:learnerKey/reset',
    asyncRoute(async (req, res) => {
      const context = await requireProtectedContext(req, res, input, true);
      if (!context) return;
      const payload = contactOperationsResetCommandSchema.parse(req.body);
      const result = await requestStudentResetForHousehold({
        pool: input.pool,
        config: input.config,
        actor: context.actor,
        householdKey: routeKeySchema.parse(req.params.householdKey),
        learnerKey: routeKeySchema.parse(req.params.learnerKey),
        idempotencyKey: payload.idempotency_key,
        ...(input.now ? { now: input.now() } : {}),
      });
      res.json({ success: true, data: result });
    }),
  );

  router.use(
    (error: unknown, req: ContactOperationsRequest, res: Response, _next: express.NextFunction) => {
      if (res.headersSent) return;
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Please check the contact operation.',
          request_id: req.traceId,
        });
        return;
      }
      if (error instanceof ContactOperationsError) {
        res.status(statusForError(error.code)).json({
          success: false,
          code: error.code,
          message: error.message,
          request_id: req.traceId,
        });
        return;
      }
      res.status(500).json({
        success: false,
        code: 'SERVER_ERROR',
        message: 'The contact operation could not be completed.',
        request_id: req.traceId,
      });
    },
  );
  return router;
}

async function requireContext(
  req: ContactOperationsRequest,
  res: Response,
  input: {
    pool: DbPool;
    config: AppConfig;
    resolveSession(req: Request): Promise<AuthenticatedSession | null>;
  },
) {
  const session = await input.resolveSession(req);
  if (!session) {
    res.status(401).json({
      success: false,
      code: 'UNAUTHENTICATED',
      message: 'Please log in again.',
      request_id: req.traceId,
    });
    return null;
  }
  const authorizedHouseholds =
    session.user.role === 'parent'
      ? await parentHouseholdKeys(input.pool, input.config, session.user.user_key)
      : [];
  return {
    session,
    actor: {
      userKey: session.user.user_key,
      role: session.user.role,
      authorizedHouseholds,
    } satisfies ContactOperationsActor,
  };
}

async function requireProtectedContext(
  req: ContactOperationsRequest,
  res: Response,
  input: {
    pool: DbPool;
    config: AppConfig;
    resolveSession(req: Request): Promise<AuthenticatedSession | null>;
    verifyCsrf(req: Request, session: AuthenticatedSession): Promise<boolean>;
    verifyRecentAssurance(session: AuthenticatedSession): Promise<boolean>;
  },
  requireRecent: boolean,
) {
  const context = await requireContext(req, res, input);
  if (!context) return null;
  if (!(await input.verifyCsrf(req, context.session))) {
    res.status(403).json({
      success: false,
      code: 'CSRF_REQUIRED',
      message: 'Refresh the page and try again.',
      request_id: req.traceId,
    });
    return null;
  }
  if (requireRecent && !(await input.verifyRecentAssurance(context.session))) {
    res.status(428).json({
      success: false,
      code: 'RECENT_ASSURANCE_REQUIRED',
      message: 'Please sign in again before this protected operation.',
      request_id: req.traceId,
    });
    return null;
  }
  return context;
}

async function parentHouseholdKeys(
  pool: DbPool,
  config: AppConfig,
  userKey: string,
): Promise<string[]> {
  const result = await pool.query(
    `SELECT household_key
       FROM onetime.portal_guardian_relationships
      WHERE account_key = $1
        AND product_key = $2
        AND guardian_user_ref = $3
        AND status = 'active'
        AND authority <> 'support_only'
      ORDER BY household_key`,
    [config.accountKey, config.productKey, userKey],
  );
  return result.rows.map((row) => String(row.household_key));
}

function asyncRoute(handler: (req: ContactOperationsRequest, res: Response) => Promise<void>) {
  return (req: ContactOperationsRequest, res: Response, next: express.NextFunction) => {
    handler(req, res).catch(next);
  };
}

function statusForError(code: ContactOperationsError['code']) {
  if (code === 'NOT_FOUND') return 404;
  if (code === 'AMBIGUOUS_IDENTITY' || code === 'IDENTITY_CONFLICT') return 409;
  if (code === 'IDEMPOTENCY_CONFLICT') return 409;
  return 403;
}
