import {
  governedCampaignCanonicalSha256,
  type GovernedCensusDatabaseFacts,
  type GovernedCensusDecision,
  type GovernedCensusDecisionHistory,
  type GovernedCensusReason,
  type GovernedCensusSha256,
  type ProtectedGovernedCensusProviderContact,
} from '../../../domain/src/audience-reconciliation/governed-campaign-census.ts';
import {
  GOVERNED_CAMPAIGN_PROVIDER_BINDING,
  type GovernedCampaignProviderBinding,
  type GovernedCampaignRuntimeTier,
} from './governed-campaign-decision-store.ts';

export interface GovernedCampaignCensusReaderSqlClient {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: Row[]; rowCount?: number | null }>;
  release(): void;
}

export interface GovernedCampaignCensusReaderSqlPool {
  connect(): Promise<GovernedCampaignCensusReaderSqlClient>;
}

export interface GovernedCampaignCensusReadScope {
  runtimeTier: GovernedCampaignRuntimeTier;
  verificationEnvironmentId: string;
  accountKey: string;
  productKey: string;
  campaignKey: string;
  binding: GovernedCampaignProviderBinding;
}

export interface GovernedCampaignCensusReadResult {
  databaseFacts: ReadonlyMap<string, GovernedCensusDatabaseFacts>;
  history: ReadonlyMap<string, GovernedCensusDecisionHistory>;
  currentProjectionRows: number;
  readOnlyTransaction: true;
}

export class GovernedCampaignCensusReaderError extends Error {
  constructor(
    readonly code:
      'INVALID_READ_SCOPE' | 'AMBIGUOUS_DATABASE_READBACK' | 'READ_ONLY_TRANSACTION_FAILED',
    message: string,
    readonly originalCause?: unknown,
  ) {
    super(message);
    this.name = 'GovernedCampaignCensusReaderError';
  }
}

interface FactRow extends Record<string, unknown> {
  provider_contact_ref_hash: string;
  identity_source: string | null;
  mapped_household_key: string | null;
  mapping_sync_state: string | null;
  provider_email_match_count: string | number;
  provider_email_matches_contact: boolean | null;
  legacy_hash_match_count: string | number;
  legacy_hash_other_adult_count: string | number;
  selected_link_email_matches_adult: boolean | null;
  adult_id: string | null;
  link_state: string | null;
  suppression_json: unknown;
  adult_state: string | null;
  household_id: string | null;
  classification: string | null;
  access_projection: string | null;
  contact_key: string | null;
  contact_classification: string | null;
  contact_suppression_state: string | null;
  consent_proven: boolean | null;
  contact_email_present: boolean | null;
  contact_email_shape_valid: boolean | null;
  preferences_present: boolean | null;
  email_dnd: boolean | null;
  all_dnd: boolean | null;
  self_student_count: string | number | null;
}

interface HistoryRow extends Record<string, unknown> {
  provider_contact_ref_hash: string;
  decision_version: string | number;
  superseded_at: string | Date | null;
  decision: string;
  primary_reason: string;
  contact_key: string | null;
  source_facts: unknown;
  idempotency_key: string;
  request_hash: string;
  snapshot_hash: string;
}

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const OPAQUE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;

export function createPostgresGovernedCampaignCensusReader(
  pool: GovernedCampaignCensusReaderSqlPool,
) {
  return {
    async read(input: {
      scope: GovernedCampaignCensusReadScope;
      providerContacts: readonly ProtectedGovernedCensusProviderContact[];
      maximumProviderContacts: number;
    }): Promise<GovernedCampaignCensusReadResult> {
      validateInput(input);
      const contacts = [...input.providerContacts].sort((left, right) =>
        left.providerContactRefHash.localeCompare(right.providerContactRefHash),
      );
      const hashes = contacts.map((contact) => contact.providerContactRefHash);
      const client = await pool.connect();
      let transactionOpen = false;
      try {
        await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        transactionOpen = true;
        const factRows = await readFactRows(client, input.scope, contacts);
        const historyRows = await readHistoryRows(client, input.scope, hashes);
        const currentProjectionRows = await readCurrentProjectionCount(client, input.scope);
        const databaseFacts = groupFacts(hashes, factRows);
        const history = groupHistory(hashes, historyRows);
        await client.query('COMMIT');
        transactionOpen = false;
        return { databaseFacts, history, currentProjectionRows, readOnlyTransaction: true };
      } catch (error) {
        if (transactionOpen) await client.query('ROLLBACK').catch(() => undefined);
        if (error instanceof GovernedCampaignCensusReaderError) throw error;
        throw new GovernedCampaignCensusReaderError(
          'READ_ONLY_TRANSACTION_FAILED',
          'governed census read-only transaction failed without retry',
          error,
        );
      } finally {
        client.release();
      }
    },
  };
}

