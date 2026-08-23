import express, { type Request, type Response } from 'express';
import { ZodError } from 'zod';
import type { AppConfig } from '../../../../../../packages/config/src/index.ts';
import type { DbPool } from '../../../../../../packages/db/src/index.ts';
import {
  AdminDirectoryError,
  attachAdminGuardian,
  createAdminHousehold,
  createAdminLearner,
  inviteAdminUser,
  listAdminAuditHistory,
  listAdminHouseholds,
  listAdminLearners,
  listAdminUsers,
  requestAdminUserPasswordReset,
  setAdminHouseholdStatus,
  setAdminLearnerStatus,
  setAdminUserStatus,
  updateAdminHousehold,
  updateAdminLearner,
  updateAdminUser,
  type AuthenticatedSession,
} from '../../../../../../packages/domain/src/index.ts';

type DirectoryRequest = Request & { traceId?: string };
type AdminDirectorySessionUnavailable = { unavailable: true };

export function createAdminDirectoryRouter(input: {
  pool: DbPool;
  config: AppConfig;
  resolveSession(
    req: Request,
  ): Promise<AuthenticatedSession | AdminDirectorySessionUnavailable | null>;
  verifyCsrf(req: Request, session: AuthenticatedSession): Promise<boolean>;
  verifyRecentAssurance(session: AuthenticatedSession): Promise<boolean>;
}) {
  const router = express.Router();
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    next();
  });

  router.get(
    '/audit',
    route(async (req, res) => {
      if (!(await requireAdmin(req, res, input))) return;
      res.json({
        success: true,
        events: await listAdminAuditHistory({
          pool: input.pool,
          config: input.config,
          query: req.query,
        }),
      });
    }),
  );

  router.get(
    '/households',
    route(async (req, res) => {
      if (!(await requireAdmin(req, res, input))) return;
      res.json({
        success: true,
        households: await listAdminHouseholds({
          pool: input.pool,
          config: input.config,
          query: req.query,
        }),
      });
    }),
  );

  router.post(
    '/households',
    route(async (req, res) => {
      const context = await requireMutation(req, res, input);
      if (!context) return;
      const household = await createAdminHousehold({
        pool: input.pool,
        config: input.config,
        actor: context.actor,
        payload: req.body,
      });
      res.status(201).json({ success: true, household });
    }),
  );

  router.patch(
    '/households/:householdKey',
    route(async (req, res) => {
      const context = await requireMutation(req, res, input);
      if (!context) return;
      res.json({
        success: true,
        household: await updateAdminHousehold({
          pool: input.pool,
          config: input.config,
          actor: context.actor,
          householdKey: String(req.params.householdKey),
          payload: req.body,
        }),
      });
    }),
  );

  router.post(
    '/households/:householdKey/archive',
    route(async (req, res) => {
      const context = await requireMutation(req, res, input, true);
      if (!context) return;
      res.json({
        success: true,
        household: await setAdminHouseholdStatus({
          pool: input.pool,
          config: input.config,
          actor: context.actor,
          householdKey: String(req.params.householdKey),
          status: 'archived',
          payload: req.body,
        }),
      });
    }),
  );

  router.post(
    '/households/:householdKey/restore',
    route(async (req, res) => {
      const context = await requireMutation(req, res, input);
      if (!context) return;
      res.json({
        success: true,
        household: await setAdminHouseholdStatus({
          pool: input.pool,
          config: input.config,
          actor: context.actor,
          householdKey: String(req.params.householdKey),
          status: 'active',
          payload: req.body,
        }),
      });
    }),
  );

  router.post(
    '/households/:householdKey/guardians',
    route(async (req, res) => {
      const context = await requireMutation(req, res, input);
      if (!context) return;
      res.status(201).json({
        success: true,
        relationship: await attachAdminGuardian({
          pool: input.pool,
          config: input.config,
          actor: context.actor,
          householdKey: String(req.params.householdKey),
          payload: req.body,
        }),
      });
    }),
  );

  router.get(
    '/users',
    route(async (req, res) => {
      if (!(await requireAdmin(req, res, input))) return;
      res.json({
        success: true,
        users: await listAdminUsers({
          pool: input.pool,
          config: input.config,
          query: req.query,
        }),
      });
    }),
  );

  router.post(
    '/users/invitations',
    route(async (req, res) => {
      const context = await requireMutation(req, res, input);
      if (!context) return;
      res.status(201).json({
        success: true,
        invitation: await inviteAdminUser({
          pool: input.pool,
          config: input.config,
          actor: context.actor,
          payload: req.body,
        }),
      });
    }),
  );

  router.patch(
    '/users/:userKey',
    route(async (req, res) => {
      const context = await requireMutation(req, res, input);
      if (!context) return;
      res.json({
        success: true,
        user: await updateAdminUser({
          pool: input.pool,
          config: input.config,
          actor: context.actor,
          userKey: String(req.params.userKey),
          payload: req.body,
        }),
      });
    }),
  );

  router.post(
    '/users/:userKey/disable',
    route(async (req, res) => {
      const context = await requireMutation(req, res, input, true);
      if (!context) return;
      res.json({
        success: true,
        user: await setAdminUserStatus({
          pool: input.pool,
          config: input.config,
          actor: context.actor,
          userKey: String(req.params.userKey),
          status: 'disabled',
          payload: req.body,
        }),
      });
    }),
  );

  router.post(
    '/users/:userKey/reactivate',
    route(async (req, res) => {
      const context = await requireMutation(req, res, input);
      if (!context) return;
      res.json({
        success: true,
        user: await setAdminUserStatus({
          pool: input.pool,
          config: input.config,
          actor: context.actor,
          userKey: String(req.params.userKey),
          status: 'active',
          payload: req.body,
        }),
      });
    }),
  );

  router.post(
    '/users/:userKey/password-reset',
    route(async (req, res) => {
      const context = await requireMutation(req, res, input);
      if (!context) return;
      res.json({
        success: true,
        reset: await requestAdminUserPasswordReset({
          pool: input.pool,
          config: input.config,
          actor: context.actor,
          userKey: String(req.params.userKey),
          payload: req.body,
        }),
      });
    }),
  );

  router.get(
    '/learners',
    route(async (req, res) => {
      if (!(await requireAdmin(req, res, input))) return;
      res.json({
        success: true,
        learners: await listAdminLearners({
          pool: input.pool,
          config: input.config,
          query: req.query,
        }),
      });
    }),
  );

  router.post(
    '/learners',
    route(async (req, res) => {
      const context = await requireMutation(req, res, input);
      if (!context) return;
      res.status(201).json({
        success: true,
        learner: await createAdminLearner({
          pool: input.pool,
          config: input.config,
          actor: context.actor,
          payload: req.body,
        }),
      });
    }),
  );

  router.patch(
    '/learners/:learnerKey',
    route(async (req, res) => {
      const context = await requireMutation(req, res, input);
      if (!context) return;
      res.json({
        success: true,
        learner: await updateAdminLearner({
          pool: input.pool,
          config: input.config,
          actor: context.actor,
          learnerKey: String(req.params.learnerKey),
          payload: req.body,
        }),
      });
    }),
  );

  router.post(
    '/learners/:learnerKey/archive',
    route(async (req, res) => {
      const context = await requireMutation(req, res, input, true);
      if (!context) return;
      res.json({
        success: true,
        learner: await setAdminLearnerStatus({
          pool: input.pool,
          config: input.config,
          actor: context.actor,
          learnerKey: String(req.params.learnerKey),
          status: 'archived',
          payload: req.body,
        }),
      });
    }),
  );

  router.post(
    '/learners/:learnerKey/restore',
    route(async (req, res) => {
      const context = await requireMutation(req, res, input);
      if (!context) return;
      res.json({
        success: true,
        learner: await setAdminLearnerStatus({
          pool: input.pool,
          config: input.config,
          actor: context.actor,
          learnerKey: String(req.params.learnerKey),
          status: 'active',
          payload: req.body,
        }),
      });
    }),
  );

  router.use(
    (error: unknown, req: DirectoryRequest, res: Response, _next: express.NextFunction) => {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Please check the highlighted fields.',
          field_errors: Object.fromEntries(
            error.issues
              .filter((issue) => typeof issue.path[0] === 'string')
              .map((issue) => [String(issue.path[0]), issue.message]),
          ),
          request_id: req.traceId,
        });
        return;
      }
      if (error instanceof AdminDirectoryError) {
        res.status(statusFor(error.code)).json({
          success: false,
          code: error.code,
          message: error.message,
          ...(error.currentVersion ? { current_version: error.currentVersion } : {}),
          request_id: req.traceId,
        });
        return;
      }
      res.status(500).json({
        success: false,
        code: 'SERVER_ERROR',
        message: 'The Admin directory request could not be completed.',
        request_id: req.traceId,
      });
    },
  );

  return router;
}

