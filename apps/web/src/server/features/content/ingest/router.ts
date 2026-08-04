import { createHash } from 'node:crypto';

import express, { type Request, type Response } from 'express';
import { z, ZodError } from 'zod';

import {
  CONTENT_INGEST_MAX_CONCURRENT_PARTS,
  CONTENT_INGEST_PART_AUTHORIZATION_SECONDS,
  CONTENT_INGEST_PART_BYTES,
  type ContentIngestAdminActor,
  type MultipartUploadPlan,
  type UploadPartRecord,
  type UploadSessionRecord,
} from '../../../../../../../packages/contracts/src/content/ingest/index.ts';
import {
  ContentIngestError,
  expectedUploadPart,
  stableIngestKey,
} from '../../../../../../../packages/domain/src/content/ingest/index.ts';
import type { AwsS3ManagedOriginalAdapter } from '../../../../../../../packages/db/src/content/ingest/s3-managed-original-adapter.ts';
import { createContentIngestService } from './service.ts';

export type ContentIngestRequestIdentity = {
  actor: ContentIngestAdminActor;
  sessionKey: string;
};

export type ContentIngestIdentityResolver = (
  req: Request,
) => Promise<ContentIngestRequestIdentity | null>;

export type ContentIngestCsrfVerifier = (
  req: Request,
  identity: ContentIngestRequestIdentity,
) => Promise<boolean>;

export type ContentIngestServicePort = Pick<
  ReturnType<typeof createContentIngestService>,
  'beginDirectUpload' | 'recordUploadPart' | 'confirmDirectUpload'
>;

export type ContentIngestStateReader = {
  getUploadSession(
    actor: ContentIngestAdminActor,
    uploadSessionId: string,
  ): Promise<UploadSessionRecord | null>;
  listUploadParts(
    actor: ContentIngestAdminActor,
    uploadSessionId: string,
  ): Promise<readonly UploadPartRecord[]>;
};

export type ManagedOriginalWebPort = Pick<
  AwsS3ManagedOriginalAdapter,
  'beginDirectUpload' | 'authorizePart' | 'recordCompletedPart' | 'completeAndReadBack'
>;

export type ContentIngestRouterInput = {
  enabled: boolean;
  authorizationId: string | undefined;
  canaryId: string | undefined;
  runtimeTier: 'isolated_staging' | 'production';
  verificationEnvironmentId: string;
  service: ContentIngestServicePort;
  state: ContentIngestStateReader;
  managedOriginal: ManagedOriginalWebPort;
  resolveIdentity: ContentIngestIdentityResolver;
  verifyCsrf: ContentIngestCsrfVerifier;
  clock?: (() => Date) | undefined;
};

const beginSchema = z
  .object({
    file_name: z.string().trim().min(1).max(240),
    mime_type: z.string().trim().min(1).max(120),
    byte_count: z.number().int().positive(),
  })
  .strict();
const partSchema = z
  .object({
    expected_version: z.number().int().positive(),
    byte_count: z.number().int().positive(),
    part_sha256: z.string().regex(/^[a-f0-9]{64}$/u),
  })
  .strict();
const completedPartSchema = partSchema
  .extend({ provider_part_ref: z.string().trim().min(1).max(500) })
  .strict();
const confirmSchema = z
  .object({
    expected_version: z.number().int().positive(),
    idempotency_key: z.string().trim().min(8).max(160),
  })
  .strict();

