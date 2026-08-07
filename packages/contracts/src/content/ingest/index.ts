export const CONTENT_INGEST_CONTRACT_VERSION = '2.1.0' as const;
export const CONTENT_INGEST_MAX_BYTES = 5 * 1024 * 1024 * 1024;
export const CONTENT_INGEST_PART_BYTES = 64 * 1024 * 1024;
export const CONTENT_INGEST_MAX_CONCURRENT_PARTS = 4;
export const CONTENT_INGEST_PART_AUTHORIZATION_SECONDS = 15 * 60;
export const CONTENT_INGEST_DRIVE_STABILITY_SECONDS = 120;
export const CONTENT_INGEST_INCOMPLETE_UPLOAD_HOURS = 24;
export const CONTENT_INGEST_MAX_ATTEMPTS = 8;
export const CONTENT_INGEST_REGION = 'eu-central-1' as const;
export const CONTENT_INGEST_SOURCE_POLICY = {
  primary: 'app_upload',
  optional: ['drive'],
  optionalSourceFailureBlocksPrimary: false,
} as const;
export const CONTENT_INGEST_CONTAINERS = ['mp4', 'mov', 'mkv'] as const;
export const CONTENT_INGEST_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-matroska',
] as const;

export type ContentIngestContainer = (typeof CONTENT_INGEST_CONTAINERS)[number];
export type ContentIngestMimeType = (typeof CONTENT_INGEST_MIME_TYPES)[number];
export type ContentSourceKind = 'app_upload' | 'drive';
export type ContentCaptureMethod = 'obs';
export type ContentLifecycleState =
  | 'received'
  | 'validating'
  | 'processing'
  | 'needs_review'
  | 'approved'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'archived';
export type ContentRetryState = 'ready' | 'retry_wait' | 'dead_lettered';
export type UploadSessionState =
  | 'initiated'
  | 'uploading'
  | 'completing'
  | 'acceptance_unknown'
  | 'confirmed'
  | 'aborted'
  | 'failed'
  | 'dead_lettered';
export type DriveIntakeState =
  | 'observing'
  | 'stable'
  | 'transferring'
  | 'needs_review'
  | 'quarantined'
  | 'processed'
  | 'provider_off'
  | 'retry_wait'
  | 'dead_lettered';
export type OccurrenceMatchConfidence = 'exact' | 'probable' | 'ambiguous' | 'none';
export type IngestRuntimeTier = 'isolated_staging' | 'production';

export type ContentIngestScope = {
  accountKey: string;
  productKey: string;
};

export type ContentIngestAdminActor = ContentIngestScope & {
  principalId: string;
  role: 'admin';
};

