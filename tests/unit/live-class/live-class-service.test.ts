import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import type { PortalActorContext } from '../../../packages/contracts/src/portals/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import { createLiveClassRepository } from '../../../packages/db/src/live-class/repository.ts';
import {
  createLiveClassService,
  createZoomHostLaunchPort,
  stableKey,
  verifySignedLiveClassCommand,
  ZOOM_CUSTOMER_KEY_MAX_LENGTH,
  type LiveClassRepository,
  type LiveClassService,
} from '../../../packages/domain/src/index.ts';
import { PortalServiceError } from '../../../packages/domain/src/portals/services.ts';

let pool: DbPool;
let config: AppConfig;
let repository: LiveClassRepository;
let service: LiveClassService;

const now = new Date('2027-07-21T16:05:00.000Z');
let clockNow = now;
const realZoomHostEnv = {
  ONE_TIME_RUNTIME_ENVIRONMENT: 'isolated_staging',
  ZOOM_CLASSROOM_ENABLED: 'true',
  ZOOM_CLASSROOM_PROVIDER_MODE: 'real',
  ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED: 'true',
  ZOOM_MEETING_SDK_CLIENT_ID: 'sdk_client_test',
  ZOOM_MEETING_SDK_CLIENT_SECRET: 'sdk_secret_test',
  ZOOM_MEETING_SDK_WEB_VERSION: '6.2.0',
  ZOOM_ACCOUNT_ID: 'zoom_account_test',
  ZOOM_S2S_CLIENT_ID: 's2s_client_test',
  ZOOM_S2S_CLIENT_SECRET: 's2s_secret_test',
  ZOOM_HOST_USER_ID: 'host_user_test',
  ZOOM_REAL_CONTROL_MEETING_ID: '987654321',
  ZOOM_REAL_CONTROL_MEETING_PASSCODE: 'passcode_test',
} as const;

beforeEach(async () => {
  clockNow = now;
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    LIVE_CLASS_FAKE_ADAPTER_ENABLED: 'false',
    ZOOM_CLASSROOM_ENABLED: 'true',
    ZOOM_CLASSROOM_PROVIDER_MODE: 'sink',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
  repository = createLiveClassRepository(pool);
  service = createLiveClassService({ config, repository, clock: () => clockNow });
  await seedLearner('household_alpha', 'learner_alpha', 'Alpha Student');
  await seedLearner('household_beta', 'learner_beta', 'Beta Student');
});

afterEach(async () => {
  await pool.end();
});

