import { z } from 'zod';
import { idempotencyKeySchema, opaqueIdSchema } from '../portals/index.ts';

export const liveClassQuestionStatusSchema = z.enum([
  'submitted',
  'selected',
  'student_ready',
  'live',
  'answered',
  'approved_for_board',
  'kept_private',
  'rejected',
]);
export type LiveClassQuestionStatus = z.infer<typeof liveClassQuestionStatusSchema>;

export const liveClassReadinessSchema = z.enum(['pending', 'ready', 'declined']);
export type LiveClassReadiness = z.infer<typeof liveClassReadinessSchema>;

export const liveClassParticipantJoinStateSchema = z.enum(['unknown', 'waiting', 'joined', 'left']);
export const liveClassParticipantAudioStateSchema = z.enum(['unknown', 'muted', 'unmuted']);
export const liveClassParticipantVideoStateSchema = z.enum(['unknown', 'off', 'on']);

export const liveClassObsSceneSchema = z.enum([
  'OT - Slides',
  'OT - Featured Student',
  'OT - Break',
]);
export type LiveClassObsScene = z.infer<typeof liveClassObsSceneSchema>;

export const liveClassObsActionSchema = z.enum(['feature_student', 'done', 'emergency_reset']);
export type LiveClassObsAction = z.infer<typeof liveClassObsActionSchema>;

export const liveClassZoomOperationSchema = z.enum([
  'ask_unmute',
  'mute',
  'spotlight_replace',
  'spotlight_remove',
  'stop_video',
]);
export type LiveClassZoomOperation = z.infer<typeof liveClassZoomOperationSchema>;

export const liveClassZoomCustomerKeySchema = z
  .string()
  .regex(/^zoom_ck_[a-f0-9]{24}$/)
  .max(36);

export const liveClassQuestionSchema = z.object({
  question_key: opaqueIdSchema,
  occurrence_key: opaqueIdSchema,
  learner_key: opaqueIdSchema,
  approved_display_name: z.string().trim().min(1).max(160),
  question_preview: z.string().trim().min(1).max(180),
  status: liveClassQuestionStatusSchema,
  readiness: liveClassReadinessSchema,
  mic_ready: z.boolean(),
  video_ready: z.boolean(),
  customer_key: opaqueIdSchema,
  class_label: z.string().trim().min(1).max(160).nullable(),
  selected_at: z.string().nullable(),
  student_ready_at: z.string().nullable(),
  live_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  revision: z.number().int().min(1),
});
export type LiveClassQuestion = z.infer<typeof liveClassQuestionSchema>;

export const liveClassParticipantSchema = z.object({
  participant_key: opaqueIdSchema,
  learner_key: opaqueIdSchema.nullable(),
  approved_display_name: z.string().trim().min(1).max(160),
  customer_key: opaqueIdSchema,
  join_state: liveClassParticipantJoinStateSchema,
  audio_state: liveClassParticipantAudioStateSchema,
  video_state: liveClassParticipantVideoStateSchema,
  active_speaker: z.boolean(),
  spotlighted: z.boolean(),
  updated_at: z.string(),
});
export type LiveClassParticipant = z.infer<typeof liveClassParticipantSchema>;

export const liveClassStageStateSchema = z.object({
  stage_session: opaqueIdSchema,
  occurrence_key: opaqueIdSchema,
  surface_label: z.literal('One Time Zoom Stage Host'),
  class_label: z.string().trim().min(1).max(160).nullable(),
  current_scene: liveClassObsSceneSchema,
  selected_question: liveClassQuestionSchema.nullable(),
  selected_participant: liveClassParticipantSchema.nullable(),
  mic_ready: z.boolean(),
  video_ready: z.boolean(),
  private_portal_visible: z.literal(false),
});
export type LiveClassStageState = z.infer<typeof liveClassStageStateSchema>;

export const liveClassControlCommandSchema = z.object({
  command_key: opaqueIdSchema,
  occurrence_key: opaqueIdSchema,
  command_type: z.enum([
    'ask_unmute',
    'mute',
    'spotlight_replace',
    'spotlight_remove',
    'stop_video',
    'feature_student',
    'done',
    'emergency_reset',
    'obs_switch_scene',
  ]),
  command_status: z.enum(['queued', 'claimed', 'executed', 'failed', 'rejected', 'expired']),
  target_question_key: opaqueIdSchema.nullable(),
  target_participant_key: opaqueIdSchema.nullable(),
  obs_scene: liveClassObsSceneSchema.nullable(),
  nonce: opaqueIdSchema,
  signature: z.string().trim().min(16).max(240),
  expires_at: z.string(),
  created_at: z.string(),
});
export type LiveClassControlCommand = z.infer<typeof liveClassControlCommandSchema>;

