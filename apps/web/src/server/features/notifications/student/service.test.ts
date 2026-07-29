import { describe, expect, it } from 'vitest';
import type {
  ClassReminderNotificationEvent,
  StudentNotificationRecord,
  StudentNotificationRepository,
} from '../../../../../../../packages/contracts/src/notifications/student/index.ts';
import { supersedeStudentNotification } from '../../../../../../../packages/domain/src/notifications/student/index.ts';
import { createStudentNotificationService } from './service.ts';

const scope = {
  product: 'one_time_mishnayos',
  studentId: 'student_one',
  householdId: 'household_one',
} as const;
const principal = { studentId: 'student_one' };

function reminder(
  overrides: Partial<ClassReminderNotificationEvent> = {},
): ClassReminderNotificationEvent {
  return {
    category: 'class_reminder',
    recipientStudentId: 'student_one',
    scope,
    sourceEntityId: 'occurrence_one',
    sourceVersion: 1,
    createdAt: '2026-08-01T11:30:00.000Z',
    studentLocalTime: '3:00 PM',
    occurrenceClosesAt: '2026-08-01T13:00:00.000Z',
    ...overrides,
  };
}

describe('Student notification service', () => {
  it('deduplicates exact retries, creates a later version, and lets cancellation supersede reminder', async () => {
    const repository = memoryRepository();
    const service = createStudentNotificationService({
      repository,
      authorizeAction: async () => true,
    });
    const deliveryContext = {
      portalVisibility: 'foreground' as const,
      browserInteractionPermitsAudio: true,
      visualNoticeRendered: true,
    };
    const first = await service.deliver({ event: reminder(), deliveryContext });
    const retry = await service.deliver({ event: reminder(), deliveryContext });
    const later = await service.deliver({
      event: reminder({
        sourceVersion: 2,
        createdAt: '2026-08-01T11:35:00.000Z',
        studentLocalTime: '3:15 PM',
      }),
      deliveryContext,
    });
    const canceled = await service.deliver({
      event: {
        category: 'class_canceled',
        recipientStudentId: 'student_one',
        scope,
        sourceEntityId: 'occurrence_one',
        sourceVersion: 3,
        createdAt: '2026-08-01T11:40:00.000Z',
        studentLocalTime: '3:15 PM',
        adminMessage: 'A new date will be shared.',
        occurrenceClosesAt: '2026-08-01T13:15:00.000Z',
      },
      deliveryContext,
    });
    expect(first.disposition).toBe('created');
    expect(retry).toMatchObject({
      disposition: 'replayed',
      notification: { id: first.notification.id },
      playForegroundSound: false,
    });
    expect(later.disposition).toBe('created');
    expect(canceled.disposition).toBe('created');

    const all = await service.center({
      principal,
      filter: 'all',
      now: new Date('2026-08-01T12:00:00.000Z'),
    });
    expect(all.notifications).toHaveLength(3);
    expect(all.unreadCount).toBe(1);
    expect(all.notifications.filter((view) => view.lifecycle === 'expired')).toHaveLength(2);
    expect(
      all.notifications.find((view) => view.lifecycle === 'unread')?.notification.category,
    ).toBe('class_canceled');
  });

  it('marks one and all visible active notices read idempotently without touching expired state', async () => {
    const repository = memoryRepository();
    const service = createStudentNotificationService({
      repository,
      authorizeAction: async () => true,
    });
    const deliveryContext = {
      portalVisibility: 'foreground' as const,
      browserInteractionPermitsAudio: true,
      visualNoticeRendered: true,
    };
    const first = await service.deliver({ event: reminder(), deliveryContext });
    await service.deliver({
      event: {
        category: 'badge_awarded',
        recipientStudentId: 'student_one',
        scope,
        sourceEntityId: 'badge_one',
        sourceVersion: 1,
        createdAt: '2026-08-01T11:45:00.000Z',
        badgeName: 'Steady Learner',
      },
      deliveryContext,
    });
    await expect(
      service.markRead({
        principal,
        notificationId: first.notification.id,
        now: new Date('2026-08-01T12:00:00.000Z'),
      }),
    ).resolves.toEqual({ disposition: 'applied' });
    await expect(
      service.markAllRead({
        principal,
        now: new Date('2026-08-01T12:01:00.000Z'),
      }),
    ).resolves.toEqual({ changedCount: 1 });
    await expect(
      service.markAllRead({
        principal,
        now: new Date('2026-08-01T12:02:00.000Z'),
      }),
    ).resolves.toEqual({ changedCount: 0 });
    const snapshot = await service.center({
      principal,
      filter: 'all',
      now: new Date('2026-08-01T12:03:00.000Z'),
    });
    expect(snapshot.unreadCount).toBe(0);
    expect(snapshot.notifications.map((view) => view.lifecycle)).toEqual(['read', 'read']);
  });

  it('reauthorizes action opens and returns the same neutral unavailable state for revocation or expiry', async () => {
    const repository = memoryRepository();
    let authorized = true;
    const service = createStudentNotificationService({
      repository,
      authorizeAction: async () => authorized,
    });
    const delivered = await service.deliver({
      event: reminder(),
      deliveryContext: {
        portalVisibility: 'foreground',
        browserInteractionPermitsAudio: true,
        visualNoticeRendered: true,
      },
    });
    await expect(
      service.openAction({
        principal,
        notificationId: delivered.notification.id,
        now: new Date('2026-08-01T12:00:00.000Z'),
      }),
    ).resolves.toEqual({
      status: 'allowed',
      route: '/app/student/classes/occurrence_one',
      message: null,
    });
    authorized = false;
    await expect(
      service.openAction({
        principal,
        notificationId: delivered.notification.id,
        now: new Date('2026-08-01T12:01:00.000Z'),
      }),
    ).resolves.toEqual({
      status: 'unavailable',
      route: null,
      message: 'No longer available',
    });
    authorized = true;
    await expect(
      service.openAction({
        principal,
        notificationId: delivered.notification.id,
        now: new Date('2026-08-01T13:00:00.000Z'),
      }),
    ).resolves.toEqual({
      status: 'unavailable',
      route: null,
      message: 'No longer available',
    });
  });

  it('defaults sound off and permits it only after explicit preference for a new foreground visual notice', async () => {
    const repository = memoryRepository();
    const service = createStudentNotificationService({
      repository,
      authorizeAction: async () => true,
    });
    const event = reminder();
    const first = await service.deliver({
      event,
      deliveryContext: {
        portalVisibility: 'foreground',
        browserInteractionPermitsAudio: true,
        visualNoticeRendered: true,
      },
    });
    expect(first.playForegroundSound).toBe(false);
    await service.setSoundPreference({ principal, enabled: true });
    const second = await service.deliver({
      event: reminder({
        sourceEntityId: 'occurrence_two',
        sourceVersion: 1,
      }),
      deliveryContext: {
        portalVisibility: 'foreground',
        browserInteractionPermitsAudio: true,
        visualNoticeRendered: true,
      },
    });
    expect(second.playForegroundSound).toBe(true);
    const background = await service.deliver({
      event: reminder({
        sourceEntityId: 'occurrence_three',
        sourceVersion: 1,
      }),
      deliveryContext: {
        portalVisibility: 'background',
        browserInteractionPermitsAudio: true,
        visualNoticeRendered: true,
      },
    });
    expect(background.playForegroundSound).toBe(false);
  });

  it('keeps cancellation terminal against a stale reminder and serializes v1/v2 delivery to one current row', async () => {
    const repository = memoryRepository();
    const service = createStudentNotificationService({
      repository,
      authorizeAction: async () => true,
    });
    const deliveryContext = {
      portalVisibility: 'foreground' as const,
      browserInteractionPermitsAudio: true,
      visualNoticeRendered: true,
    };
    await service.deliver({
      event: {
        category: 'class_canceled',
        recipientStudentId: 'student_one',
        scope,
        sourceEntityId: 'occurrence_terminal',
        sourceVersion: 4,
        createdAt: '2026-08-01T10:00:00.000Z',
        studentLocalTime: '3:00 PM',
        adminMessage: '',
        occurrenceClosesAt: '2026-08-01T13:00:00.000Z',
      },
      deliveryContext,
    });
    const stale = await service.deliver({
      event: reminder({
        sourceEntityId: 'occurrence_terminal',
        sourceVersion: 3,
        createdAt: '2026-08-01T10:01:00.000Z',
      }),
      deliveryContext,
    });
    expect(stale.disposition).toBe('stale');

    await Promise.all([
      service.deliver({
        event: reminder({
          sourceEntityId: 'occurrence_race',
          sourceVersion: 1,
          createdAt: '2026-08-01T10:02:00.000Z',
        }),
        deliveryContext,
      }),
      service.deliver({
        event: reminder({
          sourceEntityId: 'occurrence_race',
          sourceVersion: 2,
          createdAt: '2026-08-01T10:03:00.000Z',
        }),
        deliveryContext,
      }),
    ]);
    const all = await service.center({
      principal,
      filter: 'all',
      now: new Date('2026-08-01T11:00:00.000Z'),
    });
    const terminalCurrent = all.notifications.filter(
      (view) =>
        view.notification.sourceEntityId === 'occurrence_terminal' && view.lifecycle !== 'expired',
    );
    const raceCurrent = all.notifications.filter(
      (view) =>
        view.notification.sourceEntityId === 'occurrence_race' && view.lifecycle !== 'expired',
    );
    expect(terminalCurrent).toHaveLength(1);
    expect(terminalCurrent[0]?.notification.category).toBe('class_canceled');
    expect(raceCurrent).toHaveLength(1);
    expect(raceCurrent[0]?.notification.sourceVersion).toBe(2);
  });

  it('replays mark-one without a second persistence write', async () => {
    const repository = memoryRepository();
    const service = createStudentNotificationService({
      repository,
      authorizeAction: async () => true,
    });
    const delivered = await service.deliver({
      event: reminder(),
      deliveryContext: {
        portalVisibility: 'foreground',
        browserInteractionPermitsAudio: true,
        visualNoticeRendered: true,
      },
    });
    await expect(
      service.markRead({
        principal,
        notificationId: delivered.notification.id,
        now: new Date('2026-08-01T12:00:00.000Z'),
      }),
    ).resolves.toEqual({ disposition: 'applied' });
    await expect(
      service.markRead({
        principal,
        notificationId: delivered.notification.id,
        now: new Date('2026-08-01T12:01:00.000Z'),
      }),
    ).resolves.toEqual({ disposition: 'replayed' });
    expect(repository.stats.markReadWrites).toBe(1);
  });
});

