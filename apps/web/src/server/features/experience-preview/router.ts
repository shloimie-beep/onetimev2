import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../../../../../../packages/config/src/index.ts';
import {
  experiencePreviewCatalogSchema,
  experiencePreviewResponseSchema,
  fictionalStudentSessionResponseSchema,
  type ExperiencePreviewCatalog,
  type ExperiencePreviewRole,
  type ExperiencePreviewRoleId,
  type ExperiencePreviewState,
} from '../../../../../../packages/contracts/src/index.ts';
import type { DbPool } from '../../../../../../packages/db/src/index.ts';
import type { AuthenticatedSession } from '../../../../../../packages/domain/src/index.ts';

type SessionPorts = {
  sessionFromRequest(req: Request): Promise<AuthenticatedSession | null>;
  requireSessionCsrf(req: Request, res: Response, session: AuthenticatedSession): Promise<boolean>;
  setPrivateNoStore(res: Response): void;
};

type FictionalRoleId = 'student_1' | 'student_2' | 'student_3';

type IdentityProof = {
  roleId: FictionalRoleId;
  learnerKey: string;
  displayName: string;
  gradeLabel: string;
  eligible: boolean;
};

type ProgressProof = {
  ready: boolean;
  points: number | null;
};

type PreviewSessionRecord = {
  previewSessionKey: string;
  adminUserRef: string;
  adminSessionKey: string;
  roleId: FictionalRoleId;
  learnerKey: string;
  routeHandle: string;
  expiresAt: string;
};

const sessionRequestSchema = z.object({
  role_id: z.enum(['student_1', 'student_2', 'student_3']),
  csrf_token: z.string().trim().min(16).max(240),
});

const exchangeIdSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

const SCENARIO_KEY = 'full_app_preview_scenario';
const HOUSEHOLD_KEY = 'full_app_preview_household';
const CLASS_SERIES_KEY = 'class_series_one_time_daily';
const CONTENT_ITEM_KEY = 'full_app_demo_mishnayos_video';
const CONTENT_REVISION_KEY = 'full_app_demo_mishnayos_video_rev_1';
const LESSON_KEY = 'full_app_demo_mishnayos_lesson';
const VIMEO_SOURCE_KEY = 'full_app_private_vimeo_demo_source';
const PROVISIONER_MARKER = 'full_app_staging_provisioner_v1';
const PREVIEW_COOKIE = 'ot_experience_preview';
const PREVIEW_COOKIE_PATH = '/app/experience-preview/student';
const EXCHANGE_TTL_MS = 60_000;
const PREVIEW_SESSION_TTL_MS = 5 * 60_000;

const FICTIONAL_STUDENTS = [
  {
    roleId: 'student_1',
    learnerKey: 'full_app_preview_student_1',
    accessStateKey: 'full_app_preview_student_1_access',
    username: 'otdemo1',
    displayName: 'Ari Cohen',
    gradeLabel: 'Grade 6',
    points: 25,
    index: 1,
  },
  {
    roleId: 'student_2',
    learnerKey: 'full_app_preview_student_2',
    accessStateKey: 'full_app_preview_student_2_access',
    username: 'otdemo2',
    displayName: 'Dovid Cohen',
    gradeLabel: 'Grade 4',
    points: 20,
    index: 2,
  },
  {
    roleId: 'student_3',
    learnerKey: 'full_app_preview_student_3',
    accessStateKey: 'full_app_preview_student_3_access',
    username: 'otdemo3',
    displayName: 'Noam Cohen',
    gradeLabel: 'Grade 2',
    points: 15,
    index: 3,
  },
] as const;

export const EXPERIENCE_PREVIEW_ROUTE = '/app/experience-preview';
export const EXPERIENCE_PREVIEW_API_ROUTE = '/api/v1/experience-preview';
export const FICTIONAL_STUDENT_EXCHANGE_CREATE_ROUTE =
  '/api/v1/experience-preview/student-exchanges';
export const FICTIONAL_STUDENT_EXCHANGE_ROUTE = '/app/experience-preview/student/exchange';
export const FICTIONAL_STUDENT_SESSION_ROUTE = '/app/experience-preview/student';

export function fictionalStudentSessionRoute(routeHandle: string) {
  return `${FICTIONAL_STUDENT_SESSION_ROUTE}/${routeHandle}`;
}

export function fictionalStudentProjectionRoute(routeHandle: string) {
  return `${fictionalStudentSessionRoute(routeHandle)}/projection`;
}

export function isExperiencePreviewEnabled(config: AppConfig) {
  return (
    config.experiencePreviewEnabled === true &&
    config.deliveryEnvironment !== 'production' &&
    (config.oneTimeRuntimeEnvironment === 'isolated_staging' ||
      config.oneTimeRuntimeEnvironment === 'test')
  );
}

export function isLiveConsoleNavigationEnabled(config: AppConfig) {
  if (config.deliveryEnvironment === 'production') {
    return (
      config.zoomClassroomProviderMode === 'real' &&
      config.zoomClassroomRealProviderEnabled &&
      config.zoomMeetingSdkClientIdConfigured &&
      config.zoomMeetingSdkClientSecretConfigured &&
      config.zoomMeetingSdkWebVersionConfigured &&
      config.zoomS2sAccountIdConfigured &&
      config.zoomS2sClientIdConfigured &&
      config.zoomS2sClientSecretConfigured
    );
  }
  return config.liveClassFakeAdapterEnabled;
}

