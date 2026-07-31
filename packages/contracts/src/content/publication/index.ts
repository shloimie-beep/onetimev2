import type {
  ApprovedForPublicationProjectionParams,
  SourceCompleteApprovedForPublicationProjection,
} from '../processing/index.ts';
import type { JobScope } from '../../jobs/index.ts';
import type { ProviderOperation } from '../../providers/v21-provider-core.ts';

export const CONTENT_PUBLICATION_CONTRACT_VERSION = '2.1.0';
export const CONTENT_PUBLICATION_PRODUCT_KEY = 'one_time_mishnayos';
export const CONTENT_PLAYBACK_GRANT_TTL_MS = 5 * 60 * 1000;

export const CONTENT_PUBLICATION_STATES = [
  'received',
  'validating',
  'processing',
  'needs_review',
  'approved',
  'publishing',
  'published',
  'failed',
  'archived',
] as const;
export type ContentPublicationState = (typeof CONTENT_PUBLICATION_STATES)[number];

export type CanonicalContentStateActorKind = 'admin' | 'worker' | 'reconciler';
export type CanonicalContentStateOperation =
  'approve' | 'request_publish' | 'record_published' | 'unpublish' | 'archive';

export interface CanonicalContentStateTransitionCommand {
  record: ContentPublicationRecord;
  operation: CanonicalContentStateOperation;
  previousState: ContentPublicationState;
  nextState: ContentPublicationState;
  actorKind: CanonicalContentStateActorKind;
  actorKey: string;
  idempotencyKey: string;
  requestHash: string;
  occurredAt: string;
}

export interface CanonicalContentStateTransitionResult {
  replay: boolean;
  resultingVersion: number;
}

export type ContentPublicationScope = Pick<
  SourceCompleteApprovedForPublicationProjection,
  'accountKey' | 'productKey'
>;
export type ContentApprovalEvidence = SourceCompleteApprovedForPublicationProjection;
export interface ContentPublicationProjectionRepository {
  getApprovedForPublicationProjection(
    params: ApprovedForPublicationProjectionParams,
  ): Promise<SourceCompleteApprovedForPublicationProjection | null>;
}

export interface GovernedContentOccurrenceRelation extends ContentPublicationScope {
  relationId: string;
  occurrenceId: string;
  occurrenceVersion: number;
  canonicalSeriesId: string;
  productKey: typeof CONTENT_PUBLICATION_PRODUCT_KEY;
  governedByAdminId: string;
  attachedAt: string;
}

export interface CanonicalGovernedOccurrence extends ContentPublicationScope {
  occurrenceId: string;
  occurrenceVersion: number;
  canonicalSeriesId: string;
  productKey: typeof CONTENT_PUBLICATION_PRODUCT_KEY;
  governanceState: 'governed';
  active: true;
}

export interface ContentPublicationRecord extends ContentPublicationScope {
  contentId: string;
  contentVersionId: string;
  contentVersionDigest: string;
  participantSetVersion: string;
  participantSnapshotSetDigest: string;
  participantReviewState: 'pending' | 'complete';
  unresolvedParticipantCount: number;
  requiredRedactionCount: number;
  completedRedactionCount: number;
  redactionReviewDigest: string;
  version: number;
  state: ContentPublicationState;
  title: string;
  englishTranscriptText: string;
  classTopic: string;
  mishnahReferences: readonly string[];
  occurredAt: string;
  updatedAt: string;
  durationMs: number;
  approval: {
    approvalId: string;
    approvedByAdminId: string;
    approvedAt: string;
    policyVersion: string;
    evidence: ContentApprovalEvidence;
  } | null;
  publicationGeneration: number;
  playbackGrantGeneration: number;
  pendingProviderOperationId: string | null;
  pendingProviderRequestHash: string | null;
  opaqueProviderAssetRef: string | null;
  providerReadbackDigest: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  occurrenceRelations: readonly GovernedContentOccurrenceRelation[];
}

export interface ContentPublicationPrincipal {
  actorId: string;
  role: 'admin' | 'parent' | 'student';
  accountKey: string;
  productKey: typeof CONTENT_PUBLICATION_PRODUCT_KEY;
  householdId: string;
  studentId: string | null;
  sessionId: string | null;
  sessionVersion: number | null;
  accessState: 'active' | 'grace' | 'inactive' | 'archived';
}

