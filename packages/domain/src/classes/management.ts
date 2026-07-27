import type { AppConfig } from '../../../config/src/index.ts';
import type {
  AttachClassRecordingPayload,
  ClassEnrollment,
  ClassEnrollmentCandidate,
  ClassEnrollmentPayload,
  ClassRecording,
  ClassRecordingAccess,
  ClassSeries,
  CreateClassOccurrencePayload,
  CreateClassSeriesPayload,
  ManagedClassOccurrence,
  SetClassRecordingAccessPayload,
  UpdateClassOccurrencePayload,
  UpdateClassSeriesPayload,
} from '../../../contracts/src/classes/index.ts';
import type { DbPool, Queryable } from '../../../db/src/index.ts';
import { inTransaction } from '../../../db/src/index.ts';
import { stableKey } from '../lead/normalize.ts';

export type ClassManagementActor = {
  userKey: string;
  role: 'owner' | 'admin';
};

export type ClassManagementErrorCode =
  'NOT_FOUND' | 'VERSION_CONFLICT' | 'INVALID_STATE' | 'IDEMPOTENCY_CONFLICT';

export class ClassManagementError extends Error {
  readonly code: ClassManagementErrorCode;
  readonly currentVersion?: number;

  constructor(code: ClassManagementErrorCode, message: string, currentVersion?: number) {
    super(message);
    this.code = code;
    if (currentVersion !== undefined) this.currentVersion = currentVersion;
  }
}

export async function listManagedClassSeries(input: {
  pool: DbPool;
  config: AppConfig;
}): Promise<ClassSeries[]> {
  const result = await input.pool.query(
    `SELECT *
       FROM onetime.class_series
      WHERE account_key = $1
        AND product_key = $2
      ORDER BY status ASC, updated_at DESC, class_series_key ASC
      LIMIT 100`,
    [input.config.accountKey, input.config.productKey],
  );
  return result.rows.map(classSeriesFromRow);
}

export async function getManagedClassOccurrence(input: {
  pool: DbPool;
  config: AppConfig;
  occurrenceKey: string;
}): Promise<ManagedClassOccurrence | null> {
  return getManagedClassOccurrenceFrom(input.pool, input.config, input.occurrenceKey);
}

export async function createManagedClassSeries(input: {
  pool: DbPool;
  config: AppConfig;
  actor: ClassManagementActor;
  payload: CreateClassSeriesPayload;
}): Promise<ClassSeries> {
  assertTimeZone(input.payload.timezone);
  return inTransaction(input.pool, async (client) => {
    const seriesKey = stableKey('class_series', [
      input.config.accountKey,
      input.config.productKey,
      input.payload.idempotency_key,
    ]);
    const result = await client.query(
      `INSERT INTO onetime.class_series
         (class_series_key, account_key, product_key, title, description, teacher_name,
          timezone, local_start_time, reminder_local_time, status, version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::time,$9::time,'active',1)
       ON CONFLICT (account_key, product_key, class_series_key) DO NOTHING
       RETURNING *`,
      [
        seriesKey,
        input.config.accountKey,
        input.config.productKey,
        input.payload.title,
        input.payload.description,
        input.payload.teacher_name,
        input.payload.timezone,
        input.payload.local_start_time,
        input.payload.reminder_local_time,
      ],
    );
    const existing =
      result.rows[0] ??
      (
        await client.query(
          `SELECT *
             FROM onetime.class_series
            WHERE account_key = $1 AND product_key = $2 AND class_series_key = $3
            LIMIT 1`,
          [input.config.accountKey, input.config.productKey, seriesKey],
        )
      ).rows[0];
    if (!existing) throw new ClassManagementError('NOT_FOUND', 'Class could not be created.');
    const series = classSeriesFromRow(existing);
    if (
      series.title !== input.payload.title ||
      series.description !== input.payload.description ||
      series.teacher_name !== input.payload.teacher_name ||
      series.timezone !== input.payload.timezone ||
      series.local_start_time !== input.payload.local_start_time ||
      series.reminder_local_time !== input.payload.reminder_local_time
    ) {
      throw new ClassManagementError(
        'IDEMPOTENCY_CONFLICT',
        'This request key was already used for a different class.',
      );
    }
    if (result.rows[0]) {
      await recordClassAudit(client, input.config, input.actor, {
        action: 'class_series_created',
        classSeriesKey: seriesKey,
        idempotencyKey: input.payload.idempotency_key,
      });
    }
    return series;
  });
}

