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
  basePath?: '/app/student/support';
  onProtectedStateCleared: () => void;
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'receipt'; receipt: SupportTicketSummary }
  | { kind: 'error'; message: string };

const defaultCategories = [
  { value: 'access_login', label: 'Access/login' },
  { value: 'class_zoom', label: 'Class/Zoom' },
  { value: 'billing', label: 'Billing' },
  { value: 'content', label: 'Content' },
  { value: 'technical_bug', label: 'Technical bug' },
  { value: 'account_family', label: 'Account/family' },
  { value: 'other', label: 'Other' },
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
    let attachments: Awaited<ReturnType<typeof readAttachments>>;
    try {
      attachments = await readAttachments(formData.getAll('attachments'));
    } catch {
      setStatus('Attachment could not be read. Remove it and try again.');
      setSaving(false);
      window.setTimeout(() => form.querySelector<HTMLInputElement>('input[type="file"]')?.focus());
      return;
    }
    try {
      const response = await submitSupportTicket(eligibility.csrf_token, {
        category: stringValue(formData, 'category'),
        title: stringValue(formData, 'title'),
        message: stringValue(formData, 'message'),
        reply_preference: stringValue(formData, 'reply_preference') || 'in_app',
        issue_details: {
          steps_to_reproduce: stringValue(formData, 'steps_to_reproduce')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .slice(0, 10),
          expected_behavior: nullableString(formData, 'expected_behavior'),
          actual_behavior: nullableString(formData, 'actual_behavior'),
          occurrence: stringValue(formData, 'occurrence') || 'not_applicable',
          first_observed_at: null,
          error_code: nullableString(formData, 'error_code'),
          provider: stringValue(formData, 'provider') || 'none',
        },
        client_context: {
          route_template: normalizedRouteTemplate(location.pathname),
          app_release: 'web-shell',
          locale: navigator.language || 'en-US',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        },
        attachments,
        idempotency_key: stringValue(formData, 'idempotency_key') || idempotencyRef.current,
      });
      setStatus(
        response.duplicate_submission
          ? 'Support request was already saved. Opening receipt.'
          : 'Support request saved. Opening receipt.',
      );
      const receiptKey = response.status_path.split('/').filter(Boolean).at(-1);
      window.location.assign(
        receiptKey ? `${basePath}/${encodeURIComponent(receiptKey)}` : basePath,
      );
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
            <select name="category" required defaultValue="technical_bug">
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
          <label>
            <span>Steps to reproduce</span>
            <textarea name="steps_to_reproduce" maxLength={5000} rows={4} />
          </label>
          <div className="form-grid">
            <label>
              <span>Expected behavior</span>
              <textarea name="expected_behavior" maxLength={1500} rows={3} />
            </label>
            <label>
              <span>Actual behavior</span>
              <textarea name="actual_behavior" maxLength={1500} rows={3} />
            </label>
          </div>
          <div className="form-grid">
            <label>
              <span>Occurrence</span>
              <select name="occurrence" defaultValue="not_applicable">
                <option value="not_applicable">Not applicable</option>
                <option value="once">Once</option>
                <option value="intermittent">Intermittent</option>
                <option value="always">Always</option>
              </select>
            </label>
            <label>
              <span>Provider area</span>
              <select name="provider" defaultValue="none">
                <option value="none">None</option>
                <option value="authentication">Authentication</option>
                <option value="zoom">Zoom</option>
                <option value="payments">Payments</option>
                <option value="content_delivery">Content delivery</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
          <div className="form-grid">
            <label>
              <span>Error code</span>
              <input name="error_code" maxLength={100} pattern="[A-Z0-9][A-Z0-9._:-]{0,99}" />
            </label>
            <label>
              <span>Reply preference</span>
              <select name="reply_preference" defaultValue="in_app">
                <option value="in_app">In app</option>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </label>
          </div>
          <label>
            <span>Attachments</span>
            <input
              name="attachments"
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,text/plain"
            />
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
  basePath: '/app/student/support';
}) {
  return tickets.map((ticket) => (
    <a key={ticket.receipt_id} href={`${basePath}/${encodeURIComponent(ticket.receipt_id)}`}>
      <strong>{readableState(ticket.status)}</strong>
      <span>{deliveryLabel(ticket.delivery_state)}</span>
      <small>{formatDate(ticket.updated_at)}</small>
    </a>
  ));
}

async function readAttachments(values: FormDataEntryValue[]) {
  const files = values.filter((value): value is File => value instanceof File && value.size > 0);
  const output: Array<{ filename: string; media_type: string; content_base64: string }> = [];
  for (const file of files.slice(0, 3)) {
    const buffer = await file.arrayBuffer();
    output.push({
      filename: file.name,
      media_type: file.type || 'application/octet-stream',
      content_base64: arrayBufferToBase64(buffer),
    });
  }
  return output;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function stringValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function nullableString(formData: FormData, name: string) {
  const value = stringValue(formData, name);
  return value ? value : null;
}

function normalizedRouteTemplate(pathname: string) {
  return pathname
    .replace(/[?#].*$/u, '')
    .replace(/[A-Za-z0-9_-]{16,}/gu, '[id]')
    .slice(0, 255);
}

function supportIdempotencyKey() {
  if ('crypto' in window && typeof crypto.randomUUID === 'function') {
    return `support-${crypto.randomUUID()}`;
  }
  return `support-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function deliveryLabel(value: string) {
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
