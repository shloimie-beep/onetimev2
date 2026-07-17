import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export type ObjectiveStatus = 'done' | 'already_satisfied' | 'blocked' | 'needs_operator_decision';

export type MigrationInventoryItem = {
  id: string;
  file_name: string;
  repo_path: string;
  sha256: string;
  ordinal: number;
  numeric_prefix: number;
  is_w12_transition_target: boolean;
};

export type W12TransitionPlan = {
  baseline_migration_id: string;
  target_migration_ids: string[];
  target_migration_paths: string[];
  target_order_verified: boolean;
  target_files_are_contiguous_after_baseline: boolean;
  checksum_inputs: Array<Pick<MigrationInventoryItem, 'id' | 'repo_path' | 'sha256'>>;
  foreign_key_ordering_expectation: string;
  index_creation_expectation: string;
  stop_conditions: StopCondition[];
};

export type StopCondition = {
  id: string;
  condition: string;
  required_action: string;
};

export type SanitizedTarget = {
  label: string;
  expected_major: 16 | 18;
  connection_fingerprint: string;
};

export type ParsedTarget = SanitizedTarget & {
  admin_database_url: string;
  database_ssl: boolean;
};

export type ObjectiveResult = {
  id: string;
  status: ObjectiveStatus;
  evidence: string[];
  notes: string;
};

export type ScenarioResult = {
  id: string;
  status: ObjectiveStatus;
  timings_ms: Record<string, number>;
  table_counts: Record<string, number>;
  schema_hash: string | null;
  lock_observations: string[];
  notes: string[];
};

export type PgTargetResult = {
  label: string;
  expected_major: 16 | 18;
  observed_major: number | null;
  status: ObjectiveStatus;
  scenarios: ScenarioResult[];
  blockers: string[];
};

export type RehearsalReport = {
  schema_version: 'onetime.w12_100_05.migration_rehearsal.v1';
  lane_id: 'W12-100-05';
  generated_at: string;
  repository: 'webcraft-media/onetimev2';
  branch: string;
  canonical_starting_commit: string;
  safety: {
    production_database_connected: false;
    production_mutations: 0;
    external_actions: 0;
    provider_mutations: 0;
    private_rows_read: false;
    evidence_mode: 'hashes_counts_statuses_timings_only';
  };
  environment: {
    node_version: string;
    docker_available: boolean;
    native_postgres_tools_available: boolean;
    configured_targets: SanitizedTarget[];
    environment_blockers: string[];
  };
  transition_plan: W12TransitionPlan;
  migration_inventory_summary: {
    migration_count: number;
    latest_migration_id: string;
    latest_migration_path: string;
    inventory_hash: string;
  };
  target_results: PgTargetResult[];
  objectives: ObjectiveResult[];
};

export const LANE_ID = 'W12-100-05' as const;
export const BRANCH_NAME = 'codex/w12-100-05-postgres-migration-rehearsal';
export const CANONICAL_STARTING_COMMIT = '0d8d7168f066668f035176d777bdaaa4dcc5accd';
export const BASELINE_MIGRATION_ID = '2190_ot109_rabbi_content_publisher';
export const TARGET_MIGRATION_IDS = [
  '2200_w12_02_communication_history',
  '2201_w12_01_crm_audience_import',
  '2202_w12_05_telegram_operations',
] as const;

export const STOP_CONDITIONS: StopCondition[] = [
  {
    id: 'lock_timeout_or_blocking_risk',
    condition:
      'Any rehearsal observes advisory lock acquisition exceeding the configured lock timeout, a pending blocker beyond the timeout, or a relation lock that would block normal web/worker reads.',
    required_action:
      'Stop the staging migration, keep the database online, capture sanitized lock counts/timings, and prepare a forward corrective migration or schedule an operator-approved maintenance window.',
  },
  {
    id: 'data_incompatibility',
    condition:
      'Any existing synthetic row valid at migration 2190 becomes invalid after 2200-2202, or any required W12 capability cannot be inserted after 2202.',
    required_action:
      'Stop before staging apply and produce a forward corrective migration with a synthetic fixture proving compatibility.',
  },
  {
    id: 'checksum_mismatch',
    condition:
      'Any onetime.schema_migrations checksum differs from the repository-normalized SHA-256 for the same migration id.',
    required_action:
      'Stop immediately; do not modify checked migrations in place. Investigate ledger provenance and use only an explicit forward correction if needed.',
  },
  {
    id: 'non_idempotent_result',
    condition:
      'A repeat migration verification applies a new migration unexpectedly, changes a schema hash, changes table counts outside the rehearsal fixture, or reports a different ledger.',
    required_action:
      'Stop release rehearsal and fix the migration runner or forward migration until repeat verification is stable.',
  },
  {
    id: 'startup_or_rolling_incompatibility',
    condition:
      'The web app, sink worker, or rolling pre/post migration process fails against the disposable migrated schema while provider flags remain off.',
    required_action:
      'Stop staging apply and repair application compatibility before any deploy lane consumes the migration.',
  },
];

