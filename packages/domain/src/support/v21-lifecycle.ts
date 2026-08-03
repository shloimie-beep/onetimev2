import type {
  CreateSupportConversationInput,
  SupportAdminCapability,
  SupportAuditEvent,
  SupportCategory,
  SupportLifecycleState,
  SupportMessage,
  SupportNotificationIntentPort,
  SupportPrincipal,
  SupportRepository,
  SupportRequesterView,
  SupportTelegramNotificationIntent,
  SupportTicket,
} from '../../../contracts/src/support/v21.ts';
import { canonicalRequestHash, sha256Hex } from '../jobs/idempotency.ts';
import { SupportV21Error } from './v21-errors.ts';

const TECHNICAL_CATEGORIES = new Set<SupportCategory>([
  'billing',
  'support',
  'access',
  'technical',
  'system',
]);
const QUESTION_CATEGORIES = new Set<SupportCategory>(['class_question', 'torah_question']);
const TRANSITIONS: Readonly<Record<SupportLifecycleState, readonly SupportLifecycleState[]>> = {
  open: ['in_progress', 'closed'],
  in_progress: ['waiting_on_requester', 'resolved', 'closed'],
  waiting_on_requester: ['in_progress', 'resolved', 'closed'],
  resolved: ['in_progress', 'closed'],
  closed: [],
};

