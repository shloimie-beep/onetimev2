import { createHash } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { z, ZodError } from 'zod';
import {
  PARENT_LEARNING_ERROR_CODES,
  type ParentLearningMutationContext,
  type ParentLearningMutationOperation,
  type ParentLearningPrincipal,
} from '../../../../../../../packages/contracts/src/portals/parent-learning/index.ts';
import { ParentLearningError } from '../../../../../../../packages/domain/src/portals/parent-learning/index.ts';
import type {
  V21AdultSessionRuntime,
  V21ParentSessionContext,
} from '../../auth/v21-adult-session.ts';
import type { ParentLearningService } from './service.ts';

const identifier = z
  .string()
  .trim()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u);
const attendanceSchema = z
  .object({
    occurrence_id: identifier,
    event_kind: z.enum(['joined', 'left']),
    connection_lineage_id: identifier,
  })
  .strict();
const contentProgressSchema = z
  .object({
    content_id: identifier,
    content_version_id: identifier,
    position_ms: z.number().int().nonnegative().safe(),
    duration_ms: z.number().int().positive().safe(),
    completed: z.boolean(),
  })
  .strict();
const questionSchema = z
  .object({
    class_series_key: identifier,
    private_body: z.string().trim().min(1).max(4_000),
  })
  .strict();
const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/u;

export function createParentLearningRouter(input: {
  service: ParentLearningService;
  sessions: Pick<V21AdultSessionRuntime, 'bootstrapCookieHeader' | 'verifyCsrf'>;
  clock?: () => Date;
}) {
  const router = express.Router();
  const clock = input.clock ?? (() => new Date());
  router.use(noStore);

  router.get(
    '/learning',
    asyncRoute(async (req, res) => {
      const bootstrap = await input.sessions.bootstrapCookieHeader({
        cookie_header: req.header('cookie'),
        now: clock(),
      });
      if (bootstrap.status === 'invalid') {
        sendError(res, 401, 'UNAUTHENTICATED', 'Please sign in again.');
        return;
      }
      if (bootstrap.status === 'unavailable') {
        sendError(res, 503, 'SESSION_UNAVAILABLE', 'Parent learning is temporarily unavailable.');
        return;
      }
      const snapshot = await input.service.overview(
        parentLearningPrincipalFromContext(bootstrap.context),
      );
      res.status(200).json({
        success: true,
        data: { snapshot, csrf_token: bootstrap.csrf_token },
      });
    }),
  );

  router.get(
    '/learning/content/:contentId/open',
    asyncRoute(async (req, res) => {
      const bootstrap = await input.sessions.bootstrapCookieHeader({
        cookie_header: req.header('cookie'),
        now: clock(),
      });
      if (bootstrap.status === 'invalid') {
        sendError(res, 401, 'UNAUTHENTICATED', 'Please sign in again.');
        return;
      }
      if (bootstrap.status === 'unavailable') {
        sendError(res, 503, 'SESSION_UNAVAILABLE', 'Parent learning is temporarily unavailable.');
        return;
      }
      const contentId = identifier.parse(
        Array.isArray(req.params.contentId) ? undefined : req.params.contentId,
      );
      const action = await input.service.openContent(
        parentLearningPrincipalFromContext(bootstrap.context),
        contentId,
      );
      res.status(200).json({ success: true, data: { action } });
    }),
  );

  router.post(
    '/learning/attendance',
    asyncRoute(async (req, res) => {
      const authorized = await requireMutationPrincipal(req, res, input.sessions, clock);
      if (!authorized) return;
      const body = attendanceSchema.parse(req.body);
      const command = {
        ...body,
        source_event_ref_digest: createHash('sha256')
          .update(
            stableJson({
              participant_session: authorized.session_id,
              occurrence_id: body.occurrence_id,
              event_kind: body.event_kind,
              connection_lineage_id: body.connection_lineage_id,
            }),
            'utf8',
          )
          .digest('hex'),
      };
      const context = mutationContext(req, 'attendance_recorded', command, clock());
      sendReceipt(res, await input.service.recordAttendance(authorized, command, context), 201);
    }),
  );

  router.post(
    '/learning/content-progress',
    asyncRoute(async (req, res) => {
      const authorized = await requireMutationPrincipal(req, res, input.sessions, clock);
      if (!authorized) return;
      const command = contentProgressSchema.parse(req.body);
      const context = mutationContext(req, 'content_progress_recorded', command, clock());
      sendReceipt(res, await input.service.recordContentProgress(authorized, command, context));
    }),
  );

  router.post(
    '/learning/questions',
    asyncRoute(async (req, res) => {
      const authorized = await requireMutationPrincipal(req, res, input.sessions, clock);
      if (!authorized) return;
      const command = questionSchema.parse(req.body);
      const context = mutationContext(req, 'question_submitted', command, clock());
      sendReceipt(res, await input.service.submitQuestion(authorized, command, context), 201);
    }),
  );

  router.use(errorHandler);
  return router;
}

