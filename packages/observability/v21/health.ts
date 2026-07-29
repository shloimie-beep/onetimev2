import { createHash } from 'node:crypto';
import {
  OPERATIONS_CONTRACT_VERSION,
  OPERATIONS_PROVIDER_KEYS,
  type CandidateIdentity,
  type MigrationHealthObservation,
  type MigrationLedgerEntry,
  type OperationsAlert,
  type OperationsHealthInput,
  type OperationsHealthSnapshot,
  type OperationsIssue,
  type OperationsSeverity,
  type QueueClass,
} from './contracts.ts';
import {
  assertCandidateIdentity,
  evaluateRuntimeAgreement,
  isSafeOperationsIdentifier,
} from './runtime-identity.ts';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const SHA256 = /^[a-f0-9]{64}$/;
const MIGRATION_NAME = /^[0-9]{3,6}_[a-z0-9][a-z0-9_-]*\.sql$/;

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

export function computeMigrationInventoryDigest(entries: readonly MigrationLedgerEntry[]): string {
  const canonical = [...entries]
    .sort((left, right) => left.ordinal - right.ordinal || left.name.localeCompare(right.name))
    .map((entry) => `ordinal=${entry.ordinal};name=${entry.name};sha256=${entry.sha256}`)
    .join('\n');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function buildOperationsHealthSnapshot(
  input: OperationsHealthInput,
): OperationsHealthSnapshot {
  assertCandidateIdentity(input.candidate);
  assertGeneratedAt(input.generated_at);
  const runtime = evaluateRuntimeAgreement({
    candidate: input.candidate,
    runtimes: input.runtimes,
  });
  const migration = evaluateMigrationHealth({
    observation: input.migrations,
    candidate: input.candidate,
    generated_at: input.generated_at,
  });
  const issues = dedupeIssues([
    ...runtime.issues,
    ...migration.issues,
    ...evaluateDatabaseHealth(input.database, input.candidate, input.generated_at),
    ...evaluateQueueHealth(input.queues, input.candidate, input.generated_at),
    ...evaluateWorkerHealth(input.workers, input.candidate, input.generated_at),
    ...evaluateProviderHealth(input.providers, input.candidate, input.generated_at),
    ...(input.leakage_issues ?? []),
  ]);
  return {
    schema_version: OPERATIONS_CONTRACT_VERSION,
    generated_at: input.generated_at,
    status: highestSeverity(issues),
    candidate_id: input.candidate.candidate_id,
    runtime_tier: input.candidate.runtime_tier,
    verification_environment_id: input.candidate.verification_environment_id,
    runtime_agreement: runtime.ok,
    migration_drift: !migration.ok,
    evidence_ready: !issues.some((issue) => issue.severity === 'sev1'),
    database: input.database,
    queues: input.queues,
    workers: input.workers,
    providers: input.providers,
    issues,
  };
}

export function evaluateMigrationHealth(input: {
  observation: MigrationHealthObservation;
  candidate: CandidateIdentity;
  generated_at: string;
}): { ok: boolean; issues: OperationsIssue[] } {
  const { observation, candidate, generated_at: generatedAt } = input;
  const issues: OperationsIssue[] = [];
  const evidenceValid = validateEvidence(
    observation,
    candidate,
    generatedAt,
    'migration',
    'migration',
    issues,
  );
  const expectedValid = validateMigrationEntries(observation.expected, 'expected', issues);
  const appliedValid = validateMigrationEntries(observation.applied, 'applied', issues);
  if (
    candidate.operations_inventory.migration_inventory_required &&
    observation.expected.length === 0
  ) {
    issues.push(migrationIssue('migration_expected_inventory_empty', null));
  }
  if (expectedValid && observation.expected.length > 0) {
    const computed = computeMigrationInventoryDigest(observation.expected);
    if (computed !== candidate.migration_inventory_digest) {
      issues.push(migrationIssue('migration_candidate_digest_mismatch', null));
    }
  }
  if (expectedValid && appliedValid) {
    const expected = new Map(observation.expected.map((entry) => [entry.ordinal, entry]));
    const appliedOrdinals = new Set<number>();
    for (const entry of observation.applied) {
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
  }
  if (typeof observation.read_only_verification_passed !== 'boolean') {
    issues.push(migrationIssue('migration_readback_malformed', null));
  } else if (!observation.read_only_verification_passed) {
    issues.push(migrationIssue('migration_readback_failed', null));
  }
  return { ok: evidenceValid && issues.length === 0, issues: dedupeIssues(issues) };
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

function evaluateDatabaseHealth(
  database: OperationsHealthInput['database'],
  candidate: CandidateIdentity,
  generatedAt: string,
): OperationsIssue[] {
  const issues: OperationsIssue[] = [];
  let valid = validateEvidence(database, candidate, generatedAt, 'database', 'database', issues);
  valid =
    validateNonnegativeInteger(
      database.consecutive_failed_minute_probes,
      'database_probe_count_invalid',
      'database',
      issues,
    ) &&
    validateNullableNonnegative(
      database.latency_ms,
      'database_latency_invalid',
      'database',
      issues,
    ) &&
    validatePercentage(database.storage_percent, 'database_storage_invalid', issues) &&
    validatePercentage(
      database.connection_utilization_percent,
      'database_connections_invalid',
      issues,
    ) &&
    validateNullableNonnegative(
      database.high_connection_utilization_age_ms,
      'database_connection_age_invalid',
      'database',
      issues,
    ) &&
    validateNullableNonnegative(
      database.blocking_lock_age_ms,
      'database_lock_age_invalid',
      'database',
      issues,
    ) &&
    typeof database.available === 'boolean' &&
    valid;
  if (!valid) {
    issues.push(evidenceIssue('database_observation_malformed', 'database', 'database'));
    return dedupeIssues(issues);
  }
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
    issues.push(databaseIssue('database_probe_failed', 'warning'));
  }
  if ((database.storage_percent ?? 0) > 85) {
    issues.push(databaseIssue('database_storage_critical', 'sev2'));
  } else if ((database.storage_percent ?? 0) > 70) {
    issues.push(databaseIssue('database_storage_warning', 'warning'));
  }
  if (
    (database.connection_utilization_percent ?? 0) > 85 &&
    (database.high_connection_utilization_age_ms ?? 0) >= 10 * MINUTE
  ) {
    issues.push(databaseIssue('database_connections_critical', 'sev2'));
  }
  if ((database.blocking_lock_age_ms ?? 0) > MINUTE) {
    issues.push(databaseIssue('database_blocking_lock_critical', 'sev2'));
  }
  return issues;
}

function evaluateQueueHealth(
  queues: OperationsHealthInput['queues'],
  candidate: CandidateIdentity,
  generatedAt: string,
): OperationsIssue[] {
  const issues: OperationsIssue[] = [];
  const expected = new Map(
    candidate.operations_inventory.required_queues.map((entry) => [entry.queue, entry]),
  );
  const observed = new Set<string>();
  for (const queue of queues) {
    const queueId = safeId(queue.queue);
    if (!isSafeOperationsIdentifier(queue.queue)) {
      issues.push(evidenceIssue('queue_identifier_invalid', 'queue', 'invalid'));
      continue;
    }
    if (observed.has(queue.queue)) {
      issues.push(evidenceIssue('queue_observation_duplicate', 'queue', queue.queue));
      continue;
    }
    observed.add(queue.queue);
    const expectation = expected.get(queue.queue);
    if (!expectation) {
      issues.push(evidenceIssue('queue_observation_extra', 'queue', queue.queue));
      continue;
    }
    let valid = expectation.queue_class === queue.queue_class;
    valid =
      validateEvidence(queue, candidate, generatedAt, 'queue', queueId, issues) &&
      validateQueueNumbers(queue, issues) &&
      typeof queue.duplicate_effect_risk === 'boolean' &&
      valid;
    if (!valid) {
      issues.push(evidenceIssue('queue_observation_malformed', 'queue', queueId));
      continue;
    }
    const threshold = QUEUE_AGE_THRESHOLDS_MS[queue.queue_class];
    const age = queue.oldest_ready_age_ms ?? 0;
    if (queue.duplicate_effect_risk) {
      issues.push(queueIssue(queue.queue, 'queue_duplicate_effect_risk', 'sev1', null));
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
  for (const queue of expected.keys()) {
    if (!observed.has(queue))
      issues.push(evidenceIssue('queue_observation_missing', 'queue', queue));
  }
  return issues;
}

function evaluateWorkerHealth(
  workers: OperationsHealthInput['workers'],
  candidate: CandidateIdentity,
  generatedAt: string,
): OperationsIssue[] {
  const issues: OperationsIssue[] = [];
  const expected = new Set(
    candidate.operations_inventory.required_workers.map((entry) => entry.worker_type),
  );
  const observed = new Set<string>();
  for (const worker of workers) {
    const workerId = safeId(worker.worker_type);
    if (!isSafeOperationsIdentifier(worker.worker_type)) {
      issues.push(evidenceIssue('worker_identifier_invalid', 'worker', 'invalid'));
      continue;
    }
    if (observed.has(worker.worker_type)) {
      issues.push(evidenceIssue('worker_observation_duplicate', 'worker', worker.worker_type));
      continue;
    }
    observed.add(worker.worker_type);
    if (!expected.has(worker.worker_type)) {
      issues.push(evidenceIssue('worker_observation_extra', 'worker', worker.worker_type));
      continue;
    }
    let valid = validateEvidence(worker, candidate, generatedAt, 'worker', workerId, issues);
    valid =
      validateNonnegative(worker.heartbeat_age_ms, 'worker_heartbeat_invalid', 'worker', issues) &&
      typeof worker.source_agrees_with_candidate === 'boolean' &&
      typeof worker.configuration_agrees_with_candidate === 'boolean' &&
      valid;
    if (!valid) {
      issues.push(evidenceIssue('worker_observation_malformed', 'worker', workerId));
      continue;
    }
    if (!worker.source_agrees_with_candidate || !worker.configuration_agrees_with_candidate) {
      issues.push(workerIssue(worker.worker_type, 'worker_candidate_mismatch', 'sev1'));
    }
    if (worker.heartbeat_age_ms > 5 * MINUTE) {
      issues.push(workerIssue(worker.worker_type, 'worker_heartbeat_critical', 'sev2'));
    } else if (worker.heartbeat_age_ms > 2 * MINUTE) {
      issues.push(workerIssue(worker.worker_type, 'worker_heartbeat_warning', 'warning'));
    }
  }
  for (const worker of expected) {
    if (!observed.has(worker)) {
      issues.push(evidenceIssue('worker_observation_missing', 'worker', worker));
    }
  }
  return issues;
}

function evaluateProviderHealth(
  providers: OperationsHealthInput['providers'],
  candidate: CandidateIdentity,
  generatedAt: string,
): OperationsIssue[] {
  const issues: OperationsIssue[] = [];
  const expected = new Map(
    candidate.operations_inventory.providers.map((entry) => [entry.provider, entry]),
  );
  const observed = new Set<string>();
  for (const provider of providers) {
    const providerId = OPERATIONS_PROVIDER_KEYS.includes(provider.provider)
      ? provider.provider
      : 'invalid';
    if (!OPERATIONS_PROVIDER_KEYS.includes(provider.provider)) {
      issues.push(evidenceIssue('provider_identifier_invalid', 'provider', 'invalid'));
      continue;
    }
    if (observed.has(provider.provider)) {
      issues.push(evidenceIssue('provider_observation_duplicate', 'provider', provider.provider));
      continue;
    }
    observed.add(provider.provider);
    const expectation = expected.get(provider.provider);
    if (!expectation) {
      issues.push(evidenceIssue('provider_observation_extra', 'provider', provider.provider));
      continue;
    }
    let valid = validateEvidence(provider, candidate, generatedAt, 'provider', providerId, issues);
    valid =
      provider.required === expectation.required &&
      ['ready', 'degraded', 'unavailable', 'not_configured'].includes(provider.state) &&
      validateNullableNonnegative(
        provider.unavailable_age_ms,
        'provider_unavailable_age_invalid',
        'provider',
        issues,
      ) &&
      validateNullableNonnegative(
        provider.credential_expires_in_ms,
        'provider_credential_age_invalid',
        'provider',
        issues,
      ) &&
      (provider.safe_account_ref === null ||
        isSafeOperationsIdentifier(provider.safe_account_ref)) &&
      valid;
    if (!valid) {
      issues.push(evidenceIssue('provider_observation_malformed', 'provider', providerId));
      continue;
    }
    if (
      provider.required &&
      provider.state === 'unavailable' &&
      provider.unavailable_age_ms === null
    ) {
      issues.push(providerIssue(provider.provider, 'provider_unavailable_age_missing', 'sev1'));
    } else if (provider.required && provider.state === 'not_configured') {
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
  for (const provider of expected.keys()) {
    if (!observed.has(provider)) {
      issues.push(evidenceIssue('provider_observation_missing', 'provider', provider));
    }
  }
  return issues;
}

function validateEvidence(
  evidence: { observed_at: string; evidence_qualified: boolean },
  candidate: CandidateIdentity,
  generatedAt: string,
  category: OperationsIssue['category'],
  identifier: string,
  issues: OperationsIssue[],
): boolean {
  const observed = Date.parse(evidence.observed_at);
  const generated = Date.parse(generatedAt);
  if (!Number.isFinite(observed) || !Number.isFinite(generated)) {
    issues.push(evidenceIssue(`${category}_observation_timestamp_invalid`, category, identifier));
    return false;
  }
  const age = generated - observed;
  if (age < 0 || age > candidate.operations_inventory.maximum_observation_age_ms) {
    issues.push(evidenceIssue(`${category}_observation_stale`, category, identifier));
    return false;
  }
  if (evidence.evidence_qualified !== true) {
    issues.push(evidenceIssue(`${category}_evidence_unqualified`, category, identifier));
    return false;
  }
  return true;
}

function validateMigrationEntries(
  entries: readonly MigrationLedgerEntry[],
  kind: 'expected' | 'applied',
  issues: OperationsIssue[],
): boolean {
  if (!Array.isArray(entries)) {
    issues.push(migrationIssue(`migration_${kind}_inventory_malformed`, null));
    return false;
  }
  let valid = true;
  const ordinals = new Set<number>();
  const names = new Set<string>();
  for (const entry of entries) {
    if (
      !Number.isSafeInteger(entry.ordinal) ||
      entry.ordinal < 1 ||
      !MIGRATION_NAME.test(entry.name) ||
      !SHA256.test(entry.sha256)
    ) {
      issues.push(migrationIssue(`migration_${kind}_entry_invalid`, safeOrdinal(entry.ordinal)));
      valid = false;
      continue;
    }
    if (ordinals.has(entry.ordinal) || names.has(entry.name)) {
      issues.push(migrationIssue(`migration_${kind}_entry_duplicate`, entry.ordinal));
      valid = false;
    }
    ordinals.add(entry.ordinal);
    names.add(entry.name);
  }
  return valid;
}

function validateQueueNumbers(
  queue: OperationsHealthInput['queues'][number],
  issues: OperationsIssue[],
): boolean {
  return [
    validateNonnegativeInteger(queue.depth, 'queue_depth_invalid', 'queue', issues),
    validateNullableNonnegative(
      queue.oldest_ready_age_ms,
      'queue_ready_age_invalid',
      'queue',
      issues,
    ),
    validateNullableNonnegative(
      queue.oldest_lease_age_ms,
      'queue_lease_age_invalid',
      'queue',
      issues,
    ),
    validateNonnegativeInteger(queue.retry_count, 'queue_retry_count_invalid', 'queue', issues),
    validateNonnegativeInteger(
      queue.acceptance_unknown_count,
      'queue_acceptance_unknown_invalid',
      'queue',
      issues,
    ),
    validateNonnegativeInteger(
      queue.dead_letter_count,
      'queue_dead_letter_invalid',
      'queue',
      issues,
    ),
    validateNonnegativeInteger(
      queue.expired_lease_count,
      'queue_expired_lease_invalid',
      'queue',
      issues,
    ),
    validateNonnegative(queue.throughput_15m, 'queue_throughput_invalid', 'queue', issues),
  ].every(Boolean);
}

function validatePercentage(
  value: number | null,
  code: string,
  issues: OperationsIssue[],
): boolean {
  if (value === null) return true;
  const valid = Number.isFinite(value) && value >= 0 && value <= 100;
  if (!valid) issues.push(evidenceIssue(code, 'database', 'database'));
  return valid;
}

function validateNullableNonnegative(
  value: number | null,
  code: string,
  category: OperationsIssue['category'],
  issues: OperationsIssue[],
): boolean {
  return value === null || validateNonnegative(value, code, category, issues);
}

function validateNonnegativeInteger(
  value: number,
  code: string,
  category: OperationsIssue['category'],
  issues: OperationsIssue[],
): boolean {
  const valid = Number.isSafeInteger(value) && value >= 0;
  if (!valid) issues.push(evidenceIssue(code, category, category));
  return valid;
}

function validateNonnegative(
  value: number,
  code: string,
  category: OperationsIssue['category'],
  issues: OperationsIssue[],
): boolean {
  const valid = Number.isFinite(value) && value >= 0;
  if (!valid) issues.push(evidenceIssue(code, category, category));
  return valid;
}

function assertGeneratedAt(value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error('Invalid operations generation time.');
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
    summary: 'Migration evidence does not match the exact forward-only candidate inventory.',
    safe_context: { ordinal },
  };
}

function evidenceIssue(
  code: string,
  category: OperationsIssue['category'],
  identifier: string,
): OperationsIssue {
  return {
    code,
    category,
    severity: 'sev1',
    summary:
      'Required operational evidence is missing, duplicate, malformed, stale, or unqualified.',
    safe_context: { evidence_id: safeId(identifier) },
  };
}

function databaseIssue(code: string, severity: 'warning' | 'sev2'): OperationsIssue {
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
  severity: 'warning' | 'sev2' | 'sev1',
  observed: number | null,
): OperationsIssue {
  return {
    code,
    category: 'queue',
    severity,
    summary: 'A queue health invariant or threshold was crossed.',
    safe_context: { queue, observed },
  };
}

function workerIssue(
  workerType: string,
  code: string,
  severity: 'warning' | 'sev2' | 'sev1',
): OperationsIssue {
  return {
    code,
    category: 'worker',
    severity,
    summary: 'A worker health invariant or threshold was crossed.',
    safe_context: { worker_type: workerType },
  };
}

function providerIssue(
  provider: string,
  code: string,
  severity: 'warning' | 'sev2' | 'sev1',
): OperationsIssue {
  return {
    code,
    category: 'provider',
    severity,
    summary: 'A provider health invariant or threshold was crossed.',
    safe_context: { provider },
  };
}

function safeOrdinal(value: unknown): number | null {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

function safeId(value: unknown): string {
  return typeof value === 'string' && isSafeOperationsIdentifier(value) ? value : 'invalid';
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
