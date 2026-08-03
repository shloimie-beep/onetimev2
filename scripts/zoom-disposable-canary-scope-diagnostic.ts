import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertNoZoomSecretLeak,
  createZoomDisposableCanaryLifecycleClient,
} from '../packages/domain/src/providers/zoom-rest.ts';
import {
  assertZoomDisposableCanaryReconciliationJournal,
  assertZoomDisposableCanaryScopeDiagnosticPreflight,
  ZOOM_DISPOSABLE_CANARY_ORIGINAL_EXECUTION_HEAD,
  type ZoomDisposableCanaryScopeDiagnosticPreflight,
} from './zoom-disposable-canary-plan.ts';
import {
  readZoomDisposableCanaryJournal,
  withZoomDisposableCanaryStateLock,
} from './zoom-disposable-canary-state.ts';

export type ZoomDisposableCanaryScopeDiagnosticProviderCounts = {
  oauth: number;
  get: number;
  post: number;
  patch: number;
  delete: number;
};

type DiagnosticLifecycle = Pick<
  ReturnType<typeof createZoomDisposableCanaryLifecycleClient>,
  'inspectExactMeeting'
>;

type DiagnosticInspection = Awaited<ReturnType<DiagnosticLifecycle['inspectExactMeeting']>>;

export type ZoomDisposableCanaryStartDeltaClass =
  'exact' | 'within_reviewed_tolerance' | 'outside_reviewed_tolerance' | 'unparseable';

export async function executeZoomDisposableCanaryScopeDiagnostic(input: {
  preflight: ZoomDisposableCanaryScopeDiagnosticPreflight;
  stateSecret: string;
  providerCounts: ZoomDisposableCanaryScopeDiagnosticProviderCounts;
  expectedHostUserId: () => Promise<string>;
  providerLifecycle: () => Promise<DiagnosticLifecycle>;
  readJournal?: typeof readZoomDisposableCanaryJournal | undefined;
}) {
  const readJournal = input.readJournal ?? readZoomDisposableCanaryJournal;
  const journal = await readJournal(input.preflight.statePath, input.stateSecret, {
    operationId: input.preflight.operationId,
    executionHead: input.preflight.executionHead,
    origin: input.preflight.origin,
  });
  const state = assertZoomDisposableCanaryReconciliationJournal(
    journal.states,
    input.preflight.repairHead,
  );
  if (
    state.phase !== 'cleanup_required' ||
    state.sequence !== 4 ||
    state.failure_category !== 'registration_outcome_ambiguous' ||
    state.registrants.length !== 0 ||
    state.registration_disabled_for_sdk_join !== undefined ||
    !state.meeting_id
  ) {
    throw new Error('ZOOM_DISPOSABLE_CANARY_SCOPE_DIAGNOSTIC_FAILED:STATE_SCOPE');
  }

  const expectedHostUserId = await input.expectedHostUserId();
  if (state.host_user_id !== expectedHostUserId) {
    throw new Error('ZOOM_DISPOSABLE_CANARY_SCOPE_DIAGNOSTIC_FAILED:HOST_SCOPE');
  }

  const lifecycle = await input.providerLifecycle();
  const inspection = await lifecycle.inspectExactMeeting({
    meetingId: state.meeting_id,
    expectedHostUserId: state.host_user_id,
    expectedTopic: state.topic,
    expectedStartsAt: state.starts_at,
    expectedDurationMinutes: 60,
    reconciliationOriginalExecutionHead: ZOOM_DISPOSABLE_CANARY_ORIGINAL_EXECUTION_HEAD,
  });
  assertDiagnosticProviderCounts(input.providerCounts);
  return buildSanitizedScopeDiagnostic(
    state.phase,
    state.sequence,
    inspection,
    input.providerCounts,
  );
}

export function createZoomDisposableCanaryScopeDiagnosticObserver(
  providerCounts: ZoomDisposableCanaryScopeDiagnosticProviderCounts,
) {
  return Object.freeze({
    onOauthTokenRequest() {
      providerCounts.oauth += 1;
      if (providerCounts.oauth > 1) {
        throw new Error('ZOOM_DISPOSABLE_CANARY_SCOPE_DIAGNOSTIC_FAILED:OAUTH_BUDGET');
      }
    },
    onResourceRequest(method: string) {
      const normalized = method.toUpperCase();
      if (normalized === 'GET') {
        providerCounts.get += 1;
        if (providerCounts.get > 1) {
          throw new Error('ZOOM_DISPOSABLE_CANARY_SCOPE_DIAGNOSTIC_FAILED:GET_BUDGET');
        }
        return;
      }
      if (normalized === 'POST' || normalized === 'PATCH' || normalized === 'DELETE') {
        providerCounts[normalized.toLowerCase() as 'post' | 'patch' | 'delete'] += 1;
      }
      throw new Error('ZOOM_DISPOSABLE_CANARY_SCOPE_DIAGNOSTIC_FAILED:WRITE_FORBIDDEN');
    },
  });
}

