import { describe, expect, it, vi } from 'vitest';

import {
  governedCampaignCanonicalSha256,
  governedCampaignProviderContactRefHash,
  type GovernedCensusSha256,
} from '../../../domain/src/audience-reconciliation/governed-campaign-census.ts';
import { GOVERNED_CAMPAIGN_PROVIDER_BINDING } from './governed-campaign-decision-store.ts';
import {
  createPostgresGovernedCampaignCensusReader,
  type GovernedCampaignCensusReaderSqlClient,
} from './governed-campaign-census-reader.ts';

const HASH = governedCampaignProviderContactRefHash(
  GOVERNED_CAMPAIGN_PROVIDER_BINDING.providerLocationId,
  'synthetic-protected-contact',
);
const DIGEST = 'a'.repeat(64) as GovernedCensusSha256;
const scope = {
  runtimeTier: 'isolated_staging' as const,
  verificationEnvironmentId: 'ci',
  accountKey: 'account-one-time',
  productKey: 'one_time_mishnayos',
  campaignKey: 'ot-15-elul-2026',
  binding: GOVERNED_CAMPAIGN_PROVIDER_BINDING,
};

describe('governed campaign census read-only repository', () => {
  it('uses an exact READ ONLY transaction and derives account-scoped canonical facts', async () => {
    const { client, sql } = fakeClient({
      facts: [factRow()],
      history: [],
      currentRows: 0,
    });
    const reader = createPostgresGovernedCampaignCensusReader({
      connect: vi.fn(async () => client),
    });

    const result = await reader.read({
      scope,
      providerContactRefHashes: [HASH],
      maximumProviderContacts: 10,
    });

    expect(sql[0]!.text).toBe('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    expect(sql[1]!.text).toContain('onetime.contacts AS contact');
    expect(sql[1]!.text).toContain('contact.account_key = exact_scope.account_key');
    expect(sql[1]!.text).toContain(
      "sha256(convert_to(lower(btrim(contact.email_normalized)), 'UTF8'))",
    );
    expect(sql[1]!.text).toContain('onetime.highlevel_contact_preferences');
    expect(sql[1]!.text).toContain('onetime.v21_student_profiles');
    expect(sql[1]!.values?.slice(0, 5)).toEqual([
      scope.accountKey,
      scope.productKey,
      scope.runtimeTier,
      scope.verificationEnvironmentId,
      scope.campaignKey,
    ]);
    expect(sql.at(-1)!.text).toBe('COMMIT');
    expect(sql.every(({ text }) => !/\b(?:INSERT|UPDATE|DELETE)\b/iu.test(text))).toBe(true);
    expect(result.databaseFacts.get(HASH)).toEqual({
      providerContactRefHash: HASH,
      contactKey: 'contact-adult-1',
      adultEvidenceState: 'proven',
      studentOrMinorState: 'absent',
      schoolContactState: 'absent',
      activeOrCurrentSubscriberState: 'absent',
      consentState: 'opted_in',
      deliverabilityState: 'deliverable',
      providerSuppressionState: 'active',
      identityMatchState: 'exact',
      sourceJoinCount: 1,
    });
  });

  it('fails closed on malformed suppression evidence and archived adults', async () => {
    const { client } = fakeClient({
      facts: [
        factRow({
          suppression_json: { marketing_suppressed: false },
          adult_state: 'archived',
        }),
      ],
      history: [],
      currentRows: 0,
    });
    const result = await createPostgresGovernedCampaignCensusReader({
      connect: vi.fn(async () => client),
    }).read({ scope, providerContactRefHashes: [HASH], maximumProviderContacts: 10 });

    expect(result.databaseFacts.get(HASH)).toMatchObject({
      adultEvidenceState: 'not_proven',
      consentState: 'unknown',
      providerSuppressionState: 'unknown',
    });
  });

  it('returns coherent replay metadata and validates the full source-facts hash', async () => {
    const sourceFactsWithoutHash = {
      adultEvidenceState: 'proven',
      studentOrMinorState: 'absent',
      schoolContactState: 'absent',
      activeOrCurrentSubscriberState: 'absent',
      consentState: 'opted_in',
      deliverabilityState: 'deliverable',
      providerSuppressionState: 'active',
      identityMatchState: 'exact',
      sourceJoinCount: 2,
    } as const;
    const sourceFactsHash = governedCampaignCanonicalSha256({
      providerContactRefHash: HASH,
      contactKey: 'contact-adult-1',
      ...sourceFactsWithoutHash,
    });
    const { client } = fakeClient({
      facts: [factRow()],
      history: [
        {
          provider_contact_ref_hash: HASH,
          decision_version: '7',
          superseded_at: null,
          decision: 'include',
          primary_reason: 'eligible_inactive_adult',
          contact_key: 'contact-adult-1',
          source_facts: { ...sourceFactsWithoutHash, sourceFactsHash },
          idempotency_key: 'census-request-7',
          request_hash: 'b'.repeat(64),
          snapshot_hash: 'c'.repeat(64),
        },
      ],
      currentRows: 1,
    });
    const result = await createPostgresGovernedCampaignCensusReader({
      connect: vi.fn(async () => client),
    }).read({ scope, providerContactRefHashes: [HASH], maximumProviderContacts: 10 });

    expect(result.history.get(HASH)).toMatchObject({
      maximumDecisionVersion: 7,
      currentDecisionVersion: 7,
      currentSourceFactsHash: sourceFactsHash,
      currentIdempotencyKey: 'census-request-7',
      currentRequestHash: 'b'.repeat(64),
      currentSnapshotHash: 'c'.repeat(64),
    });
  });

  it('rolls back an unknown read result without retry', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error('synthetic database failure'))
      .mockResolvedValueOnce({ rows: [] });
    const client = { query, release: vi.fn() } as unknown as GovernedCampaignCensusReaderSqlClient;
    const connect = vi.fn(async () => client);
    const reader = createPostgresGovernedCampaignCensusReader({ connect });

    await expect(
      reader.read({ scope, providerContactRefHashes: [HASH], maximumProviderContacts: 10 }),
    ).rejects.toMatchObject({ code: 'READ_ONLY_TRANSACTION_FAILED' });
    expect(query.mock.calls.map(([text]) => text)).toEqual([
      'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
      expect.stringContaining('WITH requested'),
      'ROLLBACK',
    ]);
    expect(connect).toHaveBeenCalledTimes(1);
  });
});

