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
