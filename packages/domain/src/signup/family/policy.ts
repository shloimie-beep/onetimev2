import { createHash } from 'node:crypto';
import {
  FAMILY_FREE_EXPIRY,
  FAMILY_SIGNUP_FIELDS,
  type FamilySignupCommand,
  type FamilySignupLocalProjection,
  type FamilySignupOutboxIntent,
  type FamilySignupResult,
} from '../../../../contracts/src/signup/family/index.ts';
import { normalizeAdultEmail } from '../../accounts/v21-household-identity.ts';
import { evaluatePassword } from '../../auth/policy.ts';
import { resolveGhlIdentityLink } from '../../providers/shared/mapping.ts';

const HASH = /^[a-f0-9]{64}$/u;
const OPAQUE = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/u;

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
  active_family_household_id: string | null;
}

export interface FamilySignupRecoveryRecord {
  idempotency_key: string;
  canonical_request_hash: string;
  result: FamilySignupResult;
  outbox_intents: readonly FamilySignupOutboxIntent[];
}

export interface FamilySignupGhlEvidence {
  verified_contact_ref_hash: string | null;
  verified_contact_email_hash: string | null;
  exact_email_match_ref_hashes: readonly string[];
  marketing_suppressed: boolean;
  service_suppressed: boolean;
  suppression_evidence_digest: string;
}

export interface PlanFamilySignupInput {
  command: FamilySignupCommand;
  now: Date;
  proposed_adult_id: string;
  proposed_human_account_id: string;
  proposed_household_id: string;
  existing_identity: ExistingFamilyIdentity | null;
  existing_request: FamilySignupRecoveryRecord | null;
  ghl_evidence: FamilySignupGhlEvidence;
}

export interface FamilySignupPlan {
  result: FamilySignupResult;
  outbox_intents: readonly FamilySignupOutboxIntent[];
  local_write_required: boolean;
  credential_write_required: boolean;
  ghl_identity_state: 'unlinked' | 'linked' | 'identity_review';
  ghl_contact_ref_hash: string | null;
  ghl_sync_quarantined: boolean;
}

export function planFamilySignup(input: PlanFamilySignupInput): FamilySignupPlan {
  assertCommand(input.command);
  const normalizedEmail = normalizeAdultEmail(input.command.email);
  const normalizedEmailHash = digest(normalizedEmail);

  if (input.existing_request) {
    if (
      input.existing_request.idempotency_key !== input.command.idempotency_key ||
      input.existing_request.canonical_request_hash !== input.command.canonical_request_hash
    ) {
      throw new FamilySignupError('idempotency_conflict');
    }
    return {
      result: { ...input.existing_request.result, disposition: 'recovered' },
      outbox_intents: input.existing_request.outbox_intents,
      local_write_required: false,
      credential_write_required: false,
      ghl_identity_state: 'unlinked',
      ghl_contact_ref_hash: null,
      ghl_sync_quarantined: false,
    };
  }

  if (input.existing_identity && input.existing_identity.normalized_email !== normalizedEmail) {
    throw new FamilySignupError('invalid_family_signup');
  }
  if (input.existing_identity?.active_family_household_id) {
    return {
      result: {
        disposition: 'existing_account',
        projection: null,
        next_action: 'sign_in_or_reset',
        setup_email_required: false,
        provider_effects_completed_inline: 0,
        outbox_intent_ids: [],
        safe_message: 'Sign in or reset your password to continue.',
      },
      outbox_intents: [],
      local_write_required: false,
      credential_write_required: false,
      ghl_identity_state: 'unlinked',
      ghl_contact_ref_hash: null,
      ghl_sync_quarantined: false,
    };
  }

  const link = resolveGhlIdentityLink({
    adult_id: input.existing_identity?.adult_id ?? input.proposed_adult_id,
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
  const adultId = input.existing_identity?.adult_id ?? input.proposed_adult_id;
  const accountId = input.existing_identity?.human_account_id ?? input.proposed_human_account_id;
  const projection: FamilySignupLocalProjection = {
    adult_id: adultId,
    human_account_id: accountId,
    household_id: input.proposed_household_id,
    normalized_email: normalizedEmail,
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
    adult_id: adultId,
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
    credential_write_required: input.existing_identity === null,
    ghl_identity_state: link.state,
    ghl_contact_ref_hash: link.verified_contact_ref_hash,
    ghl_sync_quarantined: link.state === 'identity_review',
  };
}

function assertCommand(command: FamilySignupCommand): void {
  const actualFields = Object.keys(command).sort();
  const requiredFields = [
    ...FAMILY_SIGNUP_FIELDS,
    'idempotency_key',
    'canonical_request_hash',
  ].sort();
  if (
    actualFields.length !== requiredFields.length ||
    actualFields.some((field, index) => field !== requiredFields[index]) ||
    command.classification !== 'family' ||
    !OPAQUE.test(command.idempotency_key) ||
    !HASH.test(command.canonical_request_hash) ||
    command.terms_accepted !== true ||
    command.privacy_accepted !== true ||
    !command.first_name.trim() ||
    !command.last_name.trim() ||
    !command.timezone.trim()
  ) {
    throw new FamilySignupError('invalid_family_signup');
  }
  const password = evaluatePassword({
    role: 'parent',
    password: command.password,
    email: command.email,
    names: [command.first_name, command.last_name],
  });
  if (!password.accepted) throw new FamilySignupError('invalid_password');
}

function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
