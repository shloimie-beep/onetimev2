import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  STUDENT_PORTAL_SECTIONS,
  type ParentPortalSection,
  type PortalViewState,
  type StudentPortalSection,
} from '../features/portals/PortalFeatures.js';
import { ParentClientRoot, StudentClientRoot, resolveCurrentClientRoute } from './router/index.js';
import { ParentHouseholdWorkspace, type ParentHouseholdView } from './parent/household/index.js';
import { ParentSummaryWorkspace, type ParentSummaryView } from './parent/summary/index.js';
import { ParentBillingContainer } from './parent/billing/index.js';
import { ParentPreferencesWorkspace } from './parent/preferences/index.js';
import { ParentPrivacyWorkspace } from './parent/privacy/index.js';
import { StudentCalendar } from './student/calendar/index.js';
import { StudentLibraryWorkspace } from './student/library/index.js';
import { StudentLearningOverview } from './student/learning/StudentLearningOverview.js';
import { StudentClassroomWorkspace } from './student/classroom/StudentClassroomWorkspace.js';
import {
  StudentNotificationCenter,
  loadStudentNotifications,
  markAllStudentNotificationsRead,
  markStudentNotificationRead,
  openStudentNotificationAction,
  setStudentNotificationSoundPreference,
  type ForegroundCueCandidate,
} from './student/notifications/index.js';
import type {
  StudentNotificationCenterSnapshot,
  StudentNotificationFilter,
} from '../../../../../packages/contracts/src/notifications/student/index.ts';
import { SupportFeature } from './support/SupportFeature.js';
import { AppShell, type ShellNavItem, type ShellUser } from './shell/AppShell.js';
import {
  PortalApiError,
  changeOwnPassword,
  createParentLearner,
  getParentAccessShell,
  getParentDashboard,
  getParentMaterials,
  getLiveClassQuestions,
  getSession,
  getStudentDashboard,
  getStudentLearningSnapshot,
  invokeProtectedAction,
  logoutSession,
  markLiveClassQuestionReady,
  runStudentAccessOperation,
  requestParentRecovery,
  setParentLearnerArchived,
  submitClassroomQuestion,
  submitLearningQuestion,
  submitStudentQuestion,
  updateParentLearner,
  type V21ApiSession,
  type StudentLearningSnapshot,
} from './portal-api.js';
import './crm.css';

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
      action: Extract<
        StudentAccessOperationType,
        'reset' | 'suspend' | 'restore' | 'revoke_sessions'
      >;
      learner: LearnerProfile;
    };

