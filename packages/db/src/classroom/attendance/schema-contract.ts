export const EMBEDDED_CLASSROOM_SCHEMA_CONTRACT_VERSION = '1.0.1' as const;

export const EMBEDDED_CLASSROOM_SCHEMA_CONTRACT = {
  launch_grants: 'onetime.classroom_launch_grants_v21',
  live_sessions: 'onetime.live_student_classroom_sessions',
  attendance_events: 'onetime.classroom_attendance_events_v21',
  attendance_projection: 'onetime.classroom_attendance_projection_v21',
  invariants: [
    'launch grants store digest-only exchange identity and are one-use with 60-second expiry',
    'one unexpired active live session is fenced per product/runtime/environment/student',
    'attendance source events are append-only and idempotent',
    'manual correction appends evidence and never deletes provider or client events',
  ],
} as const;
