import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMemoryPool, runMigrations, type DbPool } from '../../../packages/db/src/index.ts';
import type { DeliveryProviderOperation } from '../../../packages/contracts/src/delivery/types.ts';
import { PostgresDeliveryRepository } from '../../../apps/worker/src/delivery/repository.ts';
import { BASE_TIME, claimedDelivery } from '../../support/delivery/fixtures.ts';

let pool: DbPool;
let repository: PostgresDeliveryRepository;

const accountKey = 'one_time';
const productKey = 'one_time_mishnah_class';

beforeAll(async () => {
  pool = createMemoryPool();
  await runMigrations(pool);
  repository = new PostgresDeliveryRepository(pool);
});

afterAll(async () => {
  await pool.end();
});

describe('durable provider operation state', () => {
  it('resumes an accepted operation after lease expiry without another dispatch', async () => {
    const deliveryKey = 'delivery_durable_acceptance';
    await seedProviderDelivery(deliveryKey);
    const firstClaim = await leaseDelivery(deliveryKey, BASE_TIME, 1);
    const operation = providerOperation(deliveryKey, 'retry_same_key');

    await expect(
      repository.beginProviderOperation(firstClaim, operation, BASE_TIME),
    ).resolves.toEqual({ kind: 'dispatch' });
    await expect(
      repository.recordProviderAccepted(
        firstClaim,
        operation,
        {
          provider: 'resend',
          messageId: 'provider-reference-must-not-be-stored-raw',
          acceptedAt: new Date(BASE_TIME.getTime() + 10),
          sink: false,
        },
        new Date(BASE_TIME.getTime() + 10),
      ),
    ).resolves.toBe(true);

    const persisted = await pool.query(
      `SELECT provider_operation_state, provider_operation_idempotency_key,
              provider_acceptance_ref_hash
         FROM onetime.outbox_events
        WHERE delivery_key = $1`,
      [deliveryKey],
    );
    expect(persisted.rows[0]).toMatchObject({
      provider_operation_state: 'accepted',
      provider_operation_idempotency_key: deliveryKey,
    });
    expect(String(persisted.rows[0]?.provider_acceptance_ref_hash)).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(persisted.rows[0])).not.toContain(
      'provider-reference-must-not-be-stored-raw',
    );

    const leaseExpiry = new Date(BASE_TIME.getTime() + 1_000);
    const reclaimed = await leaseDelivery(deliveryKey, leaseExpiry, 2);
    const resume = await repository.beginProviderOperation(reclaimed, operation, leaseExpiry);
    expect(resume).toMatchObject({
      kind: 'accepted',
      receipt: { provider: 'resend', sink: false },
    });
    if (resume.kind !== 'accepted') throw new Error('expected accepted provider operation');
    await expect(
      repository.complete(reclaimed!, {
        kind: 'delivered',
        at: new Date(leaseExpiry.getTime() + 1),
        receipt: resume.receipt,
      }),
    ).resolves.toBe(true);
    await expect(statusOf(deliveryKey)).resolves.toBe('delivered');
  });

  it('persists acceptance-unknown quarantine and excludes it from later claims', async () => {
    const deliveryKey = 'delivery_acceptance_unknown';
    await seedProviderDelivery(deliveryKey);
    const claim = await leaseDelivery(deliveryKey, BASE_TIME, 1);
    const operation = providerOperation(deliveryKey, 'quarantine');
    const failure = {
      code: 'provider_timeout',
      category: 'transient' as const,
      acceptance: 'unknown' as const,
      provider: 'worker' as const,
    };

    await expect(repository.beginProviderOperation(claim, operation, BASE_TIME)).resolves.toEqual({
      kind: 'dispatch',
    });
    await expect(
      repository.recordProviderAcceptanceUnknown(
        claim,
        operation,
        failure,
        new Date(BASE_TIME.getTime() + 10),
      ),
    ).resolves.toBe(true);
    await expect(
      repository.complete(claim, {
        kind: 'acceptance_unknown',
        at: new Date(BASE_TIME.getTime() + 10),
        failure,
      }),
    ).resolves.toBe(true);
    await expect(statusOf(deliveryKey)).resolves.toBe('acceptance_unknown');

    await expect(claimableCount(deliveryKey, new Date(BASE_TIME.getTime() + 10_000))).resolves.toBe(
      0,
    );
  });
});

function providerOperation(
  idempotencyKey: string,
  acceptanceRecovery: DeliveryProviderOperation['acceptanceRecovery'],
): DeliveryProviderOperation {
  return {
    provider: 'resend',
    idempotencyKey,
    acceptanceRecovery,
  };
}

async function seedProviderDelivery(deliveryKey: string) {
  await pool.query(
    `INSERT INTO onetime.outbox_events
      (delivery_key, account_key, product_key, event_type, channel, transport_mode,
       payload, status, attempts, next_attempt_at, created_at)
     VALUES ($1,$2,$3,'internal_lead_alert','internal_email','provider',
             '{}'::jsonb,'pending',0,$4,$4)`,
    [deliveryKey, accountKey, productKey, BASE_TIME],
  );
}

async function leaseDelivery(deliveryKey: string, now: Date, attempts: number) {
  const leaseExpiresAt = new Date(now.getTime() + 1_000);
  const result = await pool.query(
    `UPDATE onetime.outbox_events
        SET status = 'processing',
            attempts = $2,
            next_attempt_at = $3
      WHERE delivery_key = $1
      RETURNING id`,
    [deliveryKey, attempts, leaseExpiresAt],
  );
  return claimedDelivery({
    id: String(result.rows[0]?.id),
    deliveryKey,
    accountKey,
    productKey,
    transportMode: 'provider',
    attempts,
    claimLeaseExpiresAt: leaseExpiresAt,
  });
}

async function statusOf(deliveryKey: string): Promise<string> {
  const result = await pool.query(
    'SELECT status FROM onetime.outbox_events WHERE delivery_key = $1',
    [deliveryKey],
  );
  return String(result.rows[0]?.status);
}

async function claimableCount(deliveryKey: string, now: Date): Promise<number> {
  const result = await pool.query(
    `SELECT count(*)::int AS count
       FROM onetime.outbox_events
      WHERE delivery_key = $1
        AND status IN ('pending', 'processing')
        AND next_attempt_at <= $2`,
    [deliveryKey, now],
  );
  return Number(result.rows[0]?.count ?? 0);
}
