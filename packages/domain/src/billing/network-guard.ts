export type BillingNetworkAttempt = {
  url: string;
  reason: string;
};

export class BillingNetworkBlockedError extends Error {
  constructor(readonly attempts: BillingNetworkAttempt[]) {
    super('Billing network access is blocked in this fixture-only slice.');
  }
}

export async function withBillingNetworkGuard<T>(run: () => Promise<T> | T): Promise<{
  result: T;
  attempts: BillingNetworkAttempt[];
}> {
  const attempts: BillingNetworkAttempt[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    attempts.push({ url, reason: 'fetch' });
    throw new BillingNetworkBlockedError(attempts);
  }) as typeof fetch;
  try {
    const result = await run();
    return { result, attempts };
  } finally {
    globalThis.fetch = originalFetch;
  }
}
