import { createHash, randomUUID } from 'node:crypto';
import type {
  AttendanceProjectionChangePort,
  AttendanceEvent,
  EmbeddedClassroomRepository,
} from '../../../../../../../packages/contracts/src/classroom/embedded/index.ts';
import type { JobScope } from '../../../../../../../packages/contracts/src/jobs/index.ts';
import {
  createPostgresEmbeddedClassroomRepository,
  type DbPool,
} from '../../../../../../../packages/db/src/index.ts';
import { reconcileAttendance } from '../../../../../../../packages/domain/src/classroom/embedded/index.ts';
import type { ProductionBasicActor, ProductionBasicStudentAttendance } from './service.ts';

export const PRODUCTION_BASIC_ATTENDANCE_SESSION_TTL_MS = 4 * 60 * 60_000;

type StudentActor = Extract<ProductionBasicActor, { kind: 'student' }>;

export type ProductionBasicAttendanceSession = Readonly<{
  attendance_session_key_digest: string;
  scope: JobScope;
  occurrence_id: string;
  student_id: string;
  connection_lineage_id: string;
  scheduled_start_at: string;
  scheduled_end_at: string;
  joined_observed_at: string | null;
  left_observed_at: string | null;
}>;

export interface ProductionBasicAttendanceSessionRepository {
  issue(input: {
    actor: StudentActor;
    scope: JobScope;
    meeting_ref_digest: string;
    issued_at: Date;
  }): Promise<string | null>;
  bindEvent(input: {
    actor: StudentActor;
    scope: JobScope;
    meeting_ref_digest: string;
    attendance_session_key: string;
    event_kind: 'joined' | 'left';
    observed_at: Date;
  }): Promise<ProductionBasicAttendanceSession | null>;
}

export function createProductionBasicStudentAttendance(input: {
  sessions: ProductionBasicAttendanceSessionRepository;
  attendance: EmbeddedClassroomRepository;
  scope: JobScope;
}): ProductionBasicStudentAttendance {
  return {
    issue: ({ actor, meeting_ref_digest, issued_at }) =>
      input.sessions.issue({
        actor,
        scope: input.scope,
        meeting_ref_digest,
        issued_at,
      }),
    async record({ actor, meeting_ref_digest, attendance_session_key, event_kind, observed_at }) {
      const session = await input.sessions.bindEvent({
        actor,
        scope: input.scope,
        meeting_ref_digest,
        attendance_session_key,
        event_kind,
        observed_at,
      });
      if (!session) return false;

      const stableObservedAt =
        event_kind === 'joined' ? session.joined_observed_at : session.left_observed_at;
      if (!stableObservedAt) return false;
      const eventDigest = attendanceEventDigest(session, event_kind);
      const event: AttendanceEvent = {
        attendance_event_id: `production-basic-attendance-${eventDigest}`,
        scope: session.scope,
        occurrence_id: session.occurrence_id,
        student_id: session.student_id,
        source: 'embedded_client',
        event_kind,
        observed_at: stableObservedAt,
        connection_lineage_id: session.connection_lineage_id,
        idempotency_key: `production-basic-${eventDigest}`,
        source_event_ref_digest: createHash('sha256')
          .update('production-basic-attendance-evidence-v1\0')
          .update(eventDigest)
          .update('\0')
          .update(stableObservedAt)
          .digest('hex'),
        provider_verified: false,
        correction_intervals: [],
        correction_reason: null,
        correction_admin_id: null,
        audit_ref: null,
      };
      await persistReconciledAttendance(input.attendance, session, event, observed_at);
      return true;
    },
  };
}

export function createPostgresProductionBasicStudentAttendance(input: {
  pool: DbPool;
  attendance_projection_changes: AttendanceProjectionChangePort;
  scope: JobScope;
}): ProductionBasicStudentAttendance {
  return createProductionBasicStudentAttendance({
    sessions: createPostgresProductionBasicAttendanceSessionRepository({ pool: input.pool }),
    attendance: createPostgresEmbeddedClassroomRepository(
      input.pool,
      input.attendance_projection_changes,
    ),
    scope: input.scope,
  });
}

