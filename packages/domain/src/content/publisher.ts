import { createHash } from 'node:crypto';
import {
  ot109ArtifactKindSchema,
  ot109DerivativeDraftSchema,
  ot109KnowledgeRetrievalResponseSchema,
  ot109RegisterSourceInputSchema,
  ot109ReviewDecisionSchema,
  ot109SourceSummarySchema,
  ot109TranscriptSegmentSchema,
  ot86ApprovedForSocialEventSchema,
  type Ot109ArtifactKind,
  type Ot109DerivativeDraft,
  type Ot109KnowledgeRetrievalResponse,
  type Ot109PublisherState,
  type Ot109RegisterSourceInput,
  type Ot109ReviewDecision,
  type Ot109SourceKind,
  type Ot109SourceSummary,
  type Ot109TranscriptSegment,
  type Ot86ApprovedForSocialEvent,
  type Ot86ContentPublishManifest,
} from '../../../contracts/src/content/index.ts';
import type { DbPool, Queryable } from '../../../db/src/index.ts';
import { inTransaction } from '../../../db/src/index.ts';
import { canonicalJson, stableOt86Key, withOt86ManifestChecksum } from './pipeline.ts';

export const OT109_SCOPE = {
  account_key: 'rabbi_sheller_provider',
  product_key: 'one_time_mishnah_class',
} as const;

const OT109_POLICY_VERSION = 'ot109-rabbi-content-publisher-v1';
const OT109_ORIGIN = 'ot109-rabbi-content-publisher';
const DEFAULT_CANONICAL_BASE_URL = 'https://join.onetimeonetime.com';
const OPAQUE_ASSET_BASE_URL = 'https://assets.onetimeonetime.invalid/ot109';
const ARTIFACT_KINDS: Ot109ArtifactKind[] = [
  'library',
  'helper',
  'social',
  'review_sheet',
  'classroom_resource',
];
const HELPER_MIN_SCORE = 1;

export class Ot109PublisherError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus = 400,
  ) {
    super(message);
  }
}

export type Ot109VimeoProcessingState = 'accepted' | 'transcoding' | 'ready' | 'failed';

export type Ot109VimeoReference = {
  providerReference: string;
  referenceMode: 'automated_upload' | 'manual_private_reference';
  processingState: Ot109VimeoProcessingState;
  safeMetadata?: Record<string, unknown>;
};

export type Ot109VimeoStatus = {
  processingState: Ot109VimeoProcessingState;
  safeMetadata?: Record<string, unknown>;
  textTrackSegments?: Ot109TranscriptSegment[] | null;
  durationMs?: number | null;
};

export type Ot109VimeoPort = {
  uploadPrivateMedia(input: {
    sourceKey: string;
    sourceKind: Exclude<Ot109SourceKind, 'private_vimeo_reference'>;
    sourceRefDigest: string;
    sourceSha256: string;
    originalName: string | null;
    byteLength: number | null;
    correlationId: string;
  }): Promise<Ot109VimeoReference>;
  acceptPrivateReference(input: {
    sourceKey: string;
    sourceRefDigest: string;
    sourceSha256: string;
    correlationId: string;
  }): Promise<Ot109VimeoReference>;
  inspectPrivateVideo(input: {
    mediaKey: string;
    sourceKey: string;
    providerRefDigest: string;
    correlationId: string;
  }): Promise<Ot109VimeoStatus>;
};

export type Ot109TranscriptionPort = {
  transcribe(input: {
    sourceKey: string;
    mediaKey: string;
    sourceSha256: string;
    correlationId: string;
  }): Promise<{
    segments: Ot109TranscriptSegment[];
    durationMs?: number | null;
    safeMetadata?: Record<string, unknown>;
  }>;
};

export function createDisabledOt109VimeoPort(): Ot109VimeoPort {
  return {
    async uploadPrivateMedia() {
      throw new Ot109PublisherError(
        'VIMEO_PORT_DISABLED',
        'Private Vimeo upload port is not configured.',
        503,
      );
    },
    async acceptPrivateReference() {
      throw new Ot109PublisherError(
        'VIMEO_PORT_DISABLED',
        'Private Vimeo reference port is not configured.',
        503,
      );
    },
    async inspectPrivateVideo() {
      throw new Ot109PublisherError(
        'VIMEO_PORT_DISABLED',
        'Private Vimeo status port is not configured.',
        503,
      );
    },
  };
}

export function createDisabledOt109TranscriptionPort(): Ot109TranscriptionPort {
  return {
    async transcribe() {
      throw new Ot109PublisherError(
        'TRANSCRIPTION_PORT_DISABLED',
        'Transcription port is not configured.',
        503,
      );
    },
  };
}

export async function registerOt109Source(input: {
  pool: DbPool;
  source: Ot109RegisterSourceInput;
  now?: Date;
}): Promise<Ot109SourceSummary & { duplicate: boolean }> {
  const source = ot109RegisterSourceInputSchema.parse(input.source);
  assertAllowedSourceReference(source);
  const now = input.now ?? new Date();
  const sourceRefDigest = sha256(source.source_reference);
  const requestSha256 = sha256(
    canonicalJson({
      ...source,
      source_reference: sourceRefDigest,
      scope: OT109_SCOPE,
    }),
  );
  const sourceKey = stableOt86Key('ot109_source', [
    OT109_SCOPE.account_key,
    OT109_SCOPE.product_key,
    source.source_kind,
    sourceRefDigest,
    source.source_sha256,
  ]);

  return inTransaction(input.pool, async (client) => {
    const existingIdempotency = await client.query(
      `SELECT *
         FROM onetime.ot109_sources
        WHERE idempotency_key = $1
        LIMIT 1`,
      [source.idempotency_key],
    );
    if (existingIdempotency.rowCount) {
      const row = existingIdempotency.rows[0] as SourceRow;
      if (String(row.request_sha256) !== requestSha256) {
        throw new Ot109PublisherError(
          'IDEMPOTENCY_CONFLICT',
          'Source idempotency key was reused with different source material.',
          409,
        );
      }
      return { ...summarizeSource(row), duplicate: true };
    }

    const existingNatural = await client.query(
      `SELECT *
         FROM onetime.ot109_sources
        WHERE account_key = $1
          AND product_key = $2
          AND source_kind = $3
          AND source_ref_digest = $4
          AND source_sha256 = $5
        LIMIT 1`,
      [
        OT109_SCOPE.account_key,
        OT109_SCOPE.product_key,
        source.source_kind,
        sourceRefDigest,
        source.source_sha256,
      ],
    );
    if (existingNatural.rowCount) {
      return { ...summarizeSource(existingNatural.rows[0] as SourceRow), duplicate: true };
    }

    await client.query(
      `INSERT INTO onetime.ot109_sources
         (source_key, account_key, product_key, idempotency_key, request_sha256,
          source_kind, source_ref_digest, source_sha256, original_name, byte_length,
          provenance_json, state, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,'source_registered',$12,$12)`,
      [
        sourceKey,
        OT109_SCOPE.account_key,
        OT109_SCOPE.product_key,
        source.idempotency_key,
        requestSha256,
        source.source_kind,
        sourceRefDigest,
        source.source_sha256,
        source.original_name ?? null,
        source.byte_length ?? null,
        JSON.stringify(sanitizeMetadata(source.provenance)),
        now,
      ],
    );
    await recordPublisherEvent(client, {
      sourceKey,
      actorId: source.submitted_by_actor_id,
      actorType: 'operator',
      action: 'source_registered',
      previousState: null,
      nextState: 'source_registered',
      reasonCode: 'provenance_verified',
      correlationId: source.idempotency_key,
      safeMetadata: {
        source_kind: source.source_kind,
        source_ref_digest: sourceRefDigest,
        source_sha256: source.source_sha256,
      },
      now,
    });

    const inserted = await loadSource(client, sourceKey);
    return { ...summarizeSource(inserted), duplicate: false };
  });
}

