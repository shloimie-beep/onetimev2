import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CommunicationsChannel,
  CommunicationsIntentType,
  CommunicationsListResponse,
  CommunicationsLocalState,
} from '../../../../../../packages/contracts/src/communications/index.ts';
import './communications.css';

type Props = {
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

export function CommunicationsFeature({ onProtectedStateCleared }: Props) {
  const [from, setFrom] = useState(() => dateInput(daysAgo(30)));
  const [to, setTo] = useState(() => dateInput(new Date()));
  const [intentType, setIntentType] = useState('');
  const [status, setStatus] = useState('');
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const retryRef = useRef<HTMLButtonElement | null>(null);

  const endpoint = '/api/v1/communications';

  const filters = useMemo(
    () => ({ from, to, intent_type: intentType, status }),
    [from, intentType, status, to],
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
      performance.mark('ot-communications-global-usable');
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
            One Time account-email delivery history from info@. This read-only list covers setup,
            password reset, and Student credentials; general adult communication lives in GHL, and
            Students never become GHL contacts.
          </p>
        </div>
      </header>

      <CommunicationsRoutingGuide />

      {data && (
        <section className="communications-truth" aria-label="Communications source truth">
          <span>One Time account email only</span>
          <span>Read-only info@ delivery history</span>
          <span>Redacted and read-only</span>
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
          <span>Intent type</span>
          <select value={intentType} onChange={(event) => setIntentType(event.target.value)}>
            <option value="">All</option>
            <option value="password_reset">Password reset</option>
            <option value="account_activation">Account setup</option>
            <option value="student_pin_setup">Student PIN setup</option>
            <option value="student_pin_reset">Student PIN reset</option>
          </select>
        </label>
        <label>
          <span>Truth status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All</option>
            <option value="queued">Queued</option>
            <option value="provider_accepted">Provider accepted</option>
            <option value="delivered">Delivered</option>
            <option value="sink_delivered">Processed by non-provider sink</option>
            <option value="failed">Failed</option>
            <option value="bounced">Bounced</option>
            <option value="complained">Complained</option>
            <option value="unknown">Unknown</option>
            <option value="retrying">Retry scheduled</option>
            <option value="expired">Expired</option>
            <option value="superseded">Superseded</option>
            <option value="provider_off">Provider off</option>
            <option value="cleared">Sensitive payload cleared</option>
          </select>
        </label>
        <div className="communications-filter-actions">
          <button type="submit">Apply</button>
          <button
            type="button"
            onClick={() => {
              setFrom(dateInput(daysAgo(30)));
              setTo(dateInput(new Date()));
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
          Loading account delivery history...
        </p>
      )}
      {state.kind === 'empty' && (
        <StatePanel title="No matching account delivery history">
          No setup, reset, or PIN delivery records for active One Time accounts matched these
          filters.
        </StatePanel>
      )}
      {state.kind === 'unavailable' && (
        <StatePanel title="Account delivery history unavailable">
          One Time could not read the local account delivery history. No external mailbox state is
          inferred.
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
                <th scope="col">Account and destination</th>
                <th scope="col">Account email</th>
                <th scope="col">Delivery state</th>
                <th scope="col">Time</th>
                <th scope="col">State time</th>
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

export function CommunicationsRoutingGuide() {
  return (
    <section className="communications-routing" aria-labelledby="communications-routing-heading">
      <h2 id="communications-routing-heading">Where communications work happens</h2>
      <p>
        This page is read-only context. Use the source of truth below for live adult communication
        work.
      </p>
      <dl className="communications-routing-grid">
        <div>
          <dt>Office, access, schedule, and support</dt>
          <dd>
            Use <strong>One Time Mishnayos &lt;info@onetimeonetime.com&gt;</strong>. Continue adult
            conversations and replies in GHL Conversations.
          </dd>
        </div>
        <div>
          <dt>Rabbi teaching and program mail</dt>
          <dd>
            Use <strong>Rabbi Eli Scheller &lt;rabbielischeller@onetimeonetime.com&gt;</strong> and
            keep the adult conversation in GHL.
          </dd>
        </div>
        <div>
          <dt>Class reminders</dt>
          <dd>
            Live schedule, adult recipient, enrollment, and delivery truth stays in GHL. This page
            does not schedule or send reminders.{' '}
            <a href="/app/communications/OT-09">Open OT-09 readback</a>.
          </dd>
        </div>
        <div>
          <dt>Support tickets</dt>
          <dd>
            One Time is the ticket source of truth; an adult ticket may keep a safe GHL conversation
            reference. Student support stays in One Time and never creates a GHL contact.{' '}
            <a href="/app/tickets">Open ticket queue</a>.
          </dd>
        </div>
      </dl>
    </section>
  );
}

type Item = CommunicationsListResponse['items'][number];

function CommunicationRow({ item }: { item: Item }) {
  return (
    <tr>
      <td>
        <strong>{item.participant_label}</strong>
        <span>{item.recipient_masked}</span>
      </td>
      <td>
        <strong>{item.thread_label}</strong>
        <span>{item.preview_redacted}</span>
      </td>
      <td>{item.state_label}</td>
      <td>{formatDate(item.occurred_at)}</td>
      <td>{item.state_at ? formatDate(item.state_at) : 'Unavailable'}</td>
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
          <dt>Destination</dt>
          <dd>{item.recipient_masked}</dd>
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
      {item.household_path && <a href={item.household_path}>View Family</a>}
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
    intent_type: string;
    status: string;
  },
  cursor: string | undefined,
  signal: AbortSignal,
) {
  const params = new URLSearchParams();
  params.set('from', new Date(`${filters.from}T00:00:00.000Z`).toISOString());
  params.set('to', new Date(`${filters.to}T23:59:59.999Z`).toISOString());
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
    source_scope: 'canonical_communication_history',
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
      draft_only_replies: false,
      transport_send: false,
      resend: false,
      campaigns: false,
      templates: false,
      integration_settings: false,
      historical_backfill_dry_run: false,
      provider_history_complete: false,
      stored_webhooks: false,
      channels: ['email'] satisfies CommunicationsChannel[],
      directions: ['outbound'],
      intent_types: [
        'password_reset',
        'account_activation',
        'student_pin_setup',
        'student_pin_reset',
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
        'sink_delivered',
        'duplicate',
        'unknown',
        'retrying',
        'expired',
        'superseded',
        'provider_off',
        'cleared',
        'history_unavailable',
      ] satisfies CommunicationsLocalState[],
      sources: ['account_lifecycle_outbox'],
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