const DEFAULT_MIGRATIONS_DIR = path.join('packages', 'db', 'migrations');

export async function discoverMigrationInventory(
  repoRoot: string,
  migrationsDir = path.join(repoRoot, DEFAULT_MIGRATIONS_DIR),
): Promise<MigrationInventoryItem[]> {
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
  const inventory: MigrationInventoryItem[] = [];
  for (const [index, fileName] of files.entries()) {
    const id = fileName.replace(/\.sql$/, '');
    const numericPrefix = Number(id.split('_')[0]);
    if (!Number.isInteger(numericPrefix)) {
      throw new Error(`Migration ${fileName} does not start with a numeric prefix.`);
    }
    const absolutePath = path.join(migrationsDir, fileName);
    const rawSql = await readFile(absolutePath, 'utf8');
    inventory.push({
      id,
      file_name: fileName,
      repo_path: toPosix(path.relative(repoRoot, absolutePath)),
      sha256: sha256(normalizeMigrationLineEndings(rawSql)),
      ordinal: index,
      numeric_prefix: numericPrefix,
      is_w12_transition_target: (TARGET_MIGRATION_IDS as readonly string[]).includes(id),
    });
  }
  return inventory;
}

export function buildTransitionPlan(inventory: MigrationInventoryItem[]): W12TransitionPlan {
  const byId = new Map(inventory.map((item) => [item.id, item]));
  const baseline = byId.get(BASELINE_MIGRATION_ID);
  if (!baseline) throw new Error(`Required baseline migration missing: ${BASELINE_MIGRATION_ID}`);

  const targetItems = TARGET_MIGRATION_IDS.map((id) => {
    const item = byId.get(id);
    if (!item) throw new Error(`Required W12 transition migration missing: ${id}`);
    return item;
  });
  const targetOrderVerified = targetItems.every(
    (item, index) => item.id === TARGET_MIGRATION_IDS[index],
  );
  const targetFilesAreContiguousAfterBaseline = targetItems.every(
    (item, index) => item.ordinal === baseline.ordinal + index + 1,
  );

  return {
    baseline_migration_id: BASELINE_MIGRATION_ID,
    target_migration_ids: [...TARGET_MIGRATION_IDS],
    target_migration_paths: targetItems.map((item) => item.repo_path),
    target_order_verified: targetOrderVerified,
    target_files_are_contiguous_after_baseline: targetFilesAreContiguousAfterBaseline,
    checksum_inputs: targetItems.map((item) => ({
      id: item.id,
      repo_path: item.repo_path,
      sha256: item.sha256,
    })),
    foreign_key_ordering_expectation:
      'Apply 2200 before 2201 before 2202. Communication history depends on contacts/outbox/WhatsApp tables that exist before 2190; audience import extensions depend on 1201 audience tables; Telegram constraint replacement depends on 1600/2001/2011 Telegram tables.',
    index_creation_expectation:
      'Index creation is ordinary transactional CREATE INDEX / CREATE INDEX IF NOT EXISTS inside the migration transaction; no CONCURRENTLY operations are expected in 2200-2202.',
    stop_conditions: STOP_CONDITIONS,
  };
}

export function inventoryHash(inventory: MigrationInventoryItem[]) {
  return sha256(
    JSON.stringify(
      inventory.map((item) => ({
        id: item.id,
        repo_path: item.repo_path,
        sha256: item.sha256,
      })),
    ),
  );
}

