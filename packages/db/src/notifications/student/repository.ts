import type {
  SafeStudentNotificationAction,
  StudentNotificationCategory,
  StudentNotificationDeliveryResult,
  StudentNotificationRecord,
  StudentNotificationRepository,
  StudentNotificationScope,
} from '../../../../contracts/src/notifications/student/index.ts';

export interface StudentNotificationSqlClient {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: Row[]; rowCount?: number | null }>;
  release(): void;
}

export interface StudentNotificationSqlPool {
  connect(): Promise<StudentNotificationSqlClient>;
}

interface NotificationRow extends Record<string, unknown> {
  notification_id: string;
  recipient_student_id: string;
  scope_json: StudentNotificationScope;
  category: StudentNotificationCategory;
  event_type: StudentNotificationCategory;
  source_entity_id: string;
  source_version: number | string;
  dedupe_key: string;
  title: string;
  body: string;
  action_json: SafeStudentNotificationAction | null;
  created_at: Date | string;
  expires_at: Date | string | null;
  retain_until: Date | string | null;
  read_at: Date | string | null;
  expired_at: Date | string | null;
  archived_at: Date | string | null;
  superseded_at: Date | string | null;
}

export function createPostgresStudentNotificationRepository(
  pool: StudentNotificationSqlPool,
): StudentNotificationRepository {
  return {
    async deliver(input) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const existing = await client.query<NotificationRow>(
          `${SELECT_COLUMNS}
             FROM onetime.student_notifications
            WHERE dedupe_key = $1
            FOR UPDATE`,
          [input.notification.dedupeKey],
        );
        if (existing.rows[0]) {
          await client.query('COMMIT');
          return {
            disposition: 'replayed',
            notification: mapNotification(existing.rows[0]),
          };
        }

        const latest = await client.query<NotificationRow>(
          `${SELECT_COLUMNS}
             FROM onetime.student_notifications
            WHERE recipient_student_id = $1
              AND source_entity_id = $2
              AND event_type = $3
            ORDER BY source_version DESC
            LIMIT 1
            FOR UPDATE`,
          [
            input.notification.recipientStudentId,
            input.notification.sourceEntityId,
            input.notification.eventType,
          ],
        );
        const latestRecord = latest.rows[0] ? mapNotification(latest.rows[0]) : null;
        if (latestRecord && latestRecord.sourceVersion >= input.notification.sourceVersion) {
          await client.query('COMMIT');
          return { disposition: 'stale', notification: latestRecord };
        }

        await client.query(
          `UPDATE onetime.student_notifications
              SET superseded_at = COALESCE(superseded_at, $1::timestamptz),
                  expired_at = COALESCE(expired_at, $1::timestamptz)
            WHERE recipient_student_id = $2
              AND source_entity_id = $3
              AND event_type = ANY($4::text[])
              AND source_version <= $5
              AND archived_at IS NULL`,
          [
            input.notification.createdAt,
            input.notification.recipientStudentId,
            input.notification.sourceEntityId,
            input.supersededEventTypes,
            input.notification.sourceVersion,
          ],
        );

        const inserted = await client.query<NotificationRow>(
          `INSERT INTO onetime.student_notifications (
             notification_id, recipient_student_id, scope_json, category, event_type,
             source_entity_id, source_version, dedupe_key, title, body, action_json,
             created_at, expires_at, retain_until, read_at, expired_at, archived_at,
             superseded_at
           ) VALUES (
             $1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11::jsonb,
             $12::timestamptz, $13::timestamptz, $14::timestamptz, NULL, NULL, NULL, NULL
           )
           ON CONFLICT (dedupe_key) DO NOTHING
           RETURNING *`,
          [
            input.notification.id,
            input.notification.recipientStudentId,
            JSON.stringify(input.notification.scope),
            input.notification.category,
            input.notification.eventType,
            input.notification.sourceEntityId,
            input.notification.sourceVersion,
            input.notification.dedupeKey,
            input.notification.title,
            input.notification.body,
            input.notification.action === null ? null : JSON.stringify(input.notification.action),
            input.notification.createdAt,
            input.notification.expiresAt,
            input.notification.retainUntil,
          ],
        );
        let disposition: StudentNotificationDeliveryResult['disposition'] = 'created';
        let row = inserted.rows[0];
        if (!row) {
          const raced = await client.query<NotificationRow>(
            `${SELECT_COLUMNS}
               FROM onetime.student_notifications
              WHERE dedupe_key = $1`,
            [input.notification.dedupeKey],
          );
          row = requiredRow(raced.rows[0]);
          disposition = 'replayed';
        }
        await client.query('COMMIT');
        return { disposition, notification: mapNotification(row) };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async refreshLifecycle(recipientStudentId, now) {
      const client = await pool.connect();
      try {
        await client.query(
          `UPDATE onetime.student_notifications
              SET expired_at = COALESCE(expired_at, $2::timestamptz)
            WHERE recipient_student_id = $1
              AND expires_at IS NOT NULL
              AND expires_at <= $2::timestamptz
              AND archived_at IS NULL`,
          [recipientStudentId, now],
        );
        await client.query(
          `UPDATE onetime.student_notifications
              SET archived_at = COALESCE(archived_at, $2::timestamptz)
            WHERE recipient_student_id = $1
              AND retain_until IS NOT NULL
              AND retain_until <= $2::timestamptz
              AND archived_at IS NULL`,
          [recipientStudentId, now],
        );
      } finally {
        client.release();
      }
    },

    async listVisible(recipientStudentId) {
      const client = await pool.connect();
      try {
        const result = await client.query<NotificationRow>(
          `${SELECT_COLUMNS}
             FROM onetime.student_notifications
            WHERE recipient_student_id = $1
              AND archived_at IS NULL
            ORDER BY created_at DESC, notification_id ASC`,
          [recipientStudentId],
        );
        return result.rows.map(mapNotification);
      } finally {
        client.release();
      }
    },

    async findVisibleById(recipientStudentId, notificationId) {
      const client = await pool.connect();
      try {
        const result = await client.query<NotificationRow>(
          `${SELECT_COLUMNS}
             FROM onetime.student_notifications
            WHERE recipient_student_id = $1
              AND notification_id = $2
              AND archived_at IS NULL
            LIMIT 1`,
          [recipientStudentId, notificationId],
        );
        return result.rows[0] ? mapNotification(result.rows[0]) : null;
      } finally {
        client.release();
      }
    },

    async markRead(recipientStudentId, notificationId, readAt) {
      const client = await pool.connect();
      try {
        const result = await client.query<NotificationRow>(
          `UPDATE onetime.student_notifications
              SET read_at = COALESCE(read_at, $3::timestamptz)
            WHERE recipient_student_id = $1
              AND notification_id = $2
              AND archived_at IS NULL
              AND expired_at IS NULL
              AND superseded_at IS NULL
              AND (expires_at IS NULL OR expires_at > $3::timestamptz)
          RETURNING *`,
          [recipientStudentId, notificationId, readAt],
        );
        return result.rows[0] ? mapNotification(result.rows[0]) : null;
      } finally {
        client.release();
      }
    },

    async markAllRead(recipientStudentId, readAt) {
      const client = await pool.connect();
      try {
        const result = await client.query(
          `UPDATE onetime.student_notifications
              SET read_at = $2::timestamptz
            WHERE recipient_student_id = $1
              AND read_at IS NULL
              AND archived_at IS NULL
              AND expired_at IS NULL
              AND superseded_at IS NULL
              AND (expires_at IS NULL OR expires_at > $2::timestamptz)`,
          [recipientStudentId, readAt],
        );
        return result.rowCount ?? 0;
      } finally {
        client.release();
      }
    },

    async getSoundPreference(recipientStudentId) {
      const client = await pool.connect();
      try {
        const result = await client.query<{ sound_enabled: boolean }>(
          `SELECT sound_enabled
             FROM onetime.student_notification_preferences
            WHERE recipient_student_id = $1`,
          [recipientStudentId],
        );
        return result.rows[0]?.sound_enabled === true;
      } finally {
        client.release();
      }
    },

    async setSoundPreference(recipientStudentId, enabled) {
      const client = await pool.connect();
      try {
        await client.query(
          `INSERT INTO onetime.student_notification_preferences (
             recipient_student_id, sound_enabled, updated_at
           ) VALUES ($1, $2, NOW())
           ON CONFLICT (recipient_student_id)
           DO UPDATE SET sound_enabled = EXCLUDED.sound_enabled, updated_at = NOW()`,
          [recipientStudentId, enabled],
        );
      } finally {
        client.release();
      }
    },
  };
}

