import {
  CANONICAL_STATE_VALUES,
  CANONICAL_TRANSITION_TARGETS,
  ONE_TIME_PRODUCT_SCOPE,
  VERIFICATION_RUNTIME_TIER,
  type AccessTransitionCause,
  type BillingTransitionEvidence,
  type CanonicalAggregateKind,
  type CanonicalState,
  type CanonicalStateTransitionCommand,
  type CanonicalStateTransitionResult,
  type ContentFailureOrigin,
} from '../../../contracts/src/state/index.ts';
import { StateTransitionError } from './errors.ts';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

const ACCESS_CAUSES = {
  __none__: {
    free: ['free_period'],
    inactive: ['household_archived', 'administrative_block'],
  },
  free: {
    active: ['verified_paid_or_contract'],
    inactive: ['free_expired', 'household_archived', 'administrative_block'],
  },
  active: {
    grace: ['verified_renewal_failure'],
    inactive: ['paid_or_contract_ended', 'household_archived', 'administrative_block'],
  },
  grace: {
    active: ['verified_recovery'],
    inactive: ['grace_expired', 'household_archived', 'administrative_block'],
  },
  inactive: {
    free: ['free_period'],
    active: ['verified_reactivation', 'verified_paid_or_contract'],
  },
} as const satisfies Record<
  string,
  Partial<Record<CanonicalState<'access'>, readonly AccessTransitionCause[]>>
>;

export function assertCanonicalStateTransition<K extends CanonicalAggregateKind>(
  command: CanonicalStateTransitionCommand<K>,
): CanonicalStateTransitionResult<K> {
  assertScope(command);
  assertIdentityAndAuthorization(command);
  assertIdempotency(command);

  const replay = replayPriorTransition(command);
  if (replay) return replay;

  assertVersions(command);
  assertKnownState(command.aggregateKind, command.fromState);
  assertKnownState(command.aggregateKind, command.toState);
  assertAllowedTarget(command.aggregateKind, command.fromState, command.toState);

  if (command.aggregateKind === 'content') {
    assertContentEvidence(
      command.fromState as CanonicalState<'content'> | null,
      command.toState as CanonicalState<'content'>,
      command.contentFailureOrigin,
    );
  }
  if (command.aggregateKind === 'access') {
    assertAccessCause(
      command.fromState as CanonicalState<'access'> | null,
      command.toState as CanonicalState<'access'>,
      command.accessCause,
    );
  }
  if (command.aggregateKind === 'billing_operation') {
    assertBillingEvidence(
      command.fromState as CanonicalState<'billing_operation'> | null,
      command.toState as CanonicalState<'billing_operation'>,
      command.billingEvidence,
    );
  }

  return {
    disposition: 'applied',
    aggregateKind: command.aggregateKind,
    aggregateId: command.aggregateId,
    previousState: command.fromState,
    state: command.toState,
    version: command.currentVersion + 1,
    idempotencyKey: command.idempotencyKey,
    canonicalRequestHash: command.canonicalRequestHash,
  };
}

function assertScope<K extends CanonicalAggregateKind>(
  command: CanonicalStateTransitionCommand<K>,
) {
  const expectedTier = VERIFICATION_RUNTIME_TIER[command.scope.verificationEnvironmentId];
  if (
    command.scope.product !== ONE_TIME_PRODUCT_SCOPE ||
    expectedTier !== command.scope.runtimeTier
  ) {
    throw new StateTransitionError(
      'invalid_scope',
      'Product scope and verification environment must resolve to one canonical runtime tier.',
    );
  }
}

function assertIdentityAndAuthorization<K extends CanonicalAggregateKind>(
  command: CanonicalStateTransitionCommand<K>,
) {
  if (command.aggregateId.trim() === '' || command.actor.actorId.trim() === '') {
    throw new StateTransitionError(
      'invalid_identity',
      'Aggregate and actor identifiers must be opaque nonempty values.',
    );
  }
  if (!command.actor.authorized) {
    throw new StateTransitionError(
      'unauthorized',
      'The actor is not authorized for this transition.',
    );
  }
}

