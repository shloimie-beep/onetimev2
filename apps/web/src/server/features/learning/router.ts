import { randomUUID } from 'node:crypto';
import express, { type Request, type Response } from 'express';
import { z, ZodError } from 'zod';
import { LEARNING_ERROR_CODES } from '../../../../../../packages/contracts/src/learning/index.ts';
import { LearningError } from '../../../../../../packages/domain/src/learning/engagement.ts';
import type { AuthenticatedLearningActor } from './adapters.ts';
import type { LearningCompositionBlocker } from './composition.ts';
import type { createLearningEngagementService } from './service.ts';

type LearningService = ReturnType<typeof createLearningEngagementService>;
type LearningIdentityUnavailable = { unavailable: true };

const idempotencyKey = z.string().trim().min(8).max(512);
const auditRef = z.string().trim().min(1).max(512);
const classId = z.string().trim().min(1).max(256);
const questionSubmitSchema = z
  .object({
    body: z.string().trim().min(3).max(2_000),
    idempotency_key: idempotencyKey,
  })
  .strict();
const questionTransitionSchema = z
  .object({
    to: z.enum(['answered_private', 'approved_for_class', 'published', 'closed', 'declined']),
    answer: z.string().trim().min(1).max(4_000).optional(),
    reason: z.string().trim().min(3).max(1_000).optional(),
    expected_version: z.number().int().positive(),
    idempotency_key: idempotencyKey,
    audit_ref: auditRef,
  })
  .strict();
const recognitionCorrectionSchema = z
  .object({
    eligible: z.boolean(),
    reason: z.string().trim().min(3).max(1_000),
    expected_version: z.number().int().positive(),
    idempotency_key: idempotencyKey,
    audit_ref: auditRef,
  })
  .strict();
const announcementAudienceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('program') }).strict(),
  z.object({ kind: z.literal('class'), class_id: classId }).strict(),
  z
    .object({ kind: z.literal('parent'), class_id: classId, household_id: z.string().min(1) })
    .strict(),
  z
    .object({ kind: z.literal('student'), class_id: classId, student_id: z.string().min(1) })
    .strict(),
]);
const announcementSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    body: z.string().trim().min(1).max(4_000),
    audience: announcementAudienceSchema,
    expires_at: z.string().datetime().optional(),
  })
  .strict();
const reviewCompletionSchema = z
  .object({
    class_id: classId,
    source: z.enum(['authenticated_submit', 'authenticated_mark_complete']),
    idempotency_key: idempotencyKey,
    audit_ref: auditRef,
  })
  .strict();
const reviewCorrectionSchema = z
  .object({
    class_id: classId,
    student_id: z.string().trim().min(1).max(256),
    household_id: z.string().trim().min(1).max(256),
    action: z.enum(['revoked', 'restored']),
    reason: z.string().trim().min(3).max(1_000),
    idempotency_key: idempotencyKey,
    audit_ref: auditRef,
  })
  .strict();

export type LearningRouterInput = {
  service: LearningService;
  enabled: boolean;
  blockers?: readonly LearningCompositionBlocker[];
  resolveActor: (
    request: Request,
  ) => Promise<AuthenticatedLearningActor | LearningIdentityUnavailable | null>;
  verifyCsrf: (request: Request, authenticated: AuthenticatedLearningActor) => Promise<boolean>;
  clock?: () => Date;
  allocateId?: () => string;
};