export async function updateManagedClassSeries(input: {
  pool: DbPool;
  config: AppConfig;
  actor: ClassManagementActor;
  seriesKey: string;
  payload: UpdateClassSeriesPayload;
}): Promise<ClassSeries> {
  assertTimeZone(input.payload.timezone);
  return inTransaction(input.pool, async (client) => {
    const result = await client.query(
      `UPDATE onetime.class_series
          SET title = $4,
              description = $5,
              teacher_name = $6,
              timezone = $7,
              local_start_time = $8::time,
              reminder_local_time = $9::time,
              status = $10,
              version = version + 1,
              updated_at = now()
        WHERE account_key = $1
          AND product_key = $2
          AND class_series_key = $3
          AND version = $11
        RETURNING *`,
      [
        input.config.accountKey,
        input.config.productKey,
        input.seriesKey,
        input.payload.title,
        input.payload.description,
        input.payload.teacher_name,
        input.payload.timezone,
        input.payload.local_start_time,
        input.payload.reminder_local_time,
        input.payload.status,
        input.payload.version,
      ],
    );
    const row = result.rows[0];
    if (!row) {
      await throwClassVersionOrNotFound(
        client,
        input.config,
        'class_series',
        'class_series_key',
        input.seriesKey,
      );
    }
    await recordClassAudit(client, input.config, input.actor, {
      action: 'class_series_updated',
      classSeriesKey: input.seriesKey,
      idempotencyKey: `version-${input.payload.version}`,
    });
    return classSeriesFromRow(row);
  });
}

export async function createManagedClassOccurrence(input: {
  pool: DbPool;
  config: AppConfig;
  actor: ClassManagementActor;
  payload: CreateClassOccurrencePayload;
}): Promise<ManagedClassOccurrence> {
  return inTransaction(input.pool, async (client) => {
    const series = await client.query(
      `SELECT class_series_key
         FROM onetime.class_series
        WHERE account_key = $1 AND product_key = $2 AND class_series_key = $3
          AND status <> 'archived'
        LIMIT 1`,
      [input.config.accountKey, input.config.productKey, input.payload.class_series_key],
    );
    if (!series.rows[0]) {
      throw new ClassManagementError('NOT_FOUND', 'Class was not found or is archived.');
    }
    const startsAt = new Date(input.payload.starts_at);
    const endsAt = new Date(input.payload.ends_at);
    const occurrenceKey = stableKey('class_occurrence', [
      input.config.accountKey,
      input.config.productKey,
      input.payload.class_series_key,
      input.payload.local_class_date,
    ]);
    const result = await client.query(
      `INSERT INTO onetime.class_occurrences
         (occurrence_key, account_key, product_key, class_series_key, local_class_date,
          starts_at, reminder_due_at, joinable_until, occurrence_state, reminder_state,
          join_opens_at, join_closes_at, scheduled_ends_at, duration_minutes,
          timezone_snapshot, version, is_operator_test, operator_test_environment)
       SELECT $1,$2,$3,$4,$5::date,$6::timestamptz,$7::timestamptz,$8::timestamptz,
              'scheduled','not_required',$9::timestamptz,$8::timestamptz,$8::timestamptz,
              $10::int,timezone,1,$11::boolean,
              CASE WHEN $11::boolean THEN $12 ELSE NULL END
         FROM onetime.class_series
        WHERE account_key = $2 AND product_key = $3 AND class_series_key = $4
       ON CONFLICT (account_key, product_key, class_series_key, local_class_date) DO NOTHING
       RETURNING occurrence_key`,
      [
        occurrenceKey,
        input.config.accountKey,
        input.config.productKey,
        input.payload.class_series_key,
        input.payload.local_class_date,
        startsAt,
        new Date(startsAt.getTime() - 30 * 60_000),
        endsAt,
        new Date(startsAt.getTime() - 15 * 60_000),
        Math.max(1, Math.ceil((endsAt.getTime() - startsAt.getTime()) / 60_000)),
        input.payload.is_operator_test,
        input.config.oneTimeRuntimeEnvironment,
      ],
    );
    if (!result.rows[0]) {
      const existing = await getManagedClassOccurrenceFrom(client, input.config, occurrenceKey);
      if (
        !existing ||
        existing.starts_at !== startsAt.toISOString() ||
        existing.ends_at !== endsAt.toISOString()
      ) {
        throw new ClassManagementError(
          'IDEMPOTENCY_CONFLICT',
          'That class date already has a different occurrence.',
        );
      }
      return existing;
    }
    await recordClassAudit(client, input.config, input.actor, {
      action: 'class_occurrence_created',
      classSeriesKey: input.payload.class_series_key,
      occurrenceKey,
      idempotencyKey: input.payload.idempotency_key,
    });
    const created = await getManagedClassOccurrenceFrom(client, input.config, occurrenceKey);
    if (!created) throw new ClassManagementError('NOT_FOUND', 'Occurrence could not be created.');
    return created;
  });
}

