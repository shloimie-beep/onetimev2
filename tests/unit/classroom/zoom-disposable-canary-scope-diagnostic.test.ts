import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createZoomDisposableCanaryLifecycleClient } from '../../../packages/domain/src/providers/zoom-rest.ts';
import {
  classifyZoomDisposableCanaryStartDelta,
  createZoomDisposableCanaryScopeDiagnosticObserver,
  executeZoomDisposableCanaryScopeDiagnostic,
  type ZoomDisposableCanaryScopeDiagnosticProviderCounts,
} from '../../../scripts/zoom-disposable-canary-scope-diagnostic.ts';
import {
  createZoomDisposableCanaryIntent,
  transitionZoomDisposableCanaryState,
  ZOOM_DISPOSABLE_CANARY_ORIGINAL_EXECUTION_HEAD,
  ZOOM_DISPOSABLE_CANARY_ORIGIN,
  type ZoomDisposableCanaryScopeDiagnosticPreflight,
  type ZoomDisposableCanaryState,
} from '../../../scripts/zoom-disposable-canary-plan.ts';
import {
  appendZoomDisposableCanaryState,
  createZoomDisposableCanaryJournal,
  withZoomDisposableCanaryStateLock,
} from '../../../scripts/zoom-disposable-canary-state.ts';

