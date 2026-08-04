import { describe, expect, it, vi } from 'vitest';

import {
  governedCampaignProviderContactRefHash,
  type GovernedCensusDatabaseFacts,
  type GovernedCensusSha256,
  type ProtectedGovernedCensusProviderContact,
} from '../../packages/domain/src/audience-reconciliation/governed-campaign-census.ts';
import { GOVERNED_CAMPAIGN_PROVIDER_BINDING } from '../../packages/db/src/audience-reconciliation/governed-campaign-decision-store.ts';
import {
  prepareGovernedCampaignAudienceCensus,
  createReadOnlyHighLevelCensusTransport,
  HIGHLEVEL_CANONICAL_API_VERSION,
  HIGHLEVEL_CANONICAL_ORIGIN,
  parseHighLevelPage,
  readBoundedProviderContacts,
  runGovernedCampaignAudienceCensusEntrypoint,
  type GovernedCampaignCensusProviderTransport,
  type GovernedCampaignCensusProviderPage,
} from './governed-campaign-audience-census.ts';

const LOCATION = GOVERNED_CAMPAIGN_PROVIDER_BINDING.providerLocationId;
const HASH_A = governedCampaignProviderContactRefHash(LOCATION, 'synthetic-a');
const HASH_B = governedCampaignProviderContactRefHash(LOCATION, 'synthetic-b');

