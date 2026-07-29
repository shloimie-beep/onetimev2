import type {
  BillingAccessRepository,
  BillingEventReceipt,
  BillingProjectionResult,
  HouseholdBillingProjection,
  VerifiedBillingEvent,
} from '../../../../contracts/src/billing/access/index.ts';
import {
  BillingAccessError,
  createFreeBillingProjection,
  expireBillingGrace,
  projectVerifiedBillingEvent,
} from '../../../../domain/src/billing/access/index.ts';

export function createMemoryBillingAccessRepository(): BillingAccessRepository {
  const projections = new Map<string, HouseholdBillingProjection>();
  const receipts = new Map<string, BillingEventReceipt>();

  return {
    async projectVerifiedEvent(
      event: VerifiedBillingEvent,
      receivedAt: Date,
    ): Promise<BillingProjectionResult> {
      const receiptKey = `${event.provider}:${event.event_id}`;
      const existingReceipt = receipts.get(receiptKey);
      if (existingReceipt !== undefined) {
        if (
          existingReceipt.payload_digest !== event.payload_digest ||
          existingReceipt.household_id !== event.household_id ||
          existingReceipt.provider_customer_ref_hash !== event.provider_customer_ref_hash
        ) {
          throw new BillingAccessError(
            'event_id_conflict',
            'A provider event identity cannot be reused with different billing truth.',
          );
        }
        const projection = projections.get(event.household_id);
        if (projection === undefined) {
          throw new BillingAccessError('invalid_contract', 'Receipt projection is missing.');
        }
        return { projection, receipt: existingReceipt, duplicate: true };
      }

      const prior =
        projections.get(event.household_id) ??
        createFreeBillingProjection({
          household_id: event.household_id,
          provider_customer_ref_hash: event.provider_customer_ref_hash,
          now: receivedAt,
        });
      const projection = projectVerifiedBillingEvent(prior, event, receivedAt);
      const receipt: BillingEventReceipt = {
        event_id: event.event_id,
        household_id: event.household_id,
        provider_customer_ref_hash: event.provider_customer_ref_hash,
        billing_term_id: event.billing_term_id,
        kind: event.kind,
        occurred_at: event.occurred_at,
        received_at: receivedAt.toISOString(),
        payload_digest: event.payload_digest,
        signature_verified: true,
        projection_version: projection.version,
      };
      projections.set(event.household_id, projection);
      receipts.set(receiptKey, receipt);
      return { projection, receipt, duplicate: false };
    },

    async expireGrace(householdId: string, now: Date): Promise<HouseholdBillingProjection | null> {
      const prior = projections.get(householdId);
      if (prior === undefined) return null;
      const projection = expireBillingGrace(prior, now);
      projections.set(householdId, projection);
      return projection;
    },

    async getProjection(householdId: string): Promise<HouseholdBillingProjection | null> {
      return projections.get(householdId) ?? null;
    },
  };
}