async function requireAdmin(
  req: DirectoryRequest,
  res: Response,
  input: {
    resolveSession(
      req: Request,
    ): Promise<AuthenticatedSession | AdminDirectorySessionUnavailable | null>;
  },
) {
  const session = await input.resolveSession(req);
  if (session && 'unavailable' in session) {
    res.status(503).json({
      success: false,
      code: 'ADMIN_DIRECTORY_UNAVAILABLE',
      message: 'Admin directory is temporarily unavailable.',
      request_id: req.traceId,
    });
    return null;
  }
  if (!session) {
    res.status(401).json({
      success: false,
      code: 'UNAUTHENTICATED',
      message: 'Please log in again.',
      request_id: req.traceId,
    });
    return null;
  }
  if (session.user.role !== 'owner' && session.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      code: 'FORBIDDEN',
      message: 'This workspace requires an Administrator.',
      request_id: req.traceId,
    });
    return null;
  }
  return {
    session,
    actor: { userKey: session.user.user_key, role: session.user.role },
  };
}

async function requireMutation(
  req: DirectoryRequest,
  res: Response,
  input: {
    resolveSession(
      req: Request,
    ): Promise<AuthenticatedSession | AdminDirectorySessionUnavailable | null>;
    verifyCsrf(req: Request, session: AuthenticatedSession): Promise<boolean>;
    verifyRecentAssurance(session: AuthenticatedSession): Promise<boolean>;
  },
  requireRecent = false,
) {
  const context = await requireAdmin(req, res, input);
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
      message: 'Sign in again before this protected action.',
      request_id: req.traceId,
    });
    return null;
  }
  return context;
}

function route(handler: (req: DirectoryRequest, res: Response) => Promise<void>) {
  return (req: DirectoryRequest, res: Response, next: express.NextFunction) => {
    handler(req, res).catch(next);
  };
}

function statusFor(code: AdminDirectoryError['code']) {
  if (code === 'NOT_FOUND') return 404;
  if (code === 'FORBIDDEN') return 403;
  return 409;
}
