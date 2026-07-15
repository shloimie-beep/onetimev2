import { describe, expect, it } from 'vitest';
import { DELIVERY_EVENT_TYPES } from '../../../packages/contracts/src/delivery/types.ts';
import type {
  DeliverySqlClient,
  DeliverySqlPool,
} from '../../../apps/worker/src/delivery/repository.ts';
import {
  CLAIM_BATCH_SQL,
  PostgresDeliveryRepository,
} from '../../../apps/worker/src/delivery/repository.ts';
import { BASE_TIME, claimedDelivery } from '../../support/delivery/fixtures.ts';

type QueryCall = { text: string; values?: unknown[] };

class ScriptedClient implements DeliverySqlClient {
  readonly calls: QueryCall[] = [];
  released = false;

  constructor(
    private readonly claimRows: Record<string, unknown>[] = [],
    private readonly completionRowCount = 1,
  ) {}

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Row[]; rowCount: number | null }> {
    this.calls.push({ text, ...(values ? { values } : {}) });
    if (text.includes('WITH candidates AS')) {
      return { rows: this.claimRows as Row[], rowCount: this.claimRows.length };
    }
    if (text.includes('UPDATE onetime.outbox_events') && text.includes('RETURNING delivery_key')) {
      return {
        rows: (this.completionRowCount
          ? [{ delivery_key: 'delivery_fixture' }]
          : []) as unknown as Row[],
        rowCount: this.completionRowCount,
      };
    }
    return { rows: [], rowCount: 0 };
  }

  release(): void {
    this.released = true;
  }
}

class ScriptedPool implements DeliverySqlPool {
  constructor(readonly client: ScriptedClient) {}
  async connect(): Promise<DeliverySqlClient> {
    return this.client;
  }
}

function databaseClaimRow(): Record<string, unknown> {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    delivery_key: 'delivery_fixture',
    account_key: 'one_time',
    product_key: 'one_time_mishnah_class',
    contact_key: 'contact_fixture',
    signup_key: 'signup_fixture',
    event_type: DELIVERY_EVENT_TYPES.familySignupEmailAck,
    channel: 'email',
    transport_mode: 'sink',
    payload: {},
    attempts: 1,
    created_at: new Date('2026-07-14T10:00:00.000Z'),
    claim_lease_expires_at: new Date('2026-07-14T12:02:00.000Z'),
    display_name: 'Fixture Contact',
    family_school_classification: 'family',
    family_or_school: 'Fixture Family',
    location_text: 'Jerusalem',
    timezone: 'Asia/Jerusalem',
    email_normalized: 'recipient@example.test',
    phone_normalized: '+12025550123',
    reminder_preference: 'both',
    consent_recorded_at: new Date('2026-07-14T11:00:00.000Z'),
    suppression_state: 'active',
    lead_status: 'new',
    archived_at: null,
    signup_classification: 'family',
    signup_status: 'new',
    signup_metadata: {},
  };
}

describe('PostgreSQL delivery repository', () => {
  it('pins a scoped atomic SKIP LOCKED claim with sink and allowlist predicates', async () => {
    expect(CLAIM_BATCH_SQL).toContain('FOR UPDATE SKIP LOCKED');
    expect(CLAIM_BATCH_SQL).toContain('outbox.account_key = $1');
    expect(CLAIM_BATCH_SQL).toContain('outbox.product_key = $2');
    expect(CLAIM_BATCH_SQL).toContain('outbox.transport_mode = $3');
    expect(CLAIM_BATCH_SQL).toContain("outbox.event_type = 'family_signup_email_ack.v1'");
    expect(CLAIM_BATCH_SQL).toContain(
      "outbox.event_type = 'family_signup_whatsapp_confirmation.v1'",
    );
    expect(CLAIM_BATCH_SQL).not.toContain("outbox.event_type = 'school_signup_email_ack.v1'");
    expect(CLAIM_BATCH_SQL).not.toContain(
      "outbox.event_type = 'school_signup_whatsapp_receipt.v1'",
    );
    expect(CLAIM_BATCH_SQL).toContain("outbox.event_type = 'internal_lead_alert'");
    expect(CLAIM_BATCH_SQL).toContain('contact.account_key = claimed.account_key');
    expect(CLAIM_BATCH_SQL).toContain('signup.account_key = claimed.account_key');
    expect(CLAIM_BATCH_SQL).toContain("SET status = 'processing'");
    expect(CLAIM_BATCH_SQL).toContain('attempts = outbox.attempts + 1');

    const client = new ScriptedClient([databaseClaimRow()]);
    const repository = new PostgresDeliveryRepository(new ScriptedPool(client));
    const claims = await repository.claimBatch({
      accountKey: 'one_time',
      productKey: 'one_time_mishnah_class',
      transportMode: 'sink',
      now: BASE_TIME,
      limit: 25,
      leaseMs: 120_000,
    });
    expect(claims).toHaveLength(1);
    expect(claims[0]).toMatchObject({
      deliveryKey: 'delivery_fixture',
      attempts: 1,
      channel: 'email',
      contact: {
        emailNormalized: 'recipient@example.test',
        phoneNormalized: '+12025550123',
        leadStatus: 'new',
        archivedAt: null,
      },
      signup: {
        status: 'new',
      },
    });
    expect(client.calls[0]?.text).toBe('BEGIN');
    expect(client.calls[1]?.values).toEqual([
      'one_time',
      'one_time_mishnah_class',
      'sink',
      BASE_TIME,
      25,
      new Date('2026-07-14T12:02:00.000Z'),
    ]);
    expect(client.calls[2]?.text).toBe('COMMIT');
    expect(client.released).toBe(true);
  });

  it('completes only the current unexpired scoped lease and writes redacted audit metadata', async () => {
    const client = new ScriptedClient([], 1);
    const repository = new PostgresDeliveryRepository(new ScriptedPool(client));
    const claim = claimedDelivery();
    const completed = await repository.complete(claim, {
      kind: 'delivered',
      at: BASE_TIME,
      receipt: {
        provider: 'sink',
        messageId: 'provider-message-id',
        acceptedAt: BASE_TIME,
        sink: true,
      },
    });
    expect(completed).toBe(true);
    const update = client.calls.find((call) => call.text.includes('RETURNING delivery_key'));
    expect(update?.text).toContain('account_key = $7');
    expect(update?.text).toContain('product_key = $8');
    expect(update?.text).toContain("transport_mode = 'sink'");
    expect(update?.text).toContain("status = 'processing'");
    expect(update?.text).toContain('next_attempt_at = $5::timestamptz');
    expect(update?.text).toContain('next_attempt_at > $6::timestamptz');
    const audit = client.calls.find((call) =>
      call.text.includes('INSERT INTO onetime.audit_events'),
    );
    const metadata = String(audit?.values?.[6]);
    expect(metadata).toContain('provider_message_ref');
    expect(metadata).not.toContain('provider-message-id');
    expect(metadata).not.toContain('recipient@example.test');
    expect(metadata).not.toContain('+12025550123');
    expect(metadata).not.toContain('message_body');
  });

  it('does not write an audit event after losing the claim lease', async () => {
    const client = new ScriptedClient([], 0);
    const repository = new PostgresDeliveryRepository(new ScriptedPool(client));
    const completed = await repository.complete(claimedDelivery(), {
      kind: 'skipped',
      at: BASE_TIME,
      reason: 'contact_missing',
    });
    expect(completed).toBe(false);
    expect(
      client.calls.some((call) => call.text.includes('INSERT INTO onetime.audit_events')),
    ).toBe(false);
  });
});
