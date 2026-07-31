import type {
  HelperAnswer,
  LearnerProfile,
  LiveClassQuestion,
  LiveClassQuestionListResponse,
  LiveClassQuestionSubmitResponse,
  ParentLearnerMaterials,
  ParentPortalDashboard,
  ParentRewardGoal,
  ProtectedActionDescriptor,
  SessionUser,
  StudentAccessState,
  StudentQuestion,
  StudentPortalDashboard,
  SupportPreview,
} from '@onetime/contracts';

type ParentAccessShell = {
  mode: 'active' | 'paused';
  display_name: string;
  household_count: number;
  primary_household_key: string;
  learning_routes_available: boolean;
  identity_profile_available: true;
  recovery_available: true;
  support_available: true;
};

type LegacyApiSession = {
  authenticated: true;
  user: SessionUser;
  csrf_token: string;
  expires_at: string;
  session_model?: undefined;
};

export type V21ApiSession = {
  success: true;
  authenticated: true;
  session_model: 'v21';
  user: SessionUser;
  csrf_token: string;
  expires_at: string;
  parent_context: {
    adult_id: string;
    human_account_id: string;
    owned_household_count: number;
    household: {
      household_id: string;
      display_name: string;
      classification: 'family' | 'school';
      access_state: 'free' | 'active' | 'grace' | 'inactive';
      owner_relationship: 'account_owner';
    };
  };
};

export type ApiSession = LegacyApiSession | V21ApiSession;

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
  try {
    return await api<V21ApiSession>('/api/v2.1/auth/session');
  } catch (error) {
    if (
      !(error instanceof PortalApiError) ||
      error.status !== 404 ||
      error.code !== 'V21_SESSION_NOT_PRESENT'
    ) {
      throw error;
    }
  }
  return api<LegacyApiSession>('/api/v1/auth/session');
}

export async function logoutSession(session: ApiSession) {
  return api<{ success: true }>(
    session.session_model === 'v21' ? '/api/v2.1/auth/logout' : '/api/v1/auth/logout',
    {
      method: 'POST',
      headers: { 'x-csrf-token': session.csrf_token },
    },
  );
}

export async function changeOwnPassword(input: {
  csrfToken: string;
  currentPassword: string;
  newPassword: string;
}) {
  return api<{
    success: true;
    password_updated_at: string;
    sessions_invalidated: number;
    current_session_preserved: true;
  }>('/api/v1/auth/password', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-csrf-token': input.csrfToken },
    body: JSON.stringify({
      current_password: input.currentPassword,
      new_password: input.newPassword,
    }),
  });
}

export async function getParentDashboard() {
  const json = await api<{ success: true; data: ParentPortalDashboard }>(
    '/api/v1/portals/parent/dashboard',
  );
  return json.data;
}

export async function getParentAccessShell() {
  const json = await api<{ success: true; data: ParentAccessShell }>(
    '/api/v1/contact-operations/parent-shell',
  );
  return json.data;
}

export async function requestParentRecovery(input: { csrfToken: string; householdKey: string }) {
  return api<{ success: true; data: { request_accepted: true } }>(
    `/api/v1/contact-operations/households/${encodeURIComponent(input.householdKey)}/parent-reset`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': input.csrfToken },
      body: JSON.stringify({ idempotency_key: createIdempotencyKey() }),
    },
  );
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
  username?: string | undefined;
  password?: string | undefined;
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
        ...(input.username ? { username: input.username } : {}),
        ...(input.password ? { password: input.password } : {}),
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

export async function createParentRewardGoal(input: {
  csrfToken: string;
  learnerKey: string;
  title: string;
  description?: string | undefined;
  pointsRequired: number;
}) {
  const json = await api<{ success: true; data: ParentRewardGoal }>(
    '/api/v1/gamification/parent-rewards',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': input.csrfToken },
      body: JSON.stringify({
        learner_key: input.learnerKey,
        title: input.title,
        ...(input.description ? { description: input.description } : {}),
        points_required: input.pointsRequired,
        idempotency_key: createIdempotencyKey(),
      }),
    },
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

export async function queryStudentHelper(input: { csrfToken: string; question: string }) {
  const json = await api<{ success: true; data: HelperAnswer }>(
    '/api/v1/portals/student/helper/query',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': input.csrfToken },
      body: JSON.stringify({
        idempotency_key: createIdempotencyKey(),
        question: input.question,
      }),
    },
  );
  return json.data;
}

export async function queryParentHelper(input: {
  csrfToken: string;
  householdKey: string;
  learnerKey: string;
  question: string;
}) {
  const json = await api<{ success: true; data: HelperAnswer }>(
    `/api/v1/portals/parent/households/${encodeURIComponent(
      input.householdKey,
    )}/learners/${encodeURIComponent(input.learnerKey)}/helper/query`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': input.csrfToken },
      body: JSON.stringify({
        idempotency_key: createIdempotencyKey(),
        question: input.question,
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
  const json = await api<LiveClassQuestionSubmitResponse>('/api/v1/live-class/questions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-csrf-token': input.csrfToken },
    body: JSON.stringify({
      occurrence_key: input.occurrenceKey,
      body: input.body,
      idempotency_key: createIdempotencyKey(),
    }),
  });
  return json.data;
}

export async function getLiveClassQuestions(occurrenceKey: string) {
  const json = await api<LiveClassQuestionListResponse>(
    `/api/v1/live-class/questions?occurrence_key=${encodeURIComponent(occurrenceKey)}`,
  );
  return json.data.questions;
}

export async function markLiveClassQuestionReady(input: {
  csrfToken: string;
  questionKey: string;
  ready: boolean;
}) {
  const json = await api<{ success: true; data: { question: LiveClassQuestion } }>(
    `/api/v1/live-class/questions/${encodeURIComponent(input.questionKey)}/ready`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': input.csrfToken },
      body: JSON.stringify({
        idempotency_key: createIdempotencyKey(),
        ready: input.ready,
        mic_ready: input.ready,
        video_ready: input.ready,
      }),
    },
  );
  return json.data.question;
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
