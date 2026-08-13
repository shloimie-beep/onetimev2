import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Select,
  StatusChip,
  Table,
} from '@onetime/brand-system/react';
import {
  AdminDirectoryRequestError,
  attachAdminGuardian,
  createAdminHousehold,
  createAdminLearner,
  inviteAdminUser,
  listAdminAuditHistory,
  listAdminHouseholds,
  listAdminLearners,
  listAdminUsers,
  requestAdminUserPasswordReset,
  setAdminHouseholdStatus,
  setAdminLearnerStatus,
  setAdminUserStatus,
  updateAdminHousehold,
  updateAdminLearner,
  updateAdminUser,
  type AdminAuditEvent,
  type AdminHousehold,
  type AdminLearner,
  type AdminUser,
} from './api.js';

export type AdminDirectoryMode = 'households' | 'users' | 'learners' | 'audit';

export function AdminDirectoryPanel({
  mode,
  csrfToken,
  selectedRecordId,
  onSessionExpired,
}: {
  mode: AdminDirectoryMode;
  csrfToken: string;
  selectedRecordId?: string | null | undefined;
  onSessionExpired: () => void;
}) {
  const [households, setHouseholds] = useState<AdminHousehold[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [learners, setLearners] = useState<AdminLearner[]>([]);
  const [auditEvents, setAuditEvents] = useState<AdminAuditEvent[]>([]);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedLearner, setSelectedLearner] = useState<AdminLearner | null>(null);
  const [form, setForm] = useState<
    | { kind: 'household'; record: AdminHousehold | null }
    | { kind: 'guardian'; record: AdminHousehold }
    | { kind: 'user'; record: AdminUser | null }
    | { kind: 'learner'; record: AdminLearner | null }
    | null
  >(null);

  useEffect(() => {
    setForm(null);
    setSelectedUser(null);
    setSelectedLearner(null);
    setSearch('');
    setSearchDraft('');
    setStatus('');
    void refresh('', '');
  }, [mode, selectedRecordId]);

  async function refresh(nextSearch = search, nextStatus = status) {
    setLoading(true);
    setError('');
    try {
      if (mode === 'households') {
        const [householdResult, userResult] = await Promise.all([
          listAdminHouseholds(nextSearch, nextStatus),
          listAdminUsers('', 'active'),
        ]);
        setHouseholds(householdResult.households);
        setUsers(userResult.users);
      } else if (mode === 'users') {
        const [userResult, householdResult] = await Promise.all([
          listAdminUsers(nextSearch, nextStatus),
          listAdminHouseholds('', 'active'),
        ]);
        setUsers(userResult.users);
        setHouseholds(householdResult.households);
        if (selectedRecordId) {
          const selected = userResult.users.find((user) => user.user_key === selectedRecordId);
          setSelectedUser(selected ?? null);
          if (!selected) {
            setError('The user record was not found or is no longer available.');
          }
        } else {
          setSelectedUser(null);
        }
      } else if (mode === 'learners') {
        const [learnerResult, householdResult] = await Promise.all([
          listAdminLearners(nextSearch, nextStatus),
          listAdminHouseholds('', 'active'),
        ]);
        setLearners(learnerResult.learners);
        setHouseholds(householdResult.households);
        if (selectedRecordId) {
          const selected = learnerResult.learners.find(
            (learner) => learner.learner_key === selectedRecordId,
          );
          setSelectedLearner(selected ?? null);
          if (!selected) {
            setError('The Student record was not found or is no longer available.');
          }
        } else {
          setSelectedLearner(null);
        }
      } else {
        const result = await listAdminAuditHistory(nextSearch);
        setAuditEvents(result.events);
      }
    } catch (caught) {
      if (handleSession(caught, onSessionExpired)) return;
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  async function runMutation(action: () => Promise<unknown>, message: string) {
    setError('');
    setNotice('');
    try {
      await action();
      setForm(null);
      setNotice(message);
      await refresh();
    } catch (caught) {
      if (handleSession(caught, onSessionExpired)) return;
      setError(errorMessage(caught));
    }
  }

  function changeLearnerStatus(record: AdminLearner, action: 'archive' | 'restore') {
    if (
      action === 'archive' &&
      !window.confirm(
        `Archive ${record.display_name}? Student access and active sessions will be disabled.`,
      )
    ) {
      return;
    }
    void runMutation(
      () => setAdminLearnerStatus(csrfToken, record, action),
      action === 'archive'
        ? 'Learner archived; the household seat is now available.'
        : 'Learner restored. Student access remains separately controlled.',
    );
  }

  function changeUserStatus(record: AdminUser, action: 'disable' | 'reactivate') {
    if (
      action === 'disable' &&
      !window.confirm(`Disable ${record.display_name}? Their active sessions will be revoked.`)
    ) {
      return;
    }
    void runMutation(
      () => setAdminUserStatus(csrfToken, record, action),
      action === 'disable' ? 'User disabled.' : 'User reactivated.',
    );
  }

  function requestUserReset(record: AdminUser) {
    const student = record.role === 'student';
    void runMutation(
      () => requestAdminUserPasswordReset(csrfToken, record.user_key, createRequestKey()),
      student
        ? 'A secure six-digit Student PIN reset was requested for delivery to the adult Parent.'
        : 'Single-use password reset created in the protected delivery sink.',
    );
  }

  const parentUsers = useMemo(
    () => users.filter((user) => user.role === 'parent' && user.status === 'active'),
    [users],
  );

  const title = selectedUser
    ? 'User details'
    : selectedLearner
      ? 'Student details'
      : mode === 'households'
        ? 'Households'
        : mode === 'users'
          ? 'Users and roles'
          : mode === 'learners'
            ? 'Learners'
            : 'Audit history';

  return (
    <section className="admin-directory" aria-labelledby={`admin-directory-${mode}-title`}>
      <div className="admin-directory__heading">
        <div>
          <h2 id={`admin-directory-${mode}-title`}>{title}</h2>
          <p>{descriptionFor(mode)}</p>
        </div>
        {selectedUser ? (
          <Button type="button" onClick={() => window.location.assign('/app/users')}>
            Back to Users
          </Button>
        ) : selectedLearner ? (
          <Button type="button" onClick={() => window.location.assign('/app/students')}>
            Back to Students
          </Button>
        ) : mode !== 'audit' ? (
          <Button
            type="button"
            variant="primary"
            onClick={() => window.location.assign('/app/crm/contact-operations')}
          >
            {mode === 'households'
              ? 'Add household'
              : mode === 'users'
                ? 'Create account setup'
                : 'Add learner'}
          </Button>
        ) : null}
      </div>

      <form
        className="admin-directory__filters"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(searchDraft.trim());
          void refresh(searchDraft.trim(), status);
        }}
      >
        <label>
          <span>Search</span>
          <Input
            type="search"
            value={searchDraft}
            placeholder={`Search ${title.toLowerCase()}`}
            onChange={(event) => setSearchDraft(event.target.value)}
          />
        </label>
        {mode !== 'audit' && (
          <label>
            <span>Status</span>
            <Select
              value={status}
              onChange={(event) => {
                const next = event.target.value;
                setStatus(next);
                void refresh(search, next);
              }}
            >
              <option value="">All statuses</option>
              {statusOptions(mode).map((option) => (
                <option key={option} value={option}>
                  {readable(option)}
                </option>
              ))}
            </Select>
          </label>
        )}
        <Button type="submit">Apply</Button>
        {(search || status) && (
          <Button
            type="button"
            variant="text"
            onClick={() => {
              setSearch('');
              setSearchDraft('');
              setStatus('');
              void refresh('', '');
            }}
          >
            Clear
          </Button>
        )}
      </form>

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && (
        <ErrorState
          title={`${title} action could not be completed`}
          body={error}
          action={
            <Button type="button" onClick={() => void refresh()}>
              Reload
            </Button>
          }
        />
      )}

      {form?.kind === 'household' && (
        <HouseholdForm
          record={form.record}
          onCancel={() => setForm(null)}
          onSave={(payload) =>
            runMutation(
              () =>
                form.record
                  ? updateAdminHousehold(csrfToken, form.record.household_key, {
                      display_name: payload.displayName,
                      version: form.record.version,
                    })
                  : createAdminHousehold(csrfToken, {
                      display_name: payload.displayName,
                      idempotency_key: createRequestKey(),
                    }),
              form.record ? 'Household updated.' : 'Household created.',
            )
          }
        />
      )}
      {form?.kind === 'guardian' && (
        <GuardianForm
          household={form.record}
          parents={parentUsers}
          onCancel={() => setForm(null)}
          onSave={(payload) =>
            runMutation(
              () => attachAdminGuardian(csrfToken, form.record.household_key, payload),
              'Parent attached to the household.',
            )
          }
        />
      )}
      {form?.kind === 'user' && (
        <UserForm
          record={form.record}
          households={households}
          onCancel={() => setForm(null)}
          onSave={(payload) =>
            runMutation(
              () =>
                form.record
                  ? updateAdminUser(csrfToken, form.record.user_key, {
                      display_name: payload.displayName,
                      role: payload.role,
                      version: form.record.version,
                    })
                  : inviteAdminUser(csrfToken, {
                      display_name: payload.displayName,
                      email: payload.email,
                      role: payload.role,
                      ...(payload.role === 'parent' ? { household_key: payload.householdKey } : {}),
                      relationship_label: payload.relationshipLabel,
                      authority: payload.authority,
                      idempotency_key: createRequestKey(),
                    }),
              form.record
                ? 'User and role updated. Existing sessions were revoked.'
                : 'Single-use account setup created in the protected delivery sink.',
            )
          }
        />
      )}
      {form?.kind === 'learner' && (
        <LearnerForm
          record={form.record}
          households={households}
          onCancel={() => setForm(null)}
          onSave={(payload) =>
            runMutation(
              () =>
                form.record
                  ? updateAdminLearner(csrfToken, form.record.learner_key, {
                      display_name: payload.displayName,
                      hebrew_name: payload.hebrewName || null,
                      grade_label: payload.gradeLabel || null,
                      version: form.record.version,
                    })
                  : createAdminLearner(csrfToken, {
                      household_key: payload.householdKey,
                      display_name: payload.displayName,
                      hebrew_name: payload.hebrewName || null,
                      grade_label: payload.gradeLabel || null,
                      idempotency_key: createRequestKey(),
                    }),
              form.record ? 'Learner updated.' : 'Learner added.',
            )
          }
        />
      )}
      {loading && <LoadingState label={`Loading ${title.toLowerCase()}`} />}
      {!loading && !error && !form && mode === 'households' && (
        <HouseholdList
          households={households}
          onEdit={(record) => setForm({ kind: 'household', record })}
          onGuardian={(record) => setForm({ kind: 'guardian', record })}
          onStatus={(record, action) => {
            if (
              action === 'archive' &&
              !window.confirm(
                `Archive ${record.display_name}? The server will refuse while active learners or guardians remain.`,
              )
            ) {
              return;
            }
            void runMutation(
              () => setAdminHouseholdStatus(csrfToken, record, action),
              action === 'archive' ? 'Household archived.' : 'Household restored.',
            );
          }}
        />
      )}
      {!loading &&
        !error &&
        !form &&
        mode === 'users' &&
        (selectedUser ? (
          <UserDetail
            record={selectedUser}
            onEdit={(record) => setForm({ kind: 'user', record })}
            onReset={requestUserReset}
            onStatus={changeUserStatus}
          />
        ) : (
          <UserList
            users={users}
            onEdit={(record) => setForm({ kind: 'user', record })}
            onReset={requestUserReset}
            onStatus={changeUserStatus}
          />
        ))}
      {!loading &&
        !error &&
        !form &&
        mode === 'learners' &&
        (selectedLearner ? (
          <LearnerDetail
            record={selectedLearner}
            onEdit={(record) => setForm({ kind: 'learner', record })}
            onStatus={changeLearnerStatus}
          />
        ) : (
          <LearnerList
            learners={learners}
            onEdit={(record) => setForm({ kind: 'learner', record })}
            onStatus={changeLearnerStatus}
          />
        ))}
      {!loading && !error && !form && mode === 'audit' && <AuditList events={auditEvents} />}
    </section>
  );
}