export async function updateManagedClassOccurrence(input: {
  pool: DbPool;
  config: AppConfig;
  actor: ClassManagementActor;
  occurrenceKey: string;
  payload: UpdateClassOccurrencePayload;
}): Promise<ManagedClassOccurrence> {
  return inTransaction(input.pool, async (client) => {
    const startsAt = new Date(input.payload.starts_at);
    const endsAt = new Date(input.payload.ends_at);
    const result = await client.query(
      `UPDATE onetime.class_occurrences
          SET starts_at = $4,
              reminder_due_at = $5,
              join_opens_at = $6,
              join_closes_at = $7,
              joinable_until = $7,
              scheduled_ends_at = $7,
              duration_minutes = $8,
              occurrence_state = $9,
              schedule_version = schedule_version + 1,
              version = version + 1,
              updated_at = now()
        WHERE account_key = $1
          AND product_key = $2
          AND occurrence_key = $3
          AND version = $10
        RETURNING occurrence_key`,
      [
        input.config.accountKey,
        input.config.productKey,
        input.occurrenceKey,
        startsAt,
        new Date(startsAt.getTime() - 30 * 60_000),
        new Date(startsAt.getTime() - 15 * 60_000),
        endsAt,
        Math.max(1, Math.ceil((endsAt.getTime() - startsAt.getTime()) / 60_000)),
        input.payload.status,
        input.payload.version,
      ],
    );
    if (!result.rows[0]) {
      await throwClassVersionOrNotFound(
        client,
        input.config,
        'class_occurrences',
        'occurrence_key',
        input.occurrenceKey,
      );
    }
    await recordClassAudit(client, input.config, input.actor, {
      action: 'class_occurrence_updated',
      occurrenceKey: input.occurrenceKey,
      idempotencyKey: `version-${input.payload.version}`,
    });
    const updated = await getManagedClassOccurrenceFrom(client, input.config, input.occurrenceKey);
    if (!updated) throw new ClassManagementError('NOT_FOUND', 'Occurrence was not found.');
    return updated;
  });
}

export async function listClassEnrollments(input: {
  pool: DbPool;
  config: AppConfig;
  occurrenceKey: string;
}): Promise<ClassEnrollment[]> {
  const result = await input.pool.query(
    `SELECT enrollment.occurrence_key,
            enrollment.household_key,
            enrollment.learner_key,
            enrollment.entitlement_state,
            enrollment.updated_at,
            learner.display_name
       FROM onetime.classroom_occurrence_learner_entitlements AS enrollment
       JOIN onetime.portal_learners AS learner
         ON learner.account_key = enrollment.account_key
        AND learner.product_key = enrollment.product_key
        AND learner.learner_key = enrollment.learner_key
      WHERE enrollment.account_key = $1
        AND enrollment.product_key = $2
        AND enrollment.occurrence_key = $3
      ORDER BY enrollment.entitlement_state ASC, learner.display_name ASC, enrollment.learner_key ASC`,
    [input.config.accountKey, input.config.productKey, input.occurrenceKey],
  );
  return result.rows.map(classEnrollmentFromRow);
}

export async function listClassEnrollmentCandidates(input: {
  pool: DbPool;
  config: AppConfig;
  occurrenceKey: string;
}): Promise<ClassEnrollmentCandidate[]> {
  const occurrence = await input.pool.query(
    `SELECT 1
       FROM onetime.class_occurrences
      WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3
      LIMIT 1`,
    [input.config.accountKey, input.config.productKey, input.occurrenceKey],
  );
  if (!occurrence.rows[0]) {
    throw new ClassManagementError('NOT_FOUND', 'Class occurrence was not found.');
  }
  const result = await input.pool.query(
    `SELECT learner.household_key,
            learner.learner_key,
            learner.display_name,
            enrollment.entitlement_state
       FROM onetime.portal_learners AS learner
       LEFT JOIN onetime.classroom_occurrence_learner_entitlements AS enrollment
         ON enrollment.account_key = learner.account_key
        AND enrollment.product_key = learner.product_key
        AND enrollment.learner_key = learner.learner_key
        AND enrollment.occurrence_key = $3
      WHERE learner.account_key = $1
        AND learner.product_key = $2
        AND learner.learner_status = 'active'
      ORDER BY learner.display_name ASC, learner.learner_key ASC
      LIMIT 500`,
    [input.config.accountKey, input.config.productKey, input.occurrenceKey],
  );
  return result.rows.map((row) => ({
    household_key: String(row.household_key),
    learner_key: String(row.learner_key),
    learner_name: String(row.display_name),
    enrollment_state: row.entitlement_state
      ? (String(row.entitlement_state) as ClassEnrollmentCandidate['enrollment_state'])
      : null,
  }));
}

