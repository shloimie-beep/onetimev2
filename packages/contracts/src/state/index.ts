export const CANONICAL_STATE_CONTRACT_VERSION = '1.0.0' as const;
export const ONE_TIME_PRODUCT_SCOPE = 'one_time_mishnayos' as const;

export const RUNTIME_TIERS = ['isolated_staging', 'production'] as const;
export type RuntimeTier = (typeof RUNTIME_TIERS)[number];

export const VERIFICATION_ENVIRONMENT_IDS = [
  'ci',
  'provider_sandbox',
  'persistent_staging',
  'production_read_only',
  'production_operator_canary',
  'production_broad',
] as const;
export type VerificationEnvironmentId = (typeof VERIFICATION_ENVIRONMENT_IDS)[number];

export const VERIFICATION_RUNTIME_TIER = {
  ci: 'isolated_staging',
  provider_sandbox: 'isolated_staging',
  persistent_staging: 'isolated_staging',
  production_read_only: 'production',
  production_operator_canary: 'production',
  production_broad: 'production',
} as const satisfies Record<VerificationEnvironmentId, RuntimeTier>;

export const CANONICAL_STATE_VALUES = {
  human_account: ['invited', 'active', 'disabled', 'archived'],
  student: ['active', 'archived'],
  access: ['free', 'active', 'grace', 'inactive'],
  class_occurrence: ['scheduled', 'preparing', 'ready', 'live', 'completed', 'canceled'],
  content: [
    'received',
    'validating',
    'processing',
    'needs_review',
    'approved',
    'publishing',
    'published',
    'failed',
    'archived',
  ],
  student_question: [
    'submitted',
    'answered_private',
    'approved_for_class',
    'published',
    'closed',
    'declined',
  ],
  support: ['open', 'in_progress', 'waiting_on_requester', 'resolved', 'closed'],
  billing_operation: [
    'not_started',
    'leased',
    'in_flight',
    'accepted',
    'complete',
    'rejected',
    'retry_wait',
    'acceptance_unknown',
    'dead_letter',
    'canceled',
  ],
} as const;

export type CanonicalAggregateKind = keyof typeof CANONICAL_STATE_VALUES;
export type CanonicalState<K extends CanonicalAggregateKind> =
  (typeof CANONICAL_STATE_VALUES)[K][number];
export type AnyCanonicalState = CanonicalState<CanonicalAggregateKind>;

const NO_TARGETS = [] as const;

export const CANONICAL_TRANSITION_TARGETS = {
  human_account: {
    __none__: ['active', 'invited'],
    invited: ['active', 'archived'],
    active: ['disabled', 'archived'],
    disabled: ['active', 'archived'],
    archived: NO_TARGETS,
  },
  student: {
    __none__: ['active'],
    active: ['archived'],
    archived: ['active'],
  },
  access: {
    __none__: ['free', 'inactive'],
    free: ['active', 'inactive'],
    active: ['grace', 'inactive'],
    grace: ['active', 'inactive'],
    inactive: ['free', 'active'],
  },
  class_occurrence: {
    __none__: ['scheduled'],
    scheduled: ['preparing', 'canceled'],
    preparing: ['ready', 'canceled'],
    ready: ['live', 'canceled'],
    live: ['completed'],
    completed: NO_TARGETS,
    canceled: ['scheduled'],
  },
  content: {
    __none__: ['received'],
    received: ['validating', 'archived'],
    validating: ['processing', 'failed'],
    processing: ['needs_review', 'failed'],
    needs_review: ['approved', 'archived'],
    approved: ['publishing', 'archived'],
    publishing: ['published', 'failed'],
    published: ['approved', 'archived'],
    failed: ['validating', 'processing', 'publishing', 'archived'],
    archived: NO_TARGETS,
  },
  student_question: {
    __none__: ['submitted'],
    submitted: ['answered_private', 'approved_for_class', 'declined'],
    answered_private: ['approved_for_class', 'declined', 'closed'],
    approved_for_class: ['published', 'declined'],
    published: ['declined', 'closed'],
    declined: ['closed'],
    closed: NO_TARGETS,
  },
  support: {
    __none__: ['open'],
    open: ['in_progress', 'resolved'],
    in_progress: ['waiting_on_requester', 'resolved'],
    waiting_on_requester: ['in_progress', 'resolved'],
    resolved: ['in_progress', 'closed'],
    closed: NO_TARGETS,
  },
  billing_operation: {
    __none__: ['not_started'],
    not_started: ['leased', 'canceled'],
    leased: ['in_flight', 'retry_wait', 'acceptance_unknown', 'canceled'],
    in_flight: ['accepted', 'complete', 'rejected', 'retry_wait', 'acceptance_unknown'],
    accepted: ['complete'],
    complete: NO_TARGETS,
    rejected: NO_TARGETS,
    retry_wait: ['leased', 'dead_letter', 'canceled'],
    acceptance_unknown: ['accepted', 'complete', 'retry_wait', 'rejected', 'dead_letter'],
    dead_letter: ['not_started'],
    canceled: NO_TARGETS,
  },
} as const;

