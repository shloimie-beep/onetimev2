import { createHash } from 'node:crypto';
import type {
  CommercialBillingProjection,
  HostedCommercialBillingIntent,
} from '../../../../contracts/src/billing/commercial/index.ts';
import { GHL_IDENTITY_CONTRACT_VERSION } from '../../../../contracts/src/communications/ghl-identity/index.ts';
import {
  FAMILY_SIGNUP_FIELDS,
  FAMILY_SIGNUP_IDEMPOTENCY_KEY_MAX_LENGTH,
  FAMILY_SIGNUP_IDEMPOTENCY_KEY_MIN_LENGTH,
  FAMILY_SIGNUP_OPERATION,
  type FamilySignupAdultConsentChoices,
  type FamilySignupCommand,
  type FamilySignupLocalProjection,
  type FamilySignupOutboxIntent,
  type FamilySignupReceipt,
  type FamilySignupRequestBinding,
  type FamilySignupResult,
  type FamilySignupScope,
} from '../../../../contracts/src/signup/family/index.ts';
import {
  VERIFICATION_RUNTIME_TIER,
  type CanonicalState,
} from '../../../../contracts/src/state/index.ts';
import { normalizeAdultEmail } from '../../accounts/v21-household-identity.ts';
import { evaluatePassword } from '../../auth/policy.ts';
import {
  createFamilySignupProjection,
  freePeriodConfiguration,
  planHostedBillingCommand,
} from '../../billing/commercial/index.ts';
import { canonicalRequestHash } from '../../jobs/idempotency.ts';
import { resolveGhlIdentityLink } from '../../providers/shared/mapping.ts';

const HASH = /^[a-f0-9]{64}$/u;
const HIGH_ENTROPY_KEY = /^[A-Za-z0-9_-]+$/u;

export class FamilySignupError extends Error {
  constructor(
    readonly code:
      | 'invalid_family_signup'
      | 'invalid_password'
      | 'idempotency_conflict'
      | 'invalid_provider_evidence',
  ) {
    super(code);
    this.name = 'FamilySignupError';
  }
}

export interface ExistingFamilyIdentity {
  adult_id: string;
  human_account_id: string;
  normalized_email: string;
  human_account_state: CanonicalState<'human_account'>;
}

export interface ExistingFamilyHousehold {
  household_id: string;
  lifecycle_state: 'active' | 'expired' | 'archived' | 'inactive';
}

export interface ExistingFamilyLocalState {
  identity: ExistingFamilyIdentity | null;
  household: ExistingFamilyHousehold | null;
}

export interface FamilySignupRecoveryRecord {
  receipt: FamilySignupReceipt;
}

export type FamilySignupGhlEvidence =
  | {
      status: 'available';
      verified_contact_ref_hash: string | null;
      verified_contact_email_hash: string | null;
      exact_email_match_ref_hashes: readonly string[];
      marketing_suppressed: boolean;
      service_suppressed: boolean;
      suppression_evidence_digest: string;
    }
  | {
      status: 'evidence_unavailable';
      safe_reason: 'evidence_unavailable';
    };

export interface CanonicalFamilySignupRequest {
  classification: 'family';
  first_name: string;
  last_name: string;
  normalized_email: string;
  password_fingerprint: string;
  timezone: string;
  terms_accepted: true;
  privacy_accepted: true;
  general_marketing_consent: boolean;
  parent_newsletter_consent: boolean;
}

export interface PlanFamilySignupInput {
  scope: FamilySignupScope;
  request_binding: FamilySignupRequestBinding;
  command: FamilySignupCommand;
  normalized_email: string;
  now: Date;
  free_access_expires_at?: string;
  proposed_adult_id: string;
  proposed_human_account_id: string;
  proposed_household_id: string;
  existing_local_state: ExistingFamilyLocalState;
  existing_request: FamilySignupRecoveryRecord | null;
  ghl_evidence: FamilySignupGhlEvidence | null;
}

