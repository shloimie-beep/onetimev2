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
  PendingContentPublicationProviderContext,
  StudentPublicationAudience,
  VimeoContentPublicationReadbackAdapter,
  VimeoContentPublicationObservation,
} from '../../../../../../../packages/contracts/src/content/publication/index.ts';
import type { ProviderRegistryBinding } from '../../../../../../../packages/contracts/src/providers/v21-provider-core.ts';
import {
  archiveContent,
  approveContent,
  assertAdminPublicationPrincipal,
  assertRegisteredProjectionReplay,
  assertReceiptReplay,
  assertStudentContentAccess,
  attachOccurrence,
  authorizeStudentPlayback,
  createContentPublicationProviderOperation,
  createReviewReadyContentFromProjection,
  recordPrivatePublication,
  recordPrivateRevocation,
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
  vimeoProviderBinding: ProviderRegistryBinding;
  vimeoReadbackAdapter: VimeoContentPublicationReadbackAdapter;
  providerReadbackTimeoutMs?: number;
  createId: () => string;
}) {
  return {
    async registerApprovedProjection(input: {
      principal: ContentPublicationPrincipal;
      contentVersionId: string;
    }) {
      assertAdminPublicationPrincipal(input.principal);
      const scope = principalScope(input.principal);
      const evidence = await deps.approvedProjectionRepository.getApprovedForPublicationProjection({
        ...scope,
        contentVersionId: input.contentVersionId,
      });
      if (
        !evidence ||
        evidence.accountKey !== scope.accountKey ||
        evidence.productKey !== scope.productKey ||
        evidence.contentVersionId !== input.contentVersionId
      ) {
        return approvalUnavailable();
      }
      return deps.repository.inTransaction(async (unit) => {
        const canonicalOccurrence = await unit.getCanonicalGovernedOccurrence(
          scope,
          evidence.contentId,
        );
        if (!canonicalOccurrence) return governedOccurrenceUnavailable();
        const proposed = createReviewReadyContentFromProjection({
          principal: input.principal,
          evidence,
          canonicalOccurrence,
        });
        const registration = await unit.registerContent(proposed);
        assertRegisteredProjectionReplay(registration.record, evidence, canonicalOccurrence);
        await unit.bootstrapCanonicalContentState(registration.record, evidence);
        return {
          record: registration.record,
          replay: !registration.inserted,
        };
      });
    },

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
          assertReceiptReplay(priorReceipt, 'approve', binding.requestHash, current);
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
        await unit.appendCanonicalContentStateTransition({
          record: next,
          operation: 'approve',
          previousState: current.state,
          nextState: next.state,
          actorKind: 'admin',
          actorKey: input.principal.actorId,
          idempotencyKey: binding.idempotencyKey,
          requestHash: binding.requestHash,
          occurredAt: binding.occurredAt,
        });
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
        vimeoProviderBinding: deps.vimeoProviderBinding,
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
      providerOperationId: string;
      audience: readonly Omit<StudentPublicationAudience, 'accountKey' | 'productKey'>[];
      binding: ContentPublicationCommandBinding;
    }) {
      const prepared = await deps.repository.inTransaction(async (unit) => {
        const current = await requiredContent(unit, input.scope, input.contentId);
        const audience = input.audience.map((member) => ({
          ...member,
          ...input.scope,
        }));
        const binding = authoritativeBinding(input.binding, 'record_published', current, {
          providerOperationId: input.providerOperationId,
          audience,
        });
        const priorReceipt = await unit.findReceipt(
          input.scope,
          'record_published',
          binding.idempotencyKey,
        );
        if (priorReceipt) {
          assertReceiptReplay(priorReceipt, 'record_published', binding.requestHash, current);
          return { replayResult: { record: current, replay: true as const } };
        }
        const pendingProviderContext =
          current.pendingProviderOperationId === input.providerOperationId
            ? await unit.getPendingProviderContext(
                input.scope,
                input.providerOperationId,
                'publish_private',
              )
            : null;
        if (!pendingProviderContext) return providerConflict();
        const executionScope = await unit.resolveCanonicalContentExecutionScope(current);
        assertProviderExecutionScope(executionScope, pendingProviderContext.executionScope);
        return { pendingProviderContext };
      });
      if ('replayResult' in prepared) return prepared.replayResult;
      const observation = await readCanonicalVimeo(
        deps.vimeoReadbackAdapter,
        prepared.pendingProviderContext,
        deps.providerReadbackTimeoutMs,
      );
      if (observation.operation !== 'publish_private') return providerConflict();
      return deps.repository.inTransaction(async (unit) => {
        const current = await requiredContent(unit, input.scope, input.contentId);
        const audience = input.audience.map((member) => ({
          ...member,
          ...input.scope,
        }));
        const binding = authoritativeBinding(input.binding, 'record_published', current, {
          providerOperationId: input.providerOperationId,
          audience,
        });
        const priorReceipt = await unit.findReceipt(
          input.scope,
          'record_published',
          binding.idempotencyKey,
        );
        if (priorReceipt) {
          assertReceiptReplay(priorReceipt, 'record_published', binding.requestHash, current);
          return { record: current, replay: true as const };
        }
        const pendingProviderContext =
          current.pendingProviderOperationId === input.providerOperationId
            ? await unit.getPendingProviderContext(
                input.scope,
                input.providerOperationId,
                'publish_private',
              )
            : null;
        if (
          !pendingProviderContext ||
          JSON.stringify(pendingProviderContext) !== JSON.stringify(prepared.pendingProviderContext)
        ) {
          return providerConflict();
        }
        const executionScope = await unit.resolveCanonicalContentExecutionScope(current);
        assertProviderExecutionScope(executionScope, pendingProviderContext.executionScope);
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
          observation,
          audience,
          eligibility: eligibility.filter((entry) => entry !== null),
          pendingProviderContext,
          binding,
        });
        await unit.saveContent(result.record, current.version);
        await unit.savePublicationMaterialization(result.materialization);
        await unit.completeProviderOperation(result.providerCompletion);
        await unit.appendCanonicalContentStateTransition({
          record: result.record,
          operation: 'record_published',
          previousState: current.state,
          nextState: result.record.state,
          actorKind: 'reconciler',
          actorKey: 'content-publication-vimeo-readback',
          idempotencyKey: binding.idempotencyKey,
          requestHash: binding.requestHash,
          occurredAt: binding.occurredAt,
        });
        await unit.saveReceipt(receipt('record_published', result.record, binding));
        return { record: result.record, replay: false as const };
      });
    },

    async applyPrivateRevocationReadback(input: {
      scope: ContentPublicationScope;
      contentId: string;
      providerOperationId: string;
      binding: ContentPublicationCommandBinding;
    }) {
      const prepared = await deps.repository.inTransaction(async (unit) => {
        const current = await requiredContent(unit, input.scope, input.contentId);
        const binding = authoritativeBinding(input.binding, 'record_revoked', current, {
          providerOperationId: input.providerOperationId,
        });
        const priorReceipt = await unit.findReceipt(
          input.scope,
          'record_revoked',
          binding.idempotencyKey,
        );
        if (priorReceipt) {
          assertReceiptReplay(priorReceipt, 'record_revoked', binding.requestHash, current);
          return { replayResult: { record: current, replay: true as const } };
        }
        const pendingProviderContext =
          current.pendingProviderOperationId === input.providerOperationId
            ? await unit.getPendingProviderContext(
                input.scope,
                input.providerOperationId,
                'revoke_private',
              )
            : null;
        if (!pendingProviderContext) return providerConflict();
        const executionScope = await unit.resolveCanonicalContentExecutionScope(current);
        assertProviderExecutionScope(executionScope, pendingProviderContext.executionScope);
        return { pendingProviderContext };
      });
      if ('replayResult' in prepared) return prepared.replayResult;
      const observation = await readCanonicalVimeo(
        deps.vimeoReadbackAdapter,
        prepared.pendingProviderContext,
        deps.providerReadbackTimeoutMs,
      );
      if (observation.operation !== 'revoke_private') return providerConflict();
      return deps.repository.inTransaction(async (unit) => {
        const current = await requiredContent(unit, input.scope, input.contentId);
        const binding = authoritativeBinding(input.binding, 'record_revoked', current, {
          providerOperationId: input.providerOperationId,
        });
        const priorReceipt = await unit.findReceipt(
          input.scope,
          'record_revoked',
          binding.idempotencyKey,
        );
        if (priorReceipt) {
          assertReceiptReplay(priorReceipt, 'record_revoked', binding.requestHash, current);
          return { record: current, replay: true as const };
        }
        const pendingProviderContext =
          current.pendingProviderOperationId === input.providerOperationId
            ? await unit.getPendingProviderContext(
                input.scope,
                input.providerOperationId,
                'revoke_private',
              )
            : null;
        if (
          !pendingProviderContext ||
          JSON.stringify(pendingProviderContext) !== JSON.stringify(prepared.pendingProviderContext)
        ) {
          return providerConflict();
        }
        const executionScope = await unit.resolveCanonicalContentExecutionScope(current);
        assertProviderExecutionScope(executionScope, pendingProviderContext.executionScope);
        const result = recordPrivateRevocation({
          record: current,
          observation,
          pendingProviderContext,
          binding,
        });
        await unit.saveContent(result.record, current.version);
        await unit.completeProviderOperation(result.providerCompletion);
        await unit.saveReceipt(receipt('record_revoked', result.record, binding));
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
          assertReceiptReplay(priorReceipt, 'attach_occurrence', binding.requestHash, current);
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
        vimeoProviderBinding: deps.vimeoProviderBinding,
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
        vimeoProviderBinding: deps.vimeoProviderBinding,
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
        const facts = assignment
          ? await unit.refreshPlaybackFacts(scope, input.principal, assignment)
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
        const assignments = new Map(assignmentEntries);
        const factEntries = await Promise.all(
          published.map(async (record) => {
            const assignment = assignments.get(record.contentId);
            return [
              record.contentId,
              assignment
                ? await unit.refreshPlaybackFacts(scope, input.principal, assignment)
                : null,
            ] as const;
          }),
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
          assignments,
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
        const facts = assignment
          ? await unit.refreshPlaybackFacts(scope, input.principal, assignment)
          : null;
        assertStudentContentAccess({
          principal: input.principal,
          record,
          assignment,
          facts,
        });
        const priorReceipt = await unit.findReceipt(scope, 'save_resume', binding.idempotencyKey);
        if (priorReceipt) {
          assertReceiptReplay(priorReceipt, 'save_resume', binding.requestHash, record);
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
  vimeoProviderBinding: ProviderRegistryBinding;
  principal: ContentPublicationPrincipal;
  contentId: string;
  operation: 'request_publish' | 'unpublish' | 'archive';
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
      assertReceiptReplay(priorReceipt, input.operation, binding.requestHash, current);
      return { record: current, replay: true as const };
    }
    const applied = input.apply(current, binding);
    const next = 'record' in applied ? applied.record : applied;
    if ('outboxIntent' in applied) {
      const executionScope = await unit.resolveCanonicalContentExecutionScope(current);
      assertProviderExecutionScope(executionScope, input.vimeoProviderBinding.scope);
      const providerOperation = createContentPublicationProviderOperation({
        intent: applied.outboxIntent,
        binding: input.vimeoProviderBinding,
      });
      await unit.saveProviderOperation(providerOperation);
    }
    await unit.saveContent(next, current.version);
    if ('outboxIntent' in applied) await unit.saveOutboxIntent(applied.outboxIntent);
    await unit.appendCanonicalContentStateTransition({
      record: next,
      operation: input.operation,
      previousState: current.state,
      nextState: next.state,
      actorKind: 'admin',
      actorKey: input.principal.actorId,
      idempotencyKey: binding.idempotencyKey,
      requestHash: binding.requestHash,
      occurredAt: binding.occurredAt,
    });
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
    contentVersionId: record.contentVersionId,
    publicationGeneration: record.publicationGeneration,
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

function assertProviderExecutionScope(
  expected: ProviderRegistryBinding['scope'],
  actual: ProviderRegistryBinding['scope'] | undefined,
) {
  if (
    !actual ||
    actual.product !== expected.product ||
    actual.runtime_tier !== expected.runtime_tier ||
    actual.verification_environment_id !== expected.verification_environment_id
  ) {
    return providerConflict();
  }
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

async function readCanonicalVimeo(
  adapter: VimeoContentPublicationReadbackAdapter,
  context: PendingContentPublicationProviderContext,
  timeoutMs = 10_000,
): Promise<VimeoContentPublicationObservation> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    throw new ContentPublicationError(
      CONTENT_PUBLICATION_ERROR_CODES.conflict,
      'Provider readback timeout is invalid.',
    );
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await adapter.readCanonical(context, controller.signal);
  } catch {
    throw new ContentPublicationError(
      CONTENT_PUBLICATION_ERROR_CODES.unavailable,
      'Canonical Vimeo readback is unavailable.',
    );
  } finally {
    clearTimeout(timeout);
  }
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
