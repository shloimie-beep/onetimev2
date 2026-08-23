import React, { useState } from 'react';
import type {
  AdminHouseholdRecord,
  AdminStudentRecord,
} from '../../../../../../../packages/contracts/src/admin/directory/index.ts';
import type {
  AdultIdentity,
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

export type DirectoryAction =
  | { kind: 'adult_transition'; id: string; label: string; to: 'active' | 'archived' }
  | { kind: 'household_transition'; id: string; label: string; to: 'active' | 'archived' }
  | { kind: 'student_transition'; id: string; label: string; to: 'active' | 'archived' }
  | { kind: 'credential_reset'; id: string; label: string }
  | { kind: 'ownership_transfer'; id: string; label: string };

export type DirectoryQuery = {
  search: string;
  kind: 'all' | 'adult' | 'household' | 'student';
  status: 'active' | 'archived' | 'all';
  sort: 'name_asc' | 'name_desc' | 'updated_desc';
  page: number;
};

const PAGE_SIZE = 10;

export function parseDirectoryQuery(url: string): DirectoryQuery {
  const parsed = new URL(url, 'https://directory.invalid');
  const kind = parsed.searchParams.get('kind');
  const status = parsed.searchParams.get('status');
  const sort = parsed.searchParams.get('sort');
  const page = Number(parsed.searchParams.get('page') ?? '1');
  return {
    search: (parsed.searchParams.get('q') ?? '').slice(0, 120),
    kind: kind === 'adult' || kind === 'household' || kind === 'student' ? kind : 'all',
    status: status === 'archived' || status === 'all' ? status : 'active',
    sort: sort === 'name_desc' || sort === 'updated_desc' ? sort : 'name_asc',
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}

export function directoryUrl(url: string, patch: Partial<DirectoryQuery>): string {
  const parsed = new URL(url, 'https://directory.invalid');
  const next = { ...parseDirectoryQuery(url), ...patch };
  parsed.searchParams.set('q', next.search);
  parsed.searchParams.set('kind', next.kind);
  parsed.searchParams.set('status', next.status);
  parsed.searchParams.set('sort', next.sort);
  parsed.searchParams.set('page', String(next.page));
  return `${parsed.pathname}?${parsed.searchParams.toString()}`;
}

export function directoryActionConsequence(action: DirectoryAction): string {
  if (action.kind === 'credential_reset') {
    return 'This replaces the Student credential and revokes every active session, classroom grant, and playback grant. The existing password is never displayed.';
  }
  if (action.kind === 'ownership_transfer') {
    return 'This changes the sole household owner and revokes affected sessions. Verify the replacement Parent before confirming.';
  }
  if (action.to === 'archived') {
    return 'Archiving revokes every affected active session and access grant. Access does not resume automatically.';
  }
  return 'Restoring this record does not independently grant household or classroom access.';
}

export function AdminDirectoryWorkspace(props: {
  url: string;
  adults: readonly AdminAdultDirectoryRow[];
  households: readonly AdminHouseholdRecord[];
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
  const [pendingAction, setPendingAction] = useState<DirectoryAction | null>(null);
  const navigation = ADMIN_PRIMARY_NAVIGATION.map((item) => ({
    ...item,
    current: item.id === 'contacts',
  }));
  const query = parseDirectoryQuery(props.url);
  const search = query.search.trim().toLocaleLowerCase('en-US');
  const matches = (values: readonly string[]) =>
    !search || values.some((value) => value.toLocaleLowerCase('en-US').includes(search));
  const statusMatches = (state: 'active' | 'archived') =>
    query.status === 'all' || state === query.status;
  const sortRows = <T,>(
    rows: readonly T[],
    label: (value: T) => string,
    updatedAt: (value: T) => string,
  ) =>
    [...rows].sort((left, right) => {
      if (query.sort === 'updated_desc') {
        return updatedAt(right).localeCompare(updatedAt(left));
      }
      const result = label(left).localeCompare(label(right), 'en', { sensitivity: 'base' });
      return query.sort === 'name_desc' ? -result : result;
    });
  const adults =
    query.kind === 'all' || query.kind === 'adult'
      ? sortRows(
          props.adults.filter(
            ({ adult }) =>
              statusMatches(adult.state) && matches([adult.displayName, adult.normalizedEmail]),
          ),
          ({ adult }) => adult.displayName,
          ({ adult }) => adult.updatedAt,
        )
      : [];
  const households =
    query.kind === 'all' || query.kind === 'household'
      ? sortRows(
          props.households.filter(
            (household) =>
              statusMatches(household.state) &&
              matches([household.displayName, household.householdId]),
          ),
          (household) => household.displayName,
          (household) => household.updatedAt,
        )
      : [];
  const students =
    query.kind === 'all' || query.kind === 'student'
      ? sortRows(
          props.students.filter(
            (student) =>
              statusMatches(student.state) && matches([student.displayName, student.username]),
          ),
          (student) => student.displayName,
          (student) => student.updatedAt,
        )
      : [];
  const rowCount = adults.length + households.length + students.length;
  const pageCount = Math.max(1, Math.ceil(rowCount / PAGE_SIZE));
  const page = Math.min(query.page, pageCount);
  let offset = (page - 1) * PAGE_SIZE;
  const takePage = <T,>(rows: readonly T[]) => {
    const result = rows.slice(Math.max(0, offset), Math.max(0, offset) + PAGE_SIZE);
    offset -= rows.length;
    return result;
  };
  const pagedAdults = takePage(adults);
  const pagedHouseholds = takePage(households);
  const pagedStudents = takePage(students);
  const parentNameByAdultId = new Map(
    props.adults.map(({ adult }) => [adult.adultId, adult.displayName]),
  );

  const updateQuery = (patch: Partial<DirectoryQuery>) =>
    props.onNavigate(directoryUrl(props.url, { ...patch, page: patch.page ?? 1 }));
  const confirm = () => {
    if (!pendingAction) return;
    if (pendingAction.kind === 'credential_reset') {
      props.onResetStudentCredential(pendingAction.id);
    } else if (pendingAction.kind === 'ownership_transfer') {
      props.onTransferOwnership(pendingAction.id);
    } else {
      props.onTransition(
        pendingAction.kind.replace('_transition', '') as 'adult' | 'household' | 'student',
        pendingAction.id,
        pendingAction.to,
      );
    }
    setPendingAction(null);
  };

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
      <form role="search" onSubmit={(event) => event.preventDefault()}>
        <label>
          Search directory
          <input
            type="search"
            value={query.search}
            onChange={(event) => updateQuery({ search: event.currentTarget.value })}
          />
        </label>
        <label>
          Record type
          <select
            value={query.kind}
            onChange={(event) =>
              updateQuery({ kind: event.currentTarget.value as DirectoryQuery['kind'] })
            }
          >
            <option value="all">All records</option>
            <option value="adult">Adults</option>
            <option value="household">Households</option>
            <option value="student">Students</option>
          </select>
        </label>
        <label>
          Visibility
          <select
            value={query.status}
            onChange={(event) =>
              updateQuery({ status: event.currentTarget.value as DirectoryQuery['status'] })
            }
          >
            <option value="active">Active only</option>
            <option value="archived">Archived only</option>
            <option value="all">Active and archived</option>
          </select>
        </label>
        <label>
          Sort
          <select
            value={query.sort}
            onChange={(event) =>
              updateQuery({ sort: event.currentTarget.value as DirectoryQuery['sort'] })
            }
          >
            <option value="name_asc">Name A–Z</option>
            <option value="name_desc">Name Z–A</option>
            <option value="updated_desc">Recently updated</option>
          </select>
        </label>
      </form>

      {props.state ? (
        <V21StatePanel
          kind={props.state}
          title={props.state === 'empty' ? 'No directory records yet' : 'Directory needs attention'}
          action={
            props.state === 'empty' ? (
              <button type="button" onClick={() => props.onCreate('parent')}>
                Create first Parent
              </button>
            ) : undefined
          }
        >
          <p>{props.safeMessage ?? 'Try again. No changes were made.'}</p>
        </V21StatePanel>
      ) : rowCount === 0 ? (
        <V21StatePanel kind="empty" title="No matching directory records">
          <p>Change the URL-backed search or filters. No records were modified.</p>
        </V21StatePanel>
      ) : (
        <>
          {query.kind === 'all' || query.kind === 'adult' ? (
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
                  {pagedAdults.map(({ adult, account, ownedHouseholdCount }) => (
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
                            setPendingAction({
                              kind: 'adult_transition',
                              id: adult.adultId,
                              label: adult.displayName,
                              to: adult.state === 'active' ? 'archived' : 'active',
                            })
                          }
                        >
                          Review {adult.state === 'active' ? 'archive' : 'restore'}{' '}
                          <span className="ot-v21__sr-only">{adult.displayName}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          {query.kind === 'all' || query.kind === 'household' ? (
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
                    <th scope="col">Parent</th>
                    <th scope="col">Type</th>
                    <th scope="col">Student seats</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedHouseholds.map((household) => (
                    <tr key={household.householdId}>
                      <th scope="row" dir="auto">
                        <button
                          type="button"
                          className="admin-directory__record-link"
                          onClick={() => props.onEdit('household', household.householdId)}
                        >
                          {household.displayName}
                        </button>
                      </th>
                      <td dir="auto">
                        {parentNameByAdultId.get(household.ownerAdultId) ?? 'Parent unavailable'}
                      </td>
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
                          onClick={() =>
                            setPendingAction({
                              kind: 'ownership_transfer',
                              id: household.householdId,
                              label: household.displayName,
                            })
                          }
                        >
                          Review ownership transfer{' '}
                          <span className="ot-v21__sr-only">{household.displayName}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingAction({
                              kind: 'household_transition',
                              id: household.householdId,
                              label: household.displayName,
                              to: household.state === 'active' ? 'archived' : 'active',
                            })
                          }
                        >
                          Review {household.state === 'active' ? 'archive' : 'restore'}{' '}
                          <span className="ot-v21__sr-only">{household.displayName}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          {query.kind === 'all' || query.kind === 'student' ? (
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
                  {pagedStudents.map((student) => (
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
                          onClick={() =>
                            setPendingAction({
                              kind: 'credential_reset',
                              id: student.studentId,
                              label: student.displayName,
                            })
                          }
                        >
                          Review password reset{' '}
                          <span className="ot-v21__sr-only">{student.displayName}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingAction({
                              kind: 'student_transition',
                              id: student.studentId,
                              label: student.displayName,
                              to: student.state === 'active' ? 'archived' : 'active',
                            })
                          }
                        >
                          Review {student.state === 'active' ? 'archive' : 'restore'}{' '}
                          <span className="ot-v21__sr-only">{student.displayName}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          <nav aria-label="Directory pages">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => updateQuery({ page: page - 1 })}
            >
              Previous page
            </button>
            <span>
              Page {page} of {pageCount}
            </span>
            <button
              type="button"
              disabled={page >= pageCount}
              onClick={() => updateQuery({ page: page + 1 })}
            >
              Next page
            </button>
          </nav>
        </>
      )}

      {pendingAction ? (
        <section role="dialog" aria-modal="true" aria-labelledby="directory-confirm-title">
          <h2 id="directory-confirm-title">
            Confirm action for <span dir="auto">{pendingAction.label}</span>
          </h2>
          <p>{directoryActionConsequence(pendingAction)}</p>
          <button type="button" onClick={confirm}>
            Confirm consequence and continue
          </button>
          <button type="button" onClick={() => setPendingAction(null)}>
            Cancel
          </button>
        </section>
      ) : null}
    </V21AppShell>
  );
}
