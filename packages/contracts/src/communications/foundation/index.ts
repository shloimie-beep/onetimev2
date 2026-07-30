export const COMMUNICATION_FOUNDATION_CONTRACT_VERSION = '1.0.0' as const;

export const REMINDER_PREFERENCES = ['email', 'whatsapp', 'both', 'none'] as const;
export type ReminderPreference = (typeof REMINDER_PREFERENCES)[number];

export const COMMUNICATION_PURPOSES = [
  'requested_security',
  'essential_billing_access',
  'optional_reminder',
  'marketing',
] as const;
export type CommunicationPurpose = (typeof COMMUNICATION_PURPOSES)[number];

export type CommunicationSubject =
  | { kind: 'adult'; adult_id: string; household_id: string | null }
  | { kind: 'student'; student_id: string; household_id: string };

export type CommunicationSenderKey =
  'rabbi_campaign' | 'rabbi_personal' | 'office' | 'brand' | 'security_resend';

export interface CommunicationSenderProfile {
  key: CommunicationSenderKey;
  display_name: string;
  from_email: string;
  reply_to_email: string;
  transport: 'GHL' | 'Resend';
}

export const COMMUNICATION_SENDER_PROFILES = {
  rabbi_campaign: {
    key: 'rabbi_campaign',
    display_name: 'Rabbi Eli Scheller',
    from_email: 'rabbielischeller@onetimeonetime.com',
    reply_to_email: 'rabbielischeller@onetimeonetime.com',
    transport: 'GHL',
  },
  rabbi_personal: {
    key: 'rabbi_personal',
    display_name: 'Rabbi Eli Scheller',
    from_email: 'rabbielischeller@onetimeonetime.com',
    reply_to_email: 'rabbielischeller@onetimeonetime.com',
    transport: 'GHL',
  },
  office: {
    key: 'office',
    display_name: 'One Time Mishnayos',
    from_email: 'info@onetimeonetime.com',
    reply_to_email: 'info@onetimeonetime.com',
    transport: 'GHL',
  },
  brand: {
    key: 'brand',
    display_name: 'One Time Mishnayos',
    from_email: 'info@onetimeonetime.com',
    reply_to_email: 'info@onetimeonetime.com',
    transport: 'GHL',
  },
  security_resend: {
    key: 'security_resend',
    display_name: 'One Time Account Security',
    from_email: 'info@onetimeonetime.com',
    reply_to_email: 'info@onetimeonetime.com',
    transport: 'Resend',
  },
} as const satisfies Record<CommunicationSenderKey, CommunicationSenderProfile>;

export interface CommunicationSuppressionSnapshot {
  snapshot_id: string;
  adult_id: string;
  captured_at: string;
  email_dnd: boolean;
  unsubscribed: boolean;
  complaint: boolean;
  hard_bounce: boolean;
  invalid_address: boolean;
  marketing_suppressed: boolean;
  optional_reminder_suppressed: boolean;
  evidence_digest: string;
}

export type EmailSkipReason =
  | 'preference_none'
  | 'email_dnd'
  | 'unsubscribed'
  | 'complaint'
  | 'hard_bounce'
  | 'invalid_address'
  | 'marketing_suppressed'
  | 'optional_reminder_suppressed';

export type EmailChannelDecision =
  | {
      disposition: 'send';
      provider: 'GHL' | 'Resend';
      suppression_recheck_required: true;
    }
  | {
      disposition: 'suppressed';
      reason: EmailSkipReason;
      suppression_recheck_required: true;
    };

export type WhatsappChannelDecision =
  | { disposition: 'not_requested'; provider_calls: 0 }
  | { disposition: 'disabled_by_preference'; provider_calls: 0 }
  | {
      disposition: 'channel_skipped_not_configured';
      provider_calls: 0;
      truthful_status: 'WhatsApp is unavailable; email remains active';
    };

export interface CommunicationChannelPlan {
  operation_id: string;
  adult_id: string;
  purpose: CommunicationPurpose;
  reminder_preference: ReminderPreference;
  email: EmailChannelDecision;
  whatsapp: WhatsappChannelDecision;
  essential_email_cannot_be_disabled: boolean;
  whatsapp_provider_calls: 0;
}

