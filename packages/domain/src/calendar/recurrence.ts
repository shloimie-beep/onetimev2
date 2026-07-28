import {
  CALENDAR_ERROR_CODES,
  CALENDAR_ROLLING_HORIZON_DAYS,
  CANONICAL_CLASS_TIME_ZONE,
  type CalendarOccurrence,
  type CalendarOccurrenceEdit,
  type CalendarOccurrenceException,
  type CalendarSeries,
} from '../../../contracts/src/calendar/index.ts';
import { CalendarDomainError } from './errors.ts';
import { zonedInstantForLocal } from './time-zone.ts';

export const CANONICAL_CLASS_SERIES: Readonly<CalendarSeries> = {
  id: 'canonical-class',
  title: 'One Time Live Class',
  timeZone: CANONICAL_CLASS_TIME_ZONE,
  localStartTime: '19:00',
  durationMinutes: 60,
  weekdays: [0, 1, 2, 3, 4],
  startsOn: '2020-01-01',
  active: true,
  version: 1,
};

const DAY_MS = 86_400_000;

function epochDay(localDate: string) {
  const parsed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!parsed) {
    throw new CalendarDomainError(
      CALENDAR_ERROR_CODES.invalidRecurrence,
      `Invalid local class date: ${localDate}.`,
    );
  }
  const instant = Date.UTC(Number(parsed[1]), Number(parsed[2]) - 1, Number(parsed[3]));
  const roundTrip = new Date(instant).toISOString().slice(0, 10);
  if (roundTrip !== localDate) {
    throw new CalendarDomainError(
      CALENDAR_ERROR_CODES.invalidRecurrence,
      `Invalid local class date: ${localDate}.`,
    );
  }
  return Math.floor(instant / DAY_MS);
}

