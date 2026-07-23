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
  const [result, intakeResult] = await Promise.all([
    input.pool.query(
      `SELECT * FROM onetime.learning_delivery_content_factory_items
      WHERE account_key = $1 AND product_key = $2
      ORDER BY updated_at DESC, source_key ASC LIMIT 100`,
      [input.config.accountKey, input.config.productKey],
    ),
    input.pool.query(
      `SELECT * FROM onetime.learning_delivery_content_factory_intakes
        WHERE account_key = $1 AND product_key = $2
        ORDER BY updated_at DESC, intake_key ASC LIMIT 100`,
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
  return { items, intakes, counts };
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
  classLabel?: string | null;
  classDate?: string | null;
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
  if (input.classLabel && input.classLabel.length > 180) {
    throw new ContentFactoryError('VALIDATION_ERROR', 'Class assignment is too long.');
  }
  if (input.classDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.classDate)) {
    throw new ContentFactoryError('VALIDATION_ERROR', 'Class date must use YYYY-MM-DD.');
  }
  const intakeKey = stableOt86Key('factory_intake', [input.sourceSha256]);
  await input.pool.query(
    `INSERT INTO onetime.learning_delivery_content_factory_intakes
       (intake_key, account_key, product_key, source_kind, display_name, mime_type,
        byte_length, source_sha256, private_ref_digest, intake_state, class_label,
        class_date, created_by_user_key, updated_at)
     VALUES ($1,$2,$3,'local_drop',$4,$5,$6,$7,$8,'received',$9,$10,$11,now())
     ON CONFLICT (account_key, product_key, source_sha256)
     DO UPDATE SET display_name = EXCLUDED.display_name, mime_type = EXCLUDED.mime_type,
       byte_length = EXCLUDED.byte_length, private_ref_digest = EXCLUDED.private_ref_digest,
       class_label = COALESCE(EXCLUDED.class_label, onetime.learning_delivery_content_factory_intakes.class_label),
       class_date = COALESCE(EXCLUDED.class_date, onetime.learning_delivery_content_factory_intakes.class_date),
       last_safe_error_code = NULL, updated_at = now()`,
    [
      intakeKey,
      input.config.accountKey,
      input.config.productKey,
      input.displayName,
      input.mimeType,
      input.byteLength,
      input.sourceSha256,
      input.privateRefDigest,
      input.classLabel ?? null,
      input.classDate ?? null,
      input.actorUserKey,
    ],
  );
  const result = await input.pool.query(
    `SELECT * FROM onetime.learning_delivery_content_factory_intakes
      WHERE account_key = $1 AND product_key = $2 AND source_sha256 = $3 LIMIT 1`,
    [input.config.accountKey, input.config.productKey, input.sourceSha256],
  );
  if (!result.rows[0]) throw new Error('content_factory_intake_not_persisted');
  return safeIntakeFromRow(result.rows[0]);
}

export async function getContentFactoryItem(input: {
  pool: DbPool | Queryable;
  config: AppConfig;
  sourceKey: string;
}): Promise<ContentFactorySafeItem | null> {
  const result = await input.pool.query(
    `SELECT * FROM onetime.learning_delivery_content_factory_items
      WHERE account_key = $1 AND product_key = $2 AND source_key = $3 LIMIT 1`,
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
    const draft = contentFactoryDraftSchema.parse({
      ...asRecord(row.draft_json),
      ...draftPatch(payload),
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
              approved_by_user_key = NULL, approved_at = NULL, updated_at = now()
        WHERE account_key = $1 AND product_key = $2 AND source_key = $3`,
      [
        input.config.accountKey,
        input.config.productKey,
        input.sourceKey,
        JSON.stringify(draft),
        normalizedTranscript,
        sha256(normalizedTranscript),
      ],
    );
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
      await client.query(
        `UPDATE onetime.learning_delivery_content_factory_items
            SET factory_state = 'published', published_by_user_key = $4,
                published_at = now(), updated_at = now()
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
            SET factory_state = 'approved', published_by_user_key = NULL,
                published_at = NULL, updated_at = now()
          WHERE account_key = $1 AND product_key = $2 AND source_key = $3`,
        [input.config.accountKey, input.config.productKey, input.sourceKey],
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
    await recordEvent(client, input.config, {
      sourceKey: input.sourceKey,
      actorUserKey: input.actorUserKey,
      action: input.action,
      previousState,
      nextState,
      metadata: { raw_provider_url_present: false },
    });
    return mustGet(client, input.config, input.sourceKey);
  });
}

export async function getContentFactoryPlayback(input: {
  pool: DbPool;
  config: AppConfig;
  sourceKey: string;
}) {
  const result = await input.pool.query(
    `SELECT source_key, factory_state, draft_json, normalized_transcript, provider_embed_url,
            captions_active, progress_state
       FROM onetime.learning_delivery_content_factory_items
      WHERE account_key = $1 AND product_key = $2 AND source_key = $3 LIMIT 1`,
    [input.config.accountKey, input.config.productKey, input.sourceKey],
  );
  const row = result.rows[0];
  if (!row) throw new ContentFactoryError('NOT_FOUND', 'Content was not found.');
  if (row.factory_state !== 'published' || !row.provider_embed_url || !row.captions_active) {
    throw new ContentFactoryError('PLAYBACK_UNAVAILABLE', 'Approved playback is unavailable.');
  }
  const draft = contentFactoryDraftSchema.parse(row.draft_json);
  const isDemo = isContentFactoryDemoSource(String(row.source_key));
  if (isDemo && !isContentFactorySyntheticPlaybackEnabled(input.config)) {
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
    captionsActive: true as const,
    progressState: String(row.progress_state) as 'not_started' | 'in_progress' | 'completed',
    playbackRoute: `/api/v1/content/factory/${encodeURIComponent(String(row.source_key))}/embed`,
    privateProviderEmbedUrl: isDemo ? null : String(row.provider_embed_url),
    syntheticCaptionText: isDemo ? String(row.normalized_transcript) : null,
    isDemo,
    rawProviderUrlPresent: false as const,
  };
}

export async function getAuthorizedContentFactoryPlayback(input: {
  pool: DbPool;
  config: AppConfig;
  sourceKey: string;
  actorUserKey: string;
  actorRole: string;
  now?: Date;
}) {
  if (!['owner', 'admin', 'parent', 'student'].includes(input.actorRole)) {
    throw new ContentFactoryError('PLAYBACK_UNAVAILABLE', 'Approved playback is unavailable.');
  }
  if (input.actorRole === 'parent' || input.actorRole === 'student') {
    const authorized =
      input.actorRole === 'parent'
        ? await parentCanOpenFactoryItem(input)
        : await studentCanOpenFactoryItem(input);
    if (!authorized) {
      throw new ContentFactoryError('PLAYBACK_UNAVAILABLE', 'Approved playback is unavailable.');
    }
  }
  return getContentFactoryPlayback(input);
}

async function parentCanOpenFactoryItem(input: {
  pool: DbPool;
  config: AppConfig;
  sourceKey: string;
  actorUserKey: string;
  now?: Date;
}) {
  const result = await input.pool.query(
    `SELECT 1
       FROM onetime.portal_guardian_relationships AS relationships
       JOIN onetime.portal_households AS households
         ON households.account_key = relationships.account_key
        AND households.product_key = relationships.product_key
        AND households.household_key = relationships.household_key
        AND households.status = 'active'
       JOIN onetime.account_access_projections AS access
         ON access.account_key = relationships.account_key
        AND access.product_key = relationships.product_key
        AND access.household_key = relationships.household_key
        AND access.state IN ('active', 'grace', 'scheduled_end')
        AND access.effective_at <= $5
        AND (access.expires_at IS NULL OR access.expires_at > $5)
       JOIN onetime.content_item_entitlements AS entitlements
         ON entitlements.account_key = relationships.account_key
        AND entitlements.product_key = relationships.product_key
        AND entitlements.content_item_key = $4
        AND entitlements.entitlement_state = 'active'
        AND (
          entitlements.audience = 'all_active_learners'
          OR (
            entitlements.audience = 'household'
            AND entitlements.household_key = relationships.household_key
          )
        )
       JOIN onetime.content_items AS items
         ON items.account_key = entitlements.account_key
        AND items.product_key = entitlements.product_key
        AND items.content_item_key = entitlements.content_item_key
        AND items.lifecycle_state = 'published'
        AND items.published_revision_key IS NOT NULL
      WHERE relationships.account_key = $1
        AND relationships.product_key = $2
        AND relationships.guardian_user_ref = $3
        AND relationships.status = 'active'
        AND relationships.authority <> 'support_only'
      LIMIT 1`,
    [
      input.config.accountKey,
      input.config.productKey,
      input.actorUserKey,
      input.sourceKey,
      input.now ?? new Date(),
    ],
  );
  return Boolean(result.rowCount);
}

async function studentCanOpenFactoryItem(input: {
  pool: DbPool;
  config: AppConfig;
  sourceKey: string;
  actorUserKey: string;
  now?: Date;
}) {
  const result = await input.pool.query(
    `SELECT 1
       FROM onetime.account_learner_identity_links AS links
       JOIN onetime.portal_student_access_state AS student_access
         ON student_access.account_key = links.account_key
        AND student_access.product_key = links.product_key
        AND student_access.household_key = links.household_key
        AND student_access.learner_key = links.learner_key
        AND student_access.student_user_ref = links.user_key
        AND student_access.status = 'active'
       JOIN onetime.portal_learners AS learners
         ON learners.account_key = links.account_key
        AND learners.product_key = links.product_key
        AND learners.household_key = links.household_key
        AND learners.learner_key = links.learner_key
        AND learners.learner_status = 'active'
       JOIN onetime.account_access_projections AS access
         ON access.account_key = links.account_key
        AND access.product_key = links.product_key
        AND access.household_key = links.household_key
        AND access.state IN ('active', 'grace', 'scheduled_end')
        AND access.effective_at <= $5
        AND (access.expires_at IS NULL OR access.expires_at > $5)
       JOIN onetime.content_item_entitlements AS entitlements
         ON entitlements.account_key = links.account_key
        AND entitlements.product_key = links.product_key
        AND entitlements.content_item_key = $4
        AND entitlements.entitlement_state = 'active'
        AND (
          entitlements.audience = 'all_active_learners'
          OR (
            entitlements.audience = 'household'
            AND entitlements.household_key = links.household_key
          )
          OR (
            entitlements.audience = 'learner'
            AND entitlements.learner_key = links.learner_key
          )
        )
       JOIN onetime.content_items AS items
         ON items.account_key = entitlements.account_key
        AND items.product_key = entitlements.product_key
        AND items.content_item_key = entitlements.content_item_key
        AND items.lifecycle_state = 'published'
        AND items.published_revision_key IS NOT NULL
      WHERE links.account_key = $1
        AND links.product_key = $2
        AND links.user_key = $3
        AND links.link_state = 'active'
      LIMIT 1`,
    [
      input.config.accountKey,
      input.config.productKey,
      input.actorUserKey,
      input.sourceKey,
      input.now ?? new Date(),
    ],
  );
  return Boolean(result.rowCount);
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
    draft,
    normalized_transcript: String(row.normalized_transcript),
    transcript_review_state: row.transcript_review_state,
    transcript_segment_count: arrayValue(row.transcript_segments_json).length,
    transcription: {
      provider: 'openai',
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
    class_label: nullableString(row.class_label),
    class_date: row.class_date ? asDate(row.class_date).toISOString().slice(0, 10) : null,
    source_sha256: String(row.source_sha256),
    private_ref_digest: String(row.private_ref_digest),
    raw_source_path_present: false,
    raw_provider_url_present: false,
    last_safe_error_code: nullableString(row.last_safe_error_code),
    created_at: asDate(row.created_at).toISOString(),
    updated_at: asDate(row.updated_at).toISOString(),
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
  if (!draft.class_label || !draft.class_date || !draft.short_description) {
    throw new ContentFactoryError('VALIDATION_ERROR', 'Assign class, date, and description.');
  }
  if (!row.provider_video_id || !row.provider_embed_url || !row.captions_active) {
    throw new ContentFactoryError(
      'VALIDATION_ERROR',
      'Private Vimeo playback and captions required.',
    );
  }
}

async function publishToLearnerLibrary(
  client: Queryable,
  config: AppConfig,
  row: Record<string, unknown>,
  actorUserKey: string,
) {
  const sourceKey = String(row.source_key);
  const draft = contentFactoryDraftSchema.parse(row.draft_json);
  const current = await client.query(
    `SELECT latest_revision_number, latest_revision_key FROM onetime.content_items
      WHERE account_key = $1 AND product_key = $2 AND content_item_key = $3 LIMIT 1`,
    [config.accountKey, config.productKey, sourceKey],
  );
  const revisionNumber = Number(current.rows[0]?.latest_revision_number ?? 0) + 1;
  const previousRevisionKey = nullableString(current.rows[0]?.latest_revision_key);
  const revisionKey = stableOt86Key('factory_revision', [sourceKey, String(revisionNumber)]);
  const outcomeEventKey = stableOt86Key('factory_publish', [sourceKey, String(revisionNumber)]);
  await client.query(
    `INSERT INTO onetime.content_items
       (content_item_key, account_key, product_key, title, item_type, lifecycle_state,
        latest_revision_number, latest_revision_key, published_revision_key, metadata,
        published_at, updated_at)
     VALUES ($1,$2,$3,$4,'video','published',$5,$6,$6,$7::jsonb,now(),now())
     ON CONFLICT (account_key, product_key, content_item_key)
     DO UPDATE SET title = EXCLUDED.title, lifecycle_state = 'published',
       latest_revision_number = EXCLUDED.latest_revision_number,
       latest_revision_key = EXCLUDED.latest_revision_key,
       published_revision_key = EXCLUDED.published_revision_key,
       metadata = EXCLUDED.metadata, published_at = now(), updated_at = now()`,
    [
      sourceKey,
      config.accountKey,
      config.productKey,
      draft.title,
      revisionNumber,
      revisionKey,
      JSON.stringify({ content_factory: true, captions_active: true }),
    ],
  );
  if (previousRevisionKey) {
    await client.query(
      `UPDATE onetime.content_revisions
          SET lifecycle_state = 'superseded', superseded_at = COALESCE(superseded_at, now())
        WHERE account_key = $1 AND product_key = $2 AND content_item_key = $3
          AND lifecycle_state = 'published'`,
      [config.accountKey, config.productKey, sourceKey],
    );
  }
  await client.query(
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
        provider: 'openai',
        model: row.transcription_model,
      }),
      JSON.stringify({
        class_label: draft.class_label,
        class_date: draft.class_date,
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
        kind: 'server_authorized_vimeo_playback',
        playback_route: `/app/learning/items/${sourceKey}`,
        captions_active: true,
        raw_provider_url_present: false,
      }),
      row.source_ref_digest,
      previousRevisionKey,
    ],
  );
  await client.query(
    `INSERT INTO onetime.content_item_entitlements
       (entitlement_key, account_key, product_key, content_item_key, audience,
        entitlement_state, created_at)
     VALUES ($1,$2,$3,$4,'all_active_learners','active',now())
     ON CONFLICT (account_key, product_key, entitlement_key)
     DO UPDATE SET entitlement_state = 'active', revoked_at = NULL`,
    [
      stableOt86Key('factory_entitlement', [sourceKey, 'all_active_learners']),
      config.accountKey,
      config.productKey,
      sourceKey,
    ],
  );
  await client.query(
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
      JSON.stringify({ raw_provider_url_present: false, captions_active: true }),
    ],
  );
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
