import { createHash } from 'node:crypto';
import type {
  DataRightsRequest,
  DeletionPurgeRecord,
  PurgeLedgerReadback,
  RetentionWorkItem,
} from '../../../contracts/src/privacy/index.ts';
import { canonicalJson } from '../jobs/idempotency.ts';
import { PrivacyError } from './errors.ts';

const SHA256 = /^[a-f0-9]{64}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export const PRIVACY_RETENTION_SCHEDULE = {
  adult_household_after_closure: { days: 3 * 365, erasure_days: 30 },
  student_profile_after_closure: { days: 3 * 365, erasure_days: 30 },
  consent_after_supersession_or_closure: { days: 7 * 365, erasure_days: 7 * 365 },
  private_questions_after_closure: { days: 2 * 365, erasure_days: 30 },
  application_logs: { days: 30, erasure_days: 30 },
  material_security_audit: { days: 7 * 365, erasure_days: 7 * 365 },
  export_package_after_completion: { days: 7, erasure_days: 0 },
  primary_backups: { days: 35, erasure_days: 35 },
  independent_purge_ledger: { days: 7 * 365, erasure_days: 7 * 365 },
} as const;

export function createDeletionPurgeRecord(input: {
  approved_request: DataRightsRequest;
  ledger_event_id: string;
  request_audit_digest: string;
  policy_version_hash: string;
  identifiers: DeletionPurgeRecord['identifiers'];
  dispositions: DeletionPurgeRecord['dispositions'];
  category_tombstones: readonly string[];
  provider_tombstones: readonly string[];
  occurred_at: string;
  effective_at: string;
  replay_until: string;
  legal_hold_codes: readonly string[];
  scope: DeletionPurgeRecord['scope'];
  release_digest: string;
  configuration_digest: string;
  sequence: number;
  previous_record_digest: string | null;
}): DeletionPurgeRecord {
  if (
    input.approved_request.kind !== 'erasure' ||
    (input.approved_request.state !== 'approved' && input.approved_request.state !== 'executing')
  ) {
    throw new PrivacyError(
      'invalid_contract',
      'The independent purge record is written after erasure approval and before deletion.',
    );
  }
  if (
    input.approved_request.product !== input.scope.product ||
    input.approved_request.runtime_tier !== input.scope.runtime_tier ||
    input.approved_request.verification_environment_id !== input.scope.verification_environment_id
  ) {
    throw new PrivacyError(
      'invalid_contract',
      'Purge evidence scope must match the approved data-rights request.',
    );
  }
  for (const identifier of input.identifiers) {
    assertHash(identifier.hmac_sha256, 'hmac_sha256');
    requiredOpaque(identifier.hmac_key_version, 'hmac_key_version');
  }
  for (const digest of [
    input.request_audit_digest,
    input.policy_version_hash,
    input.release_digest,
    input.configuration_digest,
  ]) {
    assertHash(digest, 'purge_digest');
  }
  if (input.previous_record_digest !== null) {
    assertHash(input.previous_record_digest, 'previous_record_digest');
  }
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 1) {
    throw new PrivacyError('invalid_contract', 'Purge ledger sequence must be positive.');
  }
  const withoutDigest = {
    ledger_event_id: requiredOpaque(input.ledger_event_id, 'ledger_event_id'),
    occurred_at: validIso(input.occurred_at),
    request_audit_digest: input.request_audit_digest,
    policy_version_hash: input.policy_version_hash,
    identifiers: input.identifiers.map((identifier) => ({ ...identifier })),
    dispositions: [...new Set(input.dispositions)].sort(),
    category_tombstones: safeList(input.category_tombstones),
    provider_tombstones: safeList(input.provider_tombstones),
    effective_at: validIso(input.effective_at),
    replay_until: validIso(input.replay_until),
    legal_hold_codes: safeList(input.legal_hold_codes),
    scope: input.scope,
    release_digest: input.release_digest,
    configuration_digest: input.configuration_digest,
    sequence: input.sequence,
    previous_record_digest: input.previous_record_digest,
  };
  return {
    ...withoutDigest,
    record_digest: createHash('sha256').update(canonicalJson(withoutDigest)).digest('hex'),
  };
}

