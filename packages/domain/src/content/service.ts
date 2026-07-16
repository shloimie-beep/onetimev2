import { createHash } from 'node:crypto';
import type { AppConfig } from '../../../config/src/index.ts';
import {
  contentLibraryListQuerySchema,
  contentOutcomePayloadSchema,
  type ContentItemType,
  type ContentLibraryItemDetail,
  type ContentLibraryItemSummary,
  type ContentLifecycleState,
  type ContentOutcomeAdmission,
  type ContentOutcomePayload,
} from '../../../contracts/src/content/index.ts';
import type {
  LibraryItem,
  ProtectedActionDescriptor,
} from '../../../contracts/src/portals/index.ts';
import type { DbPool, Queryable } from '../../../db/src/index.ts';
import { inTransaction } from '../../../db/src/index.ts';
import { stableKey } from '../lead/normalize.ts';
import type { LearnerContentAccessAdapter } from '../portals/services.ts';

export class ContentIdempotencyConflictError extends Error {
  constructor() {
    super('Content outcome idempotency key was already used for a different request.');
  }
}

type RedactionResult = {
  value: unknown;
  count: number;
};

type SanitizedOutcome = {
  transcript_metadata: Record<string, unknown>;
  source_metadata: Record<string, unknown>;
  review_sheet_metadata: Record<string, unknown>;
  playback_descriptor: Record<string, unknown>;
  redaction_count: number;
  provider_event_ref_digest: string | null;
  source_ref_digest: string | null;
};