describe('governed campaign audience census runner', () => {
  it('is default off before dependency creation or connection', async () => {
    const createDependencies = vi.fn();
    await expect(
      runGovernedCampaignAudienceCensusEntrypoint({}, createDependencies),
    ).rejects.toMatchObject({
      code: 'DEFAULT_OFF',
    });
    expect(createDependencies).not.toHaveBeenCalled();
  });

  it('pins the official provider origin/version and closes dependencies after success', async () => {
    let observedUrl = '';
    let observedVersion = '';
    const fetchImplementation = vi.fn(async (request: URL | RequestInfo, init?: RequestInit) => {
      observedUrl = String(request);
      observedVersion = new Headers(init?.headers).get('Version') ?? '';
      return new Response(
        JSON.stringify({
          contacts: [rawContact('provider-page-1', 'inactive')],
          count: 1,
        }),
        { status: 200 },
      );
    });
    const transport = createReadOnlyHighLevelCensusTransport({
      privateIntegrationsToken: 'synthetic-token-not-logged',
      fetchImplementation,
    });
    await transport.readContactsPage({ locationId: LOCATION, cursor: null, limit: 10 });
    expect(observedUrl.startsWith(`${HIGHLEVEL_CANONICAL_ORIGIN}/contacts/`)).toBe(true);
    expect(observedVersion).toBe(HIGHLEVEL_CANONICAL_API_VERSION);

    const reconcile = vi.fn();
    const close = vi.fn(async () => undefined);
    const dependencies = preparationInput(
      [provider(HASH_A)],
      new Map([[HASH_A, database(HASH_A)]]),
      reconcile,
    );
    await runGovernedCampaignAudienceCensusEntrypoint(
      { GOVERNED_CAMPAIGN_AUDIENCE_CENSUS_ENABLED: 'true' },
      vi.fn(async () => ({ ...dependencies, close })),
    );
    expect(close).toHaveBeenCalledTimes(1);

    const closeAfterFailure = vi.fn(async () => undefined);
    const failureDependencies = preparationInput(
      [provider(HASH_A)],
      new Map([[HASH_A, database(HASH_A)]]),
      reconcile,
    );
    await expect(
      runGovernedCampaignAudienceCensusEntrypoint(
        { GOVERNED_CAMPAIGN_AUDIENCE_CENSUS_ENABLED: 'true' },
        vi.fn(async () => ({
          ...failureDependencies,
          maximumAffectedRows: 1,
          reader: {
            read: vi.fn(async () => ({
              databaseFacts: new Map([[HASH_A, database(HASH_A)]]),
              history: new Map(),
              currentProjectionRows: 1,
              readOnlyTransaction: true as const,
            })),
          },
          close: closeAfterFailure,
        })),
      ),
    ).rejects.toMatchObject({ code: 'AFFECTED_ROWS_CEILING' });
    expect(closeAfterFailure).toHaveBeenCalledTimes(1);
  });

  it('uses the documented top-level count and exact Email DND statuses', () => {
    const inactive = parseHighLevelPage(
      { contacts: [rawContact('provider-inactive', 'inactive')], count: 2 },
      LOCATION,
      1,
    );
    expect(inactive.reportedTotal).toBe(2);
    expect(inactive.nextCursor).toBe('provider-inactive');
    expect(inactive.contacts[0]).toMatchObject({
      consentState: 'unknown',
      providerSuppressionState: 'active',
      identityHashContractState: 'unproven',
    });
    for (const status of ['active', 'permanent']) {
      expect(
        parseHighLevelPage(
          { contacts: [rawContact(`provider-${status}`, status)], count: 1 },
          LOCATION,
          10,
        ).contacts[0],
      ).toMatchObject({ consentState: 'opted_out', providerSuppressionState: 'suppressed' });
    }
    expect(
      parseHighLevelPage(
        {
          contacts: [
            {
              ...rawContact('provider-lowercase-only', 'inactive'),
              dndSettings: { email: { status: 'inactive' } },
            },
          ],
          count: 1,
        },
        LOCATION,
        10,
      ).contacts[0],
    ).toMatchObject({ consentState: 'unknown', providerSuppressionState: 'unknown' });
    expect(() =>
      parseHighLevelPage(
        {
          contacts: [
            {
              ...rawContact('provider-contradiction', 'inactive'),
              dndSettings: {
                Email: { status: 'inactive' },
                email: { status: 'permanent' },
              },
            },
          ],
          count: 1,
        },
        LOCATION,
        10,
      ),
    ).toThrow(/contradictory email DND/iu);
  });

  it('times out a provider read with a sanitized unknown result', async () => {
    const fetchImplementation = vi.fn(
      (_request: URL | RequestInfo, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('synthetic-token-not-logged')),
          );
        }),
    );
    const providerTransport = createReadOnlyHighLevelCensusTransport({
      privateIntegrationsToken: 'synthetic-token-not-logged',
      fetchImplementation,
      timeoutMilliseconds: 1,
    });
    const error = await providerTransport
      .readContactsPage({ locationId: LOCATION, cursor: null, limit: 1 })
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: 'PROVIDER_READ_UNKNOWN' });
    expect(String(error)).not.toContain('synthetic-token-not-logged');
  });

  it('reads bounded complete pages and canonicalizes provider order', async () => {
    const readContactsPage = vi
      .fn()
      .mockResolvedValueOnce(page([provider(HASH_B)], 'cursor-2', 2))
      .mockResolvedValueOnce(page([provider(HASH_A)], null, 2));
    const rows = await readBoundedProviderContacts({ readContactsPage }, 2);

    expect(rows.map((row) => row.providerContactRefHash)).toEqual([HASH_A, HASH_B].sort());
    expect(readContactsPage).toHaveBeenNthCalledWith(1, {
      locationId: LOCATION,
      cursor: null,
      limit: 2,
    });
    expect(readContactsPage).toHaveBeenNthCalledWith(2, {
      locationId: LOCATION,
      cursor: 'cursor-2',
      limit: 2,
    });
  });

  it('rejects repeated cursors, cross-location rows, changed totals, and ceilings', async () => {
    await expect(
      readBoundedProviderContacts(
        transport([page([provider(HASH_A)], 'same', 2), page([provider(HASH_B)], 'same', 2)]),
        2,
      ),
    ).rejects.toMatchObject({ code: 'AMBIGUOUS_PROVIDER_CURSOR' });
    await expect(
      readBoundedProviderContacts(
        transport([{ ...page([provider(HASH_A)], null, 1), locationId: 'another-location' }]),
        1,
      ),
    ).rejects.toMatchObject({ code: 'CROSS_LOCATION_PROVIDER_ROW' });
    await expect(
      readBoundedProviderContacts(
        transport([page([provider(HASH_A)], 'next', 2), page([provider(HASH_B)], null, 3)]),
        3,
      ),
    ).rejects.toMatchObject({ code: 'AMBIGUOUS_PROVIDER_COUNT' });
    await expect(
      readBoundedProviderContacts(
        transport([page([provider(HASH_A), provider(HASH_B)], null, 2)]),
        1,
      ),
    ).rejects.toMatchObject({ code: 'PROVIDER_CONTACT_CEILING' });
  });

  it('composes a sanitized request but never executes the decision store', async () => {
    const reconcile = vi.fn();
    const input = preparationInput(
      [provider(HASH_A)],
      new Map([[HASH_A, database(HASH_A)]]),
      reconcile,
    );
    const result = await prepareGovernedCampaignAudienceCensus(input);

    expect(result.request.binding).toEqual(GOVERNED_CAMPAIGN_PROVIDER_BINDING);
    expect(result.request.expectedDecisionRows).toBe(1);
    expect(result.request.decisions[0]).toMatchObject({
      providerContactRefHash: HASH_A,
      decision: 'include',
      decisionVersion: 1,
    });
    expect(result).toMatchObject({
      plannedAffectedRows: 1,
      exactReplay: false,
      decisionStoreComposed: true,
      decisionStoreExecuted: false,
      providerWriteMethodsAvailable: false,
      databaseEffects: 0,
      providerEffects: 0,
      contactEffects: 0,
      sendEffects: 0,
    });
    expect(reconcile).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('synthetic-a');
  });

  it('forces real provider hashes to review while producer compatibility is unproven', async () => {
    const protectedContact = parseHighLevelPage(
      { contacts: [rawContact('provider-unproven-contract', 'inactive')], count: 1 },
      LOCATION,
      10,
    ).contacts[0]!;
    const result = await prepareGovernedCampaignAudienceCensus(
      preparationInput(
        [protectedContact],
        new Map([
          [
            protectedContact.providerContactRefHash,
            database(protectedContact.providerContactRefHash),
          ],
        ]),
        vi.fn(),
      ),
    );
    expect(result.request.decisions[0]).toMatchObject({
      decision: 'review',
      primaryReason: 'ambiguous_identity',
    });
  });

  it('fails before any write capability when maximumAffectedRows is insufficient', async () => {
    const reconcile = vi.fn();
    await expect(
      prepareGovernedCampaignAudienceCensus({
        ...preparationInput([provider(HASH_A)], new Map([[HASH_A, database(HASH_A)]]), reconcile),
        maximumAffectedRows: 1,
        reader: {
          read: vi.fn(async () => ({
            databaseFacts: new Map([[HASH_A, database(HASH_A)]]),
            history: new Map(),
            currentProjectionRows: 1,
            readOnlyTransaction: true as const,
          })),
        },
      }),
    ).rejects.toMatchObject({ code: 'AFFECTED_ROWS_CEILING' });
    expect(reconcile).not.toHaveBeenCalled();
  });
});

