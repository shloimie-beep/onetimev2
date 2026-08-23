import type {
  SafeStudentNotificationAction,
  StudentNotificationCategory,
  StudentNotificationEvent,
  StudentNotificationRecord,
  StudentNotificationSourceFamily,
  StudentNotificationView,
} from '../../../../contracts/src/notifications/student/index.ts';
import { STUDENT_SAFE_QUESTION_STATUSES } from '../../../../contracts/src/notifications/student/index.ts';
import { sha256Hex } from '../../jobs/idempotency.ts';
import { StudentNotificationError } from './errors.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRED_VISIBILITY_MS = 30 * DAY_MS;
const NINETY_DAYS_MS = 90 * DAY_MS;
const STUDENT_NOTIFICATION_STATIC_ROUTES = new Set([
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
]);
const STUDENT_NOTIFICATION_PARAMETERIZED_ROUTE_PATTERNS = [
  /^\/app\/student\/classes\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/,
  /^\/app\/student\/class\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/,
  /^\/app\/student\/library\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/,
  /^\/app\/student\/questions\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/,
  /^\/app\/student\/support\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/,
];

export function buildStudentNotification(event: StudentNotificationEvent): {
  notification: StudentNotificationRecord;
  supersededEventTypes: StudentNotificationCategory[];
} {
  assertCommonEvent(event);
  const rendered = renderEvent(event);
  const createdAtMs = parseTime(event.createdAt, 'createdAt');
  const expiresAtMs = activeLifetimeEnd(event, createdAtMs);
  if (expiresAtMs !== null && expiresAtMs < createdAtMs) {
    throw new StudentNotificationError(
      'invalid_lifetime',
      'A notification cannot expire before it is created.',
    );
  }
  const dedupeKey = studentNotificationDedupeKey({
    eventType: event.category,
    sourceEntityId: event.sourceEntityId,
    recipientStudentId: event.recipientStudentId,
    sourceVersion: event.sourceVersion,
  });
  return {
    notification: {
      id: `student_notice_${sha256Hex(dedupeKey).slice(0, 32)}`,
      recipientStudentId: event.recipientStudentId,
      scope: { ...event.scope },
      category: event.category,
      eventType: event.category,
      sourceFamily: sourceFamilyForCategory(event.category),
      sourceEntityId: event.sourceEntityId,
      sourceVersion: event.sourceVersion,
      currentForSource: true,
      dedupeKey,
      title: rendered.title,
      body: rendered.body,
      action: rendered.action,
      createdAt: new Date(createdAtMs).toISOString(),
      expiresAt: expiresAtMs === null ? null : new Date(expiresAtMs).toISOString(),
      retainUntil:
        expiresAtMs === null ? null : new Date(expiresAtMs + EXPIRED_VISIBILITY_MS).toISOString(),
      readAt: null,
      expiredAt: null,
      archivedAt: null,
      supersededAt: null,
    },
    supersededEventTypes: supersededEventTypes(event.category),
  };
}

export function studentNotificationDedupeKey(input: {
  eventType: string;
  sourceEntityId: string;
  recipientStudentId: string;
  sourceVersion: number;
}) {
  return `v1:${JSON.stringify([
    input.eventType,
    input.sourceEntityId,
    input.recipientStudentId,
    input.sourceVersion,
  ])}`;
}

export function projectStudentNotification(input: {
  notification: StudentNotificationRecord;
  now: Date;
  actionAuthorized: boolean;
}): StudentNotificationView | null {
  const nowMs = validDate(input.now, 'now');
  const notification = input.notification;
  if (
    notification.archivedAt !== null ||
    (notification.retainUntil !== null &&
      nowMs >= parseTime(notification.retainUntil, 'retainUntil'))
  ) {
    return null;
  }
  const expired =
    notification.expiredAt !== null ||
    notification.supersededAt !== null ||
    (notification.expiresAt !== null && nowMs >= parseTime(notification.expiresAt, 'expiresAt'));
  if (expired) {
    return {
      notification,
      lifecycle: 'expired',
      actionEnabled: false,
      availabilityLabel: 'No longer available',
    };
  }
  return {
    notification,
    lifecycle: notification.readAt === null ? 'unread' : 'read',
    actionEnabled: input.actionAuthorized && notification.action !== null,
    availabilityLabel:
      input.actionAuthorized || notification.action === null ? null : 'No longer available',
  };
}

