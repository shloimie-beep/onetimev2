import { createHash } from 'node:crypto';
import type { AppConfig } from '../../../config/src/index.ts';
import type { ContentFactoryDraft } from '../../../contracts/src/content/content-factory.ts';
import type { LearningDeliveryTranscriptSegment } from '../../../contracts/src/content/learning-delivery.ts';
import type { DbPool, Queryable } from '../../../db/src/index.ts';
import { inTransaction } from '../../../db/src/index.ts';
import {
  ContentFactoryError,
  generateContentFactoryDraftFromTranscript,
} from './content-factory.ts';
import type { VolumeContentFactoryStorage } from './content-factory-storage.ts';
import {
  buildLearningDeliveryTranscriptArtifact,
  suggestLearningDeliveryAutomaticTrim,
} from './learning-delivery.ts';
import { stableOt86Key } from './pipeline.ts';

const STAGES = [
  'inspecting',
  'trimming',
  'transcribing',
  'drafting',
  'uploading',
  'review',
] as const;
type Stage = (typeof STAGES)[number];
const MAX_MANUAL_RETRY_WINDOWS = 3;

export const CONTENT_FACTORY_CLAIM_SQL = `
  SELECT job_key
    FROM onetime.learning_delivery_content_factory_jobs
   WHERE account_key = $1 AND product_key = $2
     AND (
       (job_state IN ('queued','retry_wait') AND next_attempt_at <= $3::timestamptz)
       OR (job_state = 'leased' AND lease_expires_at <= $3::timestamptz)
     )
   ORDER BY next_attempt_at, created_at, job_key
   LIMIT 1
   FOR UPDATE SKIP LOCKED`;

export type ContentFactoryWorkerSummary = {
  claimed: boolean;
  stage: Stage | null;
  completed: boolean;
  providerCallsPerformed: false;
  safeErrorCode: string | null;
};

type Job = {
  jobKey: string;
  intakeKey: string;
  occurrenceKey: string;
  idempotencyKey: string;
  stage: Stage;
  leaseGeneration: number;
  leaseOwnerDigest: string;
  sourceKey: string | null;
  displayName: string;
  mimeType: string;
  byteLength: number;
  sourceSha256: string;
  sourceRefDigest: string;
  storageLocator: string;
  classTitle: string;
  classDate: string;
  privatePayload: Record<string, unknown>;
};

export async function runContentFactoryWorkerOnce(input: {
  pool: DbPool;
  config: AppConfig;
  storage: VolumeContentFactoryStorage;
  workerIdentity: string;
  now?: Date;
  leaseMs?: number;
  mode?: 'synthetic' | 'vimeo';
}): Promise<ContentFactoryWorkerSummary> {
  const now = input.now ?? new Date();
  const leaseMs = input.leaseMs ?? 60_000;
  const job = await claimContentFactoryJob({
    pool: input.pool,
    config: input.config,
    workerIdentity: input.workerIdentity,
    now,
    leaseMs,
  });
  if (!job) {
    return {
      claimed: false,
      stage: null,
      completed: false,
      providerCallsPerformed: false,
      safeErrorCode: null,
    };
  }
  try {
    await heartbeatContentFactoryJob({
      pool: input.pool,
      config: input.config,
      job,
      now,
      leaseMs,
    });
    if ((input.mode ?? 'synthetic') !== 'synthetic') {
      throw new SafeWorkerError(
        'content_factory_external_provider_authorization_required',
        'External provider processing requires an explicit operator authorization gate.',
      );
    }
    const output = await runSyntheticStage(input.storage, job);
    const completed = await completeStage({
      pool: input.pool,
      config: input.config,
      job,
      output,
      now,
    });
    return {
      claimed: true,
      stage: job.stage,
      completed,
      providerCallsPerformed: false,
      safeErrorCode: null,
    };
  } catch (error) {
    const safeErrorCode =
      error instanceof SafeWorkerError ? error.code : 'content_factory_processing_failed';
    await failStage({ pool: input.pool, config: input.config, job, safeErrorCode, now });
    return {
      claimed: true,
      stage: job.stage,
      completed: false,
      providerCallsPerformed: false,
      safeErrorCode,
    };
  }
}

