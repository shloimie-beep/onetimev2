export const ZOOM_REAL_CONTROL_STUDENT_1_LEARNER_KEY = 'full_app_preview_student_1';
export const ZOOM_REAL_CONTROL_PROVISION_AUTHORIZATION = 'PROVISION_FICTIONAL_STUDENT_1_ONCE';
export const ZOOM_PROTECTED_TARGET_ROTATION_ATTESTATION = 'OLD_TARGET_REVOKED_REPLACEMENT_VALID';

export type ZoomRealControlProtectedState = {
  schema_version: 2;
  status: 'meeting_created' | 'registrant_created' | 'registration_blocked';
  registration_block_reason?: 'registration_not_enabled' | undefined;
  registration_disabled_for_sdk_join?: boolean | undefined;
  created_at: string;
  meeting_id: string;
  passcode: string;
  starts_at: string;
  registrants: Array<{
    learner_key: typeof ZOOM_REAL_CONTROL_STUDENT_1_LEARNER_KEY;
    registrant_token_ref: string;
  }>;
};

export function assertZoomRealControlProvisionPreflight(source: NodeJS.ProcessEnv) {
  if (source.ONE_TIME_RUNTIME_ENVIRONMENT !== 'isolated_staging') {
    throw new Error('ZOOM_REAL_CONTROL_PREFLIGHT_FAILED:ONE_TIME_RUNTIME_ENVIRONMENT');
  }
  if (
    source.ZOOM_REAL_CONTROL_PROVISION_AUTHORIZATION !== ZOOM_REAL_CONTROL_PROVISION_AUTHORIZATION
  ) {
    throw new Error('ZOOM_REAL_CONTROL_PREFLIGHT_FAILED:ZOOM_REAL_CONTROL_PROVISION_AUTHORIZATION');
  }
  if (
    source.ZOOM_PROTECTED_TARGET_ROTATION_ATTESTATION !== ZOOM_PROTECTED_TARGET_ROTATION_ATTESTATION
  ) {
    throw new Error(
      'ZOOM_REAL_CONTROL_PREFLIGHT_FAILED:ZOOM_PROTECTED_TARGET_ROTATION_ATTESTATION',
    );
  }
  if (source.ZOOM_CLASSROOM_CANARY_LEARNER_KEY !== ZOOM_REAL_CONTROL_STUDENT_1_LEARNER_KEY) {
    throw new Error('ZOOM_REAL_CONTROL_PREFLIGHT_FAILED:ZOOM_CLASSROOM_CANARY_LEARNER_KEY');
  }
  return {
    learnerKey: ZOOM_REAL_CONTROL_STUDENT_1_LEARNER_KEY,
    studentNumber: 1 as const,
  };
}

export function parseZoomRealControlProtectedState(value: unknown): ZoomRealControlProtectedState {
  if (!value || typeof value !== 'object') {
    throw new Error('ZOOM_REAL_CONTROL_STATE_INVALID: protected state could not be resumed.');
  }
  const state = value as Partial<ZoomRealControlProtectedState>;
  if (
    state.schema_version !== 2 ||
    !state.meeting_id ||
    !state.passcode ||
    !state.created_at ||
    !state.starts_at ||
    !Array.isArray(state.registrants) ||
    !['meeting_created', 'registrant_created', 'registration_blocked'].includes(
      String(state.status),
    )
  ) {
    throw new Error('ZOOM_REAL_CONTROL_STATE_INVALID: protected state could not be resumed.');
  }
  if (
    state.registrants.length > 1 ||
    state.registrants.some((registrant) => {
      const raw = registrant as unknown as Record<string, unknown>;
      return (
        registrant.learner_key !== ZOOM_REAL_CONTROL_STUDENT_1_LEARNER_KEY ||
        typeof registrant.registrant_token_ref !== 'string' ||
        registrant.registrant_token_ref.length < 1 ||
        'email' in raw ||
        'registrant_token' in raw ||
        'join_url' in raw
      );
    })
  ) {
    throw new Error(
      'ZOOM_REAL_CONTROL_CANARY_SCOPE_INVALID: only fictional Student 1 is permitted.',
    );
  }
  return state as ZoomRealControlProtectedState;
}

export function assertZoomRealControlProvisionedState(state: ZoomRealControlProtectedState) {
  if (
    state.status !== 'registrant_created' ||
    state.registration_disabled_for_sdk_join !== true ||
    state.registrants.length !== 1 ||
    state.registrants[0]?.learner_key !== ZOOM_REAL_CONTROL_STUDENT_1_LEARNER_KEY
  ) {
    throw new Error(
      'ZOOM_REAL_CONTROL_CANARY_SCOPE_INVALID: Student 1 provisioning is incomplete.',
    );
  }
}

export function buildZoomRealControlSanitizedResult(input: {
  state: ZoomRealControlProtectedState;
  resumedExistingMeeting: boolean;
}) {
  return {
    meeting_created: true,
    resumed_existing_meeting: input.resumedExistingMeeting,
    fictional_registrant_count: input.state.registrants.length,
    student_1_created: input.state.status === 'registrant_created',
    students_2_3_created: false,
    registration_disabled_for_sdk_join: input.state.registration_disabled_for_sdk_join === true,
    registration_block_reason: input.state.registration_block_reason ?? null,
    protected_state_written: true,
    invitations_sent: false,
    raw_join_url_printed: false,
    passcode_printed: false,
    token_printed: false,
    private_destination_printed: false,
  };
}
