import { z } from 'zod';

export const gamificationReasonCodeSchema = z.enum([
  'attendance_present',
  'attendance_streak',
  'lesson_completed',
  'worksheet_completed',
  'review_completed',
  'review_streak',
  'retention_review',
  'mishnah_completed',
  'question_approved',
  'excellent_question',
  'consistency_bonus',
  'personal_milestone',
  'class_milestone',
  'parent_reward_completed',
  'admin_correction',
]);
export type GamificationReasonCode = z.infer<typeof gamificationReasonCodeSchema>;

export const gamificationSourceTypeSchema = z.enum(['admin', 'parent_capability', 'system']);
export type GamificationSourceType = z.infer<typeof gamificationSourceTypeSchema>;

export const learningLevelSchema = z.object({
  level: z.number().int().min(1),
  title: z.string().trim().min(1).max(80),
  min_points: z.number().int().min(0),
  next_level_points: z.number().int().min(0).nullable(),
  progress_percent: z.number().int().min(0).max(100),
});
export type LearningLevel = z.infer<typeof learningLevelSchema>;

export const learningStreakSchema = z.object({
  kind: z.enum(['attendance', 'review']),
  current_count: z.number().int().min(0),
  best_count: z.number().int().min(0),
  grace_remaining: z.number().int().min(0).max(2),
  last_earned_at: z.string().nullable(),
  status: z.enum(['active', 'grace', 'paused', 'empty']),
});
export type LearningStreak = z.infer<typeof learningStreakSchema>;

export const learningBadgeSchema = z.object({
  badge_key: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(260),
  earned_at: z.string().nullable(),
  tone: z.enum(['yellow', 'ice', 'success']),
});
export type LearningBadge = z.infer<typeof learningBadgeSchema>;

export const personalMilestoneSchema = z.object({
  milestone_key: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().min(1).max(320),
  status: z.enum(['earned', 'in_progress', 'locked']),
  progress_current: z.number().int().min(0),
  progress_target: z.number().int().min(1),
  earned_at: z.string().nullable(),
});
export type PersonalMilestone = z.infer<typeof personalMilestoneSchema>;

export const learningProgressDetailSchema = z.object({
  mishnayos_completed: z.number().int().min(0),
  mishnayos_target: z.number().int().min(1),
  classes_attended: z.number().int().min(0),
  classes_total: z.number().int().min(0),
  review_items_completed: z.number().int().min(0),
  review_items_total: z.number().int().min(0),
  retention_reviews_completed: z.number().int().min(0),
  retention_percent: z.number().int().min(0).max(100),
});
export type LearningProgressDetail = z.infer<typeof learningProgressDetailSchema>;

export const accomplishmentEventSchema = z.object({
  event_key: z.string().trim().min(1).max(180),
  title: z.string().trim().min(1).max(160),
  detail: z.string().trim().min(1).max(320),
  reason_code: gamificationReasonCodeSchema,
  points_delta: z.number().int(),
  source_type: gamificationSourceTypeSchema,
  correction_of_event_key: z.string().trim().max(180).nullable(),
  occurred_at: z.string(),
  reversed: z.boolean(),
});
export type AccomplishmentEvent = z.infer<typeof accomplishmentEventSchema>;

export const parentRewardGoalSchema = z.object({
  reward_goal_key: z.string().trim().min(1).max(180),
  learner_key: z.string().trim().min(1).max(180),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(320).nullable(),
  points_required: z.number().int().min(1).max(5000),
  status: z.enum(['active', 'earned', 'fulfilled', 'paused', 'archived']),
  created_by_parent_ref: z.string().trim().min(1).max(180),
  earned_at: z.string().nullable(),
  fulfilled_at: z.string().nullable(),
});
export type ParentRewardGoal = z.infer<typeof parentRewardGoalSchema>;

export const classMilestoneSchema = z.object({
  class_milestone_key: z.string().trim().min(1).max(180),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(320),
  progress_current: z.number().int().min(0),
  progress_target: z.number().int().min(1),
  status: z.enum(['earned', 'in_progress', 'locked']),
  earned_at: z.string().nullable(),
});
export type ClassMilestone = z.infer<typeof classMilestoneSchema>;

export const gamificationGuardrailsSchema = z.object({
  no_public_rankings: z.literal(true),
  leaderboard_scope: z.literal('authenticated_class_only').optional(),
  leaderboard_time_basis: z.literal('all_time_no_reset').optional(),
  no_negative_labels: z.literal(true).optional(),
  no_random_rewards: z.literal(true),
  meaningful_learning_only: z.literal(true),
  rabbi_corrections_audited: z.literal(true).optional(),
  publication_controlled_by_rabbi: z.literal(true).optional(),
  student_scope: z.enum(['self_only', 'household', 'authorized_staff']),
});
export type GamificationGuardrails = z.infer<typeof gamificationGuardrailsSchema>;

