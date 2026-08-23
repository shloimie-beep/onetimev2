import path from 'node:path';
import type express from 'express';
import type { Request, Response } from 'express';
import type { AppConfig } from '../../../../../packages/config/src/index.ts';
import type { DbPool } from '../../../../../packages/db/src/index.ts';
import {
  CommunicationsAuthorizationError,
  CommunicationsNotFoundError,
  CommunicationsValidationError,
  buildCommunicationsListResponse,
  canReadAccountEmailHistory,
  canReadCommunications,
  type CommunicationsReadRepository,
  type CommunicationsMode,
  type CommunicationsQuery,
  type ReadOnlySessionScope,
} from '../../../../../packages/domain/src/communications/service.ts';
import { CommunicationsCursorError } from '../../../../../packages/domain/src/communications/cursor.ts';
import {
  publicError,
  withTiming,
  type RequestWithTrace,
} from '../../../../../packages/observability/src/index.ts';
import { PostgresCommunicationsReadRepository } from './repository.ts';
import { createWorkflowReadbackReader, type WorkflowReadbackReader } from './workflow-readback.ts';

export interface ReadOnlySessionScopePort {
  resolve(req: Request): Promise<ReadOnlySessionScopeResolution>;
}

export type ReadOnlySessionScopeResolution =
  { status: 'resolved'; session: ReadOnlySessionScope } | { status: 'missing' | 'unavailable' };

export type RegisterCommunicationsRoutesDeps = {
  app: express.Express;
  config: AppConfig;
  pool: DbPool;
  sessionPort: ReadOnlySessionScopePort;
  cursorSecret: string;
  distDir?: string | undefined;
  repository?: CommunicationsReadRepository | undefined;
  workflowReadbackReader?: WorkflowReadbackReader | undefined;
};

export function registerCommunicationsRoutes({
  app,
  config,
  pool,
  sessionPort,
  cursorSecret,
  distDir = path.resolve(process.cwd(), 'dist/apps/web/public'),
  repository = new PostgresCommunicationsReadRepository(pool),
  workflowReadbackReader = createWorkflowReadbackReader(),
}: RegisterCommunicationsRoutesDeps) {
  app.get('/app/communications', async (req, res) => {
    setProtectedNoStore(res);
    const resolution = await sessionPort.resolve(req);
    if (resolution.status === 'unavailable') {
      res.status(503).type('html').send('Communications access is temporarily unavailable.');
      return;
    }
    if (resolution.status !== 'resolved') {
      res.redirect(302, `/login?return_to=${encodeURIComponent('/app/communications')}`);
      return;
    }
    const { session } = resolution;
    if (!canReadAccountEmailHistory(session.role)) {
      res.status(403).type('html').send('Forbidden');
      return;
    }
    res.sendFile(path.join(distDir, 'app', 'crm.html'));
  });

  app.get('/api/v1/communications', async (req: RequestWithTrace, res) => {
    await handleList({
      req,
      res,
      mode: { kind: 'global' },
      sessionPort,
      repository,
      cursorSecret,
    });
  });

  app.get('/app/communications/:workflowId', async (req, res) => {
    setProtectedNoStore(res);
    const workflowId = encodeURIComponent(String(req.params.workflowId));
    res.redirect(302, `/app/operations/workflow-readback/${workflowId}`);
  });

  app.get(
    '/api/v1/operations/workflow-readback/:workflowId',
    async (req: RequestWithTrace, res) => {
      setProtectedNoStore(res);
      try {
        const session = await resolvedSession(sessionPort, req);
        if (!session) throw new CommunicationsAuthorizationError(401);
        if (!canReadCommunications(session.role)) throw new CommunicationsAuthorizationError(403);
        const workflow = workflowReadbackReader.find(String(req.params.workflowId));
        if (!workflow) throw new CommunicationsNotFoundError('Workflow was not found.');
        res.status(200).json(workflow);
      } catch (error) {
        handleCommunicationsError(error, req, res);
      }
    },
  );

  app.get('/api/v1/operations/workflow-readback', async (req: RequestWithTrace, res) => {
    setProtectedNoStore(res);
    try {
      const session = await resolvedSession(sessionPort, req);
      if (!session) throw new CommunicationsAuthorizationError(401);
      if (!canReadCommunications(session.role)) throw new CommunicationsAuthorizationError(403);
      res.status(200).json(workflowReadbackReader.list());
    } catch (error) {
      handleCommunicationsError(error, req, res);
    }
  });

  void config;
}

