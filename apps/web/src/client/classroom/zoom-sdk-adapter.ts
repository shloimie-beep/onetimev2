import { joinZoomMeetingParticipant } from '../app/zoom-meeting-sdk-client.ts';

type ClassroomSdkPayload = {
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

export type ClassroomSdkAttendance = (
  attemptKey: string,
  eventType: 'sdk_join_started' | 'sdk_joined',
  clientState: string,
) => Promise<void>;

export async function startClassroomSdk(
  data: ClassroomSdkPayload,
  sdkRoot: HTMLElement | null,
  postAttendance: ClassroomSdkAttendance,
) {
  await postAttendance(data.attempt_key, 'sdk_join_started', data.selected_view);
  if (data.provider.mode === 'real') {
    if (data.provider.state !== 'ready' || data.sdk.mode !== 'real') {
      throw new Error('Classroom provider is not ready.');
    }
    await joinZoomMeetingParticipant({
      sdkWebVersion: data.sdk.sdk_web_version,
      meetingNumber: data.sdk.meeting_number,
      signature: data.sdk.signature,
      meetingPassword: data.sdk.meeting_password,
      registrantToken: data.sdk.registrant_token,
      userEmail: data.sdk.user_email,
      customerKey: data.sdk.customer_key,
      userName: data.sdk.user_display_name,
      leaveUrl: data.sdk.leave_url,
    });
    renderRealSdkPanel(sdkRoot);
  } else {
    if (data.sdk.mode !== 'sink') throw new Error('Classroom provider response is invalid.');
    renderDeterministicSdkPanel(data, sdkRoot);
  }
  await postAttendance(data.attempt_key, 'sdk_joined', data.provider.state);
}

function renderDeterministicSdkPanel(
  data: Pick<ClassroomSdkPayload, 'selected_view'>,
  sdkRoot: HTMLElement | null,
) {
  if (!sdkRoot) return;
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

function renderRealSdkPanel(sdkRoot: HTMLElement | null) {
  if (!sdkRoot) return;
  const panel = document.createElement('div');
  panel.className = 'classroom-sdk-real';
  panel.dataset.realZoomSdk = 'true';
  panel.textContent =
    'Joined the protected class. Audio and video remain under the Student’s control.';
  sdkRoot.append(panel);
}
