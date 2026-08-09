import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';

import { Pool, type PoolClient } from 'pg';

type Provider = 's3' | 'openai' | 'vimeo';

export interface DesiredProviderBinding {
  registryBindingKey: string;
  provider: Provider;
  providerAccountRefHash: string;
  allowedOperationTypes: readonly string[];
  registryEvidenceDigest: string;
  providerReadbackEvidenceDigest: string;
  observedAt: string;
}

export interface ExistingProviderBinding {
  registry_binding_key: string;
  provider: string;
  provider_account_ref_hash: string;
  allowed_operation_types: string[];
  mutation_policy: string;
  active: boolean;
  registry_evidence_digest: string;
  provider_readback_evidence_digest: string;
  observed_at: Date | string;
  version: string | number;
}

export type ProviderBindingPlan =
  | { action: 'insert'; version: 1 }
  | { action: 'no_change'; version: number }
  | { action: 'update'; expectedVersion: number; version: number };

const FIXED_SCOPE = {
  productKey: 'one_time_mishnayos',
  runtimeTier: 'production',
  verificationEnvironmentId: 'production_operator_canary',
} as const;

const FIXED_BINDINGS = [
  {
    provider: 's3',
    registryBindingKey: 's3_content_original_primary',
    allowedOperationTypes: ['multipart_original_write'],
    proofPrefix: 'CONTENT_S3',
  },
  {
    provider: 'openai',
    registryBindingKey: 'openai_content_processing_primary',
    allowedOperationTypes: ['transcribe_and_generate_learning_draft'],
    proofPrefix: 'CONTENT_OPENAI',
  },
  {
    provider: 'vimeo',
    registryBindingKey: 'vimeo_publication_primary',
    allowedOperationTypes: ['publish_private', 'revoke_private'],
    proofPrefix: 'CONTENT_VIMEO',
  },
] as const;

export function desiredMediaProviderBindings(source: NodeJS.ProcessEnv): DesiredProviderBinding[] {
  return FIXED_BINDINGS.map((fixed) => ({
    registryBindingKey: fixed.registryBindingKey,
    provider: fixed.provider,
    providerAccountRefHash: requiredSha256(
      source[`${fixed.proofPrefix}_PROVIDER_ACCOUNT_REF_HASH`],
      `${fixed.proofPrefix}_PROVIDER_ACCOUNT_REF_HASH`,
    ),
    allowedOperationTypes: [...fixed.allowedOperationTypes],
    registryEvidenceDigest: requiredSha256(
      source[`${fixed.proofPrefix}_REGISTRY_EVIDENCE_DIGEST`],
      `${fixed.proofPrefix}_REGISTRY_EVIDENCE_DIGEST`,
    ),
    providerReadbackEvidenceDigest: requiredSha256(
      source[`${fixed.proofPrefix}_PROVIDER_READBACK_EVIDENCE_DIGEST`],
      `${fixed.proofPrefix}_PROVIDER_READBACK_EVIDENCE_DIGEST`,
    ),
    observedAt: requiredIso(
      source[`${fixed.proofPrefix}_REGISTRY_OBSERVED_NOT_BEFORE`],
      `${fixed.proofPrefix}_REGISTRY_OBSERVED_NOT_BEFORE`,
    ),
  }));
}

export function planProviderRegistryBinding(
  existing: ExistingProviderBinding | undefined,
  desired: DesiredProviderBinding,
): ProviderBindingPlan {
  if (!existing) return { action: 'insert', version: 1 };
  if (
    existing.registry_binding_key !== desired.registryBindingKey ||
    existing.provider !== desired.provider
  ) {
    throw new Error(`provider_registry_immutable_identity_mismatch:${desired.registryBindingKey}`);
  }
  const version = Number(existing.version);
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error(`provider_registry_invalid_existing_version:${desired.registryBindingKey}`);
  }
  const matches =
    existing.provider_account_ref_hash === desired.providerAccountRefHash &&
    isDeepStrictEqual(existing.allowed_operation_types, desired.allowedOperationTypes) &&
    existing.mutation_policy === 'allowed' &&
    existing.active === true &&
    existing.registry_evidence_digest === desired.registryEvidenceDigest &&
    existing.provider_readback_evidence_digest === desired.providerReadbackEvidenceDigest &&
    new Date(existing.observed_at).toISOString() === desired.observedAt;
  return matches
    ? { action: 'no_change', version }
    : { action: 'update', expectedVersion: version, version: version + 1 };
}