export async function runOt109PublisherWorkerOnce(input: {
  pool: DbPool;
  vimeo?: Ot109VimeoPort;
  transcription?: Ot109TranscriptionPort;
  actorId?: string;
  correlationId?: string;
  now?: Date;
}): Promise<{ claimed: boolean; action: string | null; source: Ot109SourceSummary | null }> {
  const now = input.now ?? new Date();
  const vimeo = input.vimeo ?? createDisabledOt109VimeoPort();
  const transcription = input.transcription ?? createDisabledOt109TranscriptionPort();
  const actorId = input.actorId ?? 'ot109_worker';
  const correlationId =
    input.correlationId ?? stableOt86Key('ot109_worker_corr', [now.toISOString()]);

  const selected = await input.pool.query(
    `SELECT *
       FROM onetime.ot109_sources
      WHERE state IN (
        'source_registered',
        'awaiting_media_intake',
        'media_intake_processing',
        'vimeo_reference_accepted',
        'transcoding',
        'awaiting_transcript',
        'transcript_processing'
      )
      ORDER BY updated_at ASC, source_key ASC
      LIMIT 1`,
  );
  if (!selected.rowCount) {
    return { claimed: false, action: null, source: null };
  }

  const source = selected.rows[0] as SourceRow;
  try {
    const result = await advanceSource({
      pool: input.pool,
      source,
      vimeo,
      transcription,
      actorId,
      correlationId,
      now,
    });
    return { claimed: true, action: result.action, source: result.source };
  } catch (error) {
    const reasonCode =
      error instanceof Ot109PublisherError ? error.code : 'UNEXPECTED_WORKER_ERROR';
    const nextState: Ot109PublisherState =
      error instanceof Ot109PublisherError && error.httpStatus >= 500
        ? 'blocked'
        : 'retryable_failure';
    const summary = await failSource({
      pool: input.pool,
      sourceKey: String(source.source_key),
      previousState: parseState(source.state),
      nextState,
      actorId,
      correlationId,
      reasonCode,
      now,
    });
    return { claimed: true, action: nextState, source: summary };
  }
}

export async function approveOt109TranscriptAndGenerateDrafts(input: {
  pool: DbPool;
  sourceKey: string;
  transcriptKey?: string | null;
  approvedByActorId: string;
  correlationId: string;
  now?: Date;
}): Promise<{ source: Ot109SourceSummary; draft: Ot109DerivativeDraft }> {
  const now = input.now ?? new Date();
  return inTransaction(input.pool, async (client) => {
    const source = await loadSource(client, input.sourceKey);
    const transcript = await loadTranscript(
      client,
      input.transcriptKey ?? String(source.current_transcript_key ?? ''),
      input.sourceKey,
    );
    if (String(transcript.approval_state) === 'rejected') {
      throw new Ot109PublisherError(
        'TRANSCRIPT_REJECTED',
        'Rejected transcript cannot be approved.',
      );
    }
    if (!['transcript_ready_unapproved', 'human_review_required'].includes(String(source.state))) {
      throw new Ot109PublisherError(
        'SOURCE_NOT_READY_FOR_REVIEW',
        'Source does not have an unapproved transcript ready for review.',
        409,
      );
    }

    await client.query(
      `UPDATE onetime.ot109_transcripts
          SET approval_state = 'approved',
              approved_by_actor_id = $3,
              approved_at = $4
        WHERE transcript_key = $1
          AND source_key = $2`,
      [transcript.transcript_key, input.sourceKey, input.approvedByActorId, now],
    );

    const segments = parseSegments(transcript.segments_json);
    const revisionNumber = await nextRevisionNumber(client, input.sourceKey);
    const versionKey = stableOt86Key('ot109_version', [
      input.sourceKey,
      String(transcript.transcript_key),
      String(revisionNumber),
    ]);
    const draft = buildDerivativeDraft({
      source,
      transcriptKey: String(transcript.transcript_key),
      versionKey,
      segments,
    });

    await transitionSource(client, {
      sourceKey: input.sourceKey,
      previousState: parseState(source.state),
      nextState: 'derivatives_generated',
      actorId: input.approvedByActorId,
      actorType: 'operator',
      reasonCode: 'transcript_human_approved',
      correlationId: input.correlationId,
      safeMetadata: {
        transcript_key: transcript.transcript_key,
        segment_count: segments.length,
        transcript_sha256: transcript.transcript_sha256,
      },
      now,
    });

    await client.query(
      `INSERT INTO onetime.ot109_derivative_versions
         (version_key, source_key, transcript_key, revision_number, draft_sha256, draft_json,
          version_state, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,'human_review_required',$7,$7)
       ON CONFLICT (source_key, draft_sha256) DO NOTHING`,
      [
        draft.version_key,
        draft.source_key,
        draft.transcript_key,
        revisionNumber,
        draft.draft_sha256,
        JSON.stringify(draft),
        now,
      ],
    );
    for (const artifactKind of ARTIFACT_KINDS) {
      await client.query(
        `INSERT INTO onetime.ot109_artifact_reviews
           (review_key, version_key, artifact_kind, artifact_sha256, decision_state, created_at, updated_at)
         VALUES ($1,$2,$3,$4,'pending',$5,$5)
         ON CONFLICT (version_key, artifact_kind) DO NOTHING`,
        [
          stableOt86Key('ot109_review', [draft.version_key, artifactKind]),
          draft.version_key,
          artifactKind,
          artifactDigest(draft, artifactKind),
          now,
        ],
      );
    }

    await client.query(
      `UPDATE onetime.ot109_sources
          SET current_version_key = $2,
              updated_at = $3
        WHERE source_key = $1`,
      [input.sourceKey, draft.version_key, now],
    );
    await transitionSource(client, {
      sourceKey: input.sourceKey,
      previousState: 'derivatives_generated',
      nextState: 'human_review_required',
      actorId: input.approvedByActorId,
      actorType: 'operator',
      reasonCode: 'derivative_drafts_ready_for_review',
      correlationId: input.correlationId,
      safeMetadata: {
        version_key: draft.version_key,
        draft_sha256: draft.draft_sha256,
      },
      now,
    });

    return {
      source: summarizeSource(await loadSource(client, input.sourceKey)),
      draft,
    };
  });
}

export async function reviewOt109Artifact(input: {
  pool: DbPool;
  versionKey: string;
  artifactKind: Ot109ArtifactKind;
  decision: Ot109ReviewDecision;
  decidedByActorId: string;
  correlationId: string;
  reasonCode?: string | null;
  redactedNote?: string | null;
  now?: Date;
}) {
  const artifactKind = ot109ArtifactKindSchema.parse(input.artifactKind);
  const decision = ot109ReviewDecisionSchema.parse(input.decision);
  const now = input.now ?? new Date();
  return inTransaction(input.pool, async (client) => {
    const version = await loadVersion(client, input.versionKey);
    const source = await loadSource(client, String(version.source_key));
    const draft = ot109DerivativeDraftSchema.parse(asRecord(version.draft_json));
    const artifactSha256 = artifactDigest(draft, artifactKind);
    const reviewKey = stableOt86Key('ot109_review', [input.versionKey, artifactKind]);

    await client.query(
      `INSERT INTO onetime.ot109_artifact_reviews
         (review_key, version_key, artifact_kind, artifact_sha256, decision_state,
          decided_by_actor_id, decided_at, reason_code, redacted_note, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$7,$7)
       ON CONFLICT (version_key, artifact_kind)
       DO UPDATE SET artifact_sha256 = EXCLUDED.artifact_sha256,
                     decision_state = EXCLUDED.decision_state,
                     decided_by_actor_id = EXCLUDED.decided_by_actor_id,
                     decided_at = EXCLUDED.decided_at,
                     reason_code = EXCLUDED.reason_code,
                     redacted_note = EXCLUDED.redacted_note,
                     updated_at = EXCLUDED.updated_at`,
      [
        reviewKey,
        input.versionKey,
        artifactKind,
        artifactSha256,
        decision,
        input.decidedByActorId,
        now,
        input.reasonCode ?? null,
        sanitizeNote(input.redactedNote),
      ],
    );

    const nextState = nextStateForArtifactDecision(artifactKind, decision);
    if (decision === 'approved') {
      await client.query(
        `UPDATE onetime.ot109_derivative_versions
            SET version_state = 'partially_approved',
                updated_at = $2
          WHERE version_key = $1
            AND version_state <> 'published'`,
        [input.versionKey, now],
      );
    }
    await transitionSource(client, {
      sourceKey: String(source.source_key),
      previousState: parseState(source.state),
      nextState,
      actorId: input.decidedByActorId,
      actorType: 'operator',
      reasonCode: input.reasonCode ?? `artifact_${decision}`,
      correlationId: input.correlationId,
      artifactKind,
      versionKey: input.versionKey,
      safeMetadata: { artifact_sha256: artifactSha256 },
      now,
    });

    const updated = await client.query(
      `SELECT *
         FROM onetime.ot109_artifact_reviews
        WHERE review_key = $1
        LIMIT 1`,
      [reviewKey],
    );
    return updated.rows[0] as Record<string, unknown>;
  });
}