export async function claimContentFactoryJob(input: {
  pool: DbPool;
  config: AppConfig;
  workerIdentity: string;
  now: Date;
  leaseMs: number;
}): Promise<Job | null> {
  return inTransaction(input.pool, async (client) => {
    let selected;
    try {
      selected = await client.query(CONTENT_FACTORY_CLAIM_SQL, [
        input.config.accountKey,
        input.config.productKey,
        input.now.toISOString(),
      ]);
    } catch (error) {
      if (!String(error).includes('SKIP LOCKED')) throw error;
      selected = await client.query(CONTENT_FACTORY_CLAIM_SQL.replace(' SKIP LOCKED', ''), [
        input.config.accountKey,
        input.config.productKey,
        input.now.toISOString(),
      ]);
    }
    if (!selected.rows[0]) return null;
    const ownerDigest = sha256(input.workerIdentity);
    const leaseExpiresAt = new Date(input.now.getTime() + input.leaseMs);
    const claimed = await client.query(
      `UPDATE onetime.learning_delivery_content_factory_jobs
          SET job_state = 'leased', lease_owner_digest = $4,
              lease_generation = lease_generation + 1, lease_expires_at = $5::timestamptz,
              heartbeat_at = $3::timestamptz, attempt_count = attempt_count + 1,
              updated_at = $3::timestamptz
        WHERE account_key = $1 AND product_key = $2 AND job_key = $6
        RETURNING *`,
      [
        input.config.accountKey,
        input.config.productKey,
        input.now.toISOString(),
        ownerDigest,
        leaseExpiresAt.toISOString(),
        selected.rows[0].job_key,
      ],
    );
    const row = claimed.rows[0];
    if (!row) return null;
    const intake = await client.query(
      `SELECT intake.*, occurrence.local_class_date, series.title AS class_title
         FROM onetime.learning_delivery_content_factory_intakes intake
         JOIN onetime.class_occurrences occurrence
           ON occurrence.account_key = intake.account_key
          AND occurrence.product_key = intake.product_key
          AND occurrence.occurrence_key = intake.occurrence_key
         JOIN onetime.class_series series
           ON series.account_key = occurrence.account_key
          AND series.product_key = occurrence.product_key
          AND series.class_series_key = occurrence.class_series_key
        WHERE intake.account_key = $1 AND intake.product_key = $2
          AND intake.intake_key = $3 LIMIT 1`,
      [input.config.accountKey, input.config.productKey, row.intake_key],
    );
    if (!intake.rows[0] || !intake.rows[0].storage_locator) {
      throw new SafeWorkerError(
        'content_factory_private_source_unavailable',
        'Durable private source is unavailable.',
      );
    }
    await client.query(
      `UPDATE onetime.learning_delivery_content_factory_intakes
          SET intake_state = $4, last_safe_error_code = NULL, updated_at = $3::timestamptz
        WHERE account_key = $1 AND product_key = $2 AND intake_key = $5`,
      [
        input.config.accountKey,
        input.config.productKey,
        input.now.toISOString(),
        row.current_stage,
        row.intake_key,
      ],
    );
    return jobFromRows(row, intake.rows[0], ownerDigest);
  });
}

export async function heartbeatContentFactoryJob(input: {
  pool: DbPool;
  config: AppConfig;
  job: Job;
  now: Date;
  leaseMs: number;
}) {
  const result = await input.pool.query(
    `UPDATE onetime.learning_delivery_content_factory_jobs
        SET heartbeat_at = $6::timestamptz, lease_expires_at = $7::timestamptz,
            updated_at = $6::timestamptz
      WHERE account_key = $1 AND product_key = $2 AND job_key = $3
        AND job_state = 'leased' AND lease_owner_digest = $4 AND lease_generation = $5`,
    [
      input.config.accountKey,
      input.config.productKey,
      input.job.jobKey,
      input.job.leaseOwnerDigest,
      input.job.leaseGeneration,
      input.now.toISOString(),
      new Date(input.now.getTime() + input.leaseMs).toISOString(),
    ],
  );
  if (!result.rowCount) throw new SafeWorkerError('content_factory_lease_lost', 'Job lease lost.');
}

