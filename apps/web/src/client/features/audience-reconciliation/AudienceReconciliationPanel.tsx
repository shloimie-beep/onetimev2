import React from 'react';
import type {
  LegacyActivationCampaignPreview,
  LegacyAudienceSegmentContract,
  LegacyAudienceSummary,
} from '../../../../../../packages/contracts/src/audience-reconciliation/index.ts';
import './audience-reconciliation-panel.css';

type AudienceReconciliationPanelProps = {
  summary: LegacyAudienceSummary | null;
  segments: LegacyAudienceSegmentContract[];
  loading?: boolean;
  error?: string | null;
  campaignPreview?: LegacyActivationCampaignPreview | null;
  onDryRun?: () => void;
  onRollbackRecord?: () => void;
  onCampaignPreview?: () => void;
  onApproveCampaign?: () => void;
  onQueueCanary?: () => void;
};

export function AudienceReconciliationPanel({
  summary,
  segments,
  loading = false,
  error = null,
  campaignPreview = null,
  onDryRun,
  onRollbackRecord,
  onCampaignPreview,
  onApproveCampaign,
  onQueueCanary,
}: AudienceReconciliationPanelProps) {
  if (loading) {
    return (
      <section className="audience-reconciliation" aria-busy="true">
        <header className="audience-reconciliation__header">
          <h2>Audience Reconciliation</h2>
        </header>
        <p className="audience-reconciliation__muted">Loading dry-run summary.</p>
      </section>
    );
  }

  return (
    <section className="audience-reconciliation">
      <header className="audience-reconciliation__header">
        <div>
          <h2>Audience Reconciliation</h2>
          <p>Dry-run only</p>
        </div>
        <div className="audience-reconciliation__actions">
          <button type="button" onClick={onDryRun}>
            Dry run
          </button>
          <button type="button" onClick={onRollbackRecord}>
            Record rollback
          </button>
        </div>
      </header>

      {error ? <p className="audience-reconciliation__error">{error}</p> : null}

      <div className="audience-reconciliation__metrics">
        <Metric label="Rows" value={summary?.total_rows ?? 0} />
        <Metric label="Manual review" value={summary?.manual_review_rows ?? 0} />
        <Metric label="Invite eligible" value={summary?.migration_invite_eligible_rows ?? 0} />
        <Metric label="Do not contact" value={summary?.do_not_contact_rows ?? 0} />
      </div>

      <div className="audience-reconciliation__split">
        <section>
          <h3>Dispositions</h3>
          <CountList counts={summary?.disposition_counts ?? {}} />
        </section>
        <section>
          <h3>Reasons</h3>
          <CountList counts={summary?.reason_counts ?? {}} />
        </section>
      </div>

      <section className="audience-reconciliation__segments">
        <header className="audience-reconciliation__subheader">
          <div>
            <h3>Activation Campaign</h3>
            <p>{campaignPreview ? campaignPreview.status : 'No campaign snapshot'}</p>
          </div>
          <div className="audience-reconciliation__actions">
            <button type="button" onClick={onCampaignPreview}>
              Preview campaign
            </button>
            <button type="button" onClick={onApproveCampaign}>
              Approve snapshot
            </button>
            <button type="button" onClick={onQueueCanary}>
              Queue canary
            </button>
          </div>
        </header>
        <div className="audience-reconciliation__metrics">
          <Metric label="Eligible" value={campaignPreview?.counts.eligible_rows ?? 0} />
          <Metric
            label="Activated"
            value={campaignPreview?.counts.already_activated_excluded ?? 0}
          />
          <Metric label="Suppressed" value={campaignPreview?.counts.suppressed_excluded ?? 0} />
          <Metric
            label="Invalid"
            value={campaignPreview?.counts.invalid_destination_excluded ?? 0}
          />
        </div>
      </section>

      <section className="audience-reconciliation__segments">
        <h3>Prepared Segments</h3>
        <table>
          <thead>
            <tr>
              <th>Segment</th>
              <th>Tag</th>
              <th>Sends</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((segment) => (
              <tr key={segment.segment_code}>
                <td>{segment.display_name}</td>
                <td>{segment.tag_key}</td>
                <td>{segment.sends_allowed ? 'Enabled' : 'Blocked'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="audience-reconciliation__metric">
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </div>
  );
}

function CountList({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort(([left], [right]) => left.localeCompare(right));
  if (!entries.length) {
    return <p className="audience-reconciliation__muted">No rows yet.</p>;
  }
  return (
    <ol className="audience-reconciliation__counts">
      {entries.map(([key, value]) => (
        <li key={key}>
          <span>{key.replaceAll('_', ' ')}</span>
          <strong>{value.toLocaleString()}</strong>
        </li>
      ))}
    </ol>
  );
}
