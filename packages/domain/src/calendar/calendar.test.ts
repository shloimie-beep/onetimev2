import { describe, expect, it } from 'vitest';
import type {
  CalendarActorScope,
  CalendarOccurrence,
  CalendarSeries,
} from '../../../contracts/src/calendar/index.ts';
import { CalendarDomainError } from './errors.ts';
import {
  CANONICAL_CLASS_SERIES,
  assertOccurrenceEdit,
  generateRollingOccurrences,
  planOccurrenceEdit,
} from './recurrence.ts';
import { formatCalendarInstant, zonedInstantForLocal } from './time-zone.ts';
import { allowedCalendarViews, projectCalendarView } from './views.ts';

const parent: CalendarActorScope = {
  role: 'parent',
  userId: 'parent-1',
  accountKey: 'account-1',
  productKey: 'one-time',
  householdIds: ['household-1'],
  studentIds: ['student-1', 'student-2'],
  accessState: 'active',
  preferredTimeZone: 'America/New_York',
};

const occurrence: CalendarOccurrence = {
  id: 'canonical-class:2026-03-22',
  seriesId: 'canonical-class',
  localClassDate: '2026-03-22',
  startsAt: '2026-03-22T17:00:00.000Z',
  endsAt: '2026-03-22T18:00:00.000Z',
  status: 'scheduled',
  title: 'One Time Live Class',
  householdIds: ['household-1'],
  studentIds: ['student-1'],
  attendanceSummary: 'Scheduled',
  recordingAvailable: false,
};

function query(view: 'month' | 'week' | 'today' | 'agenda' = 'month') {
  return {
    view,
    rangeStart: '2026-03-01T00:00:00.000Z',
    rangeEnd: '2026-04-01T00:00:00.000Z',
  } as const;
}

