import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { lstat, open, readFile, realpath, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  DeleteObjectCommand,
  GetBucketEncryptionCommand,
  GetBucketLocationCommand,
  GetBucketOwnershipControlsCommand,
  GetBucketVersioningCommand,
  GetObjectCommand,
  GetPublicAccessBlockCommand,
  HeadObjectCommand,
  ListObjectVersionsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { z } from 'zod';
import sharp, { type Metadata } from 'sharp';
import { loadConfig } from '../../packages/config/src/index.ts';
import { createPgPool, type DbPool } from '../../packages/db/src/index.ts';
import {
  CONTENT_VERSION_DIGEST_VERSION,
  OT_VIDEO_1_PROFILE,
  type ProcessingArtifact,
} from '../../packages/contracts/src/content/processing/index.ts';
import type {
  ContentApprovalEvidence,
  ContentPublicationRecord,
} from '../../packages/contracts/src/content/publication/index.ts';
import {
  approveContent,
  createReviewReadyContentFromProjection,
} from '../../packages/domain/src/content/publication/lifecycle.ts';

const PRODUCT_KEY = 'one_time_mishnayos' as const;
const OPERATION_SCHEMA = 'onetime.parent_welcome.binding.private.v1' as const;
const REPORT_SCHEMA = 'onetime.parent_welcome.binding.result.v1' as const;
const AUTHORIZATION_ENV = 'PARENT_WELCOME_BIND_AUTHORIZATION';
const OPERATION_LOCK_ID = 2287000;
const COMMAND_LOCK_ID = 2287001;
const SHA256 = /^[0-9a-f]{64}$/u;
const RUNTIME_SHA = /^[0-9a-f]{40}$/u;
const OPERATION_ID = /^pwb_[0-9a-f]{32}$/u;
const MAX_AUTHORIZATION_WINDOW_MS = 30 * 60 * 1000;
const MAX_CAPTIONS_BYTES = 5 * 1024 * 1024;
const APPROVED_SOURCE_WIDTH = 832;
const APPROVED_SOURCE_HEIGHT = 464;
const APPROVED_DERIVATIVE_WIDTH = 832;
const APPROVED_DERIVATIVE_HEIGHT = 468;
const OPAQUE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,179}$/u;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

const sha256Schema = z.string().regex(SHA256);
const exactText = z
  .string()
  .min(1)
  .refine((value) => value === value.trim());
const opaqueIdentifier = z.string().regex(OPAQUE_IDENTIFIER);
const instant = z
  .string()
  .regex(ISO_INSTANT)
  .refine((value) => Number.isFinite(Date.parse(value)));
const relativeAssetPath = exactText.refine(
  (value) => !path.isAbsolute(value) && !value.split(/[\\/]/u).includes('..'),
);
const scopeSchema = z
  .object({
    account_key: exactText,
    product_key: z.literal(PRODUCT_KEY),
    runtime_tier: z.enum(['isolated_staging', 'production']),
    verification_environment_id: exactText,
  })
  .strict();
