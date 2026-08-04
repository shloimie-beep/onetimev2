import { describe, expect, it } from 'vitest';

import {
  buildGovernedCampaignCensusPlan,
  governedCampaignCensusDecisionKey,
  governedCampaignProviderContactRefHash,
  type GovernedCensusDatabaseFacts,
  type GovernedCensusDecisionHistory,
  type GovernedCensusSha256,
  type ProtectedGovernedCensusProviderContact,
} from './governed-campaign-census.ts';

const LOCATION_ID = 'pBSnOK2nkdxp6gf9Rg3o';
const HASH_A = governedCampaignProviderContactRefHash(LOCATION_ID, 'synthetic-provider-a');
const HASH_B = governedCampaignProviderContactRefHash(LOCATION_ID, 'synthetic-provider-b');
const HASH_C = governedCampaignProviderContactRefHash(LOCATION_ID, 'synthetic-provider-c');

describe('governed campaign census policy', () => {
  it('includes only a fully proven inactive adult', () => {
    const plan = planFor([provider(HASH_A)], new Map([[HASH_A, database(HASH_A)]]));

    expect(plan.decisions[0]).toMatchObject({
      decision: 'include',
      primaryReason: 'eligible_inactive_adult',
      reasonCodes: ['eligible_inactive_adult'],
      decisionVersion: 1,
      decisionKey: governedCampaignCensusDecisionKey(HASH_A, 1),
    });
    expect(plan.counts).toMatchObject({ total: 1, include: 1, exclude: 0, review: 0 });
    expect(JSON.stringify(plan)).not.toContain('synthetic-provider-a');
  });

  it.each([
    ['student', { studentOrMinorState: 'present' }, 'student_or_minor'],
    ['school', { schoolContactState: 'present' }, 'school_contact'],
    [
      'current access',
      { activeOrCurrentSubscriberState: 'present' },
      'active_or_current_subscriber',
    ],
    ['opted out', { consentState: 'opted_out' }, 'email_dnd_or_unsubscribed'],
    ['suppressed', { providerSuppressionState: 'suppressed' }, 'provider_suppression'],
    ['duplicate', { identityMatchState: 'duplicate' }, 'duplicate_contact'],
  ] as const)('excludes %s evidence deterministically', (_label, override, primaryReason) => {
    const providerOverride =
      'providerSuppressionState' in override || 'consentState' in override
        ? provider(HASH_A, override)
        : provider(HASH_A);
    const databaseOverride =
      'providerSuppressionState' in override || 'consentState' in override ? override : override;
    const plan = planFor(
      [providerOverride],
      new Map([[HASH_A, database(HASH_A, databaseOverride)]]),
    );

    expect(plan.decisions[0]).toMatchObject({ decision: 'exclude', primaryReason });
  });

  it('reviews unknown adult, consent, identity, access, and school evidence', () => {
    const plan = planFor(
      [provider(HASH_A, { consentState: 'unknown' })],
      new Map([
        [
          HASH_A,
          database(HASH_A, {
            adultEvidenceState: 'not_proven',
            studentOrMinorState: 'unknown',
            schoolContactState: 'unknown',
            activeOrCurrentSubscriberState: 'unknown',
            consentState: 'unknown',
            identityMatchState: 'missing',
          }),
        ],
      ]),
    );

    expect(plan.decisions[0]).toMatchObject({
      decision: 'review',
      primaryReason: 'ambiguous_identity',
    });
    expect(plan.decisions[0]!.reasonCodes).toContain('unknown_consent');
  });

  it('is provider-order independent and uses full protected hashes in decision keys', () => {
    const facts = new Map([
      [HASH_A, database(HASH_A)],
      [HASH_B, database(HASH_B)],
    ]);
    const left = planFor([provider(HASH_A), provider(HASH_B)], facts);
    const right = planFor([provider(HASH_B), provider(HASH_A)], facts);

    expect(left.snapshotHash).toBe(right.snapshotHash);
    expect(left.decisions).toEqual(right.decisions);
    for (const decision of left.decisions) {
      expect(decision.decisionKey).toBe(
        `governed-campaign:${decision.providerContactRefHash}:v${decision.decisionVersion}`,
      );
      expect(decision.decisionKey).toContain(decision.providerContactRefHash);
    }
  });

  it('reuses an exact current decision and advances reintroduced contacts from historical max', () => {
    const initial = planFor([provider(HASH_A)], new Map([[HASH_A, database(HASH_A)]]));
    const first = initial.decisions[0]!;
    const exactHistory: GovernedCensusDecisionHistory = {
      providerContactRefHash: HASH_A,
      maximumDecisionVersion: 4,
      currentDecisionVersion: 4,
      currentDecision: first.decision,
      currentPrimaryReason: first.primaryReason,
      currentSourceFactsHash: first.sourceFacts.sourceFactsHash,
      currentIdempotencyKey: 'census-replay-1',
      currentRequestHash: HASH_B,
      currentSnapshotHash: HASH_C,
    };
    const replay = planFor(
      [provider(HASH_A)],
      new Map([[HASH_A, database(HASH_A)]]),
      new Map([[HASH_A, exactHistory]]),
      'exact_replay_candidate',
    );
    expect(replay.decisions[0]!.decisionVersion).toBe(4);

    const newRequest = planFor(
      [provider(HASH_A)],
      new Map([[HASH_A, database(HASH_A)]]),
      new Map([[HASH_A, exactHistory]]),
      'new_request',
    );
    expect(newRequest.decisions[0]!.decisionVersion).toBe(5);

    const reintroduced = planFor(
      [provider(HASH_A)],
      new Map([[HASH_A, database(HASH_A)]]),
      new Map([
        [
          HASH_A,
          {
            ...exactHistory,
            currentDecisionVersion: null,
            currentDecision: null,
            currentPrimaryReason: null,
            currentSourceFactsHash: null,
            currentIdempotencyKey: null,
            currentRequestHash: null,
            currentSnapshotHash: null,
          },
        ],
      ]),
    );
    expect(reintroduced.decisions[0]).toMatchObject({
      decisionVersion: 5,
      decisionKey: governedCampaignCensusDecisionKey(HASH_A, 5),
    });
  });

  it('fails closed on duplicate references and the operator provider ceiling', () => {
    const facts = new Map([[HASH_A, database(HASH_A)]]);
    expect(() => planFor([provider(HASH_A), provider(HASH_A)], facts)).toThrow(
      /duplicate protected reference/iu,
    );
    expect(() =>
      buildGovernedCampaignCensusPlan({
        providerContacts: [provider(HASH_A), provider(HASH_B)],
        databaseFacts: facts,
        history: new Map(),
        maximumProviderContacts: 1,
        versionMode: 'new_request',
      }),
    ).toThrow(/maximumProviderContacts/iu);
  });

  it('runtime-validates provider and database enums', () => {
    expect(() =>
      planFor(
        [provider(HASH_A, { consentState: 'malformed' as 'opted_in' })],
        new Map([[HASH_A, database(HASH_A)]]),
      ),
    ).toThrow(/provider\.consentState is invalid/iu);
    expect(() =>
      planFor(
        [provider(HASH_A)],
        new Map([[HASH_A, database(HASH_A, { identityMatchState: 'malformed' as 'exact' })]]),
      ),
    ).toThrow(/identityMatchState is invalid/iu);
  });

  it('rejects incoherent history, mismatched hashes, and unsafe increments', () => {
    const initial = planFor([provider(HASH_A)], new Map([[HASH_A, database(HASH_A)]]));
    const first = initial.decisions[0]!;
    const coherent: GovernedCensusDecisionHistory = {
      providerContactRefHash: HASH_A,
      maximumDecisionVersion: 1,
      currentDecisionVersion: 1,
      currentDecision: first.decision,
      currentPrimaryReason: first.primaryReason,
      currentSourceFactsHash: first.sourceFacts.sourceFactsHash,
      currentIdempotencyKey: 'census-request-1',
      currentRequestHash: HASH_B,
      currentSnapshotHash: HASH_C,
    };
    expect(() =>
      planFor(
        [provider(HASH_A)],
        new Map([[HASH_A, database(HASH_A)]]),
        new Map([[HASH_A, { ...coherent, providerContactRefHash: HASH_B }]]),
      ),
    ).toThrow(/history provider hash mismatch/iu);
    expect(() =>
      planFor(
        [provider(HASH_A)],
        new Map([[HASH_A, database(HASH_A)]]),
        new Map([[HASH_A, { ...coherent, currentRequestHash: null }]]),
      ),
    ).toThrow(/decision history is invalid/iu);
    expect(() =>
      planFor(
        [provider(HASH_A)],
        new Map([[HASH_A, database(HASH_A)]]),
        new Map([
          [
            HASH_A,
            {
              ...coherent,
              maximumDecisionVersion: Number.MAX_SAFE_INTEGER,
              currentDecisionVersion: Number.MAX_SAFE_INTEGER,
            },
          ],
        ]),
      ),
    ).toThrow(/decision version would overflow/iu);
    expect(() =>
      planFor(
        [provider(HASH_A)],
        new Map([[HASH_A, database(HASH_A, { sourceJoinCount: Number.MAX_SAFE_INTEGER })]]),
      ),
    ).toThrow(/cannot be incremented safely/iu);
  });
});