export interface FamilySignupPlan {
  result: FamilySignupResult;
  outbox_intents: readonly FamilySignupOutboxIntent[];
  commercial_billing: FamilySignupCommercialBillingPlan | null;
  local_write_required: boolean;
  credential_write_required: boolean;
  session_write_required: boolean;
  ghl_identity_state: 'unlinked' | 'linked' | 'readback_required' | 'identity_review';
  ghl_contact_ref_hash: string | null;
  ghl_evidence_status: FamilySignupGhlEvidence['status'];
  ghl_sync_quarantined: boolean;
}

export interface FamilySignupCommercialCommandRecord {
  actor_ref: string;
  operation_scope: string;
  idempotency_key: string;
  canonical_request_hash: string;
  resulting_version: number;
  response: {
    projection: CommercialBillingProjection;
    intent?: HostedCommercialBillingIntent;
  };
  outbox_intents: readonly HostedCommercialBillingIntent[];
}

export interface FamilySignupCommercialBillingPlan {
  signup: FamilySignupCommercialCommandRecord;
  checkout: FamilySignupCommercialCommandRecord | null;
}

export function assertFamilySignupEnvelope(
  scope: FamilySignupScope,
  command: FamilySignupCommand,
): void {
  const actualFields = Object.keys(command).sort();
  const requiredFields = [...FAMILY_SIGNUP_FIELDS, 'idempotency_key'].sort();
  const expectedRuntime = VERIFICATION_RUNTIME_TIER[scope.verification_environment_id];
  if (
    actualFields.length !== requiredFields.length ||
    actualFields.some((field, index) => field !== requiredFields[index]) ||
    scope.product !== 'one_time_mishnayos' ||
    expectedRuntime === undefined ||
    expectedRuntime !== scope.runtime_tier ||
    command.classification !== 'family' ||
    command.idempotency_key.length < FAMILY_SIGNUP_IDEMPOTENCY_KEY_MIN_LENGTH ||
    command.idempotency_key.length > FAMILY_SIGNUP_IDEMPOTENCY_KEY_MAX_LENGTH ||
    !HIGH_ENTROPY_KEY.test(command.idempotency_key) ||
    new Set(command.idempotency_key).size < 16 ||
    command.terms_accepted !== true ||
    command.privacy_accepted !== true ||
    typeof command.general_marketing_consent !== 'boolean' ||
    typeof command.parent_newsletter_consent !== 'boolean' ||
    !command.first_name.trim() ||
    !command.last_name.trim() ||
    !command.timezone.trim()
  ) {
    throw new FamilySignupError('invalid_family_signup');
  }
  normalizeAdultEmail(command.email);
  if (command.password !== command.password_confirmation) {
    throw new FamilySignupError('invalid_password');
  }
  if (!isIanaTimeZone(command.timezone.trim())) {
    throw new FamilySignupError('invalid_family_signup');
  }
}

export function assertFamilySignupPassword(command: FamilySignupCommand): void {
  const password = evaluatePassword({
    role: 'parent',
    password: command.password,
    email: command.email,
    names: [command.first_name, command.last_name],
  });
  if (!password.accepted) throw new FamilySignupError('invalid_password');
}

export function canonicalizeFamilySignupRequest(
  scope: FamilySignupScope,
  command: FamilySignupCommand,
  passwordFingerprint: string,
): {
  request_binding: FamilySignupRequestBinding;
  request: CanonicalFamilySignupRequest;
} {
  assertFamilySignupEnvelope(scope, command);
  if (!HASH.test(passwordFingerprint)) {
    throw new FamilySignupError('invalid_family_signup');
  }
  const request: CanonicalFamilySignupRequest = {
    classification: 'family',
    first_name: command.first_name.trim(),
    last_name: command.last_name.trim(),
    normalized_email: normalizeAdultEmail(command.email),
    password_fingerprint: passwordFingerprint,
    timezone: command.timezone.trim(),
    terms_accepted: true,
    privacy_accepted: true,
    general_marketing_consent: command.general_marketing_consent,
    parent_newsletter_consent: command.parent_newsletter_consent,
  };
  return {
    request_binding: {
      scope: { ...scope },
      operation: FAMILY_SIGNUP_OPERATION,
      idempotency_key: command.idempotency_key,
      canonical_request_digest: digest(JSON.stringify(request)),
    },
    request,
  };
}

