import { describe, expect, it } from 'vitest';

import {
  desiredMediaProviderBindings,
  planProviderRegistryBinding,
  type ExistingProviderBinding,
} from './provider-registry-bindings.ts';

const digest = (character: string) => character.repeat(64);
const observedAt = '2026-08-09T09:00:00.000Z';
const desired = desiredMediaProviderBindings({
  CONTENT_S3_PROVIDER_ACCOUNT_REF_HASH: digest('1'),
  CONTENT_S3_REGISTRY_EVIDENCE_DIGEST: digest('2'),
  CONTENT_S3_PROVIDER_READBACK_EVIDENCE_DIGEST: digest('3'),
  CONTENT_S3_REGISTRY_OBSERVED_NOT_BEFORE: observedAt,
  CONTENT_OPENAI_PROVIDER_ACCOUNT_REF_HASH: digest('4'),
  CONTENT_OPENAI_REGISTRY_EVIDENCE_DIGEST: digest('5'),
  CONTENT_OPENAI_PROVIDER_READBACK_EVIDENCE_DIGEST: digest('6'),
  CONTENT_OPENAI_REGISTRY_OBSERVED_NOT_BEFORE: observedAt,
  CONTENT_VIMEO_PROVIDER_ACCOUNT_REF_HASH: digest('7'),
  CONTENT_VIMEO_REGISTRY_EVIDENCE_DIGEST: digest('8'),
  CONTENT_VIMEO_PROVIDER_READBACK_EVIDENCE_DIGEST: digest('9'),
  CONTENT_VIMEO_REGISTRY_OBSERVED_NOT_BEFORE: observedAt,
});

describe('media provider registry binding operator command', () => {
  it('builds only the fixed production canary media bindings', () => {
    expect(
      desired.map(({ provider, registryBindingKey, allowedOperationTypes }) => ({
        provider,
        registryBindingKey,
        allowedOperationTypes,
      })),
    ).toEqual([
      {
        provider: 's3',
        registryBindingKey: 's3_content_original_primary',
        allowedOperationTypes: ['multipart_original_write'],
      },
      {
        provider: 'openai',
        registryBindingKey: 'openai_content_processing_primary',
        allowedOperationTypes: ['transcribe_and_generate_learning_draft'],
      },
      {
        provider: 'vimeo',
        registryBindingKey: 'vimeo_publication_primary',
        allowedOperationTypes: ['publish_private', 'revoke_private'],
      },
    ]);
  });

  it('plans insert, exact no-op, and fenced version update', () => {
    const target = desired[2]!;
    expect(planProviderRegistryBinding(undefined, target)).toEqual({
      action: 'insert',
      version: 1,
    });
    const existing: ExistingProviderBinding = {
      registry_binding_key: target.registryBindingKey,
      provider: target.provider,
      provider_account_ref_hash: target.providerAccountRefHash,
      allowed_operation_types: [...target.allowedOperationTypes],
      mutation_policy: 'allowed',
      active: true,
      registry_evidence_digest: target.registryEvidenceDigest,
      provider_readback_evidence_digest: target.providerReadbackEvidenceDigest,
      observed_at: target.observedAt,
      version: '3',
    };
    expect(planProviderRegistryBinding(existing, target)).toEqual({
      action: 'no_change',
      version: 3,
    });
    expect(planProviderRegistryBinding({ ...existing, active: false }, target)).toEqual({
      action: 'update',
      expectedVersion: 3,
      version: 4,
    });
  });

  it('rejects incomplete proof tuples and immutable identity mismatches', () => {
    expect(() => desiredMediaProviderBindings({})).toThrow(/CONTENT_S3_PROVIDER_ACCOUNT_REF_HASH/);
    expect(() =>
      planProviderRegistryBinding(
        {
          registry_binding_key: desired[0]!.registryBindingKey,
          provider: 'vimeo',
          provider_account_ref_hash: digest('1'),
          allowed_operation_types: ['multipart_original_write'],
          mutation_policy: 'allowed',
          active: true,
          registry_evidence_digest: digest('2'),
          provider_readback_evidence_digest: digest('3'),
          observed_at: observedAt,
          version: 1,
        },
        desired[0]!,
      ),
    ).toThrow(/immutable_identity_mismatch/);
  });
});
