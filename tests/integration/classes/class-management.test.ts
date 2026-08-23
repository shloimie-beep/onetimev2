import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  attachRecordingToClass,
  createClassPortalAccessAdapter,
  createContentPortalAccessAdapter,
  createManagedClassOccurrence,
  createManagedClassSeries,
  enrollLearnerInClass,
  grantFreePilotAccess,
  getManagedClassOccurrence,
  listClassEnrollmentCandidates,
  listClassEnrollments,
  listClassOccurrencesForLearner,
  listClassRecordingAccess,
  setClassRecordingLearnerAccess,
  unenrollLearnerFromClass,
  updateManagedClassOccurrence,
  updateManagedClassSeries,
} from '../../../packages/domain/src/index.ts';

let pool: DbPool;
let config: AppConfig;

const actor = { userKey: 'owner_class_management', role: 'owner' as const };

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'class-management-test',
    COMMIT_SHA: 'class-management-test',
    OUTBOX_TRANSPORT_MODE: 'sink',
    ONE_TIME_RUNTIME_ENVIRONMENT: 'isolated_staging',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
  await alignMemoryOccurrenceStateConstraint();
  await seedFamily();
});

afterEach(async () => {
  await pool.end();
});

describe('database-backed class, enrollment, and recording management', () => {
  it('creates and edits a class and occurrence with optimistic conflict protection', async () => {
    const series = await createManagedClassSeries({
      pool,
      config,
      actor,
      payload: {
        title: 'Monday Mishnayos',
        description: 'A live weekly Mishnah class.',
        teacher_name: 'Rabbi Test',
        timezone: 'Asia/Jerusalem',
        local_start_time: '19:00',
        reminder_local_time: '18:30',
        idempotency_key: 'series-create-001',
      },
    });
    expect(series).toMatchObject({
      title: 'Monday Mishnayos',
      teacher_name: 'Rabbi Test',
      status: 'active',
      version: 1,
    });

    const occurrence = await createManagedClassOccurrence({
      pool,
      config,
      actor,
      payload: {
        class_series_key: series.class_series_key,
        local_class_date: '2026-08-03',
        starts_at: '2026-08-03T16:00:00.000Z',
        ends_at: '2026-08-03T17:00:00.000Z',
        is_operator_test: true,
        idempotency_key: 'occurrence-create-001',
      },
    });
    expect(occurrence).toMatchObject({
      title: 'Monday Mishnayos',
      is_operator_test: true,
      operator_test_environment: 'isolated_staging',
      enrolled_learner_count: 0,
      version: 1,
    });
    await expect(
      getManagedClassOccurrence({
        pool,
        config,
        occurrenceKey: occurrence.occurrence_key,
      }),
    ).resolves.toMatchObject({
      occurrence_key: occurrence.occurrence_key,
      version: 1,
    });

    const updated = await updateManagedClassSeries({
      pool,
      config,
      actor,
      seriesKey: series.class_series_key,
      payload: {
        title: 'Monday Mishnayos Live',
        description: series.description,
        teacher_name: series.teacher_name,
        timezone: series.timezone,
        local_start_time: series.local_start_time,
        reminder_local_time: series.reminder_local_time,
        status: 'active',
        version: series.version,
      },
    });
    expect(updated).toMatchObject({ title: 'Monday Mishnayos Live', version: 2 });

    await expect(
      updateManagedClassSeries({
        pool,
        config,
        actor,
        seriesKey: series.class_series_key,
        payload: {
          title: 'Stale edit',
          description: null,
          teacher_name: null,
          timezone: 'Asia/Jerusalem',
          local_start_time: '19:00',
          reminder_local_time: '18:30',
          status: 'active',
          version: 1,
        },
      }),
    ).rejects.toMatchObject({
      code: 'VERSION_CONFLICT',
      currentVersion: 2,
    });
  });

  it('derives schedules and recording access from active enrollment, then revokes both', async () => {
    const { occurrenceKey } = await seedClassAndOccurrence();
    expect(await listClassEnrollmentCandidates({ pool, config, occurrenceKey })).toEqual([
      expect.objectContaining({
        learner_key: 'learner_class_one',
        enrollment_state: null,
      }),
      expect.objectContaining({
        learner_key: 'learner_class_two',
        enrollment_state: null,
      }),
    ]);
    const enrollment = await enrollLearnerInClass({
      pool,
      config,
      actor,
      occurrenceKey,
      payload: {
        learner_key: 'learner_class_one',
        idempotency_key: 'enroll-learner-one-001',
      },
    });
    expect(enrollment).toMatchObject({
      learner_key: 'learner_class_one',
      enrollment_state: 'active',
    });

    const enrolledSchedule = await listClassOccurrencesForLearner({
      pool,
      config,
      householdKey: 'household_class_test',
      learnerKey: 'learner_class_one',
      now: new Date('2026-07-27T12:00:00.000Z'),
    });
    const siblingSchedule = await listClassOccurrencesForLearner({
      pool,
      config,
      householdKey: 'household_class_test',
      learnerKey: 'learner_class_two',
      now: new Date('2026-07-27T12:00:00.000Z'),
    });
    expect(enrolledSchedule.map((item) => item.occurrence_key)).toEqual([occurrenceKey]);
    expect(siblingSchedule).toEqual([]);

    await seedPublishedRecording();
    const attached = await attachRecordingToClass({
      pool,
      config,
      actor,
      occurrenceKey,
      payload: {
        content_item_key: 'recording_class_test',
        availability: 'available',
        idempotency_key: 'attach-recording-001',
      },
    });
    expect(attached).toMatchObject({
      availability: 'available',
      entitled_learner_count: 1,
    });
    expect(
      await listClassRecordingAccess({
        pool,
        config,
        occurrenceKey,
        itemKey: 'recording_class_test',
      }),
    ).toEqual([
      expect.objectContaining({
        learner_key: 'learner_class_one',
        enrollment_state: 'active',
        access: 'active',
      }),
    ]);

    const contentAccess = createContentPortalAccessAdapter({ pool, config });
    const learner = learnerProjection('learner_class_one', 'Enrolled Learner');
    const sibling = learnerProjection('learner_class_two', 'Sibling Learner');
    expect(
      (
        await contentAccess.publishedLibraryForLearner({
          actor: studentActor('learner_class_one'),
          learner,
        })
      ).map((item) => item.item_key),
    ).toEqual(['recording_class_test']);
    expect(
      await contentAccess.publishedLibraryForLearner({
        actor: studentActor('learner_class_two'),
        learner: sibling,
      }),
    ).toEqual([]);

    await setClassRecordingLearnerAccess({
      pool,
      config,
      actor,
      occurrenceKey,
      itemKey: 'recording_class_test',
      payload: {
        learner_key: 'learner_class_one',
        access: 'revoked',
        idempotency_key: 'revoke-recording-001',
      },
    });
    expect(
      await listClassRecordingAccess({
        pool,
        config,
        occurrenceKey,
        itemKey: 'recording_class_test',
      }),
    ).toEqual([
      expect.objectContaining({
        learner_key: 'learner_class_one',
        access: 'revoked',
      }),
    ]);
    expect(
      await contentAccess.publishedLibraryForLearner({
        actor: studentActor('learner_class_one'),
        learner,
      }),
    ).toEqual([]);

    await setClassRecordingLearnerAccess({
      pool,
      config,
      actor,
      occurrenceKey,
      itemKey: 'recording_class_test',
      payload: {
        learner_key: 'learner_class_one',
        access: 'active',
        idempotency_key: 'restore-recording-001',
      },
    });
    await unenrollLearnerFromClass({
      pool,
      config,
      actor,
      occurrenceKey,
      learnerKey: 'learner_class_one',
      idempotencyKey: 'unenroll-learner-one-001',
    });

    expect(
      await listClassOccurrencesForLearner({
        pool,
        config,
        householdKey: 'household_class_test',
        learnerKey: 'learner_class_one',
        now: new Date('2026-07-27T12:00:00.000Z'),
      }),
    ).toEqual([]);
    expect(
      await contentAccess.publishedLibraryForLearner({
        actor: studentActor('learner_class_one'),
        learner,
      }),
    ).toEqual([]);
    expect(await listClassEnrollments({ pool, config, occurrenceKey })).toEqual([
      expect.objectContaining({
        learner_key: 'learner_class_one',
        enrollment_state: 'revoked',
      }),
    ]);

    const classAccess = createClassPortalAccessAdapter({
      pool,
      config,
      now: () => new Date('2026-07-27T12:00:00.000Z'),
    });
    const denied = await classAccess.protectedLaunch({
      actor: studentActor('learner_class_one'),
      learner,
      class_key: occurrenceKey,
    });
    expect(denied).toMatchObject({
      href: null,
      launch_token_ref: 'class_access_denied',
    });
  });

  it('denies enrollment and class access after the canonical canceled state is persisted', async () => {
    const { occurrenceKey } = await seedClassAndOccurrence();
    const occurrence = await getManagedClassOccurrence({ pool, config, occurrenceKey });
    if (!occurrence) throw new Error('Missing managed occurrence fixture.');
    await enrollLearnerInClass({
      pool,
      config,
      actor,
      occurrenceKey,
      payload: {
        learner_key: 'learner_class_one',
        idempotency_key: 'enroll-before-cancel-001',
      },
    });
    await updateManagedClassOccurrence({
      pool,
      config,
      actor,
      occurrenceKey,
      payload: {
        starts_at: occurrence.starts_at,
        ends_at: occurrence.ends_at,
        status: 'cancelled',
        version: occurrence.version,
      },
    });
    await expect(
      enrollLearnerInClass({
        pool,
        config,
        actor,
        occurrenceKey,
        payload: {
          learner_key: 'learner_class_two',
          idempotency_key: 'enroll-after-cancel-001',
        },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_STATE' });
    const classAccess = createClassPortalAccessAdapter({
      pool,
      config,
      now: () => new Date('2026-08-04T16:30:00.000Z'),
    });
    await expect(
      classAccess.protectedLaunch({
        actor: studentActor('learner_class_one'),
        learner: learnerProjection('learner_class_one', 'Enrolled Learner'),
        class_key: occurrenceKey,
      }),
    ).resolves.toMatchObject({ href: null, launch_token_ref: 'class_access_denied' });
  });
});

async function alignMemoryOccurrenceStateConstraint() {
  await pool.query(
    `ALTER TABLE onetime.class_occurrences
       DROP CONSTRAINT IF EXISTS class_occurrences_constraint_1`,
  );
  await pool.query(
    `ALTER TABLE onetime.class_occurrences
       ADD CONSTRAINT class_occurrences_memory_occurrence_state_check
       CHECK (occurrence_state IN ('scheduled', 'preparing', 'ready', 'live', 'completed', 'canceled'))`,
  );
}

async function seedFamily() {
  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name, status)
     VALUES ('household_class_test',$1,$2,'Class Test Family','active')`,
    [config.accountKey, config.productKey],
  );
  for (const [learnerKey, name] of [
    ['learner_class_one', 'Enrolled Learner'],
    ['learner_class_two', 'Sibling Learner'],
  ]) {
    await pool.query(
      `INSERT INTO onetime.portal_learners
         (learner_key, account_key, product_key, household_key, display_name, learner_status)
       VALUES ($1,$2,$3,'household_class_test',$4,'active')`,
      [learnerKey, config.accountKey, config.productKey, name],
    );
  }
  await grantFreePilotAccess({
    pool,
    accountKey: config.accountKey,
    productKey: config.productKey,
    actorKind: 'provisioner',
    now: new Date('2026-07-27T09:00:00.000Z'),
    command: {
      household_key: 'household_class_test',
      idempotency_key: 'class-test-free-pilot-001',
      effective_at: '2026-07-27T08:00:00.000Z',
      expires_at: '2026-08-27T08:00:00.000Z',
      policy_version: 'class-management-test-v1',
      opaque_source_reference: 'class_test_pilot',
    },
  });
}

async function seedClassAndOccurrence() {
  const series = await createManagedClassSeries({
    pool,
    config,
    actor,
    payload: {
      title: 'Managed Mishnayos',
      description: 'Managed class fixture.',
      teacher_name: 'Rabbi Fixture',
      timezone: 'Asia/Jerusalem',
      local_start_time: '19:00',
      reminder_local_time: '18:30',
      idempotency_key: 'managed-series-001',
    },
  });
  const occurrence = await createManagedClassOccurrence({
    pool,
    config,
    actor,
    payload: {
      class_series_key: series.class_series_key,
      local_class_date: '2026-08-04',
      starts_at: '2026-08-04T16:00:00.000Z',
      ends_at: '2026-08-04T17:00:00.000Z',
      is_operator_test: false,
      idempotency_key: 'managed-occurrence-001',
    },
  });
  return { occurrenceKey: occurrence.occurrence_key };
}

async function seedPublishedRecording() {
  await pool.query(
    `INSERT INTO onetime.content_items
       (content_item_key, account_key, product_key, title, item_type, lifecycle_state,
        latest_revision_number, latest_revision_key, published_revision_key, published_at)
     VALUES ('recording_class_test',$1,$2,'Managed class recording','video','published',
             1,'recording_class_test_rev1','recording_class_test_rev1',now())`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.classroom_lesson_publications
       (lesson_key, account_key, product_key, class_series_key, content_item_key,
        title, publication_state, published_at)
     VALUES ('lesson_class_test',$1,$2,'managed_series_projection','recording_class_test',
             'Managed class recording','published',now())`,
    [config.accountKey, config.productKey],
  );
}

function learnerProjection(learnerKey: string, displayName: string) {
  return {
    learner_key: learnerKey,
    household_key: 'household_class_test',
    display_name: displayName,
    hebrew_name: null,
    grade_label: null,
    learner_status: 'active' as const,
    version: 1,
    created_at: '2026-07-27T08:00:00.000Z',
    updated_at: '2026-07-27T08:00:00.000Z',
  };
}

function studentActor(learnerKey: string) {
  return {
    account_key: config.accountKey,
    product_key: config.productKey,
    actor_user_ref: `user_${learnerKey}`,
    actor_role: 'student' as const,
    session_key: `session_${learnerKey}`,
    capabilities: ['student:dashboard:read' as const, 'student:class:launch' as const],
    authorized_households: [],
    student_learner: {
      learner_key: learnerKey,
      household_key: 'household_class_test',
      access_state_key: `access_${learnerKey}`,
    },
  };
}
