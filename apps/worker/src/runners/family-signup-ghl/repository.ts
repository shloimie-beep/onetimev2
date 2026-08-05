import { createHash, randomUUID } from 'node:crypto';
import type { DbPool } from '../../../../../packages/db/src/index.ts';
import type {
  FamilySignupGhlClaim,
  FamilySignupGhlRepository,
  FamilySignupGhlStep,
} from './types.ts';

type Row = Record<string, unknown>;

export function createPostgresFamilySignupGhlRepository(pool: DbPool): FamilySignupGhlRepository {
  return {
    async claimNext(input) {
      await pool.query(
        `INSERT INTO onetime.family_signup_ghl_dispatches (intent_id)
         SELECT outbox.intent_id
           FROM onetime.family_signup_outbox AS outbox
          WHERE outbox.product = 'one_time_mishnayos'
            AND outbox.runtime_tier = $1
            AND outbox.verification_environment_id = $2
            AND outbox.dispatch_state = 'ready'
         ON CONFLICT (intent_id) DO NOTHING`,
        [input.runtimeTier, input.verificationEnvironmentId],
      );
      await pool.query(
        `UPDATE onetime.family_signup_ghl_dispatches
            SET state = CASE
                  WHEN current_step = 'workflow_enrollment' THEN 'acceptance_unknown'
                  ELSE 'retry'
                END,
                safe_error_code = CASE
                  WHEN current_step = 'workflow_enrollment'
                    THEN 'workflow_acceptance_unknown_after_lease_expiry'
                  ELSE 'idempotent_step_lease_expired'
                END,
                lease_token = NULL,
                lease_expires_at = NULL,
                next_attempt_at = now(),
                version = version + 1,
                updated_at = now()
          WHERE state = 'processing'
            AND lease_expires_at <= now()`,
      );

      const leaseToken = randomUUID();
      const claimed = await pool.query<Row>(
        `WITH candidate AS (
           SELECT dispatch.intent_id
             FROM onetime.family_signup_ghl_dispatches AS dispatch
             JOIN onetime.family_signup_outbox AS outbox
               ON outbox.intent_id = dispatch.intent_id
            WHERE outbox.runtime_tier = $1
              AND outbox.verification_environment_id = $2
              AND dispatch.state IN ('pending', 'retry')
              AND dispatch.next_attempt_at <= now()
            ORDER BY dispatch.next_attempt_at, dispatch.created_at, dispatch.intent_id
            FOR UPDATE OF dispatch SKIP LOCKED
            LIMIT 1
         )
         UPDATE onetime.family_signup_ghl_dispatches AS dispatch
            SET state = 'processing',
                lease_token = $3,
                lease_expires_at = now() + ($4::bigint * interval '1 millisecond'),
                attempt_count = dispatch.attempt_count + 1,
                safe_error_code = NULL,
                version = dispatch.version + 1,
                updated_at = now()
           FROM candidate
          WHERE dispatch.intent_id = candidate.intent_id
      RETURNING dispatch.intent_id`,
        [input.runtimeTier, input.verificationEnvironmentId, leaseToken, input.leaseMs],
      );
      const intentId = text(claimed.rows[0]?.intent_id);
      if (!intentId) return null;

      const detail = await pool.query<Row>(
        `SELECT dispatch.intent_id,
                dispatch.lease_token,
                dispatch.current_step,
                dispatch.attempt_count,
                dispatch.provider_contact_id,
                dispatch.provider_opportunity_id,
                outbox.adult_id,
                outbox.household_id,
                outbox.general_marketing_consent,
                outbox.parent_newsletter_consent,
                adult.normalized_email,
                adult.display_name,
                request.household_timezone,
                access.access_state,
                access.free_access_expires_at
           FROM onetime.family_signup_ghl_dispatches AS dispatch
           JOIN onetime.family_signup_outbox AS outbox
             ON outbox.intent_id = dispatch.intent_id
           JOIN onetime.v21_adult_identities AS adult
             ON adult.adult_id = outbox.adult_id
            AND adult.product_key = outbox.product
            AND adult.runtime_tier = outbox.runtime_tier
            AND adult.verification_environment_id = outbox.verification_environment_id
           JOIN onetime.family_signup_requests AS request
             ON request.idempotency_key = outbox.idempotency_key
            AND request.canonical_request_digest = outbox.canonical_request_digest
           JOIN onetime.family_signup_access_projections AS access
             ON access.household_id = outbox.household_id
            AND access.product = outbox.product
            AND access.runtime_tier = outbox.runtime_tier
            AND access.verification_environment_id = outbox.verification_environment_id
          WHERE dispatch.intent_id = $1
            AND dispatch.lease_token = $2
            AND dispatch.state = 'processing'`,
        [intentId, leaseToken],
      );
      if (detail.rows.length !== 1) return null;
      return mapClaim(detail.rows[0]!);
    },

    async completeEffect(input) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const next = nextStep(input.claim.step);
        const receipt = await client.query(
          `INSERT INTO onetime.family_signup_ghl_effect_receipts
             (intent_id, effect_kind, operation_key, provider_resource_ref_hash,
              provider_response_digest)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (intent_id, effect_kind) DO NOTHING`,
          [
            input.claim.intentId,
            input.claim.step,
            input.operationKey,
            digest(input.effect.providerResourceId),
            input.effect.providerResponseDigest,
          ],
        );
        if ((receipt.rowCount ?? 0) !== 1) {
          await client.query('ROLLBACK');
          return false;
        }
        const completed = next === 'complete';
        const updated = await client.query(
          `UPDATE onetime.family_signup_ghl_dispatches
              SET state = $1,
                  current_step = $2,
                  provider_contact_id = CASE
                    WHEN $3 = 'contact_upsert' THEN $4
                    ELSE provider_contact_id
                  END,
                  provider_opportunity_id = CASE
                    WHEN $3 = 'household_opportunity_upsert' THEN $4
                    ELSE provider_opportunity_id
                  END,
                  lease_token = NULL,
                  lease_expires_at = NULL,
                  next_attempt_at = now(),
                  safe_error_code = NULL,
                  version = version + 1,
                  updated_at = now()
            WHERE intent_id = $5
              AND state = 'processing'
              AND current_step = $3
              AND lease_token = $6`,
          [
            completed ? 'complete' : 'pending',
            next,
            input.claim.step,
            input.effect.providerResourceId,
            input.claim.intentId,
            input.claim.leaseToken,
          ],
        );
        if ((updated.rowCount ?? 0) !== 1) {
          await client.query('ROLLBACK');
          return false;
        }
        await client.query('COMMIT');
        return true;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async markRetry(input) {
      return releaseClaim(pool, input.claim, 'retry', input.safeErrorCode, input.retryAt);
    },
    async markIdentityReview(input) {
      return releaseClaim(
        pool,
        input.claim,
        'identity_review',
        input.safeErrorCode,
        new Date().toISOString(),
      );
    },
    async markAcceptanceUnknown(input) {
      return releaseClaim(
        pool,
        input.claim,
        'acceptance_unknown',
        input.safeErrorCode,
        new Date().toISOString(),
      );
    },
  };
}

