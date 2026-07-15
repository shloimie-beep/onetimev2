import { z } from 'zod';

export const portalActorRoleSchema = z.enum([
  'parent',
  'student',
  'owner',
  'admin',
  'crm_agent',
  'viewer',
  'support',
]);
export type PortalActorRole = z.infer<typeof portalActorRoleSchema>;

export const portalCapabilitySchema = z.enum([
  'parent:household:read',
  'parent:learner:create',
  'parent:learner:update',
  'parent:learner:archive',
  'parent:student-access:manage',
  'parent:class:launch',
  'parent:support:preview',
  'student:dashboard:read',
  'student:class:launch',
  'student:support:preview',
  'rewards:read',
  'rewards:write',
  'helper:query',
]);
export type PortalCapability = z.infer<typeof portalCapabilitySchema>;

export const cursorSchema = z.string().trim().min(1).max(500);
export const idempotencyKeySchema = z.string().trim().min(8).max(160);
export const opaqueIdSchema = z.string().trim().min(3).max(180);
export const optimisticVersionSchema = z.coerce.number().int().min(1);

export const parentHouseholdSubjectSchema = z.object({
  household_key: opaqueIdSchema,
  relationship_key: opaqueIdSchema,
  relationship_label: z.string().trim().min(1).max(80),
  authority: z.enum(['primary_guardian', 'guardian', 'support_only']),
});
export type ParentHouseholdSubject = z.infer<typeof parentHouseholdSubjectSchema>;

export const studentLearnerSubjectSchema = z.object({
  learner_key: opaqueIdSchema,
  household_key: opaqueIdSchema,
  access_state_key: opaqueIdSchema,
});
export type StudentLearnerSubject = z.infer<typeof studentLearnerSubjectSchema>;

export const portalActorContextSchema = z.object({
  account_key: opaqueIdSchema,
  product_key: opaqueIdSchema,
  actor_user_ref: opaqueIdSchema,
  actor_role: portalActorRoleSchema,
  session_key: opaqueIdSchema,
  capabilities: z.array(portalCapabilitySchema).default([]),
  authorized_households: z.array(parentHouseholdSubjectSchema).default([]),
  student_learner: studentLearnerSubjectSchema.nullable().default(null),
});
export type PortalActorContext = z.infer<typeof portalActorContextSchema>;

export const learnerStatusSchema = z.enum(['active', 'archived', 'suspended']);
export type LearnerStatus = z.infer<typeof learnerStatusSchema>;

export const studentAccessStatusSchema = z.enum([
  'not_configured',
  'setup_requested',
  'active',
  'reset_requested',
  'suspended',
  'disabled',
]);
export type StudentAccessStatus = z.infer<typeof studentAccessStatusSchema>;

export const studentAccessOperationTypeSchema = z.enum([
  'setup',
  'reset',
  'suspend',
  'restore',
  'revoke_sessions',
]);
export type StudentAccessOperationType = z.infer<typeof studentAccessOperationTypeSchema>;

export const consentStatusSchema = z.enum(['not_required', 'required', 'granted', 'missing']);
export type ConsentStatus = z.infer<typeof consentStatusSchema>;

export const learnerProfileSchema = z.object({
  learner_key: opaqueIdSchema,
  household_key: opaqueIdSchema,
  display_name: z.string().trim().min(1).max(160),
  hebrew_name: z.string().trim().max(160).nullable(),
  grade_label: z.string().trim().max(80).nullable(),
  learner_status: learnerStatusSchema,
  version: optimisticVersionSchema,
  created_at: z.string(),
  updated_at: z.string(),
});
export type LearnerProfile = z.infer<typeof learnerProfileSchema>;

export const householdOverviewSchema = z.object({
  household_key: opaqueIdSchema,
  display_name: z.string().trim().min(1).max(180),
  active_learner_count: z.number().int().min(0).max(3),
  max_active_learners: z.literal(3),
  consent_status: consentStatusSchema,
  learner_limit_reached: z.boolean(),
  version: optimisticVersionSchema,
});
export type HouseholdOverview = z.infer<typeof householdOverviewSchema>;

export const studentAccessStateSchema = z.object({
  access_state_key: opaqueIdSchema,
  learner_key: opaqueIdSchema,
  status: studentAccessStatusSchema,
  student_user_ref: opaqueIdSchema.nullable(),
  last_operation_type: studentAccessOperationTypeSchema.nullable(),
  last_operation_at: z.string().nullable(),
  version: optimisticVersionSchema,
});
export type StudentAccessState = z.infer<typeof studentAccessStateSchema>;