export function planFamilySignup(input: PlanFamilySignupInput): FamilySignupPlan {
  assertFamilySignupEnvelope(input.scope, input.command);
  assertBinding(input.scope, input.command, input.request_binding);

  if (input.existing_request) {
    if (!sameBinding(input.existing_request.receipt.request_binding, input.request_binding)) {
      throw new FamilySignupError('idempotency_conflict');
    }
    return noWritePlan(
      { ...input.existing_request.receipt.result, disposition: 'recovered' },
      input.existing_request.receipt.outbox_intents,
    );
  }

  if (
    input.existing_local_state.identity !== null ||
    input.existing_local_state.household !== null
  ) {
    return noWritePlan(existingAccountResult(), []);
  }

  assertFamilySignupPassword(input.command);
  if (!input.ghl_evidence) throw new FamilySignupError('invalid_provider_evidence');
  if (
    !input.proposed_adult_id ||
    !input.proposed_human_account_id ||
    !input.proposed_household_id
  ) {
    throw new FamilySignupError('invalid_family_signup');
  }

  const normalizedEmailHash = digest(input.normalized_email);
  const link =
    input.ghl_evidence.status === 'available'
      ? resolveGhlIdentityLink({
          adult_id: input.proposed_adult_id,
          normalized_email_hash: normalizedEmailHash,
          verified_contact_ref_hash: input.ghl_evidence.verified_contact_ref_hash,
          verified_contact_email_hash: input.ghl_evidence.verified_contact_email_hash,
          exact_email_match_ref_hashes: input.ghl_evidence.exact_email_match_ref_hashes,
          outbox_intent_ids: [`${input.command.idempotency_key}:ghl-sync`],
          marketing_suppressed: input.ghl_evidence.marketing_suppressed,
          service_suppressed: input.ghl_evidence.service_suppressed,
          suppression_evidence_digest: input.ghl_evidence.suppression_evidence_digest,
        })
      : {
          state: 'readback_required' as const,
          verified_contact_ref_hash: null,
        };
  const freeAccessExpiresAt = input.free_access_expires_at;
  const expiry = freeAccessExpiresAt ? Date.parse(freeAccessExpiresAt) : Number.NaN;
  const beforeExpiry = Number.isFinite(expiry) && input.now.getTime() < expiry;
  const identityReviewBlocksCheckout = !beforeExpiry && link.state === 'identity_review';
  const consentChoices: FamilySignupAdultConsentChoices = {
    general_marketing: input.command.general_marketing_consent,
    parent_newsletter: input.command.parent_newsletter_consent,
  };
  const projection: FamilySignupLocalProjection = {
    adult_id: input.proposed_adult_id,
    human_account_id: input.proposed_human_account_id,
    household_id: input.proposed_household_id,
    normalized_email: input.normalized_email,
    access_branch: beforeExpiry
      ? 'immediate_free'
      : identityReviewBlocksCheckout
        ? 'inactive_identity_review'
        : 'inactive_checkout',
    access_state: beforeExpiry ? 'free' : 'inactive',
    seat_limit: 3,
    active_seat_count: 0,
    free_access_expires_at: beforeExpiry ? freeAccessExpiresAt! : null,
    checkout_required: !beforeExpiry && !identityReviewBlocksCheckout,
    checkout_blocked_by_identity_review: identityReviewBlocksCheckout,
    rolling_trial_granted: false,
    card_collected: false,
  };
  const outbox: FamilySignupOutboxIntent = {
    intent_id: `${input.command.idempotency_key}:ghl-sync`,
    kind: 'ghl_adult_and_household_sync',
    request_binding: input.request_binding,
    adult_id: projection.adult_id,
    household_id: projection.household_id,
    normalized_email_hash: normalizedEmailHash,
    adult_consent_choices: consentChoices,
    dispatch_state: link.state === 'identity_review' ? 'identity_review' : 'ready',
    preserve_adult_suppression: true,
    local_commit_required: true,
    ghl_handoff: {
      contract_version: '1.0.0',
      target: 'p27_ghl_identity_sync',
      target_contract_version: GHL_IDENTITY_CONTRACT_VERSION,
      operation_id: `p08_ghl_${digest(
        `${input.request_binding.canonical_request_digest}\0${projection.household_id}`,
      ).slice(0, 32)}`,
      local_commit_id: `p08_commit_${digest(
        `${input.request_binding.idempotency_key}\0${projection.household_id}`,
      ).slice(0, 32)}`,
      local_commit_state: 'committed',
      local_result_durable: true,
      provider_failure_rolls_back_local_result: false,
      subject: {
        kind: 'adult',
        adult_id: projection.adult_id,
        normalized_email_hash: normalizedEmailHash,
      },
      household: {
        household_id: projection.household_id,
        owner_adult_id: projection.adult_id,
        classification: 'family',
        lifecycle_state: 'active',
        access_projection: projection.access_state,
        stripe_customer_ref_hash: null,
        service_reminders_enabled: false,
        source_evidence_digest: input.request_binding.canonical_request_digest,
        policy_consent_evidence_digest: digest(
          JSON.stringify({
            terms_accepted: true,
            privacy_accepted: true,
            general_marketing: consentChoices.general_marketing,
            parent_newsletter: consentChoices.parent_newsletter,
          }),
        ),
      },
      provider_readback_required: input.ghl_evidence.status === 'evidence_unavailable',
      provider_effect_authorized: false,
      message_delivery_authorized: false,
      billing_effect_authorized: false,
      student_contact_prohibited: true,
    },
  };
  const commercialBilling = planCommercialBilling({
    scope: input.scope,
    requestBinding: input.request_binding,
    projection,
    now: input.now,
    ...(freeAccessExpiresAt === undefined ? {} : { freeAccessExpiresAt }),
    checkoutRequired: !beforeExpiry && !identityReviewBlocksCheckout,
  });
  return {
    result: {
      disposition: 'created',
      projection,
      next_action: beforeExpiry
        ? 'signed_in'
        : identityReviewBlocksCheckout
          ? 'identity_review'
          : 'checkout',
      setup_email_required: false,
      provider_effects_completed_inline: 0,
      outbox_intent_ids: [outbox.intent_id],
      ghl_handoff_state:
        link.state === 'readback_required'
          ? 'readback_required'
          : link.state === 'identity_review'
            ? 'identity_review'
            : 'ready',
      checkout_handoff_state: beforeExpiry
        ? 'not_applicable'
        : identityReviewBlocksCheckout
          ? 'blocked_identity_review'
          : 'queued',
      safe_message: beforeExpiry
        ? 'Your family account is ready.'
        : identityReviewBlocksCheckout
          ? 'Your inactive account is ready. Checkout will be available after account review.'
          : 'Your account is ready. Continue to checkout.',
    },
    outbox_intents: [outbox],
    commercial_billing: commercialBilling,
    local_write_required: true,
    credential_write_required: true,
    session_write_required: true,
    ghl_identity_state: link.state,
    ghl_contact_ref_hash: link.verified_contact_ref_hash,
    ghl_evidence_status: input.ghl_evidence.status,
    ghl_sync_quarantined: link.state === 'identity_review',
  };
}

