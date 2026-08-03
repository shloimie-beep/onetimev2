import {
  isLowercaseSha256,
  issue,
  result,
  validateEnvironmentIdentity,
  type ValidationIssue,
} from '../backup-restore/index.ts';

export const PRODUCTION_OPERATOR_CANARY_BUDGET = {
  'one_time.parent_accounts_created_or_updated': 2,
  'one_time.households_created_or_updated': 2,
  'one_time.student_accounts_created_or_updated': 6,
  'one_time.support_tickets': 4,
  'one_time.student_questions': 4,
  'one_time.unexpected_cross_household_reads': 0,
  'highlevel.operator_contacts_created_or_updated': 2,
  'highlevel.workflow_enrollments': 4,
  'highlevel.broad_campaign_contacts': 0,
  'highlevel.student_contacts': 0,
  'email.resend_messages': 8,
  'email.ghl_messages': 12,
  'email.unrelated_recipients': 0,
  'whatsapp.messages': 0,
  'whatsapp.workflow_executions': 0,
  'zoom.meetings_created': 1,
  'zoom.registrants_created': 3,
  'zoom.simultaneous_student_sessions': 3,
  'zoom.raw_join_urls_exposed': 0,
  'stripe.live_checkout_sessions': 1,
  'stripe.live_charge_total_usd': 67,
  'stripe.live_refunds': 1,
  'stripe.unrelated_customer_mutations': 0,
  'drive.files_ingested': 1,
  'drive.unrelated_files_moved_or_deleted': 0,
  'vimeo.assets_uploaded': 1,
  'vimeo.unrelated_assets_mutated': 0,
  'telegram.operator_notifications': 12,
  'telegram.customer_messages': 0,
  'destructive_effects.customer_deletions': 0,
  'destructive_effects.provider_account_deletions': 0,
  'destructive_effects.broad_data_rewrites': 0,
} as const;

export type CanaryEffectKey = keyof typeof PRODUCTION_OPERATOR_CANARY_BUDGET;

export interface CanaryLedgerEntry {
  effect: string;
  attempted: number;
  succeeded: number;
  reconciled: number;
}

export interface CanaryLedgerInput {
  verification_environment_id: string;
  runtime_tier: string;
  credential_boundary: string;
  candidate_sha: string;
  authorization_digest: string;
  operator_owned_scope_confirmed: boolean;
  backup_restore_gate_passed: boolean;
  rollback_gate_passed: boolean;
  legal_artifact_gate_passed: boolean;
  acceptance_unknown: boolean;
  stop_condition_observed: boolean;
  entries: readonly CanaryLedgerEntry[];
}

export interface CanaryLedgerResult {
  verification_environment_id: string;
  runtime_tier: string;
  candidate_sha: string;
  authorization_digest: string;
  passed: boolean;
  disposition: 'ready' | 'blocked' | 'stop_and_reconcile';
  issues: readonly ValidationIssue[];
  totals: {
    attempted: number;
    succeeded: number;
    reconciled: number;
  };
}

function isSafeMetric(effect: string, value: number): boolean {
  if (effect === 'stripe.live_charge_total_usd') {
    return Number.isFinite(value) && value >= 0 && Number.isSafeInteger(value * 100);
  }
  return Number.isSafeInteger(value) && value >= 0;
}

