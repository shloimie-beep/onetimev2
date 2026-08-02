import type {
  AttendanceEvent,
  AttendanceProjectionChange,
  AttendanceProjectionChangePort,
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
  projectionChanges: AttendanceProjectionChangePort,
): EmbeddedClassroomRepository {
  return {
    async insertLaunchGrant(grant) {
      const inserted = await poolQuery(
        pool,
        `INSERT INTO onetime.classroom_launch_grants_v21
           (grant_id, grant_key_digest, product, runtime_tier, verification_environment_id,
            student_id, household_id, authenticated_session_id, occurrence_id, registrant_id,
            issued_at, expires_at, used_at, revoked_at, student_version, enrollment_version,
            access_version, consent_version_digest, registrant_version, occurrence_version,
            version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::timestamptz,$12::timestamptz,
                 NULL,NULL,$13,$14,$15,$16,$17,$18,$19)
         ON CONFLICT DO NOTHING
         RETURNING grant_id`,
        grantValues(grant),
      );
      if (inserted.rows[0]?.grant_id === grant.grant_id) return 'inserted';
      const replay = await poolQuery(
        pool,
        `SELECT grant_id
           FROM onetime.classroom_launch_grants_v21
          WHERE product = $3
            AND runtime_tier = $4
            AND verification_environment_id = $5
            AND grant_key_digest = $2
            AND grant_id = $1
            AND student_id = $6
            AND household_id = $7
            AND authenticated_session_id = $8
            AND occurrence_id = $9
            AND registrant_id = $10
            AND issued_at = $11::timestamptz
            AND expires_at = $12::timestamptz
            AND student_version = $13
            AND enrollment_version = $14
            AND access_version = $15
            AND consent_version_digest = $16
            AND registrant_version = $17
            AND occurrence_version = $18`,
        grantValues(grant).slice(0, 18),
      );
      if (replay.rows[0]?.grant_id !== grant.grant_id) {
        throw new Error('embedded_launch_grant_idempotency_conflict');
      }
      return 'replayed';
    },

    async loadLaunchGrant(input) {
      const result = await poolQuery(
        pool,
        `SELECT *
           FROM onetime.classroom_launch_grants_v21
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
            `UPDATE onetime.classroom_launch_grants_v21
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
            `UPDATE onetime.classroom_launch_grants_v21
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

    async loadAttendanceEvidence(input) {
      return withTransaction(pool, async (client) => {
        const values = [
          input.scope.product,
          input.scope.runtime_tier,
          input.scope.verification_environment_id,
          input.occurrence_id,
          input.student_id,
        ];
        const [events, projection] = await Promise.all([
          client.query(
            `SELECT *
               FROM onetime.classroom_attendance_events_v21
              WHERE product = $1
                AND runtime_tier = $2
                AND verification_environment_id = $3
                AND occurrence_id = $4
                AND student_id = $5
              ORDER BY observed_at ASC, convert_to(attendance_event_id, 'UTF8') ASC
              FOR SHARE`,
            values,
          ),
          client.query(
            `SELECT *
               FROM onetime.classroom_attendance_projection_v21
              WHERE product = $1
                AND runtime_tier = $2
                AND verification_environment_id = $3
                AND occurrence_id = $4
                AND student_id = $5
              FOR SHARE`,
            values,
          ),
        ]);
        return {
          events: events.rows.map(mapAttendanceEvent),
          projection:
            projection.rows[0] === undefined ? null : mapAttendanceProjection(projection.rows[0]),
        };
      });
    },

    async appendAttendance(input) {
      let changes: readonly AttendanceProjectionChange[];
      try {
        changes = await withTransaction(pool, async (client) => {
          assertAttendanceAppendInput(input);
          const persisted = [];
          const insertedChanges: AttendanceProjectionChange[] = [];
          for (const event of input.events) {
            const result = await appendEvent(client, event);
            assertProjectionBinding(input.next_projection, result.change);
            persisted.push(result.change);
            if (result.disposition === 'inserted') insertedChanges.push(result.change);
          }
          if (insertedChanges.length > 0) {
            const latestCorrection = await loadLatestCorrection(client, input.next_projection);
            assertProjectionCorrectionAuthority(
              input.next_projection,
              latestCorrection,
              insertedChanges,
            );
            await persistProjection(client, input.prior_projection, input.next_projection);
          }
          return persisted;
        });
      } catch (error) {
        if (error === STALE) return false;
        throw error;
      }
      for (const change of changes) {
        await projectionChanges.onAttendanceProjectionChange(change);
      }
      return true;
    },
  };
}

async function persistBootstrapSession(
  client: EmbeddedClassroomSqlClient,
  input: CommitBootstrapInput,
): Promise<void> {
  if (input.prior_session === null || input.prior_session.state === 'revoked') {
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
): Promise<{
  disposition: 'inserted' | 'replayed';
  change: AttendanceProjectionChange;
}> {
  const inserted = await client.query(
    `INSERT INTO onetime.classroom_attendance_events_v21
       (attendance_event_id, product, runtime_tier, verification_environment_id,
        occurrence_id, student_id, source, event_kind, observed_at,
        connection_lineage_id, idempotency_key, source_event_ref_digest,
        provider_verified, correction_intervals, correction_reason,
        correction_admin_id, audit_ref)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10,$11,$12,$13,
             $14::jsonb,$15,$16,$17)
     ON CONFLICT DO NOTHING
     RETURNING attendance_event_id, product, runtime_tier,
               verification_environment_id, occurrence_id, student_id,
               source, event_kind, source_event_ref_digest, correction_reason,
               correction_admin_id, audit_ref`,
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
  if (inserted.rows[0]?.attendance_event_id === event.attendance_event_id) {
    return {
      disposition: 'inserted',
      change: mapAttendanceProjectionChange(inserted.rows[0]),
    };
  }
  const replay = await client.query(
    `SELECT attendance_event_id, product, runtime_tier,
            verification_environment_id, occurrence_id, student_id,
            source, event_kind, source_event_ref_digest, correction_reason,
            correction_admin_id, audit_ref
       FROM onetime.classroom_attendance_events_v21
      WHERE product = $2
        AND runtime_tier = $3
        AND verification_environment_id = $4
        AND idempotency_key = $11
        AND attendance_event_id = $1
        AND occurrence_id = $5
        AND student_id = $6
        AND source = $7
        AND event_kind = $8
        AND observed_at = $9::timestamptz
        AND connection_lineage_id = $10
        AND source_event_ref_digest = $12
        AND provider_verified = $13
        AND correction_intervals = $14::jsonb
        AND correction_reason IS NOT DISTINCT FROM $15
        AND correction_admin_id IS NOT DISTINCT FROM $16
        AND audit_ref IS NOT DISTINCT FROM $17
      FOR SHARE`,
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
  if (replay.rows[0]?.attendance_event_id !== event.attendance_event_id) {
    throw new Error('attendance_event_idempotency_conflict');
  }
  return {
    disposition: 'replayed',
    change: mapAttendanceProjectionChange(replay.rows[0]),
  };
}

function assertAttendanceAppendInput(
  input: Parameters<EmbeddedClassroomRepository['appendAttendance']>[0],
): void {
  if (input.events.length === 0) throw new Error('attendance_source_event_required');
  assertProjectionCorrectionMetadata(input.next_projection);
  if (input.prior_projection !== null) {
    assertProjectionBinding(input.next_projection, input.prior_projection);
  }
  for (const event of input.events) {
    assertEventMetadata(event);
    assertProjectionBinding(input.next_projection, event);
  }
}

function assertEventMetadata(
  event: Pick<
    AttendanceEvent,
    | 'source'
    | 'event_kind'
    | 'source_event_ref_digest'
    | 'correction_intervals'
    | 'correction_reason'
    | 'correction_admin_id'
    | 'audit_ref'
  >,
): void {
  if (!/^[a-f0-9]{64}$/.test(event.source_event_ref_digest)) {
    throw new Error('attendance_source_event_digest_invalid');
  }
  const isCorrection =
    event.source === 'admin_correction' && event.event_kind === 'manual_correction';
  if (isCorrection) {
    assertCanonicalCorrectionMetadata(
      event.correction_reason,
      event.correction_admin_id,
      event.audit_ref,
    );
    return;
  }
  if (
    event.source === 'admin_correction' ||
    event.event_kind === 'manual_correction' ||
    event.correction_intervals.length > 0 ||
    event.correction_reason !== null ||
    event.correction_admin_id !== null ||
    event.audit_ref !== null
  ) {
    throw new Error('attendance_correction_metadata_invalid');
  }
}

function assertProjectionCorrectionMetadata(projection: AttendanceProjection): void {
  if (projection.reconciliation_state === 'admin_corrected') {
    assertCanonicalCorrectionReason(projection.manual_correction_reason);
    assertCanonicalIdentity(projection.correction_admin_id);
    return;
  }
  if (projection.manual_correction_reason !== null || projection.correction_admin_id !== null) {
    throw new Error('attendance_projection_correction_metadata_invalid');
  }
}

function assertProjectionCorrectionAuthority(
  projection: AttendanceProjection,
  latestCorrection: AttendanceProjectionChange | null,
  insertedChanges: readonly AttendanceProjectionChange[],
): void {
  if (latestCorrection === null) {
    if (projection.reconciliation_state === 'admin_corrected') {
      throw new Error('attendance_projection_correction_authority_invalid');
    }
    return;
  }
  if (
    projection.reconciliation_state !== 'admin_corrected' ||
    projection.manual_correction_reason !== latestCorrection.correction_reason ||
    projection.correction_admin_id !== latestCorrection.correction_admin_id
  ) {
    throw new Error('attendance_projection_correction_authority_invalid');
  }
  for (const change of insertedChanges) {
    if (change.correction_reason !== null && !sameProjectionChange(change, latestCorrection)) {
      throw new Error('attendance_projection_correction_authority_invalid');
    }
  }
}

function sameProjectionChange(
  left: AttendanceProjectionChange,
  right: AttendanceProjectionChange,
): boolean {
  return (
    left.scope.product === right.scope.product &&
    left.scope.runtime_tier === right.scope.runtime_tier &&
    left.scope.verification_environment_id === right.scope.verification_environment_id &&
    left.occurrence_id === right.occurrence_id &&
    left.student_id === right.student_id &&
    left.source_attendance_event_id === right.source_attendance_event_id &&
    left.source_event_ref_digest === right.source_event_ref_digest &&
    left.correction_audit_ref === right.correction_audit_ref &&
    left.correction_reason === right.correction_reason &&
    left.correction_admin_id === right.correction_admin_id
  );
}

function assertCanonicalCorrectionMetadata(
  reason: string | null,
  adminId: string | null,
  auditRef: string | null,
): void {
  assertCanonicalCorrectionReason(reason);
  assertCanonicalIdentity(adminId);
  assertCanonicalIdentity(auditRef);
}

function assertCanonicalCorrectionReason(reason: string | null): void {
  if (reason === null || reason.trim() !== reason || reason.length < 3 || reason.length > 1_000) {
    throw new Error('attendance_correction_metadata_invalid');
  }
}

function assertCanonicalIdentity(value: string | null): void {
  if (value === null || value.trim() !== value || value.length === 0 || value.length > 512) {
    throw new Error('attendance_correction_metadata_invalid');
  }
}

function assertProjectionBinding(
  projection: Pick<AttendanceProjection, 'scope' | 'occurrence_id' | 'student_id'>,
  source: Pick<AttendanceProjection, 'scope' | 'occurrence_id' | 'student_id'>,
): void {
  if (
    projection.occurrence_id !== source.occurrence_id ||
    projection.student_id !== source.student_id ||
    projection.scope.product !== source.scope.product ||
    projection.scope.runtime_tier !== source.scope.runtime_tier ||
    projection.scope.verification_environment_id !== source.scope.verification_environment_id
  ) {
    throw new Error('attendance_projection_event_binding_invalid');
  }
}

function mapAttendanceProjectionChange(row: SqlRow): AttendanceProjectionChange {
  assertEventMetadata({
    source: requiredEventSource(row.source),
    event_kind: requiredEventKind(row.event_kind),
    source_event_ref_digest: requiredString(row.source_event_ref_digest),
    correction_intervals: [],
    correction_reason: nullableString(row.correction_reason),
    correction_admin_id: nullableString(row.correction_admin_id),
    audit_ref: nullableString(row.audit_ref),
  });
  return {
    scope: mapAttendanceChangeScope(row),
    occurrence_id: requiredString(row.occurrence_id),
    student_id: requiredString(row.student_id),
    source_attendance_event_id: requiredString(row.attendance_event_id),
    source_event_ref_digest: requiredString(row.source_event_ref_digest),
    correction_audit_ref: nullableString(row.audit_ref),
    correction_reason: nullableString(row.correction_reason),
    correction_admin_id: nullableString(row.correction_admin_id),
  };
}

function mapAttendanceChangeScope(row: SqlRow): JobScope {
  const product = requiredString(row.product);
  const runtimeTier = requiredString(row.runtime_tier);
  const environment = requiredString(row.verification_environment_id);
  const environmentMatchesRuntime =
    (runtimeTier === 'isolated_staging' &&
      (environment === 'ci' ||
        environment === 'provider_sandbox' ||
        environment === 'persistent_staging')) ||
    (runtimeTier === 'production' &&
      (environment === 'production_read_only' ||
        environment === 'production_operator_canary' ||
        environment === 'production_broad'));
  if (product !== 'one_time_mishnayos' || !environmentMatchesRuntime) {
    throw new Error('attendance_projection_change_scope_invalid');
  }
  return {
    product,
    runtime_tier: runtimeTier,
    verification_environment_id: environment,
  };
}

function requiredEventSource(value: unknown): AttendanceEvent['source'] {
  if (value === 'zoom_provider' || value === 'embedded_client' || value === 'admin_correction') {
    return value;
  }
  throw new Error('attendance_source_invalid');
}

function requiredEventKind(value: unknown): AttendanceEvent['event_kind'] {
  if (value === 'joined' || value === 'left' || value === 'manual_correction') return value;
  throw new Error('attendance_event_kind_invalid');
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('attendance_projection_change_identity_invalid');
  }
  return value;
}

async function loadLatestCorrection(
  client: EmbeddedClassroomSqlClient,
  projection: AttendanceProjection,
): Promise<AttendanceProjectionChange | null> {
  const latest = await client.query(
    `SELECT attendance_event_id, product, runtime_tier,
            verification_environment_id, occurrence_id, student_id,
            source, event_kind, source_event_ref_digest, correction_reason,
            correction_admin_id, audit_ref
       FROM onetime.classroom_attendance_events_v21
      WHERE product = $1
        AND runtime_tier = $2
        AND verification_environment_id = $3
        AND occurrence_id = $4
        AND student_id = $5
        AND source = 'admin_correction'
        AND event_kind = 'manual_correction'
      ORDER BY observed_at DESC, convert_to(attendance_event_id, 'UTF8') DESC
      LIMIT 1
      FOR SHARE`,
    projectionValues(projection).slice(0, 5),
  );
  return latest.rows[0] === undefined ? null : mapAttendanceProjectionChange(latest.rows[0]);
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

function mapAttendanceEvent(row: SqlRow): AttendanceEvent {
  return {
    attendance_event_id: requiredString(row.attendance_event_id),
    scope: mapScope(row),
    occurrence_id: requiredString(row.occurrence_id),
    student_id: requiredString(row.student_id),
    source: requiredEventSource(row.source),
    event_kind: requiredEventKind(row.event_kind),
    observed_at: iso(row.observed_at),
    connection_lineage_id: requiredString(row.connection_lineage_id),
    idempotency_key: requiredString(row.idempotency_key),
    source_event_ref_digest: requiredString(row.source_event_ref_digest),
    provider_verified: row.provider_verified === true,
    correction_intervals: correctionIntervals(row.correction_intervals),
    correction_reason: nullableString(row.correction_reason),
    correction_admin_id: nullableString(row.correction_admin_id),
    audit_ref: nullableString(row.audit_ref),
  };
}

function mapAttendanceProjection(row: SqlRow): AttendanceProjection {
  return {
    scope: mapScope(row),
    occurrence_id: requiredString(row.occurrence_id),
    student_id: requiredString(row.student_id),
    first_joined_at: nullableIso(row.first_joined_at),
    last_left_at: nullableIso(row.last_left_at),
    total_connected_minutes: Number(row.total_connected_minutes),
    attendance_percentage: Number(row.attendance_percentage),
    reconnect_count: Number(row.reconnect_count),
    late: row.late === true,
    reconciliation_state: String(
      row.reconciliation_state,
    ) as AttendanceProjection['reconciliation_state'],
    manual_correction_reason: nullableString(row.manual_correction_reason),
    correction_admin_id: nullableString(row.correction_admin_id),
    source_event_count: Number(row.source_event_count),
    version: Number(row.version),
    updated_at: iso(row.updated_at),
  };
}

function correctionIntervals(value: unknown): AttendanceEvent['correction_intervals'] {
  const candidate = typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
  if (!Array.isArray(candidate)) throw new Error('attendance_correction_intervals_invalid');
  return candidate.map((interval) => {
    if (
      interval === null ||
      typeof interval !== 'object' ||
      typeof (interval as { joined_at?: unknown }).joined_at !== 'string' ||
      typeof (interval as { left_at?: unknown }).left_at !== 'string'
    ) {
      throw new Error('attendance_correction_intervals_invalid');
    }
    return {
      joined_at: (interval as { joined_at: string }).joined_at,
      left_at: (interval as { left_at: string }).left_at,
    };
  });
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
