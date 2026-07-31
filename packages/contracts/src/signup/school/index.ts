import type { RuntimeTier, VerificationEnvironmentId } from '../../state/index.ts';

export const SCHOOL_SIGNUP_CONTRACT_VERSION = '2.1.0' as const;
export const SCHOOL_INQUIRY_OPERATION = 'public_school_inquiry' as const;
export const APPROVED_SCHOOL_CONFIGURATION_OPERATION =
  'admin_approved_school_configuration' as const;

export const SCHOOL_INQUIRY_REQUIRED_FIELDS = [
  'school_name',
  'contact_first_name',
  'contact_last_name',
  'email',
] as const;
export const SCHOOL_INQUIRY_OPTIONAL_FIELDS = ['phone', 'note'] as const;
export const SCHOOL_INQUIRY_FIELDS = [
  ...SCHOOL_INQUIRY_REQUIRED_FIELDS,
  ...SCHOOL_INQUIRY_OPTIONAL_FIELDS,
] as const;
export const SCHOOL_INQUIRY_COPY = {
  cta: 'Send school inquiry',
  success: 'Thanks—we received your school inquiry. We’ll be in touch shortly.',
} as const;
export const SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE = {
  workflow_id: 'OT-01',
  template_id: 'OT-01.school_acknowledgment',
  template_version: '2.1.0',
  sender_key: 'office',
  subject: 'We received your One Time school inquiry',
  body: [
    'Hi {{contact.first_name}},',
    '',
    'Thank you for your interest in One Time Mishnayos for your school.',
    '',
    'We received your information. Shloimie will contact you to discuss pricing, Student seats, and setup.',
    '',
    'No account or paid subscription has been created yet.',
    '',
    'One Time Mishnayos',
    'info@onetimeonetime.com',
  ].join('\n'),
} as const;
export const SCHOOL_INQUIRY_ACKNOWLEDGMENT_CONTENT_DIGEST =
  'ee97274c3fbe2bae470da87aa15b7049fddc2677dc794dc5e94a42e78b7de4fb' as const;
export const SCHOOL_INQUIRY_FORBIDDEN_FIELDS = [
  'password',
  'password_confirmation',
  'timezone',
  'student',
  'students',
  'household',
  'subscription',
  'access',
  'role',
  'portal',
  'bulk_roster',
  'marketing_consent',
  'newsletter_consent',
] as const;

export interface SchoolSignupScope {
  product: 'one_time_mishnayos';
  runtime_tier: RuntimeTier;
  verification_environment_id: VerificationEnvironmentId;
}

export interface SchoolInquiryCommand {
  school_name: string;
  contact_first_name: string;
  contact_last_name: string;
  email: string;
  phone?: string | null;
  note?: string | null;
}

export interface SchoolInquiryRequestBinding {
  scope: SchoolSignupScope;
  operation: typeof SCHOOL_INQUIRY_OPERATION;
  normalized_email: string;
  canonical_request_digest: string;
}

export interface SchoolManualSalesLead {
  lead_id: string;
  adult_contact_kind: 'adult';
  school_name: string;
  contact_first_name: string;
  contact_last_name: string;
  normalized_email: string;
  phone: string | null;
  note: string | null;
  sales_state: 'pending_manual_follow_up';
  product_account_created: false;
  parent_login_created: false;
  passwordless_claim_created: false;
  household_created: false;
  student_accounts_created: 0;
  subscription_created: false;
  product_access_granted: false;
}

export interface SchoolInquiryAcknowledgmentIntent {
  intent_id: string;
  kind: 'school_inquiry_acknowledgment';
  request_binding: SchoolInquiryRequestBinding;
  normalized_email_hash: string;
  notification: {
    workflow_id: typeof SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.workflow_id;
    template_id: typeof SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.template_id;
    template_version: typeof SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.template_version;
    sender_key: typeof SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.sender_key;
    subject: typeof SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.subject;
    body: typeof SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE.body;
    content_digest: typeof SCHOOL_INQUIRY_ACKNOWLEDGMENT_CONTENT_DIGEST;
  };
  delivery_state: 'pending';
  local_commit_required: true;
}

export interface SchoolInquiryReceipt {
  request_binding: SchoolInquiryRequestBinding;
  lead: SchoolManualSalesLead;
  acknowledgment: SchoolInquiryAcknowledgmentIntent;
}

