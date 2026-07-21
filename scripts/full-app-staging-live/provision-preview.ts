import { createHash, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig, type AppConfig } from '../../packages/config/src/index.ts';
import { createPgPool, type DbPool } from '../../packages/db/src/index.ts';
import { createClassroomRepository } from '../../packages/db/src/classroom/repository.ts';
import { createGamificationRepository } from '../../packages/db/src/gamification/repository.ts';
import { createPortalRepository } from '../../packages/db/src/portals/repository.ts';
import type {
  LearnerProfile,
  PortalActorContext,
  ProgressSummary,
  StudentAccessState,
} from '../../packages/contracts/src/portals/index.ts';
import {
  authenticateUser,
  createAccountLifecycleCredentialAdapter,
  createAccountUser,
  createClassroomPortalAccessAdapter,
  createClassroomService,
  createContentPortalAccessAdapter,
  createGamificationService,
  createParentPortalService,
  createPortalGamificationAdapter,
  createStudentPortalService,
  ONE_TIME_CLASS_SERIES_KEY,
  PortalServiceError,
  type PortalServiceDeps,
} from '../../packages/domain/src/index.ts';
import { AesGcmPayloadCodec } from '../../packages/domain/src/telegram/crypto.ts';

const EXPECTED_ACCOUNT_KEY = 'rabbi_sheller_provider';
const EXPECTED_PRODUCT_KEY = 'one_time_mishnah_class';
const HOUSEHOLD_KEY = 'full_app_preview_household';
const RELATIONSHIP_KEY = 'full_app_preview_primary_guardian';
const CONTENT_ITEM_KEY = 'full_app_demo_mishnayos_video';
const CONTENT_REVISION_KEY = 'full_app_demo_mishnayos_video_rev_1';
const LESSON_KEY = 'full_app_demo_mishnayos_lesson';
const VIMEO_SOURCE_KEY = 'full_app_private_vimeo_demo_source';
const CLASS_BOARD_KEY = 'full_app_demo_class_board';
const HANDOFF_PATH =
  process.env.FULL_APP_HANDOFF_PATH ??
  path.join(
    process.env.USERPROFILE ?? process.env.HOME ?? process.cwd(),
    '.onetime-full-app-preview',
    'FULL-APP-HANDOFF.private.json',
  );

type PreviewStudent = {
  label: string;
  learner_key: string;
  access_state_key: string;
  student_user_ref: string;
  username: string;
  password: string;
  class_ready: boolean;
  lesson_ready: boolean;
  protected_launch_ready: boolean;
};

type FullAppPreviewResult = {
  generated_at: string;
  staging_url: string;
  login_url: string;
  handoff_path: string | null;
  account_key: string;
  product_key: string;
  admin_login: 'email_challenge_required' | 'ready';
  parent_login: 'ready';
  fourth_student_cap_rejection: boolean;
  vimeo_demo_lesson_ready: boolean;
  zoom_demo_class_ready: boolean;
  zoom_provider_mode: 'sink' | 'real';
  household_key: string;
  class_key: string;
  lesson_key: string;
  latest_required_migration: '2209_class_series_scope_unique';
  students: PreviewStudent[];
};

type RunFullAppProvisionInput = {
  pool: DbPool;
  config: AppConfig;
  publicBaseUrl?: string;
  writePrivateHandoff?: boolean;
  requirePrivateDestinations?: boolean;
  now?: Date;
};

const previewLearners = [
  {
    label: 'Student 1',
    learnerKey: 'full_app_preview_student_1',
    accessStateKey: 'full_app_preview_student_1_access',
    displayName: 'Preview Student One',
    username: 'otdemo1',
    gradeLabel: 'Demo',
  },
  {
    label: 'Student 2',
    learnerKey: 'full_app_preview_student_2',
    accessStateKey: 'full_app_preview_student_2_access',
    displayName: 'Preview Student Two',
    username: 'otdemo2',
    gradeLabel: 'Demo',
  },
  {
    label: 'Student 3',
    learnerKey: 'full_app_preview_student_3',
    accessStateKey: 'full_app_preview_student_3_access',
    displayName: 'Preview Student Three',
    username: 'otdemo3',
    gradeLabel: 'Demo',
  },
] as const;

