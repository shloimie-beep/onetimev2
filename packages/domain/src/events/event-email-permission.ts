import type { AppConfig } from '../../../config/src/index.ts';
import { inTransaction, type DbPool, type Queryable } from '../../../db/src/index.ts';
import { stableKey } from '../lead/normalize.ts';

export const EVENT_SERVICE_EMAIL_SCOPE = 'event_service_email' as const;

export type EventServiceEmailDenialReason =
  | 'complaint'
  | 'hard_bounce'
  | 'global_suppression'
  | 'global_dnd'
  | 'global_unsubscribe'
  | 'event_withdrawal'
  | 'event_cancelled'
  | 'identity_missing'
  | 'identity_archived'
  | 'identity_ambiguous'
  | 'identity_invalid'
  | 'identity_mismatch'
  | 'permission_missing'
  | 'permission_inactive';

export type EventServiceEmailEligibility =
  | {
      allowed: true;
      reason: null;
      permission: {
        disclosureVersion: string;
        grantedAt: Date | string;
      };
    }
  | { allowed: false; reason: EventServiceEmailDenialReason };

type PermissionRow = {
  status: string;
  disclosure_version: string;
  granted_at: Date | string | null;
  contact_key: string | null;
};

type RegistrationRow = {
  contact_key: string | null;
  email_normalized: string;
  registration_status: string;
  identity_status: string;
  cancelled_at: Date | string | null;
};

type ContactRow = {
  contact_key: string;
  email_normalized: string;
  suppression_state: string;
  archived_at: Date | string | null;
  email_dnd: boolean | null;
  all_dnd: boolean | null;
};

export async function evaluateEventServiceEmailEligibility(
  client: Queryable,
  config: Pick<AppConfig, 'accountKey' | 'productKey'>,
  input: { eventCode: string; registrationKey: string; contactKey: string },
): Promise<EventServiceEmailEligibility> {
  const permissionResult = await client.query<PermissionRow>(
    `SELECT status, disclosure_version, granted_at, contact_key
       FROM onetime.event_email_permissions
      WHERE account_key = $1
        AND product_key = $2
        AND event_code = $3
        AND registration_key = $4
        AND contact_key = $5
      LIMIT 1`,
    [
      config.accountKey,
      config.productKey,
      input.eventCode,
      input.registrationKey,
      input.contactKey,
    ],
  );
  const permission = permissionResult.rows[0];

  if (permission?.status === 'complained') {
    return { allowed: false, reason: 'complaint' };
  }
  if (permission?.status === 'hard_bounced') {
    return { allowed: false, reason: 'hard_bounce' };
  }

  const restrictions = await client.query<{ restriction_type: string }>(
    `SELECT restriction_type
       FROM onetime.contact_email_restrictions
      WHERE account_key = $1
        AND product_key = $2
        AND contact_key = $3
        AND active = true`,
    [config.accountKey, config.productKey, input.contactKey],
  );
  const activeRestrictions = new Set(restrictions.rows.map((row) => row.restriction_type));
  if (activeRestrictions.has('complaint')) return { allowed: false, reason: 'complaint' };
  if (activeRestrictions.has('hard_bounce')) return { allowed: false, reason: 'hard_bounce' };

  const contactResult = await client.query<ContactRow>(
    `SELECT contacts.contact_key, contacts.email_normalized, contacts.suppression_state,
            contacts.archived_at, preferences.email_dnd, preferences.all_dnd
       FROM onetime.contacts AS contacts
       LEFT JOIN onetime.highlevel_contact_preferences AS preferences
         ON preferences.account_key = contacts.account_key
        AND preferences.product_key = contacts.product_key
        AND preferences.contact_key = contacts.contact_key
      WHERE contacts.account_key = $1
        AND contacts.product_key = $2
        AND contacts.contact_key = $3
      LIMIT 1`,
    [config.accountKey, config.productKey, input.contactKey],
  );
  const contact = contactResult.rows[0];
  if (activeRestrictions.has('global_suppression') || permission?.status === 'suppressed') {
    return { allowed: false, reason: 'global_suppression' };
  }
  if (contact && contact.suppression_state !== 'active') {
    return { allowed: false, reason: 'global_suppression' };
  }
  if (activeRestrictions.has('global_dnd') || contact?.email_dnd || contact?.all_dnd) {
    return { allowed: false, reason: 'global_dnd' };
  }
  if (activeRestrictions.has('global_unsubscribe') || permission?.status === 'unsubscribed') {
    return { allowed: false, reason: 'global_unsubscribe' };
  }

  const registrationResult = await client.query<RegistrationRow>(
    `SELECT contact_key, email_normalized, registration_status, identity_status, cancelled_at
       FROM onetime.event_registrations
      WHERE account_key = $1
        AND product_key = $2
        AND event_code = $3
        AND registration_key = $4
      LIMIT 1`,
    [config.accountKey, config.productKey, input.eventCode, input.registrationKey],
  );
  const registration = registrationResult.rows[0];
  if (permission?.status === 'withdrawn') {
    return { allowed: false, reason: 'event_withdrawal' };
  }
  if (registration?.registration_status === 'cancelled' || registration?.cancelled_at) {
    return { allowed: false, reason: 'event_cancelled' };
  }

  if (!contact || !registration) return { allowed: false, reason: 'identity_missing' };
  if (contact.archived_at) return { allowed: false, reason: 'identity_archived' };
  if (registration.identity_status === 'ambiguous') {
    return { allowed: false, reason: 'identity_ambiguous' };
  }
  if (registration.identity_status !== 'verified') {
    return { allowed: false, reason: 'identity_invalid' };
  }
  if (
    registration.registration_status !== 'active' ||
    registration.contact_key !== input.contactKey ||
    registration.email_normalized !== contact.email_normalized
  ) {
    return { allowed: false, reason: 'identity_mismatch' };
  }
  if (!permission) return { allowed: false, reason: 'permission_missing' };
  if (permission.contact_key !== input.contactKey) {
    return { allowed: false, reason: 'identity_mismatch' };
  }
  if (permission.status !== 'granted' || !permission.granted_at) {
    return { allowed: false, reason: 'permission_inactive' };
  }
  return {
    allowed: true,
    reason: null,
    permission: {
      disclosureVersion: permission.disclosure_version,
      grantedAt: permission.granted_at,
    },
  };
}

