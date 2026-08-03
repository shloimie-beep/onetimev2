import { describe, expect, it } from 'vitest';
import {
  assertZoomRealControlProvisionedState,
  assertZoomRealControlProvisionPreflight,
  buildZoomRealControlSanitizedResult,
  parseZoomRealControlProtectedState,
  ZOOM_PROTECTED_TARGET_ROTATION_ATTESTATION,
  ZOOM_REAL_CONTROL_PROVISION_AUTHORIZATION,
  ZOOM_REAL_CONTROL_STUDENT_1_LEARNER_KEY,
  type ZoomRealControlProtectedState,
} from '../../../scripts/zoom-real-control-plan.ts';

const authorizedEnvironment: NodeJS.ProcessEnv = {
  ONE_TIME_RUNTIME_ENVIRONMENT: 'isolated_staging',
  ZOOM_REAL_CONTROL_PROVISION_AUTHORIZATION,
  ZOOM_PROTECTED_TARGET_ROTATION_ATTESTATION,
  ZOOM_CLASSROOM_CANARY_LEARNER_KEY: ZOOM_REAL_CONTROL_STUDENT_1_LEARNER_KEY,
};

describe('Zoom real-control Student 1 provisioning plan', () => {
  it('authorizes exactly fictional Student 1 without any OBS prerequisite', () => {
    expect(assertZoomRealControlProvisionPreflight(authorizedEnvironment)).toEqual({
      learnerKey: 'full_app_preview_student_1',
      studentNumber: 1,
    });
    expect(authorizedEnvironment).not.toHaveProperty('OBS_WEBSOCKET_URL');
  });

  it.each([
    [
      'ONE_TIME_RUNTIME_ENVIRONMENT',
      'ZOOM_REAL_CONTROL_PREFLIGHT_FAILED:ONE_TIME_RUNTIME_ENVIRONMENT',
    ],
    [
      'ZOOM_REAL_CONTROL_PROVISION_AUTHORIZATION',
      'ZOOM_REAL_CONTROL_PREFLIGHT_FAILED:ZOOM_REAL_CONTROL_PROVISION_AUTHORIZATION',
    ],
    [
      'ZOOM_PROTECTED_TARGET_ROTATION_ATTESTATION',
      'ZOOM_REAL_CONTROL_PREFLIGHT_FAILED:ZOOM_PROTECTED_TARGET_ROTATION_ATTESTATION',
    ],
    [
      'ZOOM_CLASSROOM_CANARY_LEARNER_KEY',
      'ZOOM_REAL_CONTROL_PREFLIGHT_FAILED:ZOOM_CLASSROOM_CANARY_LEARNER_KEY',
    ],
  ])('rejects before provisioning when %s is absent', (variableName, expectedError) => {
    const source = { ...authorizedEnvironment };
    delete source[variableName];
    expect(() => assertZoomRealControlProvisionPreflight(source)).toThrow(expectedError);
  });

  it('rejects legacy state and any Student 2 or Student 3 resume state', () => {
    expect(() =>
      parseZoomRealControlProtectedState({
        ...validState(),
        schema_version: 1,
      }),
    ).toThrow('ZOOM_REAL_CONTROL_STATE_INVALID');
    expect(() =>
      parseZoomRealControlProtectedState({
        ...validState(),
        registrants: [
          {
            learner_key: 'full_app_preview_student_2',
            registrant_token_ref: 'registrant_ref_2',
          },
        ],
      }),
    ).toThrow('ZOOM_REAL_CONTROL_CANARY_SCOPE_INVALID');
    expect(() =>
      parseZoomRealControlProtectedState({
        ...validState(),
        registrants: [
          {
            learner_key: ZOOM_REAL_CONTROL_STUDENT_1_LEARNER_KEY,
            registrant_token_ref: 'registrant_ref_1',
            registrant_token: 'must-not-be-retained',
          },
        ],
      }),
    ).toThrow('ZOOM_REAL_CONTROL_CANARY_SCOPE_INVALID');
  });

  it('accepts only one completed Student 1 state with registration disabled', () => {
    const state = parseZoomRealControlProtectedState(validState());
    expect(() => assertZoomRealControlProvisionedState(state)).not.toThrow();
    expect(() =>
      assertZoomRealControlProvisionedState({
        ...state,
        registration_disabled_for_sdk_join: false,
      }),
    ).toThrow('ZOOM_REAL_CONTROL_CANARY_SCOPE_INVALID');
  });

  it('keeps meeting references and digests out of sanitized stdout', () => {
    const protectedState = validState();
    const result = buildZoomRealControlSanitizedResult({
      state: protectedState,
      resumedExistingMeeting: false,
    });
    const stdout = JSON.stringify(result);

    expect(result).not.toHaveProperty('provider_meeting_ref_digest');
    expect(stdout).not.toContain(protectedState.meeting_id);
    expect(stdout).not.toContain(protectedState.passcode);
    expect(stdout).not.toContain(protectedState.registrants[0]?.registrant_token_ref);
  });
});

function validState(): ZoomRealControlProtectedState {
  return {
    schema_version: 2 as const,
    status: 'registrant_created' as const,
    registration_disabled_for_sdk_join: true,
    created_at: '2026-07-23T10:00:00.000Z',
    meeting_id: 'protected-meeting-reference',
    passcode: 'protected-passcode',
    starts_at: '2026-07-23T11:00:00.000Z',
    registrants: [
      {
        learner_key: ZOOM_REAL_CONTROL_STUDENT_1_LEARNER_KEY,
        registrant_token_ref: 'registrant_ref_1',
      },
    ],
  };
}
