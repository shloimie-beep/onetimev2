import {
  buildOperationsHealthSnapshot,
  evaluateOperationsAlerts,
  type OperationsHealthInput,
} from '../../../../packages/observability/v21/index.ts';

export function evaluateOperationsHealth(input: OperationsHealthInput) {
  const snapshot = buildOperationsHealthSnapshot(input);
  return { snapshot, alerts: evaluateOperationsAlerts(snapshot) };
}
