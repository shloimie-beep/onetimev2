import React from 'react';
import type { StudentAccountControls } from '../../../../../../../packages/contracts/src/portals/student/index.ts';

export function StudentAccount({
  account,
  onLogout,
}: {
  account: StudentAccountControls;
  onLogout: () => void;
}) {
  return (
    <section className="ot-student-account" aria-labelledby="ot-student-account-title">
      <h2 id="ot-student-account-title">Account</h2>
      <dl>
        <dt>Username</dt>
        <dd>{account.username}</dd>
        <dt>Password help</dt>
        <dd>{account.credentialHelp}</dd>
      </dl>
      <p>Your account owner or an Admin manages Student passwords.</p>
      <button type="button" onClick={onLogout}>
        Log out
      </button>
    </section>
  );
}