export function createPostgresProductionBasicAttendanceSessionRepository(input: {
  pool: DbPool;
  allocate_session_key?: (() => string) | undefined;
}): ProductionBasicAttendanceSessionRepository {
  const allocateSessionKey =
    input.allocate_session_key ?? (() => `production-basic-attendance-${randomUUID()}`);
  return {
    async issue({ actor, scope, meeting_ref_digest, issued_at }) {
      const attendanceSessionKey = allocateSessionKey();
      const attendanceSessionKeyDigest = attendanceSessionDigest(attendanceSessionKey);
      const connectionLineageId = attendanceConnectionLineage(
        actor.connection_lineage_id,
        attendanceSessionKey,
      );
      const expiresAt = new Date(issued_at.getTime() + PRODUCTION_BASIC_ATTENDANCE_SESSION_TTL_MS);
      const result = await input.pool.query(
        `INSERT INTO onetime.production_basic_attendance_sessions
           (attendance_session_key_digest, account_key, product_key, runtime_tier,
            verification_environment_id, occurrence_key, learner_key,
            authenticated_session_key, connection_lineage_id, meeting_ref_digest,
            scheduled_start_at, scheduled_end_at, issued_at, expires_at)
         SELECT $1, occurrence.account_key, occurrence.product_key, $4, $5,
                occurrence.occurrence_key, $6, $7, $8, $9,
                occurrence.starts_at, occurrence.scheduled_ends_at,
                $10::timestamptz, $11::timestamptz
           FROM onetime.class_occurrences AS occurrence
           JOIN onetime.class_series AS series
             ON series.account_key = occurrence.account_key
            AND series.product_key = occurrence.product_key
            AND series.class_series_key = occurrence.class_series_key
           JOIN onetime.classroom_occurrence_learner_entitlements AS entitlement
             ON entitlement.account_key = occurrence.account_key
            AND entitlement.product_key = occurrence.product_key
            AND entitlement.occurrence_key = occurrence.occurrence_key
           JOIN onetime.portal_learners AS learner
             ON learner.account_key = entitlement.account_key
            AND learner.product_key = entitlement.product_key
            AND learner.household_key = entitlement.household_key
            AND learner.learner_key = entitlement.learner_key
          WHERE occurrence.account_key = $2
            AND occurrence.product_key = $3
            AND entitlement.learner_key = $6
            AND entitlement.entitlement_state = 'active'
            AND learner.learner_status = 'active'
            AND series.is_canonical = true
            AND series.status = 'active'
            AND series.series_state = 'active'
            AND occurrence.occurrence_state IN ('scheduled', 'preparing', 'ready', 'live')
            AND occurrence.scheduled_ends_at > occurrence.starts_at
            AND occurrence.production_basic_meeting_ref_digest = $9
            AND occurrence.production_basic_live_confirmed_at <= $10::timestamptz
            AND occurrence.production_basic_live_expires_at > $10::timestamptz
            AND occurrence.production_basic_live_expires_at
              <= occurrence.production_basic_live_confirmed_at + interval '2 hours'
          ORDER BY occurrence.production_basic_live_confirmed_at DESC,
                   occurrence.starts_at,
                   occurrence.occurrence_key
          LIMIT 1
         RETURNING attendance_session_key_digest`,
        [
          attendanceSessionKeyDigest,
          actor.scope.account_key,
          actor.scope.product_key,
          scope.runtime_tier,
          scope.verification_environment_id,
          actor.learner_key,
          actor.authenticated_session_key,
          connectionLineageId,
          meeting_ref_digest,
          issued_at,
          expiresAt,
        ],
      );
      return result.rows[0]?.attendance_session_key_digest === attendanceSessionKeyDigest
        ? attendanceSessionKey
        : null;
    },
    async bindEvent({
      actor,
      scope,
      meeting_ref_digest,
      attendance_session_key,
      event_kind,
      observed_at,
    }) {
      const connectionLineageId = attendanceConnectionLineage(
        actor.connection_lineage_id,
        attendance_session_key,
      );
      const attendanceSessionKeyDigest = attendanceSessionDigest(attendance_session_key);
      const eventColumn = event_kind === 'joined' ? 'joined_observed_at' : 'left_observed_at';
      const priorRequirement = event_kind === 'joined' ? '' : 'AND joined_observed_at IS NOT NULL';
      const result = await input.pool.query(
        `UPDATE onetime.production_basic_attendance_sessions
            SET ${eventColumn} = COALESCE(${eventColumn}, $10::timestamptz),
                version = CASE WHEN ${eventColumn} IS NULL THEN version + 1 ELSE version END,
                updated_at = CASE
                  WHEN ${eventColumn} IS NULL THEN $10::timestamptz
                  ELSE updated_at
                END
          WHERE account_key = $1
            AND product_key = $2
            AND runtime_tier = $3
            AND verification_environment_id = $4
            AND attendance_session_key_digest = $5
            AND learner_key = $6
            AND authenticated_session_key = $7
            AND connection_lineage_id = $8
            AND meeting_ref_digest = $9
            ${priorRequirement}
            AND (expires_at > $10::timestamptz OR ${eventColumn} IS NOT NULL)
        RETURNING attendance_session_key_digest, product_key, runtime_tier,
                  verification_environment_id, occurrence_key, learner_key,
                  connection_lineage_id, scheduled_start_at, scheduled_end_at,
                  joined_observed_at, left_observed_at`,
        [
          actor.scope.account_key,
          actor.scope.product_key,
          scope.runtime_tier,
          scope.verification_environment_id,
          attendanceSessionKeyDigest,
          actor.learner_key,
          actor.authenticated_session_key,
          connectionLineageId,
          meeting_ref_digest,
          observed_at,
        ],
      );
      return result.rows[0] ? mapAttendanceSession(result.rows[0]) : null;
    },
  };
}

