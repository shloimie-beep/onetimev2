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
  await service.createLearner(actor, householdKey, {
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
  const replacementReplay = await service.createLearner(actor, householdKey, {
    idempotency_key: `ot83-replacement-${suffix}`,
    display_name: 'Replacement Learner',
  });
  const conflictingReplacementCode = await rejectionCode(
    service.createLearner(actor, householdKey, {
      idempotency_key: `ot83-replacement-${suffix}`,
      display_name: 'Conflicting Replacement Learner',
    }),
  );
  const blockedRestoreIdempotencyKey = `ot83-restore-after-replacement-${suffix}`;
  const blockedRestoreCode = await rejectionCode(
    service.restoreLearner(actor, householdKey, first.learner_key, {
      idempotency_key: blockedRestoreIdempotencyKey,
      version: reArchived.version,
    }),
  );
  const activeAfterFinalRestore = await activeCount(pool, accountKey, productKey, householdKey);
  const firstAfterBlockedRestore = await pool.query(
    `SELECT learner_status, version
       FROM onetime.portal_learners
      WHERE account_key = $1
        AND product_key = $2
        AND household_key = $3
        AND learner_key = $4`,
    [accountKey, productKey, householdKey, first.learner_key],
  );
  const blockedRestoreWrites = await pool.query(
    `SELECT
       (SELECT count(*)::int
          FROM onetime.portal_mutation_idempotency_records
         WHERE account_key = $1
           AND product_key = $2
           AND actor_user_ref = $3
           AND idempotency_key = $4) AS idempotency_count,
       (SELECT count(*)::int
          FROM onetime.portal_audit_actions
         WHERE account_key = $1
           AND product_key = $2
           AND household_key = $5
           AND learner_key = $6
           AND action_type = 'learner_active') AS successful_restore_audit_count`,
    [
      accountKey,
      productKey,
      actor.actor_user_ref,
      blockedRestoreIdempotencyKey,
      householdKey,
      first.learner_key,
    ],
  );

  const legacyHouseholdKey = `household_ot83_legacy_${suffix}`;
  const legacyActor: PortalActorContext = {
    ...actor,
    authorized_households: [
      {
        household_key: legacyHouseholdKey,
        relationship_key: `relationship_ot83_legacy_${suffix}`,
        relationship_label: 'Parent',
        authority: 'primary_guardian',
      },
    ],
  };
  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name)
     VALUES ($1, $2, $3, 'OT83 Synthetic Legacy Limit')`,
    [legacyHouseholdKey, accountKey, productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_learners
       (learner_key, account_key, product_key, household_key, display_name)
     VALUES
       ($1, $5, $6, $7, 'Synthetic Legacy Learner 1'),
       ($2, $5, $6, $7, 'Synthetic Legacy Learner 2'),
       ($3, $5, $6, $7, 'Synthetic Legacy Learner 3'),
       ($4, $5, $6, $7, 'Synthetic Legacy Learner 4')`,
    [
      `learner_ot83_legacy_${suffix}_1`,
      `learner_ot83_legacy_${suffix}_2`,
      `learner_ot83_legacy_${suffix}_3`,
      `learner_ot83_legacy_${suffix}_4`,
      accountKey,
      productKey,
      legacyHouseholdKey,
    ],
  );
  const legacyBefore = await legacyMutationCounts(pool, accountKey, productKey, legacyHouseholdKey);
  const legacyProjection = await createPortalRepository(pool).getHousehold({
    actor: legacyActor,
    household_key: legacyHouseholdKey,
  });
  const legacyCreateCode = await rejectionCode(
    service.createLearner(legacyActor, legacyHouseholdKey, {
      idempotency_key: `ot83-legacy-create-${suffix}`,
      display_name: 'Must Not Be Created',
    }),
  );
  const legacyAfter = await legacyMutationCounts(pool, accountKey, productKey, legacyHouseholdKey);
  const crossHouseholdCode = await rejectionCode(
    service.createLearner(actor, legacyHouseholdKey, {
      idempotency_key: `ot83-cross-household-${suffix}`,
      display_name: 'Must Not Cross Scope',
    }),
  );

  const status =
    fulfilled.length === 1 &&
    limitRejections.length === 1 &&
    activeAfterRace === 3 &&
    restored.learner_status === 'active' &&
    replacement.learner_status === 'active' &&
    replacementReplay.learner_key === replacement.learner_key &&
    conflictingReplacementCode === 'IDEMPOTENCY_CONFLICT' &&
    blockedRestoreCode === 'LEARNER_LIMIT_REACHED' &&
    activeAfterFinalRestore === 3 &&
    firstAfterBlockedRestore.rows[0]?.learner_status === 'archived' &&
    Number(firstAfterBlockedRestore.rows[0]?.version) === reArchived.version &&
    Number(blockedRestoreWrites.rows[0]?.idempotency_count) === 0 &&
    Number(blockedRestoreWrites.rows[0]?.successful_restore_audit_count) === 1 &&
    legacyProjection?.active_learner_count === 4 &&
    legacyProjection.max_active_learners === 3 &&
    legacyProjection.learner_limit_reached === true &&
    legacyCreateCode === 'LEARNER_LIMIT_REACHED' &&
    JSON.stringify(legacyAfter) === JSON.stringify(legacyBefore) &&
    crossHouseholdCode === 'NOT_FOUND'
      ? 'completed'
      : 'failed';

  return {
    status,
    scenario:
      'Start with two active learners; race two creates for the final seat; preserve archive, restore, replay, scope, and synthetic legacy-state atomicity under the household lock.',
    race: {
      fulfilled: fulfilled.length,
      limit_rejections: limitRejections.length,
      active_after_race: activeAfterRace,
    },
    archive_restore: {
      archived_status: archived.learner_status,
      restored_status: restored.learner_status,
      replacement_replayed: replacementReplay.learner_key === replacement.learner_key,
      conflicting_replay_code: conflictingReplacementCode,
      restore_after_replacement_code: blockedRestoreCode,
      active_after_final_restore: activeAfterFinalRestore,
      rejected_restore_idempotency_rows: Number(
        blockedRestoreWrites.rows[0]?.idempotency_count ?? -1,
      ),
      successful_restore_audit_rows: Number(
        blockedRestoreWrites.rows[0]?.successful_restore_audit_count ?? -1,
      ),
    },
    synthetic_legacy_state: {
      active_count: legacyProjection?.active_learner_count ?? null,
      maximum: legacyProjection?.max_active_learners ?? null,
      limit_reached: legacyProjection?.learner_limit_reached ?? null,
      create_code: legacyCreateCode,
      unchanged: JSON.stringify(legacyAfter) === JSON.stringify(legacyBefore),
    },
    scope: {
      cross_household_code: crossHouseholdCode,
    },
    external_mutations: {
      production_database: false,
      railway: false,
      providers: false,
      sends: false,
    },
  };
}

