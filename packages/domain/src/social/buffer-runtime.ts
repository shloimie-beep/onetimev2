import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  ot106BufferChannelBindingSchema,
  ot106PlatformSchema,
  ot106ProviderModeSchema,
  ot106PublicationManifestSchema,
  ot106PublicationStateSchema,
  ot106ReadinessSchema,
  type Ot106BufferChannelBinding,
  type Ot106MediaDerivative,
  type Ot106ProviderMode,
  type Ot106PublicationManifest,
  type Ot106PublicationState,
  type Ot106Readiness,
} from '../../../contracts/src/index.ts';
import type { DbPool, Queryable } from '../../../db/src/index.ts';
import { inTransaction } from '../../../db/src/index.ts';

export type Ot106SigningSecret = {
  keyId: string;
  secret: string;
};

export type Ot106RuntimeConfig = {
  accountKey: string;
  productKey: string;
  mode: Ot106ProviderMode;
  bufferAccessToken?: string;
  bufferOrganizationId?: string;
  channels: Ot106BufferChannelBinding[];
  maxAttempts: number;
};

export type Ot106ReceiveResult = {
  status: 200 | 202 | 400 | 401 | 409 | 422 | 503;
  code:
    | 'accepted'
    | 'duplicate'
    | 'bad_request'
    | 'unauthorized'
    | 'conflict'
    | 'unprocessable'
    | 'storage_unavailable';
  message: string;
  state?: Ot106PublicationState;
};

export type Ot106ProviderOperation = 'draft' | 'scheduled';

export type Ot106ProviderPostInput = {
  manifest: Ot106PublicationManifest;
  targetAlias: string;
  binding: Ot106BufferChannelBinding;
  operation: Ot106ProviderOperation;
  text: string;
  assets: Array<{ image?: { url: string }; video?: { url: string } }>;
};

export type Ot106ProviderResult = {
  status: 'created' | 'scheduled' | 'retryable_failure' | 'dead_lettered';
  provider_post_id?: string | null;
  sanitized_code: string;
  retryable: boolean;
  retry_after_seconds?: number | null;
  response_sha256?: string | null;
  http_status?: number | null;
  external_write_performed: boolean;
};

export type Ot106BufferAdapter = {
  createPost(input: Ot106ProviderPostInput): Promise<Ot106ProviderResult>;
};

export class Ot106BufferRuntimeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus = 400,
  ) {
    super(message);
  }
}

const FRESH_SECONDS = 300;
const DEFAULT_MAX_ATTEMPTS = 5;
const BLOCKED_MEDIA_HOSTS = [
  'drive.google.com',
  'docs.google.com',
  'dropbox.com',
  'www.dropbox.com',
  'vimeo.com',
  'player.vimeo.com',
];
const SIGNED_URL_MARKERS = [
  'x-amz-',
  'x-goog-',
  'expires',
  'signature',
  'policy',
  'key-pair-id',
  'awsaccesskeyid',
  'token',
  'sig',
  'se',
];

export function signOt106Manifest(input: {
  secret: string;
  timestamp: string;
  rawBody: Buffer | string;
}) {
  const rawBody = Buffer.isBuffer(input.rawBody)
    ? input.rawBody
    : Buffer.from(input.rawBody, 'utf8');
  return `v1=${createHmac('sha256', input.secret)
    .update(input.timestamp)
    .update('.')
    .update(rawBody)
    .digest('hex')}`;
}

