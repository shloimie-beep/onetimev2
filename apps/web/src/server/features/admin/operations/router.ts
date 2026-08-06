import express, { type Request, type Response } from 'express';
import { z, ZodError } from 'zod';
import type { AppConfig } from '../../../../../../../packages/config/src/index.ts';
import type { AdminOperationsActor } from '../../../../../../../packages/contracts/src/admin/operations/index.ts';
import { ADMIN_SEARCH_KINDS } from '../../../../../../../packages/contracts/src/admin/operations/index.ts';
import type { AuthenticatedSession } from '../../../../../../../packages/domain/src/index.ts';
import { AdminOperationsError } from '../../../../../../../packages/domain/src/admin-search/index.ts';
import type { AdminOperationsService } from './service.ts';

const searchKindSchema = z.enum(ADMIN_SEARCH_KINDS);
const searchRequestSchema = z
  .object({
    query: z.string(),
    kinds: z.array(searchKindSchema),
    pageSize: z.number().int(),
    cursor: z.string().nullable(),
  })
  .strict();
const navigationRequestSchema = z
  .object({
    kind: searchKindSchema,
    targetId: z.string(),
    selectedCredentialVersion: z.number().int(),
  })
  .strict();

type AdminOperationsRouterDeps = {
  config: AppConfig;
  service: AdminOperationsService;
  resolveSession: (req: Request, res: Response) => Promise<AuthenticatedSession | null>;
  isSameOrigin: (req: Request) => boolean;
  setPrivateNoStore: (res: Response) => void;
};

export function createAdminOperationsRouter(deps: AdminOperationsRouterDeps) {
  const router = express.Router();

  router.post('/search', async (req, res) => {
    deps.setPrivateNoStore(res);
    if (!privateTransportAllowed(req, res, deps, 'x-onetime-private-search')) return;
    const actor = await adminActor(req, res, deps);
    if (!actor) return;
    try {
      const request = searchRequestSchema.parse(req.body);
      res.status(200).json(await deps.service.search(actor, request));
    } catch (error) {
      respondAdminOperationsError(error, res);
    }
  });

  router.post('/operations/resolve', async (req, res) => {
    deps.setPrivateNoStore(res);
    if (!privateTransportAllowed(req, res, deps, 'x-onetime-private-resolution')) return;
    const actor = await adminActor(req, res, deps);
    if (!actor) return;
    try {
      const request = navigationRequestSchema.parse(req.body);
      res.status(200).json(await deps.service.resolveNavigation(actor, request));
    } catch (error) {
      respondAdminOperationsError(error, res);
    }
  });

  return router;
}

function privateTransportAllowed(
  req: Request,
  res: Response,
  deps: AdminOperationsRouterDeps,
  requiredHeader: 'x-onetime-private-search' | 'x-onetime-private-resolution',
) {
  if (
    req.header(requiredHeader) !== '1' ||
    !deps.isSameOrigin(req) ||
    Object.keys(req.query).length > 0
  ) {
    res.status(403).json({
      success: false,
      code: 'ADMIN_PRIVATE_TRANSPORT_REQUIRED',
      message: 'Use the authorized private Admin command.',
    });
    return false;
  }
  return true;
}

async function adminActor(
  req: Request,
  res: Response,
  deps: AdminOperationsRouterDeps,
): Promise<AdminOperationsActor | null> {
  const session = await deps.resolveSession(req, res);
  if (!session) return null;
  if (session.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      code: 'ADMIN_OPERATIONS_FORBIDDEN',
      message: 'Admin access is required.',
    });
    return null;
  }
  return {
    product: 'one_time_mishnayos',
    runtimeTier: deps.config.oneTimeRuntimeTier,
    verificationEnvironmentId: deps.config.oneTimeVerificationEnvironmentId,
    principal: {
      human_account_id: session.user.user_key,
      role: 'admin',
      household_id: null,
      student_id: null,
      credential_version: credentialVersion(session),
    },
  };
}

function credentialVersion(session: AuthenticatedSession) {
  const value = session.session_security_version ?? 1;
  return Number.isSafeInteger(value) && value >= 1 ? value : 1;
}

function respondAdminOperationsError(error: unknown, res: Response) {
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      code: 'admin_operations_invalid_query',
      message: 'The private Admin request is invalid.',
    });
    return;
  }
  if (error instanceof AdminOperationsError) {
    const status =
      error.code === 'admin_operations_invalid_query'
        ? 400
        : error.code === 'admin_operations_access_denied' ||
            error.code === 'admin_operations_cross_scope'
          ? 403
          : 503;
    res.status(status).json({ success: false, code: error.code, message: error.message });
    return;
  }
  res.status(503).json({
    success: false,
    code: 'admin_operations_unavailable',
    message: 'Private Admin operations are unavailable.',
  });
}
