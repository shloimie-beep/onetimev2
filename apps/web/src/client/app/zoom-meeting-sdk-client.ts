import { sdkErrorSummary } from './zoom-sdk-safety.ts';

type ZoomApi = Record<
  'setZoomJSLib' | 'preLoadWasm' | 'prepareWebSDK' | 'init' | 'join',
  (...args: unknown[]) => unknown
>;

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
  userName: string;
  leaveUrl: string;
};

const meetingSdkByVersion = new Map<string, Promise<ZoomApi>>();

export async function joinZoomMeetingParticipant(input: ZoomParticipantJoinInput) {
  const zoom = await loadMeetingSdk(input.sdkWebVersion);
  await new Promise<void>((resolve, reject) => {
    zoom.init({
      leaveUrl: input.leaveUrl,
      patchJsMedia: true,
      leaveOnPageUnload: true,
      success: () => {
        zoom.join({
          sdkKey: sdkKeyFromSignature(input.signature),
          signature: input.signature,
          meetingNumber: input.meetingNumber,
          passWord: input.meetingPassword,
          ...(input.registrantToken ? { tk: input.registrantToken } : {}),
          ...(input.userEmail ? { userEmail: input.userEmail } : {}),
          userName: input.userName,
          ...(input.customerKey ? { customerKey: input.customerKey } : {}),
          ...(input.zak ? { zak: input.zak } : {}),
          success: () => resolve(),
          error: (error: unknown) =>
            reject(
              new Error(`Meeting SDK participant join was rejected (${sdkErrorSummary(error)}).`),
            ),
        });
      },
      error: (error: unknown) =>
        reject(
          new Error(`Meeting SDK participant initialization failed (${sdkErrorSummary(error)}).`),
        ),
    });
  });
}

export function joinZoomMeetingProductionBasic(
  input: Omit<ZoomParticipantJoinInput, 'registrantToken' | 'userEmail' | 'customerKey'>,
) {
  return joinZoomMeetingParticipant(input);
}

export function startZoomMeetingProductionBasic(
  input: Omit<ZoomParticipantJoinInput, 'registrantToken' | 'userEmail' | 'customerKey'> & {
    zak: string;
  },
) {
  return joinZoomMeetingParticipant(input);
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
  const zoom = window.ZoomMtg as ZoomApi | undefined;
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

function sdkKeyFromSignature(signature: string) {
  const encoded = signature.split('.')[1];
  if (!encoded) throw new Error('Meeting SDK signature is invalid.');
  try {
    const base64 = encoded
      .replaceAll('-', '+')
      .replaceAll('_', '/')
      .padEnd(encoded.length + ((4 - (encoded.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(base64)) as { sdkKey?: unknown };
    if (typeof payload.sdkKey !== 'string' || payload.sdkKey.length < 1) {
      throw new Error('invalid sdk key');
    }
    return payload.sdkKey;
  } catch {
    throw new Error('Meeting SDK signature is invalid.');
  }
}
