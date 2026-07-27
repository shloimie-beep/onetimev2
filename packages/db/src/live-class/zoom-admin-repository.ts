import type {
  ZoomAdminTestResourceRecord,
  ZoomAdminTestResourceRepository,
} from '../../../domain/src/live-class/zoom-admin.ts';
import { inTransaction, type DbPool, type Queryable } from '../index.ts';

export function createZoomAdminTestResourceRepository(
  pool: DbPool,
): ZoomAdminTestResourceRepository {
  return {
    get: (scope) => getRecord(pool, scope),
    recordConnection: (args) =>
      inTransaction(pool, async (client) => {
        await client.query(
          `INSERT INTO onetime.zoom_admin_test_resources
             (resource_key, account_key, product_key, connection_state, connection_checked_at,
              last_error_code, last_error_message)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (account_key, product_key)
           DO UPDATE SET
             connection_state = EXCLUDED.connection_state,
             connection_checked_at = EXCLUDED.connection_checked_at,
             last_error_code = EXCLUDED.last_error_code,
             last_error_message = EXCLUDED.last_error_message,
             updated_at = now()`,
          [
            args.resource_key,
            args.account_key,
            args.product_key,
            args.state,
            args.checked_at,
            args.error_code ?? null,
            args.error_message ?? null,
          ],
        );
        return requireRecord(client, args);
      }),
    claimCreate: (args) =>
      inTransaction(pool, async (client) => {
        const current = await getRecord(client, args, true);
        if (
          current &&
          (['creating', 'active', 'create_unknown', 'deleting', 'delete_unknown'].includes(
            current.resource_state,
          ) ||
            (current.create_idempotency_key === args.idempotency_key &&
              ['create_failed', 'deleted'].includes(current.resource_state)))
        ) {
          return { record: current, execute: false };
        }
        await client.query(
          `INSERT INTO onetime.zoom_admin_test_resources
             (resource_key, account_key, product_key, resource_state, created_by_user_ref,
              create_idempotency_key, registrant_state, last_error_code, last_error_message)
           VALUES ($1, $2, $3, 'creating', $4, $5, 'none', NULL, NULL)
           ON CONFLICT (account_key, product_key)
           DO UPDATE SET
             resource_state = 'creating',
             provider_meeting_ref_digest = NULL,
             provider_meeting_ciphertext = NULL,
             meeting_topic = NULL,
             meeting_starts_at = NULL,
             meeting_duration_minutes = NULL,
             created_by_user_ref = EXCLUDED.created_by_user_ref,
             create_idempotency_key = EXCLUDED.create_idempotency_key,
             registrant_state = 'none',
             provider_registrant_ref_digest = NULL,
             register_idempotency_key = NULL,
             delete_idempotency_key = NULL,
             last_error_code = NULL,
             last_error_message = NULL,
             updated_at = now()`,
          [
            args.resource_key,
            args.account_key,
            args.product_key,
            args.actor_user_ref,
            args.idempotency_key,
          ],
        );
        return { record: await requireRecord(client, args), execute: true };
      }),
    completeCreate: (args) =>
      updateAndRequire(
        pool,
        args,
        `UPDATE onetime.zoom_admin_test_resources
            SET resource_state = 'active',
                provider_meeting_ref_digest = $4,
                provider_meeting_ciphertext = $5,
                meeting_topic = $6,
                meeting_starts_at = $7,
                meeting_duration_minutes = $8,
                last_error_code = NULL,
                last_error_message = NULL,
                updated_at = now()
          WHERE account_key = $1 AND product_key = $2
            AND create_idempotency_key = $3 AND resource_state = 'creating'`,
        [
          args.account_key,
          args.product_key,
          args.idempotency_key,
          args.provider_meeting_ref_digest,
          args.provider_meeting_ciphertext,
          args.meeting_topic,
          args.meeting_starts_at,
          args.meeting_duration_minutes,
        ],
      ),
    failCreate: (args) =>
      updateAndRequire(
        pool,
        args,
        `UPDATE onetime.zoom_admin_test_resources
            SET resource_state = $4,
                last_error_code = $5,
                last_error_message = $6,
                updated_at = now()
          WHERE account_key = $1 AND product_key = $2
            AND create_idempotency_key = $3 AND resource_state = 'creating'`,
        [
          args.account_key,
          args.product_key,
          args.idempotency_key,
          args.outcome_unknown ? 'create_unknown' : 'create_failed',
          args.error_code,
          args.error_message,
        ],
      ),
    claimRegistration: (args) =>
      inTransaction(pool, async (client) => {
        const current = await requireRecord(client, args, true);
        if (
          current.resource_state !== 'active' ||
          !current.provider_meeting_ciphertext ||
          current.registrant_state === 'registered' ||
          current.registrant_state === 'registering' ||
          current.registrant_state === 'registration_unknown' ||
          (current.registrant_state === 'registration_failed' &&
            current.register_idempotency_key === args.idempotency_key)
        ) {
          return { record: current, execute: false };
        }
        await client.query(
          `UPDATE onetime.zoom_admin_test_resources
              SET registrant_state = 'registering',
                  register_idempotency_key = $3,
                  last_error_code = NULL,
                  last_error_message = NULL,
                  updated_at = now()
            WHERE account_key = $1 AND product_key = $2`,
          [args.account_key, args.product_key, args.idempotency_key],
        );
        return { record: await requireRecord(client, args), execute: true };
      }),
    completeRegistration: (args) =>
      updateAndRequire(
        pool,
        args,
        `UPDATE onetime.zoom_admin_test_resources
            SET registrant_state = 'registered',
                provider_registrant_ref_digest = $4,
                last_error_code = NULL,
                last_error_message = NULL,
                updated_at = now()
          WHERE account_key = $1 AND product_key = $2
            AND register_idempotency_key = $3 AND registrant_state = 'registering'`,
        [
          args.account_key,
          args.product_key,
          args.idempotency_key,
          args.provider_registrant_ref_digest,
        ],
      ),
    failRegistration: (args) =>
      updateAndRequire(
        pool,
        args,
        `UPDATE onetime.zoom_admin_test_resources
            SET registrant_state = $4,
                last_error_code = $5,
                last_error_message = $6,
                updated_at = now()
          WHERE account_key = $1 AND product_key = $2
            AND register_idempotency_key = $3 AND registrant_state = 'registering'`,
        [
          args.account_key,
          args.product_key,
          args.idempotency_key,
          args.outcome_unknown ? 'registration_unknown' : 'registration_failed',
          args.error_code,
          args.error_message,
        ],
      ),
    claimDelete: (args) =>
      inTransaction(pool, async (client) => {
        const current = await requireRecord(client, args, true);
        if (
          !current.provider_meeting_ciphertext ||
          !current.provider_meeting_ref_digest ||
          !['active', 'delete_unknown'].includes(current.resource_state)
        ) {
          return { record: current, execute: false };
        }
        await client.query(
          `UPDATE onetime.zoom_admin_test_resources
              SET resource_state = 'deleting',
                  delete_idempotency_key = $3,
                  last_error_code = NULL,
                  last_error_message = NULL,
                  updated_at = now()
            WHERE account_key = $1 AND product_key = $2`,
          [args.account_key, args.product_key, args.idempotency_key],
        );
        return { record: await requireRecord(client, args), execute: true };
      }),
    completeDelete: (args) =>
      updateAndRequire(
        pool,
        args,
        `UPDATE onetime.zoom_admin_test_resources
            SET resource_state = 'deleted',
                provider_meeting_ciphertext = NULL,
                registrant_state = 'none',
                provider_registrant_ref_digest = NULL,
                last_error_code = NULL,
                last_error_message = NULL,
                updated_at = now()
          WHERE account_key = $1 AND product_key = $2
            AND delete_idempotency_key = $3 AND resource_state = 'deleting'`,
        [args.account_key, args.product_key, args.idempotency_key],
      ),
    failDelete: (args) =>
      updateAndRequire(
        pool,
        args,
        `UPDATE onetime.zoom_admin_test_resources
            SET resource_state = $4,
                last_error_code = $5,
                last_error_message = $6,
                updated_at = now()
          WHERE account_key = $1 AND product_key = $2
            AND delete_idempotency_key = $3 AND resource_state = 'deleting'`,
        [
          args.account_key,
          args.product_key,
          args.idempotency_key,
          args.outcome_unknown ? 'delete_unknown' : 'active',
          args.error_code,
          args.error_message,
        ],
      ),
  };
}

