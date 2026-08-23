import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { AppConfig } from '../../../config/src/index.ts';
import {
  assertHighLevelPayloadSafe,
  highLevelInboundActionSchema,
  type HighLevelActionResult,
  type HighLevelInboundAction,
} from '../../../contracts/src/highlevel/index.ts';
import type { DbPool, Queryable } from '../../../db/src/index.ts';
import { inTransaction } from '../../../db/src/index.ts';
import { requestPasswordReset } from '../accounts/lifecycle.ts';
import { AccountAccessError, applyHouseholdAccessStateWithClient } from '../access/service.ts';
import { recordContactEmailRestriction } from '../events/event-email-permission.ts';
import { stableKey } from '../lead/normalize.ts';
import { consumeRateLimitBudgets } from '../security/rate-limit.ts';
import { enqueueHighLevelEvent } from './producer.ts';

export type HighLevelActionHttpResult = { status: number; body: HighLevelActionResult };

export type HighLevelActionSignatureHeaders = {
  keyId?: string;
  timestamp?: string;
  nonce?: string;
  idempotencyKey?: string;
  signature?: string;
};

const memoryNonceTails = new WeakMap<object, Promise<void>>();

type AdultContact = {
  contact_key: string;
  email_normalized: string;
  display_name: string;
  family_school_classification: 'family' | 'school';
  family_or_school: string;
  location_text: string;
  timezone: string;
  reminder_preference: 'email' | 'whatsapp' | 'both' | 'none';
  consent_policy_version: string | null;
  consent_recorded_at: Date | string | null;
  suppression_state: string;
};

type AccessIdentityErrorCode =
  | 'HIGHLEVEL_ACCESS_IDENTITY_NOT_FOUND'
  | 'HIGHLEVEL_ACCESS_IDENTITY_AMBIGUOUS'
  | 'HIGHLEVEL_ACCESS_IDENTITY_MISMATCH';

type HighLevelActionCredentialKind = 'bot' | 'access';

class HighLevelAccessIdentityError extends Error {
  constructor(readonly code: AccessIdentityErrorCode) {
    super(code);
    this.name = 'HighLevelAccessIdentityError';
  }
}

export async function handleHighLevelAction(input: {
  pool: DbPool;
  config: AppConfig;
  headers: HighLevelActionSignatureHeaders;
  rawBody: Buffer;
  now?: Date;
}): Promise<HighLevelActionHttpResult> {
  if (input.config.highLevelActionsMode !== 'enabled') {
    return blocked(503, 'HIGHLEVEL_ACTIONS_OFF', true);
  }
  const requestNow = input.now ?? new Date();
  const credentialKind = authenticatedCredential(
    input.config,
    input.headers,
    input.rawBody,
    requestNow,
  );
  if (!credentialKind) {
    return blocked(401, 'HIGHLEVEL_ACTION_AUTH_FAILED', false);
  }

  let action: HighLevelInboundAction;
  try {
    const rawAction: unknown = JSON.parse(input.rawBody.toString('utf8'));
    assertHighLevelPayloadSafe(rawAction);
    action = highLevelInboundActionSchema.parse(rawAction);
  } catch {
    return blocked(400, 'HIGHLEVEL_CONTACT_INELIGIBLE', false);
  }
  if (!credentialAllowsAction(credentialKind, action.action_name)) {
    return blocked(401, 'HIGHLEVEL_ACTION_AUTH_FAILED', false);
  }
  if (action.idempotency_key !== input.headers.idempotencyKey) {
    return blocked(401, 'HIGHLEVEL_ACTION_AUTH_FAILED', false);
  }
  if (
    action.scope.account_key !== input.config.accountKey ||
    action.scope.product_key !== input.config.productKey ||
    action.scope.location_id !== input.config.highLevelLocationId
  ) {
    return blocked(403, 'HIGHLEVEL_SCOPE_MISMATCH', false);
  }

  const nonceAccepted = await consumeSignedNonce(
    input.pool,
    input.config,
    input.headers,
    input.rawBody,
    requestNow,
  );
  if (!nonceAccepted) return blocked(409, 'HIGHLEVEL_ACTION_REPLAYED', false);

  const requestHash = digest(action);
  const existing = await loadReceipt(input.pool, input.config, action.idempotency_key);
  if (existing) {
    const replayed = replay(existing, requestHash, requestNow);
    if (replayed) return replayed;
  }

  const rateLimit = await consumeRateLimitBudgets({
    pool: input.pool,
    config: input.config,
    now: requestNow,
    budgets: [
      {
        scope: 'highlevel_bot_action_contact',
        subject: `${action.action_name}:${action.adult_contact.contact_key}`,
        limit: input.config.highLevelActionRateLimitMax,
        windowMs: input.config.highLevelActionRateLimitWindowMs,
      },
    ],
  });
  if (!rateLimit.allowed) return blocked(429, 'HIGHLEVEL_ACTION_RATE_LIMITED', true);

  const contact = await loadAdultContact(
    input.pool,
    input.config,
    action.adult_contact.contact_key,
  );
  if (!contact) return blocked(404, 'HIGHLEVEL_ADULT_CONTACT_NOT_FOUND', false);
  if (
    action.action_name !== 'bot.apply_opt_out' &&
    action.action_name !== 'access.apply_current_state' &&
    (contact.suppression_state !== 'active' || !contact.consent_recorded_at)
  ) {
    return blocked(409, 'HIGHLEVEL_CONTACT_INELIGIBLE', false);
  }

  const claimed = await claimReceipt(input.pool, input.config, action, requestHash, input.now);
  if (!claimed) {
    const raced = await loadReceipt(input.pool, input.config, action.idempotency_key);
    return raced
      ? (replay(raced, requestHash, requestNow) ??
          blocked(503, 'HIGHLEVEL_DEPENDENCY_UNAVAILABLE', true))
      : blocked(503, 'HIGHLEVEL_DEPENDENCY_UNAVAILABLE', true);
  }

  try {
    const body = await executeAction({ ...input, action, contact });
    await completeReceipt(input.pool, input.config, action, body, input.now);
    return { status: 200, body };
  } catch (error) {
    const accessFailure = accessActionFailure(error);
    if (action.action_name === 'access.apply_current_state' && accessFailure) {
      await completeBlockedReceipt(input.pool, input.config, action, accessFailure.body, input.now);
      return accessFailure;
    }
    await rejectReceipt(input.pool, input.config, action.idempotency_key, input.now);
    return blocked(503, 'HIGHLEVEL_DEPENDENCY_UNAVAILABLE', true);
  }
}

