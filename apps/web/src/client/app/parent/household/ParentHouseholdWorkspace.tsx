import React, { useEffect, useMemo, useState } from 'react';
import {
  STUDENT_ACTUAL_NAME_INSTRUCTIONS,
  type ParentHouseholdSnapshot,
  type ParentStudentRelationship,
  type StudentCredentialHandoff,
} from '../../../../../../../packages/contracts/src/portals/parent-household/index.ts';
import {
  createParentHouseholdApi,
  type ParentHouseholdApi,
  type ParentHouseholdBootstrap,
} from './api.ts';

export type ParentHouseholdView =
  { kind: 'overview' } | { kind: 'create' } | { kind: 'student'; student_id: string };

export function ParentHouseholdWorkspace({
  snapshot: initialSnapshot,
  csrfToken: initialCsrfToken = null,
  relationship: initialRelationship = 'dependent',
  credentialHandoff: initialCredentialHandoff = null,
  view = { kind: 'overview' },
  api: suppliedApi,
}: {
  snapshot?: ParentHouseholdSnapshot;
  csrfToken?: string | null;
  relationship?: ParentStudentRelationship;
  credentialHandoff?: StudentCredentialHandoff | null;
  view?: ParentHouseholdView;
  api?: ParentHouseholdApi;
}) {
  const api = useMemo(() => suppliedApi ?? createParentHouseholdApi(), [suppliedApi]);
  const [snapshot, setSnapshot] = useState<ParentHouseholdSnapshot | null>(initialSnapshot ?? null);
  const [csrfToken, setCsrfToken] = useState(initialCsrfToken);
  const [relationship, setRelationship] = useState<ParentStudentRelationship>(initialRelationship);
  const [credentialHandoff, setCredentialHandoff] = useState(initialCredentialHandoff);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSnapshot) return;
    let active = true;
    api
      .load()
      .then((bootstrap: ParentHouseholdBootstrap) => {
        if (!active) return;
        setSnapshot(bootstrap.snapshot);
        setCsrfToken(bootstrap.csrf_token);
      })
      .catch((cause: unknown) => {
        if (active) setError(safeError(cause));
      });
    return () => {
      active = false;
    };
  }, [api, initialSnapshot]);

  async function mutate(
    action: (csrf: string) => Promise<{
      snapshot: ParentHouseholdSnapshot;
      credential_handoff: StudentCredentialHandoff | null;
    }>,
    success: string,
  ) {
    if (!csrfToken) {
      setError('Refresh the Parent portal and try again.');
      return;
    }
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await action(csrfToken);
      setSnapshot(result.snapshot);
      setCredentialHandoff(result.credential_handoff);
      setMessage(success);
    } catch (cause) {
      setError(safeError(cause));
    } finally {
      setPending(false);
    }
  }

  if (!snapshot) {
    return (
      <section aria-live="polite">
        <h1>Parent household</h1>
        <p>{error ?? 'Loading household…'}</p>
      </section>
    );
  }

  const selectedStudent =
    snapshot.can_manage_students && view.kind === 'student'
      ? (snapshot.students.find((student) => student.student_id === view.student_id) ?? null)
      : null;
  const effectiveView = snapshot.can_manage_students ? view : ({ kind: 'overview' } as const);

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

      {message ? <p role="status">{message}</p> : null}
      {error ? <p role="alert">{error}</p> : null}

      {effectiveView.kind === 'create' ? (
        <CreateStudentForm
          disabled={
            pending || !snapshot.can_manage_students || snapshot.available_student_seats === 0
          }
          relationship={relationship}
          setRelationship={setRelationship}
          onSubmit={(form) =>
            mutate(
              (csrf) =>
                api.createStudent(
                  {
                    expected_revision: snapshot.revision,
                    actual_name: form.actualName,
                    ...(form.displayName ? { display_name: form.displayName } : {}),
                    username: form.username,
                    relationship,
                    new_password: form.password,
                    password_confirmation: form.passwordConfirmation,
                  },
                  csrf,
                ),
              'Student created. Save the credentials shown below.',
            )
          }
        />
      ) : null}

      {effectiveView.kind === 'student' ? (
        selectedStudent ? (
          <StudentManagementForms
            student={selectedStudent}
            revision={snapshot.revision}
            disabled={pending || !snapshot.can_manage_students}
            onUpdate={(form) =>
              mutate(
                (csrf) =>
                  api.updateStudent(
                    {
                      student_id: selectedStudent.student_id,
                      expected_revision: snapshot.revision,
                      actual_name: form.actualName,
                      ...(form.displayName ? { display_name: form.displayName } : {}),
                      username: form.username,
                    },
                    csrf,
                  ),
                'Student profile saved.',
              )
            }
            onLifecycle={() =>
              mutate(
                (csrf) =>
                  selectedStudent.state === 'active'
                    ? api.archiveStudent(
                        {
                          student_id: selectedStudent.student_id,
                          expected_revision: snapshot.revision,
                        },
                        csrf,
                      )
                    : api.restoreStudent(
                        {
                          student_id: selectedStudent.student_id,
                          expected_revision: snapshot.revision,
                        },
                        csrf,
                      ),
                selectedStudent.state === 'active' ? 'Student archived.' : 'Student restored.',
              )
            }
            onReset={(password, passwordConfirmation) =>
              mutate(
                (csrf) =>
                  api.resetStudentCredential(
                    {
                      student_id: selectedStudent.student_id,
                      expected_revision: snapshot.revision,
                      new_password: password,
                      password_confirmation: passwordConfirmation,
                    },
                    csrf,
                  ),
                'Password reset. Save the credentials shown below.',
              )
            }
          />
        ) : (
          <p role="alert">This Student is unavailable.</p>
        )
      ) : null}

      {effectiveView.kind === 'overview' && snapshot.can_manage_students ? (
        <>
          <h2>Who is this learner?</h2>
          <p>{STUDENT_ACTUAL_NAME_INSTRUCTIONS[relationship]}</p>
        </>
      ) : null}

      {snapshot.can_manage_students ? (
        <>
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
          {credentialHandoff ? <CredentialHandoff handoff={credentialHandoff} /> : null}
        </>
      ) : null}
    </section>
  );
}