function planCommercialBilling(input: {
  scope: FamilySignupScope;
  requestBinding: FamilySignupRequestBinding;
  projection: FamilySignupLocalProjection;
  now: Date;
  freeAccessExpiresAt?: string;
  checkoutRequired: boolean;
}): FamilySignupCommercialBillingPlan {
  const configuration = freePeriodConfiguration(input.freeAccessExpiresAt);
  const signupProjection = createFamilySignupProjection({
    householdId: input.projection.household_id,
    ownerAdultId: input.projection.adult_id,
    activeStudentCount: 0,
    now: input.now,
    configuration,
  });
  if (
    signupProjection.accessState !== input.projection.access_state ||
    signupProjection.freePeriodEndsAt !== configuration.endsAt
  ) {
    throw new FamilySignupError('invalid_family_signup');
  }
  const signupRequestHash = canonicalRequestHash({
    kind: 'family_signup',
    householdId: input.projection.household_id,
    ownerAdultId: input.projection.adult_id,
    activeStudentCount: 0,
    occurredAt: input.now.toISOString(),
    freePeriodSourceKey: configuration.sourceKey,
  });
  const signup: FamilySignupCommercialCommandRecord = {
    actor_ref: input.projection.adult_id,
    operation_scope: `billing.commercial.signup:${input.projection.household_id}`,
    idempotency_key: input.requestBinding.idempotency_key,
    canonical_request_hash: signupRequestHash,
    resulting_version: signupProjection.version,
    response: { projection: signupProjection },
    outbox_intents: [],
  };
  if (!input.checkoutRequired) return { signup, checkout: null };

  const checkoutIdempotencyKey = `${input.requestBinding.idempotency_key}:hosted-checkout`;
  const planned = planHostedBillingCommand({
    actor: {
      adultId: input.projection.adult_id,
      authorization: {
        humanAccountId: input.projection.human_account_id,
        memberships: ['parent'],
        activeRole: 'parent',
        activeHouseholdId: input.projection.household_id,
        serverResolvedOwnedHouseholdIds: [input.projection.household_id],
      },
    },
    command: {
      kind: 'request_hosted_checkout',
      householdId: input.projection.household_id,
      idempotencyKey: checkoutIdempotencyKey,
      expectedVersion: signupProjection.version,
      scope: input.scope,
      mode: 'standard',
      requestedAt: input.now.toISOString(),
      consent: null,
    },
    prior: signupProjection,
    configuration,
  });
  return {
    signup,
    checkout: {
      actor_ref: input.projection.adult_id,
      operation_scope: `billing.commercial.request_hosted_checkout:${input.projection.household_id}`,
      idempotency_key: checkoutIdempotencyKey,
      canonical_request_hash: planned.requestHash,
      resulting_version: planned.projection.version,
      response: {
        projection: planned.projection,
        intent: planned.intent,
      },
      outbox_intents: [planned.intent],
    },
  };
}