export function parseTargetsFromEnv(env: NodeJS.ProcessEnv): ParsedTarget[] {
  const targets: ParsedTarget[] = [];
  const json = env.W12_POSTGRES_TARGETS_JSON?.trim();
  if (json) {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) throw new Error('W12_POSTGRES_TARGETS_JSON must be an array.');
    for (const entry of parsed) {
      targets.push(parseTargetObject(entry));
    }
  }

  if (env.W12_PG16_ADMIN_DATABASE_URL) {
    targets.push(
      parseTargetObject({
        label: 'postgres16',
        expected_major: 16,
        admin_database_url: env.W12_PG16_ADMIN_DATABASE_URL,
        database_ssl: env.W12_PG16_DATABASE_SSL,
      }),
    );
  }
  if (env.W12_PG18_ADMIN_DATABASE_URL) {
    targets.push(
      parseTargetObject({
        label: 'postgres18',
        expected_major: 18,
        admin_database_url: env.W12_PG18_ADMIN_DATABASE_URL,
        database_ssl: env.W12_PG18_DATABASE_SSL,
      }),
    );
  }

  const seen = new Set<string>();
  return targets.filter((target) => {
    const key = `${target.label}:${target.expected_major}:${target.connection_fingerprint}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function sanitizeTargets(targets: ParsedTarget[]): SanitizedTarget[] {
  return targets.map(({ label, expected_major, connection_fingerprint }) => ({
    label,
    expected_major,
    connection_fingerprint,
  }));
}

export function buildReport(input: {
  generatedAt: string;
  nodeVersion: string;
  dockerAvailable: boolean;
  nativePostgresToolsAvailable: boolean;
  targets: ParsedTarget[];
  environmentBlockers: string[];
  inventory: MigrationInventoryItem[];
  transitionPlan: W12TransitionPlan;
  targetResults: PgTargetResult[];
}): RehearsalReport {
  const latest = input.inventory[input.inventory.length - 1];
  if (!latest) throw new Error('Migration inventory is empty.');
  const objectives = classifyObjectives({
    targets: input.targets,
    environmentBlockers: input.environmentBlockers,
    transitionPlan: input.transitionPlan,
    targetResults: input.targetResults,
  });
  return {
    schema_version: 'onetime.w12_100_05.migration_rehearsal.v1',
    lane_id: LANE_ID,
    generated_at: input.generatedAt,
    repository: 'webcraft-media/onetimev2',
    branch: BRANCH_NAME,
    canonical_starting_commit: CANONICAL_STARTING_COMMIT,
    safety: {
      production_database_connected: false,
      production_mutations: 0,
      external_actions: 0,
      provider_mutations: 0,
      private_rows_read: false,
      evidence_mode: 'hashes_counts_statuses_timings_only',
    },
    environment: {
      node_version: input.nodeVersion,
      docker_available: input.dockerAvailable,
      native_postgres_tools_available: input.nativePostgresToolsAvailable,
      configured_targets: sanitizeTargets(input.targets),
      environment_blockers: input.environmentBlockers,
    },
    transition_plan: input.transitionPlan,
    migration_inventory_summary: {
      migration_count: input.inventory.length,
      latest_migration_id: latest.id,
      latest_migration_path: latest.repo_path,
      inventory_hash: inventoryHash(input.inventory),
    },
    target_results: input.targetResults,
    objectives,
  };
}

export function classifyObjectives(input: {
  targets: ParsedTarget[];
  environmentBlockers: string[];
  transitionPlan: W12TransitionPlan;
  targetResults: PgTargetResult[];
}): ObjectiveResult[] {
  const hasPg16 = input.targetResults.some(
    (target) => target.expected_major === 16 && target.status === 'done',
  );
  const hasPg18 = input.targetResults.some(
    (target) => target.expected_major === 18 && target.status === 'done',
  );
  const targetEvidence = (major: 16 | 18) =>
    input.targetResults
      .filter((target) => target.expected_major === major)
      .flatMap((target) => target.scenarios.map((scenario) => `${target.label}:${scenario.id}`));
  const noTargets = input.targets.length === 0;

  const transitionStaticDone =
    input.transitionPlan.target_order_verified &&
    input.transitionPlan.target_files_are_contiguous_after_baseline;

  return [
    {
      id: 'transition_static_plan',
      status: transitionStaticDone ? 'done' : 'blocked',
      evidence: ['migration inventory', 'target path/order checksum inputs'],
      notes: transitionStaticDone
        ? 'The required 2200, 2201, and 2202 files are present and contiguous after 2190.'
        : 'The required W12 migration transition is not in the exact expected order.',
    },
    {
      id: 'postgres16_disposable_rehearsal',
      status: hasPg16 ? 'done' : 'blocked',
      evidence: targetEvidence(16),
      notes: hasPg16
        ? 'Disposable PostgreSQL 16 rehearsal completed.'
        : noTargets
          ? 'No disposable PostgreSQL 16 target was configured in this environment.'
          : 'A configured PostgreSQL 16 target did not complete all stop-condition scenarios.',
    },
    {
      id: 'postgres18_disposable_rehearsal',
      status: hasPg18 ? 'done' : 'blocked',
      evidence: targetEvidence(18),
      notes: hasPg18
        ? 'Disposable PostgreSQL 18 rehearsal completed.'
        : noTargets
          ? 'No disposable PostgreSQL 18 target was configured in this environment.'
          : 'A configured PostgreSQL 18 target did not complete all stop-condition scenarios.',
    },
    scenarioObjective(input.targetResults, 'clean_database_migration'),
    scenarioObjective(input.targetResults, 'upgrade_from_2190'),
    scenarioObjective(input.targetResults, 'checksum_verification'),
    scenarioObjective(input.targetResults, 'repeat_idempotence'),
    scenarioObjective(input.targetResults, 'transactional_failure'),
    scenarioObjective(input.targetResults, 'constraint_compatibility'),
    scenarioObjective(input.targetResults, 'telegram_existing_row_compatibility'),
    scenarioObjective(input.targetResults, 'foreign_key_ordering'),
    scenarioObjective(input.targetResults, 'index_creation_behavior'),
    scenarioObjective(input.targetResults, 'lock_acquisition_blocking'),
    scenarioObjective(input.targetResults, 'app_startup_before_after'),
    scenarioObjective(input.targetResults, 'rolling_web_worker_compatibility'),
    scenarioObjective(input.targetResults, 'backup_restore_clone'),
    {
      id: 'forward_corrective_migration_procedure',
      status: 'done',
      evidence: ['FORWARD-ROLLBACK-PLAN.md', 'STAGING-MIGRATION-RUNBOOK.md'],
      notes:
        'Forward-only corrective procedure and exact stop conditions are defined; no down migration or destructive rollback is proposed.',
    },
  ];
}

export function renderCompatibilityMatrix(report: RehearsalReport) {
  const rows = [
    '| Capability | PG16 | PG18 | Evidence | Stop condition |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const objective of report.objectives) {
    const pg16 = statusForObjective(report, objective.id, 16);
    const pg18 = statusForObjective(report, objective.id, 18);
    rows.push(
      `| ${escapeCell(objective.id)} | ${pg16} | ${pg18} | ${escapeCell(
        objective.evidence.join(', ') || objective.notes,
      )} | ${escapeCell(stopConditionSummary(objective.id))} |`,
    );
  }
  return [
    '# W12-100-05 Compatibility Matrix',
    '',
    `Generated: ${report.generated_at}`,
    '',
    'Evidence is limited to hashes, counts, statuses, timings, and synthetic fixture behavior. Production mutations and external actions are zero.',
    '',
    rows.join('\n'),
    '',
  ].join('\n');
}

export function renderStagingRunbook(report: RehearsalReport) {
  return [
    '# W12-100-05 Staging Migration Runbook',
    '',
    `Generated: ${report.generated_at}`,
    '',
    '## Preconditions',
    '',
    '- Use only an isolated non-production staging database and deployment target.',
    '- Confirm `/version` for the staging app before any migration.',
    '- Confirm the migration inventory hash matches this report.',
    `- Migration inventory hash: \`${report.migration_inventory_summary.inventory_hash}\``,
    '- Confirm provider flags remain disabled and worker transport remains `sink`.',
    '- Confirm production mutations and external actions are zero.',
    '',
    '## Migration Order',
    '',
    ...report.transition_plan.target_migration_ids.map((id, index) => `${index + 1}. \`${id}\``),
    '',
    '## Stop Conditions',
    '',
    ...report.transition_plan.stop_conditions.map(
      (condition) =>
        `- \`${condition.id}\`: ${condition.condition} Action: ${condition.required_action}`,
    ),
    '',
    '## Staging Procedure',
    '',
    '1. Snapshot or clone the isolated staging database.',
    '2. Run `npm run db:verify` against the staging clone and compare ledger checksums to the report inventory hash.',
    '3. Run `npm run db:migrate` exactly once against the isolated staging database.',
    '4. Run `npm run db:verify` again and confirm every migration reports `already_applied`.',
    '5. Start the web process with migrations disabled and smoke `/health`, `/ready`, and `/version`.',
    '6. Run the sink worker once with provider flags disabled and record counts only.',
    '7. During rolling deployment, keep old web/worker instances provider-off until both old and new process compatibility checks pass.',
    '8. If any stop condition appears, stop the rollout and use the forward-only corrective plan.',
    '',
  ].join('\n');
}

