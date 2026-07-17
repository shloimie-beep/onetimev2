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

export interface ReadOnlySessionScopePort {
  resolve(req: Request): Promise<ReadOnlySessionScope | null>;
}

export type RegisterCommunicationsRoutesDeps = {
  app: express.Express;
  config: AppConfig;
  pool: DbPool;
  sessionPort: ReadOnlySessionScopePort;
  cursorSecret: string;
  distDir?: string | undefined;
  repository?: CommunicationsReadRepository | undefined;
};

export function registerCommunicationsRoutes({
  app,
  config,
  pool,
  sessionPort,
  cursorSecret,
  distDir = path.resolve(process.cwd(), 'dist/apps/web/public'),
  repository = new PostgresCommunicationsReadRepository(pool),
}: RegisterCommunicationsRoutesDeps) {
  app.get('/app/communications', async (req, res) => {
    setProtectedNoStore(res);
    const session = await sessionPort.resolve(req);
    if (!session) {
      res.redirect(302, `/login?return_to=${encodeURIComponent('/app/communications')}`);
      return;
    }
    if (session.role !== 'owner' && session.role !== 'admin') {
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

  app.get('/api/v1/crm/contacts/:contactId/communications', async (req: RequestWithTrace, res) => {
    await handleList({
      req,
      res,
      mode: { kind: 'contact', contactId: String(req.params.contactId) },
      sessionPort,
      repository,
      cursorSecret,
    });
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
    const session = await input.sessionPort.resolve(req);
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

function setProtectedNoStore(res: Response) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Cookie');
}

function stringQuery(value: unknown) {
  if (Array.isArray(value)) return value[0] === undefined ? undefined : String(value[0]);
  return value === undefined ? undefined : String(value);
}