export function registerExperiencePreviewRoutes(input: {
  app: Express;
  config: AppConfig;
  pool: DbPool;
  distDir: string;
  session: SessionPorts;
  clock?: () => Date;
}) {
  const now = input.clock ?? (() => new Date());

  input.app.get(EXPERIENCE_PREVIEW_API_ROUTE, async (req, res) => {
    setPreviewResponseHeaders(res, input.session);
    if (!isExperiencePreviewEnabled(input.config)) {
      res.status(404).json({ success: false, code: 'experience_preview_unavailable' });
      return;
    }
    const session = await requireOwnerAdmin(req, res, input);
    if (!session) return;
    const catalog = await buildExperiencePreviewCatalog(input.pool, input.config);
    await recordPreviewAudit(input.pool, input.config, {
      userKey: session.user.user_key,
      role: session.user.role,
      actionType: 'experience_preview_viewed',
      metadata: { fictional: true, read_only: true, role_count: catalog.roles.length },
    });
    res.status(200).json(experiencePreviewResponseSchema.parse({ success: true, data: catalog }));
  });

  input.app.post(FICTIONAL_STUDENT_EXCHANGE_CREATE_ROUTE, async (req, res) => {
    setPreviewResponseHeaders(res, input.session);
    if (!isExperiencePreviewEnabled(input.config)) {
      res.status(404).json({ success: false, code: 'experience_preview_unavailable' });
      return;
    }
    const session = await requireOwnerAdmin(req, res, input);
    if (!session) return;
    if (!(await input.session.requireSessionCsrf(req, res, session))) return;
    const payload = sessionRequestSchema.safeParse(req.body);
    if (!payload.success) {
      res.status(400).json({ success: false, code: 'fictional_student_role_required' });
      return;
    }
    const identity = await loadFictionalIdentityProof(
      input.pool,
      input.config,
      payload.data.role_id,
    );
    if (!identity.eligible) {
      res.status(409).json({
        success: false,
        code: 'fictional_student_unavailable',
        message: 'The exact fictional Student seed is unavailable.',
      });
      return;
    }
    const exchangeId = randomBytes(32).toString('base64url');
    const issuedAt = now();
    const expiresAt = new Date(issuedAt.getTime() + EXCHANGE_TTL_MS);
    await input.pool.query(
      `INSERT INTO onetime.experience_preview_exchanges
         (exchange_digest, account_key, product_key, admin_user_ref, admin_session_key,
          role_id, fictional_learner_key, expires_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        opaqueDigest(exchangeId),
        input.config.accountKey,
        input.config.productKey,
        session.user.user_key,
        session.session_key,
        identity.roleId,
        identity.learnerKey,
        expiresAt,
        issuedAt,
      ],
    );
    await recordPreviewAudit(input.pool, input.config, {
      userKey: session.user.user_key,
      role: session.user.role,
      actionType: 'fictional_student_preview_exchange_issued',
      metadata: {
        role_id: identity.roleId,
        fictional_learner_key: identity.learnerKey,
        admin_session_key_digest: opaqueDigest(session.session_key),
        expires_at: expiresAt.toISOString(),
      },
    });
    res.status(201).json({
      success: true,
      exchange_url: `${FICTIONAL_STUDENT_EXCHANGE_ROUTE}?exchange_id=${encodeURIComponent(exchangeId)}`,
      expires_at: expiresAt.toISOString(),
    });
  });

  input.app.get(FICTIONAL_STUDENT_EXCHANGE_ROUTE, async (req, res) => {
    setPreviewResponseHeaders(res, input.session);
    if (!isExperiencePreviewEnabled(input.config)) {
      res.status(404).type('text').send('Experience Preview is unavailable.');
      return;
    }
    const exchangeId = exchangeIdSchema.safeParse(req.query.exchange_id);
    if (!exchangeId.success) {
      res.status(404).type('text').send('Preview exchange unavailable.');
      return;
    }
    const adminSession = await input.session.sessionFromRequest(req);
    if (
      !adminSession ||
      (adminSession.user.role !== 'owner' && adminSession.user.role !== 'admin')
    ) {
      res.status(404).type('text').send('Preview exchange unavailable.');
      return;
    }
    const exchangeDigest = opaqueDigest(exchangeId.data);
    const exchangeLookup = await input.pool.query(
      `SELECT admin_user_ref, admin_session_key, role_id, fictional_learner_key,
              expires_at, consumed_at
         FROM onetime.experience_preview_exchanges
        WHERE exchange_digest = $1 AND account_key = $2 AND product_key = $3`,
      [exchangeDigest, input.config.accountKey, input.config.productKey],
    );
    const exchange = exchangeLookup.rows[0] as Record<string, unknown> | undefined;
    if (
      !exchange ||
      exchange.admin_user_ref !== adminSession.user.user_key ||
      exchange.admin_session_key !== adminSession.session_key
    ) {
      res.status(404).type('text').send('Preview exchange unavailable.');
      return;
    }
    const currentTime = now();
    if (
      exchange.consumed_at ||
      new Date(String(exchange.expires_at)).getTime() <= currentTime.getTime()
    ) {
      res.status(410).type('text').send('Preview exchange expired or already used.');
      return;
    }
    const roleId = String(exchange.role_id) as FictionalRoleId;
    const identity = await loadFictionalIdentityProof(input.pool, input.config, roleId);
    if (!identity.eligible || identity.learnerKey !== exchange.fictional_learner_key) {
      res.status(409).type('text').send('The fictional Student seed is unavailable.');
      return;
    }
    const consumed = await input.pool.query(
      `UPDATE onetime.experience_preview_exchanges
          SET consumed_at = $4
        WHERE exchange_digest = $1 AND account_key = $2 AND product_key = $3
          AND consumed_at IS NULL AND expires_at > $4
        RETURNING exchange_digest`,
      [exchangeDigest, input.config.accountKey, input.config.productKey, currentTime],
    );
    if (consumed.rowCount !== 1) {
      res.status(410).type('text').send('Preview exchange expired or already used.');
      return;
    }
    const previewToken = randomBytes(32).toString('base64url');
    const routeHandle = randomBytes(32).toString('base64url');
    const previewSessionKey = `exp_preview_${randomUUID()}`;
    const expiresAt = new Date(currentTime.getTime() + PREVIEW_SESSION_TTL_MS);
    await input.pool.query(
      `INSERT INTO onetime.experience_preview_sessions
         (preview_session_key, preview_token_digest, route_handle_digest, exchange_digest,
          account_key, product_key,
          admin_user_ref, admin_session_key, role_id, fictional_learner_key,
          expires_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        previewSessionKey,
        opaqueDigest(previewToken),
        opaqueDigest(routeHandle),
        exchangeDigest,
        input.config.accountKey,
        input.config.productKey,
        adminSession.user.user_key,
        adminSession.session_key,
        identity.roleId,
        identity.learnerKey,
        expiresAt,
        currentTime,
      ],
    );
    res.cookie(
      PREVIEW_COOKIE,
      previewToken,
      previewCookieOptions(routeHandle, PREVIEW_SESSION_TTL_MS),
    );
    await recordPreviewAudit(input.pool, input.config, {
      userKey: adminSession.user.user_key,
      role: adminSession.user.role,
      actionType: 'fictional_student_preview_exchange_consumed',
      metadata: {
        role_id: identity.roleId,
        fictional_learner_key: identity.learnerKey,
        preview_session_key: previewSessionKey,
        expires_at: expiresAt.toISOString(),
      },
    });
    res.redirect(303, fictionalStudentSessionRoute(routeHandle));
  });

  input.app.get(`${FICTIONAL_STUDENT_SESSION_ROUTE}/:routeHandle/projection`, async (req, res) => {
    setPreviewResponseHeaders(res, input.session);
    if (!isExperiencePreviewEnabled(input.config)) {
      res.status(404).json({ success: false, code: 'experience_preview_unavailable' });
      return;
    }
    const routeHandle = exchangeIdSchema.safeParse(req.params.routeHandle);
    if (!routeHandle.success) {
      res.status(404).json({ success: false, code: 'fictional_student_session_not_found' });
      return;
    }
    const previewSession = await previewSessionFromRequest(
      req,
      input.pool,
      input.config,
      now(),
      routeHandle.data,
    );
    if (!previewSession) {
      clearPreviewCookie(res, routeHandle.data);
      res.status(404).json({ success: false, code: 'fictional_student_session_not_found' });
      return;
    }
    const catalog = await buildExperiencePreviewCatalog(input.pool, input.config);
    const preview = catalog.previews.find((item) => item.role_id === previewSession.roleId);
    if (!preview || !preview.can_open_student_session) {
      res.status(409).json({ success: false, code: 'fictional_student_unavailable' });
      return;
    }
    await recordPreviewAudit(input.pool, input.config, {
      userKey: previewSession.adminUserRef,
      role: 'admin_preview',
      actionType: 'fictional_student_preview_projection_viewed',
      metadata: {
        preview_session_key: previewSession.previewSessionKey,
        admin_session_key_digest: opaqueDigest(previewSession.adminSessionKey),
        role_id: previewSession.roleId,
        fictional_learner_key: previewSession.learnerKey,
        read_only: true,
      },
    });
    res.status(200).json(
      fictionalStudentSessionResponseSchema.parse({
        success: true,
        expires_at: previewSession.expiresAt,
        preview,
      }),
    );
  });

  input.app.get(`${FICTIONAL_STUDENT_SESSION_ROUTE}/:routeHandle`, async (req, res) => {
    setPreviewResponseHeaders(res, input.session);
    if (!isExperiencePreviewEnabled(input.config)) {
      res.status(404).type('text').send('Experience Preview is unavailable.');
      return;
    }
    const routeHandle = exchangeIdSchema.safeParse(req.params.routeHandle);
    if (!routeHandle.success) {
      res.status(404).type('text').send('Fictional Student preview unavailable.');
      return;
    }
    const previewSession = await previewSessionFromRequest(
      req,
      input.pool,
      input.config,
      now(),
      routeHandle.data,
    );
    if (!previewSession) {
      clearPreviewCookie(res, routeHandle.data);
      res.status(404).type('text').send('Fictional Student preview unavailable.');
      return;
    }
    try {
      const html = await readFile(
        path.join(input.distDir, 'app', 'experience-preview-student.html'),
        'utf8',
      );
      res.status(200).type('html').send(html);
    } catch {
      res
        .status(500)
        .type('text')
        .send('Built fictional Student preview shell is unavailable. Run npm run build.');
    }
  });
}

