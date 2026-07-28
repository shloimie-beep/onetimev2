export const CALENDAR_CONTRACT_VERSION = '2.1.0' as const;
export const CANONICAL_CLASS_TIME_ZONE = 'Asia/Jerusalem' as const;
export const CALENDAR_ROLLING_HORIZON_DAYS = 90 as const;

export type CalendarRole = 'admin' | 'parent' | 'student';
export type CalendarView = 'month' | 'week' | 'day' | 'agenda' | 'list' | 'today';
export type CalendarOccurrenceStatus = 'scheduled' | 'rescheduled' | 'cancelled' | 'completed';
export type CalendarAccessState = 'active' | 'free' | 'grace' | 'inactive';
export type CalendarEditScope = 'single' | 'this_and_future';

export type CalendarSeries = {
  id: string;
  title: string;
  timeZone: string;
  localStartTime: string;
  durationMinutes: number;
  weekdays: readonly number[];
  startsOn: string;
  endsOn?: string;
  active: boolean;
  version: number;
};

export type CalendarOccurrence = {
  id: string;
  seriesId: string;
  localClassDate: string;
  startsAt: string;
  endsAt: string;
  status: CalendarOccurrenceStatus;
  title: string;
  householdIds: readonly string[];
  studentIds: readonly string[];
  attendanceSummary?: string;
  recordingAvailable?: boolean;
};

export type CalendarOccurrenceException = {
  localClassDate: string;
  kind: 'skip' | 'reschedule';
  localStartTime?: string;
  durationMinutes?: number;
};

export type CalendarActorScope = {
  role: CalendarRole;
  userId: string;
  accountKey: string;
  productKey: string;
  householdIds: readonly string[];
  studentIds: readonly string[];
  accessState: CalendarAccessState;
  preferredTimeZone: string;
};

export type CalendarQuery = {
  view: CalendarView;
  rangeStart: string;
  rangeEnd: string;
  displayTimeZone?: string;
  householdId?: string;
  studentId?: string;
  statuses?: readonly CalendarOccurrenceStatus[];
  seriesIds?: readonly string[];
};

export type CalendarJoinState =
  | { state: 'unavailable'; reason: 'too_early' | 'ended' | 'cancelled' | 'not_student' }
  | { state: 'available'; action: 'open_live_class' };

export type CalendarDisplayEvent = {
  id: string;
  title: string;
  localClassDate: string;
  displayLocalDate: string;
  startsAt: string;
  endsAt: string;
  status: CalendarOccurrenceStatus;
  dateLabel: string;
  timeLabel: string;
  timeZoneLabel: string;
  offsetLabel: string;
  attendanceSummary?: string;
  recordingAvailable: boolean;
  join?: CalendarJoinState;
};

export type CalendarQueryResult = {
  contractVersion: typeof CALENDAR_CONTRACT_VERSION;
  role: CalendarRole;
  view: CalendarView;
  displayTimeZone: string;
  events: readonly CalendarDisplayEvent[];
};

export type CalendarOccurrenceEdit = {
  seriesId: string;
  targetLocalClassDate: string;
  scope: CalendarEditScope;
  expectedSeriesVersion: number;
  replacementLocalStartTime?: string;
  replacementDurationMinutes?: number;
  cancel?: boolean;
};

export type CalendarRepositoryQuery = {
  accountKey: string;
  productKey: string;
  adminAccess: boolean;
  rangeStart: string;
  rangeEnd: string;
  householdIds: readonly string[];
  studentIds: readonly string[];
  statuses?: readonly CalendarOccurrenceStatus[];
  seriesIds?: readonly string[];
};

export interface CalendarRepository {
  listOccurrences(query: CalendarRepositoryQuery): Promise<readonly CalendarOccurrence[]>;
}

export const CALENDAR_ERROR_CODES = {
  accessDenied: 'calendar_access_denied',
  invalidQuery: 'calendar_invalid_query',
  invalidRecurrence: 'calendar_invalid_recurrence',
  occurrenceInPast: 'calendar_occurrence_in_past',
  staleVersion: 'calendar_stale_version',
  unsupportedView: 'calendar_unsupported_view',
} as const;
