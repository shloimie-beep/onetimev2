import { createHmac } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ZoomApiError, createZoomRestClient } from '../packages/domain/src/providers/zoom-rest.ts';
import {
  assertZoomRealControlProvisionedState,
  assertZoomRealControlProvisionPreflight,
  buildZoomRealControlSanitizedResult,
  parseZoomRealControlProtectedState,
  ZOOM_REAL_CONTROL_STUDENT_1_LEARNER_KEY,
  type ZoomRealControlProtectedState,
} from './zoom-real-control-plan.ts';

const canary = assertZoomRealControlProvisionPreflight(process.env);
const keyholderDir =
  process.env.BNA_KEYHOLDER_DIR ?? path.join(process.env.USERPROFILE ?? '.', 'BNA-Keyholder');
const statePath =
  process.env.ZOOM_REAL_CONTROL_STATE_PATH ??
  path.join(keyholderDir, 'incoming', 'zoom-real-control-student-1-v2-state.json');
const resolvedStatePath = path.resolve(statePath);
const repositoryRoot = path.resolve(process.cwd());
if (
  resolvedStatePath === repositoryRoot ||
  resolvedStatePath.startsWith(`${repositoryRoot}${path.sep}`)
) {
  throw new Error('ZOOM_REAL_CONTROL_STATE_PATH_INVALID: protected state must stay outside Git.');
}

const [accountId, clientId, clientSecret, hostUserId, aliasDomain, aliasSecret] = await Promise.all(
  [
    protectedValue('zoom-s2s-account-id.txt'),
    protectedValue('zoom-s2s-client-id.txt'),
    protectedValue('zoom-s2s-client-secret.txt'),
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
let state: ZoomRealControlProtectedState;
let resumedExistingMeeting = false;
if (existsSync(statePath)) {
  state = parseZoomRealControlProtectedState(JSON.parse(await readFile(statePath, 'utf8')));
  resumedExistingMeeting = true;
} else {
  const startsAt = new Date(Math.ceil((Date.now() + 45 * 60_000) / 60_000) * 60_000);
  const created = await client.createIsolatedTestMeeting({
    hostUserId,
    startsAt,
    topic: `One Time isolated control verification ${startsAt.toISOString().slice(0, 16)}`,
    durationMinutes: 60,
  });
  state = {
    schema_version: 2,
    status: 'meeting_created',
    created_at: new Date().toISOString(),
    meeting_id: created.meeting.meeting_id,
    passcode: created.password,
    starts_at: created.meeting.starts_at,
    registrants: [],
  };
  await persistPrivateState(state);
}

if (state.status !== 'registrant_created') {
  let registrationEnabled = false;
  try {
    await client.enableMeetingRegistration(state.meeting_id);
    registrationEnabled = true;
    if (!state.registrants.some((registrant) => registrant.learner_key === canary.learnerKey)) {
      const email = fictionalAlias(canary.studentNumber, aliasDomain, aliasSecret);
      const registrant = await client.addLearnerRegistrant({
        meetingId: state.meeting_id,
        learnerKey: canary.learnerKey,
        displayName: 'Student 1',
        email,
      });
      state.registrants.push({
        learner_key: ZOOM_REAL_CONTROL_STUDENT_1_LEARNER_KEY,
        registrant_token_ref: registrant.registrant_token_ref,
      });
      await persistPrivateState(state);
    }
    state.status = 'registrant_created';
    delete state.registration_block_reason;
  } catch (error) {
    if (!(error instanceof ZoomApiError) || error.code !== 'ZOOM_404') throw error;
    state.status = 'registration_blocked';
    state.registration_block_reason = 'registration_not_enabled';
  } finally {
    if (registrationEnabled) {
      await client.disableMeetingRegistration(state.meeting_id);
      state.registration_disabled_for_sdk_join = true;
    }
    await persistPrivateState(state);
  }
}

assertZoomRealControlProvisionedState(state);

process.stdout.write(
  `${JSON.stringify(
    buildZoomRealControlSanitizedResult({
      state,
      resumedExistingMeeting,
    }),
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