export async function retryContentFactoryIntake(input: {
  pool: DbPool;
  config: AppConfig;
  intakeKey: string;
  actorUserKey: string;
  actorRole: string;
}) {
  if (!['owner', 'admin'].includes(input.actorRole)) {
    throw new ContentFactoryError('FORBIDDEN', 'Owner or Admin access required.');
  }
  await inTransaction(input.pool, async (client) => {
    const current = await client.query(
      `SELECT job.job_state, intake.audit_metadata_json
         FROM onetime.learning_delivery_content_factory_jobs job
         JOIN onetime.learning_delivery_content_factory_intakes intake
           ON intake.account_key = job.account_key
          AND intake.product_key = job.product_key
          AND intake.intake_key = job.intake_key
        WHERE job.account_key = $1 AND job.product_key = $2 AND job.intake_key = $3
        LIMIT 1 FOR UPDATE`,
      [input.config.accountKey, input.config.productKey, input.intakeKey],
    );
    const row = current.rows[0];
    if (!row || !['retry_wait', 'dead_letter'].includes(String(row.job_state))) {
      throw new ContentFactoryError('INVALID_STATE', 'Only failed processing can be retried.');
    }
    const audit = recordValue(row.audit_metadata_json);
    const manualRetryCount = Number(audit.manual_retry_count ?? 0);
    if (!Number.isSafeInteger(manualRetryCount) || manualRetryCount < 0) {
      throw new ContentFactoryError('INVALID_STATE', 'Retry history is invalid.');
    }
    if (manualRetryCount >= MAX_MANUAL_RETRY_WINDOWS) {
      throw new ContentFactoryError('INVALID_STATE', 'Manual retry limit reached.');
    }
    const nextManualRetryCount = manualRetryCount + 1;
    await client.query(
      `UPDATE onetime.learning_delivery_content_factory_jobs
          SET job_state = 'queued', attempt_count = 0, next_attempt_at = now(),
              lease_owner_digest = NULL, lease_expires_at = NULL, heartbeat_at = NULL,
              last_safe_error_code = NULL, updated_at = now()
        WHERE account_key = $1 AND product_key = $2 AND intake_key = $3`,
      [input.config.accountKey, input.config.productKey, input.intakeKey],
    );
    await client.query(
      `UPDATE onetime.learning_delivery_content_factory_intakes
          SET intake_state = 'received', last_safe_error_code = NULL,
              audit_metadata_json = $4::jsonb, updated_at = now()
        WHERE account_key = $1 AND product_key = $2 AND intake_key = $3`,
      [
        input.config.accountKey,
        input.config.productKey,
        input.intakeKey,
        JSON.stringify({
          ...audit,
          manual_retry_count: nextManualRetryCount,
          manual_retry_window_limit: MAX_MANUAL_RETRY_WINDOWS,
          retry_actor_present: Boolean(input.actorUserKey),
        }),
      ],
    );
  });
}