export interface SchoolInquiryResult {
  disposition: 'created' | 'deduplicated';
  sales_state: 'pending_manual_follow_up';
  safe_message: typeof SCHOOL_INQUIRY_COPY.success;
  acknowledgment_intent_id: string;
  provider_effects_completed_inline: 0;
  product_accounts_created: 0;
  households_created: 0;
  student_accounts_created: 0;
  subscriptions_created: 0;
  access_grants_created: 0;
  nurture_workflow_intent_ids: readonly [];
}

export type SchoolProductRole = 'admin' | 'parent' | 'student';

export const APPROVED_SCHOOL_EXPERIENCE = {
  account_model: 'parent_student',
  adult_account_manager_role: 'parent',
  student_account_role: 'student',
  school_role_exists: false,
  school_portal_exists: false,
  bulk_roster_exists: false,
  automated_school_nurture_exists: false,
} as const;

export const APPROVED_SCHOOL_CONFIGURATION_FIELDS = [
  'approved_school_id',
  'adult_account_manager_id',
  'household_id',
  'seat_allowance',
  'price_minor_units',
  'currency',
  'billing_starts_at',
  'terms_reference',
  'immutable_contract_reference',
  'authorization_reason',
  'idempotency_key',
  'expected_configuration_version',
  'audit_ref',
] as const;

export interface ApprovedSchoolConfigurationCommand {
  approved_school_id: string;
  adult_account_manager_id: string;
  household_id: string;
  seat_allowance: number;
  price_minor_units: number;
  currency: 'USD';
  billing_starts_at: string;
  terms_reference: string;
  immutable_contract_reference: string;
  authorization_reason: string;
  idempotency_key: string;
  expected_configuration_version: number;
  audit_ref: string;
}

export interface ApprovedSchoolConfigurationAuthorization {
  scope: SchoolSignupScope;
  authorized_by_human_account_id: string;
  authorized_at: string;
}

export interface ApprovedSchoolConfigurationRequestBinding {
  scope: SchoolSignupScope;
  operation: typeof APPROVED_SCHOOL_CONFIGURATION_OPERATION;
  idempotency_key: string;
  canonical_request_hash: string;
}

export interface ApprovedSchoolRecord {
  request_binding: ApprovedSchoolConfigurationRequestBinding;
  approved_school_id: string;
  adult_account_manager_id: string;
  household_id: string;
  seat_allowance: number;
  price_minor_units: number;
  currency: 'USD';
  billing_starts_at: string;
  terms_reference: string;
  immutable_contract_reference: string;
  authorization_reason: string;
  authorized_by_human_account_id: string;
  authorized_at: string;
  expected_prior_version: number;
  configuration_version: number;
  audit_ref: string;
  created_at: string;
  updated_at: string;
}

export interface ApprovedSchoolConfiguration extends ApprovedSchoolRecord {
  account_model: typeof APPROVED_SCHOOL_EXPERIENCE.account_model;
  adult_account_manager_role: typeof APPROVED_SCHOOL_EXPERIENCE.adult_account_manager_role;
  student_account_role: typeof APPROVED_SCHOOL_EXPERIENCE.student_account_role;
  school_role_created: false;
  school_portal_created: false;
  bulk_roster_created: false;
  automated_nurture_created: false;
}

export interface ApprovedSchoolConfigurationResult {
  disposition: 'created' | 'updated' | 'replayed';
  configuration: ApprovedSchoolConfiguration;
  provider_effects_completed_inline: 0;
  product_accounts_created: 0;
  households_created: 0;
  student_accounts_created: 0;
  access_grants_created: 0;
  subscriptions_created: 0;
  nurture_workflow_intent_ids: readonly [];
}

export const SCHOOL_SECURITY_INVARIANTS = {
  public_inquiry_creates_product_access: false,
  public_inquiry_creates_subscription: false,
  public_inquiry_enrolls_nurture: false,
  public_inquiry_creates_parent_or_student_credentials: false,
  normalized_email_is_deduplication_key: true,
  approved_school_requires_admin_and_exact_approval: true,
  approved_school_reuses_parent_student_experience: true,
  school_authorization_role_exists: false,
  school_specific_portal_exists: false,
  bulk_roster_exists: false,
  provider_effects_inline: 0,
} as const;
