import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import {
  buildLocalMediaSignature,
  type ContentFactoryIngest,
} from '../../../packages/domain/src/index.ts';
import type { LocalMediaOccurrence, LocalMediaSettings } from './contracts.ts';
import type { LocalMediaSecretStore } from './secret-store.ts';

const VIMEO_ACCEPT = 'application/vnd.vimeo.*+json;version=3.4';

export class OneTimeLocalMediaClient {
  constructor(
    private readonly settings: LocalMediaSettings,
    private readonly secrets: LocalMediaSecretStore,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async listOccurrences(recordedAt: string, nonce: string) {
    const url = this.baseUrl('/api/v1/admin/content/local-runner/occurrences');
    url.searchParams.set('recorded_at', recordedAt);
    url.searchParams.set('before_minutes', String(this.settings.occurrenceWindowBeforeMinutes));
    url.searchParams.set('after_minutes', String(this.settings.occurrenceWindowAfterMinutes));
    const response = await this.signedFetch(url, { method: 'GET', nonce, body: '' });
    const payload = (await response.json()) as {
      success?: boolean;
      occurrences?: LocalMediaOccurrence[];
    };
    if (!response.ok || payload.success !== true || !Array.isArray(payload.occurrences)) {
      throw new Error(`local_media_occurrence_lookup_${response.status}`);
    }
    return payload.occurrences;
  }

  async importDraft(input: { occurrenceKey: string; item: ContentFactoryIngest; nonce: string }) {
    const url = this.baseUrl('/api/v1/admin/content/local-runner/import');
    const body = JSON.stringify({ occurrence_key: input.occurrenceKey, item: input.item });
    const response = await this.signedFetch(url, { method: 'POST', nonce: input.nonce, body });
    const payload = (await response.json()) as {
      success?: boolean;
      source_key?: string;
      state?: string;
      occurrence_key?: string | null;
    };
    if (!response.ok || payload.success !== true) {
      throw new Error(`local_media_import_${response.status}`);
    }
    if (
      payload.source_key !== input.item.sourceKey ||
      payload.occurrence_key !== input.occurrenceKey ||
      payload.state !== 'needs_review'
    ) {
      throw new Error('local_media_import_readback_mismatch');
    }
    return payload;
  }

  private async signedFetch(
    url: URL,
    input: { method: 'GET' | 'POST'; nonce: string; body: string },
  ) {
    const key = await this.secrets.read('one_time_import_hmac_key');
    const timestamp = String(Date.now());
    const requestTarget = `${url.pathname}${url.search}`;
    const signature = buildLocalMediaSignature(key, {
      method: input.method,
      requestTarget,
      timestamp,
      nonce: input.nonce,
      body: input.body,
    });
    return this.fetchImpl(url, {
      method: input.method,
      headers: {
        'x-one-time-media-timestamp': timestamp,
        'x-one-time-media-nonce': input.nonce,
        'x-one-time-media-signature': signature,
        ...(input.method === 'POST' ? { 'content-type': 'application/json' } : {}),
      },
      ...(input.method === 'POST' ? { body: input.body } : {}),
    });
  }

  private baseUrl(apiPath: string) {
    if (!this.settings.oneTimeBaseUrl) throw new Error('local_media_one_time_base_url_required');
    return new URL(apiPath, this.settings.oneTimeBaseUrl);
  }
}

export type VimeoLocalVideo = {
  videoId: string;
  uploadLink: string | null;
  uploadStatus: string;
  privacy: string;
  status: string;
  description: string;
};

export class LocalVimeoTusClient {
  constructor(
    private readonly input: {
      accessToken: string;
      expectedAccountId: string;
      projectUri?: string | undefined;
      timeoutMs: number;
      apiBaseUrl?: string | undefined;
    },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async verifyIdentity() {
    const me = await this.request<Record<string, unknown>>('/me?fields=uri', { method: 'GET' });
    const uri = stringValue(me.uri);
    const expected = normalizeVimeoAccount(this.input.expectedAccountId);
    if (!uri || normalizeVimeoAccount(uri) !== expected) {
      throw new Error('local_media_vimeo_identity_mismatch');
    }
  }

  async reconcileExact(marker: string) {
    const query = new URLSearchParams({
      query: marker,
      per_page: '10',
      fields:
        'data.uri,data.description,data.privacy.view,data.status,data.upload.status,data.upload.upload_link',
    });
    const payload = await this.request<{ data?: Record<string, unknown>[] }>(
      `/me/videos?${query}`,
      { method: 'GET' },
    );
    const matches = (payload.data ?? [])
      .filter((video) => stringValue(video.description) === marker)
      .map(vimeoVideo);
    if (matches.length > 1) throw new Error('local_media_vimeo_asset_ambiguous');
    return matches[0] ?? null;
  }

  async ensureUploadTicket(input: { marker: string; displayName: string; byteLength: number }) {
    const existing = await this.reconcileExact(input.marker);
    if (existing) return existing;
    const created = await this.request<Record<string, unknown>>('/me/videos', {
      method: 'POST',
      body: {
        upload: { approach: 'tus', size: input.byteLength },
        name: input.displayName.slice(0, 120),
        description: input.marker,
        privacy: {
          view: 'nobody',
          embed: 'whitelist',
          download: false,
          add: false,
          comments: 'nobody',
        },
      },
    });
    const video = vimeoVideo(created);
    if (!video.uploadLink) throw new Error('local_media_vimeo_upload_ticket_missing');
    return video;
  }

  async resumeUpload(videoId: string, filePath: string) {
    const video = await this.readVideo(videoId);
    if (!video.uploadLink) {
      if (video.status === 'available' || video.uploadStatus === 'complete') return;
      throw new Error('local_media_vimeo_upload_link_missing');
    }
    const file = await stat(filePath);
    const head = await this.fetchWithTimeout(video.uploadLink, {
      method: 'HEAD',
      headers: { 'Tus-Resumable': '1.0.0' },
    });
    if (!head.ok) throw new Error(`local_media_vimeo_tus_head_${head.status}`);
    const offset = Number(head.headers.get('upload-offset') ?? 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > file.size) {
      throw new Error('local_media_vimeo_tus_offset_invalid');
    }
    if (offset === file.size) return;
    const response = await this.fetchWithTimeout(video.uploadLink, {
      method: 'PATCH',
      headers: {
        'Tus-Resumable': '1.0.0',
        'Upload-Offset': String(offset),
        'Content-Type': 'application/offset+octet-stream',
      },
      body: Readable.toWeb(createReadStream(filePath, { start: offset })),
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });
    if (!response.ok && response.status !== 204) {
      throw new Error(`local_media_vimeo_tus_patch_${response.status}`);
    }
  }

  async readVideo(videoId: string) {
    const video = await this.request<Record<string, unknown>>(
      `/videos/${encodeURIComponent(videoId)}?fields=uri,description,privacy.view,status,upload.status,upload.upload_link`,
      { method: 'GET' },
    );
    return vimeoVideo(video);
  }

  async addToProject(videoId: string) {
    if (!this.input.projectUri) return;
    const response = await this.requestRaw(
      `${this.input.projectUri}/videos/${encodeURIComponent(videoId)}`,
      { method: 'PUT' },
    );
    if (!response.ok && response.status !== 204) {
      throw new Error(`local_media_vimeo_project_${response.status}`);
    }
  }

  async ensureCaptions(input: { videoId: string; webvtt: string; trackName: string }) {
    const tracks = await this.request<{ data?: Record<string, unknown>[] }>(
      `/videos/${encodeURIComponent(input.videoId)}/texttracks?fields=data.uri,data.name,data.active`,
      { method: 'GET' },
    );
    const exact = (tracks.data ?? []).find((track) => stringValue(track.name) === input.trackName);
    if (exact) {
      const trackId = extractId(exact.uri, 'texttracks');
      if (!trackId) throw new Error('local_media_vimeo_text_track_id_missing');
      if (exact.active !== true) {
        const trackUri = stringValue(exact.uri);
        if (!trackUri) throw new Error('local_media_vimeo_text_track_uri_missing');
        await this.request(trackUri, { method: 'PATCH', body: { active: true } });
      }
      return trackId;
    }
    const created = await this.request<Record<string, unknown>>(
      `/videos/${encodeURIComponent(input.videoId)}/texttracks`,
      {
        method: 'POST',
        body: { type: 'captions', language: 'en', name: input.trackName },
      },
    );
    const uploadLink = stringValue(created.link);
    const trackUri = stringValue(created.uri);
    const trackId = extractId(trackUri, 'texttracks');
    if (!uploadLink || !trackUri || !trackId) {
      throw new Error('local_media_vimeo_text_track_upload_missing');
    }
    const upload = await this.fetchWithTimeout(uploadLink, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/vtt; charset=utf-8' },
      body: input.webvtt,
    });
    if (!upload.ok) throw new Error(`local_media_vimeo_text_track_put_${upload.status}`);
    await this.request(trackUri, { method: 'PATCH', body: { active: true } });
    return trackId;
  }