export function createSupportLifecycleService(input: {
  repository: SupportRepository;
  notificationIntents: SupportNotificationIntentPort;
  now?: () => Date;
}) {
  const now = input.now ?? (() => new Date());

  return {
    async create(principal: SupportPrincipal, command: CreateSupportConversationInput) {
      assertRequester(principal);
      assertConversationShape(command);
      if (command.kind === 'rabbi_question' && principal.role !== 'student') {
        throw new SupportV21Error(
          'forbidden',
          'Only a Student may create a private Rabbi question.',
        );
      }
      const normalized = {
        ...command,
        subject: boundedText(command.subject, 5, 120, 'subject'),
        body: boundedText(command.body, 20, 6000, 'body'),
        idempotencyKey: boundedIdempotencyKey(command.idempotencyKey),
      };
      const requestHash = canonicalRequestHash(normalized);
      const scope = `support:create:${principal.actorId}`;
      const replay = await input.repository.findIdempotency(scope, normalized.idempotencyKey);
      if (replay) {
        if (replay.requestHash !== requestHash) {
          throw new SupportV21Error(
            'idempotency_conflict',
            'The idempotency key was already used for a different support request.',
          );
        }
        return requesterProjection(required(await input.repository.load(replay.ticketId)));
      }

      const at = instant(now());
      const ticketId = `ots_${sha256Hex(`${scope}:${normalized.idempotencyKey}`).slice(0, 26)}`;
      const message: SupportMessage = {
        messageId: stableEventId(ticketId, 1, 'requester_message'),
        authorId: principal.actorId,
        authorRole: principal.role,
        body: normalized.body,
        createdAt: at,
      };
      const ticket: SupportTicket = {
        ticketId,
        product: 'one_time_mishnayos',
        kind: normalized.kind,
        category: normalized.category,
        requesterId: principal.actorId,
        requesterRole: principal.role,
        requesterHouseholdId: requiredOpaque(principal.householdId, 'householdId'),
        requesterStudentId:
          principal.role === 'student' ? requiredOpaque(principal.studentId, 'studentId') : null,
        subject: normalized.subject,
        status: 'open',
        assigneeAdminId: null,
        ghlConversationId: null,
        messages: [message],
        audit: [audit(ticketId, 1, 'created', principal.actorId, at, null, 'open')],
        version: 1,
        createdAt: at,
        updatedAt: at,
      };
      await input.repository.save(ticket, null);
      await input.repository.saveIdempotency({
        scope,
        key: normalized.idempotencyKey,
        requestHash,
        ticketId,
      });
      await input.notificationIntents.record(notificationIntent(ticket, 'ticket_created'));
      return requesterProjection(ticket);
    },

    async read(principal: SupportPrincipal, ticketId: string): Promise<SupportRequesterView> {
      const ticket = required(await input.repository.load(ticketId));
      assertCanRead(principal, ticket);
      return requesterProjection(ticket);
    },

    async readAdmin(principal: SupportPrincipal, ticketId: string) {
      const ticket = required(await input.repository.load(ticketId));
      assertAdminAccess(principal, ticket);
      return ticket;
    },

    async listForRequester(principal: SupportPrincipal) {
      assertRequester(principal);
      const tickets = await input.repository.list();
      return tickets
        .filter(
          (ticket) =>
            ticket.product === 'one_time_mishnayos' &&
            ticket.requesterId === principal.actorId &&
            ticket.requesterRole === principal.role,
        )
        .map(requesterProjection);
    },

    async listForAdmin(principal: SupportPrincipal) {
      assertAdmin(principal);
      return (await input.repository.list()).filter((ticket) => hasAdminAccess(principal, ticket));
    },

    async assign(inputCommand: {
      principal: SupportPrincipal;
      ticketId: string;
      assigneeAdminId: string;
      expectedVersion: number;
    }) {
      const ticket = required(await input.repository.load(inputCommand.ticketId));
      assertAdminAccess(inputCommand.principal, ticket);
      assertVersion(ticket, inputCommand.expectedVersion);
      const assignee = requiredOpaque(inputCommand.assigneeAdminId, 'assigneeAdminId');
      if (ticket.assigneeAdminId === assignee) return ticket;
      const updated = updateTicket(ticket, now(), {
        assigneeAdminId: assignee,
        audit: [
          ...ticket.audit,
          audit(
            ticket.ticketId,
            ticket.version + 1,
            'assigned',
            inputCommand.principal.actorId,
            instant(now()),
            ticket.status,
            ticket.status,
          ),
        ],
      });
      await input.repository.save(updated, ticket.version);
      await input.notificationIntents.record(notificationIntent(updated, 'ticket_assigned'));
      return updated;
    },

    async transition(inputCommand: {
      principal: SupportPrincipal;
      ticketId: string;
      to: SupportLifecycleState;
      expectedVersion: number;
    }) {
      const ticket = required(await input.repository.load(inputCommand.ticketId));
      assertAdminAccess(inputCommand.principal, ticket);
      assertVersion(ticket, inputCommand.expectedVersion);
      if (ticket.status === inputCommand.to) return ticket;
      if (!TRANSITIONS[ticket.status].includes(inputCommand.to)) {
        throw new SupportV21Error(
          'invalid_transition',
          `Support status cannot transition from ${ticket.status} to ${inputCommand.to}.`,
        );
      }
      const at = instant(now());
      const updated = updateTicket(ticket, new Date(at), {
        status: inputCommand.to,
        audit: [
          ...ticket.audit,
          audit(
            ticket.ticketId,
            ticket.version + 1,
            'status_changed',
            inputCommand.principal.actorId,
            at,
            ticket.status,
            inputCommand.to,
          ),
        ],
      });
      await input.repository.save(updated, ticket.version);
      await input.notificationIntents.record(notificationIntent(updated, 'ticket_status_changed'));
      return updated;
    },

    async reply(inputCommand: {
      principal: SupportPrincipal;
      ticketId: string;
      body: string;
      idempotencyKey: string;
      expectedVersion: number;
    }) {
      const ticket = required(await input.repository.load(inputCommand.ticketId));
      assertAdminAccess(inputCommand.principal, ticket);
      const body = boundedText(inputCommand.body, 1, 6000, 'body');
      const key = boundedIdempotencyKey(inputCommand.idempotencyKey);
      const scope = `support:reply:${ticket.ticketId}:${inputCommand.principal.actorId}`;
      const requestHash = canonicalRequestHash({ body });
      const replay = await input.repository.findIdempotency(scope, key);
      if (replay) {
        if (replay.requestHash !== requestHash || replay.ticketId !== ticket.ticketId) {
          throw new SupportV21Error(
            'idempotency_conflict',
            'The idempotency key was already used for a different reply.',
          );
        }
        return ticket;
      }
      assertVersion(ticket, inputCommand.expectedVersion);
      const at = instant(now());
      const updated = updateTicket(ticket, new Date(at), {
        messages: [
          ...ticket.messages,
          {
            messageId: stableEventId(ticket.ticketId, ticket.version + 1, 'admin_reply'),
            authorId: inputCommand.principal.actorId,
            authorRole: 'admin',
            body,
            createdAt: at,
          },
        ],
        audit: [
          ...ticket.audit,
          audit(
            ticket.ticketId,
            ticket.version + 1,
            'admin_replied',
            inputCommand.principal.actorId,
            at,
            ticket.status,
            ticket.status,
          ),
        ],
      });
      await input.repository.save(updated, ticket.version);
      await input.repository.saveIdempotency({
        scope,
        key,
        requestHash,
        ticketId: ticket.ticketId,
      });
      return updated;
    },

    async linkAdultGhlConversation(inputCommand: {
      principal: SupportPrincipal;
      ticketId: string;
      ghlConversationId: string;
      expectedVersion: number;
    }) {
      const ticket = required(await input.repository.load(inputCommand.ticketId));
      assertAdminAccess(inputCommand.principal, ticket);
      assertVersion(ticket, inputCommand.expectedVersion);
      if (ticket.requesterRole !== 'parent' || ticket.kind !== 'technical_support') {
        throw new SupportV21Error(
          'forbidden',
          'Only adult technical support may link a GHL conversation.',
        );
      }
      const conversationId = requiredOpaque(inputCommand.ghlConversationId, 'ghlConversationId');
      if (ticket.ghlConversationId === conversationId) return ticket;
      if (ticket.ghlConversationId !== null) {
        throw new SupportV21Error(
          'conversation_link_conflict',
          'Adult support may link only one GHL conversation.',
        );
      }
      const at = instant(now());
      const updated = updateTicket(ticket, new Date(at), {
        ghlConversationId: conversationId,
        audit: [
          ...ticket.audit,
          audit(
            ticket.ticketId,
            ticket.version + 1,
            'adult_ghl_conversation_linked',
            inputCommand.principal.actorId,
            at,
            ticket.status,
            ticket.status,
          ),
        ],
      });
      await input.repository.save(updated, ticket.version);
      return updated;
    },
  };
}

