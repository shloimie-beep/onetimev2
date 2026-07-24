import { createHash } from 'node:crypto';
import type { RabbiConversationProvider } from '../../../contracts/src/telegram/rabbi-communications.ts';
import type {
  BotAuditSink,
  BotEnvironment,
  BotKey,
  SensitivePayloadCodec,
} from '../../../contracts/src/telegram/types.ts';
import { inTransaction, type DbPool, type Queryable } from '../../../db/src/index.ts';

type ClaimedReply = {
  delivery_key: string;
  bot_key: BotKey;
  environment: BotEnvironment;
  account_key: string;
  product_key: string;
  conversation_key: string;
  actor_user_key: string;
  idempotency_key: string;
  reply_digest: string;
  payload_ciphertext: string;
  payload_digest: string;
  payload_classification: 'intent_payload';
  attempts: number;
  max_attempts: number;
  lease_generation: number;
  channel: 'email' | 'sms' | 'whatsapp';
  provider_conversation_ciphertext: string;
  provider_conversation_digest: string;
};

export type RabbiReplyWorkerConfig = {
  botKey: BotKey;
  environment: BotEnvironment;
  ownerId: string;
  rowLeaseMs: number;
  baseBackoffMs: number;
};

export class RabbiParentReplyWorker {
  private running = false;
  private stopping = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly pool: DbPool,
    private readonly codec: SensitivePayloadCodec,
    private readonly provider: RabbiConversationProvider,
    private readonly audit: BotAuditSink,
    private readonly config: RabbiReplyWorkerConfig,
  ) {}

  async runOnce(now = new Date()) {
    if (this.provider.mode === 'disabled') {
      return {
        enabled: false as const,
        code: 'RABBI_GHL_PROVIDER_OFF' as const,
        claimed: 0,
      };
    }
    if (this.running) {
      return { enabled: true as const, claimed: 0, disposition: 'already_running' as const };
    }
    this.running = true;
    let item: ClaimedReply | null = null;
    try {
      item = await claimNext(this.pool, this.config, this.provider.mode, now);
      if (!item) return { enabled: true as const, claimed: 0, disposition: 'empty' as const };
      const payload = (await this.codec.decrypt(
        {
          ciphertext: item.payload_ciphertext,
          digest: item.payload_digest,
          classification: item.payload_classification,
        },
        {
          botKey: item.bot_key,
          environment: item.environment,
          accountKey: item.account_key,
          productKey: item.product_key,
          actorKey: item.actor_user_key,
          classification: 'intent_payload',
        },
      )) as { replyText?: unknown };
      if (
        typeof payload.replyText !== 'string' ||
        digest(payload.replyText) !== item.reply_digest
      ) {
        throw new Error('RABBI_REPLY_PAYLOAD_INVALID');
      }
      const providerRefPayload = (await this.codec.decrypt(
        {
          ciphertext: item.provider_conversation_ciphertext,
          digest: item.provider_conversation_digest,
          classification: 'intent_payload',
        },
        {
          botKey: item.bot_key,
          environment: item.environment,
          accountKey: item.account_key,
          productKey: item.product_key,
          classification: 'intent_payload',
        },
      )) as { conversationRef?: unknown };
      if (
        typeof providerRefPayload.conversationRef !== 'string' ||
        digest(providerRefPayload.conversationRef) !== item.provider_conversation_digest
      ) {
        throw new Error('RABBI_CONVERSATION_REF_INVALID');
      }
      const receipt = await this.provider.sendReply({
        conversationRef: providerRefPayload.conversationRef,
        channel: item.channel,
        body: payload.replyText,
        idempotencyKey: item.idempotency_key,
      });
      if (receipt.conversationRef !== providerRefPayload.conversationRef) {
        throw new Error('RABBI_GHL_CONVERSATION_MISMATCH');
      }
      const completed = await this.pool.query(
        `UPDATE onetime.rabbi_parent_reply_outbox
            SET state = 'delivered',
                payload_ciphertext = NULL,
                provider_receipt_digest = $4,
                delivered_at = $5,
                lease_owner = NULL,
                lease_expires_at = NULL,
                last_error_code = NULL,
                updated_at = $5
          WHERE delivery_key = $1
            AND lease_owner = $2
            AND lease_generation = $3
            AND state = 'leased'`,
        [
          item.delivery_key,
          this.config.ownerId,
          item.lease_generation,
          digest(receipt.providerMessageRef),
          now.toISOString(),
        ],
      );
      if (!completed.rowCount) throw new Error('RABBI_REPLY_LEASE_LOST');
      await this.pool.query(
        `UPDATE onetime.rabbi_parent_conversations
            SET last_reply_state = 'delivered',
                updated_at = $4
          WHERE account_key = $1
            AND product_key = $2
            AND conversation_key = $3`,
        [item.account_key, item.product_key, item.conversation_key, now.toISOString()],
      );
      await this.audit.record({
        botKey: item.bot_key,
        environment: item.environment,
        accountKey: item.account_key,
        productKey: item.product_key,
        actorUserKey: item.actor_user_key,
        capability: 'conversation.parent.reply.confirm',
        correlationKey: item.delivery_key,
        outcome: 'completed',
        metadata: {
          delivery_mode: this.provider.mode,
          same_conversation: true,
          reply_digest: item.reply_digest,
        },
      });
      return { enabled: true as const, claimed: 1, disposition: 'delivered' as const };
    } catch (error) {
      if (!item) throw error;
      const errorCode = safeErrorCode(error);
      const terminal = item.attempts >= item.max_attempts;
      const failed = await this.pool.query(
        `UPDATE onetime.rabbi_parent_reply_outbox
            SET state = $4,
                next_attempt_at = $5,
                lease_owner = NULL,
                lease_expires_at = NULL,
                last_error_code = $6,
                updated_at = $7
          WHERE delivery_key = $1
            AND lease_owner = $2
            AND lease_generation = $3
            AND state = 'leased'`,
        [
          item.delivery_key,
          this.config.ownerId,
          item.lease_generation,
          terminal ? 'dead_letter' : 'retry',
          new Date(
            now.getTime() + this.config.baseBackoffMs * 2 ** (item.attempts - 1),
          ).toISOString(),
          errorCode,
          now.toISOString(),
        ],
      );
      if (failed.rowCount !== 1) {
        return {
          enabled: true as const,
          claimed: 1,
          disposition: 'lease_lost' as const,
        };
      }
      if (terminal) {
        await this.pool.query(
          `UPDATE onetime.rabbi_parent_conversations
              SET last_reply_state = 'failed',
                  updated_at = $4
            WHERE account_key = $1
              AND product_key = $2
              AND conversation_key = $3`,
          [item.account_key, item.product_key, item.conversation_key, now.toISOString()],
        );
      }
      await this.audit.record({
        botKey: item.bot_key,
        environment: item.environment,
        accountKey: item.account_key,
        productKey: item.product_key,
        actorUserKey: item.actor_user_key,
        capability: 'conversation.parent.reply.confirm',
        correlationKey: item.delivery_key,
        outcome: terminal ? 'dead_letter' : 'failed',
        reason: errorCode,
        metadata: { delivery_mode: this.provider.mode, attempts: item.attempts },
      });
      return {
        enabled: true as const,
        claimed: 1,
        disposition: terminal ? ('dead_letter' as const) : ('retry' as const),
      };
    } finally {
      this.running = false;
    }
  }

  start(intervalMs: number) {
    this.stopping = false;
    const tick = async () => {
      if (this.stopping) return;
      await this.runOnce();
      if (!this.stopping) this.timer = setTimeout(tick, intervalMs);
    };
    this.timer = setTimeout(tick, 0);
  }

  async stop() {
    this.stopping = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    while (this.running) await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

export async function encryptRabbiParentConversationRef(input: {
  codec: SensitivePayloadCodec;
  botKey: BotKey;
  environment: BotEnvironment;
  accountKey: string;
  productKey: string;
  conversationRef: string;
}) {
  const payload = await input.codec.encrypt(
    { conversationRef: input.conversationRef },
    {
      botKey: input.botKey,
      environment: input.environment,
      accountKey: input.accountKey,
      productKey: input.productKey,
      classification: 'intent_payload',
    },
  );
  return {
    ciphertext: payload.ciphertext,
    digest: digest(input.conversationRef),
  };
}

async function claimNext(
  pool: DbPool,
  config: RabbiReplyWorkerConfig,
  providerMode: 'synthetic' | 'provider',
  now: Date,
) {
  return inTransaction(pool, async (client) => {
    const row = await selectClaimable(client, config, providerMode, now);
    if (!row) return null;
    const generation = Number(row.lease_generation) + 1;
    const claimed = await client.query(
      `UPDATE onetime.rabbi_parent_reply_outbox
          SET state = 'leased',
              attempts = attempts + 1,
              lease_owner = $2,
              lease_generation = $3,
              lease_expires_at = $4,
              updated_at = $5
        WHERE delivery_key = $1
          AND (
            (state IN ('confirmed', 'retry') AND next_attempt_at <= $5)
            OR (state = 'leased' AND lease_expires_at <= $5)
          )`,
      [
        row.delivery_key,
        config.ownerId,
        generation,
        new Date(now.getTime() + config.rowLeaseMs).toISOString(),
        now.toISOString(),
      ],
    );
    if (!claimed.rowCount) return null;
    return {
      ...row,
      attempts: Number(row.attempts) + 1,
      max_attempts: Number(row.max_attempts),
      lease_generation: generation,
    } as ClaimedReply;
  });
}

async function selectClaimable(
  client: Queryable,
  config: RabbiReplyWorkerConfig,
  providerMode: 'synthetic' | 'provider',
  now: Date,
) {
  const query = `SELECT outbox.*, conversation.channel,
                        conversation.provider_conversation_ciphertext,
                        conversation.provider_conversation_digest
                   FROM onetime.rabbi_parent_reply_outbox AS outbox
                   JOIN onetime.rabbi_parent_conversations AS conversation
                     ON conversation.conversation_key = outbox.conversation_key
                  WHERE outbox.bot_key = $1
                    AND outbox.environment = $2
                    AND outbox.provider_mode = $3
                    AND (
                      (
                        outbox.state IN ('confirmed', 'retry')
                        AND outbox.next_attempt_at <= $4
                      )
                      OR (
                        outbox.state = 'leased'
                        AND outbox.lease_expires_at <= $4
                      )
                    )
                  ORDER BY outbox.created_at, outbox.delivery_key
                  LIMIT 1
                  FOR UPDATE SKIP LOCKED`;
  const params = [config.botKey, config.environment, providerMode, now.toISOString()];
  try {
    const result = await client.query(query, params);
    return result.rows[0] ?? null;
  } catch (error) {
    if (error instanceof Error && error.message.includes('SKIP LOCKED')) {
      const result = await client.query(query.replace(' FOR UPDATE SKIP LOCKED', ''), params);
      return result.rows[0] ?? null;
    }
    throw error;
  }
}

function safeErrorCode(error: unknown) {
  const message = error instanceof Error ? `${error.name}:${error.message}` : 'unknown';
  return `rabbi_${digest(message).slice(0, 20)}`;
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
