import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import type { PortalActorContext } from '../../../packages/contracts/src/portals/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import { createLiveClassRepository } from '../../../packages/db/src/live-class/repository.ts';
import {
  createLiveClassService,
  verifySignedLiveClassCommand,
  type LiveClassRepository,
  type LiveClassService,
} from '../../../packages/domain/src/index.ts';
import { PortalServiceError } from '../../../packages/domain/src/portals/services.ts';

let pool: DbPool;
let config: AppConfig;
let repository: LiveClassRepository;
let service: LiveClassService;

let now: Date;

beforeEach(async () => {
  now = new Date();
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
  service = createLiveClassService({ config, repository, clock: () => now });
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
