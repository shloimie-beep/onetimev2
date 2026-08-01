import { describe, expect, it, vi } from 'vitest';

import { loadConfig } from '../../../../../packages/config/src/index.ts';
import type { WorkerRunnerContext } from '../registry/index.ts';
import { runContentPublicationWorker } from './composition.ts';

describe('P21 worker composition', () => {
  it.each(['once', 'continuous'] as const)(
    'is authority-null and performs no database or provider work by default in %s mode',
    async (mode) => {
      const query = vi.fn();
      const connect = vi.fn();
      const result = await runContentPublicationWorker({
        config: loadConfig({
          NODE_ENV: 'test',
          DATABASE_URL: 'postgres://test.invalid/onetime',
        }),
        pool: { query, connect, end: vi.fn() } as never,
        source: { NODE_ENV: 'test', WORKER_EXECUTION_MODE: mode },
        workerInstanceKey: `worker-${mode}`,
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      } satisfies WorkerRunnerContext);

      expect(result).toMatchObject({
        enabled: false,
        providerCallsPerformed: false,
        summary: {
          disabledReason: 'content_publication_authority_unavailable',
          providerCalls: 0,
          dispatch: { claimed: 0 },
          reconciliation: { claimed: 0 },
          finalization: { selected: 0 },
        },
      });
      expect(query).not.toHaveBeenCalled();
      expect(connect).not.toHaveBeenCalled();
    },
  );
});
