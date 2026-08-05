import { createHash } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { z, ZodError } from 'zod';
import type {
  V21AdultSessionRuntime,
  V21ParentSessionContext,
} from '../../auth/v21-adult-session.ts';
import {
  ParentPreferencesError,
  type ParentPreferencesPrincipal,
  type createPostgresParentPreferencesRepository,
} from './repository.ts';

type ParentPreferencesRepository = ReturnType<typeof createPostgresParentPreferencesRepository>;
const updateSchema = z
  .object({
    time_zone: z.string().trim().min(3).max(80),
    portal_class_reminders: z.boolean(),
    email_class_reminders: z.boolean(),
    parent_newsletter_consent: z.boolean(),
    expected_revision: z.number().int().positive(),
  })
  .strict();
const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/u;

export function createParentPreferencesRouter(input: {
  repository: ParentPreferencesRepository;
  sessions: Pick<V21AdultSessionRuntime, 'bootstrapCookieHeader' | 'verifyCsrf'>;
  clock?: () => Date;
}) {
  const router = express.Router();
  const clock = input.clock ?? (() => new Date());
  router.use(noStore);

  router.get(
    '/preferences',
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
        sendError(res, 503, 'SESSION_UNAVAILABLE', 'Parent preferences are temporarily unavailable.');
        return;
      }
      res.status(200).json({
        success: true,
        data: {
          snapshot: await input.repository.load(principalFrom(bootstrap.context)),
          csrf_token: bootstrap.csrf_token,
        },
      });
    }),
  );

  router.patch(
    '/preferences',
    asyncRoute(async (req, res) => {
      const context = await input.sessions.verifyCsrf({
        cookie_header: req.header('cookie'),
        csrf_token: req.header('x-csrf-token'),
        now: clock(),
      });
      if (!context) {
        sendError(res, 403, 'CSRF_OR_SESSION_INVALID', 'Refresh the Parent portal and try again.');
        return;
      }
      const command = updateSchema.parse(req.body);
      assertIanaTimeZone(command.time_zone);
      const idempotencyKey = req.header('x-idempotency-key');
      if (!idempotencyKey || !IDEMPOTENCY_KEY.test(idempotencyKey)) {
        throw new ParentPreferencesError(
          'parent_preferences_idempotency_conflict',
          'A valid idempotency key is required.',
        );
      }
      const occurredAt = clock();
      const snapshot = await input.repository.update({
        principal: principalFrom(context),
        command,
        idempotency_key: idempotencyKey,
        canonical_request_hash: createHash('sha256')
          .update(stableJson({ operation: 'parent_preferences_updated', command }), 'utf8')
          .digest('hex'),
        occurred_at: occurredAt,
      });
      res.status(200).json({ success: true, data: { snapshot } });
    }),
  );

  router.use(errorHandler);
  return router;
}

function principalFrom(context: V21ParentSessionContext): ParentPreferencesPrincipal {
  if (
    !context.household ||
    context.session.activeRole !== 'parent' ||
    context.session.activeHouseholdId !== context.household.householdId ||
    context.household.ownerRelationship !== 'account_owner'
  ) {
    throw new ParentPreferencesError(
      'parent_preferences_missing',
      'Parent preferences are unavailable for this household.',
    );
  }
  return { adult_id: context.adultId, household_id: context.household.householdId };
}

function assertIanaTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date(0));
  } catch {
    throw new ZodError([
      {
        code: 'custom',
        path: ['time_zone'],
        message: 'A valid IANA time zone is required.',
      },
    ]);
  }
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
    sendError(res, 400, 'VALIDATION_ERROR', 'Please check the preference values.');
    return;
  }
  if (error instanceof ParentPreferencesError) {
    const status = error.code === 'parent_preferences_missing' ? 404 : 409;
    sendError(res, status, error.code, error.message);
    return;
  }
  sendError(
    res,
    500,
    'PARENT_PREFERENCES_UNAVAILABLE',
    'Parent preferences are temporarily unavailable.',
  );
}

function sendError(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ success: false, code, message });
}
