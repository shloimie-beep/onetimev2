/**
 * Design-only contract for a campaign-bound audience decision store.
 *
 * This file is intentionally not exported by a package barrel and has no
 * implementation. A successor with product/shared-path and production-data
 * authority must review the SQL proposal, allocate a migration, and provide a
 * repository implementation before any row can be written.
 */

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
  providerLocationId: string;
  providerCampaignId: string | null;
  providerWorkflowId: string;
  providerLaunchTagId: string;
}

export interface GovernedCampaignAudienceDecisionInput {
  decisionKey: string;
  providerContactId: string;
  contactKey: string | null;
  decision: GovernedCampaignAudienceDecision;
  primaryReason: GovernedCampaignAudienceReason;
  reasonCodes: readonly GovernedCampaignAudienceReason[];
  /** Sanitized booleans, enums, counts, timestamps, and hashes only; never PII. */
  sourceFacts: Readonly<Record<string, boolean | number | string | null>>;
  decisionVersion: number;
}

export interface ReconcileGovernedCampaignAudienceRequest {
  accountKey: string;
  productKey: string;
  campaignKey: string;
  binding: GovernedCampaignProviderBinding;
  idempotencyKey: string;
  requestHash: string;
  snapshotHash: string;
  sourceObservedAt: string;
  createdByUserKey: string;
  expectedDecisionRows: number;
  /**
   * Hard SQL row-effect ceiling supplied by a fresh successor authority.
   * It counts inserted decision rows plus rows marked superseded.
   */
  maximumAffectedRows: number;
  decisions: readonly GovernedCampaignAudienceDecisionInput[];
}

export interface GovernedCampaignAudienceReasonCount {
  decision: GovernedCampaignAudienceDecision;
  primaryReason: GovernedCampaignAudienceReason;
  rows: number;
}

export interface ReconcileGovernedCampaignAudienceResult {
  campaignKey: string;
  snapshotHash: string;
  requestHash: string;
  replayed: boolean;
  insertedRows: number;
  supersededRows: number;
  affectedRows: number;
  currentRows: number;
  currentProjectionHash: string;
  reasonCounts: readonly GovernedCampaignAudienceReasonCount[];
  rawContactPiiIncluded: false;
  providerEffects: 0;
}

export interface GovernedCampaignAudienceDecisionStoreProposal {
  /**
   * Required transaction algorithm:
   *
   * 1. Reject malformed hashes, duplicate providerContactIds, PII-bearing
   *    sourceFacts, a request count mismatch, or a negative effect ceiling.
   * 2. Begin one database transaction and acquire a campaign-scoped advisory
   *    lock for accountKey + productKey + campaignKey.
   * 3. Under that lock, read the exact current projection and any rows carrying
   *    idempotencyKey. A replay is valid only when requestHash, snapshotHash,
   *    row count, and the canonical decision digest all match.
   * 4. Calculate supersededRows + insertedRows before writing. Roll back when
   *    the value exceeds maximumAffectedRows. This check makes a zero-row
   *    authority incapable of writing even one row.
   * 5. Mark only the replaced current rows superseded, then insert the new
   *    immutable decision versions. Never update a historical decision body.
   * 6. Read the current projection back in the same transaction. Require exact
   *    current row count, per-reason counts, snapshotHash, and canonical
   *    projection hash. Roll back on every mismatch or unknown result.
   * 7. Commit only after readback succeeds; return the exact SQL effect counts.
   */
  reconcile(
    request: ReconcileGovernedCampaignAudienceRequest,
  ): Promise<ReconcileGovernedCampaignAudienceResult>;
}
