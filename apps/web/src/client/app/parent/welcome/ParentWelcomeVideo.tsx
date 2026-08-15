import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ParentWelcomeBrowserEventType,
  ParentWelcomeEventCommand,
  ParentWelcomePlaybackDescriptor,
  ParentWelcomeVideoReady,
  ParentWelcomeVideoSlot,
} from '../../../../../../../packages/contracts/src/portals/parent-welcome/index.ts';
import { createParentHouseholdApi, type ParentHouseholdApi } from '../household/api.ts';

export type WelcomeMilestoneState = {
  observed_seconds: number;
  previous_position_seconds: number;
  sent: ReadonlySet<ParentWelcomeBrowserEventType>;
};

export type ParentWelcomeStudentActionState = {
  active_student_count: number;
  available_student_seats: number;
  can_manage_students: boolean;
};

export function ParentWelcomeVideo({
  slot,
  csrfToken,
  placement,
  studentAction,
  initialDescriptor,
  api: suppliedApi,
}: {
  slot: ParentWelcomeVideoSlot | null;
  csrfToken: string | null;
  placement: 'home' | 'updates';
  studentAction?: ParentWelcomeStudentActionState | null;
  initialDescriptor?: ParentWelcomePlaybackDescriptor;
  api?: ParentHouseholdApi;
}) {
  const api = useMemo(() => suppliedApi ?? createParentHouseholdApi(), [suppliedApi]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const milestoneRef = useRef<WelcomeMilestoneState>(initialMilestoneState());
  const idempotencyKeys = useRef(new Map<ParentWelcomeBrowserEventType, string>());
  const [descriptor, setDescriptor] = useState<ParentWelcomePlaybackDescriptor | null>(
    initialDescriptor ?? null,
  );
  const [playbackError, setPlaybackError] = useState('');

  useEffect(() => {
    milestoneRef.current = initialMilestoneState();
    idempotencyKeys.current.clear();
    setDescriptor(initialDescriptor ?? null);
    setPlaybackError('');
    if (slot?.status !== 'ready') return;
    void sendEvent(
      'parent.welcome_video_impression',
      slot,
      csrfToken,
      api,
      idempotencyKeys.current,
    );
    if (initialDescriptor && validProtectedDescriptor(initialDescriptor, slot)) return;
    let active = true;
    api
      .loadWelcomePlayback(slot.playback_descriptor_path)
      .then(({ descriptor: next }) => {
        if (!active) return;
        if (!validProtectedDescriptor(next, slot)) {
          setPlaybackError('Protected playback is currently unavailable.');
          return;
        }
        setDescriptor(next);
      })
      .catch(() => {
        if (active) setPlaybackError('Protected playback is currently unavailable.');
      });
    return () => {
      active = false;
    };
  }, [api, csrfToken, initialDescriptor, slot]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !descriptor || !autoplayPermitted()) return;
    video.muted = true;
    void video.play().catch(() => undefined);
  }, [descriptor]);

  const title = slot?.title ?? 'Welcome to One Time';
  const ready = slot?.status === 'ready' ? slot : null;
  const addStudentAction = parentWelcomeAddStudentAction(studentAction ?? null);

  function trackPlayback(video: HTMLVideoElement) {
    if (!ready) return;
    const next = nextWelcomeMilestones(milestoneRef.current, {
      duration_seconds: ready.duration_ms / 1000,
      position_seconds: video.currentTime,
      visible: typeof document === 'undefined' || document.visibilityState === 'visible',
      actively_playing: !video.paused && !video.seeking && !video.ended,
    });
    milestoneRef.current = next.state;
    for (const eventType of next.events) {
      void sendEvent(
        eventType,
        ready,
        csrfToken,
        api,
        idempotencyKeys.current,
        next.state.observed_seconds,
        Math.min(100, (video.currentTime / (ready.duration_ms / 1000)) * 100),
      );
    }
  }

  return (
    <section
      className={`parent-welcome parent-welcome--${placement}`}
      aria-labelledby={`parent-welcome-title-${placement}`}
      data-parent-welcome-featured="true"
      data-parent-welcome-pinned={placement === 'updates' ? 'true' : undefined}
    >
      <div className="parent-welcome__heading">
        <p className="parent-welcome__eyebrow">
          {placement === 'updates' ? 'Pinned Parent Companion welcome' : 'Start here'}
        </p>
        <h2 id={`parent-welcome-title-${placement}`}>{title}</h2>
      </div>

      {ready && descriptor ? (
        <div className="parent-welcome__media">
          <video
            ref={videoRef}
            controls
            muted
            playsInline
            preload="metadata"
            poster={descriptor.poster_path}
            tabIndex={0}
            aria-label={`${ready.title}. Captions are available from the video controls.`}
            onPlay={(event) => {
              void sendEvent(
                'parent.welcome_video_started',
                ready,
                csrfToken,
                api,
                idempotencyKeys.current,
                milestoneRef.current.observed_seconds,
                (event.currentTarget.currentTime / (ready.duration_ms / 1000)) * 100,
              );
            }}
            onTimeUpdate={(event) => trackPlayback(event.currentTarget)}
            onEnded={(event) => trackPlayback(event.currentTarget)}
          >
            <source src={descriptor.media_path} type="video/mp4" />
            <track
              kind="captions"
              src={descriptor.captions_path}
              srcLang="en"
              label="English"
              default
            />
            Your browser cannot play this protected welcome video. Use the actions below to
            continue.
          </video>
          <p className="parent-welcome__playback-note">
            Playback starts muted when your browser and motion settings allow. Use the controls to
            play, pause, unmute, or enable captions.
          </p>
        </div>
      ) : (
        <div className="parent-welcome__placeholder" role="status">
          <p>
            {playbackError ||
              (slot?.status === 'unavailable' ? slot.message : null) ||
              'Checking for the approved Parent welcome video…'}
          </p>
          <p>No unapproved video or provider link will be shown.</p>
        </div>
      )}

      <nav className="parent-welcome__actions" aria-label="Parent welcome actions">
        {addStudentAction.available ? (
          <a
            className="parent-welcome__primary-action"
            href="/app/parent/students/new"
            onClick={() => {
              void sendEvent(
                'parent.add_student_clicked',
                ready,
                csrfToken,
                api,
                idempotencyKeys.current,
              );
            }}
          >
            {addStudentAction.label}
          </a>
        ) : (
          <span className="parent-welcome__primary-action" aria-disabled="true">
            {addStudentAction.label}
          </span>
        )}
        <a href="/app/parent/calendar#next-class">See the next class</a>
        <a href="/app/parent/support">Get help</a>
      </nav>
    </section>
  );
}

