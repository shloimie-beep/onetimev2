import React from 'react';
import {
  SUPPORT_LIFECYCLE_STATES,
  type SupportAdminView,
  type SupportLifecycleState,
} from '../../../../../../../packages/contracts/src/support/v21.ts';
import { V21StatePanel } from '../../../../../../../packages/brand-system/src/react-v21.tsx';

export function AdminSupportWorkspace(props: {
  tickets: readonly SupportAdminView[];
  mode?: 'workspace' | 'queue' | 'detail';
  onNavigate?: ((href: string) => void) | undefined;
  onAssign: (ticketId: string, assigneeAdminId: string, expectedVersion: number) => void;
  onStatus: (ticketId: string, status: SupportLifecycleState, expectedVersion: number) => void;
  onReply: (ticketId: string, body: string, expectedVersion: number) => void;
}) {
  const mode = props.mode ?? 'workspace';
  const title =
    mode === 'queue'
      ? 'Support ticket queue'
      : mode === 'detail'
        ? 'Ticket operations'
        : 'Support operations';
  return (
    <section className="support-admin-workspace" aria-labelledby="admin-support-title">
      <h2 id="admin-support-title">{title}</h2>
      <p>
        One Time remains the source of truth. Telegram receives only redacted operator
        notifications.
      </p>
      {mode === 'detail' ? (
        <a
          href="/app/tickets"
          className="button-secondary"
          data-action-id="support.admin.ticket_queue.back.button"
          onClick={(event) => navigateInApp(event, props.onNavigate)}
        >
          Back to ticket queue
        </a>
      ) : null}
      {props.tickets.length === 0 ? (
        <V21StatePanel
          kind="empty"
          title={mode === 'detail' ? 'Support ticket not found' : 'No support conversations'}
        >
          <p>
            {mode === 'detail'
              ? 'This ticket is unavailable in the current Admin scope.'
              : 'New technical requests and private Rabbi questions will appear in their own queues.'}
          </p>
        </V21StatePanel>
      ) : mode === 'queue' ? (
        <SupportTicketQueue tickets={props.tickets} onNavigate={props.onNavigate} />
      ) : (
        <ol aria-label="Support conversations">
          {props.tickets.map((ticket) => (
            <li key={ticket.ticketId}>
              <SupportTicketOperations ticket={ticket} {...props} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function SupportTicketQueue({
  tickets,
  onNavigate,
}: {
  tickets: readonly SupportAdminView[];
  onNavigate?: ((href: string) => void) | undefined;
}) {
  return (
    <ol aria-label="Support ticket queue">
      {tickets.map((ticket) => {
        const href = `/app/tickets/${encodeURIComponent(ticket.ticketId)}`;
        return (
          <li key={ticket.ticketId}>
            <article aria-labelledby={`ticket-queue-${ticket.ticketId}`}>
              <h3 id={`ticket-queue-${ticket.ticketId}`}>{ticket.subject}</h3>
              <dl>
                <dt>Queue</dt>
                <dd>
                  {ticket.kind === 'rabbi_question' ? 'Rabbi questions' : 'Technical support'}
                </dd>
                <dt>Requester role</dt>
                <dd>{ticket.requesterRole}</dd>
                <dt>Status</dt>
                <dd>{readableStatus(ticket.status)}</dd>
                <dt>Assigned Admin</dt>
                <dd>{ticket.assigneeAdminId ?? 'Unassigned'}</dd>
                <dt>Updated</dt>
                <dd>
                  <time dateTime={ticket.updatedAt}>{ticket.updatedAt}</time>
                </dd>
              </dl>
              <a
                href={href}
                className="button-secondary"
                data-action-id="support.admin.ticket.open.button"
                onClick={(event) => navigateInApp(event, onNavigate)}
              >
                Open ticket
              </a>
            </article>
          </li>
        );
      })}
    </ol>
  );
}

function SupportTicketOperations(
  props: {
    ticket: SupportAdminView;
  } & Pick<Parameters<typeof AdminSupportWorkspace>[0], 'onAssign' | 'onStatus' | 'onReply'>,
) {
  const { ticket } = props;
  return (
    <article aria-labelledby={`ticket-${ticket.ticketId}`}>
      <h3 id={`ticket-${ticket.ticketId}`}>{ticket.subject}</h3>
      <dl>
        <dt>Queue</dt>
        <dd>{ticket.kind === 'rabbi_question' ? 'Rabbi questions' : 'Technical support'}</dd>
        <dt>Requester role</dt>
        <dd>{ticket.requesterRole}</dd>
        <dt>Status</dt>
        <dd>{ticket.status.replaceAll('_', ' ')}</dd>
        <dt>Assigned Admin</dt>
        <dd>{ticket.assigneeAdminId ?? 'Unassigned'}</dd>
      </dl>
      <ol aria-label={`Messages for ${ticket.subject}`}>
        {ticket.messages.map((message) => (
          <li key={message.messageId}>
            <strong>{message.authorRole === 'admin' ? 'Admin' : message.authorRole}</strong>
            <p>{message.body}</p>
            <time dateTime={message.createdAt}>{message.createdAt}</time>
          </li>
        ))}
      </ol>
      <label>
        Assign Admin
        <input
          aria-label={`Assign ${ticket.ticketId}`}
          defaultValue={ticket.assigneeAdminId ?? ''}
          onBlur={(event) => {
            const value = event.currentTarget.value.trim();
            if (value) props.onAssign(ticket.ticketId, value, ticket.version);
          }}
        />
      </label>
      <label>
        Status
        <select
          value={ticket.status}
          onChange={(event) =>
            props.onStatus(
              ticket.ticketId,
              event.currentTarget.value as SupportLifecycleState,
              ticket.version,
            )
          }
        >
          {SUPPORT_LIFECYCLE_STATES.map((status) => (
            <option
              key={status}
              value={status}
              disabled={
                status !== ticket.status && !allowedTransitions(ticket.status).includes(status)
              }
            >
              {readableStatus(status)}
            </option>
          ))}
        </select>
      </label>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const body = String(data.get('reply') ?? '').trim();
          if (body) props.onReply(ticket.ticketId, body, ticket.version);
        }}
      >
        <label>
          Reply in One Time
          <textarea name="reply" required maxLength={6000} />
        </label>
        <button type="submit">Send in-app reply</button>
      </form>
      <details>
        <summary>Audit history ({ticket.audit.length})</summary>
        <ol>
          {ticket.audit.map((event) => (
            <li key={event.eventId}>
              {event.action.replaceAll('_', ' ')} at <time dateTime={event.at}>{event.at}</time>
            </li>
          ))}
        </ol>
      </details>
    </article>
  );
}

function navigateInApp(
  event: React.MouseEvent<HTMLAnchorElement>,
  onNavigate?: ((href: string) => void) | undefined,
) {
  if (
    !onNavigate ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }
  event.preventDefault();
  const href = event.currentTarget.getAttribute('href');
  if (href) onNavigate(href);
}

function allowedTransitions(status: SupportLifecycleState): readonly SupportLifecycleState[] {
  if (status === 'open') return ['in_progress', 'closed'];
  if (status === 'in_progress') return ['waiting_on_requester', 'resolved', 'closed'];
  if (status === 'waiting_on_requester') return ['in_progress', 'resolved', 'closed'];
  if (status === 'resolved') return ['in_progress', 'closed'];
  return [];
}

function readableStatus(status: SupportLifecycleState) {
  const text = status.replaceAll('_', ' ');
  return text.replace(/^\w/u, (letter) => letter.toUpperCase());
}