async function runSyntheticStage(storage: VolumeContentFactoryStorage, job: Job) {
  const payload = { ...job.privatePayload };
  if (job.stage === 'inspecting') {
    const inspected = await storage.inspect(job.storageLocator);
    if (inspected.byteLength !== job.byteLength) {
      throw new SafeWorkerError('content_factory_source_size_mismatch', 'Private source changed.');
    }
    const durationMs = Math.max(45_000, Math.min(7_200_000, job.byteLength * 24));
    return {
      payload: { ...payload, probe: { duration_ms: durationMs, has_audio: true } },
      safeMetadata: { duration_ms: durationMs, has_audio: true, ffprobe_contract: true },
    };
  }
  if (job.stage === 'trimming') {
    const durationMs = numberAt(payload, 'probe', 'duration_ms');
    const segments = syntheticSegments(durationMs);
    const trim = suggestLearningDeliveryAutomaticTrim({
      durationMs,
      hasAudio: true,
      silenceRanges: [
        { startMs: 0, endMs: 10_000 },
        { startMs: durationMs - 14_000, endMs: durationMs },
      ],
      transcriptSegments: segments,
    });
    return {
      payload: { ...payload, trim },
      safeMetadata: {
        start_ms: trim.start_ms,
        end_ms: trim.end_ms,
        confidence: trim.confidence,
        middle_cut_performed: false,
      },
    };
  }
  if (job.stage === 'transcribing') {
    const durationMs = numberAt(payload, 'probe', 'duration_ms');
    const segments = syntheticSegments(durationMs);
    const artifact = buildLearningDeliveryTranscriptArtifact({
      sourceSha256: job.sourceSha256,
      providerModel: 'synthetic-provider-off-v1',
      language: 'en',
      durationMs,
      segments,
    });
    const normalizedTranscript = artifact.segments.map((segment) => segment.text).join(' ');
    return {
      payload: {
        ...payload,
        transcript: {
          segments: artifact.segments,
          normalized_transcript: normalizedTranscript,
          transcript_sha256: sha256(normalizedTranscript),
          webvtt: artifact.webvtt,
          webvtt_sha256: sha256(artifact.webvtt),
          model: 'synthetic-provider-off-v1',
          language: 'en',
        },
      },
      safeMetadata: {
        segment_count: artifact.segments.length,
        transcript_sha256: sha256(normalizedTranscript),
        webvtt_sha256: sha256(artifact.webvtt),
        provider: 'synthetic',
      },
    };
  }
  if (job.stage === 'drafting') {
    const transcript = objectAt(payload, 'transcript');
    const segments = transcript.segments as LearningDeliveryTranscriptSegment[];
    const draft = generateContentFactoryDraftFromTranscript({
      displayName: job.displayName,
      segments,
      classLabel: job.classTitle,
      classDate: job.classDate,
    });
    return {
      payload: { ...payload, draft },
      safeMetadata: {
        title_present: true,
        topic_count: draft.topics.length,
        review_question_count: draft.review_questions.length,
        draft_only: true,
        authoritative_torah_interpretation: false,
      },
    };
  }
  if (job.stage === 'uploading') {
    const providerVideoId = stableOt86Key('synthetic_video', [job.sourceSha256]);
    const providerTextTrackId = stableOt86Key('synthetic_track', [job.sourceSha256]);
    return {
      payload: {
        ...payload,
        provider: {
          provider_video_id: providerVideoId,
          provider_text_track_id: providerTextTrackId,
          privacy: 'private',
          captions_active: true,
        },
      },
      safeMetadata: {
        provider: 'synthetic',
        privacy: 'private',
        captions_active: true,
        raw_provider_url_present: false,
      },
    };
  }
  if (job.stage === 'review') {
    return {
      payload,
      safeMetadata: {
        editable_draft_ready: true,
        occurrence_key: job.occurrenceKey,
        approval_required: true,
      },
    };
  }
  throw new SafeWorkerError('content_factory_unknown_stage', 'Unknown processing stage.');
}

