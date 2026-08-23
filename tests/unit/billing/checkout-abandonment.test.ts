import { describe, expect, it } from 'vitest';

import {
  deriveOt03CheckoutAbandonmentIntents,
  type Ot03CheckoutCandidate,
} from '../../../packages/domain/src/billing/checkout-abandonment.ts';

const candidate: Ot03CheckoutCandidate = {
  checkout_request_key: 'checkout-request-1',
  account_key: 'one_time',
  product_key: 'one_time_mishnayos',
  household_key: 'household-1',
  adult_id: 'adult-1',
  checkout_status: 'session_created',
  checkout_started_at: '2026-08-05T00:00:00.000Z',
  request_fingerprint: 'f'.repeat(64),
};

describe('OT-03 checkout abandonment source events', () => {
  it('creates no checkpoint before the exact two-hour boundary', () => {
    expect(deriveOt03CheckoutAbandonmentIntents(candidate, '2026-08-05T01:59:59.999Z')).toEqual([]);
  });

  it('creates the first deterministic adult-only checkpoint at two hours', () => {
    const [intent] = deriveOt03CheckoutAbandonmentIntents(candidate, '2026-08-05T02:00:00.000Z');
    expect(intent).toMatchObject({
      workflow_key: 'OT-03',
      checkpoint: 'after_2h',
      checkpoint_hours: 2,
      due_at: '2026-08-05T02:00:00.000Z',
      subject_kind: 'adult_household',
      local_episode_evidence: true,
      local_commit_readback: true,
      student_contact_allowed: false,
      provider_financial_mutation: false,
      provider_access_mutation: false,
      binding_state: 'pending_external_binding',
    });
    expect(intent?.intent_key).toMatch(/^[a-f0-9]{64}$/);
    expect(intent?.episode_key).toMatch(/^[a-f0-9]{64}$/);
    expect(intent?.source_event_digest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('creates both checkpoints when the first observation occurs at 24 hours', () => {
    const intents = deriveOt03CheckoutAbandonmentIntents(candidate, '2026-08-06T00:00:00.000Z');
    expect(intents.map(({ checkpoint }) => checkpoint)).toEqual(['after_2h', 'after_24h']);
    expect(new Set(intents.map(({ episode_key }) => episode_key))).toHaveLength(1);
    expect(new Set(intents.map(({ intent_key }) => intent_key))).toHaveLength(2);
  });

  it('keeps an expired session eligible and rejects completed source state', () => {
    const expired = deriveOt03CheckoutAbandonmentIntents(
      { ...candidate, checkout_status: 'expired' },
      '2026-08-06T00:00:00.000Z',
    );
    expect(expired.map(({ checkpoint }) => checkpoint)).toEqual(['after_2h', 'after_24h']);

    const first = deriveOt03CheckoutAbandonmentIntents(candidate, '2026-08-06T00:00:00.000Z');
    const replay = deriveOt03CheckoutAbandonmentIntents(candidate, '2026-08-06T00:00:00.000Z');
    expect(replay).toEqual(first);
    expect(() =>
      deriveOt03CheckoutAbandonmentIntents(
        { ...candidate, checkout_status: 'completed' as never },
        '2026-08-06T00:00:00.000Z',
      ),
    ).toThrow('ot03_checkout_status_must_be_abandoned');
  });
});