export async function recordContactEmailRestriction(
  pool: DbPool,
  config: Pick<AppConfig, 'accountKey' | 'productKey'>,
  input: {
    contactKey: string;
    restrictionType:
      'global_suppression' | 'global_dnd' | 'global_unsubscribe' | 'complaint' | 'hard_bounce';
    action: 'applied' | 'cleared';
    source: string;
    reasonCode?: string | null;
    idempotencyKey: string;
    recordedAt: Date;
  },
) {
  const restrictionEventKey = stableKey('contact_email_restriction_event', [
    config.accountKey,
    config.productKey,
    input.contactKey,
    input.idempotencyKey,
  ]);
  return inTransaction(pool, async (client) => {
    const inserted = await client.query(
      `INSERT INTO onetime.contact_email_restriction_events
         (restriction_event_key, account_key, product_key, contact_key, restriction_type,
          action, source, reason_code, idempotency_key, recorded_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (account_key, product_key, contact_key, idempotency_key) DO NOTHING
       RETURNING restriction_event_key`,
      [
        restrictionEventKey,
        config.accountKey,
        config.productKey,
        input.contactKey,
        input.restrictionType,
        input.action,
        input.source,
        input.reasonCode ?? null,
        input.idempotencyKey,
        input.recordedAt,
      ],
    );
    const recorded = await client.query<{
      restriction_type: string;
      action: string;
      source: string;
      reason_code: string | null;
      recorded_at: Date | string;
    }>(
      `SELECT restriction_type, action, source, reason_code, recorded_at
         FROM onetime.contact_email_restriction_events
        WHERE restriction_event_key = $1
          AND account_key = $2
          AND product_key = $3
          AND contact_key = $4
        LIMIT 1`,
      [restrictionEventKey, config.accountKey, config.productKey, input.contactKey],
    );
    const event = recorded.rows[0];
    if (
      !event ||
      event.restriction_type !== input.restrictionType ||
      event.action !== input.action ||
      event.source !== input.source ||
      (event.reason_code ?? null) !== (input.reasonCode ?? null) ||
      new Date(event.recorded_at).getTime() !== input.recordedAt.getTime()
    ) {
      throw new Error('CONTACT_EMAIL_RESTRICTION_IDEMPOTENCY_CONFLICT');
    }
    const active = event.action === 'applied';
    await client.query(
      `INSERT INTO onetime.contact_email_restrictions
         (account_key, product_key, contact_key, restriction_type, active, reason_code,
          latest_restriction_event_key, effective_at, applied_at, cleared_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,
         CASE WHEN $5 THEN $8::timestamptz ELSE NULL END,
         CASE WHEN $5 THEN NULL ELSE $8::timestamptz END)
       ON CONFLICT (account_key, product_key, contact_key, restriction_type)
       DO UPDATE SET
         active = EXCLUDED.active,
         reason_code = EXCLUDED.reason_code,
         latest_restriction_event_key = EXCLUDED.latest_restriction_event_key,
         effective_at = EXCLUDED.effective_at,
         applied_at = CASE WHEN EXCLUDED.active THEN EXCLUDED.applied_at
                           ELSE onetime.contact_email_restrictions.applied_at END,
         cleared_at = CASE WHEN EXCLUDED.active THEN NULL ELSE EXCLUDED.cleared_at END,
         updated_at = now()
        WHERE EXCLUDED.effective_at > onetime.contact_email_restrictions.effective_at
           OR (
             EXCLUDED.effective_at = onetime.contact_email_restrictions.effective_at
             AND (
               (EXCLUDED.active AND NOT onetime.contact_email_restrictions.active)
               OR (
                 EXCLUDED.active = onetime.contact_email_restrictions.active
                 AND EXCLUDED.latest_restriction_event_key >
                     onetime.contact_email_restrictions.latest_restriction_event_key
               )
             )
           )`,
      [
        config.accountKey,
        config.productKey,
        input.contactKey,
        event.restriction_type,
        active,
        event.reason_code,
        restrictionEventKey,
        event.recorded_at,
      ],
    );
    return {
      state: inserted.rowCount ? ('recorded' as const) : ('duplicate_reconciled' as const),
      restrictionEventKey,
    };
  });
}