export async function publishOt109ApprovedArtifacts(input: {
  pool: DbPool;
  versionKey: string;
  artifactKinds?: Ot109ArtifactKind[];
  publishedByActorId: string;
  correlationId: string;
  canonicalBaseUrl?: string;
  now?: Date;
}): Promise<{
  source: Ot109SourceSummary;
  publications: Array<{
    publication_key: string;
    artifact_kind: Ot109ArtifactKind;
    payload_sha256: string;
    duplicate: boolean;
  }>;
}> {
  const now = input.now ?? new Date();
  const requestedKinds = input.artifactKinds?.length
    ? input.artifactKinds.map((kind) => ot109ArtifactKindSchema.parse(kind))
    : ARTIFACT_KINDS;
  return inTransaction(input.pool, async (client) => {
    const version = await loadVersion(client, input.versionKey);
    const source = await loadSource(client, String(version.source_key));
    const transcript = await loadTranscript(
      client,
      String(version.transcript_key),
      String(source.source_key),
    );
    const media = await loadMedia(client, String(source.current_media_key ?? ''));
    const draft = ot109DerivativeDraftSchema.parse(asRecord(version.draft_json));
    const reviews = await client.query(
      `SELECT *
         FROM onetime.ot109_artifact_reviews
        WHERE version_key = $1
          AND artifact_kind = ANY($2)
          AND decision_state = 'approved'
        ORDER BY artifact_kind ASC`,
      [input.versionKey, requestedKinds],
    );
    if (!reviews.rowCount) {
      throw new Ot109PublisherError(
        'NO_APPROVED_ARTIFACTS',
        'No requested artifacts have an approved human review.',
        409,
      );
    }

    const publications: Array<{
      publication_key: string;
      artifact_kind: Ot109ArtifactKind;
      payload_sha256: string;
      duplicate: boolean;
    }> = [];

    for (const review of reviews.rows as ReviewRow[]) {
      const artifactKind = ot109ArtifactKindSchema.parse(review.artifact_kind);
      const payload = buildPublicationPayload({
        artifactKind,
        source,
        media,
        transcript,
        version,
        review,
        draft,
        canonicalBaseUrl: input.canonicalBaseUrl ?? DEFAULT_CANONICAL_BASE_URL,
        now,
      });
      const payloadSha256 = sha256(canonicalJson(payload));
      const publicationKey = stableOt86Key('ot109_pub', [
        input.versionKey,
        artifactKind,
        String(review.artifact_sha256),
      ]);
      const existingPublication = await client.query(
        `SELECT publication_key
           FROM onetime.ot109_publications
          WHERE publication_key = $1
             OR (version_key = $2 AND artifact_kind = $3 AND artifact_sha256 = $4)
          LIMIT 1`,
        [publicationKey, input.versionKey, artifactKind, review.artifact_sha256],
      );
      if (existingPublication.rowCount) {
        publications.push({
          publication_key: publicationKey,
          artifact_kind: artifactKind,
          payload_sha256: payloadSha256,
          duplicate: true,
        });
        continue;
      }
      const inserted = await client.query(
        `INSERT INTO onetime.ot109_publications
           (publication_key, source_key, version_key, artifact_kind, artifact_sha256, channel,
            payload_sha256, payload_json, active_state, published_by_actor_id, published_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,'active',$9,$10)
         ON CONFLICT (version_key, artifact_kind, artifact_sha256) DO NOTHING
         RETURNING publication_key`,
        [
          publicationKey,
          source.source_key,
          input.versionKey,
          artifactKind,
          review.artifact_sha256,
          channelForArtifact(artifactKind),
          payloadSha256,
          JSON.stringify(payload),
          input.publishedByActorId,
          now,
        ],
      );
      publications.push({
        publication_key: publicationKey,
        artifact_kind: artifactKind,
        payload_sha256: payloadSha256,
        duplicate: inserted.rowCount === 0,
      });
      await recordPublisherEvent(client, {
        sourceKey: String(source.source_key),
        versionKey: input.versionKey,
        artifactKind,
        actorId: input.publishedByActorId,
        actorType: 'operator',
        action: 'artifact_published',
        previousState: parseState(source.state),
        nextState: 'published',
        reasonCode: `published_${artifactKind}`,
        correlationId: input.correlationId,
        safeMetadata: {
          publication_key: publicationKey,
          payload_sha256: payloadSha256,
        },
        now,
      });
    }

    await client.query(
      `UPDATE onetime.ot109_derivative_versions
          SET version_state = 'published',
              updated_at = $2
        WHERE version_key = $1`,
      [input.versionKey, now],
    );
    await client.query(
      `UPDATE onetime.ot109_sources
          SET state = 'published',
              updated_at = $2
        WHERE source_key = $1`,
      [source.source_key, now],
    );

    return {
      source: summarizeSource(await loadSource(client, String(source.source_key))),
      publications,
    };
  });
}

export async function revokeOt109Publication(input: {
  pool: DbPool;
  publicationKey: string;
  revokedByActorId: string;
  correlationId: string;
  safeReasonCode: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return inTransaction(input.pool, async (client) => {
    const existing = await client.query(
      `SELECT *
         FROM onetime.ot109_publications
        WHERE publication_key = $1
        LIMIT 1`,
      [input.publicationKey],
    );
    if (!existing.rowCount) {
      throw new Ot109PublisherError('PUBLICATION_NOT_FOUND', 'Publication was not found.', 404);
    }
    const publication = existing.rows[0] as PublicationRow;
    await client.query(
      `UPDATE onetime.ot109_publications
          SET active_state = 'revoked',
              revoked_by_actor_id = $2,
              revoked_at = $3,
              safe_reason_code = $4
        WHERE publication_key = $1
          AND active_state = 'active'`,
      [input.publicationKey, input.revokedByActorId, now, input.safeReasonCode],
    );
    await recordPublisherEvent(client, {
      sourceKey: String(publication.source_key),
      versionKey: String(publication.version_key),
      artifactKind: ot109ArtifactKindSchema.parse(publication.artifact_kind),
      actorId: input.revokedByActorId,
      actorType: 'operator',
      action: 'publication_revoked',
      previousState: 'published',
      nextState: 'published',
      reasonCode: input.safeReasonCode,
      correlationId: input.correlationId,
      safeMetadata: { publication_key: input.publicationKey },
      now,
    });
    return { publication_key: input.publicationKey, active_state: 'revoked' as const };
  });
}

export async function retrieveOt109HelperKnowledge(input: {
  pool: DbPool;
  principalId: string;
  entitlementSourceKeys: string[];
  question: string;
  correlationId: string;
  now?: Date;
}): Promise<Ot109KnowledgeRetrievalResponse> {
  if (input.entitlementSourceKeys.length < 1) {
    return ot109KnowledgeRetrievalResponseSchema.parse({
      answer: 'I do not have approved Rabbi class material for that request.',
      abstained: true,
      safe_reason_code: 'not_entitled',
      citations: [],
      correlation_id: input.correlationId,
    });
  }
  const terms = tokenize(input.question);
  if (terms.length < 1) {
    return ot109KnowledgeRetrievalResponseSchema.parse({
      answer: 'I can only answer from approved Rabbi class material.',
      abstained: true,
      safe_reason_code: 'unsupported',
      citations: [],
      correlation_id: input.correlationId,
    });
  }
  const result = await input.pool.query(
    `SELECT source_key, version_key, payload_json
       FROM onetime.ot109_publications
      WHERE channel = 'student_helper_knowledge'
        AND active_state = 'active'
      ORDER BY published_at DESC
      LIMIT 200`,
  );
  const ranked = (result.rows as Array<Record<string, unknown>>)
    .filter((row) => input.entitlementSourceKeys.includes(String(row.source_key)))
    .flatMap((row) => helperChunksFromPublication(row))
    .map((entry) => ({ entry, score: scoreText(entry.answer_seed, terms) }))
    .filter(({ score }) => score >= HELPER_MIN_SCORE)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);

  if (!ranked.length) {
    return ot109KnowledgeRetrievalResponseSchema.parse({
      answer: 'I can only answer from approved Rabbi class material.',
      abstained: true,
      safe_reason_code: 'unsupported',
      citations: [],
      correlation_id: input.correlationId,
    });
  }

  const [best] = ranked;
  return ot109KnowledgeRetrievalResponseSchema.parse({
    answer: safeAnswer(best?.entry.answer_seed ?? 'Approved Rabbi class material supports this.'),
    abstained: false,
    safe_reason_code: 'supported_by_approved_ot109_helper_chunk',
    citations: ranked.map(({ entry }) => ({
      source_key: entry.source_key,
      version_key: entry.version_key,
      chunk_id: entry.chunk_id,
      start_ms: entry.citation_start_ms,
      end_ms: entry.citation_end_ms,
      source_sha256: entry.source_sha256,
    })),
    correlation_id: input.correlationId,
  });
}