async function executeAction(input: {
  pool: DbPool;
  config: AppConfig;
  action: HighLevelInboundAction;
  contact: AdultContact;
  now?: Date;
}): Promise<Extract<HighLevelActionResult, { ok: true }>> {
  const { action, contact } = input;
  if (action.action_name === 'access.apply_current_state') {
    const applied = await inTransaction(input.pool, async (db) => {
      await proveExactParentHouseholdIdentity(
        db,
        input.config,
        contact.contact_key,
        action.data.household_key,
      );
      await claimHighLevelBillingEpisodeAuthority(db, input.config, action);
      return applyHouseholdAccessStateWithClient({
        db,
        accountKey: input.config.accountKey,
        productKey: input.config.productKey,
        sourceKind: 'highlevel_payment_state',
        actorKind: 'highlevel_action',
        idempotencyKey: action.idempotency_key,
        command: {
          household_key: action.data.household_key,
          state: action.data.state,
          effective_at: action.data.effective_at,
          expires_at: action.data.expires_at,
          opaque_source_reference: action.data.opaque_source_reference,
          source_revision: action.data.source_revision,
          source_updated_at: action.data.source_updated_at,
          policy_version: action.data.policy_version,
          revocation_reason: action.data.revocation_reason,
        },
        ...(input.now ? { now: input.now } : {}),
      });
    });
    return success(action, null, {
      access_state: applied.projection.state,
      application_state: applied.state,
      sessions_revoked: applied.sessions_revoked,
      payment_history_written: false,
    });
  }
  if (action.action_name === 'bot.complete_signup') {
    if (!action.data.details_complete) throw new Error('DETAILS_INCOMPLETE');
    await completeAdultSignup(input.pool, input.config, action, contact, input.now ?? new Date());
    return success(action, '/signup', { signup_completed: true });
  }
  if (action.action_name === 'bot.next_confirmed_class_info') {
    const next = await nextConfirmedClass(
      input.pool,
      input.config,
      contact.contact_key,
      input.now ?? new Date(),
    );
    return success(action, '/app/parent', {
      confirmed_update_available: Boolean(next),
      next_class_at: next?.starts_at ?? null,
      timezone: next?.timezone ?? null,
      join_available: Boolean(next?.join_available),
    });
  }
  if (action.action_name === 'bot.member_login') {
    return success(action, '/login', { account_active_claimed: false });
  }
  if (action.action_name === 'bot.password_help') {
    if (await isAdultAccount(input.pool, input.config, contact.email_normalized)) {
      await requestPasswordReset({
        pool: input.pool,
        config: input.config,
        payload: {
          idempotency_key: stableKey('highlevel_password_help', [action.idempotency_key]),
          email: contact.email_normalized,
        },
        ...(input.now ? { now: input.now } : {}),
      });
    }
    return success(action, '/forgot-password', {
      request_accepted: true,
      account_existence_disclosed: false,
      token_returned_to_highlevel: false,
    });
  }
  if (action.action_name !== 'bot.apply_opt_out') {
    throw new Error('HIGHLEVEL_ACTION_UNSUPPORTED');
  }
  await applyOptOut(input.pool, input.config, action, input.now ?? new Date());
  return success(action, null, {
    suppression_applied: true,
    acknowledgement_authorized: false,
  });
}

