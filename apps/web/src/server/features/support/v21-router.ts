import express, { type Response } from 'express';
import { z } from 'zod';
import type {
  SupportLifecycleState,
  SupportPrincipal,
} from '../../../../../../packages/contracts/src/support/v21.ts';
import type { DbPool } from '../../../../../../packages/db/src/index.ts';
import {
  createPostgresSupportNotificationIntentPort,
  createPostgresSupportRepository,
} from '../../../../../../packages/db/src/support/v21-index.ts';
import {
  createSupportLifecycleService,
  SupportV21Error,
} from '../../../../../../packages/domain/src/support/v21-index.ts';
import {
  publicError,
  type RequestWithTrace,
} from '../../../../../../packages/observability/src/index.ts';

export type SupportV21RouteContext = {
  principal: SupportPrincipal;
  csrfToken: string;
  sessionKind: 'legacy' | 'v21_adult';
};

type SupportSessionPorts = {
  resolve(req: RequestWithTrace, res: Response): Promise<SupportV21RouteContext | null>;
  requireCsrf(
    req: RequestWithTrace,
    res: Response,
    context: SupportV21RouteContext,
  ): Promise<boolean>;
  setPrivateNoStore(res: Response): void;
};

const createSchema = z
  .object({
    kind: z.enum(['technical_support', 'rabbi_question']),
    category: z.enum([
      'billing',
      'support',
      'access',
      'technical',
      'system',
      'class_question',
      'torah_question',
    ]),
    subject: z.string().trim().min(5).max(120),
    body: z.string().trim().min(20).max(6000),
    idempotency_key: z.string().trim().min(8).max(180),
  })
  .strict();

const versionSchema = z.number().int().positive();
const assignSchema = z
  .object({ assignee_admin_id: z.string().trim().min(1).max(180), expected_version: versionSchema })
  .strict();
const statusSchema = z
  .object({
    status: z.enum(['open', 'in_progress', 'waiting_on_requester', 'resolved', 'closed']),
    expected_version: versionSchema,
  })
  .strict();
const replySchema = z
  .object({
    body: z.string().trim().min(1).max(6000),
    expected_version: versionSchema,
    idempotency_key: z.string().trim().min(8).max(180),
  })
  .strict();

export function registerSupportV21Routes(input: {
  app: express.Express;
  pool: DbPool;
  session: SupportSessionPorts;
  now?: (() => Date) | undefined;
}) {
  const repository = createPostgresSupportRepository(input.pool);
  const service = createSupportLifecycleService({
    repository,
    notificationIntents: createPostgresSupportNotificationIntentPort(input.pool),
    ...(input.now ? { now: input.now } : {}),
  });

  input.app.get('/api/v1/support/v21/context', async (req: RequestWithTrace, res) => {
    const context = await supportContext(req, res, input.session);
    if (!context) return;
    if (context.principal.role === 'admin') {
      res.json({
        success: true,
        role: 'admin',
        csrf_token: context.csrfToken,
        can_create_ticket: false,
        categories: [],
      });
      return;
    }
    res.json({
      success: true,
      role: context.principal.role,
      csrf_token: context.csrfToken,
      can_create_ticket: true,
      categories:
        context.principal.role === 'student'
          ? [
              { value: 'technical', label: 'Technical support' },
              { value: 'access', label: 'Access/login' },
              { value: 'class_question', label: 'Private class question' },
              { value: 'torah_question', label: 'Private Torah question' },
            ]
          : [
              { value: 'billing', label: 'Billing' },
              { value: 'support', label: 'Account/family' },
              { value: 'access', label: 'Access/login' },
              { value: 'technical', label: 'Technical support' },
            ],
    });
  });

  input.app.get('/api/v1/support/v21/tickets', async (req: RequestWithTrace, res) => {
    const context = await requesterContext(req, res, input.session);
    if (!context) return;
    await respond(res, () => service.listForRequester(context.principal));
  });

  input.app.get('/api/v1/support/v21/tickets/:ticketId', async (req: RequestWithTrace, res) => {
    const context = await requesterContext(req, res, input.session);
    if (!context) return;
    await respond(res, () => service.read(context.principal, String(req.params.ticketId)));
  });

  input.app.post(
    '/api/v1/support/v21/tickets',
    express.json({ limit: '32kb' }),
    async (req: RequestWithTrace, res) => {
      const context = await requesterContext(req, res, input.session);
      if (!context || !(await input.session.requireCsrf(req, res, context))) return;
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        invalidRequest(res, req);
        return;
      }
      await respond(
        res,
        () =>
          service.create(context.principal, {
            kind: parsed.data.kind,
            category: parsed.data.category,
            subject: parsed.data.subject,
            body: parsed.data.body,
            idempotencyKey: parsed.data.idempotency_key,
          }),
        201,
      );
    },
  );

  input.app.get('/api/v1/admin/support/v21/tickets', async (req: RequestWithTrace, res) => {
    const context = await adminContext(req, res, input.session);
    if (!context) return;
    await respond(res, () => service.listForAdmin(context.principal));
  });

  input.app.post(
    '/api/v1/admin/support/v21/tickets/:ticketId/assign',
    express.json({ limit: '16kb' }),
    async (req: RequestWithTrace, res) => {
      const context = await adminContext(req, res, input.session);
      if (!context || !(await input.session.requireCsrf(req, res, context))) return;
      const parsed = assignSchema.safeParse(req.body);
      if (!parsed.success) {
        invalidRequest(res, req);
        return;
      }
      await respond(res, () =>
        service.assign({
          principal: context.principal,
          ticketId: String(req.params.ticketId),
          assigneeAdminId: parsed.data.assignee_admin_id,
          expectedVersion: parsed.data.expected_version,
        }),
      );
    },
  );

  input.app.post(
    '/api/v1/admin/support/v21/tickets/:ticketId/status',
    express.json({ limit: '16kb' }),
    async (req: RequestWithTrace, res) => {
      const context = await adminContext(req, res, input.session);
      if (!context || !(await input.session.requireCsrf(req, res, context))) return;
      const parsed = statusSchema.safeParse(req.body);
      if (!parsed.success) {
        invalidRequest(res, req);
        return;
      }
      await respond(res, () =>
        service.transition({
          principal: context.principal,
          ticketId: String(req.params.ticketId),
          to: parsed.data.status as SupportLifecycleState,
          expectedVersion: parsed.data.expected_version,
        }),
      );
    },
  );

  input.app.post(
    '/api/v1/admin/support/v21/tickets/:ticketId/reply',
    express.json({ limit: '16kb' }),
    async (req: RequestWithTrace, res) => {
      const context = await adminContext(req, res, input.session);
      if (!context || !(await input.session.requireCsrf(req, res, context))) return;
      const parsed = replySchema.safeParse(req.body);
      if (!parsed.success) {
        invalidRequest(res, req);
        return;
      }
      await respond(res, () =>
        service.reply({
          principal: context.principal,
          ticketId: String(req.params.ticketId),
          body: parsed.data.body,
          expectedVersion: parsed.data.expected_version,
          idempotencyKey: parsed.data.idempotency_key,
        }),
      );
    },
  );
}