export function canOpenStudentNotificationAction(input: {
  notification: StudentNotificationRecord;
  principalStudentId: string;
  now: Date;
  actionAuthorized: boolean;
}) {
  if (input.notification.recipientStudentId !== input.principalStudentId) return false;
  const view = projectStudentNotification({
    notification: input.notification,
    now: input.now,
    actionAuthorized: input.actionAuthorized,
  });
  return view?.actionEnabled === true;
}

export function supersededEventTypes(
  category: StudentNotificationCategory,
): StudentNotificationCategory[] {
  if (category === 'class_canceled') {
    return ['class_reminder', 'class_changed', 'class_canceled'];
  }
  return [category];
}

export function sourceFamilyForCategory(
  category: StudentNotificationCategory,
): StudentNotificationSourceFamily {
  if (
    category === 'class_reminder' ||
    category === 'class_changed' ||
    category === 'class_canceled'
  ) {
    return 'class_occurrence';
  }
  return category;
}

export function supersedeStudentNotification(
  notification: StudentNotificationRecord,
  supersededAt: string,
): StudentNotificationRecord {
  const supersededAtMs = parseTime(supersededAt, 'supersededAt');
  const normalizedSupersededAt = new Date(supersededAtMs).toISOString();
  return {
    ...notification,
    currentForSource: false,
    supersededAt: notification.supersededAt ?? normalizedSupersededAt,
    expiredAt: notification.expiredAt ?? normalizedSupersededAt,
    expiresAt: notification.expiresAt ?? normalizedSupersededAt,
    retainUntil:
      notification.retainUntil ?? new Date(supersededAtMs + EXPIRED_VISIBILITY_MS).toISOString(),
  };
}

function renderEvent(event: StudentNotificationEvent): {
  title: string;
  body: string;
  action: SafeStudentNotificationAction | null;
} {
  switch (event.category) {
    case 'class_reminder':
      return {
        title: 'Class begins in 30 minutes',
        body: `Rabbi Eli\u2019s class begins at ${approvedText(event.studentLocalTime, 'studentLocalTime')}.`,
        action: action(
          'open_class',
          'Open class',
          `/app/student/classes/${safeSegment(event.sourceEntityId)}`,
        ),
      };
    case 'class_changed':
      return {
        title: 'Class schedule updated',
        body: appendApprovedMessage(
          `Your class is now ${approvedText(event.studentLocalTime, 'studentLocalTime')}.`,
          event.adminMessage,
        ),
        action: action('open_schedule', 'Open schedule', '/app/student/calendar'),
      };
    case 'class_canceled':
      return {
        title: 'Class canceled',
        body: appendApprovedMessage(
          `The class scheduled for ${approvedText(event.studentLocalTime, 'studentLocalTime')} was canceled.`,
          event.adminMessage,
        ),
        action: action('open_schedule', 'Open schedule', '/app/student/calendar'),
      };
    case 'recording_available':
      return {
        title: 'New recording available',
        body: `${approvedText(event.contentTitle, 'contentTitle')} is ready in your library.`,
        action: action(
          'watch_recording',
          'Watch recording',
          `/app/student/library/${safeSegment(event.sourceEntityId)}`,
        ),
      };
    case 'question_updated':
      if (
        !STUDENT_SAFE_QUESTION_STATUSES.includes(
          event.studentSafeStatus as (typeof STUDENT_SAFE_QUESTION_STATUSES)[number],
        )
      ) {
        throw new StudentNotificationError(
          'invalid_copy',
          'studentSafeStatus must be a canonical Student-visible lifecycle label.',
        );
      }
      return {
        title: 'Your question was updated',
        body: `Status: ${event.studentSafeStatus}.`,
        action: action(
          'open_question',
          'Open question',
          `/app/student/questions/${safeSegment(event.sourceEntityId)}`,
        ),
      };
    case 'support_updated':
      return {
        title: 'Support request updated',
        body: 'Your request has a new status or reply.',
        action: action(
          'open_support_request',
          'Open support request',
          `/app/student/support/${safeSegment(event.sourceEntityId)}`,
        ),
      };
    case 'badge_awarded':
      return {
        title: `You earned ${approvedText(event.badgeName, 'badgeName')}`,
        body: 'Open Progress to see what you achieved.',
        action: action('view_progress', 'View progress', '/app/student/progress'),
      };
    case 'announcement':
      return {
        title: approvedText(event.approvedTitle, 'approvedTitle'),
        body: approvedText(event.approvedShortBody, 'approvedShortBody'),
        action:
          event.approvedInternalRoute === null
            ? null
            : action(
                'open_announcement',
                'Open',
                approvedInternalRoute(event.approvedInternalRoute),
              ),
      };
  }
}

