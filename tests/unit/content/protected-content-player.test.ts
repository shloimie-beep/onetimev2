import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  createProtectedContentProgressController,
  installProtectedContentPlayerProgress,
  type ProtectedContentMessageTarget,
  type ProtectedContentPlayerWindow,
} from '../../../apps/web/src/client/app/protected-content-player.ts';

const config = {
  contentId: 'existing-vimeo-safe-source',
  contentVersionId: 'existing-vimeo-safe-revision',
  durationMs: 91_000,
};

describe('Parent protected-content progress client', () => {
  it('accepts only the bound Vimeo frame and records source-proven started, progress, and completion facts', async () => {
    const postedMessages: Array<{ message: unknown; targetOrigin: string }> = [];
    const playerWindow: ProtectedContentPlayerWindow = {
      postMessage(message, targetOrigin) {
        postedMessages.push({ message, targetOrigin });
      },
    };
    const messages = new MemoryMessageTarget();
    const requests: Array<{ path: string; init?: RequestInit }> = [];
    const fetcher = vi.fn(async (path: string | URL | Request, init?: RequestInit) => {
      requests.push({ path: String(path), ...(init ? { init } : {}) });
      if (String(path).endsWith('/learning')) {
        return jsonResponse(200, {
          success: true,
          data: {
            csrf_token: 'parent-learning-csrf-token-0001',
            snapshot: {
              library_items: [
                {
                  content_id: config.contentId,
                  content_version_id: config.contentVersionId,
                },
              ],
            },
          },
        });
      }
      return jsonResponse(200, {
        success: true,
        data: {
          receipt: {
            disposition: 'committed',
            operation: 'content_progress_recorded',
            entity_id: 'safe-progress-event',
          },
        },
      });
    });
    const controller = createProtectedContentProgressController({
      config,
      playerWindow,
      messages,
      fetcher: fetcher as typeof fetch,
      digest: async (value) => deterministicDigest(value),
    });

    await expect(controller.start()).resolves.toBe(true);

    messages.emit({
      origin: 'https://evil.example',
      source: playerWindow,
      data: { event: 'ready' },
    });
    messages.emit({
      origin: 'https://player.vimeo.com',
      source: { postMessage: vi.fn() },
      data: { event: 'ready' },
    });
    expect(postedMessages).toHaveLength(4);

    messages.emit({
      origin: 'https://player.vimeo.com',
      source: playerWindow,
      data: { event: 'ready' },
    });
    expect(postedMessages).toHaveLength(8);
    expect(postedMessages).toEqual(
      expect.arrayContaining([
        {
          message: { method: 'addEventListener', value: 'timeupdate' },
          targetOrigin: 'https://player.vimeo.com',
        },
        {
          message: { method: 'addEventListener', value: 'ended' },
          targetOrigin: 'https://player.vimeo.com',
        },
      ]),
    );

    messages.emit({
      origin: 'https://player.vimeo.com',
      source: { postMessage: vi.fn() },
      data: playbackEvent('play', 0.7),
    });
    messages.emit({
      origin: 'https://player.vimeo.com',
      source: playerWindow,
      data: playbackEvent('play', 0.7),
    });
    messages.emit({
      origin: 'https://player.vimeo.com',
      source: playerWindow,
      data: playbackEvent('timeupdate', 16.8),
    });
    messages.emit({
      origin: 'https://player.vimeo.com',
      source: playerWindow,
      data: playbackEvent('timeupdate', 19.2),
    });
    messages.emit({
      origin: 'https://player.vimeo.com',
      source: playerWindow,
      data: playbackEvent('ended', 91),
    });
    await controller.idle();

    const mutations = requests.slice(1);
    expect(mutations).toHaveLength(3);
    expect(mutations.map((request) => JSON.parse(String(request.init?.body)))).toEqual([
      {
        content_id: config.contentId,
        content_version_id: config.contentVersionId,
        position_ms: 0,
        duration_ms: 91_000,
        completed: false,
      },
      {
        content_id: config.contentId,
        content_version_id: config.contentVersionId,
        position_ms: 15_000,
        duration_ms: 91_000,
        completed: false,
      },
      {
        content_id: config.contentId,
        content_version_id: config.contentVersionId,
        position_ms: 91_000,
        duration_ms: 91_000,
        completed: true,
      },
    ]);
    for (const request of mutations) {
      expect(request.path).toBe('/api/v1/portals/parent/learning/content-progress');
      expect(request.init).toMatchObject({
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        keepalive: true,
      });
      const headers = request.init?.headers as Record<string, string>;
      expect(headers['x-csrf-token']).toBe('parent-learning-csrf-token-0001');
      expect(headers['x-idempotency-key']).toMatch(/^parent-content-progress-[a-f0-9]{64}$/u);
      expect(JSON.stringify(request)).not.toMatch(
        /provider_video_id|player\.vimeo\.com\/video|token=/iu,
      );
    }

    controller.dispose();
    expect(messages.listenerCount).toBe(0);
  });

  it('does not subscribe or write when the Parent bootstrap lacks the exact content version', async () => {
    const playerWindow = { postMessage: vi.fn() };
    const messages = new MemoryMessageTarget();
    const fetcher = vi.fn(async () =>
      jsonResponse(200, {
        success: true,
        data: {
          csrf_token: 'parent-learning-csrf-token-0001',
          snapshot: {
            library_items: [
              { content_id: config.contentId, content_version_id: 'superseded-revision' },
            ],
          },
        },
      }),
    );
    const controller = createProtectedContentProgressController({
      config,
      playerWindow,
      messages,
      fetcher: fetcher as typeof fetch,
      digest: async (value) => deterministicDigest(value),
    });

    await expect(controller.start()).resolves.toBe(false);
    expect(playerWindow.postMessage).not.toHaveBeenCalled();
    expect(messages.listenerCount).toBe(0);
  });

  it('retries an unknown server effect once with the exact same idempotency key and body', async () => {
    const playerWindow = { postMessage: vi.fn() };
    const messages = new MemoryMessageTarget();
    const attempts: Array<RequestInit> = [];
    const fetcher = vi.fn(async (path: string | URL | Request, init?: RequestInit) => {
      if (String(path).endsWith('/learning')) {
        return jsonResponse(200, {
          success: true,
          data: {
            csrf_token: 'parent-learning-csrf-token-0001',
            snapshot: { library_items: [snakeConfig(config)] },
          },
        });
      }
      attempts.push(init ?? {});
      return jsonResponse(attempts.length === 1 ? 503 : 200, {
        success: attempts.length > 1,
        ...(attempts.length > 1
          ? {
              data: {
                receipt: {
                  disposition: 'replayed',
                  operation: 'content_progress_recorded',
                  entity_id: 'safe-progress-event',
                },
              },
            }
          : { code: 'PARENT_LEARNING_UNAVAILABLE' }),
      });
    });
    const controller = createProtectedContentProgressController({
      config,
      playerWindow,
      messages,
      fetcher: fetcher as typeof fetch,
      digest: async (value) => deterministicDigest(value),
    });
    await controller.start();
    messages.emit({
      origin: 'https://player.vimeo.com',
      source: playerWindow,
      data: playbackEvent('play', 2.1),
    });
    await controller.idle();

    expect(attempts).toHaveLength(2);
    expect(attempts[0]?.body).toBe(attempts[1]?.body);
    expect((attempts[0]?.headers as Record<string, string>)['x-idempotency-key']).toBe(
      (attempts[1]?.headers as Record<string, string>)['x-idempotency-key'],
    );
  });

  it.each([
    'https://player.vimeo.com/video/raw-provider-id',
    '/api/v1/content/vimeo/different-content/playback',
    '/api/v1/content/factory/existing-vimeo-safe-source/embed?token=not-allowed',
  ])(
    'stays inert when the protected iframe source is not the exact governed route: %s',
    async (src) => {
      const iframe = {
        contentWindow: { postMessage: vi.fn() },
        getAttribute: vi.fn(() => src),
      } as unknown as HTMLIFrameElement;
      const root = {
        dataset: {
          contentId: config.contentId,
          contentVersionId: config.contentVersionId,
          contentDurationMs: String(config.durationMs),
        },
        querySelector: vi.fn(() => iframe),
      } as unknown as HTMLElement;
      const documentRef = {
        querySelector: vi.fn(() => root),
      } as unknown as Document;
      const windowRef = {
        location: { origin: 'https://join.onetimeonetime.com' },
      } as unknown as Window;

      await expect(
        installProtectedContentPlayerProgress(documentRef, windowRef),
      ).resolves.toBeNull();
      expect(iframe.getAttribute).toHaveBeenCalledWith('src');
    },
  );
});

class MemoryMessageTarget implements ProtectedContentMessageTarget {
  private listeners = new Set<(event: MessageEvent) => void>();

  get listenerCount() {
    return this.listeners.size;
  }

  addEventListener(_type: 'message', listener: (event: MessageEvent) => void) {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'message', listener: (event: MessageEvent) => void) {
    this.listeners.delete(listener);
  }

  emit(event: { origin: string; source: unknown; data: unknown }) {
    for (const listener of this.listeners) listener(event as MessageEvent);
  }
}

function playbackEvent(event: 'play' | 'timeupdate' | 'ended', seconds: number) {
  return {
    event,
    data: { seconds, duration: 91, percent: seconds / 91 },
  };
}

function snakeConfig(value: typeof config) {
  return {
    content_id: value.contentId,
    content_version_id: value.contentVersionId,
  };
}

function deterministicDigest(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function jsonResponse(status: number, value: unknown) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
