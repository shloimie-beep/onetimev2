import type {
  AccomplishmentEvent,
  AdminGamificationDashboard,
  ClassMilestone,
  GamificationCorrectionAudit,
  GamificationCorrectionPayload,
  GamificationGuardrails,
  GamificationLearningEventPayload,
  GamificationReasonCode,
  GamificationSummary,
  LearningBadge,
  LearningLevel,
  LearningStreak,
  ParentRewardGoal,
  ParentRewardGoalPayload,
  PersonalMilestone,
} from '../../../contracts/src/gamification/index.ts';
import type { LearnerProfile, PortalActorContext } from '../../../contracts/src/portals/index.ts';
import { hasPortalCapability } from '../../../contracts/src/portals/index.ts';
import { fingerprint, PortalServiceError } from '../portals/services.ts';

const LEVELS = [
  { level: 1, title: 'Getting Started', min_points: 0 },
  { level: 2, title: 'Steady Learner', min_points: 50 },
  { level: 3, title: 'Review Builder', min_points: 125 },
  { level: 4, title: 'Mishnah Climber', min_points: 250 },
  { level: 5, title: 'Chazara Champion', min_points: 450 },
] as const;

const MEANINGFUL_POINTS = {
  attendance_present: 5,
  attendance_streak: 4,
  review_completed: 4,
  review_streak: 4,
  retention_review: 3,
  mishnah_completed: 6,
  question_approved: 2,
  personal_milestone: 8,
  class_milestone: 5,
  parent_reward_completed: 1,
} satisfies Record<Exclude<GamificationReasonCode, 'admin_correction'>, number>;

const REASON_LABELS = {
  attendance_present: 'Class attended',
  attendance_streak: 'Attendance streak kept',
  review_completed: 'Review completed',
  review_streak: 'Review streak kept',
  retention_review: 'Retention review completed',
  mishnah_completed: 'Mishnah completed',
  question_approved: 'Question reviewed',
  personal_milestone: 'Personal milestone reached',
  class_milestone: 'Class milestone reached',
  parent_reward_completed: 'Parent reward completed',
} satisfies Record<Exclude<GamificationReasonCode, 'admin_correction'>, string>;

const ABUSE_WORDS = ['click', 'tap', 'random', 'loot', 'lottery', 'leaderboard', 'ranking'];
const MISHNAYOS_TARGET = 24;

export type GamificationEventRow = {
  reward_event_key: string;
  learner_key: string;
  points_delta: number;
  reason_code: GamificationReasonCode;
  reason_label: string;
  actor_ref: string;
  source_type: 'admin' | 'parent_capability' | 'system';
  correction_of_event_key: string | null;
  occurred_at: string;
};

export type GamificationLearnerSnapshot = {
  learner: LearnerProfile;
  reward_events: GamificationEventRow[];
  attendance_dates: string[];
  class_total: number;
  review_items_total: number;
  answered_questions: number;
  parent_rewards: ParentRewardGoal[];
  class_milestones: ClassMilestone[];
};

export type GamificationRepository = {
  loadLearnerSnapshot(args: {
    actor: PortalActorContext;
    learner_key: string;
  }): Promise<GamificationLearnerSnapshot | null>;
  recordLearningEvent(args: {
    actor: PortalActorContext;
    payload: GamificationLearningEventPayload;
    points_delta: number;
    reason_label: string;
    request_fingerprint: string;
  }): Promise<GamificationEventRow>;
  createParentRewardGoal(args: {
    actor: PortalActorContext;
    payload: ParentRewardGoalPayload;
    request_fingerprint: string;
  }): Promise<ParentRewardGoal>;
  reverseEvent(args: {
    actor: PortalActorContext;
    payload: GamificationCorrectionPayload;
    request_fingerprint: string;
  }): Promise<GamificationCorrectionAudit>;
  loadAdminDashboard(args: { actor: PortalActorContext }): Promise<{
    generated_at: string;
    snapshots: GamificationLearnerSnapshot[];
    class_milestones: ClassMilestone[];
    correction_audit: GamificationCorrectionAudit[];
  }>;
};

export type GamificationService = ReturnType<typeof createGamificationService>;