function assertConversationShape(input: CreateSupportConversationInput) {
  if (input.kind === 'technical_support' && !TECHNICAL_CATEGORIES.has(input.category)) {
    throw new SupportV21Error('invalid_input', 'Technical support requires a support category.');
  }
  if (input.kind === 'rabbi_question' && !QUESTION_CATEGORIES.has(input.category)) {
    throw new SupportV21Error('invalid_input', 'Rabbi questions require a question category.');
  }
}

function assertRequester(principal: SupportPrincipal): asserts principal is SupportPrincipal & {
  role: 'parent' | 'student';
} {
  assertOneTime(principal);
  if (principal.role !== 'parent' && principal.role !== 'student') {
    throw new SupportV21Error(
      'forbidden',
      'Only Parent and Student requesters may create support.',
    );
  }
  requiredOpaque(principal.householdId, 'householdId');
  if (principal.role === 'student') requiredOpaque(principal.studentId, 'studentId');
}

function assertAdmin(principal: SupportPrincipal) {
  assertOneTime(principal);
  if (principal.role !== 'admin') {
    throw new SupportV21Error('forbidden', 'An authorized Admin is required.');
  }
}

function assertOneTime(principal: SupportPrincipal) {
  if (principal.product !== 'one_time_mishnayos') {
    throw new SupportV21Error('forbidden', 'Support is isolated to One Time.');
  }
  requiredOpaque(principal.actorId, 'actorId');
}

function assertCanRead(principal: SupportPrincipal, ticket: SupportTicket) {
  assertOneTime(principal);
  if (principal.role === 'admin') {
    assertAdminAccess(principal, ticket);
    return;
  }
  if (ticket.requesterId !== principal.actorId || ticket.requesterRole !== principal.role) {
    throw new SupportV21Error('not_found', 'Support conversation was not found.');
  }
}

function assertAdminAccess(principal: SupportPrincipal, ticket: SupportTicket) {
  assertAdmin(principal);
  if (!hasAdminAccess(principal, ticket)) {
    throw new SupportV21Error('not_found', 'Support conversation was not found.');
  }
}

