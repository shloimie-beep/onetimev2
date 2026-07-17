export const ONE_TIME_CLASS_TIME_ZONE = 'Asia/Jerusalem';
export const ONE_TIME_CLASS_START_HOUR = 19;
export const ONE_TIME_CLASS_START_MINUTE = 0;
export const ONE_TIME_CLASS_REMINDER_HOUR = 18;
export const ONE_TIME_CLASS_REMINDER_MINUTE = 30;

type LocalDateParts = {
  year: number;
  month: number;
  day: number;
};

type LocalDateTimeParts = LocalDateParts & {
  hour: number;
  minute: number;
  second: number;
};

export type DailyClassWindow = {
  localDate: string;
  timeZone: string;
  startsAt: Date;
  reminderDueAt: Date;
  reminderDispatchAt: Date;
  dispatchMode: 'scheduled_t30' | 'immediate_t30' | 'current_joinable' | 'next_day_t30';
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string) {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat('en-US-u-ca-gregory', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

export function localPartsFor(date: Date, timeZone = ONE_TIME_CLASS_TIME_ZONE): LocalDateTimeParts {
  const parts = formatterFor(timeZone).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => {
    const part = parts.find((item) => item.type === type)?.value;
    if (!part) throw new Error(`Missing ${type} in formatted date.`);
    return Number(part);
  };
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

export function localDateKey(parts: LocalDateParts) {
  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-');
}

export function addLocalDays(parts: LocalDateParts, days: number): LocalDateParts {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function zonedDateTimeToUtc(
  parts: LocalDateParts,
  hour: number,
  minute: number,
  timeZone = ONE_TIME_CLASS_TIME_ZONE,
) {
  const desiredAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, 0);
  let candidate = desiredAsUtc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = localPartsFor(new Date(candidate), timeZone);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    const delta = desiredAsUtc - actualAsUtc;
    if (delta === 0) return new Date(candidate);
    candidate += delta;
  }
  return new Date(candidate);
}

export function resolveDailyClassWindow(
  now = new Date(),
  options: { timeZone?: string; currentOccurrenceStillJoinable?: boolean } = {},
): DailyClassWindow {
  const timeZone = options.timeZone ?? ONE_TIME_CLASS_TIME_ZONE;
  const localNow = localPartsFor(now, timeZone);
  const localMinutes = localNow.hour * 60 + localNow.minute;
  const reminderMinutes = ONE_TIME_CLASS_REMINDER_HOUR * 60 + ONE_TIME_CLASS_REMINDER_MINUTE;
  const startMinutes = ONE_TIME_CLASS_START_HOUR * 60 + ONE_TIME_CLASS_START_MINUTE;
  let targetDate: LocalDateParts = localNow;
  let dispatchMode: DailyClassWindow['dispatchMode'] = 'scheduled_t30';

  if (localMinutes < reminderMinutes) {
    dispatchMode = 'scheduled_t30';
  } else if (localMinutes < startMinutes) {
    dispatchMode = 'immediate_t30';
  } else if (options.currentOccurrenceStillJoinable) {
    dispatchMode = 'current_joinable';
  } else {
    targetDate = addLocalDays(localNow, 1);
    dispatchMode = 'next_day_t30';
  }

  const startsAt = zonedDateTimeToUtc(
    targetDate,
    ONE_TIME_CLASS_START_HOUR,
    ONE_TIME_CLASS_START_MINUTE,
    timeZone,
  );
  const reminderDueAt = zonedDateTimeToUtc(
    targetDate,
    ONE_TIME_CLASS_REMINDER_HOUR,
    ONE_TIME_CLASS_REMINDER_MINUTE,
    timeZone,
  );

  return {
    localDate: localDateKey(targetDate),
    timeZone,
    startsAt,
    reminderDueAt,
    reminderDispatchAt:
      dispatchMode === 'immediate_t30' || dispatchMode === 'current_joinable' ? now : reminderDueAt,
    dispatchMode,
  };
}
