import type {
  StudentNotificationActionDecision,
  StudentNotificationCenterSnapshot,
  StudentNotificationFilter,
} from '../../../../../../../packages/contracts/src/notifications/student/index.ts';

const BASE_PATH = '/api/app/student/notifications';

export async function loadStudentNotifications(
  filter: StudentNotificationFilter,
): Promise<StudentNotificationCenterSnapshot> {
  const response = await request<{ snapshot: StudentNotificationCenterSnapshot }>(
    `${BASE_PATH}?filter=${encodeURIComponent(filter)}`,
  );
  return response.snapshot;
}

export async function markStudentNotificationRead(csrfToken: string, notificationId: string) {
  return request<{ disposition: 'applied' | 'replayed' | 'unavailable' }>(
    `${BASE_PATH}/${encodeURIComponent(notificationId)}/read`,
    mutation(csrfToken),
  );
}

export async function markAllStudentNotificationsRead(csrfToken: string) {
  return request<{ changedCount: number }>(`${BASE_PATH}/read-all`, mutation(csrfToken));
}

export async function setStudentNotificationSoundPreference(csrfToken: string, enabled: boolean) {
  return request<{ soundEnabled: boolean }>(
    `${BASE_PATH}/sound-preference`,
    mutation(csrfToken, { enabled }),
  );
}

export async function openStudentNotificationAction(
  csrfToken: string,
  notificationId: string,
): Promise<StudentNotificationActionDecision> {
  return request<StudentNotificationActionDecision>(
    `${BASE_PATH}/${encodeURIComponent(notificationId)}/open`,
    mutation(csrfToken),
  );
}

function mutation(csrfToken: string, body?: unknown): RequestInit {
  return {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify(body ?? {}),
  };
}

async function request<T>(pathname: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(pathname, {
    ...init,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { accept: 'application/json', ...init.headers },
  });
  const json = (await response.json()) as
    { success: true; data: T } | { success: false; message?: string };
  if (!response.ok || !json.success) {
    throw new Error(
      'message' in json && json.message ? json.message : 'Notifications unavailable.',
    );
  }
  return json.data;
}