export const gamificationPointsPolicySchema = z.object({
  policy_version: z.literal('ot-learning-points-v2'),
  attendance_present: z.literal(5),
  lesson_completed: z.literal(10),
  worksheet_completed: z.literal(10),
  question_approved: z.literal(3),
  excellent_question: z.literal(5),
  consistency_bonus_default: z.literal(5),
});
export type GamificationPointsPolicy = z.infer<typeof gamificationPointsPolicySchema>;

export const gamificationSummarySchema = z.object({
  learner_key: z.string().trim().min(1).max(180),
  learning_points: z.number().int(),
  points_policy: gamificationPointsPolicySchema.optional(),
  level: learningLevelSchema,
  progress: learningProgressDetailSchema,
  streaks: z.array(learningStreakSchema).max(2),
  badges: z.array(learningBadgeSchema).max(20),
  milestones: z.array(personalMilestoneSchema).max(20),
  accomplishments: z.array(accomplishmentEventSchema).max(20),
  parent_rewards: z.array(parentRewardGoalSchema).max(20),
  class_milestones: z.array(classMilestoneSchema).max(20),
  celebration: z
    .object({
      title: z.string().trim().min(1).max(120),
      detail: z.string().trim().min(1).max(260),
      event_key: z.string().trim().min(1).max(180),
    })
    .nullable(),
  guardrails: gamificationGuardrailsSchema,
});
export type GamificationSummary = z.infer<typeof gamificationSummarySchema>;

export const adminGamificationLearnerSchema = z.object({
  learner_key: z.string().trim().min(1).max(180),
  household_key: z.string().trim().min(1).max(180),
  display_name: z.string().trim().min(1).max(160),
  learning_points: z.number().int(),
  level_title: z.string().trim().min(1).max(80),
  attendance_streak: z.number().int().min(0),
  review_streak: z.number().int().min(0),
  retention_percent: z.number().int().min(0).max(100),
  last_activity_at: z.string().nullable(),
});
export type AdminGamificationLearner = z.infer<typeof adminGamificationLearnerSchema>;

export const gamificationCorrectionAuditSchema = z.object({
  correction_key: z.string().trim().min(1).max(180),
  learner_key: z.string().trim().min(1).max(180),
  corrected_event_key: z.string().trim().min(1).max(180),
  reversal_event_key: z.string().trim().min(1).max(180),
  reason: z.string().trim().min(1).max(320),
  actor_ref: z.string().trim().min(1).max(180),
  created_at: z.string(),
});
export type GamificationCorrectionAudit = z.infer<typeof gamificationCorrectionAuditSchema>;

export const adminGamificationDashboardSchema = z.object({
  generated_at: z.string(),
  aggregate: z.object({
    learner_count: z.number().int().min(0),
    total_learning_points: z.number().int(),
    active_attendance_streaks: z.number().int().min(0),
    average_retention_percent: z.number().int().min(0).max(100),
  }),
  learners: z.array(adminGamificationLearnerSchema).max(200),
  class_milestones: z.array(classMilestoneSchema).max(40),
  correction_audit: z.array(gamificationCorrectionAuditSchema).max(100),
  guardrails: gamificationGuardrailsSchema,
});
export type AdminGamificationDashboard = z.infer<typeof adminGamificationDashboardSchema>;

export const gamificationLearningEventPayloadSchema = z
  .object({
    learner_key: z.string().trim().min(1).max(180),
    reason_code: gamificationReasonCodeSchema.exclude(['admin_correction']),
    idempotency_key: z.string().trim().min(8).max(160),
    source_ref: z.string().trim().max(180).optional(),
    occurred_at: z.string().optional(),
  })
  .strict();
export type GamificationLearningEventPayload = z.infer<
  typeof gamificationLearningEventPayloadSchema
>;

export const parentRewardGoalPayloadSchema = z
  .object({
    learner_key: z.string().trim().min(1).max(180),
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(320).optional(),
    points_required: z.number().int().min(1).max(5000),
    idempotency_key: z.string().trim().min(8).max(160),
  })
  .strict();
export type ParentRewardGoalPayload = z.infer<typeof parentRewardGoalPayloadSchema>;

export const gamificationCorrectionPayloadSchema = z
  .object({
    learner_key: z.string().trim().min(1).max(180),
    corrected_event_key: z.string().trim().min(1).max(180),
    reason: z.string().trim().min(1).max(320),
    idempotency_key: z.string().trim().min(8).max(160),
  })
  .strict();
export type GamificationCorrectionPayload = z.infer<typeof gamificationCorrectionPayloadSchema>;

export const gamificationSummaryResponseSchema = z.object({
  success: z.literal(true),
  data: gamificationSummarySchema,
});
export type GamificationSummaryResponse = z.infer<typeof gamificationSummaryResponseSchema>;

export const adminGamificationDashboardResponseSchema = z.object({
  success: z.literal(true),
  dashboard: adminGamificationDashboardSchema,
});
export type AdminGamificationDashboardResponse = z.infer<
  typeof adminGamificationDashboardResponseSchema
>;
