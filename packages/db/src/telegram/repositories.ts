import { createHash, randomUUID } from 'node:crypto';
import type {
  BotAuditEvent,
  BotAuditSink,
  BotInboxItem,
  BotInboxRepository,
  BotReply,
  BotTransportAdapter,
  ConfirmationRecord,
  ConfirmationRepository,
  ConsumerLeaseRepository,
  IdentityMappingRepository,
  SensitivePayloadRef,
  TelegramIdentityMapping,
} from '../../../contracts/src/telegram/types.ts';
import type { DbPool, Queryable } from '../index.ts';

export class TelegramSqlIdentityMappingRepository implements IdentityMappingRepository {
  constructor(private readonly pool: DbPool) {}

  async findActiveMapping(input: Parameters<IdentityMappingRepository['findActiveMapping']>[0]) {
    const result = await this.pool.query(
      `SELECT mapping_key, bot_key, environment, provider_user_ref_hash, canonical_user_key,
              chat_ref_hash, account_key, product_key, membership_key, mapping_version,
              security_version, status
         FROM onetime.telegram_identity_mappings
        WHERE bot_key = $1
          AND environment = $2
          AND provider_user_ref_hash = $3
          AND status = 'active'
        LIMIT 1`,
      [input.botKey, input.environment, hashOpaque(input.providerUserRef)],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      mappingKey: row.mapping_key,
      botKey: row.bot_key,
      environment: row.environment,
      providerUserRef: input.providerUserRef,
      chatRef: `hashed:${String(row.chat_ref_hash)}`,
      canonicalUserKey: row.canonical_user_key,
      accountKey: row.account_key,
      productKey: row.product_key,
      membershipKey: row.membership_key,
      mappingVersion: Number(row.mapping_version ?? 1),
      securityVersion: Number(row.security_version),
      status: row.status,
    } as TelegramIdentityMapping;
  }

  async upsertProtectedMapping(mapping: TelegramIdentityMapping) {
    await this.pool.query(
      `INSERT INTO onetime.telegram_identity_mappings
       (mapping_key, bot_key, environment, provider_user_ref_hash, chat_ref_hash,
        canonical_user_key, account_key, product_key, membership_key, mapping_version,
        security_version, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (mapping_key) DO UPDATE SET
         chat_ref_hash = EXCLUDED.chat_ref_hash,
         mapping_version = EXCLUDED.mapping_version,
         security_version = EXCLUDED.security_version,
         status = EXCLUDED.status,
         revoked_at = CASE WHEN EXCLUDED.status = 'revoked' THEN now() ELSE NULL END`,
      [
        mapping.mappingKey,
        mapping.botKey,
        mapping.environment,
        hashOpaque(mapping.providerUserRef),
        hashOpaque(mapping.chatRef),
        mapping.canonicalUserKey,
        mapping.accountKey,
        mapping.productKey,
        mapping.membershipKey,
        mapping.mappingVersion,
        mapping.securityVersion,
        mapping.status,
      ],
    );
  }

  async revoke(mappingKey: string, reason: string) {
    await this.pool.query(
      `UPDATE onetime.telegram_identity_mappings
          SET status = 'revoked', revoked_at = now(), revoke_reason = $2
        WHERE mapping_key = $1`,
      [mappingKey, reason],
    );
  }
}

export class TelegramSqlInboxRepository implements BotInboxRepository {
  constructor(private readonly pool: DbPool) {}

