import { z } from 'zod';
import { idempotencyKeySchema, opaqueIdSchema } from '../portals/index.ts';

export const classroomProviderModeSchema = z.enum(['sink', 'real']);
export type ClassroomProviderMode = z.infer<typeof classroomProviderModeSchema>;

export const classroomProviderStateSchema = z.enum([
  'disabled',
  'sink_ready',
  'unconfigured',
  'ready',
  'unavailable',
]);
export type ClassroomProviderState = z.infer<typeof classroomProviderStateSchema>;

export const classroomJoinStateSchema = z.enum([
  'scheduled',
  'opens_soon',
  'open',
  'closed',
  'not_entitled',
  'seat_limit_exceeded',
  'consent_required',
  'student_access_required',
  'provider_disabled',
  'provider_unavailable',
]);
export type ClassroomJoinState = z.infer<typeof classroomJoinStateSchema>;

export const classroomOccurrenceProjectionSchema = z.object({
  class_key: opaqueIdSchema,
  title: z.string().trim().min(1).max(160),
  learner_key: opaqueIdSchema,
  local_class_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.literal('Asia/Jerusalem'),
  starts_at: z.string(),
  join_opens_at: z.string(),
  join_closes_at: z.string(),
  state: classroomJoinStateSchema,
  provider_state: classroomProviderStateSchema,
  can_join: z.boolean(),
  reason: z.string().trim().max(180).nullable(),
  host_policy: z.object({
    mute_on_join: z.boolean(),
    learner_screen_share: z.literal(false),
    learner_invite: z.literal(false),
    learner_chat: z.literal(false),
  }),
});
export type ClassroomOccurrenceProjection = z.infer<typeof classroomOccurrenceProjectionSchema>;

export const classroomLaunchIssuePayloadSchema = z.object({
  idempotency_key: idempotencyKeySchema.optional(),
});
export type ClassroomLaunchIssuePayload = z.infer<typeof classroomLaunchIssuePayloadSchema>;

export const classroomLaunchIssueResponseSchema = z.object({
  action_key: opaqueIdSchema,
  href: z.string().trim().min(1).max(240),
  launch_token_ref: opaqueIdSchema,
  expires_at: z.string(),
});
export type ClassroomLaunchIssueResponse = z.infer<typeof classroomLaunchIssueResponseSchema>;

export const classroomLaunchBootstrapPayloadSchema = z.object({
  launch_path: z.string().trim().min(12).max(240),
  viewport_width: z.number().int().min(0).max(10000).optional(),
  user_agent_hint: z.string().trim().max(160).optional(),
});
export type ClassroomLaunchBootstrapPayload = z.infer<typeof classroomLaunchBootstrapPayloadSchema>;

export const classroomSelectedViewSchema = z.enum(['client', 'component']);
export type ClassroomSelectedView = z.infer<typeof classroomSelectedViewSchema>;

const classroomSinkSdkLaunchSchema = z.object({
  mode: z.literal('sink'),
  sdk_key_ref: opaqueIdSchema,
  meeting_number: z.string().trim().min(9).max(32),
  signature: z.string().trim().min(16).max(240),
  password_ref: opaqueIdSchema,
  registrant_token_ref: opaqueIdSchema,
  role: z.literal(0),
  user_display_name: z.string().trim().min(1).max(160),
  user_email_required: z.literal(false),
  leave_url: z
    .string()
    .trim()
    .regex(/^\/app(?:\/|$)/)
    .max(160),
});

const classroomRealSdkLaunchSchema = z.object({
  mode: z.literal('real'),
  sdk_web_version: z.string().regex(/^\d+\.\d+\.\d+$/),
  meeting_number: z
    .string()
    .trim()
    .regex(/^\d{9,32}$/),
  signature: z.string().trim().min(16).max(2048),
  meeting_password: z.string().min(1).max(32),
  customer_key: z
    .string()
    .regex(/^zoom_ck_[a-f0-9]{24}$/)
    .max(36),
  role: z.literal(0),
  user_display_name: z.string().trim().min(1).max(160),
  user_email_required: z.literal(false),
  leave_url: z
    .string()
    .trim()
    .regex(/^\/app(?:\/|$)/)
    .max(160),
  video_start_model: z.literal('PARTICIPANT_CONSENT'),
});

export const classroomLaunchBootstrapResponseSchema = z.object({
  occurrence: classroomOccurrenceProjectionSchema,
  selected_view: classroomSelectedViewSchema,
  attempt_key: opaqueIdSchema,
  sdk: z.discriminatedUnion('mode', [classroomSinkSdkLaunchSchema, classroomRealSdkLaunchSchema]),
  provider: z.object({
    mode: classroomProviderModeSchema,
    state: classroomProviderStateSchema,
    raw_join_url_present: z.literal(false),
  }),
  policy: z.object({
    mute_on_join: z.boolean(),
    participant_role: z.literal(0),
    host_policy_version: z.string().trim().min(1).max(80),
  }),
});
export type ClassroomLaunchBootstrapResponse = z.infer<
  typeof classroomLaunchBootstrapResponseSchema
>;

export const classroomAttendanceEventPayloadSchema = z.object({
  attempt_key: opaqueIdSchema,
  event_type: z.enum(['bootstrap_loaded', 'sdk_join_started', 'sdk_joined', 'sdk_left', 'retry']),
  idempotency_key: idempotencyKeySchema,
  client_state: z.string().trim().max(80).optional(),
});
export type ClassroomAttendanceEventPayload = z.infer<typeof classroomAttendanceEventPayloadSchema>;

export const classroomQuestionSubmitPayloadSchema = z.object({
  occurrence_key: opaqueIdSchema,
  body: z.string().trim().min(3).max(360),
  idempotency_key: idempotencyKeySchema,
});
export type ClassroomQuestionSubmitPayload = z.infer<typeof classroomQuestionSubmitPayloadSchema>;

export const classroomQuestionSchema = z.object({
  question_key: opaqueIdSchema,
  occurrence_key: opaqueIdSchema,
  learner_key: opaqueIdSchema,
  status: z.enum(['new', 'featured', 'answered', 'dismissed']),
  excerpt_redacted: z.string().trim().min(1).max(180),
  submitted_at: z.string(),
  selected_at: z.string().nullable(),
});
export type ClassroomQuestion = z.infer<typeof classroomQuestionSchema>;

export const classroomQuestionSubmitResponseSchema = z.object({
  question: classroomQuestionSchema,
  moderator_alert_queued: z.boolean(),
});
export type ClassroomQuestionSubmitResponse = z.infer<typeof classroomQuestionSubmitResponseSchema>;

export const classroomQuestionListResponseSchema = z.object({
  questions: z.array(classroomQuestionSchema),
});
export type ClassroomQuestionListResponse = z.infer<typeof classroomQuestionListResponseSchema>;
