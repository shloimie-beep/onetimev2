const PARENT_LEARNING_BOOTSTRAP_PATH = '/api/v1/portals/parent/learning';
const PARENT_CONTENT_PROGRESS_PATH = '/api/v1/portals/parent/learning/content-progress';
const VIMEO_PLAYER_ORIGIN = 'https://player.vimeo.com';
const PROGRESS_INTERVAL_MS = 15_000;
const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,255}$/u;

export type ProtectedContentProgressConfig = {
  contentId: string;
  contentVersionId: string;
  durationMs: number;
};

export type ProtectedContentPlayerWindow = {
  postMessage(message: unknown, targetOrigin: string): void;
};

export type ProtectedContentMessageTarget = {
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
};

type ParentContentProgressCommand = {
  content_id: string;
  content_version_id: string;
  position_ms: number;
  duration_ms: number;
  completed: boolean;
};

type VimeoPlaybackEvent = {
  event: 'play' | 'timeupdate' | 'pause' | 'ended';
  seconds: number;
  duration: number;
  percent: number;
};

export function createProtectedContentProgressController(input: {
  config: ProtectedContentProgressConfig;
  playerWindow: ProtectedContentPlayerWindow;
  messages: ProtectedContentMessageTarget;
  fetcher?: typeof fetch;
  digest?: (value: string) => Promise<string>;
}) {
  const config = requireConfig(input.config);
  const fetcher = input.fetcher ?? globalThis.fetch.bind(globalThis);
  const digest = input.digest ?? sha256;
  let csrfToken: string | null = null;
  let active = false;
  let startAttempted = false;
  let startedRecorded = false;
  let completedRecorded = false;
  let greatestProgressPosition = 0;
  let pending = Promise.resolve();
  const queuedKeys = new Set<string>();

  const onMessage = (message: MessageEvent) => {
    if (
      !active ||
      message.origin !== VIMEO_PLAYER_ORIGIN ||
      message.source !== (input.playerWindow as unknown as MessageEventSource)
    ) {
      return;
    }
    const payload = parseMessageData(message.data);
    if (!payload) return;
    if (payload.event === 'ready') {
      subscribe();
      return;
    }
    const event = parsePlaybackEvent(payload, config.durationMs);
    if (!event || completedRecorded) return;
    if (event.event === 'play') {
      if (startedRecorded) return;
      startedRecorded = true;
      const observed = incompletePosition(event.seconds, config.durationMs);
      greatestProgressPosition = Math.max(greatestProgressPosition, observed);
      enqueue(progressCommand(config, observed, false));
      return;
    }
    if (event.event === 'timeupdate') {
      const observed = incompletePosition(event.seconds, config.durationMs);
      const bucketPosition = Math.floor(observed / PROGRESS_INTERVAL_MS) * PROGRESS_INTERVAL_MS;
      if (bucketPosition < PROGRESS_INTERVAL_MS || bucketPosition <= greatestProgressPosition)
        return;
      greatestProgressPosition = bucketPosition;
      enqueue(progressCommand(config, bucketPosition, false));
      return;
    }
    if (event.event === 'pause') {
      const observed = incompletePosition(event.seconds, config.durationMs);
      if (observed <= greatestProgressPosition) return;
      greatestProgressPosition = observed;
      enqueue(progressCommand(config, observed, false));
      return;
    }
    if (event.percent < 0.999 && event.seconds < event.duration - 0.5) return;
    completedRecorded = true;
    greatestProgressPosition = config.durationMs;
    enqueue(progressCommand(config, config.durationMs, true));
  };

  function subscribe() {
    if (!active) return;
    for (const eventName of ['play', 'timeupdate', 'pause', 'ended'] as const) {
      input.playerWindow.postMessage(
        { method: 'addEventListener', value: eventName },
        VIMEO_PLAYER_ORIGIN,
      );
    }
  }

  function enqueue(command: ParentContentProgressCommand) {
    pending = pending
      .catch(() => undefined)
      .then(async () => {
        if (!active || !csrfToken) return;
        const key = `parent-content-progress-${await digest(canonicalCommand(command))}`;
        if (!/^parent-content-progress-[a-f0-9]{64}$/u.test(key) || queuedKeys.has(key)) return;
        queuedKeys.add(key);
        const body = JSON.stringify(command);
        const request: RequestInit = {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          keepalive: true,
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'x-csrf-token': csrfToken,
            'x-idempotency-key': key,
          },
          body,
        };
        const first = await fetcher(PARENT_CONTENT_PROGRESS_PATH, request).catch(() => null);
        if (first?.ok || (first && first.status < 500)) return;
        await fetcher(PARENT_CONTENT_PROGRESS_PATH, request).catch(() => undefined);
      });
  }

  return {
    async start() {
      if (startAttempted) return active;
      startAttempted = true;
      try {
        const response = await fetcher(PARENT_LEARNING_BOOTSTRAP_PATH, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { accept: 'application/json' },
        });
        if (!response.ok) return false;
        const bootstrap = parseBootstrap(await response.json(), config);
        if (!bootstrap) return false;
        csrfToken = bootstrap.csrfToken;
        active = true;
        input.messages.addEventListener('message', onMessage);
        subscribe();
        return true;
      } catch {
        return false;
      }
    },

    subscribe,

    idle() {
      return pending.catch(() => undefined);
    },

    dispose() {
      if (active) input.messages.removeEventListener('message', onMessage);
      active = false;
      csrfToken = null;
    },
  };
}

