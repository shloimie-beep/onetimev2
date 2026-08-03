import { createHash } from 'node:crypto';
import type {
  GhlIdentityIntent,
  GhlIdentityReviewCase,
  GhlIdentitySyncPlan,
  PlanGhlIdentitySyncInput,
} from '../../../../contracts/src/communications/ghl-identity/index.ts';
import { resolveGhlIdentityLink } from '../../providers/shared/mapping.ts';
import { classifyGhlAdult } from './classification.ts';
import { GhlIdentityError } from './errors.ts';

const SAFE_OPAQUE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function planGhlIdentitySync(input: PlanGhlIdentitySyncInput): GhlIdentitySyncPlan {
  if (input.subject.kind === 'student') {
    throw new GhlIdentityError(
      'student_contact_prohibited',
      'Student identities can never produce a HighLevel contact intent.',
    );
  }
  if (input.local_commit_state !== 'committed') {
    throw new GhlIdentityError(
      'local_commit_required',
      'GHL synchronization starts only after the local signup transaction commits.',
    );
  }
  assertOpaque(input.operation_id, 'operation_id');
  assertOpaque(input.local_commit_id, 'local_commit_id');
  assertOpaque(input.household.household_id, 'household_id');
  const intentIds = [
    `${input.operation_id}:adult-contact`,
    `${input.operation_id}:household:${input.household.household_id}`,
  ];
  const link = resolveGhlIdentityLink({
    adult_id: input.subject.adult_id,
    normalized_email_hash: input.subject.normalized_email_hash,
    verified_contact_ref_hash: input.contact_evidence.verified_contact_ref_hash,
    verified_contact_email_hash: input.contact_evidence.verified_contact_email_hash,
    exact_email_match_ref_hashes: input.contact_evidence.exact_email_match_ref_hashes,
    outbox_intent_ids: intentIds,
    marketing_suppressed: input.contact_evidence.marketing_suppressed,
    service_suppressed: input.contact_evidence.service_suppressed,
    suppression_evidence_digest: input.contact_evidence.suppression_evidence_digest,
  });
  const classification = classifyGhlAdult(link, input.segment_facts);
  const review = makeReviewCase(input, input.subject.adult_id, link, classification, intentIds);
  const contactRef = link.verified_contact_ref_hash;
  const household = { ...input.household, owner_adult_id: input.subject.adult_id };
  const intents: GhlIdentityIntent[] =
    review === null
      ? [
          {
            kind: 'adult_contact_upsert',
            intent_id: intentIds[0]!,
            adult_id: input.subject.adult_id,
            normalized_email_hash: input.subject.normalized_email_hash,
            contact_ref_hash: contactRef,
            preserve_suppression: true,
          },
          {
            kind: 'household_projection_upsert',
            intent_id: intentIds[1]!,
            household,
            contact_ref_hash: contactRef,
          },
        ]
      : [];
  return {
    operation_id: input.operation_id,
    local_commit_id: input.local_commit_id,
    local_result_durable: true,
    provider_failure_rolls_back_local_result: false,
    identity_link: link,
    adult_classification: classification,
    household,
    review_case: review,
    intents,
    student_contact_prohibited: true,
  };
}

function makeReviewCase(
  input: PlanGhlIdentitySyncInput,
  adultId: string,
  link: GhlIdentitySyncPlan['identity_link'],
  classification: GhlIdentitySyncPlan['adult_classification'],
  intentIds: readonly string[],
): GhlIdentityReviewCase | null {
  if (link.state !== 'identity_review' && classification !== 'review') return null;
  const reason =
    link.candidate_contact_ref_hashes.length > 1
      ? 'multiple_exact_email_matches'
      : link.state === 'identity_review'
        ? 'provider_email_disagreement'
        : 'classification_review';
  return {
    review_id: digest(`${input.operation_id}:${adultId}`),
    adult_id: adultId,
    household_id: input.household.household_id,
    candidate_contact_ref_hashes: link.candidate_contact_ref_hashes,
    quarantined_intent_ids: [...intentIds],
    visible_to_admin: true,
    safe_reason: reason,
  };
}

function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function assertOpaque(value: string, field: string): void {
  if (!SAFE_OPAQUE.test(value) || /(?:@|token|secret|bearer|password)/i.test(value)) {
    throw new GhlIdentityError('invalid_contract', `${field} must be a safe opaque value.`);
  }
}
