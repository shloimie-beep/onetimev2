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
              </article>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