export async function enrollLearnerInClass(input: {
  pool: DbPool;
  config: AppConfig;
  actor: ClassManagementActor;
  occurrenceKey: string;
  payload: ClassEnrollmentPayload;
}): Promise<ClassEnrollment> {
  return inTransaction(input.pool, async (client) => {
    const learner = await loadActiveLearner(client, input.config, input.payload.learner_key);
    const occurrence = await client.query(
      `SELECT occurrence_state
         FROM onetime.class_occurrences
        WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3
        LIMIT 1`,
      [input.config.accountKey, input.config.productKey, input.occurrenceKey],
    );
    if (!occurrence.rows[0]) {
      throw new ClassManagementError('NOT_FOUND', 'Class occurrence was not found.');
    }
    if (occurrence.rows[0].occurrence_state === 'cancelled') {
      throw new ClassManagementError(
        'INVALID_STATE',
        'A cancelled class cannot accept enrollment.',
      );
    }
    await client.query(
      `INSERT INTO onetime.classroom_occurrence_learner_entitlements
         (occurrence_entitlement_key, account_key, product_key, occurrence_key,
          household_key, learner_key, entitlement_state, source, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'active','operator',now())
       ON CONFLICT (account_key, product_key, occurrence_key, learner_key)
       DO UPDATE SET household_key = EXCLUDED.household_key,
                     entitlement_state = 'active',
                     source = 'operator',
                     revoked_at = NULL,
                     updated_at = now()`,
      [
        stableKey('occurrence_enrollment', [input.occurrenceKey, input.payload.learner_key]),
        input.config.accountKey,
        input.config.productKey,
        input.occurrenceKey,
        learner.household_key,
        input.payload.learner_key,
      ],
    );
    await grantAttachedRecordingAccess(client, input.config, {
      occurrenceKey: input.occurrenceKey,
      learnerKey: input.payload.learner_key,
      householdKey: String(learner.household_key),
    });
    await recordClassAudit(client, input.config, input.actor, {
      action: 'class_learner_enrolled',
      occurrenceKey: input.occurrenceKey,
      learnerKey: input.payload.learner_key,
      householdKey: String(learner.household_key),
      idempotencyKey: input.payload.idempotency_key,
    });
    return loadClassEnrollment(
      client,
      input.config,
      input.occurrenceKey,
      input.payload.learner_key,
    );
  });
}

export async function unenrollLearnerFromClass(input: {
  pool: DbPool;
  config: AppConfig;
  actor: ClassManagementActor;
  occurrenceKey: string;
  learnerKey: string;
  idempotencyKey: string;
}): Promise<ClassEnrollment> {
  return inTransaction(input.pool, async (client) => {
    const result = await client.query(
      `UPDATE onetime.classroom_occurrence_learner_entitlements
          SET entitlement_state = 'revoked',
              revoked_at = COALESCE(revoked_at, now()),
              updated_at = now()
        WHERE account_key = $1
          AND product_key = $2
          AND occurrence_key = $3
          AND learner_key = $4
        RETURNING household_key`,
      [input.config.accountKey, input.config.productKey, input.occurrenceKey, input.learnerKey],
    );
    if (!result.rows[0]) {
      throw new ClassManagementError('NOT_FOUND', 'Class enrollment was not found.');
    }
    await client.query(
      `UPDATE onetime.content_item_entitlements
          SET entitlement_state = 'revoked',
              revoked_at = COALESCE(revoked_at, now())
        WHERE account_key = $1
          AND product_key = $2
          AND learner_key = $4
          AND content_item_key IN (
            SELECT content_item_key
              FROM onetime.content_items
             WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3
          )`,
      [input.config.accountKey, input.config.productKey, input.occurrenceKey, input.learnerKey],
    );
    await recordClassAudit(client, input.config, input.actor, {
      action: 'class_learner_unenrolled',
      occurrenceKey: input.occurrenceKey,
      learnerKey: input.learnerKey,
      householdKey: String(result.rows[0].household_key),
      idempotencyKey: input.idempotencyKey,
    });
    return loadClassEnrollment(client, input.config, input.occurrenceKey, input.learnerKey);
  });
}

export async function listClassRecordings(input: {
  pool: DbPool;
  config: AppConfig;
  occurrenceKey: string;
}): Promise<ClassRecording[]> {
  const result = await input.pool.query(recordingSelectSql('items.occurrence_key = $3'), [
    input.config.accountKey,
    input.config.productKey,
    input.occurrenceKey,
  ]);
  return result.rows.map(classRecordingFromRow);
}

export async function listClassRecordingAccess(input: {
  pool: DbPool;
  config: AppConfig;
  occurrenceKey: string;
  itemKey: string;
}): Promise<ClassRecordingAccess[]> {
  const item = await input.pool.query(
    `SELECT 1
       FROM onetime.content_items
      WHERE account_key = $1 AND product_key = $2
        AND occurrence_key = $3 AND content_item_key = $4
      LIMIT 1`,
    [input.config.accountKey, input.config.productKey, input.occurrenceKey, input.itemKey],
  );
  if (!item.rows[0]) {
    throw new ClassManagementError('NOT_FOUND', 'Attached recording was not found.');
  }
  const result = await input.pool.query(
    `SELECT enrollment.occurrence_key,
            $4::text AS content_item_key,
            enrollment.household_key,
            enrollment.learner_key,
            learner.display_name,
            enrollment.entitlement_state,
            COALESCE(entitlement.entitlement_state, 'not_granted') AS access
       FROM onetime.classroom_occurrence_learner_entitlements AS enrollment
       JOIN onetime.portal_learners AS learner
         ON learner.account_key = enrollment.account_key
        AND learner.product_key = enrollment.product_key
        AND learner.learner_key = enrollment.learner_key
       LEFT JOIN (
         SELECT account_key,
                product_key,
                content_item_key,
                learner_key,
                CASE
                  WHEN sum(CASE WHEN entitlement_state = 'active' THEN 1 ELSE 0 END) > 0
                  THEN 'active'
                  ELSE 'revoked'
                END AS entitlement_state
           FROM onetime.content_item_entitlements
          WHERE audience = 'learner'
          GROUP BY account_key, product_key, content_item_key, learner_key
       ) AS entitlement
         ON entitlement.account_key = enrollment.account_key
        AND entitlement.product_key = enrollment.product_key
        AND entitlement.content_item_key = $4
        AND entitlement.learner_key = enrollment.learner_key
      WHERE enrollment.account_key = $1
        AND enrollment.product_key = $2
        AND enrollment.occurrence_key = $3
      ORDER BY enrollment.entitlement_state ASC, learner.display_name ASC,
               enrollment.learner_key ASC`,
    [input.config.accountKey, input.config.productKey, input.occurrenceKey, input.itemKey],
  );
  return result.rows.map((row) => ({
    occurrence_key: String(row.occurrence_key),
    content_item_key: String(row.content_item_key),
    household_key: String(row.household_key),
    learner_key: String(row.learner_key),
    learner_name: String(row.display_name),
    enrollment_state: String(row.entitlement_state) as ClassRecordingAccess['enrollment_state'],
    access: String(row.access) as ClassRecordingAccess['access'],
  }));
}

