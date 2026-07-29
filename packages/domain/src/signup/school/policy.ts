import { createHash } from 'node:crypto';
import {
  APPROVED_SCHOOL_CONFIGURATION_FIELDS,
  APPROVED_SCHOOL_EXPERIENCE,
  SCHOOL_INQUIRY_COPY,
  SCHOOL_INQUIRY_FIELDS,
  SCHOOL_INQUIRY_OPERATION,
  type ApprovedSchoolConfiguration,
  type ApprovedSchoolConfigurationCommand,
  type ApprovedSchoolRecord,
  type SchoolInquiryAcknowledgmentIntent,
  type SchoolInquiryCommand,
  type SchoolInquiryReceipt,
  type SchoolInquiryRequestBinding,
  type SchoolInquiryResult,
  type SchoolManualSalesLead,
  type SchoolSignupScope,
} from '../../../../contracts/src/signup/school/index.ts';
import { VERIFICATION_RUNTIME_TIER } from '../../../../contracts/src/state/index.ts';
import { normalizeAdultEmail } from '../../accounts/v21-household-identity.ts';

const HASH = /^[a-f0-9]{64}$/u;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,179}$/u;
const SAFE_TERMS_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9 _./:-]{0,199}$/u;

export class SchoolSignupError extends Error {
  constructor(
    readonly code:
      | 'invalid_school_inquiry'
      | 'school_inquiry_conflict'
      | 'school_configuration_denied'
      | 'school_configuration_mismatch',
  ) {
    super(code);
    this.name = 'SchoolSignupError';
  }
}

export interface SchoolConfigurationActor extends SchoolSignupScope {
  human_account_id: string;
  role: 'admin' | 'parent' | 'student';
}

export interface CanonicalSchoolInquiry {
  school_name: string;
  contact_first_name: string;
  contact_last_name: string;
  normalized_email: string;
  phone: string | null;
  note: string | null;
}

export interface PlanSchoolInquiryInput {
  scope: SchoolSignupScope;
  command: SchoolInquiryCommand;
  request_binding: SchoolInquiryRequestBinding;
  canonical_request: CanonicalSchoolInquiry;
  proposed_lead_id: string;
  existing_receipt: SchoolInquiryReceipt | null;
}

export interface SchoolInquiryPlan {
  result: SchoolInquiryResult;
  receipt: SchoolInquiryReceipt;
  local_write_required: boolean;
  provider_effects_completed_inline: 0;
}

export function canonicalizeSchoolInquiry(
  scope: SchoolSignupScope,
  command: SchoolInquiryCommand,
): {
  request_binding: SchoolInquiryRequestBinding;
  request: CanonicalSchoolInquiry;
} {
  assertScope(scope);
  const actualFields = Object.keys(command).sort();
  const expectedFields = [...SCHOOL_INQUIRY_FIELDS].sort();
  if (
    actualFields.length !== expectedFields.length ||
    actualFields.some((field, index) => field !== expectedFields[index]) ||
    !command.school_name.trim() ||
    !command.contact_first_name.trim() ||
    !command.contact_last_name.trim() ||
    command.school_name.trim().length > 180 ||
    command.contact_first_name.trim().length > 100 ||
    command.contact_last_name.trim().length > 100 ||
    (command.phone !== null && (!command.phone.trim() || command.phone.trim().length > 40)) ||
    (command.note !== null && command.note.trim().length > 1000)
  ) {
    throw new SchoolSignupError('invalid_school_inquiry');
  }
  let normalizedEmail: string;
  try {
    normalizedEmail = normalizeAdultEmail(command.email);
  } catch {
    throw new SchoolSignupError('invalid_school_inquiry');
  }
  const request: CanonicalSchoolInquiry = {
    school_name: command.school_name.trim(),
    contact_first_name: command.contact_first_name.trim(),
    contact_last_name: command.contact_last_name.trim(),
    normalized_email: normalizedEmail,
    phone: normalizeOptional(command.phone),
    note: normalizeOptional(command.note),
  };
  return {
    request_binding: {
      scope: { ...scope },
      operation: SCHOOL_INQUIRY_OPERATION,
      normalized_email: normalizedEmail,
      canonical_request_digest: digest(JSON.stringify(request)),
    },
    request,
  };
}

