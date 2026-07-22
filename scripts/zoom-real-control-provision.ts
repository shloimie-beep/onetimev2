import { createHmac } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ZoomApiError, createZoomRestClient } from '../packages/domain/src/providers/zoom-rest.ts';

const keyholderDir =
  process.env.BNA_KEYHOLDER_DIR ?? path.join(process.env.USERPROFILE ?? '.', 'BNA-Keyholder');
const statePath =
  process.env.ZOOM_REAL_CONTROL_STATE_PATH ??
  path.join(keyholderDir, 'incoming', 'zoom-real-control-activation-state.json');

const [accountId, clientId, clientSecret, hostUserId, aliasDomain, aliasSecret] = await Promise.all(
  [
    protectedValue('zoom-account-id.txt'),
    protectedValue('zoom-client-id.txt'),
    protectedValue('zoom-client-secret.txt'),
    protectedValue('zoom-host-user-id.txt'),
    protectedValue('zoom-registrant-alias-domain.txt'),
    protectedValue('zoom-registrant-alias-secret.txt'),
  ],
);

const client = createZoomRestClient({
  enabled: true,
  environment: 'staging',
  credentials: { accountId, clientId, clientSecret },
  timeoutMs: 15_000,
});
type ProtectedState = {
  schema_version: 1;
  status: 'meeting_created' | 'registrants_created' | 'registration_blocked';
  registration_block_reason?: 'registration_not_enabled' | undefined;
  registration_disabled_for_sdk_join?: boolean | undefined;
  created_at: string;
  meeting_id: string;
  passcode: string;
  starts_at: string;
  registrants: Array<{
    learner_key: string;
    email: string;
    registrant_token: string;
    registrant_token_ref: string;
  }>;
};

let state: ProtectedState;
let providerMeetingRefDigest: string | undefined;
let resumedExistingMeeting = false;
if (existsSync(statePath)) {
  const parsed = JSON.parse(await readFile(statePath, 'utf8')) as ProtectedState;
  if (
    parsed.schema_version !== 1 ||
    !parsed.meeting_id ||
    !parsed.passcode ||
    !Array.isArray(parsed.registrants)
  ) {
    throw new Error('ZOOM_REAL_CONTROL_STATE_INVALID: protected state could not be resumed.');
  }
  state = parsed;
  resumedExistingMeeting = true;
} else {
  const startsAt = new Date(Math.ceil((Date.now() + 45 * 60_000) / 60_000) * 60_000);
  const created = await client.createIsolatedTestMeeting({
    hostUserId,
    startsAt,
    topic: `One Time isolated control verification ${startsAt.toISOString().slice(0, 16)}`,
    durationMinutes: 60,
  });
  providerMeetingRefDigest = created.meeting.provider_meeting_ref_digest;
  state = {
    schema_version: 1,
    status: 'meeting_created',
    created_at: new Date().toISOString(),
    meeting_id: created.meeting.meeting_id,
    passcode: created.password,
    starts_at: created.meeting.starts_at,
    registrants: [],
  };
  await persistPrivateState(state);
}

if (state.status !== 'registrants_created') {
  try {
    await client.enableMeetingRegistration(state.meeting_id);
    for (const studentNumber of [1, 2, 3]) {
      const learnerKey = `live_demo_learner_${studentNumber}`;
      if (state.registrants.some((registrant) => registrant.learner_key === learnerKey)) continue;
      const email = fictionalAlias(studentNumber, aliasDomain, aliasSecret);
      const registrant = await client.addLearnerRegistrant({
        meetingId: state.meeting_id,
        learnerKey,
        displayName: `Student ${studentNumber}`,
        email,
      });
      state.registrants.push({
        learner_key: learnerKey,
        email,
        registrant_token: registrant.registrant_token,
        registrant_token_ref: registrant.registrant_token_ref,
      });
      await persistPrivateState(state);
    }
    await client.disableMeetingRegistration(state.meeting_id);
    state.status = 'registrants_created';
    state.registration_disabled_for_sdk_join = true;
    delete state.registration_block_reason;
  } catch (error) {
    if (!(error instanceof ZoomApiError) || error.code !== 'ZOOM_404') throw error;
    state.status = 'registration_blocked';
    state.registration_block_reason = 'registration_not_enabled';
  }
  await persistPrivateState(state);
}

process.stdout.write(
  `${JSON.stringify(
    {
      meeting_created: true,
      ...(providerMeetingRefDigest
        ? { provider_meeting_ref_digest: providerMeetingRefDigest }
        : {}),
      resumed_existing_meeting: resumedExistingMeeting,
      fictional_registrant_count: state.registrants.length,
      registrants_created: state.status === 'registrants_created',
      registration_disabled_for_sdk_join: state.registration_disabled_for_sdk_join === true,
      registration_block_reason: state.registration_block_reason ?? null,
      protected_state_written: true,
      invitations_sent: false,
      raw_join_url_printed: false,
      passcode_printed: false,
      token_printed: false,
      private_destination_printed: false,
    },
    null,
    2,
  )}\n`,
);

async function protectedValue(fileName: string) {
  const value = (await readFile(path.join(keyholderDir, fileName), 'utf8')).trim();
  if (!value) throw new Error(`ZOOM_PROTECTED_INPUT_MISSING:${fileName}`);
  return value;
}

function fictionalAlias(studentNumber: number, domain: string, secret: string) {
  const suffix = createHmac('sha256', secret)
    .update(`zoom-real-control:${studentNumber}`)
    .digest('hex')
    .slice(0, 12);
  return `zoom-real-control-student-${studentNumber}-${suffix}@${domain}`;
}

async function persistPrivateState(value: typeof state) {
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}
