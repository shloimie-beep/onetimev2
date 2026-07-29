import { createHash } from 'node:crypto';

import type {
  CommunicationFoundationRepository,
  CommunicationSuppressionSnapshot,
} from '../../../../../../packages/contracts/src/communications/foundation/index.ts';
import {
  planOt16Checkpoint,
  type CampaignAudienceCandidate,
  type Ot16CheckpointDays,
  type Ot16ExitReason,
  type Ot16Notice,
} from '../../../../../../packages/domain/src/communications/workflows/campaigns/index.ts';

export interface CampaignSuppressionReadPort {
  readCurrent(adult_id: string): Promise<CommunicationSuppressionSnapshot>;
}

export interface CampaignEligibilityReadPort {
  readCurrent(adult_id: string): Promise<CampaignAudienceCandidate>;
}

export interface CampaignEmailPort {
  send(input: {
    operation_id: string;
    adult_id: string;
    sender_key: 'office';
    transport: 'GHL';
    subject: string;
    body: string;
    cta_label: 'Complete Checkout';
    content_digest: string;
  }): Promise<{ safe_provider_ref_hash: string }>;
}

export interface RunOt16CheckpointInput {
  operation_id: string;
  checkpoint_days: Ot16CheckpointDays;
  expiry_at: string;
  candidate: CampaignAudienceCandidate;
  suppression_at_approval: CommunicationSuppressionSnapshot;
  expected_version: number;
  repository: CommunicationFoundationRepository;
  suppression: CampaignSuppressionReadPort;
  eligibility: CampaignEligibilityReadPort;
  email: CampaignEmailPort;
}

export type RunOt16CheckpointResult =
  | { state: 'student_prohibited'; email_provider_calls: 0; whatsapp_provider_calls: 0 }
  | {
      state: 'invalid_operation_id';
      reason: 'operation_id_mismatch';
      email_provider_calls: 0;
      whatsapp_provider_calls: 0;
    }
  | {
      state: 'exited';
      reason: Ot16ExitReason;
      email_provider_calls: 0;
      whatsapp_provider_calls: 0;
    }
  | {
      state: 'skipped';
      reason: string;
      email_provider_calls: 0;
      whatsapp_provider_calls: 0;
    }
  | { state: 'stale_fenced'; email_provider_calls: 0; whatsapp_provider_calls: 0 }
  | { state: 'duplicate'; email_provider_calls: 0; whatsapp_provider_calls: 0 }
  | { state: 'sent'; email_provider_calls: 1; whatsapp_provider_calls: 0 }
  | { state: 'retry_pending'; email_provider_calls: 1; whatsapp_provider_calls: 0 };

/**
 * Executes one already-approved OT-16 checkpoint. Provider access is fenced
 * behind an Adult-only plan, deterministic identity, a fresh suppression
 * read, a durable operation reservation, and a final current-eligibility read.
 * WhatsApp has no port by design while the channel is dormant.
 */
