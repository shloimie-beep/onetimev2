import {
  CONTENT_PLAYBACK_GRANT_TTL_MS,
  type ContentMediaCanaryBlocker,
  type ContentMediaCanaryEvidence,
  type ContentMediaCanaryReadiness,
} from '../../../../contracts/src/content/publication/index.ts';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const APPROVED_ARTIFACT_KINDS = new Set([
  'trim',
  'compressed_video',
  'transcript',
  'captions',
  'review_material',
  'worksheet',
  'knowledge_artifact',
]);

export function evaluateContentMediaCanaryReadiness(
  evidence: ContentMediaCanaryEvidence,
): ContentMediaCanaryReadiness {
  const blockers: ContentMediaCanaryBlocker[] = [];
  const { source, processingVersion, publicationRecord } = evidence;

  if (
    evidence.runtimeTier !== 'production' ||
    evidence.verificationEnvironmentId !== 'production_operator_canary' ||
    source.runtimeTier !== evidence.runtimeTier ||
    source.verificationEnvironmentId !== evidence.verificationEnvironmentId
  ) {
    blockers.push('invalid_environment');
  }
  if (evidence.operatorControlledRecordingCount !== 1) {
    blockers.push('one_recording_required');
  }
  if (evidence.bulkActionAttempted) blockers.push('bulk_action_forbidden');
  if (source.sourceKind !== 'app_upload') blockers.push('direct_upload_primary_required');
  if (!managedOriginalMatches(evidence)) blockers.push('original_readback_mismatch');
  if (!recoveryJournalMatches(evidence)) blockers.push('recovery_journal_mismatch');

  if (
    processingVersion.state !== 'approved' ||
    processingVersion.accountKey !== source.accountKey ||
    processingVersion.productKey !== source.productKey ||
    processingVersion.sourceId !== source.id ||
    processingVersion.sourceSha256 !== source.sha256 ||
    processingVersion.sourceObjectVersionId !== source.objectVersionId ||
    !processingVersion.publicationApproval
  ) {
    blockers.push('processing_not_approved');
  }
  if (
    processingVersion.artifacts.length !== APPROVED_ARTIFACT_KINDS.size ||
    processingVersion.artifacts.some(
      (artifact) => artifact.status !== 'approved' || !APPROVED_ARTIFACT_KINDS.has(artifact.kind),
    ) ||
    new Set(processingVersion.artifacts.map(({ kind }) => kind)).size !==
      APPROVED_ARTIFACT_KINDS.size
  ) {
    blockers.push('approved_artifact_set_incomplete');
  }

  const projectionDigest = publicationRecord.approval?.evidence.projectionDigest;
  if (
    publicationRecord.state !== 'published' ||
    publicationRecord.accountKey !== source.accountKey ||
    publicationRecord.productKey !== source.productKey ||
    publicationRecord.contentVersionId !== processingVersion.id ||
    publicationRecord.contentVersionDigest !==
      processingVersion.publicationApproval?.contentVersionDigest ||
    publicationRecord.pendingProviderOperationId !== null ||
    publicationRecord.pendingProviderRequestHash !== null ||
    !publicationRecord.opaqueProviderAssetRef ||
    containsProviderDestination(publicationRecord.opaqueProviderAssetRef) ||
    !publicationRecord.publishedAt ||
    !publicationRecord.providerReadbackDigest ||
    !SHA256_PATTERN.test(publicationRecord.providerReadbackDigest) ||
    !projectionDigest ||
    !SHA256_PATTERN.test(projectionDigest)
  ) {
    blockers.push('publication_not_reconciled');
  }

  const grant = evidence.playbackGrant;
  const issuedAt = Date.parse(grant.issuedAt);
  const expiresAt = Date.parse(grant.expiresAt);
  if (
    grant.accountKey !== publicationRecord.accountKey ||
    grant.productKey !== publicationRecord.productKey ||
    grant.contentId !== publicationRecord.contentId ||
    grant.contentVersionId !== publicationRecord.contentVersionId ||
    grant.publicationGeneration !== publicationRecord.publicationGeneration ||
    grant.playbackGrantGeneration !== publicationRecord.playbackGrantGeneration ||
    grant.approvalProjectionDigest !== projectionDigest ||
    !grant.bootstrapPath.startsWith('/api/v1/student/library/') ||
    containsProviderDestination(grant.bootstrapPath) ||
    !Number.isFinite(issuedAt) ||
    !Number.isFinite(expiresAt) ||
    expiresAt - issuedAt !== CONTENT_PLAYBACK_GRANT_TTL_MS
  ) {
    blockers.push('protected_playback_mismatch');
  }
  if (
    !evidence.accessReadback.entitledStudentAllowed ||
    !evidence.accessReadback.parentDenied ||
    !evidence.accessReadback.siblingDenied ||
    !evidence.accessReadback.revokedDenied ||
    !evidence.accessReadback.unpublishRefreshDenied
  ) {
    blockers.push('access_denial_incomplete');
  }
  if (
    evidence.accessReadback.rawProviderUrlExposed ||
    containsProviderDestination(grant.bootstrapPath) ||
    containsProviderDestination(publicationRecord.opaqueProviderAssetRef ?? '')
  ) {
    blockers.push('raw_provider_url_exposed');
  }
  if (
    evidence.effects.driveFilesIngested < 0 ||
    evidence.effects.driveFilesIngested > 1 ||
    evidence.effects.vimeoAssetsUploaded !== 1 ||
    evidence.effects.unrelatedDriveFilesMutated !== 0 ||
    evidence.effects.unrelatedVimeoAssetsMutated !== 0
  ) {
    blockers.push('provider_effect_budget_exceeded');
  }
  if (!evidence.effects.providerEffectsReconciled) {
    blockers.push('provider_effects_unreconciled');
  }

  return {
    status: blockers.length === 0 ? 'ready' : 'blocked',
    canaryId: evidence.canaryId,
    primarySource: 'app_upload',
    optionalDriveState: evidence.optionalDriveState,
    driveBlocksPrimary: false,
    blockers,
  };
}

