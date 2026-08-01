import type { Request } from 'express';
import type {
  AttendanceProjectionChange,
  AttendanceProjectionChangePort,
} from '../../../../../../packages/contracts/src/classroom/embedded/index.ts';
import type {
  LearningActor,
  LearningProjectionChangeContext,
  LearningScope,
} from '../../../../../../packages/contracts/src/learning/index.ts';
import type { DbPool } from '../../../../../../packages/db/src/index.ts';
import {
  createLearningCanonicalReadPorts,
  createLearningEngagementRepository,
} from '../../../../../../packages/db/src/index.ts';
import type { createLearningEngagementService } from './service.ts';

export type LearningSessionIdentity = {
  sessionKey: string;
  principalId: string;
  role: string;
};

export type AuthenticatedLearningActor = {
  actor: LearningActor;
  sessionKey: string;
};

export function createPostgresLearningAdapters(pool: DbPool) {
  return {
    repository: createLearningEngagementRepository(pool),
    ...createLearningCanonicalReadPorts(pool),
  };
}

/**
 * Resolves the learning actor exclusively from the authenticated server
 * session and canonical class/roster tables. Request body, query, and path
 * values never contribute account, runtime, household, learner, or class
 * authorization.
 */
export function createPostgresLearningActorResolver(input: {
  pool: DbPool;
  scope: LearningScope;
  resolveSession: (request: Request) => Promise<LearningSessionIdentity | null>;
}) {
  return async (request: Request): Promise<AuthenticatedLearningActor | null> => {
    const session = await input.resolveSession(request);
    if (!session) return null;

    if (session.role === 'owner' || session.role === 'admin') {
      const classes = await input.pool.query(
        `SELECT class_series_key
           FROM onetime.class_series
          WHERE account_key = $1
            AND product_key = $2
            AND status = 'active'
          ORDER BY class_series_key`,
        [input.scope.accountKey, input.scope.productKey],
      );
      return {
        actor: {
          ...input.scope,
          principalId: session.principalId,
          role: 'admin',
          classIds: classes.rows.map((row) => String(row.class_series_key)),
        },
        sessionKey: session.sessionKey,
      };
    }

    // P22 intentionally registers no Parent learning surface.
    if (session.role !== 'student') return null;

    const subject = await input.pool.query(
      `SELECT profile.student_id, profile.household_id,
              enrollment.class_series_key
         FROM onetime.account_learner_identity_links AS identity_link
         JOIN onetime.v21_student_profiles AS profile
           ON profile.student_id = identity_link.learner_key
          AND profile.household_id = identity_link.household_key
          AND profile.product_key = identity_link.product_key
          AND profile.runtime_tier = $4
          AND profile.verification_environment_id = $5
          AND profile.state = 'active'
         JOIN onetime.class_series_enrollments AS enrollment
           ON enrollment.account_key = identity_link.account_key
          AND enrollment.product_key = identity_link.product_key
          AND enrollment.learner_key = profile.student_id
          AND enrollment.household_key = profile.household_id
          AND enrollment.enrollment_state = 'active'
        WHERE identity_link.account_key = $1
          AND identity_link.product_key = $2
          AND identity_link.user_key = $3
          AND identity_link.link_state = 'active'
        ORDER BY profile.student_id, enrollment.class_series_key`,
      [
        input.scope.accountKey,
        input.scope.productKey,
        session.principalId,
        input.scope.runtimeTier,
        input.scope.verificationEnvironmentId,
      ],
    );
    const first = subject.rows[0];
    if (!first) return null;
    const studentId = String(first.student_id);
    const householdId = String(first.household_id);
    if (
      subject.rows.some(
        (row) => String(row.student_id) !== studentId || String(row.household_id) !== householdId,
      )
    ) {
      return null;
    }
    return {
      actor: {
        ...input.scope,
        principalId: session.principalId,
        role: 'student',
        studentId,
        householdId,
        classIds: [...new Set(subject.rows.map((row) => String(row.class_series_key)))].sort(),
      },
      sessionKey: session.sessionKey,
    };
  };
}

type LearningService = ReturnType<typeof createLearningEngagementService>;

/**
 * The port passed to P18's live repository instance. Ordinary projection
 * changes use the internal canonical context; only exact, audited correction
 * events may construct an Admin correction actor after canonical readback.
 */
