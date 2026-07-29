import { describe, expect, it } from 'vitest';
import {
  FAMILY_SIGNUP_OPERATION,
  type FamilySignupCommand,
  type FamilySignupResult,
  type FamilySignupScope,
} from '../../../../../../../packages/contracts/src/signup/family/index.ts';
import { canonicalizeFamilySignupRequest } from '../../../../../../../packages/domain/src/signup/family/index.ts';
import {
  createFamilySignupService,
  type FamilySignupRepository,
  type FamilySignupTransaction,
} from './service.ts';

const h = (value: string) => value.repeat(64);
const scope: FamilySignupScope = {
  product: 'one_time_mishnayos',
  runtime_tier: 'isolated_staging',
  verification_environment_id: 'ci',
};
const idempotencyKey = '1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefg';
const command = (): FamilySignupCommand => ({
  classification: 'family',
  idempotency_key: idempotencyKey,
  first_name: 'Ari',
  last_name: 'Levi',
  email: 'ari@example.com',
  password: 'correct horse battery staple',
  timezone: 'Asia/Jerusalem',
  terms_accepted: true,
  privacy_accepted: true,
});
const ghlEvidence = () => ({
  verified_contact_ref_hash: null,
  verified_contact_email_hash: null,
  exact_email_match_ref_hashes: [],
  marketing_suppressed: false,
  service_suppressed: false,
  suppression_evidence_digest: h('b'),
});