async function completeStage(input: {
  pool: DbPool;
  config: AppConfig;
  job: Job;
  output: { payload: Record<string, unknown>; safeMetadata: Record<string, unknown> };
  now: Date;
}) {
  return inTransaction(input.pool, async (client) => {
    const resultDigest = sha256(JSON.stringify(input.output.safeMetadata));
    await client.query(
      `INSERT INTO onetime.learning_delivery_content_factory_stage_results
         (stage_result_key, account_key, product_key, job_key, stage, result_digest,
          safe_metadata_json, completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::timestamptz)
       ON CONFLICT (account_key, product_key, job_key, stage) DO NOTHING`,
      [
        stableOt86Key('factory_stage', [input.job.jobKey, input.job.stage]),
        input.config.accountKey,
        input.config.productKey,
        input.job.jobKey,
        input.job.stage,
        resultDigest,
        JSON.stringify(input.output.safeMetadata),
        input.now.toISOString(),
      ],
    );
    if (input.job.stage === 'review') {
      const sourceKey =
        input.job.sourceKey ??
        stableOt86Key('factory_source', [input.job.sourceSha256, input.job.occurrenceKey]);
      await persistReviewItem(client, input.config, input.job, sourceKey, input.output.payload);
      const update = await client.query(
        `UPDATE onetime.learning_delivery_content_factory_jobs
            SET job_state = 'completed', current_stage = 'completed', source_key = $6,
                private_payload_json = $7::jsonb, completed_at = $8::timestamptz,
                lease_owner_digest = NULL, lease_expires_at = NULL, heartbeat_at = NULL,
                last_safe_error_code = NULL, updated_at = $8::timestamptz
          WHERE account_key = $1 AND product_key = $2 AND job_key = $3
            AND lease_owner_digest = $4 AND lease_generation = $5`,
        [
          input.config.accountKey,
          input.config.productKey,
          input.job.jobKey,
          input.job.leaseOwnerDigest,
          input.job.leaseGeneration,
          sourceKey,
          JSON.stringify(input.output.payload),
          input.now.toISOString(),
        ],
      );
      if (!update.rowCount)
        throw new SafeWorkerError('content_factory_lease_lost', 'Job lease lost.');
      await client.query(
        `UPDATE onetime.learning_delivery_content_factory_intakes
            SET intake_state = 'review', last_safe_error_code = NULL, updated_at = $4::timestamptz
          WHERE account_key = $1 AND product_key = $2 AND intake_key = $3`,
        [
          input.config.accountKey,
          input.config.productKey,
          input.job.intakeKey,
          input.now.toISOString(),
        ],
      );
      return true;
    }
    const nextStage = STAGES[STAGES.indexOf(input.job.stage) + 1]!;
    const update = await client.query(
      `UPDATE onetime.learning_delivery_content_factory_jobs
          SET job_state = 'queued', current_stage = $6, private_payload_json = $7::jsonb,
              lease_owner_digest = NULL, lease_expires_at = NULL, heartbeat_at = NULL,
              next_attempt_at = $8::timestamptz, last_safe_error_code = NULL,
              updated_at = $8::timestamptz
        WHERE account_key = $1 AND product_key = $2 AND job_key = $3
          AND lease_owner_digest = $4 AND lease_generation = $5`,
      [
        input.config.accountKey,
        input.config.productKey,
        input.job.jobKey,
        input.job.leaseOwnerDigest,
        input.job.leaseGeneration,
        nextStage,
        JSON.stringify(input.output.payload),
        input.now.toISOString(),
      ],
    );
    if (!update.rowCount)
      throw new SafeWorkerError('content_factory_lease_lost', 'Job lease lost.');
    await client.query(
      `UPDATE onetime.learning_delivery_content_factory_intakes
          SET intake_state = $4, last_safe_error_code = NULL, updated_at = $5::timestamptz
        WHERE account_key = $1 AND product_key = $2 AND intake_key = $3`,
      [
        input.config.accountKey,
        input.config.productKey,
        input.job.intakeKey,
        nextStage,
        input.now.toISOString(),
      ],
    );
    return false;
  });
}