async function readFactRows(
  client: GovernedCampaignCensusReaderSqlClient,
  scope: GovernedCampaignCensusReadScope,
  contacts: readonly ProtectedGovernedCensusProviderContact[],
) {
  const requested = requestedContactValues(contacts);
  const result = await client.query<FactRow>(
    `WITH requested(provider_contact_ref_hash, normalized_email_hash) AS (
       VALUES ${requested.sql}
     ), requested_with_counts AS (
       SELECT requested.*,
              CASE
                WHEN normalized_email_hash IS NULL THEN 0
                ELSE count(*) OVER (PARTITION BY normalized_email_hash)
              END AS provider_email_match_count
         FROM requested
     ), exact_scope AS (
       SELECT $1::text AS account_key, $2::text AS product_key,
              $3::text AS runtime_tier, $4::text AS verification_environment_id,
              $5::text AS campaign_key, $6::text AS provider_location_id,
              $7::text AS provider_campaign_id, $8::text AS provider_workflow_id,
              $9::text AS provider_launch_tag_id
     ), durable_matches AS (
       SELECT requested.provider_contact_ref_hash,
              requested.normalized_email_hash,
               requested.provider_email_match_count,
               mapping.contact_key,
               mapping.household_key AS mapped_household_key,
               mapping.sync_state AS mapping_sync_state,
              'durable_mapping'::text AS identity_source
         FROM requested_with_counts AS requested
         CROSS JOIN exact_scope
         JOIN onetime.adult_household_contact_links AS mapping
           ON mapping.account_key = exact_scope.account_key
          AND mapping.product_key = exact_scope.product_key
          AND mapping.highlevel_location_id = exact_scope.provider_location_id
          AND mapping.highlevel_contact_id IS NOT NULL
          AND encode(
                sha256(
                  convert_to('governed-ghl-contact-v1', 'UTF8')
                  || decode('00', 'hex')
                  || convert_to(mapping.highlevel_location_id, 'UTF8')
                  || decode('00', 'hex')
                  || convert_to(mapping.highlevel_contact_id, 'UTF8')
                ),
                'hex'
              ) = requested.provider_contact_ref_hash
     ), normalized_email_matches AS (
       SELECT requested.provider_contact_ref_hash,
              requested.normalized_email_hash,
               requested.provider_email_match_count,
               contact.contact_key,
               NULL::text AS mapped_household_key,
               NULL::text AS mapping_sync_state,
              'normalized_email_fallback'::text AS identity_source
         FROM requested_with_counts AS requested
         CROSS JOIN exact_scope
         JOIN onetime.contacts AS contact
           ON contact.account_key = exact_scope.account_key
          AND contact.product_key = exact_scope.product_key
          AND requested.normalized_email_hash IS NOT NULL
          AND encode(
                sha256(convert_to(lower(btrim(contact.email_normalized)), 'UTF8')),
                'hex'
              ) = requested.normalized_email_hash
        WHERE NOT EXISTS (
          SELECT 1
            FROM durable_matches AS durable
           WHERE durable.provider_contact_ref_hash = requested.provider_contact_ref_hash
        )
     ), identity_candidates AS (
       SELECT * FROM durable_matches
       UNION ALL
       SELECT * FROM normalized_email_matches
     )
      SELECT requested.provider_contact_ref_hash,
            identity.identity_source, identity.mapped_household_key,
            identity.mapping_sync_state,
            requested.provider_email_match_count::text,
            CASE
              WHEN requested.normalized_email_hash IS NULL OR contact.contact_key IS NULL THEN NULL
              ELSE encode(
                sha256(convert_to(lower(btrim(contact.email_normalized)), 'UTF8')),
                'hex'
              ) = requested.normalized_email_hash
            END AS provider_email_matches_contact,
            legacy_hash.rows::text AS legacy_hash_match_count,
            legacy_hash.other_adult_rows::text AS legacy_hash_other_adult_count,
            CASE
              WHEN selected_link.adult_id IS NULL OR adult.adult_id IS NULL THEN NULL
              ELSE selected_link.normalized_email_hash = encode(
                sha256(convert_to(lower(btrim(adult.normalized_email)), 'UTF8')),
                'hex'
              )
            END AS selected_link_email_matches_adult,
            adult.adult_id, selected_link.state AS link_state, selected_link.suppression_json,
            adult.state AS adult_state,
            household.household_id, household.classification,
            household.access_projection,
            contact.contact_key,
            contact.family_school_classification AS contact_classification,
            contact.suppression_state AS contact_suppression_state,
            (contact.consent_policy_version IS NOT NULL
              AND contact.consent_recorded_at IS NOT NULL) AS consent_proven,
            (contact.email_normalized IS NOT NULL
              AND btrim(contact.email_normalized) <> '') AS contact_email_present,
            (contact.email_normalized = lower(btrim(contact.email_normalized))
              AND contact.email_normalized LIKE '%@%') AS contact_email_shape_valid,
            (preferences.contact_key IS NOT NULL) AS preferences_present,
            preferences.email_dnd, preferences.all_dnd,
            COALESCE(self_students.rows, 0)::text AS self_student_count
       FROM requested_with_counts AS requested
       CROSS JOIN exact_scope
       LEFT JOIN identity_candidates AS identity
         ON identity.provider_contact_ref_hash = requested.provider_contact_ref_hash
       LEFT JOIN onetime.contacts AS contact
         ON contact.account_key = exact_scope.account_key
        AND contact.product_key = exact_scope.product_key
        AND contact.contact_key = identity.contact_key
       LEFT JOIN onetime.v21_adult_identities AS adult
         ON adult.product_key = exact_scope.product_key
        AND adult.runtime_tier = exact_scope.runtime_tier
        AND adult.verification_environment_id = exact_scope.verification_environment_id
        AND adult.normalized_email = lower(btrim(contact.email_normalized))
       LEFT JOIN onetime.adult_ghl_identity_link AS selected_link
         ON selected_link.adult_id = adult.adult_id
        AND selected_link.product_key = exact_scope.product_key
        AND selected_link.runtime_tier = exact_scope.runtime_tier
        AND selected_link.verification_environment_id = exact_scope.verification_environment_id
       LEFT JOIN onetime.highlevel_contact_preferences AS preferences
         ON preferences.account_key = contact.account_key
        AND preferences.product_key = contact.product_key
        AND preferences.contact_key = contact.contact_key
       LEFT JOIN onetime.ghl_household_identity_projection AS household
         ON household.adult_id = adult.adult_id
        AND household.product_key = exact_scope.product_key
        AND household.runtime_tier = exact_scope.runtime_tier
        AND household.verification_environment_id = exact_scope.verification_environment_id
       LEFT JOIN LATERAL (
         SELECT count(*) AS rows
           FROM onetime.v21_student_profiles AS student
          WHERE student.self_adult_id = adult.adult_id
            AND student.relationship = 'self'
            AND student.state = 'active'
            AND student.product_key = exact_scope.product_key
            AND student.runtime_tier = exact_scope.runtime_tier
            AND student.verification_environment_id = exact_scope.verification_environment_id
       ) AS self_students ON true
       LEFT JOIN LATERAL (
         SELECT count(*) AS rows,
                count(*) FILTER (
                  WHERE adult.adult_id IS NULL OR legacy.adult_id <> adult.adult_id
                ) AS other_adult_rows
           FROM onetime.adult_ghl_identity_link AS legacy
          WHERE legacy.product_key = exact_scope.product_key
            AND legacy.runtime_tier = exact_scope.runtime_tier
            AND legacy.verification_environment_id = exact_scope.verification_environment_id
            AND legacy.verified_contact_ref_hash = requested.provider_contact_ref_hash
       ) AS legacy_hash ON true
      ORDER BY requested.provider_contact_ref_hash, identity.identity_source,
               identity.contact_key, adult.adult_id, household.household_id`,
    [...scopeValues(scope), ...requested.values],
  );
  return result.rows;
}

