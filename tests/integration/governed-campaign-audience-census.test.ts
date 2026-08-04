import { createHash } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, describe, expect, it, vi } from 'vitest';

import {
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
const HASH_A = governedCampaignProviderContactRefHash(LOCATION, 'synthetic-integration-a');
const HASH_B = governedCampaignProviderContactRefHash(LOCATION, 'synthetic-integration-b');
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

  it('proves exact account joins, canonical suppression, and Student absence without raw output', async () => {
    assertDisposableLoopback(nativeUrl!);
    await pool.query('DROP SCHEMA IF EXISTS onetime CASCADE');
    await pool.query('CREATE SCHEMA onetime');
    await createNativeSchema(pool);
    const email = 'adult-census@example.invalid';
    const emailHash = createHash('sha256').update(email).digest('hex');
    await pool.query(
      `INSERT INTO onetime.v21_adult_identities VALUES
         ('adult-1', 'active', $1, $2, $3),
         ('adult-decoy', 'active', $1, $2, $3)`,
      [SCOPE.productKey, SCOPE.runtimeTier, SCOPE.verificationEnvironmentId],
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
      [emailHash, HASH_A, SCOPE.productKey, SCOPE.runtimeTier, SCOPE.verificationEnvironmentId],
    );
    await pool.query(
      `INSERT INTO onetime.contacts VALUES
         ('contact-canonical', $1, $2, $3, 'family', 'active', 'policy-v1', now()),
         ('contact-cross-account-decoy', 'another-account', $2, $3, 'school', 'suppressed', NULL, NULL)`,
      [SCOPE.accountKey, SCOPE.productKey, email],
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
    const result = await createPostgresGovernedCampaignCensusReader(pool).read({
      scope: SCOPE,
      providerContactRefHashes: [HASH_A],
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
    });
    expect(JSON.stringify(result)).not.toContain(email);

    await pool.query(
      `UPDATE onetime.adult_ghl_identity_link
          SET suppression_json = '{"marketing_suppressed":false}'::jsonb
        WHERE adult_id = 'adult-1'`,
    );
    const malformed = await createPostgresGovernedCampaignCensusReader(pool).read({
      scope: SCOPE,
      providerContactRefHashes: [HASH_A],
      maximumProviderContacts: 10,
    });
    expect(malformed.databaseFacts.get(HASH_A)).toMatchObject({
      consentState: 'unknown',
      providerSuppressionState: 'unknown',
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
    identityHashContractState: 'compatible',
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
      adult_id text PRIMARY KEY, state text NOT NULL, product_key text NOT NULL,
      runtime_tier text NOT NULL,
      verification_environment_id text NOT NULL
    );
    CREATE TABLE onetime.adult_ghl_identity_link (
      adult_id text PRIMARY KEY, normalized_email_hash text NOT NULL, state text NOT NULL,
      verified_contact_ref_hash text, suppression_json jsonb NOT NULL,
      product_key text NOT NULL, runtime_tier text NOT NULL, verification_environment_id text NOT NULL
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