async function releaseClaim(
  pool: DbPool,
  claim: FamilySignupGhlClaim,
  state: 'retry' | 'identity_review' | 'acceptance_unknown',
  safeErrorCode: string,
  nextAttemptAt: string,
): Promise<boolean> {
  const result = await pool.query(
    `UPDATE onetime.family_signup_ghl_dispatches
        SET state = $1,
            safe_error_code = $2,
            next_attempt_at = $3,
            lease_token = NULL,
            lease_expires_at = NULL,
            version = version + 1,
            updated_at = now()
      WHERE intent_id = $4
        AND state = 'processing'
        AND current_step = $5
        AND lease_token = $6`,
    [state, safeErrorCode, nextAttemptAt, claim.intentId, claim.step, claim.leaseToken],
  );
  return (result.rowCount ?? 0) === 1;
}

function mapClaim(row: Row): FamilySignupGhlClaim {
  const accessState = text(row.access_state);
  if (accessState !== 'free' && accessState !== 'inactive') {
    throw new Error('family_signup_ghl_claim_access_state_invalid');
  }
  const step = text(row.current_step);
  if (!isStep(step)) throw new Error('family_signup_ghl_claim_step_invalid');
  return {
    intentId: required(row.intent_id, 'intent_id'),
    leaseToken: required(row.lease_token, 'lease_token'),
    step,
    attemptCount: Number(row.attempt_count),
    adultId: required(row.adult_id, 'adult_id'),
    householdId: required(row.household_id, 'household_id'),
    normalizedEmail: required(row.normalized_email, 'normalized_email'),
    displayName: required(row.display_name, 'display_name'),
    timezone: required(row.household_timezone, 'household_timezone'),
    accessState,
    freeAccessExpiresAt:
      row.free_access_expires_at instanceof Date
        ? row.free_access_expires_at.toISOString()
        : text(row.free_access_expires_at),
    generalMarketingConsent: row.general_marketing_consent === true,
    parentNewsletterConsent: row.parent_newsletter_consent === true,
    providerContactId: text(row.provider_contact_id),
    providerOpportunityId: text(row.provider_opportunity_id),
  };
}

function nextStep(step: FamilySignupGhlStep): FamilySignupGhlStep | 'complete' {
  if (step === 'contact_upsert') return 'household_opportunity_upsert';
  if (step === 'household_opportunity_upsert') return 'workflow_enrollment';
  return 'complete';
}

function isStep(value: string | null): value is FamilySignupGhlStep {
  return (
    value === 'contact_upsert' ||
    value === 'household_opportunity_upsert' ||
    value === 'workflow_enrollment'
  );
}

function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function required(value: unknown, field: string): string {
  const result = text(value);
  if (!result) throw new Error(`family_signup_ghl_claim_${field}_missing`);
  return result;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}
