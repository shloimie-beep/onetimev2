import { Pool } from 'pg';
import { afterAll, describe, expect, it, vi } from 'vitest';

import {
  governedCampaignNormalizedEmailHash,
  governedCampaignProviderContactRefHash,
  type GovernedCensusDatabaseFacts,
  type GovernedCensusDecisionHistory,
  type GovernedCensusSha256,
  type ProtectedGovernedCensusProviderContact,
} from '../../packages/domain/src/audience-reconciliation/governed-campaign-census.ts';
import { createPostgresGovernedCampaignCensusReader } from '../../packages/db/src/audience-reconciliation/governed-campaign-census-reader.ts';
import {
  createPostgresGovernedCampaignAudienceDecisionStore,
  GOVERNED_CAMPAIGN_PROVIDER_BINDING,
} from '../../packages/db/src/audience-reconciliation/governed-campaign-decision-store.ts';
import { createMemoryPool, runMigrations } from '../../packages/db/src/index.ts';
import {
  prepareGovernedCampaignAudienceCensus,
  type PrepareGovernedCampaignAudienceCensusInput,
} from '../../scripts/highlevel/governed-campaign-audience-census.ts';

const LOCATION = GOVERNED_CAMPAIGN_PROVIDER_BINDING.providerLocationId;
const RAW_A = 'synthetic-integration-a';
const RAW_B = 'synthetic-integration-b';
const EMAIL_A = 'synthetic-integration-a@example.invalid';
const EMAIL_B = 'synthetic-integration-b@example.invalid';
const HASH_A = governedCampaignProviderContactRefHash(LOCATION, RAW_A);
const HASH_B = governedCampaignProviderContactRefHash(LOCATION, RAW_B);
const EMAIL_HASH_A = governedCampaignNormalizedEmailHash(EMAIL_A);
const EMAIL_HASH_B = governedCampaignNormalizedEmailHash(EMAIL_B);
const SCOPE = {
  runtimeTier: 'isolated_staging' as const,
  verificationEnvironmentId: 'ci',
  accountKey: 'account-one-time',
  productKey: 'one_time_mishnayos',
  campaignKey: 'ot-15-elul-2026',
  binding: GOVERNED_CAMPAIGN_PROVIDER_BINDING,
};

