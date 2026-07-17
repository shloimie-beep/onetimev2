import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AppConfig } from '../../../config/src/index.ts';
import type {
  WhatsAppCompiledIntent,
  WhatsAppConversationState,
  WhatsAppInboundMessage,
  WhatsAppInboundStatus,
  WhatsAppMessageKind,
  WhatsAppProviderAdapter,
  WhatsAppProviderWebhookEvent,
} from '../../../contracts/src/index.ts';
import { inTransaction, type DbPool, type Queryable } from '../../../db/src/index.ts';
import type { AuthenticatedSession } from '../auth/service.ts';
import { stableKey } from '../lead/normalize.ts';
import { consumeRateLimitBudgets } from '../security/rate-limit.ts';
import { WHATSAPP_ASSISTANT_COPY } from './copy.ts';
import {
  decryptForWhatsApp,
  digestBuffer,
  digestJson,
  digestText,
  encryptForWhatsApp,
  normalizeWhatsAppE164,
  whatsappProviderRefHash,
  whatsappRecipientKey,
  whatsappSenderKey,
  whatsappTokenHash,
} from './crypto.ts';
import { compileWhatsAppIntent } from './intent.ts';
import { answerPublicProgramQuestion } from './public-facts.ts';
import {
  MetaWhatsAppCloudAdapter,
  SinkWhatsAppProviderAdapter,
  WhatsAppProviderSendError,
} from './provider.ts';

const OFFER_VERSION = 'free-until-rosh-hashanah-2026';
const CONTENT_VERSION = 'landing-v1-2026-07-14';
const REACTIVE_CONSENT_POLICY = 'ot85-whatsapp-reactive-v1-2026-07-15';
const FAMILY_REMINDER_CONSENT_POLICY = 'ot85-whatsapp-family-reminders-v1-2026-07-15';
const LINK_TTL_MS = 10 * 60 * 1000;
const GRANT_TTL_MS = 15 * 60 * 1000;

export type WhatsAppWebhookDisposition = {
  ok: boolean;
  status: number;
  code: string;
  accepted: number;
  duplicates: number;
  processed: number;
};

export type WhatsAppPublicAssistantStatus = {
  success: true;
  availability: 'available' | 'provider_off' | 'unavailable';
  assistant: {
    display_name: string;
    copy_version: string;
    opening_question: string;
    signup_path: string;
  };
  deep_link: {
    available: boolean;
    href: string | null;
    reason: string | null;
  };
  provider: {
    webhook_configured: boolean;
    verify_token_configured: boolean;
    provider_env: string;
    staging_isolated: boolean;
    canary_authorized: boolean;
    canary_recipient_configured: boolean;
    send_mode: 'provider_off' | 'staging_canary_ready' | 'staging_canary_blocked';
    blockers: string[];
  };
  safety: {
    no_broad_send_authorized: true;
    no_provider_registration_performed: true;
    support_ticket_requires_authenticated_entitlement: true;
    private_data_available_in_public_assistant: false;
    raw_canary_value_returned: false;
  };
};

type ConversationRow = {
  conversation_key: string;
  provider_account_key: string;
  sender_key: string;
  sender_e164_ciphertext: string;
  sender_e164_iv: string;
  sender_e164_tag: string;
  state: WhatsAppConversationState;
  audience_type: 'family' | 'school' | null;
  contact_key: string | null;
  signup_key: string | null;
  suppression_state: 'active' | 'suppressed';
  draft: Record<string, unknown>;
};

type InboxRow = {
  event_key: string;
  conversation_key: string;
  provider_account_key: string;
  sender_key: string;
  message_ciphertext: string;
  message_iv: string;
  message_tag: string;
  processing_attempts: number;
};

export function verifyWhatsAppWebhookChallenge(config: AppConfig, query: Record<string, unknown>) {
  const mode = String(query['hub.mode'] ?? '');
  const token = String(query['hub.verify_token'] ?? '');
  const challenge = String(query['hub.challenge'] ?? '');
  if (!config.whatsappVerifyToken || mode !== 'subscribe' || token !== config.whatsappVerifyToken) {
    return null;
  }
  return challenge;
}

export function buildWhatsAppPublicAssistantStatus(
  config: AppConfig,
): WhatsAppPublicAssistantStatus {
  const deepLink = buildPublicDeepLink(config);
  const canary = evaluateWhatsAppCanaryReadinessSafe(config);
  const providerOff = !config.whatsappWebhookSecret || !config.whatsappVerifyToken;
  return {
    success: true,
    availability: deepLink.available ? 'available' : providerOff ? 'provider_off' : 'unavailable',
    assistant: {
      display_name: WHATSAPP_ASSISTANT_COPY.displayName,
      copy_version: config.whatsappAssistantCopyVersion,
      opening_question: WHATSAPP_ASSISTANT_COPY.openingQuestion,
      signup_path: '/signup',
    },
    deep_link: deepLink,
    provider: {
      webhook_configured: Boolean(config.whatsappWebhookSecret),
      verify_token_configured: Boolean(config.whatsappVerifyToken),
      provider_env: config.whatsappProviderEnv,
      staging_isolated: config.whatsappStagingIsolated,
      canary_authorized: config.whatsappCanaryAuthorized,
      canary_recipient_configured: Boolean(config.whatsappCanaryRecipientE164),
      send_mode:
        canary.checkpoint === 'READY_FOR_CANARY'
          ? 'staging_canary_ready'
          : providerOff
            ? 'provider_off'
            : 'staging_canary_blocked',
      blockers: canary.blockers,
    },
    safety: {
      no_broad_send_authorized: true,
      no_provider_registration_performed: true,
      support_ticket_requires_authenticated_entitlement: true,
      private_data_available_in_public_assistant: false,
      raw_canary_value_returned: false,
    },
  };
}

export async function receiveWhatsAppWebhook(input: {
  pool: DbPool;
  config: AppConfig;
  rawBody: Buffer | unknown;
  signatureHeader?: string | undefined;
  adapter?: WhatsAppProviderAdapter | undefined;
  now?: Date | undefined;
}): Promise<WhatsAppWebhookDisposition> {
  if (!Buffer.isBuffer(input.rawBody)) {
    return disposition(false, 400, 'parsed_body_misuse');
  }

  const adapter = input.adapter ?? new MetaWhatsAppCloudAdapter();
  if (
    !adapter.verifyWebhook({
      rawBody: input.rawBody,
      signatureHeader: input.signatureHeader,
      secret: input.config.whatsappWebhookSecret,
    })
  ) {
    return disposition(false, 403, 'invalid_signature');
  }

  let parsed;
  try {
    parsed = adapter.parseWebhook({
      rawBody: input.rawBody,
      providerAccountKey: input.config.whatsappProviderAccountKey,
    });
  } catch {
    return disposition(false, 400, 'invalid_payload');
  }

  const durable = await ingestWhatsAppProviderEvents({
    pool: input.pool,
    config: input.config,
    rawBody: input.rawBody,
    events: parsed.events,
    providerAccountKey: parsed.providerAccountKey,
    now: input.now ?? new Date(),
  });

  let processed = 0;
  try {
    const summary = await processPendingWhatsAppInbox({
      pool: input.pool,
      config: input.config,
      limit: durable.accepted,
      now: input.now,
    });
    processed = summary.processed;
  } catch {
    processed = 0;
  }

  return {
    ok: true,
    status: 200,
    code: 'accepted',
    accepted: durable.accepted,
    duplicates: durable.duplicates,
    processed,
  };
}

export async function ingestWhatsAppProviderEvents(input: {
  pool: DbPool;
  config: AppConfig;
  rawBody: Buffer;
  events: WhatsAppProviderWebhookEvent[];
  providerAccountKey: string;
  now: Date;
}) {
  let accepted = 0;
  let duplicates = 0;
  for (const event of input.events) {
    if (event.kind === 'status') {
      await ingestStatusEvent(input.pool, input.config, input.providerAccountKey, event, input.now);
      continue;
    }
    const inserted = await ingestInboundMessage({
      ...input,
      message: event,
    });
    if (inserted) accepted += 1;
    else duplicates += 1;
  }
  return { accepted, duplicates };
}

export async function processPendingWhatsAppInbox(input: {
  pool: DbPool;
  config: AppConfig;
  limit?: number | undefined;
  now?: Date | undefined;
}) {
  const result = await input.pool.query(
    `SELECT event_key
       FROM onetime.whatsapp_inbox_events
      WHERE account_key = $1
        AND product_key = $2
        AND status IN ('durable', 'processing_failed')
      ORDER BY received_at ASC, event_key ASC
      LIMIT $3`,
    [input.config.accountKey, input.config.productKey, input.limit ?? 25],
  );
  let processed = 0;
  let failed = 0;
  for (const row of result.rows) {
    try {
      await processInboxEvent(
        input.pool,
        input.config,
        String(row.event_key),
        input.now ?? new Date(),
      );
      processed += 1;
    } catch (error) {
      await markInboxFailure(input.pool, input.config, String(row.event_key), error);
      failed += 1;
    }
  }
  return { processed, failed };
}