function AuditList({ events }: { events: AdminAuditEvent[] }) {
  if (!events.length) {
    return <EmptyState title="No audit events found" body="Completed Admin actions appear here." />;
  }
  return (
    <DirectoryTable
      headings={['When', 'Action', 'Actor', 'Subject', 'Details']}
      rows={events.map((event) => [
        formatDate(event.created_at),
        readable(event.action),
        `${event.actor_label} (${readable(event.actor_role)})`,
        event.subject_key
          ? `${readable(event.subject_type)} · ${event.subject_key}`
          : readable(event.subject_type),
        auditDetails(event.metadata),
      ])}
    />
  );
}

export function HouseholdList({
  households,
  onEdit,
  onGuardian,
  onStatus,
}: {
  households: AdminHousehold[];
  onEdit: (record: AdminHousehold) => void;
  onGuardian: (record: AdminHousehold) => void;
  onStatus: (record: AdminHousehold, action: 'archive' | 'restore') => void;
}) {
  if (!households.length) {
    return (
      <EmptyState
        title="No households found"
        body="Create a household to add guardians and learners."
      />
    );
  }
  return (
    <DirectoryTable
      headings={['Household', 'Parent name', 'Learners', 'Guardians', 'Access', 'Setup', 'Actions']}
      rows={households.map((record) => [
        <RecordTitle
          key="title"
          title={record.display_name}
          status={record.status}
          onOpen={() => onEdit(record)}
        />,
        record.parent_name ?? '—',
        `${record.active_learner_count} active / ${record.learner_count} total`,
        String(record.guardian_count),
        <Status key="access" value={record.access_state} />,
        <Status key="setup" value={record.setup_state} />,
        <ActionGroup key="actions">
          <Button type="button" variant="text" onClick={() => onEdit(record)}>
            Edit
          </Button>
          {record.status === 'active' && (
            <Button type="button" variant="text" onClick={() => onGuardian(record)}>
              Attach Parent
            </Button>
          )}
          <Button
            type="button"
            variant={record.status === 'active' ? 'danger' : 'secondary'}
            onClick={() => onStatus(record, record.status === 'active' ? 'archive' : 'restore')}
          >
            {record.status === 'active' ? 'Archive' : 'Restore'}
          </Button>
        </ActionGroup>,
      ])}
    />
  );
}