function assertIdempotency<K extends CanonicalAggregateKind>(
  command: CanonicalStateTransitionCommand<K>,
) {
  if (command.idempotencyKey.trim() === '') {
    throw new StateTransitionError(
      'invalid_idempotency_key',
      'A stable idempotency key is required.',
    );
  }
  if (!SHA256_PATTERN.test(command.canonicalRequestHash)) {
    throw new StateTransitionError(
      'invalid_request_hash',
      'The canonical request hash must be a lowercase SHA-256 digest.',
    );
  }
}

function replayPriorTransition<K extends CanonicalAggregateKind>(
  command: CanonicalStateTransitionCommand<K>,
): CanonicalStateTransitionResult<K> | null {
  const prior = command.priorIdempotentTransition;
  if (!prior) return null;

  if (
    prior.key !== command.idempotencyKey ||
    prior.canonicalRequestHash !== command.canonicalRequestHash ||
    prior.fromState !== command.fromState ||
    prior.toState !== command.toState
  ) {
    throw new StateTransitionError(
      'idempotency_conflict',
      'An idempotency key cannot be reused for a different canonical request.',
    );
  }
  if (!Number.isSafeInteger(prior.resultingVersion) || prior.resultingVersion < 1) {
    throw new StateTransitionError(
      'invalid_version',
      'A replayed transition must carry its positive committed version.',
    );
  }

  return {
    disposition: 'replayed',
    aggregateKind: command.aggregateKind,
    aggregateId: command.aggregateId,
    previousState: prior.fromState,
    state: prior.toState,
    version: prior.resultingVersion,
    idempotencyKey: prior.key,
    canonicalRequestHash: prior.canonicalRequestHash,
  };
}

function assertVersions<K extends CanonicalAggregateKind>(
  command: CanonicalStateTransitionCommand<K>,
) {
  const minimumVersion = command.fromState === null ? 0 : 1;
  if (
    !Number.isSafeInteger(command.currentVersion) ||
    command.currentVersion < minimumVersion ||
    (command.fromState === null && command.currentVersion !== 0) ||
    !Number.isSafeInteger(command.expectedVersion) ||
    command.expectedVersion < 0
  ) {
    throw new StateTransitionError(
      'invalid_version',
      'Creation starts at version zero; persisted aggregates use positive monotonic versions.',
    );
  }
  if (command.expectedVersion !== command.currentVersion) {
    throw new StateTransitionError(
      'stale_version',
      'The expected version is stale; no partial transition may be written.',
    );
  }
}

function assertKnownState<K extends CanonicalAggregateKind>(
  kind: K,
  state: CanonicalState<K> | null,
) {
  if (state === null) return;
  if (!(CANONICAL_STATE_VALUES[kind] as readonly string[]).includes(state)) {
    throw new StateTransitionError('invalid_state', `Unknown ${kind} state.`);
  }
}

function assertAllowedTarget<K extends CanonicalAggregateKind>(
  kind: K,
  fromState: CanonicalState<K> | null,
  toState: CanonicalState<K>,
) {
  const source = fromState ?? '__none__';
  const targets = CANONICAL_TRANSITION_TARGETS[kind] as Record<
    string,
    readonly string[] | undefined
  >;
  if (!(targets[source] ?? []).includes(toState)) {
    throw new StateTransitionError(
      'transition_denied',
      `Transition ${kind}:${source}->${String(toState)} is not canonical.`,
    );
  }
}

function assertContentEvidence(
  fromState: CanonicalState<'content'> | null,
  toState: CanonicalState<'content'>,
  failedFrom: ContentFailureOrigin | undefined,
) {
  if (toState === 'failed') {
    if (
      (fromState !== 'validating' && fromState !== 'processing' && fromState !== 'publishing') ||
      failedFrom !== fromState
    ) {
      throw new StateTransitionError(
        'missing_transition_evidence',
        'A failed content transition records its exact failure origin.',
      );
    }
    return;
  }
  if (fromState === 'failed') {
    if (failedFrom !== toState) {
      throw new StateTransitionError(
        'missing_transition_evidence',
        'A governed content retry may return only to its recorded failure origin.',
      );
    }
    return;
  }
  if (failedFrom !== undefined) {
    throw new StateTransitionError(
      'missing_transition_evidence',
      'Failure origin is valid only for failure and governed retry transitions.',
    );
  }
}

