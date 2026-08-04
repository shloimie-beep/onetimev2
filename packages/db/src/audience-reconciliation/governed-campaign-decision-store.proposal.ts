/**
 * Design-only contract for the OT-15 campaign-bound audience decision store.
 *
 * This file is intentionally not exported or implemented. Migration request
 * OT-LIVE-002-MIGRATION-001 and ordinal 2260 are REQUESTED_NOT_ALLOCATED.
 * F02 is the only semantic allocator and migration-file writer.
 */

export const GOVERNED_CAMPAIGN_REQUIREMENTS = [
  'OTV2-GHL-135',
  'OTV2-GHL-137',
  'OTV2-GHL-138',
  'OTV2-EMAIL-145',
  'OTV2-PROVIDER-231',
] as const;

export const GOVERNED_CAMPAIGN_PROVIDER_BINDING = {
  providerLocationId: 'pBSnOK2nkdxp6gf9Rg3o',
  providerCampaignId: '6a71a64c28f7a5dbb3aec1be',
  providerWorkflowId: '09051378-5917-4172-afda-f425619dd23d',
  providerLaunchTagId: 'IcOGsLgSIOYGFlHF4kQ0',
} as const;

export const GOVERNED_CAMPAIGN_FORBIDDEN_SOURCE_FACT_FIELDS = [
  'name',
  'email',
  'phone',
  'postal_address',
  'free_form_note',
  'message_body',
  'transcript',
  'student_record',
  'credential',
  'cookie',
  'token',
  'secret',
  'raw_provider_contact_reference',
  'private_provider_field',
] as const;

export type GovernedCampaignRuntimeTier = 'isolated_staging' | 'production';
export type GovernedCampaignSha256 = string & { readonly __sha256: unique symbol };

export type GovernedCampaignAudienceDecision = 'include' | 'exclude' | 'review';

export type GovernedCampaignAudienceReason =
  | 'eligible_inactive_adult'
  | 'inactive_adult_tisha_registrant'
  | 'inactive_adult_former_member'
  | 'inactive_adult_lead'
  | 'active_or_current_subscriber'
  | 'student_or_minor'
  | 'school_contact'
  | 'staff_or_test'
  | 'duplicate_contact'
  | 'missing_email'
  | 'invalid_email'
  | 'email_dnd_or_unsubscribed'
  | 'complaint'
  | 'hard_bounce'
  | 'provider_suppression'
  | 'ambiguous_identity'
  | 'unknown_consent';

export interface GovernedCampaignProviderBinding {
  providerLocationId: typeof GOVERNED_CAMPAIGN_PROVIDER_BINDING.providerLocationId;
  providerCampaignId: typeof GOVERNED_CAMPAIGN_PROVIDER_BINDING.providerCampaignId;
  providerWorkflowId: typeof GOVERNED_CAMPAIGN_PROVIDER_BINDING.providerWorkflowId;
  providerLaunchTagId: typeof GOVERNED_CAMPAIGN_PROVIDER_BINDING.providerLaunchTagId;
}

/** Exact allowlist: no arbitrary keys, free-form strings, or nested records. */
export interface GovernedCampaignSanitizedSourceFacts {
  adultEvidenceState: 'proven' | 'not_proven' | 'conflicting';
  studentOrMinorState: 'absent' | 'present' | 'unknown';
  schoolContactState: 'absent' | 'present' | 'unknown';
  activeOrCurrentSubscriberState: 'absent' | 'present' | 'unknown';
  consentState: 'opted_in' | 'opted_out' | 'unknown';
  deliverabilityState: 'deliverable' | 'invalid' | 'missing' | 'unknown';
  providerSuppressionState: 'active' | 'suppressed' | 'unknown';
  identityMatchState: 'exact' | 'duplicate' | 'ambiguous' | 'missing';
  sourceJoinCount: number;
  sourceFactsHash: GovernedCampaignSha256;
}

