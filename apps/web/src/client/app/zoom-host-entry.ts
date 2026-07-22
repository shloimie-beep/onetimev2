type ZoomCommand = {
  command_key: string;
  command_type: 'ask_unmute' | 'mute' | 'spotlight_replace' | 'spotlight_remove' | 'stop_video';
  target_participant_key: string | null;
  nonce: string;
  signature: string;
};

type ZoomAttendee = {
  userId?: number | string;
  userID?: number | string;
  customerKey?: string;
  customer_key?: string;
  muted?: boolean;
  audio?: string;
  bVideoOn?: boolean;
  video?: boolean;
  isSpotlight?: boolean;
  active?: boolean;
};

type ZoomApi = Record<
  | 'setZoomJSLib'
  | 'preLoadWasm'
  | 'prepareWebSDK'
  | 'getAttendeeslist'
  | 'mute'
  | 'operateSpotlight'
  | 'inMeetingServiceListener'
  | 'init'
  | 'join',
  (...args: unknown[]) => unknown
>;

declare global {
  interface Window {
    ZoomMtg?: Record<string, (...args: never[]) => unknown>;
  }
}

const statusElement = document.querySelector<HTMLElement>('[data-zoom-host-status]');
const participantIds = new Map<string, number>();
const participantKeys = new Map<string, string>();
const customerKeysByUserId = new Map<number, string>();
let occurrenceKey = '';
let pollTimer: number | undefined;

function csrfToken() {
  const raw = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith('otcrm_csrf='))
    ?.split('=')
    .slice(1)
    .join('=');
  return raw ? decodeURIComponent(raw) : '';
}

function setStatus(message: string, state: 'ready' | 'provider-off' | 'failed' = 'ready') {
  if (statusElement) statusElement.textContent = message;
  document.documentElement.dataset.zoomHostState = state;
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', ...init });
  const body = (await response.json()) as T & { message?: string };
  if (!response.ok) throw new Error(body.message ?? 'Protected Zoom host request failed.');
  return body;
}

async function loadScript(src: string) {
  await new Promise<void>((resolve, reject) => {
    const element = document.createElement('script');
    element.src = src;
    element.referrerPolicy = 'no-referrer';
    element.onload = () => resolve();
    element.onerror = () => reject(new Error('Meeting SDK asset did not load.'));
    document.head.append(element);
  });
}

function loadStyle(href: string) {
  const element = document.createElement('link');
  element.rel = 'stylesheet';
  element.href = href;
  element.referrerPolicy = 'no-referrer';
  document.head.append(element);
}

async function loadMeetingSdk(version: string) {
  const base = `https://source.zoom.us/${version}`;
  loadStyle(`${base}/css/bootstrap.css`);
  loadStyle(`${base}/css/react-select.css`);
  for (const src of [
    `${base}/lib/vendor/react.min.js`,
    `${base}/lib/vendor/react-dom.min.js`,
    `${base}/lib/vendor/redux.min.js`,
    `${base}/lib/vendor/redux-thunk.min.js`,
    `${base}/lib/vendor/lodash.min.js`,
    `${base}/zoom-meeting-${version}.min.js`,
  ]) {
    await loadScript(src);
  }
  const zoom = window.ZoomMtg as ZoomApi | undefined;
  if (!zoom) throw new Error('Meeting SDK did not initialize.');
  zoom.setZoomJSLib(`${base}/lib`, '/av');
  zoom.preLoadWasm();
  zoom.prepareWebSDK();
  return zoom;
}

