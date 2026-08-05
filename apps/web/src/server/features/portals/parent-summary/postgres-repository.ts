import type {
  ParentBadgeSummary,
  ParentStudentProgress,
  ParentSummaryRecord,
  ParentSummaryRepository,
  ParentSummaryStudent,
} from '../../../../../../../packages/contracts/src/portals/parent-summary/index.ts';
import type { DbPool } from '../../../../../../../packages/db/src/index.ts';

type Row = Record<string, unknown>;

export function createPostgresParentSummaryRepository(
  pool: DbPool,
  input: { accountKey: string; clock?: () => Date },
): ParentSummaryRepository {
  const clock = input.clock ?? (() => new Date());
  if (!input.accountKey.trim()) throw new Error('Parent summary account scope is required.');

  return {
    async loadParentSummary(householdId): Promise<ParentSummaryRecord | null> {
      const generatedAt = clock();
      const household = await pool.query(
        `SELECT household.household_id, household.owner_adult_id,
                household.product_key, household.runtime_tier,
                household.verification_environment_id,
                adult.display_name AS owner_display_name
           FROM onetime.v21_households AS household
           JOIN onetime.v21_adult_identities AS adult
             ON adult.adult_id = household.owner_adult_id
            AND adult.product_key = household.product_key
            AND adult.runtime_tier = household.runtime_tier
            AND adult.verification_environment_id = household.verification_environment_id
            AND adult.state = 'active'
          WHERE household.household_id = $1
            AND household.product_key = 'one_time_mishnayos'
            AND household.classification = 'family'
            AND household.state = 'active'
          LIMIT 1`,
        [householdId],
      );
      if (household.rowCount !== 1) return null;
      const scope = household.rows[0] as Row;
      const product = exactText(scope.product_key, 'one_time_mishnayos');
      const runtimeTier = exactText(scope.runtime_tier, 'isolated_staging', 'production');
      const verificationEnvironmentId = text(
        scope.verification_environment_id,
        'verification environment',
      );
      const studentsResult = await pool.query(
        `SELECT student_id, COALESCE(display_name, actual_name) AS display_name, state
           FROM onetime.v21_student_profiles
          WHERE household_id = $1
            AND product_key = $2
            AND runtime_tier = $3
            AND verification_environment_id = $4
          ORDER BY created_at, student_id`,
        [householdId, product, runtimeTier, verificationEnvironmentId],
      );
      const students = studentsResult.rows.map(parentStudent);
      const studentIds = new Set(students.map(({ student_id }) => student_id));

      const scheduleResult = await pool.query(
        `SELECT occurrence.occurrence_key AS schedule_id,
                enrollment.learner_key AS student_id,
                series.title,
                occurrence.starts_at,
                occurrence.scheduled_ends_at AS ends_at,
                CASE occurrence.occurrence_state
                  WHEN 'completed' THEN 'completed'
                  WHEN 'canceled' THEN 'cancelled'
                  ELSE 'upcoming'
                END AS status
           FROM onetime.class_series_enrollments AS enrollment
           JOIN onetime.class_series AS series
             ON series.account_key = enrollment.account_key
            AND series.product_key = enrollment.product_key
            AND series.class_series_key = enrollment.class_series_key
            AND series.is_canonical = true
           JOIN onetime.class_occurrences AS occurrence
             ON occurrence.account_key = enrollment.account_key
            AND occurrence.product_key = enrollment.product_key
            AND occurrence.class_series_key = enrollment.class_series_key
          WHERE enrollment.account_key = $1
            AND enrollment.product_key = $2
            AND enrollment.household_key = $3
            AND enrollment.enrollment_state = 'active'
            AND occurrence.starts_at >= enrollment.effective_at
            AND occurrence.starts_at >= $4::timestamptz - interval '14 days'
            AND occurrence.starts_at < $4::timestamptz + interval '120 days'
          ORDER BY occurrence.starts_at, enrollment.learner_key`,
        [input.accountKey, product, householdId, generatedAt.toISOString()],
      );
      const schedule = scheduleResult.rows
        .map((row) => ({
          schedule_id: text(row.schedule_id, 'schedule'),
          student_id: text(row.student_id, 'Student'),
          title: text(row.title, 'class title'),
          starts_at: instant(row.starts_at, 'class start'),
          ends_at: instant(row.ends_at, 'class end'),
          status: exactText(row.status, 'upcoming', 'completed', 'cancelled'),
        }))
        .filter(({ student_id }) => studentIds.has(student_id));

      const progressResult = await pool.query(
        `SELECT student.student_id,
                (SELECT count(DISTINCT occurrence.occurrence_key)::int
                   FROM onetime.class_series_enrollments AS enrollment
                   JOIN onetime.class_occurrences AS occurrence
                     ON occurrence.account_key = enrollment.account_key
                    AND occurrence.product_key = enrollment.product_key
                    AND occurrence.class_series_key = enrollment.class_series_key
                  WHERE enrollment.account_key = $1
                    AND enrollment.product_key = student.product_key
                    AND enrollment.household_key = student.household_id
                    AND enrollment.learner_key = student.student_id
                    AND occurrence.starts_at >= enrollment.effective_at
                    AND occurrence.starts_at <= $5::timestamptz
                    AND occurrence.occurrence_state <> 'canceled') AS scheduled_sessions,
                (SELECT count(DISTINCT attendance.occurrence_id)::int
                   FROM onetime.classroom_attendance_projection_v21 AS attendance
                   JOIN onetime.class_occurrences AS occurrence
                     ON occurrence.occurrence_key = attendance.occurrence_id
                    AND occurrence.product_key = attendance.product
                  WHERE attendance.product = student.product_key
                    AND attendance.runtime_tier = student.runtime_tier
                    AND attendance.verification_environment_id =
                        student.verification_environment_id
                    AND attendance.student_id = student.student_id
                    AND attendance.first_joined_at IS NOT NULL
                    AND occurrence.starts_at <= $5::timestamptz) AS attended_sessions,
                COALESCE((
                  SELECT max(badge.qualifying_count)::int
                    FROM onetime.learning_badge_award_projection AS badge
                   WHERE badge.account_key = $1
                     AND badge.product_key = student.product_key
                     AND badge.runtime_tier = student.runtime_tier
                     AND badge.verification_environment_id = student.verification_environment_id
                     AND badge.learner_key = student.student_id
                     AND badge.badge_family = 'consistency'
                ), 0) AS current_streak
           FROM onetime.v21_student_profiles AS student
          WHERE student.household_id = $2
            AND student.product_key = $3
            AND student.runtime_tier = $4
            AND student.verification_environment_id = $6
            AND student.state = 'active'
          ORDER BY student.created_at, student.student_id`,
        [
          input.accountKey,
          householdId,
          product,
          runtimeTier,
          generatedAt.toISOString(),
          verificationEnvironmentId,
        ],
      );
      const badgeResult = await pool.query(
        `SELECT learner_key AS student_id,
                badge_family || ':' || badge_level AS badge_id,
                initcap(replace(badge_family, '_', ' ')) || ' ' || badge_level AS label,
                awarded_at
           FROM onetime.learning_badge_award_projection
          WHERE account_key = $1
            AND product_key = $2
            AND runtime_tier = $3
            AND verification_environment_id = $4
            AND award_state = 'awarded'
            AND learner_key = ANY($5::text[])
          ORDER BY awarded_at, badge_family, badge_level`,
        [input.accountKey, product, runtimeTier, verificationEnvironmentId, [...studentIds]],
      );
      const badges = badgeResult.rows.reduce((byStudent, row) => {
        const studentId = text(row.student_id, 'badge Student');
        const badge: ParentBadgeSummary = {
          badge_id: text(row.badge_id, 'badge'),
          label: text(row.label, 'badge label'),
          awarded_at: instant(row.awarded_at, 'badge award'),
        };
        byStudent.set(studentId, [...(byStudent.get(studentId) ?? []), badge]);
        return byStudent;
      }, new Map<string, ParentBadgeSummary[]>());
      const progress = progressResult.rows.map((row): ParentStudentProgress => {
        const studentId = text(row.student_id, 'progress Student');
        const scheduled = integer(row.scheduled_sessions, 'scheduled sessions');
        const attended = integer(row.attended_sessions, 'attended sessions');
        return {
          student_id: studentId,
          attendance: {
            attended_sessions: attended,
            scheduled_sessions: scheduled,
            attendance_percent: scheduled === 0 ? null : Math.round((attended / scheduled) * 100),
            current_streak: integer(row.current_streak, 'current streak'),
          },
          badges: badges.get(studentId) ?? [],
        };
      });

      const updatesResult = await pool.query(
        `SELECT announcement.announcement_key AS update_id,
                announcement.title,
                announcement.body AS summary,
                announcement.published_at
           FROM onetime.learning_announcements AS announcement
          WHERE announcement.account_key = $1
            AND announcement.product_key = $2
            AND announcement.runtime_tier = $3
            AND announcement.verification_environment_id = $4
            AND announcement.published_at <= $6::timestamptz
            AND (announcement.expires_at IS NULL OR announcement.expires_at > $6::timestamptz)
            AND (
              announcement.audience_kind = 'program'
              OR (announcement.audience_kind = 'parent' AND announcement.audience_key = $5)
              OR (
                announcement.audience_kind = 'class'
                AND EXISTS (
                  SELECT 1 FROM onetime.class_series_enrollments AS enrollment
                   WHERE enrollment.account_key = announcement.account_key
                     AND enrollment.product_key = announcement.product_key
                     AND enrollment.class_series_key = announcement.audience_class_key
                     AND enrollment.household_key = $5
                     AND enrollment.enrollment_state = 'active'
                )
              )
            )
          ORDER BY announcement.published_at DESC, announcement.announcement_key
          LIMIT 50`,
        [
          input.accountKey,
          product,
          runtimeTier,
          verificationEnvironmentId,
          householdId,
          generatedAt.toISOString(),
        ],
      );

      return {
        household_id: text(scope.household_id, 'household'),
        owner_adult_id: text(scope.owner_adult_id, 'owner adult'),
        display_name: `${text(scope.owner_display_name, 'owner display name')} household`,
        generated_at: generatedAt.toISOString(),
        students,
        schedule,
        progress,
        updates: updatesResult.rows.map((row) => ({
          update_id: text(row.update_id, 'update'),
          kind: 'notice' as const,
          title: text(row.title, 'update title'),
          summary: text(row.summary, 'update summary'),
          published_at: instant(row.published_at, 'update publication'),
        })),
      };
    },
  };
}

function parentStudent(row: Row): ParentSummaryStudent {
  return {
    student_id: text(row.student_id, 'Student'),
    display_name: text(row.display_name, 'Student display name'),
    state: exactText(row.state, 'active', 'archived'),
  };
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is unavailable.`);
  return value;
}

function exactText<const T extends readonly string[]>(value: unknown, ...allowed: T): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new Error('Parent summary persistence returned an invalid state.');
  }
  return value as T[number];
}

function integer(value: unknown, label: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${label} is invalid.`);
  return parsed;
}

function instant(value: unknown, label: string): string {
  const parsed = value instanceof Date ? value : new Date(text(value, label));
  if (Number.isNaN(parsed.getTime())) throw new Error(`${label} is invalid.`);
  return parsed.toISOString();
}
