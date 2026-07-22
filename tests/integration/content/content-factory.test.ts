import { createHash } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../apps/web/src/server/app.ts';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import {
  claimContentFactoryJob,
  contentFactoryStorageFromEnv,
  createAccountUser,
  createContentPortalAccessAdapter,
  createSession,
  generateContentFactoryDraftFromTranscript,
  getSessionUserByKey,
  ingestContentFactoryItem,
  revokeFreePilotAccess,
  runContentFactoryWorkerOnce,
} from '../../../packages/domain/src/index.ts';

let pool: DbPool;
let config: AppConfig;
let storageRoot: string;

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    OUTBOX_TRANSPORT_MODE: 'sink',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
  storageRoot = await mkdtemp(path.join(tmpdir(), 'onetime-content-factory-volume-'));
  process.env.CONTENT_FACTORY_STORAGE_DRIVER = 'volume';
  process.env.CONTENT_FACTORY_STORAGE_ROOT = storageRoot;
  process.env.CONTENT_FACTORY_MAX_UPLOAD_BYTES = '1048576';
});

afterEach(async () => {
  await pool.end();
  delete process.env.CONTENT_FACTORY_STORAGE_DRIVER;
  delete process.env.CONTENT_FACTORY_STORAGE_ROOT;
  delete process.env.CONTENT_FACTORY_MAX_UPLOAD_BYTES;
  await rm(storageRoot, { recursive: true, force: true });
});

