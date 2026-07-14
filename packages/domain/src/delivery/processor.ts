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

function parseDeliverBy(payload: Readonly<Record<string, unknown>>): Date | null {
  const raw = payload.deliver_by ?? payload.deliverBy;
  if (raw === null || raw === undefined || raw === '') return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? new Date(0) : raw;
  if (typeof raw === 'string' || typeof raw === 'number') {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
  }
  return new Date(0);
}

function deliveryWindowExpired(claim: ClaimedDelivery, now: Date): boolean {
  const deliverBy = parseDeliverBy(claim.payload);
  return Boolean(deliverBy && now.getTime() > deliverBy.getTime());
}

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
  if (deliveryWindowExpired(claim, now)) {
    return {
      kind: 'terminal',
      outcome: {
        kind: 'skipped',
        at: now,
        reason: 'delivery_window_expired',
      },
    };
  }
  return {
    kind: 'request',
    request: buildDeliveryRequest(claim, eligibility, config),
  };
}
