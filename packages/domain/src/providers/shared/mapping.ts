import type {
  AdultGhlIdentityLink,
  HouseholdProviderMapping,
  IdentityBoundEffect,
  ProviderEffectDecision,
} from '../../../../contracts/src/providers/v21-provider-core.ts';
import { ProviderCoreError } from './errors.ts';

const SHA256 = /^[a-f0-9]{64}$/;
const LOCAL_EFFECTS = new Set<IdentityBoundEffect>([
  'local_login',
  'local_free_access',
  'local_student_management',
  'resend_security',
]);

export function resolveGhlIdentityLink(input: {
  adult_id: string;
  normalized_email_hash: string;
  verified_contact_ref_hash: string | null;
  verified_contact_email_hash: string | null;
  exact_email_match_ref_hashes: readonly string[];
  outbox_intent_ids: readonly string[];
  marketing_suppressed: boolean;
  service_suppressed: boolean;
  suppression_evidence_digest: string;
}): AdultGhlIdentityLink {
  assertHash(input.normalized_email_hash, 'normalized_email_hash');
  assertHash(input.suppression_evidence_digest, 'suppression_evidence_digest');
  const candidates = uniqueHashes(input.exact_email_match_ref_hashes);
  if (input.verified_contact_ref_hash !== null) {
    assertHash(input.verified_contact_ref_hash, 'verified_contact_ref_hash');
    if (input.verified_contact_email_hash === null) {
      throw new ProviderCoreError(
        'invalid_contract',
        'A verified provider reference requires its observed normalized-email hash.',
      );
    }
    assertHash(input.verified_contact_email_hash, 'verified_contact_email_hash');
  } else if (input.verified_contact_email_hash !== null) {
    throw new ProviderCoreError(
      'invalid_contract',
      'A provider email observation requires its verified contact reference.',
    );
  }
  const referenceEmailDisagrees =
    input.verified_contact_email_hash !== null &&
    input.verified_contact_email_hash !== input.normalized_email_hash;
  const referenceCandidatesDisagree =
    input.verified_contact_ref_hash !== null &&
    candidates.some((candidate) => candidate !== input.verified_contact_ref_hash);
  const disagreement = referenceEmailDisagrees || referenceCandidatesDisagree;
  const state =
    disagreement || candidates.length > 1
      ? 'identity_review'
      : input.verified_contact_ref_hash !== null || candidates.length === 1
        ? 'linked'
        : 'unlinked';
  const verified =
    state === 'linked' ? (input.verified_contact_ref_hash ?? candidates[0] ?? null) : null;
  const reviewCandidates =
    state === 'identity_review'
      ? uniqueHashes([
          ...candidates,
          ...(input.verified_contact_ref_hash === null ? [] : [input.verified_contact_ref_hash]),
        ])
      : candidates;
  return {
    adult_id: requiredOpaque(input.adult_id, 'adult_id'),
    normalized_email_hash: input.normalized_email_hash,
    state,
    verified_contact_ref_hash: verified,
    candidate_contact_ref_hashes: reviewCandidates,
    quarantined_outbox_intent_ids:
      state === 'identity_review' ? uniqueOpaque(input.outbox_intent_ids) : [],
    suppression: {
      marketing_suppressed: input.marketing_suppressed,
      service_suppressed: input.service_suppressed,
      evidence_digest: input.suppression_evidence_digest,
      version: 1,
    },
    version: 1,
  };
}

export function decideIdentityBoundEffect(
  link: AdultGhlIdentityLink,
  effect: IdentityBoundEffect,
): ProviderEffectDecision {
  if (LOCAL_EFFECTS.has(effect)) {
    return { allowed: true, safe_code: 'local_effect_independent' };
  }
  if (effect === 'stripe_financial_mutation') {
    return { allowed: false, safe_code: 'stripe_financial_mutation_forbidden' };
  }
  if (link.state === 'identity_review') {
    return { allowed: false, safe_code: 'ghl_identity_review' };
  }
  if (effect === 'ghl_contact_upsert' && link.state === 'unlinked') {
    return { allowed: true, safe_code: 'ghl_contact_creation_allowed' };
  }
  return link.state === 'linked'
    ? { allowed: true, safe_code: 'ghl_identity_linked' }
    : { allowed: false, safe_code: 'ghl_identity_not_linked' };
}

