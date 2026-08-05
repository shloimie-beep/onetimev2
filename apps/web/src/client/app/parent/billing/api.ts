import type { CommercialBillingProjection } from '../../../../../../../packages/contracts/src/billing/commercial/index.ts';

export type ParentBillingBootstrap = {
  projection: CommercialBillingProjection;
  free_period: {
    sourceKey: string;
    timeZone: 'Asia/Jerusalem';
    endsAt: string;
  };
  csrf_token: string;
};

export type ParentBillingMutation = {
  disposition: 'applied' | 'replayed';
  projection: CommercialBillingProjection;
  provider_handoff: {
    status: 'queued';
    orchestrator: 'highlevel';
    financial_provider: 'stripe';
    redirect_url: null;
  };
};

export class ParentBillingApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ParentBillingApiError';
  }
}

export function createParentBillingApi(
  input: { fetcher?: typeof fetch; basePath?: string; idempotencyKey?: () => string } = {},
) {
  const fetcher = input.fetcher ?? globalThis.fetch.bind(globalThis);
  const basePath = input.basePath ?? '/api/app/parent/billing';
  const nextIdempotencyKey = input.idempotencyKey ?? browserIdempotencyKey;

  async function read<T>(response: Response): Promise<T> {
    const payload = (await response.json()) as unknown;
    if (!isRecord(payload) || payload.success !== true || !('data' in payload)) {
      const code =
        isRecord(payload) && typeof payload.code === 'string' ? payload.code : 'REQUEST_FAILED';
      const message =
        isRecord(payload) && typeof payload.message === 'string'
          ? payload.message
          : 'The billing request could not be completed.';
      throw new ParentBillingApiError(code, message, response.status);
    }
    return payload.data as T;
  }

  async function mutate(
    path: '/checkout' | '/portal' | '/cancel-at-period-end',
    body: Record<string, unknown>,
    csrfToken: string,
  ) {
    return read<ParentBillingMutation>(
      await fetcher(`${basePath}${path}`, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': csrfToken,
          'x-idempotency-key': nextIdempotencyKey(),
        },
        body: JSON.stringify(body),
      }),
    );
  }

  return {
    async load() {
      return read<ParentBillingBootstrap>(
        await fetcher(basePath, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        }),
      );
    },
    checkout(
      input: {
        expectedVersion: number;
        mode: 'standard' | 'immediate_exception';
        immediateChargeAccepted?: boolean;
      },
      csrfToken: string,
    ) {
      return mutate(
        '/checkout',
        {
          expected_version: input.expectedVersion,
          mode: input.mode,
          ...(input.immediateChargeAccepted === undefined
            ? {}
            : { immediate_charge_accepted: input.immediateChargeAccepted }),
        },
        csrfToken,
      );
    },
    openPortal(expectedVersion: number, csrfToken: string) {
      return mutate('/portal', { expected_version: expectedVersion }, csrfToken);
    },
    cancelAtPeriodEnd(expectedVersion: number, csrfToken: string) {
      return mutate('/cancel-at-period-end', { expected_version: expectedVersion }, csrfToken);
    },
  };
}

function browserIdempotencyKey() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `billing-${globalThis.crypto.randomUUID()}`;
  }
  const bytes = new Uint8Array(24);
  globalThis.crypto?.getRandomValues(bytes);
  const encoded = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  if (!encoded || /^0+$/u.test(encoded)) {
    throw new Error('Secure browser randomness is required for billing requests.');
  }
  return `billing-${encoded}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
