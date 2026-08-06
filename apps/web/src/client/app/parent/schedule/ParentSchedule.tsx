import React from 'react';
import type {
  ParentScheduleEntry,
  ParentSummaryStudent,
} from '../../../../../../../packages/contracts/src/portals/parent-summary/index.ts';

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}

export function ParentSchedule({
  entries,
  students,
}: {
  entries: readonly ParentScheduleEntry[];
  students: readonly ParentSummaryStudent[];
}) {
  const names = new Map(students.map(({ student_id, display_name }) => [student_id, display_name]));

  return (
    <section aria-labelledby="parent-schedule-heading">
      <h2 id="parent-schedule-heading">Schedule</h2>
      <p>Upcoming and recent household schedule items.</p>
      {entries.length === 0 ? (
        <p role="status">No schedule items right now.</p>
      ) : (
        <ol>
          {entries.map((entry) => (
            <li key={entry.schedule_id}>
              <article>
                <h3>{entry.title}</h3>
                <p>{names.get(entry.student_id) ?? 'Student'}</p>
                <p>
                  <time dateTime={entry.starts_at}>{formatDateTime(entry.starts_at)}</time>
                  {' to '}
                  <time dateTime={entry.ends_at}>{formatDateTime(entry.ends_at)}</time>
                </p>
                <p>Status: {entry.status}</p>
                <a
                  className="ot-button"
                  href={`/app/parent/classes/${encodeURIComponent(entry.schedule_id)}`}
                >
                  View class details
                </a>
              </article>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function ParentClassDetail({
  entry,
  students,
}: {
  entry: ParentScheduleEntry | null;
  students: readonly ParentSummaryStudent[];
}) {
  if (!entry) {
    return (
      <section aria-labelledby="parent-class-detail-heading">
        <h2 id="parent-class-detail-heading">Class not available</h2>
        <p>This class is not part of the selected household schedule.</p>
        <a className="ot-button" href="/app/parent/calendar">
          Back to calendar
        </a>
      </section>
    );
  }

  const studentName =
    students.find(({ student_id }) => student_id === entry.student_id)?.display_name ?? 'Student';
  return (
    <section aria-labelledby="parent-class-detail-heading">
      <p className="ot-eyebrow">Parent class detail</p>
      <h2 id="parent-class-detail-heading">{entry.title}</h2>
      <p>{studentName}</p>
      <p>
        <time dateTime={entry.starts_at}>{formatDateTime(entry.starts_at)}</time>
        {' to '}
        <time dateTime={entry.ends_at}>{formatDateTime(entry.ends_at)}</time>
      </p>
      <p>Status: {entry.status}</p>
      <p>Parents can review schedule and status here. Classroom entry stays Student-only.</p>
      <a className="ot-button" href="/app/parent/calendar">
        Back to calendar
      </a>
    </section>
  );
}
