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

export interface ContentApprovalEvidence {
  contentVersionId: string;
  contentVersionDigest: string;
  participantSnapshotSetDigest: string;
  participantSetVersion: string;
  participantReviewState: 'complete';
  unresolvedParticipantCount: 0;
  requiredRedactionCount: number;
  completedRedactionCount: number;
  redactionReviewDigest: string;
  adminAttestation: {
    attestationId: string;
    attestedByAdminId: string;
    attestedAt: string;
    inspectedMediaAndMemberVisibleArtifacts: true;
    requiredRedactionsComplete: true;
  };
}

export interface GovernedContentOccurrenceRelation {
  relationId: string;
  occurrenceId: string;
  occurrenceVersion: number;
  canonicalSeriesId: string;
  productKey: typeof CONTENT_PUBLICATION_PRODUCT_KEY;
  governedByAdminId: string;
  attachedAt: string;
}

export interface ContentPublicationRecord {
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
  productKey: typeof CONTENT_PUBLICATION_PRODUCT_KEY;
  householdId: string;
  studentId: string | null;
  sessionId: string | null;
  sessionVersion: number | null;
  accessState: 'active' | 'grace' | 'inactive' | 'archived';
}

export interface StudentContentAssignment {
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
}

export interface StudentPlaybackAuthorizationFacts {
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
}

export interface StudentPublicationAudience {
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

export interface StudentLibraryProjection {
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
}

export interface ProtectedRecordingNotice {
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
}

export interface ContentPublicationMaterialization {
  contentId: string;
  contentVersionId: string;
  publicationGeneration: number;
  assignments: readonly StudentContentAssignment[];
  libraryProjections: readonly StudentLibraryProjection[];
  notices: readonly ProtectedRecordingNotice[];
}

export type ContentPublicationOperation =
  | 'approve'
  | 'request_publish'
  | 'record_published'
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

export interface ContentPublicationReceipt {
  idempotencyKey: string;
  requestHash: string;
  operation: ContentPublicationOperation;
  contentId: string;
  resultVersion: number;
  committedAt: string;
}

export interface ContentPublicationOutboxIntent {
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
}

export interface StudentPlaybackGrant {
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
}

export interface VimeoProviderOperationReadback {
  providerOperationId: string;
  operation: 'publish_private';
  contentId: string;
  contentVersionId: string;
  publicationGeneration: number;
  canonicalRequestHash: string;
  state: 'complete';
  fence: {
    workerId: string;
    leaseGeneration: number;
    leaseExpiresAt: string;
    observedAt: string;
  };
  opaqueProviderAssetRef: string;
  vimeoPrivacy: 'private';
  vimeoAvailability: 'available';
  matchingCanonicalAssetCount: 1;
  exactContentVersionCorrelation: true;
  providerAcceptanceDigest: string;
  providerReadbackDigest: string;
  oneTimePublicationReadback: 'applied';
  oneTimeReadbackDigest: string;
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

export interface StudentContentResume {
  studentId: string;
  householdId: string;
  contentId: string;
  publicationVersion: number;
  positionMs: number;
  updatedAt: string;
  version: number;
}

export interface ContentPublicationUnitOfWork {
  getContent(contentId: string): Promise<ContentPublicationRecord | null>;
  saveContent(record: ContentPublicationRecord, expectedVersion: number): Promise<void>;
  findReceipt(
    operation: ContentPublicationOperation,
    idempotencyKey: string,
  ): Promise<ContentPublicationReceipt | null>;
  saveReceipt(receipt: ContentPublicationReceipt): Promise<void>;
  saveOutboxIntent(intent: ContentPublicationOutboxIntent): Promise<void>;
  savePublicationMaterialization(materialization: ContentPublicationMaterialization): Promise<void>;
  listPublishedContent(): Promise<readonly ContentPublicationRecord[]>;
  getAssignment(studentId: string, contentId: string): Promise<StudentContentAssignment | null>;
  getPlaybackFacts(
    studentId: string,
    contentId: string,
  ): Promise<StudentPlaybackAuthorizationFacts | null>;
  getResume(studentId: string, contentId: string): Promise<StudentContentResume | null>;
  saveResume(resume: StudentContentResume, expectedVersion: number | null): Promise<void>;
}

export interface ContentPublicationRepository {
  inTransaction<T>(work: (unit: ContentPublicationUnitOfWork) => Promise<T>): Promise<T>;
}
