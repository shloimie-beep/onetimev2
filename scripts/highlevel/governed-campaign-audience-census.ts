import { pathToFileURL } from 'node:url';

import {
  buildGovernedCampaignCensusPlan,
  governedCampaignNormalizedEmailHash,
  governedCampaignProviderContactRefHash,
  type GovernedCampaignCensusPlan,
  type GovernedCensusDecisionHistory,
  type ProtectedGovernedCensusProviderContact,
} from '../../packages/domain/src/audience-reconciliation/governed-campaign-census.ts';
import {
  createPostgresGovernedCampaignCensusReader,
  type GovernedCampaignCensusReadScope,
  type GovernedCampaignCensusReadResult,
} from '../../packages/db/src/audience-reconciliation/governed-campaign-census-reader.ts';
import {
  createPostgresGovernedCampaignAudienceDecisionStore,
  governedCampaignRequestHash,
  GOVERNED_CAMPAIGN_PROVIDER_BINDING,
  type GovernedCampaignAudienceDecisionInput,
  type ReconcileGovernedCampaignAudienceRequest,
} from '../../packages/db/src/audience-reconciliation/governed-campaign-decision-store.ts';

type GovernedCampaignAudienceDecisionStore = ReturnType<
  typeof createPostgresGovernedCampaignAudienceDecisionStore
>;

export const GOVERNED_CENSUS_ENABLED_ENV = 'GOVERNED_CAMPAIGN_AUDIENCE_CENSUS_ENABLED';
export const HIGHLEVEL_CANONICAL_ORIGIN = 'https://services.leadconnectorhq.com';
export const HIGHLEVEL_CANONICAL_API_VERSION = '2023-02-21';
export const HIGHLEVEL_READ_TIMEOUT_MS = 10_000;

interface HighLevelObservedMetaCursor {
  startAfter: number;
  startAfterId: string;
}

const HIGHLEVEL_CURSOR_PREFIX = 'ghl-observed-meta-v2.';
const HIGHLEVEL_OBSERVED_ROOT_KEYS = ['contacts', 'meta', 'traceId'] as const;
const HIGHLEVEL_OBSERVED_META_KEYS = [
  'currentPage',
  'nextPage',
  'nextPageUrl',
  'prevPage',
  'startAfter',
  'startAfterId',
  'total',
] as const;
const HIGHLEVEL_DOCUMENTED_ROOT_KEYS = ['contacts', 'count'] as const;

export interface GovernedCampaignCensusProviderPage {
  locationId: string;
  contacts: readonly ProtectedGovernedCensusProviderContact[];
  nextCursor: string | null;
  reportedTotal: number;
}

export interface GovernedCampaignCensusProviderTransport {
  readContactsPage(input: {
    locationId: string;
    cursor: string | null;
    limit: number;
  }): Promise<GovernedCampaignCensusProviderPage>;
}

export interface GovernedCampaignCensusReader {
  read(input: {
    scope: GovernedCampaignCensusReadScope;
    providerContacts: readonly ProtectedGovernedCensusProviderContact[];
    maximumProviderContacts: number;
  }): Promise<GovernedCampaignCensusReadResult>;
}

export interface PrepareGovernedCampaignAudienceCensusInput {
  scope: GovernedCampaignCensusReadScope;
  provider: GovernedCampaignCensusProviderTransport;
  reader: GovernedCampaignCensusReader;
  decisionStore: GovernedCampaignAudienceDecisionStore;
  maximumProviderContacts: number;
  maximumAffectedRows: number;
  idempotencyKey: string;
  sourceObservedAt: string;
  createdByUserKey: string;
}

export interface PreparedGovernedCampaignAudienceCensus {
  request: ReconcileGovernedCampaignAudienceRequest;
  counts: GovernedCampaignCensusPlan['counts'];
  providerContactsRead: number;
  plannedAffectedRows: number;
  exactReplay: boolean;
  readOnlyTransaction: true;
  decisionStoreComposed: true;
  decisionStoreExecuted: false;
  providerWriteMethodsAvailable: false;
  rawContactPiiIncluded: false;
  rawProviderContactIdentifiersIncluded: false;
  studentRecordsIncluded: false;
  databaseEffects: 0;
  providerEffects: 0;
  contactEffects: 0;
  sendEffects: 0;
}

