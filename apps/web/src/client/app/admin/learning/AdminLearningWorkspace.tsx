import React from 'react';
import type {
  AttendanceRecord,
  LearningAnnouncement,
  LearningQuestion,
} from '../../../../../../../packages/contracts/src/learning/index.ts';

export function AdminLearningWorkspace(props: {
  questions: readonly LearningQuestion[];
  announcements: readonly LearningAnnouncement[];
  attendance: readonly AttendanceRecord[];
}) {
  return (
    <main aria-labelledby="admin-learning-title">
      <h1 id="admin-learning-title">Learning engagement</h1>
      <section aria-labelledby="admin-question-title">
        <h2 id="admin-question-title">Private Student questions</h2>
        <table>
          <caption>Questions requiring Rabbi or Admin review</caption>
          <thead>
            <tr>
              <th scope="col">Question</th>
              <th scope="col">Class</th>
              <th scope="col">State</th>
            </tr>
          </thead>
          <tbody>
            {props.questions.map((question) => (
              <tr key={question.id}>
                <td>{question.body}</td>
                <td>{question.classId}</td>
                <td>{question.state.replaceAll('_', ' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section aria-labelledby="admin-announcement-title">
        <h2 id="admin-announcement-title">Announcements</h2>
        <p>Publish separately to the program, a class, one Parent household, or one Student.</p>
        <ul>
          {props.announcements.map((announcement) => (
            <li key={announcement.id}>
              {announcement.title} — {announcement.audience.kind}
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="admin-attendance-title">
        <h2 id="admin-attendance-title">Attendance corrections</h2>
        <table>
          <caption>Student attendance and audited corrections</caption>
          <thead>
            <tr>
              <th scope="col">Student</th>
              <th scope="col">Occurrence</th>
              <th scope="col">Minutes</th>
              <th scope="col">Correction</th>
            </tr>
          </thead>
          <tbody>
            {props.attendance.map((record) => (
              <tr key={`${record.occurrenceId}:${record.studentId}`}>
                <td>{record.studentId}</td>
                <td>{record.occurrenceId}</td>
                <td>{record.minutes}</td>
                <td>{record.correctionReason ?? 'None'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
