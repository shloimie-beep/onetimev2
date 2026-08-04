import { describe, expect, it, vi } from 'vitest';

import {
  governedCampaignNormalizedEmailHash,
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
const EMAIL_HASH = governedCampaignNormalizedEmailHash('synthetic-census@example.invalid');

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

  it('accepts the documented contacts/count envelope only when it is terminal', () => {
    const inactive = parseHighLevelPage(
      { contacts: [rawContact('provider-inactive', 'inactive')], count: 1 },
      LOCATION,
      1,
    );
    expect(inactive.reportedTotal).toBe(1);
    expect(inactive.nextCursor).toBeNull();
    expect(inactive.contacts[0]).toMatchObject({
      consentState: 'unknown',
      providerSuppressionState: 'active',
      normalizedEmailHash: governedCampaignNormalizedEmailHash('provider-inactive@example.invalid'),
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

    expect(() =>
      parseHighLevelPage(
        { contacts: [rawContact('provider-documented-nonterminal', 'inactive')], count: 2 },
        LOCATION,
        1,
      ),
    ).toThrow(/cannot safely derive both pagination cursors/iu);
  });

  it('binds the observed contacts/meta/traceId envelope and reconstructs both cursors', async () => {
    const observedUrls: URL[] = [];
    const fetchImplementation = vi.fn(async (request: URL | RequestInfo) => {
      const url = new URL(String(request));
      observedUrls.push(url);
      const page = observedUrls.length;
      return new Response(
        JSON.stringify(
          page === 1
            ? observedEnvelope({
                contacts: [rawContact('provider-observed-page-one', 'inactive')],
                currentPage: 1,
                nextPage: 2,
                prevPage: null,
                total: 2,
                startAfter: 1_786_000_000_001,
                startAfterId: 'synthetic-observed-cursor',
              })
            : observedEnvelope({
                contacts: [rawContact('provider-observed-page-two', 'inactive')],
                currentPage: 2,
                nextPage: null,
                prevPage: 1,
                total: 2,
                startAfter: null,
                startAfterId: null,
              }),
        ),
        { status: 200 },
      );
    });
    const providerTransport = createReadOnlyHighLevelCensusTransport({
      privateIntegrationsToken: 'synthetic-token-not-logged',
      fetchImplementation,
    });

    const first = await providerTransport.readContactsPage({
      locationId: LOCATION,
      cursor: null,
      limit: 1,
    });
    expect(first).toMatchObject({ reportedTotal: 2 });
    expect(first.nextCursor).toEqual(expect.any(String));
    const second = await providerTransport.readContactsPage({
      locationId: LOCATION,
      cursor: first.nextCursor,
      limit: 1,
    });
    expect(second.nextCursor).toBeNull();
    expect(observedUrls[1]).toMatchObject({
      origin: HIGHLEVEL_CANONICAL_ORIGIN,
      pathname: '/contacts/',
    });
    expect([...observedUrls[1]!.searchParams.keys()].sort()).toEqual([
      'limit',
      'locationId',
      'startAfter',
      'startAfterId',
    ]);
    expect(observedUrls[1]!.searchParams.get('locationId')).toBe(LOCATION);
    expect(observedUrls[1]!.searchParams.get('limit')).toBe('1');
    expect(observedUrls[1]!.searchParams.get('startAfter')).toBe('1786000000001');
    expect(observedUrls[1]!.searchParams.get('startAfterId')).toBe('synthetic-observed-cursor');
  });

  it('rejects conflicting observed envelopes and arbitrary continuation URLs', () => {
    const exact = observedEnvelope({
      contacts: [rawContact('provider-observed-contract', 'inactive')],
      currentPage: 1,
      nextPage: 2,
      prevPage: null,
      total: 2,
      startAfter: 1_786_000_000_001,
      startAfterId: 'synthetic-observed-cursor',
    });
    expect(() => parseHighLevelPage({ ...exact, count: 2 }, LOCATION, 1)).toThrow(
      /envelope is unknown or conflicting/iu,
    );
    expect(() =>
      parseHighLevelPage(
        {
          ...exact,
          meta: {
            ...exact.meta,
            nextPageUrl:
              'https://untrusted.invalid/contacts/?locationId=wrong&limit=1&startAfter=1786000000001&startAfterId=synthetic-observed-cursor',
          },
        },
        LOCATION,
        1,
      ),
    ).toThrow(/changed the canonical request/iu);
    for (const nextPageUrl of [
      `${HIGHLEVEL_CANONICAL_ORIGIN}/other/?locationId=${LOCATION}&limit=1&startAfter=1786000000001&startAfterId=synthetic-observed-cursor`,
      `${HIGHLEVEL_CANONICAL_ORIGIN}/contacts/?locationId=wrong&limit=1&startAfter=1786000000001&startAfterId=synthetic-observed-cursor`,
      `${HIGHLEVEL_CANONICAL_ORIGIN}/contacts/?locationId=${LOCATION}&limit=1&startAfter=1786000000001&startAfterId=synthetic-observed-cursor&unexpected=true`,
    ]) {
      expect(() =>
        parseHighLevelPage({ ...exact, meta: { ...exact.meta, nextPageUrl } }, LOCATION, 1),
      ).toThrow(/changed the canonical request/iu);
    }
    expect(() =>
      parseHighLevelPage({ ...exact, meta: { ...exact.meta, unexpected: true } }, LOCATION, 1),
    ).toThrow(/meta envelope is incomplete or unknown/iu);
    expect(() =>
      parseHighLevelPage({ ...exact, meta: { ...exact.meta, total: '2' } }, LOCATION, 1),
    ).toThrow(/provider total is missing or invalid/iu);
    expect(() =>
      parseHighLevelPage({ ...exact, meta: { ...exact.meta, startAfterId: null } }, LOCATION, 1),
    ).toThrow(/lacks an exact cursor pair/iu);
    expect(() =>
      parseHighLevelPage({ ...exact, meta: { ...exact.meta, currentPage: 3 } }, LOCATION, 1),
    ).toThrow(/currentPage did not match/iu);
    expect(() =>
      parseHighLevelPage(
        observedEnvelope({
          contacts: [rawContact('provider-terminal-conflict', 'inactive')],
          currentPage: 1,
          nextPage: null,
          prevPage: null,
          total: 1,
          startAfter: 1_786_000_000_001,
          startAfterId: 'synthetic-terminal-cursor',
        }),
        LOCATION,
        1,
      ),
    ).toThrow(/terminal provider meta contains conflicting cursors/iu);
    expect(() => parseHighLevelPage(exact, LOCATION, 101)).toThrow(
      /page limit must be between 1 and 100/iu,
    );
  });

  it('never sends a caller-supplied continuation cursor', async () => {
    const fetchImplementation = vi.fn();
    const providerTransport = createReadOnlyHighLevelCensusTransport({
      privateIntegrationsToken: 'synthetic-token-not-logged',
      fetchImplementation,
    });
    await expect(
      providerTransport.readContactsPage({
        locationId: LOCATION,
        cursor: 'synthetic-unissued-cursor',
        limit: 1,
      }),
    ).rejects.toMatchObject({ code: 'AMBIGUOUS_PROVIDER_CURSOR' });
    expect(fetchImplementation).not.toHaveBeenCalled();
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
    await expect(
      readBoundedProviderContacts(transport([page([provider(HASH_A)], 'unexpected-cursor', 1)]), 1),
    ).rejects.toMatchObject({ code: 'AMBIGUOUS_PROVIDER_CURSOR' });
    await expect(
      readBoundedProviderContacts(
        transport([page([provider(HASH_A)], 'next', 2), page([provider(HASH_A)], null, 2)]),
        2,
      ),
    ).rejects.toMatchObject({ code: 'DUPLICATE_PROVIDER_REFERENCE' });
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

  it('passes only protected identity inputs to the reader and never emits email evidence', async () => {
    const protectedContact = parseHighLevelPage(
      { contacts: [rawContact('provider-protected-contract', 'inactive')], count: 1 },
      LOCATION,
      10,
    ).contacts[0]!;
    const reader = vi.fn(async () => ({
      databaseFacts: new Map([
        [
          protectedContact.providerContactRefHash,
          database(protectedContact.providerContactRefHash),
        ],
      ]),
      history: new Map(),
      currentProjectionRows: 0,
      readOnlyTransaction: true as const,
    }));
    const result = await prepareGovernedCampaignAudienceCensus({
      ...preparationInput(
        [protectedContact],
        new Map([
          [
            protectedContact.providerContactRefHash,
            database(protectedContact.providerContactRefHash),
          ],
        ]),
        vi.fn(),
      ),
      reader: { read: reader },
    });
    expect(result.request.decisions[0]).toMatchObject({
      decision: 'review',
      primaryReason: 'unknown_consent',
    });
    expect(reader).toHaveBeenCalledWith(
      expect.objectContaining({ providerContacts: [protectedContact] }),
    );
    expect(JSON.stringify(result)).not.toContain(protectedContact.normalizedEmailHash);
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
    normalizedEmailHash: EMAIL_HASH,
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

function observedEnvelope(input: {
  contacts: readonly ReturnType<typeof rawContact>[];
  currentPage: number;
  nextPage: number | null;
  prevPage: number | null;
  total: number;
  startAfter: number | null;
  startAfterId: string | null;
}) {
  let nextPageUrl: string | null = null;
  if (input.nextPage !== null) {
    if (input.startAfter === null || input.startAfterId === null) {
      throw new Error('synthetic observed envelope requires both cursors');
    }
    const url = new URL('/contacts/', HIGHLEVEL_CANONICAL_ORIGIN);
    url.searchParams.set('locationId', LOCATION);
    url.searchParams.set('limit', '1');
    url.searchParams.set('startAfter', String(input.startAfter));
    url.searchParams.set('startAfterId', input.startAfterId);
    nextPageUrl = url.toString();
  }
  return {
    contacts: input.contacts,
    meta: {
      currentPage: input.currentPage,
      nextPage: input.nextPage,
      nextPageUrl,
      prevPage: input.prevPage,
      startAfter: input.startAfter,
      startAfterId: input.startAfterId,
      total: input.total,
    },
    traceId: 'synthetic-observed-trace',
  };
}