async function readHistoryRows(
  client: GovernedCampaignCensusReaderSqlClient,
  scope: GovernedCampaignCensusReadScope,
  hashes: readonly GovernedCensusSha256[],
) {
  const requested = requestedHashValues(hashes);
  const result = await client.query<HistoryRow>(
    `WITH requested(provider_contact_ref_hash) AS (
       VALUES ${requested.sql}
     )
     SELECT decisions.provider_contact_ref_hash, decisions.decision_version,
            decisions.superseded_at, decisions.decision,
            decisions.primary_reason, decisions.contact_key, decisions.source_facts,
            decisions.idempotency_key, decisions.request_hash, decisions.snapshot_hash
       FROM onetime.governed_campaign_audience_decisions AS decisions
       JOIN requested
         ON requested.provider_contact_ref_hash = decisions.provider_contact_ref_hash
      WHERE ${decisionScopePredicate('decisions')}
      ORDER BY decisions.provider_contact_ref_hash, decisions.decision_version`,
    [...scopeValues(scope), ...requested.values],
  );
  return result.rows;
}

async function readCurrentProjectionCount(
  client: GovernedCampaignCensusReaderSqlClient,
  scope: GovernedCampaignCensusReadScope,
) {
  const result = await client.query<{ rows: string | number }>(
    `SELECT count(*)::text AS rows
       FROM onetime.governed_campaign_audience_decisions AS decisions
      WHERE ${decisionScopePredicate('decisions')}
        AND decisions.superseded_at IS NULL`,
    scopeValues(scope),
  );
  const rows = Number(result.rows[0]?.rows ?? -1);
  if (!Number.isSafeInteger(rows) || rows < 0) {
    ambiguous('current projection count is invalid');
  }
  return rows;
}