describe('durable occurrence-scoped content factory', () => {
  it('survives restart and lease expiry, publishes to one learner, denies a sibling, and revokes on unpublish', async () => {
    const owner = await createUserSession('owner', 'factory-owner@example.test');
    const parent = await createUserSession('parent', 'factory-parent@example.test');
    const studentOne = await createUserSession('student', 'factory-student-one@example.test');
    const sibling = await createUserSession('student', 'factory-sibling@example.test');
    await seedOccurrenceRoster({
      parentUserKey: parent.userKey,
      studentOneUserKey: studentOne.userKey,
      siblingUserKey: sibling.userKey,
    });

    const firstWebProcess = await listenForTest(createApp({ config, pool }));
    const video = syntheticMp4('first');
    let intakeKey = '';
    try {
      const intake = await upload(firstWebProcess.baseUrl, owner, video, 'intake-exactly-once-01');
      const intakeText = await intake.text();
      expect(intake.status, intakeText).toBe(201);
      const payload = JSON.parse(intakeText) as { intake: { intake_key: string } };
      intakeKey = payload.intake.intake_key;
      expect(intakeText).toContain('"durable_locator_present":true');
      expect(intakeText).toContain('"raw_source_path_present":false');
      expect(intakeText).not.toContain(storageRoot);

      const replay = await upload(firstWebProcess.baseUrl, owner, video, 'intake-exactly-once-01');
      expect(replay.status, await replay.clone().text()).toBe(201);
      expect(
        (await readdir(path.join(storageRoot, 'objects'))).filter((name) =>
          name.endsWith('.media'),
        ),
      ).toHaveLength(1);

      const conflict = await upload(
        firstWebProcess.baseUrl,
        owner,
        syntheticMp4('conflict'),
        'intake-exactly-once-01',
      );
      expect(conflict.status).toBe(400);
      expect(await conflict.text()).not.toContain(storageRoot);
    } finally {
      await firstWebProcess.close();
    }

    const persisted = await pool.query(
      `SELECT storage_locator, occurrence_key, idempotency_key
         FROM onetime.learning_delivery_content_factory_intakes WHERE intake_key = $1`,
      [intakeKey],
    );
    expect(persisted.rows[0]).toMatchObject({
      occurrence_key: 'occurrence_video_e2e',
      idempotency_key: 'intake-exactly-once-01',
    });
    expect(String(persisted.rows[0].storage_locator)).toMatch(/^volume:v1:/);
    await contentFactoryStorageFromEnv().inspect(String(persisted.rows[0].storage_locator));

    const claimedBeforeRestart = await claimContentFactoryJob({
      pool,
      config,
      workerIdentity: 'worker-before-restart',
      now: new Date('2026-07-23T12:00:00.000Z'),
      leaseMs: 1_000,
    });
    expect(claimedBeforeRestart?.stage).toBe('inspecting');

    const recovered = await runContentFactoryWorkerOnce({
      pool,
      config,
      storage: contentFactoryStorageFromEnv(),
      workerIdentity: 'worker-after-restart',
      now: new Date('2026-07-23T12:00:02.000Z'),
      leaseMs: 60_000,
      mode: 'synthetic',
    });
    expect(recovered).toMatchObject({
      claimed: true,
      stage: 'inspecting',
      providerCallsPerformed: false,
      safeErrorCode: null,
    });
    for (let index = 0; index < 5; index += 1) {
      await runContentFactoryWorkerOnce({
        pool,
        config,
        storage: contentFactoryStorageFromEnv(),
        workerIdentity: `worker-stage-${index}`,
        now: new Date(`2026-07-23T12:00:${String(index + 3).padStart(2, '0')}.000Z`),
        mode: 'synthetic',
      });
    }

    const completed = await pool.query(
      `SELECT job_state, current_stage, attempt_count, source_key
         FROM onetime.learning_delivery_content_factory_jobs WHERE intake_key = $1`,
      [intakeKey],
    );
    expect(completed.rows[0]).toMatchObject({ job_state: 'completed', current_stage: 'completed' });
    expect(Number(completed.rows[0].attempt_count)).toBe(7);
    const sourceKey = String(completed.rows[0].source_key);
    const stageResults = await pool.query(
      `SELECT stage FROM onetime.learning_delivery_content_factory_stage_results
        WHERE job_key = (SELECT job_key FROM onetime.learning_delivery_content_factory_jobs
          WHERE intake_key = $1)`,
      [intakeKey],
    );
    expect(stageResults.rows).toHaveLength(6);
    const providerRecord = await pool.query(
      `SELECT processing_mode, provider_video_id, provider_embed_url, occurrence_key,
              transcript_review_state, captions_active
         FROM onetime.learning_delivery_content_factory_items WHERE source_key = $1`,
      [sourceKey],
    );
    expect(providerRecord.rows[0]).toMatchObject({
      processing_mode: 'synthetic',
      provider_embed_url: null,
      occurrence_key: 'occurrence_video_e2e',
      transcript_review_state: 'draft',
      captions_active: true,
    });

    const restartedWebProcess = await listenForTest(createApp({ config, pool }));
    try {
      const workspace = await fetch(`${restartedWebProcess.baseUrl}/api/v1/admin/content/factory`, {
        headers: { cookie: owner.cookie },
      });
      const workspaceText = await workspace.text();
      expect(workspace.status, workspaceText).toBe(200);
      expect(workspaceText).toContain('"state":"needs_review"');
      expect(workspaceText).toContain('occurrence_video_e2e');
      expect(workspaceText).not.toContain(storageRoot);
      expect(workspaceText).not.toContain('synthetic_video_');

      const edit = await fetch(
        `${restartedWebProcess.baseUrl}/api/v1/admin/content/factory/${encodeURIComponent(sourceKey)}`,
        {
          method: 'PATCH',
          headers: {
            cookie: owner.cookie,
            'content-type': 'application/json',
            'x-csrf-token': owner.csrfToken,
          },
          body: JSON.stringify({
            title: 'Approved occurrence-scoped Mishnah review',
            occurrence_key: 'occurrence_video_e2e',
          }),
        },
      );
      expect(edit.status, await edit.clone().text()).toBe(200);
      expect((await mutate(restartedWebProcess.baseUrl, owner, sourceKey, 'approve')).status).toBe(
        200,
      );
      expect((await mutate(restartedWebProcess.baseUrl, owner, sourceKey, 'publish')).status).toBe(
        200,
      );

      const entitlements = await pool.query(
        `SELECT audience, learner_key, entitlement_state
           FROM onetime.content_item_entitlements WHERE content_item_key = $1`,
        [sourceKey],
      );
      expect(entitlements.rows).toEqual([
        expect.objectContaining({
          audience: 'learner',
          learner_key: 'learner_video_one',
          entitlement_state: 'active',
        }),
      ]);
      expect(entitlements.rows.some((row) => row.audience === 'all_active_learners')).toBe(false);

      const entitledPlayback = await playback(restartedWebProcess.baseUrl, studentOne, sourceKey);
      const entitledHtml = await entitledPlayback.text();
      expect(entitledPlayback.status, entitledHtml).toBe(200);
      expect(entitledHtml).toContain('Approved occurrence-scoped Mishnah review');
      expect(entitledHtml).toContain('Class occurrence for durable video');
      expect(entitledHtml).toContain('<dt>Captions</dt><dd>Active</dd>');
      expect(entitledHtml).not.toContain('player.vimeo.com');

      const siblingPlayback = await playback(restartedWebProcess.baseUrl, sibling, sourceKey);
      const siblingHtml = await siblingPlayback.text();
      expect(siblingPlayback.status).toBe(404);
      expect(siblingHtml).not.toContain('Approved occurrence-scoped Mishnah review');

      const parentPlayback = await playback(restartedWebProcess.baseUrl, parent, sourceKey);
      expect(parentPlayback.status, await parentPlayback.clone().text()).toBe(200);

      const syntheticEmbed = await fetch(
        `${restartedWebProcess.baseUrl}/api/v1/content/factory/${encodeURIComponent(sourceKey)}/embed`,
        { headers: { cookie: studentOne.cookie }, redirect: 'manual' },
      );
      expect(syntheticEmbed.status).toBe(200);
      expect(await syntheticEmbed.text()).not.toContain('vimeo.com');

      expect(
        (await mutate(restartedWebProcess.baseUrl, owner, sourceKey, 'unpublish')).status,
      ).toBe(200);
    } finally {
      await restartedWebProcess.close();
    }

    const afterUnpublishRestart = await listenForTest(createApp({ config, pool }));
    try {
      const revoked = await playback(afterUnpublishRestart.baseUrl, studentOne, sourceKey);
      expect(revoked.status).toBe(404);
      expect(await revoked.text()).not.toContain('Approved occurrence-scoped Mishnah review');
      const rows = await pool.query(
        `SELECT entitlement_state FROM onetime.content_item_entitlements
          WHERE content_item_key = $1`,
        [sourceKey],
      );
      expect(rows.rows.every((row) => row.entitlement_state === 'revoked')).toBe(true);
    } finally {
      await afterUnpublishRestart.close();
    }
  });

  it('rejects traversal, executable/spreadsheet signatures, oversize, and missing occurrence', async () => {
    const owner = await createUserSession('owner', 'factory-validation-owner@example.test');
    await seedOccurrenceRoster({
      parentUserKey: 'unused_parent',
      studentOneUserKey: 'unused_student',
      siblingUserKey: 'unused_sibling',
      relationships: false,
    });
    const server = await listenForTest(createApp({ config, pool }));
    try {
      const traversal = await rawUpload(server.baseUrl, owner, {
        name: '../escape.mp4',
        mime: 'video/mp4',
        bytes: syntheticMp4('valid'),
        occurrenceKey: 'occurrence_video_e2e',
        idempotencyKey: 'validation-traversal-01',
      });
      expect(traversal.status).toBe(400);
      const executable = await rawUpload(server.baseUrl, owner, {
        name: 'lesson.mp4',
        mime: 'video/mp4',
        bytes: Buffer.from('MZ executable payload that is not media'),
        occurrenceKey: 'occurrence_video_e2e',
        idempotencyKey: 'validation-executable-01',
      });
      expect(executable.status).toBe(400);
      const spreadsheet = await rawUpload(server.baseUrl, owner, {
        name: 'lesson.xlsx',
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        bytes: Buffer.from('PK spreadsheet payload that is not media'),
        occurrenceKey: 'occurrence_video_e2e',
        idempotencyKey: 'validation-spreadsheet-01',
      });
      expect(spreadsheet.status).toBe(400);
      const missingOccurrence = await rawUpload(server.baseUrl, owner, {
        name: 'lesson.mp4',
        mime: 'video/mp4',
        bytes: syntheticMp4('missing-occurrence'),
        occurrenceKey: 'does_not_exist',
        idempotencyKey: 'validation-occurrence-01',
      });
      expect(missingOccurrence.status).toBe(400);
      process.env.CONTENT_FACTORY_MAX_UPLOAD_BYTES = '32';
      const oversize = await rawUpload(server.baseUrl, owner, {
        name: 'lesson.mp4',
        mime: 'video/mp4',
        bytes: syntheticMp4('oversize'),
        occurrenceKey: 'occurrence_video_e2e',
        idempotencyKey: 'validation-oversize-01',
      });
      expect(oversize.status).toBe(400);
      expect(await oversize.text()).not.toContain(storageRoot);
    } finally {
      await server.close();
    }
  });

  it('keeps protected Vimeo playback learner-scoped and revokes current household access', async () => {
    const owner = await createUserSession('owner', 'factory-vimeo-owner@example.test');
    const parent = await createUserSession('parent', 'factory-vimeo-parent@example.test');
    const student = await createUserSession('student', 'factory-vimeo-student@example.test');
    const sibling = await createUserSession('student', 'factory-vimeo-sibling@example.test');
    const unrelated = await createUserSession('student', 'factory-vimeo-unrelated@example.test');
    await seedOccurrenceRoster({
      parentUserKey: parent.userKey,
      studentOneUserKey: student.userKey,
      siblingUserKey: sibling.userKey,
    });
    await seedActiveAccessProjection();
    await ingestFixture();
    await pool.query(
      `UPDATE onetime.learning_delivery_content_factory_items
          SET occurrence_key = 'occurrence_video_e2e'
        WHERE account_key = $1
          AND product_key = $2
          AND source_key = 'factory_sample_2026_07_22'`,
      [config.accountKey, config.productKey],
    );

    const server = await listenForTest(createApp({ config, pool }));
    try {
      const anonymous = await fetch(`${server.baseUrl}/api/v1/admin/content/factory`);
      expect(anonymous.status).toBe(401);
      const forbidden = await fetch(`${server.baseUrl}/api/v1/admin/content/factory`, {
        headers: { cookie: student.cookie },
      });
      expect(forbidden.status).toBe(403);

      const workspace = await fetch(`${server.baseUrl}/api/v1/admin/content/factory`, {
        headers: { cookie: owner.cookie },
      });
      const workspaceText = await workspace.text();
      expect(workspace.status, workspaceText).toBe(200);
      expect(workspaceText).toContain('"state":"needs_review"');
      expect(workspaceText).toContain('operator-owned-sample.mov');
      expect(workspaceText).toContain('"raw_provider_url_present":false');
      expect(workspaceText).not.toContain('player.vimeo.com');
      expect(workspaceText).not.toContain('private_video_123');

      expect(
        (
          await mutate(
            server.baseUrl,
            owner,
            'factory_sample_2026_07_22',
            'approve',
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await mutate(
            server.baseUrl,
            owner,
            'factory_sample_2026_07_22',
            'publish',
          )
        ).status,
      ).toBe(200);

      const published = await pool.query(
        `SELECT items.lifecycle_state, entitlements.audience, entitlements.learner_key,
                entitlements.entitlement_state
           FROM onetime.content_items AS items
           JOIN onetime.content_item_entitlements AS entitlements
             ON entitlements.content_item_key = items.content_item_key
          WHERE items.content_item_key = $1`,
        ['factory_sample_2026_07_22'],
      );
      expect(published.rows).toEqual([
        expect.objectContaining({
          lifecycle_state: 'published',
          audience: 'learner',
          learner_key: 'learner_video_one',
          entitlement_state: 'active',
        }),
      ]);

      for (const session of [parent, student]) {
        const response = await playback(
          server.baseUrl,
          session,
          'factory_sample_2026_07_22',
        );
        const html = await response.text();
        expect(response.status, html).toBe(200);
        expect(html).toContain('Protected One Time lesson');
        expect(html).toContain('<dt>Captions</dt><dd>Active</dd>');
        expect(html).toContain('/api/v1/content/factory/factory_sample_2026_07_22/embed');
        expect(html).not.toContain('player.vimeo.com');
        expect(html).not.toContain('private_video_123');
      }

      const embed = await fetch(
        `${server.baseUrl}/api/v1/content/factory/factory_sample_2026_07_22/embed`,
        { headers: { cookie: student.cookie }, redirect: 'manual' },
      );
      expect(embed.status).toBe(302);
      expect(embed.headers.get('location')).toBe(
        'https://player.vimeo.com/video/private_video_123',
      );

      const adapter = createContentPortalAccessAdapter({ pool, config });
      const intendedLibrary = await adapter.publishedLibraryForLearner({
        actor: studentActor(student.userKey, 'learner_video_one'),
        learner: studentLearner('learner_video_one', 'Entitled learner'),
      });
      const siblingLibrary = await adapter.publishedLibraryForLearner({
        actor: studentActor(sibling.userKey, 'learner_video_sibling'),
        learner: studentLearner('learner_video_sibling', 'Unentitled sibling'),
      });
      expect(intendedLibrary.map((item) => item.item_key)).toContain(
        'factory_sample_2026_07_22',
      );
      expect(siblingLibrary.map((item) => item.item_key)).not.toContain(
        'factory_sample_2026_07_22',
      );

      const siblingPlayback = await playback(
        server.baseUrl,
        sibling,
        'factory_sample_2026_07_22',
      );
      expect(siblingPlayback.status).toBe(404);
      expect(await siblingPlayback.text()).not.toContain('private_video_123');
      const siblingEmbed = await fetch(
        `${server.baseUrl}/api/v1/content/factory/factory_sample_2026_07_22/embed`,
        { headers: { cookie: sibling.cookie }, redirect: 'manual' },
      );
      expect(siblingEmbed.status).toBe(404);
      expect(siblingEmbed.headers.get('location')).toBeNull();
      expect(await siblingEmbed.text()).not.toContain('private_video_123');

      const unrelatedPlayback = await fetch(
        `${server.baseUrl}/app/learning/items/factory_sample_2026_07_22`,
        { headers: { cookie: unrelated.cookie }, redirect: 'manual' },
      );
      expect(unrelatedPlayback.status).toBe(302);
      expect(unrelatedPlayback.headers.get('location')).toBe(
        '/login?return_to=%2Fapp%2Flearning%2Fitems%2Ffactory_sample_2026_07_22',
      );
      expect(await unrelatedPlayback.text()).not.toContain('private_video_123');
      const unrelatedEmbed = await fetch(
        `${server.baseUrl}/api/v1/content/factory/factory_sample_2026_07_22/embed`,
        { headers: { cookie: unrelated.cookie }, redirect: 'manual' },
      );
      expect(unrelatedEmbed.status).toBe(401);
      expect(unrelatedEmbed.headers.get('location')).toBeNull();
      expect(await unrelatedEmbed.text()).not.toContain('private_video_123');

      const revoked = await revokeFreePilotAccess({
        pool,
        accountKey: config.accountKey,
        productKey: config.productKey,
        actorKind: 'admin',
        now: new Date('2026-07-23T12:00:00.000Z'),
        command: {
          household_key: 'household_video_e2e',
          idempotency_key: 'factory-household-revoke-v1',
          revoked_at: '2026-07-23T12:00:00.000Z',
          reason: 'pilot_completed',
          policy_version: 'content-factory-current-access-v1',
        },
      });
      expect(revoked.projection).toMatchObject({
        state: 'revoked',
        grants_access: false,
      });
      expect(revoked.sessions_revoked).toBe(3);
      for (const session of [parent, student, sibling]) {
        const denied = await fetch(
          `${server.baseUrl}/app/learning/items/factory_sample_2026_07_22`,
          { headers: { cookie: session.cookie }, redirect: 'manual' },
        );
        expect(denied.status).toBe(302);
        expect(denied.headers.get('location')).toBe(
          '/login?return_to=%2Fapp%2Flearning%2Fitems%2Ffactory_sample_2026_07_22',
        );
        expect(await denied.text()).not.toContain('private_video_123');
        const deniedEmbed = await fetch(
          `${server.baseUrl}/api/v1/content/factory/factory_sample_2026_07_22/embed`,
          { headers: { cookie: session.cookie }, redirect: 'manual' },
        );
        expect(deniedEmbed.status).toBe(401);
        expect(await deniedEmbed.text()).not.toContain('private_video_123');
      }
    } finally {
      await server.close();
    }
  });
});

async function seedOccurrenceRoster(input: {
  parentUserKey: string;
  studentOneUserKey: string;
  siblingUserKey: string;
  relationships?: boolean;
}) {
  await pool.query(
    `INSERT INTO onetime.class_series
       (class_series_key, account_key, product_key, title, timezone, local_start_time,
        reminder_local_time, status)
     VALUES ('series_video_e2e',$1,$2,'Class occurrence for durable video','Asia/Jerusalem',
       '18:00','17:30','active')`,
    [config.accountKey, config.productKey],
  );
  await pool.query(
    `INSERT INTO onetime.class_occurrences
       (occurrence_key, account_key, product_key, class_series_key, local_class_date,
        starts_at, reminder_due_at, joinable_until, occurrence_state)
     VALUES ('occurrence_video_e2e',$1,$2,'series_video_e2e','2026-07-22',
       '2026-07-22T15:00:00Z','2026-07-22T14:30:00Z','2026-07-22T17:00:00Z','completed')`,
    [config.accountKey, config.productKey],
  );
  if (input.relationships === false) return;
  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name, status)
     VALUES ('household_video_e2e',$1,$2,'Video E2E household','active')`,
    [config.accountKey, config.productKey],
  );
  for (const [learnerKey, displayName] of [
    ['learner_video_one', 'Entitled learner'],
    ['learner_video_sibling', 'Unentitled sibling'],
  ]) {
    await pool.query(
      `INSERT INTO onetime.portal_learners
         (learner_key, account_key, product_key, household_key, display_name, learner_status)
       VALUES ($1,$2,$3,'household_video_e2e',$4,'active')`,
      [learnerKey, config.accountKey, config.productKey, displayName],
    );
  }
  await pool.query(
    `INSERT INTO onetime.portal_guardian_relationships
       (relationship_key, account_key, product_key, household_key, guardian_user_ref,
        relationship_label, authority, status)
     VALUES ('relationship_video_parent',$1,$2,'household_video_e2e',$3,
       'Parent','primary_guardian','active')`,
    [config.accountKey, config.productKey, input.parentUserKey],
  );
  for (const [key, learnerKey, studentUserKey] of [
    ['student_access_video_one', 'learner_video_one', input.studentOneUserKey],
    ['student_access_video_sibling', 'learner_video_sibling', input.siblingUserKey],
  ]) {
    await pool.query(
      `INSERT INTO onetime.portal_student_access_state
         (access_state_key, account_key, product_key, household_key, learner_key,
          student_user_ref, status)
       VALUES ($1,$2,$3,'household_video_e2e',$4,$5,'active')`,
      [key, config.accountKey, config.productKey, learnerKey, studentUserKey],
    );
    await pool.query(
      `INSERT INTO onetime.account_learner_identity_links
         (link_key, account_key, product_key, household_key, learner_key, user_key, link_state)
       VALUES ($1,$2,$3,'household_video_e2e',$4,$5,'active')`,
      [`link_${key}`, config.accountKey, config.productKey, learnerKey, studentUserKey],
    );
  }
  await pool.query(
    `INSERT INTO onetime.classroom_occurrence_learner_entitlements
       (occurrence_entitlement_key, account_key, product_key, occurrence_key,
        household_key, learner_key, entitlement_state, source)
     VALUES ('occurrence_entitlement_video_one',$1,$2,'occurrence_video_e2e',
       'household_video_e2e','learner_video_one','active','isolated_acceptance')`,
    [config.accountKey, config.productKey],
  );
}

async function seedActiveAccessProjection() {
  await pool.query(
    `INSERT INTO onetime.account_access_projections
       (access_key, account_key, product_key, household_key, state, source_kind,
        effective_at, expires_at, opaque_source_reference, source_revision,
        source_updated_at, source_request_hash, policy_version, last_event_key)
     VALUES ('factory_household_access',$1,$2,'household_video_e2e','active','free_pilot',
       '2026-01-01T00:00:00.000Z','2027-01-01T00:00:00.000Z',
       'factory_test_pilot',1,'2026-01-01T00:00:01.000Z',$3,
       'content-factory-current-access-v1','factory_household_access_seed')`,
    [config.accountKey, config.productKey, 'f'.repeat(64)],
  );
}

async function ingestFixture() {
  const segments = Array.from({ length: 7 }, (_, index) => ({
    segment_id: `segment_${index + 1}`,
    start_ms: index * 9_000,
    end_ms: index * 9_000 + 8_000,
    text: [
      'The Mishnah introduces the first case from the class.',
      'Rabbi Scheller reads the next phrase from the text.',
      'The class reviews the example and its wording.',
      'A second case is compared with the first case.',
      'The Masechta wording is repeated for careful review.',
      'Students are asked to remember the two examples.',
      'The lesson closes with a review of the Mishnah text.',
    ][index]!,
  }));
  const normalizedTranscript = segments.map((segment) => segment.text).join(' ');
  const webvtt =
    'WEBVTT\n\n00:00:00.000 --> 00:00:08.000\nThe Mishnah introduces the first case.\n';
  await ingestContentFactoryItem({
    pool,
    config,
    item: {
      sourceKey: 'factory_sample_2026_07_22',
      sourceKind: 'local_drop',
      sourceRefDigest: digest('local-drop-source-ref'),
      sourceSha256: digest('local-drop-source'),
      displayName: 'operator-owned-sample.mov',
      mimeType: 'video/quicktime',
      byteLength: 4_200_000,
      originalDurationMs: 75_000,
      preparedDurationMs: 63_000,
      trimStartMs: 6_000,
      trimEndMs: 69_000,
      removedStartMs: 6_000,
      removedEndMs: 6_000,
      trimConfidence: 0.9,
      transcriptSegments: segments,
      normalizedTranscript,
      transcriptSha256: digest(normalizedTranscript),
      webvtt,
      webvttSha256: digest(webvtt),
      transcriptionModel: 'gpt-4o-mini-transcribe',
      transcriptionLanguage: 'en',
      draft: generateContentFactoryDraftFromTranscript({
        displayName: 'operator-owned-sample.mov',
        segments,
        classLabel: 'One Time Mishnayos',
        classDate: '2026-07-22',
      }),
      providerVideoId: 'private_video_123',
      providerEmbedUrl: 'https://player.vimeo.com/video/private_video_123',
      providerTextTrackId: 'private_track_456',
      vimeoPrivacy: 'private',
      captionsActive: true,
    },
  });
}

async function createUserSession(role: 'owner' | 'parent' | 'student', email: string) {
  const userKey = await createAccountUser({
    pool,
    config,
    email,
    password: 'ContentFactoryTestPass!234',
    displayName: `Content factory ${role}`,
    role,
  });
  const user = await getSessionUserByKey({ pool, config, userKey });
  if (!user) throw new Error(`missing ${role} test user`);
  const session = await createSession({ pool, config, user, assuranceMethod: 'password' });
  return {
    userKey,
    cookie: `otcrm_session=${session.session_token}`,
    csrfToken: session.csrf_token,
  };
}

function studentActor(userKey: string, learnerKey: string) {
  return {
    account_key: config.accountKey,
    product_key: config.productKey,
    actor_user_ref: userKey,
    actor_role: 'student' as const,
    session_key: `${learnerKey}_session`,
    capabilities: ['student:dashboard:read' as const],
    authorized_households: [],
    student_learner: {
      learner_key: learnerKey,
      household_key: 'household_video_e2e',
      access_state_key: `${learnerKey}_access`,
    },
  };
}

function studentLearner(learnerKey: string, displayName: string) {
  return {
    learner_key: learnerKey,
    household_key: 'household_video_e2e',
    display_name: displayName,
    hebrew_name: null,
    grade_label: null,
    learner_status: 'active' as const,
    version: 1,
    created_at: '2026-07-23T12:00:00.000Z',
    updated_at: '2026-07-23T12:00:00.000Z',
  };
}

function upload(
  baseUrl: string,
  session: { cookie: string; csrfToken: string },
  bytes: Buffer,
  idempotencyKey: string,
) {
  return rawUpload(baseUrl, session, {
    name: 'protected-class-video.mp4',
    mime: 'video/mp4',
    bytes,
    occurrenceKey: 'occurrence_video_e2e',
    idempotencyKey,
  });
}

function rawUpload(
  baseUrl: string,
  session: { cookie: string; csrfToken: string },
  input: {
    name: string;
    mime: string;
    bytes: Buffer;
    occurrenceKey: string;
    idempotencyKey: string;
  },
) {
  return fetch(`${baseUrl}/api/v1/admin/content/factory/intake`, {
    method: 'POST',
    headers: {
      cookie: session.cookie,
      'content-type': input.mime,
      'x-csrf-token': session.csrfToken,
      'x-file-name': encodeURIComponent(input.name),
      'x-occurrence-key': encodeURIComponent(input.occurrenceKey),
      'x-idempotency-key': encodeURIComponent(input.idempotencyKey),
    },
    body: input.bytes.buffer.slice(
      input.bytes.byteOffset,
      input.bytes.byteOffset + input.bytes.byteLength,
    ) as ArrayBuffer,
  });
}

function mutate(
  baseUrl: string,
  session: { cookie: string; csrfToken: string },
  sourceKey: string,
  action: 'approve' | 'publish' | 'unpublish',
) {
  return fetch(
    `${baseUrl}/api/v1/admin/content/factory/${encodeURIComponent(sourceKey)}/${action}`,
    {
      method: 'POST',
      headers: {
        cookie: session.cookie,
        'content-type': 'application/json',
        'x-csrf-token': session.csrfToken,
      },
      body: '{}',
    },
  );
}

function playback(baseUrl: string, session: { cookie: string }, sourceKey: string) {
  return fetch(`${baseUrl}/app/learning/items/${encodeURIComponent(sourceKey)}`, {
    headers: { cookie: session.cookie },
  });
}

function syntheticMp4(label: string) {
  const bytes = Buffer.alloc(4_096, 0);
  bytes.writeUInt32BE(24, 0);
  bytes.write('ftyp', 4, 'ascii');
  bytes.write('isom', 8, 'ascii');
  createHash('sha256').update(label).digest().copy(bytes, 32);
  return bytes;
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
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
