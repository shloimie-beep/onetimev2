import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../apps/web/src/server/app.ts';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { asCanonicalUserKey } from '../../../packages/contracts/src/telegram/types.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import { createClassroomRepository } from '../../../packages/db/src/classroom/repository.ts';
import { resolveDailyClassWindow } from '../../../packages/domain/src/classes/service.ts';
import { createAccountUser } from '../../../packages/domain/src/index.ts';
import { createOneTimeTelegramApplicationAdapter } from '../../../packages/domain/src/telegram/application-adapter.ts';

let pool: DbPool;
let config: AppConfig;
let distDir: string;
let parentUserKey: string;
let studentUserKey: string;
let siblingStudentUserKey: string;
let betaStudentUserKey: string;

const openClassClock = () => new Date('2026-07-16T16:05:00.000Z');

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    OUTBOX_TRANSPORT_MODE: 'sink',
    ZOOM_CLASSROOM_ENABLED: 'true',
    ZOOM_CLASSROOM_PROVIDER_MODE: 'sink',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
  distDir = await mkdtemp(path.join(tmpdir(), 'ot88-classroom-'));
  await writePortalShells(distDir);
  parentUserKey = await createAccountUser({
    pool,
    config,
    email: 'parent@example.test',
    password: 'ParentPass!234',
    displayName: 'Parent User',
    role: 'parent',
  });
  studentUserKey = await createAccountUser({
    pool,
    config,
    email: 'student@example.test',
    password: 'StudentPass!234',
    displayName: 'Student User',
    role: 'student',
  });
  siblingStudentUserKey = await createAccountUser({
    pool,
    config,
    email: 'sibling@example.test',
    password: 'StudentPass!234',
    displayName: 'Sibling Student',
    role: 'student',
  });
  betaStudentUserKey = await createAccountUser({
    pool,
    config,
    email: 'beta@example.test',
    password: 'StudentPass!234',
    displayName: 'Beta Student',
    role: 'student',
  });
  await seedClassroomRecords();
});

afterEach(async () => {
  await pool.end();
  await rm(distDir, { recursive: true, force: true });
});

