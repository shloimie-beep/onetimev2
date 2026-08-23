import {
  providerCanonicalStateSchema,
  type ProviderCanonicalState,
  type ProviderEnvironment,
  type ProviderEventRecord,
  type ProviderKey,
} from '../../../contracts/src/providers/events.ts';
import { redactedRefHash, sha256Hex, stableProviderKey } from './shared.ts';

export type BuildProviderEventInput = {
  accountKey: string;
  productKey: string;
  provider: ProviderKey;
  environment: ProviderEnvironment;
  providerEventRef: string;
  eventType: string;
  canonicalState: ProviderCanonicalState;
  providerCreatedAt?: string | null;
  objectRefs?: Record<string, unknown>;
  minimizedPayload?: Record<string, unknown>;
};

export function buildProviderEventRecord(input: BuildProviderEventInput): ProviderEventRecord {
  const canonicalState = providerCanonicalStateSchema.parse(input.canonicalState);
  const minimizedPayload = input.minimizedPayload ?? {};
  const objectRefs = input.objectRefs ?? {};
  const payloadDigest = sha256Hex(JSON.stringify({ objectRefs, minimizedPayload }));
  const providerEventRefHash = redactedRefHash(input.providerEventRef);
  return {
    event_key: stableProviderKey('provider_event', [
      input.provider,
      input.environment,
      providerEventRefHash,
      input.eventType,
    ]),
    account_key: input.accountKey,
    product_key: input.productKey,
    provider: input.provider,
    environment: input.environment,
    provider_event_ref_hash: providerEventRefHash,
    event_type: input.eventType,
    canonical_state: canonicalState,
    provider_created_at: input.providerCreatedAt ?? null,
    payload_digest: payloadDigest,
    object_refs: objectRefs,
    minimized_payload: minimizedPayload,
  };
}

export function normalizeResendEventState(eventType: string): ProviderCanonicalState {
  const normalized = eventType.trim().toLowerCase();
  switch (normalized) {
    case 'email.delivered':
      return 'delivered';
    case 'email.bounced':
      return 'bounced';
    case 'email.complained':
      return 'complained';
    case 'email.failed':
      return 'failed';
    case 'email.sent':
      return 'provider_accepted';
    case 'email.suppressed':
      return 'suppressed';
    default:
      return 'unavailable';
  }
}

export function normalizeWapiEventState(
  eventType: string,
  status?: string,
): ProviderCanonicalState {
  const normalized = `${eventType} ${status ?? ''}`.toLowerCase();
  if (normalized.includes('delivered') || normalized.includes('read')) return 'delivered';
  if (normalized.includes('failed') || normalized.includes('undeliverable')) return 'failed';
  if (normalized.includes('expired')) return 'expired';
  if (
    normalized.includes('accepted') ||
    normalized.includes('queued') ||
    normalized.includes('sent')
  ) {
    return 'provider_accepted';
  }
  return 'unavailable';
}
