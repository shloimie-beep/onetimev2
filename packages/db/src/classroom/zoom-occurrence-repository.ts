import type {
  ZoomClassOccurrenceRecord,
  ZoomClassOccurrenceRepository,
  ZoomClassOccurrenceResourceRecord,
  ZoomClassRegistrantRecord,
} from '../../../domain/src/classroom/zoom-occurrence.ts';
import { inTransaction, type DbPool, type Queryable } from '../index.ts';

export function createZoomClassOccurrenceRepository(pool: DbPool): ZoomClassOccurrenceRepository {
  return {
    getOccurrence: (scope, occurrenceKey) => getOccurrence(pool, scope, occurrenceKey),
    getResource: (scope, occurrenceKey) => getResource(pool, scope, occurrenceKey),
    claimProvision: (args) =>
      inTransaction(pool, async (client) => {
        const current = await getResource(client, args, args.occurrence.occurrence_key, true);
        if (
          current &&
          ([
            'provisioning',
            'active',
            'provision_unknown',
            'deleting',
            'deleted',
            'delete_unknown',
          ].includes(current.resource_state) ||
            (current.resource_state === 'provision_failed' &&
              current.provision_idempotency_key === args.idempotency_key))
        ) {
          return { record: current, execute: false };
        }
        await client.query(
          `INSERT INTO onetime.zoom_class_occurrence_resources
             (resource_key, account_key, product_key, occurrence_key, environment, purpose,
              resource_state, meeting_topic, meeting_starts_at, meeting_duration_minutes,
              created_by_user_ref, provision_idempotency_key)
           VALUES ($1,$2,$3,$4,$5,$6,'provisioning',$7,$8,$9,$10,$11)
           ON CONFLICT (account_key, product_key, occurrence_key)
           DO UPDATE SET
             environment = EXCLUDED.environment,
             purpose = EXCLUDED.purpose,
             resource_state = 'provisioning',
             provider_meeting_ref_digest = NULL,
             provider_meeting_ciphertext = NULL,
             meeting_password_ciphertext = NULL,
             meeting_topic = EXCLUDED.meeting_topic,
             meeting_starts_at = EXCLUDED.meeting_starts_at,
             meeting_duration_minutes = EXCLUDED.meeting_duration_minutes,
             created_by_user_ref = EXCLUDED.created_by_user_ref,
             provision_idempotency_key = EXCLUDED.provision_idempotency_key,
             delete_idempotency_key = NULL,
             last_error_code = NULL,
             last_error_message = NULL,
             updated_at = now()`,
          [
            args.resource_key,
            args.account_key,
            args.product_key,
            args.occurrence.occurrence_key,
            args.environment,
            args.purpose,
            args.occurrence.title,
            args.occurrence.starts_at,
            args.occurrence.duration_minutes,
            args.actor_user_ref,
            args.idempotency_key,
          ],
        );
        return {
          record: await requireResource(client, args, args.occurrence.occurrence_key),
          execute: true,
        };
      }),
    completeProvision: (args) =>
      inTransaction(pool, async (client) => {
        const updated = await client.query(
          `UPDATE onetime.zoom_class_occurrence_resources
              SET resource_state = 'active',
                  provider_meeting_ref_digest = $5,
                  provider_meeting_ciphertext = $6,
                  meeting_password_ciphertext = $7,
                  last_error_code = NULL,
                  last_error_message = NULL,
                  updated_at = now()
            WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3
              AND provision_idempotency_key = $4 AND resource_state = 'provisioning'`,
          [
            args.account_key,
            args.product_key,
            args.occurrence_key,
            args.idempotency_key,
            args.provider_meeting_ref_digest,
            args.provider_meeting_ciphertext,
            args.meeting_password_ciphertext,
          ],
        );
        if (updated.rowCount !== 1) {
          throw new Error('Zoom occurrence provisioning state changed during the request.');
        }
        return requireResource(client, args, args.occurrence_key);
      }),
    failProvision: async (args) => {
      await pool.query(
        `UPDATE onetime.zoom_class_occurrence_resources
            SET resource_state = $5,
                last_error_code = $6,
                last_error_message = $7,
                updated_at = now()
          WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3
            AND provision_idempotency_key = $4 AND resource_state = 'provisioning'`,
        [
          args.account_key,
          args.product_key,
          args.occurrence_key,
          args.idempotency_key,
          args.outcome_unknown ? 'provision_unknown' : 'provision_failed',
          args.error_code,
          args.error_message,
        ],
      );
    },
    listActiveEnrolledLearners: async (scope, occurrenceKey) => {
      const result = await pool.query(
        `SELECT entitlements.household_key, entitlements.learner_key, learners.display_name
           FROM onetime.classroom_occurrence_learner_entitlements AS entitlements
           JOIN onetime.portal_learners AS learners
             ON learners.account_key = entitlements.account_key
            AND learners.product_key = entitlements.product_key
            AND learners.learner_key = entitlements.learner_key
          WHERE entitlements.account_key = $1
            AND entitlements.product_key = $2
            AND entitlements.occurrence_key = $3
            AND entitlements.entitlement_state = 'active'
            AND learners.learner_status = 'active'
          ORDER BY entitlements.learner_key`,
        [scope.account_key, scope.product_key, occurrenceKey],
      );
      return result.rows.map((row) => ({
        household_key: String(row.household_key),
        learner_key: String(row.learner_key),
        display_name: String(row.display_name),
      }));
    },
    getRegistrant: (scope, occurrenceKey, learnerKey) =>
      getRegistrant(pool, scope, occurrenceKey, learnerKey),
    saveRegistrant: async (args) => {
      await pool.query(
        `INSERT INTO onetime.classroom_zoom_registrants
           (account_key, product_key, household_key, learner_key, occurrence_key,
            provider_meeting_ref_digest, provider_occurrence_id,
            provider_registrant_ref_digest, registrant_token_ref, join_url_digest,
            registrant_token_ciphertext, registration_email_digest, registration_state)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'registered')
         ON CONFLICT (account_key, product_key, learner_key, occurrence_key)
         DO UPDATE SET
           household_key = EXCLUDED.household_key,
           provider_meeting_ref_digest = EXCLUDED.provider_meeting_ref_digest,
           provider_occurrence_id = EXCLUDED.provider_occurrence_id,
           provider_registrant_ref_digest = EXCLUDED.provider_registrant_ref_digest,
           registrant_token_ref = EXCLUDED.registrant_token_ref,
           join_url_digest = EXCLUDED.join_url_digest,
           registrant_token_ciphertext = EXCLUDED.registrant_token_ciphertext,
           registration_email_digest = EXCLUDED.registration_email_digest,
           registration_state = 'registered',
           updated_at = now()`,
        [
          args.account_key,
          args.product_key,
          args.household_key,
          args.registrant.learner_key,
          args.occurrence_key,
          args.registrant.meeting_id_digest,
          args.registrant.occurrence_id,
          args.registrant.registrant_id_digest,
          args.registrant.registrant_token_ref,
          args.registrant.join_url_digest,
          args.registrant_token_ciphertext,
          args.registration_email_digest,
        ],
      );
    },
    markOccurrenceReady: async (scope, occurrenceKey, providerMeetingRefDigest) => {
      await inTransaction(pool, async (client) => {
        const occurrence = await client.query(
          `UPDATE onetime.class_occurrences
              SET access_state = 'ready', updated_at = now()
            WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3`,
          [scope.account_key, scope.product_key, occurrenceKey],
        );
        if (occurrence.rowCount !== 1) throw new Error('Class occurrence was not found.');
        await client.query(
          `INSERT INTO onetime.classroom_session_provider_projection
             (session_projection_key, account_key, product_key, occurrence_key,
              provider_meeting_ref_digest, provider_state)
           VALUES ($1,$2,$3,$4,$5,'ready')
           ON CONFLICT (account_key, product_key, occurrence_key, provider)
           DO UPDATE SET
             provider_meeting_ref_digest = EXCLUDED.provider_meeting_ref_digest,
             provider_state = 'ready',
             updated_at = now()`,
          [
            `zoom_session_${occurrenceKey}`,
            scope.account_key,
            scope.product_key,
            occurrenceKey,
            providerMeetingRefDigest,
          ],
        );
      });
    },
    claimDelete: (args) =>
      inTransaction(pool, async (client) => {
        const current = await requireResource(client, args, args.occurrence_key, true);
        if (
          current.resource_state === 'deleted' ||
          current.resource_state === 'deleting' ||
          !current.provider_meeting_ciphertext
        ) {
          return { record: current, execute: false };
        }
        if (!['active', 'delete_unknown'].includes(current.resource_state)) {
          return { record: current, execute: false };
        }
        await client.query(
          `UPDATE onetime.zoom_class_occurrence_resources
              SET resource_state = 'deleting',
                  delete_idempotency_key = $4,
                  last_error_code = NULL,
                  last_error_message = NULL,
                  updated_at = now()
            WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3`,
          [args.account_key, args.product_key, args.occurrence_key, args.idempotency_key],
        );
        return {
          record: await requireResource(client, args, args.occurrence_key),
          execute: true,
        };
      }),
    completeDelete: async (args) => {
      await inTransaction(pool, async (client) => {
        const updated = await client.query(
          `UPDATE onetime.zoom_class_occurrence_resources
              SET resource_state = 'deleted',
                  provider_meeting_ciphertext = NULL,
                  meeting_password_ciphertext = NULL,
                  last_error_code = NULL,
                  last_error_message = NULL,
                  updated_at = now()
            WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3
              AND delete_idempotency_key = $4 AND resource_state = 'deleting'`,
          [args.account_key, args.product_key, args.occurrence_key, args.idempotency_key],
        );
        if (updated.rowCount !== 1) {
          throw new Error('Zoom occurrence deletion state changed during the request.');
        }
        await client.query(
          `UPDATE onetime.classroom_zoom_registrants
              SET registration_state = 'cancelled',
                  registrant_token_ciphertext = NULL,
                  updated_at = now()
            WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3`,
          [args.account_key, args.product_key, args.occurrence_key],
        );
        await client.query(
          `UPDATE onetime.classroom_session_provider_projection
              SET provider_state = 'cancelled', updated_at = now()
            WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3`,
          [args.account_key, args.product_key, args.occurrence_key],
        );
        await client.query(
          `UPDATE onetime.class_occurrences
              SET access_state = 'provider_unavailable', updated_at = now()
            WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3`,
          [args.account_key, args.product_key, args.occurrence_key],
        );
      });
    },
    failDelete: async (args) => {
      await pool.query(
        `UPDATE onetime.zoom_class_occurrence_resources
            SET resource_state = $5,
                last_error_code = $6,
                last_error_message = $7,
                updated_at = now()
          WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3
            AND delete_idempotency_key = $4 AND resource_state = 'deleting'`,
        [
          args.account_key,
          args.product_key,
          args.occurrence_key,
          args.idempotency_key,
          args.outcome_unknown ? 'delete_unknown' : 'active',
          args.error_code,
          args.error_message,
        ],
      );
    },
  };
}

