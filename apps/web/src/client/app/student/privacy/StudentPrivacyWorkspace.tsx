import React, { useEffect, useMemo, useState } from 'react';
import { V21StatePanel } from '../../../../../../../packages/brand-system/src/react-v21.tsx';
import { isStudentPin } from '../../../../../../../packages/contracts/src/identity/auth/index.ts';
import {
  PrivacyDataRightsPanel,
  type PrivacyRequestView,
} from '../../parent/privacy/PrivacyDataRightsPanel.tsx';
import { createStudentPrivacyApi, type StudentPrivacySnapshot } from './api.ts';

export function StudentPrivacyWorkspace({
  api: providedApi,
  initialView = 'privacy',
}: {
  api?: ReturnType<typeof createStudentPrivacyApi>;
  initialView?: 'privacy' | 'data-rights';
}) {
  const api = useMemo(() => providedApi ?? createStudentPrivacyApi(), [providedApi]);
  const [snapshot, setSnapshot] = useState<StudentPrivacySnapshot | null>(null);
  const [csrfToken, setCsrfToken] = useState('');
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
      })
      .catch((reason: unknown) => {
        if (active) setError(messageFrom(reason, 'Student privacy controls could not be loaded.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api]);

  if (loading) return <p role="status">Loading Student privacy controls...</p>;
  if (!snapshot) {
    return (
      <V21StatePanel kind="error" title="Student privacy controls unavailable">
        <p>{error || 'Student privacy controls could not be loaded.'}</p>
      </V21StatePanel>
    );
  }

  async function run(action: () => Promise<StudentPrivacySnapshot>, success: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setSnapshot(await action());
      setNotice(success);
    } catch (reason) {
      setError(messageFrom(reason, 'The Student privacy request could not be completed.'));
    } finally {
      setBusy(false);
    }
  }

  function createRequest(kind: PrivacyRequestView['kind']) {
    if (!isStudentCurrentCredential(currentPassword)) {
      setError(
        'Enter your current six-digit Student PIN, or your existing Student password if it has not been reset yet.',
      );
      return;
    }
    void run(
      () => api.createRequest({ kind, currentPassword }, csrfToken),
      'Your verified Student data-rights request was received.',
    ).finally(() => setCurrentPassword(''));
  }

  return (
    <section aria-busy={busy}>
      <nav aria-label="Student privacy account sections">
        <a
          href="/app/student/privacy"
          aria-current={initialView === 'privacy' ? 'page' : undefined}
        >
          Privacy
        </a>{' '}
        <a
          href="/app/student/data-rights"
          aria-current={initialView === 'data-rights' ? 'page' : undefined}
        >
          Data rights
        </a>
      </nav>
      <p>
        These controls apply only to {snapshot.student.display_name}&apos;s self-managed adult
        Student profile. A dependent Student must use the Parent account owner&apos;s privacy
        routes.
      </p>
      <p>
        Current policies: <a href="/privacy">Privacy notice</a>, <a href="/terms">Terms</a>, and{' '}
        <a href="/student-data">Student data and recording</a>.
      </p>
      {notice ? <p role="status">{notice}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <fieldset disabled={busy}>
        <legend>Verify Student data-rights requests</legend>
        <label>
          Current Student PIN or password
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.currentTarget.value)}
          />
        </label>
        <p>
          Use your six-digit PIN after a Parent reset. Existing longer Student passwords continue to
          work until reset. This credential is verified for the request and is never stored in
          privacy evidence.
        </p>
      </fieldset>
      <PrivacyDataRightsPanel
        actorKind="adult_self_student"
        consents={snapshot.student.consents}
        requests={snapshot.requests}
        busy={busy}
        onConsentChange={(scope, grant) => {
          if (scope === 'service_account') return;
          void run(
            () => api.changeConsent({ scope, grant }, csrfToken),
            'Your Student consent evidence was updated.',
          );
        }}
        onCreateRequest={createRequest}
      />
      <details>
        <summary>Your Student export scope</summary>
        <p>Included: {snapshot.export_disclosure.included.join(', ')}.</p>
        <p>Excluded: {snapshot.export_disclosure.excluded.join(', ')}.</p>
      </details>
    </section>
  );
}

function messageFrom(reason: unknown, fallback: string) {
  return reason instanceof Error && reason.message ? reason.message : fallback;
}

/** Accept a current six-digit PIN while preserving legacy Student password access. */
export function isStudentCurrentCredential(value: string): boolean {
  return isStudentPin(value) || (value.length >= 8 && value.length <= 256);
}
