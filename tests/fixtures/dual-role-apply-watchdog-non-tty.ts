import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import {
  CONTROLLER_DUAL_ROLE_ACCESS_EXPIRES_AT,
  CONTROLLER_DUAL_ROLE_PROVISIONING_POLICY,
} from '../../packages/domain/src/accounts/controller-dual-role-provisioning-policy.ts';
import { writePrivateControllerResult } from '../../scripts/operations/controller-private-result.ts';
import {
  runDualRoleAdultProvision,
  runDualRoleAdultProvisionCli,
} from '../../scripts/operations/provision-dual-role-adult.ts';

const mode = process.argv[2];
if (mode !== 'success' && mode !== 'output-timeout') {
  throw new Error('A fixture mode is required.');
}

const sourceSha = 'c'.repeat(40);
const authorization = 'non-tty fixture controller authorization';
const now = new Date('2026-08-20T12:00:00.000Z');
const memory = createMemoryPool();
await runMigrations(memory);
const pool = prerequisiteCompatibleMemoryPool(memory);
await pool.query(
  `INSERT INTO onetime.class_series
     (class_series_key, account_key, product_key, title, timezone, local_start_time,
      reminder_local_time, status, series_state, is_canonical)
   VALUES ('non-tty-controller-class','one_time','one_time_mishnayos','Fixture class',
           'Asia/Jerusalem','19:00','18:30','active','active',true)`,
);

const config = loadConfig({
  NODE_ENV: 'test',
  DELIVERY_ENVIRONMENT: 'isolated_staging',
  ONE_TIME_RUNTIME_ENVIRONMENT: 'isolated_staging',
  ONE_TIME_VERIFICATION_ENVIRONMENT_ID: 'ci',
  APP_VERSION: 'test',
  COMMIT_SHA: sourceSha,
  RAILWAY_PROJECT_ID: 'fixture-project-identity',
  RAILWAY_ENVIRONMENT_ID: 'fixture-environment-identity',
  RAILWAY_SERVICE_ID: 'fixture-service-identity',
  AUTH_CSRF_SECRET: 'fixture-controller-auth-csrf-secret-for-tests',
  ONE_TIME_LIFECYCLE_DELIVERY_KEY: 'fixture-controller-lifecycle-delivery-key-for-tests',
  OUTBOX_TRANSPORT_MODE: 'sink',
  PARENT_STUDENT_SERVICE_ACCOUNT_VERSION: 'fixture-parent-student-service-v1',
  PARENT_STUDENT_SERVICE_ACCOUNT_EVIDENCE_REFERENCE: 'fixture-evidence/parent-student-v1',
});
const manifest = {
  schema_version: 'onetime.controller.dual_role_adult_provision.v1',
  operation_id: 'non-tty-controller-fixture',
  authorized_at: now.toISOString(),
  expires_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
  expected_runtime_source_sha: sourceSha,
  authorization_phrase_sha256: createHash('sha256').update(authorization).digest('hex'),
  railway: {
    project_id: 'fixture-project-identity',
    environment_id: 'fixture-environment-identity',
    service_id: 'fixture-service-identity',
  },
  scope: {
    account_key: 'one_time',
    product_key: 'one_time_mishnayos',
    runtime_tier: 'isolated_staging',
    verification_environment_id: 'ci',
  },
  adult: {
    email: 'non-tty-controller@example.test',
    display_name: 'Synthetic Dual Role Adult',
    household_display_name: 'Synthetic Non-TTY Family',
    roles: ['admin', 'parent'],
    separate_family_household: true,
    canonical_access_state: 'free',
    compatibility_access: {
      source_kind: 'admin_override',
      actor_kind: 'provisioner',
      policy_version: CONTROLLER_DUAL_ROLE_PROVISIONING_POLICY,
      expires_at: CONTROLLER_DUAL_ROLE_ACCESS_EXPIRES_AT,
    },
    setup_delivery: { purpose: 'password_reset', send_now: true, max_message_count: 1 },
  },
  preconditions: {
    identity: 'absent_or_exact_replay',
    legacy_account_user_count: 0,
    local_contact_count: 0,
  },
  prohibited_effects: {
    create_legacy_account_user: false,
    create_contact_or_ghl_projection: false,
    create_student: false,
    create_billing_or_payment_state: false,
    record_terms_privacy_or_marketing_consent: false,
  },
} as const;

