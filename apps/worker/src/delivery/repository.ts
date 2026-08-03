import { createHash } from 'node:crypto';
import type {
  ClaimedDelivery,
  ClaimBatchInput,
  DeliveryContact,
  DeliveryFailure,
  DeliveryLeadStatus,
  DeliveryOutcome,
  DeliveryProviderName,
  DeliveryProviderOperation,
  DeliveryRepository,
  DeliverySignup,
  ProviderReceipt,
} from '../../../../packages/contracts/src/delivery/types.ts';
import { sanitizeFailureCode } from '../../../../packages/domain/src/delivery/retry.ts';

type SqlRow = Record<string, unknown>;
type SqlResult<Row extends SqlRow = SqlRow> = {
  rows: Row[];
  rowCount: number | null;
};

export interface DeliverySqlClient {
  query<Row extends SqlRow = SqlRow>(text: string, values?: unknown[]): Promise<SqlResult<Row>>;
  release(): void;
}

export interface DeliverySqlPool {
  connect(): Promise<DeliverySqlClient>;
}

export const CLAIM_BATCH_SQL = `
WITH candidates AS (
  SELECT outbox.id
    FROM onetime.outbox_events AS outbox
   WHERE outbox.account_key = $1
     AND outbox.product_key = $2
     AND outbox.transport_mode = $3
     AND (
       (outbox.status = 'pending' AND outbox.next_attempt_at <= $4::timestamptz)
       OR
       (outbox.status = 'processing' AND outbox.next_attempt_at <= $4::timestamptz)
     )
     AND (
        (outbox.event_type = 'family_signup_email_ack.v1' AND outbox.channel = 'email')
        OR
        (outbox.event_type = 'family_signup_whatsapp_confirmation.v1' AND outbox.channel = 'whatsapp')
        OR
        (outbox.event_type = 'family_class_reminder_email.v1' AND outbox.channel = 'email')
        OR
        (outbox.event_type = 'family_class_reminder_whatsapp.v1' AND outbox.channel = 'whatsapp')
        OR
        (outbox.event_type = 'internal_lead_alert' AND outbox.channel = 'internal_email')
     )
   ORDER BY outbox.next_attempt_at ASC, outbox.created_at ASC, outbox.id ASC
   LIMIT $5
   FOR UPDATE SKIP LOCKED
), claimed AS (
  UPDATE onetime.outbox_events AS outbox
     SET status = 'processing',
         attempts = outbox.attempts + 1,
         next_attempt_at = $6::timestamptz
    FROM candidates
   WHERE outbox.id = candidates.id
     AND outbox.account_key = $1
     AND outbox.product_key = $2
     AND outbox.transport_mode = $3
  RETURNING outbox.*
)
SELECT
  claimed.id,
  claimed.delivery_key,
  claimed.account_key,
  claimed.product_key,
  claimed.contact_key,
  claimed.signup_key,
  claimed.event_type,
  claimed.channel,
  claimed.transport_mode,
  claimed.payload,
  claimed.attempts,
  claimed.created_at,
  claimed.next_attempt_at AS claim_lease_expires_at,
  claimed.provider_operation_state,
  claimed.provider_operation_provider,
  claimed.provider_operation_idempotency_key,
  claimed.provider_acceptance_ref_hash,
  claimed.provider_operation_dispatched_at,
  claimed.provider_operation_accepted_at,
  claimed.provider_operation_updated_at,
  contact.display_name,
  contact.family_school_classification,
  contact.family_or_school,
  contact.location_text,
  contact.timezone,
  contact.email_normalized,
  contact.phone_normalized,
  contact.reminder_preference,
  contact.consent_recorded_at,
  contact.suppression_state,
  contact.lead_status,
  contact.archived_at,
  signup.classification AS signup_classification,
  signup.status AS signup_status,
  signup.metadata AS signup_metadata
FROM claimed
LEFT JOIN onetime.contacts AS contact
  ON contact.contact_key = claimed.contact_key
 AND contact.account_key = claimed.account_key
 AND contact.product_key = claimed.product_key
LEFT JOIN onetime.signup_leads AS signup
  ON signup.signup_key = claimed.signup_key
 AND signup.account_key = claimed.account_key
 AND signup.product_key = claimed.product_key
ORDER BY claimed.next_attempt_at ASC, claimed.created_at ASC, claimed.id ASC
`;

