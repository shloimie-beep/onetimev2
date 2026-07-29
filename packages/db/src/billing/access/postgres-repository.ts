import type {
  BillingAccessRepository,
  BillingEventCursor,
  BillingEventReceipt,
  BillingFailureCursor,
  BillingProjectionResult,
  HouseholdBillingProjection,
  VerifiedBillingEvent,
} from '../../../../contracts/src/billing/access/index.ts';
import {
  BillingAccessError,
  createFreeBillingProjection,
  expireBillingGrace,
  projectVerifiedBillingEvent,
} from '../../../../domain/src/billing/access/index.ts';

type SqlRow = Record<string, unknown>;
type SqlResult<Row extends SqlRow = SqlRow> = {
  rows: Row[];
  rowCount: number | null;
};

export interface BillingAccessSqlClient {
  query<Row extends SqlRow = SqlRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<SqlResult<Row>>;
  release(): void;
}

export interface BillingAccessSqlPool {
  connect(): Promise<BillingAccessSqlClient>;
}

export function createPostgresBillingAccessRepository(
  pool: BillingAccessSqlPool,
): BillingAccessRepository {
  return {
    async projectVerifiedEvent(
      event: VerifiedBillingEvent,
      receivedAt: Date,
    ): Promise<BillingProjectionResult> {
      return withTransaction(pool, async (client) => {
        await lockHousehold(client, event.household_id);
        const receiptResult = await client.query(
          `SELECT event_id, household_id, provider_customer_ref_hash,
                  billing_term_id, kind, occurred_at, received_at,
                  payload_digest, projection_version
             FROM onetime.billing_event_receipt
            WHERE provider = 'stripe' AND event_id = $1`,
          [event.event_id],
        );
        const projectionResult = await client.query(
          `SELECT household_id, provider_customer_ref_hash, state,
                  paid_winner_json, unresolved_failure_json,
                  inactive_winner_json, version, updated_at
             FROM onetime.billing_access_projection
            WHERE household_id = $1
            FOR UPDATE`,
          [event.household_id],
        );
        if (receiptResult.rows[0] !== undefined) {
          const receipt = mapReceipt(receiptResult.rows[0]);
          if (
            receipt.payload_digest !== event.payload_digest ||
            receipt.household_id !== event.household_id ||
            receipt.provider_customer_ref_hash !== event.provider_customer_ref_hash
          ) {
            throw new BillingAccessError(
              'event_id_conflict',
              'A provider event identity cannot be reused with different billing truth.',
            );
          }
          const projectionRow = projectionResult.rows[0];
          if (projectionRow === undefined) {
            throw new BillingAccessError('invalid_contract', 'Receipt projection is missing.');
          }
          return {
            receipt,
            projection: mapProjection(projectionRow),
            duplicate: true,
          };
        }

        const prior =
          projectionResult.rows[0] === undefined
            ? createFreeBillingProjection({
                household_id: event.household_id,
                provider_customer_ref_hash: event.provider_customer_ref_hash,
                now: receivedAt,
              })
            : mapProjection(projectionResult.rows[0]);
        const projection = projectVerifiedBillingEvent(prior, event, receivedAt);
        const saved = await saveProjection(client, projection, prior.version);
        if (!saved) {
          throw new BillingAccessError(
            'invalid_contract',
            'Billing projection version changed during its fenced transaction.',
          );
        }
        const receipt: BillingEventReceipt = {
          event_id: event.event_id,
          household_id: event.household_id,
          provider_customer_ref_hash: event.provider_customer_ref_hash,
          billing_term_id: event.billing_term_id,
          kind: event.kind,
          occurred_at: event.occurred_at,
          received_at: receivedAt.toISOString(),
          payload_digest: event.payload_digest,
          signature_verified: true,
          projection_version: projection.version,
        };
        await client.query(
          `INSERT INTO onetime.billing_event_receipt
           (provider, event_id, household_id, provider_customer_ref_hash,
            billing_term_id, kind, occurred_at, received_at, payload_digest,
            signature_verified, projection_version)
           VALUES ('stripe',$1,$2,$3,$4,$5,$6,$7,$8,true,$9)`,
          [
            receipt.event_id,
            receipt.household_id,
            receipt.provider_customer_ref_hash,
            receipt.billing_term_id,
            receipt.kind,
            receipt.occurred_at,
            receipt.received_at,
            receipt.payload_digest,
            receipt.projection_version,
          ],
        );
        return { receipt, projection, duplicate: false };
      });
    },

    async expireGrace(householdId: string, now: Date): Promise<HouseholdBillingProjection | null> {
      return withTransaction(pool, async (client) => {
        await lockHousehold(client, householdId);
        const result = await client.query(
          `SELECT household_id, provider_customer_ref_hash, state,
                  paid_winner_json, unresolved_failure_json,
                  inactive_winner_json, version, updated_at
             FROM onetime.billing_access_projection
            WHERE household_id = $1
            FOR UPDATE`,
          [householdId],
        );
        if (result.rows[0] === undefined) return null;
        const prior = mapProjection(result.rows[0]);
        const projection = expireBillingGrace(prior, now);
        if (projection === prior) return prior;
        if (!(await saveProjection(client, projection, prior.version))) {
          throw new BillingAccessError(
            'invalid_contract',
            'Billing projection version changed during grace expiry.',
          );
        }
        return projection;
      });
    },

    async getProjection(householdId: string): Promise<HouseholdBillingProjection | null> {
      const client = await pool.connect();
      try {
        const result = await client.query(
          `SELECT household_id, provider_customer_ref_hash, state,
                  paid_winner_json, unresolved_failure_json,
                  inactive_winner_json, version, updated_at
             FROM onetime.billing_access_projection
            WHERE household_id = $1`,
          [householdId],
        );
        return result.rows[0] === undefined ? null : mapProjection(result.rows[0]);
      } finally {
        client.release();
      }
    },
  };
}

