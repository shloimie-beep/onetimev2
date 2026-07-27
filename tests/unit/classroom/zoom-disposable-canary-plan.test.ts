import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertZoomDisposableCanaryCleanupPreflight,
  assertZoomDisposableCanaryJournal,
  assertZoomDisposableCanaryProvisionPreflight,
  assertZoomDisposableCanaryReconciliationJournal,
  assertZoomDisposableCanaryReconciliationPreflight,
  assertZoomDisposableCanaryScopeDiagnosticPreflight,
  buildZoomDisposableCanarySanitizedResult,
  createZoomDisposableCanaryIntent,
  parseZoomDisposableCanaryState,
  transitionZoomDisposableCanaryState,
  ZOOM_DISPOSABLE_CANARY_ATTESTATION,
  ZOOM_DISPOSABLE_CANARY_CLEANUP_AUTHORIZATION,
  ZOOM_DISPOSABLE_CANARY_ORIGINAL_EXECUTION_HEAD,
  ZOOM_DISPOSABLE_CANARY_ORIGIN,
  ZOOM_DISPOSABLE_CANARY_PROVISION_AUTHORIZATION,
  ZOOM_DISPOSABLE_CANARY_RECONCILIATION_AUTHORIZATION,
  ZOOM_DISPOSABLE_CANARY_SCOPE_DIAGNOSTIC_AUTHORIZATION,
} from '../../../scripts/zoom-disposable-canary-plan.ts';

const operationId = '123e4567-e89b-42d3-a456-426614174000';
const executionHead = 'a'.repeat(40);
const stateSecret = 'state-secret-fixture-that-is-longer-than-thirty-two-characters';
const now = new Date('2026-07-24T10:00:00.000Z');
const repositoryRoot = path.resolve(process.cwd());
const keyholderDir = path.resolve(repositoryRoot, '..', 'one-time-zoom-private-test');
const statePath = path.join(keyholderDir, 'incoming', `${operationId}.jsonl`);

function provisionEnvironment(): NodeJS.ProcessEnv {
  return {
    ONE_TIME_RUNTIME_ENVIRONMENT: 'isolated_staging',
    ZOOM_CLASSROOM_ENABLED: 'true',
    ZOOM_CLASSROOM_PROVIDER_MODE: 'sink',
    ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED: 'false',
    ZOOM_CLASSROOM_CANARY_ENABLED: 'false',
    ZOOM_DISTINCT_DISPOSABLE_ISOLATED_CANARY_ATTESTATION: ZOOM_DISPOSABLE_CANARY_ATTESTATION,
    ZOOM_REAL_CONTROL_PROVISION_AUTHORIZATION: ZOOM_DISPOSABLE_CANARY_PROVISION_AUTHORIZATION,
    ZOOM_CLASSROOM_CANARY_LEARNER_KEY: 'full_app_preview_student_1',
    PUBLIC_BASE_URL: ZOOM_DISPOSABLE_CANARY_ORIGIN,
    ZOOM_MEETING_SDK_ALLOWED_ORIGIN: ZOOM_DISPOSABLE_CANARY_ORIGIN,
    ZOOM_REAL_CONTROL_EXPECTED_SOURCE_SHA: executionHead,
    RAILWAY_GIT_COMMIT_SHA: executionHead,
    ZOOM_DISPOSABLE_CANARY_OPERATION_ID: operationId,
    ZOOM_DISPOSABLE_CANARY_CLEANUP_DEADLINE: '2026-07-24T13:00:00.000Z',
    ONE_TIME_ZOOM_KEYHOLDER_DIR: keyholderDir,
    ZOOM_DISPOSABLE_CANARY_STATE_PATH: statePath,
  };
}

function reconciliationEnvironment(): NodeJS.ProcessEnv {
  const repairHead = 'b'.repeat(40);
  const source = provisionEnvironment();
  delete source.ZOOM_REAL_CONTROL_PROVISION_AUTHORIZATION;
  delete source.ZOOM_DISPOSABLE_CANARY_CLEANUP_DEADLINE;
  return {
    ...source,
    ZOOM_REAL_CONTROL_EXPECTED_SOURCE_SHA: ZOOM_DISPOSABLE_CANARY_ORIGINAL_EXECUTION_HEAD,
    RAILWAY_GIT_COMMIT_SHA: repairHead,
    ZOOM_DISPOSABLE_CANARY_REPAIR_EXPECTED_SOURCE_SHA: repairHead,
    ZOOM_DISPOSABLE_CANARY_CLEANUP_AUTHORIZATION: ZOOM_DISPOSABLE_CANARY_CLEANUP_AUTHORIZATION,
    ZOOM_DISPOSABLE_CANARY_RECONCILIATION_AUTHORIZATION:
      ZOOM_DISPOSABLE_CANARY_RECONCILIATION_AUTHORIZATION,
  };
}

