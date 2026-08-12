import { createHash, randomUUID } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { z, ZodError } from 'zod';
import { isStudentPin } from '../../../../../../packages/contracts/src/identity/auth/index.ts';
import type {
  ConsentEvent,
  ConsentMutationInput,
  DataRightsRequest,
  PrivacyActorContext,
  PrivacyPolicyVersions,
  StudentConsentSubject,
} from '../../../../../../packages/contracts/src/privacy/index.ts';
import {
  currentConsentEvent,
  PrivacyError,
} from '../../../../../../packages/domain/src/privacy/index.ts';
import type { createPostgresPrivacyRepository } from '../../../../../../packages/db/src/privacy/repository.ts';
import { authorizePrivacyRoute, type createPrivacyService } from './privacy-service.ts';

type PrivacyRepository = ReturnType<typeof createPostgresPrivacyRepository>;
type PrivacyService = ReturnType<typeof createPrivacyService>;

export type SelfManagedStudentPrivacyPrincipal = {
  credential_id: string;
  adult_id: string;
  student_id: string;
  household_id: string;
  owner_adult_id: string;
  session_id: string;
  display_name: string;
};

const POLICIES: PrivacyPolicyVersions = {
  privacy_notice: 'privacy-notice-v2.1-2026-08-05',
  terms: 'terms-v2.1-2026-08-05',
  student_data_recording: 'student-data-recording-v2.1-2026-08-05',
  cancellation_refund: 'cancellation-refund-v2.1-2026-08-05',
};
const consentSchema = z
  .object({
    scope: z.enum(['recording_participation', 'member_recognition']),
    grant: z.boolean(),
  })
  .strict();
const rightsSchema = z
  .object({
    kind: z.enum(['export', 'correction', 'closure', 'erasure']),
    current_password: z
      .string()
      .min(1)
      .max(256)
      .refine((value) => isStudentPin(value) || value.length >= 8),
  })
  .strict();
const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/u;

export function createStudentPrivacyRouter(input: {
  service: PrivacyService;
  recordConsent(command: ConsentMutationInput): ReturnType<PrivacyService['recordConsent']>;
  repository: PrivacyRepository;
  scope: {
    product: 'one_time_mishnayos';
    runtime_tier: 'isolated_staging' | 'production';
    verification_environment_id: string;
  };
  resolvePrincipal(request: Request): Promise<SelfManagedStudentPrivacyPrincipal | null>;
  issueCsrfToken(request: Request, response: Response): Promise<string>;
  verifyCsrf(request: Request, principal: SelfManagedStudentPrivacyPrincipal): Promise<boolean>;
  verifyPasswordAttempt(
    request: Request,
    principal: SelfManagedStudentPrivacyPrincipal,
    password: string,
  ): Promise<
    | { status: 'verified' }
    | { status: 'invalid' }
    | { status: 'rate_limited'; retryAfterSeconds: number }
  >;
  networkEvidenceDigest(request: Request): string;
  clock?: () => Date;
  nextId?: () => string;
}) {
  const router = express.Router();
  const clock = input.clock ?? (() => new Date());
  const nextId = input.nextId ?? randomUUID;
  router.use(noStore);

  router.get(
    '/privacy',
    asyncRoute(async (req, res) => {
      const principal = await requiredPrincipal(input, req);
      res.status(200).json({
        success: true,
        data: {
          ...(await privacySnapshot(input, principal)),
          csrf_token: await input.issueCsrfToken(req, res),
        },
      });
    }),
  );

  router.post(
    '/privacy/consents',
    asyncRoute(async (req, res) => {
      const principal = await requiredMutationPrincipal(input, req);
      const command = consentSchema.parse(req.body);
      const occurredAt = clock().toISOString();
      await input.recordConsent({
        consent_event_id: `consent_${nextId()}`,
        idempotency_key: requiredIdempotencyKey(req),
        canonical_request_hash: sha256(
          stableJson({
            operation: 'self_student_privacy_consent',
            student_id: principal.student_id,
            scope: command.scope,
            grant: command.grant,
          }),
        ),
        actor: actorFrom(principal, false),
        subject: subjectFrom(principal),
        scope: command.scope,
        choice: command.grant ? 'granted' : 'withdrawn',
        policy_versions: POLICIES,
        occurred_at: occurredAt,
        request_correlation_id: `privacy_${nextId()}`,
        network_evidence_digest: input.networkEvidenceDigest(req),
        reason_code: command.grant
          ? 'adult_self_student_portal_grant'
          : 'adult_self_student_portal_withdrawal',
      });
      res.status(200).json({
        success: true,
        data: { snapshot: await privacySnapshot(input, principal) },
      });
    }),
  );

  router.post(
    '/privacy/requests',
    asyncRoute(async (req, res) => {
      const principal = await requiredMutationPrincipal(input, req);
      const command = rightsSchema.parse(req.body);
      const verification = await input.verifyPasswordAttempt(
        req,
        principal,
        command.current_password,
      );
      if (verification.status === 'rate_limited') {
        res.setHeader('Retry-After', String(verification.retryAfterSeconds));
        res.status(429).json({
          success: false,
          code: 'RATE_LIMITED',
          message: 'Too many recent credential checks. Try again later.',
          retry_after_seconds: verification.retryAfterSeconds,
        });
        return;
      }
      if (verification.status !== 'verified') {
        sendError(
          res,
          403,
          'RECENT_PASSWORD_REQUIRED',
          'The current Student credential was not verified.',
        );
        return;
      }
      const binding = sha256(`${principal.student_id}\0${requiredIdempotencyKey(req)}`);
      const disclosure = input.service.studentExportDisclosure();
      await input.service.createRightsRequest({
        request_id: `privacy_request_${binding.slice(0, 32)}`,
        kind: command.kind,
        subject: {
          kind: 'student',
          student_id: principal.student_id,
          household_id: principal.household_id,
          relationship: 'self',
          self_adult_id: principal.adult_id,
        },
        actor: actorFrom(principal, true),
        owner_adult_id: principal.owner_adult_id,
        requested_categories: disclosure.included,
        now: clock(),
        audit_ref: `privacy_audit_${binding.slice(32)}`,
      });
      res.status(202).json({
        success: true,
        data: { snapshot: await privacySnapshot(input, principal) },
      });
    }),
  );

  router.use(errorHandler);
  return router;
}

