import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Button, Card } from '@onetime/brand-system/react';
import {
  CLASSROOM_HEARTBEAT_INTERVAL_MS,
  type EmbeddedJoinDenialCode,
  type EphemeralMeetingSdkBootstrap,
} from '../../../../../../../packages/contracts/src/classroom/embedded/index.ts';
import {
  joinZoomMeetingParticipant,
  joinZoomMeetingProductionBasic,
  type ZoomParticipantJoinInput,
} from '../../zoom-meeting-sdk-client.ts';
import {
  readProductionBasicReadiness,
  requestProductionBasicLaunch,
} from '../../../classroom/production-basic-launch-client.ts';
import {
  StudentClassroomApiError,
  createStudentClassroomApi,
  type StudentClassroomApi,
  type StudentClassroomLease,
} from './api.ts';
import { createStudentClassroomViewModel, type StudentClassroomViewModel } from './view-model.ts';

type TimerHandle = ReturnType<typeof setTimeout>;

export type StudentClassroomWorkspaceProps = {
  occurrenceId: string | null;
  csrfToken: string;
  actorFingerprint: string;
  onProtectedStateCleared: () => void;
  api?: StudentClassroomApi;
  joinMeeting?: (input: ZoomParticipantJoinInput) => Promise<void>;
  now?: () => Date;
  setTimer?: (callback: () => void, delayMs: number) => TimerHandle;
  clearTimer?: (handle: TimerHandle) => void;
  navigate?: (path: '/app/student') => void;
};

const DEFAULT_NOW = () => new Date();
const DEFAULT_SET_TIMER = (callback: () => void, delayMs: number) =>
  globalThis.setTimeout(callback, delayMs);
const DEFAULT_CLEAR_TIMER = (handle: TimerHandle) => globalThis.clearTimeout(handle);
const DEFAULT_NAVIGATE = (path: '/app/student') => window.location.assign(path);

