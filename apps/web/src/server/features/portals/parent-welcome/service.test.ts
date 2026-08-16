import { describe, expect, it, vi } from 'vitest';
import type {
  ParentWelcomeEventRecord,
  ParentWelcomePrincipal,
  ParentWelcomeRepository,
  ParentWelcomeVideoSlotRecord,
} from '../../../../../../../packages/contracts/src/portals/parent-welcome/index.ts';
import { createParentWelcomeService } from './service.ts';

const principal: ParentWelcomePrincipal = {
  role: 'parent',
  adult_id: 'adult-parent',
  household_id: 'household-parent',
  session_id: 'session-parent',
};

const approvedSlot: ParentWelcomeVideoSlotRecord = {
  account_key: 'one-time-account',
  product_key: 'one_time_mishnayos',
  runtime_tier: 'isolated_staging',
  verification_environment_id: 'ci',
  slot_key: 'parent_companion_welcome',
  video_version_id: 'welcome-approved-v1',
  content_id: 'content-approved',
  content_version_id: 'content-version-approved',
  publication_generation: 1,
  approval_projection_digest: 'a'.repeat(64),
  title: 'Welcome to One Time',
  duration_ms: 90_000,
  width: 1600,
  height: 900,
  captions_available: true,
  poster_available: true,
};

function repository(slot: ParentWelcomeVideoSlotRecord | null = approvedSlot) {
  const recordEvents = vi.fn(async (events: readonly ParentWelcomeEventRecord[]) =>
    events.map((event) => ({
      event_type: event.event_type,
      video_version_id: event.video_version_id,
      recorded: true,
      recorded_at: event.binding.occurred_at,
    })),
  );
  return {
    loadCurrentSlot: vi.fn(async () => slot),
    recordEvents,
    loadFunnelReport: vi.fn(async () => []),
  } satisfies ParentWelcomeRepository;
}

describe('Parent Companion welcome service', () => {
  it('returns only an approved 16:9 captioned slot and records one adult portal-open event', async () => {
    const repo = repository();
    const service = createParentWelcomeService({
      repository: repo,
      playbackRuntimeAvailable: true,
      clock: () => new Date('2026-08-15T10:00:00.000Z'),
    });

    const slot = await service.featuredSlot(principal);

    expect(slot).toMatchObject({
      status: 'ready',
      video_version_id: 'welcome-approved-v1',
      aspect_ratio: '16:9',
      captions_available: true,
      poster_available: true,
    });
    expect(JSON.stringify(slot)).not.toMatch(/drive|vimeo|https?:\/\//iu);
    expect(repo.recordEvents).toHaveBeenCalledOnce();
    expect(repo.recordEvents.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        principal,
        event_type: 'parent.portal_opened',
        video_version_id: 'unbound',
      }),
    ]);
  });

  it('fails closed when no protected playback runtime is bound', async () => {
    const repo = repository();
    const slot = await createParentWelcomeService({
      repository: repo,
      playbackRuntimeAvailable: false,
    }).featuredSlot(principal);

    expect(slot).toMatchObject({ status: 'unavailable', reason: 'no_approved_version' });
    expect(repo.loadCurrentSlot).not.toHaveBeenCalled();
    expect(JSON.stringify(slot)).not.toMatch(
      /https?:\/\/|drive\.google\.com|\.mp4\b|[0-9a-f]{64}/iu,
    );
  });

  it('returns a same-origin protected descriptor with no raw provider target', async () => {
    const service = createParentWelcomeService({
      repository: repository(),
      playbackRuntimeAvailable: true,
      clock: () => new Date('2026-08-15T10:00:00.000Z'),
    });

    const descriptor = await service.playbackDescriptor(principal, 'welcome-approved-v1');

    expect(descriptor).toMatchObject({
      kind: 'protected_parent_video',
      captions_default: true,
      autoplay_policy: 'muted_when_allowed',
    });
    expect(descriptor.media_path).toBe('/api/app/parent/welcome-video/welcome-approved-v1/media');
    expect(JSON.stringify(descriptor)).not.toMatch(/vimeo|drive|s3|https?:\/\//iu);
  });

  it('records 10-second activation transactionally without a Student progress identity', async () => {
    const repo = repository();
    const service = createParentWelcomeService({
      repository: repo,
      playbackRuntimeAvailable: true,
    });
    const result = await service.recordBrowserEvent(
      principal,
      {
        event_type: 'parent.welcome_video_10_seconds',
        video_version_id: 'welcome-approved-v1',
        observed_playback_seconds: 10.25,
        observed_position_percent: 12,
      },
      {
        idempotency_key: 'welcome-activation-0001',
        canonical_request_hash: 'b'.repeat(64),
        occurred_at: '2026-08-15T10:00:10.000Z',
      },
    );

    expect(result.receipts.map(({ event_type }) => event_type)).toEqual([
      'parent.welcome_video_10_seconds',
      'parent.companion_activated',
    ]);
    const recorded = repo.recordEvents.mock.calls.at(-1)?.[0] ?? [];
    expect(JSON.stringify(recorded)).not.toMatch(/student_id|attendance|streak|badge|progress/iu);
  });

  it('rejects seek-only quartiles and stale video versions', async () => {
    const service = createParentWelcomeService({
      repository: repository(),
      playbackRuntimeAvailable: true,
    });
    await expect(
      service.recordBrowserEvent(
        principal,
        {
          event_type: 'parent.welcome_video_75_percent',
          video_version_id: 'welcome-approved-v1',
          observed_playback_seconds: 2,
          observed_position_percent: 75,
        },
        {
          idempotency_key: 'welcome-seek-only-0001',
          canonical_request_hash: 'c'.repeat(64),
          occurred_at: '2026-08-15T10:00:10.000Z',
        },
      ),
    ).rejects.toMatchObject({ code: 'parent_welcome_invalid_event' });
    await expect(service.playbackDescriptor(principal, 'welcome-stale-v0')).rejects.toMatchObject({
      code: 'parent_welcome_version_mismatch',
    });
  });
});
