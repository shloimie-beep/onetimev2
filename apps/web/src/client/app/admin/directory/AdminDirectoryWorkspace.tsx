import React from 'react';
import type { AdminStudentRecord } from '../../../../../../../packages/contracts/src/admin/directory/index.ts';
import type {
  AdultIdentity,
  Household,
  HumanAccount,
} from '../../../../../../../packages/contracts/src/accounts/v21-household-identity.ts';
import {
  V21AppShell,
  V21StatePanel,
} from '../../../../../../../packages/brand-system/src/react-v21.tsx';
import {
  ADMIN_PRIMARY_NAVIGATION,
  type V21StateKind,
} from '../../../../../../../packages/brand-system/src/v21.ts';

export type AdminAdultDirectoryRow = {
  adult: AdultIdentity;
  account: HumanAccount;
  ownedHouseholdCount: number;
};

export function AdminDirectoryWorkspace(props: {
  adults: readonly AdminAdultDirectoryRow[];
  households: readonly Household[];
  students: readonly AdminStudentRecord[];
  state?: Exclude<V21StateKind, 'denied' | 'session-expired'>;
  safeMessage?: string;
  onNavigate: (href: string) => void;
  onCreate: (kind: 'admin' | 'parent' | 'household' | 'student') => void;
  onEdit: (kind: 'adult' | 'household' | 'student', id: string) => void;
  onTransition: (
    kind: 'adult' | 'household' | 'student',
    id: string,
    to: 'active' | 'archived',
  ) => void;
  onResetStudentCredential: (studentId: string) => void;
  onTransferOwnership: (householdId: string) => void;
}) {
  const navigation = ADMIN_PRIMARY_NAVIGATION.map((item) => ({
    ...item,
    current: item.id === 'contacts',
  }));
  const state = props.state;

  return (
    <V21AppShell
      role="admin"
      title="People and households"
      navigation={navigation}
      onNavigate={props.onNavigate}
    >
      <p>
        Manage adult access, household ownership, and Student credentials. All changes are recorded
        in the audit history.
      </p>
      {state ? (
        <V21StatePanel
          kind={state}
          title={state === 'empty' ? 'No directory records yet' : 'Directory needs attention'}
          action={
            state === 'empty' ? (
              <button type="button" onClick={() => props.onCreate('parent')}>
                Create first Parent
              </button>
            ) : undefined
          }
        >
          <p>{props.safeMessage ?? 'Try again. No changes were made.'}</p>
        </V21StatePanel>
      ) : (
        <>
          <section aria-labelledby="adult-directory-heading">
            <header>
              <h2 id="adult-directory-heading">Adults</h2>
              <div aria-label="Create adult account">
                <button type="button" onClick={() => props.onCreate('admin')}>
                  Create Admin
                </button>
                <button type="button" onClick={() => props.onCreate('parent')}>
                  Create Parent
                </button>
              </div>
            </header>
            <table>
              <caption>Adult contacts and exact runtime memberships</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Access</th>
                  <th scope="col">Households</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {props.adults.map(({ adult, account, ownedHouseholdCount }) => (
                  <tr key={adult.adultId}>
                    <th scope="row" dir="auto">
                      {adult.displayName}
                    </th>
                    <td dir="auto">{adult.normalizedEmail}</td>
                    <td>{account.memberships.join(', ')}</td>
                    <td>{ownedHouseholdCount}</td>
                    <td>{adult.state}</td>
                    <td>
                      <button type="button" onClick={() => props.onEdit('adult', adult.adultId)}>
                        Edit <span className="ot-v21__sr-only">{adult.displayName}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          props.onTransition(
                            'adult',
                            adult.adultId,
                            adult.state === 'active' ? 'archived' : 'active',
                          )
                        }
                      >
                        {adult.state === 'active' ? 'Archive' : 'Restore'}{' '}
                        <span className="ot-v21__sr-only">{adult.displayName}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section aria-labelledby="household-directory-heading">
            <header>
              <h2 id="household-directory-heading">Households</h2>
              <button type="button" onClick={() => props.onCreate('household')}>
                Create household
              </button>
            </header>
            <table>
              <caption>Household owners and Student capacity</caption>
              <thead>
                <tr>
                  <th scope="col">Household</th>
                  <th scope="col">Type</th>
                  <th scope="col">Student seats</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {props.households.map((household) => (
                  <tr key={household.householdId}>
                    <th scope="row" dir="auto">
                      {household.displayName}
                    </th>
                    <td>{household.classification}</td>
                    <td>
                      {household.activeSeatCount} of {household.seatLimit}
                    </td>
                    <td>{household.state}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => props.onEdit('household', household.householdId)}
                      >
                        Edit <span className="ot-v21__sr-only">{household.displayName}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => props.onTransferOwnership(household.householdId)}
                      >
                        Transfer ownership{' '}
                        <span className="ot-v21__sr-only">{household.displayName}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          props.onTransition(
                            'household',
                            household.householdId,
                            household.state === 'active' ? 'archived' : 'active',
                          )
                        }
                      >
                        {household.state === 'active' ? 'Archive' : 'Restore'}{' '}
                        <span className="ot-v21__sr-only">{household.displayName}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section aria-labelledby="student-directory-heading">
            <header>
              <h2 id="student-directory-heading">Students</h2>
              <button type="button" onClick={() => props.onCreate('student')}>
                Create Student
              </button>
            </header>
            <table>
              <caption>Student profiles and local sign-in usernames</caption>
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  <th scope="col">Username</th>
                  <th scope="col">Credential</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {props.students.map((student) => (
                  <tr key={student.studentId}>
                    <th scope="row" dir="auto">
                      {student.displayName}
                    </th>
                    <td dir="auto">{student.username}</td>
                    <td>{student.credentialState}</td>
                    <td>{student.state}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => props.onEdit('student', student.studentId)}
                      >
                        Edit <span className="ot-v21__sr-only">{student.displayName}</span>
                      </button>
                      <button
                        type="button"
                        disabled={student.state !== 'active'}
                        onClick={() => props.onResetStudentCredential(student.studentId)}
                      >
                        Reset password{' '}
                        <span className="ot-v21__sr-only">{student.displayName}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          props.onTransition(
                            'student',
                            student.studentId,
                            student.state === 'active' ? 'archived' : 'active',
                          )
                        }
                      >
                        {student.state === 'active' ? 'Archive' : 'Restore'}{' '}
                        <span className="ot-v21__sr-only">{student.displayName}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </V21AppShell>
  );
}
