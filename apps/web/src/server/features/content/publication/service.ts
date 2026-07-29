import type {
  ContentPublicationCommandBinding,
  ContentPublicationOperation,
  ContentPublicationOutboxIntent,
  ContentPublicationPrincipal,
  ContentPublicationReceipt,
  ContentPublicationRepository,
  PrivatePublicationProviderPort,
} from '../../../../../../../packages/contracts/src/content/publication/index.ts';
import {
  approveContent,
  assertAdminPublicationPrincipal,
  assertPrivatePublicationDispatch,
  assertReceiptReplay,
  assertStudentContentAccess,
  attachOccurrence,
  authorizeStudentPlayback,
  recordPrivatePublication,
  requestPrivatePublication,
  saveStudentResume,
  searchStudentLibrary,
  stableKey,
  unpublishContent,
} from '../../../../../../../packages/domain/src/content/publication/index.ts';
import {
  CONTENT_PUBLICATION_ERROR_CODES,
  ContentPublicationError,
} from '../../../../../../../packages/domain/src/content/publication/errors.ts';

export function createContentPublicationService(deps: {
  repository: ContentPublicationRepository;
  provider: PrivatePublicationProviderPort;
  createId: () => string;
}) {
  return {
    approve(input: {
      principal: ContentPublicationPrincipal;
      contentId: string;
      approvalId: string;
      policyVersion: string;
      binding: ContentPublicationCommandBinding;
    }) {
      return mutate({
        repository: deps.repository,
        principal: input.principal,
        contentId: input.contentId,
        operation: 'approve',
        binding: input.binding,
        apply: (record) =>
          approveContent({
            principal: input.principal,
            record,
            approvalId: input.approvalId,
            policyVersion: input.policyVersion,
            binding: input.binding,
          }),
      });
    },

    requestPublish(input: {
      principal: ContentPublicationPrincipal;
      contentId: string;
      binding: ContentPublicationCommandBinding;
    }) {
      return mutate({
        repository: deps.repository,
        principal: input.principal,
        contentId: input.contentId,
        operation: 'request_publish',
        binding: input.binding,
        apply: (record) => {
          const result = requestPrivatePublication({
            principal: input.principal,
            record,
            binding: input.binding,
          });
          return { record: result.record, outboxIntent: result.intent };
        },
      });
    },

    async dispatchPrivatePublish(input: {
      principal: ContentPublicationPrincipal;
      contentId: string;
      binding: ContentPublicationCommandBinding;
    }) {
      const pending = await deps.repository.inTransaction(async (unit) => {
        const record = await requiredContent(unit, input.contentId);
        assertAdminPublicationPrincipal(input.principal);
        const priorReceipt = await unit.findReceipt(
          'record_published',
          input.binding.idempotencyKey,
        );
        if (priorReceipt) {
          assertReceiptReplay(
            priorReceipt,
            'record_published',
            input.binding.requestHash,
            input.contentId,
          );
          return { record, replay: true as const };
        }
        assertPrivatePublicationDispatch({
          principal: input.principal,
          record,
          binding: input.binding,
        });
        return { record, replay: false as const };
      });
      if (pending.replay) return { record: pending.record, replay: true as const };
      const result = await deps.provider.publishPrivate({
        contentId: pending.record.contentId,
        publicationGeneration: pending.record.publicationGeneration,
        idempotencyKey: input.binding.idempotencyKey,
        requestHash: input.binding.requestHash,
      });
      return mutate({
        repository: deps.repository,
        principal: input.principal,
        contentId: input.contentId,
        operation: 'record_published',
        binding: input.binding,
        apply: (record) =>
          recordPrivatePublication({
            principal: input.principal,
            record,
            publicationGeneration: pending.record.publicationGeneration,
            opaqueProviderAssetRef: result.opaqueProviderAssetRef,
            binding: input.binding,
          }),
      });
    },

    attachOccurrence(input: {
      principal: ContentPublicationPrincipal;
      contentId: string;
      occurrenceId: string;
      binding: ContentPublicationCommandBinding;
    }) {
      return mutate({
        repository: deps.repository,
        principal: input.principal,
        contentId: input.contentId,
        operation: 'attach_occurrence',
        binding: input.binding,
        apply: (record) =>
          attachOccurrence({
            principal: input.principal,
            record,
            occurrenceId: input.occurrenceId,
            binding: input.binding,
          }),
      });
    },

    unpublish(input: {
      principal: ContentPublicationPrincipal;
      contentId: string;
      binding: ContentPublicationCommandBinding;
    }) {
      return mutate({
        repository: deps.repository,
        principal: input.principal,
        contentId: input.contentId,
        operation: 'unpublish',
        binding: input.binding,
        apply: (record) => {
          const result = unpublishContent({
            principal: input.principal,
            record,
            binding: input.binding,
          });
          return { record: result.record, outboxIntent: result.intent };
        },
      });
    },

    playback(input: { principal: ContentPublicationPrincipal; contentId: string; now: Date }) {
      return deps.repository.inTransaction(async (unit) => {
        const record = await requiredContent(unit, input.contentId);
        const entitlement = input.principal.studentId
          ? await unit.getEntitlement(input.principal.studentId, input.contentId)
          : null;
        return authorizeStudentPlayback({
          principal: input.principal,
          record,
          entitlement,
          now: input.now,
          playbackSessionId: deps.createId(),
        });
      });
    },

    library(input: { principal: ContentPublicationPrincipal; query: string }) {
      return deps.repository.inTransaction(async (unit) => {
        const published = await unit.listPublishedContent();
        const entitlementEntries = await Promise.all(
          published.map(
            async (record) =>
              [
                record.contentId,
                input.principal.studentId
                  ? await unit.getEntitlement(input.principal.studentId, record.contentId)
                  : null,
              ] as const,
          ),
        );
        const resumeEntries = await Promise.all(
          published.map(
            async (record) =>
              [
                record.contentId,
                input.principal.studentId
                  ? await unit.getResume(input.principal.studentId, record.contentId)
                  : null,
              ] as const,
          ),
        );
        return searchStudentLibrary({
          principal: input.principal,
          query: input.query,
          published,
          entitlements: new Map(entitlementEntries),
          resumes: new Map(resumeEntries),
        });
      });
    },

    saveResume(input: {
      principal: ContentPublicationPrincipal;
      contentId: string;
      positionMs: number;
      binding: ContentPublicationCommandBinding;
    }) {
      return deps.repository.inTransaction(async (unit) => {
        const studentId = input.principal.studentId;
        const record = await requiredContent(unit, input.contentId);
        const entitlement = studentId
          ? await unit.getEntitlement(studentId, input.contentId)
          : null;
        assertStudentContentAccess({
          principal: input.principal,
          record,
          entitlement,
        });
        const priorReceipt = await unit.findReceipt('save_resume', input.binding.idempotencyKey);
        if (priorReceipt) {
          assertReceiptReplay(
            priorReceipt,
            'save_resume',
            input.binding.requestHash,
            input.contentId,
          );
          if (!studentId) return unavailable();
          return (await unit.getResume(studentId, input.contentId)) ?? unavailable();
        }
        const existing = studentId ? await unit.getResume(studentId, input.contentId) : null;
        const resume = saveStudentResume({
          principal: input.principal,
          record,
          entitlement,
          existing,
          positionMs: input.positionMs,
          occurredAt: input.binding.occurredAt,
        });
        await unit.saveResume(resume, existing?.version ?? null);
        await unit.saveReceipt(
          receipt('save_resume', input.contentId, record.version, input.binding),
        );
        return resume;
      });
    },
  };
}

