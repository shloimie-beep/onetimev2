import { createHash, randomUUID } from 'node:crypto';
import type { AppConfig } from '../../../config/src/index.ts';
import {
  assertHighLevelPayloadSafe,
  highLevelOutboundEventSchema,
  type HighLevelBlockerCode,
  type HighLevelEventName,
  type HighLevelOutboundEvent,
} from '../../../contracts/src/highlevel/index.ts';
import type { DbPool, Queryable } from '../../../db/src/index.ts';
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

export type HighLevelProviderOperationContext = {
  operationKey: string;
  idempotencyKey: string;
};

export interface HighLevelAdapter {
  upsertContact(
    input: HighLevelProjection,
    context: HighLevelProviderOperationContext,
  ): Promise<{ providerContactId: string }>;
  addTags(
    input: { locationId: string; providerContactId: string; tagsToAdd: string[] },
    context: HighLevelProviderOperationContext,
  ): Promise<void>;
}

export class DeterministicFakeHighLevelAdapter implements HighLevelAdapter {
  readonly calls: Array<{
    idempotencyKey: string;
    eventName: HighLevelEventName;
    contactKey: string;
    tagsToAdd: string[];
    customFieldIds: string[];
  }> = [];
  readonly upsertCalls: string[] = [];
  private readonly receipts = new Map<string, string>();
  private readonly tagged = new Set<string>();
  private readonly projections = new Map<string, HighLevelProjection>();

  async upsertContact(input: HighLevelProjection, context: HighLevelProviderOperationContext) {
    const existing = this.receipts.get(context.operationKey);
    if (existing) return { providerContactId: existing };
    const providerContactId = stableKey('fake_ghl_contact', [input.adult.contactKey]);
    this.receipts.set(context.operationKey, providerContactId);
    this.projections.set(providerContactId, input);
    this.upsertCalls.push(context.operationKey);
    return { providerContactId };
  }

  async addTags(input: { providerContactId: string }, context: HighLevelProviderOperationContext) {
    if (this.tagged.has(context.operationKey)) return;
    const projection = this.projections.get(input.providerContactId);
    if (!projection) throw new Error('HIGHLEVEL_FAKE_CONTACT_MISSING');
    this.tagged.add(context.operationKey);
    this.calls.push({
      idempotencyKey: projection.idempotencyKey,
      eventName: projection.eventName,
      contactKey: projection.adult.contactKey,
      tagsToAdd: [...projection.tagsToAdd],
      customFieldIds: projection.customFields.map((field) => field.id),
    });
  }
}

export type HighLevelDispatchResult =
  | {
      enabled: true;
      claimed: number;
      delivered: number;
      retried: number;
      quarantined: number;
      adapterCalls: number;
    }
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
  const canary = canaryConfig(input.config);
  if (!canary) {
    return { enabled: false, code: 'HIGHLEVEL_TRANSPORT_UNAUTHORIZED', adapterCalls: 0 };
  }
  const now = input.now ?? new Date();
  const authorized = await authorizeCanaryRows(input.pool, input.config, canary, now);
  if (!authorized) {
    return { enabled: false, code: 'HIGHLEVEL_TRANSPORT_UNAUTHORIZED', adapterCalls: 0 };
  }
  const rows = await claim(input.pool, input.config, canary, input.limit ?? 20, now);
  let delivered = 0;
  let retried = 0;
  let quarantined = 0;
  let adapterCalls = 0;
  for (const row of rows) {
    let event: HighLevelOutboundEvent | null = null;
    try {
      event = highLevelOutboundEventSchema.parse(row.payload);
      assertHighLevelPayloadSafe(event);
      adapterCalls += 1;
      const value = projection(event, row);
      const upsertNow = input.now ?? new Date();
      const providerContactId = await runUpsertOperation(
        input.pool,
        input.config,
        row,
        value,
        input.adapter,
        upsertNow,
      );
      const addTagsNow = input.now ?? new Date();
      await runAddTagsOperation(
        input.pool,
        input.config,
        row,
        value,
        providerContactId,
        input.adapter,
        addTagsNow,
      );
      const completionNow = input.now ?? new Date();
      if (
        await markDelivered(input.pool, input.config, row, event, providerContactId, completionNow)
      ) {
        delivered += 1;
      } else {
        quarantined += 1;
      }
    } catch (error) {
      const failureNow = input.now ?? new Date();
      if (error instanceof OperationUncertainError || error instanceof FenceLostError) {
        await markUncertain(input.pool, input.config, row, event, failureNow);
        quarantined += 1;
      } else {
        const marked = await markRetry(input.pool, input.config, row, failureNow);
        if (marked) retried += 1;
        else quarantined += 1;
      }
    }
  }
  return {
    enabled: true,
    claimed: rows.length,
    delivered,
    retried,
    quarantined,
    adapterCalls,
  };
}