async function persistReconciledAttendance(
  repository: EmbeddedClassroomRepository,
  subject: ProductionBasicAttendanceSession,
  event: AttendanceEvent,
  now: Date,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const evidence = await repository.loadAttendanceEvidence({
      scope: subject.scope,
      occurrence_id: subject.occurrence_id,
      student_id: subject.student_id,
    });
    const next = reconcileAttendance({
      events: [...evidence.events, event],
      scheduled_start_at: subject.scheduled_start_at,
      scheduled_end_at: subject.scheduled_end_at,
      prior_projection: evidence.projection,
      now,
    });
    if (
      await repository.appendAttendance({
        events: [event],
        prior_projection: evidence.projection,
        next_projection: next,
      })
    ) {
      return;
    }
  }
  throw new Error('production_basic_attendance_stale_write');
}

function attendanceConnectionLineage(actorLineage: string, attendanceSessionKey: string) {
  return createHash('sha256')
    .update('production-basic-attendance-lineage-v1\0')
    .update(actorLineage)
    .update('\0')
    .update(attendanceSessionKey)
    .digest('hex');
}

function attendanceSessionDigest(attendanceSessionKey: string) {
  return createHash('sha256')
    .update('production-basic-attendance-session-v1\0')
    .update(attendanceSessionKey)
    .digest('hex');
}

function attendanceEventDigest(
  session: ProductionBasicAttendanceSession,
  eventKind: 'joined' | 'left',
) {
  return createHash('sha256')
    .update('production-basic-attendance-event-v1\0')
    .update(session.scope.product)
    .update('\0')
    .update(session.scope.runtime_tier)
    .update('\0')
    .update(session.scope.verification_environment_id)
    .update('\0')
    .update(session.occurrence_id)
    .update('\0')
    .update(session.student_id)
    .update('\0')
    .update(session.attendance_session_key_digest)
    .update('\0')
    .update(eventKind)
    .digest('hex');
}

function mapAttendanceSession(row: Record<string, unknown>): ProductionBasicAttendanceSession {
  return {
    attendance_session_key_digest: requiredHex(row.attendance_session_key_digest),
    scope: {
      product: requiredProduct(row.product_key),
      runtime_tier: requiredRuntimeTier(row.runtime_tier),
      verification_environment_id: requiredVerificationEnvironment(row.verification_environment_id),
    },
    occurrence_id: required(row.occurrence_key),
    student_id: required(row.learner_key),
    connection_lineage_id: requiredHex(row.connection_lineage_id),
    scheduled_start_at: instant(row.scheduled_start_at),
    scheduled_end_at: instant(row.scheduled_end_at),
    joined_observed_at: nullableInstant(row.joined_observed_at),
    left_observed_at: nullableInstant(row.left_observed_at),
  };
}

function required(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('production_basic_attendance_session_invalid');
  }
  return value;
}

function requiredHex(value: unknown) {
  const candidate = required(value);
  if (!/^[a-f0-9]{64}$/u.test(candidate)) {
    throw new Error('production_basic_attendance_lineage_invalid');
  }
  return candidate;
}

function requiredProduct(value: unknown): JobScope['product'] {
  if (value !== 'one_time_mishnayos') {
    throw new Error('production_basic_attendance_product_invalid');
  }
  return value;
}

function requiredRuntimeTier(value: unknown): JobScope['runtime_tier'] {
  if (value !== 'isolated_staging' && value !== 'production') {
    throw new Error('production_basic_attendance_runtime_invalid');
  }
  return value;
}

function requiredVerificationEnvironment(value: unknown): JobScope['verification_environment_id'] {
  if (
    value !== 'ci' &&
    value !== 'provider_sandbox' &&
    value !== 'persistent_staging' &&
    value !== 'production_read_only' &&
    value !== 'production_operator_canary' &&
    value !== 'production_broad'
  ) {
    throw new Error('production_basic_attendance_environment_invalid');
  }
  return value;
}

function instant(value: unknown) {
  const candidate = value instanceof Date ? value : new Date(required(value));
  if (Number.isNaN(candidate.getTime())) {
    throw new Error('production_basic_attendance_instant_invalid');
  }
  return candidate.toISOString();
}

function nullableInstant(value: unknown) {
  return value === null || value === undefined ? null : instant(value);
}
