import { describe, expect, it, vi } from 'vitest';
import type {
  FamilySignupCommand,
  FamilySignupScope,
} from '../../../../../../../packages/contracts/src/signup/family/index.ts';
import type { DbPool } from '../../../../../../../packages/db/src/index.ts';
import { createFamilySignupService } from './service.ts';
import {
  createPostgresFamilySignupRepository,
  PostgresFamilySignupRepositoryError,
} from './repository.ts';

type QueryCall = { text: string; values: readonly unknown[] };

const scope: FamilySignupScope = {
  product: 'one_time_mishnayos',
  runtime_tier: 'isolated_staging',
  verification_environment_id: 'ci',
};
const crmBinding = {
  accountKey: 'one_time',
  productKey: 'one_time_mishnayos',
};
const command = (): FamilySignupCommand => ({
  classification: 'family',
  idempotency_key: '1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefg',
  first_name: 'Ari',
  last_name: 'Levi',
  email: 'ari@example.com',
  password: 'correct horse battery staple',
  password_confirmation: 'correct horse battery staple',
  timezone: 'Asia/Jerusalem',
  terms_accepted: true,
  privacy_accepted: true,
  general_marketing_consent: true,
  parent_newsletter_consent: true,
});
const passwordHash = `argon2id-v1$v=19$m=19456,t=2,p=1$${'a'.repeat(22)}$${'b'.repeat(43)}`;
const freeAccessExpiresAt = '2026-09-11T15:00:00.000Z';

