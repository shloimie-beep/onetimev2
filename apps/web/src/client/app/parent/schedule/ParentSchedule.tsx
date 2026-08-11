import React from 'react';
import type {
  ParentScheduleEntry,
  ParentSummaryStudent,
} from '../../../../../../../packages/contracts/src/portals/parent-summary/index.ts';

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(value));
}

export function ParentSchedule({
  entries,
  now = new Date(),
}: {
  entries: readonly ParentScheduleEntry[];
  students: readonly ParentSummaryStudent[];
  now?: Date;
}) {
  const nextEntry = [...entries]
    .filter(
      (entry) =>
        entry.status === 'upcoming' && new Date(entry.starts_at).getTime() >= now.getTime(),
    )
    .sort(
      (left, right) =>
        new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime() ||
        left.schedule_id.localeCompare(right.schedule_id),
    )
    .find(
      (entry, index, upcomingEntries) =>
        upcomingEntries.findIndex(({ schedule_id }) => schedule_id === entry.schedule_id) === index,
    );
  const enrolledStudentCount = nextEntry
    ? new Set(
        entries
          .filter(({ schedule_id }) => schedule_id === nextEntry.schedule_id)
          .map(({ student_id }) => student_id),
      ).size
    : 0;

  return (
    <section aria-labelledby="parent-schedule-heading">
      <h2 id="parent-schedule-heading">Next Class</h2>
      <p>Your household’s next scheduled class.</p>
      {!nextEntry ? (
        <p role="status">No upcoming class is scheduled right now.</p>
      ) : (
        <article>
          <h3>{nextEntry.title}</h3>
          <p>
            {enrolledStudentCount} {enrolledStudentCount === 1 ? 'Student is' : 'Students are'}{' '}
            enrolled.
          </p>
          <p>
            <time dateTime={nextEntry.starts_at}>{formatDateTime(nextEntry.starts_at)}</time>
            {' to '}
            <time dateTime={nextEntry.ends_at}>{formatDateTime(nextEntry.ends_at)}</time>
          </p>
          <p>Israel time (Asia/Jerusalem).</p>
          <p>Status: {nextEntry.status}</p>
          <a
            className="ot-button"
            href={`/app/parent/classes/${encodeURIComponent(nextEntry.schedule_id)}`}
          >
            View class details
          </a>
        </article>
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