async function advanceSource(input: {
  pool: DbPool;
  source: SourceRow;
  vimeo: Ot109VimeoPort;
  transcription: Ot109TranscriptionPort;
  actorId: string;
  correlationId: string;
  now: Date;
}) {
  const state = parseState(input.source.state);
  if (state === 'source_registered') {
    const source = await transitionSource(input.pool, {
      sourceKey: String(input.source.source_key),
      previousState: state,
      nextState: 'awaiting_media_intake',
      actorId: input.actorId,
      actorType: 'service',
      reasonCode: 'private_intake_queued',
      correlationId: input.correlationId,
      safeMetadata: {},
      now: input.now,
    });
    return { action: 'awaiting_media_intake', source };
  }

  if (state === 'awaiting_media_intake' || state === 'media_intake_processing') {
    const readySource = await transitionSource(input.pool, {
      sourceKey: String(input.source.source_key),
      previousState: state,
      nextState: 'media_intake_processing',
      actorId: input.actorId,
      actorType: 'service',
      reasonCode: 'private_media_intake_started',
      correlationId: input.correlationId,
      safeMetadata: {},
      now: input.now,
    });
    const latest = await loadSource(input.pool, readySource.source_key);
    const reference =
      String(latest.source_kind) === 'private_vimeo_reference'
        ? await input.vimeo.acceptPrivateReference({
            sourceKey: String(latest.source_key),
            sourceRefDigest: String(latest.source_ref_digest),
            sourceSha256: String(latest.source_sha256),
            correlationId: input.correlationId,
          })
        : await input.vimeo.uploadPrivateMedia({
            sourceKey: String(latest.source_key),
            sourceKind: latest.source_kind as Exclude<Ot109SourceKind, 'private_vimeo_reference'>,
            sourceRefDigest: String(latest.source_ref_digest),
            sourceSha256: String(latest.source_sha256),
            originalName: nullableString(latest.original_name),
            byteLength: nullableNumber(latest.byte_length),
            correlationId: input.correlationId,
          });
    const media = await persistMediaReference(input.pool, {
      source: latest,
      reference,
      actorId: input.actorId,
      correlationId: input.correlationId,
      now: input.now,
    });
    return {
      action: 'media_reference_accepted',
      source: await transitionForMediaState(input.pool, {
        sourceKey: String(latest.source_key),
        previousState: 'media_intake_processing',
        mediaKey: media.media_key,
        processingState: reference.processingState,
        actorId: input.actorId,
        correlationId: input.correlationId,
        now: input.now,
      }),
    };
  }

  if (state === 'vimeo_reference_accepted' || state === 'transcoding') {
    const media = await loadMedia(input.pool, String(input.source.current_media_key ?? ''));
    const status = await input.vimeo.inspectPrivateVideo({
      mediaKey: String(media.media_key),
      sourceKey: String(input.source.source_key),
      providerRefDigest: String(media.provider_ref_digest),
      correlationId: input.correlationId,
    });
    await updateMediaStatus(input.pool, media, status, input.now);
    if (status.processingState === 'failed') {
      return {
        action: 'media_failed',
        source: await failSource({
          pool: input.pool,
          sourceKey: String(input.source.source_key),
          previousState: state,
          nextState: 'retryable_failure',
          actorId: input.actorId,
          correlationId: input.correlationId,
          reasonCode: 'VIMEO_PROCESSING_FAILED',
          now: input.now,
        }),
      };
    }
    if (status.processingState !== 'ready') {
      return {
        action: 'transcoding',
        source: await transitionSource(input.pool, {
          sourceKey: String(input.source.source_key),
          previousState: state,
          nextState: 'transcoding',
          actorId: input.actorId,
          actorType: 'service',
          reasonCode: 'vimeo_processing_pending',
          correlationId: input.correlationId,
          safeMetadata: { media_key: media.media_key },
          now: input.now,
        }),
      };
    }
    if (status.textTrackSegments?.length) {
      const transcript = await persistTranscript(input.pool, {
        source: input.source,
        media,
        segments: status.textTrackSegments,
        transcriptSource: 'approved_vimeo_text_track',
        durationMs: status.durationMs ?? null,
        actorId: input.actorId,
        correlationId: input.correlationId,
        now: input.now,
      });
      return {
        action: 'transcript_imported',
        source: await transitionSource(input.pool, {
          sourceKey: String(input.source.source_key),
          previousState: state,
          nextState: 'transcript_ready_unapproved',
          actorId: input.actorId,
          actorType: 'service',
          reasonCode: 'approved_vimeo_text_track_imported',
          correlationId: input.correlationId,
          safeMetadata: {
            media_key: media.media_key,
            transcript_key: transcript.transcript_key,
            transcript_sha256: transcript.transcript_sha256,
          },
          now: input.now,
        }),
      };
    }
    return {
      action: 'awaiting_transcript',
      source: await transitionSource(input.pool, {
        sourceKey: String(input.source.source_key),
        previousState: state,
        nextState: 'awaiting_transcript',
        actorId: input.actorId,
        actorType: 'service',
        reasonCode: 'no_approved_text_track_available',
        correlationId: input.correlationId,
        safeMetadata: { media_key: media.media_key },
        now: input.now,
      }),
    };
  }

  if (state === 'awaiting_transcript' || state === 'transcript_processing') {
    const media = await loadMedia(input.pool, String(input.source.current_media_key ?? ''));
    if (state === 'awaiting_transcript') {
      const status = await input.vimeo.inspectPrivateVideo({
        mediaKey: String(media.media_key),
        sourceKey: String(input.source.source_key),
        providerRefDigest: String(media.provider_ref_digest),
        correlationId: input.correlationId,
      });
      await updateMediaStatus(input.pool, media, status, input.now);
      if (status.textTrackSegments?.length) {
        const transcript = await persistTranscript(input.pool, {
          source: input.source,
          media,
          segments: status.textTrackSegments,
          transcriptSource: 'approved_vimeo_text_track',
          durationMs: status.durationMs ?? null,
          actorId: input.actorId,
          correlationId: input.correlationId,
          now: input.now,
        });
        return {
          action: 'transcript_imported',
          source: await transitionSource(input.pool, {
            sourceKey: String(input.source.source_key),
            previousState: state,
            nextState: 'transcript_ready_unapproved',
            actorId: input.actorId,
            actorType: 'service',
            reasonCode: 'approved_vimeo_text_track_imported',
            correlationId: input.correlationId,
            safeMetadata: {
              media_key: media.media_key,
              transcript_key: transcript.transcript_key,
              transcript_sha256: transcript.transcript_sha256,
            },
            now: input.now,
          }),
        };
      }
    }
    await transitionSource(input.pool, {
      sourceKey: String(input.source.source_key),
      previousState: state,
      nextState: 'transcript_processing',
      actorId: input.actorId,
      actorType: 'service',
      reasonCode: 'transcription_started',
      correlationId: input.correlationId,
      safeMetadata: { media_key: media.media_key },
      now: input.now,
    });
    const transcript = await input.transcription.transcribe({
      sourceKey: String(input.source.source_key),
      mediaKey: String(media.media_key),
      sourceSha256: String(input.source.source_sha256),
      correlationId: input.correlationId,
    });
    const persisted = await persistTranscript(input.pool, {
      source: input.source,
      media,
      segments: transcript.segments,
      transcriptSource: 'provider_transcription',
      durationMs: transcript.durationMs ?? null,
      actorId: input.actorId,
      correlationId: input.correlationId,
      now: input.now,
    });
    return {
      action: 'transcript_created',
      source: await transitionSource(input.pool, {
        sourceKey: String(input.source.source_key),
        previousState: 'transcript_processing',
        nextState: 'transcript_ready_unapproved',
        actorId: input.actorId,
        actorType: 'service',
        reasonCode: 'provider_transcription_completed',
        correlationId: input.correlationId,
        safeMetadata: {
          media_key: media.media_key,
          transcript_key: persisted.transcript_key,
          transcript_sha256: persisted.transcript_sha256,
        },
        now: input.now,
      }),
    };
  }

  return { action: 'noop', source: summarizeSource(input.source) };
}

