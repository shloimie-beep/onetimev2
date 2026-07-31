import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createPostgresContentPublicationRepository,
  type ContentPublicationSqlClient,
} from './repository.ts';
import type { ProviderOperation } from '../../../../contracts/src/providers/v21-provider-core.ts';
import type {
  ContentPublicationPrincipal,
  ContentPublicationRecord,
  StudentContentAssignment,
  StudentPublicationEligibility,
} from '../../../../contracts/src/content/publication/index.ts';

const scope = {
  accountKey: 'account_one',
  productKey: 'one_time_mishnayos' as const,
};
const approvalEvidence = {
  ...scope,
  contentId: 'content_one',
  contentVersionId: 'content_version_one',
  contentVersionDigest: '1'.repeat(64),
  sourceId: 'source_one',
  sourceSha256: '1'.repeat(64),
  sourceObjectVersionId: 'source_object_version_one',
  participantSetVersion: 'participant_set_v1',
  participantSnapshotDigest: '2'.repeat(64),
  participantReviewState: 'complete' as const,
  unresolvedParticipantCount: 0,
  requiredRedactionCount: 1,
  completedRedactionCount: 1,
  redactionReviewDigest: '3'.repeat(64),
  title: 'Berachos Review',
  englishTranscriptText: 'Approved transcript',
  classTopic: 'Berachos',
  mishnahReferences: ['Berachos 1:1'],
  occurredAt: '2026-07-27T16:00:00.000Z',
  durationMs: 3_600_000,
  approvedByAdminId: 'admin_one',
  approvedAt: '2026-07-29T10:39:00.000Z',
  artifacts: [],
  approvedArtifactSetDigest: '3'.repeat(64),
  sourceEvidenceDigest: '4'.repeat(64),
  projectionDigest: '5'.repeat(64),
};

