import type { ContactDetail, ContactListItem, SessionUser } from '@onetime/contracts';

export type ApiSession = {
  authenticated: true;
  user: SessionUser;
  csrf_token: string;
  expires_at: string;
  capabilities?: {
    crm?: {
      contacts?: {
        read?: boolean;
        create?: boolean;
        update?: boolean;
        assign?: boolean;
        search?: boolean;
      };
    };
  };
};

export type ListResponse = {
  success: true;
  contacts: ContactListItem[];
  next_cursor: string | null;
  applied_filters: Record<string, string | undefined>;
};

export type ContactResponse = {
  success: true;
  contact: ContactDetail;
};

export type ContactFormPayload = {
  display_name: string;
  family_school_classification: 'family' | 'school';
  email: string;
  phone: string;
  location: string;
  timezone: string;
  lead_status: string;
  assigned_user_key: string | undefined;
  internal_note: string;
  version?: number;
};

export type QueryState = {
  search: string;
  classification: string;
  lead_status: string;
  sort: string;
};

export type ResolvedCrmCapabilities = {
  contacts: {
    read: boolean;
    create: boolean;
    update: boolean;
    assign: boolean;
    search: boolean;
  };
  source: 'server_issued' | 'temporary_legacy_role_compatibility' | 'none';
};

export const SEARCH_UNAVAILABLE_MESSAGE =
  'Free-text contact search is paused until the secure POST search endpoint is merged.';

export const OT38_POST_SEARCH_INTEGRATION_CHANGE =
  'Change CRM_SEARCH_ADAPTER.status from unavailable_until_ot38 to post_body after OT-38 exposes POST /api/v1/crm/contacts/search and session.capabilities.crm.contacts.search=true.';

export const CRM_SEARCH_ADAPTER = {
  status: 'unavailable_until_ot38',
  method: 'POST',
  endpoint: '/api/v1/crm/contacts/search',
  body_contract: {
    search: 'free-text search string sent only in an authenticated JSON body',
    classification: 'family|school optional non-PII filter',
    lead_status: 'new|in_review|contacted|scheduled|closed|archived optional non-PII filter',
    sort: 'updated_desc|created_desc|name_asc optional non-PII filter',
    cursor: 'opaque pagination cursor',
  },
} as const;

const safeClassifications = new Set(['family', 'school']);
const safeStatuses = new Set(['new', 'in_review', 'contacted', 'scheduled', 'closed', 'archived']);
const safeSorts = new Set(['updated_desc', 'created_desc', 'name_asc']);

export class AuthExpiredError extends Error {
  constructor() {
    super('Session expired');
  }
}

export class SearchUnavailableError extends Error {
  constructor() {
    super(SEARCH_UNAVAILABLE_MESSAGE);
  }
}

export class ApiRequestError extends Error {
  code: string | undefined;
  existing_contact_path: string | undefined;
  current_version: number | undefined;

  constructor(json: Record<string, unknown>) {
    super(typeof json.message === 'string' ? json.message : 'Request failed.');
    this.code = typeof json.code === 'string' ? json.code : undefined;
    this.existing_contact_path =
      typeof json.existing_contact_path === 'string' ? json.existing_contact_path : undefined;
    this.current_version =
      typeof json.current_version === 'number' ? json.current_version : undefined;
  }
}

export function resolveCrmCapabilities(session: ApiSession | null): ResolvedCrmCapabilities {
  if (!session) {
    return {
      contacts: { read: false, create: false, update: false, assign: false, search: false },
      source: 'none',
    };
  }

  const serverContacts = session.capabilities?.crm?.contacts;
  if (serverContacts) {
    return {
      contacts: {
        read: serverContacts.read === true,
        create: serverContacts.create === true,
        update: serverContacts.update === true,
        assign: serverContacts.assign === true,
        search: serverContacts.search === true,
      },
      source: 'server_issued',
    };
  }

  const legacyCanEdit = ['owner', 'admin', 'crm_agent'].includes(session.user.role);
  const legacyCanAssign = ['owner', 'admin'].includes(session.user.role);
  return {
    contacts: {
      read: true,
      create: legacyCanEdit,
      update: legacyCanEdit,
      assign: legacyCanAssign,
      search: false,
    },
    source: 'temporary_legacy_role_compatibility',
  };
}

export async function getSession() {
  return authenticatedJson<ApiSession>('/api/v1/auth/session');
}

export async function logoutSession(csrfToken: string) {
  return authenticatedJson<{ success: true }>('/api/v1/auth/logout', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify({ csrf_token: csrfToken }),
  });
}

export async function listContacts(query: QueryState, cursor?: string) {
  if (query.search.trim()) throw new SearchUnavailableError();
  const params = safeListParams(query, cursor);
  const suffix = params.toString();
  return authenticatedJson<ListResponse>(`/api/v1/crm/contacts${suffix ? `?${suffix}` : ''}`);
}

export async function getContact(contactId: string) {
  return authenticatedJson<ContactResponse>(
    `/api/v1/crm/contacts/${encodeURIComponent(contactId)}`,
  );
}

export async function saveContactRequest({
  csrfToken,
  form,
  mode,
  contactId,
  idempotencyKey,
}: {
  csrfToken: string;
  form: ContactFormPayload;
  mode: 'create' | 'edit';
  contactId: string | undefined;
  idempotencyKey: string | undefined;
}) {
  const isCreate = mode === 'create';
  const path = isCreate
    ? '/api/v1/crm/contacts'
    : `/api/v1/crm/contacts/${encodeURIComponent(contactId ?? '')}`;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-csrf-token': csrfToken,
  };
  if (isCreate && idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  if (!isCreate && form.version) headers['If-Match'] = `"${form.version}"`;

  return authenticatedJson<ContactResponse>(path, {
    method: isCreate ? 'POST' : 'PATCH',
    headers,
    body: JSON.stringify(form),
  });
}

export function createIdempotencyKey() {
  if ('crypto' in window && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ot-crm-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeListParams(query: QueryState, cursor?: string) {
  const params = new URLSearchParams();
  if (safeClassifications.has(query.classification)) {
    params.set('classification', query.classification);
  }
  if (safeStatuses.has(query.lead_status)) params.set('lead_status', query.lead_status);
  if (safeSorts.has(query.sort)) params.set('sort', query.sort);
  if (cursor) params.set('cursor', cursor);
  return params;
}

async function authenticatedJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: privateHeaders(init.headers),
  });
  const json = await response.json().catch(() => ({}));
  if (response.status === 401 || response.status === 403) throw new AuthExpiredError();
  if (!response.ok || json.success === false) {
    throw new ApiRequestError(json);
  }
  return json as T;
}

function privateHeaders(headers?: HeadersInit) {
  const merged = new Headers(headers);
  if (!merged.has('accept')) merged.set('accept', 'application/json');
  merged.set('cache-control', 'no-store');
  merged.set('pragma', 'no-cache');
  return merged;
}
