import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { AppConfig } from '../../../config/src/index.ts';
import type {
  LiveClassCommandResponse,
  LiveClassConsoleSnapshot,
  LiveClassControlCommand,
  LiveClassObsCommandPayload,
  LiveClassObsCommandReportPayload,
  LiveClassObsScene,
  LiveClassParticipant,
  LiveClassQuestion,
  LiveClassQuestionCompletePayload,
  LiveClassQuestionReadyPayload,
  LiveClassQuestionSubmitPayload,
  LiveClassStageState,
  LiveClassZoomControlPayload,
  LiveClassZoomHostBootstrapResponse,
  LiveClassZoomParticipantSyncPayload,
  LiveClassZoomTestParticipantBootstrapResponse,
} from '../../../contracts/src/live-class/index.ts';
import type { PortalActorContext } from '../../../contracts/src/portals/index.ts';
import type {
  SensitivePayloadCodec,
  SensitivePayloadContext,
} from '../../../contracts/src/telegram/types.ts';
import { stableKey } from '../lead/normalize.ts';
import { PortalServiceError } from '../portals/services.ts';
import { zoomCustomerKey } from './zoom-identifiers.ts';
import { inspectZoomHostControlReadiness } from './zoom-host.ts';

export const LIVE_CLASS_POLICY_VERSION = 'ot-live-class-control-v1';
export const LIVE_CLASS_STAGE_SURFACE_LABEL = 'One Time Zoom Stage Host';
export const CANONICAL_OBS_SCENES = [
  'OT - Slides',
  'OT - Featured Student',
  'OT - Break',
] as const satisfies readonly LiveClassObsScene[];
export const CANONICAL_OBS_SOURCES = [
  'PowerPoint / display capture',
  'One Time Featured Student Stage browser/window',
  'Rabbi camera',
] as const;

export type LiveClassLearnerRecord = {
  household_key: string;
  learner_key: string;
  display_name: string;
};

export type LiveClassSessionRecord = {
  occurrence_key: string;
  class_label: string;
  stage_session: string;
};

export type LiveClassCommandInsert = {
  command_key: string;
  command_type: LiveClassControlCommand['command_type'];
  occurrence_key: string;
  target_question_key: string | null;
  target_participant_key: string | null;
  obs_scene: LiveClassObsScene | null;
  idempotency_key: string;
  request_hash: string;
  nonce: string;
  signature: string;
  expires_at: Date;
  created_by_user_ref: string;
};

export type ZoomHostLaunchPort = {
  resolveHostLaunch(input: {
    occurrenceKey: string;
    now: Date;
  }): Promise<LiveClassZoomHostBootstrapResponse['data']>;
  resolveTestParticipantLaunch(input: {
    occurrenceKey: string;
    customerKey: string;
    userName: string;
    now: Date;
  }): Promise<LiveClassZoomTestParticipantBootstrapResponse['data']>;
};