export class GovernedCampaignAudienceCensusError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly originalCause?: unknown,
  ) {
    super(message);
    this.name = 'GovernedCampaignAudienceCensusError';
  }
}

export async function prepareGovernedCampaignAudienceCensus(
  input: PrepareGovernedCampaignAudienceCensusInput,
): Promise<PreparedGovernedCampaignAudienceCensus> {
  validateOperatorInput(input);
  const contacts = await readBoundedProviderContacts(input.provider, input.maximumProviderContacts);
  const readback = await input.reader.read({
    scope: input.scope,
    providerContacts: contacts,
    maximumProviderContacts: input.maximumProviderContacts,
  });
  if (readback.readOnlyTransaction !== true)
    fail('DATABASE_READ_NOT_PROVEN', 'database read was not proven read only');

  const replayPlan = buildGovernedCampaignCensusPlan({
    providerContacts: contacts,
    databaseFacts: readback.databaseFacts,
    history: readback.history,
    maximumProviderContacts: input.maximumProviderContacts,
    versionMode: 'exact_replay_candidate',
  });
  const replayRequest = composeRequest(input, replayPlan);
  const exactReplay = isExactReplay(
    replayRequest,
    replayPlan,
    readback.history,
    readback.currentProjectionRows,
  );
  const plan = exactReplay
    ? replayPlan
    : buildGovernedCampaignCensusPlan({
        providerContacts: contacts,
        databaseFacts: readback.databaseFacts,
        history: readback.history,
        maximumProviderContacts: input.maximumProviderContacts,
        versionMode: 'new_request',
      });
  const request = exactReplay ? replayRequest : composeRequest(input, plan);
  const plannedAffectedRows = exactReplay
    ? 0
    : safeAdd(plan.decisions.length, readback.currentProjectionRows, 'planned affected rows');
  if (plannedAffectedRows > input.maximumAffectedRows) {
    fail(
      'AFFECTED_ROWS_CEILING',
      `planned ${plannedAffectedRows} rows exceeds maximumAffectedRows ${input.maximumAffectedRows}`,
    );
  }

  // The capability is deliberately required and composed, but never invoked in this authority.
  void input.decisionStore;
  return {
    request,
    counts: plan.counts,
    providerContactsRead: contacts.length,
    plannedAffectedRows,
    exactReplay,
    readOnlyTransaction: true,
    decisionStoreComposed: true,
    decisionStoreExecuted: false,
    providerWriteMethodsAvailable: false,
    rawContactPiiIncluded: false,
    rawProviderContactIdentifiersIncluded: false,
    studentRecordsIncluded: false,
    databaseEffects: 0,
    providerEffects: 0,
    contactEffects: 0,
    sendEffects: 0,
  };
}