export async function processQueuedWhatsAppOutbox(input: {
  pool: DbPool;
  config: AppConfig;
  adapter?: WhatsAppProviderAdapter | undefined;
  now?: Date | undefined;
  limit?: number | undefined;
  leaseOwner?: string | undefined;
  leaseMs?: number | undefined;
  maxAttempts?: number | undefined;
  canaryOnly?: boolean | undefined;
}) {
  const now = input.now ?? new Date();
  const leaseOwner = input.leaseOwner ?? `wa_worker_${randomUUID()}`;
  const maxAttempts = input.maxAttempts ?? 3;
  const rows = await claimQueuedWhatsAppOutbox({
    pool: input.pool,
    config: input.config,
    now,
    limit: input.canaryOnly ? 1 : (input.limit ?? 25),
    leaseOwner,
    leaseExpiresAt: new Date(now.getTime() + (input.leaseMs ?? 120_000)),
    canaryOnly: Boolean(input.canaryOnly),
  });
  let sent = 0;
  let suppressed = 0;
  let retried = 0;
  let deadLettered = 0;
  let leaseLost = 0;
  const adapter = input.adapter ?? new SinkWhatsAppProviderAdapter();

  for (const row of rows) {
    const outboxKey = String(row.outbox_message_key);
    const leaseGeneration = Number(row.lease_generation ?? 0);
    if (!suppressionBypass(row.message_kind)) {
      const suppression = await input.pool.query(
        `SELECT 1
           FROM onetime.whatsapp_suppressions AS suppressions
           JOIN onetime.whatsapp_conversations AS conversations
             ON conversations.account_key = suppressions.account_key
            AND conversations.product_key = suppressions.product_key
            AND conversations.provider_account_key = suppressions.provider_account_key
            AND conversations.sender_key = suppressions.sender_key
          WHERE suppressions.account_key = $1
            AND suppressions.product_key = $2
            AND suppressions.provider_account_key = $3
            AND conversations.conversation_key = $4
            AND suppressions.status = 'active'
          LIMIT 1`,
        [
          input.config.accountKey,
          input.config.productKey,
          String(row.provider_account_key),
          String(row.conversation_key),
        ],
      );
      if (suppression.rowCount) {
        const completed = await setOutboxSuppressed(
          input.pool,
          input.config,
          outboxKey,
          'active_suppression',
          { owner: leaseOwner, generation: leaseGeneration },
        );
        if (completed) suppressed += 1;
        else leaseLost += 1;
        continue;
      }
    }

    if (input.canaryOnly) {
      const canaryBudgetClaimed = await claimWhatsAppCanaryBudget(input.pool, input.config, {
        providerAccountKey: String(row.provider_account_key),
        recipientKey: String(row.recipient_key),
        now,
      });
      if (!canaryBudgetClaimed) {
        const completed = await setOutboxDeadLettered(
          input.pool,
          input.config,
          outboxKey,
          new WhatsAppProviderSendError('meta_whatsapp_canary_budget_not_claimed', {
            retryable: false,
          }),
          { owner: leaseOwner, generation: leaseGeneration },
        );
        if (completed) deadLettered += 1;
        else leaseLost += 1;
        continue;
      }
    }

    try {
      const body = decryptForWhatsApp(input.config, {
        ciphertext: String(row.body_ciphertext),
        iv: String(row.body_iv),
        tag: String(row.body_tag),
      });
      const toE164 = decryptForWhatsApp(input.config, {
        ciphertext: String(row.recipient_e164_ciphertext),
        iv: String(row.recipient_e164_iv),
        tag: String(row.recipient_e164_tag),
      });
      const receipt = await adapter.sendMessage({
        idempotencyKey: String(row.idempotency_key),
        toE164,
        text: body,
        kind: row.message_kind as WhatsAppMessageKind,
        metadata: {
          outbox_message_key: outboxKey,
          conversation_key: String(row.conversation_key),
          provider_account_key: String(row.provider_account_key),
          last_inbound_at: dateIso(row.last_inbound_at),
          canary: Boolean(row.canary),
        },
      });
      const providerHash = receipt.providerMessageId
        ? whatsappProviderRefHash(
            input.config,
            String(row.provider_account_key),
            receipt.providerMessageId,
          )
        : null;
      const encryptedProviderRef = receipt.providerMessageId
        ? encryptForWhatsApp(input.config, receipt.providerMessageId)
        : null;
      const completed = await setOutboxSent(input.pool, input.config, {
        outboxMessageKey: outboxKey,
        leaseOwner,
        leaseGeneration,
        status: receipt.sink ? 'sink_delivered' : 'sent',
        providerHash,
        encryptedProviderRef,
        providerResponseStatus: receipt.sink ? null : 200,
        sentAt: receipt.acceptedAt,
      });
      if (!completed) {
        leaseLost += 1;
        continue;
      }
      await insertDeliveryEvent(input.pool, input.config, {
        outboxMessageKey: outboxKey,
        status: receipt.sink ? 'accepted' : 'sent',
        providerEventRefHash: providerHash,
        providerResponseStatus: receipt.sink ? undefined : 200,
        metadata: { provider: receipt.provider, sink: receipt.sink },
      });
      sent += 1;
    } catch (error) {
      const attempts = Number(row.attempts ?? 1);
      if (shouldDeadLetterWhatsApp(error, attempts, maxAttempts)) {
        const completed = await setOutboxDeadLettered(input.pool, input.config, outboxKey, error, {
          owner: leaseOwner,
          generation: leaseGeneration,
        });
        if (completed) deadLettered += 1;
        else leaseLost += 1;
      } else {
        const completed = await setOutboxRetryWait(input.pool, input.config, {
          outboxMessageKey: outboxKey,
          leaseOwner,
          leaseGeneration,
          nextAttemptAt: nextWhatsAppRetryAt(error, now, attempts, outboxKey),
          retryAfterMs: error instanceof WhatsAppProviderSendError ? error.retryAfterMs : undefined,
        });
        if (completed) retried += 1;
        else leaseLost += 1;
      }
    }
  }

  return { claimed: rows.length, sent, suppressed, retried, deadLettered, leaseLost };
}

async function claimWhatsAppCanaryBudget(
  pool: DbPool,
  config: AppConfig,
  input: { providerAccountKey: string; recipientKey: string; now: Date },
) {
  const result = await pool.query(
    `UPDATE onetime.whatsapp_canary_budget
        SET status = 'consumed',
            consumed_at = $5
      WHERE account_key = $1
        AND product_key = $2
        AND provider_account_key = $3
        AND recipient_key = $4
        AND purpose = 'ot85_staging_canary'
        AND status = 'available'
        AND NOT EXISTS (
          SELECT 1
            FROM onetime.whatsapp_canary_budget AS consumed
           WHERE consumed.account_key = $1
             AND consumed.product_key = $2
             AND consumed.purpose = 'ot85_staging_canary'
             AND consumed.status = 'consumed'
        )
      RETURNING budget_key`,
    [
      config.accountKey,
      config.productKey,
      input.providerAccountKey,
      input.recipientKey,
      input.now.toISOString(),
    ],
  );
  return Boolean(result.rowCount);
}

async function claimQueuedWhatsAppOutbox(input: {
  pool: DbPool;
  config: AppConfig;
  now: Date;
  limit: number;
  leaseOwner: string;
  leaseExpiresAt: Date;
  canaryOnly: boolean;
}) {
  return inTransaction(input.pool, async (client) => {
    const nowIso = input.now.toISOString();
    const candidates = await client.query(
      `SELECT outbox_message_key
         FROM onetime.whatsapp_outbox_messages
        WHERE account_key = $1
          AND product_key = $2
          ${input.canaryOnly ? 'AND canary = true' : ''}
          AND (
            (status IN ('queued', 'retry_wait') AND next_attempt_at <= $3)
            OR (status = 'sending' AND (lease_expires_at IS NULL OR lease_expires_at <= $3))
          )
        ORDER BY created_at ASC, outbox_message_key ASC
        LIMIT $4`,
      [input.config.accountKey, input.config.productKey, nowIso, input.limit],
    );
    const keys = candidates.rows.map((row) => String(row.outbox_message_key));
    if (keys.length === 0) return [] as Record<string, unknown>[];
    const keyPlaceholders = keys.map((_, index) => `$${index + 4}`).join(', ');
    const values: unknown[] = [input.config.accountKey, input.config.productKey, nowIso, ...keys];
    const leaseOwnerIndex = values.push(input.leaseOwner);
    const leaseExpiresIndex = values.push(input.leaseExpiresAt.toISOString());
    const claimed = await client.query(
      `UPDATE onetime.whatsapp_outbox_messages
          SET status = 'sending',
              lease_owner = $${leaseOwnerIndex},
              lease_expires_at = $${leaseExpiresIndex},
              lease_generation = lease_generation + 1,
              attempts = attempts + 1,
              provider_retry_after_ms = NULL
        WHERE account_key = $1
          AND product_key = $2
          ${input.canaryOnly ? 'AND canary = true' : ''}
          AND outbox_message_key IN (${keyPlaceholders})
          AND (
            (status IN ('queued', 'retry_wait') AND next_attempt_at <= $3)
            OR (status = 'sending' AND (lease_expires_at IS NULL OR lease_expires_at <= $3))
          )
        RETURNING *`,
      values,
    );
    if (claimed.rows.length === 0) return [];
    const claimedKeys = claimed.rows.map((row) => String(row.outbox_message_key));
    const joinPlaceholders = claimedKeys.map((_, index) => `$${index + 3}`).join(', ');
    const joined = await client.query(
      `SELECT outbox.outbox_message_key, conversations.last_inbound_at
         FROM onetime.whatsapp_outbox_messages AS outbox
         JOIN onetime.whatsapp_conversations AS conversations
           ON conversations.account_key = outbox.account_key
          AND conversations.product_key = outbox.product_key
          AND conversations.conversation_key = outbox.conversation_key
        WHERE outbox.account_key = $1
          AND outbox.product_key = $2
          AND outbox.outbox_message_key IN (${joinPlaceholders})`,
      [input.config.accountKey, input.config.productKey, ...claimedKeys],
    );
    const inboundByKey = new Map(
      joined.rows.map((row) => [String(row.outbox_message_key), row.last_inbound_at]),
    );
    return claimed.rows.map((row) => ({
      ...row,
      last_inbound_at: inboundByKey.get(String(row.outbox_message_key)) ?? null,
    }));
  });
}

