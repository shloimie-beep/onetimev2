import type {
  Ot03CheckoutAbandonmentIntent,
  Ot03CheckoutCandidate,
} from '../../../domain/src/billing/checkout-abandonment.ts';

type SqlRow = Record<string, unknown>;
type SqlResult<Row extends SqlRow = SqlRow> = { rows: Row[]; rowCount: number | null };

export interface Ot03CheckoutAbandonmentSqlPool {
  query<Row extends SqlRow = SqlRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<SqlResult<Row>>;
}

export interface Ot03CheckoutAbandonmentRepository {
  listDueCandidates(input: {
    accountKey: string;
    productKey: string;
    runtimeTier: 'isolated_staging' | 'production';
    verificationEnvironmentId: string;
    observedAt: string;
    limit: number;
  }): Promise<readonly Ot03CheckoutCandidate[]>;
  insertIntent(input: {
    intent: Ot03CheckoutAbandonmentIntent;
    runtimeTier: 'isolated_staging' | 'production';
    verificationEnvironmentId: string;
  }): Promise<boolean>;
}

export function createPostgresOt03CheckoutAbandonmentRepository(
  pool: Ot03CheckoutAbandonmentSqlPool,
): Ot03CheckoutAbandonmentRepository {
  return {
    async listDueCandidates(input) {
      const selected = await pool.query<{
        checkout_request_key: string;
        account_key: string;
        product_key: string;
        household_key: string;
        adult_id: string;
        checkout_status: 'started' | 'session_created' | 'expired';
        checkout_started_at: string | Date;
        request_fingerprint: string;
      }>(
        `SELECT DISTINCT
                checkout.checkout_request_key,
                checkout.account_key,
                checkout.product_key,
                checkout.principal_key AS household_key,
                adult.adult_id,
                checkout.status AS checkout_status,
                checkout.started_at AS checkout_started_at,
                COALESCE(checkout.request_fingerprint, checkout.checkout_request_key)
                  AS request_fingerprint
           FROM onetime.billing_checkout_sessions AS checkout
           JOIN onetime.portal_households AS household
             ON household.account_key = checkout.account_key
            AND household.product_key = checkout.product_key
            AND household.household_key = checkout.principal_key
            AND household.status = 'active'
           JOIN onetime.portal_guardian_relationships AS guardian
             ON guardian.account_key = checkout.account_key
            AND guardian.product_key = checkout.product_key
            AND guardian.household_key = checkout.principal_key
            AND guardian.authority = 'primary_guardian'
            AND guardian.status = 'active'
           JOIN onetime.account_users AS account_user
             ON account_user.account_key = guardian.account_key
            AND account_user.product_key = guardian.product_key
            AND account_user.user_key = guardian.guardian_user_ref
            AND account_user.role = 'parent'
            AND account_user.status = 'active'
           JOIN onetime.v21_adult_identities AS adult
             ON adult.normalized_email = account_user.email_normalized
            AND adult.product_key = checkout.product_key
            AND adult.runtime_tier = $3
            AND adult.verification_environment_id = $4
            AND adult.state = 'active'
          WHERE checkout.account_key = $1
            AND checkout.product_key = $2
            AND checkout.principal_type = 'opaque'
            AND checkout.status IN ('started', 'session_created', 'expired')
            AND checkout.started_at <= $5::timestamptz - interval '2 hours'
            AND NOT EXISTS (
              SELECT 1
                FROM onetime.billing_checkout_sessions AS newer
               WHERE newer.account_key = checkout.account_key
                 AND newer.product_key = checkout.product_key
                 AND newer.principal_key = checkout.principal_key
                 AND (
                   newer.started_at > checkout.started_at
                   OR (
                     newer.started_at = checkout.started_at
                     AND newer.checkout_request_key > checkout.checkout_request_key
                   )
                 )
            )
            AND NOT EXISTS (
              SELECT 1
                FROM onetime.billing_entitlement_projections AS entitlement
                JOIN onetime.billing_verified_events AS source_event
                  ON source_event.event_key = entitlement.source
                 AND source_event.processing_state = 'completed'
               WHERE entitlement.account_key = checkout.account_key
                 AND entitlement.product_key = checkout.product_key
                 AND entitlement.principal_key = checkout.principal_key
                 AND entitlement.status = 'active'
                 AND entitlement.effective_at >= checkout.started_at
            )
          ORDER BY checkout.started_at, checkout.checkout_request_key
          LIMIT $6`,
        [
          input.accountKey,
          input.productKey,
          input.runtimeTier,
          input.verificationEnvironmentId,
          input.observedAt,
          input.limit,
        ],
      );
      return selected.rows.map((row) => ({
        checkout_request_key: String(row.checkout_request_key),
        account_key: String(row.account_key),
        product_key: String(row.product_key),
        household_key: String(row.household_key),
        adult_id: String(row.adult_id),
        checkout_status: row.checkout_status,
        checkout_started_at: new Date(row.checkout_started_at).toISOString(),
        request_fingerprint: String(row.request_fingerprint),
      }));
    },

    async insertIntent(input) {
      const { intent } = input;
      const inserted = await pool.query(
        `INSERT INTO onetime.billing_checkout_abandonment_intents
           (intent_key, checkout_request_key, account_key, product_key, household_key,
            adult_id, checkpoint, checkpoint_hours, source_event_digest, episode_key,
            checkout_started_at, due_at, observed_at)
         SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
           FROM onetime.billing_checkout_sessions AS checkout
          WHERE checkout.checkout_request_key = $2
            AND checkout.account_key = $3
            AND checkout.product_key = $4
            AND checkout.principal_key = $5
            AND checkout.principal_type = 'opaque'
            AND checkout.status IN ('started', 'session_created', 'expired')
            AND (
              ($8 = 2 AND checkout.started_at <= $13::timestamptz - interval '2 hours')
              OR
              ($8 = 24 AND checkout.started_at <= $13::timestamptz - interval '24 hours')
            )
            AND NOT EXISTS (
              SELECT 1
                FROM onetime.billing_checkout_sessions AS newer
               WHERE newer.account_key = checkout.account_key
                 AND newer.product_key = checkout.product_key
                 AND newer.principal_key = checkout.principal_key
                 AND (
                   newer.started_at > checkout.started_at
                   OR (
                     newer.started_at = checkout.started_at
                     AND newer.checkout_request_key > checkout.checkout_request_key
                   )
                 )
            )
            AND NOT EXISTS (
              SELECT 1
                FROM onetime.billing_entitlement_projections AS entitlement
                JOIN onetime.billing_verified_events AS source_event
                  ON source_event.event_key = entitlement.source
                 AND source_event.processing_state = 'completed'
               WHERE entitlement.account_key = checkout.account_key
                 AND entitlement.product_key = checkout.product_key
                 AND entitlement.principal_key = checkout.principal_key
                 AND entitlement.status = 'active'
                AND entitlement.effective_at >= checkout.started_at
            )
            AND EXISTS (
              SELECT 1
                FROM onetime.portal_households AS household
                JOIN onetime.portal_guardian_relationships AS guardian
                  ON guardian.account_key = household.account_key
                 AND guardian.product_key = household.product_key
                 AND guardian.household_key = household.household_key
                 AND guardian.authority = 'primary_guardian'
                 AND guardian.status = 'active'
                JOIN onetime.account_users AS account_user
                  ON account_user.account_key = guardian.account_key
                 AND account_user.product_key = guardian.product_key
                 AND account_user.user_key = guardian.guardian_user_ref
                 AND account_user.role = 'parent'
                 AND account_user.status = 'active'
                JOIN onetime.v21_adult_identities AS adult
                  ON adult.normalized_email = account_user.email_normalized
                 AND adult.product_key = checkout.product_key
                 AND adult.runtime_tier = $14
                 AND adult.verification_environment_id = $15
                 AND adult.state = 'active'
               WHERE household.account_key = checkout.account_key
                 AND household.product_key = checkout.product_key
                 AND household.household_key = checkout.principal_key
                 AND household.status = 'active'
                 AND adult.adult_id = $6
            )
         ON CONFLICT (checkout_request_key, checkpoint) DO NOTHING
         RETURNING intent_key`,
        [
          intent.intent_key,
          intent.checkout_request_key,
          intent.account_key,
          intent.product_key,
          intent.household_key,
          intent.adult_id,
          intent.checkpoint,
          intent.checkpoint_hours,
          intent.source_event_digest,
          intent.episode_key,
          intent.checkout_started_at,
          intent.due_at,
          intent.observed_at,
          input.runtimeTier,
          input.verificationEnvironmentId,
        ],
      );
      return (inserted.rowCount ?? 0) === 1;
    },
  };
}