export async function readBoundedProviderContacts(
  provider: GovernedCampaignCensusProviderTransport,
  maximumProviderContacts: number,
) {
  positive(maximumProviderContacts, 'maximumProviderContacts');
  const contacts: ProtectedGovernedCensusProviderContact[] = [];
  const hashes = new Set<string>();
  const cursors = new Set<string>();
  let cursor: string | null = null;
  let reportedTotal: number | null = null;
  do {
    const page = await provider.readContactsPage({
      locationId: GOVERNED_CAMPAIGN_PROVIDER_BINDING.providerLocationId,
      cursor,
      limit: Math.min(100, maximumProviderContacts),
    });
    const requestedLimit = Math.min(100, maximumProviderContacts);
    if (page.locationId !== GOVERNED_CAMPAIGN_PROVIDER_BINDING.providerLocationId) {
      fail('CROSS_LOCATION_PROVIDER_ROW', 'provider page is outside the exact GHL location');
    }
    if (!Number.isSafeInteger(page.reportedTotal) || page.reportedTotal < 1) {
      fail('AMBIGUOUS_PROVIDER_COUNT', 'provider total is missing or invalid');
    }
    if (page.contacts.length > requestedLimit) {
      fail('PROVIDER_CONTACT_CEILING', 'provider page exceeded the bounded per-page limit');
    }
    if (reportedTotal === null) reportedTotal = page.reportedTotal;
    if (reportedTotal !== page.reportedTotal || reportedTotal > maximumProviderContacts) {
      fail('AMBIGUOUS_PROVIDER_COUNT', 'provider totals changed or exceeded the operator ceiling');
    }
    if (page.contacts.length === 0 && page.nextCursor !== null) {
      fail('AMBIGUOUS_PROVIDER_CURSOR', 'empty provider page returned another cursor');
    }
    for (const contact of page.contacts) {
      if (hashes.has(contact.providerContactRefHash)) {
        fail('DUPLICATE_PROVIDER_REFERENCE', 'provider returned a duplicate protected reference');
      }
      hashes.add(contact.providerContactRefHash);
      contacts.push(contact);
      if (contacts.length > maximumProviderContacts) {
        fail('PROVIDER_CONTACT_CEILING', 'provider rows exceeded maximumProviderContacts');
      }
    }
    if (contacts.length > reportedTotal) {
      fail('AMBIGUOUS_PROVIDER_COUNT', 'provider rows exceeded the reported total');
    }
    if (contacts.length === reportedTotal) {
      cursor = null;
    } else {
      if (page.nextCursor === null) {
        fail('AMBIGUOUS_PROVIDER_CURSOR', 'provider stopped before the reported total');
      }
      if (
        page.nextCursor.trim() === '' ||
        cursors.has(page.nextCursor) ||
        page.nextCursor === cursor
      ) {
        fail('AMBIGUOUS_PROVIDER_CURSOR', 'provider cursor is blank or repeated');
      }
      cursors.add(page.nextCursor);
      cursor = page.nextCursor;
    }
  } while (cursor !== null);
  if (contacts.length === 0 || contacts.length !== reportedTotal) {
    fail('AMBIGUOUS_PROVIDER_COUNT', 'complete provider row count does not match reported total');
  }
  return contacts.sort((left, right) =>
    left.providerContactRefHash.localeCompare(right.providerContactRefHash),
  );
}