type CanaryConfig = {
  runId: string;
  deliveryKeys: string[];
  budget: number;
  mode: 'mock' | 'provider';
  allowlistHash: string;
};

type ClaimedRow = {
  delivery_key: string;
  attempts: number;
  payload: unknown;
  contact_key: string;
  email_normalized: string;
  phone_normalized: string | null;
  display_name: string;
  transport_claim_token: string;
  transport_authorization_run_id: string;
};

type OperationReceipt = {
  request_hash: string;
  status: 'started' | 'completed' | 'uncertain';
  claim_token: string;
  provider_contact_id: string | null;
  lease_expires_at: Date | string | null;
};

class OperationUncertainError extends Error {}
class FenceLostError extends Error {}

const memoryClaimTails = new WeakMap<object, Promise<void>>();

export const HIGHLEVEL_CLAIM_SQL = `
WITH candidates AS (
  SELECT outbox.id
    FROM onetime.outbox_events AS outbox
   WHERE outbox.account_key = $1
     AND outbox.product_key = $2
     AND outbox.channel = 'highlevel'
     AND outbox.transport_mode = $8
     AND outbox.transport_authorization_run_id = $6
     AND outbox.transport_authorization_allowlist_hash = $7
     AND (
       (outbox.transport_authorization_state = 'authorized'
         AND outbox.status IN ('pending', 'retry')
         AND outbox.next_attempt_at <= $3)
       OR (outbox.transport_authorization_state = 'processing'
         AND outbox.status = 'processing'
         AND outbox.transport_lease_expires_at <= $3)
     )
     AND EXISTS (
       SELECT 1
         FROM onetime.highlevel_canary_runs AS runs
        WHERE runs.account_key = outbox.account_key
          AND runs.product_key = outbox.product_key
          AND runs.run_id = $6
          AND runs.transport_mode = $8
          AND runs.allowlist_hash = $7
          AND runs.budget = $9
          AND runs.state = 'active'
     )
     AND EXISTS (
       SELECT 1
         FROM onetime.highlevel_canary_run_allowlist AS allowlist
        WHERE allowlist.account_key = outbox.account_key
          AND allowlist.product_key = outbox.product_key
          AND allowlist.run_id = $6
          AND allowlist.delivery_key = outbox.delivery_key
     )
     AND EXISTS (
       SELECT 1
         FROM onetime.contacts AS eligible_contacts
         LEFT JOIN onetime.highlevel_contact_preferences AS eligible_preferences
           ON eligible_preferences.account_key = eligible_contacts.account_key
          AND eligible_preferences.product_key = eligible_contacts.product_key
          AND eligible_preferences.contact_key = eligible_contacts.contact_key
        WHERE eligible_contacts.account_key = outbox.account_key
          AND eligible_contacts.product_key = outbox.product_key
          AND eligible_contacts.contact_key = outbox.contact_key
          AND (
            outbox.event_type = 'highlevel.parent.household.sync_requested.v1'
            OR (
              eligible_contacts.suppression_state = 'active'
              AND NOT COALESCE(eligible_preferences.email_dnd, false)
              AND NOT COALESCE(eligible_preferences.all_dnd, false)
            )
          )
     )
   ORDER BY outbox.next_attempt_at, outbox.created_at, outbox.id
   LIMIT $4
   FOR UPDATE OF outbox SKIP LOCKED
), claimed AS (
  UPDATE onetime.outbox_events AS outbox
     SET status = 'processing',
         attempts = outbox.attempts + 1,
         next_attempt_at = $5,
         transport_authorization_state = 'processing',
         transport_claim_token = $10 || ':' || candidates.id::text,
         transport_lease_expires_at = $5
    FROM candidates
   WHERE outbox.id = candidates.id
     AND outbox.account_key = $1
     AND outbox.product_key = $2
     AND outbox.channel = 'highlevel'
     AND outbox.transport_mode = $8
     AND outbox.transport_authorization_run_id = $6
   RETURNING outbox.*
)
SELECT claimed.delivery_key, claimed.attempts, claimed.payload, claimed.contact_key,
       claimed.transport_claim_token, claimed.transport_authorization_run_id,
       contacts.email_normalized, contacts.phone_normalized, contacts.display_name
  FROM claimed
  JOIN onetime.contacts AS contacts
    ON contacts.account_key = claimed.account_key
   AND contacts.product_key = claimed.product_key
   AND contacts.contact_key = claimed.contact_key
  LEFT JOIN onetime.highlevel_contact_preferences AS preferences
    ON preferences.account_key = contacts.account_key
   AND preferences.product_key = contacts.product_key
   AND preferences.contact_key = contacts.contact_key
 WHERE claimed.event_type = 'highlevel.parent.household.sync_requested.v1'
    OR (
      contacts.suppression_state = 'active'
      AND NOT COALESCE(preferences.email_dnd, false)
      AND NOT COALESCE(preferences.all_dnd, false)
    )
 ORDER BY claimed.created_at, claimed.delivery_key
`;