export function canonicalOt106Json(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return `[${value.map(canonicalOt106Json).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalOt106Json(entry)}`)
      .join(',')}}`;
  }
  throw new Error(`Cannot canonicalize ${typeof value}`);
}

export function withOt106ManifestChecksum(
  manifest: Omit<Ot106PublicationManifest, 'manifest_sha256'> &
    Partial<Pick<Ot106PublicationManifest, 'manifest_sha256'>>,
): Ot106PublicationManifest {
  const withoutHash = { ...manifest };
  delete withoutHash.manifest_sha256;
  return ot106PublicationManifestSchema.parse({
    ...withoutHash,
    manifest_sha256: sha256(canonicalOt106Json(withoutHash)),
  });
}

export function validateOt106ManifestChecksum(manifest: Ot106PublicationManifest) {
  const withoutHash = { ...manifest };
  delete (withoutHash as Partial<Ot106PublicationManifest>).manifest_sha256;
  return sha256(canonicalOt106Json(withoutHash)) === manifest.manifest_sha256;
}

export async function receiveOt106PublicationManifest(input: {
  pool: DbPool;
  rawBody: Buffer | string;
  headers: {
    contentType?: string | null;
    keyId?: string | null;
    timestamp?: string | null;
    deliveryId?: string | null;
    signature?: string | null;
  };
  secrets: Ot106SigningSecret[];
  expectedAccountKey: string;
  expectedProductKey: string;
  now?: Date;
}): Promise<Ot106ReceiveResult> {
  const rawBody = Buffer.isBuffer(input.rawBody)
    ? input.rawBody
    : Buffer.from(input.rawBody, 'utf8');
  const now = input.now ?? new Date();
  const headers = normalizeHeaders(input.headers);
  if (
    headers.contentType !== 'application/json' ||
    !headers.keyId ||
    !/^\d+$/.test(headers.timestamp) ||
    !/^[0-9a-f-]{36}$/i.test(headers.deliveryId) ||
    !/^v1=[a-f0-9]{64}$/.test(headers.signature)
  ) {
    return {
      status: 400,
      code: 'bad_request',
      message: 'Required OT-106 manifest headers are missing or malformed.',
    };
  }
  const secret = input.secrets.find((candidate) => candidate.keyId === headers.keyId);
  if (!secret || !isFreshTimestamp(headers.timestamp, now)) {
    return { status: 401, code: 'unauthorized', message: 'OT-106 signature rejected.' };
  }
  if (!verifySignature(secret.secret, headers.timestamp, rawBody, headers.signature)) {
    return { status: 401, code: 'unauthorized', message: 'OT-106 signature rejected.' };
  }

  let manifest: Ot106PublicationManifest;
  try {
    manifest = ot106PublicationManifestSchema.parse(JSON.parse(rawBody.toString('utf8')));
    if (manifest.manifest_id.toLowerCase() !== headers.deliveryId.toLowerCase()) {
      return { status: 400, code: 'bad_request', message: 'Delivery id mismatch.' };
    }
    if (!validateOt106ManifestChecksum(manifest)) {
      return { status: 422, code: 'unprocessable', message: 'Manifest checksum mismatch.' };
    }
    if (
      manifest.account_key !== input.expectedAccountKey ||
      manifest.product_key !== input.expectedProductKey
    ) {
      return { status: 422, code: 'unprocessable', message: 'Manifest scope mismatch.' };
    }
    assertManifestSafe(manifest, now);
  } catch {
    return {
      status: 422,
      code: 'unprocessable',
      message: 'Manifest failed schema, checksum, approval, or privacy validation.',
    };
  }

  const rawBodySha = sha256(rawBody);
  try {
    return await inTransaction(input.pool, async (client) => {
      const existing = await client.query(
        `SELECT raw_body_sha256
           FROM onetime.ot106_publication_manifests
          WHERE manifest_id = $1 OR idempotency_key = $2
          LIMIT 1`,
        [manifest.manifest_id, manifest.idempotency_key],
      );
      if (existing.rowCount) {
        if (String(existing.rows[0]?.raw_body_sha256) === rawBodySha) {
          return {
            status: 200,
            code: 'duplicate',
            message: 'Identical OT-106 manifest already recorded.',
            state: 'queued',
          } satisfies Ot106ReceiveResult;
        }
        await recordAudit(client, {
          manifestId: manifest.manifest_id,
          action: 'manifest_replay_conflict',
          reasonCode: 'changed_replay_bytes',
          correlationId: manifest.manifest_id,
          now,
          metadata: {},
        });
        return {
          status: 409,
          code: 'conflict',
          message: 'OT-106 manifest identifier reused with different bytes.',
          state: 'dead_lettered',
        } satisfies Ot106ReceiveResult;
      }

      await client.query(
        `INSERT INTO onetime.ot106_publication_manifests
           (manifest_id, idempotency_key, account_key, product_key, source_content_id,
            derivative_batch_id, mode, state, due_at_utc, approval_id,
            approved_by_actor_id, raw_body_sha256, manifest_sha256, manifest_json,
            next_attempt_at, max_attempts, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'queued',$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$14,$14)`,
        [
          manifest.manifest_id,
          manifest.idempotency_key,
          manifest.account_key,
          manifest.product_key,
          manifest.source.content_id,
          manifest.source.derivative_batch_id,
          manifest.mode,
          manifest.due_at_utc ? new Date(manifest.due_at_utc) : null,
          manifest.approval.approval_id,
          manifest.approval.approved_by_actor_id,
          rawBodySha,
          manifest.manifest_sha256,
          JSON.stringify(manifest),
          now,
          DEFAULT_MAX_ATTEMPTS,
        ],
      );
      for (const target of manifest.targets) {
        await client.query(
          `INSERT INTO onetime.ot106_publication_targets
             (target_id, manifest_id, target_alias, requested_platform, target_state, created_at, updated_at)
           VALUES ($1,$2,$3,$4,'queued',$5,$5)`,
          [
            stableKey('ot106_target', [manifest.manifest_id, target.alias]),
            manifest.manifest_id,
            target.alias,
            target.platform ?? null,
            now,
          ],
        );
      }
      for (const media of manifest.media) {
        await client.query(
          `INSERT INTO onetime.ot106_publication_media
             (media_id, manifest_id, derivative_id, kind, url, mime_type, sha256,
              byte_length, subject_classification, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            stableKey('ot106_media', [manifest.manifest_id, media.derivative_id]),
            manifest.manifest_id,
            media.derivative_id,
            media.kind,
            media.url,
            media.mime_type,
            media.sha256,
            media.byte_length,
            media.subject_classification,
            now,
          ],
        );
      }
      await recordAudit(client, {
        manifestId: manifest.manifest_id,
        action: 'manifest_accepted',
        reasonCode: 'signature_scope_privacy_valid',
        correlationId: manifest.manifest_id,
        now,
        metadata: { target_count: manifest.targets.length, media_count: manifest.media.length },
      });
      return {
        status: 202,
        code: 'accepted',
        message: 'OT-106 manifest queued.',
        state: 'queued',
      } satisfies Ot106ReceiveResult;
    });
  } catch {
    return {
      status: 503,
      code: 'storage_unavailable',
      message: 'OT-106 manifest storage is unavailable.',
    };
  }
}

