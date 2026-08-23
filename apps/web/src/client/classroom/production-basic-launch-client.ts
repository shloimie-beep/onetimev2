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
export async function confirmProductionBasicHostLive(csrfToken: string): Promise<void> {
  const response = await fetch(`${HOST_ENDPOINT}/host-live`, {
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
