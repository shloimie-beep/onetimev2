import { createHash } from 'node:crypto';

import type {
  CommunicationFoundationRepository,
  CommunicationSuppressionSnapshot,
} from '../../../../../../packages/contracts/src/communications/foundation/index.ts';
import type {
  ProviderDispatchOutcome,
  ProviderJobRecord,
} from '../../../../../../packages/contracts/src/jobs/index.ts';
import {
  planOt16Checkpoint,
  type CampaignAudienceCandidate,
  type Ot16CheckpointDays,
  type Ot16ExitReason,
  type Ot16Notice,
  type Ot16CheckpointPlan,
} from '../../../../../../packages/domain/src/communications/workflows/campaigns/index.ts';

export interface CampaignSuppressionReadPort {
  readCurrent(adult_id: string): Promise<CommunicationSuppressionSnapshot>;
}

export interface CampaignEligibilityReadPort {
  readCurrent(adult_id: string): Promise<CampaignAudienceCandidate>;
}

export interface CampaignEmailPort {
  /**
   * Runs dispatch through F05 and returns only after F05 has durably recorded
   * the classified outcome. An implementation is not a raw provider client:
   * acceptance uncertainty must already be in the canonical job quarantine.
   */
  dispatchThroughF05(
    input: {
      operation_id: string;
      adult_id: string;
      sender_key: 'office';
      transport: 'GHL';
      subject: string;
      body: string;
      cta_label: 'Complete Checkout';
      content_digest: string;
      safe_provider_reference: string;
    },
    signal: AbortSignal,
  ): Promise<CampaignEmailDispatchReceipt>;
}

export type CampaignEmailDispatchReceipt = {
  outcome: ProviderDispatchOutcome;
  durable_job: Pick<
    ProviderJobRecord,
    | 'job_id'
    | 'idempotency_key'
    | 'version'
    | 'unknown_effect'
    | 'provider_acceptance_digest'
    | 'safe_error_code'
    | 'updated_at'
  > & {
    operation_type: 'ghl.workflow.ot16_checkpoint';
    state:
      'complete' | 'accepted' | 'retry_wait' | 'acceptance_unknown' | 'rejected' | 'dead_letter';
    unknown_effect: boolean;
    provider_acceptance_digest: string | null;
    safe_error_code: string | null;
  };
};

export interface RunOt16CheckpointInput {
  operation_id: string;
  checkpoint_days: Ot16CheckpointDays;
  expiry_at: string;
  candidate: CampaignAudienceCandidate;
  suppression_at_approval: CommunicationSuppressionSnapshot;
  expected_version: number;
  safe_provider_reference: string;
  signal: AbortSignal;
  repository: CommunicationFoundationRepository;
  suppression: CampaignSuppressionReadPort;
  eligibility: CampaignEligibilityReadPort;
  email: CampaignEmailPort;
}

type NoProviderCalls = { email_provider_calls: 0; whatsapp_provider_calls: 0 };
type OneEmailProviderCall = { email_provider_calls: 1; whatsapp_provider_calls: 0 };
type ExecutionCounts = { reservations: 0 | 1; writes: 0 | 1 | 2 | 3 };

export type RunOt16CheckpointResult =
  | ({ state: 'student_prohibited' } & NoProviderCalls & ExecutionCounts)
  | ({ state: 'invalid_operation_id'; reason: 'operation_id_mismatch' } & NoProviderCalls &
      ExecutionCounts)
  | ({ state: 'exited'; reason: Ot16ExitReason } & NoProviderCalls & ExecutionCounts)
  | ({ state: 'skipped'; reason: string } & NoProviderCalls & ExecutionCounts)
  | ({ state: 'stale_fenced' } & NoProviderCalls & ExecutionCounts)
  | ({ state: 'duplicate' } & NoProviderCalls & ExecutionCounts)
  | ({ state: 'sent' } & OneEmailProviderCall & ExecutionCounts)
  | ({ state: 'retry_pending'; safe_error_code: string } & OneEmailProviderCall & ExecutionCounts)
  | ({ state: 'permanently_rejected'; safe_error_code: string } & OneEmailProviderCall &
      ExecutionCounts)
  | ({ state: 'acceptance_unknown'; safe_error_code: string } & OneEmailProviderCall &
      ExecutionCounts)
  | ({
      state: 'accepted_pending_local_completion';
      safe_error_code: string;
    } & OneEmailProviderCall &
      ExecutionCounts)
  | ({ state: 'dispatch_persistence_unconfirmed'; safe_error_code: string } & OneEmailProviderCall &
      ExecutionCounts);

/**
 * Executes one authorized OT-16 checkpoint. All current eligibility and
 * suppression gates run before the first durable write, then run again after
 * the durable reservation and immediately before provider dispatch. The
 * provider port is the F05 boundary and must return the classified outcome
 * together with its durable canonical job disposition. Acceptance-unknown
 * work remains planned in P28 and quarantined in F05 until canonical
 * reconciliation proves its disposition; it is never mislabeled as skipped.
 */