export function createGamificationService(input: {
  repository: GamificationRepository;
  clock?: () => Date;
}) {
  const now = input.clock ?? (() => new Date());
  return {
    async summaryForLearner(
      actor: PortalActorContext,
      learnerKey: string,
    ): Promise<GamificationSummary> {
      requireGamificationRead(actor, learnerKey);
      const snapshot = await input.repository.loadLearnerSnapshot({
        actor,
        learner_key: learnerKey,
      });
      if (!snapshot) {
        throw new PortalServiceError('NOT_FOUND', 'The requested portal record was not found.');
      }
      return buildSummary(snapshot, actor, now());
    },

    async recordLearningEvent(
      actor: PortalActorContext,
      payload: GamificationLearningEventPayload,
    ) {
      requireGamificationAdmin(actor);
      assertMeaningfulEvent(payload);
      const row = await input.repository.recordLearningEvent({
        actor,
        payload,
        points_delta: MEANINGFUL_POINTS[payload.reason_code],
        reason_label: REASON_LABELS[payload.reason_code],
        request_fingerprint: fingerprint(payload),
      });
      return eventToAccomplishment(row);
    },

    async createParentRewardGoal(actor: PortalActorContext, payload: ParentRewardGoalPayload) {
      if (actor.actor_role !== 'parent') {
        throw new PortalServiceError('FORBIDDEN', 'Parent rewards require a parent session.');
      }
      if (!hasPortalCapability(actor, 'gamification:write')) {
        throw new PortalServiceError('FORBIDDEN', 'This parent session cannot create rewards.');
      }
      assertNoAbuseText(`${payload.title} ${payload.description ?? ''}`);
      return input.repository.createParentRewardGoal({
        actor,
        payload,
        request_fingerprint: fingerprint(payload),
      });
    },

    async reverseEvent(actor: PortalActorContext, payload: GamificationCorrectionPayload) {
      requireGamificationAdmin(actor);
      assertNoAbuseText(payload.reason);
      return input.repository.reverseEvent({
        actor,
        payload,
        request_fingerprint: fingerprint(payload),
      });
    },

    async adminDashboard(actor: PortalActorContext): Promise<AdminGamificationDashboard> {
      requireGamificationAdmin(actor);
      const data = await input.repository.loadAdminDashboard({ actor });
      const learners = data.snapshots.map((snapshot) => {
        const summary = buildSummary(snapshot, actor, now());
        return {
          learner_key: snapshot.learner.learner_key,
          household_key: snapshot.learner.household_key,
          display_name: snapshot.learner.display_name,
          learning_points: summary.learning_points,
          level_title: summary.level.title,
          attendance_streak:
            summary.streaks.find((streak) => streak.kind === 'attendance')?.current_count ?? 0,
          review_streak:
            summary.streaks.find((streak) => streak.kind === 'review')?.current_count ?? 0,
          retention_percent: summary.progress.retention_percent,
          last_activity_at: summary.accomplishments[0]?.occurred_at ?? null,
        };
      });
      const totalPoints = learners.reduce((sum, learner) => sum + learner.learning_points, 0);
      const averageRetention =
        learners.length === 0
          ? 0
          : Math.round(
              learners.reduce((sum, learner) => sum + learner.retention_percent, 0) /
                learners.length,
            );
      return {
        generated_at: data.generated_at,
        aggregate: {
          learner_count: learners.length,
          total_learning_points: totalPoints,
          active_attendance_streaks: learners.filter((learner) => learner.attendance_streak > 0)
            .length,
          average_retention_percent: averageRetention,
        },
        learners,
        class_milestones: data.class_milestones,
        correction_audit: data.correction_audit,
        guardrails: guardrailsFor(actor),
      };
    },
  };
}

export function createPortalGamificationAdapter(service: GamificationService) {
  return {
    summaryForLearner: async ({
      actor,
      learner,
    }: {
      actor: PortalActorContext;
      learner: LearnerProfile;
    }) => service.summaryForLearner(actor, learner.learner_key),
  };
}