describe('live class question lifecycle', () => {
  it('runs Student Ready -> Rabbi Feature -> Done without exposing other student questions', async () => {
    const session = await repository.ensureLiveSession({
      actor: rabbiActor(),
      now,
      expires_at: new Date(now.getTime() + 60 * 60_000),
    });
    const submitted = await service.submitQuestion(
      studentActor('learner_alpha', 'household_alpha'),
      {
        occurrence_key: session.occurrence_key,
        body: 'Why does the Mishnah use this example? alpha@example.test',
        idempotency_key: 'live-alpha-question-1',
      },
    );
    expect(submitted.question).toMatchObject({
      status: 'submitted',
      approved_display_name: 'Alpha Student',
      question_preview: 'Why does the Mishnah use this example? [redacted]',
    });

    const betaVisible = await service.listQuestions(
      studentActor('learner_beta', 'household_beta'),
      session.occurrence_key,
    );
    expect(betaVisible).toEqual([]);

    const selected = await service.selectQuestion(
      rabbiActor(),
      submitted.question.question_key,
      'live-alpha-select',
    );
    expect(selected.question?.status).toBe('selected');

    const ready = await service.markReady(
      studentActor('learner_alpha', 'household_alpha'),
      submitted.question.question_key,
      {
        idempotency_key: 'live-alpha-ready',
        ready: true,
        mic_ready: true,
        video_ready: true,
      },
    );
    expect(ready).toMatchObject({ status: 'student_ready', readiness: 'ready', video_ready: true });

    const live = await service.goLive(
      rabbiActor(),
      submitted.question.question_key,
      'live-alpha-feature',
    );
    expect(live.question?.status).toBe('live');
    expect(live.commands.map((command) => command.command_type)).toEqual(
      expect.arrayContaining(['spotlight_replace', 'ask_unmute', 'obs_switch_scene']),
    );
    expect(live.stage.current_scene).toBe('OT - Featured Student');

    const done = await service.completeQuestion(rabbiActor(), submitted.question.question_key, {
      idempotency_key: 'live-alpha-done',
      resolution: 'answered',
    });
    expect(done.question?.status).toBe('answered');
    expect(done.stage.current_scene).toBe('OT - Slides');
    expect(done.stage.selected_question).toBeNull();
  });

  it('rejects wrong-student readiness and replayed signed OBS reports', async () => {
    const session = await repository.ensureLiveSession({
      actor: rabbiActor(),
      now,
      expires_at: new Date(now.getTime() + 60 * 60_000),
    });
    const submitted = await service.submitQuestion(
      studentActor('learner_alpha', 'household_alpha'),
      {
        occurrence_key: session.occurrence_key,
        body: 'Can I ask this privately?',
        idempotency_key: 'live-alpha-question-2',
      },
    );
    await service.selectQuestion(rabbiActor(), submitted.question.question_key, 'live-select-2');

    await expect(
      service.markReady(
        studentActor('learner_beta', 'household_beta'),
        submitted.question.question_key,
        {
          idempotency_key: 'live-beta-wrong-ready',
          ready: true,
        },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await service.markReady(
      studentActor('learner_alpha', 'household_alpha'),
      submitted.question.question_key,
      { idempotency_key: 'live-alpha-ready-2', ready: true },
    );
    const live = await service.goLive(
      rabbiActor(),
      submitted.question.question_key,
      'live-alpha-feature-2',
    );
    const obsCommand = live.commands.find((command) => command.command_type === 'obs_switch_scene');
    expect(obsCommand).toBeTruthy();
    expect(verifySignedLiveClassCommand(config, obsCommand!, now)).toBe(true);

    await expect(
      service.reportObsCommand(
        { account_key: config.accountKey, product_key: config.productKey },
        {
          command_key: obsCommand!.command_key,
          nonce: obsCommand!.nonce,
          signature: obsCommand!.signature,
          status: 'executed',
          result: 'scene switched',
        },
      ),
    ).resolves.toEqual({ accepted: true });
    await expect(
      service.reportObsCommand(
        { account_key: config.accountKey, product_key: config.productKey },
        {
          command_key: obsCommand!.command_key,
          nonce: obsCommand!.nonce,
          signature: obsCommand!.signature,
          status: 'executed',
          result: 'replay',
        },
      ),
    ).rejects.toBeInstanceOf(PortalServiceError);
  });

  it('uses the fake Zoom adapter without claiming REST control or forced camera start', async () => {
    const session = await repository.ensureLiveSession({
      actor: rabbiActor(),
      now,
      expires_at: new Date(now.getTime() + 60 * 60_000),
    });
    const submitted = await service.submitQuestion(
      studentActor('learner_alpha', 'household_alpha'),
      {
        occurrence_key: session.occurrence_key,
        body: 'Can Zoom spotlight me only after I am ready?',
        idempotency_key: 'live-alpha-question-3',
      },
    );
    await service.selectQuestion(rabbiActor(), submitted.question.question_key, 'live-select-3');
    await service.markReady(
      studentActor('learner_alpha', 'household_alpha'),
      submitted.question.question_key,
      { idempotency_key: 'live-alpha-ready-3', ready: true, video_ready: true },
    );
    await service.zoomControl(rabbiActor(), {
      operation: 'spotlight_replace',
      question_key: submitted.question.question_key,
      idempotency_key: 'live-zoom-spotlight-3',
    });
    const snapshot = await service.consoleSnapshot(rabbiActor(), session.occurrence_key);
    expect(snapshot.data.zoom).toMatchObject({
      adapter: 'fake',
      live_control_uses_rest_api: false,
      can_force_camera_on: false,
      video_start_model: 'PARTICIPANT_CONSENT',
    });
    const participant = snapshot.data.participants.find(
      (item) => item.customer_key === submitted.question.customer_key,
    );
    expect(participant?.spotlighted).toBe(true);
  });

  it('denies a cross-student target and rejects an expired Zoom command report', async () => {
    const session = await repository.ensureLiveSession({
      actor: rabbiActor(),
      now,
      expires_at: new Date(now.getTime() + 60 * 60_000),
    });
    const alpha = await service.submitQuestion(studentActor('learner_alpha', 'household_alpha'), {
      occurrence_key: session.occurrence_key,
      body: 'Alpha controlled command',
      idempotency_key: 'live-alpha-cross-target',
    });
    const beta = await service.submitQuestion(studentActor('learner_beta', 'household_beta'), {
      occurrence_key: session.occurrence_key,
      body: 'Beta controlled command',
      idempotency_key: 'live-beta-cross-target',
    });
    await service.selectQuestion(rabbiActor(), alpha.question.question_key, 'live-select-cross');
    await service.markReady(
      studentActor('learner_alpha', 'household_alpha'),
      alpha.question.question_key,
      { idempotency_key: 'live-alpha-ready-cross', ready: true, video_ready: true },
    );
    const participants = (await service.consoleSnapshot(rabbiActor(), session.occurrence_key)).data
      .participants;
    const betaParticipant = participants.find(
      (participant) => participant.customer_key === beta.question.customer_key,
    );
    await expect(
      service.zoomControl(rabbiActor(), {
        operation: 'mute',
        question_key: alpha.question.question_key,
        participant_key: betaParticipant!.participant_key,
        idempotency_key: 'live-cross-student-denied',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const inserted = await repository.enqueueCommand({
      actor: rabbiActor(),
      command: {
        command_key: 'live_expiring_zoom_command',
        command_type: 'mute',
        occurrence_key: session.occurrence_key,
        target_question_key: alpha.question.question_key,
        target_participant_key: participants.find(
          (participant) => participant.customer_key === alpha.question.customer_key,
        )!.participant_key,
        obs_scene: null,
        idempotency_key: 'live-expiry-command',
        request_hash: 'request_hash_expiry',
        nonce: 'nonce_expiry_command',
        signature: 'signature_expiry_command',
        expires_at: new Date(now.getTime() + 45_000),
        created_by_user_ref: rabbiActor().actor_user_ref,
      },
    });
    const command = inserted.command;
    clockNow = new Date(now.getTime() + 46_000);
    await expect(
      service.reportObsCommand(
        { account_key: config.accountKey, product_key: config.productKey },
        {
          command_key: command.command_key,
          nonce: command.nonce,
          signature: command.signature,
          status: 'executed',
          result: 'late report',
        },
      ),
    ).rejects.toBeInstanceOf(PortalServiceError);
  });

  it('maps Meeting SDK participants only by the stable per-join customer key', async () => {
    const session = await repository.ensureLiveSession({
      actor: rabbiActor(),
      now,
      expires_at: new Date(now.getTime() + 60 * 60_000),
    });
    const submitted = await service.submitQuestion(
      studentActor('learner_alpha', 'household_alpha'),
      {
        occurrence_key: session.occurrence_key,
        body: 'Stable mapping question',
        idempotency_key: 'live-stable-mapping-question',
      },
    );
    const realConfig = loadConfig({
      NODE_ENV: 'test',
      PUBLIC_BASE_URL: 'https://isolated-pr.example.test',
      ...realZoomHostEnv,
    });
    const realService = createLiveClassService({
      config: realConfig,
      repository,
      clock: () => clockNow,
    });
    const mapped = await realService.syncZoomParticipants(rabbiActor(), {
      occurrence_key: session.occurrence_key,
      participants: [
        {
          customer_key: submitted.question.customer_key,
          provider_user_id: '12345',
          join_state: 'joined',
          audio_state: 'muted',
          video_state: 'on',
          active_speaker: false,
          spotlighted: false,
        },
      ],
    });
    expect(mapped.mappings).toEqual([
      expect.objectContaining({ customer_key: submitted.question.customer_key }),
    ]);
    const snapshot = await realService.consoleSnapshot(rabbiActor(), session.occurrence_key);
    expect(
      snapshot.data.participants.find(
        (participant) => participant.customer_key === submitted.question.customer_key,
      ),
    ).toMatchObject({ join_state: 'joined', video_state: 'on' });
    await expect(
      realService.syncZoomParticipants(rabbiActor(), {
        occurrence_key: session.occurrence_key,
        participants: [
          {
            customer_key: 'zoom_customer_key_for_other_occurrence',
            provider_user_id: '67890',
            join_state: 'joined',
            audio_state: 'muted',
            video_state: 'off',
            active_speaker: false,
            spotlighted: false,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      realService.syncZoomParticipants(
        { ...rabbiActor(), account_key: 'another_account' },
        {
          occurrence_key: session.occurrence_key,
          participants: [
            {
              customer_key: submitted.question.customer_key,
              provider_user_id: '98765',
              join_state: 'joined',
              audio_state: 'muted',
              video_state: 'off',
              active_speaker: false,
              spotlighted: false,
            },
          ],
        },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('issues a role-zero protected join for only the three isolated fictional learners', async () => {
    const realConfig = loadConfig({
      NODE_ENV: 'test',
      PUBLIC_BASE_URL: 'https://isolated-pr.example.test',
      LIVE_CLASS_FAKE_ADAPTER_ENABLED: 'true',
      ...realZoomHostEnv,
    });
    const launchPort = createZoomHostLaunchPort(realConfig);
    expect(launchPort).toBeTruthy();
    const realService = createLiveClassService({
      config: realConfig,
      repository,
      zoomHostLaunchPort: launchPort!,
      clock: () => clockNow,
    });

    const launch = await realService.zoomTestParticipantBootstrap(rabbiActor(), 1);
    expect(launch).toMatchObject({
      user_name: 'Student 1',
      video_start_model: 'PARTICIPANT_CONSENT',
    });
    expect(launch.customer_key).not.toContain('Student 1');
    expect(launch.customer_key).toMatch(/^zoom_ck_[a-f0-9]{24}$/);
    expect(launch.customer_key.length).toBeLessThanOrEqual(ZOOM_CUSTOMER_KEY_MAX_LENGTH);

    const legacyCustomerKey = stableKey('zoom_customer_key', [
      launch.occurrence_key,
      'live_demo_learner_1',
    ]);
    expect(legacyCustomerKey.length).toBeGreaterThan(ZOOM_CUSTOMER_KEY_MAX_LENGTH);
    await pool.query(
      `UPDATE onetime.live_class_questions
          SET customer_key = $1
        WHERE account_key = $2
          AND product_key = $3
          AND occurrence_key = $4
          AND learner_key = 'live_demo_learner_1'`,
      [legacyCustomerKey, config.accountKey, config.productKey, launch.occurrence_key],
    );
    await pool.query(
      `UPDATE onetime.live_class_participants
          SET participant_key = $1,
              customer_key = $2
        WHERE account_key = $3
          AND product_key = $4
          AND occurrence_key = $5
          AND learner_key = 'live_demo_learner_1'`,
      [
        stableKey('zoom_participant', [launch.occurrence_key, legacyCustomerKey]),
        legacyCustomerKey,
        config.accountKey,
        config.productKey,
        launch.occurrence_key,
      ],
    );
    const reseededLaunch = await realService.zoomTestParticipantBootstrap(rabbiActor(), 1);
    expect(reseededLaunch.customer_key).toBe(launch.customer_key);
    expect(reseededLaunch.customer_key.length).toBeLessThanOrEqual(ZOOM_CUSTOMER_KEY_MAX_LENGTH);
    const payload = JSON.parse(
      Buffer.from(launch.signature.split('.')[1]!, 'base64url').toString('utf8'),
    ) as { role: number; mn: string };
    expect(payload).toMatchObject({ role: 0, mn: '987654321' });

    await expect(
      realService.zoomTestParticipantBootstrap(studentActor('learner_alpha', 'household_alpha'), 1),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(realService.zoomTestParticipantBootstrap(rabbiActor(), 4)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

async function seedLearner(householdKey: string, learnerKey: string, displayName: string) {
  await pool.query(
    `INSERT INTO onetime.portal_households
       (household_key, account_key, product_key, display_name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (account_key, product_key, household_key)
     DO NOTHING`,
    [householdKey, config.accountKey, config.productKey, `${displayName} Household`],
  );
  await pool.query(
    `INSERT INTO onetime.portal_learners
       (learner_key, account_key, product_key, household_key, display_name, grade_label)
     VALUES ($1, $2, $3, $4, $5, 'Demo')
     ON CONFLICT (account_key, product_key, learner_key)
     DO NOTHING`,
    [learnerKey, config.accountKey, config.productKey, householdKey, displayName],
  );
}

function rabbiActor(): PortalActorContext {
  return {
    account_key: config.accountKey,
    product_key: config.productKey,
    actor_user_ref: 'rabbi_owner_user',
    actor_role: 'owner',
    session_key: 'rabbi_session',
    capabilities: [],
    authorized_households: [],
    student_learner: null,
  };
}

function studentActor(learnerKey: string, householdKey: string): PortalActorContext {
  return {
    account_key: config.accountKey,
    product_key: config.productKey,
    actor_user_ref: `student_user_${learnerKey}`,
    actor_role: 'student',
    session_key: `student_session_${learnerKey}`,
    capabilities: ['student:class:question'],
    authorized_households: [],
    student_learner: {
      learner_key: learnerKey,
      household_key: householdKey,
      access_state_key: `access_${learnerKey}`,
    },
  };
}
