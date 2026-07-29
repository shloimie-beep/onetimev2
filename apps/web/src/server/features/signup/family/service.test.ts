import { describe, expect, it } from 'vitest';
import type { FamilySignupCommand } from '../../../../../../../packages/contracts/src/signup/family/index.ts';
import { createFamilySignupService, type FamilySignupRepository } from './service.ts';

const h = (value: string) => value.repeat(64);
const command = (): FamilySignupCommand => ({
  classification: 'family',
  idempotency_key: 'signup_request_1',
  canonical_request_hash: h('a'),
  first_name: 'Ari',
  last_name: 'Levi',
  email: 'ari@example.com',
  password: 'correct horse battery staple',
  timezone: 'Asia/Jerusalem',
  terms_accepted: true,
  privacy_accepted: true,
});

describe('P08 family signup service', () => {
  it('commits identity, access, credential, and durable outbox in one local transaction', async () => {
    const commits: unknown[] = [];
    const repository: FamilySignupRepository = {
      transaction: async (run) =>
        run({
          findRequest: async () => null,
          findIdentity: async () => null,
          readGhlEvidence: async () => ({
            verified_contact_ref_hash: null,
            verified_contact_email_hash: null,
            exact_email_match_ref_hashes: [],
            marketing_suppressed: false,
            service_suppressed: false,
            suppression_evidence_digest: h('b'),
          }),
          commit: async (value) => {
            commits.push(value);
          },
        }),
    };
    const service = createFamilySignupService({
      repository,
      hashPassword: async () => 'argon2id-safe-hash',
      normalizeEmail: (email) => email.trim().toLowerCase(),
      allocateIds: () => ({
        adult_id: 'adult_1',
        human_account_id: 'account_1',
        household_id: 'household_1',
      }),
    });
    const result = await service.submit({
      scope: {
        product: 'one_time_mishnayos',
        runtime_tier: 'isolated_staging',
        verification_environment_id: 'ci',
      },
      command: command(),
      now: new Date('2026-09-13T16:23:59.000Z'),
    });
    expect(result.next_action).toBe('signed_in');
    expect(commits).toHaveLength(1);
    expect(commits[0]).toMatchObject({
      password_hash: 'argon2id-safe-hash',
      outbox_intents: [{ local_commit_required: true }],
    });
    expect(JSON.stringify(commits[0])).not.toContain('correct horse');
    expect(result.provider_effects_completed_inline).toBe(0);
  });

  it('returns a durable recovered result without another commit or password hash', async () => {
    const priorResult = {
      disposition: 'created' as const,
      projection: null,
      next_action: 'checkout' as const,
      setup_email_required: false as const,
      provider_effects_completed_inline: 0 as const,
      outbox_intent_ids: ['signup_request_1:ghl-sync'],
      safe_message: 'Your account is ready. Continue to checkout.',
    };
    let commits = 0;
    let hashes = 0;
    const service = createFamilySignupService({
      repository: {
        transaction: async (run) =>
          run({
            findRequest: async () => ({
              idempotency_key: 'signup_request_1',
              canonical_request_hash: h('a'),
              result: priorResult,
              outbox_intents: [],
            }),
            findIdentity: async () => null,
            readGhlEvidence: async () => ({
              verified_contact_ref_hash: null,
              verified_contact_email_hash: null,
              exact_email_match_ref_hashes: [],
              marketing_suppressed: false,
              service_suppressed: false,
              suppression_evidence_digest: h('b'),
            }),
            commit: async () => {
              commits += 1;
            },
          }),
      },
      hashPassword: async () => {
        hashes += 1;
        return 'unused';
      },
      normalizeEmail: (email) => email,
      allocateIds: () => ({
        adult_id: 'new_adult',
        human_account_id: 'new_account',
        household_id: 'new_household',
      }),
    });
    const result = await service.submit({
      scope: {
        product: 'one_time_mishnayos',
        runtime_tier: 'isolated_staging',
        verification_environment_id: 'ci',
      },
      command: command(),
      now: new Date(),
    });
    expect(result.disposition).toBe('recovered');
    expect(commits).toBe(0);
    expect(hashes).toBe(0);
  });
});