describe('P21 PostgreSQL publication repository', () => {
  it('registers a source-complete review-ready publication with composite convergence', async () => {
    const record = reviewReadyRecord();
    const client = new CapturingClient(false, undefined, (text) =>
      text.includes('INSERT INTO onetime.content_publications') ? [{ record_json: record }] : [],
    );
    const repository = createPostgresContentPublicationRepository({
      connect: async () => client,
    });

    await expect(repository.inTransaction((unit) => unit.registerContent(record))).resolves.toEqual(
      { record, inserted: true },
    );

    const insert = client.queries[1];
    expect(insert?.text).toContain('ON CONFLICT (account_key, product_key, content_id) DO NOTHING');
    expect(insert?.text).toContain('RETURNING record_json');
    expect(insert?.values?.slice(0, 9)).toEqual([
      record.accountKey,
      record.productKey,
      record.contentId,
      record.contentVersionId,
      record.contentVersionDigest,
      1,
      'needs_review',
      0,
      1,
    ]);
  });

  it('bootstraps four ordered canonical events and exact replay performs no write', async () => {
    const record = reviewReadyRecord();
    const events: Record<string, unknown>[] = [];
    let canonicalReady = false;
    let canonicalState: ContentPublicationRecord['state'] = 'needs_review';
    let canonicalStateVersion = 4;
    const client = new CapturingClient(false, undefined, (text, values) => {
      if (text.includes('FROM onetime.content_processing_versions AS version_row')) {
        return [canonicalScopeRow()];
      }
      if (text.includes('FROM onetime.canonical_aggregate_states')) {
        return canonicalReady
          ? [
              {
                aggregate_kind: 'content',
                aggregate_key: record.contentId,
                current_state: canonicalState,
                version: canonicalStateVersion,
                product_key: 'one_time_mishnayos',
                runtime_tier: 'isolated_staging',
                verification_environment_id: 'ci',
              },
            ]
          : [];
      }
      if (text.includes('INSERT INTO onetime.canonical_state_transition_events')) {
        const event = {
          transition_key: values?.[0],
          previous_state: values?.[2],
          next_state: values?.[3],
          expected_version: values?.[4],
          resulting_version: values?.[5],
          product_key: values?.[6],
          runtime_tier: values?.[7],
          verification_environment_id: values?.[8],
          actor_kind: values?.[9],
          actor_key: values?.[10],
          idempotency_key: values?.[11],
          canonical_request_hash: values?.[12],
        };
        events.push(event);
        canonicalReady = events.length === 4;
        return [{ resulting_version: values?.[5] }];
      }
      if (
        text.includes('FROM onetime.canonical_state_transition_events') &&
        text.includes('ANY($2::text[])')
      ) {
        return events;
      }
      return undefined;
    });
    const repository = createPostgresContentPublicationRepository({
      connect: async () => client,
    });

    await expect(
      repository.inTransaction((unit) =>
        unit.bootstrapCanonicalContentState(record, approvalEvidence),
      ),
    ).resolves.toEqual({ replay: false, resultingVersion: 4 });
    const firstWriteCount = client.queries.filter((query) =>
      query.text.includes('INSERT INTO onetime.canonical_state_transition_events'),
    ).length;
    await expect(
      repository.inTransaction((unit) =>
        unit.bootstrapCanonicalContentState(record, approvalEvidence),
      ),
    ).resolves.toEqual({ replay: true, resultingVersion: 4 });
    canonicalState = 'approved';
    canonicalStateVersion = 5;
    const publicationVersionOnlyDiverged = {
      ...record,
      state: 'approved' as const,
      version: 3,
      approval: {
        approvalId: 'approval_one',
        approvedByAdminId: approvalEvidence.approvedByAdminId,
        approvedAt: approvalEvidence.approvedAt,
        policyVersion: 'content-publication-v2',
        evidence: approvalEvidence,
      },
    };
    await expect(
      repository.inTransaction((unit) =>
        unit.bootstrapCanonicalContentState(publicationVersionOnlyDiverged, approvalEvidence),
      ),
    ).resolves.toEqual({ replay: true, resultingVersion: 5 });

    expect(firstWriteCount).toBe(4);
    expect(
      client.queries.filter((query) =>
        query.text.includes('INSERT INTO onetime.canonical_state_transition_events'),
      ),
    ).toHaveLength(4);
    expect(events.map((event) => [event.previous_state, event.next_state])).toEqual([
      [null, 'received'],
      ['received', 'validating'],
      ['validating', 'processing'],
      ['processing', 'needs_review'],
    ]);
    expect(events.map((event) => event.expected_version)).toEqual([0, 1, 2, 3]);
    expect(events.map((event) => event.actor_kind)).toEqual([
      'reconciler',
      'reconciler',
      'reconciler',
      'reconciler',
    ]);
    expect(events.map((event) => event.idempotency_key)).toEqual([
      'content:bootstrap:1:received',
      'content:bootstrap:2:validating',
      'content:bootstrap:3:processing',
      'content:bootstrap:4:needs_review',
    ]);
    const sql = client.queries.map((query) => query.text).join('\n');
    expect(sql).toContain('JOIN onetime.content_sources_v21 AS source_row');
    expect(sql).toContain('source_row.source_sha256 = version_row.source_sha256');
    expect(sql).toContain('FOR SHARE OF version_row, source_row');
    expect(sql).toContain('FROM onetime.canonical_aggregate_states');
    expect(sql).toContain('FOR UPDATE');
    expect(sql).not.toMatch(
      /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+onetime\.canonical_aggregate_states/i,
    );
    expect(readFileSync(new URL('./repository.ts', import.meta.url), 'utf8')).not.toMatch(
      /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+onetime\.canonical_aggregate_states/i,
    );
  });

  it('derives the exact locked source scope for a pre-approval archive', async () => {
    const archived = {
      ...reviewReadyRecord(),
      state: 'archived' as const,
      version: 2,
      archivedAt: '2026-07-29T10:44:00.000Z',
      updatedAt: '2026-07-29T10:44:00.000Z',
    };
    const client = new CapturingClient(false, undefined, (text, values) => {
      if (text.includes('FROM onetime.content_processing_versions AS version_row')) {
        return [canonicalScopeRow()];
      }
      if (text.includes('FROM onetime.canonical_aggregate_states')) {
        return [
          {
            aggregate_kind: 'content',
            aggregate_key: archived.contentId,
            current_state: 'needs_review',
            version: 4,
            product_key: 'one_time_mishnayos',
            runtime_tier: 'isolated_staging',
            verification_environment_id: 'ci',
          },
        ];
      }
      if (text.includes('INSERT INTO onetime.canonical_state_transition_events')) {
        return [{ resulting_version: values?.[5] }];
      }
      return undefined;
    });
    const repository = createPostgresContentPublicationRepository({
      connect: async () => client,
    });

    await expect(
      repository.inTransaction((unit) =>
        unit.appendCanonicalContentStateTransition({
          record: archived,
          operation: 'archive',
          scopeDerivation: 'approved_processing_source',
          previousState: 'needs_review',
          nextState: 'archived',
          actorKind: 'admin',
          actorKey: 'admin_one',
          idempotencyKey: 'archive.before.approval',
          requestHash: 'a'.repeat(64),
          occurredAt: archived.updatedAt,
        }),
      ),
    ).resolves.toEqual({ replay: false, resultingVersion: 5 });

    const sourceRead = client.queries.find((query) =>
      query.text.includes('FROM onetime.content_processing_versions AS version_row'),
    );
    expect(sourceRead?.text).toContain("version_row.processing_state = 'approved'");
    expect(sourceRead?.text).toContain('FOR SHARE OF version_row, source_row');
    expect(sourceRead?.values).toEqual([
      archived.accountKey,
      archived.productKey,
      archived.contentVersionId,
      archived.contentId,
      archived.contentVersionDigest,
    ]);
    expect(
      client.queries.filter((query) =>
        query.text.includes('INSERT INTO onetime.canonical_state_transition_events'),
      ),
    ).toHaveLength(1);
    await expect(
      repository.inTransaction((unit) =>
        unit.appendCanonicalContentStateTransition({
          record: archived,
          operation: 'approve',
          scopeDerivation: 'approved_processing_source',
          previousState: 'needs_review',
          nextState: 'approved',
          actorKind: 'admin',
          actorKey: 'admin_one',
          idempotencyKey: 'invalid.processing.source.derivation',
          requestHash: 'b'.repeat(64),
          occurredAt: archived.updatedAt,
        }),
      ),
    ).rejects.toThrowError('content_canonical_scope_derivation_conflict');
    expect(client.queries.at(-1)?.text).toBe('ROLLBACK');
    expect(
      client.queries.filter((query) =>
        query.text.includes('INSERT INTO onetime.canonical_state_transition_events'),
      ),
    ).toHaveLength(1);
  });

  it('uses the locked canonical version and operation-namespaces raw idempotency', async () => {
    const next = {
      ...reviewReadyRecord(),
      version: 3,
      state: 'publishing' as const,
      approval: {
        approvalId: 'approval_one',
        approvedByAdminId: 'admin_one',
        approvedAt: approvalEvidence.approvedAt,
        policyVersion: 'content-publication-v2',
        evidence: approvalEvidence,
      },
    };
    const client = new CapturingClient(false, undefined, (text, values) => {
      if (text.includes('FROM onetime.content_processing_versions AS version_row')) {
        return [canonicalScopeRow()];
      }
      if (text.includes('FROM onetime.canonical_aggregate_states')) {
        return [
          {
            aggregate_kind: 'content',
            aggregate_key: next.contentId,
            current_state: 'approved',
            version: 11,
            product_key: 'one_time_mishnayos',
            runtime_tier: 'isolated_staging',
            verification_environment_id: 'ci',
          },
        ];
      }
      if (text.includes('INSERT INTO onetime.canonical_state_transition_events')) {
        return [{ resulting_version: values?.[5] }];
      }
      return undefined;
    });
    const repository = createPostgresContentPublicationRepository({
      connect: async () => client,
    });

    await expect(
      repository.inTransaction((unit) =>
        unit.appendCanonicalContentStateTransition({
          record: next,
          operation: 'request_publish',
          scopeDerivation: 'approved_projection',
          previousState: 'approved',
          nextState: 'publishing',
          actorKind: 'admin',
          actorKey: 'admin_one',
          idempotencyKey: 'same.raw.key',
          requestHash: 'a'.repeat(64),
          occurredAt: '2026-07-29T10:44:00.000Z',
        }),
      ),
    ).resolves.toEqual({ replay: false, resultingVersion: 12 });

    const insert = client.queries.find((query) =>
      query.text.includes('INSERT INTO onetime.canonical_state_transition_events'),
    );
    expect(insert?.values?.slice(1, 13)).toEqual([
      'content_one',
      'approved',
      'publishing',
      11,
      12,
      'one_time_mishnayos',
      'isolated_staging',
      'ci',
      'admin',
      'admin_one',
      'content:request_publish:same.raw.key',
      expect.stringMatching(/^[a-f0-9]{64}$/),
    ]);
    expect(next.version).toBe(3);
  });

  it('rolls back source and canonical event conflicts before commit', async () => {
    const record = {
      ...reviewReadyRecord(),
      version: 2,
      state: 'approved' as const,
      approval: {
        approvalId: 'approval_one',
        approvedByAdminId: 'admin_one',
        approvedAt: approvalEvidence.approvedAt,
        policyVersion: 'content-publication-v2',
        evidence: approvalEvidence,
      },
    };
    const sourceMissing = new CapturingClient();
    const sourceRepository = createPostgresContentPublicationRepository({
      connect: async () => sourceMissing,
    });
    await expect(
      sourceRepository.inTransaction((unit) =>
        unit.appendCanonicalContentStateTransition({
          record,
          operation: 'approve',
          scopeDerivation: 'approved_projection',
          previousState: 'needs_review',
          nextState: 'approved',
          actorKind: 'admin',
          actorKey: 'admin_one',
          idempotencyKey: 'approve.key',
          requestHash: 'a'.repeat(64),
          occurredAt: '2026-07-29T10:44:00.000Z',
        }),
      ),
    ).rejects.toThrowError('content_canonical_source_scope_unavailable');
    expect(sourceMissing.queries.at(-1)?.text).toBe('ROLLBACK');
    expect(
      sourceMissing.queries.some((query) =>
        query.text.includes('INSERT INTO onetime.canonical_state_transition_events'),
      ),
    ).toBe(false);

    const sourceMismatch = new CapturingClient(false, undefined, (text) =>
      text.includes('FROM onetime.content_processing_versions AS version_row')
        ? [{ ...canonicalScopeRow(), source_key: 'source_other' }]
        : undefined,
    );
    const sourceMismatchRepository = createPostgresContentPublicationRepository({
      connect: async () => sourceMismatch,
    });
    await expect(
      sourceMismatchRepository.inTransaction((unit) =>
        unit.appendCanonicalContentStateTransition({
          record,
          operation: 'approve',
          scopeDerivation: 'approved_projection',
          previousState: 'needs_review',
          nextState: 'approved',
          actorKind: 'admin',
          actorKey: 'admin_one',
          idempotencyKey: 'approve.key',
          requestHash: 'a'.repeat(64),
          occurredAt: '2026-07-29T10:44:00.000Z',
        }),
      ),
    ).rejects.toThrowError('content_canonical_source_binding_conflict');
    expect(sourceMismatch.queries.at(-1)?.text).toBe('ROLLBACK');
    expect(
      sourceMismatch.queries.some((query) =>
        query.text.includes('FROM onetime.canonical_aggregate_states'),
      ),
    ).toBe(false);

    const eventConflict = new CapturingClient(
      false,
      'INSERT INTO onetime.canonical_state_transition_events',
      (text) => {
        if (text.includes('FROM onetime.content_processing_versions AS version_row')) {
          return [canonicalScopeRow()];
        }
        if (text.includes('FROM onetime.canonical_aggregate_states')) {
          return [
            {
              aggregate_kind: 'content',
              aggregate_key: record.contentId,
              current_state: 'needs_review',
              version: 4,
              product_key: 'one_time_mishnayos',
              runtime_tier: 'isolated_staging',
              verification_environment_id: 'ci',
            },
          ];
        }
        return undefined;
      },
    );
    const eventRepository = createPostgresContentPublicationRepository({
      connect: async () => eventConflict,
    });
    await expect(
      eventRepository.inTransaction((unit) =>
        unit.appendCanonicalContentStateTransition({
          record,
          operation: 'approve',
          scopeDerivation: 'approved_projection',
          previousState: 'needs_review',
          nextState: 'approved',
          actorKind: 'admin',
          actorKey: 'admin_one',
          idempotencyKey: 'approve.key',
          requestHash: 'a'.repeat(64),
          occurredAt: '2026-07-29T10:44:00.000Z',
        }),
      ),
    ).rejects.toThrowError('content_canonical_state_event_conflict');
    expect(eventConflict.queries.at(-1)?.text).toBe('ROLLBACK');
    expect(eventConflict.queries.some((query) => query.text === 'COMMIT')).toBe(false);

    const changedReplay = new CapturingClient(false, undefined, (text) => {
      if (text.includes('FROM onetime.content_processing_versions AS version_row')) {
        return [canonicalScopeRow()];
      }
      if (text.includes('FROM onetime.canonical_aggregate_states')) {
        return [
          {
            aggregate_kind: 'content',
            aggregate_key: record.contentId,
            current_state: 'approved',
            version: 5,
            product_key: 'one_time_mishnayos',
            runtime_tier: 'isolated_staging',
            verification_environment_id: 'ci',
          },
        ];
      }
      if (
        text.includes('FROM onetime.canonical_state_transition_events') &&
        text.includes('idempotency_key = $2')
      ) {
        return [
          {
            transition_key: 'f'.repeat(64),
            previous_state: 'needs_review',
            next_state: 'approved',
            expected_version: 4,
            resulting_version: 5,
            product_key: 'one_time_mishnayos',
            runtime_tier: 'isolated_staging',
            verification_environment_id: 'ci',
            actor_kind: 'admin',
            actor_key: 'admin_one',
            idempotency_key: 'content:approve:approve.key',
            canonical_request_hash: '0'.repeat(64),
          },
        ];
      }
      return undefined;
    });
    const changedReplayRepository = createPostgresContentPublicationRepository({
      connect: async () => changedReplay,
    });
    await expect(
      changedReplayRepository.inTransaction((unit) =>
        unit.appendCanonicalContentStateTransition({
          record,
          operation: 'approve',
          scopeDerivation: 'approved_projection',
          previousState: 'needs_review',
          nextState: 'approved',
          actorKind: 'admin',
          actorKey: 'admin_one',
          idempotencyKey: 'approve.key',
          requestHash: 'a'.repeat(64),
          occurredAt: '2026-07-29T10:44:00.000Z',
        }),
      ),
    ).rejects.toThrowError('content_canonical_state_idempotency_conflict');
    expect(changedReplay.queries.at(-1)?.text).toBe('ROLLBACK');
    expect(
      changedReplay.queries.some((query) =>
        query.text.includes('INSERT INTO onetime.canonical_state_transition_events'),
      ),
    ).toBe(false);
  });

  it('uses a transaction and parameterized Student-scoped resume insert', async () => {
    const client = new CapturingClient();
    const repository = createPostgresContentPublicationRepository({
      connect: async () => client,
    });

    await repository.inTransaction((unit) =>
      unit.saveResume(
        {
          ...scope,
          studentId: 'student_one',
          householdId: 'household_one',
          contentId: 'content_one',
          contentVersionId: 'content_version_one',
          publicationVersion: 4,
          positionMs: 125_000,
          updatedAt: '2026-07-29T10:46:00.000Z',
          version: 1,
          approvalProjectionDigest: approvalEvidence.projectionDigest,
        },
        null,
      ),
    );

    expect(client.queries.map((query) => query.text.trim().split(/\s+/)[0])).toEqual([
      'BEGIN',
      'INSERT',
      'COMMIT',
    ]);
    const insert = client.queries[1];
    expect(insert?.text).toContain(
      'ON CONFLICT (account_key, product_key, student_id, content_id) DO NOTHING',
    );
    expect(insert?.values?.slice(0, 9)).toEqual([
      'account_one',
      'one_time_mishnayos',
      'student_one',
      'household_one',
      'content_one',
      'content_version_one',
      4,
      125_000,
      1,
    ]);
    expect(client.released).toBe(true);
  });

  it('persists exact receipt version, generation, and approval projection bindings', async () => {
    const client = new CapturingClient();
    const repository = createPostgresContentPublicationRepository({
      connect: async () => client,
    });

    await repository.inTransaction((unit) =>
      unit.saveReceipt({
        ...scope,
        operation: 'approve',
        idempotencyKey: 'approval.key',
        requestHash: 'a'.repeat(64),
        contentId: 'content_one',
        contentVersionId: 'content_version_one',
        publicationGeneration: 3,
        resultVersion: 4,
        committedAt: '2026-07-29T10:46:00.000Z',
        approvalProjectionDigest: approvalEvidence.projectionDigest,
      }),
    );

    const insert = client.queries[1];
    expect(insert?.text).toContain('content_id, content_version_id, publication_generation');
    expect(insert?.values?.slice(5, 9)).toEqual([
      'content_one',
      'content_version_one',
      3,
      approvalEvidence.projectionDigest,
    ]);
  });

  it('projects a governed occurrence only from the canonical classroom source', async () => {
    const client = new CapturingClient(false, undefined, (text) =>
      text.includes('SELECT account_key, occurrence_id')
        ? [
            {
              account_key: 'account_one',
              occurrence_id: 'occurrence_one',
              occurrence_version: 3,
              canonical_series_id: 'series_one',
              product_key: 'one_time_mishnayos',
            },
          ]
        : undefined,
    );
    const repository = createPostgresContentPublicationRepository({
      connect: async () => client,
    });

    await expect(
      repository.inTransaction((unit) =>
        unit.getCanonicalGovernedOccurrence(scope, 'occurrence_one'),
      ),
    ).resolves.toMatchObject({
      ...scope,
      occurrenceId: 'occurrence_one',
      occurrenceVersion: 3,
      canonicalSeriesId: 'series_one',
      governanceState: 'governed',
      active: true,
    });
    const projection = client.queries.find((query) =>
      query.text.includes('INSERT INTO onetime.governed_content_occurrences'),
    );
    expect(projection?.text).toContain('series.is_canonical = TRUE');
    expect(projection?.text).toContain('governed_content_occurrences.occurrence_version <=');
    expect(projection?.values).toEqual(['account_one', 'one_time_mishnayos', 'occurrence_one']);
  });

  it('fails closed on a conflicting composite-scoped publication outbox id', async () => {
    const client = new CapturingClient(false, 'onetime.content_publication_outbox');
    const repository = createPostgresContentPublicationRepository({
      connect: async () => client,
    });

    await expect(
      repository.inTransaction((unit) =>
        unit.saveOutboxIntent({
          ...scope,
          intentId: 'intent_one',
          providerOperationId: 'provider_operation_one',
          provider: 'vimeo',
          contentId: 'content_one',
          contentVersionId: 'content_version_one',
          publicationGeneration: 1,
          operation: 'publish_private',
          idempotencyKey: 'publish.key',
          requestHash: 'a'.repeat(64),
          state: 'pending',
          createdAt: '2026-07-29T10:46:00.000Z',
          approvalEvidence,
        }),
      ),
    ).rejects.toThrowError('content_publication_outbox_conflict');

    const insert = client.queries.find((query) =>
      query.text.includes('onetime.content_publication_outbox'),
    );
    expect(insert?.text).toContain('ON CONFLICT (account_key, product_key, intent_id) DO NOTHING');
    expect(client.queries.at(-1)?.text).toBe('ROLLBACK');
  });

  it('persists the canonical F05 job and exact F06 binding before publication state', async () => {
    const client = new CapturingClient();
    const repository = createPostgresContentPublicationRepository({
      connect: async () => client,
    });
    const operation = providerOperation();

    await repository.inTransaction((unit) => unit.saveProviderOperation(operation));

    expect(client.queries.map(({ text }) => text.trim().split(/\s+/)[0])).toEqual([
      'BEGIN',
      'INSERT',
      'INSERT',
      'COMMIT',
    ]);
    expect(client.queries[1]?.text).toContain('INSERT INTO onetime.job_outbox');
    expect(client.queries[1]?.text).toContain('job_outbox.payload_ref = EXCLUDED.payload_ref');
    expect(client.queries[1]?.text).toContain("job_outbox.state = 'not_started'");
    expect(client.queries[2]?.text).toContain('INSERT INTO onetime.provider_operation_binding');
    expect(client.queries[2]?.text).not.toContain('onetime.provider_operations');
  });

  it('rolls back an optimistic conflict without a partial commit', async () => {
    const client = new CapturingClient(true);
    const repository = createPostgresContentPublicationRepository({
      connect: async () => client,
    });

    await expect(
      repository.inTransaction((unit) =>
        unit.saveContent(
          {
            ...scope,
            contentId: 'content_one',
            contentVersionId: 'content_version_one',
            contentVersionDigest: '1'.repeat(64),
            participantSetVersion: 'participant_set_v1',
            participantSnapshotSetDigest: '2'.repeat(64),
            participantReviewState: 'complete',
            unresolvedParticipantCount: 0,
            requiredRedactionCount: 1,
            completedRedactionCount: 1,
            redactionReviewDigest: '3'.repeat(64),
            version: 5,
            state: 'published',
            title: 'Berachos Review',
            englishTranscriptText: 'Approved transcript',
            classTopic: 'Berachos',
            mishnahReferences: ['Berachos 1:1'],
            occurredAt: '2026-07-27T16:00:00.000Z',
            updatedAt: '2026-07-29T10:42:00.000Z',
            durationMs: 3_600_000,
            approval: {
              approvalId: 'approval_one',
              approvedByAdminId: 'admin_one',
              approvedAt: '2026-07-29T10:40:00.000Z',
              policyVersion: 'content-publication-v1',
              evidence: approvalEvidence,
            },
            publicationGeneration: 1,
            playbackGrantGeneration: 1,
            pendingProviderOperationId: null,
            pendingProviderRequestHash: null,
            opaqueProviderAssetRef: 'asset_private_01',
            providerReadbackDigest: '4'.repeat(64),
            publishedAt: '2026-07-29T10:42:00.000Z',
            archivedAt: null,
            occurrenceRelations: [
              {
                ...scope,
                relationId: 'relation_one',
                occurrenceId: 'occurrence_one',
                occurrenceVersion: 1,
                canonicalSeriesId: 'series_one',
                productKey: 'one_time_mishnayos',
                governedByAdminId: 'admin_one',
                attachedAt: '2026-07-27T16:00:00.000Z',
              },
            ],
          },
          4,
        ),
      ),
    ).rejects.toThrowError('content_publication_optimistic_conflict');
    expect(client.queries.at(-1)?.text).toBe('ROLLBACK');
    expect(client.queries.some((query) => query.text === 'COMMIT')).toBe(false);
    expect(client.released).toBe(true);
  });

  it('writes versioned assignments, library projections, and protected notices in one transaction', async () => {
    const client = new CapturingClient();
    const repository = createPostgresContentPublicationRepository({
      connect: async () => client,
    });

    await repository.inTransaction((unit) =>
      unit.savePublicationMaterialization({
        ...scope,
        contentId: 'content_one',
        contentVersionId: 'content_version_one',
        publicationGeneration: 1,
        assignments: [
          {
            ...scope,
            assignmentId: 'assignment_one',
            assignmentVersion: 1,
            contentId: 'content_one',
            contentVersionId: 'content_version_one',
            publicationGeneration: 1,
            studentId: 'student_one',
            householdId: 'household_one',
            occurrenceId: 'occurrence_one',
            studentVersion: 5,
            enrollmentVersion: 6,
            accessVersion: 7,
            serviceAccountConsentVersion: 8,
            privacyVersion: 9,
            revocationVersion: 10,
            active: true,
            revokedAt: null,
            approvalEvidence,
          },
        ],
        libraryProjections: [
          {
            ...scope,
            projectionId: 'projection_one',
            assignmentId: 'assignment_one',
            assignmentVersion: 1,
            contentId: 'content_one',
            contentVersionId: 'content_version_one',
            publicationGeneration: 1,
            studentId: 'student_one',
            householdId: 'household_one',
            internalRoute: '/app/student/library/content_one',
            active: true,
            createdAt: '2026-07-29T10:44:00.000Z',
            approvalEvidence,
          },
        ],
        notices: [
          {
            ...scope,
            noticeId: 'notice_student_one',
            recipientKind: 'student',
            recipientId: 'student_one',
            studentId: 'student_one',
            householdId: 'household_one',
            category: 'recording_available',
            contentId: 'content_one',
            contentVersionId: 'content_version_one',
            sourceVersion: 4,
            title: 'New recording available',
            body: 'Berachos Review is ready in your library.',
            actionLabel: 'Watch recording',
            actionPath: '/app/student/library/content_one',
            deliveryState: 'pending',
            createdAt: '2026-07-29T10:44:00.000Z',
            approvalProjectionDigest: approvalEvidence.projectionDigest,
          },
          {
            ...scope,
            noticeId: 'notice_adult_one',
            recipientKind: 'adult',
            recipientId: 'adult_one',
            studentId: 'student_one',
            householdId: 'household_one',
            category: 'recording_available',
            contentId: 'content_one',
            contentVersionId: 'content_version_one',
            sourceVersion: 4,
            title: 'New recording available',
            body: 'A recording is available for the household.',
            actionLabel: 'Open household',
            actionPath: '/app/parent',
            deliveryState: 'pending',
            createdAt: '2026-07-29T10:44:00.000Z',
            approvalProjectionDigest: approvalEvidence.projectionDigest,
          },
        ],
        approvalEvidence,
      }),
    );

    const sql = client.queries.map((query) => query.text).join('\n');
    expect(sql).toContain('onetime.student_content_assignments');
    expect(sql).toContain('onetime.student_library_projections');
    expect(sql.match(/onetime\.protected_recording_notices/g)).toHaveLength(2);
    expect(sql).toContain('ON CONFLICT (account_key, product_key, assignment_id) DO NOTHING');
    expect(sql).toContain('ON CONFLICT (account_key, product_key, projection_id) DO NOTHING');
    expect(
      sql.match(/ON CONFLICT \(account_key, product_key, notice_id\) DO NOTHING/g),
    ).toHaveLength(2);
    expect(client.queries[0]?.text).toBe('BEGIN');
    expect(client.queries.at(-1)?.text).toBe('COMMIT');
  });

  it('refreshes protected playback facts from the authenticated session and current eligibility', async () => {
    const eligibilityValue = eligibility();
    const client = new CapturingClient(false, undefined, (text, values) => {
      if (text.includes('student_content_publication_eligibility')) {
        return [{ eligibility_json: eligibilityValue, session_security_version: 7 }];
      }
      if (text.includes('INSERT INTO onetime.student_content_playback_facts')) {
        return [{ facts_json: JSON.parse(String(values?.[10])) }];
      }
      return undefined;
    });
    const repository = createPostgresContentPublicationRepository({
      connect: async () => client,
    });

    const facts = await repository.inTransaction((unit) =>
      unit.refreshPlaybackFacts(scope, studentPrincipal(), assignment()),
    );

    expect(facts).toMatchObject({
      assignmentId: 'assignment_one',
      assignmentVersion: 1,
      studentId: 'student_one',
      sessionId: 'student_session_one',
      sessionVersion: 7,
      enrollmentVersion: 6,
      accessState: 'active',
      serviceAccountAccepted: true,
      privacyReviewState: 'clear',
    });
    const eligibilityRead = client.queries.find((query) =>
      query.text.includes('FROM onetime.student_content_publication_eligibility'),
    );
    expect(eligibilityRead?.text).toContain('JOIN onetime.account_learner_identity_links');
    expect(eligibilityRead?.text).toContain('JOIN onetime.account_users');
    expect(eligibilityRead?.text).toContain('JOIN onetime.user_sessions');
    expect(eligibilityRead?.text).toContain('JOIN onetime.portal_student_access_state');
    expect(eligibilityRead?.values?.slice(-3)).toEqual([
      'student_account_one',
      'student_session_one',
      7,
    ]);
    const insert = client.queries.find((query) =>
      query.text.includes('INSERT INTO onetime.student_content_playback_facts'),
    );
    expect(insert?.text).toContain(
      'ON CONFLICT (account_key, product_key, student_id, content_id)',
    );
    expect(insert?.text).toContain('RETURNING facts_json');
    expect(insert?.values?.slice(0, 10)).toEqual([
      'account_one',
      'one_time_mishnayos',
      'assignment_one',
      1,
      'student_one',
      'household_one',
      'content_one',
      'content_version_one',
      1,
      approvalEvidence.projectionDigest,
    ]);
  });

  it('does not persist playback facts when current eligibility is stale', async () => {
    const client = new CapturingClient(false, undefined, (text) =>
      text.includes('student_content_publication_eligibility')
        ? [
            {
              eligibility_json: { ...eligibility(), enrollmentVersion: 99 },
              session_security_version: 7,
            },
          ]
        : undefined,
    );
    const repository = createPostgresContentPublicationRepository({
      connect: async () => client,
    });

    await expect(
      repository.inTransaction((unit) =>
        unit.refreshPlaybackFacts(scope, studentPrincipal(), assignment()),
      ),
    ).resolves.toBeNull();
    expect(
      client.queries.some((query) =>
        query.text.includes('INSERT INTO onetime.student_content_playback_facts'),
      ),
    ).toBe(false);
  });

  it('atomically completes the exact accepted ProviderOperation and its original pending outbox', async () => {
    const client = new CapturingClient();
    const repository = createPostgresContentPublicationRepository({
      connect: async () => client,
    });

    await repository.inTransaction((unit) =>
      unit.completeProviderOperation({
        ...scope,
        providerOperationId: 'provider_operation_one',
        expectedProviderOperationVersion: 3,
        outboxIntentId: 'publish_intent_one',
        operation: 'publish_private',
        contentId: 'content_one',
        contentVersionId: 'content_version_one',
        publicationGeneration: 1,
        canonicalRequestHash: 'a'.repeat(64),
        providerAcceptanceDigest: 'b'.repeat(64),
        providerReconciliationDigest: 'c'.repeat(64),
        registryBindingKey: 'vimeo_publication_primary',
        providerAccountRefHash: 'f'.repeat(64),
        providerReadbackDigest: 'd'.repeat(64),
        oneTimeReadbackDigest: 'e'.repeat(64),
        providerResourceRefHash: '9'.repeat(64),
        providerObservedAt: '2026-07-29T10:44:00.000Z',
        completedAt: '2026-07-29T10:44:00.000Z',
        approvalProjectionDigest: approvalEvidence.projectionDigest,
      }),
    );

    const updates = client.queries.filter((query) => query.text.includes('UPDATE'));
    expect(updates).toHaveLength(2);
    expect(updates[0]?.text).toContain('onetime.job_outbox');
    expect(updates[0]?.text).toContain("state = 'accepted'");
    expect(updates[0]?.text).toContain("o.state = 'pending'");
    expect(updates[0]?.text).toContain('o.account_key = $13');
    expect(updates[0]?.text).toContain('o.approval_projection_digest = $15');
    expect(updates[0]?.text).toContain('reconciliation_digest IS NOT DISTINCT FROM $8');
    expect(updates[0]?.text).not.toContain('SET reconciliation_digest');
    expect(updates[0]?.text).not.toContain('$17');
    expect(updates[1]?.text).toContain('onetime.content_publication_outbox');
    expect(updates[1]?.text).toContain("state = 'complete'");
    expect(updates[1]?.text).toContain('account_key = $10');
    expect(updates[1]?.text).toContain('approval_projection_digest = $12');
    expect(updates[1]?.text).toContain('provider_resource_ref_hash = $14');
    expect(
      client.queries.some((query) =>
        query.text.includes('INSERT INTO onetime.provider_readback_ledger'),
      ),
    ).toBe(true);
    expect(
      client.queries.some((query) => query.text.includes('FROM onetime.provider_readback_ledger')),
    ).toBe(true);
    expect(client.queries[0]?.text).toBe('BEGIN');
    expect(client.queries.at(-1)?.text).toBe('COMMIT');
  });
});

