import { createHash } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { z, ZodError } from 'zod';
import {
  PARENT_HOUSEHOLD_ERROR_CODES,
  type ParentHouseholdMutationContext,
  type ParentHouseholdMutationOperation,
  type ParentHouseholdPrincipal,
} from '../../../../../../../packages/contracts/src/portals/parent-household/index.ts';
import { ParentHouseholdError } from '../../../../../../../packages/domain/src/portals/parent-household/index.ts';
import type {
  V21AdultSessionRuntime,
  V21ParentSessionContext,
} from '../../auth/v21-adult-session.ts';
import type { ParentHouseholdService } from './service.ts';
import { ParentSummaryError, type ParentSummaryService } from '../parent-summary/index.ts';

const revisionSchema = z.number().int().positive();
const studentIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9._:-]+$/u);
const profileSchema = z
  .object({
    actual_name: z.string().min(1).max(100),
    display_name: z.string().max(100).nullable().optional(),
    username: z.string().trim().min(3).max(64),
  })
  .strict();
const credentialSchema = z
  .object({
    new_password: z.string().min(12).max(128),
    password_confirmation: z.string().min(12).max(128),
  })
  .strict();
const createSchema = profileSchema
  .extend({
    relationship: z.enum(['self', 'dependent']),
    expected_revision: revisionSchema,
    new_password: credentialSchema.shape.new_password,
    password_confirmation: credentialSchema.shape.password_confirmation,
  })
  .strict();
const updateSchema = profileSchema.extend({ expected_revision: revisionSchema }).strict();
const lifecycleSchema = z.object({ expected_revision: revisionSchema }).strict();
const resetSchema = credentialSchema.extend({ expected_revision: revisionSchema }).strict();
const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

export function createParentHouseholdRouter(input: {
  service: ParentHouseholdService;
  summaryService?: ParentSummaryService;
  sessions: Pick<V21AdultSessionRuntime, 'bootstrapCookieHeader' | 'verifyCsrf'>;
  fingerprintPasswordForIdempotency: (password: string) => Promise<string>;
  clock?: () => Date;
}) {
  const router = express.Router();
  const clock = input.clock ?? (() => new Date());
  router.use(noStore);

  router.get(
    '/household',
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
        sendError(res, 503, 'SESSION_UNAVAILABLE', 'Parent access is temporarily unavailable.');
        return;
      }
      const snapshot = await input.service.overview(principalFrom(bootstrap.context));
      res.status(200).json({
        success: true,
        data: { snapshot, csrf_token: bootstrap.csrf_token },
      });
    }),
  );

  router.get(
    '/summary',
    asyncRoute(async (req, res) => {
      if (!input.summaryService) {
        sendError(
          res,
          503,
          'PARENT_SUMMARY_UNAVAILABLE',
          'Parent summary is temporarily unavailable.',
        );
        return;
      }
      const bootstrap = await input.sessions.bootstrapCookieHeader({
        cookie_header: req.header('cookie'),
        now: clock(),
      });
      if (bootstrap.status === 'invalid') {
        sendError(res, 401, 'UNAUTHENTICATED', 'Please sign in again.');
        return;
      }
      if (bootstrap.status === 'unavailable') {
        sendError(res, 503, 'SESSION_UNAVAILABLE', 'Parent access is temporarily unavailable.');
        return;
      }
      const snapshot = await input.summaryService.overview(principalFrom(bootstrap.context));
      res.status(200).json({ success: true, data: { snapshot } });
    }),
  );

  router.post(
    '/students',
    asyncRoute(async (req, res) => {
      const authorized = await requireMutationPrincipal(req, res, input.sessions, clock());
      if (!authorized) return;
      const parsed = createSchema.parse(req.body);
      const command =
        parsed.display_name === undefined
          ? omitUndefinedDisplayName(parsed)
          : { ...parsed, display_name: parsed.display_name };
      const context = await mutationContext(
        req,
        'student_created',
        command,
        clock(),
        input.fingerprintPasswordForIdempotency,
      );
      const result = await input.service.createStudent(authorized, command, context);
      sendMutation(res, result, 201);
    }),
  );

  router.patch(
    '/students/:studentId',
    asyncRoute(async (req, res) => {
      const authorized = await requireMutationPrincipal(req, res, input.sessions, clock());
      if (!authorized) return;
      const student_id = studentIdSchema.parse(req.params.studentId);
      const body = updateSchema.parse(req.body);
      const command =
        body.display_name === undefined
          ? { ...omitUndefinedDisplayName(body), student_id }
          : { ...body, display_name: body.display_name, student_id };
      const context = await mutationContext(
        req,
        'student_profile_updated',
        command,
        clock(),
        input.fingerprintPasswordForIdempotency,
      );
      sendMutation(res, await input.service.updateStudent(authorized, command, context));
    }),
  );

  router.post(
    '/students/:studentId/archive',
    asyncRoute(async (req, res) => {
      const authorized = await requireMutationPrincipal(req, res, input.sessions, clock());
      if (!authorized) return;
      const command = {
        ...lifecycleSchema.parse(req.body),
        student_id: studentIdSchema.parse(req.params.studentId),
      };
      const context = await mutationContext(
        req,
        'student_archived',
        command,
        clock(),
        input.fingerprintPasswordForIdempotency,
      );
      sendMutation(res, await input.service.archiveStudent(authorized, command, context));
    }),
  );

  router.post(
    '/students/:studentId/restore',
    asyncRoute(async (req, res) => {
      const authorized = await requireMutationPrincipal(req, res, input.sessions, clock());
      if (!authorized) return;
      const command = {
        ...lifecycleSchema.parse(req.body),
        student_id: studentIdSchema.parse(req.params.studentId),
      };
      const context = await mutationContext(
        req,
        'student_restored',
        command,
        clock(),
        input.fingerprintPasswordForIdempotency,
      );
      sendMutation(res, await input.service.restoreStudent(authorized, command, context));
    }),
  );

  router.post(
    '/students/:studentId/credential-reset',
    asyncRoute(async (req, res) => {
      const authorized = await requireMutationPrincipal(req, res, input.sessions, clock());
      if (!authorized) return;
      const command = {
        ...resetSchema.parse(req.body),
        student_id: studentIdSchema.parse(req.params.studentId),
      };
      const context = await mutationContext(
        req,
        'student_credential_reset',
        command,
        clock(),
        input.fingerprintPasswordForIdempotency,
      );
      sendMutation(res, await input.service.resetStudentCredential(authorized, command, context));
    }),
  );

  router.use(errorHandler);
  return router;
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