const SELECT_COLUMNS = `SELECT
  notification_id, recipient_student_id, scope_json, category, event_type,
  source_entity_id, source_version, dedupe_key, title, body, action_json,
  created_at, expires_at, retain_until, read_at, expired_at, archived_at,
  superseded_at`;

function mapNotification(row: NotificationRow): StudentNotificationRecord {
  return {
    id: row.notification_id,
    recipientStudentId: row.recipient_student_id,
    scope: row.scope_json,
    category: row.category,
    eventType: row.event_type,
    sourceEntityId: row.source_entity_id,
    sourceVersion: Number(row.source_version),
    dedupeKey: row.dedupe_key,
    title: row.title,
    body: row.body,
    action: row.action_json,
    createdAt: iso(row.created_at),
    expiresAt: nullableIso(row.expires_at),
    retainUntil: nullableIso(row.retain_until),
    readAt: nullableIso(row.read_at),
    expiredAt: nullableIso(row.expired_at),
    archivedAt: nullableIso(row.archived_at),
    supersededAt: nullableIso(row.superseded_at),
  };
}

function iso(value: Date | string) {
  return new Date(value).toISOString();
}

function nullableIso(value: Date | string | null) {
  return value === null ? null : iso(value);
}

function requiredRow(row: NotificationRow | undefined) {
  if (!row) throw new Error('student_notification_delivery_conflict');
  return row;
}
