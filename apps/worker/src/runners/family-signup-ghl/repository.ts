import { createHash, randomUUID } from 'node:crypto';
import { FAMILY_PLAN } from '../../../../../packages/contracts/src/billing/commercial/index.ts';
import type { DbPool } from '../../../../../packages/db/src/index.ts';
import {
  governedCampaignNormalizedEmailHash,
  governedCampaignProviderContactRefHash,
} from '../../../../../packages/domain/src/audience-reconciliation/governed-campaign-census.ts';
import { familySignupGhlHouseholdRefHash } from './provider.ts';
import type {
  FamilySignupGhlAcceptedEffect,
  FamilySignupGhlClaim,
  FamilySignupGhlRepository,
  FamilySignupGhlStep,
} from './types.ts';

type Row = Record<string, unknown>;

export function createPostgresFamilySignupGhlRepository(
  pool: DbPool,
  options: { highLevelLocationId: string },
): FamilySignupGhlRepository {
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
                outbox.product,
                outbox.runtime_tier,
                outbox.verification_environment_id,
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
      validateCompletion(input.claim, input.effect, options.highLevelLocationId);
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
        if (input.claim.step === 'contact_upsert') {
          const projection = input.effect.identityProjection!;
          const identity = await client.query(
            `INSERT INTO onetime.adult_ghl_identity_link
               (adult_id, normalized_email_hash, state, verified_contact_ref_hash,
                candidate_contact_ref_hashes, quarantined_outbox_intent_ids,
                suppression_json, version, product_key, runtime_tier,
                verification_environment_id)
             VALUES ($1,$2,'linked',$3,ARRAY[$3]::text[],'{}'::text[],$4::jsonb,1,$5,$6,$7)
             ON CONFLICT (adult_id) DO UPDATE SET
               state = 'linked',
               verified_contact_ref_hash = EXCLUDED.verified_contact_ref_hash,
               candidate_contact_ref_hashes = EXCLUDED.candidate_contact_ref_hashes,
               quarantined_outbox_intent_ids = EXCLUDED.quarantined_outbox_intent_ids,
               suppression_json = EXCLUDED.suppression_json,
               version = onetime.adult_ghl_identity_link.version + 1,
               updated_at = now()
             WHERE onetime.adult_ghl_identity_link.product_key = EXCLUDED.product_key
               AND onetime.adult_ghl_identity_link.runtime_tier = EXCLUDED.runtime_tier
               AND onetime.adult_ghl_identity_link.verification_environment_id = EXCLUDED.verification_environment_id
               AND onetime.adult_ghl_identity_link.normalized_email_hash = EXCLUDED.normalized_email_hash
               AND onetime.adult_ghl_identity_link.state IN ('unlinked','linked')
               AND (
                 onetime.adult_ghl_identity_link.verified_contact_ref_hash IS NULL
                 OR onetime.adult_ghl_identity_link.verified_contact_ref_hash = EXCLUDED.verified_contact_ref_hash
               )
             RETURNING adult_id`,
            [
              input.claim.adultId,
              projection.normalizedEmailHash,
              projection.providerContactRefHash,
              JSON.stringify({
                marketing_suppressed: projection.marketingSuppressed,
                service_suppressed: projection.serviceSuppressed,
                evidence_digest: projection.suppressionEvidenceDigest,
                version: 1,
              }),
              input.claim.product,
              input.claim.runtimeTier,
              input.claim.verificationEnvironmentId,
            ],
          );
          if ((identity.rowCount ?? 0) !== 1) {
            await client.query('ROLLBACK');
            return false;
          }
        }
        if (input.claim.step === 'household_opportunity_upsert') {
          const projection = input.effect.householdProjection!;
          const mapping = await client.query(
            `INSERT INTO onetime.household_provider_mapping
               (household_id, owner_adult_id, runtime_tier,
                verification_environment_id, billing_program,
                ghl_household_record_ref_hash, projected_owner_contact_ref_hash,
                stripe_customer_ref_hash, service_reminders_enabled,
                lifecycle_state, access_projection, reconciliation_state,
                transfer_target_contact_ref_hash, provider_revision,
                last_readback_digest, version, product_key)
             SELECT $1,$2,$3,$4,$5,$6,$7,NULL,false,$8,$9,'in_sync',NULL,$10::bigint,$11,1,$12
               FROM onetime.adult_ghl_identity_link AS identity
              WHERE identity.adult_id = $2
                AND identity.product_key = $12
                AND identity.runtime_tier = $3
                AND identity.verification_environment_id = $4
                AND identity.state = 'linked'
                AND identity.verified_contact_ref_hash = $7
             ON CONFLICT (runtime_tier, verification_environment_id, household_id, billing_program)
             DO UPDATE SET
               owner_adult_id = EXCLUDED.owner_adult_id,
               ghl_household_record_ref_hash = EXCLUDED.ghl_household_record_ref_hash,
               projected_owner_contact_ref_hash = EXCLUDED.projected_owner_contact_ref_hash,
               lifecycle_state = EXCLUDED.lifecycle_state,
               access_projection = EXCLUDED.access_projection,
               reconciliation_state = 'in_sync',
               provider_revision = GREATEST(
                 onetime.household_provider_mapping.provider_revision,
                 EXCLUDED.provider_revision
               ),
               last_readback_digest = EXCLUDED.last_readback_digest,
               version = onetime.household_provider_mapping.version + 1,
               updated_at = now()
             WHERE onetime.household_provider_mapping.product_key = EXCLUDED.product_key
               AND onetime.household_provider_mapping.owner_adult_id = EXCLUDED.owner_adult_id
               AND (
                 onetime.household_provider_mapping.ghl_household_record_ref_hash IS NULL
                 OR onetime.household_provider_mapping.ghl_household_record_ref_hash = EXCLUDED.ghl_household_record_ref_hash
               )
               AND (
                 onetime.household_provider_mapping.projected_owner_contact_ref_hash IS NULL
                 OR onetime.household_provider_mapping.projected_owner_contact_ref_hash = EXCLUDED.projected_owner_contact_ref_hash
               )
             RETURNING household_id`,
            [
              input.claim.householdId,
              input.claim.adultId,
              input.claim.runtimeTier,
              input.claim.verificationEnvironmentId,
              FAMILY_PLAN.planKey,
              projection.providerHouseholdRefHash,
              projection.providerContactRefHash,
              input.claim.accessState,
              input.claim.accessState,
              projection.providerRevision,
              projection.readbackDigest,
              input.claim.product,
            ],
          );
          if ((mapping.rowCount ?? 0) !== 1) {
            await client.query('ROLLBACK');
            return false;
          }
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
    product: product(row.product),
    runtimeTier: runtimeTier(row.runtime_tier),
    verificationEnvironmentId: verificationEnvironment(row.verification_environment_id),
    providerContactId: text(row.provider_contact_id),
    providerOpportunityId: text(row.provider_opportunity_id),
  };
}