function groupFacts(hashes: readonly GovernedCensusSha256[], rows: readonly FactRow[]) {
  const grouped = new Map<string, FactRow[]>();
  for (const row of rows) {
    if (
      !SHA256_PATTERN.test(row.provider_contact_ref_hash) ||
      !hashes.includes(row.provider_contact_ref_hash as GovernedCensusSha256)
    ) {
      ambiguous('database facts contain an unexpected provider hash');
    }
    validateFactRowEnums(row);
    const group = grouped.get(row.provider_contact_ref_hash) ?? [];
    group.push(row);
    grouped.set(row.provider_contact_ref_hash, group);
  }
  return new Map(
    hashes.map((hash) => {
      const candidates = grouped.get(hash) ?? [];
      const identityRows = candidates.filter((row) => row.identity_source !== null);
      const linkedRows = identityRows.filter(
        (row) => row.adult_id !== null && row.contact_key !== null,
      );
      const adultIds = unique(linkedRows.map((row) => row.adult_id).filter(isString));
      const linkStates = unique(linkedRows.map((row) => row.link_state).filter(isString));
      const adultRows = linkedRows.filter((row) => row.adult_state !== null);
      const contactKeys = unique(linkedRows.map((row) => row.contact_key).filter(isString));
      const identitySources = unique(
        identityRows.map((row) => row.identity_source).filter(isString),
      );
      const mappingStates = unique(
        identityRows.map((row) => row.mapping_sync_state).filter(isString),
      );
      const providerEmailCounts = unique(
        candidates.map((row) => nonnegativeCount(row.provider_email_match_count, 'provider email')),
      );
      const legacyMatchCounts = unique(
        candidates.map((row) => nonnegativeCount(row.legacy_hash_match_count, 'legacy hash')),
      );
      const legacyOtherAdultCounts = unique(
        candidates.map((row) =>
          nonnegativeCount(row.legacy_hash_other_adult_count, 'legacy other-adult'),
        ),
      );
      if (
        providerEmailCounts.length !== 1 ||
        legacyMatchCounts.length !== 1 ||
        legacyOtherAdultCounts.length !== 1
      ) {
        ambiguous('identity evidence counts are inconsistent');
      }
      const identityBindings = unique(
        identityRows.map(
          (row) =>
            `${row.identity_source ?? ''}\u001f${row.contact_key ?? ''}\u001f${row.adult_id ?? ''}\u001f${row.mapped_household_key ?? ''}`,
        ),
      );
      const identityMatchState = identityState({
        adultIds,
        contactKeys,
        identitySources,
        identityBindings,
        mappingStates,
        selectedLinkStates: linkStates,
        providerEmailMatchCount: providerEmailCounts[0]!,
        providerEmailMatches: candidates.map((row) => row.provider_email_matches_contact),
        selectedLinkEmailMatches: candidates.map((row) => row.selected_link_email_matches_adult),
        legacyOtherAdultCount: legacyOtherAdultCounts[0]!,
      });
      const adultEvidenceState =
        identityMatchState === 'exact' &&
        adultRows.length > 0 &&
        adultRows.every((row) => row.adult_state === 'active')
          ? 'proven'
          : identityMatchState === 'duplicate' || identityMatchState === 'ambiguous'
            ? 'conflicting'
            : 'not_proven';
      const householdRows = linkedRows.filter((row) => row.household_id !== null);
      const classifications = unique(
        householdRows.map((row) => row.classification).filter(isString),
      );
      const accessStates = unique(
        householdRows.map((row) => row.access_projection).filter(isString),
      );
      const suppressionStates = linkedRows.map((row) =>
        canonicalSuppressionEnvelope(row.suppression_json),
      );
      const contactSuppressionStates = unique(
        linkedRows.map((row) => row.contact_suppression_state).filter(isString),
      );
      const dndProven = linkedRows.some(
        (row) =>
          row.preferences_present === true && row.email_dnd === false && row.all_dnd === false,
      );
      const dndPresent = linkedRows.some((row) => row.email_dnd === true || row.all_dnd === true);
      const consentProven = linkedRows.some((row) => row.consent_proven === true);
      const marketingSuppressed = suppressionStates.some(
        (value) => value?.marketingSuppressed === true,
      );
      const exactSuppressionActive =
        suppressionStates.length > 0 &&
        suppressionStates.every((value) => value?.marketingSuppressed === false);
      const studentCounts = unique(linkedRows.map((row) => Number(row.self_student_count ?? -1)));
      if (studentCounts.some((count) => !Number.isSafeInteger(count) || count < 0)) {
        ambiguous('student evidence count is invalid');
      }
      const contactClassifications = unique(
        linkedRows.map((row) => row.contact_classification).filter(isString),
      );
      const fact: GovernedCensusDatabaseFacts = {
        providerContactRefHash: hash,
        contactKey: contactKeys.length === 1 ? contactKeys[0]! : null,
        adultEvidenceState,
        studentOrMinorState: studentCounts.some((count) => count > 0)
          ? 'present'
          : identityMatchState === 'exact' && studentCounts.length === 1 && studentCounts[0] === 0
            ? 'absent'
            : 'unknown',
        schoolContactState:
          classifications.includes('school') || contactClassifications.includes('school')
            ? 'present'
            : contactClassifications.length === 1 &&
                contactClassifications[0] === 'family' &&
                adultEvidenceState === 'proven'
              ? 'absent'
              : 'unknown',
        activeOrCurrentSubscriberState: accessStates.some((state) =>
          ['free', 'active', 'grace'].includes(state),
        )
          ? 'present'
          : accessStates.length > 0 &&
              accessStates.every((state) => ['inactive', 'none'].includes(state))
            ? 'absent'
            : 'unknown',
        consentState:
          dndPresent || marketingSuppressed || contactSuppressionStates.includes('suppressed')
            ? 'opted_out'
            : consentProven &&
                dndProven &&
                exactSuppressionActive &&
                contactSuppressionStates.length === 1 &&
                contactSuppressionStates[0] === 'active'
              ? 'opted_in'
              : 'unknown',
        deliverabilityState: linkedRows.some((row) => row.contact_email_present === false)
          ? 'missing'
          : linkedRows.some((row) => row.contact_email_shape_valid === false)
            ? 'invalid'
            : linkedRows.length > 0 &&
                linkedRows.every(
                  (row) =>
                    row.contact_email_present === true && row.contact_email_shape_valid === true,
                )
              ? 'deliverable'
              : 'unknown',
        providerSuppressionState:
          marketingSuppressed || contactSuppressionStates.includes('suppressed') || dndPresent
            ? 'suppressed'
            : exactSuppressionActive &&
                contactSuppressionStates.length === 1 &&
                contactSuppressionStates[0] === 'active' &&
                dndProven
              ? 'active'
              : 'unknown',
        identityMatchState,
        sourceJoinCount: unique(
          linkedRows.map(
            (row) =>
              `${row.identity_source ?? ''}\u001f${row.contact_key ?? ''}\u001f${row.adult_id ?? ''}\u001f${row.household_id ?? ''}\u001f${row.link_state ?? ''}`,
          ),
        ).length,
      };
      return [hash, fact] as const;
    }),
  );
}

