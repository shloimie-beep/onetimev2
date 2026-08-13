import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CommunicationsChannel,
  CommunicationsIntentType,
  CommunicationsListResponse,
  CommunicationsLocalState,
} from '../../../../../../packages/contracts/src/communications/index.ts';
import './communications.css';

type Props = {
  contactId?: string | undefined;
  onProtectedStateCleared?: (() => void) | undefined;
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; data: CommunicationsListResponse }
  | { kind: 'empty'; data: CommunicationsListResponse }
  | { kind: 'unavailable'; data: CommunicationsListResponse }
  | { kind: 'validation_error'; message: string }
  | { kind: 'unauthenticated'; message: string }
  | { kind: 'forbidden'; message: string }
  | { kind: 'not_found'; message: string }
  | { kind: 'error'; message: string };

export function CommunicationsFeature({ contactId, onProtectedStateCleared }: Props) {
  const [from, setFrom] = useState(() => dateInput(daysAgo(30)));
  const [to, setTo] = useState(() => dateInput(new Date()));
  const [channel, setChannel] = useState('');
  const [direction, setDirection] = useState('');
  const [intentType, setIntentType] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const retryRef = useRef<HTMLButtonElement | null>(null);

  const endpoint = contactId
    ? `/api/v1/crm/contacts/${encodeURIComponent(contactId)}/communications`
    : '/api/v1/communications';

  const filters = useMemo(
    () => ({ from, to, channel, direction, intent_type: intentType, status, source }),
    [channel, direction, from, intentType, source, status, to],
  );

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [endpoint]);

  async function load(cursor?: string) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (!cursor) setState({ kind: 'loading' });
    else setLoadingMore(true);
    try {
      const data = await requestCommunications(endpoint, filters, cursor, controller.signal);
      setNextCursor(data.next_cursor);
      setState((current) => {
        if (cursor && (current.kind === 'ready' || current.kind === 'empty')) {
          const merged = { ...data, items: [...current.data.items, ...data.items] };
          return merged.items.length
            ? { kind: 'ready', data: merged }
            : { kind: 'empty', data: merged };
        }
        if (data.availability === 'unavailable') return { kind: 'unavailable', data };
        if (!data.items.length) return { kind: 'empty', data };
        return { kind: 'ready', data };
      });
      performance.mark(
        contactId ? 'ot-communications-contact-usable' : 'ot-communications-global-usable',
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      const mapped = mapError(error);
      if (mapped.kind === 'unauthenticated') {
        abortRef.current?.abort();
        setNextCursor(null);
        onProtectedStateCleared?.();
      }
      setState(mapped);
    } finally {
      setLoadingMore(false);
    }
  }

  const data = 'data' in state ? state.data : null;
  return (
    <section className="communications-surface" aria-labelledby="communications-heading">
      <header className="communications-header">
        <div>
          <h1 id="communications-heading">Communications</h1>
          <p>
            Adult conversation context for Rabbi and Admin. GHL Conversations is the live mailbox
            for <strong>info@onetimeonetime.com</strong>. One Time separately shows redacted reset
            and setup delivery status here; it never creates Student contacts.
          </p>
        </div>
      </header>

      {data && (
        <section className="communications-truth" aria-label="Communications source truth">
          <span>Adult-only conversations</span>
          <span>Redacted account-security delivery</span>
          <span>
            {data.mailbox_complete ? 'Mailbox history available' : 'GHL mailbox connection pending'}
          </span>
          <span>
            {data.capabilities.transport_send
              ? 'Governed send available'
              : 'Reply in GHL Conversations'}
          </span>
        </section>
      )}

      <form
        className="communications-filters"
        aria-label="Communications filters"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <label>
          <span>From</span>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label>
          <span>To</span>
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <label>
          <span>Channel</span>
          <select value={channel} onChange={(event) => setChannel(event.target.value)}>
            <option value="">All</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="internal_email">Internal email</option>
          </select>
        </label>
        <label>
          <span>Direction</span>
          <select value={direction} onChange={(event) => setDirection(event.target.value)}>
            <option value="">All</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
            <option value="internal">Internal</option>
          </select>
        </label>
        <label>
          <span>Intent type</span>
          <select value={intentType} onChange={(event) => setIntentType(event.target.value)}>
            <option value="">All</option>
            <option value="family_signup_email_ack">Family signup email acknowledgement</option>
            <option value="family_signup_whatsapp_confirmation">
              Family signup WhatsApp confirmation
            </option>
            <option value="internal_lead_alert">Internal owner alert</option>
            <option value="single_recipient_reply">Single-recipient reply</option>
            <option value="password_reset">Password reset</option>
            <option value="account_activation">Account setup</option>
            <option value="student_pin_setup">Student PIN setup</option>
            <option value="student_pin_reset">Student PIN reset</option>
            <option value="whatsapp_inbound_message">WhatsApp inbound message</option>
            <option value="whatsapp_provider_event">WhatsApp provider event</option>
            <option value="historical_import_event">Historical import event</option>
            <option value="history_unavailable">History unavailable</option>
          </select>
        </label>
        <label>
          <span>Truth status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All</option>
            <option value="queued">Queued</option>
            <option value="provider_accepted">Provider accepted</option>
            <option value="provider_sent">Provider sent</option>
            <option value="delivered">Delivered</option>
            <option value="read">Read</option>
            <option value="received">Received</option>
            <option value="processed">Processed</option>
            <option value="failed">Failed</option>
            <option value="bounced">Bounced</option>
            <option value="complained">Complained</option>
            <option value="suppressed">Suppressed</option>
            <option value="draft_saved">Draft saved/provider off</option>
            <option value="duplicate">Duplicate ignored</option>
            <option value="unknown">Unknown</option>
            <option value="retrying">Retry scheduled</option>
            <option value="expired">Expired</option>
            <option value="superseded">Superseded</option>
            <option value="provider_off">Provider off</option>
            <option value="cleared">Sensitive payload cleared</option>
            <option value="history_unavailable">History unavailable</option>
          </select>
        </label>
        <label>
          <span>Source</span>
          <select value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="">All</option>
            <option value="canonical_history_event">Canonical history</option>
            <option value="local_outbox_intent">Local outbound intent</option>
            <option value="crm_reply_draft">Provider-off draft</option>
            <option value="stored_whatsapp_webhook">Stored WhatsApp webhook</option>
            <option value="stored_provider_delivery_event">Stored provider status</option>
            <option value="account_lifecycle_outbox">Account security delivery</option>
            <option value="historical_import">Historical import</option>
            <option value="provider_history_unavailable">History unavailable</option>
          </select>
        </label>
        <div className="communications-filter-actions">
          <button type="submit">Apply</button>
          <button
            type="button"
            onClick={() => {
              setFrom(dateInput(daysAgo(30)));
              setTo(dateInput(new Date()));
              setChannel('');
              setDirection('');
              setIntentType('');
              setStatus('');
              setSource('');
              void load();
            }}
          >
            Clear
          </button>
        </div>
      </form>

      {state.kind === 'loading' && (
        <p className="communications-loading" role="status">
          Loading communication history...
        </p>
      )}
      {state.kind === 'empty' && (
        <StatePanel
          title={
            data?.mailbox_complete
              ? 'No matching adult conversations'
              : 'Rabbi inbox is not connected yet'
          }
        >
          {data?.mailbox_complete
            ? 'No adult conversation records matched this filter.'
            : 'No email is being hidden. Connect and route info@onetimeonetime.com in GHL, then use GHL Conversations for inbound mail and replies. One Time will keep its local delivery record separate.'}
        </StatePanel>
      )}
      {state.kind === 'unavailable' && (
        <StatePanel title="Historical provider history unavailable">
          This does not mean the adult inbox is empty. GHL Conversations remains the source of truth
          until its governed mailbox history is available here.
        </StatePanel>
      )}
      {state.kind === 'validation_error' && (
        <ErrorPanel message={state.message} retry={() => retryRef.current?.focus()} />
      )}
      {state.kind === 'error' && (
        <ErrorPanel message={state.message} retry={() => void load()} retryRef={retryRef} />
      )}
      {state.kind === 'unauthenticated' && <ErrorPanel message={state.message} />}
      {state.kind === 'forbidden' && <ErrorPanel message={state.message} />}
      {state.kind === 'not_found' && <ErrorPanel message={state.message} />}

      {data && data.items.length > 0 && (
        <>
          <table className="communications-table">
            <thead>
              <tr>
                <th scope="col">Recipient</th>
                <th scope="col">Thread</th>
                <th scope="col">Channel</th>
                <th scope="col">Direction</th>
                <th scope="col">Truth status</th>
                <th scope="col">Source</th>
                <th scope="col">Time</th>
                <th scope="col">State time</th>
                <th scope="col">Contact</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, index) => (
                <CommunicationRow item={item} key={`${item.queued_at}-${index}`} />
              ))}
            </tbody>
          </table>
          <div className="communications-cards">
            {data.items.map((item, index) => (
              <article
                className="communications-card"
                aria-label={`${item.event_label}, ${item.state_label}`}
                key={`${item.queued_at}-${index}`}
              >
                <CommunicationSummary item={item} />
              </article>
            ))}
          </div>
          {nextCursor && (
            <button
              type="button"
              className="communications-load-more"
              onClick={() => void load(nextCursor)}
            >
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          )}
        </>
      )}
    </section>
  );
}