function reviewReadyRecord(): ContentPublicationRecord {
  return {
    ...scope,
    contentId: approvalEvidence.contentId,
    contentVersionId: approvalEvidence.contentVersionId,
    contentVersionDigest: approvalEvidence.contentVersionDigest,
    participantSetVersion: approvalEvidence.participantSetVersion,
    participantSnapshotSetDigest: approvalEvidence.participantSnapshotDigest,
    participantReviewState: approvalEvidence.participantReviewState,
    unresolvedParticipantCount: approvalEvidence.unresolvedParticipantCount,
    requiredRedactionCount: approvalEvidence.requiredRedactionCount,
    completedRedactionCount: approvalEvidence.completedRedactionCount,
    redactionReviewDigest: approvalEvidence.redactionReviewDigest,
    version: 1,
    state: 'needs_review',
    title: approvalEvidence.title,
    englishTranscriptText: approvalEvidence.englishTranscriptText,
    classTopic: approvalEvidence.classTopic,
    mishnahReferences: approvalEvidence.mishnahReferences,
    occurredAt: approvalEvidence.occurredAt,
    updatedAt: approvalEvidence.approvedAt,
    durationMs: approvalEvidence.durationMs,
    approval: null,
    publicationGeneration: 0,
    playbackGrantGeneration: 1,
    pendingProviderOperationId: null,
    pendingProviderRequestHash: null,
    opaqueProviderAssetRef: null,
    providerReadbackDigest: null,
    publishedAt: null,
    archivedAt: null,
    occurrenceRelations: [],
  };
}

