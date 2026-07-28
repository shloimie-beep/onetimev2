import { createHash } from 'node:crypto';
import type { CommunicationSuppressionSnapshot } from '../../../../../contracts/src/communications/foundation/index.ts';
import { CORE_WORKFLOW_BY_KEY, CORE_WORKFLOW_DEFINITIONS } from './definitions.ts';
import {
  CORE_WORKFLOW_KEYS,
  REQUIRED_CORE_APPROVAL_GATES,
  type CoreWorkflowDefinition,
  type CoreWorkflowDriftCode,
  type CoreWorkflowPlan,
  type CoreWorkflowProviderReadback,
  type CoreWorkflowReadbackComparison,
  type PlanCoreWorkflowInput,
} from './types.ts';

const BILLING_WORKFLOWS = new Set(['OT-04', 'OT-05', 'OT-06', 'OT-13']);
type SuppressionReason = Extract<
  CoreWorkflowPlan['email'],
  { disposition: 'suppressed' }
>['reason'];

function digest(parts: readonly string[]): string {
  return createHash('sha256').update(parts.join('\u001f')).digest('hex');
}

function equalList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function suppressionReason(
  definition: CoreWorkflowDefinition,
  input: PlanCoreWorkflowInput,
  suppression: CommunicationSuppressionSnapshot,
): SuppressionReason | null {
  if (suppression.invalid_address) return 'invalid_address';
  if (suppression.hard_bounce) return 'hard_bounce';
  if (suppression.complaint) return 'complaint';
  if (suppression.email_dnd) return 'email_dnd';
  if (suppression.unsubscribed) return 'unsubscribed';
  if (definition.message_purpose === 'marketing' && !input.marketing_permission) {
    return 'marketing_permission_missing';
  }
  if (definition.message_purpose === 'marketing' && suppression.marketing_suppressed) {
    return 'marketing_suppressed';
  }
  if (
    definition.message_purpose === 'optional_reminder' &&
    suppression.optional_reminder_suppressed
  ) {
    return 'optional_reminder_suppressed';
  }
  if (
    (definition.message_purpose === 'marketing' ||
      definition.message_purpose === 'optional_reminder') &&
    input.reminder_preference === 'none'
  ) {
    return 'preference_none';
  }
  return null;
}

export function validateCoreWorkflowDefinitions(
  definitions: readonly CoreWorkflowDefinition[] = CORE_WORKFLOW_DEFINITIONS,
): void {
  if (definitions.length !== CORE_WORKFLOW_KEYS.length) {
    throw new Error('core_workflow_count_must_be_12');
  }
  const keys = definitions.map((workflow) => workflow.workflow_key);
  if (new Set(keys).size !== CORE_WORKFLOW_KEYS.length) {
    throw new Error('core_workflow_keys_must_be_unique');
  }
  for (const key of CORE_WORKFLOW_KEYS) {
    if (!keys.includes(key)) throw new Error(`core_workflow_missing:${key}`);
  }
  for (const workflow of definitions) {
    if (workflow.subject !== 'adult_only' || !workflow.student_contact_prohibited) {
      throw new Error(`adult_only_contract_required:${workflow.workflow_key}`);
    }
    if (
      workflow.whatsapp_state !== 'dormant' ||
      workflow.whatsapp_provider_calls !== 0 ||
      workflow.ghl_student_contact_calls !== 0
    ) {
      throw new Error(`zero_student_and_whatsapp_calls_required:${workflow.workflow_key}`);
    }
    if (workflow.provider_financial_mutation || workflow.provider_access_mutation) {
      throw new Error(`provider_mutation_forbidden:${workflow.workflow_key}`);
    }
    if (!workflow.requires_send_time_suppression_recheck) {
      throw new Error(`suppression_recheck_required:${workflow.workflow_key}`);
    }
    for (const gate of REQUIRED_CORE_APPROVAL_GATES) {
      if (!workflow.approval_gates.includes(gate)) {
        throw new Error(`approval_gate_missing:${workflow.workflow_key}:${gate}`);
      }
    }
  }
  const reminder = CORE_WORKFLOW_BY_KEY['OT-09'];
  if (
    !reminder.waits.includes('until_30_minutes_before_occurrence') ||
    reminder.ordered_steps.some((step) => /zoom|student.*url|student.*link/i.test(step))
  ) {
    throw new Error('ot09_parent_only_30_minute_contract_required');
  }
  const invitation = CORE_WORKFLOW_BY_KEY['OT-07'];
  if (!invitation.ordered_steps.some((step) => step.includes('without_security_token'))) {
    throw new Error('ot07_resend_security_boundary_required');
  }
  for (const key of BILLING_WORKFLOWS) {
    if (
      !CORE_WORKFLOW_BY_KEY[key as keyof typeof CORE_WORKFLOW_BY_KEY]
        .requires_signed_billing_projection
    ) {
      throw new Error(`signed_billing_projection_required:${key}`);
    }
  }
}