describe('governed census composition integration', () => {
  it('accepts current versions only for a final exact replay and otherwise advances every row', async () => {
    const reconcile = vi.fn();
    const facts = new Map([
      [HASH_A, database(HASH_A, 'contact-a')],
      [HASH_B, database(HASH_B, 'contact-b')],
    ]);
    const initial = await prepare([], facts, reconcile);
    expect(initial.request.decisions.map((row) => row.decisionVersion)).toEqual([1, 1]);

    const history = new Map<string, GovernedCensusDecisionHistory>(
      initial.request.decisions.map((decision) => [
        String(decision.providerContactRefHash),
        {
          providerContactRefHash:
            decision.providerContactRefHash as unknown as GovernedCensusSha256,
          maximumDecisionVersion: decision.decisionVersion,
          currentDecisionVersion: decision.decisionVersion,
          currentDecision: decision.decision as GovernedCensusDecisionHistory['currentDecision'],
          currentPrimaryReason:
            decision.primaryReason as GovernedCensusDecisionHistory['currentPrimaryReason'],
          currentSourceFactsHash: decision.sourceFacts
            .sourceFactsHash as unknown as GovernedCensusSha256,
          currentIdempotencyKey: initial.request.idempotencyKey,
          currentRequestHash: initial.request.requestHash as unknown as GovernedCensusSha256,
          currentSnapshotHash: initial.request.snapshotHash as unknown as GovernedCensusSha256,
        } satisfies GovernedCensusDecisionHistory,
      ]),
    );
    const replay = await prepare(history, facts, reconcile);
    expect(replay.exactReplay).toBe(true);
    expect(replay.plannedAffectedRows).toBe(0);
    expect(replay.request).toEqual(initial.request);

    const changed = await prepare(history, facts, reconcile, {
      idempotencyKey: 'census-integration-changed',
    });
    expect(changed.exactReplay).toBe(false);
    expect(changed.request.decisions.map((row) => row.decisionVersion)).toEqual([2, 2]);
    expect(changed.plannedAffectedRows).toBe(4);
    expect(reconcile).not.toHaveBeenCalled();

    const cardinalityMismatch = await prepare(history, facts, reconcile, {
      reader: {
        read: vi.fn(async () => ({
          databaseFacts: facts,
          history,
          currentProjectionRows: 1,
          readOnlyTransaction: true as const,
        })),
      },
    });
    expect(cardinalityMismatch.exactReplay).toBe(false);
    expect(cardinalityMismatch.request.decisions.map((row) => row.decisionVersion)).toEqual([2, 2]);
  });

  it('advances a reintroduced contact from the exact historical maximum', async () => {
    const history = new Map<string, GovernedCensusDecisionHistory>([
      [
        HASH_A,
        {
          providerContactRefHash: HASH_A,
          maximumDecisionVersion: 4,
          currentDecisionVersion: null,
          currentDecision: null,
          currentPrimaryReason: null,
          currentSourceFactsHash: null,
          currentIdempotencyKey: null,
          currentRequestHash: null,
          currentSnapshotHash: null,
        },
      ],
    ]);
    const result = await prepare(
      history,
      new Map([[HASH_A, database(HASH_A, 'contact-a')]]),
      vi.fn(),
      {},
      [provider(HASH_A)],
    );
    expect(result.request.decisions[0]).toMatchObject({ decisionVersion: 5 });
  });

  it('produces provider-order-independent snapshot and request hashes', async () => {
    const facts = new Map([
      [HASH_A, database(HASH_A, 'contact-a')],
      [HASH_B, database(HASH_B, 'contact-b')],
    ]);
    const left = await prepare([], facts, vi.fn(), {}, [provider(HASH_A), provider(HASH_B)]);
    const right = await prepare([], facts, vi.fn(), {}, [provider(HASH_B), provider(HASH_A)]);
    expect(left.request.snapshotHash).toBe(right.request.snapshotHash);
    expect(left.request.requestHash).toBe(right.request.requestHash);
    expect(left.request.decisions).toEqual(right.request.decisions);
  });

  it('composes the real pg-mem decision store with zero decision-row writes', async () => {
    const pool = createMemoryPool();
    try {
      await runMigrations(pool);
      const result = await prepareGovernedCampaignAudienceCensus({
        ...basePreparationInput(new Map([[HASH_A, database(HASH_A, 'contact-a')]]), [
          provider(HASH_A),
        ]),
        decisionStore: createPostgresGovernedCampaignAudienceDecisionStore(pool),
      });
      const rows = await pool.query<{ rows: string | number }>(
        'SELECT count(*)::text AS rows FROM onetime.governed_campaign_audience_decisions',
      );
      expect(result.decisionStoreExecuted).toBe(false);
      expect(Number(rows.rows[0]?.rows)).toBe(0);
    } finally {
      await pool.end();
    }
  }, 30_000);
});