async function requireMutationPrincipal(
  req: Request,
  res: Response,
  sessions: Pick<V21AdultSessionRuntime, 'verifyCsrf'>,
  clock: () => Date,
) {
  const context = await sessions.verifyCsrf({
    cookie_header: req.header('cookie'),
    csrf_token: req.header('x-csrf-token'),
    now: clock(),
  });
  if (!context) {
    sendError(res, 403, 'CSRF_OR_SESSION_INVALID', 'Refresh the Parent portal and try again.');
    return null;
  }
  return parentLearningPrincipalFromContext(context);
}

export function parentLearningPrincipalFromContext(
  context: V21ParentSessionContext,
): ParentLearningPrincipal {
  if (
    !context.household ||
    context.session.activeRole !== 'parent' ||
    context.session.activeHouseholdId !== context.household.householdId ||
    context.household.ownerRelationship !== 'account_owner'
  ) {
    throw new ParentLearningError(
      PARENT_LEARNING_ERROR_CODES.scopeDenied,
      'This Parent learning participant is unavailable.',
    );
  }
  return {
    role: 'parent',
    adult_id: context.adultId,
    human_account_id: context.session.humanAccountId,
    household_id: context.household.householdId,
    session_id: context.session.sessionId,
  };
}

function mutationContext(
  req: Request,
  operation: ParentLearningMutationOperation,
  command: unknown,
  now: Date,
): ParentLearningMutationContext {
  const idempotencyKey = req.header('x-idempotency-key');
  if (!idempotencyKey || !IDEMPOTENCY_KEY.test(idempotencyKey)) {
    throw new ParentLearningError(
      PARENT_LEARNING_ERROR_CODES.invalidInput,
      'A valid Parent learning idempotency key is required.',
    );
  }
  return {
    idempotency_key: idempotencyKey,
    canonical_request_hash: createHash('sha256')
      .update(stableJson({ operation, command }), 'utf8')
      .digest('hex'),
    occurred_at: now.toISOString(),
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sendReceipt(
  res: Response,
  receipt: Awaited<ReturnType<ParentLearningService['submitQuestion']>>,
  status = 200,
) {
  res.status(status).json({ success: true, data: { receipt } });
}

function noStore(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'no-store');
  next();
}

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return;
  if (error instanceof ZodError) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Please check the Parent learning details.');
    return;
  }
  if (error instanceof ParentLearningError) {
    sendError(res, statusFor(error.code), error.code, error.message);
    return;
  }
  sendError(res, 500, 'PARENT_LEARNING_UNAVAILABLE', 'Parent learning is temporarily unavailable.');
}

function statusFor(code: string) {
  if (
    code === PARENT_LEARNING_ERROR_CODES.roleDenied ||
    code === PARENT_LEARNING_ERROR_CODES.scopeDenied
  ) {
    return 403;
  }
  if (
    code === PARENT_LEARNING_ERROR_CODES.missing ||
    code === PARENT_LEARNING_ERROR_CODES.targetUnavailable
  ) {
    return 404;
  }
  if (code === PARENT_LEARNING_ERROR_CODES.invalidInput) return 400;
  if (code === PARENT_LEARNING_ERROR_CODES.idempotencyConflict) return 409;
  return 500;
}

function sendError(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ success: false, code, message });
}