function dateAtDay(day: number) {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

function assertSeries(series: CalendarSeries) {
  if (
    series.durationMinutes < 1 ||
    series.durationMinutes > 24 * 60 ||
    series.weekdays.length === 0 ||
    series.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
  ) {
    throw new CalendarDomainError(
      CALENDAR_ERROR_CODES.invalidRecurrence,
      'Calendar series duration or weekdays are invalid.',
    );
  }
  if (series.weekdays.includes(5) || series.weekdays.includes(6)) {
    throw new CalendarDomainError(
      CALENDAR_ERROR_CODES.invalidRecurrence,
      'Live classes cannot start on Friday or Saturday.',
    );
  }
  zonedInstantForLocal(series.startsOn, series.localStartTime, series.timeZone, 'earlier');
}

export function generateRollingOccurrences(
  series: CalendarSeries,
  options: {
    fromLocalDate: string;
    horizonDays?: number;
    exceptions?: readonly CalendarOccurrenceException[];
  },
): readonly CalendarOccurrence[] {
  assertSeries(series);
  if (!series.active) return [];
  const horizonDays = options.horizonDays ?? CALENDAR_ROLLING_HORIZON_DAYS;
  if (!Number.isInteger(horizonDays) || horizonDays < CALENDAR_ROLLING_HORIZON_DAYS) {
    throw new CalendarDomainError(
      CALENDAR_ERROR_CODES.invalidRecurrence,
      `Rolling calendar horizon must be at least ${CALENDAR_ROLLING_HORIZON_DAYS} local days.`,
    );
  }
  const firstDay = Math.max(epochDay(options.fromLocalDate), epochDay(series.startsOn));
  const lastDay = firstDay + horizonDays;
  const seriesLastDay = series.endsOn ? epochDay(series.endsOn) : Number.POSITIVE_INFINITY;
  const exceptions = new Map<string, CalendarOccurrenceException>();
  for (const exception of options.exceptions ?? []) {
    if (exceptions.has(exception.localClassDate)) {
      throw new CalendarDomainError(
        CALENDAR_ERROR_CODES.invalidRecurrence,
        `Duplicate exception for ${exception.localClassDate}.`,
      );
    }
    exceptions.set(exception.localClassDate, exception);
  }

  const occurrences: CalendarOccurrence[] = [];
  for (let day = firstDay; day < lastDay && day <= seriesLastDay; day += 1) {
    const localClassDate = dateAtDay(day);
    const weekday = new Date(day * DAY_MS).getUTCDay();
    if (!series.weekdays.includes(weekday)) continue;
    const exception = exceptions.get(localClassDate);
    if (exception?.kind === 'skip') continue;
    const localStartTime = exception?.localStartTime ?? series.localStartTime;
    const durationMinutes = exception?.durationMinutes ?? series.durationMinutes;
    if (weekday === 5 || weekday === 6 || durationMinutes < 1) {
      throw new CalendarDomainError(
        CALENDAR_ERROR_CODES.invalidRecurrence,
        'A calendar exception cannot schedule a Friday/Saturday start or invalid duration.',
      );
    }
    const startsAt = zonedInstantForLocal(
      localClassDate,
      localStartTime,
      series.timeZone,
      'earlier',
    );
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
    occurrences.push({
      id: `${series.id}:${localClassDate}`,
      seriesId: series.id,
      localClassDate,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      status: exception ? 'rescheduled' : 'scheduled',
      title: series.title,
      householdIds: [],
      studentIds: [],
      recordingAvailable: false,
    });
  }
  return occurrences;
}

export function assertOccurrenceEdit(
  series: CalendarSeries,
  occurrence: CalendarOccurrence,
  edit: CalendarOccurrenceEdit,
  now: Date,
) {
  if (edit.expectedSeriesVersion !== series.version) {
    throw new CalendarDomainError(
      CALENDAR_ERROR_CODES.staleVersion,
      'The calendar series changed; reload before editing.',
    );
  }
  if (edit.seriesId !== series.id || edit.targetLocalClassDate !== occurrence.localClassDate) {
    throw new CalendarDomainError(
      CALENDAR_ERROR_CODES.invalidRecurrence,
      'The edit target does not match the occurrence.',
    );
  }
  if (new Date(occurrence.startsAt).getTime() <= now.getTime()) {
    throw new CalendarDomainError(
      CALENDAR_ERROR_CODES.occurrenceInPast,
      'Past calendar occurrences are immutable.',
    );
  }
  if (edit.replacementLocalStartTime) {
    const weekday = new Date(epochDay(occurrence.localClassDate) * DAY_MS).getUTCDay();
    if (weekday === 5 || weekday === 6) {
      throw new CalendarDomainError(
        CALENDAR_ERROR_CODES.invalidRecurrence,
        'Live classes cannot start on Friday or Saturday.',
      );
    }
    zonedInstantForLocal(
      occurrence.localClassDate,
      edit.replacementLocalStartTime,
      series.timeZone,
    );
  }
  return {
    scope: edit.scope,
    targetLocalClassDate: edit.targetLocalClassDate,
    nextSeriesVersion: series.version + 1,
  } as const;
}

export function planOccurrenceEdit(
  series: CalendarSeries,
  occurrence: CalendarOccurrence,
  edit: CalendarOccurrenceEdit,
  now: Date,
) {
  const checked = assertOccurrenceEdit(series, occurrence, edit, now);
  if (edit.scope === 'single') {
    const exception: CalendarOccurrenceException = edit.cancel
      ? { localClassDate: occurrence.localClassDate, kind: 'skip' }
      : {
          localClassDate: occurrence.localClassDate,
          kind: 'reschedule',
          ...(edit.replacementLocalStartTime
            ? { localStartTime: edit.replacementLocalStartTime }
            : {}),
          ...(edit.replacementDurationMinutes
            ? { durationMinutes: edit.replacementDurationMinutes }
            : {}),
        };
    return {
      kind: 'single' as const,
      expectedSeriesVersion: edit.expectedSeriesVersion,
      nextSeriesVersion: checked.nextSeriesVersion,
      exception,
    };
  }

  const targetDay = epochDay(occurrence.localClassDate);
  const currentSeriesPatch: CalendarSeries = {
    ...series,
    endsOn: dateAtDay(targetDay - 1),
    version: checked.nextSeriesVersion,
  };
  const successorSeries: CalendarSeries | undefined = edit.cancel
    ? undefined
    : {
        ...series,
        id: `${series.id}:v${checked.nextSeriesVersion}`,
        startsOn: occurrence.localClassDate,
        ...(edit.replacementLocalStartTime
          ? { localStartTime: edit.replacementLocalStartTime }
          : {}),
        ...(edit.replacementDurationMinutes
          ? { durationMinutes: edit.replacementDurationMinutes }
          : {}),
        version: 1,
      };
  return {
    kind: 'this_and_future' as const,
    expectedSeriesVersion: edit.expectedSeriesVersion,
    currentSeriesPatch,
    ...(successorSeries ? { successorSeries } : {}),
  };
}