function CreateStudentForm({
  disabled,
  relationship,
  setRelationship,
  onSubmit,
}: {
  disabled: boolean;
  relationship: ParentStudentRelationship;
  setRelationship: (relationship: ParentStudentRelationship) => void;
  onSubmit: (form: ProfileForm & CredentialForm) => void;
}) {
  return (
    <form
      aria-labelledby="create-student-heading"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSubmit({ ...profileForm(data), ...credentialForm(data) });
      }}
    >
      <h2 id="create-student-heading">Add Student</h2>
      <label>
        Who is this learner?
        <select
          name="relationship"
          value={relationship}
          disabled={disabled}
          onChange={(event) =>
            setRelationship(event.currentTarget.value as ParentStudentRelationship)
          }
        >
          <option value="dependent">Someone I manage</option>
          <option value="self">Myself</option>
        </select>
      </label>
      <p>{STUDENT_ACTUAL_NAME_INSTRUCTIONS[relationship]}</p>
      <ProfileFields disabled={disabled} />
      <CredentialFields disabled={disabled} />
      <button type="submit" disabled={disabled}>
        Create Student
      </button>
    </form>
  );
}

function StudentManagementForms({
  student,
  revision,
  disabled,
  onUpdate,
  onLifecycle,
  onReset,
}: {
  student: ParentHouseholdSnapshot['students'][number];
  revision: number;
  disabled: boolean;
  onUpdate: (form: ProfileForm) => void;
  onLifecycle: () => void;
  onReset: (password: string, passwordConfirmation: string) => void;
}) {
  return (
    <section aria-labelledby="manage-student-heading" data-household-revision={revision}>
      <h2 id="manage-student-heading">Manage {student.display_name ?? student.actual_name}</h2>
      <p>{STUDENT_ACTUAL_NAME_INSTRUCTIONS[student.relationship]}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onUpdate(profileForm(new FormData(event.currentTarget)));
        }}
      >
        <ProfileFields disabled={disabled} student={student} />
        <button type="submit" disabled={disabled}>
          Save Student
        </button>
      </form>
      <button type="button" disabled={disabled} onClick={onLifecycle}>
        {student.state === 'active' ? 'Archive Student' : 'Restore Student'}
      </button>
      {student.state === 'active' ? (
        <form
          aria-labelledby="reset-password-heading"
          onSubmit={(event) => {
            event.preventDefault();
            const form = credentialForm(new FormData(event.currentTarget));
            onReset(form.password, form.passwordConfirmation);
          }}
        >
          <h3 id="reset-password-heading">Reset Student password</h3>
          <p>The existing password is never displayed.</p>
          <CredentialFields disabled={disabled} />
          <button type="submit" disabled={disabled}>
            Reset password
          </button>
        </form>
      ) : null}
    </section>
  );
}