export async function consumeWhatsAppAccountLink(input: {
  pool: DbPool;
  config: AppConfig;
  session: AuthenticatedSession;
  linkToken: string;
  householdKey: string;
  now?: Date | undefined;
}) {
  const now = input.now ?? new Date();
  const tokenHash = whatsappTokenHash(input.config, input.linkToken);
  return inTransaction(input.pool, async (client) => {
    const request = await client.query(
      `SELECT requests.*, conversations.sender_e164_ciphertext, conversations.sender_e164_iv,
              conversations.sender_e164_tag, conversations.provider_account_key
         FROM onetime.whatsapp_account_link_requests AS requests
         JOIN onetime.whatsapp_conversations AS conversations
           ON conversations.conversation_key = requests.conversation_key
        WHERE requests.account_key = $1
          AND requests.product_key = $2
          AND requests.token_hash = $3
          AND requests.status = 'pending'
          AND requests.expires_at > $4
        FOR UPDATE`,
      [input.config.accountKey, input.config.productKey, tokenHash, now.toISOString()],
    );
    const row = request.rows[0] as Record<string, unknown> | undefined;
    if (!row) return accountLinkResult(false, 'LINK_NOT_FOUND_OR_EXPIRED');

    const authorized = await client.query(
      `SELECT 1
         FROM onetime.portal_guardian_relationships AS relationships
         JOIN onetime.portal_households AS households
           ON households.account_key = relationships.account_key
          AND households.product_key = relationships.product_key
          AND households.household_key = relationships.household_key
        WHERE relationships.account_key = $1
          AND relationships.product_key = $2
          AND relationships.household_key = $3
          AND relationships.guardian_user_ref = $4
          AND relationships.status = 'active'
          AND relationships.authority IN ('primary_guardian', 'guardian')
          AND households.status = 'active'
        LIMIT 1`,
      [
        input.config.accountKey,
        input.config.productKey,
        input.householdKey,
        input.session.user.user_key,
      ],
    );
    if (!authorized.rowCount) return accountLinkResult(false, 'HOUSEHOLD_NOT_AUTHORIZED');

    const grantKey = `wa_grant_${randomUUID()}`;
    const expiresAt = new Date(now.getTime() + GRANT_TTL_MS);
    await client.query(
      `UPDATE onetime.whatsapp_account_link_requests
          SET status = 'consumed',
              consumed_at = $4,
              consumed_by_user_key = $5,
              consumed_household_key = $6
        WHERE account_key = $1
          AND product_key = $2
          AND request_key = $3`,
      [
        input.config.accountKey,
        input.config.productKey,
        String(row.request_key),
        now.toISOString(),
        input.session.user.user_key,
        input.householdKey,
      ],
    );
    await client.query(
      `INSERT INTO onetime.whatsapp_verified_grants
       (grant_key, account_key, product_key, conversation_key, sender_key, user_key,
        household_key, purpose, grant_scope, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'safe_account_status','safe_status_only',$8)`,
      [
        grantKey,
        input.config.accountKey,
        input.config.productKey,
        String(row.conversation_key),
        String(row.sender_key),
        input.session.user.user_key,
        input.householdKey,
        expiresAt.toISOString(),
      ],
    );
    await client.query(
      `UPDATE onetime.whatsapp_conversations
          SET state = 'ACCOUNT_LINKED',
              verified_household_key = $4,
              verified_user_key = $5,
              verified_until = $6,
              updated_at = now()
        WHERE account_key = $1
          AND product_key = $2
          AND conversation_key = $3`,
      [
        input.config.accountKey,
        input.config.productKey,
        String(row.conversation_key),
        input.householdKey,
        input.session.user.user_key,
        expiresAt.toISOString(),
      ],
    );
    const e164 = decryptForWhatsApp(input.config, {
      ciphertext: String(row.sender_e164_ciphertext),
      iv: String(row.sender_e164_iv),
      tag: String(row.sender_e164_tag),
    });
    await enqueueWhatsAppMessage(client, input.config, {
      conversationKey: String(row.conversation_key),
      providerAccountKey: String(row.provider_account_key),
      recipientE164: e164,
      messageKind: 'ACCOUNT_LINK_CONFIRMED',
      body: 'This WhatsApp chat is verified for a short safe-status check only. Private account, student, class-link, billing, and support-ticket details stay inside the signed-in portal.',
      idempotencyKey: stableKey('wa_outbox', [String(row.request_key), 'account-link-confirmed']),
    });

    return {
      ...accountLinkResult(true, 'LINK_CONSUMED'),
      grant_key: grantKey,
      expires_at: expiresAt.toISOString(),
    };
  });
}

export function evaluateWhatsAppCanaryReadiness(config: AppConfig) {
  if (!config.whatsappCanaryRecipientE164) {
    return { checkpoint: 'WAITING_FOR_WHATSAPP_CANARY_SECRET' as const };
  }
  if (
    !config.whatsappCanaryAuthorized ||
    config.whatsappProviderEnv !== 'STAGING' ||
    !config.whatsappStagingIsolated
  ) {
    return { checkpoint: 'BLOCKED_UNSAFE_PROVIDER_ENV' as const };
  }
  normalizeWhatsAppE164(config.whatsappCanaryRecipientE164);
  return { checkpoint: 'READY_FOR_CANARY' as const };
}

function evaluateWhatsAppCanaryReadinessSafe(config: AppConfig) {
  const blockers: string[] = [];
  if (!config.whatsappCanaryRecipientE164) blockers.push('canary_recipient_missing');
  if (!config.whatsappCanaryAuthorized) blockers.push('canary_authorization_missing');
  if (config.whatsappProviderEnv !== 'STAGING') blockers.push('provider_env_not_staging');
  if (!config.whatsappStagingIsolated) blockers.push('staging_isolation_not_confirmed');
  try {
    if (config.whatsappCanaryRecipientE164) {
      normalizeWhatsAppE164(config.whatsappCanaryRecipientE164);
    }
  } catch {
    blockers.push('canary_recipient_invalid');
  }
  return {
    checkpoint: blockers.length === 0 ? ('READY_FOR_CANARY' as const) : ('BLOCKED' as const),
    blockers,
  };
}

function buildPublicDeepLink(config: AppConfig): WhatsAppPublicAssistantStatus['deep_link'] {
  const configured = config.whatsappPublicDeepLink?.trim();
  if (!configured) {
    return { available: false, href: null, reason: 'WHATSAPP_PUBLIC_LINK_UNCONFIGURED' };
  }
  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    return { available: false, href: null, reason: 'WHATSAPP_PUBLIC_LINK_INVALID' };
  }
  const host = parsed.hostname.toLowerCase();
  const allowed = parsed.protocol === 'https:' && (host === 'wa.me' || host === 'api.whatsapp.com');
  if (!allowed) {
    return { available: false, href: null, reason: 'WHATSAPP_PUBLIC_LINK_UNSAFE_HOST' };
  }
  const prefill =
    config.whatsappPublicPrefillText?.trim() || WHATSAPP_ASSISTANT_COPY.defaultPrefill;
  parsed.searchParams.set('text', prefill);
  return { available: true, href: parsed.toString(), reason: null };
}

async function ingestInboundMessage(input: {
  pool: DbPool;
  config: AppConfig;
  rawBody: Buffer;
  providerAccountKey: string;
  message: WhatsAppInboundMessage;
  now: Date;
}) {
  const e164 = normalizeWhatsAppE164(input.message.senderE164);
  const senderKey = whatsappSenderKey(input.config, input.providerAccountKey, e164);
  const providerHash = whatsappProviderRefHash(
    input.config,
    input.providerAccountKey,
    input.message.providerMessageId,
  );
  const eventKey = stableKey('wa_inbox', [
    input.config.accountKey,
    input.config.productKey,
    input.providerAccountKey,
    providerHash,
  ]);
  const encryptedSender = encryptForWhatsApp(input.config, e164);
  const encryptedMessage = encryptForWhatsApp(input.config, input.message.text);
  const rawDigest = digestBuffer(input.rawBody);
  const payloadDigest = digestJson({
    id_hash: providerHash,
    sender_key: senderKey,
    text_digest: digestText(input.message.text),
  });

  return inTransaction(input.pool, async (client) => {
    const conversation = await upsertConversation(client, input.config, {
      providerAccountKey: input.providerAccountKey,
      senderKey,
      encryptedSender,
      now: input.now,
    });
    const duplicate = await client.query(
      `SELECT event_key
         FROM onetime.whatsapp_inbox_events
        WHERE account_key = $1
          AND product_key = $2
          AND provider_account_key = $3
          AND provider_message_ref_hash = $4
        LIMIT 1`,
      [input.config.accountKey, input.config.productKey, input.providerAccountKey, providerHash],
    );
    if (duplicate.rowCount) return false;
    const inserted = await client.query(
      `INSERT INTO onetime.whatsapp_inbox_events
       (event_key, account_key, product_key, provider_account_key, conversation_key,
        provider_message_ref_hash, sender_key, raw_body_digest, payload_digest,
        message_ciphertext, message_iv, message_tag, provider_timestamp, metadata, received_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15)
       ON CONFLICT (account_key, product_key, provider_account_key, provider_message_ref_hash)
       DO NOTHING
       RETURNING event_key`,
      [
        eventKey,
        input.config.accountKey,
        input.config.productKey,
        input.providerAccountKey,
        conversation.conversation_key,
        providerHash,
        senderKey,
        rawDigest,
        payloadDigest,
        encryptedMessage.ciphertext,
        encryptedMessage.iv,
        encryptedMessage.tag,
        input.message.timestamp?.toISOString() ?? null,
        JSON.stringify({
          text_length: input.message.text.length,
          raw_provider_id_present: false,
          raw_sender_present: false,
        }),
        input.now.toISOString(),
      ],
    );
    return Boolean(inserted.rowCount);
  });
}