export async function attachRecordingToClass(input: {
  pool: DbPool;
  config: AppConfig;
  actor: ClassManagementActor;
  occurrenceKey: string;
  payload: AttachClassRecordingPayload;
}): Promise<ClassRecording> {
  return inTransaction(input.pool, async (client) => {
    const occurrence = await client.query(
      `SELECT occurrence_key
         FROM onetime.class_occurrences
        WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3
        LIMIT 1`,
      [input.config.accountKey, input.config.productKey, input.occurrenceKey],
    );
    if (!occurrence.rows[0]) {
      throw new ClassManagementError('NOT_FOUND', 'Class occurrence was not found.');
    }
    const itemResult = await client.query(
      `SELECT content_item_key, occurrence_key, lifecycle_state, published_revision_key, item_type
         FROM onetime.content_items
        WHERE account_key = $1 AND product_key = $2 AND content_item_key = $3
        LIMIT 1`,
      [input.config.accountKey, input.config.productKey, input.payload.content_item_key],
    );
    const item = itemResult.rows[0];
    if (!item) throw new ClassManagementError('NOT_FOUND', 'Recording was not found.');
    if (item.item_type !== 'video') {
      throw new ClassManagementError('INVALID_STATE', 'Only video recordings can be attached.');
    }
    if (item.occurrence_key && item.occurrence_key !== input.occurrenceKey) {
      throw new ClassManagementError(
        'INVALID_STATE',
        'This recording is already attached to another class occurrence.',
      );
    }
    if (
      input.payload.availability === 'available' &&
      (item.lifecycle_state !== 'published' || !item.published_revision_key)
    ) {
      throw new ClassManagementError(
        'INVALID_STATE',
        'Publish the protected recording before making it available.',
      );
    }
    await client.query(
      `UPDATE onetime.content_items
          SET occurrence_key = $4,
              updated_at = now()
        WHERE account_key = $1 AND product_key = $2 AND content_item_key = $3`,
      [
        input.config.accountKey,
        input.config.productKey,
        input.payload.content_item_key,
        input.occurrenceKey,
      ],
    );
    await client.query(
      `UPDATE onetime.content_item_entitlements
          SET entitlement_state = 'revoked',
              revoked_at = COALESCE(revoked_at, now())
        WHERE account_key = $1 AND product_key = $2 AND content_item_key = $3`,
      [input.config.accountKey, input.config.productKey, input.payload.content_item_key],
    );
    if (input.payload.availability === 'available') {
      const roster = await client.query(
        `SELECT household_key, learner_key
           FROM onetime.classroom_occurrence_learner_entitlements
          WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3
            AND entitlement_state = 'active'`,
        [input.config.accountKey, input.config.productKey, input.occurrenceKey],
      );
      for (const learner of roster.rows) {
        await upsertRecordingEntitlement(client, input.config, {
          itemKey: input.payload.content_item_key,
          occurrenceKey: input.occurrenceKey,
          householdKey: String(learner.household_key),
          learnerKey: String(learner.learner_key),
          state: 'active',
        });
      }
    }
    await refreshOccurrenceRecordingState(client, input.config, input.occurrenceKey);
    await recordClassAudit(client, input.config, input.actor, {
      action:
        input.payload.availability === 'available'
          ? 'class_recording_attached'
          : 'class_recording_unavailable',
      occurrenceKey: input.occurrenceKey,
      idempotencyKey: input.payload.idempotency_key,
      metadata: { content_item_key: input.payload.content_item_key },
    });
    return loadClassRecording(
      client,
      input.config,
      input.occurrenceKey,
      input.payload.content_item_key,
    );
  });
}

