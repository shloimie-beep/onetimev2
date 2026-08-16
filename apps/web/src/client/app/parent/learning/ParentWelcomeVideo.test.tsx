import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ParentWelcomePlaybackDescriptor, ParentWelcomeVideoReady } from './api.ts';
import { ParentWelcomeVideoSurface } from './ParentWelcomeVideo.tsx';

const slot: ParentWelcomeVideoReady = {
  contract_version: '1.0.0',
  status: 'ready',
  slot_key: 'parent_companion_welcome',
  video_version_id: 'welcome-approved-v1',
  title: 'Welcome to One Time',
  duration_ms: 100_000,
  width: 1_920,
  height: 1_080,
  aspect_ratio: '16:9',
  captions_available: true,
  poster_available: true,
  playback_descriptor_path: '/api/app/parent/welcome-video/welcome-approved-v1/playback',
  activation_threshold_seconds: 10,
  completion_threshold_percent: 90,
};

const descriptor: ParentWelcomePlaybackDescriptor = {
  contract_version: '1.0.0',
  kind: 'protected_parent_video',
  video_version_id: 'welcome-approved-v1',
  media_path: '/api/app/parent/welcome-video/welcome-approved-v1/media',
  poster_path: '/api/app/parent/welcome-video/welcome-approved-v1/poster',
  captions_path: '/api/app/parent/welcome-video/welcome-approved-v1/captions',
  captions_default: true,
  autoplay_policy: 'muted_when_allowed',
  expires_at: '2026-08-16T16:35:00.000Z',
};

describe('Parent protected welcome video surface', () => {
  it('renders native controls, muted autoplay, poster, and default captions from protected paths', () => {
    const html = renderToStaticMarkup(
      <ParentWelcomeVideoSurface
        slot={slot}
        descriptor={descriptor}
        state="ready"
        onPlay={vi.fn()}
        onTimeUpdate={vi.fn()}
        onSeeking={vi.fn()}
        onSeeked={vi.fn()}
        onError={vi.fn()}
      />,
    );

    expect(html).toContain('<video');
    expect(html).toContain('controls=""');
    expect(html).toContain('autoPlay=""');
    expect(html).toContain('muted=""');
    expect(html).toContain(`poster="${descriptor.poster_path}"`);
    expect(html).toContain(`src="${descriptor.media_path}"`);
    expect(html).toContain(`src="${descriptor.captions_path}"`);
    expect(html).toContain('kind="captions"');
    expect(html).toContain('default=""');
    expect(html).not.toMatch(/https?:|provider|locator/iu);
  });

  it('removes every protected asset path after revocation and shows only a generic error', () => {
    const html = renderToStaticMarkup(
      <ParentWelcomeVideoSurface
        slot={slot}
        descriptor={null}
        state="revoked"
        onPlay={vi.fn()}
        onTimeUpdate={vi.fn()}
        onSeeking={vi.fn()}
        onSeeked={vi.fn()}
        onError={vi.fn()}
      />,
    );

    expect(html).toContain('This welcome video is no longer available.');
    expect(html).not.toContain('/welcome-video/');
    expect(html).not.toMatch(/https?:|provider|locator|video_version/iu);
  });
});
