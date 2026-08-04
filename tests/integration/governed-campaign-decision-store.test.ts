import { createHash } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  GOVERNED_CAMPAIGN_PROVIDER_BINDING,
  createMemoryPool,
  createPostgresGovernedCampaignAudienceDecisionStore,
  governedCampaignDecisionKey,
  governedCampaignRequestHash,
  runMigrations,
  type DbPool,
  type GovernedCampaignAudienceDecisionInput,
  type GovernedCampaignSha256,
  type ReconcileGovernedCampaignAudienceRequest,
} from '../../packages/db/src/index.ts';

const CONTACT_A = digest('provider-contact-a');
const CONTACT_B = digest('provider-contact-b');

describe('governed campaign decision store pg-mem integration', () => {
  let pool: DbPool;

  beforeAll(async () => {
    pool = createMemoryPool();
    await runMigrations(pool);
  }, 30_000);

  beforeEach(async () => {
    await pool.query('DELETE FROM onetime.governed_campaign_audience_decisions');
  });

  afterAll(async () => {
    await pool.end();
  });

  it('writes once, replays with zero writes, and rejects an idempotency conflict', async () => {
    const store = createPostgresGovernedCampaignAudienceDecisionStore(pool);
    const initial = request({
      idempotencyKey: 'snapshot-1',
      snapshot: 'snapshot-1',
      maximumAffectedRows: 2,
      decisions: [decision(CONTACT_A, 1), decision(CONTACT_B, 1)],
    });

    await expect(store.reconcile(initial)).resolves.toMatchObject({
      replayed: false,
      insertedRows: 2,
      supersededRows: 0,
      affectedRows: 2,
      mutationStatements: 1,
      currentRows: 2,
      contactEffects: 0,
      providerEffects: 0,
      sendEffects: 0,
    });
    await expect(store.reconcile(initial)).resolves.toMatchObject({
      replayed: true,
      insertedRows: 0,
      supersededRows: 0,
      affectedRows: 0,
      mutationStatements: 0,
    });

    const conflict = request({
      idempotencyKey: 'snapshot-1',
      snapshot: 'different-snapshot',
      maximumAffectedRows: 2,
      decisions: [decision(CONTACT_A, 1), decision(CONTACT_B, 1)],
    });
    await expect(store.reconcile(conflict)).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    await expect(currentVersions(pool)).resolves.toEqual([
      { providerContactRefHash: CONTACT_A, decisionVersion: 1 },
      { providerContactRefHash: CONTACT_B, decisionVersion: 1 },
    ]);
  });

  it('uses maximum immutable history when a contact disappears and is later reintroduced', async () => {
    const store = createPostgresGovernedCampaignAudienceDecisionStore(pool);
    await store.reconcile(
      request({
        idempotencyKey: 'history-1',
        snapshot: 'history-1',
        maximumAffectedRows: 2,
        decisions: [decision(CONTACT_A, 1), decision(CONTACT_B, 1)],
      }),
    );
    await store.reconcile(
      request({
        idempotencyKey: 'history-2',
        snapshot: 'history-2',
        maximumAffectedRows: 3,
        decisions: [decision(CONTACT_B, 2)],
      }),
    );

    const reintroduced = await store.reconcile(
      request({
        idempotencyKey: 'history-3',
        snapshot: 'history-3',
        maximumAffectedRows: 2,
        decisions: [decision(CONTACT_A, 2)],
      }),
    );
    expect(reintroduced).toMatchObject({
      insertedRows: 1,
      supersededRows: 1,
      affectedRows: 2,
      currentRows: 1,
    });
    await expect(currentVersions(pool)).resolves.toEqual([
      { providerContactRefHash: CONTACT_A, decisionVersion: 2 },
    ]);

    await expect(
      store.reconcile(
        request({
          idempotencyKey: 'history-bad',
          snapshot: 'history-bad',
          maximumAffectedRows: 2,
          decisions: [decision(CONTACT_B, 2)],
        }),
      ),
    ).rejects.toMatchObject({ code: 'DECISION_VERSION_CONFLICT' });
  });

  it('precomputes the insert-plus-supersede ceiling and rolls back without changing projection', async () => {
    const store = createPostgresGovernedCampaignAudienceDecisionStore(pool);
    await store.reconcile(
      request({
        idempotencyKey: 'ceiling-1',
        snapshot: 'ceiling-1',
        maximumAffectedRows: 1,
        decisions: [decision(CONTACT_A, 1)],
      }),
    );

    await expect(
      store.reconcile(
        request({
          idempotencyKey: 'ceiling-2',
          snapshot: 'ceiling-2',
          maximumAffectedRows: 1,
          decisions: [decision(CONTACT_A, 2)],
        }),
      ),
    ).rejects.toMatchObject({ code: 'AFFECTED_ROWS_CEILING' });
    await expect(currentVersions(pool)).resolves.toEqual([
      { providerContactRefHash: CONTACT_A, decisionVersion: 1 },
    ]);
  });

  it('isolates identical provider contacts by verification environment', async () => {
    const store = createPostgresGovernedCampaignAudienceDecisionStore(pool);
    await store.reconcile(
      request({
        verificationEnvironmentId: 'ot-live-002-a',
        idempotencyKey: 'environment-a',
        snapshot: 'environment-a',
        maximumAffectedRows: 1,
        decisions: [decision(CONTACT_A, 1)],
      }),
    );
    await store.reconcile(
      request({
        verificationEnvironmentId: 'ot-live-002-b',
        idempotencyKey: 'environment-b',
        snapshot: 'environment-b',
        maximumAffectedRows: 1,
        decisions: [decision(CONTACT_A, 1)],
      }),
    );

    const rows = await pool.query<{ verification_environment_id: string }>(
      `SELECT verification_environment_id
         FROM onetime.governed_campaign_audience_current
        ORDER BY verification_environment_id`,
    );
    expect(rows.rows.map((row) => row.verification_environment_id)).toEqual([
      'ot-live-002-a',
      'ot-live-002-b',
    ]);
  });
});