async function privacySnapshot(
  input: Parameters<typeof createStudentPrivacyRouter>[0],
  principal: SelfManagedStudentPrivacyPrincipal,
) {
  const events = await input.repository.listConsentEvents(principal.student_id);
  const requests = await input.repository.listDataRightsRequests({
    requester_ref: principal.credential_id,
    requester_household_id: principal.household_id,
    product: input.scope.product,
    runtime_tier: input.scope.runtime_tier,
    verification_environment_id: input.scope.verification_environment_id,
  });
  return {
    policy_versions: POLICIES,
    student: {
      student_id: principal.student_id,
      display_name: principal.display_name,
      relationship: 'self' as const,
      consents: consentViews(principal.student_id, events),
    },
    requests: requests.map(requestView).filter((request) => request.status !== null),
    export_disclosure: input.service.studentExportDisclosure(),
  };
}

function consentViews(studentId: string, events: readonly ConsentEvent[]) {
  return (
    [
      ['service_account', 'Student service account', true],
      ['recording_participation', 'Recorded-class participation', true],
      ['member_recognition', 'Named member recognition', false],
    ] as const
  ).map(([scope, label, required]) => {
    const current = currentConsentEvent(events, studentId, scope);
    return {
      scope,
      label,
      required,
      granted: current?.choice === 'granted',
      policy_version:
        scope === 'recording_participation'
          ? POLICIES.student_data_recording
          : POLICIES.privacy_notice,
      evidence_at: current?.occurred_at ?? null,
      consequence_preview:
        scope === 'service_account'
          ? 'Review only. This consent was established when your self-managed Student account was created.'
          : scope === 'recording_participation'
            ? 'Required before you may join a recorded class. Withdrawal revokes unused class-launch grants but does not block library playback.'
            : 'Optional. Withdrawal removes member-visible attribution without changing earned ranks or learning facts.',
      can_change: scope !== 'service_account',
    };
  });
}

function requestView(request: DataRightsRequest) {
  return {
    request_id: request.request_id,
    kind: request.kind,
    status: request.visible_status,
    exception_summary:
      request.legal_exception_codes.length === 0
        ? null
        : 'One or more retention or provider exceptions apply.',
    download_expires_at: null,
  };
}

async function requiredPrincipal(
  input: Parameters<typeof createStudentPrivacyRouter>[0],
  request: Request,
) {
  const principal = await input.resolvePrincipal(request);
  if (!principal) {
    throw new PrivacyError(
      'actor_scope_denied',
      'Student privacy is available only to the verified adult who owns this self-managed Student profile.',
    );
  }
  if (
    !authorizePrivacyRoute(
      actorFrom(principal, false),
      'self_student_privacy',
      subjectFrom(principal),
    )
  ) {
    throw new PrivacyError('actor_scope_denied', 'This Student privacy scope is unavailable.');
  }
  return principal;
}

async function requiredMutationPrincipal(
  input: Parameters<typeof createStudentPrivacyRouter>[0],
  request: Request,
) {
  const principal = await requiredPrincipal(input, request);
  if (!(await input.verifyCsrf(request, principal))) {
    throw new PrivacyError('actor_scope_denied', 'Refresh the Student portal and try again.');
  }
  return principal;
}

function subjectFrom(principal: SelfManagedStudentPrivacyPrincipal): StudentConsentSubject {
  return {
    student_id: principal.student_id,
    household_id: principal.household_id,
    relationship: 'self',
    owner_adult_id: principal.owner_adult_id,
    self_adult_id: principal.adult_id,
  };
}

function actorFrom(
  principal: SelfManagedStudentPrivacyPrincipal,
  recentPasswordVerified: boolean,
): PrivacyActorContext {
  return {
    role: 'student',
    account_or_credential_id: principal.credential_id,
    adult_id: principal.adult_id,
    student_id: principal.student_id,
    household_id: principal.household_id,
    recent_password_verified: recentPasswordVerified,
    session_id: principal.session_id,
  };
}

function requiredIdempotencyKey(req: Request) {
  const value = req.header('x-idempotency-key');
  if (!value || !IDEMPOTENCY_KEY.test(value)) {
    throw new PrivacyError('consent_conflict', 'A valid idempotency key is required.');
  }
  return value;
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

function sha256(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
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
    sendError(res, 400, 'VALIDATION_ERROR', 'Please check the Student privacy request.');
    return;
  }
  if (error instanceof PrivacyError) {
    const status = error.code === 'actor_scope_denied' ? 403 : 409;
    sendError(res, status, error.code, error.message);
    return;
  }
  if (error instanceof Error && error.message === 'privacy_request_write_conflict') {
    sendError(res, 409, 'PRIVACY_REQUEST_CONFLICT', 'This privacy request could not be replayed.');
    return;
  }
  sendError(
    res,
    500,
    'STUDENT_PRIVACY_UNAVAILABLE',
    'Student privacy controls are temporarily unavailable.',
  );
}

function sendError(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ success: false, code, message });
}

export const STUDENT_PRIVACY_POLICY_VERSIONS = POLICIES;
