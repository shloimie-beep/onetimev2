import { randomUUID } from 'node:crypto';
import express, { type Request, type Response } from 'express';
import { z, ZodError } from 'zod';
import type { AttendanceEvent } from '../../../../../../../packages/contracts/src/classroom/embedded/index.ts';
import { EmbeddedClassroomError } from '../../../../../../../packages/domain/src/classroom/embedded/index.ts';
import type {
  AdminAttendanceSubjectResolver,
  EmbeddedClassroomRequestIdentityResolver,
  VerifiedProviderAttendanceResolver,
} from './adapters.ts';
import { digestEmbeddedAttendanceEvidence, hashEmbeddedExchangeSecret } from './adapters.ts';
import type { EmbeddedClassroomService } from './service.ts';

const exchangeSecretSchema = z.object({ exchange_secret: z.string().min(32).max(512) }).strict();
const heartbeatSchema = z
  .object({
    lease_generation: z.number().int().positive(),
    expected_version: z.number().int().positive(),
  })
  .strict();
const clientAttendanceSchema = z
  .object({
    event_kind: z.enum(['joined', 'left']),
    idempotency_key: z.string().trim().min(8).max(512),
  })
  .strict();
const resetSchema = z
  .object({
    student_id: z.string().trim().min(1).max(256),
    idempotency_key: z.string().trim().min(8).max(512),
  })
  .strict();
const correctionSchema = z
  .object({
    student_id: z.string().trim().min(1).max(256),
    occurrence_id: z.string().trim().min(1).max(256),
    intervals: z
      .array(
        z.object({ joined_at: z.string().datetime(), left_at: z.string().datetime() }).strict(),
      )
      .min(1)
      .max(64),
    reason: z.string().trim().min(3).max(1_000),
    idempotency_key: z.string().trim().min(8).max(512),
  })
  .strict();

export type EmbeddedClassroomRouterInput = {
  service: EmbeddedClassroomService;
  identities: EmbeddedClassroomRequestIdentityResolver;
  providerAttendance: VerifiedProviderAttendanceResolver;
  adminAttendanceSubjects: AdminAttendanceSubjectResolver;
  clock?: () => Date;
  allocateId?: () => string;
};