async function ingestStatusEvent(
  pool: DbPool,
  config: AppConfig,
  providerAccountKey: string,
  status: WhatsAppInboundStatus,
  now: Date,
) {
  const providerHash = whatsappProviderRefHash(
    config,
    providerAccountKey,
    status.providerMessageId,
  );
  const existing = await pool.query(
    `SELECT outbox_message_key
       FROM onetime.whatsapp_outbox_messages
      WHERE account_key = $1
        AND product_key = $2
        AND provider_account_key = $3
        AND provider_message_ref_hash = $4
      LIMIT 1`,
    [config.accountKey, config.productKey, providerAccountKey, providerHash],
  );
  const outboxKey = existing.rows[0]?.outbox_message_key
    ? String(existing.rows[0].outbox_message_key)
    : null;
  const providerStatusEventKey = stableKey('wa_delivery_status', [
    config.accountKey,
    config.productKey,
    providerAccountKey,
    providerHash,
    status.status,
    status.timestamp?.toISOString() ?? 'no-provider-timestamp',
  ]);
  const inserted = await insertDeliveryEvent(pool, config, {
    deliveryEventKey: providerStatusEventKey,
    outboxMessageKey: outboxKey,
    status: status.status,
    providerEventRefHash: providerHash,
    failureCode: status.failureCode,
    metadata: {
      recipient_key: status.recipientE164
        ? whatsappRecipientKey(
            config,
            providerAccountKey,
            normalizeWhatsAppE164(status.recipientE164),
          )
        : null,
    },
    occurredAt: status.timestamp ?? now,
  });
  if (inserted && outboxKey && status.status === 'failed') {
    await pool.query(
      `UPDATE onetime.whatsapp_outbox_messages
          SET status = 'dead_lettered',
              provider_retry_after_ms = NULL
        WHERE account_key = $1
          AND product_key = $2
          AND outbox_message_key = $3
          AND status IN ('sent', 'sending', 'retry_wait')`,
      [config.accountKey, config.productKey, outboxKey],
    );
  }
}

async function processInboxEvent(pool: DbPool, config: AppConfig, eventKey: string, now: Date) {
  return inTransaction(pool, async (client) => {
    const inbox = await client.query(
      `SELECT *
         FROM onetime.whatsapp_inbox_events
        WHERE account_key = $1
          AND product_key = $2
          AND event_key = $3
          AND status IN ('durable', 'processing_failed')
        FOR UPDATE`,
      [config.accountKey, config.productKey, eventKey],
    );
    const inboxRow = inbox.rows[0] as Record<string, unknown> | undefined;
    if (!inboxRow) return;
    const event = mapInboxRow(inboxRow);
    const conversation = await loadConversation(client, config, event.conversation_key);
    const text = decryptForWhatsApp(config, {
      ciphertext: event.message_ciphertext,
      iv: event.message_iv,
      tag: event.message_tag,
    });
    const e164 = decryptForWhatsApp(config, {
      ciphertext: conversation.sender_e164_ciphertext,
      iv: conversation.sender_e164_iv,
      tag: conversation.sender_e164_tag,
    });
    const expected = expectedIntentContext(conversation.state);
    const intent = compileWhatsAppIntent(text, expected ? { expected } : {});

    await routeIntent(client, config, { conversation, event, intent, text, e164, now });
    await client.query(
      `UPDATE onetime.whatsapp_inbox_events
          SET status = 'processed',
              processing_attempts = processing_attempts + 1,
              processed_at = $4,
              failure_code = NULL
        WHERE account_key = $1
          AND product_key = $2
          AND event_key = $3`,
      [config.accountKey, config.productKey, eventKey, now.toISOString()],
    );
  });
}

async function routeIntent(
  client: Queryable,
  config: AppConfig,
  input: {
    conversation: ConversationRow;
    event: InboxRow;
    intent: WhatsAppCompiledIntent;
    text: string;
    e164: string;
    now: Date;
  },
) {
  const suppression = await activeSuppression(client, config, input.conversation);
  if (input.intent.type === 'consent.stop') {
    await handleStop(client, config, input);
    return;
  }
  if (suppression && input.intent.type !== 'consent.start') {
    await enqueueWhatsAppMessage(client, config, {
      conversationKey: input.conversation.conversation_key,
      providerAccountKey: input.conversation.provider_account_key,
      recipientE164: input.e164,
      messageKind: 'SUPPRESSION_STATE_NOTICE',
      body: 'Messages are stopped for this WhatsApp number. Reply START if you want to resume this public assistant conversation.',
      idempotencyKey: stableKey('wa_outbox', [
        input.conversation.conversation_key,
        'suppression-notice',
        input.now.toISOString().slice(0, 10),
      ]),
    });
    await updateConversation(client, config, input.conversation.conversation_key, {
      state: 'SUPPRESSED',
      suppression_state: 'suppressed',
    });
    return;
  }
  if (input.intent.type === 'consent.start') {
    await handleStart(client, config, input);
    return;
  }

  const rateLimit = await consumeWhatsAppAssistantRateLimit(client, config, input);
  if (!rateLimit.allowed) {
    await enqueueWhatsAppMessage(client, config, {
      conversationKey: input.conversation.conversation_key,
      providerAccountKey: input.conversation.provider_account_key,
      recipientE164: input.e164,
      messageKind: 'UNKNOWN_FALLBACK',
      body: WHATSAPP_ASSISTANT_COPY.rateLimited,
      idempotencyKey: stableKey('wa_outbox', [input.event.event_key, 'rate-limited']),
      metadata: {
        rate_limited: true,
        limit_scope: rateLimit.scope ?? 'whatsapp_assistant',
        retry_after_seconds: rateLimit.retryAfterSeconds ?? null,
      },
    });
    return;
  }

  if (input.intent.type === 'abuse.detected') {
    await handleAbuseDetected(client, config, input);
    return;
  }

  if (input.intent.type === 'account.technical_help_request') {
    await enqueueStandard(client, config, input, 'TECHNICAL_HELP_REDIRECT');
    return;
  }
  if (input.intent.type === 'account.private_data_request') {
    await enqueueStandard(client, config, input, 'PRIVATE_DATA_BLOCKED');
    return;
  }
  if (
    input.intent.type === 'account.link_request' ||
    input.intent.type === 'account.safe_status_request'
  ) {
    if (
      input.intent.type === 'account.safe_status_request' &&
      (await hasActiveGrant(client, config, input))
    ) {
      await enqueueStandard(client, config, input, 'SAFE_STATUS_RESPONSE');
      return;
    }
    await offerAccountLink(client, config, input);
    return;
  }
  if (input.intent.type === 'human.request') {
    await recordLeadEvent(client, config, input.conversation, {
      eventType: 'human_handoff_requested',
      audienceType: input.conversation.audience_type ?? 'family',
      metadata: { source_inbox_event_key: input.event.event_key },
    });
    await enqueueStandard(client, config, input, 'HUMAN_HANDOFF_ACK');
    await updateConversation(client, config, input.conversation.conversation_key, {
      state: 'HUMAN_HANDOFF_PENDING',
    });
    return;
  }
  if (input.intent.type === 'program.question') {
    const fact = answerPublicProgramQuestion(input.text);
    await enqueueWhatsAppMessage(client, config, {
      conversationKey: input.conversation.conversation_key,
      providerAccountKey: input.conversation.provider_account_key,
      recipientE164: input.e164,
      messageKind: fact ? 'PUBLIC_PROGRAM_ANSWER' : 'UNKNOWN_FALLBACK',
      body:
        fact?.answer ??
        'I do not have an approved public answer for that. I can collect Family or School interest, or request a human follow-up.',
      idempotencyKey: stableKey('wa_outbox', [input.event.event_key, fact?.factKey ?? 'unknown']),
      metadata: fact ? { fact_key: fact.factKey, source: fact.source } : {},
    });
    return;
  }

  await routeLeadFlow(client, config, input);
}