function assertBinding(
  scope: FamilySignupScope,
  command: FamilySignupCommand,
  binding: FamilySignupRequestBinding,
): void {
  if (
    binding.operation !== FAMILY_SIGNUP_OPERATION ||
    binding.idempotency_key !== command.idempotency_key ||
    !HASH.test(binding.canonical_request_digest) ||
    !sameScope(binding.scope, scope)
  ) {
    throw new FamilySignupError('invalid_family_signup');
  }
}

function sameBinding(left: FamilySignupRequestBinding, right: FamilySignupRequestBinding): boolean {
  return (
    left.operation === right.operation &&
    left.idempotency_key === right.idempotency_key &&
    left.canonical_request_digest === right.canonical_request_digest &&
    sameScope(left.scope, right.scope)
  );
}

function sameScope(left: FamilySignupScope, right: FamilySignupScope): boolean {
  return (
    left.product === right.product &&
    left.runtime_tier === right.runtime_tier &&
    left.verification_environment_id === right.verification_environment_id
  );
}

function existingAccountResult(): FamilySignupResult {
  return {
    disposition: 'existing_account',
    projection: null,
    next_action: 'sign_in_or_reset',
    setup_email_required: false,
    provider_effects_completed_inline: 0,
    outbox_intent_ids: [],
    ghl_handoff_state: 'not_applicable',
    checkout_handoff_state: 'not_applicable',
    safe_message: 'Sign in or reset your password to continue.',
  };
}

function noWritePlan(
  result: FamilySignupResult,
  outboxIntents: readonly FamilySignupOutboxIntent[],
): FamilySignupPlan {
  return {
    result,
    outbox_intents: outboxIntents,
    commercial_billing: null,
    local_write_required: false,
    credential_write_required: false,
    session_write_required: false,
    ghl_identity_state: 'unlinked',
    ghl_contact_ref_hash: null,
    ghl_evidence_status: 'evidence_unavailable',
    ghl_sync_quarantined: false,
  };
}

function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function isIanaTimeZone(value: string): boolean {
  if (/^(?:[+-]\d{2}:?\d{2}|(?:GMT|UTC)[+-].*)$/iu.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}