async function syncRoster(zoom: ZoomApi) {
  await new Promise<void>((resolve) => {
    zoom.getAttendeeslist({
      success: async (result: { result?: { attendeesList?: ZoomAttendee[] } }) => {
        const attendees = result.result?.attendeesList ?? [];
        const mapped = attendees.flatMap((attendee) => {
          const customerKey = String(attendee.customerKey ?? attendee.customer_key ?? '');
          const rawUserId = attendee.userId ?? attendee.userID;
          const userId = Number(rawUserId);
          if (!customerKey || !Number.isSafeInteger(userId)) return [];
          participantIds.set(customerKey, userId);
          customerKeysByUserId.set(userId, customerKey);
          return [
            {
              customer_key: customerKey,
              provider_user_id: String(userId),
              join_state: 'joined' as const,
              audio_state: attendee.muted === false ? ('unmuted' as const) : ('muted' as const),
              video_state: attendee.bVideoOn || attendee.video ? ('on' as const) : ('off' as const),
              active_speaker: Boolean(attendee.active),
              spotlighted: Boolean(attendee.isSpotlight),
            },
          ];
        });
        if (mapped.length > 0) {
          const response = await jsonRequest<{
            success: true;
            data: { mappings: Array<{ customer_key: string; participant_key: string }> };
          }>('/api/v1/live-class/zoom/host/participants', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken() },
            body: JSON.stringify({ occurrence_key: occurrenceKey, participants: mapped }),
          }).catch(() => null);
          for (const mapping of response?.data.mappings ?? []) {
            participantKeys.set(mapping.participant_key, mapping.customer_key);
          }
        }
        resolve();
      },
      error: () => resolve(),
    });
  });
}

async function syncDeparture(event: { userId?: number | string; userID?: number | string }) {
  const userId = Number(event.userId ?? event.userID);
  const customerKey = customerKeysByUserId.get(userId);
  if (!customerKey || !Number.isSafeInteger(userId)) return;
  await jsonRequest('/api/v1/live-class/zoom/host/participants', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken() },
    body: JSON.stringify({
      occurrence_key: occurrenceKey,
      participants: [
        {
          customer_key: customerKey,
          provider_user_id: String(userId),
          join_state: 'left',
          audio_state: 'unknown',
          video_state: 'off',
          active_speaker: false,
          spotlighted: false,
        },
      ],
    }),
  }).catch(() => undefined);
  participantIds.delete(customerKey);
  customerKeysByUserId.delete(userId);
}

function sdkKeyFromSignature(signature: string) {
  const encoded = signature.split('.')[1];
  if (!encoded) throw new Error('Meeting SDK signature is invalid.');
  const base64 = encoded
    .replaceAll('-', '+')
    .replaceAll('_', '/')
    .padEnd(encoded.length + ((4 - (encoded.length % 4)) % 4), '=');
  const payload = JSON.parse(atob(base64)) as { sdkKey?: string };
  if (!payload.sdkKey) throw new Error('Meeting SDK signature is invalid.');
  return payload.sdkKey;
}

function sdkErrorSummary(error: unknown) {
  if (!error || typeof error !== 'object') return 'code unknown';
  const record = error as {
    errorCode?: unknown;
    error_code?: unknown;
    reason?: unknown;
    errorMessage?: unknown;
    message?: unknown;
  };
  const value = record.errorCode ?? record.error_code;
  const normalized = String(value ?? '')
    .replace(/[^a-z0-9_-]/gi, '')
    .slice(0, 32);
  const reason = String(record.reason ?? record.errorMessage ?? record.message ?? '')
    .replace(/https?:\/\/\S+/gi, '[redacted]')
    .replace(/\b\d{6,}\b/g, '[redacted]')
    .replace(/\b(zak|token|pass(?:word|code)?)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
  return reason ? `code ${normalized || 'unknown'}: ${reason}` : `code ${normalized || 'unknown'}`;
}

async function report(
  command: ZoomCommand,
  status: 'executed' | 'failed' | 'rejected',
  result: string,
) {
  await jsonRequest('/api/v1/live-class/zoom/host/commands/report', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken() },
    body: JSON.stringify({
      command_key: command.command_key,
      nonce: command.nonce,
      signature: command.signature,
      status,
      result,
    }),
  }).catch(() => undefined);
}

async function invokeZoom(
  zoom: ZoomApi,
  method: 'mute' | 'operateSpotlight',
  options: Record<string, unknown>,
) {
  await new Promise<void>((resolve, reject) => {
    zoom[method]({
      ...options,
      success: () => resolve(),
      error: () => reject(new Error('Meeting SDK rejected the live control.')),
    });
  });
}