export function planSchoolInquiry(input: PlanSchoolInquiryInput): SchoolInquiryPlan {
  assertScope(input.scope);
  const canonical = canonicalizeSchoolInquiry(input.scope, input.command);
  if (
    canonical.request_binding.canonical_request_digest !==
      input.request_binding.canonical_request_digest ||
    JSON.stringify(canonical.request) !== JSON.stringify(input.canonical_request)
  ) {
    throw new SchoolSignupError('school_inquiry_conflict');
  }
  assertInquiryBinding(input.scope, input.request_binding, input.canonical_request);
  if (input.existing_receipt) {
    if (!sameBinding(input.existing_receipt.request_binding, input.request_binding)) {
      throw new SchoolSignupError('school_inquiry_conflict');
    }
    return {
      result: inquiryResult('deduplicated', input.existing_receipt.acknowledgment.intent_id),
      receipt: input.existing_receipt,
      local_write_required: false,
      provider_effects_completed_inline: 0,
    };
  }
  if (!SAFE_ID.test(input.proposed_lead_id)) {
    throw new SchoolSignupError('invalid_school_inquiry');
  }
  const lead: SchoolManualSalesLead = {
    lead_id: input.proposed_lead_id,
    adult_contact_kind: 'adult',
    school_name: input.canonical_request.school_name,
    contact_first_name: input.canonical_request.contact_first_name,
    contact_last_name: input.canonical_request.contact_last_name,
    normalized_email: input.canonical_request.normalized_email,
    phone: input.canonical_request.phone,
    note: input.canonical_request.note,
    sales_state: 'pending_manual_follow_up',
    product_account_created: false,
    parent_login_created: false,
    passwordless_claim_created: false,
    household_created: false,
    student_accounts_created: 0,
    subscription_created: false,
    product_access_granted: false,
  };
  const acknowledgment: SchoolInquiryAcknowledgmentIntent = {
    intent_id: `${input.proposed_lead_id}:acknowledgment`,
    kind: 'school_inquiry_acknowledgment',
    request_binding: input.request_binding,
    normalized_email_hash: digest(input.canonical_request.normalized_email),
    copy: SCHOOL_INQUIRY_COPY.success,
    delivery_state: 'pending',
    local_commit_required: true,
  };
  const receipt: SchoolInquiryReceipt = {
    request_binding: input.request_binding,
    lead,
    acknowledgment,
  };
  return {
    result: inquiryResult('created', acknowledgment.intent_id),
    receipt,
    local_write_required: true,
    provider_effects_completed_inline: 0,
  };
}

