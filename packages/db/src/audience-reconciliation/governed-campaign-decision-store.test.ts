import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';
import {
  GovernedCampaignDecisionStoreError,
  createPostgresGovernedCampaignAudienceDecisionStore,
  governedCampaignDecisionKey,
  governedCampaignRequestHash,
  type GovernedCampaignDecisionStoreSqlClient,
  type GovernedCampaignDecisionStoreSqlPool,
  type GovernedCampaignSha256,
  type ReconcileGovernedCampaignAudienceRequest,
} from './governed-campaign-decision-store.ts';
import { GOVERNED_CAMPAIGN_PROVIDER_BINDING } from './governed-campaign-decision-store.proposal.ts';

const CONTACT_HASH = digest('contact-a');
const SOURCE_FACTS_HASH = digest('facts-a');
const SNAPSHOT_HASH = digest('snapshot-a');

describe('governed campaign decision store transaction contract', () => {
  it('rejects a non-positive maximumAffectedRows before opening a connection', async () => {
    let connections = 0;
    const store = createPostgresGovernedCampaignAudienceDecisionStore({
      async connect() {
        connections += 1;
        throw new Error('must not connect');
      },
    });

    await expect(store.reconcile(request({ maximumAffectedRows: 0 }))).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    });
    expect(connections).toBe(0);
  });

  it('rejects raw-looking, hash-mismatched, and version-mismatched decision keys', async () => {
    let connections = 0;
    const store = createPostgresGovernedCampaignAudienceDecisionStore({
      async connect() {
        connections += 1;
        throw new Error('must not connect');
      },
    });
    const rawLooking = request({ decisionKey: 'oc32RawGhlContactIdentifier' });
    const hashMismatch = request({
      decisionKey: governedCampaignDecisionKey(digest('different-contact'), 1),
    });
    const versionMismatch = request({
      decisionKey: governedCampaignDecisionKey(CONTACT_HASH, 2),
    });

    for (const candidate of [rawLooking, hashMismatch, versionMismatch]) {
      await expect(store.reconcile(candidate)).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    }
    expect(connections).toBe(0);
  });

  it('locks current base rows and derives a reintroduced contact version from immutable history', async () => {
    const sql: string[] = [];
    const client = scriptedClient((text) => {
      sql.push(text);
      if (
        /FROM onetime\.governed_campaign_audience_decisions[\s\S]*superseded_at IS NULL/iu.test(
          text,
        )
      ) {
        return { rows: [], rowCount: 0 };
      }
      if (/idempotency_key = \$10/iu.test(text)) return { rows: [], rowCount: 0 };
      if (/max\(decision_version\)/iu.test(text)) {
        return {
          rows: [{ provider_contact_ref_hash: CONTACT_HASH, max_decision_version: '2' }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    const store = createPostgresGovernedCampaignAudienceDecisionStore(poolFor(client));

    await expect(store.reconcile(request({ decisionVersion: 1 }))).rejects.toMatchObject({
      code: 'DECISION_VERSION_CONFLICT',
      message: expect.stringContaining('must be 3'),
    });
    expect(sql.find((text) => /superseded_at IS NULL/iu.test(text))).toMatch(/FOR UPDATE/iu);
    expect(sql.some((text) => /max\(decision_version\)/iu.test(text))).toBe(true);
    expect(sql.at(-1)).toBe('ROLLBACK');
  });

  it('rolls back an unknown result once and never retries automatically', async () => {
    let connections = 0;
    const sql: string[] = [];
    const client = scriptedClient((text) => {
      sql.push(text);
      if (/SELECT[\s\S]*governed_campaign_audience_decisions/iu.test(text)) {
        throw new Error('synthetic unknown read');
      }
      return { rows: [], rowCount: 0 };
    });
    const store = createPostgresGovernedCampaignAudienceDecisionStore({
      async connect() {
        connections += 1;
        return client;
      },
    });

    let error: unknown;
    try {
      await store.reconcile(request());
    } catch (candidate) {
      error = candidate;
    }
    expect(error).toBeInstanceOf(GovernedCampaignDecisionStoreError);
    expect(error).toMatchObject({ code: 'TRANSACTION_FAILED_NO_RETRY' });
    expect(connections).toBe(1);
    expect(sql.filter((text) => text === 'ROLLBACK')).toHaveLength(1);
  });
});

function request(
  overrides: {
    maximumAffectedRows?: number;
    decisionVersion?: number;
    decisionKey?: string;
  } = {},
): ReconcileGovernedCampaignAudienceRequest {
  const withoutHash: Omit<ReconcileGovernedCampaignAudienceRequest, 'requestHash'> = {
    runtimeTier: 'isolated_staging',
    verificationEnvironmentId: 'ot-live-002-unit',
    accountKey: 'one_time',
    productKey: 'one_time_mishnah_class',
    campaignKey: 'ot-15-former-member-reactivation',
    binding: GOVERNED_CAMPAIGN_PROVIDER_BINDING,
    idempotencyKey: 'unit-request-1',
    snapshotHash: SNAPSHOT_HASH,
    sourceObservedAt: '2026-08-04T12:00:00.000Z',
    createdByUserKey: 'ot-live-002-unit',
    expectedDecisionRows: 1,
    maximumAffectedRows: overrides.maximumAffectedRows ?? 2,
    decisions: [
      {
        decisionKey:
          overrides.decisionKey ??
          governedCampaignDecisionKey(CONTACT_HASH, overrides.decisionVersion ?? 1),
        providerContactRefHash: CONTACT_HASH,
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
          sourceFactsHash: SOURCE_FACTS_HASH,
        },
        decisionVersion: overrides.decisionVersion ?? 1,
      },
    ],
  };
  return { ...withoutHash, requestHash: governedCampaignRequestHash(withoutHash) };
}

function scriptedClient(
  handle: (
    text: string,
    values?: readonly unknown[],
  ) => { rows: Record<string, unknown>[]; rowCount: number },
): GovernedCampaignDecisionStoreSqlClient {
  return {
    async query<Row extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      values?: readonly unknown[],
    ) {
      return handle(text, values) as { rows: Row[]; rowCount: number };
    },
    release() {},
  };
}

function poolFor(
  client: GovernedCampaignDecisionStoreSqlClient,
): GovernedCampaignDecisionStoreSqlPool {
  return {
    async connect() {
      return client;
    },
  };
}

function digest(value: string): GovernedCampaignSha256 {
  return createHash('sha256').update(value).digest('hex') as GovernedCampaignSha256;
}
