import type {
  ParentLearningActionDescriptor,
  ParentLearningMutationReceipt,
  ParentLearningSnapshot,
  RecordParentAttendanceCommand,
  RecordParentContentProgressCommand,
  SubmitParentQuestionCommand,
} from '../../../../../../../packages/contracts/src/portals/parent-learning/index.ts';
import type {
  ParentWelcomeEventCommand,
  ParentWelcomeEventResult,
  ParentWelcomePlaybackDescriptor,
  ParentWelcomeVideoReady,
  ParentWelcomeVideoSlot,
} from '../../../../../../../packages/contracts/src/portals/parent-welcome/index.ts';

export type {
  ParentLearningActionDescriptor,
  ParentLearningLibraryItem,
  ParentLearningMutationReceipt,
  ParentLearningSnapshot,
  RecordParentAttendanceCommand,
  RecordParentContentProgressCommand,
  SubmitParentQuestionCommand,
} from '../../../../../../../packages/contracts/src/portals/parent-learning/index.ts';
export type {
  ParentWelcomeEventCommand,
  ParentWelcomeEventResult,
  ParentWelcomePlaybackDescriptor,
  ParentWelcomeVideoReady,
  ParentWelcomeVideoSlot,
} from '../../../../../../../packages/contracts/src/portals/parent-welcome/index.ts';

export const PARENT_LEARNING_ENDPOINTS = Object.freeze({
  overview: '/api/v1/portals/parent/learning',
  attendance: '/api/v1/portals/parent/learning/attendance',
  contentProgress: '/api/v1/portals/parent/learning/content-progress',
  questions: '/api/v1/portals/parent/learning/questions',
} as const);

export const PARENT_WELCOME_SLOT_ENDPOINT = '/api/app/parent/summary' as const;
export const PARENT_WELCOME_EVENT_ENDPOINT = '/api/app/parent/welcome-video/events' as const;

export type ParentLearningBootstrap = {
  snapshot: ParentLearningSnapshot;
  csrf_token: string;
};

export type ParentProductionBasicLaunchArtifact = {
  mode: 'production_basic';
  role: 0;
  sdk_web_version: string;
  meeting_number: string;
  meeting_password: string;
  signature: string;
  user_name: string;
  leave_path: '/app/parent';
  zak?: never;
  issued_at: string;
  expires_at: string;
  raw_join_url_present: false;
  video_start_model: 'PARTICIPANT_CONSENT';
};

export class ParentLearningApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ParentLearningApiError';
  }
}

