import React, { useEffect, useMemo, useState } from 'react';
import { V21StatePanel } from '../../../../../../../packages/brand-system/src/react-v21.tsx';
import {
  createParentPreferencesApi,
  type ParentPreferencesSnapshot,
} from './api.ts';

export function ParentPreferencesWorkspace({
  api: providedApi,
}: {
  api?: ReturnType<typeof createParentPreferencesApi>;
}) {
  const api = useMemo(() => providedApi ?? createParentPreferencesApi(), [providedApi]);
  const [saved, setSaved] = useState<ParentPreferencesSnapshot | null>(null);
  const [draft, setDraft] = useState<ParentPreferencesSnapshot | null>(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void api
      .load()
      .then((data) => {
        if (!active) return;
        setSaved(data.snapshot);
        setDraft(data.snapshot);
        setCsrfToken(data.csrf_token);
      })
      .catch((reason: unknown) => {
        if (active) setError(messageFrom(reason, 'Preferences could not be loaded.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api]);

  if (loading) return <p role="status">Loading Parent preferences...</p>;
  if (!draft || !saved) {
    return (
      <V21StatePanel kind="error" title="Preferences unavailable">
        <p>{error || 'Preferences could not be loaded.'}</p>
      </V21StatePanel>
    );
  }

  const dirty = preferenceValues(draft) !== preferenceValues(saved);
  return (
    <section aria-labelledby="parent-preferences-heading" aria-busy={busy}>
      <header>
        <p className="ot-eyebrow">Parent account</p>
        <h2 id="parent-preferences-heading">Preferences</h2>
        <p>
          These settings apply to {draft.active_student_count} active Student
          {draft.active_student_count === 1 ? '' : 's'} in this household.
        </p>
      </header>
      {notice ? <p role="status">{notice}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          setNotice('');
          void api
            .update(draft, csrfToken)
            .then((next) => {
              setSaved(next);
              setDraft(next);
              setNotice('Preferences saved.');
            })
            .catch((reason: unknown) =>
              setError(messageFrom(reason, 'Preferences could not be saved.')),
            )
            .finally(() => setBusy(false));
        }}
      >
        <fieldset disabled={busy}>
          <legend>Household time zone</legend>
          <label>
            IANA time zone
            <input
              value={draft.time_zone}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setDraft({ ...draft, time_zone: event.currentTarget.value })}
            />
          </label>
          <p>Class times and reminders use this time zone. Example: Asia/Jerusalem.</p>
        </fieldset>

        <fieldset disabled={busy}>
          <legend>Class reminders</legend>
          <label>
            <input
              type="checkbox"
              checked={draft.portal_class_reminders}
              onChange={(event) =>
                setDraft({ ...draft, portal_class_reminders: event.currentTarget.checked })
              }
            />{' '}
            Portal reminders
          </label>
          <label>
            <input
              type="checkbox"
              checked={draft.email_class_reminders}
              onChange={(event) =>
                setDraft({ ...draft, email_class_reminders: event.currentTarget.checked })
              }
            />{' '}
            Email reminders
          </label>
          <label>
            <input type="checkbox" checked={false} disabled readOnly /> WhatsApp reminders
          </label>
          <p>WhatsApp is dormant and cannot be selected until an approved transport is enabled.</p>
        </fieldset>

        <fieldset disabled={busy}>
          <legend>Newsletter</legend>
          <label>
            <input
              type="checkbox"
              checked={draft.parent_newsletter_consent}
              onChange={(event) =>
                setDraft({ ...draft, parent_newsletter_consent: event.currentTarget.checked })
              }
            />{' '}
            Receive the Parent newsletter
          </label>
          <p>Consent policy: {draft.newsletter_consent_policy_version}</p>
        </fieldset>

        <button type="submit" disabled={busy || !dirty}>
          {busy ? 'Saving...' : 'Save preferences'}
        </button>
      </form>
    </section>
  );
}

function preferenceValues(value: ParentPreferencesSnapshot) {
  return JSON.stringify({
    time_zone: value.time_zone,
    portal_class_reminders: value.portal_class_reminders,
    email_class_reminders: value.email_class_reminders,
    parent_newsletter_consent: value.parent_newsletter_consent,
  });
}

function messageFrom(reason: unknown, fallback: string) {
  return reason instanceof Error && reason.message ? reason.message : fallback;
}
