import { sdkErrorSummary } from './zoom-sdk-safety.ts';

export type ZoomMeetingSdkApi = Record<
  'setZoomJSLib' | 'preLoadWasm' | 'prepareWebSDK' | 'inMeetingServiceListener' | 'init' | 'join',
  (...args: unknown[]) => unknown
> & {
  endMeeting?: (...args: unknown[]) => unknown;
  removeInMeetingServiceListener?: (...args: unknown[]) => unknown;
};

declare global {
  interface Window {
    ZoomMtg?: Record<string, (...args: never[]) => unknown>;
  }
}

export type ZoomParticipantJoinInput = {
  sdkWebVersion: string;
  meetingNumber: string;
  signature: string;
  meetingPassword: string;
  registrantToken?: string;
  userEmail?: string;
  customerKey?: string;
  zak?: string;
  disablePreview?: boolean;
  userName: string;
  leaveUrl: string;
  onMeetingStatus?: ((status: ZoomMeetingStatus) => void) | undefined;
};

export type ZoomMeetingStatus = 1 | 2 | 3 | 4;

const meetingSdkByVersion = new Map<string, Promise<ZoomMeetingSdkApi>>();
let activeHostMeetingSdk: ZoomMeetingSdkApi | null = null;

export async function joinZoomMeetingParticipant(input: ZoomParticipantJoinInput) {
  const zoom = await loadMeetingSdk(input.sdkWebVersion);
  await joinZoomMeetingParticipantWithApi(zoom, input);
}

export function joinZoomMeetingParticipantWithApi(
  zoom: ZoomMeetingSdkApi,
  input: ZoomParticipantJoinInput,
) {
  return new Promise<void>((resolve, reject) => {
    let connected = false;
    let settled = false;
    let active = true;

    function cleanupListener() {
      if (!active) return;
      active = false;
      if (input.onMeetingStatus && typeof window !== 'undefined') {
        window.removeEventListener('pagehide', handlePageHide);
      }
      try {
        zoom.removeInMeetingServiceListener?.('onMeetingStatus', handleMeetingStatus);
      } catch {
        // The local active guard remains authoritative when removal is unavailable.
      }
    }
    function handlePageHide() {
      cleanupListener();
    }
    const clearConnectionTimeout = () => {
      globalThis.clearTimeout(connectionTimeout);
    };
    const settleConnected = () => {
      if (settled) return;
      connected = true;
      if (input.zak) activeHostMeetingSdk = zoom;
      settled = true;
      clearConnectionTimeout();
      if (!input.onMeetingStatus) cleanupListener();
      resolve();
    };
    const settleError = (error: Error) => {
      if (settled) return;
      settled = true;
      clearConnectionTimeout();
      cleanupListener();
      reject(error);
    };
    const notifyMeetingStatus = (status: ZoomMeetingStatus) => {
      try {
        input.onMeetingStatus?.(status);
      } catch {
        // Consumer telemetry must not interrupt the SDK connection lifecycle.
      }
    };
    const handleMeetingStatus = (event: unknown) => {
      if (!active) return;
      const status = meetingStatusFromEvent(event);
      if (status === null) return;
      if (status === 2) {
        notifyMeetingStatus(status);
        settleConnected();
      } else if (status === 3 && !connected) {
        notifyMeetingStatus(status);
        settleError(new Error('Meeting SDK disconnected before the meeting was connected.'));
      } else if (status === 3) {
        notifyMeetingStatus(status);
        if (activeHostMeetingSdk === zoom) activeHostMeetingSdk = null;
        cleanupListener();
      } else {
        notifyMeetingStatus(status);
      }
    };

    const connectionTimeout = globalThis.setTimeout(() => {
      settleError(new Error('Meeting SDK connection timed out.'));
    }, 45_000);
    if (input.onMeetingStatus && typeof window !== 'undefined') {
      window.addEventListener('pagehide', handlePageHide, { once: true });
    }
    try {
      zoom.inMeetingServiceListener('onMeetingStatus', handleMeetingStatus);
      zoom.init({
        leaveUrl: input.leaveUrl,
        patchJsMedia: true,
        leaveOnPageUnload: true,
        disableCORP: !window.crossOriginIsolated,
        disablePreview: input.disablePreview ?? false,
        success: () => {
          if (settled) return;
          try {
            zoom.join({
              signature: input.signature,
              meetingNumber: input.meetingNumber,
              passWord: input.meetingPassword,
              ...(input.registrantToken ? { tk: input.registrantToken } : {}),
              ...(input.userEmail ? { userEmail: input.userEmail } : {}),
              userName: input.userName,
              ...(input.customerKey ? { customerKey: input.customerKey } : {}),
              ...(input.zak ? { zak: input.zak } : {}),
              success: () => undefined,
              error: (error: unknown) => {
                settleError(
                  new Error(
                    `Meeting SDK participant join was rejected (${sdkErrorSummary(error)}).`,
                  ),
                );
              },
            });
          } catch (error) {
            settleError(
              new Error(`Meeting SDK participant join failed (${sdkErrorSummary(error)}).`),
            );
          }
        },
        error: (error: unknown) => {
          settleError(
            new Error(`Meeting SDK participant initialization failed (${sdkErrorSummary(error)}).`),
          );
        },
      });
    } catch (error) {
      settleError(new Error(`Meeting SDK setup failed (${sdkErrorSummary(error)}).`));
    }
  });
}

