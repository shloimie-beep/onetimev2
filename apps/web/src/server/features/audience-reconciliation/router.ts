import express, { type Request, type Response } from 'express';
import { ZodError } from 'zod';
import {
  legacyAudienceDryRunRequestSchema,
  legacyAudienceRollbackRequestSchema,
  type LegacyAudienceDryRunReport,
} from '../../../../../../packages/contracts/src/audience-reconciliation/index.ts';
import {
  createLegacyAudienceDryRun,
  legacyAudienceSegmentContracts,
} from '../../../../../../packages/domain/src/audience-reconciliation/service.ts';
import {
  collectIdentityFilters,
  LegacyAudienceBatchNotFoundError,
  LegacyAudienceIdempotencyConflictError,
  type LegacyAudienceRepositoryActor,
  type createPostgresLegacyAudienceRepository,
} from '../../../../../../packages/db/src/audience-reconciliation/repository.ts';

export type Ot74AudienceSession = {
  sessionKey: string;
  actor: LegacyAudienceRepositoryActor & {
    role: string;
  };
};

export type Ot74AudienceGuards = {
  loadSession: (req: Request) => Promise<Ot74AudienceSession | null>;
  verifyCsrf: (req: Request, session: Ot74AudienceSession) => Promise<boolean>;
};

export type Ot74AudienceRepository = ReturnType<typeof createPostgresLegacyAudienceRepository>;

export type Ot74AudienceRouterDeps = {
  guards: Ot74AudienceGuards;
  repository: Ot74AudienceRepository;
};

export function createOt74AudienceReconciliationRouter(deps: Ot74AudienceRouterDeps) {
  const router = express.Router();

  router.use((_req, res, next) => {
    setPrivateNoStore(res);
    next();
  });

  router.get(
    '/contracts',
    asyncHandler(async (req, res) => {
      const session = await requireSession(req, res, deps.guards);
      if (!session) return;
      if (!canRead(session.actor.role)) return forbidden(res);
      res.json({ success: true, segments: legacyAudienceSegmentContracts });
    }),
  );

  router.post(
    '/dry-runs',
    express.json({ limit: '4mb' }),
    asyncHandler(async (req, res) => {
      const session = await requireSession(req, res, deps.guards);
      if (!session) return;
      if (!canManage(session.actor.role)) return forbidden(res);
      if (!(await deps.guards.verifyCsrf(req, session))) {
        res.status(403).json(errorBody('CSRF_REQUIRED', 'Refresh the page and try again.'));
        return;
      }
      const request = legacyAudienceDryRunRequestSchema.parse(req.body);
      const identities = collectIdentityFilters(request.rows);
      const existingContacts = await deps.repository.findContactsByIdentities(
        session.actor,
        identities,
      );
      const report = createLegacyAudienceDryRun({
        scope: session.actor,
        request,
        existingContacts,
      });
      const recorded = await deps.repository.recordDryRun({
        actor: session.actor,
        idempotencyKey: request.idempotency_key,
        report,
      });
      res.json({ success: true, replayed: recorded.replayed, report: safeReport(recorded.report) });
    }),
  );

  router.get(
    '/batches/:batchKey',
    asyncHandler(async (req, res) => {
      const session = await requireSession(req, res, deps.guards);
      if (!session) return;
      if (!canRead(session.actor.role)) return forbidden(res);
      const report = await deps.repository.getBatchReport(
        session.actor,
        String(req.params.batchKey),
      );
      if (!report) {
        res.status(404).json(errorBody('NOT_FOUND', 'Legacy audience batch was not found.'));
        return;
      }
      res.json({ success: true, report: safeReport(report) });
    }),
  );

  router.post(
    '/batches/:batchKey/rollback-requests',
    express.json({ limit: '16kb' }),
    asyncHandler(async (req, res) => {
      const session = await requireSession(req, res, deps.guards);
      if (!session) return;
      if (!canRollback(session.actor.role)) return forbidden(res);
      if (!(await deps.guards.verifyCsrf(req, session))) {
        res.status(403).json(errorBody('CSRF_REQUIRED', 'Refresh the page and try again.'));
        return;
      }
      const request = legacyAudienceRollbackRequestSchema.parse({
        ...req.body,
        batch_key: String(req.params.batchKey),
      });
      const rollback = await deps.repository.recordRollbackRequest(session.actor, request);
      res.json({ success: true, rollback });
    }),
  );

  router.use((error: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
    setPrivateNoStore(res);
    if (error instanceof ZodError) {
      res.status(400).json(errorBody('VALIDATION_ERROR', 'Please check the submitted fields.'));
      return;
    }
    if (error instanceof LegacyAudienceIdempotencyConflictError) {
      res.status(409).json(errorBody('IDEMPOTENCY_CONFLICT', error.message));
      return;
    }
    if (error instanceof LegacyAudienceBatchNotFoundError) {
      res.status(404).json(errorBody('NOT_FOUND', error.message));
      return;
    }
    res
      .status(500)
      .json(errorBody('SERVER_ERROR', 'Legacy audience reconciliation could not be completed.'));
  });

  return router;
}

function safeReport(report: LegacyAudienceDryRunReport) {
  return {
    batch_key: report.batch_key,
    source: report.source,
    source_digest: report.source_digest,
    request_hash: report.request_hash,
    generated_at: report.generated_at,
    summary: report.summary,
    raw_row_contents_included: false,
    production_side_effects: false,
  };
}

async function requireSession(
  req: Request,
  res: Response,
  guards: Ot74AudienceGuards,
): Promise<Ot74AudienceSession | null> {
  const session = await guards.loadSession(req);
  if (!session) {
    res.status(401).json(errorBody('UNAUTHENTICATED', 'Please log in again.'));
    return null;
  }
  return session;
}

function canRead(role: string) {
  return ['owner', 'admin', 'crm_agent', 'viewer'].includes(role);
}

function canManage(role: string) {
  return ['owner', 'admin', 'crm_agent'].includes(role);
}

function canRollback(role: string) {
  return ['owner', 'admin'].includes(role);
}

function forbidden(res: Response) {
  res.status(403).json(errorBody('FORBIDDEN', 'You do not have permission for this action.'));
}

function setPrivateNoStore(res: Response) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Vary', 'Cookie, Authorization');
}

function errorBody(code: string, message: string) {
  return { success: false, code, message };
}

function asyncHandler(
  handler: (req: Request, res: Response, next: express.NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: express.NextFunction) => {
    handler(req, res, next).catch(next);
  };
}
