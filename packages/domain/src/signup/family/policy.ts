import { createHash } from 'node:crypto';
import {
  FAMILY_FREE_EXPIRY,
  FAMILY_SIGNUP_FIELDS,
  FAMILY_SIGNUP_IDEMPOTENCY_KEY_MAX_LENGTH,
  FAMILY_SIGNUP_IDEMPOTENCY_KEY_MIN_LENGTH,
  FAMILY_SIGNUP_OPERATION,
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

export interface FamilySignupGhlEvidence {
  verified_contact_ref_hash: string | null;
  verified_contact_email_hash: string | null;
  exact_email_match_ref_hashes: readonly string[];
  marketing_suppressed: boolean;
  service_suppressed: boolean;
  suppression_evidence_digest: string;
}

export interface CanonicalFamilySignupRequest {
  classification: 'family';
  first_name: string;
  last_name: string;
  normalized_email: string;
  password_fingerprint: string;
  timezone: string;
  terms_accepted: true;
  privacy_accepted: true;
}

export interface PlanFamilySignupInput {
  scope: FamilySignupScope;
  request_binding: FamilySignupRequestBinding;
  command: FamilySignupCommand;
  normalized_email: string;
  now: Date;
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
  local_write_required: boolean;
  credential_write_required: boolean;
  session_write_required: boolean;
  ghl_identity_state: 'unlinked' | 'linked' | 'identity_review';
  ghl_contact_ref_hash: string | null;
  ghl_sync_quarantined: boolean;
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
    !command.first_name.trim() ||
    !command.last_name.trim() ||
    !command.timezone.trim()
  ) {
    throw new FamilySignupError('invalid_family_signup');
  }
  normalizeAdultEmail(command.email);
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
  const link = resolveGhlIdentityLink({
    adult_id: input.proposed_adult_id,
    normalized_email_hash: normalizedEmailHash,
    verified_contact_ref_hash: input.ghl_evidence.verified_contact_ref_hash,
    verified_contact_email_hash: input.ghl_evidence.verified_contact_email_hash,
    exact_email_match_ref_hashes: input.ghl_evidence.exact_email_match_ref_hashes,
    outbox_intent_ids: [`${input.command.idempotency_key}:ghl-sync`],
    marketing_suppressed: input.ghl_evidence.marketing_suppressed,
    service_suppressed: input.ghl_evidence.service_suppressed,
    suppression_evidence_digest: input.ghl_evidence.suppression_evidence_digest,
  });
  const beforeExpiry = input.now.getTime() < Date.parse(FAMILY_FREE_EXPIRY);
  const projection: FamilySignupLocalProjection = {
    adult_id: input.proposed_adult_id,
    human_account_id: input.proposed_human_account_id,
    household_id: input.proposed_household_id,
    normalized_email: input.normalized_email,
    access_branch: beforeExpiry ? 'immediate_free' : 'inactive_checkout',
    access_state: beforeExpiry ? 'free' : 'inactive',
    seat_limit: 3,
    active_seat_count: 0,
    free_access_expires_at: beforeExpiry ? FAMILY_FREE_EXPIRY : null,
    checkout_required: !beforeExpiry,
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
    preserve_adult_suppression: true,
    local_commit_required: true,
  };
  return {
    result: {
      disposition: 'created',
      projection,
      next_action: beforeExpiry ? 'signed_in' : 'checkout',
      setup_email_required: false,
      provider_effects_completed_inline: 0,
      outbox_intent_ids: [outbox.intent_id],
      safe_message: beforeExpiry
        ? 'Your family account is ready.'
        : 'Your account is ready. Continue to checkout.',
    },
    outbox_intents: [outbox],
    local_write_required: true,
    credential_write_required: true,
    session_write_required: beforeExpiry,
    ghl_identity_state: link.state,
    ghl_contact_ref_hash: link.verified_contact_ref_hash,
    ghl_sync_quarantined: link.state === 'identity_review',
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
    local_write_required: false,
    credential_write_required: false,
    session_write_required: false,
    ghl_identity_state: 'unlinked',
    ghl_contact_ref_hash: null,
    ghl_sync_quarantined: false,
  };
}

function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
