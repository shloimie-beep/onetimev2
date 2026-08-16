import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ParentLearningApi,
  ParentWelcomePlaybackDescriptor,
  ParentWelcomeVideoReady,
} from './api.ts';
import { createParentWelcomeVideoEventController } from './welcome-video.ts';

type ParentWelcomeVideoState = 'loading' | 'ready' | 'revoked';

export function ParentWelcomeVideo({
  slot,
  csrfToken,
  api,
}: {
  slot: ParentWelcomeVideoReady;
  csrfToken: string;
  api: ParentLearningApi;
}) {
  const [state, setState] = useState<ParentWelcomeVideoState>('loading');
  const [descriptor, setDescriptor] = useState<ParentWelcomePlaybackDescriptor | null>(null);
  const load = useRef<Promise<ParentWelcomePlaybackDescriptor> | null>(null);
  const events = useMemo(
    () =>
      createParentWelcomeVideoEventController({
        videoVersionId: slot.video_version_id,
        durationSeconds: slot.duration_ms / 1_000,
        recordEvent: (command) => api.recordWelcomeEvent(command, csrfToken),
        onRevoked: () => {
          setDescriptor(null);
          setState('revoked');
        },
      }),
    [api, csrfToken, slot.duration_ms, slot.video_version_id],
  );

  useEffect(() => {
    events.activate();
    let active = true;
    load.current ??= api.loadWelcomePlayback(slot);
    void load.current
      .then((next) => {
        if (!active) return;
        setDescriptor(next);
        setState('ready');
      })
      .catch(() => {
        if (!active) return;
        setDescriptor(null);
        setState('revoked');
      });
    return () => {
      active = false;
      events.dispose();
    };
  }, [api, events, slot]);

  useEffect(() => {
    if (state === 'ready' && descriptor) events.impression();
  }, [descriptor, events, state]);

  function revoke() {
    events.dispose();
    setDescriptor(null);
    setState('revoked');
  }

  return (
    <ParentWelcomeVideoSurface
      slot={slot}
      descriptor={descriptor}
      state={state}
      onPlay={(video) => events.started(video.currentTime)}
      onTimeUpdate={(video) =>
        events.timeUpdate({
          currentTime: video.currentTime,
          duration: video.duration,
          paused: video.paused,
          seeking: video.seeking,
        })
      }
      onSeeking={() => events.seeking()}
      onSeeked={(video) => events.seeked(video.currentTime)}
      onError={revoke}
    />
  );
}

export function ParentWelcomeVideoSurface({
  slot,
  descriptor,
  state,
  onPlay,
  onTimeUpdate,
  onSeeking,
  onSeeked,
  onError,
}: {
  slot: ParentWelcomeVideoReady;
  descriptor: ParentWelcomePlaybackDescriptor | null;
  state: ParentWelcomeVideoState;
  onPlay: (video: HTMLVideoElement) => void;
  onTimeUpdate: (video: HTMLVideoElement) => void;
  onSeeking: () => void;
  onSeeked: (video: HTMLVideoElement) => void;
  onError: () => void;
}) {
  return (
    <div className="parent-learning-workspace__welcome-video">
      <h2>{slot.title}</h2>
      {state === 'loading' ? <p role="status">Preparing your protected welcome video...</p> : null}
      {state === 'revoked' || !descriptor ? (
        state === 'revoked' ? (
          <p role="alert">
            This welcome video is no longer available. Your learning access remains ready.
          </p>
        ) : null
      ) : (
        <video
          controls
          autoPlay
          muted
          playsInline
          preload="metadata"
          width={slot.width}
          height={slot.height}
          poster={descriptor.poster_path}
          aria-label={slot.title}
          onPlay={(event) => onPlay(event.currentTarget)}
          onTimeUpdate={(event) => onTimeUpdate(event.currentTarget)}
          onSeeking={onSeeking}
          onSeeked={(event) => onSeeked(event.currentTarget)}
          onError={onError}
        >
          <source src={descriptor.media_path} type="video/mp4" />
          <track
            kind="captions"
            src={descriptor.captions_path}
            srcLang="en"
            label="English"
            default={descriptor.captions_default}
          />
        </video>
      )}
    </div>
  );
}