export async function runOt16Checkpoint(
  input: RunOt16CheckpointInput,
): Promise<RunOt16CheckpointResult> {
  const initialPlan = plan(input, input.candidate, input.suppression_at_approval);
  if (initialPlan.state !== 'deliver_email') return nonDeliveryResult(initialPlan);

  const currentSuppression = await input.suppression.readCurrent(initialPlan.adult_id);
  const currentCandidate = await input.eligibility.readCurrent(initialPlan.adult_id);
  const prewritePlan = plan(input, currentCandidate, currentSuppression);
  if (prewritePlan.state !== 'deliver_email') return nonDeliveryResult(prewritePlan);

  const persisted = await input.repository.persistDecision({
    record: {
      operation_id: prewritePlan.operation_id,
      adult_id: prewritePlan.adult_id,
      purpose: 'marketing',
      plan: prewritePlan.channel_plan,
      suppression_snapshot_id: currentSuppression.snapshot_id,
      status: 'planned',
    },
    expected_version: input.expected_version,
  });
  if (!persisted) {
    return {
      state: 'stale_fenced',
      email_provider_calls: 0,
      whatsapp_provider_calls: 0,
      reservations: 0,
      writes: 0,
    };
  }

  const reserved = await input.repository.reserveEmailDelivery({
    operation_id: prewritePlan.operation_id,
    suppression_snapshot_id: currentSuppression.snapshot_id,
  });
  if (!reserved) {
    return {
      state: 'duplicate',
      email_provider_calls: 0,
      whatsapp_provider_calls: 0,
      reservations: 0,
      writes: 1,
    };
  }

  const finalSuppression = await input.suppression.readCurrent(prewritePlan.adult_id);
  const finalCandidate = await input.eligibility.readCurrent(prewritePlan.adult_id);
  const dispatchPlan = plan(input, finalCandidate, finalSuppression);
  if (dispatchPlan.state !== 'deliver_email') {
    const result = nonDeliveryResult(dispatchPlan, { reservations: 1, writes: 3 });
    await input.repository.completeDecision({
      operation_id: input.operation_id,
      expected_version: input.expected_version + 1,
      status: 'skipped',
      safe_provider_ref_hash: null,
      safe_reason: resultReason(result),
    });
    return result;
  }

  let receipt: CampaignEmailDispatchReceipt;
  try {
    receipt = await input.email.dispatchThroughF05(
      emailPayload(dispatchPlan, input.safe_provider_reference),
      input.signal,
    );
  } catch {
    return {
      state: 'dispatch_persistence_unconfirmed',
      safe_error_code: 'ot16_f05_dispatch_persistence_unconfirmed',
      email_provider_calls: 1,
      whatsapp_provider_calls: 0,
      reservations: 1,
      writes: 2,
    };
  }

  if (!receiptMatchesDispatch(receipt, dispatchPlan.operation_id)) {
    return {
      state: 'dispatch_persistence_unconfirmed',
      safe_error_code: 'ot16_f05_dispatch_receipt_mismatch',
      email_provider_calls: 1,
      whatsapp_provider_calls: 0,
      reservations: 1,
      writes: 2,
    };
  }

  return persistOutcome(input, dispatchPlan, receipt);
}

async function persistOutcome(
  input: RunOt16CheckpointInput,
  dispatchPlan: Extract<Ot16CheckpointPlan, { state: 'deliver_email' }>,
  receipt: CampaignEmailDispatchReceipt,
): Promise<RunOt16CheckpointResult> {
  const { outcome, durable_job: durableJob } = receipt;
  if (outcome.kind === 'accepted') {
    if (!outcome.completed_locally) {
      return {
        state: 'accepted_pending_local_completion',
        safe_error_code: 'ot16_local_completion_pending',
        email_provider_calls: 1,
        whatsapp_provider_calls: 0,
        reservations: 1,
        writes: 2,
      };
    }
    const completed = await input.repository.completeDecision({
      operation_id: dispatchPlan.operation_id,
      expected_version: input.expected_version + 1,
      status: 'email_sent',
      safe_provider_ref_hash: outcome.provider_acceptance_digest,
      safe_reason: 'channel_skipped_not_configured',
    });
    if (!completed) {
      return {
        state: 'accepted_pending_local_completion',
        safe_error_code: 'ot16_local_completion_unconfirmed',
        email_provider_calls: 1,
        whatsapp_provider_calls: 0,
        reservations: 1,
        writes: 2,
      };
    }
    return {
      state: 'sent',
      email_provider_calls: 1,
      whatsapp_provider_calls: 0,
      reservations: 1,
      writes: 3,
    };
  }

  if (outcome.kind === 'not_accepted_retryable') {
    await input.repository.completeDecision({
      operation_id: dispatchPlan.operation_id,
      expected_version: input.expected_version + 1,
      status: 'retry_pending',
      safe_provider_ref_hash: null,
      safe_reason: outcome.safe_error_code,
    });
    return {
      state: 'retry_pending',
      safe_error_code: outcome.safe_error_code,
      email_provider_calls: 1,
      whatsapp_provider_calls: 0,
      reservations: 1,
      writes: 3,
    };
  }

  if (outcome.kind === 'permanently_rejected') {
    await input.repository.completeDecision({
      operation_id: dispatchPlan.operation_id,
      expected_version: input.expected_version + 1,
      status: 'skipped',
      safe_provider_ref_hash: null,
      safe_reason: outcome.safe_error_code,
    });
    return {
      state: 'permanently_rejected',
      safe_error_code: outcome.safe_error_code,
      email_provider_calls: 1,
      whatsapp_provider_calls: 0,
      reservations: 1,
      writes: 3,
    };
  }

  return {
    state: 'acceptance_unknown',
    safe_error_code: durableJob.safe_error_code ?? outcome.safe_error_code,
    email_provider_calls: 1,
    whatsapp_provider_calls: 0,
    reservations: 1,
    writes: 2,
  };
}