export type ContentSourceRecord = ContentIngestScope & {
  id: string;
  sourceKind: ContentSourceKind;
  captureMethod: ContentCaptureMethod;
  runtimeTier: IngestRuntimeTier;
  verificationEnvironmentId: string;
  bucketRef: string;
  objectKeyDigest: string;
  objectVersionId: string;
  kmsKeyVersionRef: string;
  checksumReadbackReceiptId: string;
  displayFilename: string;
  mimeType: ContentIngestMimeType;
  container: ContentIngestContainer;
  byteCount: number;
  sha256: string;
  receivedAt: string;
  stableAt: string;
  occurrenceId?: string;
  matchConfidence: OccurrenceMatchConfidence;
  matchedByAdminId?: string;
  obsProfileVersion?: string;
  obsRecordingStartedAt?: string;
  obsRecordingStoppedAt?: string;
  recordingAdminId?: string;
  retentionDueAt: string;
  lifecycleState: ContentLifecycleState;
  failedFrom?: 'validating' | 'processing' | 'publishing';
  retryState: ContentRetryState;
  attemptCount: number;
  lastSafeErrorCode?: string;
  originalPreserved: true;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type ContentIngestOccurrenceOption = {
  id: string;
  localClassDate: string;
  startsAt: string;
  state: 'scheduled' | 'preparing' | 'ready' | 'live' | 'completed';
};

export type ContentSourceLinkRecord = ContentIngestScope & {
  id: string;
  sourceId: string;
  sourceKind: ContentSourceKind;
  provenanceRefDigest: string;
  providerChangeMarker?: string;
  displayFilename: string;
  observedAt: string;
};

export type UploadSessionRecord = ContentIngestScope & {
  id: string;
  actorId: string;
  runtimeTier: IngestRuntimeTier;
  verificationEnvironmentId: string;
  displayFilename: string;
  mimeType: ContentIngestMimeType;
  container: ContentIngestContainer;
  declaredByteCount: number;
  opaqueObjectKey: string;
  providerUploadIdDigest: string;
  state: UploadSessionState;
  totalParts: number;
  completedParts: number;
  receivedByteCount: number;
  attemptCount: number;
  retryState: ContentRetryState;
  idempotencyKey: string;
  requestHash: string;
  expiresAt: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type UploadPartRecord = ContentIngestScope & {
  uploadSessionId: string;
  partNumber: number;
  byteOffset: number;
  byteCount: number;
  partSha256: string;
  providerPartRefDigest: string;
  completedAt: string;
};

export type DriveFileObservation = ContentIngestScope & {
  driveFileRefDigest: string;
  parentFolderRefDigest: string;
  displayFilename: string;
  mimeType: string;
  byteCount: number;
  changeMarker: string;
  firstObservedAt: string;
  lastObservedAt: string;
  stableAt?: string;
  state: DriveIntakeState;
  attemptCount: number;
  retryState: ContentRetryState;
  lastSafeErrorCode?: string;
  version: number;
};

export type MultipartUploadPlan = {
  uploadSessionId: string;
  partBytes: typeof CONTENT_INGEST_PART_BYTES;
  totalParts: number;
  maxConcurrentParts: typeof CONTENT_INGEST_MAX_CONCURRENT_PARTS;
  authorizationTtlSeconds: typeof CONTENT_INGEST_PART_AUTHORIZATION_SECONDS;
  expiresAt: string;
};

export type ManagedMultipartUploadBinding = {
  uploadSessionId: string;
  opaqueObjectKey: string;
};

export type ManagedMultipartBeginReadback =
  | {
      disposition: 'created' | 'recovered';
      providerUploadIdDigest: string;
      openUploadCount: 1;
    }
  | {
      disposition: 'duplicate';
      providerUploadIdDigests: readonly string[];
      openUploadCount: number;
    };

export type ManagedObjectReadback = {
  runtimeTier: IngestRuntimeTier;
  verificationEnvironmentId: string;
  region: typeof CONTENT_INGEST_REGION;
  bucketRef: string;
  objectKeyDigest: string;
  objectVersionId: string;
  byteCount: number;
  durabilityEvidenceVersion?: 'OT-MANAGED-ORIGINAL-1';
  checksumAlgorithm?: 'sha256';
  sha256: string;
  kmsKeyVersionRef: string;
  storageClass?: string;
  blockPublicAccess: true;
  bucketOwnerEnforced: true;
};

export type RecoveryJournalReceipt = {
  receiptId: string;
  uploadSessionId: string;
  runtimeTier: IngestRuntimeTier;
  verificationEnvironmentId: string;
  durabilityEvidenceVersion?: 'OT-MANAGED-ORIGINAL-1';
  bucketRef?: string;
  objectKeyDigest?: string;
  objectVersionId: string;
  byteCount: number;
  checksumAlgorithm?: 'sha256';
  sha256: string;
  kmsKeyVersionRef?: string;
  storageClass?: string;
  writtenAt: string;
  readBackAt: string;
};

export type BeginDirectUploadCommand = {
  actor: ContentIngestAdminActor;
  runtimeTier: IngestRuntimeTier;
  verificationEnvironmentId: string;
  displayFilename: string;
  mimeType: string;
  declaredByteCount: number;
  idempotencyKey: string;
  requestHash: string;
  occurredAt: string;
};

export type ConfirmDirectUploadCommand = {
  actor: ContentIngestAdminActor;
  uploadSessionId: string;
  expectedVersion: number;
  fullSha256: string;
  idempotencyKey: string;
  requestHash: string;
  readback: ManagedObjectReadback;
  journalReceipt: RecoveryJournalReceipt;
  retentionDueAt: string;
  occurredAt: string;
};

export type RecordUploadPartCommand = {
  actor: ContentIngestAdminActor;
  uploadSessionId: string;
  expectedVersion: number;
  partNumber: number;
  byteCount: number;
  partSha256: string;
  providerPartRefDigest: string;
  occurredAt: string;
};

export type MatchContentSourceCommand = {
  actor: ContentIngestAdminActor;
  sourceId: string;
  occurrenceId: string;
  expectedVersion: number;
  idempotencyKey: string;
  requestHash: string;
  occurredAt: string;
};

export type ContentIngestCommandReceipt = ContentIngestScope & {
  idempotencyKey: string;
  requestHash: string;
  operation: string;
  resultRef: string;
  resultVersion: number;
  committedAt: string;
};

export interface ContentIngestUnitOfWork {
  getUploadSession(
    scope: ContentIngestScope,
    uploadSessionId: string,
  ): Promise<UploadSessionRecord | null>;
  saveUploadSession(session: UploadSessionRecord): Promise<void>;
  listUploadParts(
    scope: ContentIngestScope,
    uploadSessionId: string,
  ): Promise<readonly UploadPartRecord[]>;
  saveUploadPart(part: UploadPartRecord): Promise<void>;
  findSourceByChecksum(
    scope: ContentIngestScope,
    sha256: string,
  ): Promise<ContentSourceRecord | null>;
  getSource(scope: ContentIngestScope, sourceId: string): Promise<ContentSourceRecord | null>;
  saveSource(source: ContentSourceRecord): Promise<void>;
  saveSourceLink(link: ContentSourceLinkRecord): Promise<void>;
  getDriveObservation(
    scope: ContentIngestScope,
    driveFileRefDigest: string,
  ): Promise<DriveFileObservation | null>;
  saveDriveObservation(observation: DriveFileObservation): Promise<void>;
  getReceipt(
    scope: ContentIngestScope,
    idempotencyKey: string,
  ): Promise<ContentIngestCommandReceipt | null>;
  saveReceipt(receipt: ContentIngestCommandReceipt): Promise<void>;
}

export interface ContentIngestRepository {
  inTransaction<T>(run: (unit: ContentIngestUnitOfWork) => Promise<T>): Promise<T>;
}

export const CONTENT_INGEST_ERROR_CODES = {
  accessDenied: 'content_ingest_access_denied',
  acceptanceUnknown: 'content_ingest_acceptance_unknown',
  conflict: 'content_ingest_idempotency_conflict',
  driveProviderOff: 'content_ingest_drive_provider_off',
  driveUnstable: 'content_ingest_drive_unstable',
  incompleteParts: 'content_ingest_incomplete_parts',
  invalidContainer: 'content_ingest_invalid_container',
  invalidReadback: 'content_ingest_invalid_readback',
  invalidSha256: 'content_ingest_invalid_sha256',
  invalidSize: 'content_ingest_invalid_size',
  invalidState: 'content_ingest_invalid_state',
  notFound: 'content_ingest_not_found',
  staleVersion: 'content_ingest_stale_version',
  unsafeFilename: 'content_ingest_unsafe_filename',
} as const;
