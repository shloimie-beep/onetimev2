import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { findCanonicalCopy } from '../../../../../../packages/domain/src/communications/copy/catalog.ts';
import type { JobScope } from '../../../../../../packages/contracts/src/jobs/index.ts';
import type {
  ProviderRegistryBindingEvidence,
  ProviderRegistryBindingReadPort,
} from '../../../../../../packages/contracts/src/providers/v21-provider-core.ts';
import { createPostgresProviderCoreRepository } from '../../../../../../packages/db/src/providers/v21-provider-core-repository.ts';
import type { WorkerRunnerContext } from '../../registry/index.ts';

export const LAUNCH_WORKFLOW_KEYS = ['OT-01', 'OT-02A', 'OT-15', 'OT-02B'] as const;

export type LaunchCampaignAdapter = Readonly<{
  copyId: string;
  workflowId: (typeof LAUNCH_WORKFLOW_KEYS)[number];
  senderKey: 'office' | 'rabbi_campaign';
  subject: string;
  preheader: string;
  body: string;
  ctaLabel: string;
  ctaDestination: 'one_time_home_url' | 'one_time_signup_url' | 'one_time_member_login_url';
}>;

/**
 * Resolves only reviewed repository copy. It performs no provider lookup,
 * enrollment, publication, or delivery and fails closed on an incomplete or
 * unrelated catalog entry.
 */
export function readCanonicalLaunchCampaign(copyId: string): LaunchCampaignAdapter | null {
  const copy = findCanonicalCopy(copyId);
  if (
    !copy ||
    copy.provider !== 'ghl' ||
    !LAUNCH_WORKFLOW_KEYS.includes(copy.workflowId as (typeof LAUNCH_WORKFLOW_KEYS)[number]) ||
    (copy.sender !== 'office' && copy.sender !== 'rabbi_campaign') ||
    !copy.preheader ||
    !copy.ctaLabel ||
    !copy.ctaDestination
  ) {
    return null;
  }
  return {
    copyId: copy.id,
    workflowId: copy.workflowId as (typeof LAUNCH_WORKFLOW_KEYS)[number],
    senderKey: copy.sender,
    subject: copy.subject,
    preheader: copy.preheader,
    body: copy.body,
    ctaLabel: copy.ctaLabel,
    ctaDestination: copy.ctaDestination,
  };
}

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

type CanonicalOt16Registry = {
  ghlId: string;
  observedStatus: string;
  registryDigest: string;
  renderedBodyDigest: string;
};

export type Ot16AuthorityDependencies = {
  readRegistry(expiryAt: string): Promise<CanonicalOt16Registry | null>;
  bindingReader: ProviderRegistryBindingReadPort;
};

/**
 * Reads only canonical runtime configuration, the source-controlled GHL
 * registry, the P28 saved readback, and the exact active F06 binding. There is
 * intentionally no fallback that fabricates a provider account, workflow, or
 * binding from configuration alone.
 */
