import { describe, expect, it } from 'vitest';
import type {
  StudentNotificationRecord,
  StudentNotificationScope,
} from '../../../../contracts/src/notifications/student/index.ts';
import {
  buildStudentNotification,
  studentNotificationDedupeKey,
} from '../../../../domain/src/notifications/student/lifecycle.ts';
import {
  createPostgresStudentNotificationRepository,
  type StudentNotificationSqlClient,
} from './repository.ts';

const scope: StudentNotificationScope = {
  product: 'one_time_mishnayos',
  studentId: 'student_one',
  householdId: 'household_one',
};

describe('PostgreSQL Student notification dedupe boundary', () => {
  it('passes only NUL-free exact tuple and serialization keys to PostgreSQL text parameters', async () => {
    const notification = buildStudentNotification({
      category: 'class_reminder',
      recipientStudentId: 'student_one',
      scope,
      sourceEntityId: 'occurrence_one',
      sourceVersion: 4,
      createdAt: '2026-08-01T11:30:00.000Z',
      studentLocalTime: '3:00 PM',
      occurrenceClosesAt: '2026-08-01T13:00:00.000Z',
    }).notification;
    const client = new CapturingClient(notification);
    const repository = createPostgresStudentNotificationRepository({
      connect: async () => client,
    });

    await expect(
      repository.deliver({
        notification,
        supersededEventTypes: ['class_reminder'],
      }),
    ).resolves.toMatchObject({ disposition: 'created', notification });

    const textValues = client.queries.flatMap((query) =>
      (query.values ?? []).filter((value): value is string => typeof value === 'string'),
    );
    expect(textValues.length).toBeGreaterThan(0);
    expect(textValues.every((value) => !value.includes('\u0000'))).toBe(true);
    expect(
      client.queries.find((query) => query.text.includes('pg_advisory_xact_lock'))?.values?.[0],
    ).toBe('v1:["student_one","class_occurrence","occurrence_one"]');
    expect(client.queries.find((query) => query.text.includes('INSERT INTO'))?.values?.[8]).toBe(
      'v1:["class_reminder","occurrence_one","student_one",4]',
    );
  });

  it('is stable for retries and injective across adversarial delimiter and field boundaries', () => {
    const tuples = [
      {
        eventType: 'a',
        sourceEntityId: 'b\u0000c',
        recipientStudentId: 'd',
        sourceVersion: 1,
      },
      {
        eventType: 'a\u0000b',
        sourceEntityId: 'c',
        recipientStudentId: 'd',
        sourceVersion: 1,
      },
      {
        eventType: 'a',
        sourceEntityId: 'b',
        recipientStudentId: 'c\u0000d',
        sourceVersion: 1,
      },
      {
        eventType: 'a',
        sourceEntityId: 'b',
        recipientStudentId: 'c',
        sourceVersion: 1,
      },
      {
        eventType: 'a',
        sourceEntityId: 'b',
        recipientStudentId: 'c',
        sourceVersion: 11,
      },
      {
        eventType: 'a","b',
        sourceEntityId: '["c"]',
        recipientStudentId: 'd:e',
        sourceVersion: 1,
      },
    ];
    const keys = tuples.map(studentNotificationDedupeKey);

    expect(studentNotificationDedupeKey({ ...tuples[0]! })).toBe(keys[0]);
    expect(keys.every((key) => !key.includes('\u0000'))).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

class CapturingClient implements StudentNotificationSqlClient {
  readonly queries: { text: string; values?: readonly unknown[] }[] = [];

  constructor(private readonly inserted: StudentNotificationRecord) {}

  async query<Row extends Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: Row[]; rowCount: number }> {
    this.queries.push(values === undefined ? { text } : { text, values });
    const rows = text.includes('INSERT INTO')
      ? ([notificationRow(this.inserted)] as unknown as Row[])
      : [];
    return { rows, rowCount: rows.length };
  }

  release() {}
}

function notificationRow(notification: StudentNotificationRecord) {
  return {
    notification_id: notification.id,
    recipient_student_id: notification.recipientStudentId,
    scope_json: notification.scope,
    category: notification.category,
    event_type: notification.eventType,
    source_family: notification.sourceFamily,
    source_entity_id: notification.sourceEntityId,
    source_version: notification.sourceVersion,
    current_for_source: notification.currentForSource,
    dedupe_key: notification.dedupeKey,
    title: notification.title,
    body: notification.body,
    action_json: notification.action,
    created_at: notification.createdAt,
    expires_at: notification.expiresAt,
    retain_until: notification.retainUntil,
    read_at: notification.readAt,
    expired_at: notification.expiredAt,
    archived_at: notification.archivedAt,
    superseded_at: notification.supersededAt,
  };
}
