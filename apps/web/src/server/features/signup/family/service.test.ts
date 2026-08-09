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
const freeAccessExpiresAt = '2026-09-11T15:00:00.000Z';
const command = (): FamilySignupCommand => ({
  classification: 'family',
  idempotency_key: idempotencyKey,
  first_name: 'Ari',
  last_name: 'Levi',
  email: 'ari@example.com',
  password: 'correct horse battery staple',
  password_confirmation: 'correct horse battery staple',
  timezone: 'Asia/Jerusalem',
  terms_accepted: true,
  privacy_accepted: true,
  general_marketing_consent: false,
  parent_newsletter_consent: true,
});
const ghlEvidence = () => ({
  status: 'available' as const,
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
      freeAccessExpiresAt,
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
      now: new Date('2026-09-11T14:59:59.000Z'),
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
      request: {
        timezone: 'Asia/Jerusalem',
        general_marketing_consent: false,
        parent_newsletter_consent: true,
      },
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
          adult_consent_choices: {
            general_marketing: false,
            parent_newsletter: true,
          },
          dispatch_state: 'ready',
          local_commit_required: true,
          ghl_handoff: {
            target: 'p27_ghl_identity_sync',
            subject: { kind: 'adult' },
            provider_effect_authorized: false,
            message_delivery_authorized: false,
            billing_effect_authorized: false,
            student_contact_prohibited: true,
          },
        },
      ],
      commercial_billing: {
        signup: {
          resulting_version: 1,
          response: { projection: { accessState: 'free' } },
          outbox_intents: [],
        },
        checkout: null,
      },
      ghl_evidence_status: 'available',
      committed_at: '2026-09-11T14:59:59.000Z',
    });
    expect(JSON.stringify(calls[3]?.value)).not.toContain('correct horse');
    expect(JSON.stringify(calls[3]?.value)).not.toContain('password_confirmation');
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
        checkout_blocked_by_identity_review: false,
        rolling_trial_granted: false,
        card_collected: false,
      },
      next_action: 'checkout',
      setup_email_required: false,
      provider_effects_completed_inline: 0,
      outbox_intent_ids: [],
      ghl_handoff_state: 'ready',
      checkout_handoff_state: 'queued',
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
      { scope, command: { ...original, timezone: 'Europe/London' } },
      {
        scope,
        command: {
          ...original,
          password: 'different secure password phrase',
          password_confirmation: 'different secure password phrase',
        },
      },
      { scope, command: { ...original, general_marketing_consent: true } },
      { scope, command: { ...original, parent_newsletter_consent: false } },
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

  it('provides a support path after expiry when no approved GHL payment link is configured', async () => {
    const commits: unknown[] = [];
    const service = createFamilySignupService({
      repository: repositoryFor({
        commit: async (value) => {
          commits.push(value);
        },
      }),
      freeAccessExpiresAt,
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
      now: new Date('2026-09-11T15:00:00.000Z'),
    });

    expect(result).toMatchObject({
      next_action: 'support',
      projection: {
        access_branch: 'inactive_support',
        access_state: 'inactive',
        checkout_required: false,
        checkout_blocked_by_identity_review: false,
      },
      checkout_handoff_state: 'not_configured',
      safe_message: expect.stringContaining('info@onetimeonetime.com'),
    });
    expect(commits[0]).toMatchObject({ commercial_billing: { checkout: null } });
  });

  it('commits an inactive account but blocks post-expiry Checkout during identity review', async () => {
    const commits: unknown[] = [];
    const service = createFamilySignupService({
      repository: repositoryFor({
        readGhlEvidence: async () => ({
          ...ghlEvidence(),
          exact_email_match_ref_hashes: [h('c'), h('d')],
        }),
        commit: async (value) => {
          commits.push(value);
        },
      }),
      freeAccessExpiresAt,
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
      now: new Date('2026-09-11T15:00:00.000Z'),
    });
    expect(result).toMatchObject({
      next_action: 'identity_review',
      projection: {
        access_branch: 'inactive_identity_review',
        access_state: 'inactive',
        checkout_required: false,
        checkout_blocked_by_identity_review: true,
      },
    });
    expect(commits).toHaveLength(1);
    expect(commits[0]).toMatchObject({
      ghl_identity_state: 'identity_review',
      ghl_evidence_status: 'available',
      outbox_intents: [{ dispatch_state: 'identity_review' }],
      commercial_billing: { checkout: null },
    });
  });

  it('commits local free access while missing GHL evidence requires downstream readback', async () => {
    const commits: unknown[] = [];
    const service = createFamilySignupService({
      repository: repositoryFor({
        readGhlEvidence: async () => ({
          status: 'evidence_unavailable',
          safe_reason: 'evidence_unavailable',
        }),
        commit: async (value) => {
          commits.push(value);
        },
      }),
      freeAccessExpiresAt,
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
      now: new Date('2026-09-11T14:59:59.000Z'),
    });
    expect(result).toMatchObject({
      next_action: 'signed_in',
      projection: { access_state: 'free' },
    });
    expect(commits[0]).toMatchObject({
      ghl_identity_state: 'readback_required',
      ghl_contact_ref_hash: null,
      ghl_evidence_status: 'evidence_unavailable',
      outbox_intents: [
        {
          dispatch_state: 'ready',
          ghl_handoff: {
            provider_readback_required: true,
            provider_effect_authorized: false,
            student_contact_prohibited: true,
          },
        },
      ],
    });
  });

  it('rejects invalid IANA zones, confirmation, consent, keys, and hashes before access', async () => {
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
    const weakKey = command();
    weakKey.idempotency_key = 'A'.repeat(43);
    await expect(service.submit({ scope, command: weakKey, now: new Date() })).rejects.toThrow(
      'invalid_family_signup',
    );
    for (const invalid of [
      { ...command(), timezone: 'not a timezone' },
      { ...command(), timezone: '+02:00' },
      { ...command(), password_confirmation: 'different secure password' },
      {
        ...command(),
        password: 'short',
        password_confirmation: 'short',
      },
    ]) {
      await expect(service.submit({ scope, command: invalid, now: new Date() })).rejects.toThrow();
    }
    const missingConsent = command() as Partial<FamilySignupCommand>;
    delete missingConsent.general_marketing_consent;
    await expect(
      service.submit({
        scope,
        command: missingConsent as FamilySignupCommand,
        now: new Date(),
      }),
    ).rejects.toThrow('invalid_family_signup');
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
