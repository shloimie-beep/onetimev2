import { describe, expect, it, vi } from 'vitest';

import { loadConfig } from '../../../../../../packages/config/src/index.ts';
import type {
  CommunicationFoundationRepository,
  CommunicationSuppressionSnapshot,
} from '../../../../../../packages/contracts/src/communications/foundation/index.ts';
import type { ProviderDispatchOutcome } from '../../../../../../packages/contracts/src/jobs/index.ts';
import type { CampaignAudienceCandidate } from '../../../../../../packages/domain/src/communications/workflows/campaigns/index.ts';
import type { WorkerRunnerContext } from '../../registry/index.ts';
import { runOt16CheckpointWorker, type Ot16WorkerDependencies } from './composition.ts';
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
      safeProviderReference: h('d'),
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
      expect.objectContaining({ safe_provider_reference: h('d') }),
      deps.signal,
    );
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
      safeProviderReference: h('d'),
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
    {
      name: 'missing verified provider reference',
      override: { safeProviderReference: null },
    },
  ])('rejects $name before any P28 mutation', async ({ override }) => {
    const deps = dependencies();
    deps.preflight = vi.fn(async () => ({
      ready: true as const,
      identityLinkState: 'linked' as const,
      mappingReconciliationState: 'in_sync' as const,
      safeProviderReference: h('d'),
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