export async function setClassRecordingLearnerAccess(input: {
  pool: DbPool;
  config: AppConfig;
  actor: ClassManagementActor;
  occurrenceKey: string;
  itemKey: string;
  payload: SetClassRecordingAccessPayload;
}): Promise<ClassRecording> {
  return inTransaction(input.pool, async (client) => {
    const item = await client.query(
      `SELECT lifecycle_state, published_revision_key
         FROM onetime.content_items
        WHERE account_key = $1 AND product_key = $2
          AND occurrence_key = $3 AND content_item_key = $4
        LIMIT 1`,
      [input.config.accountKey, input.config.productKey, input.occurrenceKey, input.itemKey],
    );
    if (!item.rows[0]) {
      throw new ClassManagementError('NOT_FOUND', 'Attached recording was not found.');
    }
    const enrollment = await client.query(
      `SELECT household_key, entitlement_state
         FROM onetime.classroom_occurrence_learner_entitlements
        WHERE account_key = $1 AND product_key = $2
          AND occurrence_key = $3 AND learner_key = $4
        LIMIT 1`,
      [
        input.config.accountKey,
        input.config.productKey,
        input.occurrenceKey,
        input.payload.learner_key,
      ],
    );
    if (!enrollment.rows[0] || enrollment.rows[0].entitlement_state !== 'active') {
      throw new ClassManagementError(
        'INVALID_STATE',
        'Recording access requires an active class enrollment.',
      );
    }
    if (
      input.payload.access === 'active' &&
      (item.rows[0].lifecycle_state !== 'published' || !item.rows[0].published_revision_key)
    ) {
      throw new ClassManagementError('INVALID_STATE', 'The recording is not published.');
    }
    await upsertRecordingEntitlement(client, input.config, {
      itemKey: input.itemKey,
      occurrenceKey: input.occurrenceKey,
      householdKey: String(enrollment.rows[0].household_key),
      learnerKey: input.payload.learner_key,
      state: input.payload.access,
    });
    await refreshOccurrenceRecordingState(client, input.config, input.occurrenceKey);
    await recordClassAudit(client, input.config, input.actor, {
      action:
        input.payload.access === 'active'
          ? 'class_recording_access_granted'
          : 'class_recording_access_revoked',
      occurrenceKey: input.occurrenceKey,
      learnerKey: input.payload.learner_key,
      householdKey: String(enrollment.rows[0].household_key),
      idempotencyKey: input.payload.idempotency_key,
      metadata: { content_item_key: input.itemKey },
    });
    return loadClassRecording(client, input.config, input.occurrenceKey, input.itemKey);
  });
}

async function loadActiveLearner(client: Queryable, config: AppConfig, learnerKey: string) {
  const result = await client.query(
    `SELECT learner_key, household_key
       FROM onetime.portal_learners
      WHERE account_key = $1 AND product_key = $2 AND learner_key = $3
        AND learner_status = 'active'
      LIMIT 1
      FOR UPDATE`,
    [config.accountKey, config.productKey, learnerKey],
  );
  if (!result.rows[0]) {
    throw new ClassManagementError('NOT_FOUND', 'Active learner was not found.');
  }
  return result.rows[0];
}

async function grantAttachedRecordingAccess(
  client: Queryable,
  config: AppConfig,
  input: { occurrenceKey: string; learnerKey: string; householdKey: string },
) {
  const items = await client.query(
    `SELECT content_item_key
       FROM onetime.content_items
      WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3
        AND lifecycle_state = 'published'
        AND published_revision_key IS NOT NULL
        AND retention_state = 'active'`,
    [config.accountKey, config.productKey, input.occurrenceKey],
  );
  for (const item of items.rows) {
    await upsertRecordingEntitlement(client, config, {
      itemKey: String(item.content_item_key),
      occurrenceKey: input.occurrenceKey,
      householdKey: input.householdKey,
      learnerKey: input.learnerKey,
      state: 'active',
    });
  }
}

async function upsertRecordingEntitlement(
  client: Queryable,
  config: AppConfig,
  input: {
    itemKey: string;
    occurrenceKey: string;
    householdKey: string;
    learnerKey: string;
    state: 'active' | 'revoked';
  },
) {
  await client.query(
    `INSERT INTO onetime.content_item_entitlements
       (entitlement_key, account_key, product_key, content_item_key, audience,
        household_key, learner_key, entitlement_state, revoked_at)
     VALUES ($1,$2,$3,$4,'learner',$5,$6,$7,
             CASE WHEN $7 = 'revoked' THEN now() ELSE NULL END)
     ON CONFLICT (account_key, product_key, entitlement_key)
     DO UPDATE SET household_key = EXCLUDED.household_key,
                   learner_key = EXCLUDED.learner_key,
                   entitlement_state = EXCLUDED.entitlement_state,
                   revoked_at = EXCLUDED.revoked_at`,
    [
      stableKey('class_recording_access', [input.itemKey, input.occurrenceKey, input.learnerKey]),
      config.accountKey,
      config.productKey,
      input.itemKey,
      input.householdKey,
      input.learnerKey,
      input.state,
    ],
  );
}