  async enqueue(
    update: Parameters<BotInboxRepository['enqueue']>[0],
    payloadRef: SensitivePayloadRef,
  ) {
    const inboxKey = `tg_inbox_${hashOpaque(`${update.botKey}:${update.environment}:${update.updateId}`).slice(0, 32)}`;
    const existing = await this.pool.query(
      `SELECT inbox_key
         FROM onetime.telegram_update_inbox
        WHERE bot_key = $1 AND environment = $2 AND update_id = $3`,
      [update.botKey, update.environment, Number(update.updateId)],
    );
    if (existing.rowCount) {
      return { duplicate: true, inboxKey: existing.rows[0].inbox_key as string };
    }
    const result = await this.pool.query(
      `INSERT INTO onetime.telegram_update_inbox
       (inbox_key, bot_key, environment, bot_installation_id, update_id, payload_ciphertext,
        payload_digest, payload_classification, next_attempt_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT DO NOTHING
       RETURNING inbox_key`,
      [
        inboxKey,
        update.botKey,
        update.environment,
        `${update.botKey}:${update.environment}`,
        Number(update.updateId),
        payloadRef.ciphertext,
        payloadRef.digest,
        payloadRef.classification,
        new Date(update.receivedAt).toISOString(),
      ],
    );
    if (result.rowCount) return { duplicate: false, inboxKey };
    const raced = await this.pool.query(
      `SELECT inbox_key
         FROM onetime.telegram_update_inbox
        WHERE bot_key = $1 AND environment = $2 AND update_id = $3`,
      [update.botKey, update.environment, Number(update.updateId)],
    );
    return { duplicate: true, inboxKey: raced.rows[0].inbox_key as string };
  }

  async claimNext(now: Date, ownerId: string, leaseMs: number) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const row = await selectClaimable(client, now);
      if (!row) {
        await client.query('COMMIT');
        return null;
      }
      const generation = Number(row.lease_generation) + 1;
      const leaseExpiresAt = new Date(now.getTime() + leaseMs).toISOString();
      const updated = await client.query(
        `UPDATE onetime.telegram_update_inbox
            SET status = 'leased',
                lease_owner = $2,
                lease_generation = $3,
                lease_expires_at = $4,
                updated_at = now()
          WHERE inbox_key = $1
          RETURNING inbox_key, bot_key, environment, update_id, payload_ciphertext,
                    payload_digest, payload_classification, attempts, lease_generation`,
        [row.inbox_key, ownerId, generation, leaseExpiresAt],
      );
      await client.query('COMMIT');
      return rowToInboxItem(updated.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async complete(inboxKey: string, leaseGeneration: number) {
    return updateInboxDisposition(this.pool, inboxKey, leaseGeneration, 'completed');
  }

  async retry(inboxKey: string, leaseGeneration: number, nextAttemptAt: Date, reasonCode: string) {
    const result = await this.pool.query(
      `UPDATE onetime.telegram_update_inbox
          SET status = 'retry',
              attempts = attempts + 1,
              next_attempt_at = $3,
              lease_owner = NULL,
              lease_expires_at = NULL,
              last_error_code = $4,
              updated_at = now()
        WHERE inbox_key = $1 AND lease_generation = $2`,
      [inboxKey, leaseGeneration, nextAttemptAt.toISOString(), reasonCode],
    );
    return Boolean(result.rowCount);
  }

  async deadLetter(inboxKey: string, leaseGeneration: number, reasonCode: string) {
    const result = await this.pool.query(
      `UPDATE onetime.telegram_update_inbox
          SET status = 'dead_letter',
              lease_owner = NULL,
              lease_expires_at = NULL,
              last_error_code = $3,
              updated_at = now()
        WHERE inbox_key = $1 AND lease_generation = $2`,
      [inboxKey, leaseGeneration, reasonCode],
    );
    if (result.rowCount) {
      await this.pool.query(
        `INSERT INTO onetime.telegram_dead_letters
         (dead_letter_key, bot_key, environment, inbox_key, reason_code)
         SELECT $1, bot_key, environment, inbox_key, $2
           FROM onetime.telegram_update_inbox
          WHERE inbox_key = $3
         ON CONFLICT (dead_letter_key) DO NOTHING`,
        [`tg_dead_${hashOpaque(`${inboxKey}:${reasonCode}`).slice(0, 32)}`, reasonCode, inboxKey],
      );
    }
    return Boolean(result.rowCount);
  }
}

export class TelegramSqlConfirmationRepository implements ConfirmationRepository {
  constructor(private readonly pool: DbPool) {}

