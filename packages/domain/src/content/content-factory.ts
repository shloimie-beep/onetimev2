import { createHash } from 'node:crypto';
import type { AppConfig } from '../../../config/src/index.ts';
import {
  contentFactoryDraftSchema,
  contentFactoryEditPayloadSchema,
  contentFactoryIntakeSafeSchema,
  contentFactorySafeItemSchema,
  contentFactoryStateSchema,
  type ContentFactoryAction,
  type ContentFactoryDraft,
  type ContentFactoryEditPayload,
  type ContentFactoryIntakeSafe,
  type ContentFactorySafeItem,
  type ContentFactoryState,
} from '../../../contracts/src/content/content-factory.ts';
import {
  learningDeliveryTranscriptSegmentSchema,
  type LearningDeliveryTranscriptSegment,
} from '../../../contracts/src/content/learning-delivery.ts';
import type { PortalActorContext } from '../../../contracts/src/portals/index.ts';
import type { DbPool, Queryable } from '../../../db/src/index.ts';
import { inTransaction } from '../../../db/src/index.ts';
import { stableOt86Key } from './pipeline.ts';

const FACTORY_STATES = contentFactoryStateSchema.options;
const TORAH_TERM_PATTERNS = [
  'Mishnah',
  'Masechta',
  'Gemara',
  'Halacha',
  'Rabbi',
  'Tanna',
  'Amora',
  'Beraisa',
  'Mitzvah',
  'Pasuk',
  'Perek',
] as const;

export class ContentFactoryError extends Error {
  constructor(
    public readonly code:
      'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_STATE' | 'VALIDATION_ERROR' | 'PLAYBACK_UNAVAILABLE',
    message: string,
  ) {
    super(message);
  }
}

export class ContentFactoryPublicationError extends Error {
  constructor(
    public readonly stage: string,
    public readonly safeErrorCode: string,
  ) {
    super('Content publication could not be completed.');
  }
}

export function contentFactorySafePostgresCode(error: unknown) {
  const code =
    error && typeof error === 'object' && 'code' in error ? String(error.code).toUpperCase() : '';
  return /^[0-9A-Z]{5}$/.test(code) ? `pg_${code}` : 'publication_unexpected';
}

export type ContentFactoryIngest = {
  sourceKey: string;
  sourceKind: 'drive' | 'local_drop';
  sourceRefDigest: string;
  sourceSha256: string;
  displayName: string;
  mimeType: string;
  byteLength: number;
  originalDurationMs: number;
  preparedDurationMs: number;
  trimStartMs: number;
  trimEndMs: number;
  removedStartMs: number;
  removedEndMs: number;
  trimConfidence: number;
  transcriptSegments: LearningDeliveryTranscriptSegment[];
  normalizedTranscript: string;
  transcriptSha256: string;
  webvtt: string;
  webvttSha256: string;
  transcriptionModel: string;
  transcriptionLanguage: string;
  draft: ContentFactoryDraft;
  providerVideoId: string;
  providerEmbedUrl: string;
  providerTextTrackId: string;
  vimeoPrivacy: 'private' | 'unlisted' | 'password';
  captionsActive: boolean;
};

export function generateContentFactoryDraftFromTranscript(input: {
  displayName: string;
  segments: LearningDeliveryTranscriptSegment[];
  classLabel?: string | null;
  classDate?: string | null;
}): ContentFactoryDraft {
  const segments = input.segments
    .map((segment) => learningDeliveryTranscriptSegmentSchema.parse(segment))
    .filter((segment) => segment.text.trim().length > 0);
  if (segments.length < 1) {
    throw new ContentFactoryError('VALIDATION_ERROR', 'Timestamped transcript segments required.');
  }
  const normalized = normalizeTranscript(segments.map((segment) => segment.text).join(' '));
  const selectedQuestions = selectEvenly(segments, Math.min(10, Math.max(5, segments.length)));
  const selectedTakeaways = selectEvenly(segments, Math.min(5, Math.max(3, segments.length)));
  const mishnahTerms = TORAH_TERM_PATTERNS.filter((term) =>
    new RegExp(`\\b${term}\\b`, 'i').test(normalized),
  );
  const vocabulary = mishnahTerms.slice(0, 12).map((term) => {
    const match = segments.find((segment) => new RegExp(`\\b${term}\\b`, 'i').test(segment.text));
    return { term, transcript_context: clip(match?.text ?? term, 420) };
  });
  const titleSeed = normalized.split(/(?<=[.!?])\s+/)[0] ?? input.displayName;
  return contentFactoryDraftSchema.parse({
    title: clip(`Class: ${titleSeed.replace(/[.!?]+$/, '')}`, 180),
    short_description: clip(`Draft transcript overview: ${normalized}`, 1_200),
    class_label: input.classLabel ?? 'One Time Mishnayos',
    class_date: input.classDate ?? new Date().toISOString().slice(0, 10),
    topics: topicTokens(normalized),
    mishnah_terms: mishnahTerms,
    review_questions: selectedQuestions.map(
      (segment) =>
        `According to the class at ${formatTimestamp(segment.start_ms)}, what was said about "${clip(
          segment.text.replace(/[?!.]+$/, ''),
          180,
        )}"?`,
    ),
    key_takeaways: selectedTakeaways.map(
      (segment) =>
        `Transcript note at ${formatTimestamp(segment.start_ms)}: ${clip(segment.text, 680)}`,
    ),
    vocabulary,
    draft_only: true,
    authoritative_torah_interpretation: false,
  });
}

