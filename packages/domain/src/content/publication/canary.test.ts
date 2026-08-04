import { describe, expect, it } from 'vitest';

import {
  CONTENT_PLAYBACK_GRANT_TTL_MS,
  type ContentMediaCanaryEvidence,
} from '../../../../contracts/src/content/publication/index.ts';
import { evaluateContentMediaCanaryReadiness } from './canary.ts';

const sha = (digit: string) => digit.repeat(64);
const issuedAt = '2026-08-04T12:00:00.000Z';

describe('OT-LIVE-004 one-recording media canary readiness', () => {
  it('keeps direct upload primary and treats an unavailable optional Drive path as nonblocking', () => {
    const evidence = canaryEvidence();

    expect(evaluateContentMediaCanaryReadiness(evidence)).toEqual({
      status: 'ready',
      canaryId: 'media-canary-1',
      primarySource: 'app_upload',
      optionalDriveState: 'provider_off',
      driveBlocksPrimary: false,
      blockers: [],
    });
  });

  it('fails closed on bulk scope, mismatched durability, incomplete approval, raw playback, and effects', () => {
    const evidence = canaryEvidence();
    const result = evaluateContentMediaCanaryReadiness({
      ...evidence,
      operatorControlledRecordingCount: 2,
      bulkActionAttempted: true,
      source: { ...evidence.source, sourceKind: 'drive' },
      recoveryJournal: { ...evidence.recoveryJournal, storageClass: 'GLACIER' },
      processingVersion: {
        ...evidence.processingVersion,
        state: 'failed',
        artifacts: evidence.processingVersion.artifacts.slice(0, 6),
      },
      publicationRecord: {
        ...evidence.publicationRecord,
        state: 'publishing',
        providerReadbackDigest: null,
      },
      playbackGrant: {
        ...evidence.playbackGrant,
        bootstrapPath: 'https://vimeo.com/private-asset',
      },
      accessReadback: {
        ...evidence.accessReadback,
        parentDenied: false,
        rawProviderUrlExposed: true,
      },
      effects: {
        driveFilesIngested: 2,
        vimeoAssetsUploaded: 2,
        unrelatedDriveFilesMutated: 1,
        unrelatedVimeoAssetsMutated: 1,
        providerEffectsReconciled: false,
      },
    });

    expect(result.status).toBe('blocked');
    expect(result.blockers).toEqual([
      'one_recording_required',
      'bulk_action_forbidden',
      'direct_upload_primary_required',
      'recovery_journal_mismatch',
      'processing_not_approved',
      'approved_artifact_set_incomplete',
      'publication_not_reconciled',
      'protected_playback_mismatch',
      'access_denial_incomplete',
      'raw_provider_url_exposed',
      'provider_effect_budget_exceeded',
      'provider_effects_unreconciled',
    ]);
  });
});

function canaryEvidence(): ContentMediaCanaryEvidence {
  const projectionDigest = sha('9');
  const contentVersionDigest = sha('8');
  const source = {
    accountKey: 'account-1',
    productKey: 'one_time_mishnayos',
    id: 'source-1',
    sourceKind: 'app_upload' as const,
    runtimeTier: 'production' as const,
    verificationEnvironmentId: 'production_operator_canary',
    bucketRef: 'managed-originals',
    objectKeyDigest: sha('1'),
    objectVersionId: 'object-version-1',
    kmsKeyVersionRef: 'kms-version-1',
    checksumReadbackReceiptId: 'journal-1',
    byteCount: 1_024,
    sha256: sha('2'),
    originalPreserved: true as const,
  };
  const sourceReadback = {
    runtimeTier: source.runtimeTier,
    verificationEnvironmentId: source.verificationEnvironmentId,
    region: 'eu-central-1' as const,
    bucketRef: source.bucketRef,
    objectKeyDigest: source.objectKeyDigest,
    objectVersionId: source.objectVersionId,
    byteCount: source.byteCount,
    durabilityEvidenceVersion: 'OT-MANAGED-ORIGINAL-1' as const,
    checksumAlgorithm: 'sha256' as const,
    sha256: source.sha256,
    kmsKeyVersionRef: source.kmsKeyVersionRef,
    storageClass: 'STANDARD',
    blockPublicAccess: true as const,
    bucketOwnerEnforced: true as const,
  };
  return {
    canaryId: 'media-canary-1',
    runtimeTier: 'production',
    verificationEnvironmentId: 'production_operator_canary',
    operatorControlledRecordingCount: 1,
    bulkActionAttempted: false,
    optionalDriveState: 'provider_off',
    source,
    sourceReadback,
    recoveryJournal: {
      receiptId: source.checksumReadbackReceiptId,
      uploadSessionId: 'upload-session-1',
      runtimeTier: source.runtimeTier,
      verificationEnvironmentId: source.verificationEnvironmentId,
      durabilityEvidenceVersion: sourceReadback.durabilityEvidenceVersion,
      bucketRef: source.bucketRef,
      objectKeyDigest: source.objectKeyDigest,
      objectVersionId: source.objectVersionId,
      byteCount: source.byteCount,
      checksumAlgorithm: 'sha256',
      sha256: source.sha256,
      kmsKeyVersionRef: source.kmsKeyVersionRef,
      storageClass: sourceReadback.storageClass,
      writtenAt: '2026-08-04T11:58:00.000Z',
      readBackAt: '2026-08-04T11:59:00.000Z',
    },
    processingVersion: {
      id: 'content-version-1',
      accountKey: source.accountKey,
      productKey: source.productKey,
      sourceId: source.id,
      sourceSha256: source.sha256,
      sourceObjectVersionId: source.objectVersionId,
      state: 'approved',
      artifacts: [
        'trim',
        'compressed_video',
        'transcript',
        'captions',
        'review_material',
        'worksheet',
        'knowledge_artifact',
      ].map((kind) => ({
        kind: kind as ContentMediaCanaryEvidence['processingVersion']['artifacts'][number]['kind'],
        status: 'approved' as const,
      })),
      publicationApproval: { contentVersionDigest },
    },
    publicationRecord: {
      accountKey: source.accountKey,
      productKey: 'one_time_mishnayos',
      contentId: 'content-1',
      contentVersionId: 'content-version-1',
      contentVersionDigest,
      state: 'published',
      publicationGeneration: 1,
      playbackGrantGeneration: 1,
      pendingProviderOperationId: null,
      pendingProviderRequestHash: null,
      opaqueProviderAssetRef: 'private-asset-ref',
      providerReadbackDigest: sha('7'),
      publishedAt: issuedAt,
      approval: { evidence: { projectionDigest } },
    },
    playbackGrant: {
      accountKey: source.accountKey,
      productKey: 'one_time_mishnayos',
      contentId: 'content-1',
      contentVersionId: 'content-version-1',
      publicationGeneration: 1,
      playbackGrantGeneration: 1,
      bootstrapPath: '/api/v1/student/library/content-1/playback',
      issuedAt,
      expiresAt: new Date(Date.parse(issuedAt) + CONTENT_PLAYBACK_GRANT_TTL_MS).toISOString(),
      approvalProjectionDigest: projectionDigest,
    },
    accessReadback: {
      entitledStudentAllowed: true,
      parentDenied: true,
      siblingDenied: true,
      revokedDenied: true,
      unpublishRefreshDenied: true,
      rawProviderUrlExposed: false,
    },
    effects: {
      driveFilesIngested: 0,
      vimeoAssetsUploaded: 1,
      unrelatedDriveFilesMutated: 0,
      unrelatedVimeoAssetsMutated: 0,
      providerEffectsReconciled: true,
    },
  };
}