export function createReadOnlyHighLevelCensusTransport(input: {
  privateIntegrationsToken: string;
  fetchImplementation?: typeof fetch;
  timeoutMilliseconds?: number;
}): GovernedCampaignCensusProviderTransport {
  const fetchImplementation = input.fetchImplementation ?? fetch;
  const timeoutMilliseconds = input.timeoutMilliseconds ?? HIGHLEVEL_READ_TIMEOUT_MS;
  const issuedCursors = new Map<string, HighLevelObservedMetaCursor>();
  const seenCursors = new Set<string>();
  positive(timeoutMilliseconds, 'provider read timeout');
  return {
    async readContactsPage(pageInput) {
      if (pageInput.locationId !== GOVERNED_CAMPAIGN_PROVIDER_BINDING.providerLocationId) {
        fail('CROSS_LOCATION_PROVIDER_REQUEST', 'provider request location is not exact');
      }
      if (!Number.isSafeInteger(pageInput.limit) || pageInput.limit <= 0 || pageInput.limit > 100) {
        fail('PROVIDER_CONTACT_CEILING', 'provider page limit must be between 1 and 100');
      }
      const url = new URL('/contacts/', HIGHLEVEL_CANONICAL_ORIGIN);
      url.searchParams.set('locationId', pageInput.locationId);
      url.searchParams.set('limit', String(pageInput.limit));
      const cursor =
        pageInput.cursor === null ? null : (issuedCursors.get(pageInput.cursor) ?? 'unissued');
      if (cursor === 'unissued') {
        fail('AMBIGUOUS_PROVIDER_CURSOR', 'provider cursor was not issued by a validated page');
      }
      if (pageInput.cursor !== null) issuedCursors.delete(pageInput.cursor);
      if (cursor !== null) {
        url.searchParams.set('startAfter', String(cursor.startAfter));
        url.searchParams.set('startAfterId', cursor.startAfterId);
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);
      try {
        const response = await fetchImplementation(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${input.privateIntegrationsToken}`,
            Version: HIGHLEVEL_CANONICAL_API_VERSION,
          },
          signal: controller.signal,
        });
        if (!response.ok)
          fail('PROVIDER_READ_UNKNOWN', `provider GET failed with ${response.status}`);
        const page = parseHighLevelPage(
          await response.json(),
          pageInput.locationId,
          pageInput.limit,
        );
        if (page.nextCursor !== null) {
          if (seenCursors.has(page.nextCursor)) {
            fail('AMBIGUOUS_PROVIDER_CURSOR', 'provider returned a repeated cursor');
          }
          const decoded = decodeHighLevelObservedMetaCursor(page.nextCursor);
          seenCursors.add(page.nextCursor);
          issuedCursors.set(page.nextCursor, decoded);
        }
        return page;
      } catch (error) {
        if (error instanceof GovernedCampaignAudienceCensusError) throw error;
        fail('PROVIDER_READ_UNKNOWN', 'provider GET failed or timed out');
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export function parseHighLevelPage(
  value: unknown,
  expectedLocationId: string,
  limit: number,
): GovernedCampaignCensusProviderPage {
  const root = object(value, 'provider response');
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 100) {
    fail('PROVIDER_CONTACT_CEILING', 'provider page limit must be between 1 and 100');
  }
  if (!Array.isArray(root.contacts)) fail('PROVIDER_RESPONSE_INVALID', 'contacts array is absent');
  if (root.contacts.length > limit)
    fail('PROVIDER_CONTACT_CEILING', 'provider page exceeded its limit');
  const contacts = root.contacts.map((raw) => protectHighLevelContact(raw, expectedLocationId));
  const rootKeys = Object.keys(root).sort();

  if (exactKeys(rootKeys, HIGHLEVEL_DOCUMENTED_ROOT_KEYS)) {
    const total = safeNonnegativeInteger(root.count, 'documented provider total');
    if (total !== contacts.length) {
      fail(
        'AMBIGUOUS_PROVIDER_CURSOR',
        'documented contacts/count envelope cannot safely derive both pagination cursors',
      );
    }
    return {
      locationId: expectedLocationId,
      contacts,
      nextCursor: null,
      reportedTotal: total,
    };
  }

  if (!exactKeys(rootKeys, HIGHLEVEL_OBSERVED_ROOT_KEYS)) {
    fail('PROVIDER_RESPONSE_INVALID', 'provider response envelope is unknown or conflicting');
  }
  if (typeof root.traceId !== 'string' || root.traceId.trim() === '') {
    fail('PROVIDER_RESPONSE_INVALID', 'observed provider trace is absent or invalid');
  }
  const meta = object(root.meta, 'provider meta');
  if (!exactKeys(Object.keys(meta).sort(), HIGHLEVEL_OBSERVED_META_KEYS)) {
    fail('PROVIDER_RESPONSE_INVALID', 'observed provider meta envelope is incomplete or unknown');
  }
  safePositiveInteger(meta.currentPage, 'provider currentPage');
  nullablePositiveInteger(meta.nextPage, 'provider nextPage');
  nullablePositiveInteger(meta.prevPage, 'provider prevPage');
  const total = safeNonnegativeInteger(meta.total, 'provider total');
  if (total < contacts.length) {
    fail('AMBIGUOUS_PROVIDER_COUNT', 'provider total is smaller than the current page');
  }
  const cursorPair = observedMetaCursorPair(meta);

  if (cursorPair === null) {
    if (meta.nextPageUrl !== null) {
      fail('AMBIGUOUS_PROVIDER_CURSOR', 'provider URL is present without a cursor pair');
    }
    return {
      locationId: expectedLocationId,
      contacts,
      nextCursor: null,
      reportedTotal: total,
    };
  }
  if (cursorPair === 'partial') {
    fail('AMBIGUOUS_PROVIDER_CURSOR', 'provider meta lacks an exact cursor pair');
  }
  validateHighLevelNextPageUrl(
    meta.nextPageUrl,
    expectedLocationId,
    limit,
    cursorPair.startAfter,
    cursorPair.startAfterId,
  );
  return {
    locationId: expectedLocationId,
    contacts,
    nextCursor: encodeHighLevelObservedMetaCursor(cursorPair),
    reportedTotal: total,
  };
}

function observedMetaCursorPair(
  meta: Record<string, unknown>,
): Pick<HighLevelObservedMetaCursor, 'startAfter' | 'startAfterId'> | null | 'partial' {
  const startAfterAbsent = meta.startAfter === null;
  const startAfterIdAbsent = meta.startAfterId === null;
  if (startAfterAbsent && startAfterIdAbsent) return null;
  if (startAfterAbsent || startAfterIdAbsent) return 'partial';
  const startAfter = safePositiveInteger(meta.startAfter, 'provider startAfter');
  if (typeof meta.startAfterId !== 'string' || meta.startAfterId.trim() === '') {
    fail('AMBIGUOUS_PROVIDER_CURSOR', 'provider startAfterId is absent or blank');
  }
  return { startAfter, startAfterId: meta.startAfterId };
}

function validateHighLevelNextPageUrl(
  value: unknown,
  expectedLocationId: string,
  limit: number,
  startAfter: number,
  startAfterId: string,
) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail('AMBIGUOUS_PROVIDER_CURSOR', 'provider nextPageUrl is absent or blank');
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    fail('AMBIGUOUS_PROVIDER_CURSOR', 'provider nextPageUrl is invalid');
  }
  const queryKeys = [...url.searchParams.keys()].sort();
  const expectedQueryKeys = ['limit', 'locationId', 'startAfter', 'startAfterId'];
  if (
    url.origin !== HIGHLEVEL_CANONICAL_ORIGIN ||
    url.pathname !== '/contacts/' ||
    url.username !== '' ||
    url.password !== '' ||
    url.hash !== '' ||
    !exactKeys(queryKeys, expectedQueryKeys) ||
    expectedQueryKeys.some((key) => url.searchParams.getAll(key).length !== 1) ||
    url.searchParams.get('locationId') !== expectedLocationId ||
    url.searchParams.get('limit') !== String(limit) ||
    url.searchParams.get('startAfter') !== String(startAfter) ||
    url.searchParams.get('startAfterId') !== startAfterId
  ) {
    fail('AMBIGUOUS_PROVIDER_CURSOR', 'provider nextPageUrl changed the canonical request');
  }
}

function encodeHighLevelObservedMetaCursor(cursor: HighLevelObservedMetaCursor) {
  return `${HIGHLEVEL_CURSOR_PREFIX}${Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')}`;
}

function decodeHighLevelObservedMetaCursor(value: string): HighLevelObservedMetaCursor {
  if (!value.startsWith(HIGHLEVEL_CURSOR_PREFIX)) {
    fail('AMBIGUOUS_PROVIDER_CURSOR', 'provider cursor encoding is invalid');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      Buffer.from(value.slice(HIGHLEVEL_CURSOR_PREFIX.length), 'base64url').toString('utf8'),
    );
  } catch {
    fail('AMBIGUOUS_PROVIDER_CURSOR', 'provider cursor encoding is invalid');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail('AMBIGUOUS_PROVIDER_CURSOR', 'provider cursor encoding is invalid');
  }
  const cursor = parsed as Record<string, unknown>;
  if (!exactKeys(Object.keys(cursor).sort(), ['startAfter', 'startAfterId'])) {
    fail('AMBIGUOUS_PROVIDER_CURSOR', 'provider cursor fields are invalid');
  }
  const startAfter = safePositiveInteger(cursor.startAfter, 'provider cursor startAfter');
  if (typeof cursor.startAfterId !== 'string' || cursor.startAfterId.trim() === '') {
    fail('AMBIGUOUS_PROVIDER_CURSOR', 'provider cursor startAfterId is invalid');
  }
  return { startAfter, startAfterId: cursor.startAfterId };
}

function exactKeys(actual: readonly string[], expected: readonly string[]) {
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function safeNonnegativeInteger(value: unknown, field: string) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    fail('AMBIGUOUS_PROVIDER_COUNT', `${field} is missing or invalid`);
  }
  return value;
}

function safePositiveInteger(value: unknown, field: string) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    fail('AMBIGUOUS_PROVIDER_CURSOR', `${field} is missing or invalid`);
  }
  return value;
}

function nullablePositiveInteger(value: unknown, field: string) {
  return value === null ? null : safePositiveInteger(value, field);
}

export async function runGovernedCampaignAudienceCensusEntrypoint(
  environment: NodeJS.ProcessEnv,
  createDependencies: (
    environment: NodeJS.ProcessEnv,
  ) => Promise<
    PrepareGovernedCampaignAudienceCensusInput & { close?: () => Promise<void> }
  > = createEnvironmentDependencies,
) {
  if (environment[GOVERNED_CENSUS_ENABLED_ENV] !== 'true') {
    fail('DEFAULT_OFF', 'governed audience census is default off');
  }
  const dependencies = await createDependencies(environment);
  try {
    return await prepareGovernedCampaignAudienceCensus(dependencies);
  } finally {
    await dependencies.close?.();
  }
}

async function createEnvironmentDependencies(
  environment: NodeJS.ProcessEnv,
): Promise<PrepareGovernedCampaignAudienceCensusInput & { close: () => Promise<void> }> {
  requireEnvironment(environment, 'DATABASE_URL');
  requireEnvironment(environment, 'HIGHLEVEL_PRIVATE_INTEGRATIONS_TOKEN');
  const scope: GovernedCampaignCensusReadScope = {
    runtimeTier: requiredRuntimeTier(environment.GOVERNED_CAMPAIGN_RUNTIME_TIER),
    verificationEnvironmentId: required(environment.GOVERNED_CAMPAIGN_VERIFICATION_ENVIRONMENT_ID),
    accountKey: required(environment.GOVERNED_CAMPAIGN_ACCOUNT_KEY),
    productKey: required(environment.GOVERNED_CAMPAIGN_PRODUCT_KEY),
    campaignKey: required(environment.GOVERNED_CAMPAIGN_KEY),
    binding: GOVERNED_CAMPAIGN_PROVIDER_BINDING,
  };
  const maximumProviderContacts = requiredPositive(
    environment.GOVERNED_CAMPAIGN_MAXIMUM_PROVIDER_CONTACTS,
  );
  const maximumAffectedRows = requiredPositive(environment.GOVERNED_CAMPAIGN_MAXIMUM_AFFECTED_ROWS);
  const idempotencyKey = required(environment.GOVERNED_CAMPAIGN_IDEMPOTENCY_KEY);
  const sourceObservedAt = required(environment.GOVERNED_CAMPAIGN_SOURCE_OBSERVED_AT);
  const createdByUserKey = required(environment.GOVERNED_CAMPAIGN_CREATED_BY_USER_KEY);
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: environment.DATABASE_URL });
  return {
    scope,
    provider: createReadOnlyHighLevelCensusTransport({
      privateIntegrationsToken: environment.HIGHLEVEL_PRIVATE_INTEGRATIONS_TOKEN!,
    }),
    reader: createPostgresGovernedCampaignCensusReader(pool),
    decisionStore: createPostgresGovernedCampaignAudienceDecisionStore(pool),
    maximumProviderContacts,
    maximumAffectedRows,
    idempotencyKey,
    sourceObservedAt,
    createdByUserKey,
    close: async () => pool.end(),
  };
}

