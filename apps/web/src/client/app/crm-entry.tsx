import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ContactDetail, ContactListItem, SessionUser } from '@onetime/contracts';
import {
  communicationsRouteDescriptor,
  contactCommunicationsTabDescriptor,
} from './communications/route-descriptor.js';
import { AppShell, type ShellNavItem, type ShellUser } from './shell/AppShell.js';
import {
  AuthExpiredError,
  createIdempotencyKey,
  getAssignees,
  getContact,
  getSession,
  listContacts,
  logoutSession,
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
  const [communicationsMode, setCommunicationsMode] = useState<CommunicationsMode | null>(null);
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
    if (location.pathname === communicationsRouteDescriptor.path) {
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
    setCommunicationsMode(null);
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

  function openContact(contactId: string) {
    returnFocusContactId.current = contactId;
    history.pushState({}, '', `/app/crm/contacts/${encodeURIComponent(contactId)}`);
    setCreating(false);
    setEditing(false);
    void loadContact(contactId);
  }

  async function backToList() {
    history.pushState({}, '', '/app/crm');
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
    setSelected(null);
    setEditing(false);
    setCreating(true);
    setCommunicationsMode(null);
    history.pushState({}, '', '/app/crm');
  }

  function openGlobalCommunications() {
    history.pushState({}, '', communicationsRouteDescriptor.path);
    setCommunicationsMode({ kind: 'global' });
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
    setCommunicationsMode({ kind: 'contact', contactId });
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

  function clearProtectedState() {
    setContacts([]);
    setNextCursor(null);
    listCache.current = null;
    setAssignees([]);
    setSelected(null);
    setCreating(false);
    setEditing(false);
    setCommunicationsMode(null);
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
      location.pathname === communicationsRouteDescriptor.path
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
    { id: 'crm', label: 'CRM', href: '/app/crm', current: !communicationsMode },
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
  ];
  const shellUser = session ? shellUserFromSession(session.user) : null;
  const pageTitle = communicationsMode
    ? 'Communications'
    : creating
      ? 'Add contact'
      : editing
        ? 'Edit contact'
        : selected
          ? selected.display_name
          : 'CRM';
  const pageDescription = communicationsMode
    ? communicationsMode.kind === 'contact'
      ? 'Read-only local communication intents for this contact.'
      : 'Read-only local communication intents from the One Time outbox.'
    : creating
      ? 'Create a One Time contact without sending messages or granting access.'
      : editing
        ? 'Update CRM fields backed by the One Time contact API.'
        : selected
          ? contactSummary(selected)
          : 'One Time signup and contact review.';
  const toolbar =
    communicationsMode?.kind === 'contact' ? (
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
        if (href === '/app/crm') void backToList();
        if (href === communicationsRouteDescriptor.path) openGlobalCommunications();
      }}
      onLogout={() => void logout()}
      sessionExpired={sessionExpired}
      onSignIn={signIn}
    >
      {communicationsMode && (
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
      {!communicationsMode && creating && (
        <ContactForm
          title="Add contact"
          initial={emptyForm}
          canAssign={canAssign}
          assignees={assignees}
          onCancel={() => setCreating(false)}
          onSave={(form, idempotencyKey) => saveContact(form, 'create', idempotencyKey)}
        />
      )}
      {!communicationsMode &&
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
            onRetry={() => void loadContact(selected.contact_id)}
          />
        ))}
      {!communicationsMode && !creating && !selected && !editing && (
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
      {!communicationsMode && !creating && !selected && !editing && detailError && (
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
  onRetry,
}: {
  contact: ContactDetail;
  loading: boolean;
  error: string;
  onRetry: () => void;
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
          {contact.internal_note && (
            <section className="note-panel">
              <h2>Internal note</h2>
              <p>{contact.internal_note}</p>
            </section>
          )}
        </>
      )}
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

function readableState(value: string) {
  return value.replaceAll('_', ' ').replace(/^\w/, (letter) => letter.toUpperCase());
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
