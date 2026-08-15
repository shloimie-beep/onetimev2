import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type {
  ParentWelcomePlaybackDescriptor,
  ParentWelcomeVideoReady,
} from '../../../../../../../packages/contracts/src/portals/parent-welcome/index.ts';
import {
  nextWelcomeMilestones,
  parentWelcomeAutoplayPermitted,
  ParentWelcomeVideo,
  type WelcomeMilestoneState,
} from './ParentWelcomeVideo.tsx';
import { createParentHouseholdApi } from '../household/api.ts';

const slot: ParentWelcomeVideoReady = {
  contract_version: '1.0.0',
  status: 'ready',
  slot_key: 'parent_companion_welcome',
  video_version_id: 'welcome-approved-v1',
  title: 'Welcome to One Time',
  duration_ms: 90_000,
  width: 1600,
  height: 900,
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
  expires_at: '2026-08-15T10:05:00.000Z',
};

describe('Parent welcome featured media', () => {
  it('renders accessible 16:9-ready native controls, captions, poster, and direct actions', () => {
    const html = renderToStaticMarkup(
      <ParentWelcomeVideo
        slot={slot}
        csrfToken="csrf-parent"
        placement="updates"
        initialDescriptor={descriptor}
      />,
    );

    expect(html).toContain('data-parent-welcome-pinned="true"');
    expect(html).toContain('<video controls="" muted="" playsInline=""');
    expect(html).toContain('poster="/api/app/parent/welcome-video/welcome-approved-v1/poster"');
    expect(html).toContain('<track kind="captions"');
    expect(html).toContain('srcLang="en"');
    expect(html).toContain('Add your first Student');
    expect(html).toContain('See the next class');
    expect(html).toContain('Get help');
    expect(html).not.toMatch(/drive|vimeo|https?:\/\//iu);
  });

  it('renders a truthful action-ready placeholder and no player while unapproved', () => {
    const html = renderToStaticMarkup(
      <ParentWelcomeVideo
        slot={{
          contract_version: '1.0.0',
          status: 'unavailable',
          reason: 'no_approved_version',
          title: 'Welcome to One Time',
          message: 'An approved Parent welcome video is not available yet.',
        }}
        csrfToken={null}
        placement="home"
      />,
    );
    expect(html).toContain('approved Parent welcome video is not available');
    expect(html).toContain('No unapproved video or provider link will be shown');
    expect(html).not.toContain('<video');
    expect(html).not.toMatch(/20260623_190244_1|14-xsw|388a318d/iu);
  });

  it('counts only visible forward playback and cannot earn milestones by seeking', () => {
    let state: WelcomeMilestoneState = {
      observed_seconds: 0,
      previous_position_seconds: 0,
      sent: new Set(),
    };
    const seek = nextWelcomeMilestones(state, {
      duration_seconds: 90,
      position_seconds: 70,
      visible: true,
      actively_playing: true,
    });
    expect(seek.state.observed_seconds).toBe(0);
    expect(seek.events).toEqual([]);

    for (let second = 1; second <= 23; second += 1) {
      const next = nextWelcomeMilestones(state, {
        duration_seconds: 90,
        position_seconds: second,
        visible: true,
        actively_playing: true,
      });
      state = next.state;
    }
    expect(state.sent.has('parent.welcome_video_10_seconds')).toBe(true);
    expect(state.sent.has('parent.welcome_video_25_percent')).toBe(true);

    const hidden = nextWelcomeMilestones(state, {
      duration_seconds: 90,
      position_seconds: 24,
      visible: false,
      actively_playing: true,
    });
    expect(hidden.state.observed_seconds).toBe(state.observed_seconds);
  });

  it('never forces autoplay for reduced motion or data-saving preferences', () => {
    expect(parentWelcomeAutoplayPermitted({ reduced_motion: false, save_data: false })).toBe(true);
    expect(parentWelcomeAutoplayPermitted({ reduced_motion: true, save_data: false })).toBe(false);
    expect(parentWelcomeAutoplayPermitted({ reduced_motion: false, save_data: true })).toBe(false);
  });

  it('sends event proof with CSRF, keepalive, and no request-selected household', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ success: true, data: { receipts: [] } }), {
          status: 202,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const api = createParentHouseholdApi({ fetcher });

    await api.recordWelcomeEvent(
      {
        event_type: 'parent.welcome_video_started',
        video_version_id: 'welcome-approved-v1',
      },
      'csrf-parent',
      'welcome-started-browser-0001',
    );

    const [url, request] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/app/parent/welcome-video/events');
    expect(request.keepalive).toBe(true);
    expect(request.headers).toMatchObject({
      'x-csrf-token': 'csrf-parent',
      'x-idempotency-key': 'welcome-started-browser-0001',
    });
    expect(String(request.body)).not.toMatch(/household_id|adult_id|student_id/iu);
  });
});