export function evaluateCanaryLedger(input: CanaryLedgerInput): CanaryLedgerResult {
  const issues: ValidationIssue[] = [];
  const environment = validateEnvironmentIdentity(input);
  issues.push(...environment.issues);
  if (
    input.verification_environment_id !== 'production_operator_canary' ||
    input.runtime_tier !== 'production'
  ) {
    issues.push(
      issue(
        'CANARY_ENVIRONMENT_INVALID',
        'verification_environment_id',
        'This budget is valid only for production_operator_canary / production.',
      ),
    );
  }
  for (const [path, digest] of [
    ['candidate_sha', input.candidate_sha],
    ['authorization_digest', input.authorization_digest],
  ] as const) {
    if (!isLowercaseSha256(digest)) {
      issues.push(
        issue(
          'CANARY_IDENTITY_INVALID',
          path,
          'The canary must bind an immutable lowercase SHA-256 identity.',
        ),
      );
    }
  }
  if (!input.operator_owned_scope_confirmed) {
    issues.push(
      issue(
        'CANARY_SCOPE_UNCONFIRMED',
        'operator_owned_scope_confirmed',
        'Only verified operator-owned records are authorized.',
      ),
    );
  }
  if (!input.backup_restore_gate_passed) {
    issues.push(
      issue(
        'CANARY_BACKUP_RESTORE_GATE_OPEN',
        'backup_restore_gate_passed',
        'Current backup and restore evidence is required before a real canary.',
      ),
    );
  }
  if (!input.rollback_gate_passed) {
    issues.push(
      issue(
        'CANARY_ROLLBACK_GATE_OPEN',
        'rollback_gate_passed',
        'A migration-compatible rollback gate must be proven.',
      ),
    );
  }
  if (!input.legal_artifact_gate_passed) {
    issues.push(
      issue(
        'CANARY_LEGAL_GATE_OPEN',
        'legal_artifact_gate_passed',
        'The non-fabricatable external legal artifact gate remains open.',
      ),
    );
  }
  if (input.acceptance_unknown) {
    issues.push(
      issue(
        'CANARY_ACCEPTANCE_UNKNOWN',
        'acceptance_unknown',
        'Unknown provider acceptance must be quarantined and reconciled.',
      ),
    );
  }
  if (input.stop_condition_observed) {
    issues.push(
      issue(
        'CANARY_STOP_CONDITION',
        'stop_condition_observed',
        'Stop immediately, contain effects, and reconcile.',
      ),
    );
  }

  const seen = new Set<string>();
  let attempted = 0;
  let succeeded = 0;
  let reconciled = 0;
  for (const entry of input.entries) {
    const limit = PRODUCTION_OPERATOR_CANARY_BUDGET[entry.effect as CanaryEffectKey];
    const entryPath = `entries.${entry.effect}`;
    if (limit === undefined) {
      issues.push(
        issue(
          'CANARY_EFFECT_UNKNOWN',
          entryPath,
          'An effect absent from the locked budget is forbidden.',
        ),
      );
      continue;
    }
    if (seen.has(entry.effect)) {
      issues.push(
        issue(
          'CANARY_EFFECT_DUPLICATE',
          entryPath,
          'Each effect must have exactly one ledger entry.',
        ),
      );
      continue;
    }
    seen.add(entry.effect);
    if (
      !isSafeMetric(entry.effect, entry.attempted) ||
      !isSafeMetric(entry.effect, entry.succeeded) ||
      !isSafeMetric(entry.effect, entry.reconciled)
    ) {
      issues.push(
        issue(
          'CANARY_COUNT_INVALID',
          entryPath,
          'Effect counts must be non-negative safe integers; USD totals may use whole cents.',
        ),
      );
      continue;
    }
    attempted += entry.attempted;
    succeeded += entry.succeeded;
    reconciled += entry.reconciled;
    if (entry.attempted > limit || entry.succeeded > limit) {
      issues.push(
        issue(
          'CANARY_BUDGET_EXCEEDED',
          entryPath,
          `Attempted and succeeded effects cannot exceed the locked limit ${limit}.`,
        ),
      );
    }
    if (entry.succeeded > entry.attempted) {
      issues.push(
        issue(
          'CANARY_SUCCESS_EXCEEDS_ATTEMPTS',
          entryPath,
          'A succeeded effect must correspond to an attempted effect.',
        ),
      );
    }
    if (entry.reconciled > entry.attempted) {
      issues.push(
        issue(
          'CANARY_RECONCILIATION_EXCEEDS_ATTEMPTS',
          entryPath,
          'Reconciliation cannot exceed attempted effects.',
        ),
      );
    }
    if (entry.reconciled !== entry.attempted) {
      issues.push(
        issue(
          'CANARY_EFFECT_UNRECONCILED',
          entryPath,
          'Every attempted effect needs exact provider readback or an explicit reconciled failure.',
        ),
      );
    }
  }
  for (const effect of Object.keys(PRODUCTION_OPERATOR_CANARY_BUDGET)) {
    if (!seen.has(effect)) {
      issues.push(
        issue(
          'CANARY_EFFECT_MISSING',
          `entries.${effect}`,
          'Every locked effect class requires exactly one ledger row, including zero effects.',
        ),
      );
    }
  }

  const validation = result(issues);
  const mustStop =
    input.stop_condition_observed ||
    input.acceptance_unknown ||
    issues.some((item) =>
      [
        'CANARY_BUDGET_EXCEEDED',
        'CANARY_EFFECT_UNKNOWN',
        'CANARY_EFFECT_MISSING',
        'CANARY_EFFECT_UNRECONCILED',
        'CANARY_SUCCESS_EXCEEDS_ATTEMPTS',
        'CANARY_RECONCILIATION_EXCEEDS_ATTEMPTS',
      ].includes(item.code),
    );
  return {
    verification_environment_id: input.verification_environment_id,
    runtime_tier: input.runtime_tier,
    candidate_sha: input.candidate_sha,
    authorization_digest: input.authorization_digest,
    passed: validation.passed,
    disposition: validation.passed ? 'ready' : mustStop ? 'stop_and_reconcile' : 'blocked',
    issues: validation.issues,
    totals: { attempted, succeeded, reconciled },
  };
}