export function nextWelcomeMilestones(
  current: WelcomeMilestoneState,
  input: {
    duration_seconds: number;
    position_seconds: number;
    visible: boolean;
    actively_playing: boolean;
  },
) {
  const duration = Math.max(1, input.duration_seconds);
  const forwardDelta = input.position_seconds - current.previous_position_seconds;
  const observedDelta =
    input.visible && input.actively_playing && forwardDelta > 0 && forwardDelta <= 2
      ? forwardDelta
      : 0;
  const observedSeconds = Math.min(duration, current.observed_seconds + observedDelta);
  const positionPercent = Math.min(100, Math.max(0, (input.position_seconds / duration) * 100));
  const sent = new Set(current.sent);
  const events: ParentWelcomeBrowserEventType[] = [];
  const add = (event: ParentWelcomeBrowserEventType, accepted: boolean) => {
    if (accepted && !sent.has(event)) {
      sent.add(event);
      events.push(event);
    }
  };
  add('parent.welcome_video_10_seconds', observedSeconds >= 10);
  add(
    'parent.welcome_video_25_percent',
    positionPercent >= 25 && observedSeconds >= duration * 0.25,
  );
  add(
    'parent.welcome_video_50_percent',
    positionPercent >= 50 && observedSeconds >= duration * 0.5,
  );
  add(
    'parent.welcome_video_75_percent',
    positionPercent >= 75 && observedSeconds >= duration * 0.75,
  );
  add('parent.welcome_video_completed', positionPercent >= 90 && observedSeconds >= duration * 0.9);
  return {
    state: {
      observed_seconds: observedSeconds,
      previous_position_seconds: input.position_seconds,
      sent,
    },
    events,
  };
}

