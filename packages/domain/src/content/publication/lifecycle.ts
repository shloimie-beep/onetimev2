import { createHash } from 'node:crypto';
import {
  CONTENT_PLAYBACK_GRANT_TTL_MS,
  CONTENT_PUBLICATION_PRODUCT_KEY,
  type ContentPublicationCommandBinding,
  type ContentPublicationOutboxIntent,
  type ContentPublicationPrincipal,
  type ContentPublicationReceipt,
  type ContentPublicationRecord,
  type StudentContentEntitlement,
  type StudentContentResume,
  type StudentLibraryItem,
  type StudentPlaybackGrant,
} from '../../../../contracts/src/content/publication/index.ts';
import { CONTENT_PUBLICATION_ERROR_CODES, ContentPublicationError } from './errors.ts';

export function approveContent(input: {
  principal: ContentPublicationPrincipal;
  record: ContentPublicationRecord;
  approvalId: string;
  policyVersion: string;
  binding: ContentPublicationCommandBinding;
}) {
  assertAdmin(input.principal);
  assertBinding(input.binding, input.record);
  if (input.record.state !== 'needs_review') {
    throw failure('invalidState', 'Only review-ready content can be approved.');
  }
  assertSafeId(input.approvalId, 'approvalId');
  if (!input.policyVersion.trim()) throw failure('invalidInput', 'policyVersion is required.');
  const occurredAt = validInstant(input.binding.occurredAt);
  return {
    ...input.record,
    version: input.record.version + 1,
    state: 'approved' as const,
    approval: {
      approvalId: input.approvalId,
      approvedByAdminId: input.principal.actorId,
      approvedAt: occurredAt,
      policyVersion: input.policyVersion.trim(),
    },
    updatedAt: occurredAt,
  };
}

export function requestPrivatePublication(input: {
  principal: ContentPublicationPrincipal;
  record: ContentPublicationRecord;
  binding: ContentPublicationCommandBinding;
}): { record: ContentPublicationRecord; intent: ContentPublicationOutboxIntent } {
  assertAdmin(input.principal);
  assertBinding(input.binding, input.record);
  if (input.record.state !== 'approved' || !input.record.approval) {
    throw failure('invalidState', 'Admin approval is required before publication.');
  }
  const generation = input.record.publicationGeneration + 1;
  const occurredAt = validInstant(input.binding.occurredAt);
  return {
    record: {
      ...input.record,
      version: input.record.version + 1,
      state: 'publishing',
      publicationGeneration: generation,
      opaqueProviderAssetRef: null,
      publishedAt: null,
      archivedAt: null,
      updatedAt: occurredAt,
    },
    intent: {
      intentId: stableKey('publish', [
        input.record.contentId,
        String(generation),
        input.binding.idempotencyKey,
      ]),
      contentId: input.record.contentId,
      publicationGeneration: generation,
      operation: 'publish_private',
      idempotencyKey: input.binding.idempotencyKey,
      requestHash: input.binding.requestHash,
      state: 'pending',
      createdAt: occurredAt,
    },
  };
}

export function recordPrivatePublication(input: {
  principal: ContentPublicationPrincipal;
  record: ContentPublicationRecord;
  publicationGeneration: number;
  opaqueProviderAssetRef: string;
  binding: ContentPublicationCommandBinding;
}) {
  assertAdmin(input.principal);
  assertBinding(input.binding, input.record);
  if (
    input.record.state !== 'publishing' ||
    input.publicationGeneration !== input.record.publicationGeneration
  ) {
    throw failure('conflict', 'Publication completion is stale or not pending.');
  }
  assertOpaqueReference(input.opaqueProviderAssetRef);
  const occurredAt = validInstant(input.binding.occurredAt);
  return {
    ...input.record,
    version: input.record.version + 1,
    state: 'published' as const,
    opaqueProviderAssetRef: input.opaqueProviderAssetRef,
    publishedAt: occurredAt,
    archivedAt: null,
    updatedAt: occurredAt,
  };
}

export function unpublishContent(input: {
  principal: ContentPublicationPrincipal;
  record: ContentPublicationRecord;
  binding: ContentPublicationCommandBinding;
}): { record: ContentPublicationRecord; intent: ContentPublicationOutboxIntent } {
  assertAdmin(input.principal);
  assertBinding(input.binding, input.record);
  if (input.record.state !== 'published' || !input.record.opaqueProviderAssetRef) {
    throw failure('invalidState', 'Only currently published content can be unpublished.');
  }
  const occurredAt = validInstant(input.binding.occurredAt);
  return {
    record: {
      ...input.record,
      version: input.record.version + 1,
      state: 'archived',
      archivedAt: occurredAt,
      updatedAt: occurredAt,
    },
    intent: {
      intentId: stableKey('revoke', [
        input.record.contentId,
        String(input.record.publicationGeneration),
        input.binding.idempotencyKey,
      ]),
      contentId: input.record.contentId,
      publicationGeneration: input.record.publicationGeneration,
      operation: 'revoke_private',
      idempotencyKey: input.binding.idempotencyKey,
      requestHash: input.binding.requestHash,
      state: 'pending',
      createdAt: occurredAt,
    },
  };
}