function factRow(override: Record<string, unknown> = {}) {
  return {
    provider_contact_ref_hash: HASH,
    adult_id: 'adult-synthetic-1',
    link_state: 'linked',
    suppression_json: {
      marketing_suppressed: false,
      service_suppressed: false,
      evidence_digest: DIGEST,
      version: 1,
    },
    adult_state: 'active',
    household_id: 'household-synthetic-1',
    classification: 'family',
    access_projection: 'inactive',
    contact_key: 'contact-adult-1',
    contact_classification: 'family',
    contact_suppression_state: 'active',
    consent_proven: true,
    contact_email_present: true,
    contact_email_shape_valid: true,
    preferences_present: true,
    email_dnd: false,
    all_dnd: false,
    self_student_count: '0',
    ...override,
  };
}

function fakeClient(input: {
  facts: readonly Record<string, unknown>[];
  history: readonly Record<string, unknown>[];
  currentRows: number;
}) {
  const sql: Array<{ text: string; values?: readonly unknown[] }> = [];
  let read = 0;
  const client: GovernedCampaignCensusReaderSqlClient = {
    async query<Row extends Record<string, unknown>>(text: string, values?: readonly unknown[]) {
      sql.push(values === undefined ? { text } : { text, values });
      if (/^BEGIN|^COMMIT|^ROLLBACK/u.test(text)) return { rows: [] as Row[] };
      read += 1;
      if (read === 1) return { rows: input.facts as Row[] };
      if (read === 2) return { rows: input.history as Row[] };
      return { rows: [{ rows: String(input.currentRows) }] as unknown as Row[] };
    },
    release: vi.fn(),
  };
  return { client, sql };
}
