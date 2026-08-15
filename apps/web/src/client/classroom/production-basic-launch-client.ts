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
  attendance_session_key?: string;
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
  if (
    payload.data.launch_artifact.role === 0 &&
    !payload.data.launch_artifact.attendance_session_key
  ) {
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

export async function clearProductionBasicHostLive(
  csrfToken: string,
  options: { keepalive?: boolean } = {},
): Promise<void> {
  const response = await fetch('/api/v1/classroom/production-basic/host-ended', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'x-csrf-token': csrfToken },
    keepalive: options.keepalive ?? false,
  });
  const payload = (await response.json()) as
    { success: true; data: { state: 'scheduled' } } | { success: false; message?: string };
  if (!response.ok || payload.success !== true || payload.data.state !== 'scheduled') {
    throw new Error('Live class status could not be cleared.');
  }
}

export async function recordProductionBasicAttendance(
  csrfToken: string,
  attendanceSessionKey: string,
  eventKind: 'joined' | 'left',
  options: { keepalive?: boolean } = {},
): Promise<void> {
  const response = await fetch('/api/v1/classroom/production-basic/attendance', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
    body: JSON.stringify({
      attendance_session_key: attendanceSessionKey,
      event_kind: eventKind,
    }),
    keepalive: options.keepalive ?? false,
  });
  const payload = (await response.json()) as
    { success: true; data: { disposition: 'accepted' } } | { success: false; message?: string };
  if (!response.ok || payload.success !== true || payload.data.disposition !== 'accepted') {
    throw new Error('Class attendance could not be recorded.');
  }
}

export type ProductionBasicStudentAttendanceController = {
  connected(): Promise<void>;
  disconnected(options?: { keepalive?: boolean }): Promise<void>;
  dispose(): void;
};

export function createProductionBasicStudentAttendanceController(input: {
  csrfToken: string;
  attendanceSessionKey: string;
  record?: typeof recordProductionBasicAttendance;
}): ProductionBasicStudentAttendanceController {
  const record = input.record ?? recordProductionBasicAttendance;
  let joinPromise: Promise<void> | null = null;
  let leavePromise: Promise<void> | null = null;
  let disconnectRequested = false;
  let disconnectKeepalive = false;

  const recordLeave = () => {
    if (!joinPromise) return Promise.resolve();
    leavePromise ??= joinPromise.then(() =>
      record(input.csrfToken, input.attendanceSessionKey, 'left', {
        keepalive: disconnectKeepalive,
      }),
    );
    return leavePromise;
  };
  const handlePageHide = () => {
    disconnectRequested = true;
    disconnectKeepalive = true;
    void recordLeave().catch(() => undefined);
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', handlePageHide, { once: true });
  }
  const removePageHide = () => {
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', handlePageHide);
  };

  return {
    async connected() {
      joinPromise ??= record(input.csrfToken, input.attendanceSessionKey, 'joined');
      await joinPromise;
      if (disconnectRequested) await recordLeave();
    },
    async disconnected(options = {}) {
      disconnectRequested = true;
      disconnectKeepalive ||= options.keepalive === true;
      await recordLeave();
      removePageHide();
    },
    dispose() {
      handlePageHide();
      removePageHide();
    },
  };
}

export type ProductionBasicHostMeeting = {
  endMeeting(): Promise<void>;
};

export type ProductionBasicHostLiveController = {
  endClass(): Promise<void>;
  dispose(): void;
};

/** Couples the durable live receipt to the real Meeting SDK lifecycle. */
export async function startAndConfirmProductionBasicHostLive(input: {
  csrfToken: string;
  startMeeting: (
    onMeetingStatus: (status: 1 | 2 | 3 | 4) => void,
  ) => Promise<ProductionBasicHostMeeting>;
  confirm?: ((csrfToken: string) => Promise<void>) | undefined;
  clear?: ((csrfToken: string, options?: { keepalive?: boolean }) => Promise<void>) | undefined;
}): Promise<ProductionBasicHostLiveController> {
  const confirm = input.confirm ?? confirmProductionBasicHostLive;
  const clear = input.clear ?? clearProductionBasicHostLive;
  let confirmed = false;
  let disconnected = false;
  let clearPromise: Promise<void> | null = null;
  let providerEnded = false;
  let ended = false;

  const clearConfirmedReceipt = (keepalive: boolean) => {
    if (!confirmed) return null;
    if (clearPromise) return clearPromise;
    const attempt = clear(input.csrfToken, { keepalive });
    clearPromise = attempt;
    void attempt.catch(() => {
      if (clearPromise === attempt) clearPromise = null;
    });
    return clearPromise;
  };

  const meeting = await input.startMeeting((status) => {
    if (status !== 3) return;
    disconnected = true;
    providerEnded = true;
    void clearConfirmedReceipt(true)?.catch(() => undefined);
  });
  if (disconnected) throw new Error('Meeting disconnected before live status was confirmed.');

  await confirm(input.csrfToken);
  confirmed = true;
  if (disconnected) {
    await clearConfirmedReceipt(true);
    throw new Error('Meeting disconnected while live status was being confirmed.');
  }

  const handlePageHide = () => {
    void clearConfirmedReceipt(true)?.catch(() => undefined);
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', handlePageHide, { once: true });
  }

  const removePageHide = () => {
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', handlePageHide);
  };

  return {
    async endClass() {
      if (ended) {
        await clearConfirmedReceipt(false);
        return;
      }
      if (!providerEnded) {
        await meeting.endMeeting();
        providerEnded = true;
      }
      await clearConfirmedReceipt(false);
      ended = true;
      removePageHide();
    },
    dispose() {
      removePageHide();
      if (!ended) void clearConfirmedReceipt(true)?.catch(() => undefined);
    },
  };
}
