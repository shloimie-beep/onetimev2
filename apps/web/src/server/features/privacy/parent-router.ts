import { createHash, randomUUID } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { z, ZodError } from 'zod';
import type {
  ConsentEvent,
  DataRightsRequest,
  PrivacyActorContext,
  PrivacyPolicyVersions,
} from '../../../../../../packages/contracts/src/privacy/index.ts';
import {
  currentConsentEvent,
  PrivacyError,
} from '../../../../../../packages/domain/src/privacy/index.ts';
import type { createPostgresPrivacyRepository } from '../../../../../../packages/db/src/privacy/repository.ts';
import type { V21AdultSessionRuntime, V21ParentSessionContext } from '../auth/v21-adult-session.ts';
import type {
  ParentPrivacySubject,
  createPostgresParentPrivacySubjectRepository,
} from './parent-subject-repository.ts';
import type { createPrivacyService } from './privacy-service.ts';

type PrivacyRepository = ReturnType<typeof createPostgresPrivacyRepository>;
type PrivacyService = ReturnType<typeof createPrivacyService>;
type SubjectRepository = ReturnType<typeof createPostgresParentPrivacySubjectRepository>;
const POLICIES: PrivacyPolicyVersions = {
  privacy_notice: 'privacy-notice-v2.1-2026-08-05',
  terms: 'terms-v2.1-2026-08-05',
  student_data_recording: 'student-data-recording-v2.1-2026-08-05',
  cancellation_refund: 'cancellation-refund-v2.1-2026-08-05',
};
const consentSchema = z
  .object({
    student_id: z.string().trim().min(1).max(160),
    scope: z.enum(['service_account', 'recording_participation', 'member_recognition']),
    grant: z.boolean(),
  })
  .strict();
const rightsSchema = z
  .object({
    kind: z.enum(['export', 'correction', 'closure', 'erasure']),
    current_password: z.string().min(6).max(128),
  })
  .strict();
const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/u;

