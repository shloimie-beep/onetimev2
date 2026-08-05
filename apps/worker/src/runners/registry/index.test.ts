import { describe, expect, it, vi } from 'vitest';

import { loadConfig } from '../../../../../packages/config/src/index.ts';
import { runWorkerRunners, workerRunnerRegistrations, type WorkerRunnerContext } from './index.ts';

function context(mode: 'once' | 'continuous'): WorkerRunnerContext {
  return {
    config: loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgres://test.invalid/onetime' }),
    pool: {
      query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
      connect: vi.fn(),
      end: vi.fn(),
    } as never,
    source: { NODE_ENV: 'test', WORKER_EXECUTION_MODE: mode },
    workerInstanceKey: `worker-${mode}`,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

describe('worker runner registry', () => {
  it('registers the bounded media pipeline and durable communications runners', () => {
    expect(workerRunnerRegistrations).toHaveLength(5);
    expect(workerRunnerRegistrations).toEqual([
      expect.objectContaining({
        runnerId: 'content.media-ingest',
        contractVersion: '1.0.0',
      }),
      expect.objectContaining({
        runnerId: 'content.media-processing',
        contractVersion: '1.0.0',
      }),
      expect.objectContaining({
        runnerId: 'content.p21-publication',
        contractVersion: '1.0.0',
      }),
      expect.objectContaining({
        runnerId: 'identity.family-signup-ghl',
        contractVersion: '1.0.0',
      }),
      expect.objectContaining({
        runnerId: 'communications.ot16-checkpoint',
        contractVersion: '1.0.0',
      }),
    ]);
  });

  it.each(['once', 'continuous'] as const)(
    'uses the same fail-closed default registration in %s mode',
    async (mode) => {
      const results = await runWorkerRunners({ context: context(mode) });
      expect(Object.keys(results)).toEqual([
        'content.media-ingest',
        'content.media-processing',
        'content.p21-publication',
        'identity.family-signup-ghl',
        'communications.ot16-checkpoint',
      ]);
      expect(results['content.p21-publication']).toMatchObject({
        enabled: false,
        providerCallsPerformed: false,
        summary: {
          disabledReason: 'content_publication_authority_unavailable',
          canaryBudget: 1,
          mediaMode: 'off',
          providerCalls: 0,
          dispatch: { claimed: 0 },
          reconciliation: { claimed: 0 },
          finalization: { selected: 0 },
        },
      });
      expect(results['content.media-ingest']).toMatchObject({
        enabled: false,
        providerCallsPerformed: false,
        summary: {
          disabledReason: 'content_media_default_off',
          canaryBudget: 1,
          providerCalls: 0,
          databaseWrites: 0,
          driveNonblocking: true,
        },
      });
      expect(results['content.media-processing']).toMatchObject({
        enabled: false,
        providerCallsPerformed: false,
        summary: {
          disabledReason: 'content_media_default_off',
          canaryBudget: 1,
          commandsSelected: 0,
          providerCalls: 0,
        },
      });
      expect(results['identity.family-signup-ghl']).toEqual({
        enabled: false,
        providerCallsPerformed: false,
        summary: { mode: 'disabled' },
      });
      expect(results['communications.ot16-checkpoint']).toMatchObject({
        enabled: false,
        providerCallsPerformed: false,
        summary: {
          scheduled: 0,
          claimed: 0,
          reservations: 0,
          writes: 0,
          providerCalls: 0,
        },
      });
    },
  );

  it('rejects duplicate central registrations before execution', async () => {
    await expect(
      runWorkerRunners({
        context: context('once'),
        registrations: [workerRunnerRegistrations[0]!, workerRunnerRegistrations[0]!],
      }),
    ).rejects.toThrow('Duplicate worker runner ID');
  });
});
