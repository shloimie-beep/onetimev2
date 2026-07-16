import type {
  ClassroomQuestionSubmitResponse,
  LearnerProfile,
  ParentLearnerMaterials,
  ParentPortalDashboard,
  ProtectedActionDescriptor,
  SessionUser,
  StudentAccessState,
  StudentQuestion,
  StudentPortalDashboard,
  SupportPreview,
} from '@onetime/contracts';

export type ApiSession = {
  authenticated: true;
  user: SessionUser;
  csrf_token: string;
  expires_at: string;
};

export class PortalApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    if (code !== undefined) this.code = code;
  }
}

export async function getSession() {
  return api<ApiSession>('/api/v1/auth/session');
}

export async function getParentDashboard() {
  const json = await api<{ success: true; data: ParentPortalDashboard }>(
    '/api/v1/portals/parent/dashboard',
  );
  return json.data;
}

export async function getParentMaterials(householdKey: string, learnerKey: string) {
  const json = await api<{ success: true; data: ParentLearnerMaterials }>(
    `/api/v1/portals/parent/households/${encodeURIComponent(
      householdKey,
    )}/learners/${encodeURIComponent(learnerKey)}/materials`,
  );
  return json.data;
}

export async function createParentLearner(input: {
  csrfToken: string;
  householdKey: string;
  displayName: string;
  hebrewName?: string | undefined;
  gradeLabel?: string | undefined;
}) {
  const json = await api<{ success: true; data: LearnerProfile }>(
    `/api/v1/portals/parent/households/${encodeURIComponent(input.householdKey)}/learners`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': input.csrfToken },
      body: JSON.stringify({
        idempotency_key: createIdempotencyKey(),
        display_name: input.displayName,
        ...(input.hebrewName ? { hebrew_name: input.hebrewName } : {}),
        ...(input.gradeLabel ? { grade_label: input.gradeLabel } : {}),
      }),
    },
  );
  return json.data;
}

export async function updateParentLearner(input: {
  csrfToken: string;
  householdKey: string;
  learnerKey: string;
  version: number;
  displayName: string;
  hebrewName?: string | null | undefined;
  gradeLabel?: string | null | undefined;
}) {
  const json = await api<{ success: true; data: LearnerProfile }>(
    `/api/v1/portals/parent/households/${encodeURIComponent(
      input.householdKey,
    )}/learners/${encodeURIComponent(input.learnerKey)}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-csrf-token': input.csrfToken },
      body: JSON.stringify({
        idempotency_key: createIdempotencyKey(),
        version: input.version,
        display_name: input.displayName,
        hebrew_name: input.hebrewName ?? null,
        grade_label: input.gradeLabel ?? null,
      }),
    },
  );
  return json.data;
}

export async function setParentLearnerArchived(input: {
  csrfToken: string;
  householdKey: string;
  learnerKey: string;
  version: number;
  archived: boolean;
}) {
  const operation = input.archived ? 'archive' : 'restore';
  const json = await api<{ success: true; data: LearnerProfile }>(
    `/api/v1/portals/parent/households/${encodeURIComponent(
      input.householdKey,
    )}/learners/${encodeURIComponent(input.learnerKey)}/${operation}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': input.csrfToken },
      body: JSON.stringify({
        idempotency_key: createIdempotencyKey(),
        version: input.version,
      }),
    },
  );
  return json.data;
}

export async function runStudentAccessOperation(input: {
  csrfToken: string;
  householdKey: string;
  learnerKey: string;
  operation: 'setup' | 'reset' | 'suspend' | 'restore' | 'revoke_sessions';
  email?: string | undefined;
  displayName?: string | undefined;
}) {
  const json = await api<{ success: true; data: StudentAccessState }>(
    `/api/v1/portals/parent/households/${encodeURIComponent(
      input.householdKey,
    )}/learners/${encodeURIComponent(input.learnerKey)}/student-access/${input.operation}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': input.csrfToken },
      body: JSON.stringify({
        idempotency_key: createIdempotencyKey(),
        ...(input.email ? { email: input.email } : {}),
        ...(input.displayName ? { display_name: input.displayName } : {}),
      }),
    },
  );
  return json.data;
}

export async function getStudentDashboard() {
  const json = await api<{ success: true; data: StudentPortalDashboard }>(
    '/api/v1/portals/student/dashboard',
  );
  return json.data;
}

export async function submitStudentQuestion(input: {
  csrfToken: string;
  question: string;
  classKey?: string | undefined;
}) {
  const json = await api<{ success: true; data: StudentQuestion }>(
    '/api/v1/portals/student/questions',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': input.csrfToken },
      body: JSON.stringify({
        idempotency_key: createIdempotencyKey(),
        question: input.question,
        ...(input.classKey ? { class_key: input.classKey } : {}),
      }),
    },
  );
  return json.data;
}

export async function submitClassroomQuestion(input: {
  csrfToken: string;
  occurrenceKey: string;
  body: string;
}) {
  const json = await api<{ success: true; data: ClassroomQuestionSubmitResponse }>(
    '/api/v1/classroom/questions',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': input.csrfToken },
      body: JSON.stringify({
        occurrence_key: input.occurrenceKey,
        body: input.body,
        idempotency_key: createIdempotencyKey(),
      }),
    },
  );
  return json.data;
}

export async function previewParentSupport(input: {
  csrfToken: string;
  householdKey: string;
  subject: string;
  body: string;
}) {
  const json = await api<{ success: true; data: SupportPreview }>(
    `/api/v1/portals/parent/households/${encodeURIComponent(input.householdKey)}/support/preview`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': input.csrfToken },
      body: JSON.stringify({
        idempotency_key: createIdempotencyKey(),
        subject: input.subject,
        body: input.body,
      }),
    },
  );
  return json.data;
}

export async function previewStudentSupport(input: {
  csrfToken: string;
  subject: string;
  body: string;
}) {
  const json = await api<{ success: true; data: SupportPreview }>(
    '/api/v1/portals/student/support/preview',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': input.csrfToken },
      body: JSON.stringify({
        idempotency_key: createIdempotencyKey(),
        subject: input.subject,
        body: input.body,
      }),
    },
  );
  return json.data;
}

export async function invokeProtectedAction(action: ProtectedActionDescriptor, csrfToken: string) {
  if (!action.href) return null;
  const init: RequestInit = {
    method: action.method,
  };
  if (action.method === 'POST') {
    init.headers = { 'content-type': 'application/json', 'x-csrf-token': csrfToken };
    init.body = JSON.stringify({ idempotency_key: createIdempotencyKey() });
  }
  const json = await api<{ success: true; data: ProtectedActionDescriptor }>(action.href, init);
  return json.data;
}

export function createIdempotencyKey() {
  if ('crypto' in globalThis && typeof crypto.randomUUID === 'function') {
    return `portal-${crypto.randomUUID()}`;
  }
  return `portal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: {
      accept: 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  const json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!response.ok || json.success === false) {
    throw new PortalApiError(
      response.status,
      typeof json.message === 'string' ? json.message : 'Portal request failed.',
      typeof json.code === 'string' ? json.code : undefined,
    );
  }
  return json as T;
}