async function rejectionCode(operation: Promise<unknown>) {
  try {
    await operation;
    return null;
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error) {
      return String(error.code);
    }
    throw error;
  }
}

async function legacyMutationCounts(
  pool: DbPool,
  accountKey: string,
  productKey: string,
  householdKey: string,
) {
  const result = await pool.query(
    `SELECT
       (SELECT count(*)::int
          FROM onetime.portal_learners
         WHERE account_key = $1
           AND product_key = $2
           AND household_key = $3) AS learner_count,
       (SELECT count(*)::int
          FROM onetime.portal_student_access_state
         WHERE account_key = $1
           AND product_key = $2
           AND household_key = $3) AS access_state_count,
       (SELECT count(*)::int
          FROM onetime.portal_audit_actions
         WHERE account_key = $1
           AND product_key = $2
           AND household_key = $3) AS audit_count,
       (SELECT count(*)::int
          FROM onetime.portal_mutation_idempotency_records
         WHERE account_key = $1
           AND product_key = $2
           AND operation_scope = $4) AS idempotency_count`,
    [accountKey, productKey, householdKey, `learner.create:${householdKey}`],
  );
  return {
    learner_count: Number(result.rows[0]?.learner_count ?? -1),
    access_state_count: Number(result.rows[0]?.access_state_count ?? -1),
    audit_count: Number(result.rows[0]?.audit_count ?? -1),
    idempotency_count: Number(result.rows[0]?.idempotency_count ?? -1),
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