export function renderForwardRollbackPlan(report: RehearsalReport) {
  return [
    '# W12-100-05 Forward Rollback Plan',
    '',
    `Generated: ${report.generated_at}`,
    '',
    'This repository uses forward-only checksummed migrations. Existing checked migrations must not be edited after application. Rollback for this lane means halting rollout, restoring a disposable/staging clone when needed, or shipping a new forward corrective migration.',
    '',
    '## Immediate Stop',
    '',
    '- Stop before production. This lane does not deploy staging or production.',
    '- Keep provider sends, webhooks, payments, and posts disabled.',
    '- Preserve the failed database state for counts/schema-hash evidence only.',
    '',
    '## Forward Correction',
    '',
    '1. Create a new migration with the next unused numeric prefix.',
    '2. Keep the correction additive or constraint-replacement-only; do not mutate historical migration files.',
    '3. Add a synthetic fixture that reproduces the stop condition without private data.',
    '4. Re-run clean, upgrade-from-2190, checksum, repeat-idempotence, transaction-failure, lock, startup, rolling, and backup/restore rehearsals.',
    '5. Update this lane report with hashes, counts, statuses, and timings only.',
    '',
    '## Stop Condition Actions',
    '',
    ...report.transition_plan.stop_conditions.map(
      (condition) => `- \`${condition.id}\`: ${condition.required_action}`,
    ),
    '',
  ].join('\n');
}

