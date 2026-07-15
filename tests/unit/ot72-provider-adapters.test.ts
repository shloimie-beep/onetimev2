import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  type BillingProviderAccountRef,
  type ProviderCheckoutSessionInput,
} from '../../packages/contracts/src/billing/index.ts';
import { asChatRef } from '../../packages/contracts/src/telegram/types.ts';
import { bnaOversightFollowupManifestSchema } from '../../packages/contracts/src/providers/oversight.ts';
import { createStripeTestBillingProviderAdapter } from '../../packages/domain/src/billing/stripe-test-adapter.ts';
import {
  buildProviderEventRecord,
  normalizeResendEventState,
} from '../../packages/domain/src/providers/provider-events.ts';
import { buildOversightOutcome } from '../../packages/domain/src/providers/oversight.ts';
import {
  buildVimeoPlaybackDescriptor,
  inspectVimeoReadiness,
} from '../../packages/domain/src/providers/vimeo.ts';
import {
  buildZoomLaunchDescriptor,
  inspectZoomReadiness,
} from '../../packages/domain/src/providers/zoom.ts';
import { parseOneTimeTelegramTransportConfig } from '../../packages/domain/src/telegram/config.ts';
import { OneTimeTelegramTransportAdapter } from '../../packages/domain/src/telegram/transport.ts';
import { parseDeliveryProviderFeatureConfig } from '../../apps/worker/src/delivery/provider-config.ts';
import { OneTimeProviderDeliveryRouter } from '../../apps/worker/src/delivery/provider-router.ts';
import { normalizeResendWebhookEvent } from '../../apps/worker/src/delivery/provider-webhooks.ts';

const providerAccount: BillingProviderAccountRef = {
  provider: 'stripe',
  mode: 'test',
  provider_account_ref: 'acct_fixture_ot72',
};

const principal = {
  principal_key: 'principal_owner',
  principal_type: 'account_user',
  account_key: 'one_time',
  product_key: 'one_time_mishnah_class',
} as const;

const checkoutInput: ProviderCheckoutSessionInput = {
  principal,
  providerAccount,
  offer: {
    account_key: 'one_time',
    product_key: 'one_time_mishnah_class',
    offer_key: 'synthetic_test_offer',
    provider: 'stripe',
    mode: 'test',
    provider_account_ref: providerAccount.provider_account_ref,
    provider_price_ref: 'price_fixture_ot72',
    currency: 'usd',
    amount_cents: 0,
    synthetic: true,
  },
  idempotencyKey: 'checkout_ot72_0001',
  successUrl: 'https://join.onetimeonetime.com/app/billing/checkout/success',
  cancelUrl: 'https://join.onetimeonetime.com/app/billing/checkout/cancel',
};

