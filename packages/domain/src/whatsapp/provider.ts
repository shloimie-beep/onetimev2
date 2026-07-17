import { randomUUID } from 'node:crypto';
import type {
  WhatsAppProviderAdapter,
  WhatsAppProviderDeliveryStatus,
  WhatsAppProviderWebhookEvent,
  WhatsAppProviderWebhookParseResult,
  WhatsAppProviderSendReceipt,
  WhatsAppProviderSendRequest,
} from '../../../contracts/src/index.ts';
import { normalizeWhatsAppE164, verifyHmacSha256 } from './crypto.ts';

export const OT100_META_GRAPH_VERSION = 'v25.0';
export const OT100_STAGING_ENVIRONMENT_FINGERPRINT = 'ot100-whatsapp-meta-cloud-staging-v1';

export type MetaWhatsAppCloudAdapterOptions = {
  accessToken?: string | undefined;
  phoneNumberId?: string | undefined;
  wabaId?: string | undefined;
  graphVersion?: string | undefined;
  providerEnv?: string | undefined;
  stagingIsolated?: boolean | undefined;
  realStagingEnabled?: boolean | undefined;
  canaryAuthorized?: boolean | undefined;
  canaryRecipientE164?: string | undefined;
  canaryBudget?: number | undefined;
  environmentFingerprint?: string | undefined;
  baseUrl?: string | undefined;
  timeoutMs?: number | undefined;
  fetchImpl?: typeof fetch | undefined;
  expectedPhoneNumberId?: string | undefined;
  expectedWabaId?: string | undefined;
};

export type MetaWhatsAppCloudReadiness = {
  ready: boolean;
  graph_version: string | null;
  graph_version_supported: boolean;
  access_token_configured: boolean;
  phone_number_id_configured: boolean;
  waba_id_configured: boolean;
  staging_enabled: boolean;
  provider_env: string;
  staging_isolated: boolean;
  canary_authorized: boolean;
  canary_recipient_configured: boolean;
  canary_budget: number;
  environment_fingerprint_ok: boolean;
  blockers: string[];
};

export class WhatsAppProviderSendError extends Error {
  readonly retryable: boolean;
  readonly httpStatus?: number | undefined;
  readonly retryAfterMs?: number | undefined;
  readonly providerCode: string;

  constructor(
    providerCode: string,
    options: {
      retryable: boolean;
      httpStatus?: number | undefined;
      retryAfterMs?: number | undefined;
    },
  ) {
    super(providerCode);
    this.name = 'WhatsAppProviderSendError';
    this.providerCode = providerCode;
    this.retryable = options.retryable;
    this.httpStatus = options.httpStatus;
    this.retryAfterMs = options.retryAfterMs;
  }
}

export class MetaWhatsAppCloudAdapter implements WhatsAppProviderAdapter {
  private readonly options: MetaWhatsAppCloudAdapterOptions;

  constructor(options: MetaWhatsAppCloudAdapterOptions = {}) {
    this.options = options;
  }

  verifyWebhook(input: {
    rawBody: Buffer;
    signatureHeader?: string | undefined;
    secret?: string | undefined;
  }) {
    return verifyHmacSha256(input);
  }