export async function processOt106BufferQueueOnce(input: {
  pool: DbPool;
  config: Ot106RuntimeConfig;
  adapter: Ot106BufferAdapter;
  now?: Date;
  batchSize?: number;
  leaseOwner?: string;
}) {
  const now = input.now ?? new Date();
  const batchSize = Math.min(Math.max(input.batchSize ?? 25, 1), 500);
  const rows = await input.pool.query(
    `SELECT *
       FROM onetime.ot106_publication_manifests
      WHERE state IN ('queued', 'retryable_failure')
        AND next_attempt_at <= $1
      ORDER BY next_attempt_at ASC, created_at ASC
      LIMIT ${batchSize}`,
    [now],
  );
  let providerWrites = 0;
  let providerDrafts = 0;
  let scheduled = 0;
  let failed = 0;
  for (const row of rows.rows as Record<string, unknown>[]) {
    const manifest = ot106PublicationManifestSchema.parse(parseJson(row.manifest_json));
    const claimed = await claimManifest(input.pool, manifest.manifest_id, input.leaseOwner, now);
    if (!claimed) continue;
    const result = await processManifestTargets({
      pool: input.pool,
      manifest,
      config: input.config,
      adapter: input.adapter,
      now,
    });
    providerWrites += result.provider_writes;
    providerDrafts += result.provider_drafts;
    scheduled += result.scheduled;
    failed += result.failed;
  }
  return {
    inspected: rows.rowCount ?? 0,
    provider_writes: providerWrites,
    provider_drafts: providerDrafts,
    scheduled,
    failed,
  };
}

export async function cancelOt106Manifest(input: {
  pool: DbPool;
  manifestId: string;
  actorId: string;
  reasonCode: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  await inTransaction(input.pool, async (client) => {
    await client.query(
      `UPDATE onetime.ot106_publication_manifests
          SET state = 'canceled',
              last_error_code = $2,
              updated_at = $3
        WHERE manifest_id = $1
          AND state NOT IN ('sent', 'canceled')`,
      [input.manifestId, input.reasonCode, now],
    );
    await client.query(
      `UPDATE onetime.ot106_publication_targets
          SET target_state = 'canceled',
              updated_at = $2
        WHERE manifest_id = $1
          AND target_state NOT IN ('sent', 'canceled')`,
      [input.manifestId, now],
    );
    await recordAudit(client, {
      manifestId: input.manifestId,
      action: 'manifest_canceled',
      reasonCode: input.reasonCode,
      correlationId: input.manifestId,
      now,
      metadata: { actor_id: input.actorId },
    });
  });
  return { state: 'canceled' as const };
}

export function loadOt106RuntimeConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  defaults: { accountKey?: string; productKey?: string } = {},
): Ot106RuntimeConfig {
  const mode = ot106ProviderModeSchema.catch('disabled').parse(env.OT106_BUFFER_PROVIDER_MODE);
  const organizationId = env.BUFFER_ORGANIZATION_ID;
  const channels = parseOt106BufferChannelAliases(env.OT106_BUFFER_CHANNEL_ALIASES, organizationId);
  return {
    accountKey: defaults.accountKey ?? env.ONE_TIME_ACCOUNT_KEY ?? 'one_time',
    productKey: defaults.productKey ?? env.ONE_TIME_PRODUCT_KEY ?? 'one_time_mishnah_class',
    mode,
    ...(env.BUFFER_ACCESS_TOKEN ? { bufferAccessToken: env.BUFFER_ACCESS_TOKEN } : {}),
    ...(organizationId ? { bufferOrganizationId: organizationId } : {}),
    channels,
    maxAttempts: Number(env.OT106_BUFFER_MAX_ATTEMPTS ?? DEFAULT_MAX_ATTEMPTS),
  };
}

