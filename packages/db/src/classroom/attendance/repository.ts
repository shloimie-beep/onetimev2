import type {
  AttendanceEvent,
  AttendanceProjection,
  CommitBootstrapInput,
  EmbeddedClassroomRepository,
  LaunchGrantRecord,
  LiveStudentSession,
} from '../../../../contracts/src/classroom/embedded/index.ts';
import type { JobScope } from '../../../../contracts/src/jobs/index.ts';

type SqlRow = Record<string, unknown>;
type SqlResult<Row extends SqlRow = SqlRow> = {
  rows: Row[];
  rowCount: number | null;
};

export interface EmbeddedClassroomSqlClient {
  query<Row extends SqlRow = SqlRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<SqlResult<Row>>;
  release(): void;
}

export interface EmbeddedClassroomSqlPool {
  connect(): Promise<EmbeddedClassroomSqlClient>;
}

const STALE = new Error('embedded_classroom_stale_write');

export function createPostgresEmbeddedClassroomRepository(
  pool: EmbeddedClassroomSqlPool,
): EmbeddedClassroomRepository {
  return {
    async insertLaunchGrant(grant) {
      const inserted = await poolQuery(
        pool,
        `INSERT INTO onetime.classroom_launch_grants
           (grant_id, grant_key_digest, product, runtime_tier, verification_environment_id,
            student_id, household_id, authenticated_session_id, occurrence_id, registrant_id,
            issued_at, expires_at, used_at, revoked_at, student_version, enrollment_version,
            access_version, consent_version_digest, registrant_version, occurrence_version,
            version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::timestamptz,$12::timestamptz,
                 NULL,NULL,$13,$14,$15,$16,$17,$18,$19)
         ON CONFLICT (product, runtime_tier, verification_environment_id, grant_key_digest)
         DO UPDATE SET grant_key_digest = EXCLUDED.grant_key_digest
           WHERE classroom_launch_grants.student_id = EXCLUDED.student_id
             AND classroom_launch_grants.household_id = EXCLUDED.household_id
             AND classroom_launch_grants.authenticated_session_id = EXCLUDED.authenticated_session_id
             AND classroom_launch_grants.occurrence_id = EXCLUDED.occurrence_id
             AND classroom_launch_grants.registrant_id = EXCLUDED.registrant_id
             AND classroom_launch_grants.expires_at = EXCLUDED.expires_at
         RETURNING (xmax = 0) AS inserted`,
        grantValues(grant),
      );
      const row = inserted.rows[0];
      if (row === undefined) throw new Error('embedded_launch_grant_idempotency_conflict');
      return row.inserted === true ? 'inserted' : 'replayed';
    },

    async loadLaunchGrant(input) {
      const result = await poolQuery(
        pool,
        `SELECT *
           FROM onetime.classroom_launch_grants
          WHERE product = $1
            AND runtime_tier = $2
            AND verification_environment_id = $3
            AND grant_key_digest = $4`,
        scopeValues(input.scope, input.grant_key_digest),
      );
      return result.rows[0] === undefined ? null : mapGrant(result.rows[0]);
    },

    async loadLiveSession(input) {
      const result = await poolQuery(
        pool,
        `SELECT *
           FROM onetime.live_student_classroom_sessions
          WHERE product = $1
            AND runtime_tier = $2
            AND verification_environment_id = $3
            AND student_id = $4
          ORDER BY lease_generation DESC
          LIMIT 1`,
        scopeValues(input.scope, input.student_id),
      );
      return result.rows[0] === undefined ? null : mapSession(result.rows[0]);
    },

    async commitBootstrap(input) {
      try {
        return await withTransaction(pool, async (client) => {
          const consumed = await client.query(
            `UPDATE onetime.classroom_launch_grants
                SET used_at = $2::timestamptz,
                    version = $3
              WHERE grant_id = $1
                AND version = $4
                AND used_at IS NULL
                AND revoked_at IS NULL
                AND expires_at >= $2::timestamptz
              RETURNING grant_id`,
            [
              input.next_grant.grant_id,
              input.next_grant.used_at,
              input.next_grant.version,
              input.prior_grant.version,
            ],
          );
          if (consumed.rowCount !== 1) throw STALE;
          await persistBootstrapSession(client, input);
          return true;
        });
      } catch (error) {
        if (error === STALE) return false;
        throw error;
      }
    },

    async persistLiveSession(input) {
      const updated = await poolQuery(
        pool,
        `UPDATE onetime.live_student_classroom_sessions
            SET state = $2,
                lease_generation = $3,
                last_heartbeat_at = $4::timestamptz,
                lease_expires_at = $5::timestamptz,
                revoked_at = $6::timestamptz,
                revoked_by_admin_id = $7,
                revoke_audit_ref = $8,
                version = $9
          WHERE live_session_id = $1
            AND version = $10
          RETURNING live_session_id`,
        [
          input.next.live_session_id,
          input.next.state,
          input.next.lease_generation,
          input.next.last_heartbeat_at,
          input.next.lease_expires_at,
          input.next.revoked_at,
          input.next.revoked_by_admin_id,
          input.next.revoke_audit_ref,
          input.next.version,
          input.prior.version,
        ],
      );
      return updated.rowCount === 1;
    },

    async resetStudentLaunch(input) {
      try {
        return await withTransaction(pool, async (client) => {
          const updated = await client.query(
            `UPDATE onetime.live_student_classroom_sessions
                SET state = 'revoked',
                    revoked_at = $2::timestamptz,
                    revoked_by_admin_id = $3,
                    revoke_audit_ref = $4,
                    version = $5
              WHERE live_session_id = $1
                AND version = $6
                AND state = 'active'
              RETURNING live_session_id`,
            [
              input.next_session.live_session_id,
              input.next_session.revoked_at,
              input.next_session.revoked_by_admin_id,
              input.next_session.revoke_audit_ref,
              input.next_session.version,
              input.prior_session.version,
            ],
          );
          if (updated.rowCount !== 1) throw STALE;
          await client.query(
            `UPDATE onetime.classroom_launch_grants
                SET revoked_at = $4::timestamptz,
                    version = version + 1
              WHERE product = $1
                AND runtime_tier = $2
                AND verification_environment_id = $3
                AND student_id = $5
                AND used_at IS NULL
                AND revoked_at IS NULL`,
            [
              input.next_session.scope.product,
              input.next_session.scope.runtime_tier,
              input.next_session.scope.verification_environment_id,
              input.now.toISOString(),
              input.next_session.student_id,
            ],
          );
          return true;
        });
      } catch (error) {
        if (error === STALE) return false;
        throw error;
      }
    },

    async appendAttendance(input) {
      try {
        return await withTransaction(pool, async (client) => {
          for (const event of input.events) {
            await appendEvent(client, event);
          }
          await persistProjection(client, input.prior_projection, input.next_projection);
          return true;
        });
      } catch (error) {
        if (error === STALE) return false;
        throw error;
      }
    },
  };
}