function groupHistory(hashes: readonly GovernedCensusSha256[], rows: readonly HistoryRow[]) {
  const grouped = new Map<string, HistoryRow[]>();
  for (const row of rows) {
    if (
      !SHA256_PATTERN.test(row.provider_contact_ref_hash) ||
      !hashes.includes(row.provider_contact_ref_hash as GovernedCensusSha256)
    ) {
      ambiguous('decision history contains an unexpected provider hash');
    }
    const group = grouped.get(row.provider_contact_ref_hash) ?? [];
    group.push(row);
    grouped.set(row.provider_contact_ref_hash, group);
  }
  const result = new Map<string, GovernedCensusDecisionHistory>();
  for (const hash of hashes) {
    const candidates = grouped.get(hash) ?? [];
    if (candidates.length === 0) continue;
    const versions = candidates.map((row) => Number(row.decision_version));
    if (versions.some((version) => !Number.isSafeInteger(version) || version <= 0)) {
      ambiguous('historical decision version is invalid');
    }
    if (new Set(versions).size !== versions.length) {
      ambiguous('historical decision version is duplicated');
    }
    const current = candidates.filter((row) => row.superseded_at === null);
    if (current.length > 1) ambiguous('multiple current historical decisions returned');
    const currentRow = current[0];
    const sourceFactsHash = currentRow ? validatedSourceFactsHash(currentRow) : null;
    if (currentRow && !OPAQUE_KEY_PATTERN.test(currentRow.idempotency_key)) {
      ambiguous('current idempotency key is invalid');
    }
    if (
      currentRow &&
      (!SHA256_PATTERN.test(currentRow.request_hash) ||
        !SHA256_PATTERN.test(currentRow.snapshot_hash))
    ) {
      ambiguous('current request or snapshot hash is invalid');
    }
    result.set(hash, {
      providerContactRefHash: hash,
      maximumDecisionVersion: Math.max(...versions),
      currentDecisionVersion: currentRow ? Number(currentRow.decision_version) : null,
      currentDecision: currentRow ? decision(currentRow.decision) : null,
      currentPrimaryReason: currentRow ? reason(currentRow.primary_reason) : null,
      currentSourceFactsHash: sourceFactsHash,
      currentIdempotencyKey: currentRow ? currentRow.idempotency_key : null,
      currentRequestHash: currentRow ? (currentRow.request_hash as GovernedCensusSha256) : null,
      currentSnapshotHash: currentRow ? (currentRow.snapshot_hash as GovernedCensusSha256) : null,
    });
  }
  return result;
}

