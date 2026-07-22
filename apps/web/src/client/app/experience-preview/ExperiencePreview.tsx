import React, { useEffect, useMemo, useState } from 'react';
import type { ExperiencePreviewCatalog, ExperiencePreviewRoleId } from '@onetime/contracts';
import { RolePreview } from './RolePreview.js';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'catalog'; catalog: ExperiencePreviewCatalog };

export function ExperiencePreview({
  csrfToken,
  onProtectedStateCleared,
}: {
  csrfToken: string;
  onProtectedStateCleared: () => void;
}) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [selectedRoleId, setSelectedRoleId] = useState<ExperiencePreviewRoleId>('parent');
  const [openingRoleId, setOpeningRoleId] = useState<ExperiencePreviewRoleId | null>(null);
  const [launchError, setLaunchError] = useState('');
  const [preparedLaunch, setPreparedLaunch] = useState<{
    roleId: ExperiencePreviewRoleId;
    url: string;
  } | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setState({ kind: 'loading' });
    const response = await fetch('/api/v1/experience-preview', {
      headers: { accept: 'application/json' },
    });
    if (response.status === 401) {
      onProtectedStateCleared();
      return;
    }
    const json = (await response.json().catch(() => null)) as {
      success?: boolean;
      data?: ExperiencePreviewCatalog;
    } | null;
    if (!response.ok || !json?.success || !json.data) {
      setState({
        kind: 'error',
        message: 'Experience Preview is unavailable in this runtime.',
      });
      return;
    }
    setState({ kind: 'catalog', catalog: json.data });
    setSelectedRoleId(json.data.roles[0]?.role_id ?? 'parent');
  }

  async function openFictionalStudentSession(roleId: ExperiencePreviewRoleId) {
    setLaunchError('');
    setPreparedLaunch(null);
    setOpeningRoleId(roleId);
    try {
      const response = await fetch('/api/v1/experience-preview/student-exchanges', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ role_id: roleId, csrf_token: csrfToken }),
      });
      if (response.status === 401) {
        onProtectedStateCleared();
        return;
      }
      const json = (await response.json().catch(() => null)) as {
        success?: boolean;
        exchange_url?: string;
        message?: string;
      } | null;
      if (!response.ok || !json?.success || !json.exchange_url) {
        throw new Error(json?.message ?? 'The fictional Student is unavailable for preview.');
      }
      setPreparedLaunch({ roleId, url: json.exchange_url });
    } catch (error) {
      setLaunchError(error instanceof Error ? error.message : 'Could not open the preview tab.');
    } finally {
      setOpeningRoleId(null);
    }
  }

  const selected = useMemo(() => {
    if (state.kind !== 'catalog') return null;
    return (
      state.catalog.previews.find((preview) => preview.role_id === selectedRoleId) ??
      state.catalog.previews[0] ??
      null
    );
  }, [selectedRoleId, state]);

  if (state.kind === 'loading') {
    return (
      <section className="experience-preview" aria-busy="true">
        <p className="state-panel" role="status">
          Loading the fictional One Time walkthrough...
        </p>
      </section>
    );
  }

  if (state.kind === 'error') {
    return (
      <section className="experience-preview">
        <div className="state-panel error" role="alert">
          <h2>Preview unavailable</h2>
          <p>{state.message}</p>
          <button type="button" className="button-secondary" onClick={() => void load()}>
            Try again
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="experience-preview" data-goal-id={state.catalog.goal_id}>
      <header className="experience-preview-intro">
        <div>
          <p className="ot-kicker">Staging operator walkthrough</p>
          <h2>{state.catalog.scenario_title}</h2>
          <p>
            Select a role to inspect exact fictional staging projections. Readiness comes only from
            seeded pipeline rows; these previews cannot mutate Student data or replace the
            Administrator session.
          </p>
        </div>
        <span className="preview-readonly-badge">Read-only</span>
      </header>

      <ul className="experience-role-grid" aria-label="Fictional role previews">
        {state.catalog.roles.map((role) => (
          <li key={role.role_id}>
            <button
              type="button"
              className="experience-role-card"
              aria-label={`Preview ${role.label}: ${role.subtitle}`}
              aria-pressed={role.role_id === selectedRoleId}
              onClick={() => {
                setSelectedRoleId(role.role_id);
                setLaunchError('');
                setPreparedLaunch(null);
              }}
            >
              <span>Choose {role.label}</span>
              <strong>{role.subtitle}</strong>
              <span className="experience-role-card-action">Preview {role.label}</span>
              <small data-state={role.state}>{stateLabel(role.state)}</small>
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <>
          <div className="experience-selected-role" role="status">
            <strong>Selected preview: {selected.label}</strong>
            <span>
              {selected.can_open_student_session
                ? 'Inspect the read-only projection, then prepare and open its separate fictional Student session.'
                : 'This Parent or Rabbi/Classroom projection renders read-only below; no account session is replaced.'}
            </span>
          </div>
          <RolePreview preview={selected} />
          {selected.can_open_student_session && (
            <div className="experience-session-action">
              <button
                type="button"
                className="button-primary"
                disabled={openingRoleId === selected.role_id}
                onClick={() => void openFictionalStudentSession(selected.role_id)}
              >
                {openingRoleId === selected.role_id
                  ? 'Preparing fictional Student...'
                  : 'Prepare fictional Student session'}
              </button>
              <small>
                Opens a five-minute dedicated read-only shell with no Admin controls or Student
                impersonation.
              </small>
              {launchError && <p role="alert">{launchError}</p>}
              {preparedLaunch?.roleId === selected.role_id && (
                <a
                  className="button-secondary"
                  href={preparedLaunch.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    window.setTimeout(() => setPreparedLaunch(null), 0);
                  }}
                >
                  Open fictional Student session
                </a>
              )}
            </div>
          )}
        </>
      )}

      <nav className="experience-safe-routes" aria-label="Operator routes">
        <a href={state.catalog.safe_routes.live_console}>Live Console</a>
        <a href={state.catalog.safe_routes.content_factory}>Content Factory</a>
        <a href={state.catalog.safe_routes.classes}>Classes</a>
        <a href={state.catalog.safe_routes.vimeo_demo}>Prepared Vimeo Demo</a>
      </nav>
    </section>
  );
}

function stateLabel(value: string) {
  if (value === 'ready') return 'Ready';
  if (value === 'provider_off') return 'Provider off';
  return 'Unavailable';
}
