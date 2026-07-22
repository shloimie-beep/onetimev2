import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  AdminGamificationDashboardResponse,
  ClassOccurrenceDetail,
  ClassOccurrenceSummary,
  ContactDetail,
  ContactListItem,
  OwnerDashboardResponse,
  SessionUser,
} from '@onetime/contracts';
import {
  communicationsRouteDescriptor,
  contactCommunicationsTabDescriptor,
} from './communications/route-descriptor.js';
import { AppShell, type ShellNavItem, type ShellUser } from './shell/AppShell.js';
import { GamificationAdminPanel } from './gamification-admin/GamificationAdminPanel.js';
import { SupportFeature } from './support/SupportFeature.js';
import {
  AuthExpiredError,
  appendNote,
  archiveContactRequest,
  assignTag,
  confirmReply,
  createTag,
  createIdempotencyKey,
  getAssignees,
  getClassDetail,
  getClasses,
  getContact,
  getGamificationAdminDashboard,
  getOwnerDashboard,
  getSession,
  listContacts,
  logoutSession,
  previewReply,
  resolveCrmCapabilities,
  saveContactRequest,
  type Assignee,
  type ApiSession,
  type QueryState,
} from './crm-api.js';
import './crm.css';

const CommunicationsPanel = React.lazy(() =>
  communicationsRouteDescriptor.load().then((module) => ({
    default: module.CommunicationsFeature,
  })),
);

const ContentWorkspace = React.lazy(() =>
  import('./content-workspace/ContentWorkspace.js').then((module) => ({
    default: module.ContentWorkspace,
  })),
);

