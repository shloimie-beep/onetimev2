import type {
  ProviderCanonicalReadback,
  ProviderOperation,
  ProviderRegistryBinding,
  ProviderRegistryBindingEvidence,
  ProviderRegistryBindingReadRequest,
} from '../../../../contracts/src/providers/v21-provider-core.ts';
import { toProviderReconciliationOutcome } from '../../../../contracts/src/providers/v21-provider-core.ts';
import {
  assertJobScope,
  assertOutboxIntent,
  assertSha256,
  reconcileAcceptanceUnknown,
} from '../../jobs/index.ts';
import { ProviderCoreError } from './errors.ts';

export function assertProviderRegistryBinding(binding: ProviderRegistryBinding): void {
  assertJobScope(binding.scope);
  assertOpaque(binding.registry_binding_key, 'registry_binding_key');
  assertSha256(binding.provider_account_ref_hash, 'provider_account_ref_hash');
  if (!binding.active || binding.allowed_operation_types.length === 0) {
    throw new ProviderCoreError('invalid_contract', 'Provider binding must be active and bounded.');
  }
  const operations = new Set<string>();
  for (const operationType of binding.allowed_operation_types) {
    assertOpaque(operationType, 'allowed_operation_type');
    if (operations.has(operationType)) {
      throw new ProviderCoreError(
        'invalid_contract',
        'Provider binding operation types must be unique.',
      );
    }
    operations.add(operationType);
  }
  if (binding.provider === 'stripe' && binding.mutation_policy !== 'prohibited') {
    throw new ProviderCoreError(
      'provider_mutation_forbidden',
      'One Time registry bindings never authorize Stripe financial writes.',
    );
  }
}

export function assertProviderRegistryBindingEvidence(
  input: ProviderRegistryBindingReadRequest,
  evidence: ProviderRegistryBindingEvidence,
): void {
  assertJobScope(input.scope);
  assertOpaque(input.registry_binding_key, 'registry_binding_key');
  assertOpaque(input.operation_type, 'operation_type');
  assertSha256(input.expected_provider_account_ref_hash, 'expected_provider_account_ref_hash');
  assertSha256(input.expected_registry_evidence_digest, 'expected_registry_evidence_digest');
  assertSha256(
    input.expected_provider_readback_evidence_digest,
    'expected_provider_readback_evidence_digest',
  );
  if (!Number.isSafeInteger(input.expected_version) || input.expected_version < 1) {
    throw new ProviderCoreError('invalid_contract', 'Expected registry version must be positive.');
  }
  const observedNotBefore = Date.parse(input.observed_not_before);
  const observedAt = Date.parse(evidence.observed_at);
  if (!Number.isFinite(observedNotBefore) || !Number.isFinite(observedAt)) {
    throw new ProviderCoreError('invalid_contract', 'Registry evidence times must be valid.');
  }

  assertProviderRegistryBinding(evidence.binding);
  assertSha256(evidence.registry_evidence_digest, 'registry_evidence_digest');
  assertSha256(evidence.provider_readback_evidence_digest, 'provider_readback_evidence_digest');
  if (
    evidence.binding.registry_binding_key !== input.registry_binding_key ||
    evidence.binding.provider !== input.provider ||
    evidence.binding.scope.product !== input.scope.product ||
    evidence.binding.scope.runtime_tier !== input.scope.runtime_tier ||
    evidence.binding.scope.verification_environment_id !==
      input.scope.verification_environment_id ||
    evidence.binding.provider_account_ref_hash !== input.expected_provider_account_ref_hash ||
    !evidence.binding.allowed_operation_types.includes(input.operation_type) ||
    evidence.registry_evidence_digest !== input.expected_registry_evidence_digest ||
    evidence.provider_readback_evidence_digest !==
      input.expected_provider_readback_evidence_digest ||
    evidence.version !== input.expected_version ||
    observedAt < observedNotBefore
  ) {
    throw new ProviderCoreError(
      'registry_mismatch',
      'Registry evidence does not match the exact active binding request.',
    );
  }
  if (input.effect_kind === 'mutation' && evidence.binding.mutation_policy === 'prohibited') {
    throw new ProviderCoreError(
      'provider_mutation_forbidden',
      'This provider binding prohibits mutation.',
    );
  }
}

