import React from 'react';
import { Alert, Button, Card, Checkbox } from '@onetime/brand-system/react';
import type {
  ConsentScope,
  RequesterVisiblePrivacyStatus,
} from '../../../../../../../packages/contracts/src/privacy/index.ts';

export interface PrivacyConsentView {
  scope: ConsentScope;
  label: string;
  required: boolean;
  granted: boolean;
  policy_version: string;
  evidence_at: string | null;
  consequence_preview: string;
  can_change: boolean;
}

export interface PrivacyRequestView {
  request_id: string;
  kind: 'export' | 'correction' | 'closure' | 'erasure' | 'consent_withdrawal';
  status: RequesterVisiblePrivacyStatus;
  exception_summary: string | null;
  download_expires_at: string | null;
}

export function PrivacyDataRightsPanel({
  actorKind,
  consents,
  requests,
  busy = false,
  onConsentChange,
  onCreateRequest,
}: {
  actorKind: 'parent' | 'adult_self_student';
  consents: readonly PrivacyConsentView[];
  requests: readonly PrivacyRequestView[];
  busy?: boolean;
  onConsentChange(scope: ConsentScope, grant: boolean): void;
  onCreateRequest(kind: PrivacyRequestView['kind']): void;
}) {
  return (
    <section aria-labelledby="privacy-heading">
      <h1 id="privacy-heading">Privacy and data rights</h1>
      <p>
        {actorKind === 'parent'
          ? 'Manage separate consent scopes for Students in your household. Private Student question and support bodies are not included in an ordinary Parent export.'
          : 'Manage only your own self-managed Student consent and data-rights scope.'}
      </p>
      <Alert tone="info">
        Export, correction, closure, and erasure require recent password reauthentication. Closure
        keeps records under the retention schedule; erasure is a separate reviewed request.
      </Alert>

      <h2>Consent scopes</h2>
      {consents.map((consent) => (
        <Card key={consent.scope}>
          <h3>{consent.label}</h3>
          <p>{consent.consequence_preview}</p>
          <p>
            Policy {consent.policy_version}
            {consent.evidence_at === null ? '; not accepted' : `; evidence ${consent.evidence_at}`}
          </p>
          <label>
            <Checkbox
              checked={consent.granted}
              disabled={busy || !consent.can_change}
              onChange={(event) => onConsentChange(consent.scope, event.currentTarget.checked)}
            />{' '}
            {consent.granted ? 'Accepted' : consent.required ? 'Required before use' : 'Optional'}
          </label>
        </Card>
      ))}

      <h2>Data-rights requests</h2>
      <div>
        <Button disabled={busy} onClick={() => onCreateRequest('export')}>
          Request export
        </Button>
        <Button disabled={busy} onClick={() => onCreateRequest('correction')}>
          Request correction
        </Button>
        <Button disabled={busy} onClick={() => onCreateRequest('closure')}>
          Request account closure
        </Button>
        <Button variant="danger" disabled={busy} onClick={() => onCreateRequest('erasure')}>
          Request verified erasure
        </Button>
      </div>
      {requests.length === 0 ? (
        <p>No privacy requests.</p>
      ) : (
        <ul>
          {requests.map((request) => (
            <li key={request.request_id}>
              <strong>{request.kind}</strong>: {request.status}
              {request.exception_summary === null ? '' : ` — ${request.exception_summary}`}
              {request.download_expires_at === null
                ? ''
                : ` — one-time download expires ${request.download_expires_at}`}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
