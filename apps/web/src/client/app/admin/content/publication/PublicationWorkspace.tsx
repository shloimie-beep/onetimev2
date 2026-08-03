import React, { useState } from 'react';
import { Button, Card, Input } from '@onetime/brand-system/react';

export type AdminPublicationRecord = {
  content_id: string;
  content_version_id: string;
  title: string;
  state: string;
  version: number;
  approved: boolean;
  published: boolean;
  allowed_actions: readonly string[];
  occurrence_count: number;
  updated_at: string;
};

export function PublicationWorkspace({
  csrfToken,
  onProtectedStateCleared,
}: {
  csrfToken: string;
  onProtectedStateCleared: () => void;
}) {
  const [contentVersionId, setContentVersionId] = useState('');
  const [approvalId, setApprovalId] = useState('');
  const [policyVersion, setPolicyVersion] = useState('content-publication-v1');
  const [occurrenceId, setOccurrenceId] = useState('');
  const [canonicalSeriesId, setCanonicalSeriesId] = useState('');
  const [record, setRecord] = useState<AdminPublicationRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function registerProjection(event: React.FormEvent) {
    event.preventDefault();
    await run(async () => {
      const result = await publicationRequest(
        '/api/app/content/publication/approved-projections',
        { content_version_id: contentVersionId.trim() },
        csrfToken,
        onProtectedStateCleared,
      );
      setRecord(result.data);
      setNotice(
        result.replay
          ? 'Approved projection already registered.'
          : 'Approved projection registered.',
      );
    });
  }

  async function command(
    operation: 'approve' | 'publish' | 'unpublish' | 'archive' | 'attachments',
  ) {
    if (!record) return;
    await run(async () => {
      const payload: Record<string, unknown> = {
        expected_version: record.version,
        idempotency_key: createPublicationIdempotencyKey(operation),
      };
      if (operation === 'approve') {
        payload.approval_id = approvalId.trim();
        payload.policy_version = policyVersion.trim();
      }
      if (operation === 'attachments') {
        payload.relation_id = `relation-${occurrenceId.trim()}`;
        payload.occurrence_id = occurrenceId.trim();
        payload.occurrence_version = 1;
        payload.canonical_series_id = canonicalSeriesId.trim();
      }
      const result = await publicationRequest(
        `/api/app/content/publication/${encodeURIComponent(record.content_id)}/${operation}`,
        payload,
        csrfToken,
        onProtectedStateCleared,
      );
      setRecord(result.data);
      setNotice(result.replay ? 'Command already applied.' : 'Publication state updated.');
    });
  }

  async function run(work: () => Promise<void>) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Publication is unavailable.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="publication-workspace-title">
      <header>
        <p className="ot-kicker">Approved content boundary</p>
        <h1 id="publication-workspace-title">Publication</h1>
        <p>Register approved processing evidence and control private Student publication.</p>
      </header>
      {notice && (
        <p className="notice-banner success" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="notice-banner error" role="alert">
          {error}
        </p>
      )}
      <Card>
        <form onSubmit={(event) => void registerProjection(event)}>
          <label>
            <span>Approved content version</span>
            <Input
              value={contentVersionId}
              required
              maxLength={200}
              onChange={(event) => setContentVersionId(event.currentTarget.value)}
            />
          </label>
          <Button type="submit" variant="primary" disabled={saving || !contentVersionId.trim()}>
            Register approved projection
          </Button>
        </form>
      </Card>
      {record && (
        <Card>
          <div>
            <p className="ot-kicker">{record.state.replaceAll('_', ' ')}</p>
            <h2>{record.title}</h2>
            <p>{record.occurrence_count} governed occurrence attachment(s)</p>
          </div>
          {record.allowed_actions.includes('approve') && (
            <div>
              <label>
                <span>Approval ID</span>
                <Input
                  value={approvalId}
                  onChange={(event) => setApprovalId(event.currentTarget.value)}
                />
              </label>
              <label>
                <span>Policy version</span>
                <Input
                  value={policyVersion}
                  onChange={(event) => setPolicyVersion(event.currentTarget.value)}
                />
              </label>
              <Button
                type="button"
                disabled={saving || !approvalId.trim()}
                onClick={() => void command('approve')}
              >
                Approve
              </Button>
            </div>
          )}
          {record.allowed_actions.includes('attach_occurrence') && (
            <div>
              <label>
                <span>Governed occurrence ID</span>
                <Input
                  value={occurrenceId}
                  onChange={(event) => setOccurrenceId(event.currentTarget.value)}
                />
              </label>
              <label>
                <span>Canonical series ID</span>
                <Input
                  value={canonicalSeriesId}
                  onChange={(event) => setCanonicalSeriesId(event.currentTarget.value)}
                />
              </label>
              <Button
                type="button"
                disabled={saving || !occurrenceId.trim() || !canonicalSeriesId.trim()}
                onClick={() => void command('attachments')}
              >
                Attach occurrence
              </Button>
            </div>
          )}
          <div className="ot-action-row">
            {record.allowed_actions.includes('publish') && (
              <Button
                type="button"
                variant="primary"
                disabled={saving}
                onClick={() => void command('publish')}
              >
                Request private publication
              </Button>
            )}
            {record.allowed_actions.includes('unpublish') && (
              <Button type="button" disabled={saving} onClick={() => void command('unpublish')}>
                Unpublish
              </Button>
            )}
            {record.allowed_actions.includes('archive') && (
              <Button type="button" disabled={saving} onClick={() => void command('archive')}>
                Archive
              </Button>
            )}
          </div>
        </Card>
      )}
    </section>
  );
}

async function publicationRequest(
  path: string,
  body: Record<string, unknown>,
  csrfToken: string,
  onProtectedStateCleared: () => void,
) {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as {
    success?: boolean;
    replay?: boolean;
    data?: AdminPublicationRecord;
    message?: string;
  };
  if (response.status === 401) onProtectedStateCleared();
  if (!response.ok || !json.success || !json.data) {
    throw new Error(json.message ?? 'Publication is unavailable.');
  }
  return { data: json.data, replay: Boolean(json.replay) };
}

function createPublicationIdempotencyKey(operation: string) {
  const nonce =
    'crypto' in globalThis && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `content-publication-${operation}-${nonce}`;
}
