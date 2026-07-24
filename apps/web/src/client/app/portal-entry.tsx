import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  LearnerProfile,
  LiveClassQuestion,
  ParentLearnerMaterials,
  ParentPortalDashboard,
  ProtectedActionDescriptor,
  SessionUser,
  StudentAccessOperationType,
  StudentPortalDashboard,
} from '@onetime/contracts';
import {
  PARENT_PORTAL_SECTIONS,
  ParentPortalFeature,
  STUDENT_PORTAL_SECTIONS,
  StudentPortalFeature,
  type ParentPortalSection,
  type PortalViewState,
  type StudentPortalSection,
} from '../features/portals/PortalFeatures.js';
import { AppShell, type ShellNavItem, type ShellUser } from './shell/AppShell.js';
import {
  PortalApiError,
  createParentRewardGoal,
  createParentLearner,
  getParentDashboard,
  getParentMaterials,
  getLiveClassQuestions,
  getSession,
  getStudentDashboard,
  invokeProtectedAction,
  markLiveClassQuestionReady,
  runStudentAccessOperation,
  setParentLearnerArchived,
  submitClassroomQuestion,
  queryStudentHelper,
  submitStudentQuestion,
  updateParentLearner,
} from './portal-api.js';
import './crm.css';

const HELPER_PREPARING_MESSAGE =
  'Class Helper is being prepared for this class. Send a private question and we will route it for review.';

type Notice = {
  kind: 'info' | 'success' | 'error';
  message: string;
};

type LearnerFormValues = {
  displayName: string;
  hebrewName: string;
  gradeLabel: string;
};

type StudentAccessFormValues = {
  username: string;
  password: string;
};

type PortalDialog =
  | {
      type: 'learner-form';
      mode: 'create' | 'edit';
      learner: LearnerProfile | null;
    }
  | {
      type: 'learner-status';
      action: 'archive' | 'restore';
      learner: LearnerProfile;
    }
  | {
      type: 'student-access-form';
      action: Extract<StudentAccessOperationType, 'setup' | 'reset'>;
      learner: LearnerProfile;
    }
  | {
      type: 'student-access-confirm';
      action: Extract<StudentAccessOperationType, 'suspend' | 'restore' | 'revoke_sessions'>;
      learner: LearnerProfile;
    };