async function routeLeadFlow(
  client: Queryable,
  config: AppConfig,
  input: {
    conversation: ConversationRow;
    event: InboxRow;
    intent: WhatsAppCompiledIntent;
    text: string;
    e164: string;
    now: Date;
  },
) {
  const draft = { ...input.conversation.draft };
  if (input.intent.type === 'conversation.greeting') {
    await enqueueStandard(client, config, input, 'QUALIFY_AUDIENCE');
    await updateConversation(client, config, input.conversation.conversation_key, {
      state: 'QUALIFY_AUDIENCE',
    });
    return;
  }
  if (input.intent.type === 'lead.family_interest') {
    await enqueueStandard(client, config, input, 'ASK_GUARDIAN_NAME');
    await updateConversation(client, config, input.conversation.conversation_key, {
      state: 'CAPTURE_GUARDIAN_NAME',
      audience_type: 'family',
      draft: { ...draft, audience_type: 'family' },
    });
    return;
  }
  if (input.intent.type === 'lead.school_interest') {
    const school = entity(input.intent, 'school_name');
    await enqueueStandard(client, config, input, 'ASK_SCHOOL_CONTACT_NAME');
    await updateConversation(client, config, input.conversation.conversation_key, {
      state: 'CAPTURE_SCHOOL_CONTACT_NAME',
      audience_type: 'school',
      draft: { ...draft, audience_type: 'school', ...(school ? { school_name: school } : {}) },
    });
    return;
  }
  if (
    input.conversation.state === 'CAPTURE_GUARDIAN_NAME' &&
    input.intent.type === 'lead.guardian_name'
  ) {
    await enqueueStandard(client, config, input, 'ASK_CONTACT_PREFERENCE');
    await updateConversation(client, config, input.conversation.conversation_key, {
      state: 'CAPTURE_CONTACT_PREFERENCE',
      audience_type: 'family',
      draft: { ...draft, guardian_name: entity(input.intent, 'person_name') ?? input.text.trim() },
    });
    return;
  }
  if (
    input.conversation.state === 'CAPTURE_SCHOOL_CONTACT_NAME' &&
    input.intent.type === 'lead.school_contact_name'
  ) {
    await enqueueStandard(client, config, input, 'ASK_CONTACT_PREFERENCE');
    await updateConversation(client, config, input.conversation.conversation_key, {
      state: 'CAPTURE_CONTACT_PREFERENCE',
      audience_type: 'school',
      draft: {
        ...draft,
        school_contact_name: entity(input.intent, 'person_name') ?? input.text.trim(),
      },
    });
    return;
  }
  if (
    input.conversation.state === 'CAPTURE_CONTACT_PREFERENCE' &&
    input.intent.type === 'lead.contact_preference'
  ) {
    const contactPreference = entity(input.intent, 'contact_preference') ?? 'whatsapp';
    const nextDraft = { ...draft, contact_preference: contactPreference };
    if (input.conversation.audience_type === 'school' || draft.audience_type === 'school') {
      const persisted = await persistLead(client, config, input, 'school', nextDraft);
      await enqueueStandard(
        client,
        config,
        input,
        persisted.archived ? 'HUMAN_HANDOFF_ACK' : 'SCHOOL_LEAD_ACK',
      );
      await updateConversation(client, config, input.conversation.conversation_key, {
        state: persisted.archived ? 'HUMAN_HANDOFF_PENDING' : 'SCHOOL_PERSIST_PENDING',
        draft: nextDraft,
      });
      return;
    }
    await enqueueStandard(client, config, input, 'ASK_FAMILY_REMINDER_PREFERENCE');
    await updateConversation(client, config, input.conversation.conversation_key, {
      state: 'CAPTURE_FAMILY_REMINDER_PREFERENCE',
      audience_type: 'family',
      draft: nextDraft,
    });
    return;
  }
  if (
    input.conversation.state === 'CAPTURE_FAMILY_REMINDER_PREFERENCE' &&
    input.intent.type === 'lead.reminder_preference'
  ) {
    const reminderPreference = entity(input.intent, 'reminder_preference') ?? 'none';
    const nextDraft = { ...draft, reminder_preference: reminderPreference };
    await appendConsentEvent(client, config, input.conversation, {
      eventType: reminderPreference === 'whatsapp' ? 'granted' : 'declined',
      scope: 'family_reminders',
      policy: FAMILY_REMINDER_CONSENT_POLICY,
      sourceInboxEventKey: input.event.event_key,
    });
    const persisted = await persistLead(client, config, input, 'family', nextDraft);
    await enqueueStandard(
      client,
      config,
      input,
      persisted.archived ? 'HUMAN_HANDOFF_ACK' : 'FAMILY_LEAD_ACK',
    );
    await updateConversation(client, config, input.conversation.conversation_key, {
      state: persisted.archived ? 'HUMAN_HANDOFF_PENDING' : 'FAMILY_PERSIST_PENDING',
      draft: nextDraft,
    });
    return;
  }

  await enqueueStandard(client, config, input, 'UNKNOWN_FALLBACK');
}

async function persistLead(
  client: Queryable,
  config: AppConfig,
  input: {
    conversation: ConversationRow;
    event: InboxRow;
    e164: string;
  },
  audienceType: 'family' | 'school',
  draft: Record<string, unknown>,
) {
  const internalEmail = `whatsapp+${input.conversation.sender_key.slice(-20)}@onetime.invalid`;
  const archived = await client.query(
    `SELECT contact_key
       FROM onetime.contacts
      WHERE account_key = $1
        AND product_key = $2
        AND (
          email_normalized = $3
          OR phone_normalized = $4
        )
        AND (archived_at IS NOT NULL OR lead_status = 'archived')
      LIMIT 1
      FOR UPDATE`,
    [config.accountKey, config.productKey, internalEmail, input.e164],
  );
  if (archived.rowCount) {
    await recordLeadEvent(client, config, input.conversation, {
      eventType: 'archived_contact_reinquiry',
      audienceType,
      metadata: {
        source_inbox_event_key: input.event.event_key,
        archived_contact_key: String(archived.rows[0].contact_key),
        no_unarchive: true,
        human_review_required: true,
      },
    });
    return { contactKey: null, signupKey: null, archived: true };
  }

  const existing = await client.query(
    `SELECT contact_key
       FROM onetime.contacts
      WHERE account_key = $1
        AND product_key = $2
        AND email_normalized = $3
      LIMIT 1
      FOR UPDATE`,
    [config.accountKey, config.productKey, internalEmail],
  );
  const displayName =
    audienceType === 'family'
      ? String(draft.guardian_name ?? 'WhatsApp Family Lead').slice(0, 180)
      : String(draft.school_contact_name ?? 'WhatsApp School Lead').slice(0, 180);
  const contactKey = existing.rows[0]?.contact_key
    ? String(existing.rows[0].contact_key)
    : `contact_${randomUUID()}`;
  const reminderPreference =
    audienceType === 'family' && draft.reminder_preference === 'whatsapp' ? 'whatsapp' : 'none';
  const consented = reminderPreference === 'whatsapp';

  if (existing.rowCount) {
    await client.query(
      `UPDATE onetime.contacts
          SET display_name = $4,
              family_school_classification = $5,
              family_or_school = $6,
              location_text = 'WhatsApp inquiry',
              timezone = 'UTC',
              reminder_preference = $7,
              consent_policy_version = CASE WHEN $8 THEN $9 ELSE consent_policy_version END,
              consent_recorded_at = CASE WHEN $8 THEN COALESCE(consent_recorded_at, now()) ELSE consent_recorded_at END,
              source = 'one_time_whatsapp_assistant',
              offer_version = $10,
              content_version = $11,
              last_activity_at = now(),
              updated_at = now(),
              version = version + 1,
              identity_version = identity_version + 1
        WHERE account_key = $1
          AND product_key = $2
          AND contact_key = $3
          AND archived_at IS NULL
          AND lead_status <> 'archived'`,
      [
        config.accountKey,
        config.productKey,
        contactKey,
        displayName,
        audienceType,
        audienceType === 'family' ? `${displayName} Family` : 'WhatsApp School Inquiry',
        reminderPreference,
        consented,
        FAMILY_REMINDER_CONSENT_POLICY,
        OFFER_VERSION,
        CONTENT_VERSION,
      ],
    );
  } else {
    await client.query(
      `INSERT INTO onetime.contacts
       (contact_key, public_contact_id, account_key, product_key, display_name,
        family_school_classification, family_or_school, location_text, timezone,
        email_normalized, phone_normalized, reminder_preference, consent_policy_version,
        consent_recorded_at, suppression_state, source, offer_version, content_version,
        lead_status, internal_note, last_activity_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'WhatsApp inquiry','UTC',$8,NULL,$9,$10,
        CASE WHEN $11 THEN now() ELSE NULL END,'active','one_time_whatsapp_assistant',
        $12,$13,'new',$14,now())`,
      [
        contactKey,
        randomUUID(),
        config.accountKey,
        config.productKey,
        displayName,
        audienceType,
        audienceType === 'family' ? `${displayName} Family` : 'WhatsApp School Inquiry',
        internalEmail,
        reminderPreference,
        consented ? FAMILY_REMINDER_CONSENT_POLICY : null,
        consented,
        OFFER_VERSION,
        CONTENT_VERSION,
        'WhatsApp assistant lead. Raw sender and message content are encrypted in OT-85 WhatsApp tables.',
      ],
    );
  }

  const signupKey = stableKey('signup', [contactKey, OFFER_VERSION, CONTENT_VERSION, 'ot85']);
  await client.query(
    `INSERT INTO onetime.signup_leads
     (signup_key, contact_key, account_key, product_key, offer_version, content_version,
      classification, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
     ON CONFLICT (contact_key, offer_version, content_version) DO NOTHING`,
    [
      signupKey,
      contactKey,
      config.accountKey,
      config.productKey,
      OFFER_VERSION,
      CONTENT_VERSION,
      audienceType,
      JSON.stringify({
        source: 'one_time_whatsapp_assistant',
        contact_preference: safeString(draft.contact_preference),
        reminder_preference: reminderPreference,
        no_household_created: true,
        no_portal_created: true,
        no_class_access_created: true,
        no_class_link_sent: true,
        no_support_ticket_created: true,
      }),
    ],
  );
  await recordLeadEvent(client, config, input.conversation, {
    eventType: audienceType === 'family' ? 'family_lead_captured' : 'school_lead_captured',
    audienceType,
    contactKey,
    signupKey,
    metadata: {
      source_inbox_event_key: input.event.event_key,
      contact_preference: safeString(draft.contact_preference),
      reminder_preference: reminderPreference,
      no_private_data_exposed: true,
      school_lead_only: audienceType === 'school',
    },
  });
  await client.query(
    `INSERT INTO onetime.audit_events
     (event_key, account_key, product_key, contact_key, signup_key, event_type, metadata)
     VALUES ($1,$2,$3,$4,$5,'whatsapp_lead_captured',$6::jsonb)
     ON CONFLICT (event_key) DO NOTHING`,
    [
      stableKey('audit', [signupKey, 'whatsapp_lead_captured']),
      config.accountKey,
      config.productKey,
      contactKey,
      signupKey,
      JSON.stringify({
        source: 'one_time_whatsapp_assistant',
        audience_type: audienceType,
        no_access_grant: true,
        no_class_link: true,
      }),
    ],
  );
  await updateConversation(client, config, input.conversation.conversation_key, {
    contact_key: contactKey,
    signup_key: signupKey,
  });
  return { contactKey, signupKey, archived: false };
}

