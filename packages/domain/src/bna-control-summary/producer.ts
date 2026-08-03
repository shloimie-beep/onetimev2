import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import {
  BNA_CONTROL_SUMMARY_REPLAY_WINDOW_SECONDS,
  BNA_CONTROL_SUMMARY_SCHEMA_VERSION,
  bnaControlSummaryEventSchema,
  type BnaControlSummaryEvent,
  type BnaControlSummaryEventType,
  type BnaControlSummaryInput,
} from './contract.ts';

export const BNA_CONTROL_SUMMARY_CONFIG_NAMES = {
  enabled: 'BNA_CONTROL_SUMMARY_EVENTS_ENABLED',
  endpointUrl: 'BNA_CONTROL_SUMMARY_ENDPOINT_URL',
  keyId: 'BNA_CONTROL_SUMMARY_HMAC_KEY_ID',
  secret: 'BNA_CONTROL_SUMMARY_HMAC_SECRET',
} as const;

const FORBIDDEN_FIELD_PATTERN =
  /(?:^|_)(?:note|notes|message|messages|transcript|transcripts|contact|contacts|student|students|credential|credentials|cookie|cookies|private)(?:_|$)/i;
const FORBIDDEN_SUMMARY_TEXT_PATTERN =
  /\b(?:notes?|messages?|transcripts?|contacts?|students?|credentials?|cookies?|private fields?)\b/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /(?:\+?\d[\s().-]*){8,}/;
const SENSITIVE_QUERY_KEY_PATTERN =
  /(?:token|secret|password|passcode|credential|cookie|session|email|phone|contact|student|message|note|transcript)/i;

export type BnaControlSummaryProducerConfig =
  | {
      enabled: false;
      endpointUrl: null;
      keyId: null;
      secret: null;
    }
  | {
      enabled: true;
      endpointUrl: string;
      keyId: string;
      secret: string;
    };

export type BnaControlSummaryDeliveryPlan = {
  envelope: BnaControlSummaryEvent;
  rawBody: string;
  headers: Readonly<Record<string, string>>;
  signatureHex: string;
};

export type BnaControlSummaryDeliveryResult = {
  delivered: true;
  attempts: number;
  status: number;
  eventId: string;
  idempotencyKey: string;
};

export class BnaControlSummaryProducerError extends Error {
  constructor(
    public readonly code:
      | 'producer_disabled'
      | 'configuration_invalid'
      | 'privacy_rejected'
      | 'signature_invalid'
      | 'replay_expired'
      | 'delivery_failed',
    message: string,
  ) {
    super(message);
    this.name = 'BnaControlSummaryProducerError';
  }
}

export function loadBnaControlSummaryProducerConfig(
  source: NodeJS.ProcessEnv,
): BnaControlSummaryProducerConfig {
  const enabled = booleanValue(source[BNA_CONTROL_SUMMARY_CONFIG_NAMES.enabled]);
  if (!enabled) {
    return { enabled: false, endpointUrl: null, keyId: null, secret: null };
  }

  const endpointUrl = source[BNA_CONTROL_SUMMARY_CONFIG_NAMES.endpointUrl]?.trim();
  const keyId = source[BNA_CONTROL_SUMMARY_CONFIG_NAMES.keyId]?.trim();
  const secret = source[BNA_CONTROL_SUMMARY_CONFIG_NAMES.secret]?.trim();
  if (!endpointUrl || !keyId || !secret) {
    throw new BnaControlSummaryProducerError(
      'configuration_invalid',
      'The BNA summary endpoint, key ID, and secret are required when the producer is enabled.',
    );
  }

  let parsedEndpoint: URL;
  try {
    parsedEndpoint = new URL(endpointUrl);
  } catch {
    throw new BnaControlSummaryProducerError(
      'configuration_invalid',
      'The BNA summary endpoint must be a valid HTTPS URL.',
    );
  }
  if (parsedEndpoint.protocol !== 'https:' || parsedEndpoint.username || parsedEndpoint.password) {
    throw new BnaControlSummaryProducerError(
      'configuration_invalid',
      'The BNA summary endpoint must be HTTPS and must not contain credentials.',
    );
  }
  if (keyId.length < 3 || keyId.length > 80 || secret.length < 32) {
    throw new BnaControlSummaryProducerError(
      'configuration_invalid',
      'The BNA summary key ID or HMAC secret does not meet the bounded producer policy.',
    );
  }
  return { enabled: true, endpointUrl: parsedEndpoint.toString(), keyId, secret };
}

