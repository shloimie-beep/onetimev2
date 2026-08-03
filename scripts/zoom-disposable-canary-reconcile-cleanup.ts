import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertNoZoomSecretLeak,
  createZoomDisposableCanaryLifecycleClient,
} from '../packages/domain/src/providers/zoom-rest.ts';
import {
  assertZoomDisposableCanaryReconciliationJournal,
  assertZoomDisposableCanaryReconciliationPreflight,
  buildZoomDisposableCanarySanitizedResult,
  transitionZoomDisposableCanaryState,
  type ZoomDisposableCanaryReconciliationPreflight,
  type ZoomDisposableCanaryState,
} from './zoom-disposable-canary-plan.ts';
import {
  appendZoomDisposableCanaryState,
  readZoomDisposableCanaryJournal,
  withZoomDisposableCanaryStateLock,
} from './zoom-disposable-canary-state.ts';

type ProviderCounts = {
  oauth: number;
  get: number;
  post: number;
  patch: number;
  delete: number;
};

type ReconciliationLifecycle = Pick<
  ReturnType<typeof createZoomDisposableCanaryLifecycleClient>,
  'reconcileDeleteExactMeeting' | 'verifyCanonicalAbsence'
>;

export async function executeZoomDisposableCanaryReconciliationCleanup(input: {
  preflight: ZoomDisposableCanaryReconciliationPreflight;
  stateSecret: string;
  providerCounts: ProviderCounts;
  providerContext: () => Promise<{
    expectedHostUserId: string;
    lifecycle: ReconciliationLifecycle;
  }>;
  readJournal?: typeof readZoomDisposableCanaryJournal | undefined;
  appendState?: typeof appendZoomDisposableCanaryState | undefined;
}) {
  const readJournal = input.readJournal ?? readZoomDisposableCanaryJournal;
  const appendState = input.appendState ?? appendZoomDisposableCanaryState;
  const journal = await readJournal(input.preflight.statePath, input.stateSecret, {
    operationId: input.preflight.operationId,
    executionHead: input.preflight.executionHead,
    origin: input.preflight.origin,
  });
  let state = assertZoomDisposableCanaryReconciliationJournal(
    journal.states,
    input.preflight.repairHead,
  );
  if (state.phase === 'deleted') {
    return sanitizedResult(state, input.providerCounts);
  }
  if (!state.meeting_id) {
    throw new Error('ZOOM_DISPOSABLE_CANARY_RECONCILIATION_FAILED:STATE_SCOPE');
  }
  const provider = await input.providerContext();
  if (state.host_user_id !== provider.expectedHostUserId) {
    throw new Error('ZOOM_DISPOSABLE_CANARY_RECONCILIATION_FAILED:HOST_SCOPE');
  }

  if (state.phase === 'cleanup_delete_in_flight') {
    await provider.lifecycle.verifyCanonicalAbsence({
      meetingId: state.meeting_id,
      expectedHostUserId: state.host_user_id,
      expectedTopic: state.topic,
      expectedStartsAt: state.starts_at,
      expectedDurationMinutes: 60,
    });
    state = transitionZoomDisposableCanaryState(state, { phase: 'deleted' }, input.stateSecret);
    await appendState(input.preflight.statePath, state);
    return sanitizedResult(state, input.providerCounts);
  }

  let deleteInFlight: ZoomDisposableCanaryState | undefined;
  await provider.lifecycle.reconcileDeleteExactMeeting({
    meetingId: state.meeting_id,
    expectedHostUserId: state.host_user_id,
    expectedTopic: state.topic,
    expectedStartsAt: state.starts_at,
    expectedDurationMinutes: 60,
    originalExecutionHead: input.preflight.executionHead,
    beforeDelete: async () => {
      deleteInFlight = transitionZoomDisposableCanaryState(
        state,
        {
          phase: 'cleanup_delete_in_flight',
          reconciliation_repair_head: input.preflight.repairHead,
        },
        input.stateSecret,
      );
      await appendState(input.preflight.statePath, deleteInFlight);
    },
  });
  if (!deleteInFlight) {
    throw new Error('ZOOM_DISPOSABLE_CANARY_RECONCILIATION_FAILED:JOURNAL_BEFORE_DELETE');
  }
  state = transitionZoomDisposableCanaryState(
    deleteInFlight,
    { phase: 'deleted' },
    input.stateSecret,
  );
  await appendState(input.preflight.statePath, state);
  return sanitizedResult(state, input.providerCounts);
}

async function main() {
  const preflight = assertZoomDisposableCanaryReconciliationPreflight(process.env);
  const providerCounts: ProviderCounts = { oauth: 0, get: 0, post: 0, patch: 0, delete: 0 };
  const observer = {
    onOauthTokenRequest() {
      providerCounts.oauth += 1;
    },
    onResourceRequest(method: string) {
      const key = method.toLowerCase() as keyof ProviderCounts;
      if (key in providerCounts && key !== 'oauth') providerCounts[key] += 1;
    },
  };

  await withZoomDisposableCanaryStateLock(preflight.statePath, async () => {
    const stateSecret = await protectedValue(preflight, 'zoom-disposable-state-secret.txt');
    const result = await executeZoomDisposableCanaryReconciliationCleanup({
      preflight,
      stateSecret,
      providerCounts,
      providerContext: async () => {
        const [accountId, clientId, clientSecret, expectedHostUserId] = await Promise.all([
          protectedValue(preflight, 'zoom-s2s-account-id.txt'),
          protectedValue(preflight, 'zoom-s2s-client-id.txt'),
          protectedValue(preflight, 'zoom-s2s-client-secret.txt'),
          protectedValue(preflight, 'zoom-host-user-id.txt'),
        ]);
        return {
          expectedHostUserId,
          lifecycle: createZoomDisposableCanaryLifecycleClient(
            {
              enabled: true,
              environment: 'staging',
              credentials: { accountId, clientId, clientSecret },
              timeoutMs: 15_000,
            },
            observer,
          ),
        };
      },
    });
    const serialized = JSON.stringify(result, null, 2);
    assertNoZoomSecretLeak(serialized);
    process.stdout.write(`${serialized}\n`);
  });
}

function sanitizedResult(state: ZoomDisposableCanaryState, providerCounts: ProviderCounts) {
  return Object.freeze({
    ...buildZoomDisposableCanarySanitizedResult({ state, providerCounts }),
    reconciliation_cleanup_only: true,
    original_execution_head_verified: true,
    repair_head_verified: true,
    normalization_policy_verified: true,
  });
}

async function protectedValue(
  preflight: ZoomDisposableCanaryReconciliationPreflight,
  fileName: string,
) {
  try {
    const value = (await readFile(path.join(preflight.keyholderDir, fileName), 'utf8')).trim();
    if (!value) throw new Error('missing');
    return value;
  } catch {
    throw new Error(`ZOOM_PROTECTED_INPUT_MISSING:${fileName}`);
  }
}

function isDirectExecution() {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (isDirectExecution()) {
  await main();
}
