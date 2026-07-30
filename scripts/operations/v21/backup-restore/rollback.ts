import { isLowercaseSha256, issue, result, type ValidationIssue } from './validation.ts';
import { validateEnvironmentIdentity } from './environment.ts';

export type RollbackTrigger =
  | 'authorization_isolation_failure'
  | 'secret_or_protected_data_exposure'
  | 'wrong_candidate_or_configuration'
  | 'migration_or_data_integrity_failure'
  | 'critical_journey_failure'
  | 'billing_or_access_failure'
  | 'duplicate_external_effect'
  | 'unsafe_queue_replay';

export interface RollbackDecisionInput {
  verification_environment_id: string;
  runtime_tier: string;
  credential_boundary: string;
  candidate_sha: string;
  configuration_digest: string;
  authorization_digest: string;
  triggers: readonly RollbackTrigger[];
  writes_stopped: boolean;
  provider_effects_disabled: boolean;
  evidence_preserved: boolean;
  previous_artifact_sha: string | null;
  previous_configuration_digest: string | null;
  previous_artifact_migration_compatible: boolean;
  database_restore_requested: boolean;
  incident_commander_declared_recovery: boolean;
  restore_point_and_loss_window_known: boolean;
  post_restore_effects_inventoried: boolean;
  isolated_restore_verified: boolean;
  production_replacement_authorized: boolean;
  post_restore_reconciliation_ready: boolean;
}

export type RollbackAction =
  | 'continue_monitoring'
  | 'contain'
  | 'rollback_application'
  | 'roll_forward'
  | 'destructive_recovery_blocked'
  | 'destructive_recovery_authorized';

export interface RollbackDecision {
  verification_environment_id: string;
  runtime_tier: string;
  action: RollbackAction;
  executable: false;
  provider_effects_must_remain_disabled: boolean;
  database_downgrade_allowed: false;
  issues: readonly ValidationIssue[];
  ordered_controls: readonly string[];
}

const CONTAINMENT_CONTROLS = [
  'disable affected provider effects',
  'stop unsafe queue claims',
  'preserve leases, idempotency records, logs, and provider readback',
  'stop risky signup or login paths',
  'retain safe read-only paths',
  'notify both Admins through the secure incident route',
] as const;

export function decideRollback(input: RollbackDecisionInput): RollbackDecision {
  const identityIssues: ValidationIssue[] = [...validateEnvironmentIdentity(input).issues];
  for (const [path, digest] of [
    ['candidate_sha', input.candidate_sha],
    ['configuration_digest', input.configuration_digest],
    ['authorization_digest', input.authorization_digest],
  ] as const) {
    if (!isLowercaseSha256(digest)) {
      identityIssues.push(
        issue(
          'ROLLBACK_IDENTITY_INVALID',
          path,
          'An immutable lowercase SHA-256 identity is required.',
        ),
      );
    }
  }
  const decisionIdentity = {
    verification_environment_id: input.verification_environment_id,
    runtime_tier: input.runtime_tier,
  };
  if (input.triggers.length === 0) {
    return {
      ...decisionIdentity,
      action: identityIssues.length === 0 ? 'continue_monitoring' : 'contain',
      executable: false,
      provider_effects_must_remain_disabled: identityIssues.length !== 0,
      database_downgrade_allowed: false,
      issues: identityIssues,
      ordered_controls: identityIssues.length === 0 ? [] : CONTAINMENT_CONTROLS,
    };
  }

  const containmentIssues: ValidationIssue[] = [...identityIssues];
  if (!input.writes_stopped) {
    containmentIssues.push(
      issue('ROLLBACK_WRITES_NOT_STOPPED', 'writes_stopped', 'Stop unsafe writes first.'),
    );
  }
  if (!input.provider_effects_disabled) {
    containmentIssues.push(
      issue(
        'ROLLBACK_EFFECTS_NOT_DISABLED',
        'provider_effects_disabled',
        'Provider effects must be disabled before recovery.',
      ),
    );
  }
  if (!input.evidence_preserved) {
    containmentIssues.push(
      issue(
        'ROLLBACK_EVIDENCE_NOT_PRESERVED',
        'evidence_preserved',
        'Preserve leases, idempotency records, logs, and readback.',
      ),
    );
  }
  if (containmentIssues.length > 0) {
    return {
      ...decisionIdentity,
      action: 'contain',
      executable: false,
      provider_effects_must_remain_disabled: true,
      database_downgrade_allowed: false,
      issues: containmentIssues,
      ordered_controls: CONTAINMENT_CONTROLS,
    };
  }

  if (input.database_restore_requested) {
    const destructiveIssues = [
      ['incident_commander_declared_recovery', input.incident_commander_declared_recovery],
      ['restore_point_and_loss_window_known', input.restore_point_and_loss_window_known],
      ['post_restore_effects_inventoried', input.post_restore_effects_inventoried],
      ['isolated_restore_verified', input.isolated_restore_verified],
      ['production_replacement_authorized', input.production_replacement_authorized],
      ['post_restore_reconciliation_ready', input.post_restore_reconciliation_ready],
    ] as const;
    const issues = destructiveIssues
      .filter(([, passed]) => !passed)
      .map(([path]) =>
        issue(
          'DESTRUCTIVE_RECOVERY_GATE_OPEN',
          path,
          'Every destructive-recovery authorization and proof must be explicit.',
        ),
      );
    return {
      ...decisionIdentity,
      action:
        issues.length === 0 ? 'destructive_recovery_authorized' : 'destructive_recovery_blocked',
      executable: false,
      provider_effects_must_remain_disabled: true,
      database_downgrade_allowed: false,
      issues,
      ordered_controls: [
        ...CONTAINMENT_CONTROLS,
        'restore first to an isolated target and verify integrity',
        'replace production only under explicit authority',
        'reconcile provider and outbox effects before resuming',
      ],
    };
  }

  const artifactReady =
    input.previous_artifact_sha !== null &&
    isLowercaseSha256(input.previous_artifact_sha) &&
    input.previous_configuration_digest !== null &&
    isLowercaseSha256(input.previous_configuration_digest) &&
    input.previous_artifact_migration_compatible;
  const validation = artifactReady
    ? result([])
    : result([
        issue(
          'ROLLBACK_ARTIFACT_INCOMPATIBLE',
          'previous_artifact_sha',
          'Web, worker, matching configuration, and applied migrations need one proven compatible artifact.',
        ),
      ]);
  return {
    ...decisionIdentity,
    action: validation.passed ? 'rollback_application' : 'roll_forward',
    executable: false,
    provider_effects_must_remain_disabled: true,
    database_downgrade_allowed: false,
    issues: validation.issues,
    ordered_controls: validation.passed
      ? [
          'deploy the same recorded artifact to web and worker',
          'apply its matching configuration digest',
          'do not downgrade the database',
          'reconcile before re-enabling provider effects',
        ]
      : [
          'keep the service contained',
          'prepare a migration-compatible roll-forward fix',
          'do not improvise reverse SQL or production schema edits',
        ],
  };
}