function protectHighLevelContact(
  value: unknown,
  expectedLocationId: string,
): ProtectedGovernedCensusProviderContact {
  const row = object(value, 'provider contact');
  if (row.locationId !== expectedLocationId || typeof row.id !== 'string' || row.id.trim() === '') {
    fail('CROSS_LOCATION_PROVIDER_ROW', 'provider contact identity or location is invalid');
  }
  const email = typeof row.email === 'string' ? row.email.trim().toLowerCase() : '';
  const dndSettings = objectOrEmpty(row.dndSettings);
  const officialEmailSetting = objectOrEmpty(dndSettings.Email);
  const aliasEmailSetting = objectOrEmpty(dndSettings.email);
  const officialStatus = dndStatus(officialEmailSetting.status);
  const aliasStatus = dndStatus(aliasEmailSetting.status);
  if (
    dndSettings.Email !== undefined &&
    dndSettings.email !== undefined &&
    officialStatus !== aliasStatus
  ) {
    fail('PROVIDER_RESPONSE_INVALID', 'contradictory email DND channel aliases');
  }
  const emailStatus = dndSettings.Email === undefined ? 'unknown' : officialStatus;
  const suppressed = emailStatus === 'suppressed';
  const explicitlyActive = emailStatus === 'active';
  const deliverabilityState =
    email === ''
      ? 'missing'
      : /^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(email)
        ? 'deliverable'
        : 'invalid';
  return {
    providerContactRefHash: governedCampaignProviderContactRefHash(expectedLocationId, row.id),
    normalizedEmailHash:
      deliverabilityState === 'deliverable' ? governedCampaignNormalizedEmailHash(email) : null,
    // Channel inactivity proves only that email DND is inactive; it is not marketing opt-in proof.
    consentState: suppressed ? 'opted_out' : 'unknown',
    deliverabilityState,
    providerSuppressionState: suppressed ? 'suppressed' : explicitlyActive ? 'active' : 'unknown',
  };
}

