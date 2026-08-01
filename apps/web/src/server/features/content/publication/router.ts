import express, { type Request } from 'express';
import { z, ZodError } from 'zod';
import type {
  ContentPublicationCommandBinding,
  ContentPublicationPrincipal,
  ContentPublicationRecord,
  StudentPlaybackGrant,
} from '../../../../../../../packages/contracts/src/content/publication/index.ts';
import {
  CONTENT_PUBLICATION_ERROR_CODES,
  ContentPublicationError,
} from '../../../../../../../packages/domain/src/content/publication/index.ts';
import { createContentPublicationService } from './service.ts';

export type ContentPublicationServicePort = Pick<
  ReturnType<typeof createContentPublicationService>,
  | 'registerApprovedProjection'
  | 'approve'
  | 'requestPublish'
  | 'attachOccurrence'
  | 'unpublish'
  | 'archive'
  | 'library'
  | 'playback'
  | 'saveResume'
> & {
  resolveResumeExpectedVersion(input: {
    principal: ContentPublicationPrincipal;
    contentId: string;
  }): Promise<number | null>;
};

export type ContentPublicationRequestIdentity = {
  principal: ContentPublicationPrincipal;
  sessionKey: string;
};

export type ContentPublicationIdentityResolver = (
  req: Request,
) => Promise<ContentPublicationRequestIdentity | null>;

export type ContentPublicationCsrfVerifier = (
  req: Request,
  identity: ContentPublicationRequestIdentity,
) => Promise<boolean>;

export type ContentPublicationRouterInput = {
  service: ContentPublicationServicePort;
  resolveIdentity: ContentPublicationIdentityResolver;
  verifyCsrf: ContentPublicationCsrfVerifier;
  clock?: (() => Date) | undefined;
};

const registerProjectionSchema = z
  .object({ content_version_id: z.string().trim().min(1).max(200) })
  .strict();
const commandBindingSchema = z
  .object({
    expected_version: z.number().int().min(1),
    idempotency_key: z.string().trim().min(8).max(160),
  })
  .strict();
const approveSchema = commandBindingSchema
  .extend({
    approval_id: z.string().trim().min(1).max(200),
    policy_version: z.string().trim().min(1).max(120),
  })
  .strict();
const attachSchema = commandBindingSchema
  .extend({
    relation_id: z.string().trim().min(1).max(200),
    occurrence_id: z.string().trim().min(1).max(200),
    occurrence_version: z.number().int().min(1),
    canonical_series_id: z.string().trim().min(1).max(200),
  })
  .strict();
const searchSchema = z.object({ query: z.string().max(120).default('') }).strict();
const emptyCommandSchema = z.object({}).strict();
const resumeSchema = z
  .object({
    position_ms: z.number().int().min(0),
    idempotency_key: z.string().trim().min(8).max(160),
  })
  .strict();

