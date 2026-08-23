import type {
  ParentLearningActionDescriptor,
  ParentProductionBasicLaunchArtifact,
  RecordParentAttendanceCommand,
} from './api.ts';

export type ParentClassroomLaunchStatus =
  'idle' | 'requesting' | 'joining' | 'connected' | 'connection_error' | 'unknown_effect';

export type ParentClassroomSdkJoinInput = {
  sdkWebVersion: string;
  meetingNumber: string;
  meetingPassword: string;
  signature: string;
  userName: string;
  leaveUrl: '/app/parent';
  onMeetingStatus?: ((status: 1 | 2 | 3 | 4) => void) | undefined;
};

export type ParentClassroomSdkJoin = (input: ParentClassroomSdkJoinInput) => Promise<void>;

export function createParentClassroomLaunchController(input: {
  requestArtifact: (
    action: ParentLearningActionDescriptor,
    csrfToken: string,
  ) => Promise<ParentProductionBasicLaunchArtifact>;
  joinMeeting: ParentClassroomSdkJoin;
  recordAttendance: (command: RecordParentAttendanceCommand, csrfToken: string) => Promise<unknown>;
  connectionLineageId?: () => string;
  now?: () => Date;
  onStatus?: (status: ParentClassroomLaunchStatus) => void;
}) {
  const now = input.now ?? (() => new Date());
  const nextConnectionLineageId = input.connectionLineageId ?? secureConnectionLineageId;
  let active = true;
  let status: ParentClassroomLaunchStatus = 'idle';
  let artifact: ParentProductionBasicLaunchArtifact | null = null;
  let attendance: {
    occurrenceId: string;
    csrfToken: string;
    connectionLineageId: string;
    joined: boolean;
    left: boolean;
  } | null = null;
  const pendingAttendance = new Set<Promise<void>>();
  let attendanceTail = Promise.resolve();

  function publish(next: ParentClassroomLaunchStatus) {
    status = next;
    if (active) input.onStatus?.(next);
    return next;
  }

  async function join(current: ParentProductionBasicLaunchArtifact) {
    if (!active) return status;
    if (!isLiveArtifact(current, now())) {
      artifact = null;
      return publish('unknown_effect');
    }
    publish('joining');
    try {
      await input.joinMeeting(toParentClassroomSdkJoinInput(current, handleMeetingStatus));
      if (!active) return status;
      artifact = null;
      return publish('connected');
    } catch {
      if (!active) return status;
      return publish('connection_error');
    }
  }

  function handleMeetingStatus(meetingStatus: 1 | 2 | 3 | 4) {
    if (!active) return;
    if (meetingStatus === 2) recordAttendance('joined');
    if (meetingStatus === 3 && attendance?.joined) recordAttendance('left');
  }

  function recordAttendance(eventKind: RecordParentAttendanceCommand['event_kind']) {
    const current = attendance;
    if (!current) return;
    if (eventKind === 'joined') {
      if (current.joined) return;
      current.joined = true;
    } else {
      if (!current.joined || current.left) return;
      current.left = true;
    }
    const request = attendanceTail
      .then(() =>
        input.recordAttendance(
          {
            occurrence_id: current.occurrenceId,
            event_kind: eventKind,
            connection_lineage_id: current.connectionLineageId,
          },
          current.csrfToken,
        ),
      )
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => pendingAttendance.delete(request));
    attendanceTail = request;
    pendingAttendance.add(request);
  }

  return {
    activate() {
      active = true;
    },

    dispose() {
      recordAttendance('left');
      active = false;
      artifact = null;
      attendance = null;
    },

    status() {
      return status;
    },

    async launch(action: ParentLearningActionDescriptor, csrfToken: string, occurrenceId: string) {
      if (!active || status !== 'idle') return status;
      publish('requesting');
      try {
        const nextAttendance = {
          occurrenceId: requireIdentifier(occurrenceId, 'occurrence'),
          csrfToken,
          connectionLineageId: requireIdentifier(nextConnectionLineageId(), 'connection lineage'),
          joined: false,
          left: false,
        };
        const nextArtifact = await input.requestArtifact(action, csrfToken);
        if (!active) return status;
        artifact = nextArtifact;
        attendance = nextAttendance;
        return join(nextArtifact);
      } catch {
        artifact = null;
        attendance = null;
        return active ? publish('unknown_effect') : status;
      }
    },

    async retryConnection() {
      if (!active || status !== 'connection_error' || !artifact) return status;
      return join(artifact);
    },

    async flushAttendance() {
      await Promise.allSettled([...pendingAttendance]);
    },
  };
}

export function toParentClassroomSdkJoinInput(
  artifact: ParentProductionBasicLaunchArtifact,
  onMeetingStatus?: ParentClassroomSdkJoinInput['onMeetingStatus'],
): ParentClassroomSdkJoinInput {
  return {
    sdkWebVersion: artifact.sdk_web_version,
    meetingNumber: artifact.meeting_number,
    meetingPassword: artifact.meeting_password,
    signature: artifact.signature,
    userName: artifact.user_name,
    leaveUrl: artifact.leave_path,
    ...(onMeetingStatus ? { onMeetingStatus } : {}),
  };
}

function isLiveArtifact(artifact: ParentProductionBasicLaunchArtifact, now: Date) {
  const expiresAt = new Date(artifact.expires_at);
  return (
    Number.isFinite(now.getTime()) &&
    Number.isFinite(expiresAt.getTime()) &&
    expiresAt.getTime() > now.getTime()
  );
}

function requireIdentifier(value: string, label: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(value)) {
    throw new Error(`Parent classroom ${label} is invalid.`);
  }
  return value;
}

function secureConnectionLineageId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `parent-classroom-${globalThis.crypto.randomUUID()}`;
  }
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new Error('Secure browser randomness is required for Parent classroom attendance.');
  }
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  const encoded = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  if (/^0+$/u.test(encoded)) {
    throw new Error('Secure browser randomness is required for Parent classroom attendance.');
  }
  return `parent-classroom-${encoded}`;
}