describe('P15 calendar contract', () => {
  it('OTV2-CALENDAR-058 generates the canonical Sunday–Thursday 19:00 Jerusalem series', () => {
    const events = generateRollingOccurrences(CANONICAL_CLASS_SERIES, {
      fromLocalDate: '2026-08-01',
    });
    expect(events).toHaveLength(65);
    expect(events[0]).toMatchObject({
      localClassDate: '2026-08-16',
      startsAt: '2026-08-16T16:00:00.000Z',
      endsAt: '2026-08-16T17:00:00.000Z',
    });
    expect(new Set(events.map((event) => event.id)).size).toBe(events.length);
    expect(
      events.every((event) => {
        const weekday = new Date(`${event.localClassDate}T00:00:00.000Z`).getUTCDay();
        return weekday >= 0 && weekday <= 4;
      }),
    ).toBe(true);
    expect(events.find((event) => event.localClassDate === '2026-10-22')?.startsAt).toBe(
      '2026-10-22T16:00:00.000Z',
    );
    expect(events.find((event) => event.localClassDate === '2026-10-25')?.startsAt).toBe(
      '2026-10-25T17:00:00.000Z',
    );
  });

  it('OTV2-CALENDAR-059 rejects Friday and Saturday recurrence boundaries', () => {
    for (const weekday of [5, 6]) {
      const invalid: CalendarSeries = {
        ...CANONICAL_CLASS_SERIES,
        id: `invalid-${weekday}`,
        weekdays: [weekday],
      };
      expect(() =>
        generateRollingOccurrences(invalid, { fromLocalDate: '2026-03-01' }),
      ).toThrowError(/Friday or Saturday/);
    }
  });

  it('OTV2-CALENDAR-060 permits a different valid admin-configured time', () => {
    const custom: CalendarSeries = {
      ...CANONICAL_CLASS_SERIES,
      id: 'custom-time',
      startsOn: '2026-03-01',
      localStartTime: '18:15',
    };
    const events = generateRollingOccurrences(custom, { fromLocalDate: '2026-03-01' });
    expect(events[0]?.startsAt).toBe('2026-03-01T16:15:00.000Z');
  });

  it('OTV2-CALENDAR-061 supports skips/reschedules and forbids duplicate exceptions', () => {
    const historicalSeries = { ...CANONICAL_CLASS_SERIES, startsOn: '2026-03-01' };
    const events = generateRollingOccurrences(historicalSeries, {
      fromLocalDate: '2026-03-01',
      exceptions: [
        { localClassDate: '2026-03-01', kind: 'skip' },
        { localClassDate: '2026-03-02', kind: 'reschedule', localStartTime: '20:00' },
      ],
    });
    expect(events.some((event) => event.localClassDate === '2026-03-01')).toBe(false);
    expect(events.find((event) => event.localClassDate === '2026-03-02')).toMatchObject({
      status: 'rescheduled',
      startsAt: '2026-03-02T18:00:00.000Z',
    });
    expect(() =>
      generateRollingOccurrences(historicalSeries, {
        fromLocalDate: '2026-03-01',
        exceptions: [
          { localClassDate: '2026-03-01', kind: 'skip' },
          { localClassDate: '2026-03-01', kind: 'skip' },
        ],
      }),
    ).toThrowError(/Duplicate exception/);
  });

  it('OTV2-CALENDAR-061 rejects stale and past occurrence edits', () => {
    expect(() =>
      assertOccurrenceEdit(
        CANONICAL_CLASS_SERIES,
        occurrence,
        {
          seriesId: occurrence.seriesId,
          targetLocalClassDate: occurrence.localClassDate,
          scope: 'single',
          expectedSeriesVersion: 0,
        },
        new Date('2026-03-01T00:00:00.000Z'),
      ),
    ).toThrowError(/series changed/);
    expect(() =>
      assertOccurrenceEdit(
        CANONICAL_CLASS_SERIES,
        occurrence,
        {
          seriesId: occurrence.seriesId,
          targetLocalClassDate: occurrence.localClassDate,
          scope: 'this_and_future',
          expectedSeriesVersion: 1,
        },
        new Date('2026-03-23T00:00:00.000Z'),
      ),
    ).toThrowError(/Past calendar occurrences/);
  });

  it('OTV2-CALENDAR-061 plans single and future edits without rewriting history', () => {
    expect(
      planOccurrenceEdit(
        CANONICAL_CLASS_SERIES,
        occurrence,
        {
          seriesId: occurrence.seriesId,
          targetLocalClassDate: occurrence.localClassDate,
          scope: 'single',
          expectedSeriesVersion: 1,
          replacementLocalStartTime: '20:00',
        },
        new Date('2026-03-01T00:00:00.000Z'),
      ),
    ).toMatchObject({
      kind: 'single',
      exception: {
        localClassDate: '2026-03-22',
        kind: 'reschedule',
        localStartTime: '20:00',
      },
    });
    expect(
      planOccurrenceEdit(
        CANONICAL_CLASS_SERIES,
        occurrence,
        {
          seriesId: occurrence.seriesId,
          targetLocalClassDate: occurrence.localClassDate,
          scope: 'this_and_future',
          expectedSeriesVersion: 1,
          replacementLocalStartTime: '18:30',
        },
        new Date('2026-03-01T00:00:00.000Z'),
      ),
    ).toMatchObject({
      kind: 'this_and_future',
      currentSeriesPatch: { endsOn: '2026-03-21', version: 2 },
      successorSeries: { startsOn: '2026-03-22', localStartTime: '18:30' },
    });
  });

  it('OTV2-CALENDAR-062 handles Israel/US DST divergence and rejects DST gaps', () => {
    const labels = formatCalendarInstant(occurrence.startsAt, 'America/New_York');
    expect(labels.timeLabel).toBe('1:00 PM');
    expect(labels.timeZoneLabel).toContain('EDT');
    expect(labels.offsetLabel).toBe('GMT-4');
    expect(() => zonedInstantForLocal('2026-03-08', '02:30', 'America/New_York')).toThrowError(
      /does not exist/,
    );
  });

  it('OTV2-CALENDAR-051..057 provides exact role views, Gregorian English, and parent filtering', () => {
    expect(allowedCalendarViews('admin')).toEqual(['month', 'week', 'day', 'agenda']);
    expect(allowedCalendarViews('parent')).toEqual(['month', 'week', 'list']);
    expect(allowedCalendarViews('student')).toEqual(['today', 'week', 'agenda']);
    const result = projectCalendarView({
      actor: parent,
      query: { ...query(), studentId: 'student-1' },
      occurrences: [occurrence, { ...occurrence, id: 'other', studentIds: ['student-2'] }],
    });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.dateLabel).toMatch(/Sun, Mar 22, 2026/);
    expect(result.events[0]).not.toHaveProperty('join');
  });

  it('denies inactive household access before returning calendar data', () => {
    expect(() =>
      projectCalendarView({
        actor: { ...parent, accessState: 'inactive' },
        query: query(),
        occurrences: [occurrence],
      }),
    ).toThrowError(CalendarDomainError);
  });

  it('returns only a safe Student join action during the allowed window', () => {
    const result = projectCalendarView({
      actor: { ...parent, role: 'student' },
      query: query('today'),
      occurrences: [occurrence],
      now: new Date('2026-03-22T16:55:00.000Z'),
    });
    expect(result.events[0]?.join).toEqual({
      state: 'available',
      action: 'open_live_class',
    });
    expect(JSON.stringify(result)).not.toMatch(/zoom|provider|meeting/i);
  });
});
