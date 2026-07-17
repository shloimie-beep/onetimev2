import { createHash } from 'node:crypto';
import type { Express, Request, Response } from 'express';
import type { AppConfig } from '../../../../../../packages/config/src/index.ts';
import type { DbPool } from '../../../../../../packages/db/src/index.ts';
import {
  createAccountUser,
  type AuthenticatedSession,
} from '../../../../../../packages/domain/src/index.ts';

type SessionPorts = {
  sessionFromRequest(req: Request): Promise<AuthenticatedSession | null>;
  ensureSessionCsrfCookie(
    req: Request,
    res: Response,
    session: AuthenticatedSession,
  ): Promise<string>;
  requireSessionCsrf(req: Request, res: Response, session: AuthenticatedSession): Promise<boolean>;
  setPrivateNoStore(res: Response): void;
};

export const W12_PORTAL_TEST_LAB_ROUTE = '/app/portal-test-lab';

export const W12_PORTAL_TEST_LAB = {
  householdKey: 'w12_household_portal_lab',
  householdName: 'W12 Portal Lab Family',
  relationshipKey: 'w12_guardian_portal_lab',
  admin: {
    email: 'w12-admin@example.test',
    passwordEnv: 'OT_W12_ADMIN_PASSWORD',
    defaultPassword: 'W12AdminPass!234',
    displayName: 'W12 Fictional Admin',
  },
  parent: {
    email: 'w12-parent@example.test',
    passwordEnv: 'OT_W12_PARENT_PASSWORD',
    defaultPassword: 'W12ParentPass!234',
    displayName: 'W12 Fictional Parent',
  },
  learners: [
    {
      learnerKey: 'w12_learner_001',
      accessStateKey: 'w12_access_001',
      linkKey: 'w12_link_001',
      email: 'w12-student-01@example.test',
      passwordEnv: 'OT_W12_STUDENT_01_PASSWORD',
      defaultPassword: 'W12StudentOne!234',
      displayName: 'W12 Learner One',
      gradeLabel: '6',
    },
    {
      learnerKey: 'w12_learner_002',
      accessStateKey: 'w12_access_002',
      linkKey: 'w12_link_002',
      email: 'w12-student-02@example.test',
      passwordEnv: 'OT_W12_STUDENT_02_PASSWORD',
      defaultPassword: 'W12StudentTwo!234',
      displayName: 'W12 Learner Two',
      gradeLabel: '5',
    },
    {
      learnerKey: 'w12_learner_003',
      accessStateKey: 'w12_access_003',
      linkKey: 'w12_link_003',
      email: 'w12-student-03@example.test',
      passwordEnv: 'OT_W12_STUDENT_03_PASSWORD',
      defaultPassword: 'W12StudentThree!234',
      displayName: 'W12 Learner Three',
      gradeLabel: '4',
    },
  ],
  classSeriesKey: 'w12_class_series_portal_lab',
  occurrenceKey: 'w12_class_occurrence_portal_lab',
  recordingKey: 'w12_recording_001',
  reviewKey: 'w12_review_sheet_001',
  helperVersionId: 'w12_helper_version_001',
} as const;

type PortalTestLabStatus = {
  seeded: boolean;
  counts: Record<string, number>;
  missing: string[];
  identities: Array<{
    role: 'admin' | 'parent' | 'student';
    label: string;
    email: string;
    learner_key: string | null;
    route: string;
  }>;
};

export function isPortalTestLabEnabled(config: AppConfig) {
  return config.portalTestLabEnabled === true && !config.isProduction;
}

export function registerPortalTestLabRoutes(input: {
  app: Express;
  config: AppConfig;
  pool: DbPool;
  session: SessionPorts;
}) {
  input.app.get(W12_PORTAL_TEST_LAB_ROUTE, async (req, res) => {
    input.session.setPrivateNoStore(res);
    if (!isPortalTestLabEnabled(input.config)) {
      res.status(404).type('text').send('Portal Test Lab is unavailable.');
      return;
    }

    const session = await requireOwnerAdminSession(req, res, input);
    if (!session) return;
    const csrfToken = await input.session.ensureSessionCsrfCookie(req, res, session);
    const status = await portalTestLabStatus(input.pool, input.config);
    res
      .status(200)
      .type('html')
      .send(portalTestLabHtml(status, csrfToken, flashFromQuery(req)));
  });

  input.app.post(`${W12_PORTAL_TEST_LAB_ROUTE}/reseed`, async (req, res) => {
    await handleLabMutation(req, res, input, async () => {
      await seedPortalTestLab({ pool: input.pool, config: input.config });
      return 'reseeded';
    });
  });

  input.app.post(`${W12_PORTAL_TEST_LAB_ROUTE}/reset`, async (req, res) => {
    await handleLabMutation(req, res, input, async () => {
      await resetPortalTestLab({ pool: input.pool, config: input.config });
      return 'reset';
    });
  });
}