function PortalApp() {
  const portalRole = location.pathname.startsWith('/app/student') ? 'student' : 'parent';
  const [activeSection, setActiveSection] = useState<ParentPortalSection | StudentPortalSection>(
    () => portalSectionFromLocation(portalRole),
  );
  const [session, setSession] = useState<Awaited<ReturnType<typeof getSession>> | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [viewState, setViewState] = useState<PortalViewState>('loading');
  const [parentDashboard, setParentDashboard] = useState<ParentPortalDashboard | null>(null);
  const [studentDashboard, setStudentDashboard] = useState<StudentPortalDashboard | null>(null);
  const [liveClassQuestions, setLiveClassQuestions] = useState<LiveClassQuestion[]>([]);
  const [selectedLearnerKey, setSelectedLearnerKey] = useState<string | null>(null);
  const [parentMaterials, setParentMaterials] = useState<Record<string, ParentLearnerMaterials>>(
    {},
  );
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dialog, setDialog] = useState<PortalDialog | null>(null);
  const [dialogSaving, setDialogSaving] = useState(false);
  const [dialogError, setDialogError] = useState('');
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

  useEffect(() => {
    if (!session || portalRole !== 'student' || !studentDashboard?.upcoming_classes[0]) {
      return undefined;
    }
    const interval = window.setInterval(() => void loadLiveQuestions(studentDashboard), 4000);
    return () => window.clearInterval(interval);
  }, [session?.expires_at, portalRole, studentDashboard?.upcoming_classes[0]?.class_key]);

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
        setSelectedLearnerKey((current) =>
          current && dashboard.learners.some((learner) => learner.learner_key === current)
            ? current
            : (dashboard.learners[0]?.learner_key ?? null),
        );
      } else {
        const dashboard = await getStudentDashboard();
        setStudentDashboard(dashboard);
        await loadLiveQuestions(dashboard);
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

  async function loadLiveQuestions(dashboard = studentDashboard) {
    const occurrenceKey = dashboard?.upcoming_classes[0]?.class_key;
    if (!occurrenceKey) {
      setLiveClassQuestions([]);
      return;
    }
    try {
      setLiveClassQuestions(await getLiveClassQuestions(occurrenceKey));
    } catch {
      setLiveClassQuestions([]);
    }
  }

  async function reloadParentAfterMutation(preferredLearnerKey?: string | undefined) {
    const dashboard = await getParentDashboard();
    const nextLearnerKey =
      preferredLearnerKey &&
      dashboard.learners.some((learner) => learner.learner_key === preferredLearnerKey)
        ? preferredLearnerKey
        : selectedLearnerKey &&
            dashboard.learners.some((learner) => learner.learner_key === selectedLearnerKey)
          ? selectedLearnerKey
          : (dashboard.learners[0]?.learner_key ?? null);

    setParentDashboard(dashboard);
    setSelectedLearnerKey(nextLearnerKey);
    setParentMaterials({});
    if (nextLearnerKey) {
      const materials = await getParentMaterials(dashboard.household.household_key, nextLearnerKey);
      setParentMaterials({ [nextLearnerKey]: materials });
    }
  }

  function openCreateLearnerDialog() {
    setDialogError('');
    setDialog({ type: 'learner-form', mode: 'create', learner: null });
  }

  function openEditLearnerDialog(learnerKey: string) {
    const learner = findParentLearner(learnerKey);
    if (!learner) return;
    setDialogError('');
    setDialog({ type: 'learner-form', mode: 'edit', learner });
  }

  function openLearnerStatusDialog(learnerKey: string, action: 'archive' | 'restore') {
    const learner = findParentLearner(learnerKey);
    if (!learner) return;
    setDialogError('');
    setDialog({ type: 'learner-status', action, learner });
  }

  function openStudentAccessDialog(learnerKey: string, action: StudentAccessOperationType) {
    const learner = findParentLearner(learnerKey);
    if (!learner) return;
    setDialogError('');
    if (action === 'setup' || action === 'reset') {
      setDialog({ type: 'student-access-form', action, learner });
      return;
    }
    setDialog({ type: 'student-access-confirm', action, learner });
  }

  function findParentLearner(learnerKey: string) {
    return parentDashboard?.learners.find((entry) => entry.learner_key === learnerKey) ?? null;
  }

  async function submitLearnerForm(values: LearnerFormValues) {
    if (!session || !parentDashboard || !dialog || dialog.type !== 'learner-form') return;
    setDialogSaving(true);
    setDialogError('');
    try {
      const payload = {
        csrfToken: session.csrf_token,
        householdKey: parentDashboard.household.household_key,
        displayName: values.displayName.trim(),
        hebrewName: trimOptional(values.hebrewName),
        gradeLabel: trimOptional(values.gradeLabel),
      };
      const learner =
        dialog.mode === 'create'
          ? await createParentLearner(payload)
          : dialog.learner
            ? await updateParentLearner({
                ...payload,
                learnerKey: dialog.learner.learner_key,
                version: dialog.learner.version,
                hebrewName: trimNullable(values.hebrewName),
                gradeLabel: trimNullable(values.gradeLabel),
              })
            : null;
      if (!learner) return;
      await reloadParentAfterMutation(learner.learner_key);
      setDialog(null);
      setNotice({
        kind: 'success',
        message: dialog.mode === 'create' ? 'Learner added.' : 'Learner saved.',
      });
      setViewState('success');
    } catch (error) {
      if (handleAuthError(error)) return;
      setDialogError(errorMessage(error, 'Learner was not saved.'));
      setViewState(stateForError(error));
    } finally {
      setDialogSaving(false);
    }
  }

  async function submitLearnerStatusDialog() {
    if (!session || !parentDashboard || !dialog || dialog.type !== 'learner-status') return;
    setDialogSaving(true);
    setDialogError('');
    try {
      const learner = await setParentLearnerArchived({
        csrfToken: session.csrf_token,
        householdKey: parentDashboard.household.household_key,
        learnerKey: dialog.learner.learner_key,
        version: dialog.learner.version,
        archived: dialog.action === 'archive',
      });
      await reloadParentAfterMutation(learner.learner_key);
      setDialog(null);
      setNotice({
        kind: 'success',
        message: dialog.action === 'archive' ? 'Learner archived.' : 'Learner restored.',
      });
      setViewState('success');
    } catch (error) {
      if (handleAuthError(error)) return;
      setDialogError(errorMessage(error, 'Learner status was not updated.'));
      setViewState(stateForError(error));
    } finally {
      setDialogSaving(false);
    }
  }

  async function submitStudentAccessForm(values: StudentAccessFormValues) {
    if (!dialog || dialog.type !== 'student-access-form') return;
    await submitStudentAccess(dialog.learner, dialog.action, {
      username: trimOptional(values.username),
      password: values.password,
    });
  }

  async function submitStudentAccessConfirm() {
    if (!dialog || dialog.type !== 'student-access-confirm') return;
    await submitStudentAccess(dialog.learner, dialog.action);
  }

  async function submitStudentAccess(
    learner: LearnerProfile,
    action: StudentAccessOperationType,
    credentials?: { username?: string | undefined; password?: string | undefined } | undefined,
  ) {
    if (!session || !parentDashboard) return;
    setDialogSaving(true);
    setDialogError('');
    try {
      await runStudentAccessOperation({
        csrfToken: session.csrf_token,
        householdKey: parentDashboard.household.household_key,
        learnerKey: learner.learner_key,
        operation: action,
        username: credentials?.username,
        password: credentials?.password,
        displayName: learner.display_name,
      });
      await reloadParentAfterMutation(learner.learner_key);
      setDialog(null);
      setNotice({ kind: 'success', message: 'Student access updated.' });
      setViewState('success');
    } catch (error) {
      if (handleAuthError(error)) return;
      setDialogError(errorMessage(error, 'Student access was not updated.'));
      setViewState(stateForError(error));
    } finally {
      setDialogSaving(false);
    }
  }

  async function handleCreateRewardGoal(
    learnerKey: string,
    goal: { title: string; description: string; pointsRequired: number },
  ) {
    if (!session || !parentDashboard) return;
    try {
      await createParentRewardGoal({
        csrfToken: session.csrf_token,
        learnerKey,
        title: goal.title,
        description: goal.description || undefined,
        pointsRequired: goal.pointsRequired,
      });
      await reloadParentAfterMutation(learnerKey);
      setNotice({ kind: 'success', message: 'Parent reward added.' });
      setViewState('success');
    } catch (error) {
      if (handleAuthError(error)) return;
      setNotice({ kind: 'error', message: errorMessage(error, 'Reward was not saved.') });
      setViewState(stateForError(error));
    }
  }

  async function handleProtectedAction(action: ProtectedActionDescriptor) {
    if (!session) return;
    try {
      const result = await invokeProtectedAction(action, session.csrf_token);
      if (isProtectedActionDescriptor(result)) {
        if (result.href) {
          window.location.assign(result.href);
          return;
        }
        setNotice({ kind: 'info', message: result.label });
        return;
      }
      setNotice({
        kind: 'info',
        message: result ? `${action.label} request completed.` : action.label,
      });
    } catch (error) {
      if (handleAuthError(error)) return;
      setNotice({ kind: 'error', message: errorMessage(error, 'The protected action failed.') });
      setViewState(stateForError(error));
    }
  }

  async function handleStudentQuestion(question: string, classKey?: string | undefined) {
    if (!session || portalRole !== 'student') return;
    try {
      await submitStudentQuestion({
        csrfToken: session.csrf_token,
        question,
        classKey,
      });
      setStudentDashboard(await getStudentDashboard());
      setNotice({ kind: 'success', message: 'Question submitted.' });
      setViewState('success');
    } catch (error) {
      if (handleAuthError(error)) return;
      setNotice({ kind: 'error', message: errorMessage(error, 'Question was not submitted.') });
      setViewState(stateForError(error));
    }
  }

  async function handleStudentHelper(question: string) {
    if (!session || portalRole !== 'student') {
      throw new Error(HELPER_PREPARING_MESSAGE);
    }
    try {
      return await queryStudentHelper({
        csrfToken: session.csrf_token,
        question,
      });
    } catch (error) {
      if (handleAuthError(error)) throw error;
      setNotice({ kind: 'error', message: errorMessage(error, HELPER_PREPARING_MESSAGE) });
      setViewState(stateForError(error));
      throw error;
    }
  }

  async function handleClassroomQuestion(occurrenceKey: string, body: string) {
    if (!session || portalRole !== 'student') return;
    try {
      await submitClassroomQuestion({
        csrfToken: session.csrf_token,
        occurrenceKey,
        body,
      });
      await loadLiveQuestions();
      setNotice({ kind: 'success', message: 'Question sent.' });
      setViewState('success');
    } catch (error) {
      if (handleAuthError(error)) return;
      setNotice({ kind: 'error', message: errorMessage(error, 'Question was not sent.') });
      setViewState(stateForError(error));
    }
  }

  async function handleLiveClassReady(questionKey: string, ready: boolean) {
    if (!session || portalRole !== 'student') return;
    try {
      await markLiveClassQuestionReady({
        csrfToken: session.csrf_token,
        questionKey,
        ready,
      });
      await loadLiveQuestions();
      setNotice({
        kind: ready ? 'success' : 'info',
        message: ready ? 'Readiness sent.' : 'The Rabbi will keep your question private.',
      });
      setViewState('success');
    } catch (error) {
      if (handleAuthError(error)) return;
      setNotice({ kind: 'error', message: errorMessage(error, 'Readiness was not sent.') });
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
      setDialog(null);
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

  const navItems = useMemo<ShellNavItem[]>(() => {
    const sections = portalRole === 'parent' ? PARENT_PORTAL_SECTIONS : STUDENT_PORTAL_SECTIONS;
    const route = portalRole === 'parent' ? '/app/parent' : '/app/student';
    return sections.map((section) => ({
      id: `${portalRole}-${section.id}`,
      label: section.label,
      href: `${route}?section=${section.id}`,
      current: activeSection === section.id,
    }));
  }, [activeSection, portalRole]);
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
      workspaceClassName="app-workspace--portal"
      notice={notice ? <NoticeBanner notice={notice} /> : undefined}
      onNavigate={(href) => {
        const target = new URL(href, location.origin);
        const section = target.searchParams.get('section');
        if (
          target.pathname === location.pathname &&
          section &&
          isPortalSection(portalRole, section)
        ) {
          history.pushState({}, '', target);
          setActiveSection(section);
          return;
        }
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
          activeSection={activeSection as ParentPortalSection}
          navigationMode="shell"
          learnerMaterials={parentMaterials}
          actorFingerprint={actorFingerprint}
          onSelectSection={(section) => {
            history.pushState({}, '', `/app/parent?section=${section}`);
            setActiveSection(section);
          }}
          onSelectLearner={setSelectedLearnerKey}
          onCreateLearner={openCreateLearnerDialog}
          onEditLearner={openEditLearnerDialog}
          onArchiveLearner={(learnerKey) => openLearnerStatusDialog(learnerKey, 'archive')}
          onRestoreLearner={(learnerKey) => openLearnerStatusDialog(learnerKey, 'restore')}
          onStudentAccessAction={openStudentAccessDialog}
          onLaunchClass={(_learnerKey, action) => void handleProtectedAction(action)}
          onOpenContent={(_learnerKey, action) => void handleProtectedAction(action)}
          onPreviewSupport={() => window.location.assign('/app/support')}
          onCreateRewardGoal={(learnerKey, goal) => void handleCreateRewardGoal(learnerKey, goal)}
          onRetry={() => void load()}
        />
      ) : (
        <StudentPortalFeature
          viewState={viewState}
          dashboard={studentDashboard}
          activeSection={activeSection as StudentPortalSection}
          navigationMode="shell"
          actorFingerprint={actorFingerprint}
          onSelectSection={(section) => {
            history.pushState({}, '', `/app/student?section=${section}`);
            setActiveSection(section);
          }}
          onLaunchClass={(action) => void handleProtectedAction(action)}
          onOpenContent={(action) => void handleProtectedAction(action)}
          onQueryHelper={(question) => handleStudentHelper(question)}
          onSubmitQuestion={(question, classKey) => void handleStudentQuestion(question, classKey)}
          onSubmitClassroomQuestion={(occurrenceKey, body) =>
            void handleClassroomQuestion(occurrenceKey, body)
          }
          liveClassQuestions={liveClassQuestions}
          onMarkLiveClassReady={(questionKey, ready) =>
            void handleLiveClassReady(questionKey, ready)
          }
          onPreviewSupport={() => window.location.assign('/app/support')}
          onRetry={() => void load()}
        />
      )}
      <PortalDialogRenderer
        dialog={dialog}
        saving={dialogSaving}
        error={dialogError}
        onClose={() => {
          if (dialogSaving) return;
          setDialog(null);
          setDialogError('');
        }}
        onSubmitLearner={submitLearnerForm}
        onSubmitLearnerStatus={() => void submitLearnerStatusDialog()}
        onSubmitStudentAccessForm={(values) => void submitStudentAccessForm(values)}
        onSubmitStudentAccessConfirm={() => void submitStudentAccessConfirm()}
      />
    </AppShell>
  );
}

function PortalDialogRenderer({
  dialog,
  saving,
  error,
  onClose,
  onSubmitLearner,
  onSubmitLearnerStatus,
  onSubmitStudentAccessForm,
  onSubmitStudentAccessConfirm,
}: {
  dialog: PortalDialog | null;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmitLearner: (values: LearnerFormValues) => void | Promise<void>;
  onSubmitLearnerStatus: () => void;
  onSubmitStudentAccessForm: (values: StudentAccessFormValues) => void;
  onSubmitStudentAccessConfirm: () => void;
}) {
  if (!dialog) return null;
  if (dialog.type === 'learner-form') {
    return (
      <LearnerFormDialog
        mode={dialog.mode}
        learner={dialog.learner}
        saving={saving}
        error={error}
        onClose={onClose}
        onSubmit={onSubmitLearner}
      />
    );
  }
  if (dialog.type === 'learner-status') {
    return (
      <ConfirmDialog
        title={`${label(dialog.action)} learner`}
        body={
          dialog.action === 'archive'
            ? `Archive ${dialog.learner.display_name}? This frees one active learner seat and pauses student access.`
            : `Restore ${dialog.learner.display_name}? This uses one active learner seat.`
        }
        confirmLabel={dialog.action === 'archive' ? 'Archive' : 'Restore'}
        danger={dialog.action === 'archive'}
        saving={saving}
        error={error}
        onClose={onClose}
        onConfirm={onSubmitLearnerStatus}
      />
    );
  }
  if (dialog.type === 'student-access-form') {
    return (
      <StudentAccessFormDialog
        action={dialog.action}
        learner={dialog.learner}
        saving={saving}
        error={error}
        onClose={onClose}
        onSubmit={onSubmitStudentAccessForm}
      />
    );
  }
  return (
    <ConfirmDialog
      title={`${studentAccessLabel(dialog.action)} student access`}
      body={`${studentAccessLabel(dialog.action)} student access for ${dialog.learner.display_name}?`}
      confirmLabel={studentAccessLabel(dialog.action)}
      danger={dialog.action === 'suspend'}
      saving={saving}
      error={error}
      onClose={onClose}
      onConfirm={onSubmitStudentAccessConfirm}
    />
  );
}

function LearnerFormDialog({
  mode,
  learner,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  learner: LearnerProfile | null;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (values: LearnerFormValues) => void | Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(learner?.display_name ?? '');
  const [hebrewName, setHebrewName] = useState(learner?.hebrew_name ?? '');
  const [gradeLabel, setGradeLabel] = useState(learner?.grade_label ?? '');
  const title = mode === 'create' ? 'Add learner' : 'Edit learner';
  const canSave = displayName.trim().length > 0 && !saving;
  return (
    <DialogFrame
      title={title}
      description="Keep learner names simple and parent-visible."
      error={error}
      onClose={onClose}
    >
      <form
        className="ot-dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSave) return;
          void onSubmit({ displayName, hebrewName, gradeLabel });
        }}
      >
        <label className="ot-field">
          <span>Display name</span>
          <input
            value={displayName}
            maxLength={160}
            autoFocus
            required
            onChange={(event) => setDisplayName(event.currentTarget.value)}
          />
        </label>
        <label className="ot-field">
          <span>Hebrew name</span>
          <input
            value={hebrewName}
            maxLength={160}
            onChange={(event) => setHebrewName(event.currentTarget.value)}
          />
        </label>
        <label className="ot-field">
          <span>Grade</span>
          <input
            value={gradeLabel}
            maxLength={80}
            onChange={(event) => setGradeLabel(event.currentTarget.value)}
          />
        </label>
        <DialogActions
          saving={saving}
          confirmLabel={mode === 'create' ? 'Add learner' : 'Save learner'}
          confirmDisabled={!canSave}
          onClose={onClose}
        />
      </form>
    </DialogFrame>
  );
}

