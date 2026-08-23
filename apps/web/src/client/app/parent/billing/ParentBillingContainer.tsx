import React, { useEffect, useMemo, useState } from 'react';
import { V21StatePanel } from '../../../../../../../packages/brand-system/src/react-v21.tsx';
import { ParentBillingWorkspace } from './ParentBillingWorkspace.tsx';
import {
  createParentBillingApi,
  type ParentBillingBootstrap,
  type ParentBillingMutation,
} from './api.ts';

export function ParentBillingContainer({
  api: providedApi,
}: {
  api?: ReturnType<typeof createParentBillingApi>;
}) {
  const api = useMemo(() => providedApi ?? createParentBillingApi(), [providedApi]);
  const [billing, setBilling] = useState<ParentBillingBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [handoff, setHandoff] = useState('');
  const [immediateChargeAccepted, setImmediateChargeAccepted] = useState(false);

  useEffect(() => {
    let active = true;
    void api
      .load()
      .then((next) => {
        if (active) setBilling(next);
      })
      .catch((reason: unknown) => {
        if (active) setError(messageFrom(reason, 'Billing could not be loaded.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api]);

  const actions = useMemo(
    () => ({
      standard: () =>
        run(() =>
          api.checkout(
            { expectedVersion: requiredBilling(billing).projection.version, mode: 'standard' },
            requiredBilling(billing).csrf_token,
          ),
        ),
      immediate: () =>
        run(() =>
          api.checkout(
            {
              expectedVersion: requiredBilling(billing).projection.version,
              mode: 'immediate_exception',
              immediateChargeAccepted: true,
            },
            requiredBilling(billing).csrf_token,
          ),
        ),
      portal: () =>
        run(() =>
          api.openPortal(
            requiredBilling(billing).projection.version,
            requiredBilling(billing).csrf_token,
          ),
        ),
      cancel: () =>
        run(() =>
          api.cancelAtPeriodEnd(
            requiredBilling(billing).projection.version,
            requiredBilling(billing).csrf_token,
          ),
        ),
    }),
    [api, billing],
  );

  async function run(action: () => Promise<ParentBillingMutation>) {
    setBusy(true);
    setError('');
    setHandoff('');
    try {
      const result = await action();
      setBilling((current) => (current ? { ...current, projection: result.projection } : current));
      setImmediateChargeAccepted(false);
      setHandoff(
        'Your secure request is queued with HighLevel for Stripe-hosted processing. No redirect URL has been issued yet.',
      );
    } catch (reason) {
      setError(messageFrom(reason, 'The billing request could not be completed.'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p role="status">Loading family billing...</p>;
  if (!billing) {
    return (
      <V21StatePanel kind="error" title="Billing unavailable">
        <p>{error || 'Billing could not be loaded.'}</p>
      </V21StatePanel>
    );
  }

  return (
    <section aria-busy={busy}>
      {handoff ? <p role="status">{handoff}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <fieldset disabled={busy} style={{ border: 0, margin: 0, padding: 0 }}>
        <ParentBillingWorkspace
          projection={billing.projection}
          now={new Date()}
          freePeriod={billing.free_period}
          immediateChargeAccepted={immediateChargeAccepted}
          onImmediateChargeAcceptedChange={setImmediateChargeAccepted}
          onStandardCheckout={actions.standard}
          onImmediateCheckout={actions.immediate}
          onOpenPortal={actions.portal}
          onCancelAtPeriodEnd={actions.cancel}
        />
      </fieldset>
    </section>
  );
}

function requiredBilling(value: ParentBillingBootstrap | null) {
  if (!value) throw new Error('Billing is not loaded.');
  return value;
}

function messageFrom(reason: unknown, fallback: string) {
  return reason instanceof Error && reason.message ? reason.message : fallback;
}
