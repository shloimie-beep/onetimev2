import { ProtectedMemoryCache, protectedRequestKey } from './ot42-cache.js';

export type ContactTab = 'overview' | 'notes' | 'relationships' | 'tasks' | 'identity';

export type LazyTabRequest = {
  contactId: string;
  tab: Exclude<ContactTab, 'overview'>;
  path: string;
};

export class LazyContactTabLoader {
  constructor(private readonly cache: ProtectedMemoryCache) {}

  async load<T>(request: LazyTabRequest): Promise<{ value: T; fromCache: boolean }> {
    const key = this.keyFor(request);
    const cached = this.cache.get<T>(key);
    if (cached) return { value: cached, fromCache: true };
    const value = await this.cache.dedupe(key, async () => {
      const response = await fetch(request.path, {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          accept: 'application/json',
          'cache-control': 'no-store',
          pragma: 'no-cache',
        },
      });
      const json = (await response.json().catch(() => ({}))) as T;
      if (response.status === 401) {
        this.cache.purgeProtected();
        throw new Error('Protected CRM session ended.');
      }
      if (!response.ok) throw new Error('CRM tab could not load.');
      return json;
    });
    this.cache.set(key, value);
    return { value, fromCache: false };
  }

  invalidateContact(contactId: string) {
    this.cache.invalidate(`contact-tab:${contactId}:`);
  }

  private keyFor(request: LazyTabRequest) {
    return `contact-tab:${request.contactId}:${request.tab}:${protectedRequestKey(request.path)}`;
  }
}
