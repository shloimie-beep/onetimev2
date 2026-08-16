import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { ContentApprovalEvidence } from '../../../packages/contracts/src/content/publication/index.ts';
import { runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import { createReviewReadyContentFromProjection } from '../../../packages/domain/src/content/publication/lifecycle.ts';
import {
  createPostgresParentWelcomeBindingRepository,
  parentWelcomeAuthorizationBindingSha256,
  runParentWelcomeVideoBinding,
  type ParentWelcomeMediaProbe,
  type ParentWelcomeObjectInspection,
  type ParentWelcomeObjectStore,
} from '../../../scripts/operations/parent-welcome-video-binding.ts';

const nativeDatabaseUrl = process.env.PARENT_WELCOME_NATIVE_DATABASE_URL;
const nativeProofEnabled =
  process.env.PARENT_WELCOME_NATIVE_POSTGRES_DISPOSABLE === 'true' && Boolean(nativeDatabaseUrl);

const ACCOUNT_KEY = 'native_parent_welcome_digest';
const PRODUCT_KEY = 'one_time_mishnayos' as const;
const ADMIN_ID = 'native_parent_welcome_admin';
const NATIVE_NOW = new Date('2026-08-16T09:30:00.000Z');
const ARTIFACT_KINDS = [
  'captions',
  'compressed_video',
  'knowledge_artifact',
  'review_material',
  'transcript',
  'trim',
  'worksheet',
] as const;

describe.runIf(nativeProofEnabled)('Parent welcome native PostgreSQL projection digest', () => {
  let pool: DbPool | undefined;
  let ownsSchema = false;
  let privateRoot: string | undefined;

  beforeAll(async () => {
    assertDisposableLoopback(nativeDatabaseUrl!);
    pool = new pg.Pool({ connectionString: nativeDatabaseUrl!, max: 2 });
    const database = await pool.query(
      `SELECT current_database() AS database_name,
              current_setting('server_version_num') AS server_version_num`,
    );
    expect(database.rows[0]?.database_name).toBe(new URL(nativeDatabaseUrl!).pathname.slice(1));
    expect(Number(database.rows[0]?.server_version_num)).toBeGreaterThanOrEqual(160_000);
    const tables = await pool.query(
      `SELECT count(*)::integer AS table_count
         FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')`,
    );
    expect(tables.rows[0]).toEqual({ table_count: 0 });
    ownsSchema = true;
    const first = await runMigrations(pool);
    const replay = await runMigrations(pool);
    expect(
      first.find(({ id }) => id === '2287_existing_reviewed_content_source_capture_method')?.status,
    ).toBe('applied');
    expect(
      replay.find(({ id }) => id === '2287_existing_reviewed_content_source_capture_method')
        ?.status,
    ).toBe('already_applied');
  }, 120_000);

  afterAll(async () => {
    if (privateRoot) await rm(privateRoot, { recursive: true, force: true });
    if (!pool) return;
    if (ownsSchema) await pool.query('DROP SCHEMA IF EXISTS onetime CASCADE');
    await pool.end();
  }, 30_000);

  it('matches the exact domain digest after JSONB normalizes nontrivial key order', async () => {
    const canonicalArtifacts = publicationArtifacts('existing');
    const core = {
      accountKey: ACCOUNT_KEY,
      productKey: PRODUCT_KEY,
      contentId: 'native_parent_welcome_content',
      contentVersionId: 'native_parent_welcome_version',
      contentVersionDigest: digest('existing-content-version'),
      sourceId: 'native_parent_welcome_source',
      sourceSha256: digest('existing-source'),
      sourceObjectVersionId: 'native-source-object-version',
      reviewKind: 'existing_reviewed_recording' as const,
      reviewedSourceDigest: digest('existing-reviewed-source'),
      reviewedByAdminId: ADMIN_ID,
      reviewedAt: '2026-08-16T09:30:00.000Z',
      approvalEvidenceDigest: digest('existing-approval-evidence'),
      title: 'Parents’ “Welcome”',
      englishTranscriptText: 'First approved line.\nSecond approved line.',
      classTopic: 'Parent orientation',
      mishnahReferences: ['Berachos 2:1', 'Pe’ah 1:1'],
      occurredAt: '2026-08-16T09:00:00.000Z',
      durationMs: 90_000,
      approvedByAdminId: ADMIN_ID,
      approvedAt: '2026-08-16T10:00:00.000Z',
      artifacts: canonicalArtifacts,
      approvedArtifactSetDigest: digest('existing-artifact-set'),
      sourceEvidenceDigest: digest('existing-source-evidence'),
    };
    const domainDigest = digest(JSON.stringify(core));
    const evidence: ContentApprovalEvidence = { ...core, projectionDigest: domainDigest };
    expect(() =>
      createReviewReadyContentFromProjection({
        principal: {
          actorId: ADMIN_ID,
          role: 'admin',
          accountKey: ACCOUNT_KEY,
          productKey: PRODUCT_KEY,
          householdId: 'native_parent_welcome_household',
          studentId: null,
          sessionId: null,
          sessionVersion: null,
          accessState: 'active',
        },
        evidence,
      }),
    ).not.toThrow();

    const shuffledArtifacts = canonicalArtifacts.map((artifact) => ({
      schemaVersion: artifact.schemaVersion,
      artifactId: artifact.artifactId,
      promptVersion: artifact.promptVersion,
      kind: artifact.kind,
      revision: artifact.revision,
      operationVersion: artifact.operationVersion,
      payloadDigest: artifact.payloadDigest,
      model: artifact.model,
    }));
    const shuffledJsonbInput = {
      sourceEvidenceDigest: core.sourceEvidenceDigest,
      artifacts: shuffledArtifacts,
      approvedAt: core.approvedAt,
      approvedByAdminId: core.approvedByAdminId,
      durationMs: core.durationMs,
      occurredAt: core.occurredAt,
      mishnahReferences: core.mishnahReferences,
      classTopic: core.classTopic,
      englishTranscriptText: core.englishTranscriptText,
      title: core.title,
      approvalEvidenceDigest: core.approvalEvidenceDigest,
      reviewedAt: core.reviewedAt,
      reviewedByAdminId: core.reviewedByAdminId,
      reviewedSourceDigest: core.reviewedSourceDigest,
      reviewKind: core.reviewKind,
      sourceObjectVersionId: core.sourceObjectVersionId,
      sourceSha256: core.sourceSha256,
      sourceId: core.sourceId,
      contentVersionDigest: core.contentVersionDigest,
      contentVersionId: core.contentVersionId,
      contentId: core.contentId,
      productKey: core.productKey,
      accountKey: core.accountKey,
      approvedArtifactSetDigest: core.approvedArtifactSetDigest,
      projectionDigest: domainDigest,
    };
    const native = await pool!.query<{ digest: string; normalized_artifact: string }>(
      `SELECT onetime.approved_publication_projection_digest($1::jsonb) AS digest,
              ($1::jsonb -> 'artifacts' -> 0)::text AS normalized_artifact`,
      [JSON.stringify(shuffledJsonbInput)],
    );

    expect(native.rows[0]?.normalized_artifact).not.toBe(JSON.stringify(shuffledArtifacts[0]));
    expect(native.rows[0]?.digest).toBe(domainDigest);
  });

  it('delegates the OBS projection to the preserved function without digest drift', async () => {
    const obsCore = {
      accountKey: ACCOUNT_KEY,
      productKey: PRODUCT_KEY,
      contentId: 'native_obs_content',
      contentVersionId: 'native_obs_version',
      contentVersionDigest: digest('obs-content-version'),
      sourceId: 'native_obs_source',
      sourceSha256: digest('obs-source'),
      sourceObjectVersionId: 'native-obs-object-version',
      participantSetVersion: digest('obs-participant-set'),
      participantSnapshotDigest: digest('obs-participant-snapshot'),
      participantReviewState: 'complete',
      unresolvedParticipantCount: 0,
      requiredRedactionCount: 1,
      completedRedactionCount: 1,
      redactionReviewDigest: digest('obs-redaction-review'),
      title: 'Native OBS title',
      englishTranscriptText: 'Native OBS transcript.',
      classTopic: 'Native OBS topic',
      mishnahReferences: ['Berachos 1:1', 'Berachos 1:2'],
      occurredAt: '2026-08-16T08:00:00.000Z',
      durationMs: 90_000,
      approvedByAdminId: ADMIN_ID,
      approvedAt: '2026-08-16T10:00:00.000Z',
      artifacts: publicationArtifacts('obs'),
      approvedArtifactSetDigest: digest('obs-artifact-set'),
      sourceEvidenceDigest: digest('obs-source-evidence'),
    };
    const expectedDomainDigest = digest(JSON.stringify(obsCore));
    const native = await pool!.query<{ wrapper: string; preserved: string }>(
      `SELECT onetime.approved_publication_projection_digest($1::jsonb) AS wrapper,
              onetime.approved_publication_projection_digest_obs($1::jsonb) AS preserved`,
      [JSON.stringify(obsCore)],
    );

    expect(native.rows[0]).toEqual({
      wrapper: expectedDomainDigest,
      preserved: expectedDomainDigest,
    });
  });

  it('atomically consumes one synthetic authorization across concurrent manifests', async () => {
    const phraseDigest = digest('native-one-use-phrase');
    const attempts = [
      {
        operationId: `pwb_${'1'.repeat(32)}`,
        manifestDigest: digest('native-manifest-one'),
        bindingDigest: digest('native-binding-one'),
      },
      {
        operationId: `pwb_${'2'.repeat(32)}`,
        manifestDigest: digest('native-manifest-two'),
        bindingDigest: digest('native-binding-two'),
      },
    ];
    const results = await Promise.all(
      attempts.map((attempt) =>
        pool!.query(
          `INSERT INTO onetime.parent_welcome_binding_authorizations_v21 (
             authorization_phrase_sha256, operation_id, manifest_digest,
             authorization_binding_sha256, account_key, product_key, runtime_tier,
             verification_environment_id, consumed_at
           ) VALUES ($1,$2,$3,$4,$5,$6,'production',$7,$8::timestamptz)
           ON CONFLICT DO NOTHING RETURNING operation_id`,
          [
            phraseDigest,
            attempt.operationId,
            attempt.manifestDigest,
            attempt.bindingDigest,
            ACCOUNT_KEY,
            PRODUCT_KEY,
            'native-parent-welcome-environment',
            '2026-08-16T10:00:00.000Z',
          ],
        ),
      ),
    );

    expect(results.map(({ rows }) => rows.length).sort()).toEqual([0, 1]);
    const stored = await pool!.query(
      `SELECT operation_id, manifest_digest
         FROM onetime.parent_welcome_binding_authorizations_v21
        WHERE authorization_phrase_sha256=$1`,
      [phraseDigest],
    );
    expect(stored.rows).toHaveLength(1);
    await expect(
      pool!.query(
        `UPDATE onetime.parent_welcome_binding_authorizations_v21
            SET manifest_digest=$2
          WHERE authorization_phrase_sha256=$1`,
        [phraseDigest, digest('forbidden-native-rewrite')],
      ),
    ).rejects.toThrow(/append-only/u);
  });

  it('executes the real repository apply and exact replay readback against native PostgreSQL', async () => {
    const source = Buffer.from('native synthetic approved source');
    const media = Buffer.from('native synthetic protected derivative');
    const captions = Buffer.from(
      'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nSynthetic Parent welcome.\n',
    );
    const poster = Buffer.from('native synthetic protected poster');
    privateRoot = await mkdtemp(path.join(tmpdir(), 'ot-parent-welcome-native-'));
    await Promise.all([
      writeFile(path.join(privateRoot, 'source.mp4'), source, { mode: 0o600 }),
      writeFile(path.join(privateRoot, 'approved.mp4'), media, { mode: 0o600 }),
      writeFile(path.join(privateRoot, 'approved.vtt'), captions, { mode: 0o600 }),
      writeFile(path.join(privateRoot, 'approved.jpg'), poster, { mode: 0o600 }),
    ]);
    const authorization = 'native synthetic repository authorization';
    const manifest = {
      schema_version: 'onetime.parent_welcome.binding.private.v1',
      operation_id: `pwb_${'3'.repeat(32)}`,
      expires_at: '2026-08-16T09:40:00.000Z',
      expected_runtime_source_sha: 'b'.repeat(40),
      authorization_phrase_sha256: digest(authorization),
      authorization_binding_sha256: '0'.repeat(64),
      scope: {
        account_key: ACCOUNT_KEY,
        product_key: PRODUCT_KEY,
        runtime_tier: 'production' as const,
        verification_environment_id: 'native-parent-welcome-environment',
      },
      storage: {
        region: 'eu-central-1' as const,
        bucket_ref: 'native-parent-welcome-private',
        kms_key_arn: 'arn:aws:kms:eu-central-1:111122223333:key/native-synthetic-key',
        storage_class: 'STANDARD' as const,
      },
      drive_source: {
        file_identity: 'native-synthetic-drive-file',
        revision_identity: 'native-synthetic-drive-revision',
        private_source_relative_path: 'source.mp4',
        sha256: digest(source),
        byte_count: source.byteLength,
        media: {
          content_type: 'video/mp4' as const,
          container: 'mp4' as const,
          duration_ms: 90_000,
          width: 832,
          height: 464,
          frames_per_second: 30,
          video_codec: 'h264' as const,
          pixel_format: 'yuv420p' as const,
          rotation_degrees: 0 as const,
          sample_aspect_ratio: '1:1' as const,
          audio_codec: 'aac' as const,
          audio_profile: 'LC' as const,
          audio_sample_rate_hz: 44_100 as const,
          audio_channels: 2 as const,
        },
      },
      review: {
        approved_by_admin_id: ADMIN_ID,
        rights_attested_at: '2026-08-16T09:00:00.000Z',
        human_reviewed_at: '2026-08-16T09:05:00.000Z',
        approved_at: '2026-08-16T09:10:00.000Z',
        publication_requested_at: '2026-08-16T09:15:00.000Z',
        child_data_disposition: 'redactions_complete' as const,
      },
      presentation: {
        title: 'Native synthetic Parent welcome',
        class_topic: 'Parent orientation',
      },
      private_asset_root: privateRoot,
      assets: {
        media: {
          relative_path: 'approved.mp4',
          sha256: digest(media),
          byte_count: media.byteLength,
          content_type: 'video/mp4' as const,
          duration_ms: 90_000,
          width: 832,
          height: 468,
          frames_per_second: 30,
          audio_sample_rate_hz: 44_100 as const,
        },
        captions: {
          relative_path: 'approved.vtt',
          sha256: digest(captions),
          byte_count: captions.byteLength,
          content_type: 'text/vtt' as const,
        },
        poster: {
          relative_path: 'approved.jpg',
          sha256: digest(poster),
          byte_count: poster.byteLength,
          content_type: 'image/jpeg' as const,
          width: 832,
          height: 468,
        },
      },
    };
    manifest.authorization_binding_sha256 = parentWelcomeAuthorizationBindingSha256(
      manifest,
      authorization,
    );
    const objectStore = new NativeMemoryObjectStore();
    const mediaProbe = nativeMediaProbe();
    const resultSink = {
      reserve: async () => undefined,
      finalize: async () => undefined,
    };
    const repository = createPostgresParentWelcomeBindingRepository(pool!);
    const input = {
      manifest,
      apply: true,
      authorizationPhrase: authorization,
      runtime: {
        commitSha: manifest.expected_runtime_source_sha,
        accountKey: manifest.scope.account_key,
        productKey: manifest.scope.product_key,
        runtimeTier: manifest.scope.runtime_tier,
        verificationEnvironmentId: manifest.scope.verification_environment_id,
        writesAllowed: true,
        region: manifest.storage.region,
        bucketRef: manifest.storage.bucket_ref,
        kmsKeyArn: manifest.storage.kms_key_arn,
        storageClass: manifest.storage.storage_class,
      },
      objectStore,
      repository,
      mediaProbe,
      resultSink,
    };

    const first = await runParentWelcomeVideoBinding({ ...input, now: NATIVE_NOW });
    const replay = await runParentWelcomeVideoBinding({
      ...input,
      now: new Date('2026-08-16T09:31:00.000Z'),
    });

    expect(first.status).toBe('applied');
    expect(replay.status).toBe('already_applied');
    expect(objectStore.putCalls).toBe(3);
    expect(objectStore.deleteCalls).toBe(0);
    const inventory = await pool!.query(
      `SELECT
         (SELECT count(*)::integer FROM onetime.content_sources_v21
           WHERE account_key=$1) AS source_count,
         (SELECT count(*)::integer FROM onetime.content_drive_observations
           WHERE account_key=$1 AND drive_state='processed') AS observation_count,
         (SELECT count(*)::integer FROM onetime.parent_welcome_video_slots_v21
           WHERE account_key=$1 AND state='approved') AS slot_count,
         (SELECT count(*)::integer FROM onetime.parent_welcome_video_assets_v21
           WHERE account_key=$1 AND state='approved') AS asset_count,
         (SELECT count(*)::integer
            FROM onetime.parent_welcome_binding_operation_results_v21 AS result
            JOIN onetime.parent_welcome_binding_authorizations_v21 AS binding_auth
              ON binding_auth.operation_id=result.operation_id
           WHERE binding_auth.account_key=$1) AS result_count`,
      [ACCOUNT_KEY],
    );
    expect(inventory.rows[0]).toEqual({
      source_count: 1,
      observation_count: 1,
      slot_count: 1,
      asset_count: 3,
      result_count: 1,
    });
  });
});

class NativeMemoryObjectStore implements ParentWelcomeObjectStore {
  putCalls = 0;
  deleteCalls = 0;
  private readonly objects = new Map<
    string,
    { versionId: string; sha256: string; byteCount: number; contentType: string }
  >();

  async assertPrivateVersionedPolicy() {}

  async inspect(input: {
    objectKey: string;
    sha256: string;
    byteCount: number;
    contentType: string;
  }): Promise<ParentWelcomeObjectInspection> {
    const stored = this.objects.get(input.objectKey);
    if (!stored) return { state: 'absent' };
    return stored.sha256 === input.sha256 &&
      stored.byteCount === input.byteCount &&
      stored.contentType === input.contentType
      ? { state: 'exact', versionId: stored.versionId }
      : { state: 'mismatch', versionId: stored.versionId };
  }

  async putOnce(input: {
    objectKey: string;
    sha256: string;
    byteCount: number;
    contentType: string;
  }) {
    this.putCalls += 1;
    const versionId = `native-synthetic-version-${this.putCalls}`;
    this.objects.set(input.objectKey, {
      versionId,
      sha256: input.sha256,
      byteCount: input.byteCount,
      contentType: input.contentType,
    });
    return { versionId };
  }

  async deleteExactVersion(input: { objectKey: string; versionId: string }) {
    this.deleteCalls += 1;
    if (this.objects.get(input.objectKey)?.versionId !== input.versionId) {
      throw new Error('native synthetic object version mismatch');
    }
    this.objects.delete(input.objectKey);
  }
}

function nativeMediaProbe(): ParentWelcomeMediaProbe {
  return {
    inspectMedia: async (filePath) => ({
      container: 'mp4',
      videoStreamCount: 1,
      audioStreamCount: 1,
      width: 832,
      height: path.basename(filePath) === 'source.mp4' ? 464 : 468,
      rotationDegrees: 0,
      sampleAspectRatio: '1:1',
      durationMs: 90_000,
      framesPerSecond: 30,
      videoCodec: 'h264',
      pixelFormat: 'yuv420p',
      audioCodec: 'aac',
      audioProfile: 'LC',
      audioSampleRateHz: 44_100,
      audioChannels: 2,
      decoded: true,
      privacyMetadataRemoved: path.basename(filePath) !== 'source.mp4',
    }),
    inspectPoster: async () => ({
      format: 'jpeg',
      width: 832,
      height: 468,
      decoded: true,
      privacyMetadataRemoved: true,
    }),
  };
}

function publicationArtifacts(lane: 'existing' | 'obs') {
  return ARTIFACT_KINDS.map((kind, index) => ({
    artifactId: `native_${lane}_artifact_${kind}`,
    kind,
    revision: index + 1,
    payloadDigest: digest(`${lane}-${kind}-payload`),
    model: index % 2 === 0 ? null : `native-${lane}-model`,
    operationVersion: `native-${lane}-operation-v1`,
    promptVersion: index % 3 === 0 ? null : `native-${lane}-prompt-v1`,
    schemaVersion: index % 2 === 0 ? `native-${lane}-schema-v1` : null,
  }));
}

function digest(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

function assertDisposableLoopback(value: string) {
  const url = new URL(value);
  if (
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    !/^onetime_parent_welcome_digest_/u.test(url.pathname.slice(1))
  ) {
    throw new Error(
      'PARENT_WELCOME_NATIVE_DATABASE_URL must be an onetime_parent_welcome_digest_* loopback database',
    );
  }
}