async function mutate(input: {
  repository: ContentPublicationRepository;
  principal: ContentPublicationPrincipal;
  contentId: string;
  operation: Exclude<ContentPublicationOperation, 'save_resume'>;
  binding: ContentPublicationCommandBinding;
  apply: (record: Awaited<ReturnType<typeof requiredContent>>) =>
    | Awaited<ReturnType<typeof requiredContent>>
    | {
        record: Awaited<ReturnType<typeof requiredContent>>;
        outboxIntent: ContentPublicationOutboxIntent;
      };
}) {
  return input.repository.inTransaction(async (unit) => {
    assertAdminPublicationPrincipal(input.principal);
    const current = await requiredContent(unit, input.contentId);
    const priorReceipt = await unit.findReceipt(input.operation, input.binding.idempotencyKey);
    if (priorReceipt) {
      assertReceiptReplay(
        priorReceipt,
        input.operation,
        input.binding.requestHash,
        input.contentId,
      );
      return { record: current, replay: true as const };
    }
    const applied = input.apply(current);
    const next = 'record' in applied ? applied.record : applied;
    await unit.saveContent(next, current.version);
    if ('outboxIntent' in applied) await unit.saveOutboxIntent(applied.outboxIntent);
    await unit.saveReceipt(receipt(input.operation, input.contentId, next.version, input.binding));
    return { record: next, replay: false as const };
  });
}

function receipt(
  operation: ContentPublicationOperation,
  contentId: string,
  resultVersion: number,
  binding: ContentPublicationCommandBinding,
): ContentPublicationReceipt {
  return {
    operation,
    contentId,
    resultVersion,
    idempotencyKey: binding.idempotencyKey,
    requestHash: binding.requestHash,
    committedAt: new Date(binding.occurredAt).toISOString(),
  };
}

async function requiredContent(
  unit: Parameters<Parameters<ContentPublicationRepository['inTransaction']>[0]>[0],
  contentId: string,
) {
  const record = await unit.getContent(contentId);
  if (!record) return unavailable();
  return record;
}

function unavailable(): never {
  throw new ContentPublicationError(
    CONTENT_PUBLICATION_ERROR_CODES.unavailable,
    'Content is unavailable.',
  );
}

export function publicationRequestHash(value: unknown) {
  return stableKey('request', [canonicalJson(value)]).slice('request_'.length);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('content_publication_non_finite_request');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`;
  }
  throw new Error('content_publication_non_canonical_request');
}
