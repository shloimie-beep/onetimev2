import { createHash } from 'node:crypto';

import type { DbPool } from '../../../../../../packages/db/src/index.ts';
import type { CommunicationSuppressionSnapshot } from '../../../../../../packages/contracts/src/communications/foundation/index.ts';
import type { JobScope } from '../../../../../../packages/contracts/src/jobs/index.ts';
import type { CampaignAudienceCandidate } from '../../../../../../packages/domain/src/communications/workflows/campaigns/index.ts';
import { ot16OperationId } from '../../../../../../packages/domain/src/communications/workflows/campaigns/index.ts';
import type { Ot16CandidatePreflight, Ot16DueCheckpoint } from './composition.ts';

const OT16_CHECKPOINT_DAYS = [14, 7, 3, 1, 0] as const;
const OT16_CHECKPOINT_WINDOW_MS = 24 * 60 * 60 * 1_000;

type Ot16ReadModelInput = {
  pool: DbPool;
  runtimeTier: JobScope['runtime_tier'];
  verificationEnvironmentId: JobScope['verification_environment_id'];
  canonicalExpiryAt: string;
  now?: () => Date;
};

type Row = Record<string, unknown>;

export function createPostgresOt16CampaignReadModel(input: Ot16ReadModelInput) {
  const canonicalExpiryAt = requiredIso(input.canonicalExpiryAt, 'canonical_expiry');
  const now = input.now ?? (() => new Date());

  return {
    async listDueCheckpoints(): Promise<readonly Ot16DueCheckpoint[]> {
      const selected = await input.pool.query<Row>(DUE_ADULTS_SQL, [
        'one_time_mishnayos',
        input.runtimeTier,
        input.verificationEnvironmentId,
        canonicalExpiryAt,
      ]);
      const observedAt = now();
      if (!Number.isFinite(observedAt.getTime())) throw new Error('ot16_observed_at_invalid');
      const due = uniqueAdultRows(selected.rows).flatMap((row) => dueForRow(row, observedAt));
      if (due.length === 0) return [];

      const operationByCheckpoint = new Map(
        due.map((checkpoint) => [
          ot16OperationId({
            adult_id: checkpoint.adultId,
            expiry_at: checkpoint.expiryAt,
            checkpoint_days: checkpoint.checkpointDays,
          }),
          checkpoint,
        ]),
      );
      const existing = await input.pool.query<Row>(EXISTING_DECISIONS_SQL, [
        [...operationByCheckpoint.keys()],
      ]);
      for (const row of existing.rows) {
        const operationId = text(row.operation_id);
        if (operationId) operationByCheckpoint.delete(operationId);
      }
      return [...operationByCheckpoint.values()].sort(compareCheckpoint);
    },

    async preflight(checkpoint: Ot16DueCheckpoint): Promise<Ot16CandidatePreflight> {
      if (
        checkpoint.expiryAt !== canonicalExpiryAt ||
        !OT16_CHECKPOINT_DAYS.includes(checkpoint.checkpointDays)
      ) {
        return { ready: false, reason: 'ot16_checkpoint_scope_mismatch' };
      }
      const facts = await readFacts(input, canonicalExpiryAt, checkpoint.adultId);
      if (!facts) return { ready: false, reason: 'ot16_adult_evidence_unavailable' };
      const suppression = suppressionFromFacts(facts, now());
      if (!suppression) return { ready: false, reason: 'ot16_suppression_evidence_unavailable' };
      return {
        ready: true,
        identityLinkState: identityState(facts.link_state),
        mappingReconciliationState: mappingState(facts.mapping_reconciliation_state),
        candidate: candidateFromFacts(facts),
        suppression,
      };
    },

    suppression: {
      async readCurrent(adultId: string): Promise<CommunicationSuppressionSnapshot> {
        const facts = await readFacts(input, canonicalExpiryAt, adultId);
        const suppression = facts ? suppressionFromFacts(facts, now()) : null;
        if (!suppression) throw new Error('ot16_suppression_evidence_unavailable');
        return suppression;
      },
    },

    eligibility: {
      async readCurrent(adultId: string): Promise<CampaignAudienceCandidate> {
        const facts = await readFacts(input, canonicalExpiryAt, adultId);
        if (!facts) throw new Error('ot16_adult_evidence_unavailable');
        return candidateFromFacts(facts);
      },
    },
  };
}