function validateInput(input: {
  scope: GovernedCampaignCensusReadScope;
  providerContacts: readonly ProtectedGovernedCensusProviderContact[];
  maximumProviderContacts: number;
}) {
  for (const value of [
    input.scope.verificationEnvironmentId,
    input.scope.accountKey,
    input.scope.productKey,
    input.scope.campaignKey,
  ]) {
    if (!OPAQUE_KEY_PATTERN.test(value)) invalid('scope contains a non-opaque key');
  }
  if (input.scope.runtimeTier !== 'isolated_staging' && input.scope.runtimeTier !== 'production') {
    invalid('runtime tier is invalid');
  }
  if (
    input.scope.binding.providerLocationId !==
      GOVERNED_CAMPAIGN_PROVIDER_BINDING.providerLocationId ||
    input.scope.binding.providerCampaignId !==
      GOVERNED_CAMPAIGN_PROVIDER_BINDING.providerCampaignId ||
    input.scope.binding.providerWorkflowId !==
      GOVERNED_CAMPAIGN_PROVIDER_BINDING.providerWorkflowId ||
    input.scope.binding.providerLaunchTagId !==
      GOVERNED_CAMPAIGN_PROVIDER_BINDING.providerLaunchTagId
  ) {
    invalid('provider binding is not exact');
  }
  if (!Number.isSafeInteger(input.maximumProviderContacts) || input.maximumProviderContacts <= 0) {
    invalid('maximumProviderContacts must be positive');
  }
  if (
    input.providerContacts.length === 0 ||
    input.providerContacts.length > input.maximumProviderContacts
  ) {
    invalid('protected provider contact count is outside the operator ceiling');
  }
  const uniqueHashes = new Set(
    input.providerContacts.map((contact) => contact.providerContactRefHash),
  );
  if (
    uniqueHashes.size !== input.providerContacts.length ||
    input.providerContacts.some(
      (contact) =>
        !SHA256_PATTERN.test(contact.providerContactRefHash) ||
        (contact.normalizedEmailHash !== null && !SHA256_PATTERN.test(contact.normalizedEmailHash)),
    )
  ) {
    invalid('protected provider identity hashes are invalid or duplicated');
  }
}

function requestedContactValues(contacts: readonly ProtectedGovernedCensusProviderContact[]) {
  return {
    sql: contacts
      .map((_, index) => `($${10 + index * 2}::text, $${11 + index * 2}::text)`)
      .join(', '),
    values: contacts.flatMap((contact) => [
      contact.providerContactRefHash,
      contact.normalizedEmailHash,
    ]),
  };
}

function requestedHashValues(hashes: readonly GovernedCensusSha256[]) {
  return {
    sql: hashes.map((_, index) => `($${index + 10}::text)`).join(', '),
    values: hashes,
  };
}

function scopeValues(scope: GovernedCampaignCensusReadScope) {
  return [
    scope.accountKey,
    scope.productKey,
    scope.runtimeTier,
    scope.verificationEnvironmentId,
    scope.campaignKey,
    scope.binding.providerLocationId,
    scope.binding.providerCampaignId,
    scope.binding.providerWorkflowId,
    scope.binding.providerLaunchTagId,
  ] as const;
}