function activeLifetimeEnd(event: StudentNotificationEvent, createdAtMs: number) {
  switch (event.category) {
    case 'class_reminder':
    case 'class_changed':
    case 'class_canceled':
      return parseTime(event.occurrenceClosesAt, 'occurrenceClosesAt');
    case 'recording_available':
      return nullableTime(event.contentAvailableUntil, 'contentAvailableUntil');
    case 'question_updated':
    case 'support_updated': {
      const terminal = nullableTime(event.terminalResolvedAt, 'terminalResolvedAt');
      return terminal === null ? null : terminal + NINETY_DAYS_MS;
    }
    case 'badge_awarded':
      return createdAtMs + 30 * DAY_MS;
    case 'announcement': {
      const configured = parseTime(event.configuredExpiresAt, 'configuredExpiresAt');
      if (configured > createdAtMs + NINETY_DAYS_MS) {
        throw new StudentNotificationError(
          'invalid_lifetime',
          'Announcement lifetime cannot exceed 90 days.',
        );
      }
      return configured;
    }
  }
}

function assertCommonEvent(event: StudentNotificationEvent) {
  if (
    event.recipientStudentId.trim() === '' ||
    event.sourceEntityId.trim() === '' ||
    event.scope.studentId.trim() === '' ||
    event.scope.householdId.trim() === ''
  ) {
    throw new StudentNotificationError(
      'invalid_identity',
      'Notification identities must be opaque and nonempty.',
    );
  }
  if (
    event.scope.product !== 'one_time_mishnayos' ||
    event.scope.studentId !== event.recipientStudentId
  ) {
    throw new StudentNotificationError(
      'invalid_scope',
      'Notification recipient and authenticated Student scope must match.',
    );
  }
  if (!Number.isSafeInteger(event.sourceVersion) || event.sourceVersion < 1) {
    throw new StudentNotificationError(
      'invalid_source_version',
      'Source version must be a positive safe integer.',
    );
  }
  parseTime(event.createdAt, 'createdAt');
}

function action(
  kind: SafeStudentNotificationAction['kind'],
  label: string,
  route: string,
): SafeStudentNotificationAction {
  return { kind, label, route: approvedInternalRoute(route) };
}

function approvedInternalRoute(route: string) {
  if (!isApprovedStudentNotificationRoute(route)) {
    throw new StudentNotificationError(
      'invalid_internal_route',
      'Notification actions must use an approved internal Student route.',
    );
  }
  return route;
}

export function isApprovedStudentNotificationRoute(route: string) {
  return (
    STUDENT_NOTIFICATION_STATIC_ROUTES.has(route) ||
    STUDENT_NOTIFICATION_PARAMETERIZED_ROUTE_PATTERNS.some((pattern) => pattern.test(route))
  );
}

function safeSegment(value: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value)) {
    throw new StudentNotificationError(
      'invalid_internal_route',
      'Notification action identifiers must be opaque safe route segments.',
    );
  }
  return value;
}

function appendApprovedMessage(prefix: string, message: string) {
  const trimmed = message.trim();
  return trimmed === '' ? prefix : `${prefix} ${approvedText(trimmed, 'adminMessage')}`;
}

function approvedText(value: string, field: string) {
  const normalized = value.trim();
  if (
    normalized === '' ||
    normalized.length > 240 ||
    [...normalized].some((character) => character.charCodeAt(0) < 32) ||
    /[<>]/.test(normalized) ||
    /(?:https?:\/\/|www\.|zoom\.us|vimeo\.com)/i.test(normalized)
  ) {
    throw new StudentNotificationError(
      'invalid_copy',
      `${field} must be approved short text without markup or provider URLs.`,
    );
  }
  return normalized;
}

function nullableTime(value: string | null, field: string) {
  return value === null ? null : parseTime(value, field);
}

function parseTime(value: string, field: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new StudentNotificationError('invalid_time', `${field} must be a valid instant.`);
  }
  return timestamp;
}

function validDate(value: Date, field: string) {
  const timestamp = value.getTime();
  if (!Number.isFinite(timestamp)) {
    throw new StudentNotificationError('invalid_time', `${field} must be a valid instant.`);
  }
  return timestamp;
}