function canaryConfig(config: AppConfig): CanaryConfig | null {
  const mode = config.highLevelEventSyncMode;
  const runId = config.highLevelCanaryRunId;
  const deliveryKeys = [...config.highLevelCanaryDeliveryKeys].sort();
  const budget = config.highLevelCanaryBudget;
  if (
    mode === 'disabled' ||
    !runId ||
    deliveryKeys.length < 1 ||
    budget < 1 ||
    !Number.isInteger(budget) ||
    budget > 20 ||
    deliveryKeys.length > budget
  ) {
    return null;
  }
  return {
    runId,
    deliveryKeys,
    budget,
    mode,
    allowlistHash: hashJson({
      accountKey: config.accountKey,
      productKey: config.productKey,
      mode,
      runId,
      budget,
      deliveryKeys,
    }),
  };
}

async function authorizeCanaryRows(
  pool: DbPool,
  config: AppConfig,
  canary: CanaryConfig,
  now: Date,
) {
  return inTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO onetime.highlevel_canary_runs
         (account_key, product_key, run_id, transport_mode, allowlist_hash, budget, state,
          created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $7)
       ON CONFLICT (account_key, product_key, run_id) DO NOTHING`,
      [
        config.accountKey,
        config.productKey,
        canary.runId,
        canary.mode,
        canary.allowlistHash,
        canary.budget,
        now,
      ],
    );
    const stored = await client.query(
      `SELECT transport_mode, allowlist_hash, budget, state
         FROM onetime.highlevel_canary_runs
        WHERE account_key = $1 AND product_key = $2 AND run_id = $3`,
      [config.accountKey, config.productKey, canary.runId],
    );
    const run = stored.rows[0] as Record<string, unknown> | undefined;
    if (
      !run ||
      run.transport_mode !== canary.mode ||
      run.allowlist_hash !== canary.allowlistHash ||
      Number(run.budget) !== canary.budget ||
      run.state !== 'active'
    ) {
      return false;
    }
    for (const deliveryKey of canary.deliveryKeys) {
      const eligible = await client.query(
        `SELECT delivery_key
           FROM onetime.outbox_events
          WHERE account_key = $1 AND product_key = $2
            AND channel = 'highlevel' AND delivery_key = $3
            AND transport_mode = $4`,
        [config.accountKey, config.productKey, deliveryKey, canary.mode],
      );
      if (eligible.rows.length !== 1) continue;
      await client.query(
        `INSERT INTO onetime.highlevel_canary_run_allowlist
           (account_key, product_key, run_id, delivery_key, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (account_key, product_key, run_id, delivery_key) DO NOTHING`,
        [config.accountKey, config.productKey, canary.runId, deliveryKey, now],
      );
      const updated = await client.query(
        `UPDATE onetime.outbox_events
            SET transport_authorization_state = 'authorized',
                transport_authorization_run_id = $5,
                transport_authorization_allowlist_hash = $6
          WHERE account_key = $1
            AND product_key = $2
            AND channel = 'highlevel'
            AND transport_mode = $3
            AND delivery_key = $4
            AND transport_authorization_state = 'held'
            AND status IN ('pending', 'retry')
          RETURNING contact_key`,
        [
          config.accountKey,
          config.productKey,
          canary.mode,
          deliveryKey,
          canary.runId,
          canary.allowlistHash,
        ],
      );
      if (updated.rows.length === 1) {
        await client.query(
          `INSERT INTO onetime.audit_events
             (event_key, account_key, product_key, contact_key, event_type, metadata, created_at)
           VALUES ($1, $2, $3, $4, 'highlevel_transport_authorized', $5::jsonb, $6)
           ON CONFLICT (event_key) DO NOTHING`,
          [
            stableKey('audit_highlevel_authorized', [deliveryKey, canary.runId]),
            config.accountKey,
            config.productKey,
            updated.rows[0]?.contact_key ?? null,
            JSON.stringify({
              canary_run_id_hash: stableKey('canary_run', [canary.runId]),
              allowlist_hash: canary.allowlistHash,
              budget: canary.budget,
              transport_mode: canary.mode,
            }),
            now,
          ],
        );
      }
    }
    return true;
  });
}

async function claim(
  pool: DbPool,
  config: AppConfig,
  canary: CanaryConfig,
  limit: number,
  now: Date,
) {
  const leaseExpiresAt = new Date(now.getTime() + config.highLevelRowLeaseMs);
  const claimPrefix = randomUUID();
  if (isMemoryPool(pool)) {
    return claimMemory(pool, config, canary, limit, now, leaseExpiresAt, claimPrefix);
  }
  return inTransaction(pool, async (client) => {
    const result = await client.query(HIGHLEVEL_CLAIM_SQL, [
      config.accountKey,
      config.productKey,
      now,
      limit,
      leaseExpiresAt,
      canary.runId,
      canary.allowlistHash,
      canary.mode,
      canary.budget,
      claimPrefix,
    ]);
    return result.rows.map((row) => ({ ...row, attempts: Number(row.attempts) })) as ClaimedRow[];
  });
}

async function claimMemory(
  pool: DbPool,
  config: AppConfig,
  canary: CanaryConfig,
  limit: number,
  now: Date,
  leaseExpiresAt: Date,
  claimPrefix: string,
) {
  return withMemoryClaimLock(pool, () =>
    inTransaction(pool, async (client) => {
      const result = await client.query(
        `SELECT outbox.delivery_key, outbox.attempts, outbox.payload, outbox.contact_key,
                outbox.transport_authorization_run_id,
                contacts.email_normalized, contacts.phone_normalized, contacts.display_name
           FROM onetime.outbox_events AS outbox
           JOIN onetime.highlevel_canary_runs AS runs
             ON runs.account_key = outbox.account_key
            AND runs.product_key = outbox.product_key
            AND runs.run_id = outbox.transport_authorization_run_id
             AND runs.transport_mode = outbox.transport_mode
             AND runs.allowlist_hash = outbox.transport_authorization_allowlist_hash
             AND runs.budget = $7
             AND runs.state = 'active'
           JOIN onetime.highlevel_canary_run_allowlist AS allowlist
             ON allowlist.account_key = outbox.account_key
            AND allowlist.product_key = outbox.product_key
            AND allowlist.run_id = outbox.transport_authorization_run_id
            AND allowlist.delivery_key = outbox.delivery_key
           JOIN onetime.contacts AS contacts
             ON contacts.account_key = outbox.account_key
            AND contacts.product_key = outbox.product_key
            AND contacts.contact_key = outbox.contact_key
           LEFT JOIN onetime.highlevel_contact_preferences AS preferences
             ON preferences.account_key = contacts.account_key
            AND preferences.product_key = contacts.product_key
            AND preferences.contact_key = contacts.contact_key
          WHERE outbox.account_key = $1
            AND outbox.product_key = $2
            AND outbox.channel = 'highlevel'
            AND outbox.transport_mode = $4
            AND outbox.transport_authorization_run_id = $5
            AND outbox.transport_authorization_allowlist_hash = $6
            AND (
              outbox.event_type = 'highlevel.parent.household.sync_requested.v1'
              OR (
                contacts.suppression_state = 'active'
                AND NOT COALESCE(preferences.email_dnd, false)
                AND NOT COALESCE(preferences.all_dnd, false)
              )
            )
            AND (
              (outbox.transport_authorization_state = 'authorized'
                AND outbox.status IN ('pending', 'retry')
                AND outbox.next_attempt_at <= $3)
              OR (outbox.transport_authorization_state = 'processing'
                AND outbox.status = 'processing'
                AND outbox.transport_lease_expires_at <= $3)
            )
          ORDER BY outbox.next_attempt_at, outbox.created_at, outbox.delivery_key
          LIMIT $8`,
        [
          config.accountKey,
          config.productKey,
          now,
          canary.mode,
          canary.runId,
          canary.allowlistHash,
          canary.budget,
          limit,
        ],
      );
      const claimed: ClaimedRow[] = [];
      for (const row of result.rows) {
        const claimToken = `${claimPrefix}:${String(row.delivery_key)}`;
        const updated = await client.query(
          `UPDATE onetime.outbox_events
              SET status = 'processing', attempts = attempts + 1, next_attempt_at = $4,
                  transport_authorization_state = 'processing', transport_claim_token = $5,
                  transport_lease_expires_at = $4
            WHERE account_key = $1 AND product_key = $2 AND delivery_key = $3
              AND channel = 'highlevel' AND transport_authorization_run_id = $6`,
          [
            config.accountKey,
            config.productKey,
            row.delivery_key,
            leaseExpiresAt,
            claimToken,
            canary.runId,
          ],
        );
        if (updated.rowCount) {
          claimed.push({
            ...row,
            attempts: Number(row.attempts) + 1,
            transport_claim_token: claimToken,
          } as ClaimedRow);
        }
      }
      return claimed;
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

async function runUpsertOperation(
  pool: DbPool,
  config: AppConfig,
  row: ClaimedRow,
  value: HighLevelProjection,
  adapter: HighLevelAdapter,
  now: Date,
) {
  const operationKey = operationKeyFor(row.delivery_key, 'contact_upsert');
  const requestHash = hashJson({
    eventName: value.eventName,
    locationId: value.locationId,
    contactKey: value.adult.contactKey,
    email: value.adult.email,
    displayName: value.adult.displayName,
    phone: value.adult.phone,
    customFields: value.customFields,
  });
  const prepared = await prepareOperation(
    pool,
    config,
    row,
    'contact_upsert',
    operationKey,
    requestHash,
    now,
  );
  if (prepared.completedProviderContactId) return prepared.completedProviderContactId;
  try {
    const result = await adapter.upsertContact(value, {
      operationKey,
      idempotencyKey: value.idempotencyKey,
    });
    await completeOperation(
      pool,
      config,
      row,
      operationKey,
      requestHash,
      result.providerContactId,
      now,
    );
    return result.providerContactId;
  } catch (error) {
    await quarantineOperation(pool, config, row, operationKey, now);
    throw new OperationUncertainError(error instanceof Error ? error.message : 'contact_upsert');
  }
}

async function runAddTagsOperation(
  pool: DbPool,
  config: AppConfig,
  row: ClaimedRow,
  value: HighLevelProjection,
  providerContactId: string,
  adapter: HighLevelAdapter,
  now: Date,
) {
  const operationKey = operationKeyFor(row.delivery_key, 'add_tags');
  const requestHash = hashJson({
    locationId: value.locationId,
    providerContactIdHash: stableKey('provider_ref', [providerContactId]),
    tagsToAdd: value.tagsToAdd,
  });
  const prepared = await prepareOperation(
    pool,
    config,
    row,
    'add_tags',
    operationKey,
    requestHash,
    now,
  );
  if (prepared.completed) return;
  try {
    await adapter.addTags(
      { locationId: value.locationId, providerContactId, tagsToAdd: value.tagsToAdd },
      { operationKey, idempotencyKey: value.idempotencyKey },
    );
    await completeOperation(pool, config, row, operationKey, requestHash, providerContactId, now);
  } catch (error) {
    await quarantineOperation(pool, config, row, operationKey, now);
    throw new OperationUncertainError(error instanceof Error ? error.message : 'add_tags');
  }
}

async function prepareOperation(
  pool: DbPool,
  config: AppConfig,
  row: ClaimedRow,
  operationName: 'contact_upsert' | 'add_tags',
  operationKey: string,
  requestHash: string,
  now: Date,
) {
  return inTransaction(pool, async (client) => {
    await renewRowLease(client, config, row, now);
    const existing = await loadOperation(client, config, operationKey);
    if (existing) {
      if (existing.request_hash !== requestHash) throw new OperationUncertainError('request_hash');
      if (existing.status === 'completed') {
        if (operationName === 'contact_upsert' && !existing.provider_contact_id) {
          throw new OperationUncertainError('provider_contact_id_missing');
        }
        return {
          completed: true,
          completedProviderContactId: existing.provider_contact_id ?? undefined,
        };
      }
      await markOperationUncertain(client, config, operationKey, now);
      throw new OperationUncertainError('unfinished_provider_operation');
    }
    const leaseExpiresAt = new Date(now.getTime() + config.highLevelRowLeaseMs);
    const inserted = await client.query(
      `INSERT INTO onetime.highlevel_provider_operation_receipts
         (operation_key, account_key, product_key, delivery_key, run_id, operation_name,
          request_hash, status, claim_token, lease_expires_at, started_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'started', $8, $9, $10, $10)
       ON CONFLICT (operation_key) DO NOTHING`,
      [
        operationKey,
        config.accountKey,
        config.productKey,
        row.delivery_key,
        row.transport_authorization_run_id,
        operationName,
        requestHash,
        row.transport_claim_token,
        leaseExpiresAt,
        now,
      ],
    );
    if (!inserted.rowCount) throw new OperationUncertainError('operation_race');
    return { completed: false, completedProviderContactId: undefined };
  });
}

async function renewRowLease(client: Queryable, config: AppConfig, row: ClaimedRow, now: Date) {
  const leaseExpiresAt = new Date(now.getTime() + config.highLevelRowLeaseMs);
  const result = await client.query(
    `UPDATE onetime.outbox_events
        SET transport_lease_expires_at = $5, next_attempt_at = $5
      WHERE account_key = $1 AND product_key = $2 AND delivery_key = $3
        AND channel = 'highlevel' AND status = 'processing'
        AND transport_authorization_state = 'processing'
        AND transport_claim_token = $4`,
    [
      config.accountKey,
      config.productKey,
      row.delivery_key,
      row.transport_claim_token,
      leaseExpiresAt,
    ],
  );
  if (!result.rowCount) throw new FenceLostError('row_lease_fence_lost');
}

async function loadOperation(
  client: Queryable,
  config: AppConfig,
  operationKey: string,
): Promise<OperationReceipt | null> {
  const result = await client.query(
    `SELECT request_hash, status, claim_token, provider_contact_id, lease_expires_at
       FROM onetime.highlevel_provider_operation_receipts
      WHERE account_key = $1 AND product_key = $2 AND operation_key = $3`,
    [config.accountKey, config.productKey, operationKey],
  );
  return (result.rows[0] as OperationReceipt | undefined) ?? null;
}

async function completeOperation(
  pool: DbPool,
  config: AppConfig,
  row: ClaimedRow,
  operationKey: string,
  requestHash: string,
  providerContactId: string,
  now: Date,
) {
  const result = await pool.query(
    `UPDATE onetime.highlevel_provider_operation_receipts
        SET status = 'completed', provider_contact_id = $6, completed_at = $7,
            lease_expires_at = NULL, updated_at = $7
      WHERE account_key = $1 AND product_key = $2 AND operation_key = $3
        AND request_hash = $4 AND claim_token = $5 AND status = 'started'`,
    [
      config.accountKey,
      config.productKey,
      operationKey,
      requestHash,
      row.transport_claim_token,
      providerContactId,
      now,
    ],
  );
  if (!result.rowCount) throw new FenceLostError('operation_completion_fence_lost');
}

async function quarantineOperation(
  pool: DbPool,
  config: AppConfig,
  row: ClaimedRow,
  operationKey: string,
  now: Date,
) {
  await pool.query(
    `UPDATE onetime.highlevel_provider_operation_receipts
        SET status = 'uncertain', lease_expires_at = NULL, updated_at = $5
      WHERE account_key = $1 AND product_key = $2 AND operation_key = $3
        AND claim_token = $4 AND status = 'started'`,
    [config.accountKey, config.productKey, operationKey, row.transport_claim_token, now],
  );
}

async function markOperationUncertain(
  client: Queryable,
  config: AppConfig,
  operationKey: string,
  now: Date,
) {
  await client.query(
    `UPDATE onetime.highlevel_provider_operation_receipts
        SET status = 'uncertain', lease_expires_at = NULL, updated_at = $4
      WHERE account_key = $1 AND product_key = $2 AND operation_key = $3
        AND status = 'started'`,
    [config.accountKey, config.productKey, operationKey, now],
  );
}

function projection(event: HighLevelOutboundEvent, row: ClaimedRow): HighLevelProjection {
  const tagsToAdd: Record<HighLevelEventName, string> = {
    'adult.signup.submitted': 'OT | Lead',
    'parent.household.sync_requested': 'OT | Parent',
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
  if (event.data.household_key) {
    customFields.push({ id: 'PIuJBPvZGI3FTp4ZRpay', value: event.data.household_key });
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
  row: ClaimedRow,
  event: HighLevelOutboundEvent,
  providerContactId: string,
  now: Date,
) {
  return inTransaction(pool, async (client) => {
    const updated = await client.query(
      `UPDATE onetime.outbox_events
          SET status = 'delivered', delivered_at = $5,
              transport_authorization_state = 'completed', transport_claim_token = NULL,
              transport_lease_expires_at = NULL
        WHERE account_key = $1 AND product_key = $2 AND delivery_key = $3
          AND channel = 'highlevel' AND status = 'processing'
          AND transport_authorization_state = 'processing'
          AND transport_claim_token = $4`,
      [config.accountKey, config.productKey, row.delivery_key, row.transport_claim_token, now],
    );
    if (!updated.rowCount) return false;
    if (event.event_name === 'parent.household.sync_requested' && event.data.household_key) {
      await client.query(
        `UPDATE onetime.adult_household_contact_links
            SET highlevel_contact_id = $6,
                sync_state = 'synced',
                last_delivery_key = $5,
                last_reconciled_at = $7,
                updated_at = $7
          WHERE account_key = $1
            AND product_key = $2
            AND contact_key = $3
            AND household_key = $4
            AND highlevel_location_id = $8`,
        [
          config.accountKey,
          config.productKey,
          event.adult_contact.contact_key,
          event.data.household_key,
          row.delivery_key,
          providerContactId,
          now,
          event.scope.location_id,
        ],
      );
    }
    await client.query(
      `INSERT INTO onetime.audit_events
         (event_key, account_key, product_key, contact_key, event_type, metadata, created_at)
       VALUES ($1, $2, $3, $4, 'highlevel_projection_delivered', $5::jsonb, $6)
       ON CONFLICT (event_key) DO NOTHING`,
      [
        stableKey('audit_highlevel_delivered', [row.delivery_key]),
        config.accountKey,
        config.productKey,
        event.adult_contact.contact_key,
        JSON.stringify({
          event_name: event.event_name,
          canary_run_id_hash: stableKey('canary_run', [row.transport_authorization_run_id]),
          provider_reference_hash: stableKey('provider_ref', [providerContactId]),
          private_destination_recorded: false,
        }),
        now,
      ],
    );
    return true;
  });
}

async function markRetry(pool: DbPool, config: AppConfig, row: ClaimedRow, now: Date) {
  const terminal = row.attempts >= 8;
  const nextAttemptAt = new Date(now.getTime() + Math.min(60_000, 1000 * 2 ** row.attempts));
  const result = await pool.query(
    `UPDATE onetime.outbox_events
        SET status = $5, next_attempt_at = $6,
            transport_authorization_state = $7, transport_claim_token = NULL,
            transport_lease_expires_at = NULL
      WHERE account_key = $1 AND product_key = $2 AND delivery_key = $3
        AND channel = 'highlevel' AND transport_claim_token = $4
        AND transport_authorization_state = 'processing'`,
    [
      config.accountKey,
      config.productKey,
      row.delivery_key,
      row.transport_claim_token,
      terminal ? 'dead_letter' : 'retry',
      nextAttemptAt,
      terminal ? 'uncertain' : 'authorized',
    ],
  );
  if (!result.rowCount) return false;
  await pool.query(
    `INSERT INTO onetime.audit_events
       (event_key, account_key, product_key, contact_key, event_type, metadata, created_at)
     VALUES ($1, $2, $3, $4, 'highlevel_projection_retry', $5::jsonb, $6)
     ON CONFLICT (event_key) DO NOTHING`,
    [
      stableKey('audit_highlevel_retry', [row.delivery_key, String(row.attempts)]),
      config.accountKey,
      config.productKey,
      row.contact_key,
      JSON.stringify({
        attempts: row.attempts,
        terminal,
        failure_code: 'highlevel_projection_failed',
      }),
      now,
    ],
  );
  return true;
}

async function markUncertain(
  pool: DbPool,
  config: AppConfig,
  row: ClaimedRow,
  event: HighLevelOutboundEvent | null,
  now: Date,
) {
  const result = await pool.query(
    `UPDATE onetime.outbox_events
        SET status = 'dead_letter', transport_authorization_state = 'uncertain',
            transport_claim_token = NULL, transport_lease_expires_at = NULL
      WHERE account_key = $1 AND product_key = $2 AND delivery_key = $3
        AND channel = 'highlevel' AND transport_claim_token = $4
        AND transport_authorization_state = 'processing'`,
    [config.accountKey, config.productKey, row.delivery_key, row.transport_claim_token],
  );
  if (!result.rowCount) return false;
  await pool.query(
    `INSERT INTO onetime.audit_events
       (event_key, account_key, product_key, contact_key, event_type, metadata, created_at)
     VALUES ($1, $2, $3, $4, 'highlevel_projection_uncertain', $5::jsonb, $6)
     ON CONFLICT (event_key) DO NOTHING`,
    [
      stableKey('audit_highlevel_uncertain', [row.delivery_key]),
      config.accountKey,
      config.productKey,
      row.contact_key,
      JSON.stringify({
        event_name: event?.event_name ?? 'invalid',
        canary_run_id_hash: stableKey('canary_run', [row.transport_authorization_run_id]),
        retry_authorized: false,
        failure_code: 'highlevel_provider_operation_uncertain',
      }),
      now,
    ],
  );
  return true;
}

function operationKeyFor(deliveryKey: string, operation: 'contact_upsert' | 'add_tags') {
  return stableKey('highlevel_provider_operation', [deliveryKey, operation]);
}

function hashJson(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