export function emptyGamificationSummary(
  learnerKey: string,
  actor: Pick<PortalActorContext, 'actor_role'>,
): GamificationSummary {
  return {
    learner_key: learnerKey,
    learning_points: 0,
    level: levelForPoints(0),
    progress: {
      mishnayos_completed: 0,
      mishnayos_target: MISHNAYOS_TARGET,
      classes_attended: 0,
      classes_total: 0,
      review_items_completed: 0,
      review_items_total: 0,
      retention_reviews_completed: 0,
      retention_percent: 0,
    },
    streaks: [emptyStreak('attendance'), emptyStreak('review')],
    badges: [],
    milestones: [],
    accomplishments: [],
    parent_rewards: [],
    class_milestones: [],
    celebration: null,
    guardrails: guardrailsFor(actor),
  };
}

function buildSummary(
  snapshot: GamificationLearnerSnapshot,
  actor: Pick<PortalActorContext, 'actor_role'>,
  now: Date,
): GamificationSummary {
  const events = snapshot.reward_events.map(eventToAccomplishment);
  const learningPoints = Math.max(
    0,
    snapshot.reward_events.reduce((sum, event) => sum + event.points_delta, 0),
  );
  const reviewCompleted = countEvents(snapshot, 'review_completed');
  const retentionCompleted = countEvents(snapshot, 'retention_review');
  const mishnayosCompleted = countEvents(snapshot, 'mishnah_completed');
  const attended = snapshot.attendance_dates.length;
  const attendanceStreak = streakFromDates('attendance', snapshot.attendance_dates, now);
  const reviewStreak = streakFromEvents(
    'review',
    snapshot.reward_events.filter((event) =>
      ['review_completed', 'retention_review', 'review_streak'].includes(event.reason_code),
    ),
    now,
  );
  const reviewTarget = Math.max(snapshot.review_items_total, reviewCompleted, 1);
  const retentionPercent = Math.min(100, Math.round((retentionCompleted / reviewTarget) * 100));
  const progress = {
    mishnayos_completed: mishnayosCompleted,
    mishnayos_target: MISHNAYOS_TARGET,
    classes_attended: attended,
    classes_total: Math.max(snapshot.class_total, attended),
    review_items_completed: reviewCompleted,
    review_items_total: snapshot.review_items_total,
    retention_reviews_completed: retentionCompleted,
    retention_percent: retentionPercent,
  };
  return {
    learner_key: snapshot.learner.learner_key,
    learning_points: learningPoints,
    level: levelForPoints(learningPoints),
    progress,
    streaks: [attendanceStreak, reviewStreak],
    badges: badgesFor({ learningPoints, progress, snapshot, attendanceStreak, reviewStreak }),
    milestones: milestonesFor({ learningPoints, progress, attendanceStreak, reviewStreak }),
    accomplishments: events.slice(0, 20),
    parent_rewards: markEarnedRewards(snapshot.parent_rewards, learningPoints),
    class_milestones: snapshot.class_milestones,
    celebration: celebrationFor(events),
    guardrails: guardrailsFor(actor),
  };
}

function requireGamificationRead(actor: PortalActorContext, learnerKey: string) {
  if (!hasPortalCapability(actor, 'gamification:read')) {
    throw new PortalServiceError('FORBIDDEN', 'This session cannot view learning progress.');
  }
  if (actor.actor_role === 'student' && actor.student_learner?.learner_key !== learnerKey) {
    throw new PortalServiceError('NOT_FOUND', 'The requested portal record was not found.');
  }
}

function requireGamificationAdmin(actor: PortalActorContext) {
  if (actor.actor_role !== 'owner' && actor.actor_role !== 'admin') {
    throw new PortalServiceError('FORBIDDEN', 'Gamification administration requires owner/admin.');
  }
  if (!hasPortalCapability(actor, 'gamification:admin')) {
    throw new PortalServiceError('FORBIDDEN', 'This session cannot administer gamification.');
  }
}

function assertMeaningfulEvent(payload: GamificationLearningEventPayload) {
  assertNoAbuseText(`${payload.reason_code} ${payload.source_ref ?? ''}`);
  if (payload.reason_code === 'parent_reward_completed') {
    throw new PortalServiceError(
      'VALIDATION_ERROR',
      'Parent reward completion cannot be used to farm learning points.',
    );
  }
}

function assertNoAbuseText(value: string) {
  const normalized = value.toLowerCase();
  const blocked = ABUSE_WORDS.find((word) => normalized.includes(word));
  if (blocked) {
    throw new PortalServiceError(
      'VALIDATION_ERROR',
      `Gamification V1 does not reward ${blocked}-based engagement.`,
    );
  }
}