function StudentAccessFormDialog({
  action,
  learner,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  action: Extract<StudentAccessOperationType, 'setup' | 'reset'>;
  learner: LearnerProfile;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (values: StudentAccessFormValues) => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const usernameRequired = action === 'setup';
  const usernameReady = !usernameRequired || username.trim().length >= 3;
  const passwordReady =
    password.length >= 10 && /[A-Za-z]/.test(password) && /[0-9]/.test(password);
  const canSave = !saving && usernameReady && passwordReady;
  return (
    <DialogFrame
      title={`${studentAccessLabel(action)} student access`}
      description={`${studentAccessLabel(action)} parent-managed login access for ${learner.display_name}.`}
      error={error}
      onClose={onClose}
    >
      <form
        className="ot-dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSave) return;
          onSubmit({ username, password });
        }}
      >
        <label className="ot-field">
          <span>{usernameRequired ? 'Student username' : 'Student username optional'}</span>
          <input
            value={username}
            autoFocus
            required={usernameRequired}
            autoComplete="username"
            inputMode="text"
            maxLength={24}
            pattern="[A-Za-z0-9][A-Za-z0-9._-]*[A-Za-z0-9]"
            onChange={(event) => setUsername(event.currentTarget.value)}
          />
        </label>
        <label className="ot-field">
          <span>Student password</span>
          <input
            type="password"
            value={password}
            required
            minLength={10}
            maxLength={128}
            autoComplete="new-password"
            onChange={(event) => setPassword(event.currentTarget.value)}
          />
        </label>
        <p className="ot-muted">
          These parent-managed credentials are stored for student access. No student email is used
          in this setup.
        </p>
        <DialogActions
          saving={saving}
          confirmLabel={studentAccessLabel(action)}
          confirmDisabled={!canSave}
          onClose={onClose}
        />
      </form>
    </DialogFrame>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger = false,
  saving,
  error,
  onClose,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  saving: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <DialogFrame title={title} description={body} error={error} onClose={onClose}>
      <div className="ot-dialog-form">
        <DialogActions
          saving={saving}
          confirmLabel={confirmLabel}
          confirmDanger={danger}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      </div>
    </DialogFrame>
  );
}