function request(input: {
  verificationEnvironmentId?: string;
  idempotencyKey: string;
  snapshot: string;
  maximumAffectedRows: number;
  decisions: readonly GovernedCampaignAudienceDecisionInput[];
}): ReconcileGovernedCampaignAudienceRequest {
  const withoutHash: Omit<ReconcileGovernedCampaignAudienceRequest, 'requestHash'> = {
    runtimeTier: 'isolated_staging',
    verificationEnvironmentId: input.verificationEnvironmentId ?? 'ot-live-002-pgmem',
    accountKey: 'one_time',
    productKey: 'one_time_mishnah_class',
    campaignKey: 'ot-15-former-member-reactivation',
    binding: GOVERNED_CAMPAIGN_PROVIDER_BINDING,
    idempotencyKey: input.idempotencyKey,
    snapshotHash: digest(input.snapshot),
    sourceObservedAt: '2026-08-04T12:00:00.000Z',
    createdByUserKey: 'ot-live-002-integration',
    expectedDecisionRows: input.decisions.length,
    maximumAffectedRows: input.maximumAffectedRows,
    decisions: input.decisions,
  };
  return { ...withoutHash, requestHash: governedCampaignRequestHash(withoutHash) };
}

function decision(
  providerContactRefHash: GovernedCampaignSha256,
  decisionVersion: number,
): GovernedCampaignAudienceDecisionInput {
  return {
    decisionKey: governedCampaignDecisionKey(providerContactRefHash, decisionVersion),
    providerContactRefHash,
    contactKey: null,
    decision: 'include',
    primaryReason: 'eligible_inactive_adult',
    reasonCodes: ['eligible_inactive_adult'],
    sourceFacts: {
      adultEvidenceState: 'proven',
      studentOrMinorState: 'absent',
      schoolContactState: 'absent',
      activeOrCurrentSubscriberState: 'absent',
      consentState: 'opted_in',
      deliverabilityState: 'deliverable',
      providerSuppressionState: 'active',
      identityMatchState: 'exact',
      sourceJoinCount: 1,
      sourceFactsHash: digest(`source-facts-${providerContactRefHash}`),
    },
    decisionVersion,
  };
}

async function currentVersions(pool: DbPool) {
  const rows = await pool.query<{
    provider_contact_ref_hash: string;
    decision_version: string | number;
  }>(
    `SELECT provider_contact_ref_hash, decision_version
       FROM onetime.governed_campaign_audience_current
      WHERE verification_environment_id = 'ot-live-002-pgmem'
      ORDER BY provider_contact_ref_hash`,
  );
  return rows.rows.map((row) => ({
    providerContactRefHash: row.provider_contact_ref_hash,
    decisionVersion: Number(row.decision_version),
  }));
}

function digest(value: string): GovernedCampaignSha256 {
  return createHash('sha256').update(value).digest('hex') as GovernedCampaignSha256;
}
