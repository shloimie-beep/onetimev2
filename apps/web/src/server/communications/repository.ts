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
      'outbox.account_key = $1',
      'outbox.product_key = $2',
      'outbox.created_at >= $3::timestamptz',
      'outbox.created_at < $4::timestamptz',
    ];
    if (input.mode.kind === 'contact') {
      params.push(input.mode.contactId);
      where.push(`outbox.contact_key = $${params.length}`);
    }
    if (input.filters.channel) {
      params.push(input.filters.channel);
      where.push(`outbox.channel = $${params.length}`);
    }
    if (input.rawEventType) {
      params.push(input.rawEventType);
      where.push(`outbox.event_type = $${params.length}`);
    }
    if (input.filters.status === 'queued') {
      where.push("outbox.status = 'pending'");
    } else if (input.filters.status === 'draft_saved') {
      where.push("outbox.status = 'sink_delivered'");
    } else if (
      ['provider_accepted', 'delivered', 'failed', 'bounced', 'complained', 'suppressed'].includes(
        input.filters.status ?? '',
      )
    ) {
      params.push(input.filters.status);
      where.push(`outbox.status = $${params.length}`);
    } else if (input.filters.status === 'unknown') {
      where.push(
        "(outbox.status IS NULL OR outbox.status NOT IN ('pending', 'sink_delivered', 'provider_accepted', 'delivered', 'failed', 'bounced', 'complained', 'suppressed'))",
      );
    }
    if (input.cursor) {
      params.push(input.cursor.lastCreatedAt, input.cursor.lastId);
      where.push(
        `(outbox.created_at < $${params.length - 1}::timestamptz OR (outbox.created_at = $${params.length - 1}::timestamptz AND outbox.id < $${params.length}::uuid))`,
      );
    }
    params.push(input.filters.limit + 1);
    const result = await this.pool.query(
      `SELECT outbox.id,
              outbox.account_key,
              outbox.product_key,
              outbox.contact_key,
              outbox.event_type,
              outbox.channel,
              outbox.status,
              outbox.created_at,
              outbox.delivered_at,
              contact.email_normalized,
              contact.phone_normalized
         FROM onetime.outbox_events AS outbox
         LEFT JOIN onetime.contacts AS contact
           ON contact.contact_key = outbox.contact_key
          AND contact.account_key = outbox.account_key
          AND contact.product_key = outbox.product_key
        WHERE ${where.join(' AND ')}
        ORDER BY outbox.created_at DESC, outbox.id DESC
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
    deliveredAt:
      row.delivered_at === null || row.delivered_at === undefined
        ? null
        : row.delivered_at instanceof Date
          ? row.delivered_at
          : String(row.delivered_at),
    emailNormalized: nullableString(row.email_normalized),
    phoneNormalized: nullableString(row.phone_normalized),
  };
}

function nullableString(value: unknown) {
  return value === null || value === undefined || value === '' ? null : String(value);
}