const storageSchema = z
  .object({
    region: z.literal('eu-central-1'),
    bucket_ref: z
      .string()
      .regex(/^(?!.*\.\.)(?!\d+\.\d+\.\d+\.\d+$)[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u),
    kms_key_arn: z.string().regex(/^arn:aws:kms:eu-central-1:\d{12}:key\/[A-Za-z0-9-]{1,128}$/u),
    storage_class: z.enum(['STANDARD', 'INTELLIGENT_TIERING']),
  })
  .strict();
const manifestSchema = z
  .object({
    schema_version: z.literal(OPERATION_SCHEMA),
    operation_id: z.string().regex(OPERATION_ID),
    expires_at: instant,
    expected_runtime_source_sha: z.string().regex(RUNTIME_SHA),
    authorization_phrase_sha256: sha256Schema,
    authorization_binding_sha256: sha256Schema,
    scope: scopeSchema,
    storage: storageSchema,
    drive_source: z
      .object({
        file_identity: exactText,
        revision_identity: exactText,
        private_source_relative_path: relativeAssetPath,
        sha256: sha256Schema,
        byte_count: z.number().int().min(1).max(5_368_709_120),
        media: z
          .object({
            content_type: z.literal('video/mp4'),
            container: z.literal('mp4'),
            duration_ms: z.number().int().min(60_000).max(120_000),
            width: z.literal(APPROVED_SOURCE_WIDTH),
            height: z.literal(APPROVED_SOURCE_HEIGHT),
            frames_per_second: z.number().positive().max(30),
            video_codec: z.literal('h264'),
            pixel_format: z.literal('yuv420p'),
            rotation_degrees: z.literal(0),
            sample_aspect_ratio: z.literal('1:1'),
            audio_codec: z.literal('aac'),
            audio_profile: z.literal('LC'),
            audio_sample_rate_hz: z.literal(44_100),
            audio_channels: z.literal(2),
          })
          .strict(),
      })
      .strict(),
    review: z
      .object({
        approved_by_admin_id: opaqueIdentifier,
        rights_attested_at: instant,
        human_reviewed_at: instant,
        approved_at: instant,
        publication_requested_at: instant,
        child_data_disposition: z.enum(['none_present', 'redactions_complete']),
      })
      .strict(),
    presentation: z
      .object({
        title: exactText,
        class_topic: exactText,
      })
      .strict(),
    private_asset_root: exactText,
    assets: z
      .object({
        media: z
          .object({
            relative_path: relativeAssetPath,
            sha256: sha256Schema,
            byte_count: z.number().int().min(1).max(5_368_709_120),
            content_type: z.literal('video/mp4'),
            duration_ms: z.number().int().min(60_000).max(120_000),
            width: z.literal(APPROVED_DERIVATIVE_WIDTH),
            height: z.literal(APPROVED_DERIVATIVE_HEIGHT),
            frames_per_second: z.number().positive().max(30),
            audio_sample_rate_hz: z.literal(44_100),
          })
          .strict(),
        captions: z
          .object({
            relative_path: relativeAssetPath,
            sha256: sha256Schema,
            byte_count: z.number().int().min(1).max(MAX_CAPTIONS_BYTES),
            content_type: z.literal('text/vtt'),
          })
          .strict(),
        poster: z
          .object({
            relative_path: relativeAssetPath,
            sha256: sha256Schema,
            byte_count: z
              .number()
              .int()
              .min(1)
              .max(50 * 1024 * 1024),
            content_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
            width: z.literal(APPROVED_DERIVATIVE_WIDTH),
            height: z.literal(APPROVED_DERIVATIVE_HEIGHT),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

type BindingManifest = z.infer<typeof manifestSchema>;
type AssetKind = keyof BindingManifest['assets'];

export type ParentWelcomeRuntimeIdentity = {
  commitSha: string;
  accountKey: string;
  productKey: string;
  runtimeTier: 'isolated_staging' | 'production';
  verificationEnvironmentId: string;
  writesAllowed: boolean;
  region: string;
  bucketRef: string;
  kmsKeyArn: string;
  storageClass: 'STANDARD' | 'INTELLIGENT_TIERING';
};

type VerifiedLocalAsset = {
  kind: AssetKind;
  localPath: string;
  objectKey: string;
  sha256: string;
  byteCount: number;
  contentType: string;
  width: number | null;
  height: number | null;
};

type VerifiedPrivateSource = {
  localPath: string;
  sha256: string;
  byteCount: number;
};

export type ParentWelcomeMediaEvidence = {
  container: string;
  videoStreamCount: number;
  audioStreamCount: number;
  width: number;
  height: number;
  rotationDegrees: number;
  sampleAspectRatio: string;
  durationMs: number;
  framesPerSecond: number;
  videoCodec: string;
  pixelFormat: string;
  audioCodec: string;
  audioProfile: string;
  audioSampleRateHz: number;
  audioChannels: number;
  decoded: boolean;
  privacyMetadataRemoved: boolean;
};

export type ParentWelcomePosterEvidence = {
  format: string;
  width: number;
  height: number;
  decoded: boolean;
  privacyMetadataRemoved: boolean;
};

export type ParentWelcomeMediaProbe = {
  inspectMedia(filePath: string): Promise<ParentWelcomeMediaEvidence>;
  inspectPoster(filePath: string): Promise<ParentWelcomePosterEvidence>;
};

export type ParentWelcomeObjectInspection =
  | { state: 'absent' }
  | { state: 'exact'; versionId: string }
  | { state: 'mismatch'; versionId?: string }
  | { state: 'ambiguous' };

export type ParentWelcomeObjectStore = {
  assertPrivateVersionedPolicy(input: {
    region: string;
    bucketRef: string;
    kmsKeyArn: string;
    storageClass: string;
  }): Promise<void>;
  inspect(input: {
    objectKey: string;
    sha256: string;
    byteCount: number;
    contentType: string;
    kind: AssetKind;
  }): Promise<ParentWelcomeObjectInspection>;
  putOnce(input: {
    objectKey: string;
    localPath: string;
    sha256: string;
    byteCount: number;
    contentType: string;
    kind: AssetKind;
  }): Promise<{ versionId: string }>;
  deleteExactVersion(input: { objectKey: string; versionId: string }): Promise<void>;
};

type BoundAsset = VerifiedLocalAsset & { objectVersionId: string };

export type ParentWelcomeBindingPlan = {
  scope: BindingManifest['scope'];
  operationId: string;
  manifestDigest: string;
  authorizationPhraseSha256: string;
  authorizationBindingSha256: string;
  resultDigest: string;
  sourceKey: string;
  sourceSha256: string;
  sourceObjectVersionId: string;
  sourceLinkKey: string;
  driveFileRefDigest: string;
  driveRevisionDigest: string;
  contentId: string;
  contentVersionId: string;
  contentVersionDigest: string;
  videoVersionId: string;
  publicationGeneration: 1;
  approvalProjectionDigest: string;
  approvedAt: string;
  publishedAt: string;
  title: string;
  durationMs: number;
  width: number;
  height: number;
  sourceRecord: Record<string, unknown>;
  sourceLinkRecord: Record<string, unknown>;
  driveObservationRecord: Record<string, unknown>;
  captureEvidence: Record<string, unknown>;
  processingVersion: Record<string, unknown>;
  processingArtifacts: readonly ProcessingArtifact[];
  publicationRecord: ContentPublicationRecord;
  ingestReceipt: Record<string, unknown>;
  processingReceipt: Record<string, unknown>;
  publicationReceipt: Record<string, unknown>;
  assets: readonly {
    kind: AssetKind;
    objectKey: string;
    objectVersionId: string;
    byteCount: number;
    payloadSha256: string;
    contentType: string;
    width: number | null;
    height: number | null;
  }[];
};

export type ParentWelcomeBindingRepository = {
  withOperationLock<T>(
    input: { scope: BindingManifest['scope'] },
    work: () => Promise<T>,
  ): Promise<T>;
  consumeAuthorization(
    input: ParentWelcomeAuthorizationClaim,
  ): Promise<'claimed' | 'committed_replay' | 'consumed' | 'conflict'>;
  reconcileAuthorization(
    input: ParentWelcomeAuthorizationClaim,
  ): Promise<'unseen' | 'claimed' | 'committed_replay' | 'conflict'>;
  reconcileCommittedOperation(input: {
    operationId: string;
    manifestDigest: string;
  }): Promise<'absent' | 'exact' | 'conflict'>;
  preflight(input: {
    scope: BindingManifest['scope'];
    videoVersionId: string;
  }): Promise<{ state: 'absent' | 'candidate' | 'conflict' }>;
  reconcile(plan: ParentWelcomeBindingPlan): Promise<'absent' | 'exact' | 'conflict'>;
  apply(plan: ParentWelcomeBindingPlan): Promise<'applied' | 'replayed' | 'precommit_failure'>;
};

export type ParentWelcomeBindingReport = {
  schema: typeof REPORT_SCHEMA;
  generated_at: string;
  apply: boolean;
  status:
    | 'dry_run_planned'
    | 'dry_run_blocked'
    | 'blocked'
    | 'blocked_cleanup_required'
    | 'acceptance_unknown'
    | 'applied'
    | 'already_applied';
  blockers: string[];
  inventory: {
    required_assets: 3;
    exact_existing_assets: number;
    absent_assets: number;
  };
  effects: {
    s3_objects_created: number;
    s3_objects_removed_during_rollback: number;
    database_transaction_committed: boolean;
    non_storage_provider_mutations: 0;
    email_sends: 0;
    customer_messages: 0;
  };
  safety: {
    dry_run_default: true;
    invocation_scoped_private_manifest: true;
    ephemeral_authorization_required_for_apply: true;
    authorization_is_manifest_bound_and_one_use: true;
    result_sink_reserved_before_effects: boolean;
    source_and_media_decode_verified_before_effects: true;
    exact_runtime_scope_required: true;
    versioned_private_s3_required: true;
    database_transaction_required: true;
    raw_source_identity_returned: false;
    raw_asset_hashes_returned: false;
    raw_storage_locators_returned: false;
  };
};

export type ParentWelcomeAuthorizationClaim = {
  operationId: string;
  manifestDigest: string;
  authorizationPhraseSha256: string;
  authorizationBindingSha256: string;
  scope: BindingManifest['scope'];
  consumedAt: string;
};

export type ParentWelcomePrivateResultSink = {
  reserve(input: { generatedAt: string; apply: boolean }): Promise<void>;
  finalize(report: ParentWelcomeBindingReport): Promise<void>;
};

export async function runParentWelcomeVideoBinding(input: {
  manifest: unknown;
  apply?: boolean;
  authorizationPhrase?: string;
  runtime: ParentWelcomeRuntimeIdentity;
  objectStore: ParentWelcomeObjectStore;
  repository: ParentWelcomeBindingRepository;
  mediaProbe: ParentWelcomeMediaProbe;
  resultSink: ParentWelcomePrivateResultSink;
  now?: Date;
}): Promise<ParentWelcomeBindingReport> {
  const apply = input.apply === true;
  const now = input.now ?? new Date();
  try {
    await input.resultSink.reserve({ generatedAt: now.toISOString(), apply });
  } catch {
    const report = withBlocked(baseReport(now, apply, []), [
      'private_result_sink_reservation_failed',
    ]);
    return {
      ...report,
      safety: { ...report.safety, result_sink_reserved_before_effects: false },
    };
  }

  const report = await runParentWelcomeVideoBindingCore(input, now);
  try {
    await input.resultSink.finalize(report);
    return report;
  } catch (error) {
    const durabilityUnknown = safeCode(error, '') === 'private_result_durability_unknown';
    if (apply || durabilityUnknown) {
      const parsed = manifestSchema.safeParse(input.manifest);
      if (apply && parsed.success) {
        try {
          await input.repository.reconcileCommittedOperation({
            operationId: parsed.data.operation_id,
            manifestDigest: parentWelcomeManifestDigest(parsed.data),
          });
        } catch {
          // The reserved result already says acceptance_unknown. Never rerun an
          // effect to compensate for a result-sink failure.
        }
      }
      return {
        ...report,
        status: 'acceptance_unknown',
        blockers: ['private_result_finalize_acceptance_unknown'],
      };
    }
    return withBlocked(report, ['private_result_finalize_failed']);
  }
}

async function runParentWelcomeVideoBindingCore(
  input: {
    manifest: unknown;
    apply?: boolean;
    authorizationPhrase?: string;
    runtime: ParentWelcomeRuntimeIdentity;
    objectStore: ParentWelcomeObjectStore;
    repository: ParentWelcomeBindingRepository;
    mediaProbe: ParentWelcomeMediaProbe;
  },
  now: Date,
): Promise<ParentWelcomeBindingReport> {
  const apply = input.apply === true;
  let manifest: BindingManifest;
  try {
    manifest = manifestSchema.parse(input.manifest);
  } catch {
    return withBlocked(baseReport(now, apply, []), ['private_manifest_invalid']);
  }

  const report = baseReport(now, apply, []);
  const envelopeBlockers = validateEnvelope(
    manifest,
    input.runtime,
    now,
    apply,
    input.authorizationPhrase,
  );
  if (envelopeBlockers.length > 0) {
    return withBlocked(report, envelopeBlockers);
  }

  let prepared: Awaited<ReturnType<typeof verifyLocalAssets>>;
  try {
    prepared = await verifyLocalAssets(manifest, input.mediaProbe);
  } catch (error) {
    return withBlocked(report, [safeCode(error, 'local_asset_readback_mismatch')]);
  }
  if (!approvedPublicTextIsSanitized(manifest, prepared.captionText)) {
    return withBlocked(report, ['approved_public_text_contains_private_material']);
  }
  if (
    apply &&
    !sha256HexEquals(
      parentWelcomeAuthorizationBindingSha256(manifest, input.authorizationPhrase!),
      manifest.authorization_binding_sha256,
    )
  ) {
    return withBlocked(report, ['authorization_manifest_binding_mismatch']);
  }

  const executeInventoryAndBinding = async (): Promise<ParentWelcomeBindingReport> => {
    const identity = bindingIdentity(manifest, prepared);
    let databasePreflight: Awaited<ReturnType<ParentWelcomeBindingRepository['preflight']>>;
    try {
      databasePreflight = await input.repository.preflight({
        scope: manifest.scope,
        videoVersionId: identity.videoVersionId,
      });
    } catch {
      return withBlocked(report, ['database_preflight_failed']);
    }
    if (databasePreflight.state === 'conflict') {
      return withBlocked(report, ['current_parent_welcome_slot_conflict']);
    }

    try {
      await input.objectStore.assertPrivateVersionedPolicy({
        region: manifest.storage.region,
        bucketRef: manifest.storage.bucket_ref,
        kmsKeyArn: manifest.storage.kms_key_arn,
        storageClass: manifest.storage.storage_class,
      });
    } catch {
      return withBlocked(report, ['s3_private_versioned_policy_mismatch']);
    }

    const inspections: Array<{
      asset: VerifiedLocalAsset;
      inspection: ParentWelcomeObjectInspection;
    }> = [];
    for (const asset of prepared.assets) {
      let inspection: ParentWelcomeObjectInspection;
      try {
        inspection = await input.objectStore.inspect(asset);
      } catch {
        return withBlocked(report, ['s3_object_readback_failed']);
      }
      if (inspection.state === 'ambiguous') {
        return withBlocked(report, ['s3_object_inventory_ambiguous']);
      }
      if (inspection.state === 'mismatch') {
        return withBlocked(report, ['s3_object_readback_mismatch']);
      }
      inspections.push({ asset, inspection });
    }
    report.inventory.exact_existing_assets = inspections.filter(
      ({ inspection }) => inspection.state === 'exact',
    ).length;
    report.inventory.absent_assets = inspections.filter(
      ({ inspection }) => inspection.state === 'absent',
    ).length;

    let previewPlan: ParentWelcomeBindingPlan;
    try {
      previewPlan = buildPlan(
        manifest,
        prepared.captionText,
        prepared.captionCues,
        previewBoundAssets(inspections),
        identity,
        now,
      );
    } catch (error) {
      return withBlocked(report, [safeCode(error, 'binding_plan_invalid')]);
    }

    if (!apply) {
      if (databasePreflight.state === 'candidate') {
        if (inspections.some(({ inspection }) => inspection.state !== 'exact')) {
          return withBlocked(report, ['database_object_binding_conflict']);
        }
        try {
          if ((await input.repository.reconcile(previewPlan)) === 'exact') {
            return { ...report, status: 'already_applied' };
          }
        } catch {
          return {
            ...report,
            status: 'acceptance_unknown',
            blockers: ['database_reconciliation_failed'],
          };
        }
        return withBlocked(report, ['database_object_binding_conflict']);
      }
      return { ...report, status: 'dry_run_planned' };
    }

    const authorizationClaim: ParentWelcomeAuthorizationClaim = {
      operationId: manifest.operation_id,
      manifestDigest: parentWelcomeManifestDigest(manifest),
      authorizationPhraseSha256: manifest.authorization_phrase_sha256,
      authorizationBindingSha256: manifest.authorization_binding_sha256,
      scope: manifest.scope,
      consumedAt: now.toISOString(),
    };
    let authorizationState: 'claimed' | 'committed_replay' | 'consumed' | 'conflict';
    try {
      authorizationState = await input.repository.consumeAuthorization(authorizationClaim);
    } catch {
      try {
        const reconciled = await input.repository.reconcileAuthorization(authorizationClaim);
        if (reconciled === 'committed_replay') authorizationState = 'committed_replay';
        else {
          return {
            ...report,
            status: 'acceptance_unknown',
            blockers: ['authorization_claim_acceptance_unknown'],
          };
        }
      } catch {
        return {
          ...report,
          status: 'acceptance_unknown',
          blockers: ['authorization_claim_acceptance_unknown'],
        };
      }
    }
    if (authorizationState === 'consumed') {
      return withBlocked(report, ['one_use_authorization_consumed']);
    }
    if (authorizationState === 'conflict') {
      return withBlocked(report, ['authorization_manifest_conflict']);
    }
    if (authorizationState === 'committed_replay') {
      if (
        databasePreflight.state !== 'candidate' ||
        inspections.some(({ inspection }) => inspection.state !== 'exact')
      ) {
        return withBlocked(report, ['committed_operation_reconciliation_conflict']);
      }
      try {
        return (await input.repository.reconcile(previewPlan)) === 'exact'
          ? { ...report, status: 'already_applied' }
          : withBlocked(report, ['committed_operation_reconciliation_conflict']);
      } catch {
        return {
          ...report,
          status: 'acceptance_unknown',
          blockers: ['database_reconciliation_failed'],
        };
      }
    }
    if (databasePreflight.state === 'candidate') {
      return withBlocked(report, ['committed_operation_result_missing']);
    }

    const created: BoundAsset[] = [];
    const bound: BoundAsset[] = [];
    for (const item of inspections) {
      if (item.inspection.state === 'exact') {
        bound.push({ ...item.asset, objectVersionId: item.inspection.versionId });
        continue;
      }
      let putVersionId: string | undefined;
      let putFailed = false;
      try {
        const put = await input.objectStore.putOnce(item.asset);
        putVersionId = put.versionId;
        created.push({ ...item.asset, objectVersionId: put.versionId });
      } catch {
        putFailed = true;
        // A thrown upload may still have been accepted. Reconcile exactly once;
        // never issue a second PutObject or delete a version whose ownership is unknown.
      }
      let after: ParentWelcomeObjectInspection;
      try {
        after = await input.objectStore.inspect(item.asset);
      } catch {
        const cleanup = await rollbackCreated(input.objectStore, created);
        return cleanup.complete
          ? {
              ...report,
              status: 'acceptance_unknown',
              blockers: ['s3_upload_acceptance_unknown'],
              effects: effectCounts(created.length, cleanup.removed, false),
            }
          : cleanupRequired(report, created.length, cleanup.removed);
      }
      if (putFailed) {
        const cleanup = await rollbackCreated(input.objectStore, created);
        if (!cleanup.complete) return cleanupRequired(report, created.length, cleanup.removed);
        if (after.state === 'absent') {
          return {
            ...report,
            status: 'blocked',
            blockers: ['s3_upload_failed'],
            effects: effectCounts(created.length, cleanup.removed, false),
          };
        }
        return {
          ...report,
          status: 'acceptance_unknown',
          blockers: ['s3_upload_acceptance_unknown'],
          effects: effectCounts(created.length, cleanup.removed, false),
        };
      }
      if (after.state !== 'exact' || after.versionId !== putVersionId) {
        const cleanup = await rollbackCreated(input.objectStore, created);
        const blocker =
          after.state === 'ambiguous'
            ? 's3_upload_inventory_ambiguous'
            : after.state === 'mismatch'
              ? 's3_upload_readback_mismatch'
              : 's3_upload_acceptance_unknown';
        return cleanup.complete
          ? {
              ...report,
              status: after.state === 'absent' ? 'acceptance_unknown' : 'blocked',
              blockers: [blocker],
              effects: effectCounts(created.length, cleanup.removed, false),
            }
          : cleanupRequired(report, created.length, cleanup.removed);
      }
      const createdAsset = { ...item.asset, objectVersionId: after.versionId };
      bound.push(createdAsset);
    }

    let plan: ParentWelcomeBindingPlan;
    try {
      plan = buildPlan(manifest, prepared.captionText, prepared.captionCues, bound, identity, now);
    } catch (error) {
      const cleanup = await rollbackCreated(input.objectStore, created);
      return cleanup.complete
        ? {
            ...report,
            status: 'blocked',
            blockers: [safeCode(error, 'binding_plan_invalid')],
            effects: effectCounts(created.length, cleanup.removed, false),
          }
        : cleanupRequired(report, created.length, cleanup.removed);
    }
    try {
      const outcome = await input.repository.apply(plan);
      if (outcome === 'precommit_failure') {
        const cleanup = await rollbackCreated(input.objectStore, created);
        return cleanup.complete
          ? {
              ...report,
              status: 'blocked',
              blockers: ['database_transaction_failed'],
              effects: effectCounts(created.length, cleanup.removed, false),
            }
          : cleanupRequired(report, created.length, cleanup.removed);
      }
      return {
        ...report,
        status: outcome === 'replayed' ? 'already_applied' : 'applied',
        effects: effectCounts(created.length, 0, outcome === 'applied'),
      };
    } catch {
      try {
        if ((await input.repository.reconcile(plan)) === 'exact') {
          return {
            ...report,
            status: 'already_applied',
            effects: effectCounts(created.length, 0, true),
          };
        }
      } catch {
        return {
          ...report,
          status: 'acceptance_unknown',
          blockers: ['database_commit_acceptance_unknown'],
          effects: effectCounts(created.length, 0, false),
        };
      }
      return {
        ...report,
        status: 'acceptance_unknown',
        blockers: ['database_commit_acceptance_unknown'],
        effects: effectCounts(created.length, 0, false),
      };
    }
  };

  if (!apply) return executeInventoryAndBinding();
  let lockEntered = false;
  try {
    return await input.repository.withOperationLock({ scope: manifest.scope }, async () => {
      lockEntered = true;
      return executeInventoryAndBinding();
    });
  } catch {
    return {
      ...report,
      status: lockEntered ? 'acceptance_unknown' : 'blocked',
      blockers: [
        lockEntered
          ? 'database_operation_lock_acceptance_unknown'
          : 'database_operation_lock_failed',
      ],
    };
  }
}

function baseReport(now: Date, apply: boolean, blockers: string[]): ParentWelcomeBindingReport {
  return {
    schema: REPORT_SCHEMA,
    generated_at: now.toISOString(),
    apply,
    status: apply ? 'blocked' : 'dry_run_blocked',
    blockers,
    inventory: { required_assets: 3, exact_existing_assets: 0, absent_assets: 0 },
    effects: effectCounts(0, 0, false),
    safety: {
      dry_run_default: true,
      invocation_scoped_private_manifest: true,
      ephemeral_authorization_required_for_apply: true,
      authorization_is_manifest_bound_and_one_use: true,
      result_sink_reserved_before_effects: true,
      source_and_media_decode_verified_before_effects: true,
      exact_runtime_scope_required: true,
      versioned_private_s3_required: true,
      database_transaction_required: true,
      raw_source_identity_returned: false,
      raw_asset_hashes_returned: false,
      raw_storage_locators_returned: false,
    },
  };
}

function withBlocked(report: ParentWelcomeBindingReport, blockers: string[]) {
  return {
    ...report,
    status: report.apply ? ('blocked' as const) : ('dry_run_blocked' as const),
    blockers,
  };
}

function cleanupRequired(
  report: ParentWelcomeBindingReport,
  created: number,
  removed: number,
): ParentWelcomeBindingReport {
  return {
    ...report,
    status: 'blocked_cleanup_required',
    blockers: ['exact_s3_rollback_incomplete'],
    effects: effectCounts(created, removed, false),
  };
}

function effectCounts(created: number, removed: number, committed: boolean) {
  return {
    s3_objects_created: created,
    s3_objects_removed_during_rollback: removed,
    database_transaction_committed: committed,
    non_storage_provider_mutations: 0 as const,
    email_sends: 0 as const,
    customer_messages: 0 as const,
  };
}

function validateEnvelope(
  manifest: BindingManifest,
  runtime: ParentWelcomeRuntimeIdentity,
  now: Date,
  apply: boolean,
  authorizationPhrase: string | undefined,
) {
  const blockers: string[] = [];
  const expiresAt = Date.parse(manifest.expires_at);
  const rightsAt = Date.parse(manifest.review.rights_attested_at);
  const reviewedAt = Date.parse(manifest.review.human_reviewed_at);
  const approvedAt = Date.parse(manifest.review.approved_at);
  const publicationAt = Date.parse(manifest.review.publication_requested_at);
  if (
    !Number.isFinite(expiresAt) ||
    !Number.isFinite(rightsAt) ||
    !Number.isFinite(reviewedAt) ||
    !Number.isFinite(approvedAt) ||
    !Number.isFinite(publicationAt) ||
    rightsAt > reviewedAt ||
    reviewedAt > approvedAt ||
    approvedAt > publicationAt ||
    publicationAt > now.getTime()
  ) {
    blockers.push('review_chronology_invalid');
  }
  if (expiresAt <= now.getTime()) blockers.push('authorization_expired');
  if (apply && expiresAt - now.getTime() > MAX_AUTHORIZATION_WINDOW_MS) {
    blockers.push('authorization_window_too_broad');
  }
  if (
    runtime.commitSha !== manifest.expected_runtime_source_sha ||
    runtime.accountKey !== manifest.scope.account_key ||
    runtime.productKey !== manifest.scope.product_key ||
    runtime.runtimeTier !== manifest.scope.runtime_tier ||
    runtime.verificationEnvironmentId !== manifest.scope.verification_environment_id ||
    runtime.region !== manifest.storage.region ||
    runtime.bucketRef !== manifest.storage.bucket_ref ||
    runtime.kmsKeyArn !== manifest.storage.kms_key_arn ||
    runtime.storageClass !== manifest.storage.storage_class
  ) {
    blockers.push('runtime_scope_mismatch');
  }
  if (apply && runtime.writesAllowed !== true) blockers.push('runtime_writes_not_allowed');
  if (
    manifest.assets.media.width * 9 !== manifest.assets.media.height * 16 ||
    manifest.assets.poster.width * 9 !== manifest.assets.poster.height * 16 ||
    manifest.assets.media.width !== manifest.assets.poster.width ||
    manifest.assets.media.height !== manifest.assets.poster.height
  ) {
    blockers.push('approved_asset_dimensions_invalid');
  }
  if (apply) {
    if (!authorizationPhrase) blockers.push('ephemeral_authorization_missing');
    else if (!sha256Equals(authorizationPhrase, manifest.authorization_phrase_sha256)) {
      blockers.push('ephemeral_authorization_mismatch');
    }
  }
  return blockers;
}

async function verifyLocalAssets(manifest: BindingManifest, mediaProbe: ParentWelcomeMediaProbe) {
  if (!path.isAbsolute(manifest.private_asset_root)) throw safeError('private_asset_root_invalid');
  const root = path.resolve(manifest.private_asset_root);
  const canonicalRoot = await realpath(root);
  if (!(await stat(canonicalRoot)).isDirectory()) throw safeError('private_asset_root_invalid');
  if (
    new Set(Object.values(manifest.assets).map(({ relative_path }) => relative_path)).size !== 3
  ) {
    throw safeError('asset_set_invalid');
  }
  const sourcePath = await resolvePrivateFile(
    root,
    canonicalRoot,
    manifest.drive_source.private_source_relative_path,
  );
  const sourceFile = await stat(sourcePath);
  if (
    !sourceFile.isFile() ||
    sourceFile.size !== manifest.drive_source.byte_count ||
    (await fileSha256(sourcePath)) !== manifest.drive_source.sha256
  ) {
    throw safeError('private_source_readback_mismatch');
  }
  const source: VerifiedPrivateSource = {
    localPath: sourcePath,
    sha256: manifest.drive_source.sha256,
    byteCount: manifest.drive_source.byte_count,
  };
  const assets: VerifiedLocalAsset[] = [];
  for (const kind of ['media', 'captions', 'poster'] as const) {
    const declared = manifest.assets[kind];
    const localPath = await resolvePrivateFile(root, canonicalRoot, declared.relative_path);
    const file = await stat(localPath);
    if (!file.isFile() || file.size !== declared.byte_count) {
      throw safeError('local_asset_readback_mismatch');
    }
    if ((await fileSha256(localPath)) !== declared.sha256) {
      throw safeError('local_asset_readback_mismatch');
    }
    assets.push({
      kind,
      localPath,
      objectKey: `parent_welcome_${kind}_${declared.sha256}`,
      sha256: declared.sha256,
      byteCount: declared.byte_count,
      contentType: declared.content_type,
      width: kind === 'poster' ? manifest.assets.poster.width : null,
      height: kind === 'poster' ? manifest.assets.poster.height : null,
    });
  }
  const mediaPath = assets.find(({ kind }) => kind === 'media')!.localPath;
  const posterPath = assets.find(({ kind }) => kind === 'poster')!.localPath;
  let mediaEvidence: ParentWelcomeMediaEvidence;
  let sourceMediaEvidence: ParentWelcomeMediaEvidence;
  let posterEvidence: ParentWelcomePosterEvidence;
  try {
    const mediaInspection = mediaProbe.inspectMedia(mediaPath);
    [mediaEvidence, sourceMediaEvidence, posterEvidence] = await Promise.all([
      mediaInspection,
      sourcePath === mediaPath ? mediaInspection : mediaProbe.inspectMedia(sourcePath),
      mediaProbe.inspectPoster(posterPath),
    ]);
  } catch {
    throw safeError('media_probe_failed');
  }
  if (!approvedMediaEvidenceIsExact(mediaEvidence, manifest)) {
    throw safeError('media_probe_evidence_mismatch');
  }
  if (!approvedSourceMediaEvidenceIsExact(sourceMediaEvidence, manifest)) {
    throw safeError('private_source_probe_evidence_mismatch');
  }
  const expectedPosterFormat = manifest.assets.poster.content_type.slice('image/'.length);
  if (
    posterEvidence.decoded !== true ||
    posterEvidence.privacyMetadataRemoved !== true ||
    posterEvidence.format !== expectedPosterFormat ||
    posterEvidence.width * 9 !== posterEvidence.height * 16 ||
    posterEvidence.width !== manifest.assets.poster.width ||
    posterEvidence.height !== manifest.assets.poster.height
  ) {
    throw safeError('poster_probe_evidence_mismatch');
  }
  const captionPath = assets.find(({ kind }) => kind === 'captions')!.localPath;
  const captions = await readFile(captionPath, 'utf8');
  if (containsPrivateManifestText(manifest, captions)) {
    throw safeError('captions_contain_private_material');
  }
  const parsedCaptions = transcriptFromWebVtt(captions, mediaEvidence.durationMs);
  await assertLocalFileExact(source.localPath, source.byteCount, source.sha256);
  for (const asset of assets) {
    await assertLocalFileExact(asset.localPath, asset.byteCount, asset.sha256);
  }
  return {
    source,
    assets,
    sourceMediaEvidence,
    mediaEvidence,
    posterEvidence,
    ...parsedCaptions,
  };
}

async function assertLocalFileExact(filePath: string, byteCount: number, digest: string) {
  const file = await stat(filePath);
  if (!file.isFile() || file.size !== byteCount || (await fileSha256(filePath)) !== digest) {
    throw safeError('private_input_changed_during_verification');
  }
}

function approvedMediaEvidenceIsExact(
  evidence: ParentWelcomeMediaEvidence,
  manifest: BindingManifest,
) {
  return (
    evidence.container === 'mp4' &&
    evidence.videoStreamCount === 1 &&
    evidence.audioStreamCount === 1 &&
    evidence.videoCodec === 'h264' &&
    evidence.pixelFormat === 'yuv420p' &&
    evidence.audioCodec === 'aac' &&
    evidence.audioProfile === 'LC' &&
    evidence.audioSampleRateHz === manifest.assets.media.audio_sample_rate_hz &&
    evidence.audioChannels === 2 &&
    evidence.decoded === true &&
    evidence.privacyMetadataRemoved === true &&
    evidence.rotationDegrees === 0 &&
    evidence.sampleAspectRatio === '1:1' &&
    evidence.width * 9 === evidence.height * 16 &&
    evidence.width === manifest.assets.media.width &&
    evidence.height === manifest.assets.media.height &&
    evidence.durationMs === manifest.assets.media.duration_ms &&
    Math.abs(evidence.framesPerSecond - manifest.assets.media.frames_per_second) <= 0.01
  );
}

function approvedSourceMediaEvidenceIsExact(
  evidence: ParentWelcomeMediaEvidence,
  manifest: BindingManifest,
) {
  const declared = manifest.drive_source.media;
  return (
    evidence.container === declared.container &&
    evidence.videoStreamCount === 1 &&
    evidence.audioStreamCount === 1 &&
    evidence.videoCodec === declared.video_codec &&
    evidence.pixelFormat === declared.pixel_format &&
    evidence.audioCodec === declared.audio_codec &&
    evidence.audioProfile === declared.audio_profile &&
    evidence.audioSampleRateHz === declared.audio_sample_rate_hz &&
    evidence.audioChannels === declared.audio_channels &&
    evidence.decoded === true &&
    evidence.rotationDegrees === declared.rotation_degrees &&
    evidence.sampleAspectRatio === declared.sample_aspect_ratio &&
    evidence.width === declared.width &&
    evidence.height === declared.height &&
    evidence.durationMs === declared.duration_ms &&
    Math.abs(evidence.framesPerSecond - declared.frames_per_second) <= 0.01
  );
}

async function resolvePrivateFile(root: string, canonicalRoot: string, relativePath: string) {
  const requestedPath = path.resolve(root, relativePath);
  if (requestedPath === root || !requestedPath.startsWith(`${root}${path.sep}`)) {
    throw safeError('private_asset_path_invalid');
  }
  const localPath = await realpath(requestedPath);
  if (localPath === canonicalRoot || !localPath.startsWith(`${canonicalRoot}${path.sep}`)) {
    throw safeError('private_asset_path_invalid');
  }
  return localPath;
}

function transcriptFromWebVtt(value: string, durationMs: number) {
  const normalized = normalizeWebVtt(value);
  if (!normalized.startsWith('WEBVTT\n') || normalized.includes('\0')) {
    throw safeError('captions_invalid');
  }
  const blocks = normalized
    .slice('WEBVTT\n'.length)
    .trim()
    .split(/\n{2,}/u);
  const text: string[] = [];
  const cues: Array<{ startMs: number; endMs: number; text: string }> = [];
  let priorEnd = 0;
  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim());
    if (lines.some((line) => /^(?:NOTE|STYLE|REGION)(?:\s|$)/u.test(line))) {
      throw safeError('captions_invalid');
    }
    const timingIndex = lines.findIndex((line) => line.includes('-->'));
    if (timingIndex < 0 || timingIndex > 1) throw safeError('captions_invalid');
    const match = /^(\d{2}):(\d{2}):(\d{2})\.(\d{3}) --> (\d{2}):(\d{2}):(\d{2})\.(\d{3})$/u.exec(
      lines[timingIndex]!,
    );
    if (!match) throw safeError('captions_invalid');
    const startMs = webVttTimestampMs(match.slice(1, 5));
    const endMs = webVttTimestampMs(match.slice(5, 9));
    const cueText = lines
      .slice(timingIndex + 1)
      .map((line) => line.replace(/<[^>]*>/gu, '').trim())
      .filter(Boolean)
      .join('\n');
    if (!cueText || startMs < priorEnd || startMs >= endMs || endMs > durationMs) {
      throw safeError('captions_invalid');
    }
    cues.push({ startMs, endMs, text: cueText });
    text.push(cueText);
    priorEnd = endMs;
  }
  const joined = text.join('\n');
  if (!joined) throw safeError('captions_invalid');
  return { captionText: joined, captionCues: cues };
}

function webVttTimestampMs(parts: readonly string[]) {
  const [hours, minutes, seconds, milliseconds] = parts.map(Number);
  if (
    hours === undefined ||
    minutes === undefined ||
    seconds === undefined ||
    milliseconds === undefined ||
    minutes > 59 ||
    seconds > 59
  ) {
    throw safeError('captions_invalid');
  }
  return (hours * 60 * 60 + minutes * 60 + seconds) * 1000 + milliseconds;
}

function approvedPublicTextIsSanitized(manifest: BindingManifest, captionText: string) {
  const publicText = [manifest.presentation.title, manifest.presentation.class_topic, captionText];
  return publicText.every((text) => !containsPrivateManifestText(manifest, text));
}

function containsPrivateManifestText(manifest: BindingManifest, text: string) {
  const normalizedText = normalizeTextForPrivacyCheck(text).toLocaleLowerCase('en-US');
  if (/(?:https?:\/\/|drive\.google\.com|docs\.google\.com)/iu.test(normalizedText)) return true;
  const privateValues = [
    manifest.operation_id,
    manifest.private_asset_root,
    manifest.expected_runtime_source_sha,
    manifest.scope.account_key,
    manifest.scope.runtime_tier,
    manifest.scope.verification_environment_id,
    manifest.drive_source.private_source_relative_path,
    manifest.drive_source.file_identity,
    manifest.drive_source.revision_identity,
    manifest.drive_source.sha256,
    manifest.review.approved_by_admin_id,
    manifest.review.rights_attested_at,
    manifest.review.human_reviewed_at,
    manifest.review.approved_at,
    manifest.review.publication_requested_at,
    manifest.storage.bucket_ref,
    manifest.storage.kms_key_arn,
    manifest.authorization_phrase_sha256,
    manifest.authorization_binding_sha256,
    ...Object.values(manifest.assets).map(({ relative_path: relativePath }) => relativePath),
    ...Object.values(manifest.assets).map(({ sha256: digest }) => digest),
  ];
  return privateValues.some((privateValue) =>
    normalizedText.includes(normalizeTextForPrivacyCheck(privateValue).toLocaleLowerCase('en-US')),
  );
}

function normalizeTextForPrivacyCheck(value: string) {
  return normalizeWebVtt(value).normalize('NFKC').replace(/\\/gu, '/');
}

function normalizeWebVtt(value: string) {
  return value.replace(/^\uFEFF/u, '').replace(/\r\n?/gu, '\n');
}

function bindingIdentity(
  manifest: BindingManifest,
  prepared: Awaited<ReturnType<typeof verifyLocalAssets>>,
) {
  const { assets } = prepared;
  const driveFileRefDigest = sha256(manifest.drive_source.file_identity);
  const driveRevisionDigest = sha256(manifest.drive_source.revision_identity);
  const sourceObjectVersionId = `drive_revision_${driveRevisionDigest}`;
  const sourceKey = `source_${sha256(
    [
      manifest.scope.account_key,
      manifest.scope.product_key,
      driveFileRefDigest,
      driveRevisionDigest,
      manifest.drive_source.sha256,
    ].join('\0'),
  ).slice(0, 32)}`;
  const assetSetDigest = sha256(
    JSON.stringify(
      assets.map(({ kind, sha256: payloadSha256, byteCount, contentType, width, height }) => ({
        kind,
        payloadSha256,
        byteCount,
        contentType,
        width,
        height,
      })),
    ),
  );
  const derivationEvidenceDigest = sha256(
    canonicalJson({
      evidenceVersion: 'OT-PARENT-WELCOME-DERIVATION-1',
      sourceSha256: prepared.source.sha256,
      sourceByteCount: prepared.source.byteCount,
      driveFileRefDigest,
      driveRevisionDigest,
      assets: assets.map(({ kind, sha256: payloadSha256, byteCount }) => ({
        kind,
        payloadSha256,
        byteCount,
      })),
      sourceMediaEvidence: prepared.sourceMediaEvidence,
      mediaEvidence: prepared.mediaEvidence,
      posterEvidence: prepared.posterEvidence,
    }),
  );
  return {
    driveFileRefDigest,
    driveRevisionDigest,
    sourceObjectVersionId,
    sourceKey,
    sourceLinkKey: `parent_welcome_drive_${sha256(`${sourceKey}\0${driveFileRefDigest}`).slice(0, 48)}`,
    assetSetDigest,
    derivationEvidenceDigest,
    mediaPrivacyMetadataRemoved: prepared.mediaEvidence.privacyMetadataRemoved,
    contentId: `parent_welcome_content_${sha256(`${sourceKey}\0${assetSetDigest}`).slice(0, 48)}`,
    contentVersionId: `parent_welcome_version_${sha256(
      `${sourceKey}\0${sourceObjectVersionId}\0${assetSetDigest}`,
    ).slice(0, 48)}`,
    videoVersionId: `parent_welcome_${assetSetDigest.slice(0, 48)}`,
  };
}

function previewBoundAssets(
  items: readonly { asset: VerifiedLocalAsset; inspection: ParentWelcomeObjectInspection }[],
) {
  return items.map(({ asset, inspection }) => ({
    ...asset,
    objectVersionId:
      inspection.state === 'exact' ? inspection.versionId : `pending_version_${asset.kind}`,
  }));
}

async function rollbackCreated(store: ParentWelcomeObjectStore, created: readonly BoundAsset[]) {
  let removed = 0;
  let complete = true;
  for (const asset of [...created].reverse()) {
    try {
      await store.deleteExactVersion({
        objectKey: asset.objectKey,
        versionId: asset.objectVersionId,
      });
      const readback = await store.inspect(asset);
      if (readback.state !== 'absent') throw new Error('rollback_readback_mismatch');
      removed += 1;
    } catch {
      complete = false;
    }
  }
  return { removed, complete };
}

function buildPlan(
  manifest: BindingManifest,
  captionText: string,
  captionCues: readonly { startMs: number; endMs: number; text: string }[],
  boundAssetsInput: readonly BoundAsset[],
  identity: ReturnType<typeof bindingIdentity>,
  now: Date,
): ParentWelcomeBindingPlan {
  void now;
  const publishedAt = new Date(manifest.review.publication_requested_at).toISOString();
  const approvedAt = new Date(manifest.review.approved_at).toISOString();
  const reviewedAt = new Date(manifest.review.human_reviewed_at).toISOString();
  const rightsAt = new Date(manifest.review.rights_attested_at).toISOString();
  const sourceRecord = {
    accountKey: manifest.scope.account_key,
    productKey: PRODUCT_KEY,
    id: identity.sourceKey,
    sourceKind: 'drive',
    captureMethod: 'existing_reviewed_recording',
    runtimeTier: manifest.scope.runtime_tier,
    verificationEnvironmentId: manifest.scope.verification_environment_id,
    bucketRef: manifest.storage.bucket_ref,
    objectKeyDigest: identity.driveFileRefDigest,
    objectVersionId: identity.sourceObjectVersionId,
    kmsKeyVersionRef: sha256(manifest.storage.kms_key_arn),
    checksumReadbackReceiptId: `parent_welcome_source_${sha256(
      `${identity.sourceKey}\0${manifest.drive_source.sha256}`,
    ).slice(0, 48)}`,
    displayFilename: 'parent-welcome-source.mp4',
    mimeType: 'video/mp4',
    container: 'mp4',
    byteCount: manifest.drive_source.byte_count,
    sha256: manifest.drive_source.sha256,
    receivedAt: approvedAt,
    stableAt: approvedAt,
    matchConfidence: 'none',
    retentionDueAt: '9999-12-31T23:59:59.999Z',
    lifecycleState: 'published',
    retryState: 'ready',
    attemptCount: 0,
    originalPreserved: true,
    version: 1,
    createdAt: approvedAt,
    updatedAt: publishedAt,
    existingRecordingAttestation: {
      evidenceVersion: 'OT-EXISTING-REVIEWED-RECORDING-1',
      origin: 'drive',
      rightsAttestedByAdminId: manifest.review.approved_by_admin_id,
      rightsAttestedAt: rightsAt,
      rightsToProcessAndPrivatelyPublish: true,
      humanReviewedByAdminId: manifest.review.approved_by_admin_id,
      humanReviewedAt: reviewedAt,
      childDataDisposition: manifest.review.child_data_disposition,
      noUnreviewedChildData: true,
    },
  } as const;
  const sourceLinkRecord = {
    accountKey: manifest.scope.account_key,
    productKey: PRODUCT_KEY,
    id: identity.sourceLinkKey,
    sourceId: identity.sourceKey,
    sourceKind: 'drive',
    provenanceRefDigest: identity.driveFileRefDigest,
    providerChangeMarker: identity.driveRevisionDigest,
    displayFilename: 'parent-welcome-source.mp4',
    observedAt: approvedAt,
  } as const;
  const driveObservationRecord = {
    accountKey: manifest.scope.account_key,
    productKey: PRODUCT_KEY,
    driveFileRefDigest: identity.driveFileRefDigest,
    parentFolderRefDigest: sha256(
      `${manifest.scope.account_key}\0${manifest.scope.product_key}\0parent-welcome-approved`,
    ),
    displayFilename: 'parent-welcome-source.mp4',
    mimeType: 'video/mp4',
    byteCount: manifest.drive_source.byte_count,
    changeMarker: identity.driveRevisionDigest,
    firstObservedAt: approvedAt,
    lastObservedAt: approvedAt,
    stableAt: approvedAt,
    state: 'processed',
    attemptCount: 0,
    retryState: 'ready',
    version: 1,
  } as const;
  const reviewedSourceDigest = sha256(
    JSON.stringify({
      sourceKey: identity.sourceKey,
      sourceSha256: manifest.drive_source.sha256,
      sourceObjectVersionId: identity.sourceObjectVersionId,
      assetSetDigest: identity.assetSetDigest,
      derivationEvidenceDigest: identity.derivationEvidenceDigest,
      childDataDisposition: manifest.review.child_data_disposition,
    }),
  );
  const captureEvidence = {
    evidenceVersion: 'OT-EXISTING-REVIEWED-RECORDING-1',
    sourceId: identity.sourceKey,
    captureMethod: 'existing_reviewed_recording',
    attestation: sourceRecord.existingRecordingAttestation,
    reviewedSourceDigest,
    derivationEvidenceDigest: identity.derivationEvidenceDigest,
    uploadConfirmedAt: publishedAt,
    durableChecksumReadbackReceiptId: sourceRecord.checksumReadbackReceiptId,
    linkedIngestSourceId: identity.sourceKey,
  } as const;

  const media = exactBoundAsset(boundAssetsInput, 'media');
  const captions = exactBoundAsset(boundAssetsInput, 'captions');
  const poster = exactBoundAsset(boundAssetsInput, 'poster');
  const trim = {
    trimVersion: 'OT-TRIM-1',
    sourceDurationMs: manifest.drive_source.media.duration_ms,
    startMs: 0,
    endMs: manifest.drive_source.media.duration_ms,
    outputDurationMs: manifest.assets.media.duration_ms,
    selectedByAdminId: manifest.review.approved_by_admin_id,
    selectedAt: reviewedAt,
  } as const;
  const parentWelcomeMediaProfile = {
    ...OT_VIDEO_1_PROFILE,
    version: 'OT-PARENT-WELCOME-EXISTING-VIDEO-1',
    audioSampleRateHz: manifest.assets.media.audio_sample_rate_hz,
  } as const;
  const transcodePlan = {
    profile: parentWelcomeMediaProfile,
    sourceId: identity.sourceKey,
    sourceSha256: manifest.drive_source.sha256,
    sourceObjectVersionId: identity.sourceObjectVersionId,
    trim,
    targetWidth: manifest.assets.media.width,
    targetHeight: manifest.assets.media.height,
    targetFramesPerSecond: manifest.assets.media.frames_per_second,
    command: {
      executable: 'ffmpeg',
      args: ['approved-parent-welcome', media.objectKey],
      shell: false,
    },
    boundedMemory: true,
    replacesOriginal: false,
  } as const;
  const transcriptPayload = {
    language: 'en',
    operation: {
      contractVersion: 'OT-PARENT-WELCOME-LOCAL-CAPTIONS-1',
      model: 'human-reviewed-local-faster-whisper',
      externalProviderEffect: false,
    },
    sourceId: identity.sourceKey,
    sourceSha256: manifest.drive_source.sha256,
    sourceObjectVersionId: identity.sourceObjectVersionId,
    captionsObjectVersionId: captions.objectVersionId,
    segments: captionCues.map((cue, index) => ({
      segmentId: sha256(`${captions.sha256}\0segment-${index + 1}`),
      startMs: cue.startMs,
      endMs: cue.endMs,
      text: cue.text,
      providerResultDigest: sha256(
        `${captions.sha256}\0local-reviewed-caption-result\0${index + 1}`,
      ),
    })),
    complete: true,
  };
  const artifactInputs: readonly {
    kind: ProcessingArtifact['kind'];
    payload: unknown;
    model: string | null;
    operationVersion: string | null;
    promptVersion: string | null;
    schemaVersion: string | null;
  }[] = [
    {
      kind: 'trim',
      payload: trim,
      model: null,
      operationVersion: 'OT-TRIM-1',
      promptVersion: null,
      schemaVersion: null,
    },
    {
      kind: 'compressed_video',
      payload: {
        profileVersion: parentWelcomeMediaProfile.version,
        objectVersionId: media.objectVersionId,
        byteCount: media.byteCount,
        sha256: media.sha256,
        container: 'mp4',
        durationMs: manifest.assets.media.duration_ms,
        width: manifest.assets.media.width,
        height: manifest.assets.media.height,
        framesPerSecond: manifest.assets.media.frames_per_second,
        videoCodec: 'h264',
        pixelFormat: 'yuv420p',
        audioCodec: 'aac',
        audioProfile: 'LC',
        audioSampleRateHz: manifest.assets.media.audio_sample_rate_hz,
        audioChannels: 2,
        audioBitrateBps: 128_000,
        fastStart: true,
        decodeFailure: false,
        sourceMetadataRemoved: identity.mediaPrivacyMetadataRemoved,
      },
      model: null,
      operationVersion: 'OT-PARENT-WELCOME-MEDIA-1',
      promptVersion: null,
      schemaVersion: null,
    },
    {
      kind: 'transcript',
      payload: transcriptPayload,
      model: 'human-reviewed-local-faster-whisper',
      operationVersion: 'OT-PARENT-WELCOME-LOCAL-CAPTIONS-1',
      promptVersion: null,
      schemaVersion: 'OT-PARENT-WELCOME-TRANSCRIPT-1',
    },
    {
      kind: 'captions',
      payload: {
        format: 'webvtt',
        objectVersionId: captions.objectVersionId,
        payloadSha256: captions.sha256,
        humanReviewed: true,
      },
      model: 'human-reviewed-local-faster-whisper',
      operationVersion: 'OT-PARENT-WELCOME-LOCAL-CAPTIONS-1',
      promptVersion: null,
      schemaVersion: 'WEBVTT',
    },
    {
      kind: 'review_material',
      payload: {
        title: manifest.presentation.title,
        classTopic: manifest.presentation.class_topic,
        mishnahReferences: [],
        sourceReviewDigest: reviewedSourceDigest,
        posterObjectVersionId: poster.objectVersionId,
      },
      model: null,
      operationVersion: 'OT-PARENT-WELCOME-HUMAN-REVIEW-1',
      promptVersion: null,
      schemaVersion: 'OT-PARENT-WELCOME-REVIEW-1',
    },
    {
      kind: 'worksheet',
      payload: { notApplicable: true, reason: 'parent_welcome_orientation' },
      model: null,
      operationVersion: 'OT-PARENT-WELCOME-NOT-APPLICABLE-1',
      promptVersion: null,
      schemaVersion: null,
    },
    {
      kind: 'knowledge_artifact',
      payload: { notApplicable: true, reason: 'parent_welcome_orientation' },
      model: null,
      operationVersion: 'OT-PARENT-WELCOME-NOT-APPLICABLE-1',
      promptVersion: null,
      schemaVersion: null,
    },
  ];
  const processingArtifacts = artifactInputs.map((entry) => {
    const payloadDigest = sha256(JSON.stringify(entry.payload));
    return {
      accountKey: manifest.scope.account_key,
      productKey: PRODUCT_KEY,
      id: sha256(
        `${identity.contentVersionId}\0${entry.kind}\0revision-2\0${payloadDigest}\0${approvedAt}`,
      ),
      contentVersionId: identity.contentVersionId,
      kind: entry.kind,
      revision: 2,
      sourceId: identity.sourceKey,
      sourceSha256: manifest.drive_source.sha256,
      sourceObjectVersionId: identity.sourceObjectVersionId,
      status: 'approved',
      payloadDigest,
      payload: entry.payload,
      ...(entry.model ? { model: entry.model } : {}),
      ...(entry.operationVersion ? { operationVersion: entry.operationVersion } : {}),
      ...(entry.promptVersion ? { promptVersion: entry.promptVersion } : {}),
      ...(entry.schemaVersion ? { schemaVersion: entry.schemaVersion } : {}),
      approvedByAdminId: manifest.review.approved_by_admin_id,
      approvedAt,
      createdAt: approvedAt,
      updatedAt: approvedAt,
    } satisfies ProcessingArtifact;
  });
  const approvedArtifactSetDigest = publicationArtifactSetDigest(processingArtifacts);
  const sourceEvidenceDigest = sha256(
    JSON.stringify({
      accountKey: manifest.scope.account_key,
      productKey: PRODUCT_KEY,
      contentId: identity.contentId,
      contentVersionId: identity.contentVersionId,
      sourceId: identity.sourceKey,
      sourceSha256: manifest.drive_source.sha256,
      sourceObjectVersionId: identity.sourceObjectVersionId,
      captureEvidence,
      participantReview: undefined,
    }),
  );
  const contentVersionDigest = sha256(
    JSON.stringify({
      digestVersion: CONTENT_VERSION_DIGEST_VERSION,
      accountKey: manifest.scope.account_key,
      productKey: PRODUCT_KEY,
      contentId: identity.contentId,
      contentVersionId: identity.contentVersionId,
      sourceId: identity.sourceKey,
      sourceSha256: manifest.drive_source.sha256,
      sourceObjectVersionId: identity.sourceObjectVersionId,
      runtimeTier: manifest.scope.runtime_tier,
      trim,
      transcode: {
        profileVersion: transcodePlan.profile.version,
        targetWidth: transcodePlan.targetWidth,
        targetHeight: transcodePlan.targetHeight,
        targetFramesPerSecond: transcodePlan.targetFramesPerSecond,
        boundedMemory: true,
        replacesOriginal: false,
      },
      approvedArtifactSetDigest,
      sourceEvidenceDigest,
    }),
  );
  const processingVersion = {
    accountKey: manifest.scope.account_key,
    productKey: PRODUCT_KEY,
    id: identity.contentVersionId,
    contentId: identity.contentId,
    sourceId: identity.sourceKey,
    sourceSha256: manifest.drive_source.sha256,
    sourceObjectVersionId: identity.sourceObjectVersionId,
    runtimeTier: manifest.scope.runtime_tier,
    state: 'approved',
    retryState: 'ready',
    attemptCount: 0,
    trim,
    transcodePlan,
    artifacts: processingArtifacts,
    publicationApproval: {
      evidenceVersion: 'OT-EXISTING-REVIEWED-RECORDING-APPROVAL-1',
      reviewedSourceDigest,
      reviewKind: 'existing_reviewed_recording',
      existingRecordingEvidence: captureEvidence,
      approvedByAdminId: manifest.review.approved_by_admin_id,
      approvedAt,
      approvedArtifactSetDigest,
      sourceEvidenceDigest,
      contentVersionDigestVersion: CONTENT_VERSION_DIGEST_VERSION,
      contentVersionDigest,
    },
    version: 2,
    createdAt: approvedAt,
    updatedAt: approvedAt,
  } as const;
  const projectionArtifacts = [...processingArtifacts]
    .sort((left, right) => left.kind.localeCompare(right.kind))
    .map((artifact) => ({
      artifactId: artifact.id,
      kind: artifact.kind,
      revision: artifact.revision,
      payloadDigest: artifact.payloadDigest,
      model: artifact.model ?? null,
      operationVersion: artifact.operationVersion ?? null,
      promptVersion: artifact.promptVersion ?? null,
      schemaVersion: artifact.schemaVersion ?? null,
    }));
  const approvalEvidenceDigest = sha256(
    JSON.stringify({
      evidenceVersion: captureEvidence.evidenceVersion,
      sourceId: captureEvidence.sourceId,
      reviewedSourceDigest,
      attestation: captureEvidence.attestation,
    }),
  );
  const projectionCore = {
    accountKey: manifest.scope.account_key,
    productKey: PRODUCT_KEY,
    contentId: identity.contentId,
    contentVersionId: identity.contentVersionId,
    contentVersionDigest,
    sourceId: identity.sourceKey,
    sourceSha256: manifest.drive_source.sha256,
    sourceObjectVersionId: identity.sourceObjectVersionId,
    reviewKind: 'existing_reviewed_recording' as const,
    reviewedSourceDigest,
    reviewedByAdminId: manifest.review.approved_by_admin_id,
    reviewedAt,
    approvalEvidenceDigest,
    title: manifest.presentation.title,
    englishTranscriptText: captionText,
    classTopic: manifest.presentation.class_topic,
    mishnahReferences: [] as string[],
    occurredAt: approvedAt,
    durationMs: manifest.assets.media.duration_ms,
    approvedByAdminId: manifest.review.approved_by_admin_id,
    approvedAt,
    artifacts: projectionArtifacts,
    approvedArtifactSetDigest,
    sourceEvidenceDigest,
  };
  const evidence: ContentApprovalEvidence = {
    ...projectionCore,
    projectionDigest: sha256(JSON.stringify(projectionCore)),
  };
  const principal = {
    actorId: manifest.review.approved_by_admin_id,
    role: 'admin' as const,
    accountKey: manifest.scope.account_key,
    productKey: PRODUCT_KEY,
    householdId: 'parent_welcome_operation',
    studentId: null,
    sessionId: null,
    sessionVersion: null,
    accessState: 'active' as const,
  };
  const reviewReady = createReviewReadyContentFromProjection({ principal, evidence });
  const requestHash = sha256(
    JSON.stringify({
      operation: 'parent_welcome_publish_s3',
      contentId: identity.contentId,
      contentVersionId: identity.contentVersionId,
      projectionDigest: evidence.projectionDigest,
      assetSetDigest: identity.assetSetDigest,
    }),
  );
  const approved = approveContent({
    principal,
    record: reviewReady,
    approvalId: `parent_welcome_approval_${evidence.projectionDigest.slice(0, 48)}`,
    policyVersion: 'parent-welcome-protected-s3-v1',
    evidence,
    binding: {
      idempotencyKey: `${manifest.operation_id}:approve`,
      requestHash,
      expectedVersion: reviewReady.version,
      occurredAt: approvedAt,
    },
  });
  const publicationRecord: ContentPublicationRecord = {
    ...approved,
    version: approved.version + 1,
    state: 'published',
    publicationGeneration: 1,
    playbackGrantGeneration: approved.playbackGrantGeneration + 1,
    pendingProviderOperationId: null,
    pendingProviderRequestHash: null,
    opaqueProviderAssetRef: `parent_welcome_asset_set_${identity.assetSetDigest}`,
    providerReadbackDigest: identity.assetSetDigest,
    publishedAt,
    archivedAt: null,
    updatedAt: publishedAt,
  };
  const assets = boundAssetsInput.map((asset) => ({
    kind: asset.kind,
    objectKey: asset.objectKey,
    objectVersionId: asset.objectVersionId,
    byteCount: asset.byteCount,
    payloadSha256: asset.sha256,
    contentType: asset.contentType,
    width: asset.width,
    height: asset.height,
  }));
  const ingestReceipt = {
    accountKey: manifest.scope.account_key,
    productKey: PRODUCT_KEY,
    idempotencyKey: `${manifest.operation_id}:bind-drive-source`,
    requestHash,
    operation: 'parent_welcome:bind_reviewed_drive_source',
    resultRef: identity.sourceKey,
    resultVersion: 1,
    committedAt: publishedAt,
  };
  const processingReceipt = {
    accountKey: manifest.scope.account_key,
    productKey: PRODUCT_KEY,
    idempotencyKey: `${manifest.operation_id}:approve-processing-version`,
    requestHash,
    operation: 'approve_version',
    resultRef: identity.contentVersionId,
    resultVersion: 2,
    committedAt: publishedAt,
  };
  const publicationReceipt = {
    accountKey: manifest.scope.account_key,
    productKey: PRODUCT_KEY,
    operation: 'record_published',
    idempotencyKey: `${manifest.operation_id}:publish-parent-welcome`,
    requestHash,
    contentId: identity.contentId,
    contentVersionId: identity.contentVersionId,
    publicationGeneration: 1,
    approvalProjectionDigest: evidence.projectionDigest,
    committedAt: publishedAt,
  };
  const resultDigest = sha256(
    canonicalJson({
      operationId: manifest.operation_id,
      manifestDigest: parentWelcomeManifestDigest(manifest),
      sourceKey: identity.sourceKey,
      contentId: identity.contentId,
      contentVersionId: identity.contentVersionId,
      videoVersionId: identity.videoVersionId,
      approvalProjectionDigest: evidence.projectionDigest,
      assets: assets.map(({ kind, objectKey, objectVersionId, payloadSha256 }) => ({
        kind,
        objectKey,
        objectVersionId,
        payloadSha256,
      })),
    }),
  );
  return {
    scope: manifest.scope,
    operationId: manifest.operation_id,
    manifestDigest: parentWelcomeManifestDigest(manifest),
    authorizationPhraseSha256: manifest.authorization_phrase_sha256,
    authorizationBindingSha256: manifest.authorization_binding_sha256,
    resultDigest,
    sourceKey: identity.sourceKey,
    sourceSha256: manifest.drive_source.sha256,
    sourceObjectVersionId: identity.sourceObjectVersionId,
    sourceLinkKey: identity.sourceLinkKey,
    driveFileRefDigest: identity.driveFileRefDigest,
    driveRevisionDigest: identity.driveRevisionDigest,
    contentId: identity.contentId,
    contentVersionId: identity.contentVersionId,
    contentVersionDigest,
    videoVersionId: identity.videoVersionId,
    publicationGeneration: 1,
    approvalProjectionDigest: evidence.projectionDigest,
    approvedAt,
    publishedAt,
    title: manifest.presentation.title,
    durationMs: manifest.assets.media.duration_ms,
    width: manifest.assets.media.width,
    height: manifest.assets.media.height,
    sourceRecord,
    sourceLinkRecord,
    driveObservationRecord,
    captureEvidence,
    processingVersion,
    processingArtifacts,
    publicationRecord,
    ingestReceipt,
    processingReceipt,
    publicationReceipt,
    assets,
  };
}

function exactBoundAsset(assets: readonly BoundAsset[], kind: AssetKind) {
  const matches = assets.filter((asset) => asset.kind === kind);
  if (matches.length !== 1) throw safeError('asset_set_invalid');
  return matches[0]!;
}

function publicationArtifactSetDigest(artifacts: readonly ProcessingArtifact[]) {
  return sha256(
    JSON.stringify(
      [...artifacts]
        .sort((left, right) => left.kind.localeCompare(right.kind))
        .map((artifact) => ({
          artifactId: artifact.id,
          kind: artifact.kind,
          revision: artifact.revision,
          payloadDigest: artifact.payloadDigest,
          model: artifact.model ?? null,
          operationVersion: artifact.operationVersion ?? null,
          promptVersion: artifact.promptVersion ?? null,
          schemaVersion: artifact.schemaVersion ?? null,
          sourceId: artifact.sourceId,
          sourceSha256: artifact.sourceSha256,
          sourceObjectVersionId: artifact.sourceObjectVersionId,
          approvedByAdminId: artifact.approvedByAdminId,
          approvedAt: artifact.approvedAt,
        })),
    ),
  );
}

export function createAwsParentWelcomeObjectStore(input: {
  client: Pick<S3Client, 'send'>;
  bucketRef: string;
  kmsKeyArn: string;
  storageClass: 'STANDARD' | 'INTELLIGENT_TIERING';
}): ParentWelcomeObjectStore {
  return {
    async assertPrivateVersionedPolicy(expected) {
      if (
        expected.region !== 'eu-central-1' ||
        expected.bucketRef !== input.bucketRef ||
        expected.kmsKeyArn !== input.kmsKeyArn ||
        expected.storageClass !== input.storageClass
      ) {
        throw safeError('s3_private_versioned_policy_mismatch');
      }
      const [location, versioning, publicAccess, ownership, encryption] = await Promise.all([
        input.client.send(new GetBucketLocationCommand({ Bucket: input.bucketRef })),
        input.client.send(new GetBucketVersioningCommand({ Bucket: input.bucketRef })),
        input.client.send(new GetPublicAccessBlockCommand({ Bucket: input.bucketRef })),
        input.client.send(new GetBucketOwnershipControlsCommand({ Bucket: input.bucketRef })),
        input.client.send(new GetBucketEncryptionCommand({ Bucket: input.bucketRef })),
      ]);
      const publicPolicy = publicAccess.PublicAccessBlockConfiguration;
      const ownershipRules = ownership.OwnershipControls?.Rules ?? [];
      const encryptionRules = encryption.ServerSideEncryptionConfiguration?.Rules ?? [];
      const exactKmsRule = encryptionRules.some(
        (rule) =>
          rule.ApplyServerSideEncryptionByDefault?.SSEAlgorithm === 'aws:kms' &&
          rule.ApplyServerSideEncryptionByDefault.KMSMasterKeyID === input.kmsKeyArn,
      );
      if (
        location.LocationConstraint !== 'eu-central-1' ||
        versioning.Status !== 'Enabled' ||
        publicPolicy?.BlockPublicAcls !== true ||
        publicPolicy.IgnorePublicAcls !== true ||
        publicPolicy.BlockPublicPolicy !== true ||
        publicPolicy.RestrictPublicBuckets !== true ||
        ownershipRules.length !== 1 ||
        ownershipRules[0]?.ObjectOwnership !== 'BucketOwnerEnforced' ||
        !exactKmsRule
      ) {
        throw safeError('s3_private_versioned_policy_mismatch');
      }
    },

    async inspect(asset) {
      const listed = await input.client.send(
        new ListObjectVersionsCommand({
          Bucket: input.bucketRef,
          Prefix: asset.objectKey,
          MaxKeys: 5,
        }),
      );
      if (listed.IsTruncated) return { state: 'ambiguous' };
      const versions = (listed.Versions ?? []).filter(
        (version) => version.Key === asset.objectKey && Boolean(version.VersionId),
      );
      const deleteMarkers = (listed.DeleteMarkers ?? []).filter(
        (marker) => marker.Key === asset.objectKey,
      );
      if (versions.length === 0 && deleteMarkers.length === 0) return { state: 'absent' };
      if (versions.length !== 1 || deleteMarkers.length !== 0) return { state: 'ambiguous' };
      const versionId = versions[0]!.VersionId!;
      const head = await input.client.send(
        new HeadObjectCommand({
          Bucket: input.bucketRef,
          Key: asset.objectKey,
          VersionId: versionId,
          ChecksumMode: 'ENABLED',
        }),
      );
      if (
        head.VersionId !== versionId ||
        head.ContentLength !== asset.byteCount ||
        head.ContentType !== asset.contentType ||
        head.ServerSideEncryption !== 'aws:kms' ||
        head.SSEKMSKeyId !== input.kmsKeyArn ||
        (head.StorageClass ?? 'STANDARD') !== input.storageClass ||
        head.ChecksumSHA256 !== Buffer.from(asset.sha256, 'hex').toString('base64') ||
        head.Metadata?.['ot-asset-kind'] !== asset.kind ||
        head.Metadata?.['ot-payload-sha256'] !== asset.sha256 ||
        head.Metadata?.['ot-byte-count'] !== String(asset.byteCount)
      ) {
        return { state: 'mismatch', versionId };
      }
      const object = await input.client.send(
        new GetObjectCommand({
          Bucket: input.bucketRef,
          Key: asset.objectKey,
          VersionId: versionId,
          ChecksumMode: 'ENABLED',
        }),
      );
      if (
        !object.Body ||
        object.VersionId !== versionId ||
        object.ContentLength !== asset.byteCount ||
        object.ContentType !== asset.contentType
      ) {
        discardBody(object.Body);
        return { state: 'mismatch', versionId };
      }
      const measured = await bodySha256(object.Body as AsyncIterable<Uint8Array>);
      if (measured.sha256 !== asset.sha256 || measured.byteCount !== asset.byteCount) {
        return { state: 'mismatch', versionId };
      }
      return { state: 'exact', versionId };
    },

    async putOnce(asset) {
      const uploaded = await input.client.send(
        new PutObjectCommand({
          Bucket: input.bucketRef,
          Key: asset.objectKey,
          IfNoneMatch: '*',
          Body: createReadStream(asset.localPath),
          ContentLength: asset.byteCount,
          ContentType: asset.contentType,
          ChecksumSHA256: Buffer.from(asset.sha256, 'hex').toString('base64'),
          ServerSideEncryption: 'aws:kms',
          SSEKMSKeyId: input.kmsKeyArn,
          StorageClass: input.storageClass,
          Metadata: {
            'ot-asset-kind': asset.kind,
            'ot-payload-sha256': asset.sha256,
            'ot-byte-count': String(asset.byteCount),
            'ot-evidence-version': 'parent-welcome-protected-s3-v1',
          },
        }),
      );
      if (!uploaded.VersionId) throw safeError('s3_upload_version_missing');
      return { versionId: uploaded.VersionId };
    },

    async deleteExactVersion(asset) {
      await input.client.send(
        new DeleteObjectCommand({
          Bucket: input.bucketRef,
          Key: asset.objectKey,
          VersionId: asset.versionId,
        }),
      );
    },
  };
}

async function bodySha256(body: AsyncIterable<Uint8Array>) {
  const hash = createHash('sha256');
  let byteCount = 0;
  for await (const chunk of body) {
    hash.update(chunk);
    byteCount += chunk.byteLength;
  }
  return { sha256: hash.digest('hex'), byteCount };
}

function discardBody(body: unknown) {
  (body as { destroy?: () => void } | undefined)?.destroy?.();
}

export function createPostgresParentWelcomeBindingRepository(
  pool: DbPool,
): ParentWelcomeBindingRepository {
  return {
    async withOperationLock(_input, work) {
      const client = await pool.connect();
      let acquired = false;
      try {
        const lock = await client.query<{ acquired: boolean }>(
          'SELECT pg_try_advisory_lock($1) AS acquired',
          [OPERATION_LOCK_ID],
        );
        acquired = lock.rows[0]?.acquired === true;
        if (!acquired) throw safeError('operation_lock_busy');
        return await work();
      } finally {
        if (!acquired) {
          client.release(true);
        } else {
          try {
            const released = await client.query<{ released: boolean }>(
              'SELECT pg_advisory_unlock($1) AS released',
              [OPERATION_LOCK_ID],
            );
            client.release(released.rows[0]?.released !== true);
          } catch {
            client.release(true);
          }
        }
      }
    },

    async consumeAuthorization(input) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const inserted = await client.query(
          `INSERT INTO onetime.parent_welcome_binding_authorizations_v21 (
             authorization_phrase_sha256, operation_id, manifest_digest,
             authorization_binding_sha256, account_key, product_key, runtime_tier,
             verification_environment_id, consumed_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz)
           ON CONFLICT DO NOTHING RETURNING operation_id`,
          [
            input.authorizationPhraseSha256,
            input.operationId,
            input.manifestDigest,
            input.authorizationBindingSha256,
            input.scope.account_key,
            input.scope.product_key,
            input.scope.runtime_tier,
            input.scope.verification_environment_id,
            input.consumedAt,
          ],
        );
        const state = await authorizationState(client, input);
        if (state === 'unseen') throw safeError('authorization_claim_readback_failed');
        await client.query('COMMIT');
        if (inserted.rows.length === 1) return 'claimed';
        return state === 'claimed' ? 'consumed' : state;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // The caller performs one read-only reconciliation and never retries.
        }
        throw error;
      } finally {
        client.release();
      }
    },

    async reconcileAuthorization(input) {
      const client = await pool.connect();
      try {
        return await authorizationState(client, input);
      } finally {
        client.release();
      }
    },

    async reconcileCommittedOperation(input) {
      const exact = await pool.query(
        `SELECT 1
           FROM onetime.parent_welcome_binding_operation_results_v21 AS result
           JOIN onetime.parent_welcome_binding_authorizations_v21 AS binding_auth
             ON binding_auth.operation_id = result.operation_id
          WHERE result.operation_id=$1 AND result.manifest_digest=$2
            AND binding_auth.operation_id=$1 AND binding_auth.manifest_digest=$2`,
        [input.operationId, input.manifestDigest],
      );
      if (exact.rows.length === 1) return 'exact';
      const any = await pool.query(
        `SELECT 1 FROM onetime.parent_welcome_binding_authorizations_v21
          WHERE operation_id=$1 OR manifest_digest=$2 LIMIT 2`,
        [input.operationId, input.manifestDigest],
      );
      return any.rows.length > 0 ? 'conflict' : 'absent';
    },

    async preflight(input) {
      const result = await pool.query(
        `SELECT video_version_id
           FROM onetime.parent_welcome_video_slots_v21
          WHERE account_key = $1 AND product_key = $2 AND runtime_tier = $3
            AND verification_environment_id = $4
            AND slot_key = 'parent_companion_welcome' AND state = 'approved'
          LIMIT 2`,
        [
          input.scope.account_key,
          input.scope.product_key,
          input.scope.runtime_tier,
          input.scope.verification_environment_id,
        ],
      );
      if (result.rows.length === 0) return { state: 'absent' };
      if (
        result.rows.length === 1 &&
        String(result.rows[0]?.video_version_id) === input.videoVersionId
      ) {
        return { state: 'candidate' };
      }
      return { state: 'conflict' };
    },

    async reconcile(plan) {
      const client = await pool.connect();
      try {
        return await reconcilePlan(client, plan);
      } finally {
        client.release();
      }
    },

    async apply(plan) {
      const client = await pool.connect();
      let commitAttempted = false;
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock($1)', [COMMAND_LOCK_ID]);
        const existing = await reconcilePlan(client, plan);
        if (existing === 'exact') {
          commitAttempted = true;
          await client.query('COMMIT');
          return 'replayed';
        }
        if (existing === 'conflict') throw safeError('database_binding_conflict');
        const claimState = await authorizationState(client, {
          operationId: plan.operationId,
          manifestDigest: plan.manifestDigest,
          authorizationPhraseSha256: plan.authorizationPhraseSha256,
          authorizationBindingSha256: plan.authorizationBindingSha256,
          scope: plan.scope,
          consumedAt: plan.publishedAt,
        });
        if (claimState !== 'claimed') throw safeError('authorization_claim_not_owned');
        await insertPlan(client, plan);
        await insertOperationResult(client, plan);
        if ((await reconcilePlan(client, plan)) !== 'exact') {
          throw safeError('database_exact_readback_failed');
        }
        commitAttempted = true;
        await client.query('COMMIT');
        return 'applied';
      } catch (error) {
        let rollbackProven = false;
        try {
          await client.query('ROLLBACK');
          rollbackProven = true;
        } catch {
          // Reconciliation by the caller determines whether COMMIT was accepted.
        }
        if (!commitAttempted && rollbackProven) return 'precommit_failure';
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

async function authorizationState(
  client: OperationSqlClient,
  input: ParentWelcomeAuthorizationClaim,
): Promise<'unseen' | 'claimed' | 'committed_replay' | 'conflict'> {
  const rows = await client.query(
    `SELECT binding_auth.authorization_phrase_sha256,
            binding_auth.operation_id,
            binding_auth.manifest_digest,
            binding_auth.authorization_binding_sha256,
            binding_auth.account_key,
            binding_auth.product_key,
            binding_auth.runtime_tier,
            binding_auth.verification_environment_id,
            result.manifest_digest AS result_manifest_digest
       FROM onetime.parent_welcome_binding_authorizations_v21 AS binding_auth
       LEFT JOIN onetime.parent_welcome_binding_operation_results_v21 AS result
         ON result.operation_id = binding_auth.operation_id
      WHERE binding_auth.authorization_phrase_sha256=$1
         OR binding_auth.operation_id=$2
      LIMIT 2`,
    [input.authorizationPhraseSha256, input.operationId],
  );
  if (rows.rows.length === 0) return 'unseen';
  if (rows.rows.length !== 1) return 'conflict';
  const row = rows.rows[0]!;
  if (
    row.authorization_phrase_sha256 !== input.authorizationPhraseSha256 ||
    row.operation_id !== input.operationId ||
    row.manifest_digest !== input.manifestDigest ||
    row.authorization_binding_sha256 !== input.authorizationBindingSha256 ||
    row.account_key !== input.scope.account_key ||
    row.product_key !== input.scope.product_key ||
    row.runtime_tier !== input.scope.runtime_tier ||
    row.verification_environment_id !== input.scope.verification_environment_id
  ) {
    return 'conflict';
  }
  if (row.result_manifest_digest === null || row.result_manifest_digest === undefined) {
    return 'claimed';
  }
  return row.result_manifest_digest === input.manifestDigest ? 'committed_replay' : 'conflict';
}

type OperationSqlClient = {
  query(
    sql: string,
    values?: readonly unknown[],
  ): Promise<{ rows: readonly Record<string, unknown>[] }>;
};

async function reconcilePlan(
  client: OperationSqlClient,
  plan: ParentWelcomeBindingPlan,
): Promise<'absent' | 'exact' | 'conflict'> {
  const checks: Array<() => Promise<boolean>> = [
    () =>
      exactJsonRow(
        client,
        `SELECT 1 FROM onetime.parent_welcome_binding_operation_results_v21
          WHERE operation_id=$1 AND manifest_digest=$2 AND result_digest=$3
            AND committed_at=$4::timestamptz`,
        [plan.operationId, plan.manifestDigest, plan.resultDigest, plan.publishedAt],
      ),
    () =>
      exactJsonRow(
        client,
        `SELECT 1 FROM onetime.content_sources_v21
        WHERE account_key=$1 AND product_key=$2 AND source_key=$3
          AND source_sha256=$4 AND source_kind='drive' AND lifecycle_state='published'
          AND object_version_id=$5 AND byte_count=$6 AND original_preserved=TRUE
          AND version=1 AND record_json=$7::jsonb`,
        [
          plan.scope.account_key,
          PRODUCT_KEY,
          plan.sourceKey,
          plan.sourceSha256,
          plan.sourceObjectVersionId,
          Number(plan.sourceRecord.byteCount),
          JSON.stringify(plan.sourceRecord),
        ],
      ),
    () =>
      exactJsonRow(
        client,
        `SELECT 1 FROM onetime.content_source_links_v21
        WHERE account_key=$1 AND product_key=$2 AND source_link_key=$3
          AND source_key=$4 AND source_kind='drive' AND provenance_ref_digest=$5
          AND provider_change_marker=$6 AND record_json=$7::jsonb`,
        [
          plan.scope.account_key,
          PRODUCT_KEY,
          plan.sourceLinkKey,
          plan.sourceKey,
          plan.driveFileRefDigest,
          plan.driveRevisionDigest,
          JSON.stringify(plan.sourceLinkRecord),
        ],
      ),
    () =>
      exactJsonRow(
        client,
        `SELECT 1 FROM onetime.content_drive_observations
        WHERE account_key=$1 AND product_key=$2 AND drive_file_ref_digest=$3
          AND change_marker=$4 AND drive_state='processed' AND byte_count=$5
          AND version=1 AND record_json=$6::jsonb`,
        [
          plan.scope.account_key,
          PRODUCT_KEY,
          plan.driveFileRefDigest,
          plan.driveRevisionDigest,
          Number(plan.driveObservationRecord.byteCount),
          JSON.stringify(plan.driveObservationRecord),
        ],
      ),
    () =>
      exactJsonRow(
        client,
        `SELECT 1 FROM onetime.content_processing_capture_evidence
        WHERE account_key=$1 AND product_key=$2 AND source_key=$3
          AND evidence_version='OT-EXISTING-REVIEWED-RECORDING-1'
          AND participant_snapshot_digest IS NULL AND source_review_digest=$4
          AND checksum_readback_receipt_key=$5 AND linked_ingest_source_key=$3
          AND record_json=$6::jsonb`,
        [
          plan.scope.account_key,
          PRODUCT_KEY,
          plan.sourceKey,
          String(plan.captureEvidence.reviewedSourceDigest),
          String(plan.captureEvidence.durableChecksumReadbackReceiptId),
          JSON.stringify(plan.captureEvidence),
        ],
      ),
    () =>
      exactJsonRow(
        client,
        `SELECT 1 FROM onetime.content_processing_versions
        WHERE account_key=$1 AND product_key=$2 AND content_version_key=$3
          AND source_key=$4 AND source_sha256=$5 AND source_object_version_id=$6
          AND processing_state='approved' AND retry_state='ready'
          AND attempt_count=0 AND version=2 AND record_json=$7::jsonb`,
        [
          plan.scope.account_key,
          PRODUCT_KEY,
          plan.contentVersionId,
          plan.sourceKey,
          plan.sourceSha256,
          plan.sourceObjectVersionId,
          JSON.stringify(plan.processingVersion),
        ],
      ),
    () =>
      exactJsonRow(
        client,
        `SELECT 1 FROM onetime.content_publications
        WHERE account_key=$1 AND product_key=$2 AND content_id=$3
          AND content_version_id=$4 AND content_version_digest=$5
          AND approval_projection_digest=$6 AND version=$7 AND state='published'
          AND publication_generation=1 AND pending_provider_operation_id IS NULL
          AND pending_provider_request_hash IS NULL AND record_json=$8::jsonb`,
        [
          plan.scope.account_key,
          PRODUCT_KEY,
          plan.contentId,
          plan.contentVersionId,
          plan.contentVersionDigest,
          plan.approvalProjectionDigest,
          plan.publicationRecord.version,
          JSON.stringify(plan.publicationRecord),
        ],
      ),
    () => exactSlotRow(client, plan),
    () => exactReceiptRows(client, plan),
  ];
  for (const artifact of plan.processingArtifacts) {
    checks.push(() => exactArtifactRow(client, artifact));
  }
  for (const asset of plan.assets) checks.push(() => exactAssetRow(client, plan, asset));
  const results: boolean[] = [];
  for (const check of checks) results.push(await check());
  const exactCount = results.filter(Boolean).length;
  if (exactCount === results.length) return 'exact';
  if (exactCount > 0) return 'conflict';
  const any = await anyPlanIdentity(client, plan);
  return any ? 'conflict' : 'absent';
}

async function exactJsonRow(client: OperationSqlClient, sql: string, values: readonly unknown[]) {
  const result = await client.query(sql, values);
  return result.rows.length === 1;
}

async function exactArtifactRow(client: OperationSqlClient, artifact: ProcessingArtifact) {
  return exactJsonRow(
    client,
    `SELECT 1 FROM onetime.content_processing_artifacts
      WHERE account_key=$1 AND product_key=$2 AND artifact_key=$3
        AND content_version_key=$4 AND artifact_kind=$5 AND artifact_revision=$6
        AND source_key=$7 AND source_sha256=$8 AND source_object_version_id=$9
        AND artifact_status='approved' AND payload_digest=$10 AND record_json=$11::jsonb`,
    [
      artifact.accountKey,
      artifact.productKey,
      artifact.id,
      artifact.contentVersionId,
      artifact.kind,
      artifact.revision,
      artifact.sourceId,
      artifact.sourceSha256,
      artifact.sourceObjectVersionId,
      artifact.payloadDigest,
      JSON.stringify(artifact),
    ],
  );
}

async function exactSlotRow(client: OperationSqlClient, plan: ParentWelcomeBindingPlan) {
  const result = await client.query(
    `SELECT 1 FROM onetime.parent_welcome_video_slots_v21
      WHERE account_key=$1 AND product_key=$2 AND runtime_tier=$3
        AND verification_environment_id=$4 AND slot_key='parent_companion_welcome'
        AND video_version_id=$5 AND content_id=$6 AND content_version_id=$7
        AND publication_generation=1 AND approval_projection_digest=$8
        AND title=$9 AND duration_ms=$10 AND width=$11 AND height=$12
        AND captions_available=TRUE AND poster_available=TRUE AND state='approved'
        AND approved_by_adult_id=$13 AND approved_at=$14::timestamptz
        AND revoked_at IS NULL`,
    [
      plan.scope.account_key,
      PRODUCT_KEY,
      plan.scope.runtime_tier,
      plan.scope.verification_environment_id,
      plan.videoVersionId,
      plan.contentId,
      plan.contentVersionId,
      plan.approvalProjectionDigest,
      plan.title,
      plan.durationMs,
      plan.width,
      plan.height,
      String(plan.publicationRecord.approval?.approvedByAdminId),
      plan.approvedAt,
    ],
  );
  return result.rows.length === 1;
}

async function exactAssetRow(
  client: OperationSqlClient,
  plan: ParentWelcomeBindingPlan,
  asset: ParentWelcomeBindingPlan['assets'][number],
) {
  const result = await client.query(
    `SELECT 1 FROM onetime.parent_welcome_video_assets_v21
      WHERE account_key=$1 AND product_key=$2 AND runtime_tier=$3
        AND verification_environment_id=$4 AND slot_key='parent_companion_welcome'
        AND video_version_id=$5 AND asset_kind=$6 AND source_key=$7
        AND source_sha256=$8 AND source_object_version_id=$9
        AND storage_provider='s3' AND bucket_ref=$10 AND object_key=$11
        AND object_version_id=$12 AND byte_count=$13 AND payload_sha256=$14
        AND content_type=$15 AND width IS NOT DISTINCT FROM $16
        AND height IS NOT DISTINCT FROM $17 AND state='approved'
        AND approved_by_adult_id=$18 AND approved_at=$19::timestamptz
        AND revoked_at IS NULL`,
    [
      plan.scope.account_key,
      PRODUCT_KEY,
      plan.scope.runtime_tier,
      plan.scope.verification_environment_id,
      plan.videoVersionId,
      asset.kind,
      plan.sourceKey,
      plan.sourceSha256,
      plan.sourceObjectVersionId,
      String(plan.sourceRecord.bucketRef),
      asset.objectKey,
      asset.objectVersionId,
      asset.byteCount,
      asset.payloadSha256,
      asset.contentType,
      asset.width,
      asset.height,
      String(plan.publicationRecord.approval?.approvedByAdminId),
      plan.approvedAt,
    ],
  );
  return result.rows.length === 1;
}

async function exactReceiptRows(client: OperationSqlClient, plan: ParentWelcomeBindingPlan) {
  const ingest = await exactJsonRow(
    client,
    `SELECT 1 FROM onetime.content_ingest_commands
        WHERE account_key=$1 AND product_key=$2 AND idempotency_key=$3
          AND request_hash=$4 AND operation=$5 AND result_ref=$6
          AND result_version=1 AND record_json=$7::jsonb`,
    [
      plan.scope.account_key,
      PRODUCT_KEY,
      String(plan.ingestReceipt.idempotencyKey),
      String(plan.ingestReceipt.requestHash),
      String(plan.ingestReceipt.operation),
      plan.sourceKey,
      JSON.stringify(plan.ingestReceipt),
    ],
  );
  const processing = await exactJsonRow(
    client,
    `SELECT 1 FROM onetime.content_processing_commands
        WHERE account_key=$1 AND product_key=$2 AND idempotency_key=$3
          AND request_hash=$4 AND operation='approve_version' AND result_ref=$5
          AND result_version=2 AND record_json=$6::jsonb`,
    [
      plan.scope.account_key,
      PRODUCT_KEY,
      String(plan.processingReceipt.idempotencyKey),
      String(plan.processingReceipt.requestHash),
      plan.contentVersionId,
      JSON.stringify(plan.processingReceipt),
    ],
  );
  const publication = await exactJsonRow(
    client,
    `SELECT 1 FROM onetime.content_publication_receipts
        WHERE account_key=$1 AND product_key=$2 AND operation='record_published'
          AND idempotency_key=$3 AND request_hash=$4 AND content_id=$5
          AND content_version_id=$6 AND publication_generation=1
          AND approval_projection_digest=$7 AND receipt_json=$8::jsonb`,
    [
      plan.scope.account_key,
      PRODUCT_KEY,
      String(plan.publicationReceipt.idempotencyKey),
      String(plan.publicationReceipt.requestHash),
      plan.contentId,
      plan.contentVersionId,
      plan.approvalProjectionDigest,
      JSON.stringify(plan.publicationReceipt),
    ],
  );
  return ingest && processing && publication;
}

async function anyPlanIdentity(client: OperationSqlClient, plan: ParentWelcomeBindingPlan) {
  const result = await client.query(
    `SELECT EXISTS(
       SELECT 1 FROM onetime.parent_welcome_video_slots_v21
        WHERE account_key=$1 AND product_key=$2 AND runtime_tier=$3
          AND verification_environment_id=$4 AND state='approved'
     ) OR EXISTS(
       SELECT 1 FROM onetime.content_sources_v21
        WHERE account_key=$1 AND product_key=$2
          AND (source_key=$5 OR source_sha256=$6)
     ) OR EXISTS(
       SELECT 1 FROM onetime.content_processing_versions
        WHERE account_key=$1 AND product_key=$2 AND content_version_key=$7
     ) OR EXISTS(
       SELECT 1 FROM onetime.content_publications
        WHERE account_key=$1 AND product_key=$2 AND content_id=$8
     ) AS present`,
    [
      plan.scope.account_key,
      PRODUCT_KEY,
      plan.scope.runtime_tier,
      plan.scope.verification_environment_id,
      plan.sourceKey,
      plan.sourceSha256,
      plan.contentVersionId,
      plan.contentId,
    ],
  );
  return result.rows[0]?.present === true;
}

async function insertPlan(client: OperationSqlClient, plan: ParentWelcomeBindingPlan) {
  await client.query(
    `INSERT INTO onetime.content_sources_v21 (
       source_key, account_key, product_key, source_sha256, source_kind,
       lifecycle_state, object_version_id, byte_count, original_preserved,
       version, record_json, updated_at
     ) VALUES ($1,$2,$3,$4,'drive','published',$5,$6,TRUE,1,$7::jsonb,$8::timestamptz)
     ON CONFLICT DO NOTHING`,
    [
      plan.sourceKey,
      plan.scope.account_key,
      PRODUCT_KEY,
      plan.sourceSha256,
      plan.sourceObjectVersionId,
      Number(plan.sourceRecord.byteCount),
      JSON.stringify(plan.sourceRecord),
      plan.publishedAt,
    ],
  );
  await requireExact(
    client,
    `SELECT 1 FROM onetime.content_sources_v21
      WHERE account_key=$1 AND product_key=$2 AND source_key=$3
        AND source_sha256=$4 AND source_kind='drive' AND lifecycle_state='published'
        AND object_version_id=$5 AND byte_count=$6 AND original_preserved=TRUE
        AND version=1 AND record_json=$7::jsonb`,
    [
      plan.scope.account_key,
      PRODUCT_KEY,
      plan.sourceKey,
      plan.sourceSha256,
      plan.sourceObjectVersionId,
      Number(plan.sourceRecord.byteCount),
      JSON.stringify(plan.sourceRecord),
    ],
  );

  await client.query(
    `INSERT INTO onetime.content_source_links_v21 (
       source_link_key, account_key, product_key, source_key, source_kind,
       provenance_ref_digest, provider_change_marker, record_json
     ) VALUES ($1,$2,$3,$4,'drive',$5,$6,$7::jsonb)
     ON CONFLICT DO NOTHING`,
    [
      plan.sourceLinkKey,
      plan.scope.account_key,
      PRODUCT_KEY,
      plan.sourceKey,
      plan.driveFileRefDigest,
      plan.driveRevisionDigest,
      JSON.stringify(plan.sourceLinkRecord),
    ],
  );
  await client.query(
    `INSERT INTO onetime.content_drive_observations (
       account_key, product_key, drive_file_ref_digest, parent_folder_ref_digest,
       drive_state, change_marker, byte_count, version, record_json, updated_at
     ) VALUES ($1,$2,$3,$4,'processed',$5,$6,1,$7::jsonb,$8::timestamptz)
     ON CONFLICT DO NOTHING`,
    [
      plan.scope.account_key,
      PRODUCT_KEY,
      plan.driveFileRefDigest,
      String(plan.driveObservationRecord.parentFolderRefDigest),
      plan.driveRevisionDigest,
      Number(plan.driveObservationRecord.byteCount),
      JSON.stringify(plan.driveObservationRecord),
      plan.publishedAt,
    ],
  );
  await client.query(
    `INSERT INTO onetime.content_ingest_commands (
       account_key, product_key, idempotency_key, request_hash, operation,
       result_ref, result_version, record_json, committed_at
     ) VALUES ($1,$2,$3,$4,$5,$6,1,$7::jsonb,$8::timestamptz)
     ON CONFLICT DO NOTHING`,
    [
      plan.scope.account_key,
      PRODUCT_KEY,
      String(plan.ingestReceipt.idempotencyKey),
      String(plan.ingestReceipt.requestHash),
      String(plan.ingestReceipt.operation),
      plan.sourceKey,
      JSON.stringify(plan.ingestReceipt),
      plan.publishedAt,
    ],
  );

  await client.query(
    `INSERT INTO onetime.content_processing_capture_evidence (
       account_key, product_key, source_key, evidence_version,
       participant_snapshot_digest, source_review_digest,
       checksum_readback_receipt_key, linked_ingest_source_key, record_json,
       captured_at, upload_confirmed_at
     ) VALUES (
       $1,$2,$3,'OT-EXISTING-REVIEWED-RECORDING-1',NULL,$4,$5,$3,
       $6::jsonb,$7::timestamptz,$8::timestamptz
     ) ON CONFLICT DO NOTHING`,
    [
      plan.scope.account_key,
      PRODUCT_KEY,
      plan.sourceKey,
      String(plan.captureEvidence.reviewedSourceDigest),
      String(plan.captureEvidence.durableChecksumReadbackReceiptId),
      JSON.stringify(plan.captureEvidence),
      String(
        plan.captureEvidence.attestation &&
          (plan.captureEvidence.attestation as Record<string, unknown>).humanReviewedAt,
      ),
      String(plan.captureEvidence.uploadConfirmedAt),
    ],
  );
  await client.query(
    `INSERT INTO onetime.content_processing_versions (
       content_version_key, account_key, product_key, source_key, source_sha256,
       source_object_version_id, processing_state, retry_state, attempt_count,
       version, record_json, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,'approved','ready',0,2,$7::jsonb,$8)
     ON CONFLICT DO NOTHING`,
    [
      plan.contentVersionId,
      plan.scope.account_key,
      PRODUCT_KEY,
      plan.sourceKey,
      plan.sourceSha256,
      plan.sourceObjectVersionId,
      JSON.stringify(plan.processingVersion),
      plan.approvedAt,
    ],
  );
  for (const artifact of plan.processingArtifacts) {
    await client.query(
      `INSERT INTO onetime.content_processing_artifacts (
         artifact_key, account_key, product_key, content_version_key, artifact_kind,
         artifact_revision, source_key, source_sha256, source_object_version_id,
         artifact_status, payload_digest, record_json, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'approved',$10,$11::jsonb,$12,$13)
       ON CONFLICT DO NOTHING`,
      [
        artifact.id,
        artifact.accountKey,
        artifact.productKey,
        artifact.contentVersionId,
        artifact.kind,
        artifact.revision,
        artifact.sourceId,
        artifact.sourceSha256,
        artifact.sourceObjectVersionId,
        artifact.payloadDigest,
        JSON.stringify(artifact),
        artifact.createdAt,
        artifact.updatedAt,
      ],
    );
  }
  await client.query(
    `INSERT INTO onetime.content_processing_commands (
       account_key, product_key, idempotency_key, request_hash, operation,
       result_ref, result_version, record_json, committed_at
     ) VALUES ($1,$2,$3,$4,'approve_version',$5,2,$6::jsonb,$7)
     ON CONFLICT DO NOTHING`,
    [
      plan.scope.account_key,
      PRODUCT_KEY,
      String(plan.processingReceipt.idempotencyKey),
      String(plan.processingReceipt.requestHash),
      plan.contentVersionId,
      JSON.stringify(plan.processingReceipt),
      plan.publishedAt,
    ],
  );

  await client.query(
    `INSERT INTO onetime.content_publications (
       account_key, product_key, content_id, content_version_id,
       content_version_digest, approval_projection_digest,
       approval_projection_json, version, state, publication_generation,
       playback_grant_generation, pending_provider_operation_id,
       pending_provider_request_hash, occurred_at, record_json, updated_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7::jsonb,$8,'published',1,$9,NULL,NULL,
       $10::timestamptz,$11::jsonb,$12::timestamptz
     ) ON CONFLICT DO NOTHING`,
    [
      plan.scope.account_key,
      PRODUCT_KEY,
      plan.contentId,
      plan.contentVersionId,
      plan.contentVersionDigest,
      plan.approvalProjectionDigest,
      JSON.stringify(plan.publicationRecord.approval?.evidence),
      plan.publicationRecord.version,
      plan.publicationRecord.playbackGrantGeneration,
      plan.publicationRecord.occurredAt,
      JSON.stringify(plan.publicationRecord),
      plan.publishedAt,
    ],
  );
  await client.query(
    `INSERT INTO onetime.content_publication_receipts (
       account_key, product_key, operation, idempotency_key, request_hash,
       content_id, content_version_id, publication_generation,
       approval_projection_digest, receipt_json, committed_at
     ) VALUES (
       $1,$2,'record_published',$3,$4,$5,$6,1,$7,$8::jsonb,$9
     ) ON CONFLICT DO NOTHING`,
    [
      plan.scope.account_key,
      PRODUCT_KEY,
      String(plan.publicationReceipt.idempotencyKey),
      String(plan.publicationReceipt.requestHash),
      plan.contentId,
      plan.contentVersionId,
      plan.approvalProjectionDigest,
      JSON.stringify(plan.publicationReceipt),
      plan.publishedAt,
    ],
  );

  const approvedBy = String(plan.publicationRecord.approval?.approvedByAdminId);
  await client.query(
    `INSERT INTO onetime.parent_welcome_video_slots_v21 (
       account_key, product_key, runtime_tier, verification_environment_id,
       slot_key, video_version_id, content_id, content_version_id,
       publication_generation, approval_projection_digest, title, duration_ms,
       width, height, captions_available, poster_available, state,
       approved_by_adult_id, approved_at, revoked_at
     ) VALUES (
       $1,$2,$3,$4,'parent_companion_welcome',$5,$6,$7,1,$8,$9,$10,$11,$12,
       TRUE,TRUE,'approved',$13,$14::timestamptz,NULL
     ) ON CONFLICT DO NOTHING`,
    [
      plan.scope.account_key,
      PRODUCT_KEY,
      plan.scope.runtime_tier,
      plan.scope.verification_environment_id,
      plan.videoVersionId,
      plan.contentId,
      plan.contentVersionId,
      plan.approvalProjectionDigest,
      plan.title,
      plan.durationMs,
      plan.width,
      plan.height,
      approvedBy,
      plan.approvedAt,
    ],
  );
  for (const asset of plan.assets) {
    await client.query(
      `INSERT INTO onetime.parent_welcome_video_assets_v21 (
         account_key, product_key, runtime_tier, verification_environment_id,
         slot_key, video_version_id, asset_kind, source_key, source_sha256,
         source_object_version_id, storage_provider, bucket_ref, object_key,
         object_version_id, byte_count, payload_sha256, content_type, width,
         height, state, approved_by_adult_id, approved_at, revoked_at
       ) VALUES (
         $1,$2,$3,$4,'parent_companion_welcome',$5,$6,$7,$8,$9,'s3',$10,$11,
         $12,$13,$14,$15,$16,$17,'approved',$18,$19::timestamptz,NULL
       ) ON CONFLICT DO NOTHING`,
      [
        plan.scope.account_key,
        PRODUCT_KEY,
        plan.scope.runtime_tier,
        plan.scope.verification_environment_id,
        plan.videoVersionId,
        asset.kind,
        plan.sourceKey,
        plan.sourceSha256,
        plan.sourceObjectVersionId,
        String(plan.sourceRecord.bucketRef),
        asset.objectKey,
        asset.objectVersionId,
        asset.byteCount,
        asset.payloadSha256,
        asset.contentType,
        asset.width,
        asset.height,
        approvedBy,
        plan.approvedAt,
      ],
    );
  }
}

async function insertOperationResult(client: OperationSqlClient, plan: ParentWelcomeBindingPlan) {
  await client.query(
    `INSERT INTO onetime.parent_welcome_binding_operation_results_v21 (
       operation_id, manifest_digest, result_digest, committed_at
     ) VALUES ($1,$2,$3,$4::timestamptz)
     ON CONFLICT DO NOTHING`,
    [plan.operationId, plan.manifestDigest, plan.resultDigest, plan.publishedAt],
  );
  await requireExact(
    client,
    `SELECT 1 FROM onetime.parent_welcome_binding_operation_results_v21
      WHERE operation_id=$1 AND manifest_digest=$2 AND result_digest=$3
        AND committed_at=$4::timestamptz`,
    [plan.operationId, plan.manifestDigest, plan.resultDigest, plan.publishedAt],
  );
}

async function requireExact(client: OperationSqlClient, sql: string, values: readonly unknown[]) {
  if (!(await exactJsonRow(client, sql, values))) throw safeError('database_binding_conflict');
}

async function fileSha256(filePath: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

function sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

export function parentWelcomeManifestDigest(manifestInput: unknown) {
  const manifest = manifestSchema.parse(manifestInput);
  const boundManifest = Object.fromEntries(
    Object.entries(manifest).filter(([key]) => key !== 'authorization_binding_sha256'),
  );
  return sha256(canonicalJson(boundManifest));
}

export function parentWelcomeAuthorizationBindingSha256(
  manifestInput: unknown,
  authorizationPhrase: string,
) {
  return createHmac('sha256', authorizationPhrase)
    .update('parent-welcome-binding-authorization-v1')
    .update('\0')
    .update(parentWelcomeManifestDigest(manifestInput))
    .digest('hex');
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
}

function sha256Equals(value: string, expectedHex: string) {
  const actual = Buffer.from(sha256(value), 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function sha256HexEquals(actualHex: string, expectedHex: string) {
  const actual = Buffer.from(actualHex, 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

class SafeOperationError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function safeError(code: string) {
  return new SafeOperationError(code);
}

function safeCode(error: unknown, fallback: string) {
  return error instanceof SafeOperationError ? error.code : fallback;
}

type ProbeCommandResult = { exitCode: number; stdout: string };

export function createProductionParentWelcomeMediaProbe(input?: {
  runCommand?: (executable: string, args: readonly string[]) => Promise<ProbeCommandResult>;
  decodePoster?: (filePath: string) => Promise<ParentWelcomePosterEvidence>;
}): ParentWelcomeMediaProbe {
  const runCommand = input?.runCommand ?? runProbeCommand;
  const decodePoster =
    input?.decodePoster ??
    (async (filePath: string) => {
      const image = sharp(filePath, {
        failOn: 'error',
        limitInputPixels: OT_VIDEO_1_PROFILE.maxWidth * OT_VIDEO_1_PROFILE.maxHeight,
      });
      const metadata = await image.metadata();
      const decoded = await image.rotate().raw().toBuffer({ resolveWithObject: true });
      if (
        !metadata.format ||
        !['jpeg', 'png', 'webp'].includes(metadata.format) ||
        !decoded.info.width ||
        !decoded.info.height
      ) {
        throw safeError('poster_decode_failed');
      }
      if (!posterPrivacyMetadataIsRemoved(metadata)) {
        throw safeError('poster_metadata_present');
      }
      return {
        format: metadata.format as ParentWelcomePosterEvidence['format'],
        width: decoded.info.width,
        height: decoded.info.height,
        decoded: true as const,
        privacyMetadataRemoved: true as const,
      };
    });
  return {
    async inspectMedia(filePath) {
      const probe = await runCommand('ffprobe', [
        '-v',
        'error',
        '-show_format',
        '-show_streams',
        '-show_chapters',
        '-of',
        'json',
        filePath,
      ]);
      if (probe.exitCode !== 0) throw safeError('media_probe_failed');
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(probe.stdout) as Record<string, unknown>;
      } catch {
        throw safeError('media_probe_failed');
      }
      const streams = Array.isArray(payload.streams)
        ? (payload.streams as Array<Record<string, unknown>>)
        : [];
      const videos = streams.filter((stream) => stream.codec_type === 'video');
      const audios = streams.filter((stream) => stream.codec_type === 'audio');
      const chapters = Array.isArray(payload.chapters) ? payload.chapters : [];
      const video = videos[0];
      const audio = audios[0];
      const format = (payload.format ?? {}) as Record<string, unknown>;
      const formatName = String(format.format_name ?? '');
      const durationMs = Math.round(Number(format.duration) * 1000);
      const framesPerSecond = parseFrameRate(String(video?.avg_frame_rate ?? ''));
      const rotationDegrees = normalizedRotationDegrees(video);
      if (
        streams.length !== 2 ||
        videos.length !== 1 ||
        audios.length !== 1 ||
        chapters.length !== 0 ||
        !/(?:^|,)mp4(?:,|$)/u.test(formatName) ||
        video?.codec_name !== 'h264' ||
        video.pix_fmt !== 'yuv420p' ||
        video.sample_aspect_ratio !== '1:1' ||
        rotationDegrees !== 0 ||
        audio?.codec_name !== 'aac' ||
        audio.profile !== 'LC' ||
        ![44_100, 48_000].includes(Number(audio.sample_rate)) ||
        Number(audio.channels) !== 2 ||
        !Number.isInteger(Number(video.width)) ||
        !Number.isInteger(Number(video.height)) ||
        !Number.isFinite(durationMs) ||
        durationMs <= 0 ||
        !Number.isFinite(framesPerSecond) ||
        framesPerSecond <= 0
      ) {
        throw safeError('media_probe_evidence_mismatch');
      }
      const decode = await runCommand('ffmpeg', [
        '-v',
        'error',
        '-xerror',
        '-nostdin',
        '-i',
        filePath,
        '-map',
        '0:v:0',
        '-map',
        '0:a:0',
        '-f',
        'null',
        '-',
      ]);
      if (decode.exitCode !== 0) throw safeError('media_decode_failed');
      return {
        container: 'mp4',
        videoStreamCount: 1,
        audioStreamCount: 1,
        width: Number(video.width),
        height: Number(video.height),
        rotationDegrees: 0,
        sampleAspectRatio: '1:1',
        durationMs,
        framesPerSecond,
        videoCodec: 'h264',
        pixelFormat: 'yuv420p',
        audioCodec: 'aac',
        audioProfile: 'LC',
        audioSampleRateHz: Number(audio.sample_rate),
        audioChannels: 2,
        decoded: true,
        privacyMetadataRemoved: mediaPrivacyMetadataIsRemoved(format, video, audio),
      };
    },
    inspectPoster: decodePoster,
  };
}

function mediaPrivacyMetadataIsRemoved(
  format: Record<string, unknown>,
  video: Record<string, unknown> | undefined,
  audio: Record<string, unknown> | undefined,
) {
  return (
    generatedOnlyTags(format.tags, 'format') &&
    generatedOnlyTags(video?.tags, 'video') &&
    generatedOnlyTags(audio?.tags, 'audio')
  );
}

function generatedOnlyTags(value: unknown, kind: 'format' | 'video' | 'audio') {
  if (value === undefined) return true;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const tags = value as Record<string, unknown>;
  const validators: Record<string, RegExp> =
    kind === 'format'
      ? {
          major_brand: /^(?:isom|iso[2-9]|avc1|mp4[12]|M4A |M4V )$/u,
          minor_version: /^\d{1,10}$/u,
          compatible_brands: /^(?:(?:isom|iso[2-9]|avc1|mp4[12]|M4A |M4V ))+$/u,
          encoder: /^Lavf\d+(?:\.\d+){1,3}$/u,
        }
      : kind === 'video'
        ? {
            language: /^(?:und|eng)$/u,
            handler_name: /^VideoHandler$/u,
            vendor_id: /^(?:\[0\]){4}$/u,
            encoder: /^Lavc\d+(?:\.\d+){1,3} libx264$/u,
          }
        : {
            language: /^(?:und|eng)$/u,
            handler_name: /^SoundHandler$/u,
            vendor_id: /^(?:\[0\]){4}$/u,
            encoder: /^Lavc\d+(?:\.\d+){1,3} aac$/u,
          };
  return Object.entries(tags).every(
    ([key, tagValue]) => typeof tagValue === 'string' && validators[key]?.test(tagValue) === true,
  );
}

function posterPrivacyMetadataIsRemoved(metadata: Metadata) {
  return (
    metadata.orientation === undefined &&
    metadata.exif === undefined &&
    metadata.iptc === undefined &&
    metadata.xmp === undefined &&
    metadata.xmpAsString === undefined &&
    metadata.tifftagPhotoshop === undefined &&
    metadata.icc === undefined &&
    metadata.hasProfile !== true &&
    (metadata.comments === undefined || metadata.comments.length === 0)
  );
}

function normalizedRotationDegrees(stream: Record<string, unknown> | undefined) {
  const tags = (stream?.tags ?? {}) as Record<string, unknown>;
  const sideData = Array.isArray(stream?.side_data_list)
    ? (stream.side_data_list as Array<Record<string, unknown>>)
    : [];
  const raw = sideData.find((entry) => entry.rotation !== undefined)?.rotation ?? tags.rotate ?? 0;
  const measured = Number(raw);
  if (!Number.isFinite(measured)) return Number.NaN;
  return ((measured % 360) + 360) % 360;
}

function parseFrameRate(value: string) {
  const match = /^(\d+)\/(\d+)$/u.exec(value);
  if (!match) return Number.NaN;
  const denominator = Number(match[2]);
  return denominator > 0 ? Number(match[1]) / denominator : Number.NaN;
}

function runProbeCommand(executable: string, args: readonly string[]): Promise<ProbeCommandResult> {
  return new Promise((resolve, reject) => {
    const environment = { ...process.env };
    delete environment[AUTHORIZATION_ENV];
    const child = spawn(executable, [...args], {
      env: environment,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let outputBytes = 0;
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(safeError('media_probe_timeout'));
    }, 120_000);
    child.stdout.on('data', (chunk: Buffer) => {
      outputBytes += chunk.byteLength;
      if (outputBytes > 1024 * 1024) {
        child.kill('SIGKILL');
        return;
      }
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      outputBytes += chunk.byteLength;
      if (outputBytes > 1024 * 1024) child.kill('SIGKILL');
    });
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timeout);
      if (outputBytes > 1024 * 1024) reject(safeError('media_probe_output_too_large'));
      else resolve({ exitCode: code ?? -1, stdout });
    });
  });
}

export function createPrivateParentWelcomeResultSink(
  outputPath: string,
  options?: {
    platform?: NodeJS.Platform;
    openFile?: typeof open;
    renameFile?: typeof rename;
    syncParent?: (directoryPath: string) => Promise<void>;
  },
): ParentWelcomePrivateResultSink {
  const platform = options?.platform ?? process.platform;
  const openFile = options?.openFile ?? open;
  const renameFile = options?.renameFile ?? rename;
  const syncParent =
    options?.syncParent ?? ((directoryPath: string) => syncDirectory(directoryPath, openFile));
  let reserved = false;
  let reservedParent: string | undefined;
  let finalizeAttempted = false;
  return {
    async reserve(input) {
      if (reserved) throw safeError('private_result_already_reserved');
      if (
        platform === 'win32' ||
        !path.isAbsolute(outputPath) ||
        !/\.private\.json$/iu.test(outputPath)
      ) {
        throw safeError('private_result_path_invalid');
      }
      const parent = path.dirname(outputPath);
      const canonicalParent = await realpath(parent);
      if (!(await stat(canonicalParent)).isDirectory()) {
        throw safeError('private_result_parent_invalid');
      }
      try {
        await lstat(outputPath);
        throw safeError('private_result_must_not_exist');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      const initial = {
        ...baseReport(new Date(input.generatedAt), input.apply, []),
        status: 'acceptance_unknown' as const,
        blockers: ['private_result_not_finalized'],
      };
      const handle = await openFile(outputPath, 'wx', 0o600);
      try {
        await handle.chmod(0o600);
        await assertOwnerOnlyFile(handle);
        await handle.writeFile(`${JSON.stringify(initial, null, 2)}\n`, 'utf8');
        await handle.sync();
      } catch (error) {
        await handle.close().catch(() => undefined);
        await unlink(outputPath).catch(() => undefined);
        throw error;
      }
      await handle.close();
      await syncParent(canonicalParent);
      reservedParent = canonicalParent;
      reserved = true;
    },
    async finalize(report) {
      if (!reserved) throw safeError('private_result_not_reserved');
      if (finalizeAttempted) throw safeError('private_result_finalize_already_attempted');
      finalizeAttempted = true;
      const tempPath = `${outputPath}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`;
      const serialized = `${JSON.stringify(report, null, 2)}\n`;
      const handle = await openFile(tempPath, 'wx', 0o600);
      try {
        await handle.chmod(0o600);
        await assertOwnerOnlyFile(handle);
        await handle.writeFile(serialized, 'utf8');
        await handle.sync();
        await handle.close();
        await syncParent(reservedParent!);
        let terminalRenamed = false;
        try {
          await renameFile(tempPath, outputPath);
        } catch (error) {
          if (await exactPrivateResultFile(outputPath, serialized)) terminalRenamed = true;
          else throw error;
        }
        if (!terminalRenamed) terminalRenamed = true;
        try {
          await syncParent(reservedParent!);
        } catch {
          if (terminalRenamed && (await exactPrivateResultFile(outputPath, serialized))) {
            throw safeError('private_result_durability_unknown');
          }
          throw safeError('private_result_finalize_failed');
        }
      } catch (error) {
        await handle.close().catch(() => undefined);
        await unlink(tempPath).catch(() => undefined);
        throw error;
      }
    },
  };
}

async function exactPrivateResultFile(filePath: string, expected: string) {
  try {
    const file = await stat(filePath);
    return (
      file.isFile() &&
      (file.mode & 0o777) === 0o600 &&
      (typeof process.getuid !== 'function' || file.uid === process.getuid()) &&
      (await readFile(filePath, 'utf8')) === expected
    );
  } catch {
    return false;
  }
}

async function syncDirectory(directoryPath: string, openFile: typeof open) {
  const directory = await openFile(directoryPath, 'r');
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}

async function assertOwnerOnlyFile(handle: Awaited<ReturnType<typeof open>>) {
  const file = await handle.stat();
  if (!file.isFile() || (file.mode & 0o777) !== 0o600) {
    throw safeError('private_result_permissions_invalid');
  }
  if (typeof process.getuid === 'function' && file.uid !== process.getuid()) {
    throw safeError('private_result_owner_invalid');
  }
}

async function readPrivateManifest(filePath: string, apply: boolean) {
  if (!path.isAbsolute(filePath) || !/\.private\.json$/iu.test(filePath)) {
    throw new Error('private_manifest_path_invalid');
  }
  try {
    const file = await stat(filePath);
    if (!file.isFile()) throw new Error('private_manifest_path_invalid');
    if (apply && process.platform !== 'win32' && (file.mode & 0o777) !== 0o600) {
      throw new Error('private_manifest_permissions_invalid');
    }
    return JSON.parse((await readFile(filePath, 'utf8')).replace(/^\uFEFF/u, '')) as unknown;
  } catch (error) {
    if (
      error instanceof Error &&
      ['private_manifest_path_invalid', 'private_manifest_permissions_invalid'].includes(
        error.message,
      )
    ) {
      throw error;
    }
    throw new Error('private_manifest_read_failed');
  }
}

function parseArgs(argv: readonly string[]) {
  const parsed: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument?.startsWith('--')) throw new Error('operation_argument_invalid');
    const key = argument.slice(2);
    if (key === 'apply') {
      parsed.apply = true;
      continue;
    }
    if (!['manifest', 'out'].includes(key)) throw new Error('operation_argument_invalid');
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error('operation_argument_missing');
    parsed[key] = value;
    index += 1;
  }
  return parsed;
}

async function cli() {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = typeof args.manifest === 'string' ? args.manifest : undefined;
  const outputPath = typeof args.out === 'string' ? args.out : undefined;
  const apply = args.apply === true;
  if (
    !manifestPath ||
    !outputPath ||
    !path.isAbsolute(outputPath) ||
    !/\.private\.json$/iu.test(outputPath)
  ) {
    throw new Error('private_manifest_and_result_paths_required');
  }
  const manifest = await readPrivateManifest(manifestPath, apply);
  const config = loadConfig(process.env);
  const runtime: ParentWelcomeRuntimeIdentity = {
    commitSha: config.commitSha,
    accountKey: config.accountKey,
    productKey: config.productKey,
    runtimeTier: config.oneTimeRuntimeTier,
    verificationEnvironmentId: config.oneTimeVerificationEnvironmentId,
    writesAllowed: config.oneTimeVerificationWritesAllowed,
    region: config.contentAwsRegion ?? '',
    bucketRef: config.contentS3Bucket ?? '',
    kmsKeyArn: config.contentS3KmsKeyArn ?? '',
    storageClass: config.contentS3StorageClass,
  };
  const pool = createPgPool(config);
  // A retried PutObject can turn a transport ambiguity into duplicate versions.
  // The operation owns reconciliation and therefore disables SDK retries.
  const s3 = new S3Client({ region: runtime.region, maxAttempts: 1 });
  try {
    const report = await runParentWelcomeVideoBinding({
      manifest,
      apply,
      ...(process.env[AUTHORIZATION_ENV]
        ? { authorizationPhrase: process.env[AUTHORIZATION_ENV] }
        : {}),
      runtime,
      objectStore: createAwsParentWelcomeObjectStore({
        client: s3,
        bucketRef: runtime.bucketRef,
        kmsKeyArn: runtime.kmsKeyArn,
        storageClass: runtime.storageClass,
      }),
      repository: createPostgresParentWelcomeBindingRepository(pool),
      mediaProbe: createProductionParentWelcomeMediaProbe(),
      resultSink: createPrivateParentWelcomeResultSink(outputPath),
    });
    if (report.blockers.includes('private_result_sink_reservation_failed')) {
      throw new Error('private_result_sink_reservation_failed');
    }
    process.stdout.write('parent_welcome_binding_result_written\n');
    if (!['dry_run_planned', 'applied', 'already_applied'].includes(report.status)) {
      process.exitCode = 2;
    }
  } finally {
    s3.destroy();
    await pool.end();
  }
}

function isCliEntrypoint() {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
}

if (isCliEntrypoint()) await cli();
