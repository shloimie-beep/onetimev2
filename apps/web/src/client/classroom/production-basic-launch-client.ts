type ProductionBasicArtifactBase = {
  mode: 'production_basic';
  sdk_web_version: string;
  meeting_number: string;
  meeting_password: string;
  signature: string;
  user_name: string;
  issued_at: string;
  expires_at: string;
  raw_join_url_present: false;
  video_start_model: 'PARTICIPANT_CONSENT';
};

export type StudentProductionBasicLaunchArtifact = ProductionBasicArtifactBase & {
  role: 0;
  leave_path: '/app/student';
  zak?: never;
};

export type HostProductionBasicLaunchArtifact = ProductionBasicArtifactBase & {
  role: 1;
  leave_path: '/app/live-console';
  zak: string;
};

export const PRODUCTION_BASIC_END_COMMAND_DEADLINE_MS = 10_000;
export const PRODUCTION_BASIC_END_CONFIRMATION_DEADLINE_MS = 30_000;

const STUDENT_ENDPOINT = '/api/v1/portals/student/classroom/production-basic' as const;
const HOST_ENDPOINT = '/api/v1/admin/classroom/production-basic' as const;

export async function readStudentProductionBasicReadiness(csrfToken: string): Promise<boolean> {
  return readReadiness(`${STUDENT_ENDPOINT}/status`, csrfToken);
}

export async function readHostProductionBasicReadiness(csrfToken: string): Promise<boolean> {
  return readReadiness(`${HOST_ENDPOINT}/status`, csrfToken);
}

export async function requestStudentProductionBasicLaunch(
  csrfToken: string,
): Promise<StudentProductionBasicLaunchArtifact> {
  const artifact = await requestArtifact(`${STUDENT_ENDPOINT}/launch`, csrfToken);
  if (!isStudentProductionBasicLaunchArtifact(artifact)) throw invalidLaunchResponse();
  return artifact;
}

export async function requestHostProductionBasicLaunch(
  csrfToken: string,
): Promise<HostProductionBasicLaunchArtifact> {
  const artifact = await requestArtifact(`${HOST_ENDPOINT}/launch`, csrfToken);
  if (!isHostProductionBasicLaunchArtifact(artifact)) throw invalidLaunchResponse();
  return artifact;
}

/** Confirm only after the host Meeting SDK join promise has resolved. */
export async function confirmProductionBasicHostLive(csrfToken: string): Promise<string> {
  const response = await fetch(`${HOST_ENDPOINT}/host-live`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'x-csrf-token': csrfToken },
  });
  const payload = (await response.json()) as
    | { success: true; data: { state: 'live'; lifecycle_context?: string } }
    | { success: false; message?: string };
  if (
    !response.ok ||
    payload.success !== true ||
    payload.data.state !== 'live' ||
    !payload.data.lifecycle_context
  ) {
    throw new Error('Live class status could not be confirmed.');
  }
  return payload.data.lifecycle_context;
}

export async function readProductionBasicHostEndStatus(
  csrfToken: string,
  lifecycleContext: string,
): Promise<{
  state: ProductionBasicHostEndState;
  lifecycleContext: string;
}> {
  const response = await fetch(`${HOST_ENDPOINT}/host-end-status`, {
    credentials: 'same-origin',
    headers: {
      'x-csrf-token': csrfToken,
      'x-ot-production-basic-lifecycle': lifecycleContext,
    },
  });
  const payload = (await response.json()) as {
    success?: boolean;
    data?: { state?: ProductionBasicHostEndState; lifecycle_context?: string };
  };
  if (
    !response.ok ||
    payload.success !== true ||
    !payload.data?.state ||
    !payload.data.lifecycle_context
  ) {
    throw new Error('Class end status is unavailable.');
  }
  return {
    state: payload.data.state === 'end_requested' ? 'ending' : payload.data.state,
    lifecycleContext: payload.data.lifecycle_context,
  };
}

export async function reconcileProductionBasicHostEnd(
  csrfToken: string,
  lifecycleContext: string,
): Promise<ProductionBasicHostEndState> {
  return postHostEndState(csrfToken, lifecycleContext, 'host-end-reconcile');
}

