import React from 'react';
import {
  SUPPORT_LIFECYCLE_STATES,
  type SupportAdminView,
  type SupportLifecycleState,
} from '../../../../../../../packages/contracts/src/support/v21.ts';
import { V21StatePanel } from '../../../../../../../packages/brand-system/src/react-v21.tsx';

export function AdminSupportWorkspace(props: {
  tickets: readonly SupportAdminView[];
  onNavigate?: ((href: string) => void) | undefined;
  onAssign: (ticketId: string, assigneeAdminId: string, expectedVersion: number) => void;
  onStatus: (ticketId: string, status: SupportLifecycleState, expectedVersion: number) => void;
  onReply: (ticketId: string, body: string, expectedVersion: number) => void;
}) {
  return (
    <section className="support-admin-workspace" aria-labelledby="admin-support-title">
      <h2 id="admin-support-title">Support operations</h2>
      <p>
        One Time remains the source of truth. Telegram receives only redacted operator
        notifications.
      </p>
      {props.tickets.length === 0 ? (
        <V21StatePanel kind="empty" title="No support conversations">
          <p>New technical requests and private Rabbi questions will appear in their own queues.</p>
        </V21StatePanel>
      ) : (
        <ol aria-label="Support conversations">
          {props.tickets.map((ticket) => (
            <li key={ticket.ticketId}>
              <article aria-labelledby={`ticket-${ticket.ticketId}`}>
                <h2 id={`ticket-${ticket.ticketId}`}>{ticket.subject}</h2>
                <dl>
                  <dt>Queue</dt>
                  <dd>
                    {ticket.kind === 'rabbi_question' ? 'Rabbi questions' : 'Technical support'}
                  </dd>
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
                      <strong>
                        {message.authorRole === 'admin' ? 'Admin' : message.authorRole}
                      </strong>
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
                          status !== ticket.status &&
                          !allowedTransitions(ticket.status).includes(status)
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
                        {event.action.replaceAll('_', ' ')} at{' '}
                        <time dateTime={event.at}>{event.at}</time>
                      </li>
                    ))}
                  </ol>
                </details>
              </article>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
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
