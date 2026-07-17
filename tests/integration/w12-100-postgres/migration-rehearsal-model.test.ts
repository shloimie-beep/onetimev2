import { describe, expect, it } from 'vitest';
import {
  TARGET_MIGRATION_IDS,
  buildReport,
  buildTransitionPlan,
  classifyObjectives,
  discoverMigrationInventory,
  parseTargetsFromEnv,
  renderCompatibilityMatrix,
  renderForwardRollbackPlan,
  renderStagingRunbook,
  type PgTargetResult,
} from '../../../scripts/w12-100/postgres/rehearsal-model.ts';

describe('W12-100 PostgreSQL migration rehearsal model', () => {
  it('discovers the exact W12 migration transition after 2190 with checksums', async () => {
    const inventory = await discoverMigrationInventory(process.cwd());
    const plan = buildTransitionPlan(inventory);

    expect(plan.baseline_migration_id).toBe('2190_ot109_rabbi_content_publisher');
    expect(plan.target_migration_ids).toEqual([...TARGET_MIGRATION_IDS]);
    expect(plan.target_migration_paths).toEqual([
      'packages/db/migrations/2200_w12_02_communication_history.sql',
      'packages/db/migrations/2201_w12_01_crm_audience_import.sql',
      'packages/db/migrations/2202_w12_05_telegram_operations.sql',
    ]);
    expect(plan.target_order_verified).toBe(true);
    expect(plan.target_files_are_contiguous_after_baseline).toBe(true);
    expect(plan.checksum_inputs).toHaveLength(3);
    expect(plan.checksum_inputs.every((entry) => /^[a-f0-9]{64}$/.test(entry.sha256))).toBe(true);
    expect(plan.stop_conditions.map((condition) => condition.id)).toEqual([
      'lock_timeout_or_blocking_risk',
      'data_incompatibility',
      'checksum_mismatch',
      'non_idempotent_result',
      'startup_or_rolling_incompatibility',
    ]);
  });

  it('redacts configured targets and refuses production-like database URLs', () => {
    const targets = parseTargetsFromEnv({
      W12_POSTGRES_TARGETS_JSON: JSON.stringify([
        {
          label: 'pg16-local',
          expected_major: 16,
          admin_database_url: 'postgres://postgres@127.0.0.1:5416/postgres',
        },
      ]),
      W12_PG18_ADMIN_DATABASE_URL: 'postgres://postgres@127.0.0.1:5418/postgres',
    });

    expect(targets).toHaveLength(2);
    expect(targets[0]).toMatchObject({ label: 'pg16-local', expected_major: 16 });
    expect(targets[0]?.connection_fingerprint).toMatch(/^[a-f0-9]{24}$/);
    expect(
      JSON.stringify(
        targets.map(({ label, expected_major, connection_fingerprint }) => ({
          label,
          expected_major,
          connection_fingerprint,
        })),
      ),
    ).not.toContain('127.0.0.1');

    expect(() =>
      parseTargetsFromEnv({
        W12_PG16_ADMIN_DATABASE_URL: 'postgres://user@production.example.com/postgres',
      }),
    ).toThrow(/production-like/i);
  });

  it('builds a blocked local report without claiming PG16 or PG18 rehearsal', async () => {
    const inventory = await discoverMigrationInventory(process.cwd());
    const transitionPlan = buildTransitionPlan(inventory);
    const report = buildReport({
      generatedAt: '2026-07-17T00:00:00.000Z',
      nodeVersion: 'v24.test',
      dockerAvailable: false,
      nativePostgresToolsAvailable: false,
      targets: [],
      environmentBlockers: ['no targets'],
      inventory,
      transitionPlan,
      targetResults: [],
    });

    expect(report.safety).toMatchObject({
      production_database_connected: false,
      production_mutations: 0,
      external_actions: 0,
      private_rows_read: false,
    });
    expect(
      report.objectives.find((objective) => objective.id === 'transition_static_plan'),
    ).toMatchObject({
      status: 'done',
    });
    expect(
      report.objectives.find((objective) => objective.id === 'postgres16_disposable_rehearsal'),
    ).toMatchObject({ status: 'blocked' });
    expect(
      report.objectives.find((objective) => objective.id === 'postgres18_disposable_rehearsal'),
    ).toMatchObject({ status: 'blocked' });

    expect(renderCompatibilityMatrix(report)).toContain('blocked: no target');
    expect(renderStagingRunbook(report)).toContain('Migration inventory hash');
    expect(renderForwardRollbackPlan(report)).toContain('forward corrective migration');
  });

  it('maps clean and upgrade scenario evidence onto the required sub-objectives', () => {
    const targetResults: PgTargetResult[] = [
      {
        label: 'pg16-local',
        expected_major: 16,
        observed_major: 16,
        status: 'done',
        blockers: [],
        scenarios: [
          {
            id: 'clean_database_migration',
            status: 'done',
            timings_ms: { first_apply_ms: 1, repeat_verify_ms: 1 },
            table_counts: { schema_migrations: 28 },
            schema_hash: 'a'.repeat(64),
            lock_observations: [],
            notes: [
              'checksum_verification=covered',
              'repeat_idempotence=covered',
              'foreign_key_ordering=covered',
              'index_creation_behavior=covered',
            ],
          },
          {
            id: 'upgrade_from_2190',
            status: 'done',
            timings_ms: { apply_to_2190_ms: 1, apply_2200_2202_ms: 1 },
            table_counts: { schema_migrations: 28 },
            schema_hash: 'b'.repeat(64),
            lock_observations: [],
            notes: [
              'constraint_compatibility=covered',
              'telegram_existing_row_compatibility=covered',
            ],
          },
          {
            id: 'transactional_failure',
            status: 'done',
            timings_ms: { forced_failure_ms: 1 },
            table_counts: {},
            schema_hash: 'b'.repeat(64),
            lock_observations: [],
            notes: ['forced_failure_rolled_back=true'],
          },
          {
            id: 'lock_acquisition_blocking',
            status: 'done',
            timings_ms: { lock_wait_ms: 150 },
            table_counts: {},
            schema_hash: null,
            lock_observations: ['observed=blocked:55P03'],
            notes: ['estimated_blocking=bounded_by_lock_timeout'],
          },
          {
            id: 'app_startup_before_after',
            status: 'done',
            timings_ms: { web_before_ready_ms: 1, web_after_ready_ms: 1, worker_once_ms: 1 },
            table_counts: {},
            schema_hash: null,
            lock_observations: [],
            notes: ['rolling_web_worker_compatibility=covered'],
          },
          {
            id: 'backup_restore_clone',
            status: 'done',
            timings_ms: { pg_dump_ms: 1, pg_restore_ms: 1 },
            table_counts: {},
            schema_hash: 'c'.repeat(64),
            lock_observations: [],
            notes: ['restore_checksum_verification=passed'],
          },
        ],
      },
    ];

    const objectives = classifyObjectives({
      targets: [
        {
          label: 'pg16-local',
          expected_major: 16,
          connection_fingerprint: 'abc',
          admin_database_url: 'postgres://postgres@127.0.0.1:5416/postgres',
          database_ssl: false,
        },
      ],
      environmentBlockers: [],
      transitionPlan: {
        baseline_migration_id: '2190_ot109_rabbi_content_publisher',
        target_migration_ids: [...TARGET_MIGRATION_IDS],
        target_migration_paths: [],
        target_order_verified: true,
        target_files_are_contiguous_after_baseline: true,
        checksum_inputs: [],
        foreign_key_ordering_expectation: 'checked',
        index_creation_expectation: 'checked',
        stop_conditions: [],
      },
      targetResults,
    });

    for (const id of [
      'checksum_verification',
      'repeat_idempotence',
      'constraint_compatibility',
      'telegram_existing_row_compatibility',
      'foreign_key_ordering',
      'index_creation_behavior',
      'rolling_web_worker_compatibility',
    ]) {
      expect(objectives.find((objective) => objective.id === id)).toMatchObject({
        status: 'done',
      });
    }
  });
});