function preparationInput(
  contacts: readonly ProtectedGovernedCensusProviderContact[],
  databaseFacts: ReadonlyMap<string, GovernedCensusDatabaseFacts>,
  reconcile: ReturnType<typeof vi.fn>,
) {
  return {
    scope: {
      runtimeTier: 'isolated_staging' as const,
      verificationEnvironmentId: 'ci',
      accountKey: 'account-one-time',
      productKey: 'one_time_mishnayos',
      campaignKey: 'ot-15-elul-2026',
      binding: GOVERNED_CAMPAIGN_PROVIDER_BINDING,
    },
    provider: transport([page(contacts, null, contacts.length)]),
    reader: {
      read: vi.fn(async () => ({
        databaseFacts,
        history: new Map(),
        currentProjectionRows: 0,
        readOnlyTransaction: true as const,
      })),
    },
    decisionStore: { reconcile },
    maximumProviderContacts: 10,
    maximumAffectedRows: 10,
    idempotencyKey: 'census-source-only-1',
    sourceObservedAt: '2026-08-04T15:00:00.000Z',
    createdByUserKey: 'operator-source-only',
  };
}

function transport(
  pages: readonly ReturnType<typeof page>[],
): GovernedCampaignCensusProviderTransport {
  let index = 0;
  return {
    readContactsPage: vi.fn(async () => pages[index++]!),
  };
}

function page(
  contacts: readonly ProtectedGovernedCensusProviderContact[],
  nextCursor: string | null,
  reportedTotal: number,
): GovernedCampaignCensusProviderPage {
  return { locationId: LOCATION, contacts, nextCursor, reportedTotal };
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

function database(hash: GovernedCensusSha256): GovernedCensusDatabaseFacts {
  return {
    providerContactRefHash: hash,
    contactKey: 'adult-contact-key',
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

function rawContact(id: string, emailDndStatus: string) {
  return {
    id,
    locationId: LOCATION,
    email: `${id}@example.invalid`,
    dndSettings: { Email: { status: emailDndStatus } },
  };
}
