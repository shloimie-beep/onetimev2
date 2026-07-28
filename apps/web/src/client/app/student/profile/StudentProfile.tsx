import React from 'react';
import type { StudentSelfProfile } from '../../../../../../../packages/contracts/src/portals/student/index.ts';

export function StudentProfile({ profile }: { profile: StudentSelfProfile }) {
  return (
    <section className="ot-student-profile" aria-labelledby="ot-student-profile-title">
      <h2 id="ot-student-profile-title">My profile</h2>
      <dl>
        <dt>Name</dt>
        <dd dir="auto">{profile.actualName}</dd>
        <dt>Display name</dt>
        <dd dir="auto">{profile.displayName}</dd>
        <dt>Username</dt>
        <dd>{profile.username}</dd>
      </dl>
    </section>
  );
}
