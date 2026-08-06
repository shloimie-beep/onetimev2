import type {
  SupportIdempotencyRecord,
  SupportNotificationIntentPort,
  SupportRepository,
  SupportTelegramNotificationIntent,
  SupportTicket,
} from '../../../contracts/src/support/v21.ts';
import { inTransaction, type DbPool, type Queryable } from '../index.ts';

export const SUPPORT_V21_SCHEMA_CONTRACT = {
  version: '2.1.0',
  tables: {
    tickets: 'onetime.support_tickets_v21',
    messages: 'onetime.support_messages_v21',
    audit: 'onetime.support_audit_v21',
    idempotency: 'onetime.support_idempotency_v21',
    notificationIntents: 'onetime.support_notification_intents_v21',
  },
  invariants: [
    'product is always one_time_mishnayos',
    'requester and read authorization are server-derived',
    'Student rows never carry a GHL conversation identifier',
    'one adult technical-support ticket links at most one GHL conversation',
    'ticket writes use optimistic version checks',
    'idempotency scope and key are unique and retain the canonical request hash',
    'Telegram rows are redacted local intents and never provider truth',
  ],
} as const;

export function createMemorySupportRepository(): SupportRepository {
  const tickets = new Map<string, SupportTicket>();
  const idempotency = new Map<string, SupportIdempotencyRecord>();

  return {
    async load(ticketId) {
      const ticket = tickets.get(ticketId);
      return ticket ? cloneTicket(ticket) : null;
    },

    async save(ticket, expectedVersion) {
      assertTicketStorageInvariant(ticket);
      const current = tickets.get(ticket.ticketId);
      if (expectedVersion === null) {
        if (current) throw new Error('support_ticket_insert_conflict');
      } else if (!current || current.version !== expectedVersion) {
        throw new Error('support_ticket_version_conflict');
      }
      tickets.set(ticket.ticketId, cloneTicket(ticket));
    },

    async list() {
      return [...tickets.values()]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .map(cloneTicket);
    },

    async findIdempotency(scope, key) {
      const record = idempotency.get(idempotencyIdentity(scope, key));
      return record ? { ...record } : null;
    },

    async saveIdempotency(record) {
      const identity = idempotencyIdentity(record.scope, record.key);
      const current = idempotency.get(identity);
      if (
        current &&
        (current.requestHash !== record.requestHash || current.ticketId !== record.ticketId)
      ) {
        throw new Error('support_idempotency_conflict');
      }
      idempotency.set(identity, { ...record });
    },
  };
}

export function createPostgresSupportRepository(pool: DbPool): SupportRepository {
  return {
    async load(ticketId) {
      return loadPostgresTicket(pool, ticketId);
    },

    async save(ticket, expectedVersion) {
      assertTicketStorageInvariant(ticket);
      await inTransaction(pool, async (client) => {
        if (expectedVersion === null) {
          const inserted = await client.query(
            `INSERT INTO onetime.support_tickets_v21
               (ticket_id, product, conversation_kind, category, subject, status,
                requester_role, requester_identity_id, household_id, student_id,
                assignee_human_account_id, ghl_conversation_id, version, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::timestamptz,$15::timestamptz)
             ON CONFLICT (ticket_id) DO NOTHING
             RETURNING ticket_id`,
            ticketColumns(ticket),
          );
          if (!inserted.rowCount) {
            const existing = await loadPostgresTicket(client, ticket.ticketId);
            if (!existing || canonicalTicket(existing) !== canonicalTicket(ticket)) {
              throw new Error('support_ticket_insert_conflict');
            }
          }
        } else {
          const updated = await client.query(
            `UPDATE onetime.support_tickets_v21
                SET status = $2,
                    assignee_human_account_id = $3,
                    ghl_conversation_id = $4,
                    version = $5,
                    updated_at = $6::timestamptz
              WHERE ticket_id = $1
                AND version = $7
              RETURNING ticket_id`,
            [
              ticket.ticketId,
              ticket.status,
              ticket.assigneeAdminId,
              ticket.ghlConversationId,
              ticket.version,
              ticket.updatedAt,
              expectedVersion,
            ],
          );
          if (!updated.rowCount) throw new Error('support_ticket_version_conflict');
        }

        for (const message of ticket.messages) {
          await client.query(
            `INSERT INTO onetime.support_messages_v21
               (ticket_id, message_id, author_identity_id, author_role, body, created_at)
             VALUES ($1,$2,$3,$4,$5,$6::timestamptz)
             ON CONFLICT (ticket_id, message_id) DO NOTHING`,
            [
              ticket.ticketId,
              message.messageId,
              message.authorId,
              message.authorRole,
              message.body,
              message.createdAt,
            ],
          );
        }
        for (const [eventIndex, event] of ticket.audit.entries()) {
          await client.query(
            `INSERT INTO onetime.support_audit_v21
               (audit_event_id, ticket_id, ticket_version, actor_identity_id, action,
                before_status, after_status, occurred_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz)
             ON CONFLICT (audit_event_id) DO NOTHING`,
            [
              event.eventId,
              ticket.ticketId,
              eventIndex + 1,
              event.actorId,
              event.action,
              event.fromStatus,
              event.toStatus,
              event.at,
            ],
          );
        }
      });
    },

    async list() {
      const rows = await pool.query(
        `SELECT ticket_id
           FROM onetime.support_tickets_v21
          WHERE product = 'one_time_mishnayos'
          ORDER BY updated_at DESC, ticket_id ASC`,
      );
      const tickets: SupportTicket[] = [];
      for (const row of rows.rows) {
        const ticket = await loadPostgresTicket(pool, String(row.ticket_id));
        if (ticket) tickets.push(ticket);
      }
      return tickets;
    },

    async findIdempotency(scope, key) {
      const result = await pool.query(
        `SELECT scope, idempotency_key, canonical_request_hash, ticket_id
           FROM onetime.support_idempotency_v21
          WHERE scope = $1 AND idempotency_key = $2
          LIMIT 1`,
        [scope, key],
      );
      const row = result.rows[0];
      return row
        ? {
            scope: String(row.scope),
            key: String(row.idempotency_key),
            requestHash: String(row.canonical_request_hash),
            ticketId: String(row.ticket_id),
          }
        : null;
    },

    async saveIdempotency(record) {
      const inserted = await pool.query(
        `INSERT INTO onetime.support_idempotency_v21
           (scope, idempotency_key, canonical_request_hash, ticket_id)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (scope, idempotency_key) DO NOTHING
         RETURNING ticket_id`,
        [record.scope, record.key, record.requestHash, record.ticketId],
      );
      if (inserted.rowCount) return;
      const existing = await pool.query(
        `SELECT canonical_request_hash, ticket_id
           FROM onetime.support_idempotency_v21
          WHERE scope = $1 AND idempotency_key = $2`,
        [record.scope, record.key],
      );
      const row = existing.rows[0];
      if (
        !row ||
        String(row.canonical_request_hash) !== record.requestHash ||
        String(row.ticket_id) !== record.ticketId
      ) {
        throw new Error('support_idempotency_conflict');
      }
    },
  };
}

