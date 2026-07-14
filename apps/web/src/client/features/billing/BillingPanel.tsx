import type { BillingSummaryDto } from '../../../../../../packages/contracts/src/billing/index.ts';
import './billing-panel.css';

type BillingPanelProps = {
  summary: BillingSummaryDto | null;
  loading?: boolean;
  disabled?: boolean;
  error?: string | null;
  onCheckout?: () => void;
  onPortal?: () => void;
};

export function BillingPanel({
  summary,
  loading = false,
  disabled = true,
  error = null,
  onCheckout,
  onPortal,
}: BillingPanelProps) {
  if (loading) {
    return (
      <section className="billing-panel" aria-busy="true">
        <h2>Billing</h2>
        <p className="billing-muted">Loading billing summary.</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="billing-panel" role="alert">
        <h2>Billing</h2>
        <p className="billing-error">{error}</p>
      </section>
    );
  }

  if (disabled || !summary) {
    return (
      <section className="billing-panel">
        <h2>Billing</h2>
        <p className="billing-muted">Billing is not enabled for this account.</p>
      </section>
    );
  }

  return (
    <section className="billing-panel">
      <div className="billing-panel__header">
        <h2>Billing</h2>
        <span data-status={summary.entitlement?.status ?? 'pending'}>
          {summary.entitlement?.status ?? 'pending'}
        </span>
      </div>
      <dl>
        <div>
          <dt>Subscription</dt>
          <dd>{summary.subscription?.status ?? 'No subscription'}</dd>
        </div>
        <div>
          <dt>Policy</dt>
          <dd>{summary.entitlement?.policy_version ?? 'Not evaluated'}</dd>
        </div>
      </dl>
      {summary.manual_review ? (
        <p className="billing-warning">Manual review is required before this projection changes.</p>
      ) : null}
      <div className="billing-panel__actions">
        <button type="button" onClick={onCheckout}>
          Checkout
        </button>
        <button type="button" onClick={onPortal}>
          Portal
        </button>
      </div>
    </section>
  );
}
