type BootstrapResponse = {
  success: true;
  data: {
    selected_view: 'client' | 'component';
    attempt_key: string;
    sdk: {
      meeting_number: string;
      signature: string;
      registrant_token_ref: string;
      role: 0;
      user_display_name: string;
      leave_url: string;
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
  if (leaveButton) leaveButton.hidden = true;
  if (sdkRoot) sdkRoot.replaceChildren();
  setStatus('Opening protected classroom.');
  try {
    const response = await fetch('/api/v1/classroom/launch/bootstrap', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrfToken(),
      },
      body: JSON.stringify({
        launch_path: location.pathname,
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
    activeAttemptKey = json.data.attempt_key;
    await postAttendance(activeAttemptKey, 'bootstrap_loaded', 'bootstrap_loaded');
    await startMockedSdk(json.data);
  } catch (error) {
    if (activeAttemptKey) {
      await postAttendance(activeAttemptKey, 'retry', 'bootstrap_retry_available');
    }
    setStatus(error instanceof Error ? error.message : 'Classroom is unavailable.', true);
  }
}

async function startMockedSdk(data: BootstrapResponse['data']) {
  await postAttendance(data.attempt_key, 'sdk_join_started', data.selected_view);
  if (sdkRoot) {
    const panel = document.createElement('div');
    panel.className = 'classroom-sdk-mock';
    panel.dataset.mockedZoomSdk = 'true';
    panel.dataset.selectedView = data.selected_view;
    panel.textContent =
      data.selected_view === 'component'
        ? 'Mocked Zoom component view is ready.'
        : 'Mocked Zoom client view is ready.';
    sdkRoot.append(panel);
  }
  await postAttendance(data.attempt_key, 'sdk_joined', data.provider.state);
  const view = data.selected_view === 'component' ? 'desktop' : 'client';
  setStatus(`Classroom is ready. View mode: ${view}.`);
  if (leaveButton) leaveButton.hidden = false;
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
