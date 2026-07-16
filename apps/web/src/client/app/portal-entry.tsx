import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  ParentLearnerMaterials,
  ParentPortalDashboard,
  ProtectedActionDescriptor,
  SessionUser,
  StudentPortalDashboard,
} from '@onetime/contracts';
import {
  ParentPortalFeature,
  StudentPortalFeature,
  type PortalViewState,
} from '../features/portals/PortalFeatures.js';
import { AppShell, type ShellNavItem, type ShellUser } from './shell/AppShell.js';
import {
  PortalApiError,
  getParentDashboard,
  getParentMaterials,
  getSession,
  getStudentDashboard,
  invokeProtectedAction,
  runStudentAccessOperation,
} from './portal-api.js';
import './crm.css';

type Notice = {
  kind: 'info' | 'success' | 'error';
  message: string;
};

function PortalApp() {
  const portalRole = location.pathname.startsWith('/app/student') ? 'student' : 'parent';
  const [session, setSession] = useState<Awaited<ReturnType<typeof getSession>> | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [viewState, setViewState] = useState<PortalViewState>('loading');
  const [parentDashboard, setParentDashboard] = useState<ParentPortalDashboard | null>(null);
  const [studentDashboard, setStudentDashboard] = useState<StudentPortalDashboard | null>(null);
  const [selectedLearnerKey, setSelectedLearnerKey] = useState<string | null>(null);
  const [parentMaterials, setParentMaterials] = useState<Record<string, ParentLearnerMaterials>>(
    {},
  );
  const [notice, setNotice] = useState<Notice | null>(null);
  const actorFingerprint = `${session?.user.user_key ?? 'anonymous'}:${session?.expires_at ?? ''}`;
  const selectedLearner =
    parentDashboard?.learners.find((learner) => learner.learner_key === selectedLearnerKey) ??
    parentDashboard?.learners[0] ??
    null;

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!parentDashboard || !selectedLearner) return;
    if (parentMaterials[selectedLearner.learner_key]) return;
    void loadMaterials(parentDashboard.household.household_key, selectedLearner.learner_key);
  }, [parentDashboard, selectedLearner?.learner_key]);

  async function load() {
    setViewState('loading');
    setNotice(null);
    try {
      const nextSession = await getSession();
      setSession(nextSession);
      setSessionExpired(false);
      if (nextSession.user.role !== portalRole) {
        setViewState('permission');
        return;
      }
      if (portalRole === 'parent') {
        const dashboard = await getParentDashboard();
        setParentDashboard(dashboard);
        setSelectedLearnerKey(dashboard.learners[0]?.learner_key ?? null);
      } else {
        setStudentDashboard(await getStudentDashboard());
      }
      setViewState('ready');
    } catch (error) {
      handleLoadError(error);
    }
  }

  async function loadMaterials(householdKey: string, learnerKey: string) {
    try {
      const materials = await getParentMaterials(householdKey, learnerKey);
      setParentMaterials((current) => ({ ...current, [learnerKey]: materials }));
    } catch (error) {
      if (handleAuthError(error)) return;
      setViewState('partial-error');
    }
  }

  async function reloadParentAfterMutation() {
    const dashboard = await getParentDashboard();
    setParentDashboard(dashboard);
    const learnerKey = selectedLearnerKey ?? dashboard.learners[0]?.learner_key ?? null;
    setSelectedLearnerKey(learnerKey);
    if (learnerKey) {
      const materials = await getParentMaterials(dashboard.household.household_key, learnerKey);
      setParentMaterials((current) => ({ ...current, [learnerKey]: materials }));
    }
  }

  async function handleStudentAccessAction(
    learnerKey: string,
    action: 'setup' | 'reset' | 'suspend' | 'restore' | 'revoke_sessions',
  ) {
    if (!session || !parentDashboard) return;
    const learner = parentDashboard.learners.find((entry) => entry.learner_key === learnerKey);
    if (!learner) return;
    const email =
      action === 'setup'
        ? window.prompt('Student email')?.trim()
        : action === 'reset'
          ? window.prompt('Student email')?.trim() || undefined
          : undefined;
    if (action === 'setup' && !email) return;
    try {
      await runStudentAccessOperation({
        csrfToken: session.csrf_token,
        householdKey: parentDashboard.household.household_key,
        learnerKey,
        operation: action,
        email,
        displayName: learner.display_name,
      });
      await reloadParentAfterMutation();
      setNotice({ kind: 'success', message: 'Student access updated.' });
      setViewState('success');
    } catch (error) {
      if (handleAuthError(error)) return;
      setNotice({ kind: 'error', message: errorMessage(error, 'Student access was not updated.') });
      setViewState(stateForError(error));
    }
  }

  async function handleProtectedAction(action: ProtectedActionDescriptor) {
    if (!session) return;
    try {
      const result = await invokeProtectedAction(action, session.csrf_token);
      setNotice({
        kind: 'info',
        message: result ? `${action.label} opened.` : `${action.label} is not available yet.`,
      });
    } catch (error) {
      if (handleAuthError(error)) return;
      setNotice({ kind: 'error', message: errorMessage(error, 'The protected action failed.') });
      setViewState(stateForError(error));
    }
  }

  function handleLoadError(error: unknown) {
    if (handleAuthError(error)) return;
    setNotice({ kind: 'error', message: errorMessage(error, 'Portal could not load.') });
    setViewState(stateForError(error));
  }

  function handleAuthError(error: unknown) {
    if (error instanceof PortalApiError && error.status === 401) {
      setSessionExpired(true);
      setSession(null);
      setParentDashboard(null);
      setStudentDashboard(null);
      setViewState('session-expired');
      return true;
    }
    return false;
  }

  function signIn() {
    window.location.assign(`/login?return_to=${encodeURIComponent(location.pathname)}`);
  }

  async function logout() {
    if (!session) return;
    setSessionExpired(true);
    setSession(null);
    await fetch('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'x-csrf-token': session.csrf_token },
    }).catch(() => undefined);
    window.location.assign('/login');
  }

  const navItems = useMemo<ShellNavItem[]>(
    () =>
      portalRole === 'parent'
        ? [{ id: 'parent', label: 'Parent Portal', href: '/app/parent', current: true }]
        : [{ id: 'student', label: 'Student Portal', href: '/app/student', current: true }],
    [portalRole],
  );
  const title = portalRole === 'parent' ? 'Parent Portal' : 'Student Portal';
  const description =
    portalRole === 'parent'
      ? (parentDashboard?.household.display_name ?? 'Household')
      : (studentDashboard?.learner.display_name ?? 'Learner');

  return (
    <AppShell
      user={session ? shellUserFromSession(session.user) : null}
      navItems={navItems}
      title={title}
      description={description}
      notice={notice ? <NoticeBanner notice={notice} /> : undefined}
      onNavigate={(href) => {
        history.pushState({}, '', href);
        void load();
      }}
      onLogout={() => void logout()}
      sessionExpired={sessionExpired}
      onSignIn={signIn}
    >
      {portalRole === 'parent' ? (
        <ParentPortalFeature
          viewState={viewState}
          dashboard={parentDashboard}
          selectedLearnerKey={selectedLearner?.learner_key ?? null}
          learnerMaterials={parentMaterials}
          actorFingerprint={actorFingerprint}
          onSelectLearner={setSelectedLearnerKey}
          onStudentAccessAction={(learnerKey, action) =>
            void handleStudentAccessAction(learnerKey, action)
          }
          onLaunchClass={(_learnerKey, action) => void handleProtectedAction(action)}
          onPreviewSupport={() => window.location.assign('/app/support')}
          onRetry={() => void load()}
        />
      ) : (
        <StudentPortalFeature
          viewState={viewState}
          dashboard={studentDashboard}
          actorFingerprint={actorFingerprint}
          onLaunchClass={(action) => void handleProtectedAction(action)}
          onOpenContent={(action) => void handleProtectedAction(action)}
          onPreviewSupport={() => window.location.assign('/app/support')}
          onRetry={() => void load()}
        />
      )}
    </AppShell>
  );
}

function NoticeBanner({ notice }: { notice: Notice }) {
  return (
    <p
      className={`notice-banner ${notice.kind === 'error' ? 'error' : notice.kind}`}
      role={notice.kind === 'error' ? 'alert' : 'status'}
    >
      {notice.message}
    </p>
  );
}

function shellUserFromSession(user: SessionUser): ShellUser {
  return {
    displayName: user.display_name,
    email: user.email,
    roleLabel: user.role_label,
  };
}

function stateForError(error: unknown): PortalViewState {
  if (error instanceof TypeError) return 'offline';
  if (error instanceof PortalApiError && error.status === 403) return 'permission';
  if (error instanceof PortalApiError && error.status === 409) {
    if (error.code === 'LEARNER_LIMIT_REACHED') return 'limit-reached';
    return 'conflict';
  }
  return 'partial-error';
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

const root = document.getElementById('portal-root');
if (root) {
  createRoot(root).render(<PortalApp />);
}