async function offerAccountLink(
  client: Queryable,
  config: AppConfig,
  input: {
    conversation: ConversationRow;
    event: InboxRow;
    e164: string;
    now: Date;
  },
) {
  const token = randomBytes(32).toString('base64url');
  const requestKey = `wa_link_${randomUUID()}`;
  const expiresAt = new Date(input.now.getTime() + LINK_TTL_MS);
  await client.query(
    `INSERT INTO onetime.whatsapp_account_link_requests
     (request_key, account_key, product_key, conversation_key, sender_key, token_hash,
      purpose, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,'safe_account_status',$7)`,
    [
      requestKey,
      config.accountKey,
      config.productKey,
      input.conversation.conversation_key,
      input.conversation.sender_key,
      whatsappTokenHash(config, token),
      expiresAt.toISOString(),
    ],
  );
  await enqueueWhatsAppMessage(client, config, {
    conversationKey: input.conversation.conversation_key,
    providerAccountKey: input.conversation.provider_account_key,
    recipientE164: input.e164,
    messageKind: 'ACCOUNT_LINK_OFFER',
    body: `For safety, WhatsApp cannot verify you from a phone number alone. Sign in to the portal and submit this one-time code within 10 minutes: ${token}`,
    idempotencyKey: stableKey('wa_outbox', [input.event.event_key, 'account-link-offer']),
    metadata: { raw_token_stored: false, expires_at: expiresAt.toISOString() },
  });
  await updateConversation(client, config, input.conversation.conversation_key, {
    state: 'ACCOUNT_LINK_OFFERED',
  });
}

async function consumeWhatsAppAssistantRateLimit(
  client: Queryable,
  config: AppConfig,
  input: {
    conversation: ConversationRow;
    now: Date;
  },
) {
  return consumeRateLimitBudgets({
    pool: client as DbPool,
    config,
    now: input.now,
    budgets: [
      {
        scope: 'whatsapp_assistant_sender',
        subject: `${input.conversation.provider_account_key}:${input.conversation.sender_key}`,
        limit: config.whatsappAssistantSenderRateLimitMax,
        windowMs: config.whatsappAssistantRateLimitWindowMs,
      },
      {
        scope: 'whatsapp_assistant_account',
        subject: input.conversation.provider_account_key,
        limit: config.whatsappAssistantAccountRateLimitMax,
        windowMs: config.whatsappAssistantRateLimitWindowMs,
      },
    ],
  });
}

async function handleAbuseDetected(
  client: Queryable,
  config: AppConfig,
  input: {
    conversation: ConversationRow;
    event: InboxRow;
    e164: string;
    now: Date;
  },
) {
  await recordLeadEvent(client, config, input.conversation, {
    eventType: 'human_handoff_requested',
    audienceType: input.conversation.audience_type ?? 'family',
    metadata: {
      reason: 'abuse_detected',
      source_inbox_event_key: input.event.event_key,
      raw_body_stored: false,
    },
  });
  await client.query(
    `INSERT INTO onetime.whatsapp_suppressions
     (suppression_key, account_key, product_key, provider_account_key, sender_key,
      conversation_key, reason, source_inbox_event_key)
     VALUES ($1,$2,$3,$4,$5,$6,'abuse',$7)
     ON CONFLICT DO NOTHING`,
    [
      `wa_suppression_${randomUUID()}`,
      config.accountKey,
      config.productKey,
      input.conversation.provider_account_key,
      input.conversation.sender_key,
      input.conversation.conversation_key,
      input.event.event_key,
    ],
  );
  await client.query(
    `UPDATE onetime.whatsapp_outbox_messages
        SET status = 'suppressed'
      WHERE account_key = $1
        AND product_key = $2
        AND conversation_key = $3
        AND status IN ('queued', 'retry_wait')`,
    [config.accountKey, config.productKey, input.conversation.conversation_key],
  );
  await enqueueWhatsAppMessage(client, config, {
    conversationKey: input.conversation.conversation_key,
    providerAccountKey: input.conversation.provider_account_key,
    recipientE164: input.e164,
    messageKind: 'SUPPRESSION_STATE_NOTICE',
    body: WHATSAPP_ASSISTANT_COPY.abuseSuppressed,
    idempotencyKey: stableKey('wa_outbox', [input.event.event_key, 'abuse-suppressed']),
    metadata: { abuse_detected: true, raw_body_stored: false },
  });
  await updateConversation(client, config, input.conversation.conversation_key, {
    state: 'SUPPRESSED',
    suppression_state: 'suppressed',
  });
}

async function handleStop(
  client: Queryable,
  config: AppConfig,
  input: {
    conversation: ConversationRow;
    event: InboxRow;
    e164: string;
    now: Date;
  },
) {
  await appendConsentEvent(client, config, input.conversation, {
    eventType: 'revoked',
    scope: 'reactive_conversation',
    policy: REACTIVE_CONSENT_POLICY,
    sourceInboxEventKey: input.event.event_key,
  });
  await client.query(
    `INSERT INTO onetime.whatsapp_suppressions
     (suppression_key, account_key, product_key, provider_account_key, sender_key,
      conversation_key, reason, source_inbox_event_key)
     VALUES ($1,$2,$3,$4,$5,$6,'user_stop',$7)
     ON CONFLICT DO NOTHING`,
    [
      `wa_suppression_${randomUUID()}`,
      config.accountKey,
      config.productKey,
      input.conversation.provider_account_key,
      input.conversation.sender_key,
      input.conversation.conversation_key,
      input.event.event_key,
    ],
  );
  await client.query(
    `UPDATE onetime.whatsapp_outbox_messages
        SET status = 'suppressed'
      WHERE account_key = $1
        AND product_key = $2
        AND conversation_key = $3
        AND status IN ('queued', 'retry_wait')`,
    [config.accountKey, config.productKey, input.conversation.conversation_key],
  );
  await client.query(
    `UPDATE onetime.whatsapp_account_link_requests
        SET status = 'revoked'
      WHERE account_key = $1
        AND product_key = $2
        AND conversation_key = $3
        AND status = 'pending'`,
    [config.accountKey, config.productKey, input.conversation.conversation_key],
  );
  await client.query(
    `UPDATE onetime.whatsapp_verified_grants
        SET revoked_at = COALESCE(revoked_at, $4)
      WHERE account_key = $1
        AND product_key = $2
        AND conversation_key = $3
        AND revoked_at IS NULL`,
    [
      config.accountKey,
      config.productKey,
      input.conversation.conversation_key,
      input.now.toISOString(),
    ],
  );
  await enqueueWhatsAppMessage(client, config, {
    conversationKey: input.conversation.conversation_key,
    providerAccountKey: input.conversation.provider_account_key,
    recipientE164: input.e164,
    messageKind: 'STOP_CONFIRMATION',
    body: 'Messages are stopped. Reply START if you want to resume this public assistant conversation.',
    idempotencyKey: stableKey('wa_outbox', [input.event.event_key, 'stop-confirmation']),
  });
  await updateConversation(client, config, input.conversation.conversation_key, {
    state: 'SUPPRESSED',
    suppression_state: 'suppressed',
  });
}

async function handleStart(
  client: Queryable,
  config: AppConfig,
  input: {
    conversation: ConversationRow;
    event: InboxRow;
    e164: string;
    now: Date;
  },
) {
  await appendConsentEvent(client, config, input.conversation, {
    eventType: 'resumed',
    scope: 'reactive_conversation',
    policy: REACTIVE_CONSENT_POLICY,
    sourceInboxEventKey: input.event.event_key,
  });
  await client.query(
    `UPDATE onetime.whatsapp_suppressions
        SET status = 'released',
            released_at = $5
      WHERE account_key = $1
        AND product_key = $2
        AND provider_account_key = $3
        AND sender_key = $4
        AND status = 'active'`,
    [
      config.accountKey,
      config.productKey,
      input.conversation.provider_account_key,
      input.conversation.sender_key,
      input.now.toISOString(),
    ],
  );
  await enqueueWhatsAppMessage(client, config, {
    conversationKey: input.conversation.conversation_key,
    providerAccountKey: input.conversation.provider_account_key,
    recipientE164: input.e164,
    messageKind: 'START_CONFIRMATION',
    body: 'This public assistant conversation is resumed. Class reminders are not restored here unless you give separate reminder consent.',
    idempotencyKey: stableKey('wa_outbox', [input.event.event_key, 'start-confirmation']),
  });
  await updateConversation(client, config, input.conversation.conversation_key, {
    state: 'PUBLIC_IDLE',
    suppression_state: 'active',
  });
}

async function enqueueStandard(
  client: Queryable,
  config: AppConfig,
  input: { conversation: ConversationRow; event: InboxRow; e164: string },
  messageKind: WhatsAppMessageKind,
) {
  await enqueueWhatsAppMessage(client, config, {
    conversationKey: input.conversation.conversation_key,
    providerAccountKey: input.conversation.provider_account_key,
    recipientE164: input.e164,
    messageKind,
    body: standardBody(messageKind),
    idempotencyKey: stableKey('wa_outbox', [input.event.event_key, messageKind]),
  });
}