async function persistReviewItem(
  client: Queryable,
  config: AppConfig,
  job: Job,
  sourceKey: string,
  payload: Record<string, unknown>,
) {
  const probe = objectAt(payload, 'probe');
  const trim = objectAt(payload, 'trim');
  const transcript = objectAt(payload, 'transcript');
  const draft = objectAt(payload, 'draft') as ContentFactoryDraft;
  const provider = objectAt(payload, 'provider');
  const originalDurationMs = Number(probe.duration_ms);
  const startMs = Number(trim.start_ms);
  const endMs = Number(trim.end_ms);
  await client.query(
    `INSERT INTO onetime.learning_delivery_content_factory_items
       (source_key, account_key, product_key, source_kind, source_ref_digest, source_sha256,
        display_name, mime_type, byte_length, factory_state, occurrence_key, processing_mode,
        original_duration_ms, prepared_duration_ms, trim_start_ms, trim_end_ms,
        removed_start_ms, removed_end_ms, trim_confidence, safe_duration,
        middle_cut_performed, transcript_segments_json, normalized_transcript,
        transcript_sha256, webvtt, webvtt_sha256, transcription_provider,
        transcription_model, transcription_language, transcript_review_state, draft_json,
        provider_video_id, provider_embed_url, provider_text_track_id, vimeo_privacy,
        captions_active, updated_at)
     VALUES ($1,$2,$3,'local_drop',$4,$5,$6,$7,$8,'needs_review',$9,'synthetic',
       $10,$11,$12,$13,$14,$15,$16,true,false,$17::jsonb,$18,$19,$20,$21,'synthetic',
       $22,$23,'draft',$24::jsonb,$25,NULL,$26,'private',true,now())
     ON CONFLICT (account_key, product_key, source_sha256)
     DO UPDATE SET occurrence_key = EXCLUDED.occurrence_key, processing_mode = 'synthetic',
       display_name = EXCLUDED.display_name, factory_state = 'needs_review',
       original_duration_ms = EXCLUDED.original_duration_ms,
       prepared_duration_ms = EXCLUDED.prepared_duration_ms,
       trim_start_ms = EXCLUDED.trim_start_ms, trim_end_ms = EXCLUDED.trim_end_ms,
       removed_start_ms = EXCLUDED.removed_start_ms, removed_end_ms = EXCLUDED.removed_end_ms,
       trim_confidence = EXCLUDED.trim_confidence,
       transcript_segments_json = EXCLUDED.transcript_segments_json,
       normalized_transcript = EXCLUDED.normalized_transcript,
       transcript_sha256 = EXCLUDED.transcript_sha256, webvtt = EXCLUDED.webvtt,
       webvtt_sha256 = EXCLUDED.webvtt_sha256, transcription_model = EXCLUDED.transcription_model,
       transcription_language = EXCLUDED.transcription_language,
       transcript_review_state = 'draft', draft_json = EXCLUDED.draft_json,
       provider_video_id = EXCLUDED.provider_video_id, provider_embed_url = NULL,
       provider_text_track_id = EXCLUDED.provider_text_track_id, vimeo_privacy = 'private',
       captions_active = true, approved_by_user_key = NULL, approved_at = NULL,
       published_by_user_key = NULL, published_at = NULL, last_safe_error_code = NULL,
       updated_at = now()`,
    [
      sourceKey,
      config.accountKey,
      config.productKey,
      job.sourceRefDigest,
      job.sourceSha256,
      job.displayName,
      job.mimeType,
      job.byteLength,
      job.occurrenceKey,
      originalDurationMs,
      endMs - startMs,
      startMs,
      endMs,
      Number(trim.removed_start_ms),
      Number(trim.removed_end_ms),
      Number(trim.confidence),
      JSON.stringify(transcript.segments),
      transcript.normalized_transcript,
      transcript.transcript_sha256,
      transcript.webvtt,
      transcript.webvtt_sha256,
      transcript.model,
      transcript.language,
      JSON.stringify(draft),
      provider.provider_video_id,
      provider.provider_text_track_id,
    ],
  );
}