function PortalApp() {
  const portalRole = portalRoleFromLocation(location.pathname);
  const classroomRoute = location.pathname === '/app/classroom';
  const supportRoute = location.pathname.match(
    portalRole === 'parent'
      ? /^\/app\/parent\/support(?:\/([^/]+))?$/u
      : /^\/app\/student\/support(?:\/([^/]+))?$/u,
  );
  const studentCalendarRoute =
    portalRole === 'student' && location.pathname === '/app/student/calendar';
  const studentNotificationsRoute =
    portalRole === 'student' && location.pathname === '/app/student/notifications';
  const studentAccountRoute =
    portalRole === 'student' && location.pathname === '/app/student/account';
  const selectedClassKey = portalClassKeyFromLocation(location.pathname, portalRole);
  const selectedStudentLibraryContentId = studentLibraryContentIdFromLocation(location.pathname);
  const v21ParentView = v21ParentRouteViewFromLocation(location.pathname);
  const [activeSection, setActiveSection] = useState<ParentPortalSection | StudentPortalSection>(
    () => portalSectionFromLocation(portalRole),
  );
  const [session, setSession] = useState<Awaited<ReturnType<typeof getSession>> | null>(null);
  const [v21ParentSession, setV21ParentSession] = useState<V21ApiSession | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [viewState, setViewState] = useState<PortalViewState>('loading');
  const [parentDashboard, setParentDashboard] = useState<ParentPortalDashboard | null>(null);
  const [parentAccessShell, setParentAccessShell] = useState<Awaited<
    ReturnType<typeof getParentAccessShell>
  > | null>(null);
  const [studentDashboard, setStudentDashboard] = useState<StudentPortalDashboard | null>(null);
  const [studentLearning, setStudentLearning] = useState<StudentLearningSnapshot | null>(null);
  const [studentNotifications, setStudentNotifications] =
    useState<StudentNotificationCenterSnapshot | null>(null);
  const [studentNotificationError, setStudentNotificationError] = useState('');
  const [newNotificationCue, setNewNotificationCue] = useState<ForegroundCueCandidate | null>(null);
  const seenNotificationIds = useRef(new Set<string>());
  const notificationCenterInitialized = useRef(false);
  const notificationAudioPermitted = useRef(false);
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
    if (classroomRoute && (location.search || location.hash)) {
      history.replaceState({}, '', '/app/classroom');
    }
    void load();
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setActiveSection(portalSectionFromLocation(portalRole));
      document.getElementById('app-main')?.focus();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [portalRole]);

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

  useEffect(() => {
    if (!studentNotificationsRoute || !session || portalRole !== 'student') return undefined;
    const interval = window.setInterval(() => {
      const filter = studentNotifications?.filter ?? 'unread';
      if (filter !== 'read') void refreshStudentNotifications(filter, true);
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [portalRole, session?.expires_at, studentNotifications?.filter, studentNotificationsRoute]);

  async function load() {
    setViewState('loading');
    setNotice(null);
    try {
      const nextSession = await getSession();
      setSession(nextSession);
      setSessionExpired(false);
      if (nextSession.user.role !== portalRole) {
        setV21ParentSession(null);
        setViewState('permission');
        return;
      }
      if (classroomRoute) {
        setV21ParentSession(null);
        setParentAccessShell(null);
        setParentDashboard(null);
        setStudentDashboard(null);
        setStudentLearning(null);
        setLiveClassQuestions([]);
        setViewState('ready');
        return;
      }
      if (nextSession.session_model === 'v21') {
        setV21ParentSession(nextSession);
        setParentAccessShell(null);
        setParentDashboard(null);
        setSelectedLearnerKey(null);
        setViewState('ready');
        return;
      }
      setV21ParentSession(null);
      if (portalRole === 'parent') {
        const shell = await getParentAccessShell();
        setParentAccessShell(shell);
        if (shell.mode === 'active') {
          const dashboard = await getParentDashboard();
          setParentDashboard(dashboard);
          const routeLearnerKey = selectedClassKey
            ? dashboard.learners.find((learner) =>
                dashboard.upcoming_classes[learner.learner_key]?.some(
                  ({ class_key }) => class_key === selectedClassKey,
                ),
              )?.learner_key
            : undefined;
          setSelectedLearnerKey((current) =>
            routeLearnerKey
              ? routeLearnerKey
              : current && dashboard.learners.some((learner) => learner.learner_key === current)
                ? current
                : (dashboard.learners[0]?.learner_key ?? null),
          );
        } else {
          setParentDashboard(null);
          setSelectedLearnerKey(null);
        }
      } else {
        const dashboard = await getStudentDashboard();
        setStudentDashboard(dashboard);
        await loadLiveQuestions(dashboard);
        try {
          setStudentLearning(await getStudentLearningSnapshot());
        } catch {
          setStudentLearning(null);
        }
        if (location.pathname === '/app/student/notifications') {
          await refreshStudentNotifications('unread', false);
        } else {
          setStudentNotifications(null);
          setStudentNotificationError('');
        }
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

  async function refreshStudentNotifications(
    filter: StudentNotificationFilter,
    detectNew: boolean,
  ) {
    try {
      const next = await loadStudentNotifications(filter);
      const newUnread =
        detectNew && notificationCenterInitialized.current
          ? next.notifications.find(
              ({ notification, lifecycle }) =>
                lifecycle === 'unread' && !seenNotificationIds.current.has(notification.id),
            )
          : undefined;
      seenNotificationIds.current = new Set(
        next.notifications.map(({ notification }) => notification.id),
      );
      notificationCenterInitialized.current = true;
      setStudentNotifications(next);
      setStudentNotificationError('');
      if (newUnread) {
        setNewNotificationCue({
          notificationId: newUnread.notification.id,
          disposition: 'created',
          portalVisibility: document.visibilityState === 'visible' ? 'foreground' : 'background',
          browserInteractionPermitsAudio: notificationAudioPermitted.current,
        });
      }
    } catch (error) {
      if (handleAuthError(error)) return;
      setStudentNotificationError(errorMessage(error, 'Notifications could not load.'));
    }
  }

  async function markNotificationRead(notificationId: string) {
    if (!session) return;
    try {
      await markStudentNotificationRead(session.csrf_token, notificationId);
      await refreshStudentNotifications(studentNotifications?.filter ?? 'unread', false);
    } catch (error) {
      setNotice({ kind: 'error', message: errorMessage(error, 'Notification was not updated.') });
    }
  }

  async function markAllNotificationsRead() {
    if (!session) return;
    try {
      await markAllStudentNotificationsRead(session.csrf_token);
      await refreshStudentNotifications(studentNotifications?.filter ?? 'unread', false);
    } catch (error) {
      setNotice({ kind: 'error', message: errorMessage(error, 'Notifications were not updated.') });
    }
  }

  async function changeNotificationSoundPreference(enabled: boolean) {
    if (!session) return;
    notificationAudioPermitted.current = enabled;
    try {
      await setStudentNotificationSoundPreference(session.csrf_token, enabled);
      setStudentNotifications((current) =>
        current ? { ...current, soundEnabled: enabled } : null,
      );
    } catch (error) {
      setNotice({ kind: 'error', message: errorMessage(error, 'Sound preference was not saved.') });
    }
  }

  async function openNotificationAction(notificationId: string) {
    if (!session) return;
    notificationAudioPermitted.current = true;
    try {
      const decision = await openStudentNotificationAction(session.csrf_token, notificationId);
      if (decision.status === 'allowed' && decision.route) {
        window.location.assign(decision.route);
        return;
      }
      setNotice({ kind: 'info', message: decision.message ?? 'No longer available' });
      await refreshStudentNotifications(studentNotifications?.filter ?? 'unread', false);
    } catch (error) {
      setNotice({
        kind: 'error',
        message: errorMessage(error, 'Notification action unavailable.'),
      });
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
    if (action === 'setup') {
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

  async function handlePasswordChange(input: { currentPassword: string; newPassword: string }) {
    if (!session) throw new Error('Please sign in again.');
    try {
      const result = await changeOwnPassword({
        csrfToken: session.csrf_token,
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
      });
      setNotice({ kind: 'success', message: 'Password changed securely.' });
      return result;
    } catch (error) {
      if (handleAuthError(error)) throw error;
      throw error;
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
      setV21ParentSession(null);
      setParentDashboard(null);
      setStudentDashboard(null);
      setDialog(null);
      setViewState('session-expired');
      return true;
    }
    return false;
  }

  function signIn() {
    window.location.assign(
      classroomRoute
        ? '/login?return_to=%2Fapp%2Fstudent'
        : `/login?return_to=${encodeURIComponent(`${location.pathname}${location.search}`)}`,
    );
  }

  async function logout() {
    if (!session) return;
    const currentSession = session;
    setNotice({ kind: 'info', message: 'Signing out securely...' });
    try {
      await logoutSession(currentSession);
      setSessionExpired(true);
      setSession(null);
      setV21ParentSession(null);
      window.location.assign('/login');
    } catch (error) {
      setNotice({
        kind: 'error',
        message: errorMessage(
          error,
          'Sign out could not be verified. Check your connection and try again.',
        ),
      });
    }
  }

  const navItems = useMemo<ShellNavItem[]>(() => {
    if (classroomRoute) {
      return [
        {
          id: 'student-portal',
          label: 'Student Portal',
          href: '/app/student',
          current: false,
        },
        {
          id: 'student-classroom',
          label: 'Classroom',
          href: '/app/classroom',
          current: true,
        },
      ];
    }
    if (v21ParentSession) {
      return [
        {
          id: 'v21-parent-students',
          label: 'Students',
          href: '/app/parent/students',
          current: location.pathname.startsWith('/app/parent/students'),
        },
        {
          id: 'v21-parent-calendar',
          label: 'Calendar',
          href: '/app/parent/calendar',
          current:
            location.pathname === '/app/parent/calendar' ||
            location.pathname.startsWith('/app/parent/classes/'),
        },
        {
          id: 'v21-parent-progress',
          label: 'Progress',
          href: '/app/parent/progress',
          current: location.pathname.startsWith('/app/parent/progress'),
        },
        {
          id: 'v21-parent-updates',
          label: 'Updates',
          href: '/app/parent/updates',
          current:
            location.pathname === '/app/parent/updates' ||
            location.pathname === '/app/parent/newsletter',
        },
        {
          id: 'v21-parent-billing',
          label: 'Billing',
          href: '/app/parent/billing',
          current: location.pathname === '/app/parent/billing',
        },
        {
          id: 'v21-parent-preferences',
          label: 'Preferences',
          href: '/app/parent/preferences',
          current: location.pathname === '/app/parent/preferences',
        },
        {
          id: 'v21-parent-support',
          label: 'Support',
          href: '/app/parent/support',
          current: location.pathname.startsWith('/app/parent/support'),
        },
        {
          id: 'v21-parent-account',
          label: 'Account',
          href: '/app/parent/account',
          current:
            location.pathname === '/app/parent/account' ||
            location.pathname === '/app/parent/privacy' ||
            location.pathname === '/app/parent/data-rights',
        },
      ];
    }
    if (portalRole === 'parent') {
      return [
        {
          id: 'parent-students',
          label: 'Students',
          href: '/app/parent/students',
          current: activeSection === 'learners',
        },
        {
          id: 'parent-classes',
          label: 'Classes & materials',
          href: '/app/parent?section=classes',
          current: activeSection === 'classes',
        },
        {
          id: 'parent-progress',
          label: 'Progress & rewards',
          href: '/app/parent?section=progress',
          current: activeSection === 'progress',
        },
        {
          id: 'parent-billing',
          label: 'Billing',
          href: '/app/parent?section=billing',
          current: activeSection === 'billing',
        },
        {
          id: 'parent-updates',
          label: 'Updates',
          href: '/app/parent?section=updates',
          current: activeSection === 'updates',
        },
      ];
    }
    return [
      {
        id: 'student-today',
        label: 'Today',
        href: '/app/student',
        current: location.pathname === '/app/student',
      },
      {
        id: 'student-calendar',
        label: 'Calendar',
        href: '/app/student/calendar',
        current: studentCalendarRoute || location.pathname.startsWith('/app/student/classes/'),
      },
      {
        id: 'student-library',
        label: 'Library',
        href: '/app/student/library',
        current: activeSection === 'library',
      },
      {
        id: 'student-progress',
        label: 'Progress',
        href: '/app/student/progress',
        current: activeSection === 'progress',
      },
      {
        id: 'student-questions',
        label: 'Questions',
        href: '/app/student/questions',
        current: activeSection === 'questions',
      },
      {
        id: 'student-updates',
        label: 'Updates',
        href: '/app/student/updates',
        current: activeSection === 'updates',
      },
      {
        id: 'student-notifications',
        label: 'Notifications',
        href: '/app/student/notifications',
        current: studentNotificationsRoute,
      },
      {
        id: 'student-support',
        label: 'Support',
        href: '/app/student/support',
        current: location.pathname.startsWith('/app/student/support'),
      },
      {
        id: 'student-account',
        label: 'Account',
        href: '/app/student/account',
        current: studentAccountRoute,
      },
    ];
  }, [
    activeSection,
    classroomRoute,
    portalRole,
    studentAccountRoute,
    studentCalendarRoute,
    studentNotificationsRoute,
    v21ParentSession,
  ]);
  const title = classroomRoute
    ? 'Classroom'
    : portalRole === 'parent'
      ? 'Parent Portal'
      : 'Student Portal';
  const description = classroomRoute
    ? 'Protected Student classroom'
    : portalRole === 'parent'
      ? (v21ParentSession?.parent_context.household.display_name ??
        parentDashboard?.household.display_name ??
        'Household')
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
        if (href.startsWith('#')) {
          history.pushState({}, '', href);
          document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
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
        setActiveSection(portalSectionFromLocation(portalRole));
        void load();
      }}
      onLogout={() => void logout()}
      sessionExpired={sessionExpired}
      onSignIn={signIn}
      roleContext={
        session?.session_model === 'v21' && session.account_context
          ? {
              activeRole: session.account_context.active_role,
              availableRoles: session.account_context.available_roles,
              csrfToken: session.csrf_token,
            }
          : undefined
      }
    >
      {supportRoute ? (
        <SupportFeature
          receiptId={supportRoute[1] ? decodeURIComponent(supportRoute[1]) : undefined}
          basePath={portalRole === 'parent' ? '/app/parent/support' : '/app/student/support'}
          onProtectedStateCleared={() => {
            setSessionExpired(true);
            setSession(null);
          }}
        />
      ) : portalRole === 'parent' ? (
        v21ParentSession ? (
          v21ParentView.kind === 'summary' ? (
            <ParentSummaryWorkspace view={v21ParentView.view} />
          ) : v21ParentView.kind === 'billing' ? (
            <ParentBillingContainer />
          ) : v21ParentView.kind === 'preferences' ? (
            <ParentPreferencesWorkspace />
          ) : v21ParentView.kind === 'privacy' ? (
            <ParentPrivacyWorkspace initialView={v21ParentView.view} />
          ) : v21ParentView.kind === 'account' ? (
            <section className="ot-portal-feature" aria-labelledby="v21-parent-account-heading">
              <div className="ot-panel">
                <p className="ot-eyebrow">Parent account</p>
                <h2 id="v21-parent-account-heading">Account and security</h2>
                {session ? (
                  <AccountSecurityPanel
                    identifier={session.user.email}
                    role={session.user.role}
                    roleLabel={session.user.role_label}
                    onChangePassword={handlePasswordChange}
                  />
                ) : null}
                <p>
                  <a href="/forgot-password">Use secure account recovery</a> if you cannot change
                  your password while signed in.
                </p>
              </div>
            </section>
          ) : (
            <ParentHouseholdWorkspace view={v21ParentView.view} />
          )
        ) : parentAccessShell?.mode === 'paused' ? (
          <ParentPausedShell
            displayName={parentAccessShell.display_name}
            activeSection={activeSection as ParentPortalSection}
            accountSecurity={
              session ? (
                <AccountSecurityPanel
                  identifier={session.user.email}
                  role={session.user.role}
                  roleLabel={session.user.role_label}
                  onChangePassword={handlePasswordChange}
                />
              ) : null
            }
            onRecovery={async () => {
              if (!session) return;
              try {
                await requestParentRecovery({
                  csrfToken: session.csrf_token,
                  householdKey: parentAccessShell.primary_household_key,
                });
                setNotice({
                  kind: 'success',
                  message: 'If this Parent account is eligible, a secure reset link was queued.',
                });
              } catch (error) {
                if (handleAuthError(error)) return;
                setNotice({
                  kind: 'error',
                  message: errorMessage(error, 'Recovery could not be requested.'),
                });
              }
            }}
          />
        ) : (
          <ParentClientRoot
            viewState={viewState}
            dashboard={parentDashboard}
            selectedLearnerKey={selectedLearner?.learner_key ?? null}
            selectedClassKey={selectedClassKey}
            activeSection={activeSection as ParentPortalSection}
            navigationMode="shell"
            learnerMaterials={parentMaterials}
            actorFingerprint={actorFingerprint}
            onSelectSection={(section) => {
              history.pushState(
                {},
                '',
                section === 'learners' ? '/app/parent/students' : `/app/parent?section=${section}`,
              );
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
            onRetry={() => void load()}
            accountSecurity={
              session ? (
                <AccountSecurityPanel
                  identifier={session.user.email}
                  role={session.user.role}
                  roleLabel={session.user.role_label}
                  onChangePassword={handlePasswordChange}
                />
              ) : null
            }
          />
        )
      ) : classroomRoute ? (
        session ? (
          <StudentClassroomWorkspace
            csrfToken={session.csrf_token}
            actorFingerprint={actorFingerprint}
            onProtectedStateCleared={() => void load()}
          />
        ) : null
      ) : studentCalendarRoute ? (
        studentDashboard ? (
          <StudentCalendar
            classes={studentDashboard.upcoming_classes}
            onLaunch={(action) => void handleProtectedAction(action)}
          />
        ) : (
          <p role="status">Loading Student calendar...</p>
        )
      ) : studentNotificationsRoute ? (
        studentNotifications ? (
          <StudentNotificationCenter
            snapshot={studentNotifications}
            studentTimeZone="Asia/Jerusalem"
            newlyRenderedNotice={newNotificationCue}
            onFilterChange={(filter) => void refreshStudentNotifications(filter, false)}
            onMarkRead={(notificationId) => void markNotificationRead(notificationId)}
            onMarkAllRead={() => void markAllNotificationsRead()}
            onOpenAction={(notificationId) => void openNotificationAction(notificationId)}
            onSoundPreferenceChange={(enabled) => void changeNotificationSoundPreference(enabled)}
            onPlayForegroundCue={playStudentNotificationCue}
          />
        ) : (
          <section aria-live="polite">
            <h2>Notifications</h2>
            <p>{studentNotificationError || 'Loading notifications...'}</p>
          </section>
        )
      ) : studentAccountRoute ? (
        <section className="ot-portal-feature" aria-labelledby="student-account-heading">
          <div className="ot-panel">
            <p className="ot-eyebrow">Student account</p>
            <h2 id="student-account-heading">Account and security</h2>
            {session ? (
              <AccountSecurityPanel
                identifier={session.user.email}
                role={session.user.role}
                roleLabel={session.user.role_label}
                onChangePassword={handlePasswordChange}
              />
            ) : null}
          </div>
        </section>
      ) : (
        <StudentClientRoot
          viewState={viewState}
          dashboard={studentDashboard}
          selectedClassKey={selectedClassKey}
          activeSection={activeSection as StudentPortalSection}
          navigationMode="shell"
          actorFingerprint={actorFingerprint}
          onSelectSection={(section) => {
            const canonicalSectionPath: Partial<Record<StudentPortalSection, string>> = {
              today: '/app/student',
              library: '/app/student/library',
            };
            history.pushState(
              {},
              '',
              canonicalSectionPath[section] ?? `/app/student?section=${section}`,
            );
            setActiveSection(section);
          }}
          onLaunchClass={(action) => void handleProtectedAction(action)}
          onOpenContent={(action) => void handleProtectedAction(action)}
          onSubmitQuestion={(question, classKey) => void handleStudentQuestion(question, classKey)}
          onSubmitClassroomQuestion={(occurrenceKey, body) =>
            void handleClassroomQuestion(occurrenceKey, body)
          }
          liveClassQuestions={liveClassQuestions}
          onMarkLiveClassReady={(questionKey, ready) =>
            void handleLiveClassReady(questionKey, ready)
          }
          onPreviewSupport={() => window.location.assign('/app/student/support')}
          onRetry={() => void load()}
          libraryWorkspace={
            session ? (
              <StudentLibraryWorkspace
                csrfToken={session.csrf_token}
                actorFingerprint={actorFingerprint}
                onProtectedStateCleared={() => void load()}
                selectedContentId={selectedStudentLibraryContentId}
              />
            ) : undefined
          }
          libraryDetailMode={selectedStudentLibraryContentId !== undefined}
          accountSecurity={
            session ? (
              <AccountSecurityPanel
                identifier={session.user.email}
                role={session.user.role}
                roleLabel={session.user.role_label}
                onChangePassword={handlePasswordChange}
              />
            ) : null
          }
          learningOverview={
            session && studentLearning ? (
              <StudentLearningOverview
                questions={studentLearning.questions}
                publishedQuestions={studentLearning.publishedQuestions}
                announcements={studentLearning.announcements}
                badges={studentLearning.badges}
                leaderboard={studentLearning.leaderboard}
                onSubmitQuestion={async (body) => {
                  await submitLearningQuestion({ csrfToken: session.csrf_token, body });
                  setStudentLearning(await getStudentLearningSnapshot());
                }}
              />
            ) : undefined
          }
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

function ParentPausedShell({
  displayName,
  activeSection,
  accountSecurity,
  onRecovery,
}: {
  displayName: string;
  activeSection: ParentPortalSection;
  accountSecurity: React.ReactNode;
  onRecovery: () => void | Promise<void>;
}) {
  if (activeSection !== 'learners' && activeSection !== 'billing') {
    return (
      <section className="ot-portal-feature" aria-labelledby="paused-parent-title">
        <div className="ot-panel">
          <p className="ot-eyebrow">Parent portal</p>
          <h2 id="paused-parent-title">{parentSectionLabel(activeSection)}</h2>
          <p>
            Learning access is paused, so this private area is unavailable. Your Parent identity
            remains active; open Learners for account recovery or Billing for the access
            explanation.
          </p>
        </div>
      </section>
    );
  }

  if (activeSection === 'billing') {
    return (
      <section className="ot-portal-feature" aria-labelledby="paused-parent-title">
        <div className="ot-panel">
          <p className="ot-eyebrow">Billing</p>
          <h2 id="paused-parent-title">Learning access is paused</h2>
          <p>
            Current paid or complimentary access is not active. No learning content is available
            until access is restored.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="ot-portal-feature" aria-labelledby="paused-parent-title">
      <div className="ot-panel" id="identity">
        <p className="ot-eyebrow">Parent account</p>
        <h2 id="paused-parent-title">Learning access is paused</h2>
        <p>
          {displayName}, your Parent identity remains available. Student and learning routes stay
          closed until current paid or complimentary access is restored.
        </p>
      </div>
      <div className="ot-panel" id="recovery">
        <h3>Secure recovery</h3>
        <p>Request a protected reset link. Your password is never shown to an Administrator.</p>
        <button
          className="ot-button ot-button--primary"
          type="button"
          onClick={() => void onRecovery()}
        >
          Send reset link
        </button>
      </div>
      <div className="ot-panel" id="support">
        <h3>Support</h3>
        <p>Open private Parent support for help restoring learning access.</p>
        <a className="ot-button ot-button--secondary" href="/app/parent/support">
          Open Support
        </a>
      </div>
      <div id="account-security">{accountSecurity}</div>
    </section>
  );
}

function parentSectionLabel(section: ParentPortalSection) {
  return PARENT_PORTAL_SECTIONS.find((entry) => entry.id === section)?.label ?? 'Parent portal';
}

function AccountSecurityPanel({
  identifier,
  role,
  roleLabel,
  onChangePassword,
}: {
  identifier: string;
  role: SessionUser['role'];
  roleLabel: string;
  onChangePassword: (input: {
    currentPassword: string;
    newPassword: string;
  }) => Promise<{ sessions_invalidated: number }>;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const passwordReady =
    newPassword.length >= 10 && /[A-Za-z]/u.test(newPassword) && /[0-9]/u.test(newPassword);
  const canSubmit =
    !saving &&
    currentPassword.length > 0 &&
    passwordReady &&
    newPassword === confirmPassword &&
    newPassword !== currentPassword;

  if (role === 'student') {
    return (
      <section className="ot-subsection" aria-labelledby="account-security-heading">
        <div className="ot-section-title">
          <div>
            <h3 id="account-security-heading">Account &amp; security</h3>
            <p>Student credentials are adult-managed.</p>
          </div>
          <span>{roleLabel}</span>
        </div>
        <dl className="ot-mini-metrics">
          <div>
            <dt>Sign-in identifier</dt>
            <dd>{displaySignInIdentifier(identifier, role)}</dd>
          </div>
          <div>
            <dt>Session</dt>
            <dd>Secure and active</dd>
          </div>
        </dl>
        <p className="ot-muted">
          Student passwords are managed by a Parent or Administrator. Ask them to send a secure
          reset.
        </p>
      </section>
    );
  }

  return (
    <section className="ot-subsection" aria-labelledby="account-security-heading">
      <div className="ot-section-title">
        <div>
          <h3 id="account-security-heading">Account &amp; security</h3>
          <p>Change the password for this signed-in account.</p>
        </div>
        <span>{roleLabel}</span>
      </div>
      <dl className="ot-mini-metrics">
        <div>
          <dt>Sign-in identifier</dt>
          <dd>{displaySignInIdentifier(identifier, role)}</dd>
        </div>
        <div>
          <dt>Session</dt>
          <dd>Secure and active</dd>
        </div>
      </dl>
      <p className="ot-muted">
        Cannot use your current password? <a href="/forgot-password">Request a secure reset</a>.
      </p>
      <form
        className="ot-dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) return;
          setSaving(true);
          setStatus(null);
          void onChangePassword({ currentPassword, newPassword })
            .then((result) => {
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
              setStatus({
                kind: 'success',
                message:
                  result.sessions_invalidated > 0
                    ? `Password changed. ${result.sessions_invalidated} other session${
                        result.sessions_invalidated === 1 ? '' : 's'
                      } signed out.`
                    : 'Password changed. This session remains signed in.',
              });
            })
            .catch((error) => {
              setStatus({
                kind: 'error',
                message: errorMessage(error, 'Password was not changed.'),
              });
            })
            .finally(() => setSaving(false));
        }}
      >
        <label className="ot-field">
          <span>Current password</span>
          <input
            type="password"
            value={currentPassword}
            autoComplete="current-password"
            required
            maxLength={256}
            onChange={(event) => setCurrentPassword(event.currentTarget.value)}
          />
        </label>
        <label className="ot-field">
          <span>New password</span>
          <input
            type="password"
            value={newPassword}
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={256}
            aria-describedby="new-password-help"
            onChange={(event) => setNewPassword(event.currentTarget.value)}
          />
        </label>
        <p id="new-password-help" className="ot-muted">
          Use at least 10 characters with at least one letter and one number.
        </p>
        <label className="ot-field">
          <span>Confirm new password</span>
          <input
            type="password"
            value={confirmPassword}
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={256}
            onChange={(event) => setConfirmPassword(event.currentTarget.value)}
          />
        </label>
        {confirmPassword && newPassword !== confirmPassword && (
          <p className="notice-banner error" role="alert">
            The new passwords do not match.
          </p>
        )}
        {status && (
          <p
            className={`notice-banner ${status.kind}`}
            role={status.kind === 'error' ? 'alert' : 'status'}
          >
            {status.message}
          </p>
        )}
        <button type="submit" className="ot-button ot-button-primary" disabled={!canSubmit}>
          {saving ? 'Changing password' : 'Change password'}
        </button>
      </form>
    </section>
  );
}

function displaySignInIdentifier(identifier: string, role: SessionUser['role']) {
  return role === 'student' && identifier.startsWith('student:')
    ? identifier.slice('student:'.length)
    : identifier;
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

function playStudentNotificationCue() {
  const AudioContextConstructor = window.AudioContext;
  if (!AudioContextConstructor) return;
  const context = new AudioContextConstructor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = 880;
  gain.gain.setValueAtTime(0.04, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.12);
  oscillator.addEventListener('ended', () => void context.close(), { once: true });
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
  if (role === 'student') {
    if (location.pathname.startsWith('/app/student/classes/')) return 'today';
    if (
      location.pathname === '/app/student/library' ||
      location.pathname.startsWith('/app/student/library/')
    )
      return 'library';
    if (location.pathname === '/app/student/progress') return 'progress';
    if (location.pathname.startsWith('/app/student/questions')) return 'questions';
    if (location.pathname === '/app/student/updates') return 'updates';
  }
  if (
    location.pathname === '/app/parent/calendar' ||
    location.pathname.startsWith('/app/parent/classes/')
  )
    return 'classes';
  return role === 'parent' ? 'learners' : 'today';
}

export function studentLibraryContentIdFromLocation(pathname: string): string | null | undefined {
  if (pathname === '/app/student/library') return undefined;
  if (!pathname.startsWith('/app/student/library/')) return undefined;
  const match = /^\/app\/student\/library\/([^/]+)$/u.exec(pathname);
  if (!match?.[1]) return null;
  try {
    const contentId = decodeURIComponent(match[1]);
    return contentId && !contentId.includes('/') ? contentId : null;
  } catch {
    return null;
  }
}

function portalRoleFromLocation(pathname: string): 'parent' | 'student' {
  if (pathname === '/app/classroom') return 'student';
  const route = resolveCurrentClientRoute(pathname);
  if (route?.shell === 'parent') return 'parent';
  if (route?.shell === 'student') return 'student';
  throw new Error(`No current Parent or Student route is registered for "${pathname}".`);
}

function parentHouseholdViewFromLocation(pathname: string): ParentHouseholdView {
  if (pathname === '/app/parent/students/new') return { kind: 'create' };
  const studentMatch = /^\/app\/parent\/students\/([^/]+)$/u.exec(pathname);
  if (studentMatch?.[1]) {
    return { kind: 'student', student_id: decodeURIComponent(studentMatch[1]) };
  }
  return { kind: 'overview' };
}

type V21ParentRouteView =
  | { kind: 'household'; view: ParentHouseholdView }
  | { kind: 'summary'; view: ParentSummaryView }
  | { kind: 'billing' }
  | { kind: 'preferences' }
  | { kind: 'privacy'; view: 'privacy' | 'data-rights' }
  | { kind: 'account' };

function v21ParentRouteViewFromLocation(pathname: string): V21ParentRouteView {
  const classMatch = /^\/app\/parent\/classes\/([^/]+)$/u.exec(pathname);
  if (classMatch?.[1]) {
    return {
      kind: 'summary',
      view: { kind: 'class', occurrence_id: decodeURIComponent(classMatch[1]) },
    };
  }
  if (pathname === '/app/parent/calendar') {
    return { kind: 'summary', view: { kind: 'calendar' } };
  }
  if (pathname === '/app/parent/progress') {
    return { kind: 'summary', view: { kind: 'progress' } };
  }
  const progressMatch = /^\/app\/parent\/progress\/([^/]+)$/u.exec(pathname);
  if (progressMatch?.[1]) {
    return {
      kind: 'summary',
      view: { kind: 'progress', student_id: decodeURIComponent(progressMatch[1]) },
    };
  }
  if (pathname === '/app/parent/newsletter') {
    return { kind: 'summary', view: { kind: 'updates', newsletterOnly: true } };
  }
  if (pathname === '/app/parent/updates') {
    return { kind: 'summary', view: { kind: 'updates' } };
  }
  if (pathname === '/app/parent/billing') return { kind: 'billing' };
  if (pathname === '/app/parent/preferences') return { kind: 'preferences' };
  if (pathname === '/app/parent/privacy') return { kind: 'privacy', view: 'privacy' };
  if (pathname === '/app/parent/data-rights') return { kind: 'privacy', view: 'data-rights' };
  if (pathname === '/app/parent/account') return { kind: 'account' };
  return { kind: 'household', view: parentHouseholdViewFromLocation(pathname) };
}

function portalClassKeyFromLocation(pathname: string, role: 'parent' | 'student'): string | null {
  const match = new RegExp(`^/app/${role}/classes/([^/]+)$`, 'u').exec(pathname);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
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