/** Calls the Meeting SDK host control only for the active host session. */
export async function endActiveZoomMeetingForAll() {
  const zoom = activeHostMeetingSdk;
  if (!zoom?.endMeeting) throw new Error('Protected class end is unavailable.');
  const endMeeting = zoom.endMeeting;
  await new Promise<void>((resolve, reject) => {
    try {
      endMeeting({
        success: () => resolve(),
        error: () => reject(new Error('Protected class end was not confirmed.')),
      });
    } catch {
      reject(new Error('Protected class end was not confirmed.'));
    }
  });
}
export function joinZoomMeetingProductionBasic(
  input: Omit<
    ZoomParticipantJoinInput,
    'registrantToken' | 'userEmail' | 'customerKey' | 'disablePreview'
  >,
) {
  return joinZoomMeetingParticipant({ ...input, disablePreview: true });
}

export function startZoomMeetingProductionBasic(
  input: Omit<
    ZoomParticipantJoinInput,
    'registrantToken' | 'userEmail' | 'customerKey' | 'disablePreview'
  > & {
    zak: string;
  },
) {
  return joinZoomMeetingParticipant({ ...input, disablePreview: true });
}

async function loadMeetingSdk(version: string) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error('Meeting SDK version is invalid.');
  }
  const existing = meetingSdkByVersion.get(version);
  if (existing) return existing;
  const loading = initializeMeetingSdk(version).catch((error: unknown) => {
    meetingSdkByVersion.delete(version);
    throw error;
  });
  meetingSdkByVersion.set(version, loading);
  return loading;
}

async function initializeMeetingSdk(version: string) {
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
  const zoom = window.ZoomMtg as ZoomMeetingSdkApi | undefined;
  if (!zoom) throw new Error('Meeting SDK did not initialize.');
  zoom.setZoomJSLib(`${base}/lib`, '/av');
  zoom.preLoadWasm();
  zoom.prepareWebSDK();
  return zoom;
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

function meetingStatusFromEvent(event: unknown): ZoomMeetingStatus | null {
  if (!event || typeof event !== 'object') return null;
  const rawStatus =
    (event as { status?: unknown; meetingStatus?: unknown }).status ??
    (event as { meetingStatus?: unknown }).meetingStatus;
  return rawStatus === 1 || rawStatus === 2 || rawStatus === 3 || rawStatus === 4
    ? rawStatus
    : null;
}
