export const STUDENT_NOTIFICATION_CONTRACT_VERSION = '1.0.0' as const;

export const STUDENT_NOTIFICATION_CATEGORIES = [
  'class_reminder',
  'class_changed',
  'class_canceled',
  'recording_available',
  'question_updated',
  'support_updated',
  'badge_awarded',
  'announcement',
] as const;

export type StudentNotificationCategory = (typeof STUDENT_NOTIFICATION_CATEGORIES)[number];

export interface StudentNotificationScope {
  product: 'one_time_mishnayos';
  studentId: string;
  householdId: string;
}

export type StudentNotificationActionKind =
  | 'open_class'
  | 'open_schedule'
  | 'watch_recording'
  | 'open_question'
  | 'open_support_request'
  | 'view_progress'
  | 'open_announcement';

export interface SafeStudentNotificationAction {
  kind: StudentNotificationActionKind;
  label: string;
  route: string;
}

export interface StudentNotificationRecord {
  id: string;
  recipientStudentId: string;
  scope: StudentNotificationScope;
  category: StudentNotificationCategory;
  eventType: StudentNotificationCategory;
  sourceEntityId: string;
  sourceVersion: number;
  dedupeKey: string;
  title: string;
  body: string;
  action: SafeStudentNotificationAction | null;
  createdAt: string;
  expiresAt: string | null;
  retainUntil: string | null;
  readAt: string | null;
  expiredAt: string | null;
  archivedAt: string | null;
  supersededAt: string | null;
}

interface StudentNotificationEventBase {
  recipientStudentId: string;
  scope: StudentNotificationScope;
  sourceEntityId: string;
  sourceVersion: number;
  createdAt: string;
}

export interface ClassReminderNotificationEvent extends StudentNotificationEventBase {
  category: 'class_reminder';
  rabbiDisplayName: string;
  studentLocalTime: string;
  occurrenceClosesAt: string;
}

export interface ClassChangedNotificationEvent extends StudentNotificationEventBase {
  category: 'class_changed';
  studentLocalTime: string;
  adminMessage: string;
  occurrenceClosesAt: string;
}

export interface ClassCanceledNotificationEvent extends StudentNotificationEventBase {
  category: 'class_canceled';
  studentLocalTime: string;
  adminMessage: string;
  occurrenceClosesAt: string;
}

export interface RecordingAvailableNotificationEvent extends StudentNotificationEventBase {
  category: 'recording_available';
  contentTitle: string;
  contentAvailableUntil: string | null;
}

export type StudentSafeQuestionStatus =
  'Submitted' | 'Under review' | 'Answered' | 'Resolved' | 'Closed';

export interface QuestionUpdatedNotificationEvent extends StudentNotificationEventBase {
  category: 'question_updated';
  studentSafeStatus: StudentSafeQuestionStatus;
  terminalResolvedAt: string | null;
}

export interface SupportUpdatedNotificationEvent extends StudentNotificationEventBase {
  category: 'support_updated';
  terminalResolvedAt: string | null;
}

export interface BadgeAwardedNotificationEvent extends StudentNotificationEventBase {
  category: 'badge_awarded';
  badgeName: string;
}

export interface AnnouncementNotificationEvent extends StudentNotificationEventBase {
  category: 'announcement';
  approvedTitle: string;
  approvedShortBody: string;
  approvedInternalRoute: string | null;
  configuredExpiresAt: string;
}

export type StudentNotificationEvent =
  | ClassReminderNotificationEvent
  | ClassChangedNotificationEvent
  | ClassCanceledNotificationEvent
  | RecordingAvailableNotificationEvent
  | QuestionUpdatedNotificationEvent
  | SupportUpdatedNotificationEvent
  | BadgeAwardedNotificationEvent
  | AnnouncementNotificationEvent;

export type StudentNotificationFilter = 'unread' | 'read' | 'all';
export type StudentNotificationLifecycle = 'unread' | 'read' | 'expired';

export interface StudentNotificationView {
  notification: StudentNotificationRecord;
  lifecycle: StudentNotificationLifecycle;
  actionEnabled: boolean;
  availabilityLabel: 'No longer available' | null;
}

export interface StudentNotificationCenterSnapshot {
  filter: StudentNotificationFilter;
  unreadCount: number;
  soundEnabled: boolean;
  notifications: StudentNotificationView[];
}

export interface StudentNotificationDeliveryResult {
  disposition: 'created' | 'replayed' | 'stale';
  notification: StudentNotificationRecord;
}

export interface StudentNotificationRepository {
  deliver(input: {
    notification: StudentNotificationRecord;
    supersededEventTypes: StudentNotificationCategory[];
  }): Promise<StudentNotificationDeliveryResult>;
  refreshLifecycle(recipientStudentId: string, now: string): Promise<void>;
  listVisible(recipientStudentId: string): Promise<StudentNotificationRecord[]>;
  findVisibleById(
    recipientStudentId: string,
    notificationId: string,
  ): Promise<StudentNotificationRecord | null>;
  markRead(
    recipientStudentId: string,
    notificationId: string,
    readAt: string,
  ): Promise<StudentNotificationRecord | null>;
  markAllRead(recipientStudentId: string, readAt: string): Promise<number>;
  getSoundPreference(recipientStudentId: string): Promise<boolean>;
  setSoundPreference(recipientStudentId: string, enabled: boolean): Promise<void>;
}

export interface StudentNotificationPrincipal {
  studentId: string;
}

export interface StudentNotificationActionDecision {
  status: 'allowed' | 'unavailable';
  route: string | null;
  message: 'No longer available' | null;
}