async function refreshOccurrenceRecordingState(
  client: Queryable,
  config: AppConfig,
  occurrenceKey: string,
) {
  await client.query(
    `UPDATE onetime.class_occurrences
        SET recording_state = CASE
              WHEN EXISTS (
                SELECT 1
                  FROM onetime.content_items AS item
                  JOIN onetime.content_item_entitlements AS entitlement
                    ON entitlement.account_key = item.account_key
                   AND entitlement.product_key = item.product_key
                   AND entitlement.content_item_key = item.content_item_key
                   AND entitlement.entitlement_state = 'active'
                 WHERE item.account_key = $1
                   AND item.product_key = $2
                   AND item.occurrence_key = $3
                   AND item.lifecycle_state = 'published'
                   AND item.published_revision_key IS NOT NULL
              ) THEN 'available'
              WHEN EXISTS (
                SELECT 1 FROM onetime.content_items
                 WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3
              ) THEN 'unavailable'
              ELSE 'not_expected'
            END,
            updated_at = now()
      WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3`,
    [config.accountKey, config.productKey, occurrenceKey],
  );
}

async function loadClassEnrollment(
  client: Queryable,
  config: AppConfig,
  occurrenceKey: string,
  learnerKey: string,
): Promise<ClassEnrollment> {
  const result = await client.query(
    `SELECT enrollment.occurrence_key,
            enrollment.household_key,
            enrollment.learner_key,
            enrollment.entitlement_state,
            enrollment.updated_at,
            learner.display_name
       FROM onetime.classroom_occurrence_learner_entitlements AS enrollment
       JOIN onetime.portal_learners AS learner
         ON learner.account_key = enrollment.account_key
        AND learner.product_key = enrollment.product_key
        AND learner.learner_key = enrollment.learner_key
      WHERE enrollment.account_key = $1
        AND enrollment.product_key = $2
        AND enrollment.occurrence_key = $3
        AND enrollment.learner_key = $4
      LIMIT 1`,
    [config.accountKey, config.productKey, occurrenceKey, learnerKey],
  );
  if (!result.rows[0]) {
    throw new ClassManagementError('NOT_FOUND', 'Class enrollment was not found.');
  }
  return classEnrollmentFromRow(result.rows[0]);
}

async function loadClassRecording(
  client: Queryable,
  config: AppConfig,
  occurrenceKey: string,
  itemKey: string,
): Promise<ClassRecording> {
  const result = await client.query(
    recordingSelectSql('items.occurrence_key = $3 AND items.content_item_key = $4'),
    [config.accountKey, config.productKey, occurrenceKey, itemKey],
  );
  if (!result.rows[0]) {
    throw new ClassManagementError('NOT_FOUND', 'Attached recording was not found.');
  }
  return classRecordingFromRow(result.rows[0]);
}

function recordingSelectSql(where: string) {
  return `SELECT items.occurrence_key,
                 items.content_item_key,
                 items.title,
                 CASE
                   WHEN items.lifecycle_state = 'published'
                    AND items.published_revision_key IS NOT NULL
                    AND count(entitlement.entitlement_key)
                        FILTER (WHERE entitlement.entitlement_state = 'active') > 0
                   THEN 'available'
                   ELSE 'unavailable'
                 END AS availability,
                 count(entitlement.entitlement_key)
                   FILTER (WHERE entitlement.entitlement_state = 'active')::int
                   AS entitled_learner_count,
                 count(entitlement.entitlement_key)
                   FILTER (WHERE entitlement.entitlement_state = 'revoked')::int
                   AS revoked_learner_count
            FROM onetime.content_items AS items
            LEFT JOIN onetime.content_item_entitlements AS entitlement
              ON entitlement.account_key = items.account_key
             AND entitlement.product_key = items.product_key
             AND entitlement.content_item_key = items.content_item_key
             AND entitlement.audience = 'learner'
           WHERE items.account_key = $1
             AND items.product_key = $2
             AND ${where}
           GROUP BY items.occurrence_key, items.content_item_key, items.title,
                    items.lifecycle_state, items.published_revision_key, items.updated_at
           ORDER BY items.updated_at DESC, items.content_item_key ASC`;
}

async function getManagedClassOccurrenceFrom(
  client: Queryable,
  config: AppConfig,
  occurrenceKey: string,
): Promise<ManagedClassOccurrence | null> {
  const result = await client.query(
    `SELECT occurrence.*, series.title, series.timezone
       FROM onetime.class_occurrences AS occurrence
       JOIN onetime.class_series AS series
         ON series.account_key = occurrence.account_key
        AND series.product_key = occurrence.product_key
        AND series.class_series_key = occurrence.class_series_key
      WHERE occurrence.account_key = $1
        AND occurrence.product_key = $2
        AND occurrence.occurrence_key = $3
      LIMIT 1`,
    [config.accountKey, config.productKey, occurrenceKey],
  );
  if (!result.rows[0]) return null;
  const enrollmentCount = await client.query(
    `SELECT count(*)::int AS enrolled_learner_count
       FROM onetime.classroom_occurrence_learner_entitlements
      WHERE account_key = $1
        AND product_key = $2
        AND occurrence_key = $3
        AND entitlement_state = 'active'`,
    [config.accountKey, config.productKey, occurrenceKey],
  );
  return managedOccurrenceFromRow({
    ...result.rows[0],
    enrolled_learner_count: enrollmentCount.rows[0]?.enrolled_learner_count ?? 0,
  });
}

