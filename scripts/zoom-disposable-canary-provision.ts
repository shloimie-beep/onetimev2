import { createHmac } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assertNoZoomSecretLeak,
  createZoomDisposableCanaryLifecycleClient,
  createZoomRestClient,
} from '../packages/domain/src/providers/zoom-rest.ts';
import {
  assertZoomDisposableCanaryProvisionPreflight,
  buildZoomDisposableCanarySanitizedResult,
  createZoomDisposableCanaryIntent,
  transitionZoomDisposableCanaryState,
  type ZoomDisposableCanaryState,
} from './zoom-disposable-canary-plan.ts';
import {
  appendZoomDisposableCanaryState,
  createZoomDisposableCanaryJournal,
  persistZoomDisposableCanaryMeetingCreated,
  readZoomDisposableCanaryJournal,
  withZoomDisposableCanaryStateLock,
} from './zoom-disposable-canary-state.ts';

const preflight = assertZoomDisposableCanaryProvisionPreflight(process.env);
const counts = { oauth: 0, get: 0, post: 0, patch: 0, delete: 0 };
const observer = {
  onOauthTokenRequest() {
    counts.oauth += 1;
  },
  onResourceRequest(method: string) {
    const key = method.toLowerCase() as keyof typeof counts;
    if (key in counts && key !== 'oauth') counts[key] += 1;
  },
};

