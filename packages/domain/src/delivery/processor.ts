import type {
  ClaimedDelivery,
  DeliveryOutcome,
  DeliveryRequest,
} from '../../../contracts/src/delivery/types.ts';
import { evaluateDeliveryEligibility } from './eligibility.ts';
import { buildDeliveryRequest, type DeliveryMessageConfig } from './messages.ts';

export type PreparedDelivery =
  | {
      kind: 'request';
      request: DeliveryRequest;
    }
  | {
      kind: 'terminal';
      outcome: Extract<DeliveryOutcome, { kind: 'suppressed' | 'skipped' }>;
    };

export function prepareDelivery(
  claim: ClaimedDelivery,
  config: DeliveryMessageConfig,
  now: Date,
): PreparedDelivery {
  const eligibility = evaluateDeliveryEligibility(claim, config.protectedOwnerEmail);
  if (eligibility.kind === 'suppressed') {
    return {
      kind: 'terminal',
      outcome: {
        kind: 'suppressed',
        at: now,
        reason: eligibility.reason,
      },
    };
  }
  if (eligibility.kind === 'skipped') {
    return {
      kind: 'terminal',
      outcome: {
        kind: 'skipped',
        at: now,
        reason: eligibility.reason as Exclude<typeof eligibility.reason, 'contact_suppressed'>,
      },
    };
  }
  return {
    kind: 'request',
    request: buildDeliveryRequest(claim, eligibility, config),
  };
}