export async function runOt16Checkpoint(
  input: RunOt16CheckpointInput,
): Promise<RunOt16CheckpointResult> {
  const initialPlan = planOt16Checkpoint({
    operation_id: input.operation_id,
    checkpoint_days: input.checkpoint_days,
    expiry_at: input.expiry_at,
    candidate: input.candidate,
    suppression: input.suppression_at_approval,
  });

  if (initialPlan.state === 'student_prohibited') {
    return {
      state: 'student_prohibited',
      email_provider_calls: 0,
      whatsapp_provider_calls: 0,
    };
  }
  if (initialPlan.state === 'invalid_operation_id') {
    return {
      state: 'invalid_operation_id',
      reason: initialPlan.reason,
      email_provider_calls: 0,
      whatsapp_provider_calls: 0,
    };
  }
  if (initialPlan.state === 'exited') {
    return {
      state: 'exited',
      reason: initialPlan.reason,
      email_provider_calls: 0,
      whatsapp_provider_calls: 0,
    };
  }
  if (initialPlan.state === 'suppressed') {
    return {
      state: 'skipped',
      reason: initialPlan.reason,
      email_provider_calls: 0,
      whatsapp_provider_calls: 0,
    };
  }
  if (initialPlan.state === 'duplicate') {
    return { state: 'duplicate', email_provider_calls: 0, whatsapp_provider_calls: 0 };
  }

  const persisted = await input.repository.persistDecision({
    record: {
      operation_id: initialPlan.operation_id,
      adult_id: initialPlan.adult_id,
      purpose: 'marketing',
      plan: initialPlan.channel_plan,
      suppression_snapshot_id: input.suppression_at_approval.snapshot_id,
      status: 'planned',
    },
    expected_version: input.expected_version,
  });
  if (!persisted) {
    return { state: 'stale_fenced', email_provider_calls: 0, whatsapp_provider_calls: 0 };
  }

  const currentSuppression = await input.suppression.readCurrent(initialPlan.adult_id);
  const sendTimePlan = planOt16Checkpoint({
    operation_id: input.operation_id,
    checkpoint_days: input.checkpoint_days,
    expiry_at: input.expiry_at,
    candidate: input.candidate,
    suppression: currentSuppression,
  });
  if (sendTimePlan.state !== 'deliver_email') {
    const reason =
      sendTimePlan.state === 'suppressed' ? sendTimePlan.reason : `send_time_${sendTimePlan.state}`;
    await input.repository.completeDecision({
      operation_id: input.operation_id,
      expected_version: input.expected_version + 1,
      status: 'skipped',
      safe_provider_ref_hash: null,
      safe_reason: reason,
    });
    return {
      state: 'skipped',
      reason,
      email_provider_calls: 0,
      whatsapp_provider_calls: 0,
    };
  }

  const reserved = await input.repository.reserveEmailDelivery({
    operation_id: sendTimePlan.operation_id,
    suppression_snapshot_id: currentSuppression.snapshot_id,
  });
  if (!reserved) {
    return { state: 'duplicate', email_provider_calls: 0, whatsapp_provider_calls: 0 };
  }

  const currentCandidate = await input.eligibility.readCurrent(sendTimePlan.adult_id);
  const dispatchPlan = planOt16Checkpoint({
    operation_id: input.operation_id,
    checkpoint_days: input.checkpoint_days,
    expiry_at: input.expiry_at,
    candidate: currentCandidate,
    suppression: currentSuppression,
  });
  if (dispatchPlan.state !== 'deliver_email') {
    const reason =
      dispatchPlan.state === 'exited'
        ? `send_time_${dispatchPlan.reason}`
        : dispatchPlan.state === 'suppressed'
          ? dispatchPlan.reason
          : dispatchPlan.state === 'invalid_operation_id'
            ? dispatchPlan.reason
            : `send_time_${dispatchPlan.state}`;
    await input.repository.completeDecision({
      operation_id: input.operation_id,
      expected_version: input.expected_version + 1,
      status: 'skipped',
      safe_provider_ref_hash: null,
      safe_reason: reason,
    });
    if (dispatchPlan.state === 'exited') {
      return {
        state: 'exited',
        reason: dispatchPlan.reason,
        email_provider_calls: 0,
        whatsapp_provider_calls: 0,
      };
    }
    if (dispatchPlan.state === 'student_prohibited') {
      return {
        state: 'student_prohibited',
        email_provider_calls: 0,
        whatsapp_provider_calls: 0,
      };
    }
    if (dispatchPlan.state === 'invalid_operation_id') {
      return {
        state: 'invalid_operation_id',
        reason: dispatchPlan.reason,
        email_provider_calls: 0,
        whatsapp_provider_calls: 0,
      };
    }
    return {
      state: 'skipped',
      reason,
      email_provider_calls: 0,
      whatsapp_provider_calls: 0,
    };
  }

  try {
    const delivery = await input.email.send(emailPayload(dispatchPlan));
    await input.repository.completeDecision({
      operation_id: dispatchPlan.operation_id,
      expected_version: input.expected_version + 1,
      status: 'email_sent',
      safe_provider_ref_hash: delivery.safe_provider_ref_hash,
      safe_reason: 'channel_skipped_not_configured',
    });
    return { state: 'sent', email_provider_calls: 1, whatsapp_provider_calls: 0 };
  } catch {
    await input.repository.completeDecision({
      operation_id: sendTimePlan.operation_id,
      expected_version: input.expected_version + 1,
      status: 'retry_pending',
      safe_provider_ref_hash: null,
      safe_reason: 'email_provider_failed',
    });
    return { state: 'retry_pending', email_provider_calls: 1, whatsapp_provider_calls: 0 };
  }
}

function emailPayload(plan: {
  operation_id: string;
  adult_id: string;
  notice: Ot16Notice;
}): Parameters<CampaignEmailPort['send']>[0] {
  return {
    operation_id: plan.operation_id,
    adult_id: plan.adult_id,
    sender_key: 'office',
    transport: 'GHL',
    subject: plan.notice.subject,
    body: plan.notice.body,
    cta_label: plan.notice.cta_label,
    content_digest: createHash('sha256').update(JSON.stringify(plan.notice), 'utf8').digest('hex'),
  };
}