export async function ingestContentFactoryItem(input: {
  pool: DbPool;
  config: AppConfig;
  item: ContentFactoryIngest;
}) {
  const item = validateIngest(input.item);
  await input.pool.query(
    `INSERT INTO onetime.learning_delivery_content_factory_items
       (source_key, account_key, product_key, source_kind, source_ref_digest, source_sha256,
        display_name, mime_type, byte_length, factory_state, original_duration_ms,
        prepared_duration_ms, trim_start_ms, trim_end_ms, removed_start_ms, removed_end_ms,
        trim_confidence, safe_duration, middle_cut_performed, transcript_segments_json,
        normalized_transcript, transcript_sha256, webvtt, webvtt_sha256, transcription_model,
        transcription_language, transcript_review_state, draft_json, provider_video_id,
        provider_embed_url, provider_text_track_id, vimeo_privacy, captions_active, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'needs_review',$10,$11,$12,$13,$14,$15,$16,true,false,
        $17::jsonb,$18,$19,$20,$21,$22,$23,'draft',$24::jsonb,$25,$26,$27,$28,$29,now())
     ON CONFLICT (account_key, product_key, source_sha256)
     DO UPDATE SET
       display_name = EXCLUDED.display_name,
       factory_state = 'needs_review',
       prepared_duration_ms = EXCLUDED.prepared_duration_ms,
       trim_start_ms = EXCLUDED.trim_start_ms,
       trim_end_ms = EXCLUDED.trim_end_ms,
       removed_start_ms = EXCLUDED.removed_start_ms,
       removed_end_ms = EXCLUDED.removed_end_ms,
       trim_confidence = EXCLUDED.trim_confidence,
       transcript_segments_json = EXCLUDED.transcript_segments_json,
       normalized_transcript = EXCLUDED.normalized_transcript,
       transcript_sha256 = EXCLUDED.transcript_sha256,
       webvtt = EXCLUDED.webvtt,
       webvtt_sha256 = EXCLUDED.webvtt_sha256,
       transcription_model = EXCLUDED.transcription_model,
       transcription_language = EXCLUDED.transcription_language,
       transcript_review_state = 'draft',
       draft_json = EXCLUDED.draft_json,
       provider_video_id = EXCLUDED.provider_video_id,
       provider_embed_url = EXCLUDED.provider_embed_url,
       provider_text_track_id = EXCLUDED.provider_text_track_id,
       vimeo_privacy = EXCLUDED.vimeo_privacy,
       captions_active = EXCLUDED.captions_active,
       approved_by_user_key = NULL,
       approved_at = NULL,
       published_by_user_key = NULL,
       published_at = NULL,
       last_safe_error_code = NULL,
       updated_at = now()`,
    [
      item.sourceKey,
      input.config.accountKey,
      input.config.productKey,
      item.sourceKind,
      item.sourceRefDigest,
      item.sourceSha256,
      item.displayName,
      item.mimeType,
      item.byteLength,
      item.originalDurationMs,
      item.preparedDurationMs,
      item.trimStartMs,
      item.trimEndMs,
      item.removedStartMs,
      item.removedEndMs,
      item.trimConfidence,
      JSON.stringify(item.transcriptSegments),
      item.normalizedTranscript,
      item.transcriptSha256,
      item.webvtt,
      item.webvttSha256,
      item.transcriptionModel,
      item.transcriptionLanguage,
      JSON.stringify(item.draft),
      item.providerVideoId,
      item.providerEmbedUrl,
      item.providerTextTrackId,
      item.vimeoPrivacy,
      item.captionsActive,
    ],
  );
  const persisted = await getContentFactoryItem({
    pool: input.pool,
    config: input.config,
    sourceKey: item.sourceKey,
  });
  if (!persisted) throw new Error('content_factory_ingest_not_persisted');
  return persisted;
}

export async function getContentFactoryWorkspace(input: { pool: DbPool; config: AppConfig }) {
  const [result, intakeResult, occurrenceResult, rosterResult] = await Promise.all([
    input.pool.query(
      `SELECT item.*, occurrence.local_class_date AS occurrence_class_date,
              series.title AS occurrence_class_title
         FROM onetime.learning_delivery_content_factory_items item
         LEFT JOIN onetime.class_occurrences occurrence
           ON occurrence.account_key = item.account_key
          AND occurrence.product_key = item.product_key
          AND occurrence.occurrence_key = item.occurrence_key
         LEFT JOIN onetime.class_series series
           ON series.account_key = occurrence.account_key
          AND series.product_key = occurrence.product_key
          AND series.class_series_key = occurrence.class_series_key
        WHERE item.account_key = $1 AND item.product_key = $2
        ORDER BY item.updated_at DESC, item.source_key ASC LIMIT 100`,
      [input.config.accountKey, input.config.productKey],
    ),
    input.pool.query(
      `SELECT intake.*, occurrence.local_class_date AS occurrence_class_date,
              series.title AS occurrence_class_title
         FROM onetime.learning_delivery_content_factory_intakes intake
         LEFT JOIN onetime.class_occurrences occurrence
           ON occurrence.account_key = intake.account_key
          AND occurrence.product_key = intake.product_key
          AND occurrence.occurrence_key = intake.occurrence_key
         LEFT JOIN onetime.class_series series
           ON series.account_key = occurrence.account_key
          AND series.product_key = occurrence.product_key
          AND series.class_series_key = occurrence.class_series_key
        WHERE intake.account_key = $1 AND intake.product_key = $2
        ORDER BY intake.updated_at DESC, intake.intake_key ASC LIMIT 100`,
      [input.config.accountKey, input.config.productKey],
    ),
    input.pool.query(
      `SELECT occurrence.occurrence_key, occurrence.local_class_date, occurrence.starts_at,
              series.title AS class_title
         FROM onetime.class_occurrences occurrence
         JOIN onetime.class_series series
           ON series.account_key = occurrence.account_key
          AND series.product_key = occurrence.product_key
          AND series.class_series_key = occurrence.class_series_key
        WHERE occurrence.account_key = $1 AND occurrence.product_key = $2
          AND occurrence.occurrence_state <> 'cancelled'
        ORDER BY occurrence.starts_at DESC LIMIT 100`,
      [input.config.accountKey, input.config.productKey],
    ),
    input.pool.query(
      `SELECT occurrence_key, learner_key
         FROM onetime.classroom_occurrence_learner_entitlements
        WHERE account_key = $1 AND product_key = $2 AND entitlement_state = 'active'
       UNION
       SELECT occurrence_key, learner_key
         FROM onetime.classroom_launch_grants
        WHERE account_key = $1 AND product_key = $2 AND status IN ('issued','consumed')`,
      [input.config.accountKey, input.config.productKey],
    ),
  ]);
  const items = result.rows.map(safeItemFromRow);
  const intakes = intakeResult.rows.map(safeIntakeFromRow);
  const counts = Object.fromEntries(FACTORY_STATES.map((state) => [state, 0])) as Record<
    ContentFactoryState,
    number
  >;
  for (const item of items) counts[item.state] += 1;
  const learnerCounts = new Map<string, Set<string>>();
  for (const row of rosterResult.rows) {
    const learners = learnerCounts.get(String(row.occurrence_key)) ?? new Set<string>();
    learners.add(String(row.learner_key));
    learnerCounts.set(String(row.occurrence_key), learners);
  }
  const occurrences = occurrenceResult.rows.map((row) => ({
    occurrence_key: String(row.occurrence_key),
    class_title: String(row.class_title),
    class_date: asDate(row.local_class_date).toISOString().slice(0, 10),
    starts_at: asDate(row.starts_at).toISOString(),
    learner_count: learnerCounts.get(String(row.occurrence_key))?.size ?? 0,
  }));
  return { items, intakes, occurrences, counts };
}