export async function installProtectedContentPlayerProgress(
  documentRef: Document = document,
  windowRef: Window = window,
) {
  const root = documentRef.querySelector<HTMLElement>('[data-parent-content-progress="enabled"]');
  const iframe = root?.querySelector<HTMLIFrameElement>('[data-protected-content-frame]');
  if (!root || !iframe?.contentWindow) return null;
  const parsed = parseDocumentConfig(root, iframe, windowRef.location.origin);
  if (!parsed) return null;
  const controller = createProtectedContentProgressController({
    config: parsed,
    playerWindow: iframe.contentWindow,
    messages: windowRef,
  });
  if (!(await controller.start())) return null;
  iframe.addEventListener('load', controller.subscribe);
  windowRef.addEventListener(
    'pagehide',
    () => {
      iframe.removeEventListener('load', controller.subscribe);
      controller.dispose();
    },
    { once: true },
  );
  return controller;
}

function parseDocumentConfig(
  root: HTMLElement,
  iframe: HTMLIFrameElement,
  currentOrigin: string,
): ProtectedContentProgressConfig | null {
  const config = {
    contentId: root.dataset.contentId ?? '',
    contentVersionId: root.dataset.contentVersionId ?? '',
    durationMs: Number(root.dataset.contentDurationMs),
  };
  try {
    requireConfig(config);
  } catch {
    return null;
  }
  const rawSource = iframe.getAttribute('src');
  if (!rawSource) return null;
  try {
    const source = new URL(rawSource, currentOrigin);
    const encodedContentId = encodeURIComponent(config.contentId);
    const allowedPaths = new Set([
      `/api/v1/content/vimeo/${encodedContentId}/playback`,
      `/api/v1/content/factory/${encodedContentId}/embed`,
    ]);
    if (
      source.origin !== currentOrigin ||
      source.search !== '' ||
      source.hash !== '' ||
      !allowedPaths.has(source.pathname)
    ) {
      return null;
    }
  } catch {
    return null;
  }
  return config;
}

function parseBootstrap(value: unknown, config: ProtectedContentProgressConfig) {
  if (!isRecord(value) || value.success !== true || !isRecord(value.data)) return null;
  const csrfToken = value.data.csrf_token;
  const snapshot = value.data.snapshot;
  if (
    typeof csrfToken !== 'string' ||
    csrfToken.length < 16 ||
    !isRecord(snapshot) ||
    !Array.isArray(snapshot.library_items)
  ) {
    return null;
  }
  const exactItem = snapshot.library_items.some(
    (item) =>
      isRecord(item) &&
      item.content_id === config.contentId &&
      item.content_version_id === config.contentVersionId,
  );
  return exactItem ? { csrfToken } : null;
}

function parseMessageData(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return isRecord(value) ? value : null;
}

function parsePlaybackEvent(
  value: Record<string, unknown>,
  governedDurationMs: number,
): VimeoPlaybackEvent | null {
  if (!['play', 'timeupdate', 'pause', 'ended'].includes(String(value.event))) return null;
  if (!isRecord(value.data)) return null;
  const seconds = value.data.seconds;
  const duration = value.data.duration;
  const percent = value.data.percent;
  if (
    typeof seconds !== 'number' ||
    !Number.isFinite(seconds) ||
    seconds < 0 ||
    typeof duration !== 'number' ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    typeof percent !== 'number' ||
    !Number.isFinite(percent) ||
    percent < 0 ||
    percent > 1
  ) {
    return null;
  }
  const reportedDurationMs = Math.round(duration * 1_000);
  const durationTolerance = Math.max(2_000, Math.round(governedDurationMs * 0.02));
  if (Math.abs(reportedDurationMs - governedDurationMs) > durationTolerance) return null;
  return {
    event: value.event as VimeoPlaybackEvent['event'],
    seconds,
    duration,
    percent,
  };
}

function progressCommand(
  config: ProtectedContentProgressConfig,
  positionMs: number,
  completed: boolean,
): ParentContentProgressCommand {
  return {
    content_id: config.contentId,
    content_version_id: config.contentVersionId,
    position_ms: positionMs,
    duration_ms: config.durationMs,
    completed,
  };
}

function incompletePosition(seconds: number, durationMs: number) {
  const observed = Math.max(0, Math.floor((seconds * 1_000) / 1_000) * 1_000);
  return Math.min(observed, Math.max(0, durationMs - 1));
}

function canonicalCommand(command: ParentContentProgressCommand) {
  return JSON.stringify([
    command.content_id,
    command.content_version_id,
    command.position_ms,
    command.duration_ms,
    command.completed,
  ]);
}

function requireConfig(config: ProtectedContentProgressConfig) {
  if (
    !SAFE_IDENTIFIER.test(config.contentId) ||
    !SAFE_IDENTIFIER.test(config.contentVersionId) ||
    !Number.isSafeInteger(config.durationMs) ||
    config.durationMs < 1
  ) {
    throw new Error('Protected Parent content progress configuration is invalid.');
  }
  return config;
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const result = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(result), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  void installProtectedContentPlayerProgress();
}