  async create(record: ConfirmationRecord) {
    await this.pool.query(
      `INSERT INTO onetime.telegram_confirmations
       (confirmation_key, bot_key, environment, provider_user_ref_hash, chat_ref_hash,
        actor_user_key, account_key, product_key, capability, source, risk_class, action_digest,
        entity_version, target_version, mapping_key, mapping_version, role_at_preview,
        security_version, idempotency_key, preview_digest, payload_ciphertext, payload_digest,
        payload_classification, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       ON CONFLICT (confirmation_key) DO NOTHING`,
      [
        record.confirmationKey,
        record.botKey,
        record.environment,
        hashOpaque(record.providerUserRef),
        hashOpaque(record.chatRef),
        record.actorUserKey,
        record.accountKey,
        record.productKey,
        record.capability,
        record.source,
        record.riskClass,
        record.actionDigest,
        record.targetVersion ?? null,
        record.targetVersion ?? null,
        record.mappingKey,
        record.mappingVersion,
        record.roleAtPreview,
        record.securityVersion,
        record.idempotencyKey,
        record.previewDigest,
        record.payloadRef.ciphertext,
        record.payloadRef.digest,
        record.payloadRef.classification,
        record.expiresAt,
      ],
    );
  }

  async get(confirmationKey: string) {
    const result = await this.pool.query(
      `SELECT confirmation_key, bot_key, environment, provider_user_ref_hash, chat_ref_hash,
              actor_user_key, account_key, product_key, capability, source, risk_class,
              action_digest, entity_version, target_version, mapping_key, mapping_version,
              role_at_preview, security_version, idempotency_key, preview_digest,
              payload_ciphertext, payload_digest, payload_classification, expires_at,
              consumed_at, cancelled_at, result_json
         FROM onetime.telegram_confirmations
        WHERE confirmation_key = $1`,
      [confirmationKey],
    );
    return result.rows[0] ? rowToConfirmation(result.rows[0]) : null;
  }

  async consume(confirmationKey: string, now: Date) {
    const result = await this.pool.query(
      `UPDATE onetime.telegram_confirmations
          SET consumed_at = $2
        WHERE confirmation_key = $1
          AND consumed_at IS NULL
          AND cancelled_at IS NULL
          AND expires_at > $2
        RETURNING confirmation_key`,
      [confirmationKey, now.toISOString()],
    );
    if (result.rowCount) return 'consumed';
    return this.afterConfirmationMiss(confirmationKey, now);
  }

  async cancel(confirmationKey: string, now: Date) {
    const result = await this.pool.query(
      `UPDATE onetime.telegram_confirmations
          SET cancelled_at = $2
        WHERE confirmation_key = $1
          AND consumed_at IS NULL
          AND cancelled_at IS NULL
          AND expires_at > $2
        RETURNING confirmation_key`,
      [confirmationKey, now.toISOString()],
    );
    if (result.rowCount) return 'cancelled';
    return this.afterConfirmationMiss(confirmationKey, now);
  }

  async recordResult(confirmationKey: string, result: ConfirmationRecord['result'], now: Date) {
    await this.pool.query(
      `UPDATE onetime.telegram_confirmations
          SET result_json = $2::jsonb,
              consumed_at = COALESCE(consumed_at, $3)
        WHERE confirmation_key = $1`,
      [confirmationKey, JSON.stringify(result ?? null), now.toISOString()],
    );
  }

  private async afterConfirmationMiss(confirmationKey: string, now: Date) {
    const record = await this.get(confirmationKey);
    if (!record) return 'missing';
    if (record.consumedAt || record.cancelledAt) return 'already_consumed';
    if (new Date(record.expiresAt).getTime() <= now.getTime()) return 'expired';
    return 'missing';
  }
}

export class TelegramSqlConsumerLeaseRepository implements ConsumerLeaseRepository {
  constructor(private readonly pool: DbPool) {}

