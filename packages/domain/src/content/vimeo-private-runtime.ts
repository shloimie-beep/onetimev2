import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  ot104rPlaybackProjectionSchema,
  ot104rVimeoReadinessSchema,
  ot104rVimeoRegisterCommandSchema,
  ot104rVimeoRegistrationResultSchema,
  type Ot104rPlaybackProjection,
  type Ot104rVimeoProcessingState,
  type Ot104rVimeoReadiness,
  type Ot104rVimeoRegisterCommand,
  type Ot104rVimeoRegistrationMode,
  type Ot104rVimeoRegistrationResult,
} from '../../../contracts/src/content/index.ts';
import type { DbPool, Queryable } from '../../../db/src/index.ts';
import { inTransaction } from '../../../db/src/index.ts';
import { canonicalJson, stableOt86Key } from './pipeline.ts';

export const OT104R_ACCOUNT_KEY = 'rabbi_sheller_provider';
export const OT104R_PRODUCT_KEY = 'one_time_mishnah_class';
export const OT104R_WEBHOOK_MAX_BYTES = 256 * 1024;
export const OT104R_TRANSCRIPT_MAX_BYTES = 1_000_000;

const OT104R_PROVIDER = 'vimeo';
const DEFAULT_LEASE_MS = 5 * 60_000;
const WEBHOOK_FRESHNESS_MS = 5 * 60_000;
const WEBHOOK_EVENT_ALLOWLIST = new Set([
  'video.created',
  'video.upload.complete',
  'video.upload.completed',
  'video.transcode.complete',
  'video.transcode.completed',
  'video.available',
  'video.transcode.error',
  'video.transcode.failed',
  'video.deleted',
  'texttrack.created',
  'texttrack.updated',
  'texttrack.deleted',
]);

export class Ot104rVimeoRuntimeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus = 400,
  ) {
    super(message);
  }
}

export type Ot104rVimeoVideoInspection = {
  providerVideoId: string;
  privacyState: 'private' | 'unlisted' | 'password' | 'review_required';
  processingState: 'uploading' | 'transcoding' | 'available' | 'failed';
  durationMs: number | null;
  width: number | null;
  height: number | null;
  revision: string | null;
  safeMetadata: Record<string, unknown>;
};

export type Ot104rVimeoUploadIntent = {
  providerUploadId: string;
  providerVideoId?: string | null;
  processingState: 'upload_authorized' | 'uploading' | 'transcoding';
  safeUploadTicketRef: string;
  safeMetadata: Record<string, unknown>;
};

export type Ot104rVimeoTextTrackSummary = {
  providerTextTrackId: string;
  language: string;
  kind: 'captions' | 'subtitles' | 'transcript';
  mimeType: string;
  revision: string;
  safeMetadata?: Record<string, unknown>;
};

export type Ot104rVimeoTextTrackDownload = Ot104rVimeoTextTrackSummary & {
  body: Buffer | string;
};

export type Ot104rVimeoAdapter = {
  readiness(): Promise<Ot104rVimeoReadiness>;
  registerExistingPrivateVideo(
    command: Ot104rVimeoRegisterCommand,
  ): Promise<Ot104rVimeoVideoInspection>;
  createUploadIntent(command: Ot104rVimeoRegisterCommand): Promise<Ot104rVimeoUploadIntent>;
  inspectVideo(providerVideoId: string): Promise<Ot104rVimeoVideoInspection>;
  listTextTracks(providerVideoId: string): Promise<Ot104rVimeoTextTrackSummary[]>;
  downloadTextTrack(
    providerVideoId: string,
    providerTextTrackId: string,
  ): Promise<Ot104rVimeoTextTrackDownload>;
};

export type Ot104rRealVimeoAdapterOptions = {
  env?: NodeJS.ProcessEnv | undefined;
  apiBaseUrl?: string | undefined;
  fetchImpl?: typeof fetch | undefined;
};

export type Ot104rVimeoWebhookReceiptResult = {
  status: 200 | 202 | 400 | 401 | 409 | 413 | 415 | 503;
  code:
    | 'accepted'
    | 'duplicate'
    | 'bad_request'
    | 'unauthorized'
    | 'payload_too_large'
    | 'unsupported_media_type'
    | 'conflict'
    | 'unknown_event_recorded'
    | 'wrong_account_ignored'
    | 'source_not_found_recorded'
    | 'storage_unavailable';
  message: string;
  receipt_state?: 'recorded' | 'processed' | 'duplicate' | 'conflict' | 'ignored';
};

export function inspectOt104rVimeoReadinessFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Ot104rVimeoReadiness {
  const mode = env.OT104R_VIMEO_PROVIDER_MODE === 'real' ? 'real' : 'off';
  const required = [
    'VIMEO_ACCESS_TOKEN',
    'VIMEO_CLIENT_ID',
    'VIMEO_CLIENT_SECRET',
    'VIMEO_ACCOUNT_ID',
    'VIMEO_WEBHOOK_SECRET',
  ];
  const missing = required.filter((key) => !env[key]);
  if (mode !== 'real') {
    return ot104rVimeoReadinessSchema.parse({
      provider: OT104R_PROVIDER,
      mode,
      state: 'off',
      configured: false,
      can_register_existing_private_video: false,
      can_create_controlled_upload: false,
      can_receive_webhooks: Boolean(env.VIMEO_WEBHOOK_SECRET),
      can_import_text_tracks: false,
      missing_variable_names: missing,
      capability_names: ['provider_off', 'sink_adapter_supported'],
      safe_reason_code: 'real_vimeo_provider_mode_disabled',
    });
  }
  if (missing.length > 0) {
    return ot104rVimeoReadinessSchema.parse({
      provider: OT104R_PROVIDER,
      mode,
      state: 'unconfigured',
      configured: false,
      can_register_existing_private_video: false,
      can_create_controlled_upload: false,
      can_receive_webhooks: false,
      can_import_text_tracks: false,
      missing_variable_names: missing,
      capability_names: ['sink_adapter_supported'],
      safe_reason_code: 'vimeo_configuration_missing',
    });
  }
  return ot104rVimeoReadinessSchema.parse({
    provider: OT104R_PROVIDER,
    mode,
    state: 'degraded',
    configured: true,
    can_register_existing_private_video: true,
    can_create_controlled_upload: true,
    can_receive_webhooks: true,
    can_import_text_tracks: true,
    missing_variable_names: ['live_read_only_canary'],
    capability_names: [
      'configuration_present',
      'manual_private_reference',
      'controlled_upload_intent',
      'webhook_verification',
      'text_track_import',
    ],
    safe_reason_code: 'live_read_only_canary_required',
  });
}

export function createOt104rUnconfiguredVimeoAdapter(
  readiness: Ot104rVimeoReadiness = inspectOt104rVimeoReadinessFromEnv(),
): Ot104rVimeoAdapter {
  async function unavailable(): Promise<never> {
    throw new Ot104rVimeoRuntimeError(
      'VIMEO_PROVIDER_UNCONFIGURED',
      'The real Vimeo provider is not configured for this environment.',
      503,
    );
  }
  return {
    async readiness() {
      return readiness;
    },
    registerExistingPrivateVideo: unavailable,
    createUploadIntent: unavailable,
    inspectVideo: unavailable,
    async listTextTracks() {
      return unavailable();
    },
    downloadTextTrack: unavailable,
  };
}

