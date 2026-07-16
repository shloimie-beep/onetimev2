import { describe, expect, it } from 'vitest';
import {
  MetaWhatsAppCloudAdapter,
  OT100_META_GRAPH_VERSION,
  OT100_STAGING_ENVIRONMENT_FINGERPRINT,
  WhatsAppProviderSendError,
  inspectMetaWhatsAppCloudReadiness,
} from '../../../packages/domain/src/index.ts';

const READY_OPTIONS = {
  accessToken: 'protected-token',
  phoneNumberId: '1234567890',
  wabaId: 'waba_123',
  graphVersion: OT100_META_GRAPH_VERSION,
  providerEnv: 'STAGING',
  stagingIsolated: true,
  realStagingEnabled: true,
  canaryAuthorized: true,
  canaryRecipientE164: '+14155552671',
  canaryBudget: 1,
  environmentFingerprint: OT100_STAGING_ENVIRONMENT_FINGERPRINT,
};

describe('OT-100 Meta WhatsApp Cloud provider', () => {
  it('pins the current supported Graph version and reports missing protected gates without secrets', () => {
    const readiness = inspectMetaWhatsAppCloudReadiness({
      graphVersion: 'v24.0',
      providerEnv: 'UNKNOWN',
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.graph_version_supported).toBe(false);
    expect(readiness.blockers).toEqual(
      expect.arrayContaining([
        'graph_version_not_pinned_to_v25_0',
        'access_token_missing',
        'phone_number_id_missing',
        'waba_id_missing',
      ]),
    );
    expect(JSON.stringify(readiness)).not.toContain('protected-token');
  });

  it('sends a text service message to the pinned Cloud API endpoint only after all staging gates pass', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const adapter = new MetaWhatsAppCloudAdapter({
      ...READY_OPTIONS,
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return new Response(
          JSON.stringify({
            messaging_product: 'whatsapp',
            messages: [{ id: 'wamid.ot100.accepted' }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    });

    const receipt = await adapter.sendMessage({
      idempotencyKey: 'idempotency-1',
      toE164: '+14155552671',
      text: 'Hello from the public assistant',
      kind: 'PUBLIC_PROGRAM_ANSWER',
      metadata: { last_inbound_at: new Date().toISOString(), canary: true },
    });

    expect(receipt).toMatchObject({
      provider: 'meta_cloud',
      providerMessageId: 'wamid.ot100.accepted',
      sink: false,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://graph.facebook.com/v25.0/1234567890/messages');
    expect(calls[0]?.init.headers).toMatchObject({
      authorization: 'Bearer protected-token',
      'content-type': 'application/json',
    });
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '14155552671',
      type: 'text',
      text: {
        preview_url: false,
        body: 'Hello from the public assistant',
      },
    });
  });

  it('refuses real sends when the canary recipient or service window is invalid', async () => {
    const adapter = new MetaWhatsAppCloudAdapter({
      ...READY_OPTIONS,
      fetchImpl: async () => {
        throw new Error('fetch_should_not_be_called');
      },
    });

    await expect(
      adapter.sendMessage({
        idempotencyKey: 'unmarked-canary',
        toE164: '+14155552671',
        text: 'Blocked',
        kind: 'PUBLIC_PROGRAM_ANSWER',
        metadata: { last_inbound_at: new Date().toISOString() },
      }),
    ).rejects.toMatchObject({
      providerCode: 'meta_whatsapp_canary_budget_not_claimed',
      retryable: false,
    });

    await expect(
      adapter.sendMessage({
        idempotencyKey: 'wrong-recipient',
        toE164: '+14155550000',
        text: 'Blocked',
        kind: 'PUBLIC_PROGRAM_ANSWER',
        metadata: { last_inbound_at: new Date().toISOString(), canary: true },
      }),
    ).rejects.toMatchObject({
      providerCode: 'meta_whatsapp_canary_destination_not_authorized',
      retryable: false,
    });

    await expect(
      adapter.sendMessage({
        idempotencyKey: 'old-window',
        toE164: '+14155552671',
        text: 'Blocked',
        kind: 'PUBLIC_PROGRAM_ANSWER',
        metadata: { last_inbound_at: '2000-01-01T00:00:00.000Z', canary: true },
      }),
    ).rejects.toMatchObject({
      providerCode: 'meta_whatsapp_customer_service_window_closed',
      retryable: false,
    });
  });

  it('classifies Meta rate limits as retryable with retry-after metadata', async () => {
    const adapter = new MetaWhatsAppCloudAdapter({
      ...READY_OPTIONS,
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: { code: 4 } }), {
          status: 429,
          headers: { 'retry-after': '120', 'content-type': 'application/json' },
        }),
    });

    await expect(
      adapter.sendMessage({
        idempotencyKey: 'rate-limited',
        toE164: '+14155552671',
        text: 'Retry later',
        kind: 'PUBLIC_PROGRAM_ANSWER',
        metadata: { last_inbound_at: new Date().toISOString(), canary: true },
      }),
    ).rejects.toMatchObject({
      providerCode: 'meta_whatsapp_rate_limited',
      retryable: true,
      httpStatus: 429,
      retryAfterMs: 120_000,
    } satisfies Partial<WhatsAppProviderSendError>);
  });

  it('rejects webhook payloads for the wrong phone number before event projection', () => {
    const adapter = new MetaWhatsAppCloudAdapter({ expectedPhoneNumberId: 'expected_phone' });
    const rawBody = Buffer.from(
      JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba_123',
            changes: [
              {
                value: {
                  metadata: { phone_number_id: 'wrong_phone' },
                  messages: [
                    {
                      id: 'wamid.wrong',
                      from: '14155552671',
                      type: 'text',
                      text: { body: 'hello' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }),
    );
    expect(() => adapter.parseWebhook({ rawBody, providerAccountKey: 'meta' })).toThrow(
      'meta_whatsapp_phone_number_id_mismatch',
    );
  });
});