function assertAccessCause(
  fromState: CanonicalState<'access'> | null,
  toState: CanonicalState<'access'>,
  cause: AccessTransitionCause | undefined,
) {
  const source = fromState ?? '__none__';
  const targets = ACCESS_CAUSES[source] as Partial<
    Record<CanonicalState<'access'>, readonly AccessTransitionCause[]>
  >;
  const causes = targets[toState];
  if (!cause || !causes?.includes(cause)) {
    throw new StateTransitionError(
      'missing_transition_evidence',
      'An access transition requires its exact verified canonical cause.',
    );
  }
}

function assertBillingEvidence(
  fromState: CanonicalState<'billing_operation'> | null,
  toState: CanonicalState<'billing_operation'>,
  evidence: BillingTransitionEvidence | undefined,
) {
  if (fromState === null && toState === 'not_started') return;
  if (!evidence) {
    throw new StateTransitionError(
      'missing_transition_evidence',
      'Billing provider-operation transitions require fencing and retry evidence.',
    );
  }
  assertAttemptCounts(evidence);

  if ((fromState === 'not_started' || fromState === 'retry_wait') && toState === 'leased') {
    if (evidence.dispatchAttempts >= 8) {
      throw new StateTransitionError(
        'attempts_exhausted',
        'A recovery generation permits at most eight dispatch attempts.',
      );
    }
    if (
      evidence.presentedLeaseGeneration === null ||
      evidence.presentedLeaseGeneration <= (evidence.currentLeaseGeneration ?? 0)
    ) {
      throw new StateTransitionError(
        'stale_lease_generation',
        'A worker claim requires a new fencing generation.',
      );
    }
    return;
  }

  if (fromState === 'leased' && toState === 'in_flight') {
    assertCurrentLease(evidence);
    return;
  }
  if (fromState === 'leased' && toState === 'retry_wait') {
    assertCurrentLease(evidence);
    if (evidence.providerRequestOccurred) {
      throw new StateTransitionError(
        'acceptance_unknown',
        'A possibly dispatched effect cannot enter retry_wait without reconciliation.',
      );
    }
    return;
  }
  if (fromState === 'leased' && toState === 'acceptance_unknown') {
    assertCurrentLease(evidence);
    if (!evidence.providerRequestOccurred || !evidence.unknownEffect) {
      throw new StateTransitionError(
        'missing_transition_evidence',
        'Unknown acceptance requires evidence that dispatch could have occurred.',
      );
    }
    return;
  }
  if (
    fromState === 'in_flight' &&
    (toState === 'accepted' || toState === 'complete' || toState === 'rejected')
  ) {
    assertCurrentLease(evidence);
    if (evidence.unknownEffect) {
      throw new StateTransitionError(
        'acceptance_unknown',
        'An unknown effect must be reconciled before a terminal result is recorded.',
      );
    }
    return;
  }
  if (fromState === 'in_flight' && toState === 'retry_wait') {
    assertCurrentLease(evidence);
    if (evidence.providerRequestOccurred || evidence.unknownEffect) {
      throw new StateTransitionError(
        'acceptance_unknown',
        'Retry requires explicit proof of non-acceptance.',
      );
    }
    return;
  }
  if (fromState === 'in_flight' && toState === 'acceptance_unknown') {
    assertCurrentLease(evidence);
    if (!evidence.unknownEffect) {
      throw new StateTransitionError(
        'missing_transition_evidence',
        'Timeout or lost-response transitions set the unknown-effect flag.',
      );
    }
    return;
  }
  if (fromState === 'accepted' && toState === 'complete') {
    if (!hasDigest(evidence.reconciliationDigest)) {
      throw new StateTransitionError(
        'missing_transition_evidence',
        'Completion after acceptance requires canonical readback evidence.',
      );
    }
    return;
  }
  if (fromState === 'acceptance_unknown') {
    assertUnknownRecovery(toState, evidence);
    return;
  }
  if (fromState === 'retry_wait' && toState === 'dead_letter') {
    if (evidence.dispatchAttempts < 8) {
      throw new StateTransitionError(
        'missing_transition_evidence',
        'Dispatch work dead-letters only after eight attempts.',
      );
    }
    return;
  }
  if (
    (fromState === 'not_started' || fromState === 'leased' || fromState === 'retry_wait') &&
    toState === 'canceled'
  ) {
    if (evidence.providerRequestOccurred || evidence.unknownEffect) {
      throw new StateTransitionError(
        'acceptance_unknown',
        'Cancellation requires proof that no provider effect was accepted.',
      );
    }
    return;
  }
  if (fromState === 'dead_letter' && toState === 'not_started') {
    if (!evidence.adminRecoveryAuthorized || evidence.recoveryGeneration < 1) {
      throw new StateTransitionError(
        'missing_transition_evidence',
        'Dead-letter recovery requires Admin authorization and a new recovery generation.',
      );
    }
    return;
  }

  throw new StateTransitionError(
    'missing_transition_evidence',
    'The billing transition is missing its canonical condition evidence.',
  );
}

