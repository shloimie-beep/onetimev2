import { describe, expect, it, vi } from 'vitest';

import { FAMILY_PLAN } from '../../../../../packages/contracts/src/billing/commercial/index.ts';
import {
  createMemoryPool,
  runMigrations,
  type DbPool,
} from '../../../../../packages/db/src/index.ts';
import {
  governedCampaignNormalizedEmailHash,
  governedCampaignProviderContactRefHash,
} from '../../../../../packages/domain/src/audience-reconciliation/governed-campaign-census.ts';
import { familySignupGhlHouseholdRefHash } from './provider.ts';
import { createPostgresFamilySignupGhlRepository } from './repository.ts';
import type { FamilySignupGhlClaim } from './types.ts';
import { createPostgresFamilySignupRepository } from '../../../../web/src/server/features/signup/family/repository.ts';
import { createFamilySignupService } from '../../../../web/src/server/features/signup/family/service.ts';

const LOCATION_ID = 'pBSnOK2nkdxp6gf9Rg3o';
const CONTACT_ID = 'provider-contact-repository-test';
const OPPORTUNITY_ID = 'provider-opportunity-repository-test';
const EMAIL = 'adult@example.test';

describe('Family-signup HighLevel projection repository', () => {
  it('atomically persists a verified adult link after the accepted contact readback', async () => {
    const harness = recordingPool();
    const repository = createPostgresFamilySignupGhlRepository(harness.pool, {
      highLevelLocationId: LOCATION_ID,
    });

    await expect(
      repository.completeEffect({
        claim: claim('contact_upsert'),
        operationKey: 'family-signup-intent:contact_upsert',
        effect: {
          providerResourceId: CONTACT_ID,
          providerResponseDigest: 'a'.repeat(64),
          identityProjection: {
            normalizedEmailHash: governedCampaignNormalizedEmailHash(EMAIL),
            providerContactRefHash: governedCampaignProviderContactRefHash(LOCATION_ID, CONTACT_ID),
            marketingSuppressed: false,
            serviceSuppressed: false,
            suppressionEvidenceDigest: 'b'.repeat(64),
          },
        },
      }),
    ).resolves.toBe(true);

    expect(harness.calls[0]?.text).toBe('BEGIN');
    expect(harness.calls.at(-1)?.text).toBe('COMMIT');
    const identity = harness.calls.find(({ text }) =>
      text.includes('INSERT INTO onetime.adult_ghl_identity_link'),
    );
    expect(identity?.text).toContain("state = 'linked'");
    expect(identity?.text).toContain("state IN ('unlinked','linked')");
    expect(identity?.values).toEqual(
      expect.arrayContaining([
        'adult-repository-test',
        governedCampaignNormalizedEmailHash(EMAIL),
        governedCampaignProviderContactRefHash(LOCATION_ID, CONTACT_ID),
        'one_time_mishnayos',
        'production',
        'production_broad',
      ]),
    );
    expect(JSON.stringify(identity?.values)).not.toContain(CONTACT_ID);
  });

  it('persists a hash-only household mapping only through the exact linked adult', async () => {
    const harness = recordingPool();
    const repository = createPostgresFamilySignupGhlRepository(harness.pool, {
      highLevelLocationId: LOCATION_ID,
    });
    const providerResponseDigest = 'c'.repeat(64);

    await expect(
      repository.completeEffect({
        claim: claim('household_opportunity_upsert', CONTACT_ID),
        operationKey: 'family-signup-intent:household_opportunity_upsert',
        effect: {
          providerResourceId: OPPORTUNITY_ID,
          providerResponseDigest,
          householdProjection: {
            providerContactRefHash: governedCampaignProviderContactRefHash(LOCATION_ID, CONTACT_ID),
            providerHouseholdRefHash: familySignupGhlHouseholdRefHash(LOCATION_ID, OPPORTUNITY_ID),
            providerRevision: 1,
            readbackDigest: providerResponseDigest,
          },
        },
      }),
    ).resolves.toBe(true);

    const mapping = harness.calls.find(({ text }) =>
      text.includes('INSERT INTO onetime.household_provider_mapping'),
    );
    expect(mapping?.text).toContain('FROM onetime.adult_ghl_identity_link AS identity');
    expect(mapping?.text).toContain("identity.state = 'linked'");
    expect(mapping?.values).toEqual(
      expect.arrayContaining([
        FAMILY_PLAN.planKey,
        governedCampaignProviderContactRefHash(LOCATION_ID, CONTACT_ID),
        familySignupGhlHouseholdRefHash(LOCATION_ID, OPPORTUNITY_ID),
        providerResponseDigest,
      ]),
    );
    expect(JSON.stringify(mapping?.values)).not.toContain(CONTACT_ID);
    expect(JSON.stringify(mapping?.values)).not.toContain(OPPORTUNITY_ID);
  });

  it('rejects a mismatched provider identity before opening a transaction', async () => {
    const harness = recordingPool();
    const repository = createPostgresFamilySignupGhlRepository(harness.pool, {
      highLevelLocationId: LOCATION_ID,
    });

    await expect(
      repository.completeEffect({
        claim: claim('contact_upsert'),
        operationKey: 'family-signup-intent:contact_upsert',
        effect: {
          providerResourceId: CONTACT_ID,
          providerResponseDigest: 'a'.repeat(64),
          identityProjection: {
            normalizedEmailHash: governedCampaignNormalizedEmailHash(EMAIL),
            providerContactRefHash: 'f'.repeat(64),
            marketingSuppressed: false,
            serviceSuppressed: false,
            suppressionEvidenceDigest: 'b'.repeat(64),
          },
        },
      }),
    ).rejects.toThrow('family_signup_ghl_identity_projection_invalid');
    expect(harness.connect).not.toHaveBeenCalled();
    expect(harness.calls).toEqual([]);
  });

  it('executes both hash-only projections atomically against the complete migration inventory', async () => {
    const pool = createMemoryPool();
    try {
      await runMigrations(pool);
      const signup = createFamilySignupService({
        repository: createPostgresFamilySignupRepository(pool, {
          accountKey: 'one_time',
          productKey: 'one_time_mishnayos',
        }),
        // pg-mem cannot execute migration 2258's PostgreSQL catalog loop, so
        // its synthetic schema retains the legacy fixed-date check alongside
        // the current shape-v2 check. Production readback proves only v2 remains.
        freeAccessExpiresAt: '2026-09-13T16:24:00.000Z',
        hashPassword: async () =>
          `argon2id-v1$v=19$m=19456,t=2,p=1$${'a'.repeat(22)}$${'b'.repeat(43)}`,
        fingerprintPasswordForIdempotency: async () => 'c'.repeat(64),
        allocateIds: () => ({
          adult_id: 'adult-schema-test',
          human_account_id: 'account-schema-test',
          household_id: 'household-schema-test',
        }),
      });
      await signup.submit({
        scope: {
          product: 'one_time_mishnayos',
          runtime_tier: 'isolated_staging',
          verification_environment_id: 'ci',
        },
        command: {
          classification: 'family',
          idempotency_key: 'family-schema-test-idempotency-key-00000001',
          first_name: 'Adult',
          last_name: 'Schema',
          email: EMAIL,
          password: 'correct horse battery staple',
          password_confirmation: 'correct horse battery staple',
          timezone: 'Asia/Jerusalem',
          terms_accepted: true,
          privacy_accepted: true,
          general_marketing_consent: false,
          parent_newsletter_consent: false,
        },
        now: new Date('2026-08-06T04:00:00.000Z'),
      });
      const outbox = await pool.query<{ intent_id: string }>(
        `SELECT intent_id FROM onetime.family_signup_outbox WHERE adult_id = $1`,
        ['adult-schema-test'],
      );
      const intentId = outbox.rows[0]!.intent_id;
      await pool.query(
        `INSERT INTO onetime.family_signup_ghl_dispatches
           (intent_id, state, current_step, lease_token, lease_expires_at)
         VALUES ($1,'processing','contact_upsert',$2,$3::timestamptz)`,
        [intentId, 'lease-contact-schema', '2026-08-06T04:05:00.000Z'],
      );
      const repository = createPostgresFamilySignupGhlRepository(pool, {
        highLevelLocationId: LOCATION_ID,
      });
      const schemaClaim = {
        ...claim('contact_upsert'),
        intentId,
        adultId: 'adult-schema-test',
        householdId: 'household-schema-test',
        runtimeTier: 'isolated_staging' as const,
        verificationEnvironmentId: 'ci' as const,
        leaseToken: 'lease-contact-schema',
      };
      const contactRefHash = governedCampaignProviderContactRefHash(LOCATION_ID, CONTACT_ID);
      await expect(
        repository.completeEffect({
          claim: schemaClaim,
          operationKey: `${intentId}:contact_upsert`,
          effect: {
            providerResourceId: CONTACT_ID,
            providerResponseDigest: 'a'.repeat(64),
            identityProjection: {
              normalizedEmailHash: governedCampaignNormalizedEmailHash(EMAIL),
              providerContactRefHash: contactRefHash,
              marketingSuppressed: false,
              serviceSuppressed: false,
              suppressionEvidenceDigest: 'b'.repeat(64),
            },
          },
        }),
      ).resolves.toBe(true);

      await pool.query(
        `UPDATE onetime.family_signup_ghl_dispatches
            SET state = 'processing',
                lease_token = $2,
                lease_expires_at = $3::timestamptz
          WHERE intent_id = $1`,
        [intentId, 'lease-opportunity-schema', '2026-08-06T04:10:00.000Z'],
      );
      const providerResponseDigest = 'd'.repeat(64);
      await expect(
        repository.completeEffect({
          claim: {
            ...schemaClaim,
            step: 'household_opportunity_upsert',
            leaseToken: 'lease-opportunity-schema',
            providerContactId: CONTACT_ID,
          },
          operationKey: `${intentId}:household_opportunity_upsert`,
          effect: {
            providerResourceId: OPPORTUNITY_ID,
            providerResponseDigest,
            householdProjection: {
              providerContactRefHash: contactRefHash,
              providerHouseholdRefHash: familySignupGhlHouseholdRefHash(
                LOCATION_ID,
                OPPORTUNITY_ID,
              ),
              providerRevision: 1,
              readbackDigest: providerResponseDigest,
            },
          },
        }),
      ).resolves.toBe(true);

      await expect(
        pool.query(
          `SELECT identity.state,
                  identity.verified_contact_ref_hash,
                  mapping.ghl_household_record_ref_hash,
                  mapping.projected_owner_contact_ref_hash,
                  mapping.stripe_customer_ref_hash
             FROM onetime.adult_ghl_identity_link AS identity
             JOIN onetime.household_provider_mapping AS mapping
               ON mapping.owner_adult_id = identity.adult_id
            WHERE identity.adult_id = $1`,
          ['adult-schema-test'],
        ),
      ).resolves.toMatchObject({
        rows: [
          {
            state: 'linked',
            verified_contact_ref_hash: contactRefHash,
            ghl_household_record_ref_hash: familySignupGhlHouseholdRefHash(
              LOCATION_ID,
              OPPORTUNITY_ID,
            ),
            projected_owner_contact_ref_hash: contactRefHash,
            stripe_customer_ref_hash: null,
          },
        ],
      });
    } finally {
      await pool.end();
    }
  }, 15_000);
});