export function resolveGhlIdentityReview(
  link: AdultGhlIdentityLink,
  input: {
    expected_version: number;
    admin_authorized: boolean;
    selected_contact_ref_hash: string;
  },
): { link: AdultGhlIdentityLink; replay_outbox_intent_ids: readonly string[] } {
  if (link.version !== input.expected_version) {
    throw new ProviderCoreError('stale_version', 'GHL identity link version is stale.');
  }
  assertHash(input.selected_contact_ref_hash, 'selected_contact_ref_hash');
  if (
    link.state !== 'identity_review' ||
    !input.admin_authorized ||
    !link.candidate_contact_ref_hashes.includes(input.selected_contact_ref_hash)
  ) {
    throw new ProviderCoreError(
      'identity_resolution_invalid',
      'Governed resolution must select exactly one reviewed candidate.',
    );
  }
  return {
    link: {
      ...link,
      state: 'linked',
      verified_contact_ref_hash: input.selected_contact_ref_hash,
      candidate_contact_ref_hashes: [input.selected_contact_ref_hash],
      quarantined_outbox_intent_ids: [],
      version: link.version + 1,
    },
    replay_outbox_intent_ids: link.quarantined_outbox_intent_ids,
  };
}

export function assertHouseholdProviderMappings(
  mappings: readonly HouseholdProviderMapping[],
): void {
  const householdPrograms = new Set<string>();
  const ghlRecords = new Set<string>();
  const stripeCustomers = new Set<string>();
  for (const mapping of mappings) {
    requiredOpaque(mapping.household_id, 'household_id');
    requiredOpaque(mapping.owner_adult_id, 'owner_adult_id');
    assertHash(mapping.ghl_household_record_ref_hash, 'ghl_household_record_ref_hash');
    assertHash(mapping.projected_owner_contact_ref_hash, 'projected_owner_contact_ref_hash');
    assertHash(mapping.stripe_customer_ref_hash, 'stripe_customer_ref_hash');
    assertHash(mapping.last_readback_digest, 'last_readback_digest');
    const householdProgramKey = `${mapping.runtime_tier}:${mapping.verification_environment_id}:${mapping.household_id}:${mapping.billing_program}`;
    const ghlKey = `${mapping.runtime_tier}:${mapping.verification_environment_id}:${mapping.ghl_household_record_ref_hash}`;
    const stripeKey = `${mapping.runtime_tier}:${mapping.verification_environment_id}:${mapping.stripe_customer_ref_hash}`;
    if (
      householdPrograms.has(householdProgramKey) ||
      ghlRecords.has(ghlKey) ||
      stripeCustomers.has(stripeKey)
    ) {
      throw new ProviderCoreError(
        'household_mapping_collision',
        'Households require distinct GHL records and household-scoped Stripe Customers.',
      );
    }
    householdPrograms.add(householdProgramKey);
    ghlRecords.add(ghlKey);
    stripeCustomers.add(stripeKey);
  }
}

export function updateAdultSuppression(
  link: AdultGhlIdentityLink,
  input: {
    expected_version: number;
    marketing_suppressed: boolean;
    service_suppressed: boolean;
    evidence_digest: string;
  },
): AdultGhlIdentityLink {
  if (link.version !== input.expected_version) {
    throw new ProviderCoreError('stale_version', 'GHL identity link version is stale.');
  }
  assertHash(input.evidence_digest, 'evidence_digest');
  return {
    ...link,
    suppression: {
      marketing_suppressed: input.marketing_suppressed,
      service_suppressed: input.service_suppressed,
      evidence_digest: input.evidence_digest,
      version: link.suppression.version + 1,
    },
    version: link.version + 1,
  };
}

