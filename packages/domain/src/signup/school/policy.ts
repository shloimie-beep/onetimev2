import { createHash } from 'node:crypto';
import {
  APPROVED_SCHOOL_CONFIGURATION_OPERATION,
  APPROVED_SCHOOL_CONFIGURATION_FIELDS,
  APPROVED_SCHOOL_EXPERIENCE,
  SCHOOL_INQUIRY_ACKNOWLEDGMENT_CONTENT_DIGEST,
  SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE,
  SCHOOL_INQUIRY_COPY,
  SCHOOL_INQUIRY_FIELDS,
  SCHOOL_INQUIRY_OPERATION,
  SCHOOL_INQUIRY_REQUIRED_FIELDS,
  type ApprovedSchoolConfiguration,
  type ApprovedSchoolConfigurationAuthorization,
  type ApprovedSchoolConfigurationCommand,
  type ApprovedSchoolConfigurationRequestBinding,
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
const SAFE_EVIDENCE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9 _./:@-]{0,239}$/u;

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

export interface CanonicalApprovedSchoolConfiguration {
  authorization: ApprovedSchoolConfigurationAuthorization;
  request_binding: ApprovedSchoolConfigurationRequestBinding;
  command: ApprovedSchoolConfigurationCommand;
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
  const allowedFields = new Set<string>(SCHOOL_INQUIRY_FIELDS);
  const requiredFieldsPresent = SCHOOL_INQUIRY_REQUIRED_FIELDS.every((field) =>
    Object.prototype.hasOwnProperty.call(command, field),
  );
  if (
    !requiredFieldsPresent ||
    actualFields.some((field) => !allowedFields.has(field)) ||
    typeof command.school_name !== 'string' ||
    typeof command.contact_first_name !== 'string' ||
    typeof command.contact_last_name !== 'string' ||
    typeof command.email !== 'string' ||
    !command.school_name.trim() ||
    !command.contact_first_name.trim() ||
    !command.contact_last_name.trim() ||
    command.school_name.trim().length > 180 ||
    command.contact_first_name.trim().length > 100 ||
    command.contact_last_name.trim().length > 100 ||
    (command.phone !== undefined &&
      command.phone !== null &&
      (typeof command.phone !== 'string' ||
        !command.phone.trim() ||
        command.phone.trim().length > 40)) ||
    (command.note !== undefined &&
      command.note !== null &&
      (typeof command.note !== 'string' || command.note.trim().length > 1000))
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
    assertExistingReceipt(input.existing_receipt, input.request_binding, input.canonical_request);
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
    notification: {
      ...SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE,
      content_digest: SCHOOL_INQUIRY_ACKNOWLEDGMENT_CONTENT_DIGEST,
    },
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

export function canonicalizeApprovedSchoolConfiguration(input: {
  actor: SchoolConfigurationActor;
  authorized_at: string;
  command: ApprovedSchoolConfigurationCommand;
}): CanonicalApprovedSchoolConfiguration {
  assertScope(input.actor);
  const actualFields = Object.keys(input.command).sort();
  const expectedFields = [...APPROVED_SCHOOL_CONFIGURATION_FIELDS].sort();
  if (
    input.actor.role !== 'admin' ||
    !SAFE_ID.test(input.actor.human_account_id) ||
    input.actor.verification_environment_id === 'production_read_only'
  ) {
    throw new SchoolSignupError('school_configuration_denied');
  }
  const authorizedAt = canonicalTimestamp(input.authorized_at);
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
    canonicalTimestamp(input.command.billing_starts_at) !== input.command.billing_starts_at ||
    !SAFE_TERMS_REFERENCE.test(input.command.terms_reference) ||
    !SAFE_TERMS_REFERENCE.test(input.command.immutable_contract_reference) ||
    typeof input.command.authorization_reason !== 'string' ||
    !input.command.authorization_reason.trim() ||
    input.command.authorization_reason.trim().length > 500 ||
    !SAFE_ID.test(input.command.idempotency_key) ||
    !Number.isSafeInteger(input.command.expected_configuration_version) ||
    input.command.expected_configuration_version < 0 ||
    !SAFE_EVIDENCE_REFERENCE.test(input.command.audit_ref)
  ) {
    throw new SchoolSignupError('school_configuration_mismatch');
  }
  const scope: SchoolSignupScope = {
    product: input.actor.product,
    runtime_tier: input.actor.runtime_tier,
    verification_environment_id: input.actor.verification_environment_id,
  };
  const command: ApprovedSchoolConfigurationCommand = {
    ...input.command,
    authorization_reason: input.command.authorization_reason.trim(),
  };
  const canonicalRequest = {
    operation: APPROVED_SCHOOL_CONFIGURATION_OPERATION,
    scope,
    authorized_by_human_account_id: input.actor.human_account_id,
    approved_school_id: command.approved_school_id,
    adult_account_manager_id: command.adult_account_manager_id,
    household_id: command.household_id,
    seat_allowance: command.seat_allowance,
    price_minor_units: command.price_minor_units,
    currency: command.currency,
    billing_starts_at: command.billing_starts_at,
    terms_reference: command.terms_reference,
    immutable_contract_reference: command.immutable_contract_reference,
    authorization_reason: command.authorization_reason,
    idempotency_key: command.idempotency_key,
    expected_configuration_version: command.expected_configuration_version,
    audit_ref: command.audit_ref,
  };
  return {
    authorization: {
      scope,
      authorized_by_human_account_id: input.actor.human_account_id,
      authorized_at: authorizedAt,
    },
    request_binding: {
      scope,
      operation: APPROVED_SCHOOL_CONFIGURATION_OPERATION,
      idempotency_key: command.idempotency_key,
      canonical_request_hash: digest(canonicalJson(canonicalRequest)),
    },
    command,
  };
}

export function planApprovedSchoolConfiguration(input: {
  canonical: CanonicalApprovedSchoolConfiguration;
  approved_school: ApprovedSchoolRecord | null;
}): ApprovedSchoolConfiguration {
  const { canonical, approved_school: current } = input;
  const expectedPriorVersion = canonical.command.expected_configuration_version;
  if (current === null) {
    if (expectedPriorVersion !== 0) {
      throw new SchoolSignupError('school_configuration_mismatch');
    }
  } else {
    assertApprovedSchoolRecord(current);
    if (
      !sameScope(current.request_binding.scope, canonical.authorization.scope) ||
      current.approved_school_id !== canonical.command.approved_school_id ||
      current.household_id !== canonical.command.household_id ||
      current.immutable_contract_reference !== canonical.command.immutable_contract_reference ||
      current.configuration_version !== expectedPriorVersion
    ) {
      throw new SchoolSignupError('school_configuration_mismatch');
    }
  }
  const configurationVersion = expectedPriorVersion + 1;
  const createdAt = current?.created_at ?? canonical.authorization.authorized_at;
  return {
    request_binding: canonical.request_binding,
    approved_school_id: canonical.command.approved_school_id,
    adult_account_manager_id: canonical.command.adult_account_manager_id,
    household_id: canonical.command.household_id,
    seat_allowance: canonical.command.seat_allowance,
    price_minor_units: canonical.command.price_minor_units,
    currency: canonical.command.currency,
    billing_starts_at: canonical.command.billing_starts_at,
    terms_reference: canonical.command.terms_reference,
    immutable_contract_reference: canonical.command.immutable_contract_reference,
    authorization_reason: canonical.command.authorization_reason,
    authorized_by_human_account_id: canonical.authorization.authorized_by_human_account_id,
    authorized_at: canonical.authorization.authorized_at,
    expected_prior_version: expectedPriorVersion,
    configuration_version: configurationVersion,
    audit_ref: canonical.command.audit_ref,
    created_at: createdAt,
    updated_at: canonical.authorization.authorized_at,
    account_model: APPROVED_SCHOOL_EXPERIENCE.account_model,
    adult_account_manager_role: APPROVED_SCHOOL_EXPERIENCE.adult_account_manager_role,
    student_account_role: APPROVED_SCHOOL_EXPERIENCE.student_account_role,
    school_role_created: false,
    school_portal_created: false,
    bulk_roster_created: false,
    automated_nurture_created: false,
  };
}

export function validateApprovedSchoolConfigurationReplay(
  canonical: CanonicalApprovedSchoolConfiguration,
  existing: ApprovedSchoolRecord,
): ApprovedSchoolConfiguration {
  assertApprovedSchoolRecord(existing);
  if (
    !sameScope(existing.request_binding.scope, canonical.request_binding.scope) ||
    existing.request_binding.operation !== canonical.request_binding.operation ||
    existing.request_binding.idempotency_key !== canonical.request_binding.idempotency_key ||
    existing.request_binding.canonical_request_hash !==
      canonical.request_binding.canonical_request_hash
  ) {
    throw new SchoolSignupError('school_configuration_mismatch');
  }
  return withApprovedSchoolExperience(existing);
}

export function validateApprovedSchoolConfigurationReadback(
  expected: ApprovedSchoolConfiguration,
  actual: ApprovedSchoolRecord,
): ApprovedSchoolConfiguration {
  assertApprovedSchoolRecord(actual);
  const expectedRecord = stripApprovedSchoolExperience(expected);
  if (canonicalJson(expectedRecord) !== canonicalJson(actual)) {
    throw new SchoolSignupError('school_configuration_mismatch');
  }
  return withApprovedSchoolExperience(actual);
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

function normalizeOptional(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  const normalized = value.trim();
  return normalized || null;
}

function assertApprovedSchoolRecord(record: ApprovedSchoolRecord): void {
  if (
    record.request_binding.operation !== APPROVED_SCHOOL_CONFIGURATION_OPERATION ||
    !HASH.test(record.request_binding.canonical_request_hash) ||
    !SAFE_ID.test(record.request_binding.idempotency_key) ||
    !SAFE_ID.test(record.approved_school_id) ||
    !SAFE_ID.test(record.adult_account_manager_id) ||
    !SAFE_ID.test(record.household_id) ||
    !Number.isSafeInteger(record.seat_allowance) ||
    record.seat_allowance < 1 ||
    !Number.isSafeInteger(record.price_minor_units) ||
    record.price_minor_units < 0 ||
    record.currency !== 'USD' ||
    canonicalTimestamp(record.billing_starts_at) !== record.billing_starts_at ||
    !SAFE_TERMS_REFERENCE.test(record.terms_reference) ||
    !SAFE_TERMS_REFERENCE.test(record.immutable_contract_reference) ||
    !record.authorization_reason.trim() ||
    !SAFE_ID.test(record.authorized_by_human_account_id) ||
    canonicalTimestamp(record.authorized_at) !== record.authorized_at ||
    !Number.isSafeInteger(record.expected_prior_version) ||
    record.expected_prior_version < 0 ||
    !Number.isSafeInteger(record.configuration_version) ||
    record.configuration_version !== record.expected_prior_version + 1 ||
    !SAFE_EVIDENCE_REFERENCE.test(record.audit_ref) ||
    canonicalTimestamp(record.created_at) !== record.created_at ||
    canonicalTimestamp(record.updated_at) !== record.updated_at ||
    Date.parse(record.updated_at) < Date.parse(record.created_at) ||
    Date.parse(record.updated_at) < Date.parse(record.authorized_at)
  ) {
    throw new SchoolSignupError('school_configuration_mismatch');
  }
  assertScope(record.request_binding.scope);
}

function withApprovedSchoolExperience(record: ApprovedSchoolRecord): ApprovedSchoolConfiguration {
  return {
    ...record,
    account_model: APPROVED_SCHOOL_EXPERIENCE.account_model,
    adult_account_manager_role: APPROVED_SCHOOL_EXPERIENCE.adult_account_manager_role,
    student_account_role: APPROVED_SCHOOL_EXPERIENCE.student_account_role,
    school_role_created: false,
    school_portal_created: false,
    bulk_roster_created: false,
    automated_nurture_created: false,
  };
}

function stripApprovedSchoolExperience(
  configuration: ApprovedSchoolConfiguration,
): ApprovedSchoolRecord {
  return {
    request_binding: configuration.request_binding,
    approved_school_id: configuration.approved_school_id,
    adult_account_manager_id: configuration.adult_account_manager_id,
    household_id: configuration.household_id,
    seat_allowance: configuration.seat_allowance,
    price_minor_units: configuration.price_minor_units,
    currency: configuration.currency,
    billing_starts_at: configuration.billing_starts_at,
    terms_reference: configuration.terms_reference,
    immutable_contract_reference: configuration.immutable_contract_reference,
    authorization_reason: configuration.authorization_reason,
    authorized_by_human_account_id: configuration.authorized_by_human_account_id,
    authorized_at: configuration.authorized_at,
    expected_prior_version: configuration.expected_prior_version,
    configuration_version: configuration.configuration_version,
    audit_ref: configuration.audit_ref,
    created_at: configuration.created_at,
    updated_at: configuration.updated_at,
  };
}

function canonicalTimestamp(value: string): string {
  if (typeof value !== 'string') throw new SchoolSignupError('school_configuration_mismatch');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    throw new SchoolSignupError('school_configuration_mismatch');
  }
  return parsed.toISOString();
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function assertExistingReceipt(
  receipt: SchoolInquiryReceipt,
  binding: SchoolInquiryRequestBinding,
  request: CanonicalSchoolInquiry,
) {
  const expectedNotification = {
    ...SCHOOL_INQUIRY_ACKNOWLEDGMENT_TEMPLATE,
    content_digest: SCHOOL_INQUIRY_ACKNOWLEDGMENT_CONTENT_DIGEST,
  };
  if (
    !sameBinding(receipt.request_binding, binding) ||
    receipt.lead.normalized_email !== request.normalized_email ||
    receipt.lead.school_name !== request.school_name ||
    receipt.lead.contact_first_name !== request.contact_first_name ||
    receipt.lead.contact_last_name !== request.contact_last_name ||
    receipt.lead.phone !== request.phone ||
    receipt.lead.note !== request.note ||
    receipt.lead.adult_contact_kind !== 'adult' ||
    receipt.lead.sales_state !== 'pending_manual_follow_up' ||
    receipt.lead.product_account_created ||
    receipt.lead.parent_login_created ||
    receipt.lead.passwordless_claim_created ||
    receipt.lead.household_created ||
    receipt.lead.student_accounts_created !== 0 ||
    receipt.lead.subscription_created ||
    receipt.lead.product_access_granted ||
    receipt.acknowledgment.intent_id !== `${receipt.lead.lead_id}:acknowledgment` ||
    receipt.acknowledgment.kind !== 'school_inquiry_acknowledgment' ||
    !sameBinding(receipt.acknowledgment.request_binding, binding) ||
    receipt.acknowledgment.normalized_email_hash !== digest(request.normalized_email) ||
    JSON.stringify(receipt.acknowledgment.notification) !== JSON.stringify(expectedNotification) ||
    receipt.acknowledgment.delivery_state !== 'pending' ||
    !receipt.acknowledgment.local_commit_required
  ) {
    throw new SchoolSignupError('school_inquiry_conflict');
  }
}

function digest(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