export interface PlanCommunicationChannelsInput {
  operation_id: string;
  subject: CommunicationSubject;
  purpose: CommunicationPurpose;
  reminder_preference: ReminderPreference;
  marketing_permission: boolean;
  suppression: CommunicationSuppressionSnapshot;
}

export type WebsiteLeadKind = 'family' | 'school';

export interface WebsiteLeadCaptureInput {
  operation_id: string;
  source: 'public_website';
  subject: CommunicationSubject;
  name: string;
  normalized_email: string;
  lead_kind: WebsiteLeadKind;
  timezone: string;
  phone: string | null;
  transcript_ref_hash: string;
  public_knowledge_answered: boolean;
}

export interface WebsiteLeadCapturePlan {
  operation_id: string;
  adult_id: string;
  source: 'public_website';
  assistant_identity: 'One Time website assistant';
  lead_kind: WebsiteLeadKind;
  next_action: 'offer_family_signup' | 'record_school_inquiry' | 'adult_support_escalation';
  creates_student: false;
  qualifies_via_whatsapp: false;
  grants_access: false;
  promises_school_pricing: false;
  transcript_ref_hash: string;
}

export type WorkflowControlState =
  | 'MISSING'
  | 'DRAFT_SHELL'
  | 'DRAFT_WAITING_EXTERNAL'
  | 'SAVED_REOPENED'
  | 'ACTIVE_CONFIGURED'
  | 'ACTIVE_TESTED'
  | 'DRIFTED'
  | 'BLOCKED';

export interface WorkflowDeliveryReadback {
  status: 'unavailable' | 'ready' | 'paused' | 'active' | 'drifted' | 'blocked';
  provider_read_at: string | null;
  delivered_count: number;
  skipped_count: number;
  safe_evidence_ref: string;
}

export interface CommunicationsWorkflowReadback {
  workflow_key: string;
  canonical_name: string;
  provider_workflow_ref_hash: string;
  audience_count: number;
  eligible_count: number;
  excluded_count: number;
  suppression_count: number;
  sender: CommunicationSenderProfile;
  rendered_subject: string;
  rendered_body_digest: string;
  cadence: readonly string[];
  readiness: WorkflowControlState;
  delivery: WorkflowDeliveryReadback;
  safe_ghl_url: string;
  registry_digest: string;
}

export interface CommunicationsReview {
  visible_to: 'admin';
  readback: CommunicationsWorkflowReadback;
  controls: readonly ['start', 'pause'];
  campaign_authoring_location: 'GHL';
  exposes_campaign_editor: false;
  exposes_test_send: false;
  exposes_seed_send: false;
  exposes_provider_canary: false;
}

export type GovernedWorkflowAction = 'start' | 'pause';

export interface GovernedWorkflowRequest {
  request_id: string;
  workflow_key: string;
  requested_by_admin_id: string;
  action: GovernedWorkflowAction;
  requested_at: string;
  provider_readback_ref: string;
  audited: true;
  direct_provider_mutation: false;
}

export type WorkflowApprovalGate =
  | 'registry_identity'
  | 'sender'
  | 'audience'
  | 'consent'
  | 'copy'
  | 'suppression'
  | 'publication'
  | 'broad_send';

export interface CommunicationWorkflowDefinition {
  workflow_key: string;
  canonical_name: string;
  purpose: string;
  subject: 'adult_only';
  sender_key: CommunicationSenderKey;
  message_purpose: Exclude<CommunicationPurpose, 'requested_security'>;
  trigger: string;
  ordered_steps: readonly string[];
  exit_conditions: readonly string[];
  idempotency_scope: string;
  approval_gates: readonly WorkflowApprovalGate[];
  requires_send_time_suppression_recheck: true;
  email_required: true;
  whatsapp_state: 'dormant';
  student_contact_prohibited: true;
}

