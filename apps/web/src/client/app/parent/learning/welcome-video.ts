import type {
  ParentWelcomeBrowserEventType,
  ParentWelcomeEventCommand,
} from '../../../../../../../packages/contracts/src/portals/parent-welcome/index.ts';

const MAX_CONTIGUOUS_PLAYBACK_DELTA_SECONDS = 2;

export function createParentAddStudentEventController(input: {
  recordEvent: (command: ParentWelcomeEventCommand) => Promise<unknown>;
}) {
  let sent = false;
  let pending: Promise<void> | null = null;
  return {
    clicked(videoVersionId: string | null) {
      if (sent) return;
      sent = true;
      pending = Promise.resolve()
        .then(() =>
          input.recordEvent({
            event_type: 'parent.add_student_clicked',
            video_version_id: videoVersionId,
          }),
        )
        .then(() => undefined)
        .catch(() => undefined);
    },

    async flush() {
      await pending;
    },
  };
}

export function createParentWelcomeVideoEventController(input: {
  videoVersionId: string;
  durationSeconds: number;
  recordEvent: (command: ParentWelcomeEventCommand) => Promise<unknown>;
  onRevoked?: () => void;
}) {
  const sent = new Set<ParentWelcomeBrowserEventType>();
  const pending = new Set<Promise<void>>();
  let active = true;
  let observedPlaybackSeconds = 0;
  let lastPosition: number | null = null;

  function emit(
    eventType: ParentWelcomeBrowserEventType,
    observations: Pick<
      ParentWelcomeEventCommand,
      'observed_playback_seconds' | 'observed_position_percent'
    > = {},
  ) {
    if (!active || sent.has(eventType)) return;
    sent.add(eventType);
    const command: ParentWelcomeEventCommand = {
      event_type: eventType,
      video_version_id: input.videoVersionId,
      ...(observations.observed_playback_seconds === undefined
        ? {}
        : { observed_playback_seconds: observations.observed_playback_seconds }),
      ...(observations.observed_position_percent === undefined
        ? {}
        : { observed_position_percent: observations.observed_position_percent }),
    };
    const request = Promise.resolve()
      .then(() => input.recordEvent(command))
      .then(() => undefined)
      .catch((cause: unknown) => {
        if (active && isRevocation(cause)) input.onRevoked?.();
      })
      .finally(() => pending.delete(request));
    pending.add(request);
  }

  function thresholdEvents(currentTime: number) {
    const duration = input.durationSeconds;
    if (!Number.isFinite(duration) || duration <= 0) return;
    const positionPercent = Math.min(100, Math.max(0, (currentTime / duration) * 100));
    const playbackSeconds = rounded(observedPlaybackSeconds);
    if (observedPlaybackSeconds >= 10) {
      emit('parent.welcome_video_10_seconds', {
        observed_playback_seconds: playbackSeconds,
      });
    }
    for (const [eventType, percent] of [
      ['parent.welcome_video_25_percent', 25],
      ['parent.welcome_video_50_percent', 50],
      ['parent.welcome_video_75_percent', 75],
      ['parent.welcome_video_completed', 90],
    ] as const) {
      if (positionPercent < percent || observedPlaybackSeconds < duration * (percent / 100)) {
        continue;
      }
      emit(eventType, {
        observed_playback_seconds: playbackSeconds,
        observed_position_percent: rounded(positionPercent),
      });
    }
  }

  return {
    activate() {
      active = true;
    },

    dispose() {
      active = false;
      lastPosition = null;
    },

    impression() {
      emit('parent.welcome_video_impression');
    },

    started(currentTime: number) {
      if (Number.isFinite(currentTime) && currentTime >= 0) lastPosition = currentTime;
      emit('parent.welcome_video_started');
    },

    seeking() {
      lastPosition = null;
    },

    seeked(currentTime: number) {
      lastPosition = Number.isFinite(currentTime) && currentTime >= 0 ? currentTime : null;
    },

    timeUpdate(state: {
      currentTime: number;
      duration: number;
      paused: boolean;
      seeking: boolean;
    }) {
      if (
        !active ||
        !Number.isFinite(state.currentTime) ||
        state.currentTime < 0 ||
        state.seeking
      ) {
        lastPosition = null;
        return;
      }
      if (state.paused) {
        lastPosition = state.currentTime;
        return;
      }
      if (lastPosition !== null) {
        const delta = state.currentTime - lastPosition;
        if (delta > 0 && delta <= MAX_CONTIGUOUS_PLAYBACK_DELTA_SECONDS) {
          observedPlaybackSeconds = Math.min(
            input.durationSeconds,
            observedPlaybackSeconds + delta,
          );
        }
      }
      lastPosition = state.currentTime;
      thresholdEvents(state.currentTime);
    },

    async flush() {
      await Promise.allSettled([...pending]);
    },
  };
}

function rounded(value: number) {
  return Math.round(value * 1_000) / 1_000;
}

function isRevocation(cause: unknown) {
  if (!cause || typeof cause !== 'object') return false;
  const status = 'status' in cause ? cause.status : undefined;
  const code = 'code' in cause ? cause.code : undefined;
  return (
    status === 401 ||
    status === 403 ||
    status === 404 ||
    code === 'parent_welcome_slot_unavailable' ||
    code === 'parent_welcome_version_mismatch'
  );
}
