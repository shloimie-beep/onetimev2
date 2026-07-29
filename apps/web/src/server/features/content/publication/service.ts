import type {
  ContentPublicationCommandBinding,
  ContentApprovalEvidence,
  ContentPublicationOperation,
  ContentPublicationOutboxIntent,
  ContentPublicationPrincipal,
  ContentPublicationReceipt,
  ContentPublicationRepository,
  GovernedContentOccurrenceRelation,
  StudentPublicationAudience,
  VimeoProviderOperationReadback,
} from '../../../../../../../packages/contracts/src/content/publication/index.ts';
import {
  archiveContent,
  approveContent,
  assertAdminPublicationPrincipal,
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
  createId: () => string;
}) {
  return {
    approve(input: {
      principal: ContentPublicationPrincipal;
      contentId: string;
      approvalId: string;
      policyVersion: string;
      evidence: ContentApprovalEvidence;
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
            evidence: input.evidence,
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

    async applyPrivatePublicationReadback(input: {
      contentId: string;
      readback: VimeoProviderOperationReadback;
      audience: readonly StudentPublicationAudience[];
      binding: ContentPublicationCommandBinding;
    }) {
      return deps.repository.inTransaction(async (unit) => {
        const current = await requiredContent(unit, input.contentId);
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
          return { record: current, replay: true as const };
        }
        const pendingProviderContext = current.pendingProviderOperationId
          ? await unit.getPendingPublishProviderContext(current.pendingProviderOperationId)
          : null;
        if (!pendingProviderContext) return providerConflict();
        const eligibility = await Promise.all(
          input.audience.map((member) =>
            unit.getCurrentPublicationEligibility(
              member.studentId,
              input.contentId,
              member.occurrenceId,
            ),
          ),
        );
        if (eligibility.some((entry) => entry === null)) return unavailable();
        const result = recordPrivatePublication({
          record: current,
          readback: input.readback,
          audience: input.audience,
          eligibility: eligibility.filter((entry) => entry !== null),
          pendingProviderContext,
          binding: input.binding,
        });
        await unit.saveContent(result.record, current.version);
        await unit.savePublicationMaterialization(result.materialization);
        await unit.completePublishProviderOperation(result.providerCompletion);
        await unit.saveReceipt(
          receipt('record_published', input.contentId, result.record.version, input.binding),
        );
        return { record: result.record, replay: false as const };
      });
    },

    attachOccurrence(input: {
      principal: ContentPublicationPrincipal;
      contentId: string;
      relation: Omit<GovernedContentOccurrenceRelation, 'governedByAdminId' | 'attachedAt'>;
      binding: ContentPublicationCommandBinding;
    }) {
      return deps.repository.inTransaction(async (unit) => {
        assertAdminPublicationPrincipal(input.principal);
        const current = await requiredContent(unit, input.contentId);
        const priorReceipt = await unit.findReceipt(
          'attach_occurrence',
          input.binding.idempotencyKey,
        );
        if (priorReceipt) {
          assertReceiptReplay(
            priorReceipt,
            'attach_occurrence',
            input.binding.requestHash,
            input.contentId,
          );
          return { record: current, replay: true as const };
        }
        const canonicalOccurrence = await unit.getCanonicalGovernedOccurrence(
          input.relation.occurrenceId,
          input.relation.productKey,
        );
        if (!canonicalOccurrence) return governedOccurrenceUnavailable();
        const next = attachOccurrence({
          principal: input.principal,
          record: current,
          relation: input.relation,
          canonicalOccurrence,
          binding: input.binding,
        });
        await unit.saveContent(next, current.version);
        await unit.saveReceipt(
          receipt('attach_occurrence', input.contentId, next.version, input.binding),
        );
        return { record: next, replay: false as const };
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

    archive(input: {
      principal: ContentPublicationPrincipal;
      contentId: string;
      binding: ContentPublicationCommandBinding;
    }) {
      return mutate({
        repository: deps.repository,
        principal: input.principal,
        contentId: input.contentId,
        operation: 'archive',
        binding: input.binding,
        apply: (record) => {
          const result = archiveContent({
            principal: input.principal,
            record,
            binding: input.binding,
          });
          return result.intent
            ? { record: result.record, outboxIntent: result.intent }
            : result.record;
        },
      });
    },

    playback(input: { principal: ContentPublicationPrincipal; contentId: string; now: Date }) {
      return deps.repository.inTransaction(async (unit) => {
        const record = await requiredContent(unit, input.contentId);
        const assignment = input.principal.studentId
          ? await unit.getAssignment(input.principal.studentId, input.contentId)
          : null;
        const facts = input.principal.studentId
          ? await unit.getPlaybackFacts(input.principal.studentId, input.contentId)
          : null;
        return authorizeStudentPlayback({
          principal: input.principal,
          record,
          assignment,
          facts,
          now: input.now,
          playbackSessionId: deps.createId(),
        });
      });
    },

    library(input: { principal: ContentPublicationPrincipal; query: string }) {
      return deps.repository.inTransaction(async (unit) => {
        const published = await unit.listPublishedContent();
        const assignmentEntries = await Promise.all(
          published.map(
            async (record) =>
              [
                record.contentId,
                input.principal.studentId
                  ? await unit.getAssignment(input.principal.studentId, record.contentId)
                  : null,
              ] as const,
          ),
        );
        const factEntries = await Promise.all(
          published.map(
            async (record) =>
              [
                record.contentId,
                input.principal.studentId
                  ? await unit.getPlaybackFacts(input.principal.studentId, record.contentId)
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
          assignments: new Map(assignmentEntries),
          facts: new Map(factEntries),
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
        const assignment = studentId ? await unit.getAssignment(studentId, input.contentId) : null;
        const facts = studentId ? await unit.getPlaybackFacts(studentId, input.contentId) : null;
        assertStudentContentAccess({
          principal: input.principal,
          record,
          assignment,
          facts,
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
          assignment,
          facts,
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

function providerConflict(): never {
  throw new ContentPublicationError(
    CONTENT_PUBLICATION_ERROR_CODES.conflict,
    'Pending publication operation is unavailable.',
  );
}

function governedOccurrenceUnavailable(): never {
  throw new ContentPublicationError(
    CONTENT_PUBLICATION_ERROR_CODES.invalidInput,
    'Governed occurrence is unavailable.',
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