function UserList({
  users,
  onEdit,
  onReset,
  onStatus,
}: {
  users: AdminUser[];
  onEdit: (record: AdminUser) => void;
  onReset: (record: AdminUser) => void;
  onStatus: (record: AdminUser, action: 'disable' | 'reactivate') => void;
}) {
  if (!users.length) {
    return (
      <EmptyState
        title="No users found"
        body="Create secure account setup for an Administrator or Parent."
      />
    );
  }
  return (
    <DirectoryTable
      headings={['Person', 'Role', 'Account', 'Household', 'Last login', 'Actions']}
      rows={users.map((record) => {
        const pending = record.status === 'pending_setup' || record.status === 'expired_setup';
        return [
          <RecordTitle
            key="title"
            title={record.display_name}
            subtitle={record.email}
            status={record.status}
            href={`/app/users/${encodeURIComponent(record.user_key)}`}
          />,
          readable(record.role),
          <Status key="account" value={record.status} />,
          record.household_name ?? 'Not attached',
          record.last_successful_login_at ? formatDate(record.last_successful_login_at) : 'Never',
          pending ? (
            <span key="pending">
              {record.setup_expires_at
                ? `Setup ${record.status === 'expired_setup' ? 'expired' : 'expires'} ${formatDate(
                    record.setup_expires_at,
                  )}`
                : readable(record.status)}
            </span>
          ) : (
            <ActionGroup key="actions">
              {!['owner', 'student'].includes(record.role) && (
                <Button type="button" variant="text" onClick={() => onEdit(record)}>
                  Edit role
                </Button>
              )}
              <Button type="button" variant="text" onClick={() => onReset(record)}>
                {record.role === 'student' ? 'Reset Student PIN' : 'Reset password'}
              </Button>
              {!['owner'].includes(record.role) && (
                <Button
                  type="button"
                  variant={record.status === 'active' ? 'danger' : 'secondary'}
                  onClick={() =>
                    onStatus(record, record.status === 'active' ? 'disable' : 'reactivate')
                  }
                >
                  {record.status === 'active' ? 'Disable' : 'Reactivate'}
                </Button>
              )}
            </ActionGroup>
          ),
        ];
      })}
    />
  );
}