const zoomHostControlReadinessPhaseSchema = z
  .object({
    ready: z.boolean(),
    blocker_variable_names: z.array(z.string().trim().min(1)),
  })
  .strict();

export const liveClassConsoleSnapshotSchema = z.object({
  success: z.literal(true),
  data: z.object({
    occurrence_key: opaqueIdSchema,
    mode: z.enum(['fake', 'meeting_sdk_host']),
    questions: z.array(liveClassQuestionSchema),
    selected_question: liveClassQuestionSchema.nullable(),
    participants: z.array(liveClassParticipantSchema),
    stage: liveClassStageStateSchema,
    zoom: z.object({
      host_surface_label: z.literal('One Time Zoom Stage Host'),
      provider: z.literal('meeting_sdk'),
      adapter: z.enum(['fake', 'meeting_sdk_host']),
      sdk_credentials_configured: z.boolean(),
      host_control_configured: z.boolean(),
      readiness: z
        .object({
          ready: z.boolean(),
          code: z.enum(['ZOOM_HOST_CONTROL_READY', 'PROVIDER_OFF', 'PROVIDER_NOT_READY']),
          provider_gate_blockers: z.array(z.string().trim().min(1)),
          readiness_blockers: z.array(z.string().trim().min(1)),
          canary_authorization_blockers: z.array(z.string().trim().min(1)),
          phases: z
            .object({
              sdk_app: zoomHostControlReadinessPhaseSchema,
              s2s_meeting_provisioning: zoomHostControlReadinessPhaseSchema,
              host_authorization: zoomHostControlReadinessPhaseSchema,
              real_control_canary_authorization: zoomHostControlReadinessPhaseSchema,
            })
            .strict(),
          secret_values_included: z.literal(false),
        })
        .strict(),
      live_control_uses_rest_api: z.literal(false),
      can_force_camera_on: z.literal(false),
      video_start_model: z.literal('PARTICIPANT_CONSENT'),
      setup_job: z
        .object({
          job_key: z.literal('ZOOM-UI-01'),
          title: z.literal('Complete Zoom real-control readiness'),
          status: z.enum(['not_required', 'operator_action_required']),
          scopes: z.array(z.string().trim().min(1)),
          storage_instruction: z.string().trim().min(1).max(240),
          steps: z.array(z.string().trim().min(1).max(320)),
        })
        .nullable(),
    }),
    obs: z.object({
      bridge_required: z.literal(false),
      connected: z.boolean(),
      current_scene: liveClassObsSceneSchema,
      allowed_scenes: z.array(liveClassObsSceneSchema),
      canonical_sources: z.array(z.string().trim().min(1).max(120)),
      one_click_setup: z.string().trim().min(1).max(240),
      last_result: z.string().trim().max(240).nullable(),
    }),
    telegram: z.object({
      enabled: z.literal(false),
      source_of_truth: z.literal(false),
      card_preview: z
        .object({
          student_safe_label: z.string().trim().min(1).max(160),
          question_preview: z.string().trim().min(1).max(180),
          actions: z.array(z.enum(['Open Live Console', 'Select', 'Keep Private', 'Reject'])),
        })
        .nullable(),
    }),
    audit_ref: opaqueIdSchema,
  }),
});
export type LiveClassConsoleSnapshot = z.infer<typeof liveClassConsoleSnapshotSchema>;

export const liveClassQuestionSubmitPayloadSchema = z.object({
  occurrence_key: opaqueIdSchema,
  body: z.string().trim().min(3).max(360),
  approved_display_name: z.string().trim().min(1).max(160).optional(),
  idempotency_key: idempotencyKeySchema,
});
export type LiveClassQuestionSubmitPayload = z.infer<typeof liveClassQuestionSubmitPayloadSchema>;

export const liveClassQuestionSubmitResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    question: liveClassQuestionSchema,
    moderator_alert_queued: z.boolean(),
  }),
});
export type LiveClassQuestionSubmitResponse = z.infer<typeof liveClassQuestionSubmitResponseSchema>;

export const liveClassQuestionListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    questions: z.array(liveClassQuestionSchema),
  }),
});
export type LiveClassQuestionListResponse = z.infer<typeof liveClassQuestionListResponseSchema>;

export const liveClassQuestionActionPayloadSchema = z.object({
  idempotency_key: idempotencyKeySchema,
});
export type LiveClassQuestionActionPayload = z.infer<typeof liveClassQuestionActionPayloadSchema>;

export const liveClassQuestionReadyPayloadSchema = z.object({
  idempotency_key: idempotencyKeySchema,
  ready: z.boolean(),
  mic_ready: z.boolean().optional(),
  video_ready: z.boolean().optional(),
  decline_reason: z.string().trim().max(180).optional(),
});
export type LiveClassQuestionReadyPayload = z.infer<typeof liveClassQuestionReadyPayloadSchema>;