async function updateAndRequire(
  pool: DbPool,
  scope: { account_key: string; product_key: string },
  sql: string,
  params: unknown[],
) {
  return inTransaction(pool, async (client) => {
    const result = await client.query(sql, params);
    if (result.rowCount !== 1) {
      throw new Error('Zoom Admin test-resource state changed during the request.');
    }
    return requireRecord(client, scope);
  });
}

async function requireRecord(
  queryable: Queryable,
  scope: { account_key: string; product_key: string },
  forUpdate = false,
) {
  const record = await getRecord(queryable, scope, forUpdate);
  if (!record) throw new Error('Zoom Admin test-resource record was not found.');
  return record;
}

async function getRecord(
  queryable: Queryable,
  scope: { account_key: string; product_key: string },
  forUpdate = false,
): Promise<ZoomAdminTestResourceRecord | null> {
  const result = await queryable.query(
    `SELECT resource_key, account_key, product_key, connection_state, connection_checked_at,
            resource_state, provider_meeting_ref_digest, provider_meeting_ciphertext,
            meeting_topic, meeting_starts_at, meeting_duration_minutes, created_by_user_ref,
            create_idempotency_key, registrant_state, provider_registrant_ref_digest,
            register_idempotency_key, delete_idempotency_key, last_error_code,
            last_error_message, created_at, updated_at
       FROM onetime.zoom_admin_test_resources
      WHERE account_key = $1 AND product_key = $2
      ${forUpdate ? 'FOR UPDATE' : ''}`,
    [scope.account_key, scope.product_key],
  );
  return result.rows[0] ? mapRecord(result.rows[0]) : null;
}

