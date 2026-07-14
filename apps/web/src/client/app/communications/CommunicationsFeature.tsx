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
  const [intentType, setIntentType] = useState('');
  const [status, setStatus] = useState('');
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const retryRef = useRef<HTMLButtonElement | null>(null);

  const endpoint = contactId
    ? `/api/v1/crm/contacts/${encodeURIComponent(contactId)}/communications`
    : '/api/v1/communications';

  const filters = useMemo(
    () => ({ from, to, channel, intent_type: intentType, status }),
    [channel, from, intentType, status, to],
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
      if (mapped.kind === 'unauthenticated' || mapped.kind === 'forbidden') {
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
            Local communication intents only. Provider delivery, inbound messages, replies, and
            mailbox completeness are unavailable.
          </p>
        </div>
      </header>

      <form
        className="communications-filters"
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
          <span>Intent type</span>
          <select value={intentType} onChange={(event) => setIntentType(event.target.value)}>
            <option value="">All</option>
            <option value="family_signup_email_ack">Family signup email acknowledgement</option>
            <option value="family_signup_whatsapp_confirmation">
              Family signup WhatsApp confirmation
            </option>
            <option value="school_signup_email_ack">School signup email acknowledgement</option>
            <option value="school_signup_whatsapp_receipt">School signup WhatsApp receipt</option>
            <option value="internal_lead_alert">Internal owner alert</option>
          </select>
        </label>
        <label>
          <span>Local status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All</option>
            <option value="intent_queued">Queued locally</option>
            <option value="sink_processed">Processed in test mode</option>
            <option value="status_unavailable">Status unavailable</option>
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
              setIntentType('');
              setStatus('');
              void load();
            }}
          >
            Clear
          </button>
        </div>
      </form>

      {state.kind === 'loading' && (
        <p className="communications-loading" role="status">
          Loading local communication intents...
        </p>
      )}
      {state.kind === 'empty' && (
        <StatePanel title="No local communication intents">
          No local communication intents were recorded in this date range.
        </StatePanel>
      )}
      {state.kind === 'unavailable' && (
        <StatePanel title="Communication status unavailable">
          Communication status is unavailable. This does not mean the inbox is empty.
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
                <th scope="col">Intent</th>
                <th scope="col">Channel</th>
                <th scope="col">Local status</th>
                <th scope="col">Queued</th>
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
      <td>{item.event_label}</td>
      <td>{labelChannel(item.channel)}</td>
      <td>{item.state_label}</td>
      <td>{formatDate(item.queued_at)}</td>
      <td>{item.state_at ? formatDate(item.state_at) : 'Unavailable'}</td>
      <td>{item.contact_path ? <a href={item.contact_path}>View contact</a> : 'Unavailable'}</td>
    </tr>
  );
}

function CommunicationSummary({ item }: { item: Item }) {
  return (
    <>
      <h2>{item.event_label}</h2>
      <p>{item.recipient_masked}</p>
      <dl>
        <div>
          <dt>Channel</dt>
          <dd>{labelChannel(item.channel)}</dd>
        </div>
        <div>
          <dt>Local status</dt>
          <dd>{item.state_label}</dd>
        </div>
        <div>
          <dt>Queued</dt>
          <dd>{formatDate(item.queued_at)}</dd>
        </div>
      </dl>
      {item.contact_path && <a href={item.contact_path}>View contact</a>}
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
    intent_type: string;
    status: string;
  },
  cursor: string | undefined,
  signal: AbortSignal,
) {
  const params = new URLSearchParams();
  params.set('from', new Date(`${filters.from}T00:00:00.000Z`).toISOString());
  params.set('to', new Date(`${filters.to}T23:59:59.999Z`).toISOString());
  if (filters.channel) params.set('channel', filters.channel);
  if (filters.intent_type) params.set('intent_type', filters.intent_type);
  if (filters.status) params.set('status', filters.status);
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
    source_scope: 'local_communication_intents_only',
    mailbox_complete: false,
    capabilities: {
      read: true,
      provider_acceptance: false,
      provider_delivery: false,
      inbound_import: false,
      replies: false,
      threads: false,
      subject_body_access: false,
      attachments: false,
      reminder_execution: false,
      compose: false,
      resend: false,
      campaigns: false,
      templates: false,
      integration_settings: false,
      channels: ['email', 'whatsapp', 'internal_email'] satisfies CommunicationsChannel[],
      intent_types: [
        'family_signup_email_ack',
        'family_signup_whatsapp_confirmation',
        'school_signup_email_ack',
        'school_signup_whatsapp_receipt',
        'internal_lead_alert',
      ] satisfies CommunicationsIntentType[],
      local_states: [
        'intent_queued',
        'sink_processed',
        'status_unavailable',
      ] satisfies CommunicationsLocalState[],
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