export function createParentLearningApi(
  input: {
    fetcher?: typeof fetch;
    idempotencyKey?: () => string;
    now?: () => Date;
  } = {},
) {
  const fetcher = input.fetcher ?? globalThis.fetch.bind(globalThis);
  const nextIdempotencyKey = input.idempotencyKey ?? browserIdempotencyKey;
  const now = input.now ?? (() => new Date());

  async function read<T>(response: Response): Promise<T> {
    const payload = (await response.json()) as unknown;
    if (!response.ok || !isRecord(payload) || payload.success !== true || !('data' in payload)) {
      const code =
        isRecord(payload) && typeof payload.code === 'string'
          ? payload.code
          : 'PARENT_LEARNING_REQUEST_FAILED';
      const message =
        isRecord(payload) && typeof payload.message === 'string'
          ? payload.message
          : 'Parent learning is unavailable right now.';
      throw new ParentLearningApiError(code, message, response.status);
    }
    return payload.data as T;
  }

  async function mutate<TCommand>(
    path: (typeof PARENT_LEARNING_ENDPOINTS)[keyof typeof PARENT_LEARNING_ENDPOINTS],
    command: TCommand,
    csrfToken: string,
    idempotencyKey = nextIdempotencyKey(),
  ) {
    return read<{ receipt: ParentLearningMutationReceipt }>(
      await fetcher(path, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        keepalive: true,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-csrf-token': csrfToken,
          'x-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify(command),
      }),
    );
  }

  return {
    async load() {
      return read<ParentLearningBootstrap>(
        await fetcher(PARENT_LEARNING_ENDPOINTS.overview, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { accept: 'application/json' },
        }),
      );
    },

    async loadWelcomeVideo() {
      const data = await read<{
        snapshot: { featured_welcome_video: ParentWelcomeVideoSlot };
      }>(
        await fetcher(PARENT_WELCOME_SLOT_ENDPOINT, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { accept: 'application/json' },
        }),
      );
      return requireWelcomeSlot(data.snapshot.featured_welcome_video);
    },

    async loadWelcomePlayback(slot: ParentWelcomeVideoReady) {
      requireWelcomeDescriptorPath(slot);
      const data = await read<{ descriptor: ParentWelcomePlaybackDescriptor }>(
        await fetcher(slot.playback_descriptor_path, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { accept: 'application/json' },
        }),
      );
      return requireWelcomePlaybackDescriptor(data.descriptor, slot, now());
    },

    async recordWelcomeEvent(
      command: ParentWelcomeEventCommand,
      csrfToken: string,
      idempotencyKey = nextIdempotencyKey(),
    ) {
      return read<ParentWelcomeEventResult>(
        await fetcher(PARENT_WELCOME_EVENT_ENDPOINT, {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          keepalive: true,
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'x-csrf-token': csrfToken,
            'x-idempotency-key': idempotencyKey,
          },
          body: JSON.stringify(command),
        }),
      );
    },

    async openContent(action: ParentLearningActionDescriptor) {
      requireContentOpenAction(action);
      const data = await read<{ action: ParentLearningActionDescriptor }>(
        await fetcher(action.href, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { accept: 'application/json' },
        }),
      );
      return requireContentDestination(data.action);
    },

    async launchClass(action: ParentLearningActionDescriptor, csrfToken: string) {
      requireClassLaunchAction(action);
      const data = await read<{ launch_artifact: ParentProductionBasicLaunchArtifact }>(
        await fetcher(action.href, {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: {
            accept: 'application/json',
            'x-csrf-token': csrfToken,
          },
        }),
      );
      return requireParentLaunchArtifact(data.launch_artifact);
    },

    recordAttendance(
      command: RecordParentAttendanceCommand,
      csrfToken: string,
      idempotencyKey?: string,
    ) {
      return mutate(PARENT_LEARNING_ENDPOINTS.attendance, command, csrfToken, idempotencyKey);
    },

    recordContentProgress(
      command: RecordParentContentProgressCommand,
      csrfToken: string,
      idempotencyKey?: string,
    ) {
      return mutate(PARENT_LEARNING_ENDPOINTS.contentProgress, command, csrfToken, idempotencyKey);
    },

    submitQuestion(
      command: SubmitParentQuestionCommand,
      csrfToken: string,
      idempotencyKey?: string,
    ) {
      return mutate(PARENT_LEARNING_ENDPOINTS.questions, command, csrfToken, idempotencyKey);
    },
  };
}

export type ParentLearningApi = ReturnType<typeof createParentLearningApi>;

