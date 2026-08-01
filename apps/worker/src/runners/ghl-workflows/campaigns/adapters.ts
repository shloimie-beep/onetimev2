import { createHash } from 'node:crypto';

import type { WorkerRunnerContext } from '../../registry/index.ts';

export const OT16_WORKFLOW_KEY = 'OT-16' as const;
export const OT16_OPERATION_TYPE = 'ghl.workflow.ot16_checkpoint' as const;
export const OT16_REGISTRY_BINDING_KEY = 'highlevel.ot16.primary' as const;
export const OT16_CANONICAL_LOCATION_ID = 'pBSnOK2nkdxp6gf9Rg3o' as const;

export type Ot16AuthorityBlockedReason =
  | 'production_read_only'
  | 'verification_writes_disabled'
  | 'provider_mode_disabled'
  | 'provider_configuration_missing'
  | 'location_mismatch'
  | 'ot16_registry_unavailable'
  | 'ot16_identity_missing'
  | 'ot16_registry_not_saved_reopened'
  | 'ot16_readback_missing'
  | 'ot16_readback_mismatch'
  | 'f06_binding_unavailable';

export type Ot16AuthorityDecision =
  | { ready: false; reason: Ot16AuthorityBlockedReason }
  | { ready: true; safeProviderReference: string };

/**
 * Reads only canonical runtime configuration, the source-controlled GHL
 * registry, and the P28 saved readback. There is intentionally no fallback
 * that fabricates an F06 binding. Until the canonical binding reader exists,
 * this adapter returns f06_binding_unavailable after every earlier gate has
 * been proven.
 */
export async function inspectDefaultOt16Authority(
  context: WorkerRunnerContext,
): Promise<Ot16AuthorityDecision> {
  if (context.config.oneTimeVerificationEnvironmentId === 'production_read_only') {
    return { ready: false, reason: 'production_read_only' };
  }
  if (!context.config.oneTimeVerificationWritesAllowed) {
    return { ready: false, reason: 'verification_writes_disabled' };
  }
  if (
    context.config.deliveryProviderMode !== 'provider' ||
    !context.config.deliveryProviderTransportEnabled ||
    context.config.highLevelEventSyncMode !== 'provider'
  ) {
    return { ready: false, reason: 'provider_mode_disabled' };
  }
  if (!context.config.highLevelPrivateIntegrationsToken) {
    return { ready: false, reason: 'provider_configuration_missing' };
  }
  if (context.config.highLevelLocationId !== OT16_CANONICAL_LOCATION_ID) {
    return { ready: false, reason: 'location_mismatch' };
  }

  const registry = await readCanonicalOt16Registry();
  if (!registry) return { ready: false, reason: 'ot16_registry_unavailable' };
  if (!registry.ghlId.trim()) return { ready: false, reason: 'ot16_identity_missing' };
  if (!['SAVED_REOPENED', 'ACTIVE_CONFIGURED', 'ACTIVE_TESTED'].includes(registry.observedStatus)) {
    return { ready: false, reason: 'ot16_registry_not_saved_reopened' };
  }

  const selected = await context.pool.query<{ readback: unknown }>(
    `SELECT readback
       FROM onetime.communication_workflow_readback
      WHERE workflow_key = $1`,
    [OT16_WORKFLOW_KEY],
  );
  const rawReadback = selected.rows[0]?.readback;
  if (!rawReadback || typeof rawReadback !== 'object' || Array.isArray(rawReadback)) {
    return { ready: false, reason: 'ot16_readback_missing' };
  }

  const readback = rawReadback as Record<string, unknown>;
  const delivery =
    readback.delivery && typeof readback.delivery === 'object' && !Array.isArray(readback.delivery)
      ? (readback.delivery as Record<string, unknown>)
      : null;
  const expectedProviderReference = createHash('sha256').update(registry.ghlId).digest('hex');
  if (
    readback.workflow_key !== OT16_WORKFLOW_KEY ||
    readback.provider_workflow_ref_hash !== expectedProviderReference ||
    !['SAVED_REOPENED', 'ACTIVE_CONFIGURED', 'ACTIVE_TESTED'].includes(
      String(readback.readiness),
    ) ||
    !isSha256(readback.registry_digest) ||
    !isSha256(readback.rendered_body_digest) ||
    !delivery ||
    typeof delivery.provider_read_at !== 'string' ||
    delivery.provider_read_at.trim() === ''
  ) {
    return { ready: false, reason: 'ot16_readback_mismatch' };
  }

  // F06 exposes the binding contract but no canonical active-binding reader
  // in this integration. Guessing one from location or workflow identity would
  // violate the provider-identity and fencing contract.
  return { ready: false, reason: 'f06_binding_unavailable' };
}

async function readCanonicalOt16Registry(): Promise<{
  ghlId: string;
  observedStatus: string;
} | null> {
  try {
    const source = await import('../../../../../../scripts/highlevel/workflow-registry-source.ts');
    const record = source.canonicalWorkflowAssets.find((asset) => asset.key === OT16_WORKFLOW_KEY);
    if (!record) return null;
    return { ghlId: record.ghlId, observedStatus: record.observedStatus };
  } catch {
    return null;
  }
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}
