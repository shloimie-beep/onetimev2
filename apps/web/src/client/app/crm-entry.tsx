import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  AdminGamificationDashboardResponse,
  ClassOccurrenceDetail,
  ClassOccurrenceSummary,
  ContactDetail,
  ContactListItem,
  ContentLibraryItemSummary,
  OwnerDashboardResponse,
  SessionUser,
} from '@onetime/contracts';
import type {
  SupportAdminView,
  SupportLifecycleState,
} from '../../../../../packages/contracts/src/support/v21.ts';
import type {
  AdminNavigationResolution,
  AdminSearchPage,
  AdminSearchRequest,
  AdminSearchResult,
} from '../../../../../packages/contracts/src/admin/operations/index.ts';
import { Button, Card, EmptyState, Select } from '@onetime/brand-system/react';
import {
  CLASSROOM_SECTIONS,
  CONTACTS_SECTIONS,
  DASHBOARD_SECTIONS,
  ACCOUNT_SECTIONS,
  adminPrimaryNav,
  rabbiPrimaryNav,
  classroomHref,
  classroomOccurrenceFromLocation,
  classroomSectionFromPath,
  classroomSeriesFromLocation,
  contactsSectionFromPath,
  dashboardSectionFromPath,
  type DashboardSectionId,
  type ClassroomSectionId,
} from './admin-ia.js';
import {
  communicationsRouteDescriptor,
  contactCommunicationsTabDescriptor,
} from './communications/route-descriptor.js';
import { AppShell, type ShellNavItem, type ShellUser } from './shell/AppShell.js';
import { WorkspaceTabs } from './shell/WorkspaceTabs.js';
import { GamificationAdminPanel } from './gamification-admin/GamificationAdminPanel.js';
import { AdminLearningWorkspace } from './admin/learning/AdminLearningWorkspace.js';
import { AdminSupportWorkspace } from './admin/support/AdminSupportWorkspace.js';
import {
  AdminGlobalSearch,
  AdminPrivateAuthorizationError,
  postPrivateAdminNavigationResolution,
  postPrivateAdminSearch,
} from './admin/search/AdminGlobalSearch.js';
import type { AdminCredentialBoundSnapshot } from './admin/adminPrivateCompletion.js';
import { ClassManagementWorkspace } from './classes/ClassManagementWorkspace.js';
import { changeOwnPassword } from './portal-api.js';
import { resolveCurrentClientRoute } from './router/index.js';
import { compatibilityPathForRoute } from './router/canonical-route-views.js';
import {
  AuthExpiredError,
  appendNote,
  archiveContactRequest,
  assignAdminSupportTicket,
  assignTag,
  confirmReply,
  correctAdminAttendance,
  createTag,
  createIdempotencyKey,
  getAssignees,
  getClassDetail,
  getClasses,
  getContact,
  getContentLibrary,
  getGamificationAdminDashboard,
  getAdminAttendanceSnapshot,
  getAdminLearningSnapshot,
  getAdminSupportTicket,
  getOwnerDashboard,
  getSession,
  listContacts,
  listAdminSupportTickets,
  logoutSession,
  previewReply,
  reactivateContactRequest,
  resolveCrmCapabilities,
  replyAdminSupportTicket,
  saveContactRequest,
  transitionAdminQuestion,
  updateAdminSupportTicketStatus,
  type Assignee,
  type ApiSession,
  type AdminLearningSnapshot,
  type QueryState,
} from './crm-api.js';
import './crm.css';

const CommunicationsPanel = React.lazy(() =>
  communicationsRouteDescriptor.load().then((module) => ({
    default: module.CommunicationsFeature,
  })),
);

const WorkflowReadbackPanel = React.lazy(() =>
  import('./communications/WorkflowReadbackFeature.js').then((module) => ({
    default: module.WorkflowReadbackFeature,
  })),
);

const ContentWorkspace = React.lazy(() =>
  import('./content-workspace/ContentWorkspace.js').then((module) => ({
    default: module.ContentWorkspace,
  })),
);

const ContactOperationsPanel = React.lazy(() =>
  import('./contact-operations/ContactOperationsPanel.js').then((module) => ({
    default: module.ContactOperationsPanel,
  })),
);

const AdminDirectoryPanel = React.lazy(() =>
  import('./admin-directory/AdminDirectoryPanel.js').then((module) => ({
    default: module.AdminDirectoryPanel,
  })),
);

type ContactFormState = {
  display_name: string;
  family_school_classification: 'family' | 'school';
  email: string;
  phone: string;
  location: string;
  timezone: string;
  lead_status: string;
  assigned_user_key: string;
  internal_note: string;
  version?: number;
};

type Notice = {
  kind: 'info' | 'success' | 'error';
  message: string;
};

type CommunicationsMode =
  | { kind: 'global' }
  | { kind: 'contact'; contactId: string }
  | { kind: 'workflow'; workflowId: string };
type AdminSupportRoute = {
  mode: 'workspace' | 'queue' | 'detail';
  ticketId: string | null;
};
type OwnerSurface =
  | 'dashboard'
  | 'crm'
  | 'search'
  | 'classes'
  | 'content'
  | 'billing'
  | 'support'
  | 'operations'
  | 'account';
type AsyncPanelState = {
  loading: boolean;
  error: string;
};

const emptyForm: ContactFormState = {
  display_name: '',
  family_school_classification: 'family',
  email: '',
  phone: '',
  location: '',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jerusalem',
  lead_status: 'new',
  assigned_user_key: '',
  internal_note: '',
};

const defaultQuery: QueryState = {
  search: '',
  classification: '',
  lead_status: '',
  sort: 'updated_desc',
};