async function throwClassVersionOrNotFound(
  client: Queryable,
  config: AppConfig,
  table: 'class_series' | 'class_occurrences',
  keyColumn: 'class_series_key' | 'occurrence_key',
  key: string,
): Promise<never> {
  const current = await client.query(
    `SELECT version
       FROM onetime.${table}
      WHERE account_key = $1 AND product_key = $2 AND ${keyColumn} = $3
      LIMIT 1`,
    [config.accountKey, config.productKey, key],
  );
  if (!current.rows[0]) throw new ClassManagementError('NOT_FOUND', 'Class was not found.');
  throw new ClassManagementError(
    'VERSION_CONFLICT',
    'This class changed in another session. Reload before saving.',
    Number(current.rows[0].version),
  );
}

async function recordClassAudit(
  client: Queryable,
  config: AppConfig,
  actor: ClassManagementActor,
  input: {
    action: string;
    idempotencyKey: string;
    classSeriesKey?: string;
    occurrenceKey?: string;
    householdKey?: string;
    learnerKey?: string;
    metadata?: Record<string, unknown>;
  },
) {
  await client.query(
    `INSERT INTO onetime.classroom_audit_events
       (audit_key, account_key, product_key, actor_user_ref, actor_role,
        household_key, learner_key, occurrence_key, event_type, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
     ON CONFLICT (audit_key) DO NOTHING`,
    [
      stableKey('class_management_audit', [
        input.action,
        input.classSeriesKey ?? '',
        input.occurrenceKey ?? '',
        input.learnerKey ?? '',
        input.idempotencyKey,
      ]),
      config.accountKey,
      config.productKey,
      actor.userKey,
      actor.role,
      input.householdKey ?? null,
      input.learnerKey ?? null,
      input.occurrenceKey ?? null,
      input.action,
      JSON.stringify({
        ...(input.classSeriesKey ? { class_series_key: input.classSeriesKey } : {}),
        ...(input.metadata ?? {}),
      }),
    ],
  );
}

function classSeriesFromRow(row: Record<string, unknown>): ClassSeries {
  return {
    class_series_key: String(row.class_series_key),
    title: String(row.title),
    description: nullableString(row.description),
    teacher_name: nullableString(row.teacher_name),
    timezone: String(row.timezone),
    local_start_time: localTimeFromRow(row.local_start_time),
    reminder_local_time: localTimeFromRow(row.reminder_local_time),
    status: String(row.status) as ClassSeries['status'],
    version: Number(row.version),
    created_at: asDate(row.created_at).toISOString(),
    updated_at: asDate(row.updated_at).toISOString(),
  };
}

function managedOccurrenceFromRow(row: Record<string, unknown>): ManagedClassOccurrence {
  return {
    occurrence_key: String(row.occurrence_key),
    class_series_key: String(row.class_series_key),
    title: String(row.title),
    local_class_date: localDateFromRow(row.local_class_date),
    starts_at: asDate(row.starts_at).toISOString(),
    ends_at: asDate(row.scheduled_ends_at ?? row.joinable_until).toISOString(),
    timezone: String(row.timezone),
    status: String(row.occurrence_state) as ManagedClassOccurrence['status'],
    access_state: String(row.access_state) as ManagedClassOccurrence['access_state'],
    recording_state: String(row.recording_state) as ManagedClassOccurrence['recording_state'],
    enrolled_learner_count: Number(row.enrolled_learner_count ?? 0),
    is_operator_test: Boolean(row.is_operator_test),
    operator_test_environment: nullableString(row.operator_test_environment),
    version: Number(row.version),
    created_at: asDate(row.created_at).toISOString(),
    updated_at: asDate(row.updated_at).toISOString(),
  };
}

function classEnrollmentFromRow(row: Record<string, unknown>): ClassEnrollment {
  return {
    occurrence_key: String(row.occurrence_key),
    household_key: String(row.household_key),
    learner_key: String(row.learner_key),
    learner_name: String(row.display_name),
    enrollment_state: String(row.entitlement_state) as ClassEnrollment['enrollment_state'],
    updated_at: asDate(row.updated_at).toISOString(),
  };
}

function classRecordingFromRow(row: Record<string, unknown>): ClassRecording {
  return {
    occurrence_key: String(row.occurrence_key),
    content_item_key: String(row.content_item_key),
    title: String(row.title),
    availability: String(row.availability) as ClassRecording['availability'],
    entitled_learner_count: Number(row.entitled_learner_count ?? 0),
    revoked_learner_count: Number(row.revoked_learner_count ?? 0),
  };
}

function assertTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
  } catch {
    throw new ClassManagementError('INVALID_STATE', 'Select a valid IANA time zone.');
  }
}

function localTimeFromRow(value: unknown) {
  return String(value).slice(0, 5);
}

function localDateFromRow(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function nullableString(value: unknown) {
  if (value === null || value === undefined) return null;
  return String(value);
}

function asDate(value: unknown) {
  if (value instanceof Date) return value;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Database returned an invalid class-management date.');
  }
  return parsed;
}
