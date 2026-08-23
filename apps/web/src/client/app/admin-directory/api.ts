export type AdminHousehold = {
  household_key: string;
  display_name: string;
  parent_name: string | null;
  status: 'active' | 'archived';
  version: number;
  active_learner_count: number;
  learner_count: number;
  guardian_count: number;
  access_state: string;
  setup_state: string;
  updated_at: string;
};

export type AdminUser = {
  user_key: string;
  display_name: string;
  email: string;
  role: string;
  status: 'active' | 'disabled' | 'pending_setup' | 'expired_setup';
  version: number;
  household_key: string | null;
  household_name: string | null;
  relationship_label: string | null;
  last_successful_login_at: string | null;
  setup_expires_at: string | null;
  learner_key: string | null;
};

export type AdminLearner = {
  learner_key: string;
  household_key: string;
  household_name: string;
  display_name: string;
  hebrew_name: string | null;
  grade_label: string | null;
  learner_status: 'active' | 'archived' | 'suspended';
  version: number;
  student_access_status: string;
  student_user_ref: string | null;
  enrollment_count: number;
  updated_at: string;
};

export type AdminAuditEvent = {
  event_key: string;
  action: string;
  actor_user_key: string | null;
  actor_label: string;
  actor_role: string;
  subject_type: 'household' | 'learner' | 'contact' | 'system';
  subject_key: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export class AdminDirectoryRequestError extends Error {
  code: string | null;
  currentVersion: number | null;
  fieldErrors: Record<string, string>;

  constructor(payload: Record<string, unknown>) {
    const fieldErrors = recordOfStrings(payload.field_errors);
    const firstFieldError = Object.values(fieldErrors)[0];
    super(
      firstFieldError ??
        (typeof payload.message === 'string'
          ? payload.message
          : 'The Admin directory request failed.'),
    );
    this.code = typeof payload.code === 'string' ? payload.code : null;
    this.currentVersion =
      typeof payload.current_version === 'number' ? payload.current_version : null;
    this.fieldErrors = fieldErrors;
  }
}

export function listAdminHouseholds(search = '', status = '') {
  return read<{ success: true; households: AdminHousehold[] }>(
    `/api/v1/admin-directory/households${queryString(search, status)}`,
  );
}

export function listAdminAuditHistory(search = '') {
  return read<{ success: true; events: AdminAuditEvent[] }>(
    `/api/v1/admin-directory/audit${queryString(search, '')}`,
  );
}

export function createAdminHousehold(
  csrfToken: string,
  payload: { display_name: string; idempotency_key: string },
) {
  return write<{ success: true; household: AdminHousehold }>(
    '/api/v1/admin-directory/households',
    csrfToken,
    'POST',
    payload,
  );
}

export function updateAdminHousehold(
  csrfToken: string,
  householdKey: string,
  payload: { display_name: string; version: number },
) {
  return write<{ success: true; household: AdminHousehold }>(
    `/api/v1/admin-directory/households/${encodeURIComponent(householdKey)}`,
    csrfToken,
    'PATCH',
    payload,
  );
}

export function setAdminHouseholdStatus(
  csrfToken: string,
  household: Pick<AdminHousehold, 'household_key' | 'version'>,
  action: 'archive' | 'restore',
) {
  return write<{ success: true; household: AdminHousehold }>(
    `/api/v1/admin-directory/households/${encodeURIComponent(household.household_key)}/${action}`,
    csrfToken,
    'POST',
    { version: household.version },
  );
}

export function attachAdminGuardian(
  csrfToken: string,
  householdKey: string,
  payload: {
    user_key: string;
    relationship_label: string;
    authority: 'primary_guardian' | 'guardian' | 'support_only';
  },
) {
  return write<{ success: true }>(
    `/api/v1/admin-directory/households/${encodeURIComponent(householdKey)}/guardians`,
    csrfToken,
    'POST',
    payload,
  );
}

export function listAdminUsers(search = '', status = '') {
  return read<{ success: true; users: AdminUser[] }>(
    `/api/v1/admin-directory/users${queryString(search, status)}`,
  );
}

export function inviteAdminUser(
  csrfToken: string,
  payload: {
    display_name: string;
    email: string;
    role: 'admin' | 'rabbi' | 'parent';
    household_key?: string;
    relationship_label: string;
    authority: 'primary_guardian' | 'guardian';
    idempotency_key: string;
  },
) {
  return write<{ success: true; invitation: { status: 'pending_setup' } }>(
    '/api/v1/admin-directory/users/invitations',
    csrfToken,
    'POST',
    payload,
  );
}

export function updateAdminUser(
  csrfToken: string,
  userKey: string,
  payload: { display_name: string; role: 'admin' | 'rabbi' | 'parent'; version: number },
) {
  return write<{ success: true; user: AdminUser }>(
    `/api/v1/admin-directory/users/${encodeURIComponent(userKey)}`,
    csrfToken,
    'PATCH',
    payload,
  );
}

export function setAdminUserStatus(
  csrfToken: string,
  user: Pick<AdminUser, 'user_key' | 'version'>,
  action: 'disable' | 'reactivate',
) {
  return write<{ success: true; user: AdminUser }>(
    `/api/v1/admin-directory/users/${encodeURIComponent(user.user_key)}/${action}`,
    csrfToken,
    'POST',
    { version: user.version },
  );
}

export function requestAdminUserPasswordReset(
  csrfToken: string,
  userKey: string,
  idempotencyKey: string,
) {
  return write<{ success: true; reset: { request_accepted: true } }>(
    `/api/v1/admin-directory/users/${encodeURIComponent(userKey)}/password-reset`,
    csrfToken,
    'POST',
    { idempotency_key: idempotencyKey },
  );
}

export function listAdminLearners(search = '', status = '') {
  return read<{ success: true; learners: AdminLearner[] }>(
    `/api/v1/admin-directory/learners${queryString(search, status)}`,
  );
}

export function createAdminLearner(
  csrfToken: string,
  payload: {
    household_key: string;
    display_name: string;
    hebrew_name: string | null;
    grade_label: string | null;
    idempotency_key: string;
  },
) {
  return write<{ success: true; learner: AdminLearner }>(
    '/api/v1/admin-directory/learners',
    csrfToken,
    'POST',
    payload,
  );
}

export function updateAdminLearner(
  csrfToken: string,
  learnerKey: string,
  payload: {
    display_name: string;
    hebrew_name: string | null;
    grade_label: string | null;
    version: number;
  },
) {
  return write<{ success: true; learner: AdminLearner }>(
    `/api/v1/admin-directory/learners/${encodeURIComponent(learnerKey)}`,
    csrfToken,
    'PATCH',
    payload,
  );
}

export function setAdminLearnerStatus(
  csrfToken: string,
  learner: Pick<AdminLearner, 'learner_key' | 'version'>,
  action: 'archive' | 'restore',
) {
  return write<{ success: true; learner: AdminLearner }>(
    `/api/v1/admin-directory/learners/${encodeURIComponent(learner.learner_key)}/${action}`,
    csrfToken,
    'POST',
    { version: learner.version },
  );
}

function queryString(search: string, status: string) {
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (status) params.set('status', status);
  const query = params.toString();
  return query ? `?${query}` : '';
}

async function read<T>(path: string) {
  return request<T>(path, { method: 'GET' });
}

async function write<T>(
  path: string,
  csrfToken: string,
  method: 'POST' | 'PATCH',
  payload: unknown,
) {
  return request<T>(path, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify(payload),
  });
}

async function request<T>(path: string, init: RequestInit) {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      accept: 'application/json',
      'cache-control': 'no-store',
      pragma: 'no-cache',
      ...Object.fromEntries(new Headers(init.headers).entries()),
    },
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || json.success === false) throw new AdminDirectoryRequestError(json);
  return json as T;
}

function recordOfStrings(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .map(([key, entry]) => [key, entry]),
  );
}