const directory =
  mode === 'output-timeout' ? await mkdtemp(join(tmpdir(), 'controller-cli-')) : null;
const outputPath = directory ? join(directory, 'result.json') : undefined;
const emitted: string[] = [];

try {
  const exitCode = await runDualRoleAdultProvisionCli(
    [
      ...(mode === 'output-timeout' ? ['--apply'] : []),
      ...(outputPath ? ['--out', outputPath] : []),
    ],
    (output) => emitted.push(output),
    {
      runProvision: (cliOptions) =>
        runDualRoleAdultProvision({
          ...cliOptions,
          manifest,
          pool,
          config,
          now,
          authorizationPhrase: authorization,
          testOnlyAllowIsolatedApply: true,
          ...(mode === 'output-timeout'
            ? {
                testOnlyStallApplyStage: 'transaction_begin' as const,
                testOnlyApplyStageTimeoutMs: 25,
              }
            : {}),
          issuePasswordReset: async () => {
            throw new Error('Setup must not run in the non-TTY fixture.');
          },
        }),
      ...(mode === 'output-timeout'
        ? {
            writeResult: (path: string, output: string) =>
              writePrivateControllerResult(path, output, {
                testOnlyTimeoutMs: 25,
                testOnlyStallBeforePrivateOpen: true,
              }),
          }
        : {}),
    },
  );

  if (emitted.length !== 1) throw new Error('The real CLI did not emit exactly one result.');
  for (const table of [
    'v21_adult_identities',
    'v21_human_accounts',
    'v21_households',
    'v21_adult_credentials',
    'account_lifecycle_tokens',
    'account_lifecycle_delivery_intents',
    'account_lifecycle_delivery_outbox',
  ]) {
    const count = await pool.query(`SELECT count(*)::integer AS count FROM onetime.${table}`);
    if (Number(count.rows[0]?.count ?? 0) !== 0) {
      throw new Error('The real CLI fixture observed an unexpected persistence effect.');
    }
  }
  process.stdout.write(emitted[0]!);
  process.exitCode = exitCode;
} finally {
  await pool.end();
  if (directory) await rm(directory, { recursive: true, force: true });
}

function prerequisiteCompatibleMemoryPool(database: DbPool): DbPool {
  const invoke = database.query.bind(database) as unknown as (
    statement: string | { text: string },
    values?: unknown[],
  ) => Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
  return {
    query: (async (statement: string | { text: string }, values?: unknown[]) => {
      const text = typeof statement === 'string' ? statement : statement.text;
      if (text.includes('controller_dual_role_apply_catalog_prerequisite')) {
        const tableNames = Array.isArray(values?.[0]) ? values[0] : [];
        return {
          rowCount: tableNames.length,
          rows: tableNames.map((tableName) => ({
            table_name: tableName,
            owned_by_runtime: true,
            rls_disabled: true,
            can_select: true,
            can_insert: true,
            can_update: true,
          })),
        };
      }
      if (text.includes('controller_dual_role_apply_trigger_prerequisite')) {
        return { rowCount: 1, rows: [{ count: 1 }] };
      }
      if (text.includes('current_database() AS database_name')) {
        return {
          rowCount: 1,
          rows: [
            {
              database_name: 'pgmem_dual_role_provisioning_ci',
              server_address: '127.0.0.1',
              server_version: 'pg-mem-isolated-test-double',
            },
          ],
        };
      }
      return invoke(statement, values);
    }) as DbPool['query'],
    connect: database.connect.bind(database) as DbPool['connect'],
    end: database.end.bind(database) as DbPool['end'],
    __memory: true,
  } as DbPool;
}
