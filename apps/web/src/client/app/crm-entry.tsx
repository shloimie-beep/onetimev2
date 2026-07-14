import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ContactDetail, ContactListItem, SessionUser } from '@onetime/contracts';
import './crm.css';

type ApiSession = {
  authenticated: true;
  user: SessionUser;
  csrf_token: string;
  expires_at: string;
};

type ListResponse = {
  success: true;
  contacts: ContactListItem[];
  next_cursor: string | null;
  applied_filters: Record<string, string | undefined>;
};

type ContactResponse = {
  success: true;
  contact: ContactDetail;
};

type Assignee = {
  user_key: string;
  display_name: string;
  role_label: string;
};

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

function CrmApp() {
  const [session, setSession] = useState<ApiSession | null>(null);
  const [contacts, setContacts] = useState<ContactListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [query, setQuery] = useState({
    search: '',
    classification: '',
    lead_status: '',
    sort: 'updated_desc',
  });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<ContactDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const canEdit = session ? ['owner', 'admin', 'crm_agent'].includes(session.user.role) : false;

  useEffect(() => {
    void loadSession();
    const onPop = () => void routeFromLocation();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (session) void routeFromLocation();
  }, [session]);

  async function loadSession() {
    try {
      const json = await api<ApiSession>('/api/v1/auth/session');
      setSession(json);
      if (['owner', 'admin'].includes(json.user.role)) {
        const assigneeJson = await api<{ success: true; assignees: Assignee[] }>(
          '/api/v1/crm/assignees',
        );
        setAssignees(assigneeJson.assignees);
      }
    } catch {
      window.location.assign(`/login?return_to=${encodeURIComponent(location.pathname)}`);
    }
  }

  async function routeFromLocation() {
    const match = location.pathname.match(/^\/app\/crm\/contacts\/([^/]+)$/);
    const contactId = match?.[1];
    if (contactId) {
      setCreating(false);
      setEditing(false);
      await loadContact(decodeURIComponent(contactId));
    } else {
      setSelected(null);
      setEditing(false);
      await loadList();
    }
  }

  async function loadList(cursor?: string) {
    setLoading(true);
    setStatus('');
    const body = { ...query, cursor };
    try {
      const response = await fetch('/api/v1/crm/contacts/search', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-csrf-token': session?.csrf_token ?? '',
        },
        body: JSON.stringify(body),
      });
      const json = (await response.json()) as Partial<ListResponse> & {
        success?: boolean;
        message?: string;
      };
      if (!response.ok || json.success !== true) {
        throw new Error(json.message ?? 'Request failed.');
      }
      setContacts((current) =>
        cursor ? [...current, ...(json.contacts ?? [])] : (json.contacts ?? []),
      );
      setNextCursor(json.next_cursor ?? null);
      performance.mark('ot-crm-list-usable');
    } catch (error) {
      setStatus(errorMessage(error, 'CRM contacts could not load.'));
    } finally {
      setLoading(false);
    }
  }

  async function loadContact(contactId: string) {
    setLoading(true);
    setStatus('');
    try {
      const json = await api<ContactResponse>(
        `/api/v1/crm/contacts/${encodeURIComponent(contactId)}`,
      );
      setSelected(json.contact);
      performance.mark('ot-crm-detail-usable');
    } catch (error) {
      setStatus(errorMessage(error, 'Contact could not load.'));
    } finally {
      setLoading(false);
    }
  }

  function openContact(contactId: string) {
    history.pushState({}, '', `/app/crm/contacts/${encodeURIComponent(contactId)}`);
    void loadContact(contactId);
  }

  function backToList() {
    history.pushState({}, '', '/app/crm');
    setSelected(null);
    setEditing(false);
    setCreating(false);
    void loadList();
  }

  async function logout() {
    if (!session) return;
    await fetch('/api/v1/auth/logout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': session.csrf_token },
      body: JSON.stringify({ csrf_token: session.csrf_token }),
    });
    window.location.assign('/login');
  }

  async function saveContact(form: ContactFormState, mode: 'create' | 'edit') {
    if (!session) return;
    setStatus('');
    const payload = {
      ...form,
      idempotency_key: mode === 'create' ? crypto.randomUUID() : undefined,
      assigned_user_key: form.assigned_user_key || undefined,
      internal_note: form.internal_note || '',
    };
    const response = await fetch(
      mode === 'create'
        ? '/api/v1/crm/contacts'
        : `/api/v1/crm/contacts/${encodeURIComponent(selected?.contact_id ?? '')}`,
      {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'content-type': 'application/json', 'x-csrf-token': session.csrf_token },
        body: JSON.stringify(payload),
      },
    );
    const json = await response.json();
    if (!response.ok || !json.success) {
      if (json.code === 'DUPLICATE_CONTACT' && json.existing_contact_path) {
        setStatus('A matching contact already exists.');
        history.pushState({}, '', json.existing_contact_path);
        await routeFromLocation();
        return;
      }
      throw new Error(json.message ?? 'Contact could not be saved.');
    }
    setCreating(false);
    setEditing(false);
    setSelected(json.contact);
    history.pushState({}, '', `/app/crm/contacts/${encodeURIComponent(json.contact.contact_id)}`);
    setStatus('Saved.');
  }

  const activeChips = useMemo(
    () =>
      Object.entries(query)
        .filter(([, value]) => value && value !== 'updated_desc')
        .map(([key, value]) => `${labelFor(key)}: ${value}`),
    [query],
  );

  return (
    <main className="crm-shell">
      <header className="crm-header">
        <a
          className="crm-brand"
          href="/app/crm"
          onClick={(event) => {
            event.preventDefault();
            backToList();
          }}
        >
          <img
            src="/assets/brand/onetimelogo.webp"
            alt=""
            width="40"
            height="40"
            aria-hidden="true"
          />
          <span>
            <strong>One Time</strong>
            <small>{session?.user.role_label ?? 'CRM'}</small>
          </span>
        </a>
        <nav aria-label="One Time app">
          <a
            aria-current="page"
            href="/app/crm"
            onClick={(event) => {
              event.preventDefault();
              backToList();
            }}
          >
            CRM
          </a>
        </nav>
        <button type="button" className="ghost-button" onClick={() => void logout()}>
          Logout
        </button>
      </header>

      {status && (
        <p className="crm-status" role="status">
          {status}
        </p>
      )}
      {creating && (
        <ContactForm
          title="Add contact"
          initial={emptyForm}
          canAssign={session?.user.role === 'owner' || session?.user.role === 'admin'}
          assignees={assignees}
          onCancel={() => setCreating(false)}
          onSave={(form) => saveContact(form, 'create')}
        />
      )}
      {selected ? (
        editing ? (
          <ContactForm
            title="Edit contact"
            initial={detailToForm(selected)}
            canAssign={session?.user.role === 'owner' || session?.user.role === 'admin'}
            assignees={assignees}
            onCancel={() => setEditing(false)}
            onSave={(form) => saveContact(form, 'edit')}
          />
        ) : (
          <ContactOverview
            contact={selected}
            canEdit={canEdit}
            onBack={backToList}
            onEdit={() => setEditing(true)}
          />
        )
      ) : (
        <section className="crm-list" data-usable="crm-list">
          <div className="crm-title-row">
            <div>
              <h1>CRM</h1>
              <p>One Time signup and contact review.</p>
            </div>
            {canEdit && (
              <button type="button" className="button-primary" onClick={() => setCreating(true)}>
                Add contact
              </button>
            )}
          </div>
          <form
            className="filter-bar"
            onSubmit={(event) => {
              event.preventDefault();
              void loadList();
            }}
          >
            <label>
              <span>Search</span>
              <input
                value={query.search}
                onChange={(event) => setQuery({ ...query, search: event.target.value })}
              />
            </label>
            <label>
              <span>Type</span>
              <select
                value={query.classification}
                onChange={(event) => setQuery({ ...query, classification: event.target.value })}
              >
                <option value="">All</option>
                <option value="family">Family</option>
                <option value="school">School</option>
              </select>
            </label>
            <label>
              <span>Status</span>
              <select
                value={query.lead_status}
                onChange={(event) => setQuery({ ...query, lead_status: event.target.value })}
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
            <label>
              <span>Sort</span>
              <select
                value={query.sort}
                onChange={(event) => setQuery({ ...query, sort: event.target.value })}
              >
                <option value="updated_desc">Recently updated</option>
                <option value="created_desc">Newest</option>
                <option value="name_asc">Name</option>
              </select>
            </label>
            <button type="submit" className="button-secondary">
              Apply
            </button>
          </form>
          {activeChips.length > 0 && (
            <div className="filter-chips">
              {activeChips.map((chip) => (
                <span key={chip}>{chip}</span>
              ))}
            </div>
          )}
          {loading && <p className="crm-loading">Loading contacts...</p>}
          {!loading && contacts.length === 0 && (
            <p className="crm-empty">No contacts match these filters.</p>
          )}
          <div className="contact-list">
            {contacts.map((contact) => (
              <button
                type="button"
                className="contact-row"
                key={contact.contact_id}
                onClick={() => openContact(contact.contact_id)}
              >
                <strong>{contact.display_name}</strong>
                <span>
                  {capitalize(contact.family_school_classification)} ·{' '}
                  {labelStatus(contact.lead_status)}
                </span>
                <span>
                  {contact.email ?? 'No email'}
                  {contact.phone ? ` · ${contact.phone}` : ''}
                </span>
                <span>
                  {contact.source} · {contact.assigned_team_member ?? 'Unassigned'} ·{' '}
                  {formatDate(contact.last_activity_at)}
                </span>
              </button>
            ))}
          </div>
          {nextCursor && (
            <button
              type="button"
              className="button-secondary load-more"
              onClick={() => void loadList(nextCursor)}
            >
              Load more
            </button>
          )}
        </section>
      )}
    </main>
  );
}

