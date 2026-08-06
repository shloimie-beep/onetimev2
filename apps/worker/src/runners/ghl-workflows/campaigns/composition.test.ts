import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { loadConfig } from '../../../../../../packages/config/src/index.ts';
import type {
  CommunicationFoundationRepository,
  CommunicationSuppressionSnapshot,
} from '../../../../../../packages/contracts/src/communications/foundation/index.ts';
import type { ProviderDispatchOutcome } from '../../../../../../packages/contracts/src/jobs/index.ts';
import type {
  ProviderRegistryBindingEvidence,
  ProviderRegistryBindingReadRequest,
} from '../../../../../../packages/contracts/src/providers/v21-provider-core.ts';
import {
  ot16OperationId,
  type CampaignAudienceCandidate,
} from '../../../../../../packages/domain/src/communications/workflows/campaigns/index.ts';
import type { WorkerRunnerContext } from '../../registry/index.ts';
import {
  inspectDefaultOt16Authority,
  matchesApprovedOt16Digests,
  ot16ProviderReadbackEvidenceDigest,
  readCanonicalLaunchCampaign,
  readOt16F06Binding,
} from './adapters.ts';
import {
  createDefaultOt16Dependencies,
  runOt16CheckpointWorker,
  type Ot16WorkerDependencies,
} from './composition.ts';
import type { CampaignEmailDispatchReceipt } from './runner.ts';

const h = (value: string) => value.repeat(64).slice(0, 64);
const expiryAt = '2026-09-13T19:24:00+03:00';