  private request<T>(apiPath: string, input: { method: 'GET' | 'POST' | 'PATCH'; body?: unknown }) {
    return this.requestRaw(apiPath, input).then(async (response) => {
      if (!response.ok) throw new Error(`local_media_vimeo_api_${response.status}`);
      const text = await response.text();
      return (text ? JSON.parse(text) : {}) as T;
    });
  }

  private requestRaw(
    apiPath: string,
    input: { method: 'GET' | 'POST' | 'PATCH' | 'PUT'; body?: unknown },
  ) {
    return this.fetchWithTimeout(`${this.input.apiBaseUrl ?? 'https://api.vimeo.com'}${apiPath}`, {
      method: input.method,
      headers: {
        Accept: VIMEO_ACCEPT,
        Authorization: `Bearer ${this.input.accessToken}`,
        ...(input.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
    });
  }

  private async fetchWithTimeout(url: string, init: RequestInit) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.input.timeoutMs);
    try {
      return await this.fetchImpl(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}

function vimeoVideo(value: Record<string, unknown>): VimeoLocalVideo {
  const upload = recordValue(value.upload);
  const privacy = recordValue(value.privacy);
  const videoId = extractId(value.uri, 'videos');
  if (!videoId) throw new Error('local_media_vimeo_video_id_missing');
  return {
    videoId,
    uploadLink: stringValue(upload.upload_link),
    uploadStatus: String(upload.status ?? 'unknown').toLowerCase(),
    privacy: String(privacy.view ?? ''),
    status: String(value.status ?? upload.status ?? 'unknown').toLowerCase(),
    description: String(value.description ?? ''),
  };
}

function normalizeVimeoAccount(value: string) {
  return value
    .replace(/^https?:\/\/api\.vimeo\.com/iu, '')
    .replace(/^\/users\//u, '')
    .trim();
}

function extractId(value: unknown, segment: 'videos' | 'texttracks') {
  const text = stringValue(value);
  if (!text) return null;
  const match = text.match(new RegExp(`/${segment}/([A-Za-z0-9._:-]+)`));
  return match?.[1] ?? null;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
