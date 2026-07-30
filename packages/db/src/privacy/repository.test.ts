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
      product: 'one_time_mishnayos',
      runtime_tier: 'isolated_staging',
      verification_environment_id: 'ci',
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
    expect(query.mock.calls[0]?.[1]).toEqual([
      '2026-07-28T20:01:00.000Z',
      2,
      'grant-1',
      'one_time_mishnayos',
      'isolated_staging',
      'ci',
      1,
    ]);
  });

  it('persists exact trusted scope on requests and inherits it on grants', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    const repository = createPostgresPrivacyRepository(pool(query));
    const request = requestRecord();
    await repository.createDataRightsRequest(request);
    await repository.createDownloadGrant({
      product: request.product,
      runtime_tier: request.runtime_tier,
      verification_environment_id: request.verification_environment_id,
      grant_id: 'grant-1',
      request_id: request.request_id,
      subject_binding_hash: 'a'.repeat(64),
      token_hash: 'b'.repeat(64),
      initiating_session_id: 'session-1',
      issued_at: '2026-07-28T20:00:00.000Z',
      expires_at: '2026-07-28T20:15:00.000Z',
      used_at: null,
      revoked_at: null,
      version: 1,
    });
    await repository.persistDataRightsTransition(1, {
      ...request,
      state: 'identity_verified',
      version: 2,
    });

    expect(query.mock.calls[0]?.[0]).toContain(
      '(request_id, product, runtime_tier, verification_environment_id,',
    );
    expect(query.mock.calls[0]?.[1]?.slice(0, 4)).toEqual([
      'request-1',
      'one_time_mishnayos',
      'isolated_staging',
      'ci',
    ]);
    expect(query.mock.calls[1]?.[0]).toContain(
      '(grant_id, request_id, product, runtime_tier, verification_environment_id,',
    );
    expect(query.mock.calls[1]?.[1]?.slice(0, 5)).toEqual([
      'grant-1',
      'request-1',
      'one_time_mishnayos',
      'isolated_staging',
      'ci',
    ]);
    expect(query.mock.calls[2]?.[0]).toContain(
      'AND product = $11\n              AND runtime_tier = $12',
    );
    expect(query.mock.calls[2]?.[1]?.slice(-5)).toEqual([
      'request-1',
      'one_time_mishnayos',
      'isolated_staging',
      'ci',
      1,
    ]);
  });
});

function requestRecord() {
  return {
    product: 'one_time_mishnayos' as const,
    runtime_tier: 'isolated_staging' as const,
    verification_environment_id: 'ci' as const,
    request_id: 'request-1',
    kind: 'export' as const,
    subject: { kind: 'household' as const, household_id: 'household-1' },
    requester_kind: 'account_owner' as const,
    requester_ref: 'account-1',
    requester_household_id: 'household-1',
    relationship_evidence: null,
    recent_password_session_id: 'session-1',
    state: 'received' as const,
    visible_status: 'requested' as const,
    requested_categories: ['profile'],
    excluded_categories: [],
    legal_exception_codes: [],
    provider_cascades: [],
    dependent_review_required: false,
    dependent_review_completed: false,
    due_at: '2026-08-27T20:00:00.000Z',
    completed_at: null,
    terminal_reason_code: null,
    version: 1,
    audit_refs: ['audit-1'],
  };
}

function pool(query: ReturnType<typeof vi.fn>) {
  const client: PrivacySqlClient = { query, release: vi.fn() };
  return { connect: vi.fn().mockResolvedValue(client) };
}
