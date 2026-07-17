/* eslint-disable no-console */
import { createCipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { loadConfig } from '../../../../packages/config/src/index.ts';
import { inTransaction } from '../../../../packages/db/src/index.ts';
import { runLifecycleDeliveryOutboxBatch } from '../../../../packages/domain/src/index.ts';
import { normalizeEmail, stableKey } from '../../../../packages/domain/src/lead/normalize.ts';

type Role = 'owner' | 'admin';

const mode = process.argv[2];
const config = loadConfig(process.env);
const pool = new pg.Pool({
  connectionString: requireEnv('DATABASE_URL'),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
  statement_timeout: 30_000,
});

try {
  if (mode === 'issue-activation') {
    console.log(JSON.stringify(await issueActivation(), null, 2));
  } else if (mode === 'run-lifecycle-batch') {
    console.log(JSON.stringify(await runLifecycleBatch(), null, 2));
  } else if (mode === 'snapshot') {
    console.log(JSON.stringify(await snapshot(), null, 2));
  } else {
    throw new Error(
      'Usage: operator-lifecycle-bootstrap.ts issue-activation|run-lifecycle-batch|snapshot',
    );
  }
} finally {
  await pool.end();
}

async function issueActivation() {
  const email = normalizeEmail(requireEnv('OPS11_OPERATOR_EMAIL'));
  const role = requireRole(process.env.OPS11_OPERATOR_ROLE ?? 'admin');
  const idempotencyKey = requireEnv('OPS11_IDEMPOTENCY_KEY');
  const displayName = process.env.OPS11_OPERATOR_DISPLAY_NAME?.trim() || 'One Time Operator';
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const token = randomBytes(32).toString('base64url');
  const tokenKey = stableKey('account_lifecycle_token', [
    config.accountKey,
    config.productKey,
    'owner_admin_invitation',
    idempotencyKey,
  ]);
  const tokenRef = stableKey('account_lifecycle_token_ref', [tokenKey]);
  const requestPayload = {
    idempotency_key: idempotencyKey,
    email,
    display_name: displayName,
    role,
  };
  const requestHash = digest(JSON.stringify(sortForHash(requestPayload)));
  const destinationRef = digest(email);
  const intentKey = stableKey('account_lifecycle_delivery', [
    tokenKey,
    'owner_admin_invitation',
    idempotencyKey,
  ]);
  const deliveryKey = stableKey('account_lifecycle_delivery_outbox', [
    config.accountKey,
    config.productKey,
    'owner_admin_invitation',
    idempotencyKey,
  ]);
  const encrypted = encryptPayload({
    schema_version: 1,
    purpose: 'owner_admin_invitation',
    token_key: tokenKey,
    token,
    activation_url: `${config.publicBaseUrl.replace(/\/+$/, '')}/activate#token=${encodeURIComponent(token)}`,
    fragment_parameter: 'token',
    target_role: role,
    issued_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  });

  return inTransaction(pool, async (client) => {
    const existingUser = await client.query(
      `SELECT role, status, count(*)::int AS count
         FROM onetime.account_users
        WHERE account_key = $1
          AND product_key = $2
          AND email_normalized = $3
        GROUP BY role, status`,
      [config.accountKey, config.productKey, email],
    );
    if (existingUser.rows.length) {
      throw new Error('operator_account_already_exists_use_reset_path');
    }

    await client.query(
      `UPDATE onetime.account_lifecycle_tokens
          SET revoked_at = $6
        WHERE account_key = $1
          AND product_key = $2
          AND token_type = 'owner_admin_invitation'
          AND consumed_at IS NULL
          AND revoked_at IS NULL
          AND target_role = $3
          AND email_normalized = $4
          AND token_key <> $5`,
      [config.accountKey, config.productKey, role, email, tokenKey, now],
    );

    await client.query(
      `UPDATE onetime.account_lifecycle_delivery_outbox
          SET state = 'superseded',
              nonce = NULL,
              ciphertext = NULL,
              auth_tag = NULL,
              cleared_at = $5,
              updated_at = $5
        WHERE account_key = $1
          AND product_key = $2
          AND purpose = 'owner_admin_invitation'
          AND destination_ref = $3
          AND delivery_key <> $4
          AND state IN ('queued', 'leased', 'retry', 'provider_off')`,
      [config.accountKey, config.productKey, destinationRef, deliveryKey, now],
    );

    await client.query(
      `INSERT INTO onetime.account_lifecycle_tokens
         (token_key, account_key, product_key, token_type, token_hash, email_normalized,
          display_name, target_role, subject_user_key, household_key, relationship_key,
          learner_key, expires_at, created_by_user_key, metadata, created_at)
       VALUES ($1,$2,$3,'owner_admin_invitation',$4,$5,$6,$7,NULL,NULL,NULL,NULL,$8,NULL,$9::jsonb,$10)
       ON CONFLICT (token_key) DO NOTHING`,
      [
        tokenKey,
        config.accountKey,
        config.productKey,
        digest(token),
        email,
        displayName,
        role,
        expiresAt,
        JSON.stringify({ raw_token_included: false, ops11_bootstrap: true }),
        now,
      ],
    );

    await client.query(
      `INSERT INTO onetime.account_lifecycle_delivery_intents
         (intent_key, account_key, product_key, token_key, intent_type, channel,
          recipient_email, delivery_state, idempotency_key, request_hash, payload, created_at)
       VALUES ($1,$2,$3,$4,'owner_admin_invitation','email',$5,'sink_queued',$6,$7,$8::jsonb,$9)
       ON CONFLICT (account_key, product_key, intent_type, idempotency_key) DO NOTHING`,
      [
        intentKey,
        config.accountKey,
        config.productKey,
        tokenKey,
        email,
        idempotencyKey,
        requestHash,
        JSON.stringify({
          policy_version: 'ops11-owner-admin-bootstrap-v1',
          token_type: 'owner_admin_invitation',
          token_ref: tokenRef,
          target_role: role,
          raw_token_included: false,
          external_send_performed: false,
        }),
        now,
      ],
    );

    await client.query(
      `INSERT INTO onetime.account_lifecycle_delivery_outbox
         (delivery_key, account_key, product_key, token_key, intent_key, purpose, channel,
          transport_mode, destination_ref, key_id, key_version, nonce, ciphertext, auth_tag,
          encrypted_payload_expires_at, state, attempts, max_attempts, next_attempt_at,
          idempotency_key, metadata, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,'owner_admin_invitation','email','sink',$6,$7,1,$8,$9,$10,$11,
          'queued',0,5,$12,$13,$14::jsonb,$15,$15)
       ON CONFLICT (account_key, product_key, purpose, idempotency_key) DO NOTHING`,
      [
        deliveryKey,
        config.accountKey,
        config.productKey,
        tokenKey,
        intentKey,
        destinationRef,
        config.lifecycleDeliveryKeyId,
        encrypted.nonce,
        encrypted.ciphertext,
        encrypted.authTag,
        expiresAt,
        now,
        idempotencyKey,
        JSON.stringify({
          policy_version: 'ops11-owner-admin-bootstrap-v1',
          raw_token_included: false,
          raw_url_included: false,
          destination_ref: destinationRef,
        }),
        now,
      ],
    );

    await client.query(
      `INSERT INTO onetime.account_lifecycle_audit_events
         (audit_key, account_key, product_key, actor_user_key, subject_user_key,
          token_key, action_type, success, reason, metadata)
       VALUES ($1,$2,$3,NULL,NULL,$4,'owner_admin_invitation_issued',true,NULL,$5::jsonb)`,
      [
        stableKey('account_lifecycle_audit', [
          config.accountKey,
          config.productKey,
          'owner_admin_invitation_issued',
          randomUUID(),
        ]),
        config.accountKey,
        config.productKey,
        tokenKey,
        JSON.stringify({
          policy_version: 'ops11-owner-admin-bootstrap-v1',
          target_role: role,
          token_ref: tokenRef,
          lifecycle_delivery_ref: deliveryKey,
          destination_ref: destinationRef,
          raw_token_included: false,
          raw_url_included: false,
          external_send_performed: false,
        }),
      ],
    );

    const row = await readOutboxFrom(client, deliveryKey);
    return {
      mode: 'issue-activation',
      idempotency_key: idempotencyKey,
      token_key: tokenKey,
      token_ref: tokenRef,
      delivery_key: deliveryKey,
      destination_ref: destinationRef,
      role,
      expires_at: expiresAt.toISOString(),
      outbox: row,
      raw_token_logged: false,
      raw_url_logged: false,
      external_send_performed: false,
    };
  });
}

async function runLifecycleBatch() {
  const idempotencyKey = process.env.OPS11_IDEMPOTENCY_KEY;
  const before = idempotencyKey ? await readOutboxByIdempotency(idempotencyKey) : null;
  const summary = await runLifecycleDeliveryOutboxBatch({
    pool,
    config,
    limit: Number(process.env.OPS11_BATCH_LIMIT ?? 5),
    leaseMs: Number(process.env.OPS11_BATCH_LEASE_MS ?? 120_000),
    workerId: process.env.OPS11_WORKER_ID ?? `ops11-lifecycle-${randomUUID()}`,
  });
  const after = idempotencyKey ? await readOutboxByIdempotency(idempotencyKey) : null;
  return {
    mode: 'run-lifecycle-batch',
    before,
    after,
    summary,
    raw_token_logged: false,
    raw_url_logged: false,
  };
}

async function snapshot() {
  const email = process.env.OPS11_OPERATOR_EMAIL
    ? normalizeEmail(process.env.OPS11_OPERATOR_EMAIL)
    : null;
  const destinationRef = email ? digest(email) : null;
  const [accounts, lifecycle, ownerLifecycle, authEmail] = await Promise.all([
    email
      ? pool.query(
          `SELECT role, status, count(*)::int AS count
             FROM onetime.account_users
            WHERE account_key = $1
              AND product_key = $2
              AND email_normalized = $3
            GROUP BY role, status
            ORDER BY role, status`,
          [config.accountKey, config.productKey, email],
        )
      : { rows: [] },
    pool.query(
      `SELECT state, purpose, count(*)::int AS count
         FROM onetime.account_lifecycle_delivery_outbox
        WHERE account_key = $1
          AND product_key = $2
        GROUP BY state, purpose
        ORDER BY state, purpose`,
      [config.accountKey, config.productKey],
    ),
    destinationRef
      ? pool.query(
          `SELECT state, purpose, count(*)::int AS count
             FROM onetime.account_lifecycle_delivery_outbox
            WHERE account_key = $1
              AND product_key = $2
              AND destination_ref = $3
            GROUP BY state, purpose
            ORDER BY state, purpose`,
          [config.accountKey, config.productKey, destinationRef],
        )
      : { rows: [] },
    pool.query(
      `SELECT state, purpose, count(*)::int AS count
         FROM onetime.auth_email_challenge_delivery_outbox
        WHERE account_key = $1
          AND product_key = $2
        GROUP BY state, purpose
        ORDER BY state, purpose`,
      [config.accountKey, config.productKey],
    ),
  ]);
  return {
    mode: 'snapshot',
    destination_ref: destinationRef,
    account_rows: accounts.rows,
    lifecycle_queue: lifecycle.rows,
    lifecycle_operator_queue: ownerLifecycle.rows,
    auth_email_queue: authEmail.rows,
  };
}

async function readOutboxFrom(
  queryable: Pick<pg.Pool | pg.PoolClient, 'query'>,
  deliveryKey: string,
) {
  const result = await queryable.query(
    `SELECT delivery_key, purpose, state, attempts, max_attempts,
            delivered_at IS NOT NULL AS delivered,
            provider_message_ref_hash IS NOT NULL AS provider_message_ref_hash_present,
            nonce IS NULL AND ciphertext IS NULL AND auth_tag IS NULL AS encrypted_payload_cleared,
            encrypted_payload_expires_at
       FROM onetime.account_lifecycle_delivery_outbox
      WHERE delivery_key = $1
      LIMIT 1`,
    [deliveryKey],
  );
  return result.rows[0] ?? null;
}

async function readOutboxByIdempotency(idempotencyKey: string) {
  const result = await pool.query(
    `SELECT delivery_key, purpose, state, attempts, max_attempts,
            delivered_at IS NOT NULL AS delivered,
            provider_message_ref_hash IS NOT NULL AS provider_message_ref_hash_present,
            nonce IS NULL AND ciphertext IS NULL AND auth_tag IS NULL AS encrypted_payload_cleared,
            encrypted_payload_expires_at
       FROM onetime.account_lifecycle_delivery_outbox
      WHERE account_key = $1
        AND product_key = $2
        AND purpose = 'owner_admin_invitation'
        AND idempotency_key = $3
      LIMIT 1`,
    [config.accountKey, config.productKey, idempotencyKey],
  );
  return result.rows[0] ?? null;
}

function encryptPayload(payload: Record<string, unknown>) {
  if (!config.lifecycleDeliveryKey) {
    throw new Error('ONE_TIME_LIFECYCLE_DELIVERY_KEY is required.');
  }
  const nonce = randomBytes(12);
  const cipher = createCipheriv(
    'aes-256-gcm',
    createHash('sha256').update(config.lifecycleDeliveryKey).digest(),
    nonce,
  );
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  return {
    nonce: nonce.toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
    authTag: cipher.getAuthTag().toString('base64url'),
  };
}

function requireRole(value: string): Role {
  if (value === 'owner' || value === 'admin') return value;
  throw new Error('OPS11_OPERATOR_ROLE must be owner or admin.');
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function sortForHash(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForHash);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortForHash(entry)]),
    );
  }
  return value;
}