export function attachOccurrence(input: {
  principal: ContentPublicationPrincipal;
  record: ContentPublicationRecord;
  occurrenceId: string;
  binding: ContentPublicationCommandBinding;
}) {
  assertAdmin(input.principal);
  assertBinding(input.binding, input.record);
  assertSafeId(input.occurrenceId, 'occurrenceId');
  if (input.record.state === 'archived' || input.record.state === 'failed') {
    throw failure('invalidState', 'Unavailable content cannot be attached.');
  }
  if (input.record.occurrenceIds.includes(input.occurrenceId)) return input.record;
  const occurredAt = validInstant(input.binding.occurredAt);
  return {
    ...input.record,
    version: input.record.version + 1,
    occurrenceIds: [...input.record.occurrenceIds, input.occurrenceId],
    updatedAt: occurredAt,
  };
}

export function authorizeStudentPlayback(input: {
  principal: ContentPublicationPrincipal;
  record: ContentPublicationRecord;
  entitlement: StudentContentEntitlement | null;
  now: Date;
  playbackSessionId: string;
}): StudentPlaybackGrant {
  assertStudentContentAccess(input);
  assertSafeId(input.playbackSessionId, 'playbackSessionId');
  const issuedAt = validDate(input.now);
  return {
    contentId: input.record.contentId,
    publicationVersion: input.record.version,
    playbackSessionId: input.playbackSessionId,
    bootstrapPath: `/api/v1/student/library/${encodeURIComponent(input.record.contentId)}/playback`,
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(issuedAt.getTime() + CONTENT_PLAYBACK_GRANT_TTL_MS).toISOString(),
    renewable: true,
  };
}

export function saveStudentResume(input: {
  principal: ContentPublicationPrincipal;
  record: ContentPublicationRecord;
  entitlement: StudentContentEntitlement | null;
  existing: StudentContentResume | null;
  positionMs: number;
  occurredAt: string;
}): StudentContentResume {
  assertStudentContentAccess(input);
  if (
    !Number.isSafeInteger(input.positionMs) ||
    input.positionMs < 0 ||
    input.positionMs > input.record.durationMs
  ) {
    throw failure('invalidInput', 'Resume position is outside the published media duration.');
  }
  const studentId = input.principal.studentId;
  if (!studentId) throw failure('accessDenied', 'Student access is unavailable.');
  if (
    input.existing &&
    (input.existing.studentId !== studentId ||
      input.existing.householdId !== input.principal.householdId ||
      input.existing.contentId !== input.record.contentId)
  ) {
    throw failure('accessDenied', 'Resume state belongs to another Student scope.');
  }
  return {
    studentId,
    householdId: input.principal.householdId,
    contentId: input.record.contentId,
    publicationVersion: input.record.version,
    positionMs: input.positionMs,
    updatedAt: validInstant(input.occurredAt),
    version: (input.existing?.version ?? 0) + 1,
  };
}

export function searchStudentLibrary(input: {
  principal: ContentPublicationPrincipal;
  query: string;
  published: readonly ContentPublicationRecord[];
  entitlements: ReadonlyMap<string, StudentContentEntitlement | null>;
  resumes: ReadonlyMap<string, StudentContentResume | null>;
}): StudentLibraryItem[] {
  if (
    input.principal.role !== 'student' ||
    !input.principal.studentId ||
    !['active', 'grace'].includes(input.principal.accessState)
  ) {
    throw failure('accessDenied', 'Student library access is unavailable.');
  }
  const query = normalizeSearch(input.query);
  return input.published
    .filter((record) => {
      try {
        assertStudentContentAccess({
          principal: input.principal,
          record,
          entitlement: input.entitlements.get(record.contentId) ?? null,
        });
        return searchText(record).includes(query);
      } catch {
        return false;
      }
    })
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .map((record) => {
      const resume = input.resumes.get(record.contentId);
      return {
        contentId: record.contentId,
        title: record.title,
        classTopic: record.classTopic,
        mishnahReferences: [...record.mishnahReferences],
        occurredAt: record.occurredAt,
        durationMs: record.durationMs,
        resumePositionMs:
          resume?.studentId === input.principal.studentId &&
          resume.householdId === input.principal.householdId &&
          resume.publicationVersion === record.version
            ? resume.positionMs
            : 0,
        internalRoute: `/app/student/library/${encodeURIComponent(record.contentId)}`,
      };
    });
}

