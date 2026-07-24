import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import type { PortalActorContext } from '../../packages/contracts/src/portals/index.ts';
import { runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import { createPortalRepository } from '../../packages/db/src/portals/repository.ts';
import {
  createParentPortalService,
  type PortalServiceDeps,
} from '../../packages/domain/src/portals/services.ts';

const reportPath = path.resolve(process.cwd(), 'ops/evidence/ot-83/REAL-POSTGRES-CONCURRENCY.json');

await mkdir(path.dirname(reportPath), { recursive: true });

if (process.env.OT83_ALLOW_POSTGRES_WRITE !== 'true') {
  await writeReport({
    status: 'blocked',
    reason:
      'No explicit safe Postgres target was provided. Set OT83_ALLOW_POSTGRES_WRITE=true with OT83_POSTGRES_URL or PG* connection variables to run.',
    external_mutations: {
      production_database: false,
      railway: false,
      providers: false,
      sends: false,
    },
  });
} else {
  const pool = new pg.Pool(poolConfigFromEnv()) as DbPool;
  try {
    await runMigrations(pool);
    const report = await runConcurrencyProof(pool);
    await writeReport(report);
    if (report.status !== 'completed') {
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

function poolConfigFromEnv(): pg.PoolConfig {
  if (process.env.OT83_POSTGRES_URL) {
    return {
      connectionString: process.env.OT83_POSTGRES_URL,
      ssl: process.env.OT83_POSTGRES_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
      max: 8,
    };
  }
  return {
    host: process.env.PGHOST ?? '127.0.0.1',
    port: Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE ?? 'postgres',
    user: process.env.PGUSER ?? 'postgres',
    password: process.env.PGPASSWORD,
    max: 8,
  };
}

async function runConcurrencyProof(pool: DbPool) {
  const suffix = `${Date.now()}`;
  const accountKey = `acct_ot83_${suffix}`;
  const productKey = 'one_time_mishnah_class';
  const householdKey = `household_ot83_${suffix}`;
  const actor: PortalActorContext = {
    account_key: accountKey,
    product_key: productKey,
    actor_user_ref: `parent_ot83_${suffix}`,
    actor_role: 'parent',
    session_key: `session_parent_ot83_${suffix}`,
    capabilities: [
      'parent:household:read',
      'parent:learner:create',
      'parent:learner:archive',
      'parent:student-access:manage',
    ],
    authorized_households: [
      {
        household_key: householdKey,
        relationship_key: `relationship_ot83_${suffix}`,
        relationship_label: 'Parent',
        authority: 'primary_guardian',
      },
    ],
    student_learner: null,
  };

  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name)
     VALUES ($1, $2, $3, 'OT83 Concurrency Test')`,
    [householdKey, accountKey, productKey],
  );

  const service = createParentPortalService(depsFor(pool));
  const first = await service.createLearner(actor, householdKey, {
    idempotency_key: `ot83-seed-${suffix}-1`,
    display_name: 'Seed Learner 1',
  });
  const second = await service.createLearner(actor, householdKey, {
    idempotency_key: `ot83-seed-${suffix}-2`,
    display_name: 'Seed Learner 2',
  });

  const race = await Promise.allSettled(
    [1, 2].map((index) =>
      service.createLearner(actor, householdKey, {
        idempotency_key: `ot83-race-${suffix}-${index}`,
        display_name: `Concurrent Learner ${index}`,
      }),
    ),
  );
  const fulfilled = race.filter((attempt) => attempt.status === 'fulfilled');
  const limitRejections = race.filter(
    (attempt) =>
      attempt.status === 'rejected' &&
      typeof attempt.reason === 'object' &&
      attempt.reason &&
      'code' in attempt.reason &&
      attempt.reason.code === 'LEARNER_LIMIT_REACHED',
  );
  const activeAfterRace = await activeCount(pool, accountKey, productKey, householdKey);

  const archived = await service.archiveLearner(actor, householdKey, first.learner_key, {
    idempotency_key: `ot83-archive-${suffix}`,
    version: first.version,
  });
  const restored = await service.restoreLearner(actor, householdKey, first.learner_key, {
    idempotency_key: `ot83-restore-${suffix}`,
    version: archived.version,
  });
  const reArchived = await service.archiveLearner(actor, householdKey, first.learner_key, {
    idempotency_key: `ot83-archive-again-${suffix}`,
    version: restored.version,
  });
  const replacement = await service.createLearner(actor, householdKey, {
    idempotency_key: `ot83-replacement-${suffix}`,
    display_name: 'Replacement Learner',
  });
  const restoredAfterReplacement = await service.restoreLearner(
    actor,
    householdKey,
    first.learner_key,
    {
      idempotency_key: `ot83-restore-after-replacement-${suffix}`,
      version: reArchived.version,
    },
  );
  const activeAfterFinalRestore = await activeCount(pool, accountKey, productKey, householdKey);

  const auditRows = await pool.query(
    `SELECT action_type, learner_key
       FROM onetime.portal_audit_actions
      WHERE account_key = $1
        AND product_key = $2
        AND household_key = $3
      ORDER BY created_at ASC`,
    [accountKey, productKey, householdKey],
  );

  const status =
    fulfilled.length === 2 &&
    limitRejections.length === 0 &&
    activeAfterRace === 4 &&
    restored.learner_status === 'active' &&
    replacement.learner_status === 'active' &&
    restoredAfterReplacement.learner_status === 'active' &&
    activeAfterFinalRestore === 5
      ? 'completed'
      : 'failed';

  return {
    status,
    scenario:
      'Start with two active learners; launch two concurrent learner creates; both succeed without a household seat cap, and archive, replacement, and restore remain atomic and audited.',
    race: {
      fulfilled: fulfilled.length,
      limit_rejections: limitRejections.length,
      active_after_race: activeAfterRace,
    },
    archive_restore: {
      archived_status: archived.learner_status,
      restored_status: restored.learner_status,
      replacement_learner_key: replacement.learner_key,
      restore_after_replacement_status: restoredAfterReplacement.learner_status,
      active_after_final_restore: activeAfterFinalRestore,
    },
    audit_actions: auditRows.rows.map((row) => ({
      action_type: String(row.action_type),
      learner_key: String(row.learner_key),
    })),
    seeded_learners: [first.learner_key, second.learner_key],
    external_mutations: {
      production_database: false,
      railway: false,
      providers: false,
      sends: false,
    },
  };
}

async function activeCount(
  pool: DbPool,
  accountKey: string,
  productKey: string,
  householdKey: string,
) {
  const rows = await pool.query(
    `SELECT count(*)::int AS count
       FROM onetime.portal_learners
      WHERE account_key = $1
        AND product_key = $2
        AND household_key = $3
        AND learner_status = 'active'`,
    [accountKey, productKey, householdKey],
  );
  return Number(rows.rows[0]?.count ?? 0);
}

function depsFor(pool: DbPool): PortalServiceDeps {
  const repository = createPortalRepository(pool);
  return {
    repository,
    classAccess: {
      upcomingForLearner: async () => [],
      protectedLaunch: async () => ({
        action_key: 'launch_action',
        label: 'Join class',
        kind: 'class_launch',
        method: 'POST',
        href: '/api/v1/portals/actions/launch',
        launch_token_ref: 'launch_ref',
        expires_at: null,
      }),
    },
    contentAccess: {
      publishedLibraryForLearner: async () => [],
      reviewSheetsForLearner: async () => [],
    },
    progress: {
      progressForLearner: async () => ({
        attendance_count: 0,
        watch_minutes: 0,
        completed_items: 0,
        last_activity_at: null,
      }),
    },
    credentialLifecycle: {
      requestSetup: async () => ({
        operation_ref: 'op_setup',
        status: 'setup_requested',
        expires_at: null,
        delivery_hint: null,
      }),
      requestReset: async () => ({
        operation_ref: 'op_reset',
        status: 'reset_requested',
        expires_at: null,
        delivery_hint: null,
      }),
      requestSuspend: async () => ({
        operation_ref: 'op_suspend',
        status: 'suspended',
        expires_at: null,
        delivery_hint: null,
      }),
      requestRestore: async () => ({
        operation_ref: 'op_restore',
        status: 'active',
        expires_at: null,
        delivery_hint: null,
      }),
      requestRevokeSessions: async () => ({
        operation_ref: 'op_revoke_sessions',
        status: 'active',
        expires_at: null,
        delivery_hint: null,
      }),
    },
  };
}

async function writeReport(report: Record<string, unknown>) {
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