async function persistBootstrapSession(
  client: EmbeddedClassroomSqlClient,
  input: CommitBootstrapInput,
): Promise<void> {
  if (input.prior_session === null) {
    const inserted = await client.query(
      `INSERT INTO onetime.live_student_classroom_sessions
         (live_session_id, product, runtime_tier, verification_environment_id,
          student_id, household_id, occurrence_id, authenticated_session_id,
          device_lineage_id, state, lease_generation, last_heartbeat_at,
          lease_expires_at, revoked_at, revoked_by_admin_id, revoke_audit_ref, version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::timestamptz,
               $13::timestamptz,NULL,NULL,NULL,$14)
       ON CONFLICT DO NOTHING
       RETURNING live_session_id`,
      sessionValues(input.next_session),
    );
    if (inserted.rowCount !== 1) throw STALE;
    return;
  }
  const updated = await client.query(
    `UPDATE onetime.live_student_classroom_sessions
        SET live_session_id = $1,
            household_id = $6,
            occurrence_id = $7,
            authenticated_session_id = $8,
            device_lineage_id = $9,
            state = $10,
            lease_generation = $11,
            last_heartbeat_at = $12::timestamptz,
            lease_expires_at = $13::timestamptz,
            revoked_at = NULL,
            revoked_by_admin_id = NULL,
            revoke_audit_ref = NULL,
            version = $14
      WHERE live_session_id = $15
        AND version = $16
      RETURNING live_session_id`,
    [
      ...sessionValues(input.next_session),
      input.prior_session.live_session_id,
      input.prior_session.version,
    ],
  );
  if (updated.rowCount !== 1) throw STALE;
}

