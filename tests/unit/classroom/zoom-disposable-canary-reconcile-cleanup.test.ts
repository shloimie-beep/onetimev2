import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { executeZoomDisposableCanaryReconciliationCleanup } from '../../../scripts/zoom-disposable-canary-reconcile-cleanup.ts';
import {
  createZoomDisposableCanaryIntent,
  transitionZoomDisposableCanaryState,
  ZOOM_DISPOSABLE_CANARY_ORIGINAL_EXECUTION_HEAD,
  ZOOM_DISPOSABLE_CANARY_ORIGIN,
  type ZoomDisposableCanaryReconciliationPreflight,
  type ZoomDisposableCanaryState,
} from '../../../scripts/zoom-disposable-canary-plan.ts';
import {
  appendZoomDisposableCanaryState,
  createZoomDisposableCanaryJournal,
  readZoomDisposableCanaryJournal,
} from '../../../scripts/zoom-disposable-canary-state.ts';

const temporaryDirectories: string[] = [];
const operationId = '123e4567-e89b-42d3-a456-426614174000';
const stateSecret = 'state-secret-fixture-that-is-longer-than-thirty-two-characters';
const providerCounts = () => ({ oauth: 0, get: 0, post: 0, patch: 0, delete: 0 });

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('Zoom disposable canary reconciliation cleanup runner', () => {
  it('appends cleanup_delete_in_flight before one delete and then writes a private tombstone', async () => {
    const fixture = await createCleanupRequiredFixture();
    let deleteCount = 0;
    const result = await executeZoomDisposableCanaryReconciliationCleanup({
      preflight: fixture.preflight,
      stateSecret,
      providerCounts: providerCounts(),
      providerContext: async () => ({
        expectedHostUserId: 'protected-host-fixture',
        lifecycle: {
          reconcileDeleteExactMeeting: async (input) => {
            await input.beforeDelete();
            const beforeDelete = await readCurrent(fixture.preflight);
            expect(beforeDelete).toMatchObject({
              sequence: 5,
              phase: 'cleanup_delete_in_flight',
            });
            deleteCount += 1;
            return { delete_executed: true, absent_verified: true };
          },
          verifyCanonicalAbsence: async () => ({ absent_verified: true }),
        },
      }),
    });

    expect(deleteCount).toBe(1);
    expect(await readCurrent(fixture.preflight)).toMatchObject({
      sequence: 6,
      phase: 'deleted',
      registrants: [],
    });
    expect(result).toMatchObject({
      phase: 'deleted',
      reconciliation_cleanup_only: true,
      original_execution_head_verified: true,
      repair_head_verified: true,
      normalization_policy_verified: true,
      deleted_tombstone_written: true,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /protected-meeting|protected-passcode|protected-host|123e4567|@/u,
    );
  });

  it('retains cleanup_delete_in_flight after a DELETE timeout and never writes a tombstone', async () => {
    const fixture = await createCleanupRequiredFixture();
    let deleteCount = 0;
    await expect(
      executeZoomDisposableCanaryReconciliationCleanup({
        preflight: fixture.preflight,
        stateSecret,
        providerCounts: providerCounts(),
        providerContext: async () => ({
          expectedHostUserId: 'protected-host-fixture',
          lifecycle: {
            reconcileDeleteExactMeeting: async (input) => {
              await input.beforeDelete();
              deleteCount += 1;
              throw new Error('provider timeout');
            },
            verifyCanonicalAbsence: async () => ({ absent_verified: true }),
          },
        }),
      }),
    ).rejects.toThrow('provider timeout');

    expect(deleteCount).toBe(1);
    expect(await readCurrent(fixture.preflight)).toMatchObject({
      sequence: 5,
      phase: 'cleanup_delete_in_flight',
      failure_category: 'registration_outcome_ambiguous',
    });
  });

  it('does not issue a second DELETE after timeout and tombstones only canonical absence', async () => {
    const fixture = await createCleanupRequiredFixture();
    await appendZoomDisposableCanaryState(
      fixture.preflight.statePath,
      transitionZoomDisposableCanaryState(
        fixture.cleanupRequired,
        {
          phase: 'cleanup_delete_in_flight',
          reconciliation_repair_head: fixture.preflight.repairHead,
        },
        stateSecret,
      ),
    );
    let verifyCount = 0;
    let deleteCount = 0;
    const result = await executeZoomDisposableCanaryReconciliationCleanup({
      preflight: fixture.preflight,
      stateSecret,
      providerCounts: providerCounts(),
      providerContext: async () => ({
        expectedHostUserId: 'protected-host-fixture',
        lifecycle: {
          reconcileDeleteExactMeeting: async () => {
            deleteCount += 1;
            return { delete_executed: true, absent_verified: true };
          },
          verifyCanonicalAbsence: async () => {
            verifyCount += 1;
            return { absent_verified: true };
          },
        },
      }),
    });

    expect(deleteCount).toBe(0);
    expect(verifyCount).toBe(1);
    expect(result).toMatchObject({ phase: 'deleted', deleted_tombstone_written: true });
  });

  it('retains the in-flight state when post-timeout absence remains ambiguous', async () => {
    const fixture = await createCleanupRequiredFixture();
    await appendZoomDisposableCanaryState(
      fixture.preflight.statePath,
      transitionZoomDisposableCanaryState(
        fixture.cleanupRequired,
        {
          phase: 'cleanup_delete_in_flight',
          reconciliation_repair_head: fixture.preflight.repairHead,
        },
        stateSecret,
      ),
    );
    await expect(
      executeZoomDisposableCanaryReconciliationCleanup({
        preflight: fixture.preflight,
        stateSecret,
        providerCounts: providerCounts(),
        providerContext: async () => ({
          expectedHostUserId: 'protected-host-fixture',
          lifecycle: {
            reconcileDeleteExactMeeting: async () => {
              throw new Error('must not delete again');
            },
            verifyCanonicalAbsence: async () => {
              throw new Error('ZOOM_DISPOSABLE_CANARY_DELETE_OUTCOME_AMBIGUOUS');
            },
          },
        }),
      }),
    ).rejects.toThrow('ZOOM_DISPOSABLE_CANARY_DELETE_OUTCOME_AMBIGUOUS');
    expect(await readCurrent(fixture.preflight)).toMatchObject({
      sequence: 5,
      phase: 'cleanup_delete_in_flight',
    });
  });

  it('is tombstone-idempotent without loading provider credentials or invoking Zoom', async () => {
    const fixture = await createCleanupRequiredFixture();
    const deleteInFlight = transitionZoomDisposableCanaryState(
      fixture.cleanupRequired,
      {
        phase: 'cleanup_delete_in_flight',
        reconciliation_repair_head: fixture.preflight.repairHead,
      },
      stateSecret,
    );
    const deleted = transitionZoomDisposableCanaryState(
      deleteInFlight,
      { phase: 'deleted' },
      stateSecret,
    );
    await appendZoomDisposableCanaryState(fixture.preflight.statePath, deleteInFlight);
    await appendZoomDisposableCanaryState(fixture.preflight.statePath, deleted);
    let providerContextCount = 0;

    const result = await executeZoomDisposableCanaryReconciliationCleanup({
      preflight: fixture.preflight,
      stateSecret,
      providerCounts: providerCounts(),
      providerContext: async () => {
        providerContextCount += 1;
        throw new Error('must not load provider context');
      },
    });

    expect(providerContextCount).toBe(0);
    expect(result).toMatchObject({
      phase: 'deleted',
      provider_counts: { oauth: 0, get: 0, post: 0, patch: 0, delete: 0 },
    });
    expect((await readJournal(fixture.preflight)).states).toHaveLength(6);
  });

  it('stops on host mismatch before a journal transition or provider operation', async () => {
    const fixture = await createCleanupRequiredFixture();
    let lifecycleCalls = 0;
    await expect(
      executeZoomDisposableCanaryReconciliationCleanup({
        preflight: fixture.preflight,
        stateSecret,
        providerCounts: providerCounts(),
        providerContext: async () => ({
          expectedHostUserId: 'different-host',
          lifecycle: {
            reconcileDeleteExactMeeting: async () => {
              lifecycleCalls += 1;
              return { delete_executed: true, absent_verified: true };
            },
            verifyCanonicalAbsence: async () => {
              lifecycleCalls += 1;
              return { absent_verified: true };
            },
          },
        }),
      }),
    ).rejects.toThrow('ZOOM_DISPOSABLE_CANARY_RECONCILIATION_FAILED:HOST_SCOPE');
    expect(lifecycleCalls).toBe(0);
    expect(await readCurrent(fixture.preflight)).toMatchObject({
      sequence: 4,
      phase: 'cleanup_required',
    });
  });

  it('does not DELETE when the journal-before-delete append fails', async () => {
    const fixture = await createCleanupRequiredFixture();
    let deleteCount = 0;
    await expect(
      executeZoomDisposableCanaryReconciliationCleanup({
        preflight: fixture.preflight,
        stateSecret,
        providerCounts: providerCounts(),
        appendState: async () => {
          throw new Error('journal unavailable');
        },
        providerContext: async () => ({
          expectedHostUserId: 'protected-host-fixture',
          lifecycle: {
            reconcileDeleteExactMeeting: async (input) => {
              await input.beforeDelete();
              deleteCount += 1;
              return { delete_executed: true, absent_verified: true };
            },
            verifyCanonicalAbsence: async () => ({ absent_verified: true }),
          },
        }),
      }),
    ).rejects.toThrow('journal unavailable');
    expect(deleteCount).toBe(0);
    expect(await readCurrent(fixture.preflight)).toMatchObject({
      sequence: 4,
      phase: 'cleanup_required',
    });
  });
});

async function createCleanupRequiredFixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'onetime-zoom-reconcile-'));
  temporaryDirectories.push(directory);
  const statePath = path.join(directory, 'state', 'canary.jsonl');
  const keyholderDir = path.join(directory, 'keyholder');
  const preflight: ZoomDisposableCanaryReconciliationPreflight = {
    operationId,
    executionHead: ZOOM_DISPOSABLE_CANARY_ORIGINAL_EXECUTION_HEAD,
    repairHead: 'b'.repeat(40),
    origin: ZOOM_DISPOSABLE_CANARY_ORIGIN,
    statePath,
    keyholderDir,
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
  return { preflight, cleanupRequired };
}

async function readJournal(preflight: ZoomDisposableCanaryReconciliationPreflight) {
  return readZoomDisposableCanaryJournal(preflight.statePath, stateSecret, {
    operationId,
    executionHead: ZOOM_DISPOSABLE_CANARY_ORIGINAL_EXECUTION_HEAD,
    origin: ZOOM_DISPOSABLE_CANARY_ORIGIN,
  });
}

async function readCurrent(preflight: ZoomDisposableCanaryReconciliationPreflight) {
  return (await readJournal(preflight)).current as ZoomDisposableCanaryState;
}