export function createOt104rSinkVimeoAdapter(
  input: {
    readiness?: Partial<Ot104rVimeoReadiness>;
    inspections?: Ot104rVimeoVideoInspection[];
    textTracks?: Ot104rVimeoTextTrackDownload[];
  } = {},
): Ot104rVimeoAdapter & {
  calls(): {
    register: number;
    upload: number;
    inspect: number;
    listTracks: number;
    download: number;
  };
} {
  let register = 0;
  let upload = 0;
  let inspect = 0;
  let listTracks = 0;
  let download = 0;
  const inspections = [...(input.inspections ?? [])];
  const tracks = [...(input.textTracks ?? [])];
  const readiness = ot104rVimeoReadinessSchema.parse({
    provider: OT104R_PROVIDER,
    mode: 'sink',
    state: 'ready',
    configured: true,
    can_register_existing_private_video: true,
    can_create_controlled_upload: true,
    can_receive_webhooks: true,
    can_import_text_tracks: true,
    missing_variable_names: [],
    capability_names: ['sink_private_video', 'sink_upload', 'sink_text_tracks'],
    safe_reason_code: 'sink_mode_ready',
    ...input.readiness,
  });
  function inspectionFor(providerVideoId: string): Ot104rVimeoVideoInspection {
    return (
      inspections.shift() ?? {
        providerVideoId,
        privacyState: 'private',
        processingState: 'available',
        durationMs: 61_000,
        width: 1280,
        height: 720,
        revision: stableOt86Key('sink_revision', [providerVideoId]),
        safeMetadata: { sink: true, privacy: 'private' },
      }
    );
  }
  const adapter: Ot104rVimeoAdapter = {
    async readiness() {
      return readiness;
    },
    async registerExistingPrivateVideo(command) {
      register += 1;
      return inspectionFor(command.provider_video_id ?? 'sink_video');
    },
    async createUploadIntent(command) {
      upload += 1;
      return {
        providerUploadId: stableOt86Key('sink_upload', [
          command.account_key,
          command.product_key,
          command.idempotency_key,
        ]),
        providerVideoId: stableOt86Key('sink_video', [command.content_id]).slice(0, 16),
        processingState: 'upload_authorized',
        safeUploadTicketRef: stableOt86Key('sink_upload_ticket', [command.idempotency_key]),
        safeMetadata: { sink: true, upload: 'server_managed' },
      };
    },
    async inspectVideo(providerVideoId) {
      inspect += 1;
      return inspectionFor(providerVideoId);
    },
    async listTextTracks() {
      listTracks += 1;
      return tracks.map(({ body: _body, ...track }) => track);
    },
    async downloadTextTrack(_providerVideoId, providerTextTrackId) {
      download += 1;
      const track = tracks.find(
        (candidate) => candidate.providerTextTrackId === providerTextTrackId,
      );
      if (!track) {
        throw new Ot104rVimeoRuntimeError(
          'TEXT_TRACK_NOT_FOUND',
          'Text track was not found by the provider adapter.',
          404,
        );
      }
      return track;
    },
  };
  return Object.assign(adapter, {
    calls: () => ({ register, upload, inspect, listTracks, download }),
  });
}