async function appendEvent(
  client: EmbeddedClassroomSqlClient,
  event: AttendanceEvent,
): Promise<void> {
  const inserted = await client.query(
    `INSERT INTO onetime.classroom_attendance_events_v21
       (attendance_event_id, product, runtime_tier, verification_environment_id,
        occurrence_id, student_id, source, event_kind, observed_at,
        connection_lineage_id, idempotency_key, source_event_ref_digest,
        provider_verified, correction_intervals, correction_reason,
        correction_admin_id, audit_ref)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10,$11,$12,$13,
             $14::jsonb,$15,$16,$17)
     ON CONFLICT (product, runtime_tier, verification_environment_id, idempotency_key)
     DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
       WHERE classroom_attendance_events_v21.source_event_ref_digest =
             EXCLUDED.source_event_ref_digest
     RETURNING attendance_event_id`,
    [
      event.attendance_event_id,
      event.scope.product,
      event.scope.runtime_tier,
      event.scope.verification_environment_id,
      event.occurrence_id,
      event.student_id,
      event.source,
      event.event_kind,
      event.observed_at,
      event.connection_lineage_id,
      event.idempotency_key,
      event.source_event_ref_digest,
      event.provider_verified,
      JSON.stringify(event.correction_intervals),
      event.correction_reason,
      event.correction_admin_id,
      event.audit_ref,
    ],
  );
  if (inserted.rowCount !== 1) throw new Error('attendance_event_idempotency_conflict');
}

async function persistProjection(
  client: EmbeddedClassroomSqlClient,
  prior: AttendanceProjection | null,
  next: AttendanceProjection,
): Promise<void> {
  const values = projectionValues(next);
  if (prior === null) {
    const inserted = await client.query(
      `INSERT INTO onetime.classroom_attendance_projection_v21
         (product, runtime_tier, verification_environment_id, occurrence_id, student_id,
          first_joined_at, last_left_at, total_connected_minutes, attendance_percentage,
          reconnect_count, late, reconciliation_state, manual_correction_reason,
          correction_admin_id, source_event_count, version, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6::timestamptz,$7::timestamptz,$8,$9,$10,$11,
               $12,$13,$14,$15,$16,$17::timestamptz)
       ON CONFLICT DO NOTHING
       RETURNING occurrence_id`,
      values,
    );
    if (inserted.rowCount !== 1) throw STALE;
    return;
  }
  const updated = await client.query(
    `UPDATE onetime.classroom_attendance_projection_v21
        SET first_joined_at = $6::timestamptz,
            last_left_at = $7::timestamptz,
            total_connected_minutes = $8,
            attendance_percentage = $9,
            reconnect_count = $10,
            late = $11,
            reconciliation_state = $12,
            manual_correction_reason = $13,
            correction_admin_id = $14,
            source_event_count = $15,
            version = $16,
            updated_at = $17::timestamptz
      WHERE product = $1
        AND runtime_tier = $2
        AND verification_environment_id = $3
        AND occurrence_id = $4
        AND student_id = $5
        AND version = $18
      RETURNING occurrence_id`,
    [...values, prior.version],
  );
  if (updated.rowCount !== 1) throw STALE;
}