function countEvents(snapshot: GamificationLearnerSnapshot, reason: GamificationReasonCode) {
  return snapshot.reward_events.filter((event) => event.reason_code === reason).length;
}

function levelForPoints(points: number): LearningLevel {
  const current = [...LEVELS].reverse().find((level) => points >= level.min_points) ?? LEVELS[0];
  const next = LEVELS.find((level) => level.min_points > current.min_points) ?? null;
  const progress_percent = next
    ? Math.min(
        100,
        Math.round(((points - current.min_points) / (next.min_points - current.min_points)) * 100),
      )
    : 100;
  return {
    level: current.level,
    title: current.title,
    min_points: current.min_points,
    next_level_points: next?.min_points ?? null,
    progress_percent,
  };
}

function streakFromDates(kind: LearningStreak['kind'], isoDates: string[], now: Date) {
  const days = uniqueDays(isoDates);
  if (days.length === 0) return emptyStreak(kind);
  return streakFromDayKeys(kind, days, now);
}

function streakFromEvents(kind: LearningStreak['kind'], events: GamificationEventRow[], now: Date) {
  return streakFromDates(
    kind,
    events.map((event) => event.occurred_at),
    now,
  );
}

function streakFromDayKeys(
  kind: LearningStreak['kind'],
  days: string[],
  now: Date,
): LearningStreak {
  const sorted = [...days].sort();
  const best = longestConsecutiveRun(sorted);
  const last = sorted[sorted.length - 1] ?? null;
  if (!last) return emptyStreak(kind);
  let current = 1;
  for (let index = sorted.length - 1; index > 0; index -= 1) {
    if (daysBetween(sorted[index - 1]!, sorted[index]!) === 1) current += 1;
    else break;
  }
  const age = daysBetween(last, dayKey(now));
  const graceRemaining = Math.max(0, 2 - Math.max(0, age - 1));
  const status = age <= 1 ? 'active' : graceRemaining > 0 ? 'grace' : 'paused';
  return {
    kind,
    current_count: status === 'paused' ? 0 : current,
    best_count: best,
    grace_remaining: graceRemaining,
    last_earned_at: new Date(`${last}T00:00:00.000Z`).toISOString(),
    status,
  };
}

function emptyStreak(kind: LearningStreak['kind']): LearningStreak {
  return {
    kind,
    current_count: 0,
    best_count: 0,
    grace_remaining: 2,
    last_earned_at: null,
    status: 'empty',
  };
}

function uniqueDays(values: string[]) {
  return [...new Set(values.map((value) => dayKey(new Date(value))))].sort();
}

function dayKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function daysBetween(left: string, right: string) {
  const day = 24 * 60 * 60 * 1000;
  return Math.round(
    (new Date(`${right}T00:00:00.000Z`).getTime() - new Date(`${left}T00:00:00.000Z`).getTime()) /
      day,
  );
}

function longestConsecutiveRun(days: string[]) {
  if (days.length === 0) return 0;
  let best = 1;
  let current = 1;
  for (let index = 1; index < days.length; index += 1) {
    if (daysBetween(days[index - 1]!, days[index]!) === 1) current += 1;
    else current = 1;
    best = Math.max(best, current);
  }
  return best;
}

function badgesFor(input: {
  learningPoints: number;
  progress: GamificationSummary['progress'];
  snapshot: GamificationLearnerSnapshot;
  attendanceStreak: LearningStreak;
  reviewStreak: LearningStreak;
}): LearningBadge[] {
  const badges: LearningBadge[] = [];
  if (input.progress.classes_attended >= 1) {
    badges.push(
      badge('first_class', 'First class', 'Attended the first recorded class.', 'yellow'),
    );
  }
  if (input.attendanceStreak.best_count >= 3) {
    badges.push(
      badge(
        'attendance_three',
        'Three-class rhythm',
        'Built a three-class attendance streak.',
        'ice',
      ),
    );
  }
  if (input.reviewStreak.best_count >= 3) {
    badges.push(
      badge('review_three', 'Chazara rhythm', 'Completed review on three days.', 'success'),
    );
  }
  if (input.progress.mishnayos_completed >= 6) {
    badges.push(badge('six_mishnayos', 'Six Mishnayos', 'Completed six Mishnayos.', 'yellow'));
  }
  if (input.snapshot.answered_questions >= 1) {
    badges.push(
      badge(
        'thoughtful_question',
        'Thoughtful question',
        'Submitted a question that was answered.',
        'ice',
      ),
    );
  }
  if (input.learningPoints >= 125) {
    badges.push(
      badge(
        'steady_learner',
        'Steady learner',
        'Reached 125 meaningful learning points.',
        'success',
      ),
    );
  }
  return badges.slice(0, 20);
}

