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
  let keepaliveLeavePromise: Promise<void> | null = null;
  let leaveRecorded = false;
  let disconnectRequested = false;
  let disconnectKeepalive = false;

  const recordLeave = (): Promise<void> => {
    if (!joinPromise || leaveRecorded) return Promise.resolve();
    const keepalive = disconnectKeepalive;
    const existing = keepalive ? keepaliveLeavePromise : (leavePromise ?? keepaliveLeavePromise);
    if (existing) return existing;

    const attempt = joinPromise
      .then(() =>
        record(input.csrfToken, input.attendanceSessionKey, 'left', {
          keepalive,
        }),
      )
      .then(() => {
        leaveRecorded = true;
      });
    const guarded = attempt.catch((error: unknown) => {
      if (keepalive) {
        if (keepaliveLeavePromise === guarded) keepaliveLeavePromise = null;
      } else if (leavePromise === guarded) {
        leavePromise = null;
      }
      throw error;
    });
    if (keepalive) keepaliveLeavePromise = guarded;
    else leavePromise = guarded;
    return guarded;
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

export class ProductionBasicEndOutcomeUnknownError extends Error {
  readonly code = 'PRODUCTION_BASIC_END_OUTCOME_UNKNOWN';

  constructor() {
    super('Class end outcome is unknown. Refresh status before any further End class action.');
    this.name = 'ProductionBasicEndOutcomeUnknownError';
  }
}

export type ProductionBasicEndActionPolicy = {
  disabled: boolean;
  mode: 'end_available' | 'ending' | 'outcome_unknown' | 'cleanup_pending';
};

export function productionBasicEndActionPolicy(input: {
  busy: boolean;
  outcomeUnknown: boolean;
  cleanupPending: boolean;
}): ProductionBasicEndActionPolicy {
  if (input.busy) return { disabled: true, mode: 'ending' };
  if (input.outcomeUnknown) return { disabled: true, mode: 'outcome_unknown' };
  if (input.cleanupPending) return { disabled: false, mode: 'cleanup_pending' };
  return { disabled: false, mode: 'end_available' };
}

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
  onProviderEndConfirmed?: (() => void) | undefined;
  onEndReconciled?: (() => void) | undefined;
}): Promise<ProductionBasicHostLiveController> {
  const confirm = input.confirm ?? confirmProductionBasicHostLive;
  const clear = input.clear ?? clearProductionBasicHostLive;
  let confirmed = false;
  let disconnected = false;
  let clearPromise: Promise<void> | null = null;
  let providerEndDisposition: 'not_attempted' | 'unknown' | 'confirmed_ended' = 'not_attempted';
  let ended = false;
  let providerEndConfirmedNotified = false;
  let endReconciledNotified = false;
  const providerEndIsConfirmed = () => providerEndDisposition === 'confirmed_ended';

  const markProviderEndConfirmed = () => {
    providerEndDisposition = 'confirmed_ended';
    if (providerEndConfirmedNotified) return;
    providerEndConfirmedNotified = true;
    try {
      input.onProviderEndConfirmed?.();
    } catch {
      // UI notification must never turn provider confirmation back into an unknown effect.
    }
  };

  const clearConfirmedReceipt = (keepalive: boolean) => {
    if (!confirmed) return null;
    if (clearPromise) return clearPromise;
    const attempt = clear(input.csrfToken, { keepalive }).then(() => {
      if (endReconciledNotified) return;
      endReconciledNotified = true;
      try {
        input.onEndReconciled?.();
      } catch {
        // UI notification must never turn a confirmed receipt clear back into a failure.
      }
    });
    clearPromise = attempt;
    void attempt.catch(() => {
      if (clearPromise === attempt) clearPromise = null;
    });
    return clearPromise;
  };

  const meeting = await input.startMeeting((status) => {
    if (status !== 3) return;
    disconnected = true;
    markProviderEndConfirmed();
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
    if (providerEndDisposition === 'confirmed_ended') {
      void clearConfirmedReceipt(true)?.catch(() => undefined);
      return;
    }
    providerEndDisposition = 'unknown';
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
      if (providerEndDisposition === 'unknown') {
        throw new ProductionBasicEndOutcomeUnknownError();
      }
      if (providerEndDisposition === 'not_attempted') {
        // The provider call may have taken effect even when its callback rejects or times out.
        // Mark it unknown before invoking the external mutation so no second call can be sent.
        providerEndDisposition = 'unknown';
        try {
          await meeting.endMeeting();
        } catch {
          if (!providerEndIsConfirmed()) {
            throw new ProductionBasicEndOutcomeUnknownError();
          }
        }
        markProviderEndConfirmed();
      }
      await clearConfirmedReceipt(false);
      ended = true;
      removePageHide();
    },
    dispose() {
      removePageHide();
      if (ended) return;
      if (providerEndDisposition === 'confirmed_ended') {
        void clearConfirmedReceipt(true)?.catch(() => undefined);
        return;
      }
      providerEndDisposition = 'unknown';
    },
  };
}