function planFor(
  providerContacts: readonly ProtectedGovernedCensusProviderContact[],
  databaseFacts: ReadonlyMap<string, GovernedCensusDatabaseFacts>,
  history: ReadonlyMap<string, GovernedCensusDecisionHistory> = new Map(),
  versionMode: 'new_request' | 'exact_replay_candidate' = 'new_request',
) {
  return buildGovernedCampaignCensusPlan({
    providerContacts,
    databaseFacts,
    history,
    maximumProviderContacts: 10,
    versionMode,
  });
}

function provider(
  providerContactRefHash: GovernedCensusSha256,
  override: Partial<ProtectedGovernedCensusProviderContact> = {},
): ProtectedGovernedCensusProviderContact {
  return {
    providerContactRefHash,
    identityHashContractState: 'compatible',
    consentState: 'opted_in',
    deliverabilityState: 'deliverable',
    providerSuppressionState: 'active',
    ...override,
  };
}

function database(
  providerContactRefHash: GovernedCensusSha256,
  override: Partial<GovernedCensusDatabaseFacts> = {},
): GovernedCensusDatabaseFacts {
  return {
    providerContactRefHash,
    contactKey: null,
    adultEvidenceState: 'proven',
    studentOrMinorState: 'absent',
    schoolContactState: 'absent',
    activeOrCurrentSubscriberState: 'absent',
    consentState: 'opted_in',
    deliverabilityState: 'deliverable',
    providerSuppressionState: 'active',
    identityMatchState: 'exact',
    sourceJoinCount: 2,
    ...override,
  };
}
