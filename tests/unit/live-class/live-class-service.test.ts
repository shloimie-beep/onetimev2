import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import type { PortalActorContext } from '../../../packages/contracts/src/portals/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import { createLiveClassRepository } from '../../../packages/db/src/live-class/repository.ts';
import {
  createLiveClassService,
  createZoomHostLaunchPort,
  verifySignedLiveClassCommand,
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
  ZOOM_MEETING_SDK_ALLOWED_ORIGIN: 'https://isolated-pr.example.test',
  ZOOM_MEETING_SDK_WEB_VERSION: '6.2.0',
  ZOOM_S2S_ACCOUNT_ID: 'zoom_account_test',
  ZOOM_S2S_CLIENT_ID: 's2s_client_test',
  ZOOM_S2S_CLIENT_SECRET: 's2s_secret_test',
  ZOOM_HOST_USER_ID: 'host_user_test',
  ZOOM_REAL_CONTROL_MEETING_ID: '987654321',
  ZOOM_REAL_CONTROL_MEETING_PASSCODE: 'passcode_test',
  ZOOM_CLASSROOM_CANARY_ENABLED: 'true',
  ZOOM_CLASSROOM_CANARY_LEARNER_KEY: 'full_app_preview_student_1',
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
    expect(live.commands.map((command) => command.command_type)).not.toContain('start_video');
    expect(live.stage.current_scene).toBe('OT - Featured Student');

    const done = await service.completeQuestion(rabbiActor(), submitted.question.question_key, {
      idempotency_key: 'live-alpha-done',
      resolution: 'answered',
    });
    expect(done.question?.status).toBe('answered');
    expect(done.commands.map((command) => command.command_type)).toContain('spotlight_remove');
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
    await service.zoomControl(rabbiActor(), {
      operation: 'ask_unmute',
      question_key: submitted.question.question_key,
      idempotency_key: 'live-zoom-ask-unmute-3',
    });
    await expect(
      service.zoomControl(rabbiActor(), {
        operation: 'spotlight_replace',
        question_key: submitted.question.question_key,
        idempotency_key: 'live-zoom-spotlight-3',
      }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
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
    expect(participant?.audio_state).toBe('muted');
  });

  it('shows SDK-ready but S2S-not-ready provider-off truth without values', async () => {
    const session = await repository.ensureLiveSession({
      actor: rabbiActor(),
      now,
      expires_at: new Date(now.getTime() + 60 * 60_000),
    });
    const providerOffConfig = loadConfig({
      NODE_ENV: 'test',
      PUBLIC_BASE_URL: 'https://isolated-pr.example.test',
      ONE_TIME_RUNTIME_ENVIRONMENT: 'isolated_staging',
      ZOOM_CLASSROOM_ENABLED: 'true',
      ZOOM_CLASSROOM_PROVIDER_MODE: 'real',
      ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED: 'true',
      ZOOM_MEETING_SDK_CLIENT_ID: 'sdk_client_test',
      ZOOM_MEETING_SDK_CLIENT_SECRET: 'sdk_secret_test',
      ZOOM_MEETING_SDK_ALLOWED_ORIGIN: 'https://isolated-pr.example.test',
      ZOOM_MEETING_SDK_WEB_VERSION: '6.2.0',
      LIVE_CLASS_FAKE_ADAPTER_ENABLED: 'true',
    });
    const providerOffService = createLiveClassService({
      config: providerOffConfig,
      repository,
      clock: () => clockNow,
    });

    const snapshot = await providerOffService.consoleSnapshot(rabbiActor(), session.occurrence_key);
    expect(snapshot.data.zoom).toMatchObject({
      adapter: 'fake',
      sdk_credentials_configured: true,
      host_control_configured: false,
      readiness: {
        ready: false,
        code: 'PROVIDER_NOT_READY',
        phases: {
          sdk_app: { ready: true },
          s2s_meeting_provisioning: { ready: false },
          host_authorization: { ready: false },
          real_control_canary_authorization: { ready: false },
        },
        secret_values_included: false,
      },
    });
    expect(snapshot.data.zoom.setup_job?.title).toBe('Complete Zoom real-control readiness');
    expect(JSON.stringify(snapshot.data.zoom.readiness)).not.toContain('sdk_secret_test');
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

  it('refuses Admin-minted learner join material for every fictional Student', async () => {
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

    for (const studentNumber of [1, 2, 3]) {
      await expect(
        realService.zoomTestParticipantBootstrap(rabbiActor(), studentNumber),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'Zoom learners must join from their own protected Student session.',
      });
    }
    await expect(
      realService.zoomTestParticipantBootstrap(studentActor('learner_alpha', 'household_alpha'), 1),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
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
