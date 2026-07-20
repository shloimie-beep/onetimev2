import type { Queryable } from '../index.ts';

export type HighLevelParentLinkRecord = {
  accountKey: string;
  productKey: string;
  parentUserKey: string;
  householdKey: string;
  ghlContactId: string;
  ghlOpportunityId?: string | null | undefined;
  syncStatus: 'pending' | 'synced' | 'sync_conflict' | 'error' | 'disabled';
  lastSuccessfulSyncAt?: string | null | undefined;
  lastErrorCode?: string | null | undefined;
};

export type HighLevelEntitlementProjectionRecord = {
  accountKey: string;
  productKey: string;
  householdKey: string;
  ghlContactId?: string | null | undefined;
  ghlSubscriptionId?: string | null | undefined;
  status: 'active' | 'grace' | 'complimentary' | 'inactive';
  reason: string;
  effectiveAt: string;
  graceUntil?: string | null | undefined;
  currentPeriodEnd?: string | null | undefined;
  complimentaryUntil?: string | null | undefined;
  lastBillingEvent?: string | null | undefined;
  lastReconciledAt?: string | null | undefined;
  audit: unknown[];
};

export async function upsertHighLevelParentLink(
  target: Queryable,
  record: HighLevelParentLinkRecord,
) {
  await target.query(
    `INSERT INTO onetime.highlevel_parent_links
     (account_key, product_key, parent_user_key, household_key, ghl_contact_id,
      ghl_opportunity_id, sync_status, last_successful_sync_at, last_error_code)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9)
     ON CONFLICT (account_key, product_key, parent_user_key)
     DO UPDATE SET
       household_key = EXCLUDED.household_key,
       ghl_contact_id = EXCLUDED.ghl_contact_id,
       ghl_opportunity_id = EXCLUDED.ghl_opportunity_id,
       sync_status = EXCLUDED.sync_status,
       last_successful_sync_at = EXCLUDED.last_successful_sync_at,
       last_error_code = EXCLUDED.last_error_code,
       version = onetime.highlevel_parent_links.version + 1,
       updated_at = now()`,
    [
      record.accountKey,
      record.productKey,
      record.parentUserKey,
      record.householdKey,
      record.ghlContactId,
      record.ghlOpportunityId ?? null,
      record.syncStatus,
      record.lastSuccessfulSyncAt ?? null,
      record.lastErrorCode ?? null,
    ],
  );
}

export async function getHighLevelParentLinkByContact(
  target: Queryable,
  input: { accountKey: string; productKey: string; ghlContactId: string },
): Promise<HighLevelParentLinkRecord | null> {
  const result = await target.query(
    `SELECT account_key, product_key, parent_user_key, household_key, ghl_contact_id,
            ghl_opportunity_id, sync_status, last_successful_sync_at, last_error_code
       FROM onetime.highlevel_parent_links
      WHERE account_key = $1 AND product_key = $2 AND ghl_contact_id = $3`,
    [input.accountKey, input.productKey, input.ghlContactId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    accountKey: String(row.account_key),
    productKey: String(row.product_key),
    parentUserKey: String(row.parent_user_key),
    householdKey: String(row.household_key),
    ghlContactId: String(row.ghl_contact_id),
    ghlOpportunityId: row.ghl_opportunity_id ? String(row.ghl_opportunity_id) : null,
    syncStatus: row.sync_status,
    lastSuccessfulSyncAt: row.last_successful_sync_at
      ? new Date(row.last_successful_sync_at).toISOString()
      : null,
    lastErrorCode: row.last_error_code ? String(row.last_error_code) : null,
  };
}

export async function upsertHighLevelEntitlementProjection(
  target: Queryable,
  record: HighLevelEntitlementProjectionRecord,
) {
  await target.query(
    `INSERT INTO onetime.highlevel_entitlement_projection
     (account_key, product_key, household_key, ghl_contact_id, ghl_subscription_id,
      status, reason, effective_at, grace_until, current_period_end, complimentary_until,
      last_billing_event, last_reconciled_at, audit)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9::timestamptz,$10::timestamptz,
             $11::timestamptz,$12,$13::timestamptz,$14::jsonb)
     ON CONFLICT (account_key, product_key, household_key)
     DO UPDATE SET
       ghl_contact_id = EXCLUDED.ghl_contact_id,
       ghl_subscription_id = EXCLUDED.ghl_subscription_id,
       status = EXCLUDED.status,
       reason = EXCLUDED.reason,
       effective_at = EXCLUDED.effective_at,
       grace_until = EXCLUDED.grace_until,
       current_period_end = EXCLUDED.current_period_end,
       complimentary_until = EXCLUDED.complimentary_until,
       last_billing_event = EXCLUDED.last_billing_event,
       last_reconciled_at = EXCLUDED.last_reconciled_at,
       audit = EXCLUDED.audit,
       version = onetime.highlevel_entitlement_projection.version + 1,
       updated_at = now()`,
    [
      record.accountKey,
      record.productKey,
      record.householdKey,
      record.ghlContactId ?? null,
      record.ghlSubscriptionId ?? null,
      record.status,
      record.reason,
      record.effectiveAt,
      record.graceUntil ?? null,
      record.currentPeriodEnd ?? null,
      record.complimentaryUntil ?? null,
      record.lastBillingEvent ?? null,
      record.lastReconciledAt ?? null,
      JSON.stringify(record.audit),
    ],
  );
}

export async function claimHighLevelOutboxBatch(
  target: Queryable,
  input: { accountKey: string; productKey: string; limit: number; now: Date },
) {
  const result = await target.query(
    `UPDATE onetime.highlevel_outbox_events
        SET status = 'in_flight', attempts = attempts + 1, updated_at = now()
      WHERE event_key IN (
        SELECT event_key
          FROM onetime.highlevel_outbox_events
         WHERE account_key = $1
           AND product_key = $2
           AND status IN ('pending', 'retry')
           AND next_attempt_at <= $3::timestamptz
         ORDER BY next_attempt_at, created_at
         LIMIT $4
      )
      RETURNING event_key, event_type, local_object_key, payload_digest, protected_payload,
                attempts, idempotency_key`,
    [input.accountKey, input.productKey, input.now.toISOString(), input.limit],
  );
  return result.rows;
}

export async function markHighLevelOutboxResult(
  target: Queryable,
  input: {
    eventKey: string;
    status: 'succeeded' | 'retry' | 'dead_letter' | 'disabled';
    nextAttemptAt?: string | null | undefined;
    providerResultReferenceHash?: string | null | undefined;
  },
) {
  await target.query(
    `UPDATE onetime.highlevel_outbox_events
        SET status = $2,
            next_attempt_at = COALESCE($3::timestamptz, next_attempt_at),
            provider_result_reference_hash = COALESCE($4, provider_result_reference_hash),
            completed_at = CASE WHEN $2 IN ('succeeded', 'dead_letter', 'disabled') THEN now() ELSE completed_at END,
            updated_at = now()
      WHERE event_key = $1`,
    [
      input.eventKey,
      input.status,
      input.nextAttemptAt ?? null,
      input.providerResultReferenceHash ?? null,
    ],
  );
}