export async function runFullAppProvision(
  input: RunFullAppProvisionInput,
): Promise<FullAppPreviewResult> {
  const now = input.now ?? new Date();
  assertStagingScope(input.config, input.requirePrivateDestinations ?? true);
  const publicBaseUrl = normalizeBaseUrl(input.publicBaseUrl ?? input.config.publicBaseUrl);
  const destinations = resolveDestinations(input.config, {
    requirePrivateDestinations: input.requirePrivateDestinations ?? true,
  });
  const runId = `${compactDate(now)}_${randomBytes(4).toString('hex')}`;
  const adminPassword = strongPassword('Adm');
  const parentPassword = strongPassword('Par');
  const studentPasswords = previewLearners.map((_, index) => strongPassword(`Stu${index + 1}`));

  await createAccountUser({
    pool: input.pool,
    config: input.config,
    email: destinations.adminDestination,
    password: adminPassword,
    displayName: 'Full App Preview Admin',
    role: 'admin',
    mfaCapable: false,
  });
  const parentUserKey = await createAccountUser({
    pool: input.pool,
    config: input.config,
    email: destinations.parentDestination,
    password: parentPassword,
    displayName: 'Full App Preview Parent',
    role: 'parent',
    mfaCapable: false,
  });

  await seedPreviewHousehold(input.pool, input.config, parentUserKey, now);
  const learners = await seedPreviewLearners(input.pool, input.config, now);
  const firstLearner = learners[0];
  if (!firstLearner) {
    throw new Error('Preview learner seeding did not create any learners.');
  }
  const parentActor = parentActorContext(input.config, parentUserKey);
  const parentService = createParentPortalService(
    portalDeps(input.pool, input.config, now, { withRealAdapters: false }),
  );

  const fourthRejected = await verifyFourthStudentCap(parentService, parentActor, runId);
  const accessStates = await configureStudentCredentials({
    pool: input.pool,
    config: input.config,
    parentService,
    parentActor,
    learners,
    runId,
    passwords: studentPasswords,
  });
  await verifyParentOperations(parentService, parentActor, firstLearner, runId);

  const classKey = await ensureOpenDemoClass(
    input.pool,
    input.config,
    parentActor,
    firstLearner,
    now,
  );
  await seedLearningContent(input.pool, input.config, classKey, now);
  await seedProgressAndRewards(input.pool, input.config, parentUserKey, classKey, learners, now);

  const deps = portalDeps(input.pool, input.config, now, { withRealAdapters: true });
  const liveParentService = createParentPortalService(deps);
  const studentService = createStudentPortalService(deps);
  const parentDashboard = await liveParentService.dashboard(parentActor, HOUSEHOLD_KEY);
  if (
    parentDashboard.learners.filter((learner) => learner.learner_status === 'active').length !== 3
  ) {
    throw new Error('Preview parent dashboard did not expose exactly three active learners.');
  }

  const students: PreviewStudent[] = [];
  for (const [index, learner] of learners.entries()) {
    const fixture = previewLearners[index];
    const password = studentPasswords[index];
    const access = accessStates[index];
    if (!fixture || !password || !access) {
      throw new Error(`Preview student fixture is incomplete at index ${index}.`);
    }
    if (!access.student_user_ref) {
      throw new Error(`Student access is missing a user reference for ${learner.learner_key}.`);
    }
    const actor = studentActorContext(input.config, learner, access, runId);
    const dashboard = await studentService.dashboard(actor);
    const upcoming = dashboard.upcoming_classes[0];
    const featuredLesson = dashboard.featured_lesson;
    const protectedLaunch = upcoming?.launch_action
      ? await studentService.protectedClassLaunch(actor, upcoming.class_key, {
          idempotency_key: `full-app-launch-${runId}-${index + 1}`,
        })
      : null;
    const launchReady =
      Boolean(protectedLaunch?.href?.startsWith('/classroom/launch/')) &&
      !String(protectedLaunch?.href ?? '').includes('zoom');
    students.push({
      label: fixture.label,
      learner_key: learner.learner_key,
      access_state_key: access.access_state_key,
      student_user_ref: access.student_user_ref,
      username: fixture.username,
      password,
      class_ready: upcoming?.status === 'live' || upcoming?.status === 'available',
      lesson_ready:
        featuredLesson?.lesson_key === LESSON_KEY &&
        featuredLesson.video_provider === 'vimeo' &&
        featuredLesson.raw_private_url_present === false,
      protected_launch_ready: launchReady,
    });
  }

  const adminLogin = await authenticateUser({
    pool: input.pool,
    config: input.config,
    identifier: destinations.adminDestination,
    password: adminPassword,
    ip: '127.0.0.1',
    userAgent: 'full-app-staging-provision',
  });
  if (adminLogin.ok) {
    throw new Error('Admin preview login unexpectedly skipped the email challenge.');
  }
  if (adminLogin.code !== 'EMAIL_CHALLENGE_REQUIRED') {
    throw new Error(`Admin preview login failed before email challenge: ${adminLogin.code}`);
  }
  const parentLogin = await authenticateUser({
    pool: input.pool,
    config: input.config,
    identifier: destinations.parentDestination,
    password: parentPassword,
    ip: '127.0.0.1',
    userAgent: 'full-app-staging-provision',
  });
  if (!parentLogin.ok) {
    throw new Error(`Parent preview login failed: ${parentLogin.code}`);
  }
  for (const student of students) {
    const studentLogin = await authenticateUser({
      pool: input.pool,
      config: input.config,
      identifier: student.username,
      password: student.password,
      ip: '127.0.0.1',
      userAgent: 'full-app-staging-provision',
    });
    if (!studentLogin.ok) {
      throw new Error(`${student.label} preview login failed: ${studentLogin.code}`);
    }
  }

  const result: FullAppPreviewResult = {
    generated_at: now.toISOString(),
    staging_url: publicBaseUrl,
    login_url: `${publicBaseUrl}/login`,
    handoff_path: input.writePrivateHandoff === false ? null : HANDOFF_PATH,
    account_key: input.config.accountKey,
    product_key: input.config.productKey,
    admin_login: 'email_challenge_required',
    parent_login: 'ready',
    fourth_student_cap_rejection: fourthRejected,
    vimeo_demo_lesson_ready: students.every((student) => student.lesson_ready),
    zoom_demo_class_ready: students.every((student) => student.protected_launch_ready),
    zoom_provider_mode: input.config.zoomClassroomProviderMode,
    household_key: HOUSEHOLD_KEY,
    class_key: classKey,
    lesson_key: LESSON_KEY,
    latest_required_migration: '2209_class_series_scope_unique',
    students,
  };

  if (input.writePrivateHandoff !== false) {
    await writePrivateHandoff({
      result,
      adminDestination: destinations.adminDestination,
      adminPassword,
      parentDestination: destinations.parentDestination,
      parentPassword,
      testExpiresAt: addDays(now, 7).toISOString(),
    });
  }

  return result;
}