async function supportContext(req: RequestWithTrace, res: Response, session: SupportSessionPorts) {
  session.setPrivateNoStore(res);
  return session.resolve(req, res);
}

async function requesterContext(
  req: RequestWithTrace,
  res: Response,
  session: SupportSessionPorts,
) {
  const context = await supportContext(req, res, session);
  if (!context) return null;
  if (context.principal.role === 'admin') {
    res
      .status(403)
      .json(publicError('FORBIDDEN', 'Parent or Student context is required.', req.traceId));
    return null;
  }
  return context;
}

async function adminContext(req: RequestWithTrace, res: Response, session: SupportSessionPorts) {
  const context = await supportContext(req, res, session);
  if (!context) return null;
  if (context.principal.role !== 'admin') {
    res.status(403).json(publicError('FORBIDDEN', 'Admin context is required.', req.traceId));
    return null;
  }
  return context;
}

async function respond(res: Response, run: () => Promise<unknown>, status = 200) {
  try {
    const data = await run();
    res.status(status).json({ success: true, data });
  } catch (error) {
    if (error instanceof SupportV21Error) {
      res.status(errorStatus(error.code)).json({
        success: false,
        code: error.code,
        message: error.message,
      });
      return;
    }
    const storageCode = supportStorageErrorCode(error);
    if (storageCode) {
      res.status(409).json({
        success: false,
        code: storageCode,
        message:
          storageCode === 'version_conflict'
            ? 'Support conversation version is stale.'
            : 'The idempotency key conflicts with an existing support operation.',
      });
      return;
    }
    throw error;
  }
}

function invalidRequest(res: Response, req: RequestWithTrace) {
  res.status(400).json(publicError('VALIDATION_ERROR', 'Support request is invalid.', req.traceId));
}

function errorStatus(code: SupportV21Error['code']) {
  if (code === 'not_found') return 404;
  if (code === 'forbidden') return 403;
  if (code === 'version_conflict' || code === 'idempotency_conflict') return 409;
  return 400;
}

function supportStorageErrorCode(
  error: unknown,
): 'version_conflict' | 'idempotency_conflict' | null {
  if (!(error instanceof Error)) return null;
  if (error.message === 'support_ticket_version_conflict') return 'version_conflict';
  if (
    error.message === 'support_ticket_insert_conflict' ||
    error.message === 'support_idempotency_conflict'
  ) {
    return 'idempotency_conflict';
  }
  return null;
}
