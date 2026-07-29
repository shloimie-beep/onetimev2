import {
  isLowercaseSha256,
  isNonEmptyString,
  isPlaceholder,
  issue,
  parseTimestamp,
  result,
  type ValidationIssue,
} from './validation.ts';
import { validateEnvironmentIdentity } from './environment.ts';

export interface BackupEvidence {
  evidence_kind: 'backup';
  verification_environment_id: string;
  runtime_tier: string;
  credential_boundary: string;
  source_database_identity: string;
  backup_identifier: string;
  point_in_time_marker: string;
  created_at: string;
  completed_at: string;
  encryption_state: 'encrypted';
  schema_migration_fingerprint: string;
  aggregate_row_fingerprint: string;
  object_checksum: string;
  checksum_verified_at: string;
  retention_expires_at: string;
  restore_procedure_version: string;
}

export interface RestoreEvidence {
  evidence_kind: 'isolated_restore_drill';
  verification_environment_id: string;
  runtime_tier: string;
  credential_boundary: string;
  source_backup_identifier: string;
  isolated_target_identity: string;
  started_at: string;
  completed_at: string;
  cleanup_authorized_at: string;
  cleaned_up_at: string;
  decryption_verified: boolean;
  migrations_and_checksums_verified: boolean;
  aggregate_fingerprint_verified: boolean;
  admin_roles_and_zero_sessions_verified: boolean;
  isolation_and_access_verified: boolean;
  content_audit_outbox_verified: boolean;
  receipt_journal_verified: boolean;
  purge_ledger_and_replica_verified: boolean;
  deleted_seed_remains_deleted: boolean;
  provider_effects_disabled: boolean;
  rpo_minutes: number;
  rto_minutes: number;
  material_architecture_fingerprint: string;
}

function requireIdentity(issues: ValidationIssue[], value: unknown, path: string): void {
  if (!isNonEmptyString(value) || isPlaceholder(value)) {
    issues.push(
      issue(
        'EVIDENCE_IDENTITY_INVALID',
        path,
        'A non-empty, non-placeholder immutable identity is required.',
      ),
    );
  }
}

function requireSha(issues: ValidationIssue[], value: unknown, path: string): void {
  if (!isLowercaseSha256(value)) {
    issues.push(
      issue(
        'EVIDENCE_DIGEST_INVALID',
        path,
        'A lowercase 64-character SHA-256 digest is required.',
      ),
    );
  }
}

export function validateBackupEvidence(
  input: BackupEvidence,
  options: { mutation_started_at?: string; evaluated_at: string },
): ReturnType<typeof result> {
  const issues: ValidationIssue[] = [];
  if (input.evidence_kind !== 'backup') {
    issues.push(
      issue(
        'BACKUP_EVIDENCE_KIND_INVALID',
        'evidence_kind',
        'The evidence record must explicitly identify itself as backup evidence.',
      ),
    );
  }
  issues.push(...validateEnvironmentIdentity(input).issues);
  if (input.runtime_tier !== 'production') {
    issues.push(
      issue(
        'BACKUP_SOURCE_TIER_INVALID',
        'runtime_tier',
        'A production backup gate must identify the production runtime tier.',
      ),
    );
  }
  requireIdentity(issues, input.source_database_identity, 'source_database_identity');
  requireIdentity(issues, input.backup_identifier, 'backup_identifier');
  requireIdentity(issues, input.point_in_time_marker, 'point_in_time_marker');
  requireIdentity(issues, input.restore_procedure_version, 'restore_procedure_version');
  requireSha(issues, input.schema_migration_fingerprint, 'schema_migration_fingerprint');
  requireSha(issues, input.aggregate_row_fingerprint, 'aggregate_row_fingerprint');
  requireSha(issues, input.object_checksum, 'object_checksum');

  if (input.encryption_state !== 'encrypted') {
    issues.push(
      issue(
        'BACKUP_NOT_ENCRYPTED',
        'encryption_state',
        'Only an encrypted backup can satisfy the gate.',
      ),
    );
  }

  const created = parseTimestamp(input.created_at);
  const completed = parseTimestamp(input.completed_at);
  const checksumVerified = parseTimestamp(input.checksum_verified_at);
  const retentionExpires = parseTimestamp(input.retention_expires_at);
  const evaluated = parseTimestamp(options.evaluated_at);
  if (created === undefined || completed === undefined || completed < created) {
    issues.push(
      issue(
        'BACKUP_TIME_INVALID',
        'completed_at',
        'Creation and completion timestamps must be ordered ISO timestamps.',
      ),
    );
  }
  if (checksumVerified === undefined || completed === undefined || checksumVerified < completed) {
    issues.push(
      issue(
        'BACKUP_CHECKSUM_NOT_VERIFIED',
        'checksum_verified_at',
        'Checksum verification must occur after backup completion.',
      ),
    );
  }
  if (retentionExpires === undefined || created === undefined) {
    issues.push(
      issue(
        'BACKUP_RETENTION_INVALID',
        'retention_expires_at',
        'A valid retention expiry is required.',
      ),
    );
  } else if (retentionExpires - created < 35 * 24 * 60 * 60 * 1000) {
    issues.push(
      issue(
        'BACKUP_RETENTION_TOO_SHORT',
        'retention_expires_at',
        'The evidence must retain the backup for at least 35 days.',
      ),
    );
  }
  if (evaluated === undefined || retentionExpires === undefined || retentionExpires <= evaluated) {
    issues.push(
      issue(
        'BACKUP_EXPIRED',
        'retention_expires_at',
        'The backup must remain inside its retention period.',
      ),
    );
  }
  if (
    evaluated === undefined ||
    created === undefined ||
    completed === undefined ||
    checksumVerified === undefined ||
    created > evaluated ||
    completed > evaluated ||
    checksumVerified > evaluated
  ) {
    issues.push(
      issue(
        'BACKUP_EVIDENCE_FROM_FUTURE',
        'evaluated_at',
        'Backup creation, completion, and checksum verification must precede evaluation.',
      ),
    );
  }

  if (options.mutation_started_at !== undefined) {
    const mutationStarted = parseTimestamp(options.mutation_started_at);
    if (
      mutationStarted === undefined ||
      completed === undefined ||
      checksumVerified === undefined ||
      completed > mutationStarted ||
      checksumVerified > mutationStarted ||
      mutationStarted - completed > 30 * 60 * 1000
    ) {
      issues.push(
        issue(
          'BACKUP_PREMUTATION_WINDOW_INVALID',
          'checksum_verified_at',
          'Backup completion and checksum verification must precede mutation; completion must be no more than 30 minutes earlier.',
        ),
      );
    }
  }

  return result(issues);
}

