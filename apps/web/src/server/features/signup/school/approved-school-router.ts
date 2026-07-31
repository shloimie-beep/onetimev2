import express, { type Request, type Response } from 'express';
import { z, ZodError } from 'zod';
import {
  type ApprovedSchoolConfiguration,
  type ApprovedSchoolConfigurationCommand,
  type ApprovedSchoolConfigurationResult,
  type SchoolSignupScope,
} from '../../../../../../../packages/contracts/src/signup/school/index.ts';
import { PostgresSchoolSignupRepositoryError } from '../../../../../../../packages/db/src/signup/school/repository.ts';
import {
  SchoolSignupError,
  type SchoolConfigurationActor,
} from '../../../../../../../packages/domain/src/signup/school/index.ts';

type ApprovedSchoolRequest = Request & { traceId?: string };

const approvedSchoolPayloadSchema = z
  .object({
    approved_school_id: z.string().min(1).max(180),
    adult_account_manager_id: z.string().min(1).max(180),
    household_id: z.string().min(1).max(180),
    seat_allowance: z.number().int().min(1).max(100_000),
    price_minor_units: z.number().int().nonnegative(),
    currency: z.literal('USD'),
    billing_starts_at: z.iso.datetime({ offset: true }),
    terms_reference: z.string().min(1).max(200),
    immutable_contract_reference: z.string().min(1).max(200),
    authorization_reason: z.string().min(1).max(500),
    idempotency_key: z.string().min(1).max(180),
    expected_configuration_version: z.number().int().nonnegative(),
  })
  .strict();

export interface ApprovedSchoolAdminSession {
  human_account_id: string;
  role: 'admin' | 'parent' | 'student';
}

export interface ApprovedSchoolConfigurator {
  configureApprovedSchool(input: {
    actor: SchoolConfigurationActor;
    authorized_at: string;
    command: ApprovedSchoolConfigurationCommand;
  }): Promise<ApprovedSchoolConfigurationResult>;
  readApprovedSchool(input: {
    actor: SchoolConfigurationActor;
    approved_school_id: string;
  }): Promise<ApprovedSchoolConfiguration | null>;
}

export interface ApprovedSchoolAdminRouterInput {
  runtimeBinding: SchoolSignupScope;
  resolveSession(req: Request): Promise<ApprovedSchoolAdminSession | null>;
  verifyCsrf(req: Request, session: ApprovedSchoolAdminSession): Promise<boolean>;
  now(): string;
  configurator: ApprovedSchoolConfigurator;
}

export function createApprovedSchoolAdminRouter(
  input: ApprovedSchoolAdminRouterInput,
): express.Router {
  const router = express.Router();
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    next();
  });

  router.get(
    '/:approvedSchoolId',
    route(async (req, res) => {
      const actor = await requireAdmin(req, res, input);
      if (!actor) return;
      const approvedSchoolId = z.string().min(1).max(180).parse(req.params.approvedSchoolId);
      const configuration = await input.configurator.readApprovedSchool({
        actor,
        approved_school_id: approvedSchoolId,
      });
      if (!configuration) {
        respond(res, req, 404, 'APPROVED_SCHOOL_NOT_FOUND', 'Approved School not found.');
        return;
      }
      res.json({ success: true, configuration });
    }),
  );

  router.post(
    '/',
    route(async (req, res) => {
      const actor = await requireAdmin(req, res, input);
      if (!actor) return;
      const session = res.locals.approvedSchoolSession as ApprovedSchoolAdminSession;
      if (!(await input.verifyCsrf(req, session))) {
        respond(res, req, 403, 'CSRF_REQUIRED', 'Refresh the page and try again.');
        return;
      }
      if (input.runtimeBinding.verification_environment_id === 'production_read_only') {
        respond(
          res,
          req,
          403,
          'VERIFICATION_ENVIRONMENT_READ_ONLY',
          'Approved School writes are disabled in this verification environment.',
        );
        return;
      }
      const payload = approvedSchoolPayloadSchema.parse(req.body);
      const result = await input.configurator.configureApprovedSchool({
        actor,
        authorized_at: input.now(),
        command: {
          ...payload,
          audit_ref: `approved-school:${payload.idempotency_key}`,
        },
      });
      res.status(result.disposition === 'created' ? 201 : 200).json({
        success: true,
        ...result,
      });
    }),
  );

  router.use(
    (error: unknown, req: ApprovedSchoolRequest, res: Response, _next: express.NextFunction) => {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Please check the approved School configuration.',
          field_errors: Object.fromEntries(
            error.issues
              .filter((issue) => typeof issue.path[0] === 'string')
              .map((issue) => [String(issue.path[0]), issue.message]),
          ),
          request_id: req.traceId,
        });
        return;
      }
      if (error instanceof SchoolSignupError) {
        const denied = error.code === 'school_configuration_denied';
        respond(
          res,
          req,
          denied ? 403 : 409,
          denied ? 'APPROVED_SCHOOL_FORBIDDEN' : 'APPROVED_SCHOOL_CONFLICT',
          denied
            ? 'Administrator authorization is required.'
            : 'The approved School configuration does not match current authority.',
        );
        return;
      }
      if (error instanceof PostgresSchoolSignupRepositoryError) {
        const readOnly = error.code === 'read_only_environment';
        respond(
          res,
          req,
          readOnly ? 403 : 409,
          readOnly ? 'VERIFICATION_ENVIRONMENT_READ_ONLY' : 'APPROVED_SCHOOL_CONFLICT',
          readOnly
            ? 'Approved School writes are disabled in this verification environment.'
            : 'The approved School configuration could not be committed.',
        );
        return;
      }
      respond(res, req, 500, 'SERVER_ERROR', 'The approved School request could not be completed.');
    },
  );

  return router;
}

async function requireAdmin(
  req: ApprovedSchoolRequest,
  res: Response,
  input: Pick<ApprovedSchoolAdminRouterInput, 'resolveSession' | 'runtimeBinding'>,
): Promise<SchoolConfigurationActor | null> {
  const session = await input.resolveSession(req);
  if (!session) {
    respond(res, req, 401, 'UNAUTHENTICATED', 'Please log in again.');
    return null;
  }
  if (session.role !== 'admin') {
    respond(res, req, 403, 'APPROVED_SCHOOL_FORBIDDEN', 'Administrator authorization is required.');
    return null;
  }
  res.locals.approvedSchoolSession = session;
  return {
    ...input.runtimeBinding,
    human_account_id: session.human_account_id,
    role: 'admin',
  };
}

function route(handler: (req: ApprovedSchoolRequest, res: Response) => Promise<void>) {
  return (req: ApprovedSchoolRequest, res: Response, next: express.NextFunction) => {
    handler(req, res).catch(next);
  };
}

function respond(
  res: Response,
  req: ApprovedSchoolRequest,
  status: number,
  code: string,
  message: string,
): void {
  res.status(status).json({
    success: false,
    code,
    message,
    request_id: req.traceId,
  });
}