export function createOt104rRealVimeoAdapter(
  input: NodeJS.ProcessEnv | Ot104rRealVimeoAdapterOptions = process.env,
): Ot104rVimeoAdapter {
  const options = isOt104rRealVimeoAdapterOptions(input) ? input : { env: input };
  const env = options.env ?? process.env;
  const readiness = inspectOt104rVimeoReadinessFromEnv(env);
  if (readiness.mode !== 'real' || !readiness.configured) {
    return createOt104rUnconfiguredVimeoAdapter(readiness);
  }
  const token = mustEnv(env, 'VIMEO_ACCESS_TOKEN');
  const baseUrl = trimTrailingSlash(options.apiBaseUrl ?? 'https://api.vimeo.com');
  const fetchImpl = options.fetchImpl ?? fetch;
  async function vimeoJson(path: string, init: RequestInit = {}) {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...init.headers,
      },
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Ot104rVimeoRuntimeError(
        'VIMEO_PROVIDER_REJECTED',
        sanitizeOt104rProviderError(`http_${response.status}:${text}`),
        response.status,
      );
    }
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  }
  async function inspectVideo(providerVideoId: string): Promise<Ot104rVimeoVideoInspection> {
    const video = await vimeoJson(`/videos/${encodeURIComponent(providerVideoId)}`);
    return inspectionFromVimeoPayload(providerVideoId, video);
  }
  return {
    async readiness() {
      const response = await fetchImpl(`${baseUrl}/me`, {
        headers: { accept: 'application/json', authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        return ot104rVimeoReadinessSchema.parse({
          ...readiness,
          state: response.status === 401 || response.status === 403 ? 'auth_invalid' : 'degraded',
          safe_reason_code: `vimeo_me_http_${response.status}`,
        });
      }
      return ot104rVimeoReadinessSchema.parse({
        ...readiness,
        state: 'ready',
        missing_variable_names: [],
        safe_reason_code: 'vimeo_account_readback_ready',
      });
    },
    async registerExistingPrivateVideo(command) {
      return inspectVideo(command.provider_video_id ?? '');
    },
    async createUploadIntent(command) {
      const body = JSON.stringify({
        upload: { approach: 'tus', size: command.upload_size_bytes },
        name: command.title,
        privacy: { view: 'nobody' },
      });
      const video = await vimeoJson('/me/videos', { method: 'POST', body });
      const providerVideoId = extractVimeoVideoId(video.uri) ?? extractVimeoVideoId(video.link);
      const upload = asRecord(video.upload);
      return {
        providerUploadId: stableOt86Key('vimeo_upload', [
          String(upload.upload_link ?? upload.form ?? providerVideoId ?? command.idempotency_key),
        ]),
        providerVideoId,
        processingState: 'upload_authorized',
        safeUploadTicketRef: stableOt86Key('vimeo_upload_ticket', [command.idempotency_key]),
        safeMetadata: {
          upload_approach: String(upload.approach ?? 'tus'),
          provider_video_id_present: Boolean(providerVideoId),
        },
      };
    },
    inspectVideo,
    async listTextTracks(providerVideoId) {
      const payload = await vimeoJson(`/videos/${encodeURIComponent(providerVideoId)}/texttracks`);
      const data = Array.isArray(payload.data) ? payload.data : [];
      return data.map((entry) => textTrackSummaryFromPayload(entry));
    },
    async downloadTextTrack(providerVideoId, providerTextTrackId) {
      const tracks = await this.listTextTracks(providerVideoId);
      const track = tracks.find(
        (candidate) => candidate.providerTextTrackId === providerTextTrackId,
      );
      if (!track) {
        throw new Ot104rVimeoRuntimeError('TEXT_TRACK_NOT_FOUND', 'Text track was not found.', 404);
      }
      const body = await vimeoJson(
        `/videos/${encodeURIComponent(providerVideoId)}/texttracks/${encodeURIComponent(
          providerTextTrackId,
        )}`,
      );
      const text = String(body.text ?? body.body ?? '');
      return { ...track, body: text };
    },
  };
}

function isOt104rRealVimeoAdapterOptions(
  value: NodeJS.ProcessEnv | Ot104rRealVimeoAdapterOptions,
): value is Ot104rRealVimeoAdapterOptions {
  return 'env' in value || 'apiBaseUrl' in value || 'fetchImpl' in value;
}

export async function registerOt104rVimeoSource(input: {
  pool: DbPool;
  command: unknown;
  adapter?: Ot104rVimeoAdapter;
  now?: Date;
}): Promise<Ot104rVimeoRegistrationResult> {
  const command = ot104rVimeoRegisterCommandSchema.parse(input.command);
  assertOt104rScope(command.account_key, command.product_key);
  assertNoProviderUrl(command.provider_video_id ?? '');
  const adapter = input.adapter ?? createOt104rUnconfiguredVimeoAdapter();
  const readiness = await adapter.readiness();
  if (!readiness.configured && readiness.mode !== 'sink') {
    throw new Ot104rVimeoRuntimeError(
      'VIMEO_PROVIDER_UNCONFIGURED',
      'Vimeo registration requires a configured real provider or explicit sink adapter.',
      503,
    );
  }
  const now = input.now ?? new Date();
  const requestSha = sha256(canonicalJson(command));
  const sourceKey = stableOt86Key('ot104r_source', [
    command.account_key,
    command.product_key,
    command.idempotency_key,
  ]);

  return inTransaction(input.pool, async (client) => {
    const existing = await client.query(
      `SELECT *
         FROM onetime.ot104r_vimeo_sources
        WHERE account_key = $1 AND product_key = $2 AND idempotency_key = $3
        LIMIT 1`,
      [command.account_key, command.product_key, command.idempotency_key],
    );
    if (existing.rowCount) {
      const row = existing.rows[0] as Record<string, unknown>;
      if (String(row.request_sha256) !== requestSha) {
        throw new Ot104rVimeoRuntimeError(
          'IDEMPOTENCY_CONFLICT',
          'Vimeo source idempotency key was already used for a different request.',
          409,
        );
      }
      return resultFromSourceRow(row, true);
    }

    const provider =
      command.registration_mode === 'existing_private_video'
        ? await adapter.registerExistingPrivateVideo(command)
        : await uploadInspectionFromIntent(command, await adapter.createUploadIntent(command));
    const providerUploadId =
      command.registration_mode === 'controlled_upload'
        ? String(provider.safeMetadata.provider_upload_id ?? '')
        : null;
    const processingState = initialProcessingState(command.registration_mode, provider);
    const sourceRefDigest = sha256(
      command.registration_mode === 'existing_private_video'
        ? `vimeo:${provider.providerVideoId}`
        : `upload:${command.upload_filename}:${command.upload_size_bytes}`,
    );
    await insertOt86ContentItem(client, command, processingState, now);
    await client.query(
      `INSERT INTO onetime.ot104r_vimeo_sources
         (source_key, account_key, product_key, content_id, source_record_id, idempotency_key,
          request_sha256, source_ref_digest, title, source_sha256, byte_length,
          submitted_by_actor_id, registration_mode, provider_video_id, provider_upload_id,
          privacy_state, processing_state, duration_ms, width, height, last_synced_revision,
          sanitized_metadata_json, attempts, next_reconcile_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
          $22::jsonb,0,$23,$24,$24)`,
      [
        sourceKey,
        command.account_key,
        command.product_key,
        command.content_id,
        command.source_record_id,
        command.idempotency_key,
        requestSha,
        sourceRefDigest,
        command.title,
        command.source_sha256,
        command.byte_length ?? null,
        command.submitted_by_actor_id,
        command.registration_mode,
        provider.providerVideoId || null,
        providerUploadId,
        provider.privacyState,
        processingState,
        provider.durationMs,
        provider.width,
        provider.height,
        provider.revision,
        JSON.stringify(sanitizeProviderMetadata(provider.safeMetadata)),
        processingState === 'available' ? null : now,
        now,
      ],
    );
    await upsertLegacyOt86VimeoRecord(client, command, provider, providerUploadId, readiness, now);
    await recordAudit(client, {
      sourceKey,
      action: 'vimeo_source_registered',
      actorId: command.submitted_by_actor_id,
      actorType: 'operator',
      reasonCode: command.registration_mode,
      correlationId: command.correlation_id,
      metadata: {
        provider_video_id_present: Boolean(provider.providerVideoId),
        provider_upload_id_present: Boolean(providerUploadId),
      },
      now,
    });
    const row = await client.query(
      `SELECT *
         FROM onetime.ot104r_vimeo_sources
        WHERE source_key = $1
        LIMIT 1`,
      [sourceKey],
    );
    return resultFromSourceRow(row.rows[0] as Record<string, unknown>, false);
  });
}

export async function reconcileNextOt104rVimeoSource(input: {
  pool: DbPool;
  adapter: Ot104rVimeoAdapter;
  now?: Date;
  leaseOwner?: string;
  batchSize?: number;
  maxAttempts?: number;
}) {
  const now = input.now ?? new Date();
  const maxAttempts = input.maxAttempts ?? 5;
  const rows = await input.pool.query(
    `SELECT *
       FROM onetime.ot104r_vimeo_sources
      WHERE account_key = $1
        AND product_key = $2
        AND processing_state IN ('registered','upload_authorized','uploading','transcoding','retry_wait','failed')
        AND (next_reconcile_at IS NULL OR next_reconcile_at <= $3)
        AND (lease_expires_at IS NULL OR lease_expires_at <= $3)
      ORDER BY updated_at ASC, source_key ASC
      LIMIT $4`,
    [OT104R_ACCOUNT_KEY, OT104R_PRODUCT_KEY, now, Math.min(input.batchSize ?? 25, 100)],
  );
  let inspected = 0;
  let ready = 0;
  let retrying = 0;
  let deadLettered = 0;
  for (const row of rows.rows as Record<string, unknown>[]) {
    const sourceKey = String(row.source_key);
    const providerVideoId = nullableString(row.provider_video_id);
    const attempts = Number(row.attempts ?? 0) + 1;
    if (!providerVideoId) {
      await markReconcileFailure(
        input.pool,
        sourceKey,
        attempts,
        maxAttempts,
        'provider_video_id_missing',
        now,
      );
      retrying += attempts < maxAttempts ? 1 : 0;
      deadLettered += attempts >= maxAttempts ? 1 : 0;
      continue;
    }
    const leaseExpiresAt = new Date(now.getTime() + DEFAULT_LEASE_MS);
    const claimed = await input.pool.query(
      `UPDATE onetime.ot104r_vimeo_sources
          SET lease_owner = $2,
              lease_expires_at = $3,
              attempts = attempts + 1,
              updated_at = $4
        WHERE source_key = $1
          AND (lease_expires_at IS NULL OR lease_expires_at <= $4)`,
      [sourceKey, input.leaseOwner ?? 'ot104r-reconciler', leaseExpiresAt, now],
    );
    if ((claimed.rowCount ?? 0) < 1) continue;
    inspected += 1;
    try {
      const inspection = await input.adapter.inspectVideo(providerVideoId);
      const nextState = mapInspectionState(inspection.processingState);
      await input.pool.query(
        `UPDATE onetime.ot104r_vimeo_sources
            SET privacy_state = $2,
                processing_state = $3,
                duration_ms = $4,
                width = $5,
                height = $6,
                last_synced_revision = $7,
                sanitized_metadata_json = $8::jsonb,
                sanitized_error_code = NULL,
                next_reconcile_at = $9,
                lease_owner = NULL,
                lease_expires_at = NULL,
                updated_at = $10
          WHERE source_key = $1`,
        [
          sourceKey,
          inspection.privacyState,
          nextState,
          inspection.durationMs,
          inspection.width,
          inspection.height,
          inspection.revision,
          JSON.stringify(sanitizeProviderMetadata(inspection.safeMetadata)),
          nextState === 'available' ? null : nextBackoff(now, attempts),
          now,
        ],
      );
      await recordAudit(input.pool, {
        sourceKey,
        action: 'vimeo_source_reconciled',
        actorId: 'ot104r-reconciler',
        actorType: 'service',
        reasonCode: nextState,
        correlationId: stableOt86Key('ot104r_reconcile', [sourceKey, now.toISOString()]),
        metadata: { attempt: attempts },
        now,
      });
      if (nextState === 'available') ready += 1;
      else retrying += 1;
    } catch (error) {
      await markReconcileFailure(
        input.pool,
        sourceKey,
        attempts,
        maxAttempts,
        sanitizeOt104rProviderError(error),
        now,
      );
      retrying += attempts < maxAttempts ? 1 : 0;
      deadLettered += attempts >= maxAttempts ? 1 : 0;
    }
  }
  return { inspected, ready, retrying, dead_lettered: deadLettered };
}

export async function retryOt104rVimeoSource(input: {
  pool: DbPool;
  sourceKey: string;
  actorId: string;
  reasonCode: string;
  correlationId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const result = await input.pool.query(
    `UPDATE onetime.ot104r_vimeo_sources
        SET processing_state = 'retry_wait',
            sanitized_error_code = NULL,
            next_reconcile_at = $2,
            lease_owner = NULL,
            lease_expires_at = NULL,
            updated_at = $2
      WHERE source_key = $1
        AND account_key = $3
        AND product_key = $4
        AND processing_state IN ('failed','dead_lettered','retry_wait','transcoding','uploading')
      RETURNING source_key`,
    [input.sourceKey, now, OT104R_ACCOUNT_KEY, OT104R_PRODUCT_KEY],
  );
  if (!result.rowCount) {
    throw new Ot104rVimeoRuntimeError(
      'SOURCE_NOT_RETRYABLE',
      'Vimeo source is not retryable.',
      409,
    );
  }
  await recordAudit(input.pool, {
    sourceKey: input.sourceKey,
    action: 'operator_retry_requested',
    actorId: input.actorId,
    actorType: 'operator',
    reasonCode: input.reasonCode,
    correlationId: input.correlationId,
    metadata: {},
    now,
  });
  return { retry_scheduled: true as const, source_key: input.sourceKey };
}

export async function receiveOt104rVimeoWebhook(input: {
  pool: DbPool;
  rawBody: Buffer | string;
  headers: {
    contentType?: string | null;
    signature?: string | null;
    timestamp?: string | null;
  };
  secret: string;
  expectedAccountId?: string | null;
  now?: Date;
}): Promise<Ot104rVimeoWebhookReceiptResult> {
  const rawBody = Buffer.isBuffer(input.rawBody)
    ? input.rawBody
    : Buffer.from(input.rawBody, 'utf8');
  const now = input.now ?? new Date();
  if (rawBody.length > OT104R_WEBHOOK_MAX_BYTES) {
    return { status: 413, code: 'payload_too_large', message: 'Vimeo webhook body too large.' };
  }
  if (normalizeContentType(input.headers.contentType) !== 'application/json') {
    return {
      status: 415,
      code: 'unsupported_media_type',
      message: 'Vimeo webhook content type must be application/json.',
    };
  }
  const timestamp = String(input.headers.timestamp ?? '');
  if (!timestamp || !isFreshWebhookTimestamp(timestamp, now)) {
    return { status: 401, code: 'unauthorized', message: 'Vimeo webhook timestamp rejected.' };
  }
  if (
    !verifyOt104rVimeoWebhookSignature(input.secret, timestamp, rawBody, input.headers.signature)
  ) {
    return { status: 401, code: 'unauthorized', message: 'Vimeo webhook signature rejected.' };
  }

  let payload: Record<string, unknown>;
  try {
    payload = asRecord(JSON.parse(rawBody.toString('utf8')));
  } catch {
    return { status: 400, code: 'bad_request', message: 'Vimeo webhook JSON malformed.' };
  }
  const normalized = normalizeVimeoWebhookPayload(payload, rawBody);
  const rawBodySha = sha256(rawBody);
  try {
    return await inTransaction(input.pool, async (client) => {
      const existing = await client.query(
        `SELECT raw_body_sha256
           FROM onetime.ot104r_vimeo_webhook_receipts
          WHERE provider_event_id = $1
          LIMIT 1`,
        [normalized.providerEventId],
      );
      if (existing.rowCount) {
        if (String(existing.rows[0]?.raw_body_sha256) === rawBodySha) {
          return {
            status: 200,
            code: 'duplicate',
            message: 'Identical Vimeo webhook already recorded.',
            receipt_state: 'duplicate',
          };
        }
        await client.query(
          `UPDATE onetime.ot104r_vimeo_webhook_receipts
              SET processing_state = 'conflict',
                  sanitized_error_code = 'webhook_replay_changed_bytes'
            WHERE provider_event_id = $1`,
          [normalized.providerEventId],
        );
        return {
          status: 409,
          code: 'conflict',
          message: 'Vimeo webhook identifier was reused with different bytes.',
          receipt_state: 'conflict',
        };
      }

      const wrongAccount =
        input.expectedAccountId &&
        normalized.accountId &&
        normalized.accountId !== input.expectedAccountId;
      const isKnownEvent = WEBHOOK_EVENT_ALLOWLIST.has(normalized.eventType);
      const source = normalized.providerVideoId
        ? await sourceByProviderVideoId(client, normalized.providerVideoId)
        : null;
      const processingState = wrongAccount || !isKnownEvent || !source ? 'ignored' : 'recorded';
      const sanitizedErrorCode = wrongAccount
        ? 'wrong_vimeo_account'
        : !isKnownEvent
          ? 'unknown_vimeo_event'
          : source
            ? null
            : 'source_not_found';
      await client.query(
        `INSERT INTO onetime.ot104r_vimeo_webhook_receipts
           (provider_event_id, account_key, product_key, raw_body_sha256, event_type,
            normalized_event_key, provider_video_id, account_id_digest, processing_state,
            sanitized_error_code, payload_minimized_json, received_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)`,
        [
          normalized.providerEventId,
          OT104R_ACCOUNT_KEY,
          OT104R_PRODUCT_KEY,
          rawBodySha,
          normalized.eventType,
          normalized.normalizedEventKey,
          normalized.providerVideoId,
          normalized.accountId ? sha256(normalized.accountId) : null,
          processingState,
          sanitizedErrorCode,
          JSON.stringify(normalized.minimizedPayload),
          now,
        ],
      );
      if (wrongAccount) {
        return {
          status: 202,
          code: 'wrong_account_ignored',
          message: 'Vimeo webhook account did not match this provider scope.',
          receipt_state: 'ignored',
        };
      }
      if (!isKnownEvent) {
        return {
          status: 200,
          code: 'unknown_event_recorded',
          message: 'Unknown Vimeo event recorded minimally and acknowledged.',
          receipt_state: 'ignored',
        };
      }
      if (!source) {
        return {
          status: 202,
          code: 'source_not_found_recorded',
          message: 'Vimeo webhook was recorded but no matching scoped source exists.',
          receipt_state: 'ignored',
        };
      }
      const nextState = stateFromWebhookEvent(normalized.eventType);
      await client.query(
        `UPDATE onetime.ot104r_vimeo_sources
            SET processing_state = $2,
                sanitized_error_code = $3,
                next_reconcile_at = $4,
                last_synced_revision = COALESCE($5, last_synced_revision),
                updated_at = $6
          WHERE source_key = $1`,
        [
          source.sourceKey,
          nextState,
          nextState === 'failed' ? normalized.eventType : null,
          nextState === 'available' || nextState === 'failed' ? null : now,
          normalized.revision,
          now,
        ],
      );
      await client.query(
        `UPDATE onetime.ot104r_vimeo_webhook_receipts
            SET processing_state = 'processed',
                processed_at = $2
          WHERE provider_event_id = $1`,
        [normalized.providerEventId, now],
      );
      await recordAudit(client, {
        sourceKey: source.sourceKey,
        action: 'vimeo_webhook_reconciled',
        actorId: 'vimeo-webhook',
        actorType: 'provider',
        reasonCode: normalized.eventType,
        correlationId: normalized.providerEventId,
        metadata: { next_state: nextState },
        now,
      });
      return {
        status: 202,
        code: 'accepted',
        message: 'Vimeo webhook recorded and reconciled.',
        receipt_state: 'processed',
      };
    });
  } catch {
    return { status: 503, code: 'storage_unavailable', message: 'Vimeo webhook storage failed.' };
  }
}

export async function importOt104rVimeoTextTrack(input: {
  pool: DbPool;
  adapter: Ot104rVimeoAdapter;
  sourceKey: string;
  providerTextTrackId: string;
  actorId: string;
  correlationId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const source = await sourceByKey(input.pool, input.sourceKey);
  if (!source) {
    throw new Ot104rVimeoRuntimeError('SOURCE_NOT_FOUND', 'Vimeo source was not found.', 404);
  }
  if (!source.providerVideoId) {
    throw new Ot104rVimeoRuntimeError(
      'PROVIDER_VIDEO_ID_MISSING',
      'Vimeo source has no provider video id.',
      409,
    );
  }
  const track = await input.adapter.downloadTextTrack(
    source.providerVideoId,
    input.providerTextTrackId,
  );
  const normalized = normalizeTranscriptTrack(track);
  const trackKey = stableOt86Key('ot104r_track', [
    input.sourceKey,
    track.providerTextTrackId,
    normalized.sourceRevisionSha256,
  ]);
  await inTransaction(input.pool, async (client) => {
    await client.query(
      `INSERT INTO onetime.ot104r_vimeo_text_tracks
         (track_key, source_key, account_key, product_key, provider_text_track_id, language,
          kind, mime_type, source_revision, source_revision_sha256, byte_length, body_sha256,
          normalized_text, normalized_text_sha256, import_state, sanitized_metadata_json,
          imported_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'imported',$15::jsonb,$16,$16)
       ON CONFLICT (source_key, provider_text_track_id, source_revision_sha256) DO UPDATE SET
          normalized_text = EXCLUDED.normalized_text,
          normalized_text_sha256 = EXCLUDED.normalized_text_sha256,
          import_state = 'imported',
          updated_at = EXCLUDED.updated_at`,
      [
        trackKey,
        input.sourceKey,
        OT104R_ACCOUNT_KEY,
        OT104R_PRODUCT_KEY,
        track.providerTextTrackId,
        track.language,
        track.kind,
        track.mimeType,
        track.revision,
        normalized.sourceRevisionSha256,
        normalized.byteLength,
        normalized.bodySha256,
        normalized.normalizedText,
        normalized.normalizedTextSha256,
        JSON.stringify(sanitizeProviderMetadata(track.safeMetadata ?? {})),
        now,
      ],
    );
    await client.query(
      `UPDATE onetime.ot104r_vimeo_sources
          SET processing_state = 'transcript_ready',
              text_track_id = $2,
              last_synced_revision = $3,
              sanitized_error_code = NULL,
              updated_at = $4
        WHERE source_key = $1`,
      [input.sourceKey, track.providerTextTrackId, track.revision, now],
    );
    await recordAudit(client, {
      sourceKey: input.sourceKey,
      action: 'vimeo_text_track_imported',
      actorId: input.actorId,
      actorType: 'operator',
      reasonCode: 'approved_text_track',
      correlationId: input.correlationId,
      metadata: {
        track_key: trackKey,
        language: track.language,
        kind: track.kind,
        byte_length: normalized.byteLength,
      },
      now,
    });
  });
  return {
    track_key: trackKey,
    source_key: input.sourceKey,
    provider_text_track_id_present: true,
    source_revision_sha256: normalized.sourceRevisionSha256,
    normalized_text_sha256: normalized.normalizedTextSha256,
    byte_length: normalized.byteLength,
  };
}

export async function projectOt104rPlaybackAccess(input: {
  pool: DbPool;
  sourceKey: string;
  principalId: string;
  now?: Date;
}): Promise<Ot104rPlaybackProjection> {
  const now = input.now ?? new Date();
  const source = await sourceByKey(input.pool, input.sourceKey);
  if (!source) {
    throw new Ot104rVimeoRuntimeError('SOURCE_NOT_FOUND', 'Vimeo source was not found.', 404);
  }
  const projection = ot104rPlaybackProjectionSchema.parse({
    source_key: input.sourceKey,
    content_id: source.contentId,
    account_key: OT104R_ACCOUNT_KEY,
    product_key: OT104R_PRODUCT_KEY,
    status: source.processingState,
    playback_kind: 'server_authorized_vimeo_playback',
    playback_route: `/api/v1/content/vimeo/${encodeURIComponent(input.sourceKey)}/playback`,
    provider_video_id_present: Boolean(source.providerVideoId),
    expires_at: new Date(now.getTime() + 5 * 60_000).toISOString(),
  });
  await recordAudit(input.pool, {
    sourceKey: input.sourceKey,
    action: 'playback_projection_created',
    actorId: input.principalId,
    actorType: 'service',
    reasonCode: 'server_authorized_projection',
    correlationId: stableOt86Key('ot104r_playback', [input.sourceKey, input.principalId]),
    metadata: { provider_video_id_present: Boolean(source.providerVideoId) },
    now,
  });
  return projection;
}

export function signOt104rVimeoWebhook(input: {
  secret: string;
  timestamp: string;
  rawBody: Buffer | string;
}) {
  const rawBody = Buffer.isBuffer(input.rawBody)
    ? input.rawBody
    : Buffer.from(input.rawBody, 'utf8');
  return `v1=${createHmac('sha256', input.secret)
    .update(Buffer.from(`${input.timestamp}.`, 'ascii'))
    .update(rawBody)
    .digest('hex')}`;
}

export function sanitizeOt104rProviderError(error: unknown) {
  return String(error instanceof Error ? error.message : error)
    .replaceAll(/[A-Za-z0-9_-]{24,}/g, '[redacted-token]')
    .replaceAll(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted-token]')
    .replaceAll(
      /(access_token|client_secret|webhook_secret|upload_link)=([^&\s]+)/gi,
      '$1=[redacted-token]',
    )
    .replaceAll(/https?:\/\/[^\s"')]+/gi, '[redacted-url]')
    .slice(0, 160);
}

async function uploadInspectionFromIntent(
  command: Ot104rVimeoRegisterCommand,
  intent: Ot104rVimeoUploadIntent,
): Promise<Ot104rVimeoVideoInspection> {
  return {
    providerVideoId: intent.providerVideoId ?? '',
    privacyState: 'private',
    processingState:
      intent.processingState === 'upload_authorized' ? 'uploading' : intent.processingState,
    durationMs: null,
    width: null,
    height: null,
    revision: null,
    safeMetadata: {
      ...intent.safeMetadata,
      provider_upload_id: intent.providerUploadId,
      safe_upload_ticket_ref: intent.safeUploadTicketRef,
      title_sha256: sha256(command.title),
    },
  };
}

function initialProcessingState(
  mode: Ot104rVimeoRegistrationMode,
  inspection: Ot104rVimeoVideoInspection,
): Ot104rVimeoProcessingState {
  if (mode === 'controlled_upload') return 'upload_authorized';
  return mapInspectionState(inspection.processingState);
}

function mapInspectionState(value: Ot104rVimeoVideoInspection['processingState']) {
  if (value === 'available') return 'available' as const;
  if (value === 'failed') return 'failed' as const;
  if (value === 'transcoding') return 'transcoding' as const;
  return 'uploading' as const;
}

async function insertOt86ContentItem(
  client: Queryable,
  command: Ot104rVimeoRegisterCommand,
  state: Ot104rVimeoProcessingState,
  now: Date,
) {
  const aggregateState =
    state === 'available' || state === 'transcript_ready'
      ? 'transcribing'
      : state === 'failed' || state === 'dead_lettered'
        ? 'failed'
        : 'uploading';
  await client.query(
    `INSERT INTO onetime.ot86_content_items
       (tenant_id, content_id, source_record_id, source_kind, original_name, source_sha256,
        byte_length, origin_service, submitting_actor_id, aggregate_state, received_at, updated_at)
     VALUES ($1,$2,$3,'rabbi_class',$4,$5,$6,'ot104r-vimeo-private-runtime',$7,$8,$9,$9)
     ON CONFLICT (tenant_id, content_id) DO UPDATE SET
       aggregate_state = EXCLUDED.aggregate_state,
       updated_at = EXCLUDED.updated_at`,
    [
      command.account_key,
      command.content_id,
      command.source_record_id,
      command.title,
      command.source_sha256,
      command.byte_length ?? null,
      command.submitted_by_actor_id,
      aggregateState,
      now,
    ],
  );
}

async function upsertLegacyOt86VimeoRecord(
  client: Queryable,
  command: Ot104rVimeoRegisterCommand,
  provider: Ot104rVimeoVideoInspection,
  providerUploadId: string | null,
  readiness: Ot104rVimeoReadiness,
  now: Date,
) {
  await client.query(
    `INSERT INTO onetime.ot86_vimeo_provider_records
       (tenant_id, content_id, provider_video_id, provider_upload_id, reference_mode,
        upload_idempotency_key, readiness_state, validation_state, actor_id,
        sanitized_metadata, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$11)
     ON CONFLICT (tenant_id, content_id, upload_idempotency_key) DO UPDATE SET
       provider_video_id = COALESCE(EXCLUDED.provider_video_id, onetime.ot86_vimeo_provider_records.provider_video_id),
       provider_upload_id = COALESCE(EXCLUDED.provider_upload_id, onetime.ot86_vimeo_provider_records.provider_upload_id),
       readiness_state = EXCLUDED.readiness_state,
       validation_state = EXCLUDED.validation_state,
       sanitized_metadata = EXCLUDED.sanitized_metadata,
       updated_at = EXCLUDED.updated_at`,
    [
      command.account_key,
      command.content_id,
      provider.providerVideoId || null,
      providerUploadId,
      command.registration_mode === 'controlled_upload'
        ? 'automated_upload'
        : 'manual_approved_reference',
      command.idempotency_key,
      readiness.state === 'ready'
        ? 'ready'
        : readiness.state === 'degraded'
          ? 'degraded'
          : 'manual_review',
      provider.privacyState === 'review_required' ? 'pending' : 'validated',
      command.submitted_by_actor_id,
      JSON.stringify(sanitizeProviderMetadata(provider.safeMetadata)),
      now,
    ],
  );
}

function resultFromSourceRow(
  row: Record<string, unknown>,
  duplicate: boolean,
): Ot104rVimeoRegistrationResult {
  const providerVideoId = nullableString(row.provider_video_id);
  const providerUploadId = nullableString(row.provider_upload_id);
  return ot104rVimeoRegistrationResultSchema.parse({
    duplicate,
    source_key: String(row.source_key),
    content_id: String(row.content_id),
    account_key: OT104R_ACCOUNT_KEY,
    product_key: OT104R_PRODUCT_KEY,
    registration_mode: row.registration_mode,
    processing_state: row.processing_state,
    privacy_state: row.privacy_state,
    provider_video_id_present: Boolean(providerVideoId),
    provider_upload_id_present: Boolean(providerUploadId),
    provider_video_ref_digest: providerVideoId ? sha256(providerVideoId) : null,
    provider_upload_ref_digest: providerUploadId ? sha256(providerUploadId) : null,
    safe_upload_ticket_ref: providerUploadId
      ? stableOt86Key('safe_upload_ticket_ref', [providerUploadId])
      : null,
    safe_reason_code: duplicate ? 'idempotent_replay' : 'registered',
  });
}

function verifyOt104rVimeoWebhookSignature(
  secret: string,
  timestamp: string,
  rawBody: Buffer,
  signatureHeader?: string | null,
) {
  if (!secret || !signatureHeader) return false;
  const supplied = signatureHeader.replace(/^(?:v1=|sha256=)/i, '').trim();
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const timestampBound = signOt104rVimeoWebhook({ secret, timestamp, rawBody }).replace(/^v1=/, '');
  const bodyOnly = createHmac('sha256', secret).update(rawBody).digest('hex');
  return constantTimeHex(timestampBound, supplied) || constantTimeHex(bodyOnly, supplied);
}

function normalizeVimeoWebhookPayload(payload: Record<string, unknown>, rawBody: Buffer) {
  const eventType =
    stringValue(payload.type) ??
    stringValue(payload.event) ??
    stringValue(payload.event_type) ??
    'unknown';
  const providerEventId =
    stringValue(payload.id) ??
    stringValue(payload.event_id) ??
    stringValue(payload.webhook_event_id) ??
    stableOt86Key('vimeo_event', [sha256(rawBody)]);
  const video = asRecord(payload.video);
  const data = asRecord(payload.data);
  const account = asRecord(payload.account);
  const user = asRecord(payload.user);
  const providerVideoId =
    extractVimeoVideoId(payload.video_uri) ??
    extractVimeoVideoId(payload.uri) ??
    extractVimeoVideoId(video.uri) ??
    extractVimeoVideoId(video.link) ??
    extractVimeoVideoId(data.uri) ??
    stringValue(payload.video_id) ??
    stringValue(data.video_id);
  const accountId =
    stringValue(payload.account_id) ??
    extractVimeoUserId(account.uri) ??
    extractVimeoUserId(user.uri) ??
    stringValue(user.resource_key);
  const revision =
    stringValue(payload.revision) ??
    stringValue(data.revision) ??
    stringValue(video.modified_time) ??
    stringValue(payload.created_time);
  return {
    eventType,
    providerEventId,
    providerVideoId,
    accountId,
    revision,
    normalizedEventKey: stableOt86Key('ot104r_webhook', [
      eventType,
      providerVideoId ?? providerEventId,
    ]),
    minimizedPayload: {
      event_type: eventType,
      provider_video_id_present: Boolean(providerVideoId),
      account_id_present: Boolean(accountId),
      revision_present: Boolean(revision),
    },
  };
}

function stateFromWebhookEvent(eventType: string): Ot104rVimeoProcessingState {
  if (eventType === 'video.deleted') return 'retired';
  if (eventType === 'video.transcode.error' || eventType === 'video.transcode.failed') {
    return 'failed';
  }
  if (
    eventType === 'video.transcode.complete' ||
    eventType === 'video.transcode.completed' ||
    eventType === 'video.available'
  ) {
    return 'available';
  }
  if (eventType === 'video.upload.complete' || eventType === 'video.upload.completed') {
    return 'transcoding';
  }
  return 'transcoding';
}

async function markReconcileFailure(
  pool: DbPool,
  sourceKey: string,
  attempts: number,
  maxAttempts: number,
  sanitizedErrorCode: string,
  now: Date,
) {
  const terminal = attempts >= maxAttempts;
  await pool.query(
    `UPDATE onetime.ot104r_vimeo_sources
        SET processing_state = $2,
            sanitized_error_code = $3,
            next_reconcile_at = $4,
            lease_owner = NULL,
            lease_expires_at = NULL,
            updated_at = $5,
            terminal_at = CASE WHEN $2 = 'dead_lettered' THEN $5 ELSE terminal_at END
      WHERE source_key = $1`,
    [
      sourceKey,
      terminal ? 'dead_lettered' : 'retry_wait',
      sanitizedErrorCode,
      terminal ? null : nextBackoff(now, attempts),
      now,
    ],
  );
}

function normalizeTranscriptTrack(track: Ot104rVimeoTextTrackDownload) {
  const contentType = normalizeContentType(track.mimeType);
  if (!['text/vtt', 'text/plain', 'application/x-subrip'].includes(contentType)) {
    throw new Ot104rVimeoRuntimeError(
      'UNSUPPORTED_TRANSCRIPT_CONTENT_TYPE',
      'Vimeo text track content type is not allowed.',
      422,
    );
  }
  const body = Buffer.isBuffer(track.body) ? track.body : Buffer.from(track.body, 'utf8');
  if (body.length > OT104R_TRANSCRIPT_MAX_BYTES) {
    throw new Ot104rVimeoRuntimeError(
      'TRANSCRIPT_TOO_LARGE',
      'Vimeo text track exceeds the import size limit.',
      413,
    );
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(body);
  } catch {
    throw new Ot104rVimeoRuntimeError(
      'TRANSCRIPT_ENCODING_INVALID',
      'Vimeo text track must be valid UTF-8.',
      422,
    );
  }
  const normalizedText = text
    .replace(/^\uFEFF/, '')
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .trimEnd();
  if (!normalizedText.trim()) {
    throw new Ot104rVimeoRuntimeError(
      'TRANSCRIPT_EMPTY',
      'Vimeo text track did not contain importable text.',
      422,
    );
  }
  return {
    byteLength: body.length,
    bodySha256: sha256(body),
    normalizedText,
    normalizedTextSha256: sha256(normalizedText),
    sourceRevisionSha256: sha256(
      `${track.providerTextTrackId}\0${track.revision}\0${sha256(body)}`,
    ),
  };
}

async function sourceByProviderVideoId(client: Queryable, providerVideoId: string) {
  const result = await client.query(
    `SELECT source_key, content_id, provider_video_id, processing_state
       FROM onetime.ot104r_vimeo_sources
      WHERE account_key = $1
        AND product_key = $2
        AND provider_video_id = $3
      LIMIT 1`,
    [OT104R_ACCOUNT_KEY, OT104R_PRODUCT_KEY, providerVideoId],
  );
  if (!result.rowCount) return null;
  const row = result.rows[0] as Record<string, unknown>;
  return {
    sourceKey: String(row.source_key),
    contentId: String(row.content_id),
    providerVideoId: nullableString(row.provider_video_id),
    processingState: String(row.processing_state) as Ot104rVimeoProcessingState,
  };
}

async function sourceByKey(pool: DbPool | Queryable, sourceKey: string) {
  const result = await pool.query(
    `SELECT source_key, content_id, provider_video_id, processing_state
       FROM onetime.ot104r_vimeo_sources
      WHERE account_key = $1
        AND product_key = $2
        AND source_key = $3
      LIMIT 1`,
    [OT104R_ACCOUNT_KEY, OT104R_PRODUCT_KEY, sourceKey],
  );
  if (!result.rowCount) return null;
  const row = result.rows[0] as Record<string, unknown>;
  return {
    sourceKey: String(row.source_key),
    contentId: String(row.content_id),
    providerVideoId: nullableString(row.provider_video_id),
    processingState: String(row.processing_state) as Ot104rVimeoProcessingState,
  };
}

async function recordAudit(
  pool: DbPool | Queryable,
  input: {
    sourceKey: string;
    action: string;
    actorId: string;
    actorType: string;
    reasonCode: string;
    correlationId: string;
    metadata: Record<string, unknown>;
    now: Date;
  },
) {
  await pool.query(
    `INSERT INTO onetime.ot104r_vimeo_audit_events
       (audit_id, account_key, product_key, source_key, actor_id, actor_type, action,
        reason_code, correlation_id, safe_metadata_json, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)
     ON CONFLICT (audit_id) DO NOTHING`,
    [
      stableOt86Key('ot104r_audit', [
        input.sourceKey,
        input.action,
        input.correlationId,
        input.now.toISOString(),
      ]),
      OT104R_ACCOUNT_KEY,
      OT104R_PRODUCT_KEY,
      input.sourceKey,
      input.actorId,
      input.actorType,
      input.action,
      input.reasonCode,
      input.correlationId,
      JSON.stringify(sanitizeProviderMetadata(input.metadata)),
      input.now,
    ],
  );
}

function inspectionFromVimeoPayload(
  providerVideoId: string,
  payload: Record<string, unknown>,
): Ot104rVimeoVideoInspection {
  const privacy = asRecord(payload.privacy);
  const transcode = asRecord(payload.transcode);
  const status = stringValue(transcode.status) ?? stringValue(payload.status) ?? 'available';
  return {
    providerVideoId,
    privacyState: privacyStateFromVimeo(privacy),
    processingState: processingStateFromVimeo(status),
    durationMs: numberOrNull(payload.duration, 1000),
    width: numberOrNull(payload.width),
    height: numberOrNull(payload.height),
    revision: stringValue(payload.modified_time) ?? stringValue(payload.resource_key),
    safeMetadata: {
      provider: OT104R_PROVIDER,
      status: processingStateFromVimeo(status),
      privacy: privacyStateFromVimeo(privacy),
      duration_present: payload.duration !== undefined,
      dimensions_present: payload.width !== undefined || payload.height !== undefined,
    },
  };
}

function textTrackSummaryFromPayload(value: unknown): Ot104rVimeoTextTrackSummary {
  const payload = asRecord(value);
  const id =
    extractVimeoTextTrackId(payload.uri) ??
    stringValue(payload.id) ??
    stringValue(payload.resource_key);
  if (!id) {
    throw new Ot104rVimeoRuntimeError(
      'TEXT_TRACK_ID_MISSING',
      'Vimeo text track payload omitted an identifier.',
      502,
    );
  }
  return {
    providerTextTrackId: id,
    language: stringValue(payload.language) ?? 'und',
    kind:
      stringValue(payload.type) === 'subtitles'
        ? 'subtitles'
        : stringValue(payload.type) === 'transcript'
          ? 'transcript'
          : 'captions',
    mimeType: stringValue(payload.mime_type) ?? 'text/vtt',
    revision: stringValue(payload.modified_time) ?? stringValue(payload.resource_key) ?? id,
    safeMetadata: { default: Boolean(payload.default), active: Boolean(payload.active) },
  };
}

function privacyStateFromVimeo(privacy: Record<string, unknown>) {
  const view = stringValue(privacy.view) ?? '';
  if (view === 'nobody' || view === 'disable') return 'private' as const;
  if (view === 'unlisted') return 'unlisted' as const;
  if (view === 'password') return 'password' as const;
  return 'review_required' as const;
}

function processingStateFromVimeo(status: string) {
  const normalized = status.toLowerCase();
  if (['complete', 'completed', 'available', 'ready'].includes(normalized)) {
    return 'available' as const;
  }
  if (['error', 'failed', 'failure'].includes(normalized)) return 'failed' as const;
  if (['in_progress', 'transcoding', 'processing'].includes(normalized))
    return 'transcoding' as const;
  return 'uploading' as const;
}

function assertOt104rScope(accountKey: string, productKey: string) {
  if (accountKey !== OT104R_ACCOUNT_KEY || productKey !== OT104R_PRODUCT_KEY) {
    throw new Ot104rVimeoRuntimeError(
      'WRONG_ACCOUNT_PRODUCT_SCOPE',
      'Vimeo runtime is scoped only to Rabbi Scheller One Time content.',
      403,
    );
  }
}

function assertNoProviderUrl(value: string) {
  if (/https?:\/\//i.test(value) || /vimeo\.com/i.test(value)) {
    throw new Ot104rVimeoRuntimeError(
      'RAW_PROVIDER_URL_REJECTED',
      'Use an opaque Vimeo video id, not a raw provider URL.',
      422,
    );
  }
}

function nextBackoff(now: Date, attempts: number) {
  const bounded = Math.min(Math.max(attempts, 1), 5);
  return new Date(now.getTime() + bounded * bounded * 60_000);
}

function normalizeContentType(value: string | null | undefined) {
  return (
    String(value ?? '')
      .split(';')[0]
      ?.trim()
      .toLowerCase() ?? ''
  );
}

function isFreshWebhookTimestamp(value: string, now: Date) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return false;
  return Math.abs(now.getTime() - seconds * 1000) <= WEBHOOK_FRESHNESS_MS;
}

function constantTimeHex(expected: string, supplied: string) {
  const left = Buffer.from(expected, 'hex');
  const right = Buffer.from(supplied, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

function sanitizeProviderMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeProviderMetadata);
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string') return redactProviderString(value);
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
      if (/(url|uri|href|link|token|secret|password|credential|download|upload)/i.test(key)) {
        return [`redacted_${sha256(key).slice(0, 12)}`, digestPresence(entry)];
      }
      return [key, sanitizeProviderMetadata(entry)];
    }),
  );
}

function redactProviderString(value: string) {
  if (/https?:\/\/|vimeo|Bearer\s+/i.test(value)) return `[redacted:${sha256(value).slice(0, 16)}]`;
  return value;
}

function digestPresence(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  return `[redacted:${sha256(String(value)).slice(0, 16)}]`;
}

function extractVimeoVideoId(value: unknown) {
  const text = stringValue(value);
  if (!text) return null;
  const match = text.match(/\/videos\/([A-Za-z0-9._:-]+)/) ?? text.match(/vimeo\.com\/([0-9]+)/);
  return match?.[1] ?? (/^[A-Za-z0-9._:-]+$/.test(text) ? text : null);
}

function extractVimeoTextTrackId(value: unknown) {
  const text = stringValue(value);
  if (!text) return null;
  const match = text.match(/\/texttracks\/([A-Za-z0-9._:-]+)/);
  return match?.[1] ?? (/^[A-Za-z0-9._:-]+$/.test(text) ? text : null);
}

function extractVimeoUserId(value: unknown) {
  const text = stringValue(value);
  if (!text) return null;
  const match = text.match(/\/users\/([A-Za-z0-9._:-]+)/);
  return match?.[1] ?? (/^[A-Za-z0-9._:-]+$/.test(text) ? text : null);
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown, multiplier = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.round(parsed * multiplier));
}

function nullableString(value: unknown) {
  if (value === null || value === undefined) return null;
  return String(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function mustEnv(env: NodeJS.ProcessEnv, key: string) {
  const value = env[key];
  if (!value) throw new Ot104rVimeoRuntimeError('VIMEO_CONFIG_MISSING', `${key} is required.`, 503);
  return value;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}