const COMPLETE_CLAIM_SQL = `
UPDATE onetime.outbox_events
   SET status = $2,
       next_attempt_at = $3::timestamptz,
       delivered_at = $4::timestamptz
 WHERE id = $1
   AND account_key = $7
   AND product_key = $8
   AND transport_mode = $9
   AND status = 'processing'
   AND next_attempt_at = $5::timestamptz
   AND next_attempt_at > $6::timestamptz
RETURNING delivery_key
`;

const READ_PROVIDER_OPERATION_SQL = `
SELECT
  provider_operation_state,
  provider_operation_provider,
  provider_operation_idempotency_key,
  provider_acceptance_ref_hash,
  provider_operation_dispatched_at,
  provider_operation_accepted_at,
  provider_operation_updated_at
FROM onetime.outbox_events
WHERE id = $1
  AND account_key = $2
  AND product_key = $3
  AND transport_mode = $4
  AND status = 'processing'
  AND next_attempt_at = $5::timestamptz
  AND next_attempt_at > $6::timestamptz
FOR UPDATE
`;

const BEGIN_PROVIDER_OPERATION_SQL = `
UPDATE onetime.outbox_events
   SET provider_operation_state = 'in_flight',
       provider_operation_provider = $7,
       provider_operation_idempotency_key = $8,
       provider_acceptance_ref_hash = NULL,
       provider_operation_dispatched_at = COALESCE(provider_operation_dispatched_at, $6::timestamptz),
       provider_operation_accepted_at = NULL,
       provider_operation_updated_at = $6::timestamptz
 WHERE id = $1
   AND account_key = $2
   AND product_key = $3
   AND transport_mode = $4
   AND status = 'processing'
   AND next_attempt_at = $5::timestamptz
   AND next_attempt_at > $6::timestamptz
RETURNING delivery_key
`;

const QUARANTINE_PROVIDER_OPERATION_SQL = `
UPDATE onetime.outbox_events
   SET provider_operation_state = 'acceptance_unknown',
       provider_operation_updated_at = $6::timestamptz
 WHERE id = $1
   AND account_key = $2
   AND product_key = $3
   AND transport_mode = $4
   AND status = 'processing'
   AND next_attempt_at = $5::timestamptz
   AND next_attempt_at > $6::timestamptz
RETURNING delivery_key
`;

const ACCEPT_PROVIDER_OPERATION_SQL = `
UPDATE onetime.outbox_events
   SET provider_operation_state = 'accepted',
       provider_acceptance_ref_hash = $9,
       provider_operation_accepted_at = $6::timestamptz,
       provider_operation_updated_at = $6::timestamptz
 WHERE id = $1
   AND account_key = $2
   AND product_key = $3
   AND transport_mode = $4
   AND status = 'processing'
   AND next_attempt_at = $5::timestamptz
   AND next_attempt_at > $6::timestamptz
   AND provider_operation_provider = $7
   AND provider_operation_idempotency_key = $8
   AND provider_operation_state = 'in_flight'
RETURNING delivery_key
`;

const REJECT_PROVIDER_OPERATION_SQL = `
UPDATE onetime.outbox_events
   SET provider_operation_state = $9,
       provider_acceptance_ref_hash = NULL,
       provider_operation_accepted_at = NULL,
       provider_operation_updated_at = $6::timestamptz
 WHERE id = $1
   AND account_key = $2
   AND product_key = $3
   AND transport_mode = $4
   AND status = 'processing'
   AND next_attempt_at = $5::timestamptz
   AND next_attempt_at > $6::timestamptz
   AND provider_operation_provider = $7
   AND provider_operation_idempotency_key = $8
   AND provider_operation_state = 'in_flight'
RETURNING delivery_key
`;

function asString(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '');
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return asString(value);
}