export const liveClassQuestionCompletePayloadSchema = z.object({
  idempotency_key: idempotencyKeySchema,
  resolution: z
    .enum(['answered', 'approved_for_board', 'kept_private', 'rejected'])
    .default('answered'),
});
export type LiveClassQuestionCompletePayload = z.infer<
  typeof liveClassQuestionCompletePayloadSchema
>;

export const liveClassZoomControlPayloadSchema = z.object({
  operation: liveClassZoomOperationSchema,
  question_key: opaqueIdSchema.optional(),
  participant_key: opaqueIdSchema.optional(),
  idempotency_key: idempotencyKeySchema,
});
export type LiveClassZoomControlPayload = z.infer<typeof liveClassZoomControlPayloadSchema>;

export const liveClassZoomHostBootstrapResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    occurrence_key: opaqueIdSchema,
    sdk_web_version: z.string().regex(/^\d+\.\d+\.\d+$/),
    meeting_number: z.string().trim().min(9).max(32),
    signature: z.string().trim().min(16).max(2048),
    password: z.string().max(64),
    zak: z.string().trim().min(16).max(4096),
    user_name: z.string().trim().min(1).max(160),
    leave_url: z.string().trim().min(1).max(240),
    video_start_model: z.literal('PARTICIPANT_CONSENT'),
  }),
});
export type LiveClassZoomHostBootstrapResponse = z.infer<
  typeof liveClassZoomHostBootstrapResponseSchema
>;

export const liveClassZoomTestParticipantBootstrapResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    occurrence_key: opaqueIdSchema,
    sdk_web_version: z.string().regex(/^\d+\.\d+\.\d+$/),
    meeting_number: z.string().trim().min(9).max(32),
    signature: z.string().trim().min(16).max(2048),
    password: z.string().max(64),
    customer_key: liveClassZoomCustomerKeySchema,
    user_name: z.string().trim().min(1).max(160),
    leave_url: z.string().trim().min(1).max(240),
    video_start_model: z.literal('PARTICIPANT_CONSENT'),
  }),
});
export type LiveClassZoomTestParticipantBootstrapResponse = z.infer<
  typeof liveClassZoomTestParticipantBootstrapResponseSchema
>;

export const liveClassZoomParticipantSyncPayloadSchema = z.object({
  occurrence_key: opaqueIdSchema,
  participants: z
    .array(
      z.object({
        customer_key: liveClassZoomCustomerKeySchema,
        provider_user_id: z.string().regex(/^\d{1,20}$/),
        join_state: liveClassParticipantJoinStateSchema,
        audio_state: liveClassParticipantAudioStateSchema,
        video_state: liveClassParticipantVideoStateSchema,
        active_speaker: z.boolean(),
        spotlighted: z.boolean(),
      }),
    )
    .max(100),
});
export type LiveClassZoomParticipantSyncPayload = z.infer<
  typeof liveClassZoomParticipantSyncPayloadSchema
>;

export const liveClassZoomParticipantSyncResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    mappings: z.array(
      z.object({
        participant_key: opaqueIdSchema,
        customer_key: liveClassZoomCustomerKeySchema,
      }),
    ),
  }),
});

export const liveClassZoomCommandPollResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ commands: z.array(liveClassControlCommandSchema) }),
});

export const liveClassObsCommandPayloadSchema = z.object({
  action: liveClassObsActionSchema,
  question_key: opaqueIdSchema.optional(),
  idempotency_key: idempotencyKeySchema,
});
export type LiveClassObsCommandPayload = z.infer<typeof liveClassObsCommandPayloadSchema>;

export const liveClassCommandResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    question: liveClassQuestionSchema.nullable(),
    stage: liveClassStageStateSchema,
    commands: z.array(liveClassControlCommandSchema),
  }),
});
export type LiveClassCommandResponse = z.infer<typeof liveClassCommandResponseSchema>;

export const liveClassStageResponseSchema = z.object({
  success: z.literal(true),
  data: liveClassStageStateSchema,
});
export type LiveClassStageResponse = z.infer<typeof liveClassStageResponseSchema>;

export const liveClassObsCommandPollResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    commands: z.array(liveClassControlCommandSchema),
  }),
});
export type LiveClassObsCommandPollResponse = z.infer<typeof liveClassObsCommandPollResponseSchema>;

export const liveClassObsCommandReportPayloadSchema = z.object({
  command_key: opaqueIdSchema,
  nonce: opaqueIdSchema,
  signature: z.string().trim().min(16).max(240),
  status: z.enum(['executed', 'failed', 'rejected']),
  result: z.string().trim().max(240).optional(),
});
export type LiveClassObsCommandReportPayload = z.infer<
  typeof liveClassObsCommandReportPayloadSchema
>;