function managedOriginalMatches(evidence: ContentMediaCanaryEvidence): boolean {
  const { source, sourceReadback } = evidence;
  return (
    source.originalPreserved === true &&
    sourceReadback.runtimeTier === source.runtimeTier &&
    sourceReadback.verificationEnvironmentId === source.verificationEnvironmentId &&
    sourceReadback.region === 'eu-central-1' &&
    sourceReadback.bucketRef === source.bucketRef &&
    sourceReadback.objectKeyDigest === source.objectKeyDigest &&
    sourceReadback.objectVersionId === source.objectVersionId &&
    sourceReadback.byteCount === source.byteCount &&
    sourceReadback.durabilityEvidenceVersion === 'OT-MANAGED-ORIGINAL-1' &&
    sourceReadback.checksumAlgorithm === 'sha256' &&
    sourceReadback.sha256 === source.sha256 &&
    sourceReadback.kmsKeyVersionRef === source.kmsKeyVersionRef &&
    typeof sourceReadback.storageClass === 'string' &&
    sourceReadback.storageClass.trim() !== '' &&
    sourceReadback.blockPublicAccess === true &&
    sourceReadback.bucketOwnerEnforced === true
  );
}

function recoveryJournalMatches(evidence: ContentMediaCanaryEvidence): boolean {
  const { source, sourceReadback, recoveryJournal } = evidence;
  const writtenAt = Date.parse(recoveryJournal.writtenAt);
  const readBackAt = Date.parse(recoveryJournal.readBackAt);
  return (
    recoveryJournal.receiptId === source.checksumReadbackReceiptId &&
    recoveryJournal.uploadSessionId.trim() !== '' &&
    recoveryJournal.durabilityEvidenceVersion === sourceReadback.durabilityEvidenceVersion &&
    recoveryJournal.runtimeTier === sourceReadback.runtimeTier &&
    recoveryJournal.verificationEnvironmentId === sourceReadback.verificationEnvironmentId &&
    recoveryJournal.bucketRef === sourceReadback.bucketRef &&
    recoveryJournal.objectKeyDigest === sourceReadback.objectKeyDigest &&
    recoveryJournal.objectVersionId === sourceReadback.objectVersionId &&
    recoveryJournal.byteCount === sourceReadback.byteCount &&
    recoveryJournal.checksumAlgorithm === sourceReadback.checksumAlgorithm &&
    recoveryJournal.sha256 === sourceReadback.sha256 &&
    recoveryJournal.kmsKeyVersionRef === sourceReadback.kmsKeyVersionRef &&
    recoveryJournal.storageClass === sourceReadback.storageClass &&
    Number.isFinite(writtenAt) &&
    Number.isFinite(readBackAt) &&
    readBackAt >= writtenAt
  );
}

function containsProviderDestination(value: string): boolean {
  return /(?:https?:\/\/|\/\/|vimeo(?:\.com|[/:]))/i.test(value);
}