export function createPostgresSupportNotificationIntentPort(
  pool: DbPool,
): SupportNotificationIntentPort {
  return {
    async record(intent) {
      assertNotificationIntent(intent);
      const inserted = await pool.query(
        `INSERT INTO onetime.support_notification_intents_v21
           (intent_id, idempotency_key, ticket_id, transport, namespace, destination,
            event, ticket_version, requester_role, conversation_kind, category,
            ticket_status, redacted_summary, contains_private_body,
            contains_student_identity, provider_is_source_of_truth)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING intent_id`,
        notificationColumns(intent),
      );
      if (inserted.rowCount) return;
      const existing = await pool.query(
        `SELECT intent_id, ticket_id, ticket_version, event
           FROM onetime.support_notification_intents_v21
          WHERE idempotency_key = $1`,
        [intent.idempotencyKey],
      );
      const row = existing.rows[0];
      if (
        !row ||
        String(row.intent_id) !== intent.intentId ||
        String(row.ticket_id) !== intent.ticketId ||
        Number(row.ticket_version) !== intent.ticketVersion ||
        String(row.event) !== intent.event
      ) {
        throw new Error('support_notification_intent_conflict');
      }
    },
  };
}

async function loadPostgresTicket(
  target: DbPool | Queryable,
  ticketId: string,
): Promise<SupportTicket | null> {
  const ticketResult = await target.query(
    `SELECT ticket_id, product, conversation_kind, category, subject, status,
            requester_role, requester_identity_id, household_id, student_id,
            assignee_human_account_id, ghl_conversation_id, version, created_at, updated_at
       FROM onetime.support_tickets_v21
      WHERE ticket_id = $1
      LIMIT 1`,
    [ticketId],
  );
  const row = ticketResult.rows[0];
  if (!row) return null;
  const [messages, audit] = await Promise.all([
    target.query(
      `SELECT message_id, author_identity_id, author_role, body, created_at
         FROM onetime.support_messages_v21
        WHERE ticket_id = $1
        ORDER BY created_at ASC, message_id ASC`,
      [ticketId],
    ),
    target.query(
      `SELECT audit_event_id, actor_identity_id, action, before_status, after_status, occurred_at
         FROM onetime.support_audit_v21
        WHERE ticket_id = $1
        ORDER BY ticket_version ASC, audit_event_id ASC`,
      [ticketId],
    ),
  ]);
  return {
    ticketId: String(row.ticket_id),
    product: 'one_time_mishnayos',
    kind: String(row.conversation_kind) as SupportTicket['kind'],
    category: String(row.category) as SupportTicket['category'],
    requesterId: String(row.requester_identity_id),
    requesterRole: String(row.requester_role) as SupportTicket['requesterRole'],
    requesterHouseholdId: String(row.household_id),
    requesterStudentId: row.student_id === null ? null : String(row.student_id),
    subject: String(row.subject),
    status: String(row.status) as SupportTicket['status'],
    assigneeAdminId:
      row.assignee_human_account_id === null ? null : String(row.assignee_human_account_id),
    ghlConversationId: row.ghl_conversation_id === null ? null : String(row.ghl_conversation_id),
    version: Number(row.version),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    messages: messages.rows.map((message) => ({
      messageId: String(message.message_id),
      authorId: String(message.author_identity_id),
      authorRole: String(message.author_role) as SupportTicket['messages'][number]['authorRole'],
      body: String(message.body),
      createdAt: iso(message.created_at),
    })),
    audit: audit.rows.map((event) => ({
      eventId: String(event.audit_event_id),
      action: String(event.action) as SupportTicket['audit'][number]['action'],
      actorId: String(event.actor_identity_id),
      at: iso(event.occurred_at),
      fromStatus:
        event.before_status === null
          ? null
          : (String(event.before_status) as SupportTicket['status']),
      toStatus:
        event.after_status === null
          ? null
          : (String(event.after_status) as SupportTicket['status']),
    })),
  };
}

