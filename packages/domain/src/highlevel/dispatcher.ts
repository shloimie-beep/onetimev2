import type { AppConfig } from '../../../config/src/index.ts';
import {
  assertHighLevelPayloadSafe,
  highLevelOutboundEventSchema,
  type HighLevelBlockerCode,
  type HighLevelEventName,
  type HighLevelOutboundEvent,
} from '../../../contracts/src/highlevel/index.ts';
import type { DbPool } from '../../../db/src/index.ts';
import { inTransaction } from '../../../db/src/index.ts';
import { stableKey } from '../lead/normalize.ts';

export type HighLevelProjection = {
  idempotencyKey: string;
  eventName: HighLevelEventName;
  locationId: string;
  adult: { contactKey: string; email: string; displayName: string; phone: string | null };
  tagsToAdd: string[];
  customFields: Array<{ id: string; value: string }>;
};

export interface HighLevelAdapter {
  project(input: HighLevelProjection): Promise<{ providerContactId: string }>;
}

export class DeterministicFakeHighLevelAdapter implements HighLevelAdapter {
  readonly calls: Array<{
    idempotencyKey: string;
    eventName: HighLevelEventName;
    contactKey: string;
    tagsToAdd: string[];
    customFieldIds: string[];
  }> = [];
  private readonly receipts = new Map<string, string>();

  async project(input: HighLevelProjection) {
    const existing = this.receipts.get(input.idempotencyKey);
    if (existing) return { providerContactId: existing };
    const providerContactId = stableKey('fake_ghl_contact', [input.adult.contactKey]);
    this.receipts.set(input.idempotencyKey, providerContactId);
    this.calls.push({
      idempotencyKey: input.idempotencyKey,
      eventName: input.eventName,
      contactKey: input.adult.contactKey,
      tagsToAdd: [...input.tagsToAdd],
      customFieldIds: input.customFields.map((field) => field.id),
    });
    return { providerContactId };
  }
}

export type HighLevelDispatchResult =
  | { enabled: true; claimed: number; delivered: number; retried: number; adapterCalls: number }
  | { enabled: false; code: HighLevelBlockerCode; adapterCalls: 0 };

export async function runHighLevelProjectionBatch(input: {
  pool: DbPool;
  config: AppConfig;
  adapter?: HighLevelAdapter;
  limit?: number;
  now?: Date;
}): Promise<HighLevelDispatchResult> {
  if (input.config.highLevelEventSyncMode === 'disabled') {
    return { enabled: false, code: 'HIGHLEVEL_PROVIDER_OFF', adapterCalls: 0 };
  }
  if (!input.adapter) {
    return { enabled: false, code: 'HIGHLEVEL_PROVIDER_UNCONFIGURED', adapterCalls: 0 };
  }
  const now = input.now ?? new Date();
  const rows = await claim(input.pool, input.config, input.limit ?? 20, now);
  let delivered = 0;
  let retried = 0;
  let adapterCalls = 0;
  for (const row of rows) {
    try {
      const event = highLevelOutboundEventSchema.parse(row.payload);
      assertHighLevelPayloadSafe(event);
      adapterCalls += 1;
      const receipt = await input.adapter.project(projection(event, row));
      await markDelivered(input.pool, input.config, row.delivery_key, event, receipt, now);
      delivered += 1;
    } catch {
      await markRetry(
        input.pool,
        input.config,
        row.delivery_key,
        row.contact_key,
        row.attempts,
        now,
      );
      retried += 1;
    }
  }
  return { enabled: true, claimed: rows.length, delivered, retried, adapterCalls };
}

type ClaimedRow = {
  delivery_key: string;
  attempts: number;
  payload: unknown;
  contact_key: string;
  email_normalized: string;
  phone_normalized: string | null;
  display_name: string;
};

const memoryClaimTails = new WeakMap<object, Promise<void>>();

