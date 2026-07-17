import { readFile } from 'node:fs/promises';
import {
  legacyAudienceDryRunReportSchema,
  type LegacyAudienceApplyPlanRequest,
} from '../../packages/contracts/src/audience-reconciliation/index.ts';
import { createLegacyAudienceApplyPlan } from '../../packages/domain/src/audience-reconciliation/service.ts';

const args = parseArgs(process.argv.slice(2));
if (!args.report) {
  throw new Error('--report=path/to/dry-run-report.json is required.');
}

const raw = JSON.parse(await readFile(args.report, 'utf8')) as unknown;
const report = legacyAudienceDryRunReportSchema.parse(unwrapReport(raw));
const request: LegacyAudienceApplyPlanRequest = {
  batch_key: report.batch_key,
  idempotency_key: args.idempotencyKey ?? 'w12-01-apply-plan-dry-run',
  mode: args.mode ?? 'dry_run',
  manifest_sha256: args.manifestSha256 ?? report.source_digest,
  expected_total_rows: Number(args.expectedTotalRows ?? report.summary.total_rows),
  expected_unique_rows: Number(args.expectedUniqueRows ?? report.summary.unique_rows),
  expected_manual_review_rows: Number(
    args.expectedManualReviewRows ?? report.summary.manual_review_rows,
  ),
  target_environment: args.targetEnvironment ?? 'test',
};
if (args.operatorAuthorization) {
  request.operator_authorization_statement = args.operatorAuthorization;
}
const result = createLegacyAudienceApplyPlan({ report, request });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

function parseArgs(argv: string[]) {
  const parsed: {
    report?: string;
    idempotencyKey?: string;
    mode?: 'dry_run' | 'apply';
    manifestSha256?: string;
    expectedTotalRows?: string;
    expectedUniqueRows?: string;
    expectedManualReviewRows?: string;
    targetEnvironment?: 'local' | 'test' | 'staging' | 'production';
    operatorAuthorization?: string;
  } = {};
  for (const arg of argv) {
    if (arg.startsWith('--report=')) parsed.report = arg.slice('--report='.length);
    else if (arg.startsWith('--idempotency-key=')) {
      parsed.idempotencyKey = arg.slice('--idempotency-key='.length);
    } else if (arg === '--apply') parsed.mode = 'apply';
    else if (arg.startsWith('--mode=')) {
      parsed.mode = arg.slice('--mode='.length) as NonNullable<typeof parsed.mode>;
    } else if (arg.startsWith('--manifest-sha256=')) {
      parsed.manifestSha256 = arg.slice('--manifest-sha256='.length);
    } else if (arg.startsWith('--expected-total-rows=')) {
      parsed.expectedTotalRows = arg.slice('--expected-total-rows='.length);
    } else if (arg.startsWith('--expected-unique-rows=')) {
      parsed.expectedUniqueRows = arg.slice('--expected-unique-rows='.length);
    } else if (arg.startsWith('--expected-manual-review-rows=')) {
      parsed.expectedManualReviewRows = arg.slice('--expected-manual-review-rows='.length);
    } else if (arg.startsWith('--target-environment=')) {
      parsed.targetEnvironment = arg.slice('--target-environment='.length) as NonNullable<
        typeof parsed.targetEnvironment
      >;
    } else if (arg.startsWith('--operator-authorization=')) {
      parsed.operatorAuthorization = arg.slice('--operator-authorization='.length);
    }
  }
  return parsed;
}

function unwrapReport(value: unknown) {
  if (value && typeof value === 'object' && 'report' in value) {
    return (value as { report: unknown }).report;
  }
  return value;
}