export function StudentClassroomWorkspace({
  occurrenceId,
  csrfToken,
  actorFingerprint,
  onProtectedStateCleared,
  api,
  joinMeeting = joinZoomMeetingParticipant,
  now = DEFAULT_NOW,
  setTimer = DEFAULT_SET_TIMER,
  clearTimer = DEFAULT_CLEAR_TIMER,
  navigate = DEFAULT_NAVIGATE,
}: StudentClassroomWorkspaceProps) {
  const classroomApi = useMemo(() => api ?? createStudentClassroomApi({ now }), [api, now]);
  const [status, setStatus] = useState<StudentClassroomViewModel['status']>(
    occurrenceId ? 'ready' : 'unavailable',
  );
  const [denialCode, setDenialCode] = useState<EmbeddedJoinDenialCode | null>(null);
  const [recordingCaptureActive, setRecordingCaptureActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [productionBasicReady, setProductionBasicReady] = useState(false);
  const productionBasicActive = useRef(false);
  const lastJoinMode = useRef<'legacy' | 'production_basic'>('legacy');
  const generationRef = useRef(0);
  const requestRef = useRef<AbortController | null>(null);
  const timerRef = useRef<TimerHandle | null>(null);
  const leaseRef = useRef<StudentClassroomLease | null>(null);

  const view = createStudentClassroomViewModel({
    state: status,
    denial_code: denialCode,
    recording_capture_active: recordingCaptureActive,
    camera_permission: 'unknown',
  });

  useEffect(() => {
    generationRef.current += 1;
    stopRuntime();
    setStatus(occurrenceId ? 'ready' : 'unavailable');
    setDenialCode(null);
    setRecordingCaptureActive(false);
    setBusy(false);
    productionBasicActive.current = false;
    lastJoinMode.current = 'legacy';
    void readProductionBasicReadiness(csrfToken)
      .then(setProductionBasicReady)
      .catch(() => setProductionBasicReady(false));
    return () => {
      generationRef.current += 1;
      stopRuntime();
    };
  }, [actorFingerprint, occurrenceId]);

  function stopRuntime(): void {
    requestRef.current?.abort();
    requestRef.current = null;
    if (timerRef.current !== null) clearTimer(timerRef.current);
    timerRef.current = null;
    leaseRef.current = null;
  }

  function beginRuntime(): { generation: number; controller: AbortController } {
    generationRef.current += 1;
    stopRuntime();
    const controller = new AbortController();
    requestRef.current = controller;
    return { generation: generationRef.current, controller };
  }

  function isCurrent(generation: number): boolean {
    return generationRef.current === generation && requestRef.current?.signal.aborted === false;
  }

  function scheduleHeartbeat(generation: number, nextHeartbeatAt?: string): void {
    if (!isCurrent(generation) || leaseRef.current === null) return;
    if (timerRef.current !== null) clearTimer(timerRef.current);
    const delay =
      nextHeartbeatAt === undefined
        ? CLASSROOM_HEARTBEAT_INTERVAL_MS
        : classroomHeartbeatDelay(nextHeartbeatAt, now());
    timerRef.current = setTimer(() => {
      timerRef.current = null;
      void sendHeartbeat(generation);
    }, delay);
  }

  async function sendHeartbeat(generation: number): Promise<void> {
    const lease = leaseRef.current;
    const controller = requestRef.current;
    if (!isCurrent(generation) || lease === null || controller === null) return;
    try {
      const heartbeat = await classroomApi.heartbeat(csrfToken, lease, controller.signal);
      if (!isCurrent(generation)) return;
      leaseRef.current = {
        lease_generation: heartbeat.lease_generation,
        version: heartbeat.version,
        lease_expires_at: heartbeat.lease_expires_at,
      };
      scheduleHeartbeat(generation, heartbeat.next_heartbeat_at);
    } catch (error) {
      handleFailure(error, generation);
    }
  }

  async function join(): Promise<void> {
    lastJoinMode.current = 'legacy';
    if (!occurrenceId) {
      setStatus('unavailable');
      setDenialCode(null);
      return;
    }
    const { generation, controller } = beginRuntime();
    setStatus('joining');
    setDenialCode(null);
    setRecordingCaptureActive(false);
    setBusy(true);
    try {
      const result = await classroomApi.bootstrap(occurrenceId, csrfToken, controller.signal);
      if (!isCurrent(generation)) return;
      leaseRef.current = result.lease;
      setRecordingCaptureActive(result.recording_capture_active);
      scheduleHeartbeat(generation);
      await joinMeeting(toZoomParticipantJoinInput(result.bootstrap));
      if (!isCurrent(generation)) return;
      await classroomApi.recordAttendance(csrfToken, 'joined', controller.signal);
      if (!isCurrent(generation)) return;
      setStatus('connected');
      setBusy(false);
    } catch (error) {
      handleFailure(error, generation);
    }
  }

  async function leave(): Promise<void> {
    generationRef.current += 1;
    stopRuntime();
    setBusy(true);
    const controller = new AbortController();
    try {
      if (!productionBasicActive.current) {
        await classroomApi.recordAttendance(csrfToken, 'left', controller.signal);
      }
    } catch (error) {
      if (error instanceof StudentClassroomApiError && error.status === 401) {
        onProtectedStateCleared();
      }
    } finally {
      controller.abort();
      navigate('/app/student');
    }
  }

  async function joinProductionBasic(): Promise<void> {
    lastJoinMode.current = 'production_basic';
    const { generation } = beginRuntime();
    setStatus('joining');
    setBusy(true);
    try {
      const artifact = await requestProductionBasicLaunch(csrfToken);
      await joinZoomMeetingProductionBasic({
        sdkWebVersion: artifact.sdk_web_version,
        meetingNumber: artifact.meeting_number,
        signature: artifact.signature,
        meetingPassword: artifact.meeting_password,
        userName: artifact.user_name,
        leaveUrl: artifact.leave_path,
      });
      if (!isCurrent(generation)) return;
      productionBasicActive.current = true;
      setStatus('connected');
      setBusy(false);
    } catch (error) {
      handleFailure(error, generation);
    }
  }

  function retry(): void {
    if (lastJoinMode.current === 'production_basic') {
      void joinProductionBasic();
      return;
    }
    void join();
  }

  function handleFailure(error: unknown, generation: number): void {
    if (!isCurrent(generation) || isAbortError(error)) return;
    generationRef.current += 1;
    stopRuntime();
    setBusy(false);
    setRecordingCaptureActive(false);
    if (error instanceof StudentClassroomApiError && error.status === 401) {
      setStatus('unavailable');
      setDenialCode(null);
      onProtectedStateCleared();
      return;
    }
    const nextDenial = error instanceof StudentClassroomApiError ? error.denialCode : null;
    if (nextDenial !== null && nextDenial !== 'bootstrap_unavailable') {
      setStatus('denied');
      setDenialCode(nextDenial);
      return;
    }
    setStatus('unavailable');
    setDenialCode(null);
  }

  return (
    <StudentClassroomSurface
      view={view}
      busy={busy}
      onJoin={() => void join()}
      productionBasicReady={productionBasicReady}
      onJoinProductionBasic={() => void joinProductionBasic()}
      onRetry={retry}
      onLeave={() => void leave()}
    />
  );
}

export function StudentClassroomSurface({
  view,
  busy,
  onJoin,
  productionBasicReady,
  onJoinProductionBasic,
  onRetry,
  onLeave,
}: {
  view: StudentClassroomViewModel;
  busy: boolean;
  onJoin: () => void;
  productionBasicReady: boolean;
  onJoinProductionBasic: () => void;
  onRetry: () => void;
  onLeave: () => void;
}) {
  const errorState = view.status === 'denied' || view.status === 'unavailable';
  return (
    <section
      className="classroom-workspace"
      aria-labelledby="student-classroom-heading"
      aria-busy={busy}
    >
      <header>
        <p className="ot-kicker">Protected live classroom</p>
        <h2 id="student-classroom-heading">Classroom</h2>
        <p>Join from this signed-in Student workspace. No private join link is required.</p>
      </header>

      <Alert tone={errorState ? 'error' : view.status === 'connected' ? 'success' : 'info'}>
        {view.status_message}
      </Alert>

      <Card>
        <h3>Camera</h3>
        <p>{view.camera_guidance}</p>
      </Card>

      <Card>
        <h3>Recording</h3>
        <p>{view.recording_disclosure}</p>
        <span aria-live="polite">
          {view.recording_indicator_visible ? <Badge>Recording in progress</Badge> : null}
        </span>
      </Card>

      <div id="zmmtg-root" aria-label="Protected Meeting SDK classroom" aria-live="polite" />

      <div className="ot-action-row">
        {view.status === 'ready' ? (
          productionBasicReady ? (
            <Button type="button" variant="primary" disabled={busy} onClick={onJoinProductionBasic}>
              Join class
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              disabled={busy || !view.join_enabled}
              onClick={onJoin}
            >
              Join classroom
            </Button>
          )
        ) : null}
        {view.status === 'joining' ? (
          <Button type="button" variant="primary" disabled>
            Joining securely…
          </Button>
        ) : null}
        {view.status === 'connected' ? (
          <Button type="button" onClick={onLeave} disabled={busy}>
            Leave classroom
          </Button>
        ) : null}
        {errorState ? (
          <Button type="button" variant="primary" onClick={onRetry} disabled={busy}>
            Try again
          </Button>
        ) : null}
      </div>
    </section>
  );
}

export function classroomHeartbeatDelay(nextHeartbeatAt: string, now: Date): number {
  const next = new Date(nextHeartbeatAt).getTime();
  const current = now.getTime();
  if (!Number.isFinite(next) || !Number.isFinite(current)) {
    throw new Error('Classroom heartbeat timing is invalid.');
  }
  return Math.min(CLASSROOM_HEARTBEAT_INTERVAL_MS, Math.max(0, next - current));
}

export function toZoomParticipantJoinInput(
  bootstrap: EphemeralMeetingSdkBootstrap,
): ZoomParticipantJoinInput {
  return {
    sdkWebVersion: bootstrap.sdk_web_version,
    meetingNumber: bootstrap.meeting_number,
    signature: bootstrap.sdk_signature,
    meetingPassword: bootstrap.meeting_password,
    registrantToken: bootstrap.registrant_token,
    userEmail: bootstrap.participant_email,
    customerKey: bootstrap.customer_key,
    userName: bootstrap.participant_display_name,
    leaveUrl: bootstrap.leave_path,
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