describe('OT-88 Zoom learner classroom sink mode', () => {
  it('issues an opaque learner launch and bootstraps sink SDK data without raw provider URLs', async () => {
    const server = await listenForTest(createApp({ config, pool, distDir, clock: openClassClock }));
    try {
      const student = await loginAs(server.baseUrl, 'student@example.test', 'StudentPass!234');
      const dashboard = await fetch(`${server.baseUrl}/api/v1/portals/student/dashboard`, {
        headers: { cookie: student.cookies },
      });
      const dashboardText = await dashboard.text();
      expect(dashboard.status, dashboardText).toBe(200);
      const dashboardJson = JSON.parse(dashboardText);
      expect(JSON.stringify(dashboardJson)).not.toMatch(/https?:\/\/|zoom\.us|\/j\//i);
      const classSummary = dashboardJson.data.upcoming_classes[0];
      expect(classSummary.status).toBe('live');
      expect(classSummary.launch_action.href).toMatch(/^\/api\/v1\/portals\/student\/classes\//);

      const launch = await fetch(`${server.baseUrl}${classSummary.launch_action.href}`, {
        method: 'POST',
        headers: {
          cookie: student.cookies,
          'content-type': 'application/json',
          'x-csrf-token': student.json.csrf_token,
        },
        body: JSON.stringify({ idempotency_key: 'ot88-launch-alpha-001' }),
      });
      const launchText = await launch.text();
      expect(launch.status, launchText).toBe(200);
      expect(launchText).not.toMatch(/https?:\/\/|zoom\.us|\/j\//i);
      const launchJson = JSON.parse(launchText);
      const launchPath = launchJson.data.href;
      const launchReference = launchJson.data.launch_token_ref;
      expect(launchPath).toBe('/classroom/launch');
      expect(launchReference).toMatch(/^classroom_grant_/);
      expect(launchPath).not.toContain(launchReference);

      const launchPage = await fetch(`${server.baseUrl}${launchPath}`, {
        headers: { cookie: student.cookies },
      });
      const launchHtml = await launchPage.text();
      expect(launchPage.status, launchHtml).toBe(200);
      expect(launchPage.headers.get('cache-control')).toContain('no-store');
      expect(launchPage.headers.get('referrer-policy')).toBe('no-referrer');
      expect(launchPage.headers.get('content-security-policy')).not.toContain(
        'https://source.zoom.us',
      );
      expect(launchHtml).not.toMatch(/meeting_number|signature|registrant|https?:\/\/|zoom\.us/i);
      expect(launchHtml).not.toContain(launchReference);

      const bootstrap = await fetch(`${server.baseUrl}/api/v1/classroom/launch/bootstrap`, {
        method: 'POST',
        headers: {
          cookie: student.cookies,
          'content-type': 'application/json',
          'x-csrf-token': student.json.csrf_token,
        },
        body: JSON.stringify({ viewport_width: 390 }),
      });
      const bootstrapText = await bootstrap.text();
      expect(bootstrap.status, bootstrapText).toBe(200);
      expect(bootstrapText).not.toMatch(/https?:\/\/|zoom\.us|\/j\//i);
      const bootstrapJson = JSON.parse(bootstrapText);
      expect(bootstrapJson.data).toMatchObject({
        selected_view: 'client',
        provider: { mode: 'sink', state: 'sink_ready', raw_join_url_present: false },
        policy: { mute_on_join: true, participant_role: 0 },
        sdk: { role: 0, user_email_required: false },
      });

      const rows = await pool.query(
        `SELECT grant_key, secret_digest, provider_mode
           FROM onetime.classroom_launch_grants
          WHERE learner_key = 'learner_alpha'`,
      );
      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0].secret_digest).toMatch(/^[a-f0-9]{64}$/);
      expect(launchText).not.toContain(String(rows.rows[0].secret_digest));
    } finally {
      await server.close();
    }
  });

  it('binds the normal Student session to a gated real role-0 SDK launch without provider URLs or sibling reuse', async () => {
    config = loadConfig({
      NODE_ENV: 'test',
      ONE_TIME_RUNTIME_ENVIRONMENT: 'isolated_staging',
      PUBLIC_BASE_URL: 'https://isolated-pr.example.test',
      APP_VERSION: 'test',
      COMMIT_SHA: 'test',
      OUTBOX_TRANSPORT_MODE: 'sink',
      ZOOM_CLASSROOM_ENABLED: 'true',
      ZOOM_CLASSROOM_PROVIDER_MODE: 'real',
      ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED: 'true',
      ZOOM_CLASSROOM_CANARY_ENABLED: 'true',
      ZOOM_CLASSROOM_CANARY_LEARNER_KEY: 'learner_alpha',
      ZOOM_MEETING_SDK_CLIENT_ID: 'sdk-client-fixture',
      ZOOM_MEETING_SDK_CLIENT_SECRET: 'sdk-secret-fixture',
      ZOOM_MEETING_SDK_ALLOWED_ORIGIN: 'https://isolated-pr.example.test',
      ZOOM_MEETING_SDK_WEB_VERSION: '6.2.0',
      ZOOM_S2S_ACCOUNT_ID: 's2s-account-fixture',
      ZOOM_S2S_CLIENT_ID: 's2s-client-fixture',
      ZOOM_S2S_CLIENT_SECRET: 's2s-secret-fixture',
      ZOOM_HOST_USER_ID: 'host-fixture',
      ZOOM_REAL_CONTROL_MEETING_ID: '987654321',
      ZOOM_REAL_CONTROL_MEETING_PASSCODE: 'meeting-passcode-fixture',
    });
    const server = await listenForTest(createApp({ config, pool, distDir, clock: openClassClock }));
    try {
      const student = await loginAs(server.baseUrl, 'student@example.test', 'StudentPass!234');
      const issued = await issueLaunch(server.baseUrl, student, 'ot88-real-student-001');
      const studentDashboard = await fetch(`${server.baseUrl}/api/v1/portals/student/dashboard`, {
        headers: { cookie: student.cookies },
      });
      const studentDashboardJson = await studentDashboard.json();
      expect(studentDashboard.status).toBe(200);
      expect(studentDashboardJson.data.upcoming_classes[0]).toMatchObject({
        provider_state: 'configured',
        status: 'live',
        launch_action: { label: 'Join class' },
      });

      const launchPage = await fetch(`${server.baseUrl}${issued.launchPath}`, {
        headers: { cookie: student.cookies },
      });
      expect(launchPage.status).toBe(200);
      expect(launchPage.headers.get('cache-control')).toContain('no-store');
      expect(launchPage.headers.get('content-security-policy')).toContain('https://source.zoom.us');
      expect(launchPage.headers.get('content-security-policy')).toContain('wss://*.zoom.us');

      const sibling = await loginAs(server.baseUrl, 'sibling@example.test', 'StudentPass!234');
      const siblingDashboard = await fetch(`${server.baseUrl}/api/v1/portals/student/dashboard`, {
        headers: { cookie: sibling.cookies },
      });
      const siblingDashboardJson = await siblingDashboard.json();
      expect(siblingDashboard.status).toBe(200);
      expect(siblingDashboardJson.data.upcoming_classes[0]).toMatchObject({
        provider_state: 'not_configured',
        status: 'unavailable',
        launch_action: null,
      });
      const siblingLaunchPage = await fetch(`${server.baseUrl}${issued.launchPath}`, {
        headers: { cookie: sibling.cookies },
      });
      expect(siblingLaunchPage.status).toBe(200);
      expect(siblingLaunchPage.headers.get('content-security-policy')).not.toContain(
        'source.zoom.us',
      );
      const siblingTheft = await bootstrapLaunch(server.baseUrl, sibling, 390);
      expect(siblingTheft.status, siblingTheft.text).toBe(403);
      expect(siblingTheft.json.code).toBe('FORBIDDEN');
      expect(siblingTheft.text).not.toMatch(
        /sdk-client-fixture|sdk-secret-fixture|s2s-secret-fixture|meeting-passcode-fixture/,
      );

      const bootstrap = await bootstrapLaunch(server.baseUrl, student, 1200);
      expect(bootstrap.status, bootstrap.text).toBe(200);
      expect(bootstrap.json.data).toMatchObject({
        selected_view: 'client',
        provider: { mode: 'real', state: 'ready', raw_join_url_present: false },
        policy: { mute_on_join: true, participant_role: 0 },
        sdk: {
          mode: 'real',
          sdk_web_version: '6.2.0',
          meeting_number: '987654321',
          role: 0,
          user_display_name: 'Alpha Learner',
          user_email_required: false,
          leave_url: '/app/student',
          video_start_model: 'PARTICIPANT_CONSENT',
        },
      });
      expect(bootstrap.json.data.sdk.customer_key).toMatch(/^zoom_ck_[a-f0-9]{24}$/);
      expect(bootstrap.json.data.sdk.customer_key.length).toBeLessThanOrEqual(36);
      expect(bootstrap.text).not.toMatch(/https?:\/\/|\/j\/|sdk-secret-fixture|s2s-secret-fixture/);

      const participant = await pool.query(
        `SELECT learner_key, customer_key, approved_display_name, join_state, audio_state,
                video_state
           FROM onetime.live_class_participants
          WHERE account_key = $1
            AND product_key = $2
            AND occurrence_key = $3`,
        [config.accountKey, config.productKey, bootstrap.json.data.occurrence.class_key],
      );
      expect(participant.rows).toHaveLength(1);
      expect(participant.rows[0]).toMatchObject({
        learner_key: 'learner_alpha',
        customer_key: bootstrap.json.data.sdk.customer_key,
        approved_display_name: 'Alpha Learner',
        join_state: 'waiting',
        audio_state: 'muted',
        video_state: 'off',
      });

      const questionResponse = await fetch(`${server.baseUrl}/api/v1/live-class/questions`, {
        method: 'POST',
        headers: {
          cookie: student.cookies,
          'content-type': 'application/json',
          'x-csrf-token': student.json.csrf_token,
        },
        body: JSON.stringify({
          occurrence_key: bootstrap.json.data.occurrence.class_key,
          body: 'Can the Rabbi explain this Mishnah?',
          idempotency_key: 'ot88-real-student-question-001',
        }),
      });
      const questionText = await questionResponse.text();
      expect(questionResponse.status, questionText).toBe(201);
      const mapped = await pool.query(
        `SELECT questions.customer_key,
                COUNT(participants.participant_key)::int AS participant_count
           FROM onetime.live_class_questions AS questions
           JOIN onetime.live_class_participants AS participants
             ON participants.account_key = questions.account_key
            AND participants.product_key = questions.product_key
            AND participants.occurrence_key = questions.occurrence_key
            AND participants.customer_key = questions.customer_key
          WHERE questions.account_key = $1
            AND questions.product_key = $2
            AND questions.occurrence_key = $3
            AND questions.learner_key = $4
          GROUP BY questions.customer_key`,
        [
          config.accountKey,
          config.productKey,
          bootstrap.json.data.occurrence.class_key,
          'learner_alpha',
        ],
      );
      expect(mapped.rows).toEqual([
        {
          customer_key: bootstrap.json.data.sdk.customer_key,
          participant_count: 1,
        },
      ]);

      const replay = await bootstrapLaunch(server.baseUrl, student, 390);
      expect(replay.status, replay.text).toBe(410);
      expect(replay.json.code).toBe('LAUNCH_EXPIRED');
      expect(replay.text).not.toMatch(
        /meeting_number|signature|meeting_password|customer_key|sdk-secret-fixture/,
      );
    } finally {
      await server.close();
    }
  });

  it('keeps normal Student real mode provider-off when the final canary gate is absent', async () => {
    config = loadConfig({
      NODE_ENV: 'test',
      ONE_TIME_RUNTIME_ENVIRONMENT: 'isolated_staging',
      PUBLIC_BASE_URL: 'https://isolated-pr.example.test',
      APP_VERSION: 'test',
      COMMIT_SHA: 'test',
      OUTBOX_TRANSPORT_MODE: 'sink',
      ZOOM_CLASSROOM_ENABLED: 'true',
      ZOOM_CLASSROOM_PROVIDER_MODE: 'real',
      ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED: 'true',
      ZOOM_CLASSROOM_CANARY_ENABLED: 'false',
      ZOOM_CLASSROOM_CANARY_LEARNER_KEY: 'learner_alpha',
      ZOOM_MEETING_SDK_CLIENT_ID: 'sdk-client-fixture',
      ZOOM_MEETING_SDK_CLIENT_SECRET: 'sdk-secret-fixture',
      ZOOM_MEETING_SDK_ALLOWED_ORIGIN: 'https://isolated-pr.example.test',
      ZOOM_MEETING_SDK_WEB_VERSION: '6.2.0',
      ZOOM_S2S_ACCOUNT_ID: 's2s-account-fixture',
      ZOOM_S2S_CLIENT_ID: 's2s-client-fixture',
      ZOOM_S2S_CLIENT_SECRET: 's2s-secret-fixture',
      ZOOM_HOST_USER_ID: 'host-fixture',
      ZOOM_REAL_CONTROL_MEETING_ID: '987654321',
      ZOOM_REAL_CONTROL_MEETING_PASSCODE: 'meeting-passcode-fixture',
    });
    const server = await listenForTest(createApp({ config, pool, distDir, clock: openClassClock }));
    try {
      const student = await loginAs(server.baseUrl, 'student@example.test', 'StudentPass!234');
      const dashboard = await fetch(`${server.baseUrl}/api/v1/portals/student/dashboard`, {
        headers: { cookie: student.cookies },
      });
      const dashboardJson = await dashboard.json();
      expect(dashboard.status).toBe(200);
      const classSummary = dashboardJson.data.upcoming_classes[0];
      expect(classSummary).toMatchObject({
        provider_state: 'not_configured',
        status: 'unavailable',
        launch_action: null,
      });

      const deniedLaunch = await postLaunch(
        server.baseUrl,
        student,
        `/api/v1/portals/student/classes/${encodeURIComponent(classSummary.class_key)}/launch`,
        'ot88-provider-off-001',
      );
      expect(deniedLaunch.status, deniedLaunch.text).toBe(503);
      expect(deniedLaunch.json.code).toBe('ADAPTER_UNAVAILABLE');

      const legacyLaunchPage = await fetch(
        `${server.baseUrl}/classroom/launch/unissued-grant/unissued-secret`,
        { headers: { cookie: student.cookies } },
      );
      const legacyLaunchHtml = await legacyLaunchPage.text();
      expect(legacyLaunchPage.status, legacyLaunchHtml).toBe(410);
      expect(legacyLaunchPage.headers.get('cache-control')).toContain('no-store');
      expect(legacyLaunchPage.headers.get('referrer-policy')).toBe('no-referrer');
      expect(legacyLaunchHtml).not.toContain('unissued-grant');
      expect(legacyLaunchHtml).not.toContain('unissued-secret');

      const [grants, participants] = await Promise.all([
        pool.query(`SELECT grant_key FROM onetime.classroom_launch_grants`),
        pool.query(`SELECT participant_key FROM onetime.live_class_participants`),
      ]);
      expect(grants.rows).toEqual([]);
      expect(participants.rows).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it('blocks consumed launch replay and requires a new grant for rejoin', async () => {
    const server = await listenForTest(createApp({ config, pool, distDir, clock: openClassClock }));
    try {
      const student = await loginAs(server.baseUrl, 'student@example.test', 'StudentPass!234');
      const issued = await issueLaunch(server.baseUrl, student, 'ot88-replay-001');

      const first = await bootstrapLaunch(server.baseUrl, student, 960);
      expect(first.status, first.text).toBe(200);
      expect(first.text).not.toMatch(/https?:\/\/|zoom\.us|\/j\//i);

      const replay = await bootstrapLaunch(server.baseUrl, student, 960);
      expect(replay.status, replay.text).toBe(410);
      expect(replay.json.code).toBe('LAUNCH_EXPIRED');
      expect(replay.text).not.toMatch(
        /meeting_number|signature|registrant|https?:\/\/|zoom\.us|\/j\//i,
      );

      const sameIdempotency = await postLaunch(
        server.baseUrl,
        student,
        issued.classLaunchHref,
        'ot88-replay-001',
      );
      expect(sameIdempotency.status, sameIdempotency.text).toBe(410);
      expect(sameIdempotency.json.code).toBe('LAUNCH_EXPIRED');
      expect(sameIdempotency.text).not.toMatch(
        /meeting_number|signature|registrant|https?:\/\/|zoom\.us|\/j\//i,
      );

      const rejoin = await postLaunch(
        server.baseUrl,
        student,
        issued.classLaunchHref,
        'ot88-replay-new-grant-001',
      );
      expect(rejoin.status, rejoin.text).toBe(200);
      expect(rejoin.json.data.href).toBe('/classroom/launch');
      expect(rejoin.json.data.launch_token_ref).not.toBe(issued.grantKey);
      const rejoinBootstrap = await bootstrapLaunch(server.baseUrl, student, 390);
      expect(rejoinBootstrap.status, rejoinBootstrap.text).toBe(200);
      expect(rejoinBootstrap.json.data.selected_view).toBe('client');
    } finally {
      await server.close();
    }
  });

  it('does not consume another account’s launch grant even with exact stored digests', async () => {
    const server = await listenForTest(createApp({ config, pool, distDir, clock: openClassClock }));
    try {
      const student = await loginAs(server.baseUrl, 'student@example.test', 'StudentPass!234');
      const issued = await issueLaunch(server.baseUrl, student, 'ot88-cross-account-001');
      const grantKey = issued.grantKey;
      const stored = await pool.query(
        `SELECT actor_user_ref, session_key_digest, status
           FROM onetime.classroom_launch_grants
          WHERE grant_key = $1`,
        [grantKey],
      );
      expect(stored.rows[0]?.status).toBe('issued');

      const crossAccount = await createClassroomRepository(pool).consumePendingLaunchGrant({
        actor: {
          account_key: 'another_account',
          product_key: config.productKey,
          actor_user_ref: String(stored.rows[0]?.actor_user_ref),
          actor_role: 'student',
          session_key: 'another_account_session',
          capabilities: ['student:class:launch'],
          authorized_households: [],
          student_learner: {
            learner_key: 'learner_alpha',
            household_key: 'household_alpha',
            access_state_key: 'access_alpha',
          },
        },
        learner_key: 'learner_alpha',
        session_key_digest: String(stored.rows[0]?.session_key_digest),
        now: openClassClock(),
      });
      expect(crossAccount).toBeNull();

      const stillIssued = await pool.query(
        `SELECT status
           FROM onetime.classroom_launch_grants
          WHERE grant_key = $1`,
        [grantKey],
      );
      expect(stillIssued.rows[0]?.status).toBe('issued');

      const rightful = await bootstrapLaunch(server.baseUrl, student, 390);
      expect(rightful.status, rightful.text).toBe(200);
      const consumed = await pool.query(
        `SELECT status
           FROM onetime.classroom_launch_grants
          WHERE grant_key = $1`,
        [grantKey],
      );
      expect(consumed.rows[0]?.status).toBe('consumed');
    } finally {
      await server.close();
    }
  });

  it('enforces expiry, revocation, session mismatch, sibling mismatch, and concurrent consume', async () => {
    const server = await listenForTest(createApp({ config, pool, distDir, clock: openClassClock }));
    try {
      const student = await loginAs(server.baseUrl, 'student@example.test', 'StudentPass!234');

      const superseded = await issueLaunch(
        server.baseUrl,
        student,
        'ot88-one-pending-superseded-001',
      );
      const pending = await issueLaunch(server.baseUrl, student, 'ot88-one-pending-current-001');
      const pendingStates = await pool.query(
        `SELECT grant_key, status
           FROM onetime.classroom_launch_grants
          WHERE grant_key IN ($1, $2)
          ORDER BY grant_key`,
        [superseded.grantKey, pending.grantKey],
      );
      expect(pendingStates.rows).toEqual(
        [
          { grant_key: superseded.grantKey, status: 'revoked' },
          { grant_key: pending.grantKey, status: 'issued' },
        ].sort((left, right) => left.grant_key.localeCompare(right.grant_key)),
      );
      const pendingBootstrap = await bootstrapLaunch(server.baseUrl, student, 390);
      expect(pendingBootstrap.status, pendingBootstrap.text).toBe(200);

      const expired = await issueLaunch(server.baseUrl, student, 'ot88-expired-001');
      await pool.query(
        `UPDATE onetime.classroom_launch_grants
            SET expires_at = $1
          WHERE grant_key = $2`,
        [new Date('2026-07-16T16:04:00.000Z'), expired.grantKey],
      );
      const expiredBootstrap = await bootstrapLaunch(server.baseUrl, student, 390);
      expect(expiredBootstrap.status, expiredBootstrap.text).toBe(410);
      expect(expiredBootstrap.json.code).toBe('LAUNCH_EXPIRED');

      const revoked = await issueLaunch(server.baseUrl, student, 'ot88-revoked-001');
      await pool.query(
        `UPDATE onetime.classroom_launch_grants
            SET status = 'revoked'
          WHERE grant_key = $1`,
        [revoked.grantKey],
      );
      const revokedBootstrap = await bootstrapLaunch(server.baseUrl, student, 390);
      expect(revokedBootstrap.status, revokedBootstrap.text).toBe(403);
      expect(revokedBootstrap.json.code).toBe('FORBIDDEN');

      await issueLaunch(server.baseUrl, student, 'ot88-session-mismatch-001');
      const secondStudentSession = await loginAs(
        server.baseUrl,
        'student@example.test',
        'StudentPass!234',
      );
      const wrongSession = await bootstrapLaunch(server.baseUrl, secondStudentSession, 390);
      expect(wrongSession.status, wrongSession.text).toBe(403);
      expect(wrongSession.json.code).toBe('FORBIDDEN');

      const sibling = await loginAs(server.baseUrl, 'sibling@example.test', 'StudentPass!234');
      const siblingMismatch = await bootstrapLaunch(server.baseUrl, sibling, 390);
      expect(siblingMismatch.status, siblingMismatch.text).toBe(403);
      expect(siblingMismatch.json.code).toBe('FORBIDDEN');

      await issueLaunch(server.baseUrl, student, 'ot88-concurrent-001');
      const results = await Promise.all([
        bootstrapLaunch(server.baseUrl, student, 1200),
        bootstrapLaunch(server.baseUrl, student, 1200),
      ]);
      expect(results.map((result) => result.status).sort()).toEqual([200, 410]);
      expect(results.map((result) => result.text).join('\n')).not.toMatch(
        /https?:\/\/|zoom\.us|\/j\//i,
      );
    } finally {
      await server.close();
    }
  });

  it('requires CSRF and same-origin boundaries before launch bootstrap', async () => {
    const server = await listenForTest(createApp({ config, pool, distDir, clock: openClassClock }));
    try {
      const student = await loginAs(server.baseUrl, 'student@example.test', 'StudentPass!234');
      await issueLaunch(server.baseUrl, student, 'ot88-origin-csrf-001');

      const noCsrf = await fetch(`${server.baseUrl}/api/v1/classroom/launch/bootstrap`, {
        method: 'POST',
        headers: {
          cookie: student.cookies,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ viewport_width: 390 }),
      });
      const noCsrfJson = await noCsrf.json();
      expect(noCsrf.status).toBe(403);
      expect(noCsrfJson.code).toBe('CSRF_REQUIRED');

      const wrongOrigin = await fetch(`${server.baseUrl}/api/v1/classroom/launch/bootstrap`, {
        method: 'POST',
        headers: {
          cookie: student.cookies,
          'content-type': 'application/json',
          'x-csrf-token': student.json.csrf_token,
          origin: 'https://evil.example.test',
        },
        body: JSON.stringify({ viewport_width: 390 }),
      });
      const wrongOriginJson = await wrongOrigin.json();
      expect(wrongOrigin.status).toBe(403);
      expect(wrongOriginJson.code).toBe('FORBIDDEN');

      const allowed = await bootstrapLaunch(server.baseUrl, student, 390);
      expect(allowed.status, allowed.text).toBe(200);
      expect(allowed.json.data.provider.raw_join_url_present).toBe(false);
    } finally {
      await server.close();
    }
  });

  it('schedules sink reminders through preference, consent, and suppression boundaries', async () => {
    const repository = createClassroomRepository(pool);
    const actor = {
      account_key: config.accountKey,
      product_key: config.productKey,
      actor_user_ref: 'owner_fixture',
      actor_role: 'owner' as const,
    };
    const occurrence = await repository.ensureDailyOccurrence({
      actor,
      window: resolveDailyClassWindow(openClassClock(), { currentOccurrenceStillJoinable: true }),
      durationMinutes: config.zoomClassroomClassDurationMinutes,
      joinOpenOffsetMinutes: config.zoomClassroomJoinOpenOffsetMinutes,
      joinCloseOffsetMinutes: config.zoomClassroomJoinCloseOffsetMinutes,
    });
    await pool.query(
      `INSERT INTO onetime.classroom_household_entitlements
         (entitlement_key, account_key, product_key, household_key, entitlement_state)
       VALUES ('entitlement_beta_reminder', $1, $2, 'household_beta', 'active')`,
      [config.accountKey, config.productKey],
    );
    await pool.query(
      `INSERT INTO onetime.portal_guardian_relationships
         (relationship_key, account_key, product_key, household_key, guardian_user_ref,
          relationship_label, authority)
       VALUES ('relationship_beta', $1, $2, 'household_beta', $3, 'Parent', 'primary_guardian')`,
      [config.accountKey, config.productKey, parentUserKey],
    );
    await pool.query(
      `INSERT INTO onetime.portal_guardian_consents
         (consent_key, account_key, product_key, household_key, relationship_key, consent_type,
          policy_version, consent_text_digest, consent_status, recorded_by_user_ref)
       VALUES ('consent_beta_revoked', $1, $2, 'household_beta', 'relationship_beta',
          'classroom_join', 'ot88-test', 'digest', 'revoked', $3)`,
      [config.accountKey, config.productKey, parentUserKey],
    );
    await pool.query(
      `INSERT INTO onetime.classroom_reminder_preferences
         (preference_key, account_key, product_key, household_key, learner_key, channel,
          preference_state, suppression_state, updated_by_user_ref)
       VALUES
         ('preference_sibling_suppressed', $1, $2, 'household_alpha', 'learner_sibling',
          'portal', 'opted_in', 'suppressed', $3)`,
      [config.accountKey, config.productKey, parentUserKey],
    );

    await pool.query(
      `UPDATE onetime.portal_guardian_relationships
          SET authority = 'support_only'
        WHERE account_key = $1
          AND product_key = $2
          AND household_key = 'household_alpha'`,
      [config.accountKey, config.productKey],
    );
    await expect(
      repository.scheduleDueReminders({
        actor,
        occurrence,
        now: openClassClock(),
      }),
    ).resolves.toEqual({ queued: 0, suppressed: 1 });

    await pool.query(
      `UPDATE onetime.portal_guardian_relationships
          SET authority = 'primary_guardian'
        WHERE account_key = $1
          AND product_key = $2
          AND household_key = 'household_alpha'`,
      [config.accountKey, config.productKey],
    );
    await pool.query(
      `UPDATE onetime.portal_households
          SET status = 'archived'
        WHERE account_key = $1
          AND product_key = $2
          AND household_key = 'household_alpha'`,
      [config.accountKey, config.productKey],
    );
    await expect(
      repository.scheduleDueReminders({
        actor,
        occurrence,
        now: openClassClock(),
      }),
    ).resolves.toEqual({ queued: 0, suppressed: 1 });
    await pool.query(
      `UPDATE onetime.portal_households
          SET status = 'active'
        WHERE account_key = $1
          AND product_key = $2
          AND household_key = 'household_alpha'`,
      [config.accountKey, config.productKey],
    );

    const scheduled = await repository.scheduleDueReminders({
      actor,
      occurrence,
      now: openClassClock(),
    });
    expect(scheduled).toEqual({ queued: 1, suppressed: 2 });

    const intents = await pool.query(
      `SELECT learner_key, status, metadata
         FROM onetime.classroom_reminder_intents
        ORDER BY learner_key`,
    );
    expect(intents.rows).toHaveLength(1);
    expect(intents.rows[0]).toMatchObject({
      learner_key: 'learner_alpha',
      status: 'queued',
    });
    expect(JSON.stringify(intents.rows[0].metadata)).toContain('external_send_performed');
    expect(JSON.stringify(intents.rows[0].metadata)).not.toMatch(/https?:\/\/|zoom\.us|\/j\//i);
  });

  it('keeps parent launch read-only and denies unsubscribed student launch attempts', async () => {
    const server = await listenForTest(createApp({ config, pool, distDir, clock: openClassClock }));
    try {
      const parent = await loginAs(server.baseUrl, 'parent@example.test', 'ParentPass!234');
      const parentDashboard = await fetch(`${server.baseUrl}/api/v1/portals/parent/dashboard`, {
        headers: { cookie: parent.cookies },
      });
      const parentDashboardText = await parentDashboard.text();
      expect(parentDashboard.status, parentDashboardText).toBe(200);
      const parentJson = JSON.parse(parentDashboardText);
      const parentClass = parentJson.data.upcoming_classes.learner_alpha[0];
      expect(parentClass.launch_action).toBeNull();

      const parentLaunch = await fetch(
        `${server.baseUrl}/api/v1/portals/parent/households/household_alpha/learners/learner_alpha/classes/${parentClass.class_key}/launch`,
        {
          method: 'POST',
          headers: { cookie: parent.cookies, 'x-csrf-token': parent.json.csrf_token },
        },
      );
      expect(parentLaunch.status).toBe(403);

      const beta = await loginAs(server.baseUrl, 'beta@example.test', 'StudentPass!234');
      const betaDashboard = await fetch(`${server.baseUrl}/api/v1/portals/student/dashboard`, {
        headers: { cookie: beta.cookies },
      });
      const betaDashboardText = await betaDashboard.text();
      expect(betaDashboard.status, betaDashboardText).toBe(200);
      const betaJson = JSON.parse(betaDashboardText);
      const betaClass = betaJson.data.upcoming_classes[0];
      expect(betaClass.status).toBe('unavailable');
      expect(betaClass.launch_action).toBeNull();

      const betaLaunch = await fetch(
        `${server.baseUrl}/api/v1/portals/student/classes/${betaClass.class_key}/launch`,
        {
          method: 'POST',
          headers: { cookie: beta.cookies, 'x-csrf-token': beta.json.csrf_token },
        },
      );
      const denied = await betaLaunch.json();
      expect(betaLaunch.status).toBe(409);
      expect(denied.code).toBe('ENTITLEMENT_REQUIRED');

      await pool.query(
        `INSERT INTO onetime.portal_learners
           (learner_key, account_key, product_key, household_key, display_name, grade_label)
         VALUES
           ('learner_extra_three', $1, $2, 'household_alpha', 'Third Learner', '5'),
           ('learner_extra_four', $1, $2, 'household_alpha', 'Fourth Learner', '3')`,
        [config.accountKey, config.productKey],
      );
      const alpha = await loginAs(server.baseUrl, 'student@example.test', 'StudentPass!234');
      const alphaDashboard = await fetch(`${server.baseUrl}/api/v1/portals/student/dashboard`, {
        headers: { cookie: alpha.cookies },
      });
      const alphaDashboardText = await alphaDashboard.text();
      expect(alphaDashboard.status, alphaDashboardText).toBe(200);
      const alphaClass = JSON.parse(alphaDashboardText).data.upcoming_classes[0];
      expect(alphaClass.status).toBe('unavailable');
      expect(alphaClass.launch_action).toBeNull();

      const alphaLaunch = await fetch(
        `${server.baseUrl}/api/v1/portals/student/classes/${alphaClass.class_key}/launch`,
        {
          method: 'POST',
          headers: { cookie: alpha.cookies, 'x-csrf-token': alpha.json.csrf_token },
        },
      );
      const alphaDenied = await alphaLaunch.json();
      expect(alphaLaunch.status).toBe(409);
      expect(alphaDenied.code).toBe('ENTITLEMENT_REQUIRED');
    } finally {
      await server.close();
    }
  });

  it('encrypts student questions, redacts gateway alerts, and replays idempotently', async () => {
    const server = await listenForTest(createApp({ config, pool, distDir, clock: openClassClock }));
    try {
      const student = await loginAs(server.baseUrl, 'student@example.test', 'StudentPass!234');
      const dashboard = await fetch(`${server.baseUrl}/api/v1/portals/student/dashboard`, {
        headers: { cookie: student.cookies },
      });
      const dashboardText = await dashboard.text();
      expect(dashboard.status, dashboardText).toBe(200);
      const classKey = JSON.parse(dashboardText).data.upcoming_classes[0].class_key;
      const body = {
        occurrence_key: classKey,
        body: 'Can Rabbi explain this? email me at child@example.test and see https://example.test',
        idempotency_key: 'ot88-question-alpha-001',
      };

      const first = await postQuestion(server.baseUrl, student, body);
      const replay = await postQuestion(server.baseUrl, student, body);
      expect(first.status).toBe(201);
      expect(replay.status).toBe(201);
      expect(first.json.data.question.excerpt_redacted).toContain('[redacted]');
      expect(replay.json.data.moderator_alert_queued).toBe(false);

      const questionRows = await pool.query(
        `SELECT body_ciphertext, excerpt_redacted
           FROM onetime.classroom_student_questions
          WHERE learner_key = 'learner_alpha'`,
      );
      expect(questionRows.rows).toHaveLength(1);
      expect(JSON.stringify(questionRows.rows)).not.toContain('child@example.test');
      expect(JSON.stringify(questionRows.rows)).not.toContain('https://example.test');
      expect(questionRows.rows[0].excerpt_redacted).toContain('[redacted]');

      const events = await pool.query(
        `SELECT event_type, event_json
           FROM onetime.action_gateway_event_outbox
          WHERE event_type = 'class.question.created'`,
      );
      expect(events.rows).toHaveLength(1);
      expect(JSON.stringify(events.rows)).not.toContain('child@example.test');
      expect(JSON.stringify(events.rows)).not.toContain('https://example.test');
      expect(JSON.stringify(events.rows)).toContain('[redacted]');

      const questionKey = first.json.data.question.question_key;
      const telegram = createOneTimeTelegramApplicationAdapter({ pool, config });
      const rabbiActor = {
        userKey: asCanonicalUserKey('rabbi_owner_fixture'),
        displayLabel: 'Rabbi Fixture',
        accountKey: config.accountKey,
        productKey: config.productKey,
        membershipKey: 'membership_rabbi_fixture',
        membershipStatus: 'active' as const,
        userStatus: 'active' as const,
        role: 'owner' as const,
        securityVersion: 1,
        capabilities: telegram.supportedCapabilities(),
      };
      const listed = await telegram.readAction?.(rabbiActor, {
        capability: 'class.question.list',
        source: 'deterministic',
        args: {},
        confirmationMode: 'none',
        riskClass: 'R0',
      });
      expect(listed).toContain(questionKey);
      expect(listed).not.toContain('child@example.test');
      expect(listed).not.toContain('https://example.test');

      const selected = await telegram.executeAction?.(rabbiActor, {
        request: {
          capability: 'class.question.select',
          source: 'deterministic',
          args: { question_ref: questionKey },
          confirmationMode: 'always',
          riskClass: 'R2',
        },
        idempotencyKey: 'ot88-tg-feature-next-001',
      });
      const replayedSelection = await telegram.executeAction?.(rabbiActor, {
        request: {
          capability: 'class.question.select',
          source: 'deterministic',
          args: { question_ref: questionKey },
          confirmationMode: 'always',
          riskClass: 'R2',
        },
        idempotencyKey: 'ot88-tg-feature-next-001',
      });
      expect(selected).toMatchObject({
        status: 'completed',
        resultRef: questionKey,
      });
      expect(replayedSelection).toMatchObject({
        status: 'already_completed',
        resultRef: questionKey,
      });

      const featured = await pool.query(
        `SELECT status, selection_revision
           FROM onetime.classroom_student_questions
          WHERE question_key = $1`,
        [questionKey],
      );
      expect(featured.rows[0]).toMatchObject({ status: 'featured', selection_revision: 1 });

      const selectedEvents = await pool.query(
        `SELECT event_type, event_json
           FROM onetime.action_gateway_event_outbox
          WHERE event_type = 'class.question.selected'`,
      );
      expect(selectedEvents.rows).toHaveLength(1);
      expect(JSON.stringify(selectedEvents.rows)).not.toContain('child@example.test');
      expect(JSON.stringify(selectedEvents.rows)).not.toContain('https://example.test');
      expect(JSON.stringify(selectedEvents.rows)).not.toMatch(/zoom\.us|\/j\//i);
    } finally {
      await server.close();
    }
  });
});

type TestSession = Awaited<ReturnType<typeof loginAs>>;

async function issueLaunch(baseUrl: string, session: TestSession, idempotencyKey: string) {
  const dashboard = await fetch(`${baseUrl}/api/v1/portals/student/dashboard`, {
    headers: { cookie: session.cookies },
  });
  const dashboardText = await dashboard.text();
  expect(dashboard.status, dashboardText).toBe(200);
  const classSummary = JSON.parse(dashboardText).data.upcoming_classes[0];
  expect(classSummary.launch_action.href).toMatch(/^\/api\/v1\/portals\/student\/classes\//);
  const launch = await postLaunch(
    baseUrl,
    session,
    classSummary.launch_action.href,
    idempotencyKey,
  );
  expect(launch.status, launch.text).toBe(200);
  expect(launch.text).not.toMatch(/https?:\/\/|zoom\.us|\/j\//i);
  return {
    classLaunchHref: classSummary.launch_action.href as string,
    launchPath: launch.json.data.href as string,
    grantKey: launch.json.data.launch_token_ref as string,
  };
}

async function postLaunch(
  baseUrl: string,
  session: TestSession,
  classLaunchHref: string,
  idempotencyKey: string,
) {
  const response = await fetch(`${baseUrl}${classLaunchHref}`, {
    method: 'POST',
    headers: {
      cookie: session.cookies,
      'content-type': 'application/json',
      'x-csrf-token': session.json.csrf_token,
    },
    body: JSON.stringify({ idempotency_key: idempotencyKey }),
  });
  const text = await response.text();
  return { status: response.status, text, json: JSON.parse(text) };
}

async function bootstrapLaunch(baseUrl: string, session: TestSession, viewportWidth: number) {
  const response = await fetch(`${baseUrl}/api/v1/classroom/launch/bootstrap`, {
    method: 'POST',
    headers: {
      cookie: session.cookies,
      'content-type': 'application/json',
      'x-csrf-token': session.json.csrf_token,
    },
    body: JSON.stringify({ viewport_width: viewportWidth }),
  });
  const text = await response.text();
  return { status: response.status, text, json: JSON.parse(text) };
}

async function seedClassroomRecords() {
  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name)
     VALUES
       ('household_alpha', $1, $2, 'Alpha Family'),
       ('household_beta', $1, $2, 'Beta Family')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_guardian_relationships
       (relationship_key, account_key, product_key, household_key, guardian_user_ref,
        relationship_label, authority)
     VALUES ('relationship_alpha', $1, $2, 'household_alpha', $3, 'Parent', 'primary_guardian')`,
    [config.accountKey, config.productKey, parentUserKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_learners
       (learner_key, account_key, product_key, household_key, display_name, grade_label)
     VALUES
       ('learner_alpha', $1, $2, 'household_alpha', 'Alpha Learner', '6'),
       ('learner_sibling', $1, $2, 'household_alpha', 'Sibling Learner', '4'),
       ('learner_beta', $1, $2, 'household_beta', 'Beta Learner', '7')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.portal_student_access_state
       (access_state_key, account_key, product_key, household_key, learner_key, student_user_ref,
        status)
      VALUES
        ('access_alpha', $1, $2, 'household_alpha', 'learner_alpha', $3, 'active'),
        ('access_sibling', $1, $2, 'household_alpha', 'learner_sibling', $4, 'active'),
        ('access_beta', $1, $2, 'household_beta', 'learner_beta', $5, 'active')`,
    [
      config.accountKey,
      config.productKey,
      studentUserKey,
      siblingStudentUserKey,
      betaStudentUserKey,
    ],
  );
  await pool.query(
    `INSERT INTO onetime.account_learner_identity_links
       (link_key, account_key, product_key, household_key, learner_key, user_key)
      VALUES
        ('link_alpha_student', $1, $2, 'household_alpha', 'learner_alpha', $3),
        ('link_sibling_student', $1, $2, 'household_alpha', 'learner_sibling', $4),
        ('link_beta_student', $1, $2, 'household_beta', 'learner_beta', $5)`,
    [
      config.accountKey,
      config.productKey,
      studentUserKey,
      siblingStudentUserKey,
      betaStudentUserKey,
    ],
  );
  await pool.query(
    `INSERT INTO onetime.classroom_household_entitlements
       (entitlement_key, account_key, product_key, household_key, entitlement_state)
     VALUES ('entitlement_alpha', $1, $2, 'household_alpha', 'active')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.account_access_projections
       (access_key, account_key, product_key, household_key, state, source_kind,
        effective_at, expires_at, opaque_source_reference, source_revision,
        source_updated_at, source_request_hash, policy_version, last_event_key)
     VALUES
       ('classroom_access_alpha', $1, $2, 'household_alpha', 'active', 'free_pilot',
        '2026-07-15T12:00:00.000Z', '2027-07-15T12:00:00.000Z',
        'classroom_free_pilot_alpha', 1, '2026-07-15T12:00:01.000Z', $3,
        'classroom-current-access-v1', 'classroom_access_event_alpha'),
       ('classroom_access_beta', $1, $2, 'household_beta', 'active', 'free_pilot',
        '2026-07-15T12:00:00.000Z', '2027-07-15T12:00:00.000Z',
        'classroom_free_pilot_beta', 1, '2026-07-15T12:00:01.000Z', $4,
        'classroom-current-access-v1', 'classroom_access_event_beta')`,
    [config.accountKey, config.productKey, 'a'.repeat(64), 'b'.repeat(64)],
  );
}

async function postQuestion(
  baseUrl: string,
  session: { cookies: string; json: { csrf_token: string } },
  body: Record<string, unknown>,
) {
  const response = await fetch(`${baseUrl}/api/v1/classroom/questions`, {
    method: 'POST',
    headers: {
      cookie: session.cookies,
      'content-type': 'application/json',
      'x-csrf-token': session.json.csrf_token,
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() };
}

async function writePortalShells(targetDir: string) {
  await mkdir(path.join(targetDir, 'app'), { recursive: true });
  await mkdir(path.join(targetDir, 'assets'), { recursive: true });
  await writeFile(path.join(targetDir, 'app', 'parent.html'), '<div id="portal-root"></div>');
  await writeFile(path.join(targetDir, 'app', 'student.html'), '<div id="portal-root"></div>');
  await writeFile(path.join(targetDir, 'app', 'crm.html'), '<div id="crm-root"></div>');
  await writeFile(path.join(targetDir, '404.html'), '<h1>Not found</h1>');
  await writeFile(path.join(targetDir, 'assets', 'app-crm.css'), '');
}

async function listenForTest(app: ReturnType<typeof createApp>) {
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const instance = app.listen(0, (error?: Error) => {
      if (error) reject(error);
      else resolve(instance);
    });
  });
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('missing test server address');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function loginAs(baseUrl: string, email: string, password: string) {
  const csrf = await getLoginCsrf(baseUrl);
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      cookie: csrf.cookies,
      'content-type': 'application/json',
      'x-csrf-token': csrf.token,
    },
    body: JSON.stringify({ email, password, csrf_token: csrf.token }),
  });
  const text = await response.text();
  expect(response.status, text).toBe(200);
  return {
    cookies: mergeCookies(csrf.cookies, cookieHeader(response.headers)),
    json: JSON.parse(text) as { csrf_token: string },
  };
}

async function getLoginCsrf(baseUrl: string) {
  const page = await fetch(`${baseUrl}/login`);
  const html = await page.text();
  const token = html.match(/name="csrf_token" value="([^"]+)"/)?.[1];
  if (!token) throw new Error('missing csrf token');
  return { token, cookies: cookieHeader(page.headers) };
}

function cookieHeader(headers: Headers) {
  return headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

function mergeCookies(...headers: string[]) {
  const cookies = new Map<string, string>();
  for (const header of headers) {
    for (const part of header.split(';')) {
      const [key, value] = part.trim().split('=');
      if (key && value) cookies.set(key, value);
    }
  }
  return [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
}