function dueForRow(row: Row, now: Date): Ot16DueCheckpoint[] {
  const adultId = text(row.adult_id);
  const expiryAt = safeIso(row.free_access_expires_at);
  if (!adultId || !expiryAt) return [];
  const expiryMs = Date.parse(expiryAt);
  const nowMs = now.getTime();
  return OT16_CHECKPOINT_DAYS.flatMap((checkpointDays) => {
    const dueAt = expiryMs - checkpointDays * 24 * 60 * 60 * 1_000;
    return nowMs >= dueAt && nowMs < dueAt + OT16_CHECKPOINT_WINDOW_MS
      ? [{ adultId, expiryAt, checkpointDays, expectedVersion: 0 }]
      : [];
  });
}

function uniqueAdultRows(rows: readonly Row[]): Row[] {
  const grouped = new Map<string, { row: Row; households: Set<string> }>();
  for (const row of rows) {
    const adultId = text(row.adult_id);
    const householdId = text(row.household_id);
    const expiryAt = safeIso(row.free_access_expires_at);
    if (!adultId || !householdId || !expiryAt) continue;
    const key = `${adultId}\0${expiryAt}`;
    const current = grouped.get(key) ?? { row, households: new Set<string>() };
    current.households.add(householdId);
    grouped.set(key, current);
  }
  return [...grouped.values()]
    .filter(({ households }) => households.size === 1)
    .map(({ row }) => row);
}

async function readFacts(
  input: Ot16ReadModelInput,
  canonicalExpiryAt: string,
  adultId: string,
): Promise<Row | null> {
  if (!adultId.trim()) return null;
  const result = await input.pool.query<Row>(CURRENT_FACTS_SQL, [
    'one_time_mishnayos',
    input.runtimeTier,
    input.verificationEnvironmentId,
    canonicalExpiryAt,
    adultId,
  ]);
  return result.rows.length === 1 ? result.rows[0]! : null;
}

function candidateFromFacts(row: Row): CampaignAudienceCandidate {
  const adultId = requiredText(row.adult_id, 'adult_id');
  const householdId = requiredText(row.household_id, 'household_id');
  return {
    subject: { kind: 'adult', adult_id: adultId, household_id: householdId },
    current_account_owner: row.current_account_owner === true,
    newsletter_permission: row.newsletter_permission === true,
    marketing_permission: row.marketing_permission === true,
    former_or_canceled: row.explicitly_declined === true,
    active_parent: row.active_parent === true,
    verified_paid_access: row.verified_paid_access === true,
    explicitly_declined: row.explicitly_declined === true,
    custom_school_terms: row.custom_school_terms === true,
  };
}

function suppressionFromFacts(row: Row, capturedAt: Date): CommunicationSuppressionSnapshot | null {
  const adultId = text(row.adult_id);
  const link = exactSuppressionEnvelope(row.suppression_json);
  if (
    !adultId ||
    !link ||
    row.preferences_present !== true ||
    typeof row.email_dnd !== 'boolean' ||
    typeof row.all_dnd !== 'boolean' ||
    (row.contact_suppression_state !== 'active' &&
      row.contact_suppression_state !== 'suppressed') ||
    !Number.isFinite(capturedAt.getTime())
  ) {
    return null;
  }
  const emailDnd = row.email_dnd || row.all_dnd;
  const unsubscribed = row.contact_suppression_state === 'suppressed';
  const marketingSuppressed =
    link.marketing_suppressed || link.service_suppressed || emailDnd || unsubscribed;
  const minimized = {
    adult_id: adultId,
    all_dnd: row.all_dnd,
    contact_suppression_state: row.contact_suppression_state,
    email_dnd: row.email_dnd,
    identity_evidence_digest: link.evidence_digest,
    identity_suppression_version: link.version,
    marketing_suppressed: marketingSuppressed,
    service_suppressed: link.service_suppressed,
  };
  const evidenceDigest = digest(minimized);
  return {
    snapshot_id: digest({ purpose: 'OT-16', evidence_digest: evidenceDigest }),
    adult_id: adultId,
    captured_at: capturedAt.toISOString(),
    email_dnd: emailDnd,
    unsubscribed,
    complaint: false,
    hard_bounce: false,
    invalid_address: false,
    marketing_suppressed: marketingSuppressed,
    optional_reminder_suppressed: marketingSuppressed,
    evidence_digest: evidenceDigest,
  };
}

