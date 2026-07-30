import {
  CLASSROOM_HEARTBEAT_INTERVAL_MS,
  type EmbeddedJoinDenialCode,
} from '../../../../../../../packages/contracts/src/classroom/embedded/index.ts';

export interface StudentClassroomViewModel {
  join_enabled: boolean;
  status: 'ready' | 'joining' | 'connected' | 'denied' | 'unavailable';
  status_message: string;
  camera_guidance: string;
  recording_disclosure: string;
  recording_indicator_visible: boolean;
  next_heartbeat_in_ms: number | null;
}

export function createStudentClassroomViewModel(input: {
  state: StudentClassroomViewModel['status'];
  denial_code: EmbeddedJoinDenialCode | null;
  recording_capture_active: boolean;
  camera_permission: 'unknown' | 'allowed' | 'denied';
}): StudentClassroomViewModel {
  return {
    join_enabled: input.state === 'ready',
    status: input.state,
    status_message: message(input.state, input.denial_code),
    camera_guidance:
      input.camera_permission === 'denied'
        ? 'Camera permission is off. You can continue, and you can enable it in your browser settings.'
        : 'Please enable your camera when prompted. Your browser and device remain in control.',
    recording_disclosure:
      'This class may be recorded through the approved classroom recording process. Your current account-owner consent is checked before joining.',
    recording_indicator_visible:
      input.recording_capture_active && ['joining', 'connected'].includes(input.state),
    next_heartbeat_in_ms: input.state === 'connected' ? CLASSROOM_HEARTBEAT_INTERVAL_MS : null,
  };
}

export function nextClassroomHeartbeatAt(now: Date): string {
  return new Date(now.getTime() + CLASSROOM_HEARTBEAT_INTERVAL_MS).toISOString();
}

function message(
  state: StudentClassroomViewModel['status'],
  denialCode: EmbeddedJoinDenialCode | null,
): string {
  if (state === 'ready') return 'Your classroom is ready.';
  if (state === 'joining') return 'Joining your classroom securely…';
  if (state === 'connected') return 'You are connected to class.';
  if (state === 'unavailable') return 'The classroom is temporarily unavailable. Please try again.';
  if (denialCode === 'second_device_active') {
    return 'This Student already has an active classroom session. Reconnect on the same device or ask an Admin to reset it.';
  }
  if (denialCode === 'service_consent_required' || denialCode === 'recording_consent_required') {
    return 'Current account-owner consent is required before joining this recorded class.';
  }
  if (denialCode === 'join_not_open') return 'Join opens 10 minutes before class.';
  if (denialCode === 'occurrence_closed') return 'This classroom is closed.';
  return 'You cannot join this classroom right now.';
}
