import { createHmac, randomUUID } from 'node:crypto';
import type { AppConfig } from '../../../config/src/index.ts';
import type {
  ActionGatewayEventV1,
  ClassroomAttendanceEventPayload,
  ClassroomJoinState,
  ClassroomLaunchBootstrapPayload,
  ClassroomLaunchBootstrapResponse,
  ClassroomProviderState,
  ClassroomQuestion,
  ClassroomQuestionSubmitPayload,
  ClassroomQuestionSubmitResponse,
  ClassroomSelectedView,
} from '../../../contracts/src/index.ts';
import { assertActionGatewayEventV1 } from '../../../contracts/src/action-gateway/events.ts';
import type { LearnerProfile, PortalActorContext } from '../../../contracts/src/portals/index.ts';
import type {
  SensitivePayloadCodec,
  SensitivePayloadContext,
} from '../../../contracts/src/telegram/types.ts';
import type { LearnerClassAccessAdapter } from '../portals/services.ts';
import { PortalServiceError, fingerprint } from '../portals/services.ts';
import { stableKey } from '../lead/normalize.ts';
import { resolveDailyClassWindow, type DailyClassWindow } from '../classes/schedule.ts';
import {
  createDeterministicReminderDeliveryPort,
  createDeterministicZoomMeetingLaunchPort,
  createDeterministicZoomRegistrantPort,
  createDisabledZoomAttendanceReconciliationPort,
  createDisabledZoomFeatureParticipantPort,
  createZoomProviderReadinessPort,
  type ReminderDeliveryPort,
  type ZoomAttendanceReconciliationPort,
  type ZoomFeatureParticipantPort,
  type ZoomMeetingLaunchPort,
  type ZoomProviderReadinessPort,
  type ZoomRegistrantPort,
} from '../providers/zoom.ts';

export const CLASSROOM_POLICY_VERSION = 'ot88-classroom-v1';
export const CLASSROOM_HOST_POLICY_VERSION = 'ot88-host-policy-v1';

export type ClassroomOccurrenceRecord = {
  occurrence_key: string;
  class_series_key: string;
  title: string;
  local_class_date: string;
  timezone: 'Asia/Jerusalem';
  starts_at: string;
  reminder_due_at: string;
  join_opens_at: string;
  scheduled_ends_at: string;
  join_closes_at: string;
  occurrence_state: 'scheduled' | 'live' | 'completed' | 'cancelled';
  access_state: string;
};

export type ClassroomEligibility = {
  account_key: string;
  product_key: string;
  household_key: string;
  learner_key: string;
  display_name: string;
  learner_status: 'active' | 'archived' | 'suspended';
  household_status: 'active' | 'archived';
  student_access_status: string | null;
  entitlement_state: 'active' | 'suspended' | 'revoked' | null;
  consent_status: 'not_required' | 'granted' | 'missing' | 'revoked';
  active_learner_count: number;
};

export type ClassroomLaunchGrantRecord = {
  grant_key: string;
  account_key: string;
  product_key: string;
  household_key: string;
  learner_key: string;
  occurrence_key: string;
  actor_user_ref: string;
  session_key_digest: string;
  status: 'issued' | 'consumed' | 'expired' | 'revoked';
  idempotency_key: string;
  provider_mode: 'sink' | 'real';
  expires_at: string;
  consumed_at: string | null;
};

export type ClassroomAttendanceAttemptRecord = {
  attempt_key: string;
  selected_view: ClassroomSelectedView;
};

export type ClassroomQuestionModerationResult = {
  question: ClassroomQuestion;
  provider_action_state: 'disabled' | 'queued';
};