const nativeUrl = process.env.GOVERNED_CENSUS_TEST_DATABASE_URL;
describe.skipIf(!nativeUrl)('governed census disposable PostgreSQL 18 reader', () => {
  const pool = new Pool({ connectionString: nativeUrl });
  afterAll(async () => pool.end());

  it('proves durable mapping, scoped fallback, legacy conflict, and no raw output', async () => {
    assertDisposableLoopback(nativeUrl!);
    await pool.query('DROP SCHEMA IF EXISTS onetime CASCADE');
    await pool.query('CREATE SCHEMA onetime');
    await createNativeSchema(pool);
    const databaseHash = await pool.query<{ hash: string }>(
      `SELECT encode(
         sha256(
           convert_to('governed-ghl-contact-v1', 'UTF8')
           || decode('00', 'hex')
           || convert_to($1, 'UTF8')
           || decode('00', 'hex')
           || convert_to($2, 'UTF8')
         ),
         'hex'
       ) AS hash`,
      [LOCATION, RAW_A],
    );
    expect(databaseHash.rows[0]?.hash).toBe(HASH_A);
    await pool.query(
      `INSERT INTO onetime.v21_adult_identities VALUES
         ('adult-1', $1, 'active', $2, $3, $4),
         ('adult-cross-scope', $1, 'active', 'another-product', $3, $4)`,
      [EMAIL_A, SCOPE.productKey, SCOPE.runtimeTier, SCOPE.verificationEnvironmentId],
    );
    await pool.query(
      `INSERT INTO onetime.adult_ghl_identity_link
         (adult_id, normalized_email_hash, state, verified_contact_ref_hash,
          suppression_json, product_key, runtime_tier, verification_environment_id)
       VALUES
         ('adult-1', $1, 'linked', $2,
          jsonb_build_object(
            'marketing_suppressed', false,
            'service_suppressed', false,
            'evidence_digest', repeat('a', 64),
            'version', 1
          ), $3, $4, $5)`,
      [
        EMAIL_HASH_A,
        'f'.repeat(64),
        SCOPE.productKey,
        SCOPE.runtimeTier,
        SCOPE.verificationEnvironmentId,
      ],
    );
    await pool.query(
      `INSERT INTO onetime.contacts VALUES
         ('contact-canonical', $1, $2, $3, 'family', 'active', 'policy-v1', now()),
         ('contact-cross-account-decoy', 'another-account', $2, $3, 'school', 'suppressed', NULL, NULL),
         ('contact-cross-product-decoy', $1, 'another-product', $4, 'school', 'suppressed', NULL, NULL),
         ('contact-cross-location-decoy', $1, $2, $4, 'school', 'suppressed', NULL, NULL)`,
      [SCOPE.accountKey, SCOPE.productKey, EMAIL_A, EMAIL_B],
    );
    await pool.query(
      `INSERT INTO onetime.highlevel_contact_preferences VALUES
         ($1, $2, 'contact-canonical', false, false)`,
      [SCOPE.accountKey, SCOPE.productKey],
    );
    await pool.query(
      `INSERT INTO onetime.ghl_household_identity_projection VALUES
         ('household-1', 'adult-1', 'family', 'inactive', $1, $2, $3)`,
      [SCOPE.productKey, SCOPE.runtimeTier, SCOPE.verificationEnvironmentId],
    );
    await pool.query(
      `INSERT INTO onetime.adult_household_contact_links VALUES
         ('link-canonical', $1, $2, 'contact-canonical', 'household-1', $3, $4, 'synced'),
         ('link-account-decoy', 'another-account', $2, 'contact-cross-account-decoy', 'household-decoy', $3, $4, 'synced'),
         ('link-product-decoy', $1, 'another-product', 'contact-cross-product-decoy', 'household-product-decoy', $3, $4, 'synced'),
         ('link-location-decoy', $1, $2, 'contact-cross-location-decoy', 'household-location-decoy', 'another-location', $4, 'synced')`,
      [SCOPE.accountKey, SCOPE.productKey, LOCATION, RAW_A],
    );
    await pool.query(
      `INSERT INTO onetime.v21_student_profiles VALUES
         ('adult-1', 'self', 'active', 'another-product', $1, $2)`,
      [SCOPE.runtimeTier, SCOPE.verificationEnvironmentId],
    );
    const result = await createPostgresGovernedCampaignCensusReader(pool).read({
      scope: SCOPE,
      providerContacts: [provider(HASH_A)],
      maximumProviderContacts: 10,
    });
    expect(result.databaseFacts.get(HASH_A)).toMatchObject({
      contactKey: 'contact-canonical',
      adultEvidenceState: 'proven',
      studentOrMinorState: 'absent',
      schoolContactState: 'absent',
      consentState: 'opted_in',
      deliverabilityState: 'deliverable',
      providerSuppressionState: 'active',
      identityMatchState: 'exact',
    });
    expect(JSON.stringify(result)).not.toContain(EMAIL_A);
    expect(JSON.stringify(result)).not.toContain(RAW_A);

    await pool.query(
      `DELETE FROM onetime.adult_household_contact_links
        WHERE account_key = $1 AND product_key = $2`,
      [SCOPE.accountKey, SCOPE.productKey],
    );
    const fallback = await createPostgresGovernedCampaignCensusReader(pool).read({
      scope: SCOPE,
      providerContacts: [provider(HASH_A)],
      maximumProviderContacts: 10,
    });
    expect(fallback.databaseFacts.get(HASH_A)).toMatchObject({
      contactKey: 'contact-canonical',
      identityMatchState: 'exact',
      adultEvidenceState: 'proven',
    });

    await pool.query(
      `INSERT INTO onetime.v21_adult_identities VALUES
         ('adult-duplicate', $1, 'active', $2, $3, $4)`,
      [EMAIL_A, SCOPE.productKey, SCOPE.runtimeTier, SCOPE.verificationEnvironmentId],
    );
    const duplicateAdult = await createPostgresGovernedCampaignCensusReader(pool).read({
      scope: SCOPE,
      providerContacts: [provider(HASH_A)],
      maximumProviderContacts: 10,
    });
    expect(duplicateAdult.databaseFacts.get(HASH_A)).toMatchObject({
      identityMatchState: 'duplicate',
      adultEvidenceState: 'conflicting',
    });
    await pool.query("DELETE FROM onetime.v21_adult_identities WHERE adult_id = 'adult-duplicate'");

    await pool.query(
      `UPDATE onetime.adult_ghl_identity_link
          SET verified_contact_ref_hash = $1
        WHERE adult_id = 'adult-1'`,
      [HASH_A],
    );
    const legacyOnly = await createPostgresGovernedCampaignCensusReader(pool).read({
      scope: SCOPE,
      providerContacts: [{ ...provider(HASH_A), normalizedEmailHash: null }],
      maximumProviderContacts: 10,
    });
    expect(legacyOnly.databaseFacts.get(HASH_A)).toMatchObject({
      contactKey: null,
      identityMatchState: 'ambiguous',
    });

    const duplicateProviderEmail = await createPostgresGovernedCampaignCensusReader(pool).read({
      scope: SCOPE,
      providerContacts: [
        provider(HASH_A),
        { ...provider(HASH_B), normalizedEmailHash: EMAIL_HASH_A },
      ],
      maximumProviderContacts: 10,
    });
    expect(duplicateProviderEmail.databaseFacts.get(HASH_A)).toMatchObject({
      identityMatchState: 'duplicate',
    });

    await pool.query(
      `UPDATE onetime.adult_ghl_identity_link
          SET suppression_json = '{"marketing_suppressed":false}'::jsonb
        WHERE adult_id = 'adult-1'`,
    );
    const malformed = await createPostgresGovernedCampaignCensusReader(pool).read({
      scope: SCOPE,
      providerContacts: [provider(HASH_A)],
      maximumProviderContacts: 10,
    });
    expect(malformed.databaseFacts.get(HASH_A)).toMatchObject({
      consentState: 'unknown',
      providerSuppressionState: 'unknown',
    });

    await pool.query(
      `UPDATE onetime.v21_adult_identities SET state = 'archived' WHERE adult_id = 'adult-1'`,
    );
    const archived = await createPostgresGovernedCampaignCensusReader(pool).read({
      scope: SCOPE,
      providerContacts: [provider(HASH_A)],
      maximumProviderContacts: 10,
    });
    expect(archived.databaseFacts.get(HASH_A)).toMatchObject({
      adultEvidenceState: 'not_proven',
    });
    await pool.query('DROP SCHEMA onetime CASCADE');
  });
});