export async function buildExperiencePreviewCatalog(
  pool: DbPool,
  config: AppConfig,
): Promise<ExperiencePreviewCatalog> {
  const scenarioResult = await pool.query(
    `SELECT scenario.occurrence_key, household.display_name AS household_name,
            household.status AS household_status, series.title AS class_title,
            series.status AS class_series_status, occurrence.starts_at,
            occurrence.occurrence_state, occurrence.access_state,
            occurrence.provider_meeting_state, occurrence.provider_meeting_ref_digest,
            occurrence.raw_zoom_join_url_present
       FROM onetime.experience_preview_scenarios scenario
       JOIN onetime.portal_households household
         ON household.account_key = scenario.account_key
        AND household.product_key = scenario.product_key
        AND household.household_key = scenario.household_key
       JOIN onetime.class_series series
         ON series.account_key = scenario.account_key
        AND series.product_key = scenario.product_key
        AND series.class_series_key = scenario.class_series_key
       JOIN onetime.class_occurrences occurrence
         ON occurrence.account_key = scenario.account_key
        AND occurrence.product_key = scenario.product_key
        AND occurrence.occurrence_key = scenario.occurrence_key
        AND occurrence.class_series_key = scenario.class_series_key
      WHERE scenario.account_key = $1 AND scenario.product_key = $2
        AND scenario.scenario_key = $3 AND scenario.household_key = $4
        AND scenario.class_series_key = $5 AND scenario.content_item_key = $6
        AND scenario.content_revision_key = $7 AND scenario.lesson_key = $8
        AND scenario.provisioner_marker = $9 AND scenario.eligibility_state = 'active'
      LIMIT 1`,
    [
      config.accountKey,
      config.productKey,
      SCENARIO_KEY,
      HOUSEHOLD_KEY,
      CLASS_SERIES_KEY,
      CONTENT_ITEM_KEY,
      CONTENT_REVISION_KEY,
      LESSON_KEY,
      PROVISIONER_MARKER,
    ],
  );
  const scenario = scenarioResult.rows[0] as Record<string, unknown> | undefined;
  const identities = await Promise.all(
    FICTIONAL_STUDENTS.map((student) => loadFictionalIdentityProof(pool, config, student.roleId)),
  );
  const occurrenceKey = scenario ? String(scenario.occurrence_key) : null;
  const [
    enrollmentResult,
    consentResult,
    contentResult,
    reviewQuestionsResult,
    questionResult,
    eventResult,
    zoomResult,
  ] = await Promise.all([
    pool.query(
      `SELECT entitlement_state
           FROM onetime.classroom_household_entitlements
          WHERE account_key = $1 AND product_key = $2
            AND entitlement_key = 'full_app_preview_classroom_entitlement'
            AND household_key = $3 AND source = 'full_app_staging_preview'
          LIMIT 1`,
      [config.accountKey, config.productKey, HOUSEHOLD_KEY],
    ),
    pool.query(
      `SELECT consent_status
           FROM onetime.portal_guardian_consents
          WHERE account_key = $1 AND product_key = $2
            AND consent_key = 'full_app_preview_classroom_consent'
            AND household_key = $3 AND consent_type = 'classroom_join'
          LIMIT 1`,
      [config.accountKey, config.productKey, HOUSEHOLD_KEY],
    ),
    occurrenceKey
      ? pool.query(
          `SELECT item.title, item.lifecycle_state, item.retention_state,
                    item.published_revision_key, revision.lifecycle_state AS revision_state,
                    revision.transcript_metadata, revision.review_sheet_metadata,
                    revision.playback_descriptor, revision.raw_provider_target_present,
                    lesson.publication_state, lesson.featured, lesson.transcript_state,
                    lesson.resource_count, lesson.raw_private_url_present,
                    lesson.vimeo_provider_ref_digest, media.media_state, media.safe_metadata_json
               FROM onetime.content_items item
               JOIN onetime.content_revisions revision
                 ON revision.account_key = item.account_key
                AND revision.product_key = item.product_key
                AND revision.content_item_key = item.content_item_key
                AND revision.revision_key = $5
               JOIN onetime.classroom_lesson_publications lesson
                 ON lesson.account_key = item.account_key
                AND lesson.product_key = item.product_key
                AND lesson.content_item_key = item.content_item_key
                AND lesson.lesson_key = $6
                AND lesson.occurrence_key = $4
                AND lesson.class_series_key = $7
               JOIN onetime.learning_delivery_media_sources media
                 ON media.account_key = item.account_key
                AND media.product_key = item.product_key
                AND media.source_key = $8
              WHERE item.account_key = $1 AND item.product_key = $2
                AND item.content_item_key = $3 AND item.occurrence_key = $4
              LIMIT 1`,
          [
            config.accountKey,
            config.productKey,
            CONTENT_ITEM_KEY,
            occurrenceKey,
            CONTENT_REVISION_KEY,
            LESSON_KEY,
            CLASS_SERIES_KEY,
            VIMEO_SOURCE_KEY,
          ],
        )
      : Promise.resolve({ rows: [], rowCount: 0 }),
    pool.query(
      `SELECT question_key, position, prompt, approval_state
           FROM onetime.experience_preview_review_questions
          WHERE account_key = $1 AND product_key = $2 AND scenario_key = $3
            AND content_revision_key = $4
            AND question_key IN (
              'full_app_preview_review_question_1',
              'full_app_preview_review_question_2',
              'full_app_preview_review_question_3'
            )
          ORDER BY position`,
      [config.accountKey, config.productKey, SCENARIO_KEY, CONTENT_REVISION_KEY],
    ),
    occurrenceKey
      ? pool.query(
          `SELECT question_key, status, learner_key
               FROM onetime.live_class_questions
              WHERE account_key = $1 AND product_key = $2
                AND question_key = 'full_app_preview_private_question'
                AND household_key = $3 AND learner_key = $4 AND occurrence_key = $5
              LIMIT 1`,
          [
            config.accountKey,
            config.productKey,
            HOUSEHOLD_KEY,
            FICTIONAL_STUDENTS[0].learnerKey,
            occurrenceKey,
          ],
        )
      : Promise.resolve({ rows: [], rowCount: 0 }),
    pool.query(
      `SELECT registration_key
           FROM onetime.event_registrations
          WHERE account_key = $1 AND product_key = $2
            AND registration_key = 'full_app_preview_tisha_registration'
            AND event_code = 'tisha-bav-2026'
            AND email_normalized = 'miriam.cohen@example.invalid'
            AND initial_source = 'full_app_staging_preview'
          LIMIT 1`,
      [config.accountKey, config.productKey],
    ),
    occurrenceKey
      ? pool.query(
          `SELECT provider_state, provider_meeting_ref_digest, raw_join_url_present,
                    protected_launch_required
               FROM onetime.classroom_session_provider_projection
              WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3
                AND provider = 'zoom'
                AND session_projection_key = $4
              LIMIT 1`,
          [
            config.accountKey,
            config.productKey,
            occurrenceKey,
            `full_app_preview_zoom_projection_${occurrenceKey}`,
          ],
        )
      : Promise.resolve({ rows: [], rowCount: 0 }),
  ]);

  const progress = await loadProgressProofs(pool, config, occurrenceKey);
  const householdReady =
    scenario?.household_status === 'active' && identities.every((identity) => identity.eligible);
  const enrollmentReady = enrollmentResult.rows[0]?.entitlement_state === 'active';
  const consentReady = consentResult.rows[0]?.consent_status === 'granted';
  const classState: ExperiencePreviewState =
    scenario &&
    scenario.class_series_status === 'active' &&
    ['scheduled', 'live'].includes(String(scenario.occurrence_state)) &&
    scenario.access_state === 'ready' &&
    enrollmentReady &&
    consentReady
      ? 'ready'
      : 'unavailable';
  const contentRow = contentResult.rows[0] as Record<string, unknown> | undefined;
  const approvedReviewQuestions = reviewQuestionsResult.rows.filter(
    (row) => row.approval_state === 'approved',
  );
  const contentState: ExperiencePreviewState =
    contentRow &&
    contentRow.lifecycle_state === 'published' &&
    contentRow.retention_state === 'active' &&
    contentRow.published_revision_key === CONTENT_REVISION_KEY &&
    contentRow.revision_state === 'published' &&
    contentRow.publication_state === 'published' &&
    contentRow.featured === true &&
    contentRow.transcript_state === 'available' &&
    Number(contentRow.resource_count) >= 1 &&
    contentRow.raw_private_url_present === false &&
    contentRow.raw_provider_target_present === false &&
    Boolean(contentRow.vimeo_provider_ref_digest) &&
    contentRow.media_state === 'published' &&
    safeJsonFlag(contentRow.safe_metadata_json, 'raw_private_url_present') === false &&
    safeJsonFlag(contentRow.transcript_metadata, 'raw_transcript_present') === false &&
    safeJsonFlag(contentRow.playback_descriptor, 'raw_url_present') === false &&
    approvedReviewQuestions.length === 3
      ? 'ready'
      : 'unavailable';
  const questionRow = questionResult.rows[0] as Record<string, unknown> | undefined;
  const questionReady = Boolean(
    questionRow &&
    ['submitted', 'selected', 'student_ready', 'live'].includes(String(questionRow.status)),
  );
  const eventReady = eventResult.rowCount === 1;
  const zoomState = resolveZoomState(config, scenario, zoomResult.rows[0]);
  const classTitle = scenario ? String(scenario.class_title) : 'Fictional class seed unavailable';
  const contentTitle = contentRow
    ? String(contentRow.title)
    : 'Fictional prepared lesson unavailable';
  const readyProgressCount = progress.filter((item) => item.ready).length;

  const roleCards = [
    card(
      'parent',
      'Parent',
      householdReady
        ? 'Miriam Cohen — exact household projection'
        : 'Fictional household unavailable',
      householdReady ? 'ready' : 'unavailable',
    ),
    ...identities.map((identity, index) =>
      card(
        identity.roleId,
        `Student ${index + 1}`,
        identity.eligible
          ? `${identity.displayName} — ${identity.gradeLabel}`
          : `Student ${index + 1} seed unavailable`,
        identity.eligible ? 'ready' : 'unavailable',
      ),
    ),
    card('rabbi_classroom', 'Rabbi/Classroom', classTitle, classState),
  ];

  const previews: ExperiencePreviewRole[] = [
    {
      role_id: 'parent',
      label: 'Parent',
      headline: householdReady
        ? `${String(scenario?.household_name)} household overview`
        : 'Fictional household unavailable',
      banner: 'Fictional staging projection. Read-only; no Parent session or mutation is created.',
      fictional: true,
      read_only: true,
      can_open_student_session: false,
      sections: [
        section('Household and credentials', [
          item(
            'Primary parent',
            householdReady ? 'Miriam Cohen' : 'Exact household seed unavailable',
            householdReady ? 'ready' : 'unavailable',
          ),
          item(
            'Separate Student credentials',
            `${identities.filter((identity) => identity.eligible).length}/3 exact credential markers`,
            identities.every((identity) => identity.eligible) ? 'ready' : 'unavailable',
          ),
          item(
            'Class enrollment',
            enrollmentReady
              ? 'Exact household entitlement active'
              : 'Exact entitlement unavailable',
            enrollmentReady ? 'ready' : 'unavailable',
          ),
        ]),
        section('Learning pipeline', [
          item('Exact class occurrence', classTitle, classState),
          item('Approved prepared lesson', contentTitle, contentState),
          item(
            'Attendance and rewards',
            `${readyProgressCount}/3 exact sibling projections`,
            readyProgressCount === 3 ? 'ready' : 'unavailable',
          ),
        ]),
        section('Tisha B’Av example', [
          item(
            'Exact registration',
            eventReady
              ? 'Miriam Cohen fictional registration recorded'
              : 'Exact fictional registration unavailable',
            eventReady ? 'ready' : 'unavailable',
          ),
        ]),
      ],
    },
    ...identities.map((identity, index) =>
      studentPreview({
        identity,
        classTitle,
        classState,
        contentTitle,
        contentState,
        progress: progress[index] ?? { ready: false, points: null },
        enrollmentReady,
        reviewQuestionCount: approvedReviewQuestions.length,
        questionReady: index === 0 && questionReady,
      }),
    ),
    {
      role_id: 'rabbi_classroom',
      label: 'Rabbi/Classroom',
      headline: `${classTitle} control room`,
      banner: 'Fictional staging projection. Controls remain on the dedicated Admin Live Console.',
      fictional: true,
      read_only: true,
      can_open_student_session: false,
      sections: [
        section('Classroom', [
          item(
            'Exact occurrence',
            scenario ? readableClassState(scenario) : 'Exact fictional occurrence unavailable',
            classState,
          ),
          item('Zoom', zoomLabel(zoomState), zoomState),
          item(
            'OBS bridge',
            config.liveClassFakeAdapterEnabled
              ? 'Isolated-staging control adapter ready'
              : 'Bridge unavailable',
            config.liveClassFakeAdapterEnabled ? 'ready' : 'unavailable',
          ),
        ]),
        section('Student questions', [
          item(
            'Exact private queue item',
            questionReady
              ? 'Ari Cohen fictional question ready for Rabbi review'
              : 'Exact fictional question unavailable',
            questionReady ? 'ready' : 'unavailable',
          ),
        ]),
        section('External bridges', [
          item(
            'Rabbi Telegram',
            telegramFoundationReady(config)
              ? 'Protected single-consumer canary contract ready'
              : 'Provider off',
            telegramFoundationReady(config) ? 'ready' : 'provider_off',
          ),
          item(
            'BNA Agent Actions',
            config.ot89SupportEnabled ? 'Configured' : 'Provider off',
            config.ot89SupportEnabled ? 'ready' : 'provider_off',
          ),
        ]),
      ],
    },
  ];

  return experiencePreviewCatalogSchema.parse({
    goal_id: 'OT-LAUNCH-01',
    scenario_title: 'The Cohen Family — One Time launch walkthrough',
    household_label: scenario ? String(scenario.household_name) : 'Fictional household unavailable',
    fictional: true,
    roles: roleCards,
    previews,
    safe_routes: {
      experience_preview: EXPERIENCE_PREVIEW_ROUTE,
      live_console: '/app/live-console',
      content_factory: '/app/content',
      classes: '/app/classes',
      vimeo_demo: '/app/learning-delivery/demo/vimeo-autotrim',
    },
  });
}