export async function admitContentOutcome(input: {
  pool: DbPool;
  config: AppConfig;
  payload: unknown;
  actorUserKey?: string | null;
  now?: Date;
}): Promise<ContentOutcomeAdmission> {
  const payload = contentOutcomePayloadSchema.parse(input.payload);
  const requestHash = fingerprint(payload);
  const now = input.now ?? new Date();

  return inTransaction(input.pool, async (client) => {
    const existing = await client.query(
      `SELECT request_hash, response_json
         FROM onetime.content_outcome_idempotency_records
        WHERE account_key = $1
          AND product_key = $2
          AND idempotency_key = $3
        LIMIT 1`,
      [input.config.accountKey, input.config.productKey, payload.idempotency_key],
    );
    if (existing.rowCount) {
      if (existing.rows[0].request_hash !== requestHash) {
        throw new ContentIdempotencyConflictError();
      }
      return {
        ...(existing.rows[0].response_json as ContentOutcomeAdmission),
        admission_state: 'replayed',
      };
    }

    const admission = await admitNewContentOutcome({
      client,
      config: input.config,
      payload,
      actorUserKey: input.actorUserKey ?? null,
      now,
    });
    await client.query(
      `INSERT INTO onetime.content_outcome_idempotency_records
         (account_key, product_key, idempotency_key, request_hash, response_json)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        input.config.accountKey,
        input.config.productKey,
        payload.idempotency_key,
        requestHash,
        JSON.stringify(admission),
      ],
    );
    return admission;
  });
}

export async function listContentLibrary(input: {
  pool: DbPool;
  config: AppConfig;
  query?: unknown;
}): Promise<ContentLibraryItemSummary[]> {
  const query = contentLibraryListQuerySchema.parse(input.query ?? {});
  const values: unknown[] = [input.config.accountKey, input.config.productKey];
  const filters = [`account_key = $1`, `product_key = $2`];
  if (query.lifecycle_state) {
    values.push(query.lifecycle_state);
    filters.push(`lifecycle_state = $${values.length}`);
  }
  if (query.item_type) {
    values.push(query.item_type);
    filters.push(`item_type = $${values.length}`);
  }
  if (query.occurrence_key) {
    values.push(query.occurrence_key);
    filters.push(`occurrence_key = $${values.length}`);
  }
  values.push(query.limit);
  const result = await input.pool.query(
    `SELECT *
       FROM onetime.content_items
      WHERE ${filters.join(' AND ')}
      ORDER BY updated_at DESC, content_item_key ASC
      LIMIT $${values.length}`,
    values,
  );
  return result.rows.map(contentItemSummary);
}

export async function getContentItemDetail(input: {
  pool: DbPool;
  config: AppConfig;
  itemKey: string;
}): Promise<ContentLibraryItemDetail | null> {
  return getContentItemDetailFrom(input.pool, input.config, input.itemKey);
}

export function createContentPortalAccessAdapter(input: {
  pool: DbPool;
  config: AppConfig;
}): LearnerContentAccessAdapter {
  return {
    publishedLibraryForLearner: async ({ actor, learner }) =>
      portalItemsForLearner({
        pool: input.pool,
        accountKey: actor.account_key,
        productKey: actor.product_key,
        actorRole: actor.actor_role,
        learnerKey: learner.learner_key,
        householdKey: learner.household_key,
        itemTypes: ['video', 'source'],
      }),
    reviewSheetsForLearner: async ({ actor, learner }) =>
      portalItemsForLearner({
        pool: input.pool,
        accountKey: actor.account_key,
        productKey: actor.product_key,
        actorRole: actor.actor_role,
        learnerKey: learner.learner_key,
        householdKey: learner.household_key,
        itemTypes: ['sheet', 'review'],
      }),
  };
}

export function redactProviderMetadata(value: unknown): RedactionResult {
  if (Array.isArray(value)) {
    let count = 0;
    const next = value.map((entry) => {
      const redacted = redactProviderMetadata(entry);
      count += redacted.count;
      return redacted.value;
    });
    return { value: next, count };
  }
  if (value && typeof value === 'object') {
    let count = 0;
    const entries = Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
      const safeKey = safeMetadataKey(key);
      if (safeKey !== key) count += 1;
      if (typeof entry === 'string' && shouldRedactMetadataValue(key, entry)) {
        count += 1;
        return [safeKey, redactedMarker(entry)] as const;
      }
      const redacted = redactProviderMetadata(entry);
      count += redacted.count;
      return [safeKey, redacted.value] as const;
    });
    return { value: Object.fromEntries(entries), count };
  }
  if (typeof value === 'string' && shouldRedactMetadataValue('', value)) {
    return { value: redactedMarker(value), count: 1 };
  }
  return { value, count: 0 };
}

async function admitNewContentOutcome(input: {
  client: Queryable;
  config: AppConfig;
  payload: ContentOutcomePayload;
  actorUserKey: string | null;
  now: Date;
}): Promise<ContentOutcomeAdmission> {
  const sanitized = sanitizeOutcome(input.payload);
  const itemKey = input.payload.item_key;
  const revisionKey = stableKey('content_revision', [
    input.config.accountKey,
    input.config.productKey,
    itemKey,
    String(input.payload.revision_number),
  ]);
  const outcomeEventKey = stableKey('content_outcome_event', [
    input.config.accountKey,
    input.config.productKey,
    input.payload.idempotency_key,
  ]);

  await input.client.query(
    `INSERT INTO onetime.content_items
       (content_item_key, account_key, product_key, occurrence_key, title, item_type,
        lifecycle_state, metadata, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'received', '{}'::jsonb, $7)
     ON CONFLICT (account_key, product_key, content_item_key)
     DO UPDATE SET
       title = EXCLUDED.title,
       item_type = EXCLUDED.item_type,
       occurrence_key = COALESCE(EXCLUDED.occurrence_key, onetime.content_items.occurrence_key),
       updated_at = EXCLUDED.updated_at`,
    [
      itemKey,
      input.config.accountKey,
      input.config.productKey,
      input.payload.occurrence_key,
      input.payload.title,
      input.payload.item_type,
      input.now,
    ],
  );

  const current = await input.client.query(
    `SELECT latest_revision_number, latest_revision_key
       FROM onetime.content_items
      WHERE account_key = $1
        AND product_key = $2
        AND content_item_key = $3
      LIMIT 1`,
    [input.config.accountKey, input.config.productKey, itemKey],
  );
  const currentLatest = Number(current.rows[0]?.latest_revision_number ?? 0);
  const currentLatestKey = nullableString(current.rows[0]?.latest_revision_key);
  const isStale = currentLatest >= input.payload.revision_number;
  const revisionState: ContentLifecycleState = isStale
    ? 'superseded'
    : input.payload.lifecycle_state;

  await input.client.query(
    `INSERT INTO onetime.content_revisions
       (revision_key, account_key, product_key, content_item_key, outcome_event_key,
        revision_number, lifecycle_state, transcript_metadata, source_metadata,
        review_sheet_metadata, playback_descriptor, provider_event_ref_digest, source_ref_digest,
        raw_provider_target_present, supersedes_revision_key, received_at, published_at, failed_at,
        superseded_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb,
        $12, $13, false, $14, $15, $16, $17, $18)
     ON CONFLICT (account_key, product_key, content_item_key, revision_number) DO NOTHING`,
    [
      revisionKey,
      input.config.accountKey,
      input.config.productKey,
      itemKey,
      outcomeEventKey,
      input.payload.revision_number,
      revisionState,
      JSON.stringify(sanitized.transcript_metadata),
      JSON.stringify(sanitized.source_metadata),
      JSON.stringify(sanitized.review_sheet_metadata),
      JSON.stringify(sanitized.playback_descriptor),
      sanitized.provider_event_ref_digest,
      sanitized.source_ref_digest,
      currentLatestKey,
      input.now,
      revisionState === 'published' ? input.now : null,
      revisionState === 'failed' ? input.now : null,
      isStale ? input.now : null,
    ],
  );

  if (!isStale) {
    await input.client.query(
      `UPDATE onetime.content_revisions
          SET lifecycle_state = 'superseded',
              superseded_at = COALESCE(superseded_at, $4)
        WHERE account_key = $1
          AND product_key = $2
          AND content_item_key = $3
          AND revision_number < $5
          AND lifecycle_state <> 'superseded'`,
      [
        input.config.accountKey,
        input.config.productKey,
        itemKey,
        input.now,
        input.payload.revision_number,
      ],
    );
    await input.client.query(
      `UPDATE onetime.content_items
          SET lifecycle_state = $4,
              latest_revision_number = $5,
              latest_revision_key = $6,
              published_revision_key = CASE
                WHEN $4 = 'published' THEN $6
                ELSE published_revision_key
              END,
              published_at = CASE
                WHEN $4 = 'published' THEN $7
                ELSE published_at
              END,
              updated_at = $7
        WHERE account_key = $1
          AND product_key = $2
          AND content_item_key = $3`,
      [
        input.config.accountKey,
        input.config.productKey,
        itemKey,
        input.payload.lifecycle_state,
        input.payload.revision_number,
        revisionKey,
        input.now,
      ],
    );
  }

  if (
    !isStale &&
    input.payload.lifecycle_state === 'published' &&
    input.payload.entitlement_scope === 'all_active_learners'
  ) {
    await grantAllActiveLearnersEntitlement(input.client, input.config, itemKey, input.now);
  }

  await recordContentAudit(input.client, {
    config: input.config,
    itemKey,
    revisionKey,
    actorUserKey: input.actorUserKey,
    actionType: isStale ? 'content_outcome_stale_ignored' : 'content_outcome_admitted',
    metadata: {
      lifecycle_state: revisionState,
      revision_number: input.payload.revision_number,
      redaction_count: sanitized.redaction_count,
      raw_provider_target_present: false,
    },
    now: input.now,
  });

  if (sanitized.redaction_count > 0) {
    await input.client.query(
      `INSERT INTO onetime.content_redaction_events
         (redaction_key, account_key, product_key, content_item_key, revision_key,
          redaction_count, redacted_metadata_digest, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (redaction_key) DO NOTHING`,
      [
        stableKey('content_redaction', [itemKey, revisionKey]),
        input.config.accountKey,
        input.config.productKey,
        itemKey,
        revisionKey,
        sanitized.redaction_count,
        fingerprint({
          transcript_metadata: sanitized.transcript_metadata,
          source_metadata: sanitized.source_metadata,
          review_sheet_metadata: sanitized.review_sheet_metadata,
          playback_descriptor: sanitized.playback_descriptor,
        }),
        input.now,
      ],
    );
  }

  const item = await getContentItemDetailFrom(input.client, input.config, itemKey);
  if (!item) throw new Error('Content item was not persisted.');
  return {
    admission_state: isStale ? 'ignored_stale' : 'accepted',
    item_key: itemKey,
    revision_key: revisionKey,
    revision_number: input.payload.revision_number,
    lifecycle_state: revisionState,
    raw_provider_target_present: false,
    redaction_count: sanitized.redaction_count,
    item,
  };
}

async function getContentItemDetailFrom(
  pool: DbPool | Queryable,
  config: AppConfig,
  itemKey: string,
): Promise<ContentLibraryItemDetail | null> {
  const itemResult = await pool.query(
    `SELECT *
       FROM onetime.content_items
      WHERE account_key = $1
        AND product_key = $2
        AND content_item_key = $3
      LIMIT 1`,
    [config.accountKey, config.productKey, itemKey],
  );
  const item = itemResult.rows[0];
  if (!item) return null;
  const revisionResult = await pool.query(
    `SELECT *
       FROM onetime.content_revisions
      WHERE account_key = $1
        AND product_key = $2
        AND content_item_key = $3
      ORDER BY revision_number DESC
      LIMIT 10`,
    [config.accountKey, config.productKey, itemKey],
  );
  return {
    ...contentItemSummary(item),
    revisions: revisionResult.rows.map(contentRevisionSummary),
  };
}

async function portalItemsForLearner(input: {
  pool: DbPool;
  accountKey: string;
  productKey: string;
  actorRole: string;
  learnerKey: string;
  householdKey: string;
  itemTypes: ContentItemType[];
}): Promise<LibraryItem[]> {
  const result = await input.pool.query(
    `SELECT items.*
       FROM onetime.content_items AS items
       JOIN onetime.content_item_entitlements AS entitlements
         ON entitlements.account_key = items.account_key
        AND entitlements.product_key = items.product_key
        AND entitlements.content_item_key = items.content_item_key
      WHERE items.account_key = $1
        AND items.product_key = $2
        AND items.retention_state = 'active'
        AND items.published_revision_key IS NOT NULL
        AND items.item_type = ANY($3)
        AND entitlements.entitlement_state = 'active'
        AND (
          entitlements.audience = 'all_active_learners'
          OR entitlements.learner_key = $4
          OR entitlements.household_key = $5
        )
      ORDER BY items.published_at DESC, items.content_item_key ASC
      LIMIT 25`,
    [input.accountKey, input.productKey, input.itemTypes, input.learnerKey, input.householdKey],
  );
  return result.rows.map((row) => ({
    item_key: String(row.content_item_key),
    title: String(row.title),
    item_type: String(row.item_type) as LibraryItem['item_type'],
    status: 'published' as const,
    open_action: contentOpenAction(
      String(row.content_item_key),
      String(row.item_type),
      input.actorRole,
      input.householdKey,
      input.learnerKey,
    ),
  }));
}

function sanitizeOutcome(payload: ContentOutcomePayload): SanitizedOutcome {
  const transcript = redactProviderMetadata(payload.transcript_metadata);
  const source = redactProviderMetadata(payload.source_metadata);
  const review = redactProviderMetadata(payload.review_sheet_metadata);
  const playback = redactProviderMetadata(payload.playback_metadata);
  return {
    transcript_metadata: asRecord(transcript.value),
    source_metadata: asRecord(source.value),
    review_sheet_metadata: asRecord(review.value),
    playback_descriptor: asRecord(playback.value),
    redaction_count: transcript.count + source.count + review.count + playback.count,
    provider_event_ref_digest: payload.provider_event_ref
      ? digest(payload.provider_event_ref)
      : null,
    source_ref_digest: payload.source_ref ? digest(payload.source_ref) : null,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function contentItemSummary(row: Record<string, unknown>): ContentLibraryItemSummary {
  return {
    item_key: String(row.content_item_key),
    title: String(row.title),
    item_type: String(row.item_type) as ContentItemType,
    lifecycle_state: String(row.lifecycle_state) as ContentLifecycleState,
    occurrence_key: nullableString(row.occurrence_key),
    latest_revision_number: Number(row.latest_revision_number),
    latest_revision_key: nullableString(row.latest_revision_key),
    published_revision_key: nullableString(row.published_revision_key),
    published_at: nullableIso(row.published_at),
    updated_at: asDate(row.updated_at).toISOString(),
  };
}

function contentRevisionSummary(row: Record<string, unknown>) {
  return {
    revision_key: String(row.revision_key),
    revision_number: Number(row.revision_number),
    lifecycle_state: String(row.lifecycle_state) as ContentLifecycleState,
    metadata: {
      transcript_metadata: asRecord(row.transcript_metadata),
      source_metadata: asRecord(row.source_metadata),
      review_sheet_metadata: asRecord(row.review_sheet_metadata),
      playback_descriptor: asRecord(row.playback_descriptor),
    },
    raw_provider_target_present: false as const,
    published_at: nullableIso(row.published_at),
    failed_at: nullableIso(row.failed_at),
    superseded_at: nullableIso(row.superseded_at),
    created_at: asDate(row.created_at).toISOString(),
  };
}

async function grantAllActiveLearnersEntitlement(
  client: Queryable,
  config: AppConfig,
  itemKey: string,
  now: Date,
) {
  await client.query(
    `INSERT INTO onetime.content_item_entitlements
       (entitlement_key, account_key, product_key, content_item_key, audience, entitlement_state, created_at)
     VALUES ($1, $2, $3, $4, 'all_active_learners', 'active', $5)
     ON CONFLICT (account_key, product_key, entitlement_key)
     DO UPDATE SET entitlement_state = 'active', revoked_at = NULL`,
    [
      stableKey('content_entitlement', [itemKey, 'all_active_learners']),
      config.accountKey,
      config.productKey,
      itemKey,
      now,
    ],
  );
}

async function recordContentAudit(
  client: Queryable,
  input: {
    config: AppConfig;
    itemKey: string;
    revisionKey: string;
    actorUserKey: string | null;
    actionType: string;
    metadata: Record<string, unknown>;
    now: Date;
  },
) {
  await client.query(
    `INSERT INTO onetime.content_audit_events
       (audit_key, account_key, product_key, content_item_key, revision_key, actor_user_key,
        action_type, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
    [
      stableKey('content_audit', [
        input.itemKey,
        input.revisionKey,
        input.actionType,
        input.now.toISOString(),
      ]),
      input.config.accountKey,
      input.config.productKey,
      input.itemKey,
      input.revisionKey,
      input.actorUserKey,
      input.actionType,
      JSON.stringify(input.metadata),
      input.now,
    ],
  );
}

function contentOpenAction(
  itemKey: string,
  itemType: string,
  actorRole: string,
  householdKey: string,
  learnerKey: string,
): ProtectedActionDescriptor {
  const kind = itemType === 'review' || itemType === 'sheet' ? 'review_sheet_open' : 'content_open';
  const href =
    actorRole === 'parent'
      ? `/api/v1/portals/parent/households/${encodeURIComponent(
          householdKey,
        )}/learners/${encodeURIComponent(learnerKey)}/content/${encodeURIComponent(itemKey)}/open`
      : `/api/v1/portals/student/content/${encodeURIComponent(itemKey)}/open`;
  return {
    action_key: stableKey('content_open_action', [itemKey, kind]),
    label: kind === 'review_sheet_open' ? 'Open review sheet' : 'Open content',
    kind,
    method: 'GET',
    href,
    launch_token_ref: stableKey('content_launch_ref', [itemKey]),
    expires_at: null,
  };
}

function shouldRedactMetadataValue(key: string, value: string) {
  return forbiddenMetadataKey(key) || forbiddenProviderReference(value);
}

function safeMetadataKey(key: string) {
  if (!forbiddenMetadataKey(key)) return key;
  return `redacted_field_${digest(key).slice(0, 12)}`;
}

function forbiddenMetadataKey(key: string) {
  return /(url|uri|href|link|token|secret|password|credential|vimeo|zoom|drive|meet|youtube)/i.test(
    key,
  );
}

function forbiddenProviderReference(value: string) {
  return /(https?:\/\/|www\.|vimeo|zoom|drive\.google|meet\.google|youtube|youtu\.be|dropbox)/i.test(
    value,
  );
}

function redactedMarker(value: string) {
  return `[redacted:${digest(value).slice(0, 16)}]`;
}

function fingerprint(value: unknown) {
  return digest(JSON.stringify(sortForHash(value)));
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function sortForHash(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForHash);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortForHash(entry)]),
    );
  }
  return value;
}

function nullableString(value: unknown) {
  if (value === null || value === undefined) return null;
  return String(value);
}

function nullableIso(value: unknown) {
  if (value === null || value === undefined) return null;
  return asDate(value).toISOString();
}

function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) throw new Error('Database returned an invalid content date.');
  return parsed;
}
