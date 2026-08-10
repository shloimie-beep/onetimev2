import { createHash } from 'node:crypto';
import type { DbPool, Queryable } from '../../../../../../../packages/db/src/index.ts';

type RuntimeTier = 'isolated_staging' | 'production';
type VerificationEnvironmentId =
  | 'ci'
  | 'provider_sandbox'
  | 'persistent_staging'
  | 'production_read_only'
  | 'production_operator_canary'
  | 'production_broad';

type Scope = {
  household_id: string;
  product: 'one_time_mishnayos';
  runtime_tier: RuntimeTier;
  verification_environment_id: VerificationEnvironmentId;
};

export type FamilySignupAccessSourceCorrectionRequest = Scope & {
  correction_receipt_key: string;
  controller_authorization_reference: string;
  source_effective_at: string;
  expires_at: string;
  observed_at: string;
};

export type FamilySignupAccessSourceCorrectionInspection =
  | { disposition: 'eligible'; source_transition_key: string }
  | { disposition: 'ineligible'; reason: string };

export type FamilySignupAccessSourceCorrectionExecution =
  FamilySignupAccessSourceCorrectionRequest & {
    mode: 'execute';
    controller_execution_gate: 'approved_family_signup_access_source_correction';
    production_execution_gate?: 'approved_family_signup_access_source_correction';
  };

const EXECUTION_GATE = 'approved_family_signup_access_source_correction' as const;
export const FAMILY_SIGNUP_ACCESS_CORRECTION_SOURCE_EFFECTIVE_AT = '2026-08-04T12:05:49.000Z';
export const FAMILY_SIGNUP_ACCESS_CORRECTION_EXPIRES_AT = '2026-09-11T18:00:00+03:00';

/**
 * Read-only candidate inspection. It does not lock or insert records and is
 * safe to use for a future controller review. The ordinary Parent portal never
 * calls the execute operation below.
 */
export async function inspectFamilySignupAccessSourceCorrection(
  db: Queryable,
  input: FamilySignupAccessSourceCorrectionRequest,
): Promise<FamilySignupAccessSourceCorrectionInspection> {
  const invalid = validateRequest(input);
  if (invalid) return { disposition: 'ineligible', reason: invalid };
  if (Date.parse(input.observed_at) >= Date.parse(input.expires_at)) {
    return { disposition: 'ineligible', reason: 'free_period_cutoff_reached' };
  }
  const candidate = await loadCandidate(db, input, false);
  return candidate
    ? { disposition: 'eligible', source_transition_key: candidate.source_transition_key }
    : { disposition: 'ineligible', reason: 'canonical_source_not_exactly_eligible' };
}

/**
 * The only write path for this correction. It is deliberately not registered
 * as a web route or worker task. A future controller must explicitly invoke it
 * with the named authorization gate after reviewing the dry run.
 */
