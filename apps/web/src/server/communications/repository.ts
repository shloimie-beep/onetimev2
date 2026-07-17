import type { DbPool } from '../../../../../packages/db/src/index.ts';
import type {
  CommunicationContactLookupInput,
  CommunicationIntentListInput,
  CommunicationIntentListResult,
  CommunicationIntentRow,
  CommunicationsReadRepository,
} from '../../../../../packages/domain/src/communications/service.ts';

type SqlRow = Record<string, unknown>;

export class PostgresCommunicationsReadRepository implements CommunicationsReadRepository {
  constructor(private readonly pool: DbPool) {}

  async contactExists(input: CommunicationContactLookupInput): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1
         FROM onetime.contacts
        WHERE account_key = $1
          AND product_key = $2
          AND contact_key = $3
        LIMIT 1`,
      [input.scope.accountKey, input.scope.productKey, input.contactId],
    );
    return result.rows.length > 0;
  }

  async list(input: CommunicationIntentListInput): Promise<CommunicationIntentListResult> {
    const params: unknown[] = [
      input.scope.accountKey,
      input.scope.productKey,
      input.filters.from,
      input.filters.to,
    ];
    const where = [
      'history.account_key = $1',
      'history.product_key = $2',
      'history.occurred_at >= $3::timestamptz',
      'history.occurred_at < $4::timestamptz',
    ];
    if (input.mode.kind === 'contact') {
      params.push(input.mode.contactId);
      where.push(`history.contact_key = $${params.length}`);
    }
    if (input.filters.channel) {
      params.push(input.filters.channel);
      where.push(`history.channel = $${params.length}`);
    }
    if (input.filters.direction) {
      params.push(input.filters.direction);
      where.push(`history.direction = $${params.length}`);
    }
    if (input.rawEventType) {
      params.push(input.rawEventType);
      where.push(`history.event_type = $${params.length}`);
    }
    if (input.filters.source) {
      params.push(input.filters.source);
      where.push(`history.source = $${params.length}`);
    }
    if (input.filters.status) {
      params.push(input.filters.status);
      where.push(`history.local_state = $${params.length}`);
    }
    if (input.cursor) {
      params.push(input.cursor.lastCreatedAt, input.cursor.lastId);
      where.push(
        `(history.occurred_at < $${params.length - 1}::timestamptz OR (history.occurred_at = $${params.length - 1}::timestamptz AND history.id < $${params.length}))`,
      );
    }
    params.push(input.filters.limit + 1);
    const result = await this.pool.query(
      `WITH history AS (
          SELECT events.event_key AS id,
                 events.account_key,
                 events.product_key,
                 events.contact_key,
                 events.household_key,
                 events.thread_key AS thread_id,
                 COALESCE(threads.display_label, 'Canonical communication history') AS thread_label,
                 events.event_kind AS event_type,
                 events.channel,
                 events.direction,
                 events.truthful_state AS status,
                 CASE
                   WHEN events.event_kind = 'crm_single_recipient_reply_draft.v1' THEN 'draft_saved'
                   WHEN events.truthful_state = 'pending' THEN 'queued'
                   WHEN events.truthful_state = 'sent' THEN 'provider_sent'
                   WHEN events.truthful_state = 'durable' THEN 'received'
                   WHEN events.truthful_state IN ('processing_failed', 'dead_lettered', 'retriable_failure') THEN 'failed'
                   WHEN events.truthful_state IN ('queued', 'provider_accepted', 'provider_sent', 'delivered', 'read', 'received', 'processed', 'failed', 'bounced', 'complained', 'suppressed', 'draft_saved', 'duplicate', 'history_unavailable') THEN events.truthful_state
                   ELSE 'unknown'
                 END AS local_state,
                 events.occurred_at,
                 events.occurred_at AS created_at,
                 events.occurred_at AS delivered_at,
                 contact.email_normalized,
                 contact.phone_normalized,
                 events.source,
                 events.provenance,
                 events.redacted_preview AS preview_redacted,
                 events.provider_reference_digest,
                 events.import_batch_key,
                 events.idempotency_key,
                 CASE WHEN events.event_kind = 'crm_single_recipient_reply_draft.v1' THEN true ELSE false END AS draft_only,
                 events.transport_available,
                 'contact' AS participant_kind,
                 'Linked contact' AS participant_label
            FROM onetime.communication_history_events AS events
            LEFT JOIN onetime.communication_threads AS threads
              ON threads.account_key = events.account_key
             AND threads.product_key = events.product_key
             AND threads.thread_key = events.thread_key
            LEFT JOIN onetime.contacts AS contact
              ON contact.contact_key = events.contact_key
             AND contact.account_key = events.account_key
             AND contact.product_key = events.product_key
          UNION ALL
          SELECT 'outbox:' || outbox.delivery_key AS id,
                 outbox.account_key,
                 outbox.product_key,
                 outbox.contact_key,
                 NULL::text AS household_key,
                 COALESCE('contact:' || outbox.contact_key || ':' || outbox.channel, 'outbox:' || outbox.delivery_key) AS thread_id,
                 CASE WHEN outbox.contact_key IS NULL THEN 'Unlinked outbound intent' ELSE 'Contact outbound history' END AS thread_label,
                 outbox.event_type,
                 outbox.channel,
                 CASE WHEN outbox.channel = 'internal_email' THEN 'internal' ELSE 'outbound' END AS direction,
                 CASE
                   WHEN outbox.event_type = 'crm_single_recipient_reply_draft.v1' THEN 'draft_saved'
                   ELSE outbox.status
                 END AS status,
                 CASE
                   WHEN outbox.event_type = 'crm_single_recipient_reply_draft.v1' THEN 'draft_saved'
                   WHEN outbox.status = 'pending' THEN 'queued'
                   WHEN outbox.status = 'sent' THEN 'provider_sent'
                   WHEN outbox.status = 'durable' THEN 'received'
                   WHEN outbox.status IN ('processing_failed', 'dead_lettered', 'retriable_failure') THEN 'failed'
                   WHEN outbox.status IN ('queued', 'provider_accepted', 'provider_sent', 'delivered', 'read', 'received', 'processed', 'failed', 'bounced', 'complained', 'suppressed', 'draft_saved', 'duplicate', 'history_unavailable') THEN outbox.status
                   ELSE 'unknown'
                 END AS local_state,
                 outbox.created_at AS occurred_at,
                 outbox.created_at,
                 outbox.delivered_at,
                 contact.email_normalized,
                 contact.phone_normalized,
                 CASE
                   WHEN outbox.event_type = 'crm_single_recipient_reply_draft.v1' THEN 'crm_reply_draft'
                   ELSE 'local_outbox_intent'
                 END AS source,
                 'local_database' AS provenance,
                 CASE
                   WHEN outbox.event_type = 'crm_single_recipient_reply_draft.v1'
                     THEN 'Provider-off reply draft saved locally. Message body is hidden.'
                   ELSE 'Outbound intent stored locally. Provider delivery is not implied.'
                 END AS preview_redacted,
                 NULL::text AS provider_reference_digest,
                 NULL::text AS import_batch_key,
                 outbox.delivery_key AS idempotency_key,
                 CASE WHEN outbox.event_type = 'crm_single_recipient_reply_draft.v1' THEN true ELSE false END AS draft_only,
                 false AS transport_available,
                 CASE WHEN outbox.contact_key IS NULL THEN 'unknown' ELSE 'contact' END AS participant_kind,
                 CASE WHEN outbox.contact_key IS NULL THEN 'Unlinked participant' ELSE 'Linked contact' END AS participant_label
            FROM onetime.outbox_events AS outbox
            LEFT JOIN onetime.contacts AS contact
              ON contact.contact_key = outbox.contact_key
             AND contact.account_key = outbox.account_key
             AND contact.product_key = outbox.product_key
          UNION ALL
          SELECT 'whatsapp-inbox:' || inbox.event_key AS id,
                 inbox.account_key,
                 inbox.product_key,
                 conversations.contact_key,
                 conversations.verified_household_key AS household_key,
                 'whatsapp:' || conversations.conversation_key AS thread_id,
                 'WhatsApp conversation history' AS thread_label,
                 'whatsapp_inbound_message.v1' AS event_type,
                 'whatsapp' AS channel,
                 'inbound' AS direction,
                 CASE
                   WHEN inbox.status = 'durable' THEN 'received'
                   WHEN inbox.status = 'processing_failed' THEN 'failed'
                   WHEN inbox.status = 'dead_lettered' THEN 'failed'
                   ELSE inbox.status
                 END AS status,
                 CASE
                   WHEN inbox.status = 'durable' THEN 'received'
                   WHEN inbox.status = 'processing_failed' THEN 'failed'
                   WHEN inbox.status = 'dead_lettered' THEN 'failed'
                   WHEN inbox.status = 'processed' THEN 'processed'
                   WHEN inbox.status = 'duplicate' THEN 'duplicate'
                   ELSE 'unknown'
                 END AS local_state,
                 COALESCE(inbox.provider_timestamp, inbox.received_at) AS occurred_at,
                 inbox.received_at AS created_at,
                 inbox.processed_at AS delivered_at,
                 contact.email_normalized,
                 contact.phone_normalized,
                 'stored_whatsapp_webhook' AS source,
                 'stored_webhook' AS provenance,
                 'Inbound WhatsApp message was stored. Body is encrypted and hidden.' AS preview_redacted,
                 inbox.provider_message_ref_hash AS provider_reference_digest,
                 NULL::text AS import_batch_key,
                 inbox.event_key AS idempotency_key,
                 false AS draft_only,
                 false AS transport_available,
                 CASE
                   WHEN conversations.contact_key IS NOT NULL THEN 'contact'
                   WHEN conversations.verified_household_key IS NOT NULL THEN 'household'
                   ELSE 'unknown'
                 END AS participant_kind,
                 CASE
                   WHEN conversations.contact_key IS NOT NULL THEN 'Linked contact'
                   WHEN conversations.verified_household_key IS NOT NULL THEN 'Linked household'
                   ELSE 'WhatsApp participant'
                 END AS participant_label
            FROM onetime.whatsapp_inbox_events AS inbox
            JOIN onetime.whatsapp_conversations AS conversations
              ON conversations.conversation_key = inbox.conversation_key
             AND conversations.account_key = inbox.account_key
             AND conversations.product_key = inbox.product_key
            LEFT JOIN onetime.contacts AS contact
              ON contact.contact_key = conversations.contact_key
             AND contact.account_key = inbox.account_key
             AND contact.product_key = inbox.product_key
          UNION ALL
          SELECT 'whatsapp-delivery:' || delivery.delivery_event_key AS id,
                 delivery.account_key,
                 delivery.product_key,
                 conversations.contact_key,
                 conversations.verified_household_key AS household_key,
                 'whatsapp:' || conversations.conversation_key AS thread_id,
                 'WhatsApp conversation history' AS thread_label,
                 'whatsapp_provider_delivery_event.v1' AS event_type,
                 'whatsapp' AS channel,
                 'outbound' AS direction,
                 CASE
                   WHEN delivery.status = 'accepted' THEN 'provider_accepted'
                   WHEN delivery.status = 'sent' THEN 'sent'
                   WHEN delivery.status = 'retriable_failure' THEN 'failed'
                   WHEN delivery.status = 'dead_lettered' THEN 'failed'
                   ELSE delivery.status
                 END AS status,
                 CASE
                   WHEN delivery.status = 'accepted' THEN 'provider_accepted'
                   WHEN delivery.status = 'sent' THEN 'provider_sent'
                   WHEN delivery.status = 'retriable_failure' THEN 'failed'
                   WHEN delivery.status = 'dead_lettered' THEN 'failed'
                   WHEN delivery.status IN ('delivered', 'read', 'failed', 'suppressed') THEN delivery.status
                   ELSE 'unknown'
                 END AS local_state,
                 delivery.occurred_at,
                 delivery.occurred_at AS created_at,
                 delivery.occurred_at AS delivered_at,
                 contact.email_normalized,
                 contact.phone_normalized,
                 'stored_provider_delivery_event' AS source,
                 'stored_provider_event' AS provenance,
                 'Stored WhatsApp provider status. Message body is hidden.' AS preview_redacted,
                 COALESCE(delivery.provider_event_ref_hash, outbox.provider_message_ref_hash) AS provider_reference_digest,
                 NULL::text AS import_batch_key,
                 delivery.delivery_event_key AS idempotency_key,
                 false AS draft_only,
                 false AS transport_available,
                 CASE
                   WHEN conversations.contact_key IS NOT NULL THEN 'contact'
                   WHEN conversations.verified_household_key IS NOT NULL THEN 'household'
                   ELSE 'unknown'
                 END AS participant_kind,
                 CASE
                   WHEN conversations.contact_key IS NOT NULL THEN 'Linked contact'
                   WHEN conversations.verified_household_key IS NOT NULL THEN 'Linked household'
                   ELSE 'WhatsApp participant'
                 END AS participant_label
            FROM onetime.whatsapp_delivery_events AS delivery
            LEFT JOIN onetime.whatsapp_outbox_messages AS outbox
              ON outbox.outbox_message_key = delivery.outbox_message_key
             AND outbox.account_key = delivery.account_key
             AND outbox.product_key = delivery.product_key
            LEFT JOIN onetime.whatsapp_conversations AS conversations
              ON conversations.conversation_key = outbox.conversation_key
             AND conversations.account_key = delivery.account_key
             AND conversations.product_key = delivery.product_key
            LEFT JOIN onetime.contacts AS contact
              ON contact.contact_key = conversations.contact_key
             AND contact.account_key = delivery.account_key
             AND contact.product_key = delivery.product_key
        )
        SELECT history.*
          FROM history
        WHERE ${where.join(' AND ')}
        ORDER BY history.occurred_at DESC, history.id DESC
        LIMIT $${params.length}`,
      params,
    );
    return {
      sourceAvailable: true,
      rows: result.rows.map(rowToIntent),
    };
  }
}

function rowToIntent(row: SqlRow): CommunicationIntentRow {
  return {
    id: String(row.id),
    accountKey: String(row.account_key),
    productKey: String(row.product_key),
    contactKey: nullableString(row.contact_key),
    eventType: String(row.event_type),
    channel: String(row.channel),
    status: nullableString(row.status),
    createdAt: row.created_at instanceof Date ? row.created_at : String(row.created_at),
    occurredAt:
      row.occurred_at === null || row.occurred_at === undefined
        ? null
        : row.occurred_at instanceof Date
          ? row.occurred_at
          : String(row.occurred_at),
    deliveredAt:
      row.delivered_at === null || row.delivered_at === undefined
        ? null
        : row.delivered_at instanceof Date
          ? row.delivered_at
          : String(row.delivered_at),
    emailNormalized: nullableString(row.email_normalized),
    phoneNormalized: nullableString(row.phone_normalized),
    householdKey: nullableString(row.household_key),
    threadId: nullableString(row.thread_id),
    threadLabel: nullableString(row.thread_label),
    direction: nullableString(row.direction),
    source: nullableString(row.source),
    provenance: nullableString(row.provenance),
    previewRedacted: nullableString(row.preview_redacted),
    providerReferenceDigest: nullableString(row.provider_reference_digest),
    importBatchKey: nullableString(row.import_batch_key),
    idempotencyKey: nullableString(row.idempotency_key),
    participantKind: nullableString(row.participant_kind),
    participantLabel: nullableString(row.participant_label),
    draftOnly: booleanValue(row.draft_only),
    transportAvailable: booleanValue(row.transport_available),
  };
}

function nullableString(value: unknown) {
  return value === null || value === undefined || value === '' ? null : String(value);
}

function booleanValue(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  return String(value) === 'true';
}