function decisionScopePredicate(alias: string) {
  return `${alias}.account_key = $1
    AND ${alias}.product_key = $2
    AND ${alias}.runtime_tier = $3
    AND ${alias}.verification_environment_id = $4
    AND ${alias}.campaign_key = $5
    AND ${alias}.provider_location_id = $6
    AND ${alias}.provider_campaign_id = $7
    AND ${alias}.provider_workflow_id = $8
    AND ${alias}.provider_launch_tag_id = $9`;
}

function identityState(input: {
  adultIds: readonly string[];
  contactKeys: readonly string[];
  identitySources: readonly string[];
  identityBindings: readonly string[];
  mappingStates: readonly string[];
  selectedLinkStates: readonly string[];
  providerEmailMatchCount: number;
  providerEmailMatches: readonly (boolean | null)[];
  selectedLinkEmailMatches: readonly (boolean | null)[];
  legacyOtherAdultCount: number;
}): GovernedCensusDatabaseFacts['identityMatchState'] {
  if (
    input.adultIds.length > 1 ||
    input.contactKeys.length > 1 ||
    input.identityBindings.length > 1 ||
    input.providerEmailMatchCount > 1
  ) {
    return 'duplicate';
  }
  if (
    input.mappingStates.some((state) => state !== 'synced') ||
    input.selectedLinkStates.some((state) => state !== 'linked') ||
    input.providerEmailMatches.includes(false) ||
    input.selectedLinkEmailMatches.includes(false) ||
    input.legacyOtherAdultCount > 0
  ) {
    return 'ambiguous';
  }
  if (
    input.adultIds.length === 1 &&
    input.contactKeys.length === 1 &&
    input.identitySources.length === 1 &&
    (input.identitySources[0] === 'durable_mapping' ||
      input.identitySources[0] === 'normalized_email_fallback')
  ) {
    return 'exact';
  }
  return 'missing';
}

function validateFactRowEnums(row: FactRow) {
  requireDatabaseEnum(
    row.identity_source,
    ['durable_mapping', 'normalized_email_fallback'],
    'identity source',
  );
  requireDatabaseEnum(
    row.mapping_sync_state,
    ['sync_pending', 'synced', 'conflict'],
    'mapping sync state',
  );
  if (
    (row.identity_source === 'durable_mapping' &&
      (!isString(row.mapped_household_key) ||
        row.mapped_household_key.length === 0 ||
        row.mapping_sync_state === null)) ||
    (row.identity_source === 'normalized_email_fallback' &&
      (row.mapped_household_key !== null ||
        row.mapping_sync_state !== null ||
        row.provider_email_matches_contact !== true)) ||
    (row.identity_source === null &&
      (row.mapped_household_key !== null || row.mapping_sync_state !== null))
  ) {
    ambiguous('identity source evidence is incoherent');
  }
  requireDatabaseEnum(row.link_state, ['unlinked', 'linked', 'identity_review'], 'link state');
  requireDatabaseEnum(row.adult_state, ['active', 'archived'], 'adult state');
  requireDatabaseEnum(
    row.classification,
    ['family', 'school', 'complimentary'],
    'household classification',
  );
  requireDatabaseEnum(
    row.access_projection,
    ['free', 'active', 'grace', 'inactive', 'none'],
    'access projection',
  );
  requireDatabaseEnum(row.contact_classification, ['family', 'school'], 'contact classification');
  requireDatabaseEnum(
    row.contact_suppression_state,
    ['active', 'suppressed'],
    'contact suppression state',
  );
  for (const [field, value] of [
    ['consent proof', row.consent_proven],
    ['email presence', row.contact_email_present],
    ['email shape', row.contact_email_shape_valid],
    ['preferences presence', row.preferences_present],
    ['email DND', row.email_dnd],
    ['all DND', row.all_dnd],
    ['provider email match', row.provider_email_matches_contact],
    ['selected link email match', row.selected_link_email_matches_adult],
  ] as const) {
    if (value !== null && value !== undefined && typeof value !== 'boolean') {
      ambiguous(`${field} is invalid`);
    }
  }
}

function canonicalSuppressionEnvelope(value: unknown): {
  marketingSuppressed: boolean;
  serviceSuppressed: boolean;
  evidenceDigest: GovernedCensusSha256;
  version: number;
} | null {
  const envelope = record(value);
  if (
    JSON.stringify(Object.keys(envelope).sort()) !==
      JSON.stringify(
        ['evidence_digest', 'marketing_suppressed', 'service_suppressed', 'version'].sort(),
      ) ||
    typeof envelope.marketing_suppressed !== 'boolean' ||
    typeof envelope.service_suppressed !== 'boolean' ||
    typeof envelope.evidence_digest !== 'string' ||
    !SHA256_PATTERN.test(envelope.evidence_digest) ||
    !Number.isSafeInteger(envelope.version) ||
    Number(envelope.version) <= 0
  ) {
    return null;
  }
  return {
    marketingSuppressed: envelope.marketing_suppressed,
    serviceSuppressed: envelope.service_suppressed,
    evidenceDigest: envelope.evidence_digest as GovernedCensusSha256,
    version: Number(envelope.version),
  };
}