function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  const parsed = new Date(asString(value));
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Database returned an invalid delivery timestamp.');
  }
  return parsed;
}

function asNullableDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  return asDate(value);
}

function asProviderName(value: unknown): DeliveryProviderName | null {
  const provider = asNullableString(value);
  return provider === 'resend' || provider === 'one_time_wapi' ? provider : null;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function parseContact(row: SqlRow): DeliveryContact | null {
  if (row.display_name === null || row.display_name === undefined) return null;
  const reminderPreference = asString(row.reminder_preference);
  const leadStatus = asString(row.lead_status);
  return {
    contactKey: asString(row.contact_key),
    displayName: asString(row.display_name),
    familySchoolClassification:
      asString(row.family_school_classification) === 'school' ? 'school' : 'family',
    familyOrSchool: asString(row.family_or_school),
    locationText: asString(row.location_text),
    timezone: asString(row.timezone),
    emailNormalized: asString(row.email_normalized),
    phoneNormalized: asNullableString(row.phone_normalized),
    reminderPreference: ['email', 'whatsapp', 'both', 'none'].includes(reminderPreference)
      ? (reminderPreference as DeliveryContact['reminderPreference'])
      : 'none',
    consentRecordedAt:
      row.consent_recorded_at === null || row.consent_recorded_at === undefined
        ? null
        : asDate(row.consent_recorded_at),
    suppressionState: asString(row.suppression_state),
    leadStatus: ['new', 'in_review', 'contacted', 'scheduled', 'closed', 'archived'].includes(
      leadStatus,
    )
      ? (leadStatus as DeliveryLeadStatus)
      : 'new',
    archivedAt:
      row.archived_at === null || row.archived_at === undefined ? null : asDate(row.archived_at),
  };
}

function parseSignup(row: SqlRow): DeliverySignup | null {
  if (!row.signup_key || !row.signup_classification) return null;
  return {
    signupKey: asString(row.signup_key),
    classification: asString(row.signup_classification) === 'school' ? 'school' : 'family',
    status: asString(row.signup_status),
    metadata: asObject(row.signup_metadata),
  };
}

function parseClaim(row: SqlRow): ClaimedDelivery {
  const channel = asString(row.channel);
  if (channel !== 'email' && channel !== 'whatsapp' && channel !== 'internal_email') {
    throw new Error('Database returned an unsupported delivery channel.');
  }
  return {
    id: asString(row.id),
    deliveryKey: asString(row.delivery_key),
    accountKey: asString(row.account_key),
    productKey: asString(row.product_key),
    contactKey: asNullableString(row.contact_key),
    signupKey: asNullableString(row.signup_key),
    eventType: asString(row.event_type),
    channel,
    transportMode: asString(row.transport_mode),
    payload: asObject(row.payload),
    attempts: Number(row.attempts ?? 0),
    createdAt: asDate(row.created_at),
    claimLeaseExpiresAt: asDate(row.claim_lease_expires_at),
    providerOperation: {
      state: ['not_started', 'in_flight', 'accepted', 'rejected', 'acceptance_unknown'].includes(
        asString(row.provider_operation_state),
      )
        ? (asString(row.provider_operation_state) as ClaimedDelivery['providerOperation']['state'])
        : 'not_started',
      provider: asProviderName(row.provider_operation_provider),
      idempotencyKey: asNullableString(row.provider_operation_idempotency_key),
      acceptanceRefHash: asNullableString(row.provider_acceptance_ref_hash),
      dispatchedAt: asNullableDate(row.provider_operation_dispatched_at),
      acceptedAt: asNullableDate(row.provider_operation_accepted_at),
      updatedAt: asNullableDate(row.provider_operation_updated_at),
    },
    contact: parseContact(row),
    signup: parseSignup(row),
  };
}

function outcomeColumns(outcome: DeliveryOutcome): {
  status: string;
  nextAttemptAt: Date;
  deliveredAt: Date | null;
} {
  if (outcome.kind === 'delivered') {
    return {
      status: outcome.receipt.sink ? 'sink_delivered' : 'delivered',
      nextAttemptAt: outcome.at,
      deliveredAt: outcome.at,
    };
  }
  if (outcome.kind === 'retry') {
    return {
      status: 'pending',
      nextAttemptAt: outcome.nextAttemptAt,
      deliveredAt: null,
    };
  }
  if (outcome.kind === 'acceptance_unknown') {
    return {
      status: 'acceptance_unknown',
      nextAttemptAt: outcome.at,
      deliveredAt: null,
    };
  }
  return {
    status: outcome.kind,
    nextAttemptAt: outcome.at,
    deliveredAt: null,
  };
}

function resultMetadata(claim: ClaimedDelivery, outcome: DeliveryOutcome): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    delivery_ref: createHash('sha256').update(claim.deliveryKey).digest('hex').slice(0, 16),
    channel: claim.channel,
    source_event_type: claim.eventType,
    attempt: claim.attempts,
    result: outcome.kind,
  };
  if (outcome.kind === 'delivered') {
    metadata.provider = outcome.receipt.provider;
    metadata.sink = outcome.receipt.sink;
    if (outcome.receipt.messageId) {
      metadata.provider_message_ref = createHash('sha256')
        .update(outcome.receipt.messageId)
        .digest('hex')
        .slice(0, 16);
    }
  } else if (
    outcome.kind === 'retry' ||
    outcome.kind === 'dead_lettered' ||
    outcome.kind === 'acceptance_unknown'
  ) {
    metadata.failure_code = sanitizeFailureCode(outcome.failure.code);
    metadata.failure_category = outcome.failure.category;
    if (outcome.failure.provider) metadata.provider = outcome.failure.provider;
    if (outcome.failure.httpStatus !== undefined) metadata.http_status = outcome.failure.httpStatus;
  } else {
    metadata.reason = outcome.reason;
  }
  return metadata;
}