function portalDeps(
  pool: DbPool,
  config: AppConfig,
  now: Date,
  options: { withRealAdapters: boolean },
): PortalServiceDeps {
  const classroomService = createClassroomService({
    config,
    repository: createClassroomRepository(pool),
    questionCodec: new AesGcmPayloadCodec(`${config.mfaSecretEncryptionKey}:classroom-question-v1`),
    clock: () => now,
  });
  const gamificationService = createGamificationService({
    repository: createGamificationRepository(pool),
    clock: () => now,
  });
  const deps: PortalServiceDeps = {
    repository: createPortalRepository(pool),
    classAccess: options.withRealAdapters
      ? createClassroomPortalAccessAdapter({ classroom: classroomService })
      : emptyClassAccess(),
    contentAccess: options.withRealAdapters
      ? createContentPortalAccessAdapter({ pool, config })
      : emptyContentAccess(),
    progress: progressAdapter(pool),
    credentialLifecycle: createAccountLifecycleCredentialAdapter({ pool, config }),
  };
  if (options.withRealAdapters) {
    deps.gamification = createPortalGamificationAdapter(gamificationService);
  }
  return deps;
}

function emptyClassAccess(): PortalServiceDeps['classAccess'] {
  return {
    upcomingForLearner: async () => [],
    protectedLaunch: async () => ({
      action_key: 'classroom_unavailable',
      label: 'Join class',
      kind: 'class_launch',
      method: 'GET',
      href: null,
      launch_token_ref: null,
      expires_at: null,
    }),
  };
}

function emptyContentAccess(): PortalServiceDeps['contentAccess'] {
  return {
    publishedLibraryForLearner: async () => [],
    reviewSheetsForLearner: async () => [],
  };
}

function progressAdapter(pool: DbPool): PortalServiceDeps['progress'] {
  return {
    progressForLearner: async ({ actor, learner }): Promise<ProgressSummary> => {
      const result = await pool.query(
        `SELECT
            COALESCE(sum(CASE WHEN attendance_state = 'present' THEN 1 ELSE 0 END), 0)::int
              AS attendance_count,
            max(recorded_at) AS last_activity_at
           FROM onetime.class_attendance_marks
          WHERE account_key = $1
            AND product_key = $2
            AND learner_key = $3`,
        [actor.account_key, actor.product_key, learner.learner_key],
      );
      const row = result.rows[0] as Record<string, unknown> | undefined;
      return {
        attendance_count: Number(row?.attendance_count ?? 0),
        watch_minutes: 18,
        completed_items: 1,
        last_activity_at: row?.last_activity_at
          ? new Date(String(row.last_activity_at)).toISOString()
          : null,
      };
    },
  };
}