export function createContentIngestRouter(input: ContentIngestRouterInput) {
  const router = express.Router();
  const clock = input.clock ?? (() => new Date());

  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  router.post('/sessions', (req, res) =>
    handle(res, async () => {
      const identity = await authorize(input, req, res);
      if (!identity) return;
      const body = beginSchema.parse(req.body);
      const binding = serverBeginBinding(input, identity.actor);
      const occurredAt = validNow(clock);
      const requestHash = digest({
        operation: 'direct_upload:begin',
        actor: identity.actor,
        fileName: body.file_name,
        mimeType: body.mime_type,
        byteCount: body.byte_count,
        controlBindingDigest: binding.controlBindingDigest,
      });
      const result = await input.service.beginDirectUpload({
        actor: identity.actor,
        runtimeTier: input.runtimeTier,
        verificationEnvironmentId: input.verificationEnvironmentId,
        displayFilename: body.file_name,
        mimeType: body.mime_type,
        declaredByteCount: body.byte_count,
        idempotencyKey: binding.idempotencyKey,
        requestHash,
        occurredAt,
      });
      const session =
        result.session ??
        (await input.state.getUploadSession(
          identity.actor,
          stableUploadSessionId(identity.actor, binding.idempotencyKey),
        ));
      if (!session) throw new Error('content_ingest_replay_session_missing');
      if (!result.replay) {
        await input.managedOriginal.beginDirectUpload({
          uploadSessionId: session.id,
          opaqueObjectKey: session.opaqueObjectKey,
          byteCount: session.declaredByteCount,
          mimeType: session.mimeType,
        });
      }
      res.status(result.replay ? 200 : 201).json({
        success: true,
        replay: result.replay,
        data: { session: browserUploadSession(session), plan: result.plan ?? planFor(session) },
      });
    }),
  );

  router.post('/sessions/:uploadSessionId/parts/:partNumber/authorize', (req, res) =>
    handle(res, async () => {
      const identity = await authorize(input, req, res);
      if (!identity) return;
      const body = partSchema.parse(req.body);
      const session = await requireSession(input, identity.actor, routeId(req, 'uploadSessionId'));
      assertSessionVersion(session, body.expected_version);
      assertPartSize(session, routePart(req), body.byte_count);
      const authorization = await input.managedOriginal.authorizePart({
        uploadSessionId: session.id,
        partNumber: routePart(req),
        byteCount: body.byte_count,
        partSha256: body.part_sha256,
      });
      res.json({ success: true, data: authorization });
    }),
  );

  router.post('/sessions/:uploadSessionId/parts/:partNumber/complete', (req, res) =>
    handle(res, async () => {
      const identity = await authorize(input, req, res);
      if (!identity) return;
      const body = completedPartSchema.parse(req.body);
      const uploadSessionId = routeId(req, 'uploadSessionId');
      const session = await requireSession(input, identity.actor, uploadSessionId);
      assertSessionVersion(session, body.expected_version);
      assertPartSize(session, routePart(req), body.byte_count);
      const provider = await input.managedOriginal.recordCompletedPart({
        uploadSessionId,
        partNumber: routePart(req),
        byteCount: body.byte_count,
        partSha256: body.part_sha256,
        providerPartRef: body.provider_part_ref,
      });
      const result = await input.service.recordUploadPart({
        actor: identity.actor,
        uploadSessionId,
        expectedVersion: body.expected_version,
        partNumber: routePart(req),
        byteCount: body.byte_count,
        partSha256: body.part_sha256,
        providerPartRefDigest: provider.providerPartRefDigest,
        occurredAt: validNow(clock),
      });
      res.json({
        success: true,
        replay: result.replay,
        data: { session: browserUploadSession(result.session) },
      });
    }),
  );

  router.post('/sessions/:uploadSessionId/confirm', (req, res) =>
    handle(res, async () => {
      const identity = await authorize(input, req, res);
      if (!identity) return;
      const body = confirmSchema.parse(req.body);
      const uploadSessionId = routeId(req, 'uploadSessionId');
      const session = await requireSession(input, identity.actor, uploadSessionId);
      assertSessionVersion(session, body.expected_version);
      const parts = await input.state.listUploadParts(identity.actor, uploadSessionId);
      const orderedParts = [...parts].sort((left, right) => left.partNumber - right.partNumber);
      if (
        session.completedParts !== session.totalParts ||
        orderedParts.length !== session.totalParts ||
        orderedParts.some((part, index) => part.partNumber !== index + 1)
      ) {
        throw new Error('content_ingest_incomplete_parts');
      }
      const completed = await input.managedOriginal.completeAndReadBack({
        uploadSessionId,
        orderedProviderPartRefDigests: orderedParts.map((part) => part.providerPartRefDigest),
      });
      const occurredAt = validNow(clock);
      const requestHash = digest({
        operation: 'direct_upload:confirm',
        uploadSessionId,
        fullSha256: completed.readback.sha256,
      });
      const result = await input.service.confirmDirectUpload({
        actor: identity.actor,
        uploadSessionId,
        expectedVersion: body.expected_version,
        fullSha256: completed.readback.sha256,
        idempotencyKey: body.idempotency_key,
        requestHash,
        readback: completed.readback,
        journalReceipt: completed.journalReceipt,
        retentionDueAt: new Date(Date.parse(occurredAt) + 10 * 365 * 86_400_000).toISOString(),
        occurredAt,
      });
      res.json({ success: true, replay: result.replay, data: { source: result.source } });
    }),
  );

  return router;
}