function composeRequest(
  input: PrepareGovernedCampaignAudienceCensusInput,
  plan: GovernedCampaignCensusPlan,
): ReconcileGovernedCampaignAudienceRequest {
  const withoutHash = {
    ...input.scope,
    idempotencyKey: input.idempotencyKey,
    snapshotHash:
      plan.snapshotHash as unknown as ReconcileGovernedCampaignAudienceRequest['snapshotHash'],
    sourceObservedAt: input.sourceObservedAt,
    createdByUserKey: input.createdByUserKey,
    expectedDecisionRows: plan.decisions.length,
    maximumAffectedRows: input.maximumAffectedRows,
    decisions: plan.decisions as unknown as readonly GovernedCampaignAudienceDecisionInput[],
  };
  return { ...withoutHash, requestHash: governedCampaignRequestHash(withoutHash) };
}

function isExactReplay(
  request: ReconcileGovernedCampaignAudienceRequest,
  plan: GovernedCampaignCensusPlan,
  history: ReadonlyMap<string, GovernedCensusDecisionHistory>,
  currentProjectionRows: number,
) {
  return (
    currentProjectionRows === plan.decisions.length &&
    plan.decisions.every((decision) => {
      const current = history.get(decision.providerContactRefHash);
      return (
        current?.currentDecisionVersion === decision.decisionVersion &&
        current.currentDecision === decision.decision &&
        current.currentPrimaryReason === decision.primaryReason &&
        current.currentSourceFactsHash === decision.sourceFacts.sourceFactsHash &&
        current.currentIdempotencyKey === request.idempotencyKey &&
        String(current.currentRequestHash) === request.requestHash &&
        String(current.currentSnapshotHash) === request.snapshotHash
      );
    })
  );
}

