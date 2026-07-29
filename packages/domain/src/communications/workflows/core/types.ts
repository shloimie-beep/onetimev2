import type {
  CommunicationSenderKey,
  CommunicationSubject,
  CommunicationSuppressionSnapshot,
  CommunicationWorkflowDefinition,
  WorkflowApprovalGate,
  WorkflowControlState,
} from '../../../../../contracts/src/communications/foundation/index.ts';

export const CORE_WORKFLOW_KEYS = [
  'OT-01',
  'OT-02A',
  'OT-02B',
  'OT-03',
  'OT-04',
  'OT-05',
  'OT-06',
  'OT-07',
  'OT-08',
  'OT-09',
  'OT-10',
  'OT-13',
] as const;

export type CoreWorkflowKey = (typeof CORE_WORKFLOW_KEYS)[number];

export const CORE_WORKFLOW_REQUIREMENT_IDS = {
  'OT-01': 'OTV2-GHL-123',
  'OT-02A': 'OTV2-GHL-124',
  'OT-02B': 'OTV2-GHL-125',
  'OT-03': 'OTV2-GHL-126',
  'OT-04': 'OTV2-GHL-127',
  'OT-05': 'OTV2-GHL-128',
  'OT-06': 'OTV2-GHL-129',
  'OT-07': 'OTV2-GHL-130',
  'OT-08': 'OTV2-GHL-131',
  'OT-09': 'OTV2-GHL-132',
  'OT-10': 'OTV2-GHL-133',
  'OT-13': 'OTV2-GHL-136',
} as const satisfies Record<CoreWorkflowKey, string>;

export const CORE_WORKFLOW_ACCEPTANCE_CASE_IDS = {
  'OT-01': 'OTV2-GHL-123-AC01',
  'OT-02A': 'OTV2-GHL-124-AC01',
  'OT-02B': 'OTV2-GHL-125-AC01',
  'OT-03': 'OTV2-GHL-126-AC01',
  'OT-04': 'OTV2-GHL-127-AC01',
  'OT-05': 'OTV2-GHL-128-AC01',
  'OT-06': 'OTV2-GHL-129-AC01',
  'OT-07': 'OTV2-GHL-130-AC01',
  'OT-08': 'OTV2-GHL-131-AC01',
  'OT-09': 'OTV2-GHL-132-AC01',
  'OT-10': 'OTV2-GHL-133-AC01',
  'OT-13': 'OTV2-GHL-136-AC01',
} as const satisfies Record<CoreWorkflowKey, string>;

export type CoreWorkflowMessageClass =
  | 'signup_confirmation'
  | 'support_acknowledgement'
  | 'existing_subscriber_migration'
  | 'prelaunch_nurture'
  | 'access_help'
  | 'warm_enrollment_campaign'
  | 'payment_receipt'
  | 'payment_failed_support'
  | 'cancellation_help'
  | 'cancellation_confirmation'
  | 'portal_welcome'
  | 'portal_activated'
  | 'class_reminder'
  | 'recording_available'
  | 'refund_help';

export interface CoreWorkflowDefinition extends Omit<
  CommunicationWorkflowDefinition,
  'workflow_key'
> {
  workflow_key: CoreWorkflowKey;
  requirement_id: string;
  acceptance_case_id: string;
  message_class: CoreWorkflowMessageClass;
  desired_initial_state: 'SAVED_REOPENED' | 'DRAFT_WAITING_EXTERNAL';
  waits: readonly string[];
  policy_constants: readonly string[];
  approved_copy_ids: readonly string[];
  requires_signed_billing_projection: boolean;
  requires_local_commit_readback: boolean;
  requires_approved_audience: true;
  requires_approved_copy: true;
  requires_admin_approval: boolean;
  requires_provider_readback: boolean;
  provider_financial_mutation: false;
  provider_access_mutation: false;
  ghl_student_contact_calls: 0;
  whatsapp_provider_calls: 0;
}

export type CoreWorkflowTriggerEvidence = {
  trigger: string;
  source_event_id: string;
  source_event_digest: string;
  household_id: string;
  episode_key: string;
  local_commit_readback: boolean;
  signed_billing_projection: boolean;
};

export interface CoreWorkflowApprovalSnapshot {
  approval_id: string;
  source: 'trusted_approval_store';
  approved_by_admin_id: string;
  approved_at: string;
  approved_audience: boolean;
  approved_copy: boolean;
  approved_content_digest: string;
  approved_audience_digest: string;
  admin_approved: boolean;
  provider_readback_verified: boolean;
  evidence_digest: string;
}

export interface CoreWorkflowApprovalLookup {
  workflow_key: CoreWorkflowKey;
  adult_id: string;
  household_id: string;
  source_event_id: string;
}