function diagnosticEnvironment(): NodeJS.ProcessEnv {
  const source = reconciliationEnvironment();
  delete source.ZOOM_DISPOSABLE_CANARY_CLEANUP_AUTHORIZATION;
  delete source.ZOOM_DISPOSABLE_CANARY_RECONCILIATION_AUTHORIZATION;
  return {
    ...source,
    ZOOM_DISPOSABLE_CANARY_SCOPE_DIAGNOSTIC_AUTHORIZATION:
      ZOOM_DISPOSABLE_CANARY_SCOPE_DIAGNOSTIC_AUTHORIZATION,
  };
}

describe('distinct disposable PR #105 Zoom canary plan', () => {
  it('accepts only exact-source isolated sink-mode Student 1 provisioning', () => {
    expect(
      assertZoomDisposableCanaryProvisionPreflight(provisionEnvironment(), {
        now,
        repositoryRoot,
      }),
    ).toMatchObject({
      operationId,
      executionHead,
      origin: ZOOM_DISPOSABLE_CANARY_ORIGIN,
      learnerKey: 'full_app_preview_student_1',
      cleanupDeadline: '2026-07-24T13:00:00.000Z',
    });
  });

  it.each([
    ['ONE_TIME_RUNTIME_ENVIRONMENT', 'production'],
    ['ZOOM_CLASSROOM_PROVIDER_MODE', 'real'],
    ['ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED', 'true'],
    ['ZOOM_CLASSROOM_CANARY_ENABLED', 'true'],
    ['ZOOM_CLASSROOM_CANARY_LEARNER_KEY', 'full_app_preview_student_2'],
    ['PUBLIC_BASE_URL', 'https://ot99-web-staging.up.railway.app'],
    ['ZOOM_MEETING_SDK_ALLOWED_ORIGIN', 'https://example.test'],
    ['RAILWAY_GIT_COMMIT_SHA', 'b'.repeat(40)],
  ])('rejects unsafe %s before protected inputs', (variable, value) => {
    expect(() =>
      assertZoomDisposableCanaryProvisionPreflight(
        { ...provisionEnvironment(), [variable]: value },
        { now, repositoryRoot },
      ),
    ).toThrow('ZOOM_DISPOSABLE_CANARY_PREFLIGHT_FAILED');
  });

  it('rejects legacy rotation, protected targets, existing meeting inputs, and BNA keyholder scope', () => {
    for (const forbidden of [
      'ZOOM_PROTECTED_TARGET_ROTATION_ATTESTATION',
      'ONE_TIME_PROTECTED_CLASS_TARGET_URL',
      'ONE_TIME_TISHA_BAV_2026_ZOOM_JOIN_URL',
      'ZOOM_REAL_CONTROL_MEETING_ID',
      'ZOOM_REAL_CONTROL_MEETING_PASSCODE',
      'BNA_KEYHOLDER_DIR',
    ]) {
      expect(() =>
        assertZoomDisposableCanaryProvisionPreflight(
          { ...provisionEnvironment(), [forbidden]: '' },
          { now, repositoryRoot },
        ),
      ).toThrow('ZOOM_DISPOSABLE_CANARY_PREFLIGHT_FAILED');
    }
  });

  it('requires a bounded cleanup deadline and private One Time-owned paths outside Git', () => {
    expect(() =>
      assertZoomDisposableCanaryProvisionPreflight(
        {
          ...provisionEnvironment(),
          ZOOM_DISPOSABLE_CANARY_CLEANUP_DEADLINE: '2026-07-25T10:00:00.000Z',
        },
        { now, repositoryRoot },
      ),
    ).toThrow('ZOOM_DISPOSABLE_CANARY_PREFLIGHT_FAILED:CLEANUP_DEADLINE');
    expect(() =>
      assertZoomDisposableCanaryProvisionPreflight(
        {
          ...provisionEnvironment(),
          ONE_TIME_ZOOM_KEYHOLDER_DIR: repositoryRoot,
          ZOOM_DISPOSABLE_CANARY_STATE_PATH: path.join(repositoryRoot, 'private-state.jsonl'),
        },
        { now, repositoryRoot },
      ),
    ).toThrow('ZOOM_DISPOSABLE_CANARY_PREFLIGHT_FAILED:PRIVATE_PATH');
  });

  it('separates cleanup authority from provisioning authority', () => {
    const cleanup: NodeJS.ProcessEnv = {
      ...provisionEnvironment(),
      ZOOM_DISPOSABLE_CANARY_CLEANUP_AUTHORIZATION: ZOOM_DISPOSABLE_CANARY_CLEANUP_AUTHORIZATION,
    };
    delete cleanup.ZOOM_REAL_CONTROL_PROVISION_AUTHORIZATION;
    delete cleanup.ZOOM_DISPOSABLE_CANARY_CLEANUP_DEADLINE;
    expect(assertZoomDisposableCanaryCleanupPreflight(cleanup, { repositoryRoot })).toMatchObject({
      operationId,
      executionHead,
    });
    expect(() =>
      assertZoomDisposableCanaryCleanupPreflight(
        {
          ...cleanup,
          ZOOM_REAL_CONTROL_PROVISION_AUTHORIZATION: ZOOM_DISPOSABLE_CANARY_PROVISION_AUTHORIZATION,
        },
        { repositoryRoot },
      ),
    ).toThrow('ZOOM_DISPOSABLE_CANARY_PREFLIGHT_FAILED:PROVISION_AUTHORIZATION_MUST_BE_CLEARED');
  });

  it('binds reconciliation to the original journal head and a distinct exact repair head', () => {
    expect(
      assertZoomDisposableCanaryReconciliationPreflight(reconciliationEnvironment(), {
        repositoryRoot,
      }),
    ).toMatchObject({
      operationId,
      executionHead: ZOOM_DISPOSABLE_CANARY_ORIGINAL_EXECUTION_HEAD,
      repairHead: 'b'.repeat(40),
      origin: ZOOM_DISPOSABLE_CANARY_ORIGIN,
    });
  });

  it.each([
    ['ZOOM_REAL_CONTROL_EXPECTED_SOURCE_SHA', 'c'.repeat(40)],
    ['ZOOM_DISPOSABLE_CANARY_REPAIR_EXPECTED_SOURCE_SHA', 'c'.repeat(40)],
    ['RAILWAY_GIT_COMMIT_SHA', 'c'.repeat(40)],
    ['ZOOM_DISPOSABLE_CANARY_RECONCILIATION_AUTHORIZATION', 'DELETE_ANY_MEETING'],
    ['ZOOM_DISPOSABLE_CANARY_CLEANUP_AUTHORIZATION', 'DELETE_ANY_MEETING'],
  ])('rejects reconciliation source or authorization drift in %s', (variable, value) => {
    expect(() =>
      assertZoomDisposableCanaryReconciliationPreflight(
        { ...reconciliationEnvironment(), [variable]: value },
        { repositoryRoot },
      ),
    ).toThrow('ZOOM_DISPOSABLE_CANARY_PREFLIGHT_FAILED');
  });

  it('rejects a repair deployment that reuses the original execution head', () => {
    expect(() =>
      assertZoomDisposableCanaryReconciliationPreflight(
        {
          ...reconciliationEnvironment(),
          RAILWAY_GIT_COMMIT_SHA: ZOOM_DISPOSABLE_CANARY_ORIGINAL_EXECUTION_HEAD,
          ZOOM_DISPOSABLE_CANARY_REPAIR_EXPECTED_SOURCE_SHA:
            ZOOM_DISPOSABLE_CANARY_ORIGINAL_EXECUTION_HEAD,
        },
        { repositoryRoot },
      ),
    ).toThrow('ZOOM_DISPOSABLE_CANARY_PREFLIGHT_FAILED:REPAIR_SOURCE_SHA');
  });

  it('binds the scope diagnostic to the original journal and exact deployed diagnostic source', () => {
    expect(
      assertZoomDisposableCanaryScopeDiagnosticPreflight(diagnosticEnvironment(), {
        repositoryRoot,
      }),
    ).toMatchObject({
      operationId,
      executionHead: ZOOM_DISPOSABLE_CANARY_ORIGINAL_EXECUTION_HEAD,
      repairHead: 'b'.repeat(40),
      origin: ZOOM_DISPOSABLE_CANARY_ORIGIN,
    });
  });

  it.each([
    ['ZOOM_REAL_CONTROL_PROVISION_AUTHORIZATION', ''],
    ['ZOOM_DISPOSABLE_CANARY_CLEANUP_AUTHORIZATION', ''],
    ['ZOOM_DISPOSABLE_CANARY_RECONCILIATION_AUTHORIZATION', ''],
  ])('rejects %s from the mutation-impossible diagnostic environment', (variable, value) => {
    expect(() =>
      assertZoomDisposableCanaryScopeDiagnosticPreflight(
        { ...diagnosticEnvironment(), [variable]: value },
        { repositoryRoot },
      ),
    ).toThrow(`ZOOM_DISPOSABLE_CANARY_PREFLIGHT_FAILED:DIAGNOSTIC_FORBIDDEN_${variable}`);
  });

  it.each([
    ['ZOOM_DISPOSABLE_CANARY_SCOPE_DIAGNOSTIC_AUTHORIZATION', 'CLASSIFY_ANY_MEETING'],
    ['ZOOM_REAL_CONTROL_EXPECTED_SOURCE_SHA', 'c'.repeat(40)],
    ['ZOOM_DISPOSABLE_CANARY_REPAIR_EXPECTED_SOURCE_SHA', 'c'.repeat(40)],
    ['RAILWAY_GIT_COMMIT_SHA', 'c'.repeat(40)],
  ])('rejects diagnostic source or authorization drift in %s', (variable, value) => {
    expect(() =>
      assertZoomDisposableCanaryScopeDiagnosticPreflight(
        { ...diagnosticEnvironment(), [variable]: value },
        { repositoryRoot },
      ),
    ).toThrow('ZOOM_DISPOSABLE_CANARY_PREFLIGHT_FAILED');
  });

  it('binds a signed v3 journal to source, operation, exact topic, and Student 1', () => {
    const intent = createZoomDisposableCanaryIntent({
      operationId,
      executionHead,
      cleanupDeadline: '2026-07-24T13:00:00.000Z',
      hostUserId: 'protected-host-fixture',
      startsAt: new Date('2026-07-24T11:00:00.000Z'),
      now,
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
      new Date('2026-07-24T10:01:00.000Z'),
    );
    const inFlight = transitionZoomDisposableCanaryState(
      meeting,
      { phase: 'registration_in_flight' },
      stateSecret,
      new Date('2026-07-24T10:02:00.000Z'),
    );
    const ready = transitionZoomDisposableCanaryState(
      inFlight,
      {
        phase: 'ready',
        registration_disabled_for_sdk_join: true,
        registrants: [
          {
            learner_key: 'full_app_preview_student_1',
            registrant_token_ref: 'protected-registrant-ref-fixture',
          },
        ],
      },
      stateSecret,
      new Date('2026-07-24T10:03:00.000Z'),
    );
    expect(assertZoomDisposableCanaryJournal([intent, meeting, inFlight, ready])).toBe(ready);
    expect(
      parseZoomDisposableCanaryState(ready, stateSecret, {
        operationId,
        executionHead,
        origin: ZOOM_DISPOSABLE_CANARY_ORIGIN,
      }),
    ).toEqual(ready);
  });

  it('rejects v2, wrong source, tampering, unknown fields, and raw provider material', () => {
    const intent = createZoomDisposableCanaryIntent({
      operationId,
      executionHead,
      cleanupDeadline: '2026-07-24T13:00:00.000Z',
      hostUserId: 'protected-host-fixture',
      startsAt: new Date('2026-07-24T11:00:00.000Z'),
      now,
      stateSecret,
    });
    for (const invalid of [
      { ...intent, schema_version: 2 },
      { ...intent, execution_head: 'b'.repeat(40) },
      { ...intent, extra: true },
      { ...intent, registrants: [{ email: 'must-not-be-retained@example.test' }] },
    ]) {
      expect(() => parseZoomDisposableCanaryState(invalid, stateSecret)).toThrow(
        'ZOOM_DISPOSABLE_CANARY_STATE_INVALID',
      );
    }
    expect(() =>
      parseZoomDisposableCanaryState(intent, stateSecret, {
        executionHead: 'b'.repeat(40),
      }),
    ).toThrow('ZOOM_DISPOSABLE_CANARY_STATE_INVALID:SOURCE');
    expect(() =>
      parseZoomDisposableCanaryState(intent, stateSecret, {
        operationId: '123e4567-e89b-42d3-a456-426614174001',
      }),
    ).toThrow('ZOOM_DISPOSABLE_CANARY_STATE_INVALID:OPERATION');
    expect(() =>
      parseZoomDisposableCanaryState(intent, stateSecret, {
        origin: 'https://example.test',
      }),
    ).toThrow('ZOOM_DISPOSABLE_CANARY_STATE_INVALID:ORIGIN');
  });

  it('accepts only the exact sequence-4 cleanup journal and its repair tombstone chain', () => {
    const states = reconciliationJournal();
    expect(assertZoomDisposableCanaryReconciliationJournal(states)).toMatchObject({
      sequence: 4,
      phase: 'cleanup_required',
      failure_category: 'registration_outcome_ambiguous',
    });
    const deleteInFlight = transitionZoomDisposableCanaryState(
      states[3]!,
      {
        phase: 'cleanup_delete_in_flight',
        reconciliation_repair_head: 'b'.repeat(40),
      },
      stateSecret,
    );
    expect(
      assertZoomDisposableCanaryReconciliationJournal([...states, deleteInFlight], 'b'.repeat(40)),
    ).toMatchObject({ sequence: 5, phase: 'cleanup_delete_in_flight' });
    expect(() =>
      parseZoomDisposableCanaryState(
        { ...deleteInFlight, reconciliation_repair_head: 'c'.repeat(40) },
        stateSecret,
      ),
    ).toThrow('ZOOM_DISPOSABLE_CANARY_STATE_INVALID:MAC');
    const deleted = transitionZoomDisposableCanaryState(
      deleteInFlight,
      { phase: 'deleted' },
      stateSecret,
    );
    expect(
      assertZoomDisposableCanaryReconciliationJournal(
        [...states, deleteInFlight, deleted],
        'b'.repeat(40),
      ),
    ).toMatchObject({ sequence: 6, phase: 'deleted' });
    expect(() =>
      assertZoomDisposableCanaryReconciliationJournal(
        [...states, deleteInFlight, deleted],
        'c'.repeat(40),
      ),
    ).toThrow('ZOOM_DISPOSABLE_CANARY_STATE_INVALID:RECONCILIATION_STATE');
  });

  it('rejects another source, another outcome, and a broken HMAC chain for reconciliation', () => {
    const wrongSourceIntent = createZoomDisposableCanaryIntent({
      operationId,
      executionHead: 'b'.repeat(40),
      cleanupDeadline: '2026-07-24T13:00:00.000Z',
      hostUserId: 'protected-host-fixture',
      startsAt: new Date('2026-07-24T11:00:00.000Z'),
      now,
      stateSecret,
    });
    expect(() => assertZoomDisposableCanaryReconciliationJournal([wrongSourceIntent])).toThrow(
      'ZOOM_DISPOSABLE_CANARY_STATE_INVALID:RECONCILIATION_SOURCE',
    );

    const states = reconciliationJournal();
    const wrongOutcome = transitionZoomDisposableCanaryState(
      states[2]!,
      {
        phase: 'cleanup_required',
        failure_category: 'registration_disable_unverified',
      },
      stateSecret,
    );
    expect(() =>
      assertZoomDisposableCanaryReconciliationJournal([...states.slice(0, 3), wrongOutcome]),
    ).toThrow('ZOOM_DISPOSABLE_CANARY_STATE_INVALID:RECONCILIATION_STATE');

    expect(() =>
      assertZoomDisposableCanaryReconciliationJournal([
        ...states.slice(0, 3),
        { ...states[3]!, previous_state_mac: '0'.repeat(64) },
      ]),
    ).toThrow('ZOOM_DISPOSABLE_CANARY_STATE_INVALID:JOURNAL_CHAIN');
  });

  it('writes a secret-free deleted tombstone and sanitized result', () => {
    const intent = createZoomDisposableCanaryIntent({
      operationId,
      executionHead,
      cleanupDeadline: '2026-07-24T13:00:00.000Z',
      hostUserId: 'protected-host-fixture',
      startsAt: new Date('2026-07-24T11:00:00.000Z'),
      now,
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
    const deleted = transitionZoomDisposableCanaryState(meeting, { phase: 'deleted' }, stateSecret);
    const output = buildZoomDisposableCanarySanitizedResult({
      state: deleted,
      providerCounts: { oauth: 1, get: 2, post: 0, patch: 0, delete: 1 },
    });
    expect(deleted).not.toHaveProperty('meeting_id');
    expect(deleted).not.toHaveProperty('passcode');
    expect(deleted.registrants).toEqual([]);
    expect(output).toMatchObject({
      phase: 'deleted',
      tisha_target_bound: false,
      protected_class_target_bound: false,
      customer_invites_sent: false,
      deleted_tombstone_written: true,
    });
    expect(JSON.stringify(output)).not.toMatch(/protected-meeting|protected-passcode|@/u);
  });
});

function reconciliationJournal() {
  const intent = createZoomDisposableCanaryIntent({
    operationId,
    executionHead: ZOOM_DISPOSABLE_CANARY_ORIGINAL_EXECUTION_HEAD,
    cleanupDeadline: '2026-07-24T13:00:00.000Z',
    hostUserId: 'protected-host-fixture',
    startsAt: new Date('2026-07-24T11:00:00.000Z'),
    now,
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
  return [intent, meeting, registrationInFlight, cleanupRequired];
}