function badge(
  badge_key: string,
  title: string,
  description: string,
  tone: LearningBadge['tone'],
): LearningBadge {
  return { badge_key, title, description, earned_at: null, tone };
}

function milestonesFor(input: {
  learningPoints: number;
  progress: GamificationSummary['progress'];
  attendanceStreak: LearningStreak;
  reviewStreak: LearningStreak;
}): PersonalMilestone[] {
  return [
    milestone(
      'mishnayos_24',
      'Twenty-four Mishnayos',
      'Complete the first twenty-four Mishnayos in this learning track.',
      input.progress.mishnayos_completed,
      MISHNAYOS_TARGET,
    ),
    milestone(
      'attendance_10',
      'Ten classes attended',
      'Attend ten recorded classes.',
      input.progress.classes_attended,
      10,
    ),
    milestone(
      'review_10',
      'Ten reviews completed',
      'Complete ten review or chazara items.',
      input.progress.review_items_completed,
      10,
    ),
    milestone(
      'retention_80',
      'Retention check',
      'Reach 80 percent review retention coverage.',
      input.progress.retention_percent,
      80,
    ),
    milestone(
      'points_250',
      'Level climb',
      'Reach 250 meaningful learning points.',
      input.learningPoints,
      250,
    ),
    milestone(
      'streak_5',
      'Five-day rhythm',
      'Keep either attendance or review active for five days.',
      Math.max(input.attendanceStreak.best_count, input.reviewStreak.best_count),
      5,
    ),
  ];
}

function milestone(
  milestone_key: string,
  title: string,
  description: string,
  current: number,
  target: number,
): PersonalMilestone {
  const progress = Math.max(0, Math.min(current, target));
  return {
    milestone_key,
    title,
    description,
    status: progress >= target ? 'earned' : progress > 0 ? 'in_progress' : 'locked',
    progress_current: progress,
    progress_target: target,
    earned_at: null,
  };
}

function markEarnedRewards(rewards: ParentRewardGoal[], points: number) {
  return rewards.map((reward) =>
    reward.status === 'active' && points >= reward.points_required
      ? { ...reward, status: 'earned' as const }
      : reward,
  );
}

function celebrationFor(events: AccomplishmentEvent[]) {
  const latest = events.find((event) => event.points_delta > 0 && !event.reversed);
  if (!latest) return null;
  return {
    title: latest.reason_code === 'mishnah_completed' ? 'Mishnah completed' : 'Progress recorded',
    detail: latest.detail,
    event_key: latest.event_key,
  };
}

function eventToAccomplishment(event: GamificationEventRow): AccomplishmentEvent {
  const reversed = Boolean(event.correction_of_event_key) || event.points_delta < 0;
  return {
    event_key: event.reward_event_key,
    title: event.reason_label,
    detail:
      event.points_delta < 0
        ? 'Administrator correction reversed a previous point event.'
        : `${event.points_delta} learning points recorded.`,
    reason_code: event.reason_code,
    points_delta: event.points_delta,
    source_type: event.source_type,
    correction_of_event_key: event.correction_of_event_key,
    occurred_at: event.occurred_at,
    reversed,
  };
}

function guardrailsFor(actor: Pick<PortalActorContext, 'actor_role'>): GamificationGuardrails {
  return {
    no_public_rankings: true,
    no_random_rewards: true,
    meaningful_learning_only: true,
    student_scope:
      actor.actor_role === 'student'
        ? 'self_only'
        : actor.actor_role === 'parent'
          ? 'household'
          : 'authorized_staff',
  };
}