function initialMilestoneState(): WelcomeMilestoneState {
  return {
    observed_seconds: 0,
    previous_position_seconds: 0,
    sent: new Set(),
  };
}

function autoplayPermitted() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return parentWelcomeAutoplayPermitted({
    reduced_motion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
    save_data: connection?.saveData === true,
  });
}

export function parentWelcomeAutoplayPermitted(input: {
  reduced_motion: boolean;
  save_data: boolean;
}) {
  return !input.reduced_motion && !input.save_data;
}

export function parentWelcomeAddStudentAction(state: ParentWelcomeStudentActionState | null): {
  available: boolean;
  label: string;
} {
  if (!state) {
    return { available: false, label: 'Adding a Student is unavailable' };
  }
  if (
    !Number.isSafeInteger(state.active_student_count) ||
    state.active_student_count < 0 ||
    !Number.isSafeInteger(state.available_student_seats) ||
    state.available_student_seats < 0 ||
    !state.can_manage_students
  ) {
    return { available: false, label: 'Adding a Student is unavailable' };
  }
  if (state.active_student_count >= 3 || state.available_student_seats === 0) {
    return { available: false, label: 'All Student seats are in use' };
  }
  return {
    available: true,
    label: state.active_student_count === 0 ? 'Add your first Student' : 'Add another Student',
  };
}

function validProtectedDescriptor(
  descriptor: ParentWelcomePlaybackDescriptor,
  slot: ParentWelcomeVideoReady,
) {
  if (descriptor.video_version_id !== slot.video_version_id) return false;
  const prefix = `/api/app/parent/welcome-video/${encodeURIComponent(slot.video_version_id)}/`;
  const paths = [descriptor.media_path, descriptor.poster_path, descriptor.captions_path];
  return (
    descriptor.kind === 'protected_parent_video' &&
    descriptor.captions_default === true &&
    paths.every((path) => path.startsWith(prefix) && !path.includes('://'))
  );
}

async function sendEvent(
  eventType: ParentWelcomeBrowserEventType,
  slot: ParentWelcomeVideoReady | null,
  csrfToken: string | null,
  api: ParentHouseholdApi,
  keys: Map<ParentWelcomeBrowserEventType, string>,
  observedSeconds?: number,
  observedPercent?: number,
) {
  if (!csrfToken) return;
  const command: ParentWelcomeEventCommand = {
    event_type: eventType,
    video_version_id: slot?.video_version_id ?? null,
    ...(observedSeconds === undefined ? {} : { observed_playback_seconds: observedSeconds }),
    ...(observedPercent === undefined ? {} : { observed_position_percent: observedPercent }),
  };
  let key = keys.get(eventType);
  if (!key) {
    key = browserEventKey(eventType);
    keys.set(eventType, key);
  }
  try {
    await api.recordWelcomeEvent(command, csrfToken, key);
  } catch {
    // Navigation and playback remain available; the append-only server event can be retried later.
  }
}

function browserEventKey(eventType: ParentWelcomeBrowserEventType) {
  const suffix = globalThis.crypto?.randomUUID?.();
  if (!suffix) throw new Error('Secure browser randomness is required for Parent event tracking.');
  return `welcome-${eventType.replaceAll('.', '-')}-${suffix}`;
}