export interface StudentContentAssignment extends ContentPublicationScope {
  assignmentId: string;
  assignmentVersion: number;
  contentId: string;
  contentVersionId: string;
  publicationGeneration: number;
  studentId: string;
  householdId: string;
  occurrenceId: string;
  studentVersion: number;
  enrollmentVersion: number;
  accessVersion: number;
  serviceAccountConsentVersion: number;
  privacyVersion: number;
  revocationVersion: number;
  active: boolean;
  revokedAt: string | null;
  approvalEvidence: ContentApprovalEvidence;
}

export interface StudentPlaybackAuthorizationFacts extends ContentPublicationScope {
  assignmentId: string;
  assignmentVersion: number;
  studentId: string;
  householdId: string;
  sessionId: string;
  sessionVersion: number;
  sessionActive: boolean;
  studentVersion: number;
  studentActive: boolean;
  enrollmentVersion: number;
  enrollmentActive: boolean;
  accessVersion: number;
  accessState: 'active' | 'grace' | 'inactive' | 'archived';
  serviceAccountConsentVersion: number;
  serviceAccountAccepted: boolean;
  privacyVersion: number;
  revocationVersion: number;
  studentRevoked: boolean;
  accountRevoked: boolean;
  contentRevoked: boolean;
  privacyReviewState: 'clear' | 'hold' | 'revoked';
  approvalProjectionDigest: string;
}

export interface StudentPublicationAudience extends ContentPublicationScope {
  studentId: string;
  householdId: string;
  adultRecipientId: string;
  occurrenceId: string;
  studentVersion: number;
  enrollmentVersion: number;
  accessVersion: number;
  serviceAccountConsentVersion: number;
  privacyVersion: number;
  revocationVersion: number;
}

export interface StudentPublicationEligibility extends StudentPublicationAudience {
  contentId: string;
  contentVersionId: string;
  publicationGeneration: number;
  studentActive: boolean;
  enrollmentActive: boolean;
  accessState: 'active' | 'grace' | 'inactive' | 'archived';
  serviceAccountAccepted: boolean;
  privacyReviewState: 'clear' | 'hold' | 'revoked';
  studentRevoked: boolean;
  accountRevoked: boolean;
  contentRevoked: boolean;
  adultRecipientActive: boolean;
  approvalProjectionDigest: string;
}

export interface StudentLibraryProjection extends ContentPublicationScope {
  projectionId: string;
  assignmentId: string;
  assignmentVersion: number;
  contentId: string;
  contentVersionId: string;
  publicationGeneration: number;
  studentId: string;
  householdId: string;
  internalRoute: string;
  active: true;
  createdAt: string;
  approvalEvidence: ContentApprovalEvidence;
}

export interface ProtectedRecordingNotice extends ContentPublicationScope {
  noticeId: string;
  recipientKind: 'student' | 'adult';
  recipientId: string;
  studentId: string;
  householdId: string;
  category: 'recording_available';
  contentId: string;
  contentVersionId: string;
  sourceVersion: number;
  title: 'New recording available';
  body: string;
  actionLabel: 'Watch recording' | 'Open household';
  actionPath: string;
  deliveryState: 'pending';
  createdAt: string;
  approvalProjectionDigest: string;
}

export interface ContentPublicationMaterialization extends ContentPublicationScope {
  contentId: string;
  contentVersionId: string;
  publicationGeneration: number;
  assignments: readonly StudentContentAssignment[];
  libraryProjections: readonly StudentLibraryProjection[];
  notices: readonly ProtectedRecordingNotice[];
  approvalEvidence: ContentApprovalEvidence;
}

export type ContentPublicationOperation =
  | 'approve'
  | 'request_publish'
  | 'record_published'
  | 'record_revoked'
  | 'attach_occurrence'
  | 'unpublish'
  | 'archive'
  | 'save_resume';

export interface ContentPublicationCommandBinding {
  idempotencyKey: string;
  requestHash: string;
  expectedVersion: number;
  occurredAt: string;
}

export interface ContentPublicationReceipt extends ContentPublicationScope {
  idempotencyKey: string;
  requestHash: string;
  operation: ContentPublicationOperation;
  contentId: string;
  contentVersionId: string;
  publicationGeneration: number;
  resultVersion: number;
  committedAt: string;
  approvalProjectionDigest: string;
}

