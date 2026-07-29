import {
  OPERATIONS_CONTRACT_VERSION,
  OPERATIONS_PROVIDER_KEYS,
  type MigrationHealthObservation,
  type OperationsAlert,
  type OperationsHealthInput,
  type OperationsHealthSnapshot,
  type OperationsIssue,
  type OperationsSeverity,
  type QueueClass,
} from './contracts.ts';
import { evaluateRuntimeAgreement } from './runtime-identity.ts';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export const QUEUE_AGE_THRESHOLDS_MS: Readonly<
  Record<QueueClass, { warning: number; critical: number }>
> = {
  security_delivery: { warning: 2 * MINUTE, critical: 5 * MINUTE },
  classroom_access: { warning: MINUTE, critical: 3 * MINUTE },
  billing_access: { warning: MINUTE, critical: 3 * MINUTE },
  parent_reminder: { warning: 5 * MINUTE, critical: 15 * MINUTE },
  adult_crm_projection: { warning: 10 * MINUTE, critical: 30 * MINUTE },
  content_processing: { warning: 15 * MINUTE, critical: 30 * MINUTE },
  approved_marketing: { warning: 30 * MINUTE, critical: 60 * MINUTE },
};

export function buildOperationsHealthSnapshot(
  input: OperationsHealthInput,
): OperationsHealthSnapshot {
  const runtime = evaluateRuntimeAgreement({
    candidate: input.candidate,
    runtimes: input.runtimes,
  });
  const migration = evaluateMigrationHealth(input.migrations);
  const issues: OperationsIssue[] = [
    ...runtime.issues,
    ...migration.issues,
    ...evaluateDatabaseHealth(input.database),
    ...evaluateQueueHealth(input.queues),
    ...evaluateWorkerHealth(input.workers),
    ...evaluateProviderHealth(input.providers),
    ...(input.leakage_issues ?? []),
  ];
  return {
    schema_version: OPERATIONS_CONTRACT_VERSION,
    generated_at: input.generated_at,
    status: highestSeverity(issues),
    candidate_id: input.candidate.candidate_id,
    runtime_tier: input.candidate.runtime_tier,
    verification_environment_id: input.candidate.verification_environment_id,
    runtime_agreement: runtime.ok,
    migration_drift: !migration.ok,
    database: input.database,
    queues: input.queues,
    workers: input.workers,
    providers: input.providers,
    issues: dedupeIssues(issues),
  };
}

export function evaluateMigrationHealth(observation: MigrationHealthObservation): {
  ok: boolean;
  issues: OperationsIssue[];
} {
  const issues: OperationsIssue[] = [];
  const expected = new Map(observation.expected.map((entry) => [entry.ordinal, entry]));
  const appliedOrdinals = new Set<number>();
  for (const entry of observation.applied) {
    if (appliedOrdinals.has(entry.ordinal)) {
      issues.push(migrationIssue('migration_duplicate_ordinal', entry.ordinal));
      continue;
    }
    appliedOrdinals.add(entry.ordinal);
    const canonical = expected.get(entry.ordinal);
    if (!canonical) {
      issues.push(migrationIssue('migration_unknown_applied', entry.ordinal));
    } else if (canonical.name !== entry.name || canonical.sha256 !== entry.sha256) {
      issues.push(migrationIssue('migration_checksum_drift', entry.ordinal));
    }
  }
  for (const entry of observation.expected) {
    if (!appliedOrdinals.has(entry.ordinal)) {
      issues.push(migrationIssue('migration_expected_missing', entry.ordinal));
    }
  }
  if (!observation.read_only_verification_passed) {
    issues.push(migrationIssue('migration_readback_failed', null));
  }
  return { ok: issues.length === 0, issues };
}