export function createEmbeddedClassroomRouter(input: EmbeddedClassroomRouterInput) {
  const router = express.Router();
  const clock = input.clock ?? (() => new Date());
  const allocateId = input.allocateId ?? randomUUID;

  router.use((_request, response, next) => {
    setPrivateNoStore(response);
    next();
  });

  router.post(
    '/bootstrap',
    route(async (request, response) => {
      const body = exchangeSecretSchema.parse(request.body);
      const grantKeyDigest = hashEmbeddedExchangeSecret(body.exchange_secret);
      body.exchange_secret = '';
      if (request.body && typeof request.body === 'object') {
        (request.body as { exchange_secret?: unknown }).exchange_secret = '';
      }
      const identity = await input.identities.resolveStudent(request);
      if (identity === null || !identity.actor.csrf_verified) {
        response.status(403).json(neutralDenied('csrf_required'));
        return;
      }
      const result = await input.service.bootstrap({
        ...identity,
        grant_id: `p18-grant-${grantKeyDigest}`,
        grant_key_digest: grantKeyDigest,
        live_session_id: `p18-live-${allocateId()}`,
        now: clock(),
      });
      if (result.disposition === 'denied') {
        response
          .status(result.safe_code === 'bootstrap_unavailable' ? 503 : 403)
          .json(neutralDenied(result.safe_code));
        return;
      }
      response.json({
        success: true,
        data: {
          safe_code: result.safe_code,
          bootstrap: result.bootstrap,
          recording_capture_active: result.bootstrap.recording_capture_active,
          session: {
            lease_generation: result.session.lease_generation,
            version: result.session.version,
            lease_expires_at: result.session.lease_expires_at,
          },
        },
      });
    }),
  );

  router.post(
    '/heartbeat',
    route(async (request, response) => {
      const body = heartbeatSchema.parse(request.body);
      const identity = await input.identities.resolveStudent(request);
      if (identity === null || !identity.actor.csrf_verified) {
        response.status(403).json(neutralDenied('csrf_required'));
        return;
      }
      response.json({
        success: true,
        data: await input.service.heartbeat({ ...identity, ...body, now: clock() }),
      });
    }),
  );

  router.post(
    '/attendance/client',
    route(async (request, response) => {
      const body = clientAttendanceSchema.parse(request.body);
      const identity = await input.identities.resolveStudent(request);
      if (identity === null || !identity.actor.csrf_verified) {
        response.status(403).json(neutralDenied('csrf_required'));
        return;
      }
      const now = clock();
      await input.service.recordClientAttendance({
        ...identity,
        event_kind: body.event_kind,
        attendance_event_id: `p18-attendance-${allocateId()}`,
        idempotency_key: body.idempotency_key,
        source_event_ref_digest: digestEmbeddedAttendanceEvidence({
          source: 'embedded_client',
          event_kind: body.event_kind,
          idempotency_key: body.idempotency_key,
          observed_at: now.toISOString(),
        }),
        now,
      });
      response.status(202).json({ success: true, data: { disposition: 'accepted' } });
    }),
  );

  router.post(
    '/attendance/provider',
    route(async (request, response) => {
      const verified = await input.providerAttendance.verify(request);
      if (verified === null) {
        response.status(503).json(genericUnavailable());
        return;
      }
      await input.service.recordVerifiedProviderAttendance({ verified, now: clock() });
      response.status(202).json({ success: true, data: { disposition: 'accepted' } });
    }),
  );

  router.post(
    '/admin/reset',
    route(async (request, response) => {
      const body = resetSchema.parse(request.body);
      const identity = await input.identities.resolveAdmin(request);
      if (identity === null) {
        response.status(403).json(neutralDenied('authorization_changed'));
        return;
      }
      const actor = {
        role: 'admin' as const,
        admin_id: identity.admin_id,
        audit_ref: digestEmbeddedAttendanceEvidence({
          operation: 'classroom_launch_reset',
          admin_id: identity.admin_id,
          student_id: body.student_id,
          idempotency_key: body.idempotency_key,
        }),
      };
      response.json({
        success: true,
        data: await input.service.reset({
          scope: identity.scope,
          actor,
          student_id: body.student_id,
          now: clock(),
        }),
      });
    }),
  );

  router.post(
    '/attendance/admin-correction',
    route(async (request, response) => {
      const body = correctionSchema.parse(request.body);
      const identity = await input.identities.resolveAdmin(request);
      if (identity === null) {
        response.status(403).json(neutralDenied('authorization_changed'));
        return;
      }
      const subject = await input.adminAttendanceSubjects.resolve({
        scope: identity.scope,
        admin_id: identity.admin_id,
        occurrence_id: body.occurrence_id,
        student_id: body.student_id,
      });
      if (subject === null) {
        response.status(403).json(neutralDenied('authorization_changed'));
        return;
      }
      const auditRef = digestEmbeddedAttendanceEvidence({
        operation: 'attendance_admin_correction',
        admin_id: identity.admin_id,
        occurrence_id: subject.occurrence_id,
        student_id: subject.student_id,
        idempotency_key: body.idempotency_key,
      });
      const event: AttendanceEvent = {
        attendance_event_id: `p18-attendance-${allocateId()}`,
        scope: subject.scope,
        occurrence_id: subject.occurrence_id,
        student_id: subject.student_id,
        source: 'admin_correction',
        event_kind: 'manual_correction',
        observed_at: clock().toISOString(),
        connection_lineage_id: `admin-${auditRef}`,
        idempotency_key: body.idempotency_key,
        source_event_ref_digest: digestEmbeddedAttendanceEvidence(body),
        provider_verified: false,
        correction_intervals: body.intervals,
        correction_reason: body.reason,
        correction_admin_id: identity.admin_id,
        audit_ref: auditRef,
      };
      await input.service.recordAdminCorrection({
        actor: { role: 'admin', admin_id: identity.admin_id, audit_ref: auditRef },
        subject,
        event,
        now: clock(),
      });
      response.status(202).json({ success: true, data: { disposition: 'accepted' } });
    }),
  );

  return router;
}

function route(handler: (request: Request, response: Response) => Promise<void>) {
  return async (request: Request, response: Response) => {
    try {
      await handler(request, response);
    } catch (error) {
      handleError(response, error);
    }
  };
}

function handleError(response: Response, error: unknown): void {
  if (error instanceof ZodError) {
    response.status(400).json({
      success: false,
      code: 'CLASSROOM_REQUEST_INVALID',
      message: 'Check the classroom request and try again.',
    });
    return;
  }
  if (error instanceof EmbeddedClassroomError) {
    const status =
      error.code === 'bootstrap_unavailable' ? 503 : error.code === 'stale_write' ? 409 : 403;
    response.status(status).json(neutralDenied(error.code));
    return;
  }
  response.status(503).json(genericUnavailable());
}

function neutralDenied(code: string) {
  return {
    success: false,
    code,
    message: 'Classroom access is unavailable.',
  } as const;
}

function genericUnavailable() {
  return {
    success: false,
    code: 'CLASSROOM_UNAVAILABLE',
    message: 'Classroom access is unavailable.',
  } as const;
}

function setPrivateNoStore(response: Response): void {
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Expires', '0');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.removeHeader('ETag');
}