export const HIGHLEVEL_CLAIM_SQL = `
WITH candidates AS (
  SELECT outbox.id
    FROM onetime.outbox_events AS outbox
   WHERE outbox.account_key = $1
     AND outbox.product_key = $2
     AND outbox.channel = 'highlevel'
     AND (
       (outbox.status IN ('pending', 'retry') AND outbox.next_attempt_at <= $3)
       OR (outbox.status = 'processing' AND outbox.next_attempt_at <= $3)
     )
   ORDER BY outbox.next_attempt_at, outbox.created_at, outbox.id
   LIMIT $4
   FOR UPDATE OF outbox SKIP LOCKED
), claimed AS (
  UPDATE onetime.outbox_events AS outbox
     SET status = 'processing',
         attempts = outbox.attempts + 1,
         next_attempt_at = $5
    FROM candidates
   WHERE outbox.id = candidates.id
     AND outbox.account_key = $1
     AND outbox.product_key = $2
     AND outbox.channel = 'highlevel'
  RETURNING outbox.*
)
SELECT claimed.delivery_key, claimed.attempts, claimed.payload, claimed.contact_key,
       contacts.email_normalized, contacts.phone_normalized, contacts.display_name
  FROM claimed
  JOIN onetime.contacts AS contacts
    ON contacts.account_key = claimed.account_key
   AND contacts.product_key = claimed.product_key
   AND contacts.contact_key = claimed.contact_key
 ORDER BY claimed.created_at, claimed.delivery_key
`;

async function claim(pool: DbPool, config: AppConfig, limit: number, now: Date) {
  const leaseExpiresAt = new Date(now.getTime() + 60_000);
  if (isMemoryPool(pool)) {
    return claimMemory(pool, config, limit, now, leaseExpiresAt);
  }
  return inTransaction(pool, async (client) => {
    const result = await client.query(HIGHLEVEL_CLAIM_SQL, [
      config.accountKey,
      config.productKey,
      now,
      limit,
      leaseExpiresAt,
    ]);
    return result.rows.map((row) => ({ ...row, attempts: Number(row.attempts) })) as ClaimedRow[];
  });
}

async function claimMemory(
  pool: DbPool,
  config: AppConfig,
  limit: number,
  now: Date,
  leaseExpiresAt: Date,
) {
  return withMemoryClaimLock(pool, () =>
    inTransaction(pool, async (client) => {
      const result = await client.query(
        `SELECT outbox.delivery_key, outbox.attempts, outbox.payload, outbox.contact_key,
              contacts.email_normalized, contacts.phone_normalized, contacts.display_name
         FROM onetime.outbox_events AS outbox
         JOIN onetime.contacts AS contacts
           ON contacts.account_key = outbox.account_key
          AND contacts.product_key = outbox.product_key
          AND contacts.contact_key = outbox.contact_key
        WHERE outbox.account_key = $1
          AND outbox.product_key = $2
          AND outbox.channel = 'highlevel'
          AND (
            (outbox.status IN ('pending', 'retry') AND outbox.next_attempt_at <= $3)
            OR (outbox.status = 'processing' AND outbox.next_attempt_at <= $3)
          )
        ORDER BY outbox.next_attempt_at, outbox.created_at, outbox.delivery_key
        LIMIT $4`,
        [config.accountKey, config.productKey, now, limit],
      );
      for (const row of result.rows) {
        await client.query(
          `UPDATE onetime.outbox_events
            SET status = 'processing', attempts = attempts + 1, next_attempt_at = $4
          WHERE account_key = $1 AND product_key = $2 AND delivery_key = $3`,
          [config.accountKey, config.productKey, row.delivery_key, leaseExpiresAt],
        );
      }
      return result.rows.map((row) => ({
        ...row,
        attempts: Number(row.attempts) + 1,
      })) as ClaimedRow[];
    }),
  );
}

async function withMemoryClaimLock<T>(pool: DbPool, run: () => Promise<T>) {
  const key = pool as object;
  const previous = memoryClaimTails.get(key) ?? Promise.resolve();
  let release: () => void = () => {};
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  memoryClaimTails.set(
    key,
    previous.then(() => current),
  );
  await previous;
  try {
    return await run();
  } finally {
    release();
  }
}

function isMemoryPool(pool: DbPool) {
  return Boolean((pool as DbPool & { __memory?: boolean }).__memory);
}