  parseWebhook(input: {
    rawBody: Buffer;
    providerAccountKey: string;
  }): WhatsAppProviderWebhookParseResult {
    if (input.rawBody.byteLength > 128 * 1024) {
      throw new Error('meta_whatsapp_payload_too_large');
    }
    const payload = JSON.parse(input.rawBody.toString('utf8')) as MetaWebhookPayload;
    const events: WhatsAppProviderWebhookEvent[] = [];

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (
          this.options.expectedPhoneNumberId &&
          value?.metadata?.phone_number_id &&
          String(value.metadata.phone_number_id) !== this.options.expectedPhoneNumberId
        ) {
          throw new Error('meta_whatsapp_phone_number_id_mismatch');
        }
        if (
          this.options.expectedWabaId &&
          entry.id &&
          String(entry.id) !== this.options.expectedWabaId
        ) {
          throw new Error('meta_whatsapp_waba_id_mismatch');
        }
        for (const message of value?.messages ?? []) {
          if (message.type !== 'text' || !message.text?.body) continue;
          events.push({
            kind: 'message',
            providerMessageId: String(message.id),
            senderE164: normalizeWhatsAppE164(String(message.from)),
            text: String(message.text.body).slice(0, 4096),
            ...(message.timestamp ? { timestamp: new Date(Number(message.timestamp) * 1000) } : {}),
          });
        }
        for (const status of value?.statuses ?? []) {
          const normalized = normalizeStatus(String(status.status));
          if (!normalized) continue;
          events.push({
            kind: 'status',
            providerMessageId: String(status.id),
            status: normalized,
            ...(status.recipient_id
              ? { recipientE164: normalizeWhatsAppE164(String(status.recipient_id)) }
              : {}),
            ...(status.timestamp ? { timestamp: new Date(Number(status.timestamp) * 1000) } : {}),
            ...(status.errors?.[0]?.code ? { failureCode: `meta_${status.errors[0].code}` } : {}),
          });
        }
      }
    }

    return { providerAccountKey: input.providerAccountKey, events };
  }

  async sendMessage(input: WhatsAppProviderSendRequest): Promise<WhatsAppProviderSendReceipt> {
    assertServiceWindow(input.metadata?.last_inbound_at);
    assertReadyToSend(this.options, input.toE164, input.metadata?.canary);
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 10_000);
    const graphVersion = this.options.graphVersion ?? OT100_META_GRAPH_VERSION;
    const endpoint = `${trimSlash(this.options.baseUrl ?? 'https://graph.facebook.com')}/${graphVersion}/${this.options.phoneNumberId}/messages`;
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.options.accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: toMetaRecipient(input.toE164),
          type: 'text',
          text: {
            preview_url: false,
            body: input.text,
          },
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new WhatsAppProviderSendError(metaFailureCode(response.status), {
          retryable: response.status === 429 || response.status >= 500,
          httpStatus: response.status,
          retryAfterMs: retryAfterMs(response.headers.get('retry-after')),
        });
      }
      const payload = (await response.json()) as MetaSendResponse;
      const providerMessageId = payload.messages?.[0]?.id;
      if (!providerMessageId) {
        throw new WhatsAppProviderSendError('meta_whatsapp_missing_message_id', {
          retryable: true,
          httpStatus: response.status,
        });
      }
      return {
        provider: 'meta_cloud',
        providerMessageId,
        acceptedAt: new Date(),
        sink: false,
      };
    } catch (error) {
      if (error instanceof WhatsAppProviderSendError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new WhatsAppProviderSendError('meta_whatsapp_timeout', { retryable: true });
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new WhatsAppProviderSendError('meta_whatsapp_timeout', { retryable: true });
      }
      if (error instanceof TypeError) {
        throw new WhatsAppProviderSendError('meta_whatsapp_network_failure', { retryable: true });
      }
      throw new WhatsAppProviderSendError('meta_whatsapp_send_failure', { retryable: true });
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class SinkWhatsAppProviderAdapter implements WhatsAppProviderAdapter {
  verifyWebhook() {
    return true;
  }

  parseWebhook(input: {
    rawBody: Buffer;
    providerAccountKey: string;
  }): WhatsAppProviderWebhookParseResult {
    const payload = JSON.parse(input.rawBody.toString('utf8')) as {
      messages?: Array<{ id: string; from: string; text: string; timestamp?: string }>;
      statuses?: Array<{
        id: string;
        recipient?: string;
        status: WhatsAppProviderDeliveryStatus;
        timestamp?: string;
      }>;
    };
    return {
      providerAccountKey: input.providerAccountKey,
      events: [
        ...(payload.messages ?? []).map((message) => ({
          kind: 'message' as const,
          providerMessageId: message.id,
          senderE164: normalizeWhatsAppE164(message.from),
          text: message.text,
          ...(message.timestamp ? { timestamp: new Date(message.timestamp) } : {}),
        })),
        ...(payload.statuses ?? []).map((status) => ({
          kind: 'status' as const,
          providerMessageId: status.id,
          status: status.status,
          ...(status.recipient ? { recipientE164: normalizeWhatsAppE164(status.recipient) } : {}),
          ...(status.timestamp ? { timestamp: new Date(status.timestamp) } : {}),
        })),
      ],
    };
  }

  async sendMessage(_input: WhatsAppProviderSendRequest): Promise<WhatsAppProviderSendReceipt> {
    return {
      provider: 'sink',
      providerMessageId: `sink_${randomUUID()}`,
      acceptedAt: new Date(),
      sink: true,
    };
  }
}

type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      value?: {
        metadata?: {
          display_phone_number?: string;
          phone_number_id?: string;
        };
        messages?: Array<{
          id: string;
          from: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
        }>;
        statuses?: Array<{
          id: string;
          recipient_id?: string;
          status?: string;
          timestamp?: string;
          errors?: Array<{ code?: string | number }>;
        }>;
      };
    }>;
  }>;
};

