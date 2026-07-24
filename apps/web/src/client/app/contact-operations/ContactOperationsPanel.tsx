import React, { useEffect, useRef, useState, type FormEvent } from 'react';
import type {
  ContactOperationsEnrollment,
  ContactOperationsEnrollmentResult,
} from '@onetime/contracts';
import {
  AuthExpiredError,
  createIdempotencyKey,
  enrollParentHousehold,
  getAdultContactLink,
  getContactOperationsHousehold,
  reconcileAdultContact,
  requestParentContactReset,
  requestStudentContactReset,
  updateContactOperationsAccess,
  type AdultContactLink,
} from '../crm-api.js';

type StudentDraft = {
  display_name: string;
  hebrew_name: string;
  grade_label: string;
  username: string;
};

const emptyStudent = (): StudentDraft => ({
  display_name: '',
  hebrew_name: '',
  grade_label: '',
  username: '',
});

export function ContactOperationsPanel({
  csrfToken,
  initialHouseholdKey,
  onProtectedStateCleared,
}: {
  csrfToken: string;
  initialHouseholdKey: string | null;
  onProtectedStateCleared: () => void;
}) {
  const [parentName, setParentName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [classification, setClassification] = useState<'family' | 'school'>('family');
  const [familyOrSchool, setFamilyOrSchool] = useState('');
  const [location, setLocation] = useState('');
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jerusalem',
  );
  const [householdName, setHouseholdName] = useState('');
  const [students, setStudents] = useState<StudentDraft[]>([emptyStudent()]);
  const [complimentary, setComplimentary] = useState(false);
  const [existingHouseholdKey, setExistingHouseholdKey] = useState('');
  const [enrollment, setEnrollment] = useState<ContactOperationsEnrollmentResult | null>(null);
  const [adultLink, setAdultLink] = useState<AdultContactLink | null>(null);
  const [busyAction, setBusyAction] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [reconciled, setReconciled] = useState(false);
  const enrollmentKey = useRef(createIdempotencyKey());
  const loadedInitialHousehold = useRef('');

  useEffect(() => {
    if (!initialHouseholdKey || loadedInitialHousehold.current === initialHouseholdKey) return;
    loadedInitialHousehold.current = initialHouseholdKey;
    setExistingHouseholdKey(initialHouseholdKey);
    void loadExistingHousehold(initialHouseholdKey);
  }, [initialHouseholdKey]);

  async function submitEnrollment(event: FormEvent) {
    event.preventDefault();
    setBusyAction('enroll');
    setNotice('');
    setError('');
    const payload: ContactOperationsEnrollment = {
      idempotency_key: enrollmentKey.current,
      adult: {
        display_name: parentName,
        email,
        phone,
        classification,
        family_or_school: familyOrSchool,
        location,
        timezone,
      },
      household: { display_name: householdName },
      students: students.map((student) => ({
        display_name: student.display_name,
        username: student.username,
        ...(student.hebrew_name ? { hebrew_name: student.hebrew_name } : {}),
        ...(student.grade_label ? { grade_label: student.grade_label } : {}),
      })),
      ...(complimentary
        ? {
            complimentary: {
              expires_at: null,
              policy_version: 'contact-operations-ui-v1',
              opaque_source_reference: `contact_ops_ui_${enrollmentKey.current}`,
            },
          }
        : {}),
    };
    try {
      const response = await enrollParentHousehold(csrfToken, payload);
      setEnrollment(response.data);
      const link = await getAdultContactLink(response.data.household_key);
      setAdultLink(link.data);
      setNotice(
        response.data.replayed
          ? 'This household was already created. The existing result is shown.'
          : 'Parent invited and local Student accounts prepared. No child record was sent to GHL.',
      );
    } catch (caught) {
      if (isAuthError(caught)) onProtectedStateCleared();
      else setError(messageFor(caught, 'The Parent household could not be created.'));
    } finally {
      setBusyAction('');
    }
  }

  async function loadExistingHousehold(householdKeyOverride?: string) {
    const householdKey = (householdKeyOverride ?? existingHouseholdKey).trim();
    if (!householdKey) return;
    setBusyAction('load-household');
    setNotice('');
    setError('');
    try {
      const response = await getContactOperationsHousehold(householdKey);
      const household = response.data;
      setParentName(household.adult_display_name);
      setHouseholdName(household.display_name);
      setAdultLink(household.adult_link);
      setEnrollment({
        replayed: true,
        contact_key: household.adult_link.contact_key,
        household_key: household.household_key,
        relationship_key: 'existing_guardian_relationship',
        parent_activation_token_ref: 'existing_parent_activation',
        student_setup_token_refs: household.students.map((student) => ({
          learner_key: student.learner_key,
          username: student.username,
          token_ref: 'existing_student_setup',
        })),
        access_state: household.access_state,
        sync_state: household.adult_link.sync_state,
        child_highlevel_operations: 0,
        plaintext_credentials_stored: false,
        payment_history_written: false,
      });
      setNotice('Existing Parent household loaded.');
    } catch (caught) {
      if (isAuthError(caught)) onProtectedStateCleared();
      else setError(messageFor(caught, 'The Parent household could not be loaded.'));
    } finally {
      setBusyAction('');
    }
  }

  function updateStudent(index: number, field: keyof StudentDraft, value: string) {
    setStudents((current) =>
      current.map((student, studentIndex) =>
        studentIndex === index ? { ...student, [field]: value } : student,
      ),
    );
  }

  async function runAccess(
    operation: 'grant_complimentary' | 'revoke_complimentary' | 'suspend' | 'release',
    successMessage: string,
  ) {
    if (!enrollment) return;
    await runProtected(operation, async () => {
      const response = await updateContactOperationsAccess({
        csrfToken,
        householdKey: enrollment.household_key,
        operation,
        idempotencyKey: createIdempotencyKey(),
      });
      setEnrollment((current) =>
        current ? { ...current, access_state: response.data.projection.state } : current,
      );
      setNotice(successMessage);
    });
  }

  async function reconcile() {
    if (!enrollment) return;
    await runProtected('reconcile', async () => {
      const response = await reconcileAdultContact({
        csrfToken,
        householdKey: enrollment.household_key,
        idempotencyKey: createIdempotencyKey(),
      });
      setReconciled(true);
      setAdultLink((current) =>
        current
          ? {
              ...current,
              sync_state: response.data.sync_state,
              projection_revision: response.data.projection_revision,
            }
          : current,
      );
      setNotice('One adult-only GHL reconciliation was queued.');
    });
  }

  async function resetParent() {
    if (!enrollment) return;
    await runProtected('parent-reset', async () => {
      await requestParentContactReset({
        csrfToken,
        householdKey: enrollment.household_key,
        idempotencyKey: createIdempotencyKey(),
      });
      setNotice('A secure Parent recovery link was requested. No password is visible here.');
    });
  }

  async function resetStudent(learnerKey: string) {
    if (!enrollment) return;
    await runProtected(`student-reset:${learnerKey}`, async () => {
      await requestStudentContactReset({
        csrfToken,
        householdKey: enrollment.household_key,
        learnerKey,
        idempotencyKey: createIdempotencyKey(),
      });
      setNotice('A secure Student reset was requested for delivery to the adult Parent.');
    });
  }

  async function runProtected(action: string, callback: () => Promise<void>) {
    setBusyAction(action);
    setNotice('');
    setError('');
    try {
      await callback();
    } catch (caught) {
      if (isAuthError(caught)) onProtectedStateCleared();
      else setError(messageFor(caught, 'The protected contact action could not be completed.'));
    } finally {
      setBusyAction('');
    }
  }

  function createAnother() {
    enrollmentKey.current = createIdempotencyKey();
    setParentName('');
    setEmail('');
    setPhone('');
    setFamilyOrSchool('');
    setLocation('');
    setHouseholdName('');
    setStudents([emptyStudent()]);
    setComplimentary(false);
    setExistingHouseholdKey('');
    setEnrollment(null);
    setAdultLink(null);
    setNotice('');
    setError('');
    setReconciled(false);
  }

  if (enrollment) {
    return (
      <section className="contact-operations" aria-label="Parent household operations">
        <div className="contact-operations__notice" aria-live="polite">
          {notice && <p className="notice-banner notice-banner--success">{notice}</p>}
          {error && <p className="notice-banner notice-banner--error">{error}</p>}
        </div>
        <article className="contact-operations__card">
          <header>
            <div>
              <p className="contact-operations__eyebrow">Parent household</p>
              <h2>{householdName}</h2>
              <p>{parentName}</p>
            </div>
            <button type="button" className="button-secondary" onClick={createAnother}>
              Create another
            </button>
          </header>
          <dl className="contact-operations__facts">
            <div>
              <dt>Access</dt>
              <dd>{friendlyState(enrollment.access_state)}</dd>
            </div>
            <div>
              <dt>GHL sync</dt>
              <dd>{friendlyState(adultLink?.sync_state ?? enrollment.sync_state)}</dd>
            </div>
            <div>
              <dt>GHL projection</dt>
              <dd>Adult Parent only</dd>
            </div>
            <div>
              <dt>Billing changes</dt>
              <dd>None</dd>
            </div>
          </dl>
        </article>

        <article className="contact-operations__card">
          <header>
            <div>
              <h3>Household access</h3>
              <p>Complimentary access and administrative suspension stay separate from billing.</p>
            </div>
          </header>
          <div className="contact-operations__actions">
            <ActionButton
              label="Grant complimentary"
              action="grant_complimentary"
              busyAction={busyAction}
              onClick={() =>
                void runAccess('grant_complimentary', 'Complimentary access was granted.')
              }
            />
            <ActionButton
              label="Revoke complimentary"
              action="revoke_complimentary"
              busyAction={busyAction}
              onClick={() =>
                void runAccess(
                  'revoke_complimentary',
                  'Complimentary access was revoked. Paid access was not changed.',
                )
              }
            />
            <ActionButton
              label="Suspend"
              action="suspend"
              busyAction={busyAction}
              onClick={() =>
                void runAccess('suspend', 'Household suspended. Billing was not changed.')
              }
            />
            <ActionButton
              label="Release suspension"
              action="release"
              busyAction={busyAction}
              onClick={() => void runAccess('release', 'Administrative suspension was released.')}
            />
          </div>
        </article>

        <article className="contact-operations__card">
          <header>
            <div>
              <h3>Adult Parent and GHL</h3>
              <p>
                {adultLink?.highlevel_contact_linked
                  ? 'The durable adult link is connected.'
                  : 'The durable adult link is waiting for the existing outbox worker.'}
              </p>
            </div>
          </header>
          <div className="contact-operations__actions">
            {adultLink?.open_in_highlevel_url && (
              <a
                className="button-secondary"
                href={adultLink.open_in_highlevel_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open in GHL
              </a>
            )}
            <ActionButton
              label={reconciled ? 'Reconciliation queued' : 'Reconcile this Parent'}
              action="reconcile"
              busyAction={busyAction}
              disabled={reconciled}
              onClick={() => void reconcile()}
            />
            <ActionButton
              label="Request Parent reset"
              action="parent-reset"
              busyAction={busyAction}
              disabled={!adultLink?.guardian_user_ref}
              onClick={() => void resetParent()}
            />
          </div>
          {!adultLink?.guardian_user_ref && (
            <p className="contact-operations__hint">
              Parent recovery becomes available only after the invited Parent activates this exact
              household identity.
            </p>
          )}
        </article>

        <article className="contact-operations__card">
          <header>
            <div>
              <h3>Local-only Students</h3>
              <p>Student recovery is delivered through the adult Parent. GHL is never called.</p>
            </div>
          </header>
          <ul className="contact-operations__students">
            {enrollment.student_setup_token_refs.map((student) => (
              <li key={student.learner_key}>
                <div>
                  <strong>{student.username}</strong>
                  <span>Local One Time Student</span>
                </div>
                <ActionButton
                  label="Request Student reset"
                  action={`student-reset:${student.learner_key}`}
                  busyAction={busyAction}
                  onClick={() => void resetStudent(student.learner_key)}
                />
              </li>
            ))}
          </ul>
        </article>
      </section>
    );
  }

  return (
    <form className="contact-operations" onSubmit={submitEnrollment}>
      <div className="contact-operations__notice" aria-live="polite">
        {error && <p className="notice-banner notice-banner--error">{error}</p>}
      </div>
      <article className="contact-operations__card">
        <header>
          <div>
            <p className="contact-operations__eyebrow">Existing household</p>
            <h2>Manage recovery, access, and GHL sync</h2>
            <p>Open an existing Parent household by its One Time household reference.</p>
          </div>
        </header>
        <div className="contact-operations__existing">
          <label>
            <span>Household reference</span>
            <input
              value={existingHouseholdKey}
              onChange={(event) => setExistingHouseholdKey(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="button-secondary"
            disabled={!existingHouseholdKey.trim() || Boolean(busyAction)}
            onClick={() => void loadExistingHousehold()}
          >
            {busyAction === 'load-household' ? 'Loading…' : 'Manage household'}
          </button>
        </div>
      </article>
      <article className="contact-operations__card">
        <header>
          <div>
            <p className="contact-operations__eyebrow">One-button enrollment</p>
            <h2>Invite a Parent and create the household</h2>
            <p>
              One atomic action creates the adult contact, household, local Students, secure setup,
              access state, and one adult-only GHL projection.
            </p>
          </div>
        </header>
        <div className="contact-operations__grid">
          <label>
            <span>Parent name</span>
            <input
              required
              autoComplete="name"
              value={parentName}
              onChange={(event) => setParentName(event.target.value)}
            />
          </label>
          <label>
            <span>Parent email</span>
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            <span>Parent phone</span>
            <input
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>
          <label>
            <span>Contact type</span>
            <select
              value={classification}
              onChange={(event) =>
                setClassification(event.target.value === 'school' ? 'school' : 'family')
              }
            >
              <option value="family">Family</option>
              <option value="school">School</option>
            </select>
          </label>
          <label>
            <span>Family or School</span>
            <input
              required
              value={familyOrSchool}
              onChange={(event) => setFamilyOrSchool(event.target.value)}
            />
          </label>
          <label>
            <span>Household name</span>
            <input
              required
              value={householdName}
              onChange={(event) => setHouseholdName(event.target.value)}
            />
          </label>
          <label>
            <span>Location</span>
            <input
              required
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </label>
          <label>
            <span>Time zone</span>
            <input
              required
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
            />
          </label>
        </div>
      </article>

      <article className="contact-operations__card">
        <header>
          <div>
            <h3>Students</h3>
            <p>
              Add one or more local One Time Students. Only the adult Parent is projected to GHL.
            </p>
          </div>
          <button
            type="button"
            className="button-secondary"
            onClick={() => setStudents((current) => [...current, emptyStudent()])}
          >
            Add Student
          </button>
        </header>
        <div className="contact-operations__student-drafts">
          {students.map((student, index) => (
            <fieldset key={index}>
              <legend>Student {index + 1}</legend>
              <div className="contact-operations__grid">
                <label>
                  <span>Student name</span>
                  <input
                    required
                    value={student.display_name}
                    onChange={(event) => updateStudent(index, 'display_name', event.target.value)}
                  />
                </label>
                <label>
                  <span>Username</span>
                  <input
                    required
                    pattern="[A-Za-z0-9][A-Za-z0-9._-]*[A-Za-z0-9]"
                    minLength={3}
                    maxLength={24}
                    value={student.username}
                    onChange={(event) => updateStudent(index, 'username', event.target.value)}
                  />
                </label>
                <label>
                  <span>Hebrew name (optional)</span>
                  <input
                    value={student.hebrew_name}
                    onChange={(event) => updateStudent(index, 'hebrew_name', event.target.value)}
                  />
                </label>
                <label>
                  <span>Grade (optional)</span>
                  <input
                    value={student.grade_label}
                    onChange={(event) => updateStudent(index, 'grade_label', event.target.value)}
                  />
                </label>
              </div>
              {students.length > 1 && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    setStudents((current) =>
                      current.filter((_entry, studentIndex) => studentIndex !== index),
                    )
                  }
                >
                  Remove Student {index + 1}
                </button>
              )}
            </fieldset>
          ))}
        </div>
      </article>

      <article className="contact-operations__card contact-operations__submit">
        <label className="contact-operations__check">
          <input
            type="checkbox"
            checked={complimentary}
            onChange={(event) => setComplimentary(event.target.checked)}
          />
          <span>Grant complimentary access now</span>
        </label>
        <p>Leave unchecked to create a paused Parent shell. Billing is never changed here.</p>
        <button type="submit" className="button-primary" disabled={busyAction === 'enroll'}>
          {busyAction === 'enroll' ? 'Creating household…' : 'Create Parent household'}
        </button>
      </article>
    </form>
  );
}

function ActionButton({
  label,
  action,
  busyAction,
  disabled = false,
  onClick,
}: {
  label: string;
  action: string;
  busyAction: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="button-secondary"
      disabled={disabled || Boolean(busyAction)}
      onClick={onClick}
    >
      {busyAction === action ? 'Working…' : label}
    </button>
  );
}

function friendlyState(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function messageFor(caught: unknown, fallback: string) {
  return caught instanceof Error && caught.message ? caught.message : fallback;
}

function isAuthError(caught: unknown) {
  return caught instanceof AuthExpiredError;
}