async function getOccurrence(
  queryable: Queryable,
  scope: { account_key: string; product_key: string },
  occurrenceKey: string,
): Promise<ZoomClassOccurrenceRecord | null> {
  const result = await queryable.query(
    `SELECT occurrences.occurrence_key, series.title, occurrences.starts_at,
            occurrences.duration_minutes, occurrences.is_operator_test,
            occurrences.operator_test_environment
       FROM onetime.class_occurrences AS occurrences
       JOIN onetime.class_series AS series
         ON series.account_key = occurrences.account_key
        AND series.product_key = occurrences.product_key
        AND series.class_series_key = occurrences.class_series_key
      WHERE occurrences.account_key = $1
        AND occurrences.product_key = $2
        AND occurrences.occurrence_key = $3
      LIMIT 1`,
    [scope.account_key, scope.product_key, occurrenceKey],
  );
  if (!result.rows[0]) return null;
  return {
    occurrence_key: String(result.rows[0].occurrence_key),
    title: String(result.rows[0].title),
    starts_at: new Date(String(result.rows[0].starts_at)),
    duration_minutes: Number(result.rows[0].duration_minutes),
    is_operator_test: result.rows[0].is_operator_test === true,
    operator_test_environment:
      result.rows[0].operator_test_environment === null
        ? null
        : String(result.rows[0].operator_test_environment),
  } as ZoomClassOccurrenceRecord;
}

