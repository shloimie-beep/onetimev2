import { describe, expect, it, vi } from 'vitest';
import {
  PARENT_LEARNING_ENDPOINTS,
  PARENT_WELCOME_SLOT_ENDPOINT,
  createParentLearningApi,
  type ParentLearningSnapshot,
  type ParentWelcomeVideoReady,
} from './api.ts';

const snapshot: ParentLearningSnapshot = {
  contract_version: '1.0.0',
  participant_id: 'parent:household-1',
  household_id: 'household-1',
  display_name: 'Ari Levi',
  state: 'active',
  learner_ordinal: 1,
  capacity: {
    total_learners: 4,
    parent_learners: 1,
    child_student_limit: 3,
    active_child_students: 1,
    available_child_student_seats: 2,
  },
  class_entitlement: {
    class_series_key: 'class_series_one_time_daily',
    class_title: 'Daily One Time Mishnayos',
    effective_at: '2026-08-16T10:00:00.000Z',
  },
  next_class: null,
  library_items: [],
  activity: {
    attended_occurrence_count: 2,
    started_content_count: 3,
    completed_content_count: 1,
    submitted_question_count: 4,
  },
};

const readyWelcome: ParentWelcomeVideoReady = {
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

describe('Parent learning client API', () => {
  it('loads the authenticated Parent participant from the exact expected endpoint', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ success: true, data: { snapshot, csrf_token: 'csrf-parent' } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    await expect(createParentLearningApi({ fetcher }).load()).resolves.toEqual({
      snapshot,
      csrf_token: 'csrf-parent',
    });
    expect(fetcher).toHaveBeenCalledWith(PARENT_LEARNING_ENDPOINTS.overview, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
  });

  it('submits a Parent-attributed question without a Student identifier', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            receipt: {
              disposition: 'committed',
              operation: 'question_submitted',
              entity_id: 'question-1',
            },
          },
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    );
    const api = createParentLearningApi({
      fetcher,
      idempotencyKey: () => 'parent-learning-question-0001',
    });

    await api.submitQuestion(
      {
        class_series_key: 'class_series_one_time_daily',
        private_body: 'May I review this Mishnah again?',
      },
      'csrf-parent',
    );

    const [url, request] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(PARENT_LEARNING_ENDPOINTS.questions);
    expect(request).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-parent',
        'x-idempotency-key': 'parent-learning-question-0001',
      },
    });
    expect(JSON.parse(String(request.body))).toEqual({
      class_series_key: 'class_series_one_time_daily',
      private_body: 'May I review this Mishnah again?',
    });
    expect(String(request.body)).not.toMatch(/student_id|learner_key/u);
  });

  it('reads the unavailable welcome slot without requesting protected playback', async () => {
    const unavailable = {
      contract_version: '1.0.0',
      status: 'unavailable',
      reason: 'no_approved_version',
      title: 'Welcome to One Time',
      message: 'Your welcome video will appear here when it is ready.',
    } as const;
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { snapshot: { featured_welcome_video: unavailable } },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    await expect(createParentLearningApi({ fetcher }).loadWelcomeVideo()).resolves.toEqual(
      unavailable,
    );
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith(PARENT_WELCOME_SLOT_ENDPOINT, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
    expect(String(fetcher.mock.calls[0]?.[0])).not.toContain('/welcome-video/');
  });

  it('resolves an entitled library item through its exact same-origin open action', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            action: {
              action_key: 'content-open-ready-1',
              label: 'Open lesson',
              kind: 'content_open',
              method: 'GET',
              href: '/app/learning/items/content-1',
              launch_token_ref: null,
              expires_at: null,
            },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const api = createParentLearningApi({ fetcher });

    await expect(
      api.openContent({
        action_key: 'content-open-1',
        label: 'Continue lesson',
        kind: 'content_open',
        method: 'GET',
        href: '/api/v1/portals/parent/learning/content/content-1/open',
        launch_token_ref: null,
        expires_at: null,
      }),
    ).resolves.toMatchObject({ href: '/app/learning/items/content-1' });
    expect(fetcher).toHaveBeenCalledWith('/api/v1/portals/parent/learning/content/content-1/open', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
  });

  it('launches a joinable Parent class through the exact bodyless production-basic seam', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            launch_artifact: {
              mode: 'production_basic',
              role: 0,
              sdk_web_version: '3.11.2',
              meeting_number: '12345678901',
              meeting_password: 'meeting-password',
              signature: 'header.payload.signature',
              user_name: 'Ari Levi',
              leave_path: '/app/parent',
              issued_at: '2026-08-16T15:55:00.000Z',
              expires_at: '2026-08-16T16:35:00.000Z',
              raw_join_url_present: false,
              video_start_model: 'PARTICIPANT_CONSENT',
            },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const api = createParentLearningApi({ fetcher });

    await expect(
      api.launchClass(
        {
          action_key: 'class-launch-1',
          label: 'Join class',
          kind: 'class_launch',
          method: 'POST',
          href: '/api/v1/classroom/production-basic/launch',
          launch_token_ref: null,
          expires_at: '2026-08-16T16:35:00.000Z',
        },
        'csrf-parent',
      ),
    ).resolves.toMatchObject({ mode: 'production_basic', leave_path: '/app/parent' });

    const [url, request] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/classroom/production-basic/launch');
    expect(fetcher).toHaveBeenCalledOnce();
    expect(request).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'x-csrf-token': 'csrf-parent',
      },
    });
    expect(request.body).toBeUndefined();
  });

  it('rejects non-canonical or cross-origin server actions before making a request', async () => {
    const fetcher = vi.fn();
    const api = createParentLearningApi({ fetcher });

    await expect(
      api.openContent({
        action_key: 'unsafe-content-open',
        label: 'Open lesson',
        kind: 'content_open',
        method: 'GET',
        href: 'https://media.example.test/private',
        launch_token_ref: null,
        expires_at: null,
      }),
    ).rejects.toThrow('invalid');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('loads and sanitizes only the ready slot\u2019s exact same-origin playback descriptor', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            descriptor: {
              contract_version: '1.0.0',
              kind: 'protected_parent_video',
              video_version_id: 'welcome-approved-v1',
              media_path: '/api/app/parent/welcome-video/welcome-approved-v1/media',
              poster_path: '/api/app/parent/welcome-video/welcome-approved-v1/poster',
              captions_path: '/api/app/parent/welcome-video/welcome-approved-v1/captions',
              captions_default: true,
              autoplay_policy: 'muted_when_allowed',
              expires_at: '2026-08-16T16:35:00.000Z',
            },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const api = createParentLearningApi({
      fetcher,
      now: () => new Date('2026-08-16T16:00:00.000Z'),
    });

    await expect(api.loadWelcomePlayback(readyWelcome)).resolves.toMatchObject({
      kind: 'protected_parent_video',
      media_path: '/api/app/parent/welcome-video/welcome-approved-v1/media',
    });
    expect(fetcher).toHaveBeenCalledWith(readyWelcome.playback_descriptor_path, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
  });

  it('rejects a revoked, external, expired, or locator-bearing welcome descriptor', async () => {
    for (const descriptor of [
      {
        contract_version: '1.0.0',
        kind: 'protected_parent_video',
        video_version_id: 'welcome-approved-v1',
        media_path: 'https://video-provider.example/private',
        poster_path: '/api/app/parent/welcome-video/welcome-approved-v1/poster',
        captions_path: '/api/app/parent/welcome-video/welcome-approved-v1/captions',
        captions_default: true,
        autoplay_policy: 'muted_when_allowed',
        expires_at: '2026-08-16T16:35:00.000Z',
      },
      {
        contract_version: '1.0.0',
        kind: 'protected_parent_video',
        video_version_id: 'welcome-approved-v1',
        media_path: '/api/app/parent/welcome-video/welcome-approved-v1/media',
        poster_path: '/api/app/parent/welcome-video/welcome-approved-v1/poster',
        captions_path: '/api/app/parent/welcome-video/welcome-approved-v1/captions',
        captions_default: true,
        autoplay_policy: 'muted_when_allowed',
        expires_at: '2026-08-16T15:59:59.999Z',
      },
      {
        contract_version: '1.0.0',
        kind: 'protected_parent_video',
        video_version_id: 'welcome-approved-v1',
        media_path: '/api/app/parent/welcome-video/welcome-approved-v1/media',
        poster_path: '/api/app/parent/welcome-video/welcome-approved-v1/poster',
        captions_path: '/api/app/parent/welcome-video/welcome-approved-v1/captions',
        captions_default: true,
        autoplay_policy: 'muted_when_allowed',
        expires_at: '2026-08-16T16:35:00.000Z',
        provider_locator: 'private-provider-id',
      },
    ]) {
      const fetcher = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true, data: { descriptor } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
      await expect(
        createParentLearningApi({
          fetcher,
          now: () => new Date('2026-08-16T16:00:00.000Z'),
        }).loadWelcomePlayback(readyWelcome),
      ).rejects.toThrow('invalid');
      expect(fetcher).toHaveBeenCalledOnce();
    }
  });

  it('records a fixed welcome event with CSRF/idempotency and no learner or locator fields', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            receipts: [
              {
                event_type: 'parent.welcome_video_10_seconds',
                video_version_id: 'welcome-approved-v1',
                recorded: true,
                recorded_at: '2026-08-16T16:00:10.000Z',
              },
            ],
          },
        }),
        { status: 202, headers: { 'content-type': 'application/json' } },
      ),
    );
    const api = createParentLearningApi({ fetcher });

    await api.recordWelcomeEvent(
      {
        event_type: 'parent.welcome_video_10_seconds',
        video_version_id: 'welcome-approved-v1',
        observed_playback_seconds: 10,
      },
      'csrf-parent',
      'welcome-event-10-seconds-0001',
    );

    const [url, request] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/app/parent/welcome-video/events');
    expect(request).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      keepalive: true,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-parent',
        'x-idempotency-key': 'welcome-event-10-seconds-0001',
      },
    });
    expect(JSON.parse(String(request.body))).toEqual({
      event_type: 'parent.welcome_video_10_seconds',
      video_version_id: 'welcome-approved-v1',
      observed_playback_seconds: 10,
    });
    expect(String(request.body)).not.toMatch(/student|learner|provider|locator|https?:/iu);
  });
});
