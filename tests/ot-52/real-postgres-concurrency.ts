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

const reportPath = path.resolve(process.cwd(), 'ops/evidence/ot-52/REAL-POSTGRES-CONCURRENCY.json');

await mkdir(path.dirname(reportPath), { recursive: true });

if (!process.env.OT52_POSTGRES_URL || process.env.OT52_ALLOW_POSTGRES_WRITE !== 'true') {
  await writeReport({
    status: 'blocked',
    reason:
      'No explicit safe Postgres target was provided. Set OT52_POSTGRES_URL and OT52_ALLOW_POSTGRES_WRITE=true to run.',
  });
} else {
  const pool = new pg.Pool({
    connectionString: process.env.OT52_POSTGRES_URL,
    ssl: process.env.OT52_POSTGRES_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  }) as DbPool;
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

async function runConcurrencyProof(pool: DbPool) {
  const suffix = `${Date.now()}`;
  const accountKey = `acct_ot52_${suffix}`;
  const productKey = 'one_time_mishnah_class';
  const householdKey = `household_ot52_${suffix}`;
  const actor: PortalActorContext = {
    account_key: accountKey,
    product_key: productKey,
    actor_user_ref: `parent_ot52_${suffix}`,
    actor_role: 'parent',
    session_key: `session_ot52_${suffix}`,
    capabilities: ['parent:learner:create'],
    authorized_households: [
      {
        household_key: householdKey,
        relationship_key: `relationship_ot52_${suffix}`,
        relationship_label: 'Parent',
        authority: 'primary_guardian',
      },
    ],
    student_learner: null,
  };

  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name)
     VALUES ($1, $2, $3, 'OT52 Concurrency Test')`,
    [householdKey, accountKey, productKey],
  );

  const service = createParentPortalService(depsFor(pool));
  const attempts = await Promise.allSettled(
    [1, 2, 3, 4].map((index) =>
      service.createLearner(actor, householdKey, {
        idempotency_key: `ot52-concurrency-${suffix}-${index}`,
        display_name: `Learner ${index}`,
      }),
    ),
  );
  const fulfilled = attempts.filter((attempt) => attempt.status === 'fulfilled');
  const rejected = attempts.filter((attempt) => attempt.status === 'rejected');
  const limitRejections = rejected.filter(
    (attempt) =>
      attempt.status === 'rejected' &&
      typeof attempt.reason === 'object' &&
      attempt.reason &&
      'code' in attempt.reason &&
      attempt.reason.code === 'LEARNER_LIMIT_REACHED',
  );
  const countRows = await pool.query(
    `SELECT count(*)::int AS count
       FROM onetime.portal_learners
      WHERE account_key = $1
        AND product_key = $2
        AND household_key = $3
        AND learner_status = 'active'`,
    [accountKey, productKey, householdKey],
  );
  const activeCount = Number(countRows.rows[0]?.count ?? 0);

  return {
    status:
      fulfilled.length === 3 && limitRejections.length === 1 && activeCount === 3
        ? 'completed'
        : 'failed',
    fulfilled: fulfilled.length,
    rejected: rejected.length,
    limit_rejections: limitRejections.length,
    active_count: activeCount,
  };
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