const temporaryDirectories: string[] = [];
const operationId = '123e4567-e89b-42d3-a456-426614174000';
const stateSecret = 'state-secret-fixture-that-is-longer-than-thirty-two-characters';

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('Zoom disposable canary mutation-impossible scope diagnostic', () => {
  it('uses one OAuth and one GET, preserves the journal bytes, and returns only safe fields', async () => {
    const fixture = await createDiagnosticFixture();
    const before = await readFile(fixture.preflight.statePath);
    const providerCounts = emptyProviderCounts();
    const observer = createZoomDisposableCanaryScopeDiagnosticObserver(providerCounts);
    const requests: string[] = [];

    const result = await executeZoomDisposableCanaryScopeDiagnostic({
      preflight: fixture.preflight,
      stateSecret,
      providerCounts,
      expectedHostUserId: async () => 'protected-host-fixture',
      providerLifecycle: async () =>
        createZoomDisposableCanaryLifecycleClient(
          {
            enabled: true,
            environment: 'staging',
            credentials: {
              accountId: 'protected-account-fixture',
              clientId: 'protected-client-fixture',
              clientSecret: 'protected-secret-fixture',
            },
            fetchImpl: async (input, init) => {
              if (String(input).startsWith('https://zoom.us/oauth/token')) {
                requests.push('OAUTH');
                return jsonResponse({ access_token: 'protected-access-token', expires_in: 3600 });
              }
              requests.push(init?.method ?? 'GET');
              return jsonResponse(providerMeeting({ start_time: '2026-07-24T11:00:45Z' }));
            },
          },
          observer,
        ),
    });

    expect(requests).toEqual(['OAUTH', 'GET']);
    expect(await readFile(fixture.preflight.statePath)).toEqual(before);
    expect(Object.keys(result).sort()).toEqual(
      [
        'agenda_matches_expected',
        'duration_matches_expected',
        'general_email_notification_safe',
        'host_matches_expected',
        'join_before_host_disabled',
        'meeting_id_matches_expected',
        'no_alternative_hosts',
        'phase',
        'provider_counts',
        'reconciliation_scope',
        'registrant_notifications_explicitly_disabled',
        'sequence',
        'start_delta_class',
        'topic_matches_expected',
        'type_is_single_meeting',
      ].sort(),
    );
    expect(result).toEqual({
      phase: 'cleanup_required',
      sequence: 4,
      meeting_id_matches_expected: true,
      type_is_single_meeting: true,
      host_matches_expected: true,
      topic_matches_expected: true,
      agenda_matches_expected: true,
      duration_matches_expected: true,
      registrant_notifications_explicitly_disabled: true,
      general_email_notification_safe: true,
      no_alternative_hosts: true,
      join_before_host_disabled: true,
      reconciliation_scope: true,
      start_delta_class: 'within_reviewed_tolerance',
      provider_counts: { oauth: 1, get: 1, post: 0, patch: 0, delete: 0 },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /protected|123e4567|2026-07-24|11:00|zoom\.us|One Time PR105/u,
    );
  });

  it.each([
    [0, 'exact'],
    [1, 'within_reviewed_tolerance'],
    [60, 'within_reviewed_tolerance'],
    [60.001, 'outside_reviewed_tolerance'],
    [61, 'outside_reviewed_tolerance'],
    [null, 'unparseable'],
    [Number.NaN, 'unparseable'],
    [-1, 'unparseable'],
  ] as const)('classifies start delta %s as %s', (delta, expected) => {
    expect(classifyZoomDisposableCanaryStartDelta(delta)).toBe(expected);
  });

  it.each([
    ['meeting_id_matches_expected', { meeting_id_matches_expected: false }],
    ['type_is_single_meeting', { type_is_single_meeting: false }],
    ['host_matches_expected', { host_matches_expected: false }],
    ['topic_matches_expected', { topic_matches_expected: false }],
    ['agenda_matches_expected', { agenda_matches_expected: false }],
    ['duration_matches_expected', { duration_matches_expected: false }],
    [
      'registrant_notifications_explicitly_disabled',
      { registrant_notifications_explicitly_disabled: false },
    ],
    ['general_email_notification_safe', { general_email_notification_safe: false }],
    ['no_alternative_hosts', { no_alternative_hosts: false }],
    ['join_before_host_disabled', { join_before_host_disabled: false }],
    ['reconciliation_scope', {}],
  ])('reports the %s mismatch without protected values', async (field, override) => {
    const fixture = await createDiagnosticFixture();
    const result = await executeWithInspection(
      fixture.preflight,
      diagnosticInspection({ ...override, reconciliation_scope: false }),
    );

    expect(result).toMatchObject({
      phase: 'cleanup_required',
      sequence: 4,
      reconciliation_scope: false,
      provider_counts: { oauth: 1, get: 1, post: 0, patch: 0, delete: 0 },
    });
    if (field !== 'reconciliation_scope') {
      expect(result[field as keyof typeof result]).toBe(false);
    }
    expect(JSON.stringify(result)).not.toMatch(/protected|123e4567|@|https?:\/\//u);
  });

  it.each([
    [null, 'unparseable', false],
    [0, 'exact', true],
    [45, 'within_reviewed_tolerance', true],
    [61, 'outside_reviewed_tolerance', false],
  ] as const)(
    'emits only start class for delta %s',
    async (delta, expectedClass, expectedWithinTolerance) => {
      const fixture = await createDiagnosticFixture();
      const result = await executeWithInspection(
        fixture.preflight,
        diagnosticInspection({
          starts_at_delta_seconds: delta,
          reconciliation_scope: expectedWithinTolerance,
        }),
      );

      expect(result.start_delta_class).toBe(expectedClass);
      expect(result).not.toHaveProperty('starts_at_delta_seconds');
      expect(result.reconciliation_scope).toBe(expectedWithinTolerance);
      expect(JSON.stringify(result)).not.toContain('2026-07-24T11:00:00.000Z');
    },
  );

  it('rejects a keyholder host mismatch before meeting inspection', async () => {
    const fixture = await createDiagnosticFixture();
    const before = await readFile(fixture.preflight.statePath);
    let providerLifecycleCount = 0;

    await expect(
      executeZoomDisposableCanaryScopeDiagnostic({
        preflight: fixture.preflight,
        stateSecret,
        providerCounts: emptyProviderCounts(),
        expectedHostUserId: async () => 'different-protected-host',
        providerLifecycle: async () => {
          providerLifecycleCount += 1;
          return {
            inspectExactMeeting: async () => {
              return diagnosticInspection();
            },
          };
        },
      }),
    ).rejects.toThrow('ZOOM_DISPOSABLE_CANARY_SCOPE_DIAGNOSTIC_FAILED:HOST_SCOPE');
    expect(providerLifecycleCount).toBe(0);
    expect(await readFile(fixture.preflight.statePath)).toEqual(before);
  });

  it.each(['cleanup_delete_in_flight', 'deleted'] as const)(
    'rejects sequence-5/6 %s state before provider context',
    async (terminalPhase) => {
      const fixture = await createDiagnosticFixture(terminalPhase);
      let providerContextCount = 0;
      await expect(
        executeZoomDisposableCanaryScopeDiagnostic({
          preflight: fixture.preflight,
          stateSecret,
          providerCounts: emptyProviderCounts(),
          expectedHostUserId: async () => {
            providerContextCount += 1;
            throw new Error('provider context must not load');
          },
          providerLifecycle: async () => {
            providerContextCount += 1;
            throw new Error('provider context must not load');
          },
        }),
      ).rejects.toThrow('ZOOM_DISPOSABLE_CANARY_SCOPE_DIAGNOSTIC_FAILED:STATE_SCOPE');
      expect(providerContextCount).toBe(0);
    },
  );

  it.each(['hmac', 'origin', 'source'] as const)(
    'rejects invalid %s binding before provider context',
    async (invalidBinding) => {
      const fixture = await createDiagnosticFixture();
      if (invalidBinding === 'hmac') {
        const lines = (await readFile(fixture.preflight.statePath, 'utf8')).trimEnd().split('\n');
        const finalState = JSON.parse(lines.at(-1)!) as ZoomDisposableCanaryState;
        finalState.state_mac = '0'.repeat(64);
        lines[lines.length - 1] = JSON.stringify(finalState);
        await writeFile(fixture.preflight.statePath, `${lines.join('\n')}\n`, 'utf8');
      }
      const preflight =
        invalidBinding === 'origin'
          ? { ...fixture.preflight, origin: 'https://wrong-origin.example' as never }
          : invalidBinding === 'source'
            ? { ...fixture.preflight, executionHead: 'c'.repeat(40) }
            : fixture.preflight;
      let providerContextCount = 0;

      await expect(
        executeZoomDisposableCanaryScopeDiagnostic({
          preflight,
          stateSecret,
          providerCounts: emptyProviderCounts(),
          expectedHostUserId: async () => {
            providerContextCount += 1;
            throw new Error('provider context must not load');
          },
          providerLifecycle: async () => {
            providerContextCount += 1;
            throw new Error('provider context must not load');
          },
        }),
      ).rejects.toThrow('ZOOM_DISPOSABLE_CANARY_STATE_INVALID');
      expect(providerContextCount).toBe(0);
    },
    15_000,
  );

  it.each(['POST', 'PATCH', 'DELETE'])('hard-fails %s before a resource request', (method) => {
    const counts = emptyProviderCounts();
    const observer = createZoomDisposableCanaryScopeDiagnosticObserver(counts);
    expect(() => observer.onResourceRequest(method)).toThrow(
      'ZOOM_DISPOSABLE_CANARY_SCOPE_DIAGNOSTIC_FAILED:WRITE_FORBIDDEN',
    );
    expect(counts[method.toLowerCase() as 'post' | 'patch' | 'delete']).toBe(1);
  });

  it('fails closed unless the final request budget is exactly OAuth=1 and GET=1', async () => {
    const fixture = await createDiagnosticFixture();
    await expect(
      executeZoomDisposableCanaryScopeDiagnostic({
        preflight: fixture.preflight,
        stateSecret,
        providerCounts: emptyProviderCounts(),
        expectedHostUserId: async () => 'protected-host-fixture',
        providerLifecycle: async () => ({
          inspectExactMeeting: async () => diagnosticInspection(),
        }),
      }),
    ).rejects.toThrow('ZOOM_DISPOSABLE_CANARY_SCOPE_DIAGNOSTIC_FAILED:REQUEST_BUDGET');
  });

  it('honors the exclusive state lock', async () => {
    const fixture = await createDiagnosticFixture();
    let release: (() => void) | undefined;
    const held = withZoomDisposableCanaryStateLock(
      fixture.preflight.statePath,
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    await waitFor(() => release !== undefined);
    await expect(
      withZoomDisposableCanaryStateLock(fixture.preflight.statePath, async () => undefined),
    ).rejects.toThrow('ZOOM_DISPOSABLE_CANARY_STATE_LOCKED');
    release?.();
    await held;
  });
});

async function executeWithInspection(
  preflight: ZoomDisposableCanaryScopeDiagnosticPreflight,
  inspection: ReturnType<typeof diagnosticInspection>,
) {
  return executeZoomDisposableCanaryScopeDiagnostic({
    preflight,
    stateSecret,
    providerCounts: { oauth: 1, get: 1, post: 0, patch: 0, delete: 0 },
    expectedHostUserId: async () => 'protected-host-fixture',
    providerLifecycle: async () => ({ inspectExactMeeting: async () => inspection }),
  });
}

async function createDiagnosticFixture(terminalPhase?: 'cleanup_delete_in_flight' | 'deleted') {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'onetime-zoom-diagnostic-'));
  temporaryDirectories.push(directory);
  const statePath = path.join(directory, 'state', 'canary.jsonl');
  const preflight: ZoomDisposableCanaryScopeDiagnosticPreflight = {
    operationId,
    executionHead: ZOOM_DISPOSABLE_CANARY_ORIGINAL_EXECUTION_HEAD,
    repairHead: 'b'.repeat(40),
    origin: ZOOM_DISPOSABLE_CANARY_ORIGIN,
    statePath,
    keyholderDir: path.join(directory, 'keyholder'),
    learnerKey: 'full_app_preview_student_1',
  };
  const intent = createZoomDisposableCanaryIntent({
    operationId,
    executionHead: ZOOM_DISPOSABLE_CANARY_ORIGINAL_EXECUTION_HEAD,
    cleanupDeadline: '2026-07-24T13:00:00.000Z',
    hostUserId: 'protected-host-fixture',
    startsAt: new Date('2026-07-24T11:00:00.000Z'),
    now: new Date('2026-07-24T10:00:00.000Z'),
    stateSecret,
  });
  const meeting = transitionZoomDisposableCanaryState(
    intent,
    {
      phase: 'meeting_created',
      meeting_id: 'protected-meeting-fixture',
      passcode: 'protected-passcode-fixture',
    },
    stateSecret,
  );
  const registrationInFlight = transitionZoomDisposableCanaryState(
    meeting,
    { phase: 'registration_in_flight' },
    stateSecret,
  );
  const cleanupRequired = transitionZoomDisposableCanaryState(
    registrationInFlight,
    {
      phase: 'cleanup_required',
      failure_category: 'registration_outcome_ambiguous',
    },
    stateSecret,
  );
  await createZoomDisposableCanaryJournal(statePath, intent);
  await appendZoomDisposableCanaryState(statePath, meeting);
  await appendZoomDisposableCanaryState(statePath, registrationInFlight);
  await appendZoomDisposableCanaryState(statePath, cleanupRequired);
  if (terminalPhase) {
    const deleteInFlight = transitionZoomDisposableCanaryState(
      cleanupRequired,
      {
        phase: 'cleanup_delete_in_flight',
        reconciliation_repair_head: preflight.repairHead,
      },
      stateSecret,
    );
    await appendZoomDisposableCanaryState(statePath, deleteInFlight);
    if (terminalPhase === 'deleted') {
      await appendZoomDisposableCanaryState(
        statePath,
        transitionZoomDisposableCanaryState(deleteInFlight, { phase: 'deleted' }, stateSecret),
      );
    }
  }
  return { preflight };
}

function diagnosticInspection(overrides: Record<string, unknown> = {}) {
  return {
    exists: true as const,
    exact_scope: true,
    meeting_id_matches_expected: true,
    type_is_single_meeting: true,
    host_matches_expected: true,
    topic_matches_expected: true,
    agenda_matches_expected: true,
    starts_at_matches_expected: true,
    duration_matches_expected: true,
    notifications_disabled: true,
    registrant_notifications_explicitly_disabled: true,
    general_email_notification_safe: true,
    no_alternative_hosts: true,
    join_before_host_disabled: true,
    starts_at_delta_seconds: 0,
    reconciliation_scope: true,
    ...overrides,
  };
}

function providerMeeting(overrides: Record<string, unknown> = {}) {
  return {
    id: 'protected-meeting-fixture',
    type: 2,
    host_id: 'protected-host-fixture',
    topic:
      'One Time PR105 disposable control 123e4567-e89b-42d3-a456-426614174000 2026-07-24T11:00Z',
    agenda: 'Isolated fictional-student control verification. No customer invitations.',
    start_time: '2026-07-24T11:00:00Z',
    duration: 60,
    settings: {
      registrants_confirmation_email: false,
      registrants_email_notification: false,
      email_notification: false,
      join_before_host: false,
    },
    ...overrides,
  };
}

function emptyProviderCounts(): ZoomDisposableCanaryScopeDiagnosticProviderCounts {
  return { oauth: 0, get: 0, post: 0, patch: 0, delete: 0 };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function waitFor(predicate: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error('test wait timed out');
}
