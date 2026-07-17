import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import {
  InMemoryProviderWebhookLedger,
  ProviderWebhookConformanceError,
  signResendSvixFixture,
  verifyAndNormalizeResendWebhookEvent,
} from '../../../apps/worker/src/delivery/provider-webhooks.ts';

const now = new Date('2026-07-17T04:00:00.000Z');
const timestamp = Math.floor(now.getTime() / 1000);
const secret = `whsec_${Buffer.from('ops05-resend-fixture-secret').toString('base64')}`;
const wrongSecret = `whsec_${Buffer.from('ops05-wrong-resend-secret').toString('base64')}`;

describe('OPS-05 Resend Svix webhook conformance', () => {
  it('accepts a valid raw-body Svix fixture and keeps provider refs redacted', () => {
    const ledger = new InMemoryProviderWebhookLedger();
    const rawBody = resendBody();
    const result = receive(rawBody, {
      ledger,
      headers: signResendSvixFixture({
        rawBody,
        webhookSecret: secret,
        id: 'msg_ops05_valid',
        timestamp,
      }),
    });

    expect(result.disposition).toBe('accepted');
    expect(result.record.canonical_state).toBe('delivered');
    expect(result.record.provider_event_ref_hash).not.toContain('resend_evt_ops05');
    expect(JSON.stringify(result.record)).not.toContain('resend_msg_ops05');
  });

  it('rejects altered-body, wrong-secret, stale, oversized, parsed-body, and wrong-type fixtures', () => {
    const rawBody = resendBody();
    const headers = signResendSvixFixture({
      rawBody,
      webhookSecret: secret,
      id: 'msg_ops05_reject',
      timestamp,
    });

    expectReject('svix_signature_rejected', () =>
      receive(resendBody({ type: 'email.bounced' }), { headers }),
    );
    expectReject('svix_signature_rejected', () =>
      receive(rawBody, {
        headers: signResendSvixFixture({
          rawBody,
          webhookSecret: wrongSecret,
          id: 'msg_ops05_wrong_secret',
          timestamp,
        }),
      }),
    );
    expectReject('svix_timestamp_out_of_range', () =>
      receive(rawBody, {
        headers: signResendSvixFixture({
          rawBody,
          webhookSecret: secret,
          id: 'msg_ops05_stale',
          timestamp: timestamp - 600,
        }),
      }),
    );
    expectReject('oversized', () =>
      receive(Buffer.alloc(129 * 1024, 0x20), {
        headers,
      }),
    );
    expectReject('parsed_body_misuse', () =>
      verifyAndNormalizeResendWebhookEvent({
        accountKey: 'one_time',
        productKey: 'one_time_mishnah_class',
        rawBody: { parsed: true },
        contentType: 'application/json',
        headers,
        webhookSecret: secret,
        now,
      }),
    );
    expectReject('wrong_content_type', () =>
      receive(rawBody, {
        contentType: 'text/plain',
        headers,
      }),
    );
  });

  it('classifies replayed, duplicated, digest-mismatched, and out-of-order events', () => {
    const ledger = new InMemoryProviderWebhookLedger();
    const first = resendBody();
    const firstHeaders = signResendSvixFixture({
      rawBody: first,
      webhookSecret: secret,
      id: 'msg_ops05_first',
      timestamp,
    });
    expect(receive(first, { ledger, headers: firstHeaders }).disposition).toBe('accepted');
    expect(receive(first, { ledger, headers: firstHeaders }).disposition).toBe('replayed');

    const duplicateHeaders = signResendSvixFixture({
      rawBody: first,
      webhookSecret: secret,
      id: 'msg_ops05_duplicate_svix',
      timestamp,
    });
    expect(receive(first, { ledger, headers: duplicateHeaders }).disposition).toBe('duplicated');

    const changedDigest = resendBody({ type: 'email.complained' });
    expect(
      receive(changedDigest, {
        ledger,
        headers: signResendSvixFixture({
          rawBody: changedDigest,
          webhookSecret: secret,
          id: 'msg_ops05_changed_digest',
          timestamp,
        }),
      }).disposition,
    ).toBe('digest_mismatch');

    const later = resendBody({
      id: 'resend_evt_ops05_later',
      type: 'email.delivered',
      created_at: '2026-07-17T04:05:00.000Z',
    });
    expect(
      receive(later, {
        ledger,
        headers: signResendSvixFixture({
          rawBody: later,
          webhookSecret: secret,
          id: 'msg_ops05_later',
          timestamp,
        }),
      }).disposition,
    ).toBe('accepted');
    const older = resendBody({
      id: 'resend_evt_ops05_older',
      type: 'email.sent',
      created_at: '2026-07-17T04:04:00.000Z',
    });
    expect(
      receive(older, {
        ledger,
        headers: signResendSvixFixture({
          rawBody: older,
          webhookSecret: secret,
          id: 'msg_ops05_older',
          timestamp,
        }),
      }).disposition,
    ).toBe('out_of_order');
  });
});

function receive(
  rawBody: Buffer,
  options: {
    headers: ReturnType<typeof signResendSvixFixture>;
    ledger?: InMemoryProviderWebhookLedger | undefined;
    contentType?: string | undefined;
  },
) {
  return verifyAndNormalizeResendWebhookEvent({
    accountKey: 'one_time',
    productKey: 'one_time_mishnah_class',
    rawBody,
    contentType: options.contentType ?? 'application/json; charset=utf-8',
    headers: options.headers,
    webhookSecret: secret,
    ledger: options.ledger,
    now,
  });
}

function resendBody(
  overrides: Partial<Record<'id' | 'type' | 'message_id' | 'created_at', string>> = {},
) {
  return Buffer.from(
    JSON.stringify({
      id: 'resend_evt_ops05',
      type: 'email.delivered',
      message_id: 'resend_msg_ops05',
      created_at: '2026-07-17T04:00:00.000Z',
      ...overrides,
    }),
  );
}

function expectReject(code: string, fn: () => unknown) {
  expect(fn).toThrow(ProviderWebhookConformanceError);
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ProviderWebhookConformanceError);
    expect((error as ProviderWebhookConformanceError).code).toBe(code);
    return;
  }
  throw new Error(`Expected ${code}`);
}
