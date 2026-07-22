import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../packages/config/src/index.ts';
import {
  HIGHLEVEL_CONTRACT_VERSION,
  assertHighLevelPayloadSafe,
  highLevelInboundActionSchema,
} from '../../../packages/contracts/src/highlevel/index.ts';
import type { DbPool } from '../../../packages/db/src/index.ts';
import {
  DeterministicFakeHighLevelAdapter,
  HIGHLEVEL_CLAIM_SQL,
  runHighLevelProjectionBatch,
} from '../../../packages/domain/src/highlevel/dispatcher.ts';

describe('HighLevel application contracts', () => {
  it('rejects Student, credential, token, message, and raw provider URL fields', () => {
    for (const value of [
      { student_id: 'student-1' },
      { password: 'never' },
      { token: 'never' },
      { message_body: 'never' },
      { safe: 'https://zoom.us/j/123' },
      { safe: 'https://vimeo.com/123' },
    ]) {
      expect(() => assertHighLevelPayloadSafe(value)).toThrow(/HIGHLEVEL_FORBIDDEN/);
    }
  });

  it('requires an exact versioned, adult-only, scoped bot action', () => {
    expect(() =>
      highLevelInboundActionSchema.parse({
        contract_version: HIGHLEVEL_CONTRACT_VERSION,
        action_name: 'bot.member_login',
        request_id: 'request-0001',
        idempotency_key: 'idempotency-0001',
        requested_at: '2026-07-22T10:00:00.000Z',
        actor: { kind: 'highlevel_bot', bot_key: 'OT-A1' },
        scope: {
          account_key: 'one_time',
          product_key: 'one_time_mishnah_class',
          location_id: 'pBSnOK2nkdxp6gf9Rg3o',
        },
        adult_contact: { contact_key: 'contact-adult', adult_only: false },
      }),
    ).toThrow();
  });

  it('makes zero adapter and database calls while provider mode is off', async () => {
    const config = loadConfig({ NODE_ENV: 'test', HIGHLEVEL_EVENT_SYNC_MODE: 'disabled' });
    const adapter = new DeterministicFakeHighLevelAdapter();
    const forbiddenPool = new Proxy(
      {},
      {
        get() {
          throw new Error('database must not be touched');
        },
      },
    ) as DbPool;
    await expect(
      runHighLevelProjectionBatch({ pool: forbiddenPool, config, adapter }),
    ).resolves.toEqual({
      enabled: false,
      code: 'HIGHLEVEL_PROVIDER_OFF',
      adapterCalls: 0,
    });
    expect(adapter.calls).toHaveLength(0);
  });

  it('pins the real PostgreSQL claim to scoped HighLevel outbox rows only', () => {
    expect(HIGHLEVEL_CLAIM_SQL).toContain("outbox.channel = 'highlevel'");
    expect(HIGHLEVEL_CLAIM_SQL).toContain('outbox.account_key = $1');
    expect(HIGHLEVEL_CLAIM_SQL).toContain('outbox.product_key = $2');
    expect(HIGHLEVEL_CLAIM_SQL).toContain('FOR UPDATE OF outbox SKIP LOCKED');
    expect(HIGHLEVEL_CLAIM_SQL).toContain('WHERE outbox.id = candidates.id');
  });
});