async function persistMediaReference(
  pool: DbPool,
  input: {
    source: SourceRow;
    reference: Ot109VimeoReference;
    actorId: string;
    correlationId: string;
    now: Date;
  },
): Promise<MediaRow> {
  const providerRefDigest = sha256(input.reference.providerReference);
  const mediaKey = stableOt86Key('ot109_media', [
    String(input.source.source_key),
    providerRefDigest,
  ]);
  return inTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO onetime.ot109_media_refs
         (media_key, source_key, provider_ref_digest, reference_mode, processing_state,
          sanitized_metadata_json, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$7)
       ON CONFLICT (source_key, provider, provider_ref_digest)
       DO UPDATE SET processing_state = EXCLUDED.processing_state,
                     sanitized_metadata_json = EXCLUDED.sanitized_metadata_json,
                     updated_at = EXCLUDED.updated_at`,
      [
        mediaKey,
        input.source.source_key,
        providerRefDigest,
        input.reference.referenceMode,
        input.reference.processingState,
        JSON.stringify(sanitizeMetadata(input.reference.safeMetadata ?? {})),
        input.now,
      ],
    );
    await client.query(
      `UPDATE onetime.ot109_sources
          SET current_media_key = $2,
              updated_at = $3
        WHERE source_key = $1`,
      [input.source.source_key, mediaKey, input.now],
    );
    await recordPublisherEvent(client, {
      sourceKey: String(input.source.source_key),
      actorId: input.actorId,
      actorType: 'service',
      action: 'vimeo_reference_accepted',
      previousState: 'media_intake_processing',
      nextState: mediaStateToSourceState(input.reference.processingState),
      reasonCode: 'private_vimeo_reference_recorded',
      correlationId: input.correlationId,
      safeMetadata: {
        media_key: mediaKey,
        provider_ref_digest: providerRefDigest,
        reference_mode: input.reference.referenceMode,
      },
      now: input.now,
    });
    return loadMedia(client, mediaKey);
  });
}

async function transitionForMediaState(
  pool: DbPool,
  input: {
    sourceKey: string;
    previousState: Ot109PublisherState;
    mediaKey: string;
    processingState: Ot109VimeoProcessingState;
    actorId: string;
    correlationId: string;
    now: Date;
  },
) {
  if (input.processingState === 'failed') {
    return failSource({
      pool,
      sourceKey: input.sourceKey,
      previousState: input.previousState,
      nextState: 'retryable_failure',
      actorId: input.actorId,
      correlationId: input.correlationId,
      reasonCode: 'VIMEO_REFERENCE_FAILED',
      now: input.now,
    });
  }
  return transitionSource(pool, {
    sourceKey: input.sourceKey,
    previousState: input.previousState,
    nextState: mediaStateToSourceState(input.processingState),
    actorId: input.actorId,
    actorType: 'service',
    reasonCode:
      input.processingState === 'ready'
        ? 'private_vimeo_ready_for_transcript'
        : 'private_vimeo_processing',
    correlationId: input.correlationId,
    safeMetadata: { media_key: input.mediaKey },
    now: input.now,
  });
}

async function persistTranscript(
  pool: DbPool,
  input: {
    source: SourceRow;
    media: MediaRow;
    segments: Ot109TranscriptSegment[];
    transcriptSource: 'approved_vimeo_text_track' | 'provider_transcription' | 'manual_transcript';
    durationMs: number | null;
    actorId: string;
    correlationId: string;
    now: Date;
  },
): Promise<TranscriptRow> {
  const segments = normalizeSegments(input.segments);
  const transcriptSha256 = sha256(canonicalJson(segments));
  const transcriptKey = stableOt86Key('ot109_transcript', [
    String(input.source.source_key),
    transcriptSha256,
  ]);
  const durationMs = input.durationMs ?? segments.at(-1)?.end_ms ?? 0;
  return inTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO onetime.ot109_transcripts
         (transcript_key, source_key, media_key, transcript_source, transcript_sha256,
          segment_count, duration_ms, segments_json, approval_state, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,'unapproved',$9)
       ON CONFLICT (source_key, transcript_sha256) DO NOTHING`,
      [
        transcriptKey,
        input.source.source_key,
        input.media.media_key,
        input.transcriptSource,
        transcriptSha256,
        segments.length,
        durationMs,
        JSON.stringify(segments),
        input.now,
      ],
    );
    await client.query(
      `UPDATE onetime.ot109_sources
          SET current_transcript_key = $2,
              updated_at = $3
        WHERE source_key = $1`,
      [input.source.source_key, transcriptKey, input.now],
    );
    await recordPublisherEvent(client, {
      sourceKey: String(input.source.source_key),
      actorId: input.actorId,
      actorType: 'service',
      action: 'transcript_ready_unapproved',
      previousState: 'transcript_processing',
      nextState: 'transcript_ready_unapproved',
      reasonCode: `${input.transcriptSource}_ready`,
      correlationId: input.correlationId,
      safeMetadata: {
        transcript_key: transcriptKey,
        transcript_sha256: transcriptSha256,
        segment_count: segments.length,
      },
      now: input.now,
    });
    return loadTranscript(client, transcriptKey, String(input.source.source_key));
  });
}

async function failSource(input: {
  pool: DbPool;
  sourceKey: string;
  previousState: Ot109PublisherState;
  nextState: 'retryable_failure' | 'blocked' | 'dead_lettered';
  actorId: string;
  correlationId: string;
  reasonCode: string;
  now: Date;
}) {
  return transitionSource(input.pool, {
    sourceKey: input.sourceKey,
    previousState: input.previousState,
    nextState: input.nextState,
    actorId: input.actorId,
    actorType: 'service',
    reasonCode: sanitizeReasonCode(input.reasonCode),
    correlationId: input.correlationId,
    safeMetadata: {},
    now: input.now,
  });
}

async function transitionSource(
  poolOrClient: DbPool | Queryable,
  input: {
    sourceKey: string;
    previousState: Ot109PublisherState;
    nextState: Ot109PublisherState;
    actorId: string;
    actorType: 'operator' | 'service' | 'system';
    reasonCode: string;
    correlationId: string;
    versionKey?: string | null;
    artifactKind?: Ot109ArtifactKind | null;
    safeMetadata: Record<string, unknown>;
    now: Date;
  },
): Promise<Ot109SourceSummary> {
  await poolOrClient.query(
    `UPDATE onetime.ot109_sources
        SET state = $2,
            retry_count = CASE WHEN $2 IN ('retryable_failure','blocked','dead_lettered')
              THEN retry_count + 1
              ELSE retry_count
            END,
            safe_reason_code = CASE WHEN $2 IN ('retryable_failure','blocked','dead_lettered')
              THEN $3
              ELSE NULL
            END,
            updated_at = $4
      WHERE source_key = $1`,
    [input.sourceKey, input.nextState, input.reasonCode, input.now],
  );
  await recordPublisherEvent(poolOrClient, {
    sourceKey: input.sourceKey,
    versionKey: input.versionKey ?? null,
    artifactKind: input.artifactKind ?? null,
    actorId: input.actorId,
    actorType: input.actorType,
    action: `state_${input.previousState}_to_${input.nextState}`,
    previousState: input.previousState,
    nextState: input.nextState,
    reasonCode: input.reasonCode,
    correlationId: input.correlationId,
    safeMetadata: input.safeMetadata,
    now: input.now,
  });
  return summarizeSource(await loadSource(poolOrClient, input.sourceKey));
}

