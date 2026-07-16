type ClassroomSdkPayload = {
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
  renderDeterministicSdkPanel(data, sdkRoot);
  await postAttendance(data.attempt_key, 'sdk_joined', data.provider.state);
}

function renderDeterministicSdkPanel(data: ClassroomSdkPayload, sdkRoot: HTMLElement | null) {
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