function DialogFrame({
  title,
  description,
  error,
  children,
  onClose,
}: {
  title: string;
  description: string;
  error: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const titleId = 'portal-dialog-title';
  const descriptionId = 'portal-dialog-description';
  return (
    <div className="ot-dialog-backdrop" role="presentation">
      <section
        className="ot-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className="ot-dialog-head">
          <div>
            <p className="ot-kicker">One Time portal</p>
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId}>{description}</p>
          </div>
          <button type="button" className="ot-icon-button" aria-label="Close" onClick={onClose}>
            x
          </button>
        </div>
        {error && (
          <p className="notice-banner error" role="alert">
            {error}
          </p>
        )}
        {children}
      </section>
    </div>
  );
}

function DialogActions({
  saving,
  confirmLabel,
  confirmDisabled = false,
  confirmDanger = false,
  onClose,
  onConfirm,
}: {
  saving: boolean;
  confirmLabel: string;
  confirmDisabled?: boolean;
  confirmDanger?: boolean;
  onClose: () => void;
  onConfirm?: () => void;
}) {
  return (
    <div className="ot-dialog-actions">
      <button type="button" className="ot-button" disabled={saving} onClick={onClose}>
        Cancel
      </button>
      <button
        type={onConfirm ? 'button' : 'submit'}
        className={confirmDanger ? 'ot-button ot-button-danger' : 'ot-button ot-button-primary'}
        disabled={saving || confirmDisabled}
        onClick={onConfirm}
      >
        {saving ? 'Saving' : confirmLabel}
      </button>
    </div>
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

function trimOptional(value: string) {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function trimNullable(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function isProtectedActionDescriptor(value: unknown): value is ProtectedActionDescriptor {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'action_key' in value &&
    'kind' in value &&
    'label' in value,
  );
}

function studentAccessLabel(action: StudentAccessOperationType) {
  if (action === 'setup') return 'Setup';
  if (action === 'reset') return 'Reset';
  if (action === 'suspend') return 'Suspend';
  if (action === 'restore') return 'Restore';
  return 'Revoke sessions';
}

function label(value: string) {
  return value.replaceAll('_', ' ').replace(/^\w/, (letter) => letter.toUpperCase());
}

function portalSectionFromLocation(
  role: 'parent' | 'student',
): ParentPortalSection | StudentPortalSection {
  const requested = new URLSearchParams(location.search).get('section');
  if (requested && isPortalSection(role, requested)) return requested;
  return role === 'parent' ? 'learners' : 'today';
}

function isPortalSection(
  role: 'parent' | 'student',
  value: string,
): value is ParentPortalSection | StudentPortalSection {
  const sections = role === 'parent' ? PARENT_PORTAL_SECTIONS : STUDENT_PORTAL_SECTIONS;
  return sections.some((section) => section.id === value);
}

const root = document.getElementById('portal-root');
if (root) {
  createRoot(root).render(<PortalApp />);
}
