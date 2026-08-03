import type {
  PrivateVimeoCatalogVideo,
  VimeoCatalogPage,
  VimeoCatalogReadAdapter,
} from './vimeo-mishnayos-catalog.ts';

export const VIMEO_CATALOG_READ_AUTH_VARIABLE = 'VIMEO_ACCESS_TOKEN' as const;

export class VimeoCatalogReadError extends Error {
  constructor(
    public readonly code: 'VIMEO_READ_AUTH_UNAVAILABLE' | 'VIMEO_READ_REJECTED',
    message: string,
    public readonly retryable = false,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}

export function inspectVimeoCatalogReadAuth(env: NodeJS.ProcessEnv = process.env) {
  return {
    available: Boolean(env[VIMEO_CATALOG_READ_AUTH_VARIABLE]?.trim()),
    requiredVariableName: VIMEO_CATALOG_READ_AUTH_VARIABLE,
  } as const;
}

export function createRealVimeoCatalogReadAdapter(
  input: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: typeof fetch;
    apiBaseUrl?: string;
    maxRequestAttempts?: number;
    sleep?: (milliseconds: number) => Promise<void>;
  } = {},
): VimeoCatalogReadAdapter {
  const env = input.env ?? process.env;
  const token = env[VIMEO_CATALOG_READ_AUTH_VARIABLE]?.trim();
  if (!token) {
    throw new VimeoCatalogReadError(
      'VIMEO_READ_AUTH_UNAVAILABLE',
      'An already-authorized canonical Vimeo read token is required.',
    );
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const baseUrl = (input.apiBaseUrl ?? 'https://api.vimeo.com').replace(/\/$/, '');
  const sleep =
    input.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));

  async function requestJson(
    pathOrUrl: string,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    const url = pathOrUrl.startsWith('https://') ? pathOrUrl : `${baseUrl}${pathOrUrl}`;
    for (let attempt = 1; attempt <= (input.maxRequestAttempts ?? 5); attempt += 1) {
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: {
          accept: 'application/vnd.vimeo.*+json;version=3.4',
          authorization: `Bearer ${token}`,
        },
        ...(signal ? { signal } : {}),
      });
      if (response.ok) {
        const text = await response.text();
        return text ? (JSON.parse(text) as Record<string, unknown>) : {};
      }
      const retryable = response.status === 429 || response.status >= 500;
      const retryAfterMs = retryAfter(response.headers.get('retry-after'));
      if (retryable && attempt < (input.maxRequestAttempts ?? 5)) {
        await sleep(retryAfterMs ?? 250 * 2 ** (attempt - 1));
        continue;
      }
      throw new VimeoCatalogReadError(
        response.status === 401 || response.status === 403
          ? 'VIMEO_READ_AUTH_UNAVAILABLE'
          : 'VIMEO_READ_REJECTED',
        `Vimeo read request failed with safe status ${response.status}.`,
        retryable,
        retryAfterMs,
      );
    }
    throw new VimeoCatalogReadError('VIMEO_READ_REJECTED', 'Vimeo read request exhausted retries.');
  }

  return {
    async readPage(page, perPage, signal): Promise<VimeoCatalogPage> {
      const payload = await requestJson(
        `/me/videos?page=${page}&per_page=${perPage}&sort=date&direction=asc`,
        signal,
      );
      const data = asArray(payload.data);
      const pagination = asRecord(payload.paging);
      const total = Number(payload.total ?? asRecord(payload.metadata).total ?? 0);
      const items: PrivateVimeoCatalogVideo[] = [];
      for (const raw of data) {
        const record = asRecord(raw);
        const identity = canonicalVideoIdentity(record.uri);
        const showcases = await readShowcases(identity, signal);
        items.push(videoFromPayload(record, identity, showcases));
      }
      return {
        page,
        perPage,
        providerTotal: total,
        items,
        nextPage: pagination.next ? page + 1 : null,
      };
    },
    async readCaptionEvidence(video, signal) {
      const identity = canonicalVideoIdentity(video.providerIdentity);
      const payload = await requestJson(`${identity}/texttracks?per_page=100`, signal);
      let mishnahTermPresent = false;
      let gemaraTermPresent = false;
      for (const raw of asArray(payload.data)) {
        const track = asRecord(raw);
        const link =
          typeof track.link === 'string' && track.link.startsWith('https://') ? track.link : null;
        if (!link) continue;
        const response = await fetchImpl(link, {
          method: 'GET',
          headers: { authorization: `Bearer ${token}` },
          ...(signal ? { signal } : {}),
        });
        if (!response.ok) continue;
        const text = await response.text();
        mishnahTermPresent ||= /\b(?:mishnah|mishna|mishnayos|mishnayot)\b/i.test(text);
        gemaraTermPresent ||= /\b(?:gemara|talmud|daf|amud|sugya)\b/i.test(text);
        if (gemaraTermPresent || mishnahTermPresent) break;
      }
      return { mishnahTermPresent, gemaraTermPresent };
    },
  };

  async function readShowcases(identity: string, signal?: AbortSignal) {
    const payload = await requestJson(`${identity}/albums?per_page=100&fields=name`, signal);
    return asArray(payload.data)
      .map((entry) => String(asRecord(entry).name ?? '').trim())
      .filter(Boolean);
  }
}

function videoFromPayload(
  video: Record<string, unknown>,
  providerIdentity: string,
  showcases: readonly string[],
): PrivateVimeoCatalogVideo {
  const privacy = asRecord(video.privacy);
  const parentFolder = asRecord(video.parent_folder);
  const pictures = asRecord(video.pictures);
  const metadata = asRecord(video.metadata);
  const connections = asRecord(metadata.connections);
  const texttracks = asRecord(connections.texttracks);
  return {
    providerIdentity,
    title: String(video.name ?? ''),
    description: String(video.description ?? ''),
    tags: asArray(video.tags)
      .map((tag) => String(asRecord(tag).name ?? ''))
      .filter(Boolean),
    folders: parentFolder.name ? [String(parentFolder.name)] : [],
    showcases,
    durationSeconds: finiteNumber(video.duration),
    createdAt: nullableString(video.created_time),
    modifiedAt: nullableString(video.modified_time),
    language: nullableString(video.language),
    privacyView: nullableString(privacy.view),
    privacyEmbed: nullableString(privacy.embed),
    thumbnailAvailable: asArray(pictures.sizes).length > 0,
    captionsAvailable: Number(texttracks.total ?? 0) > 0,
  };
}

function canonicalVideoIdentity(value: unknown) {
  const match = /^\/videos\/([A-Za-z0-9_-]+)$/.exec(String(value ?? ''));
  if (!match)
    throw new VimeoCatalogReadError(
      'VIMEO_READ_REJECTED',
      'Vimeo returned an invalid video identity.',
    );
  return `/videos/${match[1]}`;
}

function retryAfter(value: string | null) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}
