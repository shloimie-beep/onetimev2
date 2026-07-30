import { CALENDAR_ERROR_CODES } from '../../../contracts/src/calendar/index.ts';
import { CalendarDomainError } from './errors.ts';

type LocalDateTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function integerPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  const value = parts.find((part) => part.type === type)?.value;
  return value === undefined ? Number.NaN : Number(value);
}

function formatterFor(timeZone: string) {
  try {
    return new Intl.DateTimeFormat('en-CA-u-ca-gregory', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
  } catch {
    throw new CalendarDomainError(
      CALENDAR_ERROR_CODES.invalidRecurrence,
      `Unknown IANA time zone: ${timeZone}.`,
    );
  }
}

function partsAt(formatter: Intl.DateTimeFormat, instant: number): LocalDateTime {
  const parts = formatter.formatToParts(new Date(instant));
  return {
    year: integerPart(parts, 'year'),
    month: integerPart(parts, 'month'),
    day: integerPart(parts, 'day'),
    hour: integerPart(parts, 'hour'),
    minute: integerPart(parts, 'minute'),
  };
}

function sameLocal(left: LocalDateTime, right: LocalDateTime) {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute
  );
}

export function parseLocalDateTime(localDate: string, localTime: string): LocalDateTime {
  const date = DATE_PATTERN.exec(localDate);
  const time = TIME_PATTERN.exec(localTime);
  if (!date || !time) {
    throw new CalendarDomainError(
      CALENDAR_ERROR_CODES.invalidRecurrence,
      `Invalid Gregorian local date or 24-hour time: ${localDate} ${localTime}.`,
    );
  }
  const value = {
    year: Number(date[1]),
    month: Number(date[2]),
    day: Number(date[3]),
    hour: Number(time[1]),
    minute: Number(time[2]),
  };
  const roundTrip = new Date(
    Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute),
  );
  if (
    roundTrip.getUTCFullYear() !== value.year ||
    roundTrip.getUTCMonth() + 1 !== value.month ||
    roundTrip.getUTCDate() !== value.day
  ) {
    throw new CalendarDomainError(
      CALENDAR_ERROR_CODES.invalidRecurrence,
      `Invalid Gregorian date: ${localDate}.`,
    );
  }
  return value;
}

/**
 * Converts a wall-clock value to an instant without relying on the machine or
 * browser time zone. DST gaps are rejected; folds require explicit selection.
 */
export function zonedInstantForLocal(
  localDate: string,
  localTime: string,
  timeZone: string,
  disambiguation: 'earlier' | 'later' | 'reject' = 'reject',
) {
  const wanted = parseLocalDateTime(localDate, localTime);
  const naive = Date.UTC(wanted.year, wanted.month - 1, wanted.day, wanted.hour, wanted.minute);
  const formatter = formatterFor(timeZone);
  const offsets = new Set<number>();
  for (let hours = -48; hours <= 48; hours += 6) {
    const sample = naive + hours * 60 * 60 * 1000;
    const local = partsAt(formatter, sample);
    offsets.add(
      Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute) - sample,
    );
  }
  const candidates = [...offsets]
    .map((offset) => naive - offset)
    .filter((candidate) => sameLocal(partsAt(formatter, candidate), wanted))
    .sort((left, right) => left - right);

  if (candidates.length === 0) {
    throw new CalendarDomainError(
      CALENDAR_ERROR_CODES.invalidRecurrence,
      `${localDate} ${localTime} does not exist in ${timeZone} because of a clock change.`,
    );
  }
  if (candidates.length > 1 && disambiguation === 'reject') {
    throw new CalendarDomainError(
      CALENDAR_ERROR_CODES.invalidRecurrence,
      `${localDate} ${localTime} is ambiguous in ${timeZone}; choose earlier or later.`,
    );
  }
  const instant = disambiguation === 'later' ? candidates[candidates.length - 1] : candidates[0];
  if (instant === undefined) {
    throw new CalendarDomainError(
      CALENDAR_ERROR_CODES.invalidRecurrence,
      'Unable to resolve the calendar instant.',
    );
  }
  return new Date(instant);
}

function zoneName(instant: Date, timeZone: string, style: 'short' | 'shortOffset') {
  return (
    new Intl.DateTimeFormat('en-US-u-ca-gregory', {
      timeZone,
      timeZoneName: style,
    })
      .formatToParts(instant)
      .find((part) => part.type === 'timeZoneName')?.value ?? timeZone
  );
}

export function formatCalendarInstant(instantValue: string | Date, timeZone: string) {
  const instant = instantValue instanceof Date ? instantValue : new Date(instantValue);
  if (Number.isNaN(instant.getTime())) {
    throw new CalendarDomainError(
      CALENDAR_ERROR_CODES.invalidQuery,
      'Calendar event has an invalid instant.',
    );
  }
  formatterFor(timeZone);
  const local = partsAt(formatterFor(timeZone), instant.getTime());
  return {
    displayLocalDate: [
      String(local.year).padStart(4, '0'),
      String(local.month).padStart(2, '0'),
      String(local.day).padStart(2, '0'),
    ].join('-'),
    dateLabel: new Intl.DateTimeFormat('en-US-u-ca-gregory', {
      timeZone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(instant),
    timeLabel: new Intl.DateTimeFormat('en-US-u-ca-gregory', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(instant),
    timeZoneLabel: `${timeZone} (${zoneName(instant, timeZone, 'short')})`,
    offsetLabel: zoneName(instant, timeZone, 'shortOffset'),
  };
}