export function createLearningRouter(input: LearningRouterInput): express.Router {
  const router = express.Router();
  const clock = input.clock ?? (() => new Date());
  const allocateId = input.allocateId ?? randomUUID;

  router.use((_req, res, next) => {
    setPrivateNoStore(res);
    next();
  });
  router.use((_req, res, next) => {
    if (input.enabled) {
      next();
      return;
    }
    res.status(503).json({
      success: false,
      code: 'LEARNING_UNAVAILABLE',
      message: 'Learning is not available yet.',
    });
  });

  router.get(
    '/questions',
    route(input, false, async (_req, res, authenticated) => {
      res.json({ success: true, data: await input.service.questions(authenticated.actor) });
    }),
  );

  router.get(
    '/student-snapshot',
    route(input, false, async (_req, res, authenticated) => {
      if (authenticated.actor.role !== 'student') {
        res.status(403).json(neutralDenied());
        return;
      }
      const selectedClassId = authenticated.actor.classIds[0] ?? null;
      const [questions, announcements] = await Promise.all([
        input.service.questions(authenticated.actor),
        input.service.announcements(authenticated.actor),
      ]);
      if (!selectedClassId) {
        res.json({
          success: true,
          data: {
            questions,
            publishedQuestions: [],
            announcements,
            badges: [],
            leaderboard: null,
          },
        });
        return;
      }
      const [publishedQuestions, badges, leaderboard] = await Promise.all([
        input.service.publishedClassQuestions(authenticated.actor, selectedClassId),
        input.service.badges(authenticated.actor, authenticated.actor.studentId, selectedClassId),
        input.service.leaderboard(authenticated.actor, selectedClassId),
      ]);
      res.json({
        success: true,
        data: { questions, publishedQuestions, announcements, badges, leaderboard },
      });
    }),
  );

  router.post(
    '/questions',
    route(input, true, async (req, res, authenticated) => {
      const body = questionSubmitSchema.parse(req.body);
      if (authenticated.actor.role !== 'student' || !authenticated.actor.classIds[0]) {
        res.status(403).json(neutralDenied());
        return;
      }
      const now = clock().toISOString();
      const result = await input.service.submitQuestion({
        actor: authenticated.actor,
        id: allocateId(),
        classId: authenticated.actor.classIds[0],
        body: body.body,
        idempotencyKey: body.idempotency_key,
        requestHash: '',
        auditRef: `student-question:${body.idempotency_key}`,
        occurredAt: now,
      });
      res.status(result.replay ? 200 : 201).json({ success: true, data: result });
    }),
  );

  router.post(
    '/questions/:questionId/transitions',
    route(input, true, async (req, res, authenticated) => {
      const body = questionTransitionSchema.parse(req.body);
      const result = await input.service.transitionQuestion({
        actor: authenticated.actor,
        questionId: requiredParam(req.params.questionId),
        to: body.to,
        ...(body.answer ? { answer: body.answer } : {}),
        ...(body.reason ? { reason: body.reason } : {}),
        expectedVersion: body.expected_version,
        idempotencyKey: body.idempotency_key,
        requestHash: '',
        auditRef: body.audit_ref,
        occurredAt: clock().toISOString(),
      });
      res.json({ success: true, data: result });
    }),
  );

  router.post(
    '/questions/:questionId/recognition-corrections',
    route(input, true, async (req, res, authenticated) => {
      const body = recognitionCorrectionSchema.parse(req.body);
      const result = await input.service.correctQuestionRecognition({
        actor: authenticated.actor,
        questionId: requiredParam(req.params.questionId),
        eligible: body.eligible,
        reason: body.reason,
        expectedVersion: body.expected_version,
        idempotencyKey: body.idempotency_key,
        requestHash: '',
        auditRef: body.audit_ref,
        occurredAt: clock().toISOString(),
      });
      res.json({ success: true, data: result });
    }),
  );

  router.get(
    '/classes/:classId/published-questions',
    route(input, false, async (req, res, authenticated) => {
      const data = await input.service.publishedClassQuestions(
        authenticated.actor,
        requiredParam(req.params.classId),
      );
      res.json({ success: true, data });
    }),
  );

  router.get(
    '/attendance',
    route(input, false, async (_req, res, authenticated) => {
      res.json({ success: true, data: await input.service.attendance(authenticated.actor) });
    }),
  );

  router.get(
    '/classes/:classId/students/:studentId/badges',
    route(input, false, async (req, res, authenticated) => {
      const data = await input.service.badges(
        authenticated.actor,
        requiredParam(req.params.studentId),
        requiredParam(req.params.classId),
      );
      res.json({ success: true, data });
    }),
  );

  router.get(
    '/classes/:classId/badges',
    route(input, false, async (req, res, authenticated) => {
      if (authenticated.actor.role !== 'student') {
        res.status(403).json(neutralDenied());
        return;
      }
      const data = await input.service.badges(
        authenticated.actor,
        authenticated.actor.studentId,
        requiredParam(req.params.classId),
      );
      res.json({ success: true, data });
    }),
  );

  router.get(
    '/announcements',
    route(input, false, async (_req, res, authenticated) => {
      res.json({ success: true, data: await input.service.announcements(authenticated.actor) });
    }),
  );

  router.post(
    '/announcements',
    route(input, true, async (req, res, authenticated) => {
      const body = announcementSchema.parse(req.body);
      const audience =
        body.audience.kind === 'program'
          ? body.audience
          : body.audience.kind === 'class'
            ? { kind: 'class' as const, classId: body.audience.class_id }
            : body.audience.kind === 'parent'
              ? {
                  kind: 'parent' as const,
                  classId: body.audience.class_id,
                  householdId: body.audience.household_id,
                }
              : {
                  kind: 'student' as const,
                  classId: body.audience.class_id,
                  studentId: body.audience.student_id,
                };
      const data = await input.service.publishAnnouncement({
        actor: authenticated.actor,
        id: allocateId(),
        title: body.title,
        body: body.body,
        audience,
        publishedAt: clock().toISOString(),
        ...(body.expires_at ? { expiresAt: body.expires_at } : {}),
      });
      res.status(201).json({ success: true, data });
    }),
  );

  router.post(
    '/announcements/:announcementId/read',
    route(input, true, async (req, res, authenticated) => {
      const data = await input.service.markAnnouncementRead(
        authenticated.actor,
        requiredParam(req.params.announcementId),
      );
      res.json({ success: true, data });
    }),
  );

  router.post(
    '/reviews/:reviewItemId/completions',
    route(input, true, async (req, res, authenticated) => {
      const body = reviewCompletionSchema.parse(req.body);
      const data = await input.service.recordReviewCompletion({
        actor: authenticated.actor,
        reviewItemId: requiredParam(req.params.reviewItemId),
        classId: body.class_id,
        source: body.source,
        auditRef: body.audit_ref,
        idempotencyKey: body.idempotency_key,
        requestHash: '',
        completedAt: clock().toISOString(),
      });
      res.json({ success: true, data });
    }),
  );

  router.post(
    '/reviews/:reviewItemId/completion-corrections',
    route(input, true, async (req, res, authenticated) => {
      const body = reviewCorrectionSchema.parse(req.body);
      const data = await input.service.correctReviewCompletion({
        actor: authenticated.actor,
        reviewItemId: requiredParam(req.params.reviewItemId),
        classId: body.class_id,
        studentId: body.student_id,
        householdId: body.household_id,
        action: body.action,
        reason: body.reason,
        auditRef: body.audit_ref,
        idempotencyKey: body.idempotency_key,
        requestHash: '',
        occurredAt: clock().toISOString(),
      });
      res.json({ success: true, data });
    }),
  );

  router.get(
    '/classes/:classId/leaderboard',
    route(input, false, async (req, res, authenticated) => {
      const data = await input.service.leaderboard(
        authenticated.actor,
        requiredParam(req.params.classId),
      );
      res.json({ success: true, data });
    }),
  );

  return router;
}