async function applyBinding(client: PoolClient, desired: DesiredProviderBinding, apply: boolean) {
  const result = await client.query<ExistingProviderBinding>(
    `SELECT registry_binding_key, provider, provider_account_ref_hash,
            allowed_operation_types, mutation_policy, active,
            registry_evidence_digest, provider_readback_evidence_digest,
            observed_at, version
       FROM onetime.provider_registry_binding_v21
      WHERE registry_binding_key = $1
        AND product_key = $2
        AND runtime_tier = $3
        AND verification_environment_id = $4
      ${apply ? 'FOR UPDATE' : ''}`,
    [
      desired.registryBindingKey,
      FIXED_SCOPE.productKey,
      FIXED_SCOPE.runtimeTier,
      FIXED_SCOPE.verificationEnvironmentId,
    ],
  );
  if (result.rows.length > 1) throw new Error('provider_registry_binding_ambiguous');
  const plan = planProviderRegistryBinding(result.rows[0], desired);
  if (!apply || plan.action === 'no_change') return plan;

  if (plan.action === 'insert') {
    await client.query(
      `INSERT INTO onetime.provider_registry_binding_v21
       (registry_binding_key, provider, product_key, runtime_tier,
        verification_environment_id, provider_account_ref_hash,
        allowed_operation_types, mutation_policy, active,
        registry_evidence_digest, provider_readback_evidence_digest,
        observed_at, version)
       VALUES ($1,$2,$3,$4,$5,$6,$7::text[],'allowed',true,$8,$9,$10,1)`,
      values(desired),
    );
    return plan;
  }

  const updated = await client.query(
    `UPDATE onetime.provider_registry_binding_v21
        SET provider_account_ref_hash = $6,
            allowed_operation_types = $7::text[],
            mutation_policy = 'allowed',
            active = true,
            registry_evidence_digest = $8,
            provider_readback_evidence_digest = $9,
            observed_at = $10,
            version = $11,
            updated_at = GREATEST(now(), updated_at + interval '1 microsecond')
      WHERE registry_binding_key = $1
        AND provider = $2
        AND product_key = $3
        AND runtime_tier = $4
        AND verification_environment_id = $5
        AND version = $12`,
    [...values(desired), plan.version, plan.expectedVersion],
  );
  if (updated.rowCount !== 1) throw new Error('provider_registry_concurrent_update');
  return plan;
}

function values(desired: DesiredProviderBinding) {
  return [
    desired.registryBindingKey,
    desired.provider,
    FIXED_SCOPE.productKey,
    FIXED_SCOPE.runtimeTier,
    FIXED_SCOPE.verificationEnvironmentId,
    desired.providerAccountRefHash,
    desired.allowedOperationTypes,
    desired.registryEvidenceDigest,
    desired.providerReadbackEvidenceDigest,
    desired.observedAt,
  ];
}

async function main() {
  const apply = process.argv.includes('--apply');
  if (apply && !process.argv.includes('--confirm=production_operator_canary')) {
    throw new Error('apply_requires_confirm_production_operator_canary');
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required and will not be printed');
  const desired = desiredMediaProviderBindings(process.env);
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    if (apply) await client.query('BEGIN');
    const results = [];
    for (const binding of desired) {
      const plan = await applyBinding(client, binding, apply);
      results.push({
        provider: binding.provider,
        registryBindingKey: binding.registryBindingKey,
        action: apply ? plan.action : `would_${plan.action}`,
        version: plan.version,
        observedAt: binding.observedAt,
      });
    }
    if (apply) await client.query('COMMIT');
    process.stdout.write(`${JSON.stringify({ scope: FIXED_SCOPE, results }, null, 2)}\n`);
  } catch (error) {
    if (apply) await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

function requiredSha256(value: string | undefined, name: string) {
  if (!value || !/^[a-f0-9]{64}$/u.test(value)) throw new Error(`${name} must be a sha256 digest`);
  return value;
}

function requiredIso(value: string | undefined, name: string) {
  if (!value || !Number.isFinite(Date.parse(value)))
    throw new Error(`${name} must be an ISO instant`);
  return new Date(value).toISOString();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'provider_registry_failed'}\n`,
    );
    process.exitCode = 1;
  });
}