export function parseOt106BufferChannelAliases(
  value: string | undefined,
  organizationId = 'buffer_org_unconfigured',
): Ot106BufferChannelBinding[] {
  if (!value?.trim()) return [];
  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed) as unknown;
    return zodBindingArray(parsed);
  }
  return trimmed
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [aliasRaw, restRaw] = entry.split('=');
      if (!aliasRaw || !restRaw) throw new Error('Invalid OT106 channel alias entry.');
      const [channelId, platformRaw, ...labelParts] = restRaw.split(':');
      return ot106BufferChannelBindingSchema.parse({
        alias: aliasRaw.trim(),
        channel_id: String(channelId ?? '').trim(),
        platform: ot106PlatformSchema.parse((platformRaw ?? 'facebook').trim()),
        organization_id: organizationId,
        label: labelParts.join(':').trim() || aliasRaw.trim(),
        timezone: 'UTC',
      });
    });
}

export function inspectOt106BufferReadiness(config: Ot106RuntimeConfig): Ot106Readiness {
  const channelProjection = config.channels.map((channel) => ({
    alias: channel.alias,
    platform: channel.platform,
    channel_fingerprint: sha256(channel.channel_id).slice(0, 16),
    label: channel.label,
  }));
  if (config.mode === 'disabled') {
    return ot106ReadinessSchema.parse({
      provider: 'buffer',
      mode: config.mode,
      state: 'disabled',
      can_create_draft: false,
      can_schedule: false,
      missing_capability_classes: ['provider_mode'],
      channels: channelProjection,
      safe_reason_code: 'ot106_provider_disabled',
    });
  }
  if (config.channels.length < 1) {
    return ot106ReadinessSchema.parse({
      provider: 'buffer',
      mode: config.mode,
      state: 'channels_missing',
      can_create_draft: false,
      can_schedule: false,
      missing_capability_classes: ['channel_aliases'],
      channels: [],
      safe_reason_code: 'ot106_channel_aliases_missing',
    });
  }
  if (config.mode === 'sink') {
    return ot106ReadinessSchema.parse({
      provider: 'buffer',
      mode: config.mode,
      state: 'sink_ready',
      can_create_draft: true,
      can_schedule: false,
      missing_capability_classes: [],
      channels: channelProjection,
      safe_reason_code: 'ot106_sink_ready',
    });
  }
  const missing: string[] = [];
  if (!config.bufferAccessToken) missing.push('access_token');
  if (!config.bufferOrganizationId) missing.push('organization_id');
  if (missing.length > 0) {
    return ot106ReadinessSchema.parse({
      provider: 'buffer',
      mode: config.mode,
      state: 'unconfigured',
      can_create_draft: false,
      can_schedule: false,
      missing_capability_classes: missing,
      channels: channelProjection,
      safe_reason_code: 'ot106_buffer_configuration_missing',
    });
  }
  return ot106ReadinessSchema.parse({
    provider: 'buffer',
    mode: config.mode,
    state: config.mode === 'buffer_scheduled' ? 'ready_to_schedule' : 'ready_to_create_drafts',
    can_create_draft: true,
    can_schedule: config.mode === 'buffer_scheduled',
    missing_capability_classes: [],
    channels: channelProjection,
    safe_reason_code: 'ot106_buffer_configured',
  });
}

export function createOt106SinkAdapter(): Ot106BufferAdapter {
  return {
    createPost: async (input) => ({
      status: input.operation === 'scheduled' ? 'scheduled' : 'created',
      provider_post_id: stableKey('ot106_sink_post', [
        input.manifest.manifest_id,
        input.targetAlias,
        input.operation,
      ]),
      sanitized_code: 'sink_provider_no_external_write',
      retryable: false,
      response_sha256: sha256(canonicalOt106Json({ sink: true, input })),
      external_write_performed: false,
    }),
  };
}