export function evaluateOperationsAlerts(snapshot: OperationsHealthSnapshot): OperationsAlert[] {
  return snapshot.issues.map((issue) => ({
    schema_version: OPERATIONS_CONTRACT_VERSION,
    alert_key: `${issue.category}:${issue.code}`,
    severity: issue.severity,
    category: issue.category,
    generated_at: snapshot.generated_at,
    summary: issue.summary,
    routes: ['ot_secure_operations', 'admin_operations'],
    safe_context: issue.safe_context,
  }));
}

function evaluateDatabaseHealth(database: OperationsHealthInput['database']): OperationsIssue[] {
  const issues: OperationsIssue[] = [];
  if (!database.available && database.consecutive_failed_minute_probes >= 2) {
    issues.push({
      code: 'database_unavailable_two_probes',
      category: 'database',
      severity: 'sev1',
      summary: 'Production database is unavailable for two consecutive probes.',
      safe_context: {
        consecutive_failed_minute_probes: database.consecutive_failed_minute_probes,
      },
    });
  } else if (!database.available) {
    issues.push({
      code: 'database_probe_failed',
      category: 'database',
      severity: 'warning',
      summary: 'A database availability probe failed.',
      safe_context: {
        consecutive_failed_minute_probes: database.consecutive_failed_minute_probes,
      },
    });
  }
  if ((database.storage_percent ?? 0) > 85) {
    issues.push(databaseThresholdIssue('database_storage_critical', 'sev2'));
  } else if ((database.storage_percent ?? 0) > 70) {
    issues.push(databaseThresholdIssue('database_storage_warning', 'warning'));
  }
  if (
    (database.connection_utilization_percent ?? 0) > 85 &&
    (database.high_connection_utilization_age_ms ?? 0) >= 10 * MINUTE
  ) {
    issues.push(databaseThresholdIssue('database_connections_critical', 'sev2'));
  }
  if ((database.blocking_lock_age_ms ?? 0) > MINUTE) {
    issues.push(databaseThresholdIssue('database_blocking_lock_critical', 'sev2'));
  }
  return issues;
}

function evaluateQueueHealth(queues: OperationsHealthInput['queues']): OperationsIssue[] {
  const issues: OperationsIssue[] = [];
  for (const queue of queues) {
    const threshold = QUEUE_AGE_THRESHOLDS_MS[queue.queue_class];
    const age = queue.oldest_ready_age_ms ?? 0;
    if (queue.duplicate_effect_risk) {
      issues.push({
        code: 'queue_duplicate_effect_risk',
        category: 'queue',
        severity: 'sev1',
        summary: 'Queue state can repeat an external effect.',
        safe_context: { queue: queue.queue },
      });
    }
    if (age > threshold.critical) {
      issues.push(queueIssue(queue.queue, 'queue_age_critical', 'sev2', age));
    } else if (age > threshold.warning) {
      issues.push(queueIssue(queue.queue, 'queue_age_warning', 'warning', age));
    }
    if (queue.expired_lease_count > 0) {
      issues.push(
        queueIssue(queue.queue, 'queue_expired_leases', 'warning', queue.expired_lease_count),
      );
    }
    if (queue.dead_letter_count > 0) {
      issues.push(
        queueIssue(queue.queue, 'queue_dead_letters', 'warning', queue.dead_letter_count),
      );
    }
    if (queue.acceptance_unknown_count > 0) {
      issues.push(
        queueIssue(
          queue.queue,
          'queue_acceptance_unknown',
          'warning',
          queue.acceptance_unknown_count,
        ),
      );
    }
  }
  return issues;
}

function evaluateWorkerHealth(workers: OperationsHealthInput['workers']): OperationsIssue[] {
  const issues: OperationsIssue[] = [];
  for (const worker of workers) {
    if (!worker.source_agrees_with_candidate || !worker.configuration_agrees_with_candidate) {
      issues.push({
        code: 'worker_candidate_mismatch',
        category: 'worker',
        severity: 'sev1',
        summary: 'Worker source or configuration differs from the candidate.',
        safe_context: { worker_type: worker.worker_type },
      });
    }
    if (worker.heartbeat_age_ms > 5 * MINUTE) {
      issues.push(workerIssue(worker.worker_type, 'worker_heartbeat_critical', 'sev2'));
    } else if (worker.heartbeat_age_ms > 2 * MINUTE) {
      issues.push(workerIssue(worker.worker_type, 'worker_heartbeat_warning', 'warning'));
    }
  }
  return issues;
}