export function updateHouseholdLifecycle(
  mapping: HouseholdProviderMapping,
  input: {
    expected_version: number;
    service_reminders_enabled: boolean;
    lifecycle_state: string;
    provider_revision: string;
    readback_digest: string;
  },
): HouseholdProviderMapping {
  assertVersion(mapping.version, input.expected_version);
  assertHash(input.readback_digest, 'readback_digest');
  return {
    ...mapping,
    service_reminders_enabled: input.service_reminders_enabled,
    lifecycle_state: requiredOpaque(input.lifecycle_state, 'lifecycle_state'),
    provider_revision: requiredOpaque(input.provider_revision, 'provider_revision'),
    last_readback_digest: input.readback_digest,
    version: mapping.version + 1,
  };
}

export function transferHouseholdProviderOwner(
  mapping: HouseholdProviderMapping,
  input: {
    expected_version: number;
    local_transfer_committed: boolean;
    replacement_adult_id: string;
    replacement_link: AdultGhlIdentityLink;
  },
): HouseholdProviderMapping {
  assertVersion(mapping.version, input.expected_version);
  if (!input.local_transfer_committed) {
    throw new ProviderCoreError(
      'invalid_contract',
      'Provider reassociation starts only after local ownership transfer commits.',
    );
  }
  const target =
    input.replacement_link.state === 'linked'
      ? input.replacement_link.verified_contact_ref_hash
      : null;
  return {
    ...mapping,
    owner_adult_id: requiredOpaque(input.replacement_adult_id, 'replacement_adult_id'),
    reconciliation_state: 'reconciliation_hold',
    transfer_target_contact_ref_hash: target,
    version: mapping.version + 1,
  };
}

export function completeHouseholdOwnerReassociation(
  mapping: HouseholdProviderMapping,
  input: {
    expected_version: number;
    observed_ghl_household_record_ref_hash: string;
    observed_owner_contact_ref_hash: string;
    provider_revision: string;
    readback_digest: string;
  },
): HouseholdProviderMapping {
  assertVersion(mapping.version, input.expected_version);
  assertHash(input.observed_ghl_household_record_ref_hash, 'observed_household_ref');
  assertHash(input.observed_owner_contact_ref_hash, 'observed_owner_ref');
  assertHash(input.readback_digest, 'readback_digest');
  if (
    mapping.reconciliation_state !== 'reconciliation_hold' ||
    mapping.transfer_target_contact_ref_hash === null ||
    mapping.ghl_household_record_ref_hash !== input.observed_ghl_household_record_ref_hash ||
    mapping.transfer_target_contact_ref_hash !== input.observed_owner_contact_ref_hash
  ) {
    throw new ProviderCoreError(
      'readback_mismatch',
      'Ownership reassociation completes only after exact household and owner readback.',
    );
  }
  return {
    ...mapping,
    projected_owner_contact_ref_hash: input.observed_owner_contact_ref_hash,
    reconciliation_state: 'in_sync',
    transfer_target_contact_ref_hash: null,
    provider_revision: requiredOpaque(input.provider_revision, 'provider_revision'),
    last_readback_digest: input.readback_digest,
    version: mapping.version + 1,
  };
}

function assertVersion(actual: number, expected: number): void {
  if (actual !== expected) {
    throw new ProviderCoreError('stale_version', 'Household provider mapping version is stale.');
  }
}

function uniqueHashes(values: readonly string[]): string[] {
  const result = [...new Set(values)];
  result.forEach((value) => assertHash(value, 'provider_ref_hash'));
  return result.sort();
}

function uniqueOpaque(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => requiredOpaque(value, 'intent_id')))].sort();
}

function assertHash(value: string, field: string): void {
  if (!SHA256.test(value)) {
    throw new ProviderCoreError('invalid_hash', `${field} must be a lowercase SHA-256 digest.`);
  }
}

function requiredOpaque(value: string, field: string): string {
  if (value.trim() === '' || /(?:@|token|secret|bearer|password)/i.test(value)) {
    throw new ProviderCoreError('invalid_contract', `${field} must be a safe opaque identifier.`);
  }
  return value;
}
