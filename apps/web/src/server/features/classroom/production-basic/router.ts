import express, { type Request, type Response } from 'express';
import { ZoomApiError } from '../../../../../../../packages/domain/src/providers/zoom-rest.ts';
import type {
  ProductionBasicActor,
  ProductionBasicHostLiveResult,
  ProductionBasicLaunchArtifact,
  ProductionBasicLaunchResult,
} from './service.ts';

export type ProductionBasicIdentityResolution =
  | { status: 'resolved'; actor: ProductionBasicActor; csrf_verified: boolean }
  | { status: 'missing' | 'unavailable' | 'session_context_conflict' };

export interface ProductionBasicRequestIdentityResolver {
  resolve(request: Request, response: Response): Promise<ProductionBasicIdentityResolution>;
}

export type ProductionBasicLaunchFailureEvent = Readonly<{
  category: 'zoom_provider' | 'unexpected';
  safe_error_code: string;
}>;

type ProductionBasicRouterInput = {
  identities: ProductionBasicRequestIdentityResolver;
  service: {
    ready(actor: ProductionBasicActor): Promise<boolean>;
    request(actor: ProductionBasicActor): Promise<ProductionBasicLaunchResult>;
    confirmHostLive(actor: ProductionBasicActor): Promise<ProductionBasicHostLiveResult>;
    confirmHostEnded(actor: ProductionBasicActor): Promise<ProductionBasicHostLiveResult>;
  };
  onLaunchFailure?: ((event: ProductionBasicLaunchFailureEvent) => void) | undefined;
};

export function createStudentProductionBasicRouter(input: ProductionBasicRouterInput) {
  return createRoleBoundProductionBasicRouter(input, 'student');
}

export function createParentProductionBasicRouter(input: ProductionBasicRouterInput) {
  return createRoleBoundProductionBasicRouter(input, 'parent');
}

export function createAdminProductionBasicRouter(input: ProductionBasicRouterInput) {
  return createRoleBoundProductionBasicRouter(input, 'host');
}

function createRoleBoundProductionBasicRouter(
  input: ProductionBasicRouterInput,
  boundary: 'student' | 'parent' | 'host',
) {
  const router = express.Router();
  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.removeHeader('ETag');
    next();
  });
  router.post('/launch', async (request, response) => {
    if (requestHasBody(request)) {
      response.status(400).json(unavailable());
      return;
    }
    const identity = await input.identities.resolve(request, response);
    if (!resolvedForBoundary(identity, boundary) || !identity.csrf_verified) {
      respondForIdentityFailure(response, identity);
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
    if (!artifactMatchesBoundary(result.artifact, boundary)) {
      response.status(503).json(unavailable());
      return;
    }
    response.json({ success: true, data: { launch_artifact: result.artifact } });
  });
  if (boundary === 'host') {
    router.post('/host-live', (request, response) =>
      handleHostMarker(input, request, response, 'live'),
    );
    router.post('/host-ended', (request, response) =>
      handleHostMarker(input, request, response, 'ended'),
    );
  }
  router.get('/status', async (request, response) => {
    const identity = await input.identities.resolve(request, response);
    if (identity.status === 'session_context_conflict') {
      response.status(409).json(sessionContextConflict());
      return;
    }
    const available = Boolean(
      resolvedForBoundary(identity, boundary) &&
      identity.csrf_verified &&
      (await input.service.ready(identity.actor)),
    );
    response.json({ success: true, data: { mode: 'production_basic', available } });
  });
  return router;
}

async function handleHostMarker(
  input: ProductionBasicRouterInput,
  request: Request,
  response: Response,
  state: 'live' | 'ended',
) {
  if (requestHasBody(request)) {
    response.status(400).json(unavailable());
    return;
  }
  const identity = await input.identities.resolve(request, response);
  if (!resolvedForBoundary(identity, 'host') || !identity.csrf_verified) {
    respondForIdentityFailure(response, identity);
    return;
  }
  let result: ProductionBasicHostLiveResult;
  try {
    result =
      state === 'live'
        ? await input.service.confirmHostLive(identity.actor)
        : await input.service.confirmHostEnded(identity.actor);
  } catch (error) {
    reportLaunchFailure(input.onLaunchFailure, classifyLaunchFailure(error));
    response.status(503).json(unavailable());
    return;
  }
  if (result.disposition !== 'ready') {
    response.status(result.disposition === 'denied' ? 403 : 503).json(unavailable());
    return;
  }
  response.json({
    success: true,
    data: { state },
  });
}

function resolvedForBoundary(
  identity: ProductionBasicIdentityResolution,
  boundary: 'student' | 'parent' | 'host',
): identity is Extract<ProductionBasicIdentityResolution, { status: 'resolved' }> {
  if (identity.status !== 'resolved') return false;
  if (boundary === 'student') return identity.actor.kind === 'student';
  if (boundary === 'parent') return identity.actor.kind === 'parent';
  return identity.actor.kind === 'admin' || identity.actor.kind === 'rabbi';
}

function artifactMatchesBoundary(
  artifact: ProductionBasicLaunchArtifact,
  boundary: 'student' | 'parent' | 'host',
) {
  if (boundary === 'student') {
    return artifact.role === 0 && artifact.leave_path === '/app/student' && !('zak' in artifact);
  }
  if (boundary === 'parent') {
    return artifact.role === 0 && artifact.leave_path === '/app/parent' && !('zak' in artifact);
  }
  return (
    artifact.role === 1 &&
    artifact.leave_path === '/app/live-console' &&
    typeof artifact.zak === 'string' &&
    artifact.zak.trim().length > 0
  );
}

function respondForIdentityFailure(
  response: Response,
  identity: ProductionBasicIdentityResolution,
) {
  if (identity.status === 'session_context_conflict') {
    response.status(409).json(sessionContextConflict());
    return;
  }
  response.status(identity.status === 'unavailable' ? 503 : 403).json(unavailable());
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

function sessionContextConflict() {
  return {
    success: false,
    code: 'SESSION_CONTEXT_CONFLICT',
    message: 'Your session context changed. Please sign in again.',
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
