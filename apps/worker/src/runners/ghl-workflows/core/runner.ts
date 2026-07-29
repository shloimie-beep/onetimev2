import {
  CORE_WORKFLOW_BY_KEY,
  assertCoreWorkflowApproval,
  compareCoreWorkflowReadback,
  planCoreWorkflowEvent,
  recheckCoreWorkflowSuppression,
  type CoreWorkflowApprovalLookup,
  type CoreWorkflowApprovalReadPort,
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
  plan_input: Omit<PlanCoreWorkflowInput, 'approval'>;
  approval: CoreWorkflowApprovalReadPort;
  repository: CoreWorkflowRepository;
  suppression: CoreWorkflowSuppressionPort;
  provider: CoreWorkflowProviderPort;
}): Promise<RunCoreWorkflowResult> {
  if (input.plan_input.subject.kind === 'student') {
    return {
      state: 'student_prohibited',
      reason: 'student_contact_prohibited',
      email_provider_calls: 0,
      whatsapp_provider_calls: 0,
      student_provider_calls: 0,
    };
  }

  let plan: CoreWorkflowPlan;
  let planInput: PlanCoreWorkflowInput;
  try {
    const approval = await input.approval.readApproved({
      workflow_key: input.plan_input.workflow_key,
      adult_id: input.plan_input.subject.adult_id,
      household_id: input.plan_input.evidence.household_id,
      source_event_id: input.plan_input.evidence.source_event_id,
    });
    planInput = { ...input.plan_input, approval: approval! };
    plan = planCoreWorkflowEvent(planInput);
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
    approval_id: plan.approval_id,
    approval_evidence_digest: plan.approval_evidence_digest,
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
  const email = recheckCoreWorkflowSuppression(planInput, currentSuppression);
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
      approval_id: plan.approval_id,
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
  approval_lookup: CoreWorkflowApprovalLookup;
  approval: CoreWorkflowApprovalReadPort;
  repository: CoreWorkflowRepository;
  provider: CoreWorkflowProviderPort;
}): Promise<CoreWorkflowReadbackComparison> {
  const definition = CORE_WORKFLOW_BY_KEY[input.approval_lookup.workflow_key];
  const approval = await input.approval.readApproved(input.approval_lookup);
  assertCoreWorkflowApproval(definition, approval);
  const providerReadback = await input.provider.readWorkflow(input.approval_lookup.workflow_key);
  const comparison = compareCoreWorkflowReadback(definition, providerReadback, approval);
  await input.repository.persistReadback(comparison);
  return comparison;
}