function route(
  input: LearningRouterInput,
  mutation: boolean,
  handler: (
    request: Request,
    response: Response,
    authenticated: AuthenticatedLearningActor,
  ) => Promise<void>,
) {
  return async (request: Request, response: Response) => {
    try {
      const authenticated = await input.resolveActor(request);
      if (authenticated && 'unavailable' in authenticated) {
        response
          .status(503)
          .json({
            success: false,
            code: 'LEARNING_UNAVAILABLE',
            message: 'Learning is temporarily unavailable.',
          });
        return;
      }
      if (!authenticated) {
        response.status(403).json(neutralDenied());
        return;
      }
      if (mutation && !(await input.verifyCsrf(request, authenticated))) {
        response.status(403).json({
          success: false,
          code: 'CSRF_REQUIRED',
          message: 'Refresh the page and try again.',
        });
        return;
      }
      await handler(request, response, authenticated);
    } catch (error) {
      handleLearningError(response, error);
    }
  };
}

function handleLearningError(response: Response, error: unknown) {
  if (error instanceof ZodError) {
    response.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Check the learning request and try again.',
    });
    return;
  }
  if (error instanceof LearningError) {
    if (
      error.code === LEARNING_ERROR_CODES.accessDenied ||
      error.code === LEARNING_ERROR_CODES.parentQuestionDenied
    ) {
      response.status(403).json(neutralDenied());
      return;
    }
    const status =
      error.code === LEARNING_ERROR_CODES.notFound
        ? 404
        : error.code === LEARNING_ERROR_CODES.conflict
          ? 409
          : 400;
    response.status(status).json({
      success: false,
      code: error.code,
      message: status === 404 ? 'Learning record unavailable.' : error.message,
    });
    return;
  }
  response.status(500).json({
    success: false,
    code: 'LEARNING_ERROR',
    message: 'Learning could not be loaded.',
  });
}

function neutralDenied() {
  return {
    success: false,
    code: 'LEARNING_ACCESS_DENIED',
    message: 'Learning access is unavailable.',
  } as const;
}

function setPrivateNoStore(response: Response) {
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Expires', '0');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.removeHeader('ETag');
}

function requiredParam(value: string | string[] | undefined): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 256) {
    throw new ZodError([]);
  }
  return value;
}
