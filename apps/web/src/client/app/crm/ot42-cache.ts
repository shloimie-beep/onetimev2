type CacheEntry<T> = {
  key: string;
  value: T;
  size: number;
  createdAt: number;
  lastUsedAt: number;
};

export type ProtectedCacheOptions = {
  namespace: string;
  maxEntries?: number;
  maxBytes?: number;
  ttlMs?: number;
  offlineStaleMs?: number;
};

const defaultOptions = {
  maxEntries: 32,
  maxBytes: 2 * 1024 * 1024,
  ttlMs: 60_000,
  offlineStaleMs: 15 * 60_000,
};

export class ProtectedMemoryCache {
  readonly namespace: string;
  private readonly options: Required<Omit<ProtectedCacheOptions, 'namespace'>>;
  private readonly entries = new Map<string, CacheEntry<unknown>>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private totalBytes = 0;

  constructor(options: ProtectedCacheOptions) {
    this.namespace = options.namespace;
    this.options = { ...defaultOptions, ...options };
  }

  get<T>(key: string, now = Date.now()): T | null {
    const entry = this.entries.get(this.cacheKey(key));
    if (!entry) return null;
    if (now - entry.createdAt > this.options.ttlMs) return null;
    entry.lastUsedAt = now;
    return entry.value as T;
  }

  getOfflineStale<T>(key: string, now = Date.now()): T | null {
    const entry = this.entries.get(this.cacheKey(key));
    if (!entry) return null;
    if (now - entry.createdAt > this.options.offlineStaleMs) return null;
    entry.lastUsedAt = now;
    return entry.value as T;
  }

  set<T>(key: string, value: T, now = Date.now()) {
    const cacheKey = this.cacheKey(key);
    const size = approximateSize(value);
    const existing = this.entries.get(cacheKey);
    if (existing) this.totalBytes -= existing.size;
    this.entries.set(cacheKey, { key: cacheKey, value, size, createdAt: now, lastUsedAt: now });
    this.totalBytes += size;
    this.evict();
  }

  async dedupe<T>(key: string, load: () => Promise<T>): Promise<T> {
    const cacheKey = this.cacheKey(key);
    const existing = this.inFlight.get(cacheKey);
    if (existing) return existing as Promise<T>;
    const promise = load().finally(() => this.inFlight.delete(cacheKey));
    this.inFlight.set(cacheKey, promise);
    return promise;
  }

  invalidate(prefix: string) {
    const namespacedPrefix = this.cacheKey(prefix);
    for (const [key, entry] of this.entries) {
      if (key.startsWith(namespacedPrefix)) {
        this.entries.delete(key);
        this.totalBytes -= entry.size;
      }
    }
  }

  purgeProtected() {
    this.entries.clear();
    this.inFlight.clear();
    this.totalBytes = 0;
  }

  private cacheKey(key: string) {
    return `${this.namespace}:${key}`;
  }

  private evict() {
    while (this.entries.size > this.options.maxEntries || this.totalBytes > this.options.maxBytes) {
      const oldest = [...this.entries.values()].sort((a, b) => a.lastUsedAt - b.lastUsedAt)[0];
      if (!oldest) return;
      this.entries.delete(oldest.key);
      this.totalBytes -= oldest.size;
    }
  }
}

export function makeProtectedCacheNamespace(input: {
  subject: string;
  sessionFamily: string;
  capabilities: readonly string[];
}) {
  return [
    'ot42',
    hashForKey(input.subject),
    hashForKey(input.sessionFamily),
    hashForKey([...input.capabilities].sort().join('|')),
  ].join(':');
}

export function protectedRequestKey(input: unknown) {
  return hashForKey(stableStringify(input));
}

function approximateSize(value: unknown) {
  return new Blob([JSON.stringify(value)]).size;
}

function hashForKey(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
