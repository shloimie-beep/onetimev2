import React from 'react';
import type {
  ParentHouseholdSnapshot,
  ParentStudentRelationship,
  StudentCredentialHandoff,
} from '../../../../../../../packages/contracts/src/portals/parent-household/index.ts';
import { STUDENT_ACTUAL_NAME_INSTRUCTIONS } from '../../../../../../../packages/contracts/src/portals/parent-household/index.ts';

export function ParentHouseholdWorkspace({
  snapshot,
  relationship,
  credentialHandoff = null,
}: {
  snapshot: ParentHouseholdSnapshot;
  relationship: ParentStudentRelationship;
  credentialHandoff?: StudentCredentialHandoff | null;
}) {
  return (
    <section aria-labelledby="parent-household-heading">
      <h1 id="parent-household-heading">{snapshot.display_name}</h1>
      <p>
        {snapshot.active_student_count} of {snapshot.student_allowance} active Student seats used
      </p>
      {snapshot.can_manage_students ? (
        <a
          aria-disabled={snapshot.available_student_seats === 0}
          href={snapshot.available_student_seats === 0 ? undefined : '/app/parent/students/new'}
        >
          Add Student
        </a>
      ) : (
        <p role="status">Student management is unavailable while household access is inactive.</p>
      )}

      <h2>Who is this learner?</h2>
      <p>{STUDENT_ACTUAL_NAME_INSTRUCTIONS[relationship]}</p>

      <h2>Students</h2>
      {snapshot.students.length === 0 ? (
        <p>No Students yet.</p>
      ) : (
        <ul>
          {snapshot.students.map((student) => (
            <li key={student.student_id}>
              <a href={`/app/parent/students/${student.student_id}`}>
                {student.display_name ?? student.actual_name}
              </a>{' '}
              <span>{student.state}</span> <span>@{student.username}</span>
            </li>
          ))}
        </ul>
      )}

      {credentialHandoff === null ? null : (
        <section aria-labelledby="credential-handoff-heading">
          <h2 id="credential-handoff-heading">
            Save credentials for {credentialHandoff.student_label}
          </h2>
          <p>This password is shown only now. Copy or print it before leaving this page.</p>
          <dl>
            <dt>Username</dt>
            <dd>{credentialHandoff.username}</dd>
            <dt>New password</dt>
            <dd>{credentialHandoff.new_password}</dd>
          </dl>
          <p>Credentials are not emailed. You can reset them later.</p>
        </section>
      )}
    </section>
  );
}