function UserDetail({
  record,
  onEdit,
  onReset,
  onStatus,
}: {
  record: AdminUser;
  onEdit: (record: AdminUser) => void;
  onReset: (record: AdminUser) => void;
  onStatus: (record: AdminUser, action: 'disable' | 'reactivate') => void;
}) {
  const pending = record.status === 'pending_setup' || record.status === 'expired_setup';
  return (
    <Card className="admin-directory__form-card" aria-labelledby="user-detail-heading">
      <div className="admin-directory__heading">
        <div>
          <h3 id="user-detail-heading">{record.display_name}</h3>
          <p>Private account identity, role, household association, and access status.</p>
        </div>
        <Status value={record.status} />
      </div>
      <dl className="admin-directory__detail-facts">
        <div>
          <dt>Email</dt>
          <dd>{record.email}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>{readable(record.role)}</dd>
        </div>
        <div>
          <dt>Household</dt>
          <dd>{record.household_name ?? 'Not attached'}</dd>
        </div>
        <div>
          <dt>Relationship</dt>
          <dd>{record.relationship_label ?? 'Not recorded'}</dd>
        </div>
        <div>
          <dt>Last successful login</dt>
          <dd>
            {record.last_successful_login_at
              ? formatDate(record.last_successful_login_at)
              : 'Never'}
          </dd>
        </div>
        <div>
          <dt>Account setup</dt>
          <dd>
            {record.setup_expires_at
              ? `${record.status === 'expired_setup' ? 'Expired' : 'Expires'} ${formatDate(
                  record.setup_expires_at,
                )}`
              : 'Complete'}
          </dd>
        </div>
      </dl>
      {!pending && (
        <ActionGroup>
          {!['owner', 'student'].includes(record.role) && (
            <Button type="button" variant="text" onClick={() => onEdit(record)}>
              Edit role
            </Button>
          )}
          <Button type="button" variant="text" onClick={() => onReset(record)}>
            {record.role === 'student' ? 'Reset Student PIN' : 'Reset password'}
          </Button>
          {record.role !== 'owner' && (
            <Button
              type="button"
              variant={record.status === 'active' ? 'danger' : 'secondary'}
              onClick={() =>
                onStatus(record, record.status === 'active' ? 'disable' : 'reactivate')
              }
            >
              {record.status === 'active' ? 'Disable' : 'Reactivate'}
            </Button>
          )}
        </ActionGroup>
      )}
    </Card>
  );
}