export function renderFinalReport(report: RehearsalReport) {
  const done = report.objectives.filter((objective) => objective.status === 'done').length;
  const blocked = report.objectives.filter((objective) => objective.status === 'blocked').length;
  return [
    '# W12-100-05 Final Report',
    '',
    `Generated: ${report.generated_at}`,
    '',
    '## Outcome',
    '',
    `Objectives done: ${done}. Objectives blocked: ${blocked}.`,
    '',
    `Configured disposable targets: ${report.environment.configured_targets.length}.`,
    `External actions: ${report.safety.external_actions}.`,
    `Production mutations: ${report.safety.production_mutations}.`,
    '',
    '## Safety',
    '',
    '- No production database connection was made by this lane.',
    '- No provider sends, webhooks, payments, posts, uploads, publishes, or resource mutations were performed.',
    '- Evidence is limited to hashes, counts, statuses, timings, schema hashes, and synthetic fixture observations.',
    '',
    '## Transition',
    '',
    `- Baseline: \`${report.transition_plan.baseline_migration_id}\``,
    ...report.transition_plan.target_migration_ids.map((id) => `- Target: \`${id}\``),
    `- Inventory hash: \`${report.migration_inventory_summary.inventory_hash}\``,
    '',
    '## Environment Blockers',
    '',
    ...(report.environment.environment_blockers.length
      ? report.environment.environment_blockers.map((blocker) => `- ${blocker}`)
      : ['- None recorded.']),
    '',
    '## Objective Status',
    '',
    ...report.objectives.map(
      (objective) => `- \`${objective.id}\`: ${objective.status} - ${objective.notes}`,
    ),
    '',
  ].join('\n');
}

export function renderResume(report: RehearsalReport) {
  return [
    '# W12-100-05 Resume',
    '',
    `Generated: ${report.generated_at}`,
    '',
    '## Resume Point',
    '',
    'Continue from the committed lane branch and do not reuse another worktree. Re-run the rehearsal with disposable PostgreSQL targets if PG16/PG18 were blocked in the previous environment.',
    '',
    '## Command',
    '',
    '```bash',
    'W12_PG16_ADMIN_DATABASE_URL=... W12_PG18_ADMIN_DATABASE_URL=... npx tsx scripts/w12-100/postgres/migration-rehearsal.ts',
    '```',
    '',
    '## Current Objective Statuses',
    '',
    ...report.objectives.map((objective) => `- \`${objective.id}\`: ${objective.status}`),
    '',
  ].join('\n');
}

