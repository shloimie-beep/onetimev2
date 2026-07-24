import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertZoomDisposableCanaryCleanupPreflight,
  assertZoomDisposableCanaryJournal,
  assertZoomDisposableCanaryProvisionPreflight,
  buildZoomDisposableCanarySanitizedResult,
  createZoomDisposableCanaryIntent,
  parseZoomDisposableCanaryState,
  transitionZoomDisposableCanaryState,
  ZOOM_DISPOSABLE_CANARY_ATTESTATION,
  ZOOM_DISPOSABLE_CANARY_CLEANUP_AUTHORIZATION,
  ZOOM_DISPOSABLE_CANARY_ORIGIN,
  ZOOM_DISPOSABLE_CANARY_PROVISION_AUTHORIZATION,
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