export function planCoreWorkflowEvent(input: PlanCoreWorkflowInput): CoreWorkflowPlan {
  const definition = CORE_WORKFLOW_BY_KEY[input.workflow_key];
  if (input.subject.kind !== 'adult') throw new Error('student_contact_prohibited');
  if (!input.subject.household_id || input.subject.household_id !== input.evidence.household_id) {
    throw new Error('household_scope_mismatch');
  }
  if (input.evidence.trigger !== definition.trigger) throw new Error('trigger_evidence_mismatch');
  if (definition.requires_local_commit_readback && !input.evidence.local_commit_readback) {
    throw new Error('local_commit_readback_required');
  }
  if (definition.requires_signed_billing_projection && !input.evidence.signed_billing_projection) {
    throw new Error('signed_billing_projection_required');
  }
  if (
    input.workflow_key === 'OT-02A' &&
    (!input.evidence.approved_audience || !input.evidence.approved_copy)
  ) {
    throw new Error('migration_audience_and_copy_approval_required');
  }
  if (
    input.workflow_key === 'OT-02B' &&
    (!input.evidence.approved_audience || !input.marketing_permission)
  ) {
    throw new Error('explicit_opt_in_and_admin_start_required');
  }
  if (!input.content_digest || !input.audience_digest) {
    throw new Error('content_and_audience_digests_required');
  }

  const reason = suppressionReason(definition, input, input.suppression);
  const whatsappDisposition =
    input.reminder_preference === 'email'
      ? 'not_requested'
      : input.reminder_preference === 'none'
        ? 'disabled_by_preference'
        : 'channel_skipped_not_configured';

  return {
    operation_id: digest([
      'p29-core-workflow-v1',
      input.workflow_key,
      input.subject.adult_id,
      input.evidence.household_id,
      input.evidence.source_event_id,
      input.evidence.source_event_digest,
      input.evidence.episode_key,
    ]),
    workflow_key: input.workflow_key,
    adult_id: input.subject.adult_id,
    household_id: input.evidence.household_id,
    source_event_id: input.evidence.source_event_id,
    episode_key: input.evidence.episode_key,
    sender_key: definition.sender_key,
    message_class: definition.message_class,
    content_digest: input.content_digest,
    audience_digest: input.audience_digest,
    email: reason
      ? { disposition: 'suppressed', reason, suppression_recheck_required: true }
      : { disposition: 'send', provider: 'GHL', suppression_recheck_required: true },
    whatsapp: { disposition: whatsappDisposition, provider_calls: 0 },
    ordered_steps: definition.ordered_steps,
    waits: definition.waits,
    exit_conditions: definition.exit_conditions,
    direct_financial_mutation: false,
    direct_access_mutation: false,
    student_provider_calls: 0,
    whatsapp_provider_calls: 0,
  };
}

export function recheckCoreWorkflowSuppression(
  input: PlanCoreWorkflowInput,
  suppression: CommunicationSuppressionSnapshot,
): CoreWorkflowPlan['email'] {
  const reason = suppressionReason(CORE_WORKFLOW_BY_KEY[input.workflow_key], input, suppression);
  return reason
    ? { disposition: 'suppressed', reason, suppression_recheck_required: true }
    : { disposition: 'send', provider: 'GHL', suppression_recheck_required: true };
}

export function compareCoreWorkflowReadback(
  definition: CoreWorkflowDefinition,
  readback: CoreWorkflowProviderReadback,
  expected: { content_digest: string; audience_digest: string },
): CoreWorkflowReadbackComparison {
  const drift: CoreWorkflowDriftCode[] = [];
  if (readback.canonical_name !== definition.canonical_name) drift.push('canonical_name');
  if (readback.state !== definition.desired_initial_state) drift.push('state');
  if (readback.trigger !== definition.trigger) drift.push('trigger');
  if (!equalList(readback.ordered_steps, definition.ordered_steps)) drift.push('ordered_steps');
  if (!equalList(readback.waits, definition.waits)) drift.push('waits');
  if (!equalList(readback.exit_conditions, definition.exit_conditions)) {
    drift.push('exit_conditions');
  }
  if (readback.sender_key !== definition.sender_key) drift.push('sender');
  if (readback.subject !== 'adult_only') drift.push('subject');
  if (readback.message_class !== definition.message_class) drift.push('message_class');
  if (readback.content_digest !== expected.content_digest) drift.push('content_digest');
  if (readback.audience_digest !== expected.audience_digest) drift.push('audience_digest');
  if (!readback.requires_send_time_suppression_recheck) drift.push('suppression_recheck');
  return {
    workflow_key: definition.workflow_key,
    ready: drift.length === 0,
    drift,
    expected_state: definition.desired_initial_state,
    provider_workflow_ref_hash: readback.provider_workflow_ref_hash,
    provider_read_at: readback.provider_read_at,
    provider_effects: 0,
  };
}