function projection(event: HighLevelOutboundEvent, row: ClaimedRow): HighLevelProjection {
  const tagsToAdd: Record<HighLevelEventName, string> = {
    'adult.signup.submitted': 'OT | Lead',
    'parent.portal.invitation_requested': 'OT | Portal Invited',
    'parent.portal.activated': 'OT | Portal Active',
    'class.reminder.requested': 'OT | Class Reminder Pending',
    'recording.available': 'OT | Recording Available',
  };
  const customFields: Array<{ id: string; value: string }> = [
    { id: 'TRZGYm5rfFdjpYHM0HLL', value: event.adult_contact.contact_key },
    { id: 'olSxPkya7mkkB61vSXHx', value: event.consent.email },
    { id: 'XhBuFbkwtbpD9gyVNDdG', value: event.consent.whatsapp },
    { id: '5ID7x61OAXaLHf2VrzVb', value: event.consent.policy_version },
    { id: 'dzvudcSnnaVzuw4Y5QzL', value: event.consent.captured_at },
    { id: 'rdWsApvquRfHwkzvp5mS', value: event.consent.suppression_state },
  ];
  if (event.data.classification) {
    customFields.push({ id: 'XoW0UWbGFkwUplKydjZI', value: event.data.classification });
  }
  if (event.data.portal_status) {
    customFields.push({ id: 'hxancKIMgrEWUeVSSUYF', value: event.data.portal_status });
  }
  if (event.data.starts_at) {
    customFields.push({ id: 'yH9qCXXoeIMKIltiiBZM', value: event.data.starts_at });
  }
  if (event.data.timezone) {
    customFields.push({ id: 'rUGmHIqjE5XVZxOmy79V', value: event.data.timezone });
  }
  return {
    idempotencyKey: event.idempotency_key,
    eventName: event.event_name,
    locationId: event.scope.location_id,
    adult: {
      contactKey: row.contact_key,
      email: row.email_normalized,
      displayName: row.display_name,
      phone: row.phone_normalized,
    },
    tagsToAdd: [tagsToAdd[event.event_name]],
    customFields,
  };
}

async function markDelivered(
  pool: DbPool,
  config: AppConfig,
  deliveryKey: string,
  event: HighLevelOutboundEvent,
  receipt: { providerContactId: string },
  now: Date,
) {
  await inTransaction(pool, async (client) => {
    await client.query(
      `UPDATE onetime.outbox_events
          SET status = 'delivered', delivered_at = $4
        WHERE account_key = $1 AND product_key = $2 AND delivery_key = $3`,
      [config.accountKey, config.productKey, deliveryKey, now],
    );
    await client.query(
      `INSERT INTO onetime.audit_events
         (event_key, account_key, product_key, contact_key, event_type, metadata, created_at)
       VALUES ($1, $2, $3, $4, 'highlevel_projection_delivered', $5::jsonb, $6)
       ON CONFLICT (event_key) DO NOTHING`,
      [
        stableKey('audit_highlevel_delivered', [deliveryKey]),
        config.accountKey,
        config.productKey,
        event.adult_contact.contact_key,
        JSON.stringify({
          event_name: event.event_name,
          provider_reference_hash: stableKey('provider_ref', [receipt.providerContactId]),
          private_destination_recorded: false,
        }),
        now,
      ],
    );
  });
}

async function markRetry(
  pool: DbPool,
  config: AppConfig,
  deliveryKey: string,
  contactKey: string,
  attempts: number,
  now: Date,
) {
  const terminal = attempts >= 8;
  const nextAttemptAt = new Date(now.getTime() + Math.min(60_000, 1000 * 2 ** attempts));
  await pool.query(
    `UPDATE onetime.outbox_events
        SET status = $4, next_attempt_at = $5
      WHERE account_key = $1 AND product_key = $2 AND delivery_key = $3`,
    [
      config.accountKey,
      config.productKey,
      deliveryKey,
      terminal ? 'dead_letter' : 'retry',
      nextAttemptAt,
    ],
  );
  await pool.query(
    `INSERT INTO onetime.audit_events
       (event_key, account_key, product_key, contact_key, event_type, metadata, created_at)
     VALUES ($1, $2, $3, $4, 'highlevel_projection_retry', $5::jsonb, $6)
     ON CONFLICT (event_key) DO NOTHING`,
    [
      stableKey('audit_highlevel_retry', [deliveryKey, String(attempts)]),
      config.accountKey,
      config.productKey,
      contactKey,
      JSON.stringify({ attempts, terminal, failure_code: 'highlevel_projection_failed' }),
      now,
    ],
  );
}