async function postHostEndState(
  csrfToken: string,
  lifecycleContext: string,
  path: 'host-end-attempt' | 'host-end-unknown' | 'host-end-reconcile' | 'host-ended',
) {
  const response = await fetch(`${HOST_ENDPOINT}/${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'x-csrf-token': csrfToken, 'x-ot-production-basic-lifecycle': lifecycleContext },
  });
  const payload = (await response.json()) as {
    success?: boolean;
    data?: { state?: ProductionBasicHostEndState };
  };
  if (!response.ok || payload.success !== true || !payload.data?.state)
    throw new Error('Class end state could not be saved.');
  return payload.data.state;
}

export type ProductionBasicHostEndState =
  | 'starting'
  | 'live'
  | 'end_requested'
  | 'ending'
  | 'unknown_effect'
  | 'provider_ended'
  | 'cleanup_pending'
  | 'ended';

/**
 * Keeps the provider-first End Class operation bounded to one SDK call. The
 * durable receipt is cleared only after the server correlates verified provider proof.
 */
export function createProductionBasicHostEndController(input: {
  endMeetingForAll: () => Promise<void>;
  csrfToken: string;
  lifecycleContext: string;
  beginEnd?:
    | ((csrfToken: string, lifecycleContext: string) => Promise<ProductionBasicHostEndState>)
    | undefined;
  markUnknown?:
    | ((csrfToken: string, lifecycleContext: string) => Promise<ProductionBasicHostEndState>)
    | undefined;
  reconcile?:
    | ((csrfToken: string, lifecycleContext: string) => Promise<ProductionBasicHostEndState>)
    | undefined;
  clear?:
    | ((csrfToken: string, lifecycleContext: string) => Promise<ProductionBasicHostEndState>)
    | undefined;
  schedule?: ((callback: () => void, delay: number) => ReturnType<typeof setTimeout>) | undefined;
  cancel?: ((timer: ReturnType<typeof setTimeout>) => void) | undefined;
  onStateChange?: ((state: ProductionBasicHostEndState) => void) | undefined;
}) {
  const beginEnd =
    input.beginEnd ?? ((csrf, context) => postHostEndState(csrf, context, 'host-end-attempt'));
  const markUnknown =
    input.markUnknown ?? ((csrf, context) => postHostEndState(csrf, context, 'host-end-unknown'));
  const reconcile = input.reconcile ?? reconcileProductionBasicHostEnd;
  const clear = input.clear ?? ((csrf, context) => postHostEndState(csrf, context, 'host-ended'));
  const schedule = input.schedule ?? ((callback, delay) => setTimeout(callback, delay));
  const cancel = input.cancel ?? ((timer) => clearTimeout(timer));
  let state: ProductionBasicHostEndState = 'starting';
  let providerEndRequested = false;
  let providerEnded = false;
  let cleanupRunning = false;
  let commandTimer: ReturnType<typeof setTimeout> | null = null;
  let confirmationTimer: ReturnType<typeof setTimeout> | null = null;

  const clearTimers = () => {
    if (commandTimer) cancel(commandTimer);
    if (confirmationTimer) cancel(confirmationTimer);
    commandTimer = null;
    confirmationTimer = null;
  };
  const unknown = async () => {
    if (state === 'ended' || state === 'cleanup_pending' || state === 'provider_ended') return;
    clearTimers();
    try {
      await markUnknown(input.csrfToken, input.lifecycleContext);
    } finally {
      setState('unknown_effect');
    }
  };

  const setState = (next: ProductionBasicHostEndState) => {
    state = next;
    input.onStateChange?.(next);
  };
  const clearAfterProviderConfirmation = async () => {
    if (!providerEnded || cleanupRunning || state === 'starting' || state === 'ended') return;
    cleanupRunning = true;
    try {
      await clear(input.csrfToken, input.lifecycleContext);
      setState('ended');
    } catch {
      setState('cleanup_pending');
    } finally {
      cleanupRunning = false;
    }
  };

  return {
    get state() {
      return state;
    },
    async markLive() {
      if (state !== 'starting') return;
      setState('live');
      await clearAfterProviderConfirmation();
    },
    restore(restored: ProductionBasicHostEndState) {
      if (state !== 'starting') return;
      providerEnded =
        restored === 'provider_ended' || restored === 'cleanup_pending' || restored === 'ended';
      setState(restored);
    },
    async requestEnd() {
      if (state !== 'live') return;
      providerEndRequested = true;
      setState('ending');
      try {
        await beginEnd(input.csrfToken, input.lifecycleContext);
      } catch {
        await unknown();
        return;
      }
      commandTimer = schedule(() => void unknown(), PRODUCTION_BASIC_END_COMMAND_DEADLINE_MS);
      void input
        .endMeetingForAll()
        .then(() => {
          // A status 3 callback can arrive before the SDK resolves its End
          // callback. Once that proof has arrived, no deadline may overwrite it.
          if (state !== 'ending' || providerEnded) return;
          if (commandTimer) cancel(commandTimer);
          commandTimer = null;
          confirmationTimer = schedule(
            () => void unknown(),
            PRODUCTION_BASIC_END_CONFIRMATION_DEADLINE_MS,
          );
        })
        .catch(() => void unknown());
    },
    async observeMeetingStatus(status: 1 | 2 | 3 | 4) {
      if (status !== 3) return;
      try {
        const reconciled = await reconcile(input.csrfToken, input.lifecycleContext);
        providerEnded =
          reconciled === 'provider_ended' ||
          reconciled === 'cleanup_pending' ||
          reconciled === 'ended';
        if (providerEnded) clearTimers();
        setState(reconciled === 'end_requested' ? 'ending' : reconciled);
      } catch {
        if (providerEndRequested) await unknown();
        return;
      }
    },
    async retryAccessCleanup() {
      if (state !== 'provider_ended' && state !== 'cleanup_pending') return;
      await clearAfterProviderConfirmation();
    },
    reconcileProviderEnded() {
      return providerEnded;
    },
    async reconcileProviderProof() {
      const reconciled = await reconcile(input.csrfToken, input.lifecycleContext);
      providerEnded =
        reconciled === 'provider_ended' ||
        reconciled === 'cleanup_pending' ||
        reconciled === 'ended';
      if (providerEnded) clearTimers();
      setState(reconciled === 'end_requested' ? 'ending' : reconciled);
      return state;
    },
    providerEndRequested() {
      return providerEndRequested;
    },
  };
}

export function isStudentProductionBasicLaunchArtifact(
  value: unknown,
): value is StudentProductionBasicLaunchArtifact {
  return (
    validBase(value) && value.role === 0 && value.leave_path === '/app/student' && !('zak' in value)
  );
}

export function isHostProductionBasicLaunchArtifact(
  value: unknown,
): value is HostProductionBasicLaunchArtifact {
  return (
    validBase(value) &&
    value.role === 1 &&
    value.leave_path === '/app/live-console' &&
    typeof value.zak === 'string' &&
    value.zak.trim().length > 0
  );
}

async function readReadiness(endpoint: string, csrfToken: string) {
  const response = await fetch(endpoint, {
    credentials: 'same-origin',
    headers: { 'x-csrf-token': csrfToken },
  });
  const payload = (await response.json()) as { success?: boolean; data?: { available?: boolean } };
  return response.ok && payload.success === true && payload.data?.available === true;
}

async function requestArtifact(endpoint: string, csrfToken: string): Promise<unknown> {
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'x-csrf-token': csrfToken },
  });
  const payload = (await response.json()) as
    { success: true; data: { launch_artifact: unknown } } | { success: false; message?: string };
  if (!response.ok || payload.success !== true) throw new Error('Classroom is unavailable.');
  return payload.data.launch_artifact;
}

function validBase(value: unknown): value is ProductionBasicArtifactBase & Record<string, unknown> {
  if (!isRecord(value)) return false;
  if (
    value.mode !== 'production_basic' ||
    value.raw_join_url_present !== false ||
    value.video_start_model !== 'PARTICIPANT_CONSENT'
  ) {
    return false;
  }
  return [
    'sdk_web_version',
    'meeting_number',
    'meeting_password',
    'signature',
    'user_name',
    'issued_at',
    'expires_at',
  ].every((key) => typeof value[key] === 'string' && value[key].trim().length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function invalidLaunchResponse() {
  return new Error('Classroom launch response is invalid.');
}
