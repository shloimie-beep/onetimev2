import express, { type NextFunction, type Request, type Response } from 'express';
import { z, ZodError } from 'zod';
import type {
  CommercialBillingActor,
  CommercialBillingCommand,
} from '../../../../../../../packages/contracts/src/billing/commercial/index.ts';
import type { JobScope } from '../../../../../../../packages/contracts/src/jobs/index.ts';
import { CommercialBillingError } from '../../../../../../../packages/domain/src/billing/commercial/index.ts';
import type {
  V21AdultSessionRuntime,
  V21ParentSessionContext,
} from '../../auth/v21-adult-session.ts';
import type { createCommercialBillingService } from './service.ts';

type CommercialBillingService = ReturnType<typeof createCommercialBillingService>;

const mutationSchema = z
  .object({
    expected_version: z.number().int().positive(),
  })
  .strict();
const checkoutSchema = mutationSchema
  .extend({
    mode: z.enum(['standard', 'immediate_exception']),
    immediate_charge_accepted: z.boolean().optional(),
  })
  .strict();
const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/u;

export function createParentCommercialBillingRouter(input: {
  service: CommercialBillingService;
  sessions: Pick<V21AdultSessionRuntime, 'bootstrapCookieHeader' | 'verifyCsrf'>;
  scope: JobScope;
  freeAccessExpiresAt: string;
  clock?: () => Date;
}) {
  const router = express.Router();
  const clock = input.clock ?? (() => new Date());
  router.use(noStore);

  router.get(
    '/billing',
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
        sendError(res, 503, 'SESSION_UNAVAILABLE', 'Parent billing is temporarily unavailable.');
        return;
      }
      const actor = actorFrom(bootstrap.context);
      const projection = await input.service.summary(requiredHouseholdId(actor));
      res.status(200).json({
        success: true,
        data: {
          projection,
          free_period: {
            sourceKey: 'family_free_period_v2_1',
            timeZone: 'Asia/Jerusalem',
            endsAt: input.freeAccessExpiresAt,
          },
          csrf_token: bootstrap.csrf_token,
        },
      });
    }),
  );

  router.post(
    '/billing/checkout',
    asyncRoute(async (req, res) => {
      const authorized = await requireMutationActor(req, res, input.sessions, clock());
      if (!authorized) return;
      const body = checkoutSchema.parse(req.body);
      if (body.mode === 'immediate_exception' && body.immediate_charge_accepted !== true) {
        throw new CommercialBillingError(
          'consent_required',
          'Immediate charge requires separate affirmative Parent consent.',
        );
      }
      if (body.mode === 'standard' && body.immediate_charge_accepted === true) {
        throw new CommercialBillingError(
          'consent_mismatch',
          'Standard Checkout cannot include immediate-charge consent.',
        );
      }
      const requestedAt = clock().toISOString();
      const householdId = requiredHouseholdId(authorized.actor);
      const command: CommercialBillingCommand = {
        kind: 'request_hosted_checkout',
        householdId,
        idempotencyKey: requiredIdempotencyKey(req),
        expectedVersion: body.expected_version,
        scope: input.scope,
        mode: body.mode,
        requestedAt,
        consent:
          body.mode === 'immediate_exception'
            ? {
                consentVersion: 'immediate-charge-v1',
                actorAdultId: authorized.actor.adultId,
                householdId,
                displayedAmountCents: 6700,
                displayedCurrency: 'USD',
                displayedChargeAt: requestedAt,
                affirmativelyAccepted: true,
                acceptedAt: requestedAt,
              }
            : null,
      };
      sendMutation(res, await input.service.execute({ actor: authorized.actor, command }));
    }),
  );

  router.post(
    '/billing/portal',
    asyncRoute(async (req, res) => {
      const authorized = await requireMutationActor(req, res, input.sessions, clock());
      if (!authorized) return;
      const body = mutationSchema.parse(req.body);
      sendMutation(
        res,
        await input.service.execute({
          actor: authorized.actor,
          command: {
            kind: 'request_hosted_portal',
            householdId: requiredHouseholdId(authorized.actor),
            idempotencyKey: requiredIdempotencyKey(req),
            expectedVersion: body.expected_version,
            scope: input.scope,
            requestedAt: clock().toISOString(),
          },
        }),
      );
    }),
  );

  router.post(
    '/billing/cancel-at-period-end',
    asyncRoute(async (req, res) => {
      const authorized = await requireMutationActor(req, res, input.sessions, clock());
      if (!authorized) return;
      const body = mutationSchema.parse(req.body);
      sendMutation(
        res,
        await input.service.execute({
          actor: authorized.actor,
          command: {
            kind: 'request_period_end_cancellation',
            householdId: requiredHouseholdId(authorized.actor),
            idempotencyKey: requiredIdempotencyKey(req),
            expectedVersion: body.expected_version,
            scope: input.scope,
            requestedAt: clock().toISOString(),
          },
        }),
      );
    }),
  );

  router.use(errorHandler);
  return router;
}

async function requireMutationActor(
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
  return { actor: actorFrom(context) };
}

function actorFrom(context: V21ParentSessionContext): CommercialBillingActor {
  if (
    !context.household ||
    context.session.activeRole !== 'parent' ||
    context.session.activeHouseholdId !== context.household.householdId ||
    context.household.ownerRelationship !== 'account_owner'
  ) {
    throw new CommercialBillingError(
      'authorization_denied',
      'This Parent household billing context is unavailable.',
    );
  }
  return {
    adultId: context.adultId,
    authorization: {
      humanAccountId: context.session.humanAccountId,
      memberships: context.memberships,
      activeRole: context.session.activeRole,
      activeHouseholdId: context.household.householdId,
      serverResolvedOwnedHouseholdIds: [context.household.householdId],
    },
  };
}

function requiredHouseholdId(actor: CommercialBillingActor) {
  const householdId = actor.authorization.activeHouseholdId;
  if (!householdId) {
    throw new CommercialBillingError('authorization_denied', 'A Parent household is required.');
  }
  return householdId;
}

function requiredIdempotencyKey(req: Request) {
  const value = req.header('x-idempotency-key');
  if (!value || !IDEMPOTENCY_KEY.test(value)) {
    throw new CommercialBillingError(
      'idempotency_conflict',
      'A valid idempotency key is required.',
    );
  }
  return value;
}

function sendMutation(
  res: Response,
  result: Awaited<ReturnType<CommercialBillingService['execute']>>,
) {
  res.status(202).json({
    success: true,
    data: {
      disposition: result.disposition,
      projection: result.projection,
      provider_handoff: {
        status: 'queued',
        orchestrator: 'highlevel',
        financial_provider: 'stripe',
        redirect_url: null,
      },
    },
  });
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
    sendError(res, 400, 'VALIDATION_ERROR', 'Please check the billing request.');
    return;
  }
  if (error instanceof CommercialBillingError) {
    sendError(res, statusFor(error.code), error.code, error.message);
    return;
  }
  if (error instanceof Error && error.message === 'commercial_billing_household_not_found') {
    sendError(
      res,
      404,
      'BILLING_HOUSEHOLD_NOT_FOUND',
      'Billing is unavailable for this household.',
    );
    return;
  }
  sendError(res, 500, 'PARENT_BILLING_UNAVAILABLE', 'Parent billing is temporarily unavailable.');
}

function statusFor(code: string) {
  if (code === 'authorization_denied' || code === 'cross_household_denied') return 403;
  if (code === 'stale_version' || code === 'idempotency_conflict') return 409;
  if (code === 'portal_not_available' || code === 'paid_period_required') return 409;
  return 400;
}

function sendError(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ success: false, code, message });
}