describe('P08 PostgreSQL Family-signup repository', () => {
  it('serializes exact request and identity keys and commits every local aggregate atomically', async () => {
    const harness = recordingPool();
    const service = createFamilySignupService({
      repository: createPostgresFamilySignupRepository(harness.pool, crmBinding),
      freeAccessExpiresAt,
      hashPassword: async () => passwordHash,
      fingerprintPasswordForIdempotency: async () => 'c'.repeat(64),
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
      disposition: 'created',
      next_action: 'signed_in',
      projection: { access_state: 'free' },
    });

    expect(harness.calls[0]?.text).toBe('BEGIN');
    expect(harness.calls.at(-1)?.text).toBe('COMMIT');
    expect(harness.calls.filter(({ text }) => text.includes('pg_advisory_xact_lock'))).toHaveLength(
      2,
    );
    for (const table of [
      'v21_adult_identities',
      'v21_human_accounts',
      'v21_human_account_role_memberships',
      'v21_households',
      'parent_learning_participants',
      'parent_learning_class_entitlements',
      'v21_adult_credentials',
      'contacts',
      'canonical_state_transition_events',
      'family_signup_requests',
      'family_signup_access_projections',
      'family_signup_consents',
      'family_signup_receipts',
      'family_signup_outbox',
      'job_command_idempotency',
    ]) {
      expect(harness.calls.some(({ text }) => text.includes(`INTO onetime.${table}`))).toBe(true);
    }
    expect(
      harness.calls.filter(({ text }) => text.includes('INTO onetime.family_signup_consents')),
    ).toHaveLength(6);
    expect(
      harness.calls.filter(({ text }) =>
        text.includes('INTO onetime.canonical_state_transition_events'),
      ),
    ).toHaveLength(2);
    expect(
      harness.calls.every(
        ({ text, values }) =>
          !text.includes('INSERT INTO') || (values.length > 0 && text.includes('$1')),
      ),
    ).toBe(true);
    expect(JSON.stringify(harness.calls)).not.toContain(command().password);

    const household = harness.calls.find(({ text }) =>
      text.includes('INTO onetime.v21_households'),
    );
    expect(household?.text).toContain("'family','active',3,0");
    const parentParticipant = harness.calls.find(({ text }) =>
      text.includes('INTO onetime.parent_learning_participants'),
    );
    expect(parentParticipant?.values).toEqual(
      expect.arrayContaining(['parent:household_1', 'household_1', 'adult_1', 'account_1']),
    );
    expect(
      harness.calls.some(({ text }) =>
        /INTO onetime\.(?:v21_student_profiles|portal_learners)/u.test(text),
      ),
    ).toBe(false);

    const crmContact = harness.calls.find(({ text }) => text.includes('INTO onetime.contacts'));
    expect(crmContact?.values).toEqual(
      expect.arrayContaining([
        'contact_adult_1',
        'one_time',
        'one_time_mishnayos',
        'Ari Levi',
        'ari@example.com',
        'email',
      ]),
    );
    const conflictUpdate = crmContact?.text.split('DO UPDATE SET')[1] ?? '';
    expect(conflictUpdate).not.toMatch(/suppression_state|archived_at|source\s*=|phone_normalized/);

    const outbox = harness.calls.find(({ text }) =>
      text.includes('INTO onetime.family_signup_outbox'),
    );
    expect(outbox?.values).toContain('ready');
    expect(outbox?.values.some((value) => String(value).includes('evidence_unavailable'))).toBe(
      true,
    );
    expect(outbox?.values.some((value) => String(value).includes('ghl_identity_state'))).toBe(true);
    expect(
      outbox?.values.some((value) => String(value).includes('verified_contact_ref_hash')),
    ).toBe(true);
    expect(outbox?.values.some((value) => String(value).includes('"kind":"student"'))).toBe(false);
    expect(
      outbox?.values.some((value) => String(value).includes('"provider_effect_authorized":false')),
    ).toBe(true);
    expect(
      outbox?.values.some((value) =>
        String(value).includes('"policy_version":"one_time_family_signup_unified_v1"'),
      ),
    ).toBe(true);
    expect(outbox?.values.some((value) => String(value).includes('"student_contacts":0'))).toBe(
      true,
    );
    expect(harness.calls.some(({ text }) => text.includes('INTO onetime.job_outbox'))).toBe(false);
  });

  it('persists the exact P25 standard hosted-checkout handoff at the expiry boundary', async () => {
    const harness = recordingPool();
    const service = createFamilySignupService({
      repository: createPostgresFamilySignupRepository(harness.pool, crmBinding),
      freeAccessExpiresAt,
      ghlPaymentLinkConfigured: true,
      hashPassword: async () => passwordHash,
      fingerprintPasswordForIdempotency: async () => 'c'.repeat(64),
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
      next_action: 'checkout',
      checkout_handoff_state: 'queued',
      provider_effects_completed_inline: 0,
      projection: {
        access_state: 'inactive',
        checkout_required: true,
        rolling_trial_granted: false,
        card_collected: false,
      },
    });

    const commercialCommands = harness.calls.filter(({ text }) =>
      text.includes('INTO onetime.job_command_idempotency'),
    );
    expect(commercialCommands).toHaveLength(2);
    expect(commercialCommands[0]?.values).toContain('billing.commercial.signup:household_1');
    expect(commercialCommands[1]?.values).toContain(
      'billing.commercial.request_hosted_checkout:household_1',
    );
    const hostedCheckout = harness.calls.find(({ text }) =>
      text.includes('INTO onetime.job_outbox'),
    );
    expect(hostedCheckout?.values).toEqual(
      expect.arrayContaining(['billing.commercial.checkout.request', 'highlevel', 'household_1']),
    );
    const persistedResponse = commercialCommands[1]?.values.find(
      (value) => typeof value === 'string' && value.includes('"financialProvider":"stripe"'),
    );
    expect(persistedResponse).toEqual(expect.stringContaining('"providerMutationByOneTime":false'));
    expect(persistedResponse).toEqual(expect.stringContaining('"chargeMode":"at_hosted_checkout"'));
    expect(JSON.stringify(harness.calls)).not.toContain('checkout_url');
    expect(JSON.stringify(harness.calls)).not.toContain('4242');
  });

  it('rolls back the full transaction when any required insert is not singular', async () => {
    const harness = recordingPool('v21_adult_credentials');
    const service = createFamilySignupService({
      repository: createPostgresFamilySignupRepository(harness.pool, crmBinding),
      freeAccessExpiresAt,
      hashPassword: async () => passwordHash,
      fingerprintPasswordForIdempotency: async () => 'c'.repeat(64),
      allocateIds: () => ({
        adult_id: 'adult_1',
        human_account_id: 'account_1',
        household_id: 'household_1',
      }),
    });

    await expect(
      service.submit({
        scope,
        command: command(),
        now: new Date('2026-09-11T14:59:59.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'persistence_invariant' });
    expect(harness.calls.some(({ text }) => text === 'ROLLBACK')).toBe(true);
    expect(harness.calls.some(({ text }) => text === 'COMMIT')).toBe(false);
    expect(
      harness.calls.some(({ text }) => text.includes('INTO onetime.family_signup_requests')),
    ).toBe(false);
  });

  it('rolls back the Parent account when its canonical learning entitlement is unavailable', async () => {
    const harness = recordingPool('parent_learning_class_entitlements');
    const service = createFamilySignupService({
      repository: createPostgresFamilySignupRepository(harness.pool, crmBinding),
      freeAccessExpiresAt,
      hashPassword: async () => passwordHash,
      fingerprintPasswordForIdempotency: async () => 'c'.repeat(64),
      allocateIds: () => ({
        adult_id: 'adult_1',
        human_account_id: 'account_1',
        household_id: 'household_1',
      }),
    });

    await expect(
      service.submit({
        scope,
        command: command(),
        now: new Date('2026-09-11T14:59:59.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'persistence_invariant' });
    expect(harness.calls.some(({ text }) => text === 'ROLLBACK')).toBe(true);
    expect(harness.calls.some(({ text }) => text === 'COMMIT')).toBe(false);
    expect(
      harness.calls.some(({ text }) => text.includes('INTO onetime.family_signup_requests')),
    ).toBe(false);
  });

  it('fails closed before local inserts in production_read_only', async () => {
    const harness = recordingPool();
    const service = createFamilySignupService({
      repository: createPostgresFamilySignupRepository(harness.pool, crmBinding),
      freeAccessExpiresAt,
      hashPassword: async () => passwordHash,
      fingerprintPasswordForIdempotency: async () => 'c'.repeat(64),
      allocateIds: () => ({
        adult_id: 'adult_1',
        human_account_id: 'account_1',
        household_id: 'household_1',
      }),
    });

    await expect(
      service.submit({
        scope: {
          product: 'one_time_mishnayos',
          runtime_tier: 'production',
          verification_environment_id: 'production_read_only',
        },
        command: command(),
        now: new Date('2026-09-11T14:59:59.000Z'),
      }),
    ).rejects.toBeInstanceOf(PostgresFamilySignupRepositoryError);
    expect(harness.calls.some(({ text }) => text === 'ROLLBACK')).toBe(true);
    expect(harness.calls.some(({ text }) => text.includes('INSERT INTO'))).toBe(false);
  });
});

function recordingPool(zeroRowInsertTable?: string): {
  pool: DbPool;
  calls: QueryCall[];
} {
  const calls: QueryCall[] = [];
  const query = vi.fn(async (text: string, values: readonly unknown[] = []) => {
    calls.push({ text, values });
    if (text.includes('FROM onetime.family_signup_requests')) {
      return { rows: [], rowCount: 0 };
    }
    if (text.includes('FROM onetime.v21_adult_identities')) {
      return { rows: [], rowCount: 0 };
    }
    if (zeroRowInsertTable && text.includes(`INTO onetime.${zeroRowInsertTable}`)) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: text.includes('INSERT INTO') ? 1 : null };
  });
  const client = {
    query,
    release: vi.fn(),
  };
  return {
    calls,
    pool: {
      connect: async () => client as never,
      query: query as never,
      end: vi.fn(async () => undefined) as never,
    },
  };
}