export function planApprovedSchoolConfiguration(input: {
  actor: SchoolConfigurationActor;
  command: ApprovedSchoolConfigurationCommand;
  approved_school: ApprovedSchoolRecord | null;
}): ApprovedSchoolConfiguration {
  assertScope(input.actor);
  const actualFields = Object.keys(input.command).sort();
  const expectedFields = [...APPROVED_SCHOOL_CONFIGURATION_FIELDS].sort();
  if (
    input.actor.role !== 'admin' ||
    !SAFE_ID.test(input.actor.human_account_id) ||
    input.approved_school === null
  ) {
    throw new SchoolSignupError('school_configuration_denied');
  }
  const current = input.approved_school;
  if (
    !sameScope(current.scope, input.actor) ||
    current.approval_state !== 'approved' ||
    current.approved_school_id !== input.command.approved_school_id ||
    current.adult_account_manager_id !== input.command.adult_account_manager_id ||
    current.household_id !== input.command.household_id ||
    current.configuration_version !== input.command.expected_configuration_version
  ) {
    throw new SchoolSignupError('school_configuration_mismatch');
  }
  if (
    actualFields.length !== expectedFields.length ||
    actualFields.some((field, index) => field !== expectedFields[index]) ||
    !SAFE_ID.test(input.command.approved_school_id) ||
    !SAFE_ID.test(input.command.adult_account_manager_id) ||
    !SAFE_ID.test(input.command.household_id) ||
    !Number.isSafeInteger(input.command.seat_allowance) ||
    input.command.seat_allowance < 1 ||
    input.command.seat_allowance > 100_000 ||
    !Number.isSafeInteger(input.command.price_minor_units) ||
    input.command.price_minor_units < 0 ||
    input.command.currency !== 'USD' ||
    Number.isNaN(Date.parse(input.command.billing_starts_at)) ||
    !SAFE_TERMS_REFERENCE.test(input.command.terms_reference)
  ) {
    throw new SchoolSignupError('school_configuration_mismatch');
  }
  return {
    scope: { ...current.scope },
    approved_school_id: current.approved_school_id,
    adult_account_manager_id: current.adult_account_manager_id,
    household_id: current.household_id,
    seat_allowance: input.command.seat_allowance,
    price_minor_units: input.command.price_minor_units,
    currency: input.command.currency,
    billing_starts_at: new Date(input.command.billing_starts_at).toISOString(),
    terms_reference: input.command.terms_reference,
    configuration_version: current.configuration_version + 1,
    account_model: APPROVED_SCHOOL_EXPERIENCE.account_model,
    adult_account_manager_role: APPROVED_SCHOOL_EXPERIENCE.adult_account_manager_role,
    student_account_role: APPROVED_SCHOOL_EXPERIENCE.student_account_role,
    school_role_created: false,
    school_portal_created: false,
    bulk_roster_created: false,
    automated_nurture_created: false,
  };
}

function inquiryResult(
  disposition: SchoolInquiryResult['disposition'],
  acknowledgmentIntentId: string,
): SchoolInquiryResult {
  return {
    disposition,
    sales_state: 'pending_manual_follow_up',
    safe_message: SCHOOL_INQUIRY_COPY.success,
    acknowledgment_intent_id: acknowledgmentIntentId,
    provider_effects_completed_inline: 0,
    product_accounts_created: 0,
    households_created: 0,
    student_accounts_created: 0,
    subscriptions_created: 0,
    access_grants_created: 0,
    nurture_workflow_intent_ids: [],
  };
}

function assertInquiryBinding(
  scope: SchoolSignupScope,
  binding: SchoolInquiryRequestBinding,
  request: CanonicalSchoolInquiry,
) {
  if (
    binding.operation !== SCHOOL_INQUIRY_OPERATION ||
    binding.normalized_email !== request.normalized_email ||
    !HASH.test(binding.canonical_request_digest) ||
    binding.canonical_request_digest !== digest(JSON.stringify(request)) ||
    !sameScope(binding.scope, scope)
  ) {
    throw new SchoolSignupError('school_inquiry_conflict');
  }
}

function sameBinding(left: SchoolInquiryRequestBinding, right: SchoolInquiryRequestBinding) {
  return (
    left.operation === right.operation &&
    left.normalized_email === right.normalized_email &&
    left.canonical_request_digest === right.canonical_request_digest &&
    sameScope(left.scope, right.scope)
  );
}

function assertScope(scope: SchoolSignupScope) {
  if (
    scope.product !== 'one_time_mishnayos' ||
    VERIFICATION_RUNTIME_TIER[scope.verification_environment_id] !== scope.runtime_tier
  ) {
    throw new SchoolSignupError('school_configuration_denied');
  }
}

function sameScope(left: SchoolSignupScope, right: SchoolSignupScope) {
  return (
    left.product === right.product &&
    left.runtime_tier === right.runtime_tier &&
    left.verification_environment_id === right.verification_environment_id
  );
}

function normalizeOptional(value: string | null) {
  if (value === null) return null;
  const normalized = value.trim();
  return normalized || null;
}

function digest(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