function exactSuppressionEnvelope(value: unknown): {
  marketing_suppressed: boolean;
  service_suppressed: boolean;
  evidence_digest: string;
  version: number;
} | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    JSON.stringify(Object.keys(record).sort()) !==
      JSON.stringify(
        ['evidence_digest', 'marketing_suppressed', 'service_suppressed', 'version'].sort(),
      ) ||
    typeof record.marketing_suppressed !== 'boolean' ||
    typeof record.service_suppressed !== 'boolean' ||
    typeof record.evidence_digest !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(record.evidence_digest) ||
    !Number.isSafeInteger(record.version) ||
    Number(record.version) < 1
  ) {
    return null;
  }
  return record as {
    marketing_suppressed: boolean;
    service_suppressed: boolean;
    evidence_digest: string;
    version: number;
  };
}

function identityState(value: unknown): 'unlinked' | 'linked' | 'identity_review' {
  if (value === 'unlinked' || value === 'linked' || value === 'identity_review') return value;
  throw new Error('ot16_identity_state_invalid');
}

function mappingState(value: unknown): 'in_sync' | 'reconciliation_hold' {
  if (value === 'in_sync' || value === 'reconciliation_hold') return value;
  throw new Error('ot16_mapping_state_invalid');
}

function compareCheckpoint(left: Ot16DueCheckpoint, right: Ot16DueCheckpoint): number {
  return (
    left.expiryAt.localeCompare(right.expiryAt) ||
    right.checkpointDays - left.checkpointDays ||
    left.adultId.localeCompare(right.adultId)
  );
}

function requiredIso(value: unknown, field: string): string {
  const iso = safeIso(value);
  if (!iso) throw new Error(`ot16_${field}_invalid`);
  return iso;
}