export interface PlanCoreWorkflowInput {
  workflow_key: CoreWorkflowKey;
  subject: CommunicationSubject;
  evidence: CoreWorkflowTriggerEvidence;
  approval: CoreWorkflowApprovalSnapshot;
  suppression: CommunicationSuppressionSnapshot;
  reminder_preference: 'email' | 'whatsapp' | 'both' | 'none';
  marketing_permission: boolean;
  content_digest: string;
  audience_digest: string;
  occurred_at: string;
}

export interface CoreWorkflowPlan {
  operation_id: string;
  workflow_key: CoreWorkflowKey;
  adult_id: string;
  household_id: string;
  source_event_id: string;
  episode_key: string;
  sender_key: CommunicationSenderKey;
  message_class: CoreWorkflowMessageClass;
  content_digest: string;
  audience_digest: string;
  approval_id: string;
  approval_evidence_digest: string;
  email:
    | { disposition: 'send'; provider: 'GHL'; suppression_recheck_required: true }
    | {
        disposition: 'suppressed';
        reason:
          | 'email_dnd'
          | 'unsubscribed'
          | 'complaint'
          | 'hard_bounce'
          | 'invalid_address'
          | 'marketing_suppressed'
          | 'optional_reminder_suppressed'
          | 'marketing_permission_missing'
          | 'preference_none';
        suppression_recheck_required: true;
      };
  whatsapp: {
    disposition: 'not_requested' | 'disabled_by_preference' | 'channel_skipped_not_configured';
    provider_calls: 0;
  };
  ordered_steps: readonly string[];
  waits: readonly string[];
  exit_conditions: readonly string[];
  direct_financial_mutation: false;
  direct_access_mutation: false;
  student_provider_calls: 0;
  whatsapp_provider_calls: 0;
}

export interface CoreWorkflowProviderReadback {
  workflow_key: CoreWorkflowKey;
  canonical_name: string;
  state: WorkflowControlState;
  trigger: string;
  ordered_steps: readonly string[];
  waits: readonly string[];
  exit_conditions: readonly string[];
  sender_key: CommunicationSenderKey;
  subject: 'adult_only' | 'student_or_adult';
  message_class: string;
  content_digest: string;
  audience_digest: string;
  requires_send_time_suppression_recheck: boolean;
  provider_workflow_ref_hash: string;
  provider_read_at: string;
}

export type CoreWorkflowDriftCode =
  | 'canonical_name'
  | 'state'
  | 'trigger'
  | 'ordered_steps'
  | 'waits'
  | 'exit_conditions'
  | 'sender'
  | 'subject'
  | 'message_class'
  | 'content_digest'
  | 'audience_digest'
  | 'suppression_recheck';

export interface CoreWorkflowReadbackComparison {
  workflow_key: CoreWorkflowKey;
  ready: boolean;
  drift: readonly CoreWorkflowDriftCode[];
  expected_state: WorkflowControlState;
  provider_workflow_ref_hash: string;
  provider_read_at: string;
  provider_effects: 0;
  approval_id: string;
}

export interface CoreWorkflowReservation {
  operation_id: string;
  workflow_key: CoreWorkflowKey;
  adult_id: string;
  household_id: string;
  suppression_snapshot_id: string;
  content_digest: string;
  audience_digest: string;
  approval_id: string;
  approval_evidence_digest: string;
}

export interface CoreWorkflowRepository {
  reserveDelivery(input: CoreWorkflowReservation): Promise<boolean>;
  completeDelivery(input: {
    operation_id: string;
    state: 'sent' | 'skipped' | 'retry_pending';
    safe_provider_ref_hash: string | null;
    safe_reason: string | null;
  }): Promise<void>;
  persistReadback(input: CoreWorkflowReadbackComparison): Promise<void>;
}

export interface CoreWorkflowSuppressionPort {
  readCurrent(adult_id: string): Promise<CommunicationSuppressionSnapshot>;
}

export interface CoreWorkflowApprovalReadPort {
  readApproved(input: CoreWorkflowApprovalLookup): Promise<CoreWorkflowApprovalSnapshot | null>;
}

export interface CoreWorkflowProviderPort {
  readWorkflow(workflow_key: CoreWorkflowKey): Promise<CoreWorkflowProviderReadback>;
  sendAdultEmail(input: {
    operation_id: string;
    workflow_key: CoreWorkflowKey;
    adult_id: string;
    household_id: string;
    sender_key: CommunicationSenderKey;
    message_class: CoreWorkflowMessageClass;
    content_digest: string;
    audience_digest: string;
    approval_id: string;
  }): Promise<{ safe_provider_ref_hash: string }>;
}

export const REQUIRED_CORE_APPROVAL_GATES = [
  'registry_identity',
  'sender',
  'audience',
  'consent',
  'copy',
  'suppression',
  'publication',
  'broad_send',
] as const satisfies readonly WorkflowApprovalGate[];