async function enqueueWhatsAppMessage(
  client: Queryable,
  config: AppConfig,
  input: {
    conversationKey: string;
    providerAccountKey: string;
    recipientE164: string;
    messageKind: WhatsAppMessageKind;
    body: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown> | undefined;
  },
) {
  const e164 = normalizeWhatsAppE164(input.recipientE164);
  const recipientKey = whatsappRecipientKey(config, input.providerAccountKey, e164);
  const recipient = encryptForWhatsApp(config, e164);
  const body = encryptForWhatsApp(config, input.body);
  await client.query(
    `INSERT INTO onetime.whatsapp_outbox_messages
     (outbox_message_key, account_key, product_key, provider_account_key, conversation_key,
      recipient_key, recipient_e164_ciphertext, recipient_e164_iv, recipient_e164_tag,
      message_kind, body_ciphertext, body_iv, body_tag, idempotency_key, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)
     ON CONFLICT (account_key, product_key, provider_account_key, idempotency_key) DO NOTHING`,
    [
      `wa_outbox_${randomUUID()}`,
      config.accountKey,
      config.productKey,
      input.providerAccountKey,
      input.conversationKey,
      recipientKey,
      recipient.ciphertext,
      recipient.iv,
      recipient.tag,
      input.messageKind,
      body.ciphertext,
      body.iv,
      body.tag,
      input.idempotencyKey,
      JSON.stringify({
        ...(input.metadata ?? {}),
        body_digest: digestText(input.body),
        raw_body_present: false,
        raw_recipient_present: false,
      }),
    ],
  );
  await client.query(
    `UPDATE onetime.whatsapp_conversations
        SET last_outbound_at = now(),
            updated_at = now()
      WHERE account_key = $1
        AND product_key = $2
        AND conversation_key = $3`,
    [config.accountKey, config.productKey, input.conversationKey],
  );
}

async function upsertConversation(
  client: Queryable,
  config: AppConfig,
  input: {
    providerAccountKey: string;
    senderKey: string;
    encryptedSender: { ciphertext: string; iv: string; tag: string };
    now: Date;
  },
) {
  const conversationKey = stableKey('wa_conversation', [
    config.accountKey,
    config.productKey,
    input.providerAccountKey,
    input.senderKey,
  ]);
  const result = await client.query(
    `INSERT INTO onetime.whatsapp_conversations
     (conversation_key, account_key, product_key, provider_account_key, sender_key,
      sender_e164_ciphertext, sender_e164_iv, sender_e164_tag, last_inbound_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (account_key, product_key, provider_account_key, sender_key)
     DO UPDATE SET
       sender_e164_ciphertext = EXCLUDED.sender_e164_ciphertext,
       sender_e164_iv = EXCLUDED.sender_e164_iv,
       sender_e164_tag = EXCLUDED.sender_e164_tag,
       last_inbound_at = EXCLUDED.last_inbound_at,
       updated_at = now()
     RETURNING *`,
    [
      conversationKey,
      config.accountKey,
      config.productKey,
      input.providerAccountKey,
      input.senderKey,
      input.encryptedSender.ciphertext,
      input.encryptedSender.iv,
      input.encryptedSender.tag,
      input.now.toISOString(),
    ],
  );
  return mapConversationRow(result.rows[0] as Record<string, unknown>);
}