export interface GovernedCampaignAudienceDecisionInput {
  decisionKey: string;
  /** SHA-256 of the protected provider contact reference; never the raw value. */
  providerContactRefHash: GovernedCampaignSha256;
  contactKey: string | null;
  decision: GovernedCampaignAudienceDecision;
  primaryReason: GovernedCampaignAudienceReason;
  reasonCodes: readonly GovernedCampaignAudienceReason[];
  sourceFacts: Readonly<GovernedCampaignSanitizedSourceFacts>;
  decisionVersion: number;
}

export interface ReconcileGovernedCampaignAudienceRequest {
  runtimeTier: GovernedCampaignRuntimeTier;
  verificationEnvironmentId: string;
  accountKey: string;
  productKey: string;
  campaignKey: string;
  binding: GovernedCampaignProviderBinding;
  idempotencyKey: string;
  requestHash: GovernedCampaignSha256;
  snapshotHash: GovernedCampaignSha256;
  sourceObservedAt: string;
  createdByUserKey: string;
  expectedDecisionRows: number;
  /** Inserted decision rows plus rows marked superseded. */
  maximumAffectedRows: number;
  decisions: readonly GovernedCampaignAudienceDecisionInput[];
}

export interface GovernedCampaignAudienceReasonCount {
  decision: GovernedCampaignAudienceDecision;
  primaryReason: GovernedCampaignAudienceReason;
  rows: number;
}

export interface ReconcileGovernedCampaignAudienceResult {
  runtimeTier: GovernedCampaignRuntimeTier;
  verificationEnvironmentId: string;
  campaignKey: string;
  binding: GovernedCampaignProviderBinding;
  snapshotHash: GovernedCampaignSha256;
  requestHash: GovernedCampaignSha256;
  replayed: boolean;
  insertedRows: number;
  supersededRows: number;
  affectedRows: number;
  currentRows: number;
  currentProjectionHash: GovernedCampaignSha256;
  reasonCounts: readonly GovernedCampaignAudienceReasonCount[];
  rawContactPiiIncluded: false;
  rawProviderContactIdentifiersIncluded: false;
  studentRecordsIncluded: false;
  contactEffects: 0;
  providerEffects: 0;
  sendEffects: 0;
}

export interface GovernedCampaignAudienceDecisionStoreProposal {
  /**
   * Required transaction algorithm:
   *
   * 1. Reject a blank verificationEnvironmentId, a non-exact provider binding,
   *    malformed hashes, duplicate providerContactRefHashes, a count mismatch,
   *    a negative ceiling, or any sourceFacts key/value outside the exact typed
   *    allowlist. Reject all forbidden PII, notes, messages, transcripts,
   *    Student records, credentials, cookies, tokens, secrets, and private
   *    provider fields at the contract boundary.
   * 2. Canonicalize runtimeTier, verificationEnvironmentId, accountKey,
   *    productKey, campaignKey, the exact provider binding, expected row count,
   *    maximumAffectedRows, and every ordered decision into requestHash.
   * 3. Begin one database transaction and acquire an advisory lock over
   *    runtimeTier + verificationEnvironmentId + accountKey + productKey +
   *    campaignKey. All reads and writes remain in that exact scope.
   * 4. Under the lock, read the exact current projection and idempotency rows.
   *    A replay is valid only when runtime/environment/binding, requestHash,
   *    snapshotHash, row count, and canonical decision digest all match.
   * 5. Calculate supersededRows + insertedRows before writing and roll back if
   *    it exceeds maximumAffectedRows. A zero-row authority cannot write.
   * 6. Supersede replaced current rows only by a one-way NULL-to-timestamp
   *    change, then insert immutable new versions. Never rewrite or delete a
   *    historical decision body.
   * 7. Read the current projection back in the transaction. Require the exact
   *    runtime/environment/binding, row and reason counts, snapshotHash, and a
   *    canonical projection hash; roll back on mismatch or unknown result.
   * 8. Commit only after readback succeeds and return exact SQL effects. The
   *    operation has zero contact, provider, Student-record, and send effects.
   */
  reconcile(
    request: ReconcileGovernedCampaignAudienceRequest,
  ): Promise<ReconcileGovernedCampaignAudienceResult>;
}