function mapRecord(row: Record<string, unknown>): ZoomAdminTestResourceRecord {
  return {
    resource_key: String(row.resource_key),
    account_key: String(row.account_key),
    product_key: String(row.product_key),
    connection_state: row.connection_state as ZoomAdminTestResourceRecord['connection_state'],
    connection_checked_at: dateOrNull(row.connection_checked_at),
    resource_state: row.resource_state as ZoomAdminTestResourceRecord['resource_state'],
    provider_meeting_ref_digest: stringOrNull(row.provider_meeting_ref_digest),
    provider_meeting_ciphertext: stringOrNull(row.provider_meeting_ciphertext),
    meeting_topic: stringOrNull(row.meeting_topic),
    meeting_starts_at: dateOrNull(row.meeting_starts_at),
    meeting_duration_minutes:
      row.meeting_duration_minutes === null || row.meeting_duration_minutes === undefined
        ? null
        : Number(row.meeting_duration_minutes),
    created_by_user_ref: stringOrNull(row.created_by_user_ref),
    create_idempotency_key: stringOrNull(row.create_idempotency_key),
    registrant_state: row.registrant_state as ZoomAdminTestResourceRecord['registrant_state'],
    provider_registrant_ref_digest: stringOrNull(row.provider_registrant_ref_digest),
    register_idempotency_key: stringOrNull(row.register_idempotency_key),
    delete_idempotency_key: stringOrNull(row.delete_idempotency_key),
    last_error_code: stringOrNull(row.last_error_code),
    last_error_message: stringOrNull(row.last_error_message),
    created_at: new Date(String(row.created_at)),
    updated_at: new Date(String(row.updated_at)),
  };
}

function stringOrNull(value: unknown) {
  return value === null || value === undefined ? null : String(value);
}

function dateOrNull(value: unknown) {
  return value === null || value === undefined ? null : new Date(String(value));
}