function safeIso(value: unknown): string | null {
  if (typeof value !== 'string' && !(value instanceof Date)) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function requiredText(value: unknown, field: string): string {
  const result = text(value);
  if (!result) throw new Error(`ot16_${field}_missing`);
  return result;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function digest(value: unknown): string {
  return createHash('sha256').update(stableJson(value), 'utf8').digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

const DUE_ADULTS_SQL = `
WITH latest_marketing AS (
  SELECT DISTINCT ON (
           consent.adult_id,
           consent.product,
           consent.runtime_tier,
           consent.verification_environment_id
         )
         consent.adult_id,
         consent.product,
         consent.runtime_tier,
         consent.verification_environment_id,
         consent.choice
    FROM onetime.family_signup_consents AS consent
   WHERE consent.consent_scope = 'general_marketing'
   ORDER BY consent.adult_id,
            consent.product,
            consent.runtime_tier,
            consent.verification_environment_id,
            consent.recorded_at DESC,
            consent.idempotency_key DESC
)
SELECT adult.adult_id, household.household_id, access.free_access_expires_at
  FROM onetime.family_signup_access_projections AS access
  JOIN onetime.v21_households AS household
    ON household.household_id = access.household_id
   AND household.product_key = access.product
   AND household.runtime_tier = access.runtime_tier
   AND household.verification_environment_id = access.verification_environment_id
  JOIN onetime.v21_adult_identities AS adult
    ON adult.adult_id = household.owner_adult_id
   AND adult.product_key = access.product
   AND adult.runtime_tier = access.runtime_tier
   AND adult.verification_environment_id = access.verification_environment_id
  JOIN onetime.v21_human_accounts AS account
    ON account.human_account_id = household.owner_human_account_id
   AND account.adult_id = adult.adult_id
   AND account.product_key = access.product
   AND account.runtime_tier = access.runtime_tier
   AND account.verification_environment_id = access.verification_environment_id
  JOIN latest_marketing AS marketing
    ON marketing.adult_id = adult.adult_id
   AND marketing.product = access.product
   AND marketing.runtime_tier = access.runtime_tier
   AND marketing.verification_environment_id = access.verification_environment_id
   AND marketing.choice = true
  JOIN onetime.v21_human_account_role_memberships AS parent_role
    ON parent_role.human_account_id = account.human_account_id
   AND parent_role.product_key = access.product
   AND parent_role.runtime_tier = access.runtime_tier
   AND parent_role.verification_environment_id = access.verification_environment_id
   AND parent_role.role = 'parent'
   AND parent_role.revoked_at IS NULL
 WHERE access.product = $1
   AND access.runtime_tier = $2
   AND access.verification_environment_id = $3
   AND access.access_branch = 'immediate_free'
   AND access.access_state = 'free'
   AND access.free_access_expires_at = $4::timestamptz
   AND household.classification = 'family'
   AND household.state = 'active'
   AND adult.state = 'active'
   AND account.state = 'active'
 ORDER BY access.free_access_expires_at, adult.adult_id, household.household_id`;

const EXISTING_DECISIONS_SQL = `
SELECT operation_id
  FROM onetime.communication_decision
 WHERE operation_id = ANY($1::text[])
 ORDER BY operation_id`;

const CURRENT_FACTS_SQL = `
WITH latest_consent AS (
  SELECT DISTINCT ON (
           consent.adult_id,
           consent.product,
           consent.runtime_tier,
           consent.verification_environment_id,
           consent.consent_scope
         )
         consent.adult_id,
         consent.product,
         consent.runtime_tier,
         consent.verification_environment_id,
         consent.consent_scope,
         consent.choice
    FROM onetime.family_signup_consents AS consent
   ORDER BY consent.adult_id,
            consent.product,
            consent.runtime_tier,
            consent.verification_environment_id,
            consent.consent_scope,
            consent.recorded_at DESC,
            consent.idempotency_key DESC
),
latest_entitlement AS (
  SELECT DISTINCT ON (entitlement.product_key, entitlement.principal_key)
         entitlement.product_key,
         entitlement.principal_key,
         (entitlement.status = 'active' AND entitlement.grants_access)
           AS verified_paid_access
    FROM onetime.billing_entitlement_projections AS entitlement
   WHERE entitlement.principal_type = 'opaque'
   ORDER BY entitlement.product_key,
            entitlement.principal_key,
            entitlement.updated_at DESC,
            entitlement.entitlement_key DESC
),
latest_subscription AS (
  SELECT DISTINCT ON (subscription.product_key, subscription.principal_key)
         subscription.product_key,
         subscription.principal_key,
         (subscription.status = 'canceled') AS explicitly_declined
    FROM onetime.billing_subscription_projections AS subscription
   WHERE subscription.principal_type = 'opaque'
     AND subscription.provider = 'stripe'
     AND subscription.mode = 'test'
   ORDER BY subscription.product_key,
            subscription.principal_key,
            subscription.provider_updated_at DESC,
            subscription.provider_subscription_ref DESC
)
SELECT adult.adult_id,
       household.household_id,
       (household.owner_adult_id = adult.adult_id) AS current_account_owner,
       true AS active_parent,
       COALESCE(marketing.choice, false) AS marketing_permission,
       COALESCE(newsletter.choice, false) AS newsletter_permission,
       COALESCE(latest_entitlement.verified_paid_access, false) AS verified_paid_access,
       COALESCE(latest_subscription.explicitly_declined, false) AS explicitly_declined,
       (household.classification = 'school') AS custom_school_terms,
       identity.state AS link_state,
       identity.suppression_json,
       mapping.reconciliation_state AS mapping_reconciliation_state,
       (preferences.contact_key IS NOT NULL) AS preferences_present,
       preferences.email_dnd,
       preferences.all_dnd,
       contact.suppression_state AS contact_suppression_state
  FROM onetime.family_signup_access_projections AS access
  JOIN onetime.v21_households AS household
    ON household.household_id = access.household_id
   AND household.product_key = access.product
   AND household.runtime_tier = access.runtime_tier
   AND household.verification_environment_id = access.verification_environment_id
  JOIN onetime.v21_adult_identities AS adult
    ON adult.adult_id = household.owner_adult_id
   AND adult.product_key = access.product
   AND adult.runtime_tier = access.runtime_tier
   AND adult.verification_environment_id = access.verification_environment_id
  JOIN onetime.v21_human_accounts AS account
    ON account.human_account_id = household.owner_human_account_id
   AND account.adult_id = adult.adult_id
   AND account.product_key = access.product
   AND account.runtime_tier = access.runtime_tier
   AND account.verification_environment_id = access.verification_environment_id
  JOIN onetime.v21_human_account_role_memberships AS parent_role
    ON parent_role.human_account_id = account.human_account_id
   AND parent_role.product_key = access.product
   AND parent_role.runtime_tier = access.runtime_tier
   AND parent_role.verification_environment_id = access.verification_environment_id
   AND parent_role.role = 'parent'
   AND parent_role.revoked_at IS NULL
  JOIN onetime.adult_ghl_identity_link AS identity
    ON identity.adult_id = adult.adult_id
   AND identity.product_key = access.product
   AND identity.runtime_tier = access.runtime_tier
   AND identity.verification_environment_id = access.verification_environment_id
  JOIN onetime.household_provider_mapping AS mapping
    ON mapping.household_id = household.household_id
   AND mapping.owner_adult_id = adult.adult_id
   AND mapping.product_key = access.product
   AND mapping.runtime_tier = access.runtime_tier
   AND mapping.verification_environment_id = access.verification_environment_id
  LEFT JOIN onetime.contacts AS contact
    ON contact.product_key = access.product
   AND contact.email_normalized = adult.normalized_email
  LEFT JOIN onetime.highlevel_contact_preferences AS preferences
    ON preferences.account_key = contact.account_key
   AND preferences.product_key = contact.product_key
   AND preferences.contact_key = contact.contact_key
  LEFT JOIN latest_consent AS marketing
    ON marketing.adult_id = adult.adult_id
   AND marketing.product = access.product
   AND marketing.runtime_tier = access.runtime_tier
   AND marketing.verification_environment_id = access.verification_environment_id
   AND marketing.consent_scope = 'general_marketing'
  LEFT JOIN latest_consent AS newsletter
    ON newsletter.adult_id = adult.adult_id
   AND newsletter.product = access.product
   AND newsletter.runtime_tier = access.runtime_tier
   AND newsletter.verification_environment_id = access.verification_environment_id
   AND newsletter.consent_scope = 'parent_newsletter'
  LEFT JOIN latest_entitlement
    ON latest_entitlement.product_key = access.product
   AND latest_entitlement.principal_key = household.household_id
  LEFT JOIN latest_subscription
    ON latest_subscription.product_key = access.product
   AND latest_subscription.principal_key = household.household_id
 WHERE access.product = $1
   AND access.runtime_tier = $2
   AND access.verification_environment_id = $3
   AND access.free_access_expires_at = $4::timestamptz
   AND adult.adult_id = $5
   AND access.access_branch = 'immediate_free'
   AND access.access_state = 'free'
   AND household.state = 'active'
   AND adult.state = 'active'
   AND account.state = 'active'
 ORDER BY mapping.billing_program, contact.contact_key
 LIMIT 3`;
