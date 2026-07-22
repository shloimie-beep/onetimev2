import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { AppConfig } from '../../../config/src/index.ts';
import {
  assertHighLevelPayloadSafe,
  highLevelInboundActionSchema,
  type HighLevelActionResult,
  type HighLevelInboundAction,
} from '../../../contracts/src/highlevel/index.ts';
import type { DbPool } from '../../../db/src/index.ts';
import { inTransaction } from '../../../db/src/index.ts';
import { requestPasswordReset } from '../accounts/lifecycle.ts';
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
  if (!authenticated(input.config, input.headers, input.rawBody, requestNow)) {
    return blocked(401, 'HIGHLEVEL_ACTION_AUTH_FAILED', false);
  }

  let action: HighLevelInboundAction;
  try {
    action = highLevelInboundActionSchema.parse(JSON.parse(input.rawBody.toString('utf8')));
    assertHighLevelPayloadSafe(action);
  } catch {
    return blocked(400, 'HIGHLEVEL_CONTACT_INELIGIBLE', false);
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
  } catch {
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
  if (action.action_name === 'bot.complete_signup') {
    if (!action.data.details_complete) throw new Error('DETAILS_INCOMPLETE');
    await completeAdultSignup(input.pool, input.config, action, contact, input.now ?? new Date());
    return success(action, '/signup', { signup_completed: true });
  }
  if (action.action_name === 'bot.next_confirmed_class_info') {
    const next = await nextConfirmedClass(input.pool, input.config, contact.contact_key);
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
  await applyOptOut(input.pool, input.config, action, input.now ?? new Date());
  return success(action, null, {
    suppression_applied: true,
    acknowledgement_authorized: false,
  });
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

async function nextConfirmedClass(pool: DbPool, config: AppConfig, contactKey: string) {
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
       JOIN onetime.billing_entitlement_projections AS entitlements
         ON entitlements.account_key = guardians.account_key
        AND entitlements.product_key = guardians.product_key
        AND entitlements.principal_key = guardians.household_key
        AND entitlements.status IN ('active', 'scheduled_end')
        AND entitlements.grants_access = true
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
    [config.accountKey, config.productKey, contactKey],
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
  const channel = action.data.channel ?? 'all';
  await inTransaction(pool, async (client) => {
    await client.query(
      `UPDATE onetime.contacts
          SET suppression_state = 'suppressed', updated_at = $4
        WHERE account_key = $1 AND product_key = $2 AND contact_key = $3`,
      [config.accountKey, config.productKey, action.adult_contact.contact_key, now],
    );
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

function authenticated(
  config: AppConfig,
  headers: HighLevelActionSignatureHeaders,
  rawBody: Buffer,
  now: Date,
) {
  if (
    !config.highLevelActionSecret ||
    !headers.keyId ||
    !headers.timestamp ||
    !headers.nonce ||
    !headers.idempotencyKey ||
    !headers.signature ||
    !secureEqual(headers.keyId, config.highLevelActionKeyId) ||
    !/^\d{10}$/.test(headers.timestamp) ||
    !/^[A-Za-z0-9_-]{16,160}$/.test(headers.nonce) ||
    !/^[A-Za-z0-9._:-]{8,160}$/.test(headers.idempotencyKey)
  ) {
    return false;
  }
  const timestampMs = Number(headers.timestamp) * 1000;
  if (
    !Number.isSafeInteger(timestampMs) ||
    Math.abs(now.getTime() - timestampMs) > config.highLevelActionSignatureToleranceMs
  ) {
    return false;
  }
  const expected = signHighLevelActionRequest({
    secret: config.highLevelActionSecret,
    keyId: headers.keyId,
    timestamp: headers.timestamp,
    nonce: headers.nonce,
    idempotencyKey: headers.idempotencyKey,
    rawBody,
  });
  return secureEqual(headers.signature, expected);
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
  result: Record<string, string | boolean | null>,
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
  const body = receipt.response_json as Extract<HighLevelActionResult, { ok: true }>;
  return { status: 200, body: { ...body, replayed: true } };
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