async function proveExactParentHouseholdIdentity(
  db: Queryable,
  config: AppConfig,
  contactKey: string,
  requestedHouseholdKey: string,
) {
  const result = await db.query(
    `SELECT links.household_key, links.highlevel_location_id
       FROM onetime.adult_household_contact_links AS links
       JOIN onetime.contacts AS contacts
         ON contacts.account_key = links.account_key
        AND contacts.product_key = links.product_key
        AND contacts.contact_key = links.contact_key
       JOIN onetime.portal_households AS households
         ON households.account_key = links.account_key
        AND households.product_key = links.product_key
        AND households.household_key = links.household_key
        AND households.status = 'active'
      WHERE links.account_key = $1
        AND links.product_key = $2
        AND links.contact_key = $3
        AND contacts.archived_at IS NULL
      ORDER BY links.household_key
      FOR UPDATE`,
    [config.accountKey, config.productKey, contactKey],
  );
  if (result.rows.length === 0) {
    throw new HighLevelAccessIdentityError('HIGHLEVEL_ACCESS_IDENTITY_NOT_FOUND');
  }
  if (result.rows.length !== 1) {
    throw new HighLevelAccessIdentityError('HIGHLEVEL_ACCESS_IDENTITY_AMBIGUOUS');
  }
  if (String(result.rows[0]?.household_key ?? '') !== requestedHouseholdKey) {
    throw new HighLevelAccessIdentityError('HIGHLEVEL_ACCESS_IDENTITY_MISMATCH');
  }
  if (String(result.rows[0]?.highlevel_location_id ?? '') !== config.highLevelLocationId) {
    throw new HighLevelAccessIdentityError('HIGHLEVEL_ACCESS_IDENTITY_MISMATCH');
  }
}

async function claimHighLevelBillingEpisodeAuthority(
  db: Queryable,
  config: AppConfig,
  action: Extract<HighLevelInboundAction, { action_name: 'access.apply_current_state' }>,
) {
  const authorityKey = stableKey('billing_access_episode_authority', [
    config.accountKey,
    config.productKey,
    action.data.household_key,
    action.data.billing_episode,
  ]);
  await db.query(
    `INSERT INTO onetime.billing_access_episode_authority
       (authority_key, account_key, product_key, household_key, billing_episode,
        source_kind, first_event_id, latest_event_id,
        provider_customer_ref_hash, provider_subscription_ref_hash)
     VALUES ($1,$2,$3,$4,$5,'highlevel_signed_event',$6,$6,$7,$8)
     ON CONFLICT (account_key, product_key, household_key, billing_episode) DO NOTHING`,
    [
      authorityKey,
      config.accountKey,
      config.productKey,
      action.data.household_key,
      action.data.billing_episode,
      action.data.event_id,
      action.data.provider_customer_ref_hash,
      action.data.provider_subscription_ref_hash,
    ],
  );
  const authority = await db.query(
    `UPDATE onetime.billing_access_episode_authority
        SET latest_event_id = $1,
            provider_customer_ref_hash = COALESCE(provider_customer_ref_hash, $2),
            provider_subscription_ref_hash = COALESCE(provider_subscription_ref_hash, $3),
            updated_at = now()
      WHERE account_key = $4
        AND product_key = $5
        AND household_key = $6
        AND billing_episode = $7
        AND source_kind = 'highlevel_signed_event'
        AND (
          provider_customer_ref_hash IS NULL
          OR $2::text IS NULL
          OR provider_customer_ref_hash = $2
        )
        AND (
          provider_subscription_ref_hash IS NULL
          OR $3::text IS NULL
          OR provider_subscription_ref_hash = $3
        )
      RETURNING authority_key`,
    [
      action.data.event_id,
      action.data.provider_customer_ref_hash,
      action.data.provider_subscription_ref_hash,
      config.accountKey,
      config.productKey,
      action.data.household_key,
      action.data.billing_episode,
    ],
  );
  if ((authority.rowCount ?? 0) !== 1) {
    throw new AccountAccessError(
      'ACCESS_SOURCE_PRECEDENCE',
      'This billing episode already has a different authoritative ingestion source or identity.',
    );
  }

  const eventDigest = digest(action.data);
  const eventKey = stableKey('billing_access_episode_event', [action.data.event_id]);
  const inserted = await db.query(
    `INSERT INTO onetime.billing_access_episode_events
       (event_key, event_id, authority_key, account_key, product_key, household_key,
        billing_episode, idempotency_key, verified_state, effective_at, event_digest,
        source_revision, source_updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT DO NOTHING
     RETURNING event_key`,
    [
      eventKey,
      action.data.event_id,
      authorityKey,
      config.accountKey,
      config.productKey,
      action.data.household_key,
      action.data.billing_episode,
      action.idempotency_key,
      action.data.verified_state,
      action.data.effective_at,
      eventDigest,
      action.data.source_revision,
      action.data.source_updated_at,
    ],
  );
  if ((inserted.rowCount ?? 0) === 1) return;
  const existing = await db.query(
    `SELECT event_digest, authority_key
       FROM onetime.billing_access_episode_events
      WHERE event_id = $1`,
    [action.data.event_id],
  );
  if (
    existing.rows.length !== 1 ||
    String(existing.rows[0]?.event_digest ?? '') !== eventDigest ||
    String(existing.rows[0]?.authority_key ?? '') !== authorityKey
  ) {
    throw new AccountAccessError(
      'ACCESS_SOURCE_CONFLICT',
      'The verified billing event identifier conflicts with previously accepted evidence.',
    );
  }
}