function memoryRepository(): StudentNotificationRepository & {
  stats: { markReadWrites: number };
} {
  const records = new Map<string, StudentNotificationRecord>();
  const preferences = new Map<string, boolean>();
  const stats = { markReadWrites: 0 };

  return {
    stats,
    async deliver(input) {
      const existing = [...records.values()].find(
        (record) => record.dedupeKey === input.notification.dedupeKey,
      );
      if (existing) return { disposition: 'replayed', notification: existing };
      const latest = [...records.values()]
        .filter(
          (record) =>
            record.recipientStudentId === input.notification.recipientStudentId &&
            record.sourceEntityId === input.notification.sourceEntityId &&
            record.sourceFamily === input.notification.sourceFamily &&
            record.currentForSource,
        )
        .sort((left, right) => right.sourceVersion - left.sourceVersion)[0];
      if (latest && incomingIsStale(latest, input.notification)) {
        return { disposition: 'stale', notification: latest };
      }
      for (const record of records.values()) {
        if (
          record.recipientStudentId === input.notification.recipientStudentId &&
          record.sourceEntityId === input.notification.sourceEntityId &&
          record.sourceFamily === input.notification.sourceFamily &&
          record.sourceVersion <= input.notification.sourceVersion &&
          record.currentForSource
        ) {
          records.set(
            record.id,
            supersedeStudentNotification(record, input.notification.createdAt),
          );
        }
      }
      records.set(input.notification.id, input.notification);
      return { disposition: 'created', notification: input.notification };
    },

    async refreshLifecycle(recipientStudentId, now) {
      const nowMs = Date.parse(now);
      for (const record of records.values()) {
        if (record.recipientStudentId !== recipientStudentId) continue;
        let next = record;
        if (
          record.expiresAt !== null &&
          Date.parse(record.expiresAt) <= nowMs &&
          record.expiredAt === null
        ) {
          next = { ...next, expiredAt: now };
        }
        if (
          record.retainUntil !== null &&
          Date.parse(record.retainUntil) <= nowMs &&
          record.archivedAt === null
        ) {
          next = { ...next, archivedAt: now };
        }
        records.set(record.id, next);
      }
    },

    async listVisible(recipientStudentId) {
      return [...records.values()]
        .filter(
          (record) =>
            record.recipientStudentId === recipientStudentId && record.archivedAt === null,
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },

    async findVisibleById(recipientStudentId, notificationId) {
      const record = records.get(notificationId);
      return record?.recipientStudentId === recipientStudentId && record.archivedAt === null
        ? record
        : null;
    },

    async markRead(recipientStudentId, notificationId, readAt) {
      const record = records.get(notificationId);
      if (
        !record ||
        record.recipientStudentId !== recipientStudentId ||
        record.archivedAt !== null ||
        record.expiredAt !== null ||
        record.supersededAt !== null ||
        (record.expiresAt !== null && Date.parse(record.expiresAt) <= Date.parse(readAt))
      ) {
        return null;
      }
      if (record.readAt !== null) {
        return { disposition: 'replayed', notification: record };
      }
      const next = { ...record, readAt: record.readAt ?? readAt };
      records.set(record.id, next);
      stats.markReadWrites += 1;
      return { disposition: 'applied', notification: next };
    },

    async markAllRead(recipientStudentId, readAt) {
      let changed = 0;
      for (const record of records.values()) {
        if (
          record.recipientStudentId === recipientStudentId &&
          record.readAt === null &&
          record.archivedAt === null &&
          record.expiredAt === null &&
          record.supersededAt === null &&
          (record.expiresAt === null || Date.parse(record.expiresAt) > Date.parse(readAt))
        ) {
          records.set(record.id, { ...record, readAt });
          changed += 1;
        }
      }
      return changed;
    },

    async getSoundPreference(recipientStudentId) {
      return preferences.get(recipientStudentId) ?? false;
    },

    async setSoundPreference(recipientStudentId, enabled) {
      preferences.set(recipientStudentId, enabled);
    },
  };
}

function incomingIsStale(current: StudentNotificationRecord, incoming: StudentNotificationRecord) {
  if (
    current.category === 'class_canceled' &&
    (incoming.category === 'class_reminder' || incoming.category === 'class_changed')
  ) {
    return true;
  }
  if (current.sourceVersion > incoming.sourceVersion) return true;
  if (current.sourceVersion < incoming.sourceVersion) return false;
  return categoryPrecedence(current.category) >= categoryPrecedence(incoming.category);
}

function categoryPrecedence(category: StudentNotificationRecord['category']) {
  if (category === 'class_canceled') return 3;
  if (category === 'class_changed') return 2;
  return 1;
}