function principalFrom(context: V21ParentSessionContext): ParentHouseholdPrincipal {
  if (
    !context.household ||
    context.session.activeRole !== 'parent' ||
    context.session.activeHouseholdId !== context.household.householdId ||
    context.household.ownerRelationship !== 'account_owner'
  ) {
    throw new ParentHouseholdError(
      PARENT_HOUSEHOLD_ERROR_CODES.scopeDenied,
      'This Parent household is unavailable.',
    );
  }
  return {
    role: 'parent',
    adult_id: context.adultId,
    household_id: context.household.householdId,
    session_id: context.session.sessionId,
  };
}

async function mutationContext(
  req: Request,
  operation: ParentHouseholdMutationOperation,
  command: unknown,
  now: Date,
  fingerprintPasswordForIdempotency: (password: string) => Promise<string>,
): Promise<ParentHouseholdMutationContext> {
  const idempotencyKey = req.header('x-idempotency-key');
  if (!idempotencyKey || !IDEMPOTENCY_KEY.test(idempotencyKey)) {
    throw new ParentHouseholdError(
      PARENT_HOUSEHOLD_ERROR_CODES.invalidInput,
      'A valid idempotency key is required.',
    );
  }
  const requestBinding = await requestBindingCommand(command, fingerprintPasswordForIdempotency);
  return {
    idempotency_key: idempotencyKey,
    canonical_request_hash: createHash('sha256')
      .update(stableJson({ operation, command: requestBinding }), 'utf8')
      .digest('hex'),
    occurred_at: now.toISOString(),
  };
}

async function requestBindingCommand(
  command: unknown,
  fingerprintPasswordForIdempotency: (password: string) => Promise<string>,
) {
  if (
    !command ||
    typeof command !== 'object' ||
    Array.isArray(command) ||
    typeof (command as Record<string, unknown>).new_password !== 'string'
  ) {
    return command;
  }
  const password = (command as Record<string, unknown>).new_password as string;
  const passwordFingerprint = await fingerprintPasswordForIdempotency(password);
  if (!SHA256.test(passwordFingerprint)) {
    throw new Error('The Parent credential request fingerprint is unavailable.');
  }
  const requestBinding = { ...(command as Record<string, unknown>) };
  delete requestBinding.new_password;
  delete requestBinding.password_confirmation;
  requestBinding.password_fingerprint = passwordFingerprint;
  return requestBinding;
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

function omitUndefinedDisplayName<T extends { display_name?: string | null | undefined }>(
  value: T,
): Omit<T, 'display_name'> {
  const rest = { ...value };
  delete rest.display_name;
  return rest;
}

function sendMutation(
  res: Response,
  result: Awaited<ReturnType<ParentHouseholdService['createStudent']>>,
  status = 200,
) {
  res.status(status).json({
    success: true,
    data: {
      snapshot: result.snapshot,
      credential_handoff: result.credential_handoff,
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
    sendError(res, 400, 'VALIDATION_ERROR', 'Please check the Student details.');
    return;
  }
  if (error instanceof ParentHouseholdError) {
    const status = statusFor(error.code);
    sendError(res, status, error.code, error.message);
    return;
  }
  if (error instanceof ParentSummaryError) {
    const status =
      error.code === 'parent_summary_role_denied'
        ? 403
        : error.code === 'parent_summary_scope_denied' || error.code === 'parent_summary_missing'
          ? 404
          : 500;
    sendError(res, status, error.code, error.message);
    return;
  }
  sendError(res, 500, 'PARENT_HOUSEHOLD_UNAVAILABLE', 'Parent access is temporarily unavailable.');
}

function statusFor(code: string) {
  if (
    code === PARENT_HOUSEHOLD_ERROR_CODES.scopeDenied ||
    code === PARENT_HOUSEHOLD_ERROR_CODES.householdMissing ||
    code === PARENT_HOUSEHOLD_ERROR_CODES.studentMissing
  ) {
    return 404;
  }
  if (code === PARENT_HOUSEHOLD_ERROR_CODES.accessInactive) return 403;
  if (
    code === PARENT_HOUSEHOLD_ERROR_CODES.conflict ||
    code === PARENT_HOUSEHOLD_ERROR_CODES.idempotencyConflict ||
    code === PARENT_HOUSEHOLD_ERROR_CODES.seatLimit ||
    code === PARENT_HOUSEHOLD_ERROR_CODES.lifecycleUnchanged
  ) {
    return 409;
  }
  if (
    code === PARENT_HOUSEHOLD_ERROR_CODES.invalidInput ||
    code === PARENT_HOUSEHOLD_ERROR_CODES.usernameUnavailable ||
    code === PARENT_HOUSEHOLD_ERROR_CODES.archived
  ) {
    return 400;
  }
  return 500;
}

function sendError(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ success: false, code, message });
}
