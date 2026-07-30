import type {
  DataRightsInternalState,
  DataRightsRequest,
  DataRightsRequestInput,
  ExportDownloadGrant,
  PrivacyPersistenceScope,
  RequesterVisiblePrivacyStatus,
} from '../../../contracts/src/privacy/index.ts';
import {
  EXPORT_DOWNLOAD_TTL_MS,
  VERIFIED_ERASURE_DEADLINE_MS,
} from '../../../contracts/src/privacy/index.ts';
import { PrivacyError } from './errors.ts';

const SHA256 = /^[a-f0-9]{64}$/;
const PARENT_EXPORT_EXCLUSIONS = [
  'student_recordings',
  'library_assignments',
  'playback',
  'private_questions',
  'rabbi_answers',
  'student_support_bodies',
  'student_notifications',
  'student_comparison_data',
] as const;

export function createDataRightsRequest(input: DataRightsRequestInput): DataRightsRequest {
  if (!input.actor.recent_password_verified) {
    throw new PrivacyError(
      'recent_password_required',
      'Data-rights requests require recent password reauthentication.',
    );
  }
  const requester = authorizeRequester(input);
  const dependent = input.subject.kind === 'student' && input.subject.relationship === 'dependent';
  const exclusions =
    requester === 'account_owner'
      ? [...PARENT_EXPORT_EXCLUSIONS]
      : ['sibling_data', 'other_participant_data', 'shared_raw_recordings', 'provider_secrets'];
  const scope = exactPrivacyScope(input.scope);
  return {
    ...scope,
    request_id: requiredOpaque(input.request_id, 'request_id'),
    kind: input.kind,
    subject: input.subject,
    requester_kind: requester,
    requester_ref: input.actor.account_or_credential_id,
    requester_household_id: input.actor.household_id,
    relationship_evidence: input.subject.kind === 'student' ? input.subject.relationship : null,
    recent_password_session_id: input.actor.session_id,
    state: 'received',
    visible_status: 'requested',
    requested_categories: uniqueSafe(input.requested_categories),
    excluded_categories: exclusions,
    legal_exception_codes: [],
    provider_cascades: [],
    dependent_review_required: dependent,
    dependent_review_completed: false,
    due_at: new Date(input.now.getTime() + VERIFIED_ERASURE_DEADLINE_MS).toISOString(),
    completed_at: null,
    terminal_reason_code: null,
    version: 1,
    audit_refs: [requiredOpaque(input.audit_ref, 'audit_ref')],
  };
}

export function transitionDataRightsRequest(
  request: DataRightsRequest,
  input: {
    expected_version: number;
    to_state: DataRightsInternalState;
    actor_kind: 'requester' | 'privacy_admin' | 'worker' | 'reconciler';
    now: Date;
    audit_ref: string;
    dependent_review_completed?: boolean;
    legal_exception_codes?: readonly string[];
    provider_cascades?: DataRightsRequest['provider_cascades'];
    terminal_reason_code?: string;
    canonical_noncompletion_proven?: boolean;
  },
): DataRightsRequest {
  if (request.version !== input.expected_version) {
    throw new PrivacyError('stale_version', 'Data-rights request version is stale.');
  }
  assertTransition(request, input);
  const exceptions = uniqueSafe(input.legal_exception_codes ?? request.legal_exception_codes);
  const providers = input.provider_cascades ?? request.provider_cascades;
  if (
    input.to_state === 'completed' &&
    providers.some((provider) => provider.state !== 'complete' && provider.state !== 'excepted')
  ) {
    throw new PrivacyError(
      'invalid_transition',
      'Completion requires every provider cascade complete or explicitly excepted.',
    );
  }
  const next: DataRightsRequest = {
    ...request,
    state: input.to_state,
    visible_status: visiblePrivacyStatus(input.to_state, exceptions),
    dependent_review_completed:
      input.dependent_review_completed ?? request.dependent_review_completed,
    legal_exception_codes: exceptions,
    provider_cascades: providers,
    terminal_reason_code:
      input.to_state === 'denied' || input.to_state === 'failed'
        ? requiredOpaque(input.terminal_reason_code ?? '', 'terminal_reason_code')
        : null,
    completed_at: input.to_state === 'completed' ? input.now.toISOString() : null,
    version: request.version + 1,
    audit_refs: [...request.audit_refs, requiredOpaque(input.audit_ref, 'audit_ref')],
  };
  if (
    next.state === 'approved' &&
    next.dependent_review_required &&
    !next.dependent_review_completed
  ) {
    throw new PrivacyError(
      'dependent_review_required',
      'Dependent Student requests require separate privacy Admin review.',
    );
  }
  return next;
}

export function visiblePrivacyStatus(
  state: DataRightsInternalState,
  exceptionCodes: readonly string[],
): RequesterVisiblePrivacyStatus | null {
  if (state === 'received' || state === 'identity_verified' || state === 'approved') {
    return 'requested';
  }
  if (state === 'executing') return 'processing';
  if (state === 'provider_pending') return 'partially_excepted';
  if (state === 'completed') {
    return exceptionCodes.length === 0 ? 'completed' : 'partially_excepted';
  }
  if (state === 'denied' || state === 'failed') return 'failed';
  return null;
}