async function recordPublisherEvent(
  client: Queryable,
  input: {
    sourceKey: string;
    versionKey?: string | null;
    artifactKind?: Ot109ArtifactKind | null;
    actorId: string;
    actorType: 'operator' | 'service' | 'system';
    action: string;
    previousState: Ot109PublisherState | null;
    nextState: Ot109PublisherState | null;
    reasonCode: string;
    correlationId: string;
    safeMetadata: Record<string, unknown>;
    now: Date;
  },
) {
  const auditKey = stableOt86Key('ot109_audit', [
    input.sourceKey,
    input.versionKey ?? '',
    input.artifactKind ?? '',
    input.action,
    input.reasonCode,
    input.correlationId,
    input.now.toISOString(),
  ]);
  await client.query(
    `INSERT INTO onetime.ot109_state_events
       (audit_key, source_key, version_key, artifact_kind, actor_id, actor_type, action,
        previous_state, next_state, reason_code, correlation_id, safe_metadata_json, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13)
     ON CONFLICT (audit_key) DO NOTHING`,
    [
      auditKey,
      input.sourceKey,
      input.versionKey ?? null,
      input.artifactKind ?? null,
      input.actorId,
      input.actorType,
      input.action,
      input.previousState,
      input.nextState,
      sanitizeReasonCode(input.reasonCode),
      input.correlationId,
      JSON.stringify(sanitizeMetadata(input.safeMetadata)),
      input.now,
    ],
  );
}

async function updateMediaStatus(
  pool: DbPool,
  media: MediaRow,
  status: Ot109VimeoStatus,
  now: Date,
) {
  await pool.query(
    `UPDATE onetime.ot109_media_refs
        SET processing_state = $2,
            sanitized_metadata_json = $3::jsonb,
            updated_at = $4
      WHERE media_key = $1`,
    [
      media.media_key,
      status.processingState,
      JSON.stringify(sanitizeMetadata(status.safeMetadata ?? {})),
      now,
    ],
  );
}

function buildDerivativeDraft(input: {
  source: SourceRow;
  transcriptKey: string;
  versionKey: string;
  segments: Ot109TranscriptSegment[];
}): Ot109DerivativeDraft {
  const chunks = input.segments.map((segment, index) => {
    const cleaned = sanitizeTranscriptText(segment.text);
    return {
      chunk_id: stableOt86Key('ot109_chunk', [
        input.transcriptKey,
        segment.segment_id,
        String(index),
      ]),
      title: `Class segment ${index + 1}`,
      start_ms: segment.start_ms,
      end_ms: segment.end_ms,
      text: cleaned,
      text_sha256: sha256(cleaned),
    };
  });
  const summary = summarizeSegments(chunks.map((chunk) => chunk.text));
  const concepts = keyConcepts(chunks.map((chunk) => chunk.text));
  const withoutHash = {
    schema_version: 1 as const,
    source_key: String(input.source.source_key),
    transcript_key: input.transcriptKey,
    version_key: input.versionKey,
    lesson_summary: summary,
    searchable_chunks: chunks,
    review_sheet: {
      title: reviewTitle(input.source, summary),
      key_questions: concepts
        .slice(0, 5)
        .map((concept) => `How does the class explain ${concept}?`),
      key_concepts: concepts,
    },
    helper_chunks: chunks.map((chunk) => ({
      chunk_id: chunk.chunk_id,
      answer_seed: chunk.text,
      citation_start_ms: chunk.start_ms,
      citation_end_ms: chunk.end_ms,
      source_sha256: String(input.source.source_sha256),
    })),
    social_proposals: chunks.slice(0, 3).map((chunk) => ({
      proposal_id: stableOt86Key('ot109_social_proposal', [input.versionKey, chunk.chunk_id]),
      caption: `A short Rabbi Scheller class thought: ${clipText(chunk.text, 180)}`,
      clip_start_ms: chunk.start_ms,
      clip_end_ms: chunk.end_ms,
      provenance_chunk_ids: [chunk.chunk_id],
    })),
    classroom_resource_linkage: {
      resource_key: stableOt86Key('ot109_classroom_resource', [input.versionKey]),
      suggested_title: reviewTitle(input.source, summary),
      material_type: 'video_lesson' as const,
    },
    privacy: {
      contains_learner_name: false as const,
      contains_learner_voice: false as const,
      contains_learner_face: false as const,
      contains_learner_question: false as const,
      contains_private_data: false as const,
    },
  };
  return ot109DerivativeDraftSchema.parse({
    ...withoutHash,
    draft_sha256: sha256(canonicalJson(withoutHash)),
  });
}

function buildPublicationPayload(input: {
  artifactKind: Ot109ArtifactKind;
  source: SourceRow;
  media: MediaRow;
  transcript: TranscriptRow;
  version: VersionRow;
  review: ReviewRow;
  draft: Ot109DerivativeDraft;
  canonicalBaseUrl: string;
  now: Date;
}) {
  if (input.artifactKind === 'library') return buildLibraryManifest(input);
  if (input.artifactKind === 'social') return buildSocialEvent(input);
  if (input.artifactKind === 'helper') {
    return {
      schema_version: 1,
      event_type: 'ot109.student_helper_knowledge',
      origin: OT109_ORIGIN,
      scope: OT109_SCOPE,
      source_key: input.draft.source_key,
      version_key: input.draft.version_key,
      transcript_key: input.draft.transcript_key,
      approved_by_actor_id: input.review.decided_by_actor_id,
      approved_at: asIso(input.review.decided_at),
      helper_chunks: input.draft.helper_chunks,
      privacy: input.draft.privacy,
    };
  }
  if (input.artifactKind === 'review_sheet') {
    return {
      schema_version: 1,
      event_type: 'ot109.review_sheet',
      origin: OT109_ORIGIN,
      scope: OT109_SCOPE,
      source_key: input.draft.source_key,
      version_key: input.draft.version_key,
      review_sheet: input.draft.review_sheet,
      approved_by_actor_id: input.review.decided_by_actor_id,
      approved_at: asIso(input.review.decided_at),
      privacy: input.draft.privacy,
    };
  }
  return {
    schema_version: 1,
    event_type: 'ot109.classroom_resource',
    origin: OT109_ORIGIN,
    scope: OT109_SCOPE,
    source_key: input.draft.source_key,
    version_key: input.draft.version_key,
    classroom_resource_linkage: input.draft.classroom_resource_linkage,
    approved_by_actor_id: input.review.decided_by_actor_id,
    approved_at: asIso(input.review.decided_at),
    privacy: input.draft.privacy,
  };
}

function buildLibraryManifest(input: {
  source: SourceRow;
  media: MediaRow;
  transcript: TranscriptRow;
  review: ReviewRow;
  draft: Ot109DerivativeDraft;
  canonicalBaseUrl: string;
  now: Date;
}): Ot86ContentPublishManifest {
  const canonicalPath = `/library/rabbi-classes/${input.draft.source_key}`;
  const privacy = ot86Privacy();
  const manifest = withOt86ManifestChecksum({
    schema_version: 1,
    event_type: 'content.publication_manifest',
    message_id: uuidFromStableParts('ot109-library-message', [
      input.draft.version_key,
      String(input.review.artifact_sha256),
    ]),
    idempotency_key: stableOt86Key('ot109_library_manifest', [
      input.draft.version_key,
      String(input.review.artifact_sha256),
    ]),
    action: 'publish',
    tenant_id: OT109_SCOPE.account_key,
    content_id: input.draft.source_key,
    version_id: input.draft.version_key,
    sequence: 1,
    occurred_at: input.now.toISOString(),
    canonical_path: canonicalPath,
    approval: {
      approval_id: String(input.review.review_key),
      approved_by_actor_id: String(input.review.decided_by_actor_id),
      approved_at: asIso(input.review.decided_at),
      policy_version: OT109_POLICY_VERSION,
    },
    source: {
      source_kind: 'rabbi_class',
      bna_record_id: input.draft.source_key,
      source_sha256: String(input.source.source_sha256),
      vimeo_reference: {
        provider: 'vimeo',
        video_id: String(input.media.media_key),
        reference_mode:
          String(input.media.reference_mode) === 'automated_upload'
            ? 'automated_upload'
            : 'manual_approved_reference',
      },
    },
    artifacts: [
      {
        artifact_id: stableOt86Key('artifact_video', [input.draft.version_key]),
        kind: 'video',
        uri: `${OPAQUE_ASSET_BASE_URL}/${input.draft.source_key}/video`,
        mime_type: 'video/mp4',
        sha256: String(input.source.source_sha256),
        byte_length: nullableNumber(input.source.byte_length) ?? 0,
        privacy,
      },
      {
        artifact_id: stableOt86Key('artifact_transcript', [input.draft.version_key]),
        kind: 'transcript',
        uri: `${OPAQUE_ASSET_BASE_URL}/${input.draft.source_key}/transcript`,
        mime_type: 'application/json',
        sha256: String(input.transcript.transcript_sha256),
        byte_length: 0,
        privacy,
      },
      {
        artifact_id: stableOt86Key('artifact_review', [input.draft.version_key]),
        kind: 'review_material',
        uri: `${OPAQUE_ASSET_BASE_URL}/${input.draft.source_key}/review-sheet`,
        mime_type: 'application/json',
        sha256: sha256(canonicalJson(input.draft.review_sheet)),
        byte_length: 0,
        privacy,
      },
    ],
    sections: input.draft.searchable_chunks.map((chunk, ordinal) => ({
      section_id: chunk.chunk_id,
      title: chunk.title,
      ordinal,
      start_ms: chunk.start_ms,
      end_ms: chunk.end_ms,
      canonical_path: canonicalPath,
      deep_link: `${canonicalPath}#section-${chunk.chunk_id}`,
      text_sha256: chunk.text_sha256,
    })),
    search_documents: input.draft.searchable_chunks.map((chunk) => ({
      document_id: stableOt86Key('ot109_doc', [input.draft.version_key, chunk.chunk_id]),
      section_id: chunk.chunk_id,
      title: chunk.title,
      body: chunk.text,
      token_count: Math.max(1, chunk.text.split(/\s+/).filter(Boolean).length),
      sha256: chunk.text_sha256,
    })),
    privacy,
    checksum_algorithm: 'sha256',
  });
  return manifest;
}