async function completeAdultSignup(
  pool: DbPool,
  config: AppConfig,
  action: HighLevelInboundAction,
  contact: AdultContact,
  now: Date,
) {
  await inTransaction(pool, async (client) => {
    const signupKey = stableKey('signup', [
      contact.contact_key,
      'free-until-rosh-hashanah-2026',
      'landing-v1-2026-07-14',
    ]);
    await client.query(
      `INSERT INTO onetime.signup_leads
         (signup_key, contact_key, account_key, product_key, offer_version, content_version,
          classification, status, metadata, created_at)
       VALUES ($1, $2, $3, $4, 'free-until-rosh-hashanah-2026', 'landing-v1-2026-07-14',
               $5, 'new', $6::jsonb, $7)
       ON CONFLICT (contact_key, offer_version, content_version) DO NOTHING`,
      [
        signupKey,
        contact.contact_key,
        config.accountKey,
        config.productKey,
        contact.family_school_classification,
        JSON.stringify({ source: 'highlevel_bot_action', private_destination_recorded: false }),
        now,
      ],
    );
    await enqueueHighLevelEvent(client, config, {
      eventName: 'adult.signup.submitted',
      contactKey: contact.contact_key,
      idempotencyKey: stableKey('adult_signup_submitted', [signupKey]),
      actor: { kind: 'system', reference: 'OT-A1' },
      occurredAt: now,
      protectedPath: '/signup',
      data: { signup_key: signupKey, classification: contact.family_school_classification },
    });
  });
}