export async function inspectDefaultOt16Authority(
  context: WorkerRunnerContext,
  dependencies?: Ot16AuthorityDependencies,
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
  if (!context.config.oneTimeFreeAccessExpiresAt) {
    return { ready: false, reason: 'provider_configuration_missing' };
  }
  if (context.config.highLevelLocationId !== OT16_CANONICAL_LOCATION_ID) {
    return { ready: false, reason: 'location_mismatch' };
  }

  const registry = await (dependencies?.readRegistry ?? readCanonicalOt16Registry)(
    context.config.oneTimeFreeAccessExpiresAt,
  );
  if (!registry) return { ready: false, reason: 'ot16_registry_unavailable' };
  if (!registry.ghlId.trim()) return { ready: false, reason: 'ot16_identity_missing' };
  if (!['SAVED_REOPENED', 'ACTIVE_CONFIGURED', 'ACTIVE_TESTED'].includes(registry.observedStatus)) {
    return { ready: false, reason: 'ot16_registry_not_saved_reopened' };
  }

  const selected = await context.pool.query<{
    readback: unknown;
    provider_read_at: string | Date | null;
    version: string | number;
  }>(
    `SELECT readback, provider_read_at, version
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
  const providerReadAt = safeIso(selected.rows[0]?.provider_read_at);
  const readbackVersion = Number(selected.rows[0]?.version);
  if (
    readback.workflow_key !== OT16_WORKFLOW_KEY ||
    readback.provider_workflow_ref_hash !== expectedProviderReference ||
    !['SAVED_REOPENED', 'ACTIVE_CONFIGURED', 'ACTIVE_TESTED'].includes(
      String(readback.readiness),
    ) ||
    !matchesApprovedOt16Digests(readback, registry) ||
    !delivery ||
    typeof delivery.provider_read_at !== 'string' ||
    safeIso(delivery.provider_read_at) !== providerReadAt ||
    providerReadAt === null ||
    !Number.isSafeInteger(readbackVersion) ||
    readbackVersion < 1
  ) {
    return { ready: false, reason: 'ot16_readback_mismatch' };
  }

  const binding = await readOt16F06Binding({
    reader: dependencies?.bindingReader ?? createPostgresProviderCoreRepository(context.pool),
    runtimeTier: context.config.oneTimeRuntimeTier,
    verificationEnvironmentId: context.config.oneTimeVerificationEnvironmentId,
    expectedProviderAccountRefHash: createHash('sha256')
      .update(OT16_CANONICAL_LOCATION_ID)
      .digest('hex'),
    expectedRegistryEvidenceDigest: registry.registryDigest,
    expectedProviderReadbackEvidenceDigest: ot16ProviderReadbackEvidenceDigest({
      workflowKey: OT16_WORKFLOW_KEY,
      providerWorkflowRefHash: expectedProviderReference,
      readiness: String(readback.readiness),
      registryDigest: registry.registryDigest,
      renderedBodyDigest: registry.renderedBodyDigest,
      providerReadAt,
    }),
    expectedVersion: readbackVersion,
    observedNotBefore: providerReadAt,
  });
  if (!binding) return { ready: false, reason: 'f06_binding_unavailable' };

  return { ready: true, safeProviderReference: expectedProviderReference };
}

export async function readOt16F06Binding(input: {
  reader: ProviderRegistryBindingReadPort;
  runtimeTier: JobScope['runtime_tier'];
  verificationEnvironmentId: JobScope['verification_environment_id'];
  expectedProviderAccountRefHash: string;
  expectedRegistryEvidenceDigest: string;
  expectedProviderReadbackEvidenceDigest: string;
  expectedVersion: number;
  observedNotBefore: string;
}): Promise<ProviderRegistryBindingEvidence | null> {
  if (
    !isSha256(input.expectedProviderAccountRefHash) ||
    !isSha256(input.expectedRegistryEvidenceDigest) ||
    !isSha256(input.expectedProviderReadbackEvidenceDigest) ||
    !Number.isSafeInteger(input.expectedVersion) ||
    input.expectedVersion < 1 ||
    !Number.isFinite(Date.parse(input.observedNotBefore))
  ) {
    return null;
  }
  const evidence = await input.reader.readActiveRegistryBinding({
    registry_binding_key: OT16_REGISTRY_BINDING_KEY,
    provider: 'highlevel',
    scope: {
      product: 'one_time_mishnayos',
      runtime_tier: input.runtimeTier,
      verification_environment_id: input.verificationEnvironmentId,
    },
    operation_type: OT16_OPERATION_TYPE,
    effect_kind: 'mutation',
    expected_provider_account_ref_hash: input.expectedProviderAccountRefHash,
    expected_registry_evidence_digest: input.expectedRegistryEvidenceDigest,
    expected_provider_readback_evidence_digest: input.expectedProviderReadbackEvidenceDigest,
    expected_version: input.expectedVersion,
    observed_not_before: input.observedNotBefore,
  });
  if (
    !evidence ||
    evidence.binding.registry_binding_key !== OT16_REGISTRY_BINDING_KEY ||
    evidence.binding.provider !== 'highlevel' ||
    evidence.binding.scope.product !== 'one_time_mishnayos' ||
    evidence.binding.scope.runtime_tier !== input.runtimeTier ||
    evidence.binding.scope.verification_environment_id !== input.verificationEnvironmentId ||
    evidence.binding.provider_account_ref_hash !== input.expectedProviderAccountRefHash ||
    evidence.binding.active !== true ||
    !evidence.binding.allowed_operation_types.includes(OT16_OPERATION_TYPE) ||
    !['allowed', 'orchestration_only'].includes(evidence.binding.mutation_policy) ||
    evidence.registry_evidence_digest !== input.expectedRegistryEvidenceDigest ||
    evidence.provider_readback_evidence_digest !== input.expectedProviderReadbackEvidenceDigest ||
    evidence.version !== input.expectedVersion ||
    !Number.isFinite(Date.parse(evidence.observed_at)) ||
    Date.parse(evidence.observed_at) < Date.parse(input.observedNotBefore)
  ) {
    return null;
  }
  return evidence;
}

export function ot16ProviderReadbackEvidenceDigest(input: {
  workflowKey: typeof OT16_WORKFLOW_KEY;
  providerWorkflowRefHash: string;
  readiness: string;
  registryDigest: string;
  renderedBodyDigest: string;
  providerReadAt: string;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        provider_read_at: input.providerReadAt,
        provider_workflow_ref_hash: input.providerWorkflowRefHash,
        readiness: input.readiness,
        registry_digest: input.registryDigest,
        rendered_body_digest: input.renderedBodyDigest,
        workflow_key: input.workflowKey,
      }),
      'utf8',
    )
    .digest('hex');
}

async function readCanonicalOt16Registry(expiryAt: string): Promise<CanonicalOt16Registry | null> {
  try {
    const source = await import('../../../../../../scripts/highlevel/workflow-registry-source.ts');
    const campaigns =
      await import('../../../../../../packages/domain/src/communications/workflows/campaigns/index.ts');
    const record = source.canonicalWorkflowAssets.find((asset) => asset.key === OT16_WORKFLOW_KEY);
    if (!record) return null;
    const registryDigest = createHash('sha256')
      .update(await readFile(source.workflowRegistryPath))
      .digest('hex');
    const renderedBodyDigest = createHash('sha256')
      .update(
        campaigns.buildOt16Notice({
          checkpoint_days: 14,
          expiry_at: expiryAt,
        }).body,
        'utf8',
      )
      .digest('hex');
    return {
      ghlId: record.ghlId,
      observedStatus: record.observedStatus,
      registryDigest,
      renderedBodyDigest,
    };
  } catch {
    return null;
  }
}

export function matchesApprovedOt16Digests(
  readback: Record<string, unknown>,
  approved: { registryDigest: string; renderedBodyDigest: string },
): boolean {
  return (
    readback.registry_digest === approved.registryDigest &&
    readback.rendered_body_digest === approved.renderedBodyDigest
  );
}

function safeIso(value: unknown): string | null {
  if (typeof value !== 'string' && !(value instanceof Date)) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/u.test(value);
}
