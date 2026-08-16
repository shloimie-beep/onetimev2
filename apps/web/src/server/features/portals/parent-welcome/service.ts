import { createHash } from 'node:crypto';
import {
  PARENT_WELCOME_ERROR_CODES,
  PARENT_WELCOME_VIDEO_CONTRACT_VERSION,
  PARENT_WELCOME_VIDEO_SLOT_KEY,
  PARENT_WELCOME_VIDEO_UNBOUND_VERSION,
  type ParentWelcomeBrowserEventType,
  type ParentWelcomeErrorCode,
  type ParentWelcomeEventBinding,
  type ParentWelcomeEventCommand,
  type ParentWelcomeEventRecord,
  type ParentWelcomeEventResult,
  type ParentWelcomeFunnelStep,
  type ParentWelcomePlaybackDescriptor,
  type ParentWelcomePrincipal,
  type ParentWelcomeRepository,
  type ParentWelcomeVideoReady,
  type ParentWelcomeVideoSlot,
  type ParentWelcomeVideoSlotRecord,
} from '../../../../../../../packages/contracts/src/portals/parent-welcome/index.ts';

const SAFE_VERSION = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,159}$/u;
const SAFE_IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

export class ParentWelcomeError extends Error {
  constructor(
    readonly code: ParentWelcomeErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ParentWelcomeError';
  }
}

export function createParentWelcomeService(input: {
  repository: ParentWelcomeRepository;
  playbackRuntimeAvailable: boolean;
  clock?: () => Date;
}) {
  const clock = input.clock ?? (() => new Date());

  return {
    async featuredSlot(principal: ParentWelcomePrincipal): Promise<ParentWelcomeVideoSlot> {
      assertPrincipal(principal);
      try {
        await recordPortalOpen(input.repository, principal, clock());
        if (!input.playbackRuntimeAvailable) return unavailableSlot();
        const record = await input.repository.loadCurrentSlot(principal);
        return record ? readySlot(record) : unavailableSlot();
      } catch {
        return unavailableSlot();
      }
    },

    async playbackDescriptor(
      principal: ParentWelcomePrincipal,
      videoVersionId: string,
    ): Promise<ParentWelcomePlaybackDescriptor> {
      assertPrincipal(principal);
      if (!input.playbackRuntimeAvailable) throw slotUnavailable();
      const record = await input.repository.loadCurrentSlot(principal);
      if (!record) throw slotUnavailable();
      const slot = readySlot(record);
      if (slot.video_version_id !== videoVersionId) {
        throw new ParentWelcomeError(
          PARENT_WELCOME_ERROR_CODES.versionMismatch,
          'This welcome video version is no longer current.',
        );
      }
      const encoded = encodeURIComponent(slot.video_version_id);
      return {
        contract_version: PARENT_WELCOME_VIDEO_CONTRACT_VERSION,
        kind: 'protected_parent_video',
        video_version_id: slot.video_version_id,
        media_path: `/api/app/parent/welcome-video/${encoded}/media`,
        poster_path: `/api/app/parent/welcome-video/${encoded}/poster`,
        captions_path: `/api/app/parent/welcome-video/${encoded}/captions`,
        captions_default: true,
        autoplay_policy: 'muted_when_allowed',
        expires_at: new Date(clock().getTime() + 5 * 60 * 1000).toISOString(),
      };
    },

    async recordBrowserEvent(
      principal: ParentWelcomePrincipal,
      command: ParentWelcomeEventCommand,
      binding: ParentWelcomeEventBinding,
    ): Promise<ParentWelcomeEventResult> {
      assertPrincipal(principal);
      assertBinding(binding);
      const slotRecord = input.playbackRuntimeAvailable
        ? await input.repository.loadCurrentSlot(principal)
        : null;
      const slot = slotRecord ? readySlot(slotRecord) : null;
      const videoVersionId = eventVideoVersion(command, slot);
      assertEventThreshold(command, slot);
      const primary = eventRecord(principal, command, binding, videoVersionId);
      const events: ParentWelcomeEventRecord[] = [primary];
      if (command.event_type === 'parent.welcome_video_10_seconds') {
        events.push({
          ...primary,
          event_type: 'parent.companion_activated',
          binding: {
            idempotency_key: `activated-${digest(binding.idempotency_key).slice(0, 40)}`,
            canonical_request_hash: digest(
              `${binding.canonical_request_hash}:parent.companion_activated`,
            ),
            occurred_at: binding.occurred_at,
          },
        });
      }
      return { receipts: await input.repository.recordEvents(events) };
    },

    async activationFunnel(): Promise<readonly ParentWelcomeFunnelStep[]> {
      return input.repository.loadFunnelReport();
    },
  };
}

export type ParentWelcomeService = ReturnType<typeof createParentWelcomeService>;

function unavailableSlot(): ParentWelcomeVideoSlot {
  return {
    contract_version: PARENT_WELCOME_VIDEO_CONTRACT_VERSION,
    status: 'unavailable',
    reason: 'no_approved_version',
    title: 'Welcome to One Time',
    message:
      'An approved Parent welcome video is not available yet. You can still add a Student, see the next class, or get help.',
  };
}

