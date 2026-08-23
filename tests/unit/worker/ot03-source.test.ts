import { describe, expect, it, vi } from 'vitest';

import { runOt03CheckoutAbandonmentSourceWorker } from '../../../apps/worker/src/runners/ghl-workflows/core/ot03-source.ts';
import {
  createWorkerRunnerRegistrations,
  type WorkerRunnerContext,
} from '../../../apps/worker/src/runners/registry/index.ts';
import { loadConfig } from '../../../packages/config/src/index.ts';
import type { Ot03CheckoutAbandonmentRepository } from '../../../packages/db/src/billing/checkout-abandonment-repository.ts';

function context(): WorkerRunnerContext {
  return {
    config: loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgres://test.invalid/onetime' }),
    pool: {} as never,
    source: { NODE_ENV: 'test', OT03_SOURCE_ENABLED: 'true', OT03_SOURCE_BATCH_SIZE: '12' },
    workerInstanceKey: 'ot03-worker-test',
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

describe('OT-03 source worker', () => {
  it('is part of the central worker composition', () => {
    expect(createWorkerRunnerRegistrations().map(({ runnerId }) => runnerId)).toContain(
      'communications.ot03-source',
    );
  });

  it('is fail-closed and performs no database work without explicit enablement', async () => {
    const repository: Ot03CheckoutAbandonmentRepository = {
      listDueCandidates: vi.fn(),
      insertIntent: vi.fn(),
    };
    const disabledContext = context();
    delete disabledContext.source.OT03_SOURCE_ENABLED;

    const result = await runOt03CheckoutAbandonmentSourceWorker(disabledContext, { repository });

    expect(result).toEqual({
      enabled: false,
      providerCallsPerformed: false,
      summary: {
        disabledReason: 'ot03_source_disabled',
        scanned: 0,
        checkpoints: 0,
        inserted: 0,
        pendingExternalBinding: 0,
        providerCalls: 0,
        studentContacts: 0,
        financialMutations: 0,
        accessMutations: 0,
      },
    });
    expect(repository.listDueCandidates).not.toHaveBeenCalled();
    expect(repository.insertIntent).not.toHaveBeenCalled();
  });

  it('persists due checkpoints without any provider or Student effect', async () => {
    const inserted: unknown[] = [];
    const repository: Ot03CheckoutAbandonmentRepository = {
      listDueCandidates: vi.fn().mockResolvedValue([
        {
          checkout_request_key: 'checkout-request-1',
          account_key: 'one_time',
          product_key: 'one_time_mishnayos',
          household_key: 'household-1',
          adult_id: 'adult-1',
          checkout_status: 'session_created',
          checkout_started_at: '2026-08-05T00:00:00.000Z',
          request_fingerprint: 'f'.repeat(64),
        },
      ]),
      insertIntent: vi.fn(async (input) => {
        inserted.push(input.intent);
        return true;
      }),
    };

    const result = await runOt03CheckoutAbandonmentSourceWorker(context(), {
      repository,
      clock: () => new Date('2026-08-06T00:00:00.000Z'),
    });

    expect(result).toEqual({
      enabled: true,
      providerCallsPerformed: false,
      summary: {
        scanned: 1,
        checkpoints: 2,
        inserted: 2,
        pendingExternalBinding: 2,
        providerCalls: 0,
        studentContacts: 0,
        financialMutations: 0,
        accessMutations: 0,
      },
    });
    expect(inserted).toHaveLength(2);
    expect(inserted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ checkpoint: 'after_2h', student_contact_allowed: false }),
        expect.objectContaining({ checkpoint: 'after_24h', student_contact_allowed: false }),
      ]),
    );
  });

  it('does no work when no adult-safe checkout episode resolves', async () => {
    const repository: Ot03CheckoutAbandonmentRepository = {
      listDueCandidates: vi.fn().mockResolvedValue([]),
      insertIntent: vi.fn(),
    };
    const result = await runOt03CheckoutAbandonmentSourceWorker(context(), {
      repository,
      clock: () => new Date('2026-08-06T00:00:00.000Z'),
    });
    expect(result.summary).toMatchObject({ scanned: 0, inserted: 0, providerCalls: 0 });
    expect(repository.insertIntent).not.toHaveBeenCalled();
  });
});
