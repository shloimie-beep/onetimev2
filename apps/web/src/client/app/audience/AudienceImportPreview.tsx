import type { AudienceDryRunReport } from '../../../../../../packages/contracts/src/audience/schemas.ts';

export type AudienceImportPreviewProps = {
  report: AudienceDryRunReport;
};

export function AudienceImportPreview({ report }: AudienceImportPreviewProps) {
  return (
    <section className="audience-import-preview" data-ot74-audience-preview="unmounted">
      <header className="audience-import-preview__header">
        <p className="audience-import-preview__eyebrow">Audience dry run</p>
        <h2>Legacy audience reconciliation</h2>
        <p>{report.row_count} rows checked without import, sends, or account changes.</p>
      </header>
      <dl className="audience-import-preview__metrics" aria-label="Dry-run counts">
        <Metric label="Matched" value={report.status_counts.matched_existing} />
        <Metric label="New candidates" value={report.status_counts.new_contact_candidate} />
        <Metric label="Manual review" value={report.status_counts.manual_review} />
        <Metric label="Do not contact" value={report.segment_counts.do_not_contact} />
      </dl>
      <div className="audience-import-preview__segments" aria-label="Derived segments">
        {Object.entries(report.segment_counts).map(([segment, count]) => (
          <span className="audience-import-preview__segment" key={segment}>
            {segment.replaceAll('_', ' ')}: {count}
          </span>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="audience-import-preview__metric">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