async function lockHousehold(client: BillingAccessSqlClient, householdId: string): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [householdId]);
}

async function saveProjection(
  client: BillingAccessSqlClient,
  projection: HouseholdBillingProjection,
  expectedVersion: number,
): Promise<boolean> {
  const result = await client.query(
    `INSERT INTO onetime.billing_access_projection
     (household_id, provider_customer_ref_hash, state, paid_winner_json,
      unresolved_failure_json, inactive_winner_json, version, updated_at)
     VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7,$8)
     ON CONFLICT (household_id) DO UPDATE SET
       provider_customer_ref_hash = EXCLUDED.provider_customer_ref_hash,
       state = EXCLUDED.state,
       paid_winner_json = EXCLUDED.paid_winner_json,
       unresolved_failure_json = EXCLUDED.unresolved_failure_json,
       inactive_winner_json = EXCLUDED.inactive_winner_json,
       version = EXCLUDED.version,
       updated_at = EXCLUDED.updated_at
     WHERE onetime.billing_access_projection.version = $9`,
    [
      projection.household_id,
      projection.provider_customer_ref_hash,
      projection.state,
      JSON.stringify(projection.paid_winner),
      JSON.stringify(projection.unresolved_failure),
      JSON.stringify(projection.inactive_winner),
      projection.version,
      projection.updated_at,
      expectedVersion,
    ],
  );
  return (result.rowCount ?? 0) === 1;
}

async function withTransaction<T>(
  pool: BillingAccessSqlPool,
  run: (client: BillingAccessSqlClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function mapProjection(row: SqlRow): HouseholdBillingProjection {
  return {
    household_id: String(row.household_id),
    provider_customer_ref_hash: String(row.provider_customer_ref_hash),
    state: String(row.state) as HouseholdBillingProjection['state'],
    paid_winner: mapJson<BillingEventCursor>(row.paid_winner_json),
    unresolved_failure: mapJson<BillingFailureCursor>(row.unresolved_failure_json),
    inactive_winner: mapJson<BillingEventCursor>(row.inactive_winner_json),
    version: Number(row.version),
    updated_at: requiredIso(row.updated_at),
  };
}

function mapReceipt(row: SqlRow): BillingEventReceipt {
  return {
    event_id: String(row.event_id),
    household_id: String(row.household_id),
    provider_customer_ref_hash: String(row.provider_customer_ref_hash),
    billing_term_id: String(row.billing_term_id),
    kind: String(row.kind) as BillingEventReceipt['kind'],
    occurred_at: requiredIso(row.occurred_at),
    received_at: requiredIso(row.received_at),
    payload_digest: String(row.payload_digest),
    signature_verified: true,
    projection_version: Number(row.projection_version),
  };
}

function mapJson<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  return (typeof value === 'string' ? JSON.parse(value) : value) as T;
}

function requiredIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}