async function handleList(input: {
  req: RequestWithTrace;
  res: Response;
  mode: CommunicationsMode;
  sessionPort: ReadOnlySessionScopePort;
  repository: CommunicationsReadRepository;
  cursorSecret: string;
}) {
  const { req, res } = input;
  setProtectedNoStore(res);
  try {
    const session = await resolvedSession(input.sessionPort, req);
    const query: CommunicationsQuery = {
      from: stringQuery(req.query.from),
      to: stringQuery(req.query.to),
      channel: stringQuery(req.query.channel),
      direction: stringQuery(req.query.direction),
      intent_type: stringQuery(req.query.intent_type),
      status: stringQuery(req.query.status),
      source: stringQuery(req.query.source),
      limit: stringQuery(req.query.limit),
      cursor: req.header('x-ot-communications-cursor') ?? undefined,
    };
    const response = await withTiming(req, 'communications', () =>
      buildCommunicationsListResponse({
        session,
        repository: input.repository,
        mode: input.mode,
        query,
        cursorSecret: input.cursorSecret,
      }),
    );
    res.status(200).json(response);
  } catch (error) {
    handleCommunicationsError(error, req, res);
  }
}

function handleCommunicationsError(error: unknown, req: RequestWithTrace, res: Response) {
  if (error instanceof CommunicationsSessionUnavailableError) {
    res
      .status(503)
      .json(
        publicError(
          'SESSION_UNAVAILABLE',
          'Communications access is temporarily unavailable.',
          req.traceId,
        ),
      );
    return;
  }
  if (error instanceof CommunicationsAuthorizationError) {
    const code = error.status === 401 ? 'UNAUTHENTICATED' : 'FORBIDDEN';
    const message =
      error.status === 401 ? 'Please log in again.' : 'Your role cannot read Communications.';
    res.status(error.status).json(publicError(code, message, req.traceId));
    return;
  }
  if (error instanceof CommunicationsValidationError) {
    res.status(400).json(publicError(error.code, error.message, req.traceId));
    return;
  }
  if (error instanceof CommunicationsCursorError) {
    const status = error.code.includes('SCOPE') || error.code.includes('CONTACT') ? 404 : 400;
    res
      .status(status)
      .json(publicError(error.code, 'The Communications cursor is no longer valid.', req.traceId));
    return;
  }
  if (error instanceof CommunicationsNotFoundError) {
    res.status(404).json(publicError('NOT_FOUND', error.message, req.traceId));
    return;
  }
  res
    .status(500)
    .json(publicError('SERVER_ERROR', 'Communications could not be loaded.', req.traceId));
}

class CommunicationsSessionUnavailableError extends Error {}

async function resolvedSession(
  sessionPort: ReadOnlySessionScopePort,
  req: Request,
): Promise<ReadOnlySessionScope | null> {
  const resolution = await sessionPort.resolve(req);
  if (resolution.status === 'unavailable') throw new CommunicationsSessionUnavailableError();
  return resolution.status === 'resolved' ? resolution.session : null;
}

function setProtectedNoStore(res: Response) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Cookie');
}

function stringQuery(value: unknown) {
  if (Array.isArray(value)) return value[0] === undefined ? undefined : String(value[0]);
  return value === undefined ? undefined : String(value);
}
