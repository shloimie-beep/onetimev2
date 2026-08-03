import { describe, expect, it, vi } from 'vitest';
import { planGhlIdentitySync } from '../../../../domain/src/communications/ghl-identity/index.ts';
import { createPostgresGhlIdentityRepository, type GhlIdentitySqlClient } from './index.ts';

const h = (value: string) => value.repeat(64).slice(0, 64);

describe('P27 parameterized repository', () => {
  it('persists identity and household projection transactionally with parameters', async () => {
    const calls: { text: string; values: readonly unknown[] }[] = [];
    const client: GhlIdentitySqlClient = {
      query: vi.fn(async (text: string, values: readonly unknown[] = []) => {
        calls.push({ text, values });
        return { rows: [], rowCount: text === 'BEGIN' || text === 'COMMIT' ? null : 1 };
      }),
      release: vi.fn(),
    };
    const repository = createPostgresGhlIdentityRepository({
      connect: async () => client,
    });
    const plan = planGhlIdentitySync({
      operation_id: 'signup-1',
      local_commit_id: 'commit-1',
      local_commit_state: 'committed',
      subject: { kind: 'adult', adult_id: 'adult-1', normalized_email_hash: h('a') },
      household: {
        household_id: 'household-1',
        classification: 'family',
        lifecycle_state: 'one_time_family_signup',
        access_projection: 'free',
        stripe_customer_ref_hash: null,
        service_reminders_enabled: true,
        source_evidence_digest: h('b'),
        policy_consent_evidence_digest: h('c'),
      },
      contact_evidence: {
        verified_contact_ref_hash: h('d'),
        verified_contact_email_hash: h('a'),
        exact_email_match_ref_hashes: [h('d')],
        marketing_suppressed: false,
        service_suppressed: false,
        suppression_evidence_digest: h('e'),
      },
      segment_facts: {
        approved_active_legacy_segment: false,
        has_active_membership: false,
        former_or_canceled: true,
        explicit_marketing_opt_in: false,
      },
    });
    expect(await repository.persistPlan(plan, 0)).toBe(true);
    expect(calls.map(({ text }) => text.trim())).toEqual(
      expect.arrayContaining(['BEGIN', 'COMMIT']),
    );
    expect(calls.filter(({ text }) => text.includes('INSERT INTO'))).toHaveLength(2);
    expect(calls.every(({ text }) => !text.includes('CREATE TABLE'))).toBe(true);
    expect(
      calls
        .filter(({ text }) => text.includes('INSERT INTO'))
        .every(({ values }) => values.length > 0),
    ).toBe(true);
  });
});
