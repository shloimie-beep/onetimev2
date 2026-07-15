import type {
  AudienceDryRunReport,
  AudienceExistingContact,
  AudienceImportBatch,
  AudienceImportCell,
} from '../../../contracts/src/audience/schemas.ts';
import { audienceImportBatchSchema } from '../../../contracts/src/audience/schemas.ts';
import { mapAudienceWorksheetRows, type AudienceWorksheetRow } from './parser.ts';
import { reconcileAudienceRows } from './reconciliation.ts';

export type AudienceDryRunInput = {
  batch: AudienceImportBatch;
  rows: Record<string, AudienceImportCell>[];
  existingContacts?: AudienceExistingContact[];
  sheetName?: string;
};

export function buildAudienceDryRunReport(input: AudienceDryRunInput): AudienceDryRunReport {
  const batch = audienceImportBatchSchema.parse(input.batch);
  const worksheetRows = input.rows.map((row) => ({ ...row })) satisfies AudienceWorksheetRow[];
  const rows = mapAudienceWorksheetRows(batch, worksheetRows, input.sheetName ?? 'Synthetic');
  return reconcileAudienceRows({
    batch,
    rows,
    existingContacts: input.existingContacts ?? [],
  });
}

export function summarizeDryRunReport(report: AudienceDryRunReport) {
  return {
    report_kind: report.report_kind,
    source_batch_key: report.source_batch_key,
    row_count: report.row_count,
    unique_row_count: report.unique_row_count,
    duplicate_row_count: report.duplicate_row_count,
    status_counts: report.status_counts,
    segment_counts: report.segment_counts,
    reason_counts: report.reason_counts,
    rollback_plan: report.rollback_plan,
    external_mutation_counts: report.external_mutation_counts,
  };
}
