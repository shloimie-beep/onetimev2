import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../packages/config/src/index.ts';
import {
  HIGHLEVEL_CONTRACT_VERSION,
  assertHighLevelPayloadSafe,
  highLevelInboundActionSchema,
  highLevelOutboundEventSchema,
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

  it('accepts only the canonical event-registration projection shape', () => {
    const event = highLevelOutboundEventSchema.parse({
      contract_version: HIGHLEVEL_CONTRACT_VERSION,
      event_name: 'event.registration.recorded',
      event_id: 'event-registration-0001',
      idempotency_key: 'event-registration-idempotency-0001',
      occurred_at: '2026-07-23T18:30:00.000Z',
      actor: { kind: 'system', reference: 'tisha_bav_registration' },
      scope: {
        account_key: 'one_time',
        product_key: 'one_time_mishnah_class',
        location_id: 'pBSnOK2nkdxp6gf9Rg3o',
      },
      adult_contact: { contact_key: 'contact-adult', adult_only: true },
      protected_reference: { kind: 'one_time_path', path: '/tisha-bav' },
      data: {
        event_code: 'tisha-bav-2026',
        registration_key: 'event-registration-key',
        permission_scope: 'event_service_email',
      },
    });
    expect(event.event_name).toBe('event.registration.recorded');
    expect(event).not.toHaveProperty('consent');
    expect(() =>
      highLevelOutboundEventSchema.parse({
        ...event,
        consent: {
          email: 'granted',
          whatsapp: 'not_granted',
          suppression_state: 'active',
          email_dnd: false,
          whatsapp_dnd: false,
          policy_version: 'tisha-bav-2026-event-email-v1',
          captured_at: '2026-07-23T18:30:00.000Z',
        },
      }),
    ).toThrow();
    expect(() =>
      highLevelOutboundEventSchema.parse({
        ...event,
        protected_reference: { kind: 'one_time_path', path: '/provider-url' },
      }),
    ).toThrow();
  });

  it('makes zero adapter and database calls while provider mode is off', async () => {
    const config = loadConfig({ NODE_ENV: 'test', HIGHLEVEL_EVENT_SYNC_MODE: 'disabled' });
    expect(config.highLevelEventSyncMode).toBe('disabled');
    expect(config.highLevelCanaryRunId).toBeUndefined();
    expect(config.highLevelCanaryDeliveryKeys).toEqual([]);
    expect(config.highLevelCanaryBudget).toBe(0);
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
    expect(HIGHLEVEL_CLAIM_SQL).toContain("transport_authorization_state = 'authorized'");
    expect(HIGHLEVEL_CLAIM_SQL).toContain('outbox.transport_mode = $8');
    expect(HIGHLEVEL_CLAIM_SQL).toContain('outbox.transport_authorization_run_id = $6');
    expect(HIGHLEVEL_CLAIM_SQL).toContain('transport_claim_token = $10');
    expect(HIGHLEVEL_CLAIM_SQL).toContain('outbox.transport_lease_expires_at <= $3');
  });

  it('rejects provider mode without an exact canary run, allowlist, and budget', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        HIGHLEVEL_EVENT_SYNC_MODE: 'provider',
        HIGHLEVEL_PRIVATE_INTEGRATIONS_TOKEN: 'test-provider-token',
      }),
    ).toThrow(/exact canary run ID/i);
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        HIGHLEVEL_EVENT_SYNC_MODE: 'provider',
        HIGHLEVEL_PRIVATE_INTEGRATIONS_TOKEN: 'test-provider-token',
        HIGHLEVEL_CANARY_RUN_ID: 'canary-run-0001',
        HIGHLEVEL_CANARY_DELIVERY_KEYS: 'delivery-a,delivery-b',
        HIGHLEVEL_CANARY_BUDGET: '1',
      }),
    ).toThrow(/sufficient positive budget/i);
  });

  it('parses an exact bounded provider canary contract', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      HIGHLEVEL_EVENT_SYNC_MODE: 'provider',
      HIGHLEVEL_PRIVATE_INTEGRATIONS_TOKEN: 'test-provider-token',
      HIGHLEVEL_CANARY_RUN_ID: ' canary-run-0001 ',
      HIGHLEVEL_CANARY_DELIVERY_KEYS: ' delivery-b,delivery-a,delivery-b ',
      HIGHLEVEL_CANARY_BUDGET: '2',
    });

    expect(config.highLevelEventSyncMode).toBe('provider');
    expect(config.highLevelCanaryRunId).toBe('canary-run-0001');
    expect(config.highLevelCanaryDeliveryKeys).toEqual(['delivery-b', 'delivery-a']);
    expect(config.highLevelCanaryBudget).toBe(2);
  });

  it.each([
    ['empty delivery-key allowlist', '', '1'],
    ['zero budget', 'delivery-a', '0'],
    ['fractional budget', 'delivery-a', '1.5'],
    ['budget above the hard limit', 'delivery-a', '21'],
    ['budget smaller than the allowlist', 'delivery-a,delivery-b', '1'],
  ])('rejects provider mode with %s', (_case, deliveryKeys, budget) => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        HIGHLEVEL_EVENT_SYNC_MODE: 'provider',
        HIGHLEVEL_PRIVATE_INTEGRATIONS_TOKEN: 'test-provider-token',
        HIGHLEVEL_CANARY_RUN_ID: 'canary-run-0001',
        HIGHLEVEL_CANARY_DELIVERY_KEYS: deliveryKeys,
        HIGHLEVEL_CANARY_BUDGET: budget,
      }),
    ).toThrow(/exact canary run ID|delivery-key allowlist|sufficient positive budget/i);
  });
});
