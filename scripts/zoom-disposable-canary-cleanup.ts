import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assertNoZoomSecretLeak,
  createZoomDisposableCanaryLifecycleClient,
} from '../packages/domain/src/providers/zoom-rest.ts';
import {
  assertZoomDisposableCanaryCleanupPreflight,
  buildZoomDisposableCanarySanitizedResult,
  transitionZoomDisposableCanaryState,
  type ZoomDisposableCanaryState,
} from './zoom-disposable-canary-plan.ts';
import {
  appendZoomDisposableCanaryState,
  readZoomDisposableCanaryJournal,
  withZoomDisposableCanaryStateLock,
} from './zoom-disposable-canary-state.ts';

const preflight = assertZoomDisposableCanaryCleanupPreflight(process.env);
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
  let state = (
    await readZoomDisposableCanaryJournal(preflight.statePath, stateSecret, {
      operationId: preflight.operationId,
      executionHead: preflight.executionHead,
      origin: preflight.origin,
    })
  ).current;
  if (state.phase === 'deleted') {
    writeSanitized(state);
    return;
  }
  if (state.phase === 'create_intent') {
    throw new Error('ZOOM_DISPOSABLE_CANARY_CLEANUP_FAILED:CREATE_RECONCILIATION_REQUIRED');
  }
  const [accountId, clientId, clientSecret, expectedHostUserId] = await Promise.all([
    protectedValue('zoom-s2s-account-id.txt'),
    protectedValue('zoom-s2s-client-id.txt'),
    protectedValue('zoom-s2s-client-secret.txt'),
    protectedValue('zoom-host-user-id.txt'),
  ]);
  if (state.host_user_id !== expectedHostUserId) {
    throw new Error('ZOOM_DISPOSABLE_CANARY_CLEANUP_FAILED:HOST_SCOPE');
  }
  if (!state.meeting_id) {
    throw new Error('ZOOM_DISPOSABLE_CANARY_CLEANUP_FAILED:STATE_SCOPE');
  }
  const lifecycle = createZoomDisposableCanaryLifecycleClient(
    {
      enabled: true,
      environment: 'staging',
      credentials: { accountId, clientId, clientSecret },
      timeoutMs: 15_000,
    },
    observer,
  );
  if (state.phase === 'cleanup_delete_in_flight') {
    const inspection = await lifecycle.inspectExactMeeting({
      meetingId: state.meeting_id,
      expectedHostUserId: state.host_user_id,
      expectedTopic: state.topic,
      expectedStartsAt: state.starts_at,
      expectedDurationMinutes: 60,
    });
    if (inspection.exists) {
      throw new Error('ZOOM_DISPOSABLE_CANARY_CLEANUP_FAILED:DELETE_OUTCOME_AMBIGUOUS');
    }
    state = transitionZoomDisposableCanaryState(state, { phase: 'deleted' }, stateSecret);
    await appendZoomDisposableCanaryState(preflight.statePath, state);
    writeSanitized(state);
    return;
  }

  let deleteInFlight: ZoomDisposableCanaryState | undefined;
  await lifecycle.deleteExactMeeting({
    meetingId: state.meeting_id,
    expectedHostUserId: state.host_user_id,
    expectedTopic: state.topic,
    expectedStartsAt: state.starts_at,
    expectedDurationMinutes: 60,
    beforeDelete: async () => {
      deleteInFlight = transitionZoomDisposableCanaryState(
        state,
        { phase: 'cleanup_delete_in_flight' },
        stateSecret,
      );
      await appendZoomDisposableCanaryState(preflight.statePath, deleteInFlight);
    },
  });
  state = transitionZoomDisposableCanaryState(
    deleteInFlight ?? state,
    { phase: 'deleted' },
    stateSecret,
  );
  await appendZoomDisposableCanaryState(preflight.statePath, state);
  writeSanitized(state);
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

function writeSanitized(state: ZoomDisposableCanaryState) {
  const serialized = JSON.stringify(
    buildZoomDisposableCanarySanitizedResult({ state, providerCounts: counts }),
    null,
    2,
  );
  assertNoZoomSecretLeak(serialized);
  process.stdout.write(`${serialized}\n`);
}