export function verifyPurgeLedgerChain(records: readonly DeletionPurgeRecord[]): boolean {
  const sorted = [...records].sort((left, right) => left.sequence - right.sequence);
  for (let index = 0; index < sorted.length; index += 1) {
    const record = sorted[index];
    if (record === undefined) return false;
    const withoutDigest = Object.fromEntries(
      Object.entries(record).filter(([key]) => key !== 'record_digest'),
    );
    const recomputed = createHash('sha256').update(canonicalJson(withoutDigest)).digest('hex');
    const expectedPrior = index === 0 ? null : (sorted[index - 1]?.record_digest ?? null);
    if (record.record_digest !== recomputed || record.previous_record_digest !== expectedPrior) {
      return false;
    }
  }
  return true;
}

export function assertPurgeLedgerDurable(
  record: DeletionPurgeRecord,
  readback: PurgeLedgerReadback,
): void {
  for (const digest of [
    readback.primary_object_version_hash,
    readback.replica_object_version_hash,
  ]) {
    assertHash(digest, 'object_version_hash');
  }
  if (
    readback.record_digest !== record.record_digest ||
    !readback.primary_checksum_verified ||
    !readback.replica_checksum_verified ||
    !readback.object_lock_compliance_verified
  ) {
    throw new PrivacyError(
      'purge_ledger_not_durable',
      'Primary deletion waits for verified Object-Lock primary and replicated purge evidence.',
    );
  }
}

export function evaluateRestoreTrafficGate(input: {
  ledger_chain_valid: boolean;
  applicable_record_count: number;
  replayed_record_count: number;
  negative_queries_passed: boolean;
  provider_effects_disabled: boolean;
  pending_provider_recreation_count: number;
}): { traffic_allowed: boolean; safe_code: 'restore_verified' | 'restore_gate_closed' } {
  const allowed =
    input.ledger_chain_valid &&
    input.applicable_record_count === input.replayed_record_count &&
    input.negative_queries_passed &&
    input.provider_effects_disabled &&
    input.pending_provider_recreation_count === 0;
  return {
    traffic_allowed: allowed,
    safe_code: allowed ? 'restore_verified' : 'restore_gate_closed',
  };
}

export function planRetentionWork(
  work: RetentionWorkItem,
  purgeRecord: DeletionPurgeRecord,
  now: Date,
): RetentionWorkItem {
  if (
    work.state !== 'due' ||
    new Date(work.due_at).getTime() > now.getTime() ||
    work.subject_binding_hash !== purgeRecord.identifiers[0]?.hmac_sha256
  ) {
    throw new PrivacyError(
      'invalid_contract',
      'Retention work must be due and bound to the independent purge record.',
    );
  }
  return {
    ...work,
    state: work.provider_outbox_intents.length === 0 ? 'planned' : 'provider_pending',
    version: work.version + 1,
  };
}

export function retentionDueAt(
  category: keyof typeof PRIVACY_RETENTION_SCHEDULE,
  startingAt: Date,
  verifiedErasure: boolean,
): string {
  const rule = PRIVACY_RETENTION_SCHEDULE[category];
  const days = verifiedErasure ? rule.erasure_days : rule.days;
  return new Date(startingAt.getTime() + days * DAY_MS).toISOString();
}

function safeList(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => requiredOpaque(value, 'tombstone')))].sort();
}

function requiredOpaque(value: string, field: string): string {
  if (
    value.trim() === '' ||
    /(?:@|password|token|secret|bearer|question|support.?body|https?:)/i.test(value)
  ) {
    throw new PrivacyError('invalid_contract', `${field} contains unsafe material.`);
  }
  return value;
}

function assertHash(value: string, field: string): void {
  if (!SHA256.test(value)) {
    throw new PrivacyError('invalid_hash', `${field} must be a SHA-256 digest.`);
  }
}

function validIso(value: string): string {
  if (new Date(value).toISOString() !== value) {
    throw new PrivacyError('invalid_contract', 'Purge timestamps must be canonical UTC ISO.');
  }
  return value;
}