function LearnerList({
  learners,
  onEdit,
  onStatus,
}: {
  learners: AdminLearner[];
  onEdit: (record: AdminLearner) => void;
  onStatus: (record: AdminLearner, action: 'archive' | 'restore') => void;
}) {
  if (!learners.length) {
    return <EmptyState title="No learners found" body="Add a learner to an active household." />;
  }
  return (
    <DirectoryTable
      headings={['Learner', 'Household', 'Student access', 'Classes', 'Updated', 'Actions']}
      rows={learners.map((record) => [
        <RecordTitle
          key="title"
          title={record.display_name}
          subtitle={[record.hebrew_name, record.grade_label].filter(Boolean).join(' · ')}
          status={record.learner_status}
          href={`/app/students/${encodeURIComponent(record.learner_key)}`}
        />,
        record.household_name,
        <Status key="access" value={record.student_access_status} />,
        String(record.enrollment_count),
        formatDate(record.updated_at),
        <ActionGroup key="actions">
          <Button type="button" variant="text" onClick={() => onEdit(record)}>
            Edit
          </Button>
          <Button
            type="button"
            variant={record.learner_status === 'active' ? 'danger' : 'secondary'}
            onClick={() =>
              onStatus(record, record.learner_status === 'active' ? 'archive' : 'restore')
            }
          >
            {record.learner_status === 'active' ? 'Archive' : 'Restore'}
          </Button>
        </ActionGroup>,
      ])}
    />
  );
}

