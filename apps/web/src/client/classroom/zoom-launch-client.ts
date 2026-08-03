import { startClassroomSdk } from './zoom-sdk-adapter.ts';

type BootstrapResponse = {
  success: true;
  data: {
    selected_view: 'client' | 'component';
    attempt_key: string;
    sdk:
      | {
          mode: 'sink';
          meeting_number: string;
          signature: string;
          registrant_token_ref: string;
          role: 0;
          user_display_name: string;
          leave_url: string;
        }
      | {
          mode: 'real';
          sdk_web_version: string;
          meeting_number: string;
          signature: string;
          meeting_password: string;
          registrant_token: string;
          user_email: string;
          customer_key: string;
          role: 0;
          user_display_name: string;
          leave_url: string;
          video_start_model: 'PARTICIPANT_CONSENT';
        };
    provider: {
      mode: 'sink' | 'real';
      state: string;
      raw_join_url_present: false;
    };
  };
};

type ErrorResponse = {
  success?: false;
  message?: string;
  code?: string;
};

const statusEl = document.querySelector<HTMLElement>('[data-classroom-status]');
const retryButton = document.querySelector<HTMLButtonElement>('[data-classroom-retry]');
const leaveButton = document.querySelector<HTMLButtonElement>('[data-classroom-leave]');
const sdkRoot = document.querySelector<HTMLElement>('[data-classroom-sdk-root]');

let activeAttemptKey: string | null = null;
let activeBootstrapData: BootstrapResponse['data'] | null = null;
let lifecycleCounter = 0;

function csrfToken() {
  const raw = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith('otcrm_csrf='))
    ?.split('=')
    .slice(1)
    .join('=');
  return raw ? decodeURIComponent(raw) : '';
}

function setStatus(message: string, failed = false) {
  if (statusEl) statusEl.textContent = message;
  if (retryButton) retryButton.hidden = !failed;
  document.documentElement.dataset.classroomLaunchState = failed ? 'retry' : 'ready';
}

async function postAttendance(
  attemptKey: string,
  eventType: 'bootstrap_loaded' | 'sdk_join_started' | 'sdk_joined' | 'sdk_left' | 'retry',
  clientState: string,
) {
  await fetch('/api/v1/classroom/attendance', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': csrfToken(),
    },
    body: JSON.stringify({
      attempt_key: attemptKey,
      event_type: eventType,
      idempotency_key: `classroom-${eventType}-${attemptKey}-${++lifecycleCounter}`,
      client_state: clientState,
    }),
  }).catch(() => undefined);
}

async function bootstrap() {
  if (retryButton) retryButton.hidden = true;
  if (leaveButton) leaveButton.hidden = activeBootstrapData === null;
  if (sdkRoot) sdkRoot.replaceChildren();
  setStatus('Opening protected classroom.');
  try {
    if (!activeBootstrapData) {
      const response = await fetch('/api/v1/classroom/launch/bootstrap', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': csrfToken(),
        },
        body: JSON.stringify({
          viewport_width: Math.round(window.innerWidth || 0),
          user_agent_hint: navigator.userAgent.slice(0, 120),
        }),
      });
      const json = (await response.json()) as BootstrapResponse | ErrorResponse;
      if (!response.ok || json.success !== true) {
        throw new Error(
          'message' in json && json.message ? json.message : 'Classroom is unavailable.',
        );
      }
      if (json.data.provider.raw_join_url_present) {
        throw new Error('Classroom provider returned an unsafe launch response.');
      }
      activeBootstrapData = json.data;
      activeAttemptKey = json.data.attempt_key;
      await postAttendance(activeAttemptKey, 'bootstrap_loaded', 'bootstrap_loaded');
    }
    await startClassroomSdk(activeBootstrapData, sdkRoot, postAttendance);
    const view = activeBootstrapData.selected_view === 'component' ? 'desktop' : 'client';
    setStatus(`Classroom is ready. View mode: ${view}.`);
    if (leaveButton) leaveButton.hidden = false;
  } catch (error) {
    if (activeAttemptKey) {
      await postAttendance(activeAttemptKey, 'retry', 'bootstrap_retry_available');
      if (leaveButton) leaveButton.hidden = false;
    }
    setStatus(error instanceof Error ? error.message : 'Classroom is unavailable.', true);
  }
}

async function leaveClassroom() {
  if (activeAttemptKey) {
    await postAttendance(activeAttemptKey, 'sdk_left', 'student_left');
  }
  location.assign('/app/student');
}

retryButton?.addEventListener('click', () => void bootstrap());
leaveButton?.addEventListener('click', () => void leaveClassroom());

void bootstrap();