function evaluateProviderHealth(providers: OperationsHealthInput['providers']): OperationsIssue[] {
  const issues: OperationsIssue[] = [];
  const observed = new Set(providers.map((provider) => provider.provider));
  for (const provider of OPERATIONS_PROVIDER_KEYS) {
    if (!observed.has(provider)) {
      issues.push({
        code: 'provider_status_missing',
        category: 'provider',
        severity: 'warning',
        summary: 'A provider health status is absent.',
        safe_context: { provider },
      });
    }
  }
  for (const provider of providers) {
    if (provider.required && provider.state === 'not_configured') {
      issues.push(providerIssue(provider.provider, 'provider_required_not_configured', 'sev2'));
    } else if (
      provider.required &&
      provider.state === 'unavailable' &&
      (provider.unavailable_age_ms ?? 0) >= 15 * MINUTE
    ) {
      issues.push(providerIssue(provider.provider, 'provider_unavailable_15m', 'sev2'));
    } else if (provider.state === 'degraded' || provider.state === 'unavailable') {
      issues.push(providerIssue(provider.provider, 'provider_degraded', 'warning'));
    }
    if (
      provider.credential_expires_in_ms !== null &&
      provider.credential_expires_in_ms <= 14 * DAY
    ) {
      issues.push(providerIssue(provider.provider, 'provider_credential_expiry_14d', 'warning'));
    }
  }
  return issues;
}

function highestSeverity(issues: readonly OperationsIssue[]): OperationsSeverity {
  const rank: Record<OperationsSeverity, number> = { ok: 0, warning: 1, sev2: 2, sev1: 3 };
  return issues.reduce<OperationsSeverity>(
    (highest, issue) => (rank[issue.severity] > rank[highest] ? issue.severity : highest),
    'ok',
  );
}

function migrationIssue(code: string, ordinal: number | null): OperationsIssue {
  return {
    code,
    category: 'migration',
    severity: 'sev1',
    summary: 'Applied migration history does not match the forward-only inventory.',
    safe_context: { ordinal },
  };
}

function databaseThresholdIssue(code: string, severity: 'warning' | 'sev2'): OperationsIssue {
  return {
    code,
    category: 'database',
    severity,
    summary: 'A database health threshold was crossed.',
    safe_context: {},
  };
}

function queueIssue(
  queue: string,
  code: string,
  severity: 'warning' | 'sev2',
  observed: number,
): OperationsIssue {
  return {
    code,
    category: 'queue',
    severity,
    summary: 'A queue health threshold was crossed.',
    safe_context: { queue, observed },
  };
}

function workerIssue(
  workerType: string,
  code: string,
  severity: 'warning' | 'sev2',
): OperationsIssue {
  return {
    code,
    category: 'worker',
    severity,
    summary: 'A worker heartbeat threshold was crossed.',
    safe_context: { worker_type: workerType },
  };
}

function providerIssue(
  provider: string,
  code: string,
  severity: 'warning' | 'sev2',
): OperationsIssue {
  return {
    code,
    category: 'provider',
    severity,
    summary: 'A provider health threshold was crossed.',
    safe_context: { provider },
  };
}

function dedupeIssues(issues: readonly OperationsIssue[]): OperationsIssue[] {
  return [
    ...new Map(
      issues.map((issue) => [
        `${issue.category}:${issue.code}:${JSON.stringify(issue.safe_context)}`,
        issue,
      ]),
    ).values(),
  ];
}