export function stableBnaControlSummaryIdentity(input: {
  eventType: BnaControlSummaryEventType;
  sourceProduct: string;
  sourceWorkspace: string;
  sourceObjectType: string;
  sourceObjectId: string;
  sourceObjectVersion: string;
}) {
  const material = [
    BNA_CONTROL_SUMMARY_SCHEMA_VERSION,
    input.eventType,
    input.sourceProduct,
    input.sourceWorkspace,
    input.sourceObjectType,
    input.sourceObjectId,
    input.sourceObjectVersion,
  ].join('\0');
  const digest = createHash('sha256').update(material, 'utf8').digest('hex');
  return {
    eventId: `ot-bna-event-${digest.slice(0, 40)}`,
    idempotencyKey: `ot-bna-idem-${digest}`,
  } as const;
}

export function createBnaControlSummaryProducer(input: {
  config: BnaControlSummaryProducerConfig;
  now?: () => Date;
  fetchImpl?: typeof fetch;
}) {
  const now = input.now ?? (() => new Date());
  const fetchImpl = input.fetchImpl ?? fetch;

  function prepare(rawInput: BnaControlSummaryInput | Record<string, unknown>) {
    const config = enabledConfig(input.config);
    assertNoForbiddenFields(rawInput);
    const signedAt = now().toISOString();
    const envelope = bnaControlSummaryEventSchema.parse({
      ...rawInput,
      schema_version: BNA_CONTROL_SUMMARY_SCHEMA_VERSION,
      data_classification: 'sanitized_summary',
      signature_algorithm: 'hmac-sha256',
      key_id: config.keyId,
      signed_at: signedAt,
      replay_window_seconds: BNA_CONTROL_SUMMARY_REPLAY_WINDOW_SECONDS,
    });
    assertSanitizedEnvelope(envelope);
    const rawBody = JSON.stringify(envelope);
    const signatureHex = signRawBody(rawBody, config.secret);
    return {
      envelope,
      rawBody,
      signatureHex,
      headers: Object.freeze({
        'Content-Type': 'application/json; charset=utf-8',
        'X-BNA-Summary-Key-Id': config.keyId,
        'X-BNA-Summary-Signature': `sha256=${signatureHex}`,
      }),
    } satisfies BnaControlSummaryDeliveryPlan;
  }

  function verify(plan: BnaControlSummaryDeliveryPlan, verificationTime = now()) {
    const config = enabledConfig(input.config);
    const parsed = bnaControlSummaryEventSchema.parse(JSON.parse(plan.rawBody));
    assertSanitizedEnvelope(parsed);
    const ageMs = Math.abs(verificationTime.getTime() - Date.parse(parsed.signed_at));
    if (ageMs > BNA_CONTROL_SUMMARY_REPLAY_WINDOW_SECONDS * 1_000) {
      throw new BnaControlSummaryProducerError(
        'replay_expired',
        'The BNA summary delivery plan is outside its 300-second replay window.',
      );
    }
    const expected = signRawBody(plan.rawBody, config.secret);
    if (!safeHexEqual(expected, plan.signatureHex)) {
      throw new BnaControlSummaryProducerError(
        'signature_invalid',
        'The BNA summary raw-body signature does not match.',
      );
    }
    if (
      parsed.key_id !== config.keyId ||
      plan.headers['X-BNA-Summary-Key-Id'] !== config.keyId ||
      plan.headers['X-BNA-Summary-Signature'] !== `sha256=${expected}`
    ) {
      throw new BnaControlSummaryProducerError(
        'signature_invalid',
        'The BNA summary key or signature headers do not match the signed envelope.',
      );
    }
    return parsed;
  }

  async function deliver(
    plan: BnaControlSummaryDeliveryPlan,
    options: { maxAttempts?: number } = {},
  ): Promise<BnaControlSummaryDeliveryResult> {
    const config = enabledConfig(input.config);
    const maxAttempts = options.maxAttempts ?? 3;
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) {
      throw new BnaControlSummaryProducerError(
        'configuration_invalid',
        'BNA summary delivery attempts must be an integer between 1 and 5.',
      );
    }

    let lastStatus = 0;
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const envelope = verify(plan);
      try {
        const response = await fetchImpl(config.endpointUrl, {
          method: 'POST',
          headers: plan.headers,
          body: plan.rawBody,
          redirect: 'error',
        });
        lastStatus = response.status;
        if (response.ok) {
          return {
            delivered: true,
            attempts: attempt,
            status: response.status,
            eventId: envelope.event_id,
            idempotencyKey: envelope.idempotency_key,
          };
        }
        if (response.status < 500 && response.status !== 408 && response.status !== 429) break;
      } catch (error) {
        lastError = error;
      }
    }
    throw new BnaControlSummaryProducerError(
      'delivery_failed',
      `BNA summary delivery failed after bounded retries (status ${lastStatus || 'unavailable'}${lastError ? ', transport error' : ''}).`,
    );
  }

  return { prepare, verify, deliver } as const;
}