async function executeCommand(zoom: ZoomApi, command: ZoomCommand) {
  const customerKey = command.target_participant_key
    ? participantKeys.get(command.target_participant_key)
    : undefined;
  const userId = customerKey ? participantIds.get(customerKey) : undefined;
  if (!userId) {
    await report(command, 'rejected', 'target_not_mapped');
    return;
  }
  try {
    if (command.command_type === 'ask_unmute') {
      await invokeZoom(zoom, 'mute', { userId, mute: false });
      await report(command, 'executed', 'participant_unmute_prompt_requested');
    } else if (command.command_type === 'mute') {
      await invokeZoom(zoom, 'mute', { userId, mute: true });
      await report(command, 'executed', 'participant_muted');
    } else if (command.command_type === 'spotlight_replace') {
      await invokeZoom(zoom, 'operateSpotlight', { userId, action: 'spotlight' });
      await report(command, 'executed', 'spotlight_replaced');
    } else if (command.command_type === 'spotlight_remove') {
      await invokeZoom(zoom, 'operateSpotlight', { userId, action: 'unspotlight' });
      await report(command, 'executed', 'spotlight_removed');
    } else {
      await report(command, 'rejected', 'participant_consent_required');
    }
  } catch {
    await report(command, 'failed', 'meeting_sdk_control_failed');
  }
  await syncRoster(zoom);
}

async function pollCommands(zoom: ZoomApi) {
  const response = await jsonRequest<{ success: true; data: { commands: ZoomCommand[] } }>(
    `/api/v1/live-class/zoom/host/commands?occurrence_key=${encodeURIComponent(occurrenceKey)}`,
  ).catch(() => null);
  for (const command of response?.data.commands ?? []) await executeCommand(zoom, command);
  pollTimer = window.setTimeout(() => void pollCommands(zoom), 1200);
}

async function start() {
  try {
    const bootstrap = await jsonRequest<{
      success: true;
      data: {
        occurrence_key: string;
        sdk_web_version: string;
        meeting_number: string;
        signature: string;
        password: string;
        zak: string;
        user_name: string;
        leave_url: string;
        video_start_model: 'PARTICIPANT_CONSENT';
      };
    }>('/api/v1/live-class/zoom/host/bootstrap');
    occurrenceKey = bootstrap.data.occurrence_key;
    const zoom = await loadMeetingSdk(bootstrap.data.sdk_web_version);
    const refresh = () => void syncRoster(zoom);
    for (const event of ['onUserJoin', 'onUserUpdate', 'onActiveSpeaker']) {
      zoom.inMeetingServiceListener(event, refresh);
    }
    zoom.inMeetingServiceListener(
      'onUserLeave',
      (event: unknown) =>
        void syncDeparture(event as { userId?: number | string; userID?: number | string }),
    );
    await new Promise<void>((resolve, reject) => {
      zoom.init({
        leaveUrl: bootstrap.data.leave_url,
        patchJsMedia: true,
        leaveOnPageUnload: true,
        success: () => {
          zoom.join({
            sdkKey: sdkKeyFromSignature(bootstrap.data.signature),
            signature: bootstrap.data.signature,
            meetingNumber: bootstrap.data.meeting_number,
            passWord: bootstrap.data.password,
            userName: bootstrap.data.user_name,
            zak: bootstrap.data.zak,
            success: () => resolve(),
            error: (error: unknown) =>
              reject(new Error(`Meeting SDK host join was rejected (${sdkErrorSummary(error)}).`)),
          });
        },
        error: (error: unknown) =>
          reject(new Error(`Meeting SDK host initialization failed (${sdkErrorSummary(error)}).`)),
      });
    });
    setStatus('Protected host joined. Participant consent remains required for camera and unmute.');
    await syncRoster(zoom);
    await pollCommands(zoom);
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : 'Meeting SDK host control is unavailable.',
      error instanceof Error && error.message.includes('not configured')
        ? 'provider-off'
        : 'failed',
    );
  }
}

window.addEventListener('beforeunload', () => {
  if (pollTimer) window.clearTimeout(pollTimer);
});

void start();
