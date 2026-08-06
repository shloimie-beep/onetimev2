import { createHash } from 'node:crypto';

export const OT03_CHECKOUT_ABANDONMENT_TRIGGER =
  'checkout started and not completed within the registered wait window' as const;
export const OT03_CHECKOUT_ABANDONMENT_EVENT_TYPE =
  'billing.checkout_abandonment_checkpoint.v1' as const;

export const OT03_CHECKOUT_ABANDONMENT_CHECKPOINTS = [
  { checkpoint: 'after_2h', hours: 2 },
  { checkpoint: 'after_24h', hours: 24 },
] as const;

export type Ot03CheckoutAbandonmentCheckpoint =
  (typeof OT03_CHECKOUT_ABANDONMENT_CHECKPOINTS)[number]['checkpoint'];

export type Ot03CheckoutCandidate = {
  checkout_request_key: string;
  account_key: string;
  product_key: string;
  household_key: string;
  adult_id: string;
  checkout_status: 'started' | 'session_created' | 'expired';
  checkout_started_at: string;
  request_fingerprint: string;
};

export type Ot03CheckoutAbandonmentIntent = {
  intent_key: string;
  checkout_request_key: string;
  account_key: string;
  product_key: string;
  household_key: string;
  adult_id: string;
  subject_kind: 'adult_household';
  workflow_key: 'OT-03';
  event_type: typeof OT03_CHECKOUT_ABANDONMENT_EVENT_TYPE;
  trigger: typeof OT03_CHECKOUT_ABANDONMENT_TRIGGER;
  checkpoint: Ot03CheckoutAbandonmentCheckpoint;
  checkpoint_hours: 2 | 24;
  source_event_digest: string;
  episode_key: string;
  checkout_started_at: string;
  due_at: string;
  observed_at: string;
  local_episode_evidence: true;
  local_commit_readback: true;
  student_contact_allowed: false;
  provider_financial_mutation: false;
  provider_access_mutation: false;
  binding_state: 'pending_external_binding';
};

export function deriveOt03CheckoutAbandonmentIntents(
  candidate: Ot03CheckoutCandidate,
  observedAt: string,
): readonly Ot03CheckoutAbandonmentIntent[] {
  assertNonempty(candidate.checkout_request_key, 'checkout_request_key');
  assertNonempty(candidate.account_key, 'account_key');
  assertNonempty(candidate.product_key, 'product_key');
  assertNonempty(candidate.household_key, 'household_key');
  assertNonempty(candidate.adult_id, 'adult_id');
  assertNonempty(candidate.request_fingerprint, 'request_fingerprint');
  if (!['started', 'session_created', 'expired'].includes(candidate.checkout_status)) {
    throw new Error('ot03_checkout_status_must_be_abandoned');
  }

  const started = parseDate(candidate.checkout_started_at, 'checkout_started_at');
  const observed = parseDate(observedAt, 'observed_at');
  const episodeKey = digest([
    'ot03-checkout-episode-v1',
    candidate.checkout_request_key,
    candidate.account_key,
    candidate.product_key,
    candidate.household_key,
    candidate.adult_id,
    started.toISOString(),
  ]);
  const sourceEventDigest = digest([
    'ot03-checkout-source-v1',
    candidate.checkout_request_key,
    candidate.request_fingerprint,
    candidate.checkout_status,
    started.toISOString(),
  ]);

  return OT03_CHECKOUT_ABANDONMENT_CHECKPOINTS.flatMap(({ checkpoint, hours }) => {
    const due = new Date(started.getTime() + hours * 60 * 60 * 1_000);
    if (observed.getTime() < due.getTime()) return [];
    return [
      {
        intent_key: digest(['ot03-checkout-intent-v1', episodeKey, checkpoint]),
        checkout_request_key: candidate.checkout_request_key,
        account_key: candidate.account_key,
        product_key: candidate.product_key,
        household_key: candidate.household_key,
        adult_id: candidate.adult_id,
        subject_kind: 'adult_household',
        workflow_key: 'OT-03',
        event_type: OT03_CHECKOUT_ABANDONMENT_EVENT_TYPE,
        trigger: OT03_CHECKOUT_ABANDONMENT_TRIGGER,
        checkpoint,
        checkpoint_hours: hours,
        source_event_digest: sourceEventDigest,
        episode_key: episodeKey,
        checkout_started_at: started.toISOString(),
        due_at: due.toISOString(),
        observed_at: observed.toISOString(),
        local_episode_evidence: true,
        local_commit_readback: true,
        student_contact_allowed: false,
        provider_financial_mutation: false,
        provider_access_mutation: false,
        binding_state: 'pending_external_binding',
      },
    ];
  });
}

function digest(parts: readonly string[]) {
  return createHash('sha256').update(parts.join('\u001f')).digest('hex');
}

function assertNonempty(value: string, field: string) {
  if (!value.trim()) throw new Error(`ot03_${field}_required`);
}

function parseDate(value: string, field: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`ot03_${field}_invalid`);
  return parsed;
}
