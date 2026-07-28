import { describe, expect, it, vi } from 'vitest';
import type { PrivacySqlClient } from './repository.ts';
import { createPostgresPrivacyRepository } from './repository.ts';

describe('Postgres privacy repository', () => {
  it('uses exact-scope parameterized due-work reads', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repository = createPostgresPrivacyRepository(pool(query));
    await repository.claimDue({
      scope: {
        product: 'one_time_mishnayos',
        runtime_tier: 'isolated_staging',
        verification_environment_id: 'ci',
      },
      now: new Date('2026-07-28T20:00:00.000Z'),
      limit: 10,
    });
    expect(query.mock.calls[0]?.[0]).toContain("state = 'due'");
    expect(query.mock.calls[0]?.[1]).toEqual([
      'one_time_mishnayos',
      'isolated_staging',
      'ci',
      '2026-07-28T20:00:00.000Z',
      10,
    ]);
  });

  it('fences one-use download persistence by version, expiry, and unused state', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    const repository = createPostgresPrivacyRepository(pool(query));
    const persisted = await repository.consumeDownloadGrant(1, {
      grant_id: 'grant-1',
      request_id: 'request-1',
      subject_binding_hash: 'a'.repeat(64),
      token_hash: 'b'.repeat(64),
      initiating_session_id: 'session-1',
      issued_at: '2026-07-28T20:00:00.000Z',
      expires_at: '2026-07-28T20:15:00.000Z',
      used_at: '2026-07-28T20:01:00.000Z',
      revoked_at: null,
      version: 2,
    });
    expect(persisted).toBe(true);
    expect(query.mock.calls[0]?.[0]).toContain('used_at IS NULL');
    expect(query.mock.calls[0]?.[0]).toContain('expires_at > $1');
  });
});

function pool(query: ReturnType<typeof vi.fn>) {
  const client: PrivacySqlClient = { query, release: vi.fn() };
  return { connect: vi.fn().mockResolvedValue(client) };
}