async function loadFictionalIdentityProof(
  pool: DbPool,
  config: AppConfig,
  roleId: FictionalRoleId,
): Promise<IdentityProof> {
  const expected = FICTIONAL_STUDENTS.find((student) => student.roleId === roleId);
  if (!expected) throw new Error(`Unknown fictional Student role ${roleId}.`);
  const result = await pool.query(
    `SELECT identity.role_id, identity.learner_key, identity.access_state_key,
            identity.expected_normalized_username, identity.household_key AS marker_household_key,
            identity.eligibility_state, identity.provisioner_marker,
            learner.display_name, learner.grade_label, learner.learner_status,
            learner.household_key AS learner_household_key,
            access.status AS access_status, access.credential_status,
            access.normalized_username, access.student_user_ref,
            access.household_key AS access_household_key,
            access.credential_policy_version,
            scenario.eligibility_state AS scenario_eligibility_state,
            scenario.household_key AS scenario_household_key,
            household.status AS household_status
       FROM onetime.experience_preview_fictional_identities identity
       JOIN onetime.experience_preview_scenarios scenario
         ON scenario.scenario_key = identity.scenario_key
        AND scenario.account_key = identity.account_key
        AND scenario.product_key = identity.product_key
       JOIN onetime.portal_households household
         ON household.account_key = identity.account_key
        AND household.product_key = identity.product_key
        AND household.household_key = identity.household_key
       JOIN onetime.portal_learners learner
         ON learner.account_key = identity.account_key
        AND learner.product_key = identity.product_key
        AND learner.learner_key = identity.learner_key
       JOIN onetime.portal_student_access_state access
         ON access.account_key = identity.account_key
        AND access.product_key = identity.product_key
        AND access.access_state_key = identity.access_state_key
        AND access.learner_key = identity.learner_key
      WHERE identity.account_key = $1 AND identity.product_key = $2
        AND identity.scenario_key = $3 AND identity.role_id = $4
        AND identity.identity_key = $5
      LIMIT 1`,
    [
      config.accountKey,
      config.productKey,
      SCENARIO_KEY,
      roleId,
      `full_app_preview_identity_${expected.index}`,
    ],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  const eligible = Boolean(
    row &&
    row.role_id === expected.roleId &&
    row.learner_key === expected.learnerKey &&
    row.access_state_key === expected.accessStateKey &&
    row.expected_normalized_username === expected.username &&
    row.normalized_username === expected.username &&
    row.marker_household_key === HOUSEHOLD_KEY &&
    row.learner_household_key === HOUSEHOLD_KEY &&
    row.access_household_key === HOUSEHOLD_KEY &&
    row.scenario_household_key === HOUSEHOLD_KEY &&
    row.provisioner_marker === PROVISIONER_MARKER &&
    row.display_name === expected.displayName &&
    row.grade_label === expected.gradeLabel &&
    row.eligibility_state === 'active' &&
    row.scenario_eligibility_state === 'active' &&
    row.household_status === 'active' &&
    row.learner_status === 'active' &&
    row.access_status === 'active' &&
    row.credential_status === 'parent_managed' &&
    row.credential_policy_version === 'ot-student-parent-managed-credentials-v1' &&
    Boolean(row.student_user_ref),
  );
  return {
    roleId,
    learnerKey: expected.learnerKey,
    displayName: eligible ? String(row?.display_name) : expected.displayName,
    gradeLabel: eligible ? String(row?.grade_label) : expected.gradeLabel,
    eligible,
  };
}

async function loadProgressProofs(pool: DbPool, config: AppConfig, occurrenceKey: string | null) {
  if (!occurrenceKey) {
    return FICTIONAL_STUDENTS.map((): ProgressProof => ({ ready: false, points: null }));
  }
  return Promise.all(
    FICTIONAL_STUDENTS.map(async (student): Promise<ProgressProof> => {
      const result = await pool.query(
        `SELECT attendance.attendance_state, reward.points_delta AS reward_points,
                leaderboard.points_delta AS leaderboard_points
           FROM onetime.class_attendance_marks attendance
           JOIN onetime.portal_reward_events reward
             ON reward.account_key = attendance.account_key
            AND reward.product_key = attendance.product_key
            AND reward.learner_key = attendance.learner_key
            AND reward.reward_event_key = $5
           JOIN onetime.classroom_leaderboard_events leaderboard
             ON leaderboard.account_key = attendance.account_key
            AND leaderboard.product_key = attendance.product_key
            AND leaderboard.learner_key = attendance.learner_key
            AND leaderboard.leaderboard_event_key = $6
            AND leaderboard.reward_event_key = reward.reward_event_key
            AND leaderboard.class_series_key = $7
          WHERE attendance.account_key = $1 AND attendance.product_key = $2
            AND attendance.occurrence_key = $3 AND attendance.learner_key = $4
            AND attendance.attendance_key = $8
          LIMIT 1`,
        [
          config.accountKey,
          config.productKey,
          occurrenceKey,
          student.learnerKey,
          `full_app_preview_reward_${student.index}`,
          `full_app_preview_leaderboard_${student.index}`,
          CLASS_SERIES_KEY,
          `full_app_preview_attendance_${occurrenceKey}_${student.index}`,
        ],
      );
      const row = result.rows[0] as Record<string, unknown> | undefined;
      const ready = Boolean(
        row &&
        row.attendance_state === 'present' &&
        Number(row.reward_points) === student.points &&
        Number(row.leaderboard_points) === student.points,
      );
      return { ready, points: ready ? student.points : null };
    }),
  );
}

function resolveZoomState(
  config: AppConfig,
  scenario: Record<string, unknown> | undefined,
  projection: Record<string, unknown> | undefined,
): ExperiencePreviewState {
  const activationGates =
    config.zoomClassroomProviderMode === 'real' &&
    config.zoomClassroomRealProviderEnabled &&
    config.zoomMeetingSdkClientIdConfigured &&
    config.zoomMeetingSdkClientSecretConfigured &&
    config.zoomMeetingSdkWebVersionConfigured &&
    config.zoomS2sAccountIdConfigured &&
    config.zoomS2sClientIdConfigured &&
    config.zoomS2sClientSecretConfigured;
  if (!activationGates) return 'provider_off';
  return scenario?.provider_meeting_state === 'ready' &&
    Boolean(scenario.provider_meeting_ref_digest) &&
    scenario.raw_zoom_join_url_present === false &&
    projection?.provider_state === 'ready' &&
    Boolean(projection.provider_meeting_ref_digest) &&
    projection.raw_join_url_present === false &&
    projection.protected_launch_required === true
    ? 'ready'
    : 'unavailable';
}

function studentPreview(input: {
  identity: IdentityProof;
  classTitle: string;
  classState: ExperiencePreviewState;
  contentTitle: string;
  contentState: ExperiencePreviewState;
  progress: ProgressProof;
  enrollmentReady: boolean;
  reviewQuestionCount: number;
  questionReady: boolean;
}): ExperiencePreviewRole {
  const identityState: ExperiencePreviewState = input.identity.eligible ? 'ready' : 'unavailable';
  return {
    role_id: input.identity.roleId,
    label: `Student ${Number(input.identity.roleId.slice(-1))}`,
    headline: input.identity.eligible
      ? `${input.identity.displayName}'s learning day`
      : 'Exact fictional Student seed unavailable',
    banner:
      'Fictional staging projection. Read-only; no Student cookie, mutation, or real learner access is used.',
    fictional: true,
    read_only: true,
    can_open_student_session: input.identity.eligible,
    sections: [
      section('Identity and access', [
        item(
          'Learner',
          input.identity.eligible
            ? `${input.identity.displayName} — ${input.identity.gradeLabel}`
            : 'Exact learner and credential marker unavailable',
          identityState,
        ),
        item(
          'Separate credential',
          input.identity.eligible
            ? 'Exact parent-managed credential active'
            : 'Credential unavailable',
          identityState,
        ),
        item(
          'Enrollment',
          input.enrollmentReady ? 'Exact household entitlement active' : 'Enrollment unavailable',
          input.enrollmentReady ? 'ready' : 'unavailable',
        ),
      ]),
      section('Today', [
        item('Exact class occurrence', input.classTitle, input.classState),
        item(
          'Classroom access',
          input.classState === 'ready'
            ? 'Protected launch only; no raw Zoom link'
            : 'Protected launch unavailable',
          input.classState,
        ),
      ]),
      section('Library and progress', [
        item('Approved prepared lesson', input.contentTitle, input.contentState),
        item(
          'Approved review questions',
          input.reviewQuestionCount === 3
            ? '3 exact approved questions'
            : `${input.reviewQuestionCount}/3 exact approved questions`,
          input.reviewQuestionCount === 3 ? 'ready' : 'unavailable',
        ),
        item(
          'Attendance and points',
          input.progress.ready
            ? `Present · ${input.progress.points} exact fictional learning points`
            : 'Exact attendance/reward projection unavailable',
          input.progress.ready ? 'ready' : 'unavailable',
        ),
      ]),
      section('Questions', [
        item(
          'Rabbi queue',
          input.questionReady
            ? 'Exact private fictional question submitted'
            : 'No exact private question awaiting review for this sibling',
          input.questionReady ? 'ready' : 'unavailable',
        ),
      ]),
    ],
  };
}

async function previewSessionFromRequest(
  req: Request,
  pool: DbPool,
  config: AppConfig,
  now: Date,
  routeHandle: string,
): Promise<PreviewSessionRecord | null> {
  const token = getCookie(req, PREVIEW_COOKIE);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const result = await pool.query(
    `SELECT preview.preview_session_key, preview.admin_user_ref, preview.admin_session_key,
            preview.role_id, preview.fictional_learner_key, preview.expires_at
       FROM onetime.experience_preview_sessions preview
       JOIN onetime.user_sessions admin_session
         ON admin_session.session_key = preview.admin_session_key
        AND admin_session.user_key = preview.admin_user_ref
        AND admin_session.account_key = preview.account_key
        AND admin_session.product_key = preview.product_key
      WHERE preview.preview_token_digest = $1
        AND preview.route_handle_digest = $2
        AND preview.account_key = $3 AND preview.product_key = $4
        AND preview.revoked_at IS NULL AND preview.expires_at > $5
        AND admin_session.revoked_at IS NULL AND admin_session.expires_at > $5
      LIMIT 1`,
    [opaqueDigest(token), opaqueDigest(routeHandle), config.accountKey, config.productKey, now],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  const roleId = String(row.role_id) as FictionalRoleId;
  const identity = await loadFictionalIdentityProof(pool, config, roleId);
  if (!identity.eligible || identity.learnerKey !== row.fictional_learner_key) return null;
  await pool.query(
    `UPDATE onetime.experience_preview_sessions
        SET last_seen_at = $2
      WHERE preview_session_key = $1`,
    [row.preview_session_key, now],
  );
  return {
    previewSessionKey: String(row.preview_session_key),
    adminUserRef: String(row.admin_user_ref),
    adminSessionKey: String(row.admin_session_key),
    roleId,
    learnerKey: String(row.fictional_learner_key),
    routeHandle,
    expiresAt: new Date(String(row.expires_at)).toISOString(),
  };
}

function card(
  roleId: ExperiencePreviewRoleId,
  label: string,
  subtitle: string,
  state: ExperiencePreviewState,
) {
  return { role_id: roleId, label, subtitle, state };
}

function section(
  title: string,
  items: Array<{ label: string; value: string; state?: ExperiencePreviewState }>,
) {
  return { title, items };
}

function item(label: string, value: string, state?: ExperiencePreviewState) {
  return { label, value, ...(state ? { state } : {}) };
}

function readableClassState(row: Record<string, unknown>) {
  const startsAt = new Date(String(row.starts_at));
  const date = Number.isNaN(startsAt.getTime())
    ? 'Scheduled time unavailable'
    : new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jerusalem',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(startsAt);
  return `${String(row.occurrence_state)} · ${date} Israel`;
}

function zoomLabel(state: ExperiencePreviewState) {
  if (state === 'ready') return 'Exact fictional meeting projection and activation gates ready';
  if (state === 'provider_off') return 'Zoom SDK/S2S activation gates are off';
  return 'Activation is configured but the exact fictional meeting projection is unavailable';
}

function telegramFoundationReady(config: AppConfig) {
  return (
    config.liveClassTelegramEnabled &&
    config.oneTimeTelegramWebhookEnabled &&
    config.oneTimeTelegramWebhookSecretConfigured &&
    config.oneTimeTelegramTokenConfigured &&
    config.oneTimeTelegramOwnerMappingConfigured &&
    config.oneTimeTelegramSingleConsumerGate &&
    config.oneTimeTelegramCanaryChatConfigured &&
    !config.oneTimeTelegramLocalPollingEnabled &&
    !config.oneTimeTelegramProductionPollingEnabled
  );
}

function safeJsonFlag(value: unknown, key: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return (value as Record<string, unknown>)[key];
}

async function requireOwnerAdmin(req: Request, res: Response, input: { session: SessionPorts }) {
  const session = await input.session.sessionFromRequest(req);
  if (!session) {
    res.status(401).json({ success: false, code: 'UNAUTHENTICATED' });
    return null;
  }
  if (session.user.role !== 'owner' && session.user.role !== 'admin') {
    res.status(403).json({ success: false, code: 'FORBIDDEN' });
    return null;
  }
  return session;
}

async function recordPreviewAudit(
  pool: DbPool,
  config: AppConfig,
  input: {
    userKey: string;
    role: string;
    actionType: string;
    metadata: Record<string, unknown>;
  },
) {
  await pool.query(
    `INSERT INTO onetime.portal_audit_actions
       (audit_key, account_key, product_key, actor_user_ref, actor_role, action_type, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [
      `experience_preview_${randomUUID()}`,
      config.accountKey,
      config.productKey,
      input.userKey,
      input.role,
      input.actionType,
      JSON.stringify(input.metadata),
    ],
  );
}

function setPreviewResponseHeaders(res: Response, session: SessionPorts) {
  session.setPrivateNoStore(res);
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

function previewCookieOptions(routeHandle: string, maxAge: number) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'strict' as const,
    path: `${PREVIEW_COOKIE_PATH}/${routeHandle}`,
    maxAge,
  };
}

function clearPreviewCookie(res: Response, routeHandle: string) {
  res.clearCookie(PREVIEW_COOKIE, previewCookieOptions(routeHandle, 0));
}

function getCookie(req: Request, name: string) {
  const header = req.header('cookie') ?? '';
  for (const part of header.split(';')) {
    const [key, ...valueParts] = part.trim().split('=');
    if (key === name) return decodeURIComponent(valueParts.join('='));
  }
  return '';
}

function opaqueDigest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
