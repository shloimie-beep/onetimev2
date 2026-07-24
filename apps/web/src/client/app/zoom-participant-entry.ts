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

const statusElement = document.querySelector<HTMLElement>('[data-zoom-participant-status]');

function setStatus(message: string, state: 'joining' | 'joined' | 'failed') {
  if (statusElement) statusElement.textContent = message;
  document.documentElement.dataset.zoomParticipantState = state;
}

async function jsonRequest<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin' });
  const body = (await response.json()) as T & { message?: string };
  if (!response.ok) throw new Error(body.message ?? 'Protected Zoom participant request failed.');
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

function studentNumber() {
  const match = location.pathname.match(/\/zoom-participant\/(1|2|3)$/);
  if (!match) throw new Error('Fictional student reference is invalid.');
  return Number(match[1]);
}

async function start() {
  try {
    const number = studentNumber();
    const bootstrap = await jsonRequest<{
      success: true;
      data: {
        sdk_web_version: string;
        meeting_number: string;
        signature: string;
        password: string;
        customer_key: string;
        user_name: string;
        leave_url: string;
        video_start_model: 'PARTICIPANT_CONSENT';
      };
    }>(`/api/v1/live-class/zoom/participant/bootstrap?student=${number}`);
    const zoom = await loadMeetingSdk(bootstrap.data.sdk_web_version);
    setStatus('Joining the isolated test meeting.', 'joining');
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
            customerKey: bootstrap.data.customer_key,
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
    setStatus(
      'Joined. Use Zoom controls to unmute or start video; One Time never turns the camera on silently.',
      'joined',
    );
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Meeting SDK join failed.', 'failed');
  }
}

void start();