const REQUIRED_RESTORE_CHECKS = [
  'decryption_verified',
  'migrations_and_checksums_verified',
  'aggregate_fingerprint_verified',
  'admin_roles_and_zero_sessions_verified',
  'isolation_and_access_verified',
  'content_audit_outbox_verified',
  'receipt_journal_verified',
  'purge_ledger_and_replica_verified',
  'deleted_seed_remains_deleted',
  'provider_effects_disabled',
] as const;

export function validateRestoreEvidence(
  input: RestoreEvidence,
  options: {
    evaluated_at: string;
    current_material_architecture_fingerprint: string;
  },
): ReturnType<typeof result> {
  const issues: ValidationIssue[] = [];
  if (input.evidence_kind !== 'isolated_restore_drill') {
    issues.push(
      issue(
        'RESTORE_EVIDENCE_KIND_INVALID',
        'evidence_kind',
        'The evidence record must explicitly identify an isolated restore drill.',
      ),
    );
  }
  issues.push(...validateEnvironmentIdentity(input).issues);
  if (input.runtime_tier !== 'isolated_staging') {
    issues.push(
      issue(
        'RESTORE_TARGET_TIER_INVALID',
        'runtime_tier',
        'A restore drill must execute only in an isolated verification environment.',
      ),
    );
  }
  requireIdentity(issues, input.source_backup_identifier, 'source_backup_identifier');
  requireIdentity(issues, input.isolated_target_identity, 'isolated_target_identity');
  requireSha(issues, input.material_architecture_fingerprint, 'material_architecture_fingerprint');
  requireSha(
    issues,
    options.current_material_architecture_fingerprint,
    'current_material_architecture_fingerprint',
  );

  const started = parseTimestamp(input.started_at);
  const completed = parseTimestamp(input.completed_at);
  const cleanupAuthorized = parseTimestamp(input.cleanup_authorized_at);
  const cleanedUp = parseTimestamp(input.cleaned_up_at);
  const evaluated = parseTimestamp(options.evaluated_at);
  if (
    started === undefined ||
    completed === undefined ||
    cleanupAuthorized === undefined ||
    cleanedUp === undefined ||
    completed < started ||
    cleanupAuthorized < completed ||
    cleanedUp < cleanupAuthorized
  ) {
    issues.push(
      issue(
        'RESTORE_TIMELINE_INVALID',
        'completed_at',
        'Restore and authorized cleanup timestamps must be complete and ordered.',
      ),
    );
  }
  if (
    completed === undefined ||
    evaluated === undefined ||
    evaluated < completed ||
    evaluated - completed > 90 * 24 * 60 * 60 * 1000
  ) {
    issues.push(
      issue(
        'RESTORE_DRILL_STALE',
        'completed_at',
        'The restore drill must be no more than 90 days old.',
      ),
    );
  }
  if (
    evaluated === undefined ||
    cleanupAuthorized === undefined ||
    cleanedUp === undefined ||
    cleanupAuthorized > evaluated ||
    cleanedUp > evaluated
  ) {
    issues.push(
      issue(
        'RESTORE_EVIDENCE_FROM_FUTURE',
        'cleaned_up_at',
        'Restore authorization and cleanup must be complete before evaluation.',
      ),
    );
  }

  if (
    input.material_architecture_fingerprint !== options.current_material_architecture_fingerprint
  ) {
    issues.push(
      issue(
        'RESTORE_ARCHITECTURE_MISMATCH',
        'material_architecture_fingerprint',
        'A material architecture change invalidates earlier restore proof.',
      ),
    );
  }

  for (const check of REQUIRED_RESTORE_CHECKS) {
    if (input[check] !== true) {
      issues.push(issue('RESTORE_CHECK_NOT_PROVEN', check, `${check} must be explicitly true.`));
    }
  }
  if (!Number.isFinite(input.rpo_minutes) || input.rpo_minutes < 0 || input.rpo_minutes > 15) {
    issues.push(
      issue('RESTORE_RPO_EXCEEDED', 'rpo_minutes', 'RPO must be between 0 and 15 minutes.'),
    );
  }
  if (!Number.isFinite(input.rto_minutes) || input.rto_minutes < 0 || input.rto_minutes > 30) {
    issues.push(
      issue('RESTORE_RTO_EXCEEDED', 'rto_minutes', 'RTO must be between 0 and 30 minutes.'),
    );
  }

  return result(issues);
}