function LearnerDetail({
  record,
  onEdit,
  onStatus,
}: {
  record: AdminLearner;
  onEdit: (record: AdminLearner) => void;
  onStatus: (record: AdminLearner, action: 'archive' | 'restore') => void;
}) {
  return (
    <Card className="admin-directory__form-card" aria-labelledby="student-detail-heading">
      <div className="admin-directory__heading">
        <div>
          <h3 id="student-detail-heading">{record.display_name}</h3>
          <p>Local Student identity, household membership, credentials, and class enrollment.</p>
        </div>
        <Status value={record.learner_status} />
      </div>
      <dl className="admin-directory__detail-facts">
        <div>
          <dt>Household</dt>
          <dd>{record.household_name}</dd>
        </div>
        <div>
          <dt>Hebrew name</dt>
          <dd>{record.hebrew_name || 'Not recorded'}</dd>
        </div>
        <div>
          <dt>Grade</dt>
          <dd>{record.grade_label || 'Not recorded'}</dd>
        </div>
        <div>
          <dt>Student access</dt>
          <dd>
            <Status value={record.student_access_status} />
          </dd>
        </div>
        <div>
          <dt>Active classes</dt>
          <dd>{record.enrollment_count}</dd>
        </div>
        <div>
          <dt>Last updated</dt>
          <dd>{formatDate(record.updated_at)}</dd>
        </div>
      </dl>
      <ActionGroup>
        <Button type="button" variant="text" onClick={() => onEdit(record)}>
          Edit Student
        </Button>
        <Button
          type="button"
          variant={record.learner_status === 'active' ? 'danger' : 'secondary'}
          onClick={() =>
            onStatus(record, record.learner_status === 'active' ? 'archive' : 'restore')
          }
        >
          {record.learner_status === 'active' ? 'Archive' : 'Restore'}
        </Button>
      </ActionGroup>
    </Card>
  );
}

