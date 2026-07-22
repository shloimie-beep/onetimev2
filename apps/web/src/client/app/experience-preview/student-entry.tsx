import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ExperiencePreviewRole, StudentPortalDashboard } from '@onetime/contracts';
import '../crm.css';
import { StudentPortalFeature } from '../../features/portals/PortalFeatures.js';

type ProjectionState =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | {
      kind: 'ready';
      preview: ExperiencePreviewRole;
      dashboard: StudentPortalDashboard;
      expiresAt: string;
    };

function FictionalStudentShell() {
  const [state, setState] = useState<ProjectionState>({ kind: 'loading' });

  useEffect(() => {
    void loadProjection();
  }, []);

  async function loadProjection() {
    const response = await fetch(`${window.location.pathname}/projection`, {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    const json = (await response.json().catch(() => null)) as {
      success?: boolean;
      preview?: ExperiencePreviewRole;
      student_portal?: StudentPortalDashboard;
      expires_at?: string;
    } | null;
    if (
      !response.ok ||
      !json?.success ||
      !json.preview ||
      !json.student_portal ||
      !json.expires_at
    ) {
      setState({ kind: 'unavailable' });
      return;
    }
    setState({
      kind: 'ready',
      preview: json.preview,
      dashboard: json.student_portal,
      expiresAt: json.expires_at,
    });
  }

  return (
    <main className="fictional-student-shell" id="preview-main">
      <header className="fictional-student-shell__banner">
        <div>
          <p className="ot-kicker">Dedicated staging preview</p>
          <h1>Fictional Student portal preview</h1>
        </div>
        <span className="preview-readonly-badge">Read-only preview</span>
      </header>
      <p className="fictional-student-shell__notice" role="status">
        This isolated shell has no Administrator navigation, actions, logout, Student cookie, or
        mutation controls. It cannot impersonate a real learner.
      </p>

      {state.kind === 'loading' && (
        <p className="state-panel" role="status" aria-busy="true">
          Loading the exact fictional Student projection...
        </p>
      )}
      {state.kind === 'unavailable' && (
        <section className="state-panel error" role="alert">
          <h2>Preview unavailable</h2>
          <p>This preview was already used, expired, or no longer matches the fictional seed.</p>
        </section>
      )}
      {state.kind === 'ready' && (
        <>
          <section className="fictional-student-portal-heading" aria-labelledby="preview-role-name">
            <p className="ot-kicker">Actual Student area · fictional staging data</p>
            <h2 id="preview-role-name">{state.preview.label}</h2>
            <p>{state.preview.banner}</p>
          </section>
          <div className="fictional-student-portal-preview" inert>
            <StudentPortalFeature
              viewState="ready"
              dashboard={state.dashboard}
              actorFingerprint={`fictional-preview:${state.dashboard.learner.learner_key}`}
            />
          </div>
          <p className="fictional-student-shell__expiry">
            Preview expires {formatDate(state.expiresAt)}. Close this tab to return to the unchanged
            Administrator session.
          </p>
        </>
      )}
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

const rootElement = document.getElementById('experience-preview-student-root');
if (!rootElement) throw new Error('Missing fictional Student preview root.');
createRoot(rootElement).render(<FictionalStudentShell />);
