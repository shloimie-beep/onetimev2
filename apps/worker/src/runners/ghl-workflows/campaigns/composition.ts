import type {
  CommunicationFoundationRepository,
  CommunicationSuppressionSnapshot,
} from '../../../../../../packages/contracts/src/communications/foundation/index.ts';
import type {
  GhlIdentityLinkState,
  HouseholdProviderMapping,
} from '../../../../../../packages/contracts/src/providers/v21-provider-core.ts';
import type { CampaignAudienceCandidate } from '../../../../../../packages/domain/src/communications/workflows/campaigns/index.ts';
import { ot16OperationId } from '../../../../../../packages/domain/src/communications/workflows/campaigns/index.ts';
import type { WorkerRunnerContext, WorkerRunnerResult } from '../../registry/index.ts';
import {
  inspectDefaultOt16Authority,
  type Ot16AuthorityDecision,
  type Ot16AuthorityBlockedReason,
} from './adapters.ts';
import {
  runOt16Checkpoint,
  type CampaignEligibilityReadPort,
  type CampaignEmailPort,
  type CampaignSuppressionReadPort,
} from './runner.ts';

export type Ot16DueCheckpoint = {
  adultId: string;
  expiryAt: string;
  checkpointDays: 14 | 7 | 3 | 1 | 0;
  expectedVersion: number;
};

export type Ot16CandidatePreflight =
  | { ready: false; reason: string }
  | {
      ready: true;
      identityLinkState: GhlIdentityLinkState;
      mappingReconciliationState: HouseholdProviderMapping['reconciliation_state'];
      safeProviderReference: string | null;
      candidate: CampaignAudienceCandidate;
      suppression: CommunicationSuppressionSnapshot;
    };

export interface Ot16WorkerDependencies {
  inspectAuthority(context: WorkerRunnerContext): Promise<Ot16AuthorityDecision>;
  listDueCheckpoints(context: WorkerRunnerContext): Promise<readonly Ot16DueCheckpoint[]>;
  preflight(
    context: WorkerRunnerContext,
    checkpoint: Ot16DueCheckpoint,
  ): Promise<Ot16CandidatePreflight>;
  repository: CommunicationFoundationRepository;
  suppression: CampaignSuppressionReadPort;
  eligibility: CampaignEligibilityReadPort;
  email: CampaignEmailPort;
  signal: AbortSignal;
}

type Ot16WorkerSummary = {
  disabledReason?: Ot16AuthorityBlockedReason | 'f05_dispatch_adapter_unavailable';
  scheduled: number;
  claimed: number;
  reservations: number;
  writes: number;
  providerCalls: number;
  sent: number;
  retryWait: number;
  terminal: number;
  acceptanceUnknown: number;
  localCompletionPending: number;
  dispatchPersistenceUnconfirmed: number;
};

export async function runOt16CheckpointWorker(
  context: WorkerRunnerContext,
  dependencies?: Ot16WorkerDependencies,
): Promise<WorkerRunnerResult> {
  const authority = await (dependencies?.inspectAuthority ?? inspectDefaultOt16Authority)(context);
  if (!authority.ready) return disabled(authority.reason);

  // The exact F05 campaign dispatch adapter and canonical F06 active-binding
  // reader are not exposed by the integrated interfaces. The production path
  // must remain disabled rather than guessing a provider operation.
  if (!dependencies) return disabled('f05_dispatch_adapter_unavailable');

  const summary = emptySummary();
  const due = await dependencies.listDueCheckpoints(context);
  for (const checkpoint of due) {
    const preflight = await dependencies.preflight(context, checkpoint);
    if (!preflight.ready) continue;
    if (
      preflight.identityLinkState !== 'linked' ||
      preflight.mappingReconciliationState !== 'in_sync' ||
      !isSha256(preflight.safeProviderReference) ||
      preflight.candidate.subject.kind !== 'adult' ||
      preflight.candidate.subject.adult_id !== checkpoint.adultId
    ) {
      continue;
    }

    summary.scheduled += 1;
    const result = await runOt16Checkpoint({
      operation_id: ot16OperationId({
        adult_id: checkpoint.adultId,
        expiry_at: checkpoint.expiryAt,
        checkpoint_days: checkpoint.checkpointDays,
      }),
      checkpoint_days: checkpoint.checkpointDays,
      expiry_at: checkpoint.expiryAt,
      candidate: preflight.candidate,
      suppression_at_approval: preflight.suppression,
      expected_version: checkpoint.expectedVersion,
      safe_provider_reference: preflight.safeProviderReference,
      signal: dependencies.signal,
      repository: dependencies.repository,
      suppression: dependencies.suppression,
      eligibility: dependencies.eligibility,
      email: dependencies.email,
    });
    summary.claimed += result.state === 'stale_fenced' ? 0 : 1;
    summary.reservations += result.reservations;
    summary.writes += result.writes;
    summary.providerCalls += result.email_provider_calls;
    if (result.state === 'sent') summary.sent += 1;
    else if (result.state === 'retry_pending') summary.retryWait += 1;
    else if (result.state === 'permanently_rejected') summary.terminal += 1;
    else if (result.state === 'acceptance_unknown') summary.acceptanceUnknown += 1;
    else if (result.state === 'accepted_pending_local_completion') {
      summary.localCompletionPending += 1;
    } else if (result.state === 'dispatch_persistence_unconfirmed') {
      summary.dispatchPersistenceUnconfirmed += 1;
    }
  }

  return {
    enabled: true,
    providerCallsPerformed: summary.providerCalls > 0,
    summary,
  };
}

function disabled(reason: Ot16WorkerSummary['disabledReason']): WorkerRunnerResult {
  return {
    enabled: false,
    providerCallsPerformed: false,
    summary: { ...emptySummary(), disabledReason: reason },
  };
}

function emptySummary(): Ot16WorkerSummary {
  return {
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
  };
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}