describe('OT-72 Stripe test adapter', () => {
  it('creates local redirect handles and keeps provider URLs in the server vault', async () => {
    const stored: Array<{ redirectKey: string; providerUrl: string }> = [];
    const adapter = createStripeTestBillingProviderAdapter({
      providerAccountRef: providerAccount,
      webhookSecret: 'fixture_webhook_secret',
      redirectVault: {
        store: (entry) => {
          stored.push(entry);
        },
      },
      client: {
        checkout: {
          sessions: {
            create: async (_params, options) => {
              expect(options.idempotencyKey).toBe('checkout_ot72_0001');
              return {
                id: 'cs_test_ot72',
                url: 'https://checkout.stripe.com/c/pay/cs_test_ot72',
                customer: 'cus_test_ot72',
                subscription: 'sub_test_ot72',
                livemode: false,
              };
            },
          },
        },
        billingPortal: {
          sessions: {
            create: async () => ({
              id: 'bps_test_ot72',
              url: 'https://billing.stripe.com/p/session/test_ot72',
              livemode: false,
            }),
          },
        },
        webhooks: {
          constructEvent: () => ({
            id: 'evt_test_ot72',
            type: 'invoice.paid',
            account: providerAccount.provider_account_ref,
            created: 1_785_000_000,
            livemode: false,
            data: { object: { id: 'in_test_ot72', customer: 'cus_test_ot72', amount_paid: 0 } },
          }),
        },
        customers: { retrieve: async (id) => ({ id }) },
        subscriptions: { retrieve: async (id) => ({ id, status: 'active' }) },
        invoices: { retrieve: async (id) => ({ id, status: 'paid' }) },
      },
      clock: () => new Date('2026-07-15T06:00:00Z'),
    });

    const checkout = await adapter.createCheckoutSession(checkoutInput);

    expect(checkout.redirect_url).toMatch(/^\/app\/billing\/checkout\/redirect\//);
    expect(checkout.redirect_url).not.toContain('stripe.com');
    expect(stored).toHaveLength(1);
    expect(stored[0]?.providerUrl).toContain('checkout.stripe.com');
    expect(checkout.livemode).toBe(false);
  });

  it('rejects live-mode Stripe objects before returning a session', async () => {
    const adapter = createStripeTestBillingProviderAdapter({
      providerAccountRef: providerAccount,
      webhookSecret: 'fixture_webhook_secret',
      redirectVault: { store: () => undefined },
      client: {
        checkout: {
          sessions: {
            create: async () => ({
              id: 'cs_test_live_rejected',
              url: 'https://checkout.stripe.com/c/pay/cs_test_live_rejected',
              customer: 'cus_test_live_rejected',
              livemode: true,
            }),
          },
        },
        billingPortal: {
          sessions: {
            create: async () => {
              throw new Error('unused');
            },
          },
        },
        webhooks: {
          constructEvent: () => {
            throw new Error('unused');
          },
        },
        customers: { retrieve: async () => null },
        subscriptions: { retrieve: async () => null },
        invoices: { retrieve: async () => null },
      },
    });

    await expect(adapter.createCheckoutSession(checkoutInput)).rejects.toThrow(/Live Stripe/);
  });
});

describe('OT-72 Resend/WAPI provider truth', () => {
  it('requires exact canary destinations before provider sends', async () => {
    const config = parseDeliveryProviderFeatureConfig({
      ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED: 'true',
      ONE_TIME_RESEND_TRANSPORT_ENABLED: 'true',
      ONE_TIME_DELIVERY_TEST_CANARY_EMAIL: 'owner@example.test',
    });
    const router = new OneTimeProviderDeliveryRouter(config, {
      resend: {
        sendEmail: async () => ({ messageId: 'email_provider_ack_1' }),
      },
    });

    await expect(
      router.send(
        {
          channel: 'email',
          provider: 'resend',
          recipientClass: 'public',
          idempotencyKey: 'delivery_1',
          from: 'One Time <delivery@example.test>',
          to: 'other@example.test',
          subject: 'Test',
          text: 'Hello',
          html: '<p>Hello</p>',
          tags: [],
        },
        { deliveryKey: 'delivery_1', attempt: 1, signal: new AbortController().signal },
      ),
    ).rejects.toThrow(/canary/);
  });

  it('normalizes signed webhook evidence without raw provider IDs', () => {
    const rawBody = Buffer.from(
      JSON.stringify({
        id: 'resend_event_1',
        type: 'email.delivered',
        message_id: 'provider_message_1',
        created_at: '2026-07-15T06:00:00.000Z',
      }),
    );
    const signatureHeader = createHmac('sha256', 'fixture_delivery_secret')
      .update(rawBody)
      .digest('hex');

    const event = normalizeResendWebhookEvent({
      accountKey: 'one_time',
      productKey: 'one_time_mishnah_class',
      rawBody,
      signatureHeader,
      secret: 'fixture_delivery_secret',
    });

    expect(event.canonical_state).toBe('delivered');
    expect(event.provider_event_ref_hash).not.toContain('resend_event_1');
    expect(event.minimized_payload).toMatchObject({ type: 'email.delivered' });
    expect(normalizeResendEventState('email.bounced')).toBe('bounced');
  });
});

describe('OT-72 Zoom, Vimeo, Telegram, and oversight seams', () => {
  it('builds protected Zoom and Vimeo descriptors without raw provider URLs', async () => {
    const zoom = buildZoomLaunchDescriptor({
      occurrenceKey: 'occurrence_1',
      scheduledStart: new Date('2026-07-15T16:00:00Z'),
      durationMinutes: 45,
      providerMeetingRef: 'zoom_meeting_test_1',
      launchSecretRef: 'launch_ref_1',
    });
    const vimeo = buildVimeoPlaybackDescriptor({
      contentKey: 'content_1',
      providerVideoRef: 'vimeo_video_test_1',
      embedDomain: 'join.onetimeonetime.com',
      playbackSecretRef: 'playback_ref_1',
      now: new Date('2026-07-15T06:00:00Z'),
    });

    expect(zoom.schedule).toMatchObject({ local_time: '19:00', timezone: 'Asia/Jerusalem' });
    expect(zoom.join_url_included).toBe(false);
    expect(vimeo.raw_url_included).toBe(false);
    expect(JSON.stringify({ zoom, vimeo })).not.toMatch(/https?:\/\//);

    const zoomReadiness = await inspectZoomReadiness({
      config: {
        enabled: true,
        accountKey: 'one_time',
        productKey: 'one_time_mishnah_class',
        environment: 'staging',
        accountRefConfigured: true,
        hostRefConfigured: true,
        readOnlyVerificationEnabled: true,
        mutationCanaryEnabled: false,
      },
      client: {
        getAccountReadiness: async () => ({
          accountRef: 'zoom_account_test',
          hostRef: 'zoom_host_test',
          hostTimezone: 'Asia/Jerusalem',
          canCreateMeetings: false,
        }),
      },
    });
    const vimeoReadiness = await inspectVimeoReadiness({
      config: {
        enabled: true,
        accountKey: 'one_time',
        productKey: 'one_time_mishnah_class',
        environment: 'staging',
        accountRefConfigured: true,
        readOnlyVerificationEnabled: true,
        mutationCanaryEnabled: false,
      },
      client: {
        getPlaybackReadiness: async () => ({
          accountRef: 'vimeo_account_test',
          embedDomainAllowed: true,
          privacy: 'private',
        }),
      },
    });
    expect(zoomReadiness.readiness_state).toBe('authenticated');
    expect(vimeoReadiness.readiness_state).toBe('authenticated');
  });

  it('keeps Telegram transport disabled unless the canary chat matches', async () => {
    const config = parseOneTimeTelegramTransportConfig(
      {
        ONE_TIME_TELEGRAM_TRANSPORT_ENABLED: 'true',
        ONE_TIME_TELEGRAM_TOKEN_CONFIGURED: 'true',
        ONE_TIME_TELEGRAM_OWNER_MAPPING_CONFIGURED: 'true',
        ONE_TIME_TELEGRAM_SINGLE_CONSUMER_GATE: 'true',
      },
      { accountKey: 'one_time', productKey: 'one_time_mishnah_class' },
    );
    expect(config.canaryChatConfigured).toBe(false);
    const sent: string[] = [];
    const transport = new OneTimeTelegramTransportAdapter({
      enabled: true,
      canaryChatRef: asChatRef('telegram_chat_allowed'),
      client: {
        sendMessage: async (input) => {
          sent.push(input.text);
          return { messageRef: 'telegram_msg_test_1' };
        },
      },
    });
    await expect(
      transport.sendReply({
        chatRef: asChatRef('telegram_chat_other'),
        text: 'status',
        correlationKey: 'correlation_1',
      }),
    ).rejects.toThrow(/canary/);
    expect(sent).toHaveLength(0);
  });

  it('builds redacted provider and oversight events', () => {
    const providerEvent = buildProviderEventRecord({
      accountKey: 'one_time',
      productKey: 'one_time_mishnah_class',
      provider: 'bna_oversight',
      environment: 'staging',
      providerEventRef: 'raw-provider-event-id',
      eventType: 'worker_readiness',
      canonicalState: 'provider_accepted',
      minimizedPayload: { count: 1 },
    });
    const oversight = buildOversightOutcome({
      sourceSha: 'abcdef123456',
      accountKey: 'one_time',
      productKey: 'one_time_mishnah_class',
      category: 'worker_readiness',
      producedAt: new Date('2026-07-15T06:00:00Z'),
      staleAfter: new Date('2026-07-15T07:00:00Z'),
      summary: { ready: true, worker_count: 1 },
    });

    expect(providerEvent.provider_event_ref_hash).not.toContain('raw-provider-event-id');
    expect(oversight.schema_version).toBe(1);
    expect(JSON.stringify(oversight)).not.toMatch(/contact|message|invoice|token/i);
  });

  it('validates the separate async BNA follow-up manifest', () => {
    const manifest = bnaOversightFollowupManifestSchema.parse(
      JSON.parse(
        readFileSync(join(process.cwd(), 'ops/execution/ot-72/BNA-FOLLOWUP-MANIFEST.json'), 'utf8'),
      ),
    );

    expect(manifest.consumer.runtime_wiring).toBe('future_followup_only');
    expect(manifest.consumer.synchronous_call_allowed).toBe(false);
    expect(manifest.consumer.bna_runtime_edit_in_ot72).toBe(false);
    expect(manifest.transport.required_controls).toEqual(
      expect.arrayContaining(['signature_ref', 'idempotency_key', 'replay_protection']),
    );
    expect(JSON.stringify(manifest.allowed_summary_keys)).not.toMatch(
      /contact|message_body|student|household|transcript|class_link|invoice|payment_method|provider_id|credential|raw_log/i,
    );
  });
});
