import { createHash } from 'node:crypto';
import type {
  ClaimedDelivery,
  ClaimBatchInput,
  DeliveryFailure,
  DeliveryOutcome,
  DeliveryProviderOperation,
  DeliveryRepository,
  ProviderReceipt,
} from '../../../packages/contracts/src/delivery/types.ts';
import { supportedChannelForEvent } from '../../../packages/domain/src/delivery/eligibility.ts';

export type MemorySeed = Omit<ClaimedDelivery, 'claimLeaseExpiresAt'> & {
  status: string;
  nextAttemptAt: Date;
  claimLeaseExpiresAt?: Date;
  outcome?: DeliveryOutcome;
};

type MemoryRow = MemorySeed & {
  claimLeaseExpiresAt?: Date;
};

export class MemoryDeliveryRepository implements DeliveryRepository {
  private readonly rows = new Map<string, MemoryRow>();

  constructor(seeds: readonly MemorySeed[]) {
    for (const seed of seeds) {
      this.rows.set(seed.id, { ...seed });
    }
  }

  async claimBatch(input: ClaimBatchInput): Promise<ClaimedDelivery[]> {
    const candidates = [...this.rows.values()]
      .filter((row) => this.canClaim(row, input))
      .sort(
        (left, right) =>
          left.nextAttemptAt.getTime() - right.nextAttemptAt.getTime() ||
          left.createdAt.getTime() - right.createdAt.getTime() ||
          left.id.localeCompare(right.id),
      )
      .slice(0, input.limit);
    return candidates.map((row) => {
      const lease = new Date(input.now.getTime() + input.leaseMs);
      row.status = 'processing';
      row.attempts += 1;
      row.nextAttemptAt = lease;
      row.claimLeaseExpiresAt = lease;
      return this.toClaim(row, lease);
    });
  }

  async complete(claim: ClaimedDelivery, outcome: DeliveryOutcome): Promise<boolean> {
    const row = this.rows.get(claim.id);
    if (!row || !this.hasCurrentLease(row, claim, outcome.at)) return false;
    row.outcome = outcome;
    if (outcome.kind === 'delivered') {
      row.status = outcome.receipt.sink ? 'sink_delivered' : 'delivered';
      row.nextAttemptAt = outcome.at;
    } else if (outcome.kind === 'retry') {
      row.status = 'pending';
      row.nextAttemptAt = outcome.nextAttemptAt;
    } else if (outcome.kind === 'acceptance_unknown') {
      row.status = 'acceptance_unknown';
      row.nextAttemptAt = outcome.at;
    } else {
      row.status = outcome.kind;
      row.nextAttemptAt = outcome.at;
    }
    return true;
  }

  async beginProviderOperation(
    claim: ClaimedDelivery,
    operation: DeliveryProviderOperation,
    at: Date,
  ): Promise<
    | { kind: 'dispatch' }
    | { kind: 'accepted'; receipt: ProviderReceipt }
    | { kind: 'acceptance_unknown' }
    | { kind: 'lease_lost' }
  > {
    const row = this.rows.get(claim.id);
    if (!row || !this.hasCurrentLease(row, claim, at)) return { kind: 'lease_lost' };
    const current = row.providerOperation;
    if (
      (current.provider && current.provider !== operation.provider) ||
      (current.idempotencyKey && current.idempotencyKey !== operation.idempotencyKey)
    ) {
      return { kind: 'acceptance_unknown' };
    }
    if (current.state === 'accepted') {
      if (!current.acceptanceRefHash || !current.acceptedAt) {
        return { kind: 'acceptance_unknown' };
      }
      return {
        kind: 'accepted',
        receipt: {
          provider: operation.provider,
          messageId: current.acceptanceRefHash,
          acceptedAt: current.acceptedAt,
          sink: false,
        },
      };
    }
    if (
      (current.state === 'in_flight' || current.state === 'acceptance_unknown') &&
      operation.acceptanceRecovery !== 'retry_same_key'
    ) {
      current.state = 'acceptance_unknown';
      current.updatedAt = at;
      return { kind: 'acceptance_unknown' };
    }
    current.state = 'in_flight';
    current.provider = operation.provider;
    current.idempotencyKey = operation.idempotencyKey;
    current.acceptanceRefHash = null;
    current.dispatchedAt ??= at;
    current.acceptedAt = null;
    current.updatedAt = at;
    return { kind: 'dispatch' };
  }