export function assertProviderOperationBound(
  operation: ProviderOperation,
  binding: ProviderRegistryBinding,
): void {
  assertProviderRegistryBinding(binding);
  assertOutboxIntent(operation);
  assertSha256(operation.provider_account_ref_hash, 'provider_account_ref_hash');
  if (
    operation.provider !== binding.provider ||
    operation.registry_binding_key !== binding.registry_binding_key ||
    operation.provider_account_ref_hash !== binding.provider_account_ref_hash ||
    operation.scope.product !== binding.scope.product ||
    operation.scope.runtime_tier !== binding.scope.runtime_tier ||
    operation.scope.verification_environment_id !== binding.scope.verification_environment_id ||
    !binding.allowed_operation_types.includes(operation.operation_type)
  ) {
    throw new ProviderCoreError(
      'registry_mismatch',
      'Provider operation does not match the exact active registry binding and scope.',
    );
  }
  if (operation.effect_kind === 'mutation' && binding.mutation_policy === 'prohibited') {
    throw new ProviderCoreError(
      'provider_mutation_forbidden',
      'This provider binding prohibits mutation.',
    );
  }
  if (
    operation.provider === 'stripe' &&
    operation.effect_kind !== 'readback' &&
    operation.effect_kind !== 'signed_event_ingest'
  ) {
    throw new ProviderCoreError(
      'provider_mutation_forbidden',
      'One Time may ingest signed Stripe events and read Stripe truth but never mutate financial objects.',
    );
  }
}

export function reconcileProviderOperation(
  operation: ProviderOperation,
  binding: ProviderRegistryBinding,
  readback: ProviderCanonicalReadback,
  input: { now: Date; random_unit_interval: number },
): ProviderOperation {
  assertProviderOperationBound(operation, binding);
  assertCanonicalReadback(operation, binding, readback);
  const next = reconcileAcceptanceUnknown(
    operation,
    operation.version,
    toProviderReconciliationOutcome(readback),
    input,
  );
  return {
    ...next,
    provider: operation.provider,
    registry_binding_key: operation.registry_binding_key,
    provider_account_ref_hash: operation.provider_account_ref_hash,
    effect_kind: operation.effect_kind,
    household_id: operation.household_id,
  };
}

export function assertCanonicalReadback(
  operation: ProviderOperation,
  binding: ProviderRegistryBinding,
  readback: ProviderCanonicalReadback,
): void {
  assertSha256(readback.reconciliation_digest, 'reconciliation_digest');
  if (
    readback.operation_id !== operation.job_id ||
    readback.provider !== operation.provider ||
    readback.registry_binding_key !== binding.registry_binding_key ||
    readback.provider_account_ref_hash !== binding.provider_account_ref_hash ||
    readback.canonical_request_hash !== operation.canonical_request_hash ||
    readback.scope.product !== operation.scope.product ||
    readback.scope.runtime_tier !== operation.scope.runtime_tier ||
    readback.scope.verification_environment_id !== operation.scope.verification_environment_id
  ) {
    throw new ProviderCoreError(
      'readback_mismatch',
      'Readback must prove the exact operation, account, tier, environment, and request.',
    );
  }
  if (readback.disposition === 'effect_exists') {
    if (
      readback.provider_resource_ref_hash === null ||
      readback.provider_acceptance_digest === null
    ) {
      throw new ProviderCoreError(
        'invalid_contract',
        'Accepted readback requires protected resource and acceptance digests.',
      );
    }
    assertSha256(readback.provider_resource_ref_hash, 'provider_resource_ref_hash');
    assertSha256(readback.provider_acceptance_digest, 'provider_acceptance_digest');
  }
  if (
    (readback.disposition === 'permanently_rejected' || readback.disposition === 'still_unknown') &&
    readback.safe_error_code === null
  ) {
    throw new ProviderCoreError(
      'invalid_contract',
      'Rejected or unknown readback requires a safe error code.',
    );
  }
}

function assertOpaque(value: string, field: string): void {
  if (value.trim() === '' || /(?:secret|token|bearer|password|@)/i.test(value)) {
    throw new ProviderCoreError('invalid_contract', `${field} must be a safe opaque identifier.`);
  }
}