async function nextConfirmedClass(pool: DbPool, config: AppConfig, contactKey: string, now: Date) {
  const result = await pool.query(
    `SELECT occurrences.starts_at, series.timezone,
            occurrences.starts_at <= now() + interval '15 minutes' AS join_available
       FROM onetime.contacts AS contacts
       JOIN onetime.account_users AS users
         ON users.account_key = contacts.account_key
        AND users.product_key = contacts.product_key
        AND users.email_normalized = contacts.email_normalized
        AND users.role IN ('owner', 'admin', 'parent')
        AND users.status = 'active'
       JOIN onetime.portal_guardian_relationships AS guardians
         ON guardians.account_key = users.account_key
        AND guardians.product_key = users.product_key
        AND guardians.guardian_user_ref = users.user_key
        AND guardians.status = 'active'
        AND guardians.authority IN ('primary_guardian', 'guardian')
       JOIN onetime.portal_households AS households
         ON households.account_key = guardians.account_key
        AND households.product_key = guardians.product_key
        AND households.household_key = guardians.household_key
        AND households.status = 'active'
       JOIN onetime.account_access_projections AS access
         ON access.account_key = guardians.account_key
        AND access.product_key = guardians.product_key
        AND access.household_key = guardians.household_key
        AND access.state IN ('active', 'grace', 'scheduled_end')
        AND access.effective_at <= $4
        AND (access.expires_at IS NULL OR access.expires_at > $4)
       JOIN onetime.class_occurrences AS occurrences
         ON occurrences.account_key = contacts.account_key
        AND occurrences.product_key = contacts.product_key
        AND occurrences.occurrence_state = 'scheduled'
        AND occurrences.starts_at > now()
       JOIN onetime.class_series AS series
         ON series.account_key = occurrences.account_key
        AND series.product_key = occurrences.product_key
        AND series.class_series_key = occurrences.class_series_key
      WHERE contacts.account_key = $1
        AND contacts.product_key = $2
        AND contacts.contact_key = $3
      ORDER BY occurrences.starts_at
      LIMIT 1`,
    [config.accountKey, config.productKey, contactKey, now],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row
    ? {
        starts_at: new Date(String(row.starts_at)).toISOString(),
        timezone: String(row.timezone),
        join_available: row.join_available === true,
      }
    : null;
}

async function applyOptOut(
  pool: DbPool,
  config: AppConfig,
  action: HighLevelInboundAction,
  now: Date,
) {
  const channel = 'channel' in action.data ? (action.data.channel ?? 'all') : 'all';
  const emailRestriction =
    'email_restriction' in action.data
      ? (action.data.email_restriction ?? 'global_unsubscribe')
      : 'global_unsubscribe';
  if (
    channel === 'whatsapp' &&
    'email_restriction' in action.data &&
    action.data.email_restriction
  ) {
    throw new Error('EMAIL_RESTRICTION_REQUIRES_EMAIL_CHANNEL');
  }
  await inTransaction(pool, async (client) => {
    if (channel === 'email' || channel === 'all') {
      await client.query(
        `UPDATE onetime.contacts
            SET suppression_state = 'suppressed', updated_at = $4
          WHERE account_key = $1 AND product_key = $2 AND contact_key = $3`,
        [config.accountKey, config.productKey, action.adult_contact.contact_key, now],
      );
    }
    await client.query(
      `INSERT INTO onetime.highlevel_contact_preferences
         (account_key, product_key, contact_key, email_dnd, whatsapp_dnd, all_dnd,
          source_action_key, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (account_key, product_key, contact_key)
       DO UPDATE SET
         email_dnd = onetime.highlevel_contact_preferences.email_dnd OR EXCLUDED.email_dnd,
         whatsapp_dnd = onetime.highlevel_contact_preferences.whatsapp_dnd OR EXCLUDED.whatsapp_dnd,
         all_dnd = onetime.highlevel_contact_preferences.all_dnd OR EXCLUDED.all_dnd,
         source_action_key = EXCLUDED.source_action_key,
         updated_at = EXCLUDED.updated_at`,
      [
        config.accountKey,
        config.productKey,
        action.adult_contact.contact_key,
        channel === 'email' || channel === 'all',
        channel === 'whatsapp' || channel === 'all',
        channel === 'all',
        action.idempotency_key,
        now,
      ],
    );
    await client.query(
      `INSERT INTO onetime.audit_events
         (event_key, account_key, product_key, contact_key, event_type, metadata, created_at)
       VALUES ($1, $2, $3, $4, 'highlevel_opt_out_applied', $5::jsonb, $6)
       ON CONFLICT (event_key) DO NOTHING`,
      [
        stableKey('audit_highlevel_opt_out', [action.idempotency_key]),
        config.accountKey,
        config.productKey,
        action.adult_contact.contact_key,
        JSON.stringify({ channel, acknowledgement_authorized: false }),
        now,
      ],
    );
  });
  if (channel === 'email' || channel === 'all') {
    await recordContactEmailRestriction(pool, config, {
      contactKey: action.adult_contact.contact_key,
      restrictionType: emailRestriction,
      action: 'applied',
      source: 'highlevel_bot_opt_out',
      reasonCode: 'explicit_opt_out',
      idempotencyKey: `${action.idempotency_key}:event-service-email`,
      recordedAt: now,
    });
  }
}

async function loadAdultContact(pool: DbPool, config: AppConfig, contactKey: string) {
  const result = await pool.query(
    `SELECT contact_key, email_normalized, display_name, family_school_classification,
            family_or_school, location_text, timezone, reminder_preference,
            consent_policy_version, consent_recorded_at, suppression_state
       FROM onetime.contacts
      WHERE account_key = $1 AND product_key = $2 AND contact_key = $3
        AND archived_at IS NULL
        AND family_school_classification IN ('family', 'school')
      LIMIT 1`,
    [config.accountKey, config.productKey, contactKey],
  );
  return (result.rows[0] as AdultContact | undefined) ?? null;
}

async function isAdultAccount(pool: DbPool, config: AppConfig, email: string) {
  const result = await pool.query(
    `SELECT 1 FROM onetime.account_users
      WHERE account_key = $1 AND product_key = $2 AND email_normalized = $3
        AND role IN ('owner', 'admin', 'parent') AND status = 'active'
      LIMIT 1`,
    [config.accountKey, config.productKey, email],
  );
  return Boolean(result.rowCount);
}

export function signHighLevelActionRequest(input: {
  secret: string;
  keyId: string;
  timestamp: string;
  nonce: string;
  idempotencyKey: string;
  rawBody: Buffer;
}) {
  return `v1=${createHmac('sha256', input.secret)
    .update(highLevelActionCanonicalRequest(input))
    .digest('hex')}`;
}

function authenticatedCredential(
  config: AppConfig,
  headers: HighLevelActionSignatureHeaders,
  rawBody: Buffer,
  now: Date,
): HighLevelActionCredentialKind | null {
  if (
    !headers.keyId ||
    !headers.timestamp ||
    !headers.nonce ||
    !headers.idempotencyKey ||
    !headers.signature ||
    !/^\d{10}$/.test(headers.timestamp) ||
    !/^[A-Za-z0-9_-]{16,160}$/.test(headers.nonce) ||
    !/^[A-Za-z0-9._:-]{8,160}$/.test(headers.idempotencyKey)
  ) {
    return null;
  }
  const credential = resolveActionCredential(config, headers.keyId);
  if (!credential) return null;
  const timestampMs = Number(headers.timestamp) * 1000;
  if (
    !Number.isSafeInteger(timestampMs) ||
    Math.abs(now.getTime() - timestampMs) > config.highLevelActionSignatureToleranceMs
  ) {
    return null;
  }
  const expected = signHighLevelActionRequest({
    secret: credential.secret,
    keyId: headers.keyId,
    timestamp: headers.timestamp,
    nonce: headers.nonce,
    idempotencyKey: headers.idempotencyKey,
    rawBody,
  });
  return secureEqual(headers.signature, expected) ? credential.kind : null;
}

function resolveActionCredential(
  config: AppConfig,
  keyId: string,
): { kind: HighLevelActionCredentialKind; secret: string } | null {
  if (config.highLevelActionSecret && secureEqual(keyId, config.highLevelActionKeyId)) {
    return { kind: 'bot', secret: config.highLevelActionSecret };
  }
  if (config.highLevelAccessActionSecret && secureEqual(keyId, config.highLevelAccessActionKeyId)) {
    return { kind: 'access', secret: config.highLevelAccessActionSecret };
  }
  return null;
}

function credentialAllowsAction(
  credentialKind: HighLevelActionCredentialKind,
  actionName: HighLevelInboundAction['action_name'],
) {
  return actionName === 'access.apply_current_state'
    ? credentialKind === 'access'
    : credentialKind === 'bot';
}

function secureEqual(left?: string, right?: string) {
  if (!left || !right) return false;
  const leftDigest = createHash('sha256').update(left).digest();
  const rightDigest = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function highLevelActionCanonicalRequest(input: {
  keyId: string;
  timestamp: string;
  nonce: string;
  idempotencyKey: string;
  rawBody: Buffer;
}) {
  return Buffer.concat([
    Buffer.from(
      ['highlevel-action-v1', input.keyId, input.timestamp, input.nonce, input.idempotencyKey].join(
        '\n',
      ) + '\n',
      'utf8',
    ),
    input.rawBody,
  ]);
}

async function consumeSignedNonce(
  pool: DbPool,
  config: AppConfig,
  headers: HighLevelActionSignatureHeaders,
  rawBody: Buffer,
  now: Date,
) {
  const keyId = headers.keyId;
  const nonce = headers.nonce;
  const idempotencyKey = headers.idempotencyKey;
  if (!keyId || !nonce || !idempotencyKey) return false;
  const expiresAt = new Date(now.getTime() + config.highLevelActionSignatureToleranceMs);
  if (isMemoryPool(pool)) {
    return withMemoryNonceLock(pool, async () => {
      const existing = await pool.query(
        `SELECT 1 FROM onetime.highlevel_action_nonces WHERE key_id = $1 AND nonce = $2`,
        [keyId, nonce],
      );
      if (existing.rows.length > 0) return false;
      await insertNonce(pool, config, { keyId, nonce, idempotencyKey }, rawBody, expiresAt, now);
      return true;
    });
  }
  const result = await insertNonce(
    pool,
    config,
    { keyId, nonce, idempotencyKey },
    rawBody,
    expiresAt,
    now,
  );
  return result.rows.length === 1;
}

function insertNonce(
  pool: DbPool,
  config: AppConfig,
  headers: { keyId: string; nonce: string; idempotencyKey: string },
  rawBody: Buffer,
  expiresAt: Date,
  now: Date,
) {
  return pool.query(
    `INSERT INTO onetime.highlevel_action_nonces
       (key_id, nonce, account_key, product_key, idempotency_key, request_hash,
        expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (key_id, nonce) DO NOTHING
     RETURNING nonce`,
    [
      headers.keyId,
      headers.nonce,
      config.accountKey,
      config.productKey,
      headers.idempotencyKey,
      createHash('sha256').update(rawBody).digest('hex'),
      expiresAt,
      now,
    ],
  );
}

async function withMemoryNonceLock<T>(pool: DbPool, run: () => Promise<T>) {
  const key = pool as object;
  const previous = memoryNonceTails.get(key) ?? Promise.resolve();
  let release: () => void = () => {};
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  memoryNonceTails.set(
    key,
    previous.then(() => current),
  );
  await previous;
  try {
    return await run();
  } finally {
    release();
  }
}

function isMemoryPool(pool: DbPool) {
  return Boolean((pool as DbPool & { __memory?: boolean }).__memory);
}

function digest(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function success(
  action: HighLevelInboundAction,
  path: '/signup' | '/app/parent' | '/login' | '/forgot-password' | null,
  result: Record<string, string | number | boolean | null>,
): Extract<HighLevelActionResult, { ok: true }> {
  return {
    ok: true,
    action_name: action.action_name,
    replayed: false,
    protected_reference: path ? { kind: 'one_time_path', path } : null,
    result,
  };
}

function blocked(
  status: number,
  code: Extract<HighLevelActionResult, { ok: false }>['code'],
  retryable: boolean,
): HighLevelActionHttpResult {
  return { status, body: { ok: false, code, retryable } };
}

type ReceiptRow = {
  request_hash: string;
  response_json: unknown;
  status: string;
  lease_expires_at: Date | string | null;
};

async function loadReceipt(pool: DbPool, config: AppConfig, idempotencyKey: string) {
  const result = await pool.query(
    `SELECT request_hash, response_json, status, lease_expires_at
       FROM onetime.highlevel_action_receipts
      WHERE account_key = $1 AND product_key = $2 AND idempotency_key = $3`,
    [config.accountKey, config.productKey, idempotencyKey],
  );
  return (result.rows[0] as ReceiptRow | undefined) ?? null;
}

function replay(
  receipt: ReceiptRow,
  requestHash: string,
  now: Date,
): HighLevelActionHttpResult | null {
  if (receipt.request_hash !== requestHash) {
    return blocked(409, 'HIGHLEVEL_IDEMPOTENCY_CONFLICT', false);
  }
  if (receipt.status !== 'succeeded') {
    if (receipt.lease_expires_at && new Date(receipt.lease_expires_at).getTime() <= now.getTime()) {
      return null;
    }
    return blocked(503, 'HIGHLEVEL_DEPENDENCY_UNAVAILABLE', true);
  }
  const body = receipt.response_json as HighLevelActionResult;
  if (!body.ok) return blocked(accessBlockerStatus(body.code), body.code, body.retryable);
  return { status: 200, body: { ...body, replayed: true } };
}

function accessActionFailure(error: unknown): {
  status: number;
  body: Extract<HighLevelActionResult, { ok: false }>;
} | null {
  if (error instanceof HighLevelAccessIdentityError) {
    return accessBlocked(accessBlockerStatus(error.code), error.code);
  }
  if (!(error instanceof AccountAccessError)) return null;
  if (error.code === 'ACCESS_SOURCE_STALE') {
    return accessBlocked(409, 'HIGHLEVEL_ACCESS_STATE_STALE');
  }
  if (
    ['ACCESS_IDEMPOTENCY_CONFLICT', 'ACCESS_SOURCE_CONFLICT', 'ACCESS_INVALID_COMMAND'].includes(
      error.code,
    )
  ) {
    return accessBlocked(409, 'HIGHLEVEL_ACCESS_STATE_CONFLICT');
  }
  if (error.code === 'ACCESS_SOURCE_PRECEDENCE') {
    return accessBlocked(409, 'HIGHLEVEL_ACCESS_SOURCE_PRECEDENCE');
  }
  if (error.code === 'ACCESS_HOUSEHOLD_NOT_FOUND') {
    return accessBlocked(404, 'HIGHLEVEL_ACCESS_IDENTITY_NOT_FOUND');
  }
  return null;
}

function accessBlocked(
  status: number,
  code:
    | AccessIdentityErrorCode
    | 'HIGHLEVEL_ACCESS_STATE_STALE'
    | 'HIGHLEVEL_ACCESS_STATE_CONFLICT'
    | 'HIGHLEVEL_ACCESS_SOURCE_PRECEDENCE',
) {
  return {
    status,
    body: { ok: false as const, code, retryable: false },
  };
}

function accessBlockerStatus(code: Extract<HighLevelActionResult, { ok: false }>['code']) {
  if (code === 'HIGHLEVEL_ACCESS_IDENTITY_NOT_FOUND') return 404;
  if (
    code === 'HIGHLEVEL_ACCESS_IDENTITY_AMBIGUOUS' ||
    code === 'HIGHLEVEL_ACCESS_IDENTITY_MISMATCH' ||
    code === 'HIGHLEVEL_ACCESS_STATE_STALE' ||
    code === 'HIGHLEVEL_ACCESS_STATE_CONFLICT' ||
    code === 'HIGHLEVEL_ACCESS_SOURCE_PRECEDENCE'
  ) {
    return 409;
  }
  return 503;
}

async function claimReceipt(
  pool: DbPool,
  config: AppConfig,
  action: HighLevelInboundAction,
  requestHash: string,
  now = new Date(),
) {
  const leaseExpiresAt = new Date(now.getTime() + 60_000);
  const result = await pool.query(
    `INSERT INTO onetime.highlevel_action_receipts
       (receipt_key, account_key, product_key, action_name, contact_key, idempotency_key,
        request_hash, response_json, status, lease_expires_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, '{}'::jsonb, 'processing', $9, $8, $8)
     ON CONFLICT (account_key, product_key, idempotency_key)
     DO UPDATE SET status = 'processing', lease_expires_at = EXCLUDED.lease_expires_at,
                   updated_at = EXCLUDED.updated_at
       WHERE onetime.highlevel_action_receipts.request_hash = EXCLUDED.request_hash
         AND onetime.highlevel_action_receipts.status IN ('processing', 'rejected')
         AND onetime.highlevel_action_receipts.lease_expires_at <= EXCLUDED.updated_at
     RETURNING receipt_key`,
    [
      stableKey('highlevel_action_receipt', [action.idempotency_key]),
      config.accountKey,
      config.productKey,
      action.action_name,
      action.adult_contact.contact_key,
      action.idempotency_key,
      requestHash,
      now,
      leaseExpiresAt,
    ],
  );
  return Boolean(result.rowCount);
}

async function completeReceipt(
  pool: DbPool,
  config: AppConfig,
  action: HighLevelInboundAction,
  body: Extract<HighLevelActionResult, { ok: true }>,
  now = new Date(),
) {
  assertHighLevelPayloadSafe(body);
  await pool.query(
    `UPDATE onetime.highlevel_action_receipts
        SET status = 'succeeded', response_json = $4::jsonb, lease_expires_at = NULL,
            updated_at = $5
      WHERE account_key = $1 AND product_key = $2 AND idempotency_key = $3`,
    [config.accountKey, config.productKey, action.idempotency_key, JSON.stringify(body), now],
  );
  await pool.query(
    `INSERT INTO onetime.audit_events
       (event_key, account_key, product_key, contact_key, event_type, metadata, created_at)
     VALUES ($1, $2, $3, $4, 'highlevel_action_succeeded', $5::jsonb, $6)
     ON CONFLICT (event_key) DO NOTHING`,
    [
      stableKey('audit_highlevel_action', [action.idempotency_key]),
      config.accountKey,
      config.productKey,
      action.adult_contact.contact_key,
      JSON.stringify({ action_name: action.action_name, private_payload_recorded: false }),
      now,
    ],
  );
}

async function completeBlockedReceipt(
  pool: DbPool,
  config: AppConfig,
  action: HighLevelInboundAction,
  body: Extract<HighLevelActionResult, { ok: false }>,
  now = new Date(),
) {
  assertHighLevelPayloadSafe(body);
  await pool.query(
    `UPDATE onetime.highlevel_action_receipts
        SET status = 'succeeded', response_json = $4::jsonb, lease_expires_at = NULL,
            updated_at = $5
      WHERE account_key = $1 AND product_key = $2 AND idempotency_key = $3`,
    [config.accountKey, config.productKey, action.idempotency_key, JSON.stringify(body), now],
  );
  await pool.query(
    `INSERT INTO onetime.audit_events
       (event_key, account_key, product_key, contact_key, event_type, metadata, created_at)
     VALUES ($1, $2, $3, $4, 'highlevel_access_action_rejected', $5::jsonb, $6)
     ON CONFLICT (event_key) DO NOTHING`,
    [
      stableKey('audit_highlevel_access_rejected', [action.idempotency_key]),
      config.accountKey,
      config.productKey,
      action.adult_contact.contact_key,
      JSON.stringify({
        action_name: action.action_name,
        blocker_code: body.code,
        private_payload_recorded: false,
      }),
      now,
    ],
  );
}

async function rejectReceipt(
  pool: DbPool,
  config: AppConfig,
  idempotencyKey: string,
  now = new Date(),
) {
  await pool.query(
    `UPDATE onetime.highlevel_action_receipts
        SET status = 'rejected', lease_expires_at = $4, updated_at = $4
      WHERE account_key = $1 AND product_key = $2 AND idempotency_key = $3`,
    [config.accountKey, config.productKey, idempotencyKey, now],
  );
}
