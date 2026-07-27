import type {
  AdminGamificationDashboardResponse,
  AttachClassRecordingPayload,
  ClassEnrollment,
  ClassEnrollmentCandidate,
  ClassEnrollmentPayload,
  ClassOccurrenceDetail,
  ClassOccurrenceSummary,
  ClassRecording,
  ClassRecordingAccess,
  ClassSeries,
  ContactDetail,
  ContactListItem,
  ContactOperationsEnrollment,
  ContactOperationsEnrollmentResult,
  ContactOperationsHousehold,
  ContentLibraryItemSummary,
  CreateClassOccurrencePayload,
  CreateClassSeriesPayload,
  ManagedClassOccurrence,
  OwnerDashboardResponse,
  OperatorLaunchStatusResponse,
  SessionUser,
  SetClassRecordingAccessPayload,
  UpdateClassOccurrencePayload,
  UpdateClassSeriesPayload,
  ContactNote,
  ContactTag,
} from '@onetime/contracts';

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
    operator_experience?: {
      experience_preview?: boolean;
      live_console?: boolean;
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

export type AdultContactLink = {
  contact_key: string;
  household_key: string;
  guardian_user_ref: string | null;
  sync_state: 'sync_pending' | 'synced' | 'conflict';
  highlevel_contact_linked: boolean;
  open_in_highlevel_url: string | null;
  projection_revision: number;
  payment_data_present: false;
};

export type ContactOperationsAccessResult = {
  projection: {
    state: string;
    grants_access: boolean;
  };
  billing_mutated: false;
  payment_history_written: false;
};

export type TagListResponse = {
  success: true;
  tags: Array<ContactTag & { version: number }>;
};

export type NoteResponse = {
  success: true;
  note: ContactNote;
};

export type SupportEligibilityResponse = {
  success: true;
  available: boolean;
  can_create_ticket: boolean;
  reason: 'authorized' | 'learning_access_required' | 'support_unavailable';
  csrf_token: string;
  categories: Array<{ value: string; label: string }>;
};

export type SupportTicketSummary = {
  receipt_id: string;
  status: string;
  delivery_state: string;
  public_summary: string;
  updated_at: string;
};

export type SupportTicketListResponse = {
  success: true;
  tickets: SupportTicketSummary[];
};

export type SupportReceiptStatusResponse = {
  success: true;
  receipt: SupportTicketSummary & {
    source_ticket_id: string;
    bna_ticket_ref: string | null;
    status_version: number;
  };
};

export type ReplyPreviewResponse = {
  success: true;
  preview: {
    preview_id: string;
    contact_id: string;
    channel: 'email' | 'whatsapp';
    destination_masked: string;
    body_revision: string;
    provider_ready: false;
    external_send_allowed: false;
    confirmation_required: boolean;
    send_mode: 'provider_off_draft';
    blockers: string[];
    message: string;
  };
};

export type ReplyConfirmResponse = {
  success: true;
  reply: {
    draft_id: string;
    destination_masked: string;
    body_revision: string;
    outbox_delivery_key: string;
    external_send_attempted: false;
    delivery_state: 'draft_saved_provider_off';
    message: string;
  };
};

export type ClassListResponse = {
  success: true;
  occurrences: ClassOccurrenceSummary[];
  next_cursor: null;
};

export type ClassDetailResponse = {
  success: true;
  occurrence: ClassOccurrenceDetail;
};

export type ManagedClassSeriesListResponse = {
  success: true;
  series: ClassSeries[];
};

export type ManagedClassSeriesResponse = {
  success: true;
  series: ClassSeries;
};

export type ManagedClassOccurrenceResponse = {
  success: true;
  occurrence: ManagedClassOccurrence;
};

export type ClassEnrollmentListResponse = {
  success: true;
  enrollments: ClassEnrollment[];
};

export type ClassEnrollmentCandidateListResponse = {
  success: true;
  candidates: ClassEnrollmentCandidate[];
};

export type ClassEnrollmentResponse = {
  success: true;
  enrollment: ClassEnrollment;
};

export type ClassRecordingListResponse = {
  success: true;
  recordings: ClassRecording[];
};

export type ClassRecordingResponse = {
  success: true;
  recording: ClassRecording;
};

export type ClassRecordingAccessListResponse = {
  success: true;
  access: ClassRecordingAccess[];
};

export type ClassZoomStatus = {
  occurrence_key: string;
  title: string;
  starts_at: string;
  provider_ready: boolean;
  meeting_state:
    | 'not_provisioned'
    | 'provisioning'
    | 'active'
    | 'provision_failed'
    | 'provision_unknown'
    | 'deleting'
    | 'deleted'
    | 'delete_unknown';
  purpose: 'normal_class' | 'synthetic_acceptance' | null;
  enrolled_student_count: number;
  registered_student_count: number;
  raw_join_url_present: false;
  last_error: string | null;
};

export type ClassZoomStatusResponse = {
  success: true;
  data: ClassZoomStatus;
};

export type ClassZoomDeleteResponse = {
  success: true;
  data: {
    occurrence_key: string;
    meeting_state: 'deleted';
    deleted: true;
  };
};

export type ContentListResponse = {
  success: true;
  items: ContentLibraryItemSummary[];
  next_cursor: null;
};

export type Assignee = {
  user_key: string;
  display_name: string;
  role_label: string;
};

export type AssigneeListResponse = {
  success: true;
  assignees: Assignee[];
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

export const CRM_SEARCH_ADAPTER = {
  status: 'post_body',
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
      search: true,
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

export async function listContacts(query: QueryState, csrfToken: string, cursor?: string) {
  return authenticatedJson<ListResponse>('/api/v1/crm/contacts/search', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify(safeSearchPayload(query, cursor)),
  });
}

export async function getContact(contactId: string) {
  return authenticatedJson<ContactResponse>(
    `/api/v1/crm/contacts/${encodeURIComponent(contactId)}`,
  );
}

export async function getAssignees() {
  return authenticatedJson<AssigneeListResponse>('/api/v1/crm/assignees');
}

export async function listTags() {
  return authenticatedJson<TagListResponse>('/api/v1/crm/tags');
}

export async function createTag(csrfToken: string, displayName: string) {
  return authenticatedJson<{ success: true; tag: ContactTag & { version: number } }>(
    '/api/v1/crm/tags',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({ display_name: displayName }),
    },
  );
}

export async function assignTag(csrfToken: string, contactId: string, tagId: string) {
  return authenticatedJson<{ success: true; assigned: true }>(
    `/api/v1/crm/contacts/${encodeURIComponent(contactId)}/tags/${encodeURIComponent(tagId)}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({}),
    },
  );
}

export async function appendNote(csrfToken: string, contactId: string, body: string) {
  return authenticatedJson<NoteResponse>(
    `/api/v1/crm/contacts/${encodeURIComponent(contactId)}/notes`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({ body }),
    },
  );
}

export async function archiveContactRequest(csrfToken: string, contactId: string, reason: string) {
  return authenticatedJson<{ success: true; archived: true; contact_id: string }>(
    `/api/v1/crm/contacts/${encodeURIComponent(contactId)}/archive`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({ reason }),
    },
  );
}

export async function reactivateContactRequest(csrfToken: string, contactId: string) {
  return authenticatedJson<{ success: true; reactivated: true; contact_id: string }>(
    `/api/v1/crm/contacts/${encodeURIComponent(contactId)}/reactivate`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({}),
    },
  );
}

export async function previewReply(
  csrfToken: string,
  contactId: string,
  channel: 'email' | 'whatsapp',
  body: string,
) {
  return authenticatedJson<ReplyPreviewResponse>(
    `/api/v1/crm/contacts/${encodeURIComponent(contactId)}/replies/preview`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({ channel, body }),
    },
  );
}

export async function confirmReply(input: {
  csrfToken: string;
  contactId: string;
  channel: 'email' | 'whatsapp';
  body: string;
  bodyRevision: string;
  idempotencyKey: string;
}) {
  return authenticatedJson<ReplyConfirmResponse>(
    `/api/v1/crm/contacts/${encodeURIComponent(input.contactId)}/replies/confirm`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': input.csrfToken,
      },
      body: JSON.stringify({
        channel: input.channel,
        body: input.body,
        body_revision: input.bodyRevision,
        idempotency_key: input.idempotencyKey,
      }),
    },
  );
}

export async function getSupportEligibility() {
  return authenticatedJson<SupportEligibilityResponse>('/api/v1/support/eligibility');
}

export async function listSupportTickets() {
  return authenticatedJson<SupportTicketListResponse>('/api/v1/support/tickets');
}

export async function getSupportReceiptStatus(receiptId: string) {
  return authenticatedJson<SupportReceiptStatusResponse>(
    `/api/v1/support/receipts/${encodeURIComponent(receiptId)}/status`,
  );
}

export async function submitSupportTicket(csrfToken: string, payload: Record<string, unknown>) {
  return authenticatedJson<{
    success: true;
    receipt_id: string;
    source_ticket_id: string;
    status_path: string;
    delivery_state: string;
    duplicate_submission: boolean;
  }>('/api/v1/support/tickets', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function getOwnerDashboard() {
  return authenticatedJson<OwnerDashboardResponse>('/api/v1/dashboard/owner');
}

export async function getOperatorLaunchStatus() {
  return authenticatedJson<OperatorLaunchStatusResponse>('/api/v1/launch-status');
}

export async function getGamificationAdminDashboard() {
  return authenticatedJson<AdminGamificationDashboardResponse>('/api/v1/gamification/admin');
}

export async function getClasses() {
  return authenticatedJson<ClassListResponse>('/api/v1/classes?limit=10');
}

export async function getClassDetail(occurrenceKey: string) {
  return authenticatedJson<ClassDetailResponse>(
    `/api/v1/classes/${encodeURIComponent(occurrenceKey)}`,
  );
}

export async function listManagedClassSeries() {
  return authenticatedJson<ManagedClassSeriesListResponse>('/api/v1/admin/classes/series');
}

export async function createManagedClassSeries(
  csrfToken: string,
  payload: CreateClassSeriesPayload,
) {
  return classManagementWrite<ManagedClassSeriesResponse>(
    '/api/v1/admin/classes/series',
    csrfToken,
    'POST',
    payload,
  );
}

export async function updateManagedClassSeries(
  csrfToken: string,
  seriesKey: string,
  payload: UpdateClassSeriesPayload,
) {
  return classManagementWrite<ManagedClassSeriesResponse>(
    `/api/v1/admin/classes/series/${encodeURIComponent(seriesKey)}`,
    csrfToken,
    'PATCH',
    payload,
  );
}

export async function getManagedClassOccurrence(occurrenceKey: string) {
  return authenticatedJson<ManagedClassOccurrenceResponse>(
    `/api/v1/admin/classes/occurrences/${encodeURIComponent(occurrenceKey)}`,
  );
}

export async function createManagedClassOccurrence(
  csrfToken: string,
  payload: CreateClassOccurrencePayload,
) {
  return classManagementWrite<ManagedClassOccurrenceResponse>(
    '/api/v1/admin/classes/occurrences',
    csrfToken,
    'POST',
    payload,
  );
}

export async function updateManagedClassOccurrence(
  csrfToken: string,
  occurrenceKey: string,
  payload: UpdateClassOccurrencePayload,
) {
  return classManagementWrite<ManagedClassOccurrenceResponse>(
    `/api/v1/admin/classes/occurrences/${encodeURIComponent(occurrenceKey)}`,
    csrfToken,
    'PATCH',
    payload,
  );
}

export async function listClassEnrollmentCandidates(occurrenceKey: string) {
  return authenticatedJson<ClassEnrollmentCandidateListResponse>(
    `/api/v1/admin/classes/occurrences/${encodeURIComponent(occurrenceKey)}/enrollment-candidates`,
  );
}

export async function listClassEnrollments(occurrenceKey: string) {
  return authenticatedJson<ClassEnrollmentListResponse>(
    `/api/v1/admin/classes/occurrences/${encodeURIComponent(occurrenceKey)}/enrollments`,
  );
}

export async function enrollLearnerInClass(
  csrfToken: string,
  occurrenceKey: string,
  payload: ClassEnrollmentPayload,
) {
  return classManagementWrite<ClassEnrollmentResponse>(
    `/api/v1/admin/classes/occurrences/${encodeURIComponent(occurrenceKey)}/enrollments`,
    csrfToken,
    'POST',
    payload,
  );
}

export async function revokeClassEnrollment(
  csrfToken: string,
  occurrenceKey: string,
  learnerKey: string,
  idempotencyKey: string,
) {
  return classManagementWrite<ClassEnrollmentResponse>(
    `/api/v1/admin/classes/occurrences/${encodeURIComponent(
      occurrenceKey,
    )}/enrollments/${encodeURIComponent(learnerKey)}/revoke`,
    csrfToken,
    'POST',
    { idempotency_key: idempotencyKey },
  );
}

export async function listClassRecordings(occurrenceKey: string) {
  return authenticatedJson<ClassRecordingListResponse>(
    `/api/v1/admin/classes/occurrences/${encodeURIComponent(occurrenceKey)}/recordings`,
  );
}

export async function attachClassRecording(
  csrfToken: string,
  occurrenceKey: string,
  payload: AttachClassRecordingPayload,
) {
  return classManagementWrite<ClassRecordingResponse>(
    `/api/v1/admin/classes/occurrences/${encodeURIComponent(occurrenceKey)}/recordings`,
    csrfToken,
    'POST',
    payload,
  );
}

export async function listClassRecordingAccess(occurrenceKey: string, itemKey: string) {
  return authenticatedJson<ClassRecordingAccessListResponse>(
    `/api/v1/admin/classes/occurrences/${encodeURIComponent(
      occurrenceKey,
    )}/recordings/${encodeURIComponent(itemKey)}/access`,
  );
}

export async function setClassRecordingAccess(
  csrfToken: string,
  occurrenceKey: string,
  itemKey: string,
  payload: SetClassRecordingAccessPayload,
) {
  return classManagementWrite<ClassRecordingResponse>(
    `/api/v1/admin/classes/occurrences/${encodeURIComponent(
      occurrenceKey,
    )}/recordings/${encodeURIComponent(itemKey)}/access`,
    csrfToken,
    'POST',
    payload,
  );
}

export async function getClassZoomStatus(occurrenceKey: string) {
  return authenticatedJson<ClassZoomStatusResponse>(
    `/api/v1/admin/classes/occurrences/${encodeURIComponent(occurrenceKey)}/zoom`,
  );
}

export async function provisionClassZoom(
  csrfToken: string,
  occurrenceKey: string,
  payload: {
    purpose: 'normal_class' | 'synthetic_acceptance';
    idempotency_key: string;
  },
) {
  return classManagementWrite<ClassZoomStatusResponse>(
    `/api/v1/admin/classes/occurrences/${encodeURIComponent(occurrenceKey)}/zoom/provision`,
    csrfToken,
    'POST',
    payload,
  );
}

export async function deleteSyntheticClassZoom(csrfToken: string, occurrenceKey: string) {
  return classManagementWrite<ClassZoomDeleteResponse>(
    `/api/v1/admin/classes/occurrences/${encodeURIComponent(occurrenceKey)}/zoom/delete-synthetic`,
    csrfToken,
    'POST',
    { confirmed: true },
  );
}

export async function enrollParentHousehold(
  csrfToken: string,
  payload: ContactOperationsEnrollment,
) {
  return contactOperationsWrite<{ success: true; data: ContactOperationsEnrollmentResult }>(
    '/api/v1/contact-operations/enrollments',
    csrfToken,
    payload,
  );
}

export async function getAdultContactLink(householdKey: string) {
  return authenticatedJson<{ success: true; data: AdultContactLink }>(
    `/api/v1/contact-operations/households/${encodeURIComponent(householdKey)}/adult-link`,
  );
}

export async function getContactOperationsHousehold(householdKey: string) {
  return authenticatedJson<{ success: true; data: ContactOperationsHousehold }>(
    `/api/v1/contact-operations/households/${encodeURIComponent(householdKey)}`,
  );
}

export async function updateContactOperationsAccess(input: {
  csrfToken: string;
  householdKey: string;
  operation: 'grant_complimentary' | 'revoke_complimentary' | 'suspend' | 'release';
  idempotencyKey: string;
}) {
  return contactOperationsWrite<{ success: true; data: ContactOperationsAccessResult }>(
    `/api/v1/contact-operations/households/${encodeURIComponent(
      input.householdKey,
    )}/access/${input.operation}`,
    input.csrfToken,
    {
      idempotency_key: input.idempotencyKey,
      policy_version: 'contact-operations-ui-v1',
      reason:
        input.operation === 'suspend'
          ? 'operator_suspension_billing_unchanged'
          : input.operation === 'release'
            ? 'operator_suspension_released_billing_unchanged'
            : input.operation === 'revoke_complimentary'
              ? 'operator_complimentary_revoked'
              : undefined,
    },
  );
}

export async function reconcileAdultContact(input: {
  csrfToken: string;
  householdKey: string;
  idempotencyKey: string;
}) {
  return contactOperationsWrite<{
    success: true;
    data: {
      sync_state: 'sync_pending';
      projection_revision: number;
      duplicate: boolean;
      child_highlevel_operations: 0;
    };
  }>(
    `/api/v1/contact-operations/households/${encodeURIComponent(input.householdKey)}/reconcile`,
    input.csrfToken,
    { idempotency_key: input.idempotencyKey },
  );
}

export async function requestParentContactReset(input: {
  csrfToken: string;
  householdKey: string;
  idempotencyKey: string;
}) {
  return contactOperationsWrite<{
    success: true;
    data: { request_accepted: true; password_exposed: false };
  }>(
    `/api/v1/contact-operations/households/${encodeURIComponent(input.householdKey)}/parent-reset`,
    input.csrfToken,
    { idempotency_key: input.idempotencyKey },
  );
}

export async function requestStudentContactReset(input: {
  csrfToken: string;
  householdKey: string;
  learnerKey: string;
  idempotencyKey: string;
}) {
  return contactOperationsWrite<{
    success: true;
    data: {
      token_ref: string;
      plaintext_credential_stored: false;
      sessions_revoked_on_completion: true;
      child_highlevel_operations: 0;
    };
  }>(
    `/api/v1/contact-operations/households/${encodeURIComponent(
      input.householdKey,
    )}/students/${encodeURIComponent(input.learnerKey)}/reset`,
    input.csrfToken,
    { idempotency_key: input.idempotencyKey },
  );
}

export async function getContentLibrary(query = '') {
  return authenticatedJson<ContentListResponse>(
    `/api/v1/content/library?limit=50${query ? `&${query}` : ''}`,
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
  if (!isCreate && form.version) headers['If-Match'] = `"${form.version}"`;
  const body = isCreate ? { ...form, idempotency_key: idempotencyKey } : form;

  return authenticatedJson<ContactResponse>(path, {
    method: isCreate ? 'POST' : 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
}

export function createIdempotencyKey() {
  if ('crypto' in window && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ot-crm-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeSearchPayload(query: QueryState, cursor?: string) {
  return {
    search: query.search.trim(),
    ...(safeClassifications.has(query.classification)
      ? { classification: query.classification }
      : {}),
    ...(safeStatuses.has(query.lead_status) ? { lead_status: query.lead_status } : {}),
    ...(safeSorts.has(query.sort) ? { sort: query.sort } : {}),
    ...(cursor ? { cursor } : {}),
  };
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

function contactOperationsWrite<T>(path: string, csrfToken: string, payload: unknown) {
  return authenticatedJson<T>(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify(payload),
  });
}

function classManagementWrite<T>(
  path: string,
  csrfToken: string,
  method: 'POST' | 'PATCH',
  payload: unknown,
) {
  return authenticatedJson<T>(path, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify(payload),
  });
}

function privateHeaders(headers?: HeadersInit) {
  const merged = new Headers(headers);
  if (!merged.has('accept')) merged.set('accept', 'application/json');
  merged.set('cache-control', 'no-store');
  merged.set('pragma', 'no-cache');
  return merged;
}