export function assertReceiptReplay(
  receipt: ContentPublicationReceipt,
  operation: ContentPublicationReceipt['operation'],
  requestHash: string,
  contentId: string,
) {
  if (
    receipt.operation !== operation ||
    receipt.requestHash !== requestHash ||
    receipt.contentId !== contentId
  ) {
    throw failure('conflict', 'Idempotency key was already used for a different request.');
  }
}

export function assertAdminPublicationPrincipal(principal: ContentPublicationPrincipal) {
  assertAdmin(principal);
}

export function assertPrivatePublicationDispatch(input: {
  principal: ContentPublicationPrincipal;
  record: ContentPublicationRecord;
  binding: ContentPublicationCommandBinding;
}) {
  assertAdmin(input.principal);
  assertBinding(input.binding, input.record);
  if (input.record.state !== 'publishing' || !input.record.approval) {
    throw failure('invalidState', 'Content is not awaiting approved private publication.');
  }
}

export function assertStudentContentAccess(input: {
  principal: ContentPublicationPrincipal;
  record: ContentPublicationRecord;
  entitlement: StudentContentEntitlement | null;
}) {
  assertStudentAccess(input.principal, input.record, input.entitlement);
}

export function stableKey(prefix: string, parts: readonly string[]) {
  return `${prefix}_${createHash('sha256').update(JSON.stringify(parts)).digest('hex')}`;
}

function assertStudentAccess(
  principal: ContentPublicationPrincipal,
  record: ContentPublicationRecord,
  entitlement: StudentContentEntitlement | null,
) {
  if (
    principal.role !== 'student' ||
    !principal.studentId ||
    principal.productKey !== CONTENT_PUBLICATION_PRODUCT_KEY ||
    !['active', 'grace'].includes(principal.accessState) ||
    record.state !== 'published' ||
    !record.opaqueProviderAssetRef ||
    !entitlement ||
    !entitlement.active ||
    entitlement.contentId !== record.contentId ||
    entitlement.studentId !== principal.studentId ||
    entitlement.householdId !== principal.householdId ||
    !record.occurrenceIds.includes(entitlement.occurrenceId)
  ) {
    throw failure('accessDenied', 'Content is unavailable.');
  }
}

function assertAdmin(principal: ContentPublicationPrincipal) {
  if (
    principal.role !== 'admin' ||
    principal.productKey !== CONTENT_PUBLICATION_PRODUCT_KEY ||
    principal.accessState !== 'active'
  ) {
    throw failure('accessDenied', 'Admin publication access is unavailable.');
  }
}

function assertBinding(
  binding: ContentPublicationCommandBinding,
  record: ContentPublicationRecord,
) {
  assertSafeId(binding.idempotencyKey, 'idempotencyKey');
  if (!/^[a-f0-9]{64}$/.test(binding.requestHash)) {
    throw failure('invalidInput', 'requestHash must be an exact SHA-256 digest.');
  }
  if (binding.expectedVersion !== record.version) {
    throw failure('conflict', 'Content version changed before this command.');
  }
  validInstant(binding.occurredAt);
}

function assertOpaqueReference(value: string) {
  if (
    value.includes('/') ||
    value.includes('\\') ||
    value.includes('?') ||
    value.includes('#') ||
    /(?:https?|vimeo):/i.test(value)
  ) {
    throw failure('invalidInput', 'Provider asset reference must be opaque and non-routable.');
  }
  assertSafeId(value, 'opaqueProviderAssetRef');
}

function assertSafeId(value: string, field: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,179}$/.test(value)) {
    throw failure('invalidInput', `${field} is invalid.`);
  }
}

function normalizeSearch(value: string) {
  const normalized = value.trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
  if (normalized.length > 160 || containsControlCharacter(normalized)) {
    throw failure('invalidInput', 'Library query is invalid.');
  }
  return normalized;
}

function containsControlCharacter(value: string) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

function searchText(record: ContentPublicationRecord) {
  return [
    record.title,
    record.englishTranscriptText,
    record.occurredAt.slice(0, 10),
    record.classTopic,
    ...record.mishnahReferences,
  ]
    .join(' ')
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ');
}

function validDate(value: Date) {
  if (!Number.isFinite(value.getTime())) throw failure('invalidInput', 'Time is invalid.');
  return value;
}

function validInstant(value: string) {
  const instant = validDate(new Date(value));
  return instant.toISOString();
}

function failure(code: keyof typeof CONTENT_PUBLICATION_ERROR_CODES, message: string) {
  return new ContentPublicationError(CONTENT_PUBLICATION_ERROR_CODES[code], message);
}
