import type { AdultGhlIdentityLink } from '../../providers/v21-provider-core.ts';

export const GHL_IDENTITY_CONTRACT_VERSION = '1.0.0';

export const GHL_ADULT_CLASSIFICATIONS = [
  'active_legacy',
  'former_canceled',
  'opted_in_lead',
  'suppressed',
  'review',
] as const;
export type GhlAdultClassification = (typeof GHL_ADULT_CLASSIFICATIONS)[number];

export type GhlIdentitySubject =
  | {
      kind: 'adult';
      adult_id: string;
      normalized_email_hash: string;
    }
  | {
      kind: 'student';
      student_id: string;
      household_id: string;
    };

export interface GhlAdultSegmentFacts {
  approved_active_legacy_segment: boolean;
  has_active_membership: boolean;
  former_or_canceled: boolean;
  explicit_marketing_opt_in: boolean;
}

export interface GhlContactEvidence {
  verified_contact_ref_hash: string | null;
  verified_contact_email_hash: string | null;
  exact_email_match_ref_hashes: readonly string[];
  marketing_suppressed: boolean;
  service_suppressed: boolean;
  suppression_evidence_digest: string;
}

export interface GhlHouseholdProjection {
  household_id: string;
  owner_adult_id: string;
  classification: 'family' | 'school' | 'complimentary';
  lifecycle_state: string;
  access_projection: 'free' | 'active' | 'grace' | 'inactive' | 'none';
  stripe_customer_ref_hash: string | null;
  service_reminders_enabled: boolean;
  source_evidence_digest: string;
  policy_consent_evidence_digest: string;
}

export type GhlIdentityIntent =
  | {
      kind: 'adult_contact_upsert';
      intent_id: string;
      adult_id: string;
      normalized_email_hash: string;
      contact_ref_hash: string | null;
      preserve_suppression: true;
    }
  | {
      kind: 'household_projection_upsert';
      intent_id: string;
      household: GhlHouseholdProjection;
      contact_ref_hash: string | null;
    };

export interface GhlIdentityReviewCase {
  review_id: string;
  adult_id: string;
  household_id: string;
  candidate_contact_ref_hashes: readonly string[];
  quarantined_intent_ids: readonly string[];
  visible_to_admin: true;
  safe_reason:
    'provider_email_disagreement' | 'multiple_exact_email_matches' | 'classification_review';
}

export interface GhlIdentitySyncPlan {
  operation_id: string;
  local_commit_id: string;
  local_result_durable: true;
  provider_failure_rolls_back_local_result: false;
  identity_link: AdultGhlIdentityLink;
  adult_classification: GhlAdultClassification;
  household: GhlHouseholdProjection;
  review_case: GhlIdentityReviewCase | null;
  intents: readonly GhlIdentityIntent[];
  student_contact_prohibited: true;
}

export interface PlanGhlIdentitySyncInput {
  operation_id: string;
  local_commit_id: string;
  local_commit_state: 'committed' | 'not_committed';
  subject: GhlIdentitySubject;
  household: Omit<GhlHouseholdProjection, 'owner_adult_id'>;
  contact_evidence: GhlContactEvidence;
  segment_facts: GhlAdultSegmentFacts;
}

export interface GhlIdentityPlanRepository {
  persistPlan(plan: GhlIdentitySyncPlan, expected_version: number): Promise<boolean>;
  markRetry(input: {
    operation_id: string;
    expected_version: number;
    safe_error_code: string;
  }): Promise<boolean>;
}