function buildSocialEvent(input: {
  source: SourceRow;
  review: ReviewRow;
  draft: Ot109DerivativeDraft;
  canonicalBaseUrl: string;
  now: Date;
}): Ot86ApprovedForSocialEvent {
  const canonicalUrl = `${input.canonicalBaseUrl.replace(/\/$/, '')}/library/rabbi-classes/${
    input.draft.source_key
  }`;
  const firstProposal = input.draft.social_proposals[0];
  const firstChunk = input.draft.searchable_chunks[0];
  if (!firstChunk) {
    throw new Ot109PublisherError('DRAFT_CHUNKS_EMPTY', 'Approved draft has no searchable chunks.');
  }
  const excerptText = firstProposal?.caption ?? firstChunk?.text ?? input.draft.lesson_summary;
  const withoutHash: Omit<Ot86ApprovedForSocialEvent, 'payload_sha256'> = {
    schema_version: 1,
    event_type: 'content.approved_for_social',
    origin: 'ot86a-content-pipeline',
    event_id: uuidFromStableParts('ot109-social-event', [
      input.draft.version_key,
      String(input.review.artifact_sha256),
    ]),
    idempotency_key: stableOt86Key('ot109_social_event', [
      input.draft.version_key,
      String(input.review.artifact_sha256),
    ]),
    tenant_id: OT109_SCOPE.account_key,
    content_id: input.draft.source_key,
    version_id: input.draft.version_key,
    sequence: 1,
    occurred_at: input.now.toISOString(),
    approval: {
      approval_id: String(input.review.review_key),
      approved_for_social: true,
      approved_by_actor_id: String(input.review.decided_by_actor_id),
      approved_at: asIso(input.review.decided_at),
      policy_version: OT109_POLICY_VERSION,
    },
    content: {
      canonical_title: input.draft.review_sheet.title,
      canonical_url: canonicalUrl,
      summary: input.draft.lesson_summary,
      approved_excerpts: [
        {
          excerpt_id: stableOt86Key('ot109_excerpt', [input.draft.version_key]),
          section_id: firstChunk.chunk_id,
          text: excerptText,
          deep_link: `${canonicalUrl}#section-${firstChunk.chunk_id}`,
          text_sha256: sha256(excerptText),
        },
      ],
      media: [],
    },
    privacy: ot86SocialPrivacy(),
  };
  return ot86ApprovedForSocialEventSchema.parse({
    ...withoutHash,
    payload_sha256: sha256(canonicalJson(withoutHash)),
  });
}

function helperChunksFromPublication(row: Record<string, unknown>) {
  const payload = asRecord(row.payload_json);
  const chunks = Array.isArray(payload.helper_chunks)
    ? (payload.helper_chunks as Array<Record<string, unknown>>)
    : [];
  return chunks.map((chunk) => ({
    source_key: String(row.source_key),
    version_key: String(row.version_key),
    chunk_id: String(chunk.chunk_id),
    answer_seed: String(chunk.answer_seed ?? ''),
    citation_start_ms: Number(chunk.citation_start_ms ?? 0),
    citation_end_ms: Number(chunk.citation_end_ms ?? 0),
    source_sha256: String(chunk.source_sha256 ?? sha256('missing-source')),
  }));
}

function artifactDigest(draft: Ot109DerivativeDraft, artifactKind: Ot109ArtifactKind) {
  if (artifactKind === 'library') {
    return sha256(
      canonicalJson({
        chunks: draft.searchable_chunks,
        summary: draft.lesson_summary,
        review_sheet: draft.review_sheet,
      }),
    );
  }
  if (artifactKind === 'helper') return sha256(canonicalJson(draft.helper_chunks));
  if (artifactKind === 'social') return sha256(canonicalJson(draft.social_proposals));
  if (artifactKind === 'review_sheet') return sha256(canonicalJson(draft.review_sheet));
  return sha256(canonicalJson(draft.classroom_resource_linkage));
}

function channelForArtifact(artifactKind: Ot109ArtifactKind) {
  if (artifactKind === 'helper') return 'student_helper_knowledge';
  if (artifactKind === 'social') return 'social_manifest';
  if (artifactKind === 'classroom_resource') return 'classroom_resource';
  return 'one_time_library';
}

function nextStateForArtifactDecision(
  artifactKind: Ot109ArtifactKind,
  decision: Ot109ReviewDecision,
): Ot109PublisherState {
  if (decision !== 'approved') return 'human_review_required';
  if (artifactKind === 'helper') return 'approved_for_helper';
  if (artifactKind === 'social') return 'approved_for_social';
  return 'approved_for_library';
}

async function loadSource(client: Queryable, sourceKey: string): Promise<SourceRow> {
  const result = await client.query(
    `SELECT *
       FROM onetime.ot109_sources
      WHERE source_key = $1
      LIMIT 1`,
    [sourceKey],
  );
  if (!result.rowCount) {
    throw new Ot109PublisherError('SOURCE_NOT_FOUND', 'Publisher source was not found.', 404);
  }
  return result.rows[0] as SourceRow;
}

async function loadMedia(client: Queryable, mediaKey: string): Promise<MediaRow> {
  const result = await client.query(
    `SELECT *
       FROM onetime.ot109_media_refs
      WHERE media_key = $1
      LIMIT 1`,
    [mediaKey],
  );
  if (!result.rowCount) {
    throw new Ot109PublisherError(
      'MEDIA_NOT_FOUND',
      'Publisher media reference was not found.',
      404,
    );
  }
  return result.rows[0] as MediaRow;
}

async function loadTranscript(
  client: Queryable,
  transcriptKey: string,
  sourceKey: string,
): Promise<TranscriptRow> {
  const result = await client.query(
    `SELECT *
       FROM onetime.ot109_transcripts
      WHERE transcript_key = $1
        AND source_key = $2
      LIMIT 1`,
    [transcriptKey, sourceKey],
  );
  if (!result.rowCount) {
    throw new Ot109PublisherError(
      'TRANSCRIPT_NOT_FOUND',
      'Publisher transcript was not found.',
      404,
    );
  }
  return result.rows[0] as TranscriptRow;
}

async function loadVersion(client: Queryable, versionKey: string): Promise<VersionRow> {
  const result = await client.query(
    `SELECT *
       FROM onetime.ot109_derivative_versions
      WHERE version_key = $1
      LIMIT 1`,
    [versionKey],
  );
  if (!result.rowCount) {
    throw new Ot109PublisherError(
      'VERSION_NOT_FOUND',
      'Publisher derivative version was not found.',
      404,
    );
  }
  return result.rows[0] as VersionRow;
}