async function prepare(
  history: ReadonlyMap<string, GovernedCensusDecisionHistory> | readonly never[],
  databaseFacts: ReadonlyMap<string, GovernedCensusDatabaseFacts>,
  reconcile: ReturnType<typeof vi.fn>,
  override: Partial<PrepareGovernedCampaignAudienceCensusInput> = {},
  contacts: readonly ProtectedGovernedCensusProviderContact[] = [
    provider(HASH_B),
    provider(HASH_A),
  ],
) {
  const historyMap =
    history instanceof Map ? history : new Map<string, GovernedCensusDecisionHistory>();
  return prepareGovernedCampaignAudienceCensus({
    ...basePreparationInput(databaseFacts, contacts, historyMap),
    decisionStore: { reconcile },
    ...override,
  });
}

function basePreparationInput(
  databaseFacts: ReadonlyMap<string, GovernedCensusDatabaseFacts>,
  contacts: readonly ProtectedGovernedCensusProviderContact[],
  history: ReadonlyMap<string, GovernedCensusDecisionHistory> = new Map(),
): Omit<PrepareGovernedCampaignAudienceCensusInput, 'decisionStore'> {
  return {
    scope: SCOPE,
    provider: {
      readContactsPage: vi.fn(async () => ({
        locationId: LOCATION,
        contacts,
        nextCursor: null,
        reportedTotal: contacts.length,
      })),
    },
    reader: {
      read: vi.fn(async () => ({
        databaseFacts,
        history,
        currentProjectionRows: [...history.values()].filter(
          (row) => row.currentDecisionVersion !== null,
        ).length,
        readOnlyTransaction: true as const,
      })),
    },
    maximumProviderContacts: 10,
    maximumAffectedRows: 10,
    idempotencyKey: 'census-integration-1',
    sourceObservedAt: '2026-08-04T15:00:00.000Z',
    createdByUserKey: 'operator-source-only',
  };
}

