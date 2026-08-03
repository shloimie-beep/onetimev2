import {
  CALENDAR_CONTRACT_VERSION,
  CALENDAR_ERROR_CODES,
  type CalendarActorScope,
  type CalendarDisplayEvent,
  type CalendarOccurrence,
  type CalendarQuery,
  type CalendarQueryResult,
  type CalendarRole,
  type CalendarView,
} from '../../../contracts/src/calendar/index.ts';
import { CalendarDomainError } from './errors.ts';
import { formatCalendarInstant } from './time-zone.ts';

const ALLOWED_VIEWS: Readonly<Record<CalendarRole, readonly CalendarView[]>> = {
  admin: ['month', 'week', 'day', 'agenda'],
  parent: ['month', 'week', 'list'],
  student: ['today', 'week', 'agenda'],
};

function hasIntersection(left: readonly string[], right: readonly string[]) {
  return left.some((value) => right.includes(value));
}

function assertAccess(actor: CalendarActorScope, query: CalendarQuery) {
  if (actor.accessState === 'inactive') {
    throw new CalendarDomainError(
      CALENDAR_ERROR_CODES.accessDenied,
      'Calendar access is unavailable for an inactive household.',
    );
  }
  if (!ALLOWED_VIEWS[actor.role].includes(query.view)) {
    throw new CalendarDomainError(
      CALENDAR_ERROR_CODES.unsupportedView,
      `${query.view} is not available for ${actor.role} calendars.`,
    );
  }
  if (
    actor.role !== 'admin' &&
    query.householdId &&
    !actor.householdIds.includes(query.householdId)
  ) {
    throw new CalendarDomainError(
      CALENDAR_ERROR_CODES.accessDenied,
      'The requested household is outside the authenticated scope.',
    );
  }
  if (actor.role !== 'admin' && query.studentId && !actor.studentIds.includes(query.studentId)) {
    throw new CalendarDomainError(
      CALENDAR_ERROR_CODES.accessDenied,
      'The requested student is outside the authenticated scope.',
    );
  }
}

function joinState(event: CalendarOccurrence, actor: CalendarActorScope, now: Date) {
  if (!hasIntersection(event.studentIds, actor.studentIds)) {
    return { state: 'unavailable', reason: 'not_student' } as const;
  }
  if (event.status === 'cancelled') {
    return { state: 'unavailable', reason: 'cancelled' } as const;
  }
  const startsAt = new Date(event.startsAt).getTime();
  const endsAt = new Date(event.endsAt).getTime();
  if (now.getTime() < startsAt - 10 * 60_000) {
    return { state: 'unavailable', reason: 'too_early' } as const;
  }
  if (now.getTime() > endsAt + 15 * 60_000) {
    return { state: 'unavailable', reason: 'ended' } as const;
  }
  return { state: 'available', action: 'open_live_class' } as const;
}

export function projectCalendarView(input: {
  actor: CalendarActorScope;
  query: CalendarQuery;
  occurrences: readonly CalendarOccurrence[];
  now?: Date;
}): CalendarQueryResult {
  assertAccess(input.actor, input.query);
  const displayTimeZone =
    input.actor.role === 'admin'
      ? (input.query.displayTimeZone ?? input.actor.preferredTimeZone)
      : input.actor.preferredTimeZone;
  const rangeStart = new Date(input.query.rangeStart).getTime();
  const rangeEnd = new Date(input.query.rangeEnd).getTime();
  if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeStart >= rangeEnd) {
    throw new CalendarDomainError(
      CALENDAR_ERROR_CODES.invalidQuery,
      'Calendar range must contain valid increasing instants.',
    );
  }

  const events = input.occurrences
    .filter((event) => {
      const start = new Date(event.startsAt).getTime();
      if (start < rangeStart || start >= rangeEnd) return false;
      if (
        input.actor.role !== 'admin' &&
        !hasIntersection(event.householdIds, input.actor.householdIds)
      ) {
        return false;
      }
      if (
        input.actor.role === 'student' &&
        !hasIntersection(event.studentIds, input.actor.studentIds)
      ) {
        return false;
      }
      if (input.query.householdId && !event.householdIds.includes(input.query.householdId)) {
        return false;
      }
      if (input.query.studentId && !event.studentIds.includes(input.query.studentId)) {
        return false;
      }
      if (input.query.statuses && !input.query.statuses.includes(event.status)) return false;
      if (input.query.seriesIds && !input.query.seriesIds.includes(event.seriesId)) return false;
      return true;
    })
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt))
    .map((event): CalendarDisplayEvent => {
      const labels = formatCalendarInstant(event.startsAt, displayTimeZone);
      const base: CalendarDisplayEvent = {
        id: event.id,
        title: event.title,
        localClassDate: event.localClassDate,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        status: event.status,
        ...labels,
        recordingAvailable: event.recordingAvailable ?? false,
      };
      if (input.actor.role === 'parent') {
        return event.attendanceSummary
          ? { ...base, attendanceSummary: event.attendanceSummary }
          : base;
      }
      if (input.actor.role === 'student') {
        return {
          ...base,
          join: joinState(event, input.actor, input.now ?? new Date()),
        };
      }
      return base;
    });

  return {
    contractVersion: CALENDAR_CONTRACT_VERSION,
    role: input.actor.role,
    view: input.query.view,
    displayTimeZone,
    events,
  };
}

export function allowedCalendarViews(role: CalendarRole) {
  return ALLOWED_VIEWS[role];
}
