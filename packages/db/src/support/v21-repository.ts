import type {
  SupportIdempotencyRecord,
  SupportRepository,
  SupportTicket,
} from '../../../contracts/src/support/v21.ts';

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

function assertTicketStorageInvariant(ticket: SupportTicket) {
  if (ticket.product !== 'one_time_mishnayos') throw new Error('support_product_scope_invalid');
  if (ticket.requesterRole === 'student' && ticket.ghlConversationId !== null) {
    throw new Error('support_student_ghl_forbidden');
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