function receiptMatchesDispatch(
  receipt: CampaignEmailDispatchReceipt,
  operationId: string,
): boolean {
  const { outcome, durable_job: job } = receipt;
  if (
    job.job_id.trim() === '' ||
    job.operation_type !== 'ghl.workflow.ot16_checkpoint' ||
    job.idempotency_key !== operationId ||
    !Number.isSafeInteger(job.version) ||
    job.version < 1 ||
    !Number.isFinite(Date.parse(job.updated_at))
  ) {
    return false;
  }

  if (outcome.kind === 'accepted') {
    return (
      job.state === (outcome.completed_locally ? 'complete' : 'accepted') &&
      !job.unknown_effect &&
      isSha256(job.provider_acceptance_digest) &&
      job.provider_acceptance_digest === outcome.provider_acceptance_digest &&
      job.safe_error_code === null
    );
  }
  if (outcome.kind === 'acceptance_unknown') {
    return (
      job.state === 'acceptance_unknown' &&
      job.unknown_effect &&
      job.provider_acceptance_digest === null &&
      typeof job.safe_error_code === 'string' &&
      job.safe_error_code.trim() !== ''
    );
  }
  if (outcome.kind === 'permanently_rejected') {
    return (
      job.state === 'rejected' &&
      !job.unknown_effect &&
      job.provider_acceptance_digest === null &&
      hasSafeErrorCode(job.safe_error_code)
    );
  }
  return (
    (job.state === 'retry_wait' || job.state === 'dead_letter') &&
    !job.unknown_effect &&
    job.provider_acceptance_digest === null &&
    hasSafeErrorCode(job.safe_error_code)
  );
}

function hasSafeErrorCode(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function plan(
  input: RunOt16CheckpointInput,
  candidate: CampaignAudienceCandidate,
  suppression: CommunicationSuppressionSnapshot,
): Ot16CheckpointPlan {
  return planOt16Checkpoint({
    operation_id: input.operation_id,
    checkpoint_days: input.checkpoint_days,
    expiry_at: input.expiry_at,
    candidate,
    suppression,
  });
}

function nonDeliveryResult(
  plan: Exclude<Ot16CheckpointPlan, { state: 'deliver_email' }>,
  counts: ExecutionCounts = { reservations: 0, writes: 0 },
): RunOt16CheckpointResult {
  if (plan.state === 'student_prohibited') {
    return {
      state: 'student_prohibited',
      email_provider_calls: 0,
      whatsapp_provider_calls: 0,
      ...counts,
    };
  }
  if (plan.state === 'invalid_operation_id') {
    return {
      state: 'invalid_operation_id',
      reason: plan.reason,
      email_provider_calls: 0,
      whatsapp_provider_calls: 0,
      ...counts,
    };
  }
  if (plan.state === 'exited') {
    return {
      state: 'exited',
      reason: plan.reason,
      email_provider_calls: 0,
      whatsapp_provider_calls: 0,
      ...counts,
    };
  }
  if (plan.state === 'suppressed') {
    return {
      state: 'skipped',
      reason: plan.reason,
      email_provider_calls: 0,
      whatsapp_provider_calls: 0,
      ...counts,
    };
  }
  return {
    state: 'duplicate',
    email_provider_calls: 0,
    whatsapp_provider_calls: 0,
    ...counts,
  };
}

function resultReason(result: RunOt16CheckpointResult): string {
  if ('reason' in result) {
    return result.state === 'exited' ? `send_time_${result.reason}` : result.reason;
  }
  return `send_time_${result.state}`;
}

function emailPayload(
  plan: { operation_id: string; adult_id: string; notice: Ot16Notice },
  safeProviderReference: string,
): Parameters<CampaignEmailPort['dispatchThroughF05']>[0] {
  return {
    operation_id: plan.operation_id,
    adult_id: plan.adult_id,
    sender_key: 'office',
    transport: 'GHL',
    subject: plan.notice.subject,
    body: plan.notice.body,
    cta_label: plan.notice.cta_label,
    content_digest: createHash('sha256').update(JSON.stringify(plan.notice), 'utf8').digest('hex'),
    safe_provider_reference: safeProviderReference,
  };
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}
