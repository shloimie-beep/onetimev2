import {
  evaluateRuntimeAgreement,
  type CandidateIdentity,
  type RuntimeIdentity,
} from '../../../../packages/observability/v21/index.ts';

export function inspectRuntimeIdentity(input: {
  candidate: CandidateIdentity;
  runtimes: readonly RuntimeIdentity[];
}) {
  return evaluateRuntimeAgreement(input);
}