export async function createContentFactoryIntake(input: {
  pool: DbPool;
  config: AppConfig;
  actorUserKey: string;
  actorRole: string;
  displayName: string;
  mimeType: string;
  byteLength: number;
  sourceSha256: string;
  privateRefDigest: string;
  storageLocator: string;
  occurrenceKey: string;
  idempotencyKey: string;
}) {
  assertAdmin(input.actorRole);
  if (
    !/^[a-f0-9]{64}$/.test(input.sourceSha256) ||
    !/^[a-f0-9]{64}$/.test(input.privateRefDigest)
  ) {
    throw new ContentFactoryError('VALIDATION_ERROR', 'Safe intake digests are required.');
  }
  if (!input.mimeType.startsWith('video/') || input.byteLength < 1) {
    throw new ContentFactoryError('VALIDATION_ERROR', 'A non-empty video upload is required.');
  }
  if (!input.displayName.trim() || input.displayName.length > 240) {
    throw new ContentFactoryError('VALIDATION_ERROR', 'A safe video filename is required.');
  }
  if (!/^volume:v1:[0-9a-f-]{36}$/.test(input.storageLocator)) {
    throw new ContentFactoryError('VALIDATION_ERROR', 'A durable private locator is required.');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,179}$/.test(input.idempotencyKey)) {
    throw new ContentFactoryError(
      'VALIDATION_ERROR',
      'A valid upload idempotency key is required.',
    );
  }
  return inTransaction(input.pool, async (client) => {
    const occurrence = await client.query(
      `SELECT occurrence.occurrence_key, occurrence.local_class_date,
              series.title AS occurrence_class_title
         FROM onetime.class_occurrences occurrence
         JOIN onetime.class_series series
           ON series.account_key = occurrence.account_key
          AND series.product_key = occurrence.product_key
          AND series.class_series_key = occurrence.class_series_key
        WHERE occurrence.account_key = $1 AND occurrence.product_key = $2
          AND occurrence.occurrence_key = $3 AND occurrence.occurrence_state <> 'cancelled'
        LIMIT 1`,
      [input.config.accountKey, input.config.productKey, input.occurrenceKey],
    );
    if (!occurrence.rows[0]) {
      throw new ContentFactoryError('VALIDATION_ERROR', 'Select an existing class occurrence.');
    }
    const requestFingerprint = sha256(
      [input.sourceSha256, input.occurrenceKey, input.byteLength, input.mimeType].join('\0'),
    );
    const existing = await client.query(
      `SELECT intake.* FROM onetime.learning_delivery_content_factory_intakes intake
        WHERE intake.account_key = $1 AND intake.product_key = $2
          AND intake.idempotency_key = $3 LIMIT 1 FOR UPDATE`,
      [input.config.accountKey, input.config.productKey, input.idempotencyKey],
    );
    if (existing.rows[0]) {
      if (String(existing.rows[0].request_fingerprint) !== requestFingerprint) {
        throw new ContentFactoryError(
          'VALIDATION_ERROR',
          'The upload idempotency key is already bound to different content.',
        );
      }
      return safeIntakeFromRow(existing.rows[0]);
    }
    const duplicateSource = await client.query(
      `SELECT intake_key FROM onetime.learning_delivery_content_factory_intakes
        WHERE account_key = $1 AND product_key = $2 AND source_sha256 = $3 LIMIT 1`,
      [input.config.accountKey, input.config.productKey, input.sourceSha256],
    );
    if (duplicateSource.rows[0]) {
      throw new ContentFactoryError(
        'VALIDATION_ERROR',
        'This private source was already received with a different idempotency key.',
      );
    }
    const intakeKey = stableOt86Key('factory_intake', [input.idempotencyKey]);
    const jobKey = stableOt86Key('factory_job', [input.idempotencyKey]);
    await client.query(
      `INSERT INTO onetime.learning_delivery_content_factory_intakes
         (intake_key, account_key, product_key, source_kind, display_name, mime_type,
          byte_length, source_sha256, private_ref_digest, storage_locator, intake_state,
          occurrence_key, class_label, class_date, idempotency_key, request_fingerprint,
          audit_metadata_json, created_by_user_key, updated_at)
       VALUES ($1,$2,$3,'local_drop',$4,$5,$6,$7,$8,$9,'received',$10,$11,$12,$13,$14,
               $15::jsonb,$16,now())`,
      [
        intakeKey,
        input.config.accountKey,
        input.config.productKey,
        input.displayName,
        input.mimeType,
        input.byteLength,
        input.sourceSha256,
        input.privateRefDigest,
        input.storageLocator,
        input.occurrenceKey,
        String(occurrence.rows[0].occurrence_class_title),
        asDate(occurrence.rows[0].local_class_date).toISOString().slice(0, 10),
        input.idempotencyKey,
        requestFingerprint,
        JSON.stringify({ uploader_principal_present: true, raw_source_path_present: false }),
        input.actorUserKey,
      ],
    );
    await client.query(
      `INSERT INTO onetime.learning_delivery_content_factory_jobs
         (job_key, account_key, product_key, intake_key, occurrence_key, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        jobKey,
        input.config.accountKey,
        input.config.productKey,
        intakeKey,
        input.occurrenceKey,
        input.idempotencyKey,
      ],
    );
    return safeIntakeFromRow({
      ...occurrence.rows[0],
      intake_key: intakeKey,
      source_kind: 'local_drop',
      display_name: input.displayName,
      mime_type: input.mimeType,
      byte_length: input.byteLength,
      source_sha256: input.sourceSha256,
      private_ref_digest: input.privateRefDigest,
      storage_locator: input.storageLocator,
      intake_state: 'received',
      occurrence_key: input.occurrenceKey,
      occurrence_class_date: occurrence.rows[0].local_class_date,
      class_label: occurrence.rows[0].occurrence_class_title,
      class_date: occurrence.rows[0].local_class_date,
      idempotency_key: input.idempotencyKey,
      last_safe_error_code: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
  });
}

export async function getContentFactoryItem(input: {
  pool: DbPool | Queryable;
  config: AppConfig;
  sourceKey: string;
}): Promise<ContentFactorySafeItem | null> {
  const result = await input.pool.query(
    `SELECT item.*, occurrence.local_class_date AS occurrence_class_date,
            series.title AS occurrence_class_title
       FROM onetime.learning_delivery_content_factory_items item
       LEFT JOIN onetime.class_occurrences occurrence
         ON occurrence.account_key = item.account_key
        AND occurrence.product_key = item.product_key
        AND occurrence.occurrence_key = item.occurrence_key
       LEFT JOIN onetime.class_series series
         ON series.account_key = occurrence.account_key
        AND series.product_key = occurrence.product_key
        AND series.class_series_key = occurrence.class_series_key
      WHERE item.account_key = $1 AND item.product_key = $2 AND item.source_key = $3 LIMIT 1`,
    [input.config.accountKey, input.config.productKey, input.sourceKey],
  );
  return result.rows[0] ? safeItemFromRow(result.rows[0]) : null;
}

export async function editContentFactoryItem(input: {
  pool: DbPool;
  config: AppConfig;
  sourceKey: string;
  actorUserKey: string;
  actorRole: string;
  payload: unknown;
}) {
  assertAdmin(input.actorRole);
  const payload = contentFactoryEditPayloadSchema.parse(input.payload);
  return inTransaction(input.pool, async (client) => {
    const row = await lockedRow(client, input.config, input.sourceKey);
    const previousState = String(row.factory_state) as ContentFactoryState;
    if (previousState === 'published') {
      throw new ContentFactoryError('INVALID_STATE', 'Unpublish before editing approved content.');
    }
    const occurrence = payload.occurrence_key
      ? await requireOccurrence(client, input.config, payload.occurrence_key)
      : null;
    const draft = contentFactoryDraftSchema.parse({
      ...asRecord(row.draft_json),
      ...draftPatch(payload),
      ...(occurrence
        ? {
            class_label: occurrence.classTitle,
            class_date: occurrence.classDate,
          }
        : {}),
      draft_only: true,
      authoritative_torah_interpretation: false,
    });
    const normalizedTranscript =
      payload.normalized_transcript === undefined
        ? String(row.normalized_transcript)
        : normalizeTranscript(payload.normalized_transcript);
    if (!normalizedTranscript) {
      throw new ContentFactoryError('VALIDATION_ERROR', 'Transcript cannot be empty.');
    }
    await client.query(
      `UPDATE onetime.learning_delivery_content_factory_items
          SET draft_json = $4::jsonb, normalized_transcript = $5, transcript_sha256 = $6,
              transcript_review_state = 'draft', factory_state = 'needs_review',
              occurrence_key = COALESCE($7, occurrence_key),
              approved_by_user_key = NULL, approved_at = NULL, updated_at = now()
        WHERE account_key = $1 AND product_key = $2 AND source_key = $3`,
      [
        input.config.accountKey,
        input.config.productKey,
        input.sourceKey,
        JSON.stringify(draft),
        normalizedTranscript,
        sha256(normalizedTranscript),
        occurrence?.occurrenceKey ?? null,
      ],
    );
    if (occurrence && row.occurrence_key !== occurrence.occurrenceKey) {
      await client.query(
        `UPDATE onetime.learning_delivery_content_factory_intakes
            SET occurrence_key = $4, class_label = $5, class_date = $6, updated_at = now()
          WHERE account_key = $1 AND product_key = $2 AND intake_key = (
            SELECT intake_key FROM onetime.learning_delivery_content_factory_jobs
             WHERE account_key = $1 AND product_key = $2 AND source_key = $3 LIMIT 1
          )`,
        [
          input.config.accountKey,
          input.config.productKey,
          input.sourceKey,
          occurrence.occurrenceKey,
          occurrence.classTitle,
          occurrence.classDate,
        ],
      );
      await client.query(
        `UPDATE onetime.learning_delivery_content_factory_jobs
            SET occurrence_key = $4, updated_at = now()
          WHERE account_key = $1 AND product_key = $2 AND source_key = $3`,
        [
          input.config.accountKey,
          input.config.productKey,
          input.sourceKey,
          occurrence.occurrenceKey,
        ],
      );
    }
    await recordEvent(client, input.config, {
      sourceKey: input.sourceKey,
      actorUserKey: input.actorUserKey,
      action: 'edit',
      previousState,
      nextState: 'needs_review',
      metadata: { transcript_edited: payload.normalized_transcript !== undefined },
    });
    return mustGet(client, input.config, input.sourceKey);
  });
}

export async function performContentFactoryAction(input: {
  pool: DbPool;
  config: AppConfig;
  sourceKey: string;
  actorUserKey: string;
  actorRole: string;
  action: ContentFactoryAction;
}) {
  assertAdmin(input.actorRole);
  return inTransaction(input.pool, async (client) => {
    const row = await lockedRow(client, input.config, input.sourceKey);
    const previousState = String(row.factory_state) as ContentFactoryState;
    let nextState: ContentFactoryState;
    if (input.action === 'approve') {
      if (previousState !== 'needs_review') {
        throw new ContentFactoryError('INVALID_STATE', 'Only reviewed uploads can be approved.');
      }
      validateApprovalRow(row);
      nextState = 'approved';
      await client.query(
        `UPDATE onetime.learning_delivery_content_factory_items
            SET factory_state = 'approved', transcript_review_state = 'approved',
                approved_by_user_key = $4, approved_at = now(), updated_at = now()
          WHERE account_key = $1 AND product_key = $2 AND source_key = $3`,
        [input.config.accountKey, input.config.productKey, input.sourceKey, input.actorUserKey],
      );
    } else if (input.action === 'publish') {
      if (previousState !== 'approved') {
        throw new ContentFactoryError('INVALID_STATE', 'Approve drafts and transcript first.');
      }
      validateApprovalRow(row);
      nextState = 'published';
      await publicationQuery(
        client,
        'mark_published',
        `UPDATE onetime.learning_delivery_content_factory_items
            SET factory_state = 'published', published_by_user_key = $4,
                published_at = now(), unpublished_by_user_key = NULL,
                unpublished_at = NULL, updated_at = now()
          WHERE account_key = $1 AND product_key = $2 AND source_key = $3`,
        [input.config.accountKey, input.config.productKey, input.sourceKey, input.actorUserKey],
      );
      await publishToLearnerLibrary(client, input.config, row, input.actorUserKey);
    } else if (input.action === 'unpublish') {
      if (previousState !== 'published') {
        throw new ContentFactoryError(
          'INVALID_STATE',
          'Only published content can be unpublished.',
        );
      }
      nextState = 'approved';
      await client.query(
        `UPDATE onetime.learning_delivery_content_factory_items
            SET factory_state = 'approved', unpublished_by_user_key = $4,
                unpublished_at = now(), updated_at = now()
          WHERE account_key = $1 AND product_key = $2 AND source_key = $3`,
        [input.config.accountKey, input.config.productKey, input.sourceKey, input.actorUserKey],
      );
      await unpublishFromLearnerLibrary(client, input.config, input.sourceKey);
    } else {
      if (previousState !== 'failed') {
        throw new ContentFactoryError('INVALID_STATE', 'Only failed steps can be retried.');
      }
      nextState = 'incoming';
      await client.query(
        `UPDATE onetime.learning_delivery_content_factory_items
            SET factory_state = 'incoming', retry_count = retry_count + 1,
                last_safe_error_code = NULL, updated_at = now()
          WHERE account_key = $1 AND product_key = $2 AND source_key = $3`,
        [input.config.accountKey, input.config.productKey, input.sourceKey],
      );
    }
    try {
      await recordEvent(client, input.config, {
        sourceKey: input.sourceKey,
        actorUserKey: input.actorUserKey,
        action: input.action,
        previousState,
        nextState,
        metadata: { raw_provider_url_present: false },
      });
    } catch (error) {
      if (input.action === 'publish') {
        throw new ContentFactoryPublicationError(
          'record_publication_event',
          contentFactorySafePostgresCode(error),
        );
      }
      throw error;
    }
    try {
      return await mustGet(client, input.config, input.sourceKey);
    } catch (error) {
      if (input.action === 'publish') {
        throw new ContentFactoryPublicationError(
          'serialize_published_item',
          contentFactorySafePostgresCode(error),
        );
      }
      throw error;
    }
  });
}

export async function getContentFactoryPlayback(input: {
  pool: DbPool;
  config: AppConfig;
  sourceKey: string;
  actor: Pick<
    PortalActorContext,
    'actor_role' | 'student_learner' | 'authorized_households' | 'actor_user_ref'
  >;
}) {
  const result = await input.pool.query(
    `SELECT item.source_key, item.factory_state, item.draft_json, item.provider_video_id,
            item.processing_mode, item.normalized_transcript, item.captions_active,
            item.progress_state,
            COALESCE(
              item.occurrence_key,
              CASE
                WHEN item.source_key = 'full_app_demo_mishnayos_video'
                  THEN published_item.occurrence_key
                ELSE NULL
              END
            ) AS occurrence_key,
            occurrence.local_class_date, series.title AS class_title
       FROM onetime.learning_delivery_content_factory_items item
       LEFT JOIN onetime.content_items published_item
         ON published_item.account_key = item.account_key
        AND published_item.product_key = item.product_key
        AND published_item.content_item_key = item.source_key
       JOIN onetime.class_occurrences occurrence
         ON occurrence.account_key = item.account_key
        AND occurrence.product_key = item.product_key
        AND occurrence.occurrence_key = COALESCE(
          item.occurrence_key,
          CASE
            WHEN item.source_key = 'full_app_demo_mishnayos_video'
              THEN published_item.occurrence_key
            ELSE NULL
          END
        )
       JOIN onetime.class_series series
         ON series.account_key = occurrence.account_key
        AND series.product_key = occurrence.product_key
        AND series.class_series_key = occurrence.class_series_key
      WHERE item.account_key = $1 AND item.product_key = $2 AND item.source_key = $3 LIMIT 1`,
    [input.config.accountKey, input.config.productKey, input.sourceKey],
  );
  const row = result.rows[0];
  if (!row) throw new ContentFactoryError('NOT_FOUND', 'Content was not found.');
  if (row.factory_state !== 'published' || !row.provider_video_id || !row.captions_active) {
    throw new ContentFactoryError('NOT_FOUND', 'Content was not found.');
  }
  if (!['owner', 'admin'].includes(input.actor.actor_role)) {
    const entitlementResult = await input.pool.query(
      `SELECT entitlement.learner_key, learner.household_key
         FROM onetime.content_item_entitlements entitlement
         JOIN onetime.portal_learners learner
           ON learner.account_key = entitlement.account_key
          AND learner.product_key = entitlement.product_key
          AND learner.learner_key = entitlement.learner_key
        WHERE entitlement.account_key = $1 AND entitlement.product_key = $2
          AND entitlement.content_item_key = $3 AND entitlement.audience = 'learner'
          AND entitlement.entitlement_state = 'active'`,
      [input.config.accountKey, input.config.productKey, input.sourceKey],
    );
    const learnerKey = input.actor.student_learner?.learner_key;
    const households = new Set(input.actor.authorized_households.map((item) => item.household_key));
    const entitled = entitlementResult.rows.some(
      (entitlement) =>
        (input.actor.actor_role === 'student' && entitlement.learner_key === learnerKey) ||
        (input.actor.actor_role === 'parent' && households.has(String(entitlement.household_key))),
    );
    if (!entitled) throw new ContentFactoryError('NOT_FOUND', 'Content was not found.');
  }
  const draft = contentFactoryDraftSchema.parse(row.draft_json);
  const isDemo = isContentFactoryDemoSource(String(row.source_key));
  const isSynthetic = isDemo || row.processing_mode === 'synthetic';
  if (isSynthetic && !isContentFactorySyntheticPlaybackEnabled(input.config)) {
    throw new ContentFactoryError(
      'PLAYBACK_UNAVAILABLE',
      'Synthetic playback is unavailable outside reviewed staging.',
    );
  }
  return {
    sourceKey: String(row.source_key),
    title: draft.title,
    summary: draft.short_description,
    reviewQuestions: draft.review_questions,
    occurrenceKey: String(row.occurrence_key),
    classTitle: String(row.class_title),
    classDate: asDate(row.local_class_date).toISOString().slice(0, 10),
    captionsActive: true as const,
    progressState: String(row.progress_state) as 'not_started' | 'in_progress' | 'completed',
    playbackRoute: `/api/v1/content/factory/${encodeURIComponent(String(row.source_key))}/embed`,
    privateProviderAssetId: isSynthetic ? null : String(row.provider_video_id),
    processingMode: (isSynthetic ? 'synthetic' : 'vimeo') as 'synthetic' | 'vimeo',
    syntheticCaptionText: isSynthetic ? String(row.normalized_transcript) : null,
    isDemo: isSynthetic,
    rawProviderUrlPresent: false as const,
  };
}

function validateIngest(item: ContentFactoryIngest) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]+$/.test(item.sourceKey)) {
    throw new ContentFactoryError('VALIDATION_ERROR', 'Safe source key required.');
  }
  for (const digest of [
    item.sourceRefDigest,
    item.sourceSha256,
    item.transcriptSha256,
    item.webvttSha256,
  ]) {
    if (!/^[a-f0-9]{64}$/.test(digest)) {
      throw new ContentFactoryError('VALIDATION_ERROR', 'SHA-256 metadata required.');
    }
  }
  if (!item.providerEmbedUrl.startsWith('https://player.vimeo.com/')) {
    throw new ContentFactoryError('VALIDATION_ERROR', 'Protected Vimeo embed URL required.');
  }
  if (!item.captionsActive || !item.providerVideoId || !item.providerTextTrackId) {
    throw new ContentFactoryError('VALIDATION_ERROR', 'Active Vimeo captions required.');
  }
  if (
    item.originalDurationMs <= 0 ||
    item.preparedDurationMs <= 0 ||
    item.trimStartMs < 0 ||
    item.trimEndMs <= item.trimStartMs ||
    item.trimEndMs > item.originalDurationMs ||
    item.removedStartMs !== item.trimStartMs ||
    item.removedEndMs !== item.originalDurationMs - item.trimEndMs ||
    Math.abs(item.preparedDurationMs - (item.trimEndMs - item.trimStartMs)) > 1_500 ||
    item.trimConfidence < 0 ||
    item.trimConfidence > 1
  ) {
    throw new ContentFactoryError(
      'VALIDATION_ERROR',
      'Safe opening and closing trim duration metadata required.',
    );
  }
  const normalizedTranscript = normalizeTranscript(item.normalizedTranscript);
  if (
    sha256(normalizedTranscript) !== item.transcriptSha256 ||
    sha256(item.webvtt) !== item.webvttSha256
  ) {
    throw new ContentFactoryError(
      'VALIDATION_ERROR',
      'Transcript and WebVTT provenance digests must match.',
    );
  }
  return {
    ...item,
    transcriptSegments: item.transcriptSegments.map((segment) =>
      learningDeliveryTranscriptSegmentSchema.parse(segment),
    ),
    normalizedTranscript,
    draft: contentFactoryDraftSchema.parse(item.draft),
  };
}

function safeItemFromRow(row: Record<string, unknown>): ContentFactorySafeItem {
  const draft = contentFactoryDraftSchema.parse(row.draft_json);
  const sourceKey = String(row.source_key);
  const state = contentFactoryStateSchema.parse(row.factory_state);
  return contentFactorySafeItemSchema.parse({
    source_key: sourceKey,
    source_kind: row.source_kind,
    display_name: String(row.display_name),
    state,
    is_demo: isContentFactoryDemoSource(sourceKey),
    occurrence: row.occurrence_key
      ? {
          occurrence_key: String(row.occurrence_key),
          class_title: String(row.occurrence_class_title ?? draft.class_label ?? 'Class'),
          class_date: row.occurrence_class_date
            ? asDate(row.occurrence_class_date).toISOString().slice(0, 10)
            : String(draft.class_date),
        }
      : null,
    processing_mode: row.processing_mode ?? 'vimeo',
    draft,
    normalized_transcript: String(row.normalized_transcript),
    transcript_review_state: row.transcript_review_state,
    transcript_segment_count: arrayValue(row.transcript_segments_json).length,
    transcription: {
      provider: row.processing_mode === 'synthetic' ? 'synthetic' : 'openai',
      model: String(row.transcription_model),
      language: String(row.transcription_language),
      transcript_sha256: String(row.transcript_sha256),
      webvtt_sha256: String(row.webvtt_sha256),
    },
    trim: {
      original_duration_ms: Number(row.original_duration_ms),
      prepared_duration_ms: Number(row.prepared_duration_ms),
      start_ms: Number(row.trim_start_ms),
      end_ms: Number(row.trim_end_ms),
      removed_start_ms: Number(row.removed_start_ms),
      removed_end_ms: Number(row.removed_end_ms),
      confidence: Number(row.trim_confidence),
      safe_duration: Boolean(row.safe_duration),
      middle_cut_performed: false,
    },
    vimeo: {
      provider: row.processing_mode === 'synthetic' ? 'synthetic' : 'vimeo',
      privacy: row.vimeo_privacy,
      captions_active: Boolean(row.captions_active),
      provider_video_id_present: Boolean(row.provider_video_id),
      provider_video_ref_digest: row.provider_video_id
        ? sha256(String(row.provider_video_id))
        : null,
      provider_text_track_ref_digest: row.provider_text_track_id
        ? sha256(String(row.provider_text_track_id))
        : null,
      raw_provider_url_present: false,
    },
    playback_route: `/app/learning/items/${encodeURIComponent(sourceKey)}`,
    progress_state: row.progress_state,
    retry_eligible: state === 'failed',
    last_safe_error_code: nullableString(row.last_safe_error_code),
    approved_at: nullableIso(row.approved_at),
    published_at: nullableIso(row.published_at),
    unpublished_at: nullableIso(row.unpublished_at),
    updated_at: asDate(row.updated_at).toISOString(),
  });
}

function safeIntakeFromRow(row: Record<string, unknown>): ContentFactoryIntakeSafe {
  return contentFactoryIntakeSafeSchema.parse({
    intake_key: String(row.intake_key),
    source_kind: row.source_kind,
    display_name: String(row.display_name),
    mime_type: String(row.mime_type),
    byte_length: Number(row.byte_length),
    state: row.intake_state,
    occurrence: row.occurrence_key
      ? {
          occurrence_key: String(row.occurrence_key),
          class_title: String(row.occurrence_class_title ?? row.class_label ?? 'Class'),
          class_date: row.occurrence_class_date
            ? asDate(row.occurrence_class_date).toISOString().slice(0, 10)
            : asDate(row.class_date).toISOString().slice(0, 10),
        }
      : null,
    class_label: nullableString(row.class_label),
    class_date: row.class_date ? asDate(row.class_date).toISOString().slice(0, 10) : null,
    source_sha256: String(row.source_sha256),
    private_ref_digest: String(row.private_ref_digest),
    durable_locator_present: Boolean(row.storage_locator),
    idempotency_key_digest: row.idempotency_key ? sha256(String(row.idempotency_key)) : null,
    raw_source_path_present: false,
    raw_provider_url_present: false,
    last_safe_error_code: nullableString(row.last_safe_error_code),
    created_at: asDate(row.created_at).toISOString(),
    updated_at: asDate(row.updated_at).toISOString(),
    retry_eligible: row.intake_state === 'failed',
  });
}

export function isContentFactoryDemoSource(sourceKey: string) {
  return (
    sourceKey.startsWith('ot_launch_01_demo_') || sourceKey === 'full_app_demo_mishnayos_video'
  );
}

export function isContentFactorySyntheticPlaybackEnabled(
  config: Pick<AppConfig, 'deliveryEnvironment' | 'oneTimeRuntimeEnvironment'>,
) {
  return (
    (config.deliveryEnvironment === 'isolated_staging' || config.deliveryEnvironment === 'test') &&
    (config.oneTimeRuntimeEnvironment === 'isolated_staging' ||
      config.oneTimeRuntimeEnvironment === 'test')
  );
}

async function lockedRow(client: Queryable, config: AppConfig, sourceKey: string) {
  const result = await client.query(
    `SELECT * FROM onetime.learning_delivery_content_factory_items
      WHERE account_key = $1 AND product_key = $2 AND source_key = $3 LIMIT 1 FOR UPDATE`,
    [config.accountKey, config.productKey, sourceKey],
  );
  if (!result.rows[0]) throw new ContentFactoryError('NOT_FOUND', 'Content was not found.');
  return result.rows[0] as Record<string, unknown>;
}

async function mustGet(client: Queryable, config: AppConfig, sourceKey: string) {
  const item = await getContentFactoryItem({ pool: client, config, sourceKey });
  if (!item) throw new ContentFactoryError('NOT_FOUND', 'Content was not found.');
  return item;
}

function validateApprovalRow(row: Record<string, unknown>) {
  const draft = contentFactoryDraftSchema.parse(row.draft_json);
  if (!String(row.normalized_transcript).trim()) {
    throw new ContentFactoryError('VALIDATION_ERROR', 'Review the transcript before approval.');
  }
  if (!row.occurrence_key || !draft.class_label || !draft.class_date || !draft.short_description) {
    throw new ContentFactoryError('VALIDATION_ERROR', 'Assign class, date, and description.');
  }
  if (!row.provider_video_id || !row.provider_text_track_id || !row.captions_active) {
    throw new ContentFactoryError('VALIDATION_ERROR', 'Protected playback and captions required.');
  }
}

async function requireOccurrence(client: Queryable, config: AppConfig, occurrenceKey: string) {
  const result = await client.query(
    `SELECT occurrence.occurrence_key, occurrence.local_class_date, series.title
       FROM onetime.class_occurrences occurrence
       JOIN onetime.class_series series
         ON series.account_key = occurrence.account_key
        AND series.product_key = occurrence.product_key
        AND series.class_series_key = occurrence.class_series_key
      WHERE occurrence.account_key = $1 AND occurrence.product_key = $2
        AND occurrence.occurrence_key = $3 AND occurrence.occurrence_state <> 'cancelled'
      LIMIT 1`,
    [config.accountKey, config.productKey, occurrenceKey],
  );
  const row = result.rows[0];
  if (!row) {
    throw new ContentFactoryError('VALIDATION_ERROR', 'Select an existing class occurrence.');
  }
  return {
    occurrenceKey: String(row.occurrence_key),
    classTitle: String(row.title),
    classDate: asDate(row.local_class_date).toISOString().slice(0, 10),
  };
}

async function publishToLearnerLibrary(
  client: Queryable,
  config: AppConfig,
  row: Record<string, unknown>,
  actorUserKey: string,
) {
  const sourceKey = String(row.source_key);
  const occurrenceKey = String(row.occurrence_key);
  const draft = contentFactoryDraftSchema.parse(row.draft_json);
  const roster = await publicationQuery(
    client,
    'occurrence_roster',
    `SELECT learner_key, household_key FROM (
       SELECT learner_key, household_key
         FROM onetime.classroom_occurrence_learner_entitlements
        WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3
          AND entitlement_state = 'active'
       UNION
       SELECT learner_key, household_key
         FROM onetime.classroom_launch_grants
        WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3
          AND status IN ('issued','consumed')
     ) occurrence_roster
      ORDER BY learner_key`,
    [config.accountKey, config.productKey, occurrenceKey],
  );
  if (roster.rows.length < 1) {
    throw new ContentFactoryError(
      'VALIDATION_ERROR',
      'The selected occurrence has no entitled learners.',
    );
  }
  const current = await publicationQuery(
    client,
    'load_content_item',
    `SELECT latest_revision_number, latest_revision_key FROM onetime.content_items
      WHERE account_key = $1 AND product_key = $2 AND content_item_key = $3 LIMIT 1`,
    [config.accountKey, config.productKey, sourceKey],
  );
  const revisionNumber = Number(current.rows[0]?.latest_revision_number ?? 0) + 1;
  const previousRevisionKey = nullableString(current.rows[0]?.latest_revision_key);
  const revisionKey = stableOt86Key('factory_revision', [sourceKey, String(revisionNumber)]);
  const outcomeEventKey = stableOt86Key('factory_publish', [sourceKey, String(revisionNumber)]);
  await publicationQuery(
    client,
    'upsert_content_item',
    `INSERT INTO onetime.content_items
       (content_item_key, account_key, product_key, occurrence_key, title, item_type, lifecycle_state,
        latest_revision_number, latest_revision_key, published_revision_key, metadata,
        published_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,'video','published',$6,$7,$7,$8::jsonb,now(),now())
     ON CONFLICT (account_key, product_key, content_item_key)
     DO UPDATE SET occurrence_key = EXCLUDED.occurrence_key, title = EXCLUDED.title,
       lifecycle_state = 'published',
       latest_revision_number = EXCLUDED.latest_revision_number,
       latest_revision_key = EXCLUDED.latest_revision_key,
       published_revision_key = EXCLUDED.published_revision_key,
       metadata = EXCLUDED.metadata, published_at = now(), updated_at = now()`,
    [
      sourceKey,
      config.accountKey,
      config.productKey,
      occurrenceKey,
      draft.title,
      revisionNumber,
      revisionKey,
      JSON.stringify({ content_factory: true, captions_active: true, occurrence_scoped: true }),
    ],
  );
  if (previousRevisionKey) {
    await publicationQuery(
      client,
      'supersede_revision',
      `UPDATE onetime.content_revisions
          SET lifecycle_state = 'superseded', superseded_at = COALESCE(superseded_at, now())
        WHERE account_key = $1 AND product_key = $2 AND content_item_key = $3
          AND lifecycle_state = 'published'`,
      [config.accountKey, config.productKey, sourceKey],
    );
  }
  await publicationQuery(
    client,
    'insert_revision',
    `INSERT INTO onetime.content_revisions
       (revision_key, account_key, product_key, content_item_key, outcome_event_key,
        revision_number, lifecycle_state, transcript_metadata, source_metadata,
        review_sheet_metadata, playback_descriptor, source_ref_digest,
        raw_provider_target_present, supersedes_revision_key, published_at)
     VALUES ($1,$2,$3,$4,$5,$6,'published',$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11,
       false,$12,now())`,
    [
      revisionKey,
      config.accountKey,
      config.productKey,
      sourceKey,
      outcomeEventKey,
      revisionNumber,
      JSON.stringify({
        transcript_sha256: row.transcript_sha256,
        approved: true,
        provider: row.processing_mode === 'synthetic' ? 'synthetic' : 'openai',
        model: row.transcription_model,
      }),
      JSON.stringify({
        class_label: draft.class_label,
        class_date: draft.class_date,
        occurrence_key: occurrenceKey,
        topics: draft.topics,
        mishnah_terms: draft.mishnah_terms,
      }),
      JSON.stringify({
        approved_summary: draft.short_description,
        approved_review_questions: draft.review_questions,
        approved_key_takeaways: draft.key_takeaways,
        vocabulary: draft.vocabulary,
        authoritative_torah_interpretation: false,
      }),
      JSON.stringify({
        kind:
          row.processing_mode === 'synthetic'
            ? 'server_authorized_synthetic_playback'
            : 'server_authorized_vimeo_playback',
        playback_route: `/app/learning/items/${sourceKey}`,
        captions_active: true,
        raw_provider_url_present: false,
      }),
      row.source_ref_digest,
      previousRevisionKey,
    ],
  );
  await publicationQuery(
    client,
    'revoke_entitlements',
    `UPDATE onetime.content_item_entitlements
        SET entitlement_state = 'revoked', revoked_at = now()
      WHERE account_key = $1 AND product_key = $2 AND content_item_key = $3`,
    [config.accountKey, config.productKey, sourceKey],
  );
  for (const learner of roster.rows) {
    await publicationQuery(
      client,
      'upsert_occurrence_entitlement',
      `INSERT INTO onetime.classroom_occurrence_learner_entitlements
         (occurrence_entitlement_key, account_key, product_key, occurrence_key,
          household_key, learner_key, entitlement_state, source, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'active','enrollment_projection',now())
       ON CONFLICT (account_key, product_key, occurrence_key, learner_key)
       DO UPDATE SET household_key = EXCLUDED.household_key, entitlement_state = 'active',
         source = 'enrollment_projection', revoked_at = NULL, updated_at = now()`,
      [
        stableOt86Key('occurrence_learner', [occurrenceKey, String(learner.learner_key)]),
        config.accountKey,
        config.productKey,
        occurrenceKey,
        learner.household_key,
        learner.learner_key,
      ],
    );
    await publicationQuery(
      client,
      'upsert_content_entitlement',
      `INSERT INTO onetime.content_item_entitlements
         (entitlement_key, account_key, product_key, content_item_key, audience,
          household_key, learner_key, entitlement_state, created_at)
       VALUES ($1,$2,$3,$4,'learner',$5,$6,'active',now())
       ON CONFLICT (account_key, product_key, entitlement_key)
       DO UPDATE SET household_key = EXCLUDED.household_key,
         learner_key = EXCLUDED.learner_key, entitlement_state = 'active', revoked_at = NULL`,
      [
        stableOt86Key('factory_entitlement', [
          sourceKey,
          occurrenceKey,
          String(learner.learner_key),
        ]),
        config.accountKey,
        config.productKey,
        sourceKey,
        learner.household_key,
        learner.learner_key,
      ],
    );
  }
  await publicationQuery(
    client,
    'insert_publication_audit',
    `INSERT INTO onetime.content_audit_events
       (audit_key, account_key, product_key, content_item_key, revision_key, actor_user_key,
        action_type, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,'content_factory_published',$7::jsonb)`,
    [
      stableOt86Key('factory_publish_audit', [sourceKey, revisionKey]),
      config.accountKey,
      config.productKey,
      sourceKey,
      revisionKey,
      actorUserKey,
      JSON.stringify({
        raw_provider_url_present: false,
        captions_active: true,
        occurrence_key: occurrenceKey,
        entitled_learner_count: roster.rows.length,
      }),
    ],
  );
}

async function publicationQuery(client: Queryable, stage: string, text: string, values: unknown[]) {
  try {
    return await client.query(text, values);
  } catch (error) {
    throw new ContentFactoryPublicationError(stage, contentFactorySafePostgresCode(error));
  }
}

async function unpublishFromLearnerLibrary(
  client: Queryable,
  config: AppConfig,
  sourceKey: string,
) {
  await client.query(
    `UPDATE onetime.content_items SET lifecycle_state = 'review_needed',
        published_revision_key = NULL, published_at = NULL, updated_at = now()
      WHERE account_key = $1 AND product_key = $2 AND content_item_key = $3`,
    [config.accountKey, config.productKey, sourceKey],
  );
  await client.query(
    `UPDATE onetime.content_item_entitlements SET entitlement_state = 'revoked', revoked_at = now()
      WHERE account_key = $1 AND product_key = $2 AND content_item_key = $3`,
    [config.accountKey, config.productKey, sourceKey],
  );
}

async function recordEvent(
  client: Queryable,
  config: AppConfig,
  input: {
    sourceKey: string;
    actorUserKey: string;
    action: string;
    previousState: ContentFactoryState;
    nextState: ContentFactoryState;
    metadata: Record<string, unknown>;
  },
) {
  await client.query(
    `INSERT INTO onetime.learning_delivery_content_factory_events
       (event_key, account_key, product_key, source_key, actor_user_key, action,
        previous_state, next_state, safe_metadata_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
    [
      stableOt86Key('factory_event', [
        input.sourceKey,
        input.action,
        input.previousState,
        input.nextState,
        new Date().toISOString(),
      ]),
      config.accountKey,
      config.productKey,
      input.sourceKey,
      input.actorUserKey,
      input.action,
      input.previousState,
      input.nextState,
      JSON.stringify(input.metadata),
    ],
  );
}

function assertAdmin(role: string) {
  if (role !== 'owner' && role !== 'admin') {
    throw new ContentFactoryError('FORBIDDEN', 'Owner or Admin access required.');
  }
}

function draftPatch(payload: ContentFactoryEditPayload) {
  const patch = { ...payload };
  delete patch.normalized_transcript;
  delete patch.occurrence_key;
  return patch;
}

function normalizeTranscript(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function topicTokens(value: string) {
  const stop = new Set([
    'about',
    'after',
    'again',
    'because',
    'before',
    'could',
    'every',
    'first',
    'from',
    'have',
    'into',
    'just',
    'more',
    'other',
    'said',
    'that',
    'their',
    'there',
    'these',
    'they',
    'this',
    'through',
    'what',
    'when',
    'where',
    'which',
    'with',
    'would',
    'your',
    'class',
    'rabbi',
  ]);
  const counts = new Map<string, number>();
  for (const word of value.toLowerCase().match(/[a-z][a-z'-]{3,}/g) ?? []) {
    if (stop.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([word]) => word.replace(/^./, (letter) => letter.toUpperCase()));
}

function selectEvenly<T>(values: T[], count: number) {
  if (values.length <= count) {
    const filled = [...values];
    while (filled.length < count) filled.push(values[filled.length % values.length]!);
    return filled;
  }
  return Array.from(
    { length: count },
    (_, index) => values[Math.round((index * (values.length - 1)) / Math.max(1, count - 1))]!,
  );
}

function formatTimestamp(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

function clip(value: string, max: number) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length <= max
    ? normalized
    : `${normalized.slice(0, Math.max(1, max - 3)).trim()}...`;
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function nullableString(value: unknown) {
  return value === null || value === undefined || value === '' ? null : String(value);
}

function asDate(value: unknown) {
  return value instanceof Date ? value : new Date(String(value));
}

function nullableIso(value: unknown) {
  return value === null || value === undefined ? null : asDate(value).toISOString();
}