type MetaSendResponse = {
  messaging_product?: string;
  contacts?: Array<{ input?: string; wa_id?: string }>;
  messages?: Array<{ id?: string; message_status?: string }>;
};

function normalizeStatus(value: string): WhatsAppProviderDeliveryStatus | null {
  if (value === 'sent') return 'sent';
  if (value === 'delivered') return 'delivered';
  if (value === 'read') return 'read';
  if (value === 'failed') return 'failed';
  return null;
}

export function loadMetaWhatsAppCloudAdapterOptions(
  source: NodeJS.ProcessEnv,
): MetaWhatsAppCloudAdapterOptions {
  const budget = Number(source.ONE_TIME_WHATSAPP_CANARY_BUDGET ?? '0');
  return {
    accessToken:
      source.ONE_TIME_WHATSAPP_CLOUD_ACCESS_TOKEN ?? source.ONE_TIME_WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: source.ONE_TIME_WHATSAPP_PHONE_NUMBER_ID,
    wabaId: source.ONE_TIME_WHATSAPP_WABA_ID,
    graphVersion: source.ONE_TIME_WHATSAPP_GRAPH_VERSION,
    providerEnv: source.ONE_TIME_WHATSAPP_PROVIDER_ENV,
    stagingIsolated: bool(source.ONE_TIME_WHATSAPP_STAGING_ISOLATED),
    realStagingEnabled: bool(source.ONE_TIME_WHATSAPP_REAL_STAGING_ENABLED),
    canaryAuthorized: bool(source.ONETIME_WHATSAPP_CANARY_AUTHORIZED),
    canaryRecipientE164: source.ONETIME_CANARY_WHATSAPP_RECIPIENT_E164,
    canaryBudget: Number.isFinite(budget) ? budget : 0,
    environmentFingerprint: source.ONE_TIME_WHATSAPP_STAGING_ENV_FINGERPRINT,
    expectedPhoneNumberId: source.ONE_TIME_WHATSAPP_PHONE_NUMBER_ID,
    expectedWabaId: source.ONE_TIME_WHATSAPP_WABA_ID,
  };
}