function hasAdminAccess(principal: SupportPrincipal, ticket: SupportTicket) {
  const requiredCapability: SupportAdminCapability =
    ticket.kind === 'rabbi_question' ? 'rabbi_operator' : 'support_operator';
  return (
    ticket.product === 'one_time_mishnayos' &&
    principal.role === 'admin' &&
    principal.adminCapabilities.includes(requiredCapability)
  );
}

function requesterProjection(ticket: SupportTicket): SupportRequesterView {
  const { ghlConversationId, ...visible } = ticket;
  return { ...visible, ghlConversationLinked: ghlConversationId !== null };
}

function notificationIntent(
  ticket: SupportTicket,
  event: SupportTelegramNotificationIntent['event'],
): SupportTelegramNotificationIntent {
  const destination = ticket.kind === 'rabbi_question' ? 'rabbi_questions' : 'shloimie_support';
  const idempotencyKey = `support:${ticket.ticketId}:${ticket.version}:${event}`;
  return {
    intentId: `oti_${sha256Hex(idempotencyKey).slice(0, 26)}`,
    idempotencyKey,
    transport: 'telegram',
    namespace: 'OT',
    destination,
    event,
    ticketId: ticket.ticketId,
    ticketVersion: ticket.version,
    requesterRole: ticket.requesterRole,
    kind: ticket.kind,
    category: ticket.category,
    status: ticket.status,
    redactedSummary:
      ticket.kind === 'rabbi_question'
        ? 'New private Student Rabbi question'
        : `New ${ticket.requesterRole} ${ticket.category} support request`,
    containsPrivateBody: false,
    containsStudentIdentity: false,
    providerIsSourceOfTruth: false,
  };
}

function updateTicket(
  ticket: SupportTicket,
  at: Date,
  patch: Partial<
    Pick<SupportTicket, 'status' | 'assigneeAdminId' | 'ghlConversationId' | 'messages' | 'audit'>
  >,
): SupportTicket {
  return {
    ...ticket,
    ...patch,
    version: ticket.version + 1,
    updatedAt: instant(at),
  };
}

function audit(
  ticketId: string,
  version: number,
  action: SupportAuditEvent['action'],
  actorId: string,
  at: string,
  fromStatus: SupportLifecycleState | null,
  toStatus: SupportLifecycleState | null,
): SupportAuditEvent {
  return {
    eventId: stableEventId(ticketId, version, action),
    action,
    actorId,
    at,
    fromStatus,
    toStatus,
  };
}

function stableEventId(ticketId: string, version: number, action: string) {
  return `ota_${sha256Hex(`${ticketId}:${version}:${action}`).slice(0, 26)}`;
}

function assertVersion(ticket: SupportTicket, expectedVersion: number) {
  if (ticket.version !== expectedVersion) {
    throw new SupportV21Error('version_conflict', 'Support conversation version is stale.');
  }
}

function boundedText(value: string, min: number, max: number, field: string) {
  const normalized = value.trim();
  if (
    normalized.length < min ||
    normalized.length > max ||
    [...normalized].some((character) => character.charCodeAt(0) <= 8)
  ) {
    throw new SupportV21Error('invalid_input', `${field} is outside the permitted bounds.`);
  }
  return normalized;
}

function boundedIdempotencyKey(value: string) {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/.test(normalized)) {
    throw new SupportV21Error('invalid_input', 'idempotencyKey is invalid.');
  }
  return normalized;
}

function requiredOpaque(value: string | null, field: string) {
  if (value === null || !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(value)) {
    throw new SupportV21Error('invalid_input', `${field} is invalid.`);
  }
  return value;
}

function instant(value: Date) {
  const timestamp = value.getTime();
  if (!Number.isFinite(timestamp)) {
    throw new SupportV21Error('invalid_input', 'Clock returned an invalid instant.');
  }
  return value.toISOString();
}

function required(ticket: SupportTicket | null) {
  if (!ticket) throw new SupportV21Error('not_found', 'Support conversation was not found.');
  return ticket;
}
