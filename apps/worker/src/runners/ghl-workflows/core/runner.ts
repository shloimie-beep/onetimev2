import {
  CORE_WORKFLOW_BY_KEY,
  compareCoreWorkflowReadback,
  planCoreWorkflowEvent,
  recheckCoreWorkflowSuppression,
  type CoreWorkflowPlan,
  type CoreWorkflowProviderPort,
  type CoreWorkflowReadbackComparison,
  type CoreWorkflowRepository,
  type CoreWorkflowSuppressionPort,
  type PlanCoreWorkflowInput,
} from '../../../../../../packages/domain/src/communications/workflows/core/index.ts';

export type RunCoreWorkflowResult =
  | {
      state: 'student_prohibited' | 'invalid_evidence';
      reason: string;
      email_provider_calls: 0;
      whatsapp_provider_calls: 0;
      student_provider_calls: 0;
    }
  | {
      state: 'suppressed' | 'duplicate';
      reason: string;
      plan: CoreWorkflowPlan;
      email_provider_calls: 0;
      whatsapp_provider_calls: 0;
      student_provider_calls: 0;
    }
  | {
      state: 'sent' | 'retry_pending';
      plan: CoreWorkflowPlan;
      email_provider_calls: 1;
      whatsapp_provider_calls: 0;
      student_provider_calls: 0;
    };

export async function runCoreWorkflow(input: {
  plan_input: PlanCoreWorkflowInput;
  repository: CoreWorkflowRepository;
  suppression: CoreWorkflowSuppressionPort;
  provider: CoreWorkflowProviderPort;
}): Promise<RunCoreWorkflowResult> {
  let plan: CoreWorkflowPlan;
  try {
    plan = planCoreWorkflowEvent(input.plan_input);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'invalid_evidence';
    return {
      state: reason === 'student_contact_prohibited' ? 'student_prohibited' : 'invalid_evidence',
      reason,
      email_provider_calls: 0,
      whatsapp_provider_calls: 0,
      student_provider_calls: 0,
    };
  }

  const reserved = await input.repository.reserveDelivery({
    operation_id: plan.operation_id,
    workflow_key: plan.workflow_key,
    adult_id: plan.adult_id,
    household_id: plan.household_id,
    suppression_snapshot_id: input.plan_input.suppression.snapshot_id,
    content_digest: plan.content_digest,
    audience_digest: plan.audience_digest,
  });
  if (!reserved) {
    return {
      state: 'duplicate',
      reason: 'idempotent_delivery_already_reserved',
      plan,
      email_provider_calls: 0,
      whatsapp_provider_calls: 0,
      student_provider_calls: 0,
    };
  }

  const currentSuppression = await input.suppression.readCurrent(plan.adult_id);
  const email = recheckCoreWorkflowSuppression(input.plan_input, currentSuppression);
  if (email.disposition === 'suppressed') {
    await input.repository.completeDelivery({
      operation_id: plan.operation_id,
      state: 'skipped',
      safe_provider_ref_hash: null,
      safe_reason: email.reason,
    });
    return {
      state: 'suppressed',
      reason: email.reason,
      plan: { ...plan, email },
      email_provider_calls: 0,
      whatsapp_provider_calls: 0,
      student_provider_calls: 0,
    };
  }

  try {
    const result = await input.provider.sendAdultEmail({
      operation_id: plan.operation_id,
      workflow_key: plan.workflow_key,
      adult_id: plan.adult_id,
      household_id: plan.household_id,
      sender_key: plan.sender_key,
      message_class: plan.message_class,
      content_digest: plan.content_digest,
      audience_digest: plan.audience_digest,
    });
    await input.repository.completeDelivery({
      operation_id: plan.operation_id,
      state: 'sent',
      safe_provider_ref_hash: result.safe_provider_ref_hash,
      safe_reason: 'whatsapp_channel_dormant',
    });
    return {
      state: 'sent',
      plan: { ...plan, email },
      email_provider_calls: 1,
      whatsapp_provider_calls: 0,
      student_provider_calls: 0,
    };
  } catch {
    await input.repository.completeDelivery({
      operation_id: plan.operation_id,
      state: 'retry_pending',
      safe_provider_ref_hash: null,
      safe_reason: 'ghl_email_provider_failed',
    });
    return {
      state: 'retry_pending',
      plan: { ...plan, email },
      email_provider_calls: 1,
      whatsapp_provider_calls: 0,
      student_provider_calls: 0,
    };
  }
}

export async function readAndPersistCoreWorkflow(input: {
  workflow_key: PlanCoreWorkflowInput['workflow_key'];
  content_digest: string;
  audience_digest: string;
  repository: CoreWorkflowRepository;
  provider: CoreWorkflowProviderPort;
}): Promise<CoreWorkflowReadbackComparison> {
  const definition = CORE_WORKFLOW_BY_KEY[input.workflow_key];
  const providerReadback = await input.provider.readWorkflow(input.workflow_key);
  const comparison = compareCoreWorkflowReadback(definition, providerReadback, {
    content_digest: input.content_digest,
    audience_digest: input.audience_digest,
  });
  await input.repository.persistReadback(comparison);
  return comparison;
}