function enabledConfig(
  config: BnaControlSummaryProducerConfig,
): Extract<BnaControlSummaryProducerConfig, { enabled: true }> {
  if (!config.enabled) {
    throw new BnaControlSummaryProducerError(
      'producer_disabled',
      'BNA control summary events are disabled.',
    );
  }
  return config;
}

function signRawBody(rawBody: string, secret: string) {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

function safeHexEqual(left: string, right: string) {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

function assertNoForbiddenFields(value: unknown, path = 'event') {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForbiddenFields(entry, `${path}[${index}]`));
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_FIELD_PATTERN.test(key)) {
      throw new BnaControlSummaryProducerError(
        'privacy_rejected',
        `Forbidden private field rejected at ${path}.${key}.`,
      );
    }
    assertNoForbiddenFields(entry, `${path}.${key}`);
  }
}

function assertSanitizedEnvelope(envelope: BnaControlSummaryEvent) {
  const boundedText = [
    envelope.source_product,
    envelope.source_workspace,
    envelope.source_object_type,
    envelope.title,
    envelope.status,
    envelope.assignee,
  ].join('\n');
  if (
    FORBIDDEN_SUMMARY_TEXT_PATTERN.test(boundedText) ||
    EMAIL_PATTERN.test(boundedText) ||
    PHONE_PATTERN.test(boundedText)
  ) {
    throw new BnaControlSummaryProducerError(
      'privacy_rejected',
      'The BNA summary contains private or contact-like text.',
    );
  }
  const deepLink = new URL(envelope.deep_link);
  if (deepLink.username || deepLink.password) {
    throw new BnaControlSummaryProducerError(
      'privacy_rejected',
      'The BNA summary deep link must not contain credentials.',
    );
  }
  for (const key of deepLink.searchParams.keys()) {
    if (SENSITIVE_QUERY_KEY_PATTERN.test(key)) {
      throw new BnaControlSummaryProducerError(
        'privacy_rejected',
        'The BNA summary deep link contains a sensitive query field.',
      );
    }
  }
}

function booleanValue(value: string | undefined) {
  return value === 'true' || value === '1';
}