async function loadConversation(client: Queryable, config: AppConfig, conversationKey: string) {
  const result = await client.query(
    `SELECT *
       FROM onetime.whatsapp_conversations
      WHERE account_key = $1
        AND product_key = $2
        AND conversation_key = $3
      FOR UPDATE`,
    [config.accountKey, config.productKey, conversationKey],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error('whatsapp_conversation_missing');
  return mapConversationRow(row);
}

async function updateConversation(
  client: Queryable,
  config: AppConfig,
  conversationKey: string,
  patch: Partial<{
    state: WhatsAppConversationState;
    audience_type: 'family' | 'school' | null;
    suppression_state: 'active' | 'suppressed';
    draft: Record<string, unknown>;
    contact_key: string | null;
    signup_key: string | null;
  }>,
) {
  const assignments: string[] = ['updated_at = now()'];
  const values: unknown[] = [config.accountKey, config.productKey, conversationKey];
  for (const [column, value] of Object.entries(patch)) {
    values.push(column === 'draft' ? JSON.stringify(value) : value);
    assignments.push(`${column} = $${values.length}${column === 'draft' ? '::jsonb' : ''}`);
  }
  await client.query(
    `UPDATE onetime.whatsapp_conversations
        SET ${assignments.join(', ')}
      WHERE account_key = $1
        AND product_key = $2
        AND conversation_key = $3`,
    values,
  );
}

async function activeSuppression(
  client: Queryable,
  config: AppConfig,
  conversation: ConversationRow,
) {
  const result = await client.query(
    `SELECT 1
       FROM onetime.whatsapp_suppressions
      WHERE account_key = $1
        AND product_key = $2
        AND provider_account_key = $3
        AND sender_key = $4
        AND status = 'active'
      LIMIT 1`,
    [
      config.accountKey,
      config.productKey,
      conversation.provider_account_key,
      conversation.sender_key,
    ],
  );
  return Boolean(result.rowCount);
}

async function hasActiveGrant(
  client: Queryable,
  config: AppConfig,
  input: { conversation: ConversationRow; now: Date },
) {
  const result = await client.query(
    `SELECT 1
       FROM onetime.whatsapp_verified_grants
      WHERE account_key = $1
        AND product_key = $2
        AND conversation_key = $3
        AND grant_scope = 'safe_status_only'
        AND revoked_at IS NULL
        AND expires_at > $4
      LIMIT 1`,
    [
      config.accountKey,
      config.productKey,
      input.conversation.conversation_key,
      input.now.toISOString(),
    ],
  );
  return Boolean(result.rowCount);
}

async function appendConsentEvent(
  client: Queryable,
  config: AppConfig,
  conversation: ConversationRow,
  input: {
    eventType: 'granted' | 'revoked' | 'resumed' | 'declined';
    scope: 'reactive_conversation' | 'family_reminders';
    policy: string;
    sourceInboxEventKey?: string | undefined;
  },
) {
  await client.query(
    `INSERT INTO onetime.whatsapp_consent_events
     (consent_event_key, account_key, product_key, conversation_key, sender_key,
      event_type, consent_scope, policy_version, consent_text_digest, source_inbox_event_key,
      metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
    [
      `wa_consent_${randomUUID()}`,
      config.accountKey,
      config.productKey,
      conversation.conversation_key,
      conversation.sender_key,
      input.eventType,
      input.scope,
      input.policy,
      digestText(`${input.scope}:${input.policy}:${input.eventType}`),
      input.sourceInboxEventKey ?? null,
      JSON.stringify({ append_only: true }),
    ],
  );
}

async function recordLeadEvent(
  client: Queryable,
  config: AppConfig,
  conversation: ConversationRow,
  input: {
    eventType:
      | 'family_lead_captured'
      | 'school_lead_captured'
      | 'human_handoff_requested'
      | 'archived_contact_reinquiry';
    audienceType: 'family' | 'school';
    contactKey?: string | null | undefined;
    signupKey?: string | null | undefined;
    metadata: Record<string, unknown>;
  },
) {
  await client.query(
    `INSERT INTO onetime.whatsapp_lead_events
     (lead_event_key, account_key, product_key, conversation_key, contact_key, signup_key,
      audience_type, event_type, sender_key, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
    [
      `wa_lead_${randomUUID()}`,
      config.accountKey,
      config.productKey,
      conversation.conversation_key,
      input.contactKey ?? null,
      input.signupKey ?? null,
      input.audienceType,
      input.eventType,
      conversation.sender_key,
      JSON.stringify(input.metadata),
    ],
  );
}

async function insertDeliveryEvent(
  target: DbPool | Queryable,
  config: AppConfig,
  input: {
    deliveryEventKey?: string | undefined;
    outboxMessageKey: string | null;
    status:
      | 'accepted'
      | 'sent'
      | 'delivered'
      | 'read'
      | 'failed'
      | 'retriable_failure'
      | 'dead_lettered'
      | 'suppressed';
    providerEventRefHash?: string | null | undefined;
    failureCode?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    occurredAt?: Date | undefined;
    providerResponseStatus?: number | undefined;
  },
) {
  const result = await target.query(
    `INSERT INTO onetime.whatsapp_delivery_events
     (delivery_event_key, account_key, product_key, outbox_message_key, provider_event_ref_hash,
      status, failure_code, metadata, occurred_at, provider_status_event_key,
      provider_response_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11)
     ON CONFLICT (delivery_event_key) DO NOTHING`,
    [
      input.deliveryEventKey ?? `wa_delivery_${randomUUID()}`,
      config.accountKey,
      config.productKey,
      input.outboxMessageKey,
      input.providerEventRefHash ?? null,
      input.status,
      input.failureCode ?? null,
      JSON.stringify(input.metadata ?? {}),
      (input.occurredAt ?? new Date()).toISOString(),
      input.deliveryEventKey ?? null,
      input.providerResponseStatus ?? null,
    ],
  );
  return Boolean(result.rowCount);
}

async function setOutboxSent(
  pool: DbPool,
  config: AppConfig,
  input: {
    outboxMessageKey: string;
    leaseOwner: string;
    leaseGeneration: number;
    status: 'sent' | 'sink_delivered';
    providerHash: string | null;
    encryptedProviderRef: { ciphertext: string; iv: string; tag: string } | null;
    providerResponseStatus: number | null;
    sentAt: Date;
  },
) {
  const result = await pool.query(
    `UPDATE onetime.whatsapp_outbox_messages
        SET status = $6,
            lease_owner = NULL,
            lease_expires_at = NULL,
            provider_message_ref_hash = $7,
            provider_message_ref_ciphertext = $8,
            provider_message_ref_iv = $9,
            provider_message_ref_tag = $10,
            provider_response_status = $11,
            provider_retry_after_ms = NULL,
            sent_at = $12
      WHERE account_key = $1
        AND product_key = $2
        AND outbox_message_key = $3
        AND lease_owner = $4
        AND lease_generation = $5`,
    [
      config.accountKey,
      config.productKey,
      input.outboxMessageKey,
      input.leaseOwner,
      input.leaseGeneration,
      input.status,
      input.providerHash,
      input.encryptedProviderRef?.ciphertext ?? null,
      input.encryptedProviderRef?.iv ?? null,
      input.encryptedProviderRef?.tag ?? null,
      input.providerResponseStatus,
      input.sentAt.toISOString(),
    ],
  );
  return Boolean(result.rowCount);
}

async function setOutboxRetryWait(
  pool: DbPool,
  config: AppConfig,
  input: {
    outboxMessageKey: string;
    leaseOwner: string;
    leaseGeneration: number;
    nextAttemptAt: Date;
    retryAfterMs?: number | undefined;
  },
) {
  const result = await pool.query(
    `UPDATE onetime.whatsapp_outbox_messages
        SET status = 'retry_wait',
            lease_owner = NULL,
            lease_expires_at = NULL,
            next_attempt_at = $6,
            provider_retry_after_ms = $7
      WHERE account_key = $1
        AND product_key = $2
        AND outbox_message_key = $3
        AND lease_owner = $4
        AND lease_generation = $5`,
    [
      config.accountKey,
      config.productKey,
      input.outboxMessageKey,
      input.leaseOwner,
      input.leaseGeneration,
      input.nextAttemptAt.toISOString(),
      input.retryAfterMs ?? null,
    ],
  );
  return Boolean(result.rowCount);
}

async function setOutboxSuppressed(
  pool: DbPool,
  config: AppConfig,
  outboxMessageKey: string,
  reason: string,
  lease?: { owner: string; generation: number } | undefined,
) {
  const result = await pool.query(
    `UPDATE onetime.whatsapp_outbox_messages
        SET status = 'suppressed',
            lease_owner = NULL,
            lease_expires_at = NULL
      WHERE account_key = $1
        AND product_key = $2
        AND outbox_message_key = $3
        ${lease ? 'AND lease_owner = $4 AND lease_generation = $5' : ''}`,
    lease
      ? [config.accountKey, config.productKey, outboxMessageKey, lease.owner, lease.generation]
      : [config.accountKey, config.productKey, outboxMessageKey],
  );
  if (!result.rowCount) return false;
  await insertDeliveryEvent(pool, config, {
    outboxMessageKey,
    status: 'suppressed',
    metadata: { reason },
  });
  return true;
}

async function setOutboxDeadLettered(
  pool: DbPool,
  config: AppConfig,
  outboxMessageKey: string,
  error: unknown,
  lease?: { owner: string; generation: number } | undefined,
) {
  const result = await pool.query(
    `UPDATE onetime.whatsapp_outbox_messages
        SET status = 'dead_lettered',
            lease_owner = NULL,
            lease_expires_at = NULL,
            provider_retry_after_ms = NULL
      WHERE account_key = $1
        AND product_key = $2
        AND outbox_message_key = $3
        ${lease ? 'AND lease_owner = $4 AND lease_generation = $5' : ''}`,
    lease
      ? [config.accountKey, config.productKey, outboxMessageKey, lease.owner, lease.generation]
      : [config.accountKey, config.productKey, outboxMessageKey],
  );
  if (!result.rowCount) return false;
  await insertDeliveryEvent(pool, config, {
    outboxMessageKey,
    status: 'dead_lettered',
    failureCode: failureCode(error),
  });
  return true;
}

async function markInboxFailure(pool: DbPool, config: AppConfig, eventKey: string, error: unknown) {
  const code = failureCode(error);
  await pool.query(
    `UPDATE onetime.whatsapp_inbox_events
        SET status = CASE WHEN processing_attempts >= 2 THEN 'dead_lettered' ELSE 'processing_failed' END,
            processing_attempts = processing_attempts + 1,
            failure_code = $4
      WHERE account_key = $1
        AND product_key = $2
        AND event_key = $3`,
    [config.accountKey, config.productKey, eventKey, code],
  );
}

function mapConversationRow(row: Record<string, unknown>): ConversationRow {
  return {
    conversation_key: String(row.conversation_key),
    provider_account_key: String(row.provider_account_key),
    sender_key: String(row.sender_key),
    sender_e164_ciphertext: String(row.sender_e164_ciphertext),
    sender_e164_iv: String(row.sender_e164_iv),
    sender_e164_tag: String(row.sender_e164_tag),
    state: row.state as WhatsAppConversationState,
    audience_type: row.audience_type ? (row.audience_type as 'family' | 'school') : null,
    contact_key: row.contact_key ? String(row.contact_key) : null,
    signup_key: row.signup_key ? String(row.signup_key) : null,
    suppression_state: row.suppression_state as 'active' | 'suppressed',
    draft: jsonObject(row.draft),
  };
}

function mapInboxRow(row: Record<string, unknown>): InboxRow {
  return {
    event_key: String(row.event_key),
    conversation_key: String(row.conversation_key),
    provider_account_key: String(row.provider_account_key),
    sender_key: String(row.sender_key),
    message_ciphertext: String(row.message_ciphertext),
    message_iv: String(row.message_iv),
    message_tag: String(row.message_tag),
    processing_attempts: Number(row.processing_attempts ?? 0),
  };
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function dateIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return null;
}

function shouldDeadLetterWhatsApp(error: unknown, attempt: number, maxAttempts: number) {
  if (error instanceof WhatsAppProviderSendError && !error.retryable) return true;
  return attempt >= maxAttempts;
}

function nextWhatsAppRetryAt(error: unknown, now: Date, attempt: number, outboxKey: string) {
  const providerDelay =
    error instanceof WhatsAppProviderSendError && error.retryAfterMs !== undefined
      ? Math.max(0, error.retryAfterMs)
      : 0;
  const exponent = Math.max(0, attempt - 1);
  const baseDelay = Math.min(6 * 60 * 60 * 1000, 30_000 * 2 ** exponent);
  const jitterByte = createHash('sha256').update(`${outboxKey}\0${attempt}`).digest()[0] ?? 128;
  const jitter = 0.8 + (jitterByte / 255) * 0.4;
  const retryDelay = Math.max(providerDelay, Math.round(baseDelay * jitter));
  return new Date(now.getTime() + retryDelay);
}

function expectedIntentContext(state: WhatsAppConversationState) {
  if (state === 'CAPTURE_GUARDIAN_NAME') return 'guardian_name' as const;
  if (state === 'CAPTURE_SCHOOL_CONTACT_NAME') return 'school_contact_name' as const;
  if (state === 'CAPTURE_CONTACT_PREFERENCE') return 'contact_preference' as const;
  if (state === 'CAPTURE_FAMILY_REMINDER_PREFERENCE') return 'reminder_preference' as const;
  return null;
}

function entity(intent: WhatsAppCompiledIntent, kind: string) {
  return intent.entities.find((candidate) => candidate.kind === kind)?.value;
}

function standardBody(kind: WhatsAppMessageKind) {
  switch (kind) {
    case 'QUALIFY_AUDIENCE':
      return WHATSAPP_ASSISTANT_COPY.openingQuestion;
    case 'ASK_GUARDIAN_NAME':
      return WHATSAPP_ASSISTANT_COPY.guardianNameQuestion;
    case 'ASK_SCHOOL_CONTACT_NAME':
      return WHATSAPP_ASSISTANT_COPY.schoolContactNameQuestion;
    case 'ASK_CONTACT_PREFERENCE':
      return WHATSAPP_ASSISTANT_COPY.contactPreferenceQuestion;
    case 'ASK_FAMILY_REMINDER_PREFERENCE':
      return WHATSAPP_ASSISTANT_COPY.reminderConsentQuestion;
    case 'FAMILY_LEAD_ACK':
      return WHATSAPP_ASSISTANT_COPY.familyAck;
    case 'SCHOOL_LEAD_ACK':
      return WHATSAPP_ASSISTANT_COPY.schoolAck;
    case 'HUMAN_HANDOFF_ACK':
      return WHATSAPP_ASSISTANT_COPY.humanHandoffAck;
    case 'SAFE_STATUS_RESPONSE':
      return WHATSAPP_ASSISTANT_COPY.safeStatusResponse;
    case 'PRIVATE_DATA_BLOCKED':
      return WHATSAPP_ASSISTANT_COPY.privateDataBlocked;
    case 'TECHNICAL_HELP_REDIRECT':
      return WHATSAPP_ASSISTANT_COPY.technicalHelpRedirect;
    case 'UNKNOWN_FALLBACK':
      return WHATSAPP_ASSISTANT_COPY.unknownFallback;
    default:
      return WHATSAPP_ASSISTANT_COPY.unknownFallback;
  }
}

function safeString(value: unknown) {
  return typeof value === 'string' ? value.slice(0, 120) : null;
}

function suppressionBypass(value: unknown) {
  return ['STOP_CONFIRMATION', 'START_CONFIRMATION', 'SUPPRESSION_STATE_NOTICE'].includes(
    String(value),
  );
}

function accountLinkResult(ok: boolean, code: string) {
  return {
    ok,
    code,
    raw_token_included: false,
    private_data_included: false,
  };
}

function failureCode(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .slice(0, 80);
  if (!normalized || /phone|e164|message|token|secret|recipient|sender/.test(normalized)) {
    return 'whatsapp_processing_failure';
  }
  return normalized;
}

function disposition(
  ok: boolean,
  status: number,
  code: string,
  accepted = 0,
  duplicates = 0,
  processed = 0,
): WhatsAppWebhookDisposition {
  return { ok, status, code, accepted, duplicates, processed };
}

export function digestForTests(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
