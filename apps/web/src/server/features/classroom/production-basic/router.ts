import express, { type Request } from 'express';
import { ZoomApiError } from '../../../../../../../packages/domain/src/providers/zoom-rest.ts';
import type { ProductionBasicActor } from './service.ts';
import type { ProductionBasicHostLiveResult } from './service.ts';
import type { ProductionBasicLaunchResult } from './service.ts';

export interface ProductionBasicRequestIdentityResolver {
  resolve(
    request: Request,
  ): Promise<{ actor: ProductionBasicActor; csrf_verified: boolean } | null>;
}

export type ProductionBasicLaunchFailureEvent = Readonly<{
  category: 'zoom_provider' | 'unexpected';
  safe_error_code: string;
}>;

export function createProductionBasicRouter(input: {
  identities: ProductionBasicRequestIdentityResolver;
  service: {
    ready(actor: ProductionBasicActor): Promise<boolean>;
    request(actor: ProductionBasicActor): Promise<ProductionBasicLaunchResult>;
    confirmHostLive(actor: ProductionBasicActor): Promise<ProductionBasicHostLiveResult>;
    clearHostLive(actor: ProductionBasicActor): Promise<ProductionBasicHostLiveResult>;
  };
  onLaunchFailure?: ((event: ProductionBasicLaunchFailureEvent) => void) | undefined;
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
    let result: ProductionBasicLaunchResult;
    try {
      result = await input.service.request(identity.actor);
    } catch (error) {
      reportLaunchFailure(input.onLaunchFailure, classifyLaunchFailure(error));
      response.status(503).json(unavailable());
      return;
    }
    if (result.disposition !== 'ready') {
      response.status(result.disposition === 'unavailable' ? 503 : 403).json(unavailable());
      return;
    }
    response.json({ success: true, data: { launch_artifact: result.artifact } });
  });
  router.post('/host-live', async (request, response) => {
    if (requestHasBody(request)) {
      response.status(400).json(unavailable());
      return;
    }
    const identity = await input.identities.resolve(request);
    if (!identity || !identity.csrf_verified) {
      response.status(403).json(unavailable());
      return;
    }
    let result: ProductionBasicHostLiveResult;
    try {
      result = await input.service.confirmHostLive(identity.actor);
    } catch (error) {
      reportLaunchFailure(input.onLaunchFailure, classifyLaunchFailure(error));
      response.status(503).json(unavailable());
      return;
    }
    if (result.disposition !== 'ready') {
      response.status(result.disposition === 'denied' ? 403 : 503).json(unavailable());
      return;
    }
    response.json({ success: true, data: { state: 'live' } });
  });
  router.post('/host-ended', async (request, response) => {
    if (requestHasBody(request)) {
      response.status(400).json(unavailable());
      return;
    }
    const identity = await input.identities.resolve(request);
    if (!identity || !identity.csrf_verified) {
      response.status(403).json(unavailable());
      return;
    }
    let result: ProductionBasicHostLiveResult;
    try {
      result = await input.service.clearHostLive(identity.actor);
    } catch (error) {
      reportLaunchFailure(input.onLaunchFailure, classifyLaunchFailure(error));
      response.status(503).json(unavailable());
      return;
    }
    if (result.disposition !== 'ready') {
      response.status(result.disposition === 'denied' ? 403 : 503).json(unavailable());
      return;
    }
    response.json({ success: true, data: { state: 'scheduled' } });
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

const SAFE_ZOOM_LAUNCH_ERROR_CODES = new Set<string>([
  'ZOOM_PROVIDER_DISABLED',
  'ZOOM_PRODUCTION_BLOCKED',
  'ZOOM_HOST_ZAK_OAUTH_FAILED',
  'ZOOM_HOST_ZAK_NOT_AUTHORIZED',
  'ZOOM_HOST_ZAK_HOST_NOT_FOUND',
  'ZOOM_HOST_ZAK_RATE_LIMITED',
  'ZOOM_HOST_ZAK_PROVIDER_UNAVAILABLE',
  'ZOOM_HOST_ZAK_REQUEST_FAILED',
  'ZOOM_HOST_ZAK_READBACK_INVALID',
]);

function classifyLaunchFailure(error: unknown): ProductionBasicLaunchFailureEvent {
  if (error instanceof ZoomApiError) {
    return {
      category: 'zoom_provider',
      safe_error_code: SAFE_ZOOM_LAUNCH_ERROR_CODES.has(error.code)
        ? error.code
        : 'ZOOM_HOST_ZAK_REQUEST_FAILED',
    };
  }
  return { category: 'unexpected', safe_error_code: 'CLASSROOM_LAUNCH_FAILED' };
}

function reportLaunchFailure(
  observer: ((event: ProductionBasicLaunchFailureEvent) => void) | undefined,
  event: ProductionBasicLaunchFailureEvent,
) {
  try {
    observer?.(event);
  } catch {
    // Observability must never replace the governed launch response.
  }
}
