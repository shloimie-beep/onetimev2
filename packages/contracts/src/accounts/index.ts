import { z } from 'zod';

export const accountLifecycleTokenTypeSchema = z.enum([
  'owner_admin_invitation',
  'parent_activation',
  'student_setup',
  'student_reset',
  'password_reset',
]);
export type AccountLifecycleTokenType = z.infer<typeof accountLifecycleTokenTypeSchema>;

export const accountLifecycleRoleSchema = z.enum(['owner', 'admin', 'rabbi', 'parent', 'student']);
export type AccountLifecycleRole = z.infer<typeof accountLifecycleRoleSchema>;

export const accountLifecycleErrorCodeSchema = z.enum([
  'FORBIDDEN',
  'NOT_FOUND',
  'TOKEN_INVALID',
  'TOKEN_EXPIRED',
  'TOKEN_CONSUMED',
  'IDENTITY_CONFLICT',
  'IDEMPOTENCY_CONFLICT',
  'RATE_LIMITED',
  'SERVER_ERROR',
]);
export type AccountLifecycleErrorCode = z.infer<typeof accountLifecycleErrorCodeSchema>;

const idempotencyKeySchema = z.string().trim().min(8).max(160);
const lifecycleEmailSchema = z.string().trim().email().max(254);
const lifecycleNameSchema = z.string().trim().min(1).max(180);
const lifecycleOpaqueIdSchema = z.string().trim().min(3).max(180);
const passwordSchema = z.string().min(8).max(256);

export const ownerAdminInvitationPayloadSchema = z.object({
  idempotency_key: idempotencyKeySchema,
  email: lifecycleEmailSchema,
  display_name: lifecycleNameSchema,
  role: z.enum(['owner', 'admin', 'rabbi']),
});
export type OwnerAdminInvitationPayload = z.infer<typeof ownerAdminInvitationPayloadSchema>;

export const parentActivationPayloadSchema = z.object({
  idempotency_key: idempotencyKeySchema,
  email: lifecycleEmailSchema,
  display_name: lifecycleNameSchema,
  household_key: lifecycleOpaqueIdSchema,
  relationship_key: lifecycleOpaqueIdSchema,
  relationship_label: z.string().trim().min(1).max(80).default('Parent'),
  authority: z.enum(['primary_guardian', 'guardian']).default('guardian'),
  free_pilot: z
    .object({
      expires_at: z.iso.datetime(),
      policy_version: z.string().trim().min(3).max(120),
      opaque_source_reference: z
        .string()
        .trim()
        .min(8)
        .max(180)
        .regex(/^[A-Za-z0-9_:-]+$/u),
    })
    .strict()
    .optional(),
});
export type ParentActivationPayload = z.infer<typeof parentActivationPayloadSchema>;

export const studentSetupPayloadSchema = z.object({
  idempotency_key: idempotencyKeySchema,
  email: lifecycleEmailSchema,
  display_name: lifecycleNameSchema,
  household_key: lifecycleOpaqueIdSchema,
  learner_key: lifecycleOpaqueIdSchema,
});
export type StudentSetupPayload = z.infer<typeof studentSetupPayloadSchema>;

export const studentResetPayloadSchema = z.object({
  idempotency_key: idempotencyKeySchema,
  learner_key: lifecycleOpaqueIdSchema,
  email: lifecycleEmailSchema.optional(),
});
export type StudentResetPayload = z.infer<typeof studentResetPayloadSchema>;

export const passwordResetRequestPayloadSchema = z.object({
  idempotency_key: idempotencyKeySchema,
  email: lifecycleEmailSchema,
});
export type PasswordResetRequestPayload = z.infer<typeof passwordResetRequestPayloadSchema>;

export const tokenCompletionPayloadSchema = z.object({
  token: z.string().trim().min(32).max(240),
  password: passwordSchema,
});
export type TokenCompletionPayload = z.infer<typeof tokenCompletionPayloadSchema>;

export const accountLifecycleDeliverySummarySchema = z.object({
  intent_key: lifecycleOpaqueIdSchema,
  delivery_state: z.enum(['sink_queued', 'sink_delivered', 'suppressed', 'revoked']),
  external_send_performed: z.literal(false),
  raw_token_included: z.literal(false),
});
export type AccountLifecycleDeliverySummary = z.infer<typeof accountLifecycleDeliverySummarySchema>;

export const accountLifecycleTokenIssueResultSchema = z.object({
  token_key: lifecycleOpaqueIdSchema,
  token_type: accountLifecycleTokenTypeSchema,
  target_role: accountLifecycleRoleSchema,
  expires_at: z.string(),
  delivery: accountLifecycleDeliverySummarySchema,
  token_ref: lifecycleOpaqueIdSchema,
  raw_token_included: z.literal(false),
});
export type AccountLifecycleTokenIssueResult = z.infer<
  typeof accountLifecycleTokenIssueResultSchema
>;

export const accountLifecycleCompletionResultSchema = z.object({
  user_key: lifecycleOpaqueIdSchema,
  role: accountLifecycleRoleSchema,
  status: z.enum(['active', 'disabled']),
  mfa_required: z.boolean(),
  sessions_invalidated: z.number().int().min(0),
});
export type AccountLifecycleCompletionResult = z.infer<
  typeof accountLifecycleCompletionResultSchema
>;

export const accountLifecycleStudentStateSchema = z.object({
  learner_key: lifecycleOpaqueIdSchema,
  user_key: lifecycleOpaqueIdSchema.nullable(),
  access_status: z.enum([
    'not_configured',
    'setup_requested',
    'active',
    'reset_requested',
    'suspended',
    'disabled',
  ]),
  sessions_invalidated: z.number().int().min(0),
});
export type AccountLifecycleStudentState = z.infer<typeof accountLifecycleStudentStateSchema>;
