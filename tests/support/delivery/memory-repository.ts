import type {
  ClaimedDelivery,
  ClaimBatchInput,
  DeliveryOutcome,
  DeliveryRepository,
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
    if (
      !row ||
      row.status !== 'processing' ||
      row.accountKey !== claim.accountKey ||
      row.productKey !== claim.productKey ||
      row.transportMode !== 'sink' ||
      !row.claimLeaseExpiresAt ||
      row.claimLeaseExpiresAt.getTime() !== claim.claimLeaseExpiresAt.getTime() ||
      row.claimLeaseExpiresAt.getTime() <= outcome.at.getTime()
    ) {
      return false;
    }
    row.outcome = outcome;
    if (outcome.kind === 'delivered') {
      row.status = outcome.receipt.sink ? 'sink_delivered' : 'delivered';
      row.nextAttemptAt = outcome.at;
    } else if (outcome.kind === 'retry') {
      row.status = 'pending';
      row.nextAttemptAt = outcome.nextAttemptAt;
    } else {
      row.status = outcome.kind;
      row.nextAttemptAt = outcome.at;
    }
    return true;
  }

  snapshot(id: string): MemoryRow | undefined {
    const row = this.rows.get(id);
    return row ? { ...row } : undefined;
  }

  snapshots(): MemoryRow[] {
    return [...this.rows.values()].map((row) => ({ ...row }));
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
      contact: row.contact,
      signup: row.signup,
    };
  }
}