export interface CommunicationWorkflowFragment {
  contract_version: typeof COMMUNICATION_FOUNDATION_CONTRACT_VERSION;
  owner_task: 'P29' | 'P30';
  fragment_id: string;
  workflows: readonly CommunicationWorkflowDefinition[];
}

export const CLASS_REMINDER_ROUTING_REQUEST_ID = 'P17-REMINDER-ROUTING-001' as const;
export const CLASS_REMINDER_APP_PATH = '/app/parent/classes' as const;
export const CLASS_REMINDER_LEAD_MS = 30 * 60 * 1000;

export type ClassReminderRegistrantState =
  'pending' | 'provisioning' | 'active' | 'failed' | 'acceptance_unknown' | 'revoked';

export type ProtectedPortalState = 'pending' | 'ready' | 'unavailable';

export interface ClassReminderStudentPreparation {
  student_label: string;
  registrant_state: ClassReminderRegistrantState;
  protected_portal_state: ProtectedPortalState;
}

export interface ClassReminderHouseholdCandidate {
  operation_id: string;
  household_id: string;
  account_owner_adult_id: string;
  student_labels: readonly string[];
  student_preparations: readonly ClassReminderStudentPreparation[];
  app_path: string;
  scheduled_for: string;
  reminder_preference: ReminderPreference;
  suppression: CommunicationSuppressionSnapshot;
  expected_version: number;
}

export interface PlanClassReminderRoutingInput {
  occurrence_id: string;
  occurrence_starts_at: string;
  households: readonly ClassReminderHouseholdCandidate[];
}

export interface SafeClassReminderMessage {
  kind: 'account_owner_class_reminder';
  affected_student_labels: readonly string[];
  app_path: typeof CLASS_REMINDER_APP_PATH;
  contains_zoom_url: false;
  contains_launch_grant: false;
  contains_technical_alias: false;
  contains_student_authentication: false;
}

export interface ClassReminderRoutingIntent {
  request_id: typeof CLASS_REMINDER_ROUTING_REQUEST_ID;
  operation_id: string;
  occurrence_id: string;
  household_id: string;
  account_owner_adult_id: string;
  scheduled_for: string;
  sender_key: 'office';
  plan_input: PlanCommunicationChannelsInput;
  channel_plan: CommunicationChannelPlan;
  message: SafeClassReminderMessage;
  expected_version: number;
  prepared_in_app_access: 'preserve_independent_of_email';
}

export type ClassReminderRoutingPlan =
  | {
      disposition: 'partial_preparation';
      safe_reason: 'named_student_not_ready';
      intents: readonly [];
      provider_calls: 0;
    }
  | {
      disposition: 'ready';
      intents: readonly ClassReminderRoutingIntent[];
      provider_calls: 0;
    };

export interface CommunicationDecisionRecord {
  operation_id: string;
  adult_id: string;
  purpose: CommunicationPurpose;
  plan: CommunicationChannelPlan;
  suppression_snapshot_id: string;
  status: 'planned' | 'email_sent' | 'skipped' | 'retry_pending';
}

export interface CommunicationFoundationRepository {
  saveReminderPreference(input: {
    adult_id: string;
    preference: ReminderPreference;
    expected_version: number;
  }): Promise<boolean>;
  persistDecision(input: {
    record: CommunicationDecisionRecord;
    expected_version: number;
  }): Promise<boolean>;
  reserveEmailDelivery(input: {
    operation_id: string;
    suppression_snapshot_id: string;
  }): Promise<boolean>;
  completeDecision(input: {
    operation_id: string;
    expected_version: number;
    status: CommunicationDecisionRecord['status'];
    safe_provider_ref_hash: string | null;
    safe_reason: string | null;
  }): Promise<boolean>;
  persistWorkflowReadback(input: {
    readback: CommunicationsWorkflowReadback;
    expected_version: number;
  }): Promise<boolean>;
  persistGovernedRequest(request: GovernedWorkflowRequest): Promise<boolean>;
  persistWebsiteLeadPlan(plan: WebsiteLeadCapturePlan): Promise<boolean>;
}