function dndStatus(value: unknown): 'suppressed' | 'active' | 'unknown' {
  if (typeof value !== 'string') return 'unknown';
  if (value === 'active' || value === 'permanent') return 'suppressed';
  if (value === 'inactive') return 'active';
  return 'unknown';
}

function validateOperatorInput(input: PrepareGovernedCampaignAudienceCensusInput) {
  positive(input.maximumProviderContacts, 'maximumProviderContacts');
  positive(input.maximumAffectedRows, 'maximumAffectedRows');
  if (
    input.scope.binding !== GOVERNED_CAMPAIGN_PROVIDER_BINDING &&
    JSON.stringify(input.scope.binding) !== JSON.stringify(GOVERNED_CAMPAIGN_PROVIDER_BINDING)
  ) {
    fail('PROVIDER_BINDING_MISMATCH', 'scope does not use the exact OT-15 provider binding');
  }
}

function safeAdd(left: number, right: number, field: string) {
  if (
    !Number.isSafeInteger(left) ||
    !Number.isSafeInteger(right) ||
    left < 0 ||
    right < 0 ||
    left > Number.MAX_SAFE_INTEGER - right
  ) {
    fail('INVALID_OPERATOR_CEILING', `${field} cannot be calculated safely`);
  }
  return left + right;
}

function positive(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value <= 0)
    fail('INVALID_OPERATOR_CEILING', `${field} must be positive`);
}

function requiredPositive(value: string | undefined) {
  const parsed = Number(value);
  positive(parsed, 'environment ceiling');
  return parsed;
}

function required(value: string | undefined) {
  if (!value || value.trim() === '')
    fail('ENVIRONMENT_INCOMPLETE', 'required environment value is absent');
  return value;
}

function requiredRuntimeTier(
  value: string | undefined,
): GovernedCampaignCensusReadScope['runtimeTier'] {
  if (value !== 'isolated_staging' && value !== 'production')
    fail('ENVIRONMENT_INCOMPLETE', 'runtime tier is invalid');
  return value;
}

function requireEnvironment(environment: NodeJS.ProcessEnv, key: string) {
  required(environment[key]);
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail('PROVIDER_RESPONSE_INVALID', `${field} is invalid`);
  return value as Record<string, unknown>;
}

function objectOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function fail(code: string, message: string): never {
  throw new GovernedCampaignAudienceCensusError(code, message);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runGovernedCampaignAudienceCensusEntrypoint(process.env)
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error: unknown) => {
      const code = error instanceof GovernedCampaignAudienceCensusError ? error.code : 'UNKNOWN';
      process.stderr.write(`${code}\n`);
      process.exitCode = 1;
    });
}
