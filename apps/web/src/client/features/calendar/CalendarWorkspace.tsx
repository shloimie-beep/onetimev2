import React from 'react';
import type {
  CalendarDisplayEvent,
  CalendarQueryResult,
  CalendarRole,
  CalendarView,
} from '../../../../../../packages/contracts/src/calendar/index.ts';
import { allowedCalendarViews } from '../../../../../../packages/domain/src/calendar/index.ts';
import { V21StatePanel } from '../../../../../../packages/brand-system/src/react-v21.tsx';
import './calendar.css';

type CalendarWorkspaceProps = {
  result: CalendarQueryResult;
  selectedDate: string;
  todayDate: string;
  onSelectDate: (date: string) => void;
  onChangeView: (view: CalendarView) => void;
  onNavigatePeriod: (direction: 'previous' | 'today' | 'next') => void;
  onJoin?: (eventId: string) => void;
};

const VIEW_LABELS: Record<CalendarView, string> = {
  month: 'Month',
  week: 'Week',
  day: 'Day',
  agenda: 'Agenda',
  list: 'List',
  today: 'Today',
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dateAt(instant: number) {
  return new Date(instant).toISOString().slice(0, 10);
}

function monthCells(selectedDate: string) {
  const [yearText, monthText] = selectedDate.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const first = Date.UTC(year, month - 1, 1);
  const gridStart = first - new Date(first).getUTCDay() * 86_400_000;
  return Array.from({ length: 42 }, (_, index) => dateAt(gridStart + index * 86_400_000));
}

function dayLabel(localDate: string) {
  const [year, month, day] = localDate.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US-u-ca-gregory', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1)));
}

function EventSummary({
  event,
  role,
  onJoin,
}: {
  event: CalendarDisplayEvent;
  role: CalendarRole;
  onJoin?: (eventId: string) => void;
}) {
  const joinable = event.join?.state === 'available';
  const disabledJoinReason =
    event.join?.state === 'unavailable' ? event.join.reason.replace('_', ' ') : undefined;
  return (
    <article className="ot-calendar__event">
      <header>
        <strong>{event.title}</strong>
        <span className={`ot-calendar__status ot-calendar__status--${event.status}`}>
          {event.status}
        </span>
      </header>
      <p>
        <time dateTime={event.startsAt}>
          {event.dateLabel}, {event.timeLabel}
        </time>
        {' · '}
        <span>
          {event.timeZoneLabel}, {event.offsetLabel}
        </span>
      </p>
      {role === 'parent' && event.attendanceSummary && <p>{event.attendanceSummary}</p>}
      {event.recordingAvailable && <p>Recording available</p>}
      {role === 'student' && event.join && (
        <button
          type="button"
          disabled={!joinable}
          title={disabledJoinReason ? `Join unavailable: ${disabledJoinReason}` : undefined}
          onClick={() => onJoin?.(event.id)}
        >
          {joinable ? 'Join live class' : 'Join unavailable'}
        </button>
      )}
    </article>
  );
}

export function CalendarWorkspace(props: CalendarWorkspaceProps) {
  const views = allowedCalendarViews(props.result.role);
  const selectedEvents = props.result.events.filter(
    (event) => event.displayLocalDate === props.selectedDate,
  );
  const showGrid = props.result.view === 'month';
  const cells = showGrid ? monthCells(props.selectedDate) : [];

  return (
    <section className="ot-calendar" aria-labelledby="ot-calendar-title">
      <header className="ot-calendar__heading">
        <div>
          <h2 id="ot-calendar-title">Calendar</h2>
          <p>
            Times shown in <strong>{props.result.displayTimeZone}</strong>. Your browser time zone
            does not change this calendar.
          </p>
        </div>
        <div className="ot-calendar__view-switcher" role="group" aria-label="Calendar view">
          {views.map((view) => (
            <button
              key={view}
              type="button"
              aria-pressed={props.result.view === view}
              onClick={() => props.onChangeView(view)}
            >
              {VIEW_LABELS[view]}
            </button>
          ))}
        </div>
      </header>

      <div className="ot-calendar__toolbar" role="group" aria-label="Calendar navigation">
        <button type="button" onClick={() => props.onNavigatePeriod('previous')}>
          Previous
        </button>
        <button type="button" onClick={() => props.onNavigatePeriod('today')}>
          Today
        </button>
        <button type="button" onClick={() => props.onNavigatePeriod('next')}>
          Next
        </button>
        <label>
          Go to date
          <input
            type="date"
            value={props.selectedDate}
            onChange={(event) => props.onSelectDate(event.currentTarget.value)}
          />
        </label>
      </div>

      {showGrid && (
        <div className="ot-calendar__grid-region">
          <div className="ot-calendar__weekdays" aria-hidden="true">
            {WEEKDAYS.map((weekday) => (
              <span key={weekday}>{weekday.slice(0, 3)}</span>
            ))}
          </div>
          <div className="ot-calendar__grid" role="grid" aria-label="Month calendar">
            {cells.map((localDate) => {
              const events = props.result.events.filter(
                (event) => event.displayLocalDate === localDate,
              );
              return (
                <button
                  key={localDate}
                  type="button"
                  role="gridcell"
                  aria-label={`${dayLabel(localDate)}, ${events.length} ${events.length === 1 ? 'event' : 'events'}`}
                  aria-current={localDate === props.todayDate ? 'date' : undefined}
                  aria-pressed={localDate === props.selectedDate}
                  onClick={() => props.onSelectDate(localDate)}
                >
                  <span>{dayLabel(localDate)}</span>
                  {events.slice(0, 2).map((event) => (
                    <small key={event.id}>
                      {event.timeLabel} {event.title}
                    </small>
                  ))}
                  {events.length > 2 && <small>+{events.length - 2} more</small>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <section className="ot-calendar__agenda" aria-labelledby="ot-calendar-agenda-title">
        <h3 id="ot-calendar-agenda-title">Agenda for {dayLabel(props.selectedDate)}</h3>
        <p className="ot-calendar__announcement" aria-live="polite">
          {selectedEvents.length} {selectedEvents.length === 1 ? 'event' : 'events'}.
        </p>
        {selectedEvents.length === 0 ? (
          <V21StatePanel kind="empty" title="No classes">
            <p>There are no classes on this date.</p>
          </V21StatePanel>
        ) : (
          <ol>
            {selectedEvents.map((event) => (
              <li key={event.id}>
                <EventSummary
                  event={event}
                  role={props.result.role}
                  {...(props.onJoin ? { onJoin: props.onJoin } : {})}
                />
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}
