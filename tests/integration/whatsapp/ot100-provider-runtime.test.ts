import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  MetaWhatsAppCloudAdapter,
  OT100_META_GRAPH_VERSION,
  OT100_STAGING_ENVIRONMENT_FINGERPRINT,
  SinkWhatsAppProviderAdapter,
  WhatsAppProviderSendError,
  ingestWhatsAppProviderEvents,
  processQueuedWhatsAppOutbox,
  receiveWhatsAppWebhook,
} from '../../../packages/domain/src/index.ts';
import { decryptForWhatsApp } from '../../../packages/domain/src/whatsapp/crypto.ts';
import type { WhatsAppProviderSendRequest } from '../../../packages/contracts/src/index.ts';

const PHONE = '+14155552671';
const NOW = new Date();
const WORKER_NOW = new Date(NOW.getTime() + 60_000);

let pool: DbPool;
let config: AppConfig;

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    OUTBOX_TRANSPORT_MODE: 'sink',
    ONE_TIME_WHATSAPP_PROVIDER_ACCOUNT_KEY: 'ot100_meta_provider',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
});

afterEach(async () => {
  await pool.end();
});

describe('OT-100 WhatsApp provider runtime', () => {
  it('claims queued replies with a lease, persists encrypted provider ids, and dedupes delivery statuses', async () => {
    await sendInbound('provider-1', 'What time is the program?');
    const adapter = new RecordingMetaAdapter('wamid.ot100.sent.1');

    const summary = await processQueuedWhatsAppOutbox({
      pool,
      config,
      adapter,
      now: WORKER_NOW,
      leaseOwner: 'ot100-test-worker',
    });

    expect(summary).toMatchObject({
      claimed: 1,
      sent: 1,
      leaseLost: 0,
    });
    expect(adapter.requests).toHaveLength(1);
    expect(adapter.requests[0]?.metadata).toMatchObject({
      provider_account_key: 'ot100_meta_provider',
      canary: false,
    });

    const outbox = await pool.query(
      `SELECT status, attempts, lease_owner, lease_expires_at, provider_message_ref_hash,
              provider_message_ref_ciphertext, provider_message_ref_iv, provider_message_ref_tag
         FROM onetime.whatsapp_outbox_messages`,
    );
    expect(outbox.rows[0]).toMatchObject({
      status: 'sent',
      attempts: 1,
      lease_owner: null,
      lease_expires_at: null,
    });
    expect(outbox.rows[0].provider_message_ref_hash).toBeTruthy();
    expect(JSON.stringify(outbox.rows[0])).not.toContain('wamid.ot100.sent.1');
    expect(
      decryptForWhatsApp(config, {
        ciphertext: String(outbox.rows[0].provider_message_ref_ciphertext),
        iv: String(outbox.rows[0].provider_message_ref_iv),
        tag: String(outbox.rows[0].provider_message_ref_tag),
      }),
    ).toBe('wamid.ot100.sent.1');

    await ingestWhatsAppProviderEvents({
      pool,
      config,
      rawBody: Buffer.from('{}'),
      providerAccountKey: 'ot100_meta_provider',
      now: WORKER_NOW,
      events: [
        {
          kind: 'status',
          providerMessageId: 'wamid.ot100.sent.1',
          status: 'delivered',
          recipientE164: PHONE,
          timestamp: WORKER_NOW,
        },
      ],
    });
    await ingestWhatsAppProviderEvents({
      pool,
      config,
      rawBody: Buffer.from('{}'),
      providerAccountKey: 'ot100_meta_provider',
      now: WORKER_NOW,
      events: [
        {
          kind: 'status',
          providerMessageId: 'wamid.ot100.sent.1',
          status: 'delivered',
          recipientE164: PHONE,
          timestamp: WORKER_NOW,
        },
      ],
    });
    const statuses = await pool.query(
      `SELECT status, provider_status_event_key
         FROM onetime.whatsapp_delivery_events
        WHERE status = 'delivered'`,
    );
    expect(statuses.rowCount).toBe(1);
    expect(statuses.rows[0].provider_status_event_key).toBeTruthy();
  });

  it('retries transient Meta failures with retry-after and dead-letters permanent failures', async () => {
    await sendInbound('retry-1', 'Hello');
    const retrySummary = await processQueuedWhatsAppOutbox({
      pool,
      config,
      adapter: new FailingAdapter(
        new WhatsAppProviderSendError('meta_whatsapp_rate_limited', {
          retryable: true,
          httpStatus: 429,
          retryAfterMs: 120_000,
        }),
      ),
      now: WORKER_NOW,
      leaseOwner: 'ot100-retry-worker',
    });
    expect(retrySummary).toMatchObject({ claimed: 1, retried: 1, deadLettered: 0 });
    const retry = await pool.query(
      `SELECT status, attempts, provider_retry_after_ms, next_attempt_at
         FROM onetime.whatsapp_outbox_messages`,
    );
    expect(retry.rows[0]).toMatchObject({
      status: 'retry_wait',
      attempts: 1,
      provider_retry_after_ms: 120_000,
    });
    expect(new Date(retry.rows[0].next_attempt_at).getTime()).toBeGreaterThanOrEqual(
      WORKER_NOW.getTime() + 120_000,
    );

    await pool.query(
      `UPDATE onetime.whatsapp_outbox_messages
          SET next_attempt_at = $1
        WHERE account_key = $2
          AND product_key = $3`,
      [WORKER_NOW.toISOString(), config.accountKey, config.productKey],
    );
    const deadSummary = await processQueuedWhatsAppOutbox({
      pool,
      config,
      adapter: new FailingAdapter(
        new WhatsAppProviderSendError('meta_whatsapp_unauthorized', {
          retryable: false,
          httpStatus: 401,
        }),
      ),
      now: WORKER_NOW,
      leaseOwner: 'ot100-dead-worker',
    });
    expect(deadSummary).toMatchObject({ claimed: 1, deadLettered: 1 });
    const dead = await pool.query(
      `SELECT status, lease_owner, lease_expires_at
         FROM onetime.whatsapp_outbox_messages`,
    );
    expect(dead.rows[0]).toMatchObject({
      status: 'dead_lettered',
      lease_owner: null,
      lease_expires_at: null,
    });
  });

  it('blocks free-form real Meta sends after the customer service window without calling fetch', async () => {
    await sendInbound('window-1', 'Hello');
    const oldInbound = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    await pool.query(
      `UPDATE onetime.whatsapp_conversations
          SET last_inbound_at = $1
        WHERE account_key = $2
          AND product_key = $3`,
      [oldInbound, config.accountKey, config.productKey],
    );
    await pool.query(
      `UPDATE onetime.whatsapp_outbox_messages
          SET canary = true
        WHERE account_key = $1
          AND product_key = $2`,
      [config.accountKey, config.productKey],
    );
    let fetchCalled = false;
    const adapter = new MetaWhatsAppCloudAdapter({
      accessToken: 'protected-token',
      phoneNumberId: '1234567890',
      wabaId: 'waba_123',
      graphVersion: OT100_META_GRAPH_VERSION,
      providerEnv: 'STAGING',
      stagingIsolated: true,
      realStagingEnabled: true,
      canaryAuthorized: true,
      canaryRecipientE164: PHONE,
      canaryBudget: 1,
      environmentFingerprint: OT100_STAGING_ENVIRONMENT_FINGERPRINT,
      fetchImpl: async () => {
        fetchCalled = true;
        return new Response('{}', { status: 200 });
      },
    });

    const summary = await processQueuedWhatsAppOutbox({
      pool,
      config,
      adapter,
      now: WORKER_NOW,
      leaseOwner: 'ot100-window-worker',
    });
    expect(summary).toMatchObject({ claimed: 1, deadLettered: 1 });
    expect(fetchCalled).toBe(false);
  });
});

class RecordingMetaAdapter extends SinkWhatsAppProviderAdapter {
  readonly requests: WhatsAppProviderSendRequest[] = [];

  constructor(private readonly providerMessageId: string) {
    super();
  }

  override async sendMessage(input: WhatsAppProviderSendRequest) {
    this.requests.push(input);
    return {
      provider: 'meta_cloud' as const,
      providerMessageId: this.providerMessageId,
      acceptedAt: NOW,
      sink: false,
    };
  }
}

class FailingAdapter extends SinkWhatsAppProviderAdapter {
  constructor(private readonly error: unknown) {
    super();
  }

  override async sendMessage(_input: WhatsAppProviderSendRequest): Promise<never> {
    throw this.error;
  }
}

async function sendInbound(id: string, text: string) {
  const rawBody = Buffer.from(
    JSON.stringify({
      messages: [{ id, from: PHONE, text, timestamp: NOW.toISOString() }],
    }),
  );
  return receiveWhatsAppWebhook({
    pool,
    config,
    rawBody,
    adapter: new SinkWhatsAppProviderAdapter(),
    now: NOW,
  });
}