await withZoomDisposableCanaryStateLock(preflight.statePath, async () => {
  const stateSecret = await protectedValue('zoom-disposable-state-secret.txt');
  let state: ZoomDisposableCanaryState | undefined;
  if (existsSync(preflight.statePath)) {
    state = (
      await readZoomDisposableCanaryJournal(preflight.statePath, stateSecret, {
        operationId: preflight.operationId,
        executionHead: preflight.executionHead,
        origin: preflight.origin,
      })
    ).current;
    if (state.cleanup_deadline !== preflight.cleanupDeadline) {
      throw new Error('ZOOM_DISPOSABLE_CANARY_RECONCILIATION_REQUIRED:CLEANUP_DEADLINE');
    }
    if (state.phase === 'ready' || state.phase === 'deleted') {
      writeSanitized(state);
      return;
    }
    if (
      state.phase === 'create_intent' ||
      state.phase === 'registration_in_flight' ||
      state.phase === 'cleanup_required' ||
      state.phase === 'cleanup_delete_in_flight'
    ) {
      throw new Error(`ZOOM_DISPOSABLE_CANARY_RECONCILIATION_REQUIRED:${state.phase}`);
    }
  }
  const [accountId, clientId, clientSecret, hostUserId, aliasDomain, aliasSecret] =
    await Promise.all([
      protectedValue('zoom-s2s-account-id.txt'),
      protectedValue('zoom-s2s-client-id.txt'),
      protectedValue('zoom-s2s-client-secret.txt'),
      protectedValue('zoom-host-user-id.txt'),
      protectedValue('zoom-registrant-alias-domain.txt'),
      protectedValue('zoom-registrant-alias-secret.txt'),
    ]);
  const clientOptions = {
    enabled: true,
    environment: 'staging' as const,
    credentials: { accountId, clientId, clientSecret },
    timeoutMs: 15_000,
  };
  const client = createZoomRestClient(clientOptions, observer);
  const lifecycle = createZoomDisposableCanaryLifecycleClient(clientOptions, observer);
  if (state && state.host_user_id !== hostUserId) {
    throw new Error('ZOOM_DISPOSABLE_CANARY_RECONCILIATION_REQUIRED:HOST_SCOPE');
  }

  if (!state) {
    const startsAt = new Date(Math.ceil((Date.now() + 45 * 60_000) / 60_000) * 60_000);
    state = createZoomDisposableCanaryIntent({
      operationId: preflight.operationId,
      executionHead: preflight.executionHead,
      cleanupDeadline: preflight.cleanupDeadline,
      hostUserId,
      startsAt,
      stateSecret,
    });
    await createZoomDisposableCanaryJournal(preflight.statePath, state);
    const created = await client.createIsolatedTestMeeting({
      hostUserId,
      startsAt,
      topic: state.topic,
      durationMinutes: 60,
    });
    state = await persistZoomDisposableCanaryMeetingCreated({
      previous: state,
      meetingId: created.meeting.meeting_id,
      passcode: created.password,
      stateSecret,
      append: (nextState) => appendZoomDisposableCanaryState(preflight.statePath, nextState),
      deleteExactMeeting: async () => {
        await lifecycle.deleteExactMeeting({
          meetingId: created.meeting.meeting_id,
          expectedHostUserId: state!.host_user_id,
          expectedTopic: state!.topic,
          expectedStartsAt: state!.starts_at,
          expectedDurationMinutes: 60,
          beforeDelete: async () => undefined,
        });
      },
    });
  }

  if (state.phase !== 'meeting_created') {
    throw new Error(`ZOOM_DISPOSABLE_CANARY_RECONCILIATION_REQUIRED:${state.phase}`);
  }
  const registrationInFlight = transitionZoomDisposableCanaryState(
    state,
    { phase: 'registration_in_flight' },
    stateSecret,
  );
  await appendZoomDisposableCanaryState(preflight.statePath, registrationInFlight);
  state = registrationInFlight;
  let registrationEnabled = false;
  let registrantTokenRef: string | undefined;
  try {
    await client.enableMeetingRegistration(state.meeting_id!);
    registrationEnabled = true;
    const registrant = await client.addLearnerRegistrant({
      meetingId: state.meeting_id!,
      learnerKey: preflight.learnerKey,
      displayName: 'Student 1',
      email: fictionalAlias(1, aliasDomain, aliasSecret),
    });
    registrantTokenRef = registrant.registrant_token_ref;
    await client.disableMeetingRegistration(state.meeting_id!);
    registrationEnabled = false;
  } catch {
    const registrationDisabled = await disableRegistrationIfNeeded(
      client,
      state.meeting_id!,
      registrationEnabled,
    );
    const cleanupRequired = transitionZoomDisposableCanaryState(
      state,
      {
        phase: 'cleanup_required',
        failure_category: registrationDisabled
          ? 'registration_outcome_ambiguous'
          : 'registration_disable_unverified',
      },
      stateSecret,
    );
    await appendZoomDisposableCanaryState(preflight.statePath, cleanupRequired);
    throw new Error(
      `ZOOM_DISPOSABLE_CANARY_PROVISION_FAILED:${
        registrationDisabled ? 'REGISTRATION_OUTCOME_AMBIGUOUS' : 'REGISTRATION_DISABLE_UNVERIFIED'
      }`,
    );
  }
  const ready = transitionZoomDisposableCanaryState(
    state,
    {
      phase: 'ready',
      registration_disabled_for_sdk_join: true,
      registrants: [
        {
          learner_key: preflight.learnerKey,
          registrant_token_ref: registrantTokenRef!,
        },
      ],
    },
    stateSecret,
  );
  await appendZoomDisposableCanaryState(preflight.statePath, ready);
  writeSanitized(ready);
});

async function protectedValue(fileName: string) {
  try {
    const value = (await readFile(path.join(preflight.keyholderDir, fileName), 'utf8')).trim();
    if (!value) throw new Error('missing');
    return value;
  } catch {
    throw new Error(`ZOOM_PROTECTED_INPUT_MISSING:${fileName}`);
  }
}

function fictionalAlias(studentNumber: number, domain: string, secret: string) {
  const suffix = createHmac('sha256', secret)
    .update(`zoom-real-control:${studentNumber}`)
    .digest('hex')
    .slice(0, 12);
  return `zoom-real-control-student-${studentNumber}-${suffix}@${domain}`;
}

async function disableRegistrationIfNeeded(
  client: ReturnType<typeof createZoomRestClient>,
  meetingId: string,
  registrationEnabled: boolean,
) {
  if (!registrationEnabled) return true;
  try {
    await client.disableMeetingRegistration(meetingId);
    return true;
  } catch {
    return false;
  }
}

function writeSanitized(state: ZoomDisposableCanaryState) {
  const serialized = JSON.stringify(
    buildZoomDisposableCanarySanitizedResult({ state, providerCounts: counts }),
    null,
    2,
  );
  assertNoZoomSecretLeak(serialized);
  process.stdout.write(`${serialized}\n`);
}