export function createLearningAttendanceProjectionChangePort(input: {
  pool: DbPool;
  scope: LearningScope;
  service: LearningService;
}): AttendanceProjectionChangePort {
  return {
    async onAttendanceProjectionChange(change) {
      const binding = await resolveProjectionChange(input.pool, input.scope, change);
      if (!binding) throw new Error('learning_attendance_projection_binding_unavailable');

      if (change.correction_audit_ref === null) {
        const context: LearningProjectionChangeContext = {
          ...input.scope,
          kind: 'canonical_attendance_projection_change',
          classId: binding.classId,
        };
        await input.service.recalculateBadgesAfterAttendanceProjectionChange(
          context,
          change.student_id,
          binding.classId,
        );
        return;
      }

      if (
        !change.correction_admin_id ||
        !change.correction_reason ||
        binding.adminPrincipalId !== change.correction_admin_id
      ) {
        throw new Error('learning_attendance_correction_authority_unavailable');
      }
      const admin: LearningActor = {
        ...input.scope,
        principalId: binding.adminPrincipalId,
        role: 'admin',
        classIds: [binding.classId],
      };
      await input.service.recalculateBadgesAfterAttendanceProjectionChange(
        admin,
        change.student_id,
        binding.classId,
        {
          auditRef: change.correction_audit_ref,
          reason: change.correction_reason,
          sourceIdentity: {
            kind: 'attendance',
            eventId: change.source_attendance_event_id,
          },
        },
      );
    },
  };
}

async function resolveProjectionChange(
  pool: DbPool,
  scope: LearningScope,
  change: AttendanceProjectionChange,
): Promise<{ classId: string; adminPrincipalId: string | null } | null> {
  if (
    change.scope.product !== scope.productKey ||
    change.scope.runtime_tier !== scope.runtimeTier ||
    change.scope.verification_environment_id !== scope.verificationEnvironmentId
  ) {
    return null;
  }
  const result = await pool.query(
    `SELECT occurrence.class_series_key,
            CASE WHEN correction_admin.user_key IS NULL THEN NULL
                 ELSE correction_admin.user_key END AS correction_admin_id
       FROM onetime.class_occurrences AS occurrence
       JOIN onetime.class_series_enrollments AS enrollment
         ON enrollment.account_key = occurrence.account_key
        AND enrollment.product_key = occurrence.product_key
        AND enrollment.class_series_key = occurrence.class_series_key
        AND enrollment.learner_key = $6
        AND enrollment.enrollment_state = 'active'
       JOIN onetime.v21_student_profiles AS profile
         ON profile.student_id = enrollment.learner_key
        AND profile.household_id = enrollment.household_key
        AND profile.product_key = enrollment.product_key
        AND profile.runtime_tier = $4
        AND profile.verification_environment_id = $5
        AND profile.state = 'active'
       JOIN onetime.classroom_attendance_events_v21 AS source_event
         ON source_event.product = occurrence.product_key
        AND source_event.runtime_tier = $4
        AND source_event.verification_environment_id = $5
        AND source_event.attendance_event_id = $8
        AND source_event.occurrence_id = occurrence.occurrence_key
        AND source_event.student_id = enrollment.learner_key
        AND source_event.source_event_ref_digest = $9
        AND source_event.audit_ref IS NOT DISTINCT FROM $10
        AND source_event.correction_reason IS NOT DISTINCT FROM $11
        AND source_event.correction_admin_id IS NOT DISTINCT FROM $7
       LEFT JOIN onetime.account_users AS correction_admin
         ON correction_admin.account_key = occurrence.account_key
        AND correction_admin.product_key = occurrence.product_key
        AND correction_admin.user_key = $7
        AND correction_admin.role IN ('owner', 'admin')
        AND correction_admin.status = 'active'
      WHERE occurrence.account_key = $1
        AND occurrence.product_key = $2
        AND occurrence.occurrence_key = $3
      LIMIT 2`,
    [
      scope.accountKey,
      scope.productKey,
      change.occurrence_id,
      scope.runtimeTier,
      scope.verificationEnvironmentId,
      change.student_id,
      change.correction_admin_id,
      change.source_attendance_event_id,
      change.source_event_ref_digest,
      change.correction_audit_ref,
      change.correction_reason,
    ],
  );
  if (result.rows.length !== 1) return null;
  return {
    classId: String(result.rows[0]?.class_series_key),
    adminPrincipalId:
      result.rows[0]?.correction_admin_id === null ||
      result.rows[0]?.correction_admin_id === undefined
        ? null
        : String(result.rows[0].correction_admin_id),
  };
}