function ContactOverview({
  contact,
  canEdit,
  onBack,
  onEdit,
}: {
  contact: ContactDetail;
  canEdit: boolean;
  onBack: () => void;
  onEdit: () => void;
}) {
  const facts = [
    ['Classification', capitalize(contact.family_school_classification)],
    ['Lead status', labelStatus(contact.lead_status)],
    ['Email', contact.email ?? 'Not provided'],
    ['Phone', contact.phone ?? 'Not provided'],
    ['Location', contact.location],
    ['Timezone', contact.timezone],
    ['Source', contact.source],
    ['Offer version', contact.offer_version ?? 'Not recorded'],
    ['Content version', contact.content_version ?? 'Not recorded'],
    ['Reminder preference', contact.reminder_preference],
    ['Consent', contact.consent_state],
    ['Suppression', contact.suppression_state],
    ['Created', formatDate(contact.created_at)],
    ['Updated', formatDate(contact.updated_at)],
    ['Last activity', formatDate(contact.last_activity_at)],
    [
      'Signup provenance',
      contact.audit_safe_signup_provenance.signup_key
        ? 'Public signup captured'
        : 'Manual CRM contact',
    ],
  ];
  return (
    <section className="contact-detail" data-usable="crm-detail">
      <div className="crm-title-row">
        <div>
          <button type="button" className="text-button" onClick={onBack}>
            Back
          </button>
          <h1>{contact.display_name}</h1>
        </div>
        {canEdit && (
          <button type="button" className="button-primary" onClick={onEdit}>
            Edit
          </button>
        )}
      </div>
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
  onSave: (form: ContactFormState) => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (key: keyof ContactFormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  return (
    <section className="contact-form-shell">
      <div className="crm-title-row">
        <h1>{title}</h1>
        <button type="button" className="ghost-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {error && (
        <p className="crm-status error-status" role="alert">
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
            await onSave(form);
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
          <button type="button" className="ghost-button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

async function api<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { accept: 'application/json' } });
  const json = await response.json();
  if (!response.ok || json.success === false) throw new Error(json.message ?? 'Request failed.');
  return json as T;
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

function labelFor(key: string) {
  return key === 'lead_status'
    ? 'Status'
    : key === 'classification'
      ? 'Type'
      : key === 'search'
        ? 'Search'
        : 'Sort';
}

function labelStatus(value: string) {
  return value.replaceAll('_', ' ').replace(/^\w/, (letter) => letter.toUpperCase());
}

function capitalize(value: string) {
  return value.replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

const root = document.getElementById('crm-root');
if (root) {
  createRoot(root).render(<CrmApp />);
}
