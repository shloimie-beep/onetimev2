import React, { useEffect, useRef, useState } from 'react';
import {
  getSupportEligibility,
  getSupportReceiptStatus,
  listSupportTickets,
  submitSupportTicket,
  type SupportEligibilityResponse,
  type SupportTicketSummary,
} from '../crm-api.js';

type Props = {
  receiptId?: string | undefined;
  basePath?: '/app/student/support' | '/app/parent/support';
  onProtectedStateCleared: () => void;
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'receipt'; receipt: SupportTicketSummary }
  | { kind: 'error'; message: string };

const defaultCategories = [
  { value: 'technical', label: 'Technical support' },
  { value: 'access', label: 'Access/login' },
  { value: 'billing', label: 'Billing' },
  { value: 'support', label: 'Account/family' },
];

export function SupportFeature({
  receiptId,
  basePath = '/app/student/support',
  onProtectedStateCleared,
}: Props) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [eligibility, setEligibility] = useState<SupportEligibilityResponse | null>(null);
  const [tickets, setTickets] = useState<SupportTicketSummary[]>([]);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const idempotencyRef = useRef(supportIdempotencyKey());
  const statusRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    void load();
  }, [receiptId]);

  async function load() {
    setState({ kind: 'loading' });
    try {
      if (receiptId) {
        const response = await getSupportReceiptStatus(receiptId);
        setState({ kind: 'receipt', receipt: response.receipt });
        return;
      }
      const [nextEligibility, nextTickets] = await Promise.all([
        getSupportEligibility(),
        listSupportTickets(),
      ]);
      setEligibility(nextEligibility);
      setTickets(nextTickets.tickets);
      setState({ kind: 'ready' });
      performance.mark('ot-support-shell-usable');
    } catch (error) {
      if (isAuthError(error)) {
        onProtectedStateCleared();
        return;
      }
      setState({ kind: 'error', message: errorMessage(error, 'Support could not load.') });
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!eligibility) return;
    setSaving(true);
    setStatus('Saving support request...');
    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      const response = await submitSupportTicket(eligibility.csrf_token, {
        category: stringValue(formData, 'category'),
        title: stringValue(formData, 'title'),
        message: stringValue(formData, 'message'),
        idempotency_key: stringValue(formData, 'idempotency_key') || idempotencyRef.current,
      });
      setStatus(
        response.duplicate_submission
          ? 'Support request was already saved. Opening receipt.'
          : 'Support request saved. Opening receipt.',
      );
      window.location.assign(`${basePath}/${encodeURIComponent(response.receipt_id)}`);
    } catch (error) {
      setStatus(supportSubmitErrorMessage(error));
      setSaving(false);
      window.setTimeout(() => statusRef.current?.focus());
    }
  }

  if (state.kind === 'loading') {
    return (
      <section className="state-panel" role="status">
        <h2>Loading support</h2>
      </section>
    );
  }

  if (state.kind === 'receipt') {
    return (
      <section className="support-shell" aria-labelledby="support-receipt-title">
        <h2 id="support-receipt-title">Support Receipt</h2>
        <dl className="detail-grid">
          <div>
            <dt>Status</dt>
            <dd>{readableState(state.receipt.status)}</dd>
          </div>
          <div>
            <dt>Delivery</dt>
            <dd>{deliveryLabel(state.receipt.delivery_state)}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{formatDate(state.receipt.updated_at)}</dd>
          </div>
        </dl>
        <p>{state.receipt.public_summary}</p>
        <ol className="support-message-list" aria-label="Support conversation">
          {(state.receipt.messages ?? []).map((message) => (
            <li key={message.messageId}>
              <strong>{message.authorRole === 'admin' ? 'One Time support' : 'You'}</strong>
              <p>{message.body}</p>
              <time dateTime={message.createdAt}>{formatDate(message.createdAt)}</time>
            </li>
          ))}
        </ol>
        <a className="button-secondary" href={basePath}>
          Back to support
        </a>
      </section>
    );
  }

  if (state.kind === 'error') {
    return (
      <section className="state-panel error" role="alert">
        <h2>Support could not load</h2>
        <p>{state.message}</p>
        <button type="button" className="button-primary" onClick={() => void load()}>
          Retry
        </button>
      </section>
    );
  }

  const categories = eligibility?.categories.length ? eligibility.categories : defaultCategories;
  if (!eligibility?.can_create_ticket) {
    return (
      <section className="support-shell" aria-labelledby="support-unavailable-title">
        <h2 id="support-unavailable-title">Learning support is unavailable</h2>
        <p>
          Support is available after sign-in with current One Time learning access. For signup or
          account help, continue to the public help path.
        </p>
        <a className="button-primary" href="/signup">
          Continue to signup and help
        </a>
      </section>
    );
  }

  return (
    <section className="support-shell" aria-labelledby="support-heading">
      <div className="support-layout">
        <form className="editor-form support-form" data-support-form onSubmit={submit}>
          <input
            type="hidden"
            name="idempotency_key"
            data-idempotency-key
            value={idempotencyRef.current}
            readOnly
          />
          <h2 id="support-heading">Member Support</h2>
          <label>
            <span>Category</span>
            <select name="category" required defaultValue={categories[0]?.value}>
              {categories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Title</span>
            <input name="title" minLength={5} maxLength={120} required />
          </label>
          <label>
            <span>Message</span>
            <textarea name="message" minLength={20} maxLength={6000} rows={7} required />
          </label>
          <button className="button-primary" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Submit support request'}
          </button>
          <p ref={statusRef} className="form-status" role="status" tabIndex={-1}>
            {status}
          </p>
        </form>

        <aside className="support-ticket-list" aria-labelledby="support-ticket-list-title">
          <h2 id="support-ticket-list-title">Recent support</h2>
          {tickets.length === 0 ? (
            <p>No support requests yet.</p>
          ) : (
            <SupportTicketLinks tickets={tickets} basePath={basePath} />
          )}
        </aside>
      </div>
    </section>
  );
}

export function SupportTicketLinks({
  tickets,
  basePath,
}: {
  tickets: SupportTicketSummary[];
  basePath: '/app/student/support' | '/app/parent/support';
}) {
  return tickets.map((ticket) => (
    <a key={ticket.receipt_id} href={`${basePath}/${encodeURIComponent(ticket.receipt_id)}`}>
      <strong>{readableState(ticket.status)}</strong>
      <span>{deliveryLabel(ticket.delivery_state)}</span>
      <small>{formatDate(ticket.updated_at)}</small>
    </a>
  ));
}

function stringValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function supportIdempotencyKey() {
  if ('crypto' in window && typeof crypto.randomUUID === 'function') {
    return `support-${crypto.randomUUID()}`;
  }
  return `support-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function deliveryLabel(value: string) {
  if (value === 'saved_locally') return 'Saved in One Time';
  if (value === 'queued') return 'Queued for support desk';
  if (value === 'delivery_delayed') return 'Delivery delayed';
  if (value === 'delivered') return 'Accepted by support desk';
  if (value === 'dead_letter') return 'Needs admin review';
  return readableState(value);
}

function readableState(value: string) {
  return value.replaceAll('_', ' ').replace(/^\w/u, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function supportSubmitErrorMessage(error: unknown) {
  if (error instanceof TypeError) {
    return 'Network error. Support request was not saved. Please try again.';
  }
  if (error instanceof Error && /failed to fetch|network/i.test(error.message)) {
    return 'Network error. Support request was not saved. Please try again.';
  }
  return errorMessage(error, 'Support request was not saved. Please try again.');
}

function isAuthError(error: unknown) {
  return error instanceof Error && error.message === 'Session expired';
}