function readySlot(record: ParentWelcomeVideoSlotRecord): ParentWelcomeVideoReady {
  if (
    record.slot_key !== PARENT_WELCOME_VIDEO_SLOT_KEY ||
    !SAFE_VERSION.test(record.video_version_id) ||
    record.duration_ms < 60_000 ||
    record.duration_ms > 120_000 ||
    record.width * 9 !== record.height * 16 ||
    record.captions_available !== true ||
    record.poster_available !== true ||
    !record.title.trim() ||
    /https?:\/\//iu.test(record.title)
  ) {
    throw new ParentWelcomeError(
      PARENT_WELCOME_ERROR_CODES.invalidEvent,
      'The approved welcome video record is invalid.',
    );
  }
  const encoded = encodeURIComponent(record.video_version_id);
  return {
    contract_version: PARENT_WELCOME_VIDEO_CONTRACT_VERSION,
    status: 'ready',
    slot_key: PARENT_WELCOME_VIDEO_SLOT_KEY,
    video_version_id: record.video_version_id,
    title: record.title,
    duration_ms: record.duration_ms,
    width: record.width,
    height: record.height,
    aspect_ratio: '16:9',
    captions_available: true,
    poster_available: true,
    playback_descriptor_path: `/api/app/parent/welcome-video/${encoded}/playback`,
    activation_threshold_seconds: 10,
    completion_threshold_percent: 90,
  };
}

function eventVideoVersion(
  command: ParentWelcomeEventCommand,
  slot: ParentWelcomeVideoReady | null,
) {
  if (command.event_type === 'parent.add_student_clicked') {
    if (command.video_version_id && slot?.video_version_id !== command.video_version_id) {
      throw versionMismatch();
    }
    return (
      command.video_version_id ?? slot?.video_version_id ?? PARENT_WELCOME_VIDEO_UNBOUND_VERSION
    );
  }
  if (!slot) throw slotUnavailable();
  if (command.video_version_id !== slot.video_version_id) throw versionMismatch();
  return slot.video_version_id;
}

function assertEventThreshold(
  command: ParentWelcomeEventCommand,
  slot: ParentWelcomeVideoReady | null,
) {
  const seconds = command.observed_playback_seconds;
  const percent = command.observed_position_percent;
  if (
    (seconds !== undefined && (!Number.isFinite(seconds) || seconds < 0)) ||
    (percent !== undefined && (!Number.isFinite(percent) || percent < 0 || percent > 100))
  ) {
    throw invalidEvent();
  }
  const durationSeconds = slot ? slot.duration_ms / 1000 : 0;
  const threshold: Partial<Record<ParentWelcomeBrowserEventType, number>> = {
    'parent.welcome_video_25_percent': 25,
    'parent.welcome_video_50_percent': 50,
    'parent.welcome_video_75_percent': 75,
    'parent.welcome_video_completed': 90,
  };
  if (command.event_type === 'parent.welcome_video_10_seconds' && (seconds ?? 0) < 10) {
    throw invalidEvent();
  }
  const requiredPercent = threshold[command.event_type];
  if (
    requiredPercent !== undefined &&
    ((percent ?? 0) < requiredPercent || (seconds ?? 0) < durationSeconds * (requiredPercent / 100))
  ) {
    throw invalidEvent();
  }
}

function eventRecord(
  principal: ParentWelcomePrincipal,
  command: ParentWelcomeEventCommand,
  binding: ParentWelcomeEventBinding,
  videoVersionId: string,
): ParentWelcomeEventRecord {
  return {
    principal,
    event_type: command.event_type,
    video_version_id: videoVersionId,
    observed_playback_seconds: command.observed_playback_seconds ?? null,
    observed_position_percent: command.observed_position_percent ?? null,
    binding,
  };
}

async function recordPortalOpen(
  repository: ParentWelcomeRepository,
  principal: ParentWelcomePrincipal,
  occurredAt: Date,
) {
  const naturalKey = `${principal.household_id}:${principal.adult_id}:parent.portal_opened`;
  await repository.recordEvents([
    {
      principal,
      event_type: 'parent.portal_opened',
      video_version_id: PARENT_WELCOME_VIDEO_UNBOUND_VERSION,
      observed_playback_seconds: null,
      observed_position_percent: null,
      binding: {
        idempotency_key: `portal-${digest(naturalKey).slice(0, 40)}`,
        canonical_request_hash: digest(naturalKey),
        occurred_at: occurredAt.toISOString(),
      },
    },
  ]);
}

function assertPrincipal(
  principal: ParentWelcomePrincipal,
): asserts principal is ParentWelcomePrincipal {
  if (
    principal.role !== 'parent' ||
    !principal.adult_id ||
    !principal.household_id ||
    !principal.session_id
  ) {
    throw new ParentWelcomeError(
      PARENT_WELCOME_ERROR_CODES.roleDenied,
      'A signed-in Parent account is required.',
    );
  }
}

function assertBinding(binding: ParentWelcomeEventBinding) {
  if (
    !SAFE_IDEMPOTENCY_KEY.test(binding.idempotency_key) ||
    !SHA256.test(binding.canonical_request_hash) ||
    Number.isNaN(new Date(binding.occurred_at).getTime())
  ) {
    throw invalidEvent();
  }
}

function invalidEvent() {
  return new ParentWelcomeError(
    PARENT_WELCOME_ERROR_CODES.invalidEvent,
    'The welcome video event is invalid.',
  );
}

function slotUnavailable() {
  return new ParentWelcomeError(
    PARENT_WELCOME_ERROR_CODES.slotUnavailable,
    'An approved Parent welcome video is not available.',
  );
}

function versionMismatch() {
  return new ParentWelcomeError(
    PARENT_WELCOME_ERROR_CODES.versionMismatch,
    'This welcome video version is no longer current.',
  );
}

function digest(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