function CrmApp() {
  const [session, setSession] = useState<ApiSession | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [contacts, setContacts] = useState<ContactListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [query, setQuery] = useState<QueryState>(defaultQuery);
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(() =>
    /^\/app\/(?:crm\/)?contacts\/[^/]+$/u.test(window.location.pathname),
  );
  const [listError, setListError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [selected, setSelected] = useState<ContactDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [contactOperationsMode, setContactOperationsMode] = useState(false);
  const [contactOperationsHouseholdKey, setContactOperationsHouseholdKey] = useState<string | null>(
    null,
  );
  const [surface, setSurface] = useState<OwnerSurface>('crm');
  const [communicationsMode, setCommunicationsMode] = useState<CommunicationsMode | null>(null);
  const [adminSupportRoute, setAdminSupportRoute] = useState<AdminSupportRoute>({
    mode: 'workspace',
    ticketId: null,
  });
  const [adminSearchRecentQueries, setAdminSearchRecentQueries] = useState<
    AdminCredentialBoundSnapshot<readonly string[]> | undefined
  >(undefined);
  const [dashboard, setDashboard] = useState<OwnerDashboardResponse | null>(null);
  const [dashboardState, setDashboardState] = useState<AsyncPanelState>({
    loading: false,
    error: '',
  });
  const [gamificationDashboard, setGamificationDashboard] =
    useState<AdminGamificationDashboardResponse | null>(null);
  const [gamificationState, setGamificationState] = useState<AsyncPanelState>({
    loading: false,
    error: '',
  });
  const [adminLearning, setAdminLearning] = useState<AdminLearningSnapshot | null>(null);
  const [adminLearningState, setAdminLearningState] = useState<AsyncPanelState>({
    loading: false,
    error: '',
  });
  const [classes, setClasses] = useState<ClassOccurrenceSummary[]>([]);
  const [classesState, setClassesState] = useState<AsyncPanelState>({
    loading: false,
    error: '',
  });
  const [selectedClass, setSelectedClass] = useState<ClassOccurrenceDetail | null>(null);
  const [classDetailState, setClassDetailState] = useState<AsyncPanelState>({
    loading: false,
    error: '',
  });
  const [teachingContent, setTeachingContent] = useState<ContentLibraryItemSummary[]>([]);
  const [teachingContentState, setTeachingContentState] = useState<AsyncPanelState>({
    loading: false,
    error: '',
  });
  const [contentRoutePath, setContentRoutePath] = useState(
    location.pathname.startsWith('/app/content') ? location.pathname : '/app/content',
  );
  const [dashboardRoutePath, setDashboardRoutePath] = useState(
    location.pathname.startsWith('/app/dashboard') ? location.pathname : '/app/dashboard',
  );
  const [contactsRoutePath, setContactsRoutePath] = useState(
    location.pathname.startsWith('/app/crm') ? location.pathname : '/app/crm',
  );
  const [classroomRoutePath, setClassroomRoutePath] = useState(
    location.pathname === '/app/rewards' || location.pathname.startsWith('/app/classes')
      ? `${location.pathname}${location.search}`
      : '/app/classes',
  );
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [focusContactId, setFocusContactId] = useState<string | null>(null);
  const returnFocusContactId = useRef<string | null>(null);
  const listCache = useRef<{
    key: string;
    contacts: ContactListItem[];
    nextCursor: string | null;
  } | null>(null);
  const capabilities = resolveCrmCapabilities(session);
  const canCreate = capabilities.contacts.create;
  const canEdit = capabilities.contacts.update;
  const canAssign = capabilities.contacts.assign;
  const canReadCommunications = session?.user.role === 'admin';
  const canReadOwnerShell = canReadCommunications;
  const isRabbi = false;
  const canReadCrm = session?.user.role === 'admin';
  const isActiveAdminContext =
    session?.session_model === 'v21'
      ? session.account_context?.active_role === 'admin'
      : session?.user.role === 'admin';

  useEffect(() => {
    void loadSession();
    const onPop = () => void routeFromLocation();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (session && !sessionExpired) void routeFromLocation();
  }, [session, sessionExpired]);

  useEffect(() => {
    if (!focusContactId || listLoading || selected || creating || editing) return;
    focusVisibleContactControl(focusContactId);
    setFocusContactId(null);
  }, [contacts, creating, editing, focusContactId, listLoading, selected]);

  useEffect(() => {
    if (sessionExpired || selected || creating || editing || listLoading) return;
    return markUsableAfterPaint('ot-crm-list-usable', isListUsable);
  }, [contacts, creating, editing, listError, listLoading, selected, sessionExpired]);

  useEffect(() => {
    if (sessionExpired || !selected || editing || detailLoading || detailError) return;
    const title = document.getElementById('page-title');
    window.requestAnimationFrame(() => title?.focus({ preventScroll: true }));
    return markUsableAfterPaint('ot-crm-detail-usable', () =>
      isDetailUsable(selected.display_name),
    );
  }, [detailError, detailLoading, editing, selected, sessionExpired]);

  async function loadSession() {
    try {
      const json = await getSession();
      setSessionExpired(false);
      setSession(json);
      if (json.user.role === 'admin') {
        try {
          const assigneeJson = await getAssignees();
          setAssignees(assigneeJson.assignees);
        } catch {
          setAssignees([]);
        }
      }
    } catch (error) {
      if (error instanceof AuthExpiredError) {
        clearProtectedState();
      }
    }
  }

  async function routeFromLocation() {
    if (sessionExpired) return;
    const canonicalRoute = resolveCurrentClientRoute(location.pathname, 'admin');
    const compatibilityTarget =
      canonicalRoute?.readiness === 'ready'
        ? compatibilityPathForRoute(canonicalRoute, location.pathname)
        : null;
    const effectiveLocation = new URL(
      compatibilityTarget ?? `${location.pathname}${location.search}`,
      location.origin,
    );
    const routePath = effectiveLocation.pathname;
    const routeSearch = effectiveLocation.search;
    const supportReceiptMatch = routePath.match(/^\/app\/support\/receipts\/([^/]+)$/);
    if (routePath === '/app/support' || supportReceiptMatch?.[1]) {
      setContactOperationsMode(false);
      setSurface('support');
      const ticketId = new URLSearchParams(routeSearch).get('ticket_id');
      setAdminSupportRoute(
        canonicalRoute?.routeId === 'RT-ADM-063' && ticketId
          ? { mode: 'detail', ticketId }
          : canonicalRoute?.routeId === 'RT-ADM-062'
            ? { mode: 'queue', ticketId: null }
            : { mode: 'workspace', ticketId: null },
      );
      setCommunicationsMode(null);
      setSelected(null);
      setEditing(false);
      setCreating(false);
      setListLoading(false);
      return;
    }
    if (
      routePath === '/app/crm/households' ||
      routePath === '/app/crm/users' ||
      routePath === '/app/crm/learners' ||
      routePath === '/app/crm/audit'
    ) {
      setSurface('crm');
      setContactOperationsMode(false);
      setContactOperationsHouseholdKey(null);
      setContactsRoutePath(`${routePath}${routeSearch}`);
      setCommunicationsMode(null);
      setAdminSupportRoute({ mode: 'workspace', ticketId: null });
      setSelected(null);
      setEditing(false);
      setCreating(false);
      setListLoading(false);
      return;
    }
    const workflowReadbackMatch = routePath.match(
      /^\/app\/operations\/workflow-readback\/([^/]+)$/,
    );
    if (workflowReadbackMatch?.[1]) {
      setContactOperationsMode(false);
      setSurface('operations');
      setCommunicationsMode({
        kind: 'workflow',
        workflowId: decodeURIComponent(workflowReadbackMatch[1]),
      });
      setSelected(null);
      setEditing(false);
      setCreating(false);
      setListLoading(false);
      return;
    }
    const ownerSurface = ownerSurfaceFromPath(routePath);
    if (ownerSurface && ownerSurface !== 'crm') {
      setContactOperationsMode(false);
      setContactOperationsHouseholdKey(null);
      setSurface(ownerSurface);
      setCommunicationsMode(null);
      setAdminSupportRoute({ mode: 'workspace', ticketId: null });
      setSelected(null);
      setEditing(false);
      setCreating(false);
      setListLoading(false);
      if ((ownerSurface === 'dashboard' || ownerSurface === 'billing') && !isRabbi) {
        await loadDashboard();
      }
      if (ownerSurface === 'dashboard') setDashboardRoutePath(routePath);
      if (ownerSurface === 'classes') {
        const nextClassroomPath = `${routePath}${routeSearch}`;
        const occurrenceKey = classroomOccurrenceFromLocation(routePath, routeSearch);
        setClassroomRoutePath(nextClassroomPath);
        await loadClasses(occurrenceKey);
        if (classroomSectionFromPath(routePath) === 'rewards' && !isRabbi) {
          await loadGamificationDashboard();
        }
        if (
          !isRabbi &&
          ['questions', 'rewards', 'attendance'].includes(classroomSectionFromPath(routePath))
        ) {
          await loadAdminLearning(
            classroomSectionFromPath(routePath) === 'attendance' ? 'attendance' : 'questions',
          );
        }
      } else {
        setSelectedClass(null);
        setClassDetailState({ loading: false, error: '' });
      }
      if (ownerSurface === 'content') {
        setContentRoutePath(routePath);
        if (isRabbi) await loadTeachingContent();
      }
      return;
    }
    if (routePath === communicationsRouteDescriptor.path) {
      setContactOperationsMode(false);
      setSurface('crm');
      setCommunicationsMode({ kind: 'global' });
      setSelected(null);
      setEditing(false);
      setCreating(false);
      setListLoading(false);
      return;
    }
    const contactCommunicationsMatch = routePath.match(
      /^\/app\/crm\/contacts\/([^/]+)\/communications$/,
    );
    if (contactCommunicationsMatch?.[1]) {
      setContactOperationsMode(false);
      setSurface('crm');
      setCommunicationsMode({
        kind: 'contact',
        contactId: decodeURIComponent(contactCommunicationsMatch[1]),
      });
      setSelected(null);
      setEditing(false);
      setCreating(false);
      setListLoading(false);
      return;
    }
    if (routePath === '/app/crm/contact-operations') {
      setSurface('crm');
      setContactsRoutePath('/app/crm');
      setContactOperationsMode(true);
      setContactOperationsHouseholdKey(
        new URLSearchParams(routeSearch).get('household')?.trim() || null,
      );
      setCommunicationsMode(null);
      setAdminSupportRoute({ mode: 'workspace', ticketId: null });
      setSelected(null);
      setEditing(false);
      setCreating(false);
      setListLoading(false);
      return;
    }
    setSurface('crm');
    setContactOperationsMode(false);
    setContactOperationsHouseholdKey(null);
    setContactsRoutePath(routePath);
    setCommunicationsMode(null);
    setAdminSupportRoute({ mode: 'workspace', ticketId: null });
    const match = routePath.match(/^\/app\/crm\/contacts\/([^/]+)$/);
    const contactId = match?.[1];
    if (contactId) {
      setCreating(false);
      setEditing(false);
      await loadContact(decodeURIComponent(contactId));
    } else {
      setSelected(null);
      setEditing(false);
      setCreating(false);
      if (!restoreCachedList(query)) await loadList(undefined, query);
    }
  }

  async function loadList(cursor?: string, nextQuery: QueryState = query) {
    setListLoading(true);
    setListError('');
    setNotice(null);
    try {
      const json = await listContacts(nextQuery, session?.csrf_token ?? '', cursor);
      setContacts((current) => {
        const nextContacts = cursor ? [...current, ...json.contacts] : json.contacts;
        listCache.current = {
          key: listCacheKey(nextQuery),
          contacts: nextContacts,
          nextCursor: json.next_cursor,
        };
        return nextContacts;
      });
      setNextCursor(json.next_cursor);
    } catch (error) {
      if (handleAuthError(error)) return;
      setListError(errorMessage(error, 'CRM contacts could not load.'));
    } finally {
      setListLoading(false);
    }
  }

  async function loadContact(contactId: string) {
    setDetailLoading(true);
    setDetailError('');
    setNotice(null);
    try {
      const json = await getContact(contactId);
      setSelected(json.contact);
    } catch (error) {
      if (handleAuthError(error)) return;
      setSelected(null);
      setDetailError(errorMessage(error, 'Contact could not load.'));
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadDashboard() {
    setDashboardState({ loading: true, error: '' });
    try {
      const json = await getOwnerDashboard();
      setDashboard(json);
    } catch (error) {
      if (handleAuthError(error)) return;
      setDashboardState({
        loading: false,
        error: errorMessage(error, 'Dashboard could not load.'),
      });
      return;
    }
    setDashboardState({ loading: false, error: '' });
  }

  async function loadGamificationDashboard() {
    setGamificationState({ loading: true, error: '' });
    try {
      setGamificationDashboard(await getGamificationAdminDashboard());
      setGamificationState({ loading: false, error: '' });
    } catch (error) {
      if (handleAuthError(error)) return;
      setGamificationState({
        loading: false,
        error: errorMessage(error, 'Learning rewards could not load.'),
      });
    }
  }

  async function loadAdminLearning(mode: 'questions' | 'attendance' = 'questions') {
    setAdminLearningState({ loading: true, error: '' });
    try {
      setAdminLearning(
        await (mode === 'attendance' ? getAdminAttendanceSnapshot() : getAdminLearningSnapshot()),
      );
      setAdminLearningState({ loading: false, error: '' });
    } catch (error) {
      if (handleAuthError(error)) return;
      setAdminLearningState({
        loading: false,
        error: errorMessage(error, 'Learning engagement could not load.'),
      });
    }
  }

  async function loadTeachingContent() {
    setTeachingContentState({ loading: true, error: '' });
    try {
      const result = await getContentLibrary();
      setTeachingContent(result.items);
      setTeachingContentState({ loading: false, error: '' });
    } catch (error) {
      if (handleAuthError(error)) return;
      setTeachingContentState({
        loading: false,
        error: errorMessage(error, 'Teaching content could not load.'),
      });
    }
  }

  async function loadClasses(preferredOccurrenceKey?: string | null) {
    setClassesState({ loading: true, error: '' });
    try {
      const json = await getClasses();
      setClasses(json.occurrences);
      const occurrenceKey =
        preferredOccurrenceKey ??
        selectedClass?.occurrence_key ??
        json.occurrences[0]?.occurrence_key ??
        null;
      if (preferredOccurrenceKey || selectedClass?.occurrence_key) {
        if (occurrenceKey) await loadClassDetail(occurrenceKey);
      } else if (occurrenceKey) {
        for (const occurrence of json.occurrences) {
          if (await loadClassDetail(occurrence.occurrence_key)) break;
        }
      } else {
        setSelectedClass(null);
        setClassDetailState({ loading: false, error: '' });
      }
    } catch (error) {
      if (handleAuthError(error)) return;
      setClassesState({
        loading: false,
        error: errorMessage(error, 'Classes could not load.'),
      });
      return;
    }
    setClassesState({ loading: false, error: '' });
  }

  async function loadClassDetail(occurrenceKey: string) {
    setClassDetailState({ loading: true, error: '' });
    try {
      const json = await getClassDetail(occurrenceKey);
      setSelectedClass(json.occurrence);
    } catch (error) {
      if (handleAuthError(error)) return false;
      setSelectedClass(null);
      setClassDetailState({
        loading: false,
        error: errorMessage(error, 'Class details could not load.'),
      });
      return false;
    }
    setClassDetailState({ loading: false, error: '' });
    return true;
  }

  function openContact(contactId: string) {
    setContactOperationsMode(false);
    returnFocusContactId.current = contactId;
    history.pushState({}, '', `/app/crm/contacts/${encodeURIComponent(contactId)}`);
    setCreating(false);
    setEditing(false);
    void loadContact(contactId);
  }

  async function backToList() {
    history.pushState({}, '', '/app/crm');
    setSurface('crm');
    setContactOperationsMode(false);
    setContactOperationsHouseholdKey(null);
    setContactsRoutePath('/app/crm');
    setSelected(null);
    setEditing(false);
    setCreating(false);
    if (!restoreCachedList(query)) await loadList(undefined, query);
    const contactId = returnFocusContactId.current;
    if (contactId) {
      setFocusContactId(contactId);
    }
  }

  function restoreCachedList(nextQuery: QueryState) {
    const cached = listCache.current;
    if (!cached || cached.key !== listCacheKey(nextQuery)) return false;
    setContacts(cached.contacts);
    setNextCursor(cached.nextCursor);
    setListError('');
    setNotice(null);
    setListLoading(false);
    return true;
  }

  function startCreate() {
    setSurface('crm');
    setContactsRoutePath('/app/crm');
    setSelected(null);
    setEditing(false);
    setCreating(true);
    setContactOperationsMode(false);
    setCommunicationsMode(null);
    setAdminSupportRoute({ mode: 'workspace', ticketId: null });
    history.pushState({}, '', '/app/crm');
  }

  function startContactOperations(householdKey?: string) {
    const href = householdKey
      ? `/app/crm/contact-operations?household=${encodeURIComponent(householdKey)}`
      : '/app/crm/contact-operations';
    history.pushState({}, '', href);
    setSurface('crm');
    setContactsRoutePath('/app/crm');
    setContactOperationsMode(true);
    setContactOperationsHouseholdKey(householdKey ?? null);
    setCommunicationsMode(null);
    setAdminSupportRoute({ mode: 'workspace', ticketId: null });
    setSelected(null);
    setEditing(false);
    setCreating(false);
    setListLoading(false);
  }

  function openContactCommunications(contactId: string) {
    setContactOperationsMode(false);
    setContactOperationsHouseholdKey(null);
    history.pushState(
      {},
      '',
      `/app/crm/contacts/${encodeURIComponent(contactId)}/${contactCommunicationsTabDescriptor.id}`,
    );
    setSurface('crm');
    setContactsRoutePath('/app/crm');
    setCommunicationsMode({ kind: 'contact', contactId });
    setAdminSupportRoute({ mode: 'workspace', ticketId: null });
    setSelected(null);
    setEditing(false);
    setCreating(false);
    setListLoading(false);
  }

  function openOwnerSurface(
    nextSurface: Exclude<OwnerSurface, 'crm'>,
    href = ownerSurfacePath(nextSurface),
  ) {
    history.pushState({}, '', href);
    setSurface(nextSurface);
    setContactOperationsMode(false);
    setContactOperationsHouseholdKey(null);
    setCommunicationsMode(null);
    setAdminSupportRoute({ mode: 'workspace', ticketId: null });
    setSelected(null);
    setEditing(false);
    setCreating(false);
    setListLoading(false);
    if (nextSurface === 'dashboard' || nextSurface === 'billing') void loadDashboard();
    if (nextSurface === 'dashboard') setDashboardRoutePath(new URL(href, location.origin).pathname);
    if (nextSurface === 'classes') {
      const target = new URL(href, location.origin);
      const occurrenceKey = classroomOccurrenceFromLocation(target.pathname, target.search);
      setClassroomRoutePath(`${target.pathname}${target.search}`);
      void loadClasses(occurrenceKey);
      if (classroomSectionFromPath(target.pathname) === 'rewards') {
        void loadGamificationDashboard();
      }
      if (
        ['questions', 'rewards', 'attendance'].includes(classroomSectionFromPath(target.pathname))
      ) {
        void loadAdminLearning(
          classroomSectionFromPath(target.pathname) === 'attendance' ? 'attendance' : 'questions',
        );
      }
    } else {
      setSelectedClass(null);
      setClassDetailState({ loading: false, error: '' });
    }
    if (nextSurface === 'content') setContentRoutePath(href);
  }

  function selectClassOccurrence(occurrenceKey: string) {
    const target = new URL(classroomRoutePath, location.origin);
    const section = classroomSectionFromPath(target.pathname);
    const href = classroomHref(section, occurrenceKey);
    history.pushState({}, '', href);
    setSurface('classes');
    setClassroomRoutePath(href);
    void loadClassDetail(occurrenceKey);
  }

  function openContactSection(href: string) {
    if (href === '/app/crm') {
      void backToList();
      return;
    }
    history.pushState({}, '', href);
    setSurface('crm');
    setContactOperationsMode(false);
    setContactOperationsHouseholdKey(null);
    setContactsRoutePath(href);
    setCommunicationsMode(null);
    setAdminSupportRoute({ mode: 'workspace', ticketId: null });
    setSelected(null);
    setEditing(false);
    setCreating(false);
    setListLoading(false);
  }

  async function logout() {
    if (!session) return;
    const csrfToken = session.csrf_token;
    clearProtectedState();
    await logoutSession(csrfToken).catch(() => undefined);
    window.location.assign('/login');
  }

  async function saveContact(
    form: ContactFormState,
    mode: 'create' | 'edit',
    idempotencyKey?: string,
  ) {
    if (!session) return;
    setNotice(null);
    const payload = {
      ...form,
      assigned_user_key: form.assigned_user_key || undefined,
      internal_note: form.internal_note || '',
    };
    try {
      const json = await saveContactRequest({
        csrfToken: session.csrf_token,
        form: payload,
        mode,
        contactId: selected?.contact_id,
        idempotencyKey,
      });
      setCreating(false);
      setEditing(false);
      setSelected(json.contact);
      listCache.current = null;
      history.pushState({}, '', `/app/crm/contacts/${encodeURIComponent(json.contact.contact_id)}`);
      setNotice({ kind: 'success', message: 'Contact saved.' });
    } catch (error) {
      if (handleAuthError(error)) return;
      const json = error as Error & { code?: string; existing_contact_path?: string };
      if (json.code === 'DUPLICATE_CONTACT' && json.existing_contact_path) {
        setNotice({ kind: 'error', message: 'A matching contact already exists.' });
        history.pushState({}, '', json.existing_contact_path);
        await routeFromLocation();
        return;
      }
      throw error;
    }
  }

  function handleAuthError(error: unknown) {
    if (!(error instanceof AuthExpiredError)) return false;
    clearProtectedState();
    return true;
  }

  async function runPrivateAdminSearch(request: AdminSearchRequest): Promise<AdminSearchPage> {
    try {
      return await postPrivateAdminSearch(fetch, request);
    } catch (error) {
      if (error instanceof AdminPrivateAuthorizationError && error.status === 401)
        clearProtectedState();
      throw error;
    }
  }

  async function resolvePrivateAdminSearchResult(
    result: AdminSearchResult,
    credentialVersion: number,
  ): Promise<AdminNavigationResolution> {
    try {
      return await postPrivateAdminNavigationResolution(fetch, {
        kind: result.kind,
        targetId: result.targetId,
        selectedCredentialVersion: credentialVersion,
      });
    } catch (error) {
      if (error instanceof AdminPrivateAuthorizationError && error.status === 401)
        clearProtectedState();
      throw error;
    }
  }

  function clearProtectedState() {
    setContacts([]);
    setNextCursor(null);
    listCache.current = null;
    setAssignees([]);
    setSelected(null);
    setCreating(false);
    setEditing(false);
    setContactOperationsMode(false);
    setContactOperationsHouseholdKey(null);
    setSurface('crm');
    setCommunicationsMode(null);
    setAdminSupportRoute({ mode: 'workspace', ticketId: null });
    setAdminSearchRecentQueries(undefined);
    setDashboard(null);
    setDashboardState({ loading: false, error: '' });
    setClasses([]);
    setClassesState({ loading: false, error: '' });
    setSelectedClass(null);
    setClassDetailState({ loading: false, error: '' });
    setContentRoutePath('/app/content');
    setDashboardRoutePath('/app/dashboard');
    setContactsRoutePath('/app/crm');
    setClassroomRoutePath('/app/classes');
    setListLoading(false);
    setDetailLoading(false);
    setSession(null);
    setSessionExpired(true);
    setNotice(null);
    setListError('');
    setDetailError('');
  }

  function signIn() {
    const returnTo =
      location.pathname.startsWith('/app/crm') ||
      location.pathname.startsWith(communicationsRouteDescriptor.path) ||
      Boolean(ownerSurfaceFromPath(location.pathname)) ||
      location.pathname.startsWith('/app/support')
        ? location.pathname
        : '/app/crm';
    window.location.assign(`/login?return_to=${encodeURIComponent(returnTo)}`);
  }

  const activeChips = useMemo(
    () =>
      Object.entries(query)
        .filter(([key, value]) => key !== 'search' && value && value !== 'updated_desc')
        .map(([key, value]) => ({
          key,
          label: `${labelFor(key)}: ${displayFilterValue(key, value)}`,
        })),
    [query],
  );
  const dashboardSection = dashboardSectionFromPath(dashboardRoutePath);
  const contactsRoute = new URL(contactsRoutePath, location.origin);
  const contactsSection = contactsSectionFromPath(contactsRoute.pathname);
  const classroomPath = new URL(classroomRoutePath, location.origin);
  const classroomSection = classroomSectionFromPath(classroomPath.pathname);

  const adminCurrentArea = communicationsMode
    ? 'communications'
    : surface === 'dashboard'
      ? 'today'
      : surface === 'crm'
        ? 'people'
        : surface === 'billing'
          ? 'people'
          : surface === 'operations'
            ? 'operations'
            : surface === 'content'
              ? 'learning'
              : surface === 'classes'
                ? 'learning'
                : surface === 'account'
                  ? 'account'
                  : null;
  const liveConsoleReady =
    isRabbi || session?.capabilities?.operator_experience?.live_console === true;
  const navItems: ShellNavItem[] = canReadOwnerShell
    ? isRabbi
      ? rabbiPrimaryNav(adminCurrentArea, liveConsoleReady)
      : adminPrimaryNav(adminCurrentArea, liveConsoleReady)
    : canReadCrm
      ? [{ id: 'contacts', label: 'Contacts', href: '/app/crm', current: true }]
      : [];
  const utilityItems: ShellNavItem[] = canReadOwnerShell
    ? [{ id: 'search', label: 'Search', href: '/app/search', current: surface === 'search' }]
    : [];
  const adminCredentialVersion = session?.credential_version ?? 0;
  const adminSearchAuthorization = {
    state:
      session?.user.role === 'admin' && adminCredentialVersion >= 1
        ? ('admin' as const)
        : sessionExpired
          ? ('revoked' as const)
          : ('signed_out' as const),
    credentialVersion: adminCredentialVersion,
  };
  const shellUser = session ? shellUserFromSession(session.user) : null;
  const pageTitle =
    surface === 'support' && adminSupportRoute.mode !== 'workspace'
      ? adminSupportRoute.mode === 'detail'
        ? 'Support ticket'
        : 'Tickets'
      : communicationsMode?.kind === 'workflow'
        ? 'Workflow readback'
        : surface !== 'crm'
          ? ownerSurfaceTitle(surface)
          : communicationsMode
            ? 'Communications'
            : contactOperationsMode
              ? 'Parent household'
              : contactsSection !== 'people'
                ? (CONTACTS_SECTIONS.find((item) => item.id === contactsSection)?.label ??
                  'Contacts')
                : creating
                  ? 'Add contact'
                  : editing
                    ? 'Edit contact'
                    : selected
                      ? selected.display_name
                      : 'Contacts';
  const pageDescription =
    surface === 'support' && adminSupportRoute.mode !== 'workspace'
      ? adminSupportRoute.mode === 'detail'
        ? 'Review and update one durable One Time support conversation.'
        : 'Review the durable One Time support queue.'
      : communicationsMode?.kind === 'workflow'
        ? 'Read-only workflow diagnostics for technical operations. One Time does not publish or control GHL workflows here.'
        : surface !== 'crm'
          ? ownerSurfaceDescription(surface)
          : communicationsMode
            ? communicationsMode.kind === 'contact'
              ? 'Communication history and draft activity for this contact.'
              : 'Active One Time accounts with redacted setup, reset, and PIN delivery status.'
            : contactOperationsMode
              ? 'Invite a Parent, create local-only Students, and manage access and adult-only GHL sync.'
              : contactsSection !== 'people'
                ? contactsSection === 'households'
                  ? 'Create and maintain family records, guardians, access, and account setup.'
                  : contactsSection === 'users'
                    ? 'Manage secure account setup, roles, password reset, and access state.'
                    : contactsSection === 'learners'
                      ? 'Manage local learners, Student setup, status, and the three-active-learner limit.'
                      : 'Review timestamped local CRM and account administration activity.'
                : creating
                  ? 'Create a One Time contact without sending messages or granting access.'
                  : editing
                    ? 'Update CRM fields backed by the One Time contact API.'
                    : selected
                      ? contactSummary(selected)
                      : 'Parent and adult contact review. Students remain One Time-only.';
  const toolbar = communicationsMode ? null : surface === 'dashboard' &&
    dashboardSection === 'today' ? (
    <ReadOnlyToolbar
      label="Refresh dashboard"
      actionId="dashboard.refresh.button"
      loading={dashboardState.loading}
      onRefresh={() => void loadDashboard()}
    />
  ) : surface === 'classes' ? (
    <ReadOnlyToolbar
      label="Refresh classroom"
      actionId="classes.refresh.button"
      loading={classesState.loading}
      onRefresh={() => void loadClasses()}
    />
  ) : surface === 'billing' ? (
    <ReadOnlyToolbar
      label="Refresh household access"
      actionId="household.access.refresh.button"
      loading={dashboardState.loading}
      onRefresh={() => void loadDashboard()}
    />
  ) : surface === 'support' ||
    surface === 'operations' ||
    (surface === 'crm' &&
      !communicationsMode &&
      contactsSection !== 'people') ? null : contactOperationsMode ? (
    <FormToolbar onCancel={() => void backToList()} />
  ) : selected ? (
    <DetailToolbar
      contact={selected}
      canEdit={canEdit && selected.lead_status !== 'archived'}
      canReadCommunications={canReadCommunications}
      onBack={backToList}
      onEdit={() => setEditing(true)}
      onCommunications={() => openContactCommunications(selected.contact_id)}
      onManageHousehold={
        selected.managed_household
          ? () => startContactOperations(selected.managed_household?.household_key)
          : undefined
      }
    />
  ) : detailLoading ? (
    <DetailLoadingToolbar />
  ) : creating || editing ? (
    <FormToolbar onCancel={() => (editing ? setEditing(false) : setCreating(false))} />
  ) : surface === 'crm' ? (
    <ListToolbar
      query={query}
      activeChips={activeChips}
      canEdit={canCreate}
      canOperateHouseholds={canReadOwnerShell}
      onChange={setQuery}
      onApply={(nextQuery) => void loadList(undefined, nextQuery)}
      onClear={() => {
        setQuery(defaultQuery);
        void loadList(undefined, defaultQuery);
      }}
      onCreate={startCreate}
      onHouseholdOperations={startContactOperations}
    />
  ) : null;

  return (
    <AppShell
      user={shellUser}
      navItems={navItems}
      utilityItems={utilityItems}
      title={pageTitle}
      description={pageDescription}
      toolbar={toolbar}
      notice={notice ? <NoticeBanner notice={notice} /> : undefined}
      onNavigate={(href) => {
        if (
          href.startsWith('/app/live-console') ||
          href === '/app/live' ||
          href.startsWith('/app/live?') ||
          href.startsWith('/app/live/')
        ) {
          window.location.assign(href);
          return;
        }
        history.pushState({}, '', href);
        void routeFromLocation();
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
      {surface === 'search' && (
        <AdminGlobalSearch
          authorization={adminSearchAuthorization}
          {...(adminSearchRecentQueries ? { recentQueries: adminSearchRecentQueries } : {})}
          onSearch={runPrivateAdminSearch}
          onResolveOpen={resolvePrivateAdminSearchResult}
          onQueryCommitted={(committedQuery) => {
            const queryValue = committedQuery.trim();
            if (!queryValue || adminCredentialVersion < 1) return;
            setAdminSearchRecentQueries((current) => {
              const retained =
                current?.credentialVersion === adminCredentialVersion ? current.value : [];
              return {
                credentialVersion: adminCredentialVersion,
                value: [queryValue, ...retained.filter((value) => value !== queryValue)].slice(
                  0,
                  5,
                ),
              };
            });
          }}
          onClearRecentQueries={() => setAdminSearchRecentQueries(undefined)}
          onNavigate={(href) => {
            history.pushState({}, '', href);
            void routeFromLocation();
          }}
        />
      )}
      {surface === 'dashboard' &&
        (isRabbi ? (
          <RabbiDashboardPanel />
        ) : (
          <DashboardPanel
            dashboard={dashboard}
            loading={dashboardState.loading}
            error={dashboardState.error}
            section={dashboardSection}
            onNavigate={(href) => openOwnerSurface('dashboard', href)}
            onRetry={() => void loadDashboard()}
          />
        ))}
      {surface === 'classes' && (
        <ClassesPanel
          csrfToken={session?.csrf_token ?? ''}
          section={classroomSection}
          liveConsoleReady={liveConsoleReady}
          selectedSeriesKey={classroomSeriesFromLocation(
            classroomPath.pathname,
            classroomPath.search,
          )}
          teachingOnly={isRabbi}
          classes={classes}
          selectedClass={selectedClass}
          gamificationDashboard={gamificationDashboard}
          gamificationLoading={gamificationState.loading}
          gamificationError={gamificationState.error}
          adminLearning={adminLearning}
          adminLearningLoading={adminLearningState.loading}
          adminLearningError={adminLearningState.error}
          loading={classesState.loading}
          error={classesState.error}
          detailLoading={classDetailState.loading}
          detailError={classDetailState.error}
          onNavigate={(href) => {
            if (href.startsWith('/app/live-console')) {
              window.location.assign(href);
              return;
            }
            openOwnerSurface('classes', href);
          }}
          onSelectOccurrence={selectClassOccurrence}
          onRetry={() => void loadClasses()}
          onRefreshOccurrences={loadClasses}
          onRetryDetail={(occurrenceKey) => void loadClassDetail(occurrenceKey)}
          onRetryRewards={() => void loadGamificationDashboard()}
          onRetryLearning={() =>
            loadAdminLearning(classroomSection === 'attendance' ? 'attendance' : 'questions')
          }
        />
      )}
      {surface === 'content' &&
        (!isActiveAdminContext ? (
          <section className="state-panel" aria-labelledby="content-admin-context-title">
            <h2 id="content-admin-context-title">Content is available in Admin</h2>
            <p>Your current Parent workspace cannot open administrative content tools.</p>
            {session?.account_context?.available_roles.includes('admin') ? (
              <p>Use the Admin role switcher above to continue.</p>
            ) : (
              <p>Return to your Parent workspace to continue.</p>
            )}
          </section>
        ) : isRabbi ? (
          <RabbiTeachingContentPanel
            items={teachingContent}
            loading={teachingContentState.loading}
            error={teachingContentState.error}
            onRetry={() => void loadTeachingContent()}
          />
        ) : (
          <Suspense
            fallback={
              <p className="state-panel" role="status">
                Loading Content Workspace...
              </p>
            }
          >
            <ContentWorkspace
              csrfToken={session?.csrf_token ?? ''}
              path={contentRoutePath}
              onNavigate={(href) => openOwnerSurface('content', href)}
              onProtectedStateCleared={clearProtectedState}
            />
          </Suspense>
        ))}
      {surface === 'billing' && (
        <BillingPanel
          dashboard={dashboard}
          loading={dashboardState.loading}
          error={dashboardState.error}
          onRetry={() => void loadDashboard()}
        />
      )}
      {surface === 'operations' &&
        (communicationsMode?.kind === 'workflow' ? (
          <Suspense
            fallback={
              <p className="state-panel" role="status">
                Loading workflow readback...
              </p>
            }
          >
            <WorkflowReadbackPanel
              workflowId={communicationsMode.workflowId}
              onProtectedStateCleared={clearProtectedState}
            />
          </Suspense>
        ) : (
          <OperationsPanel
            csrfToken={session?.csrf_token ?? ''}
            dashboard={dashboard}
            loading={dashboardState.loading}
            error={dashboardState.error}
            onNavigate={(href) => {
              const nextSurface = ownerSurfaceFromPath(href);
              if (nextSurface && nextSurface !== 'crm') {
                openOwnerSurface(nextSurface, href);
                return;
              }
              window.location.assign(href);
            }}
            onRetry={() => void loadDashboard()}
          />
        ))}
      {surface === 'account' && (
        <AccountPanel
          section={accountSectionFromPath(location.pathname)}
          user={session?.user ?? null}
          csrfToken={session?.csrf_token ?? ''}
          onNavigate={(href) => openOwnerSurface('account', href)}
        />
      )}
      {surface === 'support' && (
        <AdminSupportContainer
          csrfToken={session?.csrf_token ?? ''}
          route={adminSupportRoute}
          onNavigate={(href) => {
            history.pushState({}, '', href);
            void routeFromLocation();
          }}
          onProtectedStateCleared={clearProtectedState}
        />
      )}
      {surface === 'crm' && communicationsMode && (
        <Suspense
          fallback={
            <p className="state-panel" role="status">
              Loading Communications...
            </p>
          }
        >
          {communicationsMode.kind !== 'workflow' && (
            <CommunicationsPanel
              contactId={
                communicationsMode.kind === 'contact' ? communicationsMode.contactId : undefined
              }
              onProtectedStateCleared={clearProtectedState}
            />
          )}
        </Suspense>
      )}
      {surface === 'crm' && !communicationsMode && (
        <WorkspaceTabs
          tabs={CONTACTS_SECTIONS}
          currentId={contactsSection}
          label="People and family management"
          onNavigate={openContactSection}
        />
      )}
      {surface === 'crm' &&
        !communicationsMode &&
        !contactOperationsMode &&
        contactsSection !== 'people' && (
          <Suspense
            fallback={
              <p className="state-panel" role="status">
                Loading {CONTACTS_SECTIONS.find((item) => item.id === contactsSection)?.label}...
              </p>
            }
          >
            <AdminDirectoryPanel
              mode={contactsSection === 'access' ? 'users' : contactsSection}
              csrfToken={session?.csrf_token ?? ''}
              selectedRecordId={
                contactsSection === 'users'
                  ? contactsRoute.searchParams.get('user_key')
                  : contactsSection === 'learners'
                    ? contactsRoute.searchParams.get('learner_key')
                    : undefined
              }
              onSessionExpired={clearProtectedState}
            />
          </Suspense>
        )}
      {surface === 'crm' &&
        contactsSection === 'people' &&
        contactOperationsMode &&
        !communicationsMode && (
          <Suspense
            fallback={
              <p className="state-panel" role="status">
                Loading Parent household operations...
              </p>
            }
          >
            <ContactOperationsPanel
              csrfToken={session?.csrf_token ?? ''}
              initialHouseholdKey={contactOperationsHouseholdKey}
              onProtectedStateCleared={clearProtectedState}
            />
          </Suspense>
        )}
      {surface === 'crm' &&
        contactsSection === 'people' &&
        !contactOperationsMode &&
        !communicationsMode &&
        creating && (
          <ContactForm
            title="Add contact"
            initial={emptyForm}
            canAssign={canAssign}
            assignees={assignees}
            onCancel={() => setCreating(false)}
            onSave={(form, idempotencyKey) => saveContact(form, 'create', idempotencyKey)}
          />
        )}
      {surface === 'crm' &&
        contactsSection === 'people' &&
        !communicationsMode &&
        !contactOperationsMode &&
        selected &&
        (editing ? (
          <ContactForm
            title="Edit contact"
            initial={detailToForm(selected)}
            canAssign={canAssign}
            assignees={assignees}
            onCancel={() => setEditing(false)}
            onSave={(form) => saveContact(form, 'edit')}
          />
        ) : (
          <ContactOverview
            contact={selected}
            loading={detailLoading}
            error={detailError}
            csrfToken={session?.csrf_token ?? ''}
            canEdit={canEdit}
            canReply={canReadCommunications}
            onRetry={() => void loadContact(selected.contact_id)}
            onChanged={() => void loadContact(selected.contact_id)}
            onArchived={() => void backToList()}
            onRestored={() => void loadContact(selected.contact_id)}
          />
        ))}
      {surface === 'crm' &&
        contactsSection === 'people' &&
        !communicationsMode &&
        !contactOperationsMode &&
        detailLoading &&
        !selected && (
          <section className="contact-detail" data-usable="crm-detail" aria-busy="true">
            <DetailSkeleton />
          </section>
        )}
      {surface === 'crm' &&
        contactsSection === 'people' &&
        !communicationsMode &&
        !contactOperationsMode &&
        !creating &&
        !selected &&
        !detailLoading &&
        !editing && (
          <ContactList
            contacts={contacts}
            loading={listLoading}
            error={listError}
            nextCursor={nextCursor}
            query={query}
            canEdit={canEdit}
            onOpen={openContact}
            onRetry={() => void loadList(undefined, query)}
            onLoadMore={() => void loadList(nextCursor ?? undefined, query)}
            onCreate={startCreate}
          />
        )}
      {surface === 'crm' &&
        contactsSection === 'people' &&
        !communicationsMode &&
        !contactOperationsMode &&
        !creating &&
        !selected &&
        !editing &&
        detailError && (
          <StatePanel
            kind="error"
            title="Contact not found or unavailable"
            body={detailError}
            actionLabel="Back to CRM"
            onAction={() => void backToList()}
          />
        )}
    </AppShell>
  );
}

function AdminSupportContainer({
  csrfToken,
  route,
  onNavigate,
  onProtectedStateCleared,
}: {
  csrfToken: string;
  route: AdminSupportRoute;
  onNavigate: (href: string) => void;
  onProtectedStateCleared: () => void;
}) {
  const [tickets, setTickets] = useState<readonly SupportAdminView[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const loadSequence = useRef(0);

  useEffect(() => {
    void load();
  }, [route.mode, route.ticketId]);

  async function load() {
    const requestId = ++loadSequence.current;
    setLoading(true);
    setTickets([]);
    try {
      if (route.mode === 'detail' && route.ticketId) {
        const response = await getAdminSupportTicket(route.ticketId);
        if (requestId !== loadSequence.current) return;
        setTickets([response.data]);
      } else {
        const response = await listAdminSupportTickets();
        if (requestId !== loadSequence.current) return;
        setTickets(response.data);
      }
      setStatus('');
    } catch (error) {
      if (error instanceof AuthExpiredError) {
        onProtectedStateCleared();
        return;
      }
      if (requestId !== loadSequence.current) return;
      setStatus(errorMessage(error, 'Support operations could not load.'));
    } finally {
      if (requestId === loadSequence.current) setLoading(false);
    }
  }

  async function mutate(run: () => Promise<unknown>, successMessage: string) {
    setStatus('Saving support conversation...');
    try {
      await run();
      await load();
      setStatus(successMessage);
    } catch (error) {
      if (error instanceof AuthExpiredError) {
        onProtectedStateCleared();
        return;
      }
      setStatus(errorMessage(error, 'Support conversation could not be updated.'));
    }
  }

  if (loading) {
    return (
      <section className="state-panel" role="status">
        <h2>Loading support operations</h2>
      </section>
    );
  }

  return (
    <>
      <p className="form-status" role="status">
        {status}
      </p>
      <AdminSupportWorkspace
        tickets={tickets}
        mode={route.mode}
        onNavigate={onNavigate}
        onAssign={(ticketId, assigneeAdminId, expectedVersion) =>
          void mutate(
            () =>
              assignAdminSupportTicket({
                csrfToken,
                ticketId,
                assigneeAdminId,
                expectedVersion,
              }),
            'Support conversation assigned.',
          )
        }
        onStatus={(ticketId, nextStatus: SupportLifecycleState, expectedVersion) =>
          void mutate(
            () =>
              updateAdminSupportTicketStatus({
                csrfToken,
                ticketId,
                status: nextStatus,
                expectedVersion,
              }),
            'Support status updated.',
          )
        }
        onReply={(ticketId, body, expectedVersion) =>
          void mutate(
            () =>
              replyAdminSupportTicket({
                csrfToken,
                ticketId,
                body,
                expectedVersion,
                idempotencyKey: createIdempotencyKey(),
              }),
            'In-app reply saved.',
          )
        }
      />
    </>
  );
}

function ReadOnlyToolbar({
  label,
  actionId,
  loading,
  onRefresh,
}: {
  label: string;
  actionId: string;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="detail-toolbar">
      <span className="toolbar-summary">Last refreshed from your One Time workspace.</span>
      <button
        type="button"
        className="button-secondary"
        data-action-id={actionId}
        disabled={loading}
        onClick={onRefresh}
      >
        {loading ? 'Refreshing...' : label}
      </button>
    </div>
  );
}

function RabbiDashboardPanel() {
  const destinations = [
    {
      title: 'Today’s canonical class',
      detail:
        'Sunday–Thursday at 7:00 PM Asia/Jerusalem. Start, continue, or end from the protected classroom control.',
      href: '/app/live',
    },
    {
      title: 'Learning',
      detail: 'Review classroom, library, questions, attendance, and recordings.',
      href: '/app/learning/classroom',
    },
  ];
  return (
    <section className="dashboard-surface" data-usable="rabbi-dashboard">
      <Card className="dashboard-overview-card">
        <h2>Rabbi teaching workspace</h2>
        <p>
          This account is limited to teaching operations. Billing, contact administration,
          credentials, and role assignment are not available.
        </p>
        <ul className="dashboard-overview-list">
          {destinations.map((destination) => (
            <li key={destination.href}>
              <span>
                <strong>{destination.title}</strong>
                <small>{destination.detail}</small>
              </span>
              <Button
                type="button"
                variant="secondary"
                onClick={() => window.location.assign(destination.href)}
              >
                Open
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

function RabbiTeachingContentPanel({
  items,
  loading,
  error,
  onRetry,
}: {
  items: ContentLibraryItemSummary[];
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  if (loading && !items.length) return <ReadOnlySkeleton label="Loading teaching content" />;
  if (error) {
    return (
      <StatePanel
        kind="error"
        title="Teaching content could not load"
        body={error}
        actionLabel="Retry"
        onAction={onRetry}
      />
    );
  }
  if (!items.length) {
    return (
      <EmptyState
        title="No teaching content yet"
        body="Published lesson and media items will appear here."
      />
    );
  }
  return (
    <section className="dashboard-surface" data-usable="rabbi-teaching-content">
      <Card className="dashboard-overview-card">
        <h2>Teaching content</h2>
        <p>Read-only lesson and media library for classroom preparation.</p>
        <ul className="dashboard-overview-list">
          {items.map((item) => (
            <li key={item.item_key}>
              <span>
                <strong>{item.title}</strong>
                <small>
                  {productStateLabel(item.lifecycle_state)} · {item.item_type.replaceAll('_', ' ')}
                </small>
              </span>
              <span>
                <Chip label={`Revision ${item.latest_revision_number}`} tone="status" />
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

function DashboardPanel({
  dashboard,
  loading,
  error,
  section,
  onNavigate,
  onRetry,
}: {
  dashboard: OwnerDashboardResponse | null;
  loading: boolean;
  error: string;
  section: DashboardSectionId;
  onNavigate: (href: string) => void;
  onRetry: () => void;
}) {
  return (
    <section className="dashboard-surface" data-usable="owner-dashboard" aria-busy={loading}>
      <WorkspaceTabs
        tabs={DASHBOARD_SECTIONS}
        currentId={section}
        label="Dashboard area"
        onNavigate={onNavigate}
      />
      {loading && !dashboard ? (
        <ReadOnlySkeleton label="Loading dashboard" />
      ) : error ? (
        <StatePanel
          kind="error"
          title="Dashboard could not load"
          body={error}
          actionLabel="Retry"
          onAction={onRetry}
        />
      ) : !dashboard ? (
        <StatePanel
          kind="empty"
          title="Dashboard unavailable"
          body="The owner dashboard source did not return data."
          actionLabel="Retry"
          onAction={onRetry}
        />
      ) : (
        <>
          <Card className="dashboard-overview-card" data-usable="canonical-class-card">
            <h2>One Time recurring class</h2>
            <p>Sunday–Thursday at 7:00 PM Asia/Jerusalem.</p>
            <dl className="dashboard-overview-list">
              <div>
                <dt>Class state</dt>
                <dd>Check protected readiness before starting.</dd>
              </div>
              <div>
                <dt>Membership</dt>
                <dd>
                  Active entitled Parent learners and Students are resolved from app access; no
                  manual enrollment is required for the daily flow.
                </dd>
              </div>
              <div>
                <dt>Attendance and recordings</dt>
                <dd>Available from the current occurrence when recorded.</dd>
              </div>
            </dl>
            <div className="form-actions">
              <Button type="button" variant="primary" onClick={() => onNavigate('/app/live')}>
                Check readiness
              </Button>
              <Button type="button" onClick={() => onNavigate('/app/learning/classroom')}>
                Open Classroom
              </Button>
            </div>
          </Card>
          <Card className="dashboard-overview-card">
            <h2>Workspace overview</h2>
            <ul className="dashboard-overview-list">
              {dashboard.dashboard.sections
                .filter(
                  (item) =>
                    !(
                      item.id === 'support' &&
                      item.state === 'no_data_yet' &&
                      /not mounted|not available/i.test(item.detail)
                    ),
                )
                .map((item) => (
                  <li key={item.id}>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.detail}</small>
                    </span>
                    <span>
                      <Chip label={productStateLabel(item.state)} tone="status" />
                      <strong>{item.value_label}</strong>
                    </span>
                  </li>
                ))}
            </ul>
          </Card>
        </>
      )}
    </section>
  );
}

function AccountPanel({
  section,
  user,
  csrfToken,
  onNavigate,
}: {
  section: 'profile' | 'security' | 'privacy';
  user: SessionUser | null;
  csrfToken: string;
  onNavigate: (href: string) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const passwordValid =
    currentPassword.length > 0 &&
    newPassword.length >= 6 &&
    newPassword.length <= 128 &&
    newPassword === confirmPassword &&
    newPassword !== currentPassword;

  return (
    <section className="dashboard-surface" aria-label="Account">
      <WorkspaceTabs
        tabs={ACCOUNT_SECTIONS}
        currentId={section}
        label="Account area"
        onNavigate={onNavigate}
      />
      {section === 'profile' ? (
        <Card className="dashboard-overview-card">
          <h2>Profile</h2>
          <p>Your secure One Time account identity.</p>
          <dl className="dashboard-overview-list">
            <div>
              <dt>Name</dt>
              <dd>{user?.display_name ?? 'Loading account'}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user?.email ?? 'Loading account'}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{user ? roleLabel(user) : 'Loading account'}</dd>
            </div>
          </dl>
        </Card>
      ) : section === 'privacy' ? (
        <Card className="dashboard-overview-card">
          <h2>Privacy</h2>
          <p>
            One Time displays only the account data necessary for your authorized workspace. Student
            identities remain local to One Time and are never created as GHL contacts.
          </p>
          <p>
            <a href="/privacy">Read the privacy notice</a>
          </p>
        </Card>
      ) : (
        <Card className="dashboard-overview-card">
          <h2>Sign-in &amp; Security</h2>
          <p>
            Change the password for this signed-in account. This never displays a credential or
            reset token.
          </p>
          <form
            className="contact-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!passwordValid || saving) return;
              setSaving(true);
              setNotice(null);
              void changeOwnPassword({ csrfToken, currentPassword, newPassword })
                .then((result) => {
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setNotice({
                    kind: 'success',
                    message:
                      result.sessions_invalidated > 0
                        ? `Password changed. ${result.sessions_invalidated} other session${result.sessions_invalidated === 1 ? '' : 's'} signed out.`
                        : 'Password changed. This session remains signed in.',
                  });
                })
                .catch((caught) =>
                  setNotice({
                    kind: 'error',
                    message: errorMessage(caught, 'Password was not changed.'),
                  }),
                )
                .finally(() => setSaving(false));
            }}
          >
            <label>
              <span>Current password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                required
                maxLength={128}
                onChange={(event) => setCurrentPassword(event.currentTarget.value)}
              />
            </label>
            <label>
              <span>New password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                required
                minLength={6}
                maxLength={128}
                onChange={(event) => setNewPassword(event.currentTarget.value)}
              />
            </label>
            <label>
              <span>Confirm new password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                required
                minLength={6}
                maxLength={128}
                onChange={(event) => setConfirmPassword(event.currentTarget.value)}
              />
            </label>
            {notice && <NoticeBanner notice={notice} />}
            <div className="form-actions">
              <Button type="submit" variant="primary" disabled={!passwordValid || saving}>
                {saving ? 'Changing password' : 'Change password'}
              </Button>
            </div>
          </form>
          <p>
            Cannot use the current password? <a href="/forgot-password">Request a secure reset</a>.
          </p>
        </Card>
      )}
    </section>
  );
}

function OperationsPanel({
  csrfToken,
  dashboard,
  loading,
  error,
  onNavigate,
  onRetry,
}: {
  csrfToken: string;
  dashboard: OwnerDashboardResponse | null;
  loading: boolean;
  error: string;
  onNavigate: (href: string) => void;
  onRetry: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<Notice | null>(null);
  const passwordReady = newPassword.length >= 6 && newPassword.length <= 128;
  const passwordMatches = newPassword === confirmPassword;
  const canChangePassword =
    !savingPassword &&
    currentPassword.length > 0 &&
    passwordReady &&
    passwordMatches &&
    newPassword !== currentPassword;

  return (
    <section className="dashboard-surface" data-usable="application-operations" aria-busy={loading}>
      <Card className="dashboard-overview-card">
        <h2>Application operations</h2>
        <p>Live application state and direct access to persistent administrative workflows.</p>
        {loading && !dashboard ? (
          <ReadOnlySkeleton label="Loading application operations" />
        ) : error ? (
          <StatePanel
            kind="error"
            title="Application operations could not load"
            body={error}
            actionLabel="Retry"
            onAction={onRetry}
          />
        ) : dashboard ? (
          <ul className="dashboard-overview-list">
            {dashboard.dashboard.sections.map((item) => (
              <li key={item.id}>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
                <span>
                  <Chip label={productStateLabel(item.state)} tone="status" />
                  <strong>{item.value_label}</strong>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <StatePanel
            kind="empty"
            title="No application state is available"
            body="Refresh to load the current persistent application state."
            actionLabel="Refresh"
            onAction={onRetry}
          />
        )}
        <div className="form-actions">
          <Button type="button" onClick={() => onNavigate('/app/crm/audit')}>
            Audit History
          </Button>
          <Button type="button" onClick={() => onNavigate('/app/crm/users')}>
            Users &amp; Roles
          </Button>
          <Button type="button" onClick={() => onNavigate('/app/classes/occurrences')}>
            Classes &amp; Zoom
          </Button>
          <Button type="button" onClick={() => onNavigate('/app/live-console')}>
            Live Console
          </Button>
          <Button type="button" onClick={onRetry}>
            Refresh status
          </Button>
        </div>
      </Card>

      <Card className="dashboard-overview-card">
        <h2>Account Security</h2>
        <p>Change the password for this signed-in Administrator account.</p>
        <form
          className="contact-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canChangePassword) return;
            setSavingPassword(true);
            setPasswordNotice(null);
            void changeOwnPassword({
              csrfToken,
              currentPassword,
              newPassword,
            })
              .then((result) => {
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setPasswordNotice({
                  kind: 'success',
                  message:
                    result.sessions_invalidated > 0
                      ? `Password changed. ${result.sessions_invalidated} other session${
                          result.sessions_invalidated === 1 ? '' : 's'
                        } signed out.`
                      : 'Password changed. This session remains signed in.',
                });
              })
              .catch((caught) => {
                setPasswordNotice({
                  kind: 'error',
                  message: errorMessage(caught, 'Password was not changed.'),
                });
              })
              .finally(() => setSavingPassword(false));
          }}
        >
          <label>
            <span>Current password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              required
              maxLength={128}
              onChange={(event) => setCurrentPassword(event.currentTarget.value)}
            />
          </label>
          <label>
            <span>New password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              required
              minLength={6}
              maxLength={128}
              aria-describedby="admin-password-help"
              onChange={(event) => setNewPassword(event.currentTarget.value)}
            />
          </label>
          <label>
            <span>Confirm new password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              required
              minLength={6}
              maxLength={128}
              onChange={(event) => setConfirmPassword(event.currentTarget.value)}
            />
          </label>
          <p id="admin-password-help">
            At least 6 characters.
            {confirmPassword && !passwordMatches ? ' The new passwords do not match.' : ''}
          </p>
          {passwordNotice && <NoticeBanner notice={passwordNotice} />}
          <div className="form-actions">
            <Button type="submit" variant="primary" disabled={!canChangePassword}>
              {savingPassword ? 'Changing password' : 'Change password'}
            </Button>
          </div>
        </form>
        <p>
          Cannot use the current password? <a href="/forgot-password">Request a secure reset</a>.
        </p>
      </Card>
    </section>
  );
}

function ClassesPanel({
  csrfToken,
  section,
  liveConsoleReady,
  selectedSeriesKey,
  teachingOnly,
  classes,
  selectedClass,
  gamificationDashboard,
  gamificationLoading,
  gamificationError,
  adminLearning,
  adminLearningLoading,
  adminLearningError,
  loading,
  error,
  detailLoading,
  detailError,
  onNavigate,
  onSelectOccurrence,
  onRetry,
  onRefreshOccurrences,
  onRetryDetail,
  onRetryRewards,
  onRetryLearning,
}: {
  csrfToken: string;
  section: ClassroomSectionId;
  liveConsoleReady: boolean;
  selectedSeriesKey: string | null;
  teachingOnly: boolean;
  classes: ClassOccurrenceSummary[];
  selectedClass: ClassOccurrenceDetail | null;
  gamificationDashboard: AdminGamificationDashboardResponse | null;
  gamificationLoading: boolean;
  gamificationError: string;
  adminLearning: AdminLearningSnapshot | null;
  adminLearningLoading: boolean;
  adminLearningError: string;
  loading: boolean;
  error: string;
  detailLoading: boolean;
  detailError: string;
  onNavigate: (href: string) => void;
  onSelectOccurrence: (occurrenceKey: string) => void;
  onRetry: () => void;
  onRefreshOccurrences: (preferredOccurrenceKey?: string | null) => Promise<void>;
  onRetryDetail: (occurrenceKey: string) => void;
  onRetryRewards: () => void;
  onRetryLearning: () => Promise<void>;
}) {
  const teachingSections = [
    'classes',
    'occurrences',
    'questions',
    'rewards',
    'live-console',
  ] as ClassroomSectionId[];
  const focusedSection = teachingOnly && !teachingSections.includes(section) ? 'classes' : section;
  const isManagementSection =
    !teachingOnly &&
    (
      ['classes', 'occurrences', 'enrollments', 'recordings', 'access'] as ClassroomSectionId[]
    ).includes(section);
  return (
    <section className="classroom-workspace" aria-busy={loading || detailLoading}>
      <WorkspaceTabs
        tabs={CLASSROOM_SECTIONS.filter(
          (item) => !teachingOnly || teachingSections.includes(item.id),
        ).map((item) => ({
          ...item,
          href: classroomHref(item.id, selectedClass?.occurrence_key),
        }))}
        currentId={focusedSection}
        label="Classroom area"
        onNavigate={onNavigate}
      />
      {!teachingOnly && section === 'questions' ? (
        <AdminLearningPanel
          mode="questions"
          snapshot={adminLearning}
          loading={adminLearningLoading}
          error={adminLearningError}
          onRetry={onRetryLearning}
          onTransitionQuestion={async (transition) => {
            await transitionAdminQuestion(csrfToken, transition);
            await onRetryLearning();
          }}
        />
      ) : !teachingOnly && section === 'rewards' ? (
        <>
          <AdminLearningPanel
            mode="questions"
            snapshot={adminLearning}
            loading={adminLearningLoading}
            error={adminLearningError}
            onRetry={onRetryLearning}
          />
          <GamificationAdminPanel
            dashboard={gamificationDashboard}
            loading={gamificationLoading}
            error={gamificationError}
            onRetry={onRetryRewards}
          />
        </>
      ) : !teachingOnly && section === 'attendance' ? (
        <AdminLearningPanel
          mode="attendance"
          snapshot={adminLearning}
          loading={adminLearningLoading}
          error={adminLearningError}
          onRetry={onRetryLearning}
          onCorrectAttendance={async (correction) => {
            await correctAdminAttendance(csrfToken, correction);
            await onRetryLearning();
          }}
        />
      ) : isManagementSection ? (
        <ClassManagementWorkspace
          csrfToken={csrfToken}
          section={section}
          dailyFlow={location.pathname.startsWith('/app/learning')}
          selectedSeriesKey={selectedSeriesKey}
          occurrences={classes}
          selectedOccurrenceKey={selectedClass?.occurrence_key ?? null}
          occurrencesLoading={loading}
          occurrencesError={error}
          onSelectOccurrence={onSelectOccurrence}
          onRefreshOccurrences={onRefreshOccurrences}
          onNavigate={onNavigate}
        />
      ) : loading && classes.length === 0 ? (
        <ReadOnlySkeleton label="Loading classroom" />
      ) : error ? (
        <StatePanel
          kind="error"
          title="Classroom could not load"
          body={error}
          actionLabel="Retry"
          onAction={onRetry}
        />
      ) : classes.length === 0 ? (
        <StatePanel
          kind="empty"
          title="No classes yet"
          body="No class schedule has been recorded yet."
        />
      ) : (
        <>
          <label className="classroom-occurrence-selector">
            <span>Class occurrence</span>
            <Select
              value={selectedClass?.occurrence_key ?? ''}
              onChange={(event) => onSelectOccurrence(event.currentTarget.value)}
            >
              {!selectedClass && (
                <option value="" disabled>
                  Choose an occurrence
                </option>
              )}
              {classes.map((classItem) => (
                <option key={classItem.occurrence_key} value={classItem.occurrence_key}>
                  {classItem.title} - {formatDate(classItem.starts_at)}
                </option>
              ))}
            </Select>
          </label>
          {detailLoading && !selectedClass ? (
            <ReadOnlySkeleton label="Loading class details" />
          ) : detailError && !selectedClass ? (
            <StatePanel
              kind="error"
              title="Class details could not load"
              body={detailError}
              actionLabel="Retry"
              onAction={() => onRetryDetail(classes[0]?.occurrence_key ?? '')}
            />
          ) : selectedClass ? (
            <ClassroomFocusedBody
              section={focusedSection}
              occurrence={selectedClass}
              gamificationDashboard={gamificationDashboard}
              gamificationLoading={gamificationLoading}
              gamificationError={gamificationError}
              onRetryRewards={onRetryRewards}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

function ClassroomFocusedBody({
  section,
  occurrence,
  gamificationDashboard,
  gamificationLoading,
  gamificationError,
  onRetryRewards,
}: {
  section: ClassroomSectionId;
  occurrence: ClassOccurrenceDetail;
  gamificationDashboard: AdminGamificationDashboardResponse | null;
  gamificationLoading: boolean;
  gamificationError: string;
  onRetryRewards: () => void;
}) {
  if (section === 'rewards') {
    return (
      <GamificationAdminPanel
        dashboard={gamificationDashboard}
        loading={gamificationLoading}
        error={gamificationError}
        onRetry={onRetryRewards}
      />
    );
  }

  const rows =
    section === 'questions'
      ? [
          ['New questions', occurrence.question_summary.new_questions],
          ['Featured', occurrence.question_summary.featured_questions],
          ['Answered', occurrence.question_summary.answered_questions],
        ]
      : [
          ['Households', occurrence.enrollment_counts.households],
          ['Learners', occurrence.enrollment_counts.learners],
          ['Joined sessions', occurrence.attendance_summary.joined_attempts],
          ['Recordings', occurrence.content_summary.videos],
        ];

  return (
    <article
      className={`readonly-row classroom-focused state-${productStateClass(
        occurrence.product_state.label,
      )}`}
    >
      <div>
        <h2>{occurrence.title}</h2>
        <p>{occurrence.product_state.explanation}</p>
        <div className="chip-row">
          <Chip label={occurrence.product_state.label} tone="status" />
          <Chip label={readableState(occurrence.status)} tone="source" />
        </div>
      </div>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function AdminLearningPanel({
  mode,
  snapshot,
  loading,
  error,
  onRetry,
  onTransitionQuestion,
  onCorrectAttendance,
}: {
  mode: 'questions' | 'attendance';
  snapshot: AdminLearningSnapshot | null;
  loading: boolean;
  error: string;
  onRetry: () => Promise<void>;
  onTransitionQuestion?: React.ComponentProps<
    typeof AdminLearningWorkspace
  >['onTransitionQuestion'];
  onCorrectAttendance?: React.ComponentProps<typeof AdminLearningWorkspace>['onCorrectAttendance'];
}) {
  if (loading && !snapshot) return <ReadOnlySkeleton label="Loading learning engagement" />;
  if (error && !snapshot) {
    return (
      <StatePanel
        kind="error"
        title="Learning engagement could not load"
        body={error}
        actionLabel="Retry"
        onAction={() => void onRetry()}
      />
    );
  }
  if (!snapshot) return null;
  return (
    <AdminLearningWorkspace
      {...snapshot}
      mode={mode}
      {...(onTransitionQuestion ? { onTransitionQuestion } : {})}
      {...(onCorrectAttendance ? { onCorrectAttendance } : {})}
    />
  );
}

function BillingPanel({
  dashboard,
  loading,
  error,
  onRetry,
}: {
  dashboard: OwnerDashboardResponse | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  if (loading && !dashboard) return <ReadOnlySkeleton label="Loading household access" />;
  if (error) {
    return (
      <StatePanel
        kind="error"
        title="Household access could not load"
        body={error}
        actionLabel="Retry"
        onAction={onRetry}
      />
    );
  }
  const billing = dashboard?.dashboard.sections.find(
    (section) => section.id === 'billing_readiness',
  );
  if (!billing) {
    return (
      <StatePanel
        kind="empty"
        title="Household access unavailable"
        body="Current access did not return a dashboard section."
        actionLabel="Retry"
        onAction={onRetry}
      />
    );
  }
  return (
    <section className="readonly-list" aria-busy={loading}>
      <article className={`readonly-row state-${billing.state}`}>
        <div>
          <h2>{billing.label}</h2>
          <p>{billing.detail}</p>
        </div>
        <dl>
          <div>
            <dt>Status</dt>
            <dd>{productStateLabel(billing.state)}</dd>
          </div>
          <div>
            <dt>Count</dt>
            <dd>{billing.value_label}</dd>
          </div>
          <div>
            <dt>Payment history</dt>
            <dd>Managed in GHL</dd>
          </div>
        </dl>
      </article>
      {dashboard?.dashboard.household_access.map((access) => (
        <article
          className={`readonly-row state-${access.grants_access ? 'ready' : 'action_needed'}`}
          key={access.household_key}
        >
          <div>
            <h2>{access.household_label}</h2>
            <p>
              {access.household_status === 'archived'
                ? 'Archived household'
                : access.grants_access
                  ? 'Learning access is active.'
                  : 'Learning access is not active.'}
            </p>
          </div>
          <dl>
            <div>
              <dt>Current state</dt>
              <dd>{readableState(access.state)}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{access.source_label}</dd>
            </div>
            <div>
              <dt>Effective</dt>
              <dd>{formatOptionalDate(access.effective_at)}</dd>
            </div>
            <div>
              <dt>Expires</dt>
              <dd>{formatOptionalDate(access.expires_at)}</dd>
            </div>
            <div>
              <dt>Review / revocation reason</dt>
              <dd>{access.review_or_revocation_reason ?? 'None'}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{formatOptionalDate(access.updated_at)}</dd>
            </div>
          </dl>
        </article>
      ))}
      {dashboard?.dashboard.household_access.length === 0 && (
        <p className="state-panel">No scoped households are available yet.</p>
      )}
    </section>
  );
}

function ReadOnlySkeleton({ label }: { label: string }) {
  return (
    <div className="skeleton-list" role="status" aria-label={label}>
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="skeleton-row" key={index}>
          <span />
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

function ListToolbar({
  query,
  activeChips,
  canEdit,
  canOperateHouseholds,
  onChange,
  onApply,
  onClear,
  onCreate,
  onHouseholdOperations,
}: {
  query: QueryState;
  activeChips: { key: string; label: string }[];
  canEdit: boolean;
  canOperateHouseholds: boolean;
  onChange: (query: QueryState) => void;
  onApply: (query: QueryState) => void;
  onClear: () => void;
  onCreate: () => void;
  onHouseholdOperations: () => void;
}) {
  return (
    <form
      className="toolbar-grid"
      onSubmit={(event) => {
        event.preventDefault();
        onApply(query);
      }}
    >
      <div className="toolbar-filters" aria-label="CRM filters">
        <label className={query.search ? 'is-selected' : undefined}>
          <span>Search</span>
          <input
            value={query.search}
            autoComplete="off"
            placeholder="Search contacts"
            onChange={(event) => onChange({ ...query, search: event.target.value })}
          />
        </label>
        <label className={query.classification ? 'is-selected' : undefined}>
          <span>Type</span>
          <select
            value={query.classification}
            onChange={(event) => onChange({ ...query, classification: event.target.value })}
          >
            <option value="">All</option>
            <option value="family">Family</option>
            <option value="school">School</option>
          </select>
        </label>
        <label className={query.lead_status ? 'is-selected' : undefined}>
          <span>Status</span>
          <select
            value={query.lead_status}
            onChange={(event) => onChange({ ...query, lead_status: event.target.value })}
          >
            <option value="">All</option>
            <option value="new">New</option>
            <option value="in_review">In review</option>
            <option value="contacted">Contacted</option>
            <option value="scheduled">Scheduled</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className={query.sort !== 'updated_desc' ? 'is-selected' : undefined}>
          <span>Sort</span>
          <select
            value={query.sort}
            onChange={(event) => onChange({ ...query, sort: event.target.value })}
          >
            <option value="updated_desc">Recently updated</option>
            <option value="created_desc">Newest</option>
            <option value="name_asc">Name</option>
          </select>
        </label>
        <button type="submit" className="button-secondary">
          Apply
        </button>
      </div>
      {activeChips.length > 0 && (
        <div className="active-filter-row" aria-label="Active filters">
          {activeChips.map((chip) => (
            <span key={`${chip.key}:${chip.label}`}>{chip.label}</span>
          ))}
          <button type="button" className="text-button" onClick={onClear}>
            Clear filters
          </button>
        </div>
      )}
      {(canEdit || canOperateHouseholds) && (
        <div className="toolbar-primary toolbar-primary--group">
          {canOperateHouseholds && (
            <button
              type="button"
              className="button-secondary"
              onClick={() => onHouseholdOperations()}
            >
              Parent household
            </button>
          )}
          {canEdit && (
            <button type="button" className="button-primary" onClick={onCreate}>
              Add contact
            </button>
          )}
        </div>
      )}
    </form>
  );
}

function DetailToolbar({
  contact,
  canEdit,
  canReadCommunications,
  onBack,
  onEdit,
  onCommunications,
  onManageHousehold,
}: {
  contact: ContactDetail;
  canEdit: boolean;
  canReadCommunications: boolean;
  onBack: () => void;
  onEdit: () => void;
  onCommunications: () => void;
  onManageHousehold?: (() => void) | undefined;
}) {
  return (
    <div className="detail-toolbar">
      <button type="button" className="button-secondary" onClick={onBack}>
        Back to CRM
      </button>
      <div className="toolbar-summary" aria-label="Contact summary">
        <Chip label={capitalize(contact.family_school_classification)} tone="classification" />
        <Chip label={labelStatus(contact.lead_status)} tone="status" />
        <Chip label={sourceLabel(contact.source)} tone="source" />
      </div>
      {canReadCommunications && (
        <button type="button" className="button-secondary" onClick={onCommunications}>
          Communications
        </button>
      )}
      {onManageHousehold && (
        <button type="button" className="button-secondary" onClick={onManageHousehold}>
          Manage household
        </button>
      )}
      {canEdit && (
        <button type="button" className="button-primary" onClick={onEdit}>
          Edit contact
        </button>
      )}
    </div>
  );
}

function DetailLoadingToolbar() {
  return (
    <div
      className="detail-toolbar detail-toolbar--loading"
      role="status"
      aria-label="Loading contact detail"
    >
      <span className="toolbar-summary">Loading contact details...</span>
    </div>
  );
}

function FormToolbar({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="detail-toolbar">
      <button type="button" className="button-secondary" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

function ContactList({
  contacts,
  loading,
  error,
  nextCursor,
  query,
  canEdit,
  onOpen,
  onRetry,
  onLoadMore,
  onCreate,
}: {
  contacts: ContactListItem[];
  loading: boolean;
  error: string;
  nextCursor: string | null;
  query: QueryState;
  canEdit: boolean;
  onOpen: (contactId: string) => void;
  onRetry: () => void;
  onLoadMore: () => void;
  onCreate: () => void;
}) {
  const hasFilters = Boolean(query.search.trim() || query.classification || query.lead_status);
  return (
    <section className="crm-list" data-usable="crm-list" aria-busy={loading}>
      {loading && <ListSkeleton />}
      {!loading && error && (
        <StatePanel
          kind="error"
          title="CRM contacts could not load"
          body={`${error} Try again when the connection is ready.`}
          actionLabel="Retry"
          onAction={onRetry}
        />
      )}
      {!loading && !error && contacts.length === 0 && (
        <StatePanel
          kind="empty"
          title={hasFilters ? 'No contacts match these filters' : 'No contacts yet'}
          body={
            hasFilters
              ? 'Adjust search or filters to review another set of contacts.'
              : 'Add the first CRM contact when you have a real One Time lead to record.'
          }
          actionLabel={!hasFilters && canEdit ? 'Add contact' : undefined}
          onAction={!hasFilters && canEdit ? onCreate : undefined}
        />
      )}
      {!loading && !error && contacts.length > 0 && (
        <>
          <ContactTable contacts={contacts} onOpen={onOpen} />
          <div className="contact-card-list" aria-label="CRM contacts">
            {contacts.map((contact) => (
              <ContactCard key={contact.contact_id} contact={contact} onOpen={onOpen} />
            ))}
          </div>
          {nextCursor && (
            <button type="button" className="button-secondary load-more" onClick={onLoadMore}>
              Load more
            </button>
          )}
        </>
      )}
    </section>
  );
}

function ContactTable({
  contacts,
  onOpen,
}: {
  contacts: ContactListItem[];
  onOpen: (contactId: string) => void;
}) {
  return (
    <div className="contact-table-wrap">
      <table className="contact-table">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Type</th>
            <th scope="col">Contact</th>
            <th scope="col">Source</th>
            <th scope="col">Last activity</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => (
            <tr
              key={contact.contact_id}
              tabIndex={0}
              role="button"
              data-contact-open={contact.contact_id}
              aria-label={`Open ${contact.display_name}`}
              onClick={() => onOpen(contact.contact_id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpen(contact.contact_id);
                }
              }}
            >
              <td>
                <strong>{contact.display_name}</strong>
                {contact.assigned_team_member && <small>{contact.assigned_team_member}</small>}
              </td>
              <td>
                <Chip
                  label={capitalize(contact.family_school_classification)}
                  tone="classification"
                />
                <Chip label={labelStatus(contact.lead_status)} tone="status" />
              </td>
              <td>{contactMethod(contact)}</td>
              <td>
                <Chip label={sourceLabel(contact.source)} tone="source" />
              </td>
              <td>{formatDate(contact.last_activity_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContactCard({
  contact,
  onOpen,
}: {
  contact: ContactListItem;
  onOpen: (contactId: string) => void;
}) {
  return (
    <button
      type="button"
      className="contact-card"
      data-contact-open={contact.contact_id}
      onClick={() => onOpen(contact.contact_id)}
    >
      <span className="contact-card-heading">
        <strong>{contact.display_name}</strong>
        <span>{formatDate(contact.last_activity_at)}</span>
      </span>
      <span className="chip-row">
        <Chip label={capitalize(contact.family_school_classification)} tone="classification" />
        <Chip label={labelStatus(contact.lead_status)} tone="status" />
        <Chip label={sourceLabel(contact.source)} tone="source" />
      </span>
      <span className="contact-card-meta">
        <span>{contactMethod(contact)}</span>
        {contact.assigned_team_member && <span>{contact.assigned_team_member}</span>}
      </span>
    </button>
  );
}

function ContactOverview({
  contact,
  loading,
  error,
  csrfToken,
  canEdit,
  canReply,
  onRetry,
  onChanged,
  onArchived,
  onRestored,
}: {
  contact: ContactDetail;
  loading: boolean;
  error: string;
  csrfToken: string;
  canEdit: boolean;
  canReply: boolean;
  onRetry: () => void;
  onChanged: () => void;
  onArchived: () => void;
  onRestored: () => void;
}) {
  const [statusError, setStatusError] = useState('');
  const facts = [
    ['Family / School', capitalize(contact.family_school_classification)],
    ['Lead status', labelStatus(contact.lead_status)],
    ['Source', sourceLabel(contact.source)],
    ['Email', contact.email ?? 'Not provided'],
    ['Phone', contact.phone ?? 'Not provided'],
    ['Last activity', formatDate(contact.last_activity_at)],
    ['Consent', readableState(contact.consent_state)],
    ['Suppression', readableState(contact.suppression_state)],
    [
      'Signup provenance',
      contact.audit_safe_signup_provenance.signup_key
        ? 'Public signup captured'
        : 'Manual CRM contact',
    ],
  ];
  if (contact.assigned_team_member) {
    facts.splice(3, 0, ['Assigned team member', contact.assigned_team_member]);
  }

  return (
    <section className="contact-detail" data-usable="crm-detail" aria-busy={loading}>
      {loading && <DetailSkeleton />}
      {!loading && error && (
        <StatePanel
          kind="error"
          title="Contact could not load"
          body={error}
          actionLabel="Retry"
          onAction={onRetry}
        />
      )}
      {!loading && !error && (
        <>
          {statusError && (
            <p className="notice-banner error" role="alert">
              {statusError}
            </p>
          )}
          <dl className="detail-grid">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <section className="note-panel">
            <h2>Tags and system facts</h2>
            <div className="chip-row">
              {contact.tags.map((tag) => (
                <Chip key={tag.tag_id} label={tag.display_name} tone="source" />
              ))}
              {contact.tags.length === 0 && <span>No custom tags</span>}
            </div>
            <div className="fact-list">
              {contact.system_facts.map((fact) => (
                <span key={`${fact.dimension}:${fact.value}`}>{fact.label}</span>
              ))}
            </div>
            {canEdit && (
              <TagComposer
                csrfToken={csrfToken}
                contactId={contact.contact_id}
                onSaved={onChanged}
              />
            )}
          </section>

          <section className="detail-columns">
            <DetailList
              title="Household / relationships"
              empty="No relationships recorded."
              items={contact.relationships.map((relationship) => ({
                key: relationship.relationship_id,
                title: relationship.display_name,
                meta: `${readableState(relationship.type)}${
                  relationship.label ? ` - ${relationship.label}` : ''
                }`,
              }))}
            />
            <DetailList
              title="Enrollment / access"
              empty="No enrollment or access summary available."
              items={contact.enrollment_summary.map((item) => ({
                key: item.label,
                title: item.label,
                meta: item.value,
              }))}
            />
          </section>

          <section className="detail-columns">
            <DetailList
              title="Support tickets"
              empty="No support tickets for this contact."
              items={contact.support_tickets.map((ticket) => ({
                key: ticket.receipt_id,
                title: readableState(ticket.status),
                meta: `${deliveryLabel(ticket.delivery_state)} - ${ticket.public_summary}`,
              }))}
            />
            <DetailList
              title="Tasks"
              empty="No tasks recorded."
              items={contact.tasks.map((task) => ({
                key: task.task_id,
                title: task.title,
                meta: `${readableState(task.status)} - ${formatDate(task.due_at)}`,
              }))}
            />
          </section>

          <section className="note-panel">
            <h2>Notes</h2>
            {contact.notes.length === 0 ? (
              <p>No notes recorded.</p>
            ) : (
              <ol className="timeline-list">
                {contact.notes.map((note) => (
                  <li key={note.note_id}>
                    <strong>{note.author_label}</strong>
                    <span>{formatDate(note.created_at)}</span>
                    <p>{note.body}</p>
                  </li>
                ))}
              </ol>
            )}
            {canEdit && (
              <NoteComposer
                csrfToken={csrfToken}
                contactId={contact.contact_id}
                onSaved={onChanged}
              />
            )}
          </section>

          {canReply && (
            <ReplyComposer csrfToken={csrfToken} contact={contact} onSaved={onChanged} />
          )}

          <section className="note-panel">
            <h2>Timeline</h2>
            {contact.timeline.length === 0 ? (
              <p>No timeline activity recorded.</p>
            ) : (
              <ol className="timeline-list">
                {contact.timeline.map((item) => (
                  <li key={item.timeline_id}>
                    <strong>{item.label}</strong>
                    <span>
                      {formatDate(item.occurred_at)} - {item.status_label}
                    </span>
                    {item.detail && <p>{item.detail}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>

          {canEdit && contact.lead_status !== 'archived' && (
            <button
              type="button"
              className="button-secondary"
              onClick={async () => {
                if (!window.confirm(`Archive ${contact.display_name}?`)) return;
                setStatusError('');
                try {
                  await archiveContactRequest(
                    csrfToken,
                    contact.contact_id,
                    'Archived from CRM detail',
                  );
                  onArchived();
                } catch (caught) {
                  setStatusError(errorMessage(caught, 'Contact could not be archived.'));
                }
              }}
            >
              Archive contact
            </button>
          )}
          {canEdit && contact.lead_status === 'archived' && (
            <button
              type="button"
              className="button-secondary"
              onClick={async () => {
                setStatusError('');
                try {
                  await reactivateContactRequest(csrfToken, contact.contact_id);
                  onRestored();
                } catch (caught) {
                  setStatusError(errorMessage(caught, 'Contact could not be restored.'));
                }
              }}
            >
              Restore contact
            </button>
          )}
        </>
      )}
    </section>
  );
}

function DetailList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: Array<{ key: string; title: string; meta: string }>;
}) {
  return (
    <section className="note-panel">
      <h2>{title}</h2>
      {items.length === 0 ? (
        <p>{empty}</p>
      ) : (
        <ul className="compact-list">
          {items.map((item) => (
            <li key={item.key}>
              <strong>{item.title}</strong>
              <span>{item.meta}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TagComposer({
  csrfToken,
  contactId,
  onSaved,
}: {
  csrfToken: string;
  contactId: string;
  onSaved: () => void;
}) {
  const [tagName, setTagName] = useState('');
  const [status, setStatus] = useState('');
  return (
    <form
      className="inline-editor"
      onSubmit={async (event) => {
        event.preventDefault();
        setStatus('');
        try {
          const tag = await createTag(csrfToken, tagName);
          await assignTag(csrfToken, contactId, tag.tag.tag_id);
          setTagName('');
          setStatus('Tag saved.');
          onSaved();
        } catch (error) {
          setStatus(errorMessage(error, 'Tag could not be saved.'));
        }
      }}
    >
      <label>
        <span>Add tag</span>
        <input value={tagName} onChange={(event) => setTagName(event.target.value)} />
      </label>
      <button type="submit" className="button-secondary">
        Add tag
      </button>
      {status && <p role="status">{status}</p>}
    </form>
  );
}

function NoteComposer({
  csrfToken,
  contactId,
  onSaved,
}: {
  csrfToken: string;
  contactId: string;
  onSaved: () => void;
}) {
  const [body, setBody] = useState('');
  const [status, setStatus] = useState('');
  return (
    <form
      className="inline-editor"
      onSubmit={async (event) => {
        event.preventDefault();
        setStatus('');
        try {
          await appendNote(csrfToken, contactId, body);
          setBody('');
          setStatus('Note saved.');
          onSaved();
        } catch (error) {
          setStatus(errorMessage(error, 'Note could not be saved.'));
        }
      }}
    >
      <label>
        <span>Add note</span>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} />
      </label>
      <button type="submit" className="button-secondary">
        Save note
      </button>
      {status && <p role="status">{status}</p>}
    </form>
  );
}

function ReplyComposer({
  csrfToken,
  contact,
  onSaved,
}: {
  csrfToken: string;
  contact: ContactDetail;
  onSaved: () => void;
}) {
  const [channel, setChannel] = useState<'email' | 'whatsapp'>('email');
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState<
    Awaited<ReturnType<typeof previewReply>>['preview'] | null
  >(null);
  const [status, setStatus] = useState('');
  const idempotencyKey = useRef(createIdempotencyKey());
  return (
    <section className="note-panel">
      <h2>Single-recipient reply</h2>
      <form
        className="inline-editor"
        onSubmit={async (event) => {
          event.preventDefault();
          setStatus('');
          try {
            const nextPreview = await previewReply(csrfToken, contact.contact_id, channel, body);
            setPreview(nextPreview.preview);
            idempotencyKey.current = createIdempotencyKey();
          } catch (error) {
            setStatus(errorMessage(error, 'Reply preview could not be created.'));
          }
        }}
      >
        <label>
          <span>Channel</span>
          <select
            value={channel}
            onChange={(event) => setChannel(event.target.value as 'email' | 'whatsapp')}
          >
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </label>
        <label>
          <span>Reply body</span>
          <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={4} />
        </label>
        <button type="submit" className="button-secondary">
          Preview reply
        </button>
      </form>
      {preview && (
        <div className="reply-preview" role="status">
          <dl className="detail-grid">
            <div>
              <dt>Destination</dt>
              <dd>{preview.destination_masked}</dd>
            </div>
            <div>
              <dt>Channel</dt>
              <dd>{capitalize(preview.channel)}</dd>
            </div>
            <div>
              <dt>Revision</dt>
              <dd>{preview.body_revision}</dd>
            </div>
            <div>
              <dt>Provider mode</dt>
              <dd>Provider off - draft only</dd>
            </div>
          </dl>
          <p>{preview.message}</p>
          {preview.blockers.length > 0 && (
            <ul className="compact-list">
              {preview.blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="button-primary"
            disabled={!preview.confirmation_required}
            onClick={async () => {
              try {
                const result = await confirmReply({
                  csrfToken,
                  contactId: contact.contact_id,
                  channel,
                  body,
                  bodyRevision: preview.body_revision,
                  idempotencyKey: idempotencyKey.current,
                });
                setStatus(result.reply.message);
                setPreview(null);
                setBody('');
                onSaved();
              } catch (error) {
                setStatus(errorMessage(error, 'Reply draft could not be saved.'));
              }
            }}
          >
            Confirm draft
          </button>
        </div>
      )}
      {status && <p role="status">{status}</p>}
    </section>
  );
}

function ContactForm({
  title,
  initial,
  canAssign,
  assignees,
  onCancel,
  onSave,
}: {
  title: string;
  initial: ContactFormState;
  canAssign: boolean;
  assignees: Assignee[];
  onCancel: () => void;
  onSave: (form: ContactFormState, idempotencyKey: string) => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const idempotencyKey = useRef(createIdempotencyKey());
  const formIntent = useRef(contactIntentFingerprint(initial));
  const set = (key: keyof ContactFormState, value: string) =>
    setForm((current) => {
      const next = { ...current, [key]: value };
      const nextIntent = contactIntentFingerprint(next);
      if (nextIntent !== formIntent.current) {
        idempotencyKey.current = createIdempotencyKey();
        formIntent.current = nextIntent;
      }
      return next;
    });
  return (
    <section className="contact-form-shell" aria-labelledby="contact-form-title">
      <h2 id="contact-form-title">{title}</h2>
      {error && (
        <p className="notice-banner error" role="alert">
          {error}
        </p>
      )}
      <form
        className="contact-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          setError('');
          try {
            await onSave(form, idempotencyKey.current);
          } catch (saveError) {
            setError(errorMessage(saveError, 'Contact could not be saved.'));
          } finally {
            setSaving(false);
          }
        }}
      >
        <label>
          <span>Name</span>
          <input
            required
            value={form.display_name}
            onChange={(event) => set('display_name', event.target.value)}
          />
        </label>
        <label>
          <span>Type</span>
          <select
            value={form.family_school_classification}
            onChange={(event) => set('family_school_classification', event.target.value)}
          >
            <option value="family">Family</option>
            <option value="school">School</option>
          </select>
        </label>
        <label>
          <span>Email</span>
          <input
            type="email"
            required
            value={form.email}
            onChange={(event) => set('email', event.target.value)}
          />
        </label>
        <label>
          <span>Phone / WhatsApp</span>
          <input value={form.phone} onChange={(event) => set('phone', event.target.value)} />
        </label>
        <label>
          <span>Location</span>
          <input
            required
            value={form.location}
            onChange={(event) => set('location', event.target.value)}
          />
        </label>
        <label>
          <span>Timezone</span>
          <input
            required
            value={form.timezone}
            onChange={(event) => set('timezone', event.target.value)}
          />
        </label>
        <label>
          <span>Status</span>
          <select
            value={form.lead_status}
            onChange={(event) => set('lead_status', event.target.value)}
          >
            <option value="new">New</option>
            <option value="in_review">In review</option>
            <option value="contacted">Contacted</option>
            <option value="scheduled">Scheduled</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        {canAssign && (
          <label>
            <span>Assigned team member</span>
            <select
              value={form.assigned_user_key}
              onChange={(event) => set('assigned_user_key', event.target.value)}
            >
              <option value="">Unassigned</option>
              {assignees.map((assignee) => (
                <option key={assignee.user_key} value={assignee.user_key}>
                  {assignee.display_name} - {assignee.role_label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="wide-field">
          <span>Internal note</span>
          <textarea
            value={form.internal_note}
            onChange={(event) => set('internal_note', event.target.value)}
          />
        </label>
        <input type="hidden" value={form.version ?? ''} readOnly />
        <div className="form-actions">
          <button type="submit" className="button-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button type="button" className="button-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

function ListSkeleton() {
  return (
    <div className="skeleton-list" role="status" aria-label="Loading contacts">
      {Array.from({ length: 6 }).map((_, index) => (
        <div className="skeleton-row" key={index}>
          <span />
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="detail-grid skeleton-detail" role="status" aria-label="Loading contact detail">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index}>
          <span />
          <strong />
        </div>
      ))}
    </div>
  );
}

function StatePanel({
  kind,
  title,
  body,
  actionLabel,
  onAction,
}: {
  kind: 'empty' | 'error';
  title: string;
  body: string;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
}) {
  return (
    <section className={`state-panel ${kind}`} aria-labelledby={`${kind}-state-title`}>
      <h2 id={`${kind}-state-title`}>{title}</h2>
      <p>{body}</p>
      {actionLabel && onAction && (
        <button type="button" className="button-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </section>
  );
}

function NoticeBanner({ notice }: { notice: Notice }) {
  return (
    <p
      className={`notice-banner ${notice.kind}`}
      role={notice.kind === 'error' ? 'alert' : 'status'}
    >
      {notice.message}
    </p>
  );
}

function Chip({ label, tone }: { label: string; tone: 'classification' | 'status' | 'source' }) {
  return <span className={`semantic-chip ${tone}`}>{label}</span>;
}

function detailToForm(contact: ContactDetail): ContactFormState {
  return {
    display_name: contact.display_name,
    family_school_classification: contact.family_school_classification,
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    location: contact.location,
    timezone: contact.timezone,
    lead_status: contact.lead_status,
    assigned_user_key: '',
    internal_note: contact.internal_note,
    version: contact.version,
  };
}

function shellUserFromSession(user: SessionUser): ShellUser {
  return {
    displayName: user.display_name,
    email: user.email,
    roleLabel: roleLabel(user),
  };
}

function roleLabel(user: SessionUser) {
  if (user.role === 'admin') return 'Admin';
  return user.role_label;
}

function labelFor(key: string) {
  return key === 'lead_status'
    ? 'Status'
    : key === 'classification'
      ? 'Type'
      : key === 'search'
        ? 'Search'
        : 'Sort';
}

function displayFilterValue(key: string, value: string) {
  if (key === 'lead_status') return labelStatus(value);
  if (key === 'classification') return capitalize(value);
  if (key === 'sort')
    return value === 'created_desc' ? 'Newest' : value === 'name_asc' ? 'Name' : value;
  return value;
}

function labelStatus(value: string) {
  return readableState(value);
}

function sourceLabel(value: string) {
  return readableState(value || 'unknown');
}

function ownerSurfaceFromPath(pathname: string): OwnerSurface | null {
  if (pathname === '/app/today' || pathname.startsWith('/app/today/')) return 'dashboard';
  if (pathname === '/app/learning' || pathname.startsWith('/app/learning/')) return 'classes';
  if (pathname === '/app/people' || pathname.startsWith('/app/people/')) return 'crm';
  if (pathname === '/app/dashboard' || pathname.startsWith('/app/dashboard/')) return 'dashboard';
  if (pathname === '/app/search') return 'search';
  if (pathname === '/app/operations') return 'operations';
  if (pathname === '/app/account' || pathname.startsWith('/app/account/')) return 'account';
  if (pathname === '/app/classes' || pathname.startsWith('/app/classes/')) return 'classes';
  if (pathname === '/app/content' || pathname.startsWith('/app/content/')) return 'content';
  if (pathname === '/app/billing') return 'billing';
  if (pathname === '/app/rewards') return 'classes';
  if (pathname === '/app/support' || pathname.startsWith('/app/support/receipts/')) {
    return 'support';
  }
  if (pathname === '/app/tickets' || pathname.startsWith('/app/tickets/')) return 'support';
  if (pathname === '/app/crm' || pathname.startsWith('/app/crm/')) return 'crm';
  return null;
}

function ownerSurfacePath(surface: Exclude<OwnerSurface, 'crm'>) {
  if (surface === 'support') return '/app/support';
  return `/app/${surface}`;
}

function ownerSurfaceTitle(surface: OwnerSurface) {
  if (surface === 'dashboard') return 'Today';
  if (surface === 'search') return 'Global search';
  if (surface === 'operations') return 'Operations';
  if (surface === 'classes') return 'Classroom';
  if (surface === 'content') return 'Content';
  if (surface === 'billing') return 'Household Access';
  if (surface === 'support') return 'Support';
  if (surface === 'account') return 'Account';
  return 'Contacts';
}

function ownerSurfaceDescription(surface: OwnerSurface) {
  if (surface === 'dashboard') {
    return 'One canonical Sunday–Thursday class at 7:00 PM Asia/Jerusalem.';
  }
  if (surface === 'search') {
    return 'Search authorized operational records without placing private terms in the URL.';
  }
  if (surface === 'operations') {
    return 'Account security, audit history, provider status, and application operations.';
  }
  if (surface === 'classes')
    return 'One occurrence at a time across schedule, questions, and rewards.';
  if (surface === 'content') {
    return 'Library, factory, studio, knowledge, and prompt workspaces.';
  }
  if (surface === 'billing') {
    return 'Current household learning access; payment history remains in GHL.';
  }
  if (surface === 'support') return 'Subscriber-only technical support inside the One Time shell.';
  if (surface === 'account')
    return 'Profile, secure sign-in, and privacy information for this account.';
  return 'Parent and adult contact review.';
}

function accountSectionFromPath(pathname: string): 'profile' | 'security' | 'privacy' {
  if (pathname === '/app/account/security') return 'security';
  if (pathname === '/app/account/privacy') return 'privacy';
  return 'profile';
}

function productStateLabel(value: string) {
  if (value === 'ready') return 'Ready';
  if (value === 'processing') return 'Processing';
  if (value === 'action_needed') return 'Action needed';
  if (value === 'not_connected') return 'Not connected';
  if (value === 'no_data_yet') return 'No data yet';
  if (value === 'temporarily_unavailable') return 'Temporarily unavailable';
  return readableState(value);
}

function productStateClass(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function readableState(value: string) {
  return value.replaceAll('_', ' ').replace(/^\w/, (letter) => letter.toUpperCase());
}

function deliveryLabel(value: string) {
  if (value === 'queued') return 'Queued for support desk';
  if (value === 'delivery_delayed') return 'Delivery delayed';
  if (value === 'delivered') return 'Accepted by support desk';
  if (value === 'dead_letter') return 'Needs admin review';
  return readableState(value);
}

function capitalize(value: string) {
  return value.replace(/^\w/, (letter) => letter.toUpperCase());
}

function contactMethod(contact: ContactListItem) {
  if (contact.email && contact.phone) return `${contact.email} / ${contact.phone}`;
  return contact.email ?? contact.phone ?? 'No contact method';
}

function contactSummary(contact: ContactDetail) {
  return `${capitalize(contact.family_school_classification)} contact, ${labelStatus(
    contact.lead_status,
  )}, last activity ${formatDate(contact.last_activity_at)}.`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

function formatOptionalDate(value: string | null) {
  return value ? formatDate(value) : 'Not set';
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function cssEscape(value: string) {
  if ('CSS' in window && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/["\\]/g, '\\$&');
}

function listCacheKey(query: QueryState) {
  return JSON.stringify({
    search: query.search.trim(),
    classification: query.classification,
    lead_status: query.lead_status,
    sort: query.sort,
  });
}

function markUsableAfterPaint(markName: string, isReady: () => boolean) {
  let cancelled = false;
  const firstFrame = window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (!cancelled && isReady()) performance.mark(markName);
    });
  });
  return () => {
    cancelled = true;
    window.cancelAnimationFrame(firstFrame);
  };
}

function isListUsable() {
  const section = document.querySelector<HTMLElement>('[data-usable="crm-list"]');
  if (!section || section.getAttribute('aria-busy') === 'true' || !isVisible(section)) return false;
  const apply = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent?.trim() === 'Apply',
  );
  if (!apply || apply.disabled || !isVisible(apply)) return false;
  const contactAction = [...document.querySelectorAll<HTMLElement>('[data-contact-open]')].find(
    isVisible,
  );
  const statePanel = document.querySelector<HTMLElement>('.state-panel');
  return Boolean(contactAction || (statePanel && isVisible(statePanel)));
}

function isDetailUsable(displayName: string) {
  const section = document.querySelector<HTMLElement>('[data-usable="crm-detail"]');
  if (!section || section.getAttribute('aria-busy') === 'true' || !isVisible(section)) return false;
  const heading = document.getElementById('page-title');
  const backButton = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent?.trim() === 'Back to CRM',
  );
  return Boolean(
    heading?.textContent?.includes(displayName) &&
    isVisible(heading) &&
    backButton &&
    !backButton.disabled &&
    isVisible(backButton),
  );
}

function isVisible(element: Element) {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return (
    rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
  );
}

function contactIntentFingerprint(form: ContactFormState) {
  return JSON.stringify({
    display_name: form.display_name.trim(),
    family_school_classification: form.family_school_classification,
    email: form.email.trim(),
    phone: form.phone.trim(),
    location: form.location.trim(),
    timezone: form.timezone.trim(),
    lead_status: form.lead_status,
    assigned_user_key: form.assigned_user_key.trim(),
    internal_note: form.internal_note.trim(),
  });
}

function focusVisibleContactControl(contactId: string) {
  const selector = `[data-contact-open="${cssEscape(contactId)}"]`;
  let attempts = 0;
  const focusAfterRender = () => {
    const target = [...document.querySelectorAll<HTMLElement>(selector)].find((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none';
    });
    if (target) {
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      target.focus({ preventScroll: true });
      if (document.activeElement === target) return;
    }
    attempts += 1;
    if (attempts < 10) window.setTimeout(focusAfterRender, 50);
  };
  window.requestAnimationFrame(() => window.requestAnimationFrame(focusAfterRender));
}

const root = document.getElementById('crm-root');
if (root) {
  createRoot(root).render(<CrmApp />);
}