export const STATE_ACTOR_KINDS = [
  'system',
  'admin',
  'parent',
  'student',
  'worker',
  'reconciler',
] as const;
export type StateActorKind = (typeof STATE_ACTOR_KINDS)[number];

export interface StateScope {
  product: typeof ONE_TIME_PRODUCT_SCOPE;
  runtimeTier: RuntimeTier;
  verificationEnvironmentId: VerificationEnvironmentId;
}

export interface StateActor {
  kind: StateActorKind;
  actorId: string;
  authorized: boolean;
}

export interface PriorIdempotentTransition<K extends CanonicalAggregateKind> {
  key: string;
  canonicalRequestHash: string;
  fromState: CanonicalState<K> | null;
  toState: CanonicalState<K>;
  resultingVersion: number;
}

export type ContentFailureOrigin = 'validating' | 'processing' | 'publishing';

export type AccessTransitionCause =
  | 'free_period'
  | 'verified_paid_or_contract'
  | 'free_expired'
  | 'verified_renewal_failure'
  | 'verified_recovery'
  | 'grace_expired'
  | 'paid_or_contract_ended'
  | 'verified_reactivation'
  | 'household_archived'
  | 'administrative_block';

export type BillingReconciliationOutcome =
  | 'effect_exists_accepted'
  | 'effect_exists_complete'
  | 'effect_absent_retry_safe'
  | 'effect_permanently_rejected'
  | 'attempts_exhausted';

export interface BillingTransitionEvidence {
  dispatchAttempts: number;
  reconciliationAttempts: number;
  recoveryGeneration: number;
  currentLeaseGeneration: number | null;
  presentedLeaseGeneration: number | null;
  providerRequestOccurred: boolean;
  unknownEffect: boolean;
  reconciliationOutcome?: BillingReconciliationOutcome;
  reconciliationDigest?: string;
  adminRecoveryAuthorized?: boolean;
}

export interface CanonicalStateTransitionCommand<K extends CanonicalAggregateKind> {
  aggregateKind: K;
  aggregateId: string;
  fromState: CanonicalState<K> | null;
  toState: CanonicalState<K>;
  currentVersion: number;
  expectedVersion: number;
  scope: StateScope;
  actor: StateActor;
  idempotencyKey: string;
  canonicalRequestHash: string;
  priorIdempotentTransition?: PriorIdempotentTransition<K>;
  contentFailureOrigin?: ContentFailureOrigin;
  accessCause?: AccessTransitionCause;
  billingEvidence?: BillingTransitionEvidence;
}

export interface AppliedStateTransition<K extends CanonicalAggregateKind> {
  disposition: 'applied';
  aggregateKind: K;
  aggregateId: string;
  previousState: CanonicalState<K> | null;
  state: CanonicalState<K>;
  version: number;
  idempotencyKey: string;
  canonicalRequestHash: string;
}

export interface ReplayedStateTransition<K extends CanonicalAggregateKind> {
  disposition: 'replayed';
  aggregateKind: K;
  aggregateId: string;
  previousState: CanonicalState<K> | null;
  state: CanonicalState<K>;
  version: number;
  idempotencyKey: string;
  canonicalRequestHash: string;
}

export type CanonicalStateTransitionResult<K extends CanonicalAggregateKind> =
  AppliedStateTransition<K> | ReplayedStateTransition<K>;

export const STATE_TRANSITION_ERROR_CODES = [
  'invalid_scope',
  'unauthorized',
  'invalid_identity',
  'invalid_state',
  'invalid_version',
  'stale_version',
  'invalid_idempotency_key',
  'invalid_request_hash',
  'idempotency_conflict',
  'transition_denied',
  'missing_transition_evidence',
  'stale_lease_generation',
  'attempts_exhausted',
  'acceptance_unknown',
] as const;

export type StateTransitionErrorCode = (typeof STATE_TRANSITION_ERROR_CODES)[number];
