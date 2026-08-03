import {
  scanOperationalLeakage,
  type OperationsIssue,
} from '../../../../packages/observability/v21/index.ts';

export function scanOperationalPayloads(payloads: readonly unknown[]) {
  const results = payloads.map(scanOperationalLeakage);
  return {
    passed: results.every((result) => result.passed),
    issues: results.flatMap((result): readonly OperationsIssue[] => result.issues),
    payload_count: payloads.length,
  };
}
