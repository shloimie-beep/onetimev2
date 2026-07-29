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

export interface ContentPublicationRecord {
  contentId: string;
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
  } | null;
  publicationGeneration: number;
  opaqueProviderAssetRef: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  occurrenceIds: readonly string[];
}

export interface ContentPublicationPrincipal {
  actorId: string;
  role: 'admin' | 'parent' | 'student';
  productKey: typeof CONTENT_PUBLICATION_PRODUCT_KEY;
  householdId: string;
  studentId: string | null;
  accessState: 'active' | 'grace' | 'inactive' | 'archived';
}

export interface StudentContentEntitlement {
  contentId: string;
  studentId: string;
  householdId: string;
  occurrenceId: string;
  active: boolean;
}

export type ContentPublicationOperation =
  | 'approve'
  | 'request_publish'
  | 'record_published'
  | 'attach_occurrence'
  | 'unpublish'
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
  contentId: string;
  publicationGeneration: number;
  operation: 'publish_private' | 'revoke_private';
  idempotencyKey: string;
  requestHash: string;
  state: 'pending';
  createdAt: string;
}

export interface StudentPlaybackGrant {
  contentId: string;
  publicationVersion: number;
  playbackSessionId: string;
  bootstrapPath: string;
  issuedAt: string;
  expiresAt: string;
  renewable: true;
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
  listPublishedContent(): Promise<readonly ContentPublicationRecord[]>;
  getEntitlement(studentId: string, contentId: string): Promise<StudentContentEntitlement | null>;
  getResume(studentId: string, contentId: string): Promise<StudentContentResume | null>;
  saveResume(resume: StudentContentResume, expectedVersion: number | null): Promise<void>;
}

export interface ContentPublicationRepository {
  inTransaction<T>(work: (unit: ContentPublicationUnitOfWork) => Promise<T>): Promise<T>;
}

export interface PrivatePublicationProviderPort {
  publishPrivate(input: {
    contentId: string;
    publicationGeneration: number;
    idempotencyKey: string;
    requestHash: string;
  }): Promise<{ opaqueProviderAssetRef: string }>;
  revokePrivate(input: {
    contentId: string;
    publicationGeneration: number;
    opaqueProviderAssetRef: string;
    idempotencyKey: string;
    requestHash: string;
  }): Promise<void>;
}