export function createContentPublicationRouter(input: ContentPublicationRouterInput) {
  const router = express.Router();
  const clock = input.clock ?? (() => new Date());

  router.use((_req, res, next) => {
    setPrivateNoStore(res);
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  router.post('/app/content/publication/approved-projections', async (req, res) => {
    await handle(req, res, async () => {
      const identity = await requireIdentity(input, req, res, 'admin');
      if (!identity || !(await requireCsrf(input, req, res, identity))) return;
      const payload = registerProjectionSchema.parse(req.body);
      const result = await input.service.registerApprovedProjection({
        principal: identity.principal,
        contentVersionId: payload.content_version_id,
      });
      res.status(result.replay ? 200 : 201).json({
        success: true,
        replay: result.replay,
        data: safeAdminRecord(result.record),
      });
    });
  });

  router.post('/app/content/publication/:contentId/approve', async (req, res) => {
    await handleAdminCommand(input, req, res, clock, approveSchema, async (identity, body) =>
      input.service.approve({
        principal: identity.principal,
        contentId: routeId(req.params.contentId),
        approvalId: body.approval_id,
        policyVersion: body.policy_version,
        binding: binding(body, clock),
      }),
    );
  });

  router.post('/app/content/publication/:contentId/publish', async (req, res) => {
    await handleAdminCommand(input, req, res, clock, commandBindingSchema, async (identity, body) =>
      input.service.requestPublish({
        principal: identity.principal,
        contentId: routeId(req.params.contentId),
        binding: binding(body, clock),
      }),
    );
  });

  router.post('/app/content/publication/:contentId/attachments', async (req, res) => {
    await handleAdminCommand(input, req, res, clock, attachSchema, async (identity, body) =>
      input.service.attachOccurrence({
        principal: identity.principal,
        contentId: routeId(req.params.contentId),
        relation: {
          relationId: body.relation_id,
          occurrenceId: body.occurrence_id,
          occurrenceVersion: body.occurrence_version,
          canonicalSeriesId: body.canonical_series_id,
        },
        binding: binding(body, clock),
      }),
    );
  });

  router.post('/app/content/publication/:contentId/unpublish', async (req, res) => {
    await handleAdminCommand(input, req, res, clock, commandBindingSchema, async (identity, body) =>
      input.service.unpublish({
        principal: identity.principal,
        contentId: routeId(req.params.contentId),
        binding: binding(body, clock),
      }),
    );
  });

  router.post('/app/content/publication/:contentId/archive', async (req, res) => {
    await handleAdminCommand(input, req, res, clock, commandBindingSchema, async (identity, body) =>
      input.service.archive({
        principal: identity.principal,
        contentId: routeId(req.params.contentId),
        binding: binding(body, clock),
      }),
    );
  });

  router.post('/app/student/library/search', async (req, res) => {
    await handle(req, res, async () => {
      const identity = await requireIdentity(input, req, res, 'student');
      if (!identity || !(await requireCsrf(input, req, res, identity))) return;
      const payload = searchSchema.parse(req.body);
      const items = await input.service.library({
        principal: identity.principal,
        query: payload.query,
      });
      res.json({ success: true, data: { items } });
    });
  });

  for (const operation of ['bootstrap', 'renew'] as const) {
    router.post(`/app/student/library/:contentId/${operation}`, async (req, res) => {
      await handle(req, res, async () => {
        const identity = await requireIdentity(input, req, res, 'student');
        if (!identity || !(await requireCsrf(input, req, res, identity))) return;
        emptyCommandSchema.parse(req.body ?? {});
        const grant = await input.service.playback({
          principal: identity.principal,
          contentId: routeId(req.params.contentId),
          now: validClock(clock),
        });
        res.json({ success: true, data: safePlaybackGrant(grant) });
      });
    });
  }

  router.get('/v1/student/library/:contentId/playback', async (req, res) => {
    await handle(req, res, async () => {
      const identity = await requireIdentity(input, req, res, 'student');
      if (!identity) return;
      const grant = await input.service.playback({
        principal: identity.principal,
        contentId: routeId(req.params.contentId),
        now: validClock(clock),
      });
      res.json({
        success: true,
        data: {
          authorized: true,
          content_id: grant.contentId,
          playback_session_id: grant.playbackSessionId,
          expires_at: grant.expiresAt,
        },
      });
    });
  });

  router.post('/app/student/library/:contentId/resume', async (req, res) => {
    await handle(req, res, async () => {
      const identity = await requireIdentity(input, req, res, 'student');
      if (!identity || !(await requireCsrf(input, req, res, identity))) return;
      const payload = resumeSchema.parse(req.body);
      const expectedVersion = await input.service.resolveResumeExpectedVersion({
        principal: identity.principal,
        contentId: routeId(req.params.contentId),
      });
      if (expectedVersion === null) {
        neutralUnavailable(res);
        return;
      }
      const resume = await input.service.saveResume({
        principal: identity.principal,
        contentId: routeId(req.params.contentId),
        positionMs: payload.position_ms,
        binding: binding(
          {
            expected_version: expectedVersion,
            idempotency_key: payload.idempotency_key,
          },
          clock,
        ),
      });
      res.json({
        success: true,
        data: {
          content_id: resume.contentId,
          position_ms: resume.positionMs,
          version: resume.version,
          updated_at: resume.updatedAt,
        },
      });
    });
  });

  return router;
}

async function handleAdminCommand<T extends z.ZodTypeAny>(
  input: ContentPublicationRouterInput,
  req: express.Request,
  res: express.Response,
  clock: () => Date,
  schema: T,
  command: (
    identity: ContentPublicationRequestIdentity,
    body: z.infer<T>,
  ) => Promise<{ record: ContentPublicationRecord; replay: boolean }>,
) {
  await handle(req, res, async () => {
    const identity = await requireIdentity(input, req, res, 'admin');
    if (!identity || !(await requireCsrf(input, req, res, identity))) return;
    const result = await command(identity, schema.parse(req.body));
    res.json({ success: true, replay: result.replay, data: safeAdminRecord(result.record) });
  });
}

async function requireIdentity(
  input: ContentPublicationRouterInput,
  req: Request,
  res: express.Response,
  role: 'admin' | 'student',
) {
  const identity = await input.resolveIdentity(req);
  if (!identity) {
    res.status(401).json({ success: false, code: 'UNAUTHENTICATED', message: 'Please log in.' });
    return null;
  }
  if (identity.principal.role !== role) {
    if (role === 'student') return neutralUnavailable(res);
    res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Access unavailable.' });
    return null;
  }
  return identity;
}

async function requireCsrf(
  input: ContentPublicationRouterInput,
  req: Request,
  res: express.Response,
  identity: ContentPublicationRequestIdentity,
) {
  if (await input.verifyCsrf(req, identity)) return true;
  res
    .status(403)
    .json({ success: false, code: 'CSRF_REQUIRED', message: 'Refresh and try again.' });
  return false;
}

async function handle(req: Request, res: express.Response, work: () => Promise<void>) {
  try {
    await work();
  } catch (error) {
    if (error instanceof ZodError) {
      res
        .status(400)
        .json({ success: false, code: 'VALIDATION_ERROR', message: 'Check the request.' });
      return;
    }
    if (error instanceof ContentPublicationError) {
      if (
        error.code === CONTENT_PUBLICATION_ERROR_CODES.accessDenied ||
        error.code === CONTENT_PUBLICATION_ERROR_CODES.unavailable
      ) {
        neutralUnavailable(res);
        return;
      }
      const status =
        error.code === CONTENT_PUBLICATION_ERROR_CODES.invalidInput
          ? 400
          : error.code === CONTENT_PUBLICATION_ERROR_CODES.invalidState ||
              error.code === CONTENT_PUBLICATION_ERROR_CODES.conflict
            ? 409
            : 503;
      res.status(status).json({
        success: false,
        code: status === 409 ? 'PUBLICATION_CONFLICT' : 'PUBLICATION_UNAVAILABLE',
        message: 'Publication is unavailable.',
      });
      return;
    }
    res.status(503).json({
      success: false,
      code: 'PUBLICATION_UNAVAILABLE',
      message: 'Publication is unavailable.',
    });
  }
}

function neutralUnavailable(res: express.Response): null {
  res
    .status(404)
    .json({ success: false, code: 'CONTENT_UNAVAILABLE', message: 'Content is unavailable.' });
  return null;
}

function binding(
  payload: { expected_version: number; idempotency_key: string },
  clock: () => Date,
): ContentPublicationCommandBinding {
  return {
    expectedVersion: payload.expected_version,
    idempotencyKey: payload.idempotency_key,
    requestHash: '',
    occurredAt: validClock(clock).toISOString(),
  };
}

function safeAdminRecord(record: ContentPublicationRecord) {
  const actions: Record<ContentPublicationRecord['state'], readonly string[]> = {
    received: ['attach_occurrence', 'archive'],
    validating: ['attach_occurrence', 'archive'],
    processing: ['attach_occurrence', 'archive'],
    needs_review: ['approve', 'attach_occurrence', 'archive'],
    approved: ['publish', 'attach_occurrence', 'archive'],
    publishing: ['attach_occurrence'],
    published: ['unpublish', 'attach_occurrence', 'archive'],
    failed: ['archive'],
    archived: [],
  };
  return {
    content_id: record.contentId,
    content_version_id: record.contentVersionId,
    title: record.title,
    state: record.state,
    version: record.version,
    approved: record.approval !== null,
    published: record.state === 'published',
    allowed_actions: actions[record.state],
    occurrence_count: record.occurrenceRelations.length,
    updated_at: record.updatedAt,
  };
}

function safePlaybackGrant(grant: StudentPlaybackGrant) {
  return {
    content_id: grant.contentId,
    bootstrap_path: grant.bootstrapPath,
    issued_at: grant.issuedAt,
    expires_at: grant.expiresAt,
    renewable: grant.renewable,
  };
}

function routeId(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = z.string().trim().min(1).max(200).safeParse(candidate);
  if (!parsed.success) throw parsed.error;
  return parsed.data;
}

function validClock(clock: () => Date) {
  const now = clock();
  if (!Number.isFinite(now.getTime())) throw new Error('content_publication_clock_invalid');
  return now;
}

function setPrivateNoStore(res: express.Response) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.removeHeader('ETag');
  res.removeHeader('Last-Modified');
}