export async function executeFamilySignupAccessSourceCorrection(
  pool: DbPool,
  input: FamilySignupAccessSourceCorrectionExecution,
) {
  if (input.controller_execution_gate !== EXECUTION_GATE) {
    throw new Error('Family-signup access correction requires controller authorization.');
  }
  if (input.runtime_tier === 'production' && input.production_execution_gate !== EXECUTION_GATE) {
    throw new Error(
      'Production Family-signup access correction requires a separate controller gate.',
    );
  }
  const invalid = validateRequest(input);
  if (invalid) throw new Error(`Family-signup access correction refused: ${invalid}.`);
  if (Date.parse(input.observed_at) >= Date.parse(input.expires_at)) {
    throw new Error('Family-signup access correction refused: free_period_cutoff_reached.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `family-signup-access-source-correction:${input.household_id}`,
    ]);
    const existing = await client.query(
      `SELECT correction_receipt_key
         FROM onetime.family_signup_access_source_correction_receipts
        WHERE correction_receipt_key = $1
          AND household_id = $2
          AND product = $3
          AND runtime_tier = $4
          AND verification_environment_id = $5
        FOR UPDATE`,
      [
        input.correction_receipt_key,
        input.household_id,
        input.product,
        input.runtime_tier,
        input.verification_environment_id,
      ],
    );
    if (existing.rowCount === 1) {
      await client.query('COMMIT');
      return { disposition: 'replayed' as const };
    }
    if ((existing.rowCount ?? 0) > 1) {
      throw new Error('Family-signup access correction receipt is ambiguous.');
    }

    const candidate = await loadCandidate(client, input, true);
    if (!candidate) {
      throw new Error(
        'Family-signup access correction refused: canonical_source_not_exactly_eligible.',
      );
    }
    const requestDigest = createHash('sha256')
      .update(
        [
          input.correction_receipt_key,
          input.household_id,
          input.product,
          input.runtime_tier,
          input.verification_environment_id,
          input.source_effective_at,
          input.expires_at,
          input.controller_authorization_reference,
        ].join('\u001f'),
      )
      .digest('hex');
    const inserted = await client.query(
      `INSERT INTO onetime.family_signup_access_source_correction_receipts
         (correction_receipt_key, household_id, product, runtime_tier,
          verification_environment_id, source_transition_key, source_effective_at,
          expires_at, correction_state, controller_authorization_reference, request_digest)
       VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8::timestamptz,'active',$9,$10)`,
      [
        input.correction_receipt_key,
        input.household_id,
        input.product,
        input.runtime_tier,
        input.verification_environment_id,
        candidate.source_transition_key,
        input.source_effective_at,
        input.expires_at,
        input.controller_authorization_reference,
        requestDigest,
      ],
    );
    if (inserted.rowCount !== 1)
      throw new Error('Family-signup access correction was not recorded.');
    await client.query('COMMIT');
    return { disposition: 'committed' as const };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function loadCandidate(
  db: Queryable,
  input: FamilySignupAccessSourceCorrectionRequest,
  lock: boolean,
) {
  const result = await db.query(
    `SELECT transition.transition_key AS source_transition_key
       FROM onetime.v21_households AS household
       JOIN onetime.canonical_aggregate_states AS access
         ON access.aggregate_kind = 'access'
        AND access.aggregate_key = household.household_id
        AND access.product_key = household.product_key
        AND access.runtime_tier = household.runtime_tier
        AND access.verification_environment_id = household.verification_environment_id
        AND access.current_state = 'free'
        AND access.version = 1
        AND access.archived_at IS NULL
       JOIN onetime.canonical_state_transition_events AS transition
         ON transition.transition_key = access.last_transition_key
        AND transition.aggregate_kind = 'access'
        AND transition.aggregate_key = household.household_id
        AND transition.product_key = household.product_key
        AND transition.runtime_tier = household.runtime_tier
        AND transition.verification_environment_id = household.verification_environment_id
        AND transition.previous_state IS NULL
        AND transition.next_state = 'free'
        AND transition.expected_version = 0
        AND transition.resulting_version = 1
        AND transition.access_cause = 'free_period'
        AND transition.created_at = $5::timestamptz
      WHERE household.household_id = $1
        AND household.product_key = $2
        AND household.runtime_tier = $3
        AND household.verification_environment_id = $4
        AND household.classification = 'family'
        AND household.state = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM onetime.family_signup_access_projections AS projection
           WHERE projection.household_id = $1
             AND projection.product = $2
             AND projection.runtime_tier = $3
             AND projection.verification_environment_id = $4
        )
        AND NOT EXISTS (
          SELECT 1 FROM onetime.family_signup_requests AS request
           WHERE request.household_id = $1
             AND request.product = $2
             AND request.runtime_tier = $3
             AND request.verification_environment_id = $4
        )
        AND NOT EXISTS (
          SELECT 1 FROM onetime.family_signup_receipts AS receipt
           WHERE receipt.household_id = $1
             AND receipt.product = $2
             AND receipt.runtime_tier = $3
             AND receipt.verification_environment_id = $4
        )
        AND NOT EXISTS (
          SELECT 1 FROM onetime.family_signup_outbox AS outbox
           WHERE outbox.household_id = $1
             AND outbox.product = $2
             AND outbox.runtime_tier = $3
             AND outbox.verification_environment_id = $4
        )
        AND NOT EXISTS (
          SELECT 1 FROM onetime.family_signup_consents AS consent
           JOIN onetime.family_signup_requests AS request
             ON request.idempotency_key = consent.idempotency_key
            AND request.product = consent.product
            AND request.runtime_tier = consent.runtime_tier
            AND request.verification_environment_id = consent.verification_environment_id
            AND request.operation = consent.operation
            AND request.canonical_request_digest = consent.canonical_request_digest
          WHERE request.household_id = $1
            AND request.product = $2
            AND request.runtime_tier = $3
            AND request.verification_environment_id = $4
        )
      LIMIT 2
      ${lock ? 'FOR UPDATE OF household, access, transition' : ''}`,
    [
      input.household_id,
      input.product,
      input.runtime_tier,
      input.verification_environment_id,
      input.source_effective_at,
    ],
  );
  if (result.rowCount !== 1) return null;
  return result.rows[0] as { source_transition_key: string };
}

function validateRequest(input: FamilySignupAccessSourceCorrectionRequest) {
  if (!input.correction_receipt_key || !input.controller_authorization_reference) {
    return 'missing_correction_identity';
  }
  if (
    !Number.isFinite(Date.parse(input.source_effective_at)) ||
    !Number.isFinite(Date.parse(input.expires_at)) ||
    !Number.isFinite(Date.parse(input.observed_at))
  ) {
    return 'invalid_timestamp';
  }
  if (Date.parse(input.expires_at) <= Date.parse(input.source_effective_at)) {
    return 'invalid_free_period_window';
  }
  if (
    Date.parse(input.source_effective_at) !==
      Date.parse(FAMILY_SIGNUP_ACCESS_CORRECTION_SOURCE_EFFECTIVE_AT) ||
    Date.parse(input.expires_at) !== Date.parse(FAMILY_SIGNUP_ACCESS_CORRECTION_EXPIRES_AT)
  ) {
    return 'unexpected_historical_free_period_window';
  }
  return null;
}