async function failStage(input: {
  pool: DbPool;
  config: AppConfig;
  job: Job;
  safeErrorCode: string;
  now: Date;
}) {
  await inTransaction(input.pool, async (client) => {
    const current = await client.query(
      `SELECT attempt_count, max_attempts
         FROM onetime.learning_delivery_content_factory_jobs
        WHERE account_key = $1 AND product_key = $2 AND job_key = $3 LIMIT 1 FOR UPDATE`,
      [input.config.accountKey, input.config.productKey, input.job.jobKey],
    );
    if (!current.rows[0]) return;
    const terminal = Number(current.rows[0].attempt_count) >= Number(current.rows[0].max_attempts);
    const delayMs = Math.min(
      300_000,
      1_000 * 2 ** Math.min(8, Number(current.rows[0].attempt_count)),
    );
    await client.query(
      `UPDATE onetime.learning_delivery_content_factory_jobs
          SET job_state = $6, next_attempt_at = $7::timestamptz,
              lease_owner_digest = NULL, lease_expires_at = NULL, heartbeat_at = NULL,
              last_safe_error_code = $8, updated_at = $5::timestamptz
        WHERE account_key = $1 AND product_key = $2 AND job_key = $3
          AND lease_owner_digest = $4`,
      [
        input.config.accountKey,
        input.config.productKey,
        input.job.jobKey,
        input.job.leaseOwnerDigest,
        input.now.toISOString(),
        terminal ? 'dead_letter' : 'retry_wait',
        new Date(input.now.getTime() + delayMs).toISOString(),
        input.safeErrorCode,
      ],
    );
    await client.query(
      `UPDATE onetime.learning_delivery_content_factory_intakes
          SET intake_state = 'failed', last_safe_error_code = $4,
              updated_at = $5::timestamptz
        WHERE account_key = $1 AND product_key = $2 AND intake_key = $3`,
      [
        input.config.accountKey,
        input.config.productKey,
        input.job.intakeKey,
        input.safeErrorCode,
        input.now.toISOString(),
      ],
    );
  });
}

function jobFromRows(
  row: Record<string, unknown>,
  intake: Record<string, unknown>,
  leaseOwnerDigest: string,
): Job {
  return {
    jobKey: String(row.job_key),
    intakeKey: String(row.intake_key),
    occurrenceKey: String(row.occurrence_key),
    idempotencyKey: String(row.idempotency_key),
    stage: row.current_stage as Stage,
    leaseGeneration: Number(row.lease_generation),
    leaseOwnerDigest,
    sourceKey: row.source_key ? String(row.source_key) : null,
    displayName: String(intake.display_name),
    mimeType: String(intake.mime_type),
    byteLength: Number(intake.byte_length),
    sourceSha256: String(intake.source_sha256),
    sourceRefDigest: String(intake.private_ref_digest),
    storageLocator: String(intake.storage_locator),
    classTitle: String(intake.class_title),
    classDate: dateValue(intake.local_class_date).toISOString().slice(0, 10),
    privatePayload: recordValue(row.private_payload_json),
  };
}

function syntheticSegments(durationMs: number): LearningDeliveryTranscriptSegment[] {
  const statements = [
    'This synthetic provider-off lesson introduces the Mishnah text for classroom review.',
    'The class identifies the first case exactly as it appears in the review source.',
    'Students compare the wording of the first case with the second classroom example.',
    'The Rabbi and Admin must review this draft before it is shared with learners.',
    'The class repeats the key Mishnah terms to prepare for the review questions.',
    'This transcript is a synthetic acceptance artifact and does not state a halachic ruling.',
  ];
  const usableStart = 10_000;
  const usableEnd = Math.max(usableStart + 30_000, durationMs - 14_000);
  const step = Math.max(5_000, Math.floor((usableEnd - usableStart) / statements.length));
  return statements.map((text, index) => ({
    segment_id: `synthetic_segment_${index + 1}`,
    start_ms: usableStart + index * step,
    end_ms: Math.min(usableEnd, usableStart + (index + 1) * step - 500),
    text,
  }));
}

function objectAt(value: Record<string, unknown>, key: string) {
  const candidate = value[key];
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new SafeWorkerError(
      'content_factory_stage_prerequisite_missing',
      'Stage prerequisite missing.',
    );
  }
  return candidate as Record<string, unknown>;
}

function numberAt(value: Record<string, unknown>, objectKey: string, numberKey: string) {
  const number = Number(objectAt(value, objectKey)[numberKey]);
  if (!Number.isFinite(number)) {
    throw new SafeWorkerError(
      'content_factory_stage_prerequisite_missing',
      'Stage prerequisite missing.',
    );
  }
  return number;
}

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function dateValue(value: unknown) {
  return value instanceof Date ? value : new Date(String(value));
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

class SafeWorkerError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