export function inspectMetaWhatsAppCloudReadiness(
  options: MetaWhatsAppCloudAdapterOptions,
): MetaWhatsAppCloudReadiness {
  const graphVersion = options.graphVersion ?? null;
  const blockers: string[] = [];
  const graphVersionSupported = graphVersion === OT100_META_GRAPH_VERSION;
  const canaryRecipientConfigured = Boolean(options.canaryRecipientE164);
  const canaryBudget = options.canaryBudget ?? 0;
  const environmentFingerprintOk =
    options.environmentFingerprint === OT100_STAGING_ENVIRONMENT_FINGERPRINT;
  if (!graphVersionSupported) blockers.push('graph_version_not_pinned_to_v25_0');
  if (!options.accessToken) blockers.push('access_token_missing');
  if (!options.phoneNumberId) blockers.push('phone_number_id_missing');
  if (!options.wabaId) blockers.push('waba_id_missing');
  if (!options.realStagingEnabled) blockers.push('real_staging_enable_flag_missing');
  if (options.providerEnv !== 'STAGING') blockers.push('provider_env_not_staging');
  if (!options.stagingIsolated) blockers.push('staging_isolation_not_confirmed');
  if (!options.canaryAuthorized) blockers.push('canary_authorization_missing');
  if (!canaryRecipientConfigured) blockers.push('canary_recipient_missing');
  if (canaryBudget < 1) blockers.push('canary_budget_missing');
  if (canaryBudget > 1) blockers.push('canary_budget_exceeds_ot100_limit');
  if (!environmentFingerprintOk) blockers.push('environment_fingerprint_mismatch');
  return {
    ready: blockers.length === 0,
    graph_version: graphVersion,
    graph_version_supported: graphVersionSupported,
    access_token_configured: Boolean(options.accessToken),
    phone_number_id_configured: Boolean(options.phoneNumberId),
    waba_id_configured: Boolean(options.wabaId),
    staging_enabled: Boolean(options.realStagingEnabled),
    provider_env: options.providerEnv ?? 'UNKNOWN',
    staging_isolated: Boolean(options.stagingIsolated),
    canary_authorized: Boolean(options.canaryAuthorized),
    canary_recipient_configured: canaryRecipientConfigured,
    canary_budget: canaryBudget,
    environment_fingerprint_ok: environmentFingerprintOk,
    blockers,
  };
}

export function createMetaWhatsAppCloudAdapterFromEnv(source: NodeJS.ProcessEnv) {
  return new MetaWhatsAppCloudAdapter(loadMetaWhatsAppCloudAdapterOptions(source));
}

function assertReadyToSend(
  options: MetaWhatsAppCloudAdapterOptions,
  toE164: string,
  canary: unknown,
) {
  const readiness = inspectMetaWhatsAppCloudReadiness(options);
  if (!readiness.ready) {
    throw new WhatsAppProviderSendError(`meta_whatsapp_not_ready_${readiness.blockers[0]}`, {
      retryable: false,
    });
  }
  if (canary !== true) {
    throw new WhatsAppProviderSendError('meta_whatsapp_canary_budget_not_claimed', {
      retryable: false,
    });
  }
  if (normalizeWhatsAppE164(toE164) !== normalizeWhatsAppE164(options.canaryRecipientE164 ?? '')) {
    throw new WhatsAppProviderSendError('meta_whatsapp_canary_destination_not_authorized', {
      retryable: false,
    });
  }
}

function assertServiceWindow(value: unknown) {
  if (typeof value !== 'string') {
    throw new WhatsAppProviderSendError('meta_whatsapp_customer_service_window_unknown', {
      retryable: false,
    });
  }
  const lastInbound = Date.parse(value);
  if (!Number.isFinite(lastInbound)) {
    throw new WhatsAppProviderSendError('meta_whatsapp_customer_service_window_unknown', {
      retryable: false,
    });
  }
  if (Date.now() - lastInbound > 24 * 60 * 60 * 1000) {
    throw new WhatsAppProviderSendError('meta_whatsapp_customer_service_window_closed', {
      retryable: false,
    });
  }
}

function bool(value: unknown) {
  return value === true || value === 'true' || value === '1';
}

function trimSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function toMetaRecipient(value: string) {
  return normalizeWhatsAppE164(value).replace(/[^\d]/g, '');
}

function retryAfterMs(value: string | null) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return undefined;
}

function metaFailureCode(status: number) {
  if (status === 401) return 'meta_whatsapp_unauthorized';
  if (status === 403) return 'meta_whatsapp_forbidden';
  if (status === 429) return 'meta_whatsapp_rate_limited';
  if (status >= 500) return 'meta_whatsapp_unavailable';
  return 'meta_whatsapp_rejected';
}
