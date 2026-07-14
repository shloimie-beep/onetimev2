import { describe, expect, it } from 'vitest';
import {
  ProtectedMemoryCache,
  makeProtectedCacheNamespace,
  protectedRequestKey,
} from '../../apps/web/src/client/app/crm/ot42-cache.ts';

describe('OT-42 protected memory cache', () => {
  it('keeps protected data in memory with namespace and bounded eviction', () => {
    const cache = new ProtectedMemoryCache({
      namespace: makeProtectedCacheNamespace({
        subject: 'user_1',
        sessionFamily: 'session_family_1',
        capabilities: ['crm.contacts.read'],
      }),
      maxEntries: 2,
    });
    cache.set('a', { value: 1 }, 100);
    cache.set('b', { value: 2 }, 101);
    cache.set('c', { value: 3 }, 102);
    expect(cache.get('a', 103)).toBeNull();
    expect(cache.get<{ value: number }>('b', 103)?.value).toBe(2);
    cache.purgeProtected();
    expect(cache.get('b', 104)).toBeNull();
  });

  it('deduplicates in-flight reads and produces non-PII request keys', async () => {
    const cache = new ProtectedMemoryCache({ namespace: 'test' });
    let calls = 0;
    const [first, second] = await Promise.all([
      cache.dedupe('list', async () => {
        calls += 1;
        return { ok: true };
      }),
      cache.dedupe('list', async () => {
        calls += 1;
        return { ok: true };
      }),
    ]);
    expect(first).toEqual(second);
    expect(calls).toBe(1);
    expect(protectedRequestKey({ search: 'private@example.test' })).not.toContain('private');
  });
});