function auditEventKey(claim: ClaimedDelivery, outcome: DeliveryOutcome): string {
  const digest = createHash('sha256')
    .update(`${claim.deliveryKey}\0${claim.attempts}\0${outcome.kind}`)
    .digest('hex')
    .slice(0, 24);
  return `delivery_result_${digest}`;
}

export class PostgresDeliveryRepository implements DeliveryRepository {
  constructor(private readonly pool: DeliverySqlPool) {}

  async claimBatch(input: ClaimBatchInput): Promise<ClaimedDelivery[]> {
    const client = await this.pool.connect();
    const leaseExpiresAt = new Date(input.now.getTime() + input.leaseMs);
    try {
      await client.query('BEGIN');
      const result = await client.query(CLAIM_BATCH_SQL, [
        input.accountKey,
        input.productKey,
        input.transportMode,
        input.now,
        input.limit,
        leaseExpiresAt,
      ]);
      await client.query('COMMIT');
      return result.rows.map(parseClaim);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async complete(claim: ClaimedDelivery, outcome: DeliveryOutcome): Promise<boolean> {
    const client = await this.pool.connect();
    const columns = outcomeColumns(outcome);
    try {
      await client.query('BEGIN');
      const updated = await client.query(COMPLETE_CLAIM_SQL, [
        claim.id,
        columns.status,
        columns.nextAttemptAt,
        columns.deliveredAt,
        claim.claimLeaseExpiresAt,
        outcome.at,
        claim.accountKey,
        claim.productKey,
        claim.transportMode,
      ]);
      if (!updated.rowCount) {
        await client.query('COMMIT');
        return false;
      }

      await client.query(
        `INSERT INTO onetime.audit_events
          (event_key, account_key, product_key, contact_key, signup_key, event_type, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
         ON CONFLICT (event_key) DO NOTHING`,
        [
          auditEventKey(claim, outcome),
          claim.accountKey,
          claim.productKey,
          claim.contactKey,
          claim.signupKey,
          `delivery_${columns.status}`,
          JSON.stringify(resultMetadata(claim, outcome)),
        ],
      );
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async beginProviderOperation(
    claim: ClaimedDelivery,
    operation: DeliveryProviderOperation,
    at: Date,
  ): Promise<
    | { kind: 'dispatch' }
    | { kind: 'accepted'; receipt: ProviderReceipt }
    | { kind: 'acceptance_unknown' }
    | { kind: 'lease_lost' }
  > {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(READ_PROVIDER_OPERATION_SQL, claimFenceValues(claim, at));
      const row = current.rows[0];
      if (!row) {
        await client.query('COMMIT');
        return { kind: 'lease_lost' };
      }
      const state = asString(row.provider_operation_state);
      const provider = asProviderName(row.provider_operation_provider);
      const idempotencyKey = asNullableString(row.provider_operation_idempotency_key);
      if (
        (provider && provider !== operation.provider) ||
        (idempotencyKey && idempotencyKey !== operation.idempotencyKey)
      ) {
        await client.query('COMMIT');
        return { kind: 'acceptance_unknown' };
      }
      if (state === 'accepted') {
        const acceptanceRefHash = asNullableString(row.provider_acceptance_ref_hash);
        const acceptedAt = asNullableDate(row.provider_operation_accepted_at);
        await client.query('COMMIT');
        if (!acceptanceRefHash || !acceptedAt) return { kind: 'acceptance_unknown' };
        return {
          kind: 'accepted',
          receipt: {
            provider: operation.provider,
            messageId: acceptanceRefHash,
            acceptedAt,
            sink: false,
          },
        };
      }
      if (
        (state === 'in_flight' || state === 'acceptance_unknown') &&
        operation.acceptanceRecovery !== 'retry_same_key'
      ) {
        await client.query(QUARANTINE_PROVIDER_OPERATION_SQL, claimFenceValues(claim, at));
        await client.query('COMMIT');
        return { kind: 'acceptance_unknown' };
      }
      const updated = await client.query(BEGIN_PROVIDER_OPERATION_SQL, [
        ...claimFenceValues(claim, at),
        operation.provider,
        operation.idempotencyKey,
      ]);
      await client.query('COMMIT');
      return updated.rowCount ? { kind: 'dispatch' } : { kind: 'lease_lost' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async recordProviderAccepted(
    claim: ClaimedDelivery,
    operation: DeliveryProviderOperation,
    receipt: ProviderReceipt,
    at: Date,
  ): Promise<boolean> {
    const acceptanceRefHash = createHash('sha256')
      .update(receipt.messageId ?? `${operation.provider}:${operation.idempotencyKey}`)
      .digest('hex');
    return this.transitionProviderOperation(
      ACCEPT_PROVIDER_OPERATION_SQL,
      claim,
      operation,
      at,
      acceptanceRefHash,
    );
  }

  async recordProviderRejected(
    claim: ClaimedDelivery,
    operation: DeliveryProviderOperation,
    failure: DeliveryFailure,
    at: Date,
  ): Promise<boolean> {
    void failure;
    return this.transitionProviderOperation(
      REJECT_PROVIDER_OPERATION_SQL,
      claim,
      operation,
      at,
      'rejected',
    );
  }

  async recordProviderAcceptanceUnknown(
    claim: ClaimedDelivery,
    operation: DeliveryProviderOperation,
    failure: DeliveryFailure,
    at: Date,
  ): Promise<boolean> {
    void failure;
    return this.transitionProviderOperation(
      REJECT_PROVIDER_OPERATION_SQL,
      claim,
      operation,
      at,
      'acceptance_unknown',
    );
  }

  private async transitionProviderOperation(
    sql: string,
    claim: ClaimedDelivery,
    operation: DeliveryProviderOperation,
    at: Date,
    value: string,
  ): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, [
        ...claimFenceValues(claim, at),
        operation.provider,
        operation.idempotencyKey,
        value,
      ]);
      return Boolean(result.rowCount);
    } finally {
      client.release();
    }
  }
}

function claimFenceValues(claim: ClaimedDelivery, at: Date): unknown[] {
  return [
    claim.id,
    claim.accountKey,
    claim.productKey,
    claim.transportMode,
    claim.claimLeaseExpiresAt,
    at,
  ];
}
