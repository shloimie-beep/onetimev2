import { describe, expect, it } from 'vitest';
import type {
  AnnouncementNotificationEvent,
  ClassReminderNotificationEvent,
  StudentNotificationEvent,
} from '../../../../contracts/src/notifications/student/index.ts';
import { StudentNotificationError } from './errors.ts';
import {
  buildStudentNotification,
  canOpenStudentNotificationAction,
  isApprovedStudentNotificationRoute,
  projectStudentNotification,
  shouldPlayForegroundNotificationSound,
  supersedeStudentNotification,
} from './lifecycle.ts';

const scope = {
  product: 'one_time_mishnayos',
  studentId: 'student_one',
  householdId: 'household_one',
} as const;

function reminder(
  overrides: Partial<ClassReminderNotificationEvent> = {},
): ClassReminderNotificationEvent {
  return {
    category: 'class_reminder',
    recipientStudentId: 'student_one',
    scope,
    sourceEntityId: 'occurrence_one',
    sourceVersion: 4,
    createdAt: '2026-08-01T11:30:00.000Z',
    studentLocalTime: '3:00 PM',
    occurrenceClosesAt: '2026-08-01T13:00:00.000Z',
    ...overrides,
  };
}

describe('P23 Student notification lifecycle', () => {
  it('renders the exact category catalog with safe internal actions and lifetimes', () => {
    const fixtures: StudentNotificationEvent[] = [
      reminder(),
      {
        category: 'class_changed',
        recipientStudentId: 'student_one',
        scope,
        sourceEntityId: 'occurrence_one',
        sourceVersion: 5,
        createdAt: '2026-08-01T11:35:00.000Z',
        studentLocalTime: '3:30 PM',
        adminMessage: 'Please use the updated schedule.',
        occurrenceClosesAt: '2026-08-01T13:30:00.000Z',
      },
      {
        category: 'class_canceled',
        recipientStudentId: 'student_one',
        scope,
        sourceEntityId: 'occurrence_one',
        sourceVersion: 6,
        createdAt: '2026-08-01T11:40:00.000Z',
        studentLocalTime: '3:30 PM',
        adminMessage: 'A new date will be shared.',
        occurrenceClosesAt: '2026-08-01T13:30:00.000Z',
      },
      {
        category: 'recording_available',
        recipientStudentId: 'student_one',
        scope,
        sourceEntityId: 'content_one',
        sourceVersion: 1,
        createdAt: '2026-08-01T14:00:00.000Z',
        contentTitle: 'Mishnah Review',
        contentAvailableUntil: null,
      },
      {
        category: 'question_updated',
        recipientStudentId: 'student_one',
        scope,
        sourceEntityId: 'question_one',
        sourceVersion: 2,
        createdAt: '2026-08-01T14:00:00.000Z',
        studentSafeStatus: 'Answered',
        terminalResolvedAt: '2026-08-01T14:00:00.000Z',
      },
      {
        category: 'support_updated',
        recipientStudentId: 'student_one',
        scope,
        sourceEntityId: 'support_one',
        sourceVersion: 2,
        createdAt: '2026-08-01T14:00:00.000Z',
        terminalResolvedAt: null,
      },
      {
        category: 'badge_awarded',
        recipientStudentId: 'student_one',
        scope,
        sourceEntityId: 'badge_one',
        sourceVersion: 1,
        createdAt: '2026-08-01T14:00:00.000Z',
        badgeName: 'Steady Learner',
      },
      {
        category: 'announcement',
        recipientStudentId: 'student_one',
        scope,
        sourceEntityId: 'announcement_one',
        sourceVersion: 1,
        createdAt: '2026-08-01T14:00:00.000Z',
        approvedTitle: 'Schedule note',
        approvedShortBody: 'Review the updated week.',
        approvedInternalRoute: '/app/student/calendar',
        configuredExpiresAt: '2026-08-08T14:00:00.000Z',
      },
    ];

    const rendered = fixtures.map((event) => buildStudentNotification(event).notification);
    expect(rendered.map((notification) => notification.title)).toEqual([
      'Class begins in 30 minutes',
      'Class schedule updated',
      'Class canceled',
      'New recording available',
      'Your question was updated',
      'Support request updated',
      'You earned Steady Learner',
      'Schedule note',
    ]);
    expect(rendered[0]).toMatchObject({
      body: 'Rabbi Eli\u2019s class begins at 3:00 PM.',
      action: {
        label: 'Open class',
        route: '/app/student/classes/occurrence_one',
      },
    });
    expect(rendered[4]?.body).toBe('Status: Answered.');
    expect(rendered[1]?.action).toMatchObject({
      label: 'Open calendar',
      route: '/app/student/calendar',
    });
    expect(rendered[2]?.action).toMatchObject({
      label: 'Open calendar',
      route: '/app/student/calendar',
    });
    expect(rendered.every((notification) => !notification.action?.route.includes('://'))).toBe(
      true,
    );
  });

  it('admits only exact canonical static and parameterized Student routes', () => {
    const allowed = [
      '/app/student',
      '/app/student/calendar',
      '/app/student/library',
      '/app/student/progress',
      '/app/student/questions',
      '/app/student/questions/new',
      '/app/student/updates',
      '/app/student/notifications',
      '/app/student/support',
      '/app/student/account',
      '/app/student/privacy',
      '/app/student/data-rights',
      '/app/student/classes/occurrence_one',
      '/app/student/class/occurrence_one',
      '/app/student/library/content_one',
      '/app/student/questions/question_one',
      '/app/student/support/ticket_one',
    ];
    const rejected = [
      '/app/student/schedule',
      '/app/student/anything',
      '/app/student/library/content_one/extra',
      '/app/student/classes',
      '/app/student/support/',
      '/app/student/calendar?month=8',
      '/app/student/notifications#new',
      '/app/student/questions/../support',
      '/app/student//calendar',
      'https://outside.invalid/app/student/calendar',
    ];

    expect(allowed.every(isApprovedStudentNotificationRoute)).toBe(true);
    expect(rejected.every((route) => !isApprovedStudentNotificationRoute(route))).toBe(true);
  });

  it('uses the exact source-version dedupe tuple and stable notification identity', () => {
    const first = buildStudentNotification(reminder()).notification;
    const retry = buildStudentNotification(reminder()).notification;
    const next = buildStudentNotification(reminder({ sourceVersion: 5 })).notification;
    expect(retry).toMatchObject({ id: first.id, dedupeKey: first.dedupeKey });
    expect(next.id).not.toBe(first.id);
    expect(first.dedupeKey.split('\u0000')).toEqual([
      'class_reminder',
      'occurrence_one',
      'student_one',
      '4',
    ]);
  });

  it('keeps expired notices under All for 30 days and denies stale actions', () => {
    const notification = buildStudentNotification(reminder()).notification;
    expect(
      projectStudentNotification({
        notification,
        now: new Date('2026-08-01T12:59:59.000Z'),
        actionAuthorized: true,
      }),
    ).toMatchObject({ lifecycle: 'unread', actionEnabled: true });
    expect(
      projectStudentNotification({
        notification,
        now: new Date('2026-08-01T13:00:00.000Z'),
        actionAuthorized: true,
      }),
    ).toMatchObject({
      lifecycle: 'expired',
      actionEnabled: false,
      availabilityLabel: 'No longer available',
    });
    expect(
      projectStudentNotification({
        notification,
        now: new Date('2026-08-31T13:00:00.000Z'),
        actionAuthorized: true,
      }),
    ).toBeNull();
  });

  it('reauthorizes every action and fails closed for wrong Student, revocation, or supersession', () => {
    const notification = buildStudentNotification(reminder()).notification;
    expect(
      canOpenStudentNotificationAction({
        notification,
        principalStudentId: 'student_one',
        now: new Date('2026-08-01T12:00:00.000Z'),
        actionAuthorized: true,
      }),
    ).toBe(true);
    expect(
      canOpenStudentNotificationAction({
        notification,
        principalStudentId: 'student_two',
        now: new Date('2026-08-01T12:00:00.000Z'),
        actionAuthorized: true,
      }),
    ).toBe(false);
    expect(
      canOpenStudentNotificationAction({
        notification,
        principalStudentId: 'student_one',
        now: new Date('2026-08-01T12:00:00.000Z'),
        actionAuthorized: false,
      }),
    ).toBe(false);
    expect(
      canOpenStudentNotificationAction({
        notification: {
          ...notification,
          supersededAt: '2026-08-01T11:45:00.000Z',
        },
        principalStudentId: 'student_one',
        now: new Date('2026-08-01T12:00:00.000Z'),
        actionAuthorized: true,
      }),
    ).toBe(false);
  });

  it('rejects provider/private runtime copy, unsafe routes, cross-scope recipients, and excessive lifetime', () => {
    expect(() =>
      buildStudentNotification({
        category: 'recording_available',
        recipientStudentId: 'student_one',
        scope,
        sourceEntityId: 'content_private',
        sourceVersion: 1,
        createdAt: '2026-08-01T00:00:00.000Z',
        contentTitle: 'https://provider.invalid/private',
        contentAvailableUntil: null,
      }),
    ).toThrowError(expect.objectContaining({ code: 'invalid_copy' }));
    expect(() =>
      buildStudentNotification({
        category: 'announcement',
        recipientStudentId: 'student_one',
        scope,
        sourceEntityId: 'announcement_one',
        sourceVersion: 1,
        createdAt: '2026-08-01T00:00:00.000Z',
        approvedTitle: 'News',
        approvedShortBody: 'Read this update.',
        approvedInternalRoute: 'https://outside.invalid',
        configuredExpiresAt: '2026-08-02T00:00:00.000Z',
      }),
    ).toThrowError(StudentNotificationError);
    expect(() =>
      buildStudentNotification(
        reminder({
          scope: { ...scope, studentId: 'student_two' },
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'invalid_scope' }));
    const tooLong: AnnouncementNotificationEvent = {
      category: 'announcement',
      recipientStudentId: 'student_one',
      scope,
      sourceEntityId: 'announcement_two',
      sourceVersion: 1,
      createdAt: '2026-08-01T00:00:00.000Z',
      approvedTitle: 'News',
      approvedShortBody: 'Read this update.',
      approvedInternalRoute: null,
      configuredExpiresAt: '2026-11-01T00:00:00.000Z',
    };
    expect(() => buildStudentNotification(tooLong)).toThrowError(
      expect.objectContaining({ code: 'invalid_lifetime' }),
    );
    expect(() =>
      buildStudentNotification({
        category: 'question_updated',
        recipientStudentId: 'student_one',
        scope,
        sourceEntityId: 'question_private',
        sourceVersion: 2,
        createdAt: '2026-08-01T00:00:00.000Z',
        studentSafeStatus: 'Private answer body' as 'Answered',
        terminalResolvedAt: null,
      }),
    ).toThrowError(expect.objectContaining({ code: 'invalid_copy' }));
  });

  it('assigns 30-day retention when an indefinite active notice is superseded', () => {
    const indefinite = buildStudentNotification({
      category: 'recording_available',
      recipientStudentId: 'student_one',
      scope,
      sourceEntityId: 'content_one',
      sourceVersion: 1,
      createdAt: '2026-08-01T00:00:00.000Z',
      contentTitle: 'Mishnah Review',
      contentAvailableUntil: null,
    }).notification;
    const superseded = supersedeStudentNotification(indefinite, '2026-08-02T00:00:00.000Z');
    expect(superseded).toMatchObject({
      currentForSource: false,
      expiresAt: '2026-08-02T00:00:00.000Z',
      expiredAt: '2026-08-02T00:00:00.000Z',
      retainUntil: '2026-09-01T00:00:00.000Z',
    });
    expect(
      projectStudentNotification({
        notification: superseded,
        now: new Date('2026-09-01T00:00:00.000Z'),
        actionAuthorized: true,
      }),
    ).toBeNull();
  });

  it('permits sound only for a new visual foreground notice after interaction and opt-in', () => {
    const eligible = {
      preferenceEnabled: true,
      disposition: 'created' as const,
      notificationUnread: true,
      portalVisibility: 'foreground' as const,
      browserInteractionPermitsAudio: true,
      visualNoticeRendered: true,
    };
    expect(shouldPlayForegroundNotificationSound(eligible)).toBe(true);
    expect(shouldPlayForegroundNotificationSound({ ...eligible, preferenceEnabled: false })).toBe(
      false,
    );
    expect(
      shouldPlayForegroundNotificationSound({ ...eligible, portalVisibility: 'background' }),
    ).toBe(false);
    expect(
      shouldPlayForegroundNotificationSound({
        ...eligible,
        browserInteractionPermitsAudio: false,
      }),
    ).toBe(false);
    expect(
      shouldPlayForegroundNotificationSound({ ...eligible, visualNoticeRendered: false }),
    ).toBe(false);
    expect(shouldPlayForegroundNotificationSound({ ...eligible, disposition: 'replayed' })).toBe(
      false,
    );
  });
});