function browserIdempotencyKey() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `parent-learning-${globalThis.crypto.randomUUID()}`;
  }
  const bytes = new Uint8Array(24);
  globalThis.crypto?.getRandomValues(bytes);
  const encoded = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  if (!encoded || /^0+$/u.test(encoded)) {
    throw new Error('Secure browser randomness is required for Parent learning actions.');
  }
  return `parent-learning-${encoded}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireContentOpenAction(action: ParentLearningActionDescriptor) {
  if (
    action.kind !== 'content_open' ||
    action.method !== 'GET' ||
    !isCanonicalActionPath(
      action.href,
      /^\/api\/v1\/portals\/parent\/learning\/content\/[A-Za-z0-9._:%-]+\/open$/u,
    )
  ) {
    throw invalidAction();
  }
}

function requireClassLaunchAction(action: ParentLearningActionDescriptor) {
  if (
    action.kind !== 'class_launch' ||
    action.method !== 'POST' ||
    action.href !== '/api/v1/portals/parent/classroom/production-basic/launch'
  ) {
    throw invalidAction();
  }
}

function requireContentDestination(action: ParentLearningActionDescriptor) {
  if (
    !isRecord(action) ||
    action.kind !== 'content_open' ||
    action.method !== 'GET' ||
    !isCanonicalActionPath(action.href, /^\/app\/learning\/items\/[A-Za-z0-9._:%-]+$/u)
  ) {
    throw invalidAction();
  }
  return action;
}

function requireParentLaunchArtifact(value: ParentProductionBasicLaunchArtifact) {
  if (
    !isRecord(value) ||
    value.mode !== 'production_basic' ||
    value.role !== 0 ||
    value.leave_path !== '/app/parent' ||
    'zak' in value ||
    value.raw_join_url_present !== false ||
    value.video_start_model !== 'PARTICIPANT_CONSENT' ||
    !hasNonEmptyStrings(value, [
      'sdk_web_version',
      'meeting_number',
      'meeting_password',
      'signature',
      'user_name',
      'issued_at',
      'expires_at',
    ])
  ) {
    throw invalidAction();
  }
  return value;
}

function isCanonicalActionPath(value: string, pattern: RegExp) {
  if (!pattern.test(value) || value.includes('?') || value.includes('#')) return false;
  try {
    const parsed = new URL(value, 'https://parent-learning.invalid');
    return (
      parsed.origin === 'https://parent-learning.invalid' &&
      parsed.pathname === value &&
      parsed.search === '' &&
      parsed.hash === ''
    );
  } catch {
    return false;
  }
}

function hasNonEmptyStrings(value: Record<string, unknown>, keys: readonly string[]) {
  return keys.every((key) => typeof value[key] === 'string' && value[key] !== '');
}

function invalidAction() {
  return new ParentLearningApiError(
    'PARENT_LEARNING_ACTION_INVALID',
    'The Parent learning action is invalid.',
    0,
  );
}

function requireWelcomeSlot(value: ParentWelcomeVideoSlot): ParentWelcomeVideoSlot {
  if (!isRecord(value) || value.contract_version !== '1.0.0') throw invalidWelcome();
  if (value.status === 'unavailable') {
    if (
      value.reason !== 'no_approved_version' ||
      value.title !== 'Welcome to One Time' ||
      typeof value.message !== 'string' ||
      !hasOnlyKeys(value, ['contract_version', 'status', 'reason', 'title', 'message'])
    ) {
      throw invalidWelcome();
    }
    return {
      contract_version: '1.0.0',
      status: 'unavailable',
      reason: 'no_approved_version',
      title: 'Welcome to One Time',
      message: value.message,
    };
  }
  if (
    value.status !== 'ready' ||
    value.slot_key !== 'parent_companion_welcome' ||
    !isWelcomeVersion(value.video_version_id) ||
    typeof value.title !== 'string' ||
    !value.title.trim() ||
    !Number.isFinite(value.duration_ms) ||
    value.duration_ms <= 0 ||
    !Number.isInteger(value.width) ||
    value.width <= 0 ||
    !Number.isInteger(value.height) ||
    value.height <= 0 ||
    value.aspect_ratio !== '16:9' ||
    value.captions_available !== true ||
    value.poster_available !== true ||
    value.activation_threshold_seconds !== 10 ||
    value.completion_threshold_percent !== 90 ||
    !hasOnlyKeys(value, [
      'contract_version',
      'status',
      'slot_key',
      'video_version_id',
      'title',
      'duration_ms',
      'width',
      'height',
      'aspect_ratio',
      'captions_available',
      'poster_available',
      'playback_descriptor_path',
      'activation_threshold_seconds',
      'completion_threshold_percent',
    ])
  ) {
    throw invalidWelcome();
  }
  requireWelcomeDescriptorPath(value);
  return {
    contract_version: '1.0.0',
    status: 'ready',
    slot_key: 'parent_companion_welcome',
    video_version_id: value.video_version_id,
    title: value.title,
    duration_ms: value.duration_ms,
    width: value.width,
    height: value.height,
    aspect_ratio: '16:9',
    captions_available: true,
    poster_available: true,
    playback_descriptor_path: value.playback_descriptor_path,
    activation_threshold_seconds: 10,
    completion_threshold_percent: 90,
  };
}

function requireWelcomeDescriptorPath(slot: ParentWelcomeVideoReady) {
  const expected = welcomeAssetPath(slot.video_version_id, 'playback');
  if (slot.playback_descriptor_path !== expected || !isCanonicalExactPath(expected)) {
    throw invalidWelcome();
  }
}

function requireWelcomePlaybackDescriptor(
  value: unknown,
  slot: ParentWelcomeVideoReady,
  observedAt: Date,
): ParentWelcomePlaybackDescriptor {
  if (!isRecord(value)) throw invalidWelcome();
  const expiresAt = typeof value.expires_at === 'string' ? new Date(value.expires_at) : null;
  const mediaPath = welcomeAssetPath(slot.video_version_id, 'media');
  const posterPath = welcomeAssetPath(slot.video_version_id, 'poster');
  const captionsPath = welcomeAssetPath(slot.video_version_id, 'captions');
  if (
    value.contract_version !== '1.0.0' ||
    value.kind !== 'protected_parent_video' ||
    value.video_version_id !== slot.video_version_id ||
    value.media_path !== mediaPath ||
    value.poster_path !== posterPath ||
    value.captions_path !== captionsPath ||
    value.captions_default !== true ||
    value.autoplay_policy !== 'muted_when_allowed' ||
    !expiresAt ||
    !Number.isFinite(expiresAt.getTime()) ||
    !Number.isFinite(observedAt.getTime()) ||
    expiresAt.getTime() <= observedAt.getTime() ||
    ![mediaPath, posterPath, captionsPath].every(isCanonicalExactPath) ||
    !hasOnlyKeys(value, [
      'contract_version',
      'kind',
      'video_version_id',
      'media_path',
      'poster_path',
      'captions_path',
      'captions_default',
      'autoplay_policy',
      'expires_at',
    ])
  ) {
    throw invalidWelcome();
  }
  return {
    contract_version: '1.0.0',
    kind: 'protected_parent_video',
    video_version_id: slot.video_version_id,
    media_path: mediaPath,
    poster_path: posterPath,
    captions_path: captionsPath,
    captions_default: true,
    autoplay_policy: 'muted_when_allowed',
    expires_at: expiresAt.toISOString(),
  };
}

function welcomeAssetPath<Suffix extends 'playback' | 'media' | 'poster' | 'captions'>(
  videoVersionId: string,
  suffix: Suffix,
): `/api/app/parent/welcome-video/${string}/${Suffix}` {
  if (!isWelcomeVersion(videoVersionId)) throw invalidWelcome();
  return `/api/app/parent/welcome-video/${encodeURIComponent(videoVersionId)}/${suffix}`;
}

function isWelcomeVersion(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{2,159}$/u.test(value);
}

function isCanonicalExactPath(value: string) {
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('?') ||
    value.includes('#')
  ) {
    return false;
  }
  try {
    const parsed = new URL(value, 'https://parent-welcome.invalid');
    return parsed.origin === 'https://parent-welcome.invalid' && parsed.pathname === value;
  } catch {
    return false;
  }
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  const keys = Object.keys(value);
  return keys.length === allowed.length && keys.every((key) => allowed.includes(key));
}

function invalidWelcome() {
  return new ParentLearningApiError(
    'PARENT_WELCOME_RESPONSE_INVALID',
    'The Parent welcome video response is invalid.',
    0,
  );
}