const ExperiencePreview = React.lazy(() =>
  import('./experience-preview/ExperiencePreview.js').then((module) => ({
    default: module.ExperiencePreview,
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

type CommunicationsMode = { kind: 'global' } | { kind: 'contact'; contactId: string };
type OwnerSurface =
  | 'dashboard'
  | 'crm'
  | 'classes'
  | 'content'
  | 'billing'
  | 'rewards'
  | 'support'
  | 'experience-preview';
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
  const [detailLoading, setDetailLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [selected, setSelected] = useState<ContactDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [surface, setSurface] = useState<OwnerSurface>('crm');
  const [communicationsMode, setCommunicationsMode] = useState<CommunicationsMode | null>(null);
  const [supportReceiptId, setSupportReceiptId] = useState<string | null>(null);
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
  const [contentRoutePath, setContentRoutePath] = useState(
    location.pathname.startsWith('/app/content') ? location.pathname : '/app/content',
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
  const canReadCommunications = session?.user.role === 'owner' || session?.user.role === 'admin';
  const canReadOwnerShell = canReadCommunications;
  const canReadCrm =
    session?.user.role === 'owner' ||
    session?.user.role === 'admin' ||
    session?.user.role === 'crm_agent' ||
    session?.user.role === 'viewer';

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
      setSession(json);
      if (['owner', 'admin'].includes(json.user.role)) {
        const assigneeJson = await getAssignees();
        setAssignees(assigneeJson.assignees);
      }
      setSessionExpired(false);
    } catch (error) {
      if (error instanceof AuthExpiredError) {
        clearProtectedState();
        return;
      }
      clearProtectedState();
    }
  }

  async function routeFromLocation() {
    if (sessionExpired) return;
    const supportReceiptMatch = location.pathname.match(/^\/app\/support\/receipts\/([^/]+)$/);
    if (location.pathname === '/app/support' || supportReceiptMatch?.[1]) {
      setSurface('support');
      setSupportReceiptId(
        supportReceiptMatch?.[1] ? decodeURIComponent(supportReceiptMatch[1]) : null,
      );
      setCommunicationsMode(null);
      setSelected(null);
      setEditing(false);
      setCreating(false);
      setListLoading(false);
      return;
    }
    const ownerSurface = ownerSurfaceFromPath(location.pathname);
    if (ownerSurface && ownerSurface !== 'crm') {
      const classDetailMatch = location.pathname.match(/^\/app\/classes\/([^/]+)$/);
      setSurface(ownerSurface);
      setCommunicationsMode(null);
      setSupportReceiptId(null);
      setSelected(null);
      setEditing(false);
      setCreating(false);
      setListLoading(false);
      if (ownerSurface === 'dashboard' || ownerSurface === 'billing') await loadDashboard();
      if (ownerSurface === 'classes') {
        await loadClasses();
        if (classDetailMatch?.[1]) {
          await loadClassDetail(decodeURIComponent(classDetailMatch[1]));
        } else {
          setSelectedClass(null);
          setClassDetailState({ loading: false, error: '' });
        }
      } else {
        setSelectedClass(null);
        setClassDetailState({ loading: false, error: '' });
      }
      if (ownerSurface === 'content') setContentRoutePath(location.pathname);
      if (ownerSurface === 'rewards') await loadGamificationDashboard();
      return;
    }
    if (location.pathname === communicationsRouteDescriptor.path) {
      setSurface('crm');
      setCommunicationsMode({ kind: 'global' });
      setSelected(null);
      setEditing(false);
      setCreating(false);
      setListLoading(false);
      return;
    }
    const contactCommunicationsMatch = location.pathname.match(
      /^\/app\/crm\/contacts\/([^/]+)\/communications$/,
    );
    if (contactCommunicationsMatch?.[1]) {
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
    setSurface('crm');
    setCommunicationsMode(null);
    setSupportReceiptId(null);
    const match = location.pathname.match(/^\/app\/crm\/contacts\/([^/]+)$/);
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

  async function loadClasses() {
    setClassesState({ loading: true, error: '' });
    try {
      const json = await getClasses();
      setClasses(json.occurrences);
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
      if (handleAuthError(error)) return;
      setSelectedClass(null);
      setClassDetailState({
        loading: false,
        error: errorMessage(error, 'Class details could not load.'),
      });
      return;
    }
    setClassDetailState({ loading: false, error: '' });
  }

  function openContact(contactId: string) {
    returnFocusContactId.current = contactId;
    history.pushState({}, '', `/app/crm/contacts/${encodeURIComponent(contactId)}`);
    setCreating(false);
    setEditing(false);
    void loadContact(contactId);
  }

  async function backToList() {
    history.pushState({}, '', '/app/crm');
    setSurface('crm');
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
    setSelected(null);
    setEditing(false);
    setCreating(true);
    setCommunicationsMode(null);
    setSupportReceiptId(null);
    history.pushState({}, '', '/app/crm');
  }

  function openGlobalCommunications() {
    history.pushState({}, '', communicationsRouteDescriptor.path);
    setSurface('crm');
    setCommunicationsMode({ kind: 'global' });
    setSupportReceiptId(null);
    setSelected(null);
    setEditing(false);
    setCreating(false);
    setListLoading(false);
  }

  function openContactCommunications(contactId: string) {
    history.pushState(
      {},
      '',
      `/app/crm/contacts/${encodeURIComponent(contactId)}/${contactCommunicationsTabDescriptor.id}`,
    );
    setSurface('crm');
    setCommunicationsMode({ kind: 'contact', contactId });
    setSupportReceiptId(null);
    setSelected(null);
    setEditing(false);
    setCreating(false);
    setListLoading(false);
  }

  function openOwnerSurface(
    nextSurface: Exclude<OwnerSurface, 'crm'>,
    href = ownerSurfacePath(nextSurface),
  ) {
    const classDetailMatch = href.match(/^\/app\/classes\/([^/]+)$/);
    history.pushState({}, '', href);
    setSurface(nextSurface);
    setCommunicationsMode(null);
    setSupportReceiptId(null);
    setSelected(null);
    setEditing(false);
    setCreating(false);
    setListLoading(false);
    if (nextSurface === 'dashboard' || nextSurface === 'billing') void loadDashboard();
    if (nextSurface === 'rewards') void loadGamificationDashboard();
    if (nextSurface === 'classes') {
      void loadClasses();
      if (classDetailMatch?.[1]) void loadClassDetail(decodeURIComponent(classDetailMatch[1]));
      else {
        setSelectedClass(null);
        setClassDetailState({ loading: false, error: '' });
      }
    } else {
      setSelectedClass(null);
      setClassDetailState({ loading: false, error: '' });
    }
    if (nextSurface === 'content') setContentRoutePath(href);
  }

  function openClassDetail(occurrenceKey: string) {
    const href = `/app/classes/${encodeURIComponent(occurrenceKey)}`;
    history.pushState({}, '', href);
    setSurface('classes');
    void loadClassDetail(occurrenceKey);
  }

  function backToClasses() {
    history.pushState({}, '', '/app/classes');
    setSurface('classes');
    setSelectedClass(null);
    setClassDetailState({ loading: false, error: '' });
    void loadClasses();
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

  function clearProtectedState() {
    setContacts([]);
    setNextCursor(null);
    listCache.current = null;
    setAssignees([]);
    setSelected(null);
    setCreating(false);
    setEditing(false);
    setSurface('crm');
    setCommunicationsMode(null);
    setSupportReceiptId(null);
    setDashboard(null);
    setDashboardState({ loading: false, error: '' });
    setClasses([]);
    setClassesState({ loading: false, error: '' });
    setSelectedClass(null);
    setClassDetailState({ loading: false, error: '' });
    setContentRoutePath('/app/content');
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
      location.pathname === communicationsRouteDescriptor.path ||
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

  const navItems: ShellNavItem[] = [
    ...(canReadOwnerShell
      ? [
          {
            id: 'dashboard',
            label: 'Dashboard',
            href: '/app/dashboard',
            current: surface === 'dashboard',
          },
        ]
      : []),
    ...(canReadCrm
      ? [
          {
            id: 'crm',
            label: 'CRM',
            href: '/app/crm',
            current: surface === 'crm' && !communicationsMode,
          },
        ]
      : []),
    ...(canReadOwnerShell
      ? [
          {
            id: 'classes',
            label: 'Classes',
            href: '/app/classes',
            current: surface === 'classes',
          },
          {
            id: 'content',
            label: 'Content',
            href: '/app/content',
            current: surface === 'content',
          },
          {
            id: 'billing',
            label: 'Products/Billing',
            href: '/app/billing',
            current: surface === 'billing',
          },
          {
            id: 'rewards',
            label: 'Rewards',
            href: '/app/rewards',
            current: surface === 'rewards',
          },
          ...(session?.capabilities?.operator_experience?.experience_preview
            ? [
                {
                  id: 'experience-preview',
                  label: 'Experience Preview',
                  href: '/app/experience-preview',
                  current: surface === 'experience-preview',
                },
              ]
            : []),
          ...(session?.capabilities?.operator_experience?.live_console
            ? [
                {
                  id: 'live-console',
                  label: 'Live Console',
                  href: '/app/live-console',
                  current: false,
                },
              ]
            : []),
        ]
      : []),
    ...(canReadCommunications
      ? [
          {
            id: communicationsRouteDescriptor.id,
            label: communicationsRouteDescriptor.label,
            href: communicationsRouteDescriptor.path,
            current: communicationsMode?.kind === 'global',
          },
        ]
      : []),
    ...(session
      ? [
          {
            id: 'support',
            label: 'Support',
            href: '/app/support',
            current: surface === 'support',
          },
        ]
      : []),
  ];
  const shellUser = session ? shellUserFromSession(session.user) : null;
  const pageTitle =
    surface !== 'crm'
      ? ownerSurfaceTitle(surface)
      : communicationsMode
        ? 'Communications'
        : creating
          ? 'Add contact'
          : editing
            ? 'Edit contact'
            : selected
              ? selected.display_name
              : 'CRM';
  const pageDescription =
    surface !== 'crm'
      ? ownerSurfaceDescription(surface)
      : communicationsMode
        ? communicationsMode.kind === 'contact'
          ? 'Communication history and draft activity for this contact.'
          : 'One Time communication activity and draft follow-up status.'
        : creating
          ? 'Create a One Time contact without sending messages or granting access.'
          : editing
            ? 'Update CRM fields backed by the One Time contact API.'
            : selected
              ? contactSummary(selected)
              : 'One Time signup and contact review.';
  const toolbar =
    surface === 'dashboard' ? (
      <ReadOnlyToolbar
        label="Refresh dashboard"
        actionId="dashboard.refresh.button"
        loading={dashboardState.loading}
        onRefresh={() => void loadDashboard()}
      />
    ) : surface === 'classes' ? (
      <ReadOnlyToolbar
        label="Refresh classes"
        actionId="classes.refresh.button"
        loading={classesState.loading}
        onRefresh={() => void loadClasses()}
      />
    ) : surface === 'billing' ? (
      <ReadOnlyToolbar
        label="Refresh billing status"
        actionId="billing.status.refresh.button"
        loading={dashboardState.loading}
        onRefresh={() => void loadDashboard()}
      />
    ) : surface === 'rewards' ? (
      <ReadOnlyToolbar
        label="Refresh rewards"
        actionId="rewards.refresh.button"
        loading={gamificationState.loading}
        onRefresh={() => void loadGamificationDashboard()}
      />
    ) : surface === 'support' ||
      surface === 'experience-preview' ? null : communicationsMode?.kind === 'contact' ? (
      <ContactCommunicationsToolbar
        onBack={() => {
          history.pushState(
            {},
            '',
            `/app/crm/contacts/${encodeURIComponent(communicationsMode.contactId)}`,
          );
          setCommunicationsMode(null);
          void loadContact(communicationsMode.contactId);
        }}
      />
    ) : selected ? (
      <DetailToolbar
        contact={selected}
        canEdit={canEdit}
        canReadCommunications={canReadCommunications}
        onBack={backToList}
        onEdit={() => setEditing(true)}
        onCommunications={() => openContactCommunications(selected.contact_id)}
      />
    ) : creating || editing ? (
      <FormToolbar onCancel={() => (editing ? setEditing(false) : setCreating(false))} />
    ) : (
      <ListToolbar
        query={query}
        activeChips={activeChips}
        canEdit={canCreate}
        onChange={setQuery}
        onApply={(nextQuery) => void loadList(undefined, nextQuery)}
        onClear={() => {
          setQuery(defaultQuery);
          void loadList(undefined, defaultQuery);
        }}
        onCreate={startCreate}
      />
    );

  return (
    <AppShell
      user={shellUser}
      navItems={navItems}
      title={pageTitle}
      description={pageDescription}
      toolbar={toolbar}
      notice={notice ? <NoticeBanner notice={notice} /> : undefined}
      onNavigate={(href) => {
        if (href === '/app/live-console') {
          window.location.assign(href);
          return;
        }
        const ownerSurface = ownerSurfaceFromPath(href);
        if (ownerSurface && ownerSurface !== 'crm') openOwnerSurface(ownerSurface, href);
        if (href === '/app/crm') void backToList();
        if (href === communicationsRouteDescriptor.path) openGlobalCommunications();
      }}
      onLogout={() => void logout()}
      sessionExpired={sessionExpired}
      onSignIn={signIn}
    >
      {surface === 'dashboard' && (
        <DashboardPanel
          dashboard={dashboard}
          loading={dashboardState.loading}
          error={dashboardState.error}
          showExperiencePreview={Boolean(
            session?.capabilities?.operator_experience?.experience_preview,
          )}
          onRetry={() => void loadDashboard()}
          onOpen={(href) => {
            const ownerSurface = ownerSurfaceFromPath(href);
            if (ownerSurface && ownerSurface !== 'crm') openOwnerSurface(ownerSurface, href);
            if (href === '/app/crm') void backToList();
            if (href === communicationsRouteDescriptor.path) openGlobalCommunications();
          }}
        />
      )}
      {surface === 'classes' && (
        <ClassesPanel
          classes={classes}
          selectedClass={selectedClass}
          loading={classesState.loading}
          error={classesState.error}
          detailLoading={classDetailState.loading}
          detailError={classDetailState.error}
          onOpen={openClassDetail}
          onBack={backToClasses}
          onRetry={() => void loadClasses()}
          onRetryDetail={(occurrenceKey) => void loadClassDetail(occurrenceKey)}
        />
      )}
      {surface === 'content' && (
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
      )}
      {surface === 'billing' && (
        <BillingPanel
          dashboard={dashboard}
          loading={dashboardState.loading}
          error={dashboardState.error}
          onRetry={() => void loadDashboard()}
        />
      )}
      {surface === 'rewards' && (
        <GamificationAdminPanel
          dashboard={gamificationDashboard}
          loading={gamificationState.loading}
          error={gamificationState.error}
          onRetry={() => void loadGamificationDashboard()}
        />
      )}
      {surface === 'experience-preview' && (
        <Suspense
          fallback={
            <p className="state-panel" role="status">
              Loading Experience Preview...
            </p>
          }
        >
          <ExperiencePreview
            csrfToken={session?.csrf_token ?? ''}
            onProtectedStateCleared={clearProtectedState}
          />
        </Suspense>
      )}
      {surface === 'support' && (
        <SupportFeature
          receiptId={supportReceiptId ?? undefined}
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
          <CommunicationsPanel
            contactId={
              communicationsMode.kind === 'contact' ? communicationsMode.contactId : undefined
            }
            onProtectedStateCleared={clearProtectedState}
          />
        </Suspense>
      )}
      {surface === 'crm' && !communicationsMode && creating && (
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
        !communicationsMode &&
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
          />
        ))}
      {surface === 'crm' && !communicationsMode && !creating && !selected && !editing && (
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
        !communicationsMode &&
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

function DashboardPanel({
  dashboard,
  loading,
  error,
  showExperiencePreview,
  onRetry,
  onOpen,
}: {
  dashboard: OwnerDashboardResponse | null;
  loading: boolean;
  error: string;
  showExperiencePreview: boolean;
  onRetry: () => void;
  onOpen: (href: string) => void;
}) {
  if (loading && !dashboard) return <ReadOnlySkeleton label="Loading dashboard" />;
  if (error) {
    return (
      <StatePanel
        kind="error"
        title="Dashboard could not load"
        body={error}
        actionLabel="Retry"
        onAction={onRetry}
      />
    );
  }
  if (!dashboard) {
    return (
      <StatePanel
        kind="empty"
        title="Dashboard unavailable"
        body="The owner dashboard source did not return data."
        actionLabel="Retry"
        onAction={onRetry}
      />
    );
  }
  const actionIds = new Set(dashboard.actions.map((action) => action.action_id));
  const visibleSections = dashboard.dashboard.sections.filter(
    (section) =>
      !(
        section.id === 'support' &&
        section.state === 'no_data_yet' &&
        /not mounted|not available/i.test(section.detail)
      ),
  );
  return (
    <section className="dashboard-surface" data-usable="owner-dashboard" aria-busy={loading}>
      <div className="dashboard-grid">
        {showExperiencePreview && (
          <article className="dashboard-card experience-preview-dashboard-card state-ready">
            <header>
              <h2>Preview Parent &amp; Student portals</h2>
              <Chip label="Staging only" tone="status" />
            </header>
            <strong>Walk through the fictional Cohen household</strong>
            <p>
              Choose Parent, each sibling, or Rabbi/Classroom in a read-only preview. Fictional
              Student sessions open separately and never replace this Administrator session.
            </p>
            <button
              type="button"
              className="button-primary"
              data-action-id="dashboard.open_experience_preview.button"
              onClick={() => onOpen('/app/experience-preview')}
            >
              Open portal preview
            </button>
          </article>
        )}
        {visibleSections.map((section) => {
          const href = section.href;
          const actionId = dashboardOpenActionId(href);
          return (
            <article key={section.id} className={`dashboard-card state-${section.state}`}>
              <header>
                <h2>{section.label}</h2>
                <Chip label={productStateLabel(section.state)} tone="status" />
              </header>
              <strong>{section.value_label}</strong>
              <p>{section.detail}</p>
              {section.trend_label && <p>{section.trend_label}</p>}
              {section.next_action && <small>Next: {section.next_action}</small>}
              {section.updated_at && <small>Last updated {formatDate(section.updated_at)}</small>}
              {href && actionId && actionIds.has(actionId) && (
                <button
                  type="button"
                  className="button-secondary"
                  data-action-id={actionId}
                  onClick={() => onOpen(href)}
                >
                  {dashboardOpenLabel(href)}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ClassesPanel({
  classes,
  selectedClass,
  loading,
  error,
  detailLoading,
  detailError,
  onOpen,
  onBack,
  onRetry,
  onRetryDetail,
}: {
  classes: ClassOccurrenceSummary[];
  selectedClass: ClassOccurrenceDetail | null;
  loading: boolean;
  error: string;
  detailLoading: boolean;
  detailError: string;
  onOpen: (occurrenceKey: string) => void;
  onBack: () => void;
  onRetry: () => void;
  onRetryDetail: (occurrenceKey: string) => void;
}) {
  if (loading && classes.length === 0) return <ReadOnlySkeleton label="Loading classes" />;
  if (error) {
    return (
      <StatePanel
        kind="error"
        title="Classes could not load"
        body={error}
        actionLabel="Retry"
        onAction={onRetry}
      />
    );
  }
  if (detailLoading && !selectedClass) return <ReadOnlySkeleton label="Loading class details" />;
  if (detailError && !selectedClass) {
    return (
      <StatePanel
        kind="error"
        title="Class details could not load"
        body={detailError}
        actionLabel="Back to classes"
        onAction={onBack}
      />
    );
  }
  if (selectedClass) {
    return (
      <section className="class-detail" aria-busy={loading || detailLoading}>
        <button
          type="button"
          className="button-secondary"
          data-action-id="classes.back_to_list.button"
          onClick={onBack}
        >
          Back to classes
        </button>
        {detailError && (
          <p className="notice-banner error" role="alert">
            {detailError}
          </p>
        )}
        <article
          className={`readonly-row state-${productStateClass(selectedClass.product_state.label)}`}
        >
          <div>
            <h2>{selectedClass.title}</h2>
            <p>{formatDate(selectedClass.starts_at)}</p>
            <div className="chip-row">
              <Chip label={selectedClass.product_state.label} tone="status" />
              <Chip label={readableState(selectedClass.status)} tone="source" />
            </div>
            <p>{selectedClass.product_state.explanation}</p>
          </div>
          <dl>
            <div>
              <dt>Next action</dt>
              <dd>{selectedClass.next_action ?? 'No owner action needed right now'}</dd>
            </div>
            <div>
              <dt>Protected access</dt>
              <dd>{selectedClass.protected_access_state.label}</dd>
            </div>
            <div>
              <dt>Classroom link</dt>
              <dd>
                {selectedClass.readiness.raw_provider_target_present
                  ? 'Protected link available'
                  : 'Not connected yet'}
              </dd>
            </div>
          </dl>
        </article>
        <div className="class-detail-grid">
          <ClassMetricGroup
            title="Enrollment"
            rows={[
              ['Households', selectedClass.enrollment_counts.households],
              ['Learners', selectedClass.enrollment_counts.learners],
            ]}
          />
          <ClassMetricGroup
            title="Attendance"
            rows={[
              ['Manual marks', selectedClass.attendance_summary.manual_marks],
              ['Classroom launches', selectedClass.attendance_summary.launch_attempts],
              ['Joined sessions', selectedClass.attendance_summary.joined_attempts],
            ]}
          />
          <ClassMetricGroup
            title="Content"
            rows={[
              ['Recordings', selectedClass.content_summary.videos],
              ['Review sheets', selectedClass.content_summary.review_sheets],
              ['Processing', selectedClass.content_summary.processing],
              ['Needs review', selectedClass.content_summary.needs_review],
            ]}
          />
          <ClassMetricGroup
            title="Questions"
            rows={[
              ['New questions', selectedClass.question_summary.new_questions],
              ['Featured', selectedClass.question_summary.featured_questions],
              ['Answered', selectedClass.question_summary.answered_questions],
            ]}
          />
          <ClassMetricGroup
            title="Reminder progress"
            rows={[
              ['Queued', selectedClass.fulfillment_counts.queued],
              ['Satisfied', selectedClass.fulfillment_counts.satisfied],
              ['Suppressed', selectedClass.fulfillment_counts.suppressed],
              ['Skipped', selectedClass.fulfillment_counts.skipped],
              ['Access not connected', selectedClass.fulfillment_counts.provider_unavailable],
            ]}
          />
          <article className="readonly-row">
            <div>
              <h2>Protected classroom</h2>
              <p>{selectedClass.readiness.reason}</p>
            </div>
            <dl>
              <div>
                <dt>Access state</dt>
                <dd>{selectedClass.protected_access_state.explanation}</dd>
              </div>
              <div>
                <dt>Launch requirement</dt>
                <dd>Protected access required</dd>
              </div>
              <div>
                <dt>Classroom target</dt>
                <dd>No classroom link is shown until access is connected.</dd>
              </div>
            </dl>
          </article>
        </div>
        <button
          type="button"
          className="button-secondary"
          data-action-id="classes.open_detail.button"
          disabled={detailLoading}
          onClick={() => onRetryDetail(selectedClass.occurrence_key)}
        >
          {detailLoading ? 'Refreshing...' : 'Refresh class details'}
        </button>
      </section>
    );
  }
  if (classes.length === 0) {
    return (
      <StatePanel
        kind="empty"
        title="No classes yet"
        body="No class schedule has been recorded yet."
      />
    );
  }
  return (
    <section className="readonly-list" aria-busy={loading}>
      {classes.map((classItem) => (
        <article
          className={`readonly-row state-${productStateClass(classItem.product_state.label)}`}
          key={classItem.occurrence_key}
        >
          <div>
            <h2>{classItem.title}</h2>
            <p>{formatDate(classItem.starts_at)}</p>
            <div className="chip-row">
              <Chip label={classItem.product_state.label} tone="status" />
              <Chip label={readableState(classItem.status)} tone="source" />
            </div>
            <p>{classItem.product_state.explanation}</p>
          </div>
          <dl>
            <div>
              <dt>Class state</dt>
              <dd>{readableState(classItem.status)}</dd>
            </div>
            <div>
              <dt>Protected access</dt>
              <dd>{classItem.protected_access_state.label}</dd>
            </div>
            <div>
              <dt>Next action</dt>
              <dd>{classItem.next_action ?? 'No owner action needed right now'}</dd>
            </div>
          </dl>
          <button
            type="button"
            className="button-secondary"
            data-action-id="classes.open_detail.button"
            onClick={() => onOpen(classItem.occurrence_key)}
          >
            Open class details
          </button>
        </article>
      ))}
    </section>
  );
}

function ClassMetricGroup({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  return (
    <article className="readonly-row">
      <div>
        <h2>{title}</h2>
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
  if (loading && !dashboard) return <ReadOnlySkeleton label="Loading billing status" />;
  if (error) {
    return (
      <StatePanel
        kind="error"
        title="Billing status could not load"
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
        title="Billing status unavailable"
        body="Billing readiness did not return a dashboard section."
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
            <dt>Live payments</dt>
            <dd>Off unless explicitly approved</dd>
          </div>
        </dl>
      </article>
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
  onChange,
  onApply,
  onClear,
  onCreate,
}: {
  query: QueryState;
  activeChips: { key: string; label: string }[];
  canEdit: boolean;
  onChange: (query: QueryState) => void;
  onApply: (query: QueryState) => void;
  onClear: () => void;
  onCreate: () => void;
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
      {canEdit && (
        <button type="button" className="button-primary toolbar-primary" onClick={onCreate}>
          Add contact
        </button>
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
}: {
  contact: ContactDetail;
  canEdit: boolean;
  canReadCommunications: boolean;
  onBack: () => void;
  onEdit: () => void;
  onCommunications: () => void;
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
      {canEdit && (
        <button type="button" className="button-primary" onClick={onEdit}>
          Edit contact
        </button>
      )}
    </div>
  );
}

function ContactCommunicationsToolbar({ onBack }: { onBack: () => void }) {
  return (
    <div className="detail-toolbar">
      <button type="button" className="button-secondary" onClick={onBack}>
        Back to contact
      </button>
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
}) {
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
              title="Enrollment / subscription"
              empty="No enrollment summary available."
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

          {canEdit && (
            <button
              type="button"
              className="button-secondary"
              onClick={async () => {
                await archiveContactRequest(
                  csrfToken,
                  contact.contact_id,
                  'Archived from CRM detail',
                );
                onArchived();
              }}
            >
              Archive contact
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
  if (user.role === 'owner') return 'Owner';
  if (user.role === 'admin') return 'Administrator';
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
  if (pathname === '/app/dashboard') return 'dashboard';
  if (pathname === '/app/classes' || pathname.startsWith('/app/classes/')) return 'classes';
  if (pathname === '/app/content' || pathname.startsWith('/app/content/')) return 'content';
  if (pathname === '/app/billing') return 'billing';
  if (pathname === '/app/rewards') return 'rewards';
  if (pathname === '/app/experience-preview' || pathname.startsWith('/app/experience-preview/')) {
    return 'experience-preview';
  }
  if (pathname === '/app/support' || pathname.startsWith('/app/support/receipts/')) {
    return 'support';
  }
  if (pathname === '/app/crm') return 'crm';
  return null;
}

function ownerSurfacePath(surface: Exclude<OwnerSurface, 'crm'>) {
  if (surface === 'support') return '/app/support';
  return `/app/${surface}`;
}

function ownerSurfaceTitle(surface: OwnerSurface) {
  if (surface === 'dashboard') return 'Dashboard';
  if (surface === 'classes') return 'Classes';
  if (surface === 'content') return 'Content Workspace';
  if (surface === 'billing') return 'Products/Billing status';
  if (surface === 'rewards') return 'Learning Rewards';
  if (surface === 'experience-preview') return 'Experience Preview';
  if (surface === 'support') return 'Support';
  return 'CRM';
}

function ownerSurfaceDescription(surface: OwnerSurface) {
  if (surface === 'dashboard') {
    return 'Workspace snapshot for leads, classes, communications, content, members, support, and billing.';
  }
  if (surface === 'classes')
    return 'Class schedule, access, content, questions, and learner readiness.';
  if (surface === 'content') {
    return 'Rabbi and One Time content review, prompts, artifacts, social drafts, and provider-off status.';
  }
  if (surface === 'billing') return 'Billing setup and access projection status.';
  if (surface === 'rewards') {
    return 'Private learner progress, rewards, guardrails, and correction audit.';
  }
  if (surface === 'experience-preview') {
    return 'Read-only fictional Parent, Student, and Rabbi journeys for the isolated staging runtime.';
  }
  if (surface === 'support') return 'Subscriber-only technical support inside the One Time shell.';
  return 'One Time signup and contact review.';
}

function dashboardOpenActionId(href: string | null) {
  if (href === '/app/crm') return 'dashboard.open_crm.button';
  if (href === '/app/classes') return 'dashboard.open_classes.button';
  if (href === communicationsRouteDescriptor.path) return 'dashboard.open_communications.button';
  if (href === '/app/content') return 'dashboard.open_content.button';
  if (href === '/app/billing') return 'dashboard.open_billing.button';
  if (href === '/app/rewards') return 'dashboard.open_rewards.button';
  return null;
}

function dashboardOpenLabel(href: string) {
  if (href === '/app/crm') return 'Review leads';
  if (href === '/app/classes') return 'Open classroom';
  if (href === communicationsRouteDescriptor.path) return 'Review communications';
  if (href === '/app/content') return 'Configure content';
  if (href === '/app/billing') return 'Open billing';
  if (href === '/app/rewards') return 'Review rewards';
  return 'Open';
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
