import type {
  CommunicationFoundationRepository,
  CommunicationSenderKey,
  CommunicationSuppressionSnapshot,
  PlanCommunicationChannelsInput,
  SafeClassReminderMessage,
  WebsiteLeadCaptureInput,
} from '../../../../../packages/contracts/src/communications/foundation/index.ts';
import { COMMUNICATION_SENDER_PROFILES } from '../../../../../packages/contracts/src/communications/foundation/index.ts';
import {
  CommunicationFoundationError,
  planCommunicationChannels,
  planWebsiteLeadCapture,
} from '../../../../../packages/domain/src/communications/foundation/index.ts';

export interface CommunicationSuppressionReadPort {
  readCurrent(adult_id: string): Promise<CommunicationSuppressionSnapshot>;
}

export interface CommunicationEmailPort {
  send(input: {
    operation_id: string;
    adult_id: string;
    sender_key: CommunicationSenderKey;
    transport: 'GHL' | 'Resend';
    safe_message?: SafeClassReminderMessage;
  }): Promise<{ safe_provider_ref_hash: string }>;
}

export interface RunEmailFirstCommunicationInput {
  plan_input: PlanCommunicationChannelsInput;
  sender_key: CommunicationSenderKey;
  expected_version: number;
  repository: CommunicationFoundationRepository;
  suppression: CommunicationSuppressionReadPort;
  email: CommunicationEmailPort;
  safe_message?: SafeClassReminderMessage;
}

export type EmailFirstCommunicationResult =
  | { state: 'student_prohibited'; email_provider_calls: 0; whatsapp_provider_calls: 0 }
  | { state: 'stale_fenced'; email_provider_calls: 0; whatsapp_provider_calls: 0 }
  | {
      state: 'skipped';
      reason: string;
      email_provider_calls: 0;
      whatsapp_provider_calls: 0;
    }
  | { state: 'duplicate'; email_provider_calls: 0; whatsapp_provider_calls: 0 }
  | { state: 'sent'; email_provider_calls: 1; whatsapp_provider_calls: 0 }
  | { state: 'retry_pending'; email_provider_calls: 1; whatsapp_provider_calls: 0 };

export async function runEmailFirstCommunication(
  input: RunEmailFirstCommunicationInput,
): Promise<EmailFirstCommunicationResult> {
  let initialPlan;
  try {
    initialPlan = planCommunicationChannels(input.plan_input);
  } catch (error) {
    if (
      error instanceof CommunicationFoundationError &&
      error.code === 'student_contact_prohibited'
    ) {
      return {
        state: 'student_prohibited',
        email_provider_calls: 0,
        whatsapp_provider_calls: 0,
      };
    }
    throw error;
  }
  const persisted = await input.repository.persistDecision({
    record: {
      operation_id: initialPlan.operation_id,
      adult_id: initialPlan.adult_id,
      purpose: initialPlan.purpose,
      plan: initialPlan,
      suppression_snapshot_id: input.plan_input.suppression.snapshot_id,
      status: 'planned',
    },
    expected_version: input.expected_version,
  });
  if (!persisted) {
    return { state: 'stale_fenced', email_provider_calls: 0, whatsapp_provider_calls: 0 };
  }

  const currentSuppression = await input.suppression.readCurrent(initialPlan.adult_id);
  const currentPlan = planCommunicationChannels({
    ...input.plan_input,
    suppression: currentSuppression,
  });
  if (currentPlan.email.disposition === 'suppressed') {
    await input.repository.completeDecision({
      operation_id: currentPlan.operation_id,
      expected_version: input.expected_version + 1,
      status: 'skipped',
      safe_provider_ref_hash: null,
      safe_reason: currentPlan.email.reason,
    });
    return {
      state: 'skipped',
      reason: currentPlan.email.reason,
      email_provider_calls: 0,
      whatsapp_provider_calls: 0,
    };
  }
  const reserved = await input.repository.reserveEmailDelivery({
    operation_id: currentPlan.operation_id,
    suppression_snapshot_id: currentSuppression.snapshot_id,
  });
  if (!reserved) {
    return { state: 'duplicate', email_provider_calls: 0, whatsapp_provider_calls: 0 };
  }

  const sender = COMMUNICATION_SENDER_PROFILES[input.sender_key];
  if (sender.transport !== currentPlan.email.provider) {
    throw new Error('sender_transport_mismatch');
  }
  try {
    const result = await input.email.send({
      operation_id: currentPlan.operation_id,
      adult_id: currentPlan.adult_id,
      sender_key: input.sender_key,
      transport: sender.transport,
      ...(input.safe_message ? { safe_message: input.safe_message } : {}),
    });
    await input.repository.completeDecision({
      operation_id: currentPlan.operation_id,
      expected_version: input.expected_version + 1,
      status: 'email_sent',
      safe_provider_ref_hash: result.safe_provider_ref_hash,
      safe_reason:
        currentPlan.whatsapp.disposition === 'channel_skipped_not_configured'
          ? 'channel_skipped_not_configured'
          : null,
    });
    return { state: 'sent', email_provider_calls: 1, whatsapp_provider_calls: 0 };
  } catch {
    await input.repository.completeDecision({
      operation_id: currentPlan.operation_id,
      expected_version: input.expected_version + 1,
      status: 'retry_pending',
      safe_provider_ref_hash: null,
      safe_reason: 'email_provider_failed',
    });
    return { state: 'retry_pending', email_provider_calls: 1, whatsapp_provider_calls: 0 };
  }
}

export async function runWebsiteLeadCapture(input: {
  capture: WebsiteLeadCaptureInput;
  repository: CommunicationFoundationRepository;
}) {
  try {
    const plan = planWebsiteLeadCapture(input.capture);
    const persisted = await input.repository.persistWebsiteLeadPlan(plan);
    return {
      state: persisted ? ('persisted' as const) : ('duplicate' as const),
      provider_calls: 0 as const,
      plan,
    };
  } catch (error) {
    if (
      error instanceof CommunicationFoundationError &&
      error.code === 'student_contact_prohibited'
    ) {
      return { state: 'student_prohibited' as const, provider_calls: 0 as const };
    }
    throw error;
  }
}