type Item = CommunicationsListResponse['items'][number];

function CommunicationRow({ item }: { item: Item }) {
  return (
    <tr>
      <td>{item.recipient_masked}</td>
      <td>
        <strong>{item.thread_label}</strong>
        <span>{item.preview_redacted}</span>
      </td>
      <td>{labelChannel(item.channel)}</td>
      <td>{labelDirection(item.direction)}</td>
      <td>{item.state_label}</td>
      <td>{item.source_label}</td>
      <td>{formatDate(item.occurred_at)}</td>
      <td>{item.state_at ? formatDate(item.state_at) : 'Unavailable'}</td>
      <td>{item.contact_path ? <a href={item.contact_path}>View contact</a> : 'Unavailable'}</td>
    </tr>
  );
}

function CommunicationSummary({ item }: { item: Item }) {
  return (
    <>
      <h2>{item.thread_label}</h2>
      <p>{item.preview_redacted}</p>
      <dl>
        <div>
          <dt>Participant</dt>
          <dd>{item.participant_label}</dd>
        </div>
        <div>
          <dt>Channel</dt>
          <dd>{labelChannel(item.channel)}</dd>
        </div>
        <div>
          <dt>Direction</dt>
          <dd>{labelDirection(item.direction)}</dd>
        </div>
        <div>
          <dt>Truth status</dt>
          <dd>{item.state_label}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{item.source_label}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>{formatDate(item.occurred_at)}</dd>
        </div>
      </dl>
      {item.draft_only && (
        <p className="communications-draft-note">Draft only. No send happened.</p>
      )}
      {item.contact_path && <a href={item.contact_path}>View contact</a>}
      {!item.contact_path && item.household_path && (
        <a href={item.household_path}>View household</a>
      )}
    </>
  );
}

function StatePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="communications-state"
      aria-labelledby={title.replaceAll(' ', '-').toLowerCase()}
    >
      <h2 id={title.replaceAll(' ', '-').toLowerCase()}>{title}</h2>
      <p>{children}</p>
    </section>
  );
}

function ErrorPanel({
  message,
  retry,
  retryRef,
}: {
  message: string;
  retry?: (() => void) | undefined;
  retryRef?: React.RefObject<HTMLButtonElement | null> | undefined;
}) {
  return (
    <section className="communications-error" role="alert">
      <h2>Communications could not load</h2>
      <p>{message}</p>
      {retry && (
        <button type="button" ref={retryRef} onClick={retry}>
          Retry
        </button>
      )}
    </section>
  );
}

async function requestCommunications(
  endpoint: string,
  filters: {
    from: string;
    to: string;
    channel: string;
    direction: string;
    intent_type: string;
    status: string;
    source: string;
  },
  cursor: string | undefined,
  signal: AbortSignal,
) {
  const params = new URLSearchParams();
  params.set('from', new Date(`${filters.from}T00:00:00.000Z`).toISOString());
  params.set('to', new Date(`${filters.to}T23:59:59.999Z`).toISOString());
  if (filters.channel) params.set('channel', filters.channel);
  if (filters.direction) params.set('direction', filters.direction);
  if (filters.intent_type) params.set('intent_type', filters.intent_type);
  if (filters.status) params.set('status', filters.status);
  if (filters.source) params.set('source', filters.source);
  const headers: Record<string, string> = { accept: 'application/json' };
  if (cursor) headers['x-ot-communications-cursor'] = cursor;
  const response = await fetch(`${endpoint}?${params.toString()}`, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers,
    signal,
  });
  const json = (await response.json()) as CommunicationsListResponse | { message?: string };
  if (!response.ok || !('success' in json) || json.success !== true) {
    throw new ResponseError(response.status, 'message' in json ? json.message : undefined);
  }
  return json;
}