export function createParentPrivacyRouter(input: {
  service: PrivacyService;
  repository: PrivacyRepository;
  subjects: SubjectRepository;
  sessions: Pick<V21AdultSessionRuntime, 'bootstrapCookieHeader' | 'verifyCsrf'>;
  scope: {
    product: 'one_time_mishnayos';
    runtime_tier: 'isolated_staging' | 'production';
    verification_environment_id: string;
  };
  verifyPassword(context: V21ParentSessionContext, password: string): Promise<boolean>;
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
      const bootstrap = await input.sessions.bootstrapCookieHeader({
        cookie_header: req.header('cookie'),
        now: clock(),
      });
      if (bootstrap.status === 'invalid') {
        sendError(res, 401, 'UNAUTHENTICATED', 'Please sign in again.');
        return;
      }
      if (bootstrap.status === 'unavailable') {
        sendError(res, 503, 'SESSION_UNAVAILABLE', 'Privacy controls are temporarily unavailable.');
        return;
      }
      const principal = principalFrom(bootstrap.context);
      res.status(200).json({
        success: true,
        data: {
          ...(await privacySnapshot(input, principal)),
          csrf_token: bootstrap.csrf_token,
        },
      });
    }),
  );

  router.post(
    '/privacy/consents',
    asyncRoute(async (req, res) => {
      const context = await requireMutationContext(req, res, input.sessions, clock());
      if (!context) return;
      const principal = principalFrom(context);
      const command = consentSchema.parse(req.body);
      const subject = await requiredSubject(input.subjects, principal, command.student_id);
      const occurredAt = clock().toISOString();
      await input.service.recordConsent({
        consent_event_id: `consent_${nextId()}`,
        idempotency_key: requiredIdempotencyKey(req),
        canonical_request_hash: sha256(
          stableJson({
            operation: 'parent_privacy_consent',
            household_id: principal.household_id,
            student_id: command.student_id,
            scope: command.scope,
            grant: command.grant,
          }),
        ),
        actor: actorFrom(context, false),
        subject,
        scope: command.scope,
        choice: command.grant ? 'granted' : 'withdrawn',
        policy_versions: POLICIES,
        occurred_at: occurredAt,
        request_correlation_id: `privacy_${nextId()}`,
        network_evidence_digest: input.networkEvidenceDigest(req),
        reason_code: command.grant ? 'parent_portal_grant' : 'parent_portal_withdrawal',
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
      const context = await requireMutationContext(req, res, input.sessions, clock());
      if (!context) return;
      const principal = principalFrom(context);
      const command = rightsSchema.parse(req.body);
      if (!(await input.verifyPassword(context, command.current_password))) {
        sendError(
          res,
          403,
          'RECENT_PASSWORD_REQUIRED',
          'The current Parent password was not verified.',
        );
        return;
      }
      const binding = sha256(`${principal.household_id}\0${requiredIdempotencyKey(req)}`);
      const disclosure = input.service.parentExportDisclosure();
      await input.service.createRightsRequest({
        request_id: `privacy_request_${binding.slice(0, 32)}`,
        kind: command.kind,
        subject: { kind: 'household', household_id: principal.household_id },
        actor: actorFrom(context, true),
        owner_adult_id: principal.adult_id,
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
  input: Parameters<typeof createParentPrivacyRouter>[0],
  principal: { adult_id: string; household_id: string; account_id: string; session_id: string },
) {
  const subjects = await input.subjects.list({
    household_id: principal.household_id,
    owner_adult_id: principal.adult_id,
  });
  const students = await Promise.all(
    subjects.map(async (subject) => {
      const events = await input.repository.listConsentEvents(subject.student_id);
      return {
        student_id: subject.student_id,
        display_name: subject.display_name,
        relationship: subject.relationship,
        state: subject.state,
        consents: consentViews(subject, events),
      };
    }),
  );
  const requests = await input.repository.listDataRightsRequests({
    requester_ref: principal.account_id,
    requester_household_id: principal.household_id,
    product: input.scope.product,
    runtime_tier: input.scope.runtime_tier,
    verification_environment_id: input.scope.verification_environment_id,
  });
  return {
    policy_versions: POLICIES,
    students,
    requests: requests.map(requestView).filter((request) => request.status !== null),
    export_disclosure: input.service.parentExportDisclosure(),
  };
}

function consentViews(subject: ParentPrivacySubject, events: readonly ConsentEvent[]) {
  return (
    [
      ['service_account', 'Student service account', true],
      ['recording_participation', 'Recorded-class participation', true],
      ['member_recognition', 'Named member recognition', false],
    ] as const
  ).map(([scope, label, required]) => {
    const current = currentConsentEvent(events, subject.student_id, scope);
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
          ? 'Required for a dependent Student account and protected learning access.'
          : scope === 'recording_participation'
            ? 'Required before this Student may join a recorded class.'
            : 'Optional. Without it, recognition stays anonymous.',
      can_change:
        subject.state === 'active' &&
        (subject.relationship === 'dependent' || scope === 'service_account'),
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

async function requiredSubject(
  repository: SubjectRepository,
  principal: { adult_id: string; household_id: string },
  studentId: string,
) {
  const subjects = await repository.list({
    household_id: principal.household_id,
    owner_adult_id: principal.adult_id,
  });
  const subject = subjects.find((candidate) => candidate.student_id === studentId);
  if (!subject || subject.state !== 'active') {
    throw new PrivacyError('actor_scope_denied', 'This Student privacy scope is unavailable.');
  }
  return subject;
}

async function requireMutationContext(
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
  return context;
}

function principalFrom(context: V21ParentSessionContext) {
  if (
    !context.household ||
    context.session.activeRole !== 'parent' ||
    context.session.activeHouseholdId !== context.household.householdId ||
    context.household.ownerRelationship !== 'account_owner'
  ) {
    throw new PrivacyError('actor_scope_denied', 'This Parent privacy scope is unavailable.');
  }
  return {
    adult_id: context.adultId,
    household_id: context.household.householdId,
    account_id: context.session.humanAccountId,
    session_id: context.session.sessionId,
  };
}

function actorFrom(
  context: V21ParentSessionContext,
  recentPasswordVerified: boolean,
): PrivacyActorContext {
  const principal = principalFrom(context);
  return {
    role: 'parent',
    account_or_credential_id: principal.account_id,
    adult_id: principal.adult_id,
    student_id: null,
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
    sendError(res, 400, 'VALIDATION_ERROR', 'Please check the privacy request.');
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
    'PARENT_PRIVACY_UNAVAILABLE',
    'Privacy controls are temporarily unavailable.',
  );
}

function sendError(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ success: false, code, message });
}

export const PARENT_PRIVACY_POLICY_VERSIONS = POLICIES;