export interface ContentPublicationOutboxIntent extends ContentPublicationScope {
  intentId: string;
  providerOperationId: string;
  provider: 'vimeo';
  contentId: string;
  contentVersionId: string;
  publicationGeneration: number;
  operation: 'publish_private' | 'revoke_private';
  idempotencyKey: string;
  requestHash: string;
  state: 'pending';
  createdAt: string;
  approvalEvidence: ContentApprovalEvidence;
}

export interface ContentPublicationProviderOperation extends ContentPublicationScope {
  providerOperationId: string;
  providerOperationVersion: number;
  provider: 'vimeo';
  operation: 'publish_private' | 'revoke_private';
  productKey: typeof CONTENT_PUBLICATION_PRODUCT_KEY;
  contentId: string;
  contentVersionId: string;
  publicationGeneration: number;
  idempotencyKey: string;
  canonicalRequestHash: string;
  state: 'accepted';
  unknownEffect: false;
  registryBindingKey: string;
  providerAccountRefHash: string;
  providerAcceptanceDigest: string;
  providerReconciliationDigest: string | null;
  approvalProjectionDigest: string;
}

export interface PendingContentPublicationProviderContext {
  intent: ContentPublicationOutboxIntent;
  providerOperation: ContentPublicationProviderOperation;
  executionScope?: JobScope;
}

export interface ContentPublicationProviderCompletion extends ContentPublicationScope {
  providerOperationId: string;
  expectedProviderOperationVersion: number;
  outboxIntentId: string;
  operation: 'publish_private' | 'revoke_private';
  contentId: string;
  contentVersionId: string;
  publicationGeneration: number;
  canonicalRequestHash: string;
  providerAcceptanceDigest: string;
  providerReconciliationDigest: string | null;
  registryBindingKey: string;
  providerAccountRefHash: string;
  providerReadbackDigest: string;
  oneTimeReadbackDigest: string;
  providerResourceRefHash: string;
  providerObservedAt: string;
  completedAt: string;
  approvalProjectionDigest: string;
}

export interface StudentPlaybackGrant extends ContentPublicationScope {
  contentId: string;
  contentVersionId: string;
  publicationGeneration: number;
  playbackGrantGeneration: number;
  studentId: string;
  studentVersion: number;
  sessionId: string;
  sessionVersion: number;
  assignmentId: string;
  assignmentVersion: number;
  accessVersion: number;
  enrollmentVersion: number;
  serviceAccountConsentVersion: number;
  privacyVersion: number;
  revocationVersion: number;
  playbackSessionId: string;
  bootstrapPath: string;
  issuedAt: string;
  expiresAt: string;
  renewable: true;
  approvalProjectionDigest: string;
}

export interface VimeoProviderOperationReadback extends ContentPublicationScope {
  providerOperationId: string;
  providerOperationVersion: number;
  providerOperationState: 'accepted';
  operation: 'publish_private';
  contentId: string;
  contentVersionId: string;
  publicationGeneration: number;
  canonicalRequestHash: string;
  state: 'complete';
  observedAt: string;
  opaqueProviderAssetRef: string;
  providerResourceRefHash: string;
  vimeoPrivacy: 'private';
  vimeoAvailability: 'available';
  matchingCanonicalAssetCount: 1;
  exactContentVersionCorrelation: true;
  providerAcceptanceDigest: string;
  providerReconciliationDigest: string | null;
  providerReadbackDigest: string;
  oneTimePublicationReadback: 'ready_to_apply';
  oneTimeReadbackDigest: string;
  approvalProjectionDigest: string;
}

export interface VimeoProviderRevocationReadback extends ContentPublicationScope {
  providerOperationId: string;
  providerOperationVersion: number;
  providerOperationState: 'accepted';
  operation: 'revoke_private';
  contentId: string;
  contentVersionId: string;
  publicationGeneration: number;
  canonicalRequestHash: string;
  state: 'complete';
  observedAt: string;
  providerResourceRefHash: string;
  vimeoAvailability: 'revoked';
  matchingCanonicalAssetCount: 0 | 1;
  exactContentVersionCorrelation: true;
  providerAcceptanceDigest: string;
  providerReconciliationDigest: string | null;
  providerReadbackDigest: string;
  oneTimePublicationReadback: 'revocation_ready_to_apply';
  oneTimeReadbackDigest: string;
  approvalProjectionDigest: string;
}