async function seedPreviewHousehold(
  pool: DbPool,
  config: AppConfig,
  parentUserKey: string,
  now: Date,
) {
  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name, status, updated_at)
     VALUES ($1,$2,$3,'Full App Preview Household','active',$4)
     ON CONFLICT (account_key, product_key, household_key)
     DO UPDATE SET display_name = EXCLUDED.display_name, status = 'active', updated_at = $4`,
    [HOUSEHOLD_KEY, config.accountKey, config.productKey, now],
  );
  await pool.query(
    `INSERT INTO onetime.portal_guardian_relationships
       (relationship_key, account_key, product_key, household_key, guardian_user_ref,
        relationship_label, authority, status, updated_at)
     VALUES ($1,$2,$3,$4,$5,'Preview parent','primary_guardian','active',$6)
     ON CONFLICT (account_key, product_key, household_key, relationship_key)
     DO UPDATE SET guardian_user_ref = EXCLUDED.guardian_user_ref,
                   relationship_label = EXCLUDED.relationship_label,
                   authority = 'primary_guardian',
                   status = 'active',
                   updated_at = $6`,
    [RELATIONSHIP_KEY, config.accountKey, config.productKey, HOUSEHOLD_KEY, parentUserKey, now],
  );
  await pool.query(
    `INSERT INTO onetime.portal_guardian_consents
       (consent_key, account_key, product_key, household_key, relationship_key, consent_type,
        policy_version, consent_text_digest, consent_status, recorded_by_user_ref, recorded_at)
     VALUES ($1,$2,$3,$4,$5,'classroom_join','full-app-preview-v1',$6,'granted',$7,$8)
     ON CONFLICT (consent_key)
     DO UPDATE SET consent_status = 'granted',
                   recorded_by_user_ref = EXCLUDED.recorded_by_user_ref,
                   recorded_at = $8,
                   superseded_at = NULL`,
    [
      'full_app_preview_classroom_consent',
      config.accountKey,
      config.productKey,
      HOUSEHOLD_KEY,
      RELATIONSHIP_KEY,
      digest('full-app-preview-classroom-consent-v1'),
      parentUserKey,
      now,
    ],
  );
  await pool.query(
    `INSERT INTO onetime.classroom_household_entitlements
       (entitlement_key, account_key, product_key, household_key, entitlement_state, source,
        effective_at, updated_at)
     VALUES ($1,$2,$3,$4,'active','full_app_staging_preview',$5,$5)
     ON CONFLICT (entitlement_key)
     DO UPDATE SET entitlement_state = 'active',
                   source = EXCLUDED.source,
                   household_key = EXCLUDED.household_key,
                   expires_at = NULL,
                   effective_at = $5,
                   updated_at = $5`,
    [
      'full_app_preview_classroom_entitlement',
      config.accountKey,
      config.productKey,
      HOUSEHOLD_KEY,
      now,
    ],
  );
  await pool.query(
    `INSERT INTO onetime.billing_entitlement_projections
       (entitlement_key, account_key, product_key, principal_key, principal_type, status,
        policy_version, source, reason, effective_at, evaluated_at, grants_access, updated_at)
     VALUES ($1,$2,$3,$4,'opaque','active','full-app-preview-v1','full_app_staging_preview',
             'staging preview household', $5, $5, true, $5)
     ON CONFLICT (entitlement_key)
     DO UPDATE SET status = 'active',
                   reason = EXCLUDED.reason,
                   grants_access = true,
                   evaluated_at = $5,
                   updated_at = $5`,
    [
      'full_app_preview_billing_entitlement',
      config.accountKey,
      config.productKey,
      HOUSEHOLD_KEY,
      now,
    ],
  );
}

async function seedPreviewLearners(pool: DbPool, config: AppConfig, now: Date) {
  const learners: LearnerProfile[] = [];
  for (const learner of previewLearners) {
    const result = await pool.query(
      `INSERT INTO onetime.portal_learners
         (learner_key, account_key, product_key, household_key, display_name, grade_label,
          learner_status, archived_at, suspended_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'active',NULL,NULL,$7)
       ON CONFLICT (account_key, product_key, learner_key)
       DO UPDATE SET household_key = EXCLUDED.household_key,
                     display_name = EXCLUDED.display_name,
                     grade_label = EXCLUDED.grade_label,
                     learner_status = 'active',
                     archived_at = NULL,
                     suspended_at = NULL,
                     updated_at = $7
       RETURNING learner_key, household_key, display_name, hebrew_name, grade_label,
                 learner_status, version, created_at, updated_at`,
      [
        learner.learnerKey,
        config.accountKey,
        config.productKey,
        HOUSEHOLD_KEY,
        learner.displayName,
        learner.gradeLabel,
        now,
      ],
    );
    await pool.query(
      `INSERT INTO onetime.portal_student_access_state
         (access_state_key, account_key, product_key, household_key, learner_key, status,
          updated_at)
       VALUES ($1,$2,$3,$4,$5,'not_configured',$6)
       ON CONFLICT (access_state_key)
       DO UPDATE SET household_key = EXCLUDED.household_key,
                     learner_key = EXCLUDED.learner_key,
                     updated_at = $6`,
      [
        learner.accessStateKey,
        config.accountKey,
        config.productKey,
        HOUSEHOLD_KEY,
        learner.learnerKey,
        now,
      ],
    );
    learners.push(mapLearner(result.rows[0] as Record<string, unknown>));
  }
  return learners;
}

async function verifyFourthStudentCap(
  service: ReturnType<typeof createParentPortalService>,
  actor: PortalActorContext,
  runId: string,
) {
  try {
    await service.createLearner(actor, HOUSEHOLD_KEY, {
      idempotency_key: `full-app-fourth-${runId}`,
      display_name: 'Preview Student Four',
      grade_label: 'Demo',
    });
    return false;
  } catch (error) {
    if (error instanceof PortalServiceError && error.code === 'LEARNER_LIMIT_REACHED') {
      return true;
    }
    throw error;
  }
}

async function configureStudentCredentials(input: {
  pool: DbPool;
  config: AppConfig;
  parentService: ReturnType<typeof createParentPortalService>;
  parentActor: PortalActorContext;
  learners: LearnerProfile[];
  runId: string;
  passwords: string[];
}): Promise<StudentAccessState[]> {
  const states: StudentAccessState[] = [];
  for (const [index, learner] of input.learners.entries()) {
    const fixture = previewLearners[index];
    const password = input.passwords[index];
    if (!fixture || !password) {
      throw new Error(`Preview student fixture is incomplete at index ${index}.`);
    }
    const existing = await createPortalRepository(input.pool).getStudentAccessState({
      actor: input.parentActor,
      learner_key: learner.learner_key,
    });
    const operation = existing.status === 'active' ? 'reset' : 'setup';
    const state = await input.parentService.studentAccessOperation(
      input.parentActor,
      HOUSEHOLD_KEY,
      learner.learner_key,
      operation,
      {
        idempotency_key: `full-app-${operation}-${input.runId}-${index + 1}`,
        username: fixture.username,
        password,
        display_name: learner.display_name,
      },
    );
    if (state.status !== 'active' || state.credential_status !== 'parent_managed') {
      throw new Error(`Student credential setup did not finish active for ${learner.learner_key}.`);
    }
    states.push(state);
  }
  return states;
}

async function verifyParentOperations(
  service: ReturnType<typeof createParentPortalService>,
  actor: PortalActorContext,
  learner: LearnerProfile,
  runId: string,
) {
  await service.studentAccessOperation(actor, HOUSEHOLD_KEY, learner.learner_key, 'suspend', {
    idempotency_key: `full-app-suspend-${runId}`,
  });
  const restored = await service.studentAccessOperation(
    actor,
    HOUSEHOLD_KEY,
    learner.learner_key,
    'restore',
    {
      idempotency_key: `full-app-restore-${runId}`,
    },
  );
  if (restored.status !== 'active') {
    throw new Error('Student restore operation did not leave the preview learner active.');
  }
  await service.studentAccessOperation(
    actor,
    HOUSEHOLD_KEY,
    learner.learner_key,
    'revoke_sessions',
    {
      idempotency_key: `full-app-revoke-sessions-${runId}`,
    },
  );
}

async function ensureOpenDemoClass(
  pool: DbPool,
  config: AppConfig,
  actor: PortalActorContext,
  learner: LearnerProfile,
  now: Date,
) {
  const classroom = createClassroomService({
    config,
    repository: createClassroomRepository(pool),
    questionCodec: new AesGcmPayloadCodec(`${config.mfaSecretEncryptionKey}:classroom-question-v1`),
    clock: () => now,
  });
  const occurrence = await classroom.upcomingForLearner({ actor, learner });
  const startsAt = new Date(now.getTime() - 60_000);
  const reminderDueAt = new Date(startsAt.getTime() - 30 * 60_000);
  const joinOpensAt = new Date(now.getTime() - 10 * 60_000);
  const scheduledEndsAt = new Date(now.getTime() + 59 * 60_000);
  const joinClosesAt = new Date(now.getTime() + 75 * 60_000);
  await pool.query(
    `UPDATE onetime.class_occurrences
        SET starts_at = $4,
            reminder_due_at = $5,
            joinable_until = $8,
            join_opens_at = $6,
            scheduled_ends_at = $7,
            join_closes_at = $8,
            occurrence_state = 'live',
            access_state = 'ready',
            attendance_state = 'open',
            provider_meeting_state = CASE
              WHEN $9 = 'sink' THEN 'sink_ready'
              ELSE provider_meeting_state
            END,
            provider_meeting_ref_digest = COALESCE(provider_meeting_ref_digest, $10),
            raw_zoom_join_url_present = false,
            updated_at = $11
      WHERE account_key = $1
        AND product_key = $2
        AND occurrence_key = $3`,
    [
      config.accountKey,
      config.productKey,
      occurrence.class_key,
      startsAt,
      reminderDueAt,
      joinOpensAt,
      scheduledEndsAt,
      joinClosesAt,
      config.zoomClassroomProviderMode,
      digest('full-app-preview-zoom-sink-meeting'),
      now,
    ],
  );
  await pool.query(
    `INSERT INTO onetime.classroom_session_provider_projection
       (session_projection_key, account_key, product_key, occurrence_key, provider,
        provider_meeting_ref_digest, provider_state, raw_join_url_present, updated_at)
     VALUES ($1,$2,$3,$4,'zoom',$5,$6,false,$7)
     ON CONFLICT (account_key, product_key, occurrence_key, provider)
     DO UPDATE SET provider_meeting_ref_digest = EXCLUDED.provider_meeting_ref_digest,
                   provider_state = EXCLUDED.provider_state,
                   raw_join_url_present = false,
                   updated_at = $7`,
    [
      'full_app_preview_zoom_projection',
      config.accountKey,
      config.productKey,
      occurrence.class_key,
      digest('full-app-preview-zoom-sink-meeting'),
      config.zoomClassroomProviderMode === 'sink' ? 'sink_ready' : 'not_configured',
      now,
    ],
  );
  return occurrence.class_key;
}

async function seedLearningContent(
  pool: DbPool,
  config: AppConfig,
  occurrenceKey: string,
  now: Date,
) {
  const vimeoDigest = digest('full-app-preview-private-vimeo-reference');
  await pool.query(
    `INSERT INTO onetime.learning_delivery_media_sources
       (source_key, account_key, product_key, source_kind, source_ref_digest, source_sha256,
        display_name, media_state, current_vimeo_source_key, safe_metadata_json, terminal_at,
        updated_at)
     VALUES ($1,$2,$3,'private_vimeo_reference',$4,$5,$6,'published',$7,$8::jsonb,$9,$9)
     ON CONFLICT (source_key)
     DO UPDATE SET media_state = 'published',
                   current_vimeo_source_key = EXCLUDED.current_vimeo_source_key,
                   safe_metadata_json = EXCLUDED.safe_metadata_json,
                   terminal_at = $9,
                   updated_at = $9`,
    [
      VIMEO_SOURCE_KEY,
      config.accountKey,
      config.productKey,
      vimeoDigest,
      digest('full-app-preview-private-vimeo-asset'),
      'One Time Demo Mishnayos Class',
      VIMEO_SOURCE_KEY,
      JSON.stringify({
        raw_url_present: false,
        raw_private_url_present: false,
        staging_preview: true,
      }),
      now,
    ],
  );
  await pool.query(
    `INSERT INTO onetime.content_items
       (content_item_key, account_key, product_key, occurrence_key, title, item_type,
        lifecycle_state, latest_revision_number, latest_revision_key, published_revision_key,
        retention_state, metadata, published_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,'video','published',1,$6,$6,'active',$7::jsonb,$8,$8)
     ON CONFLICT (content_item_key)
     DO UPDATE SET occurrence_key = EXCLUDED.occurrence_key,
                   title = EXCLUDED.title,
                   lifecycle_state = 'published',
                   latest_revision_number = 1,
                   latest_revision_key = EXCLUDED.latest_revision_key,
                   published_revision_key = EXCLUDED.published_revision_key,
                   retention_state = 'active',
                   metadata = EXCLUDED.metadata,
                   published_at = $8,
                   updated_at = $8`,
    [
      CONTENT_ITEM_KEY,
      config.accountKey,
      config.productKey,
      occurrenceKey,
      'One Time Demo Mishnayos Class',
      CONTENT_REVISION_KEY,
      JSON.stringify({
        provider: 'vimeo',
        raw_private_url_present: false,
        protected_portal_only: true,
      }),
      now,
    ],
  );
  await pool.query(
    `INSERT INTO onetime.content_revisions
       (revision_key, account_key, product_key, content_item_key, outcome_event_key,
        revision_number, lifecycle_state, transcript_metadata, source_metadata,
        review_sheet_metadata, playback_descriptor, provider_event_ref_digest,
        source_ref_digest, raw_provider_target_present, published_at)
     VALUES ($1,$2,$3,$4,$5,1,'published',$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,
             $10,$11,false,$12)
     ON CONFLICT (revision_key)
     DO UPDATE SET lifecycle_state = 'published',
                   transcript_metadata = EXCLUDED.transcript_metadata,
                   source_metadata = EXCLUDED.source_metadata,
                   review_sheet_metadata = EXCLUDED.review_sheet_metadata,
                   playback_descriptor = EXCLUDED.playback_descriptor,
                   raw_provider_target_present = false,
                   published_at = $12`,
    [
      CONTENT_REVISION_KEY,
      config.accountKey,
      config.productKey,
      CONTENT_ITEM_KEY,
      'full_app_demo_vimeo_outcome',
      JSON.stringify({ state: 'available', raw_transcript_present: false }),
      JSON.stringify({ source_kind: 'private_vimeo_reference', source_key: VIMEO_SOURCE_KEY }),
      JSON.stringify({ review_available: true }),
      JSON.stringify({ provider: 'vimeo', protected_runtime: true, raw_url_present: false }),
      digest('full-app-preview-vimeo-provider-event'),
      vimeoDigest,
      now,
    ],
  );
  await pool.query(
    `INSERT INTO onetime.content_item_entitlements
       (entitlement_key, account_key, product_key, content_item_key, audience,
        household_key, entitlement_state)
     VALUES ($1,$2,$3,$4,'household',$5,'active')
     ON CONFLICT (entitlement_key)
     DO UPDATE SET household_key = EXCLUDED.household_key,
                   entitlement_state = 'active',
                   revoked_at = NULL`,
    [
      'full_app_preview_content_entitlement',
      config.accountKey,
      config.productKey,
      CONTENT_ITEM_KEY,
      HOUSEHOLD_KEY,
    ],
  );
  await pool.query(
    `INSERT INTO onetime.classroom_lesson_publications
       (lesson_key, account_key, product_key, class_series_key, occurrence_key, content_item_key,
        title, description, publication_state, featured, published_at, controlled_by_actor_ref,
        vimeo_source_key, vimeo_provider_ref_digest, raw_private_url_present, transcript_state,
        resource_count, resources_json, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'published',true,$9,'full_app_preview',$10,$11,false,
             'available',1,$12::jsonb,$9)
     ON CONFLICT (lesson_key)
     DO UPDATE SET occurrence_key = EXCLUDED.occurrence_key,
                   content_item_key = EXCLUDED.content_item_key,
                   title = EXCLUDED.title,
                   description = EXCLUDED.description,
                   publication_state = 'published',
                   featured = true,
                   published_at = $9,
                   vimeo_source_key = EXCLUDED.vimeo_source_key,
                   vimeo_provider_ref_digest = EXCLUDED.vimeo_provider_ref_digest,
                   raw_private_url_present = false,
                   transcript_state = 'available',
                   resource_count = 1,
                   resources_json = EXCLUDED.resources_json,
                   updated_at = $9`,
    [
      LESSON_KEY,
      config.accountKey,
      config.productKey,
      ONE_TIME_CLASS_SERIES_KEY,
      occurrenceKey,
      CONTENT_ITEM_KEY,
      'One Time Demo Mishnayos Class',
      'Staging-only protected Vimeo demo lesson for the full app preview.',
      now,
      VIMEO_SOURCE_KEY,
      vimeoDigest,
      JSON.stringify([
        {
          label: 'Demo review sheet',
          kind: 'review_sheet',
          raw_private_url_present: false,
        },
      ]),
    ],
  );
}

async function seedProgressAndRewards(
  pool: DbPool,
  config: AppConfig,
  actorUserKey: string,
  occurrenceKey: string,
  learners: LearnerProfile[],
  now: Date,
) {
  await pool.query(
    `INSERT INTO onetime.classroom_leaderboard_publication_controls
       (board_key, account_key, product_key, class_series_key, title, publication_state,
        controlled_by_actor_ref, updated_at)
     VALUES ($1,$2,$3,$4,$5,'published',$6,$7)
     ON CONFLICT (account_key, product_key, class_series_key)
     DO UPDATE SET title = EXCLUDED.title,
                   publication_state = 'published',
                   controlled_by_actor_ref = EXCLUDED.controlled_by_actor_ref,
                   updated_at = $7`,
    [
      CLASS_BOARD_KEY,
      config.accountKey,
      config.productKey,
      ONE_TIME_CLASS_SERIES_KEY,
      'One Time Demo Class Leaderboard',
      actorUserKey,
      now,
    ],
  );
  for (const [index, learner] of learners.entries()) {
    const points = 25 - index * 5;
    const rewardKey = `full_app_preview_reward_${index + 1}`;
    await pool.query(
      `INSERT INTO onetime.class_attendance_marks
         (attendance_key, account_key, product_key, occurrence_key, learner_key,
          attendance_state, source, metadata, recorded_at)
       VALUES ($1,$2,$3,$4,$5,'present','portal',$6::jsonb,$7)
       ON CONFLICT (account_key, product_key, occurrence_key, learner_key)
       DO UPDATE SET attendance_state = 'present',
                     source = 'portal',
                     metadata = EXCLUDED.metadata,
                     recorded_at = $7`,
      [
        `full_app_preview_attendance_${index + 1}`,
        config.accountKey,
        config.productKey,
        occurrenceKey,
        learner.learner_key,
        JSON.stringify({ staging_preview: true }),
        now,
      ],
    );
    await pool.query(
      `INSERT INTO onetime.portal_reward_events
         (reward_event_key, account_key, product_key, household_key, learner_key,
          points_delta, reason_code, reason_label, actor_ref, source_type,
          correction_of_event_key, idempotency_key, request_hash, metadata, occurred_at)
       VALUES ($1,$2,$3,$4,$5,$6,'lesson_completed','Lesson completed',$7,'system',
               NULL,$8,$9,$10::jsonb,$11)
       ON CONFLICT (account_key, product_key, learner_key, idempotency_key)
       DO UPDATE SET points_delta = EXCLUDED.points_delta,
                     reason_code = EXCLUDED.reason_code,
                     reason_label = EXCLUDED.reason_label,
                     metadata = EXCLUDED.metadata,
                     occurred_at = $11`,
      [
        rewardKey,
        config.accountKey,
        config.productKey,
        HOUSEHOLD_KEY,
        learner.learner_key,
        points,
        actorUserKey,
        rewardKey,
        digest(rewardKey),
        JSON.stringify({ staging_preview: true }),
        now,
      ],
    );
    await pool.query(
      `INSERT INTO onetime.classroom_leaderboard_events
         (leaderboard_event_key, account_key, product_key, class_series_key, learner_key,
          reward_event_key, event_type, points_delta, actor_user_ref, audit_reason,
          occurred_at, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,'lesson_completed',$7,$8,'full_app_staging_preview',$9,$10::jsonb)
       ON CONFLICT (leaderboard_event_key)
       DO UPDATE SET points_delta = EXCLUDED.points_delta,
                     occurred_at = $9,
                     metadata = EXCLUDED.metadata`,
      [
        `full_app_preview_leaderboard_${index + 1}`,
        config.accountKey,
        config.productKey,
        ONE_TIME_CLASS_SERIES_KEY,
        learner.learner_key,
        rewardKey,
        points,
        actorUserKey,
        now,
        JSON.stringify({ staging_preview: true }),
      ],
    );
  }
}

function parentActorContext(config: AppConfig, parentUserKey: string): PortalActorContext {
  return {
    account_key: config.accountKey,
    product_key: config.productKey,
    actor_user_ref: parentUserKey,
    actor_role: 'parent',
    session_key: 'full_app_preview_parent_session',
    capabilities: [
      'parent:household:read',
      'parent:learner:create',
      'parent:learner:update',
      'parent:learner:archive',
      'parent:student-access:manage',
      'parent:class:launch',
      'parent:content:open',
      'parent:support:preview',
      'rewards:read',
      'gamification:read',
      'gamification:write',
      'helper:query',
    ],
    authorized_households: [
      {
        household_key: HOUSEHOLD_KEY,
        relationship_key: RELATIONSHIP_KEY,
        relationship_label: 'Preview parent',
        authority: 'primary_guardian',
      },
    ],
    student_learner: null,
  };
}

function studentActorContext(
  config: AppConfig,
  learner: LearnerProfile,
  access: { access_state_key: string; student_user_ref: string | null },
  runId: string,
): PortalActorContext {
  if (!access.student_user_ref) {
    throw new Error(`Student user reference is missing for ${learner.learner_key}.`);
  }
  return {
    account_key: config.accountKey,
    product_key: config.productKey,
    actor_user_ref: access.student_user_ref,
    actor_role: 'student',
    session_key: `full_app_preview_student_session_${learner.learner_key}_${runId}`,
    capabilities: [
      'student:dashboard:read',
      'student:class:launch',
      'student:content:open',
      'student:question:create',
      'student:class:question',
      'student:support:preview',
      'rewards:read',
      'gamification:read',
      'helper:query',
    ],
    authorized_households: [],
    student_learner: {
      learner_key: learner.learner_key,
      household_key: learner.household_key,
      access_state_key: access.access_state_key,
    },
  };
}

function resolveDestinations(config: AppConfig, options: { requirePrivateDestinations: boolean }) {
  const adminDestination =
    firstEmail(
      process.env.FULL_APP_ADMIN_EMAIL,
      process.env.ONE_TIME_FULL_APP_ADMIN_EMAIL,
      config.ownerTestEmail,
      config.deliveryTestCanaryEmail,
    ) ?? (options.requirePrivateDestinations ? null : 'full-app-admin@example.invalid');
  const parentDestination =
    firstEmail(
      process.env.FULL_APP_PARENT_EMAIL,
      process.env.ONE_TIME_FULL_APP_PARENT_EMAIL,
      config.parentTestEmail,
    ) ?? (options.requirePrivateDestinations ? null : 'full-app-parent@example.invalid');
  if (!adminDestination) {
    throw new Error('FULL_APP_ADMIN_EMAIL or ONE_TIME_OWNER_TEST_EMAIL is required.');
  }
  if (!parentDestination) {
    throw new Error('FULL_APP_PARENT_EMAIL or ONE_TIME_PARENT_TEST_EMAIL is required.');
  }
  if (adminDestination === parentDestination) {
    throw new Error('Admin and parent preview destinations must be distinct.');
  }
  return { adminDestination, parentDestination };
}

function assertStagingScope(config: AppConfig, requirePrivateDestinations: boolean) {
  if (
    config.deliveryEnvironment === 'production' ||
    config.oneTimeRuntimeEnvironment === 'production'
  ) {
    throw new Error('Refusing full app preview provisioning in production runtime scope.');
  }
  if (config.accountKey !== EXPECTED_ACCOUNT_KEY || config.productKey !== EXPECTED_PRODUCT_KEY) {
    throw new Error(
      `Expected ${EXPECTED_ACCOUNT_KEY}/${EXPECTED_PRODUCT_KEY}; got ${config.accountKey}/${config.productKey}.`,
    );
  }
  if (!config.zoomClassroomEnabled) {
    throw new Error('ZOOM_CLASSROOM_ENABLED must be true for the demo class preview.');
  }
  if (config.zoomClassroomProviderMode !== 'sink') {
    throw new Error('ZOOM_CLASSROOM_PROVIDER_MODE must be sink for the managed staging fallback.');
  }
  if (requirePrivateDestinations && config.deliveryEnvironment !== 'isolated_staging') {
    throw new Error(
      'Full app preview provisioning requires DELIVERY_ENVIRONMENT=isolated_staging.',
    );
  }
}

async function writePrivateHandoff(input: {
  result: FullAppPreviewResult;
  adminDestination: string;
  adminPassword: string;
  parentDestination: string;
  parentPassword: string;
  testExpiresAt: string;
}) {
  const handoff = {
    generated_at: input.result.generated_at,
    staging_url: input.result.staging_url,
    login_url: input.result.login_url,
    account_key: input.result.account_key,
    product_key: input.result.product_key,
    admin: {
      label: 'Full App Preview Admin',
      destination: input.adminDestination,
      password: input.adminPassword,
      login_expectation: 'password_then_email_challenge',
    },
    parent: {
      label: 'Full App Preview Parent',
      destination: input.parentDestination,
      password: input.parentPassword,
      portal_url: `${input.result.staging_url}/app/parent`,
    },
    students: input.result.students.map((student) => ({
      label: student.label,
      username: student.username,
      password: student.password,
      portal_url: `${input.result.staging_url}/app/student`,
      learner_key: student.learner_key,
    })),
    demo: {
      household_key: input.result.household_key,
      class_key: input.result.class_key,
      lesson_key: input.result.lesson_key,
      lesson_title: 'One Time Demo Mishnayos Class',
      fourth_student_cap_rejection: input.result.fourth_student_cap_rejection,
      zoom_provider_mode: input.result.zoom_provider_mode,
      protected_zoom_launch_only: true,
      raw_zoom_link_in_handoff: false,
      raw_vimeo_link_in_handoff: false,
    },
    test_expires_at: input.testExpiresAt,
    cleanup: {
      instruction:
        'Staging preview records use full_app_preview_* keys. Revoke sessions and archive the preview household when testing is complete.',
      production_changed: false,
    },
  };
  await mkdir(path.dirname(HANDOFF_PATH), { recursive: true });
  await writeFile(HANDOFF_PATH, `${JSON.stringify(handoff, null, 2)}\n`, { mode: 0o600 });
}

function mapLearner(row: Record<string, unknown>): LearnerProfile {
  return {
    learner_key: String(row.learner_key),
    household_key: String(row.household_key),
    display_name: String(row.display_name),
    hebrew_name:
      row.hebrew_name === null || row.hebrew_name === undefined ? null : String(row.hebrew_name),
    grade_label:
      row.grade_label === null || row.grade_label === undefined ? null : String(row.grade_label),
    learner_status: String(row.learner_status) as LearnerProfile['learner_status'],
    version: Number(row.version ?? 1),
    created_at: new Date(String(row.created_at)).toISOString(),
    updated_at: new Date(String(row.updated_at)).toISOString(),
  };
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '');
}

function firstEmail(...values: Array<string | undefined>) {
  return values
    .map((value) => value?.trim().toLowerCase())
    .find((value): value is string => Boolean(value && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)));
}

function strongPassword(prefix: string) {
  return `${prefix}_${randomBytes(12).toString('base64url')}7Aa!`;
}

function compactDate(value: Date) {
  return value
    .toISOString()
    .replace(/[-:T.Z]/g, '')
    .slice(0, 14);
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function publicSummary(result: FullAppPreviewResult) {
  return {
    generated_at: result.generated_at,
    staging_url: result.staging_url,
    login_url: result.login_url,
    account_key: result.account_key,
    product_key: result.product_key,
    admin_login: result.admin_login,
    parent_login: result.parent_login,
    student_count: result.students.length,
    fourth_student_cap_rejection: result.fourth_student_cap_rejection,
    vimeo_demo_lesson_ready: result.vimeo_demo_lesson_ready,
    zoom_demo_class_ready: result.zoom_demo_class_ready,
    zoom_provider_mode: result.zoom_provider_mode,
    handoff_path: result.handoff_path,
    latest_required_migration: result.latest_required_migration,
    raw_links_printed: false,
    credentials_printed: false,
  };
}

async function main() {
  const config = loadConfig(process.env);
  const pool = createPgPool(config);
  try {
    const result = await runFullAppProvision({
      pool,
      config,
      publicBaseUrl: process.env.FULL_APP_STAGING_URL ?? config.publicBaseUrl,
      writePrivateHandoff: true,
      requirePrivateDestinations: true,
    });
    process.stdout.write(`${JSON.stringify(publicSummary(result), null, 2)}\n`);
  } finally {
    await pool.end();
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