export function classifyZoomDisposableCanaryStartDelta(
  deltaSeconds: number | null,
): ZoomDisposableCanaryStartDeltaClass {
  if (deltaSeconds === null || !Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
    return 'unparseable';
  }
  if (deltaSeconds === 0) return 'exact';
  if (deltaSeconds <= 60) return 'within_reviewed_tolerance';
  return 'outside_reviewed_tolerance';
}

function buildSanitizedScopeDiagnostic(
  phase: 'cleanup_required',
  sequence: 4,
  inspection: DiagnosticInspection,
  providerCounts: ZoomDisposableCanaryScopeDiagnosticProviderCounts,
) {
  const startDeltaClass = classifyZoomDisposableCanaryStartDelta(
    inspection.starts_at_delta_seconds,
  );
  return Object.freeze({
    phase,
    sequence,
    meeting_id_matches_expected: inspection.meeting_id_matches_expected,
    type_is_single_meeting: inspection.type_is_single_meeting,
    host_matches_expected: inspection.host_matches_expected,
    topic_matches_expected: inspection.topic_matches_expected,
    agenda_matches_expected: inspection.agenda_matches_expected,
    duration_matches_expected: inspection.duration_matches_expected,
    registrant_notifications_explicitly_disabled:
      inspection.registrant_notifications_explicitly_disabled,
    general_email_notification_safe: inspection.general_email_notification_safe,
    no_alternative_hosts: inspection.no_alternative_hosts,
    join_before_host_disabled: inspection.join_before_host_disabled,
    reconciliation_scope: inspection.reconciliation_scope,
    start_delta_class: startDeltaClass,
    provider_counts: Object.freeze({ ...providerCounts }),
  });
}

function assertDiagnosticProviderCounts(
  providerCounts: ZoomDisposableCanaryScopeDiagnosticProviderCounts,
) {
  if (
    providerCounts.oauth !== 1 ||
    providerCounts.get !== 1 ||
    providerCounts.post !== 0 ||
    providerCounts.patch !== 0 ||
    providerCounts.delete !== 0
  ) {
    throw new Error('ZOOM_DISPOSABLE_CANARY_SCOPE_DIAGNOSTIC_FAILED:REQUEST_BUDGET');
  }
}

async function main() {
  const preflight = assertZoomDisposableCanaryScopeDiagnosticPreflight(process.env);
  const providerCounts: ZoomDisposableCanaryScopeDiagnosticProviderCounts = {
    oauth: 0,
    get: 0,
    post: 0,
    patch: 0,
    delete: 0,
  };
  const observer = createZoomDisposableCanaryScopeDiagnosticObserver(providerCounts);

  await withZoomDisposableCanaryStateLock(preflight.statePath, async () => {
    const stateSecret = await protectedValue(preflight, 'zoom-disposable-state-secret.txt');
    const result = await executeZoomDisposableCanaryScopeDiagnostic({
      preflight,
      stateSecret,
      providerCounts,
      expectedHostUserId: () => protectedValue(preflight, 'zoom-host-user-id.txt'),
      providerLifecycle: async () => {
        const [accountId, clientId, clientSecret] = await Promise.all([
          protectedValue(preflight, 'zoom-s2s-account-id.txt'),
          protectedValue(preflight, 'zoom-s2s-client-id.txt'),
          protectedValue(preflight, 'zoom-s2s-client-secret.txt'),
        ]);
        const lifecycle = createZoomDisposableCanaryLifecycleClient(
          {
            enabled: true,
            environment: 'staging',
            credentials: { accountId, clientId, clientSecret },
            timeoutMs: 15_000,
          },
          observer,
        );
        return Object.freeze({ inspectExactMeeting: lifecycle.inspectExactMeeting });
      },
    });
    const serialized = JSON.stringify(result, null, 2);
    assertNoZoomSecretLeak(serialized);
    process.stdout.write(`${serialized}\n`);
  });
}

async function protectedValue(
  preflight: ZoomDisposableCanaryScopeDiagnosticPreflight,
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
