import React from 'react';
import type {
  SupportAdminView,
  SupportLifecycleState,
} from '../../../../../../../packages/contracts/src/support/v21.ts';
import {
  V21AppShell,
  V21StatePanel,
} from '../../../../../../../packages/brand-system/src/react-v21.tsx';
import { ADMIN_PRIMARY_NAVIGATION } from '../../../../../../../packages/brand-system/src/v21.ts';

export function AdminSupportWorkspace(props: {
  tickets: readonly SupportAdminView[];
  onNavigate: (href: string) => void;
  onAssign: (ticketId: string, assigneeAdminId: string, expectedVersion: number) => void;
  onStatus: (ticketId: string, status: SupportLifecycleState, expectedVersion: number) => void;
  onReply: (ticketId: string, body: string, expectedVersion: number) => void;
}) {
  const navigation = ADMIN_PRIMARY_NAVIGATION.map((item) => ({ ...item, current: false }));
  return (
    <V21AppShell
      role="admin"
      title="Support operations"
      navigation={navigation}
      onNavigate={props.onNavigate}
    >
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
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="waiting_on_requester">Waiting on requester</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
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
    </V21AppShell>
  );
}