  async acquire(input: Parameters<ConsumerLeaseRepository['acquire']>[0]) {
    await this.pool.query(
      `UPDATE onetime.telegram_consumer_leases
          SET active = false, released_at = $4
        WHERE bot_key = $1 AND environment = $2 AND token_fingerprint_hash = $3
          AND active = true AND expires_at <= $4`,
      [input.botKey, input.environment, input.tokenFingerprint, input.now.toISOString()],
    );
    const existing = await this.pool.query(
      `SELECT generation
         FROM onetime.telegram_consumer_leases
        WHERE bot_key = $1 AND environment = $2 AND token_fingerprint_hash = $3
        ORDER BY generation DESC
        LIMIT 1`,
      [input.botKey, input.environment, input.tokenFingerprint],
    );
    const generation = Number(existing.rows[0]?.generation ?? 0) + 1;
    const leaseKey = `tg_lease_${hashOpaque(`${input.botKey}:${input.environment}:${input.tokenFingerprint}:${generation}`).slice(0, 32)}`;
    try {
      await this.pool.query(
        `INSERT INTO onetime.telegram_consumer_leases
         (lease_key, bot_key, environment, token_fingerprint_hash, owner_id, generation, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          leaseKey,
          input.botKey,
          input.environment,
          input.tokenFingerprint,
          input.ownerId,
          generation,
          new Date(input.now.getTime() + input.leaseMs).toISOString(),
        ],
      );
      return { acquired: true as const, generation };
    } catch {
      return { acquired: false as const, reason: 'already_owned' as const };
    }
  }

  async heartbeat(ownerId: string, generation: number, leaseMs: number, now: Date) {
    const result = await this.pool.query(
      `UPDATE onetime.telegram_consumer_leases
          SET expires_at = $4
        WHERE owner_id = $1 AND generation = $2 AND active = true AND expires_at > $3`,
      [ownerId, generation, now.toISOString(), new Date(now.getTime() + leaseMs).toISOString()],
    );
    return Boolean(result.rowCount);
  }

  async release(ownerId: string, generation: number) {
    await this.pool.query(
      `UPDATE onetime.telegram_consumer_leases
          SET active = false, released_at = now()
        WHERE owner_id = $1 AND generation = $2`,
      [ownerId, generation],
    );
  }
}

export class TelegramSqlAuditSink implements BotAuditSink {
  constructor(private readonly pool: DbPool) {}

  async record(event: BotAuditEvent) {
    await this.pool.query(
      `INSERT INTO onetime.telegram_operation_audit
       (event_key, bot_key, environment, account_key, product_key, actor_user_key,
        capability, correlation_key, outcome, reason, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
      [
        `tg_audit_${randomUUID()}`,
        event.botKey,
        event.environment,
        event.accountKey ?? null,
        event.productKey ?? null,
        event.actorUserKey ?? null,
        event.capability ?? null,
        event.correlationKey,
        event.outcome,
        event.reason ?? null,
        JSON.stringify(event.metadata ?? {}),
      ],
    );
  }
}

export class TelegramSqlResponseOutboxTransportAdapter implements BotTransportAdapter {
  readonly mode = 'telegram' as const;

  constructor(
    private readonly pool: DbPool,
    private readonly scope: { botKey: string; environment: string },
  ) {}

  async sendReply(reply: BotReply) {
    const payload = {
      text: reply.text,
      buttons: reply.buttons ?? [],
      correlation_key: reply.correlationKey,
    };
    const payloadJson = JSON.stringify(payload);
    await this.pool.query(
      `INSERT INTO onetime.telegram_response_outbox
       (response_key, bot_key, environment, bot_installation_id, chat_ref_hash,
        correlation_key, payload, payload_digest)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
       ON CONFLICT (response_key) DO NOTHING`,
      [
        `tg_response_${hashOpaque(`${this.scope.botKey}:${this.scope.environment}:${reply.correlationKey}:${reply.chatRef}`).slice(0, 32)}`,
        this.scope.botKey,
        this.scope.environment,
        `${this.scope.botKey}:${this.scope.environment}`,
        hashOpaque(reply.chatRef),
        reply.correlationKey,
        payloadJson,
        hashOpaque(payloadJson),
      ],
    );
  }
}

async function selectClaimable(client: Queryable, now: Date) {
  const params = [now.toISOString()];
  const sql = `SELECT inbox_key, lease_generation
       FROM onetime.telegram_update_inbox
      WHERE (
        status IN ('queued', 'retry') AND next_attempt_at <= $1
      ) OR (
        status = 'leased' AND lease_expires_at <= $1
      )
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED`;
  try {
    const result = await client.query(sql, params);
    return result.rows[0] ?? null;
  } catch (error) {
    if (error instanceof Error && error.message.includes('SKIP LOCKED')) {
      const fallback = await client.query(sql.replace(' FOR UPDATE SKIP LOCKED', ''), params);
      return fallback.rows[0] ?? null;
    }
    throw error;
  }
}

async function updateInboxDisposition(
  pool: DbPool,
  inboxKey: string,
  leaseGeneration: number,
  status: 'completed',
) {
  const result = await pool.query(
    `UPDATE onetime.telegram_update_inbox
        SET status = $3,
            lease_owner = NULL,
            lease_expires_at = NULL,
            updated_at = now()
      WHERE inbox_key = $1 AND lease_generation = $2`,
    [inboxKey, leaseGeneration, status],
  );
  return Boolean(result.rowCount);
}

function rowToInboxItem(row: Record<string, unknown>): BotInboxItem {
  return {
    inboxKey: String(row.inbox_key),
    botKey: String(row.bot_key) as never,
    environment: String(row.environment) as never,
    updateId: String(row.update_id),
    payloadRef: {
      ciphertext: String(row.payload_ciphertext),
      digest: String(row.payload_digest),
      classification: row.payload_classification as never,
    },
    attempts: Number(row.attempts),
    leaseGeneration: Number(row.lease_generation),
  };
}

function rowToConfirmation(row: Record<string, unknown>): ConfirmationRecord {
  const record: ConfirmationRecord = {
    confirmationKey: String(row.confirmation_key),
    botKey: String(row.bot_key) as never,
    environment: String(row.environment) as never,
    providerUserRef: `hashed:${String(row.provider_user_ref_hash)}` as never,
    chatRef: `hashed:${String(row.chat_ref_hash)}` as never,
    actorUserKey: String(row.actor_user_key) as never,
    accountKey: String(row.account_key),
    productKey: String(row.product_key),
    capability: row.capability as never,
    source: (row.source ?? 'deterministic') as never,
    riskClass: (row.risk_class ?? 'R1') as never,
    actionDigest: String(row.action_digest),
    mappingKey: String(row.mapping_key ?? 'legacy_mapping'),
    mappingVersion: Number(row.mapping_version ?? 1),
    roleAtPreview: (row.role_at_preview ?? 'owner') as never,
    securityVersion: Number(row.security_version),
    idempotencyKey: String(row.idempotency_key),
    previewDigest: String(row.preview_digest ?? row.action_digest),
    payloadRef: {
      ciphertext: String(row.payload_ciphertext),
      digest: String(row.payload_digest),
      classification: row.payload_classification as never,
    },
    expiresAt: toIso(row.expires_at),
  };
  if (row.entity_version !== null && row.entity_version !== undefined) {
    record.targetVersion = Number(row.target_version ?? row.entity_version);
  } else if (row.target_version !== null && row.target_version !== undefined) {
    record.targetVersion = Number(row.target_version);
  }
  if (row.consumed_at) record.consumedAt = toIso(row.consumed_at);
  if (row.cancelled_at) record.cancelledAt = toIso(row.cancelled_at);
  if (row.result_json) record.result = row.result_json as never;
  return record;
}

function hashOpaque(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function toIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}