async function getResource(
  queryable: Queryable,
  scope: { account_key: string; product_key: string },
  occurrenceKey: string,
  forUpdate = false,
): Promise<ZoomClassOccurrenceResourceRecord | null> {
  const result = await queryable.query(
    `SELECT resource_key, account_key, product_key, occurrence_key, environment, purpose,
            resource_state, provider_meeting_ref_digest, provider_meeting_ciphertext,
            meeting_password_ciphertext, meeting_topic, meeting_starts_at,
            meeting_duration_minutes, created_by_user_ref, provision_idempotency_key,
            delete_idempotency_key, last_error_code, last_error_message
       FROM onetime.zoom_class_occurrence_resources
      WHERE account_key = $1 AND product_key = $2 AND occurrence_key = $3
      ${forUpdate ? 'FOR UPDATE' : ''}`,
    [scope.account_key, scope.product_key, occurrenceKey],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapResource(row) : null;
}

async function requireResource(
  queryable: Queryable,
  scope: { account_key: string; product_key: string },
  occurrenceKey: string,
  forUpdate = false,
) {
  const record = await getResource(queryable, scope, occurrenceKey, forUpdate);
  if (!record) throw new Error('Zoom occurrence resource was not found.');
  return record;
}

async function getRegistrant(
  queryable: Queryable,
  scope: { account_key: string; product_key: string },
  occurrenceKey: string,
  learnerKey: string,
): Promise<ZoomClassRegistrantRecord | null> {
  const result = await queryable.query(
    `SELECT household_key, learner_key, provider_registrant_ref_digest,
            registrant_token_ref, registrant_token_ciphertext, registration_state
       FROM onetime.classroom_zoom_registrants
      WHERE account_key = $1 AND product_key = $2
        AND occurrence_key = $3 AND learner_key = $4
      LIMIT 1`,
    [scope.account_key, scope.product_key, occurrenceKey, learnerKey],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    household_key: String(row.household_key),
    learner_key: String(row.learner_key),
    provider_registrant_ref_digest: String(row.provider_registrant_ref_digest),
    registrant_token_ref: String(row.registrant_token_ref),
    registrant_token_ciphertext:
      row.registrant_token_ciphertext === null ? null : String(row.registrant_token_ciphertext),
    registration_state: row.registration_state as ZoomClassRegistrantRecord['registration_state'],
  };
}

function mapResource(row: Record<string, unknown>): ZoomClassOccurrenceResourceRecord {
  return {
    resource_key: String(row.resource_key),
    account_key: String(row.account_key),
    product_key: String(row.product_key),
    occurrence_key: String(row.occurrence_key),
    environment: row.environment as ZoomClassOccurrenceResourceRecord['environment'],
    purpose: row.purpose as ZoomClassOccurrenceResourceRecord['purpose'],
    resource_state: row.resource_state as ZoomClassOccurrenceResourceRecord['resource_state'],
    provider_meeting_ref_digest: nullableString(row.provider_meeting_ref_digest),
    provider_meeting_ciphertext: nullableString(row.provider_meeting_ciphertext),
    meeting_password_ciphertext: nullableString(row.meeting_password_ciphertext),
    meeting_topic: String(row.meeting_topic),
    meeting_starts_at: new Date(String(row.meeting_starts_at)),
    meeting_duration_minutes: Number(row.meeting_duration_minutes),
    created_by_user_ref: String(row.created_by_user_ref),
    provision_idempotency_key: String(row.provision_idempotency_key),
    delete_idempotency_key: nullableString(row.delete_idempotency_key),
    last_error_code: nullableString(row.last_error_code),
    last_error_message: nullableString(row.last_error_message),
  };
}

function nullableString(value: unknown) {
  return value === null || value === undefined ? null : String(value);
}