describe('P08 family signup service', () => {
  it('binds all reads, receipt, commit, and outbox to the server-computed request', async () => {
    const calls: Array<{ kind: string; value: unknown }> = [];
    const repository: FamilySignupRepository = {
      transaction: async (run) =>
        run({
          findRequest: async (value) => {
            calls.push({ kind: 'request', value });
            return null;
          },
          readLocalState: async (value) => {
            calls.push({ kind: 'identity', value });
            return { identity: null, household: null };
          },
          readGhlEvidence: async (value) => {
            calls.push({ kind: 'ghl', value });
            return ghlEvidence();
          },
          commit: async (value) => {
            calls.push({ kind: 'commit', value });
          },
        }),
    };
    const service = createFamilySignupService({
      repository,
      hashPassword: async () => 'argon2id-safe-hash',
      fingerprintPasswordForIdempotency: async () => h('a'),
      allocateIds: () => ({
        adult_id: 'adult_1',
        human_account_id: 'account_1',
        household_id: 'household_1',
      }),
    });
    const result = await service.submit({
      scope,
      command: command(),
      now: new Date('2026-09-13T16:23:59.000Z'),
    });
    expect(result.next_action).toBe('signed_in');
    expect(calls.map(({ kind }) => kind)).toEqual(['request', 'identity', 'ghl', 'commit']);
    expect(calls[0]?.value).toEqual({
      scope,
      operation: FAMILY_SIGNUP_OPERATION,
      idempotency_key: idempotencyKey,
    });
    expect(calls[1]?.value).toEqual({
      scope,
      operation: FAMILY_SIGNUP_OPERATION,
      normalized_email: 'ari@example.com',
    });
    expect(calls[2]?.value).toMatchObject({ scope, operation: FAMILY_SIGNUP_OPERATION });
    expect(calls[3]?.value).toMatchObject({
      password_hash: 'argon2id-safe-hash',
      request_binding: {
        scope,
        operation: FAMILY_SIGNUP_OPERATION,
        idempotency_key: idempotencyKey,
        canonical_request_digest: expect.stringMatching(/^[a-f0-9]{64}$/u),
      },
      receipt: {
        request_binding: {
          scope,
          operation: FAMILY_SIGNUP_OPERATION,
        },
      },
      outbox_intents: [
        {
          request_binding: {
            scope,
            operation: FAMILY_SIGNUP_OPERATION,
          },
          local_commit_required: true,
        },
      ],
    });
    expect(JSON.stringify(calls[3]?.value)).not.toContain('correct horse');
    expect(result.provider_effects_completed_inline).toBe(0);
  });

  it('performs no household, access, credential, outbox, or session write for any account state', async () => {
    for (const humanAccountState of ['invited', 'active', 'disabled', 'archived'] as const) {
      const counts = { ghl: 0, commit: 0, password: 0, ids: 0 };
      const service = createFamilySignupService({
        repository: repositoryFor({
          readLocalState: async () => ({
            identity: {
              adult_id: `adult_${humanAccountState}`,
              human_account_id: `account_${humanAccountState}`,
              normalized_email: 'ari@example.com',
              human_account_state: humanAccountState,
            },
            household: null,
          }),
          readGhlEvidence: async () => {
            counts.ghl += 1;
            return ghlEvidence();
          },
          commit: async () => {
            counts.commit += 1;
          },
        }),
        hashPassword: async () => {
          counts.password += 1;
          return 'unused';
        },
        fingerprintPasswordForIdempotency: async () => h('a'),
        allocateIds: () => {
          counts.ids += 1;
          return { adult_id: 'new', human_account_id: 'new', household_id: 'new' };
        },
      });
      const result = await service.submit({ scope, command: command(), now: new Date() });
      expect(result).toMatchObject({
        disposition: 'existing_account',
        projection: null,
        next_action: 'sign_in_or_reset',
        outbox_intent_ids: [],
      });
      expect(counts).toEqual({ ghl: 0, commit: 0, password: 0, ids: 0 });
    }
  });

  it('rejects inactive as well as active household duplicates with zero writes', async () => {
    for (const lifecycleState of ['active', 'expired', 'archived', 'inactive'] as const) {
      let writes = 0;
      const service = createFamilySignupService({
        repository: repositoryFor({
          readLocalState: async () => ({
            identity: null,
            household: {
              household_id: `household_${lifecycleState}`,
              lifecycle_state: lifecycleState,
            },
          }),
          commit: async () => {
            writes += 1;
          },
        }),
        hashPassword: async () => {
          writes += 1;
          return 'unused';
        },
        fingerprintPasswordForIdempotency: async () => h('a'),
        allocateIds: () => {
          writes += 1;
          return { adult_id: 'new', human_account_id: 'new', household_id: 'new' };
        },
      });
      const result = await service.submit({ scope, command: command(), now: new Date() });
      expect(result.disposition).toBe('existing_account');
      expect(writes).toBe(0);
    }
  });

  it('recovers exact retries and rejects changed fields, password, and cross-scope replay', async () => {
    const original = command();
    const binding = canonicalizeFamilySignupRequest(scope, original, h('a')).request_binding;
    const priorResult: FamilySignupResult = {
      disposition: 'created',
      projection: {
        adult_id: 'private_adult_id',
        human_account_id: 'private_account_id',
        household_id: 'private_household_id',
        normalized_email: 'private@example.com',
        access_branch: 'inactive_checkout',
        access_state: 'inactive',
        seat_limit: 3,
        active_seat_count: 0,
        free_access_expires_at: null,
        checkout_required: true,
        rolling_trial_granted: false,
        card_collected: false,
      },
      next_action: 'checkout',
      setup_email_required: false,
      provider_effects_completed_inline: 0,
      outbox_intent_ids: [],
      safe_message: 'Your account is ready. Continue to checkout.',
    };
    const repository = repositoryFor({
      findRequest: async () => ({
        receipt: { request_binding: binding, result: priorResult, outbox_intents: [] },
      }),
      readLocalState: async () => {
        throw new Error('identity lookup must not run for a prior request');
      },
    });
    const service = createFamilySignupService({
      repository,
      hashPassword: async () => {
        throw new Error('password hash must not run for replay');
      },
      fingerprintPasswordForIdempotency: async (password) =>
        password === original.password ? h('a') : h('c'),
      allocateIds: () => {
        throw new Error('id allocation must not run for replay');
      },
    });
    await expect(
      service.submit({ scope, command: original, now: new Date() }),
    ).resolves.toMatchObject({ disposition: 'recovered' });

    const changedRequests: Array<{ scope: FamilySignupScope; command: FamilySignupCommand }> = [
      { scope, command: { ...original, email: 'other@example.com' } },
      { scope, command: { ...original, first_name: 'Aharon' } },
      { scope, command: { ...original, timezone: 'UTC' } },
      { scope, command: { ...original, password: 'different secure password phrase' } },
      {
        scope: {
          product: 'one_time_mishnayos',
          runtime_tier: 'production',
          verification_environment_id: 'production_read_only',
        },
        command: original,
      },
    ];
    for (const changed of changedRequests) {
      let thrown: unknown;
      try {
        await service.submit({ ...changed, now: new Date() });
      } catch (error) {
        thrown = error;
      }
      expect(String(thrown)).toContain('idempotency_conflict');
      expect(String(thrown)).not.toContain('private_');
      expect(String(thrown)).not.toContain('private@example.com');
    }
  });

  it('rejects weak keys and spoofed caller hashes before repository access', async () => {
    let externalCalls = 0;
    const service = createFamilySignupService({
      repository: {
        transaction: async () => {
          externalCalls += 1;
          throw new Error('must not start transaction');
        },
      },
      hashPassword: async () => {
        externalCalls += 1;
        return 'unused';
      },
      fingerprintPasswordForIdempotency: async () => {
        externalCalls += 1;
        return h('a');
      },
      allocateIds: () => {
        externalCalls += 1;
        return { adult_id: 'new', human_account_id: 'new', household_id: 'new' };
      },
    });
    const shortKey = command();
    shortKey.idempotency_key = 'short';
    await expect(service.submit({ scope, command: shortKey, now: new Date() })).rejects.toThrow(
      'invalid_family_signup',
    );
    const spoofed = command() as FamilySignupCommand & { canonical_request_hash: string };
    spoofed.canonical_request_hash = h('f');
    await expect(service.submit({ scope, command: spoofed, now: new Date() })).rejects.toThrow(
      'invalid_family_signup',
    );
    expect(externalCalls).toBe(0);
  });
});

function repositoryFor(overrides: Partial<FamilySignupTransaction>): FamilySignupRepository {
  return {
    transaction: async (run) =>
      run({
        findRequest: async () => null,
        readLocalState: async () => ({ identity: null, household: null }),
        readGhlEvidence: async () => ghlEvidence(),
        commit: async () => undefined,
        ...overrides,
      }),
  };
}