export type VimeoContentPublicationObservation =
  | {
      operation: 'publish_private';
      observedAt: string;
      opaqueProviderAssetRef: string;
      providerResourceRefHash: string;
      vimeoPrivacy: 'private';
      vimeoAvailability: 'available';
      matchingCanonicalAssetCount: 1;
      exactContentVersionCorrelation: true;
      providerAcceptanceDigest: string;
    }
  | {
      operation: 'revoke_private';
      observedAt: string;
      providerResourceRefHash: string;
      vimeoAvailability: 'revoked';
      matchingCanonicalAssetCount: 0 | 1;
      exactContentVersionCorrelation: true;
      providerAcceptanceDigest: string;
    };

export interface VimeoContentPublicationReadbackAdapter {
  readCanonical(
    context: PendingContentPublicationProviderContext,
    signal: AbortSignal,
  ): Promise<VimeoContentPublicationObservation>;
}

export interface StudentLibraryItem {
  contentId: string;
  title: string;
  classTopic: string;
  mishnahReferences: readonly string[];
  occurredAt: string;
  durationMs: number;
  resumePositionMs: number;
  internalRoute: string;
}

export interface StudentContentResume extends ContentPublicationScope {
  studentId: string;
  householdId: string;
  contentId: string;
  contentVersionId: string;
  publicationVersion: number;
  positionMs: number;
  updatedAt: string;
  version: number;
  approvalProjectionDigest: string;
}

export interface ContentPublicationUnitOfWork {
  getContent(
    scope: ContentPublicationScope,
    contentId: string,
  ): Promise<ContentPublicationRecord | null>;
  registerContent(
    record: ContentPublicationRecord,
  ): Promise<{ record: ContentPublicationRecord; inserted: boolean }>;
  bootstrapCanonicalContentState(
    record: ContentPublicationRecord,
    evidence: ContentApprovalEvidence,
  ): Promise<CanonicalContentStateTransitionResult>;
  resolveCanonicalContentExecutionScope(record: ContentPublicationRecord): Promise<JobScope>;
  appendCanonicalContentStateTransition(
    command: CanonicalContentStateTransitionCommand,
  ): Promise<CanonicalContentStateTransitionResult>;
  saveContent(record: ContentPublicationRecord, expectedVersion: number): Promise<void>;
  findReceipt(
    scope: ContentPublicationScope,
    operation: ContentPublicationOperation,
    idempotencyKey: string,
  ): Promise<ContentPublicationReceipt | null>;
  saveReceipt(receipt: ContentPublicationReceipt): Promise<void>;
  saveProviderOperation(operation: ProviderOperation): Promise<void>;
  saveOutboxIntent(intent: ContentPublicationOutboxIntent): Promise<void>;
  getPendingProviderContext(
    scope: ContentPublicationScope,
    providerOperationId: string,
    operation: 'publish_private' | 'revoke_private',
  ): Promise<PendingContentPublicationProviderContext | null>;
  completeProviderOperation(completion: ContentPublicationProviderCompletion): Promise<void>;
  getCanonicalGovernedOccurrence(
    scope: ContentPublicationScope,
    occurrenceId: string,
  ): Promise<CanonicalGovernedOccurrence | null>;
  getCurrentPublicationEligibility(
    scope: ContentPublicationScope,
    studentId: string,
    contentId: string,
    occurrenceId: string,
  ): Promise<StudentPublicationEligibility | null>;
  savePublicationMaterialization(materialization: ContentPublicationMaterialization): Promise<void>;
  listPublishedContent(
    scope: ContentPublicationScope,
  ): Promise<readonly ContentPublicationRecord[]>;
  getAssignment(
    scope: ContentPublicationScope,
    studentId: string,
    contentId: string,
  ): Promise<StudentContentAssignment | null>;
  refreshPlaybackFacts(
    scope: ContentPublicationScope,
    principal: ContentPublicationPrincipal,
    assignment: StudentContentAssignment,
  ): Promise<StudentPlaybackAuthorizationFacts | null>;
  getResume(
    scope: ContentPublicationScope,
    studentId: string,
    contentId: string,
  ): Promise<StudentContentResume | null>;
  saveResume(resume: StudentContentResume, expectedVersion: number | null): Promise<void>;
}

export interface ContentPublicationRepository {
  inTransaction<T>(work: (unit: ContentPublicationUnitOfWork) => Promise<T>): Promise<T>;
}