function assertAttemptCounts(evidence: BillingTransitionEvidence) {
  for (const value of [
    evidence.dispatchAttempts,
    evidence.reconciliationAttempts,
    evidence.recoveryGeneration,
  ]) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new StateTransitionError(
        'missing_transition_evidence',
        'Attempt and recovery generations must be nonnegative integers.',
      );
    }
  }
}

function assertCurrentLease(evidence: BillingTransitionEvidence) {
  if (
    evidence.currentLeaseGeneration === null ||
    evidence.presentedLeaseGeneration !== evidence.currentLeaseGeneration
  ) {
    throw new StateTransitionError(
      'stale_lease_generation',
      'A stale worker generation cannot persist a provider-operation result.',
    );
  }
}

function assertUnknownRecovery(
  toState: CanonicalState<'billing_operation'>,
  evidence: BillingTransitionEvidence,
) {
  if (!evidence.unknownEffect || !hasDigest(evidence.reconciliationDigest)) {
    throw new StateTransitionError(
      'missing_transition_evidence',
      'Acceptance-unknown recovery requires a canonical reconciliation digest.',
    );
  }

  const expectedOutcome = {
    accepted: 'effect_exists_accepted',
    complete: 'effect_exists_complete',
    retry_wait: 'effect_absent_retry_safe',
    rejected: 'effect_permanently_rejected',
    dead_letter: 'attempts_exhausted',
  } as const satisfies Partial<
    Record<
      CanonicalState<'billing_operation'>,
      NonNullable<BillingTransitionEvidence['reconciliationOutcome']>
    >
  >;
  const requiredOutcome = (
    expectedOutcome as Partial<
      Record<
        CanonicalState<'billing_operation'>,
        NonNullable<BillingTransitionEvidence['reconciliationOutcome']>
      >
    >
  )[toState];
  if (!requiredOutcome || evidence.reconciliationOutcome !== requiredOutcome) {
    throw new StateTransitionError(
      'missing_transition_evidence',
      'Reconciliation outcome does not prove the requested recovery transition.',
    );
  }
  if (
    toState === 'dead_letter' &&
    evidence.dispatchAttempts + evidence.reconciliationAttempts < 8
  ) {
    throw new StateTransitionError(
      'missing_transition_evidence',
      'Unknown work dead-letters only after eight bounded dispatch/reconciliation attempts.',
    );
  }
}

function hasDigest(value: string | undefined) {
  return value !== undefined && SHA256_PATTERN.test(value);
}
