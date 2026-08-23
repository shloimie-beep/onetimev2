import React, { useEffect, useMemo, useState } from 'react';
import { V21StatePanel } from '../../../../../../../packages/brand-system/src/react-v21.tsx';
import { PrivacyDataRightsPanel, type PrivacyRequestView } from './PrivacyDataRightsPanel.tsx';
import { createParentPrivacyApi, type ParentPrivacySnapshot } from './api.ts';

export function ParentPrivacyWorkspace({
  api: providedApi,
  initialView = 'privacy',
}: {
  api?: ReturnType<typeof createParentPrivacyApi>;
  initialView?: 'privacy' | 'data-rights';
}) {
  const api = useMemo(() => providedApi ?? createParentPrivacyApi(), [providedApi]);
  const [snapshot, setSnapshot] = useState<ParentPrivacySnapshot | null>(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    void api
      .load()
      .then((data) => {
        if (!active) return;
        setSnapshot(data.snapshot);
        setCsrfToken(data.csrf_token);
        setSelectedStudentId(data.snapshot.students[0]?.student_id ?? '');
      })
      .catch((reason: unknown) => {
        if (active) setError(messageFrom(reason, 'Privacy controls could not be loaded.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api]);

  if (loading) return <p role="status">Loading privacy controls...</p>;
  if (!snapshot) {
    return (
      <V21StatePanel kind="error" title="Privacy controls unavailable">
        <p>{error || 'Privacy controls could not be loaded.'}</p>
      </V21StatePanel>
    );
  }
  const selectedStudent =
    snapshot.students.find((student) => student.student_id === selectedStudentId) ??
    snapshot.students[0] ??
    null;

  async function run(action: () => Promise<ParentPrivacySnapshot>, success: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = await action();
      setSnapshot(next);
      setNotice(success);
    } catch (reason) {
      setError(messageFrom(reason, 'The privacy request could not be completed.'));
    } finally {
      setBusy(false);
    }
  }

  function createRequest(kind: PrivacyRequestView['kind']) {
    if (currentPassword.length < 6 || currentPassword.length > 128) {
      setError('Enter your current Parent password to continue.');
      return;
    }
    void run(
      () => api.createRequest({ kind, currentPassword }, csrfToken),
      'Your verified data-rights request was received.',
    ).finally(() => setCurrentPassword(''));
  }

  return (
    <section aria-busy={busy}>
      <nav aria-label="Privacy account sections">
        <a href="/app/parent/privacy" aria-current={initialView === 'privacy' ? 'page' : undefined}>
          Privacy
        </a>{' '}
        <a
          href="/app/parent/data-rights"
          aria-current={initialView === 'data-rights' ? 'page' : undefined}
        >
          Data rights
        </a>
      </nav>
      <p>
        Current policies: <a href="/privacy">Privacy notice</a>, <a href="/terms">Terms</a>,{' '}
        <a href="/student-data">Student data and recording</a>, and{' '}
        <a href="/cancellation-refund">cancellation and refunds</a>.
      </p>
      {notice ? <p role="status">{notice}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {snapshot.students.length > 0 ? (
        <label>
          Student consent subject
          <select
            value={selectedStudent?.student_id ?? ''}
            disabled={busy}
            onChange={(event) => setSelectedStudentId(event.currentTarget.value)}
          >
            {snapshot.students.map((student) => (
              <option key={student.student_id} value={student.student_id}>
                {student.display_name} ({student.relationship})
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p>No Student consent subjects are available in this household.</p>
      )}
      <fieldset disabled={busy}>
        <legend>Verify data-rights requests</legend>
        <label>
          Current Parent password
          <input
            type="password"
            autoComplete="current-password"
            minLength={6}
            maxLength={128}
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.currentTarget.value)}
          />
        </label>
        <p>The password is verified for this request and is never stored in privacy evidence.</p>
      </fieldset>
      <PrivacyDataRightsPanel
        actorKind="parent"
        consents={selectedStudent?.consents ?? []}
        requests={snapshot.requests}
        busy={busy}
        onConsentChange={(scope, grant) => {
          if (!selectedStudent) return;
          void run(
            () =>
              api.changeConsent({ studentId: selectedStudent.student_id, scope, grant }, csrfToken),
            'Student consent evidence was updated.',
          );
        }}
        onCreateRequest={createRequest}
      />
      <details>
        <summary>Parent export scope</summary>
        <p>Included: {snapshot.export_disclosure.included.join(', ')}.</p>
        <p>Excluded: {snapshot.export_disclosure.excluded.join(', ')}.</p>
      </details>
    </section>
  );
}

function messageFrom(reason: unknown, fallback: string) {
  return reason instanceof Error && reason.message ? reason.message : fallback;
}