async function authorize(
  input: ContentIngestRouterInput,
  req: Request,
  res: Response,
): Promise<ContentIngestRequestIdentity | null> {
  const identity = await input.resolveIdentity(req);
  if (!identity || identity.actor.role !== 'admin') {
    res.status(401).json({ success: false, code: 'content_ingest_access_denied' });
    return null;
  }
  if (!(await input.verifyCsrf(req, identity))) {
    res.status(403).json({ success: false, code: 'content_ingest_csrf_denied' });
    return null;
  }
  if (!input.enabled) {
    res.status(503).json({ success: false, code: 'content_media_default_off' });
    return null;
  }
  return identity;
}

async function requireSession(
  input: ContentIngestRouterInput,
  actor: ContentIngestAdminActor,
  uploadSessionId: string,
) {
  const session = await input.state.getUploadSession(actor, uploadSessionId);
  if (!session || session.actorId !== actor.principalId) {
    throw new Error('content_ingest_upload_session_not_found');
  }
  return session;
}

function assertSessionVersion(session: UploadSessionRecord, expectedVersion: number) {
  if (session.version !== expectedVersion) throw new Error('content_ingest_stale_version');
}

function browserUploadSession(
  session: UploadSessionRecord,
): Omit<UploadSessionRecord, 'idempotencyKey' | 'requestHash'> {
  const browserSession: Record<string, unknown> = { ...session };
  delete browserSession.idempotencyKey;
  delete browserSession.requestHash;
  return browserSession as Omit<UploadSessionRecord, 'idempotencyKey' | 'requestHash'>;
}

function assertPartSize(session: UploadSessionRecord, partNumber: number, byteCount: number) {
  if (expectedUploadPart(session, partNumber).byteCount !== byteCount) {
    throw new Error('content_ingest_part_size_invalid');
  }
}

function routeId(req: Request, key: string) {
  const value = req.params[key];
  if (typeof value !== 'string' || value.length < 1 || value.length > 200) {
    throw new Error('content_ingest_route_id_invalid');
  }
  return value;
}

function routePart(req: Request) {
  const value = Number(routeId(req, 'partNumber'));
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error('content_ingest_part_number_invalid');
  return value;
}

function validNow(clock: () => Date) {
  const value = clock();
  if (Number.isNaN(value.getTime())) throw new Error('content_ingest_clock_invalid');
  return value.toISOString();
}

function digest(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function serverBeginBinding(input: ContentIngestRouterInput, actor: ContentIngestAdminActor) {
  if (!input.authorizationId || !input.canaryId) {
    throw new Error('content_media_server_binding_unavailable');
  }
  const controlBindingDigest = digest({
    authorizationId: input.authorizationId,
    canaryId: input.canaryId,
  });
  return {
    controlBindingDigest,
    idempotencyKey: stableIngestKey('media_canary', [
      actor.accountKey,
      actor.productKey,
      actor.principalId,
      controlBindingDigest,
    ]),
  };
}

function stableUploadSessionId(actor: ContentIngestAdminActor, idempotencyKey: string) {
  return stableIngestKey('upload', [actor.accountKey, actor.productKey, idempotencyKey]);
}

function planFor(session: UploadSessionRecord): MultipartUploadPlan {
  return {
    uploadSessionId: session.id,
    partBytes: CONTENT_INGEST_PART_BYTES,
    totalParts: session.totalParts,
    maxConcurrentParts: CONTENT_INGEST_MAX_CONCURRENT_PARTS,
    authorizationTtlSeconds: CONTENT_INGEST_PART_AUTHORIZATION_SECONDS,
    expiresAt: session.expiresAt,
  };
}

async function handle(res: Response, run: () => Promise<void>) {
  try {
    await run();
  } catch (error) {
    if (res.headersSent) return;
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, code: 'content_ingest_invalid_request' });
      return;
    }
    if (error instanceof ContentIngestError) {
      res.status(error.code.includes('not_found') ? 404 : 409).json({
        success: false,
        code: error.code,
        message: error.message,
      });
      return;
    }
    res.status(409).json({
      success: false,
      code: error instanceof Error ? error.message : 'content_ingest_failed_closed',
    });
  }
}
