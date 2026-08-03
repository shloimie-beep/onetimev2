import assert from 'node:assert/strict';

import {
  decideRollback,
  validateBackupEvidence,
  validateEnvironmentIdentity,
  validateLegalPolicyGate,
  validateRestoreEvidence,
  type LegalPolicyGateInput,
} from './index.ts';

const digestA = 'a'.repeat(64);
const digestB = 'b'.repeat(64);

assert.equal(
  validateEnvironmentIdentity({
    verification_environment_id: 'production_operator_canary',
    runtime_tier: 'production',
    credential_boundary: 'live',
  }).passed,
  true,
);
assert.equal(
  validateEnvironmentIdentity({
    verification_environment_id: 'production_operator_canary',
    runtime_tier: 'isolated_staging',
    credential_boundary: 'isolated',
  }).passed,
  false,
);

const validBackupFixture = {
  evidence_kind: 'backup',
  verification_environment_id: 'production_read_only',
  runtime_tier: 'production',
  credential_boundary: 'live',
  source_database_identity: 'verification-fixture-source',
  backup_identifier: 'verification-fixture-backup',
  point_in_time_marker: 'verification-fixture-marker',
  created_at: '2026-01-01T00:00:00Z',
  completed_at: '2026-01-01T00:05:00Z',
  encryption_state: 'encrypted',
  schema_migration_fingerprint: digestA,
  aggregate_row_fingerprint: digestB,
  object_checksum: digestA,
  checksum_verified_at: '2026-01-01T00:06:00Z',
  retention_expires_at: '2026-02-05T00:00:00Z',
  restore_procedure_version: 'verification-fixture-v1',
} as const;
assert.equal(
  validateBackupEvidence(validBackupFixture, {
    mutation_started_at: '2026-01-01T00:25:00Z',
    evaluated_at: '2026-01-02T00:00:00Z',
  }).passed,
  true,
);
const checksumAfterMutation = validateBackupEvidence(
  { ...validBackupFixture, checksum_verified_at: '2026-01-01T00:26:00Z' },
  {
    mutation_started_at: '2026-01-01T00:25:00Z',
    evaluated_at: '2026-01-02T00:00:00Z',
  },
);
assert.equal(checksumAfterMutation.passed, false);
assert.ok(
  checksumAfterMutation.issues.some(({ code }) => code === 'BACKUP_PREMUTATION_WINDOW_INVALID'),
);
const futureBackup = validateBackupEvidence(validBackupFixture, {
  mutation_started_at: '2026-01-01T00:25:00Z',
  evaluated_at: '2025-12-31T23:59:00Z',
});
assert.equal(futureBackup.passed, false);
assert.ok(futureBackup.issues.some(({ code }) => code === 'BACKUP_EVIDENCE_FROM_FUTURE'));
const placeholderBackup = validateBackupEvidence(
  { ...validBackupFixture, backup_identifier: 'TBD' },
  {
    mutation_started_at: '2026-01-01T00:25:00Z',
    evaluated_at: '2026-01-02T00:00:00Z',
  },
);
assert.equal(placeholderBackup.passed, false);
assert.ok(placeholderBackup.issues.some(({ code }) => code === 'EVIDENCE_IDENTITY_INVALID'));

assert.equal(
  validateRestoreEvidence(
    {
      evidence_kind: 'isolated_restore_drill',
      verification_environment_id: 'persistent_staging',
      runtime_tier: 'isolated_staging',
      credential_boundary: 'isolated',
      source_backup_identifier: 'verification-fixture-backup',
      isolated_target_identity: 'verification-fixture-isolated-target',
      started_at: '2026-04-01T00:00:00Z',
      completed_at: '2026-04-01T00:30:00Z',
      cleanup_authorized_at: '2026-04-01T00:31:00Z',
      cleaned_up_at: '2026-04-01T00:35:00Z',
      decryption_verified: true,
      migrations_and_checksums_verified: true,
      aggregate_fingerprint_verified: true,
      admin_roles_and_zero_sessions_verified: true,
      isolation_and_access_verified: true,
      content_audit_outbox_verified: true,
      receipt_journal_verified: true,
      purge_ledger_and_replica_verified: true,
      deleted_seed_remains_deleted: true,
      provider_effects_disabled: true,
      rpo_minutes: 15,
      rto_minutes: 30,
      material_architecture_fingerprint: digestA,
    },
    {
      evaluated_at: '2026-05-01T00:00:00Z',
      current_material_architecture_fingerprint: digestA,
    },
  ).passed,
  true,
);