export function createOt106BufferGraphqlAdapter(input: {
  accessToken: string;
  fetchFn?: typeof fetch;
  endpoint?: string;
  timeoutMs?: number;
}): Ot106BufferAdapter {
  const fetchFn = input.fetchFn ?? fetch;
  const endpoint = input.endpoint ?? 'https://api.buffer.com';
  const timeoutMs = input.timeoutMs ?? 15_000;
  return {
    createPost: async (postInput) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const graphInput = toBufferCreatePostInput(postInput);
        const response = await fetchFn(endpoint, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${input.accessToken}`,
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({
            query: CREATE_POST_MUTATION,
            variables: { input: graphInput },
          }),
          signal: controller.signal,
        });
        const bodyText = await response.text();
        return parseBufferGraphqlCreatePostResponse({
          httpStatus: response.status,
          retryAfter: response.headers.get('retry-after'),
          bodyText,
          operation: postInput.operation,
        });
      } catch (error) {
        return {
          status: 'retryable_failure',
          sanitized_code: sanitizeOt106ProviderError(error).slice(0, 120) || 'buffer_timeout',
          retryable: true,
          response_sha256: null,
          external_write_performed: false,
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export function parseBufferGraphqlCreatePostResponse(input: {
  httpStatus: number;
  retryAfter?: string | null;
  bodyText: string;
  operation: Ot106ProviderOperation;
}): Ot106ProviderResult {
  const responseSha = sha256(input.bodyText);
  const retryAfter = parseRetryAfter(input.retryAfter);
  if (input.httpStatus === 429) {
    return {
      status: 'retryable_failure',
      sanitized_code: 'buffer_rate_limit_exceeded',
      retryable: true,
      retry_after_seconds: retryAfter,
      response_sha256: responseSha,
      http_status: input.httpStatus,
      external_write_performed: false,
    };
  }
  if (input.httpStatus === 401 || input.httpStatus === 403) {
    return {
      status: 'dead_lettered',
      sanitized_code: input.httpStatus === 401 ? 'buffer_unauthorized' : 'buffer_forbidden',
      retryable: false,
      response_sha256: responseSha,
      http_status: input.httpStatus,
      external_write_performed: false,
    };
  }
  if (input.httpStatus >= 500) {
    return {
      status: 'retryable_failure',
      sanitized_code: 'buffer_server_error',
      retryable: true,
      retry_after_seconds: retryAfter,
      response_sha256: responseSha,
      http_status: input.httpStatus,
      external_write_performed: false,
    };
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(input.bodyText) as Record<string, unknown>;
  } catch {
    return {
      status: 'retryable_failure',
      sanitized_code: 'buffer_non_json_response',
      retryable: true,
      response_sha256: responseSha,
      http_status: input.httpStatus,
      external_write_performed: false,
    };
  }
  const errors = Array.isArray(parsed.errors) ? parsed.errors : [];
  if (errors.length > 0) {
    const first = asRecord(errors[0]);
    const code = String(asRecord(first.extensions).code ?? 'GRAPHQL_ERROR');
    const retryable = code === 'RATE_LIMIT_EXCEEDED' || code === 'UNEXPECTED';
    return {
      status: retryable ? 'retryable_failure' : 'dead_lettered',
      sanitized_code: `buffer_graphql_${code.toLowerCase()}`.slice(0, 120),
      retryable,
      retry_after_seconds: retryAfter,
      response_sha256: responseSha,
      http_status: input.httpStatus,
      external_write_performed: false,
    };
  }
  const createPost = asRecord(asRecord(parsed.data).createPost);
  const post = asRecord(createPost.post);
  if (post.id) {
    return {
      status: input.operation === 'scheduled' ? 'scheduled' : 'created',
      provider_post_id: String(post.id),
      sanitized_code: input.operation === 'scheduled' ? 'buffer_scheduled' : 'buffer_draft_created',
      retryable: false,
      response_sha256: responseSha,
      http_status: input.httpStatus,
      external_write_performed: true,
    };
  }
  const message = String(createPost.message ?? '');
  if (message) {
    const sanitized = sanitizeOt106ProviderError(message).toLowerCase();
    const retryable = sanitized.includes('rate') || sanitized.includes('temporar');
    return {
      status: retryable ? 'retryable_failure' : 'dead_lettered',
      sanitized_code: retryable ? 'buffer_mutation_retryable' : 'buffer_mutation_error',
      retryable,
      retry_after_seconds: retryAfter,
      response_sha256: responseSha,
      http_status: input.httpStatus,
      external_write_performed: false,
    };
  }
  return {
    status: 'retryable_failure',
    sanitized_code: 'buffer_unknown_response_shape',
    retryable: true,
    response_sha256: responseSha,
    http_status: input.httpStatus,
    external_write_performed: false,
  };
}

export function sanitizeOt106ProviderError(error: unknown) {
  return String(error instanceof Error ? error.message : error)
    .replaceAll(/[A-Za-z0-9_-]{24,}/g, '[redacted-token]')
    .replaceAll(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted-token]')
    .replaceAll(/(access_token|buffer_token|client_secret)=([^&\s]+)/gi, '$1=[redacted-token]');
}

async function processManifestTargets(input: {
  pool: DbPool;
  manifest: Ot106PublicationManifest;
  config: Ot106RuntimeConfig;
  adapter: Ot106BufferAdapter;
  now: Date;
}) {
  const targetStates = await getTargetStates(input.pool, input.manifest.manifest_id);
  let providerWrites = 0;
  let providerDrafts = 0;
  let scheduled = 0;
  let failed = 0;
  for (const target of input.manifest.targets) {
    const currentState = targetStates.get(target.alias);
    if (currentState && !['queued', 'retryable_failure'].includes(currentState)) continue;
    const targetId = stableKey('ot106_target', [input.manifest.manifest_id, target.alias]);
    const binding = input.config.channels.find((candidate) => candidate.alias === target.alias);
    if (!binding) {
      failed += 1;
      await markTargetFailure(input.pool, {
        manifest: input.manifest,
        targetId,
        targetAlias: target.alias,
        state: 'dead_lettered',
        reasonCode: 'channel_alias_not_allowlisted',
        now: input.now,
      });
      continue;
    }
    if (target.platform && target.platform !== binding.platform) {
      failed += 1;
      await markTargetFailure(input.pool, {
        manifest: input.manifest,
        targetId,
        targetAlias: target.alias,
        state: 'dead_lettered',
        reasonCode: 'channel_alias_platform_mismatch',
        now: input.now,
      });
      continue;
    }
    const operation = operationFor(input.manifest, input.config);
    if (operation === 'scheduled' && !input.manifest.due_at_utc) {
      failed += 1;
      await markTargetFailure(input.pool, {
        manifest: input.manifest,
        targetId,
        targetAlias: target.alias,
        state: 'dead_lettered',
        reasonCode: 'scheduled_due_at_missing',
        now: input.now,
      });
      continue;
    }
    const postInput: Ot106ProviderPostInput = {
      manifest: input.manifest,
      targetAlias: target.alias,
      binding,
      operation,
      text: renderPostText(input.manifest),
      assets: safeBufferAssets(input.manifest.media),
    };
    const provider = await input.adapter.createPost(postInput);
    if (provider.external_write_performed) providerWrites += 1;
    await recordProviderAttempt(input.pool, {
      manifest: input.manifest,
      targetId,
      targetAlias: target.alias,
      operation,
      provider,
      now: input.now,
    });
    if (provider.status === 'created' || provider.status === 'scheduled') {
      if (provider.status === 'created') providerDrafts += 1;
      else scheduled += 1;
      await markTargetSuccess(input.pool, {
        manifest: input.manifest,
        targetId,
        targetAlias: target.alias,
        binding,
        state: provider.status === 'created' ? 'provider_draft_created' : 'scheduled',
        providerPostId: provider.provider_post_id ?? null,
        reasonCode: provider.sanitized_code,
        now: input.now,
      });
    } else if (provider.retryable) {
      failed += 1;
      await markTargetFailure(input.pool, {
        manifest: input.manifest,
        targetId,
        targetAlias: target.alias,
        state: 'retryable_failure',
        reasonCode: provider.sanitized_code,
        retryAfterSeconds: provider.retry_after_seconds ?? null,
        now: input.now,
      });
    } else {
      failed += 1;
      await markTargetFailure(input.pool, {
        manifest: input.manifest,
        targetId,
        targetAlias: target.alias,
        state: 'dead_lettered',
        reasonCode: provider.sanitized_code,
        now: input.now,
      });
    }
  }
  const finalState = await finalManifestStateFromTargets(input.pool, input.manifest.manifest_id);
  await updateManifestState(input.pool, input.manifest.manifest_id, finalState, input.now);
  return { provider_writes: providerWrites, provider_drafts: providerDrafts, scheduled, failed };
}

async function getTargetStates(pool: DbPool, manifestId: string) {
  const rows = await pool.query(
    `SELECT target_alias, target_state
       FROM onetime.ot106_publication_targets
      WHERE manifest_id = $1`,
    [manifestId],
  );
  return new Map(rows.rows.map((row) => [String(row.target_alias), String(row.target_state)]));
}

async function finalManifestStateFromTargets(
  pool: DbPool,
  manifestId: string,
): Promise<Ot106PublicationState> {
  const rows = await pool.query(
    `SELECT target_state, count(*)::int AS count
       FROM onetime.ot106_publication_targets
      WHERE manifest_id = $1
      GROUP BY target_state`,
    [manifestId],
  );
  const counts = new Map(rows.rows.map((row) => [String(row.target_state), Number(row.count)]));
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  if ((counts.get('retryable_failure') ?? 0) > 0) return 'retryable_failure';
  if ((counts.get('queued') ?? 0) > 0) return 'queued';
  if ((counts.get('validated') ?? 0) > 0) return 'validated';
  if ((counts.get('dead_lettered') ?? 0) >= total) return 'dead_lettered';
  if ((counts.get('canceled') ?? 0) >= total) return 'canceled';
  if ((counts.get('scheduled') ?? 0) > 0 && (counts.get('provider_draft_created') ?? 0) === 0) {
    return 'scheduled';
  }
  return 'provider_draft_created';
}

async function claimManifest(
  pool: DbPool,
  manifestId: string,
  leaseOwner: string | undefined,
  now: Date,
) {
  const result = await pool.query(
    `UPDATE onetime.ot106_publication_manifests
        SET state = 'validated',
            lease_owner = $2,
            lease_expires_at = $3,
            attempts = attempts + 1,
            generation = generation + 1,
            updated_at = $3
      WHERE manifest_id = $1
        AND state IN ('queued', 'retryable_failure')
        AND next_attempt_at <= $3
      RETURNING manifest_id`,
    [manifestId, leaseOwner ?? 'ot106-buffer-runtime', now],
  );
  return Boolean(result.rowCount);
}

function operationFor(
  manifest: Ot106PublicationManifest,
  config: Ot106RuntimeConfig,
): Ot106ProviderOperation {
  if (manifest.mode === 'scheduled' && config.mode === 'buffer_scheduled') return 'scheduled';
  return 'draft';
}

function renderPostText(manifest: Ot106PublicationManifest) {
  const hashtags = manifest.caption.hashtags.filter(
    (value, index, all) => all.indexOf(value) === index,
  );
  return [manifest.caption.text, hashtags.join(' ')].filter(Boolean).join('\n\n').trim();
}

function safeBufferAssets(media: Ot106MediaDerivative[]) {
  return media
    .filter((item) => isSafeStableHttpsMedia(item))
    .map((item) =>
      item.kind === 'image' ? { image: { url: item.url } } : { video: { url: item.url } },
    );
}

function toBufferCreatePostInput(input: Ot106ProviderPostInput) {
  return {
    text: input.text,
    channelId: input.binding.channel_id,
    schedulingType: 'automatic',
    mode: input.operation === 'scheduled' ? 'customScheduled' : 'addToQueue',
    dueAt: input.operation === 'scheduled' ? input.manifest.due_at_utc : undefined,
    saveToDraft: input.operation === 'draft' ? true : undefined,
    assets: input.assets,
    source: 'onetime-ot106',
    aiAssisted: false,
  };
}

async function markTargetSuccess(
  pool: DbPool,
  input: {
    manifest: Ot106PublicationManifest;
    targetId: string;
    targetAlias: string;
    binding: Ot106BufferChannelBinding;
    state: Ot106PublicationState;
    providerPostId: string | null;
    reasonCode: string;
    now: Date;
  },
) {
  await pool.query(
    `UPDATE onetime.ot106_publication_targets
        SET target_state = $2,
            organization_id = $3,
            channel_id = $4,
            provider_post_id = $5,
            last_error_code = NULL,
            updated_at = $6
      WHERE target_id = $1`,
    [
      input.targetId,
      input.state,
      input.binding.organization_id,
      input.binding.channel_id,
      input.providerPostId,
      input.now,
    ],
  );
  await recordAudit(pool, {
    manifestId: input.manifest.manifest_id,
    targetAlias: input.targetAlias,
    action: 'target_provider_success',
    reasonCode: input.reasonCode,
    correlationId: input.manifest.manifest_id,
    now: input.now,
    metadata: { state: input.state },
  });
}

async function markTargetFailure(
  pool: DbPool,
  input: {
    manifest: Ot106PublicationManifest;
    targetId: string;
    targetAlias: string;
    state: 'retryable_failure' | 'dead_lettered';
    reasonCode: string;
    retryAfterSeconds?: number | null;
    now: Date;
  },
) {
  const nextAttemptAt =
    input.state === 'retryable_failure'
      ? new Date(input.now.getTime() + (input.retryAfterSeconds ?? 60) * 1000)
      : input.now;
  await pool.query(
    `UPDATE onetime.ot106_publication_targets
        SET target_state = $2,
            last_error_code = $3,
            next_attempt_at = $4,
            updated_at = $5
      WHERE target_id = $1`,
    [input.targetId, input.state, input.reasonCode, nextAttemptAt, input.now],
  );
  await pool.query(
    `UPDATE onetime.ot106_publication_manifests
        SET next_attempt_at = CASE
              WHEN $2 = 'retryable_failure' THEN $3
              ELSE next_attempt_at
            END,
            last_error_code = $4,
            updated_at = $5
      WHERE manifest_id = $1`,
    [input.manifest.manifest_id, input.state, nextAttemptAt, input.reasonCode, input.now],
  );
  await recordAudit(pool, {
    manifestId: input.manifest.manifest_id,
    targetAlias: input.targetAlias,
    action: 'target_provider_failure',
    reasonCode: input.reasonCode,
    correlationId: input.manifest.manifest_id,
    now: input.now,
    metadata: { state: input.state },
  });
}

async function updateManifestState(
  pool: DbPool,
  manifestId: string,
  state: Ot106PublicationState,
  now: Date,
) {
  const parsed = ot106PublicationStateSchema.parse(state);
  await pool.query(
    `UPDATE onetime.ot106_publication_manifests
        SET state = $2,
            lease_owner = NULL,
            lease_expires_at = NULL,
            updated_at = $3
      WHERE manifest_id = $1`,
    [manifestId, parsed, now],
  );
}

async function recordProviderAttempt(
  pool: DbPool,
  input: {
    manifest: Ot106PublicationManifest;
    targetId: string;
    targetAlias: string;
    operation: Ot106ProviderOperation;
    provider: Ot106ProviderResult;
    now: Date;
  },
) {
  await pool.query(
    `INSERT INTO onetime.ot106_provider_attempts
       (attempt_id, manifest_id, target_id, target_alias, provider, operation,
        attempt_number, http_status, retryable, retry_after_seconds, sanitized_code,
        response_sha256, provider_post_id, external_write_performed, created_at)
     VALUES ($1,$2,$3,$4,'buffer',$5,
       COALESCE((SELECT max(attempt_number) + 1 FROM onetime.ot106_provider_attempts WHERE target_id = $3), 1),
       $6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (attempt_id) DO NOTHING`,
    [
      stableKey('ot106_attempt', [input.targetId, input.operation, input.now.toISOString()]),
      input.manifest.manifest_id,
      input.targetId,
      input.targetAlias,
      input.operation,
      input.provider.http_status ?? null,
      input.provider.retryable,
      input.provider.retry_after_seconds ?? null,
      input.provider.sanitized_code,
      input.provider.response_sha256 ?? null,
      input.provider.provider_post_id ?? null,
      input.provider.external_write_performed,
      input.now,
    ],
  );
}

async function recordAudit(
  clientOrPool: Queryable,
  input: {
    manifestId: string;
    targetAlias?: string | null;
    action: string;
    reasonCode: string;
    correlationId: string;
    now: Date;
    metadata: Record<string, unknown>;
  },
) {
  await clientOrPool.query(
    `INSERT INTO onetime.ot106_audit_events
       (audit_id, manifest_id, target_alias, actor_id, action, reason_code,
        correlation_id, safe_metadata_json, created_at)
     VALUES ($1,$2,$3,'ot106-buffer-runtime',$4,$5,$6,$7::jsonb,$8)
     ON CONFLICT (audit_id) DO NOTHING`,
    [
      stableKey('ot106_audit', [
        input.manifestId,
        input.targetAlias ?? '',
        input.action,
        input.now.toISOString(),
      ]),
      input.manifestId,
      input.targetAlias ?? null,
      input.action,
      input.reasonCode,
      input.correlationId,
      JSON.stringify(input.metadata),
      input.now,
    ],
  );
}

function assertManifestSafe(manifest: Ot106PublicationManifest, now: Date) {
  if (manifest.mode === 'scheduled') {
    const due = new Date(String(manifest.due_at_utc));
    if (due.getTime() <= now.getTime()) {
      throw new Ot106BufferRuntimeError(
        'PAST_SCHEDULE',
        'Scheduled manifests require future due_at.',
      );
    }
  }
  if (hasPrivacyFlags(manifest.privacy)) {
    throw new Ot106BufferRuntimeError('PRIVACY_REJECTED', 'Privacy flags block social publishing.');
  }
  for (const media of manifest.media) {
    if (hasPrivacyFlags(media.privacy) || !isSafeStableHttpsMedia(media)) {
      throw new Ot106BufferRuntimeError(
        'UNSAFE_MEDIA_REJECTED',
        'Unsafe media derivative blocks social publishing.',
      );
    }
  }
}

function isSafeStableHttpsMedia(media: Ot106MediaDerivative) {
  if (
    !media.public_safety.direct_public_url ||
    !media.public_safety.no_authentication_required ||
    !media.public_safety.not_signed_or_expiring ||
    !media.public_safety.privacy_review_passed ||
    !media.public_safety.stable_https_url
  ) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(media.url);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (
    BLOCKED_MEDIA_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
  ) {
    return false;
  }
  const query = url.searchParams.toString().toLowerCase();
  return !SIGNED_URL_MARKERS.some((marker) => query.includes(marker));
}

function hasPrivacyFlags(privacy: Record<string, unknown>) {
  return (
    privacy.contains_learner_name === true ||
    privacy.contains_learner_voice === true ||
    privacy.contains_learner_face === true ||
    privacy.contains_learner_question === true ||
    privacy.contains_private_data === true ||
    privacy.approved_for_social !== true
  );
}

function normalizeHeaders(headers: {
  contentType?: string | null;
  keyId?: string | null;
  timestamp?: string | null;
  deliveryId?: string | null;
  signature?: string | null;
}) {
  return {
    contentType:
      String(headers.contentType ?? '')
        .split(';')[0]
        ?.trim()
        .toLowerCase() ?? '',
    keyId: headers.keyId ?? '',
    timestamp: headers.timestamp ?? '',
    deliveryId: headers.deliveryId ?? '',
    signature: headers.signature ?? '',
  };
}

function verifySignature(secret: string, timestamp: string, rawBody: Buffer, signature: string) {
  const expected = signOt106Manifest({ secret, timestamp, rawBody });
  const left = Buffer.from(expected, 'utf8');
  const right = Buffer.from(signature, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

function isFreshTimestamp(value: string, now: Date) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return false;
  return Math.abs(now.getTime() / 1000 - seconds) <= FRESH_SECONDS;
}

function zodBindingArray(value: unknown) {
  return zodArray(value).map((entry) => ot106BufferChannelBindingSchema.parse(entry));
}

function zodArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Expected OT106 channel alias array.');
  return value;
}

function parseRetryAfter(value: string | null | undefined) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  const date = Date.parse(value);
  if (Number.isFinite(date)) return Math.max(0, Math.ceil((date - Date.now()) / 1000));
  return null;
}

function parseJson(value: unknown) {
  if (typeof value !== 'string') return value;
  return JSON.parse(value) as unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stableKey(prefix: string, parts: string[]) {
  return `${prefix}_${sha256(parts.join('\0')).slice(0, 32)}`;
}

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

const CREATE_POST_MUTATION = `
mutation Ot106CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    ... on PostActionSuccess {
      post {
        id
        text
        dueAt
        channelId
        status
      }
    }
    ... on MutationError {
      message
    }
  }
}`;