function context(): WorkerRunnerContext {
  return {
    config: loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgres://test.invalid/onetime' }),
    pool: {
      query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
      connect: vi.fn(),
      end: vi.fn(),
    } as never,
    source: { NODE_ENV: 'test' },
    workerInstanceKey: 'worker-test',
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

function candidate(): CampaignAudienceCandidate {
  return {
    subject: { kind: 'adult', adult_id: 'adult-1', household_id: 'household-1' },
    current_account_owner: true,
    newsletter_permission: true,
    marketing_permission: true,
    former_or_canceled: false,
    active_parent: true,
    verified_paid_access: false,
    explicitly_declined: false,
    custom_school_terms: false,
  };
}

function suppression(snapshotId = 'suppression-1'): CommunicationSuppressionSnapshot {
  return {
    snapshot_id: snapshotId,
    adult_id: 'adult-1',
    captured_at: '2026-08-01T19:00:00Z',
    email_dnd: false,
    unsubscribed: false,
    complaint: false,
    hard_bounce: false,
    invalid_address: false,
    marketing_suppressed: false,
    optional_reminder_suppressed: false,
    evidence_digest: h('a'),
  };
}

function dependencies(
  outcome: ProviderDispatchOutcome = {
    kind: 'accepted',
    provider_acceptance_digest: h('b'),
    completed_locally: true,
  },
): Ot16WorkerDependencies & {
  listDueCheckpoints: ReturnType<typeof vi.fn>;
  preflight: ReturnType<typeof vi.fn>;
} {
  const repository: CommunicationFoundationRepository = {
    saveReminderPreference: vi.fn(async () => true),
    persistDecision: vi.fn(async () => true),
    reserveEmailDelivery: vi.fn(async () => true),
    completeDecision: vi.fn(async () => true),
    persistWorkflowReadback: vi.fn(async () => true),
    persistGovernedRequest: vi.fn(async () => true),
    persistWebsiteLeadPlan: vi.fn(async () => true),
  };
  return {
    inspectAuthority: vi.fn(async () => ({ ready: true as const, safeProviderReference: h('c') })),
    listDueCheckpoints: vi.fn(async () => [
      { adultId: 'adult-1', expiryAt, checkpointDays: 14 as const, expectedVersion: 0 },
    ]),
    preflight: vi.fn(async () => ({
      ready: true as const,
      identityLinkState: 'linked' as const,
      mappingReconciliationState: 'in_sync' as const,
      candidate: candidate(),
      suppression: suppression(),
    })),
    repository,
    suppression: {
      readCurrent: vi
        .fn()
        .mockResolvedValueOnce(suppression())
        .mockResolvedValueOnce(suppression('suppression-2')),
    },
    eligibility: { readCurrent: vi.fn(async () => candidate()) },
    email: {
      dispatchThroughF05: vi.fn(
        async (sendInput: { operation_id: string }): Promise<CampaignEmailDispatchReceipt> =>
          dispatchReceipt(outcome, sendInput.operation_id),
      ),
    },
    signal: new AbortController().signal,
  };
}

function dispatchReceipt(
  outcome: ProviderDispatchOutcome,
  operationId: string,
): CampaignEmailDispatchReceipt {
  return {
    outcome,
    durable_job: {
      job_id: 'job-ot16-1',
      operation_type: 'ghl.workflow.ot16_checkpoint',
      idempotency_key: operationId,
      version: 4,
      state:
        outcome.kind === 'accepted'
          ? outcome.completed_locally
            ? 'complete'
            : 'accepted'
          : outcome.kind === 'not_accepted_retryable'
            ? 'retry_wait'
            : outcome.kind === 'permanently_rejected'
              ? 'rejected'
              : 'acceptance_unknown',
      unknown_effect: outcome.kind === 'acceptance_unknown',
      provider_acceptance_digest:
        outcome.kind === 'accepted' ? outcome.provider_acceptance_digest : null,
      safe_error_code: outcome.kind === 'accepted' ? null : outcome.safe_error_code,
      updated_at: '2026-08-01T20:00:00.000Z',
    },
  };
}

describe('P30 OT-16 worker composition', () => {
  it('adapts exactly the ten repository-only launch messages without provider effects', () => {
    const ids = [
      'ghl.signup_confirmation.v1',
      'ghl.legacy_member_migration.step_1.v1',
      'ghl.legacy_member_migration.step_2.v1',
      'ghl.legacy_member_migration.step_3.v1',
      'ghl.former_member_reactivation.step_1.v1',
      'ghl.former_member_reactivation.step_2.v1',
      'ghl.former_member_reactivation.step_3.v1',
      'ghl.prelaunch_nurture.step_1.v1',
      'ghl.prelaunch_nurture.step_2.v1',
      'ghl.prelaunch_nurture.step_3.v1',
    ];
    const adapters = ids.map((id) => readCanonicalLaunchCampaign(id));
    expect(adapters).not.toContain(null);
    expect(adapters.filter((entry) => entry?.senderKey === 'office')).toHaveLength(1);
    expect(adapters.filter((entry) => entry?.senderKey === 'rabbi_campaign')).toHaveLength(9);
    expect(new Set(adapters.map((entry) => entry?.workflowId))).toEqual(
      new Set(['OT-01', 'OT-02A', 'OT-15', 'OT-02B']),
    );
    expect(adapters.map((entry) => entry?.ctaDestination)).toEqual(
      expect.arrayContaining([
        'one_time_home_url',
        'one_time_signup_url',
        'one_time_member_login_url',
      ]),
    );
    expect(readCanonicalLaunchCampaign('ghl.parent_newsletter.v1')).toBeNull();
  });

  it.each([
    'production_read_only',
    'verification_writes_disabled',
    'provider_mode_disabled',
    'provider_configuration_missing',
    'location_mismatch',
    'ot16_identity_missing',
    'ot16_readback_missing',
    'ot16_readback_mismatch',
    'f06_binding_unavailable',
  ] as const)('fails closed before scheduling or mutation for %s', async (reason) => {
    const deps = dependencies();
    deps.inspectAuthority = vi.fn(async () => ({ ready: false as const, reason }));
    const result = await runOt16CheckpointWorker(context(), deps);
    expect(result).toEqual({
      enabled: false,
      providerCallsPerformed: false,
      summary: {
        scheduled: 0,
        claimed: 0,
        reservations: 0,
        writes: 0,
        providerCalls: 0,
        sent: 0,
        retryWait: 0,
        terminal: 0,
        acceptanceUnknown: 0,
        localCompletionPending: 0,
        dispatchPersistenceUnconfirmed: 0,
        disabledReason: reason,
      },
    });
    expect(deps.listDueCheckpoints).not.toHaveBeenCalled();
    expect(deps.preflight).not.toHaveBeenCalled();
    expect(deps.repository.persistDecision).not.toHaveBeenCalled();
    expect(deps.email.dispatchThroughF05).not.toHaveBeenCalled();
  });

  it('fails closed when ONE_TIME_FREE_ACCESS_EXPIRES_AT is absent', async () => {
    const workerContext = context();
    workerContext.config = {
      ...workerContext.config,
      oneTimeVerificationEnvironmentId: 'provider_sandbox',
      oneTimeVerificationWritesAllowed: true,
      deliveryProviderMode: 'provider',
      deliveryProviderTransportEnabled: true,
      highLevelEventSyncMode: 'provider',
      highLevelPrivateIntegrationsToken: 'test-highlevel-token',
      oneTimeOt16TransportMode: 'broad',
      oneTimeOt16AuthorizationId: 'test-ot16-authorization',
      oneTimeOt16CanaryOperationIds: [],
      oneTimeOt16PerRunBudget: 1,
      highLevelLocationId: 'pBSnOK2nkdxp6gf9Rg3o',
      oneTimeFreeAccessExpiresAt: undefined,
    };

    await expect(inspectDefaultOt16Authority(workerContext)).resolves.toEqual({
      ready: false,
      reason: 'provider_configuration_missing',
    });
    expect(workerContext.pool.query).not.toHaveBeenCalled();
  });

  it('requires and returns the exact F06-bound OT-16 workflow readback', async () => {
    const workerContext = context();
    const providerReadAt = '2026-08-05T20:00:00.000Z';
    const registry = {
      ghlId: 'provider-workflow-ot16',
      observedStatus: 'SAVED_REOPENED',
      registryDigest: h('2'),
      renderedBodyDigest: h('3'),
    };
    const workflowRef = createHash('sha256').update(registry.ghlId).digest('hex');
    workerContext.config = {
      ...workerContext.config,
      oneTimeVerificationEnvironmentId: 'provider_sandbox',
      oneTimeVerificationWritesAllowed: true,
      deliveryProviderMode: 'provider',
      deliveryProviderTransportEnabled: true,
      highLevelEventSyncMode: 'provider',
      highLevelPrivateIntegrationsToken: 'test-highlevel-token',
      oneTimeOt16TransportMode: 'broad',
      oneTimeOt16AuthorizationId: 'test-ot16-authorization',
      oneTimeOt16CanaryOperationIds: [],
      oneTimeOt16PerRunBudget: 1,
      highLevelLocationId: 'pBSnOK2nkdxp6gf9Rg3o',
      oneTimeFreeAccessExpiresAt: expiryAt,
    };
    workerContext.pool.query = vi.fn(async () => ({
      rows: [
        {
          readback: {
            workflow_key: 'OT-16',
            provider_workflow_ref_hash: workflowRef,
            readiness: 'SAVED_REOPENED',
            registry_digest: registry.registryDigest,
            rendered_body_digest: registry.renderedBodyDigest,
            delivery: { provider_read_at: providerReadAt },
          },
          provider_read_at: providerReadAt,
          version: 2,
        },
      ],
      rowCount: 1,
    })) as never;
    const bindingReader = {
      readActiveRegistryBinding: vi.fn(async (request: ProviderRegistryBindingReadRequest) =>
        f06Evidence(request),
      ),
    };

    await expect(
      inspectDefaultOt16Authority(workerContext, {
        readRegistry: vi.fn(async () => registry),
        bindingReader,
      }),
    ).resolves.toEqual({ ready: true, safeProviderReference: workflowRef });
    expect(bindingReader.readActiveRegistryBinding).toHaveBeenCalledWith(
      expect.objectContaining({
        registry_binding_key: 'highlevel.ot16.primary',
        provider: 'highlevel',
        operation_type: 'ghl.workflow.ot16_checkpoint',
        effect_kind: 'mutation',
        expected_registry_evidence_digest: registry.registryDigest,
        expected_provider_readback_evidence_digest: ot16ProviderReadbackEvidenceDigest({
          workflowKey: 'OT-16',
          providerWorkflowRefHash: workflowRef,
          readiness: 'SAVED_REOPENED',
          registryDigest: registry.registryDigest,
          renderedBodyDigest: registry.renderedBodyDigest,
          providerReadAt,
        }),
        expected_version: 2,
        observed_not_before: providerReadAt,
      }),
    );
  });

  it('registers and runs the deterministic checkpoint through the classified provider port', async () => {
    const deps = dependencies();
    const result = await runOt16CheckpointWorker(context(), deps);
    expect(result.enabled).toBe(true);
    expect(result.providerCallsPerformed).toBe(true);
    expect(result.summary).toMatchObject({
      scheduled: 1,
      claimed: 1,
      reservations: 1,
      writes: 3,
      providerCalls: 1,
      sent: 1,
      acceptanceUnknown: 0,
    });
    expect(deps.email.dispatchThroughF05).toHaveBeenCalledOnce();
    expect(deps.email.dispatchThroughF05).toHaveBeenCalledWith(
      expect.objectContaining({ safe_provider_reference: h('c') }),
      deps.signal,
    );
  });

  it('limits the default due reader to the exact canary operation allowlist and per-run budget', async () => {
    const workerContext = context();
    const canaryExpiry = new Date(Date.now() + 13.5 * 24 * 60 * 60 * 1_000).toISOString();
    const allowedOperation = ot16OperationId({
      adult_id: 'adult-canary',
      expiry_at: canaryExpiry,
      checkpoint_days: 14,
    });
    workerContext.config = {
      ...workerContext.config,
      oneTimeFreeAccessExpiresAt: canaryExpiry,
      oneTimeOt16TransportMode: 'canary',
      oneTimeOt16AuthorizationId: 'test-ot16-authorization',
      oneTimeOt16CanaryOperationIds: [allowedOperation],
      oneTimeOt16PerRunBudget: 1,
    };
    workerContext.pool.query = vi.fn(async (sql: string) => {
      if (sql.includes('onetime.family_signup_access_projections')) {
        return {
          rows: [
            {
              adult_id: 'adult-canary',
              household_id: 'household-canary',
              free_access_expires_at: canaryExpiry,
            },
            {
              adult_id: 'adult-not-allowed',
              household_id: 'household-not-allowed',
              free_access_expires_at: canaryExpiry,
            },
          ],
          rowCount: 2,
        };
      }
      return { rows: [], rowCount: 0 };
    }) as never;

    await expect(
      createDefaultOt16Dependencies(workerContext).listDueCheckpoints(workerContext),
    ).resolves.toEqual([
      {
        adultId: 'adult-canary',
        expiryAt: canaryExpiry,
        checkpointDays: 14,
        expectedVersion: 0,
      },
    ]);
  });

  it('accepts only the exact approved registry and rendered-body digest pair', () => {
    const approved = { registryDigest: h('e'), renderedBodyDigest: h('f') };
    expect(
      matchesApprovedOt16Digests(
        { registry_digest: h('e'), rendered_body_digest: h('f') },
        approved,
      ),
    ).toBe(true);
    expect(
      matchesApprovedOt16Digests(
        { registry_digest: h('0'), rendered_body_digest: h('f') },
        approved,
      ),
    ).toBe(false);
    expect(
      matchesApprovedOt16Digests(
        { registry_digest: h('e'), rendered_body_digest: h('0') },
        approved,
      ),
    ).toBe(false);
  });

  it('reads the exact active F06 HighLevel binding for OT-16 mutation authority', async () => {
    const expected = {
      account: h('1'),
      registry: h('2'),
      readback: h('3'),
      version: 4,
      observedAt: '2026-08-05T20:00:00.000Z',
    };
    let request: ProviderRegistryBindingReadRequest | undefined;
    const reader = {
      readActiveRegistryBinding: vi.fn(async (value: ProviderRegistryBindingReadRequest) => {
        request = value;
        return f06Evidence(value);
      }),
    };

    await expect(
      readOt16F06Binding({
        reader,
        runtimeTier: 'production',
        verificationEnvironmentId: 'production_operator_canary',
        expectedProviderAccountRefHash: expected.account,
        expectedRegistryEvidenceDigest: expected.registry,
        expectedProviderReadbackEvidenceDigest: expected.readback,
        expectedVersion: expected.version,
        observedNotBefore: expected.observedAt,
      }),
    ).resolves.toMatchObject({
      binding: {
        registry_binding_key: 'highlevel.ot16.primary',
        provider: 'highlevel',
        provider_account_ref_hash: expected.account,
        mutation_policy: 'orchestration_only',
      },
      registry_evidence_digest: expected.registry,
      provider_readback_evidence_digest: expected.readback,
      version: expected.version,
    });
    expect(request).toEqual({
      registry_binding_key: 'highlevel.ot16.primary',
      provider: 'highlevel',
      scope: {
        product: 'one_time_mishnayos',
        runtime_tier: 'production',
        verification_environment_id: 'production_operator_canary',
      },
      operation_type: 'ghl.workflow.ot16_checkpoint',
      effect_kind: 'mutation',
      expected_provider_account_ref_hash: expected.account,
      expected_registry_evidence_digest: expected.registry,
      expected_provider_readback_evidence_digest: expected.readback,
      expected_version: expected.version,
      observed_not_before: expected.observedAt,
    });
  });

  it('rejects a prohibited or mismatched F06 binding and hashes only sanitized readback facts', async () => {
    const common = {
      runtimeTier: 'production' as const,
      verificationEnvironmentId: 'production_operator_canary' as const,
      expectedProviderAccountRefHash: h('1'),
      expectedRegistryEvidenceDigest: h('2'),
      expectedProviderReadbackEvidenceDigest: h('3'),
      expectedVersion: 4,
      observedNotBefore: '2026-08-05T20:00:00.000Z',
    };
    const prohibited = {
      readActiveRegistryBinding: vi.fn(async (value: ProviderRegistryBindingReadRequest) => ({
        ...f06Evidence(value),
        binding: { ...f06Evidence(value).binding, mutation_policy: 'prohibited' as const },
      })),
    };
    await expect(readOt16F06Binding({ reader: prohibited, ...common })).resolves.toBeNull();

    const digestInput = {
      workflowKey: 'OT-16' as const,
      providerWorkflowRefHash: h('4'),
      readiness: 'SAVED_REOPENED',
      registryDigest: h('5'),
      renderedBodyDigest: h('6'),
      providerReadAt: '2026-08-05T20:00:00.000Z',
    };
    const digest = ot16ProviderReadbackEvidenceDigest(digestInput);
    expect(digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(ot16ProviderReadbackEvidenceDigest(digestInput)).toBe(digest);
    expect(
      ot16ProviderReadbackEvidenceDigest({
        ...digestInput,
        providerReadAt: '2026-08-05T20:00:01.000Z',
      }),
    ).not.toBe(digest);
  });

  it('rejects an invalid authority-owned provider reference before scheduling', async () => {
    const deps = dependencies();
    deps.inspectAuthority = vi.fn(async () => ({
      ready: true as const,
      safeProviderReference: 'not-a-provider-reference',
    }));
    const result = await runOt16CheckpointWorker(context(), deps);
    expect(result).toMatchObject({
      enabled: false,
      providerCallsPerformed: false,
      summary: { disabledReason: 'f06_binding_unavailable', scheduled: 0, writes: 0 },
    });
    expect(deps.listDueCheckpoints).not.toHaveBeenCalled();
    expect(deps.repository.persistDecision).not.toHaveBeenCalled();
  });

  it('quarantines acceptance-unknown and reports a provider call without retrying it', async () => {
    const deps = dependencies({ kind: 'acceptance_unknown', safe_error_code: 'safe_unknown' });
    const result = await runOt16CheckpointWorker(context(), deps);
    expect(result.providerCallsPerformed).toBe(true);
    expect(result.summary).toMatchObject({
      providerCalls: 1,
      retryWait: 0,
      acceptanceUnknown: 1,
      writes: 2,
    });
    expect(deps.repository.completeDecision).not.toHaveBeenCalled();
  });

  it('reports accepted work that F05 has not completed locally without calling it sent', async () => {
    const deps = dependencies({
      kind: 'accepted',
      provider_acceptance_digest: h('b'),
      completed_locally: false,
    });
    const result = await runOt16CheckpointWorker(context(), deps);
    expect(result.summary).toMatchObject({
      sent: 0,
      acceptanceUnknown: 0,
      localCompletionPending: 1,
      writes: 2,
    });
    expect(deps.repository.completeDecision).not.toHaveBeenCalled();
  });

  it('rejects a non-Adult or mismatched P27 identity before any P28 mutation', async () => {
    const deps = dependencies();
    deps.preflight = vi.fn(async () => ({
      ready: true as const,
      identityLinkState: 'linked' as const,
      mappingReconciliationState: 'in_sync' as const,
      candidate: {
        ...candidate(),
        subject: {
          kind: 'adult' as const,
          adult_id: 'different-adult',
          household_id: 'household-1',
        },
      },
      suppression: suppression(),
    }));
    const result = await runOt16CheckpointWorker(context(), deps);
    expect(result.providerCallsPerformed).toBe(false);
    expect(result.summary).toMatchObject({ scheduled: 0, claimed: 0, providerCalls: 0 });
    expect(deps.repository.persistDecision).not.toHaveBeenCalled();
    expect(deps.email.dispatchThroughF05).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'unlinked identity',
      override: { identityLinkState: 'unlinked' as const },
    },
    {
      name: 'mapping reconciliation hold',
      override: { mappingReconciliationState: 'reconciliation_hold' as const },
    },
  ])('rejects $name before any P28 mutation', async ({ override }) => {
    const deps = dependencies();
    deps.preflight = vi.fn(async () => ({
      ready: true as const,
      identityLinkState: 'linked' as const,
      mappingReconciliationState: 'in_sync' as const,
      candidate: candidate(),
      suppression: suppression(),
      ...override,
    }));
    const result = await runOt16CheckpointWorker(context(), deps);
    expect(result.providerCallsPerformed).toBe(false);
    expect(result.summary).toMatchObject({ scheduled: 0, claimed: 0, writes: 0 });
    expect(deps.repository.persistDecision).not.toHaveBeenCalled();
    expect(deps.email.dispatchThroughF05).not.toHaveBeenCalled();
  });

  it('keeps the default production composition disabled at the real interface ceiling', async () => {
    const result = await runOt16CheckpointWorker(context());
    expect(result.enabled).toBe(false);
    expect(result.providerCallsPerformed).toBe(false);
    expect(result.summary).toMatchObject({
      scheduled: 0,
      claimed: 0,
      reservations: 0,
      writes: 0,
      providerCalls: 0,
    });
  });
});

function f06Evidence(request: ProviderRegistryBindingReadRequest): ProviderRegistryBindingEvidence {
  return {
    binding: {
      registry_binding_key: request.registry_binding_key,
      provider: request.provider,
      scope: request.scope,
      provider_account_ref_hash: request.expected_provider_account_ref_hash,
      allowed_operation_types: [request.operation_type],
      mutation_policy: 'orchestration_only',
      active: true,
    },
    registry_evidence_digest: request.expected_registry_evidence_digest,
    provider_readback_evidence_digest: request.expected_provider_readback_evidence_digest,
    observed_at: request.observed_not_before,
    version: request.expected_version,
  };
}
