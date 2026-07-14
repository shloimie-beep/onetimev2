import express, { type Request, type Response } from 'express';
import { createBillingServices } from '../../../../../../packages/domain/src/billing/service.ts';
import type {
  BillingActorContext,
  BillingAuthorizationAdapter,
  BillingFeatureConfig,
} from '../../../../../../packages/domain/src/billing/types.ts';
import type { createPostgresBillingRepositories } from '../../../../../../packages/db/src/billing/repository.ts';
import type { BillingProviderAdapter } from '../../../../../../packages/contracts/src/billing/index.ts';

type BillingRouterDeps = {
  config: BillingFeatureConfig;
  repositories: ReturnType<typeof createPostgresBillingRepositories>;
  providerAdapter: BillingProviderAdapter;
  authorization: BillingAuthorizationAdapter;
  resolveActor: (req: Request) => Promise<BillingActorContext>;
  verifyCsrf: (req: Request) => Promise<boolean>;
};

export function createBillingRouter(deps: BillingRouterDeps) {
  const router = express.Router();
  const services = createBillingServices(deps);

  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    next();
  });

  router.post('/checkout-sessions', express.json({ limit: '8kb' }), async (req, res) => {
    const actor = await deps.resolveActor(req);
    if (!(await deps.verifyCsrf(req))) return forbidden(res, 'CSRF_REQUIRED');
    respond(res, await services.requestCheckoutSession({ actor, payload: req.body }));
  });

  router.post('/customer-portal-sessions', express.json({ limit: '8kb' }), async (req, res) => {
    const actor = await deps.resolveActor(req);
    if (!(await deps.verifyCsrf(req))) return forbidden(res, 'CSRF_REQUIRED');
    respond(res, await services.requestCustomerPortalSession({ actor, payload: req.body }));
  });

  router.get('/summary/:principalKey', async (req, res) => {
    const actor = await deps.resolveActor(req);
    respond(
      res,
      await services.billingSummary({ actor, principal_key: String(req.params.principalKey) }),
    );
  });

  router.get('/invoices/:principalKey', async (req, res) => {
    const actor = await deps.resolveActor(req);
    respond(
      res,
      await services.invoiceSummaries({ actor, principal_key: String(req.params.principalKey) }),
    );
  });

  router.post('/reconciliation', express.json({ limit: '8kb' }), async (req, res) => {
    const actor = await deps.resolveActor(req);
    if (!(await deps.verifyCsrf(req))) return forbidden(res, 'CSRF_REQUIRED');
    respond(res, await services.requestReconciliation({ actor, payload: req.body }));
  });

  router.post(
    '/webhooks/provider',
    express.raw({ type: '*/*', limit: '64kb' }),
    async (req, res) => {
      respond(
        res,
        await services.receiveWebhook({
          rawBody: req.body,
          signatureHeader: req.header('x-fixture-billing-signature'),
          parsedBodyWasUsed: !Buffer.isBuffer(req.body),
        }),
      );
    },
  );

  return router;
}

type AnyServiceResult = {
  ok: boolean;
  value?: unknown;
  code?: string;
  message?: string;
  status?: number;
};

function respond(res: Response, result: AnyServiceResult) {
  if (!result.ok) {
    res
      .status(result.status ?? 500)
      .json({ success: false, code: result.code, message: result.message });
    return;
  }
  res.status(200).json({ success: true, ...('value' in result ? { data: result.value } : {}) });
}

function forbidden(res: Response, code: string) {
  res.status(403).json({ success: false, code, message: 'Refresh the page and try again.' });
}