export const protectedActionDescriptorSchema = z.object({
  action_key: opaqueIdSchema,
  label: z.string().trim().min(1).max(120),
  kind: z.enum(['class_launch', 'content_open', 'review_sheet_open', 'support_preview']),
  method: z.enum(['POST', 'GET']).default('POST'),
  href: z.string().trim().max(240).nullable(),
  launch_token_ref: opaqueIdSchema.nullable(),
  expires_at: z.string().nullable(),
});
export type ProtectedActionDescriptor = z.infer<typeof protectedActionDescriptorSchema>;

export const upcomingClassSummarySchema = z.object({
  class_key: opaqueIdSchema,
  title: z.string().trim().min(1).max(160),
  starts_at: z.string().nullable(),
  status: z.enum(['upcoming', 'live', 'available', 'unavailable']),
  launch_action: protectedActionDescriptorSchema.nullable(),
});
export type UpcomingClassSummary = z.infer<typeof upcomingClassSummarySchema>;

export const libraryItemSchema = z.object({
  item_key: opaqueIdSchema,
  title: z.string().trim().min(1).max(180),
  item_type: z.enum(['video', 'sheet', 'source', 'review']),
  status: z.enum(['published', 'unavailable']),
  open_action: protectedActionDescriptorSchema.nullable(),
});
export type LibraryItem = z.infer<typeof libraryItemSchema>;

export const progressSummarySchema = z.object({
  attendance_count: z.number().int().min(0),
  watch_minutes: z.number().int().min(0),
  completed_items: z.number().int().min(0),
  last_activity_at: z.string().nullable(),
});
export type ProgressSummary = z.infer<typeof progressSummarySchema>;

export const rewardBalanceSchema = z.object({
  learner_key: opaqueIdSchema,
  balance: z.number().int(),
  event_count: z.number().int().min(0),
});
export type RewardBalance = z.infer<typeof rewardBalanceSchema>;

export const rewardEventSchema = z.object({
  reward_event_key: opaqueIdSchema,
  learner_key: opaqueIdSchema,
  points_delta: z.number().int(),
  reason_code: z.string().trim().min(1).max(80),
  reason_label: z.string().trim().min(1).max(180),
  actor_ref: opaqueIdSchema,
  source_type: z.enum(['admin', 'parent_capability', 'system']),
  correction_of_event_key: opaqueIdSchema.nullable(),
  occurred_at: z.string(),
});
export type RewardEvent = z.infer<typeof rewardEventSchema>;

export const administrativeUpdateSchema = z.object({
  update_key: opaqueIdSchema,
  learner_key: opaqueIdSchema,
  audience: z.enum(['parent', 'student', 'both']),
  title: z.string().trim().min(1).max(180),
  body: z.string().trim().min(1).max(1200),
  published_at: z.string().nullable(),
  read_at: z.string().nullable(),
});
export type AdministrativeUpdate = z.infer<typeof administrativeUpdateSchema>;

export const helperAvailabilitySchema = z.object({
  available: z.boolean(),
  reason: z.string().trim().max(180).nullable(),
  scope_label: z.string().trim().max(120),
});
export type HelperAvailability = z.infer<typeof helperAvailabilitySchema>;

export const supportPreviewSchema = z.object({
  preview_key: opaqueIdSchema,
  subject: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(1200),
  external_send_performed: z.literal(false),
});
export type SupportPreview = z.infer<typeof supportPreviewSchema>;

export const billingSummarySchema = z.object({
  enabled: z.boolean(),
  summary_label: z.string().trim().max(180).nullable(),
  plan_truth: z
    .literal('Family plan — $67/month — up to 3 active learners in one household.')
    .nullable()
    .optional(),
  entitlement_status: z
    .enum([
      'pending',
      'billing_eligible',
      'active',
      'suspended',
      'scheduled_end',
      'revoked',
      'manual_review',
    ])
    .nullable()
    .optional(),
  grants_access: z.boolean().optional(),
  checkout_available: z.boolean().optional(),
  customer_portal_available: z.boolean().optional(),
  recovery_required: z.boolean().optional(),
  current_period_end: z.string().nullable().optional(),
  cancel_at_period_end: z.boolean().optional(),
});
export type BillingSummary = z.infer<typeof billingSummarySchema>;