function ProfileFields({
  disabled,
  student,
}: {
  disabled: boolean;
  student?: ParentHouseholdSnapshot['students'][number];
}) {
  return (
    <>
      <label>
        Actual name
        <input
          name="actual_name"
          required
          maxLength={100}
          disabled={disabled}
          defaultValue={student?.actual_name ?? ''}
          autoComplete="off"
        />
      </label>
      <label>
        Display name (optional)
        <input
          name="display_name"
          maxLength={100}
          disabled={disabled}
          defaultValue={student?.display_name ?? ''}
          autoComplete="off"
        />
      </label>
      <label>
        Username
        <input
          name="username"
          required
          minLength={3}
          maxLength={64}
          pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,63}"
          disabled={disabled}
          defaultValue={student?.username ?? ''}
          autoComplete="username"
        />
      </label>
    </>
  );
}

function CredentialFields({ disabled }: { disabled: boolean }) {
  return (
    <>
      <label>
        New password
        <input
          name="new_password"
          type="password"
          required
          minLength={12}
          maxLength={128}
          disabled={disabled}
          autoComplete="new-password"
        />
      </label>
      <label>
        Confirm new password
        <input
          name="password_confirmation"
          type="password"
          required
          minLength={12}
          maxLength={128}
          disabled={disabled}
          autoComplete="new-password"
        />
      </label>
    </>
  );
}

function CredentialHandoff({ handoff }: { handoff: StudentCredentialHandoff }) {
  return (
    <section aria-labelledby="credential-handoff-heading">
      <h2 id="credential-handoff-heading">Save credentials for {handoff.student_label}</h2>
      <p>This password is shown only now. Copy or print it before leaving this page.</p>
      <dl>
        <dt>Username</dt>
        <dd>{handoff.username}</dd>
        <dt>New password</dt>
        <dd>{handoff.new_password}</dd>
      </dl>
      <p>Credentials are not emailed. You can reset them later.</p>
    </section>
  );
}

type ProfileForm = { actualName: string; displayName: string; username: string };
type CredentialForm = { password: string; passwordConfirmation: string };

function profileForm(data: FormData): ProfileForm {
  return {
    actualName: String(data.get('actual_name') ?? ''),
    displayName: String(data.get('display_name') ?? ''),
    username: String(data.get('username') ?? ''),
  };
}

function credentialForm(data: FormData): CredentialForm {
  return {
    password: String(data.get('new_password') ?? ''),
    passwordConfirmation: String(data.get('password_confirmation') ?? ''),
  };
}

function safeError(cause: unknown) {
  return cause instanceof Error && cause.message
    ? cause.message
    : 'The Parent request could not be completed.';
}
