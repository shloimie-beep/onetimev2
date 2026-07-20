import type { HighLevelClient, HighLevelSubscription, HighLevelTransaction } from './client.ts';
import type { HighLevelRuntimeConfig } from './config.ts';

export type ReconciliationCursor = {
  lastSubscriptionCursor: string | null;
  lastTransactionCursor: string | null;
  lastSeenAt: string | null;
};

export type ReconciliationResult = {
  status: 'disabled' | 'completed' | 'rate_limited' | 'circuit_open';
  pagesRead: number;
  itemsRead: number;
  subscriptions: HighLevelSubscription[];
  transactions: HighLevelTransaction[];
  nextCursor: ReconciliationCursor;
  externalMutations: 0;
};

export async function runHighLevelReconciliation(input: {
  config: HighLevelRuntimeConfig;
  client: HighLevelClient;
  cursor: ReconciliationCursor;
  now: Date;
}) {
  if (!input.config.highLevelReconciliationEnabled) {
    return emptyResult('disabled', input.cursor);
  }
  const subscriptions: HighLevelSubscription[] = [];
  const transactions: HighLevelTransaction[] = [];
  let pagesRead = 0;
  let itemsRead = 0;
  let subscriptionCursor = input.cursor.lastSubscriptionCursor ?? undefined;
  let transactionCursor = input.cursor.lastTransactionCursor ?? undefined;
  while (pagesRead < input.config.highLevelReconciliationMaxPages) {
    const page = await input.client.listSubscriptions({ cursor: subscriptionCursor });
    pagesRead += 1;
    subscriptions.push(...page);
    itemsRead += page.length;
    if (itemsRead > input.config.highLevelReconciliationMaxItems) {
      return {
        status: 'circuit_open' as const,
        pagesRead,
        itemsRead,
        subscriptions,
        transactions,
        nextCursor: input.cursor,
        externalMutations: 0 as const,
      };
    }
    if (page.length === 0) break;
    subscriptionCursor = page.at(-1)?.id;
    break;
  }
  while (pagesRead < input.config.highLevelReconciliationMaxPages) {
    const page = await input.client.listTransactions({ cursor: transactionCursor });
    pagesRead += 1;
    transactions.push(...page);
    itemsRead += page.length;
    if (itemsRead > input.config.highLevelReconciliationMaxItems) {
      return {
        status: 'circuit_open' as const,
        pagesRead,
        itemsRead,
        subscriptions,
        transactions,
        nextCursor: input.cursor,
        externalMutations: 0 as const,
      };
    }
    if (page.length === 0) break;
    transactionCursor = page.at(-1)?.id;
    break;
  }
  return {
    status: 'completed' as const,
    pagesRead,
    itemsRead,
    subscriptions,
    transactions,
    nextCursor: {
      lastSubscriptionCursor: subscriptionCursor ?? input.cursor.lastSubscriptionCursor,
      lastTransactionCursor: transactionCursor ?? input.cursor.lastTransactionCursor,
      lastSeenAt: input.now.toISOString(),
    },
    externalMutations: 0 as const,
  };
}

export function isHighLevelReconciliationCronAllowed(cron: string) {
  return cron.trim() === '0 3 * * *';
}

function emptyResult(status: 'disabled', cursor: ReconciliationCursor): ReconciliationResult {
  return {
    status,
    pagesRead: 0,
    itemsRead: 0,
    subscriptions: [],
    transactions: [],
    nextCursor: cursor,
    externalMutations: 0,
  };
}
