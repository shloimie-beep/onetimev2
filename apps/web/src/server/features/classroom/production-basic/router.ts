import express, { type Request } from 'express';
import type { ProductionBasicActor } from './service.ts';
import type { ProductionBasicLaunchResult } from './service.ts';

export interface ProductionBasicRequestIdentityResolver {
  resolve(
    request: Request,
  ): Promise<{ actor: ProductionBasicActor; csrf_verified: boolean } | null>;
}

export function createProductionBasicRouter(input: {
  identities: ProductionBasicRequestIdentityResolver;
  service: {
    ready(actor: ProductionBasicActor): Promise<boolean>;
    request(actor: ProductionBasicActor): Promise<ProductionBasicLaunchResult>;
  };
}) {
  const router = express.Router();
  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.removeHeader('ETag');
    next();
  });
  router.post('/launch', async (request, response) => {
    // A launch is intentionally bodyless: client-controlled class/account/learner
    // identifiers could otherwise cross a household or entitlement boundary.
    if (requestHasBody(request)) {
      response.status(400).json(unavailable());
      return;
    }
    const identity = await input.identities.resolve(request);
    if (!identity || !identity.csrf_verified) {
      response.status(403).json(unavailable());
      return;
    }
    const result = await input.service.request(identity.actor);
    if (result.disposition !== 'ready') {
      response.status(result.disposition === 'unavailable' ? 503 : 403).json(unavailable());
      return;
    }
    response.json({ success: true, data: { launch_artifact: result.artifact } });
  });
  router.get('/status', async (request, response) => {
    const identity = await input.identities.resolve(request);
    // Deliberately neutral: navigation can discover only whether its own
    // server-derived identity may see the explicit control, never why not.
    const available = Boolean(
      identity?.csrf_verified && identity.actor && (await input.service.ready(identity.actor)),
    );
    response.json({ success: true, data: { mode: 'production_basic', available } });
  });
  return router;
}

function requestHasBody(request: Request) {
  const contentLength = request.header('content-length');
  return (
    request.body !== undefined ||
    request.header('transfer-encoding') !== undefined ||
    (contentLength !== undefined && contentLength !== '0')
  );
}

function unavailable() {
  return {
    success: false,
    code: 'CLASSROOM_UNAVAILABLE',
    message: 'Classroom access is unavailable.',
  } as const;
}