function claim(
  step: FamilySignupGhlClaim['step'],
  providerContactId: string | null = null,
): FamilySignupGhlClaim {
  return {
    intentId: 'family-signup-intent-repository-test',
    leaseToken: `lease-${step}`,
    step,
    attemptCount: 1,
    adultId: 'adult-repository-test',
    householdId: 'household-repository-test',
    normalizedEmail: EMAIL,
    displayName: 'Adult Repository',
    timezone: 'Asia/Jerusalem',
    accessState: 'free',
    freeAccessExpiresAt: '2026-09-11T15:00:00.000Z',
    generalMarketingConsent: false,
    parentNewsletterConsent: false,
    product: 'one_time_mishnayos',
    runtimeTier: 'production',
    verificationEnvironmentId: 'production_broad',
    providerContactId,
    providerOpportunityId: null,
  };
}

function recordingPool(): {
  pool: DbPool;
  calls: Array<{ text: string; values: readonly unknown[] }>;
  connect: ReturnType<typeof vi.fn>;
} {
  const calls: Array<{ text: string; values: readonly unknown[] }> = [];
  const query = vi.fn(async (text: string, values: readonly unknown[] = []) => {
    calls.push({ text, values });
    return { rows: [], rowCount: 1 };
  });
  const connect = vi.fn(async () => ({ query, release: vi.fn() }));
  return {
    calls,
    connect,
    pool: {
      connect,
      query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
      end: vi.fn(async () => undefined),
    } as never,
  };
}