export type LiveClassRepository = {
  ensureLiveSession(args: {
    actor: Pick<PortalActorContext, 'account_key' | 'product_key'>;
    occurrence_key?: string | undefined;
    now: Date;
    expires_at: Date;
  }): Promise<LiveClassSessionRecord>;
  getLearner(args: {
    actor: PortalActorContext;
    learner_key: string;
  }): Promise<LiveClassLearnerRecord | null>;
  submitQuestion(args: {
    actor: PortalActorContext;
    learner: LiveClassLearnerRecord;
    question_key: string;
    occurrence_key: string;
    approved_display_name: string;
    question_body_ciphertext: string | null;
    question_body_digest: string;
    question_preview: string;
    customer_key: string;
    class_label: string | null;
    idempotency_key: string;
    request_hash: string;
  }): Promise<{ question: LiveClassQuestion; replay: boolean }>;
  listQuestions(args: {
    actor: Pick<PortalActorContext, 'account_key' | 'product_key'>;
    occurrence_key: string;
  }): Promise<LiveClassQuestion[]>;
  listOwnQuestions(args: {
    actor: PortalActorContext;
    occurrence_key: string;
    learner_key: string;
  }): Promise<LiveClassQuestion[]>;
  getQuestion(args: {
    actor: Pick<PortalActorContext, 'account_key' | 'product_key'>;
    question_key: string;
  }): Promise<LiveClassQuestion | null>;
  getParticipantByCustomerKey(args: {
    actor: Pick<PortalActorContext, 'account_key' | 'product_key'>;
    occurrence_key: string;
    customer_key: string;
  }): Promise<LiveClassParticipant | null>;
  getParticipantByKey(args: {
    actor: Pick<PortalActorContext, 'account_key' | 'product_key'>;
    occurrence_key: string;
    participant_key: string;
  }): Promise<LiveClassParticipant | null>;
  listParticipants(args: {
    actor: Pick<PortalActorContext, 'account_key' | 'product_key'>;
    occurrence_key: string;
  }): Promise<LiveClassParticipant[]>;
  upsertParticipant(args: {
    actor: Pick<PortalActorContext, 'account_key' | 'product_key'>;
    occurrence_key: string;
    participant_key: string;
    learner_key: string | null;
    customer_key: string;
    approved_display_name: string;
    join_state: LiveClassParticipant['join_state'];
    audio_state: LiveClassParticipant['audio_state'];
    video_state: LiveClassParticipant['video_state'];
    active_speaker: boolean;
    spotlighted: boolean;
    participant_id_digest?: string | null | undefined;
  }): Promise<LiveClassParticipant>;
  selectQuestion(args: {
    actor: PortalActorContext;
    question_key: string;
    now: Date;
  }): Promise<LiveClassQuestion>;
  markStudentReady(args: {
    actor: PortalActorContext;
    question_key: string;
    ready: boolean;
    mic_ready: boolean;
    video_ready: boolean;
    now: Date;
  }): Promise<LiveClassQuestion>;
  markQuestionLive(args: {
    actor: PortalActorContext;
    question_key: string;
    now: Date;
  }): Promise<LiveClassQuestion>;
  completeQuestion(args: {
    actor: PortalActorContext;
    question_key: string;
    resolution: LiveClassQuestionCompletePayload['resolution'];
    now: Date;
  }): Promise<LiveClassQuestion>;
  setStage(args: {
    actor: Pick<PortalActorContext, 'account_key' | 'product_key'>;
    occurrence_key: string;
    question_key: string | null;
    scene: LiveClassObsScene;
    state: 'slides' | 'student_featured' | 'break' | 'reset';
  }): Promise<void>;
  getStage(args: {
    actor: Pick<PortalActorContext, 'account_key' | 'product_key'>;
    stage_session: string;
  }): Promise<LiveClassStageState | null>;
  enqueueCommand(args: {
    actor: Pick<PortalActorContext, 'account_key' | 'product_key'>;
    command: LiveClassCommandInsert;
  }): Promise<{ command: LiveClassControlCommand; replay: boolean }>;
  listPendingCommands(args: {
    actor: Pick<PortalActorContext, 'account_key' | 'product_key'>;
    occurrence_key: string;
    now: Date;
  }): Promise<LiveClassControlCommand[]>;
  listPendingZoomCommands(args: {
    actor: Pick<PortalActorContext, 'account_key' | 'product_key'>;
    occurrence_key: string;
    now: Date;
  }): Promise<LiveClassControlCommand[]>;
  reportCommand(args: {
    actor: Pick<PortalActorContext, 'account_key' | 'product_key'>;
    payload: LiveClassObsCommandReportPayload;
    now: Date;
  }): Promise<LiveClassControlCommand | null>;
  recordAudit(args: {
    actor: Pick<
      PortalActorContext,
      'account_key' | 'product_key' | 'actor_user_ref' | 'actor_role'
    >;
    occurrence_key?: string | null;
    learner_key?: string | null;
    question_key?: string | null;
    event_type: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
};

export type LiveClassServiceDeps = {
  config: AppConfig;
  repository: LiveClassRepository;
  questionCodec?: SensitivePayloadCodec;
  zoomHostLaunchPort?: ZoomHostLaunchPort;
  clock?: () => Date;
};

export type LiveClassService = ReturnType<typeof createLiveClassService>;

export function createLiveClassService(deps: LiveClassServiceDeps) {
  const clock = deps.clock ?? (() => new Date());

  return {
    async consoleSnapshot(actor: PortalActorContext, occurrenceKey?: string | undefined) {
      requireRabbi(actor);
      const session = await ensureSession(deps, actor, clock(), occurrenceKey);
      return snapshot(deps, actor, session.occurrence_key, clock());
    },

    async zoomHostBootstrap(actor: PortalActorContext, occurrenceKey?: string | undefined) {
      requireRabbi(actor);
      requireZoomHostControl(deps.config);
      if (!deps.zoomHostLaunchPort) {
        throw new PortalServiceError(
          'PROVIDER_NOT_READY',
          'Meeting SDK host control is not ready.',
        );
      }
      const now = clock();
      const session = await ensureSession(deps, actor, now, occurrenceKey);
      return deps.zoomHostLaunchPort.resolveHostLaunch({
        occurrenceKey: session.occurrence_key,
        now,
      });
    },

    async zoomTestParticipantBootstrap(
      actor: PortalActorContext,
      _studentNumber: number,
      _occurrenceKey?: string | undefined,
    ) {
      requireRabbi(actor);
      throw new PortalServiceError(
        'FORBIDDEN',
        'Zoom learners must join from their own protected Student session.',
      );
    },

    async syncZoomParticipants(
      actor: PortalActorContext,
      payload: LiveClassZoomParticipantSyncPayload,
    ) {
      requireRabbi(actor);
      requireZoomHostControl(deps.config);
      const mappings: Array<{ participant_key: string; customer_key: string }> = [];
      for (const item of payload.participants) {
        const existing = await deps.repository.getParticipantByCustomerKey({
          actor,
          occurrence_key: payload.occurrence_key,
          customer_key: item.customer_key,
        });
        if (!existing) {
          throw new PortalServiceError(
            'FORBIDDEN',
            'The Zoom participant is not mapped to this class occurrence.',
          );
        }
        const participant = await deps.repository.upsertParticipant({
          actor,
          occurrence_key: payload.occurrence_key,
          participant_key: existing.participant_key,
          learner_key: existing.learner_key,
          customer_key: existing.customer_key,
          approved_display_name: existing.approved_display_name,
          join_state: item.join_state,
          audio_state: item.audio_state,
          video_state: item.video_state,
          active_speaker: item.active_speaker,
          spotlighted: item.spotlighted,
          participant_id_digest: sha256(item.provider_user_id),
        });
        mappings.push({
          participant_key: participant.participant_key,
          customer_key: participant.customer_key,
        });
      }
      return { mappings };
    },

    async stageSnapshot(stageSession: string) {
      const stage = await deps.repository.getStage({
        actor: publicScope(deps.config),
        stage_session: stageSession,
      });
      if (!stage) {
        throw new PortalServiceError('NOT_FOUND', 'The live stage session was not found.');
      }
      return stage;
    },

    async submitQuestion(actor: PortalActorContext, payload: LiveClassQuestionSubmitPayload) {
      requireStudent(actor);
      const now = clock();
      const session = await ensureSession(deps, actor, now, payload.occurrence_key);
      const studentLearner = actor.student_learner;
      if (!studentLearner) {
        throw new PortalServiceError('FORBIDDEN', 'This student session cannot submit a question.');
      }
      const learner = await deps.repository.getLearner({
        actor,
        learner_key: studentLearner.learner_key,
      });
      if (!learner) {
        throw new PortalServiceError('NOT_FOUND', 'The student learner was not found.');
      }
      const approvedDisplayName = sanitizeDisplayName(
        payload.approved_display_name ?? learner.display_name,
      );
      const questionPreview = redactQuestionPreview(payload.body);
      const questionKey = stableKey('live_question', [
        actor.account_key,
        actor.product_key,
        learner.learner_key,
        session.occurrence_key,
        payload.idempotency_key,
      ]);
      const customerKey = zoomCustomerKey([session.occurrence_key, learner.learner_key]);
      const protectedBody = deps.questionCodec
        ? await deps.questionCodec.encrypt(
            { body: payload.body, preview: questionPreview },
            liveQuestionCodecContext(deps.config, actor, session.occurrence_key, learner),
          )
        : null;
      const request_hash = requestDigest({
        occurrence_key: session.occurrence_key,
        learner_key: learner.learner_key,
        body: payload.body,
      });
      const result = await deps.repository.submitQuestion({
        actor,
        learner,
        question_key: questionKey,
        occurrence_key: session.occurrence_key,
        approved_display_name: approvedDisplayName,
        question_body_ciphertext: protectedBody?.ciphertext ?? null,
        question_body_digest: protectedBody?.digest ?? sha256(payload.body),
        question_preview: questionPreview,
        customer_key: customerKey,
        class_label: session.class_label,
        idempotency_key: payload.idempotency_key,
        request_hash,
      });
      await deps.repository.upsertParticipant({
        actor,
        occurrence_key: session.occurrence_key,
        participant_key: stableKey('zoom_participant', [session.occurrence_key, customerKey]),
        learner_key: learner.learner_key,
        customer_key: customerKey,
        approved_display_name: approvedDisplayName,
        join_state: 'waiting',
        audio_state: 'muted',
        video_state: 'off',
        active_speaker: false,
        spotlighted: false,
      });
      await deps.repository.recordAudit({
        actor,
        occurrence_key: session.occurrence_key,
        learner_key: learner.learner_key,
        question_key: result.question.question_key,
        event_type: result.replay ? 'live_question_submit_replay' : 'live_question_submitted',
        metadata: { preview: result.question.question_preview },
      });
      return { question: result.question, moderator_alert_queued: false };
    },

    async listQuestions(actor: PortalActorContext, occurrenceKey?: string | undefined) {
      const now = clock();
      const session = await ensureSession(deps, actor, now, occurrenceKey);
      if (isRabbi(actor)) {
        return deps.repository.listQuestions({ actor, occurrence_key: session.occurrence_key });
      }
      requireStudent(actor);
      const learnerKey = actor.student_learner?.learner_key;
      if (!learnerKey) {
        throw new PortalServiceError('FORBIDDEN', 'This student session cannot read questions.');
      }
      return deps.repository.listOwnQuestions({
        actor,
        occurrence_key: session.occurrence_key,
        learner_key: learnerKey,
      });
    },

    async selectQuestion(actor: PortalActorContext, questionKey: string, idempotencyKey: string) {
      requireRabbi(actor);
      const now = clock();
      const question = await deps.repository.selectQuestion({
        actor,
        question_key: questionKey,
        now,
      });
      await deps.repository.setStage({
        actor,
        occurrence_key: question.occurrence_key,
        question_key: question.question_key,
        scene: 'OT - Slides',
        state: 'slides',
      });
      const participant = await ensureQuestionParticipant(deps, actor, question);
      const command = await enqueueSignedCommand(deps, actor, {
        occurrence_key: question.occurrence_key,
        command_type: 'spotlight_remove',
        target_question_key: question.question_key,
        target_participant_key: participant.participant_key,
        obs_scene: null,
        idempotency_key: `${idempotencyKey}:select-clear-spotlight`,
        now,
      });
      await deps.repository.recordAudit({
        actor,
        occurrence_key: question.occurrence_key,
        learner_key: question.learner_key,
        question_key: question.question_key,
        event_type: 'live_question_selected',
        metadata: { command_key: command.command.command_key },
      });
      return commandResponse(deps, actor, question, [command.command], now);
    },

    async markReady(
      actor: PortalActorContext,
      questionKey: string,
      payload: LiveClassQuestionReadyPayload,
    ) {
      requireStudent(actor);
      const question = await deps.repository.getQuestion({ actor, question_key: questionKey });
      if (!question) {
        throw new PortalServiceError('NOT_FOUND', 'The selected question was not found.');
      }
      if (question.learner_key !== actor.student_learner?.learner_key) {
        throw new PortalServiceError('FORBIDDEN', 'This student cannot ready that question.');
      }
      const ready = await deps.repository.markStudentReady({
        actor,
        question_key: questionKey,
        ready: payload.ready,
        mic_ready: payload.ready ? (payload.mic_ready ?? true) : false,
        video_ready: payload.ready ? (payload.video_ready ?? true) : false,
        now: clock(),
      });
      await ensureQuestionParticipant(
        deps,
        actor,
        ready,
        zoomAdapterMode(deps.config) === 'fake'
          ? {
              join_state: payload.ready ? 'joined' : 'waiting',
              audio_state: payload.ready && ready.mic_ready ? 'muted' : 'unknown',
              video_state: payload.ready && ready.video_ready ? 'on' : 'off',
              active_speaker: false,
              spotlighted: false,
            }
          : {},
      );
      await deps.repository.recordAudit({
        actor,
        occurrence_key: ready.occurrence_key,
        learner_key: ready.learner_key,
        question_key: ready.question_key,
        event_type: payload.ready ? 'live_student_ready' : 'live_student_declined',
        metadata: payload.decline_reason ? { decline_reason: payload.decline_reason } : {},
      });
      return ready;
    },

    async goLive(actor: PortalActorContext, questionKey: string, idempotencyKey: string) {
      requireRabbi(actor);
      const now = clock();
      const existing = await deps.repository.getQuestion({ actor, question_key: questionKey });
      if (!existing) {
        throw new PortalServiceError('NOT_FOUND', 'The selected question was not found.');
      }
      if (existing.status !== 'student_ready') {
        throw new PortalServiceError(
          'VALIDATION_ERROR',
          'The student must tap ready before the stage can feature them.',
        );
      }
      const participantBefore = await ensureQuestionParticipant(deps, actor, existing);
      requireParticipantReadyForSpotlight(participantBefore);
      const question = await deps.repository.markQuestionLive({
        actor,
        question_key: questionKey,
        now,
      });
      await deps.repository.setStage({
        actor,
        occurrence_key: question.occurrence_key,
        question_key: question.question_key,
        scene: 'OT - Featured Student',
        state: 'student_featured',
      });
      const participant = await ensureQuestionParticipant(deps, actor, question);
      const commands = await Promise.all([
        enqueueSignedCommand(deps, actor, {
          occurrence_key: question.occurrence_key,
          command_type: 'spotlight_replace',
          target_question_key: question.question_key,
          target_participant_key: participant.participant_key,
          obs_scene: null,
          idempotency_key: `${idempotencyKey}:spotlight-replace`,
          now,
        }),
        enqueueSignedCommand(deps, actor, {
          occurrence_key: question.occurrence_key,
          command_type: 'ask_unmute',
          target_question_key: question.question_key,
          target_participant_key: participant.participant_key,
          obs_scene: null,
          idempotency_key: `${idempotencyKey}:ask-unmute`,
          now,
        }),
        enqueueSignedCommand(deps, actor, {
          occurrence_key: question.occurrence_key,
          command_type: 'obs_switch_scene',
          target_question_key: question.question_key,
          target_participant_key: participant.participant_key,
          obs_scene: 'OT - Featured Student',
          idempotency_key: `${idempotencyKey}:obs-feature-student`,
          now,
        }),
      ]);
      await deps.repository.recordAudit({
        actor,
        occurrence_key: question.occurrence_key,
        learner_key: question.learner_key,
        question_key: question.question_key,
        event_type: 'live_question_featured',
        metadata: { command_keys: commands.map(({ command }) => command.command_key) },
      });
      await executeFakeZoomCommands(
        deps,
        actor,
        question,
        commands.map(({ command }) => command),
        now,
      );
      return commandResponse(
        deps,
        actor,
        question,
        commands.map(({ command }) => command),
        now,
      );
    },

    async completeQuestion(
      actor: PortalActorContext,
      questionKey: string,
      payload: LiveClassQuestionCompletePayload,
    ) {
      requireRabbi(actor);
      const now = clock();
      const question = await deps.repository.completeQuestion({
        actor,
        question_key: questionKey,
        resolution: payload.resolution,
        now,
      });
      await deps.repository.setStage({
        actor,
        occurrence_key: question.occurrence_key,
        question_key: null,
        scene: 'OT - Slides',
        state: 'slides',
      });
      const participant = await ensureQuestionParticipant(deps, actor, question);
      const commands = await Promise.all([
        enqueueSignedCommand(deps, actor, {
          occurrence_key: question.occurrence_key,
          command_type: 'spotlight_remove',
          target_question_key: question.question_key,
          target_participant_key: participant.participant_key,
          obs_scene: null,
          idempotency_key: `${payload.idempotency_key}:spotlight-remove`,
          now,
        }),
        enqueueSignedCommand(deps, actor, {
          occurrence_key: question.occurrence_key,
          command_type: 'obs_switch_scene',
          target_question_key: question.question_key,
          target_participant_key: participant.participant_key,
          obs_scene: 'OT - Slides',
          idempotency_key: `${payload.idempotency_key}:obs-slides`,
          now,
        }),
      ]);
      await deps.repository.recordAudit({
        actor,
        occurrence_key: question.occurrence_key,
        learner_key: question.learner_key,
        question_key: question.question_key,
        event_type: `live_question_${payload.resolution}`,
        metadata: { command_keys: commands.map(({ command }) => command.command_key) },
      });
      await executeFakeZoomCommands(
        deps,
        actor,
        question,
        commands.map(({ command }) => command),
        now,
      );
      return commandResponse(
        deps,
        actor,
        question,
        commands.map(({ command }) => command),
        now,
      );
    },

    async zoomControl(actor: PortalActorContext, payload: LiveClassZoomControlPayload) {
      requireRabbi(actor);
      const now = clock();
      if (!payload.question_key) {
        throw new PortalServiceError(
          'VALIDATION_ERROR',
          'A selected student question is required for Zoom control.',
        );
      }
      const question = await deps.repository.getQuestion({
        actor,
        question_key: payload.question_key,
      });
      if (!question) {
        throw new PortalServiceError('NOT_FOUND', 'The selected question was not found.');
      }
      const participant = await ensureQuestionParticipant(deps, actor, question);
      if (payload.participant_key && participant?.participant_key !== payload.participant_key) {
        throw new PortalServiceError('FORBIDDEN', 'The participant target does not match.');
      }
      validateZoomOperation(payload.operation, question, participant);
      const command = await enqueueSignedCommand(deps, actor, {
        occurrence_key: question.occurrence_key,
        command_type: payload.operation,
        target_question_key: question.question_key,
        target_participant_key: participant.participant_key,
        obs_scene: null,
        idempotency_key: payload.idempotency_key,
        now,
      });
      if (command.replay) {
        throw new PortalServiceError('IDEMPOTENCY_CONFLICT', 'The Zoom command was replayed.');
      }
      await deps.repository.recordAudit({
        actor,
        occurrence_key: question?.occurrence_key ?? command.command.occurrence_key,
        learner_key: question?.learner_key ?? null,
        question_key: question?.question_key ?? null,
        event_type: `live_zoom_${payload.operation}`,
        metadata: {
          command_key: command.command.command_key,
          rest_api_used: false,
          video_start_model: 'PARTICIPANT_CONSENT',
        },
      });
      await executeFakeZoomCommands(deps, actor, question, [command.command], now);
      return commandResponse(deps, actor, question, [command.command], now);
    },

    async obsCommand(actor: PortalActorContext, payload: LiveClassObsCommandPayload) {
      requireRabbi(actor);
      const now = clock();
      const session = await ensureSession(deps, actor, now);
      const question = payload.question_key
        ? await deps.repository.getQuestion({ actor, question_key: payload.question_key })
        : null;
      const scene = obsSceneForAction(payload.action);
      await deps.repository.setStage({
        actor,
        occurrence_key: question?.occurrence_key ?? session.occurrence_key,
        question_key:
          payload.action === 'emergency_reset' || payload.action === 'done'
            ? null
            : (question?.question_key ?? null),
        scene,
        state: payload.action === 'feature_student' ? 'student_featured' : 'slides',
      });
      const command = await enqueueSignedCommand(deps, actor, {
        occurrence_key: question?.occurrence_key ?? session.occurrence_key,
        command_type: 'obs_switch_scene',
        target_question_key: question?.question_key ?? null,
        target_participant_key: null,
        obs_scene: scene,
        idempotency_key: payload.idempotency_key,
        now,
      });
      await deps.repository.recordAudit({
        actor,
        occurrence_key: question?.occurrence_key ?? session.occurrence_key,
        learner_key: question?.learner_key ?? null,
        question_key: question?.question_key ?? null,
        event_type: `live_obs_${payload.action}`,
        metadata: { command_key: command.command.command_key, scene },
      });
      return commandResponse(deps, actor, question, [command.command], now);
    },

    async pollObsCommands(
      actor: Pick<PortalActorContext, 'account_key' | 'product_key'>,
      occurrenceKey: string,
    ) {
      return deps.repository.listPendingCommands({
        actor,
        occurrence_key: occurrenceKey,
        now: clock(),
      });
    },

    async pollZoomCommands(actor: PortalActorContext, occurrenceKey: string) {
      requireRabbi(actor);
      requireZoomHostControl(deps.config);
      return deps.repository.listPendingZoomCommands({
        actor,
        occurrence_key: occurrenceKey,
        now: clock(),
      });
    },

    async reportZoomCommand(actor: PortalActorContext, payload: LiveClassObsCommandReportPayload) {
      requireRabbi(actor);
      const command = await deps.repository.reportCommand({ actor, payload, now: clock() });
      if (!command) {
        throw new PortalServiceError('FORBIDDEN', 'The live command was stale or replayed.');
      }
      return { accepted: true };
    },

    async reportObsCommand(
      actor: Pick<PortalActorContext, 'account_key' | 'product_key'>,
      payload: LiveClassObsCommandReportPayload,
    ) {
      const accepted = await deps.repository.reportCommand({
        actor,
        payload,
        now: clock(),
      });
      if (!accepted) {
        throw new PortalServiceError('FORBIDDEN', 'The live command was stale or replayed.');
      }
      return { accepted: true };
    },
  };
}

async function ensureSession(
  deps: LiveClassServiceDeps,
  actor: Pick<PortalActorContext, 'account_key' | 'product_key'>,
  now: Date,
  occurrenceKey?: string | undefined,
) {
  return deps.repository.ensureLiveSession({
    actor,
    ...(occurrenceKey ? { occurrence_key: occurrenceKey } : {}),
    now,
    expires_at: new Date(now.getTime() + 6 * 60 * 60_000),
  });
}

async function snapshot(
  deps: LiveClassServiceDeps,
  actor: Pick<PortalActorContext, 'account_key' | 'product_key'>,
  occurrenceKey: string,
  now: Date,
): Promise<LiveClassConsoleSnapshot> {
  const [questions, participants] = await Promise.all([
    deps.repository.listQuestions({ actor, occurrence_key: occurrenceKey }),
    deps.repository.listParticipants({ actor, occurrence_key: occurrenceKey }),
  ]);
  const selectedQuestion =
    questions.find((question) => ['selected', 'student_ready', 'live'].includes(question.status)) ??
    null;
  const participant = selectedQuestion
    ? (participants.find((item) => item.customer_key === selectedQuestion.customer_key) ?? null)
    : null;
  const session = await deps.repository.ensureLiveSession({
    actor,
    occurrence_key: occurrenceKey,
    now,
    expires_at: new Date(now.getTime() + 6 * 60 * 60_000),
  });
  const stage: LiveClassStageState = {
    stage_session: session.stage_session,
    occurrence_key: occurrenceKey,
    surface_label: LIVE_CLASS_STAGE_SURFACE_LABEL,
    class_label: selectedQuestion?.class_label ?? session.class_label,
    current_scene: selectedQuestion?.status === 'live' ? 'OT - Featured Student' : 'OT - Slides',
    selected_question: selectedQuestion,
    selected_participant: participant,
    mic_ready: selectedQuestion?.mic_ready ?? false,
    video_ready: selectedQuestion?.video_ready ?? false,
    private_portal_visible: false,
  };
  const mode = zoomAdapterMode(deps.config);
  const zoomReadiness = inspectZoomHostControlReadiness(deps.config);
  const firstQuestion =
    questions.find((question) => question.status === 'submitted') ?? selectedQuestion;
  return {
    success: true,
    data: {
      occurrence_key: occurrenceKey,
      mode,
      questions,
      selected_question: selectedQuestion,
      participants,
      stage,
      zoom: {
        host_surface_label: LIVE_CLASS_STAGE_SURFACE_LABEL,
        provider: 'meeting_sdk',
        adapter: mode,
        sdk_credentials_configured: zoomReadiness.phases.sdk_app.ready,
        host_control_configured: zoomReadiness.ready,
        readiness: zoomReadiness,
        live_control_uses_rest_api: false,
        can_force_camera_on: false,
        video_start_model: 'PARTICIPANT_CONSENT',
        setup_job: zoomReadiness.ready ? null : zoomSetupJob(),
      },
      obs: {
        bridge_required: false,
        connected: false,
        current_scene: stage.current_scene,
        allowed_scenes: [...CANONICAL_OBS_SCENES],
        canonical_sources: [...CANONICAL_OBS_SOURCES],
        one_click_setup: 'tools/obs-bridge/README.md',
        last_result: null,
      },
      telegram: {
        enabled: false,
        source_of_truth: false,
        card_preview: firstQuestion
          ? {
              student_safe_label: firstQuestion.approved_display_name,
              question_preview: firstQuestion.question_preview,
              actions: ['Open Live Console', 'Select', 'Keep Private', 'Reject'],
            }
          : null,
      },
      audit_ref: stableKey('live_audit_view', [occurrenceKey, now.toISOString()]),
    },
  };
}

async function commandResponse(
  deps: LiveClassServiceDeps,
  actor: Pick<PortalActorContext, 'account_key' | 'product_key'>,
  question: LiveClassQuestion | null,
  commands: LiveClassControlCommand[],
  now: Date,
): Promise<LiveClassCommandResponse['data']> {
  const session = await deps.repository.ensureLiveSession({
    actor,
    occurrence_key: question?.occurrence_key ?? commands[0]?.occurrence_key,
    now,
    expires_at: new Date(now.getTime() + 6 * 60 * 60_000),
  });
  const stage =
    (await deps.repository.getStage({ actor, stage_session: session.stage_session })) ??
    emptyStage(session);
  return { question, stage, commands };
}

async function enqueueSignedCommand(
  deps: LiveClassServiceDeps,
  actor: Pick<PortalActorContext, 'account_key' | 'product_key' | 'actor_user_ref'>,
  input: {
    occurrence_key: string;
    command_type: LiveClassControlCommand['command_type'];
    target_question_key: string | null;
    target_participant_key: string | null;
    obs_scene: LiveClassObsScene | null;
    idempotency_key: string;
    now: Date;
  },
) {
  const commandKey = stableKey('live_command', [
    actor.account_key,
    actor.product_key,
    input.occurrence_key,
    input.command_type,
    input.idempotency_key,
  ]);
  const nonce = stableKey('live_nonce', [commandKey, input.now.toISOString()]);
  const expiresAt = new Date(input.now.getTime() + 45_000);
  const request_hash = requestDigest({
    occurrence_key: input.occurrence_key,
    command_type: input.command_type,
    target_question_key: input.target_question_key,
    target_participant_key: input.target_participant_key,
    obs_scene: input.obs_scene,
  });
  const signature = signCommand(deps.config, {
    command_key: commandKey,
    command_type: input.command_type,
    occurrence_key: input.occurrence_key,
    target_question_key: input.target_question_key,
    target_participant_key: input.target_participant_key,
    obs_scene: input.obs_scene,
    nonce,
    expires_at: expiresAt.toISOString(),
  });
  return deps.repository.enqueueCommand({
    actor,
    command: {
      command_key: commandKey,
      command_type: input.command_type,
      occurrence_key: input.occurrence_key,
      target_question_key: input.target_question_key,
      target_participant_key: input.target_participant_key,
      obs_scene: input.obs_scene,
      idempotency_key: input.idempotency_key,
      request_hash,
      nonce,
      signature,
      expires_at: expiresAt,
      created_by_user_ref: actor.actor_user_ref,
    },
  });
}

async function ensureQuestionParticipant(
  deps: LiveClassServiceDeps,
  actor: Pick<PortalActorContext, 'account_key' | 'product_key'>,
  question: LiveClassQuestion,
  patch: Partial<
    Pick<
      LiveClassParticipant,
      'join_state' | 'audio_state' | 'video_state' | 'active_speaker' | 'spotlighted'
    >
  > = {},
) {
  const existing = await deps.repository.getParticipantByCustomerKey({
    actor,
    occurrence_key: question.occurrence_key,
    customer_key: question.customer_key,
  });
  return deps.repository.upsertParticipant({
    actor,
    occurrence_key: question.occurrence_key,
    participant_key:
      existing?.participant_key ??
      stableKey('zoom_participant', [question.occurrence_key, question.customer_key]),
    learner_key: question.learner_key,
    customer_key: question.customer_key,
    approved_display_name: question.approved_display_name,
    join_state: patch.join_state ?? existing?.join_state ?? 'joined',
    audio_state: patch.audio_state ?? existing?.audio_state ?? 'muted',
    video_state:
      patch.video_state ?? existing?.video_state ?? (question.video_ready ? 'on' : 'off'),
    active_speaker: patch.active_speaker ?? existing?.active_speaker ?? false,
    spotlighted: patch.spotlighted ?? existing?.spotlighted ?? false,
  });
}

async function executeFakeZoomCommands(
  deps: LiveClassServiceDeps,
  actor: Pick<PortalActorContext, 'account_key' | 'product_key'>,
  question: LiveClassQuestion,
  commands: LiveClassControlCommand[],
  now: Date,
) {
  if (zoomAdapterMode(deps.config) !== 'fake') return;
  for (const command of commands) {
    if (command.command_type === 'obs_switch_scene') continue;
    const accepted = await deps.repository.reportCommand({
      actor,
      payload: {
        command_key: command.command_key,
        nonce: command.nonce,
        signature: command.signature,
        status: 'executed',
        result: 'fake adapter executed',
      },
      now,
    });
    if (!accepted) {
      throw new PortalServiceError('FORBIDDEN', 'The fake Zoom command was stale or replayed.');
    }
    await ensureQuestionParticipant(deps, actor, question, fakeZoomPatch(command.command_type));
  }
}

function validateZoomOperation(
  operation: LiveClassZoomControlPayload['operation'],
  question: LiveClassQuestion,
  participant: LiveClassParticipant,
) {
  if (participant.join_state !== 'joined') {
    throw new PortalServiceError('VALIDATION_ERROR', 'The selected participant is not joined.');
  }
  if (operation === 'spotlight_replace') {
    if (question.status !== 'student_ready' && question.status !== 'live') {
      throw new PortalServiceError(
        'VALIDATION_ERROR',
        'The student must tap ready before spotlight is allowed.',
      );
    }
    requireParticipantReadyForSpotlight(participant);
  }
  if (operation === 'stop_video' && participant.video_state !== 'on') {
    throw new PortalServiceError('VALIDATION_ERROR', 'The participant video is not on.');
  }
}

function requireParticipantReadyForSpotlight(participant: LiveClassParticipant) {
  if (participant.join_state !== 'joined' || participant.video_state !== 'on') {
    throw new PortalServiceError(
      'VALIDATION_ERROR',
      'Spotlight requires a joined participant who has started video.',
    );
  }
}

function fakeZoomPatch(operation: LiveClassControlCommand['command_type']) {
  if (operation === 'mute') return { audio_state: 'muted' } as const;
  if (operation === 'spotlight_replace') return { spotlighted: true } as const;
  if (operation === 'spotlight_remove') return { spotlighted: false } as const;
  if (operation === 'stop_video') return { video_state: 'off' } as const;
  return {};
}

function requireStudent(actor: PortalActorContext) {
  if (actor.actor_role !== 'student' || !actor.student_learner) {
    throw new PortalServiceError('FORBIDDEN', 'This live classroom action requires a student.');
  }
}

function requireRabbi(actor: PortalActorContext) {
  if (!isRabbi(actor)) {
    throw new PortalServiceError(
      'FORBIDDEN',
      'The live console requires Administrator or Rabbi access.',
    );
  }
}

function isRabbi(actor: PortalActorContext) {
  return (
    actor.actor_role === 'owner' || actor.actor_role === 'admin' || actor.actor_role === 'rabbi'
  );
}

function publicScope(config: AppConfig) {
  return { account_key: config.accountKey, product_key: config.productKey };
}

function zoomHostControlConfigured(config: AppConfig) {
  return inspectZoomHostControlReadiness(config).ready;
}

function zoomAdapterMode(config: AppConfig): 'fake' | 'meeting_sdk_host' {
  return zoomHostControlConfigured(config) ? 'meeting_sdk_host' : 'fake';
}

function requireZoomHostControl(config: AppConfig) {
  const readiness = inspectZoomHostControlReadiness(config);
  if (readiness.ready) return;
  throw new PortalServiceError(
    readiness.code === 'PROVIDER_OFF' ? 'PROVIDER_OFF' : 'PROVIDER_NOT_READY',
    readiness.code === 'PROVIDER_OFF'
      ? 'Real Zoom host control is disabled by runtime or provider policy.'
      : 'Real Zoom host control prerequisites are incomplete.',
  );
}

function zoomSetupJob(): NonNullable<LiveClassConsoleSnapshot['data']['zoom']['setup_job']> {
  return {
    job_key: 'ZOOM-UI-01',
    title: 'Complete Zoom real-control readiness',
    status: 'operator_action_required',
    scopes: [
      'General app with Meeting SDK enabled',
      'Development Client ID and Client Secret',
      'Host/co-host in-meeting control from Meeting SDK session',
      'Participant roster, audio/video state, active speaker, and spotlight events',
    ],
    storage_instruction:
      'Store canonical SDK, exact origin, S2S, host, meeting, and passcode values only in protected governed configuration.',
    steps: [
      'Keep the existing admin-managed General app; do not create another Zoom app.',
      'Bind PUBLIC_BASE_URL and ZOOM_MEETING_SDK_ALLOWED_ORIGIN to the same exact HTTPS origin already allowlisted in the General app.',
      'Use only ZOOM_MEETING_SDK_CLIENT_ID, ZOOM_MEETING_SDK_CLIENT_SECRET, and ZOOM_MEETING_SDK_WEB_VERSION as the canonical SDK contract.',
      'After rotating the exposed protected class target, configure the protected S2S account/client, host, isolated meeting, and passcode prerequisites.',
      'Confirm the protected host is authorized for the isolated meeting without using the Rabbi recurring meeting.',
      'Bind ZOOM_CLASSROOM_CANARY_LEARNER_KEY to the one authorized fictional Student before enabling the canary.',
      'Set ZOOM_CLASSROOM_CANARY_ENABLED=true only for that explicitly authorized isolated-staging canary, then disable it after proof.',
    ],
  };
}

function sanitizeDisplayName(value: string) {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.slice(0, 160) || 'Student';
}

function redactQuestionPreview(value: string) {
  const normalized = value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[redacted]')
    .replace(/https?:\/\/\S+/gi, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.slice(0, 180) || '[redacted]';
}

function liveQuestionCodecContext(
  config: AppConfig,
  actor: PortalActorContext,
  occurrenceKey: string,
  learner: LiveClassLearnerRecord,
): SensitivePayloadContext {
  return {
    botKey: 'live_class_question' as never,
    environment: config.oneTimeTelegramEnvironment,
    accountKey: actor.account_key,
    productKey: actor.product_key,
    actorKey: learner.learner_key,
    classification: `live-class-question:${occurrenceKey}` as never,
  };
}

function obsSceneForAction(action: LiveClassObsCommandPayload['action']): LiveClassObsScene {
  if (action === 'feature_student') return 'OT - Featured Student';
  return 'OT - Slides';
}

function emptyStage(session: LiveClassSessionRecord): LiveClassStageState {
  return {
    stage_session: session.stage_session,
    occurrence_key: session.occurrence_key,
    surface_label: LIVE_CLASS_STAGE_SURFACE_LABEL,
    class_label: session.class_label,
    current_scene: 'OT - Slides',
    selected_question: null,
    selected_participant: null,
    mic_ready: false,
    video_ready: false,
    private_portal_visible: false,
  };
}

function signCommand(
  config: AppConfig,
  input: {
    command_key: string;
    command_type: string;
    occurrence_key: string;
    target_question_key: string | null;
    target_participant_key: string | null;
    obs_scene: string | null;
    nonce: string;
    expires_at: string;
  },
) {
  return createHmac('sha256', `${config.authCsrfSecret}:${LIVE_CLASS_POLICY_VERSION}`)
    .update(
      [
        input.command_key,
        input.command_type,
        input.occurrence_key,
        input.target_question_key ?? '',
        input.target_participant_key ?? '',
        input.obs_scene ?? '',
        input.nonce,
        input.expires_at,
      ].join('\u001f'),
    )
    .digest('base64url');
}

export function verifySignedLiveClassCommand(
  config: AppConfig,
  command: Pick<
    LiveClassControlCommand,
    | 'command_key'
    | 'command_type'
    | 'occurrence_key'
    | 'target_question_key'
    | 'target_participant_key'
    | 'obs_scene'
    | 'nonce'
    | 'signature'
    | 'expires_at'
  >,
  now: Date,
) {
  if (new Date(command.expires_at).getTime() <= now.getTime()) return false;
  const expected = signCommand(config, {
    command_key: command.command_key,
    command_type: command.command_type,
    occurrence_key: command.occurrence_key,
    target_question_key: command.target_question_key,
    target_participant_key: command.target_participant_key,
    obs_scene: command.obs_scene,
    nonce: command.nonce,
    expires_at: command.expires_at,
  });
  const left = Buffer.from(sha256(expected), 'hex');
  const right = Buffer.from(sha256(command.signature), 'hex');
  return timingSafeEqual(left, right);
}

function requestDigest(payload: Record<string, unknown>) {
  return sha256(JSON.stringify(payload));
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