async function withTransaction<T>(
  pool: EmbeddedClassroomSqlPool,
  run: (client: EmbeddedClassroomSqlClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function poolQuery(
  pool: EmbeddedClassroomSqlPool,
  text: string,
  values: readonly unknown[],
): Promise<SqlResult> {
  const client = await pool.connect();
  try {
    return await client.query(text, values);
  } finally {
    client.release();
  }
}

function scopeValues(scope: JobScope, value: string): readonly unknown[] {
  return [scope.product, scope.runtime_tier, scope.verification_environment_id, value];
}

function grantValues(grant: LaunchGrantRecord): readonly unknown[] {
  return [
    grant.grant_id,
    grant.grant_key_digest,
    grant.scope.product,
    grant.scope.runtime_tier,
    grant.scope.verification_environment_id,
    grant.student_id,
    grant.household_id,
    grant.authenticated_session_id,
    grant.occurrence_id,
    grant.registrant_id,
    grant.issued_at,
    grant.expires_at,
    grant.student_version,
    grant.enrollment_version,
    grant.access_version,
    grant.consent_version_digest,
    grant.registrant_version,
    grant.occurrence_version,
    grant.version,
  ];
}

function sessionValues(session: LiveStudentSession): readonly unknown[] {
  return [
    session.live_session_id,
    session.scope.product,
    session.scope.runtime_tier,
    session.scope.verification_environment_id,
    session.student_id,
    session.household_id,
    session.occurrence_id,
    session.authenticated_session_id,
    session.device_lineage_id,
    session.state,
    session.lease_generation,
    session.last_heartbeat_at,
    session.lease_expires_at,
    session.version,
  ];
}

function projectionValues(projection: AttendanceProjection): readonly unknown[] {
  return [
    projection.scope.product,
    projection.scope.runtime_tier,
    projection.scope.verification_environment_id,
    projection.occurrence_id,
    projection.student_id,
    projection.first_joined_at,
    projection.last_left_at,
    projection.total_connected_minutes,
    projection.attendance_percentage,
    projection.reconnect_count,
    projection.late,
    projection.reconciliation_state,
    projection.manual_correction_reason,
    projection.correction_admin_id,
    projection.source_event_count,
    projection.version,
    projection.updated_at,
  ];
}

function mapGrant(row: SqlRow): LaunchGrantRecord {
  return {
    grant_id: String(row.grant_id),
    grant_key_digest: String(row.grant_key_digest),
    scope: mapScope(row),
    student_id: String(row.student_id),
    household_id: String(row.household_id),
    authenticated_session_id: String(row.authenticated_session_id),
    occurrence_id: String(row.occurrence_id),
    registrant_id: String(row.registrant_id),
    issued_at: iso(row.issued_at),
    expires_at: iso(row.expires_at),
    used_at: nullableIso(row.used_at),
    revoked_at: nullableIso(row.revoked_at),
    student_version: Number(row.student_version),
    enrollment_version: Number(row.enrollment_version),
    access_version: Number(row.access_version),
    consent_version_digest: String(row.consent_version_digest),
    registrant_version: Number(row.registrant_version),
    occurrence_version: Number(row.occurrence_version),
    version: Number(row.version),
  };
}

function mapSession(row: SqlRow): LiveStudentSession {
  return {
    live_session_id: String(row.live_session_id),
    scope: mapScope(row),
    student_id: String(row.student_id),
    household_id: String(row.household_id),
    occurrence_id: String(row.occurrence_id),
    authenticated_session_id: String(row.authenticated_session_id),
    device_lineage_id: String(row.device_lineage_id),
    state: String(row.state) as LiveStudentSession['state'],
    lease_generation: Number(row.lease_generation),
    last_heartbeat_at: iso(row.last_heartbeat_at),
    lease_expires_at: iso(row.lease_expires_at),
    revoked_at: nullableIso(row.revoked_at),
    revoked_by_admin_id: nullableString(row.revoked_by_admin_id),
    revoke_audit_ref: nullableString(row.revoke_audit_ref),
    version: Number(row.version),
  };
}

function mapScope(row: SqlRow): JobScope {
  return {
    product: String(row.product) as JobScope['product'],
    runtime_tier: String(row.runtime_tier) as JobScope['runtime_tier'],
    verification_environment_id: String(
      row.verification_environment_id,
    ) as JobScope['verification_environment_id'],
  };
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function nullableIso(value: unknown): string | null {
  return value === null || value === undefined ? null : iso(value);
}

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}