class ResponseError extends Error {
  constructor(
    readonly status: number,
    message = 'Request failed.',
  ) {
    super(message);
  }
}

function mapError(error: unknown): LoadState {
  if (error instanceof ResponseError) {
    if (error.status === 400) return { kind: 'validation_error', message: error.message };
    if (error.status === 401)
      return { kind: 'unauthenticated', message: 'Session expired. Please log in again.' };
    if (error.status === 403)
      return { kind: 'forbidden', message: 'Your role cannot read Communications.' };
    if (error.status === 404) return { kind: 'not_found', message: 'Contact was not found.' };
    if (error.status === 503) {
      return {
        kind: 'unavailable',
        data: emptyUnavailableResponse(),
      };
    }
    return { kind: 'error', message: error.message };
  }
  return { kind: 'error', message: 'Network error. Try again.' };
}

function emptyUnavailableResponse(): CommunicationsListResponse {
  const now = new Date();
  return {
    success: true,
    availability: 'unavailable',
    source_scope: 'canonical_communication_history',
    mailbox_complete: false,
    capabilities: {
      read: true,
      provider_acceptance: false,
      provider_delivery: false,
      inbound_import: false,
      replies: true,
      threads: true,
      subject_body_access: false,
      attachments: false,
      reminder_execution: false,
      compose: true,
      draft_only_replies: true,
      transport_send: false,
      resend: false,
      campaigns: false,
      templates: false,
      integration_settings: false,
      historical_backfill_dry_run: true,
      provider_history_complete: false,
      stored_webhooks: true,
      channels: ['email', 'whatsapp', 'internal_email'] satisfies CommunicationsChannel[],
      directions: ['inbound', 'outbound', 'internal'],
      intent_types: [
        'family_signup_email_ack',
        'family_signup_whatsapp_confirmation',
        'internal_lead_alert',
        'single_recipient_reply',
        'password_reset',
        'account_activation',
        'student_pin_setup',
        'student_pin_reset',
        'whatsapp_inbound_message',
        'whatsapp_provider_event',
        'historical_import_event',
        'history_unavailable',
      ] satisfies CommunicationsIntentType[],
      local_states: [
        'queued',
        'provider_accepted',
        'provider_sent',
        'delivered',
        'read',
        'received',
        'processed',
        'failed',
        'bounced',
        'complained',
        'suppressed',
        'draft_saved',
        'duplicate',
        'unknown',
        'retrying',
        'expired',
        'superseded',
        'provider_off',
        'cleared',
        'history_unavailable',
      ] satisfies CommunicationsLocalState[],
      sources: [
        'canonical_history_event',
        'local_outbox_intent',
        'crm_reply_draft',
        'stored_whatsapp_webhook',
        'stored_provider_delivery_event',
        'account_lifecycle_outbox',
        'historical_import',
        'provider_history_unavailable',
      ],
    },
    applied_filters: {
      from: daysAgo(30).toISOString(),
      to: now.toISOString(),
      limit: 25,
    },
    items: [],
    next_cursor: null,
  };
}

function labelChannel(value: string) {
  return value === 'internal_email'
    ? 'Internal email'
    : value.replace(/^\w/, (letter) => letter.toUpperCase());
}

function labelDirection(value: string) {
  if (value === 'inbound') return 'Inbound';
  if (value === 'outbound') return 'Outbound';
  return 'Internal';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}