function canonicalScopeRow() {
  return {
    product_key: 'one_time_mishnayos',
    runtime_tier: 'isolated_staging',
    verification_environment_id: 'ci',
    source_key: approvalEvidence.sourceId,
    source_sha256: approvalEvidence.sourceSha256,
    source_object_version_id: approvalEvidence.sourceObjectVersionId,
  };
}

class CapturingClient implements ContentPublicationSqlClient {
  readonly queries: { text: string; values?: readonly unknown[] }[] = [];
  released = false;

  constructor(
    private readonly failUpdates = false,
    private readonly failText?: string,
    private readonly rowsFor?: (
      text: string,
      values?: readonly unknown[],
    ) => readonly Record<string, unknown>[] | undefined,
  ) {}

  async query<Row extends Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: Row[]; rowCount: number }> {
    this.queries.push(values === undefined ? { text } : { text, values });
    const failed =
      (this.failUpdates && text.includes('UPDATE')) ||
      (this.failText !== undefined && text.includes(this.failText));
    const suppliedRows = failed ? undefined : this.rowsFor?.(text, values);
    const rows = suppliedRows
      ? (suppliedRows as unknown as Row[])
      : !failed && text.includes('RETURNING job_id, version, provider')
        ? ([
            {
              job_id: String(values?.[0] ?? ''),
              version: Number(values?.[1] ?? 0) + 1,
              provider: 'vimeo',
              product: 'one_time_mishnayos',
              runtime_tier: 'isolated_staging',
              verification_environment_id: 'ci',
              reconciliation_digest: values?.[7] ?? null,
            },
          ] as unknown as Row[])
        : !failed && text.includes('RETURNING job_id')
          ? ([{ job_id: String(values?.[0] ?? '') }] as unknown as Row[])
          : [];
    return {
      rows,
      rowCount: failed ? 0 : 1,
    };
  }

  release() {
    this.released = true;
  }
}