export function renderState(report: RehearsalReport) {
  return `${JSON.stringify(
    {
      schema_version: 'onetime.codex_run.state.v1',
      run_id: LANE_ID,
      title: 'PostgreSQL migration rehearsal',
      status: report.objectives.some((objective) => objective.status === 'blocked')
        ? 'blocked_environment_or_rehearsal'
        : 'done',
      generated_at: report.generated_at,
      repository: report.repository,
      branch: report.branch,
      canonical_starting_commit: report.canonical_starting_commit,
      safety: report.safety,
      objectives: report.objectives,
    },
    null,
    2,
  )}\n`;
}

export function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function normalizeMigrationLineEndings(sql: string) {
  return sql.replace(/\r\n/g, '\n');
}

function scenarioObjective(targetResults: PgTargetResult[], id: string): ObjectiveResult {
  const scenarios = targetResults.flatMap((target) =>
    target.scenarios
      .filter(
        (scenario) =>
          scenario.id === id ||
          scenario.notes.some((note) => note === `${id}=covered` || note === `${id}=passed`),
      )
      .map((scenario) => ({ target, scenario })),
  );
  const complete =
    scenarios.length > 0 && scenarios.every(({ scenario }) => scenario.status === 'done');
  return {
    id,
    status: complete ? 'done' : 'blocked',
    evidence: scenarios.map(({ target, scenario }) => `${target.label}:${scenario.id}`),
    notes: complete
      ? 'Completed across configured disposable PostgreSQL targets.'
      : scenarios.length === 0
        ? 'No disposable PostgreSQL target evidence was available in this environment.'
        : 'One or more configured target rehearsals did not complete this scenario.',
  };
}

function statusForObjective(report: RehearsalReport, objectiveId: string, major: 16 | 18) {
  const target = report.target_results.find((result) => result.expected_major === major);
  if (!target) return 'blocked: no target';
  const scenario = target.scenarios.find((entry) => entry.id === objectiveId);
  if (!scenario) {
    const objective = report.objectives.find((entry) => entry.id === objectiveId);
    return objective?.status ?? 'blocked';
  }
  return scenario.status;
}

function stopConditionSummary(objectiveId: string) {
  if (objectiveId.includes('lock')) return 'lock_timeout_or_blocking_risk';
  if (objectiveId.includes('checksum')) return 'checksum_mismatch';
  if (objectiveId.includes('idempotence')) return 'non_idempotent_result';
  if (objectiveId.includes('compatibility') || objectiveId.includes('startup')) {
    return 'data_incompatibility/startup_or_rolling_incompatibility';
  }
  return 'see report stop_conditions';
}

function parseTargetObject(value: unknown): ParsedTarget {
  if (!value || typeof value !== 'object') throw new Error('PostgreSQL target must be an object.');
  const record = value as Record<string, unknown>;
  const label = stringValue(record.label, 'label');
  const expectedMajor = Number(record.expected_major);
  if (expectedMajor !== 16 && expectedMajor !== 18) {
    throw new Error(`Target ${label} expected_major must be 16 or 18.`);
  }
  const adminDatabaseUrl = stringValue(record.admin_database_url, 'admin_database_url');
  assertNotProductionUrl(adminDatabaseUrl, label);
  const databaseSsl = record.database_ssl === true || record.database_ssl === 'true';
  return {
    label,
    expected_major: expectedMajor,
    admin_database_url: adminDatabaseUrl,
    database_ssl: databaseSsl,
    connection_fingerprint: sha256(adminDatabaseUrl).slice(0, 24),
  };
}

function stringValue(value: unknown, name: string) {
  if (typeof value !== 'string' || value.trim() === '')
    throw new Error(`${name} must be a string.`);
  return value.trim();
}

function assertNotProductionUrl(connectionString: string, label: string) {
  const lowered = connectionString.toLowerCase();
  const forbidden = ['prod', 'production', 'railway.internal', 'join.onetimeonetime.com'];
  if (forbidden.some((token) => lowered.includes(token))) {
    throw new Error(
      `Target ${label} appears production-like. Refusing to use this database connection.`,
    );
  }
}

function escapeCell(value: string) {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function toPosix(value: string) {
  return value.split(path.sep).join('/');
}