export async function seedPortalTestLab(input: { pool: DbPool; config: AppConfig }) {
  if (!isPortalTestLabEnabled(input.config)) return portalTestLabStatus(input.pool, input.config);

  const adminUserKey = await createAccountUser({
    pool: input.pool,
    config: input.config,
    email: W12_PORTAL_TEST_LAB.admin.email,
    password: labPassword(
      W12_PORTAL_TEST_LAB.admin.passwordEnv,
      W12_PORTAL_TEST_LAB.admin.defaultPassword,
    ),
    displayName: W12_PORTAL_TEST_LAB.admin.displayName,
    role: 'admin',
  });
  void adminUserKey;

  const parentUserKey = await createAccountUser({
    pool: input.pool,
    config: input.config,
    email: W12_PORTAL_TEST_LAB.parent.email,
    password: labPassword(
      W12_PORTAL_TEST_LAB.parent.passwordEnv,
      W12_PORTAL_TEST_LAB.parent.defaultPassword,
    ),
    displayName: W12_PORTAL_TEST_LAB.parent.displayName,
    role: 'parent',
  });
  const studentUserKeys = await Promise.all(
    W12_PORTAL_TEST_LAB.learners.map((learner) =>
      createAccountUser({
        pool: input.pool,
        config: input.config,
        email: learner.email,
        password: labPassword(learner.passwordEnv, learner.defaultPassword),
        displayName: learner.displayName,
        role: 'student',
      }),
    ),
  );

  await input.pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name, status)
     VALUES ($1,$2,$3,$4,'active')
     ON CONFLICT (account_key, product_key, household_key)
     DO UPDATE SET display_name = EXCLUDED.display_name, status = 'active', updated_at = now()`,
    [
      W12_PORTAL_TEST_LAB.householdKey,
      input.config.accountKey,
      input.config.productKey,
      W12_PORTAL_TEST_LAB.householdName,
    ],
  );
  await input.pool.query(
    `INSERT INTO onetime.portal_guardian_relationships
       (relationship_key, account_key, product_key, household_key, guardian_user_ref,
        relationship_label, authority, status)
     VALUES ($1,$2,$3,$4,$5,'Parent','primary_guardian','active')
     ON CONFLICT (relationship_key)
     DO UPDATE SET guardian_user_ref = EXCLUDED.guardian_user_ref,
                   status = 'active',
                   authority = 'primary_guardian',
                   updated_at = now()`,
    [
      W12_PORTAL_TEST_LAB.relationshipKey,
      input.config.accountKey,
      input.config.productKey,
      W12_PORTAL_TEST_LAB.householdKey,
      parentUserKey,
    ],
  );

  for (const [index, learner] of W12_PORTAL_TEST_LAB.learners.entries()) {
    const studentUserKey = studentUserKeys[index];
    await input.pool.query(
      `INSERT INTO onetime.portal_learners
         (learner_key, account_key, product_key, household_key, display_name, grade_label,
          learner_status)
       VALUES ($1,$2,$3,$4,$5,$6,'active')
       ON CONFLICT (account_key, product_key, learner_key)
       DO UPDATE SET display_name = EXCLUDED.display_name,
                     grade_label = EXCLUDED.grade_label,
                     learner_status = 'active',
                     archived_at = NULL,
                     suspended_at = NULL,
                     updated_at = now()`,
      [
        learner.learnerKey,
        input.config.accountKey,
        input.config.productKey,
        W12_PORTAL_TEST_LAB.householdKey,
        learner.displayName,
        learner.gradeLabel,
      ],
    );
    await input.pool.query(
      `INSERT INTO onetime.portal_student_access_state
         (access_state_key, account_key, product_key, household_key, learner_key,
          student_user_ref, status, last_operation_type, last_operation_at)
       VALUES ($1,$2,$3,$4,$5,$6,'active','restore',now())
       ON CONFLICT (access_state_key)
       DO UPDATE SET student_user_ref = EXCLUDED.student_user_ref,
                     status = 'active',
                     last_operation_type = 'restore',
                     last_operation_at = now(),
                     updated_at = now()`,
      [
        learner.accessStateKey,
        input.config.accountKey,
        input.config.productKey,
        W12_PORTAL_TEST_LAB.householdKey,
        learner.learnerKey,
        studentUserKey,
      ],
    );
    await input.pool.query(
      `INSERT INTO onetime.account_learner_identity_links
         (link_key, account_key, product_key, household_key, learner_key, user_key, link_state)
       VALUES ($1,$2,$3,$4,$5,$6,'active')
       ON CONFLICT (account_key, product_key, learner_key)
       DO UPDATE SET user_key = EXCLUDED.user_key,
                     link_state = 'active',
                     suspended_at = NULL,
                     disabled_at = NULL`,
      [
        learner.linkKey,
        input.config.accountKey,
        input.config.productKey,
        W12_PORTAL_TEST_LAB.householdKey,
        learner.learnerKey,
        studentUserKey,
      ],
    );
  }

  await seedPortalLabClassAndContent(input);
  await seedPortalLabActivity(input, parentUserKey, studentUserKeys);
  await seedPortalLabBilling(input);
  await seedPortalLabHelperContent(input);
  return portalTestLabStatus(input.pool, input.config);
}

export async function resetPortalTestLab(input: { pool: DbPool; config: AppConfig }) {
  if (!isPortalTestLabEnabled(input.config)) return portalTestLabStatus(input.pool, input.config);
  const emails = [
    W12_PORTAL_TEST_LAB.parent.email,
    ...W12_PORTAL_TEST_LAB.learners.map((learner) => learner.email),
  ];
  const users = await input.pool.query(
    `SELECT user_key
       FROM onetime.account_users
      WHERE account_key = $1
        AND product_key = $2
        AND email_normalized = ANY($3::text[])`,
    [input.config.accountKey, input.config.productKey, emails],
  );
  const userKeys = users.rows.map((row) => String(row.user_key));

  await input.pool.query(
    `DELETE FROM onetime.user_sessions
      WHERE account_key = $1
        AND product_key = $2
        AND user_key = ANY($3::text[])`,
    [input.config.accountKey, input.config.productKey, userKeys],
  );
  await input.pool.query(
    `DELETE FROM onetime.portal_student_questions
      WHERE account_key = $1 AND product_key = $2 AND household_key = $3`,
    [input.config.accountKey, input.config.productKey, W12_PORTAL_TEST_LAB.householdKey],
  );
  await input.pool.query(
    `DELETE FROM onetime.portal_reward_events
      WHERE account_key = $1 AND product_key = $2 AND household_key = $3`,
    [input.config.accountKey, input.config.productKey, W12_PORTAL_TEST_LAB.householdKey],
  );
  await input.pool.query(
    `DELETE FROM onetime.class_attendance_marks
      WHERE account_key = $1 AND product_key = $2 AND learner_key = ANY($3::text[])`,
    [
      input.config.accountKey,
      input.config.productKey,
      W12_PORTAL_TEST_LAB.learners.map((learner) => learner.learnerKey),
    ],
  );
  await input.pool.query(
    `DELETE FROM onetime.portal_administrative_updates
      WHERE account_key = $1 AND product_key = $2 AND household_key = $3`,
    [input.config.accountKey, input.config.productKey, W12_PORTAL_TEST_LAB.householdKey],
  );
  await input.pool.query(
    `DELETE FROM onetime.portal_student_access_operations
      WHERE account_key = $1 AND product_key = $2 AND household_key = $3`,
    [input.config.accountKey, input.config.productKey, W12_PORTAL_TEST_LAB.householdKey],
  );
  await input.pool.query(
    `DELETE FROM onetime.portal_audit_actions
      WHERE account_key = $1 AND product_key = $2 AND household_key = $3`,
    [input.config.accountKey, input.config.productKey, W12_PORTAL_TEST_LAB.householdKey],
  );

  return seedPortalTestLab(input);
}

export async function portalTestLabStatus(
  pool: DbPool,
  config: AppConfig,
): Promise<PortalTestLabStatus> {
  const emails = [
    W12_PORTAL_TEST_LAB.admin.email,
    W12_PORTAL_TEST_LAB.parent.email,
    ...W12_PORTAL_TEST_LAB.learners.map((learner) => learner.email),
  ];
  const [
    users,
    households,
    learners,
    links,
    accessStates,
    classes,
    content,
    attendance,
    rewards,
    questions,
    billing,
    helperDocs,
  ] = await Promise.all([
    pool.query(
      `SELECT email_normalized, role, status
         FROM onetime.account_users
        WHERE account_key = $1 AND product_key = $2 AND email_normalized = ANY($3::text[])`,
      [config.accountKey, config.productKey, emails],
    ),
    pool.query(
      `SELECT count(*)::int AS count
         FROM onetime.portal_households
        WHERE account_key = $1 AND product_key = $2 AND household_key = $3 AND status = 'active'`,
      [config.accountKey, config.productKey, W12_PORTAL_TEST_LAB.householdKey],
    ),
    pool.query(
      `SELECT learner_key, learner_status
         FROM onetime.portal_learners
        WHERE account_key = $1 AND product_key = $2 AND household_key = $3`,
      [config.accountKey, config.productKey, W12_PORTAL_TEST_LAB.householdKey],
    ),
    pool.query(
      `SELECT learner_key, user_key, link_state
         FROM onetime.account_learner_identity_links
        WHERE account_key = $1 AND product_key = $2 AND household_key = $3`,
      [config.accountKey, config.productKey, W12_PORTAL_TEST_LAB.householdKey],
    ),
    pool.query(
      `SELECT learner_key, status
         FROM onetime.portal_student_access_state
        WHERE account_key = $1 AND product_key = $2 AND household_key = $3`,
      [config.accountKey, config.productKey, W12_PORTAL_TEST_LAB.householdKey],
    ),
    pool.query(
      `SELECT count(*)::int AS count
         FROM onetime.class_occurrences
        WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3`,
      [config.accountKey, config.productKey, W12_PORTAL_TEST_LAB.occurrenceKey],
    ),
    pool.query(
      `SELECT count(*)::int AS count
         FROM onetime.content_items
        WHERE account_key = $1
          AND product_key = $2
          AND content_item_key IN ($3,$4)
          AND published_revision_key IS NOT NULL`,
      [
        config.accountKey,
        config.productKey,
        W12_PORTAL_TEST_LAB.recordingKey,
        W12_PORTAL_TEST_LAB.reviewKey,
      ],
    ),
    pool.query(
      `SELECT count(*)::int AS count
         FROM onetime.class_attendance_marks
        WHERE account_key = $1 AND product_key = $2 AND learner_key = ANY($3::text[])`,
      [
        config.accountKey,
        config.productKey,
        W12_PORTAL_TEST_LAB.learners.map((learner) => learner.learnerKey),
      ],
    ),
    pool.query(
      `SELECT count(*)::int AS count
         FROM onetime.portal_reward_events
        WHERE account_key = $1 AND product_key = $2 AND household_key = $3`,
      [config.accountKey, config.productKey, W12_PORTAL_TEST_LAB.householdKey],
    ),
    pool.query(
      `SELECT count(*)::int AS count
         FROM onetime.portal_student_questions
        WHERE account_key = $1 AND product_key = $2 AND household_key = $3`,
      [config.accountKey, config.productKey, W12_PORTAL_TEST_LAB.householdKey],
    ),
    pool.query(
      `SELECT count(*)::int AS count
         FROM onetime.billing_entitlement_projections
        WHERE account_key = $1
          AND product_key = $2
          AND principal_key = $3
          AND status = 'active'
          AND grants_access = true`,
      [config.accountKey, config.productKey, W12_PORTAL_TEST_LAB.householdKey],
    ),
    pool.query(
      `SELECT count(*)::int AS count
         FROM onetime.ot86_search_documents
        WHERE tenant_id = $1
          AND content_id = $2
          AND active = true`,
      [tenantIdFor(config), W12_PORTAL_TEST_LAB.recordingKey],
    ),
  ]);

  const userRows = users.rows as Array<Record<string, unknown>>;
  const learnerRows = learners.rows as Array<Record<string, unknown>>;
  const linkRows = links.rows as Array<Record<string, unknown>>;
  const accessRows = accessStates.rows as Array<Record<string, unknown>>;
  const missing: string[] = [];
  const hasEmail = (email: string, role: string) =>
    userRows.some(
      (row) => row.email_normalized === email && row.role === role && row.status === 'active',
    );
  if (!hasEmail(W12_PORTAL_TEST_LAB.admin.email, 'admin')) missing.push('fictional admin user');
  if (!hasEmail(W12_PORTAL_TEST_LAB.parent.email, 'parent')) {
    missing.push('fictional parent user');
  }
  for (const learner of W12_PORTAL_TEST_LAB.learners) {
    if (!hasEmail(learner.email, 'student')) missing.push(`${learner.displayName} user`);
    if (
      !learnerRows.some(
        (row) => row.learner_key === learner.learnerKey && row.learner_status === 'active',
      )
    ) {
      missing.push(`${learner.displayName} profile`);
    }
    if (
      !linkRows.some((row) => row.learner_key === learner.learnerKey && row.link_state === 'active')
    ) {
      missing.push(`${learner.displayName} identity link`);
    }
    if (
      !accessRows.some((row) => row.learner_key === learner.learnerKey && row.status === 'active')
    ) {
      missing.push(`${learner.displayName} active access`);
    }
  }
  const counts = {
    household: rowCount(households),
    users: userRows.length,
    active_learners: learnerRows.filter((row) => row.learner_status === 'active').length,
    active_student_links: linkRows.filter((row) => row.link_state === 'active').length,
    active_access_states: accessRows.filter((row) => row.status === 'active').length,
    scheduled_classes: rowCount(classes),
    published_items: rowCount(content),
    attendance_marks: rowCount(attendance),
    reward_events: rowCount(rewards),
    private_questions: rowCount(questions),
    synthetic_billing_entitlements: rowCount(billing),
    helper_documents: rowCount(helperDocs),
  };
  for (const [key, value] of Object.entries(counts)) {
    const minimum = key === 'users' ? 5 : key === 'published_items' ? 2 : 1;
    if (value < minimum) missing.push(key);
  }
  return {
    seeded: missing.length === 0,
    counts,
    missing,
    identities: labIdentities(),
  };
}

async function handleLabMutation(
  req: Request,
  res: Response,
  input: {
    config: AppConfig;
    pool: DbPool;
    session: SessionPorts;
  },
  mutation: () => Promise<'reseeded' | 'reset'>,
) {
  input.session.setPrivateNoStore(res);
  if (!isPortalTestLabEnabled(input.config)) {
    res.status(404).type('text').send('Portal Test Lab is unavailable.');
    return;
  }
  const session = await requireOwnerAdminSession(req, res, input);
  if (!session) return;
  if (!(await input.session.requireSessionCsrf(req, res, session))) return;
  const status = await mutation();
  res.redirect(303, `${W12_PORTAL_TEST_LAB_ROUTE}?status=${status}`);
}

async function requireOwnerAdminSession(
  req: Request,
  res: Response,
  input: { config: AppConfig; session: SessionPorts },
) {
  const session = await input.session.sessionFromRequest(req);
  if (!session) {
    res.redirect(302, `/login?return_to=${encodeURIComponent(W12_PORTAL_TEST_LAB_ROUTE)}`);
    return null;
  }
  if (session.user.role !== 'owner' && session.user.role !== 'admin') {
    input.session.setPrivateNoStore(res);
    res.status(403).type('html').send(portalTestLabForbiddenHtml());
    return null;
  }
  return session;
}

async function seedPortalLabClassAndContent(input: { pool: DbPool; config: AppConfig }) {
  await input.pool.query(
    `INSERT INTO onetime.class_series
       (class_series_key, account_key, product_key, title, timezone, local_start_time,
        reminder_local_time, status)
     VALUES ($1,$2,$3,'W12 Portal Lab Mishnah','Asia/Jerusalem','19:00','18:30','active')
     ON CONFLICT (account_key, product_key, class_series_key)
     DO UPDATE SET title = EXCLUDED.title, status = 'active', updated_at = now()`,
    [W12_PORTAL_TEST_LAB.classSeriesKey, input.config.accountKey, input.config.productKey],
  );
  await input.pool.query(
    `INSERT INTO onetime.class_occurrences
       (occurrence_key, account_key, product_key, class_series_key, local_class_date,
        starts_at, reminder_due_at, joinable_until, occurrence_state, access_state,
        attendance_state, recording_state, join_opens_at, join_closes_at, scheduled_ends_at)
     VALUES ($1,$2,$3,$4,'2026-07-20',$5,$6,$7,'scheduled','provider_unavailable',
        'open','available',$6,$7,$8)
     ON CONFLICT (occurrence_key)
     DO UPDATE SET occurrence_state = 'scheduled',
                   access_state = 'provider_unavailable',
                   attendance_state = 'open',
                   recording_state = 'available',
                   starts_at = EXCLUDED.starts_at,
                   reminder_due_at = EXCLUDED.reminder_due_at,
                   joinable_until = EXCLUDED.joinable_until,
                   join_opens_at = EXCLUDED.join_opens_at,
                   join_closes_at = EXCLUDED.join_closes_at,
                   scheduled_ends_at = EXCLUDED.scheduled_ends_at,
                   updated_at = now()`,
    [
      W12_PORTAL_TEST_LAB.occurrenceKey,
      input.config.accountKey,
      input.config.productKey,
      W12_PORTAL_TEST_LAB.classSeriesKey,
      new Date('2026-07-20T16:00:00.000Z'),
      new Date('2026-07-20T15:45:00.000Z'),
      new Date('2026-07-20T17:15:00.000Z'),
      new Date('2026-07-20T17:00:00.000Z'),
    ],
  );
  await input.pool.query(
    `INSERT INTO onetime.content_items
       (content_item_key, account_key, product_key, occurrence_key, title, item_type,
        lifecycle_state, latest_revision_number, latest_revision_key, published_revision_key,
        published_at)
     VALUES
       ($1,$3,$4,$5,'W12 Fictional Recording','video','published',1,$6,$6,now()),
       ($2,$3,$4,$5,'W12 Fictional Review Sheet','review','published',1,$7,$7,now())
     ON CONFLICT (account_key, product_key, content_item_key)
     DO UPDATE SET title = EXCLUDED.title,
                   item_type = EXCLUDED.item_type,
                   lifecycle_state = 'published',
                   latest_revision_number = 1,
                   latest_revision_key = EXCLUDED.latest_revision_key,
                   published_revision_key = EXCLUDED.published_revision_key,
                   published_at = EXCLUDED.published_at,
                   updated_at = now()`,
    [
      W12_PORTAL_TEST_LAB.recordingKey,
      W12_PORTAL_TEST_LAB.reviewKey,
      input.config.accountKey,
      input.config.productKey,
      W12_PORTAL_TEST_LAB.occurrenceKey,
      `${W12_PORTAL_TEST_LAB.recordingKey}_rev1`,
      `${W12_PORTAL_TEST_LAB.reviewKey}_rev1`,
    ],
  );
  await input.pool.query(
    `INSERT INTO onetime.content_revisions
       (revision_key, account_key, product_key, content_item_key, outcome_event_key,
        revision_number, lifecycle_state, published_at)
     VALUES
       ($1,$3,$4,$5,$6,1,'published',now()),
       ($2,$3,$4,$7,$8,1,'published',now())
     ON CONFLICT (revision_key)
     DO UPDATE SET lifecycle_state = 'published', published_at = EXCLUDED.published_at`,
    [
      `${W12_PORTAL_TEST_LAB.recordingKey}_rev1`,
      `${W12_PORTAL_TEST_LAB.reviewKey}_rev1`,
      input.config.accountKey,
      input.config.productKey,
      W12_PORTAL_TEST_LAB.recordingKey,
      `${W12_PORTAL_TEST_LAB.recordingKey}_outcome`,
      W12_PORTAL_TEST_LAB.reviewKey,
      `${W12_PORTAL_TEST_LAB.reviewKey}_outcome`,
    ],
  );
  await input.pool.query(
    `INSERT INTO onetime.content_item_entitlements
       (entitlement_key, account_key, product_key, content_item_key, audience, household_key,
        learner_key, entitlement_state)
     VALUES
       ('w12_recording_all_active',$1,$2,$3,'all_active_learners',NULL,NULL,'active'),
       ('w12_review_all_active',$1,$2,$4,'all_active_learners',NULL,NULL,'active')
     ON CONFLICT (account_key, product_key, entitlement_key)
     DO UPDATE SET entitlement_state = 'active', revoked_at = NULL`,
    [
      input.config.accountKey,
      input.config.productKey,
      W12_PORTAL_TEST_LAB.recordingKey,
      W12_PORTAL_TEST_LAB.reviewKey,
    ],
  );
  await input.pool.query(
    `INSERT INTO onetime.classroom_household_entitlements
       (entitlement_key, account_key, product_key, household_key, entitlement_state, source)
     VALUES ('w12_classroom_entitlement',$1,$2,$3,'active','w12_test_fixture')
     ON CONFLICT (entitlement_key)
     DO UPDATE SET entitlement_state = 'active', source = 'w12_test_fixture', updated_at = now()`,
    [input.config.accountKey, input.config.productKey, W12_PORTAL_TEST_LAB.householdKey],
  );
}

async function seedPortalLabActivity(
  input: { pool: DbPool; config: AppConfig },
  parentUserKey: string,
  studentUserKeys: string[],
) {
  for (const [index, learner] of W12_PORTAL_TEST_LAB.learners.entries()) {
    const ordinal = index + 1;
    await input.pool.query(
      `INSERT INTO onetime.class_attendance_marks
         (attendance_key, account_key, product_key, occurrence_key, learner_key,
          attendance_state, source, metadata, recorded_at)
       VALUES ($1,$2,$3,$4,$5,'present','portal',$6::jsonb,$7)
       ON CONFLICT (account_key, product_key, occurrence_key, learner_key)
       DO UPDATE SET attendance_state = 'present',
                     source = 'portal',
                     metadata = EXCLUDED.metadata,
                     recorded_at = EXCLUDED.recorded_at`,
      [
        `w12_attendance_${ordinal}`,
        input.config.accountKey,
        input.config.productKey,
        W12_PORTAL_TEST_LAB.occurrenceKey,
        learner.learnerKey,
        JSON.stringify({ fixture: 'W12-03', synthetic: true }),
        new Date('2026-07-20T16:35:00.000Z'),
      ],
    );
    await input.pool.query(
      `INSERT INTO onetime.portal_reward_events
         (reward_event_key, account_key, product_key, household_key, learner_key,
          points_delta, reason_code, reason_label, actor_ref, source_type,
          idempotency_key, request_hash, metadata)
       VALUES ($1,$2,$3,$4,$5,5,'attendance','W12 attendance reward',$6,'system',$7,$8,$9::jsonb)
       ON CONFLICT (account_key, product_key, learner_key, idempotency_key)
       DO UPDATE SET points_delta = EXCLUDED.points_delta,
                     reason_label = EXCLUDED.reason_label,
                     metadata = EXCLUDED.metadata`,
      [
        `w12_reward_${ordinal}`,
        input.config.accountKey,
        input.config.productKey,
        W12_PORTAL_TEST_LAB.householdKey,
        learner.learnerKey,
        parentUserKey,
        `w12_reward_${ordinal}`,
        sha256Hex(`w12_reward_${ordinal}`),
        JSON.stringify({ fixture: 'W12-03', synthetic: true }),
      ],
    );
    await input.pool.query(
      `INSERT INTO onetime.portal_administrative_updates
         (update_key, account_key, product_key, household_key, learner_key, audience,
          title, body, status, published_at)
       VALUES ($1,$2,$3,$4,$5,'both',$6,$7,'published',$8)
       ON CONFLICT (update_key)
       DO UPDATE SET title = EXCLUDED.title,
                     body = EXCLUDED.body,
                     status = 'published',
                     published_at = EXCLUDED.published_at,
                     updated_at = now()`,
      [
        `w12_update_${ordinal}`,
        input.config.accountKey,
        input.config.productKey,
        W12_PORTAL_TEST_LAB.householdKey,
        learner.learnerKey,
        'W12 lab assignment ready',
        'This fictional learner has a recording, review sheet, progress, reward, and private question example.',
        new Date('2026-07-20T17:20:00.000Z'),
      ],
    );
    await input.pool.query(
      `INSERT INTO onetime.portal_student_questions
         (question_key, account_key, product_key, household_key, learner_key,
          submitted_by_user_ref, class_key, question_text, question_status, answer_preview,
          answered_at, idempotency_key, request_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'answered',$9,$10,$11,$12)
       ON CONFLICT (account_key, product_key, learner_key, idempotency_key)
       DO UPDATE SET question_text = EXCLUDED.question_text,
                     question_status = 'answered',
                     answer_preview = EXCLUDED.answer_preview,
                     answered_at = EXCLUDED.answered_at,
                     updated_at = now()`,
      [
        `w12_question_${ordinal}`,
        input.config.accountKey,
        input.config.productKey,
        W12_PORTAL_TEST_LAB.householdKey,
        learner.learnerKey,
        studentUserKeys[index],
        W12_PORTAL_TEST_LAB.occurrenceKey,
        'What should I review before the next fictional class?',
        'Review the fictional Mishnah terms and bring one prepared example.',
        new Date('2026-07-20T17:25:00.000Z'),
        `w12_question_${ordinal}`,
        sha256Hex(`w12_question_${ordinal}`),
      ],
    );
  }
}

async function seedPortalLabBilling(input: { pool: DbPool; config: AppConfig }) {
  await input.pool.query(
    `INSERT INTO onetime.billing_entitlement_projections
       (entitlement_key, account_key, product_key, principal_key, principal_type, status,
        policy_version, source, reason, effective_at, evaluated_at, grants_access)
     VALUES ('w12_billing_entitlement',$1,$2,$3,'opaque','active','w12-test-policy',
        'w12_test_fixture','active_synthetic_test_subscription',$4,$5,true)
     ON CONFLICT (entitlement_key)
     DO UPDATE SET status = 'active',
                   source = 'w12_test_fixture',
                   reason = 'active_synthetic_test_subscription',
                   effective_at = EXCLUDED.effective_at,
                   evaluated_at = EXCLUDED.evaluated_at,
                   grants_access = true,
                   updated_at = now()`,
    [
      input.config.accountKey,
      input.config.productKey,
      W12_PORTAL_TEST_LAB.householdKey,
      new Date('2026-07-17T12:00:00.000Z'),
      new Date('2026-07-17T12:00:01.000Z'),
    ],
  );
  await input.pool.query(
    `INSERT INTO onetime.billing_subscription_projections
       (account_key, product_key, principal_key, principal_type, provider, mode,
        provider_account_ref, provider_customer_ref, provider_subscription_ref, status,
        current_period_start, current_period_end, provider_updated_at, source_event_key,
        latest_invoice_ref, collection_state)
     VALUES ($1,$2,$3,'opaque','stripe','test','acct_w12_fixture','cus_w12_fixture',
        'sub_w12_fixture_test','active',$4,$5,$6,'evt_w12_fixture_paid_test',
        'in_w12_fixture_test','paid')
     ON CONFLICT (account_key, product_key, provider, mode, provider_subscription_ref)
     DO UPDATE SET status = 'active',
                   current_period_start = EXCLUDED.current_period_start,
                   current_period_end = EXCLUDED.current_period_end,
                   provider_updated_at = EXCLUDED.provider_updated_at,
                   latest_invoice_ref = EXCLUDED.latest_invoice_ref,
                   collection_state = 'paid',
                   updated_at = now()`,
    [
      input.config.accountKey,
      input.config.productKey,
      W12_PORTAL_TEST_LAB.householdKey,
      new Date('2026-07-17T12:00:00.000Z'),
      new Date('2026-08-17T12:00:00.000Z'),
      new Date('2026-07-17T12:00:02.000Z'),
    ],
  );
}

async function seedPortalLabHelperContent(input: { pool: DbPool; config: AppConfig }) {
  const tenantId = tenantIdFor(input.config);
  const sectionText =
    'This fictional Mishnah lesson reviews the first case, the key terms, and the example students should prepare before the next class.';
  const sectionSha = sha256Hex(sectionText);
  await input.pool.query(
    `INSERT INTO onetime.ot86_published_content_versions
       (tenant_id, content_id, version_id, sequence, action, canonical_path, source_sha256,
        manifest_sha256, approval_json, privacy_json, active_state, published_at)
     VALUES ($1,$2,$3,1,'publish','/app/student',$4,$5,$6::jsonb,$7::jsonb,'active',$8)
     ON CONFLICT (tenant_id, content_id, version_id)
     DO UPDATE SET active_state = 'active',
                   source_sha256 = EXCLUDED.source_sha256,
                   manifest_sha256 = EXCLUDED.manifest_sha256,
                   approval_json = EXCLUDED.approval_json,
                   privacy_json = EXCLUDED.privacy_json,
                   updated_at = now()`,
    [
      tenantId,
      W12_PORTAL_TEST_LAB.recordingKey,
      W12_PORTAL_TEST_LAB.helperVersionId,
      sha256Hex('w12-helper-source'),
      sha256Hex('w12-helper-manifest'),
      JSON.stringify({ approved_by: 'w12_fixture', synthetic: true }),
      JSON.stringify({ learner_safe: true, production_data: false }),
      new Date('2026-07-17T12:05:00.000Z'),
    ],
  );
  await input.pool.query(
    `INSERT INTO onetime.ot86_published_sections
       (tenant_id, content_id, version_id, section_id, title, ordinal, start_ms, end_ms,
        canonical_path, deep_link, text_sha256, active)
     VALUES ($1,$2,$3,'w12_section_001','W12 fictional review section',0,0,60000,
        '/app/student','/app/student#w12-section-001',$4,true)
     ON CONFLICT (tenant_id, version_id, section_id)
     DO UPDATE SET title = EXCLUDED.title,
                   text_sha256 = EXCLUDED.text_sha256,
                   active = true`,
    [tenantId, W12_PORTAL_TEST_LAB.recordingKey, W12_PORTAL_TEST_LAB.helperVersionId, sectionSha],
  );
  await input.pool.query(
    `INSERT INTO onetime.ot86_search_documents
       (tenant_id, content_id, version_id, section_id, document_id, title, body,
        token_count, document_sha256, active)
     VALUES ($1,$2,$3,'w12_section_001','w12_doc_001','W12 fictional review section',
        $4,18,$5,true)
     ON CONFLICT (tenant_id, version_id, document_id)
     DO UPDATE SET body = EXCLUDED.body,
                   document_sha256 = EXCLUDED.document_sha256,
                   active = true,
                   updated_at = now()`,
    [
      tenantId,
      W12_PORTAL_TEST_LAB.recordingKey,
      W12_PORTAL_TEST_LAB.helperVersionId,
      sectionText,
      sha256Hex(sectionText),
    ],
  );
}

function portalTestLabHtml(status: PortalTestLabStatus, csrfToken: string, flash: string | null) {
  const counts = Object.entries(status.counts)
    .map(
      ([label, value]) =>
        `<li><span>${escapeHtml(label.replaceAll('_', ' '))}</span><strong>${value}</strong></li>`,
    )
    .join('');
  const missing = status.missing.length
    ? `<ul>${status.missing.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '<p>All W12-03 lab fixtures are present.</p>';
  const identities = status.identities
    .map(
      (identity) => `<tr>
        <td>${escapeHtml(identity.role)}</td>
        <td>${escapeHtml(identity.label)}</td>
        <td>${escapeHtml(identity.email)}</td>
        <td>${identity.learner_key ? escapeHtml(identity.learner_key) : 'n/a'}</td>
        <td><a class="button-secondary" href="${escapeHtml(identity.route)}">Login page</a></td>
      </tr>`,
    )
    .join('');
  const flashHtml = flash
    ? `<p class="state-panel success" role="status">${escapeHtml(flash)}</p>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>W12 Portal Test Lab | One Time Mishnayos</title>
  <meta name="robots" content="noindex, nofollow">
  <meta name="theme-color" content="#050505">
  <link rel="stylesheet" href="/assets/app-crm.css">
</head>
<body>
  <main class="app-workspace" id="app-main">
    <section class="state-panel" aria-labelledby="lab-title">
      <p>One Time Mishnayos</p>
      <h1 id="lab-title">W12 Portal Test Lab</h1>
      <p>Owner/admin-only synthetic portal lab. Current passwords, one-time tokens, provider URLs, and production users are not shown here.</p>
      ${flashHtml}
    </section>
    <section class="state-panel" aria-labelledby="lab-status-heading">
      <h2 id="lab-status-heading">Lab Status</h2>
      <p><strong>${status.seeded ? 'Ready' : 'Needs reseed'}</strong></p>
      ${missing}
      <ul>${counts}</ul>
      <form method="post" action="${W12_PORTAL_TEST_LAB_ROUTE}/reseed">
        <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}">
        <button type="submit" class="button-primary">Re-seed test lab</button>
      </form>
      <form method="post" action="${W12_PORTAL_TEST_LAB_ROUTE}/reset">
        <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}">
        <button type="submit" class="button-secondary">Reset lab state</button>
      </form>
    </section>
    <section class="state-panel" aria-labelledby="lab-identities-heading">
      <h2 id="lab-identities-heading">Fictional Identities</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Role</th>
            <th scope="col">Label</th>
            <th scope="col">Email</th>
            <th scope="col">Learner</th>
            <th scope="col">Safe link</th>
          </tr>
        </thead>
        <tbody>${identities}</tbody>
      </table>
    </section>
    <section class="state-panel" aria-labelledby="lab-boundaries-heading">
      <h2 id="lab-boundaries-heading">Boundaries</h2>
      <ul>
        <li>Parent and student sessions are separate logins.</li>
        <li>The parent route cannot enter a learner session.</li>
        <li>Each learner login resolves from the signed-in student account only.</li>
        <li>Billing is synthetic Stripe test fixture data only.</li>
        <li>No production user, database, delivery, payment, or provider mutation is performed.</li>
      </ul>
    </section>
  </main>
</body>
</html>`;
}

function portalTestLabForbiddenHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Access unavailable | One Time Mishnayos</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="stylesheet" href="/assets/app-crm.css">
</head>
<body>
  <main class="app-workspace">
    <section class="state-panel error" aria-labelledby="portal-test-lab-forbidden-title">
      <h1 id="portal-test-lab-forbidden-title">Portal Test Lab access unavailable</h1>
      <p>This protected test-only page requires an owner or admin session.</p>
      <a class="button-primary" href="/login?return_to=${encodeURIComponent(W12_PORTAL_TEST_LAB_ROUTE)}">Sign in</a>
    </section>
  </main>
</body>
</html>`;
}

function labIdentities(): PortalTestLabStatus['identities'] {
  return [
    {
      role: 'admin',
      label: W12_PORTAL_TEST_LAB.admin.displayName,
      email: W12_PORTAL_TEST_LAB.admin.email,
      learner_key: null,
      route: `/login?return_to=${encodeURIComponent(W12_PORTAL_TEST_LAB_ROUTE)}`,
    },
    {
      role: 'parent',
      label: W12_PORTAL_TEST_LAB.parent.displayName,
      email: W12_PORTAL_TEST_LAB.parent.email,
      learner_key: null,
      route: '/login?return_to=%2Fapp%2Fparent',
    },
    ...W12_PORTAL_TEST_LAB.learners.map((learner) => ({
      role: 'student' as const,
      label: learner.displayName,
      email: learner.email,
      learner_key: learner.learnerKey,
      route: '/login?return_to=%2Fapp%2Fstudent',
    })),
  ];
}

function rowCount(result: { rows: Array<Record<string, unknown>> }) {
  return Number(result.rows[0]?.count ?? 0);
}

function labPassword(envKey: string, fallback: string) {
  const value = process.env[envKey];
  return value && value.length >= 12 ? value : fallback;
}

function flashFromQuery(req: Request) {
  if (req.query.status === 'reseeded') return 'W12 Portal Test Lab was re-seeded.';
  if (req.query.status === 'reset') return 'W12 Portal Test Lab state was reset.';
  return null;
}

function tenantIdFor(config: Pick<AppConfig, 'accountKey'>) {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(config.accountKey)
    ? config.accountKey
    : `acct_${sha256Hex(config.accountKey).slice(0, 32)}`;
}

function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