  async recordProviderAccepted(
    claim: ClaimedDelivery,
    operation: DeliveryProviderOperation,
    receipt: ProviderReceipt,
    at: Date,
  ): Promise<boolean> {
    const row = this.rows.get(claim.id);
    if (!row || !this.canTransitionProvider(row, claim, operation, at)) return false;
    row.providerOperation.state = 'accepted';
    row.providerOperation.acceptanceRefHash = createHash('sha256')
      .update(receipt.messageId ?? `${operation.provider}:${operation.idempotencyKey}`)
      .digest('hex');
    row.providerOperation.acceptedAt = at;
    row.providerOperation.updatedAt = at;
    return true;
  }

  async recordProviderRejected(
    claim: ClaimedDelivery,
    operation: DeliveryProviderOperation,
    failure: DeliveryFailure,
    at: Date,
  ): Promise<boolean> {
    void failure;
    return this.recordProviderNonAcceptance(claim, operation, 'rejected', at);
  }

  async recordProviderAcceptanceUnknown(
    claim: ClaimedDelivery,
    operation: DeliveryProviderOperation,
    failure: DeliveryFailure,
    at: Date,
  ): Promise<boolean> {
    void failure;
    return this.recordProviderNonAcceptance(claim, operation, 'acceptance_unknown', at);
  }

  snapshot(id: string): MemoryRow | undefined {
    const row = this.rows.get(id);
    return row ? this.clone(row) : undefined;
  }

  snapshots(): MemoryRow[] {
    return [...this.rows.values()].map((row) => this.clone(row));
  }

  private canClaim(row: MemoryRow, input: ClaimBatchInput): boolean {
    const expectedChannel = supportedChannelForEvent(row.eventType);
    return (
      row.accountKey === input.accountKey &&
      row.productKey === input.productKey &&
      row.transportMode === input.transportMode &&
      expectedChannel === row.channel &&
      ((row.status === 'pending' && row.nextAttemptAt.getTime() <= input.now.getTime()) ||
        (row.status === 'processing' && row.nextAttemptAt.getTime() <= input.now.getTime()))
    );
  }

  private toClaim(row: MemoryRow, lease: Date): ClaimedDelivery {
    return {
      id: row.id,
      deliveryKey: row.deliveryKey,
      accountKey: row.accountKey,
      productKey: row.productKey,
      contactKey: row.contactKey,
      signupKey: row.signupKey,
      eventType: row.eventType,
      channel: row.channel,
      transportMode: row.transportMode,
      payload: row.payload,
      attempts: row.attempts,
      createdAt: row.createdAt,
      claimLeaseExpiresAt: lease,
      providerOperation: { ...row.providerOperation },
      contact: row.contact,
      signup: row.signup,
    };
  }

  private recordProviderNonAcceptance(
    claim: ClaimedDelivery,
    operation: DeliveryProviderOperation,
    state: 'rejected' | 'acceptance_unknown',
    at: Date,
  ): boolean {
    const row = this.rows.get(claim.id);
    if (!row || !this.canTransitionProvider(row, claim, operation, at)) return false;
    row.providerOperation.state = state;
    row.providerOperation.acceptanceRefHash = null;
    row.providerOperation.acceptedAt = null;
    row.providerOperation.updatedAt = at;
    return true;
  }

  private canTransitionProvider(
    row: MemoryRow,
    claim: ClaimedDelivery,
    operation: DeliveryProviderOperation,
    at: Date,
  ): boolean {
    return (
      this.hasCurrentLease(row, claim, at) &&
      row.providerOperation.state === 'in_flight' &&
      row.providerOperation.provider === operation.provider &&
      row.providerOperation.idempotencyKey === operation.idempotencyKey
    );
  }

  private hasCurrentLease(row: MemoryRow, claim: ClaimedDelivery, at: Date): boolean {
    return (
      row.status === 'processing' &&
      row.accountKey === claim.accountKey &&
      row.productKey === claim.productKey &&
      row.transportMode === claim.transportMode &&
      Boolean(row.claimLeaseExpiresAt) &&
      row.claimLeaseExpiresAt?.getTime() === claim.claimLeaseExpiresAt.getTime() &&
      (row.claimLeaseExpiresAt?.getTime() ?? 0) > at.getTime()
    );
  }

  private clone(row: MemoryRow): MemoryRow {
    return {
      ...row,
      providerOperation: { ...row.providerOperation },
    };
  }
}