function studentPrincipal(): ContentPublicationPrincipal {
  return {
    ...scope,
    actorId: 'student_account_one',
    role: 'student',
    householdId: 'household_one',
    studentId: 'student_one',
    sessionId: 'student_session_one',
    sessionVersion: 7,
    accessState: 'active',
  };
}

function assignment(): StudentContentAssignment {
  return {
    ...scope,
    assignmentId: 'assignment_one',
    assignmentVersion: 1,
    contentId: 'content_one',
    contentVersionId: 'content_version_one',
    publicationGeneration: 1,
    studentId: 'student_one',
    householdId: 'household_one',
    occurrenceId: 'occurrence_one',
    studentVersion: 5,
    enrollmentVersion: 6,
    accessVersion: 7,
    serviceAccountConsentVersion: 8,
    privacyVersion: 9,
    revocationVersion: 10,
    active: true,
    revokedAt: null,
    approvalEvidence,
  };
}

function eligibility(): StudentPublicationEligibility {
  return {
    ...scope,
    studentId: 'student_one',
    householdId: 'household_one',
    adultRecipientId: 'adult_one',
    occurrenceId: 'occurrence_one',
    studentVersion: 5,
    enrollmentVersion: 6,
    accessVersion: 7,
    serviceAccountConsentVersion: 8,
    privacyVersion: 9,
    revocationVersion: 10,
    contentId: 'content_one',
    contentVersionId: 'content_version_one',
    publicationGeneration: 1,
    studentActive: true,
    enrollmentActive: true,
    accessState: 'active',
    serviceAccountAccepted: true,
    privacyReviewState: 'clear',
    studentRevoked: false,
    accountRevoked: false,
    contentRevoked: false,
    adultRecipientActive: true,
    approvalProjectionDigest: approvalEvidence.projectionDigest,
  };
}