export function issueExportDownloadGrant(input: {
  request: DataRightsRequest;
  grant_id: string;
  token_hash: string;
  subject_binding_hash: string;
  initiating_session_id: string;
  now: Date;
}): ExportDownloadGrant {
  if (input.request.kind !== 'export' || input.request.state !== 'completed') {
    throw new PrivacyError('download_denied', 'Only completed exports receive a download grant.');
  }
  assertHash(input.token_hash, 'token_hash');
  assertHash(input.subject_binding_hash, 'subject_binding_hash');
  const scope = exactPrivacyScope(input.request);
  return {
    ...scope,
    grant_id: requiredOpaque(input.grant_id, 'grant_id'),
    request_id: input.request.request_id,
    subject_binding_hash: input.subject_binding_hash,
    token_hash: input.token_hash,
    initiating_session_id: requiredOpaque(input.initiating_session_id, 'session_id'),
    issued_at: input.now.toISOString(),
    expires_at: new Date(input.now.getTime() + EXPORT_DOWNLOAD_TTL_MS).toISOString(),
    used_at: null,
    revoked_at: null,
    version: 1,
  };
}

export function redeemExportDownloadGrant(
  grant: ExportDownloadGrant,
  input: {
    expected_version: number;
    token_hash: string;
    subject_binding_hash: string;
    session_id: string;
    now: Date;
  },
): ExportDownloadGrant {
  if (
    grant.version !== input.expected_version ||
    grant.used_at !== null ||
    grant.revoked_at !== null ||
    input.now.getTime() >= new Date(grant.expires_at).getTime() ||
    grant.token_hash !== input.token_hash ||
    grant.subject_binding_hash !== input.subject_binding_hash ||
    grant.initiating_session_id !== input.session_id
  ) {
    throw new PrivacyError(
      'download_denied',
      'Download authorization is invalid, expired, reused, revoked, or cross-scoped.',
    );
  }
  return { ...grant, used_at: input.now.toISOString(), version: grant.version + 1 };
}

function authorizeRequester(input: DataRightsRequestInput): DataRightsRequest['requester_kind'] {
  const { actor, subject } = input;
  if (actor.role === 'admin') return 'privacy_admin';
  if (
    actor.role === 'parent' &&
    actor.adult_id === input.owner_adult_id &&
    (subject.kind === 'adult'
      ? subject.adult_id === actor.adult_id
      : subject.kind === 'household'
        ? subject.household_id === actor.household_id
        : subject.relationship === 'dependent' && subject.household_id === actor.household_id)
  ) {
    return 'account_owner';
  }
  if (
    actor.role === 'student' &&
    subject.kind === 'student' &&
    subject.relationship === 'self' &&
    actor.student_id === subject.student_id &&
    actor.adult_id !== null &&
    actor.adult_id === subject.self_adult_id &&
    actor.adult_id === input.owner_adult_id
  ) {
    return 'adult_self_student';
  }
  throw new PrivacyError(
    'actor_scope_denied',
    'Requester is not authorized for the exact privacy subject scope.',
  );
}

function assertTransition(
  request: DataRightsRequest,
  input: Parameters<typeof transitionDataRightsRequest>[1],
): void {
  const normal: Partial<Record<DataRightsInternalState, readonly DataRightsInternalState[]>> = {
    received: ['identity_verified'],
    identity_verified: ['approved'],
    approved: ['executing'],
    executing: ['provider_pending', 'completed', 'failed'],
    provider_pending: ['completed', 'failed'],
  };
  if (
    input.actor_kind === 'requester' &&
    (request.state === 'received' || request.state === 'identity_verified') &&
    input.to_state === 'canceled'
  ) {
    return;
  }
  if (
    input.actor_kind === 'privacy_admin' &&
    request.state === 'identity_verified' &&
    input.to_state === 'denied'
  ) {
    return;
  }
  if (!normal[request.state]?.includes(input.to_state)) {
    throw new PrivacyError('invalid_transition', 'Data-rights transition is not allowed.');
  }
  if (
    request.state === 'provider_pending' &&
    input.to_state === 'failed' &&
    (!input.canonical_noncompletion_proven ||
      request.provider_cascades.some((provider) => provider.unknown_effect))
  ) {
    throw new PrivacyError(
      'invalid_transition',
      'Provider-pending failure requires canonical terminal noncompletion and no unknown effect.',
    );
  }
}

function uniqueSafe(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => requiredOpaque(value, 'category')))].sort();
}

function exactPrivacyScope(scope: PrivacyPersistenceScope): PrivacyPersistenceScope {
  const isolatedEnvironments = ['ci', 'provider_sandbox', 'persistent_staging'];
  const productionEnvironments = [
    'production_read_only',
    'production_operator_canary',
    'production_broad',
  ];
  const environmentAllowed =
    (scope.runtime_tier === 'isolated_staging' &&
      isolatedEnvironments.includes(scope.verification_environment_id)) ||
    (scope.runtime_tier === 'production' &&
      productionEnvironments.includes(scope.verification_environment_id));
  if (scope.product !== 'one_time_mishnayos' || !environmentAllowed) {
    throw new PrivacyError(
      'invalid_contract',
      'Privacy persistence scope must be an exact product, runtime tier, and environment binding.',
    );
  }
  return {
    product: scope.product,
    runtime_tier: scope.runtime_tier,
    verification_environment_id: scope.verification_environment_id,
  };
}

function requiredOpaque(value: string, field: string): string {
  if (value.trim() === '' || /(?:@|password|token|secret|bearer)/i.test(value)) {
    throw new PrivacyError('invalid_contract', `${field} must be a safe opaque value.`);
  }
  return value;
}

function assertHash(value: string, field: string): void {
  if (!SHA256.test(value)) {
    throw new PrivacyError('invalid_contract', `${field} must be a SHA-256 digest.`);
  }
}