export type ClassroomRepository = {
  ensureDailyOccurrence(args: {
    actor: Pick<PortalActorContext, 'account_key' | 'product_key'>;
    window: DailyClassWindow;
    durationMinutes: number;
    joinOpenOffsetMinutes: number;
    joinCloseOffsetMinutes: number;
  }): Promise<ClassroomOccurrenceRecord>;
  getOccurrence(args: {
    actor: Pick<PortalActorContext, 'account_key' | 'product_key'>;
    occurrence_key: string;
  }): Promise<ClassroomOccurrenceRecord | null>;
  getLearnerEligibility(args: {
    actor: PortalActorContext;
    learner_key: string;
  }): Promise<ClassroomEligibility | null>;
  issueLaunchGrant(args: {
    actor: PortalActorContext;
    eligibility: ClassroomEligibility;
    occurrence: ClassroomOccurrenceRecord;
    grant_key: string;
    secret_digest: string;
    session_key_digest: string;
    idempotency_key: string;
    request_hash: string;
    provider_mode: 'sink' | 'real';
    now: Date;
    expires_at: Date;
  }): Promise<ClassroomLaunchGrantRecord>;
  consumeLaunchGrant(args: {
    actor: PortalActorContext;
    grant_key: string;
    secret_digest: string;
    session_key_digest: string;
    now: Date;
  }): Promise<ClassroomLaunchGrantRecord | null>;
  upsertAttendanceAttempt(args: {
    grant: ClassroomLaunchGrantRecord;
    selected_view: ClassroomSelectedView;
    provider_meeting_ref_digest: string;
    provider_registrant_ref_digest: string;
  }): Promise<ClassroomAttendanceAttemptRecord>;
  recordAttendanceEvent(args: {
    actor: PortalActorContext;
    payload: ClassroomAttendanceEventPayload;
  }): Promise<void>;
  submitQuestion(args: {
    actor: PortalActorContext;
    eligibility: ClassroomEligibility;
    occurrence: ClassroomOccurrenceRecord;
    question_key: string;
    body_ciphertext: string;
    body_digest: string;
    excerpt_redacted: string;
    idempotency_key: string;
    request_hash: string;
  }): Promise<{ question: ClassroomQuestion; replay: boolean }>;
  listOwnQuestions(args: {
    actor: PortalActorContext;
    learner_key: string;
    occurrence_key: string;
  }): Promise<ClassroomQuestion[]>;
  moderateQuestion(args: {
    actor_user_ref: string;
    actor_role: string;
    question_key: string;
    action_type: 'feature_next' | 'mark_answered' | 'dismiss';
    idempotency_key: string;
  }): Promise<ClassroomQuestion>;
  enqueueActionGatewayEvent(args: {
    event: ActionGatewayEventV1;
    actor_principal_id: string;
    actor_role: string;
  }): Promise<boolean>;
  scheduleDueReminders(args: {
    actor: Pick<
      PortalActorContext,
      'account_key' | 'product_key' | 'actor_user_ref' | 'actor_role'
    >;
    occurrence: ClassroomOccurrenceRecord;
    now: Date;
  }): Promise<{ queued: number; suppressed: number }>;
  recordAudit(args: {
    actor: Pick<
      PortalActorContext,
      'account_key' | 'product_key' | 'actor_user_ref' | 'actor_role'
    >;
    household_key?: string | null;
    learner_key?: string | null;
    occurrence_key?: string | null;
    event_type: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
};

export type ClassroomServiceDeps = {
  config: AppConfig;
  repository: ClassroomRepository;
  questionCodec: SensitivePayloadCodec;
  zoomMeetingLaunchPort?: ZoomMeetingLaunchPort;
  zoomRegistrantPort?: ZoomRegistrantPort;
  zoomProviderReadinessPort?: ZoomProviderReadinessPort;
  zoomAttendanceReconciliationPort?: ZoomAttendanceReconciliationPort;
  zoomFeatureParticipantPort?: ZoomFeatureParticipantPort;
  reminderDeliveryPort?: ReminderDeliveryPort;
  clock?: () => Date;
};

export type ClassroomService = ReturnType<typeof createClassroomService>;

export function createClassroomService(deps: ClassroomServiceDeps) {
  const clock = deps.clock ?? (() => new Date());
  const zoomMeetingLaunchPort =
    deps.zoomMeetingLaunchPort ?? createDeterministicZoomMeetingLaunchPort();
  const zoomRegistrantPort = deps.zoomRegistrantPort ?? createDeterministicZoomRegistrantPort();
  const zoomProviderReadinessPort =
    deps.zoomProviderReadinessPort ?? createZoomProviderReadinessPort();
  const zoomAttendanceReconciliationPort =
    deps.zoomAttendanceReconciliationPort ?? createDisabledZoomAttendanceReconciliationPort();
  const zoomFeatureParticipantPort =
    deps.zoomFeatureParticipantPort ?? createDisabledZoomFeatureParticipantPort();
  const reminderDeliveryPort =
    deps.reminderDeliveryPort ?? createDeterministicReminderDeliveryPort();
  void zoomProviderReadinessPort;
  void zoomAttendanceReconciliationPort;
  void zoomFeatureParticipantPort;
  void reminderDeliveryPort;

  return {
    providerState: () => providerState(deps.config),

    async upcomingForLearner(args: { actor: PortalActorContext; learner: LearnerProfile }) {
      const now = clock();
      const occurrence = await nextOccurrence(deps.repository, args.actor, deps.config, now);
      const eligibility = await deps.repository.getLearnerEligibility({
        actor: args.actor,
        learner_key: args.learner.learner_key,
      });
      if (!eligibility) {
        throw new PortalServiceError('NOT_FOUND', 'The requested portal record was not found.');
      }
      const projection = occurrenceProjection({
        config: deps.config,
        occurrence,
        eligibility,
        now,
      });
      return projection;
    },

    async issuePortalLaunch(args: {
      actor: PortalActorContext;
      learner: LearnerProfile;
      class_key: string;
      idempotency_key?: string | undefined;
    }) {
      if (args.actor.actor_role !== 'student') {
        throw new PortalServiceError(
          'FORBIDDEN',
          'Learner classroom joins require the student session.',
        );
      }
      if (
        !args.actor.student_learner ||
        args.actor.student_learner.learner_key !== args.learner.learner_key
      ) {
        throw new PortalServiceError('FORBIDDEN', 'This student session cannot join that learner.');
      }
      const now = clock();
      const occurrence =
        (await deps.repository.getOccurrence({
          actor: args.actor,
          occurrence_key: args.class_key,
        })) ?? (await nextOccurrence(deps.repository, args.actor, deps.config, now));
      if (occurrence.occurrence_key !== args.class_key) {
        throw new PortalServiceError('NOT_FOUND', 'The requested classroom was not found.');
      }
      const eligibility = await deps.repository.getLearnerEligibility({
        actor: args.actor,
        learner_key: args.learner.learner_key,
      });
      if (!eligibility) {
        throw new PortalServiceError('NOT_FOUND', 'The requested portal record was not found.');
      }
      const projection = occurrenceProjection({
        config: deps.config,
        occurrence,
        eligibility,
        now,
      });
      assertCanJoin(projection.state);

      const idempotencyKey =
        args.idempotency_key ??
        stableKey('classroom_launch_idem', [
          args.actor.session_key,
          args.learner.learner_key,
          occurrence.occurrence_key,
        ]);
      const grantKey = stableKey('classroom_grant', [
        args.actor.actor_user_ref,
        args.actor.session_key,
        args.learner.learner_key,
        occurrence.occurrence_key,
        idempotencyKey,
      ]);
      const secret = deterministicGrantSecret(deps.config, {
        grantKey,
        actorUserRef: args.actor.actor_user_ref,
        sessionKey: args.actor.session_key,
        learnerKey: args.learner.learner_key,
        occurrenceKey: occurrence.occurrence_key,
        idempotencyKey,
      });
      const grantTtlSeconds = Math.min(
        5 * 60,
        Math.max(30, deps.config.zoomClassroomJoinGrantTtlSeconds),
      );
      const expiresAt = new Date(now.getTime() + grantTtlSeconds * 1000);
      const grant = await deps.repository.issueLaunchGrant({
        actor: args.actor,
        eligibility,
        occurrence,
        grant_key: grantKey,
        secret_digest: digestSecret(deps.config, secret),
        session_key_digest: digestSecret(deps.config, args.actor.session_key),
        idempotency_key: idempotencyKey,
        request_hash: fingerprint({
          actor: args.actor.actor_user_ref,
          learner: args.learner.learner_key,
          occurrence: occurrence.occurrence_key,
          provider_mode: deps.config.zoomClassroomProviderMode,
        }),
        provider_mode: deps.config.zoomClassroomProviderMode,
        now,
        expires_at: expiresAt,
      });
      await deps.repository.recordAudit({
        actor: args.actor,
        household_key: eligibility.household_key,
        learner_key: eligibility.learner_key,
        occurrence_key: occurrence.occurrence_key,
        event_type: 'launch_grant_issued',
        metadata: {
          grant_key: grant.grant_key,
          provider_mode: grant.provider_mode,
          raw_provider_target_present: false,
        },
      });
      return {
        action_key: stableKey('classroom_launch_action', [grant.grant_key]),
        label: 'Join class',
        kind: 'class_launch' as const,
        method: 'GET' as const,
        href: `/classroom/launch/${encodeURIComponent(grant.grant_key)}/${encodeURIComponent(
          secret,
        )}`,
        launch_token_ref: grant.grant_key,
        expires_at: grant.expires_at,
      };
    },

    async consumeLaunch(args: {
      actor: PortalActorContext;
      payload: ClassroomLaunchBootstrapPayload;
    }): Promise<ClassroomLaunchBootstrapResponse> {
      const parsed = parseLaunchPath(args.payload.launch_path);
      if (!parsed) {
        throw new PortalServiceError('FORBIDDEN', 'The classroom launch reference is invalid.');
      }
      if (args.actor.actor_role !== 'student' || !args.actor.student_learner) {
        throw new PortalServiceError('FORBIDDEN', 'This classroom requires a student session.');
      }
      const now = clock();
      const grant = await deps.repository.consumeLaunchGrant({
        actor: args.actor,
        grant_key: parsed.grantKey,
        secret_digest: digestSecret(deps.config, parsed.secret),
        session_key_digest: digestSecret(deps.config, args.actor.session_key),
        now,
      });
      if (!grant) {
        throw new PortalServiceError('FORBIDDEN', 'The classroom launch reference is unavailable.');
      }
      if (grant.learner_key !== args.actor.student_learner.learner_key) {
        throw new PortalServiceError('FORBIDDEN', 'This student session cannot join that learner.');
      }
      const [occurrence, eligibility] = await Promise.all([
        deps.repository.getOccurrence({ actor: args.actor, occurrence_key: grant.occurrence_key }),
        deps.repository.getLearnerEligibility({
          actor: args.actor,
          learner_key: grant.learner_key,
        }),
      ]);
      if (!occurrence || !eligibility) {
        throw new PortalServiceError('NOT_FOUND', 'The requested classroom was not found.');
      }
      const projection = occurrenceProjection({
        config: deps.config,
        occurrence,
        eligibility,
        now,
      });
      assertCanJoin(projection.state);
      const selectedView = selectView(args.payload.viewport_width, deps.config);
      const registrant = await zoomRegistrantPort.resolveRegistrant({
        config: deps.config,
        occurrence,
        eligibility,
        grant,
      });
      if (registrant.registration_state !== 'sink_ready') {
        throw new PortalServiceError(
          'ADAPTER_UNAVAILABLE',
          'Classroom provider is not configured.',
        );
      }
      const sdk = await zoomMeetingLaunchPort.resolveLaunchMaterial({
        config: deps.config,
        occurrence,
        eligibility,
        grant,
        registrant,
        selectedView,
      });
      const attempt = await deps.repository.upsertAttendanceAttempt({
        grant,
        selected_view: selectedView,
        provider_meeting_ref_digest: sdk.provider_meeting_ref_digest,
        provider_registrant_ref_digest: registrant.provider_registrant_ref_digest,
      });
      await deps.repository.recordAudit({
        actor: args.actor,
        household_key: eligibility.household_key,
        learner_key: eligibility.learner_key,
        occurrence_key: occurrence.occurrence_key,
        event_type: 'launch_bootstrap_issued',
        metadata: {
          attempt_key: attempt.attempt_key,
          selected_view: selectedView,
          raw_provider_target_present: false,
        },
      });
      return {
        occurrence: projection,
        selected_view: selectedView,
        attempt_key: attempt.attempt_key,
        sdk,
        provider: {
          mode: deps.config.zoomClassroomProviderMode,
          state: providerState(deps.config),
          raw_join_url_present: false,
        },
        policy: {
          mute_on_join: deps.config.zoomClassroomMuteOnJoin,
          participant_role: 0,
          host_policy_version: CLASSROOM_HOST_POLICY_VERSION,
        },
      };
    },

    async recordAttendance(actor: PortalActorContext, payload: ClassroomAttendanceEventPayload) {
      if (actor.actor_role !== 'student') {
        throw new PortalServiceError('FORBIDDEN', 'Attendance events require a student session.');
      }
      await deps.repository.recordAttendanceEvent({ actor, payload });
    },

    async submitQuestion(
      actor: PortalActorContext,
      payload: ClassroomQuestionSubmitPayload,
    ): Promise<ClassroomQuestionSubmitResponse> {
      if (actor.actor_role !== 'student' || !actor.student_learner) {
        throw new PortalServiceError('FORBIDDEN', 'Questions require a student session.');
      }
      if (!actor.capabilities.includes('student:class:question')) {
        throw new PortalServiceError('FORBIDDEN', 'This student session cannot submit questions.');
      }
      const now = clock();
      const [occurrence, eligibility] = await Promise.all([
        deps.repository.getOccurrence({ actor, occurrence_key: payload.occurrence_key }),
        deps.repository.getLearnerEligibility({
          actor,
          learner_key: actor.student_learner.learner_key,
        }),
      ]);
      if (!occurrence || !eligibility) {
        throw new PortalServiceError('NOT_FOUND', 'The requested classroom was not found.');
      }
      const projection = occurrenceProjection({
        config: deps.config,
        occurrence,
        eligibility,
        now,
      });
      assertCanJoin(projection.state);
      const codecContext = questionCodecContext(deps.config, actor, occurrence, eligibility);
      const encrypted = await deps.questionCodec.encrypt({ body: payload.body }, codecContext);
      const questionKey = stableKey('classroom_question', [
        actor.actor_user_ref,
        eligibility.learner_key,
        occurrence.occurrence_key,
        payload.idempotency_key,
      ]);
      const result = await deps.repository.submitQuestion({
        actor,
        eligibility,
        occurrence,
        question_key: questionKey,
        body_ciphertext: encrypted.ciphertext,
        body_digest: encrypted.digest,
        excerpt_redacted: redactQuestionExcerpt(payload.body),
        idempotency_key: payload.idempotency_key,
        request_hash: fingerprint({
          body_digest: encrypted.digest,
          occurrence: occurrence.occurrence_key,
          learner: eligibility.learner_key,
        }),
      });
      const alertQueued = result.replay
        ? false
        : await deps.repository.enqueueActionGatewayEvent({
            event: questionCreatedEvent({
              config: deps.config,
              actor,
              question: result.question,
              now,
            }),
            actor_principal_id: actor.actor_user_ref,
            actor_role: actor.actor_role,
          });
      await deps.repository.recordAudit({
        actor,
        household_key: eligibility.household_key,
        learner_key: eligibility.learner_key,
        occurrence_key: occurrence.occurrence_key,
        event_type: 'question_submitted',
        metadata: {
          question_key: result.question.question_key,
          moderator_alert_queued: alertQueued,
          body_digest: encrypted.digest,
        },
      });
      return { question: result.question, moderator_alert_queued: alertQueued };
    },

    async listOwnQuestions(actor: PortalActorContext, occurrenceKey: string) {
      if (actor.actor_role !== 'student' || !actor.student_learner) {
        throw new PortalServiceError('FORBIDDEN', 'Questions require a student session.');
      }
      if (!actor.capabilities.includes('student:class:question')) {
        throw new PortalServiceError('FORBIDDEN', 'This student session cannot read questions.');
      }
      return deps.repository.listOwnQuestions({
        actor,
        learner_key: actor.student_learner.learner_key,
        occurrence_key: occurrenceKey,
      });
    },

    async moderateQuestion(args: {
      actor_user_ref: string;
      actor_role: string;
      question_key: string;
      action_type: 'feature_next' | 'mark_answered' | 'dismiss';
      idempotency_key: string;
    }): Promise<ClassroomQuestionModerationResult> {
      const question = await deps.repository.moderateQuestion(args);
      if (args.action_type === 'feature_next') {
        const now = clock();
        await deps.repository.enqueueActionGatewayEvent({
          event: questionSelectedEvent({ config: deps.config, question, actor: args, now }),
          actor_principal_id: args.actor_user_ref,
          actor_role: args.actor_role,
        });
      }
      return { question, provider_action_state: 'disabled' };
    },

    async scheduleDueReminders(actor: PortalActorContext) {
      const now = clock();
      const occurrence = await nextOccurrence(deps.repository, actor, deps.config, now);
      return deps.repository.scheduleDueReminders({ actor, occurrence, now });
    },
  };
}

export function createClassroomPortalAccessAdapter(input: {
  classroom: ClassroomService;
}): LearnerClassAccessAdapter {
  return {
    upcomingForLearner: async ({ actor, learner }) => {
      const projection = await input.classroom.upcomingForLearner({ actor, learner });
      return [
        {
          class_key: projection.class_key,
          title: projection.title,
          starts_at: projection.starts_at,
          local_time: '19:00' as const,
          timezone: 'Asia/Jerusalem' as const,
          protected_launch_required: true as const,
          provider_state:
            projection.provider_state === 'sink_ready'
              ? ('sink_ready' as const)
              : projection.provider_state === 'disabled'
                ? ('disabled' as const)
                : ('not_configured' as const),
          status:
            projection.state === 'open'
              ? 'live'
              : unavailableJoinStates.has(projection.state)
                ? 'unavailable'
                : 'upcoming',
          launch_action:
            actor.actor_role === 'student' && projection.can_join
              ? {
                  action_key: stableKey('classroom_portal_launch', [
                    actor.actor_user_ref,
                    learner.learner_key,
                    projection.class_key,
                  ]),
                  label: 'Join class',
                  kind: 'class_launch' as const,
                  method: 'POST' as const,
                  href: `/api/v1/portals/student/classes/${encodeURIComponent(
                    projection.class_key,
                  )}/launch`,
                  launch_token_ref: stableKey('classroom_launch_ref', [
                    learner.learner_key,
                    projection.class_key,
                  ]),
                  expires_at: projection.join_closes_at,
                }
              : null,
        },
      ];
    },
    protectedLaunch: async ({ actor, learner, class_key, idempotency_key }) =>
      input.classroom.issuePortalLaunch({
        actor,
        learner,
        class_key,
        ...(idempotency_key ? { idempotency_key } : {}),
      }),
  };
}

async function nextOccurrence(
  repository: ClassroomRepository,
  actor: Pick<PortalActorContext, 'account_key' | 'product_key'>,
  config: AppConfig,
  now: Date,
) {
  const window = resolveDailyClassWindow(now, { currentOccurrenceStillJoinable: true });
  return repository.ensureDailyOccurrence({
    actor,
    window,
    durationMinutes: config.zoomClassroomClassDurationMinutes,
    joinOpenOffsetMinutes: config.zoomClassroomJoinOpenOffsetMinutes,
    joinCloseOffsetMinutes: config.zoomClassroomJoinCloseOffsetMinutes,
  });
}

function providerState(config: AppConfig): ClassroomProviderState {
  if (!config.zoomClassroomEnabled) return 'disabled';
  if (config.zoomClassroomProviderMode === 'sink') return 'sink_ready';
  return 'unconfigured';
}

function occurrenceProjection(input: {
  config: AppConfig;
  occurrence: ClassroomOccurrenceRecord;
  eligibility: ClassroomEligibility;
  now: Date;
}) {
  const provider = providerState(input.config);
  const state = joinState({
    provider,
    eligibility: input.eligibility,
    occurrence: input.occurrence,
    now: input.now,
  });
  return {
    class_key: input.occurrence.occurrence_key,
    title: input.occurrence.title,
    learner_key: input.eligibility.learner_key,
    local_class_date: input.occurrence.local_class_date,
    timezone: 'Asia/Jerusalem' as const,
    starts_at: input.occurrence.starts_at,
    join_opens_at: input.occurrence.join_opens_at,
    join_closes_at: input.occurrence.join_closes_at,
    state,
    provider_state: provider,
    can_join: state === 'open',
    reason: reasonForState(state),
    host_policy: {
      mute_on_join: input.config.zoomClassroomMuteOnJoin,
      learner_screen_share: false as const,
      learner_invite: false as const,
      learner_chat: false as const,
    },
  };
}

function joinState(input: {
  provider: ClassroomProviderState;
  eligibility: ClassroomEligibility;
  occurrence: ClassroomOccurrenceRecord;
  now: Date;
}): ClassroomJoinState {
  if (input.eligibility.entitlement_state !== 'active') return 'not_entitled';
  if (input.eligibility.active_learner_count > 3) return 'seat_limit_exceeded';
  if (
    input.eligibility.consent_status === 'missing' ||
    input.eligibility.consent_status === 'revoked'
  ) {
    return 'consent_required';
  }
  if (
    input.eligibility.learner_status !== 'active' ||
    input.eligibility.household_status !== 'active' ||
    input.eligibility.student_access_status !== 'active'
  ) {
    return 'student_access_required';
  }
  if (input.provider === 'disabled') return 'provider_disabled';
  if (input.provider === 'unconfigured' || input.provider === 'unavailable') {
    return 'provider_unavailable';
  }
  const joinOpensAt = new Date(input.occurrence.join_opens_at);
  const startsAt = new Date(input.occurrence.starts_at);
  const joinClosesAt = new Date(input.occurrence.join_closes_at);
  if (input.now < joinOpensAt) return 'scheduled';
  if (input.now >= joinOpensAt && input.now < startsAt) return 'opens_soon';
  if (input.now > joinClosesAt) return 'closed';
  return 'open';
}

function reasonForState(state: ClassroomJoinState) {
  if (state === 'not_entitled') return 'Household subscription is not active.';
  if (state === 'seat_limit_exceeded') return 'Household has more than three active learners.';
  if (state === 'consent_required') return 'Guardian classroom consent is required.';
  if (state === 'student_access_required') return 'Student access is not active.';
  if (state === 'provider_disabled') return 'Classroom provider is disabled.';
  if (state === 'provider_unavailable') return 'Classroom provider is not configured.';
  if (state === 'scheduled') return 'Join opens shortly before class.';
  if (state === 'opens_soon') return 'Join opens at class time.';
  if (state === 'closed') return 'This class window has closed.';
  return null;
}

function assertCanJoin(state: ClassroomJoinState) {
  if (state === 'open') return;
  if (state === 'provider_disabled' || state === 'provider_unavailable') {
    throw new PortalServiceError('ADAPTER_UNAVAILABLE', reasonForState(state) ?? 'Unavailable');
  }
  if (state === 'not_entitled' || state === 'seat_limit_exceeded') {
    throw new PortalServiceError('ENTITLEMENT_REQUIRED', reasonForState(state) ?? 'Not entitled');
  }
  if (state === 'consent_required') {
    throw new PortalServiceError('CONSENT_REQUIRED', reasonForState(state) ?? 'Consent required');
  }
  throw new PortalServiceError(
    'OCCURRENCE_UNAVAILABLE',
    reasonForState(state) ?? 'The class is not open.',
  );
}

const unavailableJoinStates = new Set<ClassroomJoinState>([
  'not_entitled',
  'seat_limit_exceeded',
  'consent_required',
  'student_access_required',
  'provider_disabled',
  'provider_unavailable',
]);

function selectView(viewportWidth: number | undefined, config: AppConfig): ClassroomSelectedView {
  if (!config.zoomClassroomComponentViewEnabled) return 'client';
  if (!viewportWidth || viewportWidth < 900) return 'client';
  return 'component';
}

function deterministicGrantSecret(
  config: AppConfig,
  input: {
    grantKey: string;
    actorUserRef: string;
    sessionKey: string;
    learnerKey: string;
    occurrenceKey: string;
    idempotencyKey: string;
  },
) {
  return createHmac('sha256', config.authCsrfSecret)
    .update(
      [
        CLASSROOM_POLICY_VERSION,
        input.grantKey,
        input.actorUserRef,
        input.sessionKey,
        input.learnerKey,
        input.occurrenceKey,
        input.idempotencyKey,
      ].join('\u001f'),
    )
    .digest('base64url')
    .slice(0, 43);
}

function digestSecret(config: AppConfig, value: string) {
  return createHmac('sha256', `${config.authCsrfSecret}:ot88-classroom`)
    .update(value)
    .digest('hex');
}

function parseLaunchPath(path: string) {
  const match = path.match(/^\/classroom\/launch\/([^/]+)\/([^/?#]+)$/);
  if (!match) return null;
  return {
    grantKey: decodeURIComponent(match[1] ?? ''),
    secret: decodeURIComponent(match[2] ?? ''),
  };
}

function questionCodecContext(
  config: AppConfig,
  actor: PortalActorContext,
  occurrence: ClassroomOccurrenceRecord,
  eligibility: ClassroomEligibility,
): SensitivePayloadContext {
  return {
    botKey: 'classroom_question' as never,
    environment: config.oneTimeTelegramEnvironment,
    accountKey: actor.account_key,
    productKey: actor.product_key,
    actorKey: eligibility.learner_key,
    classification: `classroom-question:${occurrence.occurrence_key}` as never,
  };
}

function redactQuestionExcerpt(value: string) {
  const normalized = value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[redacted]')
    .replace(/https?:\/\/\S+/gi, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.slice(0, 180) || '[redacted]';
}

function questionCreatedEvent(input: {
  config: AppConfig;
  actor: PortalActorContext;
  question: ClassroomQuestion;
  now: Date;
}): ActionGatewayEventV1 {
  const event: ActionGatewayEventV1 = {
    specversion: '1.0',
    id: randomUUID(),
    type: 'class.question.created',
    source: 'onetime://classroom/questions',
    subject: `classes/${input.question.occurrence_key}/questions/${input.question.question_key}`,
    time: input.now.toISOString(),
    datacontenttype: 'application/json',
    schema_version: 1,
    scope: { account_id: input.config.accountKey, product_id: input.config.productKey },
    actor: {
      kind: 'system',
      principal_id: 'classroom_student_portal',
      role: 'system',
      transport: 'web',
    },
    correlation_id: stableKey('question_corr', [input.question.question_key]),
    causation_id: null,
    idempotency_key: stableKey('question_created_event', [input.question.question_key]),
    trace_id: stableKey('question_trace', [
      input.actor.actor_user_ref,
      input.question.question_key,
    ]),
    data: {
      question_id: input.question.question_key,
      class_id: input.question.occurrence_key,
      submitted_at: input.question.submitted_at,
      status: 'new',
      author_ref: stableKey('learner_author', [input.question.learner_key]),
      excerpt_redacted: input.question.excerpt_redacted,
    },
  };
  assertActionGatewayEventV1(event);
  return event;
}

function questionSelectedEvent(input: {
  config: AppConfig;
  question: ClassroomQuestion;
  actor: { actor_user_ref: string; actor_role: string };
  now: Date;
}): ActionGatewayEventV1 {
  const event: ActionGatewayEventV1 = {
    specversion: '1.0',
    id: randomUUID(),
    type: 'class.question.selected',
    source: 'onetime://classroom/questions',
    subject: `classes/${input.question.occurrence_key}/questions/${input.question.question_key}`,
    time: input.now.toISOString(),
    datacontenttype: 'application/json',
    schema_version: 1,
    scope: { account_id: input.config.accountKey, product_id: input.config.productKey },
    actor: {
      kind: 'user',
      principal_id: input.actor.actor_user_ref,
      role: input.actor.actor_role === 'admin' ? 'one_time_admin' : 'one_time_owner',
      transport: 'telegram',
    },
    correlation_id: stableKey('question_corr', [input.question.question_key]),
    causation_id: null,
    idempotency_key: stableKey('question_selected_event', [
      input.question.question_key,
      input.question.selected_at ?? input.now.toISOString(),
    ]),
    trace_id: stableKey('question_trace', [
      input.actor.actor_user_ref,
      input.question.question_key,
    ]),
    data: {
      question_id: input.question.question_key,
      class_id: input.question.occurrence_key,
      selected_at: input.question.selected_at ?? input.now.toISOString(),
      selected_by_principal_id: input.actor.actor_user_ref,
      selection_revision: 1,
      status: 'selected',
      reason_code: 'feature_next',
    },
  };
  assertActionGatewayEventV1(event);
  return event;
}