function validateCompletion(
  claim: FamilySignupGhlClaim,
  effect: FamilySignupGhlAcceptedEffect,
  highLevelLocationId: string,
): void {
  if (!effect.providerResourceId.trim() || !isSha256(effect.providerResponseDigest)) {
    throw new Error('family_signup_ghl_completion_invalid');
  }
  if (claim.step === 'contact_upsert') {
    const projection = effect.identityProjection;
    if (
      !projection ||
      effect.householdProjection ||
      projection.normalizedEmailHash !==
        governedCampaignNormalizedEmailHash(claim.normalizedEmail) ||
      projection.providerContactRefHash !==
        governedCampaignProviderContactRefHash(highLevelLocationId, effect.providerResourceId) ||
      !isSha256(projection.suppressionEvidenceDigest)
    ) {
      throw new Error('family_signup_ghl_identity_projection_invalid');
    }
    return;
  }
  if (claim.step === 'household_opportunity_upsert') {
    const projection = effect.householdProjection;
    if (
      !claim.providerContactId ||
      !projection ||
      effect.identityProjection ||
      projection.providerContactRefHash !==
        governedCampaignProviderContactRefHash(highLevelLocationId, claim.providerContactId) ||
      projection.providerHouseholdRefHash !==
        familySignupGhlHouseholdRefHash(highLevelLocationId, effect.providerResourceId) ||
      !Number.isSafeInteger(projection.providerRevision) ||
      projection.providerRevision < 1 ||
      projection.readbackDigest !== effect.providerResponseDigest
    ) {
      throw new Error('family_signup_ghl_household_projection_invalid');
    }
    return;
  }
  if (effect.identityProjection || effect.householdProjection) {
    throw new Error('family_signup_ghl_workflow_projection_invalid');
  }
}

function product(value: unknown): FamilySignupGhlClaim['product'] {
  if (value !== 'one_time_mishnayos') throw new Error('family_signup_ghl_claim_product_invalid');
  return value;
}

function runtimeTier(value: unknown): FamilySignupGhlClaim['runtimeTier'] {
  if (value !== 'isolated_staging' && value !== 'production') {
    throw new Error('family_signup_ghl_claim_runtime_tier_invalid');
  }
  return value;
}

function verificationEnvironment(
  value: unknown,
): FamilySignupGhlClaim['verificationEnvironmentId'] {
  if (
    value !== 'ci' &&
    value !== 'provider_sandbox' &&
    value !== 'persistent_staging' &&
    value !== 'production_read_only' &&
    value !== 'production_operator_canary' &&
    value !== 'production_broad'
  ) {
    throw new Error('family_signup_ghl_claim_verification_environment_invalid');
  }
  return value;
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

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}

function required(value: unknown, field: string): string {
  const result = text(value);
  if (!result) throw new Error(`family_signup_ghl_claim_${field}_missing`);
  return result;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}
