import React from 'react';
import { Badge, Button, Card, Table } from '@onetime/brand-system/react';
import type {
  DataRightsRequestKind,
  RequesterVisiblePrivacyStatus,
} from '../../../../../../../packages/contracts/src/privacy/index.ts';

export interface PrivacyReviewCaseView {
  request_id: string;
  kind: DataRightsRequestKind;
  subject_scope: 'adult' | 'household' | 'student';
  relationship: 'self' | 'dependent' | null;
  status: RequesterVisiblePrivacyStatus;
  due_at: string;
  dependent_review_required: boolean;
  provider_exception_codes: readonly string[];
}

export function PrivacyReviewQueue({
  cases,
  onOpen,
}: {
  cases: readonly PrivacyReviewCaseView[];
  onOpen(requestId: string): void;
}) {
  return (
    <section aria-labelledby="privacy-review-heading">
      <h1 id="privacy-review-heading">Privacy request review</h1>
      <Card>
        <p>
          Review exact actor, household, Student relationship, exclusions, legal exceptions,
          provider reconciliation, and purge-ledger evidence. This view contains no private question
          or support body.
        </p>
      </Card>
      <Table>
        <thead>
          <tr>
            <th scope="col">Kind</th>
            <th scope="col">Subject</th>
            <th scope="col">Status</th>
            <th scope="col">Due</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((privacyCase) => (
            <tr key={privacyCase.request_id}>
              <td>{privacyCase.kind}</td>
              <td>
                {privacyCase.subject_scope}
                {privacyCase.relationship === null ? '' : ` (${privacyCase.relationship})`}
              </td>
              <td>
                <Badge>{privacyCase.status}</Badge>
                {privacyCase.dependent_review_required ? ' — dependent review required' : ''}
                {privacyCase.provider_exception_codes.length === 0
                  ? ''
                  : ` — ${privacyCase.provider_exception_codes.join(', ')}`}
              </td>
              <td>{privacyCase.due_at}</td>
              <td>
                <Button onClick={() => onOpen(privacyCase.request_id)}>Open review</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </section>
  );
}