export const parentPortalDashboardSchema = z.object({
  household: householdOverviewSchema,
  learners: z.array(learnerProfileSchema).max(3),
  student_access: z.array(studentAccessStateSchema),
  upcoming_classes: z.record(z.string(), z.array(upcomingClassSummarySchema)),
  rewards: z.record(z.string(), rewardBalanceSchema),
  updates: z.record(z.string(), z.array(administrativeUpdateSchema)),
  helper: helperAvailabilitySchema,
  billing: billingSummarySchema,
});
export type ParentPortalDashboard = z.infer<typeof parentPortalDashboardSchema>;

export const parentLearnerMaterialsSchema = z.object({
  learner: learnerProfileSchema,
  library: z.array(libraryItemSchema),
  review_sheets: z.array(libraryItemSchema),
  progress: progressSummarySchema,
  rewards: rewardBalanceSchema,
  updates: z.array(administrativeUpdateSchema),
});
export type ParentLearnerMaterials = z.infer<typeof parentLearnerMaterialsSchema>;

export const studentPortalDashboardSchema = z.object({
  learner: learnerProfileSchema,
  upcoming_classes: z.array(upcomingClassSummarySchema),
  library_items: z.array(libraryItemSchema),
  progress: progressSummarySchema,
  rewards: rewardBalanceSchema,
  updates: z.array(administrativeUpdateSchema),
  helper: helperAvailabilitySchema,
});
export type StudentPortalDashboard = z.infer<typeof studentPortalDashboardSchema>;

export const createLearnerPayloadSchema = z.object({
  idempotency_key: idempotencyKeySchema,
  display_name: z.string().trim().min(1).max(160),
  hebrew_name: z.string().trim().max(160).optional(),
  grade_label: z.string().trim().max(80).optional(),
});
export type CreateLearnerPayload = z.infer<typeof createLearnerPayloadSchema>;

export const updateLearnerPayloadSchema = z.object({
  idempotency_key: idempotencyKeySchema,
  version: optimisticVersionSchema,
  display_name: z.string().trim().min(1).max(160).optional(),
  hebrew_name: z.string().trim().max(160).nullable().optional(),
  grade_label: z.string().trim().max(80).nullable().optional(),
});
export type UpdateLearnerPayload = z.infer<typeof updateLearnerPayloadSchema>;

export const studentAccessOperationPayloadSchema = z.object({
  idempotency_key: idempotencyKeySchema,
  email: z.string().trim().email().max(254).optional(),
  display_name: z.string().trim().min(1).max(180).optional(),
});
export type StudentAccessOperationPayload = z.infer<typeof studentAccessOperationPayloadSchema>;

export const helperQueryPayloadSchema = z.object({
  idempotency_key: idempotencyKeySchema,
  question: z.string().trim().min(1).max(800),
});
export type HelperQueryPayload = z.infer<typeof helperQueryPayloadSchema>;

export const supportRequestPayloadSchema = z.object({
  idempotency_key: idempotencyKeySchema,
  subject: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(1200),
});
export type SupportRequestPayload = z.infer<typeof supportRequestPayloadSchema>;

export const portalErrorCodeSchema = z.enum([
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CSRF_REQUIRED',
  'VALIDATION_ERROR',
  'IDEMPOTENCY_CONFLICT',
  'VERSION_CONFLICT',
  'LEARNER_LIMIT_REACHED',
  'CONSENT_REQUIRED',
  'ADAPTER_UNAVAILABLE',
  'SERVER_ERROR',
]);
export type PortalErrorCode = z.infer<typeof portalErrorCodeSchema>;

export const portalErrorEnvelopeSchema = z.object({
  success: z.literal(false),
  code: portalErrorCodeSchema,
  message: z.string(),
  request_id: z.string().optional(),
  field_errors: z.record(z.string(), z.string()).optional(),
});
export type PortalErrorEnvelope = z.infer<typeof portalErrorEnvelopeSchema>;

export const portalSuccessSchema = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({ success: z.literal(true), data: schema });

export function hasPortalCapability(
  actor: Pick<PortalActorContext, 'capabilities'>,
  capability: PortalCapability,
) {
  return actor.capabilities.includes(capability);
}
