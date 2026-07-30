import type {
  ContentPublicationCommandBinding,
  ContentPublicationOperation,
  ContentPublicationOutboxIntent,
  ContentPublicationPrincipal,
  ContentPublicationReceipt,
  ContentPublicationRepository,
  ContentPublicationProjectionRepository,
  ContentPublicationScope,
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
  approvedProjectionRepository: ContentPublicationProjectionRepository;
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
      return deps.repository.inTransaction(async (unit) => {
        assertAdminPublicationPrincipal(input.principal);
        const scope = principalScope(input.principal);
        const current = await requiredContent(unit, scope, input.contentId);
        const evidence =
          await deps.approvedProjectionRepository.getApprovedForPublicationProjection({
            ...scope,
            contentVersionId: current.contentVersionId,
          });
        if (!evidence) return approvalUnavailable();
        const binding = authoritativeBinding(
          input.binding,
          'approve',
          current,
          {
            approvalId: input.approvalId,
            policyVersion: input.policyVersion,
            evidence,
          },
          evidence.projectionDigest,
        );
        const priorReceipt = await unit.findReceipt(scope, 'approve', binding.idempotencyKey);
        if (priorReceipt) {
          assertReceiptReplay(priorReceipt, 'approve', binding.requestHash, input.contentId);
          return { record: current, replay: true as const };
        }
        const next = approveContent({
          principal: input.principal,
          record: current,
          approvalId: input.approvalId,
          policyVersion: input.policyVersion,
          evidence,
          binding,
        });
        await unit.saveContent(next, current.version);
        await unit.saveReceipt(receipt('approve', next, binding));
        return { record: next, replay: false as const };
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
        requestPayload: {},
        apply: (record, binding) => {
          const result = requestPrivatePublication({
            principal: input.principal,
            record,
            binding,
          });
          return { record: result.record, outboxIntent: result.intent };
        },
      });
    },

    async applyPrivatePublicationReadback(input: {
      scope: ContentPublicationScope;
      contentId: string;
      readback: VimeoProviderOperationReadback;
      audience: readonly Omit<StudentPublicationAudience, 'accountKey' | 'productKey'>[];
      binding: ContentPublicationCommandBinding;
    }) {
      return deps.repository.inTransaction(async (unit) => {
        const current = await requiredContent(unit, input.scope, input.contentId);
        const audience = input.audience.map((member) => ({
          ...member,
          ...input.scope,
        }));
        const binding = authoritativeBinding(input.binding, 'record_published', current, {
          readback: input.readback,
          audience,
        });
        const priorReceipt = await unit.findReceipt(
          input.scope,
          'record_published',
          binding.idempotencyKey,
        );
        if (priorReceipt) {
          assertReceiptReplay(
            priorReceipt,
            'record_published',
            binding.requestHash,
            input.contentId,
          );
          return { record: current, replay: true as const };
        }
        const pendingProviderContext = current.pendingProviderOperationId
          ? await unit.getPendingPublishProviderContext(
              input.scope,
              current.pendingProviderOperationId,
            )
          : null;
        if (!pendingProviderContext) return providerConflict();
        const eligibility = await Promise.all(
          audience.map((member) =>
            unit.getCurrentPublicationEligibility(
              input.scope,
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
          audience,
          eligibility: eligibility.filter((entry) => entry !== null),
          pendingProviderContext,
          binding,
        });
        await unit.saveContent(result.record, current.version);
        await unit.savePublicationMaterialization(result.materialization);
        await unit.completePublishProviderOperation(result.providerCompletion);
        await unit.saveReceipt(receipt('record_published', result.record, binding));
        return { record: result.record, replay: false as const };
      });
    },

    attachOccurrence(input: {
      principal: ContentPublicationPrincipal;
      contentId: string;
      relation: Omit<
        GovernedContentOccurrenceRelation,
        'governedByAdminId' | 'attachedAt' | 'accountKey' | 'productKey'
      >;
      binding: ContentPublicationCommandBinding;
    }) {
      return deps.repository.inTransaction(async (unit) => {
        assertAdminPublicationPrincipal(input.principal);
        const scope = principalScope(input.principal);
        const current = await requiredContent(unit, scope, input.contentId);
        const relation: Omit<
          GovernedContentOccurrenceRelation,
          'governedByAdminId' | 'attachedAt'
        > = {
          ...input.relation,
          accountKey: scope.accountKey,
          productKey: input.principal.productKey,
        };
        const binding = authoritativeBinding(input.binding, 'attach_occurrence', current, relation);
        const priorReceipt = await unit.findReceipt(
          scope,
          'attach_occurrence',
          binding.idempotencyKey,
        );
        if (priorReceipt) {
          assertReceiptReplay(
            priorReceipt,
            'attach_occurrence',
            binding.requestHash,
            input.contentId,
          );
          return { record: current, replay: true as const };
        }
        const canonicalOccurrence = await unit.getCanonicalGovernedOccurrence(
          scope,
          input.relation.occurrenceId,
        );
        if (!canonicalOccurrence) return governedOccurrenceUnavailable();
        const next = attachOccurrence({
          principal: input.principal,
          record: current,
          relation,
          canonicalOccurrence,
          binding,
        });
        await unit.saveContent(next, current.version);
        await unit.saveReceipt(receipt('attach_occurrence', next, binding));
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
        requestPayload: {},
        apply: (record, binding) => {
          const result = unpublishContent({
            principal: input.principal,
            record,
            binding,
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
        requestPayload: {},
        apply: (record, binding) => {
          const result = archiveContent({
            principal: input.principal,
            record,
            binding,
          });
          return result.intent
            ? { record: result.record, outboxIntent: result.intent }
            : result.record;
        },
      });
    },

    playback(input: { principal: ContentPublicationPrincipal; contentId: string; now: Date }) {
      return deps.repository.inTransaction(async (unit) => {
        const scope = principalScope(input.principal);
        const record = await requiredContent(unit, scope, input.contentId);
        const assignment = input.principal.studentId
          ? await unit.getAssignment(scope, input.principal.studentId, input.contentId)
          : null;
        const facts = input.principal.studentId
          ? await unit.getPlaybackFacts(scope, input.principal.studentId, input.contentId)
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
        const scope = principalScope(input.principal);
        const published = await unit.listPublishedContent(scope);
        const assignmentEntries = await Promise.all(
          published.map(
            async (record) =>
              [
                record.contentId,
                input.principal.studentId
                  ? await unit.getAssignment(scope, input.principal.studentId, record.contentId)
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
                  ? await unit.getPlaybackFacts(scope, input.principal.studentId, record.contentId)
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
                  ? await unit.getResume(scope, input.principal.studentId, record.contentId)
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
        const scope = principalScope(input.principal);
        const record = await requiredContent(unit, scope, input.contentId);
        const binding = authoritativeBinding(input.binding, 'save_resume', record, {
          positionMs: input.positionMs,
        });
        const assignment = studentId
          ? await unit.getAssignment(scope, studentId, input.contentId)
          : null;
        const facts = studentId
          ? await unit.getPlaybackFacts(scope, studentId, input.contentId)
          : null;
        assertStudentContentAccess({
          principal: input.principal,
          record,
          assignment,
          facts,
        });
        const priorReceipt = await unit.findReceipt(scope, 'save_resume', binding.idempotencyKey);
        if (priorReceipt) {
          assertReceiptReplay(priorReceipt, 'save_resume', binding.requestHash, input.contentId);
          if (!studentId) return unavailable();
          return (await unit.getResume(scope, studentId, input.contentId)) ?? unavailable();
        }
        const existing = studentId ? await unit.getResume(scope, studentId, input.contentId) : null;
        const resume = saveStudentResume({
          principal: input.principal,
          record,
          assignment,
          facts,
          existing,
          positionMs: input.positionMs,
          occurredAt: binding.occurredAt,
        });
        await unit.saveResume(resume, existing?.version ?? null);
        await unit.saveReceipt(receipt('save_resume', record, binding));
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
  requestPayload: unknown;
  apply: (
    record: Awaited<ReturnType<typeof requiredContent>>,
    binding: ContentPublicationCommandBinding,
  ) =>
    | Awaited<ReturnType<typeof requiredContent>>
    | {
        record: Awaited<ReturnType<typeof requiredContent>>;
        outboxIntent: ContentPublicationOutboxIntent;
      };
}) {
  return input.repository.inTransaction(async (unit) => {
    assertAdminPublicationPrincipal(input.principal);
    const scope = principalScope(input.principal);
    const current = await requiredContent(unit, scope, input.contentId);
    const binding = authoritativeBinding(
      input.binding,
      input.operation,
      current,
      input.requestPayload,
    );
    const priorReceipt = await unit.findReceipt(scope, input.operation, binding.idempotencyKey);
    if (priorReceipt) {
      assertReceiptReplay(priorReceipt, input.operation, binding.requestHash, input.contentId);
      return { record: current, replay: true as const };
    }
    const applied = input.apply(current, binding);
    const next = 'record' in applied ? applied.record : applied;
    await unit.saveContent(next, current.version);
    if ('outboxIntent' in applied) await unit.saveOutboxIntent(applied.outboxIntent);
    await unit.saveReceipt(receipt(input.operation, next, binding));
    return { record: next, replay: false as const };
  });
}

function receipt(
  operation: ContentPublicationOperation,
  record: Awaited<ReturnType<typeof requiredContent>>,
  binding: ContentPublicationCommandBinding,
): ContentPublicationReceipt {
  return {
    accountKey: record.accountKey,
    productKey: record.productKey,
    operation,
    contentId: record.contentId,
    resultVersion: record.version,
    idempotencyKey: binding.idempotencyKey,
    requestHash: binding.requestHash,
    committedAt: new Date(binding.occurredAt).toISOString(),
    approvalProjectionDigest:
      record.approval?.evidence.projectionDigest ?? record.contentVersionDigest,
  };
}

async function requiredContent(
  unit: Parameters<Parameters<ContentPublicationRepository['inTransaction']>[0]>[0],
  scope: ContentPublicationScope,
  contentId: string,
) {
  const record = await unit.getContent(scope, contentId);
  if (!record) return unavailable();
  if (record.accountKey !== scope.accountKey || record.productKey !== scope.productKey) {
    return unavailable();
  }
  return record;
}

function principalScope(principal: ContentPublicationPrincipal): ContentPublicationScope {
  return { accountKey: principal.accountKey, productKey: principal.productKey };
}

function authoritativeBinding(
  binding: ContentPublicationCommandBinding,
  operation: ContentPublicationOperation,
  record: Awaited<ReturnType<typeof requiredContent>>,
  requestPayload: unknown,
  approvalProjectionDigest = record.approval?.evidence.projectionDigest ?? null,
): ContentPublicationCommandBinding {
  return {
    ...binding,
    requestHash: publicationRequestHash({
      operation,
      accountKey: record.accountKey,
      productKey: record.productKey,
      contentId: record.contentId,
      contentVersionId: record.contentVersionId,
      approvalProjectionDigest,
      expectedVersion: binding.expectedVersion,
      requestPayload,
    }),
  };
}

function unavailable(): never {
  throw new ContentPublicationError(
    CONTENT_PUBLICATION_ERROR_CODES.unavailable,
    'Content is unavailable.',
  );
}

function approvalUnavailable(): never {
  throw new ContentPublicationError(
    CONTENT_PUBLICATION_ERROR_CODES.invalidState,
    'Approved processing evidence is unavailable.',
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
