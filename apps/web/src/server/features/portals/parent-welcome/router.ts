import { createHash } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { z, ZodError } from 'zod';
import {
  PARENT_WELCOME_BROWSER_EVENT_TYPES,
  type ParentWelcomePrincipal,
} from '../../../../../../../packages/contracts/src/portals/parent-welcome/index.ts';
import type {
  V21AdultSessionRuntime,
  V21ParentSessionContext,
} from '../../auth/v21-adult-session.ts';
import { ParentWelcomeError, type ParentWelcomeService } from './service.ts';

const videoVersionSchema = z
  .string()
  .min(3)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]+$/u);
const eventSchema = z
  .object({
    event_type: z.enum(PARENT_WELCOME_BROWSER_EVENT_TYPES),
    video_version_id: videoVersionSchema.nullable(),
    observed_playback_seconds: z.number().finite().min(0).max(180).optional(),
    observed_position_percent: z.number().finite().min(0).max(100).optional(),
  })
  .strict();
const idempotencyKeySchema = z
  .string()
  .min(8)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]+$/u);

export type ParentWelcomeAssetKind = 'media' | 'poster' | 'captions';

export type ParentWelcomeAssetRuntime = {
  send(
    req: Request,
    res: Response,
    input: {
      principal: ParentWelcomePrincipal;
      video_version_id: string;
      asset_kind: ParentWelcomeAssetKind;
    },
  ): Promise<void>;
};

export function createParentWelcomeRouter(input: {
  service: ParentWelcomeService;
  sessions: Pick<V21AdultSessionRuntime, 'bootstrapCookieHeader' | 'verifyCsrf'>;
  assetRuntime?: ParentWelcomeAssetRuntime;
  clock?: () => Date;
}) {
  const router = express.Router();
  const clock = input.clock ?? (() => new Date());
  router.use(noStore);

  router.get(
    '/:videoVersionId/playback',
    asyncRoute(async (req, res) => {
      const authorized = await requireReadPrincipal(req, res, input.sessions, clock());
      if (!authorized) return;
      const descriptor = await input.service.playbackDescriptor(
        authorized,
        videoVersionSchema.parse(req.params.videoVersionId),
      );
      res.status(200).json({ success: true, data: { descriptor } });
    }),
  );

  for (const assetKind of ['media', 'poster', 'captions'] as const) {
    router.get(
      `/:videoVersionId/${assetKind}`,
      asyncRoute(async (req, res) => {
        const authorized = await requireReadPrincipal(req, res, input.sessions, clock());
        if (!authorized) return;
        const videoVersionId = videoVersionSchema.parse(req.params.videoVersionId);
        await input.service.playbackDescriptor(authorized, videoVersionId);
        if (!input.assetRuntime) {
          sendError(res, 404, 'PARENT_WELCOME_SLOT_UNAVAILABLE', 'Welcome video unavailable.');
          return;
        }
        await input.assetRuntime.send(req, res, {
          principal: authorized,
          video_version_id: videoVersionId,
          asset_kind: assetKind,
        });
      }),
    );
  }

  router.post(
    '/events',
    asyncRoute(async (req, res) => {
      const authorized = await requireMutationPrincipal(req, res, input.sessions, clock());
      if (!authorized) return;
      const parsed = eventSchema.parse(req.body);
      const command = {
        event_type: parsed.event_type,
        video_version_id: parsed.video_version_id,
        ...(parsed.observed_playback_seconds === undefined
          ? {}
          : { observed_playback_seconds: parsed.observed_playback_seconds }),
        ...(parsed.observed_position_percent === undefined
          ? {}
          : { observed_position_percent: parsed.observed_position_percent }),
      };
      const idempotencyKey = idempotencyKeySchema.parse(req.header('x-idempotency-key'));
      const canonicalRequestHash = createHash('sha256')
        .update(
          JSON.stringify({
            adult_id: authorized.adult_id,
            household_id: authorized.household_id,
            command,
          }),
          'utf8',
        )
        .digest('hex');
      const result = await input.service.recordBrowserEvent(authorized, command, {
        idempotency_key: idempotencyKey,
        canonical_request_hash: canonicalRequestHash,
        occurred_at: clock().toISOString(),
      });
      res.status(202).json({ success: true, data: result });
    }),
  );

  router.use(errorHandler);
  return router;
}

async function requireReadPrincipal(
  req: Request,
  res: Response,
  sessions: Pick<V21AdultSessionRuntime, 'bootstrapCookieHeader'>,
  now: Date,
) {
  const bootstrap = await sessions.bootstrapCookieHeader({
    cookie_header: req.header('cookie'),
    now,
  });
  if (bootstrap.status === 'invalid') {
    sendError(res, 401, 'UNAUTHENTICATED', 'Please sign in again.');
    return null;
  }
  if (bootstrap.status === 'unavailable') {
    sendError(res, 503, 'SESSION_UNAVAILABLE', 'Parent access is temporarily unavailable.');
    return null;
  }
  return principalFrom(bootstrap.context);
}

async function requireMutationPrincipal(
  req: Request,
  res: Response,
  sessions: Pick<V21AdultSessionRuntime, 'verifyCsrf'>,
  now: Date,
) {
  const context = await sessions.verifyCsrf({
    cookie_header: req.header('cookie'),
    csrf_token: req.header('x-csrf-token'),
    now,
  });
  if (!context) {
    sendError(res, 403, 'CSRF_OR_SESSION_INVALID', 'Refresh the Parent portal and try again.');
    return null;
  }
  return principalFrom(context);
}

function principalFrom(context: V21ParentSessionContext): ParentWelcomePrincipal {
  if (
    !context.household ||
    context.session.activeRole !== 'parent' ||
    context.session.activeHouseholdId !== context.household.householdId ||
    context.household.ownerRelationship !== 'account_owner'
  ) {
    throw new ParentWelcomeError(
      'parent_welcome_role_denied',
      'A signed-in Parent account is required.',
    );
  }
  return {
    role: 'parent',
    adult_id: context.adultId,
    household_id: context.household.householdId,
    session_id: context.session.sessionId,
  };
}

function noStore(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
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
    sendError(res, 400, 'VALIDATION_ERROR', 'Please check the welcome video request.');
    return;
  }
  if (error instanceof ParentWelcomeError) {
    const status =
      error.code === 'parent_welcome_role_denied'
        ? 403
        : error.code === 'parent_welcome_slot_unavailable' ||
            error.code === 'parent_welcome_version_mismatch'
          ? 404
          : 400;
    sendError(res, status, error.code, error.message);
    return;
  }
  sendError(res, 500, 'PARENT_WELCOME_UNAVAILABLE', 'Welcome video unavailable.');
}

function sendError(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ success: false, code, message });
}
