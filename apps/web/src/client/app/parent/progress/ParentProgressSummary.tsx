import React from 'react';
import type {
  ParentStudentProgress,
  ParentSummaryStudent,
} from '../../../../../../../packages/contracts/src/portals/parent-summary/index.ts';

export function ParentProgressSummary({
  progress,
  students,
}: {
  progress: readonly ParentStudentProgress[];
  students: readonly ParentSummaryStudent[];
}) {
  const names = new Map(students.map(({ student_id, display_name }) => [student_id, display_name]));

  return (
    <section aria-labelledby="parent-progress-heading">
      <h2 id="parent-progress-heading">Attendance and progress</h2>
      {progress.length === 0 ? (
        <p role="status">No progress summary is available yet.</p>
      ) : (
        progress.map((summary) => (
          <article key={summary.student_id} aria-labelledby={`progress-${summary.student_id}`}>
            <h3 id={`progress-${summary.student_id}`}>
              {names.get(summary.student_id) ?? 'Student'}
            </h3>
            <dl>
              <dt>Sessions attended</dt>
              <dd>{summary.attendance.attended_sessions}</dd>
              <dt>Sessions scheduled</dt>
              <dd>{summary.attendance.scheduled_sessions}</dd>
              <dt>Attendance</dt>
              <dd>
                {summary.attendance.attendance_percent === null
                  ? 'Not available'
                  : `${summary.attendance.attendance_percent}%`}
              </dd>
              <dt>Current streak</dt>
              <dd>{summary.attendance.current_streak}</dd>
            </dl>
            <h4>Badges</h4>
            {summary.badges.length === 0 ? (
              <p>No badges yet.</p>
            ) : (
              <ul>
                {summary.badges.map((badge) => (
                  <li key={badge.badge_id}>{badge.label}</li>
                ))}
              </ul>
            )}
          </article>
        ))
      )}
    </section>
  );
}