export function HouseholdForm({
  record,
  onCancel,
  onSave,
}: {
  record: AdminHousehold | null;
  onCancel: () => void;
  onSave: (payload: { displayName: string }) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(record?.display_name ?? '');
  return (
    <DirectoryForm
      title={record ? 'Edit household' : 'Add household'}
      onCancel={onCancel}
      onSubmit={() => onSave({ displayName })}
    >
      {record && (
        <dl className="admin-directory__detail-facts" aria-label="Household details">
          <div>
            <dt>Parent</dt>
            <dd>{record.parent_name ?? 'No active Parent attached'}</dd>
          </div>
          <div>
            <dt>Learners</dt>
            <dd>{`${record.active_learner_count} active / ${record.learner_count} total`}</dd>
          </div>
          <div>
            <dt>Guardians</dt>
            <dd>{record.guardian_count}</dd>
          </div>
          <div>
            <dt>Access</dt>
            <dd>{readable(record.access_state)}</dd>
          </div>
          <div>
            <dt>Setup</dt>
            <dd>{readable(record.setup_state)}</dd>
          </div>
        </dl>
      )}
      <label>
        <span>Household name</span>
        <Input
          required
          minLength={2}
          maxLength={180}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </label>
    </DirectoryForm>
  );
}

function GuardianForm({
  household,
  parents,
  onCancel,
  onSave,
}: {
  household: AdminHousehold;
  parents: AdminUser[];
  onCancel: () => void;
  onSave: (payload: {
    user_key: string;
    relationship_label: string;
    authority: 'primary_guardian' | 'guardian' | 'support_only';
  }) => Promise<void>;
}) {
  const [userKey, setUserKey] = useState('');
  const [label, setLabel] = useState('Parent');
  const [authority, setAuthority] = useState<'primary_guardian' | 'guardian' | 'support_only'>(
    'guardian',
  );
  return (
    <DirectoryForm
      title={`Attach Parent to ${household.display_name}`}
      onCancel={onCancel}
      onSubmit={() => onSave({ user_key: userKey, relationship_label: label, authority })}
    >
      <label>
        <span>Active Parent account</span>
        <Select required value={userKey} onChange={(event) => setUserKey(event.target.value)}>
          <option value="">Choose Parent</option>
          {parents.map((parent) => (
            <option key={parent.user_key} value={parent.user_key}>
              {parent.display_name} — {parent.email}
            </option>
          ))}
        </Select>
      </label>
      <label>
        <span>Relationship label</span>
        <Input
          required
          maxLength={80}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
      </label>
      <label>
        <span>Authority</span>
        <Select
          value={authority}
          onChange={(event) =>
            setAuthority(event.target.value as 'primary_guardian' | 'guardian' | 'support_only')
          }
        >
          <option value="primary_guardian">Primary guardian</option>
          <option value="guardian">Guardian</option>
          <option value="support_only">Support only</option>
        </Select>
      </label>
    </DirectoryForm>
  );
}

function UserForm({
  record,
  households,
  onCancel,
  onSave,
}: {
  record: AdminUser | null;
  households: AdminHousehold[];
  onCancel: () => void;
  onSave: (payload: {
    displayName: string;
    email: string;
    role: 'admin' | 'rabbi' | 'parent';
    householdKey: string;
    relationshipLabel: string;
    authority: 'primary_guardian' | 'guardian';
  }) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(record?.display_name ?? '');
  const [email, setEmail] = useState(record?.email ?? '');
  const [role, setRole] = useState<'admin' | 'rabbi' | 'parent'>(
    record?.role === 'parent' ? 'parent' : record?.role === 'rabbi' ? 'rabbi' : 'admin',
  );
  const [householdKey, setHouseholdKey] = useState(record?.household_key ?? '');
  const [relationshipLabel, setRelationshipLabel] = useState(
    record?.relationship_label ?? 'Parent',
  );
  const [authority, setAuthority] = useState<'primary_guardian' | 'guardian'>('guardian');
  return (
    <DirectoryForm
      title={record ? 'Edit user and role' : 'Create secure account setup'}
      onCancel={onCancel}
      onSubmit={() =>
        onSave({
          displayName,
          email,
          role,
          householdKey,
          relationshipLabel,
          authority,
        })
      }
    >
      <label>
        <span>Display name</span>
        <Input
          required
          minLength={2}
          maxLength={180}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </label>
      <label>
        <span>Email</span>
        <Input
          required
          disabled={Boolean(record)}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label>
        <span>Role</span>
        <Select
          value={role}
          onChange={(event) => setRole(event.target.value as 'admin' | 'rabbi' | 'parent')}
        >
          <option value="admin">Administrator</option>
          <option value="rabbi">Rabbi</option>
          <option value="parent">Parent</option>
        </Select>
      </label>
      {role === 'parent' && !record && (
        <>
          <label>
            <span>Household</span>
            <Select
              required
              value={householdKey}
              onChange={(event) => setHouseholdKey(event.target.value)}
            >
              <option value="">Choose household</option>
              {households.map((household) => (
                <option key={household.household_key} value={household.household_key}>
                  {household.display_name}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <span>Relationship label</span>
            <Input
              required
              value={relationshipLabel}
              onChange={(event) => setRelationshipLabel(event.target.value)}
            />
          </label>
          <label>
            <span>Authority</span>
            <Select
              value={authority}
              onChange={(event) =>
                setAuthority(event.target.value as 'primary_guardian' | 'guardian')
              }
            >
              <option value="primary_guardian">Primary guardian</option>
              <option value="guardian">Guardian</option>
            </Select>
          </label>
        </>
      )}
      {!record && (
        <p className="admin-directory__form-note">
          A single-use setup token is queued to the protected delivery sink. No password is
          displayed or stored in this form.
        </p>
      )}
    </DirectoryForm>
  );
}

function LearnerForm({
  record,
  households,
  onCancel,
  onSave,
}: {
  record: AdminLearner | null;
  households: AdminHousehold[];
  onCancel: () => void;
  onSave: (payload: {
    householdKey: string;
    displayName: string;
    hebrewName: string;
    gradeLabel: string;
  }) => Promise<void>;
}) {
  const [householdKey, setHouseholdKey] = useState(record?.household_key ?? '');
  const [displayName, setDisplayName] = useState(record?.display_name ?? '');
  const [hebrewName, setHebrewName] = useState(record?.hebrew_name ?? '');
  const [gradeLabel, setGradeLabel] = useState(record?.grade_label ?? '');
  return (
    <DirectoryForm
      title={record ? 'Edit learner' : 'Add learner'}
      onCancel={onCancel}
      onSubmit={() => onSave({ householdKey, displayName, hebrewName, gradeLabel })}
    >
      <label>
        <span>Household</span>
        <Select
          required
          disabled={Boolean(record)}
          value={householdKey}
          onChange={(event) => setHouseholdKey(event.target.value)}
        >
          <option value="">Choose household</option>
          {households.map((household) => (
            <option key={household.household_key} value={household.household_key}>
              {household.display_name} ({household.active_learner_count}/3 active)
            </option>
          ))}
        </Select>
      </label>
      <label>
        <span>Display name</span>
        <Input
          required
          minLength={2}
          maxLength={180}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </label>
      <label>
        <span>Hebrew name</span>
        <Input value={hebrewName} onChange={(event) => setHebrewName(event.target.value)} />
      </label>
      <label>
        <span>Grade</span>
        <Input value={gradeLabel} onChange={(event) => setGradeLabel(event.target.value)} />
      </label>
    </DirectoryForm>
  );
}

function DirectoryForm({
  title,
  children,
  onCancel,
  onSubmit,
}: {
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
  onSubmit: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  return (
    <Card className="admin-directory__form-card">
      <h3>{title}</h3>
      {error && <Alert tone="error">{error}</Alert>}
      <form
        className="admin-directory__form"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          setError('');
          try {
            await onSubmit();
          } catch (caught) {
            setError(errorMessage(caught));
          } finally {
            setSaving(false);
          }
        }}
      >
        {children}
        <div className="admin-directory__actions">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

function DirectoryTable({ headings, rows }: { headings: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="contact-table-wrap admin-directory__table">
      <Table>
        <thead>
          <tr>
            {headings.map((heading) => (
              <th key={heading} scope="col">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export function RecordTitle({
  title,
  subtitle,
  status,
  href,
  onOpen,
}: {
  title: string;
  subtitle?: string;
  status: string;
  href?: string;
  onOpen?: () => void;
}) {
  return (
    <span className="admin-directory__record-title">
      <strong>
        {href ? (
          <a href={href}>{title}</a>
        ) : onOpen ? (
          <button type="button" className="admin-directory__record-link" onClick={onOpen}>
            {title}
          </button>
        ) : (
          title
        )}
      </strong>
      {subtitle && <small>{subtitle}</small>}
      <Status value={status} />
    </span>
  );
}

function Status({ value }: { value: string }) {
  const tone = ['active', 'ready', 'synced'].includes(value)
    ? 'success'
    : ['archived', 'disabled', 'revoked', 'expired_setup'].includes(value)
      ? 'danger'
      : ['pending', 'pending_setup', 'setup_requested'].includes(value)
        ? 'warning'
        : 'neutral';
  return <StatusChip tone={tone}>{readable(value)}</StatusChip>;
}

function ActionGroup({ children }: { children: React.ReactNode }) {
  return <span className="admin-directory__actions">{children}</span>;
}

function descriptionFor(mode: AdminDirectoryMode) {
  if (mode === 'households') {
    return 'Create and maintain family records, guardians, access state, and setup state.';
  }
  if (mode === 'users') {
    return 'Create secure setup, assign permitted roles, reset passwords, and control access.';
  }
  if (mode === 'audit') {
    return 'Review timestamped local CRM and account administration activity.';
  }
  return 'Add, edit, archive, and restore local learners with a transactional three-seat limit.';
}

function statusOptions(mode: AdminDirectoryMode) {
  if (mode === 'households') return ['active', 'archived'];
  if (mode === 'users') return ['active', 'disabled'];
  if (mode === 'audit') return [];
  return ['active', 'archived', 'suspended'];
}

function auditDetails(metadata: Record<string, unknown>) {
  const entries = Object.entries(metadata)
    .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
    .slice(0, 3);
  return entries.length
    ? entries.map(([key, value]) => `${readable(key)}: ${String(value)}`).join(' · ')
    : 'No additional details';
}

function handleSession(error: unknown, onSessionExpired: () => void) {
  if (error instanceof AdminDirectoryRequestError && error.code === 'UNAUTHENTICATED') {
    onSessionExpired();
    return true;
  }
  return false;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The action could not be completed.';
}

function readable(value: string) {
  return value.replaceAll('_', ' ').replace(/^\w/u, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

function createRequestKey() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `admin-directory-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
