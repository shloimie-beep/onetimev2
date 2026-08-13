export type ProductionBasicLaunchArtifact = {
  mode: 'production_basic';
  role: 0 | 1;
  sdk_web_version: string;
  meeting_number: string;
  meeting_password: string;
  signature: string;
  user_name: string;
  leave_path: '/app/student' | '/app/live-console';
  issued_at: string;
  expires_at: string;
  zak?: string;
  raw_join_url_present: false;
  video_start_model: 'PARTICIPANT_CONSENT';
};

export async function readProductionBasicReadiness(csrfToken: string): Promise<boolean> {
  const response = await fetch('/api/v1/classroom/production-basic/status', {
    credentials: 'same-origin',
    headers: { 'x-csrf-token': csrfToken },
  });
  const payload = (await response.json()) as { success?: boolean; data?: { available?: boolean } };
  return response.ok && payload.success === true && payload.data?.available === true;
}

/** Call only from an explicit Join or Start control. It never runs on navigation. */
export async function requestProductionBasicLaunch(csrfToken: string) {
  const response = await fetch('/api/v1/classroom/production-basic/launch', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'x-csrf-token': csrfToken },
  });
  const payload = (await response.json()) as
    | { success: true; data: { launch_artifact: ProductionBasicLaunchArtifact } }
    | { success: false; message?: string };
  if (!response.ok || payload.success !== true) {
    throw new Error('Classroom is unavailable.');
  }
  if (payload.data.launch_artifact.raw_join_url_present) {
    throw new Error('Classroom launch response is invalid.');
  }
  return payload.data.launch_artifact;
}

/** Confirm only after the host Meeting SDK join promise has resolved. */
export async function confirmProductionBasicHostLive(csrfToken: string): Promise<void> {
  const response = await fetch('/api/v1/classroom/production-basic/host-live', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'x-csrf-token': csrfToken },
  });
  const payload = (await response.json()) as
    { success: true; data: { state: 'live' } } | { success: false; message?: string };
  if (!response.ok || payload.success !== true || payload.data.state !== 'live') {
    throw new Error('Live class status could not be confirmed.');
  }
}

export async function clearProductionBasicHostLive(csrfToken: string): Promise<void> {
  const response = await fetch('/api/v1/classroom/production-basic/host-ended', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'x-csrf-token': csrfToken },
  });
  const payload = (await response.json()) as
    { success: true; data: { state: 'scheduled' } } | { success: false; message?: string };
  if (!response.ok || payload.success !== true || payload.data.state !== 'scheduled') {
    throw new Error('Live class status could not be cleared.');
  }
}

/** Couples the durable live receipt to the real Meeting SDK lifecycle. */
export async function startAndConfirmProductionBasicHostLive(input: {
  csrfToken: string;
  startMeeting: (onMeetingStatus: (status: 1 | 2 | 3 | 4) => void) => Promise<void>;
  confirm?: ((csrfToken: string) => Promise<void>) | undefined;
  clear?: ((csrfToken: string) => Promise<void>) | undefined;
}): Promise<void> {
  const confirm = input.confirm ?? confirmProductionBasicHostLive;
  const clear = input.clear ?? clearProductionBasicHostLive;
  let confirmed = false;
  let disconnected = false;
  let clearPromise: Promise<void> | null = null;

  const clearConfirmedReceipt = () => {
    if (!confirmed || clearPromise) return;
    clearPromise = clear(input.csrfToken).catch(() => undefined);
  };

  await input.startMeeting((status) => {
    if (status !== 3) return;
    disconnected = true;
    clearConfirmedReceipt();
  });
  if (disconnected) throw new Error('Meeting disconnected before live status was confirmed.');

  await confirm(input.csrfToken);
  confirmed = true;
  if (disconnected) {
    clearConfirmedReceipt();
    await clearPromise;
    throw new Error('Meeting disconnected while live status was being confirmed.');
  }
}