function requireDatabaseEnum(value: unknown, allowed: readonly string[], field: string) {
  if (
    value !== null &&
    value !== undefined &&
    (typeof value !== 'string' || !allowed.includes(value))
  ) {
    ambiguous(`${field} is invalid`);
  }
}

function validatedSourceFactsHash(row: HistoryRow): GovernedCensusSha256 {
  const facts = record(row.source_facts);
  const keys = Object.keys(facts).sort();
  const exactKeys = [
    'activeOrCurrentSubscriberState',
    'adultEvidenceState',
    'consentState',
    'deliverabilityState',
    'identityMatchState',
    'providerSuppressionState',
    'schoolContactState',
    'sourceFactsHash',
    'sourceJoinCount',
    'studentOrMinorState',
  ].sort();
  if (JSON.stringify(keys) !== JSON.stringify(exactKeys)) {
    ambiguous('current source facts object is not the exact sanitized shape');
  }
  requireDatabaseEnum(
    facts.adultEvidenceState,
    ['proven', 'not_proven', 'conflicting'],
    'history adult evidence',
  );
  requireDatabaseEnum(
    facts.studentOrMinorState,
    ['absent', 'present', 'unknown'],
    'history student state',
  );
  requireDatabaseEnum(
    facts.schoolContactState,
    ['absent', 'present', 'unknown'],
    'history school state',
  );
  requireDatabaseEnum(
    facts.activeOrCurrentSubscriberState,
    ['absent', 'present', 'unknown'],
    'history access state',
  );
  requireDatabaseEnum(
    facts.consentState,
    ['opted_in', 'opted_out', 'unknown'],
    'history consent state',
  );
  requireDatabaseEnum(
    facts.deliverabilityState,
    ['deliverable', 'invalid', 'missing', 'unknown'],
    'history deliverability state',
  );
  requireDatabaseEnum(
    facts.providerSuppressionState,
    ['active', 'suppressed', 'unknown'],
    'history suppression state',
  );
  requireDatabaseEnum(
    facts.identityMatchState,
    ['exact', 'duplicate', 'ambiguous', 'missing'],
    'history identity state',
  );
  if (!Number.isSafeInteger(facts.sourceJoinCount) || Number(facts.sourceJoinCount) < 0) {
    ambiguous('history sourceJoinCount is invalid');
  }
  const claimed = String(facts.sourceFactsHash ?? '');
  if (!SHA256_PATTERN.test(claimed)) ambiguous('current source facts hash is invalid');
  const { sourceFactsHash: _ignored, ...withoutHash } = facts;
  void _ignored;
  const expected = governedCampaignCanonicalSha256({
    providerContactRefHash: row.provider_contact_ref_hash,
    contactKey: row.contact_key,
    ...withoutHash,
  });
  if (claimed !== expected) ambiguous('current source facts hash does not match its full facts');
  return claimed as GovernedCensusSha256;
}

function decision(value: string): GovernedCensusDecision {
  if (value === 'include' || value === 'exclude' || value === 'review') return value;
  ambiguous('historical decision is invalid');
}

function reason(value: string): GovernedCensusReason {
  const allowed: readonly GovernedCensusReason[] = [
    'eligible_inactive_adult',
    'active_or_current_subscriber',
    'student_or_minor',
    'school_contact',
    'duplicate_contact',
    'missing_email',
    'invalid_email',
    'email_dnd_or_unsubscribed',
    'provider_suppression',
    'ambiguous_identity',
    'unknown_consent',
  ];
  if (allowed.includes(value as GovernedCensusReason)) return value as GovernedCensusReason;
  ambiguous('historical primary reason is invalid');
}

function record(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function unique<T>(values: readonly T[]) {
  return [...new Set(values)];
}

function nonnegativeCount(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    ambiguous(`${field} count is invalid`);
  }
  return parsed;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function invalid(message: string): never {
  throw new GovernedCampaignCensusReaderError('INVALID_READ_SCOPE', message);
}

function ambiguous(message: string): never {
  throw new GovernedCampaignCensusReaderError('AMBIGUOUS_DATABASE_READBACK', message);
}