function ticketColumns(ticket: SupportTicket) {
  return [
    ticket.ticketId,
    ticket.product,
    ticket.kind,
    ticket.category,
    ticket.subject,
    ticket.status,
    ticket.requesterRole,
    ticket.requesterId,
    ticket.requesterHouseholdId,
    ticket.requesterStudentId,
    ticket.assigneeAdminId,
    ticket.ghlConversationId,
    ticket.version,
    ticket.createdAt,
    ticket.updatedAt,
  ];
}

function notificationColumns(intent: SupportTelegramNotificationIntent) {
  return [
    intent.intentId,
    intent.idempotencyKey,
    intent.ticketId,
    intent.transport,
    intent.namespace,
    intent.destination,
    intent.event,
    intent.ticketVersion,
    intent.requesterRole,
    intent.kind,
    intent.category,
    intent.status,
    intent.redactedSummary,
    intent.containsPrivateBody,
    intent.containsStudentIdentity,
    intent.providerIsSourceOfTruth,
  ];
}

function assertNotificationIntent(intent: SupportTelegramNotificationIntent) {
  if (
    intent.transport !== 'telegram' ||
    intent.namespace !== 'OT' ||
    intent.containsPrivateBody ||
    intent.containsStudentIdentity ||
    intent.providerIsSourceOfTruth
  ) {
    throw new Error('support_notification_intent_scope_invalid');
  }
}

function canonicalTicket(ticket: SupportTicket) {
  return JSON.stringify(ticket);
}

function iso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

function assertTicketStorageInvariant(ticket: SupportTicket) {
  if (ticket.product !== 'one_time_mishnayos') throw new Error('support_product_scope_invalid');
  if (!Number.isSafeInteger(ticket.version) || ticket.version < 1) {
    throw new Error('support_ticket_version_invalid');
  }
  if (ticket.audit.length !== ticket.version || ticket.messages.length < 1) {
    throw new Error('support_ticket_history_invalid');
  }
  if (
    !Number.isFinite(new Date(ticket.createdAt).getTime()) ||
    !Number.isFinite(new Date(ticket.updatedAt).getTime()) ||
    new Date(ticket.updatedAt).getTime() < new Date(ticket.createdAt).getTime()
  ) {
    throw new Error('support_ticket_time_invalid');
  }
  if (ticket.requesterRole === 'student' && ticket.ghlConversationId !== null) {
    throw new Error('support_student_ghl_forbidden');
  }
  if (
    (ticket.requesterRole === 'student' && ticket.requesterStudentId === null) ||
    (ticket.requesterRole === 'parent' && ticket.requesterStudentId !== null)
  ) {
    throw new Error('support_requester_scope_invalid');
  }
  if (
    ticket.ghlConversationId !== null &&
    (ticket.requesterRole !== 'parent' || ticket.kind !== 'technical_support')
  ) {
    throw new Error('support_ghl_conversation_scope_invalid');
  }
  if (
    ticket.kind === 'rabbi_question' &&
    (ticket.requesterRole !== 'student' || ticket.ghlConversationId !== null)
  ) {
    throw new Error('support_question_scope_invalid');
  }
}

function idempotencyIdentity(scope: string, key: string) {
  return `${scope}\u0000${key}`;
}

function cloneTicket(ticket: SupportTicket): SupportTicket {
  return {
    ...ticket,
    messages: ticket.messages.map((message) => ({ ...message })),
    audit: ticket.audit.map((event) => ({ ...event })),
  };
}