async function nextRevisionNumber(client: Queryable, sourceKey: string) {
  const result = await client.query(
    `SELECT COALESCE(MAX(revision_number), 0) + 1 AS next_revision
       FROM onetime.ot109_derivative_versions
      WHERE source_key = $1`,
    [sourceKey],
  );
  return Number(result.rows[0]?.next_revision ?? 1);
}

function summarizeSource(row: SourceRow): Ot109SourceSummary {
  return ot109SourceSummarySchema.parse({
    source_key: String(row.source_key),
    state: row.state,
    source_kind: row.source_kind,
    source_sha256: row.source_sha256,
    current_transcript_key: nullableString(row.current_transcript_key),
    current_version_key: nullableString(row.current_version_key),
    safe_reason_code: nullableString(row.safe_reason_code),
    retry_count: Number(row.retry_count ?? 0),
    created_at: asIso(row.created_at),
    updated_at: asIso(row.updated_at),
  });
}

function normalizeSegments(segments: Ot109TranscriptSegment[]) {
  return segments
    .map((segment, index) =>
      ot109TranscriptSegmentSchema.parse({
        ...segment,
        segment_id: segment.segment_id || `segment_${index + 1}`,
        text: sanitizeTranscriptText(segment.text),
        speaker: segment.speaker ? sanitizeSpeaker(segment.speaker) : null,
      }),
    )
    .sort((left, right) => left.start_ms - right.start_ms);
}

function parseSegments(value: unknown): Ot109TranscriptSegment[] {
  const raw = Array.isArray(value) ? value : (JSON.parse(String(value)) as unknown);
  if (!Array.isArray(raw)) {
    throw new Ot109PublisherError(
      'BAD_TRANSCRIPT_SEGMENTS',
      'Transcript segment storage is malformed.',
    );
  }
  return raw.map((segment) => ot109TranscriptSegmentSchema.parse(segment));
}

function parseState(value: unknown): Ot109PublisherState {
  const state = String(value);
  if (
    [
      'source_registered',
      'awaiting_media_intake',
      'media_intake_processing',
      'vimeo_reference_accepted',
      'transcoding',
      'awaiting_transcript',
      'transcript_processing',
      'transcript_ready_unapproved',
      'derivatives_generated',
      'human_review_required',
      'approved_for_library',
      'approved_for_helper',
      'approved_for_social',
      'published',
      'retryable_failure',
      'blocked',
      'dead_lettered',
    ].includes(state)
  ) {
    return state as Ot109PublisherState;
  }
  throw new Ot109PublisherError('BAD_STATE', 'Publisher state is malformed.');
}

function mediaStateToSourceState(processingState: Ot109VimeoProcessingState): Ot109PublisherState {
  if (processingState === 'ready') return 'awaiting_transcript';
  if (processingState === 'transcoding') return 'transcoding';
  if (processingState === 'failed') return 'retryable_failure';
  return 'vimeo_reference_accepted';
}

function assertAllowedSourceReference(source: Ot109RegisterSourceInput) {
  if (/^https?:\/\//i.test(source.source_reference)) {
    throw new Ot109PublisherError(
      'PUBLIC_URL_SOURCE_REJECTED',
      'Source references must be uploaded files, protected Drive references, or private Vimeo references.',
      400,
    );
  }
}

function sanitizeTranscriptText(text: string) {
  return text
    .trim()
    .replaceAll(/<script[\s\S]*?<\/script>/gi, '[removed script]')
    .replaceAll(
      /\b(ignore|disregard)\s+(all\s+)?(prior|previous)\s+(rules|instructions)\b/gi,
      '[quoted source instruction removed]',
    )
    .replaceAll(
      /\b(disclose|reveal|print)\s+(secrets?|tokens?|passwords?)\b/gi,
      '[quoted secret request removed]',
    )
    .slice(0, 8000);
}

function sanitizeSpeaker(value: string) {
  return (
    value
      .replaceAll(/[^\w .:-]/g, '')
      .trim()
      .slice(0, 120) || null
  );
}

function sanitizeMetadata(value: unknown): unknown {
  if (value === null || value === undefined) return {};
  if (typeof value === 'string') return sanitizeMetadataString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((entry) => sanitizeMetadata(entry));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 50)
        .map(([key, entry]) => [key.slice(0, 80), sanitizeMetadata(entry)]),
    );
  }
  return {};
}

function sanitizeMetadataString(value: string) {
  return value
    .replaceAll(/https?:\/\/[^\s"']+/gi, '[redacted-url]')
    .replaceAll(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted-token]')
    .replaceAll(/[A-Za-z0-9_-]{32,}/g, '[redacted-token]')
    .slice(0, 240);
}

function sanitizeReasonCode(value: string) {
  return value.replaceAll(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 80) || 'unspecified';
}

function sanitizeNote(value: string | null | undefined) {
  if (!value) return null;
  return sanitizeMetadataString(value).slice(0, 500);
}

function summarizeSegments(texts: string[]) {
  const joined = texts.join(' ');
  return clipText(joined, 600) || 'Approved Rabbi class material.';
}

function keyConcepts(texts: string[]) {
  const words = texts
    .join(' ')
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 4 && !STOP_WORDS.has(word));
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  const concepts = [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([word]) => word)
    .slice(0, 8);
  return concepts.length ? concepts : ['lesson', 'review', 'practice'];
}

function reviewTitle(source: SourceRow, summary: string) {
  const originalName = nullableString(source.original_name);
  if (originalName) return clipText(originalName.replace(/\.[A-Za-z0-9]+$/, ''), 120);
  return `Rabbi Scheller class: ${clipText(summary, 80)}`;
}

function clipText(value: string, maxLength: number) {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxLength - 1)).trim()}.`;
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
    .slice(0, 20);
}

function scoreText(value: string, terms: string[]) {
  const haystack = value.toLowerCase();
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

function safeAnswer(value: string) {
  return (
    clipText(sanitizeTranscriptText(value), 2400) || 'Approved Rabbi class material supports this.'
  );
}

function ot86Privacy() {
  return {
    source_scope: 'approved_rabbi_content' as const,
    contains_learner_name: false as const,
    contains_learner_voice: false as const,
    contains_learner_face: false as const,
    contains_learner_question: false as const,
    contains_private_data: false as const,
    approved_for_student_kb: true as const,
  };
}

function ot86SocialPrivacy() {
  return {
    contains_learner_name: false as const,
    contains_learner_voice: false as const,
    contains_learner_face: false as const,
    contains_learner_question: false as const,
    contains_private_data: false as const,
  };
}

function uuidFromStableParts(prefix: string, parts: string[]) {
  const hex = sha256([prefix, ...parts].join('\0'));
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(
    17,
    20,
  )}-${hex.slice(20, 32)}`;
}

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }
  return {};
}

function asIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return new Date(0).toISOString();
  return date.toISOString();
}

function nullableString(value: unknown) {
  if (value === null || value === undefined) return null;
  return String(value);
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

type SourceRow = Record<string, unknown> & {
  source_key: string;
  source_kind: string;
  state: string;
  source_sha256: string;
  source_ref_digest: string;
  retry_count: number;
  created_at: Date | string;
  updated_at: Date | string;
};

type MediaRow = Record<string, unknown> & {
  media_key: string;
  source_key: string;
  provider_ref_digest: string;
  reference_mode: string;
  processing_state: string;
};

type TranscriptRow = Record<string, unknown> & {
  transcript_key: string;
  source_key: string;
  transcript_sha256: string;
  approval_state: string;
  segments_json: unknown;
};

type VersionRow = Record<string, unknown> & {
  version_key: string;
  source_key: string;
  transcript_key: string;
  draft_json: unknown;
};

type ReviewRow = Record<string, unknown> & {
  review_key: string;
  version_key: string;
  artifact_kind: string;
  artifact_sha256: string;
  decided_by_actor_id: string;
  decided_at: Date | string;
};

type PublicationRow = Record<string, unknown> & {
  source_key: string;
  version_key: string;
  artifact_kind: string;
};

const STOP_WORDS = new Set([
  'about',
  'after',
  'again',
  'because',
  'before',
  'class',
  'every',
  'from',
  'have',
  'lesson',
  'material',
  'rabbi',
  'review',
  'that',
  'their',
  'there',
  'this',
  'with',
  'would',
]);