const deliberatelyUnapprovedLegalFixture: LegalPolicyGateInput = {
  evidence_kind: 'external_legal_policy_bundle',
  verification_environment_id: 'production_broad',
  runtime_tier: 'production',
  credential_boundary: 'live',
  manifest_path: 'legal/legal-policy-manifest.json',
  manifest_sha256: digestA,
  release_manifest_legal_manifest_sha256: digestA,
  acceptance_evidence_legal_manifest_sha256: digestA,
  product_owner_full_name: 'Product Owner',
  product_owner_approved_at: '2026-01-01T00:00:00Z',
  qualified_legal_reviewer_full_name: 'Legal Reviewer',
  qualified_legal_reviewer_credential_or_firm: 'placeholder',
  legal_approved_at: '2026-01-01T00:00:00Z',
  review_scope: [],
  repository_sha: digestA,
  application_content_sha: digestA,
  release_configuration_digest: digestA,
  artifacts: [],
};
const legalResult = validateLegalPolicyGate(deliberatelyUnapprovedLegalFixture, {
  evaluated_at: '2026-01-02T00:00:00Z',
});
assert.equal(legalResult.gate, 'open');
assert.ok(legalResult.issues.some(({ code }) => code === 'LEGAL_ARTIFACT_MISSING'));
assert.ok(legalResult.issues.some(({ code }) => code === 'LEGAL_NAMED_PERSON_REQUIRED'));

const rollback = decideRollback({
  verification_environment_id: 'production_operator_canary',
  runtime_tier: 'production',
  credential_boundary: 'live',
  candidate_sha: digestA,
  configuration_digest: digestB,
  authorization_digest: digestA,
  triggers: ['migration_or_data_integrity_failure'],
  writes_stopped: true,
  provider_effects_disabled: true,
  evidence_preserved: true,
  previous_artifact_sha: digestA,
  previous_configuration_digest: digestB,
  previous_artifact_migration_compatible: true,
  database_restore_requested: false,
  incident_commander_declared_recovery: false,
  restore_point_and_loss_window_known: false,
  post_restore_effects_inventoried: false,
  isolated_restore_verified: false,
  production_replacement_authorized: false,
  post_restore_reconciliation_ready: false,
});
assert.equal(rollback.action, 'rollback_application');
assert.equal(rollback.executable, false);
assert.equal(rollback.database_downgrade_allowed, false);

const blockedRestore = decideRollback({
  verification_environment_id: 'production_operator_canary',
  runtime_tier: 'production',
  credential_boundary: 'live',
  candidate_sha: digestA,
  configuration_digest: digestB,
  authorization_digest: digestA,
  triggers: ['migration_or_data_integrity_failure'],
  writes_stopped: true,
  provider_effects_disabled: true,
  evidence_preserved: true,
  previous_artifact_sha: null,
  previous_configuration_digest: null,
  previous_artifact_migration_compatible: false,
  database_restore_requested: true,
  incident_commander_declared_recovery: true,
  restore_point_and_loss_window_known: true,
  post_restore_effects_inventoried: true,
  isolated_restore_verified: false,
  production_replacement_authorized: false,
  post_restore_reconciliation_ready: false,
});
assert.equal(blockedRestore.action, 'destructive_recovery_blocked');

process.stdout.write('P34 backup, restore, environment, legal, and rollback checks passed.\n');