function providerOperation(): ProviderOperation {
  const digest = 'a'.repeat(64);
  return {
    job_id: 'provider_operation_one',
    operation_type: 'publish_private',
    aggregate_ref: 'content_one',
    source_version: 1,
    provider: 'vimeo',
    scope: {
      product: 'one_time_mishnayos',
      runtime_tier: 'isolated_staging',
      verification_environment_id: 'ci',
    },
    idempotency_key: 'publish.key',
    canonical_request_hash: digest,
    payload_ref: 'content_version_one',
    payload_digest: approvalEvidence.projectionDigest,
    compensation_for_job_id: null,
    state: 'not_started',
    version: 1,
    recovery_generation: 0,
    dispatch_attempts: 0,
    lifetime_dispatch_attempts: 0,
    reconciliation_attempts: 0,
    lease_owner: null,
    lease_generation: 0,
    lease_expires_at: null,
    last_heartbeat_at: null,
    next_attempt_at: null,
    unknown_effect: false,
    provider_acceptance_digest: null,
    reconciliation_digest: null,
    safe_error_code: null,
    created_at: '2026-07-29T10:40:00.000Z',
    updated_at: '2026-07-29T10:40:00.000Z',
    registry_binding_key: 'vimeo_publication_primary',
    provider_account_ref_hash: 'f'.repeat(64),
    effect_kind: 'mutation',
    household_id: null,
  };
}