function provider(hash: GovernedCensusSha256): ProtectedGovernedCensusProviderContact {
  return {
    providerContactRefHash: hash,
    normalizedEmailHash: hash === HASH_A ? EMAIL_HASH_A : EMAIL_HASH_B,
    consentState: 'opted_in',
    deliverabilityState: 'deliverable',
    providerSuppressionState: 'active',
  };
}

function database(hash: GovernedCensusSha256, contactKey: string): GovernedCensusDatabaseFacts {
  return {
    providerContactRefHash: hash,
    contactKey,
    adultEvidenceState: 'proven',
    studentOrMinorState: 'absent',
    schoolContactState: 'absent',
    activeOrCurrentSubscriberState: 'absent',
    consentState: 'opted_in',
    deliverabilityState: 'deliverable',
    providerSuppressionState: 'active',
    identityMatchState: 'exact',
    sourceJoinCount: 3,
  };
}

function assertDisposableLoopback(value: string) {
  const url = new URL(value);
  if (
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    !/^ot_live_002_census_/u.test(url.pathname.slice(1))
  ) {
    throw new Error(
      'GOVERNED_CENSUS_TEST_DATABASE_URL must be an ot_live_002_census_* loopback database',
    );
  }
}

async function createNativeSchema(pool: Pool) {
  await pool.query(`
    CREATE TABLE onetime.v21_adult_identities (
      adult_id text PRIMARY KEY, normalized_email text NOT NULL,
      state text NOT NULL, product_key text NOT NULL,
      runtime_tier text NOT NULL,
      verification_environment_id text NOT NULL
    );
    CREATE TABLE onetime.adult_ghl_identity_link (
      adult_id text PRIMARY KEY, normalized_email_hash text NOT NULL, state text NOT NULL,
      verified_contact_ref_hash text, suppression_json jsonb NOT NULL,
      product_key text NOT NULL, runtime_tier text NOT NULL, verification_environment_id text NOT NULL
    );
    CREATE TABLE onetime.adult_household_contact_links (
      link_key text PRIMARY KEY, account_key text NOT NULL, product_key text NOT NULL,
      contact_key text NOT NULL, household_key text NOT NULL,
      highlevel_location_id text NOT NULL,
      highlevel_contact_id text, sync_state text NOT NULL
    );
    CREATE TABLE onetime.contacts (
      contact_key text NOT NULL, account_key text NOT NULL, product_key text NOT NULL,
      email_normalized text NOT NULL, family_school_classification text NOT NULL,
      suppression_state text NOT NULL, consent_policy_version text,
      consent_recorded_at timestamptz
    );
    CREATE TABLE onetime.highlevel_contact_preferences (
      account_key text NOT NULL, product_key text NOT NULL, contact_key text NOT NULL,
      email_dnd boolean NOT NULL, all_dnd boolean NOT NULL
    );
    CREATE TABLE onetime.ghl_household_identity_projection (
      household_id text, adult_id text, classification text, access_projection text,
      product_key text, runtime_tier text, verification_environment_id text
    );
    CREATE TABLE onetime.v21_student_profiles (
      self_adult_id text, relationship text, state text, product_key text,
      runtime_tier text, verification_environment_id text
    );
    CREATE TABLE onetime.governed_campaign_audience_decisions (
      provider_contact_ref_hash text, decision_version bigint, superseded_at timestamptz,
      decision text, primary_reason text, contact_key text, source_facts jsonb,
      idempotency_key text, request_hash text, snapshot_hash text,
      account_key text, product_key text, runtime_tier text,
      verification_environment_id text, campaign_key text, provider_location_id text,
      provider_campaign_id text, provider_workflow_id text, provider_launch_tag_id text
    );
  `);
  await pool.query(
    `ALTER TABLE onetime.adult_ghl_identity_link
       ALTER COLUMN suppression_json SET DEFAULT
       jsonb_build_object(
         'marketing_suppressed', false,
         'service_suppressed', false,
         'evidence_digest', repeat('a', 64),
         'version', 1
       )`,
  );
}
